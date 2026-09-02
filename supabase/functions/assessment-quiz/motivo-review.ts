// motivo-review.ts — PERCHÉ una scheda finisce «in mano alla segreteria» (voce 84 ⓑ, 02/09/2026).
//
// 📏 IL FATTO CHE L'HA APERTO, misurato su PROD il 02/09 facendo girare
// `assessment-apply-level` in simulazione: **63 schede** esaminate, **0** applicate, e la
// causa più numerosa è una sola — *«in mano alla segreteria (review)»*, **9 soci**, fermi da
// 5 a **125 giorni**. Fra loro Lidia Comes, Fabiola Limuti e Laura Aprea, dal 27 agosto.
//
// 🎯 E IL DIFETTO NON È CHE NON SI APPLICANO: per un quiz non superato **non applicare è
// giusto**, ed è la protezione che il progetto ha voluto. Il difetto è che quelle schede
// stanno in uno stato che si chiama *«in mano alla segreteria»* e **in mano a nessuno ci
// sono mai state**: la segreteria non sa distinguerle da quelle che ha messo lì lei.
//
// ⚖️ `review` SIGNIFICA DUE COSE, ed è la malattia che questo progetto conosce a memoria —
// la voce 71 (`ordine` accanto a `giocatori`), la 83 (*«non è passata»* contro *«non so»*),
// la 68 (`consegnato_at` che voleva dire quattro cose):
//
//   · *«una PERSONA ha deciso di guardarla»* — `pending`, `pending_attention`, e il `review`
//     che scrive l'app quando la segreteria segna «da controllare»;
//   · *«la MACCHINA non se la prende»* — quiz non superato, sesso mancante, le due bandiere,
//     coerenza bassa.
//
// ⇒ E la cura è quella di sempre in questa casa: **NON si rinomina `review`** — si fa uscire
// il **perché accanto al dato**.
// 🚨 Rinominarlo sarebbe stato il difetto: misurato il 02/09, **sei** punti fra `index.html`,
// le edge e una funzione SQL confrontano quel valore **per uguaglianza** (`staff === 'review'`,
// `statoStaff !== 'review'`, `in ('da_controllare','review','attention')`). Un valore nuovo li
// avrebbe attraversati tutti **in silenzio** — fra gli altri il ramo del **gradino**, che
// `review` lo apre apposta, e che avrebbe smesso di far scendere chi lo chiede.
// 📌 *Una parola che significa due cose non si spacca: le si mette accanto quale delle due.*
//
// ⛔ QUESTO MODULO NON DECIDE NIENTE. Lo stato lo decide `index.ts`, con la sua espressione,
// che resta **identica**: qui si racconta la stessa decisione, non se ne prende una seconda.
// L'invariante che le tiene insieme è provato dal banco — *c'è un motivo se e solo se lo
// stato è `review`* — ed è l'unica cosa che impedisce alle due di divergere.

/** I modi in cui la MACCHINA manda una scheda alla segreteria. `''` = non è stata lei. */
export type MotivoReview =
  | 'genere_mancante'
  | 'quiz_non_superato'
  | 'poca_esperienza'
  | 'poca_frequenza'
  | 'coerenza_bassa'
  | 'dati_insufficienti'
  | '';

/**
 * Il motivo, nell'ORDINE ESATTO in cui `index.ts` valuta i suoi cancelli.
 *
 * 🚨 L'ordine non è estetico: è la copia della condizione che decide davvero
 * (`genere === 'NA' || conoscenza.status !== 'pass' || pocaEsperienza || pocaFrequenza`).
 * Scriverne uno «equivalente» qui vorrebbe dire raccontare un motivo che non è quello che ha
 * fermato la scheda — cioè una spiegazione sbagliata, che è peggio del silenzio.
 *
 * ⚠️ Quando nessuno dei quattro cancelli scatta, il `review` può venire ancora dal CALCOLO
 * (`calculateAssessmentPublicLevel`): coerenza bassa, o dati tecnici insufficienti. Sono due
 * casi diversi e si distinguono dalla coerenza, che nel secondo vale `medium`.
 */
export function motivoDelReview(input: {
  /** Il sesso come lo decide `index.ts`: detto dal socio, ripescato dalla scheda, o `NA`. */
  genere: unknown;
  /** `conoscenza.status`: `pass` quando il quiz è superato. */
  conoscenzaStatus: unknown;
  pocaEsperienza: unknown;
  pocaFrequenza: unknown;
  /** `staff_status` che torna dal calcolo — `review` o vuoto. */
  calcoloStaffStatus: unknown;
  /** `coherence` che torna dal calcolo: `high` · `medium` · `low`. */
  calcoloCoerenza: unknown;
}): MotivoReview {
  if (String(input.genere ?? '').trim() === 'NA') return 'genere_mancante';
  if (String(input.conoscenzaStatus ?? '').trim() !== 'pass') return 'quiz_non_superato';
  if (input.pocaEsperienza) return 'poca_esperienza';
  if (input.pocaFrequenza) return 'poca_frequenza';
  if (String(input.calcoloStaffStatus ?? '').trim() !== 'review') return '';
  return String(input.calcoloCoerenza ?? '').trim() === 'low' ? 'coerenza_bassa' : 'dati_insufficienti';
}

/**
 * I motivi, per chi deve controllarli o elencarli.
 *
 * 🚨⭐⭐ LE PAROLE NON STANNO QUI, E LA DIVISIONE È DELIBERATA. Qui sta la **regola** — quale
 * cancello ha fermato la scheda — e le **frase** che la segreteria legge stanno in
 * `index.html`, perché è lui a mostrarle e questo modulo gira su Deno, dove l'app non arriva.
 * ⚖️ Tenere le frasi anche qui avrebbe voluto dire due elenchi che si dicono la stessa cosa in
 * due file che nessuno confronta: divergono al primo ritocco, e nessuno se ne accorge perché
 * non danno errore — ne danno una **etichetta vecchia**, che è peggio.
 * 🔒 A tenerli insieme c'è una guardia, non la buona volontà: `motivo-review.test.ts` legge
 * `index.html` e pretende che la sua mappa copra **esattamente** questi codici, né uno di più
 * né uno di meno. Un motivo nuovo senza la sua frase fa rosso qui.
 * 📌 *Una cosa in un posto solo; e dove per forza sono due, una guardia che li confronta.*
 */
export const MOTIVI_REVIEW: readonly Exclude<MotivoReview, ''>[] = [
  'genere_mancante',
  'quiz_non_superato',
  'poca_esperienza',
  'poca_frequenza',
  'coerenza_bassa',
  'dati_insufficienti',
];
