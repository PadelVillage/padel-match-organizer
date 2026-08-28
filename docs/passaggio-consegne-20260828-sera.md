# Passaggio di consegne — 28/08/2026, SERA (fine 55ª sessione)

**Come si usa:** incollalo come primo messaggio della chat nuova. È scritto per essere capito
**senza** la conversazione precedente.

⚠️ Pomeriggio tutto sul **test di livello** e su un difetto vecchio che l'ha bloccato: cinque PR
sul gestionale (#1160, #1161, #1162, #1163, #1164, #1165, #1166, #1168, #1169), una sul bot
(#107), un deploy del bot dei soci. **Il punto F è chiuso: non restano prove fisiche.**

---

## 🚨 LEGGI PRIMA QUESTO

> ### 📕 `docs/test-livello-regole.md` è la **fonte definitiva** sul test di livello.
> ### 📋 `docs/lavori/README.md` si apre **PRIMA di lavorare** — obbligo di casa.

**Tutto quello che riguarda il test sta nel primo, riga per riga, aggiornato a stasera.** Non si
va a memoria e non si deduce dal codice: le regole sono decisioni del committente.

📌 **Cosa è cambiato oggi in quel file:** una regola nuova (**B11**, le opzioni in ordine
casuale), **D2**, **D6**, **D9**, **D10**, **B2** e **B9** passate a ✅ provate dal vivo, e la
sezione **F** — le prove fisiche — **svuotata**.

⚖️ Regola invariata: **quando una regola cambia, la sua riga si corregge — non si affianca.**

---

## 1. ✅ Prima di lavorare

```
git fetch origin main test-preview
git diff origin/main origin/test-preview -- CLAUDE.md docs/ .github/workflows/ \
  tools/matchpoint-browser-worker/src/server.mjs
```
Vuoto = allineati. **Verificato a fine sessione, e nessuna PR aperta su nessuno dei due repo.**

🆕 Serve anche `PadelVillage/assistente-padel-agent` (→ `add_repo`, **una sola** clonazione con
timeout generoso, `register_repo_root`, poi `npm install` per `npm test` e `npm run check`).

### 🟢 Cosa gira

⚠️ **Qui gli sha NON sono scritti, ed è deliberato**: `CLAUDE.md` lo vieta — *«un file che cita
il proprio sha è vecchio nell'istante in cui lo si salva»*. Quello che resta vero è la **forma**
dello stato, e le versioni delle edge, che si rileggono in dieci secondi.

| dove | stato misurato a fine sessione |
|---|---|
| **gestionale** | `main` APP_VERSION **6.253** · `test-preview` **6.257** · rami allineati |
| **edge su PROD** | `assessment-quiz` **v19** · `matchpoint-clients-sync` **v67** · `consumer-assessment-link` v24 · `consumer-assessment-decision` v11 |
| **bot dei soci** (VM) | riavviato alle **15:20:25**, dichiara `qqbf… (PROD)` · `✍️ prenotazioni REALI` |
| banco bot | **1640/1640** · `tsc` pulito |
| banco gestionale | **62 file, zero rossi** |
| lista | 🔴 urgenti **7** · 📋 in coda **10** · 📦 chiuse **83** |

---

## 2. 🔨 COSA È STATO FATTO (tutto in servizio su PROD)

### 🎲 VOCE 104 — le opzioni delle 4 domande tecniche in ordine casuale

🗣️ Sua richiesta: *«dovrebbe essere un ordine random, se no dopo un po' la gente capisce questo
sistema»*. 🗣️ E **quali**, deciso da lui: *«mescola solo le 4 tecniche»* — scambio, vetro, rete,
colpi alti. Le due scale numeriche e le due sui livelli **restano ferme**: lì il nome della
fascia è scritto sul bottone e la posizione non aggiunge niente.

**Come**: `conOpzioniMescolate` mescola **al momento di presentarle**, dentro `domandeDelGiro`.
`SCHEDA_DOMANDE` resta la sorgente canonica ordinata — è ciò che tiene verde la parità con i
`<select>` di `index.html`.

🔒 Seme `seme(gettone, 'ordine-delle-opzioni', chiave)`: **solo gettone e chiave**. Non è
comodità — il bot risponde con la **posizione** del bottone, quindi un ordine che si spostasse
fra la tastiera e il tocco registrerebbe **una risposta mai data**.

🗣️⭐ **E una sua decisione presa su una misura**: vedendo il vetro con la più alta rimasta
ultima ha chiesto conto. Misurato su **20.000 gettoni** — la più alta finisce in ognuna delle
cinque posizioni al ~20%, tutte e 120 le permutazioni. Succede **una volta su cinque**, ed è ciò
che una mescolata uniforme deve fare. ⇒ *«teniamo la a»*, cioè uniforme.
⛔ **Scartato** il vincolo «la più alta mai ultima»: sembra più mescolato ed è **più debole**,
perché insegna *«l'ultima non è la più alta»* — un candidato eliminato a **ogni** domanda invece
che mai. 🔒 La decisione è protetta da una prova che diventa rossa se qualcuno lo aggiunge.

### 🧬 VOCE 69 — la chiave di una scheda non può retrocedere

**L'effetto di oggi**: Laura tocca il test e legge *«Non riesco ad aprire il test adesso»*. Prima:
*«Non hai prenotazioni»* a Fabiola (23/08), *«Non sono riuscito a farti entrare»* a Lidia (24/08).
**Stessa causa, tre gesti diversi.**

🩹🚨⭐⭐ **LE DUE RIGHE CHE LA SCHEDA PORTAVA ERANO FALSE**, ed è la parte che vale:

| scritto nella 69 | misurato |
|---|---|
| *«l'`anagrafica-mirror` (05:00) scrive `email:`»* | **non è deployata su PROD** (non è fra le edge vive) e il sorgente sta solo su `test-preview`: è un mirror **PROD → TEST** |
| *«la cura è far cercare al sync anche per `payload.id`»* | **non avrebbe curato niente**: il match c'è già |

🔎 **La catena vera**: `shouldNormalizeMemberLocalKey` è vera per ogni riga `source:
matchpoint_auto` — quasi tutto il circolo — quindi il ramo che sceglie la chiave usa la
**canonica dell'import**, e `memberCloudKey` la calcola col telefono se c'è, **altrimenti con
l'email**. ⇒ Un export senza telefono sposta la chiave da `phone:` a `email:`, nessuno cancella
la vecchia, e la stessa persona resta viva su **due righe**. Il difetto non è **trovare** la
riga: è **riscriverla sotto un'altra chiave**.

🔨 **Cura**: `chiaveDaScrivere` (`supabase/functions/matchpoint-clients-sync/chiave-canonica.ts`)
normalizza **verso l'alto o alla pari, mai verso il basso** — rango `phone:` > `email:` >
`name:` > legacy. 🔒 Decide **sotto che** chiave si scrive, mai **se**: non può cancellare nessuno.

### ⏱️ La sorveglianza del test da 5 secondi a 2

Sua decisione del 27/08. `INTERVALLO_SORVEGLIANZA_TEST_MS = 2_000` nel bot, al **confine esatto**
della guardia che esisteva già (`>= 2_000` e `<= 10_000`), sabotata da tutt'e due le parti.

🚨 **Ma la misura dice che non ha guadagnato niente** — vedi § 4.

---

## 3. ✅ IL PUNTO F È CHIUSO — le prove fisiche di oggi

| prova | esito |
|---|---|
| **2bis** — il messaggio del maestro senza corsa *(E11)* | chiusa su sua parola: Marco alle 10:58 legge la frase giusta, tetto scritto **8 secondi dopo** |
| **2** — la parola dimostrata *(D2)* | Marco dichiara **Base**, il bot dice *«Il test dice **Intermedio**»* |
| **1** — la memoria della pescata *(B9)* | letta nei dati: **3 prove di fila** su fascia Base, **15 domande distinte su 15**. Conferma di rimbalzo la **B2** (3 trabocchetto + 2 normali su tutte e cinque) |
| **D6** — un bottone vecchio non promette il falso | trovata **già fatta** nel registro del bot: `27/08 22:09:16 ⚠️ scelta livello non registrata per Marco Aprea: GIA_APPLICATA` |
| **B11** — le opzioni mescolate | due screenshot: il vetro **mescolato** (12:10), i sette livelli **in ordine** (14:02) |
| **D10** — il gradino cronometrato | Laura: tocco **13:59:37,417** → `applied_at` **13:59:39,632** = **2,2 s** (bersaglio ~4) |
| **D9** — la consegna cronometrata | consegna **15:55:27,3** → esito **15:55:32** = **~4,7 s** |

---

## 4. ⚠️ I DUE FATTI SCOMODI, scritti invece che taciuti

**① La D9 SMENTISCE la previsione con cui la cura era stata scritta.** 4,7 s contro i **4** del
27/08 con l'intervallo a 5″: **non è migliorato**. Il giro c'è stato a +2 s — i 2″ girano — ma è
stato **rimandato** da `aspettaIlSuoTurno`, la cura del 21/08 per cui *un avviso non si mette in
fila davanti a una risposta che il socio sta aspettando*.
⇒ **Il collo di bottiglia non è l'intervallo: è la finestra «sto rispondendo».** In quel giro,
con 5 secondi l'esito sarebbe arrivato **allo stesso istante**.
📌 *I «~1,5 s guadagnati» erano una previsione su un presupposto mai verificato. Una stima si
dichiara, ma finché non la si misura resta una previsione.*
⛔ Abbassare ancora l'intervallo **non guadagnerebbe niente**: la strada passa dalla finestra.

**② I 70 secondi del gradino di Fabiola (27/08) NON sono spiegati.** Oggi: 2,2 s. È misurato che
**non si ripetono**, non che si sappia perché quella volta successero.

---

## 5. ⏳ COSA RESTA

**A. 🔴 Le 7 urgenti, contate nel file e non ricordate**: **101, 97, 92, 84, 83, 78, 65** —
la lista canonica resta `docs/lavori/README.md`, non questo elenco.

**B. 🔴 Validare i punti E1–E10 uno per uno con lui** (doc delle regole). I più pesanti: **E1** il
ponte che REGISTRA non ha le protezioni del ponte che PARLA; **E2** `livello_applicato` dedotto
dalle date invece che da `applied_at`; **E3** i giri ricostruiti sulle ultime 20 schede.

**C. 🔎 Due fatti annotati e NON promossi a voce** — se diventano lavori lo decide lui:

1. ~~perché il 9 agosto la rete `eChiaveVecchiaDellaStessaScheda` non archiviò la riga
   vecchia~~ — 🩹 **DOMANDA MAL POSTA, corretta la sera del 28/08 misurando** (voce **105**).
   Cercava il colpevole nel **sync**; il doppione lo fa una **scrittura singola del
   gestionale**. 📏 Le righe `member` toccate per minuto quella sera: `17:31 → 1096` (giro di
   massa = il sync) contro `20:08 → 1`, `20:17 → 1`, `20:21 → 1` — i due gesti della
   segreteria e un'archiviazione a mano. ⇒ La causa è `pmoMemberCloudLocalKey` in
   `index.html`, che **calcola** la chiave dal telefono e scrive su una riga che non è quella
   viva (a Maurizio ne ha **rianimata una archiviata dal 19 luglio**). La rete del sync non
   c'entra: **non era il suo turno**;
2. i **70 secondi** del § 4 ②.

**D. 🚨 DA GUARDARE DOMATTINA, dopo il sync delle 05:00.** **Maurizio Aprea** e **Fabiola Limuti**
stanno su chiavi `email:`. Un export che porti il loro telefono li ri-chiaverà **verso l'alto**
(`email:` → `phone:`) — direzione che la cura di oggi **non blocca**, ed è giusto così. Ma se la
riga vecchia non viene archiviata, nasce un doppione nell'altro verso. La sonda è una riga:

```sql
select payload->>'id', count(*) from pmo_cloud_records
where record_type='member' and deleted is not true group by 1 having count(*) > 1;
```
Deve tornare **vuoto**. ~~Se torna qualcosa, è il punto **C①** che si è manifestato.~~

🚨🩹 **ED È SUCCESSO LA SERA STESSA, prima del sync delle 05:00 e per un'altra causa.** Alle
**22:17** una modifica di livello dalla segreteria ha sdoppiato **Maurizio**, e il bot gliel'ha
detto due minuti dopo rifiutandosi di scegliere. ⇒ Il rischio previsto qui era **giusto**, la
causa **no**: non serve un export che porti il telefono, basta **un gesto della segreteria** —
vedi la voce **105**. La riga `email:` è stata archiviata a mano (doppioni tornati a **0**), ma
il rattoppo non impedisce il prossimo: sono **25 soci** nella stessa condizione.

---

## 6. 🧠 LE TRAPPOLE DI OGGI — la lezione della sessione

**① 🚨⭐⭐ Il sabotaggio trova quello che la rilettura non vede — e tre volte il difetto era nella
prova che avevo appena scritto io.**
· la prova del punteggio della 104 era **tautologica** (confrontava un valore con sé stesso):
staccando `valore` da `testo` il banco restava **tutto verde** mentre il socio avrebbe letto
un'etichetta e fatto registrare un'altra;
· un **sale unico** dimezzava la cura in silenzio: le quattro domande uscivano con la **stessa**
permutazione, e da 120 ordini da capire si tornava a **uno**;
· la guardia sul cablaggio della 69 agganciava il `localKey` **sbagliato** (in `index.ts` ce ne
sono due) e falliva su codice giusto.
📌 *Una prova che confronta un valore con sé stesso è verde per sempre e non protegge niente.*

**② 🚨⭐⭐ Una tabella di taratura scritta a tavolino sbaglia, anche sapendo che sbaglia.** La mia
per `chiave-canonica` era falsa in **quattro righe su cinque** — ed è la **seconda volta** in
quella cartella (la prima in `chiave-vecchia-guard.test.ts`, 9/08, con la stessa lezione scritta
in testa al file). ⇒ *Saperlo non basta: va rifatta la misura.*

**③ 🚨 Una scheda può descrivere una causa che non esiste.** La 69 nominava una funzione **non
deployata** e proponeva una cura che **non avrebbe curato niente**. Tutt'e due corrette
misurando. 📌 *Una cura si disegna sul difetto raccontato e si convalida sul codice: se il
racconto e il codice non combaciano, il difetto è dove sta il codice.*

**④ 📏 Una prova può essere già passata dove non la si cercava.** La D6 era nel registro del bot
da ieri sera: un rifiuto **non scrive** `member_decision`, quindi in `self_assessments` non
lascia traccia. ⇒ *Prima di rifare una prova, si guarda se è già successa in un posto che non si
era pensato.*

**⑤ 📏 Una prova può nominare un oggetto che non è mai esistito.** Il bottone «Tengo Agonista»
della vecchia prova 3 **non è mai stato prodotto**: la cura `puo_scegliere` è atterrata il 26/08
alle 23:41 e la scheda Agonista di Laura è del 27/08 alle 19:34. La ricerca fallisce e **sembra
un guasto**.

**⑥ 🚨 Un bottone di Telegram si consuma al PRIMO tocco, anche se la scelta è RIFIUTATA.**
`riscriviOMandaNuovo` sta **fuori** dal `try/catch`. ⇒ Il commento in `scelta-livello.ts` — *«i
bottoni non scadono, il socio può schiacciare quello di tre settimane fa»* — è vero a metà: **non
scadono, ma sopravvivono a un solo tocco**.

**⑦ 📏 Una ricetta non si dà più per POSIZIONE.** Con la 104 in servizio, «il quarto» e «l'ultimo»
indicano una risposta a caso. Le ricette Ⓐ e Ⓑ in `docs/passaggio-consegne-20260828-mezzogiorno.md`
sono state corrette per **parole**. 📌 *Una cura che toglie una regolarità rende false tutte le
istruzioni che su quella regolarità si appoggiavano — e vanno cercate, perché nessuna diventa
rossa da sola.*

**⑧ ⚖️ Filtrare sulla colonna sbagliata dà un numero pulito e falso.** Avevo contato «sei soci
doppi» filtrando su `payload.active`; la guardia filtra su `deleted`. Erano **due**.

---

## 7. 👤 I soci di prova — livelli VERI, misurati a fine sessione

| socio | livello | nota |
|---|---|---|
| **Laura Aprea** (000140) | **3,5 — Intermedio** | scesa da 4 col gradino, **suo gesto** delle 15:59 |
| **Marco Aprea** (000133) | **3 — Intermedio** | messo da lui dal gestionale |
| **Maurizio Aprea** (000004) | **4 — Avanzato** | invariato |
| **Fabiola Limuti** (000291) | **1,5 — Principiante** | dal gradino del 27/08 |

🚨 **Se erano prove si rimettono dalla segreteria**, campo «Livello di gioco».

---

## 8. 🧰 Attrezzi

| | |
|---|---|
| ordine push | prima `test-preview`, poi PR a `main` (≤15 file, mai dal ramo `test-preview`) e merge |
| rispecchio su `main` | ramo da `origin/main` + `git cherry-pick`, poi verificare `git diff origin/test-preview HEAD -- <i file toccati>` **vuoto** |
| deploy bot | `deploy-bot-hetzner.yml`, `bersaglio: soci` + `conferma_soci: SOCI`; poi `stato-bot.yml` per leggere dove punta |
| 🔎 **sonda di sola lettura sul bot** | `stato-bot.yml` con una regex in `cerca` — è così che la D6 è saltata fuori. **Il registro del bot sa cose che il database non ha.** |
| banco gestionale | `node test/<nome>.test.mjs` · bot: `node --test test/*.test.ts` + `npm run check` |
| DB | MCP Supabase — PROD `qqbfphyslczzkxoncgex`, TEST `cudiqnrrlbyqryrtaprd` |
| edge in servizio | `get_edge_function` → salvare su file e `grep` (mai stampare). **Si legge il sorgente servito, non si deduce dal deploy verde.** |
| commit | mai backtick in `-m`: heredoc con `-F -` |
| conteggi lista | si verificano girando la logica di `guard-docs-truth` sul file: **otto numeri, devono tornare tutti** |

---

## 9. 🤝 Come si procede (invariato)

> *«Procediamo sempre come tu pensi sia corretto»* — copre anche le promozioni; il freno è la
> **dichiarazione**. Fuori: inventare voci non in lista, e l'irreversibile/visibile (si dice
> prima, anche procedendo). ✋ **Un task non è finito finché non è provato fisicamente.**
> 📌 E: **«scrivi troppo» — risposte corte.**
