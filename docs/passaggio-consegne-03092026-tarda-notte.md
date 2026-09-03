# Passaggio di consegne — 03/09/2026, tarda notte (fine 77ª sessione)

**Come si usa:** incollalo come primo messaggio della chat nuova. È scritto per essere capito
**senza** la conversazione precedente.

---

## 🔴 LA PRIMA COSA DA FARE

> **La barra del semaforo (137 ④b) è in PROD e NON SI VEDE.** Lui ha fatto il gesto giusto —
> salvato una Nota su Campo 3 · 05/09 · 15:00, alle 23:10 — la scrittura è partita
> (*«⏳ Sto elaborando la richiesta su Matchpoint · modifica…»*) e **sul bordo basso del
> calendario non è comparso niente**.
> 🔎 **Tutto ciò che si poteva controllare dal cloud è a posto** (elenco sotto, §3): worker
> deployato, edge ACTIVE e aggiornata, markup e CSS giusti in PROD. ⇒ **Il difetto è in un punto
> che da qui non si vede**, e la strada è la stessa che ha funzionato stasera per la 138:
> **mettere una sonda che lo faccia dire alla pagina**, invece di continuare a dedurre.

| | inizio sessione | adesso |
|---|---|---|
| versioni app | PROD 6.285 · TEST 6.302 | **PROD 6.286 · TEST 6.306** |
| PR fuse | — | **#1314 → #1317** (quattro) |
| banco | 92 verdi | **92 verdi / 0 rossi** (90 sul ramo di PROD) |
| urgenti · in coda · chiuse | 5 · 15 · 116 | **invariati** |

⚖️ **Il filo della serata:**
> *Tre misure fatte dal cloud tornavano tutte verdi e il difetto restava. A trovarlo è stata una
> **sonda messa nella pagina** e **il suo dito**. E la ragione per cui le misure sbagliavano è la
> più insidiosa che ci sia: **misuravo l'ambiente che il difetto non ha.***

---

## 0. 📦 Stato alla consegna

| | |
|---|---|
| PR | **#1314, #1315, #1316, #1317** tutte fuse |
| rami | `main` ↔ `test-preview` **allineati** sui 4 percorsi sorvegliati (verificato) |
| guardie | `guard-worker-sync` e `guard-docs-truth` **verdi su `main`** |
| deployati | app **PROD 6.286** (live, `last-modified` 22:57) · **TEST 6.306** · worker e edge **non toccati oggi da me** |
| migrazioni · bot | **non toccati** |

### ⛔ LE COSE DA FARE PER PRIME
1. **La barra del semaforo che non si vede** — §1. È l'unica cosa rotta.
2. **La prova della 138 che non è mai stata fatta**: digitare un importo, cliccare un nome,
   chiudere la scheda socio, e vedere se l'importo si ritrova. Ora su PROD.
3. **La cella accesa** del semaforo: **non l'ha mai vista nessuno**, e la può vedere solo lui.

---

## 1. 🚦 LA BARRA CHE NON SI ACCENDE — dove sono arrivato

### Cosa è successo, con gli orari
- **23:05** — apre una scheda partita su PROD, la barra non c'è (giusto: a riposo non deve esserci).
- **23:10** — salva una **Nota** (`ciao ciao`) su **Campo 3 · 05/09/2026 · 15:00**. L'app dichiara
  *«⏳ Sto elaborando la richiesta su Matchpoint · modifica: Campo 3 · 05/09/2026 · 15:00 ·
  📝 Nota: ciao ciao»*, e sotto *«Aggiorno la lista giocatori… (20s)»*.
- **Sul bordo basso della griglia: niente.** Il calendario era sulla data giusta (05/09) e lo slot
  era in vista, quindi anche la **cella** avrebbe dovuto accendersi.

