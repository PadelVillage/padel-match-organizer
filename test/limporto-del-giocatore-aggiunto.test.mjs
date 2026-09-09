/* ➕💶 «Chi entra dopo paga come chi c'era già» — banco della VOCE 180 (09/09/2026).
 *
 * 🚨 IL BUCO CHE CHIUDE: alla creazione la partita prende gli importi dal listino (l'edge
 *   `matchpoint-bookings-create`, con `pmo_calendario_effettivo`), ma un giocatore **aggiunto
 *   dopo** nasceva senza importo. Su una partita dove due entrano più tardi, la cassa avrebbe metà
 *   delle righe da addebitare — e la metà mancante **non si distingue** da una che nessuno ha
 *   ancora letto.
 *
 * 🎯 LE DUE COSE CHE QUESTO BANCO DIFENDE, e la seconda vale più della prima:
 *   ① la scelta della FASCIA e le quattro regole, esercitate sulla funzione dell'app;
 *   ② 🚨⭐⭐ **LE DUE COPIE DANNO LA STESSA RISPOSTA.** `importiDalListino` (edge, Deno/TS) e
 *      `_pmoImportiDalListino` (app, in pagina) sono due implementazioni della stessa regola,
 *      perché un modulo Deno non entra in una pagina e la copia è inevitabile. Qui vengono
 *      esercitate sulla **stessa tabella di casi** e devono rispondere identiche.
 *      📌 *Due copie che oggi coincidono sono un guasto che aspetta il primo cambio, a meno che
 *         qualcosa le tenga legate. Questo banco è quel qualcosa.*
 *
 * ⛔ QUELLO CHE NON DICE: che il prezzo sia quello giusto. Il prezzo lo decide il gestionale
 *    (`pmo_calendario_effettivo`) e qui arriva già deciso: si prova la SCELTA e le REGOLE, non
 *    il listino. E non dice che aggiungendo un giocatore su una scheda vera l'importo compaia:
 *    quello lo dice una scheda vera.
 *
 * Esegui:  node --experimental-strip-types test/limporto-del-giocatore-aggiunto.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importiDalListino, prezzoDellaFascia } from '../supabase/functions/matchpoint-bookings-create/importo-dal-listino.ts';

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
function parametriDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  return APP.slice(i + ('function ' + nome + '(').length, APP.indexOf(') {', i));
}
function esegui(nome, ...dipendenze) {
  const nomiDip = dipendenze.map((d) => d[0]);
  const valoriDip = dipendenze.map((d) => d[1]);
  return new Function(...nomiDip,
    'return function ' + nome + '(' + parametriDi(nome) + ') ' + corpoDi(nome) + ';')(...valoriDip);
}

const oraPulita = esegui('_pmoOraPulita');
const dentroLaFascia = esegui('pmoOraDentroLaFascia');
// 🆕 VOCE 188/B — `_pmoPrezzoDelloSlot` non contiene più il ciclo: **delega** a
// `_pmoPerchePrezzoAssente` e ne butta via il motivo. ⇒ Il banco deve costruire prima quella e
// iniettargliela, o esercita una funzione che nell'app non esiste più.
// ⚖️ È il prezzo di avere la regola in un posto solo, ed è quello giusto da pagare: prima le due
//    copie erano due, e questo banco ne provava una sola.
const percheAssente = esegui('_pmoPerchePrezzoAssente', ['_pmoOraPulita', oraPulita], ['pmoOraDentroLaFascia', dentroLaFascia]);
const prezzoSlot = esegui('_pmoPrezzoDelloSlot', ['_pmoPerchePrezzoAssente', percheAssente]);
const importiApp = esegui('_pmoImportiDalListino');

const QUANDO = '2026-09-09T10:00:00.000Z';
const MAPPA = {
  '2026-12-30': { chiuso: false, slots: [
    { start: '18:00:00', end: '19:30:00', prezzoCents: 1200 },
    { start: '19:30:00', end: '21:00:00', prezzoCents: 1300 },
    { start: '21:00:00', end: '22:30:00', prezzoCents: null },
  ] },
  '2026-12-25': { chiuso: true, motivo: 'Natale', slots: [
    { start: '19:30:00', end: '21:00:00', prezzoCents: 1300 },
  ] },
};

// ─────────────────────────────────────────────────────────────────────────────
// ① LA SCELTA DELLA FASCIA
// ─────────────────────────────────────────────────────────────────────────────
test('① la fascia si sceglie sull\'ora, e il prezzo è il suo', () => {
  assert.equal(prezzoSlot(MAPPA, '2026-12-30', '19:30'), 1300);
  assert.equal(prezzoSlot(MAPPA, '2026-12-30', '18:00'), 1200);
});

test('① 🔄 un\'ora che cade DENTRO una fascia ne prende il prezzo (voce 188)', () => {
  /* 🔄🚨 QUESTA PROVA DICEVA IL CONTRARIO — «⇒ non lo sappiamo», con la motivazione
     «indovinare il prezzo di una partita che comincia a metà fascia è inventarlo». È stata
     CORRETTA il 09/09/2026, non affiancata, e la correzione viene da una parola del committente:
     la griglia è il **menù dei soci**, non l'orario del circolo, e il **prezzo** è del campo a
     quell'ora ⇒ *«prende il prezzo della fascia»*.
     ⚖️ La riga vecchia non era una svista: era giusta finché non si sapeva a chi appartenesse la
     griglia. 📌 *Una regola che nessuno può dire giusta o sbagliata senza sapere a chi appartiene
     il dato non è una regola tecnica: è una decisione, e va chiesta.* */
  assert.equal(prezzoSlot(MAPPA, '2026-12-30', '20:00'), 1300);
  assert.equal(prezzoSlot(MAPPA, '2026-12-30', '18:45'), 1200);
});

