# Passaggio di consegne — 26/08/2026, sera (fine 53ª sessione)

**Come si usa:** incollalo come primo messaggio della chat nuova. È scritto per essere capito
**senza** la conversazione precedente.

⚠️ Sessione nata da *«leggi allegato»*. Ha fatto due cose grosse: la **prova fisica della voce 98**
— che ha **smentito la voce 98** e ha scoperto due guasti veri — e **quattro giri di correzioni
sue** sul test di livello dentro Telegram, l'ultimo dei quali preso a domanda invece che a naso.
Undici deploy: tre del bot dei soci, due di edge PROD, il resto app e documenti.

---

## 1. ✅ Prima di lavorare: aprire `docs/lavori/README.md` (obbligo che non è cambiato)

**La lista è aggiornata**: i conti sono **8 urgenti / 10 in coda / 77 chiuse**.

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
| **gestionale `main`** | APP_VERSION **6.245** | verificato live su `app.padelvillage.club` |
| **`test-preview`** | APP_VERSION 6.249 | i due rami divergono su `index.html` e `assessment-quiz/**` |
| **bot dei soci** (VM) | deploy delle **19:13** (run #103) | dichiara `qqbf… (PROD)` · `✍️ prenotazioni REALI` |
| **banco del bot** | 1595/1595 | |
| **banco del gestionale** | tutto verde | |
| **edge PROD** | `assessment-quiz` e `consumer-assessment-link` ridistribuite | verificate leggendo il sorgente **vivo** |

🚨 **GITHUB ACTIONS ERA LENTISSIMA nel pomeriggio**, e va saputo o si perde un'ora: alcune PR sono
rimaste **senza nessun check per 25 minuti**, con `mergeable_state: blocked`. ⇒ Non è la PR rotta.
Le vie d'uscita, in ordine: aspettare; lanciare il workflow a mano con `workflow_dispatch` (ma
`guard-main-prs.yml` **non ce l'ha**); spingere un commit **vero** sul ramo, che rifà partire tutto.
⛔ Mai un commit vuoto e mai chiudi-e-riapri.

---

## 2. 🚨🚨 LA COSA PIÙ IMPORTANTE DELLA GIORNATA: la 98 era in servizio e NON FUNZIONAVA

La lista del maestro (voce 98, costruita in mattinata) risultava **vuota su dati veri**. Non per la
sua regola — il banco era verde e la regola è giusta — ma per **due guasti a monte**, in un'altra
funzione, che nessuna rilettura del codice della 98 avrebbe potuto vedere.

| | il guasto | la misura |
|---|---|---|
| ① | `syncAssessmentResponsesFromSupabase` si autenticava con la **chiave pubblicabile** | dal 16/08 la RPC `get_self_assessments_by_tokens` ha la guardia di staff ed è concessa solo ad `authenticated` ⇒ **401 `permission denied`, per chiunque**, da dieci giorni |
| ② | il sync dei gettoni teneva **UN gettone per socio** e buttava gli altri | ma una scheda si aggancia **per gettone**: 49 schede su Supabase, **30** arrivate all'app. Fra le 19 perdute, quella del **26/08 delle 08:27** — il caso per cui la voce esiste |

📏 **Come si è misurato ①**, ed è la forma da rifare: le **due chiamate una accanto all'altra**
dentro l'app viva di PROD — chiave pubblicabile → **401**, gettone di sessione dello staff → **200**.
Una sola delle due non avrebbe distinto «l'utente non può» da «nessuno può».

🔨 **Curati** (`main`, 6.244 → **6.245**). La cura non inventa niente: `previousTokens` esisteva già
e lo riempiono gli altri **tre** punti che sostituiscono un gettone — questo era l'unico che non lo
faceva. Banco nuovo `test/il-gettone-vecchio-non-si-butta.test.mjs`, 9 casi, tre sabotaggi.

✅ **Prova fisica fatta sull'app pubblicata**: **50 risposte su 50** (prima 0 per un browser nuovo,
30 col solo ② curato), la più recente delle 13:33, la scheda del 26/08 delle 08:27 agganciata.
Il filtro «Da certificare dal maestro» si apre e risponde **«Nessun socio trovato»**.

🚨📌 **E quel «nessun socio trovato» oggi è la risposta GIUSTA, verificata nome per nome:** Maurizio
è già a 4, Carmelo a 4, Oriana a 5 — per loro non c'è niente da certificare. **Chi ci dovrebbe stare
è Santiago Carabajal** (dimostrato 5, in scheda 0,5) e non compare perché la sua scheda è agganciata
a un `member_local_id` **cancellato**: nel cloud ha **sei** righe socio, cinque `deleted`, e il
gettone punta a una di quelle. È la famiglia già nota delle **schede non collegate** — ha il suo
bottone e il suo banco — e si ricollega di là.
⇒ **Del meccanismo la prova è completa; manca una persona in lista.** Il primo che ci finirà dentro
è la prova finale, e va guardata quando succede.

