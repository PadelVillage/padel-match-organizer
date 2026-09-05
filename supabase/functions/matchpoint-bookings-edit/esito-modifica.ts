// esito-modifica.ts — IL TERZO ESITO ANCHE SULLE MODIFICHE (voce 118, 05/09/2026).
//
// 📏 IL DIFETTO, misurato sui due fallimenti del 01/09 e sul «Fabiola Limuti: non ci sono
// riuscito» del 29/08: il worker moriva con `locator.click: Timeout 8000ms` e questa edge lo
// traduceva in `WORKER_ERROR`, che a valle (`consumer-booking-write`, poi il bot) vuol dire
// **«non è passata»**. Ma un timeout su un click non dice se il click sia arrivato: il postback
// di Matchpoint può essere partito lo stesso. Quelle due volte il rifiuto era vero **per
// fortuna**, non perché il gestionale lo sapesse — e il giorno in cui passa mentre il bot dice
// di no, la persona resta fuori dal campo credendosi dentro (voce 118, la forma della 72).
//
// ⚖️ LA REGOLA È QUELLA DELLA SORELLA `create` (`esito-prenotazione.js`, voce 72), e non si
// inventa una seconda volta: si elencano i fallimenti **CERTI** — quelli che il worker lancia
// PRIMA di toccare la scheda della prenotazione — e **tutto il resto cade nell'ignoto**, codici
// futuri compresi. Fallisce chiusa: *un «non lo so» di troppo costa un'attesa, un «non è
// passata» falso costa un socio fuori dal campo senza saperlo.*
//
// 🚨⭐⭐ E QUI C'È UNA RAGIONE IN PIÙ PER ESSERE STRETTI, che la `create` non ha: la modifica
// scrive su Matchpoint **in modo incrementale**. «+ Aggiungere all'elenco» persiste il giocatore
// SUBITO, prima del «Salvare»; lo stesso il click «elimina» di una rimozione. ⇒ Un errore a metà
// di un elenco di tre aggiunte può aver già scritto le prime due. Lo dice il commento sopra
// `callWorkerEditBooking` («è così che il cliente 921 era stato aggiunto 3 volte»), ed è la
// ragione per cui là non c'è nessun retry.
//
// 🔎 LA SECONDA SERRATURA, letta dal worker e non supposta: `editBookingWithBrowser` tiene un
// diario (`diagnostic.steps`) e ogni gesto che scrive vi lascia un passo prima o subito dopo
// il click (`elimina:…`, `add_result:…`, `click_aceptar`, `salva`, `manut_…`). ⇒ Anche un
// codice «certo» arrivato DOPO uno di quei passi non è più certo: si guarda il diario, non
// solo la parola. È la stessa crepa già trovata in `SAVE_BUTTON_NOT_FOUND` (voce 72), chiusa
// nello stesso modo — con ciò che il worker scrive già, senza toccare una riga del worker.
//
// ⛔ In sola lettura (`read: true`) non esiste un «ignoto»: non si è scritto niente e non c'è
// niente che possa essere passato. Là un errore resta un errore.
//
// ⛔ Modulo PURO: nessuna rete, nessun ambiente. Le prove stanno in `esito-modifica.test.ts`.

/**
 * I codici che il worker lancia PRIMA di aprire la scheda della prenotazione, o senza averla
 * mai raggiunta. Su questi la modifica **non è partita**: si può dire «rifalla».
 *
 * 📏 Letti in `editBookingWithBrowser` (server.mjs) nell'ordine in cui compaiono, fino al
 * primo gesto che scrive. ⚠️ Un codice che il worker lancia DOPO aver toccato la scheda
 * (`REMOVE_NON_APPLICATA`, `PLAYER_ADD_INCOMPLETE`, `EDIT_VERIFICA_FALLITA`,
 * `REMOVE_TROPPI_GIRI`, `QUEUE_JOB_TIMEOUT`) NON sta qui di proposito: sono tutti «ho fatto
 * qualcosa e non so com'è finita».
 */
export const CODICI_CERTI_MODIFICA: readonly string[] = [
  'MATCHPOINT_WORKER_SECRETS_MISSING',
  'PARAMS_MANCANTI',
  'EDIT_NESSUNA_MODIFICA',
  'CAMPO_NON_VALIDO',
  'PRENOTAZIONE_NON_TROVATA',
  'FICHA_NON_TROVATA',
  // Il worker non ha nemmeno accettato la richiesta: chiave sbagliata, corpo troppo grande.
  'UNAUTHORIZED',
  'PAYLOAD_TOO_LARGE',
];

