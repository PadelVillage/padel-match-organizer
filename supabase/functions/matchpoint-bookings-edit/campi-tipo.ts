/**
 * 🎭🚨⭐⭐ IL TIPO CHE ATTRAVERSA LA PORTA — voce 201, 10/09/2026 sera.
 *
 * 📏 TROVATO DA UN GESTO VERO, non rileggendo. La voce 201 era stata costruita in tre mosse (il
 * bot, il `CHECK`, il gestionale) e il banco era verde su tutte e tre. Poi qualcuno ha premuto
 * **Salva** su una scheda di `cudi`, e la misura ha detto un'altra cosa:
 *   · **partita → lezione** si salvava, ma il fatto che ne nasceva era **`maestro`** con
 *     `tipo: 'partita'` e `tipo_prima: null` ⇒ al socio sarebbe arrivato *«è cambiato il
 *     maestro»* di una **partita**, cioè il «dato che mente» che questa voce esisteva per
 *     evitare, e il cambio di tipo non lo diceva **nessuno**;
 *   · **lezione → partita** veniva **respinto** con `EDIT_NESSUNA_MODIFICA` — *«serve almeno uno
 *     tra move, players, note, descrizione e istruttore»* — perché tornando partita il maestro
 *     si azzera e non viaggia, quindi la richiesta portava **solo** il tipo.
 *
 * 🔎 LA CAUSA ERA UNA RIGA SOLA, e non era in nessuno dei pezzi nuovi: la edge non costruisce
 * `EditRequest` dal corpo così com'è, lo **ricopia campo per campo** da un elenco esplicito. Il
 * tipo era dichiarato nel type, letto da `cambiaIlTipo`, usato da `dichiaraCambioTipoAlSocio` —
 * e non era in **quell'elenco**. ⇒ L'oggetto che tutti leggevano non l'aveva mai portato.
 * ⛔ E il banco non poteva vederlo: le sue prove costruiscono un `edit` **a mano** e chiamano le
 * funzioni a valle, quindi non attraversano mai la riga che copia.
 * 📌 *Il posto più pericoloso non è quello che stai scrivendo: è quello che legge ciò che scrivi
 * e non sa di doverlo fare.* Qui il lettore distratto era la **porta**.
 *
 * 🎯 PERCHÉ STA IN UN FILE A PARTE e non in tre righe dentro `index.ts`: `index.ts` chiama
 * `Deno.serve` appena importato, quindi dal banco **non si può caricare**. Un pezzo di logica
 * che nessuno può provare torna a rompersi in silenzio — che è esattamente com'è andata. È la
 * stessa scelta già fatta per `scrittura-al-circolo.ts` e `importo-dal-listino.ts`.
 */

/** Il tipo NUOVO (vocabolario chiuso) e, se c'è, quello di PRIMA. Campi assenti = non toccare. */
export type CampiTipo = { tipo?: string; tipoPrima?: string };

/**
 * 🚨 VOCABOLARIO CHIUSO SUL «NUOVO», e non «stringa non vuota» come per il maestro: un maestro è
 * un nome libero, un tipo è una parola di un vocabolario di **due**. Qualunque altra cosa
 * finirebbe in `staff_booking.tipo` e da lì in una frase che il socio legge.
 * ⚖️ Sul «PRIMA» invece si lascia passare la parola **grezza**: può arrivare dalla copia locale,
 * dove ci sono ancora le parole di Matchpoint (`Lezione Libera`), e a tradurla — o a dire «non lo
 * so» — c'è già `tipoDichiarato` dentro `fattiDaTipo`. La regola sta in **un** posto, non in due.
 */
export function campiTipoDallaRichiesta(body: unknown): CampiTipo {
  const b = (body ?? {}) as Record<string, unknown>;
  const nuovo = String(b.tipo ?? '').trim().toLowerCase();
  if (nuovo !== 'partita' && nuovo !== 'lezione') return {};
  const prima = String(b.tipoPrima ?? '').trim();
  return prima ? { tipo: nuovo, tipoPrima: prima } : { tipo: nuovo };
}

/**
 * ⛔ FALLISCE CHIUSO: `tipoPrima` da solo non è una modifica. Senza il tipo NUOVO non c'è niente
 * da scrivere e niente da dire — ed è la ragione per cui `campiTipoDallaRichiesta` lo butta via
 * invece di portarselo dietro: un «prima» senza «adesso» è un mezzo fatto, e i mezzi fatti sono
 * quelli che poi qualcuno completa indovinando.
 */
export function toccaIlTipo(campi: CampiTipo): boolean {
  return campi.tipo === 'partita' || campi.tipo === 'lezione';
}