### ✅ Cosa ho verificato, e sta a posto — non rifarlo
| controllo | esito |
|---|---|
| il **worker** su Hetzner ha il codice del semaforo | ✅ `deploy-worker-hetzner` **success** tre volte oggi, ultimo alle 16:28 (pezzo ④a) |
| il job porta il campo `gesto` fino alla coda | ✅ `mpQueueRun` lo costruisce esplicitamente (`server.mjs:329`) — era il difetto «oggetto ricostruito a mano», già curato |
| la **edge** `matchpoint-queue-status` su `qqbf…` | ✅ **ACTIVE, v28**, aggiornata oggi alle ~16:44 UTC |
| l'app di PROD ha il polling **acceso** | ✅ `svcStartQueuePolling()` chiamata a modulo, non più commentata |
| il gate del polling | ✅ `#dashboard` ha `class="tab-content active"` nel markup |
| il **markup** della barra | ✅ è ultimo figlio di `.svc-grid-col` (`index.html:6867`) |
| il **CSS** | ✅ `.svc-grid-col` è `position:relative`, `.svc-semaforo` è `position:absolute; bottom:0; z-index:30` |

### ❓ Cosa NON ho potuto verificare — è qui che sta il difetto
1. **La risposta vera della edge in quel momento.** `svcPollQueueStatus` ha un
   `catch (_e) { /* silenzioso */ }` che **ingoia tutto**: rete, 401, config, sessione. Se la
   chiamata fallisse, da fuori sarebbe **identico** a «non sta succedendo niente».
   ⚠️ È lo stesso difetto già scritto fra le lezioni della 76ª — *«un catch che ingoia tutto
   acceca chi prova»* — e stavolta acceca **noi**.
2. **Se `running.gesto` fosse `true` in quell'istante.** La barra si accende **solo** su
   `running.gesto === true` (dichiarazione positiva). Un `edit` con sola Nota **dovrebbe** essere
   un gesto, ma non è stato osservato.
3. **`dove`**: la cella si accende solo con coordinate **complete** (`campo`+`data`+`ora`). Se la
   Nota passasse per `idReserva`, `dove` sarebbe `null` — **la cella non si accenderebbe, la barra
   sì**. ⇒ Il fatto che manchino **tutt'e due** dice che il problema è a monte del `dove`.

### 🔨 LA STRADA, ed è già stata pagata una volta stasera
⛔ **Non dedurre oltre.** Le tre misure dal cloud tornano tutte verdi e il difetto resta: è
esattamente lo schema della 138, dove il difetto viveva in un posto che le sonde non guardavano.

✅ **Mettere una sonda nella pagina**, gated su TEST, che scriva **cosa risponde davvero la edge**:
lo snapshot grezzo (`ok`, `semaforo.acceso`, `running`, `dichiarazioneMancante`) e **l'errore che
oggi il `catch` ingoia**. Poi un gesto vero e si legge.
📌 *Sonda temporanea, tolta appena la domanda ha risposta — come quella della 138, che è vissuta
due commit ed è servita a tutto.*

⚠️ **Con una differenza rispetto alla 138**: là bastava TEST perché il difetto era nel browser. Qui
il gesto deve arrivare al worker, e **su TEST le scritture verso Matchpoint sono simulate** —
🚨 ma la simulazione **intercetta `matchpoint-bookings-edit`**, quindi su TEST un salvataggio non
mette **niente** nella coda del worker e la barra non si accenderebbe **per costruzione**.
⇒ **La sonda va su TEST per essere scritta senza rischio, ma la prova è su PROD.** Vale la pena
pensarci prima di spendere un giro.

---

## 2. 🔨 COSA HA FATTO LA 77ª

| | esito |
|---|---|
| **138** 🔗 il nome apre la scheda socio | ✅ **curata e confermata da lui dal vivo** su TEST, poi promossa. ⏳ resta aperta per la prova degli importi |
| **le due cure dell'anagrafica** | ✅ **in PROD** — id interno e codice cliente si imparano dal cloud |
| **137 ④b** 🚦 la barra | 🔴 **in PROD ma NON si vede** — §1 |
| **140** 🔢 l'id interno | ✅ **riscritta sul denominatore vero**, con la strada e il costo misurati |
| `guard-docs-truth` | ✅ **rimessa verde**: era rossa da quattro merge |

### 🚨⭐⭐ IL DIFETTO DELLA 138, e perché tre misure non l'hanno visto

Il nome non prendeva il tratteggio. Il roster portava l'id **giusto**, il cloud aveva l'id
**giusto**, la funzione di aggancio esercitata dal vivo **trovava il socio**. Tutto funzionava e
insieme non funzionava.

