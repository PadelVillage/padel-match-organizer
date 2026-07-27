// Chi OCCUPA un campo: la regola in UN posto solo.
//
// ⛔⛔ LA DISTINZIONE CHE TIENE IN PIEDI QUESTO FILE: occupare un campo e giocarci sono due
// domande diverse. Una manutenzione occupa il campo e non ha giocatori; una lezione occupa il
// campo e i suoi partecipanti non sono un roster da cui si esce. Il roster sta in
// `roster-slot.ts` e legge SOLO `booking` + `staff_booking`; qui c'è un TERZO tipo che nel
// roster non deve entrare mai. Per questo `Occupazione` non ha né `liste` né `descrizione`:
// non è assegnabile a `RigaSlot`, quindi il compilatore rifiuta di farla finire fra i
// giocatori — la separazione non è una convenzione da ricordare, è un errore di tipo.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🚨⭐⭐ 28/07/2026 — I DUE DIFETTI CHE QUESTO MODULO CHIUDE, entrambi nella stessa direzione:
// il ponte diceva LIBERO un campo che era occupato.
//
// ① IL TERZO TIPO NON SI LEGGEVA. Richiesta del committente: *«il bot deve vedere pure i campi
//    occupati da lezioni e dalla manutenzione»*. Il ponte leggeva `booking` + `staff_booking`;
//    ciò che vive UNICAMENTE come `booking_occupancy` era invisibile e quel campo veniva
//    offerto come libero.
//    📊 Criterio: PROD, `deleted is not true`, `data >= 2026-07-28`, righe `booking_occupancy`
//    la cui terna `campo|data|ora` non compare in nessun `booking`/`staff_booking`:
//    **19 slot futuri invisibili — 14 `manutenzione` + 5 `Lezione Libera`.**
//    ⭐ Non è un'invenzione di questo ponte: il gestionale conta l'occupazione così da sempre
//    (`run-routines/index.ts`: `[...byType('booking_occupancy'), ...byType('booking')]`).
//
// ② LA FINE DELLA PRENOTAZIONE ERA INVENTATA. Il ponte usava `ora_fine`, e in sua assenza
//    metteva +90 minuti fissi. Misurato su PROD lo stesso giorno: `ora_fine` sulle righe
//    sincronizzate **non esiste** (0 su 138 future) — c'è invece `durata`, che nessuno
//    guardava. Quindi ogni riga del circolo veniva contata 90 minuti, comunque fosse.
//    | tipo | `ora_fine` | `durata` | in che unità |
//    |---|---|---|---|
//    | `booking` (dal circolo) | mai (0/138) | 1 · 1.5 | **ORE** |
//    | `staff_booking` (dall'app) | sempre (4/4) | 90 | **MINUTI** |
//    | `booking_occupancy` | mai (0/109) | 1 · 1.5 · 4.5 · 13.5 | **ORE** |
//    🚨 Ed è il difetto che avrebbe reso INUTILE il fix ①: le manutenzioni durano **4,5 e 13,5
//    ore**, e contate 90 minuti avrebbero lasciato libero quasi tutto ciò che occupano — una
//    manutenzione dalle 07:00 alle 20:30 sarebbe stata letta come «07:00-08:30».
//    ⭐ Nell'altro verso lo stesso difetto NASCONDEVA campi liberi: una lezione da 60 minuti
//    alle 17:00 finisce alle 18:00, ma contata fino alle 18:30 rendeva occupata la fascia
//    delle 18:00, che è libera.
// ══════════════════════════════════════════════════════════════════════════════════════════

/** I tipi di record che tolgono un campo dalla disponibilità. ⛔ Non è l'elenco di chi GIOCA. */
export const TIPI_CHE_OCCUPANO = ['booking', 'staff_booking', 'booking_occupancy'] as const;

/** Il tipo che porta l'occupazione ma MAI un giocatore: sta solo qui, e nel roster non entra. */
export const TIPO_SOLO_OCCUPAZIONE = 'booking_occupancy';

/** Lo slot padel standard: l'ultimo ripiego, quando né `ora_fine` né `durata` dicono niente. */
export const DURATA_DEFAULT_MIN = 90;

function clean(value: unknown) {
  return String(value ?? '').trim();
}

