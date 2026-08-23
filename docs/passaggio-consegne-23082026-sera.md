# Passaggio di consegne — 23/08/2026, sera (52ª sessione)

**Come si usa:** incolla questo file come primo messaggio della chat nuova. È scritto per essere
capito **senza** la conversazione precedente.

⚠️ Segue il passaggio del **pomeriggio del 23/08** (51ª). Se qualcosa sembra contraddirlo, **vince
questo**: qui ci sono le ore dalle 15:00 alle 17:00 circa.

---

## 0. ✅ La prima cosa: CONTROLLARE, non fidarsi di questa riga

```
git fetch origin main test-preview
git diff origin/main origin/test-preview -- CLAUDE.md docs/
```

Nessun output = tutto atterrato.

🚨 **DUE PR RESTANO APERTE, ed è la prima cosa da chiudere — sono un RITIRO URGENTE:**

| | verso | |
|---|---|---|
| **#1015** | `test-preview` | **da fondere per prima** |
| **#1016** | `main` | subito dopo |

Ritirano la chiusura immediata della copia locale (voce 77), che **sta mandando messaggi falsi ai
soci**. Al momento della consegna erano verdi o in corsa: ricontrollare, fondere, e verificare che
il deploy di `matchpoint-bookings-cancel` sia passato.

📌 **Fuso oggi pomeriggio-sera**: #1007/#1008 (scheda 76), #1009/#1010 (cura 76), #1011/#1012
(chiusura 76 + apertura 77), #1013/#1014 (correzione idReserva). Le migrazioni della 76 sono
**applicate** su `cudi…` e `qqbf…`.

---

## 1. 📋 LA LISTA, com'è adesso

### 🔴 URGENTI — 2
| | stato |
|---|---|
| **65** | il nome del worker nel «dettaglio» — curata, in servizio · ⚠️ **si aspetta, non si provoca** |
| **77** | l'annullo dal bot e la copia locale — 🚨 **cura RITIRATA stasera**, vedi sezione 3 |

### 📋 IN CODA — 6
**68** avvisi dal gestionale · **69** scheda senza telefono → socio doppio · **70** il circolo
annuncia una cosa fatta dal socio · **71** «non l'hai organizzata tu» · **72** prenotazione fallita
senza strada · **60** campi liberi nei circoli vicini (sezione D).

### 📦 CHIUSE — 65
🆕 Oggi pomeriggio se ne sono chiuse **quattro**: 66, 73, 74 e **76**.

⚠️ **I conti nel file sono 1/6/65** perché la 77 era stata aggiunta alle urgenti (2) prima del
ritiro. **Da rifare i conti** quando si aggiorna la scheda della 77 — coi grep **copiati da
`guard-docs-truth.yml`**, e ricordando che i numeri stanno in **DUE posti**: il titolo di sezione
**e la tabella riassuntiva in cima**.

---

## 2. ✅ LA VOCE 76 — chiusa, in servizio, provata sul bersaglio

**Il difetto non era la lentezza.** L'unico posto che riempiva `pmo_eventi_staff` era
`matchpoint-bookings-sync`, che vive **leggendo Matchpoint** ⇒ il giorno dello spegnimento gli
avvisi ai soci non rallentavano, **cessavano**.

📏 **Provata alle 15:53** su uno spostamento vero (la `9591` rimessa dalle 11:00 alle 09:30):

| | prova della 74 | prova della 76 |
|---|---|---|
| gesto | 12:27:43 | ~15:53:00 |
| il fatto esiste | 12:34:55 | **15:53:36** |
| sul telefono | 12:36 | **15:54** |
| **totale** | **9′03″** | **~1′30″** |

Verificate quattro cose: la **parola** («spostata»), il **`da`**, l'**origine** (`conferma` ⇒
l'avviso **non passa da Matchpoint**) e il **dedup**.

⚙️ **Com'è fatta**: `_shared/fatti-da-conferma.ts` (regole pure) + `_shared/dichiara-fatti.ts`
(database), innestati in `matchpoint-bookings-edit` (spostamento) e `matchpoint-bookings-cancel`
(annullo). Colonna `origine` su `pmo_eventi_staff`; quiete a 30″ per i fatti da conferma
(`QUIETE_DA_CONFERMA_MS`); dedup nel sync con finestra legata al **confine del giro precedente**
(non a un tempo fisso: la pausa notturna del sync dura **5h04′**).

---

## 3. 🚨🚨 IL LAVORO DELLA PROSSIMA SESSIONE: la voce 77 e la CORSA COL SYNC

### Cos'è successo, in ordine

