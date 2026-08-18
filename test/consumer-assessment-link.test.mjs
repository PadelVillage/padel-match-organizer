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

// Stesso estrattore degli altri banchi: salta i commenti (in italiano sono pieni di
// apostrofi) e parte dopo la lista dei parametri.
function estrai(nome) {
  const inizio = src.indexOf(`function ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata nell'edge`);
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

// ⚠️ Si tolgono SOLO le annotazioni `any` — sui parametri e sulle variabili locali. Sono
// l'unica concessione al `deno check` in modalità `strict`, e l'unica differenza fra il
// testo del sorgente e quello che si prova. Chi nell'edge usasse un tipo diverso non
// romperebbe niente in silenzio: questa `vm` non riuscirebbe più a valutare la funzione.
const spoglia = (codice) => codice
  .replace(/([(,]\s*\w+)\s*:\s*any\b/g, '$1')
  .replace(/\b(let|const)\s+(\w+)\s*:\s*any(\[\])?(?=\s*[=;])/g, '$1 $2');

// ⭐ I numeri della regola si LEGGONO dal sorgente: ricopiarli qui vorrebbe dire che il banco
// resta verde anche se domani il ponte ne usa altri — proverebbe la propria copia.
function costante(nome) {
  const m = src.match(new RegExp(`const ${nome} = ([0-9.]+)`));
  if (!m) throw new Error(`costante «${nome}» non trovata nel modulo`);
  return Number(m[1]);
}
function parola(nome) {
  const m = src.match(new RegExp(`const ${nome} = '([^']+)'`));
  if (!m) throw new Error(`costante «${nome}» non trovata nel modulo`);
  return m[1];
}
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
};
vm.createContext(ctx);
vm.runInContext(
  spoglia(['esitoDellaProva', 'quandoMs', 'sceltaDellaProva', 'stessaProva', 'giriDelSocio', 'statoDelGiro', 'laProvaEsaurisceIlGiro'].map(estrai).join('\n')),
  ctx,
);
const { statoDelGiro, esitoDellaProva, giriDelSocio, laProvaEsaurisceIlGiro } = ctx;


// ── Il materiale ────────────────────────────────────────────────────────────────
const GIORNO = 24 * 60 * 60 * 1000;
const ADESSO = Date.parse('2026-08-18T12:00:00.000Z');
const giorniFa = (n) => new Date(ADESSO - n * GIORNO).toISOString();
const prova = (quando, esito, extra = {}) => ({ token: `T-${quando}`, submitted_at: quando, raw_response: { knowledge: { status: esito } }, ...extra });
// Una prova su cui il socio ha detto «mi fermo», con l'istante in cui l'ha detto.
const fermato = (quandoProva, quandoScelta) =>
  prova(quandoProva, 'pass', { member_decision: MI_FERMO, member_decision_at: quandoScelta });
const stato = (schede, adesso = ADESSO) => statoDelGiro(schede, adesso, PROVE, GIORNI);

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
  const s = stato([prova(giorniFa(10), 'fail'), prova(giorniFa(9), 'fail'), prova(giorniFa(8), 'fail')]);
  return [
    s.ammesso === false,
    s.attesa?.motivo === 'esaurito',
    s.falliti === 3,
    s.attesa?.giorni === GIORNI - 8,
    s.attesa?.dal === new Date(Date.parse(giorniFa(8)) + GIORNI * GIORNO).toISOString(),
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
  const s = stato([prova(giorniFa(6), 'fail'), prova(giorniFa(5), 'pass'), prova(giorniFa(4), 'fail')]);
  return [
    s.ammesso === false,
    s.attesa?.motivo === 'esaurito',
    s.falliti === 2,
    s.attesa?.dal === new Date(Date.parse(giorniFa(4)) + GIORNI * GIORNO).toISOString(),
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
  const a = stato(desc), b = stato(asc);
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

caso('15. 🚨🚨 LA REGOLA NUOVA (④): «mi fermo» CHIUDE il giro, e i 30 giorni partono dalla SCELTA', () => {
  // Prima prova passata, e il socio si ferma lì: il giro è finito con due prove non usate —
  // è esattamente ciò che la sua regola concede, «decidi tu a quale delle tre volte fermarti».
  // ⚖️ L'attesa parte da quando ha SCELTO, non da quando ha fatto la prova: fra le due cose
  // possono passare ore, e far partire l'attesa dalla prova regalerebbe tempo a chi tarda.
  const s = stato([fermato(giorniFa(10), giorniFa(9))]);
  return [
    s.ammesso === false,
    s.attesa?.motivo === 'confermato',
    s.attesa?.dal === new Date(Date.parse(giorniFa(9)) + GIORNI * GIORNO).toISOString(),
    s.falliti === 0,
  ];
});

caso('16. 🚨 alla TERZA prova l\'esaurimento VINCE sulla conferma: l\'attesa non si allunga', () => {
  // Se contasse la conferma, chi risponde «mi fermo» dopo la terza aspetterebbe PIÙ di chi
  // non risponde affatto — cioè la cortesia costerebbe giorni. Il giro era finito comunque.
  const terza = fermato(giorniFa(10), giorniFa(3));
  const s = stato([prova(giorniFa(12), 'fail'), prova(giorniFa(11), 'fail'), terza]);
  return [
    s.ammesso === false,
    s.attesa?.motivo === 'esaurito',
    s.attesa?.dal === new Date(Date.parse(giorniFa(10)) + GIORNI * GIORNO).toISOString(),
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

// ── GUARDIE SULLA BASE ──────────────────────────────────────────────────────────
// 🚨 Un banco che misura ZERO resta verde: queste guardano il sorgente dell'edge, non la
//    regola, e fermano i modi in cui questa funzione può fare danno.
const guardie = [
  ['la regola esiste ed è quella estratta', typeof statoDelGiro === 'function'],
  ['i numeri sono i suoi: tre prove per giro, trenta giorni', PROVE === 3 && GIORNI === 30],
  ['il silenzio-assenso è ventiquattr\'ore', ORE_SILENZIO === 24],
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
  // ── Le TRE COPIE del modulo, che il deploy costringe a esistere ──
  // 🚨 È la stessa difesa di `scrittura-al-circolo.test.ts`: i deploy saltano `_shared/`,
  //    quindi la regola vive in copie, e la deriva fra copie è il modo in cui questi fix si
  //    riaprono — una funzione applicherebbe una regola e l'altra ne racconterebbe un'altra.
  ['le tre copie del modulo sono identiche BYTE PER BYTE', COPIE.length === 3 && COPIE.every((f) => readFileSync(f, 'utf8') === src)],
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
