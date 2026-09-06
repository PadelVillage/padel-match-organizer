# Passaggio di consegne — 06/09/2026, NOTTE (95ª sessione)

> **Prompt di apertura per la chat nuova.** Copia il blocco qui sotto.

---

## 📋 PROMPT DA INCOLLARE

> Riprendi il progetto **PADEL MATCH ORGANIZER**.
>
> Leggi PRIMA, in quest'ordine: **`CLAUDE.md`** (il *postulato in testa*: la prova la faccio io,
> lui supervisiona; la promozione a PROD **non si chiede**), **`docs/lavori/README.md`** (le tre
> liste), e questo file.
>
> 🚨 **Il checkout locale può essere STANTIO** — è successo anche oggi: `git status -sb` dice
> «allineato» e mente. Fai **`git fetch`** e confronta gli sha PRIMA di tutto; se serve
> `git checkout -B test-preview origin/test-preview` tenendo un ref di backup.
> ⚠️ **La console remota vuole `npm install`**: il container nasce senza `playwright`.
> `cd tools/verifica-browser && npm install` (~1 minuto).
> ⚠️ **Deno NON si installa da qui** (403 su `deno.land`). Le prove Deno le lancia la CI. In locale
> un `.ts` puro si esegue con `node --experimental-strip-types` — e su Node 22.18+ **anche senza il
> flag**, che è come lo lancia la CI (Node 24).

---

## 📏 STATO ALLA CHIUSURA — misurato, non ricordato

| | |
|---|---|
| **PROD** | app **6.384** |
| **TEST** | app **6.385** (1 = allineati) |
| liste | 🔴 urgenti **0** · 📋 in coda **13** (C 13 + D 0) · 📦 chiuse **151** |
| rami | `docs/`, workflow, `CLAUDE.md`, `server.mjs` **identici**; guardie **verdi** su entrambi |
| voce 142 | arricchimento **ACCESO su PROD a tetto 1**; **84** prenotazioni arricchite e sale |
| voce 143 | prima metà **in servizio**; borsellino di Maurizio Aprea **6,00 €** (era 5,00) |
| bot | **non toccato** in tutta la giornata |

⚠️ **Le versioni si rimisurano**, non si copiano da qui:
```
curl -s -H 'Cache-Control: no-cache' "https://app.padelvillage.club/?cb=$(date +%s)" | grep -o "APP_VERSION = '[0-9.]*'"
curl -s "https://test.padelvillage.club/app-meta.json?cb=$(date +%s)"
```

---

## ⏭️ COSA FARE ADESSO — c'è una prova SUA già autorizzata, e va preparata

🗣️ **Sue parole di stasera:**

> *«dopo che hai fatto questa prova, ti autorizzo a fare un'altra prova lunedì 7 alle ore 10:30
> c'è una partita dove c'è Maurizio Aprea, utilizzando lui puoi fare un pagamento e poi uno storno
> così vedi se funziona tutto. Che ne pensi?»*

### 🚨 LA COSA PIÙ IMPORTANTE DI QUESTO FILE: quella prova, com'è oggi, **proverebbe il difetto invece della cura**

📏 **Misurato il 06/09**: `matchpoint-payment-write` accetta `method: 'wallet'` (pagamento **col
borsellino**) ma **il saldo dopo NON ce l'ha** — il worker non glielo torna. ⇒ Dopo un pagamento col
borsellino la **fotografia** del saldo resta vecchia fino al giro dei 10 minuti, esattamente come
prima della cura di stasera.

⇒ **Prima di lunedì va fatta la seconda metà della 143**, o quella prova mostra il buco invece di
esercitare il rimedio. È l'obbligo ③ della delega — *se una prova che sta per fare LUI non
proverebbe niente, lo si ferma PRIMA*.