test('① ⛔ l\'ora uguale alla FINE appartiene alla fascia DOPO', () => {
  assert.equal(prezzoSlot(MAPPA, '2026-12-30', '19:30'), 1300);   // non 1200
});

test('① fuori da OGNI fascia resta null: lì non c\'è niente da leggere', () => {
  assert.equal(prezzoSlot(MAPPA, '2026-12-30', '09:00'), null);
  assert.equal(prezzoSlot(MAPPA, '2026-12-30', '22:30'), null);
});

test('① una fascia SENZA prezzo resta null: non diventa gratis', () => {
  assert.equal(prezzoSlot(MAPPA, '2026-12-30', '21:00'), null);
});

test('① 🚨 un giorno CHIUSO non ha un prezzo, anche se la griglia porta ancora le fasce', () => {
  assert.equal(prezzoSlot(MAPPA, '2026-12-25', '19:30'), null);
});

test('① 🚨 calendario NON caricato ⇒ null, non zero: un listino assente non è un listino vuoto', () => {
  assert.equal(prezzoSlot(null, '2026-12-30', '19:30'), null);
  assert.equal(prezzoSlot({}, '2026-12-30', '19:30'), null);
  assert.equal(prezzoSlot(MAPPA, '2027-01-01', '19:30'), null, 'giorno fuori dalla tratta caricata');
});

