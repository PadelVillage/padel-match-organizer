# Passaggio di consegne — 29/08/2026, pomeriggio (fine 57ª sessione)

**Come si usa:** incollalo come primo messaggio della chat nuova. È scritto per essere capito
**senza** la conversazione precedente.

⚠️ Sessione tutta sulla **voce 105**, chiusa nel meccanismo su tutt'e due i fronti (app e database),
più una guardia che era rossa da ieri sera e nessuno lo diceva. Quattro PR (#1178-#1181).

---

## 🟢 LEGGI PRIMA QUESTO — OGGI NON C'È NIENTE DI ROTTO

> Il passaggio precedente si apriva con due cose rotte. **Adesso zero**: tutte le guardie sono
> verdi su tutti e due i rami, PROD ha la cura che funziona, i doppioni sono **0**.
>
> ⏳ **Ciò che manca NON è codice: sono PROVE FISICHE che vogliono le tue mani.** Sette urgenti su
> otto sono curate e in servizio, e aspettano un gesto tuo. La sezione 4 dice quale, voce per voce.

📕 `docs/test-livello-regole.md` resta la **fonte definitiva** sul test di livello.
📋 `docs/lavori/README.md` si apre **PRIMA di lavorare** — obbligo di casa.

---

## 1. ✅ Prima di lavorare

```
git fetch origin main test-preview
git diff origin/main origin/test-preview -- CLAUDE.md docs/ .github/workflows/ \
  tools/matchpoint-browser-worker/src/server.mjs
```
✅ **Dev'essere vuoto, e alla chiusura lo era.**

🆕 Servono anche `PadelVillage/assistente-padel-agent` e `PadelVillage/padel-match-organizer-test`
(→ `add_repo`, **una sola** clonazione con timeout generoso, `register_repo_root`).

### 🟢 Stato misurato a fine sessione (non ricordato)

| dove | stato |
|---|---|
| **gestionale** | `main` **6.255** · `test-preview` **6.259** · PROD serve **6.255** · TEST serve **6.259** |
| **RPC di scrittura** | `pmo_upsert_records_admin` **curata su TEST e su PROD** (contiene `riga_viva`) |
| **anagrafica PROD** | **2817** soci vivi · doppioni **0** |
| banco gestionale | **35 file, zero rossi** |
| guardie | `guard-docs-truth` e `guard-worker-sync` **verdi su tutti e due i rami** |
| lista | 🔴 urgenti **8** · 📋 in coda **10** · 📦 chiuse **83** |

⚠️ Il bot dei soci **non è stato toccato** oggi: l'ultimo stato noto è quello del passaggio del
28/08 notte (deploy #121, `online`, PROD, scritture reali). Se serve saperlo **si rimisura** con
`stato-bot.yml` invece di ricopiare quella riga.

---

## 2. 🔨 COSA È STATO FATTO

### ✅ Voce 105 — chiusa nel meccanismo, su TUTT'E DUE i fronti

**Il difetto**: il gestionale **calcolava** la chiave di scrittura del socio dal telefono, così una
modifica dalla segreteria poteva scrivere su una riga che non era la sua — creandone una nuova o
**resuscitandone una archiviata**.

**① La cura dell'app, promossa a PROD (v6.255, #1178).** Ieri sera la v6.254 conteneva la stessa
cura ma **inerte**. Oggi la prova che mancava.

🚨⭐⭐ **E LA PROVA È IL PEZZO CHE VALE PIÙ DELLA CURA.** Il passaggio precedente diceva *«la console
remota NON basta: parte da un browser pulito, e il difetto nasce dallo stato accumulato in quello
dell'operatore — serve un gesto suo»*. **Vero a metà, e la metà falsa costava una giornata di
attesa**: lo stato dell'operatore non si eredita, **si costruisce**. Tolto `cloudLocalKey` ai soci
in memoria — che è com'è un socio letto da un `localStorage` scritto prima della cura — misurato
dove scriverebbero, fatta girare l'idratazione **vera**, rimisurato.

| | TEST 6.259 | PROD 6.254 (controllo) | PROD 6.255 (dopo) |
|---|---|---|---|
| esposti | 28 | 24 | 24 |
| PRIMA scriverebbero altrove | **28** | **24** | 24 |
| DOPO scrivono sulla riga viva | **28** | **0** ❌ | **24** ✅ |
| già `phone:` spostati | 0 | 1 | **0** |

⚖️ **Il controllo su PROD 6.254 è ciò che rende onesto il verde**: senza quel giro, il 28 su 28 di
TEST sarebbe stato un verde di cui non si conosce la ragione — l'errore esatto che ieri sera è
costato la 6.254.

**② La cura definitiva, nel database (#1181), in servizio su TEST e su PROD.**
`pmo_upsert_records_admin` **non si fida più della `local_key` che arriva**: per i soli `member`, se
esiste **UNA SOLA** riga viva con lo stesso `payload->>'id'`, scrive su quella.
⚖️ Le due cure **si sommano**: la ① insegna al browser a portare la chiave giusta, la ② **gli toglie
il potere di sbagliarla**. Copre il residuo che la ① dichiarava di non coprire (la chiave **stantia**,
quando il sync ri-chiava il socio dentro i 10 minuti di throttle).

📏 **La prova**, stessa scrittura sugli stessi dati, due transazioni che **si annullano da sé**:

| | righe vive | riga archiviata |
|---|---|---|
| **con la cura** | 1 → **1** | resta **archiviata** |
| **senza la cura** | 1 → **2** | **RESUSCITATA** (`deleted` t → f) |

Fatta su TEST sullo scenario esatto di Maurizio (`matchpoint_1jnj82q` ha davvero la riga `email:`
viva e la `phone:` archiviata) e **ripetuta su PROD** con payload **identico**, così nemmeno
un'ipotesi assurda avrebbe cambiato un dato.

🧪 **Quattro sabotaggi, quattro esiti diversi.** Il più istruttivo: **includendo le righe archiviate
la cura diventa INERTE** — lo stesso modo in cui era morta la prima stesura.

⚡ **Costo misurato**: l'indice nuovo (`idx_pmo_cloud_records_member_id`) viene **usato**, ~6 ms su
un lotto di 200 soci.

### ✅ Una guardia rossa da ieri sera che nessuno diceva (#1179)

`guard-docs-truth` era **rossa su tutti e due i rami, NOVE corse di fila**: la tabella «Versione
corrente» dichiarava PROD 6.253 / TEST 6.257 con **6.254 / 6.259** in servizio. Il passaggio di
consegne non la nominava.
📌 *Una guardia che nessuno legge è una protezione già persa, e non serve toglierla per perderla.*
⛔ **La fotografia della 26ª è stata lasciata com'è**, di proposito: è datata **per dichiarazione**
(*«rimisurato alla chiusura della 26ª»*), e riscriverla falsificherebbe un fatto storico. Lì la
guardia avvisa e basta.

### ✅ Misurato il punto D del passaggio precedente (#1180) — **NON curato**

Era annotato *«non misurato quanto sia raggiungibile»*. **È raggiungibile da solo.**
🔎 `lastLevelUpdateAt` lo scrivono **due punti soli** di `index.html` (30549 e 35534), tutt'e due nel
giro dell'autovalutazione. Il salvataggio della **scheda socio** — dove la segreteria cambia il
livello a mano — **non lo tocca**. ⇒ La protezione di `assessment-apply-level`, che nel suo commento
si presenta come *«IL CONTROLLO CHE IMPEDISCE IL DANNO: una scheda vecchia non deve mai scavalcare
un livello aggiornato dopo»*, è **cieca esattamente al tipo di aggiornamento che nomina**.
🚨 E non serve nessuno che sbagli: le schede in attesa le applica un **cron ogni 15 minuti**.
📏 Su PROD: **23** schede in attesa applicabili (la più vecchia del **30 aprile**), **20** con socio
vivo, **12** passerebbero oggi la guardia della data. ⛔ Non dice che si applicherebbero: gli altri
cancelli non sono misurati. Il 12 misura l'**ampiezza della cecità**, non i danni in arrivo.
⏳ **Perché NON è curata**: il livello lo scrive anche l'**import da Matchpoint** (`index.html:11830`),
e marcare la data a ogni scrittura **bloccherebbe ogni scheda per sempre**. La cura deve distinguere
la mano della segreteria dall'import di massa. È un **bivio di disegno**, non una riga.
📌 Sta fra le **«nate misurando»**, non promossa a voce: è una misura, non un lavoro inventato.

---

## 3. 🧠 LE TRAPPOLE DI OGGI

**① 🚨⭐⭐ UN LIMITE DICHIARATO ERA MEZZO VERO, ED È LA FORMA PEGGIORE.** *«La console non basta,
parte da un browser pulito»* — vero. *«Quindi serve un gesto suo»* — falso. **Uno stato che non si
eredita si costruisce.** La metà giusta rendeva credibile la metà sbagliata, e nessuno andava a
cercare l'altra. È la **26ª** (*un limite dichiarato che nessuno riprova resta vero per sempre
perché sembra prudente*), e oggi valeva una giornata di attesa.

**② ⚖️⭐⭐ UN VERDE SENZA CONTROLLO NON DICE NIENTE.** 28 su 28 su TEST non provava la cura: provava
che la sonda diceva 28. È diventato una prova solo quando la **stessa sonda** su PROD 6.254 ha detto
**0 su 24**. 📌 *Prima di credere a un verde, fallo diventare rosso dove il difetto c'è ancora.*

**③ 🩹 UNO ZERO RASSICURANTE, DUE VOLTE DI FILA.** Cercando i soci esposti al punto D, la giuntura
sul telefono dava **0 su 23**: il telefono del socio ha **12** cifre (col prefisso) e quello della
scheda **10**. Normalizzata alle ultime dieci: ancora **0** — perché le schede in attesa il telefono
**non ce l'hanno affatto**, il socio si trova dal **gettone**. 📌 *Uno zero che conferma quel che
speri va guardato una volta di più.*

**④ 🚨⭐⭐ UNA CURA VA ESAMINATA PER I GUASTI CHE INTRODUCE LEI.** Deviando le scritture sulla riga
viva, due record che prima finivano su chiavi diverse possono ora puntare allo **stesso** posto — la
riga viva `email:` e la gemella `phone:` nata per sbaglio. Senza dedup, `on conflict do update`
esplode e fallisce l'**intero lotto**: la cura avrebbe trasformato un doppione silenzioso in un
**salvataggio perduto**. Da qui il `distinct on`, e vale **solo** per i `member`.

**⑤ 📏 LA MISURA DIPENDE DALLA DOMANDA: 25 o 991.** Gli «esposti» erano **25** (quelli che il
browser *oggi* sbaglierebbe). Ma i soci con una riga **archiviata sotto un'altra chiave** — cioè
quelli su cui un indirizzo sbagliato **resuscita un doppione** invece di creare una riga in più —
sono **991**. Due numeri veri per due domande diverse, e il secondo è quello che dice quanto vale la
cura.

**⑥ ⚠️ CONTARE PER FORMA PERDE PEZZI.** Definendo «esposto» come *«chiave viva non-`phone:`»* ne
sfuggiva uno: riga viva `phone:` a **12** cifre, telefono in scheda a **10** ⇒ chiave calcolata
diversa. 📌 *Il criterio vero non è la forma della chiave: è «la calcolata coincide con la viva?».*

**⑦ ⚠️ `git checkout <ramo> -- <cartella>` PRENDE TUTTA LA CARTELLA.** Rispecchiando la migrazione
si sono portate dietro **6 migrazioni estranee** che stavano solo su `test-preview`. Visto nel
`--stat` prima di aprire la PR, ramo rifatto con i **due** file voluti.
🆕 **E resta un fatto misurato**: `supabase/migrations/` **diverge** fra i rami (6 file su
`test-preview` che `main` non ha, 2 viceversa). Non è sorvegliato da nessuna guardia. **Non l'ho
toccato** — non era il mio lavoro e non l'ho verificato — ma qualcuno dovrebbe guardarlo.

**⑧ 🔧 I `curl` verso `api.github.com` DALLA SHELL NON SONO AUTORIZZATI.** Rispondono *«GitHub access
is not enabled for this session»*: i cicli d'attesa scritti così **non finiscono mai** e scadono in
silenzio, sembrando una CI lenta. Per stato di PR e Actions si usano **solo** gli attrezzi
`mcp__github__*`.

---

## 4. ⏳ COSA RESTA — e quasi tutto vuole le TUE mani

**Le 8 urgenti**: 105, 101, 97, 92, 84, 83, 78, 65. La lista canonica è `docs/lavori/README.md`.

| # | cosa manca | chi |
|---|---|---|
| **105** | il **giro intero dall'app**: la segreteria che salva dalla scheda socio e la riga che atterra. Il meccanismo è provato da tutt'e due i lati, il database rifiuta di sbagliare indirizzo | **lui** |
| **101** | nessuno ha visto la lista del maestro **popolarsi con soci veri**: il `readonly` della console non ha `view_members` | **lui** / dal Mac |
| **97** | un giro del test **intero** dal telefono, dodici domande senza deploy in mezzo | **lui** |
| **92** | un gesto della segreteria che attraversa un **riavvio del bot**. ⚠️ E «non è arrivato il doppione» **non è la prova**: è il silenzio guardato troppo presto | si aspetta |
| **84** | la prova col **difetto vero davanti** | **lui** |
| **83** | un worker oltre i 150 s: **non si provoca, si guarda** — il prossimo `KO HTTP 504` deve uscire come `esito_ignoto`. E l'annullo **non è curato**, di proposito | si aspetta |
| **78** | un giocatore messo o tolto dal gestionale, e `/prenotazioni` aperto **entro 2-6 minuti** prima che il sync atterri: deve uscire **coi nomi e senza numero** | **lui**, al volo |
| **65** | curata e in servizio: si aspetta il caso | si aspetta |

⭐ **Le due più economiche** sono la **78** (un gesto e uno sguardo entro sei minuti) e la **101**
(aprire Anagrafica soci e guardare).

**Altro, non urgente:**
- **`ASPETTA_IL_MAESTRO`** — l'unico ramo di E1 mai provato. Ricetta pronta: Maurizio (a **4**) rifà
  il test dichiarando **Avanzato** → deve tornare **Avanzato**, i bottoni compaiono e `applied_at`
  resta vuoto; poi lo si porta a **3,5** — **non a 3**, o il cron scrive `applied_at` e il tocco
  finisce su `GIA_APPLICATA` — e si tocca «Tengo Avanzato».
- **E10 aperta a metà**: verso il socio è una **porta muta** (`TEST_LIVELLO_MUTO`). Riguarda 0 soci
  su 2817, e resta aperta lo stesso.
- **Il punto D** (sopra): misurato, bivio di disegno dichiarato, non curato.
- **`supabase/migrations/` diverge fra i rami** (trappola ⑦): da guardare, non toccato.

🩹 **Rattoppi a mano da non dimenticare**: i doppioni di **Maurizio** e **Fabiola** furono archiviati
con un `update … set deleted = true`. La sonda, che **deve tornare vuota**:
```sql
select payload->>'id', count(*) from pmo_cloud_records
where record_type='member' and deleted is not true group by 1 having count(*) > 1;
```
Alla chiusura di oggi: **vuota**.

---

## 5. 🧰 Attrezzi

| | |
|---|---|
| ordine push | prima `test-preview`, poi PR a `main` (≤15 file, mai dal ramo `test-preview`) |
| promozione app | ramo da `origin/main` + `git show <sha> -- index.html \| git apply --3way`, risolvere solo `APP_VERSION` (PROD prende il suo numero, TEST resta davanti) |
| rispecchio docs | `git checkout test-preview -- docs/` da un ramo basato su `main`, poi `git diff origin/test-preview HEAD -- docs/` **vuoto**. ⚠️ Con un **file** solo, nominalo: la cartella intera prende tutto |
| console remota | `node console.mjs --env test\|prod --file x.js` in `tools/verifica-browser` (credenziali già nell'ambiente cloud). ⭐ **Lo stato accumulato si COSTRUISCE dentro lo snippet** — vedi trappola ① |
| PR e Actions | **solo** `mcp__github__*`: da shell `api.github.com` non risponde |
| DB | MCP Supabase — PROD `qqbfphyslczzkxoncgex`, TEST `cudiqnrrlbyqryrtaprd` |
| provare una scrittura senza scrivere | blocco `do $$ … raise exception 'ESITO …' $$` — esegue l'istruzione **vera** sui dati **veri** e la transazione si annulla; l'esito torna nel messaggio d'errore. Payload **identico** all'originale, così nemmeno un'ipotesi assurda cambia un dato |
| edge in servizio | `get_edge_function` → salvare su file e `grep` (mai stampare) |
| commit | mai backtick in `-m`: heredoc con `-F -` |
| conteggi lista | l'intestazione **e** la fotografia: `guard-docs-truth` confronta tutt'e due |

---

## 6. 🤝 Come si procede (invariato)

> *«Procediamo sempre come tu pensi sia corretto»* — copre anche le promozioni; il freno è la
> **dichiarazione**. Fuori: inventare voci non in lista, e l'irreversibile/visibile (si dice
> prima, anche procedendo). ✋ **Un task non è finito finché non è provato fisicamente.**
> 📌 E: **«scrivi troppo» — risposte corte.**
