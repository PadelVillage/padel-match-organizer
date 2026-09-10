// dichiara-fatti.ts — IL GESTIONALE DICHIARA AL SOCIO CIÒ CHE IL CIRCOLO HA APPENA CONFERMATO.
//
// 🗣️ Voce 76. Il modulo accanto (`fatti-da-conferma.ts`) decide **cosa** si dice ed è puro;
// qui c'è la parte che tocca il database: leggere chi c'è in campo, e mettere i fatti in coda.
// Sono separati apposta — le regole si provano senza un database, e le prove restano vere.
//
// ⭐⭐ IL PUNTO DELL'INTERA VOCE, in una riga: fino a oggi questa coda la riempiva **solo** il
// sync, che vive leggendo Matchpoint. Adesso la riempie anche il gestionale, appena il circolo
// gli ha detto sì. ⇒ Il giorno in cui Matchpoint si spegne, questa strada continua a
// funzionare da sola: è la ragione per cui la voce esiste, e non la velocità.
//
// 🚨 TUTTO QUI DENTRO È BEST-EFFORT, e va letto sapendolo. Chi chiama ha **già scritto sul
// Matchpoint vero**: il campo è prenotato, spostato o liberato per davvero. Un guasto in
// questo file non deve poter annullare quel fatto, né farlo sembrare fallito a chi l'ha
// chiesto — *un avviso perso è un fastidio, una scrittura data per fallita quando è riuscita
// manda la segreteria a rifarla*, che è la doppia prenotazione che la voce 23 evita.
// ⇒ Nessuna funzione qui dentro lancia: tornano un numero e lasciano una riga nel registro.

import { campoScritto, type CoordinateSlot, type FattoStaff } from './fatti-da-conferma.ts';
import { playersFromDescrizione } from '../consumer-booking-write/roster-slot.ts';

/**
 * Il minimo che serve per leggere e scrivere: si passa il client che il chiamante ha già.
 *
 * ⚠️ Volutamente lasco. Tipizzare la catena di `.eq()` di supabase-js qui vorrebbe dire
 * riscrivere il suo builder, e il tipo si romperebbe al primo filtro in più — vincolando la
 * forma della query invece del contratto. Le due chiamate vere sono poche righe più sotto e si
 * leggono per intero.
 */
// deno-lint-ignore no-explicit-any
type ClientMinimo = { from: (tabella: string) => any };

/** Che cosa si è trovato nella copia locale di uno slot. */
export type SlotLocale = {
  /** I nomi come li scrive il circolo, nell'ordine della scheda. */
  roster: string[];
  /** Le coordinate **come le scrive la copia locale**: è la forma che il socio legge. */
  coordinate: CoordinateSlot;
  /** Il tipo grezzo, che `fatti-da-conferma` tradurrà in `lezione` o `partita`. */
  tipo?: string;
  /**
   * 🆕⏱️ A che ora questo slot FINIVA, `HH:MM` — voce 194 ②.
   *
   * ⚖️ Si legge da `ora_fine` quando c'è e altrimenti si **calcola** da `ora` + `durata`, che è
   * il caso normale: 📏 misurato il 10/09 su `cudi`, le righe `booking` hanno `durata` e **non**
   * `ora_fine` (0 su 288), quelle `staff_booking` ce l'hanno tutt'e due (34 su 34).
   * ⚠️ Può mancare: allora il messaggio dice la durata nuova senza il confronto.
   */
  fine?: string;
  /** 🆕👨‍🏫 Il maestro di questo slot, come lo scrive il circolo. Vuoto su una partita. */
  istruttore?: string;
};

