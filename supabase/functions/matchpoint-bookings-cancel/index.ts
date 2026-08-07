import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';
// 🔒 «posso scrivere sul gestionale del circolo?» — la risposta dipende da DOVE gira questa
// funzione, non da una spunta che qualcuno può dimenticare. Il perché sta tutto nel modulo.
import { righeDiProvaDaSpegnere } from './bersaglio-prova.ts';
import {
  CODICE_AMBIENTE_DI_PROVA,
  esitoDiProva,
  MESSAGGIO_AMBIENTE_DI_PROVA,
  MESSAGGIO_PROVA_REGISTRATA,
  scritturaAlCircoloConsentita,
} from './scrittura-al-circolo.ts';

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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
        throw new Error(`Worker network error after ${attempt} attempts: ${errorText(netErr)}`);
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

/**
 * In prova: fa sparire la partita, cioè il lavoro che in produzione fa il giro di
 * sincronizzazione.
 *
 * 🚨⭐⭐ PERCHÉ ESISTE, e non è simmetria con `create` — è un buco trovato ragionando prima di
 * scrivere. Chi fa sparire una partita annullata NON è questa funzione: qui si registra soltanto
 * il `staff_cancel`, cioè il REGISTRO del gesto. La riga della partita muore dopo, quando
 * `matchpoint-bookings-sync` rilegge l'occupazione da Matchpoint e non la trova più.
 * ⇒ Su una partita di PROVA quel giro non porta niente (su Matchpoint non c'è mai stata), e per
 *   giunta il reconcile ora **salta apposta** le righe marcate: senza questa funzione, annullare
 *   una partita di prova l'avrebbe lasciata al suo posto — «annullata» e ancora in elenco.
 *
 * ⚖️ Tocca SOLO le righe che portano il marchio della prova. Una riga vera non la sfiora nemmeno
 * per sbaglio: se il marchio non c'è, non è roba nostra e la decide il sync, come sempre.
 *
 * 🚨⭐⭐ CERCA IN DUE MODI, e il secondo è stato aggiunto DOPO AVER VISTO LA PARTITA RESTARE IN
 * PIEDI (7/08, prima prova dal vivo). La prima versione cercava solo per SLOT — e il ponte dei
 * soci, quando la prenotazione ha un `idReserva`, manda **solo quello**: niente data, niente
 * ora, niente campo. Le partite di prova un `idReserva` ce l'hanno (`PROVA-…`) ⇒ non si trovava
 * mai nulla, l'annullo rispondeva «fatto» e la partita restava nell'elenco.
 * ⭐ Il codice del ponte lo aveva perfino previsto: *«su tutti i record veri id_reserva è vuoto,
 * quindi parte la terna — e un giorno in cui non fosse più così, questa è l'unica riga che lo
 * direbbe prima e non dopo»*. Quel giorno era oggi, e a dirlo è stata la prova, non la lettura.
 * ⚠️ E il caso automatico non poteva accorgersene: misurava che questa funzione fosse CHIAMATA,
 * non che trovasse qualcosa. Struttura ≠ resa.
 */
