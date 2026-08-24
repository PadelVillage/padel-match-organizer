// Chi altro gioca in questo slot: i COMPAGNI del socio, contati bene.
//
// Uno slot non è una riga: la stessa partita esiste in più copie (una riga `booking` per
// giocatore, più le eventuali `staff_booking` create dall'app), e ogni copia ripete l'intero
// elenco. Perciò i nomi vanno UNITI, non sommati — altrimenti una partita di quattro ne
// conterebbe sedici.
//
// 🚨⭐⭐ Ma unire per NOME fonde anche gli «Ospite», e «Ospite» non è un nome: è un ruolo.
// Tre ospiti diversi non sono la stessa persona tre volte. Misurato sui dati veri di PROD il
// 26/07 (criterio: slot con `data >= oggi`, occorrenze di «Ospite» nella `descrizione`
// sincronizzata, massimo fra le righe dello slot):
//
//   | «Ospite» nella scheda | slot | come venivano contati |
//   |---|---|---|
//   | nessuno               |  82  | giusti                |
//   | 1                     |   4  | giusti (3 soci + 1 ospite = 4) |
//   | 3                     |   4  | ❌ DUE giocatori invece di quattro |
//
// Caso vero: `-Sergio Dal Bianco.-Ospite.-Ospite.-Ospite.` → il ponte dava un solo compagno
// («Ospite»), quindi 2 giocatori. La partita è invece COMPLETA, si gioca in quattro, e con
// quel conteggio il socio finiva nella famiglia sbagliata di avvisi: gli sarebbe arrivato
// «vi manca il quarto» avendo il campo pieno.
// ⭐ Decisione del committente (26/07): «Ospite» è **una persona vera che verrà a giocare»,
// non un posto ancora da riempire ⇒ si conta.
//
// La regola, in una riga: per ogni nome si tiene il MASSIMO numero di volte in cui compare
// in UNA SOLA lista, mai la somma fra liste.
//   · massimo, non somma → le liste sono copie della stessa partita: sommarle moltiplica;
//   · per lista e non per riga → dentro la STESSA riga convivono due elenchi (la scheda del
//     circolo in `descrizione` e l'array `giocatori`), che di norma dicono la stessa cosa:
//     sommarli darebbe sei ospiti dove sono tre.
//
// ⚠️ Il limite dichiarato: se due liste elencassero ospiti DIVERSI non c'è modo di saperlo —
// «Ospite» e «Ospite» sono indistinguibili. Si prende la lista più informativa, cioè quella
// che ne conta di più. È il verso giusto in cui sbagliare: contare troppi giocatori manda la
// partita fra le complete (nessun avviso), contarne troppo pochi manda avvisi falsi.

type JsonMap = Record<string, unknown>;

/** I nomi come li scrive il gestionale, ripuliti dagli spazi di bordo. */
export function clean(value: unknown) { return String(value ?? '').trim(); }

