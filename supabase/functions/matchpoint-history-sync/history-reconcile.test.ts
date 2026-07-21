// Test deterministici della riconciliazione storico (nessuna dipendenza esterna).
// Esegui:  node supabase/functions/matchpoint-history-sync/history-reconcile.test.ts
import assert from 'node:assert/strict';
import { planHistoryReconcile, type HistoryRecord } from './history-reconcile.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`ok   - ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL - ${name}\n      ${(e as Error).message}`);
  }
}

const RATIO = 0.4;
const FROM = '2026-06-21';
const TO = '2026-07-21';

// Chiave come la costruisce bookingCloudKey(): history|numero|data|ora|campo|giocatore|durata.
const k = (numero: string, data: string, ora: string, campo: string, chi: string, durata: string) =>
  `history|${numero}|${data}|${ora}|${campo}|${chi}|${durata}`;
const rec = (localKey: string, data: string): HistoryRecord => ({ local_key: localKey, payload: { data } });

const K_VIVA = k('8894', '2026-07-20', '19:30', 'Campo 1', 'serena faoro', '1.5');
const K_DISDETTA = k('8775', '2026-07-20', '19:30', 'Campo 2', 'Pierangela Barbera', '1.5');

// Zavorra: righe presenti sia in archivio sia nel file. Serve perché il freno è una FRAZIONE
// del periodo: su un archivio finto da 2 righe scatterebbe sempre (floor(2*0.4)=0) e
// nasconderebbe proprio il comportamento che questi test devono misurare.
const zavorra = (n: number) => Array.from({ length: n }, (_, i) =>
  k(String(7000 + i), '2026-07-05', '18:00', 'Campo 1', `Riempitivo ${i}`, '1.5'));
const Z = zavorra(20);
const conZavorra = (righe: HistoryRecord[]) => [...righe, ...Z.map(key => rec(key, '2026-07-05'))];

// 1) Caso reale (8775, verificato sul tabellone del 20/07): la riga non è più nel file → ritirata.
test('prenotazione disdetta dentro il periodo viene ritirata', () => {
  const plan = planHistoryReconcile(
    conZavorra([rec(K_VIVA, '2026-07-20'), rec(K_DISDETTA, '2026-07-20')]),
    new Set([K_VIVA, ...Z]),
    FROM, TO, RATIO,
  );
  assert.equal(plan.blocked, false);
  assert.deepEqual(plan.withdrawKeys, [K_DISDETTA]);
});

// 2) ⭐ TARATURA — l'esito OPPOSTO con lo stesso impianto. Se questa prova passasse insieme
//    alla 1) senza distinguere, vorrebbe dire che la funzione ritira "sempre" e il verde della
//    1) non proverebbe niente. Qui il file contiene ANCHE 8775 → non si deve ritirare nulla.
test('TARATURA: se il file contiene ancora la riga, non si ritira nulla', () => {
  const plan = planHistoryReconcile(
    conZavorra([rec(K_VIVA, '2026-07-20'), rec(K_DISDETTA, '2026-07-20')]),
    new Set([K_VIVA, K_DISDETTA, ...Z]),
    FROM, TO, RATIO,
  );
  assert.equal(plan.blocked, false);
  assert.deepEqual(plan.withdrawKeys, []);
});

// 3) Fuori dal periodo il file non parla: la riga resta anche se assente.
test('riga fuori dal periodo NON viene ritirata', () => {
  const vecchia = k('7374', '2026-05-20', '20:00', 'Campo 1', 'Patrizia Zanardo', '1');
  const plan = planHistoryReconcile(
    [rec(K_VIVA, '2026-07-20'), rec(vecchia, '2026-05-20')],
    new Set([K_VIVA]),
    FROM, TO, RATIO,
  );
  assert.deepEqual(plan.withdrawKeys, []);
  assert.equal(plan.windowRows, 1, 'la riga di maggio non deve nemmeno entrare nel denominatore');
});

// 4) Le manutenzioni vengono dal tabellone e nell'Excel non ci sono mai: vanno risparmiate,
//    altrimenti sparirebbero a ogni singolo import.
test('le manutenzioni (namespace manut|) non vengono mai ritirate', () => {
  const manut = 'manut|2026-07-20|08:00|Campo 3|1.5';
  const plan = planHistoryReconcile(
    [rec(K_VIVA, '2026-07-20'), rec(manut, '2026-07-20')],
    new Set([K_VIVA]),
    FROM, TO, RATIO,
  );
  assert.deepEqual(plan.withdrawKeys, []);
  assert.equal(plan.windowRows, 1);
});

