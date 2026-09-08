/* 💶 «L'importo NATO QUI lo dice» — banco della VOCE 180, quarto esito (09/09/2026).
 *
 * 🚨 IL DIFETTO CHE QUESTO BANCO CHIUDE, e stava già in servizio da una notte:
 *   dall'08/09 la creazione nativa fa NASCERE l'importo dal listino e — per la regola ④ della 180
 *   — **non scrive `lettoAt`**, perché quel campo significa «l'ho letto dal circolo».
 *   Ma `_pmoImportoCasella` conosceva SOLO `lettoAt` per distinguere le provenienze ⇒ un importo
 *   nato dal listino finiva nel ramo «letto adesso», e la scheda lo mostrava alla segreteria
 *   **come se il circolo l'avesse appena confermato**.
 *   📌 *La regola ④ ha tenuto onesto il database e ha perso lo schermo: una provenienza non è salva
 *      finché non arriva agli occhi.*
 *
 * 🎯 LE CINQUE COSE CHE QUESTO BANCO DIFENDE:
 *   ① il quarto esito — «nato qui» — esiste e non si confonde con nessuno degli altri tre;
 *   ② 🚨 `lettoAt` VINCE su `origineImporto`: se il circolo l'ha letto, quel numero È letto, e la
 *      nascita dal listino diventa la sua storia invece della sua provenienza. Senza questa
 *      precedenza i due esiti sarebbero veri insieme e la casella direbbe due cose;
 *   ③ 🚨 non esiste un «nato qui» SENZA numero: una provenienza su una casella vuota dichiara da
 *      dove viene **niente** — è la stessa guardia del ② della 151, sull'altro campo;
 *   ④ 🚨 il «da» del popup lo DICHIARA. È il punto in cui si chiede a una persona di confermare
 *      del denaro: un prezzo NOSTRO stampato nudo le fa credere che l'abbia detto il circolo;
 *   ⑤ 🚨 solo `'listino'` marca: qualunque altra origine (o una stringa a caso) NON diventa un
 *      «nato qui», o la marca finirebbe per significare «non so da dove viene».
 *
 * ⛔ QUELLO CHE NON DICE: gira senza browser. Dice che le regole decidono bene, non che aprendo
 *    una scheda vera il bordo puntinato si veda. Quello lo dice una scheda vera.
 *
 * Esegui:  node test/limporto-nato-qui-lo-dice.test.mjs
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
/** La firma vera, così il banco chiama la funzione con i parametri che HA: se qualcuno ne toglie
 *  uno — per esempio `origineImporto` — qui si rompe invece di passare in silenzio. */
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

const casella = esegui('_pmoImportoCasella');
const daVerso = esegui('_pmoImportoDa');

