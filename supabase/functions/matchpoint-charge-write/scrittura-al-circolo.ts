// scrittura-al-circolo.ts — «questa funzione può davvero scrivere sul gestionale del circolo?»
//
// 🚨⭐⭐ IL FATTO CHE LA RENDE NECESSARIA, misurato e non dedotto: il worker che parla con
// Matchpoint è **UNO SOLO** ed è **condiviso da TEST e PROD** (le credenziali hanno la stessa
// impronta sui due progetti Supabase, misura del 25/07/2026). Quindi «provo su TEST» non è mai
// stata una prova: una prenotazione fatta di là occupa un campo **VERO**.
//
// L'app si difendeva da sé (`PMO_BOOKINGS_SIMULATE`, un intercettatore **dentro il browser**), ma
// chi chiama queste edge **da fuori** — il bot dei soci — quel riparo non l'ha mai avuto: il bot
// non ha un browser. Finora l'unica difesa erano cinque righe **dentro il bot**.
// ⇒ Il riparo sta QUI, nel punto in cui la penna tocca la carta: **se non sono la produzione, al
//   worker non ci parlo** — e vale per chiunque chiami, non solo per il bot.
//
// ⭐ IL VERSO DEL DUBBIO è quello che il progetto usa già nell'app e nel bot (`lib/scrittura.ts`):
// si scrive sul circolo SOLO se l'indirizzo è **certamente** quello di produzione. Indirizzo di
// TEST, vuoto, sconosciuto, storpiato ⇒ il circolo non si tocca. Un errore di configurazione può
// **fermare** una prenotazione, e si vede subito; non può **occuparne** una per sbaglio.
// 🚨 Conseguenza dichiarata, non nascosta: se un domani cambiasse il dominio delle funzioni,
// PROD smetterebbe di scrivere e lo direbbe ad alta voce. È il verso giusto in cui rompersi.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🆕⭐⭐ 7/08/2026 — IL RECINTO NON RIFIUTA PIÙ: REGISTRA. Deciso da lui («mi devi lasciare la
//        possibilità di prenotare una partita in test — logicamente dal bot»). Fuori dalla
//        produzione il circolo non si chiamava e la partita si registrava qui, marcata di prova,
//        e il chiamante riceveva un sì onesto: «fatto, di prova».
//
// 🔄⭐⭐ 08/09/2026 — E ADESSO QUELLA REGISTRAZIONE NON È PIÙ «DI PROVA»: È NATIVA.
// 🗣️ Parole sue: *«le scritture sono simulate verso Matchpoint, ma devono essere proprio chiuse,
// non simulate, così siamo tranquilli che in futuro non ci sia dialogo fra Matchpoint e gestionale
// di test»*; e messo davanti alle due strade — rifiutare tutto, oppure rendere la prenotazione
// **vera del gestionale nuovo** — ha scelto la seconda.
// ⇒ Cambia il SIGNIFICATO, non il meccanismo: la riga che prima era la **finta** di una
//   prenotazione che «sarebbe» andata sul circolo, adesso è una prenotazione **nostra**. Niente
//   `simulato: true`, niente `ambiente: 'prova'`, niente `PROVA-` davanti all'identificativo:
//   `nativa: true`, `origine: 'gestionale'`, e un `PMO-…` che dice **di chi è**.
// 📌 *Una simulazione dichiara che esiste una strada vera altrove. Una scrittura nativa dice che
//   la strada vera è questa.* Il giorno in cui Matchpoint si spegne, qui non si tocca niente — ed
//   è esattamente la prova che il verso è giusto.
//
// 🚨 Cosa NON è cambiato, ed è il punto: **il worker non viene chiamato**. Il recinto non si è
//    aperto, ha cambiato verso — da «mi rifiuto» a «lo faccio qui, ed è mio». Chi un domani
//    rimettesse la chiamata al circolo dentro questo ramo farebbe rosso un caso costruito apposta.
// ⚖️ Il rifiuto RESTA, come ripiego: se la scrittura nativa non riesce, si risponde ancora
//    `503` invece di raccontare un successo che non c'è stato. Nel dubbio non si dice «fatto».
// ⛔ E vale **solo su TEST**, cioè sul gestionale che sta diventando il vero: su `main` questo
//    modulo è quello che RIFIUTA e basta, e i due rami qui divergono di proposito.
//
// 🚨⭐⭐ E VALE SOLO PER LE PRENOTAZIONI. Questo modulo vive in **otto** copie: le tre delle
//    prenotazioni (`bookings-create · edit · cancel`), le quattro dell'ANAGRAFICA
//    (`clients-create · update · disable · reactivate`) e quella del BORSELLINO
//    (`matchpoint-wallet-correct`). Le altre cinque continuano a
//    **rifiutare** e basta, ed è voluto: una scheda cliente toccata per gioco resterebbe su
//    Matchpoint e **tornerebbe dentro PROD** con l'import del mattino — è l'unica cosa che lo
//    specchio notturno non ripulisce (era la ragione per cui il 6/08 sono entrate nel recinto).
//    ⇒ Le funzioni qui sotto (`esitoDiProva`, il marchio) esistono per tutti, ma **le usa solo
//      chi prenota**. Chi un domani volesse la stessa cosa per l'anagrafica deve prima risolvere
//      quel ritorno, non limitarsi a copiare il ramo.
//
// 🆕💰⭐⭐ 9/08/2026 — L'OTTAVA COPIA: IL BORSELLINO (`matchpoint-wallet-correct`). Deciso da lui,
//    ed era l'ultima funzione di scrittura rimasta fuori dal recinto: le correzioni del
//    borsellino (storno e ricarica, `/correct-wallet`) toccavano il gestionale del circolo **da
//    qualunque ambiente**. Il 6/08 era stata lasciata fuori di proposito — quella notte l'ambito
//    erano prenotazioni e anagrafica, e **sui soldi decide lui**.
// ⚖️ **RIFIUTA, non registra**, e la ragione non è la pigrizia della copia: il borsellino è
//    denaro, e in questo progetto **Matchpoint è il libro mastro UNICO** — l'app è cassa e
//    vetrina, mai un secondo libro. «Registrare qui una correzione di prova» vorrebbe dire
//    inventare quel secondo libro proprio dove è vietato averlo. Fuori dalla produzione il
//    borsellino non si tocca e lo si dice: `503 AMBIENTE_DI_PROVA`.
// ═══════════════════════════════════════════════════════════════════════════════════════════
//
// ⚠️ QUESTO FILE VIVE IN OTTO COPIE IDENTICHE — le tre delle prenotazioni (`bookings-create` ·
// `edit` · `cancel`), le quattro dell'anagrafica (`clients-create` · `update` · `disable` ·
// `reactivate`) e quella del borsellino (`matchpoint-wallet-correct`) — e non è una svista: i
// workflow di deploy scelgono le funzioni dalle **cartelle toccate** e saltano tutto ciò che
// inizia per `_`, quindi un modulo in `_shared/` **non si deployerebbe** — resterebbe la copia
// vecchia, in silenzio e col semaforo verde. Le OTTO copie sono tenute uguali **byte per byte** da
// `scrittura-al-circolo.test.ts`, che le rilegge dal disco.

