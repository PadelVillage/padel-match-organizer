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

const BACKUP_BUCKET = 'pmo-app-backups';
const BACKUP_PATH = 'latest/browser-backup.json';
const META_RECORD_TYPE = 'app_setting';
const META_LOCAL_KEY = 'cloud_backup_latest';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function okResponse(body: JsonMap) {
  return json({ ok: true, ...body });
}

function errorResponse(status: number, code: string, message: string, extra: JsonMap = {}) {
  return json({ ok: false, error: code, message, ...extra }, status);
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function errorText(value: unknown) {
  if (value instanceof Error) return value.message || value.name || String(value);
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value ?? '');
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
  await admin.from('pmo_audit_log').insert({
    actor_user_id: actor.userId,
    actor_email: actor.email,
    actor_role: actor.role,
    action,
    detail,
  });
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeCounts(payload: JsonMap) {
  const objectSize = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).length : 0;
  return {
    giocatori: Array.isArray(payload.giocatori) ? payload.giocatori.length : 0,
    prenotazioni: Array.isArray(payload.prenotazioni) ? payload.prenotazioni.length : 0,
    occupazione: Array.isArray(payload.prenotazioniOccupazione) ? payload.prenotazioniOccupazione.length : 0,
    storico: Array.isArray(payload.storicoPrenotazioni) ? payload.storicoPrenotazioni.length : 0,
    gruppi: Array.isArray(payload.dailyPlayerGroups) ? payload.dailyPlayerGroups.length : 0,
    inviti: objectSize(payload.lunchMatchInvitations),
    slotCreati: objectSize(payload.fillSlotCreatedMatches),
    richieste: Array.isArray(payload.fillSlotPlayerRequests) ? payload.fillSlotPlayerRequests.length : 0,
    sessioni: objectSize(payload.guidedInviteSessions),
    whatsapp: objectSize(payload.whatsappMessageHistory),
    modelliWhatsapp: Array.isArray(payload.whatsappMessageTemplates) ? payload.whatsappMessageTemplates.length : 0,
  };
}

function validateBackupPayload(value: unknown): JsonMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_BACKUP_PAYLOAD');
  const payload = value as JsonMap;
  if (clean(payload.app) !== 'Padel Match Organizer') throw new Error('INVALID_BACKUP_APP');
  if (!Array.isArray(payload.giocatori)) throw new Error('INVALID_BACKUP_MEMBERS');
  return payload;
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

function backupMetadata(payload: JsonMap, actor: StaffActor, byteLength: number, sha256: string) {
  const savedAt = new Date().toISOString();
  return {
    id: META_LOCAL_KEY,
    key: META_LOCAL_KEY,
    type: 'cloud_backup',
    source: 'pmo_cloud_backup',
    bucket: BACKUP_BUCKET,
    path: BACKUP_PATH,
    savedAt,
    createdAt: clean(payload.createdAt || savedAt),
    version: clean(payload.version || ''),
    environment: clean(payload.environment || ''),
    size: byteLength,
    sha256,
    counts: safeCounts(payload),
    actorEmail: actor.email,
  };
}

async function saveMetadata(admin: any, metadata: JsonMap) {
  const { error } = await admin
    .from('pmo_cloud_records')
    .upsert([{
      record_type: META_RECORD_TYPE,
      local_key: META_LOCAL_KEY,
      payload: metadata,
      payload_hash: metadata.sha256 || null,
      deleted: false,
      synced_at: metadata.savedAt || new Date().toISOString(),
    }], { onConflict: 'record_type,local_key' });
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Usa POST per il backup cloud.');

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return errorResponse(500, 'SUPABASE_ENV_MISSING', 'Configurazione Supabase Edge Function incompleta.');
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  let actor: StaffActor | null = null;

  try {
    actor = await authenticateStaff(req, supabaseUrl, anonKey);
    if (!hasPermission(actor, 'cloud_sync')) {
      return errorResponse(403, 'PERMISSION_DENIED', 'Il profilo staff non ha il permesso cloud_sync.');
    }

    const body = await req.json().catch(() => ({}));
    const action = clean(body.action || body.mode || '');
    if (!['save', 'load'].includes(action)) {
      return errorResponse(400, 'INVALID_ACTION', 'Azione backup cloud non valida.');
    }

    await ensureBucket(admin);

    if (action === 'save') {
      const payload = validateBackupPayload(body.payload);
      const text = JSON.stringify(payload, null, 2);
      const bytes = new TextEncoder().encode(text);
      const sha256 = await sha256Hex(bytes);
      const metadata = backupMetadata(payload, actor, bytes.byteLength, sha256);
      const file = new Blob([bytes], { type: 'application/json' });
      const { error: uploadError } = await admin.storage
        .from(BACKUP_BUCKET)
        .upload(BACKUP_PATH, file, {
          upsert: true,
          contentType: 'application/json',
          cacheControl: '0',
        });
      if (uploadError) throw uploadError;

      await saveMetadata(admin, metadata);
      await logAudit(admin, actor, 'cloud_backup_save', {
        bucket: BACKUP_BUCKET,
        path: BACKUP_PATH,
        size: metadata.size,
        sha256: metadata.sha256,
        environment: metadata.environment,
        version: metadata.version,
        counts: metadata.counts,
      });
      return okResponse({ action, metadata });
    }

    const { data, error: downloadError } = await admin.storage
      .from(BACKUP_BUCKET)
      .download(BACKUP_PATH);
    if (downloadError) {
      return errorResponse(404, 'CLOUD_BACKUP_NOT_FOUND', 'Nessun backup cloud disponibile.');
    }
    const text = await data.text();
    const payload = validateBackupPayload(JSON.parse(text));
    const bytes = new TextEncoder().encode(text);
    const sha256 = await sha256Hex(bytes);
    const metadata = {
      id: META_LOCAL_KEY,
      key: META_LOCAL_KEY,
      type: 'cloud_backup',
      source: 'pmo_cloud_backup',
      bucket: BACKUP_BUCKET,
      path: BACKUP_PATH,
      loadedAt: new Date().toISOString(),
      createdAt: clean(payload.createdAt || ''),
      version: clean(payload.version || ''),
      environment: clean(payload.environment || ''),
      size: bytes.byteLength,
      sha256,
      counts: safeCounts(payload),
    };
    await logAudit(admin, actor, 'cloud_backup_load', {
      bucket: BACKUP_BUCKET,
      path: BACKUP_PATH,
      size: metadata.size,
      sha256: metadata.sha256,
      environment: metadata.environment,
      version: metadata.version,
    });
    return okResponse({ action, payload, metadata });
  } catch (error) {
    const message = errorText(error);
    const code = message.includes('AUTH_REQUIRED') ? 'AUTH_REQUIRED' : message;
    await logAudit(admin, actor, 'cloud_backup_error', { code, message }).catch(() => {});
    const status = code === 'AUTH_REQUIRED' ? 401 : 500;
    return errorResponse(status, code, message);
  }
});
