# Passaggio di consegne — 29/08/2026, notte (fine 59ª sessione)

**Come si usa:** incollalo come primo messaggio della chat nuova. È scritto per essere capito
**senza** la conversazione precedente.

⚠️ Sessione corta e densa: **due voci nuove** (108 e 109), **una promozione a PROD** (v6.257),
**due migrazioni** applicate ai due database, e **due mie conclusioni corrette** dopo che la misura
le ha smentite. Quattro PR: #1185, #1186, #1187, #1188, #1189.

---

## 🔴 LEGGI PRIMA QUESTO — LA COSA DA CAPIRE DOMANI

> **67 spinte al cloud su 411, dal 15 al 29 agosto, hanno scritto ZERO record — e non si sa
> perché.** Una su sei.

📏 La sonda, che si può rifare in dieci secondi:
```sql
select date_trunc('day', created_at)::date as giorno,
       count(*) filter (where (detail->>'count')::int = 0) as a_vuoto,
       count(*) as totali
from pmo_audit_log
where action='cloud_records_upsert' and created_at >= '2026-08-15'
group by 1 order by 1 desc;
```

🚨⭐⭐ **E QUI STA LA COSA DA NON RIPETERE: ieri sera ho DICHIARATO di aver trovato la causa, e
non l'avevo trovata.** Avevo scoperto che la RPC scartava il tipo `payment` (vero, voce 109), ho
visto un altro zero che tornava, e **ho unito le due cose senza verificarle**. La correzione è
nella scheda della 109 e nel commit `76bc8d9`.
⇒ Quello che **è** stabilito: la RPC risponde `ok: true` con `count: 0` quando scarta tutti i
record del lotto; scarta un record se `record_type` è nullo, se `local_key` è nulla, o se il tipo
non è nella sua whitelist.
⛔ Quello che **NON** è stabilito: **quali** record componessero quelle 67. Il registro
`pmo_audit_log` annota il **conteggio**, non i tipi ⇒ da lì la domanda non si può chiudere.

🔎 **Le due piste, dichiarate come piste:**
① **`local_key` vuota.** L'app costruisce decine di record `staff_booking` con
  `local_key: b.id` / `entry.id` (righe ~39579, 39645, 39674, 41636, 44641, 44694, 44702, 44793,
  45030, 45035 di `index.html`). Se quell'`id` è vuoto o `undefined`, il record sparisce in
  silenzio. **Non l'ho verificato.**
② **Un altro tipo fuori whitelist.** Oggi l'app ne spinge sei (`staff_booking`, `payment`,
  `member`, `app_setting`, `staff_suppress`, `booking_occupancy`, `booking`) e dopo la 109 sono
  tutti ammessi — ma il conto delle 67 è **precedente** alla cura, e in quella finestra `payment`
  era escluso.

⭐ **La strada che secondo me paga**: da stasera una spinta a vuoto **lancia** (voce 108) e chi la
chiama mostra un avviso. ⇒ Invece di cercarle nel passato, si guarda se ne succede una **nuova**:
se domani la segreteria vede un avviso giallo, quello è il caso vivo col suo contesto.
⚠️ Ma attenzione, ed è misurato: **non tutte le strade lo mostrerebbero** — `_pmoGiftSyncFromRoster`
si chiude con `catch (e) { return 0; }` e inghiottirebbe tutto. Prima di aspettarsi un avviso, si
guarda **chi chiama** quella spinta.

📕 `docs/lavori/README.md` si apre **PRIMA di lavorare** — obbligo di casa, e le voci 108 e 109
stanno lì con le schede intere.

---

## 1. ✅ Prima di lavorare

```
git fetch origin main test-preview
git diff origin/main origin/test-preview -- CLAUDE.md docs/ .github/workflows/ \
  tools/matchpoint-browser-worker/src/server.mjs
```
✅ **Dev'essere vuoto, e alla chiusura lo era.**

🆕 Se serve il bot: `PadelVillage/assistente-padel-agent` (→ `add_repo`, **una sola** clonazione con
timeout generoso). Stasera l'ho clonato: sha `b78954d`, che è anche quello in servizio sulla VM.

### 🟢 Stato misurato a fine sessione (non ricordato)

