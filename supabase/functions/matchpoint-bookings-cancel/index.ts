import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';
// `EdgeRuntime.waitUntil` esiste nel runtime Supabase ma la d.ts risolta oggi dal gate
// (`deno check` differenziale) non ne dichiara il globale — vedi il gemello in bookings-edit.
declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };
// 🔒 «posso scrivere sul gestionale del circolo?» — la risposta dipende da DOVE gira questa
// funzione, non da una spunta che qualcuno può dimenticare. Il perché sta tutto nel modulo.
import {
  CODICE_AMBIENTE_DI_PROVA,
  MESSAGGIO_AMBIENTE_DI_PROVA,
  scritturaAlCircoloConsentita,
} from './scrittura-al-circolo.ts';
import { annotaFallimentoAlCircolo } from '../_shared/traccia-fallimento.ts';
// 🆕 VOCE 76 — l'avviso al socio nasce dalla CONFERMA, non dallo specchio. Vedi il commento
// esteso sopra `dichiaraAnnulloAlSocio`.
import { accodaFattiDaConferma, rosterDaCopiaLocale, type SlotLocale } from '../_shared/dichiara-fatti.ts';
import { fattiDaAnnullo } from '../_shared/fatti-da-conferma.ts';
// 🆕 La metà «STESSO ISTANTE» della regola del 22/08, applicata all'annullo: la copia del
// gestionale si chiude adesso, non al giro di sync. Vedi il commento in testa al modulo.
import { chiudiCopiaLocaleDelloSlot } from '../_shared/chiudi-copia-locale.ts';

type JsonMap = Record<string, unknown>;

type StaffActor = {
  userId: string;
  email: string;
  role: string;
  permissions: JsonMap;
};

