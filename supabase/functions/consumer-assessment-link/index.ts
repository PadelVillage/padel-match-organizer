import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  TENTATIVI_PER_GIRO,
  GIORNI_DI_ATTESA,
  ORE_SILENZIO_ASSENSO,
  quandoMs,
  definizioneLivello,
  sceltaDellaProva,
  sopraIlTetto,
  gradinoOfferto,
  ilTestDiceMeno,
  statoDelGiro,
} from './giro-del-test.ts';
/* ⚠️ L'UNICO import che esce dalla cartella di questa funzione, e si dichiara perché è una
   deroga a un'abitudine: il conto delle domande deve avere UNA fonte, e quella fonte è il file
   che le domande le contiene. Copiarne il numero qui vorrebbe dire tenerne due copie in due
   funzioni che si deployano separatamente — cioè la forma in cui in questo progetto i due lati
   divergono sempre. La `deno-check` della CI verifica che il percorso si risolva. */
import { domandeTotaliPreviste } from '../assessment-quiz/passi.js';
// 🔄 27/08 — QUESTA RIGA È IL MOTIVO PER CUI QUESTA CARTELLA SI TOCCA INSIEME A `passi.js`:
// l'import qui sopra entra nel bundle di QUESTA funzione al SUO deploy. Cambiare la pescata
// (4 → 5 domande) senza rideployare il link lascerebbe l'annuncio a «12 domande» mentre il
// test ne fa 13 — il numero giusto nel posto vecchio. I workflow scelgono le funzioni dalle
// cartelle toccate: toccarla qui è ciò che la fa ripartire.
import { livelloDimostrato } from './livello-dimostrato.ts';
import { GIORNI_TRA_PROMEMORIA, promemoriaDelLivello } from './promemoria-livello.ts';

// consumer-assessment-link — il LINK PERSONALE del test di livello, per il bot dei soci.
//
// 🗣️ Nasce da un fatto del 9/08/2026: chiuso il link GENERICO (sua decisione, riga 11 della
// Tabella 1), il bot è rimasto **senza strada** verso il test — nel suo codice c'era scritto
// nero su bianco che «`?t=…` è legata a UN socio e da qui non si fabbrica». Questa funzione è
// il pezzo che mancava: dato il socio che il bot ha GIÀ riconosciuto, restituisce il suo
// indirizzo personale.
//
// ⭐⭐ Perché personale e non generico: il generico non riconosce nessuno, quindi chiede nome,
// cognome, telefono ed e-mail a una persona che il circolo conosce già — e la scheda che ne
// esce non si attacca a nessuna anagrafica. Il personale porta il gettone, e il gestionale sa
// di chi è la scheda.
//
// SCRITTURA, ed è l'unica: crea (o riusa) una riga in `assessment_tokens`.
// 🚨 Non entra nel RECINTO delle scritture al circolo, e va detto perché non sembri una
// dimenticanza: il recinto difende **Matchpoint** (le `matchpoint-*`), cioè il sistema del
// circolo, da chi lo tocca girando fuori dalla produzione. Qui si scrive in una tabella
// NOSTRA, e ogni ambiente scrive sulla propria — TEST su `cudi…`, PROD su `qqbf…`. Non c'è un
// sistema di terzi da proteggere.
// ⚖️ Ma il verso del dubbio è lo stesso del recinto: l'indirizzo di casa decide, e un
// indirizzo che non si riconosce NON produce un link (vedi `indirizzoScheda`).
//
// Autenticazione: come gli altri ponti, la CI deploya con --no-verify-jwt e il gate è
// l'header X-Consumer-Secret confrontato in tempo costante con CONSUMER_BRIDGE_SECRET.
// Secret assente in env → 503, funzione disarmata.

type JsonMap = Record<string, unknown>;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-consumer-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Quanti gettoni «apparentemente liberi» si guardano prima di fabbricarne uno nuovo.
 *
 * ⚖️ È un tetto di PRUDENZA, non una regola: serve solo a non leggere un elenco senza fine
 * se un socio ha accumulato gettoni mai usati. Chi lo alza o lo abbassa non cambia la
 * difesa — quella è la domanda «esiste già una scheda per questo gettone?», che si fa su
 * tutti quelli che si guardano. 📌 Misurato su PROD il 24/08: la media è 1,01 gettoni a socio e il record è 8.
 */
const CANDIDATI_DA_GUARDARE = 20;

/**
 * Fra i gettoni che SEMBRANO liberi, quale si può davvero riusare.
 *
 * 🚨 La regola in una riga: **un gettone che ha già una scheda è usato**, qualunque cosa dica
 * il suo `status`. Vive qui, fuori dal gestore, per un motivo solo: così il banco la può
 * ESEGUIRE invece di cercarla nel testo. ⚖️ Una guardia che conta le righe o i `select` non
 * difende niente — l'ha già mostrato due volte il 24/08.
 *
 * Torna la stringa vuota se non ce n'è nessuno da riusare: allora se ne fabbrica uno nuovo.
 */
function gettoneDaRiusare(candidati: any, conScheda: any) {
  const pulisci = (t: any) => String(t ?? '').trim();
  const usati = new Set((conScheda || []).map(pulisci).filter((t: any) => !!t));
  return (candidati || []).map(pulisci).find((t: any) => !!t && !usati.has(t)) ?? '';
}

