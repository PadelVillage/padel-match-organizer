/* 💰 «Il conto della partita» — banco della VOCE 152 (04/09/2026).
 *
 * 🗣️ Sua richiesta: «a livello grafico puoi migliorarla così da far entrare tutte le informazioni
 *   dentro la scheda aperta» → mockup `scheda-entra-tutta-mockup.html`, e sulla variante da
 *   mettere nello spazio libero: **«fai la A»**.
 *
 * 📏 MISURATO su PROD 6.338 a 1440×900 prima di disegnare: la finestra è 860 px e la scheda ne
 *   usava 612 (231 vuoti a destra), con 453 px di contenuto sotto il bordo. Due colonne da 900 px
 *   in su, e nello spazio che si libera il conto: a carico · già incassato · manca.
 *
 * 🎯 LE COSE CHE QUESTO BANCO DIFENDE:
 *   ① i tre numeri tornano: a carico = incassato + manca;
 *   ② 🚨 uno ZERO LETTO è un dato (l'omaggio della 149) e conta — non è un buco;
 *   ③ 🚨 un importo NON letto non entra nella somma e si conta a parte: `ignoti`;
 *   ④ 🚨🚨 e `completo` diventa false appena ce n'è UNO. È il freno vero di questa voce: un
 *      totale che ha saltato una riga non è approssimato, è **falso**, e guardandolo non si
 *      distingue da uno giusto. Chi disegna DEVE poterlo dire;
 *   ⑤ la partita saldata si riconosce (manca 0 E completo);
 *   ⑥ 🚨 IL DOM DELLA SCHEDA NON È STATO INCARTATO — il freno che protegge la voce 150: la barra
 *      dei bottoni resta FIGLIO DIRETTO del box, o `_svcSchedaEsito` e la guardia della 150
 *      smettono di trovare la riga dell'esito, in silenzio, e il doppione dei messaggi torna.
 *
 * ⛔ QUELLO CHE NON DICE: gira senza browser. Dice che il conto conta bene e che la parentela è
 *    intatta, non che sullo schermo entri tutto. Quello lo dice la pagina viva.
 *
 * Esegui:  node test/il-conto-della-partita.test.mjs
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

function corpoDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  assert.ok(i > 0, 'funzione non trovata: ' + nome);
  const apre = APP.indexOf(') {', i);
  let g = 0, visto = false, out = '';
  for (let k = apre + 2; k < APP.length; k++) {
    const c = APP[k];
    out += c;
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) break; }
  }
  return out;
}
const conto = new Function('return function _pmoContoPartita(voci) ' + corpoDi('_pmoContoPartita') + ';')();
const euro = (c) => (c / 100).toFixed(2).replace('.', ',');

// ─────────────────────────────────────────────────────────────────────────────
// ① I tre numeri
// ─────────────────────────────────────────────────────────────────────────────
test('① i tre numeri tornano: a carico = incassato + manca', () => {
  const c = conto([
    { cents: 800, incassato: true },
    { cents: 800, incassato: true },
    { cents: 800, incassato: false },
    { cents: 800, incassato: false },
  ]);
  assert.equal(c.incassatoCents, 1600);
  assert.equal(c.mancaCents, 1600);
  assert.equal(c.aCaricoCents, 3200, 'il totale a carico non è la somma delle due metà');
  assert.equal(euro(c.aCaricoCents), '32,00');
  assert.equal(c.completo, true);
});

test('① la partita di lui: quattro da 8,00, nessuno ha ancora pagato', () => {
  const c = conto([0, 1, 2, 3].map(() => ({ cents: 800, incassato: false })));
  assert.equal(euro(c.aCaricoCents), '32,00');
  assert.equal(euro(c.incassatoCents), '0,00');
  assert.equal(euro(c.mancaCents), '32,00');
});

// ─────────────────────────────────────────────────────────────────────────────
// ② ③ ④ Zero letto vs importo mancante — la 149, un piano più su
// ─────────────────────────────────────────────────────────────────────────────
test('② 🚨 uno ZERO LETTO conta: l\'omaggio è un dato, non un buco', () => {
  const c = conto([{ cents: 0, incassato: false }, { cents: 800, incassato: false }]);
  assert.equal(c.ignoti, 0, 'lo zero letto è stato scambiato per un importo mancante');
  assert.equal(c.completo, true, 'una partita con un omaggio dentro è comunque contata per intero');
  assert.equal(euro(c.aCaricoCents), '8,00');
});

test('③ 🚨 un importo NON letto non entra nella somma e si conta a parte', () => {
  const c = conto([{ cents: 800, incassato: false }, { cents: null, incassato: false }]);
  assert.equal(c.aCaricoCents, 800, 'il null è stato sommato come zero: il totale diventa falso');
  assert.equal(c.ignoti, 1);
});

test('④ 🚨🚨 `completo` cade a UNA riga ignota — è il freno di questa voce', () => {
  const c = conto([
    { cents: 800, incassato: true },
    { cents: 800, incassato: false },
    { cents: null, incassato: false },
  ]);
  assert.equal(c.completo, false,
    'senza questo la scheda stampa 16,00 come «il conto», e chi fa cassa non ha modo di accorgersene');
  assert.equal(c.ignoti, 1);
  assert.equal(c.aCaricoCents, 1600, 'i numeri restano quelli veri delle righe note: sono un MINIMO');
});

test('④ e un valore storto (NaN, Infinity, testo) è ignoto, non zero', () => {
  for (const v of [NaN, Infinity, -Infinity, '800', undefined, null]) {
    const c = conto([{ cents: v, incassato: false }]);
    assert.equal(c.ignoti, 1, 'valore accettato per buono: ' + String(v));
    assert.equal(c.aCaricoCents, 0);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ⑤ ⑥ Saldata, e i casi limite
// ─────────────────────────────────────────────────────────────────────────────
test('⑤ partita saldata: manca 0 e il conto è completo', () => {
  const c = conto([{ cents: 800, incassato: true }, { cents: 800, incassato: true }]);
  assert.equal(c.mancaCents, 0);
  assert.equal(c.completo, true);
  assert.equal(euro(c.incassatoCents), '16,00');
});

test('⑤ 🚨 «manca 0» con una riga ignota NON è saldata', () => {
  const c = conto([{ cents: 800, incassato: true }, { cents: null, incassato: false }]);
  assert.equal(c.mancaCents, 0);
  assert.equal(c.completo, false, 'dire «saldata» qui sarebbe la bugia più cara del conto');
});

test('⑥ regge sul vuoto invece di esplodere', () => {
  for (const v of [undefined, null, [], [null], 'non un elenco']) {
    const c = conto(v);
    assert.equal(c.aCaricoCents, 0);
    assert.equal(c.incassatoCents, 0);
    assert.equal(c.mancaCents, 0);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ⑦ IL FRENO CHE PROTEGGE LA VOCE 150 — la parentela non si tocca
// ─────────────────────────────────────────────────────────────────────────────
test('⑦ 🚨🚨 la barra dei bottoni resta FIGLIO DIRETTO del box (o muore la guardia della 150)', () => {
  /* La 150 spegne la striscia quando la riga dell'esito è visibile, e la cerca con
     `.svc-edit-box > .svc-edit-esito`; `_svcSchedaEsito` la inserisce con
     `box.querySelector(':scope > .svc-edit-actions-bar')`. Incartare le sezioni in due `<div>`
     colonna per ottenere il layout romperebbe TUTTE E DUE senza un errore: il doppione dei
     messaggi tornerebbe e il banco della 150 resterebbe verde. */
  assert.match(APP, /box\.appendChild\(actions\);/,
    'la barra dei bottoni non è più aggiunta al box: se è finita dentro una colonna, la 150 è cieca');
  assert.match(APP, /riga = box\.querySelector\(':scope > \.svc-edit-esito'\)/,
    'la riga dell\'esito non si cerca più fra i figli diretti');
  assert.match(APP, /'\.svc-edit-box > \.svc-edit-esito'/,
    'la guardia della 150 non cerca più la riga come figlio diretto del box');
});

