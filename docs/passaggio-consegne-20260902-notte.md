# Passaggio di consegne — 02/09/2026, notte (fine 73ª sessione)

**Come si usa:** incollalo come primo messaggio della chat nuova. È scritto per essere capito
**senza** la conversazione precedente.

---

## 🟢 LA PRIMA COSA DA SAPERE

> **L'incasso è acceso nella scheda della partita** — e l'edge che i bottoni chiamavano
> **non esisteva su PROD**, come lo storno il giorno prima. Vista **prima** che qualcuno ci passasse.
> ⏳ **Resta una sola prova fisica, ed è sua: il primo incasso vero, domani in segreteria.**

| | inizio sessione | adesso |
|---|---|---|
| versioni app | PROD 6.274 · TEST 6.286 | **PROD 6.276 · TEST 6.289** |
| PR fuse | — | **#1282** e **#1283** |
| edge vive sui pagamenti | 1 (`payment-void`) | **2** — nasce `matchpoint-payment-write` |
| copie del recinto `scrittura-al-circolo.ts` | 9 | **10** |
| banco | 79/81 | **80 su `main` · 82 su `test-preview`** |
| urgenti in lista | 3 | **7** (una chiusa, cinque entrate) |

⚖️ **Il filo della giornata:**
> *Due volte in due giorni l'app ha chiamato una porta che non esisteva, e nessuno se n'era
> accorto perché un flag spento impediva di premere il bottone.*
> ⇒ **Il flag che nasconde un bottone è anche ciò che impedisce di accorgersi che dietro non c'è
> niente: il difetto non si manifesta finché non lo si accende, cioè nel momento peggiore.**
> Adesso c'è una guardia che lo dice prima — e alla prima corsa ne ha trovato un terzo.

---

## 0. 📦 Stato alla consegna

| | |
|---|---|
| PR | **#1282** e **#1283** fuse. Nessuna aperta |
| rami | `main` ↔ `test-preview` allineati sui 4 percorsi sorvegliati (verificato) |
| deployati | app **PROD 6.276** · **TEST 6.289** · edge `matchpoint-payment-write` **v1 ACTIVE su tutt'e due** |
| banco | **80 verdi / 0 rossi** su `main`, **82** su `test-preview` |
| migrazioni | **nessuna** |
| bot · worker | **non toccati** |

### ⛔ LE COSE DA FARE PER PRIME
1. **Chiedergli com'è andato il primo incasso vero** (§4). Chiude la voce **125**.
2. **La voce 127** — la scheda della partita tagliata in alto: serve il suo schermo, da qui non si
   riproduce (§5).
3. **La voce 128** — Cash · Card · Wallet ovunque: è lavoro vero, ~100 stringhe, e dentro ci sono
   chiavi che NON si toccano (§5).
4. **La voce 129** — il saldo wallet a colpo d'occhio nella riga del giocatore: **il dato c'è già**,
   e resta **una domanda sola** da fargli (§5).

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

🩹 **E controlla l'ORA prima di scrivere una data.** Stanotte ho scritto `03/09` in una ventina di
punti — commenti, guardie, registri e messaggi di commit — perché era passata la mezzanotte **in
UTC** ma non a Roma. I file sono stati corretti; i commit già spinti no.
```bash
TZ=Europe/Rome date '+%Y-%m-%d %H:%M'
```
📌 *Una data si legge, non si ricorda: chi lavora di notte la sbaglia sempre nello stesso verso, e i
documenti datati sono esattamente quelli in cui l'errore poi non si vede più.*

---

## 2. 🔨 COSA HA FATTO LA 73ª

### 💶 L'INCASSO ACCESO NELLA SCHEDA PARTITA (voce 125) — e la porta che non c'era

🗣️ Sua richiesta: *«adesso direi che puoi procedere con l'accensione dei soldi nella scheda
partita»*. Messo davanti alle strade ha scelto **solo l'incasso**: lo storno resta nella scheda
socio → Pagamenti.

🚨⭐⭐ **Misurato PRIMA di girare l'interruttore, e ha fermato un guasto.** Il flag vecchio
`PMO_PAYMENTS_WRITE_ENABLED` accende **due** cose, e solo una aveva una porta:

| pezzo | edge | c'era? |
|---|---|---|
| ↩︎ storno di riga nella scheda partita | `matchpoint-payment-void` | ✅ v1 ACTIVE (01/09) |
| incasso Cash · Card · Wallet | `matchpoint-payment-write` | ❌ **mai esistita su PROD** |

