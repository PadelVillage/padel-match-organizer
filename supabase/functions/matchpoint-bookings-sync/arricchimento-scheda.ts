/** 🪟⭐⭐ VOCE 142 — LA SECONDA METÀ: l'ID INTERNO e le OSSERVAZIONI dentro il gestionale.
 *
 * 🗣️ Sua, disegnata in cinque messaggi il 04/09/2026 dal cellulare: *«ogni due minuti importiamo
 *    da Matchpoint tutti questi dati anche se da fonti diverse, così quando clicco su una scheda
 *    ho tutti i dati immediatamente»* — e il primo passo (i **nomi** subito) è in servizio dal
 *    04/09. Questa è la metà che mancava.
 *
 * 📏 PERCHÉ SERVE UNA LETTURA IN PIÙ, misurato e non supposto: i **nomi** l'export li porta (la
 *    `descrizione`), ma l'**id interno** (`HiddenFieldIdCliente`) e le **Osservazioni** stanno
 *    **solo** dentro la scheda della singola prenotazione. La prova delle Osservazioni è la nota
 *    *«ciao ciao»* salvata il 03/09 alle 23:10 su Campo 3 · 05/09 · 15:00: nel record **non c'è**.
 *    ⇒ Una lettura per prenotazione, e una sola: id e Osservazioni **stanno nello stesso posto**.
 *
 * 🚨⭐⭐ LA TRAPPOLA PIÙ GROSSA, ed è quella che ha messo PROD in ginocchio il 05/09 (voce 160):
 *    **in questo payload non entra NESSUN TIMBRO DI TEMPO.** Un `arricchitoAt` renderebbe il
 *    payload diverso a ogni giro ⇒ ogni riga verrebbe riscritta ogni 2 minuti, che è esattamente
 *    la fabbrica di WAL da cui nasce la 160 (437 righe invariate riscritte per giro, ~250.000
 *    scritture inutili al giorno, e l'archiviazione del WAL che smette di farcela).
 *    ⇒ Qui entrano **solo fatti stabili**: gli id, le Osservazioni, e l'impronta dei nomi per cui
 *    sono stati letti. Riletti gli stessi nomi, il payload è **identico** e non si riscrive.
 *    📌 *Un campo che cambia da sé trasforma «non riscrivere l'invariato» in una riga che non è
 *       mai invariata.*
 *
 * ⛔ E COSA NON SI TOCCA, che è la cosa da non sbagliare: **`giocatori` resta `string[]`.** Su
 *    quella lista `eventi-staff.ts` confronta i roster per decidere **CHI VIENE AVVISATO** — la
 *    regola sua del 23/08 («quando la segreteria fa un'operazione, le persone dentro la partita
 *    devono essere avvisate»). Cambiarle forma per infilarci gli id metterebbe a rischio gli
 *    avvisi ai soci per una comodità di lettura. ⇒ Gli id vanno in un campo **accanto**
 *    (`idClienti`), e chi li vuole li accosta per nome.
 *    📌 *Non si cambia la forma del dato su cui poggia un avviso, per un dato che serve a una
 *       scheda.*
 *
 * ⚖️ E LA MAPPA, non l'elenco parallelo: `idClienti` è `{ nomeNormalizzato: id }`. Due elenchi
 *    affiancati si disallineano appena qualcuno riordina il roster — e il roster **si riordina**
 *    (l'organizzatore è il primo, e cambia). Una mappa per nome regge il riordino.
 *    ⚠️ Il buco che resta, dichiarato: **due omonimi** che si scambiano lasciano nomi identici e
 *    id scambiati. È lo stesso buco già scritto nella scheda della 142 ⇒ prima di un gesto
 *    **distruttivo** (togliere qualcuno) si rilegge comunque dal vivo.
 *
 * PURE tutte, così il banco le esegue invece di rileggerle (lezione della 149).
 */

export type LetturaScheda = {
  partecipantiFinali?: Array<{ nome?: string; idCliente?: string | number }> | null;
  note?: string | null;
};

/** La chiave con cui un nome si confronta: minuscolo, senza accenti, spazi singoli. La stessa
 *  forma usata dal gestionale per non far sembrare due persone «lucas vidal» e «Lucas Vidal». */