⇒ **La causa**: `PMO_MEMBER_CLOUD_FIELDS` — l'elenco dei campi che l'idratazione rinfresca dal
cloud — **non conteneva `matchpointIdInterno`**. Un socio già in `localStorage` quel numero **non
lo imparava mai**: ce l'aveva solo chi era entrato nell'elenco *dopo*.

🚨 **E il modo in cui si nascondeva è la lezione della serata**: **dalla console remota
funzionava**. Quella parte con `localStorage` **vuoto**, quindi ogni riga le arriva dritta dal
cloud. ⇒ *Misuravo l'ambiente che il difetto non ha, e la misura tornava verde tre volte.*
📌 **Una sonda che parte pulita non può vedere un guasto che vive nello stato accumulato** — e il
README di `tools/verifica-browser` lo dichiara, in fondo, fra i limiti. Nessuno l'aveva letto.

⚖️ Ed era **identico** al difetto di `cloudLocalKey` curato il **28/08**, dieci righe sopra nella
stessa funzione, col commento ancora lì: *«una cura che produce un valore che nessuno riceve è
verde in ogni banco che guardi il produttore invece del destinatario»*. **Cinque giorni, stessa
forma, stesso file.**

### 🔢 E il codice cliente aveva lo stesso difetto, con conseguenze PEGGIORI
`memberId` non era in quell'elenco **per la stessa ragione**. Ma lì non si spegne un nome
cliccabile: **si spegne la guardia anti-omonimia delle scritture**.
📏 Misurato nel worker: `searchAndAddPlayer` usa `expectedClientCode` come **termine di ricerca** e
per **scartare i candidati col codice diverso prima di cliccare**. Senza, si cerca **per nome** e il
controllo non scatta.
📏 E su PROD gli omonimi esatti sono **13 gruppi, 27 soci**.
⛔ **La riga che tiene la cura dal diventare la 138 al contrario**: un codice vero locale **non**
viene sostituito da un codice vero **diverso** del cloud — sarebbero due persone.

---

## 3. 🔢 LA VOCE 140 — riscritta, e il denominatore era sbagliato

📏 **Rimisurato su PROD** (righe `member` non archiviate):

| | |
|---|---|
| hanno il **codice cliente** (⇒ **sono** clienti Matchpoint) | **1119** |
| ↳ hanno **anche l'id interno** | **118** |
| ↳ **hanno il codice e NON l'id** ← il bersaglio | **1001** |
| hanno l'id **senza** il codice | **0** |
| non hanno il codice | 1704 — di cui **1703 dalla rubrica Google** |

⇒ I 1704 **su Matchpoint non esistono**: un id non possono averlo. Il denominatore vero è **1119**,
non 3764 (lo conferma il sync notturno: legge **1108 righe**). **Siamo all'11%, non al 3%.**

⭐ **Quello ZERO decide la strada**: il legame **codice cliente → id interno** copre l'universo
intero, senza telefono e senza nome. Ed è l'aggancio che l'app **già usa**
(`pmoChiaveCodiceCliente`) quando scrive l'id aggiungendo un giocatore.

🔨 **La strada e il costo**: `Listadoclientes.aspx` è **la stessa pagina che il sync clienti visita
già due volte per notte**. Il codice è una sua colonna, l'id sta nel **link di ogni riga**, e il
worker quelle righe **le legge già così** nell'anti-doppione. Non è un giro nuovo: è leggere le
righe di una pagina che apriamo comunque. Lettura nel **worker** ⇒ si lavora **da `main`**, e ogni
deploy costa **un tick del sync**; a regime **zero**.

⏳ **Due cose NON misurate**, e si vedono solo aprendo quella pagina viva: ① **quale colonna** porta
il codice nell'HTML; ② **se `pagesize` si può alzare** oltre le 15 righe. Cambiano il **costo**, non
la fattibilità. **Una lettura sola risponde a entrambe.**

---

## 4. 🩹 I DUE ERRORI CHE HO FATTO IO, e che hanno toccato le sue decisioni

1. 🚨 **«TEST è avanti di 21 versioni, una decina di voci mai promosse».** **Falso.** Le voci
   127–136 e 139 erano **già in produzione**. Il divario di versioni è **contabilità** — TEST bumpa
   a ogni passo, PROD una volta per promozione. A mancare erano **quattro** cose.
   ⚖️ Lui ha scelto «promuovi tutte» **su quel numero**. Le due strade coincidevano, ma la
   decisione è stata presa su una realtà che non c'era.
   📌 *Un numero letto dal contatore sbagliato non è impreciso: è una domanda diversa.*