const PROD_REF = 'qqbfphyslczzkxoncgex';
const TEST_REF = 'cudiqnrrlbyqryrtaprd';

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

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

// Confronto in tempo costante: il secret è l'unico gate della funzione.
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

/**
 * Dove vive la scheda, deciso dall'indirizzo di CASA PROPRIA.
 *
 * 🚨⭐⭐ FAIL CLOSED su un indirizzo che non si riconosce, e non è pignoleria: sbagliare qui
 * manderebbe un socio VERO a compilare la scheda nell'ambiente di PROVA — la sua
 * autovalutazione finirebbe su `cudi…`, il gestionale vero non la vedrebbe mai, e nessuno se
 * ne accorgerebbe perché al socio la pagina si apre uguale.
 * ⇒ Meglio nessun link (il bot ripiega da sé sulla segreteria) che il link giusto per
 * l'ambiente sbagliato.
 *
 * 📏 E l'indirizzo di TEST non è `test.padelvillage.club/autovalutazione.html`: quel dominio
 * serve SOLO `index.html` e quella pagina risponde 404 (misurato il 9/08). Il file con
 * l'anteprima per le chat vive su `app.padelvillage.club/test/`, ed è lo stesso che usa già
 * l'edge delle email — un secondo indirizzo diverso sarebbe la solita copia che diverge.
 */
function indirizzoScheda(supabaseUrl: string): string {
  const u = clean(supabaseUrl).toLowerCase();
  if (u.includes(PROD_REF)) return 'https://app.padelvillage.club/autovalutazione.html';
  if (u.includes(TEST_REF)) return 'https://app.padelvillage.club/test/autovalutazione.html?env=test';
  return '';
}

/**
 * Un gettone della STESSA forma di quelli che fabbrica il gestionale (`makeAssessmentToken`):
 * maiuscole e cifre, 14 caratteri. ⚖️ Stessa forma, non stesso codice: là si parte da
 * `btoa(Date.now()+id+random)`, qui non c'è `btoa` sul lato server e ricopiarne il giro non
 * aggiungerebbe niente. Quello che conta è che l'app lo sappia leggere, e legge una stringa.
 */
// ── LO STATO DEL GIRO vive in `giro-del-test.ts`, qui accanto ─────────────────
// 🔁 SPOSTATO il 19/08/2026 (voce 61 § A ④): da quando il socio può FERMARSI a una
// prova, il giro lo devono ricostruire più funzioni — questa, `assessment-apply-level`
// e `consumer-assessment-decision` — e la camminata è una sola, in tre copie identiche
// (il perché delle copie sta nell'intestazione del modulo). La storia della regola —
// il primo `pass` che chiudeva il giro per sbaglio, le quattro bocciature che
// bloccavano per sempre — sta là, insieme alla regola.
// Il banco resta `test/consumer-assessment-link.test.mjs`, che ora estrae dal modulo.