export function chiaveNome(s: unknown): string {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

/** L'impronta dei nomi per cui l'arricchimento vale. ORDINATA di proposito: un roster riordinato
 *  è lo stesso roster, e rileggerlo costerebbe una pagina di Matchpoint per niente. */
export function improntaRoster(giocatori: unknown): string {
  const nomi = Array.isArray(giocatori) ? giocatori : [];
  return nomi
    .map((g) => chiaveNome(typeof g === 'string' ? g : (g as { nome?: string })?.nome))
    .filter(Boolean)
    .sort()
    .join('|');
}

/** Va letta dal vivo? Sì se non l'abbiamo mai letta, o se i NOMI sono cambiati da allora.
 *  ⛔ Niente scadenza a tempo: sarebbe un timbro travestito, e riporterebbe la riscrittura
 *     continua da cui la 160 ci ha appena tirati fuori. */
export function vaArricchita(payloadEsistente: unknown, giocatoriOra: unknown): boolean {
  const impronta = improntaRoster(giocatoriOra);
  if (!impronta) return false;                       // nessun giocatore: non c'è scheda da completare
  const p = (payloadEsistente || {}) as Record<string, unknown>;
  if (!p.idClienti || typeof p.idClienti !== 'object') return true;
  return String(p.arricchitoPer || '') !== impronta;
}

/** Quali leggere in questo giro, e quante. ⚖️ Il tetto non è prudenza generica: il worker è **un
 *  solo browser condiviso con PROD**, e ogni lettura gli prende la pagina. Un giro che ne chiede
 *  troppe ruba tempo al sync stesso, che è la cosa che tiene vivo il calendario.
 *  ⭐ Si servono prima le prenotazioni **più vicine nel tempo**: sono quelle che qualcuno aprirà
 *     davvero oggi. Un arretrato di 300 si smaltisce da sé, ma dal lato giusto. */
export function scegliDaArricchire<T extends { data?: string; ora?: string }>(
  candidati: T[],
  tetto: number,
): T[] {
  const n = Math.max(0, Math.floor(Number(tetto) || 0));
  if (!n) return [];
  return candidati
    .slice()
    .sort((a, b) => `${a?.data || ''} ${a?.ora || ''}`.localeCompare(`${b?.data || ''} ${b?.ora || ''}`))
    .slice(0, n);
}

/** Cosa entra nel payload dopo una lettura riuscita. Torna `null` quando la lettura non aggiunge
 *  niente di utile — così chi chiama non scrive una riga per un giro a vuoto.
 *  🚨 Le Osservazioni si scrivono **anche vuote** (`''`): «non c'è nota» è un fatto, e lasciarle
 *     assenti farebbe sembrare la scheda non ancora letta a ogni giro successivo. */
export function fondiArricchimento(
  lettura: LetturaScheda | null | undefined,
  giocatoriOra: unknown,
): { idClienti: Record<string, string>; note: string; arricchitoPer: string } | null {
  if (!lettura) return null;
  const impronta = improntaRoster(giocatoriOra);
  if (!impronta) return null;
  const idClienti: Record<string, string> = {};
  for (const p of (Array.isArray(lettura.partecipantiFinali) ? lettura.partecipantiFinali : [])) {
    const k = chiaveNome(p?.nome);
    const id = p?.idCliente == null ? '' : String(p.idCliente).trim();
    if (k && id) idClienti[k] = id;
  }
  const note = typeof lettura.note === 'string' ? lettura.note : '';
  // ⛔ Nessun id letto e nessuna nota: la pagina non ha detto niente che valga una riscrittura.
  //    Senza questo freno un guasto silenzioso del worker riscriverebbe ogni prenotazione con una
  //    mappa vuota, e per il giro dopo risulterebbe «già arricchita» — cioè si perderebbe il dato
  //    dichiarando di averlo.
  if (!Object.keys(idClienti).length && !note) return null;
  return { idClienti, note, arricchitoPer: impronta };
}

/** 🚨⭐⭐ QUELLO CHE L'ARRICCHIMENTO SI PORTA DIETRO DAL GIRO PRIMA — e senza cui non si accumula.
 *
 * 📏 MISURATO SU PROD IL 06/09, acceso a tetto 1 per 14 minuti: quattro giri, quattro letture,
 *    quattro `riuscite: 1` — e in archivio **una sola** prenotazione arricchita, ogni volta una
 *    DIVERSA. Il banco era verde e l'aveva mancato tutto: le funzioni pure erano giuste, era il
 *    collegamento a perdere il lavoro.
 *
 * ⚖️ IL PERCHÉ, ed è strutturale e non una svista locale: `validation.bookings` **nasce
 *    dall'export XLSX a ogni giro**, e l'export questi tre campi non li porta. Il giro arricchisce
 *    la riga che legge; tutte le altre vengono riscritte dal payload nuovo, che `idClienti` non ce
 *    l'ha ⇒ il dato del giro prima **viene cancellato**. Ne guadagni una, ne perdi una: il conto
 *    non sale mai.
 *
 * 🚨 E costava DUE volte, perché la riga che perde il dato risulta **cambiata**: due righe
 *    riscritte a ogni giro per sempre, che non convergono mai. È la voce 160 in miniatura — la
 *    fabbrica di WAL, in piccolo ma senza fine.
 *
 * ⛔ SI CONSERVA SOLO SE VALE ANCORA: l'impronta salvata deve combaciare con i nomi di adesso. Un
 *    roster cambiato rende quegli id **stantii** ⇒ non si riportano, e la riga torna candidata a
 *    una lettura nuova. Conservare senza controllare l'impronta terrebbe in vita un id sbagliato,
 *    che è peggio di non averlo.
 *
 * 📌 *Un dato che nasce da una lettura occasionale, dentro un payload che si ricostruisce da capo
 *    a ogni giro, va riportato avanti a mano — o non esiste.* */
export function conservaArricchimento(
  payloadEsistente: unknown,
  giocatoriOra: unknown,
): { idClienti: Record<string, string>; note: string; arricchitoPer: string } | null {
  const p = (payloadEsistente || {}) as Record<string, unknown>;
  const impronta = improntaRoster(giocatoriOra);
  if (!impronta) return null;
  // ⛔ Deve valere per QUESTI nomi: un'impronta diversa è un roster cambiato, e quegli id non
  //    parlano più di questa partita.
  if (String(p.arricchitoPer || '') !== impronta) return null;
  const id = p.idClienti;
  if (!id || typeof id !== 'object' || Array.isArray(id)) return null;
  const idClienti: Record<string, string> = {};
  for (const [k, v] of Object.entries(id as Record<string, unknown>)) {
    const val = v == null ? '' : String(v).trim();
    if (k && val) idClienti[k] = val;
  }
  if (!Object.keys(idClienti).length) return null;
  return {
    idClienti,
    note: typeof p.note === 'string' ? p.note : '',
    arricchitoPer: impronta,
  };
}
