# Passaggio di consegne — 29/08/2026, sera (fine 58ª sessione)

**Come si usa:** incollalo come primo messaggio della chat nuova. È scritto per essere capito
**senza** la conversazione precedente.

⚠️ Sessione lunga e produttiva: **tre voci chiuse** (78, 101, 107), **una aperta** (106), **il punto
D curato e promosso a PROD**, e **due bot aggiornati**. Due PR (#1183 qui, #109 sul repo del bot).

---

## 🔴 LEGGI PRIMA QUESTO — LA COSA CHE HA CHIESTO LUI PER DOMANI

> 🗣️ **Sue parole a fine sessione:** *«nella prossima chat analizziamo cosa produce proprio il
> cambio di livello fatto dalla segreteria sul gestionale»* — con uno screenshot di Anagrafica soci.

📸 **Cosa mostra lo screenshot** (riga di Maurizio Aprea, ID-MP-000004):

> **Intermedio (3.5)** · 🎓 *«Da certificare — il test dice Avanzato (4), in scheda Intermedio (3.5)
> · gioca sab 29/08 alle 10:30»*

🚨⭐⭐ **E LA MISURA FATTA SUBITO DOPO DICE TRE NUMERI DIVERSI IN TRE POSTI.** Questo è il fatto da
cui partire, ed è già misurato — non va rifatto, va **spiegato**:

| dove | cosa dice | quando |
|---|---|---|
| **lo schermo** (suo browser) | in scheda **3,5** · il test dice **4** | 29/08 sera |
| **il cloud** (`pmo_cloud_records`) | `level` = **4** | riga riscritta 19:30:48 |
| **l'ultima scheda** (`self_assessments`) | `calculated_level` = **5** | inviata 29/08 **15:51:33** |

⇒ Nessuno dei tre coincide con gli altri. **Alle 15:56 di oggi la stessa sonda diceva
`Maurizio Aprea · dimostrato 5 · in scheda 4 → ENTRA`**: fra allora e la sera qualcosa è cambiato
sullo schermo e **non** nel cloud.

🔎 **Le due ipotesi da provare, dichiarate come ipotesi e NON come fatti** (nessuna delle due è
stata verificata: la sessione è finita qui):
① lo schermo mostra una **fotografia più vecchia**: nel suo browser `member.level` è 3,5 (cambiato
   a mano e non ancora salito al cloud) e `assessmentUltimaScheda` pesca la scheda del **28/08
   10:36 (calculated 4)** invece di quella del **29/08 15:51 (calculated 5)**, perché la nuova non è
   ancora in `assessmentResponses` di quel browser;
② il cambio a mano è avvenuto e **non è arrivato** al cloud (`payload.updatedAt` del socio è fermo
   al **28/08 20:33**, mentre la riga è stata toccata alle 19:30 — cioè dal **sync di massa**, non
   da un salvataggio).
📌 *Sono due storie diverse con lo stesso schermo: la prima è un ritardo, la seconda è un
salvataggio perduto.* Distinguere le due **è** il lavoro di domani.

⭐⭐ **E PERCHÉ QUESTO CASO VALE PIÙ DI QUANTO SEMBRI: è il primo caso vero del PUNTO D**, curato e
messo in PROD **oggi pomeriggio** (v6.256). I fatti che lo rendono il caso perfetto:
· il socio ha `lastLevelUpdateAt` fermo al **2 maggio 2026** e `selfAssessmentDate` allo stesso
  giorno ⇒ il cancello della data **lascia passare** qualunque scheda più recente;
· la scheda del 29/08 ha `staff_status = 'review'`, e `review` **passa** la guardia dell'edge
  (`if (statoStaff !== '' && statoStaff !== 'review')`);
· quindi, se il cambio a mano **non** ha marcato la data, quella scheda può ancora scavalcarlo.
🎯 **La domanda esatta da porre domani**: *il salvataggio è avvenuto prima o dopo che la 6.256
fosse in servizio su PROD?* Prima ⇒ non ha marcato, e il caso è vivo. Dopo ⇒ deve aver marcato, e
allora **la prova fisica del punto D è già in casa** e si chiude.

📏 **La sonda che risponde**, da eseguire per prima:
```sql
select payload->>'level' as livello, payload->>'lastLevelUpdateAt' as ultima_mano,
       payload->>'selfAssessmentDate' as data_scheda, payload->>'levelSource' as fonte,
       payload->>'updatedAt' as aggiornato, local_key
from pmo_cloud_records
where record_type='member' and deleted is not true and payload->>'name' ilike '%Maurizio Aprea%';
```
📌 **Valore alla chiusura di oggi** (così si vede se è cambiato): `level` **4** · `ultima_mano`
**2026-05-02T18:02:42.813Z** · `data_scheda` **2026-05-02** · `fonte` `autovalutazione` ·
`updatedAt` **2026-08-28T20:33:01.698Z** · `local_key` `phone:393357615855` (**una riga sola**:
la voce 105 tiene).

⚠️ **E la trappola da non ripetere**: la console remota parte da un **browser pulito**, quindi
**non può** riprodurre lo stato accumulato nel suo. Ma *uno stato che non si eredita si
costruisce* — vedi la trappola ① del passaggio precedente, che oggi è stata usata due volte.

📕 `docs/test-livello-regole.md` resta la **fonte definitiva** sul test di livello.
📋 `docs/lavori/README.md` si apre **PRIMA di lavorare** — obbligo di casa.

---

## 1. ✅ Prima di lavorare

```
git fetch origin main test-preview
git diff origin/main origin/test-preview -- CLAUDE.md docs/ .github/workflows/ \
  tools/matchpoint-browser-worker/src/server.mjs
```
✅ **Dev'essere vuoto, e alla chiusura lo era.**

🆕 Serve anche `PadelVillage/assistente-padel-agent` (→ `add_repo`, **una sola** clonazione con
timeout generoso, poi `npm install` — il typecheck e il banco lo pretendono).

### 🟢 Stato misurato a fine sessione (non ricordato)

| dove | stato |
|---|---|
| **gestionale** | `main` **6.256** · `test-preview` **6.260** · PROD **serve 6.256** (verificato sull'app viva) |
| **bot** | deploy **#122 (soci)** e **#123 (prova)**, stesso sha `b78954d7` · soci risalito **16:09:06**, `✍️ prenotazioni REALI` |
| **anagrafica PROD** | **2817** soci vivi · doppioni **0** · con `lastLevelUpdateAt` **20** |
| banco gestionale | `test/*.test.mjs` **44 verdi, 0 rosse** · sintassi 5 blocchi 0 errori |
| banco bot | **1641 verdi, 0 rosse** · `tsc --noEmit` pulito |
| lista | 🔴 urgenti **6** · 📋 in coda **11** · 📦 chiuse **86** |

---

## 2. 🔨 COSA È STATO FATTO

### ✅ Voce 78 — CHIUSA, il bottone «🔄 Aggiorna» toccato in una finestra vera

Partita **martedì 1 settembre · 10:00 · Campo 3**, misurata al millesimo:

| ora (Roma) | fatto |
|---|---|
| 15:19:40 | la stessa schermata **contava** regolarmente (`— posto libero — ×2`) |
| 15:21:25.091 | la segreteria aggiunge **Fabiola Limuti** (`staff_booking` a tre) |
| 15:21:33 → | due nomi, **nessun** `— posto libero —`, la riga «sta cambiando», il bottone |
| 15:25:04.171 | il sync atterra: la riga si raddrizza da sé |

**Finestra 3′39″, attraversata.** **Quindici** tocchi su «Aggiorna», quattro nello **stesso minuto**
con secondi diversi — il caso in cui il 23/08 notte lo schermo non si muoveva. Zero righe
`↔️ non riscrivo`.
⚖️ **Il controllo, non cercato**: alle **15:22:11**, in mezzo ai tocchi, la partita di lunedì 31
(letture concordi) ha disegnato regolarmente i posti liberi. ⇒ La cura non è «sempre muta».

### ✅ Voce 101 — CHIUSA, e nel farlo è caduta una riga falsa della sua stessa scheda

🚨 Diceva *«l'utenza `readonly` della console non ha `view_members`»*: **falso**, l'app viva di TEST
carica **2815 soci** con quella utenza. Il blocco era **la guardia dell'attrezzo** —
`get_assessment_tokens_admin` e `get_self_assessments_by_tokens` sono **letture** che viaggiano in
**POST** (tutte le RPC di PostgREST) e venivano fermate come scritture.
⚠️ **Il sintomo era muto**: pagina aperta, soci caricati, `assessmentResponses` a **0** ⇒ la lista
usciva **vuota senza un errore**. 📌 *Un limite attribuito al bersaglio quando sta nell'attrezzo si
autoconferma a ogni prova.* Curato in `tools/verifica-browser/console.mjs`, RPC **nominate** e
permesso dato dopo aver letto `prosrc` in `pg_proc` sui **due** progetti.

✅ **La prova, in due tempi**: ① i **quattro cancelli** esercitati su **24 soci veri** di PROD, ognuno
scartato per la ragione giusta — comprese le due regole del 27/08, fino a lì provate solo su schede
finte; ② poi lui ha rifatto il test dichiarando Agonista e la stessa sonda ha detto
**`Maurizio Aprea · dimostrato 5 · in scheda 4 → ENTRA`**.
🔎 E in mezzo la lista si era anche **svuotata** per la ragione giusta: Laura entrava con la scheda
del 27/08 22:14:58 (4 contro 3,5) ed è uscita con quella del 28/08 15:55:27 (3, sotto il tetto).

### ✅ Voce 107 — CHIUSA, «Test Livello di Gioco» (voce sua, entrata e uscita in un pomeriggio)

Il nome vecchio descriveva **il dato**, quello nuovo **il gesto**. Sta in **un posto solo**
(`scelta-livello.ts`) accanto alle **16 frasi** che lo citano — lezione della voce 87. Cambia anche
il **verbo**: *«chiedimi»* → **«apri»**.
🧪 Le categorie del menu diventano **tre** invece di allentare una sua regola del 20/08; quattro
casi passano dalla stringa a mano alla **costante**; **guardia nuova** contro le copie, **vista
rossa con un sabotaggio**. In servizio sui due bot, **menu guardato da lui**.

### ✅ PUNTO D — curato e PROMOSSO A PROD (v6.256)

`assessment-apply-level` decide su `Math.max(lastLevelUpdateAt, selfAssessmentDate)` e si presenta
come *«il controllo che impedisce il danno»*, ma quel campo lo scrivevano **due punti soli**, tutti
e due nel giro dell'autovalutazione ⇒ **cieco alla mano della segreteria**, che è il caso che nomina.

🔄 **Il bivio che lo teneva fermo NON esiste**, misurato: l'import da Matchpoint **non scrive mai**
il livello di un socio già presente (`existing.level || …`, in app e nell'edge).

📏 `lastLevelUpdateAt` ce l'hanno **20 soci su 2817**. Schede in attesa **47** · con socio vivo **42**
· passano la data **19** · col socio toccato dopo **14**.
🚨 **Lo zero guardato una volta di più**: di quelle 14, **zero** alzerebbero il livello — 13 lo
abbasserebbero, e le ferma *il livello non scende mai da solo*, cioè **un'altra** regola.
📌 *Una protezione che regge grazie a un'altra non è una protezione: è una coincidenza che tiene.*

⚙️ Cura in un punto solo (`pmoMarcaLivelloCambiato`) dalle **quattro** mani che scrivono il livello,
e marca **solo se il livello cambia davvero** — o salvare la scheda per un telefono spegnerebbe le
prove in attesa. Lo strumento gated `PMO_IS_TEST_ENV` **azzera** la data invece di marcarla.
🧪 **11 verdi**, con la **regola dell'edge riprodotta identica**: la stessa scheda di aprile
**passa** senza la marca e **viene fermata** con — più il controllo che una prova *più recente*
continua a passare.
✅ **Verificata sull'app viva di PROD**, non solo deployata: `6.256` servita, `pmoMarcaLivelloCambiato`
su `window`, ed **esercitata dentro la pagina** — marca se il livello cambia, **tace** se `4` → `4,0`.

⏳ **Non è finita**: manca il caso vero (segreteria cambia un livello a mano, e una scheda più
vecchia in attesa **non** lo scavalca al giro del cron). ⭐ **E il caso vero potrebbe essere quello
in cima a questo documento.**

### 🆕 Voce 106 — APERTA in coda: i quattro gesti senza «non lo so»

📏 **Visto succedere alle 15:28:58**: due rimozioni chieste in un gesto solo, una riesce e l'altra
esce come `⚠️ Fabiola Limuti: non ci sono riuscito`. Nel registro:
`[togli] Fabiola Limuti: rifiutato (scrittura_rifiutata)` — un **timeout del worker** tradotto in
«non è passata», che è un'affermazione sul passato che da lì non si può fare.
⚖️ **Non è una regressione**: il limite è **già dichiarato** in `esito-scrittura.ts` dal 19/08 —
solo il ramo `create` chiama la guardia dell'esito ignoto; `remove`, `add`, `leave` e `cancel` no,
perché il bot **non ha frasi «non lo so»** per quei gesti. Oggi quel residuo ha una data e un caso.
🔨 La strada la dice il codice: **prima le frasi nel bot, poi il gestionale**.

📏 **La causa tecnica del fallimento, misurata**: alle 15:28:50 sulla Ficha di Matchpoint si è
aperta una modale **«Condividi»** (`Compartir.aspx?id=9722`) che **intercettava i click**
(`subtree intercepts pointer events` a ogni tentativo). ⛔ **Chi l'abbia aperta NON è noto**: il
worker non la apre mai (zero `Compartir` nel sorgente). Non dedurlo.

---

## 3. 🧠 LE TRAPPOLE DI OGGI

**① 🚨⭐⭐ UN LIMITE ATTRIBUITO AL BERSAGLIO QUANDO STA NELL'ATTREZZO SI AUTOCONFERMA.** La console
diceva «lista vuota» e chi leggeva capiva «non c'è niente da certificare». Era la sua guardia a
fermare due letture. **Un attrezzo che sbaglia in silenzio è peggio di uno che si rompe.**

**② 🩹 UNA PROVA FISICA SI PROGETTA ANCHE SULLE SCHERMATE CHE IL BERSAGLIO NON HA.** La prima
partita scelta per la 78 era **dentro le 48 ore** ⇒ il bot le dà `testoSchedaSolaLettura` e **la
schermata di gestione non esiste**. Un giro buttato.

**③ ⚠️ UN RESIDUO RISCRITTO IN UN PASSAGGIO DI CONSEGNE PERDE LE CONDIZIONI CHE LO RENDEVANO VERO.**
Il passaggio diceva «un giocatore messo **o tolto**»: **falso** — `compagni` prende il **massimo**
fra le liste, quindi **solo un'aggiunta** apre la finestra. Era già scritto nel reperto del 23/08.

**④ 🚨 UN BIVIO DI DISEGNO DICHIARATO MA MAI VERIFICATO COSTA PIÙ DI UN DIFETTO: ferma la cura senza
esistere.** Il punto D è rimasto fermo un giorno per un ostacolo che non c'era.

**⑤ ⚖️ UNA PROTEZIONE CHE REGGE GRAZIE A UN'ALTRA È UNA COINCIDENZA CHE TIENE.** Vedi punto D: la
cecità non faceva danno per una ragione **che non era la sua**.

**⑥ 🔒 QUANDO UNA REGOLA SUA VIENE ROVESCIATA, IL CASO SI RISCRIVE — NON SI CANCELLA.** La voce di
menu è uscita da `DEL_SOCIO` perché **ha cambiato categoria**, e i titoli hanno una regola loro.
*Toglierla e basta avrebbe lasciato quella voce senza nessun caso a guardarla.*

**⑦ 🔧 `git checkout <ramo> -- <cartella>` PRENDE TUTTA LA CARTELLA**, e `git commit` va sul ramo su
cui sei: oggi un commit dei docs è finito sul ramo verso `main` invece che su `test-preview`.
Controllare `git branch --show-current` **prima** di committare.

**⑧ 🔧 I `curl` verso `api.github.com` DALLA SHELL NON SONO AUTORIZZATI** (resta vero). Per stato di
PR e Actions si usano **solo** gli attrezzi `mcp__github__*`. ⚠️ E `list_workflow_runs` **sfora il
tetto di contesto**: si salva su file e si legge con `python3 -c`.

---

## 4. ⏳ COSA RESTA

**Le 6 urgenti**: 105, 97, 92, 84, 83, 65. La lista canonica è `docs/lavori/README.md`.

| # | cosa manca | chi |
|---|---|---|
| **105** | il **giro intero dall'app**: la segreteria salva dalla scheda socio e la riga atterra | **lui** |
| **97** | un giro del test **intero** dal telefono, dodici domande senza deploy in mezzo | **lui** |
| **92** | un gesto della segreteria che attraversa un **riavvio del bot**. ⚠️ «non è arrivato il doppione» **non è la prova** | si aspetta |
| **84** | la prova col **difetto vero davanti** | **lui** |
| **83** | un worker oltre i 150 s: **non si provoca, si guarda** | si aspetta |
| **65** | curata e in servizio: si aspetta il caso | si aspetta |

**Altro, non urgente:**
- **Voce 106** (sopra), in coda: prima le frasi nel bot, poi il gestionale.
- **Punto D**: in servizio su PROD, **manca il caso vero** — e forse è quello in cima.
- **`ASPETTA_IL_MAESTRO`**: l'unico ramo di E1 mai provato. ⭐ **La ricetta è più vicina che mai**:
  Maurizio ha una scheda `review` da **5** e in scheda 4 — i bottoni dovrebbero comparire.
- **E10 aperta a metà**: verso il socio è una **porta muta** (`TEST_LIVELLO_MUTO`). 0 soci su 2817.
- **`supabase/migrations/` diverge fra i rami** (6 file su `test-preview`, 2 su `main`): nessuna
  guardia lo sorveglia. **Non toccato** — non l'ho verificato, ma qualcuno dovrebbe guardarlo.
- **La modale «Condividi» che blocca i click del worker**: misurata, **causa non nota**, non curata.

🩹 **La sonda dei doppioni, che deve tornare vuota** — alla chiusura di oggi: **vuota**.
```sql
select payload->>'id', count(*) from pmo_cloud_records
where record_type='member' and deleted is not true group by 1 having count(*) > 1;
```

---

## 5. 🧰 Attrezzi

| | |
|---|---|
| ordine push | prima `test-preview`, poi PR a `main` (≤15 file, mai dal ramo `test-preview`) |
| promozione app | ramo da `origin/main` + `git show <sha> -- index.html \| git apply --3way`, risolvere **solo** `APP_VERSION`. ⭐ Oggi ha funzionato alla lettera: conflitto **solo** lì |
| 🆕 versioni e guardia | `guard-docs-truth` legge **sia il codice sia il documento da `origin/main`** ⇒ dichiarare in anticipo la riga PROD **non** produce rossa transitoria |
| rispecchio docs | `git checkout test-preview -- docs/` da un ramo basato su `main`, poi `git diff origin/test-preview HEAD -- docs/` **vuoto** |
| console remota | `node console.mjs --env test\|prod --file x.js` in `tools/verifica-browser` (serve `npm install`). ⭐ **Lo stato accumulato si COSTRUISCE dentro lo snippet** |
| 🆕 globali dell'app | i soci sono in **`giocatori`**, non `members`; le schede in `assessmentResponses`, che si riempie con `await refreshAssessmentDataForMembersList({force:true})` |
| bot: stato e deploy | `stato-bot.yml` (sola lettura, con regex) · `deploy-bot-hetzner.yml` (`prova` predefinito; per `soci` va scritta la parola **SOCI**) |
| PR e Actions | **solo** `mcp__github__*`; `list_workflow_runs` sfora il contesto → salvare su file e leggere con `python3` |
| DB | MCP Supabase — PROD `qqbfphyslczzkxoncgex`, TEST `cudiqnrrlbyqryrtaprd` |
| commit | mai backtick in `-m`: heredoc con `-F -` |
| conteggi lista | l'intestazione **e** la fotografia: `guard-docs-truth` confronta tutt'e due |

---

## 6. 🤝 Come si procede (invariato)

> *«Procediamo sempre come tu pensi sia corretto»* — copre anche le promozioni; il freno è la
> **dichiarazione**. Fuori: inventare voci non in lista, e l'irreversibile/visibile (si dice
> prima, anche procedendo). ✋ **Un task non è finito finché non è provato fisicamente.**
> 📌 E: **«scrivi troppo» — risposte corte.**
