import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// ai-settings — scrittura delle impostazioni GLOBALI dell'assistente (pmo_ai_settings).
// Lettura: l'app la fa direttamente via REST (RLS: select authenticated). Qui si SCRIVE,
// e SOLO owner/admin può farlo (l'interruttore "modalità apprendimento" è una scelta del
// circolo, non del singolo). Upsert con service_role; audit di chi ha cambiato (email).
// ─────────────────────────────────────────────────────────────────────────────

type JsonMap = Record<string, unknown>;
type StaffActor = { userId: string; email: string; role: string; permissions: JsonMap };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Chiavi ammesse (whitelist anti-scrittura arbitraria).
const ALLOWED_KEYS = new Set(['learning_mode']);
const PROD_REF = 'qqbfphyslczzkxoncgex';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}
function ok(body: JsonMap) { return json({ ok: true, ...body }); }
function err(status: number, code: string, message: string) { return json({ ok: false, error: code, message }, status); }
function clean(v: unknown) { return String(v ?? '').trim(); }

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
    email: clean(userData.user.email),
    role: clean(profile.role),
    permissions: (profile.permissions && typeof profile.permissions === 'object') ? profile.permissions : {},
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'Only POST supported');

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) return err(500, 'CONFIG_MISSING', 'SUPABASE_URL / SERVICE_ROLE non configurati.');

  const actor = await getActor(req).catch(() => null);
  if (!actor) return err(401, 'UNAUTHORIZED', 'Autenticazione richiesta.');
  // Solo owner/admin: l'interruttore è un'impostazione globale del circolo.
  if (!['owner', 'admin'].includes(actor.role)) {
    return err(403, 'FORBIDDEN', 'Solo owner o admin possono cambiare le impostazioni dell’assistente.');
  }

  let body: JsonMap;
  try { body = await req.json(); } catch { return err(400, 'INVALID_JSON', 'Body non valido.'); }

  const key = clean(body.key);
  if (!ALLOWED_KEYS.has(key)) return err(400, 'INVALID_KEY', 'Chiave non ammessa.');
  // value arriva già come JSON (es. true/false). Lo passo così com'è.
  const value = body.value;

  const env = supabaseUrl.includes(PROD_REF) ? 'prod' : 'test';
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { error: upErr } = await admin
    .from('pmo_ai_settings')
    .upsert({ env, key, value, updated_by: actor.email, updated_at: new Date().toISOString() }, { onConflict: 'env,key' });
  if (upErr) return err(500, 'UPSERT_ERROR', upErr.message);

  return ok({ env, key, value });
});
