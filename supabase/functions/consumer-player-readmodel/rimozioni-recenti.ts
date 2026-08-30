// VOCE 80 — chi è stato TOLTO dalla segreteria non deve restare in campo per due minuti.
//
// 📏 Il difetto, misurato il 23/08 alle 21:27: ospite tolto dal gestionale alle 21:25:48, e la
// scheda del bot alle 21:27:22 lo mostrava ancora, con la ⭐ e il conteggio dei posti. Sparito
// solo col sync delle 21:27:53 ⇒ **2 minuti e 5 secondi** in cui il bot dice che in campo c'è
// una persona che non c'è più. E in quella finestra il bottone «Togli un giocatore» la offre,
// quindi chi la tocca chiede una scrittura su un roster che non esiste più.
//
// 🔎 PERCHÉ LA 78 NON LO COPRE, ed è il pezzo che decide la forma: `compagniDelloSlot` prende il
// MASSIMO fra le liste. Un'**aggiunta** fa salire subito il numero ⇒ le due letture si
// contraddicono ⇒ la guardia della 78 scatta. Una **rimozione** no: il roster vecchio resta il
// massimo, le due letture **concordano su un dato sbagliato**, e nessuna guardia può vederlo.
// 📌 *Una regola costruita sul disaccordo è cieca quando le due fonti sono d'accordo e hanno
// torto insieme.*
//
// 🚨⭐⭐ E LA CURA NON È ARITMETICA SULLE LISTE — la strada «la lista più fresca vince sul
// massimo», che la scheda dava per probabile, è stata SCARTATA misurando: sarebbe una
// DEDUZIONE del ponte su quale lista credere. Il fatto invece esiste già ed è scritto:
// `matchpoint-bookings-edit` registra ogni operazione della segreteria come `staff_edit`, con
// `players: { remove?: string[], add?: [...] }` — cioè **il gestionale sa già i nomi tolti e
// l'istante**. Qui non si indovina: si legge.
// ⇒ È *il gestionale SA, il bot DICE* applicato alla lettura.
//
// 🚨⭐⭐ L'AGGANCIO SI FA PER `idReserva`, E NON PER `data|ora|campo` — misurato sulle 158 righe
// `staff_edit` di PROD, perché a occhio si sarebbe scelta la seconda (è la chiave con cui tutto
// il ponte ragiona) e avrebbe mancato i due terzi dei casi:
//
//   | strada                        | staff_edit raggiunti |
//   |---|---|
//   | `da: {data, ora, campo}`      |  58 / 158  (37%)  ← la chiave "ovvia"
//   | `idReserva`                   | 141 / 158  (89%)  ← quella giusta
//   | l'una o l'altra               | 146 / 158  (92%)  ← si tengono tutt'e due
//
// ⚠️ E LE GRAFIE SONO DUE, non una: `booking` scrive `idReserva`, `staff_booking` scrive
// `id_reserva`. Leggerne una sola perde 51 righe delle copie nostre, e non lo direbbe nessuno.

type JsonMap = Record<string, unknown>;

const clean = (v: unknown) => String(v ?? '').trim();

/** La chiave dello slot, con la STESSA convenzione del readmodel: `data|ora|campo-in-cifre`. */
export function chiaveDelloSlot(data: unknown, ora: unknown, campo: unknown): string {
  const d = clean(data), o = clean(ora), c = clean(campo).replace(/\D/g, '');
  return d && o && c ? `${d}|${o}|${c}` : '';
}

/**
 * `idReserva` → chiave dello slot, letta dalle righe che il ponte ha già in mano.
 * ⚠️ Le due grafie si leggono TUTT'E DUE: vedi la tabella qui sopra.
 */
export function mappaIdReserva(rows: Array<{ payload?: unknown }>): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of rows ?? []) {
    const p = (row?.payload ?? {}) as JsonMap;
    const idr = clean(p.idReserva) || clean(p.id_reserva);
    if (!idr) continue;
    const key = chiaveDelloSlot(p.data, p.ora, p.campo);
    if (key && !out.has(idr)) out.set(idr, key);
  }
  return out;
}

/** Una rimozione registrata dalla segreteria: chi, su quale slot, e quando. */
export type Rimozione = { slot: string; nome: string; quando: string };

/**
 * Le rimozioni che il gestionale ha registrato, agganciate a uno slot.
 *
 * ⭐ Si prova PRIMA `idReserva` (89%) e poi `da` (37%): l'ordine non è estetico — `da` esiste
 * solo quando l'app l'ha mandato, mentre `idReserva` è il nome che la partita ha su Matchpoint.
 * ⛔ Se non si aggancia in nessuno dei due modi **non si produce niente**: si torna al
 * comportamento di oggi. Sbagliare verso il fastidio vecchio, mai verso un roster inventato.
 */