/** Il progetto Supabase di PRODUZIONE: l'unico da cui si scrive sul gestionale del circolo. */
export const REF_PROD = 'qqbfphyslczzkxoncgex';

/** Il codice del rifiuto. Sta qui perché chi legge la risposta lo riconosca senza indovinarlo. */
export const CODICE_AMBIENTE_DI_PROVA = 'AMBIENTE_DI_PROVA';

/**
 * Cosa si risponde quando **nemmeno la registrazione di prova** è riuscita.
 * ⚖️ È il ripiego, non più la strada normale: fuori dalla produzione si registra (vedi sotto), e
 * si arriva qui solo se quella registrazione è fallita. Meglio un rifiuto che un falso sì.
 */
export const MESSAGGIO_AMBIENTE_DI_PROVA =
  'Ambiente di prova: da qui non si scrive sul gestionale del circolo. '
  + 'La richiesta è arrivata intera ed è stata capita, ma il gestionale non è stato toccato.';

/** Cosa si risponde quando la prova è stata registrata qui. Dice **dove** è finita, non «ok». */
export const MESSAGGIO_SCRITTURA_NATIVA =
  'Scritta nel gestionale. Questa partita nasce qui: il circolo esterno non è stato chiamato.';

/**
 * Il marchio che una riga nata da una prova si porta dietro, dentro il `payload`.
 *
 * 🚨⭐⭐ SERVE A SOPRAVVIVERE AL GIRO DI SINCRONIZZAZIONE, e senza di lui tutto il resto è
 * inutile: `matchpoint-bookings-sync` **cancella** (tombstone) le righe `staff_booking` che non
 * trovano riscontro nell'occupazione letta da Matchpoint. Una partita di prova su Matchpoint non
 * c'è **per costruzione** ⇒ verrebbe marcata sparita al primo giro utile, e la beffa è che è
 * proprio **aprire l'app di TEST per guardarla** a far partire quel giro.
 * ⇒ Il reconcile salta le righe che portano questo marchio. Chi lo togliesse di qui vedrebbe le
 *   partite di prova sparire da sole dopo qualche minuto, senza un errore da nessuna parte.
 */
