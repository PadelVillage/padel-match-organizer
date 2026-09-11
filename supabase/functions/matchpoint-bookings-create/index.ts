import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';
// 🔒 «posso scrivere sul gestionale del circolo?» — la risposta dipende da DOVE gira questa
// funzione, non da una spunta che qualcuno può dimenticare. Il perché sta tutto nel modulo.
import {
  CODICE_AMBIENTE_DI_PROVA,
  esitoNativo,
  esitoNatoNelGestionale,
  MARCHIO_NATA_NEL_GESTIONALE,
  MESSAGGIO_AMBIENTE_DI_PROVA,
  MESSAGGIO_SCRITTURA_NATIVA,
  scritturaAlCircoloConsentita,
} from './scrittura-al-circolo.ts';
// 📐 La scheda del circolo che una partita nata in prova si scrive da sé. Regola pura, provata
// da sola: senza, su TEST la partita non ha un organizzatore e non si può gestire.
import { schedaNativa } from './scheda-nativa.ts';
// 🔔 VOCE 194 ① — la prenotazione nuova la racconta il GESTIONALE, non lo specchio.
// Il perché per esteso, con la misura, sta sopra `fattiDaCreazione`.
import { accodaFattiDaConferma } from '../_shared/dichiara-fatti.ts';
import { campoScritto, fattiDaCreazione, oggiRoma } from '../_shared/fatti-da-conferma.ts';
// 💶 voce 180 — l'importo a carico NASCE dal listino invece di essere letto da Matchpoint.
// Il perché per esteso sta in `importo-dal-listino.ts`.
import { importiDalListino, prezzoDellaFascia, quantiConImporto } from './importo-dal-listino.ts';
// ⭐⭐ I TRE ESITI della voce 23 — regola pura, in un modulo a sé e in `.js` perché il banco di
// prova gira in Node e da un modulo vero si IMPORTA invece di estrarre a fette. Stessa medicina
// di `conoscenza.js`, e per lo stesso motivo: una regola che nessuno può eseguire è una regola
// che nessuno ha provato.
import {
  chiusuraDelLavoroIgnoto,
  codiceDiRifiuto,
  decidiEsitoDelLavoro,
  erroreEsitoIgnoto,
  esitoDellaRispostaWorker,
} from './esito-prenotazione.js';
import { siPuoScrivereSopraLapide } from './lapide-prenotazione.js';
import { annotaFallimentoAlCircolo } from '../_shared/traccia-fallimento.ts';

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
  // 🆔 VOCE 215 — `pmoId` è l'id NOSTRO della persona (`PMO-000583`), e non è una terza
  // numerazione di Matchpoint: è quella che resta quando Matchpoint non c'è più.
  giocatori?: { nome: string; codice?: string; codiceCliente?: string; pmoId?: string; pmoPlayerId?: string }[];
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

/**
 * ⏱️⭐⭐ VOCE 191 — IL CRONOMETRO DEI PASSI, e nasce da una regola che questa voce ha già pagato.
 *
 * 📏 Il fatto: la scrittura prende **1,3-2,1 s** e il tempo è **tutto qui dentro** — l'app ci mette
 * 3 ms a ridisegnare il calendario. Ma *«è tutto dentro la edge»* dice **dove**, non **quale passo**.
 * 🚨 La prima cura di questa voce fu scelta su un **sospetto plausibile** (il polling della coda che
 * rubava il posto), e rimisurata **non reggeva**: nessun guadagno. ⇒ Adesso si misura **prima**.
 * 📌 *Una misura che spiega COSA (è avviamento, non lavoro) non spiega anche PERCHÉ: il primo
 *    sospetto plausibile non è una diagnosi, e prendere l'uno per l'altra fa curare la cosa
 *    sbagliata con la coscienza a posto.*
 *
 * ⚖️ **Resta acceso per sempre**, e costa quanto un `Date.now()` per passo: senza, la prossima
 * volta che qualcuno vorrà accorciare questa strada ricomincerà da capo a indovinare. Una riga di
 * registro per creazione — cioè **17 in 100 minuti**, misurato — non è un costo.
 * ⛔ Non misura la rete fra il browser e qui: quella la vede solo l'app.
 */
