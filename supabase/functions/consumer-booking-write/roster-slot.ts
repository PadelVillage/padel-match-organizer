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

// ══════════════════════════════════════════════════════════════════════════════════════════
// 🚨⭐⭐ CHI HA ORGANIZZATO, E IL DIRITTO DI ANNULLARE — decisione del committente 30/07/2026
//
// Fino al 30/07 si annullava dal bot SOLO da soli in campo (sua regola del 26/07: «nessuno
// toglie il campo agli altri tre, che il bot non ha modo di avvisare»). Quella regola è stata
// SOSTITUITA sapendo cosa cambia: **l'organizzatore può annullare anche con gli altri dentro,
// e avvisa lui gli altri**. Non è un ripensamento — la sua idea del 26/07 diceva già così
// («gli altri tre… possono cancellarsi come singoli, ma NON POSSONO ANNULLARLA» ⇒
// l'organizzatore sì): era la disdetta a essere stata disegnata prima che i ruoli esistessero.
// ⚖️ Il fatto che gli ha fatto scegliere: anche prima quella partita si annullava — chiamando
// la segreteria, che la annulla senza che noi avvisiamo nessuno. La regola vecchia non
// impediva l'annullamento, lo faceva PASSARE DA UNA PERSONA.
//
// 🚨⭐⭐ E IL DIRITTO SI CONTROLLA QUI, NON NEL BOT. Fin qui il ponte portava il DATO e
// lasciava la REGOLA al bot (l'elenco ordinato lo manda `consumer-player-readmodel`, la regola
// vive in `lib/ruoli.ts`): giusto per le PAROLE — un bot che sbaglia una frase dice una cosa
// storta — sbagliato per un PERMESSO, perché chi toglie il campo sul sistema del circolo è
// QUESTA funzione. Se il «no» stesse solo nel bot, un difetto del bot lo aggirerebbe.
// ⭐ E non diventa una terza copia della regola: l'ordine si legge dalla scheda del circolo con
// `playersFromDescrizione`, che in questo file c'è già ed è la stessa del sync.
//
// 📊 MISURA su PROD (30/07, sola lettura; criterio: `booking`+`staff_booking` **vive per il
// ponte**, `payload->>'data' >= 2026-07-30`, `tipo ~* 'partita'`, slot = data|ora|cifre del
// campo): **44 partite future**, di cui **12 con altri in campo** — cioè le sole in cui il
// diritto nuovo conta. Su quelle 12, l'organizzatore è determinabile **12 volte su 12**: zero
// copie discordi, zero «Ospite» primo, zero senza scheda ordinata.
// ⇒ Oggi il potere nuovo **copre tutte** le partite in cui serve. Le porte qui sotto non sono
// perciò inutili: sono la risposta onesta al giorno in cui una di quelle condizioni capiterà.
//
// 🚨🚨⭐⭐ LA PRIMA VERSIONE DI QUESTA MISURA ERA SBAGLIATA, e l'errore vale più del numero.
// Diceva «59 partite, 3 su 16 in segreteria per copie discordi». Il filtro era
// `payload->>'deleted'` — la chiave **dentro il payload** — mentre il ponte filtra
// `.not('deleted','is',true)`, cioè la **COLONNA**. Due cose diverse con lo stesso nome: la
// chiave nel payload è **sempre nulla**, quindi contavo anche le righe CANCELLATE.
// ⭐ E il caso che sembrava dimostrare il pericolo si è sciolto: nello slot 19:30 C3 la riga che
// comincia con **Anna Quaglio** (uscita dalla partita il 24/07) è `deleted = true` — il sync
// l'aveva già marcata, e il ponte non la vede. ⇒ La contraddizione fra copie, in produzione,
// **non è mai stata osservata**: era un artefatto della misura.
// 🚨 Il fail closed resta, e resta giusto — di fronte a due copie che si contraddicono non
// esiste una scelta onesta — ma va raccontato per quello che è: una difesa **preventiva**, non
// la cura di un male misurato. → [[metodo-il-caso-reale-non-discrimina]]

