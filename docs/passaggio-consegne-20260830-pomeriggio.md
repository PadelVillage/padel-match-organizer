# Passaggio di consegne — 30/08/2026, pomeriggio (fine 62ª sessione)

**Come si usa:** incollalo come primo messaggio della chat nuova. È scritto per essere capito
**senza** la conversazione precedente.

---

## 🔴 LA PRIMA COSA DA SAPERE, e va detta senza addolcirla

> **Delle 9 urgenti NON ne è stata chiusa NESSUNA.** Sono ancora 9, le stesse di stamattina.

La 62ª ha prodotto **tre correzioni** e **cinque misure**, tutte fuse e in servizio. Ma il lavoro
che resta non è rimasto indietro per pigrizia: **è arrivato al punto in cui vuole le mani del
committente**, e da lì una sessione cloud non passa. La lista al § 3 è ordinata per quello.

⚖️ Perché la distinzione conta: chi apre la chat nuova e legge «sei PR fuse, banco verde» rischia di
credere che il grosso sia fatto. **Non lo è.** È fatto tutto ciò che si poteva fare **da soli**.

---

## 0. 📦 Stato alla consegna — niente in sospeso

| | |
|---|---|
| PR aperte | **nessuna** — le sette della 62ª (#1200 → #1206) sono tutte **fuse** |
| lavoro non committato | **nessuno** |
| rami | `main` e `test-preview` **allineati** (verificato sui quattro percorsi sorvegliati) |
| migrazioni applicate oggi | `togli_le_dodici_firme_col_pin` su **TEST e PROD** — già in servizio, il file sorgente è in git |
| deploy partiti | edge PROD `assessment-quiz` **v21** (10:35:59Z) · edge TEST col push su `test-preview` |

⇒ **La sessione nuova parte da un albero pulito**: non deve finire niente di lasciato a metà, e non
c'è nessuna PR da sorvegliare. Tutto ciò che resta è al § 3.

---

## 1. ✅ Prima di lavorare

```
git fetch origin main test-preview
git diff origin/main origin/test-preview -- CLAUDE.md docs/ .github/workflows/ \
  tools/matchpoint-browser-worker/src/server.mjs
```
✅ **Dev'essere vuoto** — verificato vuoto alla chiusura della 62ª.

📕 `docs/lavori/README.md` si apre **PRIMA di lavorare** — obbligo di casa.

🚨⭐⭐ **IL BANCO NON SI LANCIA CON `node --test test/*.test.mjs`**. Quel comando vede solo `test/`,
mentre la CI passa anche da `supabase/`, `consumer-app/` e `tools/`. Il giro vero (**69 verdi** alla
chiusura della 62ª):

```bash
r=0; v=0
while IFS= read -r f; do
  grep -qE "^\s*(import|export).*['\"]jsr:" "$f" && continue
  if node "$f" >/dev/null 2>&1; then v=$((v+1)); else r=$((r+1)); echo "❌ $f"; fi
done < <(find supabase consumer-app tools test \( -name '*.test.ts' -o -name '*.test.mjs' \) | sort)
echo "$v verdi, $r rossi"
```

### 🟢 Stato misurato a fine 62ª (misurato adesso, non ricordato)

| dove | stato |
|---|---|
| **gestionale** | `main` **6.258** · `test-preview` **6.262** — invariate: la 62ª non ha toccato `index.html` |
| **app viva** | console remota: **6.258** su `app.`, **6.262** su `test.` — verificate oggi |
| **edge PROD** | `assessment-quiz` **versione 21**, aggiornata 10:35:59Z — verificata sulla sorgente in servizio |
| banco | **69 verdi, 0 rossi** |
| lista | 🔴 urgenti **9** · 📋 in coda **12** (C 11 · D 1) · 📦 chiuse **87** — **tutti invariati** |
| firme col PIN | **0** su PROD e su TEST (tolte oggi) · gemelli senza PIN tutti vivi |
| doppioni anagrafica | **0** ✅ (sonda della 105) |
| spinte a vuoto dal 29/08 21:00 | **0** ⇒ la diagnostica della 108 non ha ancora parlato |
| omaggi scritti dall'app | **1** (quello del 29/08 21:18) |
| **bot** | ⚠️ **non ricontrollato dalla 62ª** — l'ultimo dato è della 60ª (riavvio 29/08 22:58:50, `✍️ prenotazioni REALI`) |
| **worker** | ⚠️ **non ricontrollato dalla 62ª** |

---

## 2. 🔨 COSA HA FATTO LA 62ª — sei unità, tutte fuse

| | PR | cosa |
|---|---|---|
| ① | #1200 | **voce 110**: le 27 domande nuove controllate sul regolamento, **tre corrette** |
| ② | #1201 | **voce 109**: misurata la seconda metà, e *«da qui non si vede»* era troppo largo |
| ③ | #1202 | **migrazioni**: misurata la divergenza fra i rami — il registro diverge più della cartella |
| ④ | #1203 | **le 12 firme col PIN**: misurate tutte, sono peso morto e non un buco |
| ⑤ | #1204 | **età 0**: non è dato sporco, è «data di nascita che Matchpoint non ha» |
| ⑥ | #1205 | **le 12 firme col PIN TOLTE**, TEST e PROD, con prova fisica |

### ① Le tre domande corrette (voce 110)

| id | difetto | cura |
|---|---|---|
| **P-T15** | 🔴 **risposta SBAGLIATA**: diceva che durante il punto si può passare la racchetta all'altra mano. Il **cordino al polso è obbligatorio per tutta la durata del punto** (FIP/FEP/FIT; l'eccezione è **argentina**). ⚖️ Contraddiceva **A-T15** della stessa banca ⇒ chi sapeva la regola sbagliava **proprio perché la sapeva** | riscritta sul cordino, verso `afferma` mantenuto |
| **AG-T16** | 🔴 descriveva il caso *tennistico*; nel padel l'invasione è ammessa **dopo il rimbalzo nel proprio campo** ⇒ l'opzione scartata «Solo se rimbalza prima» era **più giusta della giusta** | il rimbalzo è entrato nel **testo** della domanda |
| **P-T12** | ⚠️ «Solo piatto e **cornice**» diceva quasi la stessa cosa della giusta «Qualunque parte, anche il **bordo**» | sostituita l'opzione che collideva |

