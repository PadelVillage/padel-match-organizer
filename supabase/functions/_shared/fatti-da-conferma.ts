// fatti-da-conferma.ts — I FATTI DICHIARATI DAL GESTIONALE SU UNA CONFERMA IN MANO (voce 76).
//
// 🗣️ Nasce dalla voce 76, promossa dal committente il 23/08/2026 dopo la prova della 74:
// *«questi tempi sono troppo lunghi… sul gestionale lo spostamento è avvenuto entro un
// minuto»*. Ma **l'argomento non è la velocità**, ed è la cosa da non dimenticare leggendo
// questo file.
//
// 🚨⭐⭐ FINO A OGGI L'UNICO POSTO CHE RIEMPIVA `pmo_eventi_staff` ERA IL SYNC, e il sync vive
// **leggendo Matchpoint**. ⇒ Il giorno in cui Matchpoint si spegne, gli avvisi ai soci non
// rallentano: **cessano**. Il gestionale continuerebbe a sapere tutto — le scritture le esegue
// lui — ma la strada per dirlo al socio passava da una fonte che quel giorno non c'è più.
// ⚖️ È il rovescio della regola di `CLAUDE.md`: *«il giorno in cui Matchpoint si spegne, il bot
// non si tocca»*. Vera per il **bot**, falsa per **ciò che il gestionale ha da dirgli**.
//
// 🎯 IL DISEGNO È QUELLO CHE HA DATO IL COMMITTENTE IL 22/08, e non ne serviva uno nuovo:
// l'ok di Matchpoint torna al gestionale e **si ferma lì**; da quel punto a parlare col socio è
// sempre e solo il gestionale. Questo modulo è il pezzo che traduce quell'ok in fatti.
//
// ⛔ I CINQUE PALETTI della scheda, e come questo file li rispetta:
//   ① il bot non acquisisce nessun secondo indirizzo → qui non si parla con nessuno: è puro,
//     produce righe e basta;
//   ② nessun nome interno esce verso il bot → i fatti hanno i campi che avevano già, e le
//     parole sono quelle del gestionale (`lezione`/`partita`, mai i tipi di Matchpoint);
//   ③ il fatto continua a nascere in `pmo_eventi_staff` → cambia **chi lo riempie**;
//   ④ zero righe nel repo del bot → i due gesti sono `spostata` e `annullata`, che il bot
//     conosce dal 23/08. *Se avessimo avuto bisogno di una parola nuova, il disegno sarebbe
//     stato sbagliato* — ed è la prova che è stata fatta prima di scrivere, non dopo;
//   ⑤ il sync RESTA, per ciò che cambia su Matchpoint senza passare dal gestionale (chi
//     prenota al banco). Le due strade si **sommano**.
//
// ⭐⭐ PERCHÉ LE REGOLE SI IMPORTANO DA `eventi-staff.ts` INVECE DI RISCRIVERLE. Chi può
// ricevere un messaggio, come si normalizza un nome, come si costruisce la chiave di uno slot
// e come si traduce il tipo: sono le stesse domande a cui il sync risponde da sempre, e le due
// strade devono rispondere **identico** o il dedup non riconosce niente e la quiete non
// raggruppa. Una copia divergerebbe in silenzio, che è il modo peggiore.
// ⚖️ L'import attraversa una cartella (`../matchpoint-bookings-sync/`) e non è la convenzione:
// si può fare perché `eventi-staff.ts` è **puro e senza import** — nessuna dipendenza viene
// trascinata dentro le due edge che usano questo modulo. Se un domani smettesse di esserlo, la
// cura è spostare quelle quattro funzioni qui sotto, **non** duplicarle.
//
// 🚨 E UNA TRAPPOLA DEL DEPLOY, misurata leggendo il workflow: `deploy-edge-functions-*.yml`
// calcola le funzioni da pubblicare con `awk '$3 !~ /^_/'` ⇒ **le cartelle che iniziano per `_`
// sono saltate**. Toccare SOLO questo file non manda niente in servizio: il deploy parte
// perché nello stesso commit cambiano anche le due edge che lo chiamano.

import {
  chiaveSlot,
  fattiDaConfronto,
  type FattoStaff,
  normNome,
  puoRicevere,
  type SlotRoster,
  tipoDelloSlot,
} from '../matchpoint-bookings-sync/eventi-staff.ts';

export type { FattoStaff };

