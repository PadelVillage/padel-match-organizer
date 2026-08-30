# Passaggio di consegne — 30/08/2026, mattina (fine 61ª sessione)

**Come si usa:** incollalo come primo messaggio della chat nuova. È scritto per essere capito
**senza** la conversazione precedente.

📌 **Copre DUE sessioni**: la notte del 29-30 (60ª, di un'altra sessione) e la mattina del 30
(61ª, questa). Le parti della 60ª sono state **ricontrollate una per una**: quelle che reggono
sono qui, quelle invecchiate sono corrette e segnate 🩹.

⚠️ La 61ª ha portato **quattro cure in servizio su PROD** (test di autovalutazione), **due voci
nuove** (110, 111, 112 — tre) e **una scoperta su una voce altrui** (la 109). Cinque PR
(#1194, #1195, #1196, #1197, #1198) e due deploy: **Pages** e le **edge di PROD**.

---

## 🔴 LEGGI PRIMA QUESTO

### ① 🆕 Il primo omaggio vero È PASSATO — la voce 109 è chiudibile per metà, e nessuno l'ha guardato

La scheda della 109 lascia una sonda: *«omaggi scritti dall'app: oggi 0, il giorno del primo
omaggio vero deve diventare 1»*. **È a 1.**

```sql
select created_at, local_key, payload from pmo_cloud_records
where record_type='payment' and payload->>'source'='pmo_gift';
-- paygift|2026-08-31|4|13:00|maurizio aprea · amount_cents 0 · method gift · 29/08 21:18:34
```
E l'audit porta un `cloud_records_upsert {count: 1}` allo **stesso microsecondo** ⇒ la spinta ha
scritto davvero.

🔒 **E la cura era già in servizio quando è successo** — misurato, non dedotto: la migrazione
`voce109_la_rpc_conosce_i_pagamenti` risulta applicata con versione **20260829193605** (19:36),
cioè **un'ora e quaranta prima** dell'omaggio, mentre il commit che la porta su `main` (#1188) è
delle **21:40**.
📌 *La data del commit non è la data dell'applicazione: chiederlo a
`supabase_migrations.schema_migrations` costa una query e toglie una deduzione.*

⏳ **Resta l'altra metà, che la scheda chiede**: che quell'omaggio **si sia segnato su Matchpoint**.
Da una sessione cloud non si vede — vuole il worker o l'occhio della segreteria.

### ② Le 67 spinte a vuoto: le due piste sono cadute, e la diagnostica NON ha ancora parlato

> **67 spinte al cloud su 411, dal 15 al 29 agosto, hanno scritto ZERO record.** Una su sei.

La 60ª ha fatto cadere le due piste (whitelist e `local_key` vuota) misurando, e ha messo una
**diagnostica nel registro** (migrazione `20260829223000_voce108_…`, applicata ai due database):
quando **e solo quando** `v_count = 0`, l'audit annota `ricevuti`, `senza_tipo`, `senza_chiave`,
`tipi`.

🩹 **Aggiornato il 30/08 mattina**: dal 29/08 21:00 a oggi le spinte a vuoto sono **ZERO** ⇒ la
diagnostica non ha ancora avuto occasione di parlare. La sonda resta questa:

```sql
select created_at, detail from pmo_audit_log
where action='cloud_records_upsert' and (detail->>'count')::int = 0
  and created_at > '2026-08-29 21:00:00+00'
order by created_at desc;
```
`senza_chiave > 0` → pista ①. Un `tipi` fuori whitelist → pista ②. `ricevuti > 0` e tutto a zero
→ un terzo caso che nessuno ha immaginato.

### ③ 🆕 Il test di autovalutazione è stato ritarato in quattro punti, ed è IN SERVIZIO su PROD

Voce **110**. PROD **6.258**, TEST **6.262**. Le quattro cure:

| | cosa | misura che l'ha aperta |
|---|---|---|
| ① | banca dei trabocchetto **bilanciata** (27 domande nuove che affermano, campo `verso` su tutti e 84) | 44 su 57 si passavano **negando** ⇒ chi negava tutto e sapeva le 2 normali passava nel **76-96%** contro il 50% del caso |
| ② | pesi da 0,40/0,25/0,35 a **0,20/0,25/0,55**, freno verso il basso **tolto** | il **65%** del punteggio veniva da due autodichiarazioni; i freni non avevano mai morso in 44 schede |
| ③ | le quattro scale tecniche sullo **stesso metro** (ogni risposta vale il minimo della fascia che descrive) | corse diverse (1-5 contro 1,5-4,5) mediate alla pari ⇒ lo scambio pesava un terzo in più |
| ④ | la **frequenza** smette di essere un dato raccolto e buttato | colonna vuota su **44 schede su 44**: la scrittura cercava una chiave che nessuno manda |

📏 Effetto sulle 44 schede vere: il numero cambia in **15** casi (4 su, 11 giù), la parola in **6**.
Simulazione validata riproducendo `calculated_level` su **44 su 44** col calcolo vecchio.

🚨 **LE DUE COSE CHE TENGONO LA 110 APERTA, e la prima è la più urgente della lista:**
- **le 27 domande nuove non le ha rilette nessuno che giochi a padel.** Le 36 di Principiante
  furono lette una per una col committente il 27/08. **Da stamattina una domanda sbagliata boccia
  un socio vero.** Gli id: `P-T10…P-T16`, `B-T13…B-T16`, `I-T13…I-T16`, `A-T13…A-T17`,
  `AG-T13…AG-T19`. Le più esposte citano misure di regolamento (racchetta, rete, pareti, palla):
  vanno controllate sul regolamento FIP, non a memoria. 📄 Testo pronto per la rilettura:
  `docs/test-autovalutazione-banca-domande.md`;
- **nessuna delle quattro cure è stata vista succedere su un telefono.**

### ④ Il residuo della 106, piccolo e non curato

Il registro del bot scrive `[togli] Lidia Comes: rifiutato (esito_ignoto)` — chiama **«rifiutato»**
ciò che il messaggio al socio (giustamente) **non** chiama così. Il socio legge la verità, chi legge
i log no — e fra un mese la diagnosi la fa chi legge i log.
📍 Una riga: `assistente-padel-agent/src/telegram/bot.ts:2406`. ⚠️ **Non è una voce**: va proposta o
attaccata alla 106 se la si riapre.

📕 `docs/lavori/README.md` si apre **PRIMA di lavorare** — obbligo di casa.

---

## 1. ✅ Prima di lavorare

```
git fetch origin main test-preview
git diff origin/main origin/test-preview -- CLAUDE.md docs/ .github/workflows/ \
  tools/matchpoint-browser-worker/src/server.mjs
```
✅ **Dev'essere vuoto** — verificato vuoto alla chiusura della 61ª.

🆕 Se serve il bot: `PadelVillage/assistente-padel-agent` (→ `add_repo`, **una sola** clonazione con
timeout generoso, poi `npm install`). Sha noto: `b78954d` (29/08 notte).

🚨⭐⭐ **IL BANCO NON SI LANCIA CON `node --test test/*.test.mjs`** — costò una CI rossa alla 60ª.
Quel comando vede **solo** `test/`, mentre la CI passa anche da `supabase/`, `consumer-app/` e
`tools/`. Il giro vero (riconfermato dalla 61ª, dà **67 verdi**):

```bash
r=0; v=0
while IFS= read -r f; do
  grep -qE "^\s*(import|export).*['\"]jsr:" "$f" && continue
  if node "$f" >/dev/null 2>&1; then v=$((v+1)); else r=$((r+1)); echo "❌ $f"; fi
done < <(find supabase consumer-app tools test \( -name '*.test.ts' -o -name '*.test.mjs' \) | sort)
echo "$v verdi, $r rossi"
```
📌 *Un banco che gira su meno file di quelli che la CI guarda è un verde che non ha controllato.*

### 🟢 Stato misurato a fine 61ª (misurato adesso, non ricordato)

| dove | stato |
|---|---|
| **gestionale** | `main` **6.258** · `test-preview` **6.262** 🩹 *(la 60ª diceva 6.257/6.261)* |
| **app viva** | console remota: **6.258** su `app.padelvillage.club`, **6.262** su `test.` — verificate |
| **edge PROD** | la sorgente in servizio porta 44 trabocchetto che negano + 40 che affermano, pesi 0,20/0,55, nessun freno basso |
| banco gestionale | **67 verdi, 0 rossi** 🩹 *(erano 66: la 61ª ha aggiunto 3 file di prova)* |
| lista | 🔴 urgenti **9** · 📋 in coda **12** (C 11 · D 1) · 📦 chiuse **87** 🩹 *(erano 8 / 10 / 87)* |
| doppioni anagrafica | **0** ✅ (sonda della 105, ancora vuota) |
| omaggi scritti dall'app | **1** 🆕 *(era 0 — vedi il riquadro ①)* |
| spinte a vuoto dal 29/08 21:00 | **0** ⇒ la diagnostica della 108 non ha ancora parlato |
| migrazioni divergenti fra i rami | **8 file**, nessuna guardia le sorveglia |
| **bot** | `assistente-telegram` (soci) riavviato **22:58:50** del 29/08, dichiara `✍️ prenotazioni REALI` — ⚠️ **riportato dalla 60ª, non ricontrollato dalla 61ª** |
| **worker** | acceso a fine 60ª — ⚠️ **non ricontrollato dalla 61ª** |

---

## 2. 🔨 COSA È STATO FATTO

### 61ª (30/08 mattina) — il test di autovalutazione

Quattro cure (riquadro ③), **tre guardie nuove tutte SABOTATE** e non solo viste verdi:
`test/trabocchetto-bilanciato.test.mjs`, `test/taratura-del-livello.test.mjs`,
`test/la-frequenza-serve-a-qualcosa.test.mjs`, più un caso in `assessment-apply-level.test.mjs`.

⭐ **La guardia che mancava del tutto**: delle 65 prove del repo **nessuna teneva ferma la taratura**
— si poteva cambiare un peso o un punteggio e vedere tutto verde. La nuova pinza le **decisioni**
(le scale sono lo stesso metro; un gradino di risposte muove più di un gradino di dichiarazioni; il
freno c'è in alto e non in basso), non i numeri: *un banco che ricopia «0,55» è rosso a ogni
ritaratura legittima e verde a ogni deriva che ricopi anche lui.*

🆕 Due documenti per far esaminare il test da fuori (persona o IA), autosufficienti:
`docs/test-autovalutazione-testo-per-revisione.md` e `docs/test-autovalutazione-banca-domande.md`
(tutte e 219 le domande con la risposta giusta).

### 61ª — le voci nuove 111 e 112, dalla domanda sulla maggiore età

Sua proposta: *«una domanda iniziale: puoi farlo se sei maggiorenne»*. **Scartata misurando**, e per
due ragioni indipendenti: chiede la **soglia sbagliata** (in Italia il consenso digitale si dà a
**14 anni**, art. 2-quinquies del Codice Privacy) e sarebbe un **cancello che non sbarra**.

📏 E le misure hanno ristretto il problema invece di allargarlo:
- **gettoni creati ≠ email inviate**: 1339 gettoni, ma **542 email a 129 persone**, 22/05-23/06,
  tutte a clienti Matchpoint;
- delle 129: **120 maggiorenni, 3 fra 14 e 17, 2 sotto i 14, 4 a età 0** (dato sporco);
- **nessuno dei due bambini ha consegnato una scheda**. L'unico minorenne che ha usato il test è
  un **sedicenne**, sopra la soglia dei 14 — il collaudatore di queste settimane.

⇒ **Nessun incidente da riparare**; c'è una regola da avere **prima** che il bot si apra ai soci.
⛔ La parte legale non la decide una sessione.

**Voce 112**, che è la scoperta più grande: `member` tiene **due popolazioni** — **1102** clienti
Matchpoint e **1708** contatti con `importedFrom: rubrica-google` (telefono ed email tutti, **zero
livelli, una sola età**). Spiega da sola il «l'anagrafica copre 1102 soci su 2817» che sembrava un
import rotto. A **357** di loro è stato generato un gettone; nessuna email è mai partita.

### 60ª (29-30 notte) — voce 106 chiusa a prova fisica

Il bot diceva *«non ci sono riuscito»* su una rimozione di cui il gestionale **non sapeva l'esito**.
L'ordine di messa in servizio contava: ① il bot impara le frasi (PR bot #110), ② il bot va in
servizio (22:58:50), ③ **poi** il gestionale manda la parola (#1192).
Prova **provocata** col cancello del worker, stesso identico gesto:
```
15:28:58  [togli] Fabiola Limuti: rifiutato (scrittura_rifiutata)  →  "non ci sono riuscito."
23:48:58  [togli] Lidia Comes:    rifiutato (esito_ignoto)         →  "Non so ancora com'è andata"
```
⛔ Le altre **tre** frasi (`esci`, `annulla`, `aggiungi`) non le ha lette nessuno su un telefono.

🩹 **Correzione al passaggio della 60ª**: diceva *«Quattro PR sul gestionale (#1191, #1192, #1193 +
#1191)»* — la #1191 è ripetuta. La quarta è la **#1188**, che porta la migrazione della voce 109
(verificato sul commit `77e7371`).

---

## 3. 🧠 LE TRAPPOLE (60ª + 61ª)

**① 🚨⭐⭐ IL BANCO LOCALE GIRAVA SU MENO FILE DELLA CI** *(60ª)*. `node --test test/*.test.mjs`
diceva 74 verdi; la CI ne trovò 3 rosse in `supabase/`. Il comando giusto sta al § 1.

**② ⭐⭐ UNA PROVA CHE CADE PER UN CAMBIO VOLUTO SI RISCRIVE, NON SI ALLARGA** *(60ª)*. *Quando una
prova cade, si guarda se la regola è invecchiata — non si allarga l'assert finché passa.*

**③ 🚨⭐⭐ UN LIMITE DICHIARATO E SMENTITO SEI ORE DOPO** *(60ª)*. «Non si provoca» era falso: lo
strumento esisteva da due settimane. ⚖️ È la **26ª**. *Prima di scrivere «non si può», chiediti cosa
dovrebbe succedere perché succeda, e vai a leggere se qualcosa lo sa già fare.*

**④ 🚨 IL TELEFONO TOCCATO PRIMA DI LEGGERE IL CODICE** *(60ª)*. Un Ospite come bersaglio del togli:
rifiutato da una regola voluta (voce 82), leggibile in trenta secondi.

**⑤ ⏳ IL BERSAGLIO VA VERIFICATO NELLA COPIA PRIMA DI CHIUDERE IL CANCELLO** *(60ª)*, e chiudendo il
cancello si ferma **anche il sync**.

**⑥ ⚠️ OGNI CHIUSURA DEL CANCELLO COSTA UN SYNC DI PROD** *(60ª)*. *Un cron verde non è un sync
riuscito.*

**⑦ 🔧 `list_workflow_runs` SFORA IL CONTESTO** *(60ª e 61ª, ancora vero)*: il risultato va su file e
si legge con `python3`, o si delega a un subagente.

**⑧ 🆕🚨⭐⭐ CONTARE I GETTONI PER CONTARE I CONTATTATI** *(61ª)*. Avevo scritto «il link è uscito
verso 1339 soci»: i gettoni sono 1339, le **email** 542 a **129 persone**. È la **24ª** — la sonda
giusta sul soggetto sbagliato — e sbaglia **per eccesso**, cioè nel verso che fa più paura.

**⑨ 🆕🚨 IL RAMO DI LAVORO NON SI FONDE IN `test-preview`** *(61ª)*. I due `index.html` differiscono
di **1246 righe** e `main` ha **50 commit** che `test-preview` non ha: un merge li avrebbe portati
tutti di là. Si fa **cherry-pick dei propri commit**. (Sono atterrati senza un conflitto perché
tutti gli altri file toccati erano già identici fra i rami.)

**⑩ 🆕⚠️ IL PUSH DIRETTO SU `main` È BLOCCATO** dalle regole del repo (`push declined due to
repository rule violations`) ⇒ la PR non è una preferenza, è l'unica strada.

**⑪ 🆕🩹 I BACKTICK NEL MESSAGGIO DI COMMIT, DUE VOLTE IN UN GIORNO** *(61ª)*. `git commit -m "…
\`age\` …"` esegue `age` e lascia un buco nel messaggio. La prima volta l'ho corretto con `--amend`
prima di spingere; la seconda era già su un ramo condiviso e **non si riscrive la storia per un
messaggio**. ⇒ **Sempre `-F -` con heredoc**, mai `-m` con testo che contiene backtick.

**⑫ 🆕📌 LA DATA DEL COMMIT NON È LA DATA DELL'APPLICAZIONE** *(61ª)*. Vedi il riquadro ①.

---

## 4. ⏳ COSA RESTA

**Le 9 urgenti**: 109, 108, 105, 97, 92, 84, 83, 65, **110**. La lista canonica è
`docs/lavori/README.md`.

| # | cosa manca | chi |
|---|---|---|
| **110** 🆕 | ① la **rilettura delle 27 domande nuove** da chi gioca a padel ② un giro del test su un telefono | **lui / un maestro** |
| **109** | 🩹 **metà è passata** (vedi riquadro ①): resta che l'omaggio **si segni su Matchpoint** | **lui** |
| **108** | un salvataggio di scheda socio su PROD senza avvisi · e una spinta a vuoto che lasci la diagnostica | arriva da sé |
| **105** | il giro intero dall'app: la segreteria salva e la riga atterra | **lui** |
| **97** | un giro del test intero dal telefono *(si sovrappone alla 110 ②)* | **lui** |
| **92** | un gesto della segreteria che attraversa un riavvio del bot | si aspetta |
| **84** | la prova col difetto vero davanti | **lui** |
| **83** | un worker oltre i 150 s | si aspetta |
| **65** | curata e in servizio: si aspetta il caso | si aspetta |

🚨⭐ **La 83 si può PROVOCARE come la 106** — stessa forma sul ramo `create`, stessa tecnica del
cancello. ⚠️ Ma **il danno non è simmetrico**: una prenotazione doppia occupa un campo vero. Va
disegnata su uno slot lontano, col cancello verificato chiuso.

**In coda, le due nuove** (111 e 112) aspettano una **sua decisione**, non codice:
- **111** — la regola sull'età: dove sta il cancello del consenso (non nel test), e se il circolo
  debba raccogliere un consenso genitoriale. ⛔ Per i 1708 contatti **non esiste fonte dell'età**;
- **112** — se i 1708 contatti debbano stare nell'anagrafica dei soci.

**Altro, non urgente:**
- **`supabase/migrations/` diverge fra i rami**: **8 file** (riconfermato), nessuna guardia.
  ⛔ Non è una voce: se la si vuole, la prima cosa è misurarla;
- **`pmo_upsert_records_admin(text, jsonb)`**, la vecchia firma col PIN, viva e inutilizzata;
- il **residuo della 106** (`bot.ts:2406`);
- 🆕 **i 20 record a età 0** in anagrafica: dato sporco che fa sembrare minorenne chi magari non lo
  è. Mezz'ora, toglie rumore da ogni misura futura.

🩹 **Le sonde, coi valori misurati stamattina:**
```sql
-- doppioni: deve tornare VUOTA          → oggi 0 ✅
select payload->>'id', count(*) from pmo_cloud_records
where record_type='member' and deleted is not true group by 1 having count(*) > 1;

-- omaggi scritti dall'app: era 0        → oggi 1 🆕 (vedi riquadro ①)
select count(*) from pmo_cloud_records
where record_type='payment' and payload->>'source'='pmo_gift';
```

---

## 5. 🧰 Attrezzi

| | |
|---|---|
| ordine push | prima `test-preview`, **poi PR a `main`** (≤15 file, niente cancellazioni, mai dal ramo `test-preview`). 🆕 Il push diretto su `main` è **bloccato** |
| 🆕 promuovere su `test-preview` | **cherry-pick dei propri commit**, mai un merge del ramo di lavoro (vedi trappola ⑨) |
| banco gestionale | **il giro completo del § 1**, non `test/*.test.mjs` |
| banco bot | `npm test` + `npm run check` in `assistente-padel-agent` (serve `npm install`) |
| **provocare un esito ignoto** | `cancello-worker.yml` (repo bot): `chiudi` + parola `CHIUDI` + secondi (30-300). Riapre da sé in `always()`. ⚠️ Ferma il **sync di PROD**. ✅ Fallisce se la sonda non dà HTTP 000 |
| **aggiornare il bot** | `deploy-bot-hetzner.yml`: bersaglio `prova` o `soci` (serve la parola `SOCI`). Non tocca il `.env` |
| stato del bot | `stato-bot.yml`: sola lettura, con regex sul registro |
| 🆕 **guardare l'app viva** | `tools/verifica-browser`: `node console.mjs --env prod\|test --eval "…"`. ⚠️ **Serve `npm install` lì dentro** (il container non ha `node_modules`). Le `PMO_VERIFY_*` ci sono già |
| 🆕 **typecheck delle edge** | gira solo su PR o `workflow_dispatch`: `typecheck-edge-functions.yml` con l'input `function` |
| PR e Actions | **solo** `mcp__github__*`; `list_workflow_runs` sfora il contesto |
| DB | MCP Supabase — PROD `qqbfphyslczzkxoncgex`, TEST `cudiqnrrlbyqryrtaprd`, memoria bot `aylykijfirtegyxzdwgu` |
| 🆕 quando una migrazione è stata **applicata** | `select version, name from supabase_migrations.schema_migrations order by version desc` — non lo dice il commit |
| commit | 🆕 **mai `-m` con backtick**: heredoc con `-F -`. Costa un messaggio bucato su un ramo condiviso |
| conteggi lista | l'intestazione **e** la tabella riassuntiva. L'aritmetica di `guard-docs-truth` si rifà in locale copiando gli `awk` dal workflow, **prima** di spingere |
| 🆕 finestra 4bis | spingendo `docs/` prima su `test-preview`, `guard-docs-truth` e `guard-worker-sync` cadono **rosse là** finché `main` non atterra. È **atteso**: la guardia legge il documento dalla copia di `main` |

---

## 6. 🤝 Come si procede (invariato)

> *«Procediamo sempre come tu pensi sia corretto»* — copre anche le promozioni; il freno è la
> **dichiarazione**. Fuori: inventare voci non in lista, e l'irreversibile/visibile (si dice
> prima, anche procedendo). ✋ **Un task non è finito finché non è provato fisicamente.**
> 📌 E: **«scrivi troppo» — risposte corte.**

⭐ **Quello che le due sessioni hanno imparato a loro spese, ed è la stessa lezione due volte:**
la 60ª ha scritto «non si provoca» su un difetto che si provocava con uno strumento già esistente;
la 61ª ha scritto «1339 soci hanno ricevuto il link» contando i gettoni invece delle email.
⇒ **Una frase che spaventa o che rinuncia va misurata prima di scriverla**, perché nessuno la
ricontrolla: sembra prudente, e la prudenza non si rilegge.
