// Prove della chiusura immediata della copia locale dopo un annullo confermato.
// Esegui:  node supabase/functions/_shared/chiudi-copia-locale.test.ts
import assert from 'node:assert/strict';
import { idsDelleRighe, lapide, righeDelloSlot, type RigaCopia } from './chiudi-copia-locale.ts';

let passed = 0, failed = 0;
function test(nome: string, fn: () => void) {
  try { fn(); passed++; console.log(`ok   - ${nome}`); }
  catch (e) { failed++; console.error(`FAIL - ${nome}\n      ${(e as Error).message}`); }
}

const riga = (tipo: string, data: string, ora: string, campo: string, id?: string): RigaCopia => ({
  record_type: tipo,
  local_key: `${tipo}|${id ?? 'x'}|${data}|${ora}|${campo}`,
  payload: { data, ora, campo, ...(id ? { idReserva: id } : {}) },
});

const SLOT = { data: '2026-08-31', ora: '09:30', campo: 1 };

// ── Quali righe appartengono allo slot ───────────────────────────────────────────────────

test('🚨 il campo si confronta in CIFRE: «Campo 1» e «1» sono lo stesso slot', () => {
  // ⚖️ È il punto che decide se la cura funziona per metà. Le due copie scrivono il campo in
  // due modi, e un confronto sul testo ne seppellirebbe una lasciando l'altra a occupare.
  const righe = [
    riga('booking', '2026-08-31', '09:30', 'Campo 1', '9591'),
    riga('staff_booking', '2026-08-31', '09:30', '1', '9591'),
  ];
  assert.equal(righeDelloSlot(righe, SLOT).length, 2, 'tutte e due, o la cura è finta');
});

test('le righe di un ALTRO slot non si toccano', () => {
  const righe = [
    riga('booking', '2026-08-31', '09:30', 'Campo 1', '9591'),
    riga('booking', '2026-08-31', '11:00', 'Campo 1', '9999'),   // altra ora
    riga('booking', '2026-08-31', '09:30', 'Campo 2', '8888'),   // altro campo
    riga('booking', '2026-09-01', '09:30', 'Campo 1', '7777'),   // altro giorno
  ];
  const mie = righeDelloSlot(righe, SLOT);
  assert.equal(mie.length, 1);
  assert.equal((mie[0].payload as Record<string, unknown>).idReserva, '9591');
});

test('senza data o ora non si seppellisce niente: il verso prudente', () => {
  const righe = [riga('booking', '2026-08-31', '09:30', 'Campo 1', '9591')];
  assert.deepEqual(righeDelloSlot(righe, { data: '', ora: '09:30', campo: 1 }), []);
  assert.deepEqual(righeDelloSlot(righe, { data: '2026-08-31', ora: '', campo: 1 }), []);
});

// ── Gli ids della lapide: il difetto della voce 67 ───────────────────────────────────────

test('🚨 la lapide porta gli ids, o nasconde la prenotazione NUOVA che arriva dopo', () => {
  // 📌 Voce 67, 21/08: una soppressione cieca fece sparire dalla vista la partita che qualcun
  // altro prenotò sullo stesso campo subito dopo l'annullo.
  const mie = [
    riga('booking', '2026-08-31', '09:30', 'Campo 1', '9591'),
    riga('staff_booking', '2026-08-31', '09:30', '1', '9591'),
  ];
  const l = lapide(SLOT, idsDelleRighe(mie), 1_700_000_000_000);
  assert.deepEqual(l.payload.ids, ['9591'], 'una sola prenotazione, non due: le copie sono la stessa');
  assert.ok(Array.isArray(l.payload.ids));
});

test('lo stesso idReserva su più copie si conta una volta sola', () => {
  const mie = [
    riga('booking', '2026-08-31', '09:30', 'Campo 1', '9591'),
    riga('booking_occupancy', '2026-08-31', '09:30', 'Campo 1', '9591'),
    riga('staff_booking', '2026-08-31', '09:30', '1', '9591'),
  ];
  assert.deepEqual(idsDelleRighe(mie), ['9591']);
});

test('una riga senza idReserva non inventa un id', () => {
  assert.deepEqual(idsDelleRighe([riga('staff_booking', '2026-08-31', '09:30', '1')]), []);
});

// ── La forma della lapide: dev'essere quella che il sync sa già leggere ───────────────────

test('⭐ la chiave è quella dell\'app, o il sync non la riconosce', () => {
  // La forma viene da `pmoRecordSoppressione` (index.html): supp|<data>|<campo-in-cifre>|<ora>.
  // Il sync la legge in `slotDichiaratiAnnullati` (voce 73). Una forma nuova sarebbe una
  // dichiarazione che nessuno legge.
  const l = lapide(SLOT, ['9591'], 1_700_000_000_000);
  assert.equal(l.record_type, 'staff_suppress');
  assert.equal(l.local_key, 'supp|2026-08-31|1|09:30');
  assert.equal(l.deleted, false);
});

test('il campo nella lapide è un NUMERO, come lo scrive l\'app', () => {
  assert.equal(lapide({ data: '2026-08-31', ora: '09:30', campo: 'Campo 3' }, [], 1).payload.campo, 3);
  assert.equal(lapide({ data: '2026-08-31', ora: '09:30', campo: '3' }, [], 1).payload.campo, 3);
});

test('l\'istante arriva da fuori: la funzione resta pura e la prova non dipende da quando gira', () => {
  assert.equal(lapide(SLOT, [], 1_700_000_000_000).payload.ts, 1_700_000_000_000);
});

console.log(`\n${passed} passate, ${failed} fallite`);
if (failed > 0) process.exit(1);
