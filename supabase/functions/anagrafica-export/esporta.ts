// La regola di sicurezza del ponte `anagrafica-export`, in un file a sé perché
// è LA cosa che questo ponte deve garantire — e ciò che va garantito va provato
// da solo, non di sfuggita dentro il giro delle chiamate.

export type JsonMap = Record<string, unknown>;

/**
 * Toglie il **numero di scheda** (`payload.id`) dalla scheda esportata.
 *
 * 🚨 Perché il numero non deve attraversare: la stessa persona ha numeri diversi
 * su TEST e su PROD, ed è l'unica cosa che tiene insieme storici e cassetti
 * nell'ambiente che lo riceve. Se lo si copiasse, ~2800 soci di TEST
 * cambierebbero identità interna a ogni sincronizzazione.
 *
 * ⭐ E si toglie **qui**, non a valle: ciò che non parte non può essere scritto
 * per errore da nessuno. Una regola che vive nel mittente non si può dimenticare
 * di applicare nel destinatario.
 */
export function senzaNumeroDiScheda(payload: JsonMap): JsonMap {
  const copia: JsonMap = { ...payload };
  delete copia.id;
  return copia;
}
