# 🧪 Collaudo E2E bot ↔ gestionale su TEST — il prompt da dare a una sessione nuova

**Scritto il 09/09/2026, 100ª sessione, su richiesta del committente**: *«mi crei un prompt che
faccia fare all'agente tutti i test tra gestionale di test e bot di test, in maniera che siamo
sicuri che tutte le intersezioni delle varie funzioni siano corrette… vorrei che un agente
simulasse tutte le operatività che abbiamo implementato tra bot e gestionale di test»*.

📛 **Come si chiama in gergo quello che c'è qui dentro**: è un **collaudo end-to-end (E2E) di
integrazione di sistema** su ambiente di **staging** (TEST), con dentro tre cose che hanno nomi
propri — **contract testing** sulle intersezioni (i ponti `consumer-*`, che vivono su due lati
deployati separatamente), **regression suite** perché si rilancia intera dopo ogni modifica, e
**smoke test** nella sua versione corta dopo un deploy. La tabella dei casi si chiama **test
matrix**.

⚠️ **Questo file NON è il collaudo: è il PROMPT.** Il collaudo lo esegue chi riceve il testo qui
sotto. Si copia dal riquadro `PROMPT` fino alla fine del file.

📌 **La matrice è stata compilata MISURANDO il codice in servizio** il 09/09/2026 — le azioni sono
quelle che le edge accettano davvero (`grep` sugli `index.ts`), non un elenco a memoria. Quando il
codice cambia, **si aggiorna questa matrice**: un caso che non esiste più è peggio di un caso
mancante, perché chi lo esegue crede di aver coperto qualcosa.

---

## PROMPT — da qui in giù si copia

Sei una sessione di lavoro sul progetto **Padel Match Organizer**. Il tuo compito, e l'unico, è
**collaudare end-to-end le intersezioni fra il bot dei soci e il gestionale, sull'ambiente di
TEST**, e consegnare una relazione che dica per ogni caso **cosa hai provato, dove, e cosa NON hai
potuto provare**.

### 0 · Prima di tutto

Leggi `CLAUDE.md` e `docs/lavori/README.md`. Le regole del progetto valgono tutte, e tre in
particolare governano questo lavoro:

- 🧪 **Su TEST hai MANO LIBERA** (sua parola del 05/09/2026): le scritture verso Matchpoint sono
  **simulate**, nessuna prova può toccare il circolo. Non chiedi il permesso per provare: provi.
- 🚨 **PROD non si tocca in questo lavoro.** Non è un collaudo su PROD, non ci si "sconfina per
  verificare". Se un caso si può provare solo su PROD, lo dichiari **non provato** e vai avanti.
- ⛔ **Nessun pagamento, mai, da nessuna parte** (regola del 07/09/2026): niente
  `matchpoint-payment-write`, niente `matchpoint-payment-void`, in nessun ambiente.

E l'obbligo che vale su ogni riga della relazione: **si dichiara cosa è stato provato E cosa no.**
Un caso non eseguito si scrive *non provato, perché…*; non si arrotonda a «funziona».

### 1 · Il perimetro: cosa è "un'intersezione"

Un'intersezione è un punto in cui **il bot chiede e il gestionale risponde**, o in cui **il
gestionale produce un fatto che il bot deve dire**. Sono quattro famiglie:

| | famiglia | dove vive nel gestionale |
|---|---|---|
| **A** | il bot **legge** (chi sono, cosa ho prenotato, con chi gioco, che partite aperte ci sono) | `supabase/functions/consumer-player-readmodel/` |
| **B** | il bot **scrive** (prenota, disdici, esci, togli, entra, apri, chiudi) | `supabase/functions/consumer-booking-write/` |
| **C** | il gestionale **consegna i fatti della segreteria** al bot | `supabase/functions/consumer-staff-events/` + `matchpoint-bookings-sync/eventi-staff.ts` |
| **D** | il **test di livello** (link personale, risposta del socio) | `consumer-assessment-link/`, `consumer-assessment-decision/` |

