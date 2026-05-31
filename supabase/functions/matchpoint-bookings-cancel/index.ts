import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

type JsonMap = Record<string, unknown>;

type StaffActor = {
  userId: string;
  email: string;
  role: string;
  permissions: JsonMap;
};

type CancelRequest = {
  idReserva?: string;
  campo?: number;
  data?: string;
  ora?: string;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

async function callWorkerCancelBooking(opts: {
  workerUrl: string;
  workerApiKey: string;
  cancel: CancelRequest;
}): Promise<JsonMap> {
  const { workerUrl, workerApiKey, cancel } = opts;
  const endpoint = `${workerUrl}/cancel-booking`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${workerApiKey}`,
        },
        body: JSON.stringify({ idReserva: cancel.idReserva, campo: cancel.campo, data: cancel.data, ora: cancel.ora }),
      });
    } catch (netErr) {
      if (attempt === 3) {
        throw new Error(`Worker network error after ${attempt} attempts: ${errorText(netErr)}`);
      }
      await new Promise((r) => setTimeout(r, attempt * 3000));
      continue;
    }

    const body = await res.json().catch(() => ({}));

    if (res.ok) return body as JsonMap;

    if (res.status === 501) {
      throw new Error('WORKER_CANCEL_BOOKING_NOT_IMPLEMENTED: Il worker browser non supporta ancora la cancellazione di prenotazioni. Contatta l\'amministratore per aggiornare il worker.');
    }

    if (attempt === 3) {
      throw new Error(
        `Worker error ${res.status} after ${attempt} attempts: ${errorText((body as JsonMap).message || (body as JsonMap).error || body)}`,
      );
    }
    await new Promise((r) => setTimeout(r, attempt * 3000));
  }

  throw new Error('Worker call failed after retries');
}

async function saveStaffCancelRecord(opts: {
  supabaseUrl: string;
  supabaseKey: string;
  actor: StaffActor;
  cancel: CancelRequest;
  workerResult: JsonMap;
}) {
  const { supabaseUrl, supabaseKey, actor, cancel, workerResult } = opts;
  const client = createClient(supabaseUrl, supabaseKey);
  const localKey = `staff_cancel|${cancel.data ?? ''}|${cancel.ora ?? ''}|Campo ${cancel.campo ?? ''}|${cancel.idReserva ?? ''}|${actor.userId}`;

  await client.from('pmo_cloud_records').upsert({
    record_type: 'staff_cancel',
    local_key: localKey,
    payload: {
      idReserva: cancel.idReserva,
      campo: cancel.campo,
      data: cancel.data,
      ora: cancel.ora,
      cancelled_by_email: actor.email,
      cancelled_by_role: actor.role,
      worker_result: workerResult,
    },
    deleted: false,
    updated_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  }, { onConflict: 'record_type,local_key' });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'Only POST supported');

  // Auth
  const actor = await getActor(req).catch(() => null);
  if (!actor) return err(401, 'UNAUTHORIZED', 'Autenticazione richiesta.');
  if (!hasPermission(actor, 'cloud_sync')) {
    return err(403, 'FORBIDDEN', 'Permesso cloud_sync richiesto per annullare su Matchpoint.');
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

  // Validation: need idReserva OR (campo + data + ora)
  const hasId = !!idReserva;
  const hasTerna = !!campo && !!data && !!ora;
  if (!hasId && !hasTerna) {
    return err(400, 'PARAMS_MANCANTI', 'Serve idReserva oppure la terna campo+data+ora.');
  }

  const cancel: CancelRequest = { idReserva: idReserva || undefined, campo, data, ora };

  // Env vars
  const workerUrl = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_URL'));
  const workerApiKey = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_API_KEY'));
  const supabaseUrl = clean(Deno.env.get('SUPABASE_URL'));
  const supabaseKey = clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

  if (!workerUrl || !workerApiKey) {
    return err(500, 'WORKER_NOT_CONFIGURED', 'Worker Matchpoint non configurato (URL o API key mancante).');
  }

  // Call browser worker
  let workerResult: JsonMap;
  try {
    workerResult = await callWorkerCancelBooking({ workerUrl, workerApiKey, cancel });
  } catch (workerErr) {
    return err(502, 'WORKER_ERROR', errorText(workerErr), { cancel });
  }

  // Save record to DB
  try {
    await saveStaffCancelRecord({ supabaseUrl, supabaseKey, actor, cancel, workerResult });
  } catch (dbErr) {
    console.error(JSON.stringify({ event: 'db_save_failed', error: errorText(dbErr) }));
  }

  return ok({
    message: `Annullamento richiesto: ${cancel.idReserva ? `idReserva ${cancel.idReserva}` : `Campo ${cancel.campo} · ${cancel.data} · ${cancel.ora}`}`,
    cancel,
    worker: workerResult,
  });
});
