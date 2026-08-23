# Passaggio di consegne — 23/08/2026, notte (53ª sessione)

**Come si usa:** incolla questo file come primo messaggio della chat nuova. È scritto per essere
capito **senza** la conversazione precedente.

⚠️ Segue il passaggio della **sera del 23/08** (52ª). Se qualcosa sembra contraddirlo, **vince
questo**: qui ci sono le ore dalle 17:00 alle 22:00 circa.

---

## 0. ✅ La prima cosa: CONTROLLARE, non fidarsi di questa riga

```
git fetch origin main test-preview
git diff origin/main origin/test-preview -- CLAUDE.md docs/ .github/workflows/
```

Nessun output = tutto atterrato. **Alla consegna: nessuna PR aperta, niente in rosso.**

🆕 **C'è un SECONDO repo in gioco, e serve**: `PadelVillage/assistente-padel-agent` (il bot).
Si aggiunge con `add_repo` + `git clone --depth 1`, e **poi `npm install`** — senza, il banco dà
40 rosse fasulle (`ERR_MODULE_NOT_FOUND: @mastra/core`) e sembrano difetti veri. Non lo sono.

---

## 1. 📋 LA LISTA, com'è adesso

### 🔴 URGENTI — 2
| | stato |
|---|---|
| **65** | il nome del worker nel «dettaglio» — curata, in servizio · ⚠️ **si aspetta, non si provoca** |
| **78** | «2 posti liberi» su una partita piena — **curata in due metà, in servizio, MAI VISTA FUNZIONARE** |

### 📋 IN CODA — 8
**68** avvisi dal gestionale · **69** scheda senza telefono → socio doppio · **70** ✅ curata ·
**71** ✅ curata · **72** ✅ curata · 🆕 **79** l'avviso va solo a chi si è mosso · 🆕 **80** chi è
tolto resta nell'elenco · **60** campi liberi nei circoli vicini (sezione D).

### 📦 CHIUSE — 66
🆕 Chiusa stasera la **77**, a cura vista sul bersaglio.

🚨 **I conti si rifanno coi grep copiati da `guard-docs-truth.yml`**, e stanno in **DUE** posti:
il titolo di sezione **e** la tabella riassuntiva in cima. Alla consegna: **2 / 8 (C 7 + D 1) / 66**,
verificati.

---

## 2. ✅ LA VOCE 77 — chiusa, e la prova è il modello di come si prova

Un annullo dal bot lasciava il campo occupato **da noi** fino a **5 ore e 4 minuti** (la pausa
notturna del sync, 01:00-06:00).

🚨 **La cura, provata alle 16:34, ha mandato un «Sei in campo» FALSO** e alle 16:46 è stata
ritirata. **La causa non era sua**: il sync leggeva le due metà della fotografia di «prima» in due
momenti, con l'**upsert in mezzo**, e l'upsert riportava a `deleted = false` la riga che la
resurrezione della voce 73 cerca fra i sepolti (`risorti: 0`).

⚖️ **E la stessa corsa era già viva per un annullo della SEGRETERIA**: la cura non l'aveva creata,
l'aveva resa facile da vedere. ⇒ *Una cura ritirata ha pagato la diagnosi di un difetto che non era
suo.*

🔨 Rimedio: **dieci righe spostate 320 righe più su** — le due metà si leggono ora nello stesso
istante, prima dell'upsert. Guardia `ordine-fotografia.test.ts`, **vista farsi rossa** sul sorgente
di prima.

📏 **La prova, alle 18:06:50, nel caso peggiore possibile:**

| | |
|---|---|
| annullo dal bot | 31/08 · 09:00 · Campo 1, ore **18:06:50** · `copia_locale_chiusa righe:3` |
| avviso al socio | `annullata` da **conferma**, consegnato **18:08:46** |
| il giro di sync | export **18:06:02** — **48 secondi PRIMA** dell'annullo, la finestra esatta della bugia |
| esito | `sepolti_risorti righe:1` e **`slotPrima:81 slotDopo:81 accodati:0`** |

⇒ *Non «non è successo niente di male», ma «è passato di lì e non è successo niente».*

---

## 3. 🚨🚨 IL LAVORO DELLA PROSSIMA SESSIONE: la prova fisica della 78

### Cos'è la 78

`/prenotazioni` elencava **quattro** giocatori e nella stessa riga diceva **«2 posti liberi»**.
Causa: i **nomi** (`compagni`) includono `staff_booking`, che il gestionale scrive **subito**; il
**conteggio** (`giocatori`) nasce solo dalla `descrizione`, che la scrive Matchpoint e torna col
sync. 📏 Finestra misurata: staff 17:57:19, sync 18:03:03 ⇒ **5′44″**.

