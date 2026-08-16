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

## 8. Cosa se ne fa la voce 53 (proposta, non decisione)

1. **L'attesa non è un numero solo**: è *«fino a quando un sync è atterrato dopo la scrittura»*,
   con un tetto. Il massimo misurato è **604 s**; il tetto naturale è il **giro pieno da 15
   minuti**, che è la cadenza programmata più larga.
2. **Il verdetto lo dà il gestionale, non il bot.** Un solo punto di ingresso che risponde
   `si` / `no` / `non_ancora`, dove `no` viene emesso **solo** con la freschezza verificata. Il
   bot chiede e ripete; non calcola.
3. **I confini del §5 vanno nella risposta**, non lasciati scoprire al bot: oltre 30 giorni e per
   gli ospiti la copia non risponderà mai, e va detto subito invece di far aspettare.
4. `add` va protetto come `create` (§7) — ed è lavoro a sé, perché lì non basta il terzo esito:
   serve che la rete non conti su un dato vecchio.

📌 **Il punto 2 non è una preferenza di stile**: è la regola d'architettura del 16/08 applicata
alla lettera — *il gestionale SA, il bot DICE*. La freschezza del sync è una cosa che **solo** il
gestionale può sapere.
