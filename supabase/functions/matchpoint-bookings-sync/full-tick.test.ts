// Test deterministici della decisione full/light (nessuna dipendenza esterna).
// Esegui:  node supabase/functions/matchpoint-bookings-sync/full-tick.test.ts
import assert from 'node:assert/strict';
import {
  decideFullTick,
  RECOVERY_ATTEMPT_COOLDOWN_MS,
  RECOVERY_SUCCESS_AGE_MS,
  type FullTickMarker,
} from './full-tick.ts';

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

// Orari costruiti sui minuti UTC: :05 è fuori finestra orologio, :15 dentro.
const atMinute = (minute: number) => Date.parse(`2026-07-28T10:${String(minute).padStart(2, '0')}:21Z`);
const iso = (ms: number) => new Date(ms).toISOString();
const marker = (m: Partial<FullTickMarker>): FullTickMarker => m;

// 1) La regola dell'orologio resta identica a prima (minuti % 15 < 2).
test('orologio: full ai minuti 0,1,15,16,30,45 — light a 2,14,29', () => {
  for (const m of [0, 1, 15, 16, 30, 31, 45, 46]) {
    const d = decideFullTick({ isManualSync: false, nowMs: atMinute(m), marker: null });
    assert.deepEqual(d, { isFullTick: true, recovered: false }, `minuto ${m}`);
  }
  for (const m of [2, 14, 29, 44, 59]) {
    const d = decideFullTick({ isManualSync: false, nowMs: atMinute(m), marker: null });
    assert.deepEqual(d, { isFullTick: false, recovered: false }, `minuto ${m}`);
  }
});

// 2) Il manuale è SEMPRE light, anche al minuto 0 e anche con marker stantio.
test('manuale: mai full, nemmeno in finestra orologio o con successo vecchio', () => {
  const now = atMinute(0);
  const stale = marker({ lastFullSuccessAt: iso(now - RECOVERY_SUCCESS_AGE_MS - 60_000) });
  assert.deepEqual(decideFullTick({ isManualSync: true, nowMs: now, marker: stale }),
    { isFullTick: false, recovered: false });
});

// 3) Il caso del 28/07: 502 sul giro delle :00 → alle :19 il successo ha 17+ min → recupero.
test('recupero: successo più vecchio di 17 min e nessun tentativo recente → full', () => {
  const now = atMinute(19);
  const m = marker({
    lastFullSuccessAt: iso(now - RECOVERY_SUCCESS_AGE_MS - 1),
    lastFullAttemptAt: iso(now - RECOVERY_SUCCESS_AGE_MS - 1),
  });
  assert.deepEqual(decideFullTick({ isManualSync: false, nowMs: now, marker: m }),
    { isFullTick: true, recovered: true });
});

// 4) Successo fresco → nessun recupero (il ritmo normale non cambia).
test('nessun recupero con successo recente', () => {
  const now = atMinute(12);
  const m = marker({ lastFullSuccessAt: iso(now - 12 * 60_000), lastFullAttemptAt: iso(now - 12 * 60_000) });
  assert.deepEqual(decideFullTick({ isManualSync: false, nowMs: now, marker: m }),
    { isFullTick: false, recovered: false });
});

// 5) Cooldown: giro pieno morto a metà 3 min fa → NON si riprova subito (anti-504).
test('cooldown: tentativo recente blocca il recupero anche con successo stantio', () => {
  const now = atMinute(19);
  const m = marker({
    lastFullSuccessAt: iso(now - RECOVERY_SUCCESS_AGE_MS - 60_000),
    lastFullAttemptAt: iso(now - RECOVERY_ATTEMPT_COOLDOWN_MS + 60_000),
  });
  assert.deepEqual(decideFullTick({ isManualSync: false, nowMs: now, marker: m }),
    { isFullTick: false, recovered: false });
});

// 6) Cooldown scaduto → il recupero riparte (guasto cronico: al massimo un pieno ogni 5 min).
test('cooldown scaduto: recupero consentito', () => {
  const now = atMinute(19);
  const m = marker({
    lastFullSuccessAt: iso(now - RECOVERY_SUCCESS_AGE_MS - 60_000),
    lastFullAttemptAt: iso(now - RECOVERY_ATTEMPT_COOLDOWN_MS - 1),
  });
  assert.deepEqual(decideFullTick({ isManualSync: false, nowMs: now, marker: m }),
    { isFullTick: true, recovered: true });
});

// 7) Marker mai riuscito (solo tentativi): equivale a successo infinitamente vecchio.
test('marker senza successi: recupero dopo il cooldown', () => {
  const now = atMinute(5);
  const recent = marker({ lastFullAttemptAt: iso(now - RECOVERY_ATTEMPT_COOLDOWN_MS + 1) });
  assert.deepEqual(decideFullTick({ isManualSync: false, nowMs: now, marker: recent }),
    { isFullTick: false, recovered: false });
  const old = marker({ lastFullAttemptAt: iso(now - RECOVERY_ATTEMPT_COOLDOWN_MS - 1) });
  assert.deepEqual(decideFullTick({ isManualSync: false, nowMs: now, marker: old }),
    { isFullTick: true, recovered: true });
});

// 8) Marker assente (primo giro dopo il deploy) → solo orologio, nessun recupero.
test('marker assente: fuori orologio resta light', () => {
  assert.deepEqual(decideFullTick({ isManualSync: false, nowMs: atMinute(5), marker: null }),
    { isFullTick: false, recovered: false });
});

// 9) Date malformate nel marker → trattate come assenti (successo stantio, tentativo ignoto).
test('date malformate: si recupera senza esplodere', () => {
  const m = marker({ lastFullSuccessAt: 'non-una-data', lastFullAttemptAt: '' });
  assert.deepEqual(decideFullTick({ isManualSync: false, nowMs: atMinute(5), marker: m }),
    { isFullTick: true, recovered: true });
});

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed > 0) process.exit(1);