/** Dove sta una partita: le tre coordinate con cui il socio la riconosce. */
export type CoordinateSlot = {
  data: string;
  ora: string;
  /** Il campo **come lo scrive la copia locale** («Campo 2»), non il numero nudo. */
  campo: string;
};

/**
 * Il campo scritto come lo scrive il gestionale.
 *
 * 🚨 Serve solo per le coordinate di ARRIVO di uno spostamento, che arrivano dall'app come
 * numero (`move.campo`). Quelle di partenza si leggono dalla copia locale, quindi il formato
 * lì combacia **per costruzione** e non per convenzione — ed è il verso in cui si dovrebbe
 * lavorare sempre.
 * ⚖️ La chiave dello slot non ne dipende (`chiaveSlot` tiene solo le cifre): a dipenderne è il
 * TESTO che il socio legge. Due formati diversi per la stessa cosa non sono un guasto, sono
 * l'impressione che a scrivere siano stati in due — che è esattamente ciò che non deve
 * trasparire.
 */
export function campoScritto(campo: unknown): string {
  const solo = String(campo ?? '').trim();
  if (!solo) return '';
  if (/^\d+$/.test(solo)) return `Campo ${solo}`;
  return solo;
}

/**
 * ⏱️ La forma di un orario, `H:MM` o `HH:MM` — voce 194 ②.
 *
 * 🚨 Serve perché queste stringhe finiscono **dentro una frase** che il socio legge come un'ora
 * («Adesso finisce alle …»): una parola qualunque che passasse di qui diventerebbe un orario
 * agli occhi di chi legge. È la stessa guardia che il `tipo` ha sull'elenco chiuso, applicata a
 * un formato invece che a un vocabolario.
 * ⚖️ La gemella sta nel bot (`ponte.ts`), e le due sono deliberatamente **indipendenti**: qui
 * decide se un fatto NASCE, là se un pezzo di frase SI DICE. Un giorno in cui una delle due
 * cadesse, l'altra regge — che è il motivo per cui non se ne fa una sola condivisa.
 */
const ORARIO = /^([01]?\d|2[0-3]):[0-5]\d$/;

/**
 * I nomi che possono ricevere un messaggio, ognuno una volta sola.
 *
 * 🚨 Il dedup c'è perché un roster ripete i nomi (gli «Ospite» soprattutto) e la copia locale
 * tiene una riga per giocatore con dentro l'elenco INTERO: senza, la stessa persona
 * riceverebbe lo stesso avviso quante volte compare.
 * ⚖️ Si tiene la **prima** forma scritta, come fa `mappaNomi` nel ponte: il nome è già quello
 * del circolo, non c'è una versione migliore da cercare.
 */
export function destinatari(roster: readonly unknown[]): string[] {
  const visti = new Set<string>();
  const fuori: string[] = [];
  for (const grezzo of roster) {
    /* 🚨⭐⭐ 10/09/2026 (voce 194 ①) — UN GIOCATORE PUÒ ARRIVARE COME OGGETTO, e prima finiva
     * dentro come una persona di nome «[object Object]».
     * 📏 Trovato dal banco, non rileggendo: `destinatari([{ nome: 'Maurizio Aprea' }])` tornava
     * `['[object Object]']`. Nessuna guardia lo fermava — `puoRicevere` non riconosce un
     * oggetto come «Ospite» né come vuoto, quindi lo lasciava passare, e la riga usciva
     * `String(g).trim()`.
     * ⚖️ Non è un caso di scuola: i giocatori viaggiano come `{ nome, codice }` in tutto il
     * progetto — è la forma di `booking.giocatori` e del payload `staff_booking`. Il primo
     * chiamante che passa la forma naturale invece dei nomi genera un destinatario che non
     * esiste, **in silenzio**, e l'avviso non arriva a nessuno senza che niente sia rosso.
     * 🔨 Si accetta la forma naturale invece di scartarla: scartare in silenzio farebbe lo
     *    stesso danno con l'aria di una difesa.
     * ⛔ Sta QUI e non in `puoRicevere`, che è condiviso con il sync (`eventi-staff.ts`): quella
     *    strada su PROD è viva, e questa cura non ha ragione di toccarla. */
    const g = (grezzo && typeof grezzo === 'object' && 'nome' in (grezzo as Record<string, unknown>))
      ? (grezzo as { nome?: unknown }).nome
      : grezzo;
    if (!puoRicevere(g)) continue;
    const n = normNome(g);
    if (visti.has(n)) continue;
    visti.add(n);
    fuori.push(String(g).trim());
  }
  return fuori;
}

