// ── BANCO: «finito il giro, 30 giorni» — la regola dei tentativi del test di livello ───
//
// Che cosa prova: `giro-del-test.ts`, la camminata che decide se un socio può fare il test
// ADESSO, che prova sarebbe, e fino a quando aspetta.
//
// 🔁 19/08/2026 (voce 61 § A ④): la regola è uscita da `consumer-assessment-link/index.ts`
//    ed è diventata un modulo, perché ora la usano in tre — il ponte del link, l'automatismo
//    che applica il livello, e il ponte della SCELTA del socio. Il modulo vive in TRE COPIE
//    identiche (i deploy saltano `_shared/`: il perché sta nella sua intestazione), e a
//    tenerle uguali è la guardia «le tre copie sono identiche» qui sotto.
//
// 🚨 IL CASO 15 È LA REGOLA NUOVA: «mi fermo» CHIUDE il giro, e i 30 giorni partono dalla
//    scelta. Il 16 è il suo rovescio — alla terza prova l'esaurimento VINCE sulla conferma,
//    o chi risponde a una domanda aspetterebbe più di chi la ignora.
//
// 🚨🚨 IL CASO 5 È LA REGOLA NUOVA (sua, 17/08 — voce 61 § A ②): chi PASSA il test chiude
//    il giro e aspetta 30 giorni. Prima poteva rifarlo **subito**, e nessuno se n'era
//    accorto perché il bottone non gli compariva mai. Chi toglie quella regola vede un rosso.
//
// 🚨 IL CASO 8 È IL DIFETTO CHE LA RICOSTRUZIONE A GIRI HA RIPARATO SENZA CHE FOSSE CHIESTO:
//    col conto delle sole fallite, quattro bocciature di fila lasciavano il conto ≥ 3 e
//    facevano ripartire l'attesa dall'ULTIMA ⇒ passati i 30 giorni il socio otteneva **una
//    prova sola** e poi altri 30 giorni, per sempre. Coi giri il giro dopo nasce intero.
//
// ⭐ Le funzioni sono ESTRATTE dal sorgente vero dell'edge, non ricopiate qui: un banco che
//    prova una copia prova la copia. Per questo, in quel file, la regola è scritta in
//    JavaScript nudo — le uniche annotazioni sono `any`, e sono quelle che si tolgono qui.
//
// Uso:  node --test test/consumer-assessment-link.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const FUNZIONI = join(QUI, '..', 'supabase', 'functions');
const PONTE = join(FUNZIONI, 'consumer-assessment-link', 'index.ts');
// Le tre cartelle che portano la copia del modulo. ⚠️ Chi ne aggiunge una la metta QUI:
// la guardia conta le copie da sé, l'elenco no.
const COPIE = ['consumer-assessment-link', 'assessment-apply-level', 'consumer-assessment-decision']
  .map((fn) => join(FUNZIONI, fn, 'giro-del-test.ts'));
const src = readFileSync(COPIE[0], 'utf8');
const srcPonte = readFileSync(PONTE, 'utf8');
// 🆕 ⑥ (19/08) — la regola del PROMEMORIA GENTILE, che vive in una copia sola (la usa un
// ponte solo): il perché sta nella sua intestazione.
const MODULO_PROM = join(FUNZIONI, 'consumer-assessment-link', 'promemoria-livello.ts');
const srcProm = readFileSync(MODULO_PROM, 'utf8');
// 🆕 ⑥ — e le DUE copie di `livello-dimostrato.ts`: da qui il ponte decide chi il livello
// ce l'ha, e dal readmodel si decide chi può organizzare. Due letture diverse della stessa
// domanda sbaglierebbero persona in tutti e due i versi.
const COPIE_LIVELLO = ['consumer-player-readmodel', 'consumer-assessment-link']
  .map((fn) => join(FUNZIONI, fn, 'livello-dimostrato.ts'));

// Stesso estrattore degli altri banchi: salta i commenti (in italiano sono pieni di
// apostrofi) e parte dopo la lista dei parametri.
function estraiDa(fonte, nome) {
  const inizio = fonte.indexOf(`function ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata nell'edge`);
  let t = fonte.indexOf('(', inizio), tonde = 0;
  for (; t < fonte.length; t++) {
    if (fonte[t] === '(') tonde++;
    else if (fonte[t] === ')') { tonde--; if (tonde === 0) { t++; break; } }
  }
  let i = fonte.indexOf('{', t), livello = 0, stringa = null, prec = '';
  for (; i < fonte.length; i++) {
    const c = fonte[i], succ = fonte[i + 1];
    if (stringa) { if (c === stringa && prec !== '\\') stringa = null; }
    else if (c === '/' && succ === '/') { const fine = fonte.indexOf('\n', i); i = fine < 0 ? fonte.length : fine; prec = '\n'; continue; }
    else if (c === '/' && succ === '*') { const fine = fonte.indexOf('*/', i + 2); i = fine < 0 ? fonte.length : fine + 1; prec = '/'; continue; }
    else if (c === '"' || c === "'" || c === '`') stringa = c;
    else if (c === '{') livello++;
    else if (c === '}') { livello--; if (livello === 0) { i++; break; } }
    prec = c;
  }
  return fonte.slice(inizio, i);
}
const estrai = (nome) => estraiDa(src, nome);

/**
 * Il sorgente SENZA commenti né stringhe — per le guardie che contano OCCORRENZE.
 *
 * 🚨⭐ Nata da un rosso su codice giusto, il 19/08/2026: la guardia «il ponte guarda
 * l'orologio una volta sola» contava `Date.now()` con un `match` sul file intero e ne
 * trovava TRE — due erano dentro commenti che PARLANO di `Date.now()`, compreso quello che
 * spiega perché la chiamata dev'essere una sola. ⚖️ È il gemello del difetto del ④, dove il
 * controllo dell'ordine confrontava la posizione della lettura invece che dell'azione: prima
 * di riparare il codice per un rosso conviene chiedersi **cosa misura la sonda**.
 * ⇒ Le stringhe si tolgono con i commenti perché in questo file ce ne sono di piene di `//`
 * (gli indirizzi delle schede): un tagliatore ingenuo si mangerebbe metà del sorgente.
 */