/** Forma normalizzata usata SOLO per confrontare due nomi, mai per mostrarli. */
export function normName(value: unknown): string {
  return clean(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * I compagni del socio in questo slot.
 *
 * @param liste    Tutte le liste-roster dello slot: una per ogni fonte di ogni riga
 *                 (la scheda del circolo, l'array `giocatori`, l'intestatario…).
 *                 Vanno passate SEPARATE: concatenarle prima di chiamare qui rimetterebbe
 *                 esattamente il difetto che questa funzione esiste per evitare.
 * @param varianti Le forme del nome del socio: non è compagno di sé stesso.
 * @param max      Tetto di sicurezza sulla lunghezza (tiene corto il payload del modello).
 */
export function compagniDelloSlot(
  liste: string[][],
  varianti: Set<string>,
  max: number,
): string[] {
  const occorrenze = new Map<string, number>();  // nome normalizzato → quante volte, al massimo
  const comeScritto = new Map<string, string>(); // nome normalizzato → come lo scrive il gestionale
  const ordine: string[] = [];                   // prima apparizione, per non rimescolare l'elenco

  for (const lista of liste) {
    const inQuestaLista = new Map<string, number>();
    for (const g of lista) {
      const nn = normName(g);
      if (!nn || varianti.has(nn)) continue;
      inQuestaLista.set(nn, (inQuestaLista.get(nn) ?? 0) + 1);
      if (!comeScritto.has(nn)) { comeScritto.set(nn, clean(g)); ordine.push(nn); }
    }
    // Il massimo, non la somma: le liste raccontano la stessa partita.
    for (const [nn, quante] of inQuestaLista) {
      if (quante > (occorrenze.get(nn) ?? 0)) occorrenze.set(nn, quante);
    }
  }

  const compagni: string[] = [];
  for (const nn of ordine) {
    const quante = occorrenze.get(nn) ?? 0;
    for (let i = 0; i < quante && compagni.length < max; i++) {
      compagni.push(comeScritto.get(nn) as string);
    }
  }
  return compagni;
}

/**
 * L'ELENCO DEI GIOCATORI NELL'ORDINE DELLA SCHEDA, socio compreso — serve a sapere CHI HA
 * ORGANIZZATO la partita (regola del committente: è il primo dell'elenco, perché l'ordine
 * della scheda è la cronologia degli ingressi).
 *
 * 🚨 Perché non basta `compagni`: quello è l'elenco MENO il socio, quindi la posizione del
 * socio è persa e non si può più sapere se il primo è lui.
 *
 * ⭐ Si guardano SOLO le liste che vengono dalla scheda del circolo (`descrizione`), che è
 * l'unica fonte ordinata: l'array `giocatori` e l'intestatario non portano un ordine
 * confrontabile. Fra più copie della stessa partita vince la PIÙ COMPLETA.
 *
 * 🚨 FAIL CLOSED sulla contraddizione: se due copie dello stesso slot cominciano con nomi
 * DIVERSI non si sceglie la più lunga — si torna `[]`, cioè «non lo so». Due copie possono
 * davvero contraddirsi (la sincronizzata e quella creata dall'app), e in quel caso qualunque
 * scelta nominerebbe una persona a caso come organizzatore davanti a tutti gli altri.
 */
export function rosterOrdinatoDelloSlot(schede: string[][]): string[] {
  const piene = schede.filter((l) => Array.isArray(l) && l.length > 0);
  if (piene.length === 0) return [];
  const primo = normName(piene[0][0]);
  for (const l of piene) {
    if (normName(l[0]) !== primo) return []; // due copie non concordi ⇒ non lo sappiamo
  }
  // Concordi sull'inizio: si tiene la più completa (le copie sono la stessa partita).
  return piene.reduce((a, b) => (b.length > a.length ? b : a));
}

/**
 * 🆕👀⭐⭐ VOCE 91 (24/08/2026) — CHI C'È IN CAMPO, anche quando l'ORDINE non si sa.
 *
 * 🗣️ Ragionamento del committente: *«se il bot mi ha detto che era stata prenotata sul nostro
 * gestionale, la prenotazione già c'è: è un fatto interno nostro, non serve passare da
 * Matchpoint»*. ⇒ Ha ragione, e il reperto lo conferma: la copia locale (`staff_booking`) porta
 * `giocatori` con i nomi per esteso. Il dato è in casa dall'istante zero.
 *
 * ⭐⭐ LA DISTINZIONE CHE SCIOGLIE IL NODO: **«chi c'è» e «in che ordine» sono due fatti
 * diversi.** La copia locale sa il primo e non il secondo — l'ordine dice chi ha organizzato, e
 * quello lo stabilisce la scheda del circolo. Fino a oggi i due fatti erano impastati in un
 * unico `giocatori: []`, che voleva dire tutt'e due le cose insieme: *«non so chi c'è»* e *«non
 * so in che ordine»*. Il socio ne pagava la peggiore — *«non riesco a leggere chi c'è in campo»*
 * su una partita che avevamo appena scritto noi.
 *
 * 🚨⭐⭐ E PERCHÉ È UN CAMPO NUOVO invece di riempire `giocatori`: quello ha un significato che
 * il bot USA per decidere chi ha organizzato — `organizzatoreDellaPartita` prende **il primo**
 * dell'elenco e non guarda `ordine`. Riempirlo qui incoronerebbe come organizzatore il primo
 * nome della copia locale, che per una prenotazione dal bot è il socio (per fortuna) ma per una
 * scritta dalla segreteria è **chi capita**. ⇒ *Un campo che qualcuno usa per decidere non si
 * riempie di un dato che dice un'altra cosa: se ne aggiunge uno.*
 * ⚖️ Ed è la stessa regola già scritta dalla voce 71 tre righe più giù: *«`giocatori` non cambia
 * forma né significato: `ordine` si AGGIUNGE»*. Qui si aggiunge `in_campo`.
 *
 * ⭐ Riusa `compagniDelloSlot` con l'insieme delle varianti VUOTO — cioè «i compagni, senza
 * togliere nessuno» = tutti. Non è un trucco: la fusione delle liste ha già dentro la trappola
 * risolta (il **massimo** e non la somma, o gli «Ospite» della stessa partita si conterebbero
 * due volte), e riscriverla qui sarebbe la seconda copia di una regola difficile.
 */
export function inCampoDelloSlot(liste: string[][], max: number): string[] {
  return compagniDelloSlot(liste, new Set<string>(), max);
}

/**
 * ⭐⭐ PERCHÉ L'ELENCO È VUOTO — e sono DUE cose diverse, non una (voce 71).
 *
 * 🗣️ Difetto misurato al secondo la notte del 21/08/2026: il committente prenota dal bot
 * (31/08, 11:00, campo 1), conferma, e il bot gli risponde *«Questa partita non l'hai
 * organizzata tu, quindi non posso invitare altri giocatori. Puoi chiederlo a chi l'ha
 * organizzata.»* — cioè lo manda **da sé stesso**.
 *
 * 🔎 LA CAUSA È UNA FINESTRA, NON UN ERRORE DI REGOLA. L'ordine dell'elenco si legge **solo**
 * dalla scheda del circolo (`descrizione`), e quella la scrive **Matchpoint**: una prenotazione
 * appena nata dal bot non ce l'ha ancora. 📏 Misurato sulla prenotazione vera: `staff_booking`
 * scritto alle **21:31:14** con `descrizione` vuota, `booking` tornato dal sync alle **21:32:47**
 * ⇒ **1′33″**, e il messaggio è caduto lì dentro. Riprovando quattro minuti dopo l'invito parte
 * senza storie.
 *
 * ⚖️ IL DIFETTO NON È IL CANCELLO, È LA FRASE. Il cancello ha ragione a non far invitare quando
 * non sa chi ha organizzato; sbaglia a dire **«non sei tu»** quando la verità è **«non lo so
 * ancora»**. Ma il bot quella differenza non poteva vederla: `giocatori: []` diceva tutti e due.
 * ⇒ *Un solo silenzio per due domande diverse costringe chi ascolta a indovinare, e chi indovina
 * sceglie sempre la risposta che ha in mano — qui, la peggiore.*
 *
 * ⭐ LA DISTINZIONE È STRUTTURALE, NON A TEMPO, ed è una scelta: si guarda **da dove arrivano le
 * righe** dello slot. Se ne esiste anche una sola venuta dal circolo, il circolo ha già parlato e
 * un ordine mancante è un ordine che davvero non sappiamo; se invece ci sono solo le copie che
 * abbiamo scritto noi (`staff_booking`), il circolo **non ha ancora parlato**.
 * ⛔ Scartata la strada del TEMPO — «se la prenotazione ha meno di N minuti allora è presto» —
 * perché sarebbe una soglia inventata: nessuno l'ha misurata, e il ritardo del sync ha già mostrato
 * una coda lunga (mediana ~2′, massimo misurato 10′04″). Il fatto strutturale è vero comunque.
 * 📌 E a chi volesse comunque invecchiare il messaggio, il dato c'è già: ogni slot porta
 * `aggiornato_al`. Non serve una seconda regola qui.
 *
 * ⚠️ Qui non si decide COSA DIRE al socio: si porta il **dato**. La frase la sceglie il bot — è
 * la divisione della regola ferrea del 19/08, *il gestionale SA, il bot DICE*.
 */
export type OrdineDelloSlot = {
  /** L'elenco nell'ordine della scheda, vuoto quando l'ordine non si sa. */
  giocatori: string[];
  /**
   * · `noto` — l'elenco c'è: il primo è chi ha organizzato.
   * · `non_ancora` — di questa partita esistono solo le nostre copie: il circolo non ha ancora
   *   raccontato la sua scheda, quindi l'ordine **arriverà**.
   * · `ignoto` — il circolo ha parlato e l'ordine non se ne ricava: nessuna lista (un titolo
   *   libero, «Torneo aziendale»), oppure due copie che **si contraddicono** sul primo nome.
   */
  ordine: 'noto' | 'non_ancora' | 'ignoto';
};

/**
 * L'elenco ordinato dello slot, più il PERCHÉ quando manca.
 *
 * @param schede            Le liste che vengono dalla scheda del circolo, una per riga.
 * @param soloCopieNostre   Vero se ogni riga di questo slot è una copia scritta da noi
 *                          (`staff_booking`) e nessuna viene dal sync.
 */
/**
 * Vero se questa riga è una copia scritta da NOI e non il racconto del circolo.
 *
 * 🚨⭐ IL VERSO DEL DUBBIO, e non è simmetrico: un tipo di record che non riconosciamo torna
 * **falso**, cioè «viene dal circolo». Così uno slot con dentro qualcosa di inatteso ricade in
 * `ignoto` — che è il comportamento di prima della voce 71 — invece di far promettere al bot
 * *«riprova fra un minuto»* per una scheda che non arriverà mai.
 * ⇒ *Sbagliando si torna al fastidio vecchio, non a una promessa che non si può mantenere.*
 */
export function copiaNostra(recordType: unknown): boolean {
  return clean(recordType) === 'staff_booking';
}

export function ordineDelloSlot(
  schede: string[][],
  soloCopieNostre: boolean,
): OrdineDelloSlot {
  const giocatori = rosterOrdinatoDelloSlot(schede);
  if (giocatori.length) return { giocatori, ordine: 'noto' };
  return { giocatori: [], ordine: soloCopieNostre ? 'non_ancora' : 'ignoto' };
}

// ROSTER AUTOREVOLE dei record `booking`: copia VERBATIM di playersFromDescrizione
// in matchpoint-bookings-sync/index.ts (unica regola, non una seconda). Estrae i
// nomi solo quando la descrizione è in formato lista "-Nome.-Nome." (inizia con
// '-'); i titoli liberi ("Torneo aziendale") non iniziano con '-' → [].
// Limite noto ed EREDITATO: uno split su '.' spezza i nomi che contengono un
// punto ("Alessandro Sir. Amato" → due voci). L'app mostra la stessa cosa: si
// preferisce restare identici al gestionale piuttosto che avere due parser.
export function playersFromDescrizione(descr: unknown): string[] {
  const text = clean(descr);
  if (!text.startsWith('-')) return [];
  return text
    .split('.')
    .map((s) => s.replace(/^-+/, '').trim())
    .filter(Boolean);
}

// Roster di una prenotazione: nomi (per il match e per i compagni) e codici
// socio a 6 cifre, quando ci sono. Misurato su PROD il 24/07 (finestra 60gg):
//  · booking      → `descrizione` sempre presente (144/144) ed è l'unica fonte
//                   del roster in 53 record su 144; `giocatori` è un array di
//                   STRINGHE quando c'è; `giocatore` è l'intestatario.
//  · staff_booking→ `giocatori` sempre presente (94/94), con OGGETTI
//                   {nome, codice?, codiceCliente?} in 86 record e stringhe in 20;
//                   nessuna `descrizione`. `nome` è la lista dei giocatori unita
//                   da virgole e TRONCATA: serve solo al match storico, mai come
//                   compagno (per questo esce da `joined`).
// Prima di questa versione gli oggetti passavano da clean() e diventavano
// "[object Object]": il roster c'era ma era illeggibile, e il socio non vedeva
// le proprie partite a 4 create dallo staff.
// ⭐ `names` (tutti i nomi in un elenco solo) serve al MATCH — «questa prenotazione è del
// socio?» — dove le ripetizioni non contano. `liste` tiene invece le fonti SEPARATE, una
// per elenco, e serve a CONTARE i giocatori: dentro la stessa riga la scheda del circolo e
// l'array `giocatori` dicono di norma la stessa cosa, e concatenarli conterebbe ogni ospite
// due volte → vedi `compagni-slot.ts`.
export function rosterFromPayload(recordType: string, p: JsonMap): {
  names: string[];
  liste: string[][];
  codes: string[];
  joined: string[];
  /**
   * L'elenco della SOLA scheda del circolo, nel suo ordine. Esce a parte perché è l'unica
   * fonte ORDINATA: dentro `liste` finisce mescolata alle altre e non si distingue più.
   * Serve a `rosterOrdinatoDelloSlot` → chi ha organizzato.
   */
  scheda: string[];
} {
  const names: string[] = [];
  const liste: string[][] = [];
  const codes: string[] = [];
  const joined: string[] = [];

  const daScheda = playersFromDescrizione(p.descrizione);
  if (daScheda.length) liste.push(daScheda);
  for (const n of daScheda) names.push(n);

  const daGiocatori: string[] = [];
  if (Array.isArray(p.giocatori)) {
    for (const g of p.giocatori as unknown[]) {
      if (g && typeof g === 'object') {
        const o = g as JsonMap;
        const nome = clean(o.nome);
        if (nome) { names.push(nome); daGiocatori.push(nome); }
        // `codice` e `codiceCliente` sono DUE numerazioni diverse e nessuna delle due è
        // garantita: su PROD (misura del 24/07) `codice` non è MAI il codice socio a 6 cifre
        // (0 elementi su 218) e in 2 casi vale "4", che con un `||` secco faceva da tappo e
        // oscurava il `codiceCliente` buono ("000004"). Si guardano ENTRAMBI e si tiene il
        // primo che sia davvero a 6 cifre.
        for (const c of [clean(o.codice), clean(o.codiceCliente)]) {
          if (/^[0-9]{6}$/.test(c)) { codes.push(c); break; }
        }
      } else {
        const nome = clean(g);
        if (nome) { names.push(nome); daGiocatori.push(nome); }
      }
    }
  }
  if (daGiocatori.length) liste.push(daGiocatori);

  // L'intestatario è UNA persona: lista a sé, così non gonfia il conteggio degli altri.
  if (p.giocatore) {
    const intestatario = clean(p.giocatore);
    if (intestatario) { names.push(intestatario); liste.push([intestatario]); }
  }
  // 🚨 `staff_booking.nome` resta FUORI dalle liste: è l'elenco dei giocatori unito da
  // virgole e troncato a metà parola, quindi non è una persona e non è un roster. Serve
  // solo come rete per il match (`joined`), mai per contare né per mostrare un compagno.
  if (recordType === 'staff_booking' && p.nome) joined.push(clean(p.nome));

  return {
    names: names.filter(Boolean),
    liste,
    codes,
    joined: joined.filter(Boolean),
    scheda: daScheda,
  };
}
