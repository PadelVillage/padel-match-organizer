import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Chi gioca in uno slot sta in un modulo a parte perché è la parte che ha già sbagliato due
// volte, e sepolta qui dentro non era provabile: ora i payload VERI di PROD si danno in pasto
// alla funzione senza scrivere niente da nessuna parte (`roster-slot.test.ts`).
import {
  altriOmonimiVivi,
  bersaglioDaTogliere,
  clean,
  compagniDaAvvisare,
  dirittoDiAnnullare,
  normName,
  type SchedaPerOmonimia,
  listeDaPayload,
  mioNomeNelRoster,
  nomiDellaRiga,
  restanoSoloOspiti,
  rosterDelloSlot,
  schedaUnicaConQuelNome,
  senzaDiMe,
  sostituito,
  type RigaSlot,
  variantiDelNome,
} from './roster-slot.ts';
// E la COPIA IN APP dopo un'uscita sta in un terzo modulo, per la stessa ragione degli altri
// due: TEST non contiene la forma del dato (zero righe `staff_booking` future, misurato il
// 28/07), quindi l'unico modo di provarlo è dare i payload VERI di PROD a una funzione pura.
import { aggiungiACopiaInApp, allineaCopiaInApp } from './allinea-copia-app.ts';
// Com'è andata una scrittura di cui non si è saputo l'esito. Sta in un modulo a parte per la
// stessa ragione del roster: la regola è delicata (un «no» sbagliato è il danno peggiore che
// questo ponte possa fare) e sepolta dentro l'handler non sarebbe provabile senza scrivere.
import {
  dettaglioPerIlBot, esitoIgnotoDaRisposta, MOTIVO_ESITO_IGNOTO, MOTIVO_SCRITTURA_RIFIUTATA, verdettoScrittura,
} from './esito-scrittura.ts';
import { giocatoreDaAggiungere } from './giocatore-da-aggiungere.ts';
import { righeRicevuta, type GestoScritto } from './ricevuta.ts';
import { registraConRitenta } from './registra-copia.ts';
/* 🆕🔓 VOCE 88 (01/09/2026) — le regole delle «Partite Aperte». Stanno in un modulo perché le
 * usano in due: qui, che AMMETTE, e `consumer-player-readmodel`, che ELENCA. Se le due
 * divergessero, il bot mostrerebbe una partita in cui poi il gestionale non fa entrare. */
import {
  TIPO_RECORD_APERTURA, chiaveApertura, decidiIngresso, puoAprire, MOTIVI as MOTIVI_APERTA,
} from './partita-aperta.ts';
// ⛔ E chi OCCUPA un campo sta in un modulo ANCORA diverso, con un tipo che non è assegnabile a
// `RigaSlot`: una manutenzione occupa il campo e non ha giocatori, una lezione ha partecipanti
// che non sono un roster da cui si esce. Le due domande — «il campo è libero?» e «chi gioca?» —
// leggono insiemi di righe DIVERSI, e confonderle rimetterebbe in circolo il difetto che
// `roster-slot.ts` esiste per chiudere.
import {
  TIPI_CHE_OCCUPANO,
  TIPO_SOLO_OCCUPAZIONE,
  campiOccupati,
  minutiInOra,
  occupazioneDellaRiga,
  oraInMinuti,
  type Occupazione,
} from './occupazione.ts';

// consumer-booking-write — ponte SCRITTURE prenotazioni per l'assistente dei soci
// (oggi il bot Telegram). Chiamato dall'assistente DOPO la conferma a pulsanti del socio.
//
// Azioni:
// - availability: { phone, data, ora, durata? } → campi liberi nello slot (proposta).
// - create:       { phone, data, ora, durata?, campo } → prenotazione VERA via
//                 matchpoint-bookings-create (riuso: job/record/audit restano lì).
//                 🧪 `dry_run: true` → PROVA A VUOTO, stessa forma di `leave`: fa tutto
//                 (identità, validazione dello slot, occupazione RILETTA, richiesta
//                 composta) e si ferma UN PASSO PRIMA della riga che occupa il campo,
//                 restituendo in `would.richiesta` ciò che partirebbe davvero.
//                 🚨 `created` resta `false`: chi non conosce il campo `dry_run` legge
//                 «non ho prenotato», che è la verità.
// - cancel:       { phone, data, ora, campo } → disdetta via matchpoint-bookings-cancel,
//                 SOLO se il socio è nel roster della prenotazione (ownership) e SOLO se non
//                 c'è nessun altro in campo.
//                 🧪 `dry_run: true` → PROVA A VUOTO, stessa forma delle altre due: trova la
//                 prenotazione, ricompone il roster su tutte le righe dello slot, applica le
//                 guardie, compone la richiesta, e si ferma UN PASSO PRIMA della riga che
//                 TOGLIE IL CAMPO. Aggiunta il 28/07 perché era l'unica azione che scriveva
//                 senza poter essere provata: l'assistente in simulazione esce prima di
//                 chiamare il ponte, quindi questo percorso non è mai girato NÉ su TEST NÉ su
//                 PROD, e il primo a girarlo sarebbe stato un socio vero su una partita vera.
//                 🚨 `cancelled` resta `false`: chi non conosce il campo `dry_run` legge «non
//                 ho annullato niente», che è la verità. L'equivoco cade dalla parte sicura.
//                 👥 Torna `compagni: [{ nome, scheda }]` — chi ALTRO ci rimette il campo, col
//                 numero di scheda con cui il bot ne ritrova la chat (gemello plurale di
//                 `scheda_del_tolto` del `remove`). `scheda: null` = quel nome non è di una
//                 sola persona viva ⇒ non si avvisa. C'è anche nella prova a vuoto, apposta.
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
//                 🚨⭐ Un'uscita riuscita fa DUE scritture, non una: dopo quella sul
//                 gestionale allinea anche la COPIA IN APP (`staff_booking`), che nessuno
//                 aggiornerebbe mai da sé — né l'edit né il sync — e che tenendo il socio
//                 dentro lo rimetteva in campo alla lettura successiva. Esito in
//                 `copia_in_app`, presente su OGNI risposta di `leave`, prova a vuoto
//                 compresa.
// - remove:       { member_id, data, ora, campo, giocatore } → TOGLIE UN ALTRO GIOCATORE
//                 dalla partita, via lo stesso matchpoint-bookings-edit di `leave`. Terzo
//                 potere dell'organizzatore (decisione del committente 30/07/2026).
//                 🚨 Stessa scrittura di `leave`, PERMESSO diverso: passa solo chi ha
//                 organizzato — `dirittoDiAnnullare`, la stessa funzione dell'annullo, perché
//                 chi può far sparire il campo a tutti può togliere una persona sola. In più
//                 c'è la guardia sul BERSAGLIO (`bersaglioDaTogliere`): il nome dev'essere in
//                 campo, non può essere l'organizzatore stesso (per uscire lui c'è `leave`) e
//                 se in partita ci sono due persone con lo stesso nome ci si ferma, perché il
//                 worker le toglierebbe TUTT'E DUE.
//                 🧪 `dry_run: true` → PROVA A VUOTO come le altre, e qui vale doppio: dal
//                 bot l'operazione è a SENSO UNICO — rimettere una persona nella scheda il bot
//                 non lo sa fare (`prenota` accetta solo data, ora e campo), quindi si ripara
//                 solo passando dalla segreteria.
//                 🚨 `removed` resta `false` sulla prova a vuoto. L'equivoco cade dalla parte
//                 sicura, come per le altre.
//                 🚨⭐ Anche qui le scritture sono DUE: dopo il gestionale si allinea la COPIA
//                 IN APP, con le varianti del BERSAGLIO e non del socio che chiede.
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

// 🗑️ 6/08/2026 — `OSPITE_MATCHPOINT` («Ospite», la forma esatta da mandare al worker) È STATA
// CANCELLATA: serviva solo a far entrare in campo chi non è cliente del circolo, e da oggi
// quel ramo non esiste più — l'Ospite lo mette la segreteria (sua decisione).
// ⭐⭐ Cancellata e non lasciata lì: una costante viva che nessuno usa è la trappola peggiore
// di questo progetto — si legge come «il caso è previsto» quando invece non è più possibile.
// ⚠️ Il CONCETTO resta vivo altrove e non va confuso con questo: `roster-slot.ts` sa ancora
// riconoscere gli Ospiti — quelli messi dalla segreteria — perché `remove` e il conteggio del
// roster devono continuare a contarli.

// La nota che resta scritta SULLA PRENOTAZIONE, e che lo staff legge nel gestionale.
// ⚠️ Fino al 28/07/2026 diceva «Prenotata via chat WhatsApp»: falso da quando WhatsApp è
// stato smantellato, e fragile in partenza perché legava la nota al CANALE — la parte che
// invecchia per prima (WhatsApp è già la seconda porta chiusa in un mese). Dice invece la
// cosa che allo staff serve davvero sapere e che resta vera cambiando canale: questa
// prenotazione non l'ha fatta la segreteria, se l'è fatta il socio.
const NOTA_PRENOTAZIONE = "Prenotata dal socio con l'assistente";

// 🧪 Dove esiste la prova a vuoto. È un elenco e non un `if` sparso perché il rifiuto qui
// sotto è ciò che rende la prova AFFIDABILE: un'edge che non conosce un'azione risponde
// «non ce l'ho» invece di ignorare il campo e scrivere per davvero.
const AZIONI_CON_PROVA_A_VUOTO = ['leave', 'create', 'cancel', 'remove', 'add'];

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

// Ora↔minuti vivono in `occupazione.ts` insieme alla regola che li usa: due copie della
// stessa conversione sono un modo lento di far divergere due conti che devono coincidere.
const timeToMin = oraInMinuti;
const minToTime = minutiInOra;

// `pmoPlayerId` = «ID giocatore Padel Village» (PMO-000000), il nostro. Qui serve a
// confermare in-code il match quando il socio arriva per quella via; le risposte
// operative continuano a portare id+nome, e l'identità completa la dà il readmodel.
/* 🆕🔓 VOCE 88 — `level` e `levelSource` viaggiano con la scheda perché la regola ④ e la
 * decisione ① si decidono su di loro. Non escono MAI verso il bot da questa azione: qui
 * servono a rispondere sì/no, e il numero resta di qua (regola del 2/08). */
type MemberHit = { id: string; memberId: string; pmoPlayerId: string; name: string; firstName: string; surname: string; level: string; levelSource: string };

/**
 * 👥 Quanto largo è il filtro grossolano con cui si cercano gli omonimi in anagrafica.
 * 200 contro un cognome più frequente di **16** (misurato su PROD il 3/08/2026): 12 volte il
 * caso peggiore. 🚨 Se un giorno tornasse pieno fino al limite, l'annullo si FERMA invece di
 * proseguire — vedi dove viene usato: un elenco troncato potrebbe aver perso proprio l'omonimo.
 */