async function spegniPartiteDiProvaSulloSlot(opts: {
  supabaseUrl: string;
  supabaseKey: string;
  cancel: CancelRequest;
}): Promise<number> {
  const { supabaseUrl, supabaseKey, cancel } = opts;
  const client = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await client
    .from('pmo_cloud_records')
    .select('local_key, payload')
    .eq('record_type', 'staff_booking')
    .eq('deleted', false);
  if (error) throw error;
  const righe = (data ?? []) as Array<{ local_key: string; payload: JsonMap }>;
  // ⭐ La scelta del bersaglio sta in un modulo PURO (`bersaglio-prova.ts`), perché è la parte
  // che si può sbagliare — e che infatti è stata sbagliata. Qui resta solo il girare del database.
  const stessoSlot = righeDiProvaDaSpegnere(righe, cancel);
  const adesso = new Date().toISOString();
  for (const r of stessoSlot) {
    await client.from('pmo_cloud_records').upsert({
      record_type: 'staff_booking',
      local_key: r.local_key,
      payload: r.payload,
      deleted: true,
      updated_at: adesso,
      synced_at: adesso,
    }, { onConflict: 'record_type,local_key' });
  }
  return stessoSlot.length;
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

  await client.from('pmo_cloud_records').upsert({
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
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
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
  //
  // 🆕 7/08 — di qua non si rifiuta più: si spegne la partita di prova e si registra il gesto,
  // senza chiamare il circolo. 🚨 L'ordine conta: prima si SPEGNE, poi si registra — se si
  // registrasse per prima, un guasto nel mezzo lascerebbe scritto «annullata» accanto a una
  // partita ancora in piedi, che è la contraddizione peggiore da leggere in un registro.
  if (!scritturaAlCircoloConsentita(supabaseUrl)) {
    console.warn(JSON.stringify({ event: 'ambiente_di_prova', azione: 'cancel', cancel }));
    const workerResult = esitoDiProva('cancel');
    let spente = 0;
    try {
      spente = await spegniPartiteDiProvaSulloSlot({ supabaseUrl, supabaseKey, cancel });
      await saveStaffCancelRecord({ supabaseUrl, supabaseKey, actor, cancel, workerResult });
    } catch (dbErr) {
      console.error(JSON.stringify({ event: 'prova_non_registrata', error: errorText(dbErr) }));
      return err(503, CODICE_AMBIENTE_DI_PROVA, MESSAGGIO_AMBIENTE_DI_PROVA, { avrebbe_annullato: cancel });
    }
    // 🚨⭐⭐ ZERO SPENTE ⇒ NON si dice «fatto». Trovato dal vivo il 7/08: la prima versione
    // rispondeva ok comunque, e il bot diceva al socio «ho annullato» accanto a una partita
    // ancora in elenco. È esattamente la bugia che questo progetto insegue da luglio, e qui
    // sarebbe nata NUOVA — dentro il pezzo costruito per provare meglio.
    // ⚖️ Zero non vuol dire guasto: vuol dire che su quello slot non c'era nessuna partita di
    // PROVA (per esempio è una partita vera, che di prova non si può annullare). Ma per chi
    // chiede «annulla» le due cose finiscono uguali — non è successo niente — e va detto.
    if (spente === 0) {
      return err(409, 'PROVA_NIENTE_DA_ANNULLARE',
        'Ambiente di prova: su quello slot non c\'è nessuna partita di prova da annullare. '
        + 'Il gestionale del circolo non è stato toccato, e qui non è cambiato niente.',
        { prova: true, cancel });
    }
    return ok({
      message: `Annullamento di PROVA: ${spente === 1 ? 'la partita è stata tolta' : `${spente} partite sono state tolte`} dal gestionale di prova.`,
      prova: true,
      partite_di_prova_spente: spente,
      nota: MESSAGGIO_PROVA_REGISTRATA,
      cancel,
      worker: workerResult,
    });
  }

  // Call browser worker
  let workerResult: JsonMap;
  try {
    workerResult = await callWorkerCancelBooking({ workerUrl, workerApiKey, cancel, operatore: actor.email });
  } catch (workerErr) {
    return err(502, 'WORKER_ERROR', errorText(workerErr), { cancel });
  }

  // Save record to DB
  try {
    await saveStaffCancelRecord({ supabaseUrl, supabaseKey, actor, cancel, workerResult });
  } catch (dbErr) {
    console.error(JSON.stringify({ event: 'db_save_failed', error: errorText(dbErr) }));
  }

  return ok({
    message: `Annullamento richiesto: ${cancel.idReserva ? `idReserva ${cancel.idReserva}` : `Campo ${cancel.campo} · ${cancel.data} · ${cancel.ora}`}`,
    cancel,
    worker: workerResult,
  });
});
