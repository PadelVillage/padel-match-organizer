// partita-aperta.ts — le regole delle «PARTITE APERTE» (voce 88), tutte in un posto solo.
//
// 🗣️ La funzione nasce da una sua frase del 24/08/2026: *«poter partecipare a partite non
// chiuse, ma che un organizzatore volutamente e spontaneamente apre ad altri giocatori»*.
// Le quattro regole le ha decise lui; questo file è solo il posto in cui stanno scritte una
// volta invece che tre.
//
// 📐 LE QUATTRO REGOLE
//   ① chi non ne fa parte vede **solo i numeri** — «3 su 4 · lunedì 18:30 · Intermedio» — e
//      mai un nome. Non è una scelta di stile: è la serratura sui ~2.800 soci che `rubrica.ts`
//      tiene chiusa, e che una vetrina di partite aperte scardinerebbe senza accorgersene.
//      ⇒ Qui dentro non c'è NIENTE che sappia un nome: questo modulo decide chi entra, e i
//      nomi non gli servono. La difesa è che il dato non passa di qua.
//   ② apre l'organizzatore, con un gesto esplicito e reversibile (`apri` / `chiudi`).
//   ③ entra solo chi è **già nel gestionale**: la rubrica cade — è l'apertura, per
//      definizione — ma il **cliente del circolo RESTA**. Le due condizioni si spezzano
//      invece di cadere insieme per inerzia.
//   ④ livello **pari a quello dell'organizzatore, o ±0,5**: L−0,5 · L · L+0,5.
//
// 🚨⭐⭐ E LA DECISIONE CHE HA RESO LA ④ APPLICABILE — sua, del 01/09/2026, presa davanti al
// numero: **chi non ha un livello non entra e non apre; il bot gli propone il TEST.**
//
// 📏 Perché la domanda andava posta, misurato su PROD il 01/09/2026 (sola lettura):
//   0,5 → **2.283** · 1 → 1 · 1,5 → 37 · 2 → 68 · 2,5 → 203 · 3 → 78 · 3,5 → 56 · 4 → 41 ·
//   4,5 → 19 · 5 → 29 · 5,5 → 4 · vuoto → 2   (su **2.821** soci vivi)
// ⇒ Lo 0,5 ce l'ha l'**81%** del circolo, e **non è un livello basso: è «mai misurato»** —
//   tanto che `livelli.ts` nel bot lo tratta apposta come un non-dato
//   (`LIVELLO_MINIMO_IN_TABELLA`, sua decisione dell'11/08).
//
// ⚖️ Metterlo nell'aritmetica del ±0,5 faceva **due** danni insieme, ed è il motivo per cui la
// regola ④ da sola non stava in piedi:
//   · l'81% del circolo restava fuori da ogni partita aperta di chi un livello ce l'ha;
//   · una partita aperta da un socio **senza** livello risultava aperta a **2.283 persone**,
//     cioè lì il vincolo non filtrava nessuno.
//   ⇒ Proteggeva esattamente il 19% e lasciava scoperto il resto.
// 📌 *Un numero che significa «non lo so» non si può sommare e sottrarre: l'aritmetica su un
// non-dato produce una regola che sembra precisa e non lo è.*
//
// ⇒ Il ① che ha scelto chiude **tutte e due** le metà, e va detto perché non è ovvio: la
// seconda si chiude **impedendo di APRIRE**, non di entrare. Una sola delle due avrebbe
// lasciato in piedi la vetrina senza filtro.
// ⭐ Il costo è dichiarato, non nascosto: alla partenza la funzione serve **536 soci su
// 2.821**. Ed è il costo che si voleva — la partita aperta diventa il primo motivo vero per
// fare il test, che è la ragione per cui questa strada è stata scelta fra le tre.
//
// 🚨 «Avere il livello» è `livelloDimostrato`, non `level !== '0.5'`, ed è la stessa
// funzione che già decide chi può ORGANIZZARE. Un livello **preso in prestito** da chi
// invita («da confermare») non apre questa porta: se la aprisse, il ±0,5 si calcolerebbe su
// un numero che nessuno ha misurato — cioè il buco dello 0,5 rientrerebbe da un'altra porta,
// più stretta e meno visibile.
//
// ── 🔢 DUE COPIE IDENTICHE ────────────────────────────────────────────────────────────────
// Questo file vive in `consumer-booking-write/` (chi AMMETTE) e in
// `consumer-player-readmodel/` (chi ELENCA), uguale BYTE PER BYTE, e a tenerlo tale è la
// guardia in `test/partite-aperte-copie.test.mjs`.
// 🚨 Perché copie e non `_shared/`: i workflow di deploy scelgono le funzioni dalle CARTELLE
// TOCCATE e saltano tutto ciò che inizia per `_`. Un modulo in `_shared/` cambierebbe in git
// senza rideployare NESSUNO — la copia vecchia resterebbe in produzione, in silenzio e col
// semaforo verde. Stesso disegno di `livello-dimostrato.ts` e di `giro-del-test.ts`.
// ⚖️ E qui la deriva costerebbe caro in un modo particolare: chi elenca e chi ammette
// direbbero cose diverse, cioè il bot mostrerebbe una partita in cui poi il gestionale non
// fa entrare. *Un bottone che non può funzionare è peggio di un bottone che non c'è.*