// 5) Freno: un export parziale non deve poter svuotare il periodo.
test('export parziale: il ritiro viene sospeso, non eseguito', () => {
  const archivio = Array.from({ length: 10 }, (_, i) =>
    rec(k(String(9000 + i), '2026-07-20', '18:00', 'Campo 1', `Tizio ${i}`, '1.5'), '2026-07-20'));
  // Il file ne riporta solo 5 su 10 → mancherebbero 5, oltre la soglia di 4.
  const fileKeys = new Set(archivio.slice(0, 5).map(r => String(r.local_key)));
  const plan = planHistoryReconcile(archivio, fileKeys, FROM, TO, RATIO);
  assert.equal(plan.blocked, true);
  assert.deepEqual(plan.withdrawKeys, [], 'con il freno tirato non si ritira NIENTE');
});

// 6) Il freno non deve essere troppo timido: esattamente sulla soglia deve lasciar passare.
test('sulla soglia esatta il ritiro passa', () => {
  const archivio = Array.from({ length: 10 }, (_, i) =>
    rec(k(String(9000 + i), '2026-07-20', '18:00', 'Campo 1', `Tizio ${i}`, '1.5'), '2026-07-20'));
  const fileKeys = new Set(archivio.slice(0, 6).map(r => String(r.local_key))); // ne mancano 4 = floor(10*0.4)
  const plan = planHistoryReconcile(archivio, fileKeys, FROM, TO, RATIO);
  assert.equal(plan.blocked, false);
  assert.equal(plan.withdrawKeys.length, 4);
});

// 7) Prenotazione SPOSTATA (caso 7374 del 20/05, e 5979 spostata di campo): la chiave contiene
//    ora/campo/durata, quindi la versione vecchia resta orfana → si ritira lei, e resta la nuova.
test('prenotazione spostata: si ritira la versione vecchia, non la nuova', () => {
  const prima = k('7665', '2026-07-10', '11:30', 'Campo 1', 'Maura Menin', '1');
  const dopo = k('7665', '2026-07-10', '12:30', 'Campo 1', 'Maura Menin', '1');
  const plan = planHistoryReconcile(
    conZavorra([rec(prima, '2026-07-10'), rec(dopo, '2026-07-10')]),
    new Set([dopo, ...Z]),
    FROM, TO, RATIO,
  );
  assert.deepEqual(plan.withdrawKeys, [prima]);
});

// 7-bis) Caso limite documentato, NON un difetto da correggere: su un archivio minuscolo il
//   freno è per forza severo (floor(2*0.4)=0) e sospende anche un ritiro legittimo. Fallisce
//   dalla parte giusta — non toglie — e succede solo dove il periodo ha pochissime righe, cioè
//   dove il danno di una riga stantia è trascurabile. In PROD il periodo ne ha ~900.
test('archivio minuscolo: il freno sospende anche un ritiro legittimo (voluto)', () => {
  const plan = planHistoryReconcile(
    [rec(K_VIVA, '2026-07-20'), rec(K_DISDETTA, '2026-07-20')],
    new Set([K_VIVA]),
    FROM, TO, RATIO,
  );
  assert.equal(plan.blocked, true);
  assert.deepEqual(plan.withdrawKeys, []);
});

// 8) Senza periodo dichiarato non si ritira nulla: non sapremmo su cosa Matchpoint fa fede.
test('senza periodo non si ritira nulla', () => {
  const plan = planHistoryReconcile([rec(K_DISDETTA, '2026-07-20')], new Set(), '', '', RATIO);
  assert.deepEqual(plan.withdrawKeys, []);
  assert.equal(plan.blocked, false);
});

// 9) Archivio vuoto: nessuna divisione per zero, nessun freno scattato a vuoto.
test('archivio vuoto non manda in blocco il freno', () => {
  const plan = planHistoryReconcile([], new Set(), FROM, TO, RATIO);
  assert.equal(plan.blocked, false);
  assert.equal(plan.windowRows, 0);
});

// 10) Gli estremi del periodo sono inclusi (il file copre anche il primo e l'ultimo giorno).
test('gli estremi del periodo sono compresi', () => {
  const primo = k('1', FROM, '09:00', 'Campo 1', 'Tizio', '1');
  const ultimo = k('2', TO, '09:00', 'Campo 1', 'Caio', '1');
  const plan = planHistoryReconcile([rec(primo, FROM), rec(ultimo, TO)], new Set(), FROM, TO, 1);
  assert.equal(plan.windowRows, 2);
  assert.deepEqual(plan.withdrawKeys.sort(), [primo, ultimo].sort());
});

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed) process.exit(1);
