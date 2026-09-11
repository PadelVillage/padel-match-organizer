/* 👛 «Il borsellino lo contiamo noi» — banco della voce 219 (11/09/2026).
 *
 * 🗣️ REGOLA SUA: *«Il saldo Wallet viene da Matchpoint via worker: sul gestionale di test non deve
 *    essere così. Lo dobbiamo calcolare internamente.»*
 *
 * 🧮 LA FORMULA È **fotografia + i movimenti venuti DOPO di lei**, e il «dopo» è la cosa che questo
 *    banco difende più di tutte: i movimenti precedenti sono GIÀ dentro il numero fotografato, e
 *    sommarli tutti conterebbe due volte le stesse ricariche — cioè regalerebbe credito.
 *    📌 *Una fotografia non è un punto di partenza vuoto: è un totale che contiene già una parte
 *    di ciò che si sta per aggiungere.*
 *
 * 🚨 E LO ZERO NON ESISTE QUI. 📏 Misurato l'11/09: le fotografie in archivio sono **83 su 2826
 *    soci** ⇒ un saldo «0,00 €» direbbe a **2743** persone che non hanno credito senza averlo mai
 *    guardato. Chi non si sa torna `null`, e il bottone resta spento per il motivo giusto.
 *
 * ⛔ QUESTO BANCO NON DICE che il numero a schermo sia giusto: gira senza browser. Dice che il
 *    conto è quello, e che non inventa.
 *
 * Esegui:  node test/il-borsellino-lo-contiamo-noi.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(QUI, '..', 'index.html'), 'utf8');
assert.ok(APP.length > 500000, 'sorgente non letto: questo banco non direbbe niente');

let passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log('ok   - ' + nome); }
  catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + e.message); }
}
function ritaglia(firma) {
  const i = APP.indexOf(firma);
  assert.ok(i > 0, '«' + firma + '» non c\'è più: questo banco non sa dove guardare');
  let liv = 0, j = APP.indexOf('{', i), fine = -1;
  for (let k = j; k < APP.length; k++) {
    if (APP[k] === '{') liv++;
    else if (APP[k] === '}') { liv--; if (liv === 0) { fine = k + 1; break; } }
  }
  return APP.slice(i, fine);
}

// Si ESEGUE il calcolo vero, con accanto la funzione vera che pesa le righe.
const ctx = vm.createContext({});
vm.runInContext([
  "const PMO_CASSA_SOURCE = 'pmo_cassa';",
  ritaglia('function _pmoWalletPesoRiga('),
  ritaglia('function _pmoWalletSaldoDaNoi('),
  'globalThis.__f = _pmoWalletSaldoDaNoi;',
].join('\n'), ctx);
const saldo = ctx.__f;

const SOCIO = { id: 'matchpoint_49efs2', pmoPlayerId: 'PMO-000583' };
const foto = (cents, quando) => ({
  record_type: 'wallet_balance', deleted: false,
  payload: { balance_cents: cents, synced_at: quando, member_local_id: SOCIO.id, source: 'matchpoint' },
});
const ricarica = (cents, quando) => ({
  record_type: 'wallet_txn', deleted: false,
  payload: { amount_cents: cents, recorded_at: quando, member_local_id: SOCIO.id },
});
const speso = (cents, quando) => ({
  record_type: 'payment', deleted: false,
  payload: { amount_cents: cents, recorded_at: quando, member_local_id: SOCIO.id,
             source: 'pmo_cassa', method: 'wallet', status: 'paid' },
});

test('① la fotografia da sola è il saldo', () => {
  const r = saldo([foto(1200, '2026-09-07T21:31:04Z')], SOCIO);
  assert.equal(r.cents, 1200);
  assert.equal(r.base, 'fotografia');
});

test('② 🚨🚨 i movimenti PRIMA della fotografia NON si risommano', () => {
  /* È il caso che regalerebbe credito: quella ricarica è già dentro i 1200 fotografati. */
  const r = saldo([foto(1200, '2026-09-07T21:31:04Z'), ricarica(500, '2026-09-01T10:00:00Z')], SOCIO);
  assert.equal(r.cents, 1200, 'una ricarica già contenuta nella fotografia è stata sommata di nuovo');
});

test('③ i movimenti DOPO la fotografia si sommano, col segno', () => {
  const r = saldo([
    foto(1200, '2026-09-07T21:31:04Z'),
    ricarica(500, '2026-09-08T10:00:00Z'),   // +5,00
    speso(300, '2026-09-09T10:00:00Z'),      // −3,00
  ], SOCIO);
  assert.equal(r.cents, 1400, 'il saldo non segue i movimenti venuti dopo la fotografia');
  assert.equal(r.movimenti, 2);
});

