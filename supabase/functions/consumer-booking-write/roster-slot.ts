// Chi gioca davvero in uno slot: la regola in UN posto solo.
//
// Uno slot non è una riga: una partita di quattro sono QUATTRO record `booking` (uno per
// giocatore) più, se è stata prenotata dall'app, una o due copie `staff_booking`. Il roster
// si ricompone su TUTTE le righe — contarlo su una sola direbbe «sei solo» a chi solo non è.
//
// 🚨⭐ Ma le due copie possono CONTRADDIRSI, e allora l'unione conta più di quattro.
// Caso vero misurato su PROD il 26/07 (slot 27/07 13:00 campo 3, 6 righe):
//   · le 4 righe sincronizzate dal circolo (aggiornate quel mattino) elencano
//     Valeria Moschet · Silvia Balzarini · Giorgia Eporti · Pierangela Barbera
//   · le 2 righe della nostra copia in app, ferme al 20/07, elencano
//     Valeria Moschet · Silvia Balzarini · Giorgia Eporti · FEDERICA DA RIOS
// Nessuna delle due dice cinque: dicono quattro tutte e due, ma non le stesse quattro.
// Federica era nella prenotazione del 20/07 ed è stata SOSTITUITA da Pierangela; la nostra
// copia non l'ha saputo. Il «quinto giocatore» nasce solo dalla somma delle due liste.
//
// ⭐ Decisione del committente (26/07), presa davanti a questa misura: quando i conti non
// tornano si prendono i quattro dalla SCHEDA DEL CIRCOLO — cioè dalla `descrizione` delle
// righe sincronizzate, che è la fonte aggiornata (sync ogni ~2 minuti) e l'unica che sappia
// delle sostituzioni. Se nemmeno quella ne dà esattamente quattro non si indovina: ci si
// ferma e si manda in segreteria, come si faceva prima.
// 📊 Criterio e misura (PROD, tutti gli slot con `data >= oggi`, 26/07): 88 slot futuri,
// 1 sfora il quattro, e su quell'1 la scheda del circolo ne dà esattamente 4 — che sono
// quattro dei cinque, senza nomi inventati. 0 slot senza scheda utilizzabile.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🚨⭐⭐ 27/07 — MISURATO che contare di MENO non era «il verso sicuro»
//
// Il 26/07 la fusione degli «Ospite» era stata corretta in UNA sola sede (il readmodel), e
// questa era stata dichiarata innocua da un RAGIONAMENTO: «qui il dedupe rende l'unione più
// piccola, quindi è più difficile sforare il mai-più-di-quattro: verso sicuro». Il
// ragionamento guardava UNA soglia sola e ne esisteva una seconda, sotto: **meno di due
// giocatori ⇒ «sei solo»**. Contare troppo poco ci sbatte dentro.
//
// 📊 Misura (criterio: PROD, `booking`+`staff_booking` non cancellate, `data >= 2026-07-27`,
// raggruppate per slot `data|ora|campo`, lezioni escluse perché rifiutate prima del roster;
// payload veri dati in pasto a QUESTA funzione): **68 partite future, 57 contate giuste, 11
// contate in DIFETTO, 0 in eccesso** — e di quelle 11, **4 avrebbero risposto «sei solo» a
// chi solo non era**. Due cause distinte:
//
//   | causa | slot | cos'era |
//   |---|---|---|
//   | 🔗 i nomi c'erano ma il dedupe li fondeva | 4 | tre «Ospite» contati uno |
//   | 👻 i nomi non erano mai stati letti | 7 | i compagni stanno SOLO nella scheda del circolo |
//
// Caso vero: `-Ospite.-Ospite.-Ospite.-Sergio Dal Bianco.` su una riga sola ⇒ da qui usciva
// UN giocatore, e al socio si rispondeva «non risulta nessun altro oltre a te: qui non si
// esce, si annulla». Riaprendo l'elenco il bot gli rimostrava «Esci», perché il readmodel lo
// conta bene: un giro chiuso. → [[ospite-nella-scheda-non-nel-roster]]
//
// I due rimedi, entrambi allineati al readmodel (`compagni-slot.ts`), che era già giusto:
//  ① le liste si tengono SEPARATE e per ogni nome si prende il MASSIMO numero di volte in cui
//    compare in UNA sola lista, mai la somma. «Ospite» non è un nome, è un ruolo.
//  ② la scheda del circolo entra in gioco ogni volta che la nostra copia **non** dà una
//    partita piena e la scheda sì — non più soltanto quando la nostra SFORA.
// ══════════════════════════════════════════════════════════════════════════════════════════