/** Una riga dello slot col suo tipo: il tipo è parte della regola dell'organizzatore. */
export type RigaSlotTipata = RigaSlot & { tipo?: string | null };

/**
 * L'ELENCO DEI GIOCATORI NELL'ORDINE DELLA SCHEDA — copia VERBATIM di
 * `rosterOrdinatoDelloSlot` in `consumer-player-readmodel/compagni-slot.ts`.
 *
 * 🚨 Copiata e non condivisa perché le cartelle `_shared/` NON vengono deployate dai workflow
 * (un `_` iniziale le fa saltare, e il deploy risulta verde senza aver caricato nulla): la
 * stessa scelta già fatta per `playersFromDescrizione`. Se si cambia una, si cambiano TUTTE E
 * DUE — il commento sta su entrambe apposta.
 *
 * ⭐ Solo le liste che vengono dalla scheda del circolo: è l'unica fonte ORDINATA (l'array
 * `giocatori` e l'intestatario non portano un ordine confrontabile, e le righe arrivano dal
 * database senza `order by`). Fra più copie della stessa partita vince la PIÙ COMPLETA.
 * 🚨 FAIL CLOSED sulla contraddizione: due copie che cominciano con nomi DIVERSI tornano `[]`,
 * cioè «non lo so». Scegliere la più lunga nominerebbe una persona a caso davanti alle altre.
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
 * Lo slot è una PARTITA? Il filtro sul tipo è **parte della regola**, non un extra: su PROD, in
 * 5 lezioni future su 34 il primo nome della scheda è il **MAESTRO** ⇒ applicata alla cieca, la
 * regola dell'organizzatore darebbe all'istruttore il diritto di annullare la lezione.
 *
 * 🚨 Scritta sui valori VERI, misurati su PROD il 30/07 sulle righe future: `Partita` (righe
 * sincronizzate dal circolo) · `partita` (copie in app) · `Lezione Libera` · `lezione` ·
 * `manutenzione`. Perciò si confronta senza distinzione di maiuscole, e **non** con `=== 'partita'`.
 * 🚨 FAIL CLOSED in tutt'e due i versi: serve almeno un tipo leggibile, e **ogni** tipo scritto
 * deve dire partita. Un tipo vuoto, sconosciuto o misto ⇒ nessun organizzatore.
 */
export function ePartitaLoSlot(righe: RigaSlotTipata[]): boolean {
  const tipi = righe.map((r) => clean(r.tipo)).filter(Boolean);
  if (!tipi.length) return false;
  return tipi.every((t) => /partita/i.test(t));
}

/**
 * CHI HA ORGANIZZATO questa partita, o `null` se non lo sappiamo dire.
 *
 * Regola del committente (29/07): «l'organizzatore è la prima persona in alto che appare in una
 * scheda», cioè il **primo giocatore ancora dentro** — l'ordine della scheda è la cronologia
 * degli ingressi (provato sui Movimenti del gestionale). ⭐ Perciò si CALCOLA a ogni lettura e
 * «se esce, il ruolo scala al successivo» viene gratis.
 *
 * 🚨 Gemella di `_pmoOrganizzatorePartita` (gestionale, `index.html`) e di
 * `organizzatoreDellaPartita` (bot, `lib/ruoli.ts`): **tre sedi, una regola**. Le tre porte sono
 * le stesse in tutti e tre i posti — solo le partite · «Ospite» non è una persona · primo nome
 * illeggibile ⇒ `null` e **non si scala al secondo** (il posto 0 è occupato da qualcuno che non
 * sappiamo nominare: dare il ruolo al successivo non è prudenza, è nominare la persona
 * SBAGLIATA).
 */
export function organizzatoreDelloSlot(righe: RigaSlotTipata[]): string | null {
  if (!ePartitaLoSlot(righe)) return null;
  const ordinato = rosterOrdinatoDelloSlot(righe.map((r) => playersFromDescrizione(r.descrizione)));
  const primo = clean(ordinato[0]);
  if (!primo) return null;
  if (normName(primo) === OSPITE) return null;
  return primo;
}

