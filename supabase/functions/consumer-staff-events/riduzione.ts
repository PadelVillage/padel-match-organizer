// riduzione.ts — da una RAFFICA di gesti della segreteria a UNA cosa da dire. O a nessuna.
//
// 🗣️ È la decisione ② del committente, 21/08/2026: *«2 minuti»* di quiete, e poi **lo stato
// finale**, non ogni passaggio. Nasce da un fatto misurato: il 21/08 la partita del 31/08 alle
// 09:30 è cambiata più volte fra le 20:48 e le 20:56 — togli, rimetti, correggi. Alla lettera
// sarebbero stati quattro messaggi alla stessa persona per una partita in cui, alla fine, era
// esattamente dove era prima.
//
// ⭐⭐ E IL CASO CHE RENDE QUESTO MODULO NECESSARIO invece che carino: *tolto e rimesso*. Non è
// «due messaggi invece di uno» — è **un messaggio che non si deve mandare affatto**. Scrivere
// «ti hanno tolto dalla partita» e trenta secondi dopo «ti hanno rimesso» a qualcuno che non si
// è mai accorto di niente non è rumore: è **allarme**, per un fatto che non è successo.
//
// ⚖️ Perché la riduzione sta nel GESTIONALE e non nel bot: è calcolo sul dato, e il dato è del
// gestionale — *il gestionale SA, il bot DICE*. Al bot resta la sua parte, che è un'altra:
// decidere **se e quando** dire ciò che gli viene detto, con le difese anti-doppione che ha già.

/** Un fatto come sta nella coda. */
export type FattoInCoda = {
  id: string;
  slot: string;
  data: string;
  ora: string;
  campo: string;
  persona: string;
  gesto: 'aggiunto' | 'tolto' | 'annullata' | 'spostata';
  /** 🔄 Solo su `spostata`: lo slot di PARTENZA. Le altre coordinate sono quelle d'arrivo. */
  da?: { data: string; ora: string; campo: string } | null;
  /**
   * Quando il fatto è stato visto, in ISO.
   *
   * 🚨⭐⭐ VOCE 76 — DA QUI IN POI QUESTO ISTANTE VUOL DIRE DUE COSE DIVERSE, e a dire quale
   * è `origine`. Da `conferma` è l'istante **vero** del gesto (il circolo ha appena detto sì);
   * da `sync` è l'istante del **giro**, che è ciò che rendeva impossibile accorciare la quiete.
   */
  visto_at: string;
  /**
   * 🚨⭐⭐ VOCE 76 — CHI HA RIEMPITO IL FATTO. `conferma`: il gestionale l'ha dichiarato appena
   * il circolo ha confermato. `sync`: lo specchio l'ha ri-scoperto rileggendo Matchpoint.
   *
   * ⚠️ Assente vale **`sync`**, ed è il verso prudente: i fatti già in coda al momento della
   * migrazione, e qualunque riga di cui non si sappia la provenienza, tengono la quiete piena.
   * Sbagliare qui significa parlare troppo presto a un socio.
   * ⛔ NON esce verso il bot: governa quanto si aspetta, non cosa si dice.
   */
  origine?: 'sync' | 'conferma' | null;
  /** `lezione` o `partita` — la parola del GESTIONALE, non quella di Matchpoint (voce 74). */
  tipo?: 'lezione' | 'partita' | null;
};

/** Cosa dire a una persona di una partita, dopo aver fuso tutto quello che le è successo. */
export type EsitoRidotto = {
  slot: string;
  data: string;
  ora: string;
  campo: string;
  persona: string;
  /** `null` quando il netto è nullo: non c'è niente da dire, e i fatti si chiudono lo stesso. */
  gesto: 'aggiunto' | 'tolto' | 'annullata' | 'spostata' | null;
  /**
   * Il tipo dello slot, dall'ULTIMO fatto della raffica — come tutto il resto qui.
   * ⚖️ Non si fonde e non si vota: una partita non diventa una lezione a metà raffica, e se
   * un giorno succedesse è comunque l'ultimo stato quello che si racconta.
   */
  tipo?: 'lezione' | 'partita' | null;
  /** 🔄 Lo slot di partenza, dall'ULTIMO fatto della raffica — come il `tipo` qui sopra. */
  da?: { data: string; ora: string; campo: string } | null;
  /** Gli id dei fatti che questo esito riassume: si chiudono tutti insieme, detto o no. */
  ids: string[];
};

/**
 * I due minuti di quiete della decisione ②.
 *
 * 🚨 Si misurano sull'ULTIMO gesto della coppia (persona, partita), non sul primo: la domanda
 * è «la segreteria ha finito?», e a rispondere è quanto tempo è passato dall'ultima cosa che
 * ha fatto. Misurarli dal primo consegnerebbe a metà di una raffica lunga.
 */
export const QUIETE_MS = 2 * 60 * 1000;

