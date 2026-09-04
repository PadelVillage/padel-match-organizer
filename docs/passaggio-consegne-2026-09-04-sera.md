# Passaggio di consegne — 04/09/2026, sera (fine 81ª sessione)

**Come si usa:** incollalo come primo messaggio della chat nuova. È scritto per essere capito
**senza** la conversazione precedente.

---

## 🟢 LE DUE COSE DA SAPERE PRIMA DI TUTTO

> **① Oggi sono nate QUATTRO regole sue, e stanno tutte in `CLAUDE.md`.** Quel file si carica a
> ogni sessione: si legge PRIMA di lavorare, e la testa del file è dove stanno le più recenti.
>
> **② IL LAVORO IN CORSO NON È FINITO**, ed è dichiarato al punto 4: *salvare l'importo quando lo
> si legge*. Approvato da lui esplicitamente (*«Sì, procedi col salvare l'importo quando si
> legge»*), misurato quasi per intero, **non ancora scritto**.

| | inizio sessione | adesso |
|---|---|---|
| versioni app | PROD 6.328 · TEST 6.329 | **PROD 6.334 · TEST 6.335** |
| PR fuse | — | **#1336 → #1343** (otto) |
| banco | 97 verdi | **99 verdi / 0 rossi** |
| voci chiuse | 120 | **122** (147, 148) |
| urgenti | 5 | **6** (entrano 149 e restano 92·83·65·137·138) |

---

## 0. 📦 Stato alla consegna

| | |
|---|---|
| rami | `main` ↔ `test-preview` allineati sui 4 percorsi sorvegliati (verificato) |
| guardie | `guard-worker-sync` ✅ · `guard-docs-truth` ✅ su **entrambi** i rami |
| worker · bot · edge | **non toccati** |
| ⚠️ in sospeso | il commit dei registri della 148 e questo file: da spingere su `test-preview` **e** portare su `main` |

### ⛔ LE COSE DA FARE PER PRIME
1. **Il difetto ancora aperto e VISTO DA LUI**: *«continuano ad esserci due messaggi uno dopo
   l'altro in basso alla scheda»*, **dopo un Salva su PROD 6.334**. La cura della 147 non l'ha
   coperto. Vedi il punto 3 — c'è scritto dove mi sono fermato e perché.
2. **Il lavoro approvato**: salvare l'importo quando lo si legge (punto 4). Le misure sono fatte,
   manca il codice.
3. La **149** è in servizio ma **aperta**: che il trattino si veda bene lo dice il suo occhio.

---

## 1. ✅ Prima di lavorare

```bash
git fetch origin main test-preview
git diff origin/main origin/test-preview -- CLAUDE.md docs/ .github/workflows/ \
  tools/matchpoint-browser-worker/src/server.mjs
```
✅ Dev'essere vuoto. 📕 `docs/lavori/README.md` si apre **PRIMA di lavorare**.
🚨 Clone shallow: `git reset --hard origin/<ramo>` dopo il fetch.

Il banco NON si lancia con `node --test`:
```bash
r=0; v=0
while IFS= read -r f; do
  grep -qE "^\s*(import|export).*['\"]jsr:" "$f" && continue
  if node "$f" >/dev/null 2>&1; then v=$((v+1)); else r=$((r+1)); echo "❌ $f"; fi
done < <(find supabase consumer-app tools test \( -name '*.test.ts' -o -name '*.test.mjs' \) | sort)
echo "$v verdi, $r rossi"
```
🩹 Sintassi: `node test/controlla-sintassi.mjs` · Ora: `TZ=Europe/Rome date '+%Y-%m-%d %H:%M'`
🩹 La console remota vuole `npm install` in `tools/verifica-browser` in ogni sessione nuova.