export const MARCHIO_NATA_NEL_GESTIONALE = 'nata_nel_gestionale';

/**
 * Il marchio VECCHIO, che alcune righe scritte prima del 08/09/2026 si portano ancora dietro.
 * ⛔ Non si scrive più: si **riconosce**. 📏 All'08/09 ce n'è ancora **una** riga viva su `cudi`,
 * e togliere questa costante la farebbe tombare al primo giro di riconciliazione — un dato vero
 * cancellato da una pulizia di nomi. 📌 *Un nome si può cambiare in avanti; i dati già scritti
 * col nome vecchio restano, e vanno letti.*
 */
export const MARCHIO_VECCHIO_NATA_IN_PROVA = 'nata_in_prova';

/**
 * Vero **solo** se questa funzione sta girando nel progetto di produzione.
 *
 * ⚖️ Si guarda il **nome dell'host**, non la stringa: `…supabase.co.qualcunaltro.it` **contiene**
 * il codice del progetto di produzione e non è la produzione. Un `includes` sarebbe passato, ed è
 * il modo tipico in cui una guardia resta verde senza difendere niente.
 * ⭐ L'unica tolleranza è un sottodominio **dello stesso progetto** (`<ref>.qualcosa.supabase.co`).
 */
export function scritturaAlCircoloConsentita(supabaseUrl: unknown): boolean {
  let host: string;
  try {
    host = new URL(String(supabaseUrl ?? '').trim()).hostname.toLowerCase();
  } catch {
    return false; // vuoto, non è un indirizzo, refuso ⇒ non è la produzione
  }
  if (host === `${REF_PROD}.supabase.co`) return true;
  return host.startsWith(`${REF_PROD}.`) && host.endsWith('.supabase.co');
}

/**
 * L'esito di una scrittura **NATIVA**: la partita nasce nel gestionale, e basta.
 *
 * 🔄⭐⭐ FINO ALL'08/09/2026 QUESTA FUNZIONE SI CHIAMAVA `esitoDiProva` E MENTIVA PER MESTIERE:
 * rispondeva `simulato: true`, `ambiente: 'prova'`, e un `idReserva` col prefisso `PROVA-`.
 * 🗣️ Il committente l'ha tolta di mezzo con parole sue: *«le scritture devono essere proprio
 * chiuse, non simulate, così siamo tranquilli che in futuro non ci sia dialogo fra Matchpoint e
 * gestionale di test»*, e messo davanti alle due strade ha scelto **native**.
 * ⇒ La differenza non è di parole: prima questa riga era la **finta** di una prenotazione che
 * «sarebbe» andata sul circolo; adesso è una prenotazione **vera del gestionale nuovo**, che il
 * circolo esterno non lo riguarda. Il giorno del distacco non cambia niente qui — ed è la prova
 * che il verso è quello giusto.
 *
 * ⭐ Ha la **stessa forma** dell'esito del worker (`idReserva`, il campo da cui pende tutto il
 * resto) perché il codice a valle non debba sapere da dove viene: la differenza sta nel
 * **marchio**, non in una strada separata. Due strade diverse vorrebbero dire che questa non
 * esercita quella vera.
 * 🚨 `idReserva` porta il prefisso `PMO-`: dice **di chi è** quella prenotazione — nostra — invece
 * di dire che è finta.
 */
export function esitoNativo(azione: 'create' | 'edit' | 'cancel'): Record<string, unknown> {
  return {
    nativa: true,
    origine: 'gestionale',
    azione,
    idReserva: `PMO-${crypto.randomUUID()}`,
    nota: MESSAGGIO_SCRITTURA_NATIVA,
  };
}

/**
 * Vero se questo esito è nato nel gestionale invece che tornare dal circolo esterno.
 * ⚖️ Riconosce **anche** il vecchio `simulato: true`: un lavoro partito prima del cambio e atterrato
 * dopo non deve essere scambiato per un esito del circolo — sarebbe l'unico caso in cui questa
 * pulizia potrebbe fare danno, e costa una riga evitarlo.
 */
export function esitoNatoNelGestionale(workerResult: unknown): boolean {
  if (!workerResult || typeof workerResult !== 'object') return false;
  const o = workerResult as Record<string, unknown>;
  return o.nativa === true || o.simulato === true;
}
