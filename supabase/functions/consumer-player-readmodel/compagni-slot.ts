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
  };
}