// 🚨 Copiata VERBATIM da `matchpoint-bookings-sync/index.ts` (dove si chiama con lo stesso
// nome): due letture della stessa durata divergono, e questa decide se un campo risulta
// libero. È la regola del GESTIONALE — la stessa che l'app usa per disegnare le card del
// calendario (`_staffCalDurMin` in `index.html` la richiama) — e il compito qui è restarle
// identici, non essere più furbi.
// ⭐ Regge le due unità perché deve: `>= 30` è già in minuti (l'app scrive 90), sotto è in ore
// (il circolo scrive 1,5), e sotto l'1 è una frazione di giornata (i fogli Excel scrivono
// così). ⚠️ Un test rilegge le due copie dal disco e le confronta carattere per carattere.
export function parseBookingDurationMinutes(value: unknown, fallbackMinutes = 90) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    if (value > 0 && value < 1) return Math.max(30, Math.round(value * 24 * 60));
    if (value >= 30) return Math.max(30, Math.round(value));
    return Math.max(30, Math.round(value * 60));
  }
  const text = clean(value).toLowerCase().replace(',', '.');
  if (!text) return fallbackMinutes;
  const hhmm = text.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/);
  if (hhmm) return Math.max(30, (parseInt(hhmm[1], 10) || 0) * 60 + (parseInt(hhmm[2], 10) || 0));
  const number = parseFloat(text);
  if (Number.isFinite(number) && number > 0) {
    if (number > 0 && number < 1) return Math.max(30, Math.round(number * 24 * 60));
    if (number >= 30) return Math.max(30, Math.round(number));
    return Math.max(30, Math.round(number * 60));
  }
  return fallbackMinutes;
}

export function oraInMinuti(t: unknown): number {
  const [h, m] = String(t).split(':').map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

export function minutiInOra(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Una riga ridotta a ciò che serve per dire «questo campo è preso da qui a qui».
 * ⛔ Nessun nome, di proposito: vedi il cappello del file.
 */
export type Occupazione = {
  campo: number;
  inizioMin: number;
  fineMin: number;
  /** Serve solo ai log e alle prove: dice PERCHÉ un campo risulta occupato (partita, lezione, manutenzione). */
  tipo: string;
};

/**
 * L'intervallo occupato da una riga, o `null` se la riga non dice nemmeno dove e quando.
 *
 * ⭐ L'ordine delle fonti è quello dell'affidabilità, non della comodità:
 *  ① `ora_fine`, quando c'è, è la fine SCRITTA (la mette l'app quando prenota);
 *  ② `durata`, che è ciò che scrive il circolo — e che fino al 28/07 nessuno leggeva;
 *  ③ i 90 minuti dello slot standard, ultimo ripiego.
 * 🚨 Il ripiego non si può togliere ma non deve mai VINCERE su un dato vero: era esattamente
 * quello che succedeva prima, e una manutenzione di 13 ore veniva contata un'ora e mezza.
 */
export function occupazioneDellaRiga(payload: Record<string, unknown>): Occupazione | null {
  const campo = parseInt(String(payload.campo ?? '').replace(/\D/g, ''), 10);
  const ora = clean(payload.ora);
  if (!campo || !/^\d{2}:\d{2}$/.test(ora)) return null;
  const inizioMin = oraInMinuti(ora);

  const oraFine = clean(payload.ora_fine);
  if (/^\d{2}:\d{2}$/.test(oraFine)) {
    const fineMin = oraInMinuti(oraFine);
    // Una fine che precede l'inizio è un dato rotto, non una prenotazione che scavalca la
    // mezzanotte: il circolo chiude prima. Si ricade sulla durata invece di occupare a ritroso.
    if (fineMin > inizioMin) return { campo, inizioMin, fineMin, tipo: clean(payload.tipo) };
  }

  const durata = payload.durata === undefined || payload.durata === null || clean(payload.durata) === ''
    ? DURATA_DEFAULT_MIN
    : parseBookingDurationMinutes(payload.durata, DURATA_DEFAULT_MIN);
  return { campo, inizioMin, fineMin: inizioMin + durata, tipo: clean(payload.tipo) };
}

/**
 * I campi presi in una fascia. Due intervalli si sovrappongono se uno comincia prima che
 * l'altro finisca, **estremi esclusi**: una partita che finisce alle 18:00 non occupa la
 * fascia che comincia alle 18:00.
 */
export function campiOccupati(
  occupazioni: Occupazione[],
  inizioFasciaMin: number,
  fineFasciaMin: number,
): Set<number> {
  const presi = new Set<number>();
  for (const o of occupazioni) {
    if (o.inizioMin < fineFasciaMin && inizioFasciaMin < o.fineMin) presi.add(o.campo);
  }
  return presi;
}
