# Passaggio di consegne — 03/09/2026, notte (fine 76ª sessione)

**Come si usa:** incollalo come primo messaggio della chat nuova. È scritto per essere capito
**senza** la conversazione precedente.

---

## 🟢 LA PRIMA COSA DA SAPERE

> **La voce 139 è chiusa a prova fisica sua, e il semaforo (137) è scritto per intero.** Ma la
> cosa che conta di più non è una cura: è **un difetto che ho introdotto io e che ha trovato lui
> al primo click** — il nome del giocatore apriva **la scheda di un'altra persona**.
> 🚨 **Ed era un difetto che il progetto aveva già pagato in produzione il 2/08**, con un
> avvertimento in maiuscolo dentro il worker che io ho scavalcato fidandomi di una riga di scheda.
> ⏳ **Il lavoro che comincia:** provare fisicamente ciò che sta su TEST (137 ④b e 138), poi
> decidere se promuoverlo. E la **140**, che è la misura che rende utile la 138.

| | inizio sessione | adesso |
|---|---|---|
| versioni app | PROD 6.284 · TEST 6.297 | **PROD 6.285 · TEST 6.302** |
| PR fuse | — | **#1304 → #1312** (nove) |
| banco | 85 verdi | **92 verdi / 0 rossi** |
| urgenti | 6 | **5** |
| in coda | 14 | **15** (nasce la 140) |
| chiuse | 115 | **116** |

⚖️ **Il filo della giornata, e non è lusinghiero:**
> *Due volte il pezzo che stavo per costruire **esisteva già**; una terza volta il codice mi
> diceva in tre punti come fare e **ho creduto alla scheda invece che al codice**. La cosa che ha
> fatto la differenza, tutte e tre le volte, è stata **andare a guardare** — o, l'ultima volta,
> **il suo dito su TEST**.*

---

## 0. 📦 Stato alla consegna

| | |
|---|---|
| PR | **#1304 → #1312** fuse. ⚠️ **Controlla che la #1312 sia stata fusa**: era l'ultima e la CI stava ancora girando |
| rami | `main` ↔ `test-preview` allineati sui 4 percorsi sorvegliati, **sull'intero worker** e sull'edge `matchpoint-queue-status` |
| deployati | app **PROD 6.285** · **TEST 6.302** · worker su Hetzner (**3 riavvii oggi**, sync verificato vivo dopo ciascuno) · edge `matchpoint-queue-status` su `qqbf…` e `cudi…` |
| migrazioni · bot | **non toccati** |

### ⛔ LE COSE DA FARE PER PRIME
1. **Verificare che la #1312 sia fusa** e ricontrollare la parità dei rami.
2. **Le due prove fisiche che aspettano LUI** su TEST — §2. Senza quelle, 137 e 138 non si chiudono
   e **non vanno su PROD**.
3. **La voce 140** (§4): è la misura che decide se la 138 serve a qualcosa o resta al 3%.

---

## 1. ✅ Prima di lavorare

```bash
git fetch origin main test-preview
git diff origin/main origin/test-preview -- CLAUDE.md docs/ .github/workflows/ \
  tools/matchpoint-browser-worker/src/server.mjs
```
✅ Dev'essere vuoto. 📕 `docs/lavori/README.md` si apre **PRIMA di lavorare**.
🚨 Clone shallow: `git reset --hard origin/<ramo>` dopo il fetch.

Il banco NON si lancia con `node --test`:
```bash
r=0; v=0
while IFS= read -r f; do
  grep -qE "^\s*(import|export).*['\"]jsr:" "$f" && continue
  if node "$f" >/dev/null 2>&1; then v=$((v+1)); else r=$((r+1)); echo "❌ $f"; fi
done < <(find supabase consumer-app tools test \( -name '*.test.ts' -o -name '*.test.mjs' \) | sort)
echo "$v verdi, $r rossi"
```
🩹 **Sintassi di `index.html`**: `node test/controlla-sintassi.mjs`.
🩹 **Controlla l'ORA prima di scrivere una data**: `TZ=Europe/Rome date '+%Y-%m-%d %H:%M'`.