🔑⭐⭐ **LE CREDENZIALI CI SONO GIÀ, TUTTE E QUATTRO** (`PMO_VERIFY_EMAIL`, `PMO_VERIFY_PASSWORD`,
`PMO_VERIFY_EMAIL_TEST`, `PMO_VERIFY_PASSWORD_TEST`). **Provalo in tre secondi prima di dubitarne**:
```bash
for v in PMO_VERIFY_EMAIL PMO_VERIFY_PASSWORD PMO_VERIFY_EMAIL_TEST PMO_VERIFY_PASSWORD_TEST; do
  [ -n "${!v:-}" ] && echo "$v: c'è" || echo "$v: MANCA"; done
```
🩹 Oggi ho perso mezz'ora e gliele ho **chieste in chat** senza aver fatto questa prova. Lui me le
ha incollate; **non sono state scritte nel repo** (git conserva per sempre) e il file di lavoro è
stato cancellato. Poi ha detto *«lascia perdere id e psw»*.

---

## 2. 🗣️ LE QUATTRO REGOLE NUOVE — tutte in `CLAUDE.md`

### 🚀 ① LA PROMOZIONE A PROD NON SI CHIEDE *(in TESTA, dentro il POSTULATO)*
> *«Non mi devi chiedere il permesso per portare in prod, lo devi fare in automatico. Dopo che su
> test hai fatto tutti i test che funziona. Poi lo porti in prod in automatico, poi controlli in
> prod che funziona e poi mi avvisi quando è finito che io vado a controllare.»*

① prove su TEST (banco verde **e la cura sabotata**) → ② promozione **senza chiedere** →
③ **controllo su PROD, sulla pagina viva** → ④ avviso.
🚨 Il ③ è quello che si salta: un merge riuscito dice che il file è partito, non che l'app fa la
cosa giusta. ⛔ Resta fuori l'**irreversibile o visibile da fuori** (scrittura vera su Matchpoint,
messaggio ai soci, `--allow-writes` su PROD): si dice **prima**, anche procedendo.
🗣️ *«Ogni volta che apriamo una chat questa regola deve essere presente.»*

### 🔎 ② «IO CONTROLLO SEMPRE SU PROD» *(in TESTA)*
⇒ Decide **dove** una prova conta. Un lavoro provato solo su TEST gli arriva **non provato dove lui
guarda**. ⇒ **Nel resoconto si scrive sempre SU QUALE AMBIENTE** ogni cosa è stata provata.

### 📢 ③ OGNI DEPLOY SU PROD SI ANNUNCIA
⛔ L'avviso **non è il merge**: fra merge e file nel suo browser ci sono Pages e la cache
(`max-age=600`). Si annuncia il **fatto**, con `last-modified` accanto al numero, misurato con un
`until` in background. Vale per PROD, non per TEST.

### 🟢🔴 ④ L'AVVISO HA DUE STATI
🟢 «puoi operare» / 🔴 «non sono pronto», con **cosa** manca. Mai nessuna delle due.
🚨⭐⭐ **«Non mi dire di fare»**: l'avviso **apre un campo**, non assegna un compito — *«il cambio
importo è pronto quando vuoi»*, non *«rifai il cambio importo»*. È una questione di **ruolo**: chi
supervisiona decide se e quando guardare.
📏 Una volta per **giro**, non per corsa; e si guarda la corsa dell'**ultimo commit di ogni ramo**
(la finestra del 4bis lascia una rossa transitoria sul ramo indietro, che **non rigira da sé**: si
rilancia con `workflow_dispatch`).

---

## 3. 🚨 IL DIFETTO APERTO: «DUE MESSAGGI UNO DOPO L'ALTRO» — la 147 NON l'ha coperto

🗣️ **Sue parole, stasera, dopo un Salva su PROD 6.334**: *«Continuano ad esserci due messaggi uno
dopo l'altro in basso alla scheda, che ora si chiude dopo che ho salvato, e questo te lo confermo.»*

⚖️ **Cosa la 147 HA curato** (ed è in servizio su PROD 6.330+): i **tre avanzamenti dei pagamenti**
(`↻ Salvo su Matchpoint l'importo…`, `↻ Incasso…`, `↻ Storno del pagamento…`) non nascono più in
chat, e la **pastiglia** non ripete nessun gesto in volo (`svcEAvanzamentoInCorso`, riconosciuto dal
segno in testa **più** il «(non chiudere)»).

