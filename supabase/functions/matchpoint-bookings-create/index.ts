import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

type JsonMap = Record<string, unknown>;

type StaffActor = {
  userId: string;
  email: string;
  role: string;
  permissions: JsonMap;
};

type BookingRequest = {
  campo: number;       // 1-4
  data: string;        // ISO date YYYY-MM-DD
  ora: string;         // HH:MM
  oraFine: string;     // HH:MM
  durata: number;      // minutes
  nome: string;        // player name (Partita) or istruttore name (Lezione)
  tipo?: string;       // 'partita' | 'lezione' | 'manutenzione' (default: 'partita')
  istruttore?: string; // istruttore name override (Lezione) — defaults to nome
  note?: string;
  giocatori?: { nome: string; codice?: string }[];
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

function isValidIso(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function isValidTime(time: string) {
  return /^\d{2}:\d{2}$/.test(time);
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

  // Use anon key + user JWT in Authorization so PostgREST exposes auth.uid()/auth.jwt()
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

async function callWorkerCreateBooking(opts: {
  workerUrl: string;
  workerApiKey: string;
  username: string;
  password: string;
  baseUrl: string;
  booking: BookingRequest;
}): Promise<JsonMap> {
  const { workerUrl, workerApiKey, username, password, baseUrl, booking } = opts;
  const endpoint = `${workerUrl}/create-booking`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerApiKey}`,
      },
      body: JSON.stringify({ username, password, baseUrl, booking }),
    });
  } catch (netErr) {
    // NESSUN retry: la prenotazione potrebbe essere già stata creata dal worker.
    throw new Error(`Worker network error: ${errorText(netErr)}`);
  }

  const body = await res.json().catch(() => ({}));
  if (res.ok) return body as JsonMap;

  if (res.status === 501) {
    throw new Error('WORKER_CREATE_BOOKING_NOT_IMPLEMENTED: Il worker browser non supporta ancora la creazione di prenotazioni. Contatta l\'amministratore per aggiornare il worker.');
  }

  throw new Error(
    `Worker error ${res.status}: ${errorText((body as JsonMap).message || (body as JsonMap).error || body)}`,
  );
}

async function saveStaffBookingRecord(opts: {
  supabaseUrl: string;
  supabaseKey: string;
  actor: StaffActor;
  booking: BookingRequest;
  workerResult: JsonMap;
}) {
  const { supabaseUrl, supabaseKey, actor, booking, workerResult } = opts;
  const client = createClient(supabaseUrl, supabaseKey);
  const localKey = `staff_booking|${booking.data}|${booking.ora}|Campo ${booking.campo}|${actor.userId}`;

  await client.from('pmo_cloud_records').upsert({
    record_type: 'staff_booking',
    local_key: localKey,
    payload: {
      campo: booking.campo,
      data: booking.data,
      ora: booking.ora,
      ora_fine: booking.oraFine,
      durata: booking.durata,
      nome: booking.nome,
      note: booking.note ?? '',
      giocatori: booking.giocatori ?? [],
      created_by_email: actor.email,
      created_by_role: actor.role,
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
    return err(403, 'FORBIDDEN', 'Permesso cloud_sync richiesto per prenotare su Matchpoint.');
  }

  // Parse body
  let body: JsonMap;
  try {
    body = await req.json();
  } catch {
    return err(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  // Validate booking fields
  const campo = parseInt(String(body.campo ?? ''));
  const data = clean(body.data);
  const ora = clean(body.ora);
  const oraFine = clean(body.oraFine);
  const durata = parseInt(String(body.durata ?? '0'));
  const nome = clean(body.nome);

  const tipo = clean(body.tipo || 'partita').toLowerCase();
  const istruttore = clean(body.istruttore);
  const giocatori = (Array.isArray(body.giocatori) ? body.giocatori : [])
    .map((g) => {
      if (typeof g === 'string') return { nome: clean(g), codice: '' };
      const o = (g ?? {}) as JsonMap;
      return { nome: clean(o.nome ?? o.name), codice: clean(o.codice ?? o.memberId ?? o.id) };
    })
    .filter((g) => g.nome);
  const VALID_TIPOS = ['partita', 'lezione', 'manutenzione', 'stagionale'];

  if (!campo || campo < 1 || campo > 4) return err(400, 'INVALID_CAMPO', 'Campo deve essere un numero da 1 a 4.');
  if (!isValidIso(data)) return err(400, 'INVALID_DATA', 'Data deve essere nel formato YYYY-MM-DD.');
  if (!isValidTime(ora)) return err(400, 'INVALID_ORA', 'Ora inizio deve essere nel formato HH:MM.');
  if (!isValidTime(oraFine)) return err(400, 'INVALID_ORA_FINE', 'Ora fine deve essere nel formato HH:MM.');
  if (durata <= 0 || durata > 360) return err(400, 'INVALID_DURATA', 'Durata deve essere tra 1 e 360 minuti.');
  if (!nome) return err(400, 'INVALID_NOME', 'Nome giocatore/istruttore richiesto.');
  if (!VALID_TIPOS.includes(tipo)) return err(400, 'INVALID_TIPO', `tipo deve essere uno di: ${VALID_TIPOS.join(', ')}.`);

  const booking: BookingRequest = {
    campo, data, ora, oraFine, durata, nome, tipo,
    istruttore: istruttore || undefined,
    note: clean(body.note),
    giocatori: giocatori.length ? giocatori : undefined,
  };

  // Env vars
  const workerUrl = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_URL'));
  const workerApiKey = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_API_KEY'));
  const username = clean(Deno.env.get('MATCHPOINT_USERNAME'));
  const password = clean(Deno.env.get('MATCHPOINT_PASSWORD'));
  const supabaseUrl = clean(Deno.env.get('SUPABASE_URL'));
  const supabaseKey = clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const baseUrl = clean(Deno.env.get('MATCHPOINT_BASE_URL')) || DEFAULT_BASE_URL;

  if (!workerUrl || !workerApiKey) {
    return err(500, 'WORKER_NOT_CONFIGURED', 'Worker Matchpoint non configurato (URL o API key mancante).');
  }
  if (!username || !password) {
    return err(500, 'MATCHPOINT_CREDENTIALS_MISSING', 'Credenziali Matchpoint non configurate.');
  }

  // Call browser worker
  let workerResult: JsonMap;
  try {
    workerResult = await callWorkerCreateBooking({ workerUrl, workerApiKey, username, password, baseUrl, booking });
  } catch (workerErr) {
    return err(502, 'WORKER_ERROR', errorText(workerErr), { booking });
  }

  // Save record to DB
  try {
    await saveStaffBookingRecord({ supabaseUrl, supabaseKey, actor, booking, workerResult });
  } catch (dbErr) {
    // Non-fatal: worker succeeded, just log
    console.error(JSON.stringify({ event: 'db_save_failed', error: errorText(dbErr) }));
  }

  const tipoLabel = tipo === 'lezione' ? 'Lezione' : tipo === 'manutenzione' ? 'Manutenzione' : 'Partita';
  return ok({
    message: `${tipoLabel} creata: Campo ${campo} · ${data} · ${ora}–${oraFine} · ${nome}`,
    booking,
    worker: workerResult,
  });
});
