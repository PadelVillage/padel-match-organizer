// «È un cliente del circolo?» — test deterministici, nessuna dipendenza esterna.
// Esegui:  node supabase/functions/consumer-player-readmodel/cliente-del-circolo.test.ts
//
// ⭐ I casi del gruppo 2 NON sono inventati: sono i quattordici valori VERI letti da PROD
// in sola lettura il 2/08/2026 — i residui `PMO-` rimasti nel campo del codice Matchpoint.
// Sono la ragione per cui questo modulo esiste, e provarli con valori finti («PMO-123456»
// scritto a mano) proverebbe la mia idea del difetto invece del difetto.
import assert from 'node:assert/strict';
import { clienteDelCircolo } from './cliente-del-circolo.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`ok   - ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`FAIL - ${name}`);
    console.log(`       ${(e as Error).message.split('\n')[0]}`);
  }
}

// ── 1. Chi è cliente davvero ───────────────────────────────────────────────

test('1. il codice a sei cifre è un cliente del circolo', () => {
  assert.equal(clienteDelCircolo('000004'), true);
  assert.equal(clienteDelCircolo('000140'), true);
  assert.equal(clienteDelCircolo('999999'), true);
});

test('2. gli spazi intorno non cambiano il fatto (il campo arriva da un import)', () => {
  assert.equal(clienteDelCircolo('  000004  '), true);
});

// ── 2. 🚨 I QUATTORDICI RESIDUI VERI DI PROD (2/08/2026) ───────────────────

const RESIDUI_VERI_PROD = [
  'PMO-000326', 'PMO-000927', 'PMO-000934', 'PMO-000935', 'PMO-000937',
  'PMO-000948', 'PMO-000949', 'PMO-011353', 'PMO-042784', 'PMO-048510',
  'PMO-048684', 'PMO-048830', 'PMO-048973', 'PMO-049465',
];

test('3. 🚨 nessuno dei 14 residui `PMO-` di PROD è un cliente del circolo', () => {
  for (const residuo of RESIDUI_VERI_PROD) {
    assert.equal(clienteDelCircolo(residuo), false, `${residuo} non deve poter prenotare`);
  }
  // Il conto è parte del caso: se un giorno la lista si accorcia, il test lo dice.
  assert.equal(RESIDUI_VERI_PROD.length, 14);
});

test('4. 🚨 il difetto che questo modulo ripara: «campo pieno» ≠ «cliente»', () => {
  // Il controllo vecchio era `!!member.memberId`. Su questo valore diceva sì.
  const campoPieno = 'PMO-000933';
  assert.equal(!!campoPieno, true);
  assert.equal(clienteDelCircolo(campoPieno), false);
});

// ── 3. Fail closed su tutto il resto ───────────────────────────────────────

test('5. campo vuoto, assente o nullo: non è un cliente', () => {
  assert.equal(clienteDelCircolo(''), false);
  assert.equal(clienteDelCircolo('   '), false);
  assert.equal(clienteDelCircolo(null), false);
  assert.equal(clienteDelCircolo(undefined), false);
});

test('6. una forma che ASSOMIGLIA al codice non basta', () => {
  assert.equal(clienteDelCircolo('00004'), false);    // cinque cifre
  assert.equal(clienteDelCircolo('0000040'), false);  // sette
  assert.equal(clienteDelCircolo('00 004'), false);   // uno spazio in mezzo
  assert.equal(clienteDelCircolo('00000a'), false);
  assert.equal(clienteDelCircolo('PMO-000523'), false);
});

test('7. l\'ID Padel Village NON è il codice del circolo, e non deve mai passare di qui', () => {
  // È il caso che dà il nome a tutta la faccenda: i due numeri hanno la STESSA forma
  // a sei cifre, e uno dei due ha davanti «PMO-». Se un giorno qualcuno passasse qui
  // l'ID nostro spogliato del prefisso, questo test non lo prenderebbe — lo prende il
  // tipo di chi chiama. Qui si difende almeno la forma completa.
  assert.equal(clienteDelCircolo('PMO-000523'), false);
});

console.log(`\n${passed} ok, ${failed} falliti`);
if (failed > 0) process.exit(1);
