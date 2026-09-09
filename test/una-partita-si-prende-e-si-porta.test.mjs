/* 🖐️ «Una partita si prende e si porta» — banco della voce 192 (trascinamento, mouse e dito).
 *
 * ⚖️ COSA PROVA, e sono le tre regole su cui il gesto può sbagliare in silenzio:
 *   ① `pmoTrascinaDecidi` — la riga che separa il MOUSE dal DITO. Sul telefono trascinare e
 *      scorrere partono uguali: si distinguono nel TEMPO, non nella direzione.
 *   ② `pmoTrascinaMinutiNelPezzo` — dove si lascia il dito, ancorato alla griglia da mezz'ora
 *      VERA e non all'inizio del pezzo (un «Libero» comincia dove finisce la partita di prima,
 *      che può essere le 10:20).
 *   ③ `pmoTrascinaEUnoSpostamento` — prendere e ripensarci non deve chiedere niente a nessuno,
 *      e soprattutto non deve far partire un avviso ai soci.
 *
 * ⛔ QUELLO CHE QUESTO BANCO **NON** DICE: che una partita si veda muovere. Gira senza browser e
 *    senza dita ⇒ prova le tre regole, non il gesto. Che poi si prenda e si lasci lo dice la
 *    console remota sulla pagina viva.
 *
 * Esegui:  node test/una-partita-si-prende-e-si-porta.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(QUI, '..', 'index.html'), 'utf8');

let passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log('ok   - ' + nome); }
  catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + e.message); }
}

/** Le sole righe di CODICE. 🩹 Senza questo, la guardia che vieta una parola dà l'allarme sul
 *  COMMENTO che spiega perché quella parola è vietata — ed è successo alla prima corsa di questo
 *  banco, su una frase mia scritta per raccontare la cura. È lo stesso rimedio già scritto in
 *  `la-cella-si-accende-dove-si-disegna`, e si taglia per STRUTTURA (i `/* … *\/` spariscono
 *  interi) e non per riga: buttare via le righe che COMINCIANO per `//` lascia dentro le righe di
 *  mezzo di un commento lungo. */
function soloCodice(testo) {
  return String(testo)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').filter(function (r) { return !/^\s*\/\//.test(r); })
    .join('\n');
}

/** Il corpo di `function nome(`, contando le graffe dalla PRIMA del corpo. */
function corpoDi(nome, testo = APP) {
  const i = testo.indexOf('function ' + nome + '(');
  assert.ok(i > 0, 'funzione non trovata: ' + nome);
  const apre = testo.indexOf('{', i);
  let liv = 0;
  for (let k = apre; k < testo.length; k++) {
    if (testo[k] === '{') liv++;
    else if (testo[k] === '}') { liv--; if (liv === 0) return testo.slice(apre, k + 1); }
  }
  throw new Error('graffe non bilanciate in ' + nome);
}
/** La funzione VERA dell'app, firma compresa: così il banco non prova una sua copia. */
function funzione(nome, args) {
  return new Function('return function ' + nome + '(' + args + ') ' + corpoDi(nome) + ';')();
}

const decidi   = funzione('pmoTrascinaDecidi', 'tocco, dx, dy, msTenuto');
const minuti   = funzione('pmoTrascinaMinutiNelPezzo', 'minDa, minA, offsetX, colW');
const sposta   = funzione('pmoTrascinaEUnoSpostamento', 'da, a');
const oraDa    = funzione('pmoTrascinaOraDaMinuti', 'm');

/* ── ① mouse e dito ─────────────────────────────────────────────────────────────────────── */

test('col MOUSE cinque pixel sono già una presa', () => {
  assert.equal(decidi(false, 5, 0, 0), 'prendi');
  assert.equal(decidi(false, 0, -6, 0), 'prendi');
});

test('col MOUSE un tremolio non prende niente (un click resta un click)', () => {
  assert.equal(decidi(false, 2, 2, 0), 'niente');
  assert.equal(decidi(false, 0, 0, 5000), 'niente');   // col mouse il TEMPO non conta
});

test('col DITO muoversi subito vuol dire SCORRERE la corsia, non prendere', () => {
  assert.equal(decidi(true, 30, 0, 40), 'scorri');
  assert.equal(decidi(true, -25, 3, 120), 'scorri');
});

