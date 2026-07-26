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
 */
export function rosterDaPayload(payload: Record<string, unknown>): string[] {
  const roster: string[] = [];
  const gio = payload.giocatori;
  if (Array.isArray(gio)) {
    roster.push(...gio.map((g: unknown) =>
      clean(typeof g === 'object' && g !== null ? (g as Record<string, unknown>).nome : g)));
  }
  if (payload.giocatore) roster.push(clean(payload.giocatore));
  if (roster.every((g) => !g) && payload.nome) {
    roster.push(...String(payload.nome).split(',').map((n) => clean(n)).filter(Boolean));
  }
  return roster;
}

/** Una riga dello slot, ridotta a ciò che serve per sapere chi gioca. */
export type RigaSlot = {
  /** I nomi letti dalla NOSTRA copia: `giocatori` (oggetti o stringhe), `giocatore`, e il ripiego `nome`. */
  roster: string[];
  /** La scheda del circolo, `-Nome.-Nome.` — c'è sulle righe sincronizzate, mai sugli `staff_booking`. */
  descrizione?: string | null;
};

export type EsitoRoster = {
  /** I giocatori da usare, chiave normalizzata → nome come lo scrive il gestionale. Vuoto se `incoerente`. */
  roster: Map<string, string>;
  /** L'unione grezza di tutte le righe. Serve a distinguere «non c'eri» da «sei stato sostituito». */
  unione: Map<string, string>;
  /** Da dove vengono i giocatori scelti. `circolo` = ripiego sulla scheda, cioè le copie discordavano. */
  fonte: 'nostra' | 'circolo';
  /** Vero se non si è riusciti a stabilire chi gioca: chi chiama deve guardare QUESTO per primo. */
  incoerente: boolean;
};

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
  const unione = mappaNomi(righe.flatMap((r) => r.roster));
  if (unione.size <= maxGiocatori) {
    return { roster: unione, unione, fonte: 'nostra', incoerente: false };
  }

  // Le copie si contraddicono ⇒ vale solo la scheda del circolo.
  const circolo = mappaNomi(righe.flatMap((r) => playersFromDescrizione(r.descrizione)));

  // 🚨 ESATTAMENTE quattro, non «al massimo quattro». Se la scheda ne desse tre mentre noi
  // ne leggiamo cinque, la discordanza è troppo grande per fidarsi: prenderne tre non
  // sarebbe «prendere i quattro giusti», sarebbe indovinare. Ci si ferma.
  if (circolo.size === maxGiocatori) {
    return { roster: circolo, unione, fonte: 'circolo', incoerente: false };
  }
  return { roster: new Map(), unione, fonte: 'circolo', incoerente: true };
}

/**
 * Il socio risulta nella nostra copia ma NON fra i giocatori scelti dalla scheda del circolo:
 * è stato sostituito. Va distinto da «non ti trovo in questa partita», perché il socio la
 * vede ancora nel proprio elenco e sentirsi dire «non la trovo» sarebbe un vicolo cieco.
 */
export function sostituito(esito: EsitoRoster, varianti: Set<string>): boolean {
  if (esito.incoerente || esito.fonte !== 'circolo') return false;
  const nelRosterScelto = [...esito.roster.keys()].some((nn) => varianti.has(nn));
  const nellaNostraCopia = [...esito.unione.keys()].some((nn) => varianti.has(nn));
  return nellaNostraCopia && !nelRosterScelto;
}
