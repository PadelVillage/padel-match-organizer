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
// prova un `idReserva` ce l'hanno per forza (`PROVA-…`, lo mette `esitoDiProva`). Quindi la
// strada che il bot percorre davvero non era quella che il codice si aspettava.

type JsonMap = Record<string, unknown>;

/** Il marchio; ripetuto qui per non far dipendere una regola pura dal modulo del recinto. */
const MARCHIO = 'nata_in_prova';

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
export function righeDiProvaDaSpegnere(
  righe: RigaStaffBooking[],
  chiave: ChiaveAnnullo,
): RigaStaffBooking[] {
  const idCercato = pulisci(chiave.idReserva);
  const hasTerna = !!pulisci(chiave.data) && !!pulisci(chiave.ora) && chiave.campo != null;
  if (!idCercato && !hasTerna) return [];

  return righe.filter((r) => {
    const p = (r.payload ?? {}) as JsonMap;
    if (p[MARCHIO] !== true) return false;
    if (idCercato) return pulisci(p.id_reserva) === idCercato;
    return pulisci(p.data) === pulisci(chiave.data)
      && pulisci(p.ora) === pulisci(chiave.ora)
      && pulisci(p.campo) === pulisci(chiave.campo);
  });
}
