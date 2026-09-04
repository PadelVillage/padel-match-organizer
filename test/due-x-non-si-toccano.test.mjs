/* ✕✕ «Le due ✕ non si toccano» — banco della voce 146 (04/09/2026).
 *
 * 🗣️ SUA SEGNALAZIONE, con schermata dal telefono: «penso che la doppia x sia qualcosa da
 *    analizzare» — due ✕ identiche, una accanto all'altra, in alto a destra della scheda.
 *
 * 🚨⭐⭐ E NON ERANO DUE CHIUSURE, che è la ragione per cui questo banco esiste:
 *    · una è la ✕ del pannello — chiude la finestra, e al massimo fa perdere il lavoro in corso;
 *    · l'altra è la **✕ Rimuovi giocatore** di una riga — toglie qualcuno dalla partita, e al
 *      salvataggio finisce su Matchpoint.
 *    📏 Misurate sulla pagina viva a 390 px, scorrendo come si scorre col dito: si
 *    **sovrapponevano** su un'area di **8 × 28 px**. Nel pezzo conteso vinceva «Chiudi», ma
 *    bastavano **5 px più a sinistra** per prendere «Rimuovi giocatore» mirando a chiudere.
 *
 * ⚖️ LA CAUSA erano due numeri che non si parlavano: la fascia della ✕ è alta **52 px** e i
 *    messaggi ne riservavano **30** (`padding-top`). Gli altri 22 erano terra di nessuno.
 *
 * 🎯 LE TRE COSE CHE QUESTO BANCO DIFENDE, e nessuna si vede rileggendo:
 *   ① la fascia è OPACA — con `transparent` ciò che le passa sotto resta visibile *e cliccabile*,
 *      ed è esattamente com'era quando lui l'ha fotografata;
 *   ② la fascia è a TUTTA LARGHEZZA (`left:0`) — ancorata solo a destra copre la ✕ del pannello
 *      ma lascia scoperta quella del giocatore, che è la pericolosa;
 *   ③ 🚨 lo spazio riservato in cima ai messaggi è ≥ dell'altezza della fascia. È il numero da cui
 *      il difetto è nato: se qualcuno rialza il padding della fascia senza toccare il
 *      `padding-top`, il buco tra i due numeri torna, e con lui la sovrapposizione.
 *
 * ⛔ QUELLO CHE NON DICE: gira senza browser ⇒ dice che le regole CSS sono quelle giuste, non che
 *    sullo schermo i due bottoni distino abbastanza. Quello lo dice la misura sulla pagina viva.
 *
 * Esegui:  node test/due-x-non-si-toccano.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(QUI, '..', 'index.html'), 'utf8');
assert.ok(APP.length > 500000, 'sorgente non letto: questo banco non direbbe niente');

let passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log('ok   - ' + nome); }
  catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + e.message); }
}

/** Il corpo di UNA regola CSS: dal selettore alla graffa che la chiude — non alla fine del
 *  blocco. 🩹 È la lezione del 04/09: una sonda che ritaglia troppo trova quello che cerca venti
 *  righe più in là e dice sempre di sì. */
function regola(selettore, dopo) {
  // 🩹 `dopo` non è un vezzo: `.svc-chat-close-btn` è dichiarata DUE volte — una per il desktop e
  // una dentro la media query del telefono, ed è la seconda quella che conta qui. Senza ancora, la
  // sonda leggeva la regola sbagliata e diceva «l'altezza non si legge più» invece della verità.
  // 📌 *Una sonda che pesca la prima occorrenza di un nome dichiarato due volte non sta misurando
  //    il pezzo di cui parla.*
  const da = dopo ? APP.indexOf(dopo + ' {') : 0;
  assert.ok(da >= 0, 'ancora non trovata: ' + dopo);
  const i = APP.indexOf(selettore + ' {', da);
  assert.ok(i > 0, 'regola CSS non trovata: ' + selettore + (dopo ? ' (dopo ' + dopo + ')' : ''));
  const apre = APP.indexOf('{', i);
  const chiude = APP.indexOf('}', apre);
  assert.ok(chiude > apre, 'regola non chiusa: ' + selettore);
  return APP.slice(apre + 1, chiude);
}

function px(corpo, prop) {
  const m = corpo.match(new RegExp(prop + '\\s*:\\s*(-?\\d+(?:\\.\\d+)?)px'));
  return m ? Number(m[1]) : null;
}

