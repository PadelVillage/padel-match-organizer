import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// consumer-booking-write — ponte SCRITTURE prenotazioni per l'assistente WhatsApp
// consumer (F2.1 «Prenota + Disdici via chat»). Chiamato dal webhook dell'assistente
// (progetto Supabase separato) DOPO la conferma a pulsanti del socio.
//
// Azioni:
// - availability: { phone, data, ora, durata? } → campi liberi nello slot (proposta).
// - create:       { phone, data, ora, durata?, campo } → prenotazione VERA via
//                 matchpoint-bookings-create (riuso: job/record/audit restano lì).
// - cancel:       { phone, data, ora, campo } → disdetta via matchpoint-bookings-cancel,
//                 SOLO se il socio è nel roster della prenotazione (ownership).
//
// Identità: telefono → member con la STESSA ricetta di consumer-player-readmodel
// (ultime 10 cifre su pmo_cloud_records/member). Nessun JWT consumer: gate =
// header X-Consumer-Secret confrontato in tempo costante con CONSUMER_BRIDGE_SECRET
// (stesso secret del readmodel: stessa coppia di fiducia webhook↔gestionale).
// Le chiamate alle edge matchpoint-bookings-* inoltrano lo stesso header (loro
// percorso interno consumer). Secret assente in env → 503 (funzione disarmata).

type JsonMap = Record<string, unknown>;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-consumer-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CAMPI = [1, 2, 3, 4];
const DURATA_DEFAULT = 90;          // minuti — lo slot padel standard
const DURATA_MIN = 30;
const DURATA_MAX = 180;
const ORARIO_APERTURA = '07:00';    // limiti larghi: l'autorità vera è Matchpoint
const ORARIO_CHIUSURA = '23:30';
const MAX_GIORNI_AVANTI = 30;
const SLOT_SCHEDULE_KEY = 'potentialSlotSchedule'; // app_setting.local_key: griglia orari operativa

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

