# Il test di livello — TUTTE le varianti, in una scheda sola

**Nata il 27/08/2026 su ordine del committente** — *«dobbiamo fare una scheda con tutte le
possibili varianti perché ci stiamo perdendo»* — la mattina dopo la notte delle tre cure giuste e
inerti, davanti al caso di Maurizio (in scheda **Avanzato**, test da **Avanzato**, e il bot lo
mandava dal maestro a certificare il livello che ha già).

📌 **Questa scheda è MISURATA, non ricordata**: ogni riga viene dal codice in servizio, e i posti
sono citati perché chi la aggiorna possa rimisurare invece di credere. Quando il codice cambia,
**questa scheda si corregge nella riga vecchia** — non si affianca.

---

## I tre fatti da cui nasce ogni variante

| fatto | valore | dove vive |
|---|---|---|
| **il tetto** | 3,5 (Intermedio) — sopra, il quiz non scrive: certifica il maestro | `TETTO_AUTOMATICO` in `giro-del-test.ts` (3 copie identiche byte per byte) |
| **la scala** | 7 fasce; al socio si dice **sempre la parola**, mai il numero (regola del 9/08) | `definizioneLivello` (edge) · `PMO_LIVELLI`/`pmoLivelloFascia` (`index.html`) |
| **il livello non scende mai DA SOLO** | decisione del 27/08. 🔄 Dalla sera del 27/08 c'è **una** strada in più, e passa dal socio: il **gradino** (sotto), che scende solo col suo tocco. A far scendere qualcuno senza che l'abbia chiesto resta la **segreteria** | `decidi` in `assessment-apply-level/index.ts` |

E le due parole che il gestionale manda al bot, che **non sono la stessa cosa**:
- `fascia` = quella **dichiarata** dal socio nel quiz;
- `livello_in_scheda` = quella che ha **adesso in anagrafica**.
Sotto il tetto quasi sempre coincidono; sopra, divergono — ed è dove si sono annidati i difetti.

⏱️ **L'attesa è ZERO** (sua decisione del 26/08, `ORE_SILENZIO_ASSENSO = 0`): se il socio non
tocca nessun bottone, l'esito si applica da sé al giro successivo del cron. I bottoni servono a
**scegliere**, non a sbloccare.

---

## Le varianti a quiz SUPERATO (`pass`)

`D` = livello **dimostrato** dal test (`calculated_level`) · `A` = livello **in scheda** ·
la fascia è la parola della scala.

| # | caso | cosa fa il bot | cosa si scrive in scheda | stato |
|---|---|---|---|---|
| **P1** | `A` assente (o 0,5) · `D` ≤ 3,5 | domanda: *«Il test dice **X**. Vuoi tenere questo livello o riprovare?»* + bottoni | `D`, al tocco su «Tengo» o da sé (attesa zero) | ✅ |
| **P2** | `A` assente · `D` > 3,5 | messaggio del **maestro** (niente bottoni) | **Intermedio** (3,5) — il resto lo dà il maestro | ✅ |
| **P3** | `A` < `D`, **fasce diverse**, `D` ≤ 3,5 (es. 2 → 3) | domanda + bottoni | `D` (rialzo) | ✅ |
| **P4** | `A` < `D`, **fasce diverse**, `D` > 3,5 (es. Base 2,5 → Agonista 5 — il caso di Laura) | messaggio del **maestro** | Intermedio se `A` < 3,5; **niente** se `A` ≥ 3,5 (non si scende al tetto) | ✅ |
| **P5** | `A` < `D` ma **STESSA fascia** (es. 4 → 4,5, tutti e due **Avanzato** — il caso di Maurizio) | ~~messaggio del maestro~~ → **domanda + bottoni** (cura del 27/08 mattina) | **niente**: la parola in scheda è già quella | 🔧 curata oggi |
| **P6** | `A` = `D` (es. 4 → 4) | domanda + bottoni | **niente** («il socio ha già questo livello») | ✅ |
| **P7** | `A` > `D` — **il test dice MENO** (es. Avanzato 4 → Intermedio 3) | esito senza domanda (*«Il tuo livello resta **Avanzato**»*) e ~~un bottone solo: riprova~~ → **TRE bottoni**: il gradino, «mi tengo il mio», «lo rifaccio» (sua regola del 27/08 sera) | **niente**, a meno che il socio tocchi il gradino: allora si scrive la fascia dimostrata | 🔧 curata il 27/08, allargata la sera |

