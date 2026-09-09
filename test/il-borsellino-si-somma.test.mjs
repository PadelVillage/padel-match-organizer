/* 👛 «Il saldo si somma, non si fotografa» — banco della VOCE 181, seconda metà (09/09/2026).
 *
 * 🚨 IL DIFETTO, misurato prima di curarlo: `wallet_balance` è una **fotografia** presa da
 *   Matchpoint, e sul sistema nuovo non la rinfresca più nessuno. ⇒ Un incasso col metodo
 *   «Wallet» registrava l'entrata e **non scalava niente**. Il bottone Wallet si spegne quando
 *   il saldo non basta — ma leggeva un numero fermo, quindi **non si spegneva mai**: la stessa
 *   persona poteva spendere due volte lo stesso denaro.
 *   📌 *Una fotografia del saldo non si può stornare: si può solo riscattare — e al distacco non
 *      ci sarà più nessuno da cui riscattarla.*
 *
 * 🎯 LE QUATTRO COSE CHE QUESTO BANCO DIFENDE:
 *   ① la fotografia è il saldo **d'apertura**, e i movimenti nostri ci si **sommano**;
 *   ② ⭐ **non si scrive un secondo record**: un pagamento col borsellino È GIÀ un movimento del
 *      borsellino, e duplicarlo in `wallet_txn` farebbe due fonti per lo stesso fatto;
 *   ③ ⛔ si contano **solo i movimenti successivi alla fotografia** — se la sync tornasse
 *      accesa, la fotografia nuova conterrebbe già quelle spese e sommarle le conterebbe due volte;
 *   ④ 🚨 **la regola sta nella funzione, non nel bottone**: fra il disegno del bottone e il clic
 *      passa tutto il tempo che ci mette il cassiere.
 *
 * ⛔ QUELLO CHE NON DICE: che il saldo mostrato sulla pagina sia giusto. Questo è un banco.
 *    La prova fisica è un incasso col borsellino sulla pagina viva.
 *
 * Esegui:  node --experimental-strip-types test/il-borsellino-si-somma.test.mjs
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
function esegui(nome, ...dip) {
  return new Function(...dip.map((d) => d[0]),
    'return function ' + nome + '(' + parametriDi(nome) + ') ' + corpoDi(nome) + ';')(...dip.map((d) => d[1]));
}
function costante(nome) {
  const m = new RegExp("const " + nome + " = '([^']*)'").exec(APP);
  assert.ok(m, 'costante non trovata: ' + nome);
  return m[1];
}

const CASSA = costante('PMO_CASSA_SOURCE');
const peso = esegui('_pmoWalletPesoRiga', ['PMO_CASSA_SOURCE', CASSA]);
const chiavi = esegui('_pmoWalletChiavi');

const paga = (over = {}) => ({ source: CASSA, method: 'wallet', amount_cents: 1200, member_local_id: 'soc-1', id_cliente: '721', recorded_at: '2026-09-09T10:00:00.000Z', ...over });

/* ── ① IL PESO DI UNA RIGA ────────────────────────────────────────────────── */

test('① un incasso col borsellino SOTTRAE', () => {
  assert.equal(peso(paga(), 'payment'), -1200);
});

test('① una riga STORNATA non pesa più — il denaro torna nel borsellino', () => {
  assert.equal(peso(paga({ voided: true }), 'payment'), 0);
  assert.equal(peso(paga({ status: 'void' }), 'payment'), 0);
});

test('① 🚨 le righe di MATCHPOINT non pesano: sono già dentro la fotografia', () => {
  // Contarle vorrebbe dire sottrarre due volte ogni spesa dell'era Matchpoint.
  assert.equal(peso(paga({ source: 'matchpoint' }), 'payment'), 0);
  assert.equal(peso(paga({ source: 'pmo_simulate' }), 'payment'), 0);
});

test('① cash e card NON toccano il borsellino', () => {
  assert.equal(peso(paga({ method: 'cash' }), 'payment'), 0);
  assert.equal(peso(paga({ method: 'card' }), 'payment'), 0);
  assert.equal(peso(paga({ method: 'gift' }), 'payment'), 0);
});

test('① una RICARICA somma, col segno che porta già lei', () => {
  assert.equal(peso({ amount_cents: 5000, source: 'pmo_wallet' }, 'wallet_txn'), 5000);
  assert.equal(peso({ amount_cents: -800, source: 'pmo_wallet' }, 'wallet_txn'), -800);
});

/* ── ② L'ATTRIBUZIONE ─────────────────────────────────────────────────────── */

test('② una riga si attribuisce per id, MAI per nome', () => {
  assert.deepEqual(chiavi(paga()), ['m:soc-1', 'c:721']);
  assert.deepEqual(chiavi({ player_name: 'Lidia Comes' }), [],
    'due «Ospite» sarebbero la stessa persona: il nome non è una chiave');
});

test('② basta uno dei due id', () => {
  assert.deepEqual(chiavi({ member_local_id: 'soc-9' }), ['m:soc-9']);
  assert.deepEqual(chiavi({ id_cliente: '404' }), ['c:404']);
});

/* ── ③ IL SALDO SI SOMMA ──────────────────────────────────────────────────── */

function resolveCon(base, delta) {
  const mappaDelta = new Map(Object.entries(delta || {}));
  return esegui('_walletResolve',
    ['_walletCloudGet', () => base],
    ['_walletCacheGet', () => null],
    ['_pmoWalletDeltaDi', esegui('_pmoWalletDeltaDi',
      ['_walletClientId', (g) => g && g.idCliente],
      ['window', { __pmoWalletDelta: mappaDelta }])],
  );
}

