# Passaggio di consegne — 23/08/2026, notte fonda (54ª sessione)

**Come si usa:** incollalo come primo messaggio della chat nuova. È scritto per essere capito
**senza** la conversazione precedente.

⚠️ Segue il passaggio della **notte del 23/08** (53ª). Se qualcosa lo contraddice, **vince
questo**: qui ci sono le ore dalle 22:00 a mezzanotte, e sono state fitte.

---

## 0. ✅ La prima cosa: CONTROLLARE, non fidarsi di questa riga

```
git fetch origin main test-preview
git diff origin/main origin/test-preview -- CLAUDE.md docs/ .github/workflows/
```

Nessun output = tutto atterrato. **Alla consegna: nessuna PR aperta, guardie verdi.**

🆕 **Serve anche il repo del bot**: `PadelVillage/assistente-padel-agent` → `add_repo`,
`git clone --depth 1`, **poi `npm install`** (senza, il banco dà ~40 rosse fasulle che non lo sono).
Banco alla consegna: **1506 verdi, 0 rosse**.

---

## 1. 📋 LA LISTA, com'è adesso

### 🔴 URGENTI — 4
| | |
|---|---|
| **83** 🆕🚨🚨 | **il bot ha detto «non ci sono riuscito» a un annullo che ERA passato** — vedi §2, è il lavoro della prossima sessione |
| **69** 🔼 | scheda doppia → il bot dice «Non hai prenotazioni» a chi ne ha. Tampone fatto e provato, **causa no** |
| **78** | «2 posti liberi» su una partita piena — **cura vista funzionare**, resta il bottone da toccare |
| **65** | il nome del worker nel «dettaglio» — si aspetta, non si provoca |

### 📋 IN CODA — 8
**68** · **70** · **71** · **72** · **79** *(molto cresciuta, vedi §3)* · **80** · 🆕 **81** · **60** (sez. D)

### 📦 CHIUSE — 67
🆕 Chiusa stanotte la **82** (i posti da Ospite li toglie la segreteria), a cura vista da lui.

🚨 I conti si rifanno coi grep copiati da `guard-docs-truth.yml`, e stanno in **due** posti (titoli
di sezione **e** tabella riassuntiva in cima). Alla consegna: **4 / 8 (C 7 + D 1) / 67**, verificati.

---

## 2. 🚨🚨 IL LAVORO DELLA PROSSIMA SESSIONE: la voce 83

### Cosa è successo, misurato con due sonde che non si parlano

| ora | cosa |
|---|---|
| 23:37:28 | il committente conferma **dal bot** l'annullo del 31/08 · 09:00 · Campo 1 |
| **23:39:59** | il bot: *«🔧 Non ci sono riuscito — la tua prenotazione è rimasta com'era. Riprova fra poco»* |
| 23:43 | su **Matchpoint** (schermata sua) il Campo 1 alle 09:00 è **VUOTO** |

🔎 **Che non l'abbia annullata nessun altro è misurato**: in tutta la mezz'ora **nessun**
`staff_cancel`, **nessun** `staff_suppress`, **nessuna** ricevuta in `pmo_ricevute_gesti` per
l'annullo (c'è solo quella del «tolto Marco» delle 23:37:19). ⇒ L'unica mano su quello slot è il bot.

### Perché è grave

🚨 **È la voce 72 al rovescio**, cioè il caso che quella voce esiste per evitare. La 72 aveva
introdotto `esitoDellaRispostaWorker` (i codici del **fallimento certo** elencati, tutto il resto
**ignoto**). Qui il verdetto è stato **«certo»** su una scrittura **riuscita**.
⇒ La stessa classificazione governa la **create**, dove «riprova» su una prenotazione riuscita
vuol dire **doppia prenotazione**. Stanotte il danno è stato nullo **per fortuna**: sull'annullo il
verso sbagliato è innocuo.

🚨 **E non è finito con la frase.** Alle **23:44** il bot ha scritto al socio di quella partita —
*«il tempo per disdire scade sabato 29 agosto… il campo resta a tuo carico e si paga per intero»* —
cioè una **scadenza di pagamento su un campo già libero**, perché la copia locale la crede viva.
📌 *Un «no» falso su una scrittura non resta una frase: diventa lo stato del mondo per tutto ciò
che legge la copia.*

### Il contorno, che è metà della diagnosi

⏱️ **Il sync era FERMO**: ultimo giro riuscito **23:35:27**, e alle 23:43 erano passati **8 minuti**
contro una cadenza di 2. L'annullo ha impiegato **2′31″** invece di ~10 secondi. ⇒ Il worker era in
difficoltà, e la copia locale non poteva smentire la frase perché era **più vecchia del gesto**
(23:34:04, cioè prima delle 23:37).
📌 *Una frase che afferma sul passato va verificata su un dato più fresco del gesto.*

### Le due piste, e come si sceglie

