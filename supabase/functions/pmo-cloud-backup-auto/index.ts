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

// App settings stored as app_setting records in pmo_cloud_records
const APP_SETTING_KEYS = [
  'potentialSlotSchedule',
  'dailyAssistantState',
  'assessmentSettings',
  'assessmentPausedTokens',
  'assessmentCommunicationTemplates',
  'whatsappOpenSettings',
  'postMatchFeedbackSettings',
];

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

// Read all records of a given type from pmo_cloud_records (with pagination)
async function readCloudRecords(admin: any, recordType: string): Promise<any[]> {
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

// Read app_setting records and return as {key: value} map
async function readAppSettings(admin: any): Promise<JsonMap> {
  const result: JsonMap = {};
  const { data, error } = await admin
    .from('pmo_cloud_records')
    .select('local_key,payload')
    .eq('record_type', 'app_setting')
    .eq('deleted', false)
    .in('local_key', APP_SETTING_KEYS);
  if (error) throw new Error(`READ_FAILED_APP_SETTINGS: ${errorText(error)}`);
  const rows = Array.isArray(data) ? data : [];
  for (const row of rows) {
    const key = clean(row.local_key);
    if (key && row.payload?.value !== undefined) {
      result[key] = row.payload.value;
    }
  }
  return result;
}

// Read assessment_tokens table
async function readAssessmentTokens(admin: any): Promise<JsonMap> {
  const tokens: JsonMap = {};
  const { data, error } = await admin
    .from('assessment_tokens')
    .select('token,member_local_id,member_name,phone_last4,status,status_autovalutazione,created_at,sent_at,completed_at,registered_at');
  if (error) {
    console.warn('READ_FAILED_ASSESSMENT_TOKENS:', errorText(error));
    return tokens;
  }
  const rows = Array.isArray(data) ? data : [];
  for (const item of rows) {
    const key = clean(item.member_local_id);
    if (!key) continue;
    tokens[key] = {
      memberId: key,
      token: item.token,
      memberName: item.member_name,
      phone: item.phone_last4 || '',
      email: '',
      status: item.status || 'created',
      status_autovalutazione: item.status_autovalutazione || 'INVITO_INVIATO',
      createdAt: item.created_at || null,
      sentAt: item.sent_at || null,
      completedAt: item.completed_at || null,
      registeredToSupabase: true,
      registeredAt: item.registered_at || null,
    };
  }
  return tokens;
}

// Read self_assessments table
async function readAssessmentResponses(admin: any): Promise<any[]> {
  const { data, error } = await admin
    .from('self_assessments')
    .select('*');
  if (error) {
    console.warn('READ_FAILED_SELF_ASSESSMENTS:', errorText(error));
    return [];
  }
  return Array.isArray(data) ? data : [];
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

    // Read all data in parallel
    const [
      memberRecords,
      bookingRecords,
      occupancyRecords,
      historyRecords,
      fillSlotRequestRecords,
      guidedInviteRecords,
      whatsappHistoryRecords,
      whatsappTemplateRecords,
      matchpointDataRecords,
      appSettings,
      assessmentTokens,
      assessmentResponses,
    ] = await Promise.all([
      readCloudRecords(admin, 'member'),
      readCloudRecords(admin, 'booking'),
      readCloudRecords(admin, 'booking_occupancy'),
      readCloudRecords(admin, 'booking_history'),
      readCloudRecords(admin, 'fill_slot_player_request'),
      readCloudRecords(admin, 'guided_invite_session'),
      readCloudRecords(admin, 'whatsapp_message_history'),
      readCloudRecords(admin, 'whatsapp_message_template'),
      readCloudRecords(admin, 'matchpoint_data'),
      readAppSettings(admin),
      readAssessmentTokens(admin),
      readAssessmentResponses(admin),
    ]);

    // Reconstruct arrays / objects matching the browser backup format
    const giocatori = memberRecords.map((r) => r.payload).filter(Boolean);
    const prenotazioni = bookingRecords.map((r) => r.payload).filter(Boolean);
    const prenotazioniOccupazione = occupancyRecords.map((r) => r.payload).filter(Boolean);
    const storicoPrenotazioni = historyRecords.map((r) => r.payload).filter(Boolean);
    const fillSlotPlayerRequests = fillSlotRequestRecords.map((r) => r.payload).filter(Boolean);

    // guidedInviteSessions: object {key: payload}
    const guidedInviteSessions: JsonMap = {};
    for (const r of guidedInviteRecords) {
      if (r.local_key && r.payload) guidedInviteSessions[r.local_key] = r.payload;
    }

    // whatsappMessageHistory: object {key: items}
    const whatsappMessageHistory: JsonMap = {};
    for (const r of whatsappHistoryRecords) {
      if (r.local_key && r.payload) {
        whatsappMessageHistory[r.local_key] = r.payload.items ?? r.payload;
      }
    }

    // whatsappMessageTemplates: array
    const whatsappMessageTemplates = whatsappTemplateRecords.map((r) => r.payload).filter(Boolean);

    // matchpointData: single record with local_key='main'
    const matchpointDataRecord = matchpointDataRecords.find((r) => r.local_key === 'main');
    const matchpointData = matchpointDataRecord?.payload ?? null;

    const payload: JsonMap = {
      app: 'Padel Match Organizer',
      version: 'auto-server',
      environment,
      createdAt: savedAt,
      source: 'pmo_cloud_backup_auto',
      // Matchpoint data
      giocatori,
      memberIdCounter: giocatori.length,
      prenotazioni,
      prenotazioniOccupazione,
      storicoPrenotazioni,
      matchpointData,
      // Assessment
      assessmentTokens,
      assessmentResponses,
      assessmentSettings: appSettings['assessmentSettings'] ?? null,
      assessmentPausedTokens: appSettings['assessmentPausedTokens'] ?? null,
      assessmentCommunicationTemplates: appSettings['assessmentCommunicationTemplates'] ?? null,
      // WhatsApp
      whatsappMessageHistory,
      whatsappMessageTemplates,
      whatsappOpenSettings: appSettings['whatsappOpenSettings'] ?? null,
      // Fill slots
      fillSlotPlayerRequests,
      // Guided invite sessions
      guidedInviteSessions,
      // Other settings
      potentialSlotSchedule: appSettings['potentialSlotSchedule'] ?? null,
      dailyAssistantState: appSettings['dailyAssistantState'] ?? null,
      postMatchFeedbackSettings: appSettings['postMatchFeedbackSettings'] ?? null,
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

    const counts = {
      giocatori: giocatori.length,
      prenotazioni: prenotazioni.length,
      occupazione: prenotazioniOccupazione.length,
      storico: storicoPrenotazioni.length,
      assessmentTokens: Object.keys(assessmentTokens).length,
      assessmentResponses: assessmentResponses.length,
      whatsappHistory: Object.keys(whatsappMessageHistory).length,
      whatsappTemplates: whatsappMessageTemplates.length,
      fillSlotRequests: fillSlotPlayerRequests.length,
      guidedInviteSessions: Object.keys(guidedInviteSessions).length,
    };

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
      counts,
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
      counts,
      sizeBytes: bytes.byteLength,
    }));

    return json({ ok: true, savedAt, environment, counts, sizeBytes: bytes.byteLength });

  } catch (err) {
    const message = errorText(err);
    console.error(JSON.stringify({ event: 'pmo_cloud_backup_auto_error', message }));
    return errorResponse(500, 'BACKUP_AUTO_FAILED', message);
  }
});