/**
 * UNO SPOSTAMENTO CONFERMATO DAL CIRCOLO, detto a chi ci gioca.
 *
 * Le coordinate del fatto sono quelle di **arrivo** — è lì che si va a giocare — e `da` dice
 * da dove, perché il socio quella partita ce l'ha in testa com'era prima. È la stessa forma
 * che il sync produce dal confronto fra due fotografie (`fattiDaConfronto`), costruita qui da
 * una conferma sola.
 *
 * 🚨⭐ SI DICHIARA SOLO LO SPOSTAMENTO PURO, e il perché è la parte da non perdere: l'edge
 * `matchpoint-bookings-edit` sa muovere una partita **e** cambiarle i giocatori nello stesso
 * gesto. Se lo facesse, dire `spostata` a tutti sarebbe falso per chi è stato tolto — che di
 * quel posto nuovo non deve sapere niente (regola del 23/08: *«corretti fino in fondo»*) — e
 * il sync arriverebbe poi a dire anche `tolto`, cioè due messaggi che si contraddicono.
 * ⇒ Quando il gesto tocca anche il roster, questo modulo **non dichiara niente** e la cosa
 * resta al sync, esattamente com'è oggi. Non è una rinuncia: è il paletto ⑤ che lavora — le
 * due strade si sommano, e dove la conferma non sa dire tutto tace invece di dire metà.
 * ⚖️ A decidere se il gesto è puro è chi chiama, che ha in mano la richiesta: qui si riceve
 * già la risposta.
 */
export function fattiDaSpostamento(opts: {
  partenza: CoordinateSlot;
  arrivo: CoordinateSlot;
  /** Chi c'è in campo, letto dalla copia locale dello slot di partenza. */
  roster: readonly unknown[];
  /** Il tipo grezzo della copia locale: qui dentro diventa `lezione` o `partita`. */
  tipo?: unknown;
}): FattoStaff[] {
  const { partenza, arrivo, roster, tipo } = opts;
  // Senza coordinate non si scrive un messaggio leggibile: meglio non dire niente e lasciare
  // che sia il sync a raccontarlo, che è ciò che succedeva prima di questa voce.
  if (!arrivo.data || !partenza.data) return [];
  const tipoDetto = tipoDelloSlot(tipo);
  return destinatari(roster).map((persona) => ({
    slot: chiave(arrivo),
    data: arrivo.data,
    ora: arrivo.ora,
    campo: arrivo.campo,
    persona,
    gesto: 'spostata' as const,
    tipo: tipoDetto,
    da: { data: partenza.data, ora: partenza.ora, campo: partenza.campo },
  }));
}

/**
 * UN ANNULLO CONFERMATO DAL CIRCOLO, detto a TUTTI quelli che ci giocavano.
 *
 * 🚨 Il destinatario non è uno solo, ed è la stessa ragione che il sync scrive nel suo ramo
 * `annullata`: in un annullamento non ci sono spettatori — la partita salta a tutti, e
 * avvisarne uno solo manderebbe gli altri tre al campo per una partita che non c'è.
 */
export function fattiDaAnnullo(opts: {
  slot: CoordinateSlot;
  /** Chi c'era in campo, letto dalla copia locale PRIMA che sparisse. */
  roster: readonly unknown[];
  tipo?: unknown;
}): FattoStaff[] {
  const { slot, roster, tipo } = opts;
  if (!slot.data) return [];
  const tipoDetto = tipoDelloSlot(tipo);
  return destinatari(roster).map((persona) => ({
    slot: chiave(slot),
    data: slot.data,
    ora: slot.ora,
    campo: slot.campo,
    persona,
    gesto: 'annullata' as const,
    tipo: tipoDetto,
  }));
}

