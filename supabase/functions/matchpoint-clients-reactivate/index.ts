import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

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

const NON_RETRYABLE_CODES = new Set([
  'CLIENT_NOT_FOUND', 'INVALID_CLIENT_CODICE', 'INVALID_CODICE',
  'CLIENT_REACTIVATE_VALIDATION', 'RIATTIVA_BUTTON_NOT_FOUND',
  'MATCHPOINT_WORKER_SECRETS_MISSING', 'MATCHPOINT_CREDENTIALS_MISSING',
  'WORKER_NOT_CONFIGURED', 'WORKER_REACTIVATE_CLIENT_NOT_IMPLEMENTED',
]);

function isRetryableCode(code: string): boolean {
  if (!code) return true;
  return !NON_RETRYABLE_CODES.has(code);
}

type WorkerError = Error & { code: string; retryable: boolean; diagnostic?: unknown };
function workerFail(code: string, message: string, diagnostic?: unknown): WorkerError {
  const e = new Error(message) as WorkerError;
  e.code = code;
  e.retryable = isRetryableCode(code);
  e.diagnostic = diagnostic;
  return e;
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

async function callWorkerReactivateClient(opts: {
  workerUrl: string;
  workerApiKey: string;
  username: string;
  password: string;
  baseUrl: string;
  client: JsonMap;
}): Promise<JsonMap> {
  const { workerUrl, workerApiKey, username, password, baseUrl, client } = opts;
  const endpoint = `${workerUrl}/reactivate-client`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerApiKey}`,
      },
      body: JSON.stringify({ username, password, baseUrl, client }),
    });
  } catch (netErr) {
    throw workerFail('WORKER_NETWORK_ERROR', `Worker network error: ${errorText(netErr)}`);
  }

  const body = await res.json().catch(() => ({}));
  if (res.ok) return body as JsonMap;

  if (res.status === 404 || res.status === 501) {
    throw workerFail('WORKER_REACTIVATE_CLIENT_NOT_IMPLEMENTED', 'Il worker non supporta /reactivate-client. Aggiornare il worker.');
  }

  const code = clean((body as JsonMap).error) || 'WORKER_ERROR';
  const message = errorText((body as JsonMap).message || (body as JsonMap).error || `Worker error ${res.status}`);
  throw workerFail(code, message, (body as JsonMap).diagnostic);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'Only POST supported');

  const actor = await getActor(req).catch(() => null);
  if (!actor) return err(401, 'UNAUTHORIZED', 'Autenticazione richiesta.');
  if (!hasPermission(actor, 'cloud_sync')) {
    return err(403, 'FORBIDDEN', 'Permesso cloud_sync richiesto per riattivare clienti su Matchpoint.');
  }

  let body: JsonMap;
  try {
    body = await req.json();
  } catch {
    return err(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  const c = (body.client && typeof body.client === 'object') ? body.client as JsonMap : body;
  const codice = clean(c.codice ?? '');
  if (!codice) return err(400, 'INVALID_CODICE', 'Codice Matchpoint richiesto.');

  const client: JsonMap = {
    codice,
    // id interno Matchpoint (id_people): se presente il worker va diretto alla Ficha.
    idInterno: clean(c.idInterno ?? ''),
    firstName: clean(c.firstName ?? ''),
    surname: clean(c.surname ?? ''),
    phone: clean(c.phone ?? ''),
    email: clean(c.email ?? ''),
  };

  const workerUrl = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_URL'));
  const workerApiKey = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_API_KEY'));
  const username = clean(Deno.env.get('MATCHPOINT_USERNAME'));
  const password = clean(Deno.env.get('MATCHPOINT_PASSWORD'));
  const baseUrl = clean(Deno.env.get('MATCHPOINT_BASE_URL')) || DEFAULT_BASE_URL;

  if (!workerUrl || !workerApiKey) {
    return err(500, 'WORKER_NOT_CONFIGURED', 'Worker Matchpoint non configurato (URL o API key mancante).', { retryable: false });
  }
  if (!username || !password) {
    return err(500, 'MATCHPOINT_CREDENTIALS_MISSING', 'Credenziali Matchpoint non configurate.', { retryable: false });
  }

  let workerResult: JsonMap;
  try {
    workerResult = await callWorkerReactivateClient({ workerUrl, workerApiKey, username, password, baseUrl, client });
  } catch (workerErr) {
    const we = workerErr as Partial<WorkerError>;
    const code = clean(we?.code) || 'WORKER_ERROR';
    const retryable = typeof we?.retryable === 'boolean' ? we.retryable : isRetryableCode(code);
    const diagnostic = we?.diagnostic;
    const status = retryable ? 502 : 422;
    return err(status, code, errorText(workerErr), { client, retryable, ...(diagnostic ? { diagnostic } : {}) });
  }

  return ok({
    message: `Socio riattivato su Matchpoint (codice ${codice})`,
    client,
    worker: workerResult,
  });
});