test('④ 🚨 senza fotografia il saldo è PARZIALE, e lo dichiara', () => {
  const r = saldo([ricarica(500, '2026-09-08T10:00:00Z')], SOCIO);
  assert.equal(r.cents, 500);
  assert.equal(r.base, 'nostri', 'un saldo fatto dei soli movimenti nostri si spaccia per completo');
});

test('⑤ 🚨🚨 chi non si sa torna NULL, non zero', () => {
  /* 📏 Le fotografie sono 83 su 2826: uno zero direbbe a 2743 persone che non hanno credito. */
  assert.equal(saldo([], SOCIO), null, 'un socio mai guardato risulta a zero invece che ignoto');
  assert.equal(saldo([foto(1200, '2026-09-07T21:31:04Z')], { id: 'altro', pmoPlayerId: 'PMO-000999' }), null,
    'il saldo di un socio finisce addosso a un altro');
});

test('⑥ le righe di un ALTRO socio non entrano nel conto', () => {
  const altrui = { record_type: 'wallet_txn', deleted: false,
    payload: { amount_cents: 9999, recorded_at: '2026-09-08T10:00:00Z', member_local_id: 'qualcun_altro' } };
  const r = saldo([foto(1200, '2026-09-07T21:31:04Z'), altrui], SOCIO);
  assert.equal(r.cents, 1200, 'il movimento di un altro socio è entrato nel saldo');
});

test('⑦ il PMO aggancia anche quando il member_local_id non c\'è', () => {
  const perPmo = { record_type: 'wallet_txn', deleted: false,
    payload: { amount_cents: 700, recorded_at: '2026-09-08T10:00:00Z', pmo_player_id: 'PMO-000583' } };
  const r = saldo([foto(1200, '2026-09-07T21:31:04Z'), perPmo], SOCIO);
  assert.equal(r.cents, 1900, 'una riga agganciata col PMO non entra nel saldo');
});

test('⑧ una riga STORNATA non muove il saldo', () => {
  const stornata = { record_type: 'payment', deleted: false,
    payload: { amount_cents: 300, recorded_at: '2026-09-08T10:00:00Z', member_local_id: SOCIO.id,
               source: 'pmo_cassa', method: 'wallet', status: 'void' } };
  const r = saldo([foto(1200, '2026-09-07T21:31:04Z'), stornata], SOCIO);
  assert.equal(r.cents, 1200, 'un incasso stornato continua a pesare sul borsellino');
});

test('⑨ le righe tombate si saltano', () => {
  const morta = Object.assign({}, ricarica(500, '2026-09-08T10:00:00Z'), { deleted: true });
  const r = saldo([foto(1200, '2026-09-07T21:31:04Z'), morta], SOCIO);
  assert.equal(r.cents, 1200, 'una riga cancellata pesa ancora sul saldo');
});

test('⑩ fra due fotografie vince la PIÙ RECENTE', () => {
  const r = saldo([foto(1200, '2026-09-07T21:31:04Z'), foto(800, '2026-06-30T10:30:20Z')], SOCIO);
  assert.equal(r.cents, 1200, 'il saldo nasce da una fotografia vecchia');
});

test('⑪ 🚨 un movimento SENZA data non si indovina, con una fotografia in mano', () => {
  /* Sommarlo potrebbe raddoppiare una ricarica già dentro il totale: nel dubbio resta fuori. */
  const senzaData = { record_type: 'wallet_txn', deleted: false,
    payload: { amount_cents: 500, member_local_id: SOCIO.id } };
  const r = saldo([foto(1200, '2026-09-07T21:31:04Z'), senzaData], SOCIO);
  assert.equal(r.cents, 1200, 'un movimento senza data è stato sommato sopra una fotografia');
});

test('⑫ il collegamento alla scheda NON si accende dove la cassa è di Matchpoint', () => {
  const i = APP.indexOf('VOCE 219 — IL SALDO DEL BORSELLINO, CALCOLATO DA NOI');
  assert.ok(i > 0, 'il collegamento alla scheda è sparito');
  const zona = APP.slice(i, i + 3000);
  assert.ok(/pmoCassaNativa\(\)/.test(zona),
    'il calcolo nostro girerebbe anche dove i soldi li tiene Matchpoint');
  /* 🚨 Cercare la stringa non bastava: compare DUE volte nel blocco (nel controllo d'uscita e
     nel ciclo), quindi togliendone una il caso restava verde. Si controlla la riga del CICLO. */
  assert.ok(/if \(!p \|\| typeof p\.saldoCents === 'number'\) return;/.test(zona),
    'il calcolo nostro sovrascrive il saldo che il worker ha già portato');
  assert.ok(/if \(_st0\.roster\.every\(/.test(zona),
    'la scorciatoia che evita di chiedere il cloud quando il worker ha già risposto è sparita');
});

console.log('\n— ' + passed + ' verdi, ' + failed + ' rossi —');
process.exit(failed ? 1 : 0);
