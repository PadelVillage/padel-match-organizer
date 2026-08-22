/* lapide-prenotazione.js — SI PUÒ SCRIVERE SOPRA UNA LAPIDE? (voce 75, 22/08/2026)
 *
 * La copia locale di una prenotazione (`staff_booking`) ha una chiave che NON contiene l'id
 * della prenotazione: `staff_booking|<data>|<ora>|Campo <n>|<attore>`. ⇒ Due prenotazioni
 * diverse sullo STESSO slot, fatte dallo STESSO attore, condividono la riga — e la seconda
 * trova la lapide della prima.
 *
 * 🚨 IL DIFETTO CHE HA FATTO NASCERE QUESTO MODULO, visto su una persona vera il 22/08 sera.
 * Alle 10:53:59 viene annullata una partita su 31/08 · 09:30 · Campo 1 ⇒ la riga diventa una
 * lapide (`deleted: true`). Alle 20:58:32 il socio riprenota lo STESSO slot dal bot: la
 * guardia anti-fantasma vedeva `deleted === true` e usciva senza scrivere. ⇒ Per quasi
 * quattro minuti — fino al giro di sync — nel gestionale di quella partita non esisteva
 * NIENTE, e il bot, che legge solo da lì, ha risposto «Non trovo più quella partita fra le
 * tue» al socio che l'aveva prenotata venticinque secondi prima, mandandolo in segreteria.
 *
 * ⚖️ LA GUARDIA NON ERA SBAGLIATA, ERA CIECA SU UNA DISTINZIONE. `deleted: true` dice due
 * cose diverse con lo stesso segno:
 *   · «questa prenotazione è stata annullata»      → resuscitarla è il fantasma di luglio;
 *   · «questo slot è tornato libero, e qualcuno ci ha prenotato SOPRA» → non scrivere è il
 *     difetto della voce 75.
 * È la stessa forma della 70 e della 71 — un dato che risponde a due domande — e la cura è
 * la stessa: NON indovinare meglio, ma far uscire il perché insieme al dato.
 *
 * ⭐ I DUE FATTI CHE DISTINGUONO, e sono fatti, non soglie (la strada del tempo-a-soglia è
 * stata scartata dalla 71 e dalla 67, per la stessa ragione: `updated_at` racconta anche il
 * passaggio del sync, e una soglia che nessuno ha misurato invecchia da sé):
 *
 *   ① L'ID. Se la lapide porta un `id_reserva` e quello che il worker ci ha appena consegnato
 *      è DIVERSO, la lapide non riguarda questa prenotazione: è un'altra partita, morta prima.
 *      Un id nuovo non è una resurrezione. Se è lo STESSO, la lapide è l'annullo di questa —
 *      e allora non si tocca, qualunque cosa dicano gli orologi.
 *
 *   ② L'ORDINE. Se la lapide è stata sepolta PRIMA che questa scrittura cominciasse, non può
 *      essere il suo annullo: un annullo non precede la prenotazione che annulla. Se è stata
 *      sepolta DOPO, può essere la risposta tardiva che seppellisce proprio ciò che stiamo
 *      per scrivere — ed è il caso per cui la guardia esiste.
 *
 * 🚨 SI FALLISCE CHIUSI, come la metà A della voce 72: quando i fatti non bastano — nessun id
 * confrontabile e nessun istante leggibile — la risposta è NO. Un «no» di troppo lascia il
 * socio ad aspettare il sync, che è il comportamento di oggi; un «sì» di troppo rimette in
 * piedi una prenotazione annullata, che è il fantasma. I due errori non costano uguale.
 *
 * ⛔ Quello che questo modulo NON decide: se la prenotazione sia andata a buon fine. Quello
 * l'ha già deciso `esito-prenotazione.js`, e qui ci si arriva solo con un `workerResult` in
 * mano. Questa è una domanda sola: la riga che trovo è la lapide di ciò che sto scrivendo?
 *
 * ⚠️ RESIDUO DICHIARATO — i due istanti del ② vengono da DUE OROLOGI diversi: `updated_at` lo
 * scrive chi ha sepolto la riga, `scritturaIniziataAlle` questa edge. Uno scarto fra i due
 * sposta il confine, e i due versi non costano uguale:
 *   · scarto che fa sembrare la lapide PIÙ RECENTE ⇒ non si scrive ⇒ si ricade nel
 *     comportamento di prima (il socio aspetta il sync). Fastidioso, non grave.
 *   · scarto che la fa sembrare PIÙ VECCHIA ⇒ si scrive ⇒ potrebbe essere il fantasma. Grave,
 *     ma è proprio il caso in cui l'annullo riguarda QUESTA prenotazione e porta quindi lo
 *     STESSO id: il controllo ① lo ferma prima di arrivare qui.
 * ⇒ Il ① non è un'ottimizzazione del ②: è ciò che tiene il ② dalla parte sicura quando gli
 *   orologi non concordano. Toglierlo lascerebbe la decisione a una differenza di secondi.
 */