🔨 **La strada, già disegnata e misurata** (non inventarne un'altra):
1. `matchpoint-wallet-read` — **esiste già** e legge il saldo di **un solo** socio dal vivo. Oggi
   **non scrive niente**: il risultato finisce in `window.__pmoWalletCache`, una Map in memoria che
   si perde al reload e che **nessun altro della segreteria vede**;
2. farle scrivere la fotografia **riusando `decidiFotografiaSaldo`** (il modulo puro già in
   servizio, con il suo banco da 8 casi) — stessa chiave, stessi 6 campi;
3. l'app la chiama **in sottofondo** dopo un pagamento col borsellino, **senza far aspettare la
   cassa**: la lettura al worker costa ~10 s (misurato: la ricarica di stasera ha impiegato 10,6 s),
   e dieci secondi in più davanti alla fila sono un peggioramento, non una cura.

🚨 **E l'avvertenza da dargli PRIMA che prema**: un pagamento **cash/card non tocca il borsellino**,
quindi non eserciterebbe niente della 143. La prova che vale è **col borsellino**.

⚠️ **Il gesto di lunedì è SUO** (o autorizzato da lui esplicitamente come stasera): salvare un
pagamento è l'unica cosa fuori dal campo libero — *«se no, si modifica la cassa vera»*.

---

## ✅ COSA È STATO FATTO OGGI, e con quale prova

| voce | cosa | prova |
|---|---|---|
| **142 ②** | promossa su PROD e **accesa** | PR #1421 + #1423 |
| **142 ③** | l'app legge `idClienti` e `note` dal gestionale | **prova fisica su PROD 6.384** |
| **143 ①** | il saldo si aggiorna nell'istante della ricarica | **ricarica VERA da 1 €** |
| — | l'interruttore della 142 contraddiceva sé stesso in **3 punti** | PR #1422 |

### 🚨⭐⭐ LA LEZIONE DELLA GIORNATA: accendere la 142 ha trovato un difetto che il banco non poteva vedere

📏 Acceso a tetto 1 per 14 minuti: **quattro giri, quattro `riuscite: 1`** nel registro — e in
archivio **UNA sola** prenotazione arricchita, **ogni volta una diversa**.

⚖️ **Il perché, strutturale**: `validation.bookings` nasce dall'export XLSX **a ogni giro**, e
l'export quei campi non li porta. Il giro arricchiva la riga che leggeva; tutte le altre venivano
riscritte dal payload nuovo, **senza** ⇒ il lavoro del giro prima veniva **cancellato**. Ne
guadagni una, ne perdi una: il conto non sale mai. E costava **due volte** — la riga che perde il
dato risulta *cambiata* ⇒ due righe riscritte a ogni giro **per sempre**: la voce 160 in miniatura.

🔨 Curato con **`conservaArricchimento`**, fuori dal gate del tetto (vale anche a interruttore
spento, o rispegnerlo butterebbe il raccolto) e solo se l'impronta vale ancora per i nomi di adesso.
⭐ Il registro porta ora **`conservate`**, che è il numero che *dice* se il dato si accumula.
📏 Prova che regge: `conservate` **0 → 2 → 4** e le arricchite **da 1 a 84**. Prima era ferma a 1.

📌 **Spenta, quella riga sarebbe rimasta sbagliata per sempre.** Nessuna rilettura l'avrebbe
trovata — il codice, guardato da fermo, è giusto. L'ha detta solo il conto che non saliva.
📌 E il banco era verde e mancava tutto: provava i **pezzi**, e il difetto stava nel modo in cui i
**giri si susseguono**. *Un verde sui pezzi non dice niente sulla catena.*

### 📐 La domanda sua che ha guidato il resto

🗣️ *«il chatbot legge il gestionale e il gestionale attraverso il worker legge matchpoint — sennò
che abbiamo fatto a fare il worker?»*

📏 **Misurato prima di rispondere**: nel worker ci sono **659** riferimenti al pilotaggio del
browser e **zero** chiamate ad API. Matchpoint **non ha un'interfaccia macchina**. ⇒ *«il gestionale
legge direttamente Matchpoint»* e *«il gestionale usa il worker»* sono **la stessa frase**: non
esiste una terza via.

⇒ La regola che ne è uscita, e che vale per i lavori successivi: **si sposta l'ATTESA, non la
FONTE.** Il gestionale risponde subito con quello che il sync ha già raccolto; il worker conferma
dopo e resta autorevole. Nessuno dei due perde il proprio mestiere.

### ⭐ E il principio che ha fatto risparmiare una lettura sulla 143

La scheda prevedeva *«si rinfresca quello, sul colpo»* = **una lettura in più** al worker. Non
serviva: `balanceCentsPost` era **già in mano**, letto nel giro che aveva mosso il denaro.
📌 *Prima di aggiungere una lettura, guardare se la risposta è già nella mano che si ha.*

---

## 📏 LE MISURE CHE VALE LA PENA NON RIFARE

| cosa | valore | quando |
|---|---|---|
| giro di sync **senza** arricchimento | ~67 s | 06/09 |
| giro di sync **con** arricchimento (tetto 1-2) | ~87-111 s | 06/09 |
| ritmo dispatch prenotazioni | ogni 2′, con buchi da 240 s **già prima** di accendere | 06/09 |
| ritmo dispatch **wallet** | ogni 10′ | 06/09 |
| saldi borsellino in archivio | **40** (36 non-zero) — non 2800: il report elenca solo chi ha saldo | 06/09 |
| una lettura worker (ricarica) | **10,6 s** | 06/09 |
| ultimo guasto worker | **29/08** — nessuno nuovo | 06/09 |
| Maurizio Aprea | `member_local_id` `7d454239-929a-4346-8ba0-ec778d7763a3` · id Matchpoint **4** | 06/09 |

---

## ⛔ COSA NON DARE PER FATTO

- ⚠️ **Il borsellino di Maurizio Aprea ha 1 € in più** (5,00 → 6,00), messo dalla prova di stasera.
  È denaro vero: **se va tolto, si storna** — lui non l'ha chiesto, quindi è rimasto lì;
- **la 142 resta APERTA**: la scheda si apre con nomi, id e Osservazioni, ma i **soldi** arrivano
  ancora dal worker a ogni apertura — ed erano parte del *«ho tutti i dati immediatamente»*. Quel
  pezzo è la seconda metà della **143**;
- **la 143 resta APERTA**: fatta la ricarica/storno, manca il **pagamento col borsellino**;
- **l'arricchimento è ACCESO a tetto 1** e continua a girare. Si rispegne in un minuto con
  l'interruttore (Actions → *Interruttore arricchimento schede (voce 142)*, `tetto: 0`). Il dato già
  raccolto **non si perde** — è esattamente ciò a cui serve `conservaArricchimento`;
- **non misurato**: come si comporta l'arricchimento su una **giornata intera**, e cosa succede
  quando l'arretrato finisce (atteso: `lette` scende a 0 da sé — ma è un'attesa, non una misura);
