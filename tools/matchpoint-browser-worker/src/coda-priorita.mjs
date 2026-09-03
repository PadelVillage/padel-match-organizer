/* coda-priorita.mjs — CHI passa dalla coda, e in che ordine. Regola pura, 22/08/2026.
 *
 * ⭐ In un modulo a sé e in `.mjs` per la stessa ragione di `tipo-ficha.mjs`: `server.mjs` chiama
 * `server.listen()` appena lo si importa, quindi non è importabile, quindi una regola che vive
 * là dentro è una regola che nessuno può ESEGUIRE in un banco. Qui invece si prova davvero.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * 🚨⭐⭐ L'INVARIANTE CHE IL WORKER DICHIARAVA E NON RISPETTAVA.
 *
 * Il commento della coda, scritto quando la coda è nata, dice:
 *   «Il worker usa UN solo account Matchpoint e regge una sola sessione browser per volta.
 *    Ogni operazione che lancia Chromium DEVE essere serializzata: mai due sessioni Matchpoint
 *    in parallelo (collisione di sessione + carico VM).»
 *
 * 📏 Misurato il 22/08/2026: **QUATTRO** endpoint chiamavano la loro funzione `…WithBrowser`
 * direttamente, senza passare da `mpQueueRun` — `/export-booking-history` (**ogni due minuti**,
 * è il sync delle prenotazioni), `/export-clients`, `/export-slot-schedule` e `/get-slots`.
 *
 * ⇒ L'invariante non era «quasi» rispettata: era aggirata dal pezzo periodico più frequente.
 *
 * 🚨🚨 E `/get-slots` NON è come gli altri tre, è PEGGIO — trovato controllando, non leggendo
 * l'elenco. Gli altri tre aprono un `chromium.launch()` loro: sono una sessione Matchpoint di
 * troppo e un browser di troppo sulla VM. `/get-slots` invece chiama **`mpAcquirePage`**, cioè
 * si fa dare la **pagina «warm» CONDIVISA** — e `mpAcquirePage` non ha nessun lucchetto: la
 * consegna a chiunque la chieda. ⇒ Fuori dalla coda, `/get-slots` può guidare **la stessa
 * pagina** su cui un altro job è a metà operazione, e il suo `release(failed)` può chiamare
 * `mpWarmInvalidate()`, cioè **chiudere il browser sotto quell'altro job**.
 * 📌 È la firma d'errore che nel registro ricorre da mesi: `Target page, context or browser has
 * been closed`. Non si prova che venga da qui — ma è il meccanismo che la produrrebbe, ed è
 * l'unico pezzo che poteva farlo.
 *
 * ⛔ E `/poller/force-run` NON va messo in coda, benché non chiami `mpQueueRun`: risponde 202
 * subito e lancia `runPollCycle()` in sottofondo, che i suoi job li mette in coda **lui**.
 * Metterlo in coda sarebbe un job che aspetta altri job a concorrenza 1 ⇒ **stallo del worker**.
 * L'assenza di `mpQueueRun` lì è corretta: delega, non scavalca.
 * 📌 Stava nel mio elenco dei colpevoli fino a un controllo prima di scrivere questa riga.
 * *Un elenco fatto cercando l'assenza di una chiamata trova anche chi quella chiamata non deve
 * farla.*
 *
 * 📏 Il costo, misurato sul registro del worker vivo (22/08, 16:40→18:04 UTC): su **42** giri
 * attesi del sync ne mancavano **3** — buchi da 4 minuti invece di 2 — e quello era un momento
 * TRANQUILLO. La mattina dello stesso giorno lo stesso meccanismo aveva prodotto un buco di
 * **988 secondi**, con un giro del poller durato 9′21″ contro i 28-40 secondi abituali, attese
 * in coda fino a 2′45″ e un browser chiuso sotto un export.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ⚖️ PERCHÉ SERVE UNA PRIORITÀ IN MEZZO, e non basta «mettere tutto in coda».
 *
 * Serializzare e basta metterebbe la chiamata del sync — che arriva ogni 2 minuti — ad
 * aspettare dietro il poller, che di giri ne fa tre per volta. ⇒ Si toglierebbe la collisione
 * di sessione pagandola con la freschezza della copia, cioè spostando il danno invece di
 * toglierlo.
 *
 * ⇒ Tre livelli invece di due:
 *   2 · INTERATTIVE   — c'è una persona che ha toccato un bottone e sta aspettando;
 *   1 · SINCRONIZZAZIONI — nessuno aspetta, ma il ritardo si accumula e si vede (la copia del
 *       gestionale invecchia, e su quella copia si decide se dire «no» a un socio — voce 53);
 *   0 · FONDO         — poller, letture del tabellone, keepalive: se slittano non se ne accorge
 *       nessuno, ed è esattamente per questo che stanno sotto.
 *
 * 🚨 NON è preemption, e la differenza va detta perché è la stessa di prima: un job GIÀ IN
 * ESECUZIONE non si interrompe. La priorità agisce solo nella SCELTA del prossimo. ⇒ Nel caso
 * peggiore la chiamata del sync aspetta la durata di un'operazione interattiva.
 * ⚖️ E quel caso peggiore è accettabile per una ragione misurata, non per ottimismo: l'export
 * dello storico è **a finestra piena**, non incrementale ⇒ un giro saltato costa LATENZA, non
 * dati. Il giro dopo ricopre tutto. È la stessa proprietà su cui poggia già oggi il fatto che
 * i 3 giri mancanti su 42 non abbiano lasciato buchi nella copia.
 *
 * ⛔ Cosa NON è cambiato, e va saputo: metterle in coda non le rende più VELOCI, le rende **non
 * contemporanee**. Per i tre export, che aprono e chiudono il browser loro, il guadagno atteso
 * è che smettano di rubarsi CPU, RAM e sessione Matchpoint a vicenda — non che ciascuno duri
 * meno. Per `/get-slots`, che invece usa la pagina condivisa, il guadagno è di natura diversa e
 * più grossa: smette di poter **corrompere** l'operazione di qualcun altro.
 */

