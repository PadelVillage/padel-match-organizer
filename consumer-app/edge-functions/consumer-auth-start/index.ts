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

// Quante `identify` può fare lo stesso IP in un'ora. Difende l'ANAGRAFICA, non
// l'account: `identify` restituisce il solo nome di battesimo e non apre nulla,
// ma senza limite chi ha una lista di numeri scopre in pochi minuti quali sono
// soci del circolo. È un dato che rivela un'affiliazione: tema privacy.
//
// Perché 60 e non 6 come le challenge: la chiave qui è l'IP, e i soci che
// giocano al circolo stanno tutti dietro lo STESSO wifi. Un limite stretto li
// bloccherebbe a vicenda proprio nel posto dove useranno l'app. Sessanta
// lasciano respirare una ventina di persone in contemporanea e tagliano
// comunque l'estrazione di massa di due o tre ordini di grandezza.
//
// ⚠️ Mitigante, non barriera: chi ruota IP aggira. Alza il costo, non chiude.
const MAX_IDENTIFY_PER_HOUR = 60;

// Le challenge servono per il rate limit dell'ultima ora; oltre questo le righe
// sono solo residuo, e contengono l'email del socio. Purgate a ogni giro.
const PURGE_AFTER_HOURS = 24;

// Le righe di throttle non contengono nulla di utile oltre la finestra: si
// tengono un po' più di un'ora e via.
const THROTTLE_PURGE_AFTER_HOURS = 3;

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

// L'IP del chiamante, per il rate limit di `identify`.
//
// ⚠️ Si usa SOLO `cf-connecting-ip`, e la ragione è stata MISURATA, non dedotta.
// Prima versione di questa funzione: `x-real-ip` con fallback sull'ultimo
// elemento di `x-forwarded-for`. Provata mandando header falsificati e
// contando gli ip_hash prodotti: quattro richieste dallo stesso computer
// hanno prodotto QUATTRO bucket distinti. Cioè il client sceglieva la propria
// chiave di rate limit — un controllo che non controllava niente.
//
// `x-forwarded-for` e `x-real-ip` arrivano qui come li ha scritti il client.
// `cf-connecting-ip` no: falsificarlo fa respingere la richiesta con 403 dal
// proxy, prima ancora che arrivi a questa funzione (verificato). È l'unico
// valore che il chiamante non controlla, quindi è l'unico che vale.
//
// Se un giorno l'infrastruttura davanti cambiasse e l'header sparisse, il
// chiamante finirebbe nel ramo fail-open più sotto, che lo dice nei log.
function clientIp(req: Request): string {
  return clean(req.headers.get('cf-connecting-ip'));
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

  const supabaseUrl = clean(Deno.env.get('SUPABASE_URL'));
  const serviceKey = clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  if (!supabaseUrl || !serviceKey) {
    return err(503, 'MISSING_ENV', 'Variabili Supabase non configurate.');
  }
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const sinceHour = new Date(Date.now() - 3600_000).toISOString();

  // ── identify: telefono → nome di battesimo ──────────────────────────────
  if (step === 'identify') {
    const ip = clientIp(req);

    if (!ip) {
      // Fail-OPEN, e deliberatamente. Senza IP la chiave del contatore sarebbe
      // la stessa per tutti, e il limite si trasformerebbe in un tetto GLOBALE
      // di 60 identify/ora per l'intero circolo: un guasto peggiore di quello
      // che sto prevenendo. Resta un console.error perché non passi in
      // silenzio — se questa riga compare nei log, il rate limit non sta
      // proteggendo nulla e va sistemato il modo in cui leggo l'IP.
      console.error('[auth-start] IP non determinabile: identify servita SENZA rate limit');
    } else {
      const ipHash = await sha256Hex(ip);

      await service
        .from('consumer_identify_throttle')
        .delete()
        .lt('created_at', new Date(Date.now() - THROTTLE_PURGE_AFTER_HOURS * 3600_000).toISOString())
        .then(({ error }) => {
          if (error) console.warn('[auth-start] purge throttle fallita:', error.message);
        });

      const { count, error: throttleErr } = await service
        .from('consumer_identify_throttle')
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash)
        .gte('created_at', sinceHour);

      // Fail-CLOSED, al contrario del caso «IP assente» qui sopra: lì il
      // controllo non si poteva fare per tutti, qui non si è potuto fare per
      // uno. Un controllo che non è riuscito non è un via libera.
      if (throttleErr) {
        console.error('[auth-start] rate limit identify non verificabile:', throttleErr.message);
        return err(503, 'DB_ERROR', 'Servizio non disponibile, riprova tra poco.');
      }

      if ((count ?? 0) >= MAX_IDENTIFY_PER_HOUR) {
        // Qui il 429 è ESPLICITO, al contrario della challenge decoy: là tacere
        // serve a non trasformare l'app in un oracolo sulle email, qui non c'è
        // nessun segreto da proteggere e chi incappa nel limite è quasi sempre
        // un socio dietro il wifi del circolo. Dirgli «riprova più tardi» è
        // l'unica risposta che gli permette di capire cosa sta succedendo;
        // un `found:false` silenzioso lo manderebbe a pensare di non essere
        // in anagrafica, e in segreteria a chiedere perché.
        console.warn(`[auth-start] identify oltre soglia (${count}/h) per ip ${ipHash.slice(0, 8)}…`);
        return err(429, 'TOO_MANY_REQUESTS', 'Troppe richieste da questa rete. Riprova fra qualche minuto.');
      }

      // Si registrano solo le richieste SERVITE: contare anche quelle
      // respinte allungherebbe la finestra da sé a ogni nuovo tentativo, e a
      // restarci chiuso fuori sarebbe soprattutto il socio in buona fede.
      // Stesso ragionamento del rate limit delle challenge, più sotto.
      await service
        .from('consumer_identify_throttle')
        .insert({ ip_hash: ipHash })
        .then(({ error }) => {
          if (error) console.warn('[auth-start] insert throttle fallita:', error.message);
        });
    }

    const data = await callIdentityBridge({ mode: 'identify', phone: last10 });
    if (!data) return err(503, 'BRIDGE_DOWN', 'Servizio non disponibile, riprova tra poco.');
    return ok({
      found: data.found === true,
      candidates: Array.isArray(data.candidates) ? data.candidates : [],
    });
  }

  // ── challenge: confronto email + invio del codice ───────────────────────
  const anonKey = clean(Deno.env.get('SUPABASE_ANON_KEY'));
  if (!anonKey) {
    return err(503, 'MISSING_ENV', 'Variabili Supabase non configurate.');
  }

  const phoneHash = await sha256Hex(last10);

  // Residuo vecchio: contiene l'email del socio, non serve più a nulla.
  await service
    .from('consumer_login_challenges')
    .delete()
    .lt('created_at', new Date(Date.now() - PURGE_AFTER_HOURS * 3600_000).toISOString())
    .then(({ error }) => {
      if (error) console.warn('[auth-start] purge fallita:', error.message);
    });

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
