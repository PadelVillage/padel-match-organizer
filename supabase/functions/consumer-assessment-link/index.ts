import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  TENTATIVI_PER_GIRO,
  GIORNI_DI_ATTESA,
  ORE_SILENZIO_ASSENSO,
  quandoMs,
  sceltaDellaProva,
  stessaProva,
  giriDelSocio,
  statoDelGiro,
} from './giro-del-test.ts';
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
      .select('token, submitted_at, raw_response, member_decision, member_decision_at')
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
        // o riprovi?» solo dove la domanda esiste davvero. `puo_scegliere` è vero solo se
        // la prova ha passato il cancello, nessuna scelta è già registrata, il livello non
        // è già stato applicato e il giro è ancora APERTO su questa prova (alla terza non
        // c'è niente da chiedere: si applica da sola). `scelta_entro` è il momento in cui
        // il silenzio diventa assenso (`ORE_SILENZIO_ASSENSO`) — il bot può dire «hai
        // tempo fino a…» senza tenere il numero in casa.
        scelta: sceltaDellaProva(s),
        puo_scegliere: (() => {
          if (esito !== 'pass') return false;
          if (sceltaDellaProva(s)) return false;
          const corrente = giriDelSocio(elenco, TENTATIVI_PER_GIRO).corrente;
          return corrente.length > 0 && stessaProva(corrente[corrente.length - 1], s);
        })(),
        scelta_entro: quandoMs(s.submitted_at)
          ? new Date(quandoMs(s.submitted_at) + ORE_SILENZIO_ASSENSO * 60 * 60 * 1000).toISOString()
          : null,
      };
      // ⚠️ `puo_scegliere` mente se il livello è GIÀ stato applicato (silenzio scaduto o
      // «mi fermo» già lavorato dal cron): quel caso lo copre `livello_applicato`, e la
      // correzione si fa qui — dopo, perché l'oggetto serve intero per calcolarlo.
      if (ultimaScheda.livello_applicato) ultimaScheda.puo_scegliere = false;
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
    .select('token, status, completed_at')
    .eq('member_local_id', memberId)
    .is('completed_at', null)
    .neq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1);

  if (erroreGettoni) {
    return err(500, 'DB_ERROR', `Lettura dei gettoni non riuscita: ${erroreGettoni.message}`);
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
    promemoria,
  };

  if (esistenti && esistenti.length > 0 && clean(esistenti[0].token)) {
    const token = clean(esistenti[0].token);
    return ok({ ...conteggio, token, url: conNome(token), riusato: true });
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
      return ok({ ...conteggio, token, url: conNome(token), riusato: false });
    }
    // 23505 = unique_violation: solo in quel caso ha senso ritentare.
    if (clean((erroreInserimento as { code?: string }).code) !== '23505') {
      return err(500, 'DB_ERROR', `Creazione del gettone non riuscita: ${erroreInserimento.message}`);
    }
  }

  return err(500, 'TOKEN_COLLISION', 'Non sono riuscito a fabbricare un gettone libero.');
});
