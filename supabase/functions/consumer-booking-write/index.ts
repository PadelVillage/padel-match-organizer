import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Chi gioca in uno slot sta in un modulo a parte perché è la parte che ha già sbagliato due
// volte, e sepolta qui dentro non era provabile: ora i payload VERI di PROD si danno in pasto
// alla funzione senza scrivere niente da nessuna parte (`roster-slot.test.ts`).
import {
  clean,
  normName,
  listeDaPayload,
  nomiDellaRiga,
  restanoSoloOspiti,
  rosterDelloSlot,
  senzaDiMe,
  sostituito,
  type RigaSlot,
} from './roster-slot.ts';

// consumer-booking-write — ponte SCRITTURE prenotazioni per l'assistente dei soci
// (oggi il bot Telegram). Chiamato dall'assistente DOPO la conferma a pulsanti del socio.
//
// Azioni:
// - availability: { phone, data, ora, durata? } → campi liberi nello slot (proposta).
// - create:       { phone, data, ora, durata?, campo } → prenotazione VERA via
//                 matchpoint-bookings-create (riuso: job/record/audit restano lì).
// - cancel:       { phone, data, ora, campo } → disdetta via matchpoint-bookings-cancel,
//                 SOLO se il socio è nel roster della prenotazione (ownership).
// - leave:        { member_id, data, ora, campo } → RITIRO DELLA PRESENZA: toglie il solo
//                 socio dal roster via matchpoint-bookings-edit. La partita RESTA in piedi
//                 per gli altri. Rifiuta se il socio è l'unico giocatore (lì servirebbe una
//                 disdetta, che resta alla segreteria).
//                 🧪 `dry_run: true` → PROVA A VUOTO: fa tutto (trova la prenotazione,
//                 ricompone il roster su tutte le righe dello slot, applica le stesse
//                 guardie, sceglie il nome da togliere) e si ferma UN PASSO PRIMA della
//                 scrittura, dicendo cosa avrebbe fatto. Esiste perché questo percorso
//                 altrimenti non gira MAI prima della produzione: l'assistente in
//                 simulazione non arriva nemmeno a chiamare il ponte, e chiamarlo da TEST
//                 non è innocuo — le edge non hanno simulazione, e a valle worker e sistema
//                 del circolo sono UNO SOLO, condiviso con la produzione.
//                 🚨 `left` resta `false`: chi non conosce il campo `dry_run` legge «non è
//                 successo niente», che è la verità. L'equivoco cade dalla parte sicura.
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

