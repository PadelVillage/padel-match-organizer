// esito-avviso.ts — PERCHÉ una riga della coda è stata chiusa (voce 68, 01/09/2026).
//
// 🚨⭐⭐ ESISTE PERCHÉ UNA COLONNA MENTIVA, e il difetto era **dichiarato** da dieci giorni
// senza essere curato: `consegnato_at` si scrive anche quando il destinatario non si
// riconosce, anche quando il netto del confronto è nullo, e anche quando la riga se l'è presa
// questo giro ma l'evento non è uscito. In tutti e tre i casi la colonna dice *«fatto»* e al
// socio non è arrivato niente.
//
// 📏 MISURATO su PROD il 01/09/2026: **605** righe in coda, **605** con `consegnato_at`,
// **0** aperte — e nel registro del bot **22** messaggi davvero partiti (`🔔 detto a …`, dal
// 29/08 al 01/09) contro **274** righe chiuse negli ultimi quattro giorni. La stragrande
// maggioranza di quei «fatto» riguarda gente che il bot non ce l'ha: che è giusto, ma **non è
// «consegnato»**, ed era l'unica cosa che quella colonna sapeva dire.
//
// ⚖️ LA CURA NON RINOMINA NIENTE, ed è la decisione di questo file. `consegnato_at` continua a
// voler dire *«questa riga è chiusa, non riesaminarla»* — il fatto su cui poggia la chiusura
// atomica del 24/08, cioè l'intera protezione contro il doppio invio. ⇒ Si aggiunge il
// **perché** accanto, invece di cambiare il significato di ciò che funziona.
// 📌 È la stessa forma della voce 71 (`ordine` accanto a `giocatori`) e della voce 70 (la
// ricevuta accanto al fatto): *far uscire il perché insieme al dato. Un valore che significa
// quattro cose non è ambiguo per chi lo scrive — lo è per chi lo legge, e chi lo legge è
// sempre qualcun altro.*
//
// ⛔ Questo modulo NON decide niente: tiene i quattro nomi e li tiene in UN posto, perché
// vivono in tre — il codice che chiude, la migrazione che documenta la colonna, e chi un
// domani andrà a interrogarla. Tre stringhe scritte a mano in tre posti divergono.

/**
 * I quattro modi in cui una riga della coda finisce.
 *
 * 🚨⭐⭐ IL PRIMO SI CHIAMAVA `consegnato`, E MENTIVA — corretto il 01/09/2026, poche ore dopo
 * averlo scritto, dalla PRIMA misura vera. Vale la pena leggerlo tutto, perché è il difetto
 * che questo file esisteva per togliere, riprodotto da chi lo stava togliendo.
 *
 * 📏 Alle **18:22:07** il gestionale ha scritto `consegnato` su due righe (Oriana Canzian e
 * Valeria Moschet, aggiunte al 07/09 19:30). Nello stesso istante il registro del bot dice:
 *     `🔔 circolo: 2 ritirati, 0 detti, 2 scartati`
 * ⇒ **zero detti.** Il bot le ha SCARTATE — quelle due persone il bot non ce l'hanno, e la
 * whitelist Telegram tiene i soci iscritti, non i 2.800 del circolo.
 *
 * ⚖️ La colonna diceva «consegnato» e la sua funzione di lettura prometteva *«il socio lo
 * saprà»*: la stessa bugia di `consegnato_at`, **spostata di un passo**. Il gestionale
 * consegna **al bot**; se poi il bot lo dica a qualcuno è un fatto che vive di là, e da qui
 * non si può sapere.
 * 📌 *Rinominare una colonna che mente non basta se il nome nuovo promette la stessa cosa: la
 * domanda non è come si chiama il valore, è chi è in grado di rispondere.*
 */
export const ESITO = {
  /**
   * L'evento è uscito **verso il bot** — e non un passo più in là.
   *
   * ⛔ NON vuol dire «il socio lo saprà»: il bot ha un suo filtro e scarta chi non è nella
   * whitelist Telegram, che è **il caso frequente**. Chi ha detto davvero qualcosa a qualcuno
   * lo sa solo il registro del bot (`🔔 detto a …`).
   */
  PASSATO_AL_BOT: 'passato_al_bot',
  /**
   * Il nome non è di UNA persona viva in anagrafica.
   * ⚖️ Si chiude lo stesso, ed è giusto: o è qualcuno che il circolo non ha in anagrafica, o
   * sono due OMONIMI VERI — e in nessuno dei due casi riprovare fra un'ora cambia qualcosa.
   * 🚨 Le schede DUPLICATE della stessa persona NON finiscono qui: le riconosce
   * `destinatarioPerNome`. La regola secca «più di una scheda ⇒ nessuno» avrebbe tolto per
   * sempre gli avvisi a una socia vera, in silenzio (21/08).
   */
  NON_RICONOSCIUTO: 'non_riconosciuto',
  /** Il confronto fra le due fotografie non aveva niente da dire per quella persona. */
  NETTO_NULLO: 'netto_nullo',
  /**
   * Questo giro si è preso la riga, ma una sua **sorella** se l'era presa un altro giro ⇒
   * l'evento non è uscito (i `soffiati` della chiusura atomica).
   * 🚨⭐ È il caso in cui `consegnato_at` mentiva peggio: qui il nome era riconosciuto e il
   * messaggio sarebbe partito, quindi la riga è indistinguibile da una consegnata davvero.
   */
  CORSA_PERSA: 'corsa_persa',
} as const;

export type Esito = typeof ESITO[keyof typeof ESITO];

/** I quattro valori, per chi deve controllarli o elencarli. */
export const ESITI: readonly string[] = Object.values(ESITO);

/**
 * Vero se questa riga è stata **passata al bot**.
 *
 * 🚨⭐⭐ SI CHIAMAVA `eArrivatoAlSocio`, E QUELLA È LA DOMANDA CHE DA QUI NON SI PUÒ FARE.
 * Il gestionale sa di aver consegnato al bot; cosa il bot ne abbia fatto lo sa il bot — e il
 * 01/09 la differenza era **2 passati, 0 detti**. Una funzione che prometteva la seconda
 * rispondendo con la prima è esattamente ciò che rende una colonna inaffidabile: non il dato,
 * la promessa scritta sopra.
 *
 * ⇒ Chi vuole sapere **quanti avvisi sono arrivati a qualcuno** non lo chiede a questa
 * colonna: lo chiede al registro del bot (`stato-bot.yml`, regex `detto a`). Da questa parte
 * quella riga non esiste, e adesso nessuna funzione finge il contrario.
 *
 * ⚠️ Un esito ASSENTE (le righe chiuse prima del 01/09) è `false`, e va letto come **non
 * misurato** — non come «non passato».
 */
export function ePassatoAlBot(esito: unknown): boolean {
  return String(esito ?? '') === ESITO.PASSATO_AL_BOT;
}
