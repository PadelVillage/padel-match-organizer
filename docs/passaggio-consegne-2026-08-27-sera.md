# Passaggio di consegne — 27/08/2026, sera (fine 54ª sessione)

**Come si usa:** incollalo come primo messaggio della chat nuova. È scritto per essere capito
**senza** la conversazione precedente.

⚠️ Sessione nata da *«leggi allegato»* e finita con **sei sue segnalazioni consecutive**, tutte
dal telefono, tutte su una cosa che stava già in servizio. Quattro PR sul gestionale, due sul bot,
due deploy del bot dei soci. **Il filo della giornata è uno solo, e conviene saperlo prima di
cominciare: ogni volta che si è andati a misurare la cosa che lui segnalava, sotto ce n'era
un'altra più grave che nessuno aveva visto.** Tre volte su tre.

---

## 1. ✅ Prima di lavorare: aprire `docs/lavori/README.md` (obbligo che non è cambiato)

**La lista è aggiornata**: i conti sono **9 urgenti / 10 in coda / 77 chiuse**.

```
git fetch origin main test-preview
git diff origin/main origin/test-preview -- CLAUDE.md docs/ .github/workflows/
```
Nessun output = tutto atterrato. **Verificato vuoto a fine sessione.**

🆕 **Serve anche il repo del bot**: `PadelVillage/assistente-padel-agent` → `add_repo`,
`git clone --depth 1`, **poi `npm install`** (senza, il banco dà rosse fasulle e `tsc` non gira).
🆕 **E `tools/verifica-browser` vuole il suo `npm install`** prima del primo uso della console.

### 🟢 Cosa gira davvero, misurato a fine sessione

