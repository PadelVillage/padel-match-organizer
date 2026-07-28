// Test deterministici della decisione full/near/light (nessuna dipendenza esterna).
// Esegui:  node supabase/functions/matchpoint-bookings-sync/full-tick.test.ts
import assert from 'node:assert/strict';
import {
  decideTick,
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

// Orari costruiti sui minuti UTC: :05 è near, :15 è full, :07 è light.
const atMinute = (minute: number) => Date.parse(`2026-07-28T10:${String(minute).padStart(2, '0')}:21Z`);
const iso = (ms: number) => new Date(ms).toISOString();
const marker = (m: Partial<FullTickMarker>): FullTickMarker => m;
// Marker "in regola": successo fresco → né recupero né interferenze coi casi a orologio.
const freshMarker = (now: number) => marker({ lastFullSuccessAt: iso(now - 3 * 60_000), lastFullAttemptAt: iso(now - 3 * 60_000) });

// 1) La regola dell'orologio del giro PIENO resta identica a prima (minuti % 15 < 2).
test('orologio: full ai minuti 0,1,15,16,30,45 anche con marker fresco', () => {
  for (const m of [0, 1, 15, 16, 30, 31, 45, 46]) {
    const now = atMinute(m);
    const d = decideTick({ isManualSync: false, nowMs: now, marker: freshMarker(now) });
    assert.deepEqual(d, { kind: 'full', recovered: false }, `minuto ${m}`);
  }
});

// 2) Il tick NEAR: minuti %5<2 fuori dai quarti d'ora — e SOLO quelli.
test('orologio: near a 5,6,10,20,35,50 — light a 2,7,14,29,59', () => {
  for (const m of [5, 6, 10, 11, 20, 25, 35, 40, 50, 55]) {
    const now = atMinute(m);
    const d = decideTick({ isManualSync: false, nowMs: now, marker: freshMarker(now) });
    assert.deepEqual(d, { kind: 'near', recovered: false }, `minuto ${m}`);
  }
  for (const m of [2, 4, 7, 14, 22, 29, 44, 59]) {
    const now = atMinute(m);
    const d = decideTick({ isManualSync: false, nowMs: now, marker: freshMarker(now) });
    assert.deepEqual(d, { kind: 'light', recovered: false }, `minuto ${m}`);
  }
});

// 3) Il manuale è SEMPRE light, anche al minuto 0/5 e anche con marker stantio.
test('manuale: mai full né near, nemmeno in finestra o con successo vecchio', () => {
  for (const m of [0, 5]) {
    const now = atMinute(m);
    const stale = marker({ lastFullSuccessAt: iso(now - RECOVERY_SUCCESS_AGE_MS - 60_000) });
    assert.deepEqual(decideTick({ isManualSync: true, nowMs: now, marker: stale }),
      { kind: 'light', recovered: false }, `minuto ${m}`);
  }
});

// 4) Il caso del 28/07: 502 sul giro delle :00 → alle :19 il successo ha 17+ min → recupero.
test('recupero: successo più vecchio di 17 min e nessun tentativo recente → full', () => {
  const now = atMinute(19);
  const m = marker({
    lastFullSuccessAt: iso(now - RECOVERY_SUCCESS_AGE_MS - 1),
    lastFullAttemptAt: iso(now - RECOVERY_SUCCESS_AGE_MS - 1),
  });
  assert.deepEqual(decideTick({ isManualSync: false, nowMs: now, marker: m }),
    { kind: 'full', recovered: true });
});

// 5) Il recupero VINCE sul near: al minuto 5 con marker stantio serve il giro pieno
//    (un giro da 7 giorni lascerebbe stantia la manutenzione oltre la finestra).
test('recupero al minuto near: full recovered, non near', () => {
  const now = atMinute(5);
  const m = marker({
    lastFullSuccessAt: iso(now - RECOVERY_SUCCESS_AGE_MS - 60_000),
    lastFullAttemptAt: iso(now - RECOVERY_SUCCESS_AGE_MS - 60_000),
  });
  assert.deepEqual(decideTick({ isManualSync: false, nowMs: now, marker: m }),
    { kind: 'full', recovered: true });
});

// 6) Successo fresco → nessun recupero: il ritmo normale non cambia.
test('nessun recupero con successo recente', () => {
  const now = atMinute(12);
  assert.deepEqual(decideTick({ isManualSync: false, nowMs: now, marker: freshMarker(now) }),
    { kind: 'light', recovered: false });
});

// 7) Cooldown: giro pieno morto a metà 3 min fa → NON si riprova subito (anti-504),
//    ma il tick resta utile: al minuto near degrada a near, altrove a light.
test('cooldown: tentativo recente blocca il recupero (light a :19, near a :05)', () => {
  const mk = (now: number) => marker({
    lastFullSuccessAt: iso(now - RECOVERY_SUCCESS_AGE_MS - 60_000),
    lastFullAttemptAt: iso(now - RECOVERY_ATTEMPT_COOLDOWN_MS + 60_000),
  });
  const at19 = atMinute(19);
  assert.deepEqual(decideTick({ isManualSync: false, nowMs: at19, marker: mk(at19) }),
    { kind: 'light', recovered: false });
  const at5 = atMinute(5);
  assert.deepEqual(decideTick({ isManualSync: false, nowMs: at5, marker: mk(at5) }),
    { kind: 'near', recovered: false });
});

// 8) Cooldown scaduto → il recupero riparte (guasto cronico: al massimo un pieno ogni 5 min).
test('cooldown scaduto: recupero consentito', () => {
  const now = atMinute(19);
  const m = marker({
    lastFullSuccessAt: iso(now - RECOVERY_SUCCESS_AGE_MS - 60_000),
    lastFullAttemptAt: iso(now - RECOVERY_ATTEMPT_COOLDOWN_MS - 1),
  });
  assert.deepEqual(decideTick({ isManualSync: false, nowMs: now, marker: m }),
    { kind: 'full', recovered: true });
});

// 9) Marker mai riuscito (solo tentativi): equivale a successo infinitamente vecchio.
test('marker senza successi: recupero dopo il cooldown', () => {
  const now = atMinute(7);
  const recent = marker({ lastFullAttemptAt: iso(now - RECOVERY_ATTEMPT_COOLDOWN_MS + 1) });
  assert.deepEqual(decideTick({ isManualSync: false, nowMs: now, marker: recent }),
    { kind: 'light', recovered: false });
  const old = marker({ lastFullAttemptAt: iso(now - RECOVERY_ATTEMPT_COOLDOWN_MS - 1) });
  assert.deepEqual(decideTick({ isManualSync: false, nowMs: now, marker: old }),
    { kind: 'full', recovered: true });
});

// 10) Marker assente (primo giro dopo il deploy) → solo orologio, nessun recupero.
test('marker assente: fuori orologio resta light (e near resta near)', () => {
  assert.deepEqual(decideTick({ isManualSync: false, nowMs: atMinute(7), marker: null }),
    { kind: 'light', recovered: false });
  assert.deepEqual(decideTick({ isManualSync: false, nowMs: atMinute(5), marker: null }),
    { kind: 'near', recovered: false });
});

// 11) Date malformate nel marker → trattate come assenti (successo stantio, tentativo ignoto).
test('date malformate: si recupera senza esplodere', () => {
  const m = marker({ lastFullSuccessAt: 'non-una-data', lastFullAttemptAt: '' });
  assert.deepEqual(decideTick({ isManualSync: false, nowMs: atMinute(7), marker: m }),
    { kind: 'full', recovered: true });
});

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed > 0) process.exit(1);