/**
 * Gli stati HTTP con cui il worker rifiuta SENZA aver fatto niente. 501/404 li tratta già la
 * chiamante (`WORKER_EDIT_BOOKING_NOT_IMPLEMENTED`); qui restano gli altri due che il worker
 * usa davvero (`error.status = 401` / `413` in server.mjs).
 */
export const STATI_CERTI_MODIFICA: readonly number[] = [400, 401, 404, 413, 501];

/**
 * I passi del diario del worker che dicono «ho toccato la scheda»: da qui in poi qualcosa
 * può essere già persistito su Matchpoint. Si confrontano per PREFISSO, perché molti passi
 * portano il nome del giocatore in coda (`elimina:mario rossi`).
 */
export const PASSI_CHE_SCRIVONO: readonly string[] = [
  'elimina:',                 // il click «elimina» di una rimozione (postback immediato)
  'elimina_ok:',
  'rimozioni_repeater_empty_reload',
  'add_result:',              // «+ Aggiungere all'elenco» persiste subito
  'add_input_missing_reload:',
  'costo_set:',
  'reload_after_removals',
  'fecha_set_js:',            // il modulo dello spostamento è aperto e compilato
  'ora_inizio_typed:',
  'ora_fine_typed:',
  'click_aceptar',            // lo spostamento è stato confermato
  'attendi_swal',
  'reload_after_move',
  'manut_descrizione_set',
  'manut_osservazioni_set',
  'salva_manut',
  'salva',                    // «Salvare» premuto (copre anche `salva_nota`)
  'verifica_reload',          // si è arrivati alla verifica: la scrittura è già dietro
  'move_verify_',
  'add_verify_',
];

export type EsitoModifica = 'certo' | 'ignoto';

type CorpoWorker = {
  error?: unknown;
  code?: unknown;
  message?: unknown;
  diagnostic?: { steps?: unknown } | null;
};

/** I passi del diario, come stringhe, da un corpo qualunque. Un corpo senza diario dà `[]`. */
export function passiDelDiario(corpo: unknown): string[] {
  const c = (corpo ?? {}) as CorpoWorker;
  const steps = c.diagnostic && typeof c.diagnostic === 'object' ? c.diagnostic.steps : undefined;
  if (!Array.isArray(steps)) return [];
  return steps.map((s) => String(s ?? ''));
}

/** Vero se nel diario c'è almeno un passo che scrive sulla scheda. */
export function laSchedaEStataToccata(passi: readonly string[]): boolean {
  return passi.some((p) => PASSI_CHE_SCRIVONO.some((prefisso) => p.startsWith(prefisso)));
}

/**
 * Il codice con cui il worker ha rifiutato. Il worker mette il codice in `error` (e, se non
 * ha un codice, ci mette il MESSAGGIO — `error.code || error.message`): un `error` che non
 * sembra un codice (spazi, minuscole, due punti) vale come «nessun codice».
 */
export function codiceDelRifiuto(corpo: unknown): string {
  const c = (corpo ?? {}) as CorpoWorker;
  const grezzo = String(c.code ?? c.error ?? '').trim();
  return /^[A-Z][A-Z0-9_]*$/.test(grezzo) ? grezzo : '';
}

/**
 * Il verdetto su un rifiuto del worker a una MODIFICA.
 *
 *   'certo'  → la modifica non è partita: a valle si può dire «non è passata, rifalla»;
 *   'ignoto' → qualcosa può essere già su Matchpoint: a valle si dice «non lo so ancora».
 *
 * @param opts.status   lo stato HTTP con cui il worker ha risposto
 * @param opts.corpo    il corpo JSON della risposta (`{ ok:false, error, message, diagnostic }`)
 * @param opts.readOnly `true` se la richiesta era in sola lettura: là non c'è niente di ignoto
 */
export function esitoDelRifiutoDiModifica(opts: { status: number; corpo: unknown; readOnly?: boolean }): EsitoModifica {
  if (opts.readOnly === true) return 'certo';
  const passi = passiDelDiario(opts.corpo);
  // 🚨 Il diario vince sulla parola: un codice «certo» dopo un passo che scrive non è certo.
  if (laSchedaEStataToccata(passi)) return 'ignoto';
  if (STATI_CERTI_MODIFICA.includes(Number(opts.status))) return 'certo';
  const codice = codiceDelRifiuto(opts.corpo);
  if (codice && CODICI_CERTI_MODIFICA.includes(codice)) return 'certo';
  return 'ignoto';
}
