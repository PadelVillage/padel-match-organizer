// Test deterministici della risoluzione idReserva (nessuna dipendenza esterna).
// Esegui:  node supabase/functions/matchpoint-bookings-sync/idreserva-resolve.test.ts
import assert from 'node:assert/strict';
import { resolveIdReserva } from './idreserva-resolve.ts';

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

// ── Il caso che ha motivato il fix ────────────────────────────────────────────────────────────────
test('buco reale: niente tabellone, niente sticky (rotazione del rappresentante) → ripiego sul numero', () => {
  // Campo 1 21:00 del 16/07: il testimone passa a Mauro Schincariol, la cui riga era tombstonata →
  // nessuno sticky; il tabellone non aggancia lo slot in quel giro. Prima del fix: nessun id → 🔒.
  const r = resolveIdReserva({ tabellone: '', sticky: '', numero: '8888' });
  assert.equal(r.id, '8888');
  assert.equal(r.source, 'numero');
});

// ── La priorità: il numero è RIPIEGO, mai autorità ────────────────────────────────────────────────
test('il tabellone vince sempre sul numero (anche quando divergono)', () => {
  // Le 22 occupancy storiche divergenti: il fix NON deve cambiarne l'esito.
  const r = resolveIdReserva({ tabellone: '8311', sticky: '', numero: '8277' });
  assert.equal(r.id, '8311');
  assert.equal(r.source, 'tabellone');
});

test('il tabellone vince anche sullo sticky', () => {
  const r = resolveIdReserva({ tabellone: '8888', sticky: '7777', numero: '8888' });
  assert.equal(r.id, '8888');
  assert.equal(r.source, 'tabellone');
});

test('lo sticky vince sul numero (il ripiego non scavalca un id già noto)', () => {
  const r = resolveIdReserva({ tabellone: '', sticky: '8311', numero: '8277' });
  assert.equal(r.id, '8311');
  assert.equal(r.source, 'sticky');
});

test('caso normale: i tre concordano → tabellone, nessun cambio di comportamento', () => {
  const r = resolveIdReserva({ tabellone: '8888', sticky: '8888', numero: '8888' });
  assert.equal(r.id, '8888');
  assert.equal(r.source, 'tabellone');
});

// ── Ciò che il fix NON deve toccare ───────────────────────────────────────────────────────────────
test('manutenzione (numero vuoto, nessun id) → nessun id inventato', () => {
  // I blocchi manutenzione non sono nell'export: numero:''. Restano senza id, il worker li risolve
  // dalla terna campo+data+ora. Un id inventato qui mirerebbe alla ficha sbagliata.
  const r = resolveIdReserva({ tabellone: '', sticky: '', numero: '' });
  assert.equal(r.id, '');
  assert.equal(r.source, 'nessuno');
});

test('manutenzione già agganciata dal tabellone → tiene il suo id', () => {
  const r = resolveIdReserva({ tabellone: '9001', sticky: '', numero: '' });
  assert.equal(r.id, '9001');
  assert.equal(r.source, 'tabellone');
});

// ── Robustezza degli input (i payload cloud arrivano da JSON) ─────────────────────────────────────
test('null/undefined non contano come id', () => {
  assert.equal(resolveIdReserva({ tabellone: null, sticky: undefined, numero: '8888' }).source, 'numero');
  assert.equal(resolveIdReserva({}).source, 'nessuno');
});

test('gli spazi non contano come id, e i valori vengono normalizzati a stringa', () => {
  assert.equal(resolveIdReserva({ tabellone: '   ', sticky: '', numero: ' 8888 ' }).id, '8888');
  assert.equal(resolveIdReserva({ tabellone: 8888 }).id, '8888');
});

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed > 0) process.exit(1);
