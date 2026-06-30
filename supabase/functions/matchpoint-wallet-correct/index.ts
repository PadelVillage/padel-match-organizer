import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// matchpoint-wallet-correct — Fase 2b: corregge il saldo del BORSELLINO (Portafoglio/Monedero)
// di un cliente su Matchpoint, via worker /correct-wallet ("Correzione del saldo"), in ENTRAMBE
// le direzioni:
//   • STORNO   → subtractCents>0 (sottrae credito, importo negativo). Validato dal vivo.
//   • RICARICA → addCents>0      (aggiunge credito, importo positivo).
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

  return ok({
    op: wantsRecharge ? 'recharge' : 'storno',
    idInterno: clean(workerResult.idCliente) || idInterno,
    codice,
    subtractCents: wantsStorno ? subtractCents : null,
    addCents: wantsRecharge ? addCents : null,
    currentCents: typeof workerResult.currentCents === 'number' ? workerResult.currentCents : null,
    targetCents: typeof workerResult.targetCents === 'number' ? workerResult.targetCents : null,
    balanceCentsPost: typeof workerResult.balanceCentsPost === 'number' ? workerResult.balanceCentsPost : null,
  });
});