/** Il minimo che serve per dire se due schede sono della stessa persona o di due omonimi. */
export type SchedaPerOmonimia = {
  id: string;
  name?: string;
  firstName?: string;
  surname?: string;
  /** `'false'` = archiviata. Assente o qualunque altra cosa = viva. */
  active?: unknown;
};

/**
 * Le forme normalizzate con cui una scheda può comparire in un roster: il gestionale scrive
 * ora «Nome Cognome», ora «Cognome Nome».
 * ⭐ UNA definizione sola, usata sia dall'edge per la proprietà sia da `altriOmonimiVivi`:
 * se la guardia contasse gli omonimi con una regola più stretta del match, esisterebbe una
 * scheda che il match accetta come mia e che la guardia non conta — cioè un buco esattamente
 * dove serve la protezione.
 */
export function variantiDelNome(s: SchedaPerOmonimia): Set<string> {
  return new Set(
    [clean(s.name), `${clean(s.firstName)} ${clean(s.surname)}`, `${clean(s.surname)} ${clean(s.firstName)}`]
      .map(normName).filter(Boolean),
  );
}

/**
 * 👥 Fra i candidati c'è un'ALTRA persona viva col mio stesso nome?
 *
 * ⭐ Sta qui, pura, per la stessa ragione di `dirittoDiAnnullare`: è la conoscenza che decide
 * se un annullo passa, quindi si prova sui dati VERI di PROD senza rete e un sabotaggio si
 * misura. Chi chiama fa solo la lettura (un filtro grossolano sul cognome e sul nome intero);
 * la parola finale la dice `normName` — **la stessa** funzione con cui si fa il match.
 * Se il filtro decidesse con una regola sua, le due potrebbero divergere in silenzio.
 *
 * 🚨⭐⭐ Il confronto NON usa `variantiDelNome`: usa le stesse parole messe **in ordine
 * alfabetico**, cioè una chiave che ignora del tutto l'ordine. È di proposito **più larga** del
 * match, e il motivo sta tutto nel verso in cui costa sbagliare:
 *  · **troppo larga** → un annullo rifiutato a torto, e il socio passa dalla segreteria;
 *  · **troppo stretta** → la partita di un altro cancellata, e non si torna indietro.
 * ⚠️ Trovato da un caso storto, non previsto: confrontando le tre varianti, una scheda che ha
 * solo `name` (senza `firstName`/`surname`) non genera la forma invertita, e «Casagrande
 * Francesco» non risultava omonimo di «Francesco Casagrande» — un buco proprio dove serve la
 * protezione, perché quella scheda il match del diritto la accetterebbe.
 *
 * @returns gli `id` degli omonimi trovati (vuoto = nessuno). Un elenco, non un sì/no, così chi
 *   indaga vede CHI, e i log possono dirlo senza rifare il conto.
 */
/**
 * La chiave con cui due scritture dello stesso nome si riconoscono uguali: le stesse parole
 * messe in ORDINE ALFABETICO, cioè una chiave che ignora del tutto l'ordine.
 *
 * ⭐ Una definizione sola, usata dalla guardia degli omonimi in anagrafica
 * (`altriOmonimiVivi`) e da quella sul bersaglio (`bersaglioDaTogliere`). Se le due contassero
 * con regole diverse, esisterebbe un nome che una accetta e l'altra non conta — cioè un buco
 * esattamente dove serve la protezione. È la stessa ragione per cui `variantiDelNome` è una
 * sola: già scritta qui sotto, e già costata un caso storto.
 */
export function chiaveNome(value: unknown): string {
  return normName(value).split(' ').filter(Boolean).sort().join(' ');
}

function chiaveOmonimia(s: SchedaPerOmonimia): string {
  return chiaveNome(clean(s.name) || `${clean(s.firstName)} ${clean(s.surname)}`);
}

