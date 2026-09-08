# Passaggio di consegne — 08/09/2026, sera (101ª sessione)

> **Prompt da incollare nella chat nuova.** Copia tutto quello che sta fra le due righe.

---

## 📋 PROMPT

> Riprendi il progetto **PADEL MATCH ORGANIZER**.
>
> Leggi PRIMA, in quest'ordine: **`CLAUDE.md`** (c'è un POSTULATO in testa e una sezione nuova
> *«IL GESTIONALE DI TEST DIVENTA IL VERO»*), **`docs/lavori/README.md`**, e questo file.
>
> ### 🚨 PRIMA DI CREDERE A QUALUNQUE CONFRONTO
> Il checkout locale nasce **stantio e shallow**: `git status` dice «allineato» mentendo
> (misurato due volte, l'08/09 era 352 commit indietro la mattina e 5 il pomeriggio). ⇒
> `git fetch --unshallow origin && git fetch origin main test-preview && git reset --hard origin/test-preview`
>
> ---
>
> ## 🔴 IL PASSO DOVE MI SONO FERMATO — è la prima cosa da fare
>
> Il committente ha detto: **«togli i secret MATCHPOINT_* dal gestionale nuovo»**. È la prova del
> distacco: *prenotare senza avere la chiave per chiamare il worker*.
>
> ⚠️ **Non l'ho eseguito**, e non per prudenza generica: **i secret di Supabase NON si rileggono**
> (`secrets list` dà nomi e digest, mai i valori), e **non esiste nessun tool MCP** per gestirli.
> Toglierli senza saperli rimettere sarebbe una porta a senso unico.
>
> ⭐ **Ho costruito l'attrezzo e ho misurato la strada del ritorno.** Lui ha scelto, fra tre opzioni:
> **«prima la strada del ritorno»** — cioè verificare il recupero, togliere, provare, rimettere.
>
> 🔨 **L'attrezzo**: `.github/workflows/secret-matchpoint-sistema-nuovo.yml`, `workflow_dispatch`
> con tre modi — **`verifica`** (sola lettura), **`togli`** (parola `TOGLI`), **`rimetti`**
> (parola `RIMETTI`).
>
> | secret | da dove torna |
> |---|---|
> | `MATCHPOINT_BROWSER_WORKER_URL` | **indirizzo documentato**, non un segreto: `https://worker.91.99.131.243.nip.io` |
> | `MATCHPOINT_BROWSER_WORKER_API_KEY` | pm2 sulla VM, dove il worker la chiama **`MATCHPOINT_WORKER_API_KEY`** — nome diverso, stesso valore (`server.mjs:159`) |
> | `MATCHPOINT_USERNAME` · `MATCHPOINT_PASSWORD` | pm2 sulla VM |
>
> ⇒ **I PROSSIMI PASSI, in ordine**: ① lanciare il modo **`verifica`** (sola lettura, non tocca
> niente) e leggere le quattro righe ✅/❌; ② se sono quattro ✅, **`togli`**; ③ provare che una
> prenotazione sul sistema nuovo nasce lo stesso — deve rispondere **503 «ambiente di prova»**, non
> `500 WORKER_NOT_CONFIGURED`; ④ **`rimetti`**, e rileggere.
>
> 🚨🚨 **E IL FATTO CHE VA DETTO A LUI PRIMA DI `togli`, perché non gliel'ho ancora detto:**
> togliere quei secret **rompe le LETTURE dal vivo** sul sistema nuovo. 📏 Misurato: **9 edge su 20**
> usano i secret **senza passare dal recinto** — fra queste `matchpoint-bookings-edit` con
> `read: true` (il **roster e gli importi** della scheda partita) e `matchpoint-wallet-read` (il
> **saldo del borsellino**). ⇒ Per la durata della finestra la scheda si apre **senza giocatori e
> senza importi**. È esattamente la dipendenza che la **voce 180** deve togliere, e la finestra la
> renderà visibile invece che teorica.
> 📌 *Il gesto è reversibile; la finestra in cui il sistema è cieco no. Va dichiarata prima.*
>
> ---
>
> ## ✅ FATTO IN QUESTA SESSIONE (tutto provato, e dove no è scritto)
>
> **① Le regole non contraddicono più il lavoro** — `CLAUDE.md`, PR #1479.
> La sezione FERMA sui pagamenti diceva *«dal gestionale non parte nessun pagamento, per sempre»*.
> Le sue parole nuove: *«si incassa solo su test, su PROD mai»* + *«dal gestionale si incassa,
> perché Matchpoint non c'è più»*. ⇒ **Il divieto non era sul DENARO, era sul TRAMITE**: finché «il
> gestionale» era uno solo la differenza non si vedeva. L'invariante che resta — *nessun soldo passa
> da Matchpoint per mano nostra* — regge intero.
> ⭐ Nuova sezione FERMA in testa: **«IL GESTIONALE DI TEST DIVENTA IL VERO»**, con la **trappola
> centrale** (l'app si riconosce «di prova» dall'hostname ⇒ in produzione porta dentro WhatsApp
> dirottati su un telefono, incassi finti, prenotazioni finte — e **fallisce in silenzio**).
>
> **② Corretta una riga che nessuno aveva ricontrollato**: `anagrafica-mirror` è **spento** insieme
> alle altre cinque routine ⇒ *«è solo il calendario a essere fermo»* **non è più vero di niente**.
> Su `cudi` oggi è fermo **tutto**. 📏 `cron.job` = 5 job, nessuno parla con Matchpoint. Calendario
> fermo al **07/09 17:32**, 2826 soci.
>
> **③ Voce 177 — i due lettori del bot** (in servizio su `cudi`, **NON provata viva**).
> La 176 aveva spostato l'app su `pmo_fasce_prenotabili` lasciando indietro `consumer-booking-write`
> (`availability_day`) e `consumer-player-readmodel` (`kb.slot_schedule`) ⇒ il bot avrebbe
> **raccontato i vecchi orari mentre prenotava sui nuovi**. Modulo puro `fasce-prenotabili.ts`,
> copiato byte-identico nelle due cartelle. Banco **24 verdi, 4 sabotaggi visti cadere**.
> ⏳ **Manca**: una riga `fonte=pmo_fasce_prenotabili` nel registro, cioè un gesto vero del bot di
> prova. Le due edge **non risultano chiamate da nessuno** nelle ultime 24 h, e chiamarle richiede
> `CONSUMER_BRIDGE_SECRET`, che non sta nell'ambiente.
>
> **④ Voce 178 — il passo zero del distacco** (in servizio su `cudi`).
> In **11 edge su 11** l'ordine era config → recinto ⇒ togliendo i secret si prendeva `500` e **al
> recinto non ci si arrivava mai**. Ora è **validazioni → RECINTO → configurazione → worker**.
> 🚨 **Il passaggio precedente diceva «9 su 11» ed era sbagliato in modo che costava**: le tre edge
> delle prenotazioni hanno **DUE** recinti e la config sta **in mezzo** — quello precoce (ramo
> asincrono) è a posto, quello **sincrono** no. Chi curasse «le 9» lascerebbe rotta la strada di
> **prenotare, annullare e modificare**.
> 🔪 Guardia nuova, caso **`9bis`**: risalendo **DAL RECINTO** non si deve incontrare un rifiuto per
> configurazione. ⚠️ Il verso conta: *non* «risalendo dal worker», che dopo l'inversione sarebbe
> **falso**.
>
> ---
>
> ## 📊 STATO, misurato a fine sessione
>
> | | |
> |---|---|
> | **PROD** | `v6.397`, **intoccato**. Niente di oggi ci è andato, ed è voluto |
> | **TEST** (il sistema nuovo) | `v6.401` · le edge 177+178 in servizio su `cudi` |
> | guardie | `guard-worker-sync` · `guard-docs-truth` **verdi su tutti e due i rami** |
> | lista lavori | 🔴 **4 urgenti** (177 · 178 · 179 · 180) · 📋 **4 in coda** (181 · 182 · 183 · 184) · 📦 **170 chiuse** |
>
> ⚠️ **Il codice di 177 e 178 sta SOLO su `test-preview`** e si deploya solo su `cudi`:
> `supabase/functions/**` **non** è fra i file che `guard-worker-sync` tiene identici, e su PROD non
> porterebbe niente. È *«il gestionale di prod deve continuare a funzionare come ha funzionato fino
> adesso»* applicato alla lettera.
>
> ---
>
> ## ⏭️ LE VOCI APERTE, con dentro cosa manca a ciascuna
>
> · **177** — provare viva la lettura delle fasce dal bot *(serve un gesto dal bot di prova)*;
> · **178** — la prova del distacco: togliere i secret *(è il passo qui sopra)*;
> · **179** — ⏳ **il verdetto `verifica` si congela per sempre**: `consumer-booking-write:954` legge
>   la freschezza da `matchpoint_bookings_auto_import_last`; a sync spento quel timbro non si muove
>   più ⇒ ogni verifica risponde **`non_ancora` per sempre**, e **sembra pazienza**. Va sciolto con
>   una `fonteNativa`. ⛔ **Il bot non si tocca**: `git diff` vuoto nel suo repo è il criterio;
> · **180** — 💶 **la scheda legge i soldi da Matchpoint dal vivo, FUORI dal recinto**
>   (`matchpoint-bookings-edit:670`, `read:true` salta la barriera). 📏 Delle **256** `staff_booking`
>   vive solo **14** portano gli importi — le stesse che qualcuno ha aperto. **242 hanno solo i
>   nomi.** ⇒ La cassa **non ha su cosa addebitare**: la lettura nativa viene **prima** della cassa,
>   ed è il pezzo più grosso;
> · **181** cassa nativa · **182** travaso una-tantum · **183** griglia non fatta rispettare (e i
>   **prezzi sono `null` su tutte e 41** le fasce: aspettano i suoi numeri) · **184** l'ambiente
>   riconosciuto dall'hostname — 🚨 **la più pericolosa**, in coda solo perché va fatta al momento
>   del passaggio.
>
> ---
>
> ## 📅 UN APPUNTAMENTO SUO, non una richiesta aperta
>
> 🗣️ *«Quando abbiamo finito il distacco … avrei bisogno di confrontarmi con te riguardo a dei test
> end to end fatti però solo con le cinque persone di segreteria. Ne parliamo quando è finito.»*
> ⇒ **Niente da fare adesso**, l'ha detto lui. È scritto in `docs/lavori/README.md` marcato come
> appuntamento, apposta per non farlo sembrare qualcosa che io sto aspettando da lui.
>
> ---
>
> ## 🥇 LE COSE DA PORTARSI DIETRO (tutte pagate oggi)
>
> **① Una sonda che prende la PRIMA occorrenza non ha ancora guardato le altre.** La mia prima
> misura della 178 dava **tre edge per sane** perché guardava solo il primo recinto — e quelle tre
> ne hanno due. Me ne sono accorto solo perché il numero non tornava con quello che avevo **letto
> con i miei occhi** mezz'ora prima. *Sbaglia dichiarando sano proprio il file che ne ha due.*
>
> **② Lo stesso difetto, di nuovo, sul codice in servizio**: contando le occorrenze del recinto nel
> bundle deployato, la terza era la **definizione della funzione**, non una chiamata. Contarla dava
> un falso rosso.
>
> **③ Un sabotaggio che resta verde è un caso che non tocca la riga che dice di difendere.** Nel
> banco della 177 la sonda usava `fasceComeGriglia([])`, che esce da una riga **precedente** a
> quella sabotata. *Due strade diverse verso lo stesso `null` non sono lo stesso caso.*
>
> **④ Il verso di una guardia conta più della guardia.** Il caso simmetrico suggerito dal passaggio
> precedente («risalendo dal worker non c'è una config») era **sbagliato**: dopo l'inversione la
> config sta legittimamente *fra* recinto e worker.
>
> **⑤ Il posto giusto dove interpretare un dato è quello dove non serve annidare una terza
> sintassi.** Python dentro `ssh` dentro un blocco YAML = file non valido.
>
> ---
>
> ## ⛔ COSA NON DARE PER FATTO
> · **PROD non si tocca** — non «con prudenza»: non si tocca;
> · la lista delle **simulazioni legate a `PMO_IS_TEST_ENV` NON è chiusa**: le tre note in
>   `CLAUDE.md` più almeno una quarta (`index.html:15936`, email dell'autovalutazione dirottate).
>   Prima del passaggio va cercata tutta con `grep -n 'PMO_IS_TEST_ENV\|isTestEnv()'`;
> · **`scritturaAlCircoloConsentita` è cablata sul ref di PROD** (11 copie byte-identiche): è
>   l'unica cosa che impedisce al sistema nuovo di scrivere sul Matchpoint del circolo. **Va tenuta
>   per sempre**, e chi la trovasse «da generalizzare» stia fermo;
> · **nessuna regola di prenotazione esiste** oltre a: 30 giorni di anticipo, durata 30-180,
>   07:00-23:30, 4 giocatori. Nessun limite alle partite aperte, nessun preavviso di disdetta,
>   nessuna tabella dei campi, nessun listino, nessun modello di chiusure. Lui **crede** siano
>   definite.

---

## 🔧 DETTAGLI OPERATIVI (fuori dal prompt)

### Ambiente
- **Non esiste nessun tool MCP per i secret Supabase**: si passa dai workflow
  (`npx supabase@latest secrets list|set|unset --project-ref …`, con `SUPABASE_ACCESS_TOKEN`).
- **La VM si raggiunge da Actions via SSH** (`secrets.SSH_DEPLOY_KEY`, host `91.99.131.243`) — non
  dalla shell della sessione cloud, dove esce solo la 443.
- Banco: `find supabase consumer-app tools test \( -name '*.test.mjs' -o -name '*.test.ts' \)`, poi
  `node` su ciascuno (7 sono Deno e vanno saltati). Oggi: **125 verdi, 0 rosse**.
- Sintassi delle edge: `node --experimental-strip-types --check <file>`.
- I conteggi di `guard-docs-truth` si replicano in locale **prima** di spingere: gli `awk` stanno in
  `.github/workflows/guard-docs-truth.yml` righe 215-300. Sono **otto** numeri, e vanno tutti.
- ⚠️ **La finestra del 4bis**: spingendo `docs/`/workflow su `test-preview` prima del merge su
  `main`, `guard-worker-sync` cade **rossa transitoria** su `test-preview` e **non rigira da sé** ⇒
  si rilancia a mano dopo il merge. È successo quattro volte oggi, è normale.

### Le misure di oggi (da non rifare)
| cosa | valore |
|---|---|
| edge con il recinto | **11**, tutte con l'ordine corretto dall'08/09 |
| edge che usano i secret **senza** recinto | **9** (le sync, `wallet-read`, `queue-status`, `maestri-allineamento-check`) |
| `staff_booking` con gli importi | **14 su 256** |
| fasce prenotabili | **41**, prezzo `null` su **tutte** |
| soci su `cudi` | **2826** · calendario fermo al **07/09 17:32** |
| `cron.job` su `cudi` | **5**, nessuno parla con Matchpoint |
| banco | **125 verdi**, `scrittura-al-circolo.test.ts` da 45 a **56** casi |

### Commit di oggi su `test-preview`
`b4e64f41` le regole · `2750b8b2` voce 177 · `5c62246f` scheda 177 + appuntamento ·
`23bd1d7f` la misura corretta della 178 · `47c39133` la cura della 178 · `3b389fb7` scheda 178 ·
`2861de52` l'attrezzo per i secret.
PR su `main`: **#1479 #1480 #1481 #1482** mergiate · **#1483** (il workflow dei secret) da
controllare.