---

## 2. ✋ LE DUE PROVE CHE ASPETTANO LUI — su TEST, e bloccano due voci

Sono la ragione per cui 137 ④b e 138 **stanno su TEST e non su PROD**. Non sono formalità: il
calendario è la superficie che guarda tutto il circolo, e la disposizione del semaforo lui l'ha
scelta **da disegni**, non dal vivo.

| voce | cosa deve fare | cosa dimostra |
|---|---|---|
| **138** | apri una scheda partita su `test.padelvillage.club`, **digita un importo**, clicca un nome, chiudi la scheda socio | che l'importo si ritrova. Dal codice risulta di sì (né `openMemberCard` né `closeMemberCard` toccano `staffCalPlayersState`), **ma non è provato** |
| **137 ④b** | guarda il **bordo basso** del calendario mentre qualcuno fa un gesto | che la barra si veda e si legga. E **la cella accesa**, che io non ho potuto misurare |

🚨 **Per la 138 serve un socio che abbia l'ID INTERNO** — sono **121 su 3764** (§4). Su un socio
che non ce l'ha il nome è **muto per costruzione**, e la prova non prova niente.

⛔ **La cella del semaforo non l'ho potuta misurare in nessun modo**: con l'utenza `readonly` della
console remota la griglia è **vuota** (`1 figlio, 0 celle`), e **su telefono la vista è l'agenda,
non la griglia** ⇒ lì le celle `.cell` **non esistono per costruzione**, e su mobile della
disposizione D resta **solo la barra**. Non è un difetto (è il motivo per cui la D ha due metà), ma
**va detto**: gliela avevo presentata come «barra + cella» a due larghezze.

---

## 3. 🔨 COSA HA FATTO LA 76ª

| voce | esito |
|---|---|
| **139** 👛 il Wallet accanto all'importo | 📦 **CHIUSA**, prova fisica sua su PROD 6.285 |
| **137** 🚦 il semaforo di Matchpoint | ⏳ **①②③④a su PROD, ④b su TEST** — aspetta il suo occhio |
| **138** 🔗 il nome apre la scheda socio | ⏳ **su TEST 6.302** — apriva la persona sbagliata, curato |
| **140** 🔢 l'id interno ce l'hanno 121 soci su 3764 | 🆕 **aperta**, nata da una misura |

### 🚨🚨⭐⭐ IL DIFETTO CHE HO INTRODOTTO IO, e che è la cosa da non ripetere

Il nome cliccabile della 138 apriva **la scheda di un'altra persona**: cliccando *Filippo
Battistella* si apriva *Giovanni Modanese*. L'ha visto **lui, al primo click**, su TEST 6.301.

⚖️ **La causa è il TERZO NUMERO.** Matchpoint dà a ogni persona **due numeri distinti**:
· il **codice cliente** della tendina («000140-Nome») → anagrafica: `memberId`, letto da `pmoIdMatchpoint`;
· l'**id interno** (`id_people`) → anagrafica: `matchpointIdInterno`, letto da `_staffCalPlayerCode`.

Il roster del worker porta `HiddenFieldIdCliente`, che **malgrado il nome è l'ID INTERNO**
(`server.mjs:5763` lo dice a parole). Confrontarlo col codice cliente fa combaciare **due
numerazioni diverse che si sovrappongono**.

🚨 **E il progetto l'aveva già pagato**, con un avvertimento in maiuscolo nel worker da un mese
(`server.mjs:6525`): il **2/08/2026, in PRODUZIONE**, il codice cliente di Laura Aprea (140) era
identico all'id interno di Marco Aprea (140), e **un giocatore sparì da una partita sotto un
«✅ confermato»**.

