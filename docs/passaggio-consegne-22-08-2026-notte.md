# Passaggio di consegne — notte fra il 21 e il 22/08/2026

**Come si usa:** incolla questo file (o il suo contenuto) come primo messaggio della chat nuova.
È scritto per essere capito **senza** la conversazione precedente: dove serve un fatto, il fatto
è qui dentro, non «come dicevamo».

⚠️ **È il terzo passaggio della giornata.** Ce n'è uno della sera (`docs/passaggio-consegne-21-08-2026.md`)
e uno della notte scritto verso le 23:30. Questo racconta **quello che è successo dopo**, ed è la
parte che conta: se qualcosa qui sembra contraddire quelli, **vince questo**, e la riga vecchia va
corretta, non affiancata.

---

## 1. La cosa da sapere prima di tutte

🎾 **Il collaudo del bot è stato fatto, ed è servito a qualcosa di diverso da quello per cui era
nato.** Doveva guardare l'**usabilità** di due fasi già in servizio. Ha trovato **quattro difetti**,
e **nessuno dei quattro era in quelle due fasi**.

| | difetto | stato |
|---|---|---|
| **71** | «Questa partita non l'hai organizzata tu» detto a chi l'ha appena prenotata | 📋 in coda, cura disegnata |
| **70** | Il circolo annuncia al socio una cosa che ha appena fatto lui | 📋 in coda, cura disegnata |
| — | Il ponte vedeva **1000 soci su 2810** | ✅ curato e **in servizio** |
| — | A mezzanotte **36 falsi annullamenti a 32 persone** | ✅ curato e **in servizio** |

⭐ **Il filo che li lega, ed è la cosa da portarsi dietro:** ognuno si è visto **solo cambiando la
persona, l'ora o il giorno della prova**. Il collaudo della sera era verde perché Maurizio sta in
posizione 628 dell'anagrafica; quello della notte è caduto perché Lidia sta in 2721. La mezzanotte
si è vista perché eravamo ancora svegli quando è scoccata.

⇒ *Una catena provata con un caso solo non è provata: è stata **campionata**.*

---

## 2. 🔴 COSA BLOCCA — due decisioni, non due lavori

Le due voci nuove hanno la **cura disegnata e non scritta**, e nessuna delle due si chiude in una
sessione che abbia in mano solo questo repo: toccano **anche il bot** (`assistente-padel-agent`).

### Voce 71 — la frase che nega la paternità

Il committente prenota dal bot, conferma, e il bot gli dice *«Questa partita non l'hai organizzata
tu… chiedilo a chi l'ha organizzata»* — cioè lo manda **da sé stesso**.

📏 **Misurato**: `staff_booking` scritto alle **21:31:14** con `descrizione` vuota, `booking`
tornato dal sync alle **21:32:47** con `-Maurizio Aprea.` ⇒ **finestra di 1′33″**. Riprovando
quattro minuti dopo, l'invito parte senza storie.

⚖️ **Il difetto non è il cancello, è la FRASE.** Il cancello ha ragione a non far invitare quando
non sa chi ha organizzato; sbaglia a dire **«non sei tu»** quando la verità è **«non lo so
ancora»**. La forma giusta il progetto ce l'ha già: **`esito_ignoto`** (voce 53).

🔨 **Cura**: il ponte deve distinguere *«elenco vuoto perché la scheda non c'è ancora»* da *«elenco
vuoto perché è davvero ignoto»* — oggi `giocatori: []` dice tutti e due — e il bot deve rispondere
*«sto ancora registrando la prenotazione, riprova fra un minuto»*.

### Voce 70 — il circolo che ripete al socio quello che ha appena fatto

Lidia accetta un invito dal bot, il bot le dice «✅ Sei in campo», e pochi minuti dopo il **circolo**
le annuncia che è stata aggiunta alla partita.