⛔ **Cosa questo NON ha provato**: dal cloud **il PDF del regolamento non si apre** (`padelfip.com`,
`fitp.it`, `knltb.nl`, `isfsports.org`, Wikipedia → tutti `403 CONNECT tunnel failed`). Il controllo
è passato dal **motore di ricerca** ⇒ **di seconda mano**.

### ⑥ Il `drop` delle 12 firme col PIN

Migrazione `20260830111500_togli_le_dodici_firme_col_pin.sql`, applicata **su TEST e su PROD**.
Cinque fronti contati (gestionale · bot clonato apposta · cron · dentro il database · il grafo di
`pmo_admin_pin_ok`), niente `CASCADE`, sorgenti recuperabili in `supabase/manual-sql/`.
✋ **Prova fisica**: TEST `login: ok` + 2943 righe · PROD `6.258`, `login: ok` + 5760 `member` e
4604 `booking`.

---

## 3. 🤝 COSA DOBBIAMO PROVARE INSIEME — in ordine

L'ordine non è per gravità: è per **quanto costa non farlo** e per quanto poco costa a lui.

### 1️⃣ Rileggere 6 domande del test — *«da stamattina una domanda sbagliata boccia un socio vero»*

📄 `docs/test-autovalutazione-banca-domande.md`. **Non tutte e 27**: il controllo sul regolamento ne
ha già chiuse 21. Restano due bersagli precisi:
· **P-T12** — l'unica la cui risposta poggia sull'**assenza di un divieto** e non su un articolo:
  nessuna fonte dice quale parte della racchetta sia ammessa;
· le **5 di terminologia** — **B-T14** (bajada) · **B-T15** (globo) · **I-T13** (salida de pared) ·
  **I-T15** (bandeja) · **A-T14** (chiquita ≠ bajada): non sono regolamento, vogliono l'orecchio di
  un maestro.
⏱️ *Dieci minuti. È ciò che tiene aperta la 110 dal lato del contenuto.*

### 2️⃣ Una domanda sola alla segreteria — chiude la 109 da sola

> *«Quando fate un omaggio a mano su Matchpoint, compare come pagamento a 0 €?»*

🔎 Perché serve: dei **3032** pagamenti mai tornati da Matchpoint, quelli a **0 centesimi sono
ZERO**. Se l'export non porta le righe a 0 €, l'assenza direbbe *«non lo so»*, non *«non è passato»*.
✅ Con un **sì**, la sonda qui sotto diventa conclusiva **in tutt'e due i versi** e la 109 si chiude
**dal cloud**, senza altro disturbo. Da lanciare **dal 31/08 in poi**:
```sql
select payload->>'data', payload->>'campo', payload->>'ora',
       payload->>'player_name', payload->>'amount_cents', payload->>'method'
from pmo_cloud_records
where record_type='payment' and payload->>'source'='matchpoint'
  and payload->>'data'='2026-08-31' and payload->>'ora'='13:00';
```
⏱️ *Trenta secondi suoi. Il resto lo fa la sessione nuova.*

