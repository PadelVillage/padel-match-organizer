/* esito-prenotazione.js — I TRE ESITI, in JavaScript e per la stessa ragione di `conoscenza.js`.
 *
 * Qui vive la decisione della voce 23: come si chiama ciò che è successo quando si è chiesto al
 * worker di prenotare. Sta in un modulo a sé, e in `.js`, per due motivi che si tengono:
 *
 *   · è una REGOLA PURA — nessuna rete, nessun database, nessun `Deno` — quindi si può eseguire
 *     davvero in un banco di prova invece di essere constatata leggendo il sorgente;
 *   · `.js` perché il banco gira in Node e Node non compila TypeScript. La stessa medicina della
 *     voce 27: da un modulo vero non si estrae «a fette cercando marcatori di testo», si importa.
 *
 * ⭐⭐ GLI ESITI SONO TRE, non due: fatta, non fatta, e NON LO SO.
 *
 * Il terzo nasce quando la richiesta al worker non riceve MAI una risposta — rete caduta, tempo
 * scaduto. A quel punto il worker può avere già scritto la prenotazione sul Matchpoint del
 * circolo, oppure no, e da dentro l'edge non è dato saperlo. Fino alla v6.231 quel caso veniva
 * scritto come «errore», cioè appiattito sul secondo esito.
 *
 * 🚨 Non è una questione di parole: l'operatore legge «fallita», la rifà, e se la prima era
 *    passata il campo resta prenotato DUE VOLTE sul sistema del circolo. Sulla strada del
 *    ricorrente, che ne crea fino a quattro di fila, il danno si moltiplica.
 *
 * ⚖️ Perché non si ritenta e basta: il retry lo fa la sorella `cancel`, e lì è innocuo — disdire
 *    due volte non fa danno. Qui no, ed è per questo che il codice porta da sempre il commento
 *    «NESSUN retry: la prenotazione potrebbe essere già stata creata dal worker». Quel commento
 *    sapeva già tutto: quello che mancava era DIRLO a chi sta dall'altra parte.
 *
 * 📌 E dall'altra parte la macchina c'era già: la regola del committente (v6.150) — «quando
 *    l'esito resta IGNOTO non si indovina, si va a GUARDARE su Matchpoint» — è implementata in
 *    `staffCalAskMatchpoint`, coi suoi tre verdetti si/no/boh. Mancava solo che l'edge le
 *    consegnasse il caso invece di chiamarlo errore.
 */

/* Il marchio sta su una PROPRIETÀ, non sulle parole del messaggio, ed è deliberato.
 * ⚠️ La tentazione era riconoscere l'ignoto cercando «network» nel testo dell'errore: è lo stesso
 * setaccio a maglie larghe che nella voce 36 aveva classificato sette dispatcher come «letture»
 * perché non contenevano `insert`. Una condizione si riconosce da COSA È SUCCESSO — non abbiamo
 * ricevuto risposta — non da quali parole contiene la stringa che la racconta. */
export function esitoIgnoto(errore) {
  return !!(errore && typeof errore === 'object' && errore.esitoIgnoto === true);
}

/* Fabbrica l'errore del terzo esito. Si usa SOLO dove non è arrivata risposta: un rifiuto del
 * worker è una risposta, e quello resta un errore normale. */
export function erroreEsitoIgnoto(messaggio) {
  const e = new Error(messaggio);
  e.esitoIgnoto = true;
  return e;
}

/* Come si chiude il lavoro asincrono. Ritorna lo `status` da scrivere nella riga del job e, per
 * il terzo esito, la frase da mostrare a chi guarda — che deve contenere l'ISTRUZIONE, non solo
 * la constatazione: «controlla su Matchpoint prima di rifarla». */
export function decidiEsitoDelLavoro(errore, tipoLabel) {
  if (!esitoIgnoto(errore)) return { status: 'error' };
  const cosa = String(tipoLabel || 'prenotazione').toLowerCase();
  return {
    status: 'unknown',
    message: `Non ho ricevuto risposta dal gestionale: la ${cosa} potrebbe essere stata creata lo stesso. Controlla su Matchpoint prima di rifarla.`,
  };
}

/* Il gemello per la strada SINCRONA, da cui passa il RICORRENTE.
 * ⚖️ Resta un rifiuto (502) anche nel caso ignoto, perché contarlo come riuscito sarebbe la bugia
 * opposta e più cara. Cambia il CODICE, così chi legge distingue «rifiutata» da «non lo so»
 * invece di doverlo indovinare dal testo del messaggio. */
export function codiceDiRifiuto(errore) {
  return esitoIgnoto(errore) ? 'WORKER_ESITO_IGNOTO' : 'WORKER_ERROR';
}