| dove | stato |
|---|---|
| **gestionale** | `main` **6.257** · `test-preview` **6.261** · PROD **serve 6.257** (verificato sull'app viva) |
| **bot** | `assistente-telegram-prova` online, dichiara `cudi…` (TEST). Il bot dei soci non l'ho toccato |
| **anagrafica PROD** | **2817** soci vivi · doppioni **0** · con `lastLevelUpdateAt` **20** |
| banco | `test/*.test.mjs` **65 verdi, 0 rosse** · sintassi 5 blocchi 0 errori |
| lista | 🔴 urgenti **8** · 📋 in coda **11** · 📦 chiuse **86** |
| spinte a vuoto | **67 su 411** dal 15/08 — **senza spiegazione** |

---

## 2. 🔨 COSA È STATO FATTO

### 🆕 Voce 108 — un salvataggio di scheda socio non può più sparire in silenzio (PROD v6.257)

🗣️ **Nasce da un caso suo**: aveva cambiato il livello di Maurizio Aprea da **4 a 3,5 e poi a 4**,
e **nessuna delle due** è arrivata al cloud. Lo schermo diceva «salvato» tutte e due le volte.

📏 **Misurato su PROD, non dedotto**: in tutto il 29/08 l'unica scrittura di un record `member` è
stata il sync clienti delle 19:30 ⇒ **zero** soci su 2817 con `payload.updatedAt` di quel giorno,
mentre la serie è continua dal 16 al 28 agosto.

🚨⭐⭐ **Il ramo che ha mangiato quei due salvataggi NON SI È POTUTO NOMINARE**, e questo ha deciso
la forma della cura: le 67 spinte a vuoto lasciano almeno la loro riga di audit, quelle due
**nemmeno quella**; e su un browser pulito la catena funziona (verificato sull'app viva con la
console remota). ⇒ Curare i rami noti avrebbe lasciato scoperto proprio questo caso.
📌 *Una perdita silenziosa non si cura indovinando il ramo: si cura rendendola rumorosa.*

⚙️ **Tre cure:**
① **il conteggio** — una spinta che scrive zero record **fallisce**. Il confronto è con lo **zero**
   e non con `list.length`, perché la RPC fonde legittimamente i `member` che finiscono sulla
   stessa riga viva (`distinct on (local_key)`);
② **la traccia** — ogni modifica al socio lascia un segno in `localStorage` scritto **prima** di
   spingere e cancellato **solo** alla conferma, detto **all'avvio** se resta.
   ⛔ Non rispinge da sola: sarebbe il danno della voce 105 con un altro nome;
③ **l'ordine** — la spinta sta subito dopo `save('giocatori', …)`, non più in fondo a
   `closeMemberCard()` + `updateStats()` che non sono protette da niente, e nel pannello soci del
   calendario non è più dentro un `catch (e) {}` **nudo**.

✅ **PROVA FISICA COMPLETA, le due metà, nessuna dedotta:**
· il **fallimento tiene il segno** — sull'app viva di TEST con l'utenza `readonly` della console
  (niente `cloud_sync`) la spinta è stata **rifiutata davvero** e la traccia è rimasta;
· il **successo lo toglie** — salvataggio vero della segreteria, e al ricaricamento nessun avviso.

⏱️ **E la catena fino al socio, cronometrata sul registro del bot:**

| istante (Roma) | fatto |
|---|---|
| 21:00:31 | il bot: *«Sei un livello **Avanzato**»* |
| 21:01:17,511 | la segreteria salva **5** su TEST |
| 21:01:18,095 | la riga atterra nel cloud — **584 ms** (audit `count: 1`) |
| 21:01:49 | il bot: *«Sei un livello **Agonista**»* |

📌 Fra gestionale e bot non c'è **nessun sync e nessun cron**: il ponte legge `pmo_cloud_records`
diretto, e il bot tiene la scheda **8 secondi**.

🔓 **RESTA APERTA**, e la ragione è scritta: il gesto vero è stato fatto su **TEST**. Su PROD la
cura è **servita ed esercitata** (verificata dentro la pagina), ma **nessun salvataggio vero ci è
ancora passato**. È la forma della **65**: *curata e in servizio, si aspetta il caso.*

### 🆕 Voce 109 — la RPC non conosceva i pagamenti (migrazione applicata ai due database)

📏 **Una deriva fra due liste**, misurata sui sorgenti e sul database vivo:

| | dove | quanti |
|---|---|---|
| ① | il vincolo della **tabella** (`pmo_cloud_records_type_check`) | **22** |
| ② | la lista **dentro** `pmo_upsert_records_admin` | **15** |

I sette che stanno solo nella prima — `payment`, `wallet_txn`, `wallet_balance`,
`assessment_email`, `booking_job`, `staff_edit`, `staff_cancel` — la seconda li **scartava in
silenzio**. La migrazione che ha aggiunto `payment` alla tabella è del **27/06/2026** e si chiama
proprio *«payments»*.

⚙️ **Cura: solo `payment`, e la larghezza l'ha decisa lui** davanti a tre strade. `wallet_txn` e
`wallet_balance` riguardano soldi e l'app non li spinge mai.
📌 *Una lista di permessi si allarga su un bisogno misurato, non per simmetria.*
⚠️ **Da adesso un browser con `cloud_sync` può scrivere righe `payment`**: stessa soglia di soci e
prenotazioni, ma è un potere in più e va saputo.

✅ Applicata su **tutt'e due** i progetti e verificata sulla firma giusta: l'app chiama
`pmo_upsert_records_admin(jsonb)` — l'altra, `(text, jsonb)`, è la vecchia col PIN e non la usa
nessuno. Sulla curata: `payment` presente, la cura della **105** intatta, `cloud_sync` richiesto.

🔒 **Guardia nuova** (`test/i-tipi-che-lapp-scrive.test.mjs`, 6 verdi, vista rossa con due
sabotaggi). ⭐ La forma è la cosa da non perdere: **non** pretende che le due liste siano uguali —
non devono esserlo, e imporlo darebbe al browser i permessi che si è appena deciso di non dargli.
Pretende che **ogni tipo che l'app spinge davvero** stia in tutt'e due, cioè che nessuno cada nella
**fessura** fra loro. Le liste le legge dalla migrazione **più recente**, non da un nome di file.

🩹🚨 **DUE MIE CONCLUSIONI SU QUESTA VOCE ERANO FALSE E SONO STATE CORRETTE** (vedi trappola ①).

### ⭐ Il PUNTO D ha fatto il suo primo giro vero

`lastLevelUpdateAt` di Maurizio su TEST è passato dal **2 maggio** a **29/08 21:01:17** e poi a
**21:22:15** al ripristino. È la prima volta che una mano della segreteria sul livello **lascia la
sua data** — la cura del 29/08 pomeriggio che gira su un gesto vero e non su un banco.
⚖️ Anche il **ribasso a mano** (5 → 4) l'ha marcato, ed è giusto: *il livello non scende mai da
solo* vale per la macchina, non per la mano della segreteria.

---

## 3. 🧠 LE TRAPPOLE DI OGGI

**① 🚨⭐⭐ UNO ZERO CHE TI DÀ RAGIONE È UNA CONCLUSIONE, NON UNA MISURA — e stavolta a non
guardarlo è stato chi quella regola la stava citando.** Ho trovato `source='pmo_gift'` → **0** e
l'ho letto *«ogni omaggio è andato perduto»*. La lettura giusta costava **una** domanda — *esistono
pagamenti a 0 €?* — e la risposta è **no**: su 3014 pagamenti in tre mesi ci sono tre metodi
(`card`, `cash`, `wallet`) e nessuna riga a zero. ⇒ Quello zero era un **non uso**, non una
perdita. E con lui è caduta la frase più grossa: *«la 109 è la causa delle 67»*.
📌 *Due zeri della stessa forma: ne ho interrogato uno solo, e proprio quello che mi conveniva.*

**② 🩹 UNA PROVA SU UN VALORE TRADOTTO VA DISEGNATA SULLA TRADUZIONE.** Il bot **non dice il
numero**, dice la parola della tabella (`≤3,5 Intermedio · ≤4,5 Avanzato · ≤5,5 Agonista`).
⇒ Provare con **4 → 4,5** avrebbe dato «Avanzato» prima e dopo: verde, mostrando il nulla. Il
cambio è stato scelto **perché scavalca una fascia**. Me ne sono accorto disegnando la prova, non
dopo — ma di un soffio.

**③ ⚠️ UN REGISTRO CHE ANNOTA IL RISULTATO E NON L'OGGETTO NON PUÒ CHIUDERE UNA DIAGNOSI.**
`pmo_audit_log` scrive `{count: N}` e basta ⇒ le 67 spinte a vuoto non si possono attribuire a
nessun tipo. È il motivo per cui la domanda resta aperta, e vale come disegno: *chi scrive una
diagnostica scelga cosa servirà a chi la leggerà tra un mese.*

**④ 🔧 CORREGGERE UNA RIGA NON BASTA: BISOGNA GUARDARE SE SE N'È CREATA UN'ALTRA.** Modificando la
scheda della 108 ho lasciato **gli stessi due punti scritti due volte** con parole diverse, nello
stesso paragrafo — esattamente ciò che il `CLAUDE.md` vieta. L'ho visto solo perché un `assert` di
un mio script è fallito.

**⑤ 🔧 IL BANCO CHE LEGGE IL SORGENTE DEVE LEGGERE IL *CODICE*.** Due prove testuali sono nate
rosse perché cercavano `closeMemberCard()` **coi commenti dentro** — e i commenti della cura
nominano quella funzione per spiegare da dove è stata spostata. Il banco stava misurando la mia
prosa.

**⑥ 🔧 `list_workflow_runs` SFORA IL TETTO DI CONTESTO** (resta vero): si salva su file e si legge
con `python3`. E i `curl` verso `api.github.com` dalla shell **non sono autorizzati**: solo
`mcp__github__*`.

---

## 4. ⏳ COSA RESTA

**Le 8 urgenti**: 109, 108, 105, 97, 92, 84, 83, 65. La lista canonica è `docs/lavori/README.md`.

| # | cosa manca | chi |
|---|---|---|
| **109** | un **omaggio** vero: si segna **su Matchpoint** (giocatore *riscosso* a **0 €** sulla ficha), non nel gestionale. ⛔ **Non si provoca** — toccherebbe la contabilità del circolo per esercitare una riga | si aspetta |
| **108** | un salvataggio di scheda socio **su PROD** che non lasci avvisi | arriva da sé |
| **105** | il giro intero dall'app: la segreteria salva e la riga atterra | **lui** |
| **97** | un giro del test intero dal telefono | **lui** |
| **92** | un gesto della segreteria che attraversa un riavvio del bot | si aspetta |
| **84** | la prova col difetto vero davanti | **lui** |
| **83** | un worker oltre i 150 s: non si provoca, si guarda | si aspetta |
| **65** | curata e in servizio: si aspetta il caso | si aspetta |

**Altro, non urgente:**
- 🚨 **Le 67 spinte a vuoto** — in cima a questo documento, ed è la cosa che vale di più.
- **`supabase/migrations/` diverge fra i rami**: **8 file**, nessuna guardia lo sorveglia. Non è
  pericoloso di per sé (le migrazioni si applicano a mano), ma vuol dire che **da git non si legge
  con certezza cosa è applicato dove** — ed è la stessa forma del difetto della 109. ⛔ **Non ne ho
  fatto una voce**: non nasce da una misura mia né da una sua parola. Se domani la si vuole, la
  prima cosa è misurarla.
- **`pmo_upsert_records_admin(text, jsonb)`**, la vecchia firma col PIN, è ancora viva e nessuno la
  usa. Non toccata.

🩹 **Le sonde che devono tornare come indicato:**
```sql
-- doppioni: deve tornare VUOTA (alla chiusura: vuota)
select payload->>'id', count(*) from pmo_cloud_records
where record_type='member' and deleted is not true group by 1 having count(*) > 1;

-- omaggi scritti dall'app: oggi 0, il giorno del primo omaggio vero deve diventare 1
select count(*) from pmo_cloud_records
where record_type='payment' and payload->>'source'='pmo_gift';
```

---

## 5. 🧰 Attrezzi

| | |
|---|---|
| ordine push | prima `test-preview`, poi PR a `main` (≤15 file, mai dal ramo `test-preview`) |
| promozione app | ramo da `origin/main` + `git show <sha> -- index.html \| git apply --3way`, risolvere **solo** `APP_VERSION`. ⭐ Stasera ha funzionato alla lettera: conflitto solo lì |
| rispecchio docs | `git checkout test-preview -- docs/` da un ramo basato su `main`. ⚠️ **Controllare `git branch --show-current` PRIMA di committare** |
| console remota | `node console.mjs --env test\|prod --file x.js` in `tools/verifica-browser` (serve `npm install`). ⭐ Con l'utenza `readonly` una spinta al cloud **fallisce davvero**: è il modo di provare il ramo del fallimento senza stub |
| 🆕 stato del bot | `stato-bot.yml` nel repo del bot: **sola lettura**, con regex sul registro. ⭐ Ha portato il «prima» e il «dopo» della prova del livello senza chiedere niente a nessuno |
| PR e Actions | **solo** `mcp__github__*`; `list_workflow_runs` sfora il contesto → salvare su file e leggere con `python3` |
| DB | MCP Supabase — PROD `qqbfphyslczzkxoncgex`, TEST `cudiqnrrlbyqryrtaprd`, memoria/whitelist `aylykijfirtegyxzdwgu` |
| commit | mai backtick in `-m`: heredoc con `-F -` |
| conteggi lista | l'intestazione **e** la tabella riassuntiva: `guard-docs-truth` confronta tutt'e due |

---

## 6. 🤝 Come si procede (invariato)

> *«Procediamo sempre come tu pensi sia corretto»* — copre anche le promozioni; il freno è la
> **dichiarazione**. Fuori: inventare voci non in lista, e l'irreversibile/visibile (si dice
> prima, anche procedendo). ✋ **Un task non è finito finché non è provato fisicamente.**
> 📌 E: **«scrivi troppo» — risposte corte.**

⭐ **Una cosa che questa sessione ha imparato a sue spese e che vale per la prossima:** la delega
dice *procedi*, non *concludi*. Stasera ho **dichiarato una causa che non avevo verificato**, e a
smontarla è stata una sua domanda («come faccio a registrare un omaggio?»), non un mio controllo.
⇒ Una cura si può mettere in servizio su una misura; una **spiegazione** no — quella o è misurata
o si dice *«non lo so ancora»*, che è la stessa regola che diamo al bot.
