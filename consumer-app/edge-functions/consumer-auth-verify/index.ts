import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ⚠️ QUESTA FUNZIONE GIRA SUL PROGETTO CONSUMER (aylykijfirtegyxzdwgu),
//    NON sul gestionale. Vedi consumer-app/README.md.
//
// consumer-auth-verify — terzo e ultimo passo del login.
//
//   { challenge_id, code } → { access_token, refresh_token, expires_in }
//
// Il codice viene verificato QUI, non dal browser: verifyOtp di GoTrue vuole
// l'email come identificatore, e l'email in anagrafica non deve mai raggiungere
// il client. Il browser conosce solo l'id opaco della challenge.
//
// ⚠️ ORDINE OBBLIGATO — verifica, aggancio, POI refresh.
// L'hook custom_access_token_hook mette matchpoint_member_id nel JWT leggendo
// consumer_profiles. Al primo accesso quel profilo non esiste ancora nel
// momento in cui GoTrue emette il token: l'access_token che torna da verifyOtp
// nasce quindi SENZA il claim, e con la RLS costruita sul claim il socio
// entrerebbe in un'app che gli nega tutto. Per questo, dopo aver scritto il
// profilo, la sessione va rinfrescata: il refresh riesegue l'hook e il token
// che consegniamo al client porta il claim. È un fallimento silenzioso e
// sgradevole da diagnosticare — non togliere il refresh.

type JsonMap = Record<string, unknown>;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
function err(status: number, code: string, message: string) {
  return json({ ok: false, error: code, message }, status);
}
function clean(value: unknown) { return String(value ?? '').trim(); }

// Una sola risposta per «codice sbagliato», «challenge scaduta», «tentativi
// finiti», «challenge decoy» e «id inventato»: distinguerle direbbe al
// chiamante se l'email che aveva digitato era quella giusta.
function invalidCode() {
  return json(
    { ok: false, error: 'INVALID_CODE', message: 'Codice non valido o scaduto.' },
    401,
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return err(405, 'METHOD_NOT_ALLOWED', 'Usare POST.');
  }

  let body: JsonMap;
  try {
    body = await req.json();
  } catch {
    return err(400, 'BAD_JSON', 'Body non è JSON valido.');
  }

  const challengeId = clean(body.challenge_id);
  const code = clean(body.code);
  if (!/^[0-9a-f-]{36}$/i.test(challengeId)) {
    return err(400, 'BAD_CHALLENGE', 'challenge_id mancante o malformato.');
  }
  if (!/^[0-9]{6}$/.test(code)) {
    // Formato sbagliato: non consuma un tentativo, è un errore di digitazione.
    return err(400, 'BAD_CODE_FORMAT', 'Il codice è di 6 cifre.');
  }

  const supabaseUrl = clean(Deno.env.get('SUPABASE_URL'));
  const serviceKey = clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const anonKey = clean(Deno.env.get('SUPABASE_ANON_KEY'));
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return err(503, 'MISSING_ENV', 'Variabili Supabase non configurate.');
  }
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // ── 1. Brucia un tentativo e recupera la challenge (atomico) ────────────
  const { data: claimed, error: claimErr } = await service
    .rpc('consumer_claim_challenge', { p_id: challengeId });
  if (claimErr) {
    console.error('[auth-verify] claim fallita:', claimErr.message);
    return err(503, 'DB_ERROR', 'Servizio non disponibile, riprova tra poco.');
  }
  const challenge = Array.isArray(claimed) ? claimed[0] : null;
  if (!challenge) return invalidCode();

  const memberId = clean(challenge.member_id);
  const email = clean(challenge.email);
  if (challenge.decoy === true || !memberId || !email) {
    console.log('[auth-verify] tentativo su challenge decoy');
    return invalidCode();
  }

  // ── 2. Verifica del codice presso GoTrue ────────────────────────────────
  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: verified, error: verifyErr } = await anon.auth.verifyOtp({
    email,
    token: code,
    type: 'email',
  });
  if (verifyErr || !verified?.session || !verified.user) {
    console.log(`[auth-verify] codice rifiutato per socio ${memberId}: ${verifyErr?.message ?? 'sessione assente'}`);
    return invalidCode();
  }

  // ── 3. Aggancio del profilo — service_role, mai il socio ────────────────
  const { error: bindErr } = await service.rpc('consumer_bind_profile', {
    p_auth_user_id: verified.user.id,
    p_member_id: memberId,
  });
  if (bindErr) {
    // Autenticato ma non agganciato = token senza claim = app che nega tutto.
    // Meglio non consegnare la sessione: il socio richiede un codice nuovo.
    console.error(`[auth-verify] AGGANCIO FALLITO per socio ${memberId}:`, bindErr.message);
    return err(500, 'BIND_FAILED', 'Accesso non completato, riprova.');
  }

  // ── 4. Challenge esaurita; l'email non serve più, e non deve restare ────
  const { error: consumeErr } = await service
    .from('consumer_login_challenges')
    .update({ consumed_at: new Date().toISOString(), email: null })
    .eq('id', challengeId);
  if (consumeErr) {
    console.warn('[auth-verify] chiusura challenge fallita:', consumeErr.message);
  }

  // ── 5. Refresh: è QUI che il token prende il claim (vedi testata) ───────
  const { data: refreshed, error: refreshErr } = await anon.auth.refreshSession({
    refresh_token: verified.session.refresh_token,
  });
  const session = refreshed?.session ?? null;
  if (refreshErr || !session) {
    console.error(`[auth-verify] refresh fallito per socio ${memberId}:`, refreshErr?.message);
    return err(500, 'REFRESH_FAILED', 'Accesso non completato, riprova.');
  }

  console.log(`[auth-verify] socio ${memberId} dentro (utente ${verified.user.id})`);
  return json({
    ok: true,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in ?? null,
  });
});