function cronometro() {
  const t0 = Date.now();
  let ultimo = t0;
  const passi: Record<string, number> = {};
  return {
    segna(nome: string) {
      const ora = Date.now();
      passi[nome] = ora - ultimo;
      ultimo = ora;
    },
    esito(): JsonMap {
      return { totale_ms: Date.now() - t0, passi };
    },
  };
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

async function getActor(req: Request, crono?: { segna(n: string): void }): Promise<StaffActor | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const token = clean(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token || !supabaseUrl || !anonKey) return null;

  // Use anon key + user JWT in Authorization so PostgREST exposes auth.uid()/auth.jwt()
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  /* ⏱️⭐⭐ VOCE 191 — LE DUE DOMANDE D'INGRESSO SI FANNO INSIEME, perché non dipendono l'una
   * dall'altra: `pmo_get_my_staff_profile` viaggia sul **JWT**, che è già nell'header del client,
   * e non sul risultato di `getUser`. Erano in fila per come si scrive di solito, non per un
   * vincolo. 📏 Misurate una per una prima di toccarle: **372 · 439 · 361 ms** e **335 · 336 ·
   * 130 ms** su tre giri ⇒ in fila costano la somma, insieme costano la più lenta.
   * ⛔ E si aspettano **tutte e due** (`Promise.all`) prima di guardare gli esiti: uscire al primo
   *    errore lascerebbe l'altra promessa senza nessuno che la ascolta. */
  const [utente, profilo] = await Promise.all([
    authClient.auth.getUser(token),
    authClient.rpc('pmo_get_my_staff_profile'),
  ]);
  crono?.segna('ingresso_parallelo');
  const { data: userData, error } = utente;
  if (error || !userData?.user) return null;

  const { data: profileData, error: profileError } = profilo;
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

/* ╔══════════════════════════════════════════════════════════════════════════════════╗
   ║ 🏆 I TIPI NOSTRI E LA PAROLA CHE IL WORKER CONOSCE (voce 207)                    ║
   ╚══════════════════════════════════════════════════════════════════════════════════╝

   🗣️ Sue parole del 10/09/2026: «Il torneo è un modo di chiamare una prenotazione» ·
      «Anche lo stage È un tipo di prenotazione come la LEZIONE solo con un nome diverso.»

   🚨⭐⭐ QUESTO PEZZO L'HA TROVATO LA PROVA VERA, NON IL BANCO. Con i due tipi aggiunti
      nell'app, premere «Conferma» su uno Stage tornava:
         «tipo deve essere uno di: partita, lezione, manutenzione, stagionale.»
      ⇒ Un punto che ENUMERA i tipi, e sta **fuori da `index.html`**: nessun banco dell'app
      poteva vederlo. È la voce 201 un'altra volta — *un tipo nuovo si aggiunge dove qualcuno
      lo LEGGE* — e stavolta chi lo legge è il server.

   ⚖️ DUE PAROLE PER DUE DESTINATARI, e non si possono confondere:
      · `tipo`            = la parola NOSTRA, che resta scritta nel nostro record ⇒ «stage»;
      · `tipoPerIlWorker` = la parola che MATCHPOINT conosce ⇒ «lezione».
   ⛔ Il worker accetta solo `partita | lezione | manutenzione | stagionale`, e NON si tocca:
      si deploya solo da `main`, è condiviso con PROD, e PROD è CONGELATA. ⇒ Non si allarga la
      sua lista: gli si manda una parola che già capisce. 📌 *Il macchinario si eredita, il
      nome no* — la stessa riga scritta nell'app, qui vista dal lato del server.
   🎯 E il giorno del distacco questa traduzione non serve più: il worker muore con Matchpoint,
      e resta solo la parola nostra. Togliendola, non cambia niente di ciò che scriviamo. */
const PMO_TIPI_NOSTRI: Record<string, string> = {
  partita: 'partita',
  lezione: 'lezione',
  manutenzione: 'manutenzione',
  stagionale: 'stagionale',
  stage: 'lezione',      // 🆕 un nome nuovo sul macchinario della lezione (maestro compreso)
  torneo: 'partita',     // 🆕 un nome nuovo sul macchinario della partita
};

/** La parola che il worker (e quindi Matchpoint) sa leggere. */
function tipoPerIlWorker(tipo: string | undefined): string {
  return PMO_TIPI_NOSTRI[clean(tipo || '').toLowerCase()] || 'partita';
}

/** L'etichetta da mostrare: il NOME nostro, con l'iniziale grande. */
function etichettaTipo(tipo: string | undefined): string {
  const t = clean(tipo || '').toLowerCase();
  const ETICHETTE: Record<string, string> = {
    partita: 'Partita', lezione: 'Lezione', manutenzione: 'Manutenzione',
    stagionale: 'Prenotazione stagionale', stage: 'Stage', torneo: 'Torneo',
  };
  return ETICHETTE[t] || 'Partita';
}

async function callWorkerCreateBooking(opts: {
  workerUrl: string;
  workerApiKey: string;
  username: string;
  password: string;
  baseUrl: string;
  booking: BookingRequest;
  operatore?: string;
  chiestoDa?: string;
}): Promise<JsonMap> {
  const { workerUrl, workerApiKey, username, password, baseUrl, booking, operatore, chiestoDa } = opts;
  const endpoint = `${workerUrl}/create-booking`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerApiKey}`,
      },
      // 🏆 VOCE 207 — al worker va la parola che CONOSCE: `stage` → `lezione`, `torneo` →
      //    `partita`. Il nostro `tipo` resta quello scelto in ciò che salviamo noi (vedi
      //    `saveStaffBookingRecord`): è l'unico punto in cui le due parole si separano.
      body: JSON.stringify({
        username, password, baseUrl,
        booking: { ...booking, tipo: tipoPerIlWorker(booking.tipo) },
        operatore: operatore ?? '', chiestoDa: chiestoDa ?? '',
      }),
    });
  } catch (netErr) {
    // NESSUN retry: la prenotazione potrebbe essere già stata creata dal worker.
    // ⭐ E per lo stesso motivo l'errore si MARCHIA: qui non abbiamo ricevuto risposta, quindi non
    //   sappiamo se la prenotazione c'è. Chi legge questo errore non deve poterlo confondere con
    //   un rifiuto — un rifiuto è una risposta, questo è il silenzio.
    throw erroreEsitoIgnoto(`Worker network error: ${errorText(netErr)}`);
  }

  const body = await res.json().catch(() => ({}));
  if (res.ok) return body as JsonMap;

  if (res.status === 501) {
    throw new Error('WORKER_CREATE_BOOKING_NOT_IMPLEMENTED: Il worker browser non supporta ancora la creazione di prenotazioni. Contatta l\'amministratore per aggiornare il worker.');
  }

  // ⚖️⭐⭐ voce 72 — UN RIFIUTO DEL WORKER NON È PER FORZA UN FALLIMENTO.
  // Fin qui ogni risposta non-ok usciva come errore normale, sulla regola «un rifiuto è una
  // risposta». Regge per i rifiuti che il worker sa di dare; non regge per il `QUEUE_JOB_TIMEOUT`,
  // che il worker dà **smettendo di aspettare** un'operazione ancora in corso — e se ha smesso
  // dopo il click su «Salvare», la prenotazione sul sistema del circolo c'è. La regola che
  // separa i due casi sta nel modulo puro, dove si può provare: qui c'è solo il cablaggio.
  const testo = `Worker error ${res.status}: ${errorText((body as JsonMap).message || (body as JsonMap).error || body)}`;
  if (esitoDellaRispostaWorker(body) === 'ignoto') throw erroreEsitoIgnoto(testo);
  throw new Error(testo);
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
export const FEATURES = ['prova-a-vuoto-chiave', 'chiave-da-sbId', 'esito-ignoto', 'chiusura-lavoro-ignoto'];

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
  /**
   * 🆕 22/08/2026 (voce 75) — l'istante in cui QUESTA scrittura è partita, cioè prima di
   * chiamare il worker. Serve a distinguere una lapide che c'era già (un annullo precedente,
   * sopra cui si scrive) da una arrivata nel frattempo (che può essere l'annullo proprio di
   * ciò che stiamo scrivendo, e allora non si tocca). Senza, la regola fallisce chiusa.
   */
  scritturaIniziataAlle?: string | null;
  /** ⏱️ VOCE 191 — facoltativo: se c'è, questa funzione segna i suoi tre passi. */
  crono?: { segna(n: string): void };
}) {
  const { supabaseUrl, supabaseKey, actor, booking, workerResult, scritturaIniziataAlle, crono } = opts;
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
  /* ⏱️⭐⭐ VOCE 191 — IL LISTINO SI CHIEDE **PRIMA** DI ASPETTARE LA RIGA, non dopo.
   * 📏 Misurati in fila: la lettura della riga **302 · 351 · 154 ms**, il listino **324 · 141 ·
   * 486 ms**. Nessuno dei due dipende dall'altro — uno guarda cosa c'è già a quella chiave,
   * l'altro quanto costa quell'ora — ed erano in fila solo per l'ordine in cui il codice li usa.
   * ⚠️ **COSA COSTA, dichiarato**: partendo prima, il listino si chiede **anche** nel caso in cui
   * la regola della lapide poi dice di non scrivere. È una lettura **senza effetti** e quel caso è
   * raro ⇒ si paga una chiamata inutile ogni tanto per toglierne una dalla fila **sempre**.
   * ⛔ La promessa nasce **solo** se la riga è nostra (`esitoNatoNelGestionale`), o sul percorso
   *    verso il circolo si chiederebbe un prezzo che quel ramo non usa. */
  const listinoInVolo = esitoNatoNelGestionale(workerResult)
    ? client.rpc('pmo_calendario_effettivo', { p_dal: booking.data, p_al: booking.data })
    : null;

  const { data: esistente } = await client
    .from('pmo_cloud_records')
    .select('payload, deleted, updated_at')
    .eq('record_type', 'staff_booking')
    .eq('local_key', localKey)
    .maybeSingle();
  crono?.segna('riga_esistente');

  // ⛔ Se quella riga è già una lapide, di regola NON la si resuscita: rimetterla viva farebbe
  // ricomparire una prenotazione annullata — è il fantasma che inseguiamo da luglio.
  // 🆕 22/08/2026 (voce 75) — MA una lapide non vuol dire sempre quello. La chiave non contiene
  // l'id della prenotazione, quindi due partite diverse sullo stesso slot, dello stesso attore,
  // si dividono la riga: riprenotando uno slot annullato la seconda trovava la lapide della
  // prima e usciva di qui SENZA SCRIVERE. ⇒ Il socio restava senza la sua prenotazione nella
  // copia del gestionale fino al giro di sync, e il bot — che legge solo da lì — gli rispondeva
  // «non trovo più quella partita fra le tue» venticinque secondi dopo avergli detto «Prenotato».
  // La regola sta in `lapide-prenotazione.js`, è pura, ed è provata dal banco: qui si decide solo
  // cosa farne. Il motivo si registra sempre — anche quando si scrive — perché «ho scritto sopra
  // una lapide» è esattamente il fatto che un domani si vorrà poter cercare nel registro.
  const verdettoLapide = siPuoScrivereSopraLapide({
    lapide: esistente?.deleted === true,
    payloadLapide: (esistente?.payload ?? null) as JsonMap | null,
    idNuovo: idReserva,
    sepoltaAlle: clean((esistente as JsonMap | null)?.updated_at) || null,
    scritturaIniziataAlle: scritturaIniziataAlle ?? null,
  });
  if (esistente?.deleted === true) {
    console.log(JSON.stringify({
      event: 'lapide_incontrata', scritta: verdettoLapide.si, motivo: verdettoLapide.motivo, localKey, idReserva,
    }));
  }
  if (!verdettoLapide.si) return;

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
  if (esitoNatoNelGestionale(workerResult)) {
    nostro[MARCHIO_NATA_NEL_GESTIONALE] = true;
    // 🆕⭐⭐ 11/08/2026 — LA PARTITA NATA IN PROVA SI PORTA LA PROPRIA SCHEDA.
    // Su TEST il circolo non viene chiamato ⇒ la `descrizione` (che la scrive Matchpoint) non
    // torna mai, e `organizzatoreDelloSlot` legge SOLO quella: senza, la partita non ha un
    // organizzatore e **non si può gestire** — né aggiungere né togliere. Finché non c'era, la
    // prova dell'avviso al tolto è stata montata scrivendo la `descrizione` a mano nella riga.
    // ⛔ Sta DENTRO il ramo della prova di proposito, e non accanto agli altri campi: in
    // produzione uno `staff_booking` con una `descrizione` fabbricata da noi sarebbe una seconda
    // scheda che può contraddire quella vera del circolo ⇒ copie discordi, e l'organizzatore
    // sparirebbe sul circolo VERO. Il perché per esteso sta in `scheda-nativa.ts`.
    // ⚖️ `null` = non si è potuta scrivere fedelmente: si lascia il campo com'era, e si torna
    // all'`organizzatore_ignoto` di prima. Mai una scheda che nomina la persona sbagliata.
    const scheda = schedaNativa(booking.giocatori);
    if (scheda) nostro.descrizione = scheda;

    // 💶⭐⭐ VOCE 180 — E LA PARTITA NASCE COL SUO PREZZO ADDOSSO.
    // 📏 Il fatto che rende necessaria questa riga: oggi gli importi della scheda arrivano da
    // Matchpoint **dal vivo**, e per questo esistono solo sulle partite che qualcuno ha aperto a
    // mano — 14 su 256 su PROD, 2 su 30 qui. ⇒ La cassa non avrebbe su cosa addebitare.
    // ⭐ A dire quanto costa è il GESTIONALE (`pmo_calendario_effettivo`, voce 185): la stessa
    // funzione che risponde all'app e al bot, così il prezzo è uno solo. Il giorno in cui
    // Matchpoint si spegne, questa riga non cambia.
    // ⚖️ Se il listino non risponde o quella fascia non ha un prezzo, **non si scrive niente** e
    // si registra: un importo inventato è peggio di un importo mancante, perché nessuno lo
    // verrà a controllare.
    try {
      // ⏱️ VOCE 191 — già partita più su: qui si raccoglie, e il tempo è quello che AVANZA
      //    rispetto alla lettura della riga, non la sua durata intera.
      const { data: cal, error: calErr } = await listinoInVolo!;
      crono?.segna('listino_residuo');
      if (calErr) throw new Error(calErr.message);
      const giorno = (((cal as JsonMap)?.giorni ?? []) as JsonMap[])
        .find((g) => clean(g?.data) === clean(booking.data)) ?? null;
      const prezzo = prezzoDellaFascia((giorno?.fasce ?? []) as JsonMap[], booking.ora);
      const conImporti = importiDalListino(
        (nostro.giocatori ?? []) as JsonMap[], prezzo, new Date().toISOString(),
      );
      nostro.giocatori = conImporti;
      console.log(JSON.stringify({
        event: 'importi_dal_listino',
        data: booking.data, ora: booking.ora,
        periodo: clean(giorno?.periodo_nome) || null,
        prezzo_cents: prezzo,
        quanti: quantiConImporto(conImporti),
      }));
    } catch (listinoErr) {
      // ⛔ Non è fatale: la prenotazione esiste comunque, e senza importo la scheda dirà «da
      // definire» — che è la verità. Rifiutare qui vorrebbe dire perdere una partita per un
      // prezzo mancante.
      console.warn(JSON.stringify({ event: 'importi_dal_listino_falliti', error: errorText(listinoErr) }));
    }
  }

  // 🚨⭐⭐ SOPRA UNA LAPIDE NON SI FONDE — 22/08/2026, voce 75, e senza questa riga la cura
  // avrebbe creato un difetto peggiore di quello che chiude. La fusione esiste per non
  // cancellare il roster che l'app ha aggiornato dopo di noi: `{...nostro, ...esistente}`, dove
  // l'esistente VINCE campo per campo. Ma i campi di una lapide sono quelli dell'ALTRA partita,
  // quella annullata — nome, giocatori, `id_reserva` vecchi. Fondendoli, la prenotazione nuova
  // sarebbe nata indossando i panni della morta: un roster sbagliato, e per il bot un elenco che
  // nomina gente che in campo non c'è.
  // ⇒ Su una riga VIVA si fonde (l'altra copia può saperne di più); su una lapide si sostituisce
  //   in pieno (quella riga non sa più niente di vero).
  const payload = esistente?.deleted === true ? nostro : fondiPayloadPrenotazione(nostro, giaScritto);

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
  crono?.segna('scrittura_riga');
  if (erroreRiga) throw new Error(`riga della prenotazione non scritta: ${erroreRiga.message}`);

  /* 🔔⭐⭐ VOCE 194 ① — E ADESSO LO SI DICE A CHI CI GIOCA (10/09/2026).
   *
   * 📏 IL BUCO, misurato su `cudi` prima di scrivere una riga: dall'08/09 **53 prenotazioni
   * toccate e ZERO avvisi nati**. L'ultimo evento è del 07/09 15:32, l'ultimo giro di sync
   * prima che le sei routine venissero tolte. ⇒ Una prenotazione nuova **non la raccontava
   * più nessuno**, e non lo diceva nessun errore.
   * 🔎 Perché proprio la creazione: `edit` e `cancel` erano già passate alla strada della
   *    conferma con la voce 76; questa no, perché allora il sync copriva ancora tutto.
   *    📌 *Una strada che copre un buco non lo chiude: lo nasconde finché non si spegne.*
   *
   * ⭐ STA QUI, e non nei quattro rami che chiamano questa funzione, per la stessa ragione per
   *   cui la 189 fu curata sulla classe: i rami sono **quattro** (nativo sincrono, nativo
   *   asincrono, worker sincrono, worker asincrono) e agganciarlo a ciascuno sarebbe lo stesso
   *   lavoro fatto quattro volte, con tre occasioni in più di dimenticarsene. Qui ci passano
   *   tutti — ed è il punto in cui la prenotazione **esiste davvero**: la lapide esce prima
   *   (nessuna riga scritta ⇒ niente da annunciare) e un upsert fallito ha appena lanciato.
   *
   * ⚖️ BEST-EFFORT, come le sorelle: il campo è già prenotato. Un guasto qui non deve poter
   *    far sembrare fallita una scrittura riuscita — *un avviso perso è un fastidio, una
   *    prenotazione data per fallita manda la segreteria a rifarla.*
   *
   * ⛔ `chiestoDa` NON si passa, ed è deliberato invece che dimenticato: questa edge non lo
   *    riceve nel corpo della richiesta (`BookingRequest` non ha quel campo). Assente vale «la
   *    segreteria», che è il comportamento di sempre. A non annunciare al socio ciò che ha
   *    fatto LUI pensa la **ricevuta** della voce 70, che `consumer-booking-write` lascia già
   *    sulla `create` — scritta allora come rete, col commento *«oggi non copre niente… regge
   *    il giorno in cui l'ordine cambiasse»*. Quel giorno è oggi.
   *
   * 🚨 E i giocatori si passano per NOME: `destinatari()` fa `String(g)`, quindi un oggetto
   *    `{nome, codice}` diventerebbe `[object Object]` — un destinatario che non esiste, in
   *    silenzio. */
  try {
    const fatti = fattiDaCreazione({
      slot: { data: booking.data, ora: booking.ora, campo: campoScritto(booking.campo) },
      roster: (booking.giocatori ?? []).map((g) => g?.nome).filter(Boolean),
      tipo: booking.tipo,
      oggi: oggiRoma(),
    });
    if (fatti.length) {
      // ⚖️ Client fresco come fa `edit`, invece del `client` di questa funzione: il tipo che
      //    `createClient` restituisce porta generici che cambiano fra le versioni della
      //    libreria, ed è da lì che venivano 4 dei 5 errori di tipo preesistenti di questo file.
      await accodaFattiDaConferma({ client: createClient(supabaseUrl, supabaseKey), fatti, azione: 'create' });
    }
  } catch (e) {
    console.warn(JSON.stringify({
      event: 'dichiarazione_creazione_saltata',
      error: String((e as Error)?.message ?? e),
    }));
  }
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

// 🔎 Voce 23, prima metà: questa funzione SCARTAVA l'esito della propria scrittura — un
// `await ... .upsert(...)` e nient'altro, mentre la sorella `saveStaffBookingRecord` dieci righe
// più su l'errore lo controlla e lo rilancia. Non era una convenzione del file: era una
// dimenticanza, e si vedeva dal confronto.
// ⚠️ Cosa costava: se la riga di stato non si scrive, il lavoro resta `pending` PER SEMPRE e chi
// guarda non saprà mai com'è finita — esattamente ciò che il commento qui sotto dichiara di voler
// evitare. Il silenzio era doppio, perché nemmeno nei log restava traccia.
// ⚖️ Ritorna `false` invece di lanciare: viene chiamata anche dalla strada dell'errore, e
// un'eccezione lì diventerebbe un rifiuto non catturato dentro un lavoro di sfondo — cioè
// romperebbe la cosa che sta cercando di raccontare. Chi ha bisogno di fermarsi (la scrittura
// iniziale) guarda il valore di ritorno.
async function writeBookingJob(
  client: ScrittoreDiJob,
  jobId: string,
  status: string,
  extra: JsonMap = {},
): Promise<boolean> {
  const now = new Date().toISOString();
  const esito = await client.from('pmo_cloud_records').upsert({
    record_type: 'booking_job',
    local_key: jobId,
    payload: { status, updated_at: now, ...extra },
    deleted: false,
    updated_at: now,
    synced_at: now,
  }, { onConflict: 'record_type,local_key' }) as { error?: { message?: string } | null } | null;
  const errore = esito?.error;
  if (errore) {
    console.error(JSON.stringify({
      event: 'booking_job_non_scritto', jobId, status,
      error: errore.message ?? String(errore),
    }));
    return false;
  }
  return true;
}

async function runBookingJobInBackground(opts: {
  jobId: string; supabaseUrl: string; supabaseKey: string; actor: StaffActor;
  booking: BookingRequest; workerUrl: string; workerApiKey: string;
  username: string; password: string; baseUrl: string;
}) {
  const { jobId, supabaseUrl, supabaseKey, actor, booking, workerUrl, workerApiKey, username, password, baseUrl } = opts;
  const client = createClient(supabaseUrl, supabaseKey);
  const base = { booking, created_by_email: actor.email };
  const tipoLabel = etichettaTipo(booking.tipo);   // 🏆 voce 207 — «Stage» e «Torneo» compresi
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
    console.warn(JSON.stringify({ event: 'scrittura_nativa', azione: 'create_async', jobId, booking }));
    // 🆕 22/08 (voce 75): anche la prova segna l'istante. Senza, la regola della lapide
    // fallisce chiusa e su TEST la copia locale non nascerebbe mai su uno slot riprenotato —
    // cioè proprio il difetto che si sta curando, sopravvissuto nell'unico ramo che è di qua.
    const scritturaIniziataAlle = new Date().toISOString();
    const workerResult = esitoNativo('create');
    try {
      await saveStaffBookingRecord({ supabaseUrl, supabaseKey, actor, booking, workerResult, scritturaIniziataAlle });
    } catch (dbErr) {
      await writeBookingJob(client, jobId, 'error', { ...base, error: MESSAGGIO_AMBIENTE_DI_PROVA });
      return;
    }
    await writeBookingJob(client, jobId, 'done', {
      ...base,
      nativa: true,
      message: `${tipoLabel} registrata: Campo ${booking.campo} · ${booking.data} · ${booking.ora}–${booking.oraFine} · ${booking.nome}`,
      worker_result: workerResult,
    });
    return;
  }
  // 🆕 22/08 (voce 75): si segna PRIMA di chiamare il circolo. Una lapide più vecchia di questo
  // istante non può essere l'annullo di questa prenotazione — un annullo non precede ciò che
  // annulla — e su quella si scrive.
  const scritturaIniziataAlle = new Date().toISOString();
  try {
    const workerResult = await callWorkerCreateBooking({ workerUrl, workerApiKey, username, password, baseUrl, booking, operatore: actor.email, chiestoDa: chiCiHaChiesto(actor) });
    try {
      await saveStaffBookingRecord({ supabaseUrl, supabaseKey, actor, booking, workerResult, scritturaIniziataAlle });
    } catch (dbErr) {
      console.error(JSON.stringify({ event: 'db_save_failed', error: errorText(dbErr) }));
    }
    await writeBookingJob(client, jobId, 'done', {
      ...base,
      message: `${tipoLabel} prenotata: Campo ${booking.campo} · ${booking.data} · ${booking.ora}–${booking.oraFine} · ${booking.nome}`,
      worker_result: workerResult,
    });
  } catch (workerErr) {
    // ⭐⭐ QUI vivono i TRE esiti, voce 23. Se il worker ha RISPOSTO un rifiuto l'esito è noto e si
    // scrive `error`. Se invece non è arrivata nessuna risposta, quello che sappiamo è che NON
    // SAPPIAMO — e va detto, non arrotondato al rifiuto: la prenotazione può essere già sul
    // Matchpoint del circolo, e chi legge «fallita» la rifà creando un doppione vero.
    // 📌 L'app sa già cosa farne, e non da oggi: alla regola del committente (v6.150) «quando
    //    l'esito resta IGNOTO non si indovina — si va a GUARDARE su Matchpoint» corrisponde
    //    `_uncertainStatus` → `staffCalAskMatchpoint`, coi suoi tre verdetti si/no/boh. Quella
    //    macchina c'era già: mancava che questa funzione le desse il caso da trattare.
    // ⚖️ Un'app VECCHIA che non conosce `unknown` non si rompe: non essendo né `done` né `error`
    //    lo legge come «in corso», continua a chiedere e finisce sulla stessa strada dell'ignoto
    //    per scadenza. Peggiora l'attesa, non l'esito — degradare così è voluto.
    const esito = decidiEsitoDelLavoro(workerErr, tipoLabel);
    await writeBookingJob(client, jobId, esito.status, {
      ...base,
      error: errorText(workerErr),
      ...(esito.message ? { message: esito.message } : {}),
    });
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
  // ⏱️ VOCE 191 — il cronometro parte QUI, cioè al primo istante in cui questa funzione è sua:
  //    ciò che sta prima (l'avviamento dell'isolate, la rete) da dentro non è misurabile.
  const crono = cronometro();
  const actor = consumerActor(req) ?? await getActor(req, crono).catch(() => null);
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

  // ── ⏳→✅/❌ CHIUDERE UN LAVORO RIMASTO «IGNOTO» ─────────────────────────────────────────────
  // 🚨 Il residuo della voce 23, misurato il 15/08/2026 collaudandola in produzione: quando la
  // edge chiude un lavoro con `unknown`, l'app poi VA A GUARDARE su Matchpoint e arriva a un
  // verdetto — ma quel verdetto restava nel `localStorage` di quel browser. Nel database il
  // lavoro rimaneva `unknown` PER SEMPRE: chi guarda `pmo_cloud_records` vedeva una domanda
  // ancora aperta che invece era stata chiusa, e chi non era seduto davanti a quello schermo non
  // poteva saperlo. È la stessa famiglia dei «documenti che mentono» tolti in questi giorni —
  // piccola, ma della stessa specie.
  //
  // ⛔ QUI NON SI TOCCA IL GESTIONALE DEL CIRCOLO, e per questo si esce PRIMA del recinto: non
  //    c'è nessuna chiamata al worker, nessuna prenotazione, nessuna disdetta. Si scrive una
  //    riga di stato nel NOSTRO database, su un lavoro che è già finito. Un recinto che
  //    fermasse anche questo impedirebbe di raccontare la verità su un ambiente di prova.
  //
  // 🔒 E NON SI PUÒ RISCRIVERE UN ESITO NOTO: si chiude solo ciò che è `unknown`. Se il lavoro è
  //    già `done` o `error`, quella è la parola del worker — che ha visto la cosa da vicino — e
  //    l'app, che ha guardato il calendario da fuori, non deve poterla sovrascrivere. Risponde
  //    `chiuso: false` invece di un errore: chiamarla due volte non è un guasto, è una ripresa.
  //
  // ⚖️ Degrada in sicurezza in ENTRAMBI i versi, come tutto il resto di questa voce: app nuova +
  //    edge VECCHIA → il corpo finisce nella validazione della prenotazione e torna indietro
  //    `INVALID_CAMPO` (400) senza aver toccato niente, perché la validazione sta prima di
  //    qualunque effetto; edge nuova + app vecchia → questa strada non la chiama nessuno.
  //    Chi vuole saperlo prima di provarci ha `?features=1`.
  if (clean(body.azione) === 'chiudi-lavoro-ignoto') {
    const jobId = clean(body.jobId);
    if (!jobId) return err(400, 'MISSING_JOBID', 'Parametro jobId richiesto.');
    const sUrl = clean(Deno.env.get('SUPABASE_URL'));
    const sKey = clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const client = createClient(sUrl, sKey);
    const { data, error } = await client.from('pmo_cloud_records')
      .select('payload').eq('record_type', 'booking_job').eq('local_key', jobId).maybeSingle();
    if (error) return err(500, 'DB_ERROR', errorText(error));
    if (!data) return err(404, 'JOB_NOT_FOUND', 'Job non trovato.');
    // ⭐ La decisione sta nel modulo puro, non qui: così il banco la ESEGUE invece di leggerla.
    const chiusura = chiusuraDelLavoroIgnoto((data.payload as JsonMap) ?? {}, clean(body.verdetto), {
      tentativi: Number(body.tentativi) || 0,
      quando: new Date().toISOString(),
    });
    if (!chiusura.chiudibile) {
      if (chiusura.motivo === 'VERDETTO_NON_VALIDO') {
        return err(400, 'VERDETTO_NON_VALIDO', 'verdetto deve essere "si" oppure "no".');
      }
      // Non è un errore: chiamarla su un lavoro già concluso vuol dire che qualcuno sta
      // riprendendo una verifica vecchia, ed è esattamente ciò che deve poter fare.
      return ok({ jobId, chiuso: false, motivo: chiusura.motivo, status: chiusura.status });
    }
    const chiuso = await writeBookingJob(client, jobId, chiusura.status as string, chiusura.payload as JsonMap);
    if (!chiuso) return err(503, 'JOB_NON_CHIUSO', 'Non sono riuscito a scrivere la chiusura del lavoro.');
    return ok({ jobId, chiuso: true, status: chiusura.status, verdetto: clean(body.verdetto) });
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
  // 🆔⭐⭐ VOCE 215 — E QUI SI PERDEVA IL `PMO-` DELLA PERSONA, esattamente come sopra si perdeva
  // il `codiceCliente`: questa normalizzazione **ricostruisce** l'oggetto a chiavi fisse, quindi
  // ogni campo nuovo che l'app manda muore in silenzio.
  // 📏 TROVATO DALLA PROVA FISICA l'11/09/2026, e il banco non poteva vederlo: creata una
  //    prenotazione vera su TEST, in memoria il giocatore aveva `pmoId: "PMO-000583"` e nel
  //    database la stessa riga aveva solo `{nome, codice, codiceCliente}`. ⇒ La catena era giusta
  //    nell'app e si interrompeva **nel server**, che è un lettore che dall'app non si vede.
  // 📌 *È la voce 207 un'altra volta: un campo nuovo si aggiunge dove qualcuno lo LEGGE — e uno
  //    dei lettori è il server.*
  // ⚖️ `pmoPlayerId` è accettato come sinonimo: è il nome che il campo ha in anagrafica, e chi
  //    scrivesse un ponte nuovo lo chiamerebbe naturalmente così.
  const giocatori = (Array.isArray(body.giocatori) ? body.giocatori : [])
    .map((g) => {
      if (typeof g === 'string') return { nome: clean(g), codice: '', codiceCliente: '', pmoId: '' };
      const o = (g ?? {}) as JsonMap;
      return {
        nome: clean(o.nome ?? o.name),
        codice: clean(o.codice ?? o.id),
        codiceCliente: clean(o.codiceCliente ?? o.memberId),
        // 🆔 l'id NOSTRO della persona: l'unico che sopravvive al distacco da Matchpoint.
        pmoId: clean(o.pmoId ?? o.pmoPlayerId),
      };
    })
    .filter((g) => g.nome);
  // 🏆 VOCE 207 — `stage` e `torneo` sono parole NOSTRE: si accettano qui, e si traducono in
  //    una parola che il worker conosce solo quando gli si parla (⇒ `tipoPerIlWorker`).
  const VALID_TIPOS = Object.keys(PMO_TIPI_NOSTRI);

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

  // 🔒 IL RECINTO — l'ultimo passo prima del gestionale del circolo.
  // 🚨 STA PRIMA DEL RAMO ASINCRONO, e non è un dettaglio: di là la risposta torna subito e la
  // prenotazione parte in sottofondo. Un recinto messo dopo avrebbe lasciato aperta proprio la
  // strada che non si vede tornare indietro.
  //
  // 🆕⭐⭐ 08/09 (voce 178) — E STA ANCHE PRIMA DELLA CONFIGURAZIONE, che è scesa sotto.
  // ⚠️ Questa funzione ha **due** recinti — questo, e quello del ramo asincrono più su — e per
  // questo sembrava a posto: la misura che guardava solo il primo la dava per sana. Il ramo
  // asincrono aveva davvero l'ordine giusto (là i segreti arrivano come parametri); questa
  // strada **sincrona** no. Chi toglie i secret `MATCHPOINT_*` dal gestionale nuovo — che è il
  // modo in cui il distacco si dimostra — prendeva un `500 WORKER_NOT_CONFIGURED` e non
  // arrivava mai qui, cioè non riusciva a prenotare **per conto suo**.
  // ⚖️ Su PROD il comportamento è identico: là il recinto risponde vero e si prosegue dritti al
  // controllo dei secret, che resta sopra il ramo asincrono perché è lui a passarli al lavoro
  // in sottofondo.
  // ⭐ Chi vuole vedere COSA succederebbe ha già `provaAVuoto: true`, che esce ancora prima.
  //
  // 🆕 7/08 — di qua NON si rifiuta più: si registra la partita nel gestionale di prova e il
  // circolo non lo si chiama (`callWorkerCreateBooking` non compare in questo ramo, ed è la cosa
  // che un caso costruito apposta va a verificare). Il perché sta in `scrittura-al-circolo.ts`.
  if (!scritturaAlCircoloConsentita(supabaseUrl)) {
    console.warn(JSON.stringify({ event: 'scrittura_nativa', azione: 'create', booking }));
    // 🆕 22/08 (voce 75): anche la prova segna l'istante. Senza, la regola della lapide
    // fallisce chiusa e su TEST la copia locale non nascerebbe mai su uno slot riprenotato —
    // cioè proprio il difetto che si sta curando, sopravvissuto nell'unico ramo che è di qua.
    const scritturaIniziataAlle = new Date().toISOString();
    const workerResult = esitoNativo('create');
    try {
      await saveStaffBookingRecord({ supabaseUrl, supabaseKey, actor, booking, workerResult, scritturaIniziataAlle, crono });
    } catch (dbErr) {
      // ⚖️ Qui il rifiuto di prima torna a servire, ed è il verso giusto: se la registrazione non
      // è riuscita, la partita NON esiste da nessuna parte — dirle «fatto» sarebbe la bugia che
      // questo progetto insegue da luglio. Si racconta quello che è successo, non l'intenzione.
      console.error(JSON.stringify({ event: 'scrittura_nativa_fallita', error: errorText(dbErr) }));
      return err(503, CODICE_AMBIENTE_DI_PROVA, MESSAGGIO_AMBIENTE_DI_PROVA, { avrebbe_scritto: booking });
    }
    // ⏱️ VOCE 191 — una riga di registro per creazione, col dettaglio dei passi. È lo strumento
    //    che questa voce chiedeva: senza, chi vorrà accorciare questa strada ricomincia a indovinare.
    console.log(JSON.stringify({ event: 'tempi_creazione', nativa: true, ...crono.esito() }));
    return ok({
      message: `${etichettaTipo(tipo)} registrata: Campo ${campo} · ${data} · ${ora}–${oraFine} · ${nome}`,   // 🏆 voce 207
      nativa: true,
      nota: MESSAGGIO_SCRITTURA_NATIVA,
      booking,
      worker: workerResult,
    });
  }

  // 🆕 08/09 (voce 178) — la configurazione si controlla QUI, dopo il recinto. Resta sopra il
  // ramo asincrono di proposito: è quel ramo a passare i segreti al lavoro in sottofondo, e un
  // lavoro avviato senza chiave morirebbe dove nessuno lo vede tornare.
  if (!workerUrl || !workerApiKey) {
    return err(500, 'WORKER_NOT_CONFIGURED', 'Worker Matchpoint non configurato (URL o API key mancante).');
  }
  if (!username || !password) {
    return err(500, 'MATCHPOINT_CREDENTIALS_MISSING', 'Credenziali Matchpoint non configurate.');
  }

  // ── Modalità asincrona (opzionale): rispondi subito, prenota in background ──
  if (body.async === true) {
    const jobId = crypto.randomUUID();
    const clientJob = createClient(supabaseUrl, supabaseKey);
    // 🚨 Se la riga di stato NON si scrive, il numero di lavoro che stiamo per consegnare non
    // corrisponde a niente: chi lo interroga prenderà `404 JOB_NOT_FOUND` per sempre. Meglio
    // dirlo SUBITO — qui siamo ancora prima di aver chiamato il circolo, quindi «non è partita»
    // è la verità, ed è un esito NOTO. È l'unico punto di questa funzione in cui vale la pena
    // fermarsi: dopo, il lavoro è già in volo e un rifiuto sarebbe una bugia.
    const jobScritto = await writeBookingJob(clientJob, jobId, 'pending', { booking, created_by_email: actor.email, created_at: new Date().toISOString() });
    if (!jobScritto) {
      return err(503, 'JOB_NON_AVVIATO', 'Non sono riuscito ad aprire il lavoro: la prenotazione NON è partita, rifalla.', { booking });
    }
    EdgeRuntime.waitUntil(runBookingJobInBackground({ jobId, supabaseUrl, supabaseKey, actor, booking, workerUrl, workerApiKey, username, password, baseUrl }));
    return ok({ jobId, status: 'pending', message: 'Prenotazione avviata, in corso…' });
  }

  // Call browser worker
  // 🆕 22/08 (voce 75): come nella strada asincrona, l'istante si segna PRIMA della chiamata.
  const scritturaIniziataAlle = new Date().toISOString();
  let workerResult: JsonMap;
  try {
    workerResult = await callWorkerCreateBooking({ workerUrl, workerApiKey, username, password, baseUrl, booking, operatore: actor.email, chiestoDa: chiCiHaChiesto(actor) });
  } catch (workerErr) {
    // ⭐ Stesso terzo esito della strada asincrona, e qui pesa di PIÙ: da questa passa il
    // RICORRENTE, che crea fino a quattro prenotazioni di fila. Il ciclo dell'app conta `fail++`
    // e conclude «⚠ N create, M fallite», invitando a rifarle — su un esito che nessuno conosce.
    // ⚖️ Resta un errore (502), perché contarlo come riuscito sarebbe la bugia opposta: cambia il
    // CODICE, così chi legge può distinguere «rifiutata» da «non lo so» invece di indovinare dal
    // testo del messaggio.
    const codice = codiceDiRifiuto(workerErr);
    // 🆕 23/08 (voce 66) — LA TRACCIA SI DEPOSITA ANCHE DI QUA. Di là, sulla strada asincrona,
    // l'errore intero finisce da sempre nella riga `booking_job`; di qua — che è la strada del
    // BOT — non restava niente, e l'unico posto dove leggerlo era il registro del worker sulla
    // VM, che è una finestra che scorre. ⛔ Non cambia di un carattere ciò che torna al
    // chiamante: la diagnostica va al gestionale, non al socio.
    await annotaFallimentoAlCircolo({
      azione: 'create',
      status: codice === 'WORKER_ESITO_IGNOTO' ? 'unknown' : 'error',
      errore: errorText(workerErr),
      richiesta: booking,
      attore: actor.email,
    });
    return err(502, codice, errorText(workerErr), {
      booking,
      ...(codice === 'WORKER_ESITO_IGNOTO' ? { esitoIgnoto: true } : {}),
    });
  }

  // Save record to DB
  try {
    await saveStaffBookingRecord({ supabaseUrl, supabaseKey, actor, booking, workerResult, scritturaIniziataAlle });
  } catch (dbErr) {
    // Non-fatal: worker succeeded, just log
    console.error(JSON.stringify({ event: 'db_save_failed', error: errorText(dbErr) }));
  }

  const tipoLabel = etichettaTipo(tipo);   // 🏆 voce 207
  return ok({
    message: `${tipoLabel} creata: Campo ${campo} · ${data} · ${ora}–${oraFine} · ${nome}`,
    booking,
    worker: workerResult,
  });
});
