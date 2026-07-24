import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// consumer-player-readmodel — ponte dati READ-ONLY per gli assistenti dei SOCI
// (WhatsApp consumer F2.0 "chat giocatori" e, dal 24/07, il bot Telegram).
// Chiamato dal webhook dell'assistente (progetto Supabase separato) per
// rispondere a "quanto ho nel borsellino?", "cosa ho prenotato?", "con chi
// gioco?", "che livello ho?" e "a che ora si gioca?".
// NESSUNA scrittura: sola lettura di pmo_cloud_records (member / wallet_balance
// / booking / staff_booking / app_setting) e di pmo_ai_settings.
//
// Due azioni (body.action, assente = 'player' → comportamento storico):
//   'player' — { phone } OPPURE { member_id } → member + wallet + bookings
//   'kb'     — griglia slot operativa + base di conoscenza statica dell'assistente
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
// Un campo da padel ospita 4 giocatori: 8 è già il doppio del necessario e
// tiene corto il payload che finisce nel prompt del modello.
const MAX_COMPAGNI = 8;

// Base di conoscenza (azione 'kb').
const PROD_REF = 'qqbfphyslczzkxoncgex';        // stessa regola env di ai-settings
const KB_SETTINGS_KEY = 'assistant_kb';         // pmo_ai_settings.key
const SLOT_SCHEDULE_KEY = 'potentialSlotSchedule'; // pmo_cloud_records.local_key (app_setting)
// La griglia slot è indicizzata con la convenzione JS getDay() — 0 = domenica.
// Copiata da index.html:8134 (DAYS_IT) e da getDaySlots(), che fa schedule[getDay()].
// È la LEGENDA delle chiavi, non una copia degli orari: gli orari restano il dato.
const GIORNI_IT = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

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

// ROSTER AUTOREVOLE dei record `booking`: copia VERBATIM di playersFromDescrizione
// in matchpoint-bookings-sync/index.ts (unica regola, non una seconda). Estrae i
// nomi solo quando la descrizione è in formato lista "-Nome.-Nome." (inizia con
// '-'); i titoli liberi ("Torneo aziendale") non iniziano con '-' → [].
// Limite noto ed EREDITATO: uno split su '.' spezza i nomi che contengono un
// punto ("Alessandro Sir. Amato" → due voci). L'app mostra la stessa cosa: si
// preferisce restare identici al gestionale piuttosto che avere due parser.
function playersFromDescrizione(descr: unknown): string[] {
  const text = clean(descr);
  if (!text.startsWith('-')) return [];
  return text
    .split('.')
    .map((s) => s.replace(/^-+/, '').trim())
    .filter(Boolean);
}

// Roster di una prenotazione: nomi (per il match e per i compagni) e codici
// socio a 6 cifre, quando ci sono. Misurato su PROD il 24/07 (finestra 60gg):
//  · booking      → `descrizione` sempre presente (144/144) ed è l'unica fonte
//                   del roster in 53 record su 144; `giocatori` è un array di
//                   STRINGHE quando c'è; `giocatore` è l'intestatario.
//  · staff_booking→ `giocatori` sempre presente (94/94), con OGGETTI
//                   {nome, codice?, codiceCliente?} in 86 record e stringhe in 20;
//                   nessuna `descrizione`. `nome` è la lista dei giocatori unita
//                   da virgole e TRONCATA: serve solo al match storico, mai come
//                   compagno (per questo esce da `joined`).
// Prima di questa versione gli oggetti passavano da clean() e diventavano
// "[object Object]": il roster c'era ma era illeggibile, e il socio non vedeva
// le proprie partite a 4 create dallo staff.
function rosterFromPayload(recordType: string, p: JsonMap): {
  names: string[];
  codes: string[];
  joined: string[];
} {
  const names: string[] = [];
  const codes: string[] = [];
  const joined: string[] = [];

  for (const n of playersFromDescrizione(p.descrizione)) names.push(n);

  if (Array.isArray(p.giocatori)) {
    for (const g of p.giocatori as unknown[]) {
      if (g && typeof g === 'object') {
        const o = g as JsonMap;
        const nome = clean(o.nome);
        if (nome) names.push(nome);
        const codice = clean(o.codice) || clean(o.codiceCliente);
        if (/^[0-9]{6}$/.test(codice)) codes.push(codice);
      } else {
        const nome = clean(g);
        if (nome) names.push(nome);
      }
    }
  }

  if (p.giocatore) names.push(clean(p.giocatore));
  if (recordType === 'staff_booking' && p.nome) joined.push(clean(p.nome));

  return {
    names: names.filter(Boolean),
    codes,
    joined: joined.filter(Boolean),
  };
}

type MemberHit = {
  id: string;
  memberId: string;
  name: string;
  firstName: string;
  surname: string;
  level: string;
};

