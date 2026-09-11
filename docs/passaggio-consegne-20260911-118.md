# Passaggio di consegne — 11/09/2026 (118ª sessione)

> **Prompt da incollare nella chat nuova.** Copia tutto quello che sta fra le due righe.
> *(Sostituisce le versioni precedenti, compresa quella della 117ª.)*

---

## 📋 PROMPT

> Riprendi il progetto **PADEL MATCH ORGANIZER**.
>
> Leggi PRIMA, in quest'ordine: **`CLAUDE.md`** (il postulato in testa — e **il blocco sul
> CONGELAMENTO DI PROD**, che sospende i passi ③ e ④), **`docs/lavori/README.md`**, e questo file.
>
> ### 🚨 PRIMA DI CREDERE A QUALUNQUE CONFRONTO
>
> **① Il checkout nasce stantio e shallow, e `git status` dice «allineato» MENTENDO.**
> ⇒ `git fetch --unshallow origin && git fetch origin main test-preview && git reset --hard origin/test-preview`
> 📏 **Successo di nuovo, per la settima sessione di fila**: stanotte il checkout è partito su un
> commit vecchio con `git status` pulito, e la copia di `CLAUDE.md` arrivata nel prompt di sistema
> aveva **11 sezioni invece di 12** — mancavano *il congelamento di PROD* e *«il gestionale di TEST
> diventa il vero»*, cioè le due che cambiano come si legge tutto il resto.
> ⇒ **Rileggi `CLAUDE.md` dal disco** (`grep -c '^## ' CLAUDE.md`): le sezioni sono **12**.
>
> **② Controlla su quale ramo sei PRIMA di ogni modifica** — `git rev-parse --abbrev-ref HEAD`.
> 🚨 Non è più solo un consiglio: **stanotte è costato**, vedi la lezione ② qui sotto.
>
> ---
>
> ## 🥇🚨 LA COSA PIÙ IMPORTANTE DA PORTARSI DIETRO
>
> **⭐⭐ UN EFFETTO GIUSTO OTTENUTO DA UNA PREMESSA FALSA NON È UNA CURA: È LA STESSA SCOMMESSA DI
> PRIMA, VINTA UNA VOLTA.** E la trova **solo il gesto**, mai la rilettura.
>
> Curando la voce 210 ho scritto la nota «richiesta sostituita» dentro
> `p.msg.querySelector(':scope > div:last-child')`, **credendo** che l'ultimo figlio fosse la riga
> della domanda. Sulla pagina viva l'effetto era **perfetto**: la domanda restava, i bottoni
> sparivano, il banco era verde.
> 📏 Poi ho guardato la struttura vera del messaggio: i figli sono **tre** — `.svc-msg-label` · la
> riga della domanda · **`.svc-step-buttons`**. ⇒ L'ultimo figlio erano **i bottoni**, e la nota ci
> finiva dentro. Funzionava **per coincidenza**.
>
> ⛔ **E il caso in cui sarebbe andata male è esattamente quello che la voce vuole impedire**: se i
> bottoni non fossero attaccati (l'`appendChild` sta dentro un `try`), l'ultimo figlio torna a
> essere **la domanda**, e la nota la **cancella** — cioè avrei tolto in silenzio la richiesta di
> denaro che stavo dichiarando di non voler togliere in silenzio.
>
> 🔨 **La regola operativa**: quando una cura tocca il DOM, **misura la struttura** (`Array.from(el.children).map(c => c.className)`)
> invece di dedurla dal codice che la costruisce. E quando un effetto è giusto, chiediti **perché**:
> se la risposta è «perché l'ultimo è quello», vai a contare.
>
> ---
>
> ## 🔬 LE ALTRE TRE LEZIONI (tutte pagate qui)
>
> **① ⭐⭐ UN LIMITE DICHIARATO E MAI RIMISURATO È PIÙ PICCOLO DEL VERO — e nella forma peggiore,
> cioè descritto come un caso raro.** Il passaggio della 117ª diceva che il lookup del tipo fallisce
> *«fuori dal giorno caricato»*, come se mancasse **un giorno**. 📏 Rimisurato sulla pagina viva su
> TUTTE le righe di cassa: delle **705** terne `data+campo+ora`, la memoria ne trovava **19** ⇒
> **686 su 705 (97,3%)**. Non un caso di bordo: **la regola**.
> ⚖️ E il perché non era il giorno, era la **finestra**: la memoria tiene il **futuro**
> (07/09→07/10), la cassa guarda il **passato** (01/06→07/09) — le due quasi non si toccano.
> 📌 *Un limite scritto come «caso raro» non lo va a contare nessuno: la parola stessa scoraggia la
> misura.*
>
> **② 🚨🚨 HO LAVORATO SUL RAMO SBAGLIATO, e per un tratto lungo.** Dopo aver creato il ramo dei
> documenti da `origin/main` **non sono tornato su `test-preview`**, e ho scritto la cura della 210
> sopra l'`index.html` **di PROD** (congelato). Me ne sono accorto solo perché `APP_VERSION` diceva
> `6.397` e il banco contava **123 file invece di 149**.
> ⭐ **Niente è stato spinto**, e la cura è stata **riscritta** su `test-preview` — dove la funzione
> è **diversa** (ha un quarto parametro `simulate`): un travaso del diff non si sarebbe nemmeno
> applicato. 📌 *Due numeri che non tornano valgono più di dieci riletture: `APP_VERSION` e il
> conteggio del banco sono la firma del ramo su cui sei.*
>
> **③ 🩹 UNA PROVA CHE IL LINGUAGGIO SUPERA DA SOLO NON MISURA IL CODICE.** Avevo scritto
> *«rispondere due volte non cambia l'esito»* e premevo Sì poi No. 📏 Togliendo dal codice la
> guardia `_done` il banco **restava verde**: a garantirlo è la **Promise**, che si risolve una
> volta sola. La prova non provava la guardia — provava `Promise`. ⇒ Tolta, e la guardia resta nel
> codice **dichiarata per quello che è**.
> 🩹 E una seconda sonda è nata cieca nello stesso giro: cercava `scrollIntoView` e cadeva **sul mio
> stesso commento**, che quella parola la nomina per dire di non usarla — la lezione di `prove.yml`
> presa in flagrante mentre la sonda veniva scritta. ⇒ Le sonde sul sorgente **tolgono i commenti
> prima di guardare**.
>
> ---
>
> ## ✅ FATTO IN QUESTA SESSIONE
>
> ### 💶 VOCE 198 — **CHIUSA**, a click veri
> Le porte fra Incassi e la scheda esistevano già (117ª); restava il tipo che si perdeva fuori dal
> giorno caricato. 📏 Rimisurato: **97,3%** delle righe di cassa apriva col ripiego `partita`/90.
> **Tre cure**, ciascuna con la sua misura:
> · l'**ORA si pareggia** prima del confronto (`_pmoOraNorm`) — 📏 **129** righe `payment` su 2.605
>   scrivono `9:00` mentre **tutte** le fonti dello slot scrivono `09:00` ⇒ non potevano combaciare
>   mai. ⚠️ Tocca anche il **dovuto**, che su quelle righe diceva «non so» per una ragione di
>   formato — il terzo esito della voce usciva **falso**;
> · lo slot si **legge nel cloud** quando la memoria non sa (`_pmoTipoDurataOvunque`) — 📏
>   `booking_history` ha **2.881** righe vive e `storicoPrenotazioni` in memoria ne ha **0**: l'app
>   non lo idrata. È la stessa cura già scritta nel commento di `pmoCaricaPagamenti`
>   (*«se le importa davvero, se la carica»*), **applicata** invece che riscoperta una terza volta;
> · il **ripiego si DICHIARA**: a 324 slot su 704 il silenzio non è un arrotondamento.
> 📏 **Copertura da 18 a 380 slot su 704**, misurata sul vivo (`illeggibile: 0`).
> ✅ **Chiusa con click VERI** su righe vere della tabella Incassi: 31/07 ⇒ `partita`/`1.5` letto dal
> cloud, nessun avviso; 20/08 ⇒ ripiego **con** l'avviso. E una **lezione che vive solo nello
> storico** (31/07 C1 18:30) si apre `lezione`/`1` **con la sezione Maestro**.
> ⛔ **Non provato**: la cura dell'ora sul **dovuto** — su `cudi` non esiste un caso vero (gli slot
> raggiunti da un'ora non paddata sono `booking_history` **senza giocatori**).
>
> ### 🔁 VOCE 210 — **CHIUSA**, premendo davvero i bottoni dieci volte in fila
> 🗣️ *«Perché se io clicco i bottoni cash e card uno dopo l'altro mi fa questo?»* · 📏 `↓ 10 nuovi`.
> ⇒ Quelle conferme **non sono un dialogo modale**: sono messaggi in un pannello che scorre, e
> nascevano **fuori dalla vista** ⇒ **l'incasso non partiva** perché nessuno poteva confermarlo.
> 📌 *Dieci domande che nessuno vede non sono dieci tentativi: sono zero incassi.*
> **Tre cose**: ① una domanda per volta, e la nuova **sostituisce** (chi preme Cash e poi Card ha
> **cambiato idea**); ② la sostituzione **si dichiara**, coi bottoni della vecchia tolti — *un «Sì,
> incassa» che non incassa più è una bugia con la faccia di un'azione*; ③ la domanda **si porta
> sotto gli occhi** (il tetto della 127 si scavalca **di proposito**, come già fa il click sulla
> pastiglia). 📌 *Un esito si può andare a prendere; una domanda deve venire lei.*
> ✅ **Sul vivo**: 10 click ⇒ **10 scritte · 9 sostituite · 1 aperta**, zero bottoni premibili sulle
> sostituite, quella aperta **dentro il bordo** (pannello sceso da 0 a 949).
>
> ### 🔓 VOCE 213 — nata da una sua regola, **curata ma in CODA** (non chiusa)
> 🗣️ *«ti dico che idreserva non ci serve più perché è un codice di matchpoint»*.
> 📏 **Il difetto che ne discende**: la guardia `NO_IDRESERVA` stava **prima del bivio** in **tre**
> funzioni — `_pmoCollectPayment` · `_pmoSetCharges` · `_pmoVoidPayment` ⇒ il ramo **nativo**, che
> dichiara *«niente edge, niente worker, niente Matchpoint — per costruzione»*, **non poteva nemmeno
> essere raggiunto**. `_pmoSetChargesNativo` quell'identificativo non lo riceve neanche.
> 🎯 **È la prova del futuro del progetto, applicata e fallita**: *il giorno in cui Matchpoint si
> spegne, questa strada non si tocca* — oggi si **fermava**.
> ✅ Curata **spostando la guardia dentro la strada che la vuole**: su Matchpoint resta obbligatoria.
> 🚨⭐⭐ **E la cura poteva aprire un buco peggiore**: **cinque** punti dicevano
> `String(stOpen.idReserva || '') === idReserva` ⇒ senza identificativo diventa `'' === ''`, **vero
> per qualunque scheda aperta**, e l'incasso avrebbe aggiornato il roster di **una partita che non
> c'entra**. Sostituiti tutti e cinque con `_pmoStessaScheda`, che senza identificativo confronta le
> **coordinate** e davanti a due assenze risponde **no**.
> ⏳ **Sta in coda e non fra le chiuse** perché **non è provabile oggi**: 📏 le **37**
> `staff_booking` vive hanno tutte un `id_reserva`, comprese le **4** non promosse ⇒ il caso che
> sblocca **non esiste ancora**. Famiglia della **92** e della **83**. La chiuderà il distacco.
>
> 📋 **Spinte**: gestionale `test-preview` (TEST **6.450**) · `main` **solo documenti**
> (PR #1558 · #1559 · #1560 · #1561). Bot **non toccato**. PROD **non toccata**.
> 🚨 **Gli sha NON stanno qui, di proposito**: il commit che porta questo file è uno di quelli che
> li cambia ⇒ una riga che li cita **nasce falsa**, non invecchia. Si misurano:
> `git rev-parse --short origin/main origin/test-preview`.
>
> ---
>
> ## 🔔 DA DOVE SI RIPARTE
>
> ### ① 🔴 LA 211 È L'UNICA URGENTE, e le manca UNA COSA SOLA
> 🗣️ *«perché non mi fa salvare il pagamento?»* — scheda del **14/09, Campo 3, 18:00, Lidia Comes**,
> *A carico 12,00 € · Manca all'appello 12,00 €*.
> ✅ **Riprodotto tutto, in sola lettura, sulla pagina viva**: il **Salva** risponde *«Nessuna
> modifica da salvare»* — e **ha ragione**, non era cambiato niente; il **Cash** apre la domanda coi
> due bottoni **✅ Sì, incassa · ✕ Annulla**.
> ⛔ **MANCA SOLO premere «Sì, incassa» e vedere la riga in Incassi.**
>
> 🚨🚨⭐⭐ **E IL MOTIVO PER CUI NON L'HO FATTO VA LETTO BENE, perché non è una regola del
> progetto**: il committente l'ha **autorizzato esplicitamente** (*«fai tu»*, e la sua regola del
> 09/09 dice *«puoi fare tutti i test end to end che vuoi… prenotando, cambiando, levando,
> **pagando**»* sul sistema nuovo). ⇒ È il **classificatore dell'ambiente di lavoro** a rifiutare il
> comando con `--allow-writes`, con motivazione *«Real-World Transactions»*. **Provato due volte,
> rifiutato due volte, non aggirato.**
> 🔨 **Cosa fare nella sessione nuova, in ordine**:
> ① **riprova** — l'ambiente può essere configurato diversamente, e il permesso di lui c'è già;
> ② se rifiuta ancora, **non insistere**: o si chiede una regola di permesso per
>    `node console.mjs … --allow-writes`, o **lo preme lui** (un click su TEST) e tu verifichi il
>    resto.
> 📏 **Baseline misurata, da confrontare dopo**: su quello slot ci sono **0** pagamenti, e le righe
> di cassa nostra (`source: pmo_cassa`) su `cudi` sono **0 in tutto**.
> 📏 **Cosa scriverebbe esattamente** (letto in `_pmoCassaScriviIncasso`): **una riga sola** in
> `pmo_cloud_records`, `record_type: payment`, `source: pmo_cassa`, `amount_cents: 1200`,
> `method: cash`, `status: paid`, `voided: false` — **nessuna edge, nessun worker, nessun
> Matchpoint**. Chiave **deterministica** (slot + nome) ⇒ ripeterlo non raddoppia. **Stornabile**.
> ⚠️ **E resta una sua DECISIONE**, che la 210 non tocca: se il **Salva**, con *«Manca all'appello»*
> pieno, debba **dire dove si incassa** invece di rispondere solo *«nessuna modifica»* — oggi è una
> risposta **vera che non aiuta**.
>
> ### ② 📋 LA CODA, 12 voci — e le quattro che hanno un pezzo pronto
>
> | voce | cosa | il pezzo che serve a chi la prende |
> |---|---|---|
> | **182** | 📦 il **travaso** da PROD al sistema nuovo | 🆕📏 **Adesso ha un costo concreto**: su `cudi` manca **un mese di storico** (`booking_history` finisce il **01/08**, `booking` comincia il **07/09**) ⇒ **324** terne di cassa su 704 non trovano la loro partita, e ad **agosto se ne trovano 4 su 248**. ⭐ Verificato **chiave per chiave**: dei 324, **295 esistono su PROD** e solo **29** sono perse anche là ⇒ si passerebbe da **380 a 675 su 704 (96%)** |
> | **213** | 🔓 l'idReserva (sopra) | curata e in servizio; aspetta il distacco per essere provata |
> | **212** | il test di livello promette l'esito e non lo manda | 🗣️ Sua ipotesi: *«controlla se il codice è uguale a quello di prod, e nel caso importalo»*. ⚠️ **Da misurare prima**: la **204** aveva accertato che i due bot girano dallo **stesso ramo** e che il più indietro è **PROD** ⇒ importare porterebbe **indietro**. 🔎 `stato-bot.yml` (sola lettura, dal cloud), poi `consumer-assessment-decision` su `cudi` |
> | **206** | «Salvare su **Matchpoint**?» su una scheda che nasce da noi | 📏 ~99 righe non-commento nominano Matchpoint nella zona della scheda, ~20 **frasi visibili**. 🚨 L'astrazione **esiste già** (`pmoNomeCircoloEsterno()`): il difetto è che quei punti **non ci passano**. Servono **tre** esiti: si toglie · si riscrive · è ancora vera |
>
> Le altre: **184** (l'ambiente si riconosce dall'hostname) · **186** (prezzi visibili dal bot) ·
> **199** (ripulire «Dati», togliere «Circoli») · **200** (quanto ci mette un avviso) · **203** (al
> primo ingresso non gli si dice cosa può fare) · **204** (confronto fra i due bot) · **208** (la
> fila dei bottoni in testa alla scheda — ⚠️ leggere **prima la 167**, che li ha messi lì per una
> ragione scritta) · **209** (chiudendo una scheda resta un **riquadro vuoto con la ✕** che copre la
> prima fascia oraria del calendario).
>
> 📌 **La 209 è la più a portata di mano**: ipotesi non misurata — il contenuto si svuota e il
> contenitore non si nasconde. Si guarda in due minuti con la console remota.
>
> ---
>
> ## ⛔ COSA NON DARE PER FATTO
>
> · 🚨 **Nel cloud i campi sono in `snake_case`**: è `id_reserva`, non `idReserva`. Ho interrogato
>   quello sbagliato e ho trovato `null`, concludendo che ci fosse una guardia che bloccava tutto —
>   **falso**. È la sonda puntata su un campo che non esiste, ripetuta **un'ora dopo** aver letto
>   l'avviso in testa al passaggio precedente. **Prima di filtrare su un campo, verifica che ci
>   sia** (`count(*) filter (where payload ? 'nome')`);
> · 🚨 **`storicoPrenotazioni` nel browser è VUOTO** (0 righe) mentre `booking_history` sul cloud ne
>   ha 2.881: l'app non lo idrata all'avvio. Chi ci legge dentro trova niente e lo scambia per
>   un'assenza vera;
> · 🚨 **Le fonti dello slot in memoria tengono il FUTURO** (07/09→07/10): qualunque domanda sul
>   passato va al **cloud**, o risponde `null` con la faccia di un fatto;
> · ⚠️ **`guard-docs-truth` CONTA le voci, non le LEGGE**: stanotte ho spinto **due schede vuote**
>   (210 e 211, tagliate da uno `split('|', 3)` su una riga con tre pipe) e la guardia era
>   **verde**. Riparate. ⇒ Dopo aver mosso una scheda, **guarda che non sia vuota**;
> · ⚠️ **PROD è CONGELATA**: i passi ③ e ④ sono **sospesi**. Su `main` passano **solo documenti** —
>   `index.html` là **non si tocca**. Stanotte zero commit su quel file;
> · 🧊 **`cudi` non si rinfresca più da Matchpoint** e riaccendere le routine **cancellerebbe** ciò
>   che il sistema nuovo ha fatto.
>
> ---
>
> ## 🔧 ATTREZZI E TRAPPOLE PRATICHE
>
> · ⭐⭐ **La console remota è l'attrezzo che ha chiuso tutto** (`tools/verifica-browser`):
>   `npm install` lì dentro, poi `node console.mjs --env test --eval "…"`.
>   Le quattro `PMO_VERIFY_*` **c'erano già** nell'ambiente: `login: "ok"` senza chiedere niente.
> · 🚨⭐⭐ **LA PREPARAZIONE DEL CONTAINER FALLISCE — e la cura scritta dalla 117ª è MEZZA
>   SBAGLIATA OGGI.** Diceva di spostare `/etc/apt/sources.list.d/*.list`: 📏 i PPA adesso sono
>   file **`.sources`**, quindi quello spostamento **non li toglie di mezzo** e `apt-get update`
>   continua a prendere 403.
>   🔨 **La cura giusta, una volta per sessione**:
>   ```
>   mkdir -p /tmp/aptoff
>   mv /etc/apt/sources.list.d/*ubuntu-*.sources /tmp/aptoff/
>   apt-get update -qq; apt-get install -y -qq libnss3-tools
>   mv /tmp/aptoff/* /etc/apt/sources.list.d/
>   mkdir -p "$HOME/.pki/nssdb"
>   certutil -d "sql:$HOME/.pki/nssdb" -A -t "C,," -n ccr-agent-proxy-ca -i /root/.ccr/agent-proxy-ca.crt
>   ```
>   poi si lancia con **`PMO_SALTA_PREPARAZIONE=1`**. ⚠️ Se `apt` dice *«Could not get lock»*, c'è
>   un altro `apt-get` in corso: aspetta con un `until ! fuser /var/lib/dpkg/lock-frontend`.
> · 📌 **Le porte per entrare senza cliccare**: `staffCalEditPlayers(iso, campo, ora, nome, durata, tipo)`
>   · `pmoIncassiApriPartita(iso, campo, ora, nome)` · `pmoSchedaApriIncassi(…)`
>   · `_pmoDovutoDelloSlot(iso, campo, ora)` · `_pmoLookupTipoDurata(…)`
>   · 🆕 `_pmoTipoDurataOvunque(…)` (async, va nel cloud) · 🆕 `_pmoStessaScheda(st, id, data, campo, ora)`
>   · 🆕 `_pmoOraNorm(ora)`.
> · ⭐ **La scheda vive dentro `#svcChatMessages`**, non in un contenitore proprio: per guardarla si
>   legge quello. I `select` della scheda si prendono con `chat.querySelectorAll('select')`.
> · 🩹 **La sonda migliore è INTERCETTARE**: sostituire `window.staffCalEditPlayers` con un wrapper
>   che registra gli argomenti dice in un colpo cosa riceve la scheda, dove il DOM è ambiguo.
>   Stessa cosa con `window.showAlert` per catturare gli avvisi.
> · ⚠️ **Le variabili `const`/`let` dei blocchi `<script>` NON sono su `window`**
>   (`staffCalPlayersState`, `_incassiState`): si guarda il **DOM**, o si esporta.
> · 🚨 **Il combined status di GitHub non vede i check di Actions**: `/commits/<ref>/status` resta
>   `pending` per sempre. Si usa **`/commits/<ref>/check-runs`**.
> · ⭐ **Il database di TEST si tocca con l'MCP Supabase** (`cudiqnrrlbyqryrtaprd`); la tabella è
>   **`pmo_cloud_records`**, con `record_type` e la colonna **`deleted`** che decide cosa è vivo.
>   PROD è `qqbfphyslczzkxoncgex` (leggere è lecito; scrivere no).
> · 🩹 **La finestra del 4bis**: `guard-worker-sync` può cadere rossa su `test-preview` quando i
>   documenti arrivano prima su un ramo. È **transitoria** e quel ramo **non rigira da sé** ⇒ si
>   rilancia con `workflow_dispatch`. *(Stanotte è servito una volta su tre.)*
> · ⏳ Sulle PR verso `main` girano **solo** `guard-main` e `prove`: le altre guardie
>   (`worker-sync`, `conteggi-lavori`, `versioni-dichiarate`) girano **sul push al ramo**. Dopo il
>   merge vanno guardate lì.
> · 📦 **Il repo del bot va aggiunto a mano**: `add_repo` su `PadelVillage/assistente-padel-agent`,
>   poi `git clone --depth 1`. Lavora su **`main`** (non ha `test-preview`).
>
> ---
>
> ## 📊 STATO, misurato a fine sessione
>
> | | |
> |---|---|
> | **PROD** | `v6.397`, **CONGELATA e non toccata** — misurata sul vivo. Su `main` sono passati **solo documenti**, e `index.html` ha **0** commit oggi |
> | **TEST** (il sistema nuovo) | `v6.450`, servita. ⚠️ `app-meta.json` può dichiarare un `source_sha` **più vecchio dell'ultimo commit**: è corretto quando i commit dopo hanno toccato **solo i documenti**. Si confronta con `git log --oneline -- index.html` |
> | **bot dei soci** | non toccato |
> | **bot di prova** | non toccato — ⚠️ ha una segnalazione aperta (voce **212**) |
> | guardie | ✅ **verdi tutte** sull'ultimo commit di **entrambi** i rami |
> | lista lavori | 🔴 **1 urgente** (211) · 📋 **12 in coda** · 📦 **194 chiuse** |
> | banco gestionale | **150 file, 0 rossi** · +32 casi nuovi, **venticinque sabotaggi** caduti |
> | rami | `main` e `test-preview`, **identici** su `docs/`, workflow, `CLAUDE.md` e `server.mjs` (0 file di scarto). 🚨 Gli sha si **misurano**, non si leggono da qui |
> | worker | **identico sui due rami**, e non toccato |
> | `CLAUDE.md` | **12 sezioni** — se ne conti meno, stai leggendo una copia vecchia |

---
