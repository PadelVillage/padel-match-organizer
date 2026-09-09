# Passaggio di consegne — 09/09/2026, mattina (104ª sessione)

> **Prompt da incollare nella chat nuova.** Copia tutto quello che sta fra le due righe.

---

## 📋 PROMPT

> Riprendi il progetto **PADEL MATCH ORGANIZER**.
>
> Leggi PRIMA, in quest'ordine: **`CLAUDE.md`** (il postulato in testa, e la sezione *«IL GESTIONALE
> DI TEST DIVENTA IL VERO»*), **`docs/lavori/README.md`**, e questo file.
>
> ### 🚨 PRIMA DI CREDERE A QUALUNQUE CONFRONTO
> Il checkout locale nasce **stantio e shallow**, e `git status` dice «allineato» mentendo. ⇒
> `git fetch --unshallow origin && git fetch origin main test-preview && git reset --hard origin/test-preview`
>
> 🚨⭐⭐ **E IL `CLAUDE.md` CHE TI VIENE CARICATO ALL'AVVIO PUÒ ESSERE LA COPIA VECCHIA.** È
> successo due sessioni di fila. ⇒ **Dopo il `reset --hard`, rileggi `CLAUDE.md` dal disco**
> (`grep -n '^## ' CLAUDE.md`) invece di fidarti di quello che ti è arrivato nel prompt.
> 📌 *Un documento iniettato nel contesto non ha una data addosso: sembra attuale perché è il primo
> che leggi.*
>
> ---
>
> ## 🟢 DA DOVE SI RIPARTE
>
> **La cassa c'è.** La 180 (gli importi), la metà GRIGLIA della 183 e **tutta la 181** sono in
> servizio su `cudi`: una prenotazione nasce su una fascia, con un prezzo, e da quel prezzo si
> incassa — nel gestionale, senza passare da Matchpoint, con lo storno e col borsellino che si
> muove davvero.
>
> ⇒ **Il prossimo lavoro è il BOT.** Sono **tre voci che aspettano la stessa identica cosa** — un
> gesto vero contro le edge nuove di `cudi`:
> · **177** (i due lettori del bot leggono la griglia nuova: in servizio, mai esercitata),
> · **183** (`create` non prenota più fuori fascia: in servizio, mai attraversata da un `create` vero),
> · **185**, metà BOT (il calendario del listino via `availability_day`).
> 🎯 **Un solo gesto le chiude tutte e tre**, ed è la cosa a più alto rendimento della lista.
>
> ⛔ **E c'è un limite da sapere prima di provarci**: `consumer-booking-write` sta dietro
> `CONSUMER_BRIDGE_SECRET`, che **non sta nell'ambiente cloud** ⇒ chiamarla non si può. La strada è
> il **bot di prova** (che punta a `cudi`), cioè un messaggio da uno dei cinque telefoni di casa.
> ⚠️ Che quel bot sia vivo e puntato bene **non è stato verificato**: il suo repo è fuori dal
> perimetro della sessione cloud e sulla VM non c'è shell. Se un gesto non lascia nessuna riga nei
> log di `cudi`, la prima cosa da guardare è quello, non il codice.
>
> ---
>
> ## ✅ FATTO IN QUESTA SESSIONE
>
> **① LA METÀ GRIGLIA DELLA 183 — `create` non prenota più fuori fascia.**
> Il controllo vecchio guardava solo la finestra 07:00-23:30, con scritto accanto *«limiti larghi:
> l'autorità vera è Matchpoint»*. **Era vero** — e il distacco spegne quell'autorità.
> 📌 *Un controllo che delega non è un controllo: è un rimando, e vale finché vive chi lo riceve.*
> ⚖️ E non è forma: il prezzo vive sulla **fascia**, quindi una prenotazione fuori griglia non ha un
> importo e non lo avrà mai ⇒ chiudere la griglia rende vera **per costruzione** la frase su cui
> poggia la cassa.
>
> **② LA 181, TUTTA — la cassa è nostra, e il borsellino si muove.**
> Non è codice nuovo: è la **simulazione promossa a vera**, con tre cambi + il borsellino.
>
> **③ E LA COSA PIÙ IMPORTANTE DA PORTARSI DIETRO SONO DUE DIFETTI TROVATI DAI BANCHI**, non le cure
> (stanno più sotto, e valgono oltre questo progetto).
>
> ---
>
> ## 🥇🚨 LE TRE COSE DA PORTARSI DIETRO
>
> **①⭐⭐ UN CANCELLO CHE FALLISCE CHIUSO NON RESTA CHIUSO SE LO SI NEGA.**
> `pmoGestionaleCollegatoAlCircolo(url)` fallisce chiuso **per la SUA domanda** — *«nel dubbio non
> chiamo il circolo»* — e torna `false` anche su un url **storpiato**. La cassa nativa era scritta
> come `!pmoGestionaleCollegatoAlCircolo(url)`: quel `false` diventava *«la cassa è nostra»* ⇒ con
> una configurazione illeggibile l'app avrebbe **registrato denaro** credendo di stare altrove.
> 📌 *Il fallimento sicuro di una domanda è il fallimento pericoloso della domanda opposta: «nel
> dubbio non chiamo» e «nel dubbio incasso» sono la stessa riga letta al contrario.*
> ⇒ Una negazione non eredita la sicurezza dell'originale. Si chiede un **fatto positivo**.
>
> **②⭐⭐ UNA GUARDIA CHE CERCA UNA PAROLA PROVA CHE LA PAROLA C'È, NON CHE IL CODICE SUCCEDA.**
> Il controllo del saldo era scritto in linea e il banco lo sorvegliava cercando
> `SALDO_INSUFFICIENTE` nel corpo della funzione. Spegnendolo (`if (false)`) **le parole restavano
> tutte** e il sabotaggio **restava verde**. ⇒ La regola si è **staccata in una funzione pura**, e il
> banco la **esegue**. Poi il sabotaggio cade.
> 🔎 La forma generale: quando un sabotaggio resta verde, la domanda non è «come lo riscrivo» ma
> «cosa mi sta dicendo». Qui diceva: *stai leggendo, non eseguendo*.
>
> **③ IL NUMERO STA IN DUE POSTI, E LA GUARDIA VA REPLICATA INTERA.**
> `guard-docs-truth` è andata rossa su tutti e due i rami: i conteggi sono dichiarati nel **titolo**
> della sezione **e** nella **tabella in cima**, e io avevo replicato in locale solo gli `awk` dei
> titoli. Il verde della replica parziale l'ho letto come il verde della guardia.
> 📌 *Una replica parziale di un controllo non dà una risposta parziale: dà una risposta piena a
> un'ALTRA domanda, ed è indistinguibile da quella giusta.*
> ⇒ **Si estrae il passo dal workflow e si gira quello.** Come: cercare `- name: I conteggi` in
> `.github/workflows/guard-docs-truth.yml`, prendere il blocco `run: |`, sostituire il
> `git show origin/$REF:$F` con un `cp` dal disco, e lanciarlo.
>
> ---
>
> ## 📊 STATO, misurato a fine sessione
>
> | | |
> |---|---|
> | **PROD** | `v6.397`, **intoccata**. Su `main` sono andati solo documenti (PR #1504 · #1505 · #1506 · #1507) |
> | **TEST** (il sistema nuovo) | `v6.411` viva |
> | guardie | `guard-worker-sync` · `guard-docs-truth` **verdi su tutti e due i rami** |
> | lista lavori | 🔴 **4 urgenti** (177 · 178 · 183 · 185) · 📋 **4 in coda** (182 · 184 · 186 · 187) · 📦 **173 chiuse** |
> | banco | **133 file verdi, 0 rossi** (7 Deno saltati) |
> | dati su `cudi` | 30 `staff_booking` vive · **0 nel futuro** · 2605 `payment` · **0 righe `pmo_cassa`** (le prove sono state ripulite) · 83 `wallet_balance` · **0** `wallet_txn` |
>
> ---
>
> ## ⛔ COSA NON DARE PER FATTO
> · **PROD non si tocca** — unica eccezione dichiarata: la **182**, in lettura, sull'anagrafica, una volta sola;
> · **`scritturaAlCircoloConsentita` è cablata sul ref di PROD** (11 copie byte-identiche) e ha **due
>   gemelle in pagina** — `pmoGestionaleCollegatoAlCircolo` (voce 180) e `pmoCassaNativaPer` (voce
>   181). ⛔ **Nessuna delle tre è una simulazione da smontare al passaggio**: sono le barriere da
>   tenere, e un `grep PMO_IS_TEST_ENV` non le trova. È apposta;
> · **su PROD non si incassa mai**, e non scade: di lì un incasso passa da **Matchpoint**;
> · la lista delle simulazioni `PMO_IS_TEST_ENV` **non è chiusa** (voce 184): `PMO_PAYMENTS_SIMULATE`
>   è stata **cancellata** da questa sessione, ma restano vive almeno `WA_TEST_OVERRIDE_NUMBER` (ogni
>   WhatsApp su **un solo telefono**), `PMO_BOOKINGS_SIMULATE` e il dirottamento delle email
>   dell'autovalutazione. Prima del passaggio si cerca **tutta**
>   (`grep -n 'PMO_IS_TEST_ENV\|isTestEnv()'`), non fidandosi di nessun elenco scritto;
> · **il bot non è mai stato provato** contro le edge nuove: il banco le copre, nessun gesto vero ci
>   è passato. È la prova che manca a **177 · 183 · 185**;
> · **il bot dei soci è ancora attaccato a PROD**, e la decisione è già presa da lui: **si sposta al
>   passaggio** (voce 184), non adesso. ⇒ *Non riaprire la domanda.*

---

## 🔧 DETTAGLI OPERATIVI (fuori dal prompt)

### Cosa è nato oggi, e dove sta

| pezzo | dove |
|---|---|
| la regola della **griglia** | `supabase/functions/consumer-booking-write/fasce-prenotabili.ts` → `verdettoSlot` (modulo puro, copiato byte-identico anche in `consumer-player-readmodel/`) |
| l'aggancio a `create` | `consumer-booking-write/index.ts`, nel blocco comune **prima** di `const slot: SlotInput` |
| il **cancello della cassa** | `index.html` → `pmoRefSupabaseDellUrl` · `pmoCassaNativaPer` · `pmoCassaNativa`, accanto a `pmoGestionaleCollegatoAlCircolo` |
| la **chiave deterministica** | `_pmoCassaKey` (+ `PMO_CASSA_SOURCE`, `PMO_CASSA_SOURCE_VECCHIA`) |
| l'incasso e lo storno nativi | `_pmoCassaScriviIncasso` · `_pmoCassaStorna` (erano `_pmoSim*`) |
| il **mastro del borsellino** | `_pmoWalletPesoRiga` · `_pmoWalletChiavi` · `_pmoWalletDeltaDi` · `_pmoWalletDeltaAggiorna` · `_pmoSocioLocalId`, e la somma dentro `_walletResolve` |
| la regola dello **scoperto** | `_pmoCassaVerdettoBorsellino` (pura), applicata in `_pmoCollectPayment` |

### I tre banchi nuovi

| file | cosa difende |
|---|---|
| `test/la-griglia-e-un-limite.test.mjs` | i cinque rifiuti, che valgano **solo per `create`**, e che le due copie del modulo restino identiche |
| `test/la-cassa-e-nostra.test.mjs` | il cancello sul ref, la chiave deterministica, e ⭐ che la cassa **non si ottenga negando** l'altro cancello |
| `test/il-borsellino-si-somma.test.mjs` | il peso di una riga, l'attribuzione **mai per nome**, la somma sull'apertura, e la regola dello scoperto **eseguita** |

⚠️ E un banco esistente è stato **aggiornato, non allentato**:
`test/il-saldo-si-rilegge-dopo-il-gesto.test.mjs` montava `_pmoCollectPayment` in un contesto `vm` e
cadeva con `ReferenceError` perché la funzione è cresciuta. Le regole della cassa ci si iniettano
**vere** (estratte dal sorgente), non finte.

### Prove fisiche fatte (TEST 6.409 → 6.411, console remota, `--allow-writes`)
- il cancello sulla pagina viva: `cassaNativa: true` su `cudi`, **`false`** per il ref di PROD,
  **`false`** per un url storpiato, `PMO_PAYMENTS_SIMULATE` non esiste più;
- **incassati 12,00 € in contanti** sulla partita vera dell'08/09 Campo 2 18:00 → riga `pmo_cassa`
  `paid`, chiave `paycassa|2026-09-08|2|18:00|fabio de luca`;
- ⭐ **premuto due volte → una riga sola**;
- la sezione **Incassi** la vede; il **«🧹 Pulisci simulazioni» cancella 0** e la risparmia; lo
  **storno** la mette a `void`;
- 👛 **col borsellino** (Carlo Ceriali, `idCliente 168`, credito 33,00 €): incasso da 12,00 →
  **21,00 €** (apertura 33,00, movimenti −12,00) · tentativo da **100,00 → `SALDO_INSUFFICIENTE`**,
  saldo fermo · **storno → 33,00 €**;
- 🧹 **TEST ripulito**: le due righe di prova cancellate, 0 `pmo_cassa`, 2605 pagamenti e 83
  fotografie come prima.

⛔ **Cosa NON è stato provato**: nessun incasso è passato per **le mani della segreteria**. I gesti
li ha fatti la console chiamando le funzioni; i bottoni, le pastiglie e il saldo che si vede scendere
sulla scheda sono stati **letti nel codice**, non guardati su uno schermo.

### 🩹 Difetti trovati per strada, e corretti
- **una nota della UI che mentiva**: diceva *«⛔ Da qui non si incassa — il gestionale rifiuta»*, ma
  il ramo simulato tornava **prima** di chiamare qualunque edge e scriveva davvero.
  📌 *Una nota sulla UI è un'affermazione sul codice: si controlla leggendo il ramo che descrive.*
- **lo storno tornava `simulated: true`** dopo aver fatto la cosa davvero — trovato **durante** la
  prova fisica, non leggendo;
- **`pmo_calendario_effettivo` risponde `AUTH_REQUIRED`** a chi la chiama dal database senza panni:
  accetta **staff** o **`service_role`** (che è quello che usa l'edge). Il primo `ok:false` sembrava
  un guasto del calendario, ed **ero io nel posto sbagliato**;
- **un commit finito sul ramo sbagliato**: dopo il merge di una PR ero rimasto sul ramo dei
  documenti, e il `checkout -B` successivo l'ha lasciato orfano — il file era tornato indietro senza
  dirlo. 📌 *Dopo un merge si torna sul ramo di lavoro: un commit sul ramo sbagliato non fallisce,
  riesce altrove.* Ripescato dal reflog.

### Misure da non rifare
| cosa | valore |
|---|---|
| fasce su `cudi` | **39**, tutte con prezzo, tutte da **90′**, scritte in un solo salvataggio l'08/09 20:35:22 |
| il listino vero | lun-gio: 12:30 e 14:00 → 10 € · 18:00 → 12 € · **19:30 → 13 €** · 21:00 → 12 € · venerdì 7 fasce (10 € fino alle 17:30, poi 12 €) · sabato e domenica **tutte a 10 €** |
| ⚠️ i documenti dicevano | «41 fasce», «8 € il sabato» — **corretto il 09/09**: un prezzo da 8 € **non esiste** |
| `staff_booking` vive | 30, **nessuna nel futuro** (l'ultima è dell'08/09) |
| `payment` su `cudi` | 2605 — di cui `pmo_gift` **2** (la scheda diceva 33: era un'altra misura) |
| borsellino | **83** `wallet_balance` (fotografie del 07/09 21:31), **0** `wallet_txn` |
| ruolo della console su TEST | `staff`, tutti i permessi |

### PR di oggi su `main` (solo documenti)
**#1504** la 183/GRIGLIA · **#1505** la 181 promossa · **#1506** i conteggi · **#1507** la 181 chiusa.

### Attrezzi
- console remota: `cd tools/verifica-browser && npm install` (il container nasce senza
  `node_modules`), poi `node console.mjs --env test --eval "…"`. Le `PMO_VERIFY_*` **ci sono già**.
  Su TEST `--allow-writes` si usa senza chiedere; su PROD si dice prima.
- ⭐ **Sulla pagina viva sono su `window`**: `pmoCassaNativa`, `pmoCassaNativaPer`, `_pmoCassaKey`,
  `_pmoCollectPayment`, `_pmoVoidPayment`, `_walletResolve`, `_walletCents`, `pmoLoadWalletBalances`,
  `_incassiFetch`, `_pmoSimCleanupPayments`, `giocatori`.
  ⛔ Per far scattare la conferma da sola: `window.__pmoPaySimAuto = true` — **mai**
  `__pmoPayHarness`, che spegne la cassa nativa.
- Banco: `find supabase consumer-app tools test \( -name '*.test.mjs' -o -name '*.test.ts' \)` poi
  `node --experimental-strip-types` su ciascuno; **7 sono Deno** e vanno saltati.
- Sintassi di `index.html`: estrarre i 5 blocchi `<script>` inline e passarli a `node --check`.
- I conteggi di `guard-docs-truth` si replicano **estraendo il passo dal workflow**, non a mano.