/**
 * 🆕 UNA PRENOTAZIONE NUOVA CONFERMATA DAL CIRCOLO, detta a TUTTI quelli che ci sono dentro
 * — 10/09/2026, voce 194 livello ①.
 *
 * 🗣️ Nasce dalla sua richiesta (*«bisogna attivare le notifiche sul chatbot quando c'è
 * qualsiasi operazione»*) e da una misura fatta prima di scrivere: su `cudi`, dall'08/09,
 * **53 prenotazioni toccate e ZERO avvisi nati**. L'ultimo evento è del 07/09 15:32, cioè
 * l'ultimo giro di sync prima che le sei routine venissero tolte.
 *
 * 🚨⭐⭐ IL BUCO ERA UNO SOLO E PRECISO, e non era «mancano dei gesti»: `matchpoint-bookings-create`
 * **non dichiarava niente**. Gli altri due gesti (`edit`, `cancel`) erano già passati alla strada
 * della conferma con la voce 76; la creazione no, perché quando quella voce fu scritta il sync
 * copriva ancora tutto e il difetto che l'aveva innescata riguardava annullo e spostamento.
 * ⇒ Finché il sync viveva, la creazione era raccontata da lui. Spento il sync, **non la racconta
 * più nessuno** — e non lo dice nessun errore.
 * 📌 *Una strada che copre un buco non lo chiude: lo nasconde finché non si spegne.*
 *
 * ⛔ PERCHÉ NON SI RIUSA `fattiDaCambioRoster` con un «prima» vuoto, che è la prima cosa che
 * viene in mente: quella funzione **rifiuta** un roster vuoto da una parte o dall'altra
 * (`if (!rosterPrima.length || !rosterDopo.length) return []`), ed è una guardia deliberata —
 * un «dopo» vuoto è una lettura monca, non una partita svuotata. Passarle un «prima» vuoto per
 * far uscire degli `aggiunto` vorrebbe dire **smontare quella guardia** per tutti gli altri
 * chiamanti. ⇒ Qui la creazione si dichiara per quello che è: nessun confronto, un fatto per
 * ciascuno di quelli che ci sono.
 *
 * ⭐ E il gesto è `aggiunto`, non una parola nuova: è **lo stesso** che il sync produceva per
 * una prenotazione nuova (`eventi-staff.ts`, il ramo degli slot che prima non c'erano). Il bot
 * lo conosce dal 23/08 ⇒ questa cura **non tocca il repo del bot** e non ha nessun ordine di
 * messa in servizio da rispettare. *Se ci fosse voluta una parola nuova, il disegno sarebbe
 * stato sbagliato.*
 */
export function fattiDaCreazione(opts: {
  slot: CoordinateSlot;
  /** Chi è in campo, dai partecipanti che il circolo ha appena confermato. */
  roster: readonly unknown[];
  tipo?: unknown;
  /** Oggi a Roma: una prenotazione nel passato non produce fatti. */
  oggi: string;
}): FattoStaff[] {
  const { slot, roster, tipo, oggi } = opts;
  if (!slot.data) return [];
  // 🚨 Uno slot passato non produce niente, come per tutte le sorelle: un avviso su una partita
  //    già giocata non è tardivo, è **falso** — dice che sta per succedere qualcosa che è finito.
  if (oggi && slot.data < oggi) return [];
  const tipoDetto = tipoDelloSlot(tipo);
  return destinatari(roster).map((persona) => ({
    slot: chiave(slot),
    data: slot.data,
    ora: slot.ora,
    campo: slot.campo,
    persona,
    gesto: 'aggiunto' as const,
    tipo: tipoDetto,
  }));
}

/**
 * ⏱️🔀 LO STESSO `move` PORTA DUE GESTI DIVERSI: quale dei due è questo — voce 194 ②.
 *
 * 🚨⭐⭐ IL FATTO DA CUI NASCE, ed è la cosa che non si vede leggendo il payload: l'app manda un
 * cambio di **durata** come `move: { campo, data, oraInizio, oraFine }` con campo, data e ora
 * d'inizio **identici** a prima. ⇒ Le due operazioni entrano dalla stessa porta con la stessa
 * forma, e a distinguerle c'è solo **cosa è rimasto uguale**.
 * ⛔ Senza questa riga un allungamento sarebbe uscito come `spostata`, e al socio sarebbe
 * arrivato *«La tua partita è stata spostata — lunedì alle 09:00, campo 4»* ripetendogli le
 * coordinate che aveva già: un messaggio che annuncia un cambiamento e non ne mostra nessuno.
 *
 * ⚖️ E SE SI MUOVONO TUTT'E DUE vince `spostata`, che è la notizia più grossa — dov'è la
 * partita conta più di quanto dura — e due messaggi sulla stessa conferma sarebbero due
 * notifiche per un fatto solo. Questa funzione risponde **una** domanda: *è rimasta dov'era?*
 *
 * 🚨 Il campo si confronta in CIFRE, come dappertutto in questa strada: la stessa partita esiste
 * in copie che lo scrivono «Campo 1» e «1», e un confronto sul testo direbbe «si è spostata»
 * di una partita che non si è mossa di un metro. È la gemella della guardia in `chiaveSlot`.
 * ⚠️ Coordinate di partenza incomplete ⇒ `false`, cioè si tratta come uno spostamento: è il
 * ramo che c'era prima di questa voce, e il verso in cui sbagliare costa meno.
 */
