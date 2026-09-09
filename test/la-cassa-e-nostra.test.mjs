/* 💰 «La cassa è nostra» — banco della VOCE 181 (09/09/2026).
 *
 * 🗣️ Sue parole (08/09): *«dal gestionale si incassa, perché Matchpoint non c'è più»* e
 *   *«si incassa solo su test, su PROD mai»*. Sono la stessa regola vista da due parti, e
 *   l'invariante che le tiene insieme è uno: **nessun soldo passa da Matchpoint per mano nostra**.
 *
 * 🎯 LE QUATTRO COSE CHE QUESTO BANCO DIFENDE:
 *   ① 🚨⭐⭐ **il cancello guarda il REF SUPABASE, non l'hostname.** `PMO_IS_TEST_ENV` risponde a
 *      *«sto su un indirizzo che comincia per test.»*, e il passaggio (voce 184) la farà scadere:
 *      il giorno in cui il gestionale nuovo cambia indirizzo, una cassa appesa a quella risposta
 *      **si spegnerebbe da sola** e il circolo smetterebbe di incassare in silenzio.
 *      📌 *Un ambiente si riconosce da CON CHI parla, non da come si chiama.*
 *   ② 🔑 **la chiave è deterministica**: due clic = UN incasso. La versione vecchia metteva
 *      `Date.now()` nella chiave — *una chiave che contiene l'istante non è una chiave: è un
 *      contatore*;
 *   ③ ⛔ **il bottone «Pulisci simulazioni» non può cancellare la cassa vera.** Se le due
 *      sorgenti fossero lo stesso tag, il primo clic su quel bottone cancellerebbe **denaro**, e
 *      lo farebbe in silenzio — cancellare righe è esattamente il suo mestiere;
 *   ④ **su PROD la cassa nostra non si accende MAI**, che è la metà non negoziabile della regola.
 *
 * ⛔ QUELLO CHE NON DICE: che un incasso vero compaia in Incassi. Questo è un banco, non un
 *    gesto. La prova fisica è un clic su Cash sulla pagina viva.
 *
 * Esegui:  node --experimental-strip-types test/la-cassa-e-nostra.test.mjs
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
function parametriDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  return APP.slice(i + ('function ' + nome + '(').length, APP.indexOf(') {', i));
}
function esegui(nome, ...dipendenze) {
  return new Function(...dipendenze.map((d) => d[0]),
    'return function ' + nome + '(' + parametriDi(nome) + ') ' + corpoDi(nome) + ';')(...dipendenze.map((d) => d[1]));
}
/** Il valore di una costante dichiarata in pagina, letto dal sorgente. */
function costante(nome) {
  const m = new RegExp("const " + nome + " = '([^']*)'").exec(APP);
  assert.ok(m, 'costante non trovata: ' + nome);
  return m[1];
}

const REF_PROD = costante('PMO_PROD_SUPABASE_PROJECT_REF');
const REF_NUOVO = costante('PMO_TEST_SUPABASE_PROJECT_REF');
const collegato = esegui('pmoGestionaleCollegatoAlCircolo', ['PMO_PROD_SUPABASE_PROJECT_REF', REF_PROD]);

// 🔗 La catena vera: `pmoCassaNativa` → `pmoCassaNativaPer` → `pmoRefSupabaseDellUrl`.
// ⚖️ Si compone invece di essere finta, o il banco proverebbe un'altra funzione.
const refDellUrl = esegui('pmoRefSupabaseDellUrl');
const cassaNativaPer = esegui('pmoCassaNativaPer',
  ['pmoRefSupabaseDellUrl', refDellUrl],
  ['PMO_PROD_SUPABASE_PROJECT_REF', REF_PROD]);
/** `pmoCassaNativa()` con una memoria di configurazione finta. */
function cassaNativaCon(url) {
  const memoria = url === undefined ? null : { valore: { supabaseUrl: url } };
  return esegui('pmoCassaNativa',
    ['pmoConfigMemoria', memoria],
    ['pmoCassaNativaPer', cassaNativaPer])();
}

/* ── ① IL CANCELLO GUARDA IL REF ──────────────────────────────────────────── */

test('① sul gestionale NUOVO la cassa è nostra', () => {
  assert.equal(cassaNativaCon(`https://${REF_NUOVO}.supabase.co`), true);
});

test('① 🚨 su PROD la cassa nostra NON si accende — mai', () => {
  assert.equal(cassaNativaCon(`https://${REF_PROD}.supabase.co`), false,
    'su PROD incassare e incassare da Matchpoint sono lo stesso gesto');
});

