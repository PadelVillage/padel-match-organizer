/* 🔁 VOCE 173 — LO STORNO È UN FATTO NOSTRO, E UNO SPECCHIO NON PUÒ CANCELLARLO (07/09/2026)
 *
 * 📏 IL GUASTO, misurato su PROD con un prima e un dopo sulle stesse due righe:
 *      prima del sync:  status: 'void'  · voided_at: 2026-09-06T22:09:58Z
 *      dopo  il sync:   status: 'paid'  · voided_at: null
 *    Il sync degli incassi di oggi gira ogni 5 minuti (6-21) ⇒ negli Incassi uno storno durava
 *    al massimo CINQUE MINUTI, poi tornava «riscosso» e la cassa risultava più alta del vero.
 *    ⭐ E la misura più dura non è quella: su 3297 pagamenti vivi di PROD **il campo `status`
 *    aveva UN SOLO valore, `paid`**. Zero storni, in tutto il database. Non era un caso
 *    sfortunato: era lo stato stazionario — ogni storno mai fatto era già stato cancellato.
 *
 * 🔎 PERCHÉ SUCCEDEVA, e non è un errore di distrazione:
 *    · `matchpoint-payment-void` marca la riga scrivendo `voided_at` + `status: 'void'` sul
 *      payload (`marcaStornato`), e la lascia VIVA (`deleted: false`);
 *    · il sync ricostruisce il payload **da capo** a ogni giro, con `status: 'paid'` fisso, e
 *      lo upserta sulla stessa `local_key` ⇒ i due campi dello storno sparivano;
 *    · e non poteva rimediarci da sé: 📏 il report 11.13 (`ListadoPagosRealizados.aspx`) ha le
 *      colonne Data / metodo / Importo / Cod. / Nome / N° prenotazione / Giorno / Ora / Spazio —
 *      **nessuna dice che un pagamento è stato annullato**, e infatti gli stornati continuano a
 *      comparirci (byMethod identico prima e dopo uno storno vero).
 *
 * ⚖️ ⇒ La riconciliazione «tombstone» che sta in `index.ts` NON copre questo caso, e non è un
 *    suo difetto: lei marca ciò che è SPARITO dal report. Uno storno non fa sparire niente.
 *    Sono due meccanismi per due fatti diversi, e servono tutti e due.
 *
 * 🎯 È «il gestionale SA» applicato alla cassa: lo storno l'ha fatto il gestionale, quindi è un
 *    fatto NOSTRO. Un dato che nasce da noi non può essere sovrascritto da uno specchio di
 *    qualcun altro — e Matchpoint, su questo, non ha proprio niente da dire.
 *
 * PURE di proposito: nessuna rete, nessun client, nessun orologio. Il banco le ESEGUE invece di
 * rileggerle, ed è l'unico modo di sabotarle davvero.
 */

export type Payload = Record<string, unknown>;

/** I tre campi che portano lo storno, e nient'altro: si preserva ciò che il gesto scrive. */
export const CAMPI_DELLO_STORNO = ['status', 'voided_at', 'voided_by'] as const;

/* 🚨 LA STESSA DOMANDA DEVE AVERE UNA SOLA RISPOSTA, IN UN SOLO POSTO.
   `marcaStornato` decide «questa riga è già stornata?» con `pl.voided_at || (pl.status &&
   pl.status !== 'paid')`. Se qui si scrivesse una variante — anche solo `status === 'void'` —
   i due lati direbbero cose diverse sulla stessa riga, e la divergenza si vedrebbe solo il
   giorno in cui qualcuno introduce un terzo valore di `status`.
   📌 *Due controlli sullo stesso fatto scritti in due posti sono due controlli finché nessuno
      li cambia, e uno solo dopo.* */
export function eStornata(payload: Payload | null | undefined): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const voidedAt = payload.voided_at;
  if (typeof voidedAt === 'string' && voidedAt.trim() !== '') return true;
  const status = payload.status;
  return typeof status === 'string' && status.trim() !== '' && status.trim() !== 'paid';
}

/**
 * Il payload da scrivere per UNA riga: quello nuovo del report, più i campi dello storno se la
 * riga che c'era già ne portava uno.
 *
 * ⚖️ **Vince il report su tutto il resto, e lo storno solo su sé stesso.** Importo, metodo,
 * nome, socio agganciato, date: se Matchpoint li ha cambiati, la verità è la sua. Ciò che il
 * report non sa — e non può sapere — è l'annullo, e solo quello si tiene.
 *
 * 🚨 Su cosa poggia l'identità, dichiarato invece che nascosto: la `local_key`
 * (`pay|idClienteMp|codice|giorno|importo|metodo|seq`). È la stessa identità con cui il sync già
 * decide se AGGIORNARE una riga o crearne una nuova ⇒ questa funzione non introduce nessuna
 * fiducia in più di quella che il sync si accorda da sempre. Se un domani quella chiave non
 * bastasse, non basterebbe già oggi, e il difetto sarebbe dell'upsert, non di qui.
 */
export function preservaStorno(nuovo: Payload, esistente: Payload | null | undefined): Payload {
  if (!eStornata(esistente)) return nuovo;
  const fuso: Payload = { ...nuovo };
  for (const campo of CAMPI_DELLO_STORNO) {
    // ⚠️ Si copia solo ciò che c'è DAVVERO: un `voided_by` assente non deve diventare
    // `undefined` nel payload nuovo — sarebbe un campo inventato che nessuno ha scritto.
    if (esistente && Object.prototype.hasOwnProperty.call(esistente, campo)) {
      fuso[campo] = (esistente as Payload)[campo];
    }
  }
  return fuso;
}

/**
 * Applica la preservazione a un blocco di record già pronti per l'upsert.
 * `esistentiPerChiave` è la fotografia letta dal database PRIMA di scrivere.
 *
 * Ritorna anche **quante** righe hanno conservato lo storno: serve al record di riepilogo, ed è
 * la sola cosa che permette di accorgersi da fuori che questa cura sta lavorando. 📌 *Una cura
 * che non lascia un numero dietro di sé si può solo credere.*
 */
export function applicaStorniPreservati(
  records: { local_key?: unknown; payload?: unknown; [k: string]: unknown }[],
  esistentiPerChiave: Map<string, Payload>,
): { records: typeof records; preservati: number } {
  let preservati = 0;
  for (const rec of records) {
    const chiave = typeof rec.local_key === 'string' ? rec.local_key : '';
    if (!chiave) continue;
    const prima = esistentiPerChiave.get(chiave);
    if (!eStornata(prima)) continue;
    rec.payload = preservaStorno((rec.payload ?? {}) as Payload, prima);
    preservati += 1;
  }
  return { records, preservati };
}
