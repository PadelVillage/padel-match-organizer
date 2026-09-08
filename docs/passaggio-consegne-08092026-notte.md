# Passaggio di consegne — 08/09/2026, notte (101ª sessione)

> **Prompt da incollare nella chat nuova.** Copia tutto quello che sta fra le due righe.

---

## 📋 PROMPT

> Riprendi il progetto **PADEL MATCH ORGANIZER**.
>
> Leggi PRIMA, in quest'ordine: **`CLAUDE.md`** (postulato in testa, e la sezione *«IL GESTIONALE DI
> TEST DIVENTA IL VERO»*), **`docs/lavori/README.md`**, e questo file.
>
> ### 🚨 PRIMA DI CREDERE A QUALUNQUE CONFRONTO
> Il checkout locale nasce **stantio e shallow**: `git status` dice «allineato» mentendo. ⇒
> `git fetch --unshallow origin && git fetch origin main test-preview && git reset --hard origin/test-preview`
>
> ---
>
> ## 🟢 IL PRIMO LAVORO: chiudere la 177, e adesso SI PUÒ
>
> La 177 è in servizio su `cudi` da ieri e resta aperta per una sola cosa: **una riga
> `fonte=pmo_fasce_prenotabili` nel registro**, cioè un gesto vero del bot. Fino a stanotte era
> impossibile — mancava `CONSUMER_BRIDGE_SECRET`. ⭐ **Adesso c'è**, e la strada è già in piedi:
>
> · 🔑 il segreto vive nel secret di repo **`CONSUMER_BRIDGE_SECRET_TEST`**, messo dal committente
>   l'08/09 sera. ⛔ Non è mai passato dalla chat, e non deve passarci mai;
> · 🔨 l'attrezzo è **`.github/workflows/sonda-ponte-soci.yml`** — sola lettura, cablato su `cudi`
>   e sulla **sola azione `verifica`**, che non scrive niente e non chiama il worker;
> · 📏 **provato**: tre corse vere stanotte, HTTP 200, verdetti giusti.
>
> 🔨 **Cosa manca, ed è piccolo**: `verifica` non legge le fasce. Le legge l'azione
> **`availability_day`** (`consumer-booking-write/index.ts:422`, il ramo con
> `pmo_fasce_prenotabili` + il ripiego `SLOT_SCHEDULE_KEY`). ⇒ Si allarga la sonda a **quella
> seconda azione**, che è pure lei in sola lettura, si chiama, e si guarda il registro dell'edge.
> ⚠️ **Va allargata la lista cablata, non aperta a un input**: l'azione resta scelta fra due
> costanti scritte nel file, o l'attrezzo smette di essere sicuro per costruzione.
> 🎯 E vale doppio: la stessa chiamata prova anche `consumer-player-readmodel`, l'altro lettore
> della 177.
>
> ---
>
> ## ✅ FATTO IN QUESTA SESSIONE
>
> **① Voce 179 — CHIUSA a prova fisica, nei tre versi.** Il gestionale adesso **dichiara la propria
> natura** (`app_setting` → `pmoFontePrenotazioni`), e la regola sta in `fonteDichiarata`. Prova:
> stesso socio, stesso slot, tre chiamate in quattro minuti — `nativa` → **`no`/`fonte_nativa`**;
> difetto **rimesso apposta** → **`non_ancora`/`copia_ferma`**; `nativa` → **`no`**.
> 📌 *La riga di mezzo è la prova che vale: il difetto è stato fatto succedere di nuovo.*
> 🚨 **Non si è riusato `scritturaAlCircoloConsentita`**, ed è la decisione da capire: sono **due
> domande diverse** — «posso scrivere sul Matchpoint del circolo?» e «da dove nascono le
> prenotazioni che vedo?» — che oggi coincidono **per costruzione**, non per natura. Il ref di PROD
> resta, ma come **rete**: non decide, rifiuta la combinazione pericolosa.
> ⭐ E cadono **due** rami, non uno: anche `fuori_finestra`, che descrive l'export e senza export
> non esiste.
>
> **② L'attrezzo dei secret Matchpoint è pronto e la strada del ritorno è DIMOSTRATA.**
> 📏 I valori stanno in `/opt/matchpoint-worker/.env` — **non** in `pm2_env`, come si credeva. E i
> quattro `sha256` **combaciano con i DIGEST che Supabase pubblica** ⇒ `rimetti` riporterebbe
> **esattamente** il valore che c'è adesso. L'attrezzo lo controlla da sé e **blocca `togli`** se un
> valore si recupera ma non combacia.
>
> **③ La 183 promossa** da coda a urgente (dichiarata in lista col perché): senza i **suoi prezzi**
> la 180 non ha un importo da far nascere e la 181 non ha su cosa addebitare. 📏 `null` su **tutte
> e 41** le fasce.
>
> **④ Messa a verbale una sua frase che cambia il perimetro** (⇒ `CLAUDE.md`):
> *«A noi servirà solamente una volta ricollegarci con il gestionale di prod per riallineare i dati
> dei soci in anagrafica. Dopodiché Prod si spegnerà per sempre.»*
> ⇒ *«PROD non si tocca»* ha ora **una sola eccezione, dichiarata da lui**: una riconnessione, in
> **lettura**, sull'anagrafica — cioè la **voce 182**. E il ponte che serve va verso il
> **gestionale** di PROD, **non** verso Matchpoint.
>
> ---
>
> ## 🎯 LA DECISIONE PRESA SUL `togli`, e il perché
>
> 🗣️ Lui: *«decidi tu come procedere»*. ⇒ **Il `togli` dei secret `MATCHPOINT_*` resta PER ULTIMO**,
> dopo la 180. **Non** per prudenza sul gesto — è dimostrato reversibile — ma perché finché si
> costruisce la lettura nativa **la scheda è il banco di lavoro**, e accecarla proprio mentre ci si
> lavora sopra costa e non insegna niente.
> 🎯 Alla fine invece la prova è quella vera: *tolgo la chiave e non cade niente.*
> 📏 **La finestra cieca, misurata**: le 6 sync **non** soffrono (il cron su `cudi` è spento, 5 job
> e nessuno parla con Matchpoint); soffrono la **scheda partita** (roster e importi, via
> `matchpoint-bookings-edit` con `read:true`, l'unica strada che salta il recinto), il **borsellino**
> e lo **stato coda**.
>
> ---
>
> ## 📊 STATO, misurato a fine sessione
>
> | | |
> |---|---|
> | **PROD** | `v6.397`, **intoccato**. Stanotte su `main` sono andati solo workflow e documenti |
> | **TEST** (il sistema nuovo) | `v6.401` · edge 177+178+**179** in servizio su `cudi` |
> | guardie | `guard-worker-sync` · `guard-docs-truth` **verdi su tutti e due i rami** |
> | lista lavori | 🔴 **4 urgenti** (177 · 178 · 180 · **183**) · 📋 **3 in coda** (181 · 182 · 184) · 📦 **171 chiuse** |
> | banco | **125 file verdi, 0 rossi** (7 Deno saltati) |
>
> ⚠️ **Il codice di 177/178/179 sta SOLO su `test-preview`** e si deploya solo su `cudi`:
> `supabase/functions/**` non è fra i file che `guard-worker-sync` tiene identici.
>
> ---
>
> ## ⏭️ LE VOCI APERTE, con dentro cosa manca a ciascuna
>
> · **177** — un gesto vero che legga le fasce ⇒ **è il primo lavoro qui sopra, ed è sbloccato**;
> · **178** — la prova del distacco: `togli`. ⭐ L'attrezzo è pronto e il ritorno è **dimostrato**;
>   ⏳ per decisione va **dopo la 180**;
> · **180** — 💶 **il pezzo più grosso**: la scheda legge i soldi da Matchpoint **dal vivo**, fuori
>   dal recinto (`matchpoint-bookings-edit:670`). 📏 Delle **256** `staff_booking` vive solo **14**
>   portano gli importi: **242 hanno solo i nomi**. ⛔ **Dipende dalla 183**;
> · **183** — 📐 **i prezzi**: `null` su tutte e 41 le fasce. **È sua**, non mia. E la metà
>   «griglia non fatta rispettare» resta da fare;
> · **181** cassa nativa (dipende dalla 180) · **182** il travaso una-tantum (⇒ è la riconnessione
>   che lui ha annunciato) · **184** l'ambiente riconosciuto dall'hostname — 🚨 **la più
>   pericolosa**, in coda solo perché va fatta **al momento del passaggio**.
>
> ---
>
> ## 🥇 LE COSE DA PORTARSI DIETRO (tutte pagate stanotte)
>
> **① Una sonda che interroga UNA fonte risponde su quella fonte, non sul fatto.** Pagata **tre
> volte** di fila sulla stessa sonda: prima guardando solo `pm2_env`, poi solo una cartella, poi
> cercando il processo con `pgrep -f <nome pm2>` — che è il nome di pm2, non la riga di comando.
> ⇒ Si chiede a più fonti **e si dichiara quale ha risposto**.
>
> **② Un errore silenziato ha la stessa faccia di un valore assente.** I `2>/dev/null` di comodo
> hanno nascosto proprio la riga che avrebbe spiegato il buco. ⇒ Quando una sonda non trova, deve
> stampare **dove ha guardato** — solo nomi, mai contenuti.
>
> **③⭐ Un DIGEST pubblicato è un testimone che non rivela niente e conferma tutto.** Supabase non
> mostra i valori dei secret ma ne pubblica lo `sha256`: confrontarlo con lo sha di ciò che si è
> recuperato trasforma «il ritorno è plausibile» in «il ritorno è dimostrato». Stessa idea usata per
> passarsi il segreto del ponte senza mai vederlo.
>
> **④⭐⭐ Un mascheramento fuori posto è una misura.** Il primo passaggio del segreto era sbagliato,
> e lo ha detto il log **senza mostrare niente**: GitHub aveva oscurato l'indirizzo del gestionale
> (`URL_NUOVO: ***/…`), e censura **solo** il valore del segreto ⇒ nella casella c'era l'indirizzo.
> *Dice cosa c'è nella cassaforte senza aprirla.*
>
> **⑤ Il posto giusto dove interpretare un dato è quello dove non serve annidare una terza
> sintassi.** Python dentro `ssh` dentro un blocco YAML non è un file valido: di là si **raccoglie**,
> di qua si **interpreta**. E si controlla con `bash -n` sul passo **estratto dal workflow**, non
> solo con `yaml.safe_load`.
>
> **⑥ Una regola si applica anche quando è scomoda.** Il primo PR verso `main` era aperto da
> `test-preview` (75 file, +7779/−2889): chiuso senza mergiare e rifatto **da un ramo basato su
> `main`, con le sole righe**, come dice la regola 3/4.
>
> ---
>
> ## ⛔ COSA NON DARE PER FATTO
> · **PROD non si tocca** — con l'unica eccezione dichiarata da lui (la 182, in lettura);
> · **`scritturaAlCircoloConsentita` è cablata sul ref di PROD** (11 copie byte-identiche): è
>   l'unica cosa che impedisce al sistema nuovo di scrivere sul Matchpoint del circolo. **Va tenuta
>   per sempre**, e chi la trovasse «da generalizzare» stia fermo;
> · la lista delle simulazioni legate a `PMO_IS_TEST_ENV` **non è chiusa**: prima del passaggio va
>   cercata tutta (`grep -n 'PMO_IS_TEST_ENV\|isTestEnv()'`);
> · **nessuna regola di prenotazione esiste** oltre a: 30 giorni di anticipo, durata 30-180,
>   07:00-23:30, 4 giocatori. Nessun limite alle partite aperte, nessun preavviso di disdetta,
>   nessuna tabella dei campi, nessun listino, nessun modello di chiusure. Lui **crede** siano
>   definite.

---

## 🔧 DETTAGLI OPERATIVI (fuori dal prompt)

### Gli attrezzi nuovi di stanotte
| workflow | cosa fa | pericolo |
|---|---|---|
| `sonda-ponte-soci.yml` | chiama il ponte di `cudi` in **sola lettura** (`verifica`) | nessuno: non scrive, non chiama il worker, cablato su `cudi` |
| `secret-matchpoint-sistema-nuovo.yml` | `verifica` · `togli` · `rimetti` dei 4 secret su `cudi` | `togli` acceca le letture dal vivo finché non si `rimetti` |

### Come si prova la 179 a mano (e come si rimette a posto)
```sql
-- guarda com'è adesso
select payload->>'value' from pmo_cloud_records
 where record_type='app_setting' and local_key='pmoFontePrenotazioni';
-- rimettila com'era, se una prova la lascia diversa
update pmo_cloud_records
   set payload = jsonb_build_object('key','pmoFontePrenotazioni','value','nativa')
 where record_type='app_setting' and local_key='pmoFontePrenotazioni';
```
⚠️ **Dev'essere `nativa`**: è lo stato in cui la sessione l'ha lasciata, ed è quello giusto per il
sistema nuovo.

### Ambiente
- **Non esiste nessun tool MCP per i secret Supabase**: si passa dai workflow.
- **La VM si raggiunge da Actions via SSH**, non dalla shell della sessione cloud (esce solo la 443).
- ⭐ **Le edge di `cudi` invece si chiamano direttamente in HTTPS dalla sessione cloud** — misurato
  stanotte: un `curl` con chiave finta torna `401`, uno con la chiave giusta `200`.
- Banco: `find supabase consumer-app tools test \( -name '*.test.mjs' -o -name '*.test.ts' \)`, poi
  `node --experimental-strip-types` su ciascuno. **7 sono Deno** (importano `https://`) e vanno
  saltati: si riconoscono da `ERR_UNSUPPORTED_ESM_URL_SCHEME`.
  🚨 **Non contare i file «senza riepilogo» come sani**: formati di output diversi e crash hanno la
  stessa faccia. Si guarda il **codice di uscita**.
- I conteggi di `guard-docs-truth` si replicano in locale **prima** di spingere: sono **otto**
  numeri, e gli `awk` stanno in `.github/workflows/guard-docs-truth.yml` righe 215-300.

### Le misure di stanotte (da non rifare)
| cosa | valore |
|---|---|
| i 4 secret Matchpoint su `cudi` | tutti presenti; **sha == digest** su tutti e quattro |
| dove stanno davvero | `/opt/matchpoint-worker/.env` (**non** in `pm2_env`) |
| segreto del ponte sulla VM | **non c'è**: pm2 72 chiavi, nessuna di segreto; `/proc` leggibile e senza |
| ponte su `cudi` | **armato** (401 con chiave finta, non 503) |
| timbro freschezza su `cudi` | fermo al **07/09 15:30**, e non si muove più |
| `cron.job` su `cudi` | **5**, nessuno parla con Matchpoint |
| fasce prenotabili | **41**, prezzo `null` su **tutte** |
| banco | **125 file verdi, 0 rossi**, 7 Deno saltati |

### PR di stanotte su `main`
**#1487** l'attrezzo dei secret a tre fonti + digest · **#1488** il passaggio di consegne precedente ·
**#1489** la 183 promossa · **#1490 #1491 #1492 #1494** la sonda del ponte (quattro giri) ·
**#1493** l'ultimo ponte verso PROD + scheda 179 · **#1495** la 179 chiusa.
**#1486** chiusa senza mergiare: era aperta dal ramo sbagliato.
