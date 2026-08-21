// eventi-staff.ts — COSA È CAMBIATO in una partita fra un sync e il successivo, detto come
// FATTI, uno per persona toccata.
//
// 🗣️ Nasce dalla voce 68, segnalata dal committente: *«quando da gestionale faccio un'azione,
// cioè metto, levo giocatori o attivo partite o elimino partite, sul bot dei soci non succede
// niente, cioè non arriva nessun avviso»*. Il dato arrivava già — mancava chi lo CONFRONTASSE.
//
// ⭐⭐ PERCHÉ IL CONFRONTO STA QUI E NON NEL BOT, ed è la regola ferrea del 19/08/2026:
// *«il bot deve prendere solo ordini dal gestionale»* — **il gestionale SA, il bot DICE**. Un
// bot che si tenesse la fotografia del roster di ieri per confrontarla con quella di oggi
// terrebbe una **memoria parallela** del gestionale, che è esattamente ciò che la voce 64 ha
// escluso. Qui invece il confronto lo fa chi il dato ce l'ha per mestiere: il sync, che la
// fotografia di prima ce l'ha già in mano (`existingPayloadByTypedKey`) perché la usa da sempre
// per decidere se riscrivere una riga.
//
// ⚖️ E il ③ delle tre decisioni — «toccato ≠ cambiato» — non costa una riga di codice: qui si
// confrontano DATI, non eventi. Lo staff che apre una scheda e la salva senza modificare niente
// produce due roster identici, e da due roster identici non esce nessun fatto. *Un rilevatore
// costruito sugli eventi («qualcuno ha salvato») avrebbe dovuto difendersi da quel caso; uno
// costruito sui dati non lo incontra proprio.*
//
// ── LE TRE DECISIONI DEL COMMITTENTE (21/08/2026), e dove vivono ────────────────────────────
// ① **un solo destinatario per gesto**: chi il gesto ha toccato. Sta QUI — ogni fatto nasce già
//    con una persona sola dentro, e non esiste un campo «e avvisa anche…».
// ② **due minuti di quiete, poi lo stato finale**: NON sta qui. Questo modulo dichiara ogni
//    passaggio; a fondere la raffica è chi consegna (`consumer-staff-events`), che vede i fatti
//    accumulati e li riduce al netto. Qui non si può: una funzione che guarda due fotografie
//    non sa se ne arriverà una terza fra dieci secondi.
// ③ **toccato ≠ cambiato**: gratis, vedi sopra.

/** Il roster di uno slot come lo si legge dal payload, più i dati che servono a nominarlo. */
export type SlotRoster = {
  /** Chiave dello slot: `data|ora|campo-in-cifre`. Stessa convenzione del readmodel. */
  slot: string;
  data: string;
  ora: string;
  campo: string;
  /** I nomi come li scrive il circolo, ripetizioni comprese (tre «Ospite» sono tre persone). */
  roster: string[];
};

/** Cosa è successo a UNA persona in UNA partita. */
export type FattoStaff = {
  slot: string;
  data: string;
  ora: string;
  campo: string;
  /** Il nome come lo scrive il circolo: chi consegna lo risolverà a una scheda. */
  persona: string;
  gesto: 'aggiunto' | 'tolto' | 'annullata';
};

/**
 * Il nome che NON è una persona: un posto occupato da qualcuno che il circolo non ha in
 * anagrafica. Non ha una scheda, non ha un Telegram, non si può avvisare.
 *
 * 🚨 Si CONTA nel roster (tre «Ospite» sono tre giocatori — decisione del committente del
 * 26/07, e il conteggio serve a sapere se la partita è piena) ma non è mai un DESTINATARIO.
 * È la stessa distinzione che il bot fa già in `testoSeiStatoTolto`, «mai un Ospite».
 */
export const NON_E_UNA_PERSONA = 'ospite';

