// Com'è andata davvero una scrittura di cui non si è saputo l'esito — la regola in UN posto solo.
//
// Nasce dalla voce 53 e dalla regola d'architettura del committente (16/08/2026):
// **il gestionale SA, il bot DICE**. Il bot non deve dedurre niente da quello che vede: chiede
// qui, e qui esce un `si` / `no` / `non_ancora` già pronto da tradurre in italiano.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🚨⭐⭐ PERCHÉ NON BASTA GUARDARE SE LA PRENOTAZIONE C'È
//
// La copia del gestionale è alimentata dal sync, e **il sync passa dal worker**
// (`matchpoint-bookings-sync` → `/export-booking-history`). ⇒ Quando il worker è giù la copia
// si CONGELA — e il worker giù è esattamente la condizione che ha prodotto l'esito ignoto.
// Misurato il 16/08 (📄 `docs/voce-53-ritardo-sync.md`): la notte del 15/08 il sync registrava
// `MATCHPOINT_BROWSER_WORKER_FAILED` alle 22:28:02, un minuto dopo la scrittura rimasta ignota
// delle 22:27:16. I due guasti arrivano INSIEME, non a caso: hanno la stessa causa.
//
// ⇒ **L'assenza dalla copia non è una prova di assenza dal circolo.** Un «no» detto guardando
// solo la copia è falso proprio nel caso per cui questa funzione è stata scritta. Il «no» si
// può dire **solo** se un giro di sync è atterrato DOPO la scrittura: allora, e solo allora,
// «non c'è» vuol dire «non c'è».
//
// ⭐ Il segnale della freschezza esiste già: `synced_at` sulle righe `booking`, che il sync
// riscrive a ogni giro ATTERRATO. ⚠️ Non vanno usati per questo:
//   · `matchpoint_bookings_full_tick_last` → segue solo i giri PIENI (uno ogni 15 minuti), ed è
//     la trappola della 24ª in persona: `lastFullSuccessAt` «appartiene a un'altra strada»;
//   · `matchpoint_bookings_auto_diagnostic_last` → lo scrivono sia gli errori sia le
//     diagnostiche di validazione, quindi non è un «ultimo successo».
// ✅ E `synced_at` regge la prova che conta: un giro FALLITO **non** lo sposta, perché le righe
// si scrivono solo a esportazione riuscita. Verificato sui dati veri il 16/08 — il fallimento
// delle 22:28:02 non compare fra i valori di `synced_at` di quella sera.
// ══════════════════════════════════════════════════════════════════════════════════════════

/**
 * La finestra che l'export copre a OGNI giro: `oggi … oggi+30`.
 * 🚨 Copiata da `DEFAULT_FUTURE_DAYS` di `matchpoint-bookings-sync/index.ts` (le cartelle
 * `_shared/` non si deployano, stessa ragione di `playersFromDescrizione`): se cambia là,
 * cambia qui. Oltre questa soglia la copia **non saprà mai** della prenotazione — misurato:
 * `idReserva 9434`, creata per 121 giorni avanti, non è mai comparsa.
 */
export const FINESTRA_SYNC_GIORNI = 30;

/**
 * Quanto si concede alla scrittura per atterrare DOPO che il bot ha perso il contatto.
 *
 * ⚖️ Il numero non è a sentimento e non è la durata tipica: quando l'esito è ignoto il worker
 * si è **piantato**, quindi la durata dei giri riusciti (massimo misurato: **31 s**) non lo
 * limita. Si prende allora il tetto STRUTTURALE — i **150 s** oltre i quali l'edge viene
 * uccisa comunque, citati nel commento del decoupling di `matchpoint-bookings-sync`. Oltre
 * quel punto non c'è più nessuno che possa scrivere.
 * ⭐ Sbagliare in eccesso qui costa solo un «non ancora» in più; sbagliare in difetto produce
 * un «no» falso, che è il danno che tutta questa funzione esiste per evitare.
 */
export const MARGINE_SCRITTURA_S = 150;