const IERI = '2026-09-08T19:03:00.000Z';
const euro = (c) => (c / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quando = () => 'alle 21:03';

// ─────────────────────────────────────────────────────────────────────────────
// ⓿ LA FIRMA — se il quarto parametro sparisce, tutto il resto passerebbe verde.
// ─────────────────────────────────────────────────────────────────────────────
test('⓿ 🚨 la casella ACCETTA la provenienza: senza il parametro non c\'è niente da distinguere', () => {
  assert.match(parametriDi('_pmoImportoCasella'), /origineImporto/,
    'tolto il parametro, ogni prova qui sotto direbbe «va bene» leggendo un undefined');
});

// ─────────────────────────────────────────────────────────────────────────────
// ① IL QUARTO ESITO
// ─────────────────────────────────────────────────────────────────────────────
test('① l\'importo NATO QUI è un quarto esito: c\'è il numero, e si sa che è nostro', () => {
  const c = casella(1300, 1300, null, 'listino');
  assert.equal(c.ignoto, false);
  assert.equal(c.natoQui, true, 'senza questo, un prezzo nostro si presenta come letto dal circolo');
  assert.equal(c.ricordato, false, 'nessuno l\'ha letto: non c\'è niente da ricordare');
  assert.equal(c.valore, '13,00', 'il numero si mostra: è il prezzo della fascia, ed è giusto');
  assert.equal(c.baseCents, 1300);
  assert.equal(c.lettoAt, null);
});

test('① il caso NORMALE non si muove: letto adesso, nessuna provenienza ⇒ nessuna marca', () => {
  const c = casella(800, null);
  assert.equal(c.natoQui, false);
  assert.equal(c.ricordato, false);
  assert.equal(c.valore, '8,00');
});

test('① e il RICORDATO non si muove: la 151 resta intera', () => {
  const c = casella(800, null, IERI);
  assert.equal(c.ricordato, true);
  assert.equal(c.natoQui, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// ② LA PRECEDENZA — è la regola che tiene i quattro esiti mutuamente esclusivi.
// ─────────────────────────────────────────────────────────────────────────────
test('② 🚨 `lettoAt` VINCE: un importo nato dal listino e POI letto dal circolo è LETTO', () => {
  const c = casella(1300, 1300, IERI, 'listino');
  assert.equal(c.ricordato, true, 'il circolo l\'ha letto: quella è la provenienza di adesso');
  assert.equal(c.natoQui, false, 'nascere dal listino è la sua storia, non da dove viene oggi');
  assert.equal(c.lettoAt, IERI, 'e il QUANDO deve restare, o si perde la freschezza');
});

test('② 🚨 i tre esiti con un numero non sono MAI veri insieme', () => {
  const casi = [
    casella(1300, 1300, null, 'listino'),
    casella(1300, 1300, IERI, 'listino'),
    casella(1300, 1300, IERI),
    casella(1300, 1300),
  ];
  casi.forEach(function (c, i) {
    assert.ok(!(c.ricordato && c.natoQui), 'caso ' + i + ': due provenienze insieme = nessuna');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ③ NIENTE PROVENIENZA SENZA NUMERO
// ─────────────────────────────────────────────────────────────────────────────
test('③ 🚨 non esiste un «nato qui» SENZA numero: dichiarerebbe da dove viene niente', () => {
  const c = casella(null, null, null, 'listino');
  assert.equal(c.ignoto, true);
  assert.equal(c.natoQui, false, 'la provenienza non riempie una casella vuota');
  assert.equal(c.valore, '');
  assert.equal(c.baseCents, null, 'e il «da» resta non letto: non si inventa un valore di partenza');
});

test('③ uno ZERO nato dal listino è un dato, non un buco (la 149 non si rimangia)', () => {
  const c = casella(0, 0, null, 'listino');
  assert.equal(c.ignoto, false, 'zero deciso dal listino è un prezzo, non un dato mancante');
  assert.equal(c.natoQui, true);
  assert.equal(c.valore, '0,00');
});

// ─────────────────────────────────────────────────────────────────────────────
// ⑤ SOLO «listino» MARCA
// ─────────────────────────────────────────────────────────────────────────────
test('⑤ 🚨 una provenienza SCONOSCIUTA non diventa «nato qui»', () => {
  ['', 'boh', 'worker', 'matchpoint', 'Listino', null, undefined, 0].forEach(function (v) {
    assert.equal(casella(1300, 1300, null, v).natoQui, false,
      'origine ' + JSON.stringify(v) + ': marcarla vorrebbe dire che la marca significa «non so»');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ④ IL «DA» — il punto in cui si autorizza del denaro.
// ─────────────────────────────────────────────────────────────────────────────
test('④ 🚨 il «da» NATO QUI si dichiara: «13,00 (dal listino)»', () => {
  assert.equal(daVerso(1300, null, euro, quando, true), '13,00 (dal listino)');
});

test('④ e gli altri tre «da» non si muovono', () => {
  assert.equal(daVerso(null, null, euro, quando, false), '(non letto)', 'la 149');
  assert.equal(daVerso(800, IERI, euro, quando, false), '8,00 (letto alle 21:03)', 'la 151');
  assert.equal(daVerso(800, null, euro, quando, false), '8,00', 'il caso normale non ingrassa');
});

test('④ 🚨 e la PRECEDENZA è la stessa della casella, o i due si smentiscono', () => {
  assert.equal(daVerso(1300, IERI, euro, quando, true), '13,00 (letto alle 21:03)',
    'letto dal circolo ⇒ si dice quello, non «dal listino»');
});

test('④ un «da» che non si sa resta «(non letto)» anche marcato: niente numero, niente provenienza', () => {
  assert.equal(daVerso(null, null, euro, quando, true), '(non letto)');
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔌 LE TRE CUCITURE — le funzioni sono pure, ma se nessuno le collega non curano niente.
// ─────────────────────────────────────────────────────────────────────────────
test('🔌 la scheda PASSA `p.origineImporto` alla casella (o il quarto esito non si accende mai)', () => {
  assert.match(APP, /_pmoImportoCasella\(importoCents, pendenteCents, p\.lettoAt, p\.origineImporto\)/,
    'la funzione saprebbe distinguere e nessuno le direbbe cosa distinguere');
});

test('🔌 il «da» del popup RICEVE la marca (è il punto dove si conferma del denaro)', () => {
  const chiamate = APP.match(/_pmoImportoDa\([^)]*\)/g) || [];
  assert.ok(chiamate.length >= 2, 'i posti che stampano il «da» sono due');
  chiamate.forEach(function (c) {
    assert.match(c, /daNatoQui/, 'chiamata senza la marca: «' + c + '»');
  });
});

test('🚨 la marca si TOGLIE quando l\'importo lo decide la segreteria', () => {
  assert.match(APP, /delete tgt\.origineImporto/,
    'senza, la casella direbbe «dal listino» sopra una cifra scritta a mano');
  assert.match(APP, /delete tgt\.importoAt/,
    'e la data di nascita del prezzo resterebbe attaccata a un prezzo diverso');
});

test('🎨 e il segno esiste ed è DISTINGUIBILE da quello del «ricordato»', () => {
  const ric = APP.match(/\.svc-pl-eur-ricordato \{ ([^}]*) \}/);
  const lis = APP.match(/\.svc-pl-eur-listino \{ ([^}]*) \}/);
  assert.ok(ric && lis, 'manca una delle due regole di stile');
  assert.notEqual(ric[1].trim(), lis[1].trim(),
    'due segni identici per due cose diverse sono un segno solo');
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
