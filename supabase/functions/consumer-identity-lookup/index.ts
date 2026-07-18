import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// consumer-identity-lookup — ponte anagrafica READ-ONLY per il LOGIN dell'app
// consumer. Vive sul gestionale (dove sta l'anagrafica), viene chiamata solo
// dalle edge function del progetto consumer, mai dal browser.
//
// Due modalità, che corrispondono ai due passi del login:
//
//   identify  { phone }
//     → { found:false } | { found:true, candidates:[{index, first_name, has_email}] }
//     Restituisce SOLO il nome di battesimo. Mai il cognome: chi digita numeri
//     a caso non deve poter ricostruire l'elenco nome+cognome dei soci.
//
//   challenge { phone, candidate_index, email }
//     → { match:false } | { match:true, member_id, first_name, email_for_otp }
//     L'email digitata dal socio fa da secondo fattore: si CONFRONTA con quella
//     in scheda, non si accetta. L'indirizzo in anagrafica esce di qui solo se
//     il chiamante l'aveva già indovinato — così questa funzione non è mai un
//     oracolo per scoprire l'email di un socio a partire dal suo telefono.
//
// Chi può entrare: solo chi ha un memberId Matchpoint vero (6 cifre). I 1709
// contatti importati dalla rubrica Google e i record PMO- non sono clienti del
// circolo e restano fuori da soli, senza allow-list da mantenere.
//
// Autenticazione: la CI deploya con --no-verify-jwt, quindi il gate è l'header
// X-Consumer-Secret confrontato (in tempo costante) col secret condiviso
// CONSUMER_BRIDGE_SECRET, come consumer-player-readmodel. Secret assente in
// env → 503 (funzione disarmata).

type JsonMap = Record<string, unknown>;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-consumer-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Oltre questa soglia il telefono non identifica più una persona: non è una
// famiglia, è un numero sbagliato in anagrafica. Meglio non farlo entrare.
const MAX_CANDIDATES = 4;

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

// Confronto in tempo costante su stringhe di lunghezza nota e uguale.
function safeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function safeEqualText(a: string, b: string): boolean {
  const enc = new TextEncoder();
  return safeEqualBytes(enc.encode(a), enc.encode(b));
}

// Digest SHA-256. Serve per confrontare due email senza che la durata del
// confronto dipenda dal prefisso in comune NÉ dalla lunghezza: su input di
// lunghezza diversa un compare byte-a-byte uscirebbe subito, rivelando quanto
// è lunga l'email in scheda.
// `as unknown as BufferSource`: le lib TS recenti tipizzano Uint8Array come
// Uint8Array<ArrayBufferLike>, che non è assegnabile a BufferSource. A runtime
// è corretto; il cast tiene pulito `deno check`.
async function sha256(text: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    bytes as unknown as BufferSource,
  );
  return new Uint8Array(digest);
}

function phoneDigits(value: unknown): string {
  return clean(value).replace(/\D/g, '');
}

// Normalizzazione dell'email per il confronto: solo trim + minuscolo.
// Deliberatamente NON si tolgono i punti né il +tag di Gmail: sono indirizzi
// diversi e trattarli come uguali allargherebbe il secondo fattore.
function normEmail(value: unknown): string {
  return clean(value).toLowerCase();
}

// Le email tecniche @nomail.padelvillage.club sono segnaposto generati
// dall'import della rubrica: nessuna casella dietro, il codice non arriverebbe.
function isRealEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  if (email.endsWith('@nomail.padelvillage.club')) return false;
  return true;
}

type Candidate = {
  memberId: string;
  firstName: string;
  email: string;
};