🔎 **Causa strutturale**: `eventi-staff.ts` confronta **DATI**, non eventi — vede *cosa* è cambiato
e **non può sapere CHI** l'ha cambiato. Ed è il rovescio esatto del pregio dichiarato nella sua
stessa intestazione (*«il ③ toccato ≠ cambiato non costa una riga, perché si confrontano dati»*).

🚨 **Ed è diventata più urgente stanotte, non meno**: finché il ponte era cieco sui due terzi dei
soci quel difetto era quasi invisibile; **curata la cecità, diventa visibile a tutti**.

🔨 **Cura**: una **ricevuta** lasciata da `consumer-booking-write` (slot · persona · gesto ·
istante) — la scrittura l'ha eseguita il gestionale, quindi il gestionale **sa** — e scartata da chi
consegna (`consumer-staff-events`, che la quiete dei 2′ la fa già). Finestra ≥15′, perché il fatto
nasce col ritardo del sync (mediana ~2′, massimo misurato 10′04″).
⛔ **Non** farlo confrontare al bot con un proprio ricordo: sarebbe la memoria parallela esclusa
dalla voce 64, e la 68 è nata apposta per non averla.

### E una terza decisione, piccola solo in apparenza

⏸️ **`consegnato_at` dice «fatto» anche su messaggi mai partiti.** Quando il destinatario non si
riconosce, la riga si chiude lo stesso — è deliberato (quel nome non diventerà risolvibile domani)
— ma **il nome della colonna mente**, e su quella colonna poggia la tabella diagnostica della voce
68. Chi la guarda per sapere *«è arrivato?»* ottiene **sì** per una cosa che non è successa.

---

## 3. Cosa è stato fatto stanotte

### Il collaudo, prova per prova

| prova | esito |
|---|---|
| **1** — le due bolle e l'eco «Non ho toccato niente» | ✅ **passata**, verificata anche nella coda del gestionale (nessun fatto emesso) |
| **2** — «In attesa di risposta» + la scadenza dell'invito | ⚠️ **NON PROVATA**: la riga non è stata guardata prima che Lidia rispondesse, e dopo sparisce. *Una prova non fatta è meglio di una prova raccontata.* |
| **3** — «✅ Hai risposto: Ci sto» sopra l'esito | ✅ **passata**, vista sul telefono di Lidia |
| **4** — la promessa mantenuta (due invitati) | ⏸️ non fatta: serve un secondo invitato |

📌 **Un fatto utile scoperto guardando lo screenshot**: l'invito viene **riscritto sul posto**
(`editMessageText`), quindi tiene l'orario di quando è nato. Un messaggio «vecchio» in fondo alla
chat non vuol dire che non sia arrivato niente dopo.

### I due difetti curati e in servizio

**① Il ponte vedeva 1000 soci su 2810.** `consumer-staff-events` leggeva l'anagrafica con
`.limit(5000)` — **più delle schede che esistono** — e ne riceveva **1000**: il client tronca a
mille per volta comunque lo si chieda. ⇒ **1810 soci su 2810 non potevano ricevere niente**, in
silenzio, con la riga chiusa come se fosse stata consegnata.

⚖️ **La trappola**: chiedere 5000 **sembrava prudente proprio perché era più del vero**.
⇒ *Un limite che si dichiara non è un limite che si ottiene.*
🔎 E la risposta era già in questo repo: `anagrafica-report-telefoni` lo scrive in chiaro (*«i soci
sono ~2800 e il client tronca a 1000 per volta»*), e **nove** funzioni impaginano. Questa era
l'unica che non lo faceva.

**② A mezzanotte, 36 falsi annullamenti a 32 persone.** Alle **00:01:47** sono nati 36 fatti
`annullata` con `data = 2026-08-21` — le partite del **giorno appena finito**. Il sync guarda da
oggi in avanti, quindi ogni mezzanotte il giorno finito **esce dalla finestra**, e per il confronto
quelle partite risultano sparite.

⇒ *Una partita già giocata non è stata annullata: è stata **giocata**.*