2. 🩹 **«Prova altri nomi, saranno soci senza id».** Falso: **tre dei quattro** in quella partita
   l'id ce l'avevano. Era una scusa comoda che ha ritardato la diagnosi di venti minuti.

---

## 5. 🧠 ALTRI DIFETTI PRESI — la parte da non ripetere

- 🩹⭐ **Un sabotaggio che lascia verde non dice che la cura è solida: dice che la prova non guarda
  dove sta il rischio.** Un mio caso nuovo (il 19) passava **per la ragione sbagliata** — sorvegliava
  una cosa che non poteva rompersi. Trovato **sabotandolo**, riscritto perché guardi il punto vero.
- 🩹 **Un verde può misurare l'assenza delle prove.** Promuovendo su `main` il banco dava
  **88 verdi** invece di 92: **due banchi non esistevano su quel ramo**. Senza portarli, il verde
  avrebbe detto «funziona» e avrebbe voluto dire «non ho controllato».
- 🩹 **`guard-docs-truth` era rossa da quattro merge e nessuno guardava** — la malattia che le sue
  stesse note dichiarano di temere. Uno dei quattro errori **non era un numero**: una sotto-sezione
  scritta `###` dentro la voce 137 veniva contata **come una voce**. Chi avesse alzato la cifra a 6
  avrebbe fatto tornare la guardia verde **scrivendo il falso**.
- 🩹 **`--allow-writes` sulla console remota è BLOCCATO dal classificatore dell'ambiente**, anche
  con l'autorizzazione esplicita del committente. Non si aggira: si cambia strada.

---

## 6. 🔎 FATTI MISURATI CHE VALE LA PENA NON RISCOPRIRE

- **La promozione a PROD non si può fare copiando `index.html`**: **496 righe esistono in PROD e non
  su TEST** (le promozioni portano le righe del fix, non i file). Una copia le cancellerebbe.
- **I sei commit della promozione danno tutti conflitto con `git apply` semplice**; con `--3way`
  passano e l'**unico conflitto è `APP_VERSION`**. È la via buona.
- **L'export clienti di Matchpoint ha 16 colonne e NESSUN id** — nemmeno il codice cliente (per
  quello esiste un **secondo** export, il report «Codice», 1107 righe).
- **`matchpointIdInterno` si scrive in TRE punti soli**, tutti gesti dell'app: aggiunta di un
  giocatore a una partita, creazione di un socio su Matchpoint, adozione dopo un conflitto di
  telefono. L'import notturno **non lo porta**.
- **Il semaforo NON si accende sul sync automatico**, per sua decisione (*«questo io non vorrei
  vederlo»*). A riposo la barra **non c'è, ed è giusto**.
- **La simulazione di TEST NON intercetta `read:true`** su `matchpoint-bookings-edit` (lettura
  autorizzata da lui, v6.131) — ma **intercetta tutte le scritture**.
- **PROD ha `max-age=600`**: dopo un merge si guarda `last-modified`, non solo il numero di versione.
- **TEST va live in ~30-50 s** dal push (`app-meta.json` → `source_sha`).

---

## 7. ✅ Prima di lavorare

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
🩹 **Sintassi di `index.html`**: `node test/controlla-sintassi.mjs`.
🩹 **Controlla l'ORA prima di scrivere una data**: `TZ=Europe/Rome date '+%Y-%m-%d %H:%M'`.

---

## 8. 🤝 Come si procede (invariato)

> *«Procediamo sempre come tu pensi sia corretto»* — copre anche le promozioni; il freno è la
> **dichiarazione**. Fuori: **inventare voci non in lista**, e l'irreversibile/visibile (si dice
> **prima**, anche procedendo).
> ✋ **Un task non è finito finché non è provato fisicamente.**
> 📌 E: **«scrivi troppo» — risposte corte.**

⭐ **La regola che stasera ha pagato di più:** *quando tre misure tornano verdi e il difetto resta,
una delle premesse è falsa — e la prima da sospettare è **dove stai misurando**.*