const SEL_FASCIA = '.svc-chat-panel:not(.svc-card-mode) .svc-chat-header';
const SEL_MSG = '.svc-chat-panel:not(.svc-card-mode) .svc-chat-messages';
const SEL_BTN = '.svc-chat-close-btn';

test('① la fascia della ✕ è OPACA, non trasparente', () => {
  const c = regola(SEL_FASCIA);
  assert.doesNotMatch(c, /background\s*:\s*transparent/,
    '🚨 con lo sfondo trasparente la ✕ «Rimuovi giocatore» resta visibile E cliccabile sotto la ✕ '
    + 'del pannello: è esattamente lo stato che lui ha fotografato');
  assert.match(c, /background\s*:\s*(var\(|#|rgb)/,
    'la fascia deve dichiarare uno sfondo suo: senza, eredita e torna trasparente');
});

test('② la fascia copre TUTTA la larghezza del foglio', () => {
  const c = regola(SEL_FASCIA);
  assert.match(c, /left\s*:\s*0/,
    '🚨 ancorata solo a destra (`left:auto`) la fascia protegge la ✕ del pannello e lascia '
    + 'scoperta quella del giocatore — cioè copre l\'innocua e non la pericolosa');
});

test('② e resta SOPRA il contenuto che le scorre sotto', () => {
  const c = regola(SEL_FASCIA);
  assert.match(c, /position\s*:\s*absolute/, 'la fascia deve stare sopra il flusso, non dentro');
  const z = Number((c.match(/z-index\s*:\s*(\d+)/) || [])[1] || 0);
  assert.ok(z >= 2, 'senza z-index la fascia si fa passare davanti dal contenuto: z=' + z);
});

test('③ 🚨 lo spazio riservato in cima ai messaggi copre l\'altezza VERA della fascia', () => {
  const fascia = regola(SEL_FASCIA);
  const btn = regola(SEL_BTN, SEL_FASCIA);
  const msg = regola(SEL_MSG);
  const padFascia = (function () {
    const m = fascia.match(/padding\s*:\s*(-?\d+(?:\.\d+)?)px/);
    return m ? Number(m[1]) : null;
  })();
  const hBtn = px(btn, 'height');
  const padTop = px(msg, 'padding-top');
  assert.ok(padFascia != null, 'il padding della fascia non si legge più: la sonda non sa che dire');
  assert.ok(hBtn != null, 'l\'altezza del bottone ✕ non si legge più');
  assert.ok(padTop != null, 'lo spazio riservato in cima ai messaggi non si legge più');
  const altezzaFascia = hBtn + 2 * padFascia;
  assert.ok(padTop >= altezzaFascia,
    '🚨 lo spazio riservato (' + padTop + 'px) è MINORE della fascia (' + altezzaFascia + 'px): '
    + 'la differenza è terra di nessuno, e ci passano le righe con la loro ✕ — è precisamente '
    + 'il buco da cui è nato il difetto (52 contro 30)');
});

test('③ e il numero non è un caso: cambiando il padding della fascia si rompe', () => {
  // Guardia della guardia: se un domani qualcuno gonfia il padding della fascia senza toccare
  // il padding-top, il caso ③ deve accorgersene. Qui si verifica che i due numeri siano LEGATI,
  // cioè che il margine non sia così largo da rendere il controllo inerte.
  const fascia = regola(SEL_FASCIA);
  const btn = regola(SEL_BTN, SEL_FASCIA);
  const msg = regola(SEL_MSG);
  const padFascia = Number((fascia.match(/padding\s*:\s*(-?\d+(?:\.\d+)?)px/) || [])[1]);
  const altezzaFascia = px(btn, 'height') + 2 * padFascia;
  const padTop = px(msg, 'padding-top');
  assert.ok(padTop - altezzaFascia <= 24,
    'lo spazio riservato è ' + (padTop - altezzaFascia) + 'px più del necessario: un margine così '
    + 'largo fa passare il controllo anche quando la fascia cresce, e la guardia smette di dire '
    + 'qualcosa. Meglio stretto e vero che largo e inerte');
});

test('la ✕ del pannello resta un bersaglio da dito (≥30px)', () => {
  const btn = regola(SEL_BTN, SEL_FASCIA);
  assert.ok(px(btn, 'width') >= 30 && px(btn, 'height') >= 30,
    'rimpicciolire la ✕ per allontanarla dall\'altra non è una cura: sposta il problema di mira '
    + 'invece di toglierlo');
});

console.log('\n' + passed + ' passate, ' + failed + ' fallite');
process.exit(failed ? 1 : 0);