export type Verdetto = {
  /**
   * `si` = c'è, `no` = non c'è (e lo sappiamo davvero), `non_ancora` = non lo sappiamo.
   *
   * 🚨⭐⭐ `doppione` = ce ne sono DUE, ed è il quarto esito, nato il 23/08/2026. Non è una
   * sfumatura del `si`: è il danno che tutta la macchina dell'`esito_ignoto` esiste per
   * evitare, e fino a oggi usciva **certificato come successo**.
   * ⚖️ Un bot che non lo conosce lo legge come `non_ancora` (`verificaScrittura` tiene solo
   * `si`/`no` e manda tutto il resto sul verso prudente) e dice «non riesco ad avere conferma
   * da qui, chiedi in segreteria». ⇒ Il gestionale può andare avanti da solo: chi resta
   * indietro perde l'utilità, non la verità — e soprattutto **smette di certificare il danno**.
   */
  esito: 'si' | 'no' | 'non_ancora' | 'doppione';
  /** Perché, in una parola sola: è quello che il bot traduce, e serve identico nei log. */
  motivo: string;
  /**
   * Ha senso richiedere fra un po'? ⭐ È separato dall'esito di proposito: ci sono due
   * `non_ancora` diversissimi — «aspetta e saprai» e «qui non si saprà mai», e dirli con la
   * stessa parola manderebbe il bot ad aspettare a vuoto un dato che non arriverà.
   */
  attendere: boolean;
};

/** ISO → millisecondi, oppure null se non è una data (mai un NaN che gira per il codice). */
function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const v = Date.parse(String(iso));
  return Number.isFinite(v) ? v : null;
}