🚨 **La regola architetturale che ogni caso deve confermare, non solo il singolo esito**: *il
gestionale SA, il bot DICE.* ⇒ In nessuna risposta verso il bot devono comparire i nomi dei nostri
pezzi interni — `worker`, `matchpoint`, `hetzner`, `playwright`, `caddy`, `browser`, un URL. La
guardia si chiama `NOMI_INTERNI` (`consumer-booking-write/esito-scrittura.ts`) e **fallisce
chiusa**. ⇒ **Ogni caso della famiglia B ha, gratis, una seconda domanda**: nel testo che è uscito
verso il bot c'era un nome interno? Se sì è un difetto **grave**, indipendentemente dal fatto che
l'operazione sia riuscita.

### 2 · Gli attrezzi, e cosa ciascuno può davvero raggiungere

📏 **Misurato il 09/09/2026**: nell'ambiente della sessione **non c'è** `CONSUMER_BRIDGE_SECRET`
⇒ le edge `consumer-*` non si chiamano con un `curl` scritto qui, perché il loro unico cancello è
l'header `X-Consumer-Secret`.
🔄🚨 **Ma il limite operativo è già TOLTO, e chi lo ripete progetta prove che non farebbe**: dall'08/09
esiste **`sonda-ponte-soci.yml`** (in *questo* repo), che i ponti li chiama **da Actions**, col segreto
preso dal `.env` del bot di **prova** sulla VM (o dal secret del repo), e **solo** verso gli indirizzi
di `cudi…` — il ref di PROD dentro quel file non c'è proprio. ⇒ *Un limite dichiarato che nessuno
riprova resta vero per sempre perché sembra prudente*: questo è stato riprovato, e non vale più.

| attrezzo | dove | cosa raggiunge | limite |
|---|---|---|---|
| **`collaudo-conversazione.yml`** | repo **`assistente-padel-agent`** (privato: va aggiunto con `add_repo`) | ⭐ **la strada maestra**: parla col **bot vivo di TEST** senza Telegram. Input `verso: test`, `copione` JSON con `chat` + `passi` di `scrivo`/`premo`/`aspetto`; esito nell'artefatto `esito-collaudo.json` (testi e `bottoni[]`) | vuole `chat`, l'**id Telegram di un socio di prova** — 🚨 **non si inventa**: un id a caso manda messaggi a una persona vera. Va misurato o chiesto (§3) |
| **`sonda-ponte-soci.yml`** | **questo** repo, `workflow_dispatch` | ⭐ chiama i **ponti** verso TEST **senza passare dal bot**: cinque azioni — `availability_day` · `kb` · `verifica` · `create_prova` (`dry_run`, si ferma sulla riga **prima** di occupare il campo) · `create_vero` (🚨 scrive, vuole la parola `PRENOTO`) | copre **cinque** azioni su quindici: `cancel`, `leave`, `remove`, `add`, `entra`, `apri`, `chiudi`, `availability` **non ci sono**. ⇒ Estenderla è la strada, ed è già la sua forma |
| **`stato-bot.yml`** | stesso repo | il **registro** del bot (`pm2 describe` + log) con una regex a scelta | mostra solo le **ultime 30** righe che combaciano: regex **strette**, o le righe vecchie vengono tagliate via |
| **`deploy-bot-hetzner.yml`** | stesso repo | aggiorna il bot; bersaglio **`prova`** (predefinito) | ⛔ **bersaglio `soci` MAI in questo lavoro** |
| **console remota** | `tools/verifica-browser/` (questo repo) | il **gestionale di TEST** sulla pagina viva: `node console.mjs --env test --eval "…"`. Le `PMO_VERIFY_*` sono nell'ambiente | in **sola lettura** per difetto; `--allow-writes` serve per i gesti della segreteria (**su TEST si usa senza chiedere**) |
| **MCP Supabase** | progetto TEST **`cudiqnrrlbyqryrtaprd`** | lo **stato**: `execute_sql` su `pmo_cloud_records` / `pmo_eventi_staff` / `self_assessments`, e `query_logs` (`function_edge_logs` per HTTP, `function_logs` per i `console.*`) | è la **sonda**, non l'esercizio: dice cosa è successo, non fa succedere |
| **banco unitario** | repo bot (`npm test`) e `test/handle-test.html` | il meccanismo | ⛔ **non è una prova E2E**: dice che il pezzo è giusto, non che i due lati si parlano |

