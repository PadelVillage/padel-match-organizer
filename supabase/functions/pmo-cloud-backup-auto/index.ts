import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

type JsonMap = Record<string, any>;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pmo-routine-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BACKUP_BUCKET = 'pmo-app-backups';
const BACKUP_PATH = 'latest/browser-backup.json';
const META_RECORD_TYPE = 'app_setting';
const META_LOCAL_KEY = 'cloud_backup_latest';
const PAGE_SIZE = 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, code: string, message: string) {
  return json({ ok: false, error: code, message }, status);
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function errorText(value: unknown) {
  if (value instanceof Error) return value.message || String(value);
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value ?? ''); }
}

async function verifyRoutineSecret(admin: any, secret: string): Promise<boolean> {
  const value = clean(secret);
  if (!value) return false;
  const { data, error } = await admin.rpc('pmo_verify_data_routine_secret', { p_secret: value });
  if (error) {
    console.error(JSON.stringify({ event: 'routine_secret_verify_error', message: errorText(error) }));
    return false;
  }
  return data === true;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function readAllRecords(admin: any, recordType: string): Promise<any[]> {
  const records: any[] = [];
  for (let from = 0, page = 0; page < 100; page++, from += PAGE_SIZE) {
    const { data, error } = await admin
      .from('pmo_cloud_records')
      .select('local_key,payload,synced_at')
      .eq('record_type', recordType)
      .eq('deleted', false)
      .order('synced_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`READ_FAILED_${recordType.toUpperCase()}: ${errorText(error)}`);
    const page_data = Array.isArray(data) ? data : [];
    records.push(...page_data);
    if (page_data.length < PAGE_SIZE) break;
  }
  return records;
}

async function ensureBucket(admin: any) {
  const { error: readError } = await admin.storage.getBucket(BACKUP_BUCKET);
  if (!readError) return;
  const { error: createError } = await admin.storage.createBucket(BACKUP_BUCKET, {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
    allowedMimeTypes: ['application/json'],
  });
  if (createError && !/already exists|Duplicate/i.test(createError.message || '')) throw createError;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Usa POST.');

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse(500, 'SUPABASE_ENV_MISSING', 'Configurazione Supabase mancante.');
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const routineSecret = req.headers.get('x-pmo-routine-secret') || '';
  if (!(await verifyRoutineSecret(admin, routineSecret))) {
    return errorResponse(401, 'AUTH_REQUIRED', 'Secret routine non valido.');
  }

  try {
    const savedAt = new Date().toISOString();
    const environment = supabaseUrl.includes('qqbfphyslczzkxoncgex') ? 'prod' : 'test';

    // Read all Matchpoint data stored in pmo_cloud_records
    const [memberRecords, bookingRecords, occupancyRecords, historyRecords] = await Promise.all([
      readAllRecords(admin, 'member'),
      readAllRecords(admin, 'booking'),
      readAllRecords(admin, 'booking_occupancy'),
      readAllRecords(admin, 'booking_history'),
    ]);

    const giocatori = memberRecords.map((r) => r.payload).filter(Boolean);
    const prenotazioni = bookingRecords.map((r) => r.payload).filter(Boolean);
    const prenotazioniOccupazione = occupancyRecords.map((r) => r.payload).filter(Boolean);
    const storicoPrenotazioni = historyRecords.map((r) => r.payload).filter(Boolean);

    const payload: JsonMap = {
      app: 'Padel Match Organizer',
      version: 'auto-server',
      environment,
      createdAt: savedAt,
      source: 'pmo_cloud_backup_auto',
      giocatori,
      memberIdCounter: giocatori.length,
      prenotazioni,
      prenotazioniOccupazione,
      storicoPrenotazioni,
    };

    const text = JSON.stringify(payload, null, 2);
    const bytes = new TextEncoder().encode(text);
    const sha256 = await sha256Hex(bytes);

    await ensureBucket(admin);

    const file = new Blob([bytes], { type: 'application/json' });
    const { error: uploadError } = await admin.storage
      .from(BACKUP_BUCKET)
      .upload(BACKUP_PATH, file, { upsert: true, contentType: 'application/json', cacheControl: '0' });
    if (uploadError) throw uploadError;

    const metadata: JsonMap = {
      id: META_LOCAL_KEY,
      key: META_LOCAL_KEY,
      type: 'cloud_backup',
      source: 'pmo_cloud_backup_auto',
      bucket: BACKUP_BUCKET,
      path: BACKUP_PATH,
      savedAt,
      createdAt: savedAt,
      version: 'auto-server',
      environment,
      size: bytes.byteLength,
      sha256,
      counts: {
        giocatori: giocatori.length,
        prenotazioni: prenotazioni.length,
        occupazione: prenotazioniOccupazione.length,
        storico: storicoPrenotazioni.length,
      },
      actorEmail: `system@auto.${environment}.padel-match-organizer`,
    };

    const { error: metaError } = await admin
      .from('pmo_cloud_records')
      .upsert([{
        record_type: META_RECORD_TYPE,
        local_key: META_LOCAL_KEY,
        payload: metadata,
        payload_hash: sha256,
        deleted: false,
        synced_at: savedAt,
      }], { onConflict: 'record_type,local_key' });
    if (metaError) throw metaError;

    console.log(JSON.stringify({
      event: 'pmo_cloud_backup_auto_ok',
      environment,
      savedAt,
      counts: metadata.counts,
      sizeBytes: bytes.byteLength,
    }));

    return json({
      ok: true,
      savedAt,
      environment,
      counts: metadata.counts,
      sizeBytes: bytes.byteLength,
    });
  } catch (err) {
    const message = errorText(err);
    console.error(JSON.stringify({ event: 'pmo_cloud_backup_auto_error', message }));
    return errorResponse(500, 'BACKUP_AUTO_FAILED', message);
  }
});
