import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decidiFotografiaSaldo } from '../_shared/fotografia-saldo.ts';

// matchpoint-wallet-read — legge il saldo BORSELLINO/Portafoglio di un socio da
// Matchpoint (via worker /read-wallet). SOLA LETTURA VERSO MATCHPOINT: nessuna scrittura su MP,
// nessun denaro mosso. Mirror del pattern di matchpoint-clients-update.
//
/* 👛⭐⭐ VOCE 143, SECONDA METÀ (06/09/2026) — E DA OGGI QUELLO CHE LEGGE LO SCRIVE.
 *
 * 🗣️ Sua, dal 04/09: *«quando facciamo le operazioni di cassa che c'è tanta gente, se non si
 *    aggiorna velocemente poi qualcuno della segreteria può protestare»*.
 *
 * 📏 IL BUCO CHE RESTAVA, misurato il 06/09 e non dedotto: la prima metà della voce cura la
 *    RICARICA, dove il saldo dopo è già in mano (`balanceCentsPost`). Ma il PAGAMENTO COL
 *    BORSELLINO passa da `/collect-payment`, e da lì il worker torna `statoPost` e
 *    `pendentePostCents` — **il saldo del borsellino no**, perché il cobro si fa nella schermata
 *    della prenotazione, non in quella del borsellino. ⇒ Là il numero restava vecchio fino al
 *    giro dei 10 minuti, cioè esattamente il caso che protesta.
 *
 * ⚖️ PERCHÉ LA CURA STA QUI e non in `matchpoint-payment-write`: il saldo dopo bisogna ANDARLO A
 *    LEGGERE, e questa funzione è già quella che lo sa fare. Metterla nel pagamento vorrebbe dire
 *    far aspettare la cassa ~10 secondi (misurato) per un numero che serve DOPO l'incasso, non
 *    per farlo. L'app la chiama in sottofondo: il cassiere non aspetta, il numero si aggiorna.
 *    📌 *Si sposta l'ATTESA, non la FONTE.*
 *
 * 🚨 E QUELLO CHE CAMBIA DAVVERO: il risultato non finisce più solo in una Map in memoria del
 *    browser che ha premuto (`window.__pmoWalletCache`, persa al reload e invisibile a tutti gli
 *    altri). Diventa una FOTOGRAFIA nel gestionale, che vede tutta la segreteria — da qualunque
 *    postazione, anche domani. È *il gestionale SA* applicato al borsellino. */

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