- ⚠️ **la partita di servizio del 7/09 09:00 Campo 4** (Lidia · Fabiola) **passato il 7/09 non c'è
  più**: da lì in poi è un esempio, non un indirizzo.

---

## 🧠 LE TRAPPOLE INCONTRATE OGGI, per non ripagarle

1. 🚨 **Un `git status -sb` che dice «allineato» può mentire**: il fetch ha rivelato 6 giorni di
   ritardo. Si confrontano gli **sha**, non il messaggio.
2. 🚨 **Una query vuota non è una risposta**: prima di concludere «non è successo», si prova che la
   sonda **sa trovare** qualcosa (`select source, count(*) ... group by source`).
3. 🚨 **Una regex sul sorgente può accusare il codice giusto**: `arricchitoAt` compariva su PROD…
   dentro il **commento che avverte contro di esso**. Si guarda sempre il **contesto**.
4. 🚨 **Un file può contraddire sé stesso in più punti**: l'interruttore ne aveva **tre**, incluso il
   riepilogo che stampa *dopo* che l'operatore ha premuto. Si cercano **tutti** prima di toccarne uno.
5. 🚨 **Un checkout per la promozione può tirare dentro file estranei**: `scrittura-al-circolo.ts` è
   entrato per una divergenza **preesistente** — portarlo sarebbe stata una promozione non
   dichiarata. Si controlla sempre `git diff --cached --stat` **e** le righe rimosse.
6. ⭐ **Il modo di scrivere un banco che vale**: sostituzioni sotto `assert` (una mancata **esplode**
   invece di tacere), e **sabotaggi** — se il banco non sa diventare rosso, non ha controllato niente.

---

## Regole di sempre (dal `CLAUDE.md`, che va comunque riletto)

- la catena è **① sviluppo → ② provo su TEST → ③ porto su PROD SENZA CHIEDERE → ④ provo su PROD →
  ⑤ lo avviso**: ci si ferma solo al ⑤, e l'avviso ha **due stati** (🟢 «puoi operare» / 🔴 «non sono
  pronto», con cosa manca);
- **ogni deploy su PROD si annuncia**, misurando `APP_VERSION` **e** `last-modified`;
- si **misura** invece di dedurre, e quando la misura smentisce una riga scritta, **si corregge
  quella riga**, non la si affianca;
- ogni cura si dichiara per quello che ha provato **e** per quello che **NON** ha provato, e **su
  quale ambiente**;
- prima `test-preview`, **poi** un ramo da `main` con le **stesse righe** (la versione si mette a
  mano: è l'unico pezzo che non applica da solo);
- a ogni promozione **PROD prende il numero che TEST aveva**, e **TEST riparte da +1**.
