# Passaggio di consegne — 02/09/2026, sera (fine 72ª sessione)

**Come si usa:** incollalo come primo messaggio della chat nuova. È scritto per essere capito
**senza** la conversazione precedente.

---

## 🟢 LA PRIMA COSA DA SAPERE

> Oggi è nata la **sezione Pagamenti**, le **ricariche hanno cominciato a esistere**, e si può
> **stornare un pagamento** — l'edge che serviva **non esisteva** e l'ho scritta.
> ⏳ **Resta una sola prova fisica: uno storno vero su PROD, e la fa lui.**

| | inizio sessione | adesso |
|---|---|---|
| versioni app | PROD 6.268 · TEST 6.275 | **PROD 6.274 · TEST 6.286** |
| PR fuse | — | **#1275 → #1280** (sei) |
| banco `scheda-anagrafica-riordinata` | 16 casi | **23 casi** |
| copie del recinto `scrittura-al-circolo.ts` | 8 | **9** |

⚖️ **Il filo della giornata, ed è uno solo:**
> *tre volte ho spiegato un numero invece di misurarlo, e tre volte la misura mi ha smentito.*
> «Sta elencando i pagamenti di tutti» (era il cliente Ospite) · «quei 3.001 € sono simulazioni
> ripulite» (erano storni veri, e l'avevo già scritto in un commit) · «solo 2 pagamenti su 3124
> risalgono» (cercavo `idReserva`, il campo si chiama `numero`: sono **2796 su 3126**).
> **Una spiegazione plausibile trovata subito è il modo più rapido per smettere di cercare quella vera.**

---

## 0. 📦 Stato alla consegna

| | |
|---|---|
| PR aperte | **#1280** (l'ultima, in CI mentre scrivo — verificare che sia fusa) |
| rami | `main` ↔ `test-preview` allineati sui 4 percorsi sorvegliati |
| deployati | app **PROD 6.274** · **TEST 6.286** · edge `matchpoint-payment-void` **v1 ACTIVE** |
| banco | **79 verdi / 0 rossi** su `main`, **81** su `test-preview` |
| migrazioni | **nessuna** — `wallet_txn` era già fra i tipi ammessi dal CHECK |
| bot · worker | **non toccati** |

### ⛔ LE DUE COSE DA FARE PER PRIME
1. **Verificare che la #1280 sia fusa** e che PROD serva **6.274** (`curl -s https://app.padelvillage.club/ | grep -o "APP_VERSION = '[0-9.]*'"`).
2. **Chiedergli la prova fisica dello STORNO DI UN PAGAMENTO** su PROD — §4.

---

## 1. ✅ Prima di lavorare

```bash
git fetch origin main test-preview
git diff origin/main origin/test-preview -- CLAUDE.md docs/ .github/workflows/ \
  tools/matchpoint-browser-worker/src/server.mjs
```
✅ Dev'essere vuoto. 📕 `docs/lavori/README.md` si apre **PRIMA di lavorare**.
🚨 Clone shallow: `git reset --hard origin/<ramo>` dopo il fetch.

🚨 Il banco NON si lancia con `node --test`:
```bash
r=0; v=0
while IFS= read -r f; do
  grep -qE "^\s*(import|export).*['\"]jsr:" "$f" && continue
  if node "$f" >/dev/null 2>&1; then v=$((v+1)); else r=$((r+1)); echo "❌ $f"; fi
done < <(find supabase consumer-app tools test \( -name '*.test.ts' -o -name '*.test.mjs' \) | sort)
echo "$v verdi, $r rossi"
```

🩹 **E il banco singolo si legge col CONTEGGIO, non con `tail`**: oggi ho spinto due volte con un
rosso perché `| tail -2` mostrava le **ultime due prove** (verdi) invece del riepilogo.
```bash
node test/scheda-anagrafica-riordinata.test.mjs 2>&1 | grep -E "verdi · |^FAIL"
```

---

## 2. 🔨 COSA HA FATTO LA 72ª

### 💳 LA SEZIONE PAGAMENTI (nuova, al posto del tab «Attività»)

Saldo · speso in partite · ricaricato · rimborsato, poi l'elenco per data — partite (con campo e
ora), omaggi, ricariche, storni — con gli storni **barrati e col meno**, tetto di **50 righe** e
«mostrali tutti».

🚨⭐⭐ **Legge DUE tipi di record, e non è un dettaglio**: `payment` (speso) e `wallet_txn`
(versato/tolto dal borsellino). Mescolarli romperebbe i conti: una ricarica **non è un incasso**.

