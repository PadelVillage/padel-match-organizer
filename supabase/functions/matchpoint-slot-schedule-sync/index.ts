// Edge Function: legge la griglia slot settimanale da Matchpoint via worker browser.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

type JsonMap = Record<string, any>;

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
const DAY_KEYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'] as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, code: string, message: string, extra: JsonMap = {}) {
  return json({ ok: false, error: code, message, ...extra }, status);
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function hasPermission(actor: StaffActor, permission: string) {
  if (['owner', 'admin'].includes(actor.role)) return true;
  return actor.permissions?.[permission] === true;
}

async function authenticateStaff(req: Request, supabaseUrl: string, anonKey: string): Promise<StaffActor> {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('AUTH_REQUIRED');
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData?.user) throw new Error('AUTH_REQUIRED');
  const { data: profileData, error: profileError } = await authClient.rpc('pmo_get_my_staff_profile');
  if (profileError) throw new Error(profileError.message || 'AUTH_REQUIRED');
  const profile = Array.isArray(profileData) ? profileData[0] : profileData;
  if (!profile || profile.status !== 'active') throw new Error('AUTH_REQUIRED');
  return {
    userId: userData.user.id,
    email: clean(profile.email || userData.user.email || ''),
    role: clean(profile.role || 'staff'),
    permissions: profile.permissions || {},
  };
}

async function logAudit(admin: any, actor: StaffActor | null, action: string, detail: JsonMap) {
  if (!actor) return;
  try {
    await admin.from('pmo_audit_log').insert({
      actor_user_id: actor.userId,
      actor_email: actor.email,
      actor_role: actor.role,
      action,
      detail,
    });
  } catch {
    // audit failures must not break the flow
  }
}