export function soloLaDurataECambiata(partenza: CoordinateSlot, arrivo: CoordinateSlot): boolean {
  const cifre = (v: unknown) => String(v ?? '').replace(/\D/g, '');
  const d = String(partenza.data ?? '').trim();
  const o = String(partenza.ora ?? '').trim();
  if (!d || !o) return false;
  return d === String(arrivo.data ?? '').trim()
    && o === String(arrivo.ora ?? '').trim()
    && cifre(partenza.campo) === cifre(arrivo.campo);
}

/**
 * ⏱️ LA DURATA CAMBIATA, CONFERMATA DAL CIRCOLO — 10/09/2026, voce 194 ②.
 *
 * 🗣️ Sua richiesta: *«bisogna attivare le notifiche sul chatbot quando c'è qualsiasi
 * operazione»*, col criterio che ha approvato lui: **si avvisa se il socio deve comportarsi
 * diversamente**, non se è cambiato un campo. Una partita che finisce a un'ora diversa è
 * esattamente quel caso: chi ha in testa di smettere alle 10:30 e finisce alle 11:00 organizza
 * la giornata sbagliata, e finora non gliel'ha detto nessuno.
 *
 * 🚨⭐⭐ QUESTO GESTO ESISTE PERCHÉ UNA DURATA VIAGGIA DENTRO UNO `move`, E NON È OVVIO.
 * L'app manda un cambio di durata come `move: { campo, data, oraInizio, oraFine }` con campo,
 * data e ora d'inizio **identici** a prima: a muoversi è solo la fine. ⇒ Senza questa
 * distinzione quel gesto sarebbe uscito come **`spostata`**, e al socio sarebbe arrivato
 * *«La tua partita è stata spostata — lunedì alle 09:00»* con dentro le stesse coordinate di
 * prima: un messaggio che annuncia un cambiamento e poi non ne mostra nessuno.
 * 📌 *Due gesti diversi che entrano dalla stessa porta non sono lo stesso gesto: è la porta a
 * essere una sola.*
 *
 * ⚖️ E CHI DECIDE QUALE DEI DUE È CHI CHIAMA, come per lo spostamento puro: qui si riceve già
 * la risposta del circolo, non la richiesta. Se si muovono **tutt'e due** — le coordinate e la
 * durata — vince `spostata`, che è la notizia più grossa: dov'è la partita conta più di
 * quanto dura, e due messaggi sulla stessa conferma sarebbero due notifiche per un fatto solo.
 */
export function fattiDaDurata(opts: {
  slot: CoordinateSlot;
  /** L'ora di fine NUOVA e quella di PRIMA, `HH:MM`. La seconda può mancare. */
  fine: string;
  finePrima?: string;
  /** Chi c'è in campo, letto dalla copia locale. */
  roster: readonly unknown[];
  tipo?: unknown;
  /** Oggi a Roma: una partita già giocata non produce fatti. */
  oggi: string;
}): FattoStaff[] {
  const { slot, fine, finePrima, roster, tipo, oggi } = opts;
  if (!slot.data) return [];
  // 🚨 Senza l'ora di fine NUOVA non resta niente da dire che il socio possa usare: il gesto
  // sarebbe «è cambiata la durata» e basta, cioè un invito a telefonare. ⇒ Tace, e la cosa
  // resta al sync — che è il comportamento di prima di questa voce.
  if (!ORARIO.test(String(fine ?? '').trim())) return [];
  // ⚠️ Uno slot passato non produce niente, come per tutte le sorelle.
  if (oggi && slot.data < oggi) return [];
  const prima = String(finePrima ?? '').trim();
  const tipoDetto = tipoDelloSlot(tipo);
  return destinatari(roster).map((persona) => ({
    slot: chiave(slot),
    data: slot.data,
    ora: slot.ora,
    campo: slot.campo,
    persona,
    gesto: 'durata' as const,
    tipo: tipoDetto,
    fine: String(fine).trim(),
    // ⚠️ Il «prima» si manda solo se ha la FORMA di un orario ed è DIVERSO dal nuovo: uguale
    // non descrive niente di successo, e il bot direbbe «allungata» di zero minuti.
    ...(ORARIO.test(prima) && prima !== String(fine).trim() ? { fine_prima: prima } : {}),
  }));
}

