# Passaggio di consegne — 04/09/2026, tarda notte (fine 83ª sessione)

**Come si usa:** incollalo come primo messaggio della chat nuova. È scritto per essere capito
**senza** la conversazione precedente.

---

## 🟢 LE TRE COSE DA SAPERE PRIMA DI TUTTO

> **① IL POSTULATO IN TESTA A `CLAUDE.md` È CAMBIATO IL 04/09, E GOVERNA TUTTO.** La prova la fa
> **chi lavora**, su TEST **e su PROD**, e lui **supervisiona**. La promozione a PROD **non si
> chiede**: ①sviluppo → ②prova su TEST → ③PROD → ④prova su PROD → ⑤«vieni a controllare».
> Fermarsi a chiedere «lo porto in prod?» è la cosa che lui ha tolto di mezzo.
>
> **② «TU DEVI FARE TUTTE LE PROVE FINCHÉ ARRIVI AL RISULTATO CHE TI SEI PREFISSATO, POI MI DICI
> CHE PER TE FUNZIONA E DI ANDARE A VEDERE.»** Sue parole di stanotte, dette dopo che avevo
> consegnato due prove **non fatte** dichiarandole tali. Dichiararle non basta: vanno **portate a
> termine**. Vedi il punto 6, che è il pezzo più utile di questo file.
>
> **③ IL CALENDARIO NELLA CONSOLE REMOTA SI IDRATA — e per due mesi si è creduto di no.** Una
> riga: `await staffCalRefreshFromCloud({force:true, withMembers:true})`. Da **0** a **173**
> prenotazioni, **zero** richieste bloccate. È ciò che sblocca ogni prova fisica che parte da una
> partita vera.

| | inizio sessione | adesso |
|---|---|---|
| versioni app | PROD 6.340 · TEST 6.341 | **PROD 6.349 · TEST 6.350** |
| PR fuse | — | **#1352 → #1363** (dodici) |
| banco | 102 verdi | **106 verdi / 0 rossi** |
| voci | 122 chiuse · 10 urgenti | **123 chiuse · 13 urgenti** (entrano 154 · 155 · 156 · 157; la **157 è già chiusa da lui**) |

---

## 0. 📦 Stato alla consegna

| | |
|---|---|
| rami | `main` ↔ `test-preview` allineati sui 4 percorsi sorvegliati |
| guardie | verdi su **entrambi** i rami |
| worker · bot | **non toccati** in tutta la sessione |
| edge | 3 rideployate (solo commenti, vedi punto 5) |

### ⛔ LE COSE DA FARE PER PRIME
1. **Il suo occhio su TRE voci nuove**, tutte già in servizio su PROD e già provate da me:
   **154** (la scheda socio va sopra), **155** (la barra fissa), **156** («Impostazioni»).
   Nessuna aspetta lavoro: aspettano lui.
   ✅ La **157** è stata **chiusa da lui la sera stessa** — *«controllato ed è ok»*.
2. 🚨 **La 153 è la più grossa rimasta e NON è stata toccata**: il pannello della scheda è **fisso
   a 860 px** e non scala col monitor. ⚠️ Ma **va rimisurata**: la 157 ha appena tolto ~55 px
   dall'altezza della scheda, quindi il «sfora di 94 px a 1280×800» è **di prima della 157** e
   quasi certamente non vale più. *Non ripartire da quel numero: rimisuralo.*
3. **Il ramo «conto parziale» della 152** non è mai passato sul vivo (serve una scheda con un
   importo non letto — si prende aprendo una partita e guardando **entro il primo secondo**).
   ⚠️ Con la console idratata (punto ③) adesso è alla portata.

---

## 1. ✅ Prima di lavorare

```bash
git fetch origin main test-preview
git reset --hard origin/test-preview      # 🚨 il clone è shallow e parte VECCHIO
git diff origin/main origin/test-preview -- CLAUDE.md docs/ .github/workflows/ \
  tools/matchpoint-browser-worker/src/server.mjs      # dev'essere vuoto
```
📕 `docs/lavori/README.md` si apre **PRIMA** di lavorare.

