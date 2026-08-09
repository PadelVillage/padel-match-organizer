// 🆔 «È la stessa scheda sotto una chiave vecchia?» — la domanda che chiude il rubinetto dei doppioni.
//
// 🚨⭐⭐ Perché esiste (9/08/2026). Quando un socio della rubrica «entra da Matchpoint», la sua
// chiave passa da `phone:…` a `email:…` e nasce una SECONDA riga viva della stessa identica
// scheda. La guardia della v6.090 in `index.ts` la mandava in revisione manuale — giustamente,
// per il caso che protegge — e la fila non l'ha mai smaltita nessuno.
// ⇒ Ogni doppione è **una persona che il bot non riconosce**: il ponte ne trova due e risponde
//   `ambiguous`, cioè «non ti riconosco». Non è disordine, è un socio che smette di essere servito.
// 📏 Su PROD ne nasceva circa **uno a settimana** (Ivana Tadiotto 3/08, Mauro Fresch 5/08,
//   Sara Trentin 6/08 — tutti dopo l'ultima pulizia a mano).
//
// ⭐⭐ LA PREMESSA SBAGLIATA che ha tenuto aperto il rubinetto per mesi stava in un COMMENTO:
// *«la chiave differisce solo se il numero è diverso»*. È falso — differisce anche quando il
// numero è identico e cambia solo il TIPO di chiave. La guardia era giusta, la frase che la
// spiegava no, e nessuno aveva motivo di dubitarne.
//
// 🛡️ Perciò questa risposta chiede DUE prove insieme, e nessuna delle due basta da sola:
//   · **stesso `id`** ⇒ è la stessa scheda. Il solo telefono non basterebbe: due familiari
//     possono condividere un numero, e quelle sono due PERSONE — cancellarne una è cancellare
//     qualcuno;
//   · **stesso telefono** ⇒ non si sta buttando il numero curato che la v6.090 protegge (un
//     recapito giusto per un socio col telefono rotto in Matchpoint).
// ⇒ Quando risponde `true`, l'unica cosa che si toglie è una CHIAVE ridondante: la persona resta
//   viva sotto l'altra. Quando risponde `false` si va in revisione manuale, come prima.

type Scheda = { id?: unknown; phone?: unknown } | null | undefined;

function testo(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}

/** Le ultime 10 cifre: è il confronto che l'anagrafica usa dappertutto (prefissi e spazi variano). */
function cifre(v: unknown): string {
  return testo(v).replace(/\D/g, '').slice(-10);
}

/**
 * `true` solo se il candidato è la STESSA scheda del sopravvissuto e porta lo STESSO numero.
 * In quel caso la sua chiave è un residuo e si può archiviare senza perdere niente e senza
 * perdere nessuno.
 */
export function eChiaveVecchiaDellaStessaScheda(candidato: Scheda, sopravvissuto: Scheda): boolean {
  const idCand = testo(candidato?.id);
  const idSurv = testo(sopravvissuto?.id);
  if (!idCand || idCand !== idSurv) return false;
  const telCand = cifre(candidato?.phone);
  const telSurv = cifre(sopravvissuto?.phone);
  if (!telCand || telCand !== telSurv) return false;
  return true;
}