| dove | versione | note |
|---|---|---|
| **gestionale `main`** | APP_VERSION **6.248** | verificato live su `app.padelvillage.club` |
| **`test-preview`** | APP_VERSION **6.251** | ⚠️ i due rami divergono **molto**, vedi il punto ⛔ qui sotto |
| **bot dei soci** (VM) | deploy delle **21:34** (run #105) | dichiara `qqbf… (PROD)` · `✍️ prenotazioni REALI` |
| **banco del bot** | 1608/1608 | |
| **banco del gestionale** | tutto verde | + `sabotaggi-lista-maestro` 10/10 |
| **edge PROD** | `assessment-quiz`, `assessment-apply-level`, `consumer-assessment-link`, `consumer-assessment-decision` | deployate e **lette nel log del deploy** |

⛔🚨 **IL DIVARIO `test-preview` ← `main` È CRESCIUTO MOLTO OGGI, e va saputo prima di toccare
qualsiasi cosa nella catena `assessment-*`.** Su `test-preview` ci sono solo **due** delle cure di
oggi (le 720 opzioni corte e la domanda 4); tutto il resto — la retrocessione tolta, il fatto
dietro il «mi tengo il livello», la frase del maestro, il tetto e la scala spostati in
`giro-del-test.ts`, la lista allargata — **sta solo su `main`**.
📏 Misurato provando a portarne un pezzo: quel ramo è indietro anche su `giro-del-test.ts`
(`ORE_SILENZIO_ASSENSO = 24` contro lo 0 di `main`) che vive in **tre copie** che una guardia
esige identiche byte per byte. ⇒ **Portare i pezzi uno alla volta lascia il banco rosso**: il
riallineo è un lavoro a sé, da fare **in un giro solo**, e non è ancora una voce in lista.

---

## 2. 🚨🚨 IL FILO DELLA GIORNATA: sotto ogni cosa segnalata ce n'era una più grave

Tre volte, e ogni volta la cosa più grave **non l'aveva vista nessuno**, lui compreso.

| lui ha segnalato | andando a misurare si è trovato |
|---|---|
| *«i testi sono tagliati sul cellulare»* | 🚨 **i puntini non erano di Telegram, erano NOSTRI**: `ETICHETTA_SICURA` valeva **28** — una stima messa apposta bassissima — e a una risposta di 31 caratteri ne restavano 24. Telegram quella riga la reggeva intera |
| *«manca il bottone che mi lascia il livello»* | il bottone mancava **per una buona ragione** (non c'era nessun fatto dietro). La cura non era rimetterlo: era **dare un fatto al gesto** |
| *«da avanzato in su digli di andare in segreteria»* | 🚨 il bot annunciava la fascia **DICHIARATA** come livello. Sotto Intermedio coincidono, sopra divergono ⇒ chi dichiarava Avanzato si sentiva dire *«il tuo livello è Avanzato»* mentre in scheda aveva **Intermedio**. Non incompleto: **falso**. E chi era già sopra il tetto **non riceveva nessun messaggio** |

📌 *Prima di curare quello che è stato segnalato si va a guardare CHI lo sta causando: metà delle
volte il colpevole è il proprio codice, e la cura è smettere di fare una cosa invece di farne
un'altra.*

---

## 3. 🔨 COSA È STATO FATTO, in ordine

**① Voce 98/C — la lista del maestro si aggiorna da sé** (6.245 → 6.246).
📏 Le porte del sync delle risposte erano **tre** ed erano chiuse **tutte e tre**: il bottone
dentro il tab congelato, il refresh legato allo stesso tab, e `assistantSyncResponses` il cui
bottone viene scritto in `#assistantPlan` — **elemento che nel DOM non esiste** (0 occorrenze).
⇒ Il rinfresco si aggancia **dove la lista vive**: ingresso in Anagrafica soci (freno 60 s) e
filtro «Da certificare» con `force`. Gettoni **prima** delle risposte.
📏 Provato su dati veri: `0 → 50` risposte.

**② Le 720 opzioni del regolamento accorciate** (6.246 → 6.247), sua scelta fra tre anteprime.
**302 su 720** riscritte, massimo **36 caratteri**. Il tetto del bottone sale a 36 e il numero
davanti sparisce (numerava un elenco che non c'è più). ⚖️ Accorciare la banca è sicuro perché la
correzione confronta la risposta con `opts[correct]` **della stessa banca**: le due parti cambiano
insieme. Sulle otto domande della scheda invece il testo **è** il dato, e là si accorcia con la
coppia `[valore, testoBreve]`.

**③ La domanda 4 riformulata**: *«Con giocatori di che livello te la giochi alla pari?»* con
risposte *«Contro Avanzati»*. Il `valore` resta il numero della fascia. Scartate da lui: togliere
la 4 e togliere la 3.

**④ La retrocessione automatica TOLTA** — *«la leverei del tutto, anche come testo nel bot e nei
docs»*. Il livello **non scende mai da solo**. Tolti i tre numeri, il contatore delle prove, la
coda della frase, **e le due guardie che quella coda la pretendevano**.

**⑤ Il conto dei tentativi tolto dal messaggio d'esito.** 📏 `GIORNI_DI_ATTESA = 0` dal 25/08: i
giri sono infiniti e attaccati, quindi il conto scendeva verso un muro che non c'è.

**⑥ Il «mi tengo il mio livello» torna un bottone**, perché adesso ha un fatto dietro:
`consumer-assessment-decision` accetta «mi fermo» anche su una prova **non riuscita**.

**⑦ Chi sta sopra il tetto riceve un messaggio** che dice il livello **vero** e lo manda in
segreteria dal maestro.

**⑧ Voce 100 — la lista del maestro si allarga** (6.247 → **6.248**), su sua decisione.
Criterio da *«in scheda ≤ tetto»* a **`dimostrato > in scheda`**. E la **stessa regola dai due
lati**: `sopraIlTetto` (che manda il socio in segreteria) ha preso il terzo controllo, o chi ha 4
e dimostra 4 si sarebbe presentato al circolo senza comparire in Anagrafica.

---

## 4. ⏳ COSA RESTA DA FARE, in ordine

**A. 🔴 LA PROVA FISICA DI TUTTO, dal suo telefono.** È l'unica cosa che manca a **tutti** i
lavori di oggi, e va chiesta a lui. Cosa deve vedere:
· **il test**: dalla prima all'ultima domanda, bottoni con la risposta **intera** e **nessun
  elenco sopra** (prima le domande di regolamento avevano il doppione);
· la **domanda 4** che dice «Contro Avanzati» e non ripete le sette parole della 3;
· sbagliando apposta: *«Vuoi rifarlo, o ti tieni il livello che hai adesso in scheda?»* con **due
  bottoni** — «🔄 Sì, lo rifaccio» e «👍 Mi tengo il mio livello» — e **nessun conto di tentativi**;
· toccando il secondo: *«Va bene 👍 Il livello che hai adesso in scheda resta quello»* — e **non**
  «te lo registro»;
· dichiarando **Avanzato** e passando il quiz: il messaggio che dice *«Per adesso in scheda hai
  X»* e lo manda in segreteria dal maestro.

**B. 🔴 LA VOCE 100 ASPETTA UNA PERSONA IN LISTA.** Il meccanismo è provato al banco (con i casi
verificati rossi sul codice di ieri), ma **nessun socio vero ci è ancora comparso**. Il primo
candidato è **Santiago Carabajal** (dimostrato 5, in scheda 0,5), che ci finirebbe usando il
bottone «Ricollega le N schede che non si riconoscono» in Anagrafica soci.
⚠️ È una **scrittura sul gestionale**: si dice prima.

**C. 🟠 IL RIALLINEO `test-preview` ← `main` della catena `assessment-*`.** Vedi il punto ⛔ del
§1: è un lavoro a sé, va fatto in un giro solo, e **non è ancora una voce in lista** — se serve,
la voce la deve volere lui.

**D. 🟡 Il rinfresco della voce 98/C non è provato dal vivo nel cablaggio**: l'utenza `readonly`
della console remota non ha `view_members`, quindi da lì Anagrafica soci **non si apre**. Il gesto
vero — entrare nella scheda e vedere la lista popolarsi — aspetta un giro dal Mac o dalle sue mani.

📌 Le altre urgenti restano **97**, **92**, **84**, **83**, **69**, **78**, **65**.

---

## 5. 🧠 LE TRAPPOLE DI OGGI

**① 🚨🚨 UN BANCO VERDE PRIMA E DOPO UN CAMBIO DI REGOLA NON COPRE QUELLA REGOLA.** Cambiando il
criterio della lista del maestro, i 14 casi esistenti sono passati **tutti**, prima e dopo. ⇒ Si
sono aggiunti quattro casi e un sabotaggio, e li si è **rigirati col codice di ieri** per vederli
rossi. *Un caso che non cade quando la regola cambia non prova quella regola: la circonda.*

**② 🚨 UNA GUARDIA CHE ESIGE UNA FRASE È LA COSA CHE LA TIENE IN VITA.** Togliendo la
retrocessione e il conto dei tentativi, **cinque** prove sono diventate rosse — tutte perché
*pretendevano* le frasi appena tolte. Lasciarle avrebbe voluto dire riscrivere quelle frasi per
far tornare il verde. ⇒ Si **rovesciano**, non si cancellano.

**③ 🚨⭐⭐ UN BOTTONE SENZA UN FATTO DIETRO NON SI AGGIUNGE: gli si dà un fatto.** È la forma della
cura del «mi tengo il livello», e vale in generale su questo bot.

**④ 📌 DUE REGOLE CHE RISPONDONO ALLA STESSA DOMANDA O SONO UNA SOLA, O DIVERGONO.** La regola
«chi va dal maestro» è nata la mattina nel ponte e la sera nel gestionale con **due forme
diverse**. Chi paga la divergenza è chi ci cammina.

**⑤ ⚠️ `git stash` + `git checkout -- .` mi ha fatto perdere un port intero**, e la misura che ne
è uscita era **sbagliata**: avevo dichiarato «questi rossi preesistono su questo ramo» e rigirando
il banco su `origin/test-preview` pulito erano **zero**. ⇒ Per sapere se un rosso preesiste si
parte da un ramo **pulito**, non da un albero rimescolato.

**⑥ ⚠️ `?:` nelle firme rompe i banchi.** I banchi estraggono le funzioni dal sorgente vero e
spogliano le annotazioni con una regexp che il punto interrogativo non conosce: la `vm` muore con
`Unexpected token '?'`. Si scrive `livelloAttuale: any`, non `livelloAttuale?: any`.

**⑦ ⚠️ Una tabella fuori da una funzione non viene estratta.** Stessa causa: `LIVELLI is not
defined`. Le tabelle stanno **dentro** la funzione che le usa.

**⑧ ⚠️ La copia locale di un ramo invecchia dopo un merge fatto via API.** Un `-B ramo
origin/test-preview` senza `git fetch` prima ha prodotto una PR in conflitto.

**⑨ ⚠️ `actions_list` sfonda il contesto**: salvare su file e leggere con `python3 -c`, mai
stampare.

---

## 6. 🧰 Attrezzi

| | |
|---|---|
| console remota | `node console.mjs --env prod --file x.js --out /tmp/r.json` in `tools/verifica-browser` (dopo `npm install`). `--url http://localhost:PORTA/index.html` la punta su una **copia locale** dell'app col database vero |
| 🚨 nella console | i nomi si leggono **NUDI**: `APP_VERSION`, `assessmentResponses` sono `let/const`, su `window` non ci sono. Guardare lì dà `-1` con la faccia di «non c'è niente» |
| banco gestionale | `node test/<nome>.test.mjs` · banco bot: `node --test test/*.test.ts` |
| tipi del bot | `npx tsc --noEmit -p tsconfig.json` |
| deploy bot | `deploy-bot-hetzner.yml`, `soci` + la parola `SOCI` — poi `stato-bot.yml` per **leggere** dove punta |
| ordine push docs | prima `test-preview`, poi `main` |
| commit | mai backtick in `-m`: heredoc con `-F -` |

---

## 7. 🤝 Come si procede (invariato)

> *«Procediamo sempre come tu pensi sia corretto»* — copre anche le promozioni; il freno è la
> **dichiarazione**. Fuori: inventare voci non in lista, e l'irreversibile/visibile (si dice prima).

✋ **Un task non è finito finché non è provato fisicamente.** Oggi **niente** lo è: tutto è in
servizio e aspetta un giro dal suo telefono (punto **A**). È dichiarato in tutte le schede.

🗣️ **E la riga guadagnata oggi, che vale come istruzione**: quando lui segnala una cosa, la prima
mossa non è curarla — è **misurare chi la sta causando**. Tre volte su tre il colpevole era un
pezzo nostro che nessuno sospettava, e due volte la cosa trovata era **più grave** di quella
segnalata.

📌 E una cosa sua che vale come istruzione: **«scrivi troppo».** Risposte corte.
