/**
 * 🗓️ LA GRIGLIA DELLE FASCE PRENOTABILI — voce 177
 *
 * ⭐ LA FONTE È LA TABELLA `pmo_fasce_prenotabili`, non più il blocco jsonb
 * `app_setting/potentialSlotSchedule`. Il blocco vecchio veniva da Matchpoint
 * (`matchpoint-slot-schedule-sync`) e **muore col distacco**; la tabella la scrive il
 * committente a mano dal pannello «Fasce prenotabili» (voce 176).
 *
 * 🚨 PERCHÉ QUESTO MODULO ESISTE, e non è una comodità.
 * La voce 176 ha spostato l'APP sulla tabella e ha lasciato indietro i due lettori del BOT:
 * `consumer-booking-write` (cosa viene OFFERTO al socio) e `consumer-player-readmodel`
 * (cosa il bot RACCONTA sugli orari). ⇒ Il bot avrebbe **raccontato i vecchi orari mentre
 * prenotava sui nuovi**, e il difetto sarebbe comparso alla prima fascia modificata dal
 * pannello — cioè la prima volta che qualcuno usa la cosa costruita per lui.
 * 📌 *Due fonti che oggi concordano non sono una fonte: sono un guasto che aspetta il
 * primo cambio.*
 *
 * ⚖️ IL RIPIEGO RESTA, ed è deliberato — la stessa scelta che fa `getDaySlots()` nell'app.
 * Se la tabella non risponde o è vuota, si torna al blocco vecchio invece di rendere una
 * griglia VUOTA: una giornata senza fasce il socio la legge «il circolo è chiuso», che è
 * una **bugia**, non un'attesa. ⇒ `null` qui non vuol dire «nessun orario»: vuol dire
 * «chiedi al ripiego».
 *
 * 🔒 Modulo PURO: non conosce il database, non fa chiamate, non decide niente sulla
 * disponibilità. Legge chi lo chiama e gli dà in pasto le righe — stessa divisione di
 * `occupazione.ts`, così questa logica si prova senza rete.
 *
 * ⚠️ Questo file è COPIATO byte-identico nelle due cartelle edge che lo usano (Deno non
 * importa fuori dalla cartella della funzione), come `livello-dimostrato.ts` e
 * `partita-aperta.ts`. Cambiandone uno si cambiano TUTTI.
 */

/** Una fascia nella forma che i due lettori del bot già si aspettano. */
export type Fascia = { start: string; end: string; name: string };

/** Griglia per giorno della settimana, convenzione `getDay()`: '0' = domenica. */
export type Griglia = Record<string, Fascia[]>;

/** Una riga di `pmo_fasce_prenotabili` come arriva da PostgREST. */
export type RigaFascia = {
  giorno?: unknown;
  ora_inizio?: unknown;
  ora_fine?: unknown;
  attiva?: unknown;
};

/**
 * `16:30:00` → `16:30`, `16:30` → `16:30`, tutto il resto → `null`.
 *
 * 🚨 Serve DAVVERO, e non è pignoleria: la colonna è `time without time zone`, quindi
 * PostgREST la consegna come `HH:MM:SS` — mentre l'RPC che usa l'app fa
 * `to_char(..., 'HH24:MI')` e consegna `HH:MM`. Due strade verso la stessa tabella che
 * rendono due formati: chi passasse il valore grezzo ai confronti `/^\d{2}:\d{2}$/` dei
 * chiamanti si vedrebbe **scartare tutte le fasce**, e cadrebbe sul ripiego senza che
 * niente sia rotto. 📌 *Un difetto che finisce su un ripiego funzionante non si vede: si
 * vede solo quando il ripiego smette di dire il vero.*
 */
export function normalizzaOra(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(v.trim());
  if (!m) return null;
  if (Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1]}:${m[2]}`;
}

/**
 * Le righe della tabella diventano la griglia per giorno.
 *
 * Stesse regole di `pmoFasceComeGriglia()` nell'app, e vanno tenute uguali:
 * · le fasce con `attiva === false` si saltano;
 * · `giorno` dev'essere un intero 0-6, altrimenti la riga si scarta;
 * · le ore si normalizzano, e una fascia senza ore valide si scarta;
 * · dentro il giorno si ordina per ora d'inizio.
 *
 * ⇒ Torna `null` se non è rimasta **nemmeno una** fascia utile: è il segnale al chiamante
 * di usare il ripiego, e non va confuso con una griglia vuota.
 */
export function fasceComeGriglia(righe: readonly RigaFascia[] | null | undefined): Griglia | null {
  if (!Array.isArray(righe) || righe.length === 0) return null;

  const griglia: Griglia = { '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': [] };
  let utili = 0;

  for (const r of righe) {
    if (!r || typeof r !== 'object') continue;
    if (r.attiva === false) continue;

    const g = Number(r.giorno);
    if (!Number.isInteger(g) || g < 0 || g > 6) continue;

    const start = normalizzaOra(r.ora_inizio);
    const end = normalizzaOra(r.ora_fine);
    if (!start || !end) continue;

    griglia[String(g)].push({ start, end, name: `${start}-${end}` });
    utili++;
  }

  if (utili === 0) return null;

  for (const k of Object.keys(griglia)) {
    griglia[k].sort((a, b) => a.start.localeCompare(b.start));
  }
  return griglia;
}

/**
 * Le fasce di UN giorno, dalla griglia della tabella o — se non c'è — dal blocco vecchio.
 *
 * ⚖️ È il punto in cui il ripiego si applica, ed è **uno solo** apposta: due chiamanti che
 * decidono da sé quando ripiegare sono due chiamanti che prima o poi decidono diverso.
 */
export function fasceDelGiorno(
  griglia: Griglia | null,
  blocco: Record<string, unknown> | null | undefined,
  dow: number,
): Fascia[] {
  const k = String(dow);
  if (griglia) return Array.isArray(griglia[k]) ? griglia[k] : [];
  const vecchie = blocco && Array.isArray((blocco as Record<string, unknown>)[k])
    ? ((blocco as Record<string, unknown>)[k] as Fascia[])
    : [];
  return vecchie;
}