/** C'è una persona che aspetta: passano davanti a tutto.
 *
 * 🩹🚨⭐⭐ 03/09/2026 — I QUATTRO GESTI SUI SOLDI MANCAVANO, e non è una dimenticanza innocua:
 * `collect-payment`, `set-charge`, `void-payment` e `correct-wallet` cadevano nel `return`
 * finale di `mpJobPriority`, cioè **priorità FONDO — insieme al poller e al keepalive**.
 * ⇒ Un incasso, con la segretaria e il socio fermi al banco ad aspettare, veniva scelto
 * DOPO il sync delle prenotazioni e dopo le letture del tabellone.
 * 📌 *Un elenco scritto a mano non è una regola: è una fotografia del giorno in cui è stato
 * scritto.* Quando è nato (22/08) i pagamenti non passavano ancora dalla coda — sono arrivati
 * fra il 2 e il 3 settembre, e nessuno è tornato qui.
 * ⚖️ Trovato cercando come distinguere «i gesti di una persona» per il semaforo della voce 137,
 * non cercando questo: il filtro «solo le interattive» avrebbe **perso proprio i gesti nuovi**,
 * ed è così che il difetto è venuto a galla. */
export const MP_INTERACTIVE_OPS = new Set([
  'create', 'edit', 'cancel', 'client', 'disable-client', 'reactivate-client',
  // 💶 I soldi: c'è sempre qualcuno fermo al banco che aspetta.
  'collect-payment', 'set-charge', 'void-payment', 'correct-wallet',
]);

/**
 * Le sincronizzazioni periodiche. Nessuno aspetta davanti allo schermo, ma il loro ritardo
 * invecchia la copia del gestionale — e sulla freschezza di quella copia si decide se si può
 * dire «no» a un socio (voce 53). ⇒ Stanno sopra il fondo, sotto le persone.
 *
 * 📌 Chi le chiama, verificato il 22/08 nei due repo e non supposto: sono **tutte** edge di
 * sincronizzazione (`matchpoint-bookings-sync`, `matchpoint-clients-sync`,
 * `matchpoint-slot-schedule-sync`, `matchpoint-history-sync`). Nessuna sta su una strada
 * interattiva ⇒ metterle in coda non può far aspettare nessuno che ha appena toccato un
 * bottone. Era la condizione da provare prima di scrivere questa riga.
 */
export const MP_SYNC_OPS = new Set([
  'export-history', 'export-clients', 'export-slot-schedule', 'get-slots',
]);

export const PRIORITA = { INTERATTIVA: 2, SINCRONIZZAZIONE: 1, FONDO: 0 };

/**
 * La priorità di un job in coda.
 *
 * ⭐ `meta.priority` esplicito vince su tutto, come prima: è la via con cui un chiamante può
 * dichiarare «questo lo so io meglio della tabella». Toglierla romperebbe chi la usa già.
 */
export function mpJobPriority(meta) {
  if (meta && typeof meta.priority === 'number') return meta.priority;
  const op = meta && meta.op;
  if (MP_INTERACTIVE_OPS.has(op)) return PRIORITA.INTERATTIVA;
  if (MP_SYNC_OPS.has(op)) return PRIORITA.SINCRONIZZAZIONE;
  return PRIORITA.FONDO;
}

/**
 * Gli endpoint che aprono un browser e DEVONO quindi passare dalla coda.
 *
 * ⚠️ Serve al banco, non al server: è l'elenco su cui la prova di cucitura controlla che
 * nessuno di questi handler chiami la propria funzione `…WithBrowser` in presa diretta.
 * Scriverlo qui — accanto alla regola — invece che dentro il banco è deliberato: un elenco che
 * vive solo nel file di prova è un elenco che si aggiorna solo quando qualcuno si ricorda.
 */
export const HANDLER_CHE_APRONO_UN_BROWSER = [
  'handleCreateBooking', 'handleCancelBooking', 'handleEditBooking',
  'handleCreateClient', 'handleUpdateClient', 'handleDisableClient', 'handleReactivateClient',
  'handleCollectPayment', 'handleSetCharge', 'handleVoidPayment', 'handleCorrectWallet',
  'handleReadWallet', 'handleExportWalletReport', 'handleExportPaymentsReport',
  'handleReadInstructors', 'handleDebugFindClient', 'handleReadTabellone',
  // I quattro che il 22/08 la scavalcavano:
  'handleHistoryExport', 'handleExport', 'handleSlotScheduleExport', 'handleGetSlots',
];