📌 **La lezione, ed è la più cara della giornata**: la scheda della voce 138 diceva *«il socio si
trova confrontando `p.idCliente` con `pmoIdMatchpoint(g)`»* e **l'ho preso per buono**. Il codice mi
smentiva in **tre** punti — il commento di `_staffCalPlayerCode` **tre righe sopra la funzione che
stavo scrivendo**, quello di `pmoIdMatchpoint`, e l'avvertimento del worker.
⇒ *Una cura si disegna sul difetto raccontato e si convalida sul **codice**: se il racconto e il
codice non combaciano, vale il codice.*

⚠️ **Ed era il difetto peggiore possibile**, perché è **silenzioso**: non dà errore, apre una scheda
**vera** con dentro una **persona vera**. In cassa la sera si ricarica il Wallet di chi non c'entra.

🔨 **Curato** confrontando l'**id interno** da tutt'e due le parti, con `_staffCalPlayerCode`.
⛔ **Nessun ripiego sul nome**: davanti a un id che non aggancia la risposta è **nome muto**.
Cercare «per nome che somiglia» rimetterebbe in piedi la classe di difetto appena tolta.
🧪 Il banco ora **esercita proprio questo caso**: fra i soci di prova il `memberId` di uno vale
quanto il `matchpointIdInterno` di un altro ⇒ chi guarda la colonna sbagliata diventa rosso.

### ⭐ E DUE VOLTE IL PEZZO ESISTEVA GIÀ

① **Il semaforo (137) era funzionante e SPENTO da tre mesi.** `/queue/status` risponde, l'edge era
ACTIVE, `svcPollQueueStatus` e `svcRenderQueueStatus` erano scritte e complete: mancava **la riga
che le accende**, commentata il 3/06/2026 (`58fee80`) e **non per un difetto del dato** — per
**ingombro**. Una sovrapposizione non ingombra ⇒ quella ragione cade.

② **La ⓒ della 138 era dichiarata «la più lunga da fare» ed era la più corta.** `openMemberCard`
**non cambia tab**: disegna in `#memberCardOverlay`, un `position:fixed` **fratello del login**
(`index.html:6548`), fuori da ogni tab.
⚠️ **E la stima sbagliata non allungava solo il lavoro: rendeva PEGGIORI le altre due opzioni che
gli avevo messo davanti.** Se avesse scelto la ⓐ o la ⓑ avremmo pagato un prezzo per un problema
che non c'era.

📌 *Prima di costruire, guarda cosa c'è già.*

---

## 4. 🔢 LA VOCE 140 — la misura che decide se la 138 serve

📏 **Misurato su PROD il 03/09**, con `pmo_cloud_records` (`record_type = 'member'`):

| | soci attivi | con **id interno** | con **codice cliente** |
|---|---|---|---|
| PROD | **3764** | **121** (3%) | 1110 (29%) |

⇒ Oggi il nome della 138 è cliccabile per **tre soci su cento**. Il click non è *sbagliato*:
**non c'è**. 🗣️ E la sua frase era *«cliccando il nome ti apre la sua scheda»*, non *«ogni tanto»*.

📌 **Perché è basso**: `matchpointIdInterno` si scrive **solo** quando l'app aggiunge un giocatore a
una partita e il worker restituisce `idPeople`. Cresce con l'uso, ma da 121 a 3764 non ci arriva.

🔨 **La strada da guardare — e va MISURATA prima di sceglierla**: far portare l'id interno al **sync
clienti**, che l'anagrafica la rilegge tutta. ⚠️ **Da verificare se la pagina da cui `export-clients`
legge lo espone**; se non lo espone, la strada è un'altra e costa di più.

⛔ **Cosa NON fare**: agganciare il socio **per nome**. È indovinare la persona, ed è la stessa
classe di difetto appena curata.

---

## 5. 🚦 LA VOCE 137 — dove sta, pezzo per pezzo