/**
 * 👨‍🏫 IL MAESTRO CAMBIATO, CONFERMATO DAL CIRCOLO — 10/09/2026, voce 194 ②.
 *
 * 🗣️ Stesso criterio suo: chi va a lezione ci va **per il maestro**, e trovarne un altro senza
 * saperlo è il caso esatto da cui la regola del 23/08 nasce — *«quando la segreteria fa un
 * qualsiasi tipo di operazione, le persone che sono dentro la partita devono essere avvisate»*.
 *
 * ⛔ SI MANDA SOLO IL MAESTRO DI ADESSO, mai quello di prima: al socio serve sapere chi
 * troverà. Chi se n'è andato è una notizia sul maestro, non sulla sua lezione.
 * ⚠️ Il nome può mancare (il circolo l'ha cambiato senza che sia arrivato fin qui): allora il
 * fatto nasce lo stesso e il bot dice che è cambiato **senza dire chi** — un nome inventato
 * manderebbe il socio a cercare la persona sbagliata. *Dire meno, mai a caso.*
 */
export function fattiDaMaestro(opts: {
  slot: CoordinateSlot;
  /** Chi tiene la lezione adesso, come lo scrive il circolo. Può mancare. */
  maestro?: string;
  roster: readonly unknown[];
  tipo?: unknown;
  oggi: string;
}): FattoStaff[] {
  const { slot, maestro, roster, tipo, oggi } = opts;
  if (!slot.data) return [];
  if (oggi && slot.data < oggi) return [];
  const chi = String(maestro ?? '').trim();
  const tipoDetto = tipoDelloSlot(tipo);
  return destinatari(roster).map((persona) => ({
    slot: chiave(slot),
    data: slot.data,
    ora: slot.ora,
    campo: slot.campo,
    persona,
    gesto: 'maestro' as const,
    tipo: tipoDetto,
    ...(chi ? { maestro: chi } : {}),
  }));
}

/**
 * 🎭⭐⭐ IL TIPO CAMBIATO — L'OTTAVO GESTO, voce 201, 10/09/2026.
 *
 * 🗣️ È il terzo gesto che il committente aveva approvato con la voce 194 e che allora non si
 * poté fare, **per una misura e non per una scelta**: quel gesto non esisteva. Il tipo si
 * sceglieva solo in creazione — non nella scheda, non in `EditRequest` — e in 3621 prenotazioni
 * non era mai cambiato. ⇒ *«se lo vuoi il lavoro è prima creare l'operazione.. si lo voglio»*.
 *
 * 🎯⭐ E NASCE NATIVO, che è la cosa che lo rende diverso dai suoi sette fratelli. Su Matchpoint
 * una partita e una lezione sono **due schede diverse** (`FichaPartida…` / `FichaClaseSuelta…`):
 * là dentro quel gesto non può esistere, e infatti il worker non ce l'ha. ⇒ Qui il `tipo` è un
 * campo del **nostro** `staff_booking`, e cambiarlo è una cosa che il sistema nuovo sa fare e
 * quello vecchio no. 📌 *Il primo gesto che il gestionale non eredita: lo inventa.*
 *
 * ⛔ SI TACE SENZA IL TIPO NUOVO. «È cambiato il tipo» da solo è un invito a telefonare, non una
 * notizia — stesso verso di `fattiDaDurata` senza l'ora di fine. E si tace anche se il nuovo è
 * **uguale** al vecchio: un messaggio che annuncia un cambiamento e non ne mostra nessuno è il
 * difetto esatto per cui `durata` esiste separata da `spostata`.
 *
 * 👨‍🏫 IL MAESTRO VIAGGIA SOLO VERSO LA LEZIONE, e non è un dettaglio di stile: su una partita
 * un maestro **non esiste**, quindi mandarlo lì sarebbe un dato che mente — ed è precisamente
 * il rischio che il committente ha nominato aprendo il lavoro (*«un cambio di tipo che lascia
 * il maestro appeso è un dato che mente»*). ⇒ Verso `partita` non si manda affatto; verso
 * `lezione` si manda se lo si sa, e se non lo si sa la riga semplicemente non c'è.
 *
 * ⚖️ CHI VINCE SUI GESTI MISTI lo decide chi chiama, come per la durata: qui si riceve già la
 * conferma, non la richiesta.
 */
