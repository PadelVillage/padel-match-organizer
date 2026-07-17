import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// consumer-player-readmodel — ponte dati READ-ONLY per l'assistente WhatsApp
// consumer (pilota F2.0 "chat giocatori"). Chiamato dal webhook dell'assistente
// (progetto Supabase separato) per rispondere a "quanto ho nel borsellino?" e
// "cosa ho prenotato?". Input { phone } → identifica il socio per telefono
// (match sulle ultime 10 cifre, come la rubrica) e ritorna saldo borsellino +
// prenotazioni future. NESSUNA scrittura: sola lettura di pmo_cloud_records
// (member / wallet_balance / booking / staff_booking).
//
// Autenticazione: la CI deploya con --no-verify-jwt, quindi il gate è l'header
// X-Consumer-Secret confrontato (in tempo costante) col secret condiviso
// CONSUMER_BRIDGE_SECRET. Secret assente in env → 503 (funzione disarmata).

type JsonMap = Record<string, unknown>;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-consumer-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_BOOKINGS = 10;

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

// Confronto in tempo costante (il secret è l'unico gate della funzione).
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

function phoneDigits(value: unknown): string {
  return clean(value).replace(/\D/g, '');
}

// Nome normalizzato per il match sui roster (le prenotazioni identificano i
// giocatori SOLO per nome, non c'è id/telefono nel payload).
function normName(value: unknown): string {
  return clean(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Data/ora correnti nel fuso del circolo (le date dei payload sono locali).
function romeNow(): { date: string; time: string } {
  const s = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());
  const [date, time] = s.split(' ');
  return { date, time };
}

type MemberHit = { id: string; name: string; firstName: string; surname: string };

function memberFromPayload(payload: JsonMap): MemberHit | null {
  const id = clean(payload.id);
  if (!id) return null;
  return {
    id,
    name: clean(payload.name),
    firstName: clean(payload.firstName),
    surname: clean(payload.surname),
  };
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
  if (!provided || !safeEqual(provided, bridgeSecret)) {
    return err(401, 'UNAUTHORIZED', 'X-Consumer-Secret assente o non valido.');
  }

  let body: JsonMap;
  try {
    body = await req.json();
  } catch {
    return err(400, 'BAD_JSON', 'Body non è JSON valido.');
  }

  const digits = phoneDigits(body.phone);
  if (digits.length < 9) {
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

  // ── 1. Identità: telefono → member (ultime 10 cifre) ────────────────────
  // Primo tentativo server-side (telefoni salvati senza separatori); se non
  // trova nulla NON si fa fallback fuzzy: numero sconosciuto → member null,
  // decide il chiamante (escalation allo staff).
  const { data: memberRows, error: memberErr } = await service
    .from('pmo_cloud_records')
    .select('payload')
    .eq('record_type', 'member')
    .not('deleted', 'is', true)
    .ilike('payload->>phone', `%${last10}`)
    .limit(5);
  if (memberErr) {
    console.error('[readmodel] errore query member:', memberErr.message);
    return err(500, 'DB_ERROR', 'Errore lettura anagrafica.');
  }

  const hits: MemberHit[] = [];
  for (const row of memberRows ?? []) {
    const p = (row.payload ?? {}) as JsonMap;
    const m = memberFromPayload(p);
    if (!m) continue;
    // Conferma in-code del match: evita falsi positivi dell'ilike.
    if (!phoneDigits(p.phone).endsWith(last10)) continue;
    hits.push(m);
  }

  if (hits.length === 0) {
    console.log(`[readmodel] nessun member per …${last10.slice(-4)}`);
    return ok({ member: null, reason: 'not_found' });
  }
  if (hits.length > 1) {
    console.warn(`[readmodel] match multiplo (${hits.length}) per …${last10.slice(-4)}`);
    return ok({ member: null, reason: 'ambiguous' });
  }
  const member = hits[0];

  // ── 2. Borsellino: wallet_balance via member_local_id (= member.id) ─────
  const { data: walletRows, error: walletErr } = await service
    .from('pmo_cloud_records')
    .select('payload')
    .eq('record_type', 'wallet_balance')
    .not('deleted', 'is', true)
    .eq('payload->>member_local_id', member.id)
    .limit(1);
  if (walletErr) {
    console.error('[readmodel] errore query wallet:', walletErr.message);
  }
  const walletPayload = (walletRows?.[0]?.payload ?? null) as JsonMap | null;
  const wallet = walletPayload
    ? {
        balance_cents: Number(walletPayload.balance_cents ?? 0),
        synced_at: clean(walletPayload.synced_at) || null,
      }
    : null;

  // ── 3. Prenotazioni future: name-match sul roster ───────────────────────
  const { date: today, time: nowTime } = romeNow();
  const { data: bookingRows, error: bookingErr } = await service
    .from('pmo_cloud_records')
    .select('record_type, payload')
    .in('record_type', ['booking', 'staff_booking'])
    .not('deleted', 'is', true)
    .gte('payload->>data', today)
    .limit(1000);
  if (bookingErr) {
    console.error('[readmodel] errore query bookings:', bookingErr.message);
    return err(500, 'DB_ERROR', 'Errore lettura prenotazioni.');
  }

  // Varianti del nome socio accettate nel roster (nome cognome / cognome nome).
  const nameVariants = new Set(
    [
      member.name,
      `${member.firstName} ${member.surname}`,
      `${member.surname} ${member.firstName}`,
    ].map(normName).filter(Boolean),
  );

  const seen = new Set<string>();
  const bookings: JsonMap[] = [];
  for (const row of bookingRows ?? []) {
    const p = (row.payload ?? {}) as JsonMap;
    const data = clean(p.data);
    const ora = clean(p.ora);
    // Oggi ma già passata → esclusa.
    if (data === today && ora && ora < nowTime) continue;

    const roster: string[] = [];
    if (Array.isArray(p.giocatori)) roster.push(...p.giocatori.map((g) => clean(g)));
    if (p.giocatore) roster.push(clean(p.giocatore));
    if (row.record_type === 'staff_booking' && p.nome) roster.push(clean(p.nome));
    const isMine = roster.some((g) => nameVariants.has(normName(g)));
    if (!isMine) continue;

    // Stessa prenotazione può esistere sia come booking sia come staff_booking.
    const key = `${data}|${ora}|${clean(p.campo)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    bookings.push({
      data,
      ora,
      ora_fine: clean(p.ora_fine) || null,
      campo: clean(p.campo),
      tipo: clean(p.tipo),
    });
  }
  bookings.sort((a, b) =>
    `${a.data} ${a.ora}`.localeCompare(`${b.data} ${b.ora}`));

  console.log(
    `[readmodel] …${last10.slice(-4)} → member ok, wallet=${wallet ? 'sì' : 'no'}, bookings=${bookings.length}`,
  );

  return ok({
    member: { id: member.id, name: member.name },
    wallet,
    bookings: bookings.slice(0, MAX_BOOKINGS),
    bookings_truncated: bookings.length > MAX_BOOKINGS,
    today,
  });
});