| pezzo | dove | cosa fa |
|---|---|---|
| **①** worker | ✅ PROD | `mpJobMeta` ha smesso di chiamare «modifica» una **lettura** (`edit` con `read:true`, cioè **aprire una scheda**) e «nuovo cliente» una **ricerca** (`client` con `soloRicerca`) |
| **②** edge | ✅ PROD | `create`/`edit`/`cancel` inoltrano `chiestoDa` (**il ruolo**, non l'email) |
| **③** edge queue-status | ✅ PROD | filtra l'automatico e traduce in **frasi del gestionale** |
| **④a** coordinate | ✅ PROD | `dove = {campo, data, ora}`, **complete o niente** |
| **④b** la barra | 🧪 **TEST** | disposizione **D**: barra sovrapposta + cella accesa |

### Le decisioni sue, che il codice esegue
① **disposizione D** · ② **il sync automatico NON si vede** (*«questo io non vorrei vederlo»*) ·
③ 🔄 **i gesti dal chatbot SÌ** (ha ribaltato) · ④ 🔄 **l'ESITO non va sul semaforo** (ha ribaltato,
e questa ha **cancellato il pezzo più rischioso**: nessuna memoria degli esiti nel worker).

### 📏 Misure col browser su TEST — e cosa NON dicono
| | desktop 1440×900 | telefono 390×844 |
|---|---|---|
| la griglia si sposta? | **no** — `dy 0 · dh 0` | **no** — `dy 0 · dh 0` |
| barra larga quanto la colonna | ✅ 1058 px | ✅ 390 px |
| ruba i click? | **no** (sotto risponde `.svc-grid-col`) | — |
| il testo ci sta? | ✅ 62 caratteri | ⛔ **43 su 61** → curato |

🚨 **Sul telefono si perdeva il «CHI»**: a cadere era `richiesta da un socio`, l'unica cosa che dice
a chi fa segreteria *se è stata lei o no*. ⇒ La edge manda `che` e `chi` **separati** e si tronca
solo il `che`. 📌 *Chi compone una frase a monte decide cosa si perde quando lo spazio finisce, e a
monte nessuno sa quanto spazio c'è.*

⛔ **La CELLA non è stata provata** — vedi §2.

### 🩹 E la scheda della 137 aveva una riga FALSA
Diceva che la coda riconosce un gesto del bot *«solo perché gli MANCA `operatore` — un'assenza»*.
**Misurato: falso.** `consumerActor` dà al bot un attore **pieno**, con `role: 'consumer'` e un'email
sua, su tutte e tre le edge. Non c'era un'assenza da rendere esplicita: c'era un **ruolo** che si
fermava all'edge. ⇒ `chiestoDa` porta il **ruolo**, non l'email — *una regola che poggia su una
stringa che qualcun altro può rinominare è una scommessa, non una regola.*

---

## 6. 👛 LA VOCE 139 — chiusa, e la decisione da poter ribaltare

📦 **CHIUSA** su PROD 6.285 con la sua schermata: *«mi sembra che ci sia tutto»*. `👛 29,00 €` con
Wallet acceso, `👛 0,00 €` con Wallet spento.

✅ **Ha confermato il trattino**: *«va bene così lascia il trattino»*. I tre casi sono:

| il socio | il gestionale | scrive |
|---|---|---|
| ha 29 € | l'ha letto | `👛 29,00 €` |
| **ha zero** | l'ha letto | `👛 0,00 €` |
| **non lo so** | lettura non arrivata (cella assente o timeout 1500 ms) | `👛 —` |

📌 *`0,00 €` su un saldo ignoto **inventa un fatto**; il trattino fa solo guardare il bottone Wallet.*

---

## 7. 🧠 I DIFETTI PRESI — la parte da non ripetere

- 🩹⭐⭐ **Il codice batte la scheda.** Tre punti del codice mi dicevano come agganciare il socio, e
  ho creduto a una riga di scheda. Costo: la scheda della persona sbagliata, trovata da lui.
- 🩹⭐ **Una guardia deve rompersi su ciò che è sbagliato, non su ciò che ne parla.** **Tre volte**
  una sonda ha cercato «questa cosa non deve comparire» e ha pescato **il commento che spiega
  perché non si fa**. La cura è diventata una funzione: `soloCodice()`.
