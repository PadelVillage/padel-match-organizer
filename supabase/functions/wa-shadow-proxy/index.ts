import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// wa-shadow-proxy — proxy AUTENTICATO verso lo Shadow Mode backend (WhatsApp).
// Motivo: prima il client (index.html) chiamava direttamente ${SHADOW_URL}/webhook/*
// con l'INTERNAL_API_KEY in CHIARO nel sorgente pubblico (GitHub Pages) → chiunque
// poteva inviare messaggi WhatsApp per conto del club. Ora il token vive solo come
// secret server-side qui; il client passa il JWT staff e questa funzione inoltra.
// Whitelist di azioni: suggest | approve-suggestion | send. La risposta dello Shadow
// (body + status, incluso 429) viene ritornata VERBATIM così la UI resta invariata.

type JsonMap = Record<string, unknown>;

type StaffActor = { userId: string; email: string; role: string; permissions: JsonMap };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Solo questi path webhook sono inoltrabili (niente path arbitrari dal client).
const ALLOWED_ACTIONS = new Set(['suggest', 'approve-suggestion', 'send']);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
function err(status: number, code: string, message: string, extra: JsonMap = {}) {
  return json({ ok: false, success: false, error: code, errore: message, ...extra }, status);
}
function clean(value: unknown) { return String(value ?? '').trim(); }

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'Solo POST supportato.');

  // Gate: staff autenticato e attivo (blocca il pubblico che prima leggeva il token dal sorgente).
  const actor = await getActor(req).catch(() => null);
  if (!actor) return err(401, 'UNAUTHORIZED', 'Autenticazione staff richiesta.');

  let body: JsonMap;
  try { body = await req.json(); } catch { return err(400, 'INVALID_JSON', 'Body non JSON valido.'); }

  const action = clean(body.action);
  if (!ALLOWED_ACTIONS.has(action)) {
    return err(400, 'INVALID_ACTION', `Azione non ammessa: ${action || '(vuota)'}`);
  }
  const payload = (body.payload && typeof body.payload === 'object') ? body.payload as JsonMap : {};

  const shadowUrl = clean(Deno.env.get('SHADOW_WEBHOOK_URL'));
  const shadowKey = clean(Deno.env.get('SHADOW_INTERNAL_API_KEY'));
  if (!shadowUrl || !shadowKey) return err(500, 'SHADOW_NOT_CONFIGURED', 'Shadow backend non configurato.');

  let res: Response;
  try {
    res = await fetch(`${shadowUrl}/webhook/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${shadowKey}` },
      body: JSON.stringify(payload),
    });
  } catch (netErr) {
    return err(502, 'SHADOW_NETWORK_ERROR', `Shadow non raggiungibile: ${clean(netErr instanceof Error ? netErr.message : netErr)}`);
  }

  // Passa attraverso body + status verbatim (incluso 429) così la UI resta invariata.
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