export function rimozioniDaStaffEdit(
  rows: Array<{ payload?: unknown; synced_at?: unknown }>,
  perIdReserva: Map<string, string>,
): Rimozione[] {
  const out: Rimozione[] = [];
  for (const row of rows ?? []) {
    const p = (row?.payload ?? {}) as JsonMap;
    const quando = clean(row?.synced_at);
    if (!quando) continue; // senza istante non si può dire se viene prima o dopo il sync
    const players = (p.players ?? {}) as JsonMap;
    const remove = Array.isArray(players.remove) ? players.remove : [];
    if (!remove.length) continue;
    const da = (p.da ?? {}) as JsonMap;
    const slot = perIdReserva.get(clean(p.idReserva))
      || chiaveDelloSlot(da.data, da.ora, da.campo);
    if (!slot) continue;
    for (const n of remove) {
      const nome = clean(n);
      if (nome) out.push({ slot, nome, quando });
    }
  }
  return out;
}

/**
 * I nomi tolti su questo slot DOPO l'ultima volta che il circolo l'ha raccontato.
 *
 * ⭐ La finestra si chiude da sé: passato il sync, `sincronizzatoAl` supera l'istante della
 * rimozione e questa funzione torna vuota. Nessuna scadenza da mantenere, nessuno stato da
 * ripulire — la cura è inerte appena smette di servire.
 * ⛔ `sincronizzatoAl` mancante ⇒ **niente**: non sapere quando il circolo ha parlato non
 * autorizza a togliere qualcuno dal campo.
 */
export function rimossiDopoIlSync(
  rimozioni: Rimozione[],
  slot: string,
  sincronizzatoAl: string | null | undefined,
): string[] {
  const sync = clean(sincronizzatoAl);
  if (!sync || !slot) return [];
  return (rimozioni ?? [])
    .filter((r) => r.slot === slot && r.quando > sync)
    .map((r) => r.nome);
}

/**
 * Toglie da una lista i nomi rimossi — **UNA OCCORRENZA PER VOLTA**.
 *
 * 🚨⭐⭐ È la trappola di questa voce, e non si vede rileggendo: `remove: ["Ospite"]` toglie UN
 * ospite, non tutti. «Ospite» non è un nome, è un ruolo, e una partita può averne tre — è la
 * stessa ragione per cui `compagniDelloSlot` conta le occorrenze invece di unire per nome
 * (misurato sui dati veri il 26/07: quattro slot con tre ospiti davano DUE giocatori).
 * ⇒ Togliere «per nome» invece che «per occorrenza» svuoterebbe di tre persone una partita da
 * cui ne è uscita una, e il verso dell'errore sarebbe **il peggiore**: partite che sembrano
 * incomplete e avvisi «vi manca il quarto» a chi ha il campo pieno.
 *
 * @param confronta Come si normalizza un nome per confrontarlo (il readmodel ha la sua).
 */
export function togliRimossi(
  lista: string[],
  rimossi: string[],
  confronta: (v: unknown) => string,
): string[] {
  if (!rimossi?.length) return lista;
  const daTogliere = new Map<string, number>();
  for (const n of rimossi) {
    const nn = confronta(n);
    if (nn) daTogliere.set(nn, (daTogliere.get(nn) ?? 0) + 1);
  }
  const out: string[] = [];
  for (const g of lista ?? []) {
    const nn = confronta(g);
    const restano = daTogliere.get(nn) ?? 0;
    if (restano > 0) { daTogliere.set(nn, restano - 1); continue; }
    out.push(g);
  }
  return out;
}

/**
 * 🚨⭐⭐ QUANDO HA PARLATO **IL CIRCOLO** su questo slot — e non «quando il dato è stato
 * toccato», che è un'altra domanda e ha un'altra risposta.
 *
 * 📏 Questa funzione esiste per un difetto trovato dalla PROVA FISICA del 30/08, che il banco
 * non poteva vedere perché il `sincronizzatoAl` glielo passava il caso. Sul caso vero:
 *
 *   21:10:04.952  booking       «-Maurizio Aprea.-Ospite.»   ← il circolo
 *   21:12:12.831  staff_edit    {remove:["Ospite"]}          ← la rimozione
 *   21:12:14.778  staff_booking (la copia NOSTRA)            ← scritta 2 s dopo
 *
 * Confrontando la rimozione col massimo di TUTTE le righe (21:12:14) risultava già recepita,
 * e la correzione non usciva. ⚖️ E non era sfortuna: la copia nostra la scrive **la stessa
 * operazione** che produce la rimozione, sempre un istante dopo ⇒ la cura non avrebbe morso
 * **MAI**. Un difetto strutturale, non un caso raro.
 *
 * 📌 *Un campo si legge per quello che MISURA, non per come si chiama*: `synced_at` sulle copie
 * nostre è «quando l'abbiamo scritta noi», ed è giusto che ci sia — ma sommarlo al resto
 * risponde a «quando questo dato è stato toccato», mentre qui serve «quando il circolo ha
 * parlato». Due domande, un nome solo.
 */
export function istanteDelCircolo(
  righe: Array<{ record_type?: unknown; synced_at?: unknown }>,
  eCopiaNostra: (t: unknown) => boolean,
): string | null {
  let out = '';
  for (const r of righe ?? []) {
    if (eCopiaNostra(r?.record_type)) continue;
    const q = clean(r?.synced_at);
    if (q && q > out) out = q;
  }
  return out || null;
}