test('① FALLISCE CHIUSA: senza configurazione non si incassa da qui', () => {
  // ⚖️ Il verso conta: al massimo i bottoni restano spenti un istante, che è un difetto
  // visibile. Il contrario sarebbe registrare denaro credendo di essere altrove.
  assert.equal(cassaNativaCon(undefined), false);
  assert.equal(cassaNativaCon(''), false);
  assert.equal(cassaNativaCon('non-un-url'), false);
});

test('① «non è PROD» e «non so dove sono» sono DUE risposte diverse', () => {
  // 📌 Il banco aveva scritto `true` sulla seconda riga, ed era il banco a sbagliare: un
  // indirizzo che non è un progetto Supabase riconoscibile non è «un altro progetto», è
  // **nessun progetto** — e su nessun progetto non si incassa.
  assert.equal(cassaNativaCon(`https://${REF_PROD}x.supabase.co`), true,
    'un ref valido e diverso da PROD ⇒ cassa nostra');
  assert.equal(cassaNativaCon(`https://${REF_PROD}.supabase.co.evil.test`), false,
    'non è un ref leggibile ⇒ non lo so ⇒ non incasso');
  assert.equal(cassaNativaCon('https://.supabase.co'), false);
  // 🚨 E il confronto è sul sottodominio INTERO, non su «contiene».
  assert.equal(collegato(`https://${REF_PROD}.supabase.co`), true);
  assert.equal(collegato(`https://prefisso-${REF_PROD}.supabase.co`), false);
});

test('① 🚨 il cancello NON si appoggia a come si CHIAMA l\'indirizzo', () => {
  const catena = corpoDi('pmoCassaNativa') + corpoDi('pmoCassaNativaPer') + corpoDi('pmoRefSupabaseDellUrl');
  for (const parola of ['PMO_IS_TEST_ENV', 'pmoIsTestHostname', 'window.location', "'test."]) {
    assert.equal(catena.includes(parola), false, `il cancello si appoggia a «${parola}», che il passaggio farà scadere`);
  }
  assert.ok(corpoDi('pmoCassaNativaPer').includes('PMO_PROD_SUPABASE_PROJECT_REF'),
    'deve confrontarsi col ref di PROD');
});

test('① 🚨⭐ NON si ottiene NEGANDO il cancello della 180 — e questo è il difetto trovato dal banco', () => {
  // Un cancello che fallisce chiuso per la SUA domanda («nel dubbio non chiamo il circolo»)
  // torna `false` anche su un url storpiato: negandolo, quel `false` diventa «la cassa è nostra».
  // 📌 Il fallimento sicuro di una domanda è il fallimento pericoloso della domanda opposta.
  assert.equal(collegato('non-un-url'), false, 'premessa: il cancello della 180 fallisce chiuso');
  assert.equal(cassaNativaCon('non-un-url'), false, 'e la cassa NON si accende lo stesso');
  const catena = corpoDi('pmoCassaNativa') + corpoDi('pmoCassaNativaPer');
  assert.equal(/!\s*pmoGestionaleCollegatoAlCircolo/.test(catena), false,
    'la cassa è tornata a essere la negazione dell\'altro cancello');
});

test('① `PMO_PAYMENTS_SIMULATE` non esiste più in nessun punto vivo', () => {
  // Resta solo dentro il commento che ne spiega la morte: si cerca il codice, non la parola.
  const usi = APP.split('PMO_PAYMENTS_SIMULATE').length - 1;
  assert.ok(usi <= 1, `«PMO_PAYMENTS_SIMULATE» compare ${usi} volte: doveva restarne al più una, nel commento`);
  assert.equal(/const PMO_PAYMENTS_SIMULATE\s*=/.test(APP), false, 'la costante è stata ridichiarata');
});

/* ── ② LA CHIAVE È DETERMINISTICA ─────────────────────────────────────────── */

const natKey = esegui('_payNatKey',
  ['_payCampoNum', esegui('_payCampoNum')],
  ['_payOraHm', esegui('_payOraHm')]);
const normName = esegui('_payNormName');
const cassaKey = esegui('_pmoCassaKey',
  ['PMO_CASSA_PAY_PREFIX', costante('PMO_CASSA_PAY_PREFIX')],
  ['_payNatKey', natKey],
  ['_payNormName', normName]);

test('② due clic sullo stesso incasso danno la STESSA chiave', () => {
  const a = cassaKey('2026-09-09', 'Campo 2', '18:00', 'Lidia Comes');
  const b = cassaKey('2026-09-09', 2, '18:00:00', '  lidia   comes ');
  assert.equal(a, b, 'due clic = due incassi: è il difetto che questa voce doveva curare');
  assert.ok(a.length > 10);
});

test('② 🚨 la chiave non contiene l\'ISTANTE', () => {
  const corpo = corpoDi('_pmoCassaKey');
  assert.equal(/Date\.now|new Date/.test(corpo), false,
    'una chiave che contiene l\'istante non è una chiave: è un contatore');
});

