/* 🪟 «L'ultima scheda aperta sta sopra» — banco della VOCE 154 (04/09/2026).
 *
 * 🗣️ Suo difetto, visto sulla pagina viva di PROD 6.340: «con la scheda aperta della partita, se
 *    clicco sul nome la scheda di anagrafica va SOTTO invece che sopra».
 *
 * 📏 LA CAUSA, misurata nel foglio di stile: `.member-card-overlay` e `.svc-chat-panel` hanno lo
 *    STESSO z-index (2600). A parità decide l'ordine nel DOM, e `#svcChatPanel` viene dopo
 *    `#memberCardOverlay` ⇒ la scheda partita vince sempre. Non è un numero sbagliato: è un
 *    numero che non decide niente.
 *
 * 🎯 LE COSE CHE QUESTO BANCO DIFENDE:
 *   ① la classe PASSA DI MANO: chi si apre la prende, l'altra la perde;
 *   ② 🚨🚨 non ce l'hanno MAI tutt'e due — due elementi a 2720 sono di nuovo un pareggio, cioè
 *      esattamente il difetto di partenza travestito da cura;
 *   ③ il livello dichiarato è MAGGIORE di 2600: alzare a 2600 non curerebbe niente;
 *   ④ 🚨 l'aggancio è su TUTT'E DUE le aperture. Con il solo `openMemberCard` la scheda socio
 *      resterebbe fissata sopra, e l'esito del salvataggio anagrafica — che
 *      `pmoMemberEditChatFlow` scrive APRENDO il pannello della chat — finirebbe sotto: il
 *      difetto curato di là e ricreato di qua, nel punto in cui si scrive su Matchpoint;
 *   ⑤ 🚨 la regola della scheda partita sta DENTRO la soglia dei 900 px: sotto, quella scheda è
 *      un foglio dal basso a z-index 300 e la pila del telefono è un'altra cosa. Il difetto
 *      misurato è del desktop e si cura dove è stato visto.
 *
 * ⛔ QUELLO CHE NON DICE: gira senza browser. Dice che la regola sceglie bene e che è agganciata
 *    ai due punti giusti, NON che sullo schermo la scheda si veda sopra. Quello lo dice la
 *    pagina viva — ed è la prova fisica che chiude la voce.
 *
 * Esegui:  node test/lultima-scheda-aperta-sta-sopra.test.mjs
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

// ── un DOM finto: due elementi con la sola cosa che serve, `classList` ──────
function finto(id) {
  const set = new Set();
  return {
    id,
    classi: set,
    classList: {
      add: (c) => set.add(c),
      remove: (c) => set.delete(c),
      contains: (c) => set.has(c),
    },
  };
}
function banco() {
  const socio = finto('memberCardOverlay');
  const partita = finto('svcChatPanel');
  const documentFinto = {
    getElementById: (id) => (id === 'memberCardOverlay' ? socio : id === 'svcChatPanel' ? partita : null),
  };
  // 🚨 La regola si ESEGUE, non si cerca a parole: una prova che grep-a una stringa passa anche
  //    su una funzione che non fa niente.
  const CLASSE = (APP.match(/PMO_CLASSE_IN_CIMA\s*=\s*'([^']+)'/) || [])[1];
  assert.ok(CLASSE, 'la costante della classe non si trova: la cura non è quella descritta');
  const fn = new Function('document', 'PMO_CLASSE_IN_CIMA',
    'return function pmoPortaInCima(el) ' + corpoDi('pmoPortaInCima') + ';')(documentFinto, CLASSE);
  return { socio, partita, fn, CLASSE };
}

// ─────────────────────────────────────────────────────────────────────────────
// ① la classe passa di mano
// ─────────────────────────────────────────────────────────────────────────────
test('① apro la scheda SOCIO: la cima è sua', () => {
  const { socio, partita, fn, CLASSE } = banco();
  fn(socio);
  assert.equal(socio.classList.contains(CLASSE), true, 'la scheda socio non è salita');
  assert.equal(partita.classList.contains(CLASSE), false);
});

test('① apro la partita DOPO il socio: la cima passa alla partita', () => {
  const { socio, partita, fn, CLASSE } = banco();
  fn(socio);
  fn(partita);
  assert.equal(partita.classList.contains(CLASSE), true, 'la scheda partita non è salita');
  assert.equal(socio.classList.contains(CLASSE), false,
    'la scheda socio è rimasta in cima: la classe NON è passata di mano');
});

test('① e si può rimbalzare avanti e indietro, non è un giro solo', () => {
  const { socio, partita, fn, CLASSE } = banco();
  fn(socio); fn(partita); fn(socio); fn(partita); fn(socio);
  assert.equal(socio.classList.contains(CLASSE), true);
  assert.equal(partita.classList.contains(CLASSE), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// ② 🚨 il freno vero: mai tutt'e due
// ─────────────────────────────────────────────────────────────────────────────
test('② 🚨 non ce l\'hanno MAI tutt\'e due — il pareggio è il difetto di partenza', () => {
  const { socio, partita, fn, CLASSE } = banco();
  for (const chi of [socio, partita, socio, socio, partita, partita]) {
    fn(chi);
    const quante = [socio, partita].filter(e => e.classList.contains(CLASSE)).length;
    assert.equal(quante, 1, 'in cima ce ne sono ' + quante + ' invece di una: a pari z-index torna a decidere il DOM');
  }
});

test('② chiamarla due volte sullo stesso non lo fa perdere', () => {
  const { socio, partita, fn, CLASSE } = banco();
  fn(socio); fn(socio);
  assert.equal(socio.classList.contains(CLASSE), true);
  assert.equal(partita.classList.contains(CLASSE), false);
});

test('② un elemento che non c\'è non azzera la pila', () => {
  const { socio, partita, fn, CLASSE } = banco();
  fn(socio);
  fn(null);
  assert.equal(socio.classList.contains(CLASSE), true, 'una chiamata a vuoto ha spazzato la cima');
  assert.equal(partita.classList.contains(CLASSE), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// ③ il numero deve DECIDERE
// ─────────────────────────────────────────────────────────────────────────────
function zIndexDi(selettore) {
  const i = APP.indexOf(selettore + ' {');
  assert.ok(i > 0, 'regola CSS non trovata: ' + selettore);
  const chiude = APP.indexOf('}', i);
  const m = APP.slice(i, chiude).match(/z-index\s*:\s*(\d+)/);
  assert.ok(m, 'la regola ' + selettore + ' non dichiara nessun z-index');
  return Number(m[1]);
}

test('③ il livello in cima è MAGGIORE del 2600 di partenza (alzare a 2600 non cura niente)', () => {
  const socio = zIndexDi('.member-card-overlay.pmo-in-cima');
  const partita = zIndexDi('.svc-chat-panel.pmo-in-cima');
  assert.ok(socio > 2600, 'la scheda socio in cima è a ' + socio + ': non supera il 2600 di base');
  assert.ok(partita > 2600, 'la scheda partita in cima è a ' + partita + ': non supera il 2600 di base');
  assert.equal(socio, partita, 'i due livelli in cima devono essere UGUALI: a decidere è la classe, non il numero');
});

test('③ e resta sotto le cose che devono coprire tutto (avvisi, composer WhatsApp)', () => {
  const cima = zIndexDi('.member-card-overlay.pmo-in-cima');
  assert.ok(cima < 10050, 'la scheda in cima copre il composer WhatsApp (10050)');
  assert.ok(cima < 11000, 'la scheda in cima copre gli avvisi (11000)');
});

// ─────────────────────────────────────────────────────────────────────────────
// ④ 🚨 tutti e due gli agganci
// ─────────────────────────────────────────────────────────────────────────────
test('④ 🚨 openMemberCard porta in cima la scheda socio', () => {
  const c = corpoDi('openMemberCard');
  assert.match(c, /pmoPortaInCima\s*\(\s*overlay\s*\)/,
    'openMemberCard non alza la scheda socio: è il difetto che lui ha visto');
});

test('④ 🚨🚨 svcOpenChat porta in cima la scheda partita — o l\'esito del salvataggio anagrafica finisce sotto', () => {
  const c = corpoDi('svcOpenChat');
  assert.match(c, /pmoPortaInCima\s*\(\s*panel\s*\)/,
    'svcOpenChat non alza la scheda partita: con la scheda socio fissata sopra, l\'esito scritto da '
    + 'pmoMemberEditChatFlow resterebbe nascosto — difetto curato di là e ricreato di qua');
});

test('④ e l\'esito dell\'anagrafica passa DAVVERO da svcOpenChat (la premessa della ④ regge)', () => {
  // 🚨 Questa prova esiste perché la ④ poggia su un FATTO del codice, non su un ricordo: se un
  //    domani queste due smettessero di aprire il pannello, la ④ difenderebbe un pericolo che
  //    non c'è più — e resterebbe verde, che è il modo in cui una guardia muore in silenzio.
  for (const nome of ['pmoMemberEditChatFlow', 'pmoMemberCreateChatFlow']) {
    assert.match(corpoDi(nome), /svcOpenChat\s*\(\s*\)/,
      nome + ' non apre più il pannello della chat: la ragione della ④ è cambiata, rileggerla');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ⑤ 🚨 la metà desktop sta dentro la soglia dei 900
// ─────────────────────────────────────────────────────────────────────────────
test('⑤ 🚨 la regola della scheda partita sta DENTRO @media (min-width:900px)', () => {
  const i = APP.indexOf('.svc-chat-panel.pmo-in-cima {');
  assert.ok(i > 0, 'regola non trovata');
  const prima = APP.slice(0, i);
  const j = prima.lastIndexOf('@media');
  assert.ok(j > 0, 'la regola non sta dentro nessun @media');
  const condizione = APP.slice(j, APP.indexOf('{', j));
  assert.match(condizione, /min-width\s*:\s*900px/,
    'la regola sta dentro «' + condizione.trim() + '» invece che sopra i 900 px: sul telefono la pila è un\'altra cosa');
});

test('⑤ la regola della scheda SOCIO invece è di base, non dentro un @media', () => {
  const i = APP.indexOf('.member-card-overlay.pmo-in-cima {');
  assert.ok(i > 0, 'regola non trovata');
  const prima = APP.slice(0, i);
  const apreMedia = prima.lastIndexOf('@media');
  // se l'ultima @media aperta prima è già stata chiusa, siamo fuori: conto le graffe.
  let g = 0;
  for (let k = apreMedia; k < i; k++) { const c = APP[k]; if (c === '{') g++; else if (c === '}') g--; }
  assert.equal(g, 0, 'la scheda socio in cima è finita dentro un @media: sul telefono non varrebbe');
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
