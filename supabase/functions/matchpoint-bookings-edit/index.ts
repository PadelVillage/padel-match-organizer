import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';
// 🔒 «posso scrivere sul gestionale del circolo?» — la risposta dipende da DOVE gira questa
// funzione, non da una spunta che qualcuno può dimenticare. Il perché sta tutto nel modulo.
import {
  CODICE_AMBIENTE_DI_PROVA,
  esitoDiProva,
  MESSAGGIO_AMBIENTE_DI_PROVA,
  MESSAGGIO_PROVA_REGISTRATA,
  scritturaAlCircoloConsentita,
} from './scrittura-al-circolo.ts';
import { annotaFallimentoAlCircolo } from '../_shared/traccia-fallimento.ts';
import { esitoDelRifiutoDiModifica } from './esito-modifica.ts';
// 🆕 VOCE 76 — l'avviso al socio nasce dalla CONFERMA, non dallo specchio. Vedi il commento
// esteso sopra `dichiaraSpostamentoAlSocio`.
import { accodaFattiDaConferma, rosterDaCopiaLocale, type SlotLocale } from '../_shared/dichiara-fatti.ts';
import { campoScritto, fattiDaCambioRoster, fattiDaSpostamento, oggiRoma } from '../_shared/fatti-da-conferma.ts';

type JsonMap = Record<string, unknown>;

type StaffActor = {
  userId: string;
  email: string;
  role: string;
  permissions: JsonMap;
};

type EditMove = {
  campo?: number;
  data?: string;            // ISO yyyy-mm-dd
  oraInizio?: string;       // HH:MM
  oraFine?: string;         // HH:MM
  durationMinutes?: number;
};

type EditPlayers = {
  remove?: string[];
  removeAll?: boolean;
  // 🚨 20/08 — `codice` e `codiceCliente` sono DUE numerazioni diverse di Matchpoint e non
  // vanno scambiate: `codice` è l'id interno (`HiddenFieldIdPeople`), `codiceCliente` è il
  // codice della tendina («001013-Nome Cognome»). Il gemello di questa riga sta in
  // `matchpoint-bookings-create/index.ts`, dove la stessa avvertenza è scritta dal 2/08.
  // ⚖️ `codiceCliente` mancava QUI, e l'oggetto passava lo stesso perché questa edge inoltra
  // `players` così com'è — ma un tipo che non nomina un campo è un campo che il primo che
  // rimaneggia la funzione butta via senza accorgersene. È già successo, in `create`.
  add?: Array<{ nome: string; codice?: string; codiceCliente?: string; costo?: string }>;
};

type EditRequest = {
  idReserva?: string;
  campo?: number;
  data?: string;            // ISO yyyy-mm-dd
  ora?: string;             // HH:MM (inizio) — per far ricavare l'idReserva dal tabellone lato worker
  move?: EditMove;
  players?: EditPlayers;
  note?: string;            // Osservazioni Matchpoint (← nota app). '' = azzera; assente = non toccare.
  descrizione?: string;     // SOLO manutenzione: descrizione (TextBox2, testo del tabellone). '' = azzera; assente = non toccare.
  istruttore?: string;      // SOLO lezione: maestro (dropdown "Monitor"). Stringa non vuota = cambia; assente/'' = non toccare.
  read?: boolean;           // lettura sola: restituisce i partecipanti attuali senza modificare
  /**
   * 🆕🗣️ CHI ha chiesto la modifica, quando non è la segreteria — 01/09/2026, voce 79.
   * Lo manda `consumer-booking-write` (l'unica porta dei soci); l'app della segreteria non lo
   * manda, e **assente vale «il circolo»**, cioè le frasi di sempre. Il perché sta per esteso
   * su `accodaFattiDaConferma`.
   */
  chiestoDa?: string;
};

// `EdgeRuntime.waitUntil` esiste nel runtime Supabase ma la d.ts risolta dal gate non ne
// dichiara il globale (misurato sulla PR #815, TS2304). Dichiarazione locale, forma minima.
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

// Percorso interno CONSUMER — «ritiro della presenza»: un socio esce da una partita
// che resta in piedi per gli altri. La chiamata arriva da consumer-booking-write con
// l'header X-Consumer-Secret (stesso gate del readmodel); l'ownership sul roster la
// verifica il chiamante. Env assente → percorso disabilitato, resta solo il JWT staff.
//
// 🚨 Questo attore è VOLUTAMENTE più debole dello staff: vale solo per togliere UN
// giocatore (guardia CONSUMER_SCOPE più sotto). L'assistente dei soci non deve poter
// spostare prenotazioni, cambiare maestro o svuotare un roster.
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