Il sorgente stava in `supabase/functions/_archive/`, che i workflow **saltano di proposito** (filtro
`$3 !~ /^_/`): esiste in git, si legge, compare in un `grep` — e su Supabase non arriva mai.
⇒ Accendendo il flag così com'era, tre bottoni sarebbero comparsi in segreteria e **ogni click
sarebbe stato un 404**.

🔨 **Cosa è stato fatto:**
- `matchpoint-payment-write` **fuori dall'archivio e dentro il recinto** `scrittura-al-circolo.ts`
  (**decima copia**). ⚖️ È la condizione a cui torna, non un dettaglio: il 9/08 lui stesso l'aveva
  archiviata proprio perché scriveva denaro **fuori** dal recinto.
  📌 *Una funzione si archivia per un difetto: riaccenderla senza aver curato quel difetto è
  rimettere in servizio il difetto, non la funzione.*
- **Flag nuovo e separato `PMO_PAYMENTS_COLLECT_ENABLED`**, e la variabile che comandava i due gesti
  **sdoppiata** in `_payCollectActive` / `_payVoidActive`: una variabile sola non sa dire di sì a uno
  e di no all'altro. ⇒ **`PMO_PAYMENTS_WRITE_ENABLED` resta `false`.**
- 🧾 **Nessun record `payment` ottimistico**, di proposito: la sezione Incassi somma *tutti* i
  `payment` e il sync ne porta uno autorevole entro pochi minuti ⇒ ne conterebbe **due**.
  ⚖️ Verso opposto a quello dello storno, dove marcare subito è lecito perché si scrive *esattamente
  ciò che il sync scriverebbe* (`voided_at`); qui la riga nuova avrebbe un `seq` che non possiamo
  conoscere. 📌 *Anticipare il sync è lecito solo quando si sa scrivere la sua stessa riga:
  altrimenti non si anticipa, si duplica.*

📏 **Il worker non era un ostacolo, e non è dedotto**: il kill-switch `MATCHPOINT_PAYMENT_WRITE_ENABLED`
è **acceso** sulla VM, e lo dimostra la sua ricarica del borsellino del 01/09, che passa dallo stesso
interruttore ed è riuscita.

📏 **Cosa scrive su Matchpoint**, letto nel worker: imposta l'importo sulla riga, clicca *Incassare*,
sceglie la voce nel dialog «forma di pagamento» **per testo** (`cash → Contanti`, `card → Carta`,
`wallet → Saldo disponibile`), salva con *Actualizar*, **poi ricarica la scheda e rilegge il pendente
per verificare che sia 0**. Non si fida del click.

### 🚪 LA GUARDIA NUOVA — scritta sulla CLASSE, e ha trovato un terzo caso

`test/porta-che-non-ce.test.mjs`: **ogni** `/functions/v1/…` che l'app compone deve avere un sorgente
**deployabile** e **non archiviato**.

🩹 Alla prima corsa è diventata rossa su una cosa che nessuno cercava: `matchpoint-payment-void` era
stata riscritta il 01/09 **senza togliere da `_archive/` la versione di giugno** — 157 righe contro
276, e l'archiviata era quella **senza recinto**. Chi fosse andato a leggere «il codice dello storno»
avrebbe letto il più imprudente.
📌 *Un gemello stantio è peggio di nessuna copia: chi lo trova non ha modo di sapere che non è quello
in servizio.*

⚠️ **Cosa quella guardia NON dice**: legge il **repo**, non Supabase. Dice «il sorgente c'è e il
deploy lo prende», non «la funzione è viva». L'altra metà è `list_edge_functions`, che è una misura
e non un banco.

E il **caso 9** del banco del recinto ora copre anche `matchpoint-payment-void`, che il giorno prima
era entrato fra le **copie** ma non fra le **strade**.
📌 *Avere il modulo e attraversarlo sono due fatti diversi, e servono due guardie diverse.*

### 📐 LA TAB ANAGRAFICA SU DUE RIGHE (voce 126) — chiusa

🗣️ Sua richiesta: *«nome, cognome, sesso e livello di gioco tutto su una riga. E poi telefono, email,
bot Telegram anche quello tutto su una riga.»*

- griglia **da 6 a 12 colonne**: con sei, quattro campi non si dividono (6/4 = 1,5) e il quarto va a
  capo da solo;
- 🩹⭐ **la prima riga NON è 3+3+3+3, e questo si è visto solo APRENDOLA**: a quarti esatti il campo
  del livello è largo ~271px e dentro ci stanno numero + «Avanzato» + «🔓 Cambia livello» = ~292px.
  Il bottone andava a capo e lasciava un **gradino di ~30px**. ⇒ **3+3+2+4**, altezza della griglia
  da **188 a 148px**.
  📌 *Quattro campi su una riga non sono quattro quarti: sono quattro campi che chiedono spazi
  diversi, e quanto chiedono lo dice la pagina aperta, non il codice.*