**P5 — perché era sbagliata, con le parole del committente** (27/08 mattina): *«quando uno fa il
test e risulta lo stesso livello che già ha nella scheda di anagrafica, non c'è bisogno che si
chiami il maestro. Ci deve essere il bottone: tengo il mio livello oppure rifaccio il test.»*
Il confronto in servizio fino a stamattina era sui **numeri** (4,5 > 4 ⇒ maestro); ma il livello
di un socio è una **parola**, e 4 e 4,5 sono la stessa parola. Il maestro certifica un livello che
il socio **non ha**; qui il socio ce l'ha già. ⇒ `sopraIlTetto` ora esige anche **fascia dimostrata
diversa da quella in scheda** — e la lista «Da certificare dal maestro» nel gestionale
(`assessmentAspettaIlMaestro`) usa lo stesso criterio, quindi **Maurizio ne esce, Laura resta**.

**P7 — trovata scrivendo questa scheda, approvata da lui e CURATA lo stesso giorno.** A chi
dimostra **meno** di quello che ha, il bot offriva «✅ Tengo Intermedio» — cioè di *tenere* un
livello più basso che **non verrà mai scritto** (il livello non scende, sua regola del 27/08) — e
al tocco prometteva una registrazione mai esistita. ⇒ Dove nessuna risposta cambia la scheda non
c'è una scelta: il ponte manda il fatto (**`il_test_dice_meno`**, calcolato da `ilTestDiceMeno`
nel modulo del giro — il «meno» si misura in **parole**, come il «di più» di `sopraIlTetto`) e
spegne `puo_scegliere`; il bot dice l'esito e offre il bottone per riprovare. La **rete** copre i
bottoni vecchi rimasti in chat («il tuo livello resta **Avanzato**», nessuna promessa).
⛔ Ordine di messa in servizio rispettato: **prima il bot** (il campo che nessuno manda è inerte),
**poi il ponte** — al contrario, la domanda spenta con un bot vecchio sarebbe stata silenzio.

### 🚨 P0 — «Lo sto registrando: fra poco ti scrivo com'è andata», e poi PIÙ NIENTE

**Il difetto che ha attraversato tutte le varianti**, visto dal committente il 27/08 sul test di
Maurizio delle **10:12:51** e riprodotto **eseguendo il modulo del giro sulle sue schede vere**.

📏 I quattro fatti, tutti veri insieme: era la sua **terza prova del giro** ⇒ il giro si chiude ⇒
`puo_scegliere` **falso** (la regola vecchia pretendeva il giro *aperto*); in scheda **4** e
dimostrato **4,5** sono tutti e due «Avanzato» ⇒ né `aspetta_maestro` né `il_test_dice_meno`; e il
livello **non si scriverà mai** (il tetto taglia 4,5 a 3,5, che è meno di 4, e il livello non
scende) ⇒ `livello_applicato` resta falso **per sempre**.
⇒ `siPuoAnnunciareIlTest` chiude ogni porta: il socio legge *«fra poco ti scrivo com'è andata»* e
non riceve mai altro. **Non un messaggio monco: un silenzio eterno.**

⚖️ **Le tre cure del 27/08 mattina erano GIUSTE** — è proprio perché lo erano che non restava
nessuna porta aperta: ognuna spegneva correttamente il proprio caso, e nessuna accendeva il
messaggio che restava da dire.
🔨 **Cura**: `puo_scegliere` non conta più le prove del giro (e `consumer-assessment-decision`
smette di rifiutare `GIRO_FINITO` — *le due metà si cambiano insieme, o il bot mostra bottoni che
il ponte rifiuta*). La ragione della regola vecchia — *«alla terza non c'è una quarta a cui
rimandare»* — era **scaduta** dal 25/08, quando l'attesa fra i giri è andata a **zero**: la quarta
prova esiste. È la stessa scadenza già riconosciuta due volte (il conteggio delle prove, la frase
«ti resta una prova»), al terzo posto in cui viveva.
📌 *Una regola che protegge da una conseguenza che non esiste più non protegge: vieta.*
🔒 Restano in piedi i rifiuti che poggiano su un **fatto**: `SCHEDA_SUPERATA`, `GIA_APPLICATA`,
`PROVA_NON_PASSATA`. Quelli non scadono.

