// Quali righe spegne l'annullamento di una partita DI PROVA. Regola pura, senza database.
//
// 🚨⭐⭐ PERCHÉ È UN MODULO A SÉ, ed è nato da un difetto vero (7/08/2026): la prima versione
// viveva dentro l'edge e cercava le partite **solo per slot** (data · ora · campo). Il banco era
// verde, perché misurava che la funzione fosse CHIAMATA — non che trovasse qualcosa. Poi la
// prima prova dal vivo ha annullato una partita, ha risposto «fatto», e la partita è rimasta lì.
// ⇒ Struttura ≠ resa. Una regola che si può sbagliare va messa dove la si può misurare da sola,
//   con i dati veri in mano e senza rete: è la stessa ragione di `roster-slot.ts` e
//   `allinea-copia-app.ts` in `consumer-booking-write`.
//
// ⭐ Il fatto che il caso non poteva indovinare: il ponte dei soci, quando la prenotazione ha un
// `idReserva`, manda **solo quello** — niente data, niente ora, niente campo. E le partite di
// prova un `idReserva` ce l'hanno per forza (`PROVA-…`, lo mette `esitoNativo`). Quindi la
// strada che il bot percorre davvero non era quella che il codice si aspettava.

type JsonMap = Record<string, unknown>;

/**
 * I marchi; ripetuti qui per non far dipendere una regola pura dal modulo del recinto.
 * 🔄 08/09/2026 — le righe nuove nascono `nata_nel_gestionale` (non più «di prova»: sono
 * prenotazioni vere del gestionale nuovo). Il marchio VECCHIO resta riconosciuto perché le righe
 * scritte prima ci sono ancora — 📏 una viva su `cudi` all'08/09 — e smettere di vederle
 * vorrebbe dire non riuscire più ad annullarle.
 */
const MARCHIO = 'nata_nel_gestionale';
const MARCHIO_VECCHIO = 'nata_in_prova';

/**
 * 🆕⭐⭐ LA TERZA PROVA DI NASCITA, ed è quella che RESISTE (09/09/2026).
 *
 * 📏 IL FATTO, pagato con una sua prenotazione che non si lasciava annullare: il marchio vive nel
 * `payload`, e il `payload` **l'app lo riscrive**. Ogni volta che una copia locale torna al cloud
 * (`staffCalSaveLocal`, `_staffCalPersistIdReserva`, la promozione di una riga Matchpoint… — 📏
 * **otto punti** nell'app) parte un upsert con un payload a **chiavi fisse**, che del marchio non
 * sa niente: lo cancella senza accorgersene. ⇒ La riga resta viva e diventa **non annullabile**,
 * e chi ci prova legge *«su quello slot non c'è nessuna partita del gestionale da annullare»*
 * accanto a una partita che si vede benissimo sul calendario.
 *
 * ⇒ `PMO-…` è una prova **migliore** del marchio, e per una ragione strutturale: quel prefisso lo
 * conia `esitoNativo` e **nessun altro** — Matchpoint numera diversamente — quindi un `id_reserva`
 * che comincia così *è* nato qui, per costruzione. E l'`id_reserva` l'app lo porta **sempre** con
 * sé, perché le serve: è l'unico campo di questa famiglia che le sue riscritture non perdono.
 *
 * ⚖️ NON sostituisce il marchio, si aggiunge: le righe vecchie che il prefisso non ce l'hanno
 * continuano a essere riconosciute dal marchio, ed è la stessa ragione per cui `nata_in_prova` è
 * rimasto qui dopo il cambio di nome.
 * 📌 *Una prova di appartenenza scritta in un campo che qualcun altro riscrive non è una prova:
 *    è una nota. Quella vera sta in un campo che nessuno può permettersi di perdere.*
 */
const PREFISSO_NATIVO = 'PMO-';

export type RigaStaffBooking = { local_key: string; payload: JsonMap };
export type ChiaveAnnullo = { idReserva?: string; campo?: number; data?: string; ora?: string };

function pulisci(v: unknown): string {
  return String(v ?? '').trim();
}

/**
 * Le righe da spegnere, fra quelle vive.
 *
 * ⚖️ Due strade, nell'ordine in cui il chiamante le usa:
 *   ① `idReserva` — precisa, identifica UNA riga. È quella del bot.
 *   ② la terna `data · ora · campo` — quella dell'app e di chi il riferimento non ce l'ha.
 *
 * 🚨 Fuori da queste due non si spegne niente: senza una chiave che identifichi, il filtro
 * ridurrebbe a «tutte le partite di prova», e un annullo diventerebbe una pulizia generale.
 * ⛔ E in nessun caso si tocca una riga senza marchio: quelle non sono roba nostra.
 */
export function righeNativeDaSpegnere(
  righe: RigaStaffBooking[],
  chiave: ChiaveAnnullo,
): RigaStaffBooking[] {
  const idCercato = pulisci(chiave.idReserva);
  const hasTerna = !!pulisci(chiave.data) && !!pulisci(chiave.ora) && chiave.campo != null;
  if (!idCercato && !hasTerna) return [];

  return righe.filter((r) => {
    const p = (r.payload ?? {}) as JsonMap;
    const nostra = p[MARCHIO] === true
      || p[MARCHIO_VECCHIO] === true
      || pulisci(p.id_reserva).startsWith(PREFISSO_NATIVO);
    if (!nostra) return false;
    if (idCercato) return pulisci(p.id_reserva) === idCercato;
    return pulisci(p.data) === pulisci(chiave.data)
      && pulisci(p.ora) === pulisci(chiave.ora)
      && pulisci(p.campo) === pulisci(chiave.campo);
  });
}
