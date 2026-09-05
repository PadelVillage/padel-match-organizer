// Il terzo esito sulle MODIFICHE (voce 118) — test deterministici, nessuna rete.
// Esegui:  node supabase/functions/matchpoint-bookings-edit/esito-modifica.test.ts
//
// ⭐ I casi 6 e 7 sono quelli che proteggono una DECISIONE e non un calcolo: il verso del
// dubbio (tutto ciò che non è certo è ignoto) e il cablaggio (la regola sta PRIMA del punto in
// cui l'errore esce verso il gestionale). Una regola giusta che nessuno chiama resta verde e
// non difende niente.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CODICI_CERTI_MODIFICA,
  codiceDelRifiuto,
  esitoDelRifiutoDiModifica,
  laSchedaEStataToccata,
  PASSI_CHE_SCRIVONO,
  passiDelDiario,
} from './esito-modifica.ts';

const QUI = dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed += 1; console.log(`ok   - ${name}`); }
  catch (e) { failed += 1; console.log(`FAIL - ${name}`); console.log(`       ${(e as Error).message.split('\n')[0]}`); }
}

const rifiuto = (error: string, steps: string[] = [], extra: Record<string, unknown> = {}) =>
  ({ ok: false, error, message: `msg ${error}`, diagnostic: { steps }, ...extra });

test('1. un codice CERTO prima di toccare la scheda → certo', () => {
  for (const c of CODICI_CERTI_MODIFICA) {
    assert.equal(esitoDelRifiutoDiModifica({ status: 500, corpo: rifiuto(c, ['goto_tabellone', 'cerca_evento']) }), 'certo', c);
  }
  assert.equal(esitoDelRifiutoDiModifica({ status: 500, corpo: rifiuto('PRENOTAZIONE_NON_TROVATA', []) }), 'certo');
});

test('2. 📏 il caso del 29/08 e del 01/09: `locator.click: Timeout` senza codice → IGNOTO', () => {
  // Il worker, senza `.code`, mette il MESSAGGIO in `error` (server.mjs: `error.code || error.message`).
  const corpo = rifiuto('locator.click: Timeout 8000ms exceeded.', ['goto_ficha', 'ficha_detected:reserva', 'rimozioni_start:names=1:guest=false', 'elimina:fabiola limuti']);
  assert.equal(codiceDelRifiuto(corpo), '', 'un messaggio non è un codice');
  assert.equal(esitoDelRifiutoDiModifica({ status: 500, corpo }), 'ignoto');
});

test('3. 🚨 un codice CERTO arrivato DOPO un passo che scrive NON è più certo', () => {
  // Il diario vince sulla parola: se «elimina» è stato premuto, la scheda può essere cambiata.
  const corpo = rifiuto('PARAMS_MANCANTI', ['goto_ficha', 'elimina:mario rossi']);
  assert.equal(esitoDelRifiutoDiModifica({ status: 500, corpo }), 'ignoto');
  assert.equal(laSchedaEStataToccata(['add_result:mario rossi:added=true']), true);
  assert.equal(laSchedaEStataToccata(['goto_tabellone', 'cerca_evento', 'goto_ficha', 'ficha_detected:reserva', 'repeater_mode:A', 'open_extender']), false);
});

test('4. i codici che il worker lancia DOPO aver scritto → ignoto, anche con diario vuoto', () => {
  for (const c of ['REMOVE_NON_APPLICATA', 'PLAYER_ADD_INCOMPLETE', 'EDIT_VERIFICA_FALLITA', 'REMOVE_TROPPI_GIRI', 'QUEUE_JOB_TIMEOUT', 'CODICE_CHE_NON_ESISTE_ANCORA']) {
    assert.equal(esitoDelRifiutoDiModifica({ status: 500, corpo: rifiuto(c) }), 'ignoto', c);
  }
});

test('5. gli stati con cui il worker rifiuta senza aver fatto niente → certo; e in sola lettura è sempre certo', () => {
  assert.equal(esitoDelRifiutoDiModifica({ status: 401, corpo: { ok: false, error: 'UNAUTHORIZED' } }), 'certo');
  assert.equal(esitoDelRifiutoDiModifica({ status: 413, corpo: {} }), 'certo');
  assert.equal(esitoDelRifiutoDiModifica({ status: 500, corpo: rifiuto('QUEUE_JOB_TIMEOUT'), readOnly: true }), 'certo');
  // Un corpo che non è JSON (il cancello della piattaforma, una pagina HTML) → nessun codice → ignoto.
  assert.equal(esitoDelRifiutoDiModifica({ status: 502, corpo: null }), 'ignoto');
  assert.deepEqual(passiDelDiario(null), []);
  assert.deepEqual(passiDelDiario({ diagnostic: { steps: 'non un array' } }), []);
});

test('6. ⭐ il verso del dubbio: un rifiuto SENZA codice e SENZA diario è ignoto, non certo', () => {
  assert.equal(esitoDelRifiutoDiModifica({ status: 500, corpo: { ok: false, message: 'boh' } }), 'ignoto');
  // E i passi che scrivono sono un elenco vero, non vuoto: senza, il caso 3 sarebbe verde a vuoto.
  assert.ok(PASSI_CHE_SCRIVONO.length >= 10);
  for (const p of ['elimina:', 'add_result:', 'click_aceptar', 'salva']) assert.ok(PASSI_CHE_SCRIVONO.includes(p), p);
});

test('7. 🚨 CABLAGGIO: `callWorkerEditBooking` marchia `esitoIgnoto` col verdetto, PRIMA di lanciare', () => {
  const src = readFileSync(join(QUI, 'index.ts'), 'utf8');
  const i = src.indexOf('async function callWorkerEditBooking(');
  assert.ok(i > 0, 'callWorkerEditBooking non trovata');
  const fine = src.indexOf('\nasync function ', i + 10);
  const corpo = src.slice(i, fine > 0 ? fine : undefined);
  assert.match(corpo, /esitoDelRifiutoDiModifica\(\{ status: res\.status, corpo: body, readOnly: edit\.read === true \}\)/,
    'il verdetto non viene chiesto sul corpo della risposta del worker');
  const posVerdetto = corpo.indexOf('esitoDelRifiutoDiModifica(');
  const posLancio = corpo.indexOf('Worker error ${res.status}');
  assert.ok(posVerdetto > 0 && posLancio > posVerdetto, 'il verdetto deve stare PRIMA del lancio dell\'errore');
  assert.match(corpo.slice(posVerdetto), /esitoIgnoto = true/, 'il marchio `esitoIgnoto` non viene messo sull\'errore');
  // ⛔ E i passi che scrivono, letti dal worker vero: se un passo sparisce dal worker la guardia
  //    qui deve saperlo. Si controlla che ogni prefisso esista in server.mjs.
  const worker = readFileSync(join(QUI, '..', '..', '..', 'tools', 'matchpoint-browser-worker', 'src', 'server.mjs'), 'utf8');
  for (const p of PASSI_CHE_SCRIVONO) {
    const radice = p.replace(/[:_]$/, '');
    assert.ok(worker.includes(`'${radice}`) || worker.includes('`' + radice), `il passo «${p}» non esiste (più) nel worker`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
