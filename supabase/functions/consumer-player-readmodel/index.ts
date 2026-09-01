import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  clean,
  compagniDelloSlot,
  normName,
  playersFromDescrizione,
  rosterFromPayload,
  copiaNostra,
  ordineDelloSlot,
  inCampoDelloSlot,
} from './compagni-slot.ts';
// 🆕 VOCE 80 (30/08) — chi la segreteria ha appena tolto non deve restare in campo per due
// minuti. Il fatto non si deduce dalle liste: lo dice il gestionale (`staff_edit`).
import {
  mappaIdReserva, rimozioniDaStaffEdit, rimossiDopoIlSync, togliRimossi, istanteDelCircolo,
} from './rimozioni-recenti.ts';
import { clienteDelCircolo } from './cliente-del-circolo.ts';
import { livelloDimostrato } from './livello-dimostrato.ts';
/* 🆕🔓 VOCE 88 (01/09/2026) — le regole delle «Partite Aperte», nello STESSO modulo che usa
 * `consumer-booking-write` per ammettere. Se le due copie divergessero, questa vetrina
 * mostrerebbe partite in cui poi il gestionale non fa entrare — e il socio non leggerebbe
 * «non puoi», leggerebbe «non ha funzionato». */
import {
  TIPO_RECORD_APERTURA, chiaveApertura, decidiIngresso, GIOCATORI_PARTITA, MOTIVI as MOTIVI_APERTA,
} from './partita-aperta.ts';

// consumer-player-readmodel — ponte dati READ-ONLY per gli assistenti dei SOCI
// (WhatsApp consumer F2.0 "chat giocatori" e, dal 24/07, il bot Telegram).
// Chiamato dal webhook dell'assistente (progetto Supabase separato) per
// rispondere a "quanto ho nel borsellino?", "cosa ho prenotato?", "con chi
// gioco?", "che livello ho?" e "a che ora si gioca?".
// NESSUNA scrittura: sola lettura di pmo_cloud_records (member / wallet_balance
// / booking / staff_booking / app_setting) e di pmo_ai_settings.
//
// Due azioni (body.action, assente = 'player' → comportamento storico):
//   'player' — { pmo_player_id } OPPURE { phone } OPPURE { member_id }
//              → member + wallet + bookings
//   'kb'     — griglia slot operativa + base di conoscenza statica dell'assistente
//
// 🆕 2/08/2026 — `pmo_player_id` («ID giocatore Padel Village», PMO-000000) è la via
// NUOVA, aggiunta accanto alle due esistenti senza toccarle. La risposta riporta sempre
// `member.pmo_player_id`, così chi oggi chiama per telefono o per codice Matchpoint può
// imparare il codice nuovo e passare alla via nuova gradualmente.
//
// 🆕⭐⭐ E riporta `member.puo_prenotare`: il ponte DICHIARA se quella persona è cliente
// del circolo, invece di lasciarlo dedurre dalla presenza del codice Matchpoint. Regola
// del committente (2/08): nel bot il codice Matchpoint non deve entrare, perché Matchpoint
// un giorno non ci sarà più. Chi parla col circolo è questo ponte: la domanda sta qui.
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
/* 🆕 VOCE 80 — quanto indietro si guardano le operazioni della segreteria.
 * ⭐ 15 minuti: il ritardo del sync ha mediana ~2′ e massimo MISURATO 10′04″ (voce 53), e
 * questo numero deve stargli SOPRA con margine, o la correzione scade prima del dato che
 * deve correggere. Non di più: oltre, il circolo ha parlato e la verità è la sua.
 * ⚖️ Non è una soglia inventata — è la stessa misura su cui poggia `roster-di-recente.ts`
 * nel bot, che tiene il ricordo per quindici minuti per la stessa ragione. */
const RIMOZIONI_FINESTRA_MIN = 15;
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
// `clean` e `normName` stanno nel modulo `compagni-slot.ts` (vedi l'import in testa):
// sono le stesse che decidono chi è compagno di chi, e una copia locale finirebbe
// prima o poi per divergere da quella.

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

// `normName` — nome normalizzato per il match sui roster (le prenotazioni
// identificano i giocatori SOLO per nome, non c'è id/telefono nel payload) —
// arriva ora dal modulo `compagni-slot.ts` insieme alla regola dei compagni:
// una definizione sola, così non possono divergere.

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

// `playersFromDescrizione` e `rosterFromPayload` stanno nel modulo `compagni-slot.ts`
// (import in testa): sono la lettura del roster, cioè la stessa regola che decide chi
// gioca — e stando in un modulo puro si possono provare coi payload VERI di PRODUZIONE
// senza deployare niente e senza scrivere niente.

type MemberHit = {
  id: string;
  memberId: string;
  pmoPlayerId: string;
  name: string;
  firstName: string;
  surname: string;
  level: string;
  /** Da dove viene il livello. Serve a distinguere un livello dimostrato da uno in PRESTITO. */
  levelSource: string;
};