test('col DITO tenere premuto 350 ms È la presa, anche senza muoversi di un pixel', () => {
  assert.equal(decidi(true, 0, 0, 350), 'prendi');
  assert.equal(decidi(true, 0, 0, 349), 'niente');
});

test('col DITO, sopra i 350 ms si prende anche se ci si era mossi poco', () => {
  assert.equal(decidi(true, 6, 0, 400), 'prendi');
});

/* ── ② dove si lascia ───────────────────────────────────────────────────────────────────── */

const COLW = 44;   // px per 30 minuti, computer

test('a sinistra del «Libero» si prende il suo primo mezz\'ora', () => {
  assert.equal(minuti(600, 780, 0, COLW), 600);        // 10:00–13:00, dito sul bordo
  assert.equal(minuti(600, 780, 43, COLW), 600);       // ancora dentro la prima colonna
});

test('una colonna più a destra è mezz\'ora più tardi', () => {
  assert.equal(minuti(600, 780, 44, COLW), 630);
  assert.equal(minuti(600, 780, 132, COLW), 690);      // tre colonne
});

test('🚨 un «Libero» che comincia alle 10:20 NON produce le 10:20: si àncora alla griglia vera', () => {
  // Una lezione da 60′ iniziata alle 09:20 lascia un buco che comincia alle 10:20 (620).
  // Contando dal pezzo verrebbe 620 — un'ora che `staffCalSlots()` non conosce, e su cui il
  // controllo di occupazione risponderebbe «libero» perché non la trova.
  assert.equal(minuti(620, 780, 0, COLW), 630);        // il primo inizio VALIDO è le 10:30
  assert.equal(minuti(620, 780, 5, COLW), 630);
});

test('oltre il bordo destro non si esce dal pezzo', () => {
  assert.equal(minuti(600, 780, 99999, COLW), 750);    // l'ultimo inizio è 12:30
});

test('un pezzo troppo stretto per ospitare un inizio non ne restituisce uno finto', () => {
  assert.equal(minuti(600, 615, 0, COLW), null);       // 15 minuti
  assert.equal(minuti(620, 640, 0, COLW), null);       // fra due mezz\'ore
});

test('coordinate storte non producono un orario: producono `null`', () => {
  assert.equal(minuti('boh', 780, 0, COLW), null);
  assert.equal(minuti(600, 780, 0, 0), null);
  assert.equal(minuti(780, 600, 0, COLW), null);
});

test('i minuti diventano un orario che l\'app sa leggere', () => {
  assert.equal(oraDa(600), '10:00');
  assert.equal(oraDa(630), '10:30');
  assert.equal(oraDa(1380), '23:00');
  assert.equal(oraDa(480), '08:00');
});

/* ── ③ prendere e ripensarci ────────────────────────────────────────────────────────────── */

const DA = { iso: '2026-09-11', campo: 1, ora: '14:30' };

test('lasciarla dov\'era NON è uno spostamento (nessun avviso deve partire)', () => {
  assert.equal(sposta(DA, { iso: '2026-09-11', campo: 1, ora: '14:30' }), false);
});

test('un campo diverso è uno spostamento', () => {
  assert.equal(sposta(DA, { iso: '2026-09-11', campo: 3, ora: '14:30' }), true);
});

test('un orario diverso è uno spostamento', () => {
  assert.equal(sposta(DA, { iso: '2026-09-11', campo: 1, ora: '15:00' }), true);
});

test('un bersaglio incompleto non è uno spostamento', () => {
  assert.equal(sposta(DA, { iso: '2026-09-11', campo: 0, ora: '15:00' }), false);
  assert.equal(sposta(DA, { iso: '', campo: 2, ora: '15:00' }), false);
  assert.equal(sposta(DA, null), false);
});

test('il campo si confronta come NUMERO e l\'ora come TESTO', () => {
  // La corsia scrive `data-campo` come stringa: se il confronto fosse `===` fra tipi diversi,
  // lasciarla dov'era passerebbe per uno spostamento e farebbe partire quattro avvisi.
  assert.equal(sposta(DA, { iso: '2026-09-11', campo: '1', ora: '14:30' }), false);
});

