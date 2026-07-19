import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// matchpoint-payment-write — Fase 2b: INCASSA un giocatore di una partita/lezione su
// Matchpoint (via worker /collect-payment). ⚠️ DENARO REALE: crea un cobro vero su MP.
// NON-IDEMPOTENTE → nessun retry. Il backstop server-side è il kill-switch del worker
// (env MATCHPOINT_PAYMENT_WRITE_ENABLED, default OFF): con OFF il worker rifiuta e qui
// torna PAYMENT_WRITE_DISABLED senza alcun addebito. Mirror di matchpoint-wallet-read.
// NB: NON scrive un record `payment` ottimistico nel cloud: il record autorevole arriva
// dal report (matchpoint-payments-sync) entro pochi minuti; l'app aggiorna intanto il
// chip "pagato" in locale. Evita il doppio conteggio negli Incassi.

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
