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

/**
 * Una fascia nella forma che i due lettori del bot già si aspettano.
 * 💶 `prezzoCents` (voce 185) è quanto paga OGNI giocatore: arriva solo dal calendario effettivo,
 * ed è `null` quando nessuno ha ancora deciso quel prezzo — che NON è zero, cioè «gratis».
 */
export type Fascia = { start: string; end: string; name: string; prezzoCents?: number | null };

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

/* ══════════════════════════════════════════════════════════════════════════════
 * VOCE 185 — LA GRIGLIA DIPENDE DAL GIORNO, NON SOLO DAL GIORNO DELLA SETTIMANA
 * ══════════════════════════════════════════════════════════════════════════════
 * 🗣️ Richiesta del committente (08/09/2026): orari e prezzi cambiano con la stagione, e ci sono
 * giorni di chiusura. ⇒ «Che fasce ci sono di lunedì?» non ha più UNA risposta: dipende da QUALE
 * lunedì. Chi legge deve chiedere per DATA.
 *
 * ⭐ E chi risponde è il GESTIONALE, con `pmo_calendario_effettivo`: la stessa funzione che usa
 * l'app. Qui non si risolvono periodi né chiusure — si legge quello che il gestionale ha già
 * deciso. 📌 *Due posti che calcolano la stessa cosa sono un guasto che aspetta il primo cambio.*
 *
 * ⛔ Il ripiego resta quello di prima (il blocco `potentialSlotSchedule`): se la RPC non risponde
 * si torna a una griglia vecchia invece che a una griglia VUOTA, che il socio leggerebbe «il
 * circolo è chiuso» — una bugia, non un'attesa.
 */

/** Un giorno come lo racconta `pmo_calendario_effettivo`. */
export type GiornoCalendario = {
  data: string;
  chiuso: boolean;
  motivo: string | null;
  periodo_nome: string | null;
  fasce: Fascia[];
};

type RigaCalendario = {
  data?: unknown;
  chiuso?: unknown;
  motivo?: unknown;
  periodo_nome?: unknown;
  fasce?: unknown;
};

function fasceDellaRiga(v: unknown): Fascia[] {
  if (!Array.isArray(v)) return [];
  const out: Fascia[] = [];
  for (const f of v) {
    if (!f || typeof f !== 'object') continue;
    const start = normalizzaOra((f as Record<string, unknown>).ora_inizio);
    const end = normalizzaOra((f as Record<string, unknown>).ora_fine);
    if (!start || !end) continue;
    const grezzo = (f as Record<string, unknown>).prezzo_cents;
    const prezzoCents = typeof grezzo === 'number' && Number.isFinite(grezzo) ? grezzo : null;
    out.push({ start, end, name: `${start}-${end}`, prezzoCents });
  }
  out.sort((a, b) => a.start.localeCompare(b.start));
  return out;
}

function righeDellaRisposta(risposta: unknown): RigaCalendario[] | null {
  if (!risposta || typeof risposta !== 'object') return null;
  const r = risposta as Record<string, unknown>;
  if (r.ok !== true || !Array.isArray(r.giorni)) return null;
  return r.giorni as RigaCalendario[];
}

/**
 * Il giorno chiesto, dalla risposta della RPC. `null` = non l'abbiamo ⇒ si usa il ripiego.
 * 🚨 Un giorno CHIUSO torna con `fasce: []` e `chiuso: true`, e le due cose vanno lette insieme:
 * un elenco vuoto senza `chiuso` è «non lo so», con `chiuso` è «quel giorno non si gioca».
 */
export function giornoDalCalendario(risposta: unknown, giornoIso: string): GiornoCalendario | null {
  const righe = righeDellaRisposta(risposta);
  if (!righe) return null;
  for (const g of righe) {
    if (typeof g?.data !== 'string' || g.data !== giornoIso) continue;
    return {
      data: giornoIso,
      chiuso: g.chiuso === true,
      motivo: typeof g.motivo === 'string' && g.motivo.trim() ? g.motivo.trim() : null,
      periodo_nome: typeof g.periodo_nome === 'string' ? g.periodo_nome : null,
      fasce: g.chiuso === true ? [] : fasceDellaRiga(g.fasce),
    };
  }
  return null;
}

/**
 * La griglia della SETTIMANA, per chi racconta gli orari invece di proporre un giorno solo.
 * 🚨 Per ogni giorno della settimana si prende il primo giorno **non chiuso** che lo rappresenta:
 * altrimenti una settimana che contiene Natale racconterebbe «il venerdì non si gioca mai».
 * ⇒ Torna `null` se non è rimasta nemmeno una fascia: è il segnale di usare il ripiego.
 */
export function grigliaDalCalendario(risposta: unknown): Griglia | null {
  const righe = righeDellaRisposta(risposta);
  if (!righe) return null;

  const griglia: Griglia = { '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': [] };
  const visti = new Set<string>();
  let utili = 0;

  for (const g of righe) {
    if (typeof g?.data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(g.data)) continue;
    if (g.chiuso === true) continue;
    const dow = String(new Date(`${g.data}T12:00:00Z`).getUTCDay());
    if (visti.has(dow)) continue;
    const fasce = fasceDellaRiga(g.fasce);
    if (!fasce.length) continue;
    visti.add(dow);
    griglia[dow] = fasce;
    utili += fasce.length;
  }

  return utili === 0 ? null : griglia;
}
