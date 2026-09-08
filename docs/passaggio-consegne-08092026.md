# Passaggio di consegne — 08/09/2026

> **Prompt da incollare nella chat nuova.** Copia tutto quello che sta fra le due righe.

---

## 📋 PROMPT

> Riprendi il progetto **PADEL MATCH ORGANIZER**.
>
> Leggi PRIMA, in quest'ordine: **`CLAUDE.md`** (c'è un POSTULATO in testa), **`docs/lavori/README.md`**
> e questo file.
>
> ### 🚨 PRIMA DI CREDERE A QUALUNQUE CONFRONTO
> Il checkout locale nasce **stantio** (l'08/09 era 352 commit indietro con `git status` che diceva
> «allineato»: il clone è shallow e `git merge-base` mente). ⇒
> `git fetch --unshallow origin && git fetch origin main test-preview && git reset --hard origin/test-preview`
>
> ---
>
> ## 🔴 LA COSA CHE CAMBIA TUTTO, ed è dell'08/09
>
> 🗣️ Sue parole, in risposta a *«dopo il 27/09 chi incassa?»*: **«il gestionale di TEST diventa il vero»**.
>
> ⇒ **Non stiamo costruendo un mirror per provare. Stiamo portando in produzione un sistema nuovo.**
> `cudiqnrrlbyqryrtaprd` (oggi «TEST») **diventa il gestionale del circolo**; quello di oggi
> (`qqbfphyslczzkxoncgex`, `app.padelvillage.club`) **va in pensione con Matchpoint**.
>
> | | |
> |---|---|
> | 🗣️ *«il gestionale di prod deve continuare a funzionare come ha funzionato fino adesso»* | **PROD non si tocca.** Non «con prudenza»: non si tocca. |
> | 🗣️ *«prod e test devono vivere due vite separate a livello gestionale»* | il travaso è **una-tantum**, non una sincronia accesa |
> | 🗣️ *«si incassa solo su test, su PROD mai»* + *«dal gestionale si incassa, perché Matchpoint non c'è più»* | la cassa nasce sul sistema nuovo |
> | 🗣️ *«devi darmi la possibilità di definire io come voglio gli slot prenotabili»* | ⇒ voce 176, **fatta** |
>
> ⚠️ **`CLAUDE.md` non è ancora stato aggiornato con niente di tutto questo.** La sezione FERMA
> *🔌 IL DISTACCO DA MATCHPOINT* dice ancora *«dal gestionale non parte MAI un pagamento»*: la sua
> frase nuova per correggerla è **«dal gestionale si incassa, perché Matchpoint non c'è più»**.
> ⇒ **Prima cosa da fare.** Finché quella riga resta, ogni riga di cassa la contraddice.
>
> ---
>
> ## 🚨 LA TRAPPOLA CENTRALE, e non è «togliere Matchpoint»
>
> Il sistema nuovo è servito da `test.padelvillage.club`, e l'app si riconosce TEST **dall'hostname**
> (`pmoIsTestHostname`, `/^test\./`). Finché si riconosce così, in produzione si porta dentro:
>
> | cosa | dove | effetto |
> |---|---|---|
> | `WA_TEST_OVERRIDE_NUMBER = '+393357615855'` | `index.html:38919` | **ogni WhatsApp a ogni socio su un solo telefono** |
> | `PMO_PAYMENTS_SIMULATE = PMO_IS_TEST_ENV` | `index.html:8785` | incassi **finti** |
> | `PMO_BOOKINGS_SIMULATE = PMO_IS_TEST_ENV` | `index.html:8799` | prenotazioni **finte nel browser** |
>
> ⇒ Il lavoro vero è **far diventare produzione un ambiente che tutto il codice conosce come prova**.
> Fallisce **in silenzio e verso l'esterno**: i soci non ricevono, il circolo non incassa, nessun errore.
>
> ⭐ **La buona notizia**: le due guardie si compongono giuste. `scritturaAlCircoloConsentita`
> (`scrittura-al-circolo.ts`, **11 copie** byte-identiche) è cablata sul ref di PROD ⇒ anche
> diventando «produzione» per l'app, `cudi` **non potrà chiamare Matchpoint**. Produzione per l'app,
> non-Matchpoint per la barriera. ⛔ Quella cablatura ora va tenuta **per sempre**.
>
> ### 🏠 L'indirizzo deciso: `soci.padelvillage.club` — e la sua trappola
> Libero dal 25/07 (Pages spento, DNS cancellato). ⚠️ Ma `pmoDetectPublicBaseUrl()`
> (`index.html:8747`) per un hostname che **non** inizia per `test.` e con percorso `/` **cade sul
> fondo** e restituisce `https://app.padelvillage.club/` ⇒ l'app servita da `soci.` prenderebbe la
> **configurazione di PROD**, si collegherebbe a `qqbf`, e — riconosciuta come produzione —
> `scritturaAlCircoloConsentita(qqbf)` risponderebbe **vero**: **scriverebbe sul Matchpoint vero**.
> **Le tre cose da fare prima di metterci l'app**, nessuna saltabile:
> ① il caricatore dichiara `window.PMO_PUBLIC_BASE_URL` con la **propria** origine;
> ② su `soci.` il file si chiama **`config.js`** (non `-test`) e punta a **`cudi`**;
> ③ `pmoAssertSupabaseMatchesRuntime` (`index.html:30095`) impara la coppia (produzione ⇄ `cudi`).
>
> ---
>
> ## ✅ FATTO in questa sessione (tutto provato, e dove no è scritto)
>
> **Sul sistema nuovo (`cudi`)**
> - **Sei routine Matchpoint tolte** (`cron.unschedule`, non `active=false`): calendario, borsellino,
>   pagamenti, pagamenti-oggi, clienti-notturni e **`anagrafica-mirror`**. ⚠️ Quest'ultima **non era
>   innocua**: *«toglie chi su PROD non esiste»* ⇒ avrebbe cancellato ogni socio creato sul sistema
>   nuovo. ⇒ Da adesso `cudi` **non si rinfresca più da Matchpoint**: fotografia ferma al **07/09 17:30**.
> - **Griglia orari allineata da PROD**: erano diverse (PROD 27/08, `cudi` 06/08 — mancava la fascia
>   **16:30-18:00** e c'erano fasce del mattino che il circolo **non apre più**). Impronte md5 identiche dopo.
> - **Voce 176 — `pmo_fasce_prenotabili`**: tabella vera che sostituisce il blocco jsonb
>   `app_setting/potentialSlotSchedule`. 41 fasce, **zero differenze** col blocco che sostituisce.
> - Pannello **Amministrazione → «Fasce prenotabili»** (era «Slot potenziali Matchpoint»): via la
>   casella di testo e via il bottone «Sincronizza da Matchpoint», dentro una tabella dove si
>   aggiunge/spegne/toglie una fascia e si scrive il prezzo. Controlla le **sovrapposizioni** prima di salvare.
> - `getDaySlots()` — punto unico da cui passano Dashboard, Apri Partite e la capacità — legge la tabella.
>
> **Sulla whitelist del bot (`ayly`)**
> - I **cinque della segreteria** (Maurizio 000004 · Lidia 001013 · Fabiola 000291 · Marco 000133 ·
>   Laura 000140) **copiati** su `ambiente='test'` — non spostati: la chiave primaria è
>   `(chat_id, ambiente)`, quindi stanno su tutti e due. ⇒ Il bot dei soci su PROD **funziona come
>   prima**, e il bot di prova li riconosce sul sistema nuovo. Lidia riattivata.
> - 📏 **Il «bot dei soci» NON è aperto ai soci**: è un pilota chiuso a quelle cinque persone.
>
> **Fatto e ANNULLATO** — la riduzione dell'anagrafica a 5 soci: giusta per un mirror di prova,
> sbagliata per un sistema vero. `cudi` è tornato a **2826 soci** (verificato).
>
> ### Versioni
> **PROD `v6.397`** (intoccato) · **TEST `v6.401`** · PR **#1477** aperta su `main` per riallineare
> `docs/` (guard-worker-sync pretende i due rami identici lì) — **da controllare e mergiare**.
>
> ---
>
> ## ⏭️ DA FARE, in ordine
>
> 1. **`CLAUDE.md`**: correggere la sezione FERMA sui pagamenti con la sua frase; correggere le
>    **cinque righe** che dicono «il calendario di TEST è congelato / nessun cron lo aggiorna»
>    (era falso: c'era `pmo-calendario-test-solo-prenotazioni`, 5 giri al giorno — ora tolto da me,
>    quindi la riga va riscritta col perché nuovo). Scrivere il disegno «test diventa il vero».
> 2. **`docs/lavori/README.md`**: la coda è a **ZERO** e le voci di questo lavoro non ci sono.
>    ⚠️ `guard-docs-truth` conta **ogni numero singolarmente**: replicare gli `awk` in locale prima di spingere.
> 3. **I due lettori del bot leggono ancora il blocco vecchio** — e finché è così le due fonti
>    convivono e possono divergere:
>    · `consumer-booking-write/index.ts:150,428-474` (`availability_day`) — cosa viene **offerto** al socio;
>    · `consumer-player-readmodel/index.ts:79,210-250` (`kb.slot_schedule`) — cosa il bot **racconta**
>      sugli orari. 🚨 Saltare questo vuol dire un bot che *parla* dei vecchi orari mentre *prenota* sui nuovi.
> 4. **La griglia non viene fatta rispettare**: `create` controlla campo, 07:00-23:30, durata 30-180,
>    30 giorni — **mai** che l'ora sia sulla griglia. Ora che è una tabella, si può.
> 5. **Il travaso** (una-tantum, approvato): meccanismo già trovato e provato —
>    leggere da PROD con `pmo_get_records_admin_page`, scrivere su `cudi` con
>    `pmo_upsert_records_admin`, via PostgREST con le utenze staff (`PMO_VERIFY_*`, presenti
>    nell'ambiente), **file-a-file con curl**: non passa niente da nessuna parte, non serve
>    nessuna edge nuova, **PROD non si tocca**. Delta da portare: `booking_history` +5771,
>    `payment` +748, `staff_edit` +217, `staff_cancel` +50, `wallet_txn` 13, i modelli WhatsApp 42,
>    `app_setting` (⚠️ **non** `assessmentSettings` e `postMatchFeedbackSettings`: puntano al
>    `config.js` di **PROD**, quindi i questionari scriverebbero nel database sbagliato).
> 6. **La cassa nativa** e la **lettura della scheda** — vedi sotto, è il pezzo grosso.
>
> ---
>
> ## 🚨 I TRE FATTI MISURATI CHE DECIDONO IL LAVORO GROSSO
>
> **① La scheda legge i SOLDI da Matchpoint dal vivo, e quella strada è FUORI dalla barriera.**
> `matchpoint-bookings-edit/index.ts:670` — `read:true` **salta il recinto** e chiama il worker
> (`:713`). Da lì arrivano `importoCents`, `pendenteCents`, `stato`, `idx`, `idCliente`.
> 📏 Delle **256** `staff_booking` vive su PROD solo **14** portano gli importi — **le stesse 14** che
> portano `lettoAt`, cioè quelle che qualcuno ha aperto. **242 hanno solo i nomi.**
> ⇒ La cassa **non ha su cosa addebitare** finché la lettura della scheda non diventa nativa. È il
> pezzo più grosso, e va **prima** della cassa.
>
> **② In 9 edge su 11 la configurazione è controllata PRIMA della barriera.**
> (`matchpoint-bookings-create/index.ts:745` vs `:761`, e così le altre; le tre strade *async* hanno
> già l'ordine giusto perché lì i segreti arrivano come parametri.) ⇒ Togliendo i secret
> `MATCHPOINT_*` da `cudi` si prende `500 WORKER_NOT_CONFIGURED` e **il ramo autonomo non parte mai**.
> ⇒ **Invertire quei due blocchi è il passo zero**, e su PROD il comportamento è **identico** (là la
> barriera risponde vero). Solo dopo si possono togliere i secret — ed è **quella** la prova del
> distacco: prenotare senza avere la chiave per chiamare il worker.
> 📌 Guardia da estendere: `scrittura-al-circolo.test.ts` caso 9 risale dal punto di non ritorno e
> pretende la barriera; serve il **simmetrico** (risalendo non si deve incontrare un
> `WORKER_NOT_CONFIGURED` prima). ⚠️ Due prove esterne fissano l'ordine e il testo esatto della riga
> della barriera: `test/assessment-apply-level.test.mjs:777` e `test/scheda-anagrafica-riordinata.test.mjs:602`.
>
> **③ Il verdetto `verifica` si congela per sempre.**
> `consumer-booking-write/index.ts:953` legge la freschezza da
> `matchpoint_data | matchpoint_bookings_auto_import_last`. Spento il sync **quel timbro non si muove
> più** ⇒ `verdettoScrittura` non può più dire **`no`** e ogni verifica risponde `non_ancora` **per
> sempre**: il bot chiederebbe al socio di aspettare una cosa che non arriverà mai. Sembra pazienza,
> non un guasto. ⇒ Va sciolto con un `fonteNativa`. ⛔ **Il bot non si tocca**: `git diff` vuoto nel
> repo del bot è il criterio di accettazione.
>
> ---
>
> ## 🥇 LE TRE COSE DA PORTARSI DIETRO
>
> **① Il banco verde non vede quello che la pagina disegna.** La voce 176 è passata con 124 prove
> verdi e un pannello dall'aria giusta — e sulla pagina viva **il lunedì aveva cinque fasce invece di
> sei**, senza la 16:30. La causa: avevo messo il permesso `cloud_sync` sulla **lettura**, più stretto
> della guardia del database. 📌 *Un permesso più stretto della guardia che dovrebbe rispecchiare non
> protegge niente: fa mentire il calendario, e in silenzio.*
>
> **② Lo stesso difetto aveva DUE cause, e la prima cura non bastava.** Tolto il permesso, le fasce
> ancora non si caricavano: il boot parte **prima** che la sessione esista. ⇒ Servono **tre** agganci
> — avvio, login, apertura del pannello — e li ha trovati solo il riprovare sulla pagina, non il
> ragionarci sopra.
>
> **③ Una sonda puntata sul NOME invece che sul FATTO sbaglia nel verso che sembra prudente.**
> Avevo dato l'allarme *«spostando il bot dei soci, i soci veri riceverebbero risposte da un ambiente
> seminato»*. Falso: la whitelist ha **cinque** operatori, ed erano esattamente i suoi. Avevo tarato
> l'allarme su **«bot dei soci»**, non sulla tabella.
>
> ---
>
> ## ⛔ COSA NON DARE PER FATTO
> · **Il prezzo delle fasce è `null` su tutte e 41** — «non ancora deciso», che è diverso da gratis.
>   Lui ha scelto **prezzo per GIOCATORE** (non il campo da dividere), ma i numeri non li ha ancora dati.
> · **Non esiste nessun limite** al numero di partite aperte né preavviso di disdetta: lui pensa siano
>   definiti («abbiamo definito le regole nel fare il chatbot»), ma nel codice ci sono solo 30 giorni
>   di anticipo, durata 30-180, 07:00-23:30, 4 giocatori (`consumer-booking-write/index.ts:143-150`).
> · **Non esiste nessuna tabella dei campi** (sono 4, cablati in tre punti diversi), **nessun listino**
>   (le uniche cifre, 40/32 in `index.html:25223`, sono una stima da cruscotto **per partita**),
>   **nessun modello di chiusure/festività**.
> · **`wallet_balance` è una fotografia**, non un saldo calcolato: al distacco va **rovesciato**
>   (`wallet_txn` diventa il mastro, il saldo si somma).
> · **Il prototipo di cassa nel browser ha già il difetto del doppio incasso**: `_pmoSimPayKey`
>   (`index.html:42037`) mette `Date.now()` nella chiave ⇒ due clic = due incassi. È l'unica cosa da
>   **non** portarsi dietro.

---

## 🔧 DETTAGLI OPERATIVI (fuori dal prompt)

### Ambiente
- Console remota: `cd tools/verifica-browser && npm install`, poi
  `node console.mjs --env test|prod --eval "return …"`. Le `PMO_VERIFY_*` **ci sono già**.
  ⚠️ Il risultato utile sta in `.risultato`: l'output completo è lungo, filtrarlo con python.
  ⚠️ In `page.evaluate` le variabili dell'app sono `let` di script: `giocatori` sì, `window.giocatori` no.
- **Il caricatore di TEST sincronizza in ~25 s** (misurato due volte oggi: 26 s e 24 s). Si aspetta
  con `until curl -s .../app-meta.json | grep -q "$SHA"; do sleep 3; done` — **non** con `sleep`
  a occhio (il `sleep` in primo piano è bloccato dall'ambiente).
- Sintassi di `index.html`: estrarre i 5 blocchi `<script>` inline e `node --check` ciascuno.
- Banco: `find supabase consumer-app tools test -name '*.test.mjs' -o -name '*.test.ts'`, `node` su
  ciascuno saltando quelli che importano da `jsr:` (sono Deno). Oggi: **124 verdi, 0 rosse**.

### Le misure di oggi (da non rifare)
| cosa | valore |
|---|---|
| `pmo_cloud_records` su PROD | 23.716 righe, **42 MB** · payload totale ~**11 MB** |
| soci vivi | PROD **2828** · sistema nuovo **2826** |
| calendario | PROD aggiornato in continuo · sistema nuovo fermo al **07/09 17:30** |
| incassi | **20-53/giorno, €200-540/giorno**; 30 gg: card 532 · cash 410 · gift 33 · wallet 24 |
| `staff_booking` con gli importi | **14 su 256** (le stesse che hanno `lettoAt`) |
| `payment` per sorgente | `matchpoint` 3334 · **`pmo_gift` 33** (precedente di cassa nativa già in servizio) |
| eventi staff → bot (7 gg, PROD) | 431 su 431 consegnati |
| whitelist bot | 5 su `prod`, 5 su `test` (le stesse persone) |

### Commit di oggi su `test-preview`
`cc867e94` la tabella · `3033a102` il pannello + `getDaySlots` · `dc4e5824` il permesso sulla
lettura · `6c129b99` i tre agganci del caricamento.

### Il file del piano
`/root/.claude/plans/root-claude-uploads-58f138ad-3709-5379-greedy-lagoon.md` — riscritto due volte,
l'ultima dopo il ribaltamento «test diventa il vero». ⚠️ Contiene ancora un G0-G10 tarato sul mirror:
va riletto con la testa nuova, non eseguito alla lettera.