📌 *Uno zero non è un risultato: è la stessa faccia che ha «non ho potuto contare».*

---

## 3. 🗣️ LE SUE QUATTRO CORREZIONI SUL TEST NEL BOT, e come sono finite

### ① «C'è un doppione nelle domande» + «sul cellulare diversi testi sono tagliati»
Due frasi nello stesso messaggio, e sembravano in contrasto. **Non lo erano**: parlavano di due
domande diverse (risposte corte / risposte lunghe). Prima cura: elenco solo dove le etichette si
tagliano. **Sbagliata**, e l'hanno detto le sue schermate delle 16:02.

### ② Le sue schermate hanno smentito la cura, e la regola è stata SOSTITUITA
🚨⭐⭐ **Alla terza volta non si è indovinato: si è chiesto.** Gli sono state messe davanti le tre
strade con **l'anteprima di come sarebbe uscita ognuna**, e ha scelto lui: **accorciare i TESTI
delle risposte**. (Aveva scartato sia «solo bottoni e taglia Telegram» sia «elenco + bottoni col
numero».)
📌 *Quando una cosa la si sbaglia due volte indovinando, la terza non si indovina.*

🔨 Fatto **dove non tocca il dato**, ed è la distinzione che regge tutto:
· domande sul **livello** → `testo: f.definizione` (da 49 caratteri a 14): lì il dato è il **numero**
  della fascia, non le parole;
· **rally, glass, net, overhead** → `scelte` accetta una coppia `[valore, testoBreve]`: il `valore`
  resta **identico al carattere**, perché su quelle domande il punteggio nasce **confrontando le
  parole**.
⛔ **Le domande di REGOLAMENTO non si toccano**: lì il testo dell'opzione **è** la risposta. Restano
l'unico posto in cui l'elenco nel messaggio compare ancora — **dichiarato, non dimenticato**.

### ③ «Vuoi rifarlo?» senza bottoni
🚨 Il bottone **c'era**: diceva `🎾 TEST LIVELLO DI GIOCO`, cioè l'etichetta di un **menù** sotto una
**domanda chiusa**. ⇒ Il difetto non era il bottone mancante.
📌 *Un bottone che non ha la forma della risposta è invisibile come risposta, anche quando si vede
benissimo.*
🔨 Adesso dice **«🔄 Sì, lo rifaccio»** (stesso `callback_data`: cambia come si chiama, non cosa fa),
e il **«no» è una riga di testo**, non un bottone — scelta dichiarata: lì nessun livello è stato
scritto, quindi «mi tengo quello che ho» è **l'assenza di un gesto**, e un bottone che non cambia
niente direbbe al socio che una decisione è stata registrata.
⚠️ **Se lo rivuole come bottone, si fa — ma prima serve un gesto vero nel gestionale.**

### ④ «Sin dall'inizio deve dire che sono 12 domande»
🔨 Fatto **intero**: via il «circa» dall'intestazione, e la frase nell'invito —
*«Fai il test di livello di gioco, sono 12 domande, due minuti»*.
🔒 **Il 12 non è scritto nel bot**, e c'è una prova che lo pretende. La catena è:
```
passi.js  domandeTotaliPreviste()   →   consumer-assessment-link  domande_totali
   →   ponte.ts  domandeTotali      →   la frase
```
⚠️ **È l'unico import che esce dalla cartella di una edge function**, dichiarato nel codice: la
`deno-check` della CI verifica che si risolva, ed è **passata verde**.

---

## 4. ⏳ COSA RESTA DA FARE, in ordine

**A. La prova fisica di TUTTO il test dal telefono.** È l'unica cosa che manca ai lavori di oggi, e
va chiesta a lui. Cosa deve vedere:
· dalla **prima all'ottava** domanda: nessun elenco sopra, bottoni con la risposta **intera**;
· dalla **nona in poi** (regolamento): l'elenco c'è ancora, per la ragione dichiarata sopra;
· l'intestazione dice **«Domanda 1 di 12»**, senza «circa»;
· l'invito dice **«sono 12 domande, due minuti»**;
· sbagliando apposta: sotto «Vuoi rifarlo?» il bottone **«🔄 Sì, lo rifaccio»**.

**B. La 98 aspetta una persona in lista.** Santiago Carabajal ci finirebbe se qualcuno usasse il
bottone «Ricollega le N schede che non si riconoscono» in Anagrafica soci. ⚠️ È una **scrittura sul
gestionale**: si dice prima.

**C. Il refresh automatico delle risposte è appeso a una sezione CONGELATA.**
`refreshAssessmentSectionDataOnEnter` parte solo entrando nel tab **Autovalutazione dello staff**,
che è nascosto a tutti (`PMO_ASSESSMENT_PARKED`). ⇒ Oggi la cura fa arrivare le risposte **quando
qualcuno le chiede**; da dove parta quella richiesta col tab chiuso è **una domanda aperta**, e va
guardata prima di dire che la lista si aggiorna da sé. **Questa è la cosa che più probabilmente
morde per prima.**