function nuovoGettone(): string {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += alfabeto[b % alfabeto.length];
  return out;
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
    body = (await req.json()) as JsonMap;
  } catch {
    return err(400, 'BAD_JSON', 'Corpo della richiesta non leggibile.');
  }

  // L'id è quello dell'APP (`payload.id`), lo stesso che `consumer-player-readmodel`
  // restituisce come `member.id`: il bot ce l'ha già in mano quando arriva qui, quindi non si
  // rifà il riconoscimento. ⭐ E non si RICOPIA la regola dell'ambiguità che vive nel
  // readmodel: due copie di quella regola sarebbero due modi diversi di sbagliare persona.
  const memberId = clean(body.member_id ?? body.memberId);
  if (!memberId) {
    return err(400, 'MEMBER_ID_REQUIRED', 'Serve member_id (l\'id del socio nel gestionale).');
  }

  const supabaseUrl = clean(Deno.env.get('SUPABASE_URL'));
  const base = indirizzoScheda(supabaseUrl);
  if (!base) {
    // Vedi `indirizzoScheda`: non si tira a indovinare l'ambiente di una persona vera.
    return err(503, 'AMBIENTE_SCONOSCIUTO', 'Indirizzo del progetto non riconosciuto: nessun link prodotto.');
  }

  const db = createClient(
    supabaseUrl,
    clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')),
    { auth: { persistSession: false } },
  );

  // Il socio, per riempire nome e ultime 4 cifre: sono i campi che il gestionale mostra
  // accanto al gettone. Se non lo si trova NON si crea niente — un gettone senza padrone
  // produrrebbe una scheda che non si attacca a nessuno, cioè il difetto del link generico.
  const { data: righe, error: erroreSocio } = await db
    .from('pmo_cloud_records')
    .select('payload')
    .eq('record_type', 'member')
    .not('deleted', 'is', true)
    .eq('payload->>id', memberId)
    .limit(2);

  if (erroreSocio) {
    return err(500, 'DB_ERROR', `Lettura del socio non riuscita: ${erroreSocio.message}`);
  }
  if (!righe || righe.length === 0) {
    return err(404, 'MEMBER_NOT_FOUND', 'Nessun socio vivo con questo id.');
  }
  if (righe.length > 1) {
    // Stessa difesa del readmodel: meglio non rispondere che rispondere per la persona
    // sbagliata → vedi il caso dei `pmoPlayerId` condivisi (9/08).
    return err(409, 'AMBIGUOUS', 'Più di un socio vivo con questo id: non scelgo.');
  }

  const payload = (righe[0]?.payload ?? {}) as JsonMap;
  const nome = clean(payload.name)
    || [clean(payload.firstName), clean(payload.surname)].filter(Boolean).join(' ').trim()
    || 'Socio';
  const ultime4 = clean(payload.phone).replace(/\D/g, '').slice(-4);

  /* ═══════════════════════════════════════════════════════════════════════════════════════
     🆕🔁⭐⭐ 9/08/2026 — LA REGOLA DEI TRE TENTATIVI, e sta QUI di proposito.

     🗣️ Sua: *«quando faccio un test lo posso affinare provando TRE VOLTE DI SEGUITO. Dopodiché
     scattano i TRENTA GIORNI. Se lo sbaglio per tre volte c'è il messaggio che posso contattare
     la segreteria»*. E «affinare» l'ha precisato: *«se non passa, il bot mi dice se voglio
     rifarlo»* — nessun suggerimento su cosa fosse sbagliato, solo l'offerta di ripetere.

     ⭐⭐ **Perché il conto vive nel ponte e non nel bot**: il bot è un client, e un client si
     riavvia, si sdoppia, si aggiorna. Un contatore che vive là dura quanto il processo. Qui il
     conto non è tenuto: è **CALCOLATO dai fatti** — le schede che quel socio ha davvero
     mandato. Non c'è niente da azzerare, niente da sincronizzare, e due bot che chiedono
     insieme leggono lo stesso numero.

     ⭐ **Cosa conta come prova**: una scheda ARRIVATA col cancello `pass` o `fail`. Non un
     gettone chiesto — chi tocca il bottone dieci volte senza compilare non consuma niente, e
     infatti il gettone non usato si riusa (più sotto).

     🔁⭐⭐ **CAMBIATA IL 18/08/2026, sua regola** (voce 61 § A ②): *«finito il giro, 30 giorni
     prima di rifarlo»*. Fino a qui i 30 giorni partivano dal **terzo fallimento** e una scheda
     che PASSAVA azzerava il conto ⇒ chi passava poteva rifare il test **subito e all'infinito**,
     e nessuno se n'era accorto perché il bottone non gli compariva mai. Adesso un giro sono
     **tre prove**, e quando finiscono partono i 30 giorni.
     🚨 La prima stesura chiudeva il giro al primo `pass`: sbagliata, e corretta lo stesso
     giorno — avrebbe dato le tre prove **solo a chi sbaglia il quiz**. Vedi `statoDelGiro`.
     ⚖️ I 30 giorni partono dalla **chiusura**, non da ogni prova: chi ne fa tre in dieci minuti
     aspetta da quel momento, non tre volte.
     🚨 E la ricostruzione a giri ripara un difetto che il conto delle sole fallite si portava
     dietro senza che nessuno l'avesse visto: con **quattro** fallite di fila il conto restava
     ≥ 3 e l'attesa ripartiva **dall'ultima**, cioè passati i 30 giorni il socio otteneva **una
     prova sola** e poi altri 30 giorni, all'infinito. Coi giri, il giro dopo nasce **intero**.
     📌 La regola vive in `giro-del-test.ts` qui accanto (coi numeri: tre prove, trenta
     giorni), ed è provata dal banco `test/consumer-assessment-link.test.mjs`.
     ═══════════════════════════════════════════════════════════════════════════════════════ */

  // Le schede di QUESTO socio: si passa per i suoi gettoni, che sono il filo fra la persona e
  // la scheda (la scheda pubblica non porta l'anagrafica, porta il gettone).
  const { data: gettoniSuoi, error: erroreElenco } = await db
    .from('assessment_tokens')
    .select('token')
    .eq('member_local_id', memberId);

  if (erroreElenco) {
    return err(500, 'DB_ERROR', `Lettura dei gettoni non riuscita: ${erroreElenco.message}`);
  }

  const suoi = (gettoniSuoi ?? []).map(r => clean((r as JsonMap).token)).filter(Boolean);
  // Lo stato del giro lo calcola `statoDelGiro` sulle schede vere: qui si tiene solo
  // l'elenco, e la regola sta in una funzione pura che il banco può provare.
  let elencoSchede: JsonMap[] = [];
  /**
   * 🆕🔔 L'ULTIMA scheda arrivata, qualunque sia andata: serve all'avviso che il bot manda
   * DOPO il test — sua richiesta del 9/08: *«dopo aver fatto il test, il bot ti deve
   * rispondere qualcosa»*, e in tutti e due i casi, non solo quando si viene bocciati.
   * ⭐ Si porta la FASCIA e non il numero: al socio il livello si dice a PAROLE (regola sua),
   * e la fascia è già dentro la scheda — così non serve una terza copia della scala qui
   * dentro, che sarebbe l'ennesima cosa da tenere allineata a mano.
   */
  let ultimaScheda: JsonMap | null = null;

  if (suoi.length) {
    const { data: schede, error: erroreSchede } = await db
      .from('self_assessments')
      /* 🚨⭐⭐ 27/08 notte — `calculated_level` QUI DEVE ESSERCI, e mancava: è la colonna da cui
         `sopraIlTetto` legge il livello dimostrato (`livelloDimostrato(scheda)`), e senza,
         `aspetta_maestro` usciva **sempre falso** da questa edge. 📏 Misurato sulla seconda
         prova di Laura (23:55): la cura di `puo_scegliere` era in servizio da 12 minuti ed era
         GIUSTA — ma inerte, perché il fatto su cui poggiava non arrivava mai. La domanda
         «tieni o riprovi?» è partita lo stesso, e il maestro non è mai stato nominato.
         📌 *Una funzione pura provata al banco riceve nel banco righe COMPLETE: nessuna prova
         si accorge che la select in servizio gliene passa una monca.* */
      .select('token, submitted_at, raw_response, calculated_level, member_decision, member_decision_at')
      .in('token', suoi)
      .order('submitted_at', { ascending: false })
      .limit(20);

    if (erroreSchede) {
      return err(500, 'DB_ERROR', `Lettura delle schede non riuscita: ${erroreSchede.message}`);
    }

    // ⚠️ Qui sotto si prepara SOLO `ultimaScheda`, l'avviso che il bot manda dopo il test.
    // Il conto delle prove non si fa più in questo punto: lo calcola `statoDelGiro`
    // sull'elenco intero. 📌 Fino al 18/08 qui c'era un ciclo che scorreva all'indietro
    // fermandosi alla prima passata — è quello che la regola dei giri ha sostituito, e il
    // commento che lo descriveva è stato tolto invece che lasciato a raccontare una cosa
    // che il codice non fa più.
    const elenco = (schede ?? []) as JsonMap[];
    if (elenco.length) {
      const s = elenco[0];
      const k = ((s.raw_response as JsonMap)?.knowledge ?? {}) as JsonMap;
      const esito = clean(k.status);
      ultimaScheda = {
        token: clean(s.token),
        // ⚖️ `skip` resta `skip`: non è né passato né bocciato, è «questa la guarda una
        // persona». Appiattirlo su uno dei due farebbe dire al bot una cosa falsa.
        esito: esito || 'ignoto',
        quando: clean(s.submitted_at),
        fascia: clean(k.fascia),
        senza_cancello: k.senza_cancello === true,
        /* 🆕🗣️⭐⭐ 27/08/2026 — «ASPETTA IL MAESTRO», e fin qui NON USCIVA DA NESSUNA PARTE.
           🗣️ Sua regola: *«quando un socio fa il test e risulta un livello superiore da avanzato
           in su, gli viene detto di contattare la segreteria per farsi vedere dal maestro in una
           partita in modo da validare il nuovo livello. Ma al momento resta invariato il suo
           livello»*.
           📏 Misurato prima di scrivere: la segnalazione esisteva già — `assessment-apply-level`
           la compone dal 25/08 — ma finiva in `avvisi`, cioè in un `console.log` dell'edge.
           **Al socio non arrivava niente**, ed è la stessa forma del difetto per cui è nata la
           voce 98: una promessa fatta a qualcuno e scritta in un log è una promessa non fatta.
           🚨 E per chi ha GIÀ un livello sopra il tetto era peggio del silenzio parziale: il
           livello non si riscrive ⇒ `livello_applicato` resta falso ⇒ `siPuoAnnunciareIlTest`
           tiene fermo tutto. Faceva il test e non riceveva **nessun messaggio**.
           ⇒ Il fatto esce di qui, e il bot lo dice. *Il gestionale SA, il bot DICE.*
           ⚖️ `livello_dimostrato` è la PAROLA, mai il numero (regola sua del 9/08), ed è quello
           che il test ha **dimostrato** — non quello che gli è stato scritto in scheda, che è e
           ⚖️ E si manda SOLO il fatto, non una seconda parola: la fascia che il socio ha
           dichiarato è già qui sopra (`fascia`), ed è quella giusta da dirgli — *«hai risposto
           da Avanzato»* è ciò che ha detto lui. Aggiungere il livello **dimostrato** in parole
           vorrebbe dire portare in questo file la scala dei sette livelli, cioè la terza copia
           che il commento qui sopra dice di non fare. */
        aspetta_maestro: sopraIlTetto(s, payload.level),
        /* 🆕🗣️ 27/08 mattina (variante P7, approvata da lui) — IL TEST DICE MENO di quello che
           ha in scheda: il livello non si abbassa mai con un test, quindi non c'è nessuna
           scelta da fare. Il bot, con questo fatto in mano, non fa la domanda: dice «il tuo
           livello resta X» e offre il bottone per riprovare. La regola vive nel modulo del
           giro, accanto alla gemella `sopraIlTetto`: il MENO si misura in PAROLE. */
        il_test_dice_meno: ilTestDiceMeno(s, payload.level),
        /* 🚨⭐⭐ E IL LIVELLO CHE HA ADESSO IN SCHEDA, che è la cosa che il bot sbagliava.
           📏 Misurato il 27/08: la parola che il bot annuncia («Il tuo livello è **X**») è
           `fascia`, cioè la fascia **DICHIARATA** dal socio. Sotto il tetto le due coincidono e
           nessuno se n'è accorto; SOPRA il tetto divergono — chi dichiara Avanzato e passa si
           sente dire «il tuo livello è Avanzato» mentre in scheda gli è stato scritto
           **Intermedio**. ⇒ Non era un messaggio incompleto: era un messaggio falso.
           ⚖️ Si manda il livello dell'ANAGRAFICA, non quello calcolato: è l'unico che sia
           vero comunque sia andata — chi è stato tagliato al tetto, chi era già più su e non
           è stato toccato, chi non ha ancora niente. *Il gestionale SA, il bot DICE.* */
        livello_in_scheda: definizioneLivello(payload.level),
        /* 🆕🗣️⭐⭐ 27/08/2026 sera — IL GRADINO CHE SI PUÒ OFFRIRE, e nasce da una sua regola:
           *«non dobbiamo ferire l'orgoglio del giocatore. Possiamo proporgli di scendere di un
           gradino o se no di rimanere a livello dell'ultimo test fatto, oppure di rifare il
           test»*. ⇒ Delle tre risposte due esistevano già; questa è la terza, ed è l'unica
           che scrive qualcosa.
           ⚖️ Esce di qui la PAROLA e nient'altro: il numero lo sceglie chi scrive
           (`assessment-apply-level`, il massimo della fascia), e il bot non conosce la scala
           — se la conoscesse, il giorno in cui la scala cambia ci sarebbero due copie da
           cambiare e una si dimenticherebbe. *Il gestionale SA, il bot DICE.*
           🔒 Vuoto quando non c'è niente da offrire: prova senza esito utile, offerta uguale a
           quello che il socio ha già, o più alta (una bocciatura non promuove nessuno). Il bot
           col campo vuoto mostra i due bottoni di sempre, ed è la caduta giusta. */
        gradino_offerto: gradinoOfferto(s, payload.level),
        /**
         * 🚨⭐⭐ IL LIVELLO C'È DAVVERO? — e non è una sfumatura.
         *
         * 🗣️ Lui vuole che il bot, a test superato, dica *«il livello che ti è stato messo»*,
         * con la PAROLA e non col numero. Giusto — ma quel livello, oggi, lo scrive il
         * GESTIONALE quando qualcuno lo apre, non questo server. Mandare l'avviso appena la
         * scheda passa vorrebbe dire dichiarare fatta una cosa che deve ancora succedere: è
         * esattamente il difetto trovato il 9/08 nell'email alla segreteria — *«il livello è
         * stato aggiornato da solo»* quando non lo era.
         * ⇒ Qui si dice se la scheda del socio porta già il segno di QUESTO test, e il bot
         * aspetta di poterlo dire vero. Un avviso in ritardo è meglio di un avviso bugiardo.
         * ⏭️ Quando l'applicazione passerà su un'edge con cron (voce A4ter), il ritardo si
         * accorcia da solo e qui non cambia niente.
         */
        livello_applicato: (() => {
          const quandoScheda = Date.parse(clean(s.submitted_at));
          const quandoLivello = Date.parse(clean(payload.selfAssessmentDate));
          if (!Number.isFinite(quandoScheda) || !Number.isFinite(quandoLivello)) return false;
          // Tolleranza di un minuto: le due date le scrivono due macchine diverse.
          return quandoLivello >= quandoScheda - 60_000;
        })(),
        livello: clean(payload.level),
        // 🆕 ④ (19/08/2026) — la SCELTA del socio su questa prova, e se può ancora farla.
        // È il gestionale che SA: il bot legge questi tre campi e fa la domanda «ti fermi
        // o riprovi?» solo dove la domanda esiste davvero. `puo_scegliere` è vero se la prova
        // ha passato il cancello, nessuna scelta è già registrata e il livello non è già
        // stato applicato. `scelta_entro` è il momento in cui il silenzio diventa assenso
        // (`ORE_SILENZIO_ASSENSO`) — il bot può dire «hai tempo fino a…» senza tenere il
        // numero in casa.
        scelta: sceltaDellaProva(s),
        /* 🔄🚨⭐⭐ 27/08/2026 — VIA IL VINCOLO DEL GIRO, e qui c'era il contrario: «il giro è
           ancora APERTO su questa prova (alla terza non c'è niente da chiedere: si applica da
           sola)». Quella riga ha prodotto un SILENZIO ETERNO, misurato sul test vero di
           Maurizio delle 10:12:51 del 27/08 e riprodotto eseguendo questo stesso modulo sulle
           sue schede vere.
           📏 I fatti: era la sua TERZA prova del giro ⇒ `corrente` vuoto ⇒ `puo_scegliere`
           falso; in scheda 4 e dimostrato 4,5 sono tutti e due «Avanzato» ⇒ né
           `aspetta_maestro` né `il_test_dice_meno`; e il livello non si scriverà MAI (il tetto
           taglia 4,5 a 3,5, che è meno di 4, e il livello non scende) ⇒ `livello_applicato`
           resta falso per sempre. ⇒ `siPuoAnnunciareIlTest` chiude tutte le porte: il socio ha
           letto «Lo sto registrando: fra poco ti scrivo com'è andata» e non riceverà mai altro.
           ⚖️ E LA RAGIONE DELLA RIGA VECCHIA ERA SCADUTA, non sbagliata quando fu scritta:
           «alla terza non c'è una quarta a cui rimandare» era vero col giro seguito da
           trenta giorni d'attesa. Dal 25/08 `GIORNI_DI_ATTESA = 0` ⇒ il giro dopo nasce
           **subito**, la quarta prova esiste, e insieme all'attesa se n'è andata la ragione.
           È la stessa scadenza già riconosciuta due volte — il conteggio delle prove tolto il
           27/08 e la frase «ti resta una prova» — arrivata al terzo posto in cui viveva.
           🔒 Quello che TIENE ancora: una scelta già registrata non si rifà, e un livello già
           scritto non si sceglie più. Sono fatti, non conteggi.
           ⚠️ La metà gemella sta in `consumer-assessment-decision` (il rifiuto `GIRO_FINITO`):
           si cambiano INSIEME, o il bot mostra due bottoni che il ponte rifiuta. */
        puo_scegliere: (() => {
          if (esito !== 'pass') return false;
          if (sceltaDellaProva(s)) return false;
          return true;
        })(),
        scelta_entro: quandoMs(s.submitted_at)
          ? new Date(quandoMs(s.submitted_at) + ORE_SILENZIO_ASSENSO * 60 * 60 * 1000).toISOString()
          : null,
      };
      // ⚠️ `puo_scegliere` mente se il livello è GIÀ stato applicato (silenzio scaduto o
      // «mi fermo» già lavorato dal cron): quel caso lo copre `livello_applicato`, e la
      // correzione si fa qui — dopo, perché l'oggetto serve intero per calcolarlo.
      if (ultimaScheda.livello_applicato) ultimaScheda.puo_scegliere = false;
      /* 🚨⭐⭐ 27/08/2026 tarda sera — E MENTE ANCHE SOPRA IL TETTO, che è il caso peggiore.
         📏 Misurato su una prova vera di Laura Aprea: in scheda **Base** (2,5), il test dice
         **Agonista** (5) ⇒ `aspetta_maestro` vero, e il livello non si scriverà mai da sé
         (`applied_at` è rimasto vuoto, ed è giusto: sopra Intermedio certifica il maestro).
         Ma `puo_scegliere` era **vero**, quindi il bot le ha fatto la domanda «tieni o
         riprovi?», lei ha risposto «tengo Agonista» e si è sentita dire *«te lo registro sulla
         scheda a breve»*. Due minuti dopo `/livello` le diceva **Base**.
         ⚖️ Non è il bot ad aver sbagliato la frase: è QUESTO campo ad aver dichiarato una
         scelta che non esiste. Sopra il tetto «tengo» e «riprovo» portano allo stesso posto —
         il livello non lo scrive il test in nessuno dei due casi — e una domanda le cui
         risposte sono equivalenti non è una scelta: è una promessa travestita.
         ⇒ Il fatto e la scelta si dicono **coerenti dallo stesso posto**, che è il gestionale.
         🔒 Il bot, quando questo diventa falso, cade da sé sul messaggio del maestro
         (`siPuoAnnunciareIlTest` lascia passare chi aspetta il maestro apposta): non serve
         nessun campo nuovo, e un bot più vecchio di questa edge smette solo di fare una
         domanda che non doveva fare.
         📌 *Due campi che rispondono alla stessa domanda o sono uno solo, o divergono — ed è la
         trappola ④ del 27/08, che stavolta è divergenza fra il gestionale e sé stesso.* */
      if (ultimaScheda.aspetta_maestro) ultimaScheda.puo_scegliere = false;
      /* 🆕 27/08 mattina (P7) — e mente anche quando il test dice MENO: «tieni o riprovi?» con
         «Tengo Intermedio» a chi ha Avanzato offre di tenere un livello che non verrà mai
         scritto (il livello non scende). Stessa forma del caso del maestro: una domanda le cui
         risposte portano allo stesso posto non è una scelta. Il bot, senza la domanda, cade
         sull'esito «il tuo livello resta X» — il campo qui sopra glielo dice.
         ⛔ ORDINE DI MESSA IN SERVIZIO rispettato: il bot che legge `il_test_dice_meno` è in
         servizio PRIMA di questa riga — spegnere la domanda con un bot che non conosce il
         campo avrebbe prodotto il silenzio totale, che è peggio della domanda sbagliata. */
      if (ultimaScheda.il_test_dice_meno) ultimaScheda.puo_scegliere = false;
    }
    elencoSchede = elenco;
  }

  // ⭐ UN SOLO orologio da qui in poi: `statoDelGiro` e il promemoria devono guardare lo
  // stesso istante. Con due `Date.now()` la casella del calendario e l'attesa potrebbero
  // cadere ai due lati di un confine — raro, e per questo il tipo di difetto che si
  // ripresenta per mesi senza che nessuno riesca a riprodurlo.
  const adessoMs = Date.now();
  const giro = statoDelGiro(elencoSchede, adessoMs, TENTATIVI_PER_GIRO, GIORNI_DI_ATTESA);

  /* ═════════════════════════════════════════════════════════════════════════════════════
     🆕🔔⭐⭐ 19/08/2026 — IL PROMEMORIA GENTILE (voce 61 ⑥), e qui c'è solo il SAPERE.

     🗣️ Sua, il 17/08: *«a chi non ha il livello ci dobbiamo ricordare di chiedere gentilmente
     se può fare il test. Magari non tutte le settimane, ma un paio di volte al mese»*.

     ⭐ Il bot riceve un sì/no e la CASELLA di calendario in cui cade la risposta: non impara
     né chi è senza livello, né ogni quanto si parla. È lo stesso disegno di `puo_scegliere`
     del ④ — *il gestionale SA, il bot DICE* — e ha lo stesso effetto pratico: il giorno in
     cui il committente cambia la cadenza, sulla VM non si tocca niente.
     🚨 La casella serve al bot per una cosa sola: farne la chiave del suo registro, che è ciò
     che impedisce il doppio invio. Il «quando» lo decide questo file, l'«una volta sola» il
     database di là. Nessuno dei due sa fare il mestiere dell'altro.
     ⚖️ Non costa una chiamata in più: il giro degli avvisi questo ponte lo interroga già una
     volta per socio, per l'esito del test.
     ═════════════════════════════════════════════════════════════════════════════════════ */
  const promemoria = promemoriaDelLivello({
    adessoMs,
    giorni: GIORNI_TRA_PROMEMORIA,
    // La regola di «avere il livello» è quella del readmodel, byte per byte: due letture
    // diverse vorrebbero dire ricordare il test a chi ce l'ha già.
    haIlLivello: livelloDimostrato(payload.level, payload.levelSource),
    ammesso: giro.ammesso,
    // 0 = nessuna scheda; NaN = una scheda con la data illeggibile. Sono due casi opposti,
    // e il modulo li tiene distinti apposta.
    ultimaSchedaMs: ultimaScheda ? Date.parse(clean(ultimaScheda.quando)) : 0,
    ultimoEsito: ultimaScheda ? clean(ultimaScheda.esito) : '',
  });

  if (!giro.ammesso && giro.attesa) {
    // ⚖️ NON è un errore HTTP: la richiesta è stata capita ed eseguita, la risposta è «non
    // adesso». Un 4xx qui farebbe scattare nel bot il ripiego dei guasti — cioè un «riprova
    // più tardi» generico — proprio dove serve la frase precisa con la data e la segreteria.
    return ok({
      stato: 'attesa',
      ultima_scheda: ultimaScheda,
      tentativi_falliti: giro.falliti,
      riprova_dal: giro.attesa.dal,
      giorni_mancanti: giro.attesa.giorni,
      // Perché si aspetta. 🆕 Dal 19/08/2026 (④) i valori sono DUE: `esaurito` — le prove
      // del giro sono finite — e `confermato` — il socio ha detto «mi fermo». Un bot che
      // non conosce ancora il secondo dice il *quando* e tace sul *perché*, per la regola
      // sua del 18/08: meglio vaghi che falsi.
      motivo_attesa: giro.attesa.motivo,
      // Anche qui, e vale sempre `dovuto: false`: chi aspetta il test non lo può rifare, e
      // ricordarglielo sarebbe mandarlo contro una porta chiusa. Il campo c'è lo stesso
      // perché il bot legga la risposta allo stesso modo dalle due strade.
      promemoria,
    });
  }

  // 1) Si RIUSA il gettone che il socio ha già, se non l'ha ancora usato.
  // ⭐ Perché: chi tocca il bottone due volte deve ritrovare la SUA scheda, non aprirne una
  // seconda. E il gestionale mostra una riga per socio invece di una collezione di gettoni
  // morti. Un gettone già completato invece non si riusa: quella scheda è chiusa.
  const { data: esistenti, error: erroreGettoni } = await db
    .from('assessment_tokens')
    .select('token, status, completed_at, opened_at')
    .eq('member_local_id', memberId)
    .is('completed_at', null)
    .neq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(CANDIDATI_DA_GUARDARE);

  if (erroreGettoni) {
    return err(500, 'DB_ERROR', `Lettura dei gettoni non riuscita: ${erroreGettoni.message}`);
  }

  /* ═══════════════════════════════════════════════════════════════════════════════════════
     🚨🚨⭐⭐ 24/08/2026 (voce 84) — «USATO» SI CHIEDE ALLE SCHEDE, NON AL CAMPO `status`.

     📏 Il collaudo di Marco Aprea, misurato: il gettone `ZK3MZY1NTIWMDQ` diceva `status:
     'created'`, `completed_at: null` — cioè «mai usato» — e una scheda ce l'aveva **dal 3
     maggio**. I due campi che decidevano il riuso erano rimasti indietro, e nessuno se n'era
     accorto perché nessuno aveva mai chiesto la cosa vera.
     ⇒ Il bot gli ha ridato quel gettone; la consegna, che è un `upsert` sul gettone, ha
     **riscritto la scheda di maggio** invece di aprirne una nuova — e da lì il silenzio.

     📌 *Un campo che descrive uno stato può restare indietro; un fatto che esiste, no.* La
     domanda giusta non è «questo gettone risulta usato?» ma «esiste già una scheda per questo
     gettone?», e la seconda non si può disallineare da sé stessa.

     ⚖️ Perché non si è invece riparato `status`: si sarebbe curata **l'istanza** (le 23 righe
     di oggi) e non la **classe**. Qualunque strada futura che scriva una scheda senza marcare
     il gettone rifarebbe il danno, e questo controllo la copre già.

     ⭐ Si guardano più candidati e non uno solo: prendendone uno e trovandolo usato si
     fabbricherebbe un gettone nuovo pur avendone uno buono più indietro — cioè si perderebbe
     la ragione per cui il riuso esiste (*chi tocca il bottone due volte ritrova LA SUA
     scheda*). ⛔ Il numero è un tetto di prudenza, NON un invariante: la difesa è la domanda,
     non la quantità.
     ═══════════════════════════════════════════════════════════════════════════════════════ */
  const righeGettoni = (esistenti ?? []) as Array<{ token?: string; opened_at?: string | null }>;
  const candidati = righeGettoni
    .map((r) => clean(r?.token))
    .filter((t: string) => !!t);
  // Gettone → quando il socio ha aperto il quiz. Serve al bot per far partire il cronometro
  // da lì (voce 84 cura C): il ponte porta il FATTO, la regola di quanto aspettare sta nel bot.
  const aperturaDi = new Map<string, string>(
    righeGettoni.map((r) => [clean(r?.token), clean(r?.opened_at ?? '')]),
  );

  let daRiusare = '';
  if (candidati.length > 0) {
    const { data: giaConScheda, error: erroreSchede } = await db
      .from('self_assessments')
      .select('token')
      .in('token', candidati);

    // 🚨 Se non si riesce a sapere quali sono usati, NON si tira a indovinare riusandoli:
    // fallire qui è una frase in meno per il socio; riusare un gettone usato è una scheda
    // sovrascritta e un livello che non arriva mai. Fra i due, il no.
    if (erroreSchede) {
      return err(500, 'DB_ERROR', `Lettura delle schede non riuscita: ${erroreSchede.message}`);
    }

    daRiusare = gettoneDaRiusare(
      candidati,
      (giaConScheda ?? []).map((r: { token?: string }) => clean(r?.token)),
    );
  }

  const separatore = base.includes('?') ? '&' : '?';

  /**
   * 🆕 9/08 sera — nell'indirizzo va anche il NOME, e non è un ornamento.
   *
   * 📏 Misurato sulla prima scheda arrivata davvero dal bot: si è salvata come **«Socio Padel
   * Village»**, il segnaposto, invece che col nome del socio. La pagina, dal link personale,
   * gira **senza anagrafica** — non ha modo di sapere chi sei se non glielo dice l'indirizzo:
   * legge `?nome=` e, in mancanza, ripiega sul segnaposto.
   * ⇒ Senza questo, ogni scheda che arriva dal bot entra in gestionale **senza nome**. Si
   * attacca lo stesso alla persona giusta (il gettone sa di chi è), ma chi guarda l'elenco
   * non lo capisce — ed è il tipo di difetto che nessuno segnala perché non rompe niente.
   * ⚖️ Resta un'ETICHETTA, non un'identità: chi decide di chi è la scheda è sempre il gettone.
   */
  const conNome = (token: string) =>
    `${base}${separatore}t=${encodeURIComponent(token)}&nome=${encodeURIComponent(nome)}`;

  // Il conto si racconta INSIEME al link: il bot deve poter dire «è il tuo secondo tentativo,
  // te ne resta uno» senza tenere niente in memoria fra un messaggio e l'altro.
  const conteggio = {
    stato: 'link',
    ultima_scheda: ultimaScheda,
    tentativi_falliti: giro.falliti,
    tentativo: giro.prova,
    tentativi_totali: TENTATIVI_PER_GIRO,
    ultimo_tentativo: giro.ultima_prova,
    /* 🆕🗣️⭐⭐ 26/08/2026 — QUANTE DOMANDE SONO, e il bot lo deve sapere PRIMA di cominciare.
       🗣️ Sua richiesta: *«sin dall'inizio deve dire che sono 12 domande»*. L'invito parte quando
       di risposte non ce n'è nessuna, quindi il numero non può venire dal passo: viene da qui.
       🔒 E non è un 12 scritto in questa funzione: si chiede a `passi.js`, che è il file che le
       domande le ha. ⇒ Se un domani una domanda si aggiunge o si toglie, la frase dell'invito
       cambia da sé — nessuno deve rincorrerla in tre posti. *Il gestionale SA, il bot DICE.*
       ⚠️ È una PREVISIONE: chi dichiara Principiante, Semi-Pro o Professionista non ha il
       cancello e ne farà otto. Il conto cala dopo la terza risposta, e cala — non cresce. */
    domande_totali: domandeTotaliPreviste(),
    promemoria,
  };

  if (daRiusare) {
    return ok({
      ...conteggio,
      token: daRiusare,
      url: conNome(daRiusare),
      riusato: true,
      // ⏱️ Voce 84 cura C: vuoto finché il socio non apre il quiz. Il bot, non trovandolo,
      // si comporta come prima — è la stessa cautela di `promemoria`: un ponte più vecchio
      // di un bot non lo manda, e il bot non deve rompersi per un campo che non c'è.
      quiz_aperto_il: aperturaDi.get(daRiusare) ?? '',
    });
  }

  // 2) Altrimenti se ne fabbrica uno. `token` ha un vincolo di unicità (il gestionale ci fa
  // sopra `on conflict (token)`): su collisione si riprova, invece di rispondere un errore
  // per un dado uscito male. Tre giri sono già oltre l'assurdo con 36^14 possibilità.
  for (let tentativo = 0; tentativo < 3; tentativo++) {
    const token = nuovoGettone();
    const { error: erroreInserimento } = await db
      .from('assessment_tokens')
      .insert({
        token,
        member_local_id: memberId,
        member_name: nome,
        phone_last4: ultime4,
        status: 'created',
      });

    if (!erroreInserimento) {
      // Appena fabbricato: nessuno l'ha ancora aperto, e si dice invece di ometterlo — così
      // la risposta si legge in un modo solo da tutt'e due le strade.
      return ok({ ...conteggio, token, url: conNome(token), riusato: false, quiz_aperto_il: '' });
    }
    // 23505 = unique_violation: solo in quel caso ha senso ritentare.
    if (clean((erroreInserimento as { code?: string }).code) !== '23505') {
      return err(500, 'DB_ERROR', `Creazione del gettone non riuscita: ${erroreInserimento.message}`);
    }
  }

  return err(500, 'TOKEN_COLLISION', 'Non sono riuscito a fabbricare un gettone libero.');
});