test('② giocatori diversi, o slot diversi, danno chiavi diverse', () => {
  const base = cassaKey('2026-09-09', 2, '18:00', 'Lidia Comes');
  assert.notEqual(base, cassaKey('2026-09-09', 2, '18:00', 'Fabiola Limuti'));
  assert.notEqual(base, cassaKey('2026-09-09', 3, '18:00', 'Lidia Comes'));
  assert.notEqual(base, cassaKey('2026-09-09', 2, '19:30', 'Lidia Comes'));
  assert.notEqual(base, cassaKey('2026-09-10', 2, '18:00', 'Lidia Comes'));
});

test('② la chiave della cassa non collide con quella degli OMAGGI', () => {
  const gift = esegui('_pmoGiftKey', ['_payNatKey', natKey], ['_payNormName', normName]);
  assert.notEqual(cassaKey('2026-09-09', 2, '18:00', 'Lidia Comes'),
    gift('2026-09-09', 2, '18:00', 'Lidia Comes'));
});

/* ── ③ LA PULIZIA NON PUÒ CANCELLARE LA CASSA ─────────────────────────────── */

test('③ 🚨 le due sorgenti sono DIVERSE — o il bottone di pulizia cancella denaro', () => {
  assert.notEqual(costante('PMO_CASSA_SOURCE'), costante('PMO_CASSA_SOURCE_VECCHIA'));
  assert.equal(costante('PMO_CASSA_SOURCE'), 'pmo_cassa');
  assert.equal(costante('PMO_CASSA_SOURCE_VECCHIA'), 'pmo_simulate');
});

test('③ la pulizia guarda SOLO la sorgente vecchia', () => {
  const corpo = corpoDi('_pmoSimCleanupPayments');
  assert.ok(corpo.includes('PMO_CASSA_SOURCE_VECCHIA'), 'la pulizia non è agganciata alla sorgente vecchia');
  assert.equal(/source !== PMO_CASSA_SOURCE\b/.test(corpo), false,
    'la pulizia guarda la sorgente della cassa vera: cancellerebbe denaro');
});

test('③ lo STORNO invece riconosce tutt\'e due — ma non tocca le righe di Matchpoint', () => {
  const corpo = corpoDi('_pmoCassaStorna');
  assert.ok(corpo.includes('PMO_CASSA_SOURCE') && corpo.includes('PMO_CASSA_SOURCE_VECCHIA'),
    'chi vede una riga vecchia in Incassi deve poterla togliere');
  assert.equal(/'matchpoint'/.test(corpo), false, 'le righe di Matchpoint le annulla il loro libro, non questo');
});

/* ── ④ LA SCRITTURA ───────────────────────────────────────────────────────── */

test('④ l\'incasso nasce `paid`, con la sorgente della cassa e la chiave deterministica', () => {
  const corpo = corpoDi('_pmoCassaScriviIncasso');
  assert.ok(corpo.includes('source: PMO_CASSA_SOURCE'), 'la riga non porta la sorgente della cassa');
  assert.ok(corpo.includes("status: 'paid'"), 'senza `status` la riga non si distingue da una stornata');
  assert.ok(corpo.includes('_pmoCassaKey('), 'la scrittura non usa la chiave deterministica');
  assert.equal(corpo.includes('simulated'), false, 'la riga si dichiara ancora una finta');
});

test('④ 🚨 la cassa non chiama NESSUNA edge di pagamento di Matchpoint', () => {
  const corpo = corpoDi('_pmoCassaScriviIncasso') + corpoDi('_pmoCassaStorna');
  for (const nome of ['matchpoint-payment-write', 'matchpoint-payment-void', 'functions/v1']) {
    assert.equal(corpo.includes(nome), false, `la cassa nostra passa da «${nome}»: non deve esistere una riga che ci vada`);
  }
});

test('④ incasso e storno decidono col cancello ASINCRONO, non con la memoria', () => {
  // ⚖️ Qui si sta per registrare del denaro: la domanda si fa alla configurazione autorevole,
  // non a una copia che può essere scaduta.
  for (const fn of ['_pmoCollectPayment', '_pmoVoidPayment']) {
    const corpo = corpoDi(fn);
    assert.ok(corpo.includes('await loadAssessmentSupabaseConfig()'), `${fn}: non chiede la configurazione vera`);
    assert.ok(corpo.includes('pmoGestionaleCollegatoAlCircolo'), `${fn}: non passa dal cancello del ref`);
    assert.equal(corpo.includes('pmoCassaNativa('), false, `${fn}: usa la versione sincrona, che legge una memoria`);
  }
});

console.log(`\n── ${passed} verdi, ${failed} rossi ──`);
process.exit(failed ? 1 : 0);
