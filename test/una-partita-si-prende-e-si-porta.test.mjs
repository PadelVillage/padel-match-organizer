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

/* ── ④ le guardie della disposizione: i pezzi che il gesto usa devono esserci davvero ───── */

test('i segmenti LIBERI si dichiarano tali (o non ci sarebbe dove lasciare)', () => {
  assert.match(APP, /seg\.dataset\.libero = '1'/);
});

test('solo ciò che NON è di Matchpoint si trascina', () => {
  assert.match(APP, /if \(!mp\) pmoTrascinaAttacca\(blk/);
});

test('il fantasma non intercetta il puntatore (o `elementFromPoint` troverebbe sempre lui)', () => {
  assert.match(corpoDi('pmoTrascinaPrendi'), /f\.style\.pointerEvents = 'none'/);
});

test('🔇 lo spostamento non annuncia più né l\'«in corso» né il «fatto» (voce 189)', () => {
  const c = corpoDi('staffCalDoMove');
  assert.ok(!/Spostamento in corso/.test(c), 'è tornato il banner «in corso»');
  assert.ok(!/Prenotazione spostata/.test(c), 'è tornato il banner «fatto»');
  assert.match(c, /Spostamento non riuscito/);   // …ma il RIFIUTO deve continuare a parlare
});

console.log('\n' + passed + ' ok · ' + failed + ' KO');
process.exit(failed ? 1 : 0);
