import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// matchpoint-wallet-read — legge il saldo BORSELLINO/Portafoglio di un socio da
// Matchpoint (via worker /read-wallet). SOLA LETTURA: nessuna scrittura su MP,
// nessun denaro mosso. Mirror del pattern di matchpoint-clients-update.

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

  return ok({
    idCliente: clean(workerResult.idCliente) || idInterno,
    balanceCents: typeof workerResult.balanceCents === 'number' ? workerResult.balanceCents : null,
    balanceText: clean(workerResult.balanceText),
  });
});
