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
// 🆕⭐⭐ 7/08/2026 — IL RECINTO NON RIFIUTA PIÙ: REGISTRA. Deciso da lui, con parole sue:
//        *«per fare una prova reale dobbiamo portare tutto in test»* e *«mi devi lasciare la
//        possibilità di prenotare una partita in test — logicamente dal bot»*.
//
// Fino a ieri, fuori dalla produzione, queste funzioni rispondevano `503 AMBIENTE_DI_PROVA`:
// avevano capito la richiesta e non la eseguivano. Difendeva bene il circolo, ma rendeva
// **impossibile provare davvero il bot**: si fermava tutto un passo prima del fatto.
//
// ⭐ E la sua premessa era GIUSTA, verificata nel codice: l'app di TEST prenota da mesi senza
// toccare Matchpoint — intercetta la propria chiamata, risponde da sé «accettato» e registra la
// partita nel gestionale di TEST (`index.html`, `PMO_BOOKINGS_SIMULATE`). Quello che mancava è
// che la stessa cosa la sapesse fare il **server**, perché il bot un browser non ce l'ha.
// ⇒ Da qui: fuori dalla produzione **il circolo non si chiama** (esattamente come prima) ma la
//   partita **si registra qui**, marcata, e il chiamante riceve un sì onesto: «fatto, di prova».
//
// 🚨 Cosa NON è cambiato, ed è il punto: **il worker non viene chiamato**. Il recinto non si è
//    aperto, ha cambiato verso — da «mi rifiuto» a «lo faccio qui». Chi un domani rimettesse la
//    chiamata al circolo dentro questo ramo farebbe rosso un caso costruito apposta.
// ⚖️ Il rifiuto RESTA, come ripiego: se la registrazione di prova non riesce, si risponde ancora
//    `503` invece di raccontare un successo che non c'è stato. Nel dubbio non si dice «fatto».
//
// 🚨⭐⭐ E VALE SOLO PER LE PRENOTAZIONI. Questo modulo vive in **sette** copie: le tre delle
//    prenotazioni (`bookings-create · edit · cancel`) e le quattro dell'ANAGRAFICA
//    (`clients-create · update · disable · reactivate`). Le quattro dell'anagrafica continuano a
//    **rifiutare** e basta, ed è voluto: una scheda cliente toccata per gioco resterebbe su
//    Matchpoint e **tornerebbe dentro PROD** con l'import del mattino — è l'unica cosa che lo
//    specchio notturno non ripulisce (era la ragione per cui il 6/08 sono entrate nel recinto).
//    ⇒ Le funzioni qui sotto (`esitoDiProva`, il marchio) esistono per tutti, ma **le usa solo
//      chi prenota**. Chi un domani volesse la stessa cosa per l'anagrafica deve prima risolvere
//      quel ritorno, non limitarsi a copiare il ramo.
// ═══════════════════════════════════════════════════════════════════════════════════════════
//
// ⚠️ QUESTO FILE VIVE IN SETTE COPIE IDENTICHE — le tre delle prenotazioni (`bookings-create` ·
// `edit` · `cancel`) e le quattro dell'anagrafica (`clients-create` · `update` · `disable` ·
// `reactivate`) — e non è una svista: i
// workflow di deploy scelgono le funzioni dalle **cartelle toccate** e saltano tutto ciò che
// inizia per `_`, quindi un modulo in `_shared/` **non si deployerebbe** — resterebbe la copia
// vecchia, in silenzio e col semaforo verde. Le SETTE copie sono tenute uguali **byte per byte** da
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
export const MESSAGGIO_PROVA_REGISTRATA =
  'Ambiente di prova: registrata qui, sul gestionale di prova. '
  + 'Il circolo non è stato chiamato e su Matchpoint non c\'è nulla.';

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
export const MARCHIO_NATA_IN_PROVA = 'nata_in_prova';

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
 * L'esito che si mette al posto di quello del worker quando si registra una prova.
 *
 * ⭐ Ha la **stessa forma** di quello vero (`idReserva`, che è il campo da cui tutto il resto
 * pende) perché il codice a valle non debba sapere di essere in prova: la differenza sta nel
 * **marchio**, non in una strada separata. Due strade diverse vorrebbero dire che quella di prova
 * non prova la strada vera.
 * 🚨 `idReserva` porta il prefisso `PROVA-`: chi lo legge in un registro capisce da sé che quella
 * riga non esiste su Matchpoint, senza dover risalire a chi l'ha scritta.
 */
export function esitoDiProva(azione: 'create' | 'edit' | 'cancel'): Record<string, unknown> {
  return {
    simulato: true,
    ambiente: 'prova',
    azione,
    idReserva: `PROVA-${crypto.randomUUID()}`,
    nota: MESSAGGIO_PROVA_REGISTRATA,
  };
}

/** Vero se questo esito viene da una prova e non dal circolo. Un posto solo per riconoscerlo. */
export function esitoVieneDaUnaProva(workerResult: unknown): boolean {
  return !!(workerResult && typeof workerResult === 'object'
    && (workerResult as Record<string, unknown>).simulato === true);
}