async function callWorkerEditBooking(opts: {
  workerUrl: string;
  workerApiKey: string;
  edit: EditRequest;
  operatore?: string;
  chiestoDa?: string;
}): Promise<JsonMap> {
  const { workerUrl, workerApiKey, edit, operatore, chiestoDa } = opts;
  const endpoint = `${workerUrl}/edit-booking`;

  // ⚠️ NESSUN RETRY. La modifica scrive su Matchpoint in modo incrementale:
  // "+ Aggiungere all'elenco" persiste il giocatore SUBITO (prima del Salvare).
  // Ritentare su errore del worker DUPLICA le scritture (è così che il cliente 921
  // era stato aggiunto 3 volte). Un solo tentativo; in caso di errore si riporta e basta.
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerApiKey}`,
      },
      body: JSON.stringify({ idReserva: edit.idReserva, campo: edit.campo, data: edit.data, ora: edit.ora, move: edit.move, players: edit.players, note: edit.note, descrizione: edit.descrizione, istruttore: edit.istruttore, read: edit.read === true, operatore: operatore ?? '', chiestoDa: chiestoDa ?? '' }),
    });
  } catch (netErr) {
    // ⭐⭐ IL TERZO ESITO, marchiato su una PROPRIETÀ (stessa regola di `esito-prenotazione.js`
    // della sorella create): qui NON è arrivata nessuna risposta, quindi la modifica può essere
    // già sul Matchpoint del circolo. Un rifiuto del worker invece È una risposta: niente marchio.
    const e = new Error(`Worker network error (nessun retry sulle modifiche): ${errorText(netErr)}`) as Error & { esitoIgnoto?: boolean };
    e.esitoIgnoto = true;
    throw e;
  }

  const body = await res.json().catch(() => ({}));
  if (res.ok) return body as JsonMap;

  if (res.status === 501 || res.status === 404) {
    throw new Error('WORKER_EDIT_BOOKING_NOT_IMPLEMENTED: Il worker browser non espone /edit-booking. Verifica che il worker sia aggiornato e deployato.');
  }

  // 🆕🔇 VOCE 118 (05/09/2026) — UN RIFIUTO DEL WORKER NON È SEMPRE «NON È PASSATA».
  // Fino a oggi ogni corpo `ok:false` usciva di qui come errore semplice ⇒ `WORKER_ERROR` ⇒ a
  // valle (consumer-booking-write, poi il bot) «non ci sono riuscito». Ma un
  // `locator.click: Timeout` a metà di una rimozione vuol dire «ho premuto e non so com'è
  // finita», e la modifica scrive su Matchpoint in modo INCREMENTALE (vedi il commento sul
  // retry qui sopra): il click può essere passato. ⇒ Il verdetto lo dà `esito-modifica.ts`
  // — i fallimenti CERTI per nome, il diario del worker per i gesti già fatti, e tutto il
  // resto è ignoto — e il marchio è lo stesso della strada di rete: `esitoIgnoto`, che i due
  // `catch` di questa edge leggono già.
  const verdetto = esitoDelRifiutoDiModifica({ status: res.status, corpo: body, readOnly: edit.read === true });
  const e = new Error(
    `Worker error ${res.status} (nessun retry): ${errorText((body as JsonMap).message || (body as JsonMap).error || body)}`,
  ) as Error & { esitoIgnoto?: boolean };
  if (verdetto === 'ignoto') e.esitoIgnoto = true;
  throw e;
}

async function saveStaffEditRecord(opts: {
  supabaseUrl: string;
  supabaseKey: string;
  actor: StaffActor;
  edit: EditRequest;
  workerResult: JsonMap;
}) {
  const { supabaseUrl, supabaseKey, actor, edit, workerResult } = opts;
  const client = createClient(supabaseUrl, supabaseKey);
  const localKey = `staff_edit|${edit.idReserva ?? ''}|${actor.userId}|${new Date().toISOString()}`;

  // 🚨⭐⭐ 11/08/2026 — SI GUARDA L'ESITO, e prima non si guardava. supabase-js **restituisce**
  // l'errore in `{ error }` invece di lanciarlo: senza questa riga il `try/catch` di chi chiama
  // non poteva scattare, e un rifiuto del database usciva come un «fatto».
  // 📏 Non è un'ipotesi: il CHECK sui tipi non ammetteva `staff_edit`, quindi questo registro
  // **non è mai stato scritto** — zero righe in assoluto, su TEST e su PROD — e intanto il ponte
  // rispondeva «Modifica di PROVA registrata». Curato dalla migrazione `…_staff_edit_cancel`.
  // ⚖️ Qui si LANCIA e non si torna un esito: i due chiamanti trattano il fallimento in modi
  // opposti e giusti — in prova `503` (un «fatto» non provato è peggio di un no), in produzione
  // un log (la modifica al circolo **è già riuscita**: negarla manderebbe lo staff a rifarla).
  const { error: erroreRegistro } = await client.from('pmo_cloud_records').upsert({
    record_type: 'staff_edit',
    local_key: localKey,
    payload: {
      idReserva: edit.idReserva,
      // 🔄⭐ VOCE 76, domanda ① — DA DOVE partiva. L'app lo manda da sempre (`campo/data/ora`
      // di primo livello, serve al worker per ricavare l'idReserva dal tabellone) e questo
      // registro **lo buttava**: restava solo il `move`, cioè la destinazione. Per raccontare
      // uno spostamento serve la partenza, e la scheda chiedeva se farla portare all'app o
      // ricavarla dalla copia locale. ⇒ Non serviva nessuna delle due: **c'era già**, la si
      // scartava. *Prima di aggiungere una fonte, guardare cosa arriva e si sta buttando.*
      da: (edit.data || edit.ora || edit.campo !== undefined)
        ? { data: edit.data ?? null, ora: edit.ora ?? null, campo: edit.campo ?? null }
        : null,
      move: edit.move ?? null,
      players: edit.players ?? null,
      note: edit.note ?? null,
      istruttore: edit.istruttore ?? null,
      edited_by_email: actor.email,
      edited_by_role: actor.role,
      worker_result: workerResult,
    },
    deleted: false,
    updated_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  }, { onConflict: 'record_type,local_key' });
  if (erroreRegistro) throw new Error(`registro staff_edit non scritto: ${erroreRegistro.message}`);
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// 🚨⭐⭐ VOCE 76 — IL GESTIONALE DICHIARA AL SOCIO CIÒ CHE IL CIRCOLO HA APPENA CONFERMATO.
//
// 🗣️ Promossa dal committente il 23/08/2026 dopo la prova della 74. **L'argomento non è la
// velocità**: fino a oggi l'unico posto che riempiva `pmo_eventi_staff` era il sync, e il sync
// vive **leggendo Matchpoint** ⇒ il giorno in cui Matchpoint si spegne gli avvisi ai soci non
// rallentano, **cessano**. Qui l'avviso nasce dalla conferma che abbiamo già in mano.
//
// 🔒 IL DISEGNO È QUELLO DEL COMMITTENTE (22/08) E QUESTA FUNZIONE NE È IL PUNTO ESATTO:
// l'ok di Matchpoint **si ferma qui**, nel gestionale. Non prosegue verso il bot: il bot legge
// `pmo_eventi_staff` da `consumer-staff-events` come ha sempre fatto, e non sa che esista un
// worker. ⇒ Il giorno dello spegnimento il bot non si tocca — la prova del futuro.
//
// ⭐ SI DICHIARA SOLO LO SPOSTAMENTO PURO, e il perché va tenuto: questa edge sa muovere una
// partita **e** cambiarne i giocatori nello stesso gesto. Dire `spostata` a tutti sarebbe
// falso per chi è stato tolto — che del posto nuovo non deve sapere niente (regola del 23/08,
// *«corretti fino in fondo»*) — e il sync arriverebbe poi a dire anche `tolto`: due messaggi
// che si contraddicono. ⇒ Quando il gesto tocca anche il roster **non si dichiara niente** e
// la cosa resta al sync, cioè al comportamento di prima. Il paletto ⑤ dice che le due strade
// si sommano: dove la conferma non sa dire tutto, tace invece di dire metà.
//
// 🚨 BEST-EFFORT E MUTA NEI GUASTI: a questo punto la partita è **già spostata sul Matchpoint
// vero**. Un errore qui non deve poter far sembrare fallita una scrittura riuscita, o la
// segreteria la rifà — la doppia prenotazione che la voce 23 evita.
// 🚨⭐ E L'ORDINE DEI DUE PASSI NON È UN DETTAGLIO: il roster si legge **PRIMA** del gesto e si
// dichiara **DOPO** la conferma. Sono le due metà della regola del committente del 22/08 —
// *«ogni gesto va detto al socio SOLO DOPO che il circolo l'ha confermato»* — più il fatto
// tecnico che uno spostamento fa seppellire all'app la copia dello slot d'origine: leggendo
// dopo si troverebbe una tomba, e il roster sarebbe vuoto proprio quando serve.

/** Il gesto tocca i giocatori? (aggiunte, rimozioni, o lo svuotamento) */
function toccaIlRoster(edit: EditRequest): boolean {
  return !!edit.players && (
    !!edit.players.removeAll ||
    (edit.players.remove?.length ?? 0) > 0 ||
    (edit.players.add?.length ?? 0) > 0
  );
}

/** Chi c'era in campo prima del gesto, o `null` se non si dichiarerà niente. */
async function rosterPrimaDelloSpostamento(opts: {
  supabaseUrl: string;
  supabaseKey: string;
  edit: EditRequest;
}): Promise<SlotLocale | null> {
  const { supabaseUrl, supabaseKey, edit } = opts;
  // 👥 31/08 — SI LEGGE ANCHE PER IL CAMBIO PURO DI GIOCATORI, che fino a oggi non aveva
  // nessuna strada veloce e aspettava il sync (misurato: 2-4 minuti sul telefono del socio).
  // ⚖️ Il roster «prima» serve a tutte e due le dichiarazioni; a decidere QUALE si fa sono le
  // due funzioni qui sotto, non questa — che si limita a leggere.
  if (!edit.move && !toccaIlRoster(edit)) return null;
  // 🚨 Move + giocatori nello stesso gesto: nessuna delle due strade sa dire tutto ⇒ tacciono
  // tutt'e due e la cosa resta al sync. Vedi il commento qui sopra.
  if (edit.move && toccaIlRoster(edit)) return null;
  // Senza le coordinate di PARTENZA non si sa quale slot è stato mosso: l'app le manda
  // (`campo/data/ora` di primo livello), ma non sono obbligatorie. Assenti ⇒ tace.
  if (!edit.data || !edit.ora) return null;
  const client = createClient(supabaseUrl, supabaseKey);
  return await rosterDaCopiaLocale({ client, data: edit.data, ora: edit.ora, campo: edit.campo });
}

/** I fatti in coda, adesso che il circolo ha detto sì. Muta nei guasti — vedi sopra. */
async function dichiaraSpostamentoAlSocio(opts: {
  supabaseUrl: string;
  supabaseKey: string;
  edit: EditRequest;
  prima: SlotLocale | null;
}): Promise<void> {
  const { supabaseUrl, supabaseKey, edit, prima } = opts;
  const move = edit.move;
  if (!move || !prima) return;
  try {
    const fatti = fattiDaSpostamento({
      partenza: prima.coordinate,
      arrivo: {
        data: String(move.data ?? edit.data ?? '').trim(),
        ora: String(move.oraInizio ?? '').trim(),
        campo: campoScritto(move.campo ?? edit.campo),
      },
      roster: prima.roster,
      tipo: prima.tipo,
    });
    await accodaFattiDaConferma({
      client: createClient(supabaseUrl, supabaseKey),
      fatti,
      azione: 'edit',
      chiestoDa: edit.chiestoDa,
    });
  } catch (e) {
    console.warn(JSON.stringify({
      event: 'dichiarazione_spostamento_saltata',
      error: String((e as Error)?.message ?? e),
    }));
  }
}

/**
 * 👥 IL CAMBIO DI GIOCATORI, dichiarato appena il circolo l'ha confermato — 31/08/2026.
 *
 * 🗣️ Nasce dalla sua frase davanti al primo avviso della voce 79: *«ha funzionato però ci ha
 * messo parecchio tempo ad arrivare la notifica»*. 📏 Misurato: il fatto nasceva `origine:
 * sync`, quindi 0-120 secondi di attesa del giro **più** i 120 della quiete piena, invece dei
 * 30 che spettano ai fatti con l'istante vero.
 *
 * ⭐ Chi c'è ADESSO lo dice il worker (`partecipantiFinali`), che è la conferma del circolo —
 * e si legge qui, non si deduce da `edit.players`: la richiesta dice cosa si è **chiesto**, la
 * risposta cosa è **successo**, e la regola del 22/08 vuole la seconda.
 * 🔒 L'ok di Matchpoint **si ferma qui**, nel gestionale: quello che prosegue verso il bot è un
 * fatto in `pmo_eventi_staff`, come sempre. Il giorno dello spegnimento il bot non si tocca.
 *
 * 🚨 BEST-EFFORT E MUTA NEI GUASTI, come la gemella dello spostamento: a questo punto i
 * giocatori sono **già cambiati sul Matchpoint vero**, e un errore qui non deve poter far
 * sembrare fallita una scrittura riuscita.
 * ⚠️ E se tace, non si perde niente: il sync ri-scopre lo stesso cambiamento e lo racconta in
 * ritardo. Le due strade si sommano — è il paletto ⑤.
 */
async function dichiaraCambioRosterAlSocio(opts: {
  supabaseUrl: string;
  supabaseKey: string;
  edit: EditRequest;
  prima: SlotLocale | null;
  workerResult: JsonMap;
}): Promise<void> {
  const { supabaseUrl, supabaseKey, edit, prima, workerResult } = opts;
  if (!prima || edit.move || !toccaIlRoster(edit)) return;
  try {
    const finali = Array.isArray((workerResult as { partecipantiFinali?: unknown[] })?.partecipantiFinali)
      ? (workerResult as { partecipantiFinali: Array<{ nome?: unknown }> }).partecipantiFinali
      : [];
    const fatti = fattiDaCambioRoster({
      slot: prima.coordinate,
      prima: prima.roster,
      // ⚠️ L'Ospite arriva dal worker col NOME VUOTO (non ha una scheda): si tiene il posto
      // scrivendolo «Ospite», che è la parola del circolo — se no il conteggio si perde e un
      // ospite aggiunto tornerebbe invisibile, cioè il difetto da cui la voce 79 nasce.
      dopo: finali.map((p) => {
        const n = String(p?.nome ?? '').trim();
        return n || 'Ospite';
      }),
      tipo: prima.tipo,
      oggi: oggiRoma(),
    });
    if (!fatti.length) return;
    await accodaFattiDaConferma({
      client: createClient(supabaseUrl, supabaseKey),
      fatti,
      azione: 'edit_roster',
      chiestoDa: edit.chiestoDa,
    });
  } catch (e) {
    console.warn(JSON.stringify({
      event: 'dichiarazione_cambio_roster_saltata',
      error: String((e as Error)?.message ?? e),
    }));
  }
}

// ── IL LAVORO COL NUMERO — la stessa meccanica della sorella create (voce 23) ─────────────────
// Con `async: true` la modifica diventa un LAVORO con un numero: la riga `booking_job` porta
// l'esito, il lavoro corre QUI in sottofondo (EdgeRuntime.waitUntil — il worker non cambia), e
// il telefono al risveglio chiede «com'è finito il lavoro N?» con una GET da un secondo.
// ⚖️ SU TEST il recinto registra e risponde PRIMA di arrivare qui: il ramo async è inerte per
// costruzione su `cudi…`, e sta qui per tenere i rami allineati (promozione a righe della 6.236).
type ScrittoreDiJob = {
  from: (tabella: string) => {
    upsert: (riga: JsonMap, opzioni?: { onConflict?: string }) => PromiseLike<unknown>;
  };
};

async function writeEditJob(
  client: ScrittoreDiJob,
  jobId: string,
  status: string,
  extra: JsonMap = {},
): Promise<boolean> {
  const now = new Date().toISOString();
  const esito = await client.from('pmo_cloud_records').upsert({
    record_type: 'booking_job',
    local_key: jobId,
    payload: { status, azione: 'edit', updated_at: now, ...extra },
    deleted: false,
    updated_at: now,
    synced_at: now,
  }, { onConflict: 'record_type,local_key' }) as { error?: { message?: string } | null } | null;
  const errore = esito?.error;
  if (errore) {
    console.error(JSON.stringify({
      event: 'edit_job_non_scritto', jobId, status,
      error: errore.message ?? String(errore),
    }));
    return false;
  }
  return true;
}

async function runEditJobInBackground(opts: {
  jobId: string; supabaseUrl: string; supabaseKey: string; actor: StaffActor;
  edit: EditRequest; workerUrl: string; workerApiKey: string;
}) {
  const { jobId, supabaseUrl, supabaseKey, actor, edit, workerUrl, workerApiKey } = opts;
  const client = createClient(supabaseUrl, supabaseKey);
  const base = { edit, created_by_email: actor.email };
  // 🔒 IL RECINTO anche dentro la strada che non torna indietro (difesa in profondità).
  if (!scritturaAlCircoloConsentita(supabaseUrl)) {
    console.warn(JSON.stringify({ event: 'ambiente_di_prova', azione: 'edit_async', jobId, edit }));
    await writeEditJob(client, jobId, 'error', { ...base, error: MESSAGGIO_AMBIENTE_DI_PROVA });
    return;
  }
  try {
    // 🆕 VOCE 76 — chi c'è in campo si legge PRIMA del gesto: subito dopo, la copia dello slot
    // d'origine è una tomba e il roster sarebbe vuoto proprio quando serve.
    const primaDelGesto = await rosterPrimaDelloSpostamento({ supabaseUrl, supabaseKey, edit })
      .catch(() => null);
    const workerResult = await callWorkerEditBooking({ workerUrl, workerApiKey, edit, operatore: actor.email, chiestoDa: chiCiHaChiesto(actor) });
    try {
      await saveStaffEditRecord({ supabaseUrl, supabaseKey, actor, edit, workerResult });
    } catch (dbErr) {
      console.error(JSON.stringify({ event: 'db_save_failed', error: errorText(dbErr) }));
    }
    // 🆕 VOCE 76 — e si dichiara SOLO ADESSO, che il circolo ha confermato: senza aspettare
    // che il sync ri-scopra la stessa cosa rileggendo Matchpoint minuti dopo.
    await dichiaraSpostamentoAlSocio({ supabaseUrl, supabaseKey, edit, prima: primaDelGesto });
    await dichiaraCambioRosterAlSocio({ supabaseUrl, supabaseKey, edit, prima: primaDelGesto, workerResult });
    await writeEditJob(client, jobId, 'done', {
      ...base,
      message: `Modifica eseguita (idReserva ${edit.idReserva ?? '?'})`,
      worker_result: workerResult,
    });
  } catch (workerErr) {
    const ignoto = !!(workerErr && typeof workerErr === 'object' && (workerErr as { esitoIgnoto?: boolean }).esitoIgnoto === true);
    await writeEditJob(client, jobId, ignoto ? 'unknown' : 'error', {
      ...base,
      error: errorText(workerErr),
      ...(ignoto ? { message: 'Non ho ricevuto risposta dal gestionale: la modifica potrebbe essere passata lo stesso. Controlla su Matchpoint prima di rifarla.' } : {}),
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

  // Auth: percorso consumer (secret interno) O staff (JWT). Il consumer è ristretto
  // alla sola rimozione di un giocatore — guardia CONSUMER_SCOPE dopo il parse.
  const consumer = consumerActor(req);
  const actor = consumer ?? await getActor(req).catch(() => null);
  if (!actor) return err(401, 'UNAUTHORIZED', 'Autenticazione richiesta.');
  if (!hasPermission(actor, 'cloud_sync')) {
    return err(403, 'FORBIDDEN', 'Permesso cloud_sync richiesto per modificare su Matchpoint.');
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
  const move = (body.move && typeof body.move === 'object') ? (body.move as EditMove) : undefined;
  const players = (body.players && typeof body.players === 'object') ? (body.players as EditPlayers) : undefined;
  // note: presente (anche stringa vuota = azzera) → si scrive sulle Osservazioni; assente = non toccare.
  const noteProvided = body.note !== undefined && body.note !== null;
  const note = noteProvided ? clean(body.note) : undefined;
  // descrizione (solo manutenzione): presente (anche '') → si scrive su TextBox2; assente = non toccare.
  const descrizioneProvided = body.descrizione !== undefined && body.descrizione !== null;
  const descrizione = descrizioneProvided ? clean(body.descrizione) : undefined;
  // istruttore (solo lezione): stringa NON vuota → cambia il maestro; assente/'' = non toccare.
  const istruttore = body.istruttore != null ? clean(body.istruttore) : undefined;
  const istruttoreProvided = !!istruttore;
  const readOnly = body.read === true;

  // Validation: serve idReserva OPPURE (campo+data+ora). Per modificare serve almeno uno tra
  // move/players; in lettura sola (read) non serve nessuna modifica.
  const hasTerna = !!campo && !!data && !!ora;
  if (!idReserva && !hasTerna) {
    return err(400, 'PARAMS_MANCANTI', 'Serve idReserva, oppure campo+data+ora.');
  }
  const hasMove = !!move && Object.keys(move).length > 0;
  const hasPlayers = !!players && (
    (Array.isArray(players.add) && players.add.length > 0) ||
    (Array.isArray(players.remove) && players.remove.length > 0) ||
    players.removeAll === true
  );
  if (!readOnly && !hasMove && !hasPlayers && !noteProvided && !descrizioneProvided && !istruttoreProvided) {
    return err(400, 'EDIT_NESSUNA_MODIFICA', 'Serve almeno uno tra move, players, note, descrizione e istruttore.');
  }

  // 🚨 Guardia CONSUMER_SCOPE — cosa può fare l'assistente dei soci su una prenotazione vera.
  //
  // 🆕 5/08/2026: le cose ammesse diventano DUE, e restano ALTERNATIVE — mai insieme:
  //   · togliere UN giocatore (il socio che si ritira, o l'organizzatore che toglie qualcuno);
  //   · far entrare UN giocatore, che è l'invito alla partita del progetto «l'organizzatore
  //     forma la sua partita». Senza questo, un invito accettato non atterra da nessuna parte.
  // Spostare, cambiare nota/descrizione/maestro, svuotare il roster e la lettura sola restano
  // allo staff autenticato.
  //
  // ⭐⭐ Perché resta UNO e ALTERNATIVO, e non «fino a quattro»: il ponte dei soci scrive senza
  // che nessuno dello staff guardi, e un elenco lungo è la differenza fra una richiesta
  // sbagliata che tocca una persona e una che riscrive un roster intero. Chi domani volesse
  // allargarlo si chieda cosa succede se quella richiesta parte due volte.
  // 🚨 Fail closed: un campo di troppo fa FALLIRE la richiesta, non viene ignorato in
  // silenzio — così un errore del chiamante si vede subito invece di trasformarsi in una
  // modifica non voluta su una prenotazione vera.
  if (consumer) {
    const rimuovi = (Array.isArray(players?.remove) ? players?.remove : []) as string[];
    const aggiungi = (Array.isArray(players?.add) ? players?.add : []) as Array<{ nome?: unknown }>;
    const soloUnaRimozione = rimuovi.length === 1 && clean(rimuovi[0]).length > 0;
    const solaUnaAggiunta = aggiungi.length === 1 && clean(aggiungi[0]?.nome).length > 0;
    // Esclusivo: una delle due, mai tutt'e due nella stessa richiesta.
    const unaSolaCosa = (soloUnaRimozione && aggiungi.length === 0)
      || (solaUnaAggiunta && rimuovi.length === 0);
    const altriBlocchi = players?.removeAll === true
      || hasMove || noteProvided || descrizioneProvided || istruttoreProvided || readOnly;
    if (!unaSolaCosa || altriBlocchi) {
      console.warn('[bookings-edit] CONSUMER_SCOPE rifiutato:', JSON.stringify({
        remove: rimuovi.length, removeAll: players?.removeAll === true, add: aggiungi.length,
        move: hasMove, note: noteProvided, descrizione: descrizioneProvided,
        istruttore: istruttoreProvided, read: readOnly,
      }));
      return err(403, 'CONSUMER_SCOPE',
        'Dal ponte dei soci si può togliere UN giocatore dal roster, oppure farne entrare UNO: una cosa sola per volta.');
    }
  }

  const edit: EditRequest = { idReserva, campo, data, ora, move: hasMove ? move : undefined, players: hasPlayers ? players : undefined, note: noteProvided ? note : undefined, descrizione: descrizioneProvided ? descrizione : undefined, istruttore: istruttoreProvided ? istruttore : undefined, read: readOnly, chiestoDa: String((body as JsonMap)?.chiestoDa ?? '').trim() || undefined };

  // Env vars
  const workerUrl = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_URL'));
  const workerApiKey = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_API_KEY'));
  const supabaseUrl = clean(Deno.env.get('SUPABASE_URL'));
  const supabaseKey = clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

  if (!workerUrl || !workerApiKey) {
    return err(500, 'WORKER_NOT_CONFIGURED', 'Worker Matchpoint non configurato (URL o API key mancante).');
  }

  // 🔒 IL RECINTO — l'ultimo passo prima del gestionale del circolo.
  // ⚖️ Solo per le MODIFICHE: `read` legge la scheda e non cambia niente, e resta viva anche di
  // prova (è così che si guarda un roster senza toccarlo).
  // 🚨 Sta DOPO i controlli e PRIMA del worker apposta: la richiesta viene capita per intero e
  // raccontata («ecco cosa avrei fatto»), ma non arriva a destinazione.
  //
  // 🆕 7/08 — di qua non si rifiuta più: si registra la modifica e si risponde di sì, senza
  // chiamare il circolo. ⭐ Chi porta l'EFFETTO vero è il ponte dei soci, che dopo un `ok`
  // allinea la copia in app da sé (`allineaCopiaInApp` per uscita e togli, `aggiungiACopiaInApp`
  // per l'invito): quindi in prova un giocatore esce e rientra davvero, e si vede.
  if (!readOnly && !scritturaAlCircoloConsentita(supabaseUrl)) {
    console.warn(JSON.stringify({ event: 'ambiente_di_prova', azione: 'edit', edit }));
    const workerResult = esitoDiProva('edit');
    try {
      await saveStaffEditRecord({ supabaseUrl, supabaseKey, actor, edit, workerResult });
    } catch (dbErr) {
      // ⚖️ Come in `create`: se non si è riusciti nemmeno a registrare la prova, si torna al
      // rifiuto. Un «fatto» non provato è peggio di un no.
      console.error(JSON.stringify({ event: 'prova_non_registrata', error: errorText(dbErr) }));
      return err(503, CODICE_AMBIENTE_DI_PROVA, MESSAGGIO_AMBIENTE_DI_PROVA, { avrebbe_scritto: edit });
    }
    return ok({
      message: 'Modifica di PROVA registrata.',
      prova: true,
      nota: MESSAGGIO_PROVA_REGISTRATA,
      edit,
      worker: workerResult,
    });
  }

  // ── Modalità asincrona (opzionale): rispondi subito, modifica in sottofondo ──
  // Solo per le MODIFICHE: la lettura (`read`) risponde in pochi secondi e un numero non le
  // serve. ⚖️ Su TEST non si arriva qui (il recinto registra e risponde prima): inerte apposta.
  if (body.async === true && !readOnly) {
    const jobId = crypto.randomUUID();
    const clientJob = createClient(supabaseUrl, supabaseKey);
    const jobScritto = await writeEditJob(clientJob, jobId, 'pending', { edit, created_by_email: actor.email, created_at: new Date().toISOString() });
    if (!jobScritto) {
      return err(503, 'JOB_NON_AVVIATO', 'Non sono riuscito ad aprire il lavoro: la modifica NON è partita, rifalla.', { edit });
    }
    EdgeRuntime.waitUntil(runEditJobInBackground({ jobId, supabaseUrl, supabaseKey, actor, edit, workerUrl, workerApiKey }));
    return ok({ jobId, status: 'pending', message: 'Modifica avviata, in corso…' });
  }

  // 🆕 VOCE 76 — chi c'è in campo, letto PRIMA del gesto (vedi il commento sopra la funzione).
  // ⚠️ In lettura sola non si legge niente: là non sta succedendo nulla da raccontare.
  const primaDelGesto = readOnly
    ? null
    : await rosterPrimaDelloSpostamento({ supabaseUrl, supabaseKey, edit }).catch(() => null);

  // Call browser worker
  let workerResult: JsonMap;
  try {
    workerResult = await callWorkerEditBooking({ workerUrl, workerApiKey, edit, operatore: actor.email, chiestoDa: chiCiHaChiesto(actor) });
  } catch (workerErr) {
    // ⭐ Il terzo esito anche sulla strada SINCRONA: 502 col CODICE giusto e il marchio, che il
    // ponte dei soci legge già (consumer-booking-write).
    const ignoto = !!(workerErr && typeof workerErr === 'object' && (workerErr as { esitoIgnoto?: boolean }).esitoIgnoto === true);
    // 🆕 23/08 (voce 66) — la traccia si deposita nel gestionale anche sulla strada sincrona,
    // che è quella del bot. ⭐ E qui pesa il doppio: i due fallimenti che hanno aperto la voce 66
    // (20/08, Fabiola e Lidia) erano proprio su `/edit-booking`, e del loro `steps=[…]` nel
    // database non è rimasto niente.
    await annotaFallimentoAlCircolo({
      azione: 'edit',
      status: ignoto ? 'unknown' : 'error',
      errore: errorText(workerErr),
      richiesta: edit,
      attore: actor.email,
    });
    return err(502, ignoto ? 'WORKER_ESITO_IGNOTO' : 'WORKER_ERROR', errorText(workerErr), {
      edit,
      ...(ignoto ? { esitoIgnoto: true } : {}),
    });
  }

  // Save record to DB (best-effort). In lettura sola non si registra nessuna "modifica".
  if (!readOnly) {
    try {
      await saveStaffEditRecord({ supabaseUrl, supabaseKey, actor, edit, workerResult });
    } catch (dbErr) {
      console.error(JSON.stringify({ event: 'db_save_failed', error: errorText(dbErr) }));
    }
    // 🆕 VOCE 76 — anche qui, sulla strada sincrona: la conferma è in mano, e da questo punto
    // a parlare col socio è il gestionale. ⚠️ Mai in `readOnly`: là non è successo niente.
    await dichiaraSpostamentoAlSocio({ supabaseUrl, supabaseKey, edit, prima: primaDelGesto });
    await dichiaraCambioRosterAlSocio({ supabaseUrl, supabaseKey, edit, prima: primaDelGesto, workerResult });
  }

  if (readOnly) {
    return ok({
      message: 'Lettura partecipanti completata.',
      edit,
      worker: workerResult,
    });
  }

  const parts: string[] = [`idReserva ${edit.idReserva}`];
  if (hasMove) parts.push(`sposta → Campo ${move?.campo ?? '?'} · ${move?.data ?? '?'} · ${move?.oraInizio ?? '?'}–${move?.oraFine ?? '?'}`);
  if (hasPlayers) parts.push('giocatori aggiornati');
  if (noteProvided) parts.push('nota aggiornata');
  if (descrizioneProvided) parts.push('descrizione aggiornata');
  if (istruttoreProvided) parts.push(`maestro → ${istruttore}`);

  return ok({
    message: `Modifica richiesta: ${parts.join(' · ')}`,
    edit,
    worker: workerResult,
  });
});