const OMONIMI_LIMITE = 200;

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
  /* 🆕🔓 VOCE 88 — `apri` e `chiudi` sono la regola ②, `entra` è la porta della ③+④.
   * ⚖️ Le prime due NON scrivono su Matchpoint e non chiamano il worker: aprire una partita è
   * un fatto NOSTRO, che al circolo non risulta e non deve risultare. È la regola ferrea del
   * 19/08 letta al contrario — *il gestionale SA* vale anche per ciò che Matchpoint non sa. */
  if (!['availability', 'availability_day', 'create', 'cancel', 'leave', 'remove', 'add', 'verifica', 'apri', 'chiudi', 'entra'].includes(action)) {
    return err(400, 'INVALID_ACTION', `Azione non ammessa: ${action || '(vuota)'}`);
  }

  // 🧪 Prova a vuoto. Deve essere chiesta ESPLICITAMENTE con un booleano vero: qualunque
  // altra cosa — «true», 1, la chiave assente — vale spento, così un refuso non trasforma
  // una scrittura vera in una prova silenziosa (né viceversa).
  const dryRun = body.dry_run === true;
  if (dryRun && !AZIONI_CON_PROVA_A_VUOTO.includes(action)) {
    const dove = AZIONI_CON_PROVA_A_VUOTO.map((a) => `«${a}»`).join(' e ');
    return err(400, 'DRY_RUN_NOT_SUPPORTED', `La prova a vuoto esiste solo per ${dove}, non per «${action}».`);
  }

  // Identità: pmo_player_id OPPURE phone OPPURE member_id (mai insieme), stessa
  // ricetta di consumer-player-readmodel. Telegram non consegna il telefono: l'unico
  // appiglio è member_id (whitelist chat_id→member_id). whatsapp-webhook e il
  // consumer continuano a passare phone → retrocompatibile.
  //
  // 🆕⭐ 2/08/2026 — `pmo_player_id` («ID giocatore Padel Village», PMO-000000) è la via
  // NUOVA e destinata a diventare l'unica: sua regola ferma, «l'ID che il bot deve leggere
  // è l'ID PMO, non quello Matchpoint», perché da Matchpoint un giorno ci staccheremo.
  // 🚨 Si AGGIUNGE, non sostituisce: il bot vivo cerca ancora per member_id, e togliere la
  // via vecchia adesso spegnerebbe il riconoscimento ai soci veri, in produzione.
  const pmoPlayerIdInput = clean(body.pmo_player_id).toUpperCase();
  const memberIdInput = clean(body.member_id);
  const digits = phoneDigits(body.phone);
  const last10 = digits.slice(-10);
  // 🆕⭐⭐ 9/08/2026 — IL member_id PUÒ VIAGGIARE INSIEME AL pmo_player_id, e solo con lui:
  // stessa ricetta del readmodel, e per la stessa ragione (24 codici PMO condivisi da 48
  // persone su PROD: il ponte ne trovava due e rifiutava di scegliere). Il pmoPlayerId
  // resta la via primaria; il codice del circolo entra SOLO a restringere un `ambiguous`.
  // 🚨 Il telefono resta ESCLUSIVO: è la via del consumer WhatsApp.
  // ⚠️ Le due copie — qui e in `consumer-player-readmodel` — vanno cambiate INSIEME:
  // `_shared/` non si deploya, per questo la ricetta è ripetuta.
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) return err(503, 'MISSING_ENV', 'SUPABASE_URL/SERVICE_ROLE_KEY non configurati.');
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  /**
   * 🧾⭐⭐ LA RICEVUTA DI CIÒ CHE ABBIAMO SCRITTO (voce 70) — si chiama DOPO ogni scrittura
   * riuscita, e serve a una cosa sola: impedire che il **circolo** annunci al socio un gesto
   * che ha fatto lui.
   *
   * 🗣️ Il difetto è misurato al secondo (21/08/2026): Lidia accetta un invito dal bot, il bot
   * le dice «✅ Sei in campo», e fra i 4 e i 19 minuti dopo un avviso del circolo le annuncia
   * la stessa cosa. Chi produce quell'avviso confronta due fotografie del calendario: vede
   * *cosa* è cambiato e non può sapere **chi**. ⇒ Glielo diciamo noi, che lo sappiamo.
   *
   * ⚖️ BEST EFFORT, e il verso è scelto: se questa scrittura fallisce **non** si tocca la
   * risposta al socio. La scrittura vera è già andata, e il peggio che può capitare è tornare
   * al fastidio di prima (un avviso di troppo) — mai perdere una prenotazione per una riga di
   * contabilità. 🚨 Ma si SCRIVE nel registro: un avviso falso che ricompare deve poter essere
   * spiegato, e senza questa riga sembrerebbe che la cura non funzioni.
   */
  const lasciaRicevuta = async (
    azione: string,
    partita: { data: string; ora: string; campo: unknown },
    gesti: GestoScritto[],
  ): Promise<void> => {
    try {
      const righe = righeRicevuta({
        azione,
        richiestaDa: member?.name ?? '',
        data: partita.data,
        ora: partita.ora,
        campo: partita.campo,
        gesti,
      });
      if (!righe.length) return;
      const { error } = await service.from('pmo_ricevute_gesti').insert(righe);
      if (error) {
        console.error(`[booking-write] ricevuta KO (${azione}) ${partita.data} ${partita.ora} C${partita.campo}: ${error.message} — il circolo potrebbe annunciare questo gesto al socio che l'ha fatto`);
        return;
      }
      console.log(`[booking-write] ricevuta ${azione} ${partita.data} ${partita.ora} C${partita.campo}: ${righe.map((r) => `${r.persona}=${r.gesto}`).join(', ')}`);
    } catch (e) {
      console.error(`[booking-write] ricevuta KO (${azione}):`, clean((e as Error)?.message ?? 'errore'));
    }
  };

  // ── Identità → member (per member_id o phone) ────────────────────────────
  let memberQuery = service
    .from('pmo_cloud_records')
    .select('payload')
    .eq('record_type', 'member')
    .not('deleted', 'is', true)
    .limit(5);
  memberQuery = pmoPlayerIdInput
    ? memberQuery.eq('payload->>pmoPlayerId', pmoPlayerIdInput)
    : memberIdInput
    ? memberQuery.eq('payload->>memberId', memberIdInput)
    : memberQuery.ilike('payload->>phone', `%${last10}`);
  const { data: memberRows, error: memberErr } = await memberQuery;
  if (memberErr) return err(500, 'DB_ERROR', 'Errore lettura anagrafica.');

  const hits: MemberHit[] = [];
  for (const row of memberRows ?? []) {
    const p = (row.payload ?? {}) as JsonMap;
    if (!clean(p.id)) continue;
    // Conferma in-code del match (evita falsi positivi dell'ilike / sorprese PostgREST).
    if (pmoPlayerIdInput) {
      if (clean(p.pmoPlayerId).toUpperCase() !== pmoPlayerIdInput) continue;
    } else if (memberIdInput) {
      if (clean(p.memberId) !== memberIdInput) continue;
    } else if (!phoneDigits(p.phone).endsWith(last10)) continue;
    hits.push({
      id: clean(p.id),
      memberId: clean(p.memberId),
      pmoPlayerId: clean(p.pmoPlayerId),
      name: clean(p.name),
      firstName: clean(p.firstName),
      surname: clean(p.surname),
      level: clean(p.level),
      levelSource: clean(p.levelSource),
    });
  }
  if (hits.length === 0) return ok({ member: null, reason: 'not_found' });
  // ⭐ Il ripiego (v. sopra): due schede vive con lo stesso ID giocatore si distinguono
  // col codice del circolo. Restringe un `ambiguous` che c'era già — non può cambiare
  // una risposta oggi giusta, perché entra solo quando le schede sono più d'una.
  if (hits.length > 1 && pmoPlayerIdInput && memberIdInput) {
    const ristretti = hits.filter((m) => m.memberId === memberIdInput);
    if (ristretti.length === 1) {
      console.log(
        `[booking-write] ${etichetta}: ${hits.length} schede con lo stesso ID giocatore, ristretto a una col codice socio ${memberIdInput}`,
      );
      hits.length = 0;
      hits.push(ristretti[0]);
    }
  }
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

    // Ciò che occupa un campo quel giorno: prenotazioni, copie in app E occupazioni «nude»
    // (manutenzioni e lezioni che vivono solo come `booking_occupancy`). Regola e misure in
    // `occupazione.ts` — qui non si decide niente, si legge e si dà in pasto al modulo.
    const { data: dayRows, error: dayErr } = await service
      .from('pmo_cloud_records')
      .select('record_type, payload')
      .in('record_type', TIPI_CHE_OCCUPANO)
      .not('deleted', 'is', true)
      .eq('payload->>data', dayData)
      .limit(500);
    if (dayErr) return err(500, 'DB_ERROR', 'Errore lettura prenotazioni del giorno.');
    const occupied: Occupazione[] = [];
    for (const row of dayRows ?? []) {
      const occ = occupazioneDellaRiga((row.payload ?? {}) as JsonMap);
      if (occ) occupied.push(occ);
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
      const busy = campiOccupati(occupied, sStart, sEnd);
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

  // ── Le righe del giorno, lette UNA volta e smistate in DUE elenchi ────────
  // 🚨⭐⭐ Lo smistamento è il punto delicato di tutto il file. Le stesse righe rispondono a
  // due domande diverse, e la risposta si prende da insiemi diversi:
  //   · «il campo è libero?» → TUTTO ciò che occupa, comprese le manutenzioni (`occupazioni`);
  //   · «chi gioca?»         → solo `booking` + `staff_booking` (`dayBookings`).
  // Un solo elenco per entrambe le domande metterebbe le manutenzioni nel roster — cioè
  // proprio nella parte che ha già sbagliato due volte a contare i giocatori.
  const { data: dayRows, error: dayErr } = await service
    .from('pmo_cloud_records')
    .select('id, record_type, payload')
    .in('record_type', TIPI_CHE_OCCUPANO)
    .not('deleted', 'is', true)
    .eq('payload->>data', slot.data)
    .limit(500);
  if (dayErr) return err(500, 'DB_ERROR', 'Errore lettura prenotazioni del giorno.');

  // ⛔ Niente `startMin`/`endMin` qui dentro: l'occupazione non si calcola più su questo
  // elenco, e lasciarci i minuti sarebbe l'invito a rifarlo qui — dove le manutenzioni non ci
  // sono. Chi occupa sta in `occupazioni`, chi gioca sta qui.
  // ⭐ `id` e `payload` grezzo servono solo all'allineamento della copia in app dopo un'uscita
  // (`allinea-copia-app.ts`): quella riga si riscrive per CHIAVE PRIMARIA, non per slot.
  type DayBooking = RigaSlot & {
    id: string; copiaInApp: boolean; payload: JsonMap;
    campo: number; idReserva: string; ora: string; tipo: string;
    /** Quale PRENOTAZIONE è questa riga — vedi `identitaPrenotazione` più sotto. */
    prenotazione: string;
  };
  const dayBookings: DayBooking[] = [];
  const occupazioni: Occupazione[] = [];
  for (const row of dayRows ?? []) {
    const p = (row.payload ?? {}) as JsonMap;
    const occ = occupazioneDellaRiga(p);
    if (occ) occupazioni.push(occ);
    // Il terzo tipo si ferma QUI: porta l'occupazione del campo e mai un giocatore da cui si
    // esca (una manutenzione non ha roster, i partecipanti di una lezione non sono una partita).
    if (clean(row.record_type) === TIPO_SOLO_OCCUPAZIONE) continue;
    const campoNum = parseInt(String(p.campo ?? '').replace(/\D/g, ''), 10);
    const ora = clean(p.ora);
    if (!campoNum || !/^\d{2}:\d{2}$/.test(ora)) continue;
    dayBookings.push({
      id: clean(row.id),
      // La COPIA IN APP: è l'unica che nessuno aggiorna quando il roster cambia da fuori
      // l'app, ed è quella che dopo un'uscita va riallineata a mano → `allinea-copia-app.ts`.
      copiaInApp: clean(row.record_type) === 'staff_booking',
      payload: p,
      campo: campoNum, ora,
      // Le tre forme del roster e il ripiego sul `nome` troncato stanno in `roster-slot.ts`,
      // dove sono provate sui payload veri. ⭐ Liste SEPARATE, mai un elenco solo: è ciò che
      // permette di contare due «Ospite» come due persone invece che come una.
      liste: listeDaPayload(p),
      // La scheda del circolo (`-Nome.-Nome.`): c'è sulle righe sincronizzate, mai sugli
      // `staff_booking`. Serve solo quando le due copie si contraddicono, ma va portata fin
      // qui perché a valle le righe sono già state ridotte a questo tipo.
      descrizione: clean(p.descrizione),
      idReserva: clean(p.id_reserva ?? p.idReserva),
      // ⭐⭐ QUALE PRENOTAZIONE È QUESTA RIGA — e la chiave è `numero`, non `idReserva`.
      //
      // 📏 Misurato su PROD il 23/08/2026, perché la differenza non si vede leggendo: sulle
      // **122** righe `booking` vive, `numero` c'è **122** volte e `idReserva` solo **70**.
      // ⇒ `idReserva` sta sulla CAPOFILA; le righe degli altri giocatori ne sono prive. Contare
      // per `idReserva` avrebbe contato le capofila, non le prenotazioni — e sulle righe senza
      // avrebbe contato zero.
      // ⭐ Dove ci sono entrambi non discordano **mai** (0 su 70): non è una scelta fra due
      //   verità, è la stessa scritta in due posti, uno dei quali completo.
      // ⚠️ Gli `staff_booking` `numero` non ce l'hanno affatto: lì la chiave resta `id_reserva`,
      //   ed è la stessa della riga sincronizzata — la copia locale e la sua sorgente cadono nello
      //   stesso gruppo invece di sembrare due prenotazioni.
      prenotazione: clean(p.numero) || clean(p.id_reserva ?? p.idReserva),
      tipo: clean(p.tipo),
    });
  }

  const slotStart = timeToMin(slot.ora);
  const slotEnd = slotStart + slot.durata;

  // ── availability ──────────────────────────────────────────────────────────
  if (action === 'availability') {
    const busy = campiOccupati(occupazioni, slotStart, slotEnd);
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
  // ⭐ Le varianti arrivano dal modulo, non ricostruite qui: sono le STESSE che la guardia
  // degli omonimi usa per contare. Due elenchi scritti a mano in due posti divergono, e la
  // divergenza si vedrebbe solo il giorno in cui qualcuno annulla la partita di un altro.
  const nameVariants = variantiDelNome(member);

  /**
   * 👥 Il nome di questo socio è di UN'ALTRA persona viva in anagrafica?
   *
   * ⭐⭐ Sta in un posto solo, e da qui la chiamano `cancel` e `remove`. Nata dentro `cancel`
   * il 3/08, è stata tirata fuori il 4/08 quando è servita anche a `remove`: ricopiarla
   * sarebbe stato scriverne una seconda copia, e questa non è una comodità — è la lettura che
   * decide se un gesto irreversibile passa. Due copie di una guardia divergono, e la
   * divergenza si vedrebbe solo il giorno in cui una delle due lascia passare l'errore.
   *
   * 🚨 Fallisce CHIUSA: se l'anagrafica non si riesce a interrogare — o se l'elenco torna
   * pieno fino al limite, cioè potenzialmente troncato — non si prosegue. Una guardia che nel
   * dubbio dà via libera non è una guardia.
   *
   * @param nonFaccio come si chiama, al socio, la cosa che NON si farà. È l'unica differenza
   *   fra i due usi: «non annullo» e «non tolgo nessuno» mandano a fare la stessa cosa
   *   (chiedere in segreteria) ma raccontano l'azione giusta, e una frase che parla di
   *   annullamento a chi stava togliendo un giocatore lo manderebbe a cercare un guasto che
   *   non c'è.
   */
  const omonimiDelSocio = async (
    azione: string,
    nonFaccio: string,
  ): Promise<{ ok: true; omonimi: string[] } | { ok: false; risposta: Response }> => {
    const candidati: SchedaPerOmonimia[] = [];
    // Due filtri grossolani perché il nome può stare in `name` oppure spezzato in
    // `firstName`/`surname`: si uniscono, e a decidere è `altriOmonimiVivi`.
    for (const f of [
      clean(member.surname) ? { campo: 'payload->>surname', valore: clean(member.surname) } : null,
      clean(member.name) ? { campo: 'payload->>name', valore: clean(member.name) } : null,
    ]) {
      if (!f) continue;
      const { data, error } = await service
        .from('pmo_cloud_records')
        .select('payload')
        .eq('record_type', 'member')
        .not('deleted', 'is', true)
        .ilike(f.campo, f.valore)
        .limit(OMONIMI_LIMITE);
      if (error || (data ?? []).length >= OMONIMI_LIMITE) {
        console.error(`[booking-write] ${azione}: omonimi non verificabili su ${f.campo} →`,
          error ? error.message : `elenco pieno al limite ${OMONIMI_LIMITE} (potrebbe essere troncato)`);
        return {
          ok: false,
          risposta: err(503, 'OMONIMI_NON_VERIFICABILI',
            `Non riesco a verificare in anagrafica che la partita sia tua: per sicurezza ${nonFaccio}. Riprova, o chiedi in segreteria.`),
        };
      }
      for (const row of data ?? []) {
        const p = (row.payload ?? {}) as JsonMap;
        candidati.push({
          id: clean(p.id), name: clean(p.name),
          firstName: clean(p.firstName), surname: clean(p.surname), active: p.active,
        });
      }
    }
    const omonimi = altriOmonimiVivi(member, candidati);
    if (omonimi.length) {
      console.log(`[booking-write] ${azione}: "${member.name}" ha ${omonimi.length} omonimo/i vivo/i in anagrafica`);
    }
    return { ok: true, omonimi };
  };

  /**
   * 👤 CHI È il giocatore che si sta togliendo, quando quel nome è di UNA SOLA persona viva.
   *
   * ⭐⭐ 11/08/2026, da una sua domanda: *«con il nuovo sistema di registrazione possiamo
   * avvisare anche noi il giocatore che è stato eliminato»*. Il bot lo sa già fare con chi è
   * entrato accettando un invito — quella riga è attaccata a QUELLA partita — e resta muto con
   * tutti gli altri. Questo è il pezzo che gli dice **a chi** scrivere anche per loro.
   *
   * ⭐ 19/08/2026 — la chiama anche `cancel`, un nome per volta, per l'avviso ai compagni di
   * una partita annullata. La domanda è identica («chi è, se quel nome è di uno solo»), quindi
   * la funzione resta UNA: due copie divergerebbero, e divergere qui vuol dire un avviso
   * mandato all'omonimo. ⚠️ Per questo `azione` è un parametro e non una costante nel testo dei
   * log: una diagnosi che dice «remove» mentre si stava annullando manda a cercare il guasto
   * nel posto sbagliato — è la stessa ragione per cui `omonimiDelSocio` ce l'ha già.
   *
   * 🚨 Il verso del fail closed è OPPOSTO a quello di `omonimiDelSocio`, ed è voluto: là un
   * dubbio ferma un gesto irreversibile (503, non si annulla); qui un dubbio toglie **solo un
   * avviso** — il giocatore è tolto comunque e l'organizzatore legge «avvisa tu». Fermare il
   * togli perché non si sa a chi scrivere sarebbe far pagare al socio un problema nostro.
   * ⇒ Perciò questa NON torna mai un errore: torna `null`, e chi legge non promette niente.
   *
   * ⚖️ La lettura è la stessa di `omonimiDelSocio`, ma i filtri partono da una stringa sola (il
   * nome come lo scrive il gestionale) invece che da `name` + `surname`: si cerca il nome
   * intero, e **ogni sua parola come cognome**, perché la scheda può essere scritta «Nome
   * Cognome» oppure «Cognome Nome». A decidere resta `schedaUnicaConQuelNome`, che confronta
   * con la chiave che ignora l'ordine.
   */
  const schedaDiChiSiToglie = async (nome: string, azione: string): Promise<string | null> => {
    const cercato = clean(nome);
    if (!cercato) return null;
    // ⚠️ `%` e `_` sono i jolly di `ilike`: lasciati passare allargherebbero il filtro. Il verso
    // sarebbe comunque sicuro (più candidati ⇒ più facile che siano due ⇒ non si avvisa), ma un
    // nome con un jolly dentro non è un nome: si tratta come «non lo so».
    if (/[%_]/.test(cercato)) return null;
    const parole = cercato.split(/\s+/).filter(Boolean);
    const filtri = [
      { campo: 'payload->>name', valore: cercato },
      ...parole.map((p) => ({ campo: 'payload->>surname', valore: p })),
    ];
    const candidati: SchedaPerOmonimia[] = [];
    for (const f of filtri) {
      const { data, error } = await service
        .from('pmo_cloud_records')
        .select('payload')
        .eq('record_type', 'member')
        .not('deleted', 'is', true)
        .ilike(f.campo, f.valore)
        .limit(OMONIMI_LIMITE);
      // 🚨 Elenco pieno fino al limite = potenzialmente troncato, e il troncamento potrebbe aver
      // portato via **proprio** il secondo omonimo: si tornerebbe un id spacciandolo per unico.
      // Qui «non lo so» vale «non avviso», come sopra.
      if (error || (data ?? []).length >= OMONIMI_LIMITE) {
        console.log(`[booking-write] ${azione}: chi è "${cercato}" non verificabile su ${f.campo} → nessun avviso`);
        return null;
      }
      for (const row of data ?? []) {
        const p = (row.payload ?? {}) as JsonMap;
        candidati.push({
          id: clean(p.id), name: clean(p.name),
          firstName: clean(p.firstName), surname: clean(p.surname), active: p.active,
        });
      }
    }
    const scheda = schedaUnicaConQuelNome(cercato, candidati);
    if (!scheda) {
      console.log(`[booking-write] ${azione}: "${cercato}" non è di UNA sola persona viva (${candidati.length} schede lette) → nessun avviso`);
    }
    return scheda;
  };

  // ── create ────────────────────────────────────────────────────────────────
  if (action === 'create') {
    // 🧪 Come per `leave`: quando la prova a vuoto è accesa, se la porta indietro OGNI
    // risposta di `create`. Se non torna, la richiesta è arrivata a una versione dell'edge
    // che non ce l'ha — e lì «non ho prenotato» andrebbe letto come «non ho misurato niente».
    const prova = dryRun ? { dry_run: true } : {};

    // Ricontrollo occupazione: il tap sul pulsante può arrivare dopo minuti.
    // ⭐ Guarda lo stesso insieme di `availability`, manutenzioni comprese: se guardasse meno,
    // il socio potrebbe prenotare un campo che la griglia gli aveva già mostrato occupato.
    const occupati = campiOccupati(occupazioni, slotStart, slotEnd);
    if (occupati.has(campo)) {
      return ok({ member: { id: member.id, name: member.name }, created: false, reason: 'slot_taken', ...prova });
    }

    // ⭐ La richiesta si compone UNA volta sola e serve a tutt'e due le strade. Se la prova a
    // vuoto ne stampasse una copia scritta accanto, proverebbe una richiesta che non è quella
    // che parte — ed è proprio la divergenza fra le due che nessuno vedrebbe.
    const richiesta = {
      campo,
      data: slot.data,
      ora: slot.ora,
      oraFine: slot.oraFine,
      durata: slot.durata,
      nome: member.name,
      tipo: 'partita',
      note: NOTA_PRENOTAZIONE,
      giocatori: [{ nome: member.name }],
    };

    // 🧪 Qui finisce la prova a vuoto: tutto ciò che sta SOPRA è già stato eseguito per
    // davvero — identità, slot validato, occupazione riletta un istante fa, richiesta
    // composta — e sotto c'è l'unica riga che occupa il campo. Fermarsi altrove proverebbe
    // un percorso diverso da quello che poi succederà in produzione.
    if (dryRun) {
      console.log(`[booking-write] create PROVA A VUOTO ${slot.data} ${slot.ora} C${campo} per ${member.name}`);
      return ok({
        member: { id: member.id, name: member.name },
        created: false,
        dry_run: true,
        would: {
          slot: { data: slot.data, ora: slot.ora, ora_fine: slot.oraFine, durata: slot.durata, campo },
          // La richiesta ESATTA che partirebbe: è la sola cosa che questo percorso non ha mai
          // mostrato a nessuno, ed è dove si legge la nota che resta scritta sulla prenotazione.
          richiesta,
          // L'occupazione del momento: dice PERCHÉ quel campo risultava prenotabile. Senza,
          // un «avrei prenotato» non distingue «era libero» da «non ho guardato».
          campi_liberi: CAMPI.filter((c) => !occupati.has(c)),
          righe_nello_slot: dayBookings.filter((b) => b.campo === campo && b.ora === slot.ora).length,
        },
      });
    }

    // 🚨⭐⭐ IL TERZO ESITO ARRIVA FIN QUI — 16/08/2026, e prima si fermava una porta più in là.
    //
    // `matchpoint-bookings-create` distingue da sempre TRE esiti (voce 23): fatta, non fatta, e
    // **non lo so** — quest'ultimo quando la richiesta al worker non riceve MAI risposta, e la
    // prenotazione può essere già finita sul Matchpoint del circolo. Lo dice marchiando
    // `esitoIgnoto: true` e col codice `WORKER_ESITO_IGNOTO`.
    // ⇒ Qui quel marchio veniva **buttato**: ogni fallimento usciva col nome di un pezzo interno, il bot lo
    //   traduceva in «non sono riuscito a prenotare», e il socio rifaceva. Se la prima era passata,
    //   il campo restava occupato DUE volte sul sistema del circolo.
    //
    // ⚖️ Perché non basta ritentare, ed è la stessa ragione della sorella `cancel`: disdire due
    // volte non fa danno, prenotare due volte sì. Qui non si ritenta — si **dice la verità**, che è
    // «non lo so», e chi legge non deve rifarla ma controllare.
    //
    // 🚨⭐ E le vie del «non lo so» sono DUE, non una. La seconda è questa `fetch` stessa: se cade
    // lei, la richiesta può essere arrivata lo stesso al gestionale e la prenotazione essere stata
    // creata. Prima non era nemmeno protetta — l'eccezione usciva dall'handler, diventava un 500, e
    // il bot leggeva un guasto generico. È la via **più vicina** al bot, ed era quella scoperta.
    // ⭐ L'istante si prende PRIMA di partire, e torna indietro con ogni `esito_ignoto`: è la
    // chiave con cui l'azione `verifica` potrà dire se un giro di sync è atterrato DOPO. Preso
    // dopo, o ricostruito dal bot quando si accorge del guasto, sarebbe già in ritardo — e un
    // riferimento in ritardo fa dire «no» troppo presto, che è il danno peggiore.
    const scrittaAlle = new Date().toISOString();
    let res: Response;
    try {
      res = await fetch(`${supabaseUrl}/functions/v1/matchpoint-bookings-create`, {
        method: 'POST',
        headers: internalHeaders,
        body: JSON.stringify(richiesta),
      });
    } catch (netErr) {
      // ⛔ NESSUN ritentativo, per la ragione scritta sopra: da qui non sappiamo se la richiesta
      // è arrivata, e riprovare è esattamente il gesto che crea la seconda prenotazione.
      const testo = netErr instanceof Error ? netErr.message : String(netErr);
      console.error(`[booking-write] create ESITO IGNOTO (nessuna risposta dal gestionale): ${testo}`);
      return ok({
        member: { id: member.id, name: member.name },
        created: false,
        reason: MOTIVO_ESITO_IGNOTO,
        detail: dettaglioPerIlBot(`Nessuna risposta dal gestionale: ${testo}`),
        // Con che cosa richiedere, e quando: senza questi due il bot non ha modo di formulare
        // la domanda a cui `verifica` risponde, e il controllo resterebbe al socio.
        scritta_alle: scrittaAlle,
        slot: { data: slot.data, ora: slot.ora, campo },
      });
    }
    const data = await res.json().catch(() => null) as JsonMap | null;
    if (!res.ok || !data?.ok) {
      // ⭐ Il riconoscimento del marchio è uscito di qui il 19/08 ed è diventato
      // `esitoIgnotoDaRisposta` (`esito-scrittura.ts`), dove sta scritto perché si legge una
      // PROPRIETÀ e non le parole del messaggio. Era l'unica copia esistente, dentro un `if` in
      // mezzo a una funzione lunga — e infatti gli altri quattro punti che scrivono non la
      // riusavano: non potevano.
      const ignoto = esitoIgnotoDaRisposta(data);
      console.error(`[booking-write] create KO HTTP ${res.status}${ignoto ? ' (ESITO IGNOTO)' : ''}:`, JSON.stringify(data).slice(0, 300));
      // 🧾🚨 31/08/2026 (voce 83) — LA RICEVUTA SI LASCIA ANCHE QUI. Se la prenotazione è
      // passata lo stesso, il sync la troverà e senza ricevuta il circolo annuncerebbe al socio
      // un ingresso che ha chiesto lui. La regola stretta — sull'ignoto si copre SOLO chi ha
      // chiesto — e il suo costo stanno in `ricevuta.ts`; qui chi chiede è anche chi entra.
      if (ignoto) {
        await lasciaRicevuta('create-ignoto', { data: slot.data, ora: slot.ora, campo }, [
          { persona: member.name, gesto: 'aggiunto' },
        ]);
      }
      return ok({
        member: { id: member.id, name: member.name },
        created: false,
        reason: ignoto ? MOTIVO_ESITO_IGNOTO : MOTIVO_SCRITTURA_RIFIUTATA,
        detail: dettaglioPerIlBot(data?.message ?? data?.error ?? `HTTP ${res.status}`),
        // ⚖️ Solo sull'ignoto: su una scrittura rifiutata la prenotazione NON c'è, e dare al bot gli
        // attrezzi per «andare a controllare» lo inviterebbe a controllare un fatto già noto.
        ...(ignoto ? { scritta_alle: scrittaAlle, slot: { data: slot.data, ora: slot.ora, campo } } : {}),
      });
    }
    console.log(`[booking-write] create OK ${slot.data} ${slot.ora} C${campo} per ${member.name}`);
    // 🧾 Dal bot nasce una partita col SOLO organizzatore (`giocatori: [{ nome: member.name }]`),
    // e l'organizzatore `eventi-staff` lo salta già perché è il primo dell'elenco. ⇒ Questa
    // ricevuta oggi non copre niente, ed è una RETE: quel salto poggia sull'ORDINE dell'elenco
    // del circolo, che è una convenzione di Matchpoint e non una promessa. Questa riga invece è
    // un fatto nostro, e regge il giorno in cui l'ordine cambiasse.
    await lasciaRicevuta('create', { data: slot.data, ora: slot.ora, campo }, [
      { persona: member.name, gesto: 'aggiunto' },
    ]);
    return ok({
      member: { id: member.id, name: member.name },
      created: true,
      slot: { data: slot.data, ora: slot.ora, ora_fine: slot.oraFine, durata: slot.durata, campo },
    });
  }

  // ── verifica: COM'È ANDATA DAVVERO ────────────────────────────────────────
  // 🚨⭐⭐ La seconda metà della voce 53. Il terzo esito (`esito_ignoto`, 16/08) ha smesso di
  // mentire, ma il controllo lo fa ancora il SOCIO a mano — *«fra qualche minuto chiedimi cosa
  // ho prenotato»*. Questa azione è la domanda che il bot deve poter fare al posto suo, e la
  // risposta esce **già decisa**: `si` / `no` / `non_ancora`, più `attendere`.
  //
  // ⚖️ È la regola d'architettura del committente (16/08) alla lettera — **il gestionale SA, il
  // bot DICE**. La cosa difficile qui non è guardare se la prenotazione c'è: è sapere se la
  // copia è abbastanza fresca perché la sua ASSENZA voglia dire qualcosa. Quello lo sa solo il
  // gestionale, e per questo la regola sta di qua e non nel bot (`esito-scrittura.ts`).
  //
  // ⛔ Non scrive NIENTE, e non chiama il worker: è la sua ragione d'essere. La cura gemella
  // nell'app va a guardare su Matchpoint, cioè per la strada che è appena caduta; questa legge
  // una copia, e una copia risponde anche a worker morto — vecchia, ma risponde.
  if (action === 'verifica') {
    // L'istante della scrittura lo porta il chiamante: è l'unico che lo conosce, perché la
    // scrittura di cui si parla non ha lasciato una risposta da cui dedurlo. Se manca, di qui
    // non uscirà mai un «no» — vedi `verdettoScrittura`.
    const scrittaAlle = clean(body.scritta_alle) || null;

    // Il socio risulta dentro questo slot? Stesse righe e stesso roster di `leave` e `add`:
    // una partita di quattro sono quattro record, e uno solo porta l'elenco completo.
    const righeVerifica = dayBookings.filter((b) => b.campo === campo && b.ora === slot.ora);
    const esitoVerifica = rosterDelloSlot(righeVerifica, GIOCATORI_PARTITA);
    const presente = [...esitoVerifica.chiavi.keys()].some((nn) => nameVariants.has(nn));

    // 🚨⭐⭐ QUANTE prenotazioni, non SE ce n'è una — la cura del 23/08/2026.
    //
    // Lo stesso roster, ma calcolato **una prenotazione per volta** invece che sull'intero slot.
    // ⇒ Un socio in due prenotazioni distinte dello stesso campo alla stessa ora conta **due**,
    // ed è il doppione: prima passava per un `si`, cioè per la frase «era andata a buon fine».
    //
    // ⚖️ FALLISCE VERSO L'UNO, di proposito: una riga senza identità non fa gruppo a sé (il
    // `continue`), e se nessuna ne ha una il conteggio resta 0 e comanda `presente` come prima.
    // Il verso sbagliato costerebbe un allarme di doppione a chi non ne ha: si può solo
    // trasformare un `si` in un `doppione`, mai perdere un `si`.
    // 📏 Sulla copia di PROD del 23/08 gli slot vivi con più di una prenotazione distinta erano
    // **zero**: la cura non nasce con dei falsi allarmi già addosso.
    const perPrenotazione = new Map<string, DayBooking[]>();
    for (const r of righeVerifica) {
      if (!r.prenotazione) continue;
      const gruppo = perPrenotazione.get(r.prenotazione);
      if (gruppo) gruppo.push(r);
      else perPrenotazione.set(r.prenotazione, [r]);
    }
    let quante = 0;
    for (const righe of perPrenotazione.values()) {
      const roster = rosterDelloSlot(righe, GIOCATORI_PARTITA);
      if ([...roster.chiavi.keys()].some((nn) => nameVariants.has(nn))) quante += 1;
    }

    // ⭐ LA FRESCHEZZA: l'istante dell'ultimo giro di sync ATTERRATO.
    //
    // 🔄 05/09/2026 — SI LEGGE DAL TIMBRO DEL GIRO, non più da `max(synced_at)` sulle righe
    //    prenotazione. Qui c'era: *«si guardano TUTTE le righe, anche le cancellate»*.
    //    ⚖️ Il significato è lo STESSO e la garanzia pure — quel timbro
    //    (`matchpoint_bookings_auto_import_last`) sta nello **stesso upsert** delle righe, quindi
    //    un giro fallito non lo sposta, che è esattamente ciò che rende la freschezza una
    //    testimonianza e non una data.
    //    🚨 Ma il PREZZO era enorme: leggere `max(synced_at)` dalle righe obbligava il sync a
    //    RISCRIVERLE TUTTE a ogni giro, invariate comprese, per tenere il timbro fresco.
    //    📏 Misurato su PROD il 05/09: **437 righe riscritte ogni 2 minuti, di cui 0 cambiate**
    //    — ~250.000 scritture inutili al giorno, e `n_tup_upd` a **14,3 milioni** con
    //    `n_tup_hot_upd` a **ZERO** (ogni riscrittura è una riga nuova più tutti gli indici).
    //    È la fabbrica di WAL che ha portato all'avaria del database quella mattina.
    // 📌 *Un dato che si legge da mille righe obbliga a scrivere mille righe per tenerlo vero:
    //    il costo di una lettura non si paga leggendo, si paga a monte.*
    const { data: frescoRows, error: frescoErr } = await service
      .from('pmo_cloud_records')
      .select('synced_at')
      .eq('record_type', 'matchpoint_data')
      .eq('local_key', 'matchpoint_bookings_auto_import_last')
      .limit(1);
    if (frescoErr) return err(500, 'DB_ERROR', 'Errore lettura freschezza della copia.');
    const copiaFrescaAl = clean(frescoRows?.[0]?.synced_at) || null;

    const verdetto = verdettoScrittura({
      presente,
      quante,
      scrittaAlle,
      copiaFrescaAl,
      giornoSlot: slot.data,
      oggi: today,
    });
    // ⭐ Le PRENOTAZIONI entrano nel registro, ed è la riga che mancava il 23/08: quella di allora
    // diceva «verifica 2026-08-31 09:30 C1 per Maurizio Aprea» — data, ora, campo, nome, e
    // nessun modo di sapere QUALE prenotazione si stesse guardando. Chi ha dovuto capire cosa
    // era successo ha potuto misurarlo solo dal comportamento.
    const quali = [...perPrenotazione.keys()].join(',') || '—';
    console.log(`[booking-write] verifica ${slot.data} ${slot.ora} C${campo} per ${member.name}: ${verdetto.esito}/${verdetto.motivo} (copia al ${copiaFrescaAl ?? '—'}, sue ${quante} di ${perPrenotazione.size} [${quali}])`);
    return ok({
      member: { id: member.id, name: member.name },
      ...verdetto,
      slot: { data: slot.data, ora: slot.ora, campo },
      // ⭐ I due istanti tornano indietro **sempre**, anche quando il verdetto è `si`: senza,
      // un `non_ancora` non sarebbe distinguibile da un guasto, e chi guarda i log dovrebbe
      // fidarsi del verdetto invece di poterlo rifare a mano.
      copia_fresca_al: copiaFrescaAl,
      scritta_alle: scrittaAlle,
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
    const mioNome = mioNomeNelRoster(esito.chiavi, nameVariants);
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

    // ⭐ L'allineamento della copia in app si CALCOLA qui, prima del bivio, e vale per tutt'e
    // due le strade: la prova a vuoto mostra esattamente ciò che poi verrà scritto. Se lo
    // calcolasse solo il ramo vero, la prova direbbe una cosa e la produzione ne farebbe
    // un'altra — ed è proprio la divergenza fra le due che nessuno vedrebbe.
    const copie = righe.filter((b) => b.copiaInApp).map((b) => ({ id: b.id, payload: b.payload }));
    const allineamento = allineaCopiaInApp(copie, nameVariants);

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
          // 🚨⭐⭐ La seconda scrittura, quella che il 28/07 mancava: la copia in app. Sta
          // SEMPRE nella risposta, anche a zero — se questo campo non torna, la richiesta è
          // arrivata a una versione dell'edge che non allinea niente, e uno zero non si
          // potrebbe distinguere da un «non c'era niente da allineare».
          copia_in_app: {
            ...allineamento.conteggi,
            righe_dettaglio: allineamento.righe.map((r) => ({
              id: r.id, stato: r.stato, prima: r.prima, dopo: r.dopo,
              da_giocatori: r.da_giocatori, da_nome: r.da_nome,
            })),
          },
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
        // 🆕🗣️ 01/09 (voce 79) — CHI CHIEDE, perché il fatto che ne nasce lo dirà agli
        // altri. Senza, l'avviso attribuisce al circolo un gesto che il circolo non ha fatto:
        // misurato alle 20:01 su tre telefoni veri. `member.name` e non il nome nel roster —
        // qui il nome non si confronta con niente, si LEGGE, e la scheda è la stessa fonte.
        chiestoDa: member.name,
      }),
    });
    const dataLeave = await resLeave.json().catch(() => null) as JsonMap | null;
    if (!resLeave.ok || !dataLeave?.ok) {
      // 🆕🚨⭐⭐ 29/08/2026 (voce 106) — LA GUARDIA DELL'ESITO IGNOTO, anche qui.
      // Fino a oggi questo ramo diceva «rifiutata» comunque, e su un timeout quella è
      // un'affermazione sul passato che da qui non si può fare. Il bot ora ha la frase per
      // «non lo so» (deploy sulla VM del 29/08, 22:58): la parola non cade più nel generico.
      const ignotoLeave = esitoIgnotoDaRisposta(dataLeave);
      console.error(`[booking-write] leave KO HTTP ${resLeave.status}${ignotoLeave ? ' (ESITO IGNOTO)' : ''}:`, JSON.stringify(dataLeave).slice(0, 300));
      // 🧾🚨 31/08/2026 (voce 83) — come nella `create`: chi chiede è chi esce, quindi la
      // ricevuta è per lui. ⭐ `mioNome` e non `member.name`: il confronto a valle è per nome,
      // e qui vale quello che scrive il gestionale. Vedi `ricevuta.ts`.
      if (ignotoLeave) {
        await lasciaRicevuta('leave-ignoto', { data: slot.data, ora: slot.ora, campo }, [
          { persona: mioNome, gesto: 'tolto' },
        ]);
      }
      return ok({
        member: { id: member.id, name: member.name },
        left: false,
        reason: ignotoLeave ? MOTIVO_ESITO_IGNOTO : MOTIVO_SCRITTURA_RIFIUTATA,
        detail: dettaglioPerIlBot(dataLeave?.message ?? dataLeave?.error ?? `HTTP ${resLeave.status}`),
      });
    }
    // 🚨⭐⭐ Seconda scrittura, e senza di lei l'uscita restava mezza fatta. Il gestionale ha
    // tolto il socio, e il sync riporterà le righe `booking` entro ~2 minuti — ma la COPIA IN
    // APP (`staff_booking`) non la aggiorna nessuno: né l'edit (che scrive solo il registro
    // `staff_edit`), né il sync (scelta esplicita), né il tempo. Si riallinea soltanto quando
    // uno staff apre quella prenotazione nell'app. Finché resta ferma, i ponti dei soci
    // SOMMANO le due copie e rimettono in campo chi è uscito: la partita gli resta
    // nell'elenco e un altro «Esci» rifà l'operazione. Misurato sui dati veri il 28/07 dopo
    // la prima uscita vera → `allinea-copia-app.ts`.
    //
    // ⭐ Best effort, e il verso conta: qui l'uscita **è già riuscita**. Se questo passo
    // fallisce si torna comunque `left: true` — dire al socio «non sei uscito» quando è
    // uscito lo manderebbe a rifare un'operazione già fatta, che è il difetto al contrario.
    // Il guasto si racconta in `copia_in_app.errore` e nel registro, dove lo legge chi indaga.
    const copiaEsito: JsonMap = { ...allineamento.conteggi };
    if (allineamento.daScrivere.length) {
      try {
        // ⚠️ Si tocca `payload` e `updated_at`, nient'altro: `synced_at` dice quando il sync
        // ha visto la riga l'ultima volta, e riscriverlo racconterebbe una bugia. Alzare
        // `updated_at` mette per un po' la riga fra le «fresche» per il reconcile del sync —
        // cioè al riparo dalla cancellazione, che è il verso sicuro.
        const adesso = new Date().toISOString();
        const esiti = await Promise.all(allineamento.daScrivere.map((r) =>
          service.from('pmo_cloud_records')
            .update({ payload: r.payload, updated_at: adesso })
            .eq('id', r.id)));
        const rotte = esiti.filter((e) => e.error);
        if (rotte.length) {
          copiaEsito.errore = clean(rotte[0].error?.message ?? 'UPDATE fallito').slice(0, 200);
          copiaEsito.scritte = allineamento.daScrivere.length - rotte.length;
          console.error(`[booking-write] leave copia in app KO ${slot.data} ${slot.ora} C${campo}: ${rotte.length} righe su ${allineamento.daScrivere.length} non riscritte → ${copiaEsito.errore}`);
        } else {
          console.log(`[booking-write] leave copia in app allineata ${slot.data} ${slot.ora} C${campo}: ${allineamento.daScrivere.length} righe, tolto ${mioNome}`);
        }
      } catch (e) {
        copiaEsito.errore = clean((e as Error)?.message ?? 'errore').slice(0, 200);
        console.error(`[booking-write] leave copia in app KO ${slot.data} ${slot.ora} C${campo}:`, copiaEsito.errore);
      }
    } else if (allineamento.conteggi.non_svuotate) {
      // Non è un guasto: è la regola «mai svuotare la copia». Va detto lo stesso, perché da
      // qui in poi quello slot resta discorde e nessuno lo saprebbe.
      console.warn(`[booking-write] leave copia in app NON svuotata ${slot.data} ${slot.ora} C${campo}: ${allineamento.conteggi.non_svuotate} righe resterebbero senza nessuno`);
    }

    console.log(`[booking-write] leave OK ${slot.data} ${slot.ora} C${campo}: esce ${mioNome} (erano in ${rosterUnito.length})`);
    // 🧾 Sull'uscita il bot non avvisa NESSUNO, per decisione del committente — «avvisa tu i
    // tuoi compagni». Ma il fatto che ne nasce riguarda **chi è uscito da sé**: senza ricevuta
    // il circolo gli annuncerebbe la propria uscita, che è la voce 70 in persona.
    await lasciaRicevuta('leave', { data: slot.data, ora: slot.ora, campo }, [
      { persona: mioNome, gesto: 'tolto' },
    ]);
    return ok({
      member: { id: member.id, name: member.name },
      left: true,
      slot: { data: slot.data, ora: slot.ora, campo },
      giocatori_prima: rosterUnito.length,
      restano: rosterUnito.length - 1,
      copia_in_app: copiaEsito,
    });
  }

  // ── remove ────────────────────────────────────────────────────────────────
  // ✏️ TOGLIERE UN ALTRO GIOCATORE — terzo potere dell'organizzatore (decisione del
  // committente 30/07/2026, ripresa il 4/08: «può togliere chiunque»).
  //
  // 🚨⭐⭐ È la stessa SCRITTURA di `leave` — `matchpoint-bookings-edit` con
  // `players.remove` — e un diverso PERMESSO. Perciò il ramo è modellato riga per riga su
  // quello dell'uscita e ne riusa le stesse funzioni: il roster ricomposto su tutte le righe
  // dello slot, la rete del «mai più di quattro», l'allineamento della copia in app. Scriverne
  // una versione «simile» avrebbe voluto dire due percorsi che divergono in silenzio, e uno
  // dei due provato la metà.
  // 🚨 La differenza che conta, ed è dichiarata: qui il nome tolto **non è il nome di chi
  // chiede**. Ogni posto in cui `leave` usa `nameVariants` per sapere cosa togliere, qui usa
  // il BERSAGLIO — e i due non vanno mai confusi, perché confonderli farebbe uscire
  // l'organizzatore al posto della persona che voleva togliere.
  if (action === 'remove') {
    const prova = dryRun ? { dry_run: true } : {};
    const righe = dayBookings.filter((b) => b.campo === campo && b.ora === slot.ora);
    if (!righe.length) {
      return ok({ member: { id: member.id, name: member.name }, removed: false, reason: 'booking_not_found', ...prova });
    }
    // Gemello del cancello di `leave` e di `cancel`: da una LEZIONE non si toglie nessuno dal
    // bot (il maestro e la segreteria vanno avvisati). Il bot già non mostra il bottone; qui
    // ci si difende dal bot sbagliato — che è il motivo per cui la guardia sta nell'edge.
    if (righe.some((b) => /lezione/i.test(b.tipo))) {
      return ok({ member: { id: member.id, name: member.name }, removed: false, reason: 'non_e_una_partita', ...prova });
    }
    const esito = rosterDelloSlot(righe, GIOCATORI_PARTITA);
    if (esito.incoerente) {
      console.error(`[booking-write] remove roster INCOERENTE ${slot.data} ${slot.ora} C${campo}: ${esito.unione.size} nomi su ${righe.length} righe, e la scheda del circolo non ne dà ${GIOCATORI_PARTITA}`);
      return ok({
        member: { id: member.id, name: member.name },
        removed: false,
        reason: 'roster_incoerente',
        giocatori: esito.unione.size,
        ...prova,
      });
    }
    // Proprietà, prima di ogni altra cosa: di una partita che non è sua al socio non si dice
    // niente — nemmeno che tipo di prenotazione sia. Stessa scelta di `cancel`.
    const mioNome = mioNomeNelRoster(esito.chiavi, nameVariants);
    if (!mioNome) {
      if (sostituito(esito, nameVariants)) {
        return ok({ member: { id: member.id, name: member.name }, removed: false, reason: 'non_piu_in_partita', ...prova });
      }
      return ok({ member: { id: member.id, name: member.name }, removed: false, reason: 'booking_not_found', ...prova });
    }

    // 👥 Il nome di chi chiede è di più persone al circolo? Si guarda PRIMA di decidere, e se
    // non si riesce a rispondere ci si ferma: qui l'errore non si annulla con un tocco — il
    // bot non sa rimettere una persona nella scheda (`prenota` accetta solo data, ora e campo).
    const esitoOmonimi = await omonimiDelSocio('remove', 'non tolgo nessuno');
    if (!esitoOmonimi.ok) return esitoOmonimi.risposta;
    // 🚨⭐⭐ IL DIRITTO È LO STESSO DELL'ANNULLO, e si chiama la stessa funzione: chi può far
    // sparire il campo a tutti e tre può a maggior ragione togliere una persona sola. Una
    // seconda regola gemella qui sarebbe la strada per cui i test restano verdi mentre il
    // comportamento cambia — un test sorveglia proprio che questo ramo la chiami.
    const diritto = dirittoDiAnnullare(righe, nameVariants, esitoOmonimi.omonimi.length > 0);
    if (!diritto.permesso) {
      // ⭐ Gli stessi tre motivi distinti di `cancel`, e per la stessa ragione: mandano il
      // socio a fare tre cose diverse. 🚨 Il nome dell'organizzatore NON esce da qui: chi non
      // ha il diritto non ha bisogno di sapere chi ce l'ha.
      console.log(`[booking-write] remove rifiutato ${slot.data} ${slot.ora} C${campo}: in ${esito.roster.length}, ${diritto.motivo}`);
      return ok({
        member: { id: member.id, name: member.name },
        removed: false,
        reason: diritto.motivo,
        giocatori: esito.roster.length,
        ...prova,
      });
    }

    // 🚨⭐⭐ E ADESSO IL BERSAGLIO, che è la domanda che l'annullo non si pone: il diritto dice
    // «puoi», questa dice «puoi togliere PROPRIO QUESTO». Il perché di ognuno dei tre rifiuti,
    // e la trappola del worker sugli omonimi in campo, stanno in `roster-slot.ts`.
    const bersaglio = bersaglioDaTogliere(esito.roster, diritto.organizzatore ?? '', clean(body.giocatore));
    if (!bersaglio.ok) {
      console.log(`[booking-write] remove rifiutato ${slot.data} ${slot.ora} C${campo}: bersaglio «${clean(body.giocatore)}» → ${bersaglio.motivo}`);
      return ok({
        member: { id: member.id, name: member.name },
        removed: false,
        reason: bersaglio.motivo,
        giocatori: esito.roster.length,
        // ⭐ Chi c'è in campo ADESSO, secondo la lettura che ha deciso l'esito. Su
        // `non_in_partita` è la sola cosa utile che si possa dire: il bot ci ridisegna
        // l'elenco fresco invece di lasciare il socio davanti a un «no» senza strada.
        roster: [...esito.roster],
        ...prova,
      });
    }

    // ⭐ Come in `leave`, l'allineamento della copia in app si calcola PRIMA del bivio, così la
    // prova a vuoto mostra esattamente ciò che poi verrà scritto.
    // 🚨 Le varianti sono quelle del BERSAGLIO, non del socio che chiede: passare
    // `nameVariants` qui toglierebbe dalla copia in app la persona sbagliata — l'organizzatore
    // — lasciando dentro quella che il gestionale ha davvero tolto.
    const copie = righe.filter((b) => b.copiaInApp).map((b) => ({ id: b.id, payload: b.payload }));
    const allineamento = allineaCopiaInApp(copie, new Set([normName(bersaglio.nome)]));

    // 👤 CHI si sta togliendo, per l'avviso del bot. Si chiede **prima** della scrittura di
    // proposito: così finisce anche nella prova a vuoto e si può misurare senza togliere
    // nessuno — la stessa ragione per cui l'allineamento della copia si calcola qui sopra.
    // ⚖️ Dietro un Ospite non c'è una persona: è un posto occupato, e non si cerca nessuno.
    const schedaDelTolto = bersaglio.ospite ? null : await schedaDiChiSiToglie(bersaglio.nome, 'remove');

    if (dryRun) {
      console.log(`[booking-write] remove PROVA A VUOTO ${slot.data} ${slot.ora} C${campo}: ${member.name} toglierebbe ${bersaglio.nome} (in ${esito.roster.length}, su ${righe.length} righe)`);
      return ok({
        member: { id: member.id, name: member.name },
        removed: false,
        dry_run: true,
        would: {
          remove: bersaglio.nome,
          ospite: bersaglio.ospite,
          // `null` non è un guasto: vuol dire «quel nome non è di una persona sola» ⇒ il bot
          // non avviserà nessuno e dirà all'organizzatore di farlo lui.
          scheda_del_tolto: schedaDelTolto,
          slot: { data: slot.data, ora: slot.ora, campo },
          giocatori_prima: esito.roster.length,
          restano: esito.roster.length - 1,
          righe: righe.length,
          roster: [...esito.roster],
          fonte: esito.fonte,
          sommando_le_righe: esito.unione.size,
          id_reserva: righe[0]?.idReserva || null,
          // ⭐ Per quale diritto: qui è sempre «organizzatore» — non esiste un'altra strada per
          // togliere qualcuno — ma scriverlo rende la prova leggibile accanto a quelle di
          // `cancel`, dove invece le strade sono due.
          come: 'organizzatore',
          organizzatore: diritto.organizzatore,
          copia_in_app: {
            ...allineamento.conteggi,
            righe_dettaglio: allineamento.righe.map((r) => ({
              id: r.id, stato: r.stato, prima: r.prima, dopo: r.dopo,
              da_giocatori: r.da_giocatori, da_nome: r.da_nome,
            })),
          },
        },
      });
    }

    const resRemove = await fetch(`${supabaseUrl}/functions/v1/matchpoint-bookings-edit`, {
      method: 'POST',
      headers: internalHeaders,
      body: JSON.stringify({
        ...(righe[0]?.idReserva ? { idReserva: righe[0].idReserva } : {}),
        campo,
        data: slot.data,
        ora: slot.ora,
        players: { remove: [bersaglio.nome] },
        // 🆕🗣️ 01/09 (voce 79) — CHI CHIEDE, perché il fatto che ne nasce lo dirà agli
        // altri. Senza, l'avviso attribuisce al circolo un gesto che il circolo non ha fatto:
        // misurato alle 20:01 su tre telefoni veri. `member.name` e non il nome nel roster —
        // qui il nome non si confronta con niente, si LEGGE, e la scheda è la stessa fonte.
        chiestoDa: member.name,
      }),
    });
    const dataRemove = await resRemove.json().catch(() => null) as JsonMap | null;
    if (!resRemove.ok || !dataRemove?.ok) {
      // 🆕🚨⭐⭐ 29/08/2026 (voce 106) — LA GUARDIA DELL'ESITO IGNOTO, anche qui.
      // Fino a oggi questo ramo diceva «rifiutata» comunque, e su un timeout quella è
      // un'affermazione sul passato che da qui non si può fare. Il bot ora ha la frase per
      // «non lo so» (deploy sulla VM del 29/08, 22:58): la parola non cade più nel generico.
      const ignotoRemove = esitoIgnotoDaRisposta(dataRemove);
      console.error(`[booking-write] remove KO HTTP ${resRemove.status}${ignotoRemove ? ' (ESITO IGNOTO)' : ''}:`, JSON.stringify(dataRemove).slice(0, 300));
      // 🧾⛔ 31/08/2026 (voce 83) — QUI LA RICEVUTA NON SI SCRIVE, ed è una scelta, non una
      // dimenticanza. Il fatto che nascerebbe riguarda **chi viene tolto**, che non è chi ha
      // chiesto: sull'ignoto il bot non gli ha detto niente (`testoSeiStatoTolto` parte solo
      // dopo una rimozione riuscita), quindi coprirlo lo lascerebbe fuori dal campo **senza che
      // nessuno glielo dica**. Meglio un avviso attribuito al circolo che un silenzio.
      return ok({
        member: { id: member.id, name: member.name },
        removed: false,
        reason: ignotoRemove ? MOTIVO_ESITO_IGNOTO : MOTIVO_SCRITTURA_RIFIUTATA,
        detail: dettaglioPerIlBot(dataRemove?.message ?? dataRemove?.error ?? `HTTP ${resRemove.status}`),
      });
    }
    // Seconda scrittura, identica a quella di `leave` e per lo stesso motivo: senza, i ponti
    // sommano le due copie e rimettono in campo chi è stato tolto. ⭐ Best effort col verso
    // giusto: qui la rimozione È GIÀ RIUSCITA, quindi si torna `removed: true` anche se questo
    // passo fallisce — dire «non l'ho tolto» a chi l'ha tolto lo manderebbe a rifarlo.
    // 🕰️⭐⭐ VOCE 121 — SI REGISTRA PRIMA DI PARLARE, e prima di stasera non era così.
    // 🗣️ Regola del committente (01/09): *«Quando togli un giocatore dal bot devi aspettare la
    // conferma del gestionale che questo è avvenuto prima di mostrarlo sul bot.»*
    // 📏 Qui c'era una scrittura **best effort**, con un commento che lo dichiarava — «si torna
    // `removed: true` anche se questo passo fallisce» — quindi il socio poteva leggere «tolto»
    // mentre il gestionale non ne sapeva niente. È la voce 75 su un altro gesto.
    // ⚖️ E la difesa scritta in quel commento era VERA, quindi la cura non è rovesciare il
    // `true` in `false`: la rimozione su Matchpoint **è** avvenuta, e dire «non l'ho tolto» a
    // chi l'ha tolto lo manderebbe a rifarlo. A mancare è la NOSTRA registrazione ⇒ si ritenta,
    // e se non ce la si fa la risposta onesta è «non lo so ancora».
    const copiaEsito: JsonMap = { ...allineamento.conteggi };
    const copiaRemove = await registraConRitenta(
      allineamento.daScrivere.length,
      async () => {
        // ⚠️ Si tocca `payload` e `updated_at`, nient'altro: `synced_at` dice quando il sync ha
        // visto la riga l'ultima volta, e riscriverlo racconterebbe una bugia. Alzare
        // `updated_at` mette per un po' la riga fra le «fresche» per il reconcile del sync —
        // cioè al riparo dalla cancellazione, che è il verso sicuro.
        const adesso = new Date().toISOString();
        return await Promise.all(allineamento.daScrivere.map((r) =>
          service.from('pmo_cloud_records')
            .update({ payload: r.payload, updated_at: adesso })
            .eq('id', r.id)));
      },
    );
    copiaEsito.tentativi = copiaRemove.tentativi;
    if (!copiaRemove.registrata) {
      copiaEsito.errore = clean(copiaRemove.errore ?? 'UPDATE fallito').slice(0, 200);
      copiaEsito.scritte = copiaRemove.scritte;
      console.error(`[booking-write] remove NON REGISTRATA ${slot.data} ${slot.ora} C${campo}: ${copiaRemove.scritte} righe su ${copiaRemove.totali} dopo ${copiaRemove.tentativi} tentativi → ${copiaEsito.errore}`);
      // 🧾⛔ LA RICEVUTA QUI NON SI SCRIVE, ed è la metà che protegge chi non ha chiesto niente.
      // La persona è stata tolta **davvero** dal campo del circolo; lasciando la ricevuta,
      // l'avviso che nascerà dal sync verrebbe soppresso e lei resterebbe fuori **senza che
      // nessuno glielo dica**. È la regola di `ricevuta-ignoto.test.ts`: sull'ignoto si copre
      // solo chi ha chiesto, e qui chi ha chiesto non è chi subisce.
      return ok({
        member: { id: member.id, name: member.name },
        removed: false,
        reason: MOTIVO_ESITO_IGNOTO,
        detail: dettaglioPerIlBot(
          `Il circolo ha eseguito la rimozione ma non sono riuscito a registrarla: ${copiaEsito.errore}`,
        ),
      });
    }
    if (allineamento.daScrivere.length) {
      console.log(`[booking-write] remove copia in app allineata ${slot.data} ${slot.ora} C${campo}: ${allineamento.daScrivere.length} righe in ${copiaRemove.tentativi} tentativi, tolto ${bersaglio.nome}`);
    } else if (allineamento.conteggi.non_svuotate) {
      // Non è un guasto: è la regola «mai svuotare la copia». Va detto lo stesso, perché da qui
      // in poi quello slot resta discorde e nessuno lo saprebbe.
      console.warn(`[booking-write] remove copia in app NON svuotata ${slot.data} ${slot.ora} C${campo}: ${allineamento.conteggi.non_svuotate} righe resterebbero senza nessuno`);
    }

    console.log(`[booking-write] remove OK ${slot.data} ${slot.ora} C${campo}: ${member.name} toglie ${bersaglio.nome} (erano in ${esito.roster.length})`);
    // 🧾 Qui chi subisce NON è chi chiede — ed è proprio il caso in cui il bot parla già, con
    // `testoSeiStatoTolto`. Senza ricevuta la persona tolta riceverebbe due volte la stessa
    // notizia, la seconda attribuita al circolo che non l'ha decisa.
    await lasciaRicevuta('remove', { data: slot.data, ora: slot.ora, campo }, [
      { persona: bersaglio.nome, gesto: 'tolto' },
    ]);
    return ok({
      member: { id: member.id, name: member.name },
      removed: true,
      slot: { data: slot.data, ora: slot.ora, campo },
      // ⭐ CHI è stato tolto, come lo scrive il gestionale: al bot serve per dire la frase
      // giusta e per sapere a chi mandare l'avviso. `ospite` distingue il posto occupato dalla
      // persona: dietro un Ospite non c'è nessuno da avvisare.
      rimosso: bersaglio.nome,
      ospite: bersaglio.ospite,
      // 👤 CHI era, quando quel nome è di una persona sola in anagrafica: è la chiave con cui il
      // bot ritrova la sua chat Telegram senza passare dal nome. `null` = non si sa ⇒ non si
      // avvisa (e non è un errore: la persona è stata tolta lo stesso).
      scheda_del_tolto: schedaDelTolto,
      giocatori_prima: esito.roster.length,
      restano: esito.roster.length - 1,
      copia_in_app: copiaEsito,
    });
  }

  // ── add ───────────────────────────────────────────────────────────────────
  // 🆕 5/08/2026 — IL PEZZO SENZA CUI L'INVITO NON ATTERRA. Fino a oggi questo ponte sapeva
  // creare, uscire, togliere e annullare: sapeva **svuotare** un campo e non riempirlo. Il
  // progetto del committente — «l'organizzatore forma la sua partita» — poggia tutto qui.
  //
  // 🚨⭐⭐ CHI CHIEDE È L'ORGANIZZATORE, non chi entra. Il diritto è lo STESSO di `remove` e di
  // `cancel`, e si chiama la stessa funzione: chi può far sparire il campo a tutti e tre può a
  // maggior ragione farci entrare un quarto. L'invito vive nel database del BOT — questo ponte
  // non lo vede e non deve vederlo: qui si controlla solo che chi chiede abbia il diritto di
  // toccare quel roster.
  //
  // ⚖️ E la differenza con `remove`, che è il motivo per cui non si è potuto riusare il suo
  // corpo: là il bersaglio è una persona GIÀ nel roster e si ritrova per nome; qui è una
  // persona che nel roster non c'è, e l'unica domanda è se **ci sta**.
  if (action === 'add' || action === 'entra') {
    const prova = dryRun ? { dry_run: true } : {};

    /* 🆕🔓 VOCE 88 — `entra` È `add` CON UN'ALTRA SERRATURA, e passa per la stessa strada di
     * proposito. Sotto la porta c'è tutto ciò che `add` ha imparato in un mese: il posto
     * riletto adesso, il codice cliente contro l'id interno, il terzo esito sul timeout, il
     * roster riletto DOPO per vedere se il giocatore si è agganciato davvero.
     * ⛔ Riscrivere quella strada per l'ingresso nuovo avrebbe voluto dire ricominciare da
     * capo a sbagliarci, e la seconda copia avrebbe smesso di imparare insieme alla prima.
     * ⇒ Cambiano DUE cose sole: chi entra (sé stesso, non un invitato) e chi decide se può.
     *
     * 🚨⭐⭐ E L'APERTURA SI GUARDA PER PRIMA, prima ancora di sapere chi è chi. Di una
     * partita che non è aperta al socio non si dice NIENTE — nemmeno che è piena, nemmeno di
     * che livello è. È la regola ① («solo i numeri, e solo delle partite aperte») applicata al
     * caso in cui i numeri non si devono vedere affatto, ed è anche la stessa regola con cui
     * `remove` e `cancel` tacciono su una partita che non è tua. */
    let apertura: JsonMap | null = null;
    if (action === 'entra') {
      const chiave = chiaveApertura(slot.data, slot.ora, campo);
      const { data: righeAperta, error: apertaErr } = await service
        .from('pmo_cloud_records')
        .select('payload')
        .eq('record_type', TIPO_RECORD_APERTURA)
        .eq('local_key', chiave)
        .not('deleted', 'is', true)
        .limit(1);
      if (apertaErr) {
        console.error('[booking-write] entra: errore lettura aperture:', apertaErr.message);
        return err(500, 'DB_ERROR', 'Errore lettura partite aperte.');
      }
      apertura = (righeAperta?.[0]?.payload ?? null) as JsonMap | null;
      if (!apertura) {
        return ok({
          member: { id: member.id, name: member.name },
          added: false, reason: MOTIVI_APERTA.NON_APERTA, ...prova,
        });
      }
    }

    // 🚨⭐⭐ CHI ENTRA ARRIVA COME NUMERO DI SCHEDA DELLA NOSTRA APP, e qui lo si risolve
    // sull'anagrafica NOSTRA. Direttiva ferma del committente (26/07/2026): il bot parla con
    // il gestionale, non con Matchpoint — quindi non gli si fa mandare né il nome come lo
    // scrive la scheda del circolo né il codice cliente. Quelle due cose vivono di qua.
    // ⭐ È anche più solido: un nome mandato dal bot dovrebbe combaciare con la grafia della
    // scheda, e le due divergono («Nome Cognome» / «Cognome Nome»).
    /* 🆕🔓 VOCE 88 — in `entra` chi entra è CHI CHIEDE, e non c'è modo di dire altrimenti:
     * `giocatore_id` non si legge nemmeno. ⚖️ Non è una scorciatoia — è la differenza fra una
     * partita aperta e una lista di persone che si possono infilare in campo da un bot. */
    const idDaAggiungere = action === 'entra' ? member.id : clean(body.giocatore_id);
    if (!idDaAggiungere) {
      return ok({ member: { id: member.id, name: member.name }, added: false, reason: 'giocatore_mancante', ...prova });
    }
    const { data: schede, error: schedaErr } = await service
      .from('pmo_cloud_records')
      .select('payload')
      .eq('record_type', 'member')
      .not('deleted', 'is', true)
      .eq('payload->>id', idDaAggiungere)
      .limit(2);
    if (schedaErr) {
      console.error('[booking-write] add: errore lettura anagrafica:', schedaErr.message);
      return err(500, 'DB_ERROR', 'Errore lettura anagrafica.');
    }
    // 🚨 Zero o più di una ⇒ non si scrive. Una scheda sola è la condizione perché «questa
    // persona» voglia dire qualcosa: con due, mettere in campo la sbagliata non si torna
    // indietro — il bot sa aggiungere e togliere, non sa rimediare a un'identità scambiata.
    if (!schede || schede.length !== 1) {
      console.warn(`[booking-write] add: ${schede?.length ?? 0} schede per id ${idDaAggiungere}`);
      return ok({
        member: { id: member.id, name: member.name },
        added: false,
        reason: (schede?.length ?? 0) > 1 ? 'giocatore_ambiguo' : 'giocatore_sconosciuto',
        ...prova,
      });
    }
    const schedaDaAggiungere = (schede[0].payload ?? {}) as JsonMap;
    const nomeDaAggiungere = clean(schedaDaAggiungere.name)
      || [clean(schedaDaAggiungere.firstName), clean(schedaDaAggiungere.surname)].filter(Boolean).join(' ');
    // 🚨⭐⭐ SOLO UN CLIENTE DEL CIRCOLO PUÒ ENTRARE DA QUI — decisione del committente del
    // 6/08/2026, che **ribalta** quella del 30/07: *«ho cambiato idea e l'ospite lo può mettere
    // solamente la segreteria»*.
    // ⇒ Prima chi non aveva il codice entrava come **«Ospite»**: il posto era preso davvero, il
    // nome sulla scheda no. Adesso quel ramo NON ESISTE PIÙ: si rifiuta, e chi non è cliente
    // passa dalla segreteria.
    // 📊 Misurato su PROD il 6/08, in sola lettura: **1.081 soci su 2.797 (38,6%)** hanno il
    // codice, **1.716 (61,4%) no**. ⇒ Il rifiuto è il caso FREQUENTE, non quello raro — motivo
    // per cui il bot toglie il bottone PRIMA, e questa riga è la seconda serratura, non la sola.
    // 🚨 Solo le CIFRE valgono come codice del circolo: in `memberId` l'app scrive anche i suoi
    // «PMO-000000», che sono NOSTRI e al circolo non esistono.
    // ⚠️⭐ GEMELLA di `clienteDelCircolo` in `consumer-player-readmodel/cliente-del-circolo.ts`,
    // che è la funzione che toglie il bottone: le due rispondono alla STESSA domanda da due
    // funzioni diverse, e le funzioni non si possono importare fra loro (`_shared/` non si
    // deploya). Fino al 6/08 divergevano — qui `{4,6}`, là `{6}` — e la differenza era latente:
    // misurato che le cifre sono SEI per tutti e 1.081, e zero record con 4 o 5. Allineate a
    // `{6}`: due regole diverse per la stessa domanda si accorgono di esserlo il giorno peggiore.
    const codiceGrezzo = clean(schedaDaAggiungere.memberId);
    const codiceDaAggiungere = /^[0-9]{6}$/.test(codiceGrezzo) ? codiceGrezzo : '';
    if (!codiceDaAggiungere) {
      console.log(`[booking-write] add rifiutato ${slot.data} ${slot.ora} C${campo}: ${idDaAggiungere} non è cliente del circolo`);
      return ok({ member: { id: member.id, name: member.name }, added: false, reason: 'non_cliente', ...prova });
    }
    if (!nomeDaAggiungere) {
      return ok({ member: { id: member.id, name: member.name }, added: false, reason: 'giocatore_senza_nome', ...prova });
    }
    // ⚖️ Da qui in giù il nome sulla scheda del circolo È il nome della persona, sempre: non
    // c'è più il bivio dell'Ospite. La costante resta viva perché `remove` e il conteggio del
    // roster devono ancora saper riconoscere gli Ospiti **messi dalla segreteria**.
    const nomeSullaScheda = nomeDaAggiungere;

    const righe = dayBookings.filter((b) => b.campo === campo && b.ora === slot.ora);
    if (!righe.length) {
      return ok({ member: { id: member.id, name: member.name }, added: false, reason: 'booking_not_found', ...prova });
    }
    // Gemello del cancello di `leave`, `cancel` e `remove`: a una LEZIONE non si aggiunge
    // nessuno dal bot — i posti li decide il maestro. Il bot già non mostra il bottone; qui ci
    // si difende dal bot sbagliato, che è il motivo per cui la guardia sta nell'edge.
    if (righe.some((b) => /lezione/i.test(b.tipo))) {
      return ok({ member: { id: member.id, name: member.name }, added: false, reason: 'non_e_una_partita', ...prova });
    }

    const esito = rosterDelloSlot(righe, GIOCATORI_PARTITA);
    if (esito.incoerente) {
      console.error(`[booking-write] add roster INCOERENTE ${slot.data} ${slot.ora} C${campo}: ${esito.unione.size} nomi su ${righe.length} righe, e la scheda del circolo non ne dà ${GIOCATORI_PARTITA}`);
      return ok({
        member: { id: member.id, name: member.name },
        added: false, reason: 'roster_incoerente', giocatori: esito.unione.size, ...prova,
      });
    }

    /* 🚨⭐⭐ LA SERRATURA, ed è l'UNICA cosa che distingue i due ingressi.
     *
     * · `add`   → **proprietà**: si fa entrare qualcuno in una partita che è TUA. Di una
     *            partita che non è sua al socio non si dice niente, nemmeno che tipo di
     *            prenotazione sia (stessa regola di `remove`).
     * · `entra` → **apertura**: la partita non è tua, e proprio per questo la porta è più
     *            stretta — la regola ③ (cliente del circolo, già passata qui sopra) più la ④
     *            (livello a un passo), più la decisione ① sul non-livello.
     *
     * ⚖️ Le due non si sommano e non si sostituiscono a vicenda: sono due modi diversi di
     * avere il diritto, e la seconda non è un'attenuazione della prima. Chi entra da una
     * partita aperta non acquista NESSUN diritto sulla partita — non può a sua volta far
     * entrare altri, perché quella strada è ancora `add` e `add` chiede la proprietà. */
    let organizzatoreDelGesto: string | null = null;
    if (action === 'entra') {
      /* La scheda di chi ha aperto, riletta ADESSO. ⚠️ NON si crede al livello scritto
       * nell'apertura: fra allora e adesso la segreteria può aver rimesso quella scheda a
       * «da definire», e la banda del ±0,5 si calcolerebbe attorno a un non-dato. */
      const idOrganizzatore = clean(apertura?.aperta_da_member_local_id);
      const { data: righeOrg, error: orgErr } = await service
        .from('pmo_cloud_records')
        .select('payload')
        .eq('record_type', 'member')
        .not('deleted', 'is', true)
        .eq('payload->>id', idOrganizzatore)
        .limit(2);
      if (orgErr) {
        console.error('[booking-write] entra: errore lettura scheda di chi ha aperto:', orgErr.message);
        return err(500, 'DB_ERROR', 'Errore lettura anagrafica.');
      }
      /* 🚨 Zero o più di una ⇒ la banda non ha un centro leggibile, e si tace. FAIL CLOSED
       * come dappertutto: un «non lo so» che apre è un estraneo in campo, e il bot sa
       * aggiungere ma non sa rimediare. */
      const schedaOrg = (righeOrg?.length === 1 ? righeOrg[0].payload : null) as JsonMap | null;
      const decisione = decidiIngresso({
        aperta: !!schedaOrg,
        organizzatore: { level: schedaOrg?.level, levelSource: schedaOrg?.levelSource },
        candidato: { level: member.level, levelSource: member.levelSource, memberId: member.memberId },
        giocatoriInCampo: esito.roster.length,
        giaInPartita: !!mioNomeNelRoster(esito.chiavi, nameVariants),
        // Già deciso qui sopra da `codiceDaAggiungere`, che per `entra` è il codice di chi
        // chiede: arrivare fin qui vuol dire che quella porta è passata.
        clienteDelCircolo: true,
      });
      if (!decisione.ok) {
        console.log(`[booking-write] entra rifiutato ${slot.data} ${slot.ora} C${campo}: ${decisione.motivo} (in ${esito.roster.length})`);
        return ok({
          member: { id: member.id, name: member.name },
          added: false, reason: decisione.motivo, giocatori: esito.roster.length, ...prova,
        });
      }
      organizzatoreDelGesto = clean(apertura?.organizzatore) || null;
    } else {
      // Proprietà prima di ogni altra cosa, come in `remove`: di una partita che non è sua al
      // socio non si dice niente, nemmeno che tipo di prenotazione sia.
      const mioNomeAdd = mioNomeNelRoster(esito.chiavi, nameVariants);
      if (!mioNomeAdd) {
        if (sostituito(esito, nameVariants)) {
          return ok({ member: { id: member.id, name: member.name }, added: false, reason: 'non_piu_in_partita', ...prova });
        }
        return ok({ member: { id: member.id, name: member.name }, added: false, reason: 'booking_not_found', ...prova });
      }

      const esitoOmonimiAdd = await omonimiDelSocio('add', 'non aggiungo nessuno');
      if (!esitoOmonimiAdd.ok) return esitoOmonimiAdd.risposta;
      const dirittoAdd = dirittoDiAnnullare(righe, nameVariants, esitoOmonimiAdd.omonimi.length > 0);
      if (!dirittoAdd.permesso) {
        console.log(`[booking-write] add rifiutato ${slot.data} ${slot.ora} C${campo}: in ${esito.roster.length}, ${dirittoAdd.motivo}`);
        return ok({
          member: { id: member.id, name: member.name },
          added: false, reason: dirittoAdd.motivo, giocatori: esito.roster.length, ...prova,
        });
      }
      organizzatoreDelGesto = dirittoAdd.organizzatore;
    }

    // 🚨⭐⭐ IL POSTO C'È? È la domanda che le altre azioni non si pongono, ed è l'unica
    // barriera fra un invito accettato e un campo da CINQUE. Si conta sul roster riletto
    // adesso, non su quello che il bot aveva in mano quando ha mandato l'invito: fra le due
    // cose possono essere passati giorni.
    if (esito.roster.length >= GIOCATORI_PARTITA) {
      console.log(`[booking-write] add rifiutato ${slot.data} ${slot.ora} C${campo}: già in ${esito.roster.length}`);
      return ok({
        member: { id: member.id, name: member.name },
        added: false, reason: 'al_completo', giocatori: esito.roster.length, ...prova,
      });
    }
    // C'è già? Non è un errore da raccontare come guasto: è la corsa vinta due volte, o un
    // secondo tocco sullo stesso bottone. Chi legge deve dire «ci sei già», non «non entri».
    if (esito.roster.some((n) => normName(n) === normName(nomeDaAggiungere))) {
      return ok({
        member: { id: member.id, name: member.name },
        added: false, reason: 'gia_in_partita', giocatori: esito.roster.length, ...prova,
      });
    }

    // ⭐ Come in `leave` e `remove`, la copia in app si calcola PRIMA del bivio, così la prova
    // a vuoto mostra esattamente ciò che poi verrà scritto.
    const copieAdd = righe.filter((b) => b.copiaInApp).map((b) => ({ id: b.id, payload: b.payload }));
    // ⚠️ Nella copia va il nome che finisce SULLA SCHEDA. Dal 6/08 i due coincidono sempre
    // (entra solo chi è cliente), ma la riga resta scritta così: era il bivio dell'Ospite, e
    // il giorno che qualcuno lo riaprisse la copia deve tornare a seguire la SCHEDA, non la
    // persona — o la sincronizzazione conterebbe due giocatori dove ce n'è uno.
    const aggiuntaCopia = aggiungiACopiaInApp(copieAdd, nomeSullaScheda);

    if (dryRun) {
      console.log(`[booking-write] add PROVA A VUOTO ${slot.data} ${slot.ora} C${campo}: ${member.name} farebbe entrare ${nomeDaAggiungere} (in ${esito.roster.length}, su ${righe.length} righe)`);
      return ok({
        member: { id: member.id, name: member.name },
        added: false,
        dry_run: true,
        would: {
          add: nomeDaAggiungere,
          // ⭐ Il nome che finirebbe SULLA SCHEDA, che può non essere quello della persona.
          // È la riga più importante della prova a vuoto: dice se il circolo saprà chi è.
          sulla_scheda: nomeSullaScheda,
          // 🚨 20/08 — si chiama `codice_cliente` e non `codice`, perché è il codice CLIENTE
          // («001013-Lidia Comes») e non l'id interno di Matchpoint. Il nome corto è quello
          // che ha coperto per settimane lo scambio fra le due numerazioni: una prova a vuoto
          // che riporta un numero deve dire QUALE numero è.
          codice_cliente: codiceDaAggiungere,
          // ⚖️ Resta scritto anche se ormai può valere solo 'socio': una prova a vuoto che
          // NON dice come si entrerebbe smetterebbe di essere una prova il giorno che i modi
          // tornassero due.
          come: 'socio',
          slot: { data: slot.data, ora: slot.ora, campo },
          giocatori_prima: esito.roster.length,
          giocatori_dopo: esito.roster.length + 1,
          righe: righe.length,
          roster: [...esito.roster],
          fonte: esito.fonte,
          sommando_le_righe: esito.unione.size,
          id_reserva: righe[0]?.idReserva || null,
          organizzatore: organizzatoreDelGesto,
          copia_in_app: {
            ...aggiuntaCopia.conteggi,
            righe_dettaglio: aggiuntaCopia.righe.map((r) => ({
              id: r.id, stato: r.stato, prima: r.prima, dopo: r.dopo,
            })),
          },
        },
      });
    }

    // 🚨⭐⭐ IL TERZO ESITO ANCHE QUI — 16/08/2026, voce 53. La cura del mattino aveva protetto
    // solo `create`; questa `fetch` restava scoperta, e delle cinque è la seconda che fa danno
    // vero: un doppio `add` mette **cinque giocatori in campo**.
    // ⚖️ E la rete del «mai più di quattro» NON lo ferma — verificato ESEGUENDO il 16/08, non
    // dedotto: con la copia ferma a 3 il secondo tentativo passa, e nemmeno il controllo «ci sei
    // già» lo vede. La causa non è la rete scritta male: sono le sue FONTI, che sono tutte la
    // copia — compresa la «scheda del circolo», che è la `descrizione` delle righe sincronizzate.
    // Dentro la finestra del sync (misurata: fino a 10′04″) quel dato non c'è ancora.
    // ⇒ Qui non si ritenta e non si indovina: si dice «non lo so», e il socio non rifà.
    const scrittaAddAlle = new Date().toISOString();
    let resAdd: Response;
    try {
      resAdd = await fetch(`${supabaseUrl}/functions/v1/matchpoint-bookings-edit`, {
        method: 'POST',
        headers: internalHeaders,
        body: JSON.stringify({
          ...(righe[0]?.idReserva ? { idReserva: righe[0].idReserva } : {}),
          campo,
          data: slot.data,
          ora: slot.ora,
          players: {
            // 🚨⭐⭐ 20/08 — LA COMPOSIZIONE STA IN UNA FUNZIONE SOLA, e non è pignoleria:
            // fin qui il codice CLIENTE partiva dentro `codice`, che il worker confronta con
            // l'ID INTERNO. Per Lidia: 1013 contro 1034 ⇒ rifiuto, ogni volta, per chiunque.
            // Il perché delle due numerazioni sta in `giocatore-da-aggiungere.ts`, coi numeri.
            add: [giocatoreDaAggiungere({
              nome: nomeSullaScheda,
              codiceCliente: codiceDaAggiungere,
              idInterno: schedaDaAggiungere.matchpointIdInterno,
            })],
          },
          // 🆕🗣️ 01/09 (voce 79) — CHI CHIEDE. ⭐ Su `add` è l'ORGANIZZATORE e su `entra`
          // è chi entra: sono due persone diverse, ed è giusto così — la domanda a cui questo
          // campo risponde è *«chi l'ha chiesto?»*, non *«chi si è mosso?»*. È la stessa
          // distinzione su cui poggia la ricevuta della voce 70.
          chiestoDa: member.name,
        }),
      });
    } catch (netErr) {
      const testo = netErr instanceof Error ? netErr.message : String(netErr);
      console.error(`[booking-write] add ESITO IGNOTO (nessuna risposta dal gestionale) ${slot.data} ${slot.ora} C${campo}: ${testo}`);
      return ok({
        member: { id: member.id, name: member.name },
        added: false,
        reason: MOTIVO_ESITO_IGNOTO,
        detail: dettaglioPerIlBot(`Nessuna risposta dal gestionale: ${testo}`),
        scritta_alle: scrittaAddAlle,
        slot: { data: slot.data, ora: slot.ora, campo },
      });
    }
    const dataAdd = await resAdd.json().catch(() => null) as JsonMap | null;
    if (!resAdd.ok || !dataAdd?.ok) {
      // 🆕🚨⭐⭐ 29/08/2026 (voce 106) — LA GUARDIA DELL'ESITO IGNOTO, anche qui.
      // Fino a oggi questo ramo diceva «rifiutata» comunque, e su un timeout quella è
      // un'affermazione sul passato che da qui non si può fare. Il bot ora ha la frase per
      // «non lo so» (deploy sulla VM del 29/08, 22:58): la parola non cade più nel generico.
      const ignotoAdd = esitoIgnotoDaRisposta(dataAdd);
      console.error(`[booking-write] add KO HTTP ${resAdd.status}${ignotoAdd ? ' (ESITO IGNOTO)' : ''}:`, JSON.stringify(dataAdd).slice(0, 300));
      // 🧾⛔ 31/08/2026 (voce 83) — nessuna ricevuta sull'`add`, per la stessa ragione del
      // `remove` e con la misura della voce 70 dietro: lì **chi chiede è l'ORGANIZZATORE**,
      // non chi entra (`mioNomeAdd` esige che il richiedente sia già nel roster). Coprire
      // l'ingresso significherebbe zittire l'unica notizia che arriverebbe a chi è entrato.
      //
      // 🧾🆕🔓 01/09/2026, VOCE 88 — E SU `entra` LA RISPOSTA SI ROVESCIA, perché si rovescia
      // il fatto: lì chi chiede **è** chi viene toccato. ⇒ Ricade nella metà buona della
      // regola della voce 83 («sull'ignoto la ricevuta copre SOLO CHI HA CHIESTO»), insieme a
      // `create` e a `leave`, e la si lascia.
      // ⚖️ Perché conta: se la scrittura era passata, il sync fra 4 e 19 minuti vedrà un
      // giocatore comparire e lo annuncerà **come gesto del circolo** a chi l'ha appena fatto
      // da sé. Senza la ricevuta il socio legge «non lo so ancora» dal bot e poi «il circolo
      // ti ha aggiunto» — due messaggi che insieme non dicono nessuna verità.
      // 🚨 E il costo è dichiarato, com'è per gli altri: se la scrittura NON era passata e la
      // segreteria fa lo stesso gesto sulla stessa persona dentro la finestra, quel socio
      // perde **un** avviso. Uno, perché la ricevuta si consuma, e solo lui.
      if (action === 'entra' && ignotoAdd) {
        await lasciaRicevuta('entra-ignoto', { data: slot.data, ora: slot.ora, campo }, [
          { persona: nomeSullaScheda, gesto: 'aggiunto' },
        ]);
      }
      return ok({
        member: { id: member.id, name: member.name },
        added: false,
        reason: ignotoAdd ? MOTIVO_ESITO_IGNOTO : MOTIVO_SCRITTURA_RIFIUTATA,
        detail: dettaglioPerIlBot(dataAdd?.message ?? dataAdd?.error ?? `HTTP ${resAdd.status}`),
      });
    }

    // 🚨⭐⭐ «OK» DEL WORKER NON VUOL DIRE «È ENTRATO», ed è il difetto #624 in persona: là un
    // codice cliente scambiato per un id interno faceva rispondere «✅ confermato» a fronte di
    // un giocatore che in campo non c'era. La lezione che ne era rimasta è **misura che il
    // DATO sia arrivato**, non che la chiamata sia andata bene.
    //
    // ⇒ La prova è `partecipantiFinali`: il roster **riletto dalla scheda del circolo** DOPO
    // la modifica. Non è una nostra deduzione, è ciò che c'è scritto là.
    // ⚠️ Si CONTA e non si cerca il nome. Dal 6/08 chi entra porta il proprio nome, quindi
    // cercarlo sarebbe possibile — ma resta un conteggio di proposito: il nome sulla scheda
    // del circolo ha una grafia sua («Cognome Nome»), e un confronto che sbaglia direbbe «non
    // entrato» su un giocatore entrato davvero. Contare non ha grafie.
    const workerAdd = (dataAdd?.worker ?? null) as JsonMap | null;
    const finali = Array.isArray(workerAdd?.partecipantiFinali)
      ? (workerAdd.partecipantiFinali as JsonMap[])
      : null;
    if (finali) {
      if (finali.length <= esito.roster.length) {
        console.error(`[booking-write] add NON AGGANCIATO ${slot.data} ${slot.ora} C${campo}: ${nomeSullaScheda} — la scheda ne conta ${finali.length}, erano ${esito.roster.length}`);
        return ok({
          member: { id: member.id, name: member.name },
          added: false,
          reason: 'non_agganciato',
          detail: dettaglioPerIlBot(`la scheda del circolo conta ${finali.length} giocatori, erano ${esito.roster.length}`),
          giocatori: finali.length,
        });
      }
    } else {
      // ⚠️ Niente roster riletto ⇒ non si può dire né sì né no da qui. Si prosegue (l'HTTP è
      // andato bene) ma resta scritto: «non ho misurato» e «ho misurato che va bene» sono due
      // cose diverse, e confonderle è ciò che è costato il #624.
      console.warn(`[booking-write] add: il worker non ha rimandato il roster ${slot.data} ${slot.ora} C${campo} — esito non verificabile da qui`);
    }

    // Seconda scrittura, gemella di quella di `leave` e `remove` e per la ragione opposta:
    // là senza questo passo i ponti rimettevano in campo chi era uscito, qui senza questo
    // passo continuerebbero a vedere un posto libero che non c'è più — e un secondo invitato
    // entrerebbe quinto. ⭐ Best effort col verso giusto: l'aggiunta È GIÀ RIUSCITA, quindi si
    // torna `added: true` anche se questo passo fallisce.
    const copiaEsitoAdd: JsonMap = { ...aggiuntaCopia.conteggi };
    if (aggiuntaCopia.daScrivere.length) {
      try {
        const adesso = new Date().toISOString();
        const esiti = await Promise.all(aggiuntaCopia.daScrivere.map((r) =>
          service.from('pmo_cloud_records')
            .update({ payload: r.payload, updated_at: adesso })
            .eq('id', r.id)));
        const rotte = esiti.filter((e) => e.error);
        if (rotte.length) {
          copiaEsitoAdd.errore = clean(rotte[0].error?.message ?? 'UPDATE fallito').slice(0, 200);
          copiaEsitoAdd.scritte = aggiuntaCopia.daScrivere.length - rotte.length;
          console.error(`[booking-write] add copia in app KO ${slot.data} ${slot.ora} C${campo}: ${rotte.length} righe su ${aggiuntaCopia.daScrivere.length} non riscritte → ${copiaEsitoAdd.errore}`);
        } else {
          console.log(`[booking-write] add copia in app allineata ${slot.data} ${slot.ora} C${campo}: ${aggiuntaCopia.daScrivere.length} righe, entrato ${nomeDaAggiungere}`);
        }
      } catch (e) {
        copiaEsitoAdd.errore = clean((e as Error)?.message ?? 'errore').slice(0, 200);
        console.error(`[booking-write] add copia in app KO ${slot.data} ${slot.ora} C${campo}:`, copiaEsitoAdd.errore);
      }
    } else {
      // 🚨 Dichiarato e non nascosto: nessuna riga della copia porta un elenco `giocatori` su
      // cui scrivere ⇒ per ~2 minuti questo ponte continuerà a vedere un posto libero in più.
      // Chi legge i registri deve poter riconoscere questa finestra quando succede.
      console.warn(`[booking-write] add: nessuna copia in app da allineare ${slot.data} ${slot.ora} C${campo} — il conteggio resta indietro fino al prossimo giro di sincronizzazione`);
    }

    console.log(`[booking-write] add OK ${slot.data} ${slot.ora} C${campo}: ${member.name} fa entrare ${nomeSullaScheda} (codice ${codiceDaAggiungere}) — erano in ${esito.roster.length}`);
    // 🧾⭐ È IL CASO DA CUI LA VOCE 70 NASCE, misurato il 21/08: Lidia tocca «Ci sto», il bot le
    // dice «✅ Sei in campo», e il circolo glielo ripete. ⚠️ Si scrive `nomeSullaScheda` e non
    // il nome della persona: è quello che il sync rileggerà dalla scheda del circolo, quindi è
    // l'unico su cui il fatto e la ricevuta possono riconoscersi.
    // ⭐ L'azione porta il PROPRIO nome (`add` o `entra`): la ricevuta è anche il registro di
    // chi ha fatto cosa, e due gesti diversi che si firmano uguale rendono illeggibile la
    // colonna il giorno in cui la si va a guardare per capire un avviso di troppo.
    await lasciaRicevuta(action, { data: slot.data, ora: slot.ora, campo }, [
      { persona: nomeSullaScheda, gesto: 'aggiunto' },
    ]);
    return ok({
      member: { id: member.id, name: member.name },
      added: true,
      slot: { data: slot.data, ora: slot.ora, campo },
      // ⭐ Chi è entrato è la PERSONA, e il bot deve poterle parlare col suo nome.
      entrato: nomeDaAggiungere,
      sulla_scheda: nomeSullaScheda,
      // ⚖️ `ospite` NON sparisce dalla risposta pur valendo ormai sempre `false`: il bot che
      // la legge può essere più vecchio o più nuovo di questa funzione, e un campo che sparisce
      // si legge come «non lo so». Da qui in poi è una promessa: **da questo ponte non entra
      // più nessun Ospite**.
      ospite: false,
      giocatori_prima: esito.roster.length,
      // ⭐ Il conto che si racconta è quello RILETTO dalla scheda quando c'è: un «+1» calcolato
      // da noi sarebbe di nuovo una deduzione, che è esattamente ciò che il #624 ha insegnato
      // a non fare.
      giocatori_dopo: finali ? finali.length : esito.roster.length + 1,
      copia_in_app: copiaEsitoAdd,
    });
  }

  // ── 🔓 apri / chiudi — la regola ② delle Partite Aperte (voce 88) ──────────
  //
  // 🚨⭐⭐ QUESTE DUE AZIONI NON TOCCANO MATCHPOINT, e non è una semplificazione: è la forma
  // giusta. «Questa partita è aperta ad altri» è un fatto NOSTRO — al circolo non risulta,
  // non gli serve, e il giorno in cui Matchpoint si spegne queste due righe non cambiano di
  // una virgola. È la prova del futuro applicata a un gesto nuovo: *se una modifica dovesse
  // toccarlo quel giorno, è già sbagliata adesso.*
  // ⇒ Niente worker, niente `matchpoint-bookings-edit`, niente esito ignoto: la scrittura è
  // locale e o riesce o fallisce, e lo sappiamo subito. Il terzo esito qui non esiste perché
  // non c'è nessun intermediario che possa smettere di rispondere.
  //
  // ⚖️ E il gesto è REVERSIBILE per decisione sua: si apre e si richiude. `chiudi` non toglie
  // nessuno dal campo — chi è già entrato ci resta, perché è entrato quando la porta era
  // aperta. Chiudere una porta non è mandare via chi è già in casa.
  if (action === 'apri' || action === 'chiudi') {
    const righeAp = dayBookings.filter((b) => b.campo === campo && b.ora === slot.ora);
    if (!righeAp.length) {
      return ok({ member: { id: member.id, name: member.name }, aperta: false, reason: 'booking_not_found' });
    }
    // Gemello dei cancelli di `add`, `leave` e `cancel`: una LEZIONE non si apre a nessuno —
    // i posti li decide il maestro. Il bot già non mostrerà il bottone; qui ci si difende dal
    // bot sbagliato, che è il motivo per cui la guardia sta nell'edge.
    if (righeAp.some((b) => /lezione/i.test(b.tipo))) {
      return ok({ member: { id: member.id, name: member.name }, aperta: false, reason: 'non_e_una_partita' });
    }

    const esitoAp = rosterDelloSlot(righeAp, GIOCATORI_PARTITA);
    if (esitoAp.incoerente) {
      console.error(`[booking-write] ${action} roster INCOERENTE ${slot.data} ${slot.ora} C${campo}: ${esitoAp.unione.size} nomi su ${righeAp.length} righe`);
      return ok({ member: { id: member.id, name: member.name }, aperta: false, reason: 'roster_incoerente' });
    }
    // Proprietà prima di tutto, come altrove: di una partita che non è sua non si dice niente.
    if (!mioNomeNelRoster(esitoAp.chiavi, nameVariants)) {
      return ok({ member: { id: member.id, name: member.name }, aperta: false, reason: 'booking_not_found' });
    }
    // ⭐ Il diritto è lo STESSO di chi può annullare — l'organizzatore, cioè il primo
    // dell'elenco ordinato della scheda del circolo. Non se ne inventa un secondo: due
    // definizioni di «di chi è questa partita» divergono, e la divergenza si vedrebbe solo il
    // giorno in cui una delle due lascia aprire la partita di un altro.
    const esitoOmonimiAp = await omonimiDelSocio(action, action === 'apri' ? 'non apro niente' : 'non chiudo niente');
    if (!esitoOmonimiAp.ok) return esitoOmonimiAp.risposta;
    const dirittoAp = dirittoDiAnnullare(righeAp, nameVariants, esitoOmonimiAp.omonimi.length > 0);
    if (!dirittoAp.permesso) {
      console.log(`[booking-write] ${action} rifiutato ${slot.data} ${slot.ora} C${campo}: ${dirittoAp.motivo}`);
      return ok({
        member: { id: member.id, name: member.name },
        aperta: false, reason: dirittoAp.motivo, giocatori: esitoAp.roster.length,
      });
    }

    const chiave = chiaveApertura(slot.data, slot.ora, campo);
    if (!chiave) return err(400, 'INVALID_CAMPO', 'Slot non identificabile.');

    if (action === 'chiudi') {
      const { error: chiudiErr } = await service
        .from('pmo_cloud_records')
        .update({ deleted: true, updated_at: new Date().toISOString() })
        .eq('record_type', TIPO_RECORD_APERTURA)
        .eq('local_key', chiave);
      if (chiudiErr) {
        console.error(`[booking-write] chiudi KO ${chiave}:`, chiudiErr.message);
        return err(500, 'DB_ERROR', 'Errore chiusura della partita aperta.');
      }
      console.log(`[booking-write] chiudi OK ${chiave}: ${member.name}`);
      return ok({
        member: { id: member.id, name: member.name },
        aperta: false, chiusa: true, slot: { data: slot.data, ora: slot.ora, campo },
      });
    }

    /* 🚨⭐⭐ LA DECISIONE ① SUL LATO CHE NON VIENE IN MENTE: senza un livello DIMOSTRATO non
     * si può APRIRE. È la metà della regola che non si chiude impedendo di entrare, e senza
     * la quale l'altra non serve: la banda del ±0,5 attorno a «da definire» conterrebbe tutti
     * i 2.283 soci che stanno lì, cioè un filtro che non filtra nessuno.
     * ⭐ Ed è la stessa regola per cui già oggi «senza livello non si organizza»: qui non se
     * ne aggiunge una nuova, si applica quella che c'è a una porta nuova. */
    if (!puoAprire({ level: member.level, levelSource: member.levelSource })) {
      console.log(`[booking-write] apri rifiutato ${chiave}: ${member.name} non ha un livello dimostrato`);
      return ok({
        member: { id: member.id, name: member.name },
        aperta: false, reason: MOTIVI_APERTA.SERVE_IL_TEST,
      });
    }
    // 🚨 Al completo non si apre: una partita aperta di cui non si può entrare è una vetrina
    // che promette un posto che non c'è. ⭐ Si conta ADESSO, non su ciò che il bot ricordava.
    if (esitoAp.roster.length >= GIOCATORI_PARTITA) {
      return ok({
        member: { id: member.id, name: member.name },
        aperta: false, reason: MOTIVI_APERTA.AL_COMPLETO, giocatori: esitoAp.roster.length,
      });
    }

    /* ⛔ NEL PAYLOAD NON C'È IL LIVELLO, ed è deliberato. Sarebbe comodo — chi elenca lo
     * troverebbe già lì — e sarebbe una FOTOGRAFIA: il giorno in cui la segreteria corregge
     * quel livello, l'apertura continuerebbe a filtrare col numero vecchio, e nessuno se ne
     * accorgerebbe perché il filtro funzionerebbe benissimo, solo attorno al centro sbagliato.
     * ⇒ Si tiene solo CHI ha aperto; il livello lo si rilegge dalla sua scheda ogni volta.
     * 📌 *Un dato copiato accanto alla sua fonte è una seconda verità che aspetta di divergere.* */
    const oraIso = new Date().toISOString();
    const { error: apriErr } = await service
      .from('pmo_cloud_records')
      .upsert({
        record_type: TIPO_RECORD_APERTURA,
        local_key: chiave,
        payload: {
          data: slot.data,
          ora: slot.ora,
          campo,
          aperta_da_member_local_id: member.id,
          organizzatore: member.name,
          aperta_il: oraIso,
        },
        deleted: false,
        updated_at: oraIso,
        synced_at: oraIso,
      }, { onConflict: 'record_type,local_key' });
    if (apriErr) {
      console.error(`[booking-write] apri KO ${chiave}:`, apriErr.message);
      return err(500, 'DB_ERROR', "Errore apertura della partita.");
    }
    console.log(`[booking-write] apri OK ${chiave}: ${member.name} (in ${esitoAp.roster.length})`);
    return ok({
      member: { id: member.id, name: member.name },
      aperta: true,
      slot: { data: slot.data, ora: slot.ora, campo },
      posti_liberi: GIOCATORI_PARTITA - esitoAp.roster.length,
    });
  }

  // ── cancel ────────────────────────────────────────────────────────────────
  // 🧪 Come per `leave` e `create`: acceso l'interruttore, la prova a vuoto si rimanda
  // indietro su OGNI risposta di `cancel`. Se non torna, la richiesta è arrivata a una
  // versione dell'edge che non ce l'ha — e un «non ho annullato niente» andrebbe letto
  // come «non ho misurato niente», che è tutt'altro.
  const prova = dryRun ? { dry_run: true } : {};
  // Ownership: si disdice SOLO una prenotazione col socio nel roster.
  const target = dayBookings.find((b) =>
    b.campo === campo && b.ora === slot.ora &&
    nomiDellaRiga(b).some((g) => nameVariants.has(normName(g))));
  if (!target) {
    return ok({ member: { id: member.id, name: member.name }, cancelled: false, reason: 'booking_not_found', ...prova });
  }

  // 🚨⭐⭐ CHI PUÒ ANNULLARE — regola CAMBIATA il 30/07/2026 (decisione del committente).
  // Prima: solo chi era rimasto SOLO in campo. Adesso: **anche l'ORGANIZZATORE**, cioè il
  // primo dell'elenco ordinato della scheda, e avvisa lui gli altri (il bot glielo dice prima
  // del «Confermo»). Chi non è organizzatore continua a poter solo USCIRE (`leave`), e chi
  // vuole comunque annullare passa dalla segreteria.
  // ⚖️ Il motivo della regola vecchia resta VERO — Telegram non consente di scrivere a chi non
  // ha mai scritto al bot, quindi quei tre da noi non sentono nulla — e gli è stato detto prima
  // della scelta: il fatto che l'ha convinto è che anche prima quella partita si annullava
  // passando dalla segreteria, senza che nessuno avvisasse gli altri. Il perché sta accanto
  // alla regola in `roster-slot.ts`, dove vive il diritto.
  // Il roster si conta su TUTTE le righe dello slot.
  // ⭐ La stessa lettura di `leave`, con la stessa rete: si conta su TUTTE le righe dello
  // slot, e se le due copie si contraddicono vale la scheda del circolo. Dire «ci sono altri 4
  // giocatori» quando il quinto l'abbiamo inventato noi manda il socio a cercare qualcuno che
  // non c'è.
  // ⚠️ Qui c'era scritto «non cambia l'ESITO, con più di un giocatore si rifiuta comunque»:
  // era vero fino al 30/07 e la regola nuova l'ha reso FALSO — adesso con più giocatori
  // l'organizzatore passa. Corretto qui perché una convinzione smontata va cercata DOVE ALTRO
  // è scritta: è lo stesso errore che il 30/07 aveva lasciato nel bot la frase «non sappiamo
  // chi ha organizzato» mentre sul gestionale la stellina lo mostrava già.
  const righeSlot = dayBookings.filter((b) => b.campo === campo && b.ora === slot.ora);
  // 🚨⭐ Ultimo cancello, gemello di quello di `leave`: una LEZIONE non si annulla dal bot
  // (il maestro e la segreteria vanno avvisati, e la regola della kb le tiene fuori). Il bot
  // già non mostra il bottone — `partiteLasciabili` scarta le lezioni — ma qui ci si difende
  // dal bot sbagliato, esattamente come si fa sull'uscita.
  // 🚨 Mancava, e l'asimmetria era al contrario: la difesa stava sull'azione MENO
  // distruttiva (esci = un giocatore) e non su questa, che toglie il CAMPO. Misurata a vuoto
  // il 28/07 su una lezione vera di TEST: rispondeva «avrei annullato» (un partecipante, una
  // riga). Su PROD le lezioni future sono 35 slot.
  // ⭐ Sta DOPO il controllo di proprietà di proposito: di una prenotazione che non è sua, al
  // socio non si dice nulla — nemmeno che tipo di prenotazione sia.
  if (righeSlot.some((b) => /lezione/i.test(b.tipo))) {
    return ok({ member: { id: member.id, name: member.name }, cancelled: false, reason: 'non_e_una_partita', ...prova });
  }
  const esitoCancel = rosterDelloSlot(righeSlot, GIOCATORI_PARTITA);
  const rosterSlot = esitoCancel.roster;
  if (esitoCancel.incoerente) {
    console.error(`[booking-write] cancel roster INCOERENTE ${slot.data} ${slot.ora} C${campo}: ${esitoCancel.unione.size} nomi, e la scheda del circolo non ne dà ${GIOCATORI_PARTITA}`);
    return ok({
      member: { id: member.id, name: member.name },
      cancelled: false,
      reason: 'roster_incoerente',
      giocatori: esitoCancel.unione.size,
      ...prova,
    });
  }
  // Con altri in campo si passa dal DIRITTO. `null` = era solo, e allora non c'è nessun ruolo
  // da guardare: la strada di prima resta intatta per chi è rimasto solo.
  let organizzatoreChePuo: string | null = null;
  if (rosterSlot.length > 1) {
    // 🚨⭐⭐ La decisione sta in `dirittoDiAnnullare` e NON qui: è la riga che fa sparire un
    // campo a tre persone, quindi vive dove si prova sui payload veri e dove un sabotaggio si
    // misura. Riscriverla a mano qui sarebbe la strada per cui i test restano verdi mentre il
    // comportamento cambia (un test sorveglia proprio che l'edge chiami questa funzione).
    // 👥 Il nome del socio è di più persone al circolo? Si chiede PRIMA di decidere.
    // 🚨⭐⭐ E se la risposta non si riesce a dare, l'annullo si FERMA: qui l'errore è
    // irreversibile — toglie il campo a qualcun altro — quindi «non lo so» deve valere «no».
    // Una guardia che nel dubbio dà via libera non è una guardia.
    // ⭐ La lettura sta in `omonimiDelSocio`, un posto solo, condiviso con `remove`: era qui
    // dentro fino al 4/08, ed è stata tirata fuori il giorno in cui è servita a due azioni.
    const esitoOmonimi = await omonimiDelSocio('cancel', 'non annullo');
    if (!esitoOmonimi.ok) return esitoOmonimi.risposta;
    const diritto = dirittoDiAnnullare(righeSlot, nameVariants, esitoOmonimi.omonimi.length > 0);
    if (!diritto.permesso) {
      // ⭐ Tre motivi distinti, perché al socio si devono tre risposte diverse:
      // `non_sei_organizzatore` ha una strada (uscire), `organizzatore_ignoto` no (segreteria),
      // `omonimi_al_circolo` nemmeno — ma per una ragione diversa, che va detta: il nome
      // combacia, e proprio per questo non prova niente.
      // 🚨 Il nome dell'organizzatore NON esce da qui: chi non ha il diritto non ha bisogno di
      // sapere chi l'ha, e sarebbe il recapito di un terzo dato senza che l'abbia chiesto.
      console.log(`[booking-write] cancel rifiutato ${slot.data} ${slot.ora} C${campo}: in ${rosterSlot.length}, ${diritto.motivo}`);
      return ok({
        member: { id: member.id, name: member.name },
        cancelled: false,
        reason: diritto.motivo,
        giocatori: rosterSlot.length,
        ...prova,
      });
    }
    organizzatoreChePuo = diritto.organizzatore;
    console.log(`[booking-write] cancel diritto ORGANIZZATORE ${slot.data} ${slot.ora} C${campo}: ${member.name} è il primo di ${rosterSlot.length}`);
  }

  // 👥⭐⭐ 19/08/2026 — CHI ALTRO CI RIMETTE IL CAMPO, e come il bot lo ritrova per avvisarlo.
  //
  // 🗣️ Decisione del committente: fino a oggi la conferma dell'annullo diceva al socio *«avvisa
  // tu chi giocava con te, io non posso scrivere al posto tuo»* — ed era **falso**, perché dal
  // 6 e dall'11/08 il bot avvisa davvero chi viene TOLTO da una partita. La stessa strada del
  // `remove`, non un ripiego: il ponte manda i numeri di scheda, il bot ci ritrova le chat.
  //
  // 🚨 Si chiede **PRIMA** della scrittura, esattamente come in `remove` e per la stessa
  // ragione: così finisce anche nella **prova a vuoto**, e l'elenco si misura senza annullare
  // niente. Metterlo dopo l'annullo lo renderebbe provabile solo su partite vere.
  //
  // ⚖️ `scheda: null` NON è un guasto ed è la cosa importante da non curare: vuol dire «quel
  // nome al circolo non è di UNA sola persona viva» ⇒ quella persona non si avvisa, e al bot
  // resta da dire all'organizzatore di farlo lui. Il verso del fail closed è quello di
  // `schedaDiChiSiToglie`: nel dubbio si perde un avviso, mai si scrive alla persona sbagliata.
  //
  // ⭐ In fila e non in parallelo: i compagni sono al massimo tre (una partita è di quattro), e
  // ogni nome costa poche letture. Chi era solo in campo non ne fa nessuna — l'elenco è vuoto.
  const compagni = compagniDaAvvisare(rosterSlot, nameVariants);
  const compagniConScheda: JsonMap[] = [];
  for (const nome of compagni) {
    compagniConScheda.push({ nome, scheda: await schedaDiChiSiToglie(nome, 'cancel') });
  }
  if (compagni.length) {
    const noti = compagniConScheda.filter((c) => c.scheda).length;
    console.log(`[booking-write] cancel compagni ${slot.data} ${slot.ora} C${campo}: ${compagni.length} da avvisare, ${noti} con scheda`);
  }

  // ⭐ Come in `create`: la richiesta si compone UNA volta sola e serve a tutt'e due le
  // strade. Se la prova a vuoto ne stampasse una copia scritta accanto, mostrerebbe una
  // richiesta che non è quella che parte — ed è proprio quella divergenza che nessuno vedrebbe.
  const cancelPayload: JsonMap = {
    ...(target.idReserva
      ? { idReserva: target.idReserva }
      : { campo, data: slot.data, ora: slot.ora }),
    /* 🆕🗣️ 01/09 (voce 79) — CHI CHIEDE l'annullo.
     * ⚖️ Oggi qui non cambia nessun messaggio, e va detto invece di far credere il contrario:
     * sull'annullo la ricevuta copre **tutto il roster** (voce 83), quindi l'avviso «annullata
     * dal circolo» ai compagni non parte proprio. Si manda lo stesso perché il giorno in cui
     * una ricevuta non copre qualcuno — una corsa persa, un nome non riconosciuto — quello che
     * gli arriva dev'essere **vero**, non solo raro. */
    chiestoDa: member.name,
  };

  // 🧪 Qui finisce la prova a vuoto: tutto ciò che sta SOPRA è già stato eseguito per
  // davvero — identità, proprietà della prenotazione, roster ricomposto su tutte le righe
  // dello slot, la guardia «non c'è nessun altro», la richiesta composta — e sotto c'è
  // l'unica riga che toglie il campo. Fermarsi altrove proverebbe un percorso diverso da
  // quello che poi succederà in produzione.
  if (dryRun) {
    console.log(`[booking-write] cancel PROVA A VUOTO ${slot.data} ${slot.ora} C${campo}: annullerei per ${member.name} (roster ${rosterSlot.length}, su ${righeSlot.length} righe)`);
    return ok({
      member: { id: member.id, name: member.name },
      cancelled: false,
      dry_run: true,
      would: {
        slot: { data: slot.data, ora: slot.ora, campo },
        // La richiesta ESATTA che partirebbe. Qui porta l'informazione che più conta e che
        // non si vede da nessun'altra parte: se va per `idReserva` o per la terna. Su tutti
        // i record veri `id_reserva` è vuoto, quindi parte la terna — e un giorno in cui non
        // fosse più così, questa è l'unica riga che lo direbbe prima e non dopo.
        richiesta: cancelPayload,
        // Chi c'è in campo secondo la lettura che ha DECISO l'esito: senza, un «annullerei»
        // non distingue «era solo» da «non ho contato».
        roster: [...rosterSlot],
        // Da dove vengono i giocatori: `nostra` = le righe concordavano; `circolo` = si
        // contraddicevano e ha vinto la scheda aggiornata (stessa forma di `leave`).
        fonte: esitoCancel.fonte,
        sommando_le_righe: esitoCancel.unione.size,
        righe: righeSlot.length,
        id_reserva: target.idReserva || null,
        // ⭐ PER QUALE DIRITTO annullerebbe: senza, una prova a vuoto riuscita non distingue
        // «era solo» (la strada di sempre) da «è l'organizzatore» (quella nuova) — e sono due
        // percorsi diversi che finiscono nella stessa riga.
        come: organizzatoreChePuo ? 'organizzatore' : 'unico_giocatore',
        organizzatore: organizzatoreChePuo,
        // 👥 CHI andrebbe avvisato, e con quale numero di scheda. È il campo che rende questo
        // avviso misurabile senza annullare niente: `scheda: null` vuol dire «non è di una
        // persona sola» ⇒ non si avvisa, e non è un errore.
        compagni: compagniConScheda,
      },
    });
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/matchpoint-bookings-cancel`, {
    method: 'POST',
    headers: internalHeaders,
    body: JSON.stringify(cancelPayload),
  });
  const data = await res.json().catch(() => null) as JsonMap | null;
  if (!res.ok || !data?.ok) {
    // 🆕🚨⭐⭐ 29/08/2026 (voce 106) — LA GUARDIA DELL'ESITO IGNOTO, anche qui.
    // ⭐ E su `cancel` è il ramo che la voce 83 aveva già misurato: la notte del 23/08 un
    // `KO HTTP 504 (IDLE_TIMEOUT)` del cancello della piattaforma è uscito da qui come
    // «rifiutata», il bot ha detto *«non ci sono riuscito, la tua prenotazione è rimasta
    // com'era»* — e l'annullo **era passato** (sync delle 21:44:04, `booking|9602` marcato
    // deleted). Quel 504 non ha né `error` né `esitoIgnoto` ⇒ da oggi cade nell'ignoto, che è
    // la sola cosa vera che se ne potesse dire.
    const ignotoCancel = esitoIgnotoDaRisposta(data);
    console.error(`[booking-write] cancel KO HTTP ${res.status}${ignotoCancel ? ' (ESITO IGNOTO)' : ''}:`, JSON.stringify(data).slice(0, 300));
    // 🧾🚨⭐⭐ 31/08/2026 (voce 83) — È IL CASO ESATTO DEL 23/08, ed è anche quello in cui la
    // cura ovvia sarebbe stata peggiore del difetto.
    // ⇒ La ricevuta si scrive **solo per chi ha chiesto l'annullo**, mai per i compagni:
    //   · per LUI copre l'avviso *«è stata annullata dal circolo»* su un gesto suo — la bugia
    //     che il socio ha letto quella notte;
    //   · per LORO non si scrive niente, perché sull'ignoto il bot non li ha avvisati (non ha
    //     ricevuto nessun `compagni`) ⇒ l'avviso del circolo è l'unico che avranno, e toglierlo
    //     li lascerebbe senza campo e senza notizia. Il ragionamento intero sta in `ricevuta.ts`.
    // ⚠️ Se il richiedente nel roster non si riconosce non si scrive nulla: una ricevuta col
    // nome sbagliato non copre il fatto giusto e può coprirne un altro.
    if (ignotoCancel) {
      const ioNelRoster = mioNomeNelRoster(esitoCancel.chiavi, nameVariants);
      if (ioNelRoster) {
        await lasciaRicevuta('cancel-ignoto', { data: slot.data, ora: slot.ora, campo }, [
          { persona: ioNelRoster, gesto: 'annullata' },
        ]);
      } else {
        console.error(`[booking-write] cancel-ignoto ${slot.data} ${slot.ora} C${campo}: richiedente non riconosciuto nel roster, nessuna ricevuta`);
      }
    }
    return ok({
      member: { id: member.id, name: member.name },
      cancelled: false,
      reason: ignotoCancel ? MOTIVO_ESITO_IGNOTO : MOTIVO_SCRITTURA_RIFIUTATA,
      detail: dettaglioPerIlBot(data?.message ?? data?.error ?? `HTTP ${res.status}`),
    });
  }
  console.log(`[booking-write] cancel OK ${slot.data} ${slot.ora} C${campo} per ${member.name} (${organizzatoreChePuo ? `organizzatore, erano in ${rosterSlot.length}` : 'era solo'})`);
  // 🧾 L'annullamento tocca TUTTI quelli che c'erano — è l'unica eccezione dichiarata alla
  // decisione ① — e il bot li avvisa già tutti (`testoPartitaAnnullata`). ⇒ La ricevuta è al
  // plurale: una per ognuno, Ospiti esclusi (dietro non c'è nessuno da avvisare).
  await lasciaRicevuta('cancel', { data: slot.data, ora: slot.ora, campo },
    rosterSlot.map((persona: string) => ({ persona, gesto: 'annullata' as const })));
  return ok({
    member: { id: member.id, name: member.name },
    cancelled: true,
    slot: { data: slot.data, ora: slot.ora, campo },
    // ⭐ Quante persone ha toccato l'annullamento, e per quale diritto. Serve al bot per dire la
    // frase giusta — «avvisa gli altri» ha senso solo se gli altri c'erano — e serve al registro:
    // un annullamento da organizzatore è l'unico che tolga il campo a qualcun altro.
    come: organizzatoreChePuo ? 'organizzatore' : 'unico_giocatore',
    giocatori: rosterSlot.length,
    // 👥 CHI ha perso il campo, col numero di scheda con cui il bot ritrova la sua chat senza
    // passare dal nome. ⭐ Gemello di `scheda_del_tolto` del `remove`, al plurale: là la
    // persona è una, qui sono fino a tre. Gli Ospiti non ci sono — dietro non c'è nessuno da
    // avvisare — e chi era solo in campo trova l'elenco vuoto, che è la verità.
    compagni: compagniConScheda,
  });
});
