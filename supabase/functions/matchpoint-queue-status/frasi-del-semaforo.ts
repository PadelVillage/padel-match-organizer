/* frasi-del-semaforo.ts — da «cosa dice la coda del worker» a «cosa legge chi fa segreteria».
 * Regola pura, 03/09/2026, terzo pezzo della voce 137.
 *
 * ⭐ In un modulo a sé perché è l'unico pezzo di questa edge che si possa sbagliare: il resto è
 * una `fetch` e un inoltro. Qui invece si decide COSA appare sul calendario del circolo, e una
 * regola che nessuno può eseguire in un banco è una regola non provata.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * 🗣️ LE DECISIONI SUE CHE QUESTO FILE ESEGUE:
 *
 *   «Ogni due minuti la pagina si aggiorna con i dati importati da Matchpoint. Questo io non
 *    vorrei vederlo sul calendario segnalato.»
 *   ⇒ il sync automatico NON si vede. Se si vedesse, la barra sarebbe accesa quasi sempre — cioè
 *     uno sfondo, non una segnalazione, ed è il modo in cui si perde un avviso senza toglierlo.
 *
 *   «Io che sono di segreteria devo vedere le azioni di chi le fa dal chatbot e le azioni che
 *    faccio io da gestionale.»
 *   ⇒ i gesti dal bot SÌ, e si dice che vengono da un socio.
 *
 * ⛔ E LA TERZA, che ha cancellato il pezzo più rischioso di tutti: **l'ESITO non va sul
 * semaforo.** «Io di segreteria ho bisogno di capire se ci sono azioni in corso e quali, mentre
 * chi opera sul chatbot deve capire se l'azione che ha fatto è andata a buon fine o no.»
 * ⇒ Qui non c'è nessuna memoria di com'è finita: solo *cosa sta succedendo adesso*. L'esito della
 *   propria azione lo sa già il browser di chi l'ha fatta (voci 134 e 136), e quello del socio
 *   glielo dice il bot.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 *
 * 🚨⭐⭐ IL VOCABOLARIO, che è l'unica conseguenza rimasta della regola «il gestionale SA, il bot
 * DICE» applicata al calendario. Il worker **è** il tramite del gestionale, quindi che il
 * gestionale conosca la risposta di Matchpoint è normale — ma quello che l'OPERATORE legge
 * dev'essere una frase del gestionale, mai un codice del worker.
 * ⇒ `NOMI_INTERNI` qui sotto è la stessa difesa che `consumer-booking-write` ha verso il bot, e
 *   **fallisce chiusa** per la stessa ragione: al minimo sospetto non si ritaglia il pezzo
 *   colpevole lasciando il resto, perché ritagliare lascerebbe in piedi la metà che nessuno ha
 *   pensato di cercare.
 */

/** Cosa la coda dichiara di un job. Tutti i campi sono opzionali di proposito: questo modulo
 *  deve reggere anche uno snapshot che arrivi da un worker più vecchio di lui. */
export type DoveNelCalendario = {
  campo?: number | null;
  data?: string | null;
  ora?: string | null;
};

export type JobDellaCoda = {
  op?: string;
  label?: string;
  operatore?: string;
  chiestoDa?: string;
  gesto?: boolean;
  dove?: DoveNelCalendario | null;
};

export type SnapshotDellaCoda = {
  busy?: boolean;
  running?: JobDellaCoda | null;
  waiting?: JobDellaCoda[];
  waitingCount?: number;
};

/** Cosa legge chi guarda il calendario. */
export type Semaforo = {
  /** `true` solo se c'è un GESTO in corso: il traffico automatico non accende niente. */
  acceso: boolean;
  /** La frase, già in italiano e già senza nomi interni. `null` quando non c'è niente da dire. */
  frase: string | null;
  /** Quanti gesti aspettano dietro a questo. Il traffico automatico non si conta. */
  inAttesa: number;
  /**
   * 🚨 La coda sta lavorando a qualcosa che NON dichiara se è un gesto.
   *
   * ⚖️ Serve a non trasformare un difetto in un silenzio. La barra resta spenta — è la sua
   * decisione sul rumore, e vale anche qui — ma il fatto **esce**, così un worker rimasto
   * indietro si diagnostica invece di sembrare un circolo tranquillo.
   * 📌 *Un valore che significa due cose non è ambiguo per chi lo scrive: lo è per chi lo legge,
   * e chi lo legge è sempre qualcun altro.* (voce 71)
   */
  dichiarazioneMancante: boolean;
  /**
   * Dove nel calendario, per accendere la CELLA — la seconda metà della disposizione D.
   *
   * `null` quando le coordinate non ci sono tutte, ed è un caso normale, non un guasto: le
   * operazioni che lavorano per `idReserva` non portano campo/data/ora. ⇒ La barra c'è lo
   * stesso, ed è esattamente per questo che la D ha DUE metà: la cella dice **dove**, la barra
   * dice qualcosa **anche quando il dove non si sa** o lo slot è fuori vista.
   */
  dove: DoveNelCalendario | null;
};

