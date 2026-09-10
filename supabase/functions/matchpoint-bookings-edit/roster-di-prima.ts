/**
 * 👥🚨⭐⭐ CHI DEVE LEGGERE «CHI C'ERA IN CAMPO PRIMA» — voce 201, 10/09/2026 sera.
 *
 * 📏 QUESTO ELENCO HA DIMENTICATO IL GESTO NUOVO **QUATTRO VOLTE**, e sempre nello stesso modo.
 * Non è distrazione: è la forma del difetto. Un gesto nuovo si aggiunge dove lo si **scrive** —
 * il menu, la richiesta, il fatto — e resta fuori da ogni posto che **enumera i gesti** senza
 * sapere che ne è nato un altro. Nell'ordine in cui sono stati pagati:
 *   ① `DELLA_PARTITA` nella riduzione (trovato dal banco, prima di andare in servizio);
 *   ② la riga che ricopia `EditRequest` (⇒ `campi-tipo.ts`, trovata da un Salva vero);
 *   ③ la guardia «niente da fare» (400 `EDIT_NESSUNA_MODIFICA`, stesso Salva);
 *   ④ **questo**: `rosterPrimaDelloSpostamento` tornava `null` per un cambio di solo tipo ⇒ la
 *      dichiarazione al socio usciva alla prima riga, **senza fatto e senza errore**.
 *
 * 🎭 E IL ④ SI NASCONDEVA DIETRO IL MAESTRO: `partita → lezione` **impone** di sceglierne uno,
 * quindi `cambiaIlMaestro` era vero e il roster si leggeva lo stesso — per caso. A scoprirlo è
 * stato il verso opposto, `lezione → partita`, che il maestro lo **toglie** e quindi non porta
 * niente con sé. 📌 *Metà di un gesto che funziona perché viaggia appoggiata a un'altra non è
 * una metà che funziona: è una che non è ancora stata provata da sola.*
 *
 * 🎯 PERCHÉ IN UN FILE A PARTE: stava dentro `index.ts`, che chiama `Deno.serve` appena
 * importato e dal banco **non si può caricare**. ⇒ Nessuna prova poteva attraversarlo, e infatti
 * nessuna l'ha fatto. Qui invece la tabella qui sotto si prova per intero, riga per riga — e la
 * prossima volta che nasce un gesto, è **questo** il posto in cui il banco diventa rosso.
 */

/** I gesti che una richiesta di modifica può portare, ridotti a sì/no. */
export type GestiDellaModifica = {
  /** La partita si sposta o cambia durata. */
  move?: boolean;
  /** Entra o esce qualcuno. */
  roster?: boolean;
  /** Cambia il maestro della lezione. */
  maestro?: boolean;
  /** 🎭 Diventa una lezione, o torna una partita. */
  tipo?: boolean;
};

/**
 * ⛔ SI LEGGE SOLO SE QUALCUNO POI PARLA. Il roster di prima serve a **dire** qualcosa al socio:
 * leggerlo per un gesto che tace sarebbe una query in più a ogni salvataggio di una nota.
 *
 * 🚨 E `move` + `roster` INSIEME torna `false` di proposito, e non è una svista: nessuna delle
 * due strade saprebbe dire tutto — dire «spostata» a chi è stato **tolto** sarebbe falso — quindi
 * tacciono tutt'e due e la cosa resta al sync. È il paletto ⑤: dove la conferma non sa dire
 * tutto, si dice una cosa sola. ⭐ Il tipo non entra in quell'esclusione perché non convive con
 * un `move`: sono due schermate diverse dello stesso Salva, e chi le mescola lo dichiara.
 */
export function serveIlRosterDiPrima(g: GestiDellaModifica): boolean {
  if (!g.move && !g.roster && !g.maestro && !g.tipo) return false;
  if (g.move && g.roster) return false;
  return true;
}