/**
 * 🎭🚨⭐⭐ IL TIPO **DICHIARATO**, o `null` — e perché non si usa `tipoDelloSlot`.
 *
 * 📏 Trovato dal banco, non rileggendo: `tipoDelloSlot` **non torna mai `null`** — la sua riga è
 * `eLezione(x) ? 'lezione' : 'partita'`, e la sua regola è *«assente = non lo so ⇒ vale partita,
 * cioè il comportamento di prima»*. Giustissima per il suo mestiere (dare un nome allo slot in
 * una frase), **sbagliata** per questo, che è un mestiere diverso: qui la domanda non è *«come lo
 * chiamo?»* ma *«me l'hanno detto?»*.
 *
 * ⛔ COSA COMBINAVA, prima di questa funzione — due difetti, tutt'e due invisibili:
 *   · senza `tipoPrima` il fatto nasceva con `tipo_prima: 'partita'` **inventato**, e il socio
 *     leggeva *«la tua partita è diventata una lezione»* di una cosa che partita non era;
 *   · e il guardiano `if (!ora) return []` era **codice morto**: `ora` non poteva essere falso.
 *     ⇒ Due casi del banco erano **verdi per la ragione sbagliata** — passavano perché il
 *     «prima» inventato coincideva col «dopo» inventato, non perché il codice tacesse.
 * 📌 *Una funzione che non sa dire «non lo so» costringe chi la chiama a fingere di saperlo.*
 *
 * ⚖️ Le parole GREZZE si traducono lo stesso (`Lezione Libera` ⇒ `lezione`): il «prima» può
 * arrivare dalla copia locale, dove ci sono ancora le parole di Matchpoint. Ma una parola che non
 * è né l'una né l'altra vale **`null`**, non `partita`: su questo gesto un tipo indovinato non
 * degrada il messaggio, lo rende **falso**.
 */
function tipoDichiarato(v: unknown): TipoSlot | null {
  const t = String(v ?? '').trim();
  if (!t) return null;
  // ⭐ La traduzione resta UNA, in `tipoDelloSlot`: qui si aggiunge solo il «non lo so».
  if (tipoDelloSlot(t) === 'lezione') return 'lezione';
  return /^partita$/i.test(t) ? 'partita' : null;
}

export function fattiDaTipo(opts: {
  slot: CoordinateSlot;
  /** Che cos'è ADESSO, con le parole del gestionale. Senza, non si dice niente. */
  tipo: unknown;
  /** Che cos'era PRIMA. Può mancare: allora si dice solo che cos'è adesso. */
  tipoPrima?: unknown;
  /** Il maestro di adesso — si manda SOLO se è diventata una lezione. */
  maestro?: string;
  /** Chi c'è in campo, letto dalla copia locale. */
  roster: readonly unknown[];
  /** Oggi a Roma: una partita già giocata non produce fatti. */
  oggi: string;
}): FattoStaff[] {
  const { slot, tipo, tipoPrima, maestro, roster, oggi } = opts;
  if (!slot.data) return [];
  // ⚠️ Uno slot passato non produce niente, come per tutte le sorelle (voce 197).
  if (oggi && slot.data < oggi) return [];
  const ora = tipoDichiarato(tipo);
  // ⛔ Senza il tipo NUOVO non resta niente che il socio possa usare. ⭐ E adesso questa riga
  //    può davvero scattare: con `tipoDelloSlot` era codice morto (vedi `tipoDichiarato`).
  if (!ora) return [];
  const prima = tipoDichiarato(tipoPrima);
  // 🚨 Uguale = non è successo niente.
  if (prima && prima === ora) return [];
  const chi = String(maestro ?? '').trim();
  return destinatari(roster).map((persona) => ({
    slot: chiave(slot),
    data: slot.data,
    ora: slot.ora,
    campo: slot.campo,
    persona,
    gesto: 'tipo' as const,
    tipo: ora,
    ...(prima ? { tipo_prima: prima } : {}),
    // 👨‍🏫 Solo verso la lezione: su una partita il maestro non esiste.
    ...(ora === 'lezione' && chi ? { maestro: chi } : {}),
  }));
}

