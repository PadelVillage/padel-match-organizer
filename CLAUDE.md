# Padel Match Organizer — istruzioni di progetto

## 🥇 POSTULATO PRINCIPALE — la prova la faccio IO, lui SUPERVISIONA (FERMA, 04/09/2026)

🗣️ **Sue parole, e vengono prima di tutto il resto:**

> *«Puoi anche fare tu la prova su prod prima di dirmi che il lavoro è ok. Io devo solo
> supervisionare che quello che hai detto risponde a verità.»*

⇒ **Un lavoro non si annuncia «ok» finché non l'ho provato IO sull'ambiente dove la gente lo usa
— PROD compresa.** Non gli si consegna un lavoro *da collaudare*: gli si consegna un lavoro
**provato**, con scritto **cosa** è stato provato e **come**. Il suo mestiere è **verificare che
quello che ho detto sia vero**, non scoprire al posto mio se funziona.

🔁 **L'ORDINE DEI PASSI, dettato da lui il 04/09 e da seguire così com'è scritto:**

> *«Tu fai gli sviluppi, li guardi e li provi su test; quando sei convinto che funzionano li porti
> su prod. Poi dopo li guardi e li testi su prod e dopo che sei sicuro che tutto funziona mi dici
> di andare a controllarti.»*

| | passo | chi |
|---|---|---|
| ① | si sviluppa | io |
| ② | **si guarda e si prova su TEST** | io |
| ③ | quando sono convinto che funziona → **si porta su PROD** | io |
| ④ | **si guarda e si prova su PROD** | io |
| ⑤ | quando sono sicuro → **gli si dice di andare a controllare** | lui |

🚫🚫 **E IL PASSO ③ NON SI CHIEDE — aggiunto il 04/09 sera, detto da lui TRE VOLTE di fila
perché non restasse frainteso:**

> *«Non mi devi chiedere il permesso per portare in prod, lo devi fare in automatico. Dopo che su
> test hai fatto tutti i test che funziona. Poi lo porti in prod in automatico, poi controlli in
> prod che funziona e poi mi avvisi quando è finito che io vado a controllare.»*

⇒ **Fermarsi fra il ② e il ③ per chiedere «lo porto in prod?» è la cosa che lui ha tolto di
mezzo.** Non è il permesso di saltare le prove: è l'**ordine** in cui vanno fatte. La catena si
percorre intera e da sola, e ci si ferma **solo** al ⑤.
🗣️ *«Ogni volta che apriamo una chat questa regola deve essere presente.»* ⇒ **sta qui, in testa,
apposta** — questo file si carica a ogni sessione, ed è la prima cosa che si legge.
⛔ **Resta fuori una cosa sola, ed è quella di sempre**: ciò che è **irreversibile o si vede da
fuori** — una scrittura vera sul Matchpoint del circolo, un messaggio verso i soci,
`--allow-writes` su PROD. Quello si **dice prima**, anche procedendo. *«Non chiedere» vale sul
portare in produzione una cura provata, non sul premere un bottone che qualcuno fuori da qui
vedrà.*
📖 I quattro passi in dettaglio — cosa prova ciascuno e dove arriva — stanno in **🚀 LA PROMOZIONE
A PROD NON SI CHIEDE**, più sotto.

🔎🔎 **E LUI CONTROLLA SEMPRE SU PROD — sue parole del 04/09 sera:**

> *«Ricordati che io controllo sempre su prod.»*

⇒ **Non è un dettaglio di preferenza: è ciò che decide DOVE una prova conta.** Il passo ⑤ avviene
su **PROD**, sempre ⇒ un lavoro provato solo su TEST gli arriva **non provato dove lui guarda**, e
la differenza fra i due ambienti è esattamente quella che fa cadere le cose (dati veri, cache da
`max-age=600`, calendario di TEST **congelato**, larghezza del suo telefono).
📌 *Se la prova sta su TEST e il controllo sta su PROD, i due non si incontrano mai — e il verde
che dichiaro non è il verde che lui vede.*
⇒ **Nel resoconto si scrive SEMPRE, e per ciascuna cosa provata, SU QUALE AMBIENTE.** «Provato»
senza l'ambiente accanto è una parola che non dice niente; e ciò che su PROD non si è potuto
esercitare si dichiara **non provato là**, anche se su TEST è verde.

⛔ **Il passo ④ non si salta**, ed è quello che si è più tentati di saltare: TEST è verde, la
promozione è andata, il numero è giusto — sembra fatto. Ma su PROD ci sono i **dati veri**, la
cache da `max-age=600` che serve ancora la copia vecchia, e la larghezza del telefono da cui
guarda lui. 📌 *Fra «l'ho promosso» e «l'ho visto funzionare dove la gente lo usa» ci stanno
tutti i difetti che questa lista ha imparato a memoria.*
⛔ E il passo ⑤ **non è «prova tu se funziona»**: è *«ho finito, vieni a controllare che quello
che ho detto sia vero»*. La differenza è tutta lì.

🔨 **Cosa vuol dire, in pratica:**
· la prova si fa **sulla pagina viva** — console remota (`tools/verifica-browser`, autorizzata su
  TEST **e PROD**), oppure il bot con un gesto vero;
· si prova **su PROD**, perché è lì che il difetto lo vede chi lavora, e su TEST il calendario è
  **congelato** (mostra il passato: una prova che «riesce» lì può non voler dire niente);
· nel resoconto va **cosa ho provato E cosa NON ho provato**: una misura che l'ambiente non
  permetteva si dichiara mancante, non si arrotonda a «funziona».

⛔ **Cosa NON autorizza, e non è un dettaglio:** il postulato riguarda le **PROVE**, non le
**scritture**. Restano fuori — e si dicono prima — le cose **irreversibili o visibili da fuori**:
una prenotazione vera sul Matchpoint del circolo, un messaggio che parte verso i soci,
`--allow-writes` su PROD. ⇒ *Provare non è scrivere*: si guarda con i propri occhi, non si fanno
gesti al posto suo.

🔄 **QUESTO CORREGGE UNA RIGA PIÙ IN BASSO, non la affianca.** La sezione *«✋ Un task non è finito
finché non lo si è provato FISICAMENTE»* diceva: *«per prenotazioni, avvisi e roster la prova
fisica è su PROD, spesso con un gesto suo ⇒ chiedergli il gesto fa parte del lavoro»*. Vero per i
gesti che **scrivono davvero**; **falso** come abitudine generale, ed era diventato il modo
normale di chiudere. ⇒ Il gesto suo si chiede **solo** quando serve una scrittura vera che non
posso fare io. Tutto il resto — che la scheda si apra piena, che una voce di menu sia sparita,
che un numero sia quello giusto — **lo guardo io**.

📌 *Chiedergli di provare quello che potevo provare io non è prudenza: è spostare su di lui il
lavoro di verifica, e lasciargli come unica difesa la fiducia.*

🚨⭐⭐ **IL LIMITE VERO, MISURATO IL 04/09 — e non è «quali ambienti», è «con quale utenza».**
🗣️ Sua domanda: *«devi fare i test sia in test che in prod prima di dirmi di guardare, era
un'ultima verifica?»* ⇒ **Sì: il suo sguardo è l'ULTIMA verifica, non il collaudo.** Ma va detto
per intero, perché il confine non passa dove sembra:
· la console remota entra come utenza **`readonly`** (scelta di sicurezza, vedi più sotto), e ogni
  gesto che **scrive** sbatte contro il gate `pmoBlockWriteIfReadonly` **prima** di partire;
· ⇒ posso provare **tutto ciò che si guarda e si calcola** — che una voce di menu non ci sia, che
  una scheda si apra piena, che un banner sia uno solo, che due bottoni non si tocchino, cosa
  risponde `elementFromPoint`, cosa scrive una funzione — **su TEST e su PROD**;
· ⛔ **non** posso attraversare fino in fondo un gesto che scrive davvero: premere «Salva» da
  owner, incassare, prenotare, togliere un giocatore. Quelli restano **suoi**, e non per
  abitudine: perché lo strumento non li fa, e perché su PROD scriverebbero sul **Matchpoint del
  circolo**.
⚖️ ⇒ Quando una prova si ferma lì, non si dice «provato»: si dice **cosa** è stato provato e
**dove si è fermata**, e il gesto si chiede a lui — come previsto dall'eccezione qui sopra.
📌 *Il confine non è fra TEST e PROD: è fra GUARDARE e SCRIVERE. Il primo è mio su tutti e due
gli ambienti, il secondo è suo su quello vero.*

### 🎯 LA SCHEDA SEGNALATA DA LUI È CAMPO LIBERO — tranne il salvataggio di un PAGAMENTO (FERMA, 04/09/2026)

🗣️ **Sue parole:**

> *«Dobbiamo mettere una regola che quando io ti segnalo una scheda dove tu puoi lavorare, tu lì
> hai campo libero per procedere in totale autonomia tranne sul salvataggio di un pagamento.»*

⇒ **Quando lui indica una scheda (una prenotazione, una partita, una lezione) come banco di
lavoro, su QUELLA scheda il confine «guardare/scrivere» qui sopra NON si applica**: si scrive
davvero, senza chiedere, anche su PROD. È lui che ha designato il bersaglio, ed è la designazione
a fare l'autorizzazione.

✅ **Cosa si può fare, su una scheda segnalata:** cambiare l'**importo a carico**, aggiungere e
togliere giocatori, spostarla, cambiarne durata, nota, descrizione, maestro — e premere **Salva**
fino in fondo, guardando cosa succede.

⛔⛔ **L'UNICA COSA CHE RESTA FUORI: SALVARE UN PAGAMENTO.** Cash · Card · Wallet — cioè
`matchpoint-payment-write` e la sua strada — e per simmetria lo **storno**
(`matchpoint-payment-void`), che è lo stesso libro letto al contrario.
⚖️ **Il perché, e va capito o la regola si applica male**: un incasso entra nella **cassa del
circolo**, e una riga di cassa non è una prova — è denaro che qualcuno dovrà quadrare a fine
serata. 🚨 **L'importo a carico invece NON è un pagamento** (voce 132: *«un importo a carico non è
un pagamento, e i due non stanno nello stesso libro»*): è **idempotente**, non genera nessun
`payment`, e la sezione Incassi non lo vede. È esattamente per questo che sta **dentro** il campo
libero e l'incasso **fuori**.

📌 *La riga non separa «scritture pericolose» da «scritture innocue»: separa ciò che si può
rifare da ciò che qualcuno deve contare.*

🔑 **CI VUOLE UN CANCELLO APERTO DA LUI, che è una cosa diversa dal permesso** — la regola dà il
**permesso**, il ruolo dà la **possibilità**, e servono tutte e due.
✅ **APERTO, e questa riga diceva il contrario fino al 05/09/2026.** Diceva *«l'utenza della
console ha `role: "readonly"`, quindi campo libero non si attraversa lo stesso»*: era vera il
04/09, e lui l'ha aperto dopo. 📏 Misurato il 05/09 sulla pagina viva di PROD, prima di toccare
qualunque cosa: `padelvillage.club+claude@gmail.com` ha **`role: "staff"`**, `cloud_sync: true`.
⭐ E l'ha aperto **giusto**: `staff` e non `admin`/`owner`, quindi la whitelist dei permessi è
rimasta **intera** — `manage_users`, `view_admin_utenti`, `view_members_anagrafica`,
`view_members_borsellino` restano tutti **no**. È esattamente la differenza scritta più sotto:
*si apre il cancello che serve, non la porta che sta accanto*.
🚨 **E il ruolo si MISURA, non si ricorda**: si legge `pmoStaffProfile.role`, mai
`pmoIsReadonlyStaff()` — quella torna `false` anche quando il profilo **non c'è affatto** (`!!p`),
quindi direbbe «posso scrivere» proprio nel caso in cui non si è nessuno.

### 👥 I CINQUE DESTINATARI DI CASA: i loro avvisi si possono far partire (FERMA, 05/09/2026)

🗣️ **Sue parole**, dopo che mi ero fermato davanti a due telefoni veri — e poi allargate da lui
nel giro di un minuto:

> *«Puoi utilizzare Lidia Comes e Fabiola Limuti tranquillamente perché sono persone di
> segreteria. Segnatela.»* · *«Come anche Marco Aprea e Laura Aprea.»* · *«Anche Maurizio
> Aprea.»*

