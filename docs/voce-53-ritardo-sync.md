# Voce 53 — il RITARDO del sync delle prenotazioni, misurato

**Misura del 16/08/2026, 28ª sessione, su PROD (`qqbfphyslczzkxoncgex`). Eseguita, non ricordata.**

È il numero che la voce 53 dichiarava mancante: *«quanto il bot deve aspettare prima di poter dire
"no" senza sbagliare»*. Fino a oggi non l'aveva misurato nessuno.

---

## 1. La risposta in una riga

> **Nell'assetto di oggi, una prenotazione atterrata su Matchpoint compare nella copia del
> gestionale in ~2 minuti di mediana e al massimo misurato in 10 minuti e 4 secondi.**
> Il massimo su **43 creazioni** dal 28/07/2026 (l'assetto attuale del sync) è **604 s** per la
> riga che porta il nome del socio, **432 s** per lo slot.

⚠️ **Ma il numero da solo non basta a decidere l'attesa, e questo è il reperto che vale di più
della misura**: il sync **passa dal worker**. Vedi §4 — la premessa scritta nella voce era falsa.

---

## 2. Come è stata presa la misura

**L'orologio di partenza**: `pmo_cloud_records / booking_job`. Ogni scrittura verso Matchpoint
lascia una riga: `created_at` = quando il gestionale ha mandato la richiesta, `updated_at` =
quando il worker ha risposto, `payload.worker_result.idReserva` = **il numero che Matchpoint ha
assegnato alla prenotazione**. Quel numero è la chiave che lega le due sponde.

**L'orologio d'arrivo**: `created_at` della prima riga `booking` / `booking_occupancy` che porta
quello stesso `idReserva` nella `local_key`. La colonna ha `default now()` e l'upsert del sync
**non la tocca** (scrive solo `payload`, `deleted`, `synced_at`) ⇒ `created_at` è l'istante in cui
quella riga è comparsa per la prima volta, che è esattamente ciò che si vuole sapere.

**Il perimetro**: 196 `booking_job` dal 10/06/2026, di cui **175 con `idReserva`** (tutti
`create_booking`). Di questi **127 hanno una riga corrispondente**, **0 ce l'avevano già prima**
(nessuna contaminazione da modifiche su prenotazioni esistenti) e **48 non compaiono mai** — i 48
sono spiegati uno per uno in §5, e la spiegazione è parte della misura, non un residuo.

---

## 3. I numeri

### 3.1 Lo SLOT (`booking_occupancy`, chiave = slot) — dall'istante in cui il worker conferma

| periodo | n | min | mediana | p90 | **massimo** |
|---|---|---|---|---|---|
| prima del 28/07/2026 | 84 | 35 s | 131 s | 305 s | **2 921 s** (48′41″) |
| **dal 28/07/2026 (assetto di oggi)** | **43** | **19 s** | **116 s** | **314 s** | **432 s** (7′12″) |

### 3.2 La riga DEL SOCIO (`booking`, chiave = slot + nome) — dall'istante della RICHIESTA

⭐ **È questa la riga che conta per il bot**: `consumer-player-readmodel` legge
`record_type in ('booking','staff_booking')` e **non** legge mai `booking_occupancy`
(`consumer-player-readmodel/index.ts:436`). Al socio non serve sapere che il campo è occupato:
gli serve vedere **sé stesso** dentro la partita.

L'orologio parte dalla **richiesta** e non dalla conferma, perché è l'unico istante che il bot ha
davvero in mano quando l'esito è ignoto: il worker, per definizione, non ha risposto.

| dal 28/07/2026 | valore |
|---|---|
| coppie (job × giocatore) | 91, di cui **69 trovate** (le 22 restanti in §5) |
| mediana | **138 s** |
| p90 | 258 s |
| p95 | 360 s |
| **massimo** | **604 s** (10′04″) |
| durata massima del worker (richiesta → conferma) | 31 s |

📌 **Perché due tabelle e non una.** Lo slot compare prima, il nome dopo: le due misure
descrivono momenti diversi dello stesso arrivo. Pubblicarne una sola avrebbe risposto a una
domanda che il bot non fa.

### 3.3 Il ritmo, dal codice

- il cron `pmo-data-routines-dispatcher-prod` gira **ogni 2 minuti** (`*/2 * * * *`, `cron.job` id 6);
- **a ogni tick** l'export copre `oggi … oggi+30 giorni`
  (`matchpoint-bookings-sync/index.ts:662`, `DEFAULT_FUTURE_DAYS = 30`) — non solo ai giri pieni;
- il *tabellone* (giorni vuoti, manutenzione) è quello che varia: pieno ai minuti `%15<2`, «near»
  a 7 giorni ai minuti `%5<2`, altrimenti nulla (`full-tick.ts`).

⇒ La mediana di 116-138 s **è** il cron da 2 minuti. I numeri misurati e il codice si spiegano a
vicenda, e questo è l'unico controllo che rende credibile il massimo.

### 3.4 🌙 E c'è una PAUSA NOTTURNA: fra l'01:00 e le 06:00 il sync NON gira

*(Misurato il 16/08, 29ª sessione — non stava in questa scheda, ed è il pezzo di ritmo che mancava.)*

Il dispatcher **non è attivo 24 ore su 24**. Sta scritto nello scheduler, a lettere:

```sql
-- Sync "live" prenotazioni: … attivo SEMPRE tranne la pausa notturna 01:00-06:00 (Europe/Rome).
if not (v_local_time >= '01:00' and v_local_time < '06:00') then
```
📄 `supabase/manual-sql/supabase_pmo_data_routines_scheduler_prod.sql:108`

**E i dati concordano**, che è il controllo che serve: sui `data_routine_dispatch_bookings_live_*`
l'ultimo tick della sera è alle **22:58 UTC** e la ripresa alle **04:02 UTC** — 18 240 s di buco,
due notti su due, **agli stessi minuti**. (Clienti, storico e backup girano anche dentro la pausa:
non sono prenotazioni future.)

⚠️ **E gli ALTRI buchi non sono guasti** — è la trappola in cui questa sonda fa cadere. Su 1 457
tick in ~62 ore i buchi oltre 3 minuti sono **103**: **2** sono la pausa notturna, gli altri **101**
sono la guardia **anti-accavallamento** (`skipped: 'live_in_flight'`, soglia 150 s), cioè
funzionamento normale.

🚨 **E i guasti del worker da qui NON si contano, in nessun modo.** Il record del dispatch nasce
`status: 'dispatched'` e **non viene mai riscritto con l'esito**: il tick delle 22:28:00 del 15/08
— quello del `MATCHPOINT_BROWSER_WORKER_FAILED` delle 22:28:02 — è lì, e dice `dispatched` come
tutti gli altri. La diagnostica sta in `matchpoint_bookings_auto_diagnostic_last`, che per
costruzione ne tiene **una sola**. ⇒ *Quante volte è caduto il worker* resta **non misurato**, e
chi contasse le righe `error` di quel registro otterrebbe **zero** con la stessa sicurezza con cui
otterrebbe la verità. È la 24ª: la sonda risponde, e la risposta non vale niente.

**Cosa comporta per il bot**: nella finestra 01:00-06:00 il tetto dell'attesa scade **sempre**
senza verdetto, e la seconda risposta al socio è «non lo so ancora».
⚖️ **La sicurezza però regge intera**, ed è la metà che conta: un «no» lì dentro **non può uscire**,
perché `verdettoScrittura` lo concede solo con una copia certificata più fresca della scrittura, e
di notte quella certificazione non arriva. ⇒ Si perde l'**utilità**, non la **verità**.

---

## 4. 🚨 LA PREMESSA DELLA VOCE ERA FALSA: il sync PASSA dal worker

La scheda della voce 53 diceva:

> *«Il bot leggerebbe invece la copia del gestionale, alimentata dal sync, che è un processo a sé
> e **non passa dal worker**: quando il worker è giù, quella strada funziona ancora.»*

**Non è così.** Il sync prende i dati chiamando il worker:

```
matchpoint-bookings-sync/index.ts:648  MATCHPOINT_BROWSER_WORKER_URL
matchpoint-bookings-sync/index.ts:463  workerBookingExportUrl → `${base}/export-booking-history`
tools/matchpoint-browser-worker/src/server.mjs:9279  if (req.method === 'POST' && req.url === '/export-booking-history')
```

⇒ **Worker giù = copia congelata.** La strada che alimenta la prova è la stessa che ha fatto
cadere la scrittura.

🔬 **E si è già visto accadere, nella stessa notte e negli stessi minuti** — misurato, non dedotto:

| istante (UTC) | cosa |
|---|---|
| 15/08 22:27:16 | parte il `booking_job` `3f7e33be` |
| 15/08 22:28:02 | il sync scrive `matchpoint_bookings_auto_diagnostic_last` = **`MATCHPOINT_BROWSER_WORKER_FAILED`** |
| 15/08 22:29:15 | l'app risolve l'esito ignoto guardando su Matchpoint: **`verdetto: "si"`, 8 tentativi** |

L'errore iniziale del job è `Worker network error … peer closed connection without sending TLS
close_notify`. ⇒ Nello stesso minuto in cui il worker non rispondeva alla **scrittura**, non
rispondeva nemmeno al **sync**.

⚖️ **Cosa resta in piedi della voce, e cosa no.**
- ❌ **Cade** «il sync non passa dal worker»: passa.
- ✅ **Regge, e resta il motivo per cui la voce esiste**: il bot **legge una copia**, e una copia
  risponde *sempre*, anche a worker morto. La cura della voce 23 nell'app invece **chiama il
  worker dal vivo** e a worker morto non ottiene niente. La differenza non è «una strada diversa»:
  è che il bot ha una **risposta** anche quando la strada è chiusa.
- 🚨 **Ma quella risposta può essere VECCHIA**, ed è il difetto nuovo che la misura ha trovato:
  l'assenza dalla copia **non è** una prova di assenza dal circolo, proprio nel caso per cui la
  cura è stata scritta.

⇒ **Regola che ne discende**: il bot può dire **«no»** solo se il gestionale gli certifica che
**un sync è atterrato DOPO la scrittura**. Senza quella certificazione la risposta onesta non è
«no», è «non lo so ancora». È di nuovo *il gestionale SA, il bot DICE*: la freschezza è un fatto
del gestionale, e va nella risposta, non lasciata da dedurre al bot.

📌 Il segnale esiste già ed è leggibile: `synced_at` sulle righe `booking` si sposta a ogni giro
atterrato (verificato dal vivo: tutte le righe vive condividono l'ultimo valore, 15:38:01 → 15:40:03
→ 15:46:01 il 16/08). ⚠️ **Non** vanno usati per questo `matchpoint_bookings_full_tick_last`
(segue **solo** i giri pieni: è la trappola della 24ª, `lastFullSuccessAt` «appartiene a un'altra
strada») né `matchpoint_bookings_auto_diagnostic_last` (lo scrivono sia gli errori sia le
diagnostiche di validazione: non è un «ultimo successo»).

---

## 5. I confini duri: casi in cui aspettare non serve a niente

Dei 175 job con `idReserva`, **48 non compaiono mai** nella copia. Non sono ritardi: sono
**assenze definitive**, e ognuna ha una causa misurata.

| causa | prova |
|---|---|
| 🚧 **oltre la finestra dei 30 giorni** | `idReserva 9434`, creata il 14/08 per il **14/12/2026** (121 giorni avanti): mai comparsa, e non comparirà finché la finestra non la raggiunge. L'export è `oggi…oggi+30` a ogni tick |
| 👤 **giocatori «Ospite»** | 13 delle 22 coppie non appaiate del §3.2. Un ospite non ha mai una riga `booking` col suo nome ⇒ **per un ospite il bot non potrà mai confermare per nome** |
| ⏱️ **disdette entro un minuto** | `9260` creata 16:32:20 e soppressa 16:33:15 (55 s); `9261` 16:49:08 → 16:50:24 (76 s); `9276` 20:48:36 → 20:49:33 (57 s). Nate e morte **prima del primo tick**: la copia non le ha mai viste, ed è corretto così |
| ✍️ **grafia del nome diversa** | `9206`: chiesto «marco del pio luogo», la scheda del circolo scrive «**Marco Del Pio**». La riga **era arrivata** in 4 minuti — a non vederla era la mia sonda. ⇒ **un confronto per nome è fragile**, e il readmodel infatti confronta anche per codice socio |

⇒ Il bot non può aspettare all'infinito. Oltre un tetto deve **smettere di aspettare e dirlo**,
non continuare a tacere.

🌙 **E c'è un quinto confine, che non sta in questa tabella perché non è un'assenza definitiva ma
un'ORA**: fra l'**01:00 e le 06:00** il sync è in pausa (§3.4). Lì aspettare *servirebbe* — ma
servirebbe fino alle 06:02, e il tetto è di quindici minuti. ⇒ In quella finestra la seconda
risposta è sempre «non lo so ancora». Non è un difetto da riparare di corsa: è il prezzo di un
tetto onesto, e la scelta di tenerlo è del committente (16/08, vedi §9.3).

---

## 6. 🚨 Il reperto di METODO: la prima sonda ha risposto 16 ore e mezza, ed era sbagliata

La prima misura appaiava `staff_booking` (scritto subito dal gestionale) con la riga `booking`, e
dava un massimo di **59 526 s — 16 h 32 m**, sul caso `idReserva 9213`. Il numero era **falso**, e
il modo in cui lo era è la lezione:

```
15:20:33  il worker conferma 9213
15:20:58  occupancy|9213|2026-08-03|18:00|Campo 3|1.5          ← lo slot: 25 secondi
15:22:41  occupancy|9213|…|Ospite|1.5
07:52:40  booking|9213|…|Myroslava Myroslava|1.5   (il giorno DOPO)
```

La `local_key` di `booking` **contiene il nome del giocatore**. Il roster di quella partita si è
riempito il giorno dopo, e la riga nuova — con un nome nuovo — è nata allora. La sonda leggeva
`min(created_at)` per `idReserva` e chiamava «arrivo della prenotazione» quello che era **l'arrivo
di un giocatore diverso**. Lo slot il gestionale lo sapeva da **25 secondi**.

⚖️ È la **24ª** in pieno — *questa sonda guarda nel cassetto giusto?* — con l'aggravante che il
cassetto sbagliato **era pieno di roba giusta**: le righe erano vere, i tempi veri, la logica
corretta. A smascherarla non è stata una rilettura: è stato che **un solo caso su 197 valeva 200
volte il secondo**, e un massimo così staccato dal p90 è una domanda, non un dato.

📌 E una seconda, sullo stesso oggetto: la prima idea per misurare il ritmo del sync era contare i
valori distinti di `synced_at`. Dà **992 valori in tre mesi, mediana 66 minuti** — e non è il
ritmo del sync: le righe vive condividono tutte **l'ultimo** `synced_at`, quindi quell'insieme
campiona solo gli istanti in cui una riga è stata vista **per l'ultima volta**. Sonda scartata, e
**il buco del sync della notte del 15/08 con quella sonda NON si può misurare** — resta non
misurato, e sta scritto qui perché non venga dato per zero.

---

## 7. La rete del «mai più di quattro» NON ferma il doppio `add` — verificato eseguendo

Il perimetro della voce dice che dei cinque punti in cui `consumer-booking-write` chiama il
gestionale, **`add` è quello dove un doppio fa danno vero**: cinque giocatori in campo. La
scheda chiedeva di **verificare eseguendo** invece di dare la rete per buona. Fatto:

```
① primo add, copia a 3          → { verdetto: "SCRIVE", n: 3 }
   … la fetch cade. Su Matchpoint sono in 4. La copia dice ancora 3.
② secondo add, copia ANCORA a 3 → { verdetto: "SCRIVE", n: 3 }     ← il quinto entra
③ dopo il sync, copia a 4       → { verdetto: "al_completo", n: 4 }
   il controllo «gia_in_partita» sulla copia stantia: NON lo vede

controprova positiva (la rete sa dire di no): OK
```

Girato sulla funzione **vera** (`rosterDelloSlot` di `roster-slot.ts`) col cancello vero
(`index.ts:1311`, `esito.roster.length >= GIOCATORI_PARTITA`).

🚨 **La causa non è che la rete sia scritta male: è che TUTTE le sue fonti sono la copia.** Anche
la «scheda del circolo», che il commento chiama *«l'unica aggiornata»*, è il campo `descrizione`
**delle righe sincronizzate** — cioè la stessa copia, con lo stesso ritardo. ⇒ Dentro la finestra
misurata al §3 la rete **non può** vedere il quarto appena entrato, e il quinto passa.

⭐ **La controprova positiva conta quanto il resto**: con 4 nella copia la rete risponde
`al_completo`. Senza di essa «non ferma il doppio» si sarebbe potuto leggere come «la rete è
rotta», che è falso — la rete funziona, le manca il **dato**.

⚠️ E resta l'altra metà, che la cura del 16/08 non ha toccato: la `fetch` di `add`
(`index.ts:1371`) **non è in un try/catch**, esattamente come lo era `create` prima del 16/08. Un
errore di rete lì non diventa `esito_ignoto`: fa saltare la funzione.

---

## 8. Cosa è stato COSTRUITO con questa misura

> 🗣️ **Decisione del committente, 16/08**: il verdetto sta **nel gestionale, con la freschezza
> dentro** — non nel bot; e `add` si cura **nella stessa sessione**.

### 8.1 L'azione `verifica` di `consumer-booking-write`

Un punto d'ingresso solo, che risponde **già deciso**. Il bot chiede e ripete; non calcola —
è la regola del 16/08 alla lettera, e la freschezza del sync è una cosa che **solo** il
gestionale può sapere.

**Richiesta**: `action: 'verifica'`, più lo slot (`data`, `ora`, `campo`) e `scritta_alle`.
**Risposta**:

| campo | cosa |
|---|---|
| `esito` | `si` · `no` · `non_ancora` |
| `motivo` | `trovata` · `fuori_finestra` · `istante_ignoto` · `copia_muta` · `copia_aggiornata_dopo` · `copia_ferma` |
| `attendere` | ha senso richiedere fra un po'? ⭐ **separato dall'esito di proposito**: «aspetta e saprai» e «qui non si saprà mai» sono due `non_ancora` diversissimi, e dirli con la stessa parola manderebbe il bot ad aspettare a vuoto |
| `copia_fresca_al`, `scritta_alle` | i due istanti, **sempre**, così il verdetto si può rifare a mano leggendo i log |

⛔ **Non scrive niente e non chiama il worker.** È la sua ragione d'essere: legge una copia, e
una copia risponde anche a worker morto — vecchia, ma risponde.

**La regola** (`esito-scrittura.ts`), e l'ordine **è** la funzione:
1. la riga c'è → `si`. Prima di tutto, perché nessun sync inventa una prenotazione: che la copia
   sia fresca o stantia non cambia niente;
2. slot oltre i 30 giorni → `non_ancora` / `fuori_finestra`, **`attendere: false`**;
3. senza istante di scrittura, o senza copia → `non_ancora`, mai un «no»;
4. un giro atterrato oltre **`scritta_alle + 150 s`** → **`no`**;
5. altrimenti → `non_ancora` / `copia_ferma`.

⚖️ **Il margine di 150 s non è la durata tipica** (il massimo misurato dei giri riusciti è 31 s):
quando l'esito è ignoto il worker si è **piantato**, quindi quella durata non lo limita. Si prende
il tetto **strutturale** — i 150 s oltre i quali l'edge viene uccisa comunque — perché sbagliare
in eccesso costa un «non ancora» in più, sbagliare in difetto produce **un «no» falso**.

### 8.2 Il giro si chiude: `esito_ignoto` consegna con che cosa richiedere

Ogni «non lo so» (i due di `create` e quello nuovo di `add`) ora torna con **`scritta_alle` e
`slot`**. Senza, il ponte era a metà: `verifica` esisteva e il bot non aveva l'istante con cui
chiamarla. 🚨 E l'istante si prende **prima** della `fetch`: uno preso al ritorno è già in
ritardo, e un riferimento in ritardo fa scattare il «no» troppo presto.

### 8.3 `add` non salta più

La `fetch` di `add` è ora in `try/catch` e risponde `esito_ignoto` invece di far esplodere la
funzione in un 500. ⚠️ **Non chiude il limite del §7**: la rete del «mai più di quattro» conta
ancora sulla copia. Toglie la via scoperta, non la staleness.

### 8.4 Il banco

**103 casi verdi** in `consumer-booking-write` (21 + **15 nuovi** + 18 + 49), e gli 8 sabotaggi
della tabella in fondo a `esito-scrittura.test.ts` fanno **8 rossi**.

🚨 **Due casi su quindici sono nati INERTI, e a dirlo è stato il sabotaggio, non la rilettura**:
① il caso della finestra costruiva il proprio ingresso con `FINESTRA_SYNC_GIORNI` — la costante
che doveva provare — e allargandola a 60 si spostava anche lui, restando verde col difetto
acceso; ② il caso del giro chiuso contava il letterale `reason: 'esito_ignoto'` e ne trovava 2 su
3, perché un ramo lo scrive in forma condizionale: contava una **grafia**, non i punti.
⇒ È la 20ª nella forma della 24ª, due volte nella stessa mezz'ora.

---

## 8bis. Cosa è stato verificato SUL BERSAGLIO (TEST), e cosa no

Promossa su `test-preview` la sola cartella `consumer-booking-write` — non `docs/` né `CLAUDE.md`,
che stanno sotto `guard-worker-sync`: spingerli su un ramo solo terrebbe la guardia rossa per tutto
il tempo che passa in attesa dell'ok sul merge di `main`. Salgono con quello, di fila (4bis).

| ✅ verificato eseguendo | come |
|---|---|
| il deploy su TEST è **verde** | `Deploy Edge Functions (TEST)` #228, `success` |
| il codice nuovo è **vivo** su `cudi…`, versione **34** | letto da Supabase, non dedotto: ci sono `action === 'verifica'`, `verdettoScrittura`, `MARGINE_SCRITTURA_S = 150`, `let resAdd: Response;` |
| l'endpoint **risponde e fallisce chiuso** | `POST` vero senza header → **401 `UNAUTHORIZED`** |
| la regola sugli **ingressi veri di TEST** | vedi sotto |

⛔ **Quello che NON è stato esercitato, e va detto**: la chiamata **autenticata** al ponte. Il
`X-Consumer-Secret` non è leggibile da una sessione cloud (non sta nel database, e l'MCP di Supabase
non espone i secret) ⇒ il percorso HTTP completo, con un socio vero, resta **da fare**. Quello che
segue prova la **regola sui dati veri del bersaglio**, non il giro completo.

**Gli ingressi veri di TEST**, letti il 16/08 alle 16:46 UTC: `max(synced_at)` sulle righe
prenotazione = **15:30:06** dello stesso giorno. Dando quelli in pasto alla funzione vera:

```
non_ancora  copia_ferma            aspetta  ← scrittura ADESSO (la copia è indietro di 1h16)
non_ancora  copia_ferma            aspetta  ← scrittura di 20 minuti fa
no          copia_aggiornata_dopo  basta    ← scrittura delle 15:25, appena PRIMA del sync
no          copia_aggiornata_dopo  basta    ← scrittura di ieri sera (15/08 22:27)
non_ancora  fuori_finestra         basta    ← scrittura adesso, slot oltre i 30 giorni

controprova positiva (la riga c'è): si/trovata
```

⇒ Nei due casi in cui la copia è **indietro rispetto alla scrittura** non esce mai un «no», che è
l'unica cosa che questa funzione doveva garantire. E la controprova al contrario c'è: quando il
sync **è** passato dopo, il «no» esce netto — senza quella, «non dice mai no» si leggerebbe come
«funziona» invece che come «è bloccata».

🔎 **E misurando il bersaglio è saltata fuori una cosa che `CLAUDE.md` non dice più giusta.** Sta
scritto che il calendario di TEST è fermo all'ultimo import a mano, *«al 14/08 fermo al 7 agosto»*.
La prima metà regge ed è stata ricontrollata — `data_routine_dispatch_bookings_live_*` su `cudi…` è
**0 in tutta la storia**, nessun cron l'ha mai toccato. Ma i giri **a mano** sono continuati: dei
**108** istanti di sync distinti di sempre, **3 sono nelle ultime 48 ore** (15/08 21:45, 16/08 03:30,
16/08 15:30). ⇒ TEST non mostra il 7 agosto: mostra **un'ora e mezza fa**. L'avvertimento resta
valido — nulla lo tiene fresco, e i buchi vanno da ore a giorni — ma chi legge quella riga per
decidere se fidarsi di TEST oggi si farebbe un'idea sbagliata di **quanto** sia vecchio.

---

## 9. Cosa manca per chiudere la voce

1. ⛔ **Il giro completo sul bersaglio**: la chiamata autenticata al ponte con un socio vero (vedi
   §8bis). Serve il `X-Consumer-Secret`, che da una sessione cloud non si legge.
2. ⛔ **La metà del bot**: il ciclo che richiede e il messaggio al socio, nel repo privato
   `assistente-padel-agent`.
   🔄 **CORREZIONE — e non è un dettaglio**: scrivendo questa scheda avevo messo *«dal cloud non si
   aggiorna, serve un `git pull` là sopra»*. **Falso su due punti**, e a smentirlo è la scheda della
   VM entrata su `main` la stessa sera (#789): le cartelle del bot **non sono repository git** e la
   VM non parla con GitHub, quindi il `git pull` non esiste proprio; e l'aggiornamento si fa con
   **`deploy-bot-hetzner.yml`** (`workflow_dispatch`, bersaglio `soci`, con la parola `SOCI` scritta
   a mano) — cioè **passando da GitHub Actions**, che da qui si raggiunge.
   ⇒ Quello che davvero **non** si può fare dal cloud è entrare sulla VM: esce solo la 443, la 22 è
   chiusa. ⚖️ È l'errore che la 26ª chiama per nome — **un limite dichiarato senza averlo provato** —
   e l'avevo scritto io, dodici ore dopo che la lezione era stata messa in `CLAUDE.md`.
3. 📌 **Il tetto dell'attesa lo decide chi scrive il bot**: il massimo misurato è **604 s**, il
   tetto naturale è il **giro pieno da 15 minuti**, che è la cadenza programmata più larga.

---

## 9bis. 🔄 Aggiornamento del 16/08, 29ª sessione — il punto 2 è SCRITTO e in PR

⭐ **La metà del bot esiste**: `attesa-esito.ts` (il ciclo), `verificaScrittura()` nel ponte,
`scritta_alle` portato fino allo strumento, e l'aggancio su **entrambe** le strade — modello e
bottoni, che sono due punti diversi e vanno tenute in pari.
📄 PR **#4** su `assistente-padel-agent`, ramo `claude/voce-53-ciclo-attesa`.
**Tetto 15 minuti, domanda ogni 60 s**, banco **1004 verdi**, `tsc` pulito, **7 sabotaggi → 7 rossi**.

> 🗣️ **Decisione del committente, 16/08**, messo davanti a tre strade con i prezzi:
> **l'attesa resta nel processo, e il limite si SCRIVE.**

⛔ **Cosa vuol dire, detto per intero**: il bot è un long polling senza scheduler ⇒ **un riavvio
durante l'attesa la perde**, e il socio resta senza la seconda risposta. L'alternativa c'era —
appoggiare l'attesa alla memoria su `ayly…`, che regge i riavvii — ed è stata **scartata**: perdere
l'attesa vuole **due rarità insieme** (un esito ignoto *e* un riavvio dentro quei 15 minuti),
mentre il pezzo in più andrebbe progettato, provato e deployato **prima** del collaudo.
🚨 Per questo la via d'uscita a mano nel primo messaggio (*«chiedimi cosa ho prenotato»*) **non è
ridondanza e non si toglie**: è l'unica che non dipende dal fatto che quel processo sia ancora vivo.

⚖️ **Scritto come SCELTA e non come residuo, di proposito**: un limite che sembra una dimenticanza,
prima o poi qualcuno lo «ripara» senza sapere cosa era stato pesato.

### 🚀 Il deploy sul bot di PROVA è FATTO (16/08)

`deploy-bot-hetzner.yml`, bersaglio `prova`. Il bot è ripartito e **ha dichiarato dove punta**, che
è l'unica prova che valga su dove scrive:

```
⚙️  ponti edge: cudiqnrrlbyqryrtaprd… (TEST) · segreto gate: presente
🧪 prenotazioni sul GESTIONALE DI PROVA: si scrive davvero, ma il circolo non si tocca.
```

⛔ Il bersaglio **`soci`** non è stato toccato: vuole un ok separato e la parola `SOCI` scritta a mano.

### Cosa manca ADESSO: una cosa sola, e vuole le sue mani

⛔ **Il collaudo vero.** 📄 La scheda c'è: [`voce-53-collaudo.md`](./voce-53-collaudo.md) — pre-volo,
cancello, previsioni minuto per minuto, e **cosa sarebbe un rosso vero**.

🎁 **Ed è molto più semplice di come era stato scritto qui sopra**, per due fatti misurati il 16/08:

1. **Non serve lo strappo a metà volo.** `matchpoint-bookings-create` marchia l'esito come ignoto a
   **qualunque** caduta di rete della chiamata al worker (`index.ts:194`), e il marchio sta su una
   **proprietà**, non sulle parole: «connection refused» ci rientra. Lo conferma la misura già
   fatta — la **parte A** della voce 41, con Caddy fermo *prima*, diede `unknown`, non `error`.
   ⇒ **Basta Caddy giù prima di prenotare**: niente `SIGKILL`, niente due secondi contati.
2. **La finestra col circolo fermo dura SECONDI.** L'attesa **non passa da Caddy**: `verifica` è una
   chiamata alla edge, e quella funzione non chiama il worker. ⇒ Caddy si riaccende **subito** dopo
   la prenotazione, e il ciclo continua per conto suo.
   ⭐ Il che *è* la tesi centrale della voce — *una copia risponde sempre, anche a worker morto* —
   che così viene **esercitata** invece che creduta.

🚨 **E il «sì» sul bot di prova è IRRAGGIUNGIBILE**, dichiarato prima e non dopo: su TEST la
scrittura è **simulata** (il circolo non si tocca) e la copia non la aggiorna nessun cron ⇒ la
prenotazione non comparirà mai, e l'esito atteso è **`rinuncia/tetto`**.
⚖️ Non è una prova mancata: è il **ramo pericoloso**, quello in cui una copia stantia potrebbe far
dire un «no» falso. Se esce «non lo so ancora», ciò per cui la voce esiste ha funzionato. La strada
felice si prova solo sul bersaglio **`soci`**.

⚠️ **E il repo del bot non ha CI**: l'unico workflow è il deploy. I 1004 verdi sono girati in locale,
e nessuna guardia li rigirerà sulla PR.