/** I nomi come li scrive il gestionale, normalizzati per il confronto. */
export function clean(value: unknown) { return String(value ?? '').trim(); }

export function normName(value: unknown): string {
  return clean(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// 🚨 Copiata VERBATIM da `matchpoint-bookings-sync/index.ts`: due parser della stessa cosa
// divergono, e questo decide chi gioca. Nomi solo se la descrizione è una LISTA (inizia per
// `-`); un titolo libero non è un roster e dà []. Limite ereditato e voluto: lo `split('.')`
// spezza i nomi che contengono un punto — l'app mostra la stessa cosa, e restare identici al
// gestionale vale più che essere più furbi qui.
export function playersFromDescrizione(descr: string | undefined | null): string[] {
  const text = String(descr || '').trim();
  if (!text.startsWith('-')) return [];
  return text
    .split('.')
    .map((s) => s.replace(/^-+/, '').trim())
    .filter(Boolean);
}

/**
 * I giocatori scritti su UNA riga, nelle tre forme che il gestionale usa
 * (nessun record le ha tutte): `giocatori` a oggetti, `giocatori` a stringhe, `giocatore`.
 *
 * 🚨 `staff_booking.nome` NON è una persona: è la lista dei giocatori unita da virgole e
 * TRONCATA a metà parola («Aldo Bianchi, Bruna Conti, Nicola St»). Infilarla com'è aggiunge
 * un giocatore FANTASMA che non è nessuno — misurato sui dati veri di PROD il 26/07, dove
 * faceva contare cinque giocatori su una partita di quattro. Non si può nemmeno buttare via:
 * quando la riga non ha altra fonte (uno `staff_booking` a UN giocatore, dove `nome` è un
 * nome vero) è l'unico roster che si ha. Perciò è un RIPIEGO, e spezzato sulle virgole.
 *
 * ⭐⭐ Torna le liste SEPARATE, mai concatenate: `giocatori` è un elenco, l'intestatario
 * `giocatore` è UNA persona, e il ripiego `nome` è un terzo elenco. Concatenarle prima di
 * contare rimetterebbe il difetto che tutto questo modulo esiste per evitare — l'intestatario
 * comparirebbe due volte, e con lui ogni «Ospite» ripetuto.
 */
export function listeDaPayload(payload: Record<string, unknown>): string[][] {
  const liste: string[][] = [];
  const gio = payload.giocatori;
  if (Array.isArray(gio)) {
    const daGiocatori = gio
      .map((g: unknown) =>
        clean(typeof g === 'object' && g !== null ? (g as Record<string, unknown>).nome : g))
      .filter(Boolean);
    if (daGiocatori.length) liste.push(daGiocatori);
  }
  // L'intestatario è UNA persona: lista a sé, così non gonfia il conteggio degli altri.
  const intestatario = clean(payload.giocatore);
  if (intestatario) liste.push([intestatario]);
  if (!liste.length && payload.nome) {
    const daNome = String(payload.nome).split(',').map((n) => clean(n)).filter(Boolean);
    if (daNome.length) liste.push(daNome);
  }
  return liste;
}

/** Tutti i nomi di una riga in un elenco solo: serve al MATCH, dove le ripetizioni non contano. */
export function nomiDellaRiga(riga: RigaSlot): string[] {
  return riga.liste.flat();
}

/**
 * I giocatori di un insieme di liste, CON le ripetizioni: per ogni nome il MASSIMO numero di
 * volte in cui compare in UNA sola lista, mai la somma.
 *
 * 🚨 Regola identica a `compagniDelloSlot` in `consumer-player-readmodel/compagni-slot.ts`:
 * due conteggi della stessa cosa divergono, e questo decide se un socio «è solo».
 *  · massimo e non somma → le liste sono COPIE della stessa partita: sommarle moltiplica;
 *  · per lista e non per riga → dentro la stessa riga convivono più elenchi che di norma
 *    dicono la stessa cosa: sommarli darebbe sei ospiti dove sono tre.
 * ⚠️ Limite dichiarato: due liste che elencassero ospiti DIVERSI sono indistinguibili — si
 * prende la più informativa, cioè quella che ne conta di più.
 */
export function giocatoriDelleListe(liste: string[][]): string[] {
  const occorrenze = new Map<string, number>();  // nome normalizzato → quante volte, al massimo
  const comeScritto = new Map<string, string>(); // nome normalizzato → come lo scrive il gestionale
  const ordine: string[] = [];                   // prima apparizione, per non rimescolare l'elenco

  for (const lista of liste) {
    const inQuestaLista = new Map<string, number>();
    for (const g of lista) {
      const nn = normName(g);
      if (!nn) continue;
      inQuestaLista.set(nn, (inQuestaLista.get(nn) ?? 0) + 1);
      if (!comeScritto.has(nn)) { comeScritto.set(nn, clean(g)); ordine.push(nn); }
    }
    for (const [nn, quante] of inQuestaLista) {
      if (quante > (occorrenze.get(nn) ?? 0)) occorrenze.set(nn, quante);
    }
  }

  const giocatori: string[] = [];
  for (const nn of ordine) {
    for (let i = 0; i < (occorrenze.get(nn) ?? 0); i++) giocatori.push(comeScritto.get(nn) as string);
  }
  return giocatori;
}

/** Una riga dello slot, ridotta a ciò che serve per sapere chi gioca. */
export type RigaSlot = {
  /** Le liste-roster della NOSTRA copia, tenute SEPARATE: `giocatori`, l'intestatario, il ripiego `nome`. */
  liste: string[][];
  /** La scheda del circolo, `-Nome.-Nome.` — c'è sulle righe sincronizzate, mai sugli `staff_booking`. */
  descrizione?: string | null;
};

export type EsitoRoster = {
  /**
   * I giocatori da usare, come li scrive il gestionale e **con le ripetizioni**: «Ospite» può
   * comparire più volte, perché è un ruolo e non un nome. Vuoto se `incoerente`.
   * ⭐ È un elenco e non più una mappa proprio per questo: `roster.length` è il numero di
   * persone in campo, che una mappa per nome non sa rappresentare.
   */
  roster: string[];
  /** Le chiavi normalizzate dei giocatori scelti → il nome come lo scrive il gestionale. Serve a riconoscere il socio. */
  chiavi: Map<string, string>;
  /** L'unione della NOSTRA copia. Serve a distinguere «non c'eri» da «sei stato sostituito». */
  unione: Map<string, string>;
  /** Da dove vengono i giocatori scelti. `circolo` = ha vinto la scheda del circolo. */
  fonte: 'nostra' | 'circolo';
  /** Vero se non si è riusciti a stabilire chi gioca: chi chiama deve guardare QUESTO per primo. */
  incoerente: boolean;
};

/**
 * Il nome con cui il gestionale scrive un giocatore NON socio. Misurato sui dati veri di PROD
 * il 27/07 (criterio: righe future con la scheda in formato lista): scritto in **un solo
 * modo**, «Ospite», 47 occorrenze su 47.
 */
const OSPITE = 'ospite';

/**
 * Dopo che il socio è uscito, in campo resterebbero SOLO ospiti — cioè nessun socio.
 *
 * ⭐ Decisione del committente (27/07), presa davanti alla misura: una partita fatta di soli
 * ospiti **non si lascia dal bot**, la gestisce la segreteria. Il motivo è che quei tre il
 * circolo non li conosce, il bot non può avvisarli e nessuno di loro può disdire: il campo
 * resterebbe occupato senza nessun socio dietro.
 * ⚠️ Vale sull'elenco DEI RESTANTI, non su tutto il roster: due soci e due ospiti restano una
 * partita fra soci, e da quella si esce normalmente.
 */
export function restanoSoloOspiti(restanti: string[]): boolean {
  return restanti.length > 0 && restanti.every((n) => normName(n) === OSPITE);
}

/** L'elenco senza UNA occorrenza del nome dato: chi esce toglie sé stesso, non tutti gli omonimi. */
export function senzaDiMe(roster: string[], mioNome: string): string[] {
  const io = normName(mioNome);
  let tolto = false;
  return roster.filter((n) => {
    if (!tolto && normName(n) === io) { tolto = true; return false; }
    return true;
  });
}

function mappaNomi(nomi: string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const g of nomi) {
    const nn = normName(g);
    // Prima occorrenza vince: il nome è già quello del gestionale, non c'è una forma migliore.
    if (nn && !m.has(nn)) m.set(nn, clean(g));
  }
  return m;
}

/**
 * Chi gioca in questo slot, con la rete del «mai più di quattro».
 *
 * `maxGiocatori` arriva da fuori (è `GIOCATORI_PARTITA`) così il test può provare il confine
 * senza ricompilare una costante: si muove il lato dei DATI, non quello del codice.
 */
export function rosterDelloSlot(righe: RigaSlot[], maxGiocatori: number): EsitoRoster {
  const nostra = giocatoriDelleListe(righe.flatMap((r) => r.liste));
  const unione = mappaNomi(nostra);

  // La scheda del circolo: le righe sincronizzate ce l'hanno, gli `staff_booking` mai. Ogni
  // riga è una LISTA a sé — sono copie della stessa partita, non pezzi da sommare.
  const scheda = giocatoriDelleListe(
    righe.map((r) => playersFromDescrizione(r.descrizione)).filter((l) => l.length),
  );

  // 🚨⭐⭐ Quando vince la scheda del circolo: ogni volta che la NOSTRA copia non racconta una
  // partita piena e la scheda sì. Fino al 26/07 la si consultava solo se la nostra SFORAVA, e
  // quella condizione copriva un caso solo — le copie che si contraddicono. Misurato il 27/07
  // sui dati veri: i compagni mancano molto più spesso di quanto ne avanzino (11 slot su 68
  // contati in difetto, 0 in eccesso), e in 4 casi la nostra copia ne dava UNO SOLO su quattro.
  // 🚨 ESATTAMENTE `maxGiocatori`, non «almeno»: se la scheda ne desse tre mentre noi ne
  // leggiamo cinque, la discordanza è troppo grande per fidarsi — prenderne tre non sarebbe
  // «prendere i quattro giusti», sarebbe indovinare.
  if (scheda.length === maxGiocatori && nostra.length !== maxGiocatori) {
    return { roster: scheda, chiavi: mappaNomi(scheda), unione, fonte: 'circolo', incoerente: false };
  }
  if (nostra.length <= maxGiocatori) {
    return { roster: nostra, chiavi: unione, unione, fonte: 'nostra', incoerente: false };
  }
  return { roster: [], chiavi: new Map(), unione, fonte: 'circolo', incoerente: true };
}

/**
 * Il socio risulta nella nostra copia ma NON fra i giocatori scelti dalla scheda del circolo:
 * è stato sostituito. Va distinto da «non ti trovo in questa partita», perché il socio la
 * vede ancora nel proprio elenco e sentirsi dire «non la trovo» sarebbe un vicolo cieco.
 */
export function sostituito(esito: EsitoRoster, varianti: Set<string>): boolean {
  if (esito.incoerente || esito.fonte !== 'circolo') return false;
  const nelRosterScelto = [...esito.chiavi.keys()].some((nn) => varianti.has(nn));
  const nellaNostraCopia = [...esito.unione.keys()].some((nn) => varianti.has(nn));
  return nellaNostraCopia && !nelRosterScelto;
}