⇒ **Sulla scheda che lui ha segnalato, i gesti che AVVISANO si provano fino in fondo** — anche
quelli che fanno arrivare un messaggio vero su un telefono vero, se il telefono è uno di questi:

| chi | `chat_id` |
|---|---|
| **Lidia Comes** | 8602768462 |
| **Fabiola Limuti** | 1110380688 |
| **Marco Aprea** | 6420557069 |
| **Laura Aprea** | 6759398557 |
| **Maurizio Aprea** (il committente stesso, detto da lui) | 1256773674 |

📌 **Sono TUTTA la rubrica di PROD** — misurato il 05/09: `telegram_rubrica` su `ayly…` ha
esattamente queste cinque persone con `tolto_il` nullo, e lui le ha nominate **tutte e cinque**,
in tre messaggi di fila. ⇒ **Oggi** la regola copre chiunque il bot possa raggiungere.
🚨 **E proprio per questo va guardata la TABELLA, non ricordata questa riga**: il giorno in cui
entra un socio vero la rubrica smette di essere «gente di casa», e questa riga — che oggi è vera
— diventerebbe il permesso di scrivere a uno sconosciuto. *Una lista che oggi coincide con
«tutti» non è «tutti»: è una lista che si allunga senza avvisare.*
🔎 Prima di far partire un avviso di prova: `select etichetta, chat_id from telegram_rubrica
where tolto_il is null` — se compare un nome che non è in tabella, quel nome è **fuori**.

📏 **Perché la domanda era nata, e perché era giusta farla** *(misurato il 05/09 prima di
scrivere)*: gli avvisi ai soci nascono da **cinque** gesti e solo cinque —
`aggiunto` · `tolto` · `annullata` · `spostata` · `formazione`
(`supabase/functions/matchpoint-bookings-sync/eventi-staff.ts`). ⇒ **nota, descrizione, durata e
importo a carico non fanno partire NIENTE**, e sono la strada per provare la catena senza
disturbare nessuno. E i destinatari qui sopra hanno **chat_id propri** (non il suo) e esiti
`passato_al_bot` recenti: i messaggi arrivano davvero, non finiscono nel vuoto.

⚖️ **Cosa NON diventa libero, e va tenuto distinto**: questa riga dice che **quelle persone** si
possono avvisare, non che gli avvisi ai soci siano diventati liberi. Verso **chiunque altro**
resta la regola di sempre — un messaggio che parte verso un socio è **irreversibile e si vede da
fuori**, quindi si dice prima. 📌 *Non è caduta la regola: è stato dichiarato che quei
destinatari stanno dentro casa.*
🩹 E la coda si guarda **prima e dopo** (`pmo_eventi_staff`, righe totali e `max(created_at)`):
è il modo di sapere se è partito qualcosa invece di crederlo.

🔄 **QUESTO CORREGGE LA RIGA QUI SOPRA, non la affianca.** *«Il secondo è suo su quello vero»*
resta vero **ovunque tranne che sulla scheda che lui ha segnalato**. Se un domani le due
sembrassero in contrasto, vale questa: è più recente e più stretta — vale su **una** scheda per
volta, non su tutte.


## 📋 Prima di iniziare: cosa c'è da fare → `docs/lavori/README.md`

**Apri quel file all'inizio di ogni sessione.** Contiene le tre liste — 🔴 urgenti, 📋 in coda,
📦 chiuse — più le memorie tematiche e lo stato del sistema misurato all'ultima sessione.

🚨 **Aprire quel file PRIMA di lavorare resta un obbligo, e non è cambiato.** La regola nasce dal
13/08/2026, quando una sessione partì senza quella lista e lavorò mezza giornata su cose scelte da
sé — utili, ma non le sue: il difetto era **non aver guardato**, e quello vale ancora identico.

🔄 **Ciò che è cambiato il 23/08/2026 sera: anche le PROMOZIONI dalla coda alle urgenti le può
decidere chi lavora.** Fino a quel giorno qui c'era scritto *«si propongono, non si eseguono»* —
riga **corretta, non affiancata**, perché il committente ha esteso la delega dicendolo per esteso
(*«sì, copre anche le promozioni»*, dopo *«procediamo sempre come tu pensi sia corretto»*).
⇒ Il permesso non si chiede più; **la dichiarazione sì**: una promozione si scrive nella lista con
il **perché** e con **cosa scavalca**, così lui la vede fatta e può ribaltarla. Vedi la sezione
*🤝 COME SI PROCEDE*.
⛔ Resta fuori una cosa sola, ed è l'unica: **inventare un lavoro che nella lista non c'è**. La
delega copre l'**ordine** delle voci, non la loro **esistenza** — una voce nuova nasce da una
misura o da una sua parola, mai da un'idea di fine giornata.

Il file si aggiorna **durante il lavoro**, come gli altri documenti: chiudendo una voce la si
sposta, e il commit resta nella storia.

## ⚠️ Le 4 app e dove si deploya ciascuna (leggere PRIMA di toccare qualcosa)

| app | repo | ramo → dove | backend |
|---|---|---|---|
| **Admin PROD** (staff) | `padel-match-organizer` | `main` → Pages `app.padelvillage.club` | Supabase `qqbfphyslczzkxoncgex` |
| **Admin TEST** | `padel-match-organizer` | `test-preview` → **`test.padelvillage.club`**, il cui caricatore sta in un repo a parte (sotto) | Supabase `cudiqnrrlbyqryrtaprd` |
| **Bot Telegram soci** `@loziocoach_bot` | `assistente-padel-agent` (**privato**) | nessun deploy automatico: gira in **pm2 sulla VM Hetzner** (`/opt/assistente-padel-agent`, Node 24 in `/opt/node24`) | ponti edge su `qqbf…` + memoria e whitelist su `aylykijfirtegyxzdwgu` |
| **Emulatore** | `chat-giocatori-emulatore` | `main` → Pages | nessuno (solo localStorage) |