export function altriOmonimiVivi(
  io: SchedaPerOmonimia,
  candidati: SchedaPerOmonimia[],
): string[] {
  const mia = chiaveOmonimia(io);
  // Senza nome il match per nome non può riuscire: non c'è niente da proteggere.
  if (!mia) return [];
  const visti = new Set<string>();
  for (const c of candidati) {
    const id = clean(c.id);
    if (!id || id === clean(io.id)) continue;          // non sono un omonimo di me stesso
    if (clean(c.active) === 'false') continue;         // archiviata: quella persona non gioca
    if (chiaveOmonimia(c) !== mia) continue;
    visti.add(id);
  }
  return [...visti];
}

/**
 * 👤 CHI È la persona che si sta togliendo — la scheda, quando ce n'è **una sola** con quel nome.
 *
 * ⭐⭐ Nasce l'11/08/2026 da una sua domanda: *«con il nuovo sistema di registrazione possiamo
 * avvisare anche noi il giocatore che è stato eliminato»*. Il bot lo sapeva già fare, ma solo
 * con chi era entrato accettando un invito — perché quella riga è attaccata a QUELLA partita.
 * Per tutti gli altri serviva risalire dal nome alla persona, ed è il passo che la guardia
 * degli omonimi vieta: il nome non dice chi è una persona nel mondo.
 *
 * ⭐ La via d'uscita non è indovinare meglio, è **restringere la domanda**: non «chi è questo
 * nome» ma «quel nome è di UNA SOLA persona viva?». Quando la risposta è sì, il nome smette di
 * essere un indizio e diventa una chiave; quando è no, non si avvisa nessuno.
 *
 * 🚨 Fallisce chiusa in DUE modi, e sono diversi fra loro:
 *  · **zero** schede ⇒ quel nome al circolo non c'è (un Ospite, o una grafia che non combacia);
 *  · **due o più** ⇒ è uno dei 13 gruppi di omonimi, e mandare «non sei più nella partita» a
 *    quello sbagliato è un errore che non si recupera.
 * ⚖️ E qui il costo dell'errore è **asimmetrico al contrario** rispetto ad `altriOmonimiVivi`:
 * là un dubbio ferma un annullo (si perde un gesto), qui un dubbio toglie solo un avviso — la
 * partita resta tolta comunque, e l'organizzatore legge «avvisa tu». Perciò chi chiama, davanti
 * a una lettura che non riesce, **non deve rifiutare il togli**: deve solo non promettere.
 *
 * 🚨 Il confronto è `chiaveOmonimia`, la stessa di `altriOmonimiVivi` e deliberatamente più
 * larga del match: se «Casagrande Francesco» e «Francesco Casagrande» fossero due persone
 * diverse per questa funzione, l'avviso partirebbe **proprio nel caso** in cui non deve.
 *
 * @returns l'`id` della scheda, oppure `null` se le schede con quel nome non sono esattamente una.
 */
export function schedaUnicaConQuelNome(
  nome: unknown,
  candidati: SchedaPerOmonimia[],
): string | null {
  const cercata = chiaveNome(nome);
  if (!cercata) return null;
  const visti = new Set<string>();
  for (const c of candidati) {
    const id = clean(c.id);
    if (!id) continue;
    if (clean(c.active) === 'false') continue;         // archiviata: quella persona non gioca
    if (chiaveOmonimia(c) !== cercata) continue;
    visti.add(id);
  }
  return visti.size === 1 ? [...visti][0]! : null;
}

export type DirittoAnnullare = {
  /** Vero solo se questo socio può annullare una partita in cui c'è qualcun altro. */
  permesso: boolean;
  /** Chi ha organizzato, come lo scrive il gestionale. `null` = non lo sappiamo dire. */
  organizzatore: string | null;
  /**
   * Perché no, e sono TRE motivi diversi perché il bot deve dire tre cose diverse:
   *  · `non_sei_organizzatore` → c'è una strada: «puoi uscire dalla partita»;
   *  · `organizzatore_ignoto`  → non c'è: segreteria (mai un vicolo cieco).
   *  · `omonimi_al_circolo`    → il nome combacia ma non prova NIENTE: segreteria.
   * Distinguerli qui evita che il bot debba indovinare dal silenzio.
   */
  motivo: 'non_sei_organizzatore' | 'organizzatore_ignoto' | 'omonimi_al_circolo' | null;
};