/** Forma normalizzata per confrontare due nomi, mai per mostrarli. Gemella di `normName`. */
export function normNome(value: unknown): string {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Vero se questo nome può ricevere un messaggio, cioè se è una persona con una scheda. */
export function puoRicevere(nome: unknown): boolean {
  const n = normNome(nome);
  return !!n && n !== NON_E_UNA_PERSONA;
}

/**
 * Quante volte ogni nome compare in un roster. Serve perché i nomi si ripetono
 * («Ospite» soprattutto) e un conteggio che li fondesse direbbe che togliendo due ospiti
 * su tre non è cambiato niente.
 */
function conteggio(roster: string[]): Map<string, { quante: number; comeScritto: string }> {
  const m = new Map<string, { quante: number; comeScritto: string }>();
  for (const g of roster) {
    const n = normNome(g);
    if (!n) continue;
    const gia = m.get(n);
    if (gia) gia.quante += 1;
    else m.set(n, { quante: 1, comeScritto: String(g).trim() });
  }
  return m;
}

/**
 * ⚖️ LA GUARDIA CHE DECIDE SE CONFRONTARE, e senza la quale questo modulo è pericoloso.
 *
 * 🚨 Il caso da cui difendersi non è teorico: un sync che leggesse **parzialmente** il
 * Matchpoint — un export mozzato, una finestra più stretta, il primo giro su un database
 * vuoto — vedrebbe sparire centinaia di partite tutte insieme e manderebbe a centinaia di
 * soci un «la tua partita è stata annullata» **falso**. È il danno peggiore che questa voce
 * possa produrre: non un silenzio, ma una bugia, moltiplicata.
 *
 * ⇒ Si confronta solo quando la fotografia di PRIMA è credibile: c'era, e non è collassata.
 * `null` in `prima` significa «non lo so» ⇒ nessun fatto, che è il verso prudente.
 *
 * 📏 La soglia è sulla PROPORZIONE, non su un numero fisso: un circolo con 40 partite e uno
 * con 400 hanno lo stesso diritto alla protezione. Metà delle partite sparite in un colpo
 * non è una giornata di disdette, è un guasto della lettura.
 */
export const CROLLO_SOSPETTO = 0.5;

export function confrontoAttendibile(
  quantePrima: number,
  quanteDopo: number,
): boolean {
  if (quantePrima === 0) return false;              // primo giro, o database vuoto
  if (quanteDopo === 0) return false;               // export mozzato: MAI un annullamento di massa
  return quanteDopo >= quantePrima * CROLLO_SOSPETTO;
}

/**
 * I fatti nati dal confronto fra due fotografie del calendario.
 *
 * @param prima  Gli slot com'erano al sync precedente.
 * @param dopo   Gli slot come sono adesso.
 *
 * ⇒ Torna `[]` — e non un errore — quando il confronto non è attendibile: chi chiama non deve
 * decidere niente, e un silenzio non fa danno.
 */
export function fattiDaConfronto(
  prima: Map<string, SlotRoster>,
  dopo: Map<string, SlotRoster>,
): FattoStaff[] {
  if (!confrontoAttendibile(prima.size, dopo.size)) return [];

  const fatti: FattoStaff[] = [];

  for (const [slot, slotPrima] of prima) {
    const slotDopo = dopo.get(slot);

    // ── La partita non c'è più: annullata ─────────────────────────────────────────────
    // 🚨 Qui il destinatario NON è uno solo, e non è una deroga alla decisione ①: quella
    // risponde a «oltre all'interpellato, anche gli spettatori?». In un annullamento non ci
    // sono spettatori — la partita salta a TUTTI quelli che ci giocavano, e ognuno di loro è
    // «la persona interpellata». ⚖️ Il verso opposto lo dice meglio: avvisarne uno solo
    // manderebbe gli altri tre al campo per una partita che non c'è.
    if (!slotDopo) {
      for (const [, v] of conteggio(slotPrima.roster)) {
        if (!puoRicevere(v.comeScritto)) continue;
        fatti.push({
          slot,
          data: slotPrima.data,
          ora: slotPrima.ora,
          campo: slotPrima.campo,
          persona: v.comeScritto,
          gesto: 'annullata',
        });
      }
      continue;
    }

    // ── La partita c'è ancora: chi è entrato e chi è uscito ───────────────────────────
    const cPrima = conteggio(slotPrima.roster);
    const cDopo = conteggio(slotDopo.roster);
    const nomi = new Set([...cPrima.keys(), ...cDopo.keys()]);

    for (const n of nomi) {
      const a = cPrima.get(n);
      const b = cDopo.get(n);
      const quantePrima = a?.quante ?? 0;
      const quanteDopo = b?.quante ?? 0;
      if (quantePrima === quanteDopo) continue;
      const comeScritto = b?.comeScritto ?? a?.comeScritto ?? '';
      if (!puoRicevere(comeScritto)) continue;

      // Una persona vera compare una volta sola: la differenza di conteggio la riguarda
      // per intero, e un fatto solo la descrive. (I nomi che si ripetono sono gli
      // «Ospite», già esclusi qui sopra.)
      fatti.push({
        slot,
        data: slotDopo.data,
        ora: slotDopo.ora,
        campo: slotDopo.campo,
        persona: comeScritto,
        gesto: quanteDopo > quantePrima ? 'aggiunto' : 'tolto',
      });
    }
  }

  // ── Le partite NUOVE ─────────────────────────────────────────────────────────────────
  // ⭐ Chi finisce in una partita nata adesso è stato messo lì da qualcuno — tranne CHI L'HA
  // ORGANIZZATA, che è il primo dell'elenco (regola ferma del progetto: l'ordine della scheda
  // è la cronologia degli ingressi, e la usa già `rosterOrdinatoDelloSlot`).
  // 🚨 Il primo si salta perché è l'unico che la partita l'ha voluta: scrivergli «ti hanno
  // messo in partita» vorrebbe dire annunciare a qualcuno una cosa che ha appena fatto lui.
  // ⚠️ Limite dichiarato: se la partita nasce già completa in un colpo solo (segreteria che
  // la scrive con dentro quattro nomi), gli altri tre ricevono un avviso giusto; se invece un
  // socio prenota dal bot per sé e tre amici, quei tre ricevono lo stesso avviso — che è
  // altrettanto vero, perché in campo ce li ha messi lui e loro non lo sanno.
  for (const [slot, slotDopo] of dopo) {
    if (prima.has(slot)) continue;
    let primo = true;
    for (const g of slotDopo.roster) {
      if (!normNome(g)) continue;
      if (primo) { primo = false; continue; }   // l'organizzatore
      if (!puoRicevere(g)) continue;
      fatti.push({
        slot,
        data: slotDopo.data,
        ora: slotDopo.ora,
        campo: slotDopo.campo,
        persona: String(g).trim(),
        gesto: 'aggiunto',
      });
    }
  }

  return fatti;
}
