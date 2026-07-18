import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ⚠️ QUESTA FUNZIONE GIRA SUL PROGETTO CONSUMER (aylykijfirtegyxzdwgu),
//    NON sul gestionale. Non spostarla in supabase/functions/: quella cartella
//    è deployata automaticamente su qqbfphyslczzkxoncgex dalla CI, e finirebbe
//    sul progetto sbagliato. Vedi consumer-app/README.md.
//
// consumer-auth-start — primi due passi del login dell'app consumer.
//
//   { step: 'identify', phone }
//     → { found: false }
//     → { found: true, candidates: [{ index, first_name, has_email }] }
//
//   { step: 'challenge', phone, candidate_index, email }
//     → { challenge_id, expires_in }        ← SEMPRE, comunque vada
//
// Il punto delicato è il secondo passo. L'email digitata dal socio viene
// confrontata con quella in scheda (dal ponte, sul gestionale); il codice parte
// verso l'indirizzo IN ANAGRAFICA, mai verso quello digitato. Se non combacia
// NON si dice: si crea una challenge «decoy» — stessa risposta, nessun codice
// spedito, verifica che fallirà sempre. Altrimenti l'app diventerebbe un
// oracolo per indovinare le email dei soci a partire dal loro telefono, che non
// è un segreto.
//
// Perché anche i TEMPI di risposta devono coincidere: se sul ramo «combacia» si
// aspettasse l'invio SMTP (secondi) e sull'altro no (millisecondi), il decoy
// sarebbe riconoscibile col cronometro e l'oracolo tornerebbe da solo. L'invio
// gira quindi in waitUntil, fuori dalla risposta: entrambi i rami costano una
// chiamata al ponte più una insert.

type JsonMap = Record<string, unknown>;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const IDENTITY_URL_DEFAULT =
  'https://qqbfphyslczzkxoncgex.supabase.co/functions/v1/consumer-identity-lookup';

// Quante challenge può aprire lo stesso telefono in un'ora. Non protegge
// l'account (chi indovina l'email non riceve comunque il codice: quello arriva
// nella casella del socio) ma impedisce di setacciare l'anagrafica a colpi di
// tentativi e di bombardare un socio di email non richieste.
const MAX_CHALLENGES_PER_HOUR = 6;

// Le challenge servono per il rate limit dell'ultima ora; oltre questo le righe
// sono solo residuo, e contengono l'email del socio. Purgate a ogni giro.
const PURGE_AFTER_HOURS = 24;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
function ok(body: JsonMap) { return json({ ok: true, ...body }); }
function err(status: number, code: string, message: string) {
  return json({ ok: false, error: code, message }, status);
}
function clean(value: unknown) { return String(value ?? '').trim(); }

function phoneDigits(value: unknown): string {
  return clean(value).replace(/\D/g, '');
}