1. **Il difetto di partenza**: un annullo dal bot lasciava la copia locale del gestionale a
   occupare il campo fino al giro di sync. Misurato che il buco notturno è di **5 ore e 4 minuti**
   (00:58 → 06:02, due notti identiche) ⇒ un annullo dopo l'una lasciava il campo occupato **fino
   alle sei del mattino**, e la disponibilità che il bot offre ai soci legge proprio quelle righe.
2. **La cura** (`_shared/chiudi-copia-locale.ts`): dopo la conferma, chiude le righe dello slot e
   lascia la lapide `staff_suppress` nella forma che scrive l'app.
3. **Prima prova, 16:19 — NON è entrata in funzione.** Il ponte compone la richiesta come
   `target.idReserva ? { idReserva } : { campo, data, ora }`: per una prenotazione venuta dal sync
   manda **solo l'id**, e la cura senza la terna si arrendeva — **in silenzio**, perché quel ramo
   non aveva un log. Corretta (#1013/#1014): da un `idReserva` lo slot si ricava
   (`slotDaIdReserva`), e ogni strada che si arrende lascia una riga.
4. **Seconda prova, 16:34 — la chiusura ha funzionato**: tre righe (`booking`,
   `booking_occupancy`, `staff_booking`, coi due formati di campo) chiuse in **200 millisecondi**,
   lapide con `ids: ["9595"]`, il bot non mostrava più la partita, e il log
   `copia_locale_chiusa righe:3` è arrivato **172 ms prima** che il bot rispondesse «fatto».
5. 🚨 **Ma due minuti dopo è arrivato un messaggio FALSO**: *«Sei in campo — Lunedì 31 agosto alle
   09:30. Ti ha messo in partita il circolo»* — per la partita appena annullata.

### 🔎 La causa, per quel che è accertato

Il sync del giro delle **14:36** stava lavorando su un export scattato alle **14:34:01**, cioè
**prima** dell'annullo delle 14:34:29. Nel frattempo la cura aveva già chiuso le righe locali ⇒ il
confronto ha visto «prima non c'era, adesso c'è» e l'ha raccontato come `aggiunto`.

**Log della prova**: `{"event":"eventi_staff","slotPrima":76,"slotDopo":77,"accodati":1,"giaDettiDallaConferma":0}`

⚖️ **La protezione ESISTE e non ha funzionato.** La lapide `staff_suppress` dovrebbe far
**resuscitare** la riga sepolta nella fotografia di *prima* (voce 73, `sepoltiDaResuscitare`):
allora prima e dopo coinciderebbero e non nascerebbe nessun fatto. `slotPrima: 76` dice che la
resurrezione **non è avvenuta**.

### ⛔ Le piste — NESSUNA VERIFICATA, e non vanno date per buone

1. ⭐ **La più promettente**: `loadSepoltiESoppressioni` cerca i sepolti **solo** fra i
   `record_type = 'booking'` (`.eq('record_type','booking')`), mentre la cura ne seppellisce
   **tre** tipi. Da capire se basta, e se il `booking` sepolto viene trovato davvero.
2. Il confine usato (`ultimoGiroImportedAt`) rispetto all'istante della lapide: la lapide è delle
   14:34:29 e il confine dovrebbe essere ~14:34:01 o precedente, quindi *sulla carta* entra —
   ma va **misurato**, non dedotto.
3. `MARGINE_LAPIDI_MS` e la finestra dei sepolti.

🚨 **La prova che serve prima di rimettere la cura**: far vedere che, con la copia chiusa e la
lapide scritta, il giro di sync successivo **non accoda niente** (né `aggiunto` né `annullata`).
Finché non la si è vista, la chiusura non torna in servizio.

### Stato del codice

- La chiamata a `chiudiCopiaLocaleDelloSlot` è **commentata** in `matchpoint-bookings-cancel`
  (#1015/#1016), col perché per esteso accanto.
- Il modulo `_shared/chiudi-copia-locale.ts` **resta nel repo, provato 11/11**: manca la difesa
  contro la corsa, non la cura.
- ⚠️ **Verificare dopo il merge** che il deploy sia passato e che un annullo non produca più
  `aggiunto` falsi.

---

## 4. 🧠 Trappole imparate oggi — le più costose

- 🚨⭐⭐ **UNA CURA CHE TACE QUANDO NON PARTE È INDISTINGUIBILE DA UNA CHE FUNZIONA.** Il ramo
  «coordinate assenti» tornava `0` senza log: la cura *sembrava* in servizio mentre non era mai
  entrata in funzione, e la diagnosi ha dovuto procedere **per esclusione** invece di leggere un
  errore. ⇒ *Ogni strada che si arrende deve lasciare una riga*, e «zero cose da fare» va distinto
  da «non sono arrivato fin qui».
- 🚨⭐⭐ **CURARE UN'ATTESA PUÒ APRIRE UNA CORSA.** Chiudere la copia *prima* del sync ha creato una
  finestra in cui il gestionale e un export in volo raccontano due storie diverse — e ne è uscito
  un messaggio **falso**, che è peggio del ritardo che si stava togliendo. ⇒ Prima di anticipare un
  effetto, chiedersi **chi altro sta guardando quello stato adesso**.
- 🚨⭐ **UNA GUARDIA SI PROVA SOLO DOPO AVER VISTO PASSARE CIÒ CHE DEVE FERMARE.** Sul dedup della
  76: alle 15:57 i doppioni erano zero **ma il sync non aveva ancora visto lo spostamento** —
  quello zero non diceva «funziona», diceva «non ha ancora avuto occasione di sbagliare». Riuscito
  a riconoscerlo *prima* di dichiararlo; sul `aggiunto` falso è servito lo stesso riflesso.
- 🚨 **IL COMMENTO CHE PREVEDE IL PROPRIO CASO VA LETTO INTERO.** Accanto alla riga del ponte c'era:
  *«su tutti i record veri `id_reserva` è vuoto, quindi parte la terna — e un giorno in cui non
  fosse più così, questa è l'unica riga che lo direbbe prima e non dopo»*. Quel giorno era oggi:
  la prima metà della frase era stata letta, la seconda no.
- 🔎⭐ **UNA DOMANDA CHIEDE UNA MISURA, NON UNA RISPOSTA.** *«Il `da` lo porta l'app o si ricava
  dalla copia locale?»* aveva una terza risposta che nessuna delle due nominava: **l'app lo mandava
  già** e noi lo buttavamo. ⇒ *Prima di aggiungere una fonte, guardare cosa arriva e si sta
  scartando.*
- 🚨 **IL CODICE NON SOPRAVVIVEVA ALLA MIGRAZIONE MANCANTE**: il sync scriveva `origine` esplicito e
  la lettura la chiedeva nella select ⇒ colonna assente = **nessun avviso a nessuno**. Curato (il
  sync non la scrive, la lettura riprova senza). È la lezione di `staff_edit` dell'11/08.
- ⚠️ **`consegnato_at` NON vuol dire «inviato»**: i fatti coperti da una ricevuta (voce 70) vengono
  marcati consegnati **senza** essere spediti. Leggere quel campo come «il socio l'ha ricevuto» è
  un errore.
- ⚠️ **Da questa sessione cloud `deno check` sugli `index.ts` NON gira**: il proxy blocca `jsr.io`
  ed `esm.sh`. I moduli senza quegli import si controllano (`deno` si installa da **npm**, non da
  `deno.land`); per gli `index.ts` il gate è la CI. E la CI ha trovato un errore vero.

---

## 5. 🧰 Attrezzi, e cosa serve sapere

| | |
|---|---|
| **Supabase MCP** | `execute_sql` su `qqbf…` (PROD), `cudi…` (TEST) · ⭐ **`query_logs`** legge i log delle edge (`source='function_logs'`): è così che si è vista la causa |
| `stato-worker.yml` | sonda di sola lettura sul worker |
| `deploy-edge-functions-prod.yml` | parte da `main` al merge; ~1 minuto |
| 🚨 **trappola del deploy** | sceglie le funzioni con `awk '$3 !~ /^_/'` ⇒ **le cartelle `_shared/` sono saltate**: toccare solo un modulo condiviso non manda in servizio niente |

📌 **Verificare sempre che la versione in servizio sia quella nuova**: `list_edge_functions` dà
`version` e `updated_at`. Oggi è servito per escludere che il difetto fosse un deploy mancato.

**Fusi orari**: il registro del bot è in ora di Roma, il database e i log in **UTC**.

---

## 6. 🔧 Cose in sospeso, piccole

- 🗣️ **Il committente ha chiesto di portare anche la CREAZIONE sulla strada della conferma**
  (*«mettiamo i tempi giusti»*), dopo la 77. Oggi una prenotazione fatta dal gestionale arriva al
  socio in **~2′45″** (misurato: vista dal sync alle 16:28:01, consegnata alle 16:30:46) perché
  passa ancora dallo specchio: `matchpoint-bookings-create` **non** è stata innestata.
- Lo slot **31/08 · 09:30 · Campo 1** è libero: la `9591` e la `9595` sono state annullate durante
  le prove.
- `CLAUDE.md` dichiara che il bot chiama **quattro** edge `consumer-*`: sono **cinque**.

**Stato alla consegna**: urgenti **2**, coda **6**, chiuse **65** (⚠️ i conti nel file vanno rifatti
dopo il ritiro). Due PR aperte (#1015, #1016) col **ritiro urgente**. La 76 è in servizio e provata.
