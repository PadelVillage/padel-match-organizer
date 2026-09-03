// scrittura-al-circolo.ts — «questa funzione può davvero scrivere sul gestionale del circolo?»
//
// 🚨⭐⭐ IL FATTO CHE LA RENDE NECESSARIA, misurato e non dedotto: il worker che parla con
// Matchpoint è **UNO SOLO** ed è **condiviso da TEST e PROD** (le credenziali hanno la stessa
// impronta sui due progetti Supabase, misura del 25/07/2026). Quindi «provo su TEST» non è mai
// stata una prova: una prenotazione fatta di là occupa un campo **VERO**, per giunta decisa su
// dati vecchi — l'archivio prenotazioni di TEST è fermo per costruzione.
//
// L'app si difendeva da sé (`PMO_BOOKINGS_SIMULATE`, un intercettatore **dentro il browser**), ma
// chi chiama queste edge **da fuori** — il bot dei soci — quel riparo non l'ha mai avuto: il bot
// non ha un browser. Finora l'unica difesa erano cinque righe **dentro il bot**.
// ⇒ Il riparo si sposta QUI, nel punto in cui la penna tocca la carta: **se non sono la
//   produzione, al worker non ci parlo** — e vale per chiunque chiami, non solo per il bot.
//
// ⭐ IL VERSO DEL DUBBIO è quello che il progetto usa già nell'app e nel bot (`lib/scrittura.ts`):
// si scrive SOLO se l'indirizzo è **certamente** quello di produzione. Indirizzo di TEST, vuoto,
// sconosciuto, storpiato ⇒ rifiuto. Un errore di configurazione può **fermare** una prenotazione,
// e si vede subito perché la risposta lo dice; non può **occuparne** una per sbaglio.
// 🚨 Conseguenza dichiarata, non nascosta: se un domani cambiasse il dominio delle funzioni,
// PROD smetterebbe di scrivere e lo direbbe ad alta voce. È il verso giusto in cui rompersi.
//
// 🆕💰⭐⭐ 9/08/2026 — L'OTTAVA COPIA: IL BORSELLINO (`matchpoint-wallet-correct`). Deciso da lui,
// ed era l'ultima funzione di scrittura rimasta fuori dal recinto: le correzioni del borsellino
// (storno e ricarica, worker `/correct-wallet`) toccavano il gestionale del circolo **da qualunque
// ambiente**. Il 6/08 era stata lasciata fuori di proposito — quella notte l'ambito erano
// prenotazioni e anagrafica, e **sui soldi decide lui**.
// 🚨 E non era teorica: il borsellino era l'unico gesto dell'app di TEST che arrivava fino al
// denaro **vero**. I pagamenti, in TEST, hanno un ramo di simulazione che il circolo non lo
// chiama mai; il borsellino non ce l'ha **mai avuto**, e il suo interruttore
// (`PMO_WALLET_WRITE_ENABLED`) è acceso su tutti e due i rami dell'app.
//
// ⚠️ QUESTO FILE VIVE IN OTTO COPIE IDENTICHE — le tre delle prenotazioni (`bookings-create` ·
// `edit` · `cancel`), le quattro dell'anagrafica (`clients-create` · `update` · `disable` ·
// `reactivate`) e quella del borsellino (`matchpoint-wallet-correct`) — e non è una svista: i
// workflow di deploy scelgono le funzioni dalle **cartelle toccate** e saltano tutto ciò che
// inizia per `_`, quindi un modulo in `_shared/` **non si deployerebbe** — resterebbe la copia
// vecchia, in silenzio e col semaforo verde. Le OTTO copie sono tenute uguali **byte per byte** da
// `scrittura-al-circolo.test.ts`, che le rilegge dal disco.
// 📏 Il numero qui sopra è già stato sbagliato: fino a oggi diceva «tre» mentre erano **sette**
// dal 6/08. Chi ne aggiunge una aggiorni la frase — il banco conta le copie da sé, il commento no.

/** Il progetto Supabase di PRODUZIONE: l'unico da cui si scrive sul gestionale del circolo. */
export const REF_PROD = 'qqbfphyslczzkxoncgex';

/** Il codice del rifiuto. Sta qui perché chi legge la risposta lo riconosca senza indovinarlo. */
export const CODICE_AMBIENTE_DI_PROVA = 'AMBIENTE_DI_PROVA';

/** Cosa si risponde a chi ha chiesto una scrittura da un ambiente che non è la produzione. */
export const MESSAGGIO_AMBIENTE_DI_PROVA =
  'Ambiente di prova: da qui non si scrive sul gestionale del circolo. '
  + 'La richiesta è arrivata intera ed è stata capita, ma il gestionale non è stato toccato.';

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