⚖️ **La protezione c'era, puntata sul guasto sbagliato.** `confrontoAttendibile` difende dal
**crollo** (metà calendario sparito insieme). A mezzanotte se ne va **un giorno su trenta**: troppo
poco per farla scattare.
⇒ *Una protezione giusta puntata sul guasto sbagliato non attenua quello che le passa accanto: lo
lascia passare intero, e per giunta fa credere che qualcuno stia guardando.*

📏 **Danno reale: 3 messaggi falsi a Maurizio.** Gli altri 31 nomi non hanno il bot.
🚨 **Con i soci tutti dentro sarebbero 32 persone ogni notte.** *Il difetto non era più piccolo:
era puntato su una platea di cinque.*

### Le guardie, che erano rosse e nessuno le leggeva

🚨 **`guard-docs-truth` era rossa su `main` e `test-preview` da ieri mattina**, otto corse di fila,
comprese le tre PR fuse la sera. In sezione C contava i titoli `####`, **uno stile che quella
sezione non usa**: finché C è stata **vuota** il conto tornava (0 e 0) e sembrava funzionare.
⇒ *Una guardia che passa su una sezione vuota non ha ancora dimostrato di saperla contare.*

🚨 **`guard-worker-sync` era rossa dalla sera**: la documentazione della #956 era atterrata su
`main` e **il riallineo di `test-preview` non era mai stato fatto** — mentre il passaggio di
consegne dichiarava «tutto allineato».

🔪 Entrambe riparate e **verificate sabotandole**: dichiarare una voce in meno, e aggiungerne una
che nessun numero dichiara. Cadono in tutti e due i casi, e nominano il controllo giusto.

### Due cose minori, trovate scrivendo le prime

- **Il byte NUL in `riduzione.ts`** (un separatore voluto dentro una chiave) rendeva il file
  **binario per git**: niente diff, quindi invisibile nelle revisioni. Stesso valore a runtime,
  scritto come sequenza di escape.
- **`prove.yml` classificava le prove cercando `jsr:` in un punto qualsiasi del file**: un commento
  che la nominava per dire *«questa NON è una prova Deno»* spediva quella prova nel corridoio
  sbagliato. ⭐ **Ci sono cascato scrivendo la prova nuova.** Ora si àncora all'`import`.

### La voce 69, decisa e mai atterrata

Era stata messa in coda dal committente e viveva **solo** nel passaggio di consegne e dentro il
corpo della voce 68: nessuna scheda, nessun numero nei conteggi. Adesso c'è.
⇒ *Una decisione che vive solo nel racconto di chi c'era non è in lista: è un **ricordo**.*
📌 La stessa cosa è ricapitata a fine nottata con la **voce 71**, che è rimasta senza scheda per
un'ora buona mentre si curavano gli altri difetti.

---

## 4. Cosa resta da fare

### 🔴 Subito

1. **Le due decisioni** del §2 (voci 70 e 71) più quella su `consegnato_at`. Sono **decisioni**, non
   indagini: le misure ci sono tutte.
2. **Verificare la paginazione sul campo.** È curata e provata con 8 casi, ma **non è ancora stata
   vista funzionare su una persona vera oltre la millesima scheda**: la conferma arriva al primo
   gesto vero della segreteria. Fino ad allora è *curata*, non *vista funzionare*.
3. **Guardare la prossima mezzanotte**: la cura del difetto ② va vista succedere. Basta questa:

```sql
-- Nessuna riga con `data` di ieri deve comparire (progetto qqbfphyslczzkxoncgex)
select persona, gesto, data, ora, campo, created_at, consegnato_at
  from public.pmo_eventi_staff
 order by created_at desc limit 50;
```