🖥️ **Il COMPUTE di PROD è MICRO dal 05/09/2026** (1 GB di RAM, 2 core), free upgrade fatto dal
committente alle 14:03 di quel giorno. Prima era **NANO** (0,5 GB), ed è la ragione per cui un
eccesso di scritture è diventato un **blocco totale** di otto ore (voce 160): letture da 30-40 s,
login impossibile, sync fermo. La causa cronica era il sync che riscriveva **437 righe invariate
ogni 2 minuti** — 62 GB di WAL per un database da 685 MB — curata lo stesso giorno (PR #1382) e
**dimostrata** nel pomeriggio: 1-2 aggiornamenti per giro. 📏 Con 2.800 soci, il bot e tre sync
1 GB resta tirato: **SMALL** (2 GB, ~15 $/mese) è la scelta che evita di ritrovarsi lì, ed è una
decisione di **costo**, quindi sua — sta fra le decisioni in testa a `docs/lavori/README.md`.
🚨⭐ **E la lezione operativa, pagata quella mattina con tre tentativi andati a vuoto: un
ripristino in `finally` protegge dall'ECCEZIONE, non dal TEMPO.** Un gettone scaduto durante un
giro lungo fa partire il ripristino **a vuoto**, e i tentativi successivi li uccidono i **propri**
timeout (700 s, 1500 s, 420 s), non il database. ⇒ Su PROD ogni giro di scrittura va **corto e
separato**, con il gettone ripreso **prima di ogni chiamata** — e le console remote aperte si
chiudono quando non servono, perché il polling del semaforo ogni 4 s (voce 162) pesa proprio
quando il database rallenta.

⛔ **La web app dei soci (`soci.padelvillage.club`) è DISMESSA dal 25/07/2026**, per decisione del
committente dopo che il bot Telegram è andato in servizio: Pages spento, repo `padel-match-assistant`
tornato **privato**, record DNS `soci` eliminato, e le due edge di login (`consumer-auth-start`,
`consumer-auth-verify`) **cancellate** da `ayly…`. Il canale verso i soci è ora **il bot**.
⚠️ **I 3 ponti edge sul gestionale restano vivi**: sono il motore che il bot usa, non appartenevano
alla web app. Copia di sicurezza (storico completo del repo + sorgenti delle due edge) **fuori dai
repo**, in `~/Desktop/APP desktop/_dismissione-soci-20260725/`.

Admin PROD e Admin TEST sono **file diversi su rami diversi** dello stesso repo: non è un
ambiente che "punta" a due database, sono due copie dell'app.

**Il caricatore di TEST vive in un 5° repo**: `padel-match-organizer-test` (public):
`index.html` (il caricatore), **`app.html` (COPIA generata dell'app — non si tocca a mano)**,
`app-meta.json`, `config-test.js`, `CNAME` e il workflow `sync-app.yml`.
⚠️ **L'app di TEST NON si modifica lì**: si lavora su `test-preview` di questo repo.
🔄 **Dal 17/08/2026 (voce 58) il caricatore NON scarica più l'app da `raw.githubusercontent.com`**
— GitHub strozzava quei download anonimi (429 anti-scraping) e TEST restava a terra — ma serve
`./app.html` dalla propria origine Pages; `raw` è solo il ripiego. Un push su `test-preview`
arriva live **in una trentina di secondi**, perché il secret `TEST_LOADER_SYNC_TOKEN` **ORA
C'È**: il workflow `sync-test-loader.yml` parte col push e sveglia il caricatore via
`repository_dispatch`, senza aspettare nessuno schedule.
🔄 **Corretto il 24/08/2026, e qui c'era scritto il contrario.** Fino a quel giorno questo
paragrafo diceva che quel secret **mancava** e che TEST arrivava live col cron di `sync-app.yml`
in **24-48 minuti**. 📏 Misurato due volte quella notte, su due spinte diverse: commit 22:42:06
→ `synced_at` 22:42:39 (**33 s**), e commit 22:53:28 → `synced_at` 22:53:48 (**20 s**). Il workflow risulta
**success** in Actions.
⚖️ La riga vecchia non era sbagliata quando fu scritta: era vera al 18/08, e il committente ha
creato il PAT dopo. È il caso tipico della 26ª — *un limite dichiarato che nessuno riprova resta
vero per sempre perché sembra prudente* — e infatti per sei giorni ogni sessione ha pianificato
attese che non servivano più. **Quale commit è live lo dice `app-meta.json`**, ed è quello che si
guarda invece di credere a questa riga: `source_sha` e `synced_at`.
⚠️ Il cron di `sync-app.yml` **resta come rete di sicurezza** (ogni 10′, eseguito «quando può»),
e resta la via a mano — lanciare `sync-app` da Actions — se un giorno il dispatch non partisse. Quale commit è live lo dice
`app-meta.json` su quel repo. `config-test.js` sta anche là perché l'app cerca la configurazione
nella **radice del dominio da cui è servita**: senza, TEST non saprebbe a quale database collegarsi.

🚨 **TEST è riconosciuto in DUE modi indipendenti** (dalla v6.112/6.113) — `PMO_FORCE_ENV`
dichiarato dal caricatore, **e** l'hostname che inizia per `test.` (`pmoIsTestHostname`, usata
da `pmoDetectRuntimeEnv`, `pmoDetectPublicBaseUrl` e dal gemello `isTestEnv` del modulo
WhatsApp). Ridondanti di proposito: se salta uno, l'altro evita che l'app di TEST parli col
Supabase di **PRODUZIONE** e scriva sul **Matchpoint vero**. Toccando quelle funzioni,
cambiarle **tutte e tre**.

**Il vecchio `app.padelvillage.club/test/` è un rimando** (v6.114), non è più l'app: serviva
sulla stessa origine di PROD e le due si dividevano la quota di `localStorage` (~2-3 MB
ciascuna contro un tetto di 5-10 MB) — causa di fondo del guasto del 20/07. Il resto di
`/test/` è invece **vivo e si usa dal percorso**: `handle-test.html` (rete di regressione),
`parser-test.html`, `autovalutazione.html`, `config-test.js`.

**Worker** (`tools/matchpoint-browser-worker/src/server.mjs`): **UN solo processo** su Hetzner,
**condiviso TEST+PROD**, deploy **solo da `main`** (`deploy-worker-hetzner.yml`). Il `server.mjs`
di `test-preview` **non gira MAI**. Provare il worker da TEST significa già usare quello di
PROD e scrivere sul **Matchpoint vero**: TEST non è una sandbox. Quello che lo trattiene è la
simulazione gated `PMO_IS_TEST_ENV` (`PMO_BOOKINGS_SIMULATE`), non l'indirizzo — motivo per cui
il riconoscimento dell'ambiente è un fatto di **sicurezza**, non di configurazione.

**Edge functions**, tre destinazioni diverse dallo stesso repo:

- `supabase/functions/**` → `qqbf…` da `main`, `cudi…` da `test-preview`
- `consumer-app/edge-functions/**` → `ayly…` da `main` (`deploy-edge-functions-consumer.yml`).
  ⚠️ **Dal 25/07 su `ayly…` non vive più nessuna di queste funzioni** (erano il login della web app
  dismessa): i sorgenti restano in git, quindi **toccare quella cartella le RICREEREBBE** al primo
  push su `main`. Se un domani servono davvero, si rimettono con un `workflow_dispatch` esplicito.
- `supabase/functions/_archive/**` → **nessuna destinazione**: cartelle con `_` iniziale sono
  saltate dai workflow. Ci stanno i sorgenti conservati ma non deployati (vedi il README lì dentro).

Spostare una cartella tra le prime due la manda **sul progetto sbagliato**.

⚠️ **`consumer-app/web/` è una copia morta**, e lo era già prima della dismissione: il frontend
vivo stava in `padel-match-assistant`. Non è il punto da cui ripartire per una futura app dei soci.

⚠️ **`consumer-identity-lookup` è rimasta orfana** (non rotta): la chiamava `consumer-auth-start`
del login soci, cancellata il 25/07. Resta viva di proposito — costa nulla ed è l'unico pezzo che
sa riconoscere un socio **dal telefono**, cosa che il bot non può fare (Telegram non consegna il
numero). È in **sola lettura** (`.select()` e nulla più) e fallisce chiusa senza
`CONSUMER_BRIDGE_SECRET` (503 `BRIDGE_DISARMED`): non può sporcare il gestionale. Dal 19/07 sta
anche su `cudi…`, così il contratto del ponte — che vive sui due lati e va cambiato insieme — si
prova senza toccare la produzione; la copia su TEST nasce disarmata.

⚠️ **`cudi…` NON è una sandbox di dati finti**: ha gli **stessi soci veri** di PROD (2811
contro 2774 al 19/07), perché entrambi sincronizzano dallo stesso Matchpoint. Spostarsi su
TEST cambia dove finiscono le **scritture**, non rende anonime le letture.

🧊 **E il CALENDARIO di TEST è una FOTOGRAFIA, non un dato vivo — per scelta, dal 14/08/2026.**
Le prenotazioni (`booking`, `booking_occupancy`, `booking_history`) su `cudi…` **non le aggiorna
nessun cron**, e non è mai successo: le righe `data_routine_dispatch_bookings_live_*` sono **0** in
tutta la storia di quel database, contro **1575** su `qqbf…`. Quello che c'è è l'ultimo import
lanciato **a mano** — al 14/08 fermo al **7 agosto**.
🔄 **Ricontrollato il 16/08, e il «7 agosto» non vale più**: i giri a mano sono continuati — dei
**108** istanti di sync distinti di sempre, **3 sono nelle ultime 48 ore** (15/08 21:45, 16/08 03:30,
16/08 15:30). ⇒ Oggi TEST mostra **un'ora e mezza fa**, non nove giorni fa. ⚖️ L'avvertimento qui
sotto **regge intero** — nessun cron lo tiene fresco e i buchi vanno da ore a giorni — ma la cifra
del ritardo **non si può ricordare**: si misura, `max(synced_at)` sulle righe prenotazione.
L'anagrafica invece è viva
(`anagrafica-mirror`, 05:00) e i pagamenti pure: **è solo il calendario a essere fermo**, ed è
esattamente ciò che rende l'inganno credibile.

🔎 **E il PERCHÉ di quello zero, misurato il 19/08 — non è «nessuno ha acceso il cron».** Su `cudi…`
la funzione `pmo_dispatch_data_routines` è la versione **VECCHIA**: il ramo `bookings_live` — quello
che su PROD manda il sync ogni 2 minuti — **lì dentro non c'è proprio**, e il suo `else` finale si
limita a tornare `dispatched: false`. ⇒ Il dispatcher di TEST sa chiedere **solo** le routine a orario
fisso (clienti, storico, backup): le prenotazioni **non sa nemmeno chiederle**. Le righe sono zero
perché non possono esistere, non perché un interruttore è giù.
⚖️ Cambia cosa costa riaccenderlo: non è un `update` su una tabella di schedulazione, è **portare su
TEST la funzione di PROD** — e quella, come dice il paragrafo qui sotto, è la versione *continua*.
📌 Si legge senza credere a questo file: `select prosrc from pg_proc where proname =
'pmo_dispatch_data_routines'` sul progetto di TEST.

🚨⭐⭐ **E UNA PRENOTAZIONE FATTA DAL BOT SU TEST NON SOPRAVVIVE A UN SYNC.** *(19/08/2026, pagata
con una prenotazione di prova del committente.)* Su TEST le scritture verso Matchpoint sono
**simulate**, quindi quella prenotazione esiste **solo** come copia locale (`staff_booking`); il
sync riconcilia contro il Matchpoint **vero**, non la trova, e la **tomba** — passati i 120 secondi
di grazia (`STAFF_RECONCILE_GRACE_MS`).
⚖️ ⇒ Su TEST quella prenotazione **non può in nessun modo** arrivare a un roster leggibile, ed è un
vicolo chiuso, non un ritardo: **senza** sync manca `descrizione` (l'elenco ordinato nasce **solo**
da lì, `rosterFromPayload` chiude con `scheda: daScheda`) e il bot dice *«Non riesco a leggere chi
c'è in campo adesso»*; **con** il sync la riga sparisce. Lanciare il sync per «sbloccarla» la
cancella — consiglio dato e sbagliato il 19/08.
⇒ Per esercitare i bottoni di gestione su TEST si usa una partita **arrivata dal sync**, cioè vera
su Matchpoint, in cui il socio compare. Le prenotazioni nate dal bot servono a provare la
**scrittura**, non la **rilettura**.

🚨 **Non provare su TEST nulla che dipenda da prenotazioni aggiornate**: una disdetta non arriva, un
giocatore tolto non sparisce, una partita nuova del circolo non compare. La prova non fallisce —
**riesce mostrando il passato**, che è peggio. Ha già prodotto due danni: la voce 26 aperta come
guasto del bot quando il bot era sano, e il 14/08 una scheda che chiamava «riga di prova» una
partita vera del circolo, a un passo dal farla cancellare.

⚖️ **Perché congelato e non riacceso.** Il motore c'è (`matchpoint-bookings-sync` è ACTIVE anche su
TEST) e riaccenderlo costerebbe poco — la funzione lì è quella a slot fissi, ~12 dispatch al giorno
contro i ~720 di PROD sul **worker condiviso**. Non si è fatto perché accendere quel dispatcher
resuscita anche i **6 sync clienti** ritirati il 3/08, e la prima giornata va guardata nei log del
worker su Hetzner. ⇒ È un lavoro **dal Mac**, in coda come voce **A-lite**, non una riga di SQL.
📌 Se un domani si riaccende: **non** copiare la funzione di PROD, che è quella *continua*. Su TEST
cinque rinfreschi al giorno sono freschezza; il ritmo di PROD è parità, ed è la parità a costare.

🔄 **L'ANTEPRIMA DEL BOT ESISTE — e qui stava scritto il contrario** *(corretta il 16/08/2026)*.
Sulla VM ci sono **DUE bot**, token diversi e cartelle diverse: `assistente-telegram` (i soci) e
`assistente-telegram-prova`, che con `--verso-test` legge il gestionale di TEST e **ci scrive
davvero**. Lo dicono due file che si leggono senza entrare sulla VM — la mappa dei bersagli di
`deploy-bot-hetzner.yml` e `src/telegram/avvio-prova.ts`.
⚖️ La frase vecchia sopravviveva a **quindici righe** dalla scheda della VM che il bot di prova lo
**elenca**: due affermazioni vere in due momenti diversi, lasciate a contraddirsi nello stesso file.
⇒ Quando una scheda nuova smentisce una riga vecchia, la riga vecchia **si corregge**, non si
affianca — o il file smette di essere una fonte e diventa un archivio di versioni.

⛔ **Ciò che non ha anteprima è il bot dei SOCI**: quello è **un solo processo** sulla VM, e per
provarlo si sposta il suo `.env` fra TEST e PROD. 🚨⭐⭐ **Le righe sono TRE, non due**:
`PMO_FUNCTIONS_URL`, `CONSUMER_BRIDGE_SECRET_FILE` e **`PMO_PRENOTAZIONI_SIMULA=1`** — e la terza
si mette **prima** delle altre due. Verso TEST è l'**indirizzo** a far simulare le scritture,
quindi là la terza riga non serve e **può mancare del tutto** (il 28/07 sulla VM non c'era, mentre
nel `.env` del Mac sì: due file con lo stesso nome, uno solo protetto). Chi ne sposta **due** porta
il bot su PROD **senza** la simulazione, e da quel momento prenota, disdice e fa uscire i giocatori
**per davvero** dal sistema del circolo. 🚨 **Una sola istanza per volta**: due processi in long polling
sullo stesso token si rubano i messaggi e Telegram risponde **409** — quindi mentre gira sulla VM
non si lancia il bot sul Mac.

## 🖥️ LA VM HETZNER: dove sta cosa, e come ci si entra

**Misurato il 16/08/2026**, cercandolo — e non stava in nessun posto utile: l'indirizzo era sepolto
in una scheda di collaudo (`docs/collaudo-voce-23-caduta-worker.md`), e la procedura per aggiornare
il bot **non esisteva affatto**. Un'ora di caccia, scritta qui perché non ricapiti.

```
ssh -i ~/.ssh/padel_deploy root@91.99.131.243        # hostname: padel-matchpoint-bot-prod
```

La chiave sta **sul Mac**, è etichettata `deploy-padel-village`, ed è la stessa che usa GitHub
Actions (`SSH_DEPLOY_KEY`). Node 24 in `/opt/node24`.

| cartella | processo pm2 | cos'è |
|---|---|---|
| `/opt/matchpoint-worker` | `matchpoint-worker` | il worker, **condiviso TEST+PROD** |
| `/opt/assistente-padel-agent` | `assistente-telegram` | 👥 **il bot dei SOCI** (PROD) |
| `/opt/assistente-padel-agent-prova` | `assistente-telegram-prova` | 🧪 il bot di prova (`--verso-test`) |
| `/opt/sentinella-freschezza-test` | ⛔ **non è pm2** — timer systemd | 🕰️ la sentinella della voce 59/C (sotto) |

⚠️ In `pm2 list` compaiono anche `shadow-backend` e `shadow-backend-st…`: sono **fermi**, non
riaccenderli per sbaglio. E i **due bot in `online` insieme sono normali**: token diversi, cartelle
diverse — non è la doppia istanza che darebbe 409.

🚨 **E `pm2 list` NON vede tutto ciò che gira sulla VM.** Dal 17/08 c'è anche la **sentinella della
freschezza di TEST** (voce 59/C), che è un `systemd` **oneshot** svegliato da un timer ogni 15′ — e
non compare in `pm2 list` né in `ps` fra un giro e l'altro, perché fra un giro e l'altro **non
esiste**. Si guarda così:
```
systemctl list-timers sentinella-freschezza-test.timer
journalctl -u sentinella-freschezza-test.service -n 50
cat /opt/sentinella-freschezza-test/stato.json
```
⚖️ Sta fuori da pm2 **di proposito**: sorveglia la sincronia dell'app di TEST, quindi non deve
dipendere da nulla che possa cadere insieme a ciò che guarda. Sorgente e deploy in questo repo
(`tools/sentinella-freschezza-test/`, `deploy-sentinella-hetzner.yml`).
🔑 **La sua voce sono due secret di questo repo** — `TELEGRAM_SENTINELLA_TOKEN` (il bot di **prova**)
e `TELEGRAM_SENTINELLA_CHAT_ID` — che il deploy scrive nel `.env` sulla VM: quel file **non sta in
git** e il deploy **non lo cancella mai**. Se la voce manca gira **disarmata**, lo scrive nel
registro, e il deploy esce **giallo** (in attesa), non rosso: rosso è solo *ho una voce e non ha
funzionato*.
🚨 **Con quale bot parla lo dice lei**, chiedendolo a Telegram (`getMe`) invece di dedurlo dal file
da cui ha preso il token: sono due cose diverse, e il 18/08 la differenza è costata tre giri.
⚠️ Se un domani il secret sparisce **non ammutolisce**: ripiega sul token di un bot già sulla VM —
prima il **prova**, poi i **soci** — e lo dichiara. Quel prestito è sicuro perché il **409** di
Telegram riguarda il *long polling*, non l'invio, e la sentinella non chiama **mai** `getUpdates`.