/**
 * IL DIRITTO: questo socio può annullare la partita, con altri in campo?
 *
 * ⭐ È una funzione a sé — e non due righe dentro l'edge — perché è la riga che decide se un
 * campo sparisce a tre persone: così si prova sui payload VERI di PROD senza rete, e un
 * sabotaggio si misura. L'edge chiama QUESTA (un test lo sorveglia): una regola provata in un
 * posto e riscritta a mano in un altro è la strada per cui i test restano verdi mentre il
 * comportamento cambia.
 *
 * @param varianti le forme normalizzate del nome del socio (il gestionale scrive ora «Nome
 *   Cognome», ora «Cognome Nome») — le stesse che l'edge usa per la proprietà.
 * @param omonimiAlCircolo vero se in anagrafica esiste **un'altra persona viva** con lo stesso
 *   nome normalizzato. Lo sa solo chi ha letto l'anagrafica, quindi arriva da fuori.
 *
 * 🚨⭐⭐ IL LIMITE CHE QUESTA FUNZIONE DICHIARAVA È DIVENTATO UNA GUARDIA (3/08/2026).
 * Qui c'era scritto che «due soci omonimi non si distinguono» e che «un omonimo
 * dell'organizzatore potrebbe annullare». Era vero, ed è stato misurato su PROD: **13 gruppi**
 * di omonimi vivi (27 persone, telefoni diversi ⇒ persone vere, non doppioni), citati **38
 * volte** nelle prenotazioni fra gennaio e luglio 2026.
 * ⭐⭐ E la cura «ovvia» — *il codice nel roster smentisce il nome* — **misurerebbe ZERO**:
 * gli omonimi compaiono nella `descrizione` (testo libero della scheda del circolo) e come
 * intestatario, cioè dove un codice non c'è **per costruzione**. Misura del 3/08: su 307
 * voci-giocatore a oggetto, quelle di un omonimo sono **2**, e con codice accanto **0**.
 * ⇒ Col dato di oggi **nessun automatismo può sapere quale dei due sia**. L'unica cosa onesta
 * non è indovinare meglio: è **non decidere**, e dirlo. Vale solo per l'annullo — il gesto
 * irreversibile, che toglie il campo a qualcun altro.
 */
