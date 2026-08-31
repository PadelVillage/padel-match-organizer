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
//    🔄🚨⭐⭐ SUPERATA il 23/08/2026, e la riga si CORREGGE invece di affiancarla: *«quando la
//    segreteria fa un qualsiasi tipo di operazione, le persone che sono dentro la partita
//    devono essere avvisate»*. La forma resta — un fatto porta ancora **una persona sola** —
//    ma di fatti ne nascono **di più**: uno per ciascuno di quelli in campo. La ① era stata
//    superata per l'annullo (voce 74) e per lo spostamento (voce 76), e restava applicata
//    all'entrata e all'uscita di un giocatore fino al **31/08** (voce 79), cioè nel caso più
//    frequente di tutti: la segreteria che compone una partita.
//    ⇒ Chi resta in campo riceve il gesto `formazione`, che nasce QUI come tutti gli altri.
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
  /** `Partita` o `Lezione Libera`, come lo scrive Matchpoint. Assente = non lo so. */
  tipo?: string;
  /**
   * ⭐⭐ QUALE prenotazione occupa questo slot — la chiave che distingue *spostata* da
   * *annullata + prenotata di nuovo*, e senza la quale le due sono indistinguibili.
   *
   * 📏 È `numero`, non `idReserva`, e la differenza è misurata su PROD il 23/08: sulle 122
   * righe `booking` vive `numero` c'è **122** volte e `idReserva` **70** — quest'ultimo sta
   * sulla capofila e manca sulle righe degli altri giocatori. Dove ci sono entrambi non
   * discordano mai (0 su 70).
   * ⚠️ Assente ⇒ di questo slot non si può dire se si è mosso, e si tratta come prima.
   */
  prenotazione?: string;
};

/** Cosa è successo a UNA persona in UNA partita. */
export type FattoStaff = {
  slot: string;
  data: string;
  ora: string;
  campo: string;
  /** Il nome come lo scrive il circolo: chi consegna lo risolverà a una scheda. */
  persona: string;
  /**
   * 👥 `formazione` è il QUINTO gesto, dal 31/08/2026 (voce 79): la partita è la stessa e
   * questa persona ci resta dentro — a cambiare sono i **compagni**. È l'unico gesto il cui
   * destinatario non è chi si è mosso, ed è nato proprio per quello.
   */
  gesto: 'aggiunto' | 'tolto' | 'annullata' | 'spostata' | 'formazione';
  /**
   * Che cosa è lo slot, **detto con le parole del gestionale**: `'lezione'` o `'partita'`.
   *
   * 🔒⭐ NON è il tipo di Matchpoint, ed è deliberato: `Lezione Libera` è una parola SUA, e la
   * regola ferrea del 19/08 dice che al bot non arrivano i nomi dei nostri pezzi interni né
   * quelli del sistema che stiamo per dismettere. Il giorno in cui Matchpoint si spegne,
   * questa colonna e il bot **non si toccano**: cambia solo chi la riempie.
   * ⚠️ Assente = non lo so ⇒ a valle vale «partita», che è il comportamento di prima.
   */
  tipo?: TipoSlot;
  /**
   * 🔄 Solo su `spostata`: **da dove** si è mossa. Le coordinate principali del fatto sono
   * quelle NUOVE — è lì che si va a giocare — e queste dicono da dove, perché il socio quella
   * partita ce l'ha in testa com'era prima.
   */
  da?: { data: string; ora: string; campo: string };
  /**
   * 👥 Solo su `formazione`: chi è entrato e chi è uscito da questa partita, coi nomi come
   * li scrive il circolo — **«Ospite» compreso**.
   *
   * 🚨 E l'ospite ci sta di proposito: `puoRicevere` decide chi RICEVE un messaggio, non chi
   * si può NOMINARE dentro a un messaggio. Sono due domande diverse, e averle confuse è ciò
   * che rendeva invisibile l'ospite aggiunto — il caso esatto da cui la voce 79 nasce.
   * ⚠️ Le ripetizioni contano: tre «Ospite» entrati sono tre posti presi, non uno.
   */
  entrati?: string[];
  usciti?: string[];
};

/** Che cos'è uno slot, con le parole del gestionale. */
export type TipoSlot = 'lezione' | 'partita';

