// Test deterministici della finestra dello storico (nessuna dipendenza esterna).
// Esegui:  node supabase/functions/matchpoint-history-sync/history-window.test.ts
import assert from 'node:assert/strict';
import { resolveHistoryDays, DEFAULT_HISTORY_DAYS, MAX_HISTORY_DAYS } from './history-window.ts';

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

// 1) ⭐ Il caso della routine notturna: nessun corpo, nessun parametro. Deve restare 30.
//    È il test che protegge PROD: una regressione qui sposterebbe la finestra ogni notte.
test('senza richiesta si usa il default (routine notturna)', () => {
  assert.deepEqual(resolveHistoryDays(undefined), { days: 30, requested: null });
  assert.equal(DEFAULT_HISTORY_DAYS, 30);
});

// 2) ⭐ TARATURA — l'esito OPPOSTO con la stessa funzione: qui i giorni sono chiesti davvero.
//    Se il 1) passasse perché la funzione ignora SEMPRE l'ingresso, questo fallirebbe.
test('TARATURA: i giorni chiesti vengono usati davvero', () => {
  assert.deepEqual(resolveHistoryDays(70), { days: 70, requested: 70 });
});

// 3) ⭐ Chiedere esplicitamente 30 non è come non chiedere niente: `requested` lo distingue,
//    ed è quello che finisce nel riepilogo dell'import.
test('30 chiesto esplicitamente resta distinguibile dal default', () => {
  assert.deepEqual(resolveHistoryDays(30), { days: 30, requested: 30 });
});

test('il tetto taglia le richieste esagerate ma lascia la traccia', () => {
  assert.deepEqual(resolveHistoryDays(365), { days: MAX_HISTORY_DAYS, requested: 365 });
  assert.equal(MAX_HISTORY_DAYS, 120);
});

test('il tetto lascia passare il valore esatto', () => {
  assert.deepEqual(resolveHistoryDays(120), { days: 120, requested: 120 });
});

// 4) I segreti e i parametri passano da JSON scritto a mano (net.http_post da SQL): un
//    numero puo arrivare come testo.
test('numero scritto come testo', () => {
  assert.deepEqual(resolveHistoryDays('70'), { days: 70, requested: 70 });
  assert.deepEqual(resolveHistoryDays(' 70 '), { days: 70, requested: 70 });
});

test('i decimali si troncano', () => {
  assert.deepEqual(resolveHistoryDays(45.9), { days: 45, requested: 45 });
});

// 5) Tutto cio che non e un intero >= 1 vale come "non richiesto": un corpo malformato non
//    deve poter cambiare la finestra di nascosto, ne in piu ne in meno.
test('valori non validi lasciano il default', () => {
  for (const raw of [null, '', '   ', 'abc', '70abc', true, false, 0, -5, NaN, Infinity, {}, []]) {
    assert.deepEqual(
      resolveHistoryDays(raw),
      { days: 30, requested: null },
      `atteso il default per ${JSON.stringify(raw)}`,
    );
  }
});

test('default e tetto restano sovrascrivibili dal chiamante', () => {
  assert.deepEqual(resolveHistoryDays(undefined, 7, 10), { days: 7, requested: null });
  assert.deepEqual(resolveHistoryDays(99, 7, 10), { days: 10, requested: 99 });
});

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed) process.exit(1);
