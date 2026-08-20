// Che TIPO di prenotazione è una scheda Matchpoint, e cosa il worker sa farci — in un posto solo.
//
// 🚨⭐⭐ NASCE DA UN CODICE CHE SI SMENTIVA IN DUE COMMENTI ADIACENTI (20/08/2026).
// In `cancelBookingWithBrowser` stava scritto:
//   «MANUTENZIONE → NON supportata dal worker … Falliamo SUBITO con un errore chiaro invece di
//    tentare un flusso che non cancella nulla (vecchia "FIX B": ~30s di attesa inutile e poi 502)»
// e la riga immediatamente sotto diceva «PARTITA / LEZIONE / MANUTENZIONE», trattandole uguali.
// **Quel ramo non esisteva.** Il commento prometteva più del codice, e a decidere era il codice.
//
// 📏 COSA COSTAVA, misurato sul registro del worker di PROD e non stimato (finestra dichiarata
// dalla sonda: guasti dal 21/05 al 20/08). Sedici annulli finiti in timeout su
// `#CC_Datos_ButtonAnular`, in 5 raffiche su 5 giornate — 1/06 ×6, 8/06 ×1, 21/07 ×3, 28/07 ×4,
// 19/08 ×2. Le raffiche sono a ~30 secondi l'una dall'altra: è **qualcuno che riprova**, perché
// il primo tentativo non gli ha detto niente di utile.
// ⚖️ E il worker ha **concorrenza 1**: ogni tentativo sono ~10-14 secondi della coda CONDIVISA
// bruciati ad aspettare un bottone che non arriverà, e dietro in coda c'è il sync delle
// prenotazioni — cioè la freschezza della copia su cui il gestionale risponde.
// ⚖️ Un controllo che «non c'è perché Matchpoint non lo presenta più» sarebbe **permanente**:
// questo non lo è, ed è l'argomento che scarta quella spiegazione.
//
// 🔎 Che il caso del 19/08 fosse DAVVERO una manutenzione non è dedotto: tredici secondi prima
// dell'annullo fallito delle 20:05:13, una lettura sullo **stesso identico slot** (Campo 4,
// 12:00 del 22/08) ha scritto nel registro `ficha_detected:manutenzione`.
//
// ⭐ E il tipo il worker lo RILEVAVA GIÀ: finiva solo nella stringa di diagnostica, mentre in
// `edit-booking` lo stesso identico controllo RAMIFICA. Stessa informazione, usata di là e
// buttata di qua.
//
// 📌 PERCHÉ STA IN UN FILE SUO e non dentro `server.mjs`: quel file fa `server.listen()` appena
// lo si importa, quindi una regola che vive lì dentro non si può provare senza un browser vero e
// una Matchpoint vera. Il worker non ha nessun banco — `npm run check` è `node --check`, cioè
// sintassi. È la stessa strada di `giocatore-da-aggiungere.ts` (#920): una riga di dipendenza in
// più compra una cucitura misurata.

/**
 * Il tipo di scheda, letto dall'URL con cui Matchpoint la serve.
 * ⚠️ Si guarda l'URL e non il contenuto della pagina di proposito: è l'unico segnale disponibile
 * PRIMA di toccare qualunque cosa, ed è già quello che il worker usa da sempre — qui cambia solo
 * che ha un nome invece di essere ricopiato in quattro punti.
 * 🚨 `partita` è il ripiego: un URL che non riconosciamo viene trattato come una partita, che è
 * il caso normale. Sbagliare qui in eccesso di prudenza (dire «manutenzione» a una partita)
 * bloccherebbe annulli legittimi, che è il danno peggiore.
 */
export function tipoFichaDa(fichaUrl) {
  const u = String(fichaUrl ?? '');
  if (u.includes('ClaseSuelta')) return 'lezione';
  if (u.includes('Mantenimiento')) return 'manutenzione';
  return 'partita';
}

/**
 * Il worker sa ANNULLARE questo tipo di scheda?
 * ⛔ La manutenzione no, e non è una mancanza da colmare di nascosto: la cancellazione vera si
 * innesca solo entrando dal TABELLONE — non dall'URL diretta `?modo=fancy` che il worker usa — e
 * tocca rimborsi e pagamenti. Tentarla comunque non cancella niente: aspetta dieci secondi un
 * bottone che nei sedici casi misurati non è mai comparso, e poi fallisce senza dire perché.
 * ⚠️ Detto con precisione: quello che ho misurato sono i SEDICI FALLIMENTI e zero riusciti su
 * manutenzione. Che il bottone sia *assente* e non solo lento resta l'ipotesi più semplice, non
 * una cosa che ho visto — e il ripiego è comunque sicuro, perché oggi quei tentativi falliscono
 * tutti: qui si perde un'attesa inutile, non una strada che funziona.
 */
export function annulloSupportato(tipo) {
  return tipo !== 'manutenzione';
}

/** Il codice del rifiuto. Dice il TIPO e l'azione, così non si confonde con gli altri guasti. */
export const CODICE_ANNULLO_NON_SUPPORTATO = 'ANNULLO_MANUTENZIONE_NON_SUPPORTATO';

/**
 * Il motivo, in italiano e senza nomi di pezzi interni.
 * 🔒 Scritto come se dovesse arrivare al SOCIO, perché può. Quello che ho VERIFICATO è che
 * `matchpoint-bookings-cancel` (riga 167) inoltra il messaggio del worker **verbatim** verso
 * l'alto, e che `consumer-booking-write` mette nel `detail` ciò che riceve. ⚠️ Il giro fino al
 * telefono NON l'ho tracciato tutto: quindi «può», non «arriva».
 * ⚖️ Per la regola d'architettura del committente (19/08) — *il gestionale SA, il bot DICE* — al
 * socio non si nomina né il worker né Matchpoint. Qui si dice **cosa fare**, non **chi** ha
 * detto di no, e così la frase è giusta in tutt'e due i casi.
 */
export const MOTIVO_ANNULLO_NON_SUPPORTATO =
  'Le manutenzioni non si annullano da qui: vanno cancellate dal tabellone, perché toccano rimborsi e pagamenti.';