/**
 * I nomi dei pezzi interni. Chi ne aggiunge uno lo aggiunga **qui**.
 * ⚠️ `https?://` c'è perché un url è un nome interno anche quando non contiene nessuna di queste
 * parole — è la forma in cui il difetto si è già presentato una volta, sul lato bot.
 */
export const NOMI_INTERNI = /worker|matchpoint|hetzner|playwright|caddy|nip\.io|browser|https?:\/\//i;

/** Cosa si scrive quando l'etichetta della coda non è raccontabile a un operatore. */
export const SENZA_ETICHETTA = "un'operazione sul sistema del circolo";

/**
 * L'etichetta ripulita, così com'è lecito che l'operatore la legga.
 *
 * 🚨 Fallisce CHIUSA: una parola interna o un indirizzo e l'etichetta **intera** viene
 * sostituita. Non si ritaglia il pezzo colpevole — basta un url perché la regola sia rotta.
 */
export function etichettaPerLoperatore(grezza: unknown): string {
  const testo = String(grezza ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!testo) return SENZA_ETICHETTA;
  return (NOMI_INTERNI.test(testo) ? SENZA_ETICHETTA : testo).slice(0, 120);
}

/**
 * Chi ha chiesto, detto all'operatore.
 *
 * ⛔ Il nome del socio NON si dice, e non è una dimenticanza: questa riga sta **sul calendario**,
 * cioè sotto gli occhi di chiunque passi davanti allo schermo della segreteria, e un gesto in
 * corso non è un'informazione che vada esposta con un nome sopra. «un socio» basta a chi fa
 * segreteria per sapere che non è stata lei.
 * ⚖️ L'operatore invece si dice, perché è **chi lavora**, non chi è servito — ed è l'unica cosa
 * che distingue «lo sto facendo io» da «lo sta facendo l'altra postazione».
 */
export function chiSpiegato(job: JobDellaCoda): string | null {
  const chiestoDa = String(job.chiestoDa ?? '').trim().toLowerCase();
  if (chiestoDa === 'socio') return 'richiesta da un socio';
  const operatore = String(job.operatore ?? '').trim();
  if (!operatore || operatore === '—') return null;
  if (NOMI_INTERNI.test(operatore)) return null;
  return operatore;
}

/**
 * Le coordinate, solo se sono COMPLETE.
 *
 * 🚨 Mezze coordinate sono peggio di nessuna: con il campo ma senza l'ora si accenderebbe una
 * colonna intera, e chi guarda leggerebbe «sta succedendo qualcosa su tutto il Campo 2».
 * ⇒ O si sa dove, o non si accende niente e parla la barra.
 */
export function dovePulito(dove: DoveNelCalendario | null | undefined): DoveNelCalendario | null {
  const d = dove ?? null;
  if (!d) return null;
  const campo = typeof d.campo === 'number' && Number.isFinite(d.campo) && d.campo > 0 ? d.campo : null;
  const data = String(d.data ?? '').trim();
  const ora = String(d.ora ?? '').trim();
  if (campo === null || !/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{1,2}:\d{2}$/.test(ora)) return null;
  return { campo, data, ora };
}

/** Un job è un gesto **dichiarato**. `undefined` non è `false`: vedi `dichiarazioneMancante`. */
function eDichiaratoGesto(job: JobDellaCoda | null | undefined): boolean {
  return !!job && job.gesto === true;
}

/**
 * Da snapshot a semaforo.
 *
 * 🚨⭐ LA SCELTA CHE VA DETTA, perché è quella che qualcuno vorrà cambiare: si accende **solo**
 * su `gesto === true`, cioè su una dichiarazione POSITIVA. Un job che non dichiara niente non
 * accende la barra — ma **non sparisce**: alza `dichiarazioneMancante`.
 * ⚖️ Altrove in questa voce la regola è «sbagliare verso l'allarme», e qui sembra il contrario.
 * Non lo è: quella regola vale dove l'alternativa è un silenzio **muto**. Qui il fatto esce lo
 * stesso, da un'altra porta, e la barra resta pulita come lui ha chiesto.
 * 📌 *Non si sceglie fra rumore e silenzio: si sceglie DOVE mettere il fatto.*
 */
export function semaforoDaSnapshot(snapshot: SnapshotDellaCoda | null | undefined): Semaforo {
  const s = snapshot ?? {};
  const running = s.running ?? null;
  const waiting = Array.isArray(s.waiting) ? s.waiting : [];

  const inAttesa = waiting.filter(eDichiaratoGesto).length;
  const mancaSuRunning = !!running && running.gesto === undefined;
  const mancaSuWaiting = waiting.some((j) => !!j && j.gesto === undefined);

  if (!eDichiaratoGesto(running)) {
    return {
      acceso: false,
      frase: null,
      inAttesa,
      dichiarazioneMancante: mancaSuRunning || mancaSuWaiting,
      dove: null,
    };
  }

  const che = etichettaPerLoperatore(running!.label);
  const chi = chiSpiegato(running!);
  return {
    acceso: true,
    frase: chi ? `${che} · ${chi}` : che,
    inAttesa,
    dichiarazioneMancante: mancaSuWaiting,
    dove: dovePulito(running!.dove),
  };
}
