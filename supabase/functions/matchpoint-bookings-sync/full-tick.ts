// Decisione del TIPO di tick del sync prenotazioni (pura, senza IO): full / near / light.
//
// Regola storica (invariata): il tick è FULL quando i minuti UTC % 15 < 2 — con il cron
// ogni 2 minuti fa un giro pieno (31 gg di tabellone) ogni quarto d'ora. Problema
// (28/07/2026): se PROPRIO quel giro salta (es. 502 del gateway prima ancora di partire),
// la manutenzione e le lezioni senza giocatori aspettano il quarto d'ora successivo →
// fino a ~30 minuti di buco.
//
// RECUPERO: se l'ultimo giro pieno RIUSCITO è più vecchio del previsto, il primo tick
// utile diventa pieno anche fuori orologio. Due paracadute, entrambi necessari:
//  • il recupero guarda i SUCCESSI, non i tentativi → copre sia il 502 (mai partito)
//    sia il giro morto a metà (timeout);
//  • il cooldown sui TENTATIVI evita che un guasto cronico del tabellone trasformi ogni
//    tick in un giro pieno — la protezione anti-504 del decoupling resta in piedi.
// Il marker vive in pmo_cloud_records (matchpoint_data / matchpoint_bookings_full_tick_last);
// se non è leggibile si torna alla sola regola dell'orologio (comportamento di prima).
//
// NEAR (28/07, «compromesso dei 7 giorni»): ai minuti %5<2 fuori dai quarti d'ora il tick
// legge il tabellone dei prossimi NEAR_WINDOW_DAYS giorni → una manutenzione della
// settimana in corso appare entro ~5 minuti invece di 15. Costa poco: i giorni PRENOTATI
// della finestra si scrapano già a ogni light — i near aggiungono solo i giorni vuoti.

export const FULL_TICK_MARKER_KEY = 'matchpoint_bookings_full_tick_last';

// Finestra del tick "near": oggi..+7 giorni di tabellone (manutenzione compresa).
export const NEAR_WINDOW_DAYS = 7;

// Un giro pieno riuscito più vecchio di così = un quarto d'ora è saltato (15 min di
// cadenza + margine per la durata del giro stesso, ~2 min).
export const RECOVERY_SUCCESS_AGE_MS = 17 * 60_000;
// Fra due TENTATIVI di giro pieno fuori orologio devono passare almeno 5 minuti.
export const RECOVERY_ATTEMPT_COOLDOWN_MS = 5 * 60_000;

export type FullTickMarker = {
  lastFullAttemptAt?: string;
  lastFullSuccessAt?: string;
};

export type TickKind = 'full' | 'near' | 'light';

export type TickDecision = {
  kind: TickKind;
  // true solo quando il giro pieno nasce dal recupero (fuori orologio).
  recovered: boolean;
};

function parseMs(value: string | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function decideTick(opts: {
  isManualSync: boolean;
  nowMs: number;
  marker: FullTickMarker | null;
}): TickDecision {
  const { isManualSync, nowMs, marker } = opts;
  // Il manuale ("Aggiorna prenotazioni") resta SEMPRE light: all'operatore servono le
  // prenotazioni subito, non la manutenzione.
  if (isManualSync) return { kind: 'light', recovered: false };

  const minutes = new Date(nowMs).getUTCMinutes();
  if (minutes % 15 < 2) return { kind: 'full', recovered: false };

  // Recupero PRIMA del near: se un quarto d'ora è saltato, un giro da 7 giorni non basta
  // (la manutenzione oltre la finestra resterebbe stantia) → si recupera col giro pieno.
  // Serve il marker (senza, primo giro dopo il deploy: solo orologio, che lo crea).
  if (marker) {
    const successMs = parseMs(marker.lastFullSuccessAt);
    const attemptMs = parseMs(marker.lastFullAttemptAt);

    // Un successo recente chiude la questione. Un marker senza MAI un successo (solo
    // tentativi) equivale a "successo infinitamente vecchio": si recupera, col cooldown.
    const successStale = successMs === null || nowMs - successMs > RECOVERY_SUCCESS_AGE_MS;
    const attemptRecent = attemptMs !== null && nowMs - attemptMs < RECOVERY_ATTEMPT_COOLDOWN_MS;
    if (successStale && !attemptRecent) return { kind: 'full', recovered: true };
  }

  if (minutes % 5 < 2) return { kind: 'near', recovered: false };

  return { kind: 'light', recovered: false };
}