⚖️ **Come si combinano, ed è il disegno del collaudo**: si **esercita** dal bot
(`collaudo-conversazione`), dal gestionale (console remota) o **dal ponte** (`sonda-ponte-soci`), e si
**misura** con MCP Supabase + `stato-bot`. Un caso è provato quando hai **tutt'e due le metà**: il
gesto visto partire e l'effetto visto atterrare.
🚨⭐ **E le tre strade NON provano la stessa cosa** — dirlo nella relazione è obbligatorio, perché è
esattamente il punto in cui un collaudo si racconta più coperto di quanto sia:
· la **sonda** prova il **contratto** (il ponte risponde come deve) e **salta il bot** — quindi non
  dice niente su come il bot traduce quella risposta in italiano, né sui bottoni;
· il **`collaudo-conversazione`** prova la **catena intera dalle parole del socio**, ed è l'unico che
  copre il bot; misura la **stringa**, non lo schermo (dichiara da sé di non dire «come si vede sul
  telefono»);
· la **console** prova ciò che fa la **segreteria**, cioè il lato da cui nascono i fatti della
  famiglia C.

### 3 · Prerequisiti — si misurano PRIMA, e se mancano si dice

Non iniziare la matrice finché non hai risposta a queste cinque, e **scrivile nella relazione**:

1. **L'id chat del socio di prova su TEST.** Senza, tutta la colonna «esercitato dal bot» resta
   vuota. Cercalo nella memoria/whitelist del bot; se non lo trovi, **chiedilo al committente** —
   non inventarlo. *(È il blocco che ha fermato il collaudo del 07/09.)*
2. **Il bot di prova è vivo e punta a TEST**: `stato-bot` con `quale: prova`. All'avvio il bot
   **dichiara** dove punta — deve dire `🧪 GESTIONALE DI PROVA` o `🧪 prenotazioni SIMULATE`, mai
   `✍️ prenotazioni REALI`. ⛔ Se dice «REALI», **fermati e segnalalo**: il `.env` è puntato male e
   nessuna prova va fatta.
3. **La freschezza del calendario di TEST**: `max(synced_at)` sulle righe `booking` di `cudi…`.
   🧊 Su TEST **nessun cron aggiorna le prenotazioni** — quello che vedi è l'ultimo import a mano, e
   il buco va da ore a giorni. Scrivi il numero nella relazione: è il contesto in cui va letto ogni
   esito della famiglia A.
4. **Una partita di lavoro arrivata dal SYNC** (non nata dal bot), futura, in cui il socio di prova
   compare. 🚨 **È il prerequisito che si sbaglia più spesso**: su TEST una prenotazione **nata dal
   bot** non ha `descrizione`, quindi **non ha roster leggibile**, e il sync successivo la
   **cancella** (`STAFF_RECONCILE_GRACE_MS`). ⇒ Le prenotazioni nate dal bot servono a provare la
   **scrittura**, mai la **rilettura**.
5. **La coda degli avvisi prima di iniziare**: righe totali e `max(created_at)` di
   `pmo_eventi_staff` su `cudi…`. È la riga zero contro cui confronterai tutto il resto.

### 4 · La matrice dei casi

Legenda della colonna **come**: 🤖 = esercitato dal **bot** (`collaudo-conversazione`) · 🖥️ =
esercitato dal **gestionale** (console remota su TEST, `--allow-writes`) · 🔎 = solo **misura**
(MCP/log).

#### A — Il bot LEGGE (`consumer-player-readmodel`)