test('① gli orari si normalizzano: «19:30:00» e «19:30» sono la stessa fascia', () => {
  assert.equal(prezzoSlot(MAPPA, '2026-12-30', '19:30:00'), 1300);
  assert.equal(oraPulita('9:05'), '09:05');
  assert.equal(oraPulita('25:00'), null);
  assert.equal(oraPulita(''), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// ② 🚨 LE DUE COPIE — è la ragione per cui questo banco esiste.
// ─────────────────────────────────────────────────────────────────────────────
const CASI = [
  { titolo: 'riga nuda + prezzo', righe: [{ nome: 'Prova Uno', codice: '' }], prezzo: 1300 },
  { titolo: 'due righe nude', righe: [{ nome: 'A' }, { nome: 'B' }], prezzo: 800 },
  { titolo: 'prezzo NULL ⇒ niente si scrive', righe: [{ nome: 'A' }], prezzo: null },
  { titolo: 'prezzo negativo ⇒ niente si scrive', righe: [{ nome: 'A' }], prezzo: -100 },
  { titolo: 'prezzo ZERO è un prezzo (omaggio deciso)', righe: [{ nome: 'A' }], prezzo: 0 },
  { titolo: 'importo GIÀ presente vince', righe: [{ nome: 'A', importoCents: 500 }], prezzo: 1300 },
  { titolo: 'importo già presente a ZERO vince pure', righe: [{ nome: 'A', importoCents: 0 }], prezzo: 1300 },
  { titolo: 'pendente già presente non si tocca', righe: [{ nome: 'A', pendenteCents: 200 }], prezzo: 1300 },
  { titolo: 'riga con lettoAt: l\'importo manca, il prezzo entra', righe: [{ nome: 'A', lettoAt: '2026-09-01T00:00:00Z' }], prezzo: 1300 },
  { titolo: 'elenco vuoto', righe: [], prezzo: 1300 },
  { titolo: 'elenco nullo', righe: null, prezzo: 1300 },
  { titolo: 'campi estranei sopravvivono', righe: [{ nome: 'A', idCliente: '77', boh: 1 }], prezzo: 1300 },
];

test('② 🚨⭐⭐ EDGE e APP rispondono IDENTICO su tutti i casi', () => {
  CASI.forEach(function (c) {
    const a = importiDalListino(c.righe, c.prezzo, QUANDO);
    const b = importiApp(c.righe, c.prezzo, QUANDO);
    assert.deepEqual(b, a, 'divergono su «' + c.titolo + '»\n       edge: ' + JSON.stringify(a) + '\n       app:  ' + JSON.stringify(b));
  });
});

test('② e la tabella dei casi copre davvero le quattro regole', () => {
  assert.ok(CASI.length >= 12, 'una tabella corta non lega niente');
  const conPrezzo = importiApp([{ nome: 'A' }], 1300, QUANDO)[0];
  assert.equal(conPrezzo.importoCents, 1300, '②/① il prezzo entra');
  assert.equal(conPrezzo.pendenteCents, 1300, '③ nessuno ha ancora pagato');
  assert.equal(conPrezzo.origineImporto, 'listino', '④ da dove viene');
  assert.equal(conPrezzo.importoAt, QUANDO);
  assert.equal('lettoAt' in conPrezzo, false, '🚨 ④ mai lettoAt: non l\'ha detto il circolo');
});

test('② 🚨 l\'elenco ricevuto NON si tocca: si torna sempre righe nuove', () => {
  const dentro = [{ nome: 'A' }];
  importiApp(dentro, 1300, QUANDO);
  assert.deepEqual(dentro, [{ nome: 'A' }], 'modificare l\'ingresso rende impossibile confrontare prima/dopo');
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔌 LA CUCITURA — le funzioni pure non aggiungono niente se nessuno le chiama.
// ─────────────────────────────────────────────────────────────────────────────
test('🔌 l\'aggiunta di un giocatore PASSA dalle regole del listino', () => {
  const corpo = corpoDi('staffCalApplyLocalGiocatori');
  assert.match(corpo, /_pmoPrezzoDelloSlot\(pmoCalendarioMappa, isoDate, ora\)/,
    'il prezzo va chiesto per lo slot di QUESTA prenotazione, non per adesso');
  assert.match(corpo, /_pmoImportiDalListino\(_nuovi,/,
    'senza questa riga il giocatore aggiunto continua a nascere senza importo');
});

test('🔌 🚨 e le regole si applicano SOLO ai nuovi, non a chi c\'era già', () => {
  const corpo = corpoDi('staffCalApplyLocalGiocatori');
  assert.doesNotMatch(corpo, /_pmoImportiDalListino\(g,/,
    'passare tutto l\'elenco riscriverebbe origineImporto su righe che non c\'entrano');
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