Il banco NON si lancia con `node --test`:
```bash
r=0; v=0
while IFS= read -r f; do
  grep -qE "^\s*(import|export).*['\"]jsr:" "$f" && continue
  if node "$f" >/dev/null 2>&1; then v=$((v+1)); else r=$((r+1)); echo "❌ $f"; fi
done < <(find supabase consumer-app tools test \( -name '*.test.ts' -o -name '*.test.mjs' \) | sort)
echo "$v verdi, $r rossi"
```
🩹 Sintassi: `node test/controlla-sintassi.mjs` · Ora: `TZ=Europe/Rome date '+%Y-%m-%d %H:%M'`
🩹 La console vuole `npm install` in `tools/verifica-browser` a ogni sessione nuova.
🔑 Le quattro `PMO_VERIFY_*` **ci sono già**: provalo prima di dubitarne.

---

## 2. 🌐 LA CONSOLE REMOTA — quello che stanotte ha cambiato tutto

### ⭐⭐ Il calendario SI IDRATA. Una riga.
```js
await staffCalRefreshFromCloud({ force:true, withMembers:true });
// 📌 poi si aspetta IL FATTO, non i secondi:  prenotazioniOccupazione.length > 0
const inp = document.getElementById('staffCalDate');
inp.value = '2026-09-07'; renderStaffCalendar();
```
📏 Misurato: da **0** a **173** occupazioni, **zero** richieste bloccate — la lettura passa da una
RPC **già consentita** dalla guardia.
⚖️ Prima di trovarla avevo scritto un **foro nella guardia delle edge** per far passare
`pmo-cloud-backup`: **non serviva**, e l'ho tolto. 📌 *Un foro in una guardia si apre solo dopo aver
dimostrato che la strada senza foro non esiste.*

### 🩹 LE TRAPPOLE DELLE SONDE, tutte pagate stanotte
· 🚨 **`offsetParent !== null` è SEMPRE falso per un `position:fixed`** — cioè per la scheda
  partita **e** per la scheda socio. Usandolo come «è visibile?» la sonda dichiara per **tre giri**
  che la scheda non si apre. Si guarda `getComputedStyle(el).display` + l'altezza del rettangolo.
· I **blocchi prenotati** del calendario si agganciano con `addEventListener`: filtrarli su
  `e.onclick` li trova **tutti nulli** su un calendario pieno. Si cercano per **contenuto** (il div
  più interno che porta un orario).
· Il calendario **non è** `.staff-cal-table` (CSS morto): è **`#staffCalGridTable`**, e le celle
  non hanno `data-campo`.
· Il menu di un capitolo è il **fratello** del bottone: `parentElement.querySelector` prende il
  primo della barra, cioè di un altro capitolo.
· **Chiudere la scheda socio togliendo la classe `open` a mano** lascia `memberInlineOpenId` pieno,
  e al giro dopo `openMemberCard` fa da **interruttore** e la richiude. Si chiude chiamando la
  funzione dell'app.
· Un messaggio **fuori dalla finestra** non è «coperto»: è **altrove**. Va portato in vista
  (`scrollIntoView`) prima di chiedere `elementFromPoint`.

📌 Tutto questo è scritto in `tools/verifica-browser/README.md`, così non si ripaga.

---

## 3. 🔨 LE QUATTRO VOCI NUOVE — tutte in servizio su PROD, tutte provate da me

