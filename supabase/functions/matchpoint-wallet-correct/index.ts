import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  CODICE_AMBIENTE_DI_PROVA,
  MESSAGGIO_AMBIENTE_DI_PROVA,
  scritturaAlCircoloConsentita,
} from './scrittura-al-circolo.ts';
import { decidiFotografiaSaldo } from '../_shared/fotografia-saldo.ts';

// matchpoint-wallet-correct — Fase 2b: corregge il saldo del BORSELLINO (Portafoglio/Monedero)
// di un cliente su Matchpoint, via worker /correct-wallet ("Correzione del saldo"), in ENTRAMBE
// le direzioni:
//   • STORNO   → subtractCents>0 (sottrae credito, importo negativo). Validato dal vivo.
//   • RICARICA → addCents>0      (aggiunge credito, importo positivo). Validato dal vivo 30/06.
// ⚠️ DENARO REALE. NON-IDEMPOTENTE → nessun retry. Backstop server-side = kill-switch del worker
// (env MATCHPOINT_PAYMENT_WRITE_ENABLED). Gemello di matchpoint-payment-void.

type JsonMap = Record<string, unknown>;

type StaffActor = {
  userId: string;
  email: string;
  role: string;
  permissions: JsonMap;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_BASE_URL = 'https://app-padelvillage-it.matchpoint.com.es';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
function ok(body: JsonMap) { return json({ ok: true, ...body }); }
function err(status: number, code: string, message: string, extra: JsonMap = {}) {
  return json({ ok: false, error: code, message, ...extra }, status);
}
function clean(value: unknown) { return String(value ?? '').trim(); }
function errorText(value: unknown) {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message || String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

function hasPermission(actor: StaffActor, perm: string) {
  if (['owner', 'admin'].includes(actor.role)) return true;
  return actor.permissions?.[perm] === true;
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

async function callWorkerCorrect(opts: {
  workerUrl: string; workerApiKey: string; username: string; password: string; baseUrl: string;
  payload: JsonMap;
}): Promise<JsonMap> {
  const { workerUrl, workerApiKey, username, password, baseUrl, payload } = opts;
  let res: Response;
  try {
    res = await fetch(`${workerUrl}/correct-wallet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${workerApiKey}` },
      body: JSON.stringify({ username, password, baseUrl, ...payload }),
    });
  } catch (netErr) {
    const e = new Error(`Worker network error: ${errorText(netErr)}`) as Error & { code: string };
    e.code = 'WORKER_NETWORK_ERROR';
    throw e;
  }
  const body = await res.json().catch(() => ({}));
  if (res.ok) return body as JsonMap;
  const code = clean((body as JsonMap).error) || 'WORKER_ERROR';
  const e = new Error(errorText((body as JsonMap).message || code)) as Error & { code: string; diagnostic?: unknown };
  e.code = code;
  e.diagnostic = (body as JsonMap).diagnostic;
  throw e;
}

/* 🆕 02/09/2026 — LA RICARICA LASCIA TRACCIA NEL GESTIONALE.
   🗣️ Sua richiesta: *«devi crearmi la sezione pagamenti, dove uno vede tutti i pagamenti che ha
   fatto: sia le ricariche che i pagamenti delle partite e i rimborsi, tutto quanto»*.
   📏 **Misurato prima di scrivere una riga: le ricariche NON ESISTEVANO.** Non «non si trovavano»:
   questa edge chiamava il worker e non scriveva niente da nessuna parte, e `wallet_balance` (40
   righe per 40 soci) è una **fotografia del saldo**, uno per socio — non lo storico dei movimenti.
   ⇒ Il gestionale sapeva **quanto ha** un socio nel borsellino, **non come ci è arrivato**.
   ⚖️ Era la regola di casa non applicata: *«ogni gesto va registrato dal gestionale nello STESSO
   ISTANTE in cui è confermato»*. 🚨 Le ricariche già fatte **non si recuperano**; da qui in avanti sì.

   🚨⭐⭐ **E NON È UN RECORD `payment`, di proposito.** Sarebbe stata la scelta ovvia — è un
   movimento di denaro — ed è **sbagliata**: la sezione Incassi somma TUTTI i `payment`, e una
   ricarica non è un incasso. Il circolo incassa quando il credito viene **speso** su una partita,
   e quella riga esiste già (`method: 'wallet'`, 79 righe) ⇒ contarla due volte avrebbe gonfiato
   i totali del circolo di ogni euro ricaricato.
   ⇒ Va in `wallet_txn`, che **era già fra i tipi ammessi** dal CHECK della tabella e aveva **zero
   righe**: dichiarato e mai usato. Nessuna migrazione.
   📌 *Il tipo giusto per un dato non è quello che gli somiglia: è quello che non rompe i conti di
   chi legge gli altri.*

   ⛔ La traccia NON può far fallire la ricarica: a quel punto il denaro su Matchpoint si è già
   mosso, e rispondere «non riuscita» sarebbe una bugia che fa ripetere il gesto. ⇒ Se la scrittura
   fallisce la risposta resta `ok` e lo DICE (`traccia: 'non_scritta'` col motivo), invece di tacere.
   📌 *Un fallimento che non si può propagare va dichiarato, non ingoiato.* */
async function scriviTraccia(opts: {
  op: 'recharge' | 'storno';
  idInterno: string; codice: string; memberLocalId: string; playerName: string;
  amountCents: number; balancePre: number | null; balancePost: number | null;
  attore: StaffActor;
}): Promise<{ stato: 'scritta' | 'non_scritta'; motivo?: string }> {
  const sUrl = clean(Deno.env.get('SUPABASE_URL'));
  const sKey = clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  if (!sUrl || !sKey) return { stato: 'non_scritta', motivo: 'SERVICE_ROLE_MANCANTE' };
  const adesso = new Date();
  // Il GIORNO è quello di Roma, non UTC: una ricarica delle 00:30 non è del giorno prima.
  const giorno = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(adesso);
  // 🔑 Una chiave per EVENTO, non per socio: due ricariche allo stesso socio sono due movimenti,
  // e una chiave deterministica sul socio le farebbe sovrascrivere l'una con l'altra.
  const localKey = `wtx|${opts.idInterno || opts.codice}|${adesso.toISOString()}|${crypto.randomUUID().slice(0, 8)}`;
  try {
    const client = createClient(sUrl, sKey, { auth: { persistSession: false } });
    const { error } = await client.from('pmo_cloud_records').upsert({
      record_type: 'wallet_txn',
      local_key: localKey,
      payload: {
        op: opts.op,
        // ⚖️ Il SEGNO è la direzione: + ricarica, − storno. Così l'elenco si somma senza
        // che chi legge debba conoscere il significato di `op`.
        amount_cents: opts.op === 'recharge' ? Math.abs(opts.amountCents) : -Math.abs(opts.amountCents),
        member_local_id: opts.memberLocalId || null,
        id_cliente: opts.idInterno || null,
        codice: opts.codice || null,
        player_name: opts.playerName || '',
        balance_cents_pre: opts.balancePre,
        balance_cents_post: opts.balancePost,
        data: giorno,
        recorded_at: adesso.toISOString(),
        source: 'pmo_wallet',
        status: 'done',
        staff_email: opts.attore.email || '',
      },
      deleted: false,
      updated_at: adesso.toISOString(),
      synced_at: adesso.toISOString(),
    }, { onConflict: 'record_type,local_key' });
    // 🚨 supabase-js RESTITUISCE l'errore invece di lanciarlo: senza questo controllo la traccia
    // mancherebbe in silenzio, ed è esattamente il difetto che questa funzione esiste per curare.
    if (error) return { stato: 'non_scritta', motivo: error.message };
    return { stato: 'scritta' };
  } catch (e) {
    return { stato: 'non_scritta', motivo: errorText(e) };
  }
}

/* 👛⭐⭐ VOCE 143 — LA FOTOGRAFIA DEL SALDO SI AGGIORNA NELLO STESSO ISTANTE DEL MOVIMENTO.
 *
 * 🗣️ Sua, dal 04/09: *«quando facciamo le operazioni di cassa che c'è tanta gente, se non si
 *    aggiorna velocemente poi qualcuno della segreteria può protestare»*.
 *
 * 📏 IL DIFETTO, misurato il 06/09 e più preciso di come la scheda lo raccontava: ci sono DUE
 *    record diversi, e questa edge ne aggiornava solo uno.
 *    · `wallet_txn` — il MOVIMENTO (chi, quanto, pre, post). Scritto dal 02/09. ✅
 *    · `wallet_balance` — la FOTOGRAFIA del saldo, **quella che l'app legge per mostrare il
 *      numero**. NON aggiornata ⇒ dopo una ricarica il saldo mostrato restava vecchio fino al
 *      giro dei 10 minuti. ❌
 *    ⇒ Il gestionale sapeva *«è stata fatta una ricarica di 1 €»* e insieme *«il saldo è quello
 *      di dieci minuti fa»*. Due verità sullo stesso socio, nello stesso archivio.
 *
 * ⭐ E LA CURA NON COSTA NIENTE, che è la parte che cambia il disegno della scheda: il saldo DOPO
 *    ce l'abbiamo GIÀ in mano — `workerResult.balanceCentsPost`, letto da Matchpoint nello stesso
 *    giro che ha mosso il denaro. La scheda della 143 prevedeva *«si rinfresca quello, sul colpo»*,
 *    cioè una lettura in più al worker. ⛔ Non serve: sarebbe andare a richiedere un dato che è
 *    già arrivato. Il worker — un browser solo condiviso col sync — non viene toccato.
 *    📌 *Prima di aggiungere una lettura, guardare se la risposta è già nella mano che si ha.*
 *
 * ⛔ BEST-EFFORT, e per la stessa ragione di `scriviTraccia`: a questo punto il denaro su
 *    Matchpoint **si è già mosso**. Se questa scrittura fallisce la risposta resta `ok` e lo
 *    DICE (`fotografia: 'non_scritta'`), invece di far ripetere alla segreteria un gesto riuscito.
 *
 * 🔑 LA FORMA È QUELLA DEL SYNC, non una nuova: stessa `local_key` (`wbal|<memberLocalId>`) e
 *    stessi campi di `matchpoint-wallet-sync`, o al giro delle 10 nascerebbe un secondo record
 *    per lo stesso socio e l'app ne mostrerebbe uno a caso.
 *    ⚖️ `source` dice **da dove viene questo valore** (`pmo_wallet_correct` invece di `matchpoint`):
 *    non è un capriccio, è ciò che permette di distinguere una fotografia scritta da un gesto da
 *    una scattata dal report. Il sync la riallineerà al giro dopo con lo stesso numero.
 *
 * ⚠️ SENZA `memberLocalId` NON SI SCRIVE: la chiave del record è quella, e inventarla dal codice
 *    Matchpoint creerebbe una riga che il sync non ritroverebbe mai — un saldo fantasma che non si
 *    aggiorna più. Meglio nessuna fotografia che una che nessuno può correggere. */
async function aggiornaFotografiaSaldo(opts: {
  memberLocalId: string; codice: string; playerName: string; balancePost: number | null;
}): Promise<{ stato: 'scritta' | 'non_scritta'; motivo?: string }> {
  const adesso = new Date().toISOString();
  // 🔑 La REGOLA sta nel modulo puro accanto, non qui: così il banco la esegue davvero invece di
  //    rileggerla, e questa funzione resta solo il braccio che scrive.
  const scelta = decidiFotografiaSaldo({
    memberLocalId: opts.memberLocalId,
    codice: opts.codice,
    playerName: opts.playerName,
    balancePost: opts.balancePost,
    adessoIso: adesso,
  });
  if (!scelta.scrivi) return { stato: 'non_scritta', motivo: scelta.motivo };
  const sUrl = clean(Deno.env.get('SUPABASE_URL'));
  const sKey = clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  if (!sUrl || !sKey) return { stato: 'non_scritta', motivo: 'SERVICE_ROLE_MANCANTE' };
  try {
    const client = createClient(sUrl, sKey, { auth: { persistSession: false } });
    const { error } = await client.from('pmo_cloud_records').upsert({
      record_type: 'wallet_balance',
      local_key: scelta.localKey,
      payload: scelta.payload,
      deleted: false,
      updated_at: adesso,
      synced_at: adesso,
    }, { onConflict: 'record_type,local_key' });
    // 🚨 supabase-js RESTITUISCE l'errore invece di lanciarlo: senza questo controllo la
    //    fotografia mancherebbe in silenzio — lo stesso difetto che questa funzione cura.
    if (error) return { stato: 'non_scritta', motivo: error.message };
    return { stato: 'scritta' };
  } catch (e) {
    return { stato: 'non_scritta', motivo: errorText(e) };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'Only POST supported');

  const actor = await getActor(req).catch(() => null);
  if (!actor) return err(401, 'UNAUTHORIZED', 'Autenticazione richiesta.');
  if (!hasPermission(actor, 'cloud_sync')) {
    return err(403, 'FORBIDDEN', 'Permesso cloud_sync richiesto per correggere il borsellino.');
  }

  let body: JsonMap;
  try { body = await req.json(); } catch { return err(400, 'INVALID_JSON', 'Request body must be valid JSON.'); }

  const idInterno = clean((body as JsonMap).idInterno || (body as JsonMap).idCliente);
  const codice = clean((body as JsonMap).codice || (body as JsonMap).memberId);
  const nome = clean((body as JsonMap).nome);
  const cognome = clean((body as JsonMap).cognome);
  const email = clean((body as JsonMap).email);
  const telefono = clean((body as JsonMap).telefono);
  // Servono SOLO alla traccia: identificano il movimento nella scheda del socio. Se l'app non li
  // manda la ricarica funziona lo stesso — la riga nasce col solo id Matchpoint.
  const memberLocalId = clean((body as JsonMap).memberLocalId || (body as JsonMap).member_local_id);
  const playerName = clean((body as JsonMap).playerName || (body as JsonMap).player_name);
  const subtractCentsRaw = (body as JsonMap).subtractCents;
  const subtractCents = Number.isFinite(Number(subtractCentsRaw)) ? Math.round(Number(subtractCentsRaw)) : NaN;
  const addCentsRaw = (body as JsonMap).addCents;
  const addCents = Number.isFinite(Number(addCentsRaw)) ? Math.round(Number(addCentsRaw)) : NaN;

  const wantsStorno = Number.isFinite(subtractCents) && subtractCents > 0;
  const wantsRecharge = Number.isFinite(addCents) && addCents > 0;

  // Accetta id interno diretto OPPURE il codice (l'app lo ha per ogni socio): il worker
  // risolve l'id dal codice (ricerca lista clienti, match esatto sul codice).
  if (!/^\d{1,8}$/.test(idInterno) && !codice) return err(400, 'MISSING_CLIENT_ID', 'idInterno o codice cliente richiesto.');
  // Esattamente UNA direzione.
  if (wantsStorno && wantsRecharge) return err(400, 'INVALID_AMOUNT', 'Specificare solo subtractCents (storno) OPPURE addCents (ricarica), non entrambi.');
  if (!wantsStorno && !wantsRecharge) return err(400, 'INVALID_AMOUNT', 'subtractCents (storno) o addCents (ricarica) deve essere un intero > 0.');

  const workerUrl = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_URL'));
  const workerApiKey = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_API_KEY'));
  const username = clean(Deno.env.get('MATCHPOINT_USERNAME'));
  const password = clean(Deno.env.get('MATCHPOINT_PASSWORD'));
  const baseUrl = clean(Deno.env.get('MATCHPOINT_BASE_URL')) || DEFAULT_BASE_URL;
  if (!workerUrl || !workerApiKey) return err(500, 'WORKER_NOT_CONFIGURED', 'Worker Matchpoint non configurato.');
  if (!username || !password) return err(500, 'MATCHPOINT_CREDENTIALS_MISSING', 'Credenziali Matchpoint non configurate.');

  // Inoltra solo l'importo della direzione richiesta (il worker rifiuta se ne arrivano due).
  const amountPayload: JsonMap = wantsRecharge ? { addCents } : { subtractCents };

  // 🔒💰 IL RECINTO — da fuori dalla produzione il borsellino del circolo NON si tocca.
  // ⚖️ Qui si RIFIUTA e basta, non si registra una prova come fanno le prenotazioni: il
  // borsellino è denaro, e Matchpoint è il libro mastro **unico** di questo progetto. Registrare
  // altrove una correzione di prova vorrebbe dire aprire il secondo libro che la regola vieta.
  // 🚨 Sta QUI, l'ultimo gradino prima di `callWorkerCorrect`: il worker è **uno solo e condiviso**
  // fra TEST e PROD, quindi «lo provo da test» non è mai stata una prova — è denaro vero.
  if (!scritturaAlCircoloConsentita(Deno.env.get('SUPABASE_URL'))) {
    const avrebbe_scritto = {
      op: wantsRecharge ? 'recharge' : 'storno',
      idInterno, codice, ...amountPayload,
    };
    console.warn(JSON.stringify({ event: 'ambiente_di_prova', azione: 'correct-wallet', avrebbe_scritto }));
    return err(503, CODICE_AMBIENTE_DI_PROVA, MESSAGGIO_AMBIENTE_DI_PROVA, { avrebbe_scritto, retryable: false });
  }

  let workerResult: JsonMap;
  try {
    workerResult = await callWorkerCorrect({
      workerUrl, workerApiKey, username, password, baseUrl,
      payload: { idInterno, codice, nome, cognome, email, telefono, ...amountPayload },
    });
  } catch (workerErr) {
    const code = clean((workerErr as { code?: string })?.code) || 'WORKER_ERROR';
    const diagnostic = (workerErr as { diagnostic?: unknown })?.diagnostic;
    const status = code === 'WORKER_NETWORK_ERROR' ? 502 : 422;
    return err(status, code, errorText(workerErr), { idInterno, codice, ...(diagnostic ? { diagnostic } : {}) });
  }

  // Il worker può tornare ok:false (NOTHING_TO_VOID / IMPORTO_ECCEDE_SALDO / RESULT_MISMATCH) → propaga 409.
  if ((workerResult as JsonMap).ok === false) {
    const code = clean((workerResult as JsonMap).code) || 'CORRECTION_NOT_DONE';
    return err(409, code, errorText((workerResult as JsonMap).message || code), {
      idInterno: clean(workerResult.idCliente) || idInterno, codice,
      currentCents: typeof workerResult.currentCents === 'number' ? workerResult.currentCents : null,
    });
  }

  /* 🚨⭐ QUI, e non nell'app: è l'ordine della voce 75 — *registrare e rispondere partono
     INSIEME dalla conferma del circolo*. Scrivendola nell'app basterebbe una scheda chiusa un
     secondo dopo per perdere il movimento, che è esattamente come la 75 si era rotta: la ②
     (rispondere) partita senza la ①  (registrare). */
  const traccia = await scriviTraccia({
    op: wantsRecharge ? 'recharge' : 'storno',
    idInterno: clean(workerResult.idCliente) || idInterno,
    codice, memberLocalId, playerName,
    amountCents: wantsRecharge ? addCents : subtractCents,
    balancePre: typeof workerResult.currentCents === 'number' ? workerResult.currentCents : null,
    balancePost: typeof workerResult.balanceCentsPost === 'number' ? workerResult.balanceCentsPost : null,
    attore: actor,
  });
  if (traccia.stato === 'non_scritta') {
    console.error(JSON.stringify({ event: 'wallet_txn_non_scritta', op: wantsRecharge ? 'recharge' : 'storno', idInterno, codice, motivo: traccia.motivo }));
  }

  /* 👛 VOCE 143 — e NELLO STESSO ISTANTE si aggiorna la FOTOGRAFIA del saldo, non solo il
     movimento. Sta qui e non altrove perché è il punto in cui il circolo ha confermato: è la
     regola dei tre passi applicata al saldo invece che alla partita — *ogni gesto va registrato
     dal gestionale nello STESSO ISTANTE in cui è confermato*.
     🚨 Prima di questa riga il gestionale sapeva «c'è stata una ricarica» e insieme «il saldo è
     quello di dieci minuti fa»: due verità sullo stesso socio. */
  const fotografia = await aggiornaFotografiaSaldo({
    memberLocalId,
    codice,
    playerName,
    balancePost: typeof workerResult.balanceCentsPost === 'number' ? workerResult.balanceCentsPost : null,
  });
  if (fotografia.stato === 'non_scritta') {
    console.error(JSON.stringify({ event: 'wallet_balance_non_aggiornato', op: wantsRecharge ? 'recharge' : 'storno', idInterno, codice, motivo: fotografia.motivo }));
  }

  return ok({
    op: wantsRecharge ? 'recharge' : 'storno',
    idInterno: clean(workerResult.idCliente) || idInterno,
    codice,
    subtractCents: wantsStorno ? subtractCents : null,
    addCents: wantsRecharge ? addCents : null,
    currentCents: typeof workerResult.currentCents === 'number' ? workerResult.currentCents : null,
    targetCents: typeof workerResult.targetCents === 'number' ? workerResult.targetCents : null,
    balanceCentsPost: typeof workerResult.balanceCentsPost === 'number' ? workerResult.balanceCentsPost : null,
    // ⛔ Il denaro si è mosso: la risposta resta `ok`. Ma se la traccia non c'è lo si DICE, o la
    // sezione Pagamenti mostrerebbe un buco che nessuno sa spiegare.
    traccia: traccia.stato,
    ...(traccia.motivo ? { tracciaMotivo: traccia.motivo } : {}),
    // 👛 VOCE 143 — e si dice anche se la FOTOGRAFIA del saldo è stata aggiornata: senza questo,
    // «il numero non si è mosso» resterebbe indistinguibile fra «non l'ho scritto» e «l'ho scritto
    // e l'app non l'ha riletto». Sono due guasti diversi e si curano in due posti diversi.
    fotografia: fotografia.stato,
    ...(fotografia.motivo ? { fotografiaMotivo: fotografia.motivo } : {}),
  });
});