| # | caso | come | cosa si guarda |
|---|---|---|---|
| A1 | **chi sono**: `action: player` per `phone`, per `member_id`, per `pmo_player_id` — le tre vie devono dare **la stessa persona** | 🤖 `/prenotazioni`, `/io` | `member.pmo_player_id` presente; `member.puo_prenotare` dichiarato (⇒ il bot non deve dedurlo dal codice Matchpoint) |
| A2 | **cosa ho prenotato**: l'elenco, tetto `MAX_BOOKINGS = 10`, le passate di oggi escluse | 🤖 `/prenotazioni` | l'elenco combacia con `pmo_cloud_records` (`booking` + `staff_booking`) letto in parallelo |
| A3 | **con chi gioco**: compagni dello slot, tetto `MAX_COMPAGNI = 8`, l'**ordine** del roster | 🤖 la scheda di una partita | l'ordine nasce **solo** dalla `descrizione` ⇒ è il caso che vuole la partita del prerequisito 4 |
| A4 | **chi la segreteria ha appena tolto** (voce 80): entro `RIMOZIONI_FINESTRA_MIN = 15` un tolto **non** deve comparire in campo | 🖥️ togli un giocatore, poi 🤖 rileggi **subito** | è la finestra fra il gesto e il sync: la correzione viene da `staff_edit`, non dal roster |
| A5 | **partite aperte**: `action: aperte`, e la regola d'ingresso è la **stessa funzione** che poi ammette (`decidiIngresso`) | 🤖 la lista delle aperte | ⭐ **nessuna partita elencata deve poi rifiutare l'ingresso** — è il caso di divergenza fra vetrina e cancello |
| A6 | **le persone**: `action: people`, tetto 100 id, sopra il tetto **rifiuta** (`TOO_MANY_IDS`) invece di troncare | 🔎 | il rifiuto c'è ed è esplicito |
| A7 | **la base di conoscenza**: `action: kb` — griglia slot + kb statica | 🤖 domande su orari/regole | la griglia combacia con `potentialSlotSchedule` |
| A8 | **il livello dimostrato**: la regola vive nel **ponte**, non nel bot | 🤖 «che livello ho?» | il livello annunciato in rubrica e quello nella scheda **coincidono** |
| A9 | 🙅 **non riesco a riconoscerti** (voce 81): con una scheda `member` **doppia** il bot deve dire *«non riesco a riconoscerti… non vuol dire che non ne hai»* + bottone 🔄 Riprova, **mai** «non hai prenotazioni» | 🖥️ crea il doppione su `cudi…`, 🤖 `/prenotazioni`, 🖥️ togli il doppione, 🤖 rileggi | ⭐ **tre stati**: sano → col doppione → sano di nuovo. 🧹 **TEST va rimesso com'era**, e il ritorno allo stato sano è parte della prova |

#### B — Il bot SCRIVE (`consumer-booking-write`)

Le azioni ammesse, misurate: `availability` · `availability_day` · `create` · `cancel` · `leave` ·
`remove` · `add` · `entra` · `apri` · `chiudi` · `verifica`.
La **prova a vuoto** (`dry_run: true`) esiste solo per `leave` · `create` · `cancel` · `remove` ·
`add` — e chiederla altrove deve dare `DRY_RUN_NOT_SUPPORTED` (400).