### La cura, in due metà (tutt'e due in servizio)

| | dove | in servizio |
|---|---|---|
| ① | `rigaElenco` → `quantiInCampo = null` a letture discordi | **20:54:25** (PR #64 del repo bot) |
| ② | la **scheda** → `elencoIncerto`: niente `— posto libero —`, niente «Siete al completo» | **21:50:20** (PR #65) |

🚨 **La ② è nata da un mio errore, ed è il reperto da ricordare**: la ① copriva **una sola** delle
due forme in cui il socio vede la stessa partita. La scheda conta per conto suo
(`elencoInCampo`: `4 − giocatori.length`) e non passa da `quantiInCampo`.
📌 *Se lo stesso fatto si mostra in due forme, una regola messa in una sola è mezza regola* — e la
domanda giusta non è «dove ho visto il difetto» ma **«dove si prende il dato»**.

### ⏳ COSA MANCA — la prova fisica, e come farla

**Serve un'AGGIUNTA, non una rimozione** (una rimozione non apre la finestra: vedi voce 80).

1. Partita già sincronizzata in cui il socio c'è;
2. dal **gestionale** si **aggiunge** un giocatore;
3. entro ~2 minuti, `/prenotazioni` **fresco** sul bot, e si apre quella partita.

| | |
|---|---|
| ✅ | l'elenco **senza** righe `— posto libero —`, **senza** «Siete al completo», con la riga *«⏳ Questo elenco sta cambiando proprio adesso»* |
| ❌ | righe vuote o un conteggio ⇒ si ritira |

⚠️ **Ospiti NO.** Li avevo scelti per non disturbare nessuno e hanno reso la prova non
rappresentativa: due «Ospite» hanno lo stesso nome e quasi lo stesso codice. **La prova va fatta
con persone vere** — che è anche il caso da cui la voce nasce.

🚨 **E la finestra va colta al volo**: passata, le due letture tornano d'accordo e la riga si
raddrizza da sé — cioè lo stesso schermo che non prova più niente.

---

## 4. 🆕 LE DUE VOCI NUOVE, uscite dal collaudo

### 79 — l'avviso arriva SOLO a chi si è mosso

🗣️ Sua segnalazione: *«a Maurizio sul bot non è arrivato nessun messaggio che si è aggiunto un
ospite o si era levato un ospite»*.
📏 Misurato su `pmo_eventi_staff`: fra le 21:15 e le 21:35 **un fatto solo** (la creazione della
partita). Per l'ospite tolto e per quello aggiunto: **zero**.
🔎 I fatti `aggiunto`/`tolto` sono **intestati a chi si è mosso**. Riprova: alle 18:00 sono stati
aggiunti Fabio e Andrea → **due** fatti, uno per ciascuno; a Maurizio e Benso, in campo, **niente**.
⚖️ Collide con la regola del 23/08 (*«le persone che sono dentro la partita devono essere
avvisate»*), che era stata applicata all'annullo e allo spostamento — **non** all'entrata e uscita.

### 80 — chi è stato TOLTO resta nell'elenco

📏 Ospite tolto **21:25:48**, ancora mostrato alle **21:27:22**, sparito col sync delle **21:27:53**
⇒ **2′05″**.
🔎 `compagni` prende il **massimo** fra le liste dello slot ⇒ un'**aggiunta** fa contraddire le due
letture (e lì la 78 interviene), una **rimozione** no: il roster vecchio resta il massimo, le due
letture **concordano su un dato sbagliato**, nessuna guardia scatta.
⚖️ *Una regola costruita sul disaccordo è cieca quando le due fonti sono d'accordo e hanno torto
insieme.*
🚨 Danno pratico: «Togli un giocatore» offre una persona **già uscita**.
📌 Strada probabile: il dato per distinguerle c'è già ed è **`synced_at`** — la lista più fresca
dovrebbe vincere sul massimo. Stessa medicina della **73**, applicata alla lettura.

---

## 5. 🤝 DUE REGOLE NUOVE DEL COMMITTENTE, ora in `CLAUDE.md`

### «Procediamo sempre come tu pensi sia corretto»

⇒ Non si chiede il permesso per ogni passo. **Copre anche le PROMOZIONI** dalla coda alle urgenti
(chiesto e risposto: *«sì, copre anche le promozioni»*). La riga vecchia — *«si propongono, non si
eseguono»* — è stata **corretta**, non affiancata.
⛔ Restano fuori **due** cose: **inventare un lavoro che nella lista non c'è** (la delega copre
l'*ordine*, non l'*esistenza*), e ciò che è **irreversibile o si vede da fuori**, che si dice prima.
⚖️ Il freno che sostituisce il permesso è la **dichiarazione**: una promozione si scrive col perché
e con cosa scavalca.

### «Un task non è finito finché non lo si è provato fisicamente»

⇒ Sul **gestionale** o sul **bot**. Non contano: il banco verde, i log puliti, il deploy riuscito,
il sorgente in servizio letto — e soprattutto **uno zero letto troppo presto**.
⏳ Se la prova non si può fare adesso, il task resta **aperto** e la scheda dice **cosa manca**.

---

## 6. 🧠 Trappole imparate stasera — le più costose

- 🚨⭐⭐ **QUANDO UNA PREVISIONE SUL COMPORTAMENTO SBAGLIA DUE VOLTE, LA TERZA NON SI PREVEDE: SI
  ESEGUE.** Ho predetto due volte cosa avrebbe mostrato il bot, sbagliando. La terza ho copiato i
  moduli veri in una cartella e li ho **fatti girare sui payload veri** presi dal database: dieci
  righe di banco, risposta in un colpo. *Leggere il codice produce ipotesi; eseguirlo produce fatti.*
- 🚨⭐⭐ **UNA CURA MESSA DOVE SI È VISTO IL DIFETTO PUÒ ESSERE MEZZA CURA.** Lo stesso dato si
  mostrava in due forme e ne ho curata una. ⇒ *La regola si mette dove si PRENDE il dato.*
- 🚨⭐ **UNA PROVA FISICA VA DISEGNATA SUL CASO VERO.** Ho scelto gli **ospiti** per non disturbare
  nessuno, e ho reso la prova non rappresentativa. Poi ho fatto **togliere** invece di
  **aggiungere**, che non apre nemmeno la finestra. *Comodo per chi prova ≠ uguale al difetto.*
- 🚨 **UN NUMERO RIFERITO CON SICUREZZA E MAI VERIFICATO È PEGGIO DI NESSUN NUMERO.** Il banco del
  bot dava «40 rosse» e stavo per chiamarle preesistenti: erano `node_modules` non installati.
  Con `npm install`: **1481 verdi, 0 rosse**.
- 🔎 **LA ⭐ NELLA SCHEDA NON È QUELLA DELL'INTESTAZIONE.** Ci ho costruito sopra una deduzione
  intera prima di accorgermene. *Un segno che compare in due posti con due significati va
  verificato, non riconosciuto a colpo d'occhio.*
- ⚠️ **`/prenotazioni` con le frecce NON rilegge**: sfogliare paginava uno stato precedente. Per una
  prova a finestra serve il **comando**, non le frecce.

---

## 7. 🧰 Attrezzi

| | |
|---|---|
| **Supabase MCP** | `execute_sql` su `qqbf…` (PROD), `cudi…` (TEST) · ⭐ `query_logs` legge i log delle edge |
| **repo del bot** | `assistente-padel-agent` — `add_repo`, clone, **`npm install`**, `npm test` |
| `deploy-bot-hetzner.yml` | `workflow_dispatch` · bersaglio `soci` **richiede la parola `SOCI`** |
| `stato-bot.yml` | 🔎 sola lettura: `pm2 describe` + registro con una regex — è così che si legge **cosa ha scritto il bot, al secondo** |
| 🚨 **trappola del deploy edge** | `awk '$3 !~ /^_/'` ⇒ le cartelle `_shared/` sono **saltate**: toccare solo un modulo condiviso non manda in servizio niente |

**Fusi orari**: il registro del bot è in **ora di Roma**, il database e i log in **UTC**.

---

## 8. 🔧 Cose in sospeso, piccole

- 🚨 **Due prenotazioni con esito IGNOTO** nel registro errori del bot (`worker connection refused`):
  **26/08 · 09:30 · Campo 1** e **29/08 · 09:00 · Campo 1**. Verificato sul gestionale: **non
  esistono e i campi sono liberi** ⇒ non sono passate. Le righe non sono datate: non so dire quando.
- 🧹 **La partita di prova** 31/08 · 09:00 · Campo 1 (Maurizio + 2 ospiti) è ancora lì: si annulla.
- Il committente ha chiesto di portare anche la **CREAZIONE** sulla strada della conferma
  (`matchpoint-bookings-create` non è innestata): oggi ~2′45″ perché passa dallo specchio.
- `CLAUDE.md` dichiara che il bot chiama **quattro** edge `consumer-*`: sono **cinque**.

**Stato alla consegna**: urgenti **2**, coda **8**, chiuse **66**. Nessuna PR aperta, guardie verdi,
`main` e `test-preview` allineati. La 77 è chiusa a cura vista; la 78 è in servizio ma **non ancora
vista funzionare**.