test('⑦ e il layout è CSS puro: la colonna destra si aggancia a un attributo, non a un involucro', () => {
  assert.match(APP, /\.svc-edit-box > \[data-feature="players-payments"\]\s*\{[^}]*grid-column:2/,
    'la colonna dei giocatori non è più posizionata via CSS');
  assert.match(APP, /@media \(min-width:900px\) \{\s*\.svc-edit-box \{/,
    'le due colonne non sono più agganciate alla soglia dei 900 px');
  /* 🩹 Qui la prima stesura cercava le DUE `setAttribute` entro 600 caratteri l'una dall'altra, e
     falliva: nel sorgente ce ne sono centinaia in mezzo. Il banco diceva «manca su un ramo» mentre
     c'erano tutte e due. 📌 *Una sonda tarata su una DISTANZA misura quanto è lungo il codice fra
     due cose, non se ci sono.* Si contano, invece. */
  const quanti = (APP.match(/playersSec\.setAttribute\('data-feature', 'players-payments'\)/g) || []).length;
  assert.equal(quanti, 2,
    'l\'attributo deve stare su ENTRAMBI i rami (pieno e in caricamento), o la scheda salta da una colonna a due a metà lettura — trovate: ' + quanti);
});

test('⑦ 🚨 e il vecchio «Totale da incassare» è stato TOLTO, non affiancato', () => {
  /* Tenerli tutti e due sarebbe il quinto giro dello stesso difetto (136 · 145 · 147 · 150):
     due oggetti che dicono lo stesso fatto, e chi legge non sa quale guardare. Stavolta sui soldi. */
  /* 🩹 E qui la prima stesura cercava la frase nel sorgente INTERO: la trovava dentro i commenti
     che spiegano perché è stata tolta, e dichiarava presente una riga che non c'è più.
     📌 *Una sonda che cerca una parola non sa distinguere il codice dal racconto del codice.*
     Si cerca la RIGA CHE LA DISEGNA, non la parola. */
  assert.ok(!/textContent\s*=\s*'Totale da incassare'/.test(APP),
    'due somme quasi uguali nella stessa scheda: è il doppione che questo progetto ha già pagato quattro volte');
  assert.ok(!/const totWrap = document\.createElement/.test(APP),
    'il vecchio blocco del totale è ancora costruito');
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