**D. Le 720 opzioni delle domande di regolamento**, se un giorno le vuole corte anche là: è lavoro
di **contenuto**, non di codice, e cambia il senso delle risposte. Da decidere con lui.

📌 Le altre urgenti restano **92**, **84** (ⓐ e ⓒ), **83**, **69**, **78**, **65**.

---

## 5. 🧠 LE TRAPPOLE DI OGGI

**① 🚨🚨 UNA LETTURA BLOCCATA DALL'ATTREZZO È INDISTINGUIBILE DA «non c'era niente».** La console
remota bloccava `get_self_assessments_by_tokens` e `get_assessment_tokens_admin` come «scritture»,
perché la sua regola guarda il **nome** (`^pmo_(get|can)_`) e quelle due sono nate prima della
convenzione. Sono `select` puri — **letti in `pg_proc` prima di sbloccarli**, non dedotti dal nome.
Curato: stanno in `RPC_DI_LETTURA_EXTRA`.

**② 🚨 UNA PROVA CHE SOPRAVVIVE AL SABOTAGGIO NON PROTEGGE LA DECISIONE, LA DESCRIVE.** Sui tre
sabotaggi dell'accorciatura, **uno non cadeva**: la prova diceva `startsWith('Avanzato')` e restava
verde su `Avanzato — vibora, chi…`, cioè sul difetto che il confine di parola esiste per evitare.
⇒ Resa a **confronto esatto**. *Sabotare non è un di più: è come si scopre che una prova non prova.*

**③ 📌 IL CABLAGGIO SI PROVA A PARTE.** Due volte oggi il pezzo giusto esisteva e **in mezzo non lo
usava nessuno** (l'etichetta del bottone; il campo del ponte). ⇒ Adesso ci sono prove che leggono il
**punto di chiamata**, non solo la funzione.

**④ 🚨 UNA GUARDIA SCRITTA LARGA VA ROSSA SUL TESTO GIUSTO.** `!/ho (segnat|registrat|salvat)/`
prendeva la frase corretta «il livello **non l'ho registrato**». ⇒ Si cerca la dichiarazione
**positiva**, non la parola.

**⑤ ⚠️ `process.exit` in fondo a un banco fa sparire le prove aggiunte in coda.** Appendendo casi in
fondo a `test/motore-a-passi.test.mjs` non giravano affatto e il file diceva «tutte verdi». Vanno
messi **prima del sommario**. È la ⑪ª forma dello zero letto troppo presto.

**⑥ ⚠️ `actions_list` sfonda il contesto**: salvare su file e leggere con `grep`, mai stampare.

**⑦ ⚠️ La console remota parte con un browser PULITO**: `assessmentResponses` viene da `localStorage`,
quindi lì è vuoto finché non si lancia il sync a mano. Non è un guasto: è come è fatta.

---

## 6. 🧰 Attrezzi

| | |
|---|---|
| console remota | `node console.mjs --env prod --file x.js --out /tmp/r.json` in `tools/verifica-browser` (dopo `npm install`). `--url http://localhost:PORTA/index.html` la punta su una **copia locale** dell'app col database vero: è così che la cura della 98 è stata provata prima del deploy |
| Supabase MCP | `qqbf…` (PROD), `cudi…` (TEST), `ayly…` (whitelist) |
| banco gestionale | `node test/<nome>.test.mjs` · banco bot: `node --test test/*.test.ts` |
| tipi del bot | `npx tsc --noEmit -p tsconfig.json` |
| deploy bot | `deploy-bot-hetzner.yml`, `soci` + la parola `SOCI` |
| deploy edge a mano | `deploy-edge-functions-prod.yml`, input `function` |
| ordine push docs | prima `test-preview`, poi `main` |
| commit | mai backtick in `-m`: heredoc con `-F -` |

---

## 7. 🤝 Come si procede (invariato, con una precisazione guadagnata oggi)

> *«Procediamo sempre come tu pensi sia corretto»* — copre anche le promozioni; il freno è la
> **dichiarazione**. Fuori: inventare voci non in lista, e l'irreversibile/visibile (si dice prima).

🆕 **E una riga nuova, pagata due volte oggi:** la delega copre **il metodo**, non **il gusto**.
Su una cosa che il socio *vede* — un'etichetta, un elenco, la forma di una schermata — decidere al
posto suo produce giri a vuoto. Alla seconda correzione dello stesso punto **si smette di indovinare
e si chiede**, con le anteprime davanti: la sua risposta non è stata nessuna delle due che avevo
scelto io.

✋ **Un task non è finito finché non è provato fisicamente.** Oggi la **98** ha avuto la sua prova
sul meccanismo; il **test nel bot** no — aspetta un giro dal suo telefono (punto **A**).

📌 E una cosa sua che vale come istruzione: **«scrivi troppo».** Risposte corte.