// Nome di battesimo: firstName è popolato su tutti i 1042 soci Matchpoint,
// il fallback sul primo token di name serve solo a non restare senza saluto.
function firstNameOf(payload: JsonMap): string {
  const explicit = clean(payload.firstName);
  if (explicit) return explicit;
  return clean(payload.name).split(/\s+/)[0] ?? '';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return err(405, 'METHOD_NOT_ALLOWED', 'Usare POST.');
  }

  const bridgeSecret = clean(Deno.env.get('CONSUMER_BRIDGE_SECRET'));
  if (!bridgeSecret) {
    return err(503, 'BRIDGE_DISARMED', 'CONSUMER_BRIDGE_SECRET non configurato.');
  }
  const provided = clean(req.headers.get('x-consumer-secret'));
  if (!provided || !safeEqualText(provided, bridgeSecret)) {
    return err(401, 'UNAUTHORIZED', 'X-Consumer-Secret assente o non valido.');
  }

  let body: JsonMap;
  try {
    body = await req.json();
  } catch {
    return err(400, 'BAD_JSON', 'Body non è JSON valido.');
  }

  const mode = clean(body.mode);
  if (mode !== 'identify' && mode !== 'challenge') {
    return err(400, 'BAD_MODE', "Campo mode deve essere 'identify' o 'challenge'.");
  }

  const digits = phoneDigits(body.phone);
  if (digits.length < 10) {
    return err(400, 'BAD_PHONE', 'Campo phone mancante o troppo corto.');
  }
  const last10 = digits.slice(-10);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return err(503, 'MISSING_ENV', 'SUPABASE_URL/SERVICE_ROLE_KEY non configurati.');
  }
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // ── Candidati: telefono → soci Matchpoint (match sulle ultime 10 cifre) ──
  // I telefoni in anagrafica sono salvati senza separatori (verificato: 0 su
  // 1042 ne contengono), quindi l'ilike sul suffisso è affidabile; la conferma
  // in-code sulle sole cifre resta come rete di sicurezza.
  const { data: rows, error: queryErr } = await service
    .from('pmo_cloud_records')
    .select('payload')
    .eq('record_type', 'member')
    .not('deleted', 'is', true)
    .ilike('payload->>phone', `%${last10}`)
    .limit(20);
  if (queryErr) {
    console.error('[identity-lookup] errore query member:', queryErr.message);
    return err(500, 'DB_ERROR', 'Errore lettura anagrafica.');
  }

  const candidates: Candidate[] = [];
  for (const row of rows ?? []) {
    const p = (row.payload ?? {}) as JsonMap;
    const memberId = clean(p.memberId);
    // Solo clienti Matchpoint veri: l'id a 6 cifre è la regola d'accesso, ed è
    // già nei dati. Esclude i contatti Google (senza id) e i record PMO-.
    if (!/^[0-9]{6}$/.test(memberId)) continue;
    if (!phoneDigits(p.phone).endsWith(last10)) continue;
    const firstName = firstNameOf(p);
    if (!firstName) continue;
    candidates.push({ memberId, firstName, email: normEmail(p.email) });
  }

  // Ordinamento deterministico: il chiamante rimanda l'indice di questa stessa
  // lista al passo successivo, quindi l'ordine non può dipendere dal DB.
  candidates.sort((a, b) => a.memberId.localeCompare(b.memberId));

  if (candidates.length === 0) {
    console.log(`[identity-lookup] ${mode}: nessun socio per …${last10.slice(-4)}`);
    return mode === 'identify' ? ok({ found: false }) : ok({ match: false });
  }
  if (candidates.length > MAX_CANDIDATES) {
    console.warn(
      `[identity-lookup] ${candidates.length} soci sullo stesso telefono …${last10.slice(-4)}: anagrafica da correggere, accesso negato`,
    );
    return mode === 'identify' ? ok({ found: false }) : ok({ match: false });
  }

  // ── identify: solo il nome di battesimo ─────────────────────────────────
  if (mode === 'identify') {
    console.log(
      `[identity-lookup] identify …${last10.slice(-4)} → ${candidates.length} candidato/i`,
    );
    return ok({
      found: true,
      candidates: candidates.map((c, index) => ({
        index,
        first_name: c.firstName,
        // Serve al client per mandare alla segreteria chi non ha un indirizzo,
        // invece di chiedergli un'email che non potrebbe mai combaciare: un
        // canale di contatto non si aggiunge e si usa per autenticarsi nello
        // stesso momento.
        has_email: isRealEmail(c.email),
      })),
    });
  }

  // ── challenge: confronto dell'email digitata con quella in scheda ────────
  const index = Number(body.candidate_index ?? 0);
  const chosen = Number.isInteger(index) && index >= 0 && index < candidates.length
    ? candidates[index]
    : null;

  const typed = normEmail(body.email);
  let match = false;
  if (chosen && isRealEmail(chosen.email) && isRealEmail(typed)) {
    match = safeEqualBytes(await sha256(chosen.email), await sha256(typed));
  }

  if (!match || !chosen) {
    console.log(`[identity-lookup] challenge …${last10.slice(-4)} → email non combacia`);
    return ok({ match: false });
  }

  console.log(
    `[identity-lookup] challenge …${last10.slice(-4)} → socio ${chosen.memberId} confermato`,
  );
  return ok({
    match: true,
    member_id: chosen.memberId,
    first_name: chosen.firstName,
    email_for_otp: chosen.email,
  });
});