### 🧾 LE RICARICHE ORA ESISTONO

📏 Misurato: `matchpoint-wallet-correct` chiamava il worker e **non scriveva niente**;
`wallet_balance` (40 righe) è una **fotografia del saldo**, non lo storico. Il gestionale sapeva
*quanto ha* un socio, non *come ci è arrivato*.

⇒ L'edge registra il movimento **nell'istante in cui il circolo conferma** (voce 75), e lo fa **lì
e non nell'app**: una scheda chiusa un secondo dopo perderebbe il movimento.

🚨⭐⭐ **NON è un record `payment`, che era la scelta ovvia e sbagliata**: la sezione Incassi somma
*tutti* i `payment`, e il circolo incassa quando il credito viene **speso** — quella riga esiste già
(`method: 'wallet'`). Contarla due volte avrebbe **gonfiato i totali del circolo di ogni euro
ricaricato**. Va in **`wallet_txn`**, già ammesso dal CHECK e con **zero righe**.
📌 *Il tipo giusto per un dato non è quello che gli somiglia: è quello che non rompe i conti di chi
legge gli altri.*

### ↩︎ STORNARE UN PAGAMENTO — e l'edge che non c'era

🚨⭐⭐ **`matchpoint-payment-void` NON ESISTEVA**: `_pmoVoidPayment` la chiamava da mesi, ma non era
**né in git né su Supabase**. A nasconderlo era `PMO_PAYMENTS_WRITE_ENABLED = false`, che impediva
al bottone di comparire — **il 404 non è mai arrivato a nessuno perché nessuno ha mai potuto premere**.
📌 *Codice che chiama una porta che non c'è non dà errore finché nessuno ci passa: il flag che lo
nasconde è anche ciò che impedisce di accorgersene.*

- Edge **scritta oggi**, col recinto `scrittura-al-circolo.ts` come **nona copia**.
- **Flag nuovo e separato `PMO_PAYMENTS_VOID_ENABLED`**: accendere quello vecchio avrebbe acceso
  **anche l'incasso**, che non era stato chiesto. 🗣️ Gliel'ho detto prima e ha scelto il solo storno.
  ⇒ **`PMO_PAYMENTS_WRITE_ENABLED` resta `false`.**
- Bottone **↩︎** su ogni riga dei Pagamenti dove la prenotazione è stata trovata (**89%**); dove no,
  un trattino che **spiega perché**.

📏 **Come si risale dal pagamento alla prenotazione** (misurato, ed è il pezzo che sblocca tutto):
il record del pagamento **non ha l'idReserva** — la sua chiave è
`pay|idClienteMp|codice|giorno|importo|metodo|seq` e `mp_payment_ref` è **vuoto ovunque**. Ma nei
record `booking`/`booking_history` quel numero **c'è e si chiama `numero`** (identico a `idReserva`
su 158 righe su 158). ⇒ **2796 pagamenti su 3126 risalgono, ZERO ambigui**.

### 🗑️ VIA due tab, ma solo dopo aver traslocato gli inquilini

| tab | cosa viveva SOLO lì | dove è andato |
|---|---|---|
| **Borsellino** | «↩︎ Storna» · nota per i soci senza id Matchpoint | fascia in cima (`member-hero-nota`) |
| **Attività** | «Nuova autovalutazione» | tab Autovalutazione |

📏 Il resto era misurabilmente morto: feedback post-partita **0 soci su 2823**; «Ultimo messaggio
inviato» **scritto fisso a `-`**; contatori messaggi in `localStorage` (da un altro computer zero).
📌 *«L'abbiamo integrata totalmente» è un'ipotesi da verificare voce per voce, non una premessa.*

⛔ **I permessi NON si toccano**: `view_members_attivita` gated anche «Disattiva» e «Cancella socio»;
`view_members_borsellino` gated la fascia e la colonna. Ordine dei tab: **Anagrafica · Pagamenti ·
Autovalutazione**.

---

## 3. 🧠 I DIFETTI PRESI, e come

### Presi PRIMA che girassero (rileggendo il proprio codice)
- 🔪🚨 **`clean(pl.__slot_ok) !== 'no'`** in `marcaStornato`: un campo **che non esiste**, quindi
  condizione sempre vera ⇒ stornare **un** pagamento avrebbe marcato stornati **tutti** quelli del
  socio (58 su una scheda misurata), e il sync non li avrebbe rimessi a posto.
  📌 *Una riga che ha la forma di un controllo e non controlla niente è peggio di un controllo
  assente: chi rilegge la conta come fatta.*