/**
 * 🚨⭐⭐ VOCE 76 — LA QUIETE QUANDO L'ISTANTE È QUELLO VERO, e perché è stata RIPENSATA invece
 * che abbassata. *(23/08/2026, risposta del committente: «sì, ma più corta».)*
 *
 * ⚖️ Il commento qui sopra spiega perché due minuti non si potevano toccare: la quiete non
 * misura il gesto, misura la distanza fra due `visto_at`, e `visto_at` era **l'istante del
 * giro di sync**. Due gesti fatti a dieci secondi l'uno dall'altro ma caduti in giri diversi
 * risultavano distanti quanto i giri — quindi una quiete più corta di un giro non fondeva
 * quasi niente, e il caso che perdeva era proprio *togli-e-rimetti fatto in fretta*.
 *
 * ⇒ Quella premessa CADE per i fatti che nascono da una conferma: lì `visto_at` è l'istante in
 * cui il circolo ha detto sì, cioè il gesto stesso. La domanda «la segreteria ha finito?» non
 * si risponde più per ipotesi sul timbro, perché il timbro è esatto.
 *
 * 🚨 E PERCHÉ NON ZERO, che sarebbe la conclusione affrettata: questo resta un **margine**, non
 * un'attesa. Serve a raccogliere due dichiarazioni che il gestionale emette a pochi secondi
 * l'una dall'altra sullo stesso socio e sulla stessa partita. Non serve più a indovinare se
 * la segreteria ha finito — a quella domanda, con l'istante vero in mano, non si risponde più
 * tirando a indovinare.
 *
 * ⛔ E SI APPLICA SOLO SE **TUTTI** I FATTI DEL GRUPPO VENGONO DA UNA CONFERMA. Basta che uno
 * arrivi dal sync perché il gruppo torni alla quiete piena: dentro c'è un timbro impreciso, e
 * misurare una distanza fra un istante vero e uno approssimato dà un numero che non vuol dire
 * niente. *Il verso in cui si sbaglia resta aspettare troppo, mai parlare troppo presto.*
 */
export const QUIETE_DA_CONFERMA_MS = 30 * 1000;

/**
 * Quanto si aspetta prima di parlare, per questo gruppo di fatti.
 *
 * ⚠️ `origine` assente vale `sync`: una riga di cui non si sappia la provenienza tiene la
 * quiete piena. È lo stesso verso prudente della colonna nel database.
 */
export function quietaDovuta(gruppo: readonly FattoInCoda[]): number {
  const tuttiDaConferma = gruppo.length > 0 && gruppo.every((f) => f.origine === 'conferma');
  return tuttiDaConferma ? QUIETE_DA_CONFERMA_MS : QUIETE_MS;
}

/**
 * 🚨⭐⭐ PERCHÉ LA QUIETE NON SI ABBASSA SOTTO UN GIRO DI SYNC — 22/08/2026, e il conto è
 * diverso da quello che sembra.
 *
 * 🗣️ Il committente ha proposto di portarla a **60 secondi**, con una premessa giusta: *«la
 * segreteria quando fa le variazioni sicuramente ci mette meno di un minuto»*. Sul **gesto
 * singolo** è vero.
 *
 * ⚖️ Ma questa costante non misura il gesto: misura la distanza fra due `visto_at`, e
 * **`visto_at` è l'istante del GIRO DI SYNC**, non del gesto (`visto_at: importedAt`, nel
 * ramo della voce 68 dentro `matchpoint-bookings-sync`). Tutti i fatti nati dallo stesso giro
 * portano lo stesso timbro; due gesti caduti in giri **diversi** risultano distanti quanto i
 * giri — anche se la segreteria li ha fatti a dieci secondi l'uno dall'altro.
 *
 * ⇒ *Una quiete più corta di un giro di sync non può fondere quasi niente*, e il caso che
 * perderebbe è proprio **togli-e-rimetti fatto in fretta**: cioè quello per cui la quiete
 * esiste, e l'unico in cui il messaggio non è rumore ma **allarme**.
 *
 * 📌 Il guadagno rinunciato è **un minuto**; la spesa vera dell'attesa era altrove — il bot
 * chiedeva ogni **quindici** minuti, ed è quella la cifra che è stata tagliata (a 2′).
 * ⇒ *Prima di stringere una soglia, guardare quale dei termini della somma è quello grosso.*
 */

/**
 * Entro quanto un nuovo fatto sulla stessa coppia (persona, partita) fa sospettare che una
 * raffica sia stata **spezzata**: le si era già consegnato qualcosa, e adesso arriva altro.
 *
 * ⚠️ Serve SOLO al registro, e non cambia niente di quello che si consegna. È il modo di
 * decidere il valore della quiete **sui dati** invece che sulle stime: se fra qualche giorno
 * questa riga non compare mai, la quiete si abbassa senza discutere; se compare spesso, si
 * alza con un numero in mano. *Una soglia senza una misura che la sorvegli è un'opinione che
 * ha preso la forma di una costante.*
 */
export const SOSPETTO_RAFFICA_SPEZZATA_MS = 15 * 60 * 1000;

/** Chiave della coppia: una persona in una partita. È il grano della decisione ①. */
export function coppia(persona: string, slot: string): string {
  return `${persona.trim().toLowerCase()}\u0000${slot}`;
}

