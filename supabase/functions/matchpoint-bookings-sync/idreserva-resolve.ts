// Risoluzione dell'idReserva di una occupancy (modulo puro, testato: idreserva-resolve.test.ts).
//
// PERCHÉ ESISTE (fix «🔒 manca l'idReserva», 16/07/2026). L'idReserva è la chiave con cui il worker
// mira alla ficha Matchpoint: senza, l'app non promuove la prenotazione e la scheda non è
// modificabile. Arrivava SOLO dallo scrape del tabellone, che è non-deterministico (vedi il commento
// STICKY in index.ts): quando non aggancia lo slot, l'occupancy nasce senza id e resta bloccata
// finché un giro successivo non lo riempie. Caso reale: Campo 1 21:00 del 16/07, bloccata 16:32→16:44.
//
// Lo sticky (eredita l'id dal record precedente dello stesso slot) non copre il caso peggiore:
// l'export dà UNA RIGA PER GIOCATORE e la chiave cloud include il nome dell'intestatario
// (bookingCloudKey), quindi quando il "rappresentante" dello slot ruota su un altro giocatore il
// record precedente non esiste — la mappa carica solo i record attivi — e non c'è nulla da ereditare.
//
// Il `numero` dell'export non ha nessuno di questi problemi: c'è sempre, è deterministico, e COINCIDE
// con l'idReserva (verificato il 16/07/2026 sui record reali: 113/113 occupancy attive in PROD,
// 107/107 in TEST, 1415 storiche; le 22 storiche divergenti sono tutte di giugno, tombstonate e
// incoerenti tra loro — errori dello scrape, non prove che i due id possano differire).
//
// PRIORITÀ (scelta deliberata: il numero è RIPIEGO, non autorità). Finché il log
// `idreserva_numero_mismatch` non conferma sul campo l'invariante, il valore letto dal tabellone
// vince sempre: così questo fix può solo RIEMPIRE buchi che oggi restano vuoti, mai cambiare un id
// già presente (un id sbagliato farebbe modificare la prenotazione di un altro).
//
//   1. tabellone → autorità
//   2. sticky    → id già noto per lo stesso record (assorbe i giri in cui il tabellone non aggancia)
//   3. numero    → ripiego dall'export
//   4. nessuno   → manutenzione (numero:'') e slot senza id: invariato, se ne occupa la terna worker

export type IdReservaSource = 'tabellone' | 'sticky' | 'numero' | 'nessuno';

export interface IdReservaInput {
  /** id letto dallo scrape del tabellone in questo giro (autorità). */
  tabellone?: unknown;
  /** id già presente sul record cloud dello stesso slot (giro precedente). */
  sticky?: unknown;
  /** colonna `Numero` dell'export Matchpoint. Vuoto per la manutenzione. */
  numero?: unknown;
}

const clean = (value: unknown) => String(value ?? '').trim();

export function resolveIdReserva(input: IdReservaInput): { id: string; source: IdReservaSource } {
  const tabellone = clean(input?.tabellone);
  if (tabellone) return { id: tabellone, source: 'tabellone' };
  const sticky = clean(input?.sticky);
  if (sticky) return { id: sticky, source: 'sticky' };
  const numero = clean(input?.numero);
  if (numero) return { id: numero, source: 'numero' };
  return { id: '', source: 'nessuno' };
}
