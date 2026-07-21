// Quanti giorni indietro deve arrivare l'export storico.
//
// Perché è un modulo a parte con i suoi test: questo numero decide entro quale periodo
// Matchpoint fa fede, e quindi quali righe di archivio possono essere RITIRATE
// (planHistoryReconcile, history-reconcile.ts). Sbagliarlo per eccesso allargherebbe il
// ritiro a un periodo che l'export non copre davvero; per difetto passerebbe inosservato.
//
// Il caso che conta più di tutti è quello in cui NON viene chiesto niente: la routine
// notturna chiama la function senza corpo, e se qui uscisse un valore diverso dal default
// cambierebbe da sola la finestra di PROD tutte le notti. È il primo test del file.

export const DEFAULT_HISTORY_DAYS = 30;

// Tetto. È lo stesso limite che applica il worker (server.mjs, /export-booking-history:
// Math.min(120, days)) ed è tenuto uguale di proposito, ma il tetto VERO è questo: la edge
// manda al worker anche un fromDate esplicito, che nel worker ha la precedenza su days e
// quindi ne scavalca il clamp. Se non ci fosse qui, non ci sarebbe da nessuna parte.
export const MAX_HISTORY_DAYS = 120;

export type HistoryWindow = {
  /** Giorni effettivamente usati per l'export. */
  days: number;
  /** Quanti ne ha chiesti il chiamante; null = non l'ha chiesto (routine notturna). */
  requested: number | null;
};

/**
 * Legge i giorni richiesti dal corpo della richiesta.
 * Tutto ciò che non è un intero >= 1 (assente, vuoto, testo, booleano, zero, negativo)
 * vale come "non richiesto" e lascia il default: un corpo malformato non deve poter
 * cambiare la finestra di nascosto.
 */
export function resolveHistoryDays(
  raw: unknown,
  defaultDays: number = DEFAULT_HISTORY_DAYS,
  maxDays: number = MAX_HISTORY_DAYS,
): HistoryWindow {
  if (typeof raw !== 'number' && typeof raw !== 'string') {
    return { days: defaultDays, requested: null };
  }
  const text = String(raw).trim();
  if (!text) return { days: defaultDays, requested: null };
  const parsed = Math.floor(Number(text));
  if (!Number.isFinite(parsed) || parsed < 1) return { days: defaultDays, requested: null };
  return { days: Math.min(parsed, maxDays), requested: parsed };
}
