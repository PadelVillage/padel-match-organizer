# Passaggio di consegne — 09/09/2026, notte (103ª sessione)

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
> successo stanotte: il file iniettato nel contesto era quello del commit da cui il container era
> partito — **sette commit indietro** — e non conteneva affatto la sezione *«IL GESTIONALE DI TEST
> DIVENTA IL VERO»*, cioè la riga che cambia come si legge tutto il resto.
> ⇒ **Dopo il `reset --hard`, rileggi `CLAUDE.md` dal disco** (`grep -n '^## ' CLAUDE.md`) invece di
> fidarti di quello che ti è arrivato nel prompt.
> 📌 *Un documento iniettato nel contesto non ha una data addosso: sembra attuale perché è il primo
> che leggi.*
>
> ---
>
> ## 🟢 DA DOVE SI RIPARTE
>
> **La 180 è CHIUSA.** La strada fuori dal recinto **non esiste più**: il gestionale nuovo non
> chiama più il Matchpoint del circolo, né per scrivere né per leggere.
>
> ⇒ **Il prossimo lavoro è la 181, la cassa nativa**, e adesso ha su cosa poggiare: gli importi
> nascono dal listino, li prende chi entra dopo, e le righe che non li avevano si riempiono
> all'apertura della scheda.
> ⚠️ **Ma prima leggi il limite dichiarato**, o la cassa nasce su un numero che non c'è: 📏 delle
> **30** `staff_booking` vive su `cudi`, **29 sono nel PASSATO** e il calendario che l'app carica
> parte da oggi ⇒ per quelle il prezzo è `null` **per costruzione** e non si scriverà mai.
> Oggi non costa niente (sono avanzi dell'era di prova), ma una cassa che dà per scontato «tutte le
> righe hanno un importo» sbaglierebbe proprio lì.
>
> 🚨 **E dalla 181 resta fuori una cosa, per regola ferma**: dal gestionale **non si salva mai un
> pagamento verso Matchpoint** (⇒ *🔌 IL DISTACCO DA MATCHPOINT* in `CLAUDE.md`). La cassa nuova
> nasce **nostra**; quella vecchia non si tocca.
>
> ---
>
> ## ✅ FATTO IN QUESTA SESSIONE — la 180, tutta
>
> **L'ordine non era quello che sembrava, ed è la decisione che vale più del codice: prima si
> RIEMPIE, poi si CHIUDE.** Il passaggio di consegne precedente proponeva di chiudere la lettura
> con un ripiego («dal vivo quando l'importo non è nato qui»). Chiudere per primo avrebbe reso
> **cieca la scheda su 28 righe su 30**; e il ripiego sarebbe rimasto esercitato in silenzio fino
> al distacco per poi **fallire il giorno in cui non c'è più nessuno a rispondere**.
> 📌 *Una strada di riserva che non si percorre mai non è una riserva: è un pezzo di codice che
> nessuno ha visto funzionare, messo lì per il giorno in cui servirà.*
>
> **① IL QUARTO ESITO DELLA CASELLA — e non era in programma: era un difetto GIÀ IN SERVIZIO,
> creato dalla cura della notte prima.** La regola ④ della 180 dice *«mai `lettoAt` su un importo
> nato qui»*, ed è giusta. Ma `_pmoImportoCasella` conosceva **solo** `lettoAt` per distinguere le
> provenienze ⇒ un prezzo del listino cadeva nel ramo «letto adesso», e la scheda lo mostrava alla
> segreteria **come se il circolo l'avesse appena confermato**.
> 📌 *La regola ④ ha tenuto onesto il database e ha perso lo schermo: una provenienza non è salva
> finché non arriva agli occhi.*
> ⇒ `natoQui`; **`lettoAt` VINCE** su `origineImporto` (i tre esiti con un numero sono esclusivi
> **per costruzione**, non per disciplina); il «da» del popup lo dichiara — `13,00 (dal listino)`,
> ed è il punto in cui si chiede a una persona di confermare del denaro; e la marca **si toglie**
> quando l'importo lo decide la segreteria.
>
> **② CHI ENTRA DOPO paga come chi c'era già** — il prezzo lo dice il gestionale
> (`pmoCalendarioMappa`, cioè `pmo_calendario_effettivo`) e si chiede per lo slot di **quella**
> prenotazione, non per «adesso».
>
> **③ LE RIGHE CHE C'ERANO GIÀ** si riempiono **all'apertura della scheda**, idempotente — non con
> una migrazione, perché *una migrazione invecchia*: cura le righe di oggi e non quelle che nascono
> domani da una strada che ancora non conosciamo.
>
> **④ ANCHE LA LETTURA STA DENTRO IL RECINTO.** `matchpoint-bookings-edit` con `read: true`
> **saltava** `scritturaAlCircoloConsentita` (`if (!readOnly && …)`): era l'ultimo punto di contatto
> fra il sistema nuovo e quello vecchio, e non si vedeva **perché una lettura non sembra un gesto**.
> 📌 *Un recinto che lascia passare chi «guarda soltanto» non è un recinto a metà: è un recinto con
> una porta, e la porta la trova chiunque non stia cercando di forzare niente.*
> Chiusa **da due parti**: l'edge rifiuta (`503 LETTURA_AL_CIRCOLO_NON_PREVISTA`, e vale **per
> chiunque chiami** — anche per una copia vecchia dell'app rimasta aperta), e l'app non chiama più.
>
> ---
>
> ## 🥇🚨 LA COSA PIÙ IMPORTANTE DA PORTARSI DIETRO
>
> **IL CANCELLO NUOVO GUARDA IL REF SUPABASE, NON L'HOSTNAME — e sta FUORI dalla lista delle
> simulazioni da smontare.**
>
> `pmoGestionaleCollegatoAlCircolo(supabaseUrl)` (in `index.html`, accanto alle costanti
> d'ambiente) è la **gemella in pagina** di `scritturaAlCircoloConsentita`: stessa domanda, stesso
> fatto. Fallisce **chiusa** (url mancante, storpiato o somigliante ⇒ *non lo chiamo*).
>
> ⚠️ **Perché non `PMO_IS_TEST_ENV`**: quella risponde *«sto su un indirizzo che comincia per
> `test.`»*, che è una domanda diversa e che **il distacco farà scadere**. Il giorno in cui il
> gestionale nuovo viene servito da un indirizzo che non comincia per `test.` quella risposta si
> **ribalta**, e ogni riga che ci si appoggia ricomincia a chiamare un Matchpoint che non esiste
> più. 📌 *Un ambiente si riconosce da CON CHI parla, non da come si chiama.*
>
> ⛔ **Quindi quando farai la 184 (smontare le simulazioni `PMO_IS_TEST_ENV`), questa riga NON è una
> di quelle**: non è una finzione da togliere, è la barriera da tenere. Un `grep -n 'PMO_IS_TEST_ENV'`
> non la trova, ed è apposta.
>
> ---
>
> ## 📊 STATO, misurato a fine sessione
>
> | | |
> |---|---|
> | **PROD** | `v6.397`, **intoccata**. Su `main` sono andati solo documenti (PR #1501, #1502) |
> | **TEST** (il sistema nuovo) | `v6.408` viva |
> | guardie | `guard-worker-sync` · `guard-docs-truth` **verdi su tutti e due i rami** |
> | lista lavori | 🔴 **4 urgenti** (177 · 178 · 183 · 185) · 📋 **5 in coda** (181 · 182 · 184 · 186 · **187**) · 📦 **172 chiuse** |
> | banco | **130 file verdi, 0 rossi** (7 Deno saltati) |
> | dati su `cudi` | 30 `staff_booking` vive · **3** con importi · **1** dal listino · **1 sola nel futuro** · nessuna prova lasciata in giro |
>
> ---
>
> ## ⛔ COSA NON DARE PER FATTO
> · **PROD non si tocca** — unica eccezione dichiarata: la **182**, in lettura, sull'anagrafica, una volta sola;
> · **`scritturaAlCircoloConsentita` è cablata sul ref di PROD** (11 copie byte-identiche): va tenuta
>   **per sempre**. E adesso ha una gemella in pagina, che vale lo stesso;
> · **su PROD non si salva mai un pagamento**, e dal 07/09 **su niente**: il gestionale non fa
>   pagamenti verso Matchpoint;
> · la lista delle simulazioni `PMO_IS_TEST_ENV` **non è chiusa** (voce 184): prima del passaggio va
>   cercata tutta (`grep -n 'PMO_IS_TEST_ENV\|isTestEnv()'`). Ne restano vive almeno
>   `WA_TEST_OVERRIDE_NUMBER` (ogni WhatsApp su **un solo telefono**), `PMO_PAYMENTS_SIMULATE` e il
>   dirottamento delle email dell'autovalutazione;
> · **il bot non è stato provato** contro le edge nuove: il banco le copre, nessun gesto vero ci è
>   passato. È la prova che manca anche alla **177**;
> · **il bot dei soci è ancora attaccato a PROD**, e la decisione è già presa da lui: **si sposta al
>   passaggio** (voce 184), non adesso. ⇒ *Non riaprire la domanda.*

---

## 🔧 DETTAGLI OPERATIVI (fuori dal prompt)

### Cosa è nato stanotte, e dove sta

| pezzo | dove |
|---|---|
| il **quarto esito** della casella | `index.html`, `_pmoImportoCasella` (+ `_pmoImportoDa`, il «da» del popup) |
| il segno visivo | `.svc-pl-eur-listino { border-style: dotted }` — **puntinato**, distinto dal *tratteggiato* del «ricordato» |
| il prezzo per il giocatore aggiunto | `_pmoOraPulita` · `_pmoPrezzoDelloSlot` · `_pmoImportiDalListino`, agganciati in `staffCalApplyLocalGiocatori` |
| il riempimento all'apertura | `_staffCalRiempiImportiDalListino`, chiamato in `staffCalEditPlayers` **prima** di leggere il roster |
| il cancello | `pmoGestionaleCollegatoAlCircolo`, accanto a `PMO_PROD_SUPABASE_PROJECT_REF` |
| il recinto in lettura | `supabase/functions/matchpoint-bookings-edit/index.ts` — `if (readOnly && !scritturaAlCircoloConsentita(...))`, **prima** del ramo scrittura e **prima** del controllo dei secret |

### I quattro banchi nuovi

| file | cosa difende |
|---|---|
| `test/limporto-nato-qui-lo-dice.test.mjs` | il quarto esito, la precedenza `lettoAt` > `origineImporto`, il «da» |
| `test/limporto-del-giocatore-aggiunto.test.mjs` | ⭐ **lega le DUE copie della regola** — edge (`importiDalListino`, Deno/TS) e app — sulla stessa tabella di 12 casi |
| `test/le-righe-vecchie-prendono-il-prezzo.test.mjs` | il riempimento, l'idempotenza, i casi che **non** devono scrivere |
| `test/la-lettura-sta-dentro-il-recinto.test.mjs` | ⭐ **confronta il cancello dell'app con quello dell'edge**: devono concordare, e dove non coincidono l'app dev'essere la più **stretta**, mai il contrario |

⭐ **Il trucco che rende forti gli ultimi due**: i moduli `.ts` delle edge sono **importabili da node**
con `--experimental-strip-types` (provato: `importo-dal-listino.ts` e `scrittura-al-circolo.ts`).
⇒ Una copia in pagina e una nell'edge si possono **esercitare fianco a fianco** invece di sperare
che restino uguali.

### Prove fisiche fatte (TEST 6.405 → 6.408, console remota)
- le **12 combinazioni** della casella esercitate su `window._pmoImportoCasella` della **pagina viva**;
- prenotazione nativa creata → scheda aperta → bordo `dotted`, `13,00`, *«(dal listino del gestionale)»*;
- giocatore aggiunto → **1300 · `listino` · nessun `lettoAt`**, tre caselle puntinate;
- riga vera dell'**08/09 Campo 2 18:00** → quattro giocatori senza importo diventati **12,00** ciascuno,
  e la **seconda** apertura non ha riscritto niente. ⭐ Il primo giocatore era una **stringa** invece
  che un oggetto (il caso della voce 142, incontrato dal vivo): convertito e prezzato;
- l'edge **chiesto davvero** → **503 `LETTURA_AL_CIRCOLO_NON_PREVISTA`**, nessuna chiamata al worker;
- la scheda col recinto chiuso → **zero** chiamate all'edge di lettura (contate intercettando `fetch`),
  velo spento, quattro caselle piene, quattro nomi;
- **TEST ripulito**: le due prenotazioni di prova annullate, 30 righe vive come prima.

### 🥇 LE COSE DA PORTARSI DIETRO (pagate stanotte)

**①🚨⭐⭐ UNA CURA PUÒ CREARE IL DIFETTO SUCCESSIVO NEL PUNTO CHE NON HA TOCCATO.** La regola ④
(«mai `lettoAt`») ha protetto il **database** e ha rotto lo **schermo**, perché chi legge distingueva
le provenienze con l'unico campo che quella regola vietava. ⇒ Dopo aver aggiunto una provenienza a
un dato, **cercare chi la legge**, non solo chi la scrive.

**②🚨⭐ UN SABOTAGGIO CHE RESTA VERDE VA CAPITO, NON RISCRITTO.** Stanotte ne sono rimasti verdi
**tre**, e ognuno diceva una cosa diversa:
· uno era puntato su una riga **ridondante** (due guardie proteggono lo stesso caso: tolta una,
  l'altra regge) ⇒ scritto nel banco, invece di fingere un caso che le distingua;
· uno non cadeva perché **il fixture non conteneva l'input da fermare** — nessuna fascia *senza*
  prezzo su cui mordere. È la lezione ③ del passaggio precedente, presa in flagrante mentre la si
  applicava;
· uno **non si era nemmeno applicato**: l'àncora del `replace` non era univoca, l'assert falliva, e
  il banco girava sul file **sano**. 📌 *Un sabotaggio che non tocca niente non è un banco debole: è
  un banco che non è stato eseguito, e si legge esattamente come un successo.*

**③⭐ UNA SONDA CHE CERCA «IL» POSTO DOVE I POSTI SONO DUE STA PESCANDO, NON MISURANDO.** Un
controllo cercava `indexOf('pmoGestionaleCollegatoAlCircolo')` dentro `staffCalEditPlayers`, che ne
ha **due** (manutenzione e roster): trovava il primo e cadeva su una cura che c'era. ⇒ Si contano le
occorrenze e si dice **quale** deve fare cosa.

**④ IL NUMERO DI VERSIONE E LA SUA RIGA NEI DOCUMENTI VIAGGIANO INSIEME.** Ho alzato `APP_VERSION`
tre volte prima di aggiornare la tabella di `docs/stato-progetto-corrente.md` ⇒ **tre corse di
`guard-docs-truth` rosse**, chiuse solo dal commit dei documenti. Le ultime di ogni ramo erano
verdi, ma una guardia che lampeggia si smette di leggere.

**⑤ LA FINESTRA DEL 4bis SI CHIUDE A MANO.** Spingendo i documenti su `test-preview` **prima** del
merge su `main`, `guard-worker-sync` cade rossa su `test-preview` finché il merge non atterra — e
**non rigira da sé**. ⇒ Dopo il merge, `workflow_dispatch` su `guard-worker-sync.yml` per
`test-preview`. Successo **due volte su due** stanotte.

### Misure da non rifare
| cosa | valore |
|---|---|
| `staff_booking` vive su `cudi` | **30** — di cui **1 sola** con data ≥ oggi |
| con importi | **3** (2 lette a mano tempo fa + 1 riempita dal listino) |
| listino mercoledì 19:30 / martedì 18:00 | **1300** / **1200** |
| `pmoCalendarioMappa` | caricata **da sola al login** (`pmoCaricaFasce` → `pmoCaricaCalendario`), tratta **oggi → +365 giorni** |
| ruolo della console su TEST | `staff`, tutti i permessi |

### PR di stanotte su `main` (solo documenti)
**#1501** la 180 a tre quarti · **#1502** la 180 chiusa, ed entra la 187.

### Attrezzi
- console remota: `cd tools/verifica-browser && npm install` (il container nasce senza
  `node_modules`), poi `node console.mjs --env test --eval "…"`. Le `PMO_VERIFY_*` **ci sono già**.
  Su TEST `--allow-writes` si usa senza chiedere; su PROD si dice prima.
- ⭐ **Sulla pagina viva sono su `window`**: `_pmoImportoCasella`, `_pmoImportoDa`,
  `_pmoPrezzoDelloSlot`, `pmoGestionaleCollegatoAlCircolo`, `staffCalEditPlayers`,
  `staffCalRefreshFromCloud`, `staffCalApplyLocalGiocatori`, `_staffCalRiempiImportiDalListino`.
  ⛔ **NON** ci sono le `let`: `pmoCalendarioMappa` e `prenotazioniOccupazione` si leggono solo
  dentro uno snippet, non con `window.<nome>`.
- Per far comparire le prenotazioni nella pagina pulita della console:
  `await staffCalRefreshFromCloud({ force: true, withMembers: true })`, poi si **aspetta il fatto**,
  non i secondi.
- Banco: `find supabase consumer-app tools test \( -name '*.test.mjs' -o -name '*.test.ts' \)` poi
  `node --experimental-strip-types` su ciascuno; **7 sono Deno** e vanno saltati.
- I conteggi di `guard-docs-truth` si replicano in locale **prima** di spingere (gli `awk` stanno
  nel workflow, righe 215-300).