function normaliseSlotString(value: unknown): string | null {
  const raw = clean(value).replace(/\s+/g, '');
  const match = raw.match(/^(\d{1,2})[:.](\d{2})-(\d{1,2})[:.](\d{2})$/);
  if (!match) return null;
  const h1 = parseInt(match[1], 10), m1 = parseInt(match[2], 10);
  const h2 = parseInt(match[3], 10), m2 = parseInt(match[4], 10);
  if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) return null;
  if (h2 * 60 + m2 <= h1 * 60 + m1) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h1)}:${pad(m1)}-${pad(h2)}:${pad(m2)}`;
}

function normaliseSchedule(raw: any): { schedule: Record<string, string[]>, totalSlots: number } {
  const schedule: Record<string, string[]> = {};
  let totalSlots = 0;
  for (const day of DAY_KEYS) {
    const seen = new Set<string>();
    const list = Array.isArray(raw?.[day]) ? raw[day] : [];
    const cleaned: string[] = [];
    for (const item of list) {
      const slot = normaliseSlotString(item);
      if (!slot || seen.has(slot)) continue;
      seen.add(slot);
      cleaned.push(slot);
    }
    cleaned.sort((a, b) => a.localeCompare(b));
    schedule[day] = cleaned;
    totalSlots += cleaned.length;
  }
  return { schedule, totalSlots };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callWorker(workerUrl: string, workerApiKey: string, username: string, password: string, baseUrl: string, scheduleName: string): Promise<JsonMap> {
  const endpoint = `${workerUrl.replace(/\/+$/, '')}/export-slot-schedule`;
  const healthEndpoint = `${workerUrl.replace(/\/+$/, '')}/health`;
  const requestBody = JSON.stringify({
    username,
    password,
    baseUrl,
    scheduleName,
    credentialSource: 'supabase_secret',
  });

  let lastDiagnostic: JsonMap = {};

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (attempt > 1) {
      await fetch(healthEndpoint, { headers: { Accept: 'application/json' } }).catch(() => null);
      await sleep(attempt === 2 ? 3000 : 7000);
    }

    let response: Response | null = null;
    let text = '';
    let networkError = '';
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${workerApiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: requestBody,
      });
      text = await response.text();
    } catch (error: any) {
      networkError = String(error?.message || error);
    }

    let payload: JsonMap = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text.slice(0, 800) }; }

    lastDiagnostic = {
      attempt,
      status: response?.status || 0,
      endpoint,
      networkError,
      workerError: payload.error || '',
      workerMessage: payload.message || '',
    };

    if (response?.ok && payload.ok === true && payload.schedule) return payload;
    if (attempt >= 3) break;
    const retryable = !response || response.status === 0 || [502, 503, 504].includes(response.status);
    if (!retryable) break;
  }

  throw Object.assign(
    new Error(`MATCHPOINT_BROWSER_WORKER_FAILED: ${lastDiagnostic.workerMessage || lastDiagnostic.workerError || `HTTP ${lastDiagnostic.status}`}`),
    { code: 'MATCHPOINT_BROWSER_WORKER_FAILED', diagnostic: lastDiagnostic },
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Usa POST per sincronizzare la griglia slot da Matchpoint.');

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return errorResponse(500, 'SUPABASE_ENV_MISSING', 'Configurazione Supabase incompleta.');
  }

  const workerUrl = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_URL') || '');
  const workerApiKey = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_API_KEY') || '');
  const username = clean(Deno.env.get('MATCHPOINT_USERNAME') || '');
  const password = clean(Deno.env.get('MATCHPOINT_PASSWORD') || '');

  if (!workerUrl || !workerApiKey) {
    return errorResponse(500, 'MATCHPOINT_BROWSER_WORKER_SECRETS_MISSING', 'Worker browser Matchpoint non configurato. Imposta MATCHPOINT_BROWSER_WORKER_URL e MATCHPOINT_BROWSER_WORKER_API_KEY nei secret Supabase.');
  }
  if (!username || !password) {
    return errorResponse(500, 'MATCHPOINT_SECRETS_MISSING', 'Credenziali Matchpoint non configurate. Imposta MATCHPOINT_USERNAME e MATCHPOINT_PASSWORD nei secret Supabase.');
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  let actor: StaffActor | null = null;

  try {
    actor = await authenticateStaff(req, supabaseUrl, anonKey);
    if (!hasPermission(actor, 'cloud_sync')) {
      return errorResponse(403, 'PERMISSION_DENIED', 'Il profilo staff non ha il permesso cloud_sync.');
    }

    const baseUrl = clean(Deno.env.get('MATCHPOINT_BASE_URL') || DEFAULT_BASE_URL);
    const body = await req.json().catch(() => ({}));
    const scheduleName = clean(body?.scheduleName) || clean(Deno.env.get('MATCHPOINT_SLOT_SCHEDULE_NAME') || 'Orari settimana + venerdi');
    const startedAt = Date.now();

    const workerResult = await callWorker(workerUrl, workerApiKey, username, password, baseUrl, scheduleName);
    const durationMs = Date.now() - startedAt;

    const { schedule, totalSlots } = normaliseSchedule(workerResult.schedule);

    if (totalSlots === 0) {
      await logAudit(admin, actor, 'matchpoint_slot_schedule_sync_empty', {
        durationMs, workerDiagnostic: workerResult.diagnostic,
      });
      return errorResponse(422, 'NO_SLOTS_DETECTED', 'Nessuno slot trovato nella pagina Orari Matchpoint. Controlla che la pagina Sistema → Campi → Orari di utilizzo delle installazioni contenga una griglia configurata.');
    }

    await logAudit(admin, actor, 'matchpoint_slot_schedule_sync_ok', {
      durationMs, totalSlots,
      counts: Object.fromEntries(DAY_KEYS.map(d => [d, schedule[d].length])),
      workerParsedBy: workerResult.diagnostic?.parsedBy || '',
    });

    return json({
      ok: true,
      schedule,
      totalSlots,
      durationMs,
      parsedBy: workerResult.diagnostic?.parsedBy || 'worker_browser',
    });
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg === 'AUTH_REQUIRED' || msg.includes('AUTH_REQUIRED')) {
      return errorResponse(401, 'AUTH_REQUIRED', 'Accedi con email personale Supabase.');
    }
    if (msg.includes('MATCHPOINT_BROWSER_WORKER_FAILED')) {
      await logAudit(admin, actor, 'matchpoint_slot_schedule_sync_error', { message: msg, code: 'MATCHPOINT_BROWSER_WORKER_FAILED' });
      return errorResponse(502, 'MATCHPOINT_BROWSER_WORKER_FAILED', msg, { diagnostic: err?.diagnostic || null });
    }
    await logAudit(admin, actor, 'matchpoint_slot_schedule_sync_error', { message: msg });
    return errorResponse(500, 'INTERNAL_ERROR', msg);
  }
});