type CancelRequest = {
  idReserva?: string;
  campo?: number;
  data?: string;
  ora?: string;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function ok(body: JsonMap) {
  return json({ ok: true, ...body });
}

function err(status: number, code: string, message: string, extra: JsonMap = {}) {
  return json({ ok: false, error: code, message, ...extra }, status);
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function errorText(value: unknown) {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message || String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

function hasPermission(actor: StaffActor, perm: string) {
  if (['owner', 'admin'].includes(actor.role)) return true;
  return actor.permissions?.[perm] === true;
}

// Confronto in tempo costante (percorso consumer: il secret è l'unico gate).
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

// Percorso interno CONSUMER (F2.1 «Disdici via chat»): la chiamata arriva da
// consumer-booking-write con l'header X-Consumer-Secret = CONSUMER_BRIDGE_SECRET
// (stesso gate del readmodel; l'ownership sul roster la verifica il chiamante).
// Attore sintetico marcato nei record staff_cancel. Env assente → percorso
// disabilitato, resta solo il JWT staff.
// ⚠️ Si chiamava `consumer-chat-wa` / `chat-wa@…` fino al 28/07/2026, quando il canale era
// WhatsApp: smantellato. Stessa identità di matchpoint-bookings-create e -edit, così le tre
// scritture del socio si riconoscono come una cosa sola e non come tre canali diversi.
function consumerActor(req: Request): StaffActor | null {
  const secret = clean(Deno.env.get('CONSUMER_BRIDGE_SECRET'));
  if (!secret) return null;
  const provided = clean(req.headers.get('x-consumer-secret'));
  if (!provided || !safeEqual(provided, secret)) return null;
  return {
    userId: 'consumer-assistente-soci',
    email: 'assistente-soci@padelvillage.club',
    role: 'consumer',
    permissions: { cloud_sync: true },
  };
}

async function getActor(req: Request): Promise<StaffActor | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const token = clean(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token || !supabaseUrl || !anonKey) return null;

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error } = await authClient.auth.getUser(token);
  if (error || !userData?.user) return null;

  const { data: profileData, error: profileError } = await authClient.rpc('pmo_get_my_staff_profile');
  if (profileError || !profileData) return null;
  const profile = Array.isArray(profileData) ? profileData[0] : profileData;
  if (!profile || profile.status !== 'active') return null;

  return {
    userId: userData.user.id,
    email: clean(profile.email || userData.user.email || ''),
    role: String(profile.role ?? 'staff'),
    permissions: (profile.permissions as JsonMap) ?? {},
  };
}

async function callWorkerCancelBooking(opts: {
  workerUrl: string;
  workerApiKey: string;
  cancel: CancelRequest;
  operatore?: string;
}): Promise<JsonMap> {
  const { workerUrl, workerApiKey, cancel, operatore } = opts;
  const endpoint = `${workerUrl}/cancel-booking`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${workerApiKey}`,
        },
        body: JSON.stringify({ idReserva: cancel.idReserva, campo: cancel.campo, data: cancel.data, ora: cancel.ora, operatore: operatore ?? '' }),
      });
    } catch (netErr) {
      if (attempt === 3) {
        // ⭐⭐ IL TERZO ESITO, marchiato su una PROPRIETÀ (stessa regola della sorella create):
        // tre volte senza risposta — l'annullo può essere passato lo stesso, e da qui non è
        // dato saperlo. Un rifiuto del worker invece È una risposta: errore normale, no marchio.
        const e = new Error(`Worker network error after ${attempt} attempts: ${errorText(netErr)}`) as Error & { esitoIgnoto?: boolean };
        e.esitoIgnoto = true;
        throw e;
      }
      await new Promise((r) => setTimeout(r, attempt * 3000));
      continue;
    }

    const body = await res.json().catch(() => ({}));

    if (res.ok) return body as JsonMap;

    if (res.status === 501) {
      throw new Error('WORKER_CANCEL_BOOKING_NOT_IMPLEMENTED: Il worker browser non supporta ancora la cancellazione di prenotazioni. Contatta l\'amministratore per aggiornare il worker.');
    }

    if (attempt === 3) {
      throw new Error(
        `Worker error ${res.status} after ${attempt} attempts: ${errorText((body as JsonMap).message || (body as JsonMap).error || body)}`,
      );
    }
    await new Promise((r) => setTimeout(r, attempt * 3000));
  }

  throw new Error('Worker call failed after retries');
}

async function saveStaffCancelRecord(opts: {
  supabaseUrl: string;
  supabaseKey: string;
  actor: StaffActor;
  cancel: CancelRequest;
  workerResult: JsonMap;
}) {
  const { supabaseUrl, supabaseKey, actor, cancel, workerResult } = opts;
  const client = createClient(supabaseUrl, supabaseKey);
  const localKey = `staff_cancel|${cancel.data ?? ''}|${cancel.ora ?? ''}|Campo ${cancel.campo ?? ''}|${cancel.idReserva ?? ''}|${actor.userId}`;

  // 🚨⭐⭐ 11/08/2026 — LO STESSO DIFETTO DI `staff_edit`, e nessuno l'aveva visto per la stessa
  // ragione: `staff_cancel` non era nell'elenco dei tipi ammessi dal CHECK, il database
  // rifiutava, e senza guardare `{ error }` — che supabase-js RESTITUISCE invece di lanciare —
  // il rifiuto usciva come un «fatto». Zero righe in assoluto, su TEST e su PROD.
  // Curato dalla migrazione `…_staff_edit_cancel`, da applicare PRIMA di questo codice.
  const { error: erroreRegistro } = await client.from('pmo_cloud_records').upsert({
    record_type: 'staff_cancel',
    local_key: localKey,
    payload: {
      idReserva: cancel.idReserva,
      campo: cancel.campo,
      data: cancel.data,
      ora: cancel.ora,
      cancelled_by_email: actor.email,
      cancelled_by_role: actor.role,
      worker_result: workerResult,
    },
    deleted: false,
    updated_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  }, { onConflict: 'record_type,local_key' });
  if (erroreRegistro) throw new Error(`registro staff_cancel non scritto: ${erroreRegistro.message}`);
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// 🚨⭐⭐ VOCE 76 — IL GESTIONALE DICHIARA AL SOCIO L'ANNULLO CHE IL CIRCOLO HA CONFERMATO.
//
// 🗣️ Promossa dal committente il 23/08/2026. **L'argomento non è la velocità**: fino a oggi
// l'unico posto che riempiva `pmo_eventi_staff` era il sync, che vive **leggendo Matchpoint**
// ⇒ il giorno in cui Matchpoint si spegne gli avvisi ai soci non rallentano, **cessano**.
//
// ⭐ L'annullo è il gesto in cui il ritardo costa di più, e il perché è tutto qui: toglie il
// campo a delle persone. Chi non lo sa in tempo **si presenta a giocare** — mentre uno
// spostamento saputo tardi si recupera guardando il calendario.
//
// 🚨⭐ E QUI L'ORDINE DEI DUE PASSI È OBBLIGATO, non una preferenza di stile: il roster si
// legge **PRIMA** del gesto, perché subito dopo la copia locale dello slot è una tomba (l'app
// la seppellisce, voce 73) e non c'è più nessun elenco da cui ricavare chi avvisare. Si
// dichiara invece **DOPO** la conferma, che è la regola del committente del 22/08: *«ogni
// gesto va detto al socio solo dopo che il circolo l'ha confermato»*.
// ⇒ Leggere dopo darebbe zero destinatari; dichiarare prima annuncerebbe un annullo che
// Matchpoint potrebbe ancora rifiutare. Le due metà non si possono invertire.
//
// 🔒 L'ok di Matchpoint **si ferma qui**, nel gestionale: al bot arriva un fatto dalla coda che
// legge da sempre, e del worker non sa niente. Il giorno dello spegnimento il bot non si tocca.
//
// 🚨 BEST-EFFORT E MUTA NEI GUASTI: a questo punto la partita è **già annullata sul Matchpoint
// vero**, e un errore qui non deve poterlo far sembrare fallito.
async function dichiaraAnnulloAlSocio(opts: {
  supabaseUrl: string;
  supabaseKey: string;
  cancel: CancelRequest;
  prima: SlotLocale | null;
}): Promise<void> {
  const { supabaseUrl, supabaseKey, cancel, prima } = opts;
  const client = createClient(supabaseUrl, supabaseKey);

  // ── ① REGISTRARE: la copia del gestionale si chiude ADESSO ────────────────────────────
  // 🗣️ È la metà «stesso istante» della regola del committente del 22/08 — *«ogni gesto va
  // detto al socio solo dopo che il circolo l'ha confermato, e nello stesso istante dev'essere
  // registrato dal gestionale»*. La voce 75 l'ha applicata alla creazione; questo è l'annullo.
  //
  // 📏 Perché non bastava lasciar fare al sync, misurato il 23/08: il sync delle prenotazioni
  // future **si ferma dall'01:00 alle 06:00**, e il buco vero è di **5 ore e 4 minuti** (due
  // notti identiche). Un annullo dopo l'una lasciava la copia occupata **fino alle sei del
  // mattino** — e la disponibilità che il bot offre ai soci legge proprio quelle righe, quindi
  // rispondeva «occupato» per un campo libero.
  //
  // 🚨 STA PRIMA della dichiarazione, e l'ordine è quello dello schema del 22/08: dalla
  // conferma partono insieme la ① registrazione e la ② risposta, ma se una delle due deve
  // cedere è meglio che ceda la seconda — un socio avvisato di un annullo vero è un fastidio
  // recuperabile, un campo che risulta occupato mentre è libero lo prende qualcun altro.
  await chiudiCopiaLocaleDelloSlot({
    client,
    slot: {
      data: String(cancel.data ?? prima?.coordinate.data ?? ''),
      ora: String(cancel.ora ?? prima?.coordinate.ora ?? ''),
      campo: cancel.campo ?? prima?.coordinate.campo,
    },
    adesso: Date.now(),
  });

  // ── ② RISPONDERE: il fatto va in coda, e il bot lo dirà ────────────────────────────────
  if (!prima) return;
  try {
    const fatti = fattiDaAnnullo({
      slot: prima.coordinate,
      roster: prima.roster,
      tipo: prima.tipo,
    });
    await accodaFattiDaConferma({ client, fatti, azione: 'cancel' });
  } catch (e) {
    console.warn(JSON.stringify({
      event: 'dichiarazione_annullo_saltata',
      error: String((e as Error)?.message ?? e),
    }));
  }
}

/** Chi c'era in campo prima dell'annullo. Va chiamata PRIMA di toccare il circolo. */
async function rosterPrimaDellAnnullo(opts: {
  supabaseUrl: string;
  supabaseKey: string;
  cancel: CancelRequest;
}): Promise<SlotLocale | null> {
  const { supabaseUrl, supabaseKey, cancel } = opts;
  // Senza coordinate non si sa quale slot sta sparendo ⇒ si tace, e la cosa resta al sync.
  if (!cancel.data || !cancel.ora) return null;
  const client = createClient(supabaseUrl, supabaseKey);
  return await rosterDaCopiaLocale({ client, data: cancel.data, ora: cancel.ora, campo: cancel.campo });
}

// ── IL LAVORO COL NUMERO — stessa meccanica di create ed edit (vedi il commento là) ───────────
// Con `async: true` l'annullo diventa un lavoro con un numero: la riga `booking_job` porta
// l'esito, il lavoro corre qui in sottofondo, e il telefono al risveglio chiede com'è finito.
type ScrittoreDiJob = {
  from: (tabella: string) => {
    upsert: (riga: JsonMap, opzioni?: { onConflict?: string }) => PromiseLike<unknown>;
  };
};

async function writeCancelJob(
  client: ScrittoreDiJob,
  jobId: string,
  status: string,
  extra: JsonMap = {},
): Promise<boolean> {
  const now = new Date().toISOString();
  const esito = await client.from('pmo_cloud_records').upsert({
    record_type: 'booking_job',
    local_key: jobId,
    payload: { status, azione: 'cancel', updated_at: now, ...extra },
    deleted: false,
    updated_at: now,
    synced_at: now,
  }, { onConflict: 'record_type,local_key' }) as { error?: { message?: string } | null } | null;
  const errore = esito?.error;
  if (errore) {
    console.error(JSON.stringify({
      event: 'cancel_job_non_scritto', jobId, status,
      error: errore.message ?? String(errore),
    }));
    return false;
  }
  return true;
}

async function runCancelJobInBackground(opts: {
  jobId: string; supabaseUrl: string; supabaseKey: string; actor: StaffActor;
  cancel: CancelRequest; workerUrl: string; workerApiKey: string;
}) {
  const { jobId, supabaseUrl, supabaseKey, actor, cancel, workerUrl, workerApiKey } = opts;
  const client = createClient(supabaseUrl, supabaseKey);
  const base = { cancel, cancelled_by_email: actor.email };
  // 🔒 IL RECINTO anche dentro la strada che non torna indietro (come nella create).
  if (!scritturaAlCircoloConsentita(supabaseUrl)) {
    console.warn(JSON.stringify({ event: 'ambiente_di_prova', azione: 'cancel_async', jobId, cancel }));
    await writeCancelJob(client, jobId, 'error', { ...base, error: MESSAGGIO_AMBIENTE_DI_PROVA });
    return;
  }
  try {
    // 🆕 VOCE 76 — chi c'è in campo si legge PRIMA: subito dopo l'annullo quella copia è una
    // tomba, e non resterebbe nessun elenco da cui ricavare chi avvisare.
    const primaDelGesto = await rosterPrimaDellAnnullo({ supabaseUrl, supabaseKey, cancel })
      .catch(() => null);
    const workerResult = await callWorkerCancelBooking({ workerUrl, workerApiKey, cancel, operatore: actor.email });
    try {
      await saveStaffCancelRecord({ supabaseUrl, supabaseKey, actor, cancel, workerResult });
    } catch (dbErr) {
      console.error(JSON.stringify({ event: 'db_save_failed', error: errorText(dbErr) }));
    }
    // 🆕 VOCE 76 — e si dichiara solo adesso, che il circolo ha confermato.
    await dichiaraAnnulloAlSocio({ supabaseUrl, supabaseKey, cancel, prima: primaDelGesto });
    await writeCancelJob(client, jobId, 'done', {
      ...base,
      message: `Annullamento eseguito: ${cancel.idReserva ? `idReserva ${cancel.idReserva}` : `Campo ${cancel.campo} · ${cancel.data} · ${cancel.ora}`}`,
      worker_result: workerResult,
    });
  } catch (workerErr) {
    const ignoto = !!(workerErr && typeof workerErr === 'object' && (workerErr as { esitoIgnoto?: boolean }).esitoIgnoto === true);
    await writeCancelJob(client, jobId, ignoto ? 'unknown' : 'error', {
      ...base,
      error: errorText(workerErr),
      ...(ignoto ? { message: 'Non ho ricevuto risposta dal gestionale: l\'annullo potrebbe essere passato lo stesso. Controlla su Matchpoint prima di rifarlo.' } : {}),
    });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  // «Com'è finito il lavoro N?» — per il telefono che si risveglia a operazione in volo.
  if (req.method === 'GET') {
    const actorGet = await getActor(req).catch(() => null);
    if (!actorGet) return err(401, 'UNAUTHORIZED', 'Autenticazione richiesta.');
    const jobId = clean(new URL(req.url).searchParams.get('jobId'));
    if (!jobId) return err(400, 'MISSING_JOBID', 'Parametro jobId richiesto.');
    const sUrl = clean(Deno.env.get('SUPABASE_URL'));
    const sKey = clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const client = createClient(sUrl, sKey);
    const { data, error } = await client.from('pmo_cloud_records')
      .select('payload').eq('record_type', 'booking_job').eq('local_key', jobId).maybeSingle();
    if (error) return err(500, 'DB_ERROR', errorText(error));
    if (!data) return err(404, 'JOB_NOT_FOUND', 'Job non trovato.');
    return ok({ jobId, ...((data.payload as JsonMap) ?? {}) });
  }

  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'Only POST supported');

  // Auth: percorso consumer (secret interno) O staff (JWT)
  const actor = consumerActor(req) ?? await getActor(req).catch(() => null);
  if (!actor) return err(401, 'UNAUTHORIZED', 'Autenticazione richiesta.');
  if (!hasPermission(actor, 'cloud_sync')) {
    return err(403, 'FORBIDDEN', 'Permesso cloud_sync richiesto per annullare su Matchpoint.');
  }

  // Parse body
  let body: JsonMap;
  try {
    body = await req.json();
  } catch {
    return err(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  const idReserva = body.idReserva != null ? clean(body.idReserva) : undefined;
  const campo = body.campo != null ? parseInt(String(body.campo)) : undefined;
  const data = body.data != null ? clean(body.data) : undefined;
  const ora = body.ora != null ? clean(body.ora) : undefined;

  // Validation: need idReserva OR (campo + data + ora)
  const hasId = !!idReserva;
  const hasTerna = !!campo && !!data && !!ora;
  if (!hasId && !hasTerna) {
    return err(400, 'PARAMS_MANCANTI', 'Serve idReserva oppure la terna campo+data+ora.');
  }

  const cancel: CancelRequest = { idReserva: idReserva || undefined, campo, data, ora };

  // Env vars
  const workerUrl = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_URL'));
  const workerApiKey = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_API_KEY'));
  const supabaseUrl = clean(Deno.env.get('SUPABASE_URL'));
  const supabaseKey = clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

  if (!workerUrl || !workerApiKey) {
    return err(500, 'WORKER_NOT_CONFIGURED', 'Worker Matchpoint non configurato (URL o API key mancante).');
  }

  // 🔒 IL RECINTO — l'ultimo passo prima del gestionale del circolo.
  // 🚨 Annullare è il gesto che non si torna indietro: qui il recinto vale doppio, perché una
  // prova finita davvero sul circolo toglierebbe il campo a quattro persone che ci contavano.
  if (!scritturaAlCircoloConsentita(supabaseUrl)) {
    console.warn(JSON.stringify({ event: 'ambiente_di_prova', azione: 'cancel', cancel }));
    return err(503, CODICE_AMBIENTE_DI_PROVA, MESSAGGIO_AMBIENTE_DI_PROVA, { avrebbe_annullato: cancel });
  }

  // ── Modalità asincrona (opzionale): rispondi subito, annulla in sottofondo ──
  if (body.async === true) {
    const jobId = crypto.randomUUID();
    const clientJob = createClient(supabaseUrl, supabaseKey);
    const jobScritto = await writeCancelJob(clientJob, jobId, 'pending', { cancel, cancelled_by_email: actor.email, created_at: new Date().toISOString() });
    if (!jobScritto) {
      return err(503, 'JOB_NON_AVVIATO', 'Non sono riuscito ad aprire il lavoro: l\'annullo NON è partito, rifallo.', { cancel });
    }
    EdgeRuntime.waitUntil(runCancelJobInBackground({ jobId, supabaseUrl, supabaseKey, actor, cancel, workerUrl, workerApiKey }));
    return ok({ jobId, status: 'pending', message: 'Annullamento avviato, in corso…' });
  }

  // 🆕 VOCE 76 — chi c'è in campo, letto PRIMA del gesto (vedi il commento sopra la funzione).
  const primaDelGesto = await rosterPrimaDellAnnullo({ supabaseUrl, supabaseKey, cancel })
    .catch(() => null);

  // Call browser worker
  let workerResult: JsonMap;
  try {
    workerResult = await callWorkerCancelBooking({ workerUrl, workerApiKey, cancel, operatore: actor.email });
  } catch (workerErr) {
    // ⭐ Il terzo esito anche sulla strada sincrona: 502 col CODICE giusto e il marchio.
    const ignoto = !!(workerErr && typeof workerErr === 'object' && (workerErr as { esitoIgnoto?: boolean }).esitoIgnoto === true);
    // 🆕 23/08 (voce 66) — la traccia si deposita nel gestionale anche sulla strada sincrona.
    // ⚖️ Qui il fallimento è meno caro che sulla `create` (disdire due volte non fa danno,
    // prenotare due volte sì), ma la ragione della riga è la stessa: senza, un annullo che
    // fallisce dal bot non lascia nel gestionale nulla da leggere.
    await annotaFallimentoAlCircolo({
      azione: 'cancel',
      status: ignoto ? 'unknown' : 'error',
      errore: errorText(workerErr),
      richiesta: cancel,
      attore: actor.email,
    });
    return err(502, ignoto ? 'WORKER_ESITO_IGNOTO' : 'WORKER_ERROR', errorText(workerErr), {
      cancel,
      ...(ignoto ? { esitoIgnoto: true } : {}),
    });
  }

  // Save record to DB
  try {
    await saveStaffCancelRecord({ supabaseUrl, supabaseKey, actor, cancel, workerResult });
  } catch (dbErr) {
    console.error(JSON.stringify({ event: 'db_save_failed', error: errorText(dbErr) }));
  }

  // 🆕 VOCE 76 — il circolo ha confermato: adesso lo possono sapere quelli che ci giocavano,
  // senza aspettare che il sync ri-scopra la sparizione rileggendo Matchpoint.
  await dichiaraAnnulloAlSocio({ supabaseUrl, supabaseKey, cancel, prima: primaDelGesto });

  return ok({
    message: `Annullamento richiesto: ${cancel.idReserva ? `idReserva ${cancel.idReserva}` : `Campo ${cancel.campo} · ${cancel.data} · ${cancel.ora}`}`,
    cancel,
    worker: workerResult,
  });
});
