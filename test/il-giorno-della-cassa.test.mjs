/* 💶 «Il giorno della cassa» — banco della voce 216 (11/09/2026).
 *
 * 🗣️ TROVATA DA LUI IN TRE PAROLE — «non c'è nulla in cassa» — con la sezione Incassi aperta su
 *    **Oggi**, subito dopo aver incassato 12,00 € con le sue mani. L'incasso c'era: era scritto nel
 *    giorno della **partita** (14/09) invece che in quello della **cassa** (11/09).
 *
 * 📏 CHE I DUE CAMPI SIANO COSE DIVERSE È MISURATO, non dedotto: sulle 2603 righe arrivate da
 *    Matchpoint, **84** hanno `data` ≠ `booking_data` — pagato il giorno dopo, pagato il giorno
 *    prima. Nel libro da cui copiamo, `data` è **quando il denaro si muove**.
 *
 * 🚨⭐⭐ E LA COSA CHE QUESTO BANCO DIFENDE PIÙ DI TUTTE È LA CHIAVE: è tentante derivarla dal
 *    giorno di cassa, visto che ormai è lì. Sarebbe la perdita dell'**idempotenza** — lo stesso
 *    incasso rifatto il giorno dopo nascerebbe come riga nuova, e sui soldi «due righe invece di
 *    una» non è un fastidio. La chiave resta legata allo **slot**.
 *
 * ⛔ QUESTO BANCO NON DICE che la riga si veda nella tabella Incassi: gira senza browser. Lo dice il
 *    suo occhio sulla pagina, ed è quello che ha aperto la voce.
 *
 * Esegui:  node test/il-giorno-della-cassa.test.mjs
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

/** Solo le righe di CODICE: il commento sopra la funzione nomina `data`, `booking_data` e la
 *  chiave — cioè tutto quello che le sonde cercano. Senza filtro il banco si misura addosso. */
function soloCodice(testo) {
  return String(testo).split('\n').filter(function (r) {
    return !/^\s*(\/\/|\*|\/\*)/.test(r);
  }).join('\n');
}

function corpoScrittura() {
  const i = APP.indexOf('async function _pmoCassaScriviIncasso(');
  assert.ok(i > 0, '_pmoCassaScriviIncasso non c\'è più: questo banco non sa dove guardare');
  let liv = 0, j = APP.indexOf('{', i), fine = -1;
  for (let k = j; k < APP.length; k++) {
    if (APP[k] === '{') liv++;
    else if (APP[k] === '}') { liv--; if (liv === 0) { fine = k + 1; break; } }
  }
  assert.ok(fine > j, 'non sono riuscito a ritagliare la funzione');
  return soloCodice(APP.slice(i, fine));
}

const SRC = corpoScrittura();

test('① I DUE GIORNI SONO DUE VALORI, non lo stesso ripetuto', () => {
  /* 🚨 Il difetto era esattamente questo: `data: _data` e `booking_data: _data`. Una guardia che
     controllasse solo l'esistenza dei campi sarebbe stata verde sul codice malato. */
  const mData = SRC.match(/\bdata:\s*([A-Za-z_$][\w$]*)/);
  const mBook = SRC.match(/\bbooking_data:\s*([A-Za-z_$][\w$]*)/);
  assert.ok(mData, 'il campo `data` non si scrive più da una variabile');
  assert.ok(mBook, 'il campo `booking_data` non si scrive più da una variabile');
  assert.notEqual(mData[1], mBook[1],
    '`data` e `booking_data` ricevono LO STESSO valore: è il difetto della 216, tornato');
});

test('② `data` è il giorno di OGGI, non quello della partita', () => {
  const m = SRC.match(/\bdata:\s*([A-Za-z_$][\w$]*)/);
  const nome = m[1];
  const dich = SRC.match(new RegExp('const\\s+' + nome + '\\s*=\\s*([^;]+);'));
  assert.ok(dich, 'non trovo da cosa nasce il valore di `data`');
  assert.match(dich[1], /_incassiToday/,
    '`data` non nasce più da _incassiToday: l\'incasso tornerebbe nel giorno della partita');
  assert.ok(!/^\s*opts\.data\b/.test(dich[1].trim()),
    '`data` riparte da opts.data, cioè dal giorno della partita');
});

test('③ `booking_data` resta il giorno della PARTITA, o la scheda perde l\'incasso', () => {
  /* 📏 L'indice che lega pagamento e scheda cerca con `_payNatKey(p.booking_data || p.data, …)`,
     cioè PREFERENDO booking_data. Se qui ci finisse «oggi», la scheda smetterebbe di ritrovarlo. */
  const m = SRC.match(/\bbooking_data:\s*([A-Za-z_$][\w$]*)/);
  const dich = SRC.match(new RegExp('const\\s+' + m[1] + '\\s*=\\s*([^;]+);'));
  assert.ok(dich, 'non trovo da cosa nasce `booking_data`');
  assert.match(dich[1], /opts\.data/,
    '`booking_data` non nasce più dal giorno della prenotazione');
});

test('④ LA CHIAVE RESTA LEGATA ALLO SLOT: l\'idempotenza prima di tutto', () => {
  /* 🚨 È la cura sbagliata più invitante: ora che «oggi» è in una variabile lì accanto, infilarlo
     anche nella chiave sembra coerente. Sarebbe una riga nuova per ogni giorno in cui si ripete
     lo stesso incasso — e sui soldi il doppione non è un fastidio. */
  const m = SRC.match(/_pmoCassaKey\(\s*([A-Za-z_$][\w$]*)/);
  assert.ok(m, 'la chiave non si costruisce più con _pmoCassaKey');
  const mBook = SRC.match(/\bbooking_data:\s*([A-Za-z_$][\w$]*)/);
  assert.equal(m[1], mBook[1],
    'la chiave non usa più il giorno dello SLOT: l\'incasso perde l\'idempotenza fra giorni diversi');
});

test('⑤ NESSUN RIFERIMENTO MORTO: la variabile vecchia non deve restare in giro', () => {
  /* 🩹 Trovato facendo la cura: rinominata `_data`, la chiave continuava a chiamarla — e sarebbe
     esplosa al primo incasso, non al banco. Una rinomina si verifica contando gli usi. */
  const usati = new Set((SRC.match(/\b_[A-Za-z][\w$]*\b/g) || []));
  assert.ok(!usati.has('_data'),
    'la funzione usa ancora `_data`, che non è più dichiarata: ReferenceError al primo incasso');
});

test('⑥ `recorded_at` resta l\'istante vero, che è un\'altra cosa ancora', () => {
  /* ⚖️ Tre tempi diversi e nessuno sostituisce l'altro: il giorno della partita, il giorno di
     cassa, e l'istante esatto della scrittura. Il terzo è quello che permette di ricostruire. */
  assert.match(SRC, /recorded_at:\s*new Date\(\)\.toISOString\(\)/,
    '`recorded_at` non è più l\'istante della scrittura');
});

console.log('\n' + passed + ' verdi, ' + failed + ' rossi');
process.exit(failed ? 1 : 0);