🚨 **Le due cartelle del bot NON sono repository git**, e la VM **non può parlare con GitHub**
(nessuna chiave privata in `/root/.ssh/`, `git config --global` vuoto, `git ls-remote` chiede
l'utente). ⇒ Non si aggiorna con `git pull`: si usa **`deploy-bot-hetzner.yml`** nel repo del bot —
`workflow_dispatch`, bersaglio `prova` (predefinito) o `soci`, e per i soci va **scritta la parola
`SOCI`**. Nessun `--delete`: `.env`, le fotografie `.env.prima-*`, `node_modules` e `_prove/`
restano intatti.

⛔ **Dalla SHELL di una sessione cloud la VM non si raggiunge**: esce solo la **443**; la **22** e
la **2222** sono bloccate, e installare `ssh` nel container **non serve** — la porta è chiusa a
monte.

✅⭐⭐ **MA GITHUB ACTIONS SULLA VM CI ENTRA, E CI LANCIA COMANDI QUALUNQUE.** Questa è la strada
per fare dal cloud tutto ciò che vuole la VM, e va usata invece di rinunciare.
🗣️ L'ha rimessa in discussione il committente il **16/08/2026** — *«adesso il deploy github
possiamo farlo, quindi non so se il fatto della SSH sulla VM ti serve»* — mentre gli scrivevo che
il collaudo voleva le sue mani. Aveva ragione: qui c'era scritto «dal cloud la VM NON si
raggiunge», che è vero **della shell** e **falso di Actions**.
⚖️ È la 26ª un'altra volta — *un limite dichiarato che nessuno prova resta vero per sempre perché
sembra prudente* — nella forma peggiore: **mezzo vero**. La metà giusta lo rendeva credibile, e
nessuno andava a cercare l'altra.

🧰 **Gli attrezzi che ci passano, tutti in `assistente-padel-agent/.github/workflows/`** (stanno lì
e non qui per velocità, non per merito — il worker è di questo repo):

| workflow | cosa fa | pericolo |
|---|---|---|
| `deploy-bot-hetzner.yml` | aggiorna il bot (`prova` o `soci`) | serve la parola `SOCI` per quello vero |
| `stato-bot.yml` | 🔎 **legge** `pm2 describe` e il registro del bot, con una regex a scelta | nessuno: sola lettura |
| `cancello-worker.yml` | ferma/riaccende **Caddy**, cioè la porta del worker | 🚨 il worker è **condiviso con PROD**, e mentre è giù si ferma anche il **sync** |

🚨 Il cancello si chiude per un numero di secondi **dichiarato** (tetto 300) e si riapre **da sé**
in un passo `always()`: è l'unico vantaggio vero sulla manovra a mano, dove un `ssh` che cade fra
lo stop e lo start lascia il worker giù **senza che nessuno lo sappia**.

⇒ Resta fuori portata solo **entrare** sulla VM con una shell interattiva. Per quello, o dal Mac,
o si scrive un workflow che faccia la cosa che serve.

⭐ **Il bot DICHIARA all'avvio dove punta**, ed è l'unico modo di saperlo con certezza:
`✍️ prenotazioni REALI` (gestionale vero) · `🧪 GESTIONALE DI PROVA` (scrive, ma il circolo non si
tocca) · `🧪 prenotazioni SIMULATE` (non parte nessuna scrittura). Il `.env` non lo tocca il deploy:
un aggiornamento lascia il bot **dov'era puntato**.

## 🧭 DOVE si lavora: il CLOUD o il MAC (regola del committente, 17/08/2026)

🗣️ Sua domanda: *«che differenza c'è per lavorare sul cloud di Claude e sul mio computer?
Possiamo scegliere una delle due strade per sempre?»* ⇒ **No, e la regola è questa:**

> **CLOUD** per tutto ciò che passa da **git, Actions, edge, database e bot**.
> **MAC** quando serve **guardare con i propri occhi**: aprire l'app in un browser, o misurare
> come la vede chi la usa.

| | Mac | cloud |
|---|---|---|
| i file e i repo locali | ✅ | ❌ |
| **aprire l'app in un browser** e guardarla | ✅ | ❌ |
| misurare **come la vede un socio** (stessa rete) | ✅ | ❌ |
| git, PR, edge, database, bot | ✅ | ✅ **uguale** |
| entrare sulla **VM** | dipende dalla chiave (sopra) | ✅ **via Actions** |
| dipende dal computer acceso e dal TCC di macOS | 🔴 sì | ✅ no |

⭐ **Perché la regola non è arbitraria, ed è misurato il 17/08**: il collaudo del caricatore di
TEST si poteva fare **solo dal Mac**, e proprio guardandolo nel browser sono usciti **due difetti
che rileggendo non si vedevano** — che la copia, una volta aperta, è indistinguibile da TEST vero,
e che la catena del link del quiz era di **quattro salti** e non di uno.

🚨⭐⭐ **E IL ROVESCIO, che è la cosa nuova e va saputa: dal MAC certe misure NON SANNO RISPONDERE.**
Girando sul Mac, i `curl` dell'agente escono **dallo stesso indirizzo di rete del committente**.
Il 17/08 ho misurato *«`raw` dà 429 anche su `torvalds/linux`»* e ne ho concluso «GitHub è in
avaria» — ma quella sonda **non poteva distinguere** fra *GitHub è giù per tutti* e *la nostra rete
è bloccata*. A dirlo con certezza sono state due prove che **non passano da qui**: il log di un
deploy (che gira sui computer di GitHub) e **`githubstatus.com`**, che è un altro host.
⚖️ ⇒ *Una misura fatta dal Mac parla della rete del committente; per parlare del mondo serve una
sonda che stia altrove.* È la 24ª — la sonda che guarda nel cassetto sbagliato — nella forma in cui
il cassetto sbagliato è **la propria posizione**.

## 🧭 IL BOT NON È AUTONOMO: tutto quello che sa, glielo dice il GESTIONALE (FERMA)

**Regola di architettura fissata dal committente il 16/08/2026**, e vale **anche e soprattutto per
il futuro prossimo in cui Matchpoint si chiude**:

> *«Il bot legge tutto quanto dal gestionale. Non è autonomo. È il gestionale che dà le informazioni
> di qualsiasi azione che avvenga al bot. E il bot che le riceve dal gestionale e poi le scrive
> al socio.»*

🔒🔒 **RIBADITA E RESA PIÙ STRETTA il 19/08/2026, e da qui in poi è FERREA — parole sue:**

> *«ti ricordo che il bot deve prendere solo ordini dal gestionale non da Matchpoint, anche perché
> a breve dismettiamo Matchpoint. Quindi TUTTE le operazioni devono essere confermate sul
> gestionale e così poi il bot le riporta al socio.»*
> *«Il worker il bot non deve proprio filarselo, perché il worker è il tramite fra la nostra
> webapp (gestionale) e Matchpoint.»*

⇒ **Le tre parti, e nessuna è un dettaglio:**
① il bot parla **solo** col gestionale — mai con Matchpoint, mai col worker;
② un'operazione è andata a buon fine **quando lo dice il gestionale**, non quando lo dice il worker;
③ il **worker non esiste**, per il bot: è un affare interno fra gestionale e Matchpoint, e il bot
non deve conoscerne né l'indirizzo, né lo stato, **né il nome**.

📏 **Misurato il 19/08 prima di scriverlo, perché una regola non si dichiara sulla fiducia**: nel
codice del bot ci sono **zero** riferimenti a worker/Matchpoint/Hetzner fuori dai commenti, e il
ponte chiama **quattro** edge, tutte `consumer-*` del gestionale (`consumer-booking-write`,
`consumer-player-readmodel`, `consumer-assessment-link`, `consumer-assessment-decision`).
⇒ ①  e ③ **reggono già** nella struttura. Il **vocabolario** allora non reggeva — ⚠️ e qui c'era
scritto al presente che non regge, per quindici giorni dopo che era stato curato: vedi sotto.

✅⭐ **LA VIOLAZIONE È STATA CURATA — e questa riga diceva il contrario fino al 03/09/2026.**
Il difetto c'era, ed era grosso: il 19/08 alle 18:53 il registro del bot scrisse
`[griglia] rifiutata (worker_error)` — il gestionale rispondeva al bot **col nome di un suo pezzo
interno**, e il bot lo girava al socio come un **rifiuto**. Sbagliato due volte: rompeva ③ (il bot
sente parlare del worker) e ②, che è la metà che costa — *«non ho prenotato»* detto sulla parola
del worker **può essere falso**, perché un worker che non risponde non vuol dire che Matchpoint
non abbia scritto; e se era passata, il socio che riprova occupa il campo **due volte**.

📏 **Misurato il 03/09 prima di correggere la riga**, non dedotto: la guardia esiste, si chiama
`NOMI_INTERNI` (`supabase/functions/consumer-booking-write/esito-scrittura.ts:336`) e blocca
`worker|matchpoint|hetzner|playwright|caddy|nip.io|browser|https?://` **prima** che il testo esca
verso il bot. **Fallisce CHIUSA**: al minimo sospetto non ritaglia il pezzo colpevole, sostituisce
tutto il dettaglio con *«il circolo non ha dato un motivo comprensibile»* — perché ritagliare
lascerebbe in piedi la metà che nessuno ha pensato di cercare. È applicata su **otto** uscite di
`index.ts`, e il terzo verdetto (`esito_ignoto`) è in servizio: le tre parole che il bot può
sentire sono `fatto` · `scrittura_rifiutata` · `esito_ignoto`.

⚖️ **La riga vecchia è stata CORRETTA, non affiancata** — diceva *«curarlo è un lavoro dichiarato,
non ancora fatto»*, ed era vera il 19/08. Il lavoro è stato fatto dopo, e per **quindici giorni**
questo file ha continuato a dichiarare come aperto un difetto chiuso.
📌 *È la 26ª nel suo verso meno sospetto: di solito è un **limite** dichiarato che nessuno riprova;
qui era un **difetto** dichiarato che nessuno riprova. Fa lo stesso danno — pianificare un lavoro
già fatto — e si nasconde meglio, perché una riga che denuncia un proprio difetto non sembra mai
una riga da controllare.*

⛔ **Come si applica, quando si scrive codice:**
· nelle risposte delle edge verso il bot **non compaiono** `worker`, `matchpoint`, `browser`,
  `hetzner` né i loro codici d'errore: si traducono in verdetti del **gestionale**
  (`fatto` · `rifiutato con un motivo che il socio capisce` · `non lo so`);
· il bot non aggiunge un secondo indirizzo a cui chiedere: se il gestionale non sa, la risposta è
  **«non lo so ancora»**, mai una supposizione;
· 🎯 **la prova del futuro**: il giorno in cui Matchpoint si spegne, il bot **non si tocca**. Se una
  riga del bot dovesse cambiare quel giorno, quella riga è già sbagliata oggi.

⇒ La divisione dei compiti è **una sola riga**, e non ha eccezioni: **il gestionale SA, il bot
DICE.** Il bot non calcola una verità per conto suo, non tiene un archivio parallelo, non deduce da
ciò che ha detto prima. Chiede, riceve, e traduce in italiano per il socio.

🎯 **Perché è una regola e non un'abitudine**: è la stessa scelta già presa in tre punti, che così
smettono di sembrare casi isolati e diventano un disegno —
① `puo_prenotare`: il bot non vede il codice Matchpoint, **chiede al ponte** un sì/no
(*«il giorno del distacco questa riga diventa `true` per tutti e a valle non cambia nient'altro»*);
② `livello-dimostrato`: la regola sta nel **ponte**, non nel bot, perché un livello annunciato in
rubrica e negato nella scheda sarebbe la stessa persona con due verità;
③ i **ruoli** dentro una partita: il ponte porta il **dato** (l'elenco ordinato), la regola di chi
ha organizzato la applica chi la mostra — mai una terza copia.

⚖️ **Cosa comporta il giorno in cui Matchpoint non c'è più.** Il worker
(`tools/matchpoint-browser-worker/`) **muore con lui**: i suoi 21 endpoint sono tutti automazione
del browser su Matchpoint, e senza Matchpoint non gli resta niente da fare. ⇒ Se il bot dipendesse
dal **worker**, quel giorno andrebbe riscritto. Dipendendo dal **gestionale**, quel giorno non si
tocca: cambia solo da dove il gestionale prende i suoi dati.

🚨 **La prova pratica, e serve subito, non nel futuro**: quando il bot **non sa** com'è andata una
scrittura, la risposta non è indovinare né arrendersi — è **tornare a chiedere al gestionale**.
Oggi il socio lo fa a mano (*«fra qualche minuto chiedimi cosa ho prenotato»*, `esito_ignoto`);
farlo fare al bot da sé è la **voce 53**.

⚠️ **Il limite di oggi, dichiarato**: sulle prenotazioni il gestionale non è ancora la **fonte** —
è uno **specchio** alimentato dal sync da Matchpoint, quindi con un ritardo. Per «com'è andata» va
benissimo (non serve saperlo in due secondi, serve non mentire); per una risposta **istantanea** no.
📏 **Il ritardo è stato MISURATO il 16/08** (📄 `docs/voce-53-ritardo-sync.md`): mediana **~2 minuti**
— che è il cron da 2 minuti — e massimo **10′04″** su 43 creazioni nell'assetto attuale.

🚨 **E la stessa misura ha smentito ciò che stava scritto qui: il sync PASSA dal worker**
(`matchpoint-bookings-sync` chiama `/export-booking-history`). ⇒ **Worker giù = copia congelata**, e
i due guasti arrivano insieme: la notte del 15/08 il sync ha registrato
`MATCHPOINT_BROWSER_WORKER_FAILED` alle 22:28:02, un minuto dopo la scrittura delle 22:27:16 rimasta
ignota. ⚖️ Il vantaggio del bot sull'app **resta** ed è un altro: una **copia risponde sempre**,
anche a worker morto, mentre la cura dell'app chiama il worker dal vivo e a worker morto non ottiene
niente. Ma la risposta può essere **vecchia** ⇒ **l'assenza dalla copia non prova l'assenza dal
circolo**, proprio nel caso per cui la cura serve.
⇒ **Il «no» si dice solo con la freschezza certificata dal gestionale** — un sync atterrato *dopo*
la scrittura — altrimenti la risposta onesta è «non lo so ancora». È *il gestionale SA, il bot DICE*
applicato alla freschezza: quanto sia fresca la copia **solo il gestionale** può saperlo.

🌙 **E il sync ha una PAUSA NOTTURNA: 01:00-06:00 (Europe/Rome)** *(misurato il 16/08 — non stava in
nessun documento)*. Sta scritto nello scheduler
(`supabase/manual-sql/supabase_pmo_data_routines_scheduler_prod.sql`), e i dati concordano: ultimo
tick 22:58 UTC, ripresa 04:02 UTC. Clienti, storico e backup girano anche lì dentro — **sono solo le
prenotazioni future a fermarsi**. ⇒ In quella finestra ogni attesa scade senza verdetto, e la
risposta è «non lo so ancora». ⚖️ **La sicurezza regge intera** — un «no» falso lì **non può uscire**,
perché la certificazione di freschezza non arriva — quindi si perde l'**utilità**, non la **verità**.
🚨 E la trappola della sonda, che è il pezzo da ricordare: il registro dei dispatch nasce
`status: 'dispatched'` e **non viene mai riscritto con l'esito** ⇒ **da lì i guasti del worker non si
contano**, e chi ne cercasse le righe `error` otterrebbe **zero** con la stessa sicurezza con cui
otterrebbe la verità. La diagnostica sta in un record `_last`, che ne tiene **una sola**.

## 🔁 CHI CONFERMA, CHI REGISTRA, CHI PARLA — l'ordine dei tre passi (FERMA, 22/08/2026)

🗣️ **Disegnata dal committente**, la sera in cui la voce 75 ha mostrato cosa costa sbagliare
l'ordine. Sta qui e non fra i lavori perché non è un difetto da curare: è la forma che ogni gesto
deve avere, oggi e dopo Matchpoint.

> **Ogni gesto va detto al socio SOLO DOPO che il circolo l'ha confermato — e nello STESSO ISTANTE
> dev'essere registrato dal gestionale.**

⇒ Sono **due** metà che governano due momenti diversi, e si confondono facilmente:

| | governa | se si sbaglia |
|---|---|---|
| **solo dopo** | il **parlare** | un rifiuto di Matchpoint lascia dei soci avvisati di una cosa mai successa |
| **stesso istante** | il **registrare** | il socio legge «fatto» e un attimo dopo il gestionale non sa di cosa parli |

🚨⭐⭐ **E LA CORREZIONE CHE HA DATO LUI, che vale più della regola stessa perché è quella che si
sbaglia disegnandola:** l'ok di Matchpoint **torna al gestionale e si ferma lì**. Non prosegue verso
il bot in nessuno dei due versi — né quando il gesto parte dalla segreteria, né quando parte dal
socio. A parlare col socio è **sempre e solo il gestionale**.
⚖️ Non è pignoleria di disegno: se Matchpoint rispondesse al bot, il giorno in cui lo si spegne il
bot andrebbe riscritto. È la stessa ragione della regola qui sopra — *il bot non deve filarsi il
worker* — vista dal verso del ritorno invece che dell'andata.

```
① gesto dalla SEGRETERIA
   Segreteria → Gestionale → worker → Matchpoint
                    ↑                      │
                    └──────── ok ──────────┘   (si ferma qui)
                    │
                    └──→ Socio · bot          (solo adesso: avviso)

② gesto dal SOCIO
   Socio·bot → Gestionale → worker → Matchpoint
                    ↑                      │
                    └──────── ok ──────────┘   (si ferma qui)
                    ├──→ ① copia locale        (registra: la partita, da noi)
                    └──→ ② Socio · bot         (risponde)

   ⛔ Socio·bot ⇠⇢ worker / Matchpoint : MAI, in nessuno dei due versi.
```

📌 **`①` e `②` del secondo schema non sono due momenti: sono lo stesso.** Registrare e rispondere
partono insieme dalla conferma. È esattamente il punto in cui la voce 75 si era rotta — il bot
diceva «✅ Prenotato» alle 20:58:32 e alle 20:58:57 il gestionale non trovava quella partita, perché
la ② era partita senza la ①.

🎯 **La prova che tiene onesta la regola, e si può applicare oggi a ogni riga nuova**: *il giorno in
cui Matchpoint si spegne, il bot non si tocca.* Se una modifica al bot dovesse cambiare quel giorno,
quella modifica è già sbagliata adesso.

⏳ **Cosa NON è ancora vero, misurato il 22/08 e da non dare per fatto:** la metà «stesso istante»
vale per la **creazione** (voce 75, in servizio da quella sera) ma **non per l'annullo** — un annullo
dal bot non chiude la copia locale, che se n'è andata col sync **3′40″ dopo**. In quella finestra su
Matchpoint il campo era libero e da noi risultava occupato. Gli altri gesti (entrare, uscire,
togliere) **non sono stati misurati**: darli per buoni sarebbe prendere un esito visto una volta per
una regola.

### 🔔 E CHI dev'essere avvisato: TUTTI quelli in campo (FERMA, 23/08/2026)

🗣️ **Regola sua**, data dopo aver visto uno spostamento arrivargli come un annullo, due volte:

> *«Quando la segreteria fa un qualsiasi tipo di operazione, le persone che sono dentro la partita
> devono essere avvisate.»* · *«Gli avvisi se devono arrivare devono arrivare **corretti fino in
> fondo**.»* · *«Logicamente questa regola vale anche per una lezione.»*

⇒ **Nessuno si salta.** Fino al 23/08 il primo dell'elenco veniva escluso in quanto «organizzatore»:
su una partita di quattro si perdeva un avviso su quattro, su una di **una persona sola** si perdeva
l'unico — e la segreteria che prenota a un socio solo non gliel'ha **mai** annunciato.

⚖️ **A non annunciare al socio ciò che ha fatto LUI pensa la RICEVUTA** (voce 70), non il salto. La
differenza è tutta qui: il salto rispondeva a *«chi è il primo dell'elenco?»*, la ricevuta a *«chi ha
chiesto la scrittura?»* — e le due divergono esattamente dove il salto sbagliava. 📌 *Una protezione
che poggia su una convenzione si sostituisce con una che poggia su un fatto, non si toglie.*

🚨 **«Corretti fino in fondo» vuol dire anche non dire il falso**: uno spostamento non è un annullo.
Il gesto `spostata` esiste per questo, e porta con sé **da dove** — le coordinate del fatto sono
quelle di **arrivo**, perché è lì che si va a giocare.
⛔ Ma chi è stato **tolto** durante uno spostamento riceve le coordinate **vecchie** e nessun «da»:
del posto nuovo non deve sapere niente, o lo si manda a giocare a una partita che non è più sua.

🚨⭐ **L'ORDINE DI MESSA IN SERVIZIO, quando nasce un gesto nuovo** — misurato, non supposto:
`ponte.ts` **scarta i gesti che non conosce**. ⇒ Prima il **bot** (che da solo è inerte: impara una
parola che nessuno gli manda), poi la **migrazione** del `CHECK`, poi il **gestionale**. Al
contrario, per la finestra fra i due deploy quel fatto non lo direbbe **nessuno** — peggio di un
messaggio sbagliato.

## 🤝 COME SI PROCEDE: la delega del committente (FERMA, 23/08/2026 sera)

🗣️ Sue parole, date la sera in cui la voce 77 è stata ritirata, curata e rimessa in servizio nel
giro di due ore — prima *«Proveremo sempre come tu pensi sia corretto»*, poi corretta lui stesso
in **larghezza**:

> *«Procediamo sempre come tu pensi sia corretto per la buona riuscita del progetto.»*

⇒ **Non si chiede il permesso per ogni passo.** Il metodo, l'ordine dei lavori dentro una voce, come
si prova una cura e quando la si mette in servizio: decide chi lavora. Chiedere conferma a ogni
gesto non è prudenza — è **scaricare la decisione su di lui** e rallentare tutto.

🔄 **E COPRE ANCHE LE PROMOZIONI**, chiesto e risposto la sera stessa: qui era stato scritto che
restavano sue — *«una delega sul come non cancella una regola sul cosa»* — e lui ha risposto
**«sì, copre anche le promozioni»**. ⇒ La riga vecchia è stata **corretta in testa al file**, non
lasciata accanto alla nuova.
⚖️ **Il freno che sostituisce il permesso è la DICHIARAZIONE**: una promozione si scrive nella
lista col **perché** e con **cosa scavalca**. Lui la trova fatta, non da approvare — e può
ribaltarla, che è possibile solo se la trova **scritta**.

⛔ **COSA LA DELEGA NON TOCCA — due cose, ed è tutto:**
· **inventare un lavoro che nella lista non c'è**: la delega copre l'**ordine** delle voci, non la
  loro **esistenza**. Una voce nuova nasce da una misura o da una sua parola, mai da un'idea;
· ciò che è **irreversibile o si vede da fuori** (una scrittura vera sul Matchpoint del circolo, un
  messaggio che parte verso i soci, `--allow-writes` su PROD) si **dice prima**, anche procedendo.

✅ **COSA LA RENDE SICURA — tre obblighi che stanno in piedi al posto del permesso:**
① **ogni cura si dichiara per quello che ha provato E per quello che NON ha provato.** Una guardia
   testuale si dice testuale; un banco verde non è un messaggio arrivato a qualcuno;
② **si misura invece di dedurre**, e quando la misura smentisce ciò che era scritto qui, si
   **corregge la riga vecchia** invece di affiancarla;
③ 🚨⭐⭐ **se una prova che sta per fare LUI non proverebbe niente, lo si ferma PRIMA, non dopo.**
   È il caso da cui la delega nasce: il 23/08 alle 17:20 la cura della 77 era ancora commentata, e
   l'annullo che stava per fare sarebbe passato **senza esercitare niente**. Fermarlo cinque minuti
   è costato cinque minuti; scoprirlo dopo sarebbe costato la prenotazione, il gesto e la finestra.

📌 *Una delega larga non è il permesso di decidere in silenzio: è l'obbligo di decidere e di
dichiarare cosa si è deciso.*

### 📢 OGNI DEPLOY SU PROD SI ANNUNCIA (FERMA, 04/09/2026)

🗣️ Sua richiesta, data dopo che la 147 era già atterrata su PROD: *«Metti anche nelle regole, di
avvisarmi sempre quando è fatto un deploy su Prod.»*

> **Quando PROD serve una versione nuova, glielo si dice. Sempre, senza aspettare che lo chieda.**

⛔ **E l'avviso non è il merge della PR.** Fra il merge e il momento in cui il suo browser scarica
il file nuovo passano due cose che possono non succedere: il deploy di Pages, e la cache di PROD
(`max-age=600`). ⇒ Si annuncia **il fatto**, non l'intenzione: *PROD serve la 6.330*, misurato.

📏 **Come si misura, che è l'unica parte che si può sbagliare** — il numero da solo **non basta**,
perché con quella cache lo si può rileggere vecchio per dieci minuti:
```
curl -s -H 'Cache-Control: no-cache' "https://app.padelvillage.club/?cb=$(date +%s)" \
  | grep -o "APP_VERSION = '[0-9.]*'"
curl -sI https://app.padelvillage.club/ | grep -i last-modified
```
⭐ **Non si sta lì a guardare**: si lascia un `until` in background che esce quando il numero
cambia, e si avvisa quando esce. Aspettare a mano costa attenzione e si dimentica.

✅ **Cosa deve contenere l'avviso**, o è una notifica e non un'informazione:
· **quale numero** e **da che ora** (`last-modified`, non «adesso»);
· **cosa è pronto**, in modo che lui sappia su cosa può mettere le mani — 🔄 **e qui c'era scritto
  «cosa può rifare lui, il gesto esatto», corretto la sera stessa da lui**: *«Avvisami sempre quando
  io posso operare. Non mi dire di fare.»* ⇒ si apre il campo, non si assegna un compito. Vedi la
  sezione qui sotto;
· ⚠️ **cosa quel deploy NON ha provato**, che è l'obbligo ① della delega e non decade qui.

⚖️ **Perché è una regola e non una cortesia**: il postulato dice che la prova la faccio io e lui
**supervisiona**. Supervisionare vuol dire poter guardare — e non può guardare una cosa di cui non
sa che è arrivata. Un deploy silenzioso trasforma la supervisione in fiducia, che è esattamente
quello che il postulato ha sostituito.

📌 Vale per **PROD**. TEST arriva live in 20-30 s e si spinge molte volte al giorno: annunciarlo
ogni volta renderebbe rumore proprio l'avviso che deve farsi notare.

### 🚀 LA PROMOZIONE A PROD NON SI CHIEDE: È UNA CATENA DI QUATTRO PASSI (FERMA, 04/09/2026)

🗣️ Sue parole, dette due volte nello stesso minuto perché non restassero fraintese:

> *«Non mi devi chiedere il permesso per portare in prod, lo devi fare in automatico. Dopo che su
> test hai fatto tutti i test che funziona. Poi lo porti in prod in automatico, poi controlli in
> prod che funziona e poi mi avvisi quando è finito che io vado a controllare.»*

⇒ **Non è il permesso di saltare le prove: è l'ordine in cui vanno fatte, e sono QUATTRO passi.**
Fermarsi fra il ② e il ③ per chiedere è la cosa che lui ha appena tolto di mezzo.
📖 **Questa sezione è il DETTAGLIO del POSTULATO in testa al file, non una seconda regola**: là
stanno i cinque passi e la riga «il ③ non si chiede», qui cosa prova ciascun passo e dove arriva.
Se un domani divergessero, vale quello in testa — ed è il segno che una delle due va corretta,
non affiancata.

| | passo | cosa vuol dire |
|---|---|---|
| ① | **si prova su TEST** | banco intero verde, sintassi, e la cura **sabotata** — un banco che non cade non difende niente |
| ② | **si promuove a PROD** | senza chiedere: le **righe** su un ramo basato su `main`, PR, CI verde, merge |
| ③ | **si controlla su PROD** | che quello che è atterrato **faccia la cosa giusta**, sulla pagina viva |
| ④ | **si avvisa** | 🟢 «puoi operare», nella forma della sezione qui sotto |

🚨⭐⭐ **IL PASSO ③ È QUELLO CHE SI SALTA, ed è quello che dà senso al ②.** Un merge riuscito non è
un controllo: dice che il file è partito, non che l'app fa la cosa giusta. Il controllo si fa **con
la console remota, sulla pagina viva di PROD** — è dentro l'autonomia di lettura del 16/08, e non
si chiede.
⛔ **E si dichiara sempre dove arriva**: la console entra come **sola lettura**, quindi ciò che
richiede una **scrittura** (un incasso, una prenotazione, un cambio importo vero) **non lo può
esercitare**. ⇒ Il ③ prova ciò che si può **guardare e calcolare**; il resto è quello che lui va a
controllare al ④, e va scritto come *«non provato»*, non lasciato credere.

⛔ **COSA LA REGOLA NON COPRE, e non è cambiato**: ciò che è **irreversibile o si vede da fuori**
— una scrittura vera sul Matchpoint del circolo, un messaggio che parte verso i soci,
`--allow-writes` su PROD. Quello si **dice prima**, anche procedendo. La delega del 23/08 tiene
intera: qui si toglie il permesso sulla **promozione**, non sul gesto che tocca il mondo.
📌 *«Non chiedere» vale sul portare in produzione una cura provata, non sul premere un bottone che
qualcuno fuori da qui vedrà.*

⚖️ **Perché la catena non si accorcia.** Il ① senza il ③ è il verde che non ha mai guardato
l'ambiente vero; il ③ senza il ① è provare sull'ambiente del circolo. E senza il ④ i primi tre
sono successi in silenzio: lui **supervisiona**, e non può supervisionare ciò di cui non sa.
🩹 Il passo che manca più spesso è il ③, perché dopo il merge **sembra** finito: il numero da solo
non basta (`max-age=600`), e va guardato `last-modified` insieme alla versione.

### 🟢 «PUOI OPERARE» / 🔴 «NON SONO PRONTO» — l'avviso ha DUE stati (FERMA, 04/09/2026)

🗣️ Sue parole, date una dopo l'altra la sera in cui è nata la regola sul deploy:

> *«Metti anche una regola che mi avvisi quando le guardie sono verdi.»*
> *«Somma ci siamo capiti. Avvisami sempre quando io posso operare. Non mi dire di fare.»*
> *«Se non sei pronto [dillo].»*

⇒ **Non sono tre richieste: è una sola, detta tre volte più precisa.** Le guardie verdi erano
l'esempio; la cosa che vuole sapere è **quando il campo è libero per lui**.

> **A fine di ogni giro di lavoro si dice UNA delle due, mai nessuna:**
> 🟢 **«puoi operare»** — è tutto atterrato e non c'è niente di rosso in sospeso;
> 🔴 **«non sono pronto»** — con **cosa** manca, così l'attesa ha una fine visibile.

🚨⭐⭐ **E LA CORREZIONE CHE VALE PIÙ DELLA REGOLA — «NON MI DIRE DI FARE».** L'avviso **apre un
campo**, non assegna un compito: *«il cambio importo su PROD è pronto quando vuoi»*, non *«rifai il
cambio importo»*. La differenza non è di cortesia — è **di ruolo**: il postulato dice che la prova
la faccio io e lui **supervisiona**, e chi supervisiona decide **se e quando** guardare. Un avviso
scritto all'imperativo gli ribalta addosso una lista di cose da fare, che è esattamente ciò che il
postulato gli ha tolto dalle mani.
📌 *Si dichiara uno **stato del sistema**, non un'azione dell'altro.*

⛔ **PERCHÉ SONO DUE STATI E NON UNO SOLO**, ed è la metà che si dimentica: avvisare **solo** sul
verde rende il **silenzio ambiguo** — vorrebbe dire insieme *«è rosso»* e *«non ho ancora
guardato»*, e le due chiedono cose opposte (aspettare, o venire a controllare). ⇒ Il rosso si dice
**sempre**, anche quando è mio da curare: dirlo non è chiedergli di intervenire, è togliergli il
dubbio.

📏 **QUANDO si dice: una volta per GIRO, non per corsa.** Le guardie girano a ogni spinta e un giro
di lavoro ne fa molte: annunciarle una per una renderebbe rumore proprio l'avviso che deve farsi
notare — la stessa ragione per cui il deploy si annuncia per PROD e non per TEST.
🚨 **E si guarda la corsa dell'ULTIMO commit di OGNI ramo**, non l'ultima corsa del repo: la
finestra del punto 4bis lascia una rossa **transitoria** su `test-preview` mentre `main` è già
verde, e il ramo che resta indietro non rigira da sé. Se una guardia è rossa solo per quella
finestra, **la si rilancia** (`workflow_dispatch`) invece di aspettare il backstop delle 06:00 —
*una guardia che resta rossa si smette di leggere*, e non conta che il rosso sia vecchio di dieci
minuti o di un giorno.

✅ **Cosa contiene un 🟢 che serve davvero**: quale versione è viva **dove**, che le guardie sono
verdi **su tutti e due i rami**, e ⚠️ **cosa non è stato provato** — l'obbligo ① della delega non
decade qui: *«puoi operare»* dice che il campo è libero, non che è tutto dimostrato.

### ✋ UN TASK NON È FINITO FINCHÉ NON LO SI È PROVATO **FISICAMENTE** (FERMA, 23/08/2026 sera)

🗣️ Sue parole, la sera stessa della delega:

> *«Ricordiamoci sempre che ogni volta che un task è finito bisogna provarlo fisicamente, cioè
> praticamente o sul gestionale o sul bot.»*

⇒ **«Fatto» non è uno stato del codice: è uno stato di ciò che la gente usa.** Una voce si chiude
quando qualcuno ha visto la cosa succedere **sul gestionale** (aperto e guardato — dal Mac, o con la
console remota `tools/verifica-browser`) o **sul bot** (un gesto vero, un messaggio vero arrivato a
un telefono vero).

⛔ **COSA NON È UNA PROVA FISICA**, per quanto verde sia:
· il **banco** (prove unitarie, sabotaggi) — dice che il meccanismo è giusto, non che i messaggi
  arrivano;
· i **log puliti** e un deploy riuscito — dicono che gira, non che si vede;
· aver **letto il sorgente in servizio** — dice che è quello nuovo, non che fa la cosa giusta;
· 🚨 **uno zero letto troppo presto**: il 23/08 alle 15:57 i doppioni erano zero **perché il sync non
  aveva ancora avuto occasione di sbagliare**. Quello zero non diceva «funziona».

✅ **CHE FORMA HA UNA PROVA CHE VALE** — l'esempio migliore è la **voce 77**, la sera in cui la
regola è nata: la cura è stata vista **attraversare la finestra esatta in cui prima sbagliava**
(export scattato 48 secondi prima dell'annullo) e non sbagliare. ⇒ *Non «non è successo niente di
male», ma «è passato di lì e non è successo niente».*

⏳ **Se la prova fisica non si può fare adesso, il task resta APERTO e lo si dice.** Non si scrive
«fatto» con una riserva in fondo: la scheda dice **cosa manca per chiuderla**, e la voce resta nella
lista finché quella cosa non è successa. È già la forma delle voci **65** e **68**, che sono in
servizio da giorni e restano aperte apposta.

🧊 **E dove si prova, che non è ovvio**: su **TEST** il calendario è **congelato** e le scritture
verso Matchpoint sono **simulate** ⇒ per tutto ciò che riguarda prenotazioni, avvisi e roster la
prova fisica **è su PROD**.
🔄 **Corretto il 04/09/2026 dal POSTULATO in testa a questo file, e qui c'era scritto il
contrario**: *«spesso con un gesto suo ⇒ chiedergli il gesto fa parte del lavoro»*. ⇒ **La prova
su PROD la faccio IO** con la console remota; il gesto suo si chiede **solo** quando serve una
**scrittura vera** che non posso fare io (una prenotazione sul Matchpoint del circolo, un
messaggio ai soci). ⚖️ La riga vecchia non era sbagliata sui gesti che scrivono — era diventata
un'**abitudine generale**, e l'abitudine spostava su di lui la verifica di cose che potevo
guardare da solo.
⛔ Quando il gesto suo serve davvero, va chiesto quando la cura è **in servizio**, o la prova non
prova niente (23/08, ore 17:20: la cura della 77 era ancora commentata e il suo annullo sarebbe
passato a vuoto).

### 🧹 …E UNA VOCE PROVATA SI SPOSTA FRA LE CHIUSE **SUBITO** (FERMA, 04/09/2026 notte)

🗣️ Sue parole, guardando la lista delle urgenti: *«molti di questi task sono chiusi, però non sono
stati portati tra i task chiusi. Segnati questa regola. Così man mano la lista si va pulendo coi
lavori che chiudi.»*

⇒ **Chiudere una voce è un gesto in DUE metà, e la seconda non è burocrazia**: ① la cura è in
servizio e provata fisicamente, ② la voce **si sposta** fra le 📦 chiuse, con la data e con che
prova l'ha chiusa. Una voce che ha ① e non ② **resta a occupare la lista delle urgenti**, e la
lista smette di dire cosa c'è da fare.

⚖️ **Perché è la metà che si dimentica, e perché costa**: la lista delle urgenti è la prima cosa
che si apre a ogni sessione. Se dentro ci sono voci **già fatte**, chi arriva non lo sa — le
rilegge, le ripesa, e nel caso peggiore **le rifà**. È lo stesso difetto già scritto per le
richieste: *una richiesta che resta scritta dopo essere stata esaudita non è vecchia, **mente*** —
qui applicato al **lavoro** invece che alla domanda.

⛔ **Cosa NON conta come chiusa**, e resta apposta nella lista:
· in servizio ma **mai provata fisicamente** (⇒ vale la regola qui sopra: resta aperta e la scheda
  dice cosa manca);
· curata a **metà**, con un ramo del difetto mai percorso sul vivo;
· che **aspetta un caso** che non si può provocare (le voci 92 · 83 sono di questo tipo).

📌 «Aspetta il suo occhio» **non è** un motivo per restare aperta: dal postulato del 04/09 la prova
la fa chi lavora e lui **supervisiona** ⇒ la voce si chiude, e ciò che lui deve guardare si scrive
nell'avviso di fine sessione, non lasciando la voce a metà strada.

🩹 **E i conteggi si aggiornano nello stesso commit**: il numero è dichiarato in **due** posti (il
titolo della sezione **e** la tabella in cima), e `guard-docs-truth` li confronta **numero per
numero**. Correggerne uno solo lascia la guardia rossa.

## 🔒 Regola anti-disallineamento test↔prod (FERMA)

Il problema "il fix fatto in test non funziona in prod / si rompe un fix precedente" nasce dal drift dei branch.
Per evitarlo, SEMPRE:

1. **Modifiche al WORKER → si fanno da `main`** (branch da `main` → PR a `main`). **MAI** editare il
   `server.mjs` su `test-preview`.
2. **Dopo ogni deploy del worker**, riallinea `test-preview` a `main`:
   `git checkout test-preview && git checkout origin/main -- tools/matchpoint-browser-worker/src/server.mjs`
   poi commit + push (NON deploya). Obiettivo: i due branch hanno `server.mjs` **identico**.
3. **Promozioni dell'APP a PROD → solo le RIGHE del fix** da un branch basato su `main`
   (es. `git show <commit> -- index.html | git apply`), **mai** copiando l'intero `index.html` di `test-preview`
   (porterebbe in PROD scaffolding di test e modifiche non destinate alla prod). Niente codice gated
   `PMO_IS_TEST_ENV` in PROD. Bumpa `APP_VERSION` così il deploy è verificabile dal vivo.
4. Le PR verso `main` passano da `guard-main-prs.yml` (≤15 file, niente cancellazioni, mai dal branch `test-preview`).
4bis. 🔀 **ORDINE: prima `test-preview`, POI il merge su `main`.** *(14/08/2026)* Quando un lavoro
   tocca file sorvegliati — `docs/`, workflow, `CLAUDE.md`, `server.mjs` — i due rami restano
   diversi per il tempo che passa fra le due spinte, e `guard-worker-sync` confronta i rami **nel
   momento in cui gira**: chi arriva secondo trova l'altro indietro. Non è l'ordine a creare il
   problema, è una **corsa** — ma spingendo prima `test-preview` la rossa transitoria, quando
   capita, cade **là e non su `main`**, che è il ramo predefinito e quello che deve sembrare
   affidabile a colpo d'occhio.
   📌 Misurato il 14/08: stessa procedura, tre volte, esiti diversi — la #694 verde perché il
   riallineo era atterrato in tempo, la #695 e la #696 rosse perché no.
   ⚖️ La corsa è tolta **davvero** dal punto ⑥ qui sotto; questo punto è la metà cosmetica, e
   serve lo stesso: le due si sommano, non si sostituiscono.
5. **Anche `.github/workflows/**` e questo `CLAUDE.md` devono essere IDENTICI sui due rami.** Un fix
   alla CI fatto solo su `main` non protegge `test-preview`, da cui scatta `deploy-edge-functions-test.yml`
   (successo il 19/07: la lista `VERIFY_JWT_FUNCTIONS` della #538 stava solo su `main`).

6. ⏳ **La guardia è PAZIENTE, di proposito.** *(14/08/2026)* Alla prima divergenza
   `guard-worker-sync` **non fallisce**: aspetta 90 secondi, rilegge i ref e ricontrolla. Fallisce
   solo se il drift **persiste**. Serve a distinguere le due cose che prima si confondevano — la
   **finestra di transizione** fra il merge e il riallineo, che dura secondi ed è normale, e il
   **drift vero**, che è quello da fermare. 🚨 Non è un indebolimento: un drift reale resta rosso
   identico, con 90 secondi di ritardo. È una guardia che prima **sapeva solo urlare**, e urlava
   anche quando aveva torto — e una guardia che ha torto ogni tanto è una guardia che si smette
   di leggere, che è esattamente come si perde una protezione senza toglierla.

→ I punti 2 e 5 sono garantiti da **`guard-worker-sync.yml`**, che fallisce se i rami divergono
su worker, workflow, istruzioni **o `docs/`**. Ha anche un backstop giornaliero alle 06:00 UTC.

`docs/` è entrato nella guardia il **13/08/2026**: la #674 aveva curato i tre registri di versione
solo su `main`, e su `test-preview` `stato-progetto-corrente.md` continuava a dichiarare
«PROD | v5.527» (22/05) — intitolandosi «fonte rapida ufficiale» — mentre TEST girava a **6.222**.
⚠️ **Quella guardia vede se le due copie sono UGUALI, non se dicono il VERO**: due documenti identici
e sbagliati passano verdi. L'altra metà è **`guard-docs-truth.yml`** (13/08), che confronta il
**dichiarato** col **misurato**:

- la tabella «Versione corrente» di `docs/stato-progetto-corrente.md` deve riportare l'`APP_VERSION`
  vera dei due rami — **altrimenti fallisce**. Quel file promette in testa a sé stesso di essere
  corrente: se non lo è, non è vecchio, **mente**;
- i conteggi di `docs/lavori/README.md` devono corrispondere alle voci contate, **numero per numero**
  e non solo nella somma: il 13/08 la sezione C ne dichiarava 11 con 12 voci e la D 5 con 4, i due
  errori si **annullavano** e il totale tornava.

🔄⭐ **QUALE COPIA GIUDICA — corretto il 05/09/2026 sera, e qui c'era scritto il contrario.** Fino a
quel giorno `guard-docs-truth` leggeva i documenti **sempre da `origin/main`** mentre misurava le
versioni vere **sui due rami**: nella finestra del 4bis quelle due letture parlano di **due istanti
diversi**, e la guardia diventava **rossa per costruzione a ogni promozione**, senza rigirare da sé.
📏 **Misurate 9 promozioni fra il 04 e il 05/09**: lo scarto fra il momento in cui `test-preview`
dichiara la nuova PROD e il momento in cui `main` la gira davvero va da **-256 s a +120 s**, in
tutt'e due i versi. Non era un caso raro: era la **forma normale** di una promozione.
⇒ **Adesso si giudica la copia CHE È STATA SPINTA** (il ref che ha acceso il run), e su un push si
controlla **la riga del ramo che si è mosso** — un push su `test-preview` non si giudica sullo stato
in volo di `main`, né viceversa. Le due righe si controllano **insieme** sul backstop giornaliero e
su ogni lancio a mano, cioè quando non c'è niente in volo. In più la guardia è **paziente** come la
sorella: alla prima divergenza aspetta 90 secondi, rilegge i ref e ricontrolla.
⚖️ **Cosa NON si perde**: la malattia del 13/08 — 689 versioni di scarto — non dura due minuti, dura
**mesi**, e resta presa dal backstop il mattino dopo e dal push del ramo che mente appena si muove.
🚨 **E la stessa correzione ha chiuso un VERDE FALSO nell'altro job**: i conteggi si leggevano pure
loro da `origin/main`, quindi **un conteggio sbagliato spinto su `test-preview` passava verde** —
la guardia diceva «i conti tornano» e voleva dire «ho letto un altro documento». *(Sabotaggio
provato: sezione C dichiarata 17 con 18 voci ⇒ prima verde, adesso rossa.)*
📌 *Una guardia che ha torto a ogni promozione non è severa: è una guardia che si smette di leggere —
la stessa ragione per cui `guard-worker-sync` fu resa paziente il 14/08.*
⛔ **Cosa è stato provato e cosa no**: sei esercizi sul **meccanismo**, con l'origine finta montata
sull'istante vero del run 1128 — la finestra storica torna verde, la pazienza vista **rientrare** con
il merge atterrato durante i 90 s, e quattro sabotaggi visti rossi (riga TEST che mente, riga PROD
che mente, backstop che le controlla tutt'e due, conteggio sbagliato su `test-preview`). **Non è una
corsa CI vera**: la prima promozione che attraversa la finestra è la prova che manca.

⚖️ Di proposito **non** controlla gli sha né le PR aperte: un file che cita il proprio sha è vecchio
nell'istante in cui lo si salva, e una guardia sempre rossa si ignora. Le versioni dichiarate nella
**fotografia** `docs/lavori/README.md` danno solo un avviso, non un errore: è datata per natura.

🚨 **E la regola che ne discende — promossa dal committente il 15/08/2026, dopo che è costata due
correzioni di fila: nei documenti si scrivono i FATTI STABILI, non le misure che il documento stesso
muove.** Gli sha sono solo il caso ovvio. Vale per **qualunque conteggio di eventi che la spinta del
documento fa accadere**: esiti delle corse CI, «quante volte oggi la finestra del 4bis è caduta
rossa», il numero di PR aperte in un istante.

🔎 **La prova da farsi PRIMA di scrivere un numero**: *il commit che porta questa frase è uno degli
eventi che la frase conta?* Se sì la frase è **falsa prima di atterrare** — non invecchia, **nasce**
sbagliata, ed è più insidiosa di un errore qualunque perché ha la forma di una misura.

📏 **Misurato il 15/08, e sbagliato due volte di fila.** La fotografia diceva «la finestra del 4bis è
caduta rossa **una volta su due**»: il giro che ha portato quella riga sul ramo l'ha resa falsa
*mentre atterrava*. La correzione ha tolto quel numero e **ne ha scritto un altro** — «tre giri,
rossa verde rossa» — smentito dal giro dopo entro un minuto, dentro un paragrafo che due righe sotto
dichiarava «il conteggio NON si scrive qui, di proposito». ⚖️ **Curare l'istanza invece della classe
non è una cura**: e la seconda volta lo stesso difetto era anche in un **secondo punto** dello stesso
file, che non avevo cercato perché stavo correggendo quello che avevo appena scritto.
⇒ La cura è **cancellare il conteggio**, non aggiornarlo. Ciò che va tenuto è il fatto che non
dipende da quando lo si legge («è una corsa, non una regola»), più — se serve — il racconto
dell'episodio **chiuso**, che nessun giro futuro può smentire.

⛔ **Non si mette una guardia a controllarlo, ed è una scelta deliberata.** Dovrebbe capire che una
frase descrive corse CI di cui il commit che la trasporta fa parte: non è meccanizzabile, e una
guardia che ogni tanto ha torto è una guardia che si smette di leggere — la stessa ragione per cui
`guard-worker-sync` è stata resa paziente. Qui la protezione è la regola, e si applica **scrivendo**.

📌 Le due guardie sono **complementari e legate**: `guard-docs-truth` controlla una sola copia perché
`guard-worker-sync` garantisce che i rami siano identici — **la copia spinta**, dal 05/09 (sopra).
Si tolgono insieme o mai.

I rami di lavoro non vanno potati a mano: `cleanup-claude-branches.yml` cancella ogni notte
tutto tranne `main` e `test-preview`. Se ne vedi molti in locale è solo la tua copia stantia
dei ref remoti → `git fetch --prune`.

## Verifica
- Rete di regressione esecuzione staff: `test/handle-test.html` (servita da `.claude/launch.json` → `pmo-static`,
  porta 8123; apri `http://localhost:8123/test/handle-test.html`, leggi `window.__RESULTS__`). Mocka il worker.
- Worker condiviso: i log PROD sono su Hetzner (`~/.pm2/logs/matchpoint-worker-*.log`), pm2 `matchpoint-worker`.
- 🌐 **Console remota sul gestionale** (`tools/verifica-browser/`): apre `app.padelvillage.club`
  o `test.padelvillage.club` in Chromium, fa login come utente **di sola lettura** ed esegue uno
  snippet dentro la pagina — `node console.mjs --env test|prod --eval "return …"`. Serve a non
  dover più chiedere al committente «apri DevTools, incolla questo, dimmi cosa esce»:
  `page.evaluate()` **è** quella console. Girare lo stesso snippet di là e di qua *è* la diagnosi:
  uguale in entrambi → è il codice, diverso → sono i dati o l'ambiente.
  🔑⭐⭐ **DOVE STANNO LE CREDENZIALI, e perché la domanda torna ogni volta.** Non sono nel repo e
  non devono entrarci **mai**: vivono in **quattro variabili dell'ambiente cloud** —
  `PMO_VERIFY_EMAIL_TEST`/`PMO_VERIFY_PASSWORD_TEST` (TEST) e `PMO_VERIFY_EMAIL`/`PMO_VERIFY_PASSWORD`
  (PROD). Se ci sono, **ogni sessione nuova le ha già** e la console parte senza chiedere niente; se
  mancano, la console non fa login e **va chiesto al committente di riempire quella casella**, non
  di incollare la password in chat.
  🚨 **Una password incollata in chat è già bruciata**: resta nella conversazione, e se qualcuno la
  scrive in `CLAUDE.md`, in `docs/` o in uno script finisce **in git per sempre** — anche
  cancellandola dopo, perché la storia la conserva. Il README di `tools/verifica-browser` lo dice
  con parole sue: *«Credenziali in variabili d'ambiente, mai nel repo e mai in chat»*.
  🚨⭐⭐ **E QUESTA RIGA HA RETTO UNA RICHIESTA DIRETTA, il 04/09/2026.** Il committente ha incollato
  in chat le due utenze e ha scritto *«segnati nelle regole questi dati così sei autonomo»*. ⇒ **I
  valori NON sono stati scritti qui**, e non è disobbedienza: è la sua stessa regola applicata alla
  sua richiesta. Quello che gli serviva — l'autonomia — si ottiene **senza** metterli in git, e sta
  qui sotto come **procedura**.
  ⚖️ Il motivo, in una riga: una password nel repo la vedono tutti quelli che vedono il repo, per
  sempre; una password in una variabile la vede solo chi lancia il comando. *Scrivere un segreto in
  un posto sbagliato è irreversibile, e l'irreversibile in questo progetto si dice prima.*
  ⛔ **E quando una password è passata per la chat, va CAMBIATA** — non c'è modo di ritirarla.

  📍 **LA PROCEDURA, che è ciò che rende autonomi davvero** *(scritta il 04/09/2026)*:
  · gli indirizzi: **PROD** `https://app.padelvillage.club/` · **TEST** `https://test.padelvillage.club/`
    — sono già dentro `console.mjs`, si scelgono con `--env prod|test` e non si scrivono a mano;
  · l'utenza è **la stessa sui due ambienti** (l'email del circolo), e le password stanno nelle
    **quattro variabili** qui sopra;
  · se l'ambiente cloud non le ha, si scrivono in un file **fuori dal repo** — nella cartella di
    lavoro temporanea della sessione, mai dentro `padel-match-organizer/` — e si caricano con
    `set -a; . quel-file; set +a` prima di lanciare la console. 🚨 **Mai sulla riga di comando**:
    lì la password la legge chiunque guardi la lista dei processi.
  📏 **Provato il 04/09**: con le variabili riempite così, la console su PROD riporta `login: "ok"`.
  ⚠️ **E `login: ok` NON vuol dire «posso scrivere»**, che è la trappola misurata quel giorno: la
  guardia dell'attrezzo resta armata (`scritture: "bloccate"`) e ferma anche le **letture** verso
  `/functions/v1/`, cioè quelle del roster. ⇒ Con quella guardia su, una scheda si apre **senza
  giocatori**, e chi non lo sa lo scambia per un difetto dell'app.
  🩹 **E `pmoIsReadonlyStaff()` a `false` non vuol dire «sono owner»**: quella funzione torna `false`
  anche quando il profilo **non c'è affatto** (`!!p`). Una sonda che la usa per dire «posso
  scrivere» dice il falso proprio nel caso in cui non si è nessuno. 📌 *Una funzione che risponde
  «no» a due domande diverse non risponde a nessuna delle due.*
  ⚖️ **E l'utenza giusta è quella di SOLA LETTURA, non l'owner.** L'attrezzo è disegnato per un
  ruolo `readonly`, e la 22ª ha già misurato che quel ruolo **vede le prenotazioni tutte** — quindi
  per diagnosticare basta. Con l'owner ogni svista su PROD costa molto di più, e l'unica protezione
  che resta è la guardia dell'attrezzo (che è brava, ma è **una** guardia invece di due).
  📌 Vuole l'ambiente cloud configurato — allowlist dei 6 domini, le `PMO_VERIFY_*`, e lo script
  che importa la CA del proxy nel magazzino NSS di Chromium. Il README lì dentro ha l'elenco e le
  **tre trappole del container**: senza quelle correzioni il sintomo è «il sito non risponde»
  mentre `curl` funziona benissimo, ed è una mezza giornata buttata a cercarlo nell'app.
  ✅⭐ **SI USA IN AUTONOMIA, non si chiede il permesso ogni volta, e vale SU TUTTI E DUE GLI
  AMBIENTI** — autorizzazione del committente del **16/08/2026**: *«quando ti serve puoi andarla a
  leggere, sia in test che in prod»*.
  ⇒ Davanti a una domanda sull'app viva — «cosa mostra davvero il calendario?», «questa funzione c'è
  su `window`?», «di là e di qua rispondono uguale?» — la strada è **aprirla e guardare**, non
  scrivere «da qui non si può» né girare la domanda a lui.
  ⭐ **PROD compresa, ed è detto apposta**: è l'ambiente su cui verrebbe più spontaneo chiedere, ed
  è anche quello dove sta la verità che serve — i dati veri, i soci veri, il difetto che il socio
  vede davvero. Una console autorizzata solo su TEST avrebbe lasciato fuori metà delle diagnosi,
  visto che il calendario di TEST è **congelato** e mostra il passato.
  ⚖️ È la cura della 26ª messa in regola: un limite dichiarato che nessuno ha provato resta vero per
  sempre, perché sembra prudente e nessuno lo ricontrolla. Chiedere il permesso per ogni lettura
  produceva esattamente quelle rinunce.
  🚨 **L'autonomia copre le LETTURE, non `--allow-writes`**: quel flag resta a domanda, e su PROD a
  maggior ragione. La divisione non è mia — è la stessa che l'attrezzo fa da sé mettendo le
  scritture dietro un interruttore esplicito.
  🔄 **Con UNA eccezione, dal 04/09/2026: la scheda che lui ha segnalato come banco di lavoro.**
  Là il flag si usa senza chiedere — vedi *🎯 LA SCHEDA SEGNALATA DA LUI È CAMPO LIBERO* in testa
  al file. Resta fuori il **salvataggio di un pagamento**, sempre e ovunque.

  🔑⭐⭐ **I TRE CANCELLI FRA LA CONSOLE E UN «SALVA» CHE ARRIVA IN FONDO** — misurati il
  04/09/2026 uno per uno, perché sono **indipendenti** e aprirne due su tre non serve a niente:

  | | cancello | dove sta | stato al 04/09 |
  |---|---|---|---|
  | ① | **il RUOLO dell'utenza** — `pmoBlockWriteIfReadonly` ferma `staffCalPlayersSave` alla prima riga se `role === 'readonly'` | riga del profilo staff, tabella utenti del gestionale | 🔴 **`readonly`** — l'unico che serve LUI |
  | ② | **il PERMESSO** `cloud_sync`, che serve alle edge | stessa riga, campo `permissions` | 🟢 **già `true`** |
  | ③ | **la guardia dell'ATTREZZO**, che blocca tutto `/functions/v1/` | `--allow-writes` di `console.mjs` | 🟢 **mio** — provato: `scritture: "CONSENTITE"` |

  ⇒ **Ne manca uno solo, ed è una parola in un campo.** In *Impostazioni → Utenti Staff*, sulla riga
  dell'utenza della console, il ruolo va da **Solo lettura** a **Staff**.
  ⛔⛔ **NON a «Admin» né a «Proprietario», ed è la parte che conta**: quei due ruoli
  **scavalcano l'intera whitelist** dei permessi (`if (['owner','admin'].includes(role)) return
  true`), quindi aprirebbero anche gestione utenti, incassi, anagrafica, borsellino — tutto ciò
  che oggi è spuntato **no**. **Staff** invece lascia la whitelist al suo posto: resta esattamente
  `cloud_sync` + `view_dashboard`, cioè quello che l'utenza ha già.
  📌 *Si apre il cancello che serve, non la porta che sta accanto.*
  ⚠️ E va detto per intero: `staff` toglie il freno a **tutte** le scritture della scheda, non solo
  a quella segnalata. La cosa che tiene stretto il perimetro **non è più il ruolo, è la regola** —
  si scrive solo sulla scheda che lui ha indicato, e mai un pagamento.
  🩹 Se un domani si volesse restringerlo davvero nel codice, il posto è `pmoIsReadonlyStaff`, che
  oggi guarda **solo il ruolo** e non i permessi: un `role: 'readonly'` con un permesso di
  scrittura spuntato resterebbe bloccato lo stesso. È una scelta che sta in piedi, ma è quella che
  rende impossibile un «readonly che può fare una cosa sola».
  🚨 **Di default non scrive**: bloccati PATCH/PUT/DELETE, gli insert e **tutto `/functions/v1/`**,
  che è la strada verso il worker condiviso e quindi verso il **Matchpoint vero**. `--allow-writes`
  disarma la guardia, e su PROD vuol dire scrivere sul serio.
  ⚠️ Non sostituisce l'operatore quando il sintomo nasce dallo stato accumulato nel **suo** browser:
  qui la pagina parte sempre pulita. `--storage-in` rimedia, ma vuole un export fatto sul posto.
- Una funzione può essere **viva su Supabase senza sorgente in git**: ogni tanto incrocia
  `list_edge_functions` con `ls supabase/functions/` su entrambi i progetti.