function memberFromPayload(payload: JsonMap): MemberHit | null {
  const id = clean(payload.id);
  if (!id) return null;
  return {
    id,
    memberId: clean(payload.memberId),
    // 🆔 «ID giocatore Padel Village» — il NOSTRO, assegnato a tutti i soci il 2/08/2026
    // (PROD 2784/2787, TEST 2831/2833). È il perno che sopravvive al distacco da Matchpoint.
    pmoPlayerId: clean(payload.pmoPlayerId),
    name: clean(payload.name),
    firstName: clean(payload.firstName),
    surname: clean(payload.surname),
    level: clean(payload.level),
    levelSource: clean(payload.levelSource),
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
  if (action !== 'player' && action !== 'kb' && action !== 'people' && action !== 'aperte') {
    return err(400, 'BAD_ACTION', "action ammesse: 'player' (default), 'kb', 'people' o 'aperte'.");
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

  // ── Azione 'people': le schede di un ELENCO, e SOLO quattro campi ────────
  //
  // 🚨⭐⭐ ESISTE PER DIVULGARE POCO, non per comodità — 5/08/2026, con la rubrica del bot.
  // La rubrica mostra quattro dati (nome, cognome, livello, sesso) e l'unica strada che
  // c'era, l'azione 'player', ne torna molti di più: partite, borsellino, permesso di
  // prenotare. Usarla per disegnare una riga vorrebbe dire far passare le PRENOTAZIONI DI
  // TERZI ogni volta che qualcuno apre la rubrica.
  // ⇒ Un'azione che sa dire poco è una difesa. Chi un domani ci aggiungesse un campo deve
  //   chiedersi non «serve?» ma «serve a disegnare una riga di rubrica?».
  //
  // ⚖️ Perché non c'è nessun controllo su CHI chiede: questo ponte non sa cos'è una rubrica
  // — le rubriche vivono nel database del bot, non nel gestionale. Il permesso lo tiene il
  // bot, che chiede solo gli id che stanno nella rubrica di chi sta guardando. Qui la
  // difesa è il gate `X-Consumer-Secret` più il fatto che gli id non si indovinano.
  // 🚨 E il tetto: un elenco lunghissimo diventerebbe un modo per scaricare l'anagrafica a
  // fette. Sopra il tetto si RIFIUTA — non si tronca in silenzio.
  if (action === 'people') {
    const MAX_PERSONE = 100;
    const grezzi = Array.isArray(body.ids) ? body.ids : [];
    const ids = [...new Set(grezzi.map((v) => clean(v)).filter(Boolean))];
    if (!ids.length) return ok({ people: [] });
    if (ids.length > MAX_PERSONE) {
      return err(400, 'TOO_MANY_IDS', `Al massimo ${MAX_PERSONE} id per volta.`);
    }

    const { data: righe, error: peopleErr } = await service
      .from('pmo_cloud_records')
      .select('payload')
      .eq('record_type', 'member')
      .not('deleted', 'is', true)
      .in('payload->>id', ids)
      .limit(MAX_PERSONE);
    if (peopleErr) {
      console.error('[readmodel] errore query people:', peopleErr.message);
      return err(500, 'DB_ERROR', 'Errore lettura anagrafica.');
    }

    const people = (righe ?? []).map((row) => {
      const p = (row.payload ?? {}) as JsonMap;
      const level = clean(p.level);
      // Il sesso si passa solo se è uno dei due che sappiamo leggere. 📊 Sul bersaglio
      // (TEST, 5/08/2026) `gender` c'è su 2.793 schede su 2.793: M 2.122 · F 670 · «NA» 1.
      // Quel «NA» è il caso per cui questa riga non è pedanteria — passato così com'è,
      // diventerebbe un segno inventato accanto al nome di una persona vera.
      const g = clean(p.gender).toUpperCase();
      return {
        id: clean(p.id),
        nome: clean(p.firstName),
        cognome: clean(p.surname),
        level: level || null,
        // Stessa regola dell'azione 'player', e ora deliberatamente la stessa FUNZIONE:
        // erano due righe gemelle scritte a mano in due punti lontani del file, ed è la
        // forma in cui una divergenza non si vede finché non fa danno — un livello
        // annunciato in rubrica e negato nella scheda del socio.
        // 🚨 Il modulo esiste perché la domanda non è «c'è un numero?» ma «l'ha
        // dimostrato?»: il giorno dei livelli ereditati sono due cose diverse.
        level_assessed: livelloDimostrato(level, p.levelSource),
        gender: g === 'M' || g === 'F' ? g : null,
        // 🆕🚨⭐⭐ 6/08/2026 — «l'Ospite lo può mettere solamente la segreteria», sua decisione,
        // che ribalta quella del 30/07. ⇒ Chi non è cliente del circolo non può più entrare in
        // una partita accettando un invito, e il bot deve saperlo PRIMA di disegnare il bottone:
        // la regola ferma del progetto è che un bottone che non può funzionare non si mostra.
        // ⭐ La stessa funzione che già risponde a `puo_prenotare` nell'azione 'player': una
        // domanda sola («il circolo ce l'ha fra i suoi clienti?»), una riga sola che la decide.
        // 📊 Misurato su PROD il 6/08: **1.081 su 2.797 (38,6%)** sono clienti. Il `false` è il
        // caso FREQUENTE, e chi lo legge non deve trattarlo come un guasto.
        cliente_del_circolo: clienteDelCircolo(p.memberId),
      };
    }).filter((p) => p.id);

    console.log(`[readmodel] people: ${ids.length} chiesti, ${people.length} trovati`);
    return ok({ people });
  }

  // ── 1. Identità ──────────────────────────────────────────────────────────
  // TRE vie alternative, mai insieme:
  //  · pmo_player_id — 🆕 2/08/2026, «ID giocatore Padel Village» (payload.pmoPlayerId),
  //    formato PMO-000000. ⭐ È la via NUOVA e destinata a diventare l'unica: sua regola
  //    ferma, «l'ID che il bot deve leggere è l'ID PMO, non quello Matchpoint», perché un
  //    giorno da Matchpoint ci staccheremo e quel numero non ci sarà più.
  //  · phone     — ultime 10 cifre (rubrica). La usa il consumer WhatsApp.
  //  · member_id — codice socio Matchpoint a 6 cifre (payload.memberId). Serve
  //    a Telegram, che NON consegna il numero di telefono: l'unico appiglio è
  //    una whitelist chat_id → member_id. Stesso formato di consumer_profiles e
  //    di consumer-identity-lookup (i memberId "PMO-…" generati dall'app non
  //    sono soci Matchpoint e restano fuori).
  //
  // 🚨⭐ Le due vie vecchie NON si toccano, e l'ordine non è opinabile: prima i ponti
  // imparano la via nuova, poi il bot ci passa sopra, e solo alla fine — se servirà — si
  // toglie la vecchia. Toglierla adesso spegnerebbe il riconoscimento ai soci veri, in
  // produzione, perché il bot vivo cerca ancora per member_id.
  const pmoPlayerIdInput = clean(body.pmo_player_id).toUpperCase();
  const memberIdInput = clean(body.member_id);
  const digits = phoneDigits(body.phone);
  const last10 = digits.slice(-10);

  // 🆕⭐⭐ 9/08/2026 — IL member_id PUÒ VIAGGIARE INSIEME AL pmo_player_id, e solo con lui.
  // È il RIPIEGO deciso dal committente dopo che la prima socia vera entrata nel bot è
  // rimasta invisibile per undici ore: il suo `PMO-000583` appartiene ANCHE a un altro
  // socio (24 codici condivisi da 48 persone su PROD, misurati), il ponte trovava due
  // schede vive e si rifiutava di scegliere — giustamente, ed è la difesa che impedisce
  // di servirle le partite di un altro.
  // ⭐ Col codice del circolo accanto non si indovina: si RESTRINGE. Il pmoPlayerId resta
  // la via primaria; il member_id entra in gioco SOLO quando la prima ne trova più d'una.
  // 🚨 Il telefono resta ESCLUSIVO: è la via del consumer WhatsApp e non c'entra niente.
  if (digits && (pmoPlayerIdInput || memberIdInput)) {
    return err(400, 'AMBIGUOUS_INPUT', 'Il campo phone non si combina con pmo_player_id o member_id.');
  }
  if (pmoPlayerIdInput && !/^PMO-[0-9]{6}$/.test(pmoPlayerIdInput)) {
    return err(400, 'BAD_PMO_PLAYER_ID', 'pmo_player_id deve avere la forma PMO-000000.');
  }
  if (memberIdInput && !/^[0-9]{6}$/.test(memberIdInput)) {
    return err(400, 'BAD_MEMBER_ID', 'member_id deve essere il codice socio a 6 cifre.');
  }
  if (!pmoPlayerIdInput && !memberIdInput && digits.length < 9) {
    return err(400, 'BAD_PHONE', 'Campo phone mancante o troppo corto (oppure usare pmo_player_id o member_id).');
  }

  const etichetta = pmoPlayerIdInput
    ? `giocatore ${pmoPlayerIdInput}${memberIdInput ? ` (socio ${memberIdInput})` : ''}`
    : memberIdInput
    ? `socio ${memberIdInput}`
    : `…${last10.slice(-4)}`;

  let query = service
    .from('pmo_cloud_records')
    .select('payload')
    .eq('record_type', 'member')
    .not('deleted', 'is', true)
    .limit(5);
  query = pmoPlayerIdInput
    ? query.eq('payload->>pmoPlayerId', pmoPlayerIdInput)
    : memberIdInput
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
    // Conferma in-code del match: evita falsi positivi dell'ilike (e, sui
    // percorsi per codice, qualunque sorpresa del confronto lato PostgREST).
    if (pmoPlayerIdInput) {
      if (m.pmoPlayerId.toUpperCase() !== pmoPlayerIdInput) continue;
    } else if (memberIdInput) {
      if (m.memberId !== memberIdInput) continue;
    } else if (!phoneDigits(p.phone).endsWith(last10)) continue;
    hits.push(m);
  }

  if (hits.length === 0) {
    console.log(`[readmodel] nessun member per ${etichetta}`);
    return ok({ member: null, reason: 'not_found' });
  }
  // ⭐ Il ripiego: due schede vive con lo stesso ID giocatore si distinguono col codice
  // del circolo, se il chiamante l'ha mandato. Restringe un `ambiguous` che c'era già —
  // non può cambiare una risposta che oggi è giusta, perché entra solo quando le schede
  // sono più d'una. Se anche così ne restano due, si torna a rifiutare.
  if (hits.length > 1 && pmoPlayerIdInput && memberIdInput) {
    const ristretti = hits.filter((m) => m.memberId === memberIdInput);
    if (ristretti.length === 1) {
      console.log(
        `[readmodel] ${etichetta}: ${hits.length} schede con lo stesso ID giocatore, ristretto a una col codice socio ${memberIdInput}`,
      );
      hits.length = 0;
      hits.push(ristretti[0]);
    }
  }
  if (hits.length > 1) {
    console.warn(`[readmodel] match multiplo (${hits.length}) per ${etichetta}`);
    return ok({ member: null, reason: 'ambiguous' });
  }
  const member = hits[0];

  /* ── 🔓 Azione 'aperte': LA VETRINA delle Partite Aperte (voce 88) ────────────────────────
   *
   * 🚨⭐⭐ ESISTE PER MOSTRARE POCO, esattamente come 'people' — e qui la posta è più alta.
   * Regola ① del committente: chi non fa parte di una partita ne vede **solo i numeri**
   * («3 su 4 · lunedì 18:30 · Intermedio») e **mai un nome**. Non è pudore: la serratura sui
   * ~2.800 soci che `rubrica.ts` tiene chiusa la si scardina benissimo da una vetrina, un
   * roster per volta, senza che nessuno se ne accorga.
   * ⇒ Da qui non esce NESSUN nome — né dei giocatori, né di chi ha aperto. Escono un
   * conteggio, un quando, un dove e un livello. Chi un domani ci aggiungesse un campo deve
   * chiedersi non «serve?» ma «serve a disegnare la riga di una partita che non è sua?».
   *
   * ⭐ E il LIVELLO esce come NUMERO, che è giusto e va detto perché sembra il contrario: al
   * socio il livello non si dice a numeri (regola ferma del progetto), ma questo è il confine
   * fra due macchine — la parola la mette il bot con `parolaDelLivello`, che quella tabella
   * ce l'ha già. Mandare la parola da qui vorrebbe dire una QUARTA copia della scala.
   *
   * ⚖️ Si elenca SOLO ciò in cui questo socio può davvero entrare, e la decisione è la stessa
   * funzione che poi lo ammette (`decidiIngresso`, dal modulo condiviso). Mostrare una partita
   * per poi rifiutarla al tocco sarebbe un bottone che non può funzionare — e il socio non
   * legge «non puoi», legge «non ha funzionato».
   */
  if (action === 'aperte') {
    const { data: aperteRows, error: aperteErr } = await service
      .from('pmo_cloud_records')
      .select('payload')
      .eq('record_type', TIPO_RECORD_APERTURA)
      .not('deleted', 'is', true)
      .gte('payload->>data', today)
      .limit(200);
    if (aperteErr) {
      console.error('[readmodel] errore query aperture:', aperteErr.message);
      return err(500, 'DB_ERROR', 'Errore lettura partite aperte.');
    }
    const aperture = (aperteRows ?? []).map((r) => (r.payload ?? {}) as JsonMap)
      // Oggi ma già passata → fuori, stessa regola delle prenotazioni qui sotto.
      .filter((a) => {
        const d = clean(a.data); const o = clean(a.ora);
        return d && o && !(d === today && o < nowTime);
      });
    if (!aperture.length) {
      return ok({ aperte: [], quante: 0, serve_il_test: false });
    }

    /* Le schede di CHI HA APERTO, rilette adesso: nell'apertura il livello non è scritto, di
     * proposito. Una fotografia del livello continuerebbe a filtrare col numero vecchio il
     * giorno in cui la segreteria lo corregge — e funzionerebbe benissimo, solo attorno al
     * centro sbagliato. */
    const idsOrg = [...new Set(aperture.map((a) => clean(a.aperta_da_member_local_id)).filter(Boolean))];
    const { data: orgRows, error: orgErr } = await service
      .from('pmo_cloud_records')
      .select('payload')
      .eq('record_type', 'member')
      .not('deleted', 'is', true)
      .in('payload->>id', idsOrg)
      .limit(200);
    if (orgErr) {
      console.error('[readmodel] errore query schede di chi ha aperto:', orgErr.message);
      return err(500, 'DB_ERROR', 'Errore lettura anagrafica.');
    }
    /* 🚨 FAIL CLOSED sugli omonimi d'archivio: un id che risolve a più di una scheda non ha
     * un livello leggibile, e una banda senza centro non si mostra a nessuno. */
    const schedePerId = new Map<string, JsonMap | null>();
    for (const row of orgRows ?? []) {
      const p = (row.payload ?? {}) as JsonMap;
      const id = clean(p.id);
      if (!id) continue;
      schedePerId.set(id, schedePerId.has(id) ? null : p);
    }

    // I roster degli slot interessati, per contare i posti. Si contano ADESSO: quello che il
    // bot ricordava può avere giorni.
    const dateInGioco = [...new Set(aperture.map((a) => clean(a.data)).filter(Boolean))];
    const { data: righeSlot, error: slotErr } = await service
      .from('pmo_cloud_records')
      .select('record_type, payload')
      .in('record_type', ['booking', 'staff_booking'])
      .not('deleted', 'is', true)
      .in('payload->>data', dateInGioco)
      .limit(1000);
    if (slotErr) {
      console.error('[readmodel] errore query slot delle aperture:', slotErr.message);
      return err(500, 'DB_ERROR', 'Errore lettura prenotazioni.');
    }
    const listePerChiave = new Map<string, string[][]>();
    for (const row of righeSlot ?? []) {
      const p = (row.payload ?? {}) as JsonMap;
      const chiave = chiaveApertura(p.data, p.ora, p.campo);
      if (!chiave) continue;
      const roster = rosterFromPayload(clean(row.record_type), p);
      const liste = listePerChiave.get(chiave);
      if (liste) liste.push(...roster.liste);
      else listePerChiave.set(chiave, [...roster.liste]);
    }

    const mieVarianti = new Set(
      [member.name, `${member.firstName} ${member.surname}`, `${member.surname} ${member.firstName}`]
        .map(normName).filter(Boolean),
    );

    const visibili: JsonMap[] = [];
    let conPosto = 0;
    let serveIlTest = false;
    for (const a of aperture) {
      const chiave = chiaveApertura(a.data, a.ora, a.campo);
      const liste = listePerChiave.get(chiave);
      // ⛔ Un'apertura la cui partita non esiste più (annullata, spostata) NON si mostra: il
      // posto libero di una partita che non c'è è la promessa peggiore che si possa fare.
      if (!chiave || !liste) continue;
      const inCampo = inCampoDelloSlot(liste, GIOCATORI_PARTITA);
      const schedaOrg = schedePerId.get(clean(a.aperta_da_member_local_id)) ?? null;
      const decisione = decidiIngresso({
        aperta: !!schedaOrg,
        organizzatore: { level: schedaOrg?.level, levelSource: schedaOrg?.levelSource },
        candidato: { level: member.level, levelSource: member.levelSource, memberId: member.memberId },
        giocatoriInCampo: inCampo.length,
        giaInPartita: inCampo.some((n) => mieVarianti.has(normName(n))),
        clienteDelCircolo: clienteDelCircolo(member.memberId),
      });
      if (inCampo.length < GIOCATORI_PARTITA) conPosto += 1;
      /* ⭐⭐ `serve_il_test` NON è un rifiuto come gli altri, ed è la ragione per cui la
       * decisione ① è stata scelta fra le tre: è l'unico che ha una STRADA in fondo. Il bot lo
       * traduce in «ce ne sono, e il test dura cinque minuti» — cioè la partita aperta diventa
       * il primo motivo vero per fare il test, che è quello che si voleva. */
      if (!decisione.ok) {
        if (decisione.motivo === MOTIVI_APERTA.SERVE_IL_TEST) serveIlTest = true;
        continue;
      }
      visibili.push({
        data: clean(a.data),
        ora: clean(a.ora),
        campo: Number(String(a.campo ?? '').replace(/\D/g, '')) || null,
        giocatori: inCampo.length,
        posti_liberi: GIOCATORI_PARTITA - inCampo.length,
        posti_totali: GIOCATORI_PARTITA,
        // ⭐ Il livello di chi ha aperto: è il centro della banda, e la parola la mette il bot.
        livello: clean(schedaOrg?.level) || null,
      });
    }
    // In ordine di quando si gioca: una vetrina disordinata la si legge una volta sola.
    visibili.sort((x, y) => `${x.data}|${x.ora}`.localeCompare(`${y.data}|${y.ora}`));

    console.log(`[readmodel] aperte per ${etichetta}: ${aperture.length} vive, ${visibili.length} visibili, serve_il_test=${serveIlTest}`);
    return ok({
      aperte: visibili,
      /* ⚖️ Un CONTEGGIO e nient'altro, e solo quando la vetrina è vuota per il livello: è la
       * frase «ce ne sono, ma ti serve il livello» resa possibile senza dire di CHI né QUANDO.
       * Un numero non è un nome, e senza di lui l'invito al test sarebbe una supposizione. */
      quante: conPosto,
      serve_il_test: serveIlTest && !visibili.length,
    });
  }

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

  /* 🆕⚡ VOCE 80 (30/08, dopo la prova) — LA QUERY PARTE PRIMA E SI ASPETTA DOPO.
   * 📏 Misurato su PROD appena la cura è andata in servizio, perché il committente ha notato
   * che «ci mette un po' più di tempo»: media **400 → 536 ms**, cioè **+136 ms** su ogni
   * apertura di `/prenotazioni`. Non era un'impressione.
   * ⭐ E si toglie quasi tutto senza rinunciare a niente: questa lettura **non dipende** da
   * quella delle prenotazioni — le due domande sono indipendenti, era solo il codice a metterle
   * in fila. Partendo insieme, il costo è il massimo delle due invece della somma.
   * 📌 *Prima di pagare un dato con del tempo, guardare se quel tempo è davvero necessario o
   * solo l'ordine in cui è stato scritto.* */
  const staffEditP = service
    .from('pmo_cloud_records')
    .select('record_type, payload, synced_at')
    .eq('record_type', 'staff_edit')
    .not('deleted', 'is', true)
    .gte('synced_at', new Date(Date.now() - RIMOZIONI_FINESTRA_MIN * 60_000).toISOString())
    .limit(200);

  // ── 3. Prenotazioni future: name-match sul roster ───────────────────────
  const { data: bookingRows, error: bookingErr } = await service
    .from('pmo_cloud_records')
    // 🆕⏱️ 21/08/2026 — `synced_at` ESCE, ed è la freschezza di QUESTA riga.
    // 🗣️ Nasce da un caso vero: il committente toglie due giocatori dal bot, ne rimette uno
    // dal gestionale, e il bot continua a non mostrarlo. Il bot nasconde per 15 minuti chi ha
    // appena tolto (il sync ci mette ~2 minuti a recepire, e senza quel ricordo il socio
    // rivedrebbe la persona appena tolta) e si arrende solo quando quella persona sparisce dal
    // dato. Ma se qualcun ALTRO la rimette, lei nel dato c'è — e il ricordo la nasconde lo
    // stesso, per tutti i quindici minuti.
    // ⇒ Il bot non può distinguere «il sync non ha ancora recepito la mia rimozione» da
    // «qualcuno l'ha rimessa dopo» finché non sa QUANDO quel dato è stato aggiornato.
    // ⚖️ E lo deve dire il gestionale, non dedurlo il bot: *il gestionale SA, il bot DICE*.
    // È la stessa freschezza che `consumer-booking-write` azione `verifica` usa già per
    // rispondere «no» con certezza — qui serve alla stessa domanda, fatta da un altro lato.
    .select('record_type, payload, synced_at')
    .in('record_type', ['booking', 'staff_booking'])
    .not('deleted', 'is', true)
    .gte('payload->>data', today)
    .limit(1000);
  if (bookingErr) {
    console.error('[readmodel] errore query bookings:', bookingErr.message);
    return err(500, 'DB_ERROR', 'Errore lettura prenotazioni.');
  }

  /* 🆕⭐⭐ VOCE 80 — LE OPERAZIONI DELLA SEGRETERIA, in una query SUA e non nella precedente.
   *
   * ⚠️ Non si potevano aggiungere alla `.in(...)` qui sopra, e la ragione è un dato: quella
   * query filtra `.gte('payload->>data', today)`, e uno `staff_edit` **non ha `data` di primo
   * livello** — la sua sta dentro `da: {data, ora, campo}`, e solo nel 37% dei casi. Infilarlo
   * là avrebbe tolto di mezzo proprio le righe che servono, in silenzio.
   * ⭐ La finestra è corta di proposito (`RIMOZIONI_FINESTRA_MIN`): serve a coprire il ritardo
   * del sync (mediana ~2′, massimo misurato 10′04″), non a tenere una memoria. Passata quella,
   * il dato del circolo è arrivato ed è lui la verità.
   * ⛔ Un errore qui NON fa fallire la risposta: si perde la correzione, non le prenotazioni.
   *   È il verso giusto — senza questa lettura si torna al comportamento di prima. */
  const { data: staffEditRows, error: staffEditErr } = await staffEditP;
  if (staffEditErr) {
    console.error('[readmodel] staff_edit non letti (voce 80):', staffEditErr.message);
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
  const listeByKey = new Map<string, string[][]>();
  /**
   * ⏱️ Il `synced_at` PIÙ RECENTE fra le righe di ogni slot.
   * ⭐ Il massimo e non il minimo: dice «l'ultima volta che il circolo mi ha raccontato questa
   * partita», che è la domanda a cui serve rispondere. Il minimo direbbe quanto è vecchia la
   * riga più stantia, che è un'altra cosa e servirebbe a un'altra domanda.
   * ⚠️ Gli `staff_booking` non arrivano dal sync — il loro `synced_at` è l'istante in cui li
   * abbiamo scritti noi — e vanno bene lo stesso: anche quello è «quando questo dato è stato
   * toccato l'ultima volta», ed è ciò che il bot deve confrontare col proprio ricordo.
   */
  const frescoByKey = new Map<string, string>();
  /**
   * 🚨⭐⭐ VOCE 80 — QUANDO HA PARLATO **IL CIRCOLO**, che NON è `frescoByKey`.
   *
   * 📏 Trovato dalla prova fisica del 30/08 e non dal banco, perché il banco non poteva
   * vederlo: al modulo puro il `sincronizzatoAl` glielo passavo io. Sul caso vero —
   * `booking` 21:10:04 · `staff_edit {remove:[Ospite]}` 21:12:12 · `staff_booking` **21:12:14**
   * — la rimozione risultava PIÙ VECCHIA della freschezza dello slot, e la cura non mordeva.
   * ⚖️ E non era sfortuna: quella copia la scrive **la stessa operazione** che produce la
   * rimozione, sempre un istante dopo ⇒ la cura non avrebbe morso **mai**. Strutturale.
   * 📌 `frescoByKey` si chiama «fresco» e si documenta come *«l'ultima volta che il circolo mi
   * ha raccontato questa partita»*, ma contiene anche le copie NOSTRE: risponde a *«quando
   * questo dato è stato toccato»*, che è un'altra domanda. È la trappola del campo letto per
   * come si chiama, e mi ci sono fidato.
   * ⇒ Qui entrano SOLO le righe sincronizzate, ed è l'orologio giusto per decidere se una
   * rimozione il circolo l'ha già recepita.
   * ⚠️ Resta separata da `frescoByKey`, che esce nella risposta come `aggiornato_al` e serve a
   * un'altra cosa (il ricordo del bot): fonderle romperebbe quella.
   */
  const circoloByKey = new Map<string, string>();
  // Le liste della SOLA scheda del circolo, separate dalle altre: sono l'unica fonte
  // ORDINATA, e l'ordine è ciò che dice chi ha organizzato (il primo dell'elenco).
  const schedeByKey = new Map<string, string[][]>();
  /**
   * ⭐ Vero finché di questo slot abbiamo visto SOLO copie scritte da noi (`staff_booking`) —
   * cioè finché il circolo non ne ha ancora raccontato la sua scheda (voce 71). È il fatto che
   * distingue *«l'ordine non lo so ancora»* da *«l'ordine non si sa»*, e senza il quale il bot
   * dice a chi ha appena prenotato che la partita non è sua.
   * ⚠️ Parte da vero e si spegne alla prima riga sincronizzata: una sola basta, perché una sola
   * vuol dire che il circolo ha parlato.
   */
  const soloCopieNostreByKey = new Map<string, boolean>();
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
    // Le liste della riga si ACCUMULANO separate e si uniscono alla fine, in un posto
    // solo (`compagniDelloSlot`): unirle qui, nome per nome, fondeva gli «Ospite» di una
    // stessa partita in uno solo e faceva risultare incompleta una partita di quattro.
    const liste = listeByKey.get(key);
    if (liste) liste.push(...roster.liste);
    else listeByKey.set(key, [...roster.liste]);

    if (roster.scheda.length) {
      const schede = schedeByKey.get(key);
      if (schede) schede.push(roster.scheda);
      else schedeByKey.set(key, [roster.scheda]);
    }

    // Voce 71: da dove viene questa riga. 🚨 Si guarda il `record_type`, non la presenza della
    // scheda: una riga sincronizzata SENZA lista (un titolo libero, «Torneo aziendale») è
    // comunque il circolo che ha parlato, e lì l'ordine è davvero ignoto — non «non ancora».
    soloCopieNostreByKey.set(
      key,
      (soloCopieNostreByKey.get(key) ?? true) && copiaNostra(row.record_type),
    );

    const fresco = clean(row.synced_at);
    if (fresco) {
      const finora = frescoByKey.get(key);
      if (!finora || fresco > finora) frescoByKey.set(key, fresco);
      // 🆕 VOCE 80 — e a parte, l'istante delle sole righe VENUTE DAL CIRCOLO. La regola sta
      // in `istanteDelCircolo` (modulo provato); qui si accumula riga per riga con la stessa
      // condizione, perché il ciclo passa una volta sola su ogni riga.
      if (!copiaNostra(row.record_type)) {
        const soloCircolo = circoloByKey.get(key);
        if (!soloCircolo || fresco > soloCircolo) circoloByKey.set(key, fresco);
      }
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

  /* 🆕⭐⭐ VOCE 80 — LA SOTTRAZIONE, in UN SOLO PUNTO e prima della composizione.
   *
   * ⭐ Sta qui e non dentro le tre funzioni che compongono la risposta, ed è la decisione che
   * conta: `compagni`, `giocatori` e `in_campo` nascono tutt'e tre da `listeByKey` e
   * `schedeByKey`. Correggendo le LISTE una volta, si correggono tutt'e tre insieme — e con
   * loro il bottone «Togli un giocatore», che smette di offrire una persona già uscita perché
   * quella persona non arriva più. Curare le tre uscite una per una vorrebbe dire tre regole
   * che divergono al primo che ne tocca una.
   * ⛔ Se non c'è niente da togliere, `togliRimossi` torna la lista IDENTICA (per riferimento):
   * a rimozioni zero questa cura non esiste. */
  const perIdReserva = mappaIdReserva(bookingRows ?? []);
  const rimozioni = rimozioniDaStaffEdit(staffEditRows ?? [], perIdReserva);
  if (rimozioni.length) {
    for (const key of order) {
      const rimossi = rimossiDopoIlSync(rimozioni, key, circoloByKey.get(key) ?? null);
      if (!rimossi.length) continue;
      const liste = listeByKey.get(key);
      if (liste) listeByKey.set(key, liste.map((l) => togliRimossi(l, rimossi, normName)));
      const schede = schedeByKey.get(key);
      if (schede) schedeByKey.set(key, schede.map((l) => togliRimossi(l, rimossi, normName)));
      console.log(`[readmodel] voce80: tolti ${rimossi.length} da ${key} (non ancora nel sync)`);
    }
  }

  const bookings: JsonMap[] = order.map((key) => ({
    ...(byKey.get(key) as JsonMap),
    compagni: compagniDelloSlot(listeByKey.get(key) ?? [], nameVariants, MAX_COMPAGNI),
    // ⭐ L'elenco NELL'ORDINE della scheda, socio compreso: da qui si legge chi ha
    // organizzato (il primo). `compagni` non basta — è l'elenco meno il socio, quindi la
    // posizione del socio è persa. La REGOLA non sta qui: il ponte porta il DATO, il bot
    // applica la regola (una sola implementazione per parte, non una terza copia).
    // ⚠️ Nessun dato personale in più dei `compagni`: gli stessi nomi, più quello del socio
    // stesso, che sta già in `member.name`.
    ...(() => {
      // ⭐⭐ Voce 71 — `giocatori: []` diceva DUE cose diverse: «il circolo non ha ancora
      // raccontato la sua scheda» e «l'ordine non si sa». Il bot, non potendole distinguere,
      // sceglieva la peggiore e diceva a chi aveva appena prenotato *«questa partita non l'hai
      // organizzata tu»*, mandandolo **da sé stesso**. Ora il perché esce insieme al dato.
      // ⚠️ `giocatori` non cambia forma né significato: `ordine` si AGGIUNGE, così un bot più
      // vecchio di questa funzione continua a leggere quello che leggeva.
      const o = ordineDelloSlot(schedeByKey.get(key) ?? [], soloCopieNostreByKey.get(key) ?? false);
      // 🆕👀⭐⭐ VOCE 91 (24/08) — `in_campo`: CHI c'è, anche quando l'ORDINE non si sa.
      // 🗣️ Suo: *«se il gestionale ha detto che è prenotata, la prenotazione già c'è: è un fatto
      // interno nostro»*. ⇒ Nella finestra fra la conferma e il sync (misurata **2′56″** sul suo
      // caso del 24/08) `giocatori` è vuoto perché manca la scheda del circolo — ma i nomi la
      // copia locale ce li ha, e il bot diceva *«non riesco a leggere chi c'è in campo»* di una
      // partita che avevamo scritto noi trenta secondi prima.
      // ⚖️ Si AGGIUNGE e non sostituisce: `giocatori` resta l'elenco ORDINATO, che è quello da
      // cui il bot ricava chi ha organizzato. Riempirlo con una lista senza ordine gli farebbe
      // incoronare il primo nome che capita — vedi il commento su `inCampoDelloSlot`.
      // ⭐ Si compone dalle liste GIÀ raccolte per i compagni (`listeByKey`), che sono le stesse
      // di questa partita: nessuna seconda lettura, nessuna seconda regola di fusione.
      const inCampo = inCampoDelloSlot(listeByKey.get(key) ?? [], MAX_COMPAGNI + 1);
      return { giocatori: o.giocatori, ordine: o.ordine, in_campo: inCampo };
    })(),
    // ⏱️ Quando questo roster è stato aggiornato l'ultima volta. Serve a chi tiene una memoria
    // a tempo di ciò che ha appena fatto (il bot) per sapere se il dato che sta leggendo è più
    // recente del proprio ricordo — cioè se qualcun altro è intervenuto dopo di lui.
    // ⚠️ `null` quando nessuna riga porta l'istante: chi legge deve trattarlo come «non lo so»
    // e tenersi il ricordo, che è il verso prudente (nasconde per qualche minuto in più,
    // invece di mostrare qualcuno che è stato tolto davvero).
    aggiornato_al: frescoByKey.get(key) ?? null,
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
      // 🆕 2/08/2026: sempre restituito, qualunque sia la via con cui il socio è stato
      // riconosciuto. ⭐ Serve al passo successivo — il bot può IMPARARE il codice nuovo
      // di chi oggi conosce solo per member_id o per telefono, e passare alla via nuova
      // senza che nessuno resti fuori.
      pmo_player_id: member.pmoPlayerId || null,
      // 🆕⭐⭐ 2/08/2026 — «questa persona può prenotare?», detto come FATTO dal ponte.
      // Regola del committente, 2/08: *«sul bot di Telegram non ci deve essere il codice
      // Matchpoint, ma solamente il codice PMO, perché Matchpoint fra qualche tempo non ci
      // sarà più»*. Finché c'è, però, la prenotazione finisce sul gestionale del circolo,
      // che accetta solo i suoi clienti: la distinzione SERVE ancora, ma non deve vivere
      // nel bot sotto forma di un codice che il bot conserva e interpreta.
      // ⇒ La risponde CHI PARLA COL CIRCOLO, cioè questo ponte. Il bot chiede col codice
      //   nostro e riceve un sì/no, senza mai vedere un codice Matchpoint.
      // ⭐⭐ E il giorno del distacco NON si tocca il bot: qui questa riga diventa `true`
      //   per tutti, e a valle non cambia nient'altro.
      // ⚠️ `member_id` resta nella risposta per i chiamanti storici: si AGGIUNGE, non si
      //   toglie — la stessa regola con cui è entrata la terza via dell'identità.
      // 🚨 E la domanda NON è «il campo del codice è pieno?», che è come stava scritta qui
      //   il 2/08 (`!!member.memberId`): in quel campo restano dei vecchi `PMO-…` — 14 su
      //   PROD, 1709 su TEST — e a quelle persone avrebbe detto di sì. Il fatto, con i
      //   numeri veri e il perché, sta in `cliente-del-circolo.ts`.
      puo_prenotare: clienteDelCircolo(member.memberId),
      name: member.name,
      // Livello: proprietà dell'APP (Matchpoint lo riceve, non lo detta).
      // 0.5 è il valore di partenza delle schede nuove, cioè "da definire":
      // stessa regola del gestionale (index.html, filtro "Livello 0.5 dopo
      // autovalutazione" e conteggio "da completare"). Si espone il flag così
      // l'assistente non annuncia "il tuo livello è 0.5".
      // 🚨 La regola sta in `livello-dimostrato.ts`, insieme al gemello della rubrica:
      // se si cambia qui e non là, il bot dice due cose diverse della stessa persona.
      level: member.level || null,
      level_assessed: livelloDimostrato(member.level, member.levelSource),
    },
    wallet,
    bookings: bookings.slice(0, MAX_BOOKINGS),
    bookings_truncated: bookings.length > MAX_BOOKINGS,
    today,
  });
});
