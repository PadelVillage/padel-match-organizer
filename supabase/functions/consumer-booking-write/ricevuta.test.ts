// Prove della composizione delle ricevute (voce 70).
// Esegui:  node supabase/functions/consumer-booking-write/ricevuta.test.ts
import assert from 'node:assert/strict';
import { chiaveSlot, righeRicevuta } from './ricevuta.ts';

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

const base = { azione: 'add', richiestaDa: 'Maurizio Aprea', data: '2026-08-31', ora: '11:00', campo: 1 };

test('una riga per persona toccata', () => {
  const r = righeRicevuta({ ...base, gesti: [{ persona: 'Lidia Comes', gesto: 'aggiunto' }] });
  assert.equal(r.length, 1);
  assert.equal(r[0].persona, 'Lidia Comes');
  assert.equal(r[0].gesto, 'aggiunto');
  assert.equal(r[0].azione, 'add');
  assert.equal(r[0].richiesta_da, 'Maurizio Aprea');
});

test('la chiave dello slot tiene solo le cifre del campo', () => {
  assert.equal(chiaveSlot('2026-08-31', '11:00', 'Campo 3'), '2026-08-31|11:00|3');
  assert.equal(chiaveSlot('2026-08-31', '11:00', 3), '2026-08-31|11:00|3');
});

test('un annullamento tocca tutto il roster', () => {
  const r = righeRicevuta({
    ...base, azione: 'cancel',
    gesti: ['Maurizio Aprea', 'Lidia Comes', 'Fabiola Neri'].map((persona) => ({ persona, gesto: 'annullata' as const })),
  });
  assert.equal(r.length, 3);
  assert.ok(r.every((x) => x.gesto === 'annullata'));
});

test('🚨 gli Ospiti non producono ricevute: dietro non c\'è nessuno da avvisare', () => {
  const r = righeRicevuta({
    ...base, azione: 'cancel',
    gesti: [
      { persona: 'Maurizio Aprea', gesto: 'annullata' },
      { persona: 'Ospite', gesto: 'annullata' },
      { persona: '  ospite ', gesto: 'annullata' },
    ],
  });
  assert.equal(r.length, 1);
  assert.equal(r[0].persona, 'Maurizio Aprea');
});

test('tre Ospiti non diventano una riga vuota', () => {
  const r = righeRicevuta({ ...base, gesti: [{ persona: 'Ospite', gesto: 'aggiunto' }] });
  assert.equal(r.length, 0);
});

test('i nomi vuoti si scartano', () => {
  const r = righeRicevuta({ ...base, gesti: [{ persona: '   ', gesto: 'aggiunto' }] });
  assert.equal(r.length, 0);
});

test('lo stesso nome ripetuto nel roster non fa due ricevute', () => {
  const r = righeRicevuta({
    ...base, azione: 'cancel',
    gesti: [
      { persona: 'Lidia Comes', gesto: 'annullata' },
      { persona: 'lidia  comes', gesto: 'annullata' },
    ],
  });
  assert.equal(r.length, 1, 'la stessa partita arriva su più righe sincronizzate');
});

test('lo stesso nome con DUE gesti diversi fa due ricevute', () => {
  const r = righeRicevuta({
    ...base, gesti: [
      { persona: 'Lidia Comes', gesto: 'tolto' },
      { persona: 'Lidia Comes', gesto: 'aggiunto' },
    ],
  });
  assert.equal(r.length, 2);
});

test('il nome si conserva COME SCRITTO: la normalizzazione serve a confrontare, non a mostrare', () => {
  const r = righeRicevuta({ ...base, gesti: [{ persona: 'Niccolò Dè Rossi', gesto: 'aggiunto' }] });
  assert.equal(r[0].persona, 'Niccolò Dè Rossi');
});

test('nessun gesto, nessuna riga — e non si rompe niente', () => {
  assert.equal(righeRicevuta({ ...base, gesti: [] }).length, 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