- 🚨 **`storicoPrenotazioni` è VUOTO** nel browser di PROD (l'app non lo idrata all'avvio):
  cercarci l'idReserva avrebbe dato «non risale» su **ogni** partita passata, con le guardie verdi.
  ⇒ La sezione **si carica le prenotazioni da sé**.
  📌 *Una funzione che legge una variabile globale scommette che qualcun altro l'abbia riempita.*

### Presi solo APRENDOLA (il banco era verde)
- 🚨 **La sezione era inutilizzabile**: si clicca «Pagamenti», i dati arrivano dopo 3,6 s, e la
  scheda **saltava su Anagrafica** coi movimenti in un pannello nascosto.
- 🩹 **E la prima cura era nel posto sbagliato — lui l'ha vista saltare ancora.** L'avevo messa
  dentro `pmoCaricaPagamenti`, cioè su UN ridisegno solo. 📏 **`displayMembers()` chiama
  `renderOpenMemberCard()` in coda**, e `displayMembers` lo chiama mezza applicazione. ⇒ La cura è
  passata **in `renderOpenMemberCard`**, dove passano tutti i ridisegni.
  📌 *Curare un difetto nel punto in cui l'ho visto, invece che nel punto da cui nasce, lo lascia
  vivo in tutti gli altri — e la seconda volta lo trova l'utente.*
  ⚖️ **E la guardia era verde mentre il difetto era vivo**, perché controllava la cura nel posto
  sbagliato: *una guardia messa dove ho visto il sintomo certifica la cura del sintomo.*
- 🩹 **«Partita — campo Campo 2»**, la parola raddoppiata: nel codice `'campo ' + pl.campo` sembra
  giusto finché non sai cosa c'è dentro.

### 🚨⭐⭐ Il livello che «balla» — e non era il livello
🗣️ *«La parte del livello di gioco prima va a sinistra e poi va a destra. Poi torna a sinistra e poi
va a destra. Sembra un interruttore che si sposta.»*

📏 Misurato frame per frame e **confermato dalle sue due schermate**: è la cella **«Bot Telegram»**
che **appare**. Nasce vuota e si riempie dopo, con una chiamata a un altro database; finché era
`hidden` non occupava spazio. ⚖️ Il difetto **esisteva già**, ma il caricamento dei Pagamenti lo
**raddoppiava**: i quattro movimenti descritti sono i quattro misurati (23 · 48 · 5498 · 5519 ms).
⇒ Cura: `visibility:hidden` invece di `display:none` (classe `member-cella-in-attesa`); sparisce
davvero solo nel **403**. Misurato dopo: **da 4 movimenti a 1**.
🩹 **La mia prima sonda conteneva già la risposta** (`Bot Telegram@0w0`) e leggevo la colonna
sbagliata.

---

## 4. ⏳ LE PROVE FISICHE — la prima è sua, e manca

1. 🚨 **UNO STORNO DI UN PAGAMENTO su PROD.** Scheda socio → **Pagamenti** → ↩︎ su una riga.
   **Cosa deve vedere**: lo storno arriva su Matchpoint; la riga diventa **barrata, rossa, col
   meno**, subito, senza aspettare il sync; il totale «Rimborsato» cresce; e la scheda **non salta**
   su Anagrafica.
   ⛔ Su TEST non si può: il recinto rifiuta prima del worker (`AMBIENTE_DI_PROVA`).
2. ✅ **Già fatte da lui**: ricarica del borsellino, storno del borsellino dalla fascia, sezione
   Pagamenti che si apre. La sua schermata delle 21:26 mostra Borsellino **5,00 €** col bottone
   **Storna** in cima.

---

## 5. ⛔ IL LAVORO CHIESTO E NON ANCORA FATTO

### 🗣️ La sua richiesta di stasera, testuale
> *«Nella prossima chat possiamo ancora ottimizzare ancora gli spazi della tab anagrafica? Io
> metterei nome, cognome, sesso e livello di gioco tutto su una riga. E poi telefono, email, bot
> Telegram anche quello tutto su una riga. Lo spazio c'è.»*

⇒ Due righe da **quattro** e da **tre** campi, invece delle tre attuali da 3+2+2.

⚠️ **Cosa sapere prima di toccarla** (misurato oggi):
- La griglia è `.member-form-grid.member-griglia-fissa { grid-template-columns:repeat(6, 1fr); }`
  e i campi portano classi `c2` (un terzo) e `c3` (metà). Con 6 colonne, **4 campi su una riga non
  tornano esatti**: servono 12 colonne (3+3+3+3 e 4+4+4), oppure larghezze diverse per campo.
