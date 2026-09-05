/* 📌 «Le corsie del calendario stanno nella scatola» — banco della VOCE 159 (05/09/2026).
 *
 * 🗣️ Sua: «non si vede il campo 4», su PROD e su TEST.
 *
 * 📏 MISURATO con la console remota a 1440×900, identico nei due ambienti: dalla 153/C la colonna
 *    del calendario è alta `100vh − 393` (507px), ma `_staffCalBuildHorizontal` dimensionava le
 *    corsie fino al fondo della FINESTRA (4 × 165 + 24 = 687px) ⇒ C4 stava tutta sotto il bordo
 *    (top 710, bordo 697), C3 tagliata a metà, 140px di vuoto sotto. Due numeri che non si
 *    parlavano: la scatola è stata stretta senza dirlo a chi la riempie.
 *
 * 🎯 LE COSE CHE QUESTO BANCO DIFENDE:
 *   ① sul computer l'altezza disponibile si legge dalla COLONNA CHE SCORRE (`.svc-grid-col`),
 *      non dalla finestra — e solo sul computer: sul telefono la scatola è la pagina intera;
 *   ② la premessa: `.svc-grid-col` è davvero lo scroller sul desktop (`overflow:auto`). Se un
 *      domani qualcuno gli toglie l'overflow, la misura resta giusta e la corsia sparisce lo
 *      stesso — senza che niente si rompa a voce alta;
 *   ③ 🚨 I DUE PAVIMENTI DICONO LO STESSO NUMERO: le corsie non scendono sotto un minimo
 *      (96px l'una), quindi la cornice CSS non può scendere sotto 4 × 96 + testata + bordo. Con
 *      360 di qua e 411 di là, sotto i 800px di finestra a scorrere era la colonna e non la
 *      pagina — cioè C4 tagliata un'altra volta, un piano più in basso;
 *   ④ la regola dell'altezza usa la variabile del pavimento, non un numero a mano.
 *
 * ⛔ QUELLO CHE NON DICE: gira senza browser. Dice che i numeri combaciano e che la misura è
 *    presa dal posto giusto — NON che a 1440×900 C4 si veda. Quello lo dice la pagina viva.
 *
 * Esegui:  node test/le-corsie-del-calendario-stanno-nella-scatola.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(process.env.PMO_APP_PATH || join(QUI, '..', 'index.html'), 'utf8');
assert.ok(APP.length > 500000, 'sorgente non letto: questo banco non direbbe niente');

let passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log('ok   - ' + nome); }
  catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + e.message); }
}

// Il corpo della funzione che disegna il calendario vivo.
const iniz = APP.indexOf('function _staffCalBuildHorizontal(');
assert.ok(iniz > 0, '_staffCalBuildHorizontal non trovata');
const fine = APP.indexOf('\n  }\n', iniz);
const FN = APP.slice(iniz, fine);

test('① sul computer l\'altezza disponibile si legge dalla colonna che scorre', () => {
  assert.match(FN, /if \(isDesktop\) \{[\s\S]{0,400}body\.closest\('\.svc-grid-col'\)/, 'la lettura della colonna manca, o non sta sotto isDesktop');
  assert.match(FN, /getBoundingClientRect\(\)\.bottom[\s\S]{0,200}avail = _colBottom - rectTop/, 'avail non viene dal fondo della colonna');
});

test('① …e sul telefono la formula resta quella della finestra', () => {
  assert.match(FN, /let avail = window\.innerHeight - rectTop - \(isDesktop \? 24 : 74\);/);
});

const laneMin = (() => { const m = FN.match(/const laneH = Math\.max\(isDesktop \? (\d+) : (\d+), Math\.floor\(\(avail - HEADERH\) \/ 4\)\);/); assert.ok(m, 'riga di laneH non trovata'); return Number(m[1]); })();
const headerH = (() => { const m = FN.match(/const HEADERH = (\d+);/); assert.ok(m, 'HEADERH non trovata'); return Number(m[1]); })();

// Il blocco CSS del calendario: si parte dall'ANCORA (la cornice) e si risale alla `@media` che
// la contiene contando le graffe, coi commenti spenti — non «la @media più vicina indietro», che
// nel file ce ne sono diverse con la stessa condizione e la prima stesura di questa sonda ne
// trovava una sbagliata (la lezione della 155, pagata di nuovo qui prima di scriverla).
const ancora = APP.indexOf('--pmo-cal-cornice: 393px');
assert.ok(ancora > 0, 'ancora della cornice non trovata');
const SPENTO = APP.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
// Si sale di blocco in blocco (la regola `#staffCalV36 { … }` che porta l'ancora, poi ciò che la
// contiene) finché il blocco aperto è una `@media`: quella è la scatola che decide su che schermo
// la cornice vale.
function bloccoCheContiene(pos) {
  for (let i = pos, depth = 0; i >= 0; i--) {
    const ch = SPENTO[i];
    if (ch === '}') depth++;
    else if (ch === '{') { if (depth === 0) return i; depth--; }
  }
  return -1;
}
let apertura = bloccoCheContiene(ancora), condizione = '';
for (let giri = 0; apertura > 0 && giri < 5; giri++) {
  condizione = SPENTO.slice(Math.max(0, apertura - 60), apertura).trim().split('\n').pop().trim();
  if (condizione.startsWith('@media')) break;
  apertura = bloccoCheContiene(apertura - 1);
}
assert.ok(apertura > 0 && condizione.startsWith('@media'), 'nessuna @media contiene l\'ancora');
let chiusura = -1;
for (let i = apertura + 1, depth = 0; i < SPENTO.length; i++) {
  const ch = SPENTO[i];
  if (ch === '{') depth++;
  else if (ch === '}') { if (depth === 0) { chiusura = i; break; } depth--; }
}
const CSS = APP.slice(apertura, chiusura);

test('② …e la cornice sta nel blocco del COMPUTER (`@media (min-width:900px)`), non in quello del telefono', () => {
  assert.ok(/@media \(min-width:900px\)$/.test(condizione), 'la @media che contiene la cornice è: ' + condizione);
});

test('② la premessa: sul desktop `.svc-grid-col` è lo scroller', () => {
  assert.match(CSS, /\.svc-grid-col \{ overflow:auto; \}/, 'senza overflow:auto la colonna non scorre e la misura non ha nessuno a cui riferirsi');
});

const pavimento = (() => { const m = CSS.match(/--pmo-cal-pavimento: (\d+)px/); assert.ok(m, 'pavimento non dichiarato nel blocco desktop'); return Number(m[1]); })();

test('③ i due pavimenti dicono lo stesso numero (4 corsie × minimo + testata + bordo)', () => {
  // la testata è alta HEADERH più 1px di bordo sotto; la cornice ha 1px di bordo sopra e sotto.
  const atteso = 4 * laneMin + (headerH + 1) + 2;
  assert.equal(pavimento, atteso, `CSS ${pavimento}px contro ${atteso}px richiesti dalle corsie (${laneMin} × 4 + ${headerH + 1} + 2)`);
});

test('④ la regola dell\'altezza usa la variabile del pavimento, non un numero scritto a mano', () => {
  assert.match(CSS, /#staffCalV36 > \.svc-layout \{ height: max\(var\(--pmo-cal-pavimento\), calc\(100vh - var\(--pmo-cal-cornice\)\)\); \}/);
});

console.log(`\n${passed} verdi, ${failed} rossi`);
if (failed) process.exit(1);
