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

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
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

function approxBase64Bytes(base64: string) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor(base64.length * 3 / 4) - padding;
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

async function callClaudeVision(apiKey: string, model: string, mimeType: string, base64: string) {
  const body = {
    model,
    max_tokens: 2048,
    system: 'Sei un OCR esperto di griglie tabellari di orari sportivi. Estrai SOLO gli slot effettivamente segnati, in formato HH:MM-HH:MM zero-padded, deduplicando quando lo stesso slot appare in piu righe.',
    tools: [{
      name: 'submit_weekly_schedule',
      description: 'Restituisce gli slot settimanali estratti dalla griglia in formato strutturato.',
      input_schema: {
        type: 'object',
        properties: Object.fromEntries(DAY_KEYS.map(day => [day, {
          type: 'array',
          items: { type: 'string', pattern: '^\\d{2}:\\d{2}-\\d{2}:\\d{2}$' },
          description: `Slot per ${day} in formato HH:MM-HH:MM zero-padded`,
        }])),
        required: [...DAY_KEYS],
      },
    }],
    tool_choice: { type: 'tool', name: 'submit_weekly_schedule' },
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mimeType, data: base64 },
        },
        {
          type: 'text',
          text: 'Questa immagine mostra la griglia settimanale degli slot prenotabili di un circolo padel: righe=ore del giorno, colonne=giorni Lunedi-Domenica. Estrai per ogni giorno gli slot UNICI in formato HH:MM-HH:MM. Se lo stesso slot occupa piu righe (es. 12:30-14:00 visibile sia su 12:00 sia su 13:00), contalo una sola volta. Ignora le celle vuote che mostrano solo l\'ora di riga (es. "12:00") senza intervallo. Usa il tool submit_weekly_schedule per la risposta.',
        },
      ],
    }],
  };

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const msg = (data && (data.error?.message || data.error)) || text || `HTTP ${response.status}`;
    throw new Error(`ANTHROPIC_API_ERROR: ${msg}`);
  }
  const toolUse = Array.isArray(data?.content) ? data.content.find((b: any) => b?.type === 'tool_use') : null;
  if (!toolUse || !toolUse.input) {
    throw new Error('ANTHROPIC_NO_TOOL_USE: il modello non ha restituito una griglia strutturata.');
  }
  return {
    raw: toolUse.input,
    usage: data.usage || null,
    stopReason: data.stop_reason || null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Usa POST per leggere una griglia.');

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') || '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return errorResponse(500, 'SUPABASE_ENV_MISSING', 'Configurazione Supabase incompleta.');
  }
  if (!anthropicKey) {
    return errorResponse(500, 'ANTHROPIC_API_KEY_MISSING', 'Variabile ANTHROPIC_API_KEY non impostata nei secrets Supabase.');
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  let actor: StaffActor | null = null;

  try {
    actor = await authenticateStaff(req, supabaseUrl, anonKey);
    if (!hasPermission(actor, 'cloud_sync')) {
      return errorResponse(403, 'PERMISSION_DENIED', 'Il profilo staff non ha il permesso cloud_sync.');
    }

    const body = await req.json().catch(() => ({}));
    const mimeType = clean(body.mimeType).toLowerCase();
    const base64 = clean(body.image);
    const model = clean(body.model) || DEFAULT_MODEL;

    if (!base64) return errorResponse(400, 'IMAGE_MISSING', 'Campo image (base64) mancante.');
    if (!ALLOWED_MIME.has(mimeType)) return errorResponse(400, 'IMAGE_MIME_UNSUPPORTED', `Tipo immagine non supportato: ${mimeType}. Accettati: ${[...ALLOWED_MIME].join(', ')}.`);
    const approxBytes = approxBase64Bytes(base64);
    if (approxBytes > MAX_IMAGE_BYTES) return errorResponse(413, 'IMAGE_TOO_LARGE', `Immagine troppo grande (${Math.round(approxBytes / 1024)} KB). Massimo ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB.`);

    const startedAt = Date.now();
    const claudeResult = await callClaudeVision(anthropicKey, model, mimeType === 'image/jpg' ? 'image/jpeg' : mimeType, base64);
    const durationMs = Date.now() - startedAt;
    const { schedule, totalSlots } = normaliseSchedule(claudeResult.raw);

    if (totalSlots === 0) {
      await logAudit(admin, actor, 'pmo_schedule_from_image_empty', {
        model, durationMs, usage: claudeResult.usage,
      });
      return errorResponse(422, 'NO_SLOTS_DETECTED', 'Nessuno slot riconoscibile nell\'immagine. Controlla che la griglia sia ben leggibile.');
    }

    await logAudit(admin, actor, 'pmo_schedule_from_image_ok', {
      model, durationMs, totalSlots,
      usage: claudeResult.usage,
      stopReason: claudeResult.stopReason,
      counts: Object.fromEntries(DAY_KEYS.map(d => [d, schedule[d].length])),
    });

    return json({
      ok: true,
      schedule,
      totalSlots,
      model,
      durationMs,
      usage: claudeResult.usage,
    });
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg === 'AUTH_REQUIRED') return errorResponse(401, 'AUTH_REQUIRED', 'Accedi con email personale Supabase.');
    if (msg.startsWith('ANTHROPIC_API_ERROR')) return errorResponse(502, 'ANTHROPIC_API_ERROR', msg);
    if (msg.startsWith('ANTHROPIC_NO_TOOL_USE')) return errorResponse(502, 'ANTHROPIC_NO_TOOL_USE', msg);
    await logAudit(admin, actor, 'pmo_schedule_from_image_error', { message: msg });
    return errorResponse(500, 'INTERNAL_ERROR', msg);
  }
});