/* Lo `id_reserva` di un payload, normalizzato a stringa non vuota o `null`.
 * ⚠️ Le due estremità lo scrivono con due nomi — `id_reserva` nella nostra riga, `idReserva`
 * in quella che l'app pusha per conto suo — e leggerne uno solo qui vorrebbe dire ignorare
 * metà delle lapidi: il confronto ① si spegnerebbe in silenzio, cadendo sempre sul ②. */
export function idPrenotazione(payload) {
  if (!payload || typeof payload !== 'object') return null;
  for (const chiave of ['id_reserva', 'idReserva']) {
    const v = payload[chiave];
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

function istante(valore) {
  if (!valore) return null;
  const ms = Date.parse(valore);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * @param {object} o
 * @param {boolean} o.lapide            La riga esistente è sepolta? Se no, non c'è domanda.
 * @param {object|null} o.payloadLapide Il payload della riga sepolta (per l'id ①).
 * @param {string|null} o.idNuovo       L'`idReserva` che il worker ha appena consegnato.
 * @param {string|null} o.sepoltaAlle   `updated_at` della lapide (ISO).
 * @param {string|null} o.scritturaIniziataAlle  Istante in cui questa scrittura è partita (ISO).
 * @returns {{si: boolean, motivo: string}}
 */
export function siPuoScrivereSopraLapide(o) {
  // Nessuna lapide: la domanda non si pone, e la risposta non è «sì per un pelo» — è che
  // questo modulo non c'entra. Il motivo lo dice, così chi legge il registro non confonde
  // «non era sepolta» con «l'ho giudicata sovrascrivibile».
  if (!o?.lapide) return { si: true, motivo: 'nessuna_lapide' };

  const idVecchio = idPrenotazione(o.payloadLapide);
  const idNuovo = o.idNuovo === null || o.idNuovo === undefined ? null : String(o.idNuovo).trim() || null;

  // ① L'id decide da solo, nei due versi, e viene PRIMA del tempo: è un fatto sulla cosa,
  // mentre l'ordine è un fatto sugli orologi — e gli orologi qui sono due (il nostro e quello
  // del database che ha scritto `updated_at`).
  if (idVecchio && idNuovo) {
    return idVecchio === idNuovo
      ? { si: false, motivo: 'stessa_prenotazione' }
      : { si: true, motivo: 'id_diverso' };
  }

  // ② L'ordine. Senza uno dei due istanti non c'è confronto, e senza confronto si sta fermi.
  const tSepoltura = istante(o.sepoltaAlle);
  const tScrittura = istante(o.scritturaIniziataAlle);
  if (tSepoltura === null || tScrittura === null) return { si: false, motivo: 'istanti_ignoti' };

  return tSepoltura < tScrittura
    ? { si: true, motivo: 'lapide_precedente' }
    : { si: false, motivo: 'lapide_successiva' };
}
