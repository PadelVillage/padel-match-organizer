// Decisione tick "full" vs "light" del sync prenotazioni (pura, senza IO).
//
// Regola storica (invariata): il tick è full quando i minuti UTC % 15 < 2 — con il cron
// ogni 2 minuti fa un giro pieno ogni quarto d'ora. Problema (28/07/2026): se PROPRIO quel
// giro salta (es. 502 del gateway prima ancora di partire), la manutenzione e le lezioni
// senza giocatori aspettano il quarto d'ora successivo → fino a ~30 minuti di buco.
//
// RECUPERO: se l'ultimo giro pieno RIUSCITO è più vecchio del previsto, il primo tick
// utile diventa pieno anche fuori orologio. Due paracadute, entrambi necessari:
//  • il recupero guarda i SUCCESSI, non i tentativi → copre sia il 502 (mai partito)
//    sia il giro morto a metà (timeout);
//  • il cooldown sui TENTATIVI evita che un guasto cronico del tabellone trasformi ogni
//    tick in un giro pieno — la protezione anti-504 del decoupling resta in piedi.
// Il marker vive in pmo_cloud_records (matchpoint_data / matchpoint_bookings_full_tick_last);
// se non è leggibile si torna alla sola regola dell'orologio (comportamento di prima).

export const FULL_TICK_MARKER_KEY = 'matchpoint_bookings_full_tick_last';

// Un giro pieno riuscito più vecchio di così = un quarto d'ora è saltato (15 min di
// cadenza + margine per la durata del giro stesso, ~2 min).
export const RECOVERY_SUCCESS_AGE_MS = 17 * 60_000;
// Fra due TENTATIVI di giro pieno fuori orologio devono passare almeno 5 minuti.
export const RECOVERY_ATTEMPT_COOLDOWN_MS = 5 * 60_000;

export type FullTickMarker = {
  lastFullAttemptAt?: string;
  lastFullSuccessAt?: string;
};

export type FullTickDecision = {
  isFullTick: boolean;
  // true solo quando il giro pieno nasce dal recupero (fuori orologio).
  recovered: boolean;
};

function parseMs(value: string | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function decideFullTick(opts: {
  isManualSync: boolean;
  nowMs: number;
  marker: FullTickMarker | null;
}): FullTickDecision {
  const { isManualSync, nowMs, marker } = opts;
  // Il manuale ("Aggiorna prenotazioni") resta SEMPRE light: all'operatore servono le
  // prenotazioni subito, non la manutenzione.
  if (isManualSync) return { isFullTick: false, recovered: false };

  if (new Date(nowMs).getUTCMinutes() % 15 < 2) return { isFullTick: true, recovered: false };

  // Recupero: serve il marker (senza, primo giro dopo il deploy: solo orologio, che lo crea).
  if (!marker) return { isFullTick: false, recovered: false };

  const successMs = parseMs(marker.lastFullSuccessAt);
  const attemptMs = parseMs(marker.lastFullAttemptAt);

  // Un successo recente chiude la questione. Un marker senza MAI un successo (solo
  // tentativi) equivale a "successo infinitamente vecchio": si recupera, col cooldown.
  const successStale = successMs === null || nowMs - successMs > RECOVERY_SUCCESS_AGE_MS;
  if (!successStale) return { isFullTick: false, recovered: false };

  const attemptRecent = attemptMs !== null && nowMs - attemptMs < RECOVERY_ATTEMPT_COOLDOWN_MS;
  if (attemptRecent) return { isFullTick: false, recovered: false };

  return { isFullTick: true, recovered: true };
}