function senzaCommenti(fonte) {
  let out = '', stringa = null, prec = '';
  for (let i = 0; i < fonte.length; i++) {
    const c = fonte[i], succ = fonte[i + 1];
    if (stringa) {
      if (c === stringa && prec !== '\\') stringa = null;
      prec = prec === '\\' ? '' : c;
      continue;                                  // il contenuto delle stringhe non si conta
    }
    if (c === '/' && succ === '/') { const fine = fonte.indexOf('\n', i); i = fine < 0 ? fonte.length : fine; out += '\n'; prec = '\n'; continue; }
    if (c === '/' && succ === '*') { const fine = fonte.indexOf('*/', i + 2); i = fine < 0 ? fonte.length : fine + 1; out += ' '; prec = ' '; continue; }
    if (c === '"' || c === "'" || c === '`') { stringa = c; prec = c; continue; }
    out += c; prec = c;
  }
  return out;
}
const codicePonte = senzaCommenti(srcPonte);

// ⚠️ Si tolgono SOLO le annotazioni `any` — sui parametri e sulle variabili locali. Sono
// l'unica concessione al `deno check` in modalità `strict`, e l'unica differenza fra il
// testo del sorgente e quello che si prova. Chi nell'edge usasse un tipo diverso non
// romperebbe niente in silenzio: questa `vm` non riuscirebbe più a valutare la funzione.
const spoglia = (codice) => codice
  .replace(/([(,]\s*\w+)\s*:\s*any\b/g, '$1')
  .replace(/\b(let|const)\s+(\w+)\s*:\s*any(\[\])?(?=\s*[=;])/g, '$1 $2');

// ⭐ I numeri della regola si LEGGONO dal sorgente: ricopiarli qui vorrebbe dire che il banco
// resta verde anche se domani il ponte ne usa altri — proverebbe la propria copia.
function costanteDa(fonte, nome) {
  const m = fonte.match(new RegExp(`const ${nome} = ([0-9.]+)`));
  if (!m) throw new Error(`costante «${nome}» non trovata nel modulo`);
  return Number(m[1]);
}
function parolaDa(fonte, nome) {
  const m = fonte.match(new RegExp(`const ${nome} = '([^']+)'`));
  if (!m) throw new Error(`costante «${nome}» non trovata nel modulo`);
  return m[1];
}
const costante = (nome) => costanteDa(src, nome);
const parola = (nome) => parolaDa(src, nome);
const PROVE = costante('TENTATIVI_PER_GIRO');
const GIORNI = costante('GIORNI_DI_ATTESA');
const ORE_SILENZIO = costante('ORE_SILENZIO_ASSENSO');
const MI_FERMO = parola('SCELTA_MI_FERMO');

// ⭐ Le costanti del modulo entrano nel contesto LETTE dal modulo (`costante`/`parola`),
// non ricopiate: una copia qui dentro lascerebbe il banco verde anche se domani il modulo
// ne usasse altre — proverebbe la propria copia.
const ctx = {
  TENTATIVI_PER_GIRO: costante('TENTATIVI_PER_GIRO'),
  GIORNI_DI_ATTESA: costante('GIORNI_DI_ATTESA'),
  ORE_SILENZIO_ASSENSO: costante('ORE_SILENZIO_ASSENSO'),
  SCELTA_MI_FERMO: parola('SCELTA_MI_FERMO'),
  SCELTA_RIPROVO: parola('SCELTA_RIPROVO'),
  // 🆕 27/08 — la soglia si LEGGE dal modulo, non si ricopia: ricopiarla lascerebbe il banco
  //    verde anche se domani il tetto cambiasse — proverebbe la propria copia.
  TETTO_AUTOMATICO: costante('TETTO_AUTOMATICO'),
};
vm.createContext(ctx);
vm.runInContext(
  spoglia(['esitoDellaProva', 'quandoMs', 'sceltaDellaProva', 'stessaProva', 'giriDelSocio', 'statoDelGiro', 'laProvaEsaurisceIlGiro',
    // 🆕 27/08 — la regola che decide se il socio va mandato dal maestro: vive qui dal 27/08,
    //    e dev'essere la STESSA che fa la lista nel gestionale (voce 100).
    'livelloDimostrato', 'sopraIlTetto'].map(estrai).join('\n')),
  ctx,
);
const { statoDelGiro, esitoDellaProva, giriDelSocio, laProvaEsaurisceIlGiro, sopraIlTetto } = ctx;

// ── 🆕 ⑥ IL PROMEMORIA GENTILE — secondo modulo, stesso trattamento ────────────
// ⭐ Le costanti si LEGGONO dal modulo: la cadenza è una decisione del committente («un paio
// di volte al mese»), e ricopiarla qui lascerebbe il banco verde anche se domani il modulo
// ne usasse un'altra — proverebbe la propria copia.
const GIORNI_PROM = costanteDa(srcProm, 'GIORNI_TRA_PROMEMORIA');
const EPOCA = parolaDa(srcProm, 'EPOCA_PROMEMORIA');
const MOTIVI = Object.fromEntries(
  ['MOTIVO_HA_LIVELLO', 'MOTIVO_IN_ATTESA', 'MOTIVO_SCHEDA_RECENTE', 'MOTIVO_DA_PERSONA',
   'MOTIVO_DATA_ILLEGGIBILE', 'MOTIVO_OROLOGIO', 'MOTIVO_DOVUTO']
    .map((n) => [n, parolaDa(srcProm, n)]),
);
const ctxProm = { EPOCA_PROMEMORIA: EPOCA, ...MOTIVI };
vm.createContext(ctxProm);
vm.runInContext(
  spoglia(['casellaDelPromemoria', 'promemoriaDelLivello'].map((n) => estraiDa(srcProm, n)).join('\n')),
  ctxProm,
);
const { casellaDelPromemoria, promemoriaDelLivello } = ctxProm;

// ── 🆕 IL GETTONE CHE SI PUÒ RIUSARE (voce 84, 24/08/2026) ──────────────────────
// ⭐ Si ESEGUE la regola vera del ponte, estratta dal sorgente. È deliberato: la prima
// stesura di questa difesa sarebbe stata una guardia testuale («il ponte legge anche
// `self_assessments`»), e una guardia che cerca una stringa non sa dire se la regola è
// GIUSTA — sa solo dire che qualcuno l'ha scritta. Il 24/08 contare invece di pretendere
// l'invariante è già costato due collaudi.
const ctxGettoni = {};
vm.createContext(ctxGettoni);
vm.runInContext(spoglia(estraiDa(srcPonte, 'gettoneDaRiusare')), ctxGettoni);
const { gettoneDaRiusare } = ctxGettoni;



// ── Il materiale ────────────────────────────────────────────────────────────────
const GIORNO = 24 * 60 * 60 * 1000;
const ADESSO = Date.parse('2026-08-18T12:00:00.000Z');
const giorniFa = (n) => new Date(ADESSO - n * GIORNO).toISOString();
const prova = (quando, esito, extra = {}) => ({ token: `T-${quando}`, submitted_at: quando, raw_response: { knowledge: { status: esito } }, ...extra });
// Una prova su cui il socio ha detto «mi fermo», con l'istante in cui l'ha detto.
const fermato = (quandoProva, quandoScelta) =>
  prova(quandoProva, 'pass', { member_decision: MI_FERMO, member_decision_at: quandoScelta });
const stato = (schede, adesso = ADESSO) => statoDelGiro(schede, adesso, PROVE, GIORNI);
// 🆕 25/08 — l'attesa è ZERO dalla decisione di stamattina (vedi la guardia in fondo), e con
// zero il ramo dell'attesa è irraggiungibile: i casi che provano COME SI CHIUDE un giro e da
// quando partirebbe l'attesa avrebbero smesso di misurare qualcosa.
// ⚖️ Perciò quei casi passano un'attesa ESPLICITA invece della costante: continuano a provare
// la macchina — che resta intera e riaccendibile con un numero — mentre i casi nuovi in fondo
// provano la DECISIONE di oggi, cioè che con la costante vera non si blocca più nessuno.
// 📌 È la differenza fra provare un meccanismo e provare una scelta: servono tutti e due, e
// mescolarli è il modo di perdere il primo il giorno in cui cambia la seconda.
const ATTESA_DI_PROVA = 30;
const statoConAttesa = (schede, adesso = ADESSO, giorni = ATTESA_DI_PROVA) => statoDelGiro(schede, adesso, PROVE, giorni);

const casi = [];
const caso = (nome, fn) => casi.push({ nome, fn });

caso('1. chi non ha mai fatto il test: ammesso, ed è la prova 1', () => {
  const s = stato([]);
  return [s.ammesso === true, s.prova === 1, s.falliti === 0, s.attesa === null];
});

caso('2. una bocciatura: si affina, ed è la prova 2', () => {
  const s = stato([prova(giorniFa(1), 'fail')]);
  return [s.ammesso === true, s.prova === 2, s.falliti === 1, s.ultima_prova === false];
});

caso('3. due bocciature: la terza è l\'ultima, e lo dice', () => {
  const s = stato([prova(giorniFa(2), 'fail'), prova(giorniFa(1), 'fail')]);
  return [s.ammesso === true, s.prova === 3, s.ultima_prova === true];
});

caso('4. tre bocciature: giro ESAURITO, e i 30 giorni partono dall\'ultima', () => {
  const s = statoConAttesa([prova(giorniFa(10), 'fail'), prova(giorniFa(9), 'fail'), prova(giorniFa(8), 'fail')]);
  return [
    s.ammesso === false,
    s.attesa?.motivo === 'esaurito',
    s.falliti === 3,
    s.attesa?.giorni === ATTESA_DI_PROVA - 8,
    s.attesa?.dal === new Date(Date.parse(giorniFa(8)) + ATTESA_DI_PROVA * GIORNO).toISOString(),
  ];
});

caso('5. 🚨🚨 chi PASSA non chiude il giro: può ancora AFFINARE, due volte', () => {
  // ⚖️ Il difetto da togliere era il «subito e all'INFINITO», non il riprovare: nel giro
  //    disegnato dal committente, dopo una prova riuscita si può riprovare per salire ancora.
  //    Chiudere al primo `pass` darebbe le tre prove solo a chi sbaglia il quiz.
  const s = stato([prova(giorniFa(3), 'pass')]);
  return [s.ammesso === true, s.prova === 2, s.falliti === 0, s.ultima_prova === false];
});

caso('6. bocciato e poi passato: siamo alla terza, ed è l\'ultima del giro', () => {
  const s = stato([prova(giorniFa(5), 'fail'), prova(giorniFa(4), 'pass')]);
  return [s.ammesso === true, s.prova === 3, s.falliti === 1, s.ultima_prova === true];
});

caso('6bis. ⭐ tre prove con una PASSATA in mezzo: giro esaurito, ma le bocciature sono DUE', () => {
  // 🚨 È il caso per cui il bot non può dire «hai sbagliato tre volte»: `tentativi_falliti`
  //    vale 2, e la frase giusta parla di prove finite, non di bocciature (pezzo ⑦).
  const s = statoConAttesa([prova(giorniFa(6), 'fail'), prova(giorniFa(5), 'pass'), prova(giorniFa(4), 'fail')]);
  return [
    s.ammesso === false,
    s.attesa?.motivo === 'esaurito',
    s.falliti === 2,
    s.attesa?.dal === new Date(Date.parse(giorniFa(4)) + ATTESA_DI_PROVA * GIORNO).toISOString(),
  ];
});

caso('7. passata l\'attesa il giro riparta INTERO: prova 1 di 3, non una sola', () => {
  const s = stato([prova(giorniFa(GIORNI + 3), 'fail'), prova(giorniFa(GIORNI + 2), 'fail'), prova(giorniFa(GIORNI + 1), 'fail')]);
  return [s.ammesso === true, s.prova === 1, s.falliti === 0, s.ultima_prova === false];
});

caso('8. 🚨 IL DIFETTO VECCHIO: quattro bocciature di fila non bloccano per sempre', () => {
  // Col conto delle sole fallite: 4 ≥ 3 e attesa dall'ULTIMA ⇒ una prova ogni 30 giorni.
  // Coi giri: le prime tre sono un giro chiuso e scaduto, la quarta apre il giro dopo.
  const s = stato([
    prova(giorniFa(GIORNI + 5), 'fail'), prova(giorniFa(GIORNI + 4), 'fail'), prova(giorniFa(GIORNI + 3), 'fail'),
    prova(giorniFa(1), 'fail'),
  ]);
  return [s.ammesso === true, s.prova === 2, s.falliti === 1];
});

caso('9. `skip` resta FUORI: Semi-Pro e Professionista non consumano prove e non chiudono giri', () => {
  const soloSkip = stato([prova(giorniFa(3), 'skip'), prova(giorniFa(2), 'skip'), prova(giorniFa(1), 'skip')]);
  const inMezzo = stato([prova(giorniFa(3), 'fail'), prova(giorniFa(2), 'skip'), prova(giorniFa(1), 'fail')]);
  return [
    soloSkip.ammesso === true, soloSkip.prova === 1,
    inMezzo.ammesso === true, inMezzo.prova === 3,   // due fallite, lo skip non conta
  ];
});

caso('10. le schede VECCHIE senza il quiz non sono prove: contano zero, come prima', () => {
  const senzaQuiz = { submitted_at: giorniFa(2), raw_response: { source: 'scheda-pubblica' } };
  const s = stato([senzaQuiz, senzaQuiz, senzaQuiz]);
  return [s.ammesso === true, s.prova === 1];
});

caso('11. l\'ordine dell\'elenco non conta: dal database arrivano dalla più recente', () => {
  const desc = [prova(giorniFa(8), 'fail'), prova(giorniFa(9), 'fail'), prova(giorniFa(10), 'fail')];
  const asc = [...desc].reverse();
  const a = statoConAttesa(desc), b = statoConAttesa(asc);
  return [a.ammesso === false, b.ammesso === false, a.attesa.dal === b.attesa.dal];
});

caso('12. i giorni mancanti si arrotondano per ECCESSO e non sono mai 0', () => {
  // giro chiuso 29 giorni e mezzo fa: manca mezza giornata, e «0 giorni» sarebbe una bugia
  const mezzaGiornataAllaFine = new Date(ADESSO - (GIORNI - 0.5) * GIORNO).toISOString();
  const s = stato([prova(giorniFa(31), 'fail'), prova(giorniFa(30.5), 'fail'), prova(mezzaGiornataAllaFine, 'fail')]);
  return [s.ammesso === false, s.attesa.giorni === 1];
});

caso('13. 🔒 una data di chiusura illeggibile NON chiude la porta in faccia a nessuno', () => {
  const rotta = { submitted_at: 'non-una-data', raw_response: { knowledge: { status: 'fail' } } };
  const s = stato([rotta, rotta, rotta]);
  return [s.ammesso === true, s.prova === 1];
});

caso('14. l\'esito si legge dove sta davvero, e una scheda malformata non esplode', () => {
  return [
    esitoDellaProva(prova(giorniFa(1), 'fail')) === 'fail',
    esitoDellaProva({}) === '',
    esitoDellaProva(null) === '',
    esitoDellaProva({ raw_response: null }) === '',
  ];
});

caso('15. 🚨🚨 LA REGOLA NUOVA (④): «mi fermo» CHIUDE il giro, e l\'attesa, se c\'è, parte dalla SCELTA', () => {
  // Prima prova passata, e il socio si ferma lì: il giro è finito con due prove non usate —
  // è esattamente ciò che la sua regola concede, «decidi tu a quale delle tre volte fermarti».
  // ⚖️ L'attesa parte da quando ha SCELTO, non da quando ha fatto la prova: fra le due cose
  // possono passare ore, e far partire l'attesa dalla prova regalerebbe tempo a chi tarda.
  const s = statoConAttesa([fermato(giorniFa(10), giorniFa(9))]);
  return [
    s.ammesso === false,
    s.attesa?.motivo === 'confermato',
    s.attesa?.dal === new Date(Date.parse(giorniFa(9)) + ATTESA_DI_PROVA * GIORNO).toISOString(),
    s.falliti === 0,
  ];
});

caso('16. 🚨 alla TERZA prova l\'esaurimento VINCE sulla conferma: l\'attesa non si allunga', () => {
  // Se contasse la conferma, chi risponde «mi fermo» dopo la terza aspetterebbe PIÙ di chi
  // non risponde affatto — cioè la cortesia costerebbe giorni. Il giro era finito comunque.
  const terza = fermato(giorniFa(10), giorniFa(3));
  const s = statoConAttesa([prova(giorniFa(12), 'fail'), prova(giorniFa(11), 'fail'), terza]);
  return [
    s.ammesso === false,
    s.attesa?.motivo === 'esaurito',
    s.attesa?.dal === new Date(Date.parse(giorniFa(10)) + ATTESA_DI_PROVA * GIORNO).toISOString(),
    s.falliti === 2,
  ];
});

caso('17. «riprovo» NON chiude niente: il giro resta aperto e la prova dopo è la seconda', () => {
  const s = stato([prova(giorniFa(2), 'pass', { member_decision: 'riprovo', member_decision_at: giorniFa(2) })]);
  return [s.ammesso === true, s.prova === 2, s.attesa === null];
});

caso('18. dopo un giro CONFERMATO e scaduto, il giro nuovo nasce INTERO', () => {
  const s = stato([fermato(giorniFa(GIORNI + 3), giorniFa(GIORNI + 2))]);
  return [s.ammesso === true, s.prova === 1, s.ultima_prova === false];
});

caso('19. 🔒 «mi fermo» senza l\'istante della scelta non blocca nessuno', () => {
  // La data illeggibile vale come per l'esaurito: `quandoMs` torna 0, l'attesa risulta
  // scaduta nel 1970 e il giro riparte. Un dato storto non chiude la porta in faccia.
  const senzaData = prova(giorniFa(2), 'pass', { member_decision: MI_FERMO, member_decision_at: '' });
  const s = stato([senzaData]);
  return [s.ammesso === true, s.prova === 1];
});

caso('20. ⭐ `laProvaEsaurisceIlGiro` riconosce SOLO la terza, ed è quella che si applica da sola', () => {
  const prima = prova(giorniFa(5), 'fail');
  const seconda = prova(giorniFa(4), 'fail');
  const terza = prova(giorniFa(3), 'pass');
  const tutte = [prima, seconda, terza];
  return [
    laProvaEsaurisceIlGiro(tutte, terza, PROVE) === true,
    laProvaEsaurisceIlGiro(tutte, prima, PROVE) === false,
    laProvaEsaurisceIlGiro(tutte, seconda, PROVE) === false,
    // una prova che chiude per CONFERMA non «esaurisce»: si applica perché il socio l'ha
    // detto, e quella strada in `decidi` esiste per conto suo.
    laProvaEsaurisceIlGiro([fermato(giorniFa(2), giorniFa(1))], fermato(giorniFa(2), giorniFa(1)), PROVE) === false,
  ];
});

caso('21. i giri si contano tutti, non solo l\'ultimo: due chiusi e uno aperto', () => {
  const giri = giriDelSocio([
    prova(giorniFa(80), 'fail'), prova(giorniFa(79), 'fail'), prova(giorniFa(78), 'fail'),
    fermato(giorniFa(50), giorniFa(50)),
    prova(giorniFa(2), 'fail'),
  ], PROVE);
  return [
    giri.chiusi.length === 2,
    giri.chiusi[0].motivo === 'esaurito',
    giri.chiusi[1].motivo === 'confermato',
    giri.corrente.length === 1,
  ];
});

// ── 🆕🔔 ⑥ IL PROMEMORIA GENTILE — «a chi non ha il livello, un paio di volte al mese» ──
//
// 🗣️ Sua, 17/08/2026. 🚨 Ogni porta di questa regola è un «NON parlare»: il promemoria è un
//    messaggio che nessuno ha chiesto, quindi il costo di mandarlo a sproposito è molto più
//    alto del costo di saltarne uno — e i casi qui sotto misurano i silenzi, non gli invii.
// ⭐ Il caso 26 è il difetto che si sarebbe visto solo dal vivo: un socio con una domanda in
//    sospeso (il ④) non è in attesa e non ha il livello ⇒ senza la porta della scheda recente
//    riceverebbe «fai il test» mentre il bot aspetta la sua risposta alla domanda di prima.

const promProva = (d) => promemoriaDelLivello({ giorni: GIORNI_PROM, adessoMs: ADESSO, ...d });
// Un socio nudo: nessun livello, nessuna scheda, giro aperto. È il destinatario del ⑥.
const SENZA_NULLA = { haIlLivello: false, ammesso: true, ultimaSchedaMs: 0, ultimoEsito: '' };
const casella = (t) => casellaDelPromemoria(t, GIORNI_PROM);

caso('22. ⑥ chi non ha il livello e può fare il test: il promemoria è DOVUTO', () => {
  const r = promProva(SENZA_NULLA);
  return [r.dovuto === true, r.motivo === MOTIVI.MOTIVO_DOVUTO, r.periodo !== '', r.fino_a !== ''];
});

caso('23. ⑥ chi il livello ce l\'ha già non lo riceve', () => {
  const r = promProva({ ...SENZA_NULLA, haIlLivello: true });
  return [r.dovuto === false, r.motivo === MOTIVI.MOTIVO_HA_LIVELLO];
});

caso('24. ⑥ chi è in ATTESA non lo riceve: sarebbe mandarlo contro una porta chiusa', () => {
  const r = promProva({ ...SENZA_NULLA, ammesso: false });
  return [r.dovuto === false, r.motivo === MOTIVI.MOTIVO_IN_ATTESA];
});

caso('25. ⑥ una scheda arrivata DENTRO la casella tace; una PRIMA della casella no', () => {
  const c = casella(ADESSO);
  const dentro = promProva({ ...SENZA_NULLA, ultimaSchedaMs: c.inizioMs });
  const prima = promProva({ ...SENZA_NULLA, ultimaSchedaMs: c.inizioMs - 1 });
  return [
    dentro.dovuto === false, dentro.motivo === MOTIVI.MOTIVO_SCHEDA_RECENTE,
    prima.dovuto === true,
  ];
});

caso('26. ⭐🚨 ⑥ chi ha una DOMANDA IN SOSPESO (il ④) non viene sollecitato', () => {
  // Ha passato una prova ORA, il livello non gli è ancora stato applicato (aspetta la sua
  // risposta) e il giro è aperto ⇒ `haIlLivello` falso e `ammesso` vero. Senza la porta
  // della scheda recente il bot gli direbbe «fai il test» mentre aspetta la sua risposta.
  const r = promProva({ haIlLivello: false, ammesso: true, ultimaSchedaMs: ADESSO, ultimoEsito: 'pass' });
  return [r.dovuto === false, r.motivo === MOTIVI.MOTIVO_SCHEDA_RECENTE];
});

caso('27. ⑥ `skip` tace SEMPRE, anche vecchio di mesi: quella scheda la guarda una persona', () => {
  const r = promProva({ ...SENZA_NULLA, ultimaSchedaMs: ADESSO - 200 * GIORNO, ultimoEsito: 'skip' });
  return [r.dovuto === false, r.motivo === MOTIVI.MOTIVO_DA_PERSONA];
});

caso('28. ⑥ una data di scheda ILLEGGIBILE tace, e lo dice con un motivo suo', () => {
  // 🚨 Non è la stessa cosa di «nessuna scheda» (che vale 0 e fa partire il promemoria):
  //    qui una scheda c'è, e non si può dire se cada in questa casella. Il dubbio vale
  //    silenzio, come in tutte le altre porte.
  const r = promProva({ ...SENZA_NULLA, ultimaSchedaMs: Number.NaN });
  return [r.dovuto === false, r.motivo === MOTIVI.MOTIVO_DATA_ILLEGGIBILE];
});

caso('29. ⑥ un orologio illeggibile tace, e non inventa una casella', () => {
  const r = promemoriaDelLivello({ ...SENZA_NULLA, giorni: GIORNI_PROM, adessoMs: Number.NaN });
  return [r.dovuto === false, r.motivo === MOTIVI.MOTIVO_OROLOGIO, r.periodo === '', r.fino_a === ''];
});

caso('30. ⑥ la casella CONTIENE il suo istante, e due istanti vicini cadono nella stessa', () => {
  const c = casella(ADESSO);
  const stessa = casella(ADESSO + 60 * 60 * 1000);
  return [
    c.inizioMs <= ADESSO, ADESSO < c.fineMs,
    stessa.chiave === c.chiave,
    c.fineMs - c.inizioMs === GIORNI_PROM * GIORNO,
  ];
});

caso('31. ⭐ ⑥ passata la casella la chiave CAMBIA — è ciò che riapre il promemoria', () => {
  const c = casella(ADESSO);
  const dopo = casella(c.fineMs);
  return [
    dopo.chiave !== c.chiave,
    Date.parse(dopo.inizio) === c.fineMs,
    // ⚖️ Due caselle distano quindici giorni: due chiavi-data non possono coincidere, ed è
    //    ciò che permette di usarle come chiave del registro del bot.
    (Date.parse(dopo.inizio) - Date.parse(c.inizio)) === GIORNI_PROM * GIORNO,
  ];
});

caso('32. ⭐⭐ ⑥ la casella NON dipende dal socio: due soci nello stesso istante, stessa chiave', () => {
  // È la ragione per cui non serve nessuna colonna: il «quando» è un fatto del calendario,
  // non uno stato di qualcuno. Un promemoria «ogni 15 giorni dall'ultima volta» avrebbe
  // voluto una memoria per persona, e una memoria per persona prima o poi diverge.
  const a = promProva(SENZA_NULLA);
  const b = promProva({ ...SENZA_NULLA, ultimaSchedaMs: ADESSO - 100 * GIORNO });
  return [a.periodo === b.periodo, a.dovuto === true, b.dovuto === true];
});

caso('33. ⑥ l\'ordine delle porte: il livello vince sull\'attesa', () => {
  // Chi ha il livello ED è in attesa (rifà il test e aspetta) non riceve niente, e il motivo
  // che si legge dal vivo è quello VERO: «ce l'ha già», non «sta aspettando».
  const r = promProva({ ...SENZA_NULLA, haIlLivello: true, ammesso: false });
  return [r.dovuto === false, r.motivo === MOTIVI.MOTIVO_HA_LIVELLO];
});

// ── GUARDIE SULLA BASE ──────────────────────────────────────────────────────────
// 🚨 Un banco che misura ZERO resta verde: queste guardano il sorgente dell'edge, non la
//    regola, e fermano i modi in cui questa funzione può fare danno.
// ── 🆕 VOCE 84: il gettone che si riusa non deve avere già una scheda ──────────────────

caso('34. 🚨🚨 IL DIFETTO DI MARCO: un gettone che ha GIÀ una scheda non si riusa', () => {
  // Il gettone diceva `status: created` e una scheda ce l'aveva dal 3 maggio. Riusandolo, la
  // consegna (`upsert` sul gettone) le riscriveva sopra tenendo la data vecchia ⇒ il livello
  // non si applicava mai. Qui la domanda è quella giusta: la scheda esiste?
  return [gettoneDaRiusare(['ZK3MZY1NTIWMDQ'], ['ZK3MZY1NTIWMDQ']) === ''];
});

caso('35. un gettone senza scheda si riusa: chi tocca due volte ritrova LA SUA', () => {
  return [gettoneDaRiusare(['NUOVO'], []) === 'NUOVO'];
});

caso('36. ⭐ se il primo è usato si guarda il SECONDO, non si fabbrica subito', () => {
  // Fermarsi al primo vorrebbe dire perdere un gettone buono e aprirne un altro: il socio
  // si ritroverebbe due schede aperte, che è il difetto che il riuso esiste per evitare.
  return [gettoneDaRiusare(['USATO', 'LIBERO'], ['USATO']) === 'LIBERO'];
});

caso('37. usati TUTTI: non si riusa niente, e se ne fabbrica uno nuovo', () => {
  return [gettoneDaRiusare(['A', 'B'], ['B', 'A']) === ''];
});

caso('38. nessun candidato: stringa vuota, non un\'esplosione', () => {
  return [gettoneDaRiusare([], []) === '', gettoneDaRiusare(null, null) === '',
          gettoneDaRiusare(undefined, undefined) === ''];
});

caso('39. 🔒 spazi e vuoti non fanno passare un gettone usato', () => {
  // Il ponte pulisce con `clean` da tutt\'e due i lati, ma la regola non ci si appoggia:
  // un confronto fra `'T '` e `'T'` che sbaglia riaprirebbe esattamente il difetto di Marco.
  return [gettoneDaRiusare([' T '], ['T']) === '',
          gettoneDaRiusare(['', null, 'BUONO'], []) === 'BUONO'];
});

// ── 🆕 L'ATTESA TOLTA (25/08/2026) ──────────────────────────────────────────────
// Questi provano la DECISIONE, non la macchina: con la costante vera nessuno resta fuori.

caso('40. 🆕 con l\'attesa a zero un giro ESAURITO non blocca: il giro nuovo riparte INTERO', () => {
  const s = stato([prova(giorniFa(10), 'fail'), prova(giorniFa(9), 'fail'), prova(giorniFa(8), 'fail')]);
  return [s.ammesso === true, s.attesa === null, s.prova === 1, s.falliti === 0];
});

caso('41. 🆕 …e nemmeno un giro CONFERMATO: è il caso di Laura, chiuso il 24/08 con «mi fermo»', () => {
  const s = stato([fermato(giorniFa(1), giorniFa(1))]);
  return [s.ammesso === true, s.attesa === null, s.prova === 1];
});

caso('42. 🆕 subito dopo la chiusura, non il giorno dopo: zero vuol dire zero', () => {
  // ⚠️ Il caso limite che una prova a giorni interi non vedrebbe: un giro chiuso un minuto fa.
  // Se `adessoMs < chiusoIl + 0` fosse un `<=`, il socio resterebbe fuori nello stesso istante
  // in cui l'attesa è finita — e nessun caso «di ieri» se ne accorgerebbe.
  const unMinutoFa = new Date(ADESSO - 60 * 1000).toISOString();   // ⚠️ ADESSO è già un numero
  const s = stato([fermato(unMinutoFa, unMinutoFa)]);
  return [s.ammesso === true, s.attesa === null];
});

caso('43. 🔒 la macchina è INTERA: rimettendo un numero, l\'attesa torna a funzionare', () => {
  // La cura è un numero, non una riga cancellata: se domani lui rivuole l'attesa, questa è la
  // prova che non c'è niente da riscrivere.
  const schede = [fermato(giorniFa(10), giorniFa(9))];
  const senza = stato(schede);
  const con = statoConAttesa(schede);
  return [senza.ammesso === true, con.ammesso === false, con.attesa?.motivo === 'confermato'];
});

// ── 🆕🗣️ 27/08: CHI VA MANDATO DAL MAESTRO — e dev'essere lo STESSO elenco della lista ──
// 🗣️ Sua regola della sera: *«da avanzato in su gli viene detto di contattare la segreteria per
// farsi vedere dal maestro»*, e poi **«si allarga la lista»** (voce 100).
// 🚨⭐⭐ IL TERZO CONTROLLO È ARRIVATO DOPO, ed è quello che tiene insieme le due metà: la
// mattina questa funzione guardava solo il tetto, mentre la lista nel gestionale usa
// `dimostrato > inScheda`. ⇒ Chi ha 4 e dimostra 4 — il caso vero del 26/08 — si sarebbe visto
// mandare in segreteria dal bot senza comparire in Anagrafica soci: un socio che si presenta al
// circolo per una cosa che il circolo non gli ha chiesto.
// 📌 *Due regole che rispondono alla stessa domanda o sono una sola, o divergono — e chi paga la
// divergenza è chi ci cammina.*
const provaCon = (livello, esito = 'pass') => ({
  token: 'T-1', submitted_at: '2026-08-27T10:00:00.000Z',
  calculated_level: String(livello),
  raw_response: { knowledge: { status: esito } },
});

caso('M1. 🚨 in scheda 4 e dimostra 5 ⇒ va dal maestro (il caso della voce 100)', () =>
  [sopraIlTetto(provaCon(5), '4') === true]);

caso('M2. ⚖️ in scheda 4 e dimostra 4 ⇒ NON va: non è più di quello che ha', () =>
  [sopraIlTetto(provaCon(4), '4') === false]);

caso('M3. ⚖️ in scheda 5 e dimostra 4 ⇒ non va: ha dimostrato MENO', () =>
  [sopraIlTetto(provaCon(4), '5') === false]);

caso('M4. 🔒 senza livello in scheda ci va lo stesso: è chi ne ha più bisogno', () =>
  [sopraIlTetto(provaCon(5), '') === true, sopraIlTetto(provaCon(5), null) === true]);

caso('M5. sotto il tetto non ci va nessuno, per quanto sia salito', () =>
  [sopraIlTetto(provaCon(3.5), '0.5') === false, sopraIlTetto(provaCon(3), '0.5') === false]);

caso('M6. 🚨 il quiz FALLITO non manda nessuno in segreteria', () =>
  [sopraIlTetto(provaCon(5, 'fail'), '4') === false]);

caso('M7. 🚨 SABOTAGGIO: con la regola di stamattina (solo il tetto) il caso M2 tornerebbe verde', () => {
  /* Si rifà a mano la regola incompleta — «dimostra sopra il tetto» e basta — e si pretende un
     esito DIVERSO su M2. È l'unico posto dove ci si accorgerebbe se qualcuno la semplificasse. */
  const vero = sopraIlTetto(provaCon(4), '4');
  const soloIlTetto = 4 > 3.5;
  return [vero === false, soloIlTetto === true, vero !== soloIlTetto];
});

const guardie = [
  ['la regola esiste ed è quella estratta', typeof statoDelGiro === 'function'],
  // 🆕 25/08: l'attesa è ZERO, sua decisione. La guardia NON e' stata tolta — e' stata
  // cambiata: un numero che nessuno guarda piu' e' esattamente come si torna a 30 per sbaglio.
  ['i numeri sono i suoi: tre prove per giro, nessuna attesa', PROVE === 3 && GIORNI === 0],
  // 🔄 26/08 — era `=== 24`. Sua decisione: l'attesa va a ZERO, la variazione è immediata.
  // ⚖️ Resta un numero PRECISO e non «qualunque numero»: è ciò che rende visibile un cambio
  //    fatto per sbaglio, e che obbliga a dichiararlo qui chi lo cambia davvero.
  ['l\'attesa del silenzio-assenso è ZERO', ORE_SILENZIO === 0],
  // ⭐⭐ Il conto vive nel ponte ed è CALCOLATO dai fatti: un contatore tenuto in una colonna
  //    andrebbe azzerato, sincronizzato, e prima o poi divergerebbe dalle schede vere.
  ['il conto non è TENUTO in nessuna colonna', !/tentativi_usati|attempts_used|giri_fatti/.test(src)],
  // ⚖️ `skip` fuori dal conto: Semi-Pro e Professionista il quiz non ce l'hanno.
  ['solo `pass` e `fail` sono prove', /e === 'pass' \|\| e === 'fail'/.test(src)],
  // 🚨 La prima stesura del 18/08 chiudeva il giro al primo `pass`: avrebbe dato le tre prove
  //    SOLO a chi sbaglia il quiz, e a chi lo passa una prova ogni 30 giorni. Corretta lo
  //    stesso giorno — questa guardia esiste perché non torni per distrazione.
  ['il giro si chiude sulle PROVE FINITE, non su una passata', !/passata \|\| corrente\.length/.test(src)],
  // 🚨🚨 19/08 — L'ORDINE dei due modi di chiudere: l'esaurimento si guarda PRIMA della
  //    conferma. Scambiarli allunga l'attesa a chi risponde alla domanda della terza prova,
  //    ed è un difetto che nessun caso «felice» può vedere: il giro si chiude comunque.
  ['l\'esaurimento si guarda PRIMA della conferma', src.indexOf("corrente.length >= provePerGiro") < src.indexOf("sceltaDellaProva(s) === SCELTA_MI_FERMO")],
  // ── Le guardie sul PONTE, che è chi la regola la usa ──
  ['l\'attesa risponde 200 con `stato: attesa`, non un errore', /stato: 'attesa'/.test(srcPonte) && !/err\(4\d\d, '[A-Z_]*ATTESA/.test(srcPonte)],
  ['la risposta dice PERCHÉ si aspetta (`motivo_attesa`)', /motivo_attesa: giro\.attesa\.motivo/.test(srcPonte)],
  ['il ponte resta disarmato senza segreto', /CONSUMER_BRIDGE_SECRET/.test(srcPonte) && /BRIDGE_DISARMED/.test(srcPonte)],
  // 🚨 IL CABLAGGIO: la regola è una funzione pura, e una funzione che nessuno chiama resta
  //    verde senza difendere niente. Qui si misura che il ponte la USI — e che legga dal
  //    database le due colonne senza cui la conferma è invisibile.
  ['il ponte CHIAMA la regola del modulo', /from '\.\/giro-del-test\.ts'/.test(srcPonte) && /statoDelGiro\(elencoSchede/.test(srcPonte)],
  ['il ponte LEGGE la scelta dal database', /member_decision, member_decision_at/.test(srcPonte)],
  // 🆕 ④ — il bot non può fare la domanda se il gestionale non gli dice che c'è da farla:
  //    è «il gestionale SA, il bot DICE» applicato alla scelta.
  ['il ponte dice al bot se c\'è una scelta da fare', /puo_scegliere:/.test(srcPonte) && /scelta_entro:/.test(srcPonte)],
  /* 🚨⭐⭐ 27/08 tarda sera — E SOPRA IL TETTO LA SCELTA NON C'È, o il gestionale mente a sé stesso.
     📏 Misurato su una prova vera di Laura Aprea: in scheda Base (2,5), il test dice Agonista
     (5) ⇒ `aspetta_maestro` vero e il livello non si scriverà mai da sé (`applied_at` vuoto,
     ed è giusto). Ma `puo_scegliere` era VERO ⇒ il bot le ha chiesto «tieni o riprovi?», lei
     ha risposto «tengo Agonista» e si è sentita promettere una registrazione che non poteva
     avvenire — smentita da `/livello` due minuti dopo.
     ⚖️ Sopra il tetto «tengo» e «riprovo» portano allo stesso posto: una domanda le cui
     risposte sono equivalenti non è una scelta, è una promessa travestita.
     🚨 La guardia misura l'ORDINE, non la presenza: la riga deve stare DOPO il calcolo, o
     verrebbe sovrascritta dal calcolo stesso — è la stessa forma della correzione gemella su
     `livello_applicato`, che per la stessa ragione sta lì e non dentro. */
  ['sopra il tetto il ponte NEGA la scelta', /if \(ultimaScheda\.aspetta_maestro\) ultimaScheda\.puo_scegliere = false;/.test(srcPonte)],
  ['e lo fa DOPO il calcolo, non dentro',
    srcPonte.indexOf('if (ultimaScheda.aspetta_maestro) ultimaScheda.puo_scegliere = false;')
      > srcPonte.indexOf('puo_scegliere: (() => {')],
  // ── Le TRE COPIE del modulo, che il deploy costringe a esistere ──
  // 🚨 È la stessa difesa di `scrittura-al-circolo.test.ts`: i deploy saltano `_shared/`,
  //    quindi la regola vive in copie, e la deriva fra copie è il modo in cui questi fix si
  //    riaprono — una funzione applicherebbe una regola e l'altra ne racconterebbe un'altra.
  ['le tre copie del modulo sono identiche BYTE PER BYTE', COPIE.length === 3 && COPIE.every((f) => readFileSync(f, 'utf8') === src)],
  // ── 🆕 ⑥ IL PROMEMORIA GENTILE ──
  // 🚨⭐⭐ QUESTE GUARDIE MISURANO LA CONDIZIONE, NON LA PAROLA. La lezione del 19/08 (④) è
  //    costata un sabotaggio passato VERDE: nel bot la guardia del cablaggio cercava le
  //    stringhe del ramo e le trovava anche col ramo SPENTO (`if (false)`). Qui non basta
  //    che `promemoriaDelLivello` compaia: si misura che gli arrivino i valori VERI —
  //    chi sostituisse un argomento con una costante avrebbe una regola inerte e verde.
  ['il ponte CHIAMA la regola del promemoria', /const promemoria = promemoriaDelLivello\(\{/.test(srcPonte)],
  ['e le passa il livello VERO, non una costante', /haIlLivello: livelloDimostrato\(payload\.level, payload\.levelSource\)/.test(srcPonte)],
  ['e l\'ammissione VERA del giro, non una costante', /ammesso: giro\.ammesso/.test(srcPonte)],
  ['e la data VERA dell\'ultima scheda', /ultimaSchedaMs: ultimaScheda \? Date\.parse/.test(srcPonte)],
  // ⚖️ Il promemoria esce da TUTTE E DUE le strade della risposta — quella dell'attesa e
  //    quella del link — o il bot leggerebbe la risposta in due modi a seconda della strada.
  ['il promemoria esce dalle DUE strade della risposta', (srcPonte.match(/^\s+promemoria,$/gm) || []).length === 2],
  // 🚨 UN SOLO orologio: con due `Date.now()` la casella e l'attesa possono cadere ai due
  //    lati di un confine. Raro, quindi il tipo di difetto che nessuno riesce a riprodurre.
  ['il ponte guarda l\'orologio UNA volta sola', (codicePonte.match(/Date\.now\(\)/g) || []).length === 1],
  // ⭐ La cadenza è sua: «magari non tutte le settimane, ma un paio di volte al mese».
  ['la cadenza è di quindici giorni, cioè due volte al mese', GIORNI_PROM === 15],
  // ⭐⭐ Il «quando» è un fatto del CALENDARIO, non uno stato di qualcuno: il modulo non
  //    legge e non scrive niente. È lo stesso principio del conto delle prove — non è
  //    tenuto, è calcolato — e ha lo stesso vantaggio: niente da azzerare, niente che diverga.
  ['il periodo non è TENUTO da nessuna parte', !/\bfrom\(|\.insert\(|\.update\(|\.upsert\(/.test(srcProm)],
  // 🚨 La regola di «avere il livello» è quella del readmodel, byte per byte: due letture
  //    diverse vorrebbero dire ricordare il test a chi ce l'ha, o tacere con chi non ce l'ha.
  ['le due copie di livello-dimostrato sono identiche BYTE PER BYTE',
    COPIE_LIVELLO.length === 2 && new Set(COPIE_LIVELLO.map((f) => readFileSync(f, 'utf8'))).size === 1],
  ['il ponte non si riscrive in casa la regola del livello', !/'0\.5'/.test(srcPonte)],
  // 🆕 VOCE 84 — le due metà della cura, e nessuna delle due basta da sola: la regola giusta
  //    (provata dai casi 20-25) serve a poco se il ponte non le passa il fatto vero.
  ['il ponte CHIEDE al database quali gettoni hanno una scheda',
    /\.from\('self_assessments'\)[\s\S]{0,120}\.in\('token', candidati\)/.test(srcPonte)],
  ['e il riuso passa dalla regola, non più dal primo della lista',
    /daRiusare = gettoneDaRiusare\(/.test(codicePonte) && !/esistenti\[0\]/.test(codicePonte)],
  // 🚨 Se la lettura delle schede fallisce NON si riusa a caso: meglio una frase in meno che
  //    una scheda sovrascritta. Chi togliesse questo `return` renderebbe il guasto silenzioso.
  ['una lettura fallita delle schede FERMA il riuso, non lo indovina',
    /erroreSchede\)\s*\{[\s\S]{0,160}return err\(500/.test(srcPonte)],
];

test('BANCO — finito il giro, 30 giorni', () => {
  console.log('\nBANCO — consumer-assessment-link\n');
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