⚠️ **Cosa NON ha curato, evidentemente**: il caso che lui vede facendo un **Salva** completo — che
passa da `matchpoint-bookings-edit`, non solo dal `charge-write`.

🔎 **DOVE MI SONO FERMATO, e la strada è tracciata**: ho provato a riprodurlo su TEST con un Salva
vero (`staffCalPlayersSave({skipConfirm:true})` dopo aver scritto `9,00` nella prima casella) e
**`st.payRows` era vuoto** ⇒ nessuna riga pagamento da toccare, quindi nessun cambio importo, quindi
il percorso non si è attraversato. Non ho capito perché: il roster c'era (4 giocatori).
📌 **Da provare per primo**: perché su TEST `payRows` resta vuoto — `PMO_PAYMENTS_UI_ENABLED`,
`_payCollectActive`, o il fatto che gli importi non erano stati letti (`_payShow`).
⭐ **Lo script di misura è pronto e funziona**, va solo fatto arrivare a `payRows` pieno: apre il
calendario, aspetta 9 s, prende la prima prenotazione con giocatori, apre la scheda, scrive nella
casella, salva e **campiona ogni 1,5 s per 15 s** chat · riga nella scheda · pastiglia · barra. È il
modo di vedere *quali* sono i due messaggi invece di indovinarli.

🚨 **I posti in cui una frase può comparire sono QUATTRO**, e vanno contati tutti prima di curare:
**chat · pastiglia · riga nella scheda (`_svcSchedaEsito`) · barra (`svc-semaforo`)**.
📌 *La 136 ne governava uno, la 137 ⑤ un altro, la 145 il terzo, la 147 il quarto — e ogni volta chi
curava contava gli oggetti che aveva in mente, non quelli che c'erano.*
🚨 E la lezione più cara della 147: **la 145 aveva RIAPERTO quello che la 136 aveva chiuso**, perché
la guardia della 136 poggiava sull'**esistenza** della riga che la 145 ha tolto. *Una protezione che
poggia sull'esistenza di un altro pezzo muore quando quel pezzo viene tolto, e muore in silenzio.*

---

## 4. 🔨 IL LAVORO APPROVATO E NON ANCORA SCRITTO: salvare l'importo quando si legge

🗣️ **Sua osservazione**: *«sull'importo c'è un trattino, dopo circa otto secondi appare l'importo.
Ma questo non è normale perché ci siamo detti che dovrebbe apparire già l'importo visto che ogni due
minuti andiamo a leggere Matchpoint attraverso il worker.»*
🗣️ **Sua approvazione**: *«Sì, procedi col salvare l'importo quando si legge.»*

### 📏 LE MISURE GIÀ FATTE — non rifarle
1. **Il sync ogni 2 minuti NON legge gli importi.** In
   `supabase/functions/matchpoint-bookings-sync/index.ts` il tipo è `giocatori?: string[]` — **solo
   nomi**. La fonte è la **descrizione** dell'export Excel (`playersFromDescrizione`), che è un
   elenco di nomi. Gli importi stanno nella **ficha** della singola prenotazione, che il sync non
   apre.
2. **Aprirle tutte non si può**: **206** prenotazioni nella copia locale × un giro ogni 2 minuti sul
   worker **condiviso** ≈ 150.000 visite/giorno.
3. ⭐ **Il write-back ESISTE GIÀ**: `_staffCalPersistRosterFromWorker(iso, campoNum, ora, roster)`
   (`index.html:40299`), chiamato dopo la lettura del worker (`index.html:~42855`). **Ma salva solo
   i NOMI**: `b.giocatori = next.map(n => ({ nome: n }))` — butta via importo, pendente e stato.
   ⇒ **È lì che va fatta la cura**, ed è una funzione sola.
4. ⭐⭐ **Il sync NON riscrive il payload delle `staff_booking` attive**: le tocca **solo per
   cancellarle** (`deleted: true`, riga ~1477). ⇒ Un importo salvato nel payload **sopravvive** ai
   giri del sync. Questa è la misura che rende la strada percorribile.