- classi **rinominate** (`c-sesto`/`c-quarto`/`c-terzo`): dicono la **frazione**. `c2`/`c3` su una
  griglia da dodici avrebbero significato il contrario del vero;
- terzo gradino fra 761 e 1024px (due campi per riga).
- ⛔ `.member-form-grid` **non toccata**: la usano anche le pieghe e altre sezioni.

📏 Guardata su TEST **e** su PROD a tre larghezze: 1440 → 4+3 · 950 → 2+2+2+1 · 600 → uno per riga.

---

## 3. 🧠 I DIFETTI PRESI, e come

- 🔪 **Le guardie hanno accusato il codice due volte, e avevano torto loro.**
  ① La guardia 11 leggeva **anche** le larghezze dentro i `@media`, quindi calcolava righe da due
  campi e dava rosso su un layout giusto. ② Cablava esattamente **due** classi nel gradino di mezzo,
  ed è diventata rossa appena il Sesso ne ha presa una sua.
  📌 *Una guardia che legge più CSS di quello che si applica misura una pagina che non esiste — e
  accusa il codice invece di sé stessa.*
- 🔧 **La console remota aveva la finestra CABLATA a 1440×900.** Per un lavoro di layout è **una
  misura sola**, e le pieghe di questa app stanno a 1024 e a 760px. Ora ha `--viewport <L>x<A>`, e un
  valore storpiato fa **fallire** il lancio invece di ripiegare in silenzio.
  📌 *Un attrezzo di diagnosi che sa fare una sola domanda fa credere che ci sia una sola risposta.*
- 🩹 **«Il ↩︎ non c'è» era vero e non era un difetto.** Lui non lo vedeva perché aveva aperto **la
  propria scheda**, che ha due soli movimenti (la ricarica di prova e il suo storno) e **zero partite
  pagate** ⇒ niente da stornare. Misurato aprendo l'app: su Michael Grossa **22 bottoni su 23 righe**.
  📌 *Prima di credere a «manca», si va a vedere se il caso che si sta guardando è quello giusto.*
- 🩹 **La sua schermata diceva v6.273 mentre PROD serviva la 6.275**: pagina in cache. Prima di
  cercare un difetto nel codice, guardare **quale versione ha davanti** chi lo segnala.

---

## 4. ⏳ LA PROVA FISICA CHE MANCA — è sua, e chiude la 125

> **Il primo incasso vero dal gestionale.** Scheda di una partita → riga di un giocatore che deve
> ancora pagare → importo giusto → **Cash**.

⭐ **Il metodo è suo ed è migliore di quello che avevo proposto io.** Io avevo suggerito 1 € + storno;
lui ha obiettato — *«se lo faccio su prod un incasso mi va sulla cassa di oggi, che quindi cambia da
quella reale»* — e ha proposto di usare **incassi veri che deve fare comunque**. Così la cassa è
corretta **per costruzione**, e la prova è più forte perché è il gesto reale nelle condizioni reali.

**Cosa chiedergli**: ① il pendente della riga è andato a **zero**? ② su Matchpoint la **tipologia** è
quella giusta?

⛔ **Su TEST non si può, e non è il recinto a fermare per primo**: misurato su `test.padelvillage.club`,
`PMO_PAYMENTS_SIMULATE` è acceso ⇒ l'app prende il ramo **simulazione** e **non chiama nessuna edge**.
Il recinto è il secondo strato, e non ci si arriva nemmeno. Premere là dimostra la schermata, non
l'incasso.

---

## 5. ⛔ IL LAVORO CHIESTO E NON ANCORA FATTO

### 🖼️ Voce 127 — la scheda della partita si apre TAGLIATA in alto

🗣️ *«quando clicco dentro una partita si apre la scheda della partita in maniera sbagliata. Non vedo
la parte alta.»* Con schermata: «Modifica prenotazione» tagliata dal bordo superiore del pannello.

📏 **Presente anche nella sua schermata su PROD 6.273** ⇒ non l'hanno portata la 125 né la 126.
⛔ **NON riprodotta, e la strada ovvia è chiusa**: con `tools/verifica-browser` su PROD **il calendario
non si popola**, perché la console blocca di proposito tutto `/functions/v1/`, che è la strada da cui
il calendario staff prende le prenotazioni ⇒ zero riquadri cliccabili. La sonda ha risposto
*«nessuna prenotazione cliccabile»*, e quella risposta parla dell'**attrezzo**, non dell'app.
📌 *Una sonda che non raggiunge il caso non dice «non succede»: dice «non ho guardato».*

