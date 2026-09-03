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
import { annotaFallimentoAlCircolo } from '../_shared/traccia-fallimento.ts';
// 🆕 VOCE 76 — l'avviso al socio nasce dalla CONFERMA, non dallo specchio. Vedi il commento
// esteso sopra `dichiaraAnnulloAlSocio`.
import { accodaFattiDaConferma, rosterDaCopiaLocale, type SlotLocale } from '../_shared/dichiara-fatti.ts';
import { fattiDaAnnullo } from '../_shared/fatti-da-conferma.ts';
// 🆕 La metà «STESSO ISTANTE» della regola del 22/08, applicata all'annullo: la copia del
// gestionale si chiude adesso, non al giro di sync. Vedi il commento in testa al modulo.
// 🔄 RIMESSA IN SERVIZIO il 23/08 sera, dopo che la corsa col sync e' stata curata alla radice:
// la fotografia di «prima» si legge ora tutta prima dell'upsert (voce 77, index.ts del sync).
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
  /**
   * 🆕🗣️ CHI ha chiesto l'annullo, quando non è la segreteria — 01/09/2026, voce 79.
   * Gemello di quello in `matchpoint-bookings-edit`: lo manda `consumer-booking-write`, l'app
   * della segreteria no, e **assente vale «il circolo»** — le frasi di sempre.
   */
  chiestoDa?: string;
};

// `EdgeRuntime.waitUntil` esiste nel runtime Supabase ma la d.ts risolta dal gate non ne
// dichiara il globale — vedi il gemello in bookings-edit. Dichiarazione locale, forma minima.
declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };

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

/**
 * 🚦 VOCE 137 — chi ha chiesto questa scrittura, detto come FATTO e non dedotto.
 *
 * Serve al semaforo del calendario: chi fa segreteria vuole vedere *«c'è un'operazione in
 * corso, e questa l'ha chiesta un socio dal bot»*. 🗣️ Decisione sua, che ha ribaltato la
 * precedente: *«io che sono di segreteria devo vedere le azioni di chi le fa dal chatbot e le
 * azioni che faccio io da gestionale»*.
 *
 * 🩹⭐⭐ E LA SCHEDA DELLA 137 QUI SBAGLIAVA, misurato il 03/09: diceva che la coda distingue un
 * gesto del bot *«solo perché gli MANCA `operatore` — un'assenza»*. Non è così. `consumerActor`
 * dà da sempre al bot un attore **pieno**, con `role: 'consumer'` e un'email sua
 * (`assistente-soci@padelvillage.club`) ⇒ `operatore` c'è, e non è vuoto.
 * ⇒ Cambia la cura, non solo la frase: non c'è nessuna assenza da rendere esplicita — c'è un
 * **ruolo** che si ferma qui invece di arrivare al worker.
 *
 * ⛔ E si passa il RUOLO, non l'email, benché l'email basterebbe a riconoscerlo: filtrare su
 * `email === 'assistente-soci@…'` funzionerebbe finché nessuno rinomina quella casella, e il
 * giorno in cui qualcuno la rinomina **niente diventa rosso** — i gesti dal bot si
 * ridichiarerebbero «staff» in silenzio. 📌 *Una regola che poggia su una stringa che qualcun
 * altro può cambiare non è una regola: è una scommessa sul fatto che nessuno la cambi.*
 *
 * ⚖️ Etichetta, non filtro: il semaforo deve DIRE «richiesta da un socio», non NASCONDERE nulla.
 * Un gesto che restasse senza etichetta si vede lo stesso — come «staff», che è il verso giusto
 * in cui sbagliare (un falso silenzio sarebbe indistinguibile dal funzionamento normale).
 */
