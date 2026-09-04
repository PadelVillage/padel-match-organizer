/* 🔼 «La nota più bassa, il titolo nella testata» — banco della VOCE 157 (04/09/2026).
 *
 * 🗣️ Sua richiesta, guardando la scheda di una partita: «sulla parte sinistra c'è il campo nota
 *    che è troppo alto, diminuirlo di parecchio, tanto una nota non è mai più di 2 righe. Mentre
 *    la parte sinistra la puoi alzare all'altezza del titolo della scheda» → mockup con tre
 *    letture, e lui: **«fai la A»**.
 *
 * 📏 MISURATO sulla pagina viva di PROD 6.346 PRIMA di scrivere, ed è la misura che ha scelto il
 *    MECCANISMO, non solo la forma:
 *    · sopra il box ci sono 44 px di banda, di cui 39 sono la testata — che contiene solo la ✕;
 *    · il titolo costa 41 px + 10 di margine, su una riga a TUTTA LARGHEZZA (765 per 330);
 *    · nella catena box → `.svc-msg` → `#svcChatMessages` → `#svcChatPanel` nessuno è
 *      `position:relative` e il pannello è `fixed`.
 *
 * 🎯 LE COSE CHE QUESTO BANCO DIFENDE:
 *   ① la nota è di DUE righe e il minimo è sceso;
 *   ② 🚨 la nota resta TRASCINABILE: abbassarla senza lasciarla crescere sarebbe togliere una
 *      possibilità invece di togliere spazio sprecato;
 *   ③ il titolo è `position:absolute` con `top` dentro la banda della testata, e su UNA riga;
 *   ④ 🚨🚨 **LA PREMESSA CHE MUORE IN SILENZIO**: nessuno fra `.svc-edit-box`, `.svc-msg` e
 *      `#svcChatMessages` deve dichiarare `position:relative`. Se un domani qualcuno gliela mette,
 *      il titolo smette di risolvere contro il pannello, torna dentro il box, e si accampa sopra
 *      la prima sezione — senza che niente diventi rosso;
 *   ⑤ 🚨 `pointer-events:none` sul titolo: la ✕ vive nella stessa banda, e un titolo che si
 *      prende i click è la voce 146 daccapo (due bersagli vicini, la mira che sbaglia);
 *   ⑥ 🚨 il DOM NON è stato toccato: il titolo resta FIGLIO DIRETTO del box. Spostarlo nella
 *      testata avrebbe funzionato e avrebbe lasciato un titolo che sopravvive alla scheda chiusa;
 *   ⑦ tutto dentro `@media (min-width:900px)`: sotto, la scheda è un foglio dal basso.
 *
 * ⛔ QUELLO CHE NON DICE: che sullo schermo il titolo stia nella banda senza toccare la ✕. Quello
 *    lo dice la pagina viva, ed è la prova fisica.
 *
 * Esegui:  node test/il-titolo-sale-nella-testata.test.mjs
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

function regolaCon(selettore, richiesto) {
  const re = new RegExp(selettore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g');
  let m, ultima = null, dove = -1;
  while ((m = re.exec(APP))) {
    if (!richiesto || richiesto.test(m[1])) { ultima = m[1]; dove = m.index; }
  }
  assert.ok(ultima !== null, 'regola non trovata: ' + selettore + (richiesto ? ' con ' + richiesto : ''));
  return { corpo: ultima, indice: dove };
}

// le @media aperte in un punto, contate con una pila (non «la più vicina indietro»)
function mediaAperteIn(indice) {
  const pila = []; let k = 0;
  while (k < indice) {
    if (APP[k] === '@' && APP.startsWith('@media', k)) {
      const apre = APP.indexOf('{', k);
      if (apre < 0 || apre >= indice) break;
      pila.push({ cond: APP.slice(k, apre).trim(), livello: 0, aperta: true });
      k = apre; continue;
    }
    if (APP[k] === '{') { for (const m of pila) if (m.aperta) m.livello++; }
    else if (APP[k] === '}') {
      for (let i = pila.length - 1; i >= 0; i--) {
        if (!pila[i].aperta) continue;
        pila[i].livello--; if (pila[i].livello === 0) pila[i].aperta = false; break;
      }
    }
    k++;
  }
  return pila.filter(m => m.aperta).map(m => m.cond);
}

// ─────────────────────────────────────────────────────────────────────────────
// ① ② la nota
// ─────────────────────────────────────────────────────────────────────────────
test('① la casella della nota è di DUE righe', () => {
  const m = APP.match(/editNoteTA\.rows\s*=\s*(\d+)/);
  assert.ok(m, 'non trovo più il numero di righe della nota');
  assert.equal(Number(m[1]), 2, 'la nota è di ' + m[1] + ' righe: lui ne ha chieste 2');
});

test('① e il minimo è sceso sotto le tre righe', () => {
  const { corpo } = regolaCon('.svc-note-edit', /min-height/);
  const m = corpo.match(/min-height\s*:\s*(\d+)px/);
  assert.ok(m, 'la nota non dichiara più un min-height');
  const min = Number(m[1]);
  const riga = 21;                                  // line-height misurato: 21px
  assert.ok(min < 64, 'min-height ' + min + 'px: è ancora quello di prima, la casella non si abbassa');
  assert.ok(min <= 2 * riga + 20 + 4, 'min-height ' + min + 'px lascia spazio a più di due righe: '
    + 'l\'attributo `rows` non basta, il minimo lo scavalca');
});

test('② 🚨 la nota resta TRASCINABILE — si toglie spazio sprecato, non una possibilità', () => {
  const { corpo } = regolaCon('.svc-note-edit', /min-height/);
  assert.match(corpo, /resize\s*:\s*vertical/,
    'la nota non è più allargabile: chi ha da scrivere di più adesso non può, e questa cura gli '
    + 'ha tolto qualcosa invece di restituirgli spazio');
});

// ─────────────────────────────────────────────────────────────────────────────
// ③ ⑤ ⑦ il titolo
// ─────────────────────────────────────────────────────────────────────────────
test('③ il titolo è assoluto e si ferma dentro la banda della testata', () => {
  const { corpo } = regolaCon('.svc-edit-box > .svc-edit-title', /position\s*:\s*absolute/);
  assert.match(corpo, /position\s*:\s*absolute/);
  const t = corpo.match(/top\s*:\s*(-?\d+)px/);
  assert.ok(t, 'il titolo assoluto non dichiara `top`: finirebbe dove capita');
  const top = Number(t[1]);
  assert.ok(top >= 0 && top <= 39 - 14,
    'top ' + top + 'px: la testata misurata è alta 39 px, e il titolo ne uscirebbe sopra i messaggi');
  assert.match(corpo, /margin\s*:\s*0/,
    'il titolo tiene ancora un margine: da assoluto non serve a niente e confonde chi legge');
});

test('③ e sta su UNA riga: la banda è 39 px, su due righe ne vorrebbe 41', () => {
  const { corpo } = regolaCon('.svc-edit-box > .svc-edit-title .svc-edit-title-sub', /margin-top/);
  assert.match(corpo, /margin-top\s*:\s*0/, 'la coordinata è ancora staccata sotto il nome');
  const { corpo: interno } = regolaCon('.svc-edit-box > .svc-edit-title > div', /display\s*:\s*flex/);
  assert.match(interno, /align-items\s*:\s*baseline/,
    'nome e coordinate non sono affiancati: il titolo resta su due righe e non ci sta nella banda');
});

test('⑤ 🚨 il titolo NON prende i click: la ✕ vive nella stessa banda', () => {
  const { corpo } = regolaCon('.svc-edit-box > .svc-edit-title', /position\s*:\s*absolute/);
  assert.match(corpo, /pointer-events\s*:\s*none/,
    'senza `pointer-events:none` il titolo si sovrappone alla zona della ✕ e se ne prende i click: '
    + 'è la voce 146 daccapo — due bersagli vicini e la mira che trova quello sbagliato');
});

test('⑦ tutto dentro @media (min-width:900px)', () => {
  const { indice } = regolaCon('.svc-edit-box > .svc-edit-title', /position\s*:\s*absolute/);
  const aperte = mediaAperteIn(indice);
  assert.ok(aperte.some(c => /min-width\s*:\s*900px/.test(c)),
    'le @media aperte lì sono [' + aperte.join(' · ') + ']: sotto i 900 la scheda è un foglio dal '
    + 'basso e la testata in modo scheda è display:none — il titolo deve restare dov\'è');
});

// ─────────────────────────────────────────────────────────────────────────────
// ④ ⑥ Le due cose che muoiono in silenzio
// ─────────────────────────────────────────────────────────────────────────────
test('④ 🚨🚨 nessun antenato fra il box e il pannello dichiara `position:relative`', () => {
  // Se qualcuno gliela mette, il titolo smette di risolvere contro il pannello, torna DENTRO il
  // box e si accampa sopra la prima sezione — senza che niente diventi rosso.
  for (const sel of ['.svc-edit-box', '#svcChatMessages', '.svc-chat-messages']) {
    const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g');
    let m;
    while ((m = re.exec(APP))) {
      assert.doesNotMatch(m[1], /position\s*:\s*(relative|absolute|sticky|fixed)/,
        sel + ' è diventato un blocco contenitore: il titolo assoluto non risolve più contro '
        + '#svcChatPanel e finisce sopra la prima sezione. Regola: «' + m[1].trim().slice(0, 90) + '»');
    }
  }
});

test('④ e il pannello è ancora il blocco contenitore (`position:fixed`)', () => {
  const { corpo } = regolaCon('.svc-chat-panel', /position\s*:\s*fixed/);
  assert.match(corpo, /position\s*:\s*fixed/,
    'il pannello non è più posizionato: il titolo assoluto risalirebbe fino al documento');
});

test('⑥ 🚨 il DOM non è stato toccato: il titolo resta FIGLIO DIRETTO del box', () => {
  const i = APP.indexOf("title.className = 'svc-edit-title'");
  assert.ok(i > 0, 'non trovo più la creazione del titolo');
  const dopo = APP.slice(i, i + 1400);
  assert.match(dopo, /box\.appendChild\(title\)/,
    'il titolo non viene più appeso al box: se è stato spostato nella testata, sopravvive alla '
    + 'scheda chiusa — una testata che continua a dire «Campo 3 · 14:00» a scheda sparita');
  assert.doesNotMatch(dopo, /(header|Header)\.appendChild\(title\)/,
    'il titolo viene appeso alla testata: la cura doveva essere di sola posizione');
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