⇒ **Serve il suo schermo, o il Mac.** Due domande, cinque minuti: ① il pannello è **scrollato** (il
titolo esiste ma sta sopra il bordo) o **tagliato** (il contenitore parte più in alto della
finestra)? ② succede **sempre** o solo mentre la lista giocatori sta ancora caricando — in tutt'e due
le sue schermate il pannello diceva *«Aggiorno la lista giocatori da Matchpoint…»*, e un contenuto
che cresce dopo l'apertura è il sospettato numero uno.

### 🏷️ Voce 128 — Cash · Card · Wallet ovunque

🗣️ In tre messaggi: *«chiamiamolo ovunque wallet»* e *«anche gli altri chiamiamoli comunque cash e
card, perché sono più brevi e mi aiutano quando apro la scheda della partita a non andare a capo»*.

⭐ La ragione è una **misura**, non un gusto: `Contanti`+`Carta`+`Borsellino` = 24 caratteri contro
`Cash`+`Card`+`Wallet` = 14, e nella scheda della partita la colonna è stretta.
⚖️ Nella scheda partita i bottoni si chiamano **già** così: è **tutto il resto** che parla italiano —
la sezione Pagamenti della scheda socio, la sezione **Incassi**, le finestre di conferma, la fascia,
la colonna dell'elenco soci. ⇒ Oggi la stessa cosa ha **due nomi in due schermate**.

🚨 **NON si fa con un `sed`.** Dentro la stessa parola convivono l'etichetta e la **chiave**:

| dove | cos'è | se lo si rinomina |
|---|---|---|
| `view_members_borsellino` | chiave di **PERMESSO**, salvata nei profili staff | colonna, fascia e tab Pagamenti spariscono a chi li vedeva |
| `come:'borsellino'`, `sel.borsellino`, `d.borsellino`, `pl.borsellino`, `_PAY_METHOD_LABEL`/`_ICON` | chiavi di **DATO** dell'aggregazione **Incassi** | i totali per metodo vanno a zero |

📌 *In una stessa parola convivono l'etichetta e la chiave: la prima si traduce, la seconda no — e si
distinguono solo guardandole una per una.*
⚠️ E «**carta**» è una parola comune: compare anche dove non c'entra col pagamento.
⏳ **Una domanda per lui**: vale anche per il **bot dei soci** (repo separato), che al socio dice
«borsellino»? Lì è la parola che leggono i soci, non la segreteria.

### 🏷️ Voce 128 — la parte DECISA: il bot NON si tocca

🗣️ Risposta sua alla domanda che avevo lasciato aperta: *«non ti preoccupare che nel bot si chiama
Borsellino. Il bot lo vedono i soci, il gestionale di prod lo vede la segreteria. Devi solamente
ricordare che sono la stessa cosa.»*
⇒ **Due parole per due pubblici**, ed è una scelta: `Wallet` in segreteria, `Borsellino` al socio.
La 128 vale **solo per il gestionale**; `assistente-padel-agent` resta com'è.

🚨 **E con questa scelta la stessa cosa ha QUATTRO nomi** — la tabella sta nella scheda della 128, e
dentro c'è il vincolo duro: su **Matchpoint** la voce si chiama **«Saldo disponibile»** e **non si
tocca mai**, perché il worker la clicca **per testo** (`cobroMethodLabels.borsellino`). Cambiarla
vuol dire che l'incasso dal wallet non trova più il bottone.
📌 *Quando la stessa cosa ha nomi diversi per ragioni buone, la cosa da scrivere non è quale nome sia
giusto: è la tabella che li tiene insieme. Senza, il primo che ne trova due pensa di aver trovato un
difetto — e «aggiusta».*

### 👛 Voce 129 — il saldo wallet a colpo d'occhio (idea sua, e il dato c'è già)

🗣️ *«sotto il nome c'è solamente l'importo. Potremmo spostare l'importo tutto a destra e sulla
sinistra mettere un'iconcina con un emoticon di un borsellino… è un colpo d'occhio molto carino per
chi fa segreteria e cassa la sera.»*

📏⭐ **Il worker manda `saldoCents` su OGNI riga del roster** (`server.mjs:7811`), letto dalla ficha
Matchpoint nello stesso giro che legge i giocatori. Oggi l'app lo usa per **una cosa sola** — decidere
se il bottone Wallet è premibile — e poi lo butta via. ⇒ Non costa **una chiamata in più**.
⛔ **Non pescare dal cloud**: `wallet_balance` è una fotografia di **40 righe** (28 con credito), è il
report «clienti con credito residuo» e resta ferma all'ultimo giro.