4. **Finire il collaudo**: la Prova 2 va rifatta (guardando la riga «🎾 In attesa di risposta»
   **prima** che l'invitato risponda) e la Prova 4 vuole due invitati.
5. **C'è una partita di prova da annullare**: 31 agosto, 11:00, campo 1 — con Maurizio e Lidia
   dentro. Si annulla dal bot.

### 📋 In coda — 5

**Sezione C (4)**: **68** (avvisi dal gestionale, in servizio, resta finché il primo giorno vero non
è stato guardato) · **69** (una scheda senza telefono nell'export genera un socio doppio) · **70** ·
**71**. **Sezione D (1)**: **60** (campi liberi nei circoli vicini).

### 🔴 Urgenti — 5

**63**, **64**, **65**, **67** curate e in servizio; **66** è diagnostica messa e cura non scritta,
per scelta del committente. Restano aperte perché **la cura non l'ha ancora vista succedere
nessuno** sul bersaglio.

---

## 5. Trappole imparate stanotte

- **Una catena provata con un caso solo è campionata, non provata.** Il collaudo della sera era
  verde per la **posizione** della persona scelta, non per il codice.
- **Un limite che si dichiara non è un limite che si ottiene.** Chiedere 5000 righe sembrava
  prudente proprio perché era più del vero — e un tetto chiesto più alto di quello imposto non
  protegge: **nasconde**.
- **Una protezione giusta puntata sul guasto sbagliato lascia passare intero quello che le passa
  accanto**, e per giunta fa credere che qualcuno stia guardando.
- **Una guardia che passa su una sezione vuota non ha ancora dimostrato di saperla contare.**
- **Una guardia che cerca una parola prova che la parola c'è, non che il codice succeda.** (Già
  pagata il 19/08, e ricapitata stanotte con `jsr:` dentro un commento.)
- **Quando una previsione si può scrivere PRIMA, si scrive prima.** Il difetto della voce 70 è stato
  previsto per iscritto e poi misurato: così l'esito non si può raccontare a posteriori.
- **Il registro del ponte diceva tutto** (`inCoda 1 · ridotti 1 · consegnati 0 · nonRiconosciuti 1`)
  e nessuno lo stava leggendo. Prima di indagare, **guardare cosa ha già scritto il sistema**.

---

## 6. Riferimenti

**Rami** — tutto fuso su `main` e allineato su `test-preview`, guardie verdi sui due lati.
· PR **#957** (le due guardie riparate, voci 69 e 70) · **#958** (paginazione + mezzanotte) ·
**#959** (voce 71)

**Stato dei sistemi alla consegna:**
· `matchpoint-bookings-sync` **v60** su PROD · `consumer-staff-events` **v3** su PROD
· bot dei soci: **non toccato** — commit `2c6c0ae`, online, `qqbf… (PROD)`, `✍️ prenotazioni REALI`
· banco: **43 verdi** su `main`, **45** su `test-preview`, 0 rossi
· `guard-docs-truth` ✅ · `guard-worker-sync` ✅ · `prove` ✅ · `deno-check` ✅

**L'interruttore degli avvisi del circolo**, se servisse spegnerli:

```sql
update public.pmo_ai_settings
   set value = jsonb_set(value, '{avvisi_dal_circolo,attivi}', 'false'::jsonb)
 where key = 'assistant_kb' and env = 'prod';
```

Per riaccenderlo, `'true'::jsonb`. Effetto al giro dopo (≤15 minuti), e spegne **solo** quegli
avvisi.

**Pagine**: guida al collaudo → `c43285c7-79eb-4ee3-b65f-2d98226314fe` · revisione del flusso →
`cbbf0f3c-dab9-425c-bfdb-4e1428c3e90f` · mockup → `62a46c9d-8351-4dd3-8994-36b4468fa2e0`
(tutte su `claude.ai/code/artifact/`)

⚠️ **Due correzioni alla guida al collaudo, che lì dentro non ci sono:** ① *«se qualcosa non va
rimetto il codice di stamattina»* non vale più — tornare indietro spegnerebbe anche la voce 68 e il
suo interruttore; ② durante le prove **evitare** il 31 agosto 09:30 campo 1 **e** 11:00 campo 1, che
sono le due partite usate nei collaudi.