/**
 * Il nome che NON è una persona: un posto occupato da qualcuno che il circolo non ha in
 * anagrafica. Non ha una scheda, non ha un Telegram, non si può avvisare.
 *
 * 🚨 Si CONTA nel roster (tre «Ospite» sono tre giocatori — decisione del committente del
 * 26/07, e il conteggio serve a sapere se la partita è piena) ma non è mai un DESTINATARIO.
 * È la stessa distinzione che il bot fa già in `testoSeiStatoTolto`, «mai un Ospite».
 */
export const NON_E_UNA_PERSONA = 'ospite';

/** Il testo ripulito, o `undefined` se non c'è niente da tenere. */
function clean(v: unknown): string | undefined {
  const t = String(v ?? '').trim();
  return t || undefined;
}

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

// ══════════════════════════════════════════════════════════════════════════════════════════
// 🗣️⭐⭐ VOCE 74 — «QUANDO SI TRATTA DI UNA LEZIONE, QUEI GIOCATORI CHE STANNO NELL'ELENCO
//    DEVONO RICEVERE LA NOTIFICA.» Decisione del committente, 22/08/2026.
//
// 📏 Il fatto che l'ha provocata, misurato quel pomeriggio: la lezione di Maria Pia Bettiol
// si sposta dalle 10:00 alle 12:30 del 25/08. Lo slot vecchio sparisce (⇒ `annullata`,
// consegnato), quello nuovo nasce — e per il nuovo **nessun fatto**. Sul telefono le è
// arrivato «la tua partita non c'è più» e nient'altro, mentre la lezione esisteva ancora.
//
// 🔎 LA CAUSA era una regola giusta applicata dove non vale: nelle partite nuove si salta **il
// primo dell'elenco**, perché è l'organizzatore e annunciargli ciò che ha appena fatto lui
// sarebbe la voce 70. Ma una lezione **non ha un organizzatore fra i giocatori**: la scrive la
// segreteria, e se il socio è uno solo il primo dell'elenco è anche l'unico ⇒ si saltava
// l'unica persona da avvisare.
//
// ⚖️ E il salto era comunque un SURROGATO. La domanda vera non è «chi è il primo?», è **«chi
// ha chiesto la scrittura?»** — e a quella, dal 22/08, risponde la RICEVUTA della voce 70,
// che copre tutte e cinque le scritture del ponte, `create` compresa. ⇒ Togliere il salto
// nelle lezioni non riapre il difetto della 70: chi prenota dal bot resta coperto dalla
// ricevuta, che è la risposta esatta invece che il suo surrogato.
//
// 🚨 Perché il salto RESTA sulle partite: lì il primo dell'elenco è davvero chi l'ha voluta, e
// la ricevuta copre solo ciò che passa dal ponte — una partita scritta a mano sul gestionale
// dall'organizzatore stesso non lascia ricevuta, e senza il salto gli si annuncerebbe il
// proprio gesto. Due casi diversi, due regole diverse, e la differenza è nel DATO.
// ══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Vero se questo slot è una LEZIONE.
 *
 * 📏 Misurato su PROD prima di scriverlo: `tipo` ha due soli valori in tutta la tabella —
 * `Partita` (3030 righe) e `Lezione Libera` (1230). Non è un campo libero.
 * 🚨 Si riconosce la lezione per la parola «lezione», non per «diverso da Partita»: se domani
 * Matchpoint aggiungesse un terzo tipo (un torneo, una manutenzione), «diverso da Partita» lo
 * tratterebbe da lezione **senza che nessuno se ne accorga**, cioè avviserebbe anche il primo
 * dell'elenco di una cosa che non è una lezione. ⇒ Il verso in cui si sbaglia è tacere.
 * ⚠️ `tipo` assente vale **non lezione**: è il comportamento di prima, e un fatto vecchio o una
 * riga senza tipo non deve cambiare di segno.
 */
export function eLezione(tipo: unknown): boolean {
  return /lezione/i.test(String(tipo ?? ''));
}

/**
 * Il tipo di Matchpoint tradotto nella parola del gestionale.
 *
 * ⭐ La traduzione sta QUI, in un punto solo, e ciò che esce da questo modulo non nomina più
 * Matchpoint: chi legge il fatto — la coda, il ponte, il bot — vede `lezione` o `partita` e
 * non ha bisogno di sapere come li chiamava il sistema di prima.
 */