// `as unknown as BufferSource`: le lib TS recenti tipizzano Uint8Array come
// Uint8Array<ArrayBufferLike>, non assegnabile a BufferSource. A runtime è
// corretto; il cast tiene pulito `deno check`.
async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function callIdentityBridge(payload: JsonMap): Promise<JsonMap | null> {
  const secret = clean(Deno.env.get('CONSUMER_BRIDGE_SECRET'));
  if (!secret) {
    console.error('[auth-start] CONSUMER_BRIDGE_SECRET assente: login spento.');
    return null;
  }
  const url = clean(Deno.env.get('CONSUMER_IDENTITY_URL')) || IDENTITY_URL_DEFAULT;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Consumer-Secret': secret },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null) as JsonMap | null;
    if (!res.ok || !data?.ok) {
      console.error(`[auth-start] ponte HTTP ${res.status}:`, JSON.stringify(data).slice(0, 200));
      return null;
    }
    return data;
  } catch (e) {
    console.error('[auth-start] ponte non raggiungibile:', e instanceof Error ? e.message : e);
    return null;
  }
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

  const step = clean(body.step);
  if (step !== 'identify' && step !== 'challenge') {
    return err(400, 'BAD_STEP', "Campo step deve essere 'identify' o 'challenge'.");
  }

  const digits = phoneDigits(body.phone);
  if (digits.length < 10) {
    return err(400, 'BAD_PHONE', 'Numero di telefono mancante o troppo corto.');
  }
  const last10 = digits.slice(-10);

  // ── identify: telefono → nome di battesimo ──────────────────────────────
  if (step === 'identify') {
    const data = await callIdentityBridge({ mode: 'identify', phone: last10 });
    if (!data) return err(503, 'BRIDGE_DOWN', 'Servizio non disponibile, riprova tra poco.');
    return ok({
      found: data.found === true,
      candidates: Array.isArray(data.candidates) ? data.candidates : [],
    });
  }

  // ── challenge: confronto email + invio del codice ───────────────────────
  const supabaseUrl = clean(Deno.env.get('SUPABASE_URL'));
  const serviceKey = clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const anonKey = clean(Deno.env.get('SUPABASE_ANON_KEY'));
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return err(503, 'MISSING_ENV', 'Variabili Supabase non configurate.');
  }
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const phoneHash = await sha256Hex(last10);

  // Residuo vecchio: contiene l'email del socio, non serve più a nulla.
  await service
    .from('consumer_login_challenges')
    .delete()
    .lt('created_at', new Date(Date.now() - PURGE_AFTER_HOURS * 3600_000).toISOString())
    .then(({ error }) => {
      if (error) console.warn('[auth-start] purge fallita:', error.message);
    });

  const sinceHour = new Date(Date.now() - 3600_000).toISOString();
  const { count, error: countErr } = await service
    .from('consumer_login_challenges')
    .select('id', { count: 'exact', head: true })
    .eq('phone_hash', phoneHash)
    .gte('created_at', sinceHour);
  if (countErr) {
    console.error('[auth-start] rate limit non verificabile:', countErr.message);
    return err(503, 'DB_ERROR', 'Servizio non disponibile, riprova tra poco.');
  }
  const rateLimited = (count ?? 0) >= MAX_CHALLENGES_PER_HOUR;

  // Anche quando si è oltre soglia si interroga comunque il ponte, così il
  // tempo di risposta non cambia fra «sotto soglia» e «oltre soglia».
  const data = await callIdentityBridge({
    mode: 'challenge',
    phone: last10,
    candidate_index: Number(body.candidate_index ?? 0),
    email: clean(body.email),
  });
  if (!data) return err(503, 'BRIDGE_DOWN', 'Servizio non disponibile, riprova tra poco.');

  // Oltre soglia non si registra nulla e si restituisce un id che non esiste:
  // la verifica non troverà la riga e risponderà «codice non valido», cioè
  // esattamente ciò che vede chi sbaglia l'email. Registrare anche questi
  // tentativi allungherebbe da solo la finestra di un'ora a ogni nuova prova,
  // e a restarci chiuso fuori sarebbe soprattutto il socio in buona fede, che
  // non può nemmeno sapere di essere oltre soglia (dirglielo sarebbe un
  // indizio). All'attaccante restano comunque 6 tentativi veri all'ora.
  if (rateLimited) {
    console.warn(
      `[auth-start] oltre soglia (${count}/h) per telefono ${phoneHash.slice(0, 8)}… → challenge finta`,
    );
    return ok({ challenge_id: crypto.randomUUID(), expires_in: 600 });
  }

  const memberIdRaw = data.match === true ? clean(data.member_id) : '';
  const emailRaw = data.match === true ? clean(data.email_for_otp) : '';
  // Il ponte promette 6 cifre; se un giorno mandasse altro, il CHECK della
  // tabella farebbe fallire l'insert con un 503 — cioè una risposta DIVERSA da
  // quella del decoy, che è a sua volta un indizio. Meglio degradare a decoy.
  const matched = /^[0-9]{6}$/.test(memberIdRaw) && emailRaw.includes('@');
  if (data.match === true && !matched) {
    console.error(`[auth-start] ponte con match ma dati inattesi (member_id="${memberIdRaw}")`);
  }

  const { data: inserted, error: insertErr } = await service
    .from('consumer_login_challenges')
    .insert({
      phone_hash: phoneHash,
      member_id: matched ? memberIdRaw : null,
      email: matched ? emailRaw : null,
      decoy: !matched,
    })
    .select('id, expires_at')
    .single();
  if (insertErr || !inserted) {
    console.error('[auth-start] insert challenge fallita:', insertErr?.message);
    return err(503, 'DB_ERROR', 'Servizio non disponibile, riprova tra poco.');
  }

  if (matched) {
    // Fuori dalla risposta: vedi il commento in testa sui tempi. Un fallimento
    // qui non si può raccontare al client — «invio fallito» direbbe che l'email
    // combaciava — quindi resta un errore nei log, e il client offre «non ho
    // ricevuto il codice» che manda in segreteria.
    const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const task = anon.auth
      .signInWithOtp({ email: emailRaw, options: { shouldCreateUser: true } })
      .then(({ error }) => {
        if (error) {
          console.error(`[auth-start] invio OTP fallito per socio ${memberIdRaw}:`, error.message);
        } else {
          console.log(`[auth-start] codice spedito al socio ${memberIdRaw}`);
        }
      })
      .catch((e) => {
        console.error('[auth-start] invio OTP in eccezione:', e instanceof Error ? e.message : e);
      });

    const er = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (er?.waitUntil) er.waitUntil(task);
    else await task;
  } else {
    console.log(`[auth-start] challenge decoy per telefono ${phoneHash.slice(0, 8)}…`);
  }

  const expiresIn = Math.max(
    0,
    Math.round((new Date(clean(inserted.expires_at)).getTime() - Date.now()) / 1000),
  );
  return ok({ challenge_id: inserted.id, expires_in: expiresIn });
});
