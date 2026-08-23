// chiudi-copia-locale.ts — DOPO UN ANNULLO CONFERMATO, LA COPIA DEL GESTIONALE SI CHIUDE SUBITO.
//
// 🗣️ Nasce dal residuo dichiarato della voce 76 (domanda ④ della sua scheda) e da un fatto che
// il codice diceva già di sé stesso. In `consumer-booking-write/allinea-copia-app.ts`, dal
// 28/07, sta scritto:
//   *«Vale per `leave` e basta. Una `cancel` fa sparire l'intero slot, e lì la copia in app la
//    toglie già il reconcile del sync.»*
// ⚖️ È **vero e incompleto**: il reconcile arriva davvero — arriva **dopo**. E quel «dopo» non è
// sempre di due minuti.
//
// 📏 MISURATO IL 23/08, ED È IL NUMERO CHE CAMBIA IL PESO DELLA COSA: il sync delle prenotazioni
// future **si ferma dall'01:00 alle 06:00** (Europe/Rome), e il buco misurato sui dispatch è di
// **5 ore e 4 minuti**, identico due notti di fila (00:58 → 06:02).
// ⇒ Un annullo fatto dal bot dopo l'una di notte lasciava la copia occupata **fino alle sei del
// mattino**. Non 3′40″: cinque ore.
//
// 🚨 E CHI LEGGE QUELLA COPIA È IL SOCIO. La disponibilità che il bot offre (`availability` e
// `availability_day` nel ponte) incrocia la griglia degli orari con `booking + staff_booking`,
// cioè esattamente queste righe. ⇒ In quella finestra il bot risponde **«occupato»** per un
// campo che sul sistema del circolo è **libero** — e lo dice con la stessa sicurezza con cui
// direbbe il vero. *Un dato vecchio non si presenta come vecchio: si presenta come un dato.*
//
// 🎯 LA CURA È LA METÀ «STESSO ISTANTE» DELLA REGOLA DEL COMMITTENTE (22/08): *«ogni gesto va
// detto al socio solo dopo che il circolo l'ha confermato — e nello stesso istante dev'essere
// registrato dal gestionale»*. La voce 75 l'ha applicata alla **creazione**; qui all'**annullo**.
//
// ⛔ E NON TOGLIE LA RETE: il sync resta, e continua a fare il suo reconcile. Questo modulo non
// gli leva un compito, gli toglie **l'attesa** — chi guarda la copia vede la verità subito
// invece che al giro buono.

import { campoScritto } from './fatti-da-conferma.ts';

// deno-lint-ignore no-explicit-any
type ClientMinimo = { from: (tabella: string) => any };

/** I tipi di riga che tengono occupato uno slot agli occhi di chi legge la disponibilità. */
export const TIPI_CHE_OCCUPANO = ['booking', 'booking_occupancy', 'staff_booking'] as const;

