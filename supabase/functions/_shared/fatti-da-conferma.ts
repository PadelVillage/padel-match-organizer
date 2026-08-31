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
  for (const g of roster) {
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