export function tipoDelloSlot(tipoGrezzo: unknown): TipoSlot {
  return eLezione(tipoGrezzo) ? 'lezione' : 'partita';
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

  // 🔄⭐⭐ DOVE È FINITA CIASCUNA PRENOTAZIONE — 23/08/2026, la metà Ⓑ della regola del
  // committente (*«gli avvisi se devono arrivare devono arrivare corretti fino in fondo»*).
  //
  // 📏 Il fatto che l'ha chiesta: spostando una partita dalle 09:30 campo 1 alle 11:30 campo 2,
  // al socio arrivava **«La tua partita non c'è più… è stata annullata dal circolo»** e
  // nient'altro — misurato due volte, in tutt'e due i versi. La partita esisteva.
  // 🔎 La causa è che questo confronto guarda gli **SLOT**: uno slot sparisce, un altro nasce, e
  // da fuori è indistinguibile da un annullo più una prenotazione nuova.
  // ⇒ Con l'identità della prenotazione le due cose si distinguono: **stessa prenotazione,
  //   slot diverso = spostata**. È la stessa chiave che il 23/08 ha curato la verifica
  //   dell'esito nel ponte — là serviva a contare, qui a seguire.
  // ⚠️ Chi non ha identità non entra nell'indice, e resta trattato come prima: il verso in cui
  //   si sbaglia è dire «annullata» di uno spostamento, che è ciò che già succede oggi.
  const doveSonoFinite = new Map<string, SlotRoster>();
  for (const [, v] of dopo) if (v.prenotazione) doveSonoFinite.set(v.prenotazione, v);
  /** Gli slot NUOVI che sono già stati raccontati come spostamento: non sono partite nuove. */
  const natiDaUnoSpostamento = new Set<string>();

  for (const [slot, slotPrima] of prima) {
    const slotDopo = dopo.get(slot);

    // ── La prenotazione non è sparita: si è MOSSA ────────────────────────────────────
    // 🚨 Prima del ramo «annullata», perché è il caso che quel ramo raccontava male.
    const altrove = !slotDopo && slotPrima.prenotazione
      ? doveSonoFinite.get(slotPrima.prenotazione)
      : undefined;
    if (altrove && altrove.slot !== slot) {
      natiDaUnoSpostamento.add(altrove.slot);
      const daDove = { data: slotPrima.data, ora: slotPrima.ora, campo: slotPrima.campo };
      // ⚖️ Uno spostamento può portarsi dietro anche un cambio di giocatori, e le tre cose si
      // dicono diverse: chi resta legge «spostata», chi è stato tolto legge «non sei più
      // dentro», chi è stato messo legge «sei in campo». Dire «spostata» a chi è stato tolto
      // lo manderebbe a giocare a un'ora nuova per una partita che non è più sua.
      const cPrima = conteggio(slotPrima.roster);
      const cDopo = conteggio(altrove.roster);
      for (const n of new Set([...cPrima.keys(), ...cDopo.keys()])) {
        const eraDentro = (cPrima.get(n)?.quante ?? 0) > 0;
        const eDentro = (cDopo.get(n)?.quante ?? 0) > 0;
        const comeScritto = cDopo.get(n)?.comeScritto ?? cPrima.get(n)?.comeScritto ?? '';
        if (!puoRicevere(comeScritto)) continue;
        const gesto = eraDentro && eDentro ? 'spostata' : (eDentro ? 'aggiunto' : 'tolto');
        fatti.push({
          // ⭐ Le coordinate del fatto sono quelle NUOVE — è lì che si va a giocare — tranne
          // per chi è stato tolto, che di quel posto nuovo non deve sapere niente.
          slot: gesto === 'tolto' ? slot : altrove.slot,
          data: gesto === 'tolto' ? slotPrima.data : altrove.data,
          ora: gesto === 'tolto' ? slotPrima.ora : altrove.ora,
          campo: gesto === 'tolto' ? slotPrima.campo : altrove.campo,
          persona: comeScritto,
          gesto,
          tipo: tipoDelloSlot((gesto === 'tolto' ? slotPrima : altrove).tipo),
          ...(gesto === 'spostata' ? { da: daDove } : {}),
        });
      }
      continue;
    }

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
          tipo: tipoDelloSlot(slotPrima.tipo),
        });
      }
      continue;
    }

    // ── La partita c'è ancora: chi è entrato e chi è uscito ───────────────────────────
    const cPrima = conteggio(slotPrima.roster);
    const cDopo = conteggio(slotDopo.roster);
    const nomi = new Set([...cPrima.keys(), ...cDopo.keys()]);

    // 👥 VOCE 79 — CHI È ENTRATO E CHI È USCITO, tenuti da parte per chi RESTA. Gli
    // «Ospite» ci sono: non ricevono niente, ma un posto preso da un ospite è un compagno
    // in meno, ed è esattamente il caso da cui la voce nasce.
    const entrati: string[] = [];
    const usciti: string[] = [];
    /** Chi era dentro prima ed è dentro adesso, senza che il suo conto sia cambiato. */
    const restati: string[] = [];

    for (const n of nomi) {
      const a = cPrima.get(n);
      const b = cDopo.get(n);
      const quantePrima = a?.quante ?? 0;
      const quanteDopo = b?.quante ?? 0;
      const comeScritto = b?.comeScritto ?? a?.comeScritto ?? '';
      if (quantePrima === quanteDopo) {
        if (quanteDopo > 0 && puoRicevere(comeScritto)) restati.push(comeScritto);
        continue;
      }
      // ⚖️ Gli elenchi si riempiono PRIMA del filtro dei destinatari: `puoRicevere` decide
      // chi riceve un messaggio, non chi si può NOMINARE dentro a un messaggio. Sono due
      // domande diverse, e confonderle è ciò che rendeva invisibile l'ospite aggiunto.
      const quanti = Math.abs(quanteDopo - quantePrima);
      for (let i = 0; i < quanti; i += 1) (quanteDopo > quantePrima ? entrati : usciti).push(comeScritto);
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
        tipo: tipoDelloSlot(slotDopo.tipo),
      });
    }

    // 🗣️🚨⭐⭐ VOCE 79, 31/08/2026 — E ADESSO ANCHE CHI RESTA IN CAMPO. Regola del
    // committente del 23/08: *«quando la segreteria fa un qualsiasi tipo di operazione, le
    // persone che sono dentro la partita devono essere avvisate»*.
    //
    // 📏 Il difetto, segnalato da lui guardando il proprio telefono il 23/08 (*«a Maurizio
    // non è arrivato nessun messaggio che si è aggiunto un ospite o si era levato un
    // ospite»*) e rimisurato la notte stessa su tre gesti in un colpo: fuori Lidia, fuori
    // Fabiola, dentro Marco ⇒ tre fatti, intestati **a loro tre**. A Maurizio e a Laura, che
    // erano e restano in campo: **zero**.
    //
    // ⚖️ È la decisione ① del 21/08 (*«un solo destinatario per gesto: chi il gesto ha
    // toccato»*, scritta in testa a questo file) che la regola del 23/08 ha superato. Era
    // già stata superata per l'annullo (voce 74) e per lo spostamento (voce 76) — questo è
    // il terzo caso, ed è **il più frequente di tutti**: la segreteria che compone una
    // partita. ⇒ La riga ① in testa al file è stata corretta, non affiancata.
    //
    // 🚨 IL FATTO NASCE DA UN GESTO, NON DA UN CONTEGGIO, ed è l'altra metà della voce. La
    // macchina dei promemoria del bot raccontava il **netto** (`giocatori_visti`, prima e
    // dopo) come se fosse un evento: due uscite e un ingresso caduti nella stessa finestra
    // si annullavano fino a «un giocatore è uscito». Qui il conto non c'entra: si dice chi è
    // entrato e chi è uscito perché lo si è appena confrontato nome per nome.
    //
    // ⚠️ Solo se qualcosa è cambiato davvero: due roster identici non producono niente, come
    // per tutto il resto di questo modulo (la decisione ③, «toccato ≠ cambiato»).
    if (entrati.length || usciti.length) {
      for (const persona of restati) {
        fatti.push({
          slot,
          data: slotDopo.data,
          ora: slotDopo.ora,
          campo: slotDopo.campo,
          persona,
          gesto: 'formazione',
          tipo: tipoDelloSlot(slotDopo.tipo),
          entrati: [...entrati],
          usciti: [...usciti],
        });
      }
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
    // 🔄 Non è una partita nuova: è quella di prima, altrove — già raccontata come spostamento.
    if (natiDaUnoSpostamento.has(slot)) continue;
    // 🗣️🚨⭐⭐ 23/08/2026 — IL SALTO DEL PRIMO NON C'È PIÙ, PER NESSUNO. Regola del committente:
    //
    //   *«Quando la segreteria fa un qualsiasi tipo di operazione, le persone che sono dentro
    //   la partita devono essere avvisate.»*  ·  *«Logicamente questa regola vale anche per una
    //   lezione.»*
    //
    // 📏 IL DANNO MISURATO, sui suoi due spostamenti del 23/08: nascevano `annullata` per lo
    // slot vecchio e **zero** `aggiunto` per quello nuovo. La controprova stava nella stessa
    // tabella — su una partita di quattro nascevano tre `aggiunto` e mancava **il primo
    // dell'elenco**. ⇒ Su una partita di più persone si perdeva un avviso su quattro; su una di
    // **una sola** si perdeva l'unico, e non arrivava niente.
    //
    // ⚖️ IL SALTO ERA UN SURROGATO, ed è la ragione per cui cade senza riaprire la voce 70. La
    // domanda vera non è «chi è il primo dell'elenco?» ma **«chi ha chiesto la scrittura?»**, e
    // a quella risponde la RICEVUTA: le due divergono esattamente dove il surrogato sbagliava —
    // una partita scritta dalla segreteria per un socio solo ha un primo dell'elenco che non ha
    // chiesto niente.
    // ⭐ E la rete era già tesa, scritta apposta per oggi: `consumer-booking-write` lascia una
    // ricevuta anche sulla `create` dal bot, col commento *«questa ricevuta oggi non copre
    // niente, ed è una RETE… regge il giorno in cui l'ordine cambiasse»*. Quel giorno è oggi.
    // 📏 Finestra della ricevuta 20′ (più 3′ di tolleranza) contro un sync che vede in ~2′
    // (massimo misurato 10′04″) ⇒ copre con margine.
    // 🚨 E `consumer-staff-events` **fallisce chiuso**: se le ricevute non si leggono non
    // consegna niente e riprova al giro dopo. Il verso in cui si sbaglia resta il silenzio.
    for (const g of slotDopo.roster) {
      if (!normNome(g)) continue;
      if (!puoRicevere(g)) continue;
      fatti.push({
        slot,
        data: slotDopo.data,
        ora: slotDopo.ora,
        campo: slotDopo.campo,
        persona: String(g).trim(),
        gesto: 'aggiunto',
        tipo: tipoDelloSlot(slotDopo.tipo),
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
      // ⚠️ Il `tipo` viaggia con la copia scelta, non si fonde: le copie sono la STESSA
      // partita e lo ripetono uguale — prenderlo da un'altra riga sarebbe una terza fonte.
      foto.set(slot, {
        slot, data, ora, campo, roster: nomi, tipo: clean(p?.tipo),
        // ⚠️ Come il `tipo`: viaggia con la copia scelta e non si fonde da più righe.
        prenotazione: clean(p?.numero) ?? clean(p?.id_reserva) ?? clean(p?.idReserva),
      });
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

// ══════════════════════════════════════════════════════════════════════════════════════════
// 🚨⭐⭐ VOCE 76 — NON RACCONTARE DUE VOLTE CIÒ CHE IL GESTIONALE HA GIÀ DETTO.
//
// 🗣️ Dalla risposta del committente del 23/08 alla domanda ② della scheda: *«il sync resta
// rete»*. ⇒ Le due strade si sommano (paletto ⑤): la CONFERMA è quella veloce e l'unica che
// sopravvive allo spegnimento di Matchpoint; il SYNC resta per ciò che cambia sul vecchio
// sistema **senza passare dal gestionale** — chi prenota al banco — e come rete se una
// dichiarazione si perde.
//
// ⚖️ Ma due strade che raccontano lo stesso gesto sono **due messaggi allo stesso socio**, e
// *un avviso doppio è il difetto che questo progetto evita apposta da sempre* (voce 63). Il
// sync, rileggendo Matchpoint minuti dopo, ri-scopre esattamente ciò che la conferma ha già
// dichiarato: qui si toglie quel doppione.
//
// ⭐⭐ E LA FINESTRA NON È UNA COSTANTE, ed è la parte che vale la pena leggere. Verrebbe da
// scrivere «le conferme degli ultimi N minuti», e sarebbe sbagliato in un caso preciso: il
// sync **si ferma dall'01:00 alle 06:00** (Europe/Rome). Un annullo confermato alle 00:58
// viene ri-scoperto alle 06:02 — **cinque ore dopo** — e qualunque N ragionevole l'avrebbe
// lasciato passare come doppione.
// ⇒ La finestra giusta è quella che il CONFRONTO copre davvero: **dal giro precedente in qua**,
// che è lo stesso confine che la voce 73 usa già per le lapidi. Se un fatto sta per nascere da
// questo confronto, la sua dichiarazione — se c'è — è per forza dentro quell'intervallo.
//
// 🚨 IL VERSO IN CUI SI SBAGLIA, dichiarato: una finestra troppo LARGA scarta un avviso vero,
// una troppo STRETTA ne manda uno doppio. Si sceglie larga (col margine qui sotto) perché il
// progetto ha già deciso da che parte stare — *un avviso in meno è un fastidio, un avviso
// doppio è allarme per un fatto che non è successo*.
// ⚖️ E il falso scarto qui **non ha quasi casi**: la chiave è (slot, persona, gesto), e i due
// gesti che si dichiarano non si ripetono identici. Spostare e rispostare la stessa partita dà
// due `spostata` con slot di ARRIVO diversi ⇒ due chiavi diverse; una partita annullata due
// volte non esiste.

/**
 * Quanto si guarda indietro OLTRE il confine, cercando le dichiarazioni già fatte.
 *
 * 🚨 Serve perché la conferma e la sua comparsa su Matchpoint non sono lo stesso istante: il
 * circolo dice sì, e il tabellone da cui il sync legge può esporre la modifica un momento
 * dopo. Un fatto dichiarato poco PRIMA del giro può quindi essere ri-scoperto dal giro
 * SUCCESSIVO, cioè oltre il confine — e senza questo margine uscirebbe come doppione.
 */
export const MARGINE_DEDUP_CONFERME_MS = 30 * 60 * 1000;

/** Una dichiarazione già in coda, come si legge dal database. */
export type DichiarazioneGiaFatta = {
  slot?: string | null;
  persona?: string | null;
  gesto?: string | null;
  /**
   * 👥 Su `formazione`: **cosa** era già stato detto. Sugli altri quattro gesti non serve — lì
   * la chiave basta — e chi non li manda torna al comportamento di prima.
   */
  entrati?: string[] | null;
  usciti?: string[] | null;
};

/**
 * Da quale istante leggere le dichiarazioni da conferma, dato il confine dell'ultimo giro.
 *
 * ⚠️ Confine assente (primissimo giro, o registro illeggibile) ⇒ `null`: **non si deduplica
 * niente**. È il verso prudente al contrario del solito, e va detto — senza confine non si sa
 * quale intervallo il confronto stia coprendo, e scartare alla cieca perderebbe avvisi veri
 * per sempre. Meglio un doppione una volta che un silenzio che non si scopre.
 */
export function finestraDedup(confineIso: string | null | undefined): string | null {
  const t = Date.parse(String(confineIso ?? ''));
  if (!Number.isFinite(t)) return null;
  return new Date(t - MARGINE_DEDUP_CONFERME_MS).toISOString();
}

/** La chiave con cui un fatto e la sua dichiarazione si riconoscono. */
export function chiaveFatto(slot: unknown, persona: unknown, gesto: unknown): string {
  return `${String(slot ?? '')} ${normNome(persona)} ${String(gesto ?? '')}`;
}

/**
 * 👥 Quello che resta di un elenco dopo aver tolto ciò che è già stato detto, **contando le
 * ripetizioni**: tre «Ospite» meno uno fanno due, non zero.
 */
function meno(elenco: readonly string[], gia: readonly string[]): string[] {
  const restano = [...elenco];
  for (const g of gia) {
    const i = restano.findIndex((x) => normNome(x) === normNome(g));
    if (i >= 0) restano.splice(i, 1);
  }
  return restano;
}

/**
 * I fatti da accodare davvero: quelli che il gestionale non ha già dichiarato.
 *
 * ⭐ Torna anche gli SCARTATI, e non per simmetria: senza, il registro direbbe solo «ne ho
 * accodati meno» e non si potrebbe distinguere *il dedup ha funzionato* da *il confronto non
 * ha trovato niente*. Sono due cose diverse e una delle due è un guasto.
 *
 * 🚨⭐⭐ E SU `formazione` NON SI SCARTA IN BLOCCO, SI **SOTTRAE** — 31/08/2026, e questa
 * distinzione è nata da una sonda scritta apposta prima di dichiarare il quinto gesto dalla
 * conferma, non da un danno visto dopo.
 *
 * 📏 Il difetto che la sonda ha trovato: su `aggiunto`/`tolto` la chiave `(slot, persona,
 * gesto)` dice **cosa** è successo, perché `persona` è chi si è **mosso** — due cambi diversi
 * hanno chiavi diverse e non si toccano. Su `formazione` `persona` è chi **riceve** ⇒ due
 * cambi diversi sullo stesso slot producono la **stessa chiave**, e il dedup butterebbe via
 * anche quello che nessuno aveva dichiarato.
 *
 * ⇒ Il caso concreto, e non è teorico: la segreteria aggiunge un ospite **dal gestionale**
 * (⇒ dichiarato dalla conferma) e poi ne mette un altro **da Matchpoint** (⇒ nessuna
 * dichiarazione). Il sync li vede tutti e due, trova la chiave già usata, e il socio saprebbe
 * del primo e non del secondo.
 *
 * ⚖️ La sottrazione è la stessa regola che la riduzione applica già a valle — *com'era
 * all'inizio contro com'è alla fine* — portata a monte: si toglie ciò che è già stato detto e
 * si accoda solo se resta qualcosa. Vuoto ⇒ è un vero doppione ⇒ si scarta.
 * ⚠️ Una dichiarazione senza elenchi (un fatto vecchio, o un gestionale che non li manda) vale
 * **elenco vuoto**: non sottrae niente, e il fatto passa. Il verso in cui si sbaglia torna a
 * essere il doppione, mai il silenzio.
 */
export function togliGiaDichiarati(
  fatti: readonly FattoStaff[],
  gia: readonly DichiarazioneGiaFatta[],
): { daAccodare: FattoStaff[]; scartati: FattoStaff[] } {
  if (!gia.length) return { daAccodare: [...fatti], scartati: [] };
  const perChiave = new Map<string, DichiarazioneGiaFatta[]>();
  for (const d of gia) {
    const k = chiaveFatto(d?.slot, d?.persona, d?.gesto);
    const lista = perChiave.get(k);
    if (lista) lista.push(d);
    else perChiave.set(k, [d]);
  }
  const daAccodare: FattoStaff[] = [];
  const scartati: FattoStaff[] = [];
  for (const f of fatti) {
    const gia = perChiave.get(chiaveFatto(f.slot, f.persona, f.gesto));
    if (!gia) { daAccodare.push(f); continue; }

    if (f.gesto !== 'formazione') { scartati.push(f); continue; }

    // 👥 Tutto ciò che è già stato dichiarato per questa coppia, messo insieme: la segreteria
    // può aver fatto più gesti dal gestionale nella stessa finestra, e ognuno ha lasciato la
    // sua dichiarazione.
    const dettiEntrati = gia.flatMap((d) => d?.entrati ?? []);
    const dettiUsciti = gia.flatMap((d) => d?.usciti ?? []);
    const entrati = meno(f.entrati ?? [], dettiEntrati);
    const usciti = meno(f.usciti ?? [], dettiUsciti);
    if (!entrati.length && !usciti.length) { scartati.push(f); continue; }
    daAccodare.push({ ...f, entrati, usciti });
  }
  return { daAccodare, scartati };
}