test('③ la fotografia è il saldo D\'APERTURA, e i movimenti ci si sommano', () => {
  const r = resolveCon({ balance_cents: 2000, synced_at: '2026-09-01T00:00:00Z' }, { 'm:soc-1': -1200 })({ id: 'soc-1' });
  assert.equal(r.balance_cents, 800, '20,00 € meno 12,00 € spesi');
  assert.equal(r.apertura_cents, 2000, 'l\'apertura resta leggibile: senza, «perché 8,00?» non ha risposta');
  assert.equal(r.movimenti_cents, -1200);
});

test('③ senza movimenti si torna la fotografia, intatta', () => {
  const r = resolveCon({ balance_cents: 2000, synced_at: 'x' }, {})({ id: 'soc-1' });
  assert.equal(r.balance_cents, 2000);
});

test('③ 🚨 il totale NON si scrive nella cache dei saldi', () => {
  // Altrimenti al giro dopo il delta si sommerebbe a sé stesso, e nessuno saprebbe distinguere
  // «saldo d'apertura» da «saldo già calcolato una volta».
  const base = { balance_cents: 2000, synced_at: 'x' };
  const r = resolveCon(base, { 'm:soc-1': -1200 })({ id: 'soc-1' });
  assert.equal(base.balance_cents, 2000, 'la fotografia è stata sporcata col totale');
  assert.notEqual(r, base, 'va tornato un oggetto NUOVO');
});

test('③ l\'attribuzione ricade sull\'id cliente quando manca quello locale', () => {
  const r = resolveCon({ balance_cents: 1000, synced_at: 'x' }, { 'c:721': -400 })({ id: 'ignoto', idCliente: '721' });
  assert.equal(r.balance_cents, 600);
});

/* ── ④ LE REGOLE CHE STANNO NEL CODICE ────────────────────────────────────── */

// 🩹 LA REGOLA SI ESEGUE, non si legge — e questo blocco è nato da un sabotaggio rimasto VERDE:
// il controllo era scritto in linea e il banco cercava la parola `SALDO_INSUFFICIENTE`; spegnendolo
// con `if (false)` le parole restavano tutte. 📌 *Una guardia che cerca una parola prova che la
// parola c'è, non che il codice succeda.*
const verdetto = esegui('_pmoCassaVerdettoBorsellino');

test('④ col borsellino non si spende più di quello che c\'è', () => {
  assert.equal(verdetto(true, 'wallet', 2000, 1200), null, '12,00 su 20,00 passa');
  assert.equal(verdetto(true, 'wallet', 1200, 1200), null, 'spendere tutto è lecito');
  assert.equal(verdetto(true, 'wallet', 1100, 1200), 'SALDO_INSUFFICIENTE');
});

test('④ 🚨 un saldo che non si CONOSCE non è un saldo che basta', () => {
  assert.equal(verdetto(true, 'wallet', null, 1200), 'SALDO_SCONOSCIUTO');
  assert.equal(verdetto(true, 'wallet', undefined, 1200), 'SALDO_SCONOSCIUTO');
  assert.equal(verdetto(true, 'wallet', NaN, 1200), 'SALDO_SCONOSCIUTO');
  assert.equal(verdetto(true, 'wallet', 2000, NaN), 'SALDO_SCONOSCIUTO');
});

test('④ la regola NON riguarda cash, card, né la strada di Matchpoint', () => {
  // Fuori dalla cassa nostra a dire di no è Matchpoint: due copie della stessa regola divergono.
  assert.equal(verdetto(true, 'cash', 0, 9999), null);
  assert.equal(verdetto(true, 'card', 0, 9999), null);
  assert.equal(verdetto(false, 'wallet', 0, 9999), null);
});

test('④ 🚨 e il verdetto viene USATO: prima della scrittura, e la scrittura non parte', () => {
  const corpo = corpoDi('_pmoCollectPayment');
  assert.ok(corpo.includes('_pmoCassaVerdettoBorsellino('), 'la regola non è chiamata');
  assert.ok(/if \(_verdW\) \{/.test(corpo), 'il verdetto è calcolato e non guardato');
  assert.ok(/return \{ ok: false, message: _verdW \}/.test(corpo), 'il verdetto non ferma l\'incasso');
  const iV = corpo.indexOf('_pmoCassaVerdettoBorsellino(');
  const iS = corpo.indexOf('_pmoCassaScriviIncasso');
  assert.ok(iV > 0 && iS > 0 && iV < iS, 'il controllo deve stare PRIMA della scrittura');
});

test('④ ⭐ NON si scrive un secondo record per la stessa spesa', () => {
  const corpo = corpoDi('_pmoCassaScriviIncasso');
  assert.equal(/record_type:\s*'wallet_txn'/.test(corpo), false,
    'un pagamento col borsellino è già un movimento: duplicarlo fa due fonti per lo stesso fatto');
  assert.ok(corpo.includes('member_local_id'), 'senza il socio, il movimento non si sa a chi togliere');
});

test('④ ⛔ si contano solo i movimenti DOPO la fotografia', () => {
  const corpo = corpoDi('pmoLoadWalletBalances');
  assert.ok(corpo.includes('tRiga <= tFoto'),
    'senza il confronto con l\'istante della fotografia, una sync riaccesa conterebbe due volte');
  assert.ok(corpo.includes('const delta = new Map()'),
    'il delta va rifatto da zero: sommarlo al precedente conterebbe due volte ciò che è già nel database');
});

test('④ lo storno rimette i soldi nel borsellino, subito', () => {
  assert.ok(corpoDi('_pmoCassaStorna').includes('_pmoWalletDeltaAggiorna'),
    'stornato l\'incasso, il saldo resterebbe scalato fino al prossimo giro di lettura');
});

console.log(`\n── ${passed} verdi, ${failed} rossi ──`);
process.exit(failed ? 1 : 0);