5. **Il cloud è autorevole** e il pull sovrascrive il locale (`index.html:~39936`) ⇒ salvare solo in
   `localStorage` **non regge**: va spinto al cloud. Il meccanismo c'è già —
   `staffCalCloudSyncEdit(iso, campoNum, ora)`, chiamata dalla stessa funzione del punto 3.
6. **`_normRoster` accetta già gli oggetti** (voce 142): se il record locale porta
   `{nome, importoCents, …}`, all'apertura arrivano nel roster **senza toccare altro**.

### ⚠️ LE TRAPPOLE DA NON PRENDERE
· 🚨 **Un importo salvato è un importo VECCHIO.** Va tenuto un `lettoAt`, e il «da» del cambio
  importo (`baseCents`) non deve dichiarare come letto ciò che è solo ricordato — o il riepilogo
  direbbe «da 8,00» quando su Matchpoint erano 10,00. La 149 ha appena messo la regola
  (`(non letto) → 9,00`): **non annullarla**.
· ⛔ **Non mettere gli importi in un `record_type` nuovo** senza prima verificare che
  `p_record_types` (`index.html:14611`) e la RPC lo accettino.
· ⛔ **Ci sono almeno 4 punti che riscrivono il payload `staff_booking`** (`index.html` righe ~40287,
  40353, 40382, 42580): se uno riscrive `giocatori` **da zero**, cancella gli importi. Vanno guardati
  tutti e uno per uno.
· 🚨 Il record del 05/09 su PROD porta `[{nome:"Lidia Comes"},{nome:"Fabiola Limuti"},{nome:"Ospite"},
  {nome:"Ospite"}]` — **oggetti con il solo nome**. È la forma che il write-back scrive oggi.

---

## 5. 🔎 FATTI MISURATI CHE VALE LA PENA NON RISCOPRIRE

- ⭐⭐ **`login: "ok"` NON vuol dire «posso scrivere»**: la guardia della console resta armata
  (`scritture: "bloccate"`) e ferma anche le **letture** verso `/functions/v1/` ⇒ **la scheda si apre
  senza giocatori**, e sembra un difetto dell'app. Ci ho creduto per tre giri.
- ⭐⭐ **`pmoIsReadonlyStaff()` a `false` NON vuol dire «sono owner»**: torna `false` anche quando il
  profilo **non c'è affatto** (`!!p`). *Una funzione che risponde «no» a due domande diverse non
  risponde a nessuna delle due.*
- ⭐⭐ **`staffCalEditPlayers(iso, campo, ora, nome, durata, tipo)` vuole i parametri VERI**, presi dal
  record di `safeLoad('staffBookings')`. Con `nome`/`durata`/`tipo` indovinati **la scheda si apre
  vuota** e sembra che «da qui non si possa». È così che è nata una domanda girata a lui invece di
  essere misurata.
- **Il localStorage parte VUOTO** in ogni sessione della console: prima `switchTab('staffCalendar')`
  e ~9 secondi, poi `safeLoad('staffBookings')` ha i record (206 su PROD, 26 su TEST).
- **La funzione che contiene il ramo del cambio importo è `staffCalPlayersSave`** (non
  `staffCalSalvaGiocatori`, che non esiste).
- **`--allow-writes` su PROD è bloccato dalla sandbox** di questo ambiente (non dal progetto). Su
  **TEST passa**, e là le scritture verso Matchpoint sono **simulate** (`pmo-mp-sim` lo dichiara in
  console) ⇒ è lì che si attraversano i percorsi di scrittura.
- **Promozione a PROD**: `git show <sha> -- index.html | git apply --3way` su un ramo basato su
  `main`; unico conflitto atteso è `APP_VERSION`. Verificare `grep -c pmo-mp-sim` = **0**.
- **Numeri**: a ogni promozione **PROD prende il numero di TEST**, e **TEST riparte da +1**.

---

## 6. 🧠 I DIFETTI PRESI OGGI — la parte da non ripetere

