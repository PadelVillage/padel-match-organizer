import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';
// 🔒 «posso scrivere sul gestionale del circolo?» — la risposta dipende da DOVE gira questa
// funzione, non da una spunta che qualcuno può dimenticare. Il perché sta tutto nel modulo.
import {
  CODICE_AMBIENTE_DI_PROVA,
  esitoDiProva,
  esitoVieneDaUnaProva,
  MARCHIO_NATA_IN_PROVA,
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

type BookingRequest = {
  campo: number;       // 1-4
  data: string;        // ISO date YYYY-MM-DD
  ora: string;         // HH:MM
  oraFine: string;     // HH:MM
  durata: number;      // minutes
  nome: string;        // player name (Partita) or istruttore name (Lezione)
  tipo?: string;       // 'partita' | 'lezione' | 'manutenzione' (default: 'partita')
  istruttore?: string; // istruttore name override (Lezione) — defaults to nome
  note?: string;
  // ⚠️ `codice` e `codiceCliente` sono DUE numerazioni diverse di Matchpoint e non vanno
  // scambiate: `codice` è l'id interno (HiddenFieldIdPeople), `codiceCliente` è il codice
  // della tendina «000140-Nome». Confonderle è ciò che il 2/08/2026 ha fatto sparire un
  // giocatore da una lezione (PR #624).
  giocatori?: { nome: string; codice?: string; codiceCliente?: string }[];
  // ⭐ L'id che l'APP dà alla prenotazione, generato PRIMA di chiamarci (_staffCalNewSbId) e usato
  // da lei come chiave del proprio record cloud. Se c'è, è la chiave anche per noi: così la nostra
  // riga e la sua sono LA STESSA riga invece di due. Assente quando prenota il BOT → chiave nostra.
  sbId?: string;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const DEFAULT_BASE_URL = 'https://app-padelvillage-it.matchpoint.com.es';

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

function isValidIso(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function isValidTime(time: string) {
  return /^\d{2}:\d{2}$/.test(time);
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

// Percorso interno CONSUMER (F2.1 «Prenota via chat»): la chiamata arriva da
// consumer-booking-write con l'header X-Consumer-Secret = CONSUMER_BRIDGE_SECRET
// (stesso gate del readmodel). Attore sintetico marcato: nei record staff_booking
// le prenotazioni fatte dal socio restano riconoscibili (created_by_email). Env assente
// → percorso disabilitato, resta solo il JWT staff.
// ⚠️ Si chiamava `consumer-chat-wa` / `chat-wa@…` fino al 28/07/2026, quando il canale era
// WhatsApp: smantellato. Il nome dell'attore finisce nella `local_key` del record, quindi
// è un'identità, non un'etichetta — e legarla al canale la fa invecchiare a ogni cambio di
// porta. Ora è quella già usata da matchpoint-bookings-edit per lo stesso percorso.
// 📊 Sui due archivi, prima del cambio: 1 sola riga porta la firma vecchia (PROD, 17/07,
// cancellata lo stesso giorno) e 0 su TEST ⇒ nessuno storico da spezzare.
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

  // Use anon key + user JWT in Authorization so PostgREST exposes auth.uid()/auth.jwt()
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

async function callWorkerCreateBooking(opts: {
  workerUrl: string;
  workerApiKey: string;
  username: string;
  password: string;
  baseUrl: string;
  booking: BookingRequest;
  operatore?: string;
}): Promise<JsonMap> {
  const { workerUrl, workerApiKey, username, password, baseUrl, booking, operatore } = opts;
  const endpoint = `${workerUrl}/create-booking`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerApiKey}`,
      },
      body: JSON.stringify({ username, password, baseUrl, booking, operatore: operatore ?? '' }),
    });
  } catch (netErr) {
    // NESSUN retry: la prenotazione potrebbe essere già stata creata dal worker.
    throw new Error(`Worker network error: ${errorText(netErr)}`);
  }

  const body = await res.json().catch(() => ({}));
  if (res.ok) return body as JsonMap;

  if (res.status === 501) {
    throw new Error('WORKER_CREATE_BOOKING_NOT_IMPLEMENTED: Il worker browser non supporta ancora la creazione di prenotazioni. Contatta l\'amministratore per aggiornare il worker.');
  }

  throw new Error(
    `Worker error ${res.status}: ${errorText((body as JsonMap).message || (body as JsonMap).error || body)}`,
  );
}

// Ripulisce l'id che l'app ci manda, prima che diventi la CHIAVE di una riga del cloud.
// ⛔ Niente `|`: è il separatore della chiave composta, e permetterlo lascerebbe fabbricare una
// chiave che finge di essere quella di un altro creatore. Lunghezza limitata perché finisce in
// una colonna indicizzata; la forma vera è un UUID (_staffCalNewSbId in index.html).
// Vuoto/assente/non valido → `undefined`, cioè «usa la chiave di prima»: è il caso del BOT.
export function normalizzaSbId(valore: unknown): string | undefined {
  const s = String(valore ?? '').trim();
  if (!s || s.length > 64 || s.includes('|')) return undefined;
  return s;
}

// ⭐⭐ LA CHIAVE DEL RECORD, decisa in UN SOLO POSTO. La usano sia la scrittura vera sia la
// «prova a vuoto»: se fossero due espressioni gemelle, la prova a vuoto potrebbe dire una cosa
// e il percorso vero farne un'altra — cioè una prova che rassicura senza misurare.
export function chiavePrenotazione(booking: BookingRequest, actorUserId: string): string {
  const daApp = normalizzaSbId(booking?.sbId);
  if (daApp) return daApp;
  return `staff_booking|${booking?.data}|${booking?.ora}|Campo ${booking?.campo}|${actorUserId}`;
}

// Elenco di ciò che questa versione dell'edge SA FARE. Serve a chi chiede la prova a vuoto:
// 🚨 un'edge vecchia che non la conosce ignorerebbe il flag e PRENOTEREBBE DAVVERO, quindi chi
// la chiede deve poter verificare PRIMA che dall'altra parte ci sia chi la sa fare, e rifiutarsi.
export const FEATURES = ['prova-a-vuoto-chiave', 'chiave-da-sbId'];

// Fonde la fotografia della creazione (`nostro`) con quello che nella riga c'è GIÀ.
// ⭐ Quello che c'è già VINCE campo per campo: l'ha scritto l'app, ed è lei l'autorevole sulla
// prenotazione. Noi siamo solo la rete di sicurezza per quando l'app non arriva a parlare.
// ⭐⭐ Ma un campo VUOTO non è una scelta, è un BUCO — e i buchi li riempiamo noi: nel flusso
// asincrono l'app salva PRIMA di conoscere `id_reserva`, e se la scheda venisse chiusa prima
// della risposta del worker quel numero non arriverebbe mai nel cloud.
// Pura di proposito: è la regola che decide se un dato sopravvive, e va provata da sola.
export function fondiPayloadPrenotazione(nostro: JsonMap, giaScritto: JsonMap): JsonMap {
  const fuso: JsonMap = { ...(nostro ?? {}) };
  for (const [chiave, valore] of Object.entries(giaScritto ?? {})) {
    const vuoto = valore === null || valore === undefined || valore === '' ||
      (Array.isArray(valore) && valore.length === 0);
    if (!vuoto) fuso[chiave] = valore;
  }
  return fuso;
}

async function saveStaffBookingRecord(opts: {
  supabaseUrl: string;
  supabaseKey: string;
  actor: StaffActor;
  booking: BookingRequest;
  workerResult: JsonMap;
}) {
  const { supabaseUrl, supabaseKey, actor, booking, workerResult } = opts;
  const client = createClient(supabaseUrl, supabaseKey);
  // 🚨⭐⭐ LA CHIAVE È QUELLA DELL'APP, QUANDO L'APP CE LA DÀ (v6.172, 3/08/2026).
  // Prima si usava sempre `staff_booking|<data>|<ora>|Campo <n>|<userId>`, e l'app scriveva la SUA
  // riga con l'id della prenotazione: due righe per la stessa partita. Misurato su PROD il 3/08:
  // 36 doppie su 84. L'accordo però era già stato spedito — l'app manda `sbId` dal 43274 di
  // index.html — e nessuno lo leggeva.
  // ⛔ Senza `sbId` (cioè quando prenota il BOT) resta la chiave di prima: là la nostra riga è
  // l'UNICA che esiste, e cambiarla renderebbe invisibili le prenotazioni dei soci.
  const localKey = chiavePrenotazione(booking, actor.userId);
  // idReserva è dentro al risultato del worker (stesso campo che l'app legge da worker_result.idReserva).
  const idReserva = clean((workerResult as JsonMap)?.idReserva ?? (workerResult as JsonMap)?.id_reserva);

  // 🚨⭐⭐ CONDIVIDERE LA CHIAVE VUOL DIRE POTER CANCELLARE QUELLO CHE HA SCRITTO L'ALTRO.
  // La RPC dell'app fa `payload = excluded.payload`: SOSTITUISCE. E nel flusso asincrono l'app
  // salva PRIMA e noi rispondiamo DOPO ⇒ scrivendo alla cieca, questa fotografia della creazione
  // cancellerebbe il roster aggiornato. La nostra riga è una RETE DI SICUREZZA (serve se l'app non
  // arriva mai a scrivere: scheda chiusa, crash), non la verità: quindi RIEMPIE I BUCHI e non tocca
  // ciò che c'è già — `{...nostro, ...esistente}`, dove l'esistente vince campo per campo.
  const { data: esistente } = await client
    .from('pmo_cloud_records')
    .select('payload, deleted')
    .eq('record_type', 'staff_booking')
    .eq('local_key', localKey)
    .maybeSingle();

  // ⛔ Se quella riga è già una lapide, NON la si resuscita: rimetterla viva farebbe ricomparire
  // una prenotazione annullata — è per definizione il fantasma che inseguiamo da luglio.
  if (esistente?.deleted === true) return;

  const giaScritto = (esistente?.payload ?? {}) as JsonMap;

  const nostro: JsonMap = {
    campo: booking.campo,
    data: booking.data,
    ora: booking.ora,
    ora_fine: booking.oraFine,
    durata: booking.durata,
    // tipo/istruttore/id_reserva: SENZA questi, in app il record diventava "Partita" (tipo mancante)
    // e, se vinceva il dedup per-slot, perdeva istruttore/idReserva. Ora è un peer fedele del record
    // che l'app pusha per conto suo (staffCalSaveLocal). v5.902.
    tipo: booking.tipo ?? 'partita',
    nome: booking.nome,
    istruttore: booking.istruttore ?? '',
    note: booking.note ?? '',
    giocatori: booking.giocatori ?? [],
    id_reserva: idReserva,
    created_by_email: actor.email,
    created_by_role: actor.role,
    worker_result: workerResult,
  };

  // 🔒⭐⭐ IL MARCHIO DELLA PROVA — si mette QUI, dove la riga nasce, e non nel ramo che decide
  // di simulare: così vale per ogni strada che passa di qua, oggi e domani. Senza, il giro di
  // sincronizzazione cancellerebbe questa riga al primo passaggio (su Matchpoint non c'è) e la
  // partita di prova sparirebbe da sola, senza un errore da nessuna parte.
  // ⚠️ Sta dentro `nostro`, quindi lo fonde la stessa regola degli altri campi: se la riga esiste
  // già ed è vera, l'esistente vince e il marchio non la sporca.
  if (esitoVieneDaUnaProva(workerResult)) nostro[MARCHIO_NATA_IN_PROVA] = true;

  const payload = fondiPayloadPrenotazione(nostro, giaScritto);

  // 🚨⭐⭐ 11/08/2026 — SI GUARDA L'ESITO. Qui il difetto della migrazione non c'era
  // (`staff_booking` è sempre stato fra i tipi ammessi, ed è il motivo per cui «dal bot si
  // prenota davvero in TEST» funzionava mentre modifiche e annullamenti no) — ma il modo di
  // sbagliare in silenzio era identico: supabase-js **restituisce** l'errore invece di lanciarlo.
  // ⚖️ E qui pesa più che altrove: questa è la riga che FA ESISTERE la partita di prova. Se non
  // si scrive e nessuno lo dice, al socio si risponde «prenotato» e la partita non c'è.
  const { error: erroreRiga } = await client.from('pmo_cloud_records').upsert({
    record_type: 'staff_booking',
    local_key: localKey,
    payload,
    deleted: false,
    updated_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  }, { onConflict: 'record_type,local_key' });
  if (erroreRiga) throw new Error(`riga della prenotazione non scritta: ${erroreRiga.message}`);
}

// ⚠️ Il client si dichiara per QUELLO CHE SERVE (una tabella su cui fare upsert), non col tipo
// completo di `createClient`: quel tipo porta con sé generici che cambiano fra le versioni della
// libreria, e da lì venivano 4 dei 5 errori di tipo preesistenti di questo file — un `client`
// costruito qui non risultava assegnabile a un `client` dichiarato qui.
// ⭐ Il gate dei tipi è differenziale: non si può peggiorare, e una funzione si ripulisce quando
// la si tocca. Questa la si stava toccando.
type ScrittoreDiJob = {
  from: (tabella: string) => {
    upsert: (riga: JsonMap, opzioni?: { onConflict?: string }) => PromiseLike<unknown>;
  };
};

async function writeBookingJob(
  client: ScrittoreDiJob,
  jobId: string,
  status: string,
  extra: JsonMap = {},
) {
  const now = new Date().toISOString();
  await client.from('pmo_cloud_records').upsert({
    record_type: 'booking_job',
    local_key: jobId,
    payload: { status, updated_at: now, ...extra },
    deleted: false,
    updated_at: now,
    synced_at: now,
  }, { onConflict: 'record_type,local_key' });
}

async function runBookingJobInBackground(opts: {
  jobId: string; supabaseUrl: string; supabaseKey: string; actor: StaffActor;
  booking: BookingRequest; workerUrl: string; workerApiKey: string;
  username: string; password: string; baseUrl: string;
}) {
  const { jobId, supabaseUrl, supabaseKey, actor, booking, workerUrl, workerApiKey, username, password, baseUrl } = opts;
  const client = createClient(supabaseUrl, supabaseKey);
  const base = { booking, created_by_email: actor.email };
  const tipoLabel = booking.tipo === 'lezione' ? 'Lezione' : booking.tipo === 'manutenzione' ? 'Manutenzione' : 'Partita';
  // 🔒 IL RECINTO, di nuovo — e non è una ripetizione inutile: qui si arriva DOPO aver già
  // risposto al chiamante, quindi un giro sbagliato di qua non lo vedrebbe più nessuno. La
  // difesa deve stare anche dentro la strada che non torna indietro, non solo davanti al bivio.
  // ⭐ Il lavoro si chiude sempre con un esito scritto: un job lasciato «in corso» per sempre
  // sarebbe peggio di tutto, perché chi guarda non saprebbe mai com'è finita.
  //
  // 🆕 7/08 — anche di qua si REGISTRA invece di rifiutare, e il lavoro si chiude `done`: al
  // chiamante è già stato detto «in corso», quindi lasciargli un `error` significherebbe far
  // fallire una prova che invece è andata a buon fine. Il circolo, anche qui, non si chiama.
  if (!scritturaAlCircoloConsentita(supabaseUrl)) {
    console.warn(JSON.stringify({ event: 'ambiente_di_prova', azione: 'create_async', jobId, booking }));
    const workerResult = esitoDiProva('create');
    try {
      await saveStaffBookingRecord({ supabaseUrl, supabaseKey, actor, booking, workerResult });
    } catch (dbErr) {
      await writeBookingJob(client, jobId, 'error', { ...base, error: MESSAGGIO_AMBIENTE_DI_PROVA });
      return;
    }
    await writeBookingJob(client, jobId, 'done', {
      ...base,
      prova: true,
      message: `${tipoLabel} di PROVA registrata: Campo ${booking.campo} · ${booking.data} · ${booking.ora}–${booking.oraFine} · ${booking.nome}`,
      worker_result: workerResult,
    });
    return;
  }
  try {
    const workerResult = await callWorkerCreateBooking({ workerUrl, workerApiKey, username, password, baseUrl, booking, operatore: actor.email });
    try {
      await saveStaffBookingRecord({ supabaseUrl, supabaseKey, actor, booking, workerResult });
    } catch (dbErr) {
      console.error(JSON.stringify({ event: 'db_save_failed', error: errorText(dbErr) }));
    }
    await writeBookingJob(client, jobId, 'done', {
      ...base,
      message: `${tipoLabel} prenotata: Campo ${booking.campo} · ${booking.data} · ${booking.ora}–${booking.oraFine} · ${booking.nome}`,
      worker_result: workerResult,
    });
  } catch (workerErr) {
    await writeBookingJob(client, jobId, 'error', { ...base, error: errorText(workerErr) });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  if (req.method === 'GET') {
    const actorGet = await getActor(req).catch(() => null);
    if (!actorGet) return err(401, 'UNAUTHORIZED', 'Autenticazione richiesta.');
    // 🚨⭐⭐ «Che cosa sai fare?», e serve a NON farsi male: chi vuole la prova a vuoto deve poter
    // verificare PRIMA che dall'altra parte ci sia una versione che la conosce. Un'edge vecchia
    // ignorerebbe il flag `provaAVuoto` e prenoterebbe DAVVERO — una prova a vuoto non difesa è
    // più pericolosa di non averla, perché fa credere che non stia succedendo niente.
    if (clean(new URL(req.url).searchParams.get('features')) === '1') {
      return ok({ features: FEATURES });
    }
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
    return err(403, 'FORBIDDEN', 'Permesso cloud_sync richiesto per prenotare su Matchpoint.');
  }

  // Parse body
  let body: JsonMap;
  try {
    body = await req.json();
  } catch {
    return err(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  // Validate booking fields
  const campo = parseInt(String(body.campo ?? ''));
  const data = clean(body.data);
  const ora = clean(body.ora);
  const oraFine = clean(body.oraFine);
  const durata = parseInt(String(body.durata ?? '0'));
  const nome = clean(body.nome);

  const tipo = clean(body.tipo || 'partita').toLowerCase();
  const istruttore = clean(body.istruttore);
  // 🚨 Questa normalizzazione BUTTAVA `codiceCliente`, che l'app manda da sempre: il worker lo
  // riceveva vuoto e quindi (1) cercava il socio per NOME invece che per codice, (2) non poteva
  // accendere la guardia anti-omonimia che scarta i candidati col codice diverso, e (3) lo
  // restituiva vuoto in `resolvedPlayers`, così l'app non sapeva a chi attribuire l'id interno.
  // Misurato il 2/08/2026 su PROD: una lezione e una partita vere con `codiceCliente: ""` in
  // risposta, benché l'app lo avesse mandato valorizzato. `bookings-edit` non ha il difetto —
  // là i giocatori passano al worker intatti.
  // ⚠️ `memberId` NON è più un ripiego per `codice`: memberId è il CODICE CLIENTE, mentre il
  //    worker usa `codice` come id interno atteso. Metterlo lì significava passargli un numero
  //    dell'altra numerazione — la stessa confusione del guasto di PR #624. Ora va dove deve.
  const giocatori = (Array.isArray(body.giocatori) ? body.giocatori : [])
    .map((g) => {
      if (typeof g === 'string') return { nome: clean(g), codice: '', codiceCliente: '' };
      const o = (g ?? {}) as JsonMap;
      return {
        nome: clean(o.nome ?? o.name),
        codice: clean(o.codice ?? o.id),
        codiceCliente: clean(o.codiceCliente ?? o.memberId),
      };
    })
    .filter((g) => g.nome);
  const VALID_TIPOS = ['partita', 'lezione', 'manutenzione', 'stagionale'];

  if (!campo || campo < 1 || campo > 4) return err(400, 'INVALID_CAMPO', 'Campo deve essere un numero da 1 a 4.');
  if (!isValidIso(data)) return err(400, 'INVALID_DATA', 'Data deve essere nel formato YYYY-MM-DD.');
  if (!isValidTime(ora)) return err(400, 'INVALID_ORA', 'Ora inizio deve essere nel formato HH:MM.');
  if (!isValidTime(oraFine)) return err(400, 'INVALID_ORA_FINE', 'Ora fine deve essere nel formato HH:MM.');
  if (durata <= 0 || durata > 360) return err(400, 'INVALID_DURATA', 'Durata deve essere tra 1 e 360 minuti.');
  if (!nome) return err(400, 'INVALID_NOME', 'Nome giocatore/istruttore richiesto.');
  if (!VALID_TIPOS.includes(tipo)) return err(400, 'INVALID_TIPO', `tipo deve essere uno di: ${VALID_TIPOS.join(', ')}.`);

  // 🚨⭐⭐ `sbId` va COPIATO QUI DENTRO, o non arriva a chi lo usa. Il 3/08/2026 la modifica che
  // rende `sbId` la chiave del record è stata scritta e DEPLOYATA senza questa riga: le due
  // estremità erano giuste — l'app lo mandava, saveStaffBookingRecord lo leggeva — e il valore
  // non attraversava il mezzo, perché `booking` si costruisce campo per campo e chi non è
  // elencato qui semplicemente non esiste. Le guardie del banco erano VERDI: controllavano che
  // il codice DICESSE `clean(booking.sbId)`, non che il dato ARRIVASSE.
  const sbId = normalizzaSbId(body.sbId);

  const booking: BookingRequest = {
    campo, data, ora, oraFine, durata, nome, tipo,
    istruttore: istruttore || undefined,
    note: clean(body.note),
    giocatori: giocatori.length ? giocatori : undefined,
    sbId,
  };

  // Env vars
  const workerUrl = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_URL'));
  const workerApiKey = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_API_KEY'));
  const username = clean(Deno.env.get('MATCHPOINT_USERNAME'));
  const password = clean(Deno.env.get('MATCHPOINT_PASSWORD'));
  const supabaseUrl = clean(Deno.env.get('SUPABASE_URL'));
  const supabaseKey = clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const baseUrl = clean(Deno.env.get('MATCHPOINT_BASE_URL')) || DEFAULT_BASE_URL;

  // ── PROVA A VUOTO: fa tutto TRANNE prenotare e scrivere ─────────────────────────────────
  // ⭐⭐ Collaudare questa modifica costerebbe una prenotazione VERA sul gestionale del circolo:
  // su TEST l'app simula da sé e l'edge non viene nemmeno chiamata, quindi là «ha funzionato» non
  // proverebbe niente. Qui si risponde CHE COSA SI FAREBBE — quale chiave, se una riga a quella
  // chiave esiste già — senza toccare il worker né il database. Ripetibile e gratis.
  // ⛔ Esce PRIMA di qualunque effetto: niente worker, niente upsert, niente job.
  if (body.provaAVuoto === true) {
    const sUrl = clean(Deno.env.get('SUPABASE_URL'));
    const sKey = clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const chiave = chiavePrenotazione(booking, actor.userId);
    let esistente: JsonMap | null = null;
    if (sUrl && sKey) {
      const c = createClient(sUrl, sKey);
      const { data } = await c.from('pmo_cloud_records')
        .select('payload, deleted, updated_at')
        .eq('record_type', 'staff_booking').eq('local_key', chiave).maybeSingle();
      esistente = (data as JsonMap) ?? null;
    }
    return ok({
      provaAVuoto: true,
      features: FEATURES,
      avrebbeUsatoLaChiave: chiave,
      chiaveDellApp: !!normalizzaSbId(booking.sbId),
      sbIdRicevuto: clean(body.sbId) || '(nessuno)',
      rigaGiaPresente: !!esistente,
      rigaAnnullata: esistente?.deleted === true,
      spiegazione: normalizzaSbId(booking.sbId)
        ? 'Userei la chiave dell\'app: la mia riga e la sua sarebbero LA STESSA riga.'
        : 'Nessun sbId valido ricevuto: userei la chiave composta (è il caso del bot).',
    });
  }

  if (!workerUrl || !workerApiKey) {
    return err(500, 'WORKER_NOT_CONFIGURED', 'Worker Matchpoint non configurato (URL o API key mancante).');
  }
  if (!username || !password) {
    return err(500, 'MATCHPOINT_CREDENTIALS_MISSING', 'Credenziali Matchpoint non configurate.');
  }

  // 🔒 IL RECINTO — l'ultimo passo prima del gestionale del circolo.
  // 🚨 STA PRIMA DEL RAMO ASINCRONO, e non è un dettaglio: di là la risposta torna subito e la
  // prenotazione parte in sottofondo. Un recinto messo dopo avrebbe lasciato aperta proprio la
  // strada che non si vede tornare indietro.
  // ⭐ Chi vuole vedere COSA succederebbe ha già `provaAVuoto: true`, che esce ancora prima.
  //
  // 🆕 7/08 — di qua NON si rifiuta più: si registra la partita nel gestionale di prova e il
  // circolo non lo si chiama (`callWorkerCreateBooking` non compare in questo ramo, ed è la cosa
  // che un caso costruito apposta va a verificare). Il perché sta in `scrittura-al-circolo.ts`.
  if (!scritturaAlCircoloConsentita(supabaseUrl)) {
    console.warn(JSON.stringify({ event: 'ambiente_di_prova', azione: 'create', booking }));
    const workerResult = esitoDiProva('create');
    try {
      await saveStaffBookingRecord({ supabaseUrl, supabaseKey, actor, booking, workerResult });
    } catch (dbErr) {
      // ⚖️ Qui il rifiuto di prima torna a servire, ed è il verso giusto: se la registrazione non
      // è riuscita, la partita NON esiste da nessuna parte — dirle «fatto» sarebbe la bugia che
      // questo progetto insegue da luglio. Si racconta quello che è successo, non l'intenzione.
      console.error(JSON.stringify({ event: 'prova_non_registrata', error: errorText(dbErr) }));
      return err(503, CODICE_AMBIENTE_DI_PROVA, MESSAGGIO_AMBIENTE_DI_PROVA, { avrebbe_scritto: booking });
    }
    return ok({
      message: `${tipo === 'lezione' ? 'Lezione' : tipo === 'manutenzione' ? 'Manutenzione' : 'Partita'} di PROVA registrata: Campo ${campo} · ${data} · ${ora}–${oraFine} · ${nome}`,
      prova: true,
      nota: MESSAGGIO_PROVA_REGISTRATA,
      booking,
      worker: workerResult,
    });
  }

  // ── Modalità asincrona (opzionale): rispondi subito, prenota in background ──
  if (body.async === true) {
    const jobId = crypto.randomUUID();
    const clientJob = createClient(supabaseUrl, supabaseKey);
    await writeBookingJob(clientJob, jobId, 'pending', { booking, created_by_email: actor.email, created_at: new Date().toISOString() });
    EdgeRuntime.waitUntil(runBookingJobInBackground({ jobId, supabaseUrl, supabaseKey, actor, booking, workerUrl, workerApiKey, username, password, baseUrl }));
    return ok({ jobId, status: 'pending', message: 'Prenotazione avviata, in corso…' });
  }

  // Call browser worker
  let workerResult: JsonMap;
  try {
    workerResult = await callWorkerCreateBooking({ workerUrl, workerApiKey, username, password, baseUrl, booking, operatore: actor.email });
  } catch (workerErr) {
    return err(502, 'WORKER_ERROR', errorText(workerErr), { booking });
  }

  // Save record to DB
  try {
    await saveStaffBookingRecord({ supabaseUrl, supabaseKey, actor, booking, workerResult });
  } catch (dbErr) {
    // Non-fatal: worker succeeded, just log
    console.error(JSON.stringify({ event: 'db_save_failed', error: errorText(dbErr) }));
  }

  const tipoLabel = tipo === 'lezione' ? 'Lezione' : tipo === 'manutenzione' ? 'Manutenzione' : 'Partita';
  return ok({
    message: `${tipoLabel} creata: Campo ${campo} · ${data} · ${ora}–${oraFine} · ${nome}`,
    booking,
    worker: workerResult,
  });
});
