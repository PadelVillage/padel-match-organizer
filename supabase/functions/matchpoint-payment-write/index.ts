import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  CODICE_AMBIENTE_DI_PROVA,
  MESSAGGIO_AMBIENTE_DI_PROVA,
  scritturaAlCircoloConsentita,
} from './scrittura-al-circolo.ts';

// matchpoint-payment-write — INCASSA un giocatore di una partita/lezione su Matchpoint, via
// worker `/collect-payment`. ⚠️ DENARO REALE: crea un cobro vero su MP. NON-IDEMPOTENTE →
// nessun retry.
//
// 🗓️ 02/09/2026 — FUORI DALL'ARCHIVIO, per sua richiesta: *«puoi procedere con l'accensione
// dei soldi nella scheda partita»*, e messo davanti alle tre strade ha scelto **solo l'incasso**
// (lo storno resta dov'è, nella scheda socio → tab Pagamenti).
//
// 🚨⭐⭐ PERCHÉ STAVA IN `_archive/`, e perché la cosa conta ancora oggi: il 9/08/2026 lui stesso
// decise di **cancellarla dal runtime** di TEST insieme a `matchpoint-payment-void` — vivevano solo
// lì, fuori dal recinto, e chiunque avesse un accesso staff di TEST poteva incassare denaro **vero**
// sul Matchpoint del circolo. Su PROD non è mai esistita. ⇒ L'app la chiamava da mesi in un `fetch`
// che sarebbe finito in **404**, e a nasconderlo era `PMO_PAYMENTS_WRITE_ENABLED = false`, che
// impediva ai bottoni di comparire.
// 📌 *Codice che chiama una porta che non c'è non dà errore finché nessuno ci passa: il flag che lo
// nasconde è anche ciò che impedisce di accorgersene.* È lo stesso difetto della `payment-void` di
// ieri, trovato stavolta **prima** di accendere l'interruttore invece che dopo.
//
// ⚖️ ⇒ Rispetto alla versione archiviata cambia UNA cosa, ed è la ragione per cui può tornare viva:
// il **recinto** `scrittura-al-circolo.ts` (decima copia). La decisione del 9/08 non era «l'incasso
// non serve», era «non si tiene viva una scrittura di denaro fuori dal recinto» — e adesso dentro
// il recinto c'è.
//
// 🔒 Tre difese, non una: ① il recinto (fuori dalla produzione al worker non ci si parla),
// ② il kill-switch del worker (env `MATCHPOINT_PAYMENT_WRITE_ENABLED`, default OFF: con OFF il
// worker rifiuta e qui torna `PAYMENT_WRITE_DISABLED` senza alcun addebito), ③ il permesso
// `cloud_sync` sull'attore.
//
// 🧾 E NON scrive un record `payment` ottimistico nel cloud, di proposito: il record autorevole
// arriva dal report (`matchpoint-payments-sync`) entro pochi minuti, e la sezione Incassi somma
// **tutti** i `payment` ⇒ scriverne uno qui gonferebbe i totali del circolo di ogni euro incassato,
// due volte. ⚖️ È la stessa scelta fatta ieri per le ricariche (che infatti sono `wallet_txn` e non
// `payment`), e il verso opposto a quello dello storno: lì si marca subito la riga perché si scrive
// **esattamente ciò che il sync scriverebbe** (`voided_at`), qui la riga nuova avrebbe una
// `local_key` con un `seq` che non possiamo conoscere ⇒ il sync ne creerebbe una **seconda**.
// 📌 *Anticipare il sync è lecito solo quando si sa scrivere la sua stessa riga: altrimenti non si
// anticipa, si duplica.*
// ⇒ Nell'attesa l'app aggiorna il chip «pagato» in locale, che è una schermata, non un libro mastro.

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
const METHODS = new Set(['cash', 'card', 'wallet']);

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