### 3️⃣ Un giro del test dal telefono — chiude DUE voci insieme

La **110 ②** (*«nessuna delle quattro cure è stata vista succedere su un telefono»*) e la **97**
(*il test una domanda alla volta, dentro Telegram*) chiedono lo **stesso gesto**.
🎯 Cosa guardare mentre lo fa: le domande nuove sullo schermo, e il **livello che ne esce** — la
taratura è cambiata in 15 casi su 44 e la parola in 6.
⏱️ *Cinque minuti. Vale doppio.*

### 4️⃣ Un salvataggio di scheda socio su PROD — voce 105 e voce 108

La segreteria apre una scheda socio, cambia qualcosa, salva. Poi si guarda che **la riga sia
atterrata** e che **non ne sia nata una seconda**.
📌 La sonda dei doppioni è a **0** e va tenuta a 0:
```sql
select payload->>'id', count(*) from pmo_cloud_records
where record_type='member' and deleted is not true group by 1 having count(*) > 1;
```
⏱️ *Due minuti, e sblocca due urgenti in un colpo.*

### 5️⃣ La 84 — il test di livello col difetto vero davanti

Vuole il difetto **in atto**, non ricostruito. È la più costosa delle cinque e va fatta quando
capita, non provocata.

### ⏳ Le tre che si aspettano e basta

**92** (un gesto della segreteria che attraversa un riavvio del bot) · **83** (un worker oltre i
150 s) · **65** (curata e in servizio, si aspetta il caso). 🚨 La **83** si potrebbe **provocare**
col cancello del worker come fu fatto per la 106 — ⚠️ ma **il danno non è simmetrico**: una
prenotazione doppia occupa un campo vero, quindi va disegnata su uno slot lontano e col cancello
verificato chiuso.

### 📌 E due DECISIONI, che non sono prove

- **111** — la regola sull'età. 🆕 Adesso si sa una cosa che prima non si sapeva: **un cancello
  sull'età deve avere TRE esiti, non due.** I 22 record a `age = 0` **non sono minorenni: sono
  ignoti** (`birthDate` vuota alla fonte), e per i **1736** contatti della rubrica l'età **non
  esiste proprio**. ⛔ La parte legale non la decide una sessione.
- **112** — se i 1736 contatti `rubrica-google` debbano stare nell'anagrafica dei soci.

---

## 4. 🧠 LE TRAPPOLE DELLA 62ª

**① 🚨⭐⭐ CONTARE PER VERSIONE INVECE CHE PER NOME.** Chiedendo al registro le **versioni** dei due
file `voce47_*`: *«nessuna applicata su PROD»*. Per **nome**: *«applicate tutte e due»* — versioni
`20260816111339`/`20260816112912` contro nomi di file `…113000`/`…115500`. ⇒ Applicando via MCP **la
versione nasce nell'istante dell'applicazione**. È la 109 vista dall'altro lato.

**② 🚨⭐⭐ LA SONDA GIUSTA SUL SOGGETTO SBAGLIATO, presa al volo.** Avevo letto un salto di **19 ore**
nei pagamenti come un guasto del sync, contando i `created_at`. Erano i `synced_at` a dire la verità
(`2026-08-30T10:40:28Z`): il sync era **sano**. ⇒ *Prima di chiamare guasto un silenzio, si guarda
se il campo che si sta contando è quello che misura la cosa.*

**③ ⭐⭐ UNO ZERO VA PROVATO DI NON ESSERE UNO ZERO DA CASSETTO VUOTO.** Cercando i chiamanti nel repo
del bot il risultato era **zero** — e uno zero da directory sbagliata è identico. La prova: la
stessa sonda trova le **cinque edge `consumer-*`** che il bot chiama davvero, su 177 file e 52.382
righe.

**④ ⭐ UNA CURA GIUSTA NEL MERITO PUÒ ESSERE SBAGLIATA NEL CONTENITORE.** La prima riscrittura di
P-T15 era corretta sul regolamento e **rossa al banco**: 41-45 caratteri su un tetto di 36, e una
negazione dentro la risposta di una trappola dichiarata `afferma`. ⇒ *A dirlo non è la rilettura: è
il banco.*