| # | caso | come | cosa si guarda |
|---|---|---|---|
| B1 | **disponibilità**: `availability` (uno slot) e `availability_day` (la giornata) | 🤖 `/prenota` → un giorno | ⭐ le **etichette delle fasce** (voce 119/164): oggi devono essere **solo pallino e ora** (`🟢 12:30`, `⛔ 18:00`), nessun conteggio e nessun «pieno». Leggi `bottoni[]` nell'esito |
| B2 | **prenota** (`create`) | 🤖 il giro intero fino alla conferma | la copia locale (`staff_booking`) è scritta **nello stesso istante** della risposta al socio (regola dei tre passi, voce 75). 🚨 Poi **non rileggerla dopo un sync**: su TEST sparisce, ed è previsto |
| B3 | **prenota a vuoto** (`create` + `dry_run`) | 🔎 via bot dove previsto | `created` resta **`false`**, e in `would.richiesta` c'è cosa sarebbe partito |
| B4 | **disdici** (`cancel`): solo se il socio è nel roster e **solo se non c'è nessun altro** in campo | 🤖 | il rifiuto quando c'è un altro giocatore; `compagni: [{nome, scheda}]` presente anche nella prova a vuoto |
| B5 | **esco io** (`leave`): la partita **resta in piedi** per gli altri; rifiuta se sono l'unico | 🤖 | ⭐ **le scritture sono DUE**: il gestionale **e** la copia in app. L'esito `copia_in_app` c'è su **ogni** risposta — se manca, il socio torna in campo alla lettura dopo |
| B6 | **tolgo un altro** (`remove`): passa **solo chi ha organizzato**; il bersaglio dev'essere in campo, non me stesso, e **non** un nome doppio in partita | 🤖 | i tre rifiuti, uno per uno. È a **senso unico**: rimettere una persona il bot non lo sa fare |
| B7 | **aggiungi / entra** (`add`, `entra`) | 🤖 | `entra` usa il **mio** id, `add` quello passato: la differenza si vede nel roster dopo |
| B8 | **apri / chiudi** una partita aperta | 🤖 | il diritto (solo chi ha organizzato) e la **coerenza del roster**: se i nomi non tornano con le righe, il gestionale **rifiuta** invece di indovinare |
| B9 | **verifica** | 🤖 | cosa risponde a fronte di uno slot noto |
| B10 | 🚨 **il verdetto della scrittura**: le tre parole che il bot può sentire sono **`fatto`** · **`scrittura_rifiutata`** · **`esito_ignoto`** | 🔎 su ogni caso B | ⛔ **nessun nome interno** nel testo (guardia `NOMI_INTERNI`). Un rifiuto senza motivo comprensibile deve diventare *«il circolo non ha dato un motivo comprensibile»*, non un codice |
| B11 | **azione inesistente** → `INVALID_ACTION` (400); **`dry_run` dove non esiste** → `DRY_RUN_NOT_SUPPORTED` (400) | 🔎 | i due rifiuti sono espliciti — è ciò che rende affidabile la prova a vuoto |
| B12 | **la ricevuta** (voce 70): un gesto fatto **dal bot** non deve tornare al socio come avviso della segreteria | 🤖 poi 🔎 la coda | in `pmo_eventi_staff` l'esito `gesto_dal_bot`, e **nessun** avviso duplicato verso chi ha fatto il gesto |

#### C — Il gestionale CONSEGNA i fatti della segreteria (`consumer-staff-events`)

I gesti sono **cinque**, e sono tutti quelli che esistono: `aggiunto` · `tolto` · `annullata` ·
`spostata` · `formazione`.

🚨⭐⭐ **IL LIMITE STRUTTURALE DI QUESTA FAMIGLIA, e va letto prima di progettare i casi**: il bot
di **prova** ha i giri degli avvisi **silenziati** (`silenziaAvvisi`, regola del 5/08) ⇒ **non chiama
mai `consumer-staff-events`**. Quindi su TEST la catena C **non si chiude fino al messaggio**: si
prova fino alla **coda** (che il fatto giusto ci sia, per le persone giuste, col contenuto giusto) e
lì si dichiara il confine. Non provare a scavalcarlo accendendo gli avvisi del bot di prova, e
**non** spostare la prova sul bot dei soci: quello parla a persone vere.