🗣️ **La sua**: *«secondo me il problema sta sull'ospite»*. La sostiene: l'annullo **riuscito** della
voce 77 (18:06:50, pochi secondi) era su una partita col **solo** Maurizio; questo, lento e
raccontato male, su una con **due «Ospite»** — e stanotte i posti ospite hanno già rotto un'altra
cosa (voce 82).
⚠️ **Non la prova**: due casi non sono una regola, e il worker in difficoltà è una spiegazione
alternativa completa.

⇒ **Si decide guardando gli `steps` del worker su quell'annullo**, che sono scritti: dicono a che
punto della ficha si è piantato. È la stessa strada della 72, dove la crepa dentro
`SAVE_BUTTON_NOT_FOUND` si è distinta con ciò che il worker **già scriveva**, senza toccarne una riga.

📌 **Da guardare per primo, senza scrivere niente**: che codice ha dato il worker sull'annullo, e se
quel codice sta nell'elenco dei fallimenti **certi** di `matchpoint-bookings-cancel`.
⚠️ Il verso non è simmetrico: *un «non lo so» di troppo costa un'attesa; un «non è passata» falso
costa un campo occupato due volte.*

---

## 3. 🔕 LA VOCE 79, molto cresciuta — e ci sta dentro il «Un giocatore è uscito»

🗣️ Decisione sua di stanotte: *«trattala dentro la 79»*.

📏 **Rimisurata su TRE gesti in un colpo solo.** Alle 23:07 la segreteria cambia la formazione del
31/08 · 09:00 · Campo 2: **fuori Lidia, fuori Fabiola, dentro Marco**. Il sync li vede alle
**23:10:04**, li consegna alle **23:13:49** — e i tre fatti sono intestati **a chi si è mosso**. A
**Maurizio** e a **Laura**, in campo: **zero**.

🚨 **La seconda porta**: a chi resta un messaggio arriva lo stesso, ma dall'**altra macchina** (i
promemoria, `testoTornataIncompleta`), e dice **«Un giocatore è uscito»**. Ne erano usciti **due**
ed era **entrato Marco**, che non viene nominato.
🔎 Quella macchina non guarda i gesti, guarda **un numero** (`giocatori_visti`): da 4 a 3 fa −1, e
il **netto** viene raccontato come un **evento**.

📌 Terzo dettaglio: «Ora siete **in tre**: Laura Aprea e Marco Aprea» promette tre nomi e ne elenca
**due** — il terzo è chi legge.

⇒ **La cura dovrà essere UNA**: i fatti nascono dai **gesti**, non da un conteggio, e vanno a
**tutti quelli in campo**. Se poi la macchina dei promemoria debba ancora dire la sua, o tacere
perché l'ha già detto il fatto, è la prima cosa da decidere — due macchine che raccontano lo stesso
cambiamento sono il modo di ottenere due messaggi che si contraddicono.

---

## 4. ✅ Cosa è stato fatto e PROVATO stanotte

**Quattro deploy sul bot dei soci** (`deploy-bot-hetzner.yml`, bersaglio `soci`, parola `SOCI`).

| | provato da lui sul telefono |
|---|---|
| **78 — la cura** | ✅ alle 22:20, nella finestra esatta e larga **33 secondi** (staff 22:19:31 → sync 22:20:04): tre nomi, nessun `— posto libero —`, nessun «Siete al completo», la riga ⏳ |
| **74** | ✅ quattro `aggiunto` consegnati alle 22:12:43, **il primo dell'elenco compreso** |
| **69 — il tampone** | ✅ *«funziona»* |
| **82 — tutt'e due le metà** | ✅ *«Sì, corretto… ed è la cosa giusta»* |
| **78 — il bottone** | ⏳ in servizio e adesso **visibile**, ma non ancora toccato in una finestra vera |
| **81** | ⏳ in servizio, non riproducibile (i due doppioni sono stati curati) |

### Le cure messe in servizio, in ordine

1. **22:36** — il bottone «🔄 Aggiorna» sotto la riga «questo elenco sta cambiando» (voce 78).
2. **23:04** — **81**: «non riesco a riconoscerti» invece di «non hai prenotazioni» · **82** (metà):
   un tocco che il bot non capisce adesso **lo dice** e scrive il codice grezzo nel registro.