**⑤ 🩹 UNA RIGA DEL PASSAGGIO ERA SBAGLIATA, e la correzione vale più del numero.** Diceva *«i 20
record a età 0: **dato sporco**… **mezz'ora**, toglie rumore»*. Sono **22**, **non sono sporchi**
(`birthDate` vuota alla fonte), il calcolo dell'età è **sano** (0 incoerenti su ~1080), e quella
mezz'ora **non avrebbe pulito niente**. Il difetto vero è che **`0` significa due cose** — ed è lo
**stesso caso dello `0,5` del livello**, che il progetto ha già deciso di trattare come non-dato
l'11/08. 📌 *Quando un progetto ha già deciso come trattare un non-dato in un campo, la stessa
decisione va cercata negli altri campi prima di scoprirla di nuovo.*

**⑥ 🔧 L'EGRESS DEL CONTAINER BLOCCA QUASI TUTTO IL WEB.** `padelfip.com`, `fitp.it`, `knltb.nl`,
`isfsports.org` e perfino Wikipedia → `403 CONNECT tunnel failed`, sia da `curl` sia da WebFetch.
✅ Funziona il **motore di ricerca**, e funzionano gli host dell'allowlist della console remota.
⇒ Un controllo su una fonte esterna è **di seconda mano** finché non si dice il contrario.

**⑦ 🔧 `list_workflow_runs` SFORA IL CONTESTO** (ancora vero): il risultato va su file e si legge con
`python3`.

**⑧ 🩹 `CLAUDE.md` dice «il ponte chiama QUATTRO edge `consumer-*`»** — misurato oggi sul repo del
bot, sono **cinque**: c'è anche `consumer-staff-events`. ⚖️ La regola *«il gestionale SA, il bot
DICE»* **regge intera** (è pur sempre una edge del gestionale): è il conteggio a essere invecchiato.

---

## 5. 🧰 Attrezzi

| | |
|---|---|
| ordine push | prima `test-preview`, **poi PR a `main`** (≤15 file, niente cancellazioni, mai dal ramo `test-preview`). Il push diretto su `main` è **bloccato** |
| promuovere su `test-preview` | **cherry-pick dei propri commit**, mai un merge del ramo di lavoro |
| banco gestionale | **il giro completo del § 1**, non `test/*.test.mjs` |
| 🌐 **guardare l'app viva** | `tools/verifica-browser`: `node console.mjs --env prod\|test --eval "…"`. ⚠️ **serve `npm install` lì dentro**. Le `PMO_VERIFY_*` **ci sono già** (verificate oggi, tutte e quattro). ✅ **È la prova fisica disponibile dal cloud** |
| 🆕 **il repo del bot** | `add_repo` + **una sola** clonazione `--depth 1` con timeout ≈10 min. Sha noto: `09110c5` |
| DB | MCP Supabase — PROD `qqbfphyslczzkxoncgex`, TEST `cudiqnrrlbyqryrtaprd`, memoria bot `aylykijfirtegyxzdwgu` |
| 🆕 quando una migrazione è stata **applicata** | si chiede **per NOME**, non per versione (trappola ①) |
| commit | **mai `-m` con backtick**: heredoc con `-F`. 🆕 E se il classificatore blocca un comando concatenato, **si spezza** (`commit` e `push` separati) |
| conteggi lista | l'aritmetica di `guard-docs-truth` si rifà in locale **prima** di spingere |

---

## 6. 🤝 Come si procede (invariato)

> *«Procediamo sempre come tu pensi sia corretto»* — copre anche le promozioni; il freno è la
> **dichiarazione**. Fuori: **inventare voci non in lista**, e l'irreversibile/visibile (si dice
> prima, anche procedendo). ✋ **Un task non è finito finché non è provato fisicamente.**
> 📌 E: **«scrivi troppo» — risposte corte.**

⭐ **Quello che la 62ª ha imparato, ed è una cosa sola detta in tre modi:** *un limite dichiarato va
riprovato prima di trasmetterlo.* «Da qui non si vede l'omaggio» era troppo largo (il sync dei
pagamenti è vivo, manca solo la data). «I chiamanti nel repo del bot sono dedotti» si è chiuso
clonando il repo. «I 20 record a età 0 sono dato sporco» era falso. ⇒ **Tre righe ereditate, tre
volte smentite dalla misura** — e nessuna delle tre era una bugia: erano vere quando furono scritte,
o scritte senza guardare. È la **26ª**, e non smette di presentarsi.