| # | caso | come | cosa si guarda |
|---|---|---|---|
| C1 | **aggiunto** un giocatore | 🖥️ dal calendario di TEST | in `pmo_eventi_staff` un fatto per **ciascuno** di quelli in campo, non solo per chi si è mosso |
| C2 | **tolto** un giocatore | 🖥️ | chi è stato tolto riceve il **suo** fatto; gli altri il `formazione` |
| C3 | **annullata** | 🖥️ | ⭐ **nessuno si salta**, nemmeno il primo dell'elenco (regola del 23/08): su una partita di uno solo, l'unico fatto deve esserci |
| C4 | **spostata** | 🖥️ | le coordinate del fatto sono quelle **di arrivo**, e c'è il campo `da`. ⛔ Chi è stato **tolto** durante lo spostamento riceve le coordinate **vecchie** e **nessun `da`** |
| C5 | **formazione** | 🖥️ | `entrati[]` / `usciti[]` presenti, **«Ospite» compreso** — si può nominare chi non si può avvisare |
| C6 | **toccato ≠ cambiato** | 🖥️ apri una scheda e salvala **senza modificare niente** | ⇒ **zero** fatti nuovi in coda. È il caso che dimostra che il rilevatore guarda i **dati**, non gli eventi |
| C7 | **la raffica si fonde**: due minuti di quiete, poi lo **stato finale** | 🖥️ tre gesti di fila sulla stessa partita | in consegna esce il **netto**, non tre messaggi |
| C8 | **gli esiti della coda**: `passato_al_bot` · nome non riconosciuto · netto nullo | 🔎 | ⚠️ `passato_al_bot` **non** vuol dire «il socio lo saprà»: dice solo che è uscito verso il bot |
| C9 | **il tipo con le parole del gestionale**: `lezione` / `partita`, **mai** `Lezione Libera` | 🔎 | è la regola del vocabolario: nessuna parola di Matchpoint arriva al bot |
| C10 | **la chiusura atomica**: due giri sulla stessa coda non consegnano due volte | 🔎 | nessuna riga con due consegne |

#### D — Il test di livello

