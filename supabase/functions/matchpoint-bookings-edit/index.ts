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
  add?: Array<{ nome: string; codice?: string; costo?: string }>;
};

type EditRequest = {
  idReserva?: string;
  campo?: number;
  data?: string;            // ISO yyyy-mm-dd
  ora?: string;             // HH:MM (inizio) — per far ricavare l'idReserva dal tabellone lato worker
  move?: EditMove;
  players?: EditPlayers;
  read?: boolean;           // lettura sola: restituisce i partecipanti attuali senza modificare
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
  operatore?: string;
}): Promise<JsonMap> {
  const { workerUrl, workerApiKey, edit, operatore } = opts;
  const endpoint = `${workerUrl}/edit-booking`;

  // ⚠️ NESSUN RETRY. La modifica scrive su Matchpoint in modo incrementale:
  // "+ Aggiungere all'elenco" persiste il giocatore SUBITO (prima del Salvare).
  // Ritentare su errore del worker DUPLICA le scritture (è così che il cliente 921
  // era stato aggiunto 3 volte). Un solo tentativo; in caso di errore si riporta e basta.
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerApiKey}`,
      },
      body: JSON.stringify({ idReserva: edit.idReserva, campo: edit.campo, data: edit.data, ora: edit.ora, move: edit.move, players: edit.players, read: edit.read === true, operatore: operatore ?? '' }),
    });
  } catch (netErr) {
    throw new Error(`Worker network error (nessun retry sulle modifiche): ${errorText(netErr)}`);
  }

  const body = await res.json().catch(() => ({}));
  if (res.ok) return body as JsonMap;

  if (res.status === 501 || res.status === 404) {
    throw new Error('WORKER_EDIT_BOOKING_NOT_IMPLEMENTED: Il worker browser non espone /edit-booking. Verifica che il worker sia aggiornato e deployato.');
  }

  throw new Error(
    `Worker error ${res.status} (nessun retry): ${errorText((body as JsonMap).message || (body as JsonMap).error || body)}`,
  );
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
  const campo = body.campo != null ? parseInt(String(body.campo)) : undefined;
  const data = body.data != null ? clean(body.data) : undefined;
  const ora = body.ora != null ? clean(body.ora) : undefined;
  const move = (body.move && typeof body.move === 'object') ? (body.move as EditMove) : undefined;
  const players = (body.players && typeof body.players === 'object') ? (body.players as EditPlayers) : undefined;
  const readOnly = body.read === true;

  // Validation: serve idReserva OPPURE (campo+data+ora). Per modificare serve almeno uno tra
  // move/players; in lettura sola (read) non serve nessuna modifica.
  const hasTerna = !!campo && !!data && !!ora;
  if (!idReserva && !hasTerna) {
    return err(400, 'PARAMS_MANCANTI', 'Serve idReserva, oppure campo+data+ora.');
  }
  const hasMove = !!move && Object.keys(move).length > 0;
  const hasPlayers = !!players && (
    (Array.isArray(players.add) && players.add.length > 0) ||
    (Array.isArray(players.remove) && players.remove.length > 0) ||
    players.removeAll === true
  );
  if (!readOnly && !hasMove && !hasPlayers) {
    return err(400, 'EDIT_NESSUNA_MODIFICA', 'Serve almeno uno tra move e players.');
  }

  const edit: EditRequest = { idReserva, campo, data, ora, move: hasMove ? move : undefined, players: hasPlayers ? players : undefined, read: readOnly };

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
    workerResult = await callWorkerEditBooking({ workerUrl, workerApiKey, edit, operatore: actor.email });
  } catch (workerErr) {
    return err(502, 'WORKER_ERROR', errorText(workerErr), { edit });
  }

  // Save record to DB (best-effort). In lettura sola non si registra nessuna "modifica".
  if (!readOnly) {
    try {
      await saveStaffEditRecord({ supabaseUrl, supabaseKey, actor, edit, workerResult });
    } catch (dbErr) {
      console.error(JSON.stringify({ event: 'db_save_failed', error: errorText(dbErr) }));
    }
  }

  if (readOnly) {
    return ok({
      message: 'Lettura partecipanti completata.',
      edit,
      worker: workerResult,
    });
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