async function callWorkerCollect(opts: {
  workerUrl: string; workerApiKey: string; username: string; password: string; baseUrl: string;
  payload: JsonMap;
}): Promise<JsonMap> {
  const { workerUrl, workerApiKey, username, password, baseUrl, payload } = opts;
  let res: Response;
  try {
    res = await fetch(`${workerUrl}/collect-payment`, {
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'Only POST supported');

  const actor = await getActor(req).catch(() => null);
  if (!actor) return err(401, 'UNAUTHORIZED', 'Autenticazione richiesta.');
  if (!hasPermission(actor, 'cloud_sync')) {
    return err(403, 'FORBIDDEN', 'Permesso cloud_sync richiesto per incassare un pagamento.');
  }

  let body: JsonMap;
  try { body = await req.json(); } catch { return err(400, 'INVALID_JSON', 'Request body must be valid JSON.'); }

  const idReserva = clean((body as JsonMap).idReserva);
  const idCliente = clean((body as JsonMap).idCliente);
  const playerName = clean((body as JsonMap).playerName);
  const idx = clean((body as JsonMap).idx);
  const method = clean((body as JsonMap).method).toLowerCase();
  const amountRaw = (body as JsonMap).amountCents;
  const amountCents = (typeof amountRaw === 'number' && Number.isFinite(amountRaw)) ? Math.round(amountRaw) : NaN;

  // Validazioni DURE prima di chiamare il worker (mai un cobro a vuoto).
  if (!idReserva) return err(400, 'MISSING_IDRESERVA', 'idReserva richiesto.');
  if (!idCliente && !playerName) return err(400, 'MISSING_PLAYER', 'idCliente o playerName richiesto.');
  if (!METHODS.has(method)) return err(400, 'INVALID_METHOD', 'method deve essere cash | card | wallet.');
  if (!Number.isFinite(amountCents) || amountCents <= 0) return err(400, 'INVALID_AMOUNT', 'amountCents deve essere un intero > 0.');

  const workerUrl = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_URL'));
  const workerApiKey = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_API_KEY'));
  const username = clean(Deno.env.get('MATCHPOINT_USERNAME'));
  const password = clean(Deno.env.get('MATCHPOINT_PASSWORD'));
  const baseUrl = clean(Deno.env.get('MATCHPOINT_BASE_URL')) || DEFAULT_BASE_URL;
  if (!workerUrl || !workerApiKey) return err(500, 'WORKER_NOT_CONFIGURED', 'Worker Matchpoint non configurato.');
  if (!username || !password) return err(500, 'MATCHPOINT_CREDENTIALS_MISSING', 'Credenziali Matchpoint non configurate.');

  // 🔒💰 IL RECINTO — da fuori dalla produzione il registro cassa del circolo NON si tocca.
  // 🚨 Sta QUI, l'ultimo gradino prima del worker: il worker è **uno solo e condiviso** fra TEST e
  // PROD, quindi «lo provo da test» non è mai stata una prova — sarebbe un cobro vero, su una
  // partita vera, addebitato a una persona vera.
  if (!scritturaAlCircoloConsentita(Deno.env.get('SUPABASE_URL'))) {
    const avrebbe_scritto = { op: 'collect_payment', idReserva, idCliente, playerName, method, amountCents };
    console.warn(JSON.stringify({ event: 'ambiente_di_prova', azione: 'collect-payment', avrebbe_scritto }));
    return err(503, CODICE_AMBIENTE_DI_PROVA, MESSAGGIO_AMBIENTE_DI_PROVA, { avrebbe_scritto, retryable: false });
  }

  let workerResult: JsonMap;
  try {
    workerResult = await callWorkerCollect({
      workerUrl, workerApiKey, username, password, baseUrl,
      payload: { idReserva, idCliente, playerName, idx, method, amountCents },
    });
  } catch (workerErr) {
    const code = clean((workerErr as { code?: string })?.code) || 'WORKER_ERROR';
    const diagnostic = (workerErr as { diagnostic?: unknown })?.diagnostic;
    const status = code === 'WORKER_NETWORK_ERROR' ? 502 : 422;
    // 🔎 VOCE 171 — LA DIAGNOSI SI REGISTRA, non solo si restituisce. Il worker ora allega
    // `cobroCandidates` (cosa VEDEVA nel dialog, iframe compresi), ma quella lista arrivava
    // solo nel browser di chi ha premuto: l'app mostra `message` e butta il resto.
    // ⇒ Chi deve diagnosticare non ha modo di leggerla, e l'unico modo di procurarsela sarebbe
    //    un altro incasso vero su una cassa vera. Qui finisce nel registro della piattaforma.
    // 📌 Una sonda la cui risposta non raggiunge chi diagnostica non è una sonda.
    // ⚖️ Nel REGISTRO, non nel messaggio: al cassiere serve una frase, non un dump — e questa
    //    edge parla al gestionale, non al bot (la regola sui nomi interni riguarda quel verso).
    try {
      console.error(JSON.stringify({
        event: 'collect_payment_fallito', code, idReserva, idCliente, playerName, method, amountCents,
        message: errorText(workerErr), diagnostic,
      }));
    } catch (_logErr) { /* un registro che esplode non deve far cadere la risposta */ }
    return err(status, code, errorText(workerErr), { idReserva, idCliente, ...(diagnostic ? { diagnostic } : {}) });
  }

  // Il worker può tornare ok:false con code ALREADY_PAID (guardia anti-doppio) → propaga.
  if ((workerResult as JsonMap).ok === false) {
    const code = clean((workerResult as JsonMap).code) || 'COLLECT_NOT_DONE';
    return err(409, code, errorText((workerResult as JsonMap).message || code), {
      idReserva, idCliente: clean((workerResult as JsonMap).idCliente) || idCliente,
    });
  }

  return ok({
    idReserva,
    idCliente: clean(workerResult.idCliente) || idCliente,
    method,
    amountCents,
    statoPost: clean(workerResult.statoPost) || null,
    pendentePostCents: typeof workerResult.pendentePostCents === 'number' ? workerResult.pendentePostCents : null,
  });
});