### ⭐⭐ IL GRADINO — la terza risposta (sua regola, 27/08 sera)

🗣️ *«attenzione perché non dobbiamo ferire l'orgoglio del giocatore. Possiamo proporgli di
scendere di un gradino o se no di rimanere a livello dell'ultimo test fatto, oppure di rifare
il test.»*

📏 **Il caso da cui nasce** (Fabiola Limuti, 27/08 ore 16:17, misurato sulla sua scheda): in
scheda **Base**, dichiara **Principiante**, quiz **senza cancello** (0 domande su 0), esito
`pass` ⇒ **P7**. Sotto l'esito c'era **un bottone solo** — «Sì, lo rifaccio» — e rifarlo
ridichiarando Principiante avrebbe dato lo stesso risultato per sempre. *L'unica uscita portava
dove il socio era già.*

⭐ **La regola, in una riga: il gradino è la fascia più alta che il test non smentisce.**

| la prova | il gradino offerto | perché |
|---|---|---|
| **passata**, ma dice meno (P7) | la fascia **dimostrata** | il test l'ha detta: è un dato, non una deduzione |
| **bocciata** (F1) | la fascia **sotto quella dichiarata** | il cancello smentisce la dichiarata e non dice altro |

🔒 **Quando NON si offre niente** (`gradinoOfferto` torna `''` e restano i due bottoni di
sempre): la fascia offerta è uguale a quella in scheda (non c'è una scelta), o è **più alta**
(una bocciatura non promuove nessuno), o la prova è uno `skip`.
⚖️ **L'unica eccezione al «mai più alta» è `0.5`**, che non è un livello ma il «da definire»
delle schede nuove — **2.281 soci su 2.817, l'81%**. Per loro il gradino è il primo livello
vero: il numero sale (0,5 → 1,5) restando nella **stessa parola**.
⇒ **Ed è per questo che il bottone non dice mai «scendo»**: dice la parola («✅ Va bene:
Principiante»). Scrivere «scendi» sarebbe **falso** per i due terzi del circolo.

📏 **Il numero che rende la cosa urgente**, misurato il 27/08 su tutte le schede col cancello:
`pass` **19 → 4 livelli scritti**; `fail` **6 → ZERO**. Chi sbaglia il cancello non prende un
livello più basso: **non ne prende nessuno**, e resta a 0,5, cioè fuori dalle partite.

🚨 **Cosa si apre e cosa resta chiuso.** In `decidi()` (`assessment-apply-level`) il gradino è
una **strada a parte**, non tre `if` dentro quella di sempre: la catena normale è fatta di
protezioni contro chi si **sopravvaluta** (cancello, coerenza, scarto dichiarato/calcolato,
tetto), e nessuna riguarda chi chiede di **scendere**. Infilarci deroghe avrebbe indebolito la
salita per servire la discesa.
· **restano chiuse**: scheda in mano alla segreteria, già applicata, dal link generico, socio
  inesistente, scheda più vecchia dell'ultimo aggiornamento del livello, livello già uguale;
· **non si applica il TETTO**: tagliare a Intermedio una discesa scriverebbe un livello **più
  basso** di quello che il socio ha chiesto;
· 🔒 **nessun silenzio-assenso**: senza il tocco questo ramo non esiste.

⛔ **Ordine di messa in servizio** (l'opposto di P7, e va saputo): qui il bot **manda** una
parola nuova al gestionale, non la riceve. `consumer-assessment-decision` rifiuta con **400**
qualunque scelta che non conosce ⇒ **prima il gestionale, poi il bot**. Al contrario il socio
tocca il bottone e si prende un errore.

🩹 **E nello stesso giro: «superato» non si dice più su un test senza cancello.** 0 domande su 0
non sono una prova passata — si dice che il test è **arrivato**. L'estremo **alto** della scala
questa frase ce l'ha da sempre (S1, ramo `skip`); mancava all'estremo **basso**.

✅🗣️ **CHIUSO la sera stessa: le domande di Principiante sono state SBLOCCATE.** Sua decisione
— *«direi di sbloccare le domande della banca per principiante»* — presa mezz'ora dopo il
gradino. Le **36** domande di quella fascia (9 trabocchetto) erano nella banca dal 25/08 e non
venivano pescate mai.

🚨⭐⭐ **Ma il cancello di Principiante NON SBARRA** (`pass_min_correct: 0`), ed è l'unica forma
possibile — sue parole: *«un principiante mi può sbagliare quattro risposte su cinque»*.
⚖️ Non è una soglia timida: `Principiante` va da **0,5 a 1,5**, quindi sotto non c'è nessuna
fascia dove mandare un bocciato, e il gradino su una bocciatura offre proprio *la fascia sotto
la dichiarata*. Bocciare lì lascerebbe il socio **senza niente** — cioè fuori dalle partite, ed
è il caso dei 2.281 fermi a 0,5.
⇒ **Cosa cambia davvero**: il test di quella fascia esiste (13 domande, non 8), «superato»
torna a essere una parola vera invece che detta su zero domande, e allo staff arriva un
conteggio dove prima non c'era niente.

📏 **E una premessa da correggere, misurata prima di rispondergli.** Lui l'ha chiesto perché
*«senò nessuno può prenderlo»*, il livello Principiante. In effetti delle **3** schede senza
cancello di sempre **zero** hanno scritto un livello — ma la causa non era il cancello mancante:
Fabiola 19/08 era ferma in `review` dalla segreteria; Laura 26/08 aveva detto «mi fermo» ed è
stata fermata da *«il livello non scende»* (ha 2,5 in scheda); Fabiola 27/08 è il caso che il
**gradino** ha appena aperto. ⇒ Per chi sta a 0,5 il Principiante **si prendeva già** senza
quiz: accendere il cancello non lo rende più raggiungibile, e con una soglia >0 lo renderebbe
**meno**. Sbloccarlo serve a rendere il test **vero**, non a sbloccare un livello.

⚠️ **Quello che resta da fare, e va detto**: le 36 domande di Principiante **non sono ancora
state rilette dal committente** — la nota del 25/08 le teneva spente apposta *«finché non
saranno corrette da lui»*. Con la soglia a zero il rischio non è più un livello negato ma una
domanda poco chiara **letta dai soci**: se una risulta ambigua si corregge, e nessuna scheda
già consegnata cambia esito, perché nessuna può fallire.
---

## Le varianti a quiz NON superato e senza quiz

| # | caso | cosa fa il bot | si scrive | stato |
|---|---|---|---|---|
| **F1** | `fail` (incongruenza fra risposte e dichiarato) | *«è rimasta un'incongruenza, il livello non l'ho registrato»* + **TRE bottoni** (il gradino, «👍 Mi tengo il mio livello», «🔄») | niente, a meno che tocchi il gradino: allora si scrive la **fascia sotto quella dichiarata** | 🔧 allargata il 27/08 sera |
| **S1** | `skip` con fascia (dichiara Semi-Pro/Professionista: il quiz non c'è) | *«per il livello che hai dichiarato non c'è un quiz: una scheda come la tua la guarda il maestro»* | niente | ✅ |
| **S2** | `skip` senza fascia (guasto: il livello non si è letto) | frase neutra, **senza** nominare il maestro | niente | ✅ |

---

## Dopo il tocco su «✅ Tengo …» — cosa risponde il bot

| variante | risposta | vera? |
|---|---|---|
| P1/P3 (il livello si scrive) | *«Perfetto: tengo **X** 👍 Te lo registro sulla scheda a breve.»* | ✅ |
| P4 (bottone vecchio rimasto in chat: sopra il tetto non c'è scelta) | *«In scheda per adesso resta **X**. Sopra Intermedio… te lo certifica il maestro»* | ✅ (rete del 27/08 notte) |
| P5/P6 (la parola è già in scheda: non si scrive niente) | oggi *«te lo registro a breve»* → 🔧 cura: *«Perfetto: tengo **X** 👍 In scheda hai già questo livello.»* | 🔧 curata oggi (bot) |
| P7 (bottone vecchio in chat) | *«Il tuo livello resta **Avanzato**. Un test il livello non lo abbassa mai.»* | 🔧 curata il 27/08 (rete) |
| **il GRADINO** (`scendo`, da P7 o da F1) | *«Va bene 👍 Il tuo livello adesso è **Principiante**. Te l'ho registrato sulla scheda.»* | ✅ 27/08 sera — «l'ho registrato» e non «lo registro»: il ponte lancia il giro nello stesso istante |
| F1, tocco su «👍 Mi tengo il mio livello» | *«il livello che hai adesso in scheda resta quello»* | ✅ |

⚠️ **La cura P5/P6 del bot confronta le due PAROLE che il gestionale gli manda** (`fascia` e
`livello_in_scheda`): quando coincidono, la frase non promette né una scrittura né la sua assenza —
dice il fatto («in scheda hai già questo livello»), che è vero in tutti e due i sotto-casi (3 → 3,5
scrive il numero ma la parola non cambia; 4 → 4,5 non scrive proprio). Il bot non decide niente:
mostra due dati che ha già.

---

## 🔎 La rilettura del 27/08 — i difetti ancora APERTI

Ordinata dal committente (*«rivedere tutte le regole una a una per capire se ci sono ancora
difetti o mancanze»*) e fatta leggendo **tutta** la catena: quiz → calcolo → giro → tetto →
scrittura → i due ponti → i messaggi del bot. Ogni voce qui sotto è **misurata**, non dedotta.
⛔ Nessuna è ancora curata: la P0 qui sopra è l'unica uscita da questa rilettura ed è già in
servizio.

### 🔴 Gravi

**R1 — Il ponte promette scritture che `decidi()` non farà.** `puo_scegliere` guarda l'esito del
quiz e la scelta; ma la scrittura del livello ha **altre sette porte** che il ponte non conosce
(`staff_status` non vuoto, `experience_flag`, `consistency_status = low`, scarto
dichiarato/calcolato > 0,5, socio non agganciato, scheda più vecchia dell'ultimo aggiornamento).
⇒ Il bot chiede «tieni o riprovi?», il socio dice «tengo», il bot risponde *«te lo registro sulla
scheda a breve»* e **non succede mai niente**.
📏 Già successo: **Laura, 26/08 21:25** (coerenza `low` + `review`). E in generale, delle **16**
schede col quiz superato degli ultimi 120 giorni, **12 non hanno mai scritto un livello**.
💡 La forma della cura è quella già usata due volte oggi: il gestionale dice al bot **se il livello
cambierà**, invece di lasciarglielo supporre.

**R2 — Chi dichiara Semi-Pro o Professionista viene mandato dal maestro, e in Anagrafica non
c'è.** Per quelle due fasce il quiz non esiste ⇒ esito `skip` ⇒ il bot dice *«una scheda come la
tua la guarda il maestro»*. Ma `assessmentAspettaIlMaestro` scarta tutto ciò che non è `pass`
(`if (quiz && quiz !== 'pass') return null`) ⇒ **non compaiono nella lista «Da certificare»**.
È esattamente il difetto della voce 98, in un ramo che nessuno aveva guardato.
📏 Oggi non è ancora capitato: **zero** schede `skip` in tutta la storia. È un buco strutturale,
non un incendio.

**R3 — L'anteprima dello staff regala le risposte giuste.** `assessment-quiz`, azione
`staff-valuta`: il **seme** lo sceglie chi chiama, e `pescaPerGettone` usa il gettone come seme
⇒ passando il gettone di un socio si ottengono **le sue quattro domande con la risposta esatta**.
E `staffValido` controlla solo che ci sia *un* utente Supabase dietro al JWT, non che sia staff.
⚖️ È l'oracolo che il commento accanto dichiara di voler evitare.

### 🟠 Da sistemare

**R4 — Il livello applicato si DEDUCE invece di leggerlo.** Il ponte confronta due date con 60″ di
tolleranza, mentre `applied_at` sta **nella stessa tabella** e non viene letto. È la forma esatta
della select monca del 27/08 notte, un campo più in là.

**R5 — «Riprovo» ha 15 minuti di tempo, e nessuno lo dice.** Il cron applica ogni 15′ e la
consegna del quiz lancia un giro **subito**; dopo, la scelta cade su `GIA_APPLICATA`. 📏 I soci
decidono in 16-56 secondi, quindi oggi passa — ma è una corsa, non una regola.

**R6 — Il promemoria gentile può chiedere di rifare il test a chi l'ha appena fatto.** Esclude chi
ha un livello e chi ha una scheda recente, ma non chi è fermo su una porta di `decidi()`: dopo 15
giorni quel socio si sente chiedere di rifare la cosa che ha già fatto.

**R7 — Due frasi gemelle del maestro, già divergenti.** Scritte a mano in `avvisi-testi.ts` e in
`scelta-livello.ts`: la prima porta il numero della segreteria fra parentesi, la seconda no —
mentre il commento dichiara di averle allineate «due punti compresi».

**R8 — «da oggi, domani».** Con l'attesa a zero, `giorniMancanti = 0` produce ancora la parola
«domani»: una frase che si contraddice dentro sé stessa. Ramo oggi irraggiungibile, ma vivo.

### 🟡 Da sapere (nessun danno oggi)

- **R9** — i giri si ricostruiscono su un elenco tagliato a **20** schede: oltre quella soglia i
  confini dei giri slittano in silenzio. Il record attuale è 12 (Maurizio).
- **R10** — con `GIORNI_DI_ATTESA = 0` tutto il ramo «attesa» del ponte è **irraggiungibile**:
  `riprova_dal`, `giorni_mancanti`, `motivo_attesa`, `scelta_entro` sono campi che non escono più.
- **R11** — **quindici colonne** di `self_assessments` restano sempre `null` (leggono chiavi che
  nessuno manda); `phone` idem; il consenso privacy non si scrive, e nel test dentro Telegram non
  viene mai chiesto.
- **R12** — la domanda «quante volte giochi al mese» (`frequency`) è un **dato morto**: non pesa
  nel calcolo, non finisce in colonna, non entra in nessuna regola.
- **R13** — `balancedLevel` pesa 0,25 nel livello calcolato ma **non entra** nel giudizio di
  coerenza, che è proprio la cosa per cui quella domanda esiste.

---

## Dove si misura, quando questa scheda sembra vecchia

- la regola del maestro: `sopraIlTetto` in `supabase/functions/*/giro-del-test.ts` (3 copie) e la
  gemella `assessmentAspettaIlMaestro` in `index.html` — banchi
  `test/consumer-assessment-link.test.mjs` (casi M) e `test/lista-per-il-maestro.test.mjs`;
- cosa si scrive: `decidi` in `assessment-apply-level/index.ts` — banco
  `test/assessment-apply-level.test.mjs`;
- cosa dice il bot: `avvisi-testi.ts` (`testoEsitoTest`), `scelta-livello.ts`
  (`testoDomandaScelta`, `testoSceltaRegistrata`) nel repo del bot;
- chi decide se la domanda esiste: `puo_scegliere` e `aspetta_maestro` in
  `consumer-assessment-link/index.ts` — **è sempre il gestionale**; il bot non ha soglie;
- il **gradino**: `gradinoOfferto` (con `fasciaSotto` e `livelloDellaFascia`) in
  `giro-del-test.ts` — banchi `test/consumer-assessment-link.test.mjs` (casi G) e
  `test/assessment-apply-level.test.mjs` (casi 42-50); il bottone e le frasi in
  `scelta-livello.ts` / `avvisi-testi.ts` del repo del bot, banco `test/scelta-livello.test.ts`.