- 🩹 **Un catch che ingoia tutto acceca chi prova.** Un banco diceva «il socio non si trova» mentre
  a non funzionare era **la sonda** (mancava un argomento, il `ReferenceError` finiva nel
  `try/catch`). *Quando una prova fallisce contro una funzione difesa così, il primo sospettato è
  la prova.*
- 🩹 **Un oggetto ricostruito campo per campo perde i campi nuovi in silenzio.** `mpQueueRun`
  costruiva il job senza spread: `gesto` non arrivava allo snapshot ⇒ **semaforo spento per
  sempre**, indistinguibile da «non sta succedendo niente».
- 🩹 **Non ritagliare «N caratteri intorno».** Due sonde erano rosse per il proprio ritaglio: una
  contava le graffe da `function` invece che dal corpo (e la firma `(op, body = {})` chiudeva il
  ritaglio dopo tre caratteri), l'altra pescava il bottone della riga accanto.
- 🩹 **`git checkout origin/main -- <cartella>` tira indietro anche ciò che non c'entra.** Riallineando
  le edge ho riportato indietro `scrittura-al-circolo.ts`, più avanti su `test-preview`: **banco rosso**.
  Si portano **le righe del commit**, non le cartelle.
- 🩹 **Node in cloud può essere «small-icu»**: `toLocaleString('it-IT')` non mette il separatore
  delle migliaia. Un banco che lo pretende è rosso **per il proprio interprete**, non per l'app.
- 🩹 **Node 22 importa i `.ts` da solo.** Avevo scritto una spogliatura dei tipi a mano con una fila
  di `replace`: fragile e rossa per conto sua. *Prima di costruire un aggeggio, guarda come lo fanno
  i pezzi accanto.*

---

## 8. 🔎 FATTI MISURATI CHE VALE LA PENA NON RISCOPRIRE

- **La console remota NON può aprire una scheda partita**: blocca tutto `/functions/v1/`
  (`tools/verifica-browser/console.mjs:164`) e la lettura del roster passa di lì. ⇒ Le sonde che
  vogliono una scheda vera **non si possono fare** senza `--allow-writes`, che su PROD resta a domanda.
- **Con l'utenza `readonly` la griglia del calendario è VUOTA** (`1 figlio, 0 celle`): va bene per
  misurare il layout, non per misurare le celle.
- **Su telefono il calendario è l'AGENDA, non la griglia** (`wrapVisibile:false`, `agendaVisibile:true`).
- **Il worker si deploya SOLO da `main`**, e ogni deploy riavvia il processo **condiviso TEST+PROD**:
  costa **un tick del sync** (latenza, non dati — l'export è a finestra piena). Misurato: salta il
  giro, riprende al successivo.
- **Il sync prenotazioni si controlla così**, senza entrare sulla VM:
  `select max(updated_at) from pmo_cloud_records where record_type='booking'` su `qqbf…`.
- **`app-meta.json` su `test.padelvillage.club` dice quale commit è live** — e ci mette ~30 s.
- **PROD ha `max-age=600`**: dopo un merge si guarda `last-modified`, non solo il numero di versione.
- **La guardia della voce 128 è viva e morde**: nel gestionale la parola è **Wallet**, non
  «borsellino». Ha fermato la prima stesura della 139.

---

## 9. 🤝 Come si procede (invariato)

> *«Procediamo sempre come tu pensi sia corretto»* — copre anche le promozioni; il freno è la
> **dichiarazione**. Fuori: **inventare voci non in lista** (la 140 nasce da una **misura**, ed è
> lecito), e l'irreversibile/visibile (si dice **prima**, anche procedendo).
> ✋ **Un task non è finito finché non è provato fisicamente.**
> 📌 E: **«scrivi troppo» — risposte corte.**

⭐ **La regola che oggi ha pagato di più, e che è costata**: *guarda cosa c'è già, e credi al codice
prima che alla scheda.* Due volte il pezzo esisteva; la terza volta il codice aveva ragione e io no.