/**
 * 👥 UN CAMBIO DI GIOCATORI CONFERMATO DAL CIRCOLO — 31/08/2026, il seguito della voce 79.
 *
 * 🗣️ Il committente, appena visto arrivare il primo avviso `formazione`: *«ha funzionato però
 * ci ha messo parecchio tempo ad arrivare la notifica»*. 📏 Misurato sul caso vero: 131,6
 * secondi dal timbro del sync alla consegna, più 0-120 di attesa del giro — perché il fatto
 * nasceva `origine: sync`, e la strada veloce della voce 76 copriva solo annullo e spostamento.
 *
 * ⭐⭐ E QUI NON SI RISCRIVE LA REGOLA: si chiama `fattiDaConfronto`, la stessa che il sync usa
 * per le sue due fotografie, con due fotografie di un solo slot. Chi entra riceve `aggiunto`,
 * chi esce `tolto`, chi resta `formazione` con dentro gli elenchi — identico a quello che il
 * sync direbbe due minuti dopo, perché **è** quello che il sync direbbe.
 * 📌 *Una seconda copia della regola non darebbe un errore: darebbe due verità che divergono
 * il giorno in cui qualcuno ne corregge una sola.*
 *
 * ⚠️ SOLO SUL CAMBIO PURO, e chi chiama lo decide: se il gesto muove ANCHE la partita, questo
 * modulo tace e la cosa resta al sync — è la stessa ragione scritta sopra `fattiDaSpostamento`,
 * cioè che dove la conferma non sa dire tutto è meglio non dire metà.
 * ⚠️ Roster «dopo» vuoto o illeggibile ⇒ `[]`: non si dichiara un annullo di massa da una
 * lettura che potrebbe essere mozza. Il sync arriverà a dire la verità, in ritardo.
 */
export function fattiDaCambioRoster(opts: {
  slot: CoordinateSlot;
  /** Chi c'era, dalla copia locale letta PRIMA del gesto. */
  prima: readonly unknown[];
  /** Chi c'è adesso, dai partecipanti che il circolo ha confermato. */
  dopo: readonly unknown[];
  tipo?: unknown;
  /** Oggi a Roma: sotto questa data uno slot è passato e non produce fatti. */
  oggi: string;
}): FattoStaff[] {
  const { slot, prima, dopo, tipo, oggi } = opts;
  if (!slot.data) return [];
  const nomi = (r: readonly unknown[]) =>
    r.map((x) => String(x ?? '').trim()).filter(Boolean);
  const rosterPrima = nomi(prima);
  const rosterDopo = nomi(dopo);
  // 🚨 Un «dopo» vuoto non è una partita svuotata: è una lettura che non ha funzionato. Il
  // sync ha la sua guardia contro il crollo (`confrontoAttendibile`); qui la stessa prudenza
  // costa una riga, e senza di essa un worker che risponde monco produrrebbe un `tolto` a
  // tutti quelli in campo.
  if (!rosterPrima.length || !rosterDopo.length) return [];
  const uno = (roster: string[]): Map<string, SlotRoster> => new Map([[
    chiave(slot),
    { slot: chiave(slot), data: slot.data, ora: slot.ora, campo: slot.campo, roster, tipo: tipoGrezzo(tipo) },
  ]]);
  return fattiDaConfronto(uno(rosterPrima), uno(rosterDopo), oggi);
}

/**
 * Oggi a Roma, `YYYY-MM-DD`.
 *
 * ⚠️ Sta QUI e non nell'edge che la usa perché di questa funzione nel repo ce ne sono già
 * **due** copie identiche (`matchpoint-bookings-sync`, `matchpoint-history-sync`): una terza
 * non si aggiunge. Le due vecchie restano dove sono — spostarle è un lavoro loro, non di
 * questa voce — ma da qui in avanti chi ne ha bisogno importa questa.
 */
export function oggiRoma(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Il tipo com'era, per farlo tradurre a `fattiDaConfronto` invece che qui. */
function tipoGrezzo(tipo: unknown): string | undefined {
  const t = String(tipo ?? '').trim();
  return t || undefined;
}

/**
 * La chiave dello slot: `data|ora|campo-in-cifre`.
 *
 * 🚨 È `chiaveSlot` del sync, non una sua copia, e questa riga è il punto in cui la regola
 * dichiarata in testa al file si applica davvero. Una chiave che divergesse anche di poco non
 * darebbe un errore: il dedup smetterebbe di riconoscere i doppioni e la quiete smetterebbe di
 * raggruppare, **in silenzio**. È il difetto che questo modulo esiste per non avere.
 */
function chiave(c: CoordinateSlot): string {
  return chiaveSlot(c.data, c.ora, c.campo);
}
