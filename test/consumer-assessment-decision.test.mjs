// ── BANCO: la RISPOSTA del socio — «ti fermi o riprovi?» ───────────────────────────────
//
// Che cosa prova: `motivoDelRifiuto` dell'edge `consumer-assessment-decision`, cioè il
// pezzo che decide se una scelta arrivata dal bot si può scrivere sulla scheda. Voce 61
// § A ④ (19/08/2026), sua regola del 17/08: *«decidi tu a quale delle tre volte ti vuoi
// fermare»*.
//
// 🚨 IL CASO 5 È IL PIÙ IMPORTANTE E IL MENO OVVIO: i bottoni di Telegram non scadono. Il
//    socio può schiacciare «mi fermo» su un messaggio di tre settimane fa, quando nel
//    frattempo ha già rifatto il test. Scrivere quella scelta riscriverebbe la storia di un
//    giro già andato avanti — e la scelta si fa sull'ULTIMA prova, non sul passato.
//
// 🚨 IL CASO 6 È IL SUO GEMELLO all'altro capo: sulla TERZA prova non c'è niente da
//    scegliere (si applica da sola, non c'è una quarta a cui rimandare). Una scelta
//    registrata lì potrebbe solo BLOCCARE un esito che deve passare — «riprovo» su una
//    prova che il cron sta per applicare la fermerebbe per sempre.
//
// ⭐ Le funzioni sono ESTRATTE dal sorgente vero dell'edge e dal modulo del giro, non
//    ricopiate qui: un banco che prova una copia prova la copia.
//
// Uso:  node --test test/consumer-assessment-decision.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const CARTELLA = join(QUI, '..', 'supabase', 'functions', 'consumer-assessment-decision');
const src = readFileSync(join(CARTELLA, 'index.ts'), 'utf8');
/** Il sorgente SENZA commenti: le guardie devono guardare i fatti, non le parole che li raccontano. */
const codice = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const srcGiro = readFileSync(join(CARTELLA, 'giro-del-test.ts'), 'utf8');

// Stesso estrattore degli altri banchi: salta i commenti (in italiano sono pieni di
// apostrofi) e parte dopo la lista dei parametri.
function estrai(nome, testo) {
  const src = testo;
  const inizio = src.indexOf(`function ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata nel sorgente`);
  let t = src.indexOf('(', inizio), tonde = 0;
  for (; t < src.length; t++) {
    if (src[t] === '(') tonde++;
    else if (src[t] === ')') { tonde--; if (tonde === 0) { t++; break; } }
  }
  let i = src.indexOf('{', t), livello = 0, stringa = null, prec = '';
  for (; i < src.length; i++) {
    const c = src[i], succ = src[i + 1];
    if (stringa) { if (c === stringa && prec !== '\\') stringa = null; }
    else if (c === '/' && succ === '/') { const fine = src.indexOf('\n', i); i = fine < 0 ? src.length : fine; prec = '\n'; continue; }
    else if (c === '/' && succ === '*') { const fine = src.indexOf('*/', i + 2); i = fine < 0 ? src.length : fine + 1; prec = '/'; continue; }
    else if (c === '"' || c === "'" || c === '`') stringa = c;
    else if (c === '{') livello++;
    else if (c === '}') { livello--; if (livello === 0) { i++; break; } }
    prec = c;
  }
  return src.slice(inizio, i);
}