function memberFromPayload(payload: JsonMap): MemberHit | null {
  const id = clean(payload.id);
  if (!id) return null;
  return {
    id,
    memberId: clean(payload.memberId),
    name: clean(payload.name),
    firstName: clean(payload.firstName),
    surname: clean(payload.surname),
    level: clean(payload.level),
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

  // action assente = 'player': i chiamanti storici non mandano il campo.
  const action = clean(body.action).toLowerCase() || 'player';
  if (action !== 'player' && action !== 'kb') {
    return err(400, 'BAD_ACTION', "action ammesse: 'player' (default) o 'kb'.");
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return err(503, 'MISSING_ENV', 'SUPABASE_URL/SERVICE_ROLE_KEY non configurati.');
  }
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { date: today, time: nowTime } = romeNow();

  // ── Azione 'kb': orari operativi + informazioni statiche ─────────────────
  // Gli ORARI non sono mai ricopiati nel prompt né in assistant_kb: la griglia
  // è già un dato del sistema (app_setting/potentialSlotSchedule, alimentato da
  // matchpoint-slot-schedule-sync). Una terza copia divergerebbe — le due
  // esistenti già divergono su venerdì e domenica.
  if (action === 'kb') {
    const env = supabaseUrl.includes(PROD_REF) ? 'prod' : 'test';
    const [slotRes, kbRes] = await Promise.all([
      service
        .from('pmo_cloud_records')
        .select('payload')
        .eq('record_type', 'app_setting')
        .eq('local_key', SLOT_SCHEDULE_KEY)
        .not('deleted', 'is', true)
        .limit(1),
      service
        .from('pmo_ai_settings')
        .select('value, updated_at')
        .eq('env', env)
        .eq('key', KB_SETTINGS_KEY)
        .limit(1),
    ]);
    if (slotRes.error) {
      console.error('[readmodel] errore query slot:', slotRes.error.message);
      return err(500, 'DB_ERROR', 'Errore lettura griglia slot.');
    }
    if (kbRes.error) {
      console.error('[readmodel] errore query kb:', kbRes.error.message);
      return err(500, 'DB_ERROR', 'Errore lettura base di conoscenza.');
    }
    const slotPayload = (slotRes.data?.[0]?.payload ?? null) as JsonMap | null;
    const slotSchedule = (slotPayload?.value ?? null) as JsonMap | null;
    const kbRow = kbRes.data?.[0] ?? null;

    console.log(
      `[readmodel] kb env=${env} slot=${slotSchedule ? 'sì' : 'no'} kb=${kbRow ? 'sì' : 'no'}`,
    );

    return ok({
      env,
      slot_schedule: slotSchedule,
      slot_schedule_legenda: GIORNI_IT,
      kb: kbRow?.value ?? null,
      kb_updated_at: kbRow?.updated_at ?? null,
      today,
    });
  }

  // ── 1. Identità ──────────────────────────────────────────────────────────
  // Due vie alternative, mai insieme:
  //  · phone     — ultime 10 cifre (rubrica). La usa il consumer WhatsApp.
  //  · member_id — codice socio Matchpoint a 6 cifre (payload.memberId). Serve
  //    a Telegram, che NON consegna il numero di telefono: l'unico appiglio è
  //    una whitelist chat_id → member_id. Stesso formato di consumer_profiles e
  //    di consumer-identity-lookup (i memberId "PMO-…" generati dall'app non
  //    sono soci Matchpoint e restano fuori).
  const memberIdInput = clean(body.member_id);
  const digits = phoneDigits(body.phone);
  const last10 = digits.slice(-10);

  if (memberIdInput && digits) {
    return err(400, 'AMBIGUOUS_INPUT', 'Indicare phone OPPURE member_id, non entrambi.');
  }
  if (memberIdInput) {
    if (!/^[0-9]{6}$/.test(memberIdInput)) {
      return err(400, 'BAD_MEMBER_ID', 'member_id deve essere il codice socio a 6 cifre.');
    }
  } else if (digits.length < 9) {
    return err(400, 'BAD_PHONE', 'Campo phone mancante o troppo corto (oppure usare member_id).');
  }

  const etichetta = memberIdInput ? `socio ${memberIdInput}` : `…${last10.slice(-4)}`;

  let query = service
    .from('pmo_cloud_records')
    .select('payload')
    .eq('record_type', 'member')
    .not('deleted', 'is', true)
    .limit(5);
  query = memberIdInput
    ? query.eq('payload->>memberId', memberIdInput)
    : query.ilike('payload->>phone', `%${last10}`);

  const { data: memberRows, error: memberErr } = await query;
  if (memberErr) {
    console.error('[readmodel] errore query member:', memberErr.message);
    return err(500, 'DB_ERROR', 'Errore lettura anagrafica.');
  }

  const hits: MemberHit[] = [];
  for (const row of memberRows ?? []) {
    const p = (row.payload ?? {}) as JsonMap;
    const m = memberFromPayload(p);
    if (!m) continue;
    // Conferma in-code del match: evita falsi positivi dell'ilike (e, sul
    // percorso member_id, qualunque sorpresa del confronto lato PostgREST).
    if (memberIdInput) {
      if (m.memberId !== memberIdInput) continue;
    } else if (!phoneDigits(p.phone).endsWith(last10)) continue;
    hits.push(m);
  }

  if (hits.length === 0) {
    console.log(`[readmodel] nessun member per ${etichetta}`);
    return ok({ member: null, reason: 'not_found' });
  }
  if (hits.length > 1) {
    console.warn(`[readmodel] match multiplo (${hits.length}) per ${etichetta}`);
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

  // Stessa prenotazione può esistere sia come booking sia come staff_booking,
  // ma il campo NON è scritto uguale ("Campo 1" dal sync MP, "1" dallo
  // staff_booking ottimistico del percorso consumer): la chiave usa solo le
  // cifre, altrimenti la lista raddoppia e i reply-button escono con id
  // duplicati (Meta #131009, invio rifiutato). Il primo record vinto definisce
  // data/ora/campo/tipo; dai gemelli si prendono solo i compagni mancanti,
  // perché le due copie hanno roster di completezza diversa.
  const byKey = new Map<string, JsonMap>();
  const compagniByKey = new Map<string, Map<string, string>>();
  const order: string[] = [];

  for (const row of bookingRows ?? []) {
    const p = (row.payload ?? {}) as JsonMap;
    const data = clean(p.data);
    const ora = clean(p.ora);
    // Oggi ma già passata → esclusa.
    if (data === today && ora && ora < nowTime) continue;

    const roster = rosterFromPayload(clean(row.record_type), p);
    const isMine = roster.names.some((g) => nameVariants.has(normName(g)))
      || roster.joined.some((g) => nameVariants.has(normName(g)))
      // Match per CODICE socio: esatto e senza rischio omonimi. Presente solo
      // su una minoranza dei roster a oggetti, quindi è in aggiunta, mai in
      // sostituzione del match per nome.
      || (!!member.memberId && roster.codes.includes(member.memberId));
    if (!isMine) continue;

    const key = `${data}|${ora}|${clean(p.campo).replace(/\D/g, '')}`;

    // Compagni = SOLO nome e cognome degli altri giocatori (brief §7.2): niente
    // codici, niente telefoni, niente email. Il socio stesso non è un compagno.
    // `roster.joined` (la stringa "Nome1, Nome2, …" troncata di staff_booking)
    // non entra mai qui: servirebbe un compagno inventato a metà.
    let compagni = compagniByKey.get(key);
    if (!compagni) { compagni = new Map<string, string>(); compagniByKey.set(key, compagni); }
    for (const nome of roster.names) {
      const nn = normName(nome);
      if (!nn || nameVariants.has(nn) || compagni.has(nn)) continue;
      compagni.set(nn, nome);
    }

    if (byKey.has(key)) continue;
    byKey.set(key, {
      data,
      ora,
      ora_fine: clean(p.ora_fine) || null,
      campo: clean(p.campo),
      tipo: clean(p.tipo),
    });
    order.push(key);
  }

  const bookings: JsonMap[] = order.map((key) => ({
    ...(byKey.get(key) as JsonMap),
    compagni: [...(compagniByKey.get(key)?.values() ?? [])].slice(0, MAX_COMPAGNI),
  }));
  bookings.sort((a, b) =>
    `${a.data} ${a.ora}`.localeCompare(`${b.data} ${b.ora}`));

  console.log(
    `[readmodel] ${etichetta} → member ok, wallet=${wallet ? 'sì' : 'no'}, bookings=${bookings.length}`,
  );

  return ok({
    member: {
      id: member.id,
      member_id: member.memberId || null,
      name: member.name,
      // Livello: proprietà dell'APP (Matchpoint lo riceve, non lo detta).
      // 0.5 è il valore di partenza delle schede nuove, cioè "da definire":
      // stessa regola del gestionale (index.html, filtro "Livello 0.5 dopo
      // autovalutazione" e conteggio "da completare"). Si espone il flag così
      // l'assistente non annuncia "il tuo livello è 0.5".
      level: member.level || null,
      level_assessed: !!member.level && member.level !== '0.5',
    },
    wallet,
    bookings: bookings.slice(0, MAX_BOOKINGS),
    bookings_truncated: bookings.length > MAX_BOOKINGS,
    today,
  });
});
