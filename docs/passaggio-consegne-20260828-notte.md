# Passaggio di consegne — 28/08/2026, NOTTE (fine 56ª sessione)

**Come si usa:** incollalo come primo messaggio della chat nuova. È scritto per essere capito
**senza** la conversazione precedente.

⚠️ Serata su **E1–E10** (test di livello) e su un guasto trovato per caso e ancora **aperto**.
Sei PR sul gestionale (#1171-#1177), una sul bot (#108), un deploy del bot dei soci.

---

## 🚨 LEGGI PRIMA QUESTO — DUE COSE ROTTE ADESSO

> ### 1. 🔴 **PROD gira la v6.254, che contiene una cura INERTE** (voce 105). Il difetto è vivo:
> ### ogni modifica di livello dalla segreteria può ancora sdoppiare un socio.
> ### La ricura è sulla **v6.259 di `test-preview`**, con prova fisica **da fare**.
>
> ### 2. 🟡 **PR #1177 aperta** (rispecchio docs su `main`): finché non è fusa, `guard-worker-sync`
> ### è rossa su tutti e due i rami.

📕 `docs/test-livello-regole.md` resta la **fonte definitiva** sul test di livello.
📋 `docs/lavori/README.md` si apre **PRIMA di lavorare** — obbligo di casa.

---

## 1. ✅ Prima di lavorare

```
git fetch origin main test-preview
git diff origin/main origin/test-preview -- CLAUDE.md docs/ .github/workflows/ \
  tools/matchpoint-browser-worker/src/server.mjs
```
⚠️ **Non sarà vuoto finché la #1177 non è fusa.** Fondila per prima cosa.

🆕 Servono anche `PadelVillage/assistente-padel-agent` e `PadelVillage/padel-match-organizer-test`
(→ `add_repo`, **una sola** clonazione con timeout generoso, `register_repo_root`).

### 🟢 Stato misurato a fine sessione

| dove | stato |
|---|---|
| **gestionale** | `main` **6.254** · `test-preview` **6.259** |
| **edge su PROD** | `consumer-assessment-link` **v25** · `consumer-assessment-decision` **v12** · `assessment-quiz` v19 |
| **bot dei soci** (VM) | deploy #121 alle 21:42, `online` · `qqbf… (PROD)` · `✍️ prenotazioni REALI` |
| banco gestionale | **35 file, zero rossi** |
| banco bot | **1640/1640** · `tsc` pulito |
| lista | 🔴 urgenti **8** · 📋 in coda **10** · 📦 chiuse **83** |

---

## 2. 🔨 COSA È STATO FATTO

### ✅ E1–E10 — tutti e nove COSTRUITI, e in servizio su PROD

Erano **già approvati da lui** il 27/08 notte: il passaggio di consegne precedente diceva
«da validare», ma il documento diceva «tutti e nove approvati, nessuno è ancora costruito».
⇒ Il lavoro era **costruire**, non validare.

| # | cosa | prova fisica |
|---|---|---|
| **E1** | le protezioni del ponte che *parla* portate in quello che *registra* | ✅ ramo `IL_TEST_DICE_MENO` · ⏳ `ASPETTA_IL_MAESTRO` no |
| **E2** | `applied_at` letto, non più dedotto da due orologi | ⏳ no |
| **E3** | via il `.limit(20)`: tutta la storia | ⏳ no |
| **E5 · E6** | i due campi morti tolti (misurato: il bot non li leggeva) | ⏳ no |
| **E7** | nel bot, da 4 codici di rifiuto a 10 | ✅ |
| **E8** | **si svuota da sé** applicando la sua forma: nessun campo morto da potare | — |
| **E9** | chi aspetta il maestro non riceve più il promemoria | ⏳ no |
| **E10** | via il ripiego «Socio» (0 soci senza nome su 2817) | ⏳ **aperta a metà**: verso il socio è una **porta muta** |

⭐ **Tre letture letterali di E1 sono state fermate PRIMA di scrivere**, e ognuna avrebbe rotto
qualcosa di vivo: applicarla a `scendo` (avrebbe spento il **gradino** acceso il giorno prima);
aggiungere un rifiuto sulla **stessa fascia** (rompeva la sua regola del 27/08 mattina — le due
regole pure la escludono già da dentro); rifiutare quando il livello è **sconosciuto**.

### ✅ La prova fisica di E1 ed E7, dentro la finestra esatta

```
22:02:40  scheda 9ZUPU7PX8YUEFL — quiz passato, 3,5 (Intermedio), applied_at VUOTO
~22:04    la segreteria porta Marco da 3,5 a 4
22:05:29  Marco tocca il bottone GIÀ DISEGNATO «Tengo Intermedio»
22:05:31  registro del bot: scelta livello non registrata: IL_TEST_DICE_MENO
dopo      member_decision: null
```
⇒ Prima, quel tocco avrebbe **registrato** la scelta e il bot avrebbe detto *«te lo registro»*
senza che nessun livello venisse mai scritto.

---

## 3. 🚨 IL LAVORO APERTO: VOCE 105

**Il guasto**: alle **22:17** una modifica di livello dalla segreteria ha **sdoppiato Maurizio
Aprea**, e due minuti dopo il bot si è rifiutato di registrare la sua scelta (`AMBIGUA`). Con due
righe quel socio **non riesce nemmeno ad aprire il test**.

**La causa, isolata misurando** — e NON è quella che il passaggio precedente supponeva (accusava
il sync): le righe `member` toccate per minuto erano `17:31 → 1096` (giro di massa = il sync)
contro `20:08 → 1`, `20:17 → 1`, `20:21 → 1`. ⇒ Scrittura **singola dell'app**.
`pmoMemberCloudLocalKey` in `index.html` **calcolava** la chiave dal telefono, che vinceva
sempre — anche quando la riga viva stava su `email:`. A Maurizio ha **rianimato una riga
archiviata dal 19 luglio**.

**Esposti: 25 soci su 2817** (21 `email:`, 1 `name:`, 3 legacy).

### 🩹 E LA PRIMA CURA ERA INERTE — questa è la parte che serve sapere

La v6.254 (promossa a PROD alle 20:46) metteva `cloudLocalKey` sui soci **scaricati**, ma quel
valore **non arrivava mai** al socio che poi viene scritto: la fusione
(`pmoMemberFieldsFromCloud`) copia solo i campi di `PMO_MEMBER_CLOUD_FIELDS`, e la chiave non è
fra quelli. Per ogni socio già in `localStorage` — praticamente tutti — restava assente.

📏 **Smentita da un gesto vero**: alle **20:54:23**, con la cura in servizio da otto minuti,
una modifica di livello a **Fabiola Limuti** l'ha **sdoppiata lo stesso**.

🔨 **Ricurata sulla v6.259 di `test-preview`**: la chiave si scrive nell'idratazione, **prima e
fuori** dal confronto sulla freschezza. Non basta aggiungerla a `PMO_MEMBER_CLOUD_FIELDS`: quella
copia scatta solo se la riga del cloud è più fresca, e **una chiave non è un dato che compete
sulla freschezza — è l'indirizzo della riga**.

### ⏳ COSA MANCA, in ordine

1. **Fondere la PR #1177** (docs su `main`), o la guardia resta rossa.
2. **Prova fisica della v6.259 su TEST.** 🚨 **La console remota NON basta**: parte da un browser
   **pulito**, e il difetto nasce dallo **stato accumulato** in quello dell'operatore. Serve un
   gesto suo — cambiare il livello a uno dei soci a chiave `email:` su TEST e **contare le righe**
   — oppure `--storage-in` con un export del suo browser.
3. **Promuovere a PROD** solo dopo. PROD oggi ha la cura **inerte**.
4. **La cura definitiva** è più in là e non è stata fatta: in `pmo_upsert_records_admin`,
   ritrovare la riga per `payload.id` invece di fidarsi della `local_key` che arriva. Copre anche
   il caso della **chiave stantia** (il sync ri-chiava e archivia entro i 10 minuti di throttle),
   che la cura di stasera **non copre**.
5. 🚨 **Rattoppi a mano da non dimenticare**: i doppioni di **Maurizio** e **Fabiola** sono stati
   archiviati con un `update … set deleted = true` (riga `email:`, autorizzato da lui). La sonda:
   ```sql
   select payload->>'id', count(*) from pmo_cloud_records
   where record_type='member' and deleted is not true group by 1 having count(*) > 1;
   ```
   Deve tornare **vuoto**. Se torna qualcosa, è la 105 che ha colpito ancora.

---

## 4. ⏳ ALTRO CHE RESTA

**A. 🔴 Le 8 urgenti**: **105**, 101, 97, 92, 84, 83, 78, 65 — la lista canonica è
`docs/lavori/README.md`, non questo elenco.

**B. `ASPETTA_IL_MAESTRO`** — l'unico ramo di E1 non provato. La ricetta è pronta e verificata:
Maurizio (a **4**) rifà il test dichiarando **Avanzato** → deve tornare **Avanzato** ⇒ i bottoni
compaiono e `applied_at` resta vuoto (il tetto taglia a 3,5, meno di 4, e il livello non scende);
poi lo si porta a **3,5** — **non a 3**, o il cron scrive `applied_at` e il tocco finisce su
`GIA_APPLICATA` — e si tocca «Tengo Avanzato».

**C. E10 aperta a metà**: verso il socio è una **porta muta** (il bot cade su
`TEST_LIVELLO_MUTO`). Riguarda 0 soci su 2817, e resta aperta lo stesso.

**D. Annotato e NON promosso a voce**: il cambio di livello a mano **non aggiorna
`lastLevelUpdateAt`**. Quel campo regge la protezione *«una scheda vecchia non deve scavalcare un
livello aggiornato dopo»* in `assessment-apply-level`. Non misurato quanto sia raggiungibile.

**E. Soci di prova, livelli veri a fine sessione**: Maurizio **4**, Marco **3,5**,
Laura 3,5, Fabiola **1,5**. 🚨 Se erano prove si rimettono dalla segreteria.

---

## 5. 🧠 LE TRAPPOLE DI OGGI

**① 🚨⭐⭐ QUATTRO volte il difetto era nella prova che avevo appena scritto io.** Una guardia che
cercava `.limit(` e lo trovava **dentro il commento che spiega perché l'ho tolto**; la gemella su
`applicazione_lanciata`; una guardia che contava 1400 caratteri a occhio e pescava la query
sbagliata; e — la peggiore, perché è finita **in produzione** — un banco che provava il
**produttore** invece del **destinatario**.
📌 *Una guardia sul codice deve guardare il codice, non la prosa.* Da lì `senzaCommenti`.
📌 *Una cura che produce un valore che nessuno riceve è verde in ogni banco che guardi il
produttore invece del destinatario.*

**② 🚨⭐⭐ Un sabotaggio può essere sbagliato lui.** Uno è passato verde: avevo riscritto la stessa
regola in un altro ordine, cioè un **refactor**, non un attacco. *Se un sabotaggio è verde, prima
si chiede se sabota davvero.*

**③ 🚨⭐⭐ Una prova va guardata NEI DATI prima di chiedere il gesto.** La prima ricetta per Marco
lo mandava sui bottoni delle 21:57 — ma quella scheda era stata applicata **33 secondi dopo**, e
il ponte avrebbe risposto `GIA_APPLICATA`: un rifiuto **vecchio**, che sta *prima* dei due nuovi.
Il tocco sarebbe passato senza esercitare niente, **e sullo schermo la prova sarebbe sembrata
fatta**.

**④ ⚖️ Una prova può essere verde per la ragione sbagliata.** Dopo l'archiviazione, Maurizio
stava su `phone:` — che è *anche* la chiave che l'app si calcola. La scrittura sarebbe atterrata
bene **anche senza la cura**. È stato Fabiola, che stava su `email:`, a dire la verità.

**⑤ 🚨⭐⭐ «Serve il Mac» era falso, e l'ha smontato LUI.** Avevo scritto che la cura della 105 era
un lavoro dal Mac. Sua domanda: *«perché non possiamo farla sul gestionale di test?»*. Tre misure
da un minuto gli davano ragione: TEST ha **24 soci a chiave `email:` col telefono** (più di PROD);
un banco per quella funzione **esisteva già**; e l'anagrafica di TEST è **viva** — il congelamento
riguarda il **calendario**. ⇒ È la **26ª**: *un limite dichiarato che nessuno prova resta vero per
sempre perché sembra prudente*.

**⑥ 📏 Due righe vecchie corrette misurando**: il punto **C①** del passaggio precedente accusava
la rete del sync (`eChiaveVecchiaDellaStessaScheda`) — **non era il suo turno**; e il punto **D**
aveva previsto il rischio giusto con la **causa sbagliata**.

**⑦ ⚠️ La console remota ha un limite dichiarato che stasera è stato toccato**: parte da un
browser **pulito**. Per i difetti che nascono dallo stato accumulato nel browser dell'operatore
non decide — e un suo verde lì non vale.

---

## 6. 🧰 Attrezzi

| | |
|---|---|
| ordine push | prima `test-preview`, poi PR a `main` (≤15 file, mai dal ramo `test-preview`) |
| promozione app | ramo da `origin/main` + `git show <sha> -- index.html \| git apply --3way`, risolvere solo `APP_VERSION` (PROD prende il suo numero, TEST resta davanti) |
| rispecchio docs | `git checkout test-preview -- docs/` da un ramo basato su `main`, poi `git diff origin/test-preview HEAD -- docs/` **vuoto** |
| TEST subito | `sync-app.yml` in `padel-match-organizer-test` (`workflow_dispatch`) — misurato: **17 secondi**. ⚠️ La CDN può servire ancora la versione vecchia: **leggere `appVersion` nel risultato della console** |
| console remota | `node console.mjs --env test\|prod --file x.js` in `tools/verifica-browser` (credenziali già nell'ambiente cloud) |
| deploy bot | `deploy-bot-hetzner.yml`, `bersaglio: soci` + `conferma_soci: SOCI`; poi `stato-bot.yml` con una regex in `cerca` — **il registro del bot sa cose che il database non ha** |
| DB | MCP Supabase — PROD `qqbfphyslczzkxoncgex`, TEST `cudiqnrrlbyqryrtaprd` |
| edge in servizio | `get_edge_function` → salvare su file e `grep` (mai stampare) |
| commit | mai backtick in `-m`: heredoc con `-F -` |
| conteggi lista | l'intestazione **e** la fotografia: `guard-docs-truth` confronta tutt'e due |

---

## 7. 🤝 Come si procede (invariato)

> *«Procediamo sempre come tu pensi sia corretto»* — copre anche le promozioni; il freno è la
> **dichiarazione**. Fuori: inventare voci non in lista, e l'irreversibile/visibile (si dice
> prima, anche procedendo). ✋ **Un task non è finito finché non è provato fisicamente.**
> 📌 E: **«scrivi troppo» — risposte corte.**