/** `YYYY-MM-DD` + n giorni, senza fusi: si confrontano stringhe di date, non istanti. */
export function giornoPiu(giorno: string, n: number): string {
  const d = new Date(`${giorno}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Il verdetto su una scrittura di cui non si è saputo l'esito.
 *
 * 🚨 L'ORDINE DEI CONTROLLI È LA FUNZIONE. Il `si` viene per primo perché una presenza è una
 * presenza comunque: se la riga c'è, che la copia sia fresca o stantia non cambia niente —
 * nessun sync inventa una prenotazione. Tutti gli altri rami servono solo a distinguere il
 * «no» vero dal «non lo so», che è l'unica cosa difficile qui dentro.
 */
export function verdettoScrittura(o: {
  /** Il socio risulta dentro quello slot nella copia del gestionale? */
  presente: boolean;
  /**
   * ⭐ Quante PRENOTAZIONI DISTINTE di quello slot contengono il socio.
   *
   * 🚨 È la cura del 23/08/2026, e la domanda che risolve **non è quella che sembra**. «È
   * passata la MIA?» resta senza risposta certa e ci resterà: la `verifica` esiste solo dopo un
   * `esito_ignoto`, cioè dopo che il worker non ha mai risposto, quindi quella prenotazione un
   * identificativo non ce l'ha mai avuto. *La chiave con cui la si vorrebbe cercare è la cosa
   * che l'evento da diagnosticare ha distrutto.*
   * ⇒ La domanda che invece **ha** risposta certa è «ce ne sono DUE?», ed è l'unica delle due
   * che protegge qualcuno: nel verso pericoloso — prima passata, socio che rifà — oggi la
   * verifica ne trovava una, diceva «era andata a buon fine» e il doppione restava invisibile.
   *
   * ⚠️ Chi non sa contare passa `undefined`, e allora comanda `presente` come prima: questo
   * campo può trasformare un `si` in un `doppione`, MAI un `si` in un `no`.
   */
  quante?: number;
  /** Istante in cui la scrittura è partita (ISO). Senza, un «no» non si può dire. */
  scrittaAlle: string | null;
  /** `max(synced_at)` delle righe prenotazione: l'ultimo giro di sync ATTERRATO (ISO). */
  copiaFrescaAl: string | null;
  /** Giorno dello slot, `YYYY-MM-DD`. */
  giornoSlot: string;
  /** Oggi a Roma, `YYYY-MM-DD`. */
  oggi: string;
}): Verdetto {
  // 🚨 PRIMA del `si`, ed è tutta la cura: il `si` è vero anche quando ce ne sono due — dirlo
  // per primo sarebbe rispondere alla domanda facile e tacere quella che costa.
  // ⚖️ E non serve la freschezza: due righe distinte nella copia sono due prenotazioni vere sul
  // Matchpoint del circolo, comunque vecchia sia la copia. Nessun sync ne inventa una.
  if ((o.quante ?? 0) >= 2) return { esito: 'doppione', motivo: 'piu_di_una', attendere: false };
  if (o.presente) return { esito: 'si', motivo: 'trovata', attendere: false };

  // Fuori dalla finestra dell'export: la copia non ne saprà mai niente, e aspettare è tempo
  // regalato. ⚖️ Sta DOPO il `si` apposta — una prenotazione oltre i 30 giorni può essere
  // visibile lo stesso come `staff_booking`, che è scritto di qua e non dipende dal sync.
  if (o.giornoSlot > giornoPiu(o.oggi, FINESTRA_SYNC_GIORNI)) {
    return { esito: 'non_ancora', motivo: 'fuori_finestra', attendere: false };
  }

  const tScrittura = ms(o.scrittaAlle);
  // Senza l'istante della scrittura non c'è niente con cui confrontare la freschezza. Non è un
  // guasto — è che il chiamante non ce l'ha detto — e la risposta onesta resta «non lo so».
  if (tScrittura === null) return { esito: 'non_ancora', motivo: 'istante_ignoto', attendere: true };

  const tCopia = ms(o.copiaFrescaAl);
  // Nessuna riga prenotazione con `synced_at`: il sync non è mai atterrato, o non c'è nulla da
  // sincronizzare. In entrambi i casi la copia non testimonia niente.
  if (tCopia === null) return { esito: 'non_ancora', motivo: 'copia_muta', attendere: true };

  if (tCopia >= tScrittura + MARGINE_SCRITTURA_S * 1000) {
    return { esito: 'no', motivo: 'copia_aggiornata_dopo', attendere: false };
  }
  return { esito: 'non_ancora', motivo: 'copia_ferma', attendere: true };
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔒⭐⭐ IL VOCABOLARIO CHE ESCE DAL GESTIONALE — 19/08/2026, regola ferrea del committente.
//
// 🗣️ *«ti ricordo che il bot deve prendere solo ordini dal gestionale non da Matchpoint… Il
// worker il bot non deve proprio filarselo, perché il worker è il tramite fra la nostra webapp
// (gestionale) e Matchpoint.»* ⇒ Il worker, per il bot, **non esiste**: né indirizzo, né stato,
// **né NOME**.
//
// 🚨 E il 19/08 alle 18:53 il nome è uscito lo stesso: il registro del bot ha scritto
// `[griglia] rifiutata (worker_error)` — cioè il gestionale ha risposto al bot col nome di un
// suo pezzo interno, e il bot l'ha girato al socio come un rifiuto.
//
// ⚖️ **Quella sera la violazione era il NOME, non la sostanza** — misurato, non supposto: il
// worker aveva fallito su `SAVE_BUTTON_NOT_FOUND`, che è un fallimento CERTO (il bottone di
// salvataggio non è mai stato premuto), e sulla copia del gestionale quella prenotazione non è
// mai esistita, nemmeno cancellata, con la copia fresca di un'ora e mezza DOPO. Il «no» era
// vero. Sbagliata era la parola con cui è stato detto.
// ⇒ Distinguere le due metà conta: chi legge «violazione» e corregge la sostanza cura un difetto
//   che quella sera non c'era, e lascia in piedi quello che c'era.
//
// 🎯 La prova che questo nome deve superare: *il giorno in cui Matchpoint si spegne, il bot non
// si tocca*. `worker_error` quel giorno non vorrebbe più dire niente; «la scrittura è stata
// rifiutata» sì, perché è il GESTIONALE a dirlo, e il gestionale resta.
// ══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Il motivo che il gestionale dà al bot quando una scrittura **non è passata, e lo sappiamo**.
 *
 * ⭐ Sta in una costante e non in cinque stringhe scritte a mano: erano cinque copie di
 * `'worker_error'` sparse in `index.ts`, e cinque copie della stessa parola divergono al primo
 * ripensamento — o, peggio, se ne corregge una e le altre quattro continuano a dire la parola
 * vietata senza che nessuno se ne accorga.
 * ⚠️ È l'unico nome che può uscire per un fallimento certo: `esito_ignoto` è per l'altro caso,
 * e nessuno dei due nomina un pezzo interno.
 */
export const MOTIVO_SCRITTURA_RIFIUTATA = 'scrittura_rifiutata';

/**
 * Il motivo che il gestionale dà al bot quando **non sa** com'è andata.
 *
 * ⭐ Sta accanto alla gemella dal 29/08/2026 (voce 106) e per la stessa ragione: da quel giorno
 * i punti che la scrivono sono **cinque** invece di uno, e cinque copie di una parola divergono
 * al primo ripensamento. Il bot ha la sua costante speculare (`MOTIVO_ESITO_IGNOTO` in
 * `ponte.ts`): sono due lati dello stesso contratto, e vanno cambiati insieme.
 *
 * ⚠️ Vuol dire l'OPPOSTO di `MOTIVO_SCRITTURA_RIFIUTATA`: là «non è passata» e al socio si può
 * dire «riprova»; qui «non si sa», e «riprova» sarebbe un'affermazione sul passato.
 */
export const MOTIVO_ESITO_IGNOTO = 'esito_ignoto';

// ══════════════════════════════════════════════════════════════════════════════════════════
// 🚨⭐⭐ LA TERZA VIA DEL «NON LO SO»: IL CANCELLO CHE UCCIDE LA NOSTRA EDGE — voce 83, 23/08/2026.
//
// 📏 IL FATTO, letto nel registro dell'edge e non supposto. La notte del 23/08 il committente
// annulla dal bot il 31/08 · 09:00 · Campo 1:
//
//   21:37:29  [booking-write] cancel diritto ORGANIZZATORE … Maurizio è il primo di 4
//   21:39:59  [booking-write] cancel KO HTTP 504:
//             {"code":"IDLE_TIMEOUT","message":"Request idle timeout limit (150s) reached"}
//
// Il bot ha detto *«non ci sono riuscito, la tua prenotazione è rimasta com'era»*. **L'annullo
// era passato**: il sync delle 21:44:04 ha marcato `deleted` il `booking|9602`, e su Matchpoint
// alle 23:43 il Campo 1 era vuoto. Un «no» falso su una scrittura avvenuta.
//
// 🔎 E CHI HA RISPOSTO NON ERA NÉ IL WORKER NÉ LA NOSTRA EDGE. Sono passati **150 secondi
// esatti**: è la piattaforma che ha ucciso l'invocazione interna di `matchpoint-bookings-cancel`
// e ha restituito un 504 al posto suo — mentre Playwright, di là, stava ancora lavorando e ha
// finito. È **lo stesso tetto strutturale** che `MARGINE_SCRITTURA_S` qui sopra cita già.
//
// ⇒ **Le vie del «non lo so» sono TRE, e la macchina ne conosceva due.** La voce 23 copre il
// worker che non risponde, la 72 il worker che rifiuta senza sapere; questa è la terza —
// *nessuno dei due ha mai parlato*, e a rispondere è stato il cancello. Arriva come una risposta
// HTTP ben formata, per questo nessuna delle due guardie la vedeva.
//
// 🚨 E NON ERA UN PROBLEMA DEL SOLO ANNULLO. Sull'annullo il verso sbagliato è innocuo — disdire
// due volte non fa danno — ma questa funzione la chiama il ramo **`create`**, dove lo stesso 504
// usciva come `scrittura_rifiutata` e il bot diceva *«rifalla»*: **la doppia prenotazione**, cioè
// il danno esatto che la voce 23 esiste per evitare, per una strada che nessuno aveva chiuso.
//
// ⚖️ LA REGOLA, ed è la stessa forma di `CODICI_FALLIMENTO_CERTO` un piano più in su: **si
// riconosce il rifiuto NOSTRO, e tutto il resto è ignoto.** Le nostre edge interne rifiutano
// per una porta sola — `err(status, code, message)`, che scrive sempre `error: '<CODICE>'` — ⇒
// una risposta **senza `error`** non l'ha scritta nessuno di noi: nessuno ha rifiutato niente.
// 📌 Il pregio è che non elenca i codici del cancello: `IDLE_TIMEOUT` non compare qui dentro, e
// un codice nuovo della piattaforma — o un corpo illeggibile — cade dalla parte giusta da sé.
// Fallisce CHIUSA, come `dettaglioPerIlBot`.
// ══════════════════════════════════════════════════════════════════════════════════════════

/**
 * La risposta di una edge di scrittura sta dicendo **«non lo so»**?
 *
 * ⭐ Estratta qui il 19/08 da dentro il ramo `create`, dove era l'unica copia esistente: gli
 * altri quattro punti che scrivono (`leave`, `remove`, `add`, `cancel`) il marchio non lo
 * guardavano affatto. Una regola che vive in un `if` dentro una funzione lunga non si può
 * riusare, e infatti non era stata riusata.
 *
 * 🚨 Il marchio si legge su una PROPRIETÀ, non cercando parole dentro il messaggio: una
 * condizione si riconosce da **cosa è successo**, non da quali parole contiene la stringa che
 * la racconta. E si guardano ENTRAMBI i segni perché viaggiano insieme ma sono indipendenti: se
 * un domani uno dei due cambiasse forma, l'altro regge — e il verso in cui si sbaglia resta
 * quello sicuro, cioè «non lo so» invece di «no».
 *
 * ✅ **LA CHIAMANO TUTTI E CINQUE — dal 29/08/2026, voce 106.** ⚠️ Fino a quel giorno qui c'era
 * scritto il contrario, e la riga era vera: *«oggi la chiama solo il ramo `create`»*. Si
 * **corregge**, non si affianca.
 *
 * 📏 IL FATTO CHE HA CHIUSO L'ATTESA, visto succedere e non cercato: il 29/08 alle 15:28:58 il
 * bot ha detto *«Fabiola Limuti: non ci sono riuscito»* su una rimozione di cui **nessuno**
 * sapeva l'esito — sotto c'era un `locator.click: Timeout 8000ms`, e un timeout non dice se la
 * scrittura è arrivata. Quella volta il rifiuto era vero (il click non era mai passato), ma
 * **era vero per fortuna, non perché il gestionale lo sapesse**.
 *
 * ⚖️ **L'ORDINE È STATO RISPETTATO, ed era la parte che contava.** La riga vecchia chiudeva con
 * *«chi lo farà cominci dalle frasi, non da questa funzione»*, e così è andata: prima il bot ha
 * imparato le quattro frasi «non lo so» (esci, annulla, togli, aggiungi) ed è stato messo in
 * servizio sulla VM; **solo dopo** questa funzione ha smesso di essere chiamata da un ramo solo.
 * Al contrario, per la finestra fra i due deploy, il bot avrebbe ricevuto una parola che non sa
 * tradurre — cioè il difetto da curare, in una forma nuova.
 *
 * ⛔ **COSA NON SI MANDA sui quattro, e non è una dimenticanza**: `scritta_alle` e `slot`. Su
 * `create` servono al bot per **tornare a chiedere** (voce 53, `verificaScrittura`); per gli
 * altri quattro quel ciclo non esiste, e le frasi nuove infatti non lo promettono — dicono di
 * guardare `/prenotazioni` fra qualche minuto. Mandarli sarebbe dato che nessuno legge, e
 * peggio: suggerirebbe una capacità che non c'è.
 *
 * 🚨 Resta vero il resto del riquadro: il danno **non è simmetrico** — prenotare due volte occupa
 * un campo, disdire due volte no — ed è la ragione per cui la `create` è stata curata per prima,
 * il 19/08. Questa è la coda di quel lavoro, non un suo ripensamento.
 */
export function esitoIgnotoDaRisposta(data: unknown): boolean {
  const d = (data ?? {}) as Record<string, unknown>;
  if (d.esitoIgnoto === true) return true;
  const codice = String(d.error ?? '').trim();
  if (codice === 'WORKER_ESITO_IGNOTO') return true;
  // ⭐⭐ LA TERZA VIA, ed è la voce 83: senza un codice NOSTRO nessuno ha rifiutato niente.
  // Vedi il riquadro qui sopra — questa riga è tutta la differenza fra «non è passata» e «non
  // lo so» quando a rispondere è stato il cancello invece della nostra edge.
  return codice === '';
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔒⭐⭐ IL «DETTAGLIO» CHE ESCE VERSO IL BOT — 21/08/2026, la metà che mancava del 19/08.
//
// 🗣️ Regola ferrea del committente: *«il worker il bot non deve proprio filarselo, perché il
// worker è il tramite fra la nostra webapp (gestionale) e Matchpoint»* — né indirizzo, né
// stato, **né nome**.
//
// ⚖️ Il 19/08 è stato curato il `reason` (`worker_error` → `scrittura_rifiutata`), e la
// guardia che lo sorveglia sta nei casi di questo modulo. Ma il **dettaglio** no: `detail`
// nasce da `data.message` dell'edge interna, e quel messaggio è scritto per noi —
// `Worker network error: error sending request for url (https://worker…/create-booking)`.
// 📏 Misurato nel registro del bot dei soci il 21/08 alle 09:28, sull'esito ignoto di una
// prenotazione del giorno prima: quella riga è arrivata **intera** fino al bot.
//
// 🚨 E non finisce solo nel log: per ogni rifiuto che non sia `esito_ignoto`, il bot passa
// quel testo come `spiegazione` al modello che scrive al socio (`prenotazione.ts`). ⇒ Il nome
// di un pezzo interno poteva arrivare sullo schermo di chi gioca, dentro una frase riformulata.
//
// ⛔ Il grezzo NON si butta: resta nel `console.error` dell'edge, che è il posto dove serve —
// a noi, per la diagnosi. Quello che cambia è ciò che **esce**.
//
// 🎯 La prova di sempre: il giorno in cui Matchpoint si spegne, il bot non si tocca. Un
// dettaglio che nomina il worker quel giorno diventerebbe incomprensibile; «il circolo non ha
// dato un motivo comprensibile» no, perché è il gestionale a dirlo, e il gestionale resta.
// ══════════════════════════════════════════════════════════════════════════════════════════

/**
 * I nomi dei pezzi interni, e gli indirizzi. Chi ne aggiunge uno lo aggiunga **qui**: è la
 * stessa lista con cui i casi sorvegliano `index.ts`, e due copie divergerebbero.
 * ⚠️ `https?://` c'è perché un url è un nome interno anche quando non contiene nessuna di
 * queste parole — ed è la forma in cui il difetto del 21/08 si è presentato.
 */
export const NOMI_INTERNI = /worker|matchpoint|hetzner|playwright|caddy|nip\.io|browser|https?:\/\//i;

/**
 * Cosa legge il bot quando il gestionale non ha un motivo che si possa raccontare.
 *
 * ⚖️ Non dice «è andata male» e non dice «non è passata»: quelli sono verdetti, e il verdetto
 * lo porta il `reason`. Questo dice soltanto che una spiegazione non c'è.
 */
export const DETTAGLIO_SENZA_SPIEGAZIONE = 'il circolo non ha dato un motivo comprensibile';

/**
 * Il dettaglio, ripulito, così com'è lecito che il bot lo legga.
 *
 * 🚨 Fallisce CHIUSA: al minimo sospetto — una parola interna, un indirizzo — non si prova a
 * cancellare il pezzo colpevole lasciando il resto. Ritagliare un messaggio tecnico
 * lascerebbe in piedi la metà che nessuno ha pensato di cercare, e questo è un posto in cui
 * un mezzo successo vale zero: basta un url perché la regola sia rotta.
 *
 * ⚠️ `clean` non si usa qui e non è una svista: quella funzione toglie i caratteri di
 * controllo, questa decide **se il testo può uscire**. Sono due lavori diversi, e infilarli
 * in una funzione sola vorrebbe dire che chi cerca il secondo trova il nome del primo.
 */
export function dettaglioPerIlBot(grezzo: unknown): string {
  const testo = String(grezzo ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!testo) return '';
  return (NOMI_INTERNI.test(testo) ? DETTAGLIO_SENZA_SPIEGAZIONE : testo).slice(0, 200);
}