/** Solo le cifre: «Campo 2», «2» e « 2 » sono lo stesso campo. */
function cifre(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

/** Una riga della copia locale, come si legge dal database. */
export type RigaCopia = {
  record_type?: string | null;
  local_key?: string | null;
  payload?: Record<string, unknown> | null;
};

/**
 * Le righe che appartengono a QUESTO slot, e nessun'altra.
 *
 * 🚨 Il campo si confronta **in cifre**, e non è pignoleria: la stessa partita esiste in copie
 * che lo scrivono in due modi («Campo 1» dal sync, «1» dallo `staff_booking` dell'app). Un
 * confronto sul testo esatto ne seppellirebbe metà e lascerebbe l'altra a occupare lo slot —
 * cioè curerebbe il difetto solo per una delle due letture, che è peggio di non curarlo, perché
 * sembrerebbe curato.
 */
export function righeDelloSlot(
  righe: readonly RigaCopia[],
  slot: { data: string; ora: string; campo: unknown },
): RigaCopia[] {
  const campo = cifre(slot.campo);
  const data = String(slot.data ?? '').trim();
  const ora = String(slot.ora ?? '').trim();
  if (!data || !ora) return [];
  return righe.filter((r) => {
    const p = (r?.payload || {}) as Record<string, unknown>;
    return String(p?.data ?? '').trim() === data
      && String(p?.ora ?? '').trim() === ora
      && cifre(p?.campo) === campo;
  });
}

/**
 * Gli identificativi delle prenotazioni che stiamo seppellendo.
 *
 * 🚨⭐⭐ SERVONO, E LA VOCE 67 SPIEGA PERCHÉ — è un difetto già pagato il 21/08: una
 * soppressione **cieca** nasconde lo SLOT, e con lui la prenotazione **nuova** che ci arriva
 * sopra. Quel giorno una partita annullata alle 12:13 fece sparire dalla vista quella che
 * qualcun altro prenotò subito dopo sullo stesso campo.
 * ⇒ La lapide dice *«ho seppellito QUESTE»*, non *«questo slot è vuoto»*. Chi arriva dopo non
 * viene toccato.
 */
export function idsDelleRighe(righe: readonly RigaCopia[]): string[] {
  const ids = new Set<string>();
  for (const r of righe) {
    const p = (r?.payload || {}) as Record<string, unknown>;
    const id = String(p?.idReserva ?? '').trim();
    if (id) ids.add(id);
  }
  return [...ids];
}

/**
 * La lapide dichiarata, nella **stessa forma che scrive l'app** (`pmoRecordSoppressione` in
 * `index.html`): chiave `supp|<data>|<campo-in-cifre>|<ora>`.
 *
 * ⭐ Non è una forma nuova ed è deliberato: il sync la legge già (voce 73,
 * `slotDichiaratiAnnullati`) per sapere che cosa l'app ha seppellito dal giro scorso in qua, e
 * per **resuscitarne la lapide** nella fotografia di prima — così l'avviso ai giocatori nasce
 * lo stesso. Inventarne una seconda vorrebbe dire scrivere una dichiarazione che nessuno legge.
 *
 * @param ts L'istante, passato da fuori: qui dentro non si guarda l'orologio, così la funzione
 *           resta pura e le prove non dipendono da quando girano.
 */
export function lapide(slot: { data: string; ora: string; campo: unknown }, ids: string[], ts: number) {
  const campoNum = Number(cifre(slot.campo)) || 0;
  return {
    record_type: 'staff_suppress',
    local_key: `supp|${slot.data}|${campoNum}|${slot.ora}`,
    payload: { data: slot.data, campo: campoNum, ora: slot.ora, ts, ids },
    deleted: false,
  };
}

/**
 * CHIUDE LA COPIA LOCALE DI UNO SLOT ANNULLATO, e lascia la lapide che lo dichiara.
 *
 * 🚨 BEST-EFFORT E MUTA NEI GUASTI: si arriva qui **dopo** che il circolo ha confermato
 * l'annullo, quindi il campo è già libero sul sistema vero. Un errore qui non deve poter far
 * sembrare fallito un annullo riuscito — o il socio lo rifà, e la seconda volta cancella la
 * prenotazione di qualcun altro che nel frattempo ha preso il campo.
 * ⇒ Torna quante righe ha chiuso (0 se qualcosa è andato storto) e lascia una riga nel registro.
 *
 * ⚖️ Se questo fallisce **non si perde niente di definitivo**: resta il comportamento di prima,
 * cioè il reconcile del sync al giro buono. È una cura che toglie un'attesa, non una che
 * sostituisce una garanzia.
 */
export async function chiudiCopiaLocaleDelloSlot(opts: {
  client: ClientMinimo;
  slot: { data: string; ora: string; campo: unknown };
  /** L'istante da scrivere nella lapide. */
  adesso: number;
}): Promise<number> {
  const { client, slot, adesso } = opts;
  const data = String(slot.data ?? '').trim();
  const ora = String(slot.ora ?? '').trim();
  if (!data || !ora) return 0;
  try {
    // Si filtra sulla data nel database e su ora/campo nel codice: i due formati del campo
    // cadono così insieme. 📏 Le righe `booking` vive su PROD sono ~130 in tutto — il
    // calendario tiene solo il futuro — quindi non serve un indice sul JSON.
    const esito = await client
      .from('pmo_cloud_records')
      .select('record_type, local_key, payload')
      .in('record_type', TIPI_CHE_OCCUPANO)
      .eq('deleted', false)
      .eq('payload->>data', data);
    if (esito?.error) throw esito.error;
    const mie = righeDelloSlot((esito?.data ?? []) as RigaCopia[], { data, ora, campo: slot.campo });
    if (!mie.length) {
      // Niente da chiudere: o l'ha già fatto l'app (annullo dalla segreteria), o quella copia
      // non c'è mai stata. Non è un caso da segnalare.
      return 0;
    }

    const adessoIso = new Date(adesso).toISOString();
    for (const r of mie) {
      const esitoUp = await client
        .from('pmo_cloud_records')
        .update({ deleted: true, updated_at: adessoIso, synced_at: adessoIso })
        .eq('record_type', r.record_type)
        .eq('local_key', r.local_key);
      if (esitoUp?.error) throw esitoUp.error;
    }

    const esitoLapide = await client
      .from('pmo_cloud_records')
      .upsert(
        { ...lapide({ data, ora, campo: slot.campo }, idsDelleRighe(mie), adesso),
          updated_at: adessoIso, synced_at: adessoIso },
        { onConflict: 'record_type,local_key' },
      );
    if (esitoLapide?.error) throw esitoLapide.error;

    console.log(JSON.stringify({
      event: 'copia_locale_chiusa',
      slot: `${data}|${ora}|${cifre(slot.campo)}`,
      righe: mie.length,
      tipi: [...new Set(mie.map((r) => r.record_type))],
      campoScritto: campoScritto(slot.campo),
    }));
    return mie.length;
  } catch (e) {
    // ⚠️ `warn` e non `error`: al circolo l'annullo è andato, e il sync resta la rete — al giro
    // buono il reconcile toglie comunque quelle righe. Si perde la prontezza, non la verità.
    console.warn(JSON.stringify({
      event: 'copia_locale_non_chiusa',
      slot: `${data}|${ora}|${cifre(slot.campo)}`,
      error: String((e as Error)?.message ?? e),
    }));
    return 0;
  }
}