function chiCiHaChiesto(actor: StaffActor): string {
  return actor.role === 'consumer' ? 'socio' : 'staff';
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
  chiestoDa?: string;
}): Promise<JsonMap> {
  const { workerUrl, workerApiKey, cancel, operatore, chiestoDa } = opts;
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
        body: JSON.stringify({ idReserva: cancel.idReserva, campo: cancel.campo, data: cancel.data, ora: cancel.ora, operatore: operatore ?? '', chiestoDa: chiestoDa ?? '' }),
      });
    } catch (netErr) {
      if (attempt === 3) {
        // ⭐⭐ IL TERZO ESITO, marchiato su una PROPRIETÀ: tre volte senza risposta — l'annullo
        // può essere passato lo stesso. Un rifiuto del worker invece È una risposta: no marchio.
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
    // 🚨 Anche qui si guarda l'esito (11/08/2026): questo spegne la riga di una partita di
    // prova, e un fallimento ignorato la lascerebbe **viva** mentre al socio si è detto
    // «annullata». Il tipo `staff_booking` è sempre stato ammesso, quindi qui non c'era il
    // difetto della migrazione — ma il modo di sbagliare in silenzio sì, ed è lo stesso.
    const { error: erroreSpegnimento } = await client.from('pmo_cloud_records').upsert({
      record_type: 'staff_booking',
      local_key: r.local_key,
      payload: r.payload,
      deleted: true,
      updated_at: adesso,
      synced_at: adesso,
    }, { onConflict: 'record_type,local_key' });
    if (erroreSpegnimento) throw new Error(`riga di prova non spenta (${r.local_key}): ${erroreSpegnimento.message}`);
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

  // 🚨⭐⭐ 11/08/2026 — LO STESSO DIFETTO DI `staff_edit`, e nessuno l'aveva visto per la stessa
  // ragione: `staff_cancel` non era nell'elenco dei tipi ammessi dal CHECK, il database
  // rifiutava, e senza guardare `{ error }` il rifiuto usciva come un «fatto». Zero righe in
  // assoluto, su TEST e su PROD. Curato dalla migrazione `…_staff_edit_cancel`.
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
  // 🚨 `idReserva` si passa SEMPRE, ed è la correzione della prova del 23/08: il ponte, quando
  // la prenotazione ha un id, manda **solo quello** — e senza la terna questa cura non entrava
  // nemmeno in funzione. Con l'id lo slot si ricava dalla copia locale.
  // ⛔ RITIRATA IL 23/08 ALLE 16:40, DOPO UN MESSAGGIO FALSO A UN SOCIO VERO —
  // 🔄 e RIMESSA la sera stessa, quando la causa e' stata trovata e curata ALTROVE.
  //
  // 🚨 Il difetto era questo: chiudendo la copia PRIMA che il sync scriva il suo giro, un
  // export gia' in volo (scattato quando la partita c'era ancora) faceva vedere al confronto
  // uno slot che «prima non c'era e adesso c'e'» ⇒ nasceva un `aggiunto` FALSO. Misurato:
  // annullo e chiusura alle 14:34:29, `aggiunto` accodato alle 14:35:59 su un export delle
  // 14:34:01, consegnato alle 14:36:46 — «Sei in campo» per la partita appena annullata.
  //
  // 🔎 E LA CAUSA NON ERA QUI. La protezione esiste — la lapide `staff_suppress` fa resuscitare
  // la riga sepolta nella fotografia di PRIMA (voce 73) — e non aveva funzionato perche' il
  // SYNC leggeva le due meta' di quella fotografia in due momenti, con l'upsert in mezzo:
  // l'upsert riportava la riga a `deleted = false`, e la resurrezione, che gira dopo e cerca
  // fra i sepolti, non trovava piu' niente (`risorti: 0`). Curato in
  // `matchpoint-bookings-sync/index.ts`: le due letture stanno ora nello stesso istante, prima
  // dell'upsert — guardia `ordine-fotografia.test.ts`, vista farsi ROSSA sul sorgente di prima.
  //
  // ⚖️ E la stessa corsa esisteva gia' per un annullo della SEGRETERIA, perche' anche l'app
  // seppellisce le proprie copie all'istante: questa cura non l'aveva creata, l'aveva resa
  // facile da vedere — arriva sempre subito dopo la conferma, cioe' sempre dentro la finestra.
  // 📌 *Un difetto che si presenta solo insieme a una cura nuova non e' per forza suo.*
  await chiudiCopiaLocaleDelloSlot({
    client,
    slot: {
      data: String(cancel.data ?? prima?.coordinate.data ?? ''),
      ora: String(cancel.ora ?? prima?.coordinate.ora ?? ''),
      campo: cancel.campo ?? prima?.coordinate.campo,
    },
    idReserva: cancel.idReserva,
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
    await accodaFattiDaConferma({ client, fatti, azione: 'cancel', chiestoDa: cancel.chiestoDa });
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
  // 🚨 Senza coordinate NON ci si arrende più: con l'`idReserva` lo slot si ricava dalla copia
  // locale. Prima di questa riga, un annullo dal bot su una prenotazione venuta dal sync
  // (che l'id ce l'ha) arrivava qui con la terna vuota e usciva `null` — misurato il 23/08.
  if ((!cancel.data || !cancel.ora) && !cancel.idReserva) return null;
  const client = createClient(supabaseUrl, supabaseKey);
  return await rosterDaCopiaLocale({
    client,
    data: cancel.data ?? '',
    ora: cancel.ora ?? '',
    campo: cancel.campo,
    idReserva: cancel.idReserva,
  });
}

// ── IL LAVORO COL NUMERO — stessa meccanica di create ed edit (promozione a righe, 6.236) ─────
// ⚖️ Su TEST il recinto registra/spegne e risponde PRIMA: il ramo async è inerte su `cudi…`.
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
    const workerResult = await callWorkerCancelBooking({ workerUrl, workerApiKey, cancel, operatore: actor.email, chiestoDa: chiCiHaChiesto(actor) });
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

  const cancel: CancelRequest = { idReserva: idReserva || undefined, campo, data, ora, chiestoDa: String((body as JsonMap)?.chiestoDa ?? '').trim() || undefined };

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

  // ── Modalità asincrona (opzionale): rispondi subito, annulla in sottofondo ──
  // ⚖️ Su TEST non si arriva qui (il recinto risponde prima): inerte apposta.
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
    workerResult = await callWorkerCancelBooking({ workerUrl, workerApiKey, cancel, operatore: actor.email, chiestoDa: chiCiHaChiesto(actor) });
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