async function callWorkerReadWallet(opts: {
  workerUrl: string; workerApiKey: string; username: string; password: string; baseUrl: string; idInterno: string;
}): Promise<JsonMap> {
  const { workerUrl, workerApiKey, username, password, baseUrl, idInterno } = opts;
  let res: Response;
  try {
    res = await fetch(`${workerUrl}/read-wallet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${workerApiKey}` },
      body: JSON.stringify({ username, password, baseUrl, idInterno }),
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

/** Scrive la FOTOGRAFIA del saldo (`wallet_balance`) col numero appena letto da Matchpoint.
 *
 * 🔑 LA REGOLA STA NEL MODULO PURO accanto (`_shared/fotografia-saldo.ts`), la stessa che usa la
 *    ricarica: qui c'è solo il braccio che scrive. Due copie della stessa regola divergono il
 *    giorno in cui una sola viene corretta.
 *
 * ⛔ BEST-EFFORT, e non è pigrizia: la LETTURA è riuscita: il numero è vero e va restituito a chi
 *    l'ha chiesto anche se archiviarlo non riesce. Fallire tutto qui vorrebbe dire buttare via un
 *    dato buono. Ma il fallimento si DICE (`fotografia: 'non_scritta'` + motivo), o «il numero non
 *    si è mosso» resterebbe indistinguibile fra «non l'ho scritto» e «l'app non l'ha riletto».
 *
 * ⚠️ SENZA `memberLocalId` NON SI SCRIVE, e il chiamante deve passarlo: la chiave del record è
 *    quella, e ricavarla qui dall'id interno vorrebbe dire indovinare il socio — lo stesso difetto
 *    silenzioso della voce 138, dove il codice cliente di Laura Aprea (000140 → "140") era identico
 *    all'ID INTERNO di Marco Aprea (140). In cassa la sera si aggiornerebbe il borsellino di chi
 *    non c'entra. 📌 *Meglio nessuna fotografia che una sulla persona sbagliata.* */
async function aggiornaFotografiaSaldo(opts: {
  memberLocalId: string; codice: string; playerName: string; balanceCents: number | null;
}): Promise<{ stato: 'scritta' | 'non_scritta'; motivo?: string }> {
  const adesso = new Date().toISOString();
  const scelta = decidiFotografiaSaldo({
    memberLocalId: opts.memberLocalId,
    codice: opts.codice,
    playerName: opts.playerName,
    balancePost: opts.balanceCents,
    adessoIso: adesso,
    // ⚖️ Dichiarata: questo saldo è stato RILETTO dopo un gesto, non visto muoversi. Guardando una
    //    riga in archivio si deve poter dire da quale delle due strade è arrivata.
    source: 'pmo_wallet_read',
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
    //    fotografia mancherebbe in silenzio — lo stesso difetto che questa cura esiste per togliere.
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
    return err(403, 'FORBIDDEN', 'Permesso cloud_sync richiesto per leggere il borsellino.');
  }

  let body: JsonMap;
  try { body = await req.json(); } catch { return err(400, 'INVALID_JSON', 'Request body must be valid JSON.'); }

  const idInterno = clean((body as JsonMap).idInterno ?? (body as JsonMap).idCliente ?? (body as JsonMap).id);
  if (!/^\d{1,8}$/.test(idInterno)) {
    return err(400, 'INVALID_CLIENT_ID', 'idInterno Matchpoint (id_people) richiesto.');
  }
  /* 👛 VOCE 143 — i due campi che servono ad ARCHIVIARE il numero, non a leggerlo. Sono
     FACOLTATIVI di proposito: chi chiama solo per guardare un saldo (il bottone ↻ nella scheda
     socio prima di questa voce) continua a funzionare identico e semplicemente non scrive. */
  const memberLocalId = clean((body as JsonMap).memberLocalId);
  const playerName = clean((body as JsonMap).playerName);
  /* 🚨⭐⭐ IL CODICE CLIENTE, E NON L'ID INTERNO — misurato il 06/09 notte, dopo averlo sbagliato.
     Matchpoint dà a ogni persona DUE numeri in numerazioni diverse, e il campo `id_cliente` della
     fotografia è quello che scrive `matchpoint-wallet-sync`: il CODICE CLIENTE (dalla colonna
     «Cod.» del report), non l'`id_people` del roster.
     📏 La prova che sono davvero due namespace, presa dai dati veri: `id_cliente` **191** in
     archivio è **Luciano Pase** (codice 000191, id interno assente); ma **191** nel roster di una
     prenotazione è l'id interno di **Valeria Moschet** (il cui codice è 000182). Due persone, lo
     stesso numero, due colonne diverse.
     ⇒ Scrivere qui l'id interno metterebbe DUE numerazioni nella stessa colonna, a seconda di chi
     ha scritto la riga: è la voce 138 daccapo — e non si vedrebbe, perché per i soci con id basso
     (Maurizio: id 4, codice 000004) i due numeri COINCIDONO.
     ⛔ E se il chiamante non lo sa, resta `null`: meglio un campo vuoto che il sync riempirà, che
     un numero giusto nella numerazione sbagliata. */
  const codiceCliente = clean((body as JsonMap).codiceCliente);

  const workerUrl = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_URL'));
  const workerApiKey = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_API_KEY'));
  const username = clean(Deno.env.get('MATCHPOINT_USERNAME'));
  const password = clean(Deno.env.get('MATCHPOINT_PASSWORD'));
  const baseUrl = clean(Deno.env.get('MATCHPOINT_BASE_URL')) || DEFAULT_BASE_URL;
  if (!workerUrl || !workerApiKey) return err(500, 'WORKER_NOT_CONFIGURED', 'Worker Matchpoint non configurato.');
  if (!username || !password) return err(500, 'MATCHPOINT_CREDENTIALS_MISSING', 'Credenziali Matchpoint non configurate.');

  let workerResult: JsonMap;
  try {
    workerResult = await callWorkerReadWallet({ workerUrl, workerApiKey, username, password, baseUrl, idInterno });
  } catch (workerErr) {
    const code = clean((workerErr as { code?: string })?.code) || 'WORKER_ERROR';
    const diagnostic = (workerErr as { diagnostic?: unknown })?.diagnostic;
    const status = code === 'WORKER_NETWORK_ERROR' ? 502 : 422;
    return err(status, code, errorText(workerErr), { idInterno, ...(diagnostic ? { diagnostic } : {}) });
  }

  const balanceCents = typeof workerResult.balanceCents === 'number' ? workerResult.balanceCents : null;

  /* 👛⭐ VOCE 143 — e il numero appena letto si ARCHIVIA, invece di restare nella memoria del
     browser che l'ha chiesto. È la regola dei tre passi applicata al saldo: il circolo ha
     confermato (l'abbiamo letto da lì), quindi il gestionale lo REGISTRA e nello stesso istante
     lo dice a chi ha chiesto. */
  const fotografia = await aggiornaFotografiaSaldo({
    memberLocalId,
    // ⚠️ NON `workerResult.idCliente`: quello è l'id interno (id_people), un'altra numerazione.
    codice: codiceCliente,
    playerName,
    balanceCents,
  });
  if (fotografia.stato === 'non_scritta' && memberLocalId) {
    // ⚖️ Si registra SOLO quando il chiamante voleva archiviare: senza `memberLocalId` la
    //    mancata scrittura non è un guasto, è una lettura e basta — e un registro che urla su
    //    ogni caso normale è un registro che si smette di leggere.
    console.error(JSON.stringify({ event: 'wallet_balance_non_aggiornato', da: 'wallet-read', idInterno, memberLocalId, motivo: fotografia.motivo }));
  }

  return ok({
    idCliente: clean(workerResult.idCliente) || idInterno,
    balanceCents,
    balanceText: clean(workerResult.balanceText),
    // 👛 Dice se il numero è stato anche ARCHIVIATO: senza, «il saldo non si è mosso» resterebbe
    // indistinguibile fra «non l'ho scritto» e «l'ho scritto e l'app non l'ha riletto». Due
    // guasti diversi, due posti diversi in cui si curano.
    fotografia: fotografia.stato,
    ...(fotografia.motivo ? { fotografiaMotivo: fotografia.motivo } : {}),
  });
});