🔨 **Due scelte di disegno già prese** (e scritte nella scheda): ① la pastiglia si mostra **solo a chi
ha credito**, o con `👛 0,00 €` su tre righe su quattro l'occhio smette di vederla; ② `saldoCents` può
essere `null` ⇒ **mai** scrivere `0,00 €` quando la verità è «non lo so» (è l'errore della 114).
✅ **Deciso da lui: la pastiglia è MUTA**, non cliccabile — nella scheda della partita ogni cosa
cliccabile è un gesto che tocca il circolo.

⏳ **E L'UNICA DOMANDA APERTA DI TUTTA LA LISTA**, sua seconda idea: *«potrebbe essere carino poter
cliccare sul nome del socio e gli apre la scheda di anagrafica. Ma non so se si può fare.»*
✅ **Si può** (`switchTab` + `openMemberCard`, e il socio si trova confrontando `p.idCliente` con
`pmoIdMatchpoint(g)`), 🚨 **ma aprire la scheda socio vuol dire lasciare il calendario, e il pannello
della partita può avere modifiche non salvate** (importi digitati, giocatori aggiunti o tolti).
⇒ **Chiedergli quale delle tre**: ⓐ cliccabile solo se non c'è niente di modificato · ⓑ con conferma ·
ⓒ la scheda socio si apre **sopra**, senza cambiare tab.
⚠️ E il nome resta **muto** per chi non è in anagrafica (gli «Ospite», che nelle sue schermate sono la
maggioranza): un nome cliccabile che non apre niente è peggio di un nome normale.

### ✅ Una cosa che NON è da fare, ed è misurata
La sua preoccupazione — *«metti che uno non vuole pagare col borsellino perché si vuole tenere i
soldi»* — **è infondata**: i tre bottoni si disegnano **sempre tutti e tre**, e `cBtn`/`kBtn` si
spengono **solo** quando l'incasso è disattivato del tutto. L'unico condizionato al saldo è il Wallet
(`wBtn.disabled = !okSaldo`).

---

## 6. 🧰 ATTREZZI — quello che è servito davvero

| attrezzo | come |
|---|---|
| **console remota** | `cd tools/verifica-browser && npm ci && node console.mjs --env test\|prod --viewport 1440x900 --attesa 40000 --file <snippet.js> --shot <foto.png> --out <report.json>`. Le `PMO_VERIFY_*` **ci sono già** |
| 🆕 **`--viewport <L>x<A>`** | nuovo stanotte. Senza, ogni misura di layout è fatta su **un solo schermo** |
| **vedere la scheda socio** | forzare `window.pmoSubsectionVisibleFor = () => true` — vista **forzata**, si dichiara |
| **leggere le variabili** | ⚠️ non `window.x`: molte sono `let` di modulo. `const leggi=(n)=>{try{return eval(n)}catch(e){return undefined}}` |
| **⚠️ la console blocca `/functions/v1/`** | quindi **il calendario staff non si popola** e le schede partita non si aprono. Una misura che «non trova niente» va sospettata prima dell'app |
| **il risultato sta in cima al report** | `--out r.json` poi `python3 -c "import json;print(json.load(open('r.json'))['risultato'])"`: il `tail` mostra solo i log |
| **leggere il DB di PROD** | `mcp__Supabase__execute_sql` su `qqbfphyslczzkxoncgex`. La tabella è **`pmo_cloud_records`** |
| **sapere cosa è DAVVERO vivo** | `list_edge_functions` sui due progetti: è l'unica misura che distingue «il sorgente c'è» da «la funzione risponde» |
| 🩹 **lo stato dei check di una PR** | `get_check_runs` può restituire uno stato **vecchio**: se dice `in_progress` da minuti, guarda i **log del job** o `list_workflow_jobs`, che dicono la verità |

---

## 7. 🤝 Come si procede (invariato)

> *«Procediamo sempre come tu pensi sia corretto»* — copre anche le promozioni; il freno è la
> **dichiarazione**. Fuori: **inventare voci non in lista**, e l'irreversibile/visibile (si dice
> prima, anche procedendo). ✋ **Un task non è finito finché non è provato fisicamente.**
> 📌 E: **«scrivi troppo» — risposte corte.**

⭐ **La regola che stanotte ha pagato di più**: *quando un interruttore accende due cose, guarda che
ci sia una porta dietro a tutte e due — prima di girarlo.* Due volte in due giorni la porta non
c'era, e la seconda l'abbiamo scoperta col bottone ancora spento invece che con un 404 in segreteria.