function normName(value: unknown): string {
  return clean(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function romeNow(): { date: string; time: string } {
  const s = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());
  const [date, time] = s.split(' ');
  return { date, time };
}

function timeToMin(t: string): number {
  const [h, m] = String(t).split(':').map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}
function minToTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

type MemberHit = { id: string; memberId: string; name: string; firstName: string; surname: string };

type SlotInput = { data: string; ora: string; durata: number; oraFine: string };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS_HEADERS });
  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'Usare POST.');

  const bridgeSecret = clean(Deno.env.get('CONSUMER_BRIDGE_SECRET'));
  if (!bridgeSecret) return err(503, 'BRIDGE_DISARMED', 'CONSUMER_BRIDGE_SECRET non configurato.');
  const provided = clean(req.headers.get('x-consumer-secret'));
  if (!provided || !safeEqual(provided, bridgeSecret)) {
    return err(401, 'UNAUTHORIZED', 'X-Consumer-Secret assente o non valido.');
  }

  let body: JsonMap;
  try { body = await req.json(); } catch { return err(400, 'BAD_JSON', 'Body non è JSON valido.'); }

  const action = clean(body.action);
  if (!['availability', 'availability_day', 'create', 'cancel'].includes(action)) {
    return err(400, 'INVALID_ACTION', `Azione non ammessa: ${action || '(vuota)'}`);
  }

  // Identità: phone OPPURE member_id (mai insieme), stessa ricetta di
  // consumer-player-readmodel. Telegram non consegna il telefono: l'unico
  // appiglio è member_id (whitelist chat_id→member_id). whatsapp-webhook e il
  // consumer continuano a passare phone → retrocompatibile.
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) return err(503, 'MISSING_ENV', 'SUPABASE_URL/SERVICE_ROLE_KEY non configurati.');
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // ── Identità → member (per member_id o phone) ────────────────────────────
  let memberQuery = service
    .from('pmo_cloud_records')
    .select('payload')
    .eq('record_type', 'member')
    .not('deleted', 'is', true)
    .limit(5);
  memberQuery = memberIdInput
    ? memberQuery.eq('payload->>memberId', memberIdInput)
    : memberQuery.ilike('payload->>phone', `%${last10}`);
  const { data: memberRows, error: memberErr } = await memberQuery;
  if (memberErr) return err(500, 'DB_ERROR', 'Errore lettura anagrafica.');

  const hits: MemberHit[] = [];
  for (const row of memberRows ?? []) {
    const p = (row.payload ?? {}) as JsonMap;
    if (!clean(p.id)) continue;
    // Conferma in-code del match (evita falsi positivi dell'ilike / sorprese PostgREST).
    if (memberIdInput) {
      if (clean(p.memberId) !== memberIdInput) continue;
    } else if (!phoneDigits(p.phone).endsWith(last10)) continue;
    hits.push({
      id: clean(p.id),
      memberId: clean(p.memberId),
      name: clean(p.name),
      firstName: clean(p.firstName),
      surname: clean(p.surname),
    });
  }
  if (hits.length === 0) return ok({ member: null, reason: 'not_found' });
  if (hits.length > 1) return ok({ member: null, reason: 'ambiguous' });
  const member = hits[0];

  // ── availability_day: disponibilità di un INTERO giorno, fascia per fascia ─
  // Per ogni slot della griglia operativa (potentialSlotSchedule) del giorno, i
  // campi liberi = quelli senza prenotazione sovrapposta. Stessa griglia che
  // l'app mostra come "orari"; qui vi si incrocia l'occupazione (booking +
  // staff_booking, mirror del sync ~2 min: quasi-realtime, non al secondo).
  // È lettura pura; non tocca il Matchpoint. Blocco a sé: availability/create/
  // cancel restano identici sotto (loro validano data+ora, qui basta la data).
  if (action === 'availability_day') {
    const dayData = clean(body.data);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayData)) return err(400, 'INVALID_DATA', 'data deve essere YYYY-MM-DD.');
    const { date: today, time: nowTime } = romeNow();
    if (dayData < today) return err(400, 'SLOT_IN_PAST', 'Il giorno richiesto è nel passato.');
    const maxDate = new Date(`${today}T12:00:00Z`);
    maxDate.setUTCDate(maxDate.getUTCDate() + MAX_GIORNI_AVANTI);
    if (dayData > maxDate.toISOString().slice(0, 10)) {
      return err(400, 'SLOT_TOO_FAR', `Si può guardare al massimo a ${MAX_GIORNI_AVANTI} giorni.`);
    }

    // Griglia del giorno (indice 0=domenica, convenzione getDay()).
    const dow = new Date(`${dayData}T12:00:00Z`).getUTCDay();
    const { data: schedRows, error: schedErr } = await service
      .from('pmo_cloud_records')
      .select('payload')
      .eq('record_type', 'app_setting')
      .eq('local_key', SLOT_SCHEDULE_KEY)
      .not('deleted', 'is', true)
      .limit(1);
    if (schedErr) return err(500, 'DB_ERROR', 'Errore lettura griglia slot.');
    const schedule = (schedRows?.[0]?.payload as JsonMap | undefined)?.value as JsonMap | undefined;
    const rawSlots = schedule && Array.isArray(schedule[String(dow)])
      ? (schedule[String(dow)] as JsonMap[]) : [];

    // Prenotazioni del giorno → intervalli occupati per campo (ora_fine assente = +90').
    const { data: dayRows, error: dayErr } = await service
      .from('pmo_cloud_records')
      .select('record_type, payload')
      .in('record_type', ['booking', 'staff_booking'])
      .not('deleted', 'is', true)
      .eq('payload->>data', dayData)
      .limit(500);
    if (dayErr) return err(500, 'DB_ERROR', 'Errore lettura prenotazioni del giorno.');
    const occupied: { campo: number; startMin: number; endMin: number }[] = [];
    for (const row of dayRows ?? []) {
      const p = (row.payload ?? {}) as JsonMap;
      const campoNum = parseInt(String(p.campo ?? '').replace(/\D/g, ''), 10);
      const ora = clean(p.ora);
      if (!campoNum || !/^\d{2}:\d{2}$/.test(ora)) continue;
      const startMin = timeToMin(ora);
      const oraFine = clean(p.ora_fine);
      const endMin = /^\d{2}:\d{2}$/.test(oraFine) ? timeToMin(oraFine) : startMin + DURATA_DEFAULT;
      occupied.push({ campo: campoNum, startMin, endMin });
    }

    const nowMin = timeToMin(nowTime);
    const slots: JsonMap[] = [];
    for (const s of rawSlots) {
      const start = clean(s.start);
      const end = clean(s.end);
      if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) continue;
      const sStart = timeToMin(start);
      const sEnd = timeToMin(end);
      if (dayData === today && sStart <= nowMin) continue; // oggi: salta le fasce già iniziate
      const busy = new Set(
        occupied.filter((b) => b.startMin < sEnd && sStart < b.endMin).map((b) => b.campo),
      );
      const freeCampi = CAMPI.filter((c) => !busy.has(c));
      slots.push({ ora: start, ora_fine: end, free_campi: freeCampi, campi_totali: CAMPI.length });
    }

    console.log(`[booking-write] availability_day ${dayData} → ${slots.length} fasce per ${etichetta}`);
    return ok({ member: { id: member.id, name: member.name }, data: dayData, slots, today });
  }

  // ── Slot: validazione comune (data/ora/durata nel fuso del circolo) ───────
  const slotData = clean(body.data);
  const slotOra = clean(body.ora);
  const durataRaw = parseInt(String(body.durata ?? DURATA_DEFAULT), 10);
  const durata = Number.isFinite(durataRaw) ? durataRaw : DURATA_DEFAULT;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slotData)) return err(400, 'INVALID_DATA', 'data deve essere YYYY-MM-DD.');
  if (!/^\d{2}:\d{2}$/.test(slotOra)) return err(400, 'INVALID_ORA', 'ora deve essere HH:MM.');
  if (durata < DURATA_MIN || durata > DURATA_MAX) {
    return err(400, 'INVALID_DURATA', `durata deve essere tra ${DURATA_MIN} e ${DURATA_MAX} minuti.`);
  }
  const { date: today, time: nowTime } = romeNow();
  if (slotData < today || (slotData === today && slotOra < nowTime)) {
    return err(400, 'SLOT_IN_PAST', 'Lo slot richiesto è nel passato.');
  }
  const maxDate = new Date(`${today}T12:00:00Z`);
  maxDate.setUTCDate(maxDate.getUTCDate() + MAX_GIORNI_AVANTI);
  if (slotData > maxDate.toISOString().slice(0, 10)) {
    return err(400, 'SLOT_TOO_FAR', `Si può prenotare al massimo a ${MAX_GIORNI_AVANTI} giorni.`);
  }
  if (slotOra < ORARIO_APERTURA || slotOra > ORARIO_CHIUSURA) {
    return err(400, 'SLOT_OUT_OF_HOURS', `Orario fuori apertura (${ORARIO_APERTURA}–${ORARIO_CHIUSURA}).`);
  }
  const slot: SlotInput = {
    data: slotData,
    ora: slotOra,
    durata,
    oraFine: minToTime(timeToMin(slotOra) + durata),
  };

  // ── Occupazione del giorno (booking + staff_booking, mirror sync 2 min) ───
  const { data: dayRows, error: dayErr } = await service
    .from('pmo_cloud_records')
    .select('record_type, payload')
    .in('record_type', ['booking', 'staff_booking'])
    .not('deleted', 'is', true)
    .eq('payload->>data', slot.data)
    .limit(500);
  if (dayErr) return err(500, 'DB_ERROR', 'Errore lettura prenotazioni del giorno.');

  type DayBooking = { campo: number; startMin: number; endMin: number; roster: string[]; idReserva: string; ora: string };
  const dayBookings: DayBooking[] = [];
  for (const row of dayRows ?? []) {
    const p = (row.payload ?? {}) as JsonMap;
    const campoNum = parseInt(String(p.campo ?? '').replace(/\D/g, ''), 10);
    const ora = clean(p.ora);
    if (!campoNum || !/^\d{2}:\d{2}$/.test(ora)) continue;
    const startMin = timeToMin(ora);
    const oraFine = clean(p.ora_fine);
    const endMin = /^\d{2}:\d{2}$/.test(oraFine) ? timeToMin(oraFine) : startMin + DURATA_DEFAULT;
    const roster: string[] = [];
    if (Array.isArray(p.giocatori)) {
      roster.push(...p.giocatori.map((g: unknown) =>
        clean(typeof g === 'object' && g !== null ? (g as JsonMap).nome : g)));
    }
    if (p.giocatore) roster.push(clean(p.giocatore));
    if (p.nome) roster.push(clean(p.nome));
    dayBookings.push({
      campo: campoNum, startMin, endMin, roster, ora,
      idReserva: clean(p.id_reserva ?? p.idReserva),
    });
  }

  const slotStart = timeToMin(slot.ora);
  const slotEnd = slotStart + slot.durata;
  const overlaps = (b: DayBooking) => b.startMin < slotEnd && slotStart < b.endMin;

  // ── availability ──────────────────────────────────────────────────────────
  if (action === 'availability') {
    const busy = new Set(dayBookings.filter(overlaps).map((b) => b.campo));
    const freeCampi = CAMPI.filter((c) => !busy.has(c));
    console.log(`[booking-write] availability ${slot.data} ${slot.ora}+${slot.durata} → liberi [${freeCampi.join(',')}] per …${last10.slice(-4)}`);
    return ok({
      member: { id: member.id, name: member.name },
      slot: { data: slot.data, ora: slot.ora, ora_fine: slot.oraFine, durata: slot.durata },
      free_campi: freeCampi,
    });
  }

  const campo = parseInt(String(body.campo ?? ''), 10);
  if (!campo || !CAMPI.includes(campo)) return err(400, 'INVALID_CAMPO', 'campo deve essere 1-4.');

  const internalHeaders = {
    'Content-Type': 'application/json',
    'X-Consumer-Secret': bridgeSecret,
  };

  // ── create ────────────────────────────────────────────────────────────────
  if (action === 'create') {
    // Ricontrollo occupazione: il tap sul pulsante può arrivare dopo minuti.
    const taken = dayBookings.some((b) => b.campo === campo && overlaps(b));
    if (taken) return ok({ member: { id: member.id, name: member.name }, created: false, reason: 'slot_taken' });

    const res = await fetch(`${supabaseUrl}/functions/v1/matchpoint-bookings-create`, {
      method: 'POST',
      headers: internalHeaders,
      body: JSON.stringify({
        campo,
        data: slot.data,
        ora: slot.ora,
        oraFine: slot.oraFine,
        durata: slot.durata,
        nome: member.name,
        tipo: 'partita',
        note: 'Prenotata via chat WhatsApp',
        giocatori: [{ nome: member.name }],
      }),
    });
    const data = await res.json().catch(() => null) as JsonMap | null;
    if (!res.ok || !data?.ok) {
      console.error(`[booking-write] create KO HTTP ${res.status}:`, JSON.stringify(data).slice(0, 300));
      return ok({
        member: { id: member.id, name: member.name },
        created: false,
        reason: 'worker_error',
        detail: clean(data?.message ?? data?.error ?? `HTTP ${res.status}`).slice(0, 200),
      });
    }
    console.log(`[booking-write] create OK ${slot.data} ${slot.ora} C${campo} per ${member.name}`);
    return ok({
      member: { id: member.id, name: member.name },
      created: true,
      slot: { data: slot.data, ora: slot.ora, ora_fine: slot.oraFine, durata: slot.durata, campo },
    });
  }

  // ── cancel ────────────────────────────────────────────────────────────────
  // Ownership: si disdice SOLO una prenotazione col socio nel roster.
  const nameVariants = new Set(
    [member.name, `${member.firstName} ${member.surname}`, `${member.surname} ${member.firstName}`]
      .map(normName).filter(Boolean),
  );
  const target = dayBookings.find((b) =>
    b.campo === campo && b.ora === slot.ora &&
    b.roster.some((g) => nameVariants.has(normName(g))));
  if (!target) {
    return ok({ member: { id: member.id, name: member.name }, cancelled: false, reason: 'booking_not_found' });
  }

  const cancelPayload: JsonMap = target.idReserva
    ? { idReserva: target.idReserva }
    : { campo, data: slot.data, ora: slot.ora };
  const res = await fetch(`${supabaseUrl}/functions/v1/matchpoint-bookings-cancel`, {
    method: 'POST',
    headers: internalHeaders,
    body: JSON.stringify(cancelPayload),
  });
  const data = await res.json().catch(() => null) as JsonMap | null;
  if (!res.ok || !data?.ok) {
    console.error(`[booking-write] cancel KO HTTP ${res.status}:`, JSON.stringify(data).slice(0, 300));
    return ok({
      member: { id: member.id, name: member.name },
      cancelled: false,
      reason: 'worker_error',
      detail: clean(data?.message ?? data?.error ?? `HTTP ${res.status}`).slice(0, 200),
    });
  }
  console.log(`[booking-write] cancel OK ${slot.data} ${slot.ora} C${campo} per ${member.name}`);
  return ok({
    member: { id: member.id, name: member.name },
    cancelled: true,
    slot: { data: slot.data, ora: slot.ora, campo },
  });
});
