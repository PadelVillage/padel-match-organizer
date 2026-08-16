# Padel Match Organizer — istruzioni di progetto

## 📋 Prima di iniziare: cosa c'è da fare → `docs/lavori/README.md`

**Apri quel file all'inizio di ogni sessione.** Contiene le tre liste — 🔴 urgenti, 📋 in coda,
📦 chiuse — più le memorie tematiche e lo stato del sistema misurato all'ultima sessione.

🚨 **Non scegliere da solo su cosa lavorare.** Le priorità stanno lì, e le **promozioni dalla coda
alle urgenti le decide il committente**: si propongono, non si eseguono. La regola nasce dal
13/08/2026, quando una sessione partì senza quella lista e lavorò mezza giornata su cose scelte
da sé — utili, ma non le sue.

Il file si aggiorna **durante il lavoro**, come gli altri documenti: chiudendo una voce la si
sposta, e il commit resta nella storia.

## ⚠️ Le 4 app e dove si deploya ciascuna (leggere PRIMA di toccare qualcosa)

| app | repo | ramo → dove | backend |
|---|---|---|---|
| **Admin PROD** (staff) | `padel-match-organizer` | `main` → Pages `app.padelvillage.club` | Supabase `qqbfphyslczzkxoncgex` |
| **Admin TEST** | `padel-match-organizer` | `test-preview` → **`test.padelvillage.club`**, il cui caricatore sta in un repo a parte (sotto) | Supabase `cudiqnrrlbyqryrtaprd` |
| **Bot Telegram soci** `@loziocoach_bot` | `assistente-padel-agent` (**privato**) | nessun deploy automatico: gira in **pm2 sulla VM Hetzner** (`/opt/assistente-padel-agent`, Node 24 in `/opt/node24`) | ponti edge su `qqbf…` + memoria e whitelist su `aylykijfirtegyxzdwgu` |
| **Emulatore** | `chat-giocatori-emulatore` | `main` → Pages | nessuno (solo localStorage) |

⛔ **La web app dei soci (`soci.padelvillage.club`) è DISMESSA dal 25/07/2026**, per decisione del
committente dopo che il bot Telegram è andato in servizio: Pages spento, repo `padel-match-assistant`
tornato **privato**, record DNS `soci` eliminato, e le due edge di login (`consumer-auth-start`,
`consumer-auth-verify`) **cancellate** da `ayly…`. Il canale verso i soci è ora **il bot**.
⚠️ **I 3 ponti edge sul gestionale restano vivi**: sono il motore che il bot usa, non appartenevano
alla web app. Copia di sicurezza (storico completo del repo + sorgenti delle due edge) **fuori dai
repo**, in `~/Desktop/APP desktop/_dismissione-soci-20260725/`.

Admin PROD e Admin TEST sono **file diversi su rami diversi** dello stesso repo: non è un
ambiente che "punta" a due database, sono due copie dell'app.

**Il caricatore di TEST vive in un 5° repo**: `padel-match-organizer-test` (public), che
contiene solo `index.html` (scarica l'app da `test-preview`), `config-test.js` e `CNAME`.
⚠️ **L'app di TEST NON si modifica lì**: si lavora su `test-preview` di questo repo, e ogni
push è **subito live** (nessun workflow: il caricatore prende l'ultimo commit del ramo).
`config-test.js` sta anche là perché l'app cerca la configurazione nella **radice del dominio
da cui è servita**: senza, TEST non saprebbe a quale database collegarsi.

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
lanciato **a mano** — al 14/08 fermo al **7 agosto**. L'anagrafica invece è viva
(`anagrafica-mirror`, 05:00) e i pagamenti pure: **è solo il calendario a essere fermo**, ed è
esattamente ciò che rende l'inganno credibile.

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

Anche il **bot Telegram non ha anteprima né sandbox**: è **un solo processo** sulla VM, e per
provarlo si sposta il suo `.env` fra TEST e PROD. 🚨⭐⭐ **Le righe sono TRE, non due**:
`PMO_FUNCTIONS_URL`, `CONSUMER_BRIDGE_SECRET_FILE` e **`PMO_PRENOTAZIONI_SIMULA=1`** — e la terza
si mette **prima** delle altre due. Verso TEST è l'**indirizzo** a far simulare le scritture,
quindi là la terza riga non serve e **può mancare del tutto** (il 28/07 sulla VM non c'era, mentre
nel `.env` del Mac sì: due file con lo stesso nome, uno solo protetto). Chi ne sposta **due** porta
il bot su PROD **senza** la simulazione, e da quel momento prenota, disdice e fa uscire i giocatori
**per davvero** dal sistema del circolo. 🚨 **Una sola istanza per volta**: due processi in long polling
sullo stesso token si rubano i messaggi e Telegram risponde **409** — quindi mentre gira sulla VM
non si lancia il bot sul Mac.

## 🧭 IL BOT NON È AUTONOMO: tutto quello che sa, glielo dice il GESTIONALE (FERMA)

**Regola di architettura fissata dal committente il 16/08/2026**, e vale **anche e soprattutto per
il futuro prossimo in cui Matchpoint si chiude**:

> *«Il bot legge tutto quanto dal gestionale. Non è autonomo. È il gestionale che dà le informazioni
> di qualsiasi azione che avvenga al bot. E il bot che le riceve dal gestionale e poi le scrive
> al socio.»*

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
📌 Il ritardo peggiore di quel sync **non è mai stato misurato**, ed è il numero che serve prima di
scrivere la 53: quanto il bot deve aspettare prima di poter dire «no» senza sbagliare.

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
`guard-worker-sync` garantisce che i rami siano identici. Si tolgono insieme o mai.

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
  🚨 **Di default non scrive**: bloccati PATCH/PUT/DELETE, gli insert e **tutto `/functions/v1/`**,
  che è la strada verso il worker condiviso e quindi verso il **Matchpoint vero**. `--allow-writes`
  disarma la guardia, e su PROD vuol dire scrivere sul serio.
  ⚠️ Non sostituisce l'operatore quando il sintomo nasce dallo stato accumulato nel **suo** browser:
  qui la pagina parte sempre pulita. `--storage-in` rimedia, ma vuole un export fatto sul posto.
- Una funzione può essere **viva su Supabase senza sorgente in git**: ogni tanto incrocia
  `list_edge_functions` con `ls supabase/functions/` su entrambi i progetti.
