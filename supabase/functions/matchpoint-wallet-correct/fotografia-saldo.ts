/** 👛⭐⭐ VOCE 143 — CHE COSA SI SCRIVE NELLA FOTOGRAFIA DEL SALDO, e quando NON si scrive.
 *
 * 🗣️ Sua, dal 04/09: *«quando facciamo le operazioni di cassa che c'è tanta gente, se non si
 *    aggiorna velocemente poi qualcuno della segreteria può protestare»*.
 *
 * 📏 IL DIFETTO, misurato il 06/09 — e più preciso di come la scheda lo raccontava: i record sono
 *    DUE, e la ricarica ne aggiornava solo uno.
 *    · `wallet_txn` — il MOVIMENTO (chi, quanto, pre, post). Scritto dal 02/09. ✅
 *    · `wallet_balance` — la FOTOGRAFIA, **quella che l'app legge per mostrare il numero**. Non
 *      aggiornata ⇒ dopo una ricarica il saldo restava vecchio fino al giro dei 10 minuti. ❌
 *    ⇒ Il gestionale sapeva insieme *«è stata fatta una ricarica di 1 €»* e *«il saldo è quello di
 *      dieci minuti fa»*: due verità sullo stesso socio, nello stesso archivio.
 *
 * ⭐ E LA CURA NON COSTA NIENTE — è il punto che cambia il disegno della scheda. Il saldo DOPO è
 *    già in mano (`balanceCentsPost`, letto da Matchpoint nel giro che ha mosso il denaro). La
 *    scheda prevedeva *«si rinfresca quello, sul colpo»*, cioè **una lettura in più** al worker:
 *    non serve, sarebbe richiedere un dato già arrivato. Il worker — un browser solo condiviso col
 *    sync — non viene toccato.
 *    📌 *Prima di aggiungere una lettura, guardare se la risposta è già nella mano che si ha.*
 *
 * PURA di proposito, così il banco la ESEGUE invece di rileggerla (lezione della 149).
 */

export type EsitoFotografia =
  | { scrivi: false; motivo: 'MEMBER_LOCAL_ID_MANCANTE' | 'SALDO_POST_IGNOTO' | 'SALDO_NEGATIVO' }
  | { scrivi: true; localKey: string; payload: Record<string, unknown> };

/** Decide **se** la fotografia va scritta e **con quali campi**.
 *
 * ⚠️ SENZA `memberLocalId` NON SI SCRIVE: la chiave del record è quella, e inventarla dal codice
 *    Matchpoint creerebbe una riga che `matchpoint-wallet-sync` non ritroverebbe mai — un saldo
 *    fantasma che non si aggiorna più. 📌 *Meglio nessuna fotografia che una che nessuno può
 *    correggere.*
 *
 * ⛔ E SENZA UN SALDO NUMERICO nemmeno: un `null` scritto come saldo direbbe «zero» a chi legge,
 *    e «zero» su un borsellino è un'informazione, non un'assenza. Un saldo che non si sa si lascia
 *    a quello di prima e lo dice il giro del sync — è `esito_ignoto` applicato ai soldi.
 *
 * 🚨 E UN SALDO NEGATIVO SI RIFIUTA: Matchpoint non li tiene, quindi un numero sotto zero qui vuol
 *    dire che qualcosa è andato storto nella lettura — non che il socio deve dei soldi. Scriverlo
 *    farebbe apparire un debito che non esiste.
 */
export function decidiFotografiaSaldo(opts: {
  memberLocalId: unknown;
  codice?: unknown;
  playerName?: unknown;
  balancePost: unknown;
  adessoIso: string;
}): EsitoFotografia {
  const localId = String(opts.memberLocalId == null ? '' : opts.memberLocalId).trim();
  if (!localId) return { scrivi: false, motivo: 'MEMBER_LOCAL_ID_MANCANTE' };
  if (typeof opts.balancePost !== 'number' || !Number.isFinite(opts.balancePost)) {
    return { scrivi: false, motivo: 'SALDO_POST_IGNOTO' };
  }
  if (opts.balancePost < 0) return { scrivi: false, motivo: 'SALDO_NEGATIVO' };
  const codice = String(opts.codice == null ? '' : opts.codice).trim();
  return {
    scrivi: true,
    // 🔑 LA STESSA CHIAVE DEL SYNC (`matchpoint-wallet-sync`), non una nuova: chiavi diverse
    //    farebbero nascere DUE record per lo stesso socio, e l'app ne mostrerebbe uno a caso.
    localKey: `wbal|${localId}`,
    payload: {
      member_local_id: localId,
      id_cliente: codice || null,
      player_name: String(opts.playerName == null ? '' : opts.playerName),
      balance_cents: opts.balancePost,
      // ⚖️ `source` dice DA DOVE viene questo valore, e non è un capriccio: distingue una
      //    fotografia scritta da un gesto da una scattata dal report. Il sync la riallineerà al
      //    giro dopo con lo stesso numero e `source: 'matchpoint'`.
      source: 'pmo_wallet_correct',
      synced_at: opts.adessoIso,
    },
  };
}