/**
 * Lo stato finale di una persona in una partita, dato tutto quello che le è successo.
 *
 * ⭐ LA REGOLA, in una riga: **si confronta dove era all'inizio con dove è alla fine**, e se
 * combaciano non è successo niente da raccontare.
 *
 * Dove era all'inizio non sta scritto da nessuna parte — ma si deduce dal primo gesto: se il
 * primo è «tolto», dentro c'era; se è «aggiunto», fuori. È l'unica informazione che serve, e
 * arriva gratis.
 *
 * | la raffica | dov'era | dov'è | si dice |
 * |---|---|---|---|
 * | tolto | dentro | fuori | **tolto** |
 * | tolto → aggiunto | dentro | dentro | **niente** ⭐ |
 * | aggiunto → tolto | fuori | fuori | **niente** |
 * | aggiunto → tolto → aggiunto | fuori | dentro | **aggiunto** |
 * | qualunque cosa → annullata | — | — | **annullata** |
 * | qualunque cosa → spostata | — | — | **spostata** |
 *
 * 🚨 `annullata` non entra in questo calcolo e vince quando è l'ULTIMO gesto: una partita che
 * non c'è più non è uno stato del giocatore, è uno stato della partita. Se invece è in mezzo
 * (annullata e poi ricreata) conta come un'uscita, e il seguito riprende da lì.
 *
 * 🔄⭐ E `spostata` (23/08/2026) è della STESSA FAMIGLIA: dice dov'è finita la partita, non
 * dove si trova il giocatore. Vince da ultimo, come `annullata`.
 * ⚖️ In MEZZO però si comporta all'opposto: un annullo è un'uscita, uno spostamento no — chi
 * era in campo ci resta, la partita si è solo mossa. ⇒ Non tocca il conto dentro/fuori, e due
 * spostamenti di fila si dicono una volta sola. *Le due parole si somigliano e vanno nei versi
 * opposti proprio nel punto in cui è facile confonderle.*
 */
export function statoFinale(gesti: Array<FattoInCoda['gesto']>): EsitoRidotto['gesto'] {
  if (!gesti.length) return null;
  const ultimo = gesti[gesti.length - 1];
  if (ultimo === 'annullata') return 'annullata';
  if (ultimo === 'spostata') return 'spostata';

  // «dentro» = il giocatore è nella partita. Il primo gesto rivela da dove si partiva.
  const eraDentro = gesti[0] !== 'aggiunto';
  const eDentro = ultimo === 'aggiunto';
  if (eraDentro === eDentro) return null;
  return eDentro ? 'aggiunto' : 'tolto';
}

/**
 * I fatti maturi, ridotti a un esito per coppia (persona, partita).
 *
 * @param fatti Tutti i fatti ancora in coda, in qualunque ordine.
 * @param adesso L'istante di riferimento, in millisecondi. Si passa da fuori — e non si legge
 *   l'orologio qui dentro — così questa funzione si prova senza aspettare due minuti veri.
 *
 * ⇒ Le coppie ancora CALDE (ultimo gesto da meno di due minuti) restano fuori per intero:
 * la segreteria potrebbe non aver finito, e mezza raffica è peggio di niente.
 *
 * ⚠️ Gli esiti con `gesto: null` escono lo stesso, e non è una svista: portano gli `ids` da
 * chiudere. Un togli-e-rimetti non produce nessun messaggio ma ha prodotto due righe, e chi
 * chiama deve poterle marcare consegnate — se no restano in coda per sempre e si riesaminano
 * a ogni giro.
 */
export function riduci(fatti: FattoInCoda[], adesso: number): EsitoRidotto[] {
  const perCoppia = new Map<string, FattoInCoda[]>();
  for (const f of fatti) {
    const k = coppia(f.persona, f.slot);
    const gia = perCoppia.get(k);
    if (gia) gia.push(f);
    else perCoppia.set(k, [f]);
  }

  const esiti: EsitoRidotto[] = [];
  for (const [, gruppo] of perCoppia) {
    gruppo.sort((a, b) => a.visto_at.localeCompare(b.visto_at));
    const ultimo = gruppo[gruppo.length - 1];
    const visto = Date.parse(ultimo.visto_at);
    // Una data illeggibile non deve bloccare la coda per sempre: si tratta come matura.
    // ⚖️ Il verso è deliberato — il rischio è consegnare un attimo troppo presto, non
    // trattenere qualcosa all'infinito, e una riga che non esce mai è un guasto silenzioso.
    // 🔄 VOCE 76 — l'attesa dipende da CHI ha riempito i fatti: un gruppo tutto nato da
    // conferme porta istanti veri e si consegna col solo margine; basta un fatto dal sync
    // perché il gruppo torni alla quiete piena.
    if (Number.isFinite(visto) && adesso - visto < quietaDovuta(gruppo)) continue;

    esiti.push({
      slot: ultimo.slot,
      data: ultimo.data,
      ora: ultimo.ora,
      campo: ultimo.campo,
      persona: ultimo.persona,
      tipo: ultimo.tipo ?? null,
      da: ultimo.da ?? null,
      gesto: statoFinale(gruppo.map((g) => g.gesto)),
      ids: gruppo.map((g) => g.id),
    });
  }
  return esiti;
}