/* ── ④ il rettangolo del bersaglio: si accende IL POSTO, non il contenitore ─────────────── */

const rett = funzione('pmoTrascinaRettangoloDelBersaglio', 'pezzoLeft, minDa, minutiScelti, durataMin, colW');

test('🎯 il rettangolo è largo quanto la partita DURA, non quanto il pezzo che la ospita', () => {
  // Un «Libero» 08:00–18:00 (480→1080) è largo 880 px: una partita da 90′ ne occupa 132.
  assert.deepEqual(rett(100, 480, 480, 90, COLW), { left: 100, width: 132 });
});

test('🎯 …e sta alla mezz\'ora scelta, non all\'inizio del pezzo', () => {
  // 10:00 dentro un «Libero» che comincia alle 08:00 = quattro colonne più a destra.
  assert.deepEqual(rett(100, 480, 600, 90, COLW), { left: 100 + 4 * 44, width: 132 });
});

test('🎯 una durata diversa cambia la larghezza, non la posizione', () => {
  assert.deepEqual(rett(0, 600, 600, 60, COLW), { left: 0, width: 88 });
  assert.deepEqual(rett(0, 600, 600, 120, COLW), { left: 0, width: 176 });
});

test('una durata mancante o assurda non produce un rettangolo di zero', () => {
  assert.equal(rett(0, 600, 600, 0, COLW).width, 132);      // ripiega su 90′
  assert.equal(rett(0, 600, 600, 10, COLW).width, 44);      // mai sotto la mezz'ora
});

test('coordinate storte non producono un rettangolo: producono `null`', () => {
  assert.equal(rett(0, 'boh', 600, 90, COLW), null);
  assert.equal(rett(0, 600, 600, 90, 0), null);
});

test('🩹 il dito non seleziona il testo del riquadro (la selezione si allargava agli altri)', () => {
  const c = soloCodice(corpoDi('pmoTrascinaAttacca'));
  assert.match(c, /userSelect = 'none'/);
  assert.match(c, /webkitTouchCallout = 'none'/);
});

test('🩹 e una selezione già cominciata si spegne quando la presa scatta', () => {
  assert.match(soloCodice(corpoDi('pmoTrascinaPrendi')), /removeAllRanges/);
});

test('⛔ non si accende più il PEZZO intero della corsia', () => {
  const c = soloCodice(corpoDi('pmoTrascinaMira'));
  assert.ok(!/pezzo\.style\.outline/.test(c), 'è tornata l\'evidenza sul pezzo intero');
  assert.match(c, /pmoTrascinaRettangoloDelBersaglio/);
});

/* ── ④ le guardie della disposizione: i pezzi che il gesto usa devono esserci davvero ───── */

test('i segmenti LIBERI si dichiarano tali (o non ci sarebbe dove lasciare)', () => {
  assert.match(soloCodice(APP), /seg\.dataset\.libero = '1'/);
});

test('solo ciò che NON è di Matchpoint si trascina', () => {
  assert.match(soloCodice(APP), /if \(!mp\) pmoTrascinaAttacca\(blk/);
});

test('il fantasma non intercetta il puntatore (o `elementFromPoint` troverebbe sempre lui)', () => {
  assert.match(soloCodice(corpoDi('pmoTrascinaPrendi')), /f\.style\.pointerEvents = 'none'/);
});

test('🔇 lo spostamento non annuncia più né l\'«in corso» né il «fatto» (voce 189)', () => {
  const c = soloCodice(corpoDi('staffCalDoMove'));
  assert.ok(!/Spostamento in corso/.test(c), 'è tornato il banner «in corso»');
  assert.ok(!/Prenotazione spostata/.test(c), 'è tornato il banner «fatto»');
  assert.match(c, /Spostamento non riuscito/);   // …ma il RIFIUTO deve continuare a parlare
});

test('🏷️ la conferma non nomina più Matchpoint (voce 190: è il trascinamento a renderla visibile)', () => {
  const c = soloCodice(corpoDi('staffCalDoMove'));
  assert.ok(!/Spostare su Matchpoint/.test(c), 'la conferma nomina ancora Matchpoint');
  assert.match(c, /Spostare la prenotazione\?/);
});

console.log('\n' + passed + ' ok · ' + failed + ' KO');
process.exit(failed ? 1 : 0);
