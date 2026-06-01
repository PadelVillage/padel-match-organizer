import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

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
  add?: Array<{ nome: string; costo?: string }>;
};

type EditRequest = {
  idReserva?: string;
  move?: EditMove;
  players?: EditPlayers;
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

async function callWorkerEditBooking(opts: {
  workerUrl: string;
  workerApiKey: string;
  edit: EditRequest;
}): Promise<JsonMap> {
  const { workerUrl, workerApiKey, edit } = opts;
  const endpoint = `${workerUrl}/edit-booking`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${workerApiKey}`,
        },
        body: JSON.stringify({ idReserva: edit.idReserva, move: edit.move, players: edit.players }),
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

    if (res.status === 501 || res.status === 404) {
      throw new Error('WORKER_EDIT_BOOKING_NOT_IMPLEMENTED: Il worker browser non espone /edit-booking. Verifica che il worker sia aggiornato e deployato.');
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

  await client.from('pmo_cloud_records').upsert({
    record_type: 'staff_edit',
    local_key: localKey,
    payload: {
      idReserva: edit.idReserva,
      move: edit.move ?? null,
      players: edit.players ?? null,
      edited_by_email: actor.email,
      edited_by_role: actor.role,
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
  const move = (body.move && typeof body.move === 'object') ? (body.move as EditMove) : undefined;
  const players = (body.players && typeof body.players === 'object') ? (body.players as EditPlayers) : undefined;

  // Validation: serve idReserva + almeno uno tra move/players
  if (!idReserva) {
    return err(400, 'PARAMS_MANCANTI', 'Serve idReserva.');
  }
  const hasMove = !!move && Object.keys(move).length > 0;
  const hasPlayers = !!players && (
    (Array.isArray(players.add) && players.add.length > 0) ||
    (Array.isArray(players.remove) && players.remove.length > 0) ||
    players.removeAll === true
  );
  if (!hasMove && !hasPlayers) {
    return err(400, 'EDIT_NESSUNA_MODIFICA', 'Serve almeno uno tra move e players.');
  }

  const edit: EditRequest = { idReserva, move: hasMove ? move : undefined, players: hasPlayers ? players : undefined };

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
    workerResult = await callWorkerEditBooking({ workerUrl, workerApiKey, edit });
  } catch (workerErr) {
    return err(502, 'WORKER_ERROR', errorText(workerErr), { edit });
  }

  // Save record to DB (best-effort)
  try {
    await saveStaffEditRecord({ supabaseUrl, supabaseKey, actor, edit, workerResult });
  } catch (dbErr) {
    console.error(JSON.stringify({ event: 'db_save_failed', error: errorText(dbErr) }));
  }

  const parts: string[] = [`idReserva ${edit.idReserva}`];
  if (hasMove) parts.push(`sposta → Campo ${move?.campo ?? '?'} · ${move?.data ?? '?'} · ${move?.oraInizio ?? '?'}–${move?.oraFine ?? '?'}`);
  if (hasPlayers) parts.push('giocatori aggiornati');

  return ok({
    message: `Modifica richiesta: ${parts.join(' · ')}`,
    edit,
    worker: workerResult,
  });
});
