# Passaggio di consegne — 11/09/2026 (117ª sessione)

> **Prompt da incollare nella chat nuova.** Copia tutto quello che sta fra le due righe.
> *(Sostituisce le versioni precedenti, compresa quella della 116ª.)*

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
> 📏 **Successo di nuovo, per la sesta sessione di fila**: stanotte il checkout è partito su un
> commit vecchio con `git status` pulito, e la copia di `CLAUDE.md` arrivata nel prompt di sistema
> aveva **11 sezioni invece di 12** — mancavano *il congelamento di PROD* e *«il gestionale di TEST
> diventa il vero»*, cioè le due che cambiano come si legge tutto il resto.
> ⇒ **Rileggi `CLAUDE.md` dal disco** (`grep -c '^## ' CLAUDE.md`): le sezioni sono **12**.
>
> **② Controlla su quale ramo sei prima di misurare** — `git rev-parse --abbrev-ref HEAD`.
>
> ---
>
> ## 🥇🚨 LA COSA PIÙ IMPORTANTE DA PORTARSI DIETRO
>
> **⭐⭐ UN FILTRO SU UN CAMPO CHE NON ESISTE NON FILTRA: RISPONDE SEMPRE LA STESSA COSA, E SEMBRA
> UNA MISURA.** Pagata tre volte in questa sessione, e la terza stava per costare un allarme falso
> portato al committente.
>
> Ho contato le prenotazioni «vive» con `coalesce(payload->>'cancelledAt','') = ''`.
> 📏 Quel campo **non esiste**: `payload ? 'cancelledAt'` ⇒ **0** righe su 340. La condizione era
> sempre vera, e ho letto **340 prenotazioni vive** dove le vive sono **37** — le altre **303**
> sono `deleted` sulla **colonna**, che è un posto diverso dal payload.
>
> ⇒ Da quel numero sbagliato è nata una catena intera: *«il dovuto manca su 242 prenotazioni»*,
> poi *«21 righe giocatore senza importo»*, poi — la peggiore — *«una prenotazione esiste nel
> cloud e il calendario dice Libero, qualcuno può prenotare sopra»*. **Stavo per portargliela
> come un difetto grave.** La prenotazione del 26/09 è semplicemente **annullata**, e il
> calendario ha ragione.
>
> 📌 *Una sonda puntata su un campo che non esiste non tace: risponde, e risponde plausibile.
> È la 24ª nella sua forma più pericolosa, perché il risultato ha la forma di un dato.*
> 🔨 **La regola operativa**: prima di filtrare su un campo del payload, **verifica che il campo
> ci sia** (`count(*) filter (where payload ? 'nome')`). E quando un conto sorprende, sospetta la
> sonda prima del sistema.
>
> ---
>
> ## 🔬 LE ALTRE TRE LEZIONI (tutte pagate qui)
>
> **① ⭐⭐ FRA DUE SCRITTURE DELLO STESSO STATO NON DECIDE L'ORDINE DELLE RIGHE: DECIDE CHI GIRA
> PER ULTIMO.** Il bottone nuovo portava in Incassi **senza applicare il filtro**, e il banco era
> **verde**. 🔎 Il ramo `incassi` di `switchTab` sta dentro un **`setTimeout(…, 0)`** ⇒ il suo
> `focus = null` girava **dopo** l'assegnazione che nel codice lo seguiva, e la cancellava. Il mio
> commento diceva *«l'ordine conta: lo si mette DOPO»*, ed era **falso**: «dopo nel codice» era
> «prima nel tempo».
> ⇒ **Curato togliendo la seconda scrittura, non mettendole in fila**: il focus lo scrive **un
> punto solo**, quello che gira per ultimo, consumando un `_incassiFocusPending`.
> 📌 *Con un lavoro differito in mezzo, «prima» e «dopo» si invertono — e il rimedio non è
> riordinare, è avere una scrittura sola.*
>
> **② 🩹 UNA MISURA PUÒ MISURARE IL PROPRIO EFFETTO.** Il lookup del tipo sembrava trovare la
> lezione; 📏 rifatto a freddo tornava `null`. L'apertura della scheda — fatta un attimo prima
> **nella stessa prova** — aveva scritto lei stessa il record (`staffBookings` **35 → 36**).
> 📌 *Una sonda che agisce prima di misurare misura sé stessa.*
>
> **③ 🚨 UN BANCO VERDE PUÒ ESSERE CIECO, E LO SCOPRE IL SABOTAGGIO — NON LA RILETTURA.** Due sonde
> del banco nuovo erano nate inutili: una cercava le chiamate con `[^)]*`, che si ferma alla
> parentesi dentro `String(nome || '')` ⇒ col tipo cablato rimesso a mano **il banco restava
> verde**; l'altra verificava che il ramo del focus **ci fosse** senza verificare che dentro non ci
> fosse il vincolo di date. 📌 *Le sonde del banco si sabotano come il codice: verificare che una
> guardia CI SIA non verifica che faccia la sua parte.*
>
> ---
>
> ## ✅ FATTO IN QUESTA SESSIONE — la 198, due passi su tre
>
> ### 💶 VOCE 198 — ① LE PORTE e ③ IL CONFRONTO: **fatti e provati sul vivo**. Il ② **cassato**.
> 🗣️ *«bisogna collegare la sezione incassi con i pagamenti tramite la scheda partite e lezioni e
> tornei e anche il borsellino»* · *«Fai come pensi sia giusto»* (sulla scelta fra navigazione e
> riconciliazione) · *«Procedi con la centonovantotto»*.
>
> **① LE DUE PORTE** — scelta la **navigazione**, col perché dichiarato: *il rischio non è
> simmetrico*, una porta che sbaglia apre la pagina sbagliata, un conto che sbaglia **accusa chi
> aveva già pagato**.
> · **dalla scheda a Incassi**: bottone *«Vedi gli incassi di questa prenotazione»* in fondo a
>   «Giocatori e pagamenti» (non nel piè, dove stanno i gesti che **scrivono**). Apre Incassi con
>   un `focus` che mostra **solo** quei pagamenti e **ignora l'intervallo di date** — e ignorarlo è
>   una **correttezza**: un incasso può essere registrato in un giorno diverso dalla partita.
> · **da Incassi alla scheda**: `pmoIncassiApriPartita` **esisteva già** e non è stata rifatta, è
>   stata **curata**. 🚨 Dei **12** chiamanti di `staffCalEditPlayers` esattamente **uno** cablava
>   il tipo (`'partita'`, `90`), ed era questo ⇒ una riga di cassa di una **lezione** apriva la
>   scheda come partita, e una scheda «partita» **non disegna il selettore del maestro**.
>
> **⛔ IL ② È CASSATO, non rimandato**: diceva *«l'importo a carico nativo che riempie il dovuto»* e
> 📏 la **188 l'aveva già risolto** — delle **7** righe giocatore future, **7** hanno il dovuto e
> **0** no. Non c'era niente da costruire.
>
> **③ IL CONFRONTO, e si ferma alla PARTITA.** 📏 **Il livello è una misura, non una preferenza** —
> abbinando le **17** righe con importo ai pagamenti per `data+campo+ora+nome`:
> · **12** non hanno **nessun** pagamento sullo slot ⇒ lì «non pagato» sarebbe vero;
> · **07/09 C2 18:00**: il dovuto è di *Fabio De Luca* e i **3** pagamenti sono a nome di **altre
>   tre persone** ⇒ per nome si accuserebbe **lui**, e può essere falso (uno paga per tutti);
> · **03/09 C2 21:00**: nel roster ci sono **DUE «Ospite»** e pagamenti «Ospite» ⇒ per persona è
>   **indecidibile**.
> ⇒ **Il nome non è una chiave.** 📌 *Quando l'unità di misura sbagliata produce un'accusa, non si
> affina: si cambia unità.*
>
> 📏 **I TRE ESITI, PROVATI SULLA PAGINA VIVA UNO PER UNO** *(console remota, TEST 6.446)*:
>
> | caso vero | dovuto calcolato | la barra dice |
> |---|---|---|
> | **03/09 C2 21:00** — 4 quote, 48,00 € incassati | 4.800, 0 ignoti | *«su 48,00 € dovuti · **quadra** ✓»* |
> | **16/09 C3 18:00** — 2 quote, nessun incasso | 2.000, 0 ignoti | *«su 20,00 € dovuti · **mancano 20,00 €**»* |
> | **31/12 C4 08:00** — slot non in casa | `trovato: false` | *«dovuto **non so**»* |
>
> ⭐ E in tutti e tre **non dice mai che una persona non ha pagato**: la differenza è dichiarata
> **della partita**, col perché nel titolo del passaggio del mouse.
>
> 🩹 **Le trappole che questa voce ha scoperto**, tutte misurate:
> · `tipoReale` **non esiste in nessuno dei 2.027 record** — vive **solo in memoria**, costruito
>   dagli slot del calendario. Nei record il campo è **`tipo`**, e i vocabolari sono **due**
>   (`lezione` da noi, **`Lezione Libera`** dal circolo) ⇒ si passa da `pmoTipoScheda`, la fonte
>   unica della 207;
> · le fonti dello slot sono **TRE** e non due: 📏 `prenotazioni` **288** · `prenotazioniOccupazione`
>   **163** · `staffBookings` **37**. Riusare le due di `_staffCalLookupIdReserva` non bastava —
>   *quella cercava un id, questa cerca un tipo, e i due non vivono negli stessi posti*;
> · la **durata ha due formati**: minuti nei nostri record (`90`), **ore come stringa** in quelli
>   del circolo (`"1.5"`). Si restituisce **grezza**, perché la normalizza `_staffCalDurMin` — e
>   convertirla due volte la romperebbe (📏 verificato: `"1.5"` ⇒ 90).
>
> ⛔⛔ **IL LIMITE CHE RESTA, ed è il primo pezzo del prossimo giro**: il tipo si legge dalle tre
> fonti **in memoria**, che tengono il **giorno caricato**. 📏 Per il 03/09 il lookup torna `null`
> ⇒ quella scheda si apre col **ripiego `partita`/90**, cioè fuori dal giorno in casa **il difetto
> vecchio si ripresenta**.
> ⛔ **Non provati**: il **click su una riga vera** della tabella Incassi (la funzione è stata
> esercitata per nome, il dito no) e il quarto esito — dovuto **incompleto** quando una quota non
> ha importo — perché su `cudi` **non esiste un caso vero**.
>
> 📋 **Spinte**: gestionale `test-preview` → `6c1cf3af` · `main` → `e4dc897f` (**solo documenti**,
> PR #1554 · #1555 · #1556). Bot **non toccato**.
>
> ---
>
> ## 🔔 DA DOVE SI RIPARTE
>
> ### ① 🔴 LA 198 resta l'UNICA urgente — per il limite, non per il disegno
> Il disegno è chiuso (① e ③ fatti, ② cassato). Resta **il tipo fuori dal giorno caricato**, e la
> strada più pulita è **una sola**: non far indovinare il chiamante, ma fare in modo che la scheda
> risolva il tipo **da sé** quando non glielo passano — oppure che `pmoIncassiApriPartita` aspetti
> il caricamento del giorno prima di chiedere. ⚠️ La seconda è **asincrona e fragile**; la prima
> sposta la lettura nel punto che già fa la lettura autorevole.
> ⭐ **E c'è un pezzo pronto da riusare**: `_pmoTrovaSlot(iso, campo, ora)` — estratta in questa
> sessione, cerca in tutte e tre le fonti, ed è condivisa fra il tipo e il dovuto.
>
> ### ② 📋 SEI COSE CHE HA SEGNALATO LUI L'11/09, tutte messe in coda DA LUI
> 🗣️ Ogni volta ha detto *«altro task in coda»* ⇒ **registrate, non promosse.** Sono le voci
> **208-212** più la **206** arricchita:
>
> | voce | cosa | il pezzo che serve a chi la prende |
> |---|---|---|
> | **206** | «Salvare su **Matchpoint**?» su una scheda che nasce da noi | 📏 **99 righe non-commento** nominano Matchpoint nella zona della scheda, di cui ~20 **frasi visibili**. 🚨 **L'astrazione esiste già** (`pmoNomeCircoloEsterno()`, voce 190): il difetto è che quei punti **non ci passano**. ⚠️ Le frasi **non si accorciano tutte** — alcune hanno il circolo come **soggetto** e vanno **riscritte**: servono **tre** esiti (si toglie · si riscrive · è ancora vera) |
> | **208** | la fila dei bottoni in testa alla scheda (Salva · Chiudi · Aggiungi · Annulla) | ⚠️ Mescolano **tre mestieri**, e l'unico **irreversibile** sta accanto a quello che non fa niente. 🚨 Leggere **prima la voce 167**, che li ha già spostati lì per una ragione scritta |
> | **209** | chiudendo una scheda resta un **riquadro vuoto con la ✕** | ⛔ Non è cosmetico: **copre la prima fascia oraria** del calendario e resta cliccabile. Ipotesi (non misura): il contenuto si svuota e il contenitore non si nasconde |
> | **210** | Cash e Card premuti in fila **accodano dieci conferme** | 📏 La cifra è nel suo schermo: **`↓ 10 nuovi`** ⇒ le conferme **nascono fuori dalla vista** e l'incasso non parte perché nessuno può confermarlo. Due cose da decidere: un secondo click **sostituisce**, e la richiesta **si fa vedere** |
> | **211** | *«perché non mi fa salvare il pagamento?»* | ✅ Sul gesto **l'app ha ragione** (`Salva` salva le *modifiche*, e non aveva cambiato niente; l'incasso passa da Cash/Card/Wallet). 🚨 **Ma la domanda nasce dalla 210** ⇒ le due si guardano insieme. 📌 *Quando qualcuno usa il bottone sbagliato, la prima domanda è cosa ha fatto il bottone giusto quando l'ha premuto* |
> | **212** | il test di livello **promette l'esito e non lo manda** | 🗣️ Sua ipotesi: *«controlla se il codice è uguale a quello di prod, e nel caso importalo»*. ⚠️ **Da misurare prima di seguirla**: la **204** aveva accertato che i due bot girano dallo **stesso ramo**, e che **il più indietro è PROD** ⇒ importare porterebbe **indietro**. 🔎 Guardare in ordine: `stato-bot.yml` (sola lettura, dal cloud), poi `consumer-assessment-decision` su `cudi` |
>
> 📌 *Un'ipotesi del committente si misura come tutte le altre: se regge si segue, se no si
> riporta a lui con la misura accanto — non si esegue perché l'ha detta lui, né si scarta perché
> una riga vecchia dice altro.*
>
> ---
>
> ## ⛔ COSA NON DARE PER FATTO
>
> · 🚨 **Le `staff_booking` VIVE sono 37, non 340**: il resto è `deleted` sulla **colonna**, e nel
>   payload **non esistono** `cancelledAt` né `deletedAt`. Chi conta senza guardare quella colonna
>   trova 340 e ne deduce un difetto che non c'è;
> · 🚨 **`tipoReale` non esiste nei record** (solo in memoria) — e il calendario lo legge, quindi
>   leggendo lui si scrive la sonda sbagliata;
> · ⚠️ **il «dovuto» NON manca**: 7 righe future su 7 ce l'hanno. Il «14 su 256» del passaggio
>   precedente era la stessa misura sbagliata;
> · ⚠️ **il giudice per persona non si può fare**, ed è misurato (nomi diversi sullo stesso slot,
>   «Ospite» ripetuto). Se torna la richiesta, la risposta è **il livello partita**;
> · ⚠️ **il difetto dei permessi del gestionale** (spuntando il capitolo le sottosezioni non si
>   attivano) **resta fuori lista**: l'ha trovato lui, va portato a lui prima di aprirla;
> · 🧊 `cudi` **non si rinfresca più da Matchpoint**, e riaccendere le routine **cancellerebbe** ciò
>   che il sistema nuovo ha fatto.
>
> ---
>
> ## 🔧 ATTREZZI E TRAPPOLE PRATICHE
>
> · ⭐⭐ **La console remota è l'attrezzo che ha chiuso tutto** (`tools/verifica-browser`):
>   `npm install` lì dentro, poi `node console.mjs --env test --allow-writes --eval "…"`.
>   Le quattro `PMO_VERIFY_*` **c'erano già** nell'ambiente: `login: "ok"` senza chiedere niente.
> · 🚨⭐⭐ **LA PREPARAZIONE DEL CONTAINER FALLISCE, e la prima esecuzione va in TIMEOUT.**
>   `prepara-ambiente.sh` installa `certutil` via `apt-get`, e il proxy **blocca i PPA**
>   (`ppa.launchpadcontent.net` ⇒ 403) ⇒ otto tentativi e la console muore a 300 s.
>   🔨 **La cura, una volta per sessione**:
>   ```
>   mkdir -p /tmp/aptoff && mv /etc/apt/sources.list.d/*.list /tmp/aptoff/
>   apt-get update -qq; apt-get install -y libnss3-tools
>   mv /tmp/aptoff/*.list /etc/apt/sources.list.d/
>   mkdir -p "$HOME/.pki/nssdb"
>   certutil -d "sql:$HOME/.pki/nssdb" -A -t "C,," -n ccr-agent-proxy-ca -i /root/.ccr/agent-proxy-ca.crt
>   ```
>   poi si lancia con **`PMO_SALTA_PREPARAZIONE=1`**. ⚠️ Senza la CA il sintomo è
>   `ERR_CERT_AUTHORITY_INVALID` mentre `curl` funziona benissimo.
> · 📌 **Le porte per entrare senza cliccare**: `staffCalEditPlayers(iso, campo, ora, nome, durata, tipo)`
>   (scheda esistente) · `pmoIncassiApriPartita(iso, campo, ora, nome)` · `pmoSchedaApriIncassi(iso, campo, ora, nome)`
>   · `_pmoDovutoDelloSlot(iso, campo, ora)` · `_pmoLookupTipoDurata(iso, campo, ora)`.
> · 🩹 **La sonda migliore è INTERCETTARE, non guardare lo schermo**: sostituire
>   `window.staffCalEditPlayers` con un wrapper che registra gli argomenti ha detto in un colpo
>   cosa riceveva la scheda, dove leggere il DOM aveva dato risposte ambigue.
> · ⚠️ **Le variabili `const`/`let` dei blocchi `<script>` NON sono su `window`**: `staffCalPlayersState`
>   e `_incassiState` non si leggono dalla console. Si guarda il **DOM**, o si esporta.
> · 🚨 **Il combined status di GitHub non vede i check di Actions**: `/commits/<ref>/status` resta
>   `pending` per sempre. Si usa **`/commits/<ref>/check-runs`**.
> · ⭐ **Il database di TEST si tocca con l'MCP Supabase** (`cudiqnrrlbyqryrtaprd`); la tabella dei
>   record è **`pmo_cloud_records`** (non `records`), con `record_type` (non `type`), e la colonna
>   **`deleted`** decide cosa è vivo.
> · 🩹 **La finestra del 4bis**: `guard-worker-sync` può cadere rossa su `test-preview` quando i
>   documenti arrivano prima su un ramo. È **transitoria** e quel ramo **non rigira da sé** ⇒ si
>   rilancia con `workflow_dispatch`. *(Stanotte non è servito: verdi al primo giro.)*
> · ⏳ **`prove` in CI** ci mette qualche minuto: il banco Node finisce in ~40 s, poi parte quello
>   **Deno** che scarica le dipendenze. **Non è piantata.**
> · 📦 **Il repo del bot va aggiunto a mano**: `add_repo` su `PadelVillage/assistente-padel-agent`,
>   poi `git clone --depth 1`. Lavora su **`main`** (non ha `test-preview`).
>
> ---
>
> ## 📊 STATO, misurato a fine sessione
>
> | | |
> |---|---|
> | **PROD** | `v6.397`, **CONGELATA e non toccata** — misurata sul vivo. Su `main` sono passati **solo documenti** |
> | **TEST** (il sistema nuovo) | `v6.446`, servita. `app-meta.json` dichiara `source_sha` **f421edf3**: è corretto, i commit dopo hanno toccato **solo i documenti** |
> | **bot dei soci** | non toccato in questa sessione |
> | **bot di prova** | non toccato — ⚠️ ma ha una segnalazione aperta (voce **212**) |
> | guardie | ✅ **verdi tutte** sull'ultimo commit di **entrambi** i rami |
> | lista lavori | 🔴 **1 urgente** (198, per il limite) · 📋 **13 in coda** · 📦 **192 chiuse** |
> | banco gestionale | **97 file, 0 rossi** (148 verdi) · +29 casi nuovi, **venti sabotaggi** caduti |
> | rami | gestionale `main` `e4dc897f` · `test-preview` `6c1cf3af` |
> | worker | **identico sui due rami**, e non toccato |
> | `CLAUDE.md` | **12 sezioni** — se ne conti meno, stai leggendo una copia vecchia |

---