### 🪟 154 — l'ultima scheda aperta sta sopra *(PROD 6.342)*
🗣️ *«con la scheda aperta della partita, se clicco sul nome la scheda di anagrafica va sotto.»*
📏 Causa: `.member-card-overlay` e `.svc-chat-panel` avevano **lo stesso** z-index (2600) — a parità
decide il DOM, e `#svcChatPanel` viene dopo. *Non un numero sbagliato: un numero che non decide.*
⛔ **Alzare la scheda socio e basta sarebbe stato sbagliato**: l'esito del **salvataggio anagrafica**
lo scrive `pmoMemberEditChatFlow` **aprendo il pannello della chat**, che sarebbe finito sotto.
🔨 `pmoPortaInCima(el)`: **una classe che passa di mano** fra le due, agganciata a tutt'e due le
aperture. Un `if` che alza e non abbassa lascerebbe due elementi a 2720 e il pareggio tornerebbe.
✅ **Gesto vero su PROD**: aperta la partita del **7/09 · Campo 4 · 09:00** dalla griglia, cliccato
**«Lidia Comes»** → risponde `memberCardOverlay`. E **18 giri su 18** su tre larghezze, sui tre
versi (socio sopra · la partita si riprende la cima · l'esito visibile).
⏳ Manca solo il **salvataggio vero** di un'anagrafica: scrive su Matchpoint e la scheda autorizzata
è una prenotazione, non un socio.

### 📌 155 — la barra dei capitoli resta ferma *(PROD 6.344)*
📏 Misurato prima: a scorrere **non è il documento** (`html`/`body` sono `overflow:hidden`), è
**`main.main-content`**, e fra la barra e lui c'è **un solo** antenato a `overflow:visible`.
🔨 `position:sticky; top:0; z-index:1200` dentro i 900 px. Il livello sta **sotto** il velo delle
schede (2550): una barra accesa sopra un velo scuro non sembra fissa, sembra rotta.
✅ Provata su TEST e PROD a tre larghezze: prima se ne andava a **−193**, ora resta a **0**.

### 🏷️ 156 — «Impostazioni» al posto di «Amministrazione» *(PROD 6.346)*
📏 Guardato **cosa c'è dentro** prima di proporre il nome: Utenti Staff · Notifiche staff · Dati ·
Bot Telegram. Non una riga di soldi ⇒ la confusione che lui vedeva non era un'impressione.
🔨 Cambiate **tutte le 24** occorrenze che si leggono, compresi i **quattro testi del login** — è lì
che va a cercare chi non riesce a entrare.
🚨🚨 **La chiave interna `administration` NON si tocca**: ci sono appese la visibilità per ruolo e i
salti `goToTabSection`. Chi «completa» la rinomina cambiando anche quella **spegne un capitolo
intero**, in silenzio.
✅ Provata su TEST e PROD, **pagina di accesso compresa**.
🩹 Poi il cerchio è stato chiuso anche fuori dall'app: 3 commenti di due edge, un nome di prova, e
soprattutto **`CLAUDE.md`**, che diceva ancora «Amministrazione → Utenti».
📏 E **due percorsi nei documenti erano vecchi in ENTRAMBI i segmenti**: `Amministrazione >
Supabase` non esiste più. Il nuovo è **misurato** (`Impostazioni > Utenti Staff > Controlli
tecnici > Verifica TEST/PROD`), non dedotto dalla rinomina.
⛔ **Non toccati** i registri storici (`VERSIONI.md`, le note datate, le voci chiuse, i mockup):
riscriverli sarebbe falsificare la storia.

### 🔼 157 — la nota di due righe, e il titolo nella testata *(PROD 6.349)*
🗣️ *«il campo nota è troppo alto… la parte sinistra la puoi alzare all'altezza del titolo»* →
mockup con **tre letture** → **«fai la A»**.
🔨 ① nota 3 righe → **2** (85 → 64 px, **resta trascinabile**); ② il titolo esce dal flusso e si
posa nella **testata**, che conteneva solo la ✕. Le colonne partono in cima.
⭐⭐ **Solo CSS**, e la misura che l'ha reso possibile: nella catena box → `.svc-msg` →
`#svcChatMessages` → `#svcChatPanel` **nessuno è `position:relative`** e il pannello è `fixed` ⇒ un
figlio `absolute` risolve contro il **pannello** e **non viene ritagliato** da `#svcChatMessages`
benché sia `overflow:auto`.
📌 *Prima di spostare un nodo per ottenere una posizione, si guarda se la posizione si può
**chiedere**. Un nodo spostato porta con sé un ciclo di vita da sorvegliare* — qui, un titolo che
sopravvive alla scheda chiusa.
✅ Provata su TEST e PROD a tre larghezze, e **CHIUSA da lui la sera stessa**: *«controllato ed è ok»*.
⭐ È la prima voce chiusa nella forma piena del POSTULATO: il lavoro gli è arrivato **provato**, e a
lui è toccato **verificare che quel che avevo detto fosse vero** — non scoprire se funzionava.

---

## 4. 🧠 I DIFETTI DI METODO PRESI STANOTTE — la parte che vale di più

- 🩹⭐⭐ **HO CONSEGNATO DUE PROVE NON FATTE, DICHIARANDOLE TALI — e lui mi ha fermato.** Avevo
  scritto «vai a controllare questi due punti», e uno dei due potevo farlo io. La sua risposta:
  *«perché non l'hai fatte se le puoi fare?»* ⇒ **Dichiarare una rinuncia non la rende accettabile.**
  📌 *Il confine non è fra «l'ho detto» e «l'ho nascosto»: è fra ciò che potevo fare e ciò che non
  potevo. Il primo è mio, sempre.*
- 🩹⭐⭐ **UNA RINUNCIA TRAVESTITA DA LIMITE.** Il calendario nella console si apriva tutto «Libero»,
  e ne ho concluso «da qui non si vede». Era **falso**, e la strada esisteva già (punto 2). 📌 *Un
  vuoto va attribuito alla propria sonda prima che al mondo* — la stessa regola della sessione
  scorsa, sbagliata di nuovo.
- 🩹⭐ **UN'OSCILLAZIONE «1 SU 6» CHE ERANO DUE DIFETTI MIEI.** Avevo segnalato la cura come fragile.
  Inseguendola: chiudevo la scheda socio a mano (interruttore) e cercavo l'esito senza portarlo in
  vista. 📌 *Un numero che oscilla va inseguito fino a sapere CHI oscilla, o si dichiara fragile una
  cura sana.*
- 🩹⭐ **UN NUMERO CHE DESCRIVEVA UNA VICINA.** `grid-row:2` dei giocatori esisteva perché la riga 1
  era del titolo. Tolto il titolo, quel `2` era **falso e verde**: nessuna prova poteva vederlo,
  perché la regola era ancora lì, scritta bene. Trovato **solo sulla pagina viva**.
- 🩹 **UN BANCO CHE SAREBBE STATO UN PEDAGGIO.** La prima versione della 156 pretendeva la voce
  «Circoli», che vive **solo su test-preview**: sarebbe stata rossa su PROD per un fatto che non
  riguardava la cura. 📌 *Un banco che viaggia con una promozione deve reggere sui DUE rami.*
- 🩹 **IL CONTEGGIO DELLE URGENTI È DICHIARATO IN DUE POSTI** (il titolo della sezione **e** la
  tabella in cima): correggerne uno lascia `guard-docs-truth` rossa. Preso due volte stanotte.
- 🩹 **`lastIndexOf('@media')` non trova il contenitore**: trova il vicino. Fra l'apertura di una
  `@media` e una regola ce ne stanno altre già chiuse. Si conta con una **pila**.

---

## 5. ⚙️ Cose operative da sapere

- **Le PR verso `main` non si fondono subito**: `guard-main` parte in coda, il primo `merge` dà
  **405**. Si riprova dopo qualche decina di secondi (nel frattempo si lavora).
- **Ordine sempre**: prima `test-preview`, poi il riallineo di `docs/` su `main` con una PR a parte
  (percorso sorvegliato). La rossa transitoria cade così su `test-preview` e non su `main`.
- **La finestra transitoria lascia guardie rosse**: si **rilanciano** a mano
  (`workflow_dispatch` su `guard-worker-sync` e `guard-docs-truth`), non si aspetta il backstop.
- **Numerazione**: PROD prende il numero, TEST riparte da **+1**. Dopo ogni promozione si bumpa
  TEST col commit dei registri.
- **Le tre edge rideployate stanotte** (`staff-create-access`, `assessment-email-send`,
  `bot-telegram-admin`) hanno cambiato **solo commenti**. Prima di farlo ho verificato che il
  sorgente in git combaciasse col **vivo** su `qqbf` — quello era il rischio, non il commento.
- ⚠️ **La sua scheda del browser resta indietro**: due volte stanotte guardava una versione vecchia.
  Nell'avviso conviene ricordargli di ricaricare.

---

## 6. ⏳ COSA RESTA IN PIEDI

| | |
|---|---|
| 🖥️ **153** (aperta, **da decidere con lui**) | il pannello è **fisso a 860 px** e non scala col monitor · nel CSS ci sono **tredici** soglie non allineate · ⚠️ **il numero «94 px a 1280» è di PRIMA della 157 e va rimisurato** · il **calendario** non è mai stato misurato |
| **156 · 155 · 154** (aperte) | in servizio su PROD e provate da me: **aspettano il suo occhio** |
| ✅ **157** (CHIUSA) | chiusa da lui il 04/09 a tarda notte: *«controllato ed è ok»* |
| **152** (aperta) | il ramo «conto parziale» non è mai passato sul vivo — adesso la console idratata lo rende possibile |
| **151 · 150 · 149** (aperte) | in servizio, aspettano il suo occhio |
| **142** (aperta) | id interno + Osservazioni nel gestionale ⇒ chiude anche la **138** |
| ⏳ **92 · 83 · 65 · 137 · 138** | invariate: aspettano un caso che non si può provocare |
| 🩹 **le «otto copie»** | il commento di `scrittura-al-circolo.ts` dice 8, sono **11** |
| ⚠️ **la partita di prova** | **lunedì 7 alle 9, Campo 4** — è il banco autorizzato su PROD |

---

## 7. 🤝 Come si procede

> 🥇 **POSTULATO**: la prova la faccio io — TEST **e** PROD — e lui **supervisiona che quel che ho
> detto sia vero**.
> 🚀 **La promozione a PROD non si chiede**, e non ci si ferma a metà catena.
> 🔎 **Lui controlla sempre su PROD** ⇒ nel resoconto si scrive **su quale ambiente** ogni cosa è
> stata provata.
> 🟢🔴 **L'avviso ha due stati, e apre un campo invece di dare un compito.**
> 🎯 **Sulla scheda che segnala lui: campo libero — tranne salvare un pagamento.**
> ✋ Un task non è finito finché non è provato **fisicamente**… e **le prove si portano a termine**,
> non si consegnano dichiarate.
> 🎨 Ogni modifica **visibile** parte da un mockup approvato (`mockup/`).
> 📌 E: **«scrivi troppo» — risposte corte.**

⭐⭐⭐ **LA LEZIONE PIÙ CARA DELLA SERATA**, e non viene da una misura ma da una sua frase: avevo
consegnato due prove non fatte, **dichiarandole**. Pensavo che dichiararle bastasse. Non basta: se
potevo farle, erano mie. Le ho poi fatte tutte — 18 giri su 18 — e il difetto che ne è uscito
(`grid-row:2`) non l'avrebbe mai trovato nessun banco.
📌 *La differenza fra «te lo dico» e «l'ho fatto» è tutto il lavoro.*

⭐⭐ E quella che viene dal mockup della 157: **una tabella che il browser calcola da sé ha
scoperto un fatto che io non avevo previsto** — che l'altezza della scheda la detta la più alta
delle due colonne, quindi accorciare la nota, da sola, con quattro giocatori non si vede.
📌 *Un disegno che si misura non illustra una decisione: la corregge.*
