// livello-dimostrato.ts — «questa persona il livello l'ha DIMOSTRATO?», che non è
// «ha un numero scritto nella scheda».
//
// 🚨⭐⭐ PERCHÉ È UN MODULO SUO e non il `!!level && level !== '0.5'` scritto in linea che
// stava qui dal 30/07/2026, in DUE punti dell'`index.ts` (rubrica e scheda del socio):
// quella riga guarda **solo il numero**, mai da dove viene. Finché i livelli li scrivono
// il socio col test o la segreteria a mano, numero e prova coincidono. Dal giorno in cui
// esistono i livelli **ereditati** — chi invita presta il proprio a chi entra nuovo, «da
// confermare» (Tabella 1, righe 1-3) — non coincidono più: un 4.5 PRESO IN PRESTITO
// aprirebbe la porta dell'organizzare, cioè riaprirebbe da solo il buco che la regola
// «senza livello non si organizza» aveva chiuso alla fonte.
//
// ⚖️ LA FORMA È NEGATIVA, ED È LA DECISIONE PIÙ IMPORTANTE DI QUESTO FILE.
// Si poteva scrivere al contrario — «dimostrato solo se l'origine dice che c'è stato un
// test» — ed è la strada che sembra più rigorosa. È anche quella che avrebbe fatto danno
// subito, e i numeri lo dicono senza margine.
//
// 📊 Contati il 9/08/2026 sui due archivi, in sola lettura (righe vive, `deleted is not true`):
//   · PROD → soci con un livello vero: **521**. Di questi, **517 hanno `levelSource` VUOTO**
//     e solo **4** dicono `autovalutazione`.
//   · TEST → 525, di cui **519** con origine vuota.
//
// ⇒ Col controllo «dimostrato solo se l'origine lo prova», su PROD **517 soci su 521**
//   perderebbero da un momento all'altro il diritto di organizzare — gente che il livello
//   ce l'ha eccome, solo che gliel'ha messo la segreteria quando quel campo non esisteva.
//   *Il campo vuoto non vuol dire «non provato»: vuol dire «scritto prima che ci fosse un
//   posto dove dirlo».* Chiedere una prova a chi non poteva lasciarla è la cura ovvia che
//   rompe più di quel che ripara.
//
// ⇒ Quindi: resta vero tutto ciò che era vero ieri, e si toglie **solo** ciò che è
//   dichiaratamente in prestito. Oggi le schede col marchio del prestito sono **ZERO** in
//   tutti e due gli ambienti ⇒ questa modifica, il giorno in cui entra, **non cambia il
//   comportamento di nessuno**. Chiude la porta PRIMA che qualcuno possa passarci.

/** Il valore di partenza delle schede nuove: «da definire», non un livello. L'81,2% dei soci sta lì. */
export const LIVELLO_DA_DEFINIRE = '0.5';

/**
 * Il marchio del livello preso in prestito da chi invita.
 *
 * 🚨 Si confronta con `startsWith`, non con `includes`, e non è pignoleria: serve a
 * distinguere `ereditato_da_confermare` (che è un prestito) da un'ipotetica origine
 * `autovalutazione_ereditata` (che comincia con «autovalutazione» e prova un test).
 * Con `includes` la seconda verrebbe scartata insieme alla prima.
 */
export const ORIGINE_IN_PRESTITO = 'ereditato';

/** Vero se il livello è dichiaratamente preso in prestito da chi ha invitato. */
export function livelloInPrestito(levelSource: unknown): boolean {
  return String(levelSource ?? '').trim().toLowerCase().startsWith(ORIGINE_IN_PRESTITO);
}

/**
 * Vero se questa persona un livello ce l'ha **e** non è in prestito.
 *
 * ⚖️ FAIL CLOSED sui casi vuoti: niente livello, o `0.5`, è un no.
 * ⚖️ FAIL OPEN sull'origine sconosciuta: un'origine che non riconosciamo **non** toglie il
 * livello a nessuno — vedi i 517 qui sopra.
 *
 * ⛔ Cosa questa funzione NON fa, e va saputo: **non guarda la scadenza** del prestito (le
 * 24 ore dalla partita, decise il 9/08/2026). Chi scrive un livello in prestito scrive
 * anche quando muore, e chi lo fa scadere lo cancella dalla scheda: quando è scaduto qui
 * arriva un livello vuoto, e la risposta è già no. *Una funzione che leggesse anche l'ora
 * darebbe due risposte diverse alla stessa scheda a dieci minuti di distanza.*
 */
export function livelloDimostrato(level: unknown, levelSource: unknown): boolean {
  const valore = String(level ?? '').trim();
  if (!valore || valore === LIVELLO_DA_DEFINIRE) return false;
  return !livelloInPrestito(levelSource);
}
