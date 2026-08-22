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
 * @param oggi   La data di oggi a Roma (`YYYY-MM-DD`): sotto questa, uno slot è passato e non
 *               produce nessun fatto — vedi la nota dentro la funzione.
 *
 * ⇒ Torna `[]` — e non un errore — quando il confronto non è attendibile: chi chiama non deve
 * decidere niente, e un silenzio non fa danno.
 */
export function fattiDaConfronto(
  prima: Map<string, SlotRoster>,
  dopo: Map<string, SlotRoster>,
  oggi: string,
): FattoStaff[] {
  // 🌙🚨⭐⭐ SI CONFRONTA SOLO LA FINESTRA CHE LE DUE FOTOGRAFIE HANNO IN COMUNE, e questa
  // riga è nata da un danno vero: la notte del 21/08/2026, all'una e un minuto, sono usciti
  // **36 falsi annullamenti su 32 persone** — tutti per le partite del giorno prima.
  //
  // ⇒ La causa non è un guasto: è il CALENDARIO. Il sync guarda da oggi in avanti, quindi a
  // ogni mezzanotte il giorno appena finito **esce dalla finestra**. La fotografia di prima ce
  // l'ha, quella di dopo no ⇒ per il confronto quelle partite sono «sparite», e sparire vuol
  // dire annullata. *Una partita già giocata non è stata annullata: è stata GIOCATA.*
  //
  // ⚖️ E `confrontoAttendibile` non poteva fermarlo, il che è la parte istruttiva: quella
  // guardia difende dal CROLLO — metà del calendario sparito insieme — ed è tarata su una
  // proporzione. A mezzanotte se ne va **un giorno su trenta**: troppo poco per farla
  // scattare, e abbastanza per mentire a tutti quelli che avevano giocato ieri.
  // ⇒ *Una protezione giusta puntata sul guasto sbagliato lascia passare quello che c'è.*
  //
  // 📌 Il filtro sta PRIMA della guardia apposta: le proporzioni vanno misurate sulla stessa
  // finestra, o il calo fisiologico di ogni notte le falserebbe comunque.
  const nellaFinestra = (m: Map<string, SlotRoster>) => {
    const out = new Map<string, SlotRoster>();
    for (const [k, v] of m) if (!v.data || v.data >= oggi) out.set(k, v);
    return out;
  };
  prima = nellaFinestra(prima);
  dopo = nellaFinestra(dopo);

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

/**
 * La chiave di uno slot: `data|ora|campo-in-cifre`.
 *
 * ⭐ Stessa convenzione di `consumer-player-readmodel`, e non per gusto dell'uniformità: la
 * stessa partita esiste in più copie che scrivono il campo in due modi diversi («Campo 1» dal
 * sync Matchpoint, «1» dallo `staff_booking` dell'app). Tenendo solo le cifre le due copie
 * cadono nella stessa chiave; tenendo il testo diventerebbero due partite.
 */
export function chiaveSlot(data: unknown, ora: unknown, campo: unknown): string {
  const d = String(data ?? '').trim();
  const o = String(ora ?? '').trim();
  const c = String(campo ?? '').replace(/\D/g, '');
  return `${d}|${o}|${c}`;
}

/**
 * La fotografia del calendario: uno slot per partita, col roster più completo fra le sue copie.
 *
 * 🚨 «Il più completo» e non «l'unione»: le copie sono la STESSA partita e ognuna ripete
 * l'intero elenco. Unirle nome per nome fonderebbe gli «Ospite» di una stessa partita in uno
 * solo — è il difetto che `compagni-slot.ts` ha già pagato una volta, e la cura è la stessa.
 *
 * @param righe   I payload delle prenotazioni (una riga per copia).
 * @param roster  Come si leggono i nomi da una descrizione. Si passa da fuori per non fare
 *                una TERZA copia del parser: quello vero vive già in `index.ts` e in
 *                `compagni-slot.ts`, e una terza divergerebbe.
 */
export function fotografia(
  righe: Array<Record<string, unknown>>,
  roster: (descrizione: unknown) => string[],
): Map<string, SlotRoster> {
  const foto = new Map<string, SlotRoster>();
  for (const p of righe) {
    const data = String(p?.data ?? '').trim();
    const ora = String(p?.ora ?? '').trim();
    const campo = String(p?.campo ?? '').trim();
    if (!data) continue;
    const nomi = roster(p?.descrizione);
    if (!nomi.length) continue;   // titoli liberi («Torneo aziendale»): non è un roster
    const slot = chiaveSlot(data, ora, campo);
    const gia = foto.get(slot);
    if (!gia || nomi.length > gia.roster.length) {
      foto.set(slot, { slot, data, ora, campo, roster: nomi });
    }
  }
  return foto;
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// 🚨⭐⭐ VOCE 73 — LA FOTOGRAFIA DI PRIMA NON È «COSA C'È ADESSO CHE È VECCHIO»: È COSA C'ERA
//    L'ULTIMA VOLTA CHE HO GUARDATO. E qualcuno, nel frattempo, riscriveva il passato.
//
// 📏 Misurato il 22/08/2026, non dedotto: due partite annullate dal gestionale alle 10:53:59 e
// 10:54:08 UTC, e **zero fatti** in coda. Il socio non ha saputo niente — ed è il gesto che gli
// toglie il campo: chi non lo sa **si presenta a giocare**.
//
// 🔎 LA CAUSA È UNA CURA DELL'INTERFACCIA CHE NE SPEGNE UN'ALTRA. L'app, annullando, seppellisce
// subito le proprie copie `booking` dello slot (`deleted: true` — «v5.897, Cura del
// flicker-annullo», in `index.html`): senza, per qualche secondo un refresh ri-mostrava la
// partita appena annullata. Ma la fotografia di PRIMA nasce da `pmo_cloud_records` letto con
// `.eq('deleted', false)` ⇒ al giro dopo, quello slot **nella fotografia di prima non c'è già
// più**.
// ⇒ *La partita non è sparita fra le due fotografie: nella prima non c'era.* Nessuna sparizione,
//   nessun fatto, nessun avviso.
//
// ⚖️ È IL ROVESCIO ESATTO DEL PREGIO DELLA VOCE 68. Confrontare **dati** invece di **eventi**
// regala il «toccato ≠ cambiato» e costa i cambiamenti che qualcun altro ha già scritto nella
// fotografia. La voce 70 era la stessa scelta che nasconde **CHI**; questa è la stessa scelta
// che nasconde **CHE COSA**, quando a cambiarlo è l'app.
//
// 🔨 LA CURA — e la parte da capire è PERCHÉ non basta «leggere anche le righe sepolte».
// Sepolte lo sono anche quelle che il sync stesso mette via ogni giro, quando una partita
// sparisce da Matchpoint per davvero: resuscitarle **tutte** rifarebbe nascere, un giro dopo,
// i fatti già dichiarati — un «la tua partita è stata annullata» al giro, per sempre.
// ⇒ Si resuscita **solo ciò che l'app dichiara di aver seppellito lei**, e la dichiarazione
//   esiste già e non è stata inventata per l'occasione: `staff_suppress`, che l'app scrive
//   nello stesso istante e per lo stesso slot (`supp|<data>|<campo>|<ora>`). Il sync una
//   soppressione non la scrive **mai** ⇒ le sue lapidi non possono entrare da questa porta.
//
// ⏱️ E la finestra è «da quando ho guardato l'ultima volta», non «gli ultimi N minuti»: una
// soglia a tempo farebbe rientrare lo stesso slot per più giri di fila. Il confine è
// l'`importedAt` del giro precedente, che è l'istante in cui è stato preso l'export — quindi
// *ciò che l'app ha dichiarato dopo che avevo già guardato*, cioè esattamente ciò che il giro
// precedente non poteva vedere.
//
// ⚠️ IL RESIDUO, dichiarato: se l'annullo su Matchpoint cade nei pochi secondi **fra** l'export
// del giro precedente e la dichiarazione dell'app, il fatto può nascere due volte — una dal
// giro precedente (che nell'export vedeva già lo slot sparito) e una da qui. Non si perde
// nessun avviso e non se ne inventa nessuno: se ne dice uno due volte, e a fonderli c'è già la
// riduzione di `consumer-staff-events`, che ragiona per coppia (persona, partita).
// ⇒ Il verso in cui questa cura sbaglia è **ripetere**, mai **tacere**: è il verso giusto per
//   un avviso che, mancando, manda qualcuno al campo per niente.
// ══════════════════════════════════════════════════════════════════════════════════════════

/** Una riga sepolta (`deleted: true`) come arriva da `pmo_cloud_records`. */
export type RigaSepolta = { payload?: Record<string, unknown> | null };

/** Una soppressione dichiarata dall'app: lo slot che ha appena annullato. */
export type SoppressioneDichiarata = {
  payload?: Record<string, unknown> | null;
  deleted?: boolean | null;
  updated_at?: string | null;
};

/**
 * Gli slot che l'app dichiara di aver annullato **dopo** il confine, come chiavi di slot.
 *
 * 🚨 `deleted` si guarda: una soppressione ritirata (l'annullo rifiutato da Matchpoint, e l'app
 * che rimette a posto) non deve resuscitare niente — lì la partita non è mai sparita.
 * 🚨 Un `updated_at` illeggibile vale **fuori finestra**: davanti a un istante che non si sa
 * leggere, il verso prudente è non resuscitare — al massimo si perde un avviso, che è il danno
 * piccolo, invece di rifarne nascere uno vecchio, che è quello grosso.
 */
export function slotDichiaratiAnnullati(
  soppressioni: SoppressioneDichiarata[],
  confineIso: string,
): Set<string> {
  const confine = Date.parse(String(confineIso ?? ''));
  const slot = new Set<string>();
  if (!Number.isFinite(confine)) return slot;   // confine ignoto ⇒ non si resuscita niente
  for (const s of soppressioni || []) {
    if (s?.deleted === true) continue;
    const quando = Date.parse(String(s?.updated_at ?? ''));
    if (!Number.isFinite(quando) || quando <= confine) continue;
    const p = (s?.payload || {}) as Record<string, unknown>;
    const chiave = chiaveSlot(p?.data, p?.ora, p?.campo);
    if (chiave.split('|').every((pezzo) => pezzo)) slot.add(chiave);
  }
  return slot;
}

/**
 * Le righe sepolte che tornano nella fotografia di PRIMA: quelle, e soltanto quelle, degli slot
 * che l'app dichiara di aver annullato dopo il confine.
 *
 * ⇒ Torna i **payload**, cioè quello che `fotografia()` sa leggere: la riga sepolta se li porta
 * ancora dietro interi, roster compreso (`descrizione`), ed è ciò che rende la cura possibile
 * senza chiedere niente a nessuno — l'elenco di chi c'era è già lì, nella lapide.
 */
export function sepoltiDaResuscitare(
  sepolti: RigaSepolta[],
  soppressioni: SoppressioneDichiarata[],
  confineIso: string,
): Array<Record<string, unknown>> {
  const slot = slotDichiaratiAnnullati(soppressioni, confineIso);
  if (!slot.size) return [];
  const fuori: Array<Record<string, unknown>> = [];
  for (const r of sepolti || []) {
    const p = (r?.payload || {}) as Record<string, unknown>;
    if (slot.has(chiaveSlot(p?.data, p?.ora, p?.campo))) fuori.push(p);
  }
  return fuori;
}