- 🚨 **La classe è SUA e non va cambiata `.member-form-grid`**, che serve anche alle pieghe e ad
  altre sezioni: toccarla riordinerebbe schermate che nessuno ha chiesto di toccare.
- La **guardia 11** del banco conta le classi campo per campo: va aggiornata insieme, e va scritta
  **sul fatto** (quante colonne occupa ciascuno) non sulla stringa esatta.
- ⚠️ Sotto i **760px** la griglia va a una colonna sola (`@media`): la riga da quattro deve
  degradare bene, e `@media (max-width: 760px)` compare **9 volte** nel file — 🔪 contare le
  occorrenze prima di sabotare.

### Piccole cose rimaste, dichiarate
- `openMemberWhatsApp` e `renderPostMatchFeedbackMemberSummary` e `getTotalContactCount` restano
  **definite e non chiamate**: toglierle è **un'altra decisione**.
- Ogni ridisegno della scheda **rifà la chiamata di rete al ponte del bot**. Non si vede più (lo
  spazio è riservato) ma è uno spreco: si potrebbe ricordare la risposta per socio.
- Il **11% dei pagamenti** non risale alla prenotazione (partite più vecchie dello storico): quelle
  righe lo dicono col trattino, e non sono stornabili dalla scheda.

---

## 6. 🧰 ATTREZZI — quello che è servito davvero oggi

| attrezzo | come |
|---|---|
| **console remota** | `cd tools/verifica-browser && npm ci && bash prepara-ambiente.sh`, poi `node console.mjs --env test\|prod --attesa 30000 --file <snippet.js> --shot <foto.png>`. Le `PMO_VERIFY_*` **ci sono già** |
| **leggere le variabili** | ⚠️ **non** `window.x`: molte sono `let` di modulo. `const leggi = (n) => { try { return eval(n); } catch { return undefined; } }` |
| **vedere la scheda socio** | forzare `window.pmoSubsectionVisibleFor = () => true` — vista **forzata**, si dichiara |
| **⚠️ la console blocca `/functions/v1/`** | quindi il calendario non carica; ma le **RPC** (`pmoStaffRpcPaged`) funzionano. Una misura che «non risponde» va sospettata prima dell'app |
| **snippet che falliscono** | avvolgerli in `try/catch` e restituire l'errore: senza, il campo `risultato` **sparisce** e sembra un problema di rete |
| **misurare uno sfarfallio** | `requestAnimationFrame` che registra `getBoundingClientRect()` **solo quando cambia**, partendo **prima** dell'apertura |
| **leggere il DB di PROD** | `mcp__Supabase__execute_sql` su `qqbfphyslczzkxoncgex` (lettura). `list_edge_functions` per sapere cosa è **davvero** vivo |
| **promozione per righe** | un commit alla volta, `git apply --3way`, **`git add` fra un patch e l'altro**, e uno script che **fallisce** se il conflitto non è `APP_VERSION` |

🚨⭐⭐ **E la promozione per righe oggi ha fermato DUE cose che avrebbero rotto PROD:**
- **`&& !_simulate`** non doveva entrare: su `main` quella variabile **non è dichiarata** in
  `_pmoVoidPayment` ⇒ ReferenceError **a ogni storno**;
- **il modulo del recinto è DIVERSO sui due rami** (`test-preview` esporta `MARCHIO_NATA_IN_PROVA`,
  su `main` non esiste) ⇒ la nona copia va presa da **main**, e il banco delle copie pure.

📌 *Un conflitto che non è la versione è quasi sempre una differenza che ha una ragione: si legge,
non si sceglie a caso.*

---

## 7. 🤝 Come si procede (invariato)

> *«Procediamo sempre come tu pensi sia corretto»* — copre anche le promozioni; il freno è la
> **dichiarazione**. Fuori: **inventare voci non in lista**, e l'irreversibile/visibile (si dice
> prima, anche procedendo). ✋ **Un task non è finito finché non è provato fisicamente.**
> 📌 E: **«scrivi troppo» — risposte corte.**

⭐ **La regola che oggi ha funzionato meglio di tutte**: quando un numero sorprende, **misurarlo**
invece di spiegarlo. Le tre volte in cui ho spiegato, mi sbagliavo — e una di quelle spiegazioni era
già finita in un commit prima che la verificassi.