import { livelloDimostrato } from './livello-dimostrato.ts';

/** Il tipo di record che porta l'apertura. Non è fra quelli che l'app scarica: è nostro. */
export const TIPO_RECORD_APERTURA = 'partita_aperta';

/** Quanti giocatori sta un campo da padel. Gemella della costante in `index.ts`. */
export const GIOCATORI_PARTITA = 4;

/** Il passo della scala dei livelli, che è anche la larghezza della banda della regola ④. */
export const PASSO_LIVELLO = 0.5;

/**
 * La chiave di uno slot: `data|ora|campo`, col campo ridotto alle sole CIFRE.
 *
 * 🚨 Le cifre e non la stringa, ed è un difetto già pagato altrove: il campo è scritto
 * «Campo 1» dal sync di Matchpoint e «1» dalla copia nostra. Due grafie della stessa cosa
 * fanno risultare due partite dove ce n'è una — e qui vorrebbe dire un'apertura che non si
 * riesce più a chiudere, perché la si cerca con la chiave sbagliata.
 */
export function chiaveApertura(data: unknown, ora: unknown, campo: unknown): string {
  const d = String(data ?? '').trim();
  const o = String(ora ?? '').trim();
  const c = String(campo ?? '').replace(/\D/g, '');
  if (!d || !o || !c) return '';
  return `${d}|${o}|${c}`;
}

/**
 * Il livello come NUMERO DI MEZZI PUNTI, o `null` se non è un numero leggibile.
 *
 * ⭐ Si conta in mezzi e non in decimali perché la banda del ±0,5 è un confronto di
 * uguaglianza mascherato, e su `0.1 + 0.2` i decimali sanno mentire. Contando in interi la
 * domanda «è a un passo?» è `|a − b| ≤ 1`, che non ha margini di errore.
 * ⭐ Accetta la virgola: il livello passa da campi scritti a mano e «2,5» è italiano.
 */
export function mezziPunti(livello: unknown): number | null {
  const grezzo = String(livello ?? '').trim().replace(',', '.');
  if (!grezzo) return null;
  const n = Number(grezzo);
  if (!Number.isFinite(n)) return null;
  return Math.round(n / PASSO_LIVELLO);
}

/**
 * La banda della regola ④ attorno a un livello: `L−0,5 · L · L+0,5`.
 *
 * ⚠️ Torna `null` per un livello illeggibile — **non** una banda vuota: «non so dove sta il
 * centro» e «attorno a questo centro non c'è nessuno» sono due risposte diverse, e chi legge
 * deve poterle distinguere. Una banda vuota fatta passare per un no farebbe dire al bot
 * «nessuno è del tuo livello» a chi un livello non ce l'ha.
 */
export function bandaDiLivello(livello: unknown): { min: number; max: number } | null {
  const m = mezziPunti(livello);
  if (m === null) return null;
  return { min: (m - 1) * PASSO_LIVELLO, max: (m + 1) * PASSO_LIVELLO };
}

/** Vero se i due livelli distano al più un passo (regola ④). Illeggibili ⇒ falso. */
export function dentroLaBanda(livelloA: unknown, livelloB: unknown): boolean {
  const a = mezziPunti(livelloA);
  const b = mezziPunti(livelloB);
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= 1;
}

/**
 * Vero se questa scheda può APRIRE una partita.
 *
 * 🚨⭐ È la metà della decisione ① che non viene in mente, e senza la quale l'altra metà non
 * serve a niente: chi non ha un livello **non apre**. Se aprisse, il ±0,5 si calcolerebbe
 * attorno a un non-dato e la sua partita risulterebbe aperta ai 2.283 soci che stanno a 0,5
 * — cioè, dentro una regola che sembra un filtro, non filtrerebbe nessuno.
 */
export function puoAprire(scheda: { level?: unknown; levelSource?: unknown }): boolean {
  return livelloDimostrato(scheda?.level, scheda?.levelSource);
}

