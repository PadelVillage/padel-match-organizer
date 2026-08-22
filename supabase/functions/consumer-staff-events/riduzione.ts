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
  gesto: 'aggiunto' | 'tolto' | 'annullata';
  /** Quando il sync l'ha visto, in ISO. */
  visto_at: string;
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
  gesto: 'aggiunto' | 'tolto' | 'annullata' | null;
  /**
   * Il tipo dello slot, dall'ULTIMO fatto della raffica — come tutto il resto qui.
   * ⚖️ Non si fonde e non si vota: una partita non diventa una lezione a metà raffica, e se
   * un giorno succedesse è comunque l'ultimo stato quello che si racconta.
   */
  tipo?: 'lezione' | 'partita' | null;
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
 *
 * 🚨 `annullata` non entra in questo calcolo e vince quando è l'ULTIMO gesto: una partita che
 * non c'è più non è uno stato del giocatore, è uno stato della partita. Se invece è in mezzo
 * (annullata e poi ricreata) conta come un'uscita, e il seguito riprende da lì.
 */
export function statoFinale(gesti: Array<FattoInCoda['gesto']>): EsitoRidotto['gesto'] {
  if (!gesti.length) return null;
  const ultimo = gesti[gesti.length - 1];
  if (ultimo === 'annullata') return 'annullata';

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
    if (Number.isFinite(visto) && adesso - visto < QUIETE_MS) continue;

    esiti.push({
      slot: ultimo.slot,
      data: ultimo.data,
      ora: ultimo.ora,
      campo: ultimo.campo,
      persona: ultimo.persona,
      tipo: ultimo.tipo ?? null,
      gesto: statoFinale(gruppo.map((g) => g.gesto)),
      ids: gruppo.map((g) => g.id),
    });
  }
  return esiti;
}