- 🩹⭐⭐ **UN BANCO CHE RISCRIVE LA REGOLA INVECE DI ESEGUIRLA È VERDE SUI SABOTAGGI.** La prima
  stesura del banco della 149 copiava le tre righe dell'app: sabotando l'app in **tre** modi diversi
  restava **verde tutte e tre le volte**. 📌 *Una copia della regola è peggio di una rilettura,
  perché ha la FORMA di un'esecuzione.* ⇒ La cura è **estrarre la regola in una funzione pura**
  (`_pmoImportoCasella`) e farla eseguire al banco: così non c'è niente da ricopiare.
- 🩹⭐⭐ **HO GIRATO A LUI UNA DOMANDA CHE POTEVO MISURARE.** Gli ho chiesto *«dopo qualche secondo
  si sono riempiti?»* dopo aver concluso da una scheda vuota che non potevo guardare. La scheda era
  vuota **per colpa della mia sonda**. Lui ha risposto: *«perché mi fai queste domande?»* —
  giustamente. 📌 *Un vuoto va attribuito alla propria sonda prima che al mondo.*
- 🩹⭐ **UNA SONDA CHE RITAGLIA A PARTIRE DA CIÒ CHE VUOLE MISURARE NON LO MISURA MAI**: il banco
  della 148 partiva da `await _pmoSetCharges(` e dichiarava mancante un `const _esitoCharge =`
  scritto tre caratteri prima della fetta.
- 🩹⭐ **HO QUASI ANNUNCIATO UN DIFETTO CHE NON C'ERA**: contavo «Solo lettura» con un selettore
  generico e trovavo **2**; col selettore vero (`.action-alert-overlay`) i toast erano **0**.
  Verificato prima di dirlo.
- 🩹 **Sono rimasto sul ramo della promozione senza accorgermene** e ho committato lì una modifica a
  `CLAUDE.md`: `git branch --show-current` prima di committare.

---

## 7. ⏳ COSA RESTA IN PIEDI

| | |
|---|---|
| **due messaggi** (punto 3) | 🚨 **visto da lui su PROD 6.334 dopo un Salva** — la 147 non l'ha coperto |
| **importo salvato** (punto 4) | approvato da lui, misurato, **non scritto** |
| **149** (aperta) | in servizio; che il trattino si veda bene lo dice il suo occhio |
| **147** (chiusa) | ⚠️ chiusa nei registri, ma il difetto che curava **si vede ancora** in un'altra forma |
| **142** (aperta) | id interno + Osservazioni nel gestionale ⇒ chiude anche la **138** |
| **4 edge orfane** | `ai-propose-lexicon`, `ai-lex-examples`, `ai-reason`, `ai-parse`: vive e innocue, cancellarle è un gesto da chiedergli |
| ⚠️ **la partita di prova** | spostata da lui a **lunedì 7 alle 9** — *«così in quell'orario non ci rompe le scatole nessuno»*. Su di lei si può provare tutto **tranne salvare un pagamento come pagato** (influenzerebbe la cassa) |

---

## 8. 🤝 Come si procede

> 🥇 **POSTULATO**: la prova la faccio io — su TEST **e** su PROD — e lui **supervisiona che quel
> che ho detto sia vero**. Il confine è fra **guardare** (mio) e **scrivere** (suo).
> 🚀 **La promozione a PROD non si chiede.** 🔎 **Lui controlla sempre su PROD.**
> 🟢🔴 **L'avviso ha due stati, e apre un campo invece di dare un compito.**
> ✋ Un task non è finito finché non è provato **fisicamente**.
> 🎨 Ogni modifica **visibile** parte da un mockup approvato (`mockup/`), e va detto prima.
> 📌 E: **«scrivi troppo» — risposte corte.**

⭐ **La regola che oggi ha pagato di più**, ed è costata quattro volte: *quando una misura dice
«non si può», la prima cosa da sospettare è la sonda.* Le credenziali c'erano, la scheda si apriva,
la ✕ rispondeva, il toast era zero. Quattro «non si può» su quattro erano miei.