export function dirittoDiAnnullare(
  righe: RigaSlotTipata[],
  varianti: Set<string>,
  omonimiAlCircolo: boolean,
): DirittoAnnullare {
  const organizzatore = organizzatoreDelloSlot(righe);
  if (!organizzatore) return { permesso: false, organizzatore: null, motivo: 'organizzatore_ignoto' };
  if (!varianti.has(normName(organizzatore))) {
    return { permesso: false, organizzatore, motivo: 'non_sei_organizzatore' };
  }
  // Il nome combacia — ma se quel nome al circolo è di più persone, «combacia» non prova nulla.
  // 🚨 Il controllo sta DOPO `non_sei_organizzatore` di proposito: quando l'organizzatore è un
  // altro, il motivo giusto resta quello, che è vero comunque e offre una strada (uscire).
  if (omonimiAlCircolo) {
    return { permesso: false, organizzatore, motivo: 'omonimi_al_circolo' };
  }
  return { permesso: true, organizzatore, motivo: null };
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// ✏️ TOGLIERE UN GIOCATORE — il terzo potere dell'organizzatore (decisione del committente
// del 30/07/2026: «può togliere chiunque», confermata il 4/08 quando ha annullato i «poteri
// all'Ospite» e ridotto la voce a questa sola cosa).
//
// 🚨⭐⭐ IL DIRITTO È LO STESSO DELL'ANNULLO, e non se ne scrive un secondo. Chi può far
// sparire il campo a tutti e tre può a maggior ragione togliere una persona sola: l'edge
// chiama `dirittoDiAnnullare` anche qui. Due regole gemelle che decidono la stessa cosa
// divergono — è già successo fra bot e gestionale il 30/07, dove nel bot restava scritto il
// contrario di quello che il gestionale mostrava.
// ⇒ Quello che questo modulo aggiunge non è un permesso: è la guardia sul BERSAGLIO, cioè
// sulla persona che sparisce dal campo. Il diritto dice «puoi»; questa dice «puoi TOGLIERE
// PROPRIO QUESTO», e sono due domande diverse.
//
// 📊 MISURA su PROD (4/08/2026, sola lettura; criterio: `booking`+`staff_booking`, colonna
// `deleted` non vera, `payload->>'data' >= oggi`, `tipo ~* 'partita'`, slot = data|ora|cifre
// del campo): **48 partite future**, tutte con una scheda leggibile, **0** copie discordi,
// **0** con l'Ospite primo ⇒ organizzatore determinabile **48 su 48**. Di quelle, **19**
// hanno qualcuno da togliere, per un totale di **52 giocatori togliibili**.
// ⇒ ⭐⭐ E il numero che conta per il disegno: di quei 52, gli **Ospite sono 6** e le
// **persone vere 46** (35 distinte). Togliere un giocatore non è quasi mai togliere un
// segnaposto: è togliere qualcuno che si è segnato quel giorno.
//
// 🚨⭐⭐ LA TRAPPOLA DEL WORKER, verificata nel codice (`server.mjs`, ramo rimozioni) e non
// dedotta: le due strade NON hanno la stessa forma.
//   · l'**Ospite** si toglie a CONTEGGIO (`guestWantedInitial`): chiederne uno ne toglie
//     esattamente **uno**, anche se in campo ce ne sono tre. Va bene così — un Ospite non è
//     una persona, è un posto occupato, e quale dei tre sparisca non vuol dire niente.
//   · una **persona** si toglie per NOME (`removeNames.includes(nomeVal)`), e il ciclo
//     ri-scandisce la ficha finché un nome combacia ⇒ **due omonimi nella stessa partita
//     sparirebbero TUTT'E DUE**, con un solo tocco e senza che nessuno l'abbia chiesto.
// ⇒ Da qui la guardia `omonimi_in_partita`, che è la stessa forma già scelta il 3/08 per
// l'annullo: **quando il dato non può decidere, non si decide e lo si dice**. Rimettere una
// persona nella scheda il bot non lo sa fare (`prenota` accetta solo data, ora e campo):
// l'errore qui non si annulla con un tocco, si ripara chiamando la segreteria.

export type BersaglioDaTogliere =
  | {
    ok: true;
    /** Il nome **come lo scrive il gestionale**, che è l'unico che il worker riconosce. */
    nome: string;
    /** Vero se è un posto da Ospite: si toglie a conteggio, e non c'è nessuno da avvisare. */
    ospite: boolean;
  }
  | {
    ok: false;
    /**
     * Perché no, e sono tre motivi distinti perché mandano il socio a fare tre cose diverse:
     *  · `non_in_partita`     → la partita è cambiata fra il disegno del bottone e il tocco;
     *                           «riapri l'elenco», che non è un guasto e non è un no;
     *  · `e_l_organizzatore`  → per uscire lui c'è `leave`, cioè il bottone «Esci»;
     *  · `omonimi_in_partita` → il nome non basta a dire QUALE dei due: segreteria.
     */
    motivo: 'non_in_partita' | 'e_l_organizzatore' | 'omonimi_in_partita';
  };

/**
 * CHI si toglie da questa partita — la guardia sul bersaglio.
 *
 * ⭐ Funzione pura e a sé, per la stessa ragione di `dirittoDiAnnullare`: è la riga che decide
 * quale persona sparisce dal campo, quindi si prova sui roster VERI senza rete e un sabotaggio
 * si misura. L'edge chiama QUESTA (un test lo sorveglia): una regola provata in un posto e
 * riscritta a mano in un altro è la strada per cui i test restano verdi mentre il
 * comportamento cambia.
 *
 * @param roster i giocatori dello slot **con le ripetizioni**, come li dà `rosterDelloSlot`.
 * @param organizzatore chi ha organizzato, già deciso da `organizzatoreDelloSlot`.
 * @param chiesto il nome che arriva da fuori, cioè dal bottone toccato dal socio.
 *
 * 🚨 Il nome che torna è quello del ROSTER, non quello arrivato nella richiesta. Il gestionale
 * scrive ora «Nome Cognome» ora «Cognome Nome», e il worker toglie confrontando la stringa
 * esatta della ficha: rimandare indietro ciò che è arrivato farebbe fallire la rimozione — o,
 * peggio, la farebbe riuscire su una riga che non è quella mostrata al socio.
 *
 * 🚨 L'ORDINE dei controlli è parte della regola. Gli omonimi si guardano **prima** di
 * «sei tu l'organizzatore»: se in campo ci fossero due persone che si chiamano come lui, il
 * rifiuto giusto è «non so quale dei due» — e non «per uscire usa il bottone Esci», che
 * manderebbe a fare una cosa diversa da quella chiesta.
 */
export function bersaglioDaTogliere(
  roster: string[],
  organizzatore: string,
  chiesto: string,
): BersaglioDaTogliere {
  // 🚨⭐⭐ Il confronto NON è la stringa normalizzata, è `chiaveNome` — le stesse parole in
  // ordine alfabetico — e questa è una decisione, non una comodità. I due elenchi in gioco
  // possono scrivere la stessa persona in versi diversi: il bot legge i nomi dal readmodel,
  // che li prende SOLO dalla scheda del circolo, mentre qui `rosterDelloSlot` può aver scelto
  // la NOSTRA copia (è la fonte preferita quando non sfora). «Manuel Casagrande» di là e
  // «Casagrande Manuel» di qua sono la stessa persona, e un confronto esatto direbbe «non è in
  // partita» a chi è in campo — mandando in segreteria per un problema che non esiste.
  // ⚖️ Il verso in cui costa sbagliare, misurato sul gesto e non sul codice:
  //  · **troppo largo** → si toglierebbe la persona sbagliata solo se in campo ci fossero due
  //    nomi che collassano sulla stessa chiave — ed è esattamente `omonimi_in_partita`, che
  //    conta con QUESTA chiave e quindi si accorge di loro prima di decidere;
  //  · **troppo stretto** → un rifiuto a chi aveva diritto, ogni volta che le due copie
  //    scrivono il nome al contrario.
  // 🚨 Match e conteggio usano la STESSA chiave apposta: se il conteggio fosse più stretto
  // esisterebbe un nome che il match accetta e che la guardia non conta — un buco proprio
  // dove serve la protezione. È il caso storto già pagato su `altriOmonimiVivi`.
  const cercato = chiaveNome(chiesto);
  // Fail closed: da fuori può arrivare qualunque cosa, e «vuoto» non è una persona.
  if (!cercato) return { ok: false, motivo: 'non_in_partita' };

  const quante = roster.filter((n) => chiaveNome(n) === cercato).length;
  if (quante === 0) return { ok: false, motivo: 'non_in_partita' };

  // Due volte lo stesso nome: l'Ospite può (è un ruolo, non una persona, e il worker lo toglie
  // a CONTEGGIO), una persona no — il worker toglierebbe per nome, cioè tutt'e due.
  if (quante > 1 && cercato !== OSPITE) return { ok: false, motivo: 'omonimi_in_partita' };

  // 🚨 Dopo gli omonimi, mai prima: se in campo ci fossero due persone che si chiamano come
  // l'organizzatore, il rifiuto giusto è «non so quale dei due», non «per uscire usa Esci».
  if (chiaveNome(organizzatore) === cercato) return { ok: false, motivo: 'e_l_organizzatore' };

  const nome = roster.find((n) => chiaveNome(n) === cercato) as string;
  return { ok: true, nome: clean(nome), ospite: cercato === OSPITE };
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
