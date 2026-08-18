// ── BANCO: «finito il giro, 30 giorni» — la regola dei tentativi del test di livello ───
//
// Che cosa prova: `statoDelGiro` dell'edge `consumer-assessment-link`, cioè il pezzo che
// decide se un socio può fare il test ADESSO, che prova sarebbe, e fino a quando aspetta.
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
const SORGENTE = join(QUI, '..', 'supabase', 'functions', 'consumer-assessment-link', 'index.ts');
const src = readFileSync(SORGENTE, 'utf8');

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

const ctx = {};
vm.createContext(ctx);
vm.runInContext(spoglia(['esitoDellaProva', 'quandoMs', 'statoDelGiro'].map(estrai).join('\n')), ctx);
const { statoDelGiro, esitoDellaProva } = ctx;

// ⭐ I numeri della regola si LEGGONO dal sorgente: ricopiarli qui vorrebbe dire che il banco
// resta verde anche se domani il ponte ne usa altri — proverebbe la propria copia.
function costante(nome) {
  const m = src.match(new RegExp(`const ${nome} = ([0-9.]+)`));
  if (!m) throw new Error(`costante «${nome}» non trovata nell'edge`);
  return Number(m[1]);
}
const PROVE = costante('TENTATIVI_PER_GIRO');
const GIORNI = costante('GIORNI_DI_ATTESA');

// ── Il materiale ────────────────────────────────────────────────────────────────
const GIORNO = 24 * 60 * 60 * 1000;
const ADESSO = Date.parse('2026-08-18T12:00:00.000Z');
const giorniFa = (n) => new Date(ADESSO - n * GIORNO).toISOString();
const prova = (quando, esito) => ({ submitted_at: quando, raw_response: { knowledge: { status: esito } } });
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

caso('5. 🚨🚨 LA REGOLA NUOVA: chi PASSA chiude il giro e aspetta — prima rifaceva subito', () => {
  const s = stato([prova(giorniFa(3), 'pass')]);
  return [
    s.ammesso === false,
    s.attesa?.motivo === 'passato',
    s.falliti === 0,               // ha passato: non ha sbagliato niente
    s.attesa?.giorni === GIORNI - 3,
  ];
});

caso('6. bocciato e poi passato: il giro si chiude sulla PASSATA, non sulla bocciatura', () => {
  const s = stato([prova(giorniFa(5), 'fail'), prova(giorniFa(4), 'pass')]);
  return [
    s.ammesso === false,
    s.attesa?.motivo === 'passato',
    s.falliti === 1,
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
  // chiusura 29 giorni e mezzo fa: manca mezza giornata, e «0 giorni» sarebbe una bugia
  const mezzaGiornataAllaFine = new Date(ADESSO - (GIORNI - 0.5) * GIORNO).toISOString();
  const s = stato([prova(mezzaGiornataAllaFine, 'pass')]);
  return [s.ammesso === false, s.attesa.giorni === 1];
});

caso('13. 🔒 una data di chiusura illeggibile NON chiude la porta in faccia a nessuno', () => {
  const rotta = { submitted_at: 'non-una-data', raw_response: { knowledge: { status: 'pass' } } };
  const s = stato([rotta]);
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

// ── GUARDIE SULLA BASE ──────────────────────────────────────────────────────────
// 🚨 Un banco che misura ZERO resta verde: queste guardano il sorgente dell'edge, non la
//    regola, e fermano i modi in cui questa funzione può fare danno.
const guardie = [
  ['la regola esiste ed è quella estratta', typeof statoDelGiro === 'function'],
  ['i numeri sono i suoi: tre prove per giro, trenta giorni', PROVE === 3 && GIORNI === 30],
  // ⭐⭐ Il conto vive nel ponte ed è CALCOLATO dai fatti: un contatore tenuto in una colonna
  //    andrebbe azzerato, sincronizzato, e prima o poi divergerebbe dalle schede vere.
  ['il conto non è TENUTO in nessuna colonna', !/tentativi_usati|attempts_used|giri_fatti/.test(src)],
  // ⚖️ `skip` fuori dal conto: Semi-Pro e Professionista il quiz non ce l'hanno.
  ['solo `pass` e `fail` sono prove', /e === 'pass' \|\| e === 'fail'/.test(src)],
  // 🚨 L'attesa NON è un errore HTTP: un 4xx farebbe scattare nel bot il ripiego dei guasti,
  //    cioè un «riprova più tardi» generico, proprio dove serve la data precisa.
  ['l\'attesa risponde 200 con `stato: attesa`, non un errore', /stato: 'attesa'/.test(src) && !/err\(4\d\d, '[A-Z_]*ATTESA/.test(src)],
  // 🆕 Il campo che dice PERCHÉ si aspetta: senza, il bot non può distinguere «hai finito le
  //    prove» da «hai passato», e direbbe la frase delle bocciature a chi ha passato.
  ['la risposta dice PERCHÉ si aspetta (`motivo_attesa`)', /motivo_attesa: giro\.attesa\.motivo/.test(src)],
  ['il ponte resta disarmato senza segreto', /CONSUMER_BRIDGE_SECRET/.test(src) && /BRIDGE_DISARMED/.test(src)],
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