/**
 * ⏱️ DA UNA `durata` A DEI MINUTI, e serve perché quel campo ha **due unità con lo stesso nome**.
 *
 * 📏 Misurato il 10/09/2026 su `cudi`, ed è una trappola vera, non un caso di scuola:
 *   · `booking` (dal sync, cioè da Matchpoint) la scrive in **ORE** — `1.5` · `2` · `1` · `3`;
 *   · `staff_booking` (dall'app) la scrive in **MINUTI** — `90` · `60` · `120`.
 * ⇒ Leggerla come minuti darebbe a una partita di un'ora e mezza una durata di **un minuto e
 * mezzo**, e l'ora di fine sarebbe quella d'inizio: un messaggio che sembra giusto e non lo è.
 *
 * ⭐ La regola NON è nuova: è quella che l'app applica da sempre (`parseBookingDurationMinutes`,
 * `index.html`) — `>= 30` vale minuti, sotto vale ore. Si porta invece di inventarne una
 * seconda, perché due modi di leggere la stessa colonna divergono il giorno in cui qualcuno ne
 * corregge uno solo.
 * ⚠️ Torna `null` quando non sa: il chiamante allora non dice l'orario, invece di dirne uno finto.
 */
function durataInMinuti(v: unknown): number | null {
  const n = Number(String(v ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n >= 30 ? Math.round(n) : Math.round(n * 60);
}

/** `09:00` + 90 ⇒ `10:30`. Torna `null` se l'inizio non è un orario o i minuti non si sanno. */
function oraPiuMinuti(ora: string, minuti: number | null): string | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(ora ?? '').trim());
  if (!m || minuti == null) return null;
  // ⚠️ Il modulo 24 h regge una partita che scavalca la mezzanotte senza inventare un «25:30».
  const tot = ((Number(m[1]) * 60 + Number(m[2]) + minuti) % 1440 + 1440) % 1440;
  return `${String(Math.floor(tot / 60)).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
}

/** Solo le cifre: «Campo 2», «2» e « 2 » sono lo stesso campo. */
function cifre(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

/**
 * DA UN `idReserva` ALLE COORDINATE DELLO SLOT, leggendo la copia locale.
 *
 * 🚨 Serve perché chi chiama può avere solo l'id — vedi il commento su `idReserva` in
 * `rosterDaCopiaLocale`. Le coordinate escono **come le scrive la copia**, che è la forma che
 * il socio legge e quella su cui le chiavi combaciano.
 *
 * ⚠️ Torna `null` se non trova niente, e lo **dice nel registro**: un ripiego che fallisce in
 * silenzio è esattamente ciò che il 23/08 ha reso difficile capire perché la cura non fosse
 * entrata in funzione. *Ogni strada che si arrende deve lasciare una riga.*
 */
export async function slotDaIdReserva(
  client: ClientMinimo,
  idReserva: string,
): Promise<{ data: string; ora: string; campo: string } | null> {
  const id = String(idReserva ?? '').trim();
  if (!id) return null;
  try {
    const esito = await client
      .from('pmo_cloud_records')
      .select('payload')
      .eq('record_type', 'booking')
      .eq('payload->>idReserva', id)
      .limit(5);
    if (esito?.error) throw esito.error;
    for (const r of (esito?.data ?? []) as Array<{ payload?: Record<string, unknown> }>) {
      const p = (r?.payload || {}) as Record<string, unknown>;
      const data = String(p?.data ?? '').trim();
      const ora = String(p?.ora ?? '').trim();
      if (data && ora) return { data, ora, campo: String(p?.campo ?? '').trim() };
    }
    console.warn(JSON.stringify({ event: 'slot_da_idreserva_non_trovato', idReserva: id }));
    return null;
  } catch (e) {
    console.warn(JSON.stringify({
      event: 'slot_da_idreserva_illeggibile',
      idReserva: id,
      error: String((e as Error)?.message ?? e),
    }));
    return null;
  }
}

/**
 * CHI C'È IN CAMPO, letto dalla copia locale del gestionale.
 *
 * ⭐ Si legge dalla COPIA LOCALE e non si chiede a nessuno, ed è la regola ferrea applicata
 * alla lettera: *il gestionale SA, il bot DICE*. Il roster ce l'abbiamo già in casa — è la
 * stessa `descrizione` da cui il sync ricava le sue fotografie — e andarlo a richiedere al
 * worker significherebbe far dipendere un avviso da un pezzo che il giorno dello spegnimento
 * non esiste più.
 *
 * 🚨⭐ IL CAMPO SI CONFRONTA IN CIFRE, e non è pignoleria: la stessa partita esiste in copie
 * che scrivono il campo in due modi («Campo 1» dal sync, «1» dallo `staff_booking` dell'app).
 * Un filtro sul testo esatto tornerebbe **zero righe** senza nessun errore — cioè un roster
 * vuoto, nessun fatto, e un silenzio che nessuno collega alla causa. È la stessa ragione per
 * cui `chiaveSlot` tiene solo le cifre.
 *
 * ⚠️ Torna `null` quando non trova niente da dire (nessuna riga, o solo titoli liberi senza
 * roster). Non è un errore: chi chiama semplicemente non dichiara, e la cosa resta al sync —
 * cioè al comportamento che c'era prima di questa voce.
 */
export async function rosterDaCopiaLocale(opts: {
  client: ClientMinimo;
  data: string;
  ora: string;
  campo: unknown;
  /**
   * 🚨⭐⭐ IL RIPIEGO CHE MANCAVA, e la prova del 23/08 l'ha pagato. Chi chiama può non avere
   * la terna: `consumer-booking-write` compone la richiesta come
   * `target.idReserva ? { idReserva } : { campo, data, ora }` ⇒ per una prenotazione che
   * viene dal sync manda **solo l'id**, e qui arrivavano tre campi vuoti.
   * ⚖️ E il codice del ponte lo aveva scritto: *«su tutti i record veri `id_reserva` è vuoto,
   * quindi parte la terna — e un giorno in cui non fosse più così, questa è l'unica riga che
   * lo direbbe prima e non dopo»*. Quel giorno era il 23/08, e la riga c'era: era stata letta
   * a metà.
   * ⇒ Con l'id lo slot si **ricava**, invece di arrendersi: il database ce l'abbiamo sotto
   * mano. *Un dato che si può derivare non è un dato mancante.*
   */
  idReserva?: string;
}): Promise<SlotLocale | null> {
  const { client, ora, campo, idReserva } = opts;
  let { data } = opts;
  // Senza la terna ma con l'id: si risolve lo slot e si riparte da lì.
  if ((!data || !ora) && idReserva) {
    const coord = await slotDaIdReserva(client, idReserva);
    if (!coord) return null;
    return await rosterDaCopiaLocale({ client, ...coord });
  }
  if (!data || !ora) return null;
  try {
    // Si filtra sulla data nel database, e su ora e campo qui: così i due formati del campo
    // cadono insieme senza dover indovinare quale usa questa copia.
    // 📏 Il filtro sul JSON non ha un indice e non serve che ce l'abbia: misurato su PROD il
    // 23/08, le righe `booking` vive sono **131** in tutto — il calendario tiene solo il
    // futuro, non l'archivio. *Prima di ottimizzare, contare.*
    const esito = await client
      .from('pmo_cloud_records')
      .select('record_type, payload')
      /* 🚨⭐⭐ 10/09/2026 (voce 194 ②) — SI GUARDANO TUTT'E DUE I CASSETTI, e prima era uno solo.
       *
       * 📏 IL FATTO, misurato su `cudi` prima di toccare una riga: le 288 righe `booking` sono
       * ferme al **07/09 15:32** — l'ultimo giro di sync prima che le sei routine venissero
       * tolte l'08/09 — mentre le `staff_booking` sono state aggiornate **stamattina**. ⇒ Su
       * `booking` da solo, ogni prenotazione nata dopo l'08/09 è **invisibile**.
       *
       * ⛔ E la conseguenza non riguarda solo i due gesti nuovi: `spostata` e `formazione`
       * viaggiano su questa stessa funzione ⇒ **erano già mute** su tutto ciò che è nato dopo
       * l'08/09, e non lo diceva nessun errore. Questa non è una riga in più per la voce 194:
       * è la riparazione della strada su cui la voce 194 doveva salire.
       * 📌 *È la 194 ① un piano più sotto: una strada che copre un buco non lo chiude, lo
       * nasconde finché non si spegne. Lì si era spento il sync; qui si è spenta la copia che
       * il sync riempiva.*
       *
       * ⚖️ E i due cassetti non si sostituiscono, si SOMMANO: `booking` tiene lo storico vero
       * arrivato da Matchpoint, `staff_booking` quello che nasce da noi. Il giorno del distacco
       * il primo smette di crescere e il secondo resta — che è esattamente il verso giusto.
       * ⚠️ Su PROD questa riga non cambia niente di visibile: là il sync è vivo e `booking` è
       * la copia buona; `staff_booking` c'è già ed è la stessa partita vista dall'altra parte,
       * e a scegliere fra le due resta la regola del **roster più completo**, qui sotto. */
      .in('record_type', ['booking', 'staff_booking'])
      .eq('deleted', false)
      .eq('payload->>data', data) as { data?: unknown; error?: unknown };
    if (esito?.error) throw esito.error;
    const righe = Array.isArray(esito?.data) ? esito.data : [];
    const volute = cifre(campo);
    let migliore: SlotLocale | null = null;
    for (const r of righe) {
      const p = ((r as { payload?: Record<string, unknown> })?.payload || {}) as Record<string, unknown>;
      if (String(p?.ora ?? '').trim() !== String(ora).trim()) continue;
      if (cifre(p?.campo) !== volute) continue;
      /* 👥 IL ROSTER STA IN DUE POSTI DIVERSI NEI DUE CASSETTI, misurato il 10/09 su `cudi`:
       * `booking` lo porta dentro `descrizione` (la riga di testo del tabellone, da cui il sync
       * ricava le sue fotografie), `staff_booking` lo porta in `giocatori` — 34 righe su 34,
       * mentre `descrizione` lì c'è **una volta sola**. ⇒ Si prova la prima e si ripiega sulla
       * seconda, invece di scegliere in base al tipo di riga: così una riga che avesse tutt'e
       * due non dipende da quale delle due si è deciso di guardare.
       * ⭐ E `giocatori` arriva come `{ nome, codice }`: è **esattamente** la forma che il banco
       * della 194 ① ha trovato diventare `'[object Object]'` in silenzio, e che `destinatari()`
       * adesso accetta alla radice. La cura di ieri è ciò che rende percorribile questa strada
       * oggi — senza, qui nascerebbero destinatari che non esistono. */
      const daScheda = playersFromDescrizione(String(p?.descrizione ?? ''));
      const nomi = daScheda.length
        ? daScheda
        : (Array.isArray(p?.giocatori) ? (p.giocatori as unknown[]) : [])
          .map((g) => (g && typeof g === 'object' && 'nome' in (g as Record<string, unknown>))
            ? String((g as { nome?: unknown }).nome ?? '').trim()
            : String(g ?? '').trim())
          .filter(Boolean);
      if (!nomi.length) continue;   // un titolo libero («Torneo aziendale») non è un roster
      // ⚠️ Il roster PIÙ COMPLETO fra le copie, come fa `fotografia()` nel sync: le righe sono
      // la stessa partita ripetuta, non pezzi da sommare — unirle fonderebbe gli «Ospite».
      if (migliore && migliore.roster.length >= nomi.length) continue;
      const oraLetta = String(p?.ora ?? '').trim();
      migliore = {
        roster: nomi,
        coordinate: {
          data: String(p?.data ?? '').trim(),
          ora: oraLetta,
          campo: String(p?.campo ?? '').trim() || campoScritto(campo),
        },
        tipo: String(p?.tipo ?? '').trim() || undefined,
        // ⏱️ `ora_fine` quando c'è, altrimenti calcolata: su `booking` non c'è mai (0 su 288).
        fine: String(p?.ora_fine ?? '').trim() || oraPiuMinuti(oraLetta, durataInMinuti(p?.durata)) || undefined,
        istruttore: String(p?.istruttore ?? '').trim() || undefined,
      };
    }
    return migliore;
  } catch (e) {
    console.warn(JSON.stringify({
      event: 'roster_copia_locale_illeggibile',
      data, ora, campo: String(campo ?? ''),
      error: String((e as Error)?.message ?? e),
    }));
    return null;
  }
}

/**
 * I fatti vanno in coda, con `origine: 'conferma'` e l'istante VERO del gesto.
 *
 * ⭐ `visto_at` è **adesso**, e questa è la differenza che la voce 76 esiste per fare: dal sync
 * quella colonna portava l'istante del *giro*, cioè un'approssimazione che poteva sbagliare di
 * minuti e che impediva di accorciare la quiete. Qui è l'istante in cui il circolo ha detto sì.
 *
 * 🚨 Non lancia mai: torna quanti ne ha accodati (0 se qualcosa è andato storto) e lascia una
 * riga nel registro. La scrittura al circolo è già avvenuta — vedi la testata del file.
 */
export async function accodaFattiDaConferma(opts: {
  client: ClientMinimo;
  fatti: FattoStaff[];
  /** Per il registro: che gesto stava facendo chi chiama. */
  azione: string;
  /**
   * 🆕🗣️⭐⭐ CHI HA CHIESTO il gesto, quando **non** è stata la segreteria — 01/09/2026.
   *
   * 📏 Nato da una prova fisica: alle 20:01 una socia è entrata da sé in una partita aperta
   * (voce 88) e agli altri tre in campo il bot ha detto **«L'ha cambiata il circolo»**, con in
   * fondo il numero della segreteria. Il circolo non aveva fatto niente, e la segreteria di
   * quel gesto non sapeva nulla: falso nell'**attribuzione** e vicolo cieco nella **strada**.
   *
   * 🚨⭐⭐ E PERCHÉ NON BASTAVA `origine`, che è la deduzione che viene in mente per prima:
   * `'conferma'` vuol dire *«registrato nell'istante in cui il circolo ha detto sì»* — e ci
   * passa **anche la segreteria che lavora dall'app**. 📏 Misurato sul database il 01/09: delle
   * **16** righe `annullata` con `origine = 'conferma'` non si può dire chi le abbia chieste.
   * ⇒ Non è che il bot non lo sapesse: **non lo sapeva nemmeno il gestionale**. Un dato che non
   * è stato scritto non si recupera guardandone un altro con più attenzione.
   *
   * ⚠️ **Assente ⇒ la colonna resta nulla**, che vale «la segreteria»: è il comportamento di
   * sempre, e il bot senza questo campo dice le frasi di prima parola per parola. Le due metà
   * si possono quindi mettere in servizio in due momenti — ed è obbligatorio farlo in
   * quest'ordine, prima il bot.
   */
  chiestoDa?: string | null;
}): Promise<number> {
  const { client, fatti, azione } = opts;
  if (!fatti.length) return 0;
  const adesso = new Date().toISOString();
  // ⚠️ Vuoto vale ASSENTE: una stringa di spazi scritta in colonna farebbe dire al bot
  // «L'ha chiesto .» — cioè una frase rotta al posto di quella giusta di prima.
  const chiestoDa = String(opts.chiestoDa ?? '').trim() || null;
  try {
    const esito = await client
      .from('pmo_eventi_staff')
      .insert(fatti.map((f) => ({ ...f, visto_at: adesso, origine: 'conferma', chiesto_da: chiestoDa })));
    if (esito?.error) throw new Error(esito.error.message ?? String(esito.error));
    console.log(JSON.stringify({
      event: 'fatti_da_conferma_accodati',
      azione,
      quanti: fatti.length,
      gesto: fatti[0]?.gesto,
      slot: fatti[0]?.slot,
    }));
    return fatti.length;
  } catch (e) {
    // ⚠️ `warn` e non `error`: al circolo la scrittura è andata, e il sync resta la rete —
    // al giro dopo ri-scopre il cambiamento e l'avviso parte comunque, in ritardo. È
    // esattamente la risposta che il committente ha dato alla domanda ② della scheda.
    console.warn(JSON.stringify({
      event: 'fatti_da_conferma_non_accodati',
      azione,
      quanti: fatti.length,
      error: String((e as Error)?.message ?? e),
    }));
    return 0;
  }
}