// 🚨⭐ «Una partita chiusa è formata da QUATTRO giocatori» — regola del committente
// (26/07/2026), detta guardando un roster che ne contava cinque. Non è un limite che
// imponiamo noi: è com'è fatto il padel, e proprio per questo un conteggio SUPERIORE è la
// prova che abbiamo letto male il dato — non che c'è un quinto giocatore in campo.
// Vive qui e non nella kb perché non è una regola del circolo che cambia (le finestre e le
// soglie stanno nella kb): è la forma del gioco, come i 4 campi qui sopra.
const GIOCATORI_PARTITA = 4;

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
  if (!['availability', 'availability_day', 'create', 'cancel', 'leave'].includes(action)) {
    return err(400, 'INVALID_ACTION', `Azione non ammessa: ${action || '(vuota)'}`);
  }

  // 🧪 Prova a vuoto (oggi solo per `leave`). Deve essere chiesta ESPLICITAMENTE con un
  // booleano vero: qualunque altra cosa — «true», 1, la chiave assente — vale spento, così
  // un refuso non trasforma una scrittura vera in una prova silenziosa (né viceversa).
  const dryRun = body.dry_run === true;
  if (dryRun && action !== 'leave') {
    return err(400, 'DRY_RUN_NOT_SUPPORTED', `La prova a vuoto esiste solo per «leave», non per «${action}».`);
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

  type DayBooking = RigaSlot & { campo: number; startMin: number; endMin: number; idReserva: string; ora: string; tipo: string };
  const dayBookings: DayBooking[] = [];
  for (const row of dayRows ?? []) {
    const p = (row.payload ?? {}) as JsonMap;
    const campoNum = parseInt(String(p.campo ?? '').replace(/\D/g, ''), 10);
    const ora = clean(p.ora);
    if (!campoNum || !/^\d{2}:\d{2}$/.test(ora)) continue;
    const startMin = timeToMin(ora);
    const oraFine = clean(p.ora_fine);
    const endMin = /^\d{2}:\d{2}$/.test(oraFine) ? timeToMin(oraFine) : startMin + DURATA_DEFAULT;
    dayBookings.push({
      campo: campoNum, startMin, endMin, ora,
      // Le tre forme del roster e il ripiego sul `nome` troncato stanno in `roster-slot.ts`,
      // dove sono provate sui payload veri. ⭐ Liste SEPARATE, mai un elenco solo: è ciò che
      // permette di contare due «Ospite» come due persone invece che come una.
      liste: listeDaPayload(p),
      // La scheda del circolo (`-Nome.-Nome.`): c'è sulle righe sincronizzate, mai sugli
      // `staff_booking`. Serve solo quando le due copie si contraddicono, ma va portata fin
      // qui perché a valle le righe sono già state ridotte a questo tipo.
      descrizione: clean(p.descrizione),
      idReserva: clean(p.id_reserva ?? p.idReserva),
      tipo: clean(p.tipo),
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

  // Varianti del nome socio accettate nel roster (serve a `leave` e a `cancel`):
  // il gestionale scrive ora «Nome Cognome», ora «Cognome Nome».
  const nameVariants = new Set(
    [member.name, `${member.firstName} ${member.surname}`, `${member.surname} ${member.firstName}`]
      .map(normName).filter(Boolean),
  );

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

  // ── leave: RITIRO DELLA PRESENZA ──────────────────────────────────────────
  // Il socio esce da una partita che RESTA in piedi per gli altri: si toglie un solo
  // nome dal roster, non si disdice il campo. Due differenze da `cancel`:
  //  · la prenotazione sopravvive e torna INCOMPLETA (riaccende gli avvisi di scadenza);
  //  · se il socio è l'UNICO giocatore qui non si fa nulla: uscire da soli equivarrebbe a
  //    disdire, e per quello il chiamante usa `cancel`. Regola del committente (26/07):
  //    si annulla una partita SOLO se non c'è nessun altro dentro — nessuno può far
  //    sparire il campo agli altri tre, che il bot non ha modo di avvisare.
  //
  // 🚨 Il roster va ricomposto su TUTTE le righe dello stesso slot: una partita di quattro
  // sono QUATTRO record `booking`, e uno solo porta l'elenco completo (verificato sui dati
  // veri il 26/07). Contando i giocatori su una riga sola si direbbe «sei solo» a chi solo
  // non è, e gli si proporrebbe di annullare la partita degli altri.
  if (action === 'leave') {
    // 🧪 Su ogni risposta di `leave`, quando la prova a vuoto è accesa, si rimanda indietro
    // `dry_run: true`. Serve a chi prova: se quel campo non torna, la richiesta è arrivata a
    // una versione dell'edge che la prova a vuoto non ce l'ha — e uno zero sarebbe stato
    // letto come «tutto a posto» invece che come «non ho misurato niente».
    const prova = dryRun ? { dry_run: true } : {};
    const righe = dayBookings.filter((b) => b.campo === campo && b.ora === slot.ora);
    // Ultimo cancello prima della scrittura: da una LEZIONE non si esce da soli (il
    // maestro e la segreteria vanno avvisati). Il bot già non mostra il bottone; qui
    // si difende anche dal bot sbagliato.
    if (righe.some((b) => /lezione/i.test(b.tipo))) {
      return ok({ member: { id: member.id, name: member.name }, left: false, reason: 'non_e_una_partita', ...prova });
    }
    // 🚨⭐ La rete del «mai più di quattro», chiesta dal committente il 26/07 dopo aver
    // visto un roster da cinque: se ne contiamo più di GIOCATORI_PARTITA, il dato non è
    // sbagliato — è la NOSTRA lettura a esserlo, perché la copia in app e le righe
    // sincronizzate raccontano la stessa partita in due momenti diversi.
    // ⭐ Decisione del committente lo stesso giorno, davanti alla misura: in quel caso non ci
    // si ferma più, si prendono i quattro dalla SCHEDA DEL CIRCOLO, che è l'unica aggiornata.
    // Ci si ferma solo se nemmeno quella ne dà esattamente quattro. Tutto in `roster-slot.ts`.
    const esito = rosterDelloSlot(righe, GIOCATORI_PARTITA);
    const rosterUnito = esito.roster;
    if (esito.incoerente) {
      console.error(`[booking-write] leave roster INCOERENTE ${slot.data} ${slot.ora} C${campo}: ${esito.unione.size} nomi su ${righe.length} righe, e la scheda del circolo non ne dà ${GIOCATORI_PARTITA} → ${[...esito.unione.values()].join(' | ')}`);
      return ok({
        member: { id: member.id, name: member.name },
        left: false,
        reason: 'roster_incoerente',
        giocatori: esito.unione.size,
        ...prova,
      });
    }
    if (esito.fonte === 'circolo') {
      console.log(`[booking-write] leave vale la SCHEDA DEL CIRCOLO ${slot.data} ${slot.ora} C${campo}: la nostra copia ne dà ${esito.unione.size}, la scheda ${rosterUnito.length} → ${rosterUnito.join(' | ')}`);
    }
    // Il nome da togliere è quello COME LO SCRIVE il gestionale, non `member.name`: a valle
    // il confronto è per nome, e le due forme possono differire.
    const mioNome = [...esito.chiavi.entries()].find(([nn]) => nameVariants.has(nn))?.[1];
    if (!mioNome) {
      // ⭐ Due «non ci sei» molto diversi. Se il socio risulta nella nostra copia ma la scheda
      // del circolo non lo elenca, è stato SOSTITUITO: la partita la vede ancora nel proprio
      // elenco, e rispondergli «non la trovo» sarebbe un vicolo cieco. Glielo si dice.
      if (sostituito(esito, nameVariants)) {
        console.log(`[booking-write] leave ${slot.data} ${slot.ora} C${campo}: ${member.name} è nella nostra copia ma non nella scheda del circolo → sostituito`);
        return ok({ member: { id: member.id, name: member.name }, left: false, reason: 'non_piu_in_partita', ...prova });
      }
      return ok({ member: { id: member.id, name: member.name }, left: false, reason: 'booking_not_found', ...prova });
    }
    if (rosterUnito.length < 2) {
      return ok({
        member: { id: member.id, name: member.name },
        left: false,
        reason: 'unico_giocatore',
        giocatori: rosterUnito.length,
        ...prova,
      });
    }

    // 🚨⭐⭐ Decisione del committente (27/07): se uscendo NON resta in campo nessun socio —
    // gli altri sono tutti ospiti — la partita non si lascia dal bot, la gestisce la
    // segreteria. Quei giocatori il circolo non li conosce: il bot non può avvisarli, nessuno
    // di loro può disdire, e il campo resterebbe occupato senza un socio dietro.
    // ⭐ Sta QUI e non nel bot perché è una regola del circolo, e il conteggio di chi è in
    // campo lo decide il gestionale: due sedi che la calcolano finirebbero per divergere,
    // com'è già successo col conteggio degli «Ospite».
    const restanti = senzaDiMe(rosterUnito, mioNome);
    if (restanoSoloOspiti(restanti)) {
      console.log(`[booking-write] leave SOLO OSPITI ${slot.data} ${slot.ora} C${campo}: uscendo ${mioNome} non resterebbe nessun socio (${restanti.length} ospiti) → segreteria`);
      return ok({
        member: { id: member.id, name: member.name },
        left: false,
        reason: 'solo_ospiti',
        giocatori: rosterUnito.length,
        ...prova,
      });
    }

    // 🧪 Qui finisce la prova a vuoto: tutto ciò che sta SOPRA è già stato eseguito per
    // davvero — le righe dello slot, il roster ricomposto, le guardie, il nome scelto —
    // e sotto c'è l'unica riga che tocca qualcosa. Fermarsi altrove proverebbe un
    // percorso diverso da quello che poi succederà in produzione.
    if (dryRun) {
      console.log(`[booking-write] leave PROVA A VUOTO ${slot.data} ${slot.ora} C${campo}: toglierei ${mioNome} (in ${rosterUnito.length}, su ${righe.length} righe)`);
      return ok({
        member: { id: member.id, name: member.name },
        left: false,
        dry_run: true,
        would: {
          remove: mioNome,
          slot: { data: slot.data, ora: slot.ora, campo },
          giocatori_prima: rosterUnito.length,
          restano: rosterUnito.length - 1,
          // Le due misure che hanno smascherato il difetto del 26/07: quante RIGHE
          // compongono la partita, e il roster ricomposto su tutte.
          righe: righe.length,
          roster: [...rosterUnito],
          // Da dove vengono i giocatori: `nostra` = le righe concordavano; `circolo` = si
          // contraddicevano e ha vinto la scheda aggiornata. Senza questo campo una prova a
          // vuoto che dà quattro nomi non dice QUALE dei due percorsi ha girato.
          fonte: esito.fonte,
          sommando_le_righe: esito.unione.size,
          id_reserva: righe[0]?.idReserva || null,
        },
      });
    }

    const resLeave = await fetch(`${supabaseUrl}/functions/v1/matchpoint-bookings-edit`, {
      method: 'POST',
      headers: internalHeaders,
      body: JSON.stringify({
        ...(righe[0]?.idReserva ? { idReserva: righe[0].idReserva } : {}),
        campo,
        data: slot.data,
        ora: slot.ora,
        players: { remove: [mioNome] },
      }),
    });
    const dataLeave = await resLeave.json().catch(() => null) as JsonMap | null;
    if (!resLeave.ok || !dataLeave?.ok) {
      console.error(`[booking-write] leave KO HTTP ${resLeave.status}:`, JSON.stringify(dataLeave).slice(0, 300));
      return ok({
        member: { id: member.id, name: member.name },
        left: false,
        reason: 'worker_error',
        detail: clean(dataLeave?.message ?? dataLeave?.error ?? `HTTP ${resLeave.status}`).slice(0, 200),
      });
    }
    console.log(`[booking-write] leave OK ${slot.data} ${slot.ora} C${campo}: esce ${mioNome} (erano in ${rosterUnito.length})`);
    return ok({
      member: { id: member.id, name: member.name },
      left: true,
      slot: { data: slot.data, ora: slot.ora, campo },
      giocatori_prima: rosterUnito.length,
      restano: rosterUnito.length - 1,
    });
  }

  // ── cancel ────────────────────────────────────────────────────────────────
  // Ownership: si disdice SOLO una prenotazione col socio nel roster.
  const target = dayBookings.find((b) =>
    b.campo === campo && b.ora === slot.ora &&
    nomiDellaRiga(b).some((g) => nameVariants.has(normName(g))));
  if (!target) {
    return ok({ member: { id: member.id, name: member.name }, cancelled: false, reason: 'booking_not_found' });
  }

  // 🚨 Si annulla SOLO una partita in cui non c'è nessun altro (regola del committente,
  // 26/07). Con altri dentro il socio può al massimo USCIRE (`leave`); chi vuole comunque
  // annullare passa dalla segreteria. Motivo: l'annullamento toglie il campo anche agli
  // altri, che l'assistente non ha modo di avvisare — Telegram non consente di scrivere a
  // chi non ha mai scritto al bot. Il roster si conta su TUTTE le righe dello slot.
  // ⭐ La stessa lettura di `leave`, con la stessa rete: si conta su TUTTE le righe dello
  // slot, e se le due copie si contraddicono vale la scheda del circolo. Qui non cambia
  // l'ESITO — con più di un giocatore si rifiuta comunque — ma cambia il MOTIVO, e dire «ci
  // sono altri 4 giocatori» quando il quinto l'abbiamo inventato noi manda il socio a
  // cercare qualcuno che non c'è.
  const esitoCancel = rosterDelloSlot(
    dayBookings.filter((b) => b.campo === campo && b.ora === slot.ora),
    GIOCATORI_PARTITA,
  );
  const rosterSlot = esitoCancel.roster;
  if (esitoCancel.incoerente) {
    console.error(`[booking-write] cancel roster INCOERENTE ${slot.data} ${slot.ora} C${campo}: ${esitoCancel.unione.size} nomi, e la scheda del circolo non ne dà ${GIOCATORI_PARTITA}`);
    return ok({
      member: { id: member.id, name: member.name },
      cancelled: false,
      reason: 'roster_incoerente',
      giocatori: esitoCancel.unione.size,
    });
  }
  if (rosterSlot.length > 1) {
    console.log(`[booking-write] cancel rifiutato ${slot.data} ${slot.ora} C${campo}: in ${rosterSlot.length}`);
    return ok({
      member: { id: member.id, name: member.name },
      cancelled: false,
      reason: 'ci_sono_altri_giocatori',
      giocatori: rosterSlot.length,
    });
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
