// Riconciliazione dell'archivio storico con l'export Matchpoint.
//
// Perché serve: l'import storico era CUMULATIVO — aggiungeva le righe nuove e non toccava mai
// quelle già presenti. Due conseguenze, entrambe verificate in PROD il 21/07/2026:
//   1) una prenotazione DISDETTA restava in archivio per sempre (~2-3 al giorno: sono quelle
//      annullate dopo l'import del mattino, che l'import successivo non sa togliere);
//   2) una prenotazione SPOSTATA finiva in archivio DUE volte, perché la chiave del record
//      (bookingCloudKey) contiene ora/campo/durata: lo spostamento genera una chiave nuova e
//      lascia indietro quella vecchia. 34 righe duplicate trovate, con la stessa persona su due
//      campi alla stessa ora.
// Lo storico alimenta playerHistoricalStats e il registro disponibilità, quindi l'errore non
// restava nell'archivio: si propagava ai suggerimenti dell'assistente.
//
// Regola: dentro il periodo che il file copre DAVVERO, Matchpoint fa fede. Fuori dal periodo
// non si tocca niente — quel file non ne parla, e togliere righe lì vorrebbe dire buttare via
// storia buona.
//
// Modulo puro (niente rete, niente Supabase): la parte che decide COSA SPARISCE deve essere
// provabile in isolamento, compreso il caso in cui NON deve sparire nulla.

export type HistoryRecord = {
  local_key?: string;
  payload?: { data?: string } | null;
};

export type ReconcilePlan = {
  /** Chiavi da ritirare (deleted:true, reversibile). Vuoto se il freno è scattato. */
  withdrawKeys: string[];
  /** Quante righe di archivio cadono nel periodo: è il denominatore del freno. */
  windowRows: number;
  /** true = ritiro sospeso perché l'export sembra parziale. */
  blocked: boolean;
};

const clean = (value: unknown) => String(value ?? '').trim();

/**
 * Decide quali righe di archivio ritirare confrontandole con le chiavi presenti nel file.
 *
 * @param existingRecords archivio attuale (tutti i booking_history non cancellati)
 * @param fileKeys        chiavi calcolate sulle righe del file appena scaricato
 * @param windowFrom      primo giorno coperto dal file (ISO)
 * @param windowTo        ultimo giorno coperto dal file (ISO)
 * @param maxWithdrawRatio frazione massima di righe del periodo che si accetta di ritirare
 */
export function planHistoryReconcile(
  existingRecords: HistoryRecord[],
  fileKeys: Set<string>,
  windowFrom: string,
  windowTo: string,
  maxWithdrawRatio: number,
): ReconcilePlan {
  const from = clean(windowFrom);
  const to = clean(windowTo);
  // Senza un periodo dichiarato non si ritira nulla: non sapremmo su cosa Matchpoint fa fede.
  if (!from || !to) return { withdrawKeys: [], windowRows: 0, blocked: false };

  const windowRecords = (existingRecords || []).filter((record) => {
    // Solo il namespace 'history|': le manutenzioni ('manut|') arrivano dal tabellone e
    // nell'Excel non compaiono mai — senza questo filtro verrebbero ritirate a ogni giro.
    if (!clean(record?.local_key).startsWith('history|')) return false;
    const data = clean(record?.payload?.data);
    return !!data && data >= from && data <= to;
  });

  const withdraw = windowRecords.filter((record) => !fileKeys.has(clean(record?.local_key)));
  // Freno: un export venuto male non deve poter svuotare il periodo. Le righe nuove e gli
  // aggiornamenti passano lo stesso — si rinuncia soltanto a togliere.
  const blocked = withdraw.length > Math.floor(windowRecords.length * maxWithdrawRatio);

  return {
    withdrawKeys: blocked ? [] : withdraw.map((record) => clean(record?.local_key)),
    windowRows: windowRecords.length,
    blocked,
  };
}