const spoglia = (codice) => codice
  .replace(/([(,]\s*\w+)\s*:\s*any\b/g, '$1')
  .replace(/\b(let|const)\s+(\w+)\s*:\s*any(\[\])?(?=\s*[=;])/g, '$1 $2');

// ⭐ I numeri e le parole della regola si LEGGONO dal modulo: ricopiarli qui vorrebbe dire
// che il banco resta verde anche se domani la regola ne usasse altri.
function costante(nome) {
  const m = srcGiro.match(new RegExp(`const ${nome} = ([0-9.]+)`));
  if (!m) throw new Error(`costante «${nome}» non trovata nel modulo del giro`);
  return Number(m[1]);
}
function parola(nome) {
  const m = srcGiro.match(new RegExp(`const ${nome} = '([^']+)'`));
  if (!m) throw new Error(`costante «${nome}» non trovata nel modulo del giro`);
  return m[1];
}
const TENTATIVI_PER_GIRO = costante('TENTATIVI_PER_GIRO');
const MI_FERMO = parola('SCELTA_MI_FERMO');
const RIPROVO = parola('SCELTA_RIPROVO');
// 🆕 27/08 sera — la terza: «va bene, prendo il gradino». Letta dal modulo come le altre due.
const SCENDO = parola('SCELTA_SCENDO');

// 🆕 28/08/2026 (E1) — il tetto si LEGGE dal modulo come gli altri numeri: scriverlo qui
// vorrebbe dire un banco verde anche il giorno in cui il tetto cambia.
const TETTO_AUTOMATICO = costante('TETTO_AUTOMATICO');

const ctx = { TENTATIVI_PER_GIRO, TETTO_AUTOMATICO, SCELTA_MI_FERMO: MI_FERMO, SCELTA_RIPROVO: RIPROVO, SCELTA_SCENDO: SCENDO };
vm.createContext(ctx);
vm.runInContext(
  spoglia([
    // 🆕 28/08 (E1): `sopraIlTetto` e `ilTestDiceMeno` entrano nel banco perché la regola del
    // rifiuto ora li CHIAMA — con le due su cui poggiano (`definizioneLivello`,
    // `livelloDimostrato`). Senza, la regola esploderebbe alla prima chiamata invece di
    // rispondere, ed è il genere di rosso che si scambia per un difetto della cura.
    ...['esitoDellaProva', 'quandoMs', 'sceltaDellaProva', 'stessaProva', 'giriDelSocio', 'laProvaEsaurisceIlGiro',
      'definizioneLivello', 'livelloDimostrato', 'sopraIlTetto', 'ilTestDiceMeno']
      .map((n) => estrai(n, srcGiro)),
    estrai('motivoDelRifiuto', src),
  ].join('\n')),
  ctx,
);
const { motivoDelRifiuto } = ctx;

// ── Il materiale ────────────────────────────────────────────────────────────────
const GIORNO = 24 * 60 * 60 * 1000;
const ADESSO = Date.parse('2026-08-19T12:00:00.000Z');
const giorniFa = (n) => new Date(ADESSO - n * GIORNO).toISOString();
const prova = (token, quando, esito, extra = {}) => ({
  token, submitted_at: quando, applied_at: null,
  raw_response: { knowledge: { status: esito } },
  ...extra,
});

const casi = [];
const caso = (nome, fn) => casi.push({ nome, fn });

caso('1. la scelta buona passa: «mi fermo» e «riprovo», e nient\'altro', () => {
  const p = prova('T1', giorniFa(1), 'pass');
  return [
    motivoDelRifiuto(MI_FERMO, p, [p]) === '',
    motivoDelRifiuto(RIPROVO, p, [p]) === '',
    motivoDelRifiuto('forse', p, [p]) === 'SCELTA_SCONOSCIUTA',
    motivoDelRifiuto('', p, [p]) === 'SCELTA_SCONOSCIUTA',
    motivoDelRifiuto(null, p, [p]) === 'SCELTA_SCONOSCIUTA',
  ];
});

caso('2. una scheda che non c\'è (o non è sua) si rifiuta UGUALE, senza dire quale dei due', () => {
  // ⚖️ Il rifiuto è lo stesso nei due casi di proposito: due rifiuti diversi direbbero a
  //    chiunque provi un gettone a caso se quel gettone ESISTE, cioè farebbero scoprire le
  //    schede degli altri una domanda per volta.
  return [motivoDelRifiuto(MI_FERMO, null, []) === 'SCHEDA_NON_TROVATA'];
});

caso('3. 🔄🗣️ su una BOCCIATURA «mi fermo» ADESSO SI PUÒ — «riprovo» no', () => {
  /* 🗣️ 27/08, sua segnalazione con lo schermo davanti: *«manca il bottone che mi lascia il
     livello come per il precedente»*. Fin qui questo caso pretendeva il rifiuto su tutt'e due
     le scelte, ed era giusto finché il «no» era una riga di testo.
     ⇒ Adesso «mi fermo» su una bocciata è un FATTO che si registra — *ho letto, mi tengo il
     livello che ho* — e non può scrivere nessun livello: `assessment-apply-level` ferma le
     schede col quiz non superato PRIMA di guardare la scelta del socio.
     ⛔ Il «riprovo» resta rifiutato: rifare il test si fa dal link, non è una scelta da
     registrare — accettarlo qui darebbe due strade per la stessa cosa. */
  const bocciata = prova('T1', giorniFa(1), 'fail');
  const senzaCancello = { token: 'T1', submitted_at: giorniFa(1), applied_at: null, raw_response: {} };
  return [
    motivoDelRifiuto(MI_FERMO, bocciata, [bocciata]) === '',
    motivoDelRifiuto(RIPROVO, bocciata, [bocciata]) === 'PROVA_NON_PASSATA',
    // ⛔ E `skip` resta fuori: a Semi-Pro e Professionista il quiz non viene nemmeno posto,
    //    quindi non c'è nessuna domanda a cui questa sarebbe una risposta.
    motivoDelRifiuto(MI_FERMO, senzaCancello, [senzaCancello]) === 'PROVA_NON_PASSATA',
  ];
});

caso('3bis. 🚨 alla TERZA prova bocciata il «mi fermo» non diventa GIRO_FINITO', () => {
  /* GIRO_FINITO dice «l'esito si applica da solo, non c'è niente da scegliere»: su una
     bocciata non c'è nessun esito da applicare, e quel rifiuto direbbe al socio «non c'è
     niente da scegliere» proprio mentre gli si offre di scegliere. */
  const una = prova('T1', giorniFa(3), 'fail');
  const due = prova('T2', giorniFa(2), 'fail');
  const treBocciata = prova('T3', giorniFa(1), 'fail');
  const trePassata = prova('T3', giorniFa(1), 'pass');
  return [
    motivoDelRifiuto(MI_FERMO, treBocciata, [una, due, treBocciata]) === '',
    /* 🔄 27/08: e nemmeno sulla PASSATA, dove fino a stamattina il rifiuto restava. La riga
       vecchia diceva «…mentre su una prova SUPERATA il rifiuto resta, che è il caso per cui
       esiste»: è stata rovesciata, non affiancata. Vedi il caso 6. */
    motivoDelRifiuto(MI_FERMO, trePassata, [una, due, trePassata]) === '',
  ];
});

caso('3ter. 🚨 CABLAGGIO: il giro d\'applicazione NON parte su una bocciata', () => {
  /* Il caso qui sopra prova la REGOLA; questo prova il punto di chiamata, che è dove il
     difetto tornerebbe intero con la regola ancora perfetta: senza la guardia, ogni tocco su
     una bocciata lancerebbe un giro che non può applicare niente. */
  return [
    /scelta === SCELTA_MI_FERMO && provaSuperata/.test(codice),
    // …e che il verdetto esca verso il bot, invece di farglielo indovinare.
    /prova_superata: provaSuperata/.test(codice),
  ];
});

caso('4. una scheda GIÀ APPLICATA non si sceglie più: la scelta è arrivata dopo i fatti', () => {
  const applicata = prova('T1', giorniFa(2), 'pass', { applied_at: giorniFa(1) });
  return [motivoDelRifiuto(MI_FERMO, applicata, [applicata]) === 'GIA_APPLICATA'];
});

caso('5. 🚨🚨 IL BOTTONE VECCHIO: una prova SUPERATA da una più recente non si sceglie', () => {
  // I bottoni di Telegram non scadono. Se questa scelta passasse, il socio riscriverebbe la
  // storia di un giro che è già andato avanti — e il giro cambierebbe forma sotto il cron.
  const vecchia = prova('T1', giorniFa(20), 'pass');
  const nuova = prova('T2', giorniFa(1), 'fail');
  return [
    motivoDelRifiuto(MI_FERMO, vecchia, [vecchia, nuova]) === 'SCHEDA_SUPERATA',
    // …e sulla più recente invece si sceglie eccome (se ha passato il quiz)
    motivoDelRifiuto(MI_FERMO, prova('T2', giorniFa(1), 'pass'), [vecchia, prova('T2', giorniFa(1), 'pass')]) === '',
  ];
});

caso('6. 🔄🚨⭐⭐ sulla TERZA prova ADESSO SI SCEGLIE — e qui c\'era il contrario', () => {
  /* 🔄 ROVESCIATO il 27/08 su un difetto VISTO, non su un'idea. Questo caso pretendeva
     `GIRO_FINITO` su tutt'e due le scelte, e la sua nota diceva «il rifiuto qui PROTEGGE».
     📏 Il fatto che lo smonta: il test vero di Maurizio del 27/08 alle 10:12:51 era la sua
     terza prova ⇒ nessuna domanda dal ponte del link, e in scheda 4 contro 4,5 dimostrato
     (tutti e due «Avanzato») ⇒ né maestro né «dice meno» ⇒ e il livello non si sarebbe
     scritto mai (il tetto taglia a 3,5, che è meno di 4). Il bot ha detto «fra poco ti scrivo
     com'è andata» e poi è rimasto muto PER SEMPRE.
     ⚖️ La protezione che questa riga dichiarava — «un riprovo fermerebbe per sempre un esito
     che la sua regola vuole applicato» — poggiava sull'attesa di trenta giorni: allora dopo la
     terza non c'era un dopo. Dal 25/08 l'attesa è ZERO ⇒ il giro nuovo nasce subito e chi dice
     «riprovo» rifà il test all'istante. Non si ferma più niente per sempre.
     📌 Una regola che protegge da una conseguenza che non esiste più non protegge: vieta. */
  const terza = prova('T3', giorniFa(1), 'pass');
  const giro = [prova('T1', giorniFa(5), 'fail'), prova('T2', giorniFa(3), 'fail'), terza];
  return [
    motivoDelRifiuto(MI_FERMO, terza, giro) === '',
    motivoDelRifiuto(RIPROVO, terza, giro) === '',
  ];
});

caso('6bis. 🔒 ma i rifiuti che poggiano su un FATTO reggono tutti', () => {
  /* La cura toglie un divieto che contava le prove; non tocca i tre che guardano cosa è
     successo davvero. È la riga che distingue questa cura da un indebolimento. */
  const terza = prova('T3', giorniFa(1), 'pass');
  const giro = [prova('T1', giorniFa(5), 'fail'), prova('T2', giorniFa(3), 'fail'), terza];
  const applicata = prova('T3', giorniFa(1), 'pass', { applied_at: giorniFa(1) });
  const bocciata = prova('T3', giorniFa(1), 'fail');
  const piuRecente = prova('T4', giorniFa(0), 'pass');
  return [
    motivoDelRifiuto(MI_FERMO, applicata, [applicata]) === 'GIA_APPLICATA',
    motivoDelRifiuto(MI_FERMO, terza, [...giro, piuRecente]) === 'SCHEDA_SUPERATA',
    motivoDelRifiuto(RIPROVO, bocciata, [bocciata]) === 'PROVA_NON_PASSATA',
  ];
});

caso('7. sulla PRIMA e sulla SECONDA prova invece si sceglie: sono quelle con una domanda', () => {
  const prima = prova('T1', giorniFa(5), 'pass');
  const seconda = prova('T2', giorniFa(3), 'pass');
  return [
    motivoDelRifiuto(MI_FERMO, prima, [prima]) === '',
    motivoDelRifiuto(MI_FERMO, seconda, [prima, seconda]) === '',
  ];
});

caso('8. ⭐ la scelta si può CAMBIARE finché è viva: l\'ultima parola vince', () => {
  // «Mi fermo» e poi «riprovo» dieci minuti dopo è un ripensamento, non un guasto: a
  // congelarla sono i FATTI (l'applicazione del cron, una prova nuova), non un divieto.
  const giaScelta = prova('T1', giorniFa(1), 'pass', { member_decision: MI_FERMO, member_decision_at: giorniFa(1) });
  return [motivoDelRifiuto(RIPROVO, giaScelta, [giaScelta]) === ''];
});

caso('9. `skip` non è una prova passata: Semi-Pro e Professionista non scelgono niente', () => {
  // La loro scheda la guarda il maestro (voce 61 § C): non c'è un livello calcolato da
  // tenere o rifiutare, e trattarli come una prova li chiuderebbe in un giro che non hanno.
  const skip = prova('T1', giorniFa(1), 'skip');
  return [motivoDelRifiuto(MI_FERMO, skip, [skip]) === 'PROVA_NON_PASSATA'];
});

caso('10. l\'ordine dell\'elenco non conta, e un elenco assente non fa esplodere niente', () => {
  const vecchia = prova('T1', giorniFa(20), 'pass');
  const nuova = prova('T2', giorniFa(1), 'pass');
  return [
    motivoDelRifiuto(MI_FERMO, vecchia, [nuova, vecchia]) === 'SCHEDA_SUPERATA',
    motivoDelRifiuto(MI_FERMO, vecchia, [vecchia, nuova]) === 'SCHEDA_SUPERATA',
    motivoDelRifiuto(MI_FERMO, nuova, null) === '',
    motivoDelRifiuto(MI_FERMO, nuova, undefined) === '',
  ];
});

// ── 🆕 LA TERZA SCELTA: «va bene, prendo il gradino» (sua, 27/08 sera) ──────────────────
// 🗣️ *«non dobbiamo ferire l'orgoglio del giocatore. Possiamo proporgli di scendere di un
//    gradino o se no di rimanere a livello dell'ultimo test fatto, oppure di rifare il test»*.
// ⚖️ Qui si prova SOLO che la scelta sia ammissibile: quale gradino sia, e se scriverlo, lo
//    decide `assessment-apply-level` (banco suo). Questa funzione riceve il gradino già
//    calcolato — è ciò che la tiene una regola pura, senza letture.

caso('9. ⭐ «scendo» passa su una prova SUPERATA, se un gradino c\'è', () => {
  const p = prova('T1', giorniFa(1), 'pass');
  return [
    motivoDelRifiuto(SCENDO, p, [p], 'Principiante') === '',
    motivoDelRifiuto(SCENDO, p, [p], '') === 'NIENTE_DA_SCENDERE',
    motivoDelRifiuto(SCENDO, p, [p], null) === 'NIENTE_DA_SCENDERE',
  ];
});

caso('10. ⭐⭐ e passa anche sulla BOCCIATA, che è dove serve di più', () => {
  /* 📏 Misurato il 27/08 su tutte le schede col cancello: 6 bocciate, ZERO livelli scritti.
     Sei soci che hanno fatto il test e sono rimasti dov'erano — quasi tutti a 0,5, cioè
     fuori dalle partite. Il gradino è la strada che a quei sei mancava.
     ⛔ Il «riprovo» resta fuori anche adesso: rifare il test si fa dal link. */
  const bocciata = prova('T1', giorniFa(1), 'fail');
  return [
    motivoDelRifiuto(SCENDO, bocciata, [bocciata], 'Principiante') === '',
    motivoDelRifiuto(RIPROVO, bocciata, [bocciata], 'Principiante') === 'PROVA_NON_PASSATA',
  ];
});

caso('11. 🚨 il gradino non scavalca i FATTI: applicata, superata, non è sua', () => {
  const applicata = prova('T1', giorniFa(1), 'pass', { applied_at: giorniFa(0) });
  const vecchia = prova('T1', giorniFa(3), 'pass');
  const recente = prova('T2', giorniFa(1), 'pass');
  return [
    motivoDelRifiuto(SCENDO, applicata, [applicata], 'Principiante') === 'GIA_APPLICATA',
    motivoDelRifiuto(SCENDO, vecchia, [vecchia, recente], 'Principiante') === 'SCHEDA_SUPERATA',
    motivoDelRifiuto(SCENDO, null, [], 'Principiante') === 'SCHEDA_NON_TROVATA',
  ];
});

caso('12. ⛔ su una `skip` non si scende: a Semi-Pro e Professionista il quiz non viene posto', () => {
  // Nessuna domanda fatta ⇒ nessun bottone mostrato ⇒ un «scendo» qui è un tocco che non
  // risponde a niente. Stessa ragione per cui `mi_fermo` vale sulla bocciata e non sullo `skip`.
  const saltata = prova('T1', giorniFa(1), 'skip');
  return [motivoDelRifiuto(SCENDO, saltata, [saltata], 'Avanzato') === 'PROVA_NON_PASSATA'];
});

caso('13. 🔒 e una scelta inventata resta inventata: solo le tre parole del modulo passano', () => {
  const p = prova('T1', giorniFa(1), 'pass');
  return [
    motivoDelRifiuto('scendi', p, [p], 'Principiante') === 'SCELTA_SCONOSCIUTA',
    motivoDelRifiuto('SCENDO', p, [p], 'Principiante') === 'SCELTA_SCONOSCIUTA',
  ];
});

// ── GUARDIE SULLA BASE ──────────────────────────────────────────────────────────
// 🚨 Un banco che misura ZERO resta verde: queste guardano il sorgente dell'edge, non la
//    regola, e fermano i modi in cui questa funzione può fare danno.

/* ══════════════════════════════════════════════════════════════════════════════════════════
   🆕🚨⭐⭐ 28/08/2026 — E1: LE PROTEZIONI DEL PONTE CHE PARLA, ORA ANCHE QUI.
   Il ponte del link spegne `puo_scegliere` su due fatti; questo ponte non li conosceva, e un
   bottone vecchio registrava una scelta SENZA EFFETTO. I casi qui sotto eseguono la regola
   vera — non sono guardie testuali.
   ⚖️ E i tre casi che NON devono rifiutare valgono quanto i due che devono: sono le tre
   letture sbagliate di E1 che avrebbero rotto qualcosa di vivo. ═════════════════════════ */

// Prova superata con un livello dimostrato: `calculated_level` è ciò che la regola legge.
const passata = (livelloDimostrato, extra = {}) =>
  prova('T-E1', giorniFa(1), 'pass', { calculated_level: String(livelloDimostrato), ...extra });

caso('E1-a. sopra il tetto «mi fermo» e «riprovo» si RIFIUTANO: le due risposte portavano allo stesso posto', () => {
  // Il caso Laura del 27/08: in scheda Base (2,5), il test dice Agonista (5) — sopra il tetto
  // (3,5) il livello non lo scrive il test in nessuno dei due casi.
  const p = passata(5);
  return [
    motivoDelRifiuto(MI_FERMO, p, [p], '', '2.5') === 'ASPETTA_IL_MAESTRO',
    motivoDelRifiuto(RIPROVO, p, [p], '', '2.5') === 'ASPETTA_IL_MAESTRO',
  ];
});

caso('E1-b. quando il test dice MENO si rifiutano uguale: non c\'era niente da tenere', () => {
  // In scheda Avanzato (4), il test dice Intermedio (3): il livello non scende da sé.
  const p = passata(3);
  return [
    motivoDelRifiuto(MI_FERMO, p, [p], '', '4') === 'IL_TEST_DICE_MENO',
    motivoDelRifiuto(RIPROVO, p, [p], '', '4') === 'IL_TEST_DICE_MENO',
  ];
});

caso('E1-c. 🚨 «SCENDO» NON SI TOCCA: ha già il suo cancello, ed è l\'unica che scrive davvero', () => {
  /* ⛔ La lettura sbagliata ① di E1. Il gradino è stato messo in servizio il 27/08 sera apposta
     per questi casi: rifiutarlo qui vorrebbe dire spegnerlo il giorno dopo averlo acceso.
     Chi ha il gradino (`gradino` non vuoto) passa, sopra il tetto o sotto che sia. */
  const sopra = passata(5);
  const meno = passata(3);
  return [
    motivoDelRifiuto(SCENDO, sopra, [sopra], 'Intermedio', '2.5') === '',
    motivoDelRifiuto(SCENDO, meno, [meno], 'Intermedio', '4') === '',
  ];
});

caso('E1-d. 🚨 LA STESSA FASCIA PASSA — è la sua regola del 27/08, non un buco', () => {
  /* ⛔ La lettura sbagliata ② di E1, che nomina «stessa fascia» fra i tre fatti. Sue parole:
     *«quando uno fa il test e risulta lo stesso livello che già ha nella scheda, non c'è
     bisogno che si chiami il maestro. Ci deve essere il bottone»*. Il caso di Maurizio: in
     scheda 4, test 4,5 — due numeri diversi, la STESSA parola («Avanzato»). */
  const p = passata(4.5);
  return [
    motivoDelRifiuto(MI_FERMO, p, [p], '', '4') === '',
    motivoDelRifiuto(RIPROVO, p, [p], '', '4') === '',
  ];
});

caso('E1-e. 🚨 LIVELLO SCONOSCIUTO NON RIFIUTA: da un non-so non nasce un rifiuto', () => {
  /* ⛔ La lettura sbagliata ③. Quando la lettura del socio fallisce, l'edge passa `null` e
     `mi_fermo`/`riprovo` proseguono come ieri. Cedere chiuso rifiuterebbe una scelta
     LEGITTIMA a ogni singhiozzo del database — un danno certo per coprirne uno improbabile. */
  const p = passata(5);   // sopra il tetto: rifiuterebbe, se sapesse il livello
  return [
    motivoDelRifiuto(MI_FERMO, p, [p], '', null) === '',
    motivoDelRifiuto(RIPROVO, p, [p], '', undefined) === '',
  ];
});

caso('E1-g. 🚨 «NON HO IL LIVELLO» NON È «NON SO IL LIVELLO», e il banco me l\'ha insegnato', () => {
  /* 🩹 Questo caso è nato da un mio ERRORE, e resta a segnarlo: avevo scritto che anche la
     stringa vuota doveva passare, mettendola nello stesso sacco di `null`. Il banco è
     diventato rosso, ed è la cura ad avere ragione — le due cose sono diverse:
       · `null`  = **non lo so**, la lettura del socio è fallita ⇒ non si rifiuta;
       · `''`    = **lo so, e non ce l'ha**, il socio non ha ancora un livello in scheda ⇒ è un
                   fatto come un altro, e `sopraIlTetto` risponde `true` apposta (chi non ha
                   niente e dimostra Agonista il maestro lo deve vedere davvero).
     ⚖️ La prova che conta è che questo combacia col ponte che PARLA: là `aspetta_maestro` su un
     socio senza livello è vero identico, e `puo_scegliere` si spegne. Due ponti che rispondono
     diverso sulla stessa persona sarebbero il difetto che E1 esiste per chiudere.
     📌 *Un valore mancante e un valore sconosciuto si somigliano solo a chi non deve deciderci
     niente sopra.* */
  const p = passata(5);
  return [motivoDelRifiuto(MI_FERMO, p, [p], '', '') === 'ASPETTA_IL_MAESTRO'];
});

caso('E1-f. i fatti PIÙ FORTI vengono prima: una scheda già applicata non diventa «aspetta il maestro»', () => {
  /* ⚖️ L'ordine dei rifiuti è una decisione, non un caso: `GIA_APPLICATA` dice «è già scritto»
     ed è più vero di «non si potrà scrivere». Chi spostasse i due controlli nuovi più in alto
     direbbe al socio la ragione sbagliata su una cosa già successa. */
  const p = passata(5, { applied_at: giorniFa(0) });
  return [motivoDelRifiuto(MI_FERMO, p, [p], '', '2.5') === 'GIA_APPLICATA'];
});

const guardie = [
  ['la regola esiste ed è quella estratta', typeof motivoDelRifiuto === 'function'],
  ['il ponte resta disarmato senza segreto', /CONSUMER_BRIDGE_SECRET/.test(src) && /BRIDGE_DISARMED/.test(src)],
  ['il segreto si confronta in tempo costante', /function safeEqual/.test(src) && /diff \|= ab\[i\] \^ bb\[i\]/.test(src)],
  // 🚨 IL CABLAGGIO: la regola è pura, e una regola che nessuno chiama resta verde senza
  //    difendere niente. Qui si misura che l'edge la CHIAMI, e che il rifiuto FERMI la
  //    scrittura invece di limitarsi a comparire nella risposta.
  /* 🔄 28/08/2026 (E1) — la regola ha un quinto argomento: il livello che il socio ha ADESSO.
     ⭐ Non basta che ci sia: si misura che le arrivi il valore VERO. Chi domani ci passasse
        una costante avrebbe una regola inerte e un banco verde — è la lezione del 19/08 (④),
        che è già costata un sabotaggio passato verde. */
  ['l\'edge CHIAMA la regola', /const rifiuto = motivoDelRifiuto\(scelta, scheda, elencoSchede, gradino, livelloSocio\)/.test(src)],
  ['e le passa il livello VERO, non una costante', /livelloSocio = clean\(socio\?\.level\)/.test(src)],
  ['il rifiuto FERMA la scrittura', src.indexOf('if (rifiuto)') < src.indexOf(".update({ member_decision: scelta")],
  // 🚨 Il gettone da solo non basta: una scelta scritta su fede del solo gettone
  //    permetterebbe a un client confuso di decidere per la persona sbagliata.
  ['il gettone deve essere del socio che chiede', /member_local_id\) !== memberId/.test(src)],
  // ⚖️ Questa funzione scrive DUE colonne e nient'altro: il livello lo scrive il cron, e
  //    una scrittura sull'anagrafica da qui salterebbe tutte le protezioni del ③.
  /* 🔄🚨⭐⭐ 27/08/2026 sera — LA SONDA È CAMBIATA, LA PROPRIETÀ NO, e la differenza va detta.
     Qui c'era `!/pmo_cloud_records/`: una sonda che vietava di NOMINARE l'anagrafica. Dal
     gradino questa funzione l'anagrafica la LEGGE — le serve il livello che il socio ha
     adesso per sapere se «scendo» ha ancora senso — e la vecchia sonda sarebbe diventata
     rossa su codice giusto, cioè la specie di guardia che si finisce per spegnere.
     ⚖️ Quello che difendeva resta intero ed è questo: da qui l'anagrafica non si SCRIVE mai.
     ⇒ La sonda ora guarda il verbo, non il nome della tabella: l'unica scrittura ammessa è
     quella su `self_assessments`, e sull'anagrafica si può solo `select`.
     📌 *Quando una sonda diventa rossa su codice giusto non si allarga: si chiede cosa
     doveva misurare, e la si riscrive su quello.* */
  ['scrive solo la scelta, mai il livello del socio',
    !/levelSource/.test(src)
    && !/pmo_cloud_records.\)[\s\S]{0,400}\.(update|insert|upsert|delete)\(/.test(codice)
    && (codice.match(/\.update\(/g) || []).length === 1
    && /from\('self_assessments'\)[\s\S]{0,200}\.update\(\{ member_decision/.test(codice)],
  ['non promette quando il livello sarà scritto', !/livello_applicato: true/.test(src)],
  // 🚨 Due schede sullo stesso gettone non dovrebbero esistere: se succede non si sceglie a
  //    caso — è la stessa difesa dell'ambiguità del readmodel e del link.
  ['sull\'ambiguo non sceglie', /AMBIGUA/.test(src)],
  ['la regola del giro arriva dal modulo, non da una copia locale', /from '\.\/giro-del-test\.ts'/.test(src) && !/function laProvaEsaurisceIlGiro/.test(src)],
  // 🚨⭐⭐ DA QUI IN GIÙ SI GUARDA `codice`, NON `src` — e non è pignoleria: la prima stesura
  // di queste guardie cercava i nomi dentro il FILE, e i commenti che spiegano la cura li
  // contengono tutti. Sabotaggio fatto: tolto il lancio vero, la guardia restava verde perché
  // il nome era ancora scritto lì sopra. ⇒ Una guardia che legge le parole invece dei fatti è
  // esattamente l'errore da cui questo progetto si difende dappertutto, e qui difendeva niente.
  // ⚡ VOCE 84 ⓒ (24/08/2026) — «se non lo trova variato è un disservizio» (parole sue).
  // Il livello non aspetta più il cron dei 15 minuti: su «mi fermo» il giro parte SUBITO.
  ['su «mi fermo» il giro d\'applicazione parte subito', /pmo_dispatch_assessment_apply_level/.test(codice)],
  /* 🔄 27/08 sera — e parte anche su «scendo», che è la scelta che scrive DAVVERO un livello:
     farla aspettare il cron direbbe al socio «va bene, Principiante» lasciandogli Base in
     scheda per un quarto d'ora. ⛔ Su «riprovo» continua a non partire: non c'è niente da
     applicare, e sarebbe una chiamata a vuoto a ogni tocco. */
  ['il giro parte su «mi fermo» e su «scendo», mai su «riprovo»',
    /scelta === SCELTA_MI_FERMO[\s\S]{0,200}scelta === SCELTA_SCENDO[\s\S]{0,900}pmo_dispatch_assessment_apply_level/.test(codice)
    && !/scelta === SCELTA_RIPROVO[\s\S]{0,200}pmo_dispatch/.test(codice)],
  // 🔒 Non si ricopia la regola dell'applicazione: quelle vivono in `assessment-apply-level`,
  // e una seconda copia divergerebbe al primo ripensamento.
  // 🚨 Si guarda il CODICE, non il file: la prima stesura di questa guardia cadeva sul
  // COMMENTO che spiega perché la regola non va ricopiata — cioè leggeva le parole invece dei
  // fatti, che è esattamente l'errore da cui questo progetto si difende dappertutto.
  /* 🔄 27/08 sera — via il divieto di LEGGERE `pmo_cloud_records` (vedi la guardia sopra):
     quello che non si deve ricopiare qui è la regola che sceglie il NUMERO da scrivere, e
     quella si riconosce dai suoi pezzi — `applied_level`, `applied_at`, e la funzione che
     traduce una fascia in un numero (`livelloDellaFascia`), che vive nel ramo del gradino di
     `assessment-apply-level` e lì deve restare. Questa funzione manda la PAROLA e basta. */
  ['la regola dell\'applicazione NON è ricopiata qui',
    !/applied_level\s*:|applied_at\s*:|livelloDellaFascia\(/.test(codice)],
  // 🔒 Si passa dal DISPATCHER, che legge il vault da sé: il segreto delle routine non deve
  // avere un secondo posto da cui uscire. Chiamare l'edge dritta vorrebbe dire portarcelo.
  ['non si chiama l\'edge dritta con un segreto in mano', !/x-pmo-routine-secret/.test(codice)],
  // ⚖️ La risposta al socio non aspetta il giro: la scelta è già scritta e vera. Se il giro
  // non parte si perde la fretta, non il fatto — quindi l'errore si logga e non esce.
  ['un giro fallito non fa fallire la risposta', /console\.error[\s\S]{0,140}giro d.applicazione non partito/.test(codice)],
];

test('BANCO — la risposta del socio: «ti fermi o riprovi?»', () => {
  console.log('\nBANCO — consumer-assessment-decision\n');
  let rossi = 0;
  console.log('Guardie sulla base:');
  for (const [nome, ok] of guardie) {
    console.log(`  ${ok ? '✅' : '❌'} ${nome}`);
    if (!ok) rossi++;
  }
  console.log('');
  for (const c of casi) {
    let esiti;
    try { esiti = c.fn(); } catch (e) { esiti = [false]; console.log(`❌ ${c.nome}\n   errore: ${e.message}`); rossi++; continue; }
    const ok = esiti.every(Boolean);
    console.log(`${ok ? '✅' : '❌'} ${c.nome}`);
    if (!ok) { console.log(`   controlli: [${esiti.map((x) => (x ? 'ok' : 'NO')).join(', ')}]`); rossi++; }
  }
  const totale = casi.length + guardie.length;
  console.log(`\n— ${totale - rossi} passati, ${rossi} falliti su ${totale} —`);
  if (rossi) throw new Error(`${rossi} prove rosse`);
});
