import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

// Crea l'accesso personale di un utente staff GIA AUTORIZZATO in Amministrazione,
// con l'account Supabase Auth gia confermato (email_confirm: true) → nessuna email di
// conferma. Cosi la registrazione e' un solo passaggio: invito → scegli password → entri.
//
// Endpoint NON autenticato (la persona non ha ancora un accesso): la sicurezza sta nel
// fatto che l'email DEVE essere gia autorizzata da un admin (pmo_can_register_staff) e che
// non si tocca mai la password di un account gia attivo.

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

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function isValidEmail(value: unknown) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ ok: false, error: 'SUPABASE_ENV_MISSING' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({}));
    const email = clean(body.email).toLocaleLowerCase('it-IT');
    const password = String(body.password ?? '');
    if (!isValidEmail(email)) return json({ ok: false, error: 'INVALID_EMAIL' }, 400);
    if (password.length < 8) return json({ ok: false, error: 'WEAK_PASSWORD' }, 400);

    // 1) L'email DEVE essere autorizzata in Amministrazione (profilo staff invited/active).
    const { data: canData, error: canErr } = await admin.rpc('pmo_can_register_staff', { p_email: email });
    if (canErr) return json({ ok: false, error: 'AUTHZ_CHECK_FAILED', message: canErr.message }, 500);
    const can = Array.isArray(canData) ? canData[0] : canData;
    if (!can || can.ok !== true) return json({ ok: false, error: 'EMAIL_NOT_AUTHORIZED' }, 403);
    // NB: NON ci si fida di can.registered (= il profilo ha un auth_user_id collegato): se quel
    // collegamento e' "fantasma" (account Auth cancellato ma profilo rimasto), credere a registered
    // bloccherebbe la persona sia dal login sia dalla registrazione. La fonte di verita' e' l'effettiva
    // ESISTENZA dell'account Auth, verificata sotto: l'eventuale link stantio sul profilo non blocca il
    // login (pmo_current_staff_profile riconcilia per email).

    // 2) Esiste DAVVERO un account Auth per questa email?
    let authUserId = '';
    let alreadyConfirmed = false;
    let page = 1;
    const perPage = 1000;
    for (;;) {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage });
      if (listErr) return json({ ok: false, error: 'AUTH_LIST_FAILED', message: listErr.message }, 500);
      const users = (list && list.users) || [];
      const found = users.find((u: any) => clean(u.email).toLocaleLowerCase('it-IT') === email);
      if (found) { authUserId = found.id; alreadyConfirmed = !!found.email_confirmed_at; break; }
      if (users.length < perPage) break;
      page += 1;
      if (page > 20) break; // guardia anti-loop
    }

    if (authUserId && alreadyConfirmed) {
      // Account gia confermato ma profilo non ancora collegato: non tocco la password.
      return json({ ok: true, alreadyRegistered: true });
    }

    if (authUserId) {
      // Registrazione pendente (account creato ma mai confermato): imposto password e confermo.
      const { error: updErr } = await admin.auth.admin.updateUserById(authUserId, { password, email_confirm: true });
      if (updErr) return json({ ok: false, error: 'AUTH_UPDATE_FAILED', message: updErr.message }, 500);
      return json({ ok: true, created: false, confirmed: true });
    }

    // 3) Nessun account: lo creo gia confermato (admin.createUser NON invia email).
    const { error: createErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (createErr) return json({ ok: false, error: 'AUTH_CREATE_FAILED', message: createErr.message }, 500);
    return json({ ok: true, created: true, confirmed: true });
  } catch (e) {
    return json({ ok: false, error: 'UNEXPECTED', message: String((e && (e as any).message) || e) }, 500);
  }
});
