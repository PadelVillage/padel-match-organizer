// cliente-del-circolo.ts — «questa persona può prenotare?», che è poi una domanda sola:
// il circolo ce l'ha fra i suoi clienti?
//
// 🚨⭐⭐ PERCHÉ È UN MODULO SUO e non il `!!member.memberId` scritto in linea che stava qui
// dal 2/08/2026: quel campo NON è «vuoto oppure un codice cliente». Ci sono rimasti dentro
// dei vecchi «PMO-000123» — il codice che la nostra app assegnava prima che l'ID Padel
// Village avesse un campo tutto suo (v6.155). L'app li ripulisce man mano, ma finché ce ne
// sono «il campo è pieno» e «è un cliente del circolo» sono DUE COSE DIVERSE, e la seconda
// è l'unica che conta qui.
//
// 📊 Contati il 2/08/2026 sui due archivi, in sola lettura:
//   · PROD → 1068 codici veri e **14** residui `PMO-` (su 2788 soci vivi)
//   · TEST → 1068 codici veri e **1709** residui `PMO-` (su 2833)
//
// ⇒ Col controllo «campo non vuoto», su PROD quattordici persone avrebbero ricevuto un
//   «sì, puoi prenotare», sarebbero arrivate fino al «✅ Confermo» e lì sarebbero state
//   rifiutate dal gestionale — che aggancia i giocatori dalla tendina dell'elenco clienti,
//   dove non ci sono. È esattamente il vicolo cieco che il passo 1b aveva appena tolto.
//   Su TEST sarebbero state 1709: un collaudo lì avrebbe misurato il contrario del vero.
//
// ⭐ Il fatto sta QUI e non nel bot per la regola del committente (2/08): *«sul bot non ci
// deve essere il codice Matchpoint, ma solamente il PMO»*. Il bot chiede col codice nostro
// e riceve un sì/no; il codice del circolo non attraversa mai il confine.

/** La forma del codice cliente del circolo: sei cifre esatte, com'è nell'Elenco clienti. */
export const FORMA_CODICE_CLIENTE = /^[0-9]{6}$/;

/**
 * Vero se il circolo conosce questa persona come proprio cliente.
 *
 * ⚖️ FAIL CLOSED su tutto il resto — vuoto, assente, residui `PMO-`, qualunque altra forma:
 * un «non lo so» non deve aprire una porta che il gestionale richiuderebbe comunque, solo
 * più tardi e dopo tre tocchi.
 *
 * ⭐ Il giorno del distacco da Matchpoint questa funzione diventa `true` per tutti e a valle
 * non cambia nient'altro: è il punto in cui la dipendenza è stata raccolta tutta insieme.
 */
export function clienteDelCircolo(memberId: unknown): boolean {
  return FORMA_CODICE_CLIENTE.test(String(memberId ?? '').trim());
}