| # | caso | come | cosa si guarda |
|---|---|---|---|
| D1 | **link personale** (`consumer-assessment-link`): il socio è già riconosciuto ⇒ il link porta il gettone | 🤖 | il numero di domande annunciato combacia con `domandeTotaliPreviste` (l'import da `assessment-quiz/passi.js` esiste apposta) |
| D2 | **promemoria del livello** | 🔎 | `GIORNI_TRA_PROMEMORIA` rispettato |
| D3 | **la scelta del socio** (`consumer-assessment-decision`): «mi fermo» / «riprovo» | 🤖 il bottone | la scelta atterra su `member_decision` + `member_decision_at` in `self_assessments` — **sulla scheda**, non nella memoria del bot |
| D4 | **i sei rifiuti**, uno per uno: scelta inventata · scheda non mia o inesistente (**stesso** rifiuto nei due casi) · prova senza `pass` · scheda già applicata · scheda superata da una più recente · la prova che **esaurisce** il giro | 🔎 | ⭐ il bottone vecchio di Telegram resta lì per sempre: schiacciarlo **non deve poter niente** |

#### E — Le guardie trasversali (si provano una volta, valgono su tutto)

| # | caso | cosa si guarda |
|---|---|---|
| E1 | **secret assente** → **503** `BRIDGE_DISARMED`: la funzione **fallisce chiusa** | nessun ponte risponde senza secret |
| E2 | **nessun nome interno** in nessuna risposta verso il bot | `NOMI_INTERNI` su **otto** uscite di `consumer-booking-write` |
| E3 | **il bot non parla con nessun altro**: zero riferimenti a worker/Matchpoint/Hetzner nel suo codice fuori dai commenti, e **quattro** sole edge chiamate | `grep` nel repo del bot |
| E4 | 🎯 **la prova del futuro**: *il giorno in cui Matchpoint si spegne, il bot non si tocca* | se un caso richiede che il bot conosca Matchpoint, **quel caso è un difetto**, non una prova |

### 5 · Le sette trappole di TEST — un verde che le ignora è falso

1. 🧊 **Il calendario di TEST è una fotografia**: nessun cron aggiorna le prenotazioni. Una prova
   che dipende da dati freschi **riesce mostrando il passato**, che è peggio del fallire.
2. 🚨 **Una prenotazione nata dal bot non sopravvive al sync** e **non ha roster leggibile**:
   serve a provare la scrittura, mai la rilettura. Lanciare il sync per «sbloccarla» la **cancella**.
3. 🔇 **Il bot di prova ha gli avvisi silenziati** ⇒ la famiglia C non si chiude fino al messaggio.
4. ⏱️ **Il registro del bot è in ora locale, il database in UTC**: un regex sull'ora sbagliata trova
   zero con la stessa sicurezza con cui troverebbe la verità.
5. 🔎 **`stato-bot` mostra solo le ultime 30 righe che combaciano**: regex larghi tagliano via
   proprio le righe vecchie che cerchi.
6. 0️⃣ **Uno zero letto troppo presto non dice «funziona»**: dice che il caso non si è ancora
   presentato. Prima di scrivere «nessun doppione», verifica che la finestra in cui il difetto
   nascerebbe sia stata **attraversata**.
7. 🌙 **Il sync ha una pausa notturna 01:00-06:00** (vale su PROD, e la forma del ragionamento vale
   qui): in certe finestre l'attesa scade senza verdetto, e la risposta onesta è «non lo so ancora».

### 6 · Come si consegna

Scrivi la relazione in `docs/collaudo-e2e-<data>.md` e committala su `test-preview`
(⚠️ `docs/` è sorvegliato da `guard-worker-sync`: i due rami devono restare identici ⇒ prima
`test-preview`, poi la PR su `main`, come dice il punto 4bis di `CLAUDE.md`).

La relazione ha **quattro** parti, e la terza è quella che le dà valore:

1. **I prerequisiti misurati** (§3), coi numeri: freschezza del calendario, stato del bot, riga zero
   della coda.
2. **La matrice compilata**: una riga per caso, con ✅ / ❌ / ⏳ **non provato**, l'**ambiente**
   accanto a ciascuno (qui sempre TEST — scriverlo lo stesso), e il **come** (run del collaudo, sha,
   query).
3. ⚠️ **Cosa NON è stato provato e perché.** Include per forza: la famiglia C oltre la coda, tutto
   ciò che vuole PROD, e ogni caso rimasto senza prerequisito. *Un collaudo che non ha una sezione
   «non provato» non è completo: è un collaudo che non si è guardato.*
4. **I difetti trovati**, ciascuno con: cosa hai fatto, cosa ti aspettavi, cosa è successo, e la
   **query o il run** che lo dimostra.

🚨 **Sui difetti**: aprire una voce nuova in `docs/lavori/README.md` è permesso **solo** se il
difetto nasce da una **misura** fatta in questo collaudo — mai da un'idea o da un sospetto. E la
regola dei conteggi vale: il numero delle voci è dichiarato in **due** posti e `guard-docs-truth`
li confronta.

🧹 **E TEST si rimette com'era**: doppioni tolti, giocatori rimessi, partite di prova richiuse.
Quello che non riesci a ripulire, **scrivilo** — una prova che lascia un residuo non dichiarato è
un difetto che qualcun altro troverà come se fosse vero.

### 7 · L'ordine in cui eseguire

Non seguire l'ordine della tabella: segui questo, che è l'ordine in cui i prerequisiti si
sbloccano a vicenda.

1. §3 — i cinque prerequisiti. **Se manca l'id chat, dillo subito** — ma non fermarti: senza il bot
   restano eseguibili le famiglie **C** ed **E** (🖥️ e 🔎) **e** la parte di **B** che la
   `sonda-ponte-soci` raggiunge (`availability_day`, `kb`, `verifica`, `create_prova`). ⇒ Quello che
   manca davvero è **il bot come traduttore**, e lo si scrive così, invece di dichiarare non provata
   tutta la famiglia.
2. **E1-E4** — le guardie: sono veloci e, se una è rossa, cambia come si leggono tutte le altre.
3. **A** — le letture: non scrivono niente, e ti danno lo stato di partenza.
4. **C** — i gesti della segreteria: si esercitano dal gestionale e si misurano in coda.
5. **B** — le scritture dal bot: per ultime, perché muovono i dati su cui poggiano A e C.
6. **D** — il test di livello: indipendente dagli altri.

Alla fine, l'avviso di chiusura nella forma della regola del 04/09: 🟢 **«puoi operare»** — con
cosa è verde e **cosa non è stato provato** — oppure 🔴 **«non sono pronto»**, con cosa manca. Si
dichiara **uno stato del sistema**, non un compito per lui.