3. **23:28** — il bottone Aggiorna **si vede** (la riga porta l'ora della lettura, coi secondi) ·
   **82**: i posti da Ospite non si segnano più, e al loro posto c'è la riga con la segreteria.

---

## 5. 🧠 Le trappole imparate stanotte — le più costose

- 🚨⭐⭐ **UN AGGIORNAMENTO CHE NON SI VEDE È UN BOTTONE MORTO.** Ho messo «Aggiorna» in servizio e
  un'ora dopo lui l'ha toccato **dodici volte** dicendo «non funziona». Il registro diceva il
  contrario: il bot rileggeva ogni volta, ma il testo veniva identico e la guardia anti-doppione non
  riscriveva. ⇒ *La cura non è disarmare la guardia: è dare al testo qualcosa di VERO da cambiare.*
- 🚨⭐⭐ **UNA REGOLA MESSA DOVE SI DISEGNA E NON DOVE SI ESEGUE dura quanto la schermata più vecchia
  rimasta in chat.** Avevo filtrato gli ospiti nella tastiera e nella conferma di gruppo, non nella
  via singola: un bottone vecchio l'avrebbe scavalcata.
- 🚨⭐⭐ **UN «NON LO SO» CHE PRENDE LA FORMA DI UN «NO» è peggio di un errore**: è indistinguibile
  dalla verità per chi lo legge. Vale per la 81 (elenco vuoto → «non hai prenotazioni»), per la 82
  (tocco non capito → silenzio) e per la **83**, che è la stessa forma su una **scrittura**.
- 🚨⭐ **ESEGUIRE INVECE DI PREVEDERE, e farlo PRIMA.** La prova della 78 è stata predetta copiando i
  moduli veri e girandoli sul payload vero letto da PROD, un minuto prima. Serviva: il dubbio era se
  i due «Ospite» facessero **concordare per sbaglio** le due letture — un falso negativo che avrebbe
  fatto passare la prova senza provare niente.
- ⚠️ **UNA PROVA VECCHIA CHE CADE È UN REGALO, non un fastidio.** `uscita-elenco` confronta
  l'oggetto intero *«per accorgersi del campo nuovo»* e si è accorta del mio. Due prove del «togli»
  sono cadute perché provavano il gesto che la decisione toglieva: **convertite, non cancellate**.
- ⚠️ **Le mie prime due indicazioni al committente erano sbagliate**: gli ho fatto aprire il bot su
  una finestra che non era quella della 78 (partita non ancora sincronizzata ⇒ il roster non si
  legge affatto, e la cura vive un gradino dopo).

---

## 6. 🧰 Attrezzi

| | |
|---|---|
| **Supabase MCP** | `execute_sql` su `qqbf…` (PROD), `cudi…` (TEST). ⚠️ Le prenotazioni stanno in **`pmo_cloud_records`** (`record_type` = `booking`, `booking_occupancy`, `staff_booking`, `staff_suppress`, `staff_edit`, `member`), non in tabelle `booking` |
| **stato-bot.yml** | 🔎 sola lettura sul bot: `pm2 describe` + registro con una **regex** — è così che si legge cosa ha fatto il bot **al secondo**. Vale più di qualunque ipotesi |
| **deploy-bot-hetzner.yml** | bersaglio `soci` **richiede la parola `SOCI`** |
| **il banco al volo** | copiare i moduli veri in una cartella e girarli sui payload veri: `node --experimental-strip-types` |
| ⚠️ **rami del bot** | dopo uno squash-merge il ramo di lavoro va **ricreato da `origin/main`**, non riusato: `git checkout -B <ramo> origin/main` |

**Fusi orari**: il registro del bot è in **ora di Roma**, il database e i log in **UTC**.

---

## 7. 🔧 Cose in sospeso, piccole

- 🧹 **La partita di prova Campo 1 è annullata su Matchpoint** ma il gestionale non lo sa ancora
  (sync fermo): quando il sync riparte dovrebbe sparire da sé. **Da ricontrollare**, ed è anche la
  conferma finale della 83.
- 🧹 Resta la partita di prova **31/08 · 09:00 · Campo 2** (Laura, Maurizio, Marco).
- ⏱️ **Il sync era fermo alle 23:43 da 8 minuti**: prima cosa da guardare riaprendo, perché se è
  ancora giù è un guasto del worker e viene prima di tutto il resto.
- Il committente ha chiesto (dal passaggio precedente, ancora aperto) di portare anche la
  **CREAZIONE** sulla strada della conferma.
- `CLAUDE.md` dichiara che il bot chiama **quattro** edge `consumer-*`: sono **cinque**.

---

## 8. 🤝 Come si procede (dal `CLAUDE.md`, non cambiato stanotte)

> *«Procediamo sempre come tu pensi sia corretto per la buona riuscita del progetto.»* — e copre
> **anche le promozioni**. Il freno non è il permesso, è la **dichiarazione**.

⛔ Restano fuori due cose: **inventare un lavoro che nella lista non c'è**, e ciò che è
**irreversibile o si vede da fuori**, che si **dice prima** (anche procedendo).

✋ E: **un task non è finito finché non lo si è provato fisicamente** — sul gestionale o sul bot.
Il banco verde, i log puliti e il deploy riuscito **non contano**.

**Stato alla consegna**: urgenti **4**, coda **8**, chiuse **67**. Nessuna PR aperta, `main` e
`test-preview` allineati, banco del bot 1506 verdi.