/** I motivi con cui un ingresso può essere rifiutato. Sono le parole che il bot traduce. */
export const MOTIVI = {
  /** Questa partita non è aperta (o non lo è più). */
  NON_APERTA: 'non_aperta',
  /** Chi chiede è già in campo: non è un errore, è un secondo tocco o una corsa vinta due volte. */
  GIA_IN_PARTITA: 'gia_in_partita',
  /** I quattro posti sono presi. */
  AL_COMPLETO: 'al_completo',
  /** Regola ③: il circolo non ce l'ha fra i suoi clienti. */
  NON_CLIENTE: 'non_cliente',
  /** Regola ④ + decisione ①: senza un livello dimostrato non si entra — si fa il test. */
  SERVE_IL_TEST: 'serve_il_test',
  /** Regola ④: il livello c'è, ma dista più di un passo da quello di chi ha aperto. */
  LIVELLO_LONTANO: 'livello_lontano',
  /** L'apertura c'è ma chi l'ha fatta non ha (più) un livello dimostrato. */
  APERTURA_SENZA_LIVELLO: 'apertura_senza_livello',
} as const;

export type MotivoIngresso = typeof MOTIVI[keyof typeof MOTIVI];

export type EsitoIngresso =
  | { ok: true }
  | { ok: false; motivo: MotivoIngresso };

/**
 * **La** decisione: questa persona può entrare in questa partita aperta?
 *
 * 🚨⭐⭐ L'ORDINE DEI CONTROLLI NON È INDIFFERENTE, ed è il pezzo da non riordinare per
 * comodità: ogni motivo che esce di qui è una **frase che il socio legge**, e alcuni di essi
 * raccontano qualcosa della partita di qualcun altro.
 * ⇒ `NON_APERTA` viene per primo perché di una partita che non è aperta al socio non si dice
 * NIENTE — nemmeno se è piena, nemmeno di che livello è. È la stessa regola con cui `remove`
 * e `add` tacciono su una partita che non è tua.
 * ⇒ `SERVE_IL_TEST` viene **prima** di `LIVELLO_LONTANO` perché sono due frasi diverse e
 * solo una delle due è vera: a chi il livello non ce l'ha non si dice «sei di un altro
 * livello», che è un'affermazione su un numero che nessuno ha mai misurato.
 *
 * ⚖️ FAIL CLOSED dappertutto: un dato che non si legge è un no. La porta che questa funzione
 * sorveglia dà su una partita di persone vere, e un «non lo so» che apre è un estraneo in
 * campo — cosa che il bot sa aggiungere e non sa rimediare.
 */
export function decidiIngresso(input: {
  /** L'apertura esiste ed è viva (regola ②). */
  aperta: boolean;
  /** La scheda di chi ha aperto: serve il suo livello, che è il centro della banda. */
  organizzatore: { level?: unknown; levelSource?: unknown };
  /** La scheda di chi vuole entrare. */
  candidato: { level?: unknown; levelSource?: unknown; memberId?: unknown };
  /** Quanti giocatori risultano in campo ADESSO — riletti, non ricordati. */
  giocatoriInCampo: number;
  /** Chi chiede è già nel roster. */
  giaInPartita: boolean;
  /** Regola ③, decisa da `clienteDelCircolo` che vive nell'`index.ts` di chi chiama. */
  clienteDelCircolo: boolean;
}): EsitoIngresso {
  if (!input.aperta) return { ok: false, motivo: MOTIVI.NON_APERTA };
  if (input.giaInPartita) return { ok: false, motivo: MOTIVI.GIA_IN_PARTITA };
  if (input.giocatoriInCampo >= GIOCATORI_PARTITA) {
    return { ok: false, motivo: MOTIVI.AL_COMPLETO };
  }
  if (!input.clienteDelCircolo) return { ok: false, motivo: MOTIVI.NON_CLIENTE };
  if (!livelloDimostrato(input.candidato?.level, input.candidato?.levelSource)) {
    return { ok: false, motivo: MOTIVI.SERVE_IL_TEST };
  }
  // ⚠️ Il livello di chi ha aperto si ricontrolla ADESSO e non si crede all'apertura: fra
  // l'apertura e questo istante la segreteria può aver rimesso quella scheda a «da definire».
  // Senza questa riga la banda si calcolerebbe attorno a 0,5 e la partita risulterebbe aperta
  // ai 2.283 — cioè esattamente il buco che la decisione ① chiude.
  if (!puoAprire(input.organizzatore)) {
    return { ok: false, motivo: MOTIVI.APERTURA_SENZA_LIVELLO };
  }
  if (!dentroLaBanda(input.organizzatore?.level, input.candidato?.level)) {
    return { ok: false, motivo: MOTIVI.LIVELLO_LONTANO };
  }
  return { ok: true };
}
