# Passaggio di consegne — 27/08/2026, NOTTE (fine 57ª sessione)

**Come si usa:** incollalo come primo messaggio della chat nuova. È scritto per essere capito
**senza** la conversazione precedente.

⚠️ Sessione tutta sul **test di livello**, seconda metà della giornata: sei PR sul gestionale
(#1145–#1150), quattro sul bot (#101–#104), quattro deploy del bot dei soci. La cosa nuova è
**il gradino**; la cosa importante è che **tre difetti li ha trovati lui col telefono**, non i
banchi.

---

## 🚨 LEGGI PRIMA QUESTO: le regole del test di livello sono state RISCRITTE stanotte

> ### 📕 `docs/test-livello-regole.md` è la **fonte definitiva**.

**Tutto quello che riguarda il test di livello sta lì, riga per riga, aggiornato a stanotte** —
chi può farlo, le domande, cosa si scrive in scheda, cosa dice il bot, i punti ancora aperti e
le prove fisiche. ⇒ **Prima di toccare qualunque cosa del test — o anche solo di rispondere a
una domanda su come funziona — si apre quel file.** Non si va a memoria e non si deduce dal
codice: le regole sono decisioni del committente, e lì ci sono con le sue parole.

📌 **Perché è cambiato molto**: stanotte sono nate **tre** regole (il **gradino** C9, la memoria
della pescata B9, la rilettura delle domande B10 — più il «niente passati non veri» D10),
**cinque** sono state **corrette nella riga vecchia** (B5, C2, C4, D2, D3, D5) e **due** punti
aperti si sono **chiusi** (E4 ed E11). ⇒ Chi va a memoria su come funzionava ieri sbaglia in
**una decina di punti**.

⚖️ La regola di quel file è la stessa di sempre: **quando una regola cambia, la sua riga si
corregge — non si affianca**. Chi lavora al test aggiorna quel documento **nello stesso giro**
in cui cambia il codice, o il file smette di essere una fonte e diventa un archivio di versioni.

🤝 **La gemella** è `docs/test-livello-varianti.md`: là le **combinazioni** caso per caso
(P0–P7, F1, S1-S2, e la sezione nuova sul gradino). Le due si leggono insieme — le *regole* qui,
i *casi* là — e si correggono insieme.

📱 Versione da telefono, sempre aggiornata allo stesso indirizzo:
https://claude.ai/code/artifact/1ff03857-4d66-4590-8cce-3b6b17165585

---

## 1. ✅ Prima di lavorare: `docs/lavori/README.md` (obbligo invariato)

```
git fetch origin main test-preview
git diff origin/main origin/test-preview -- CLAUDE.md docs/ .github/workflows/
```
Vuoto = allineati. **Verificato a fine sessione.**

🆕 Servono anche: `PadelVillage/assistente-padel-agent` (→ `add_repo`, clone, **`npm install`**)
e `npm install` in `tools/verifica-browser` prima della console.

### 🟢 Cosa gira

🚨 **Questo documento è la fotografia della sessione del 27/08 notte, e il repo È ANDATO AVANTI
dopo di lei** — altre sessioni hanno lavorato sullo stesso test (PR fino alla **#1166** sul
gestionale e alla **#107** sul bot: le opzioni delle domande tecniche in ordine casuale, la 104
chiusa, la sorveglianza da 5 secondi a 2, e due delle prove fisiche qui sotto **già fatte**).
⇒ **Le righe qui sotto si rimisurano all'inizio della chat nuova**, non si credono: sono l'ultimo
stato che questa sessione ha visto, non lo stato di adesso.

| dove | ultimo stato visto da questa sessione |
|---|---|
| **gestionale `main`** | `3b0f8d0` — edge `consumer-assessment-link` **v24**, `consumer-assessment-decision` **v11**, `assessment-quiz` **v17** |
| **`test-preview`** | `6db69ca` — APP_VERSION **6.257** |
| **bot dei soci** (VM) | `86bb745` — dichiara `qqbf… (PROD)` · `✍️ prenotazioni REALI` |
| banco bot | **1629/1629** · `tsc` pulito |
| banco gestionale | tutto verde sui due rami |
| guardie (`worker-sync`, `docs-truth`) | 🟢 su ogni push |

```
git fetch origin main test-preview      # e si rileggono i due sha
```

---

## 2. 📚 I TRE DOCUMENTI DEL TEST DI LIVELLO

1. 📕 **`docs/test-livello-regole.md` — LE REGOLE DEFINITIVE**, una per riga con lo stato, i
   punti aperti **E1–E11** (E4 ed E11 chiusi stanotte) e le prove fisiche. **È il documento da
   aprire per qualunque domanda sul test**, e da correggere ogni volta che una regola cambia.
   ⭐ Versione da telefono, stesso indirizzo di sempre:
   https://claude.ai/code/artifact/1ff03857-4d66-4590-8cce-3b6b17165585
2. **`docs/test-livello-varianti.md`** — le combinazioni caso per caso (P0–P7, F1, S1-S2) più
   la sezione nuova **«IL GRADINO»**.
3. `docs/lavori/README.md`, sezione «…e la SERA del 27/08: IL GRADINO».

---

## 3. 🔨 COSA È STATO FATTO (tutto in servizio su PROD)

### ⭐ IL GRADINO — la terza risposta dopo una prova

🗣️ Sua regola: *«non dobbiamo ferire l'orgoglio del giocatore. Possiamo proporgli di scendere di
un gradino o se no di rimanere a livello dell'ultimo test fatto, oppure di rifare il test»*.

**Nato da**: l'esito arrivato a Fabiola alle 16:17 — *«il tuo livello resta Base… Vuoi
rifarlo?»* con **un bottone solo**. Lei Principiante l'aveva **dichiarato**: rifare il test
avrebbe dato lo stesso risultato **per sempre**. L'unica uscita portava dove il socio era già.

**La regola, una sola**: il gradino è **la fascia più alta che il test non smentisce** — la
**dimostrata** su una prova passata, quella **sotto la dichiarata** su una bocciata. Si scrive
il **massimo** di quella fascia (Principiante → 1,5).

**Cosa lo tiene sicuro** — e va saputo prima di toccarlo:
- si scende **solo col tocco**: le due porte di `decidi()` (cancello non superato, il livello
  non scende) si aprono su `member_decision = 'scendo'` e **mai** col silenzio;
- **una bocciatura non promuove nessuno**: se la fascia offerta non è più bassa di quella in
  scheda il bottone non esiste. Unica eccezione `0.5`, che non è un livello ma il «da definire»
  dell'**81%** dei soci (2.281 su 2.817);
- il ramo è una **strada a parte** in `decidi()`, non deroghe dentro la catena che protegge
  dalla sopravvalutazione;
- il **tetto non taglia una discesa**;
- ⛔ il bottone **non dice mai «scendo»**: dice la parola («✅ Va bene: Principiante»). Per
  l'81% dei soci quel gesto fa **salire** il numero, e scrivere «scendi» sarebbe falso.

📏 Perché serviva: delle **6** prove bocciate di sempre, **zero** avevano prodotto un livello.

### 🔓 Il cancello di Principiante si è sbloccato, ma non sbarra

🗣️ *«direi di sbloccare le domande della banca per principiante»* + *«un principiante mi può
sbagliare quattro risposte su cinque»* ⇒ `regole_fascia: { Principiante: { pass_min_correct: 0 } }`.
Le 36 domande (27 normali + 9 trabocchetto) erano nella banca dal 25/08 e **non venivano pescate
mai**. ⚖️ Zero è l'unica soglia possibile: la fascia va da 0,5 a 1,5, sotto non c'è nessun
gradino dove mandare un bocciato.

📏 **E la sua premessa era sbagliata, corretta con la misura**: l'aveva chiesto perché *«senò
nessuno può prenderlo»*, ma per chi sta a 0,5 il Principiante **si prendeva già** senza quiz —
le 3 schede senza cancello di sempre non avevano scritto per **altri tre motivi**. Sbloccarlo
serve a rendere il test **vero**, non a sbloccare un livello.

✅ **Le 36 domande sono state rilette una per una con lui.** Una sola correzione: la **P-14**
(«dietro la linea di **servizio**» — prima non diceva quale linea, e la distrattrice accanto
diceva «di fondo»). Le altre 35 invariate.

### 🩹 Le altre cure della notte

| cosa | perché |
|---|---|
| «Test superato» non si dice più su una scheda **senza cancello** | 0 domande su 0 non sono una prova passata: si dice che il test è **arrivato** |
| la domanda e il bottone nominano la **parola dimostrata** | Marco: dichiarato Base, calcolato Intermedio, bottone «Tengo Base», in scheda **Intermedio** |
| «Prendo X. Lo sto registrando» invece di «te l'ho registrato» | fra il tocco e il livello in scheda passano **69 secondi**, e Fabiola è andata a guardare dentro quella finestra |
| il messaggio del maestro nomina **il tetto** se sta per essere scritto | Laura: «in scheda hai Base», e **7 secondi dopo** c'era Intermedio |

---

## 4. ✅ LE PROVE FISICHE FATTE, e sono vere

Quattro soci, otto schede, **tre livelli cambiati davvero** la sera del 27/08.

- ✅ **IL GRADINO DAL VIVO** — Fabiola tocca `✅ Va bene: Principiante` alle **22:06:12**, e alle
  **22:07:21** il livello **1,5** è in anagrafica. Catena intera: bottone → ponte → `decidi` →
  scheda.
- ✅ un **test intero** col cancello nuovo (13 domande) e la **bocciatura** vista tre volte;
- ✅ il **cancello di Principiante che non boccia**;
- ✅ il **messaggio del maestro** su un caso vero.

🚨 **Tre livelli veri sono cambiati stanotte** — se erano prove, si rimettono dalla segreteria,
campo «Livello di gioco»:

| socio | adesso |
|---|---|
| Fabiola Limuti | **1,5 — Principiante** (l'ha scelto lei col gradino) |
| Marco Aprea | **3 — Intermedio** |
| Laura Aprea | **3,5 — Intermedio** |

---

## 5. ⏳ COSA RESTA

**A. 🔴 LE PROVE FISICHE che mancano** (sezione F del doc delle regole).
⚠️ **Almeno due sono già state fatte** dalle sessioni successive a questa (la parola dimostrata e
la memoria della pescata): **l'elenco vero è nel doc delle regole**, questo è quello che mancava
alla fine del 27/08.

1. **il gradino su una prova PASSATA** — è provato su una bocciatura, non ancora su chi passa
   dimostrando meno di quello che ha (P7 coi tre bottoni);
2. **la parola dimostrata nella domanda** — rifare il caso di Marco e leggere «Il test dice
   **Intermedio**»;
3. **il messaggio del maestro senza corsa** — rifare il caso di Laura e leggere «il test da solo
   arriva fino a Intermedio, e te lo sto scrivendo adesso»;
4. due test di fila con lo stesso socio → nessuna domanda ripetuta (la memoria della pescata);
5. un **bottone vecchio** «✅ Tengo Agonista» → risposta del maestro;
6. «Tengo» a parola uguale → «è già il livello che hai in scheda»;
7. Laura nel filtro «Da certificare dal maestro» del gestionale.

**B. 🔴 VALIDARE i punti E1–E10 uno per uno con lui** (doc delle regole). I più pesanti:
**E1** il ponte che REGISTRA non ha le protezioni del ponte che PARLA; **E2** `livello_applicato`
dedotto dalle date invece che da `applied_at` — ⚠️ **è la stessa forma dei difetti pagati due
volte stanotte**; **E3** i giri ricostruiti sulle ultime 20 schede.

**C.** Le altre urgenti della lista: **97, 92, 84, 83, 78, 65**.
📦 **La 69 è CHIUSA** (parola sua) — il socio doppio generato da una scheda senza telefono, e il
«Non hai prenotazioni» detto a chi in campo c'era. ⚠️ Al momento in cui questo documento è stato
scritto la riga era **ancora fra le urgenti** in `docs/lavori/README.md`: **la prima cosa da fare
nella chat nuova è spostarla fra le chiuse**, aggiornando i due conteggi — `guard-docs-truth` li
confronta con le voci contate, quindi o si spostano insieme o la guardia diventa rossa.
📦 Chiuse anche la **98**, la **100** e la **104** da sessioni successive a questa: la lista
canonica è `docs/lavori/README.md`, non questo elenco.

---

## 6. 🧠 LE TRAPPOLE DI STANOTTE — e sono la lezione della sessione

**① 🚨⭐⭐ Una regola giusta con in pasto una riga monca non gira.** Il gradino è stato messo in
servizio **inerte**: due `.select()` non chiedevano `declared_level` (una nemmeno
`calculated_level`) ⇒ la regola riceveva schede mutilate e tornava sempre vuota. **I banchi erano
verdi** — provano la *regola*, e la regola era giusta. `deno check` nemmeno: una select è una
stringa. ⇒ La sonda giusta non prova la regola: **confronta i due lati**. Adesso c'è una guardia
che legge le colonne dal modulo e le cerca in tutte le select.

**② 🚨⭐⭐ Una guardia sull'ISTANZA non protegge la classe.** Per quel difetto una guardia
**c'era già**, nata la notte prima per `calculated_level` — ma congelava la **stringa** della
select: è rimasta **verde** mentre mancava la seconda colonna, e poi è diventata rossa per il
motivo sbagliato (la stringa era *cambiata*). 📌 *Curare l'istanza invece della classe non è una
cura* — è in `CLAUDE.md` dal 15/08, e stanotte l'abbiamo pagata su una guardia.

**③ 🚨 Un passato dichiarato prima del fatto lo scopre chi va a guardare.** «Te l'ho registrato»
era falso per 69 secondi. Stessa forma sul messaggio del maestro, con 7 secondi.
📌 *Contro una corsa non si aggiunge un'attesa: si sceglie una parola che non corre.*

**④ ⚖️ Una premessa sua può essere sbagliata e la decisione giusta lo stesso.** «Sblocca le
domande, senò nessuno può prendere Principiante»: la seconda metà era falsa (misurata), la prima
era giusta per un'altra ragione. ⇒ Si misura **prima** di dare ragione, e poi si fa la cosa
chiedendola per il motivo vero.

**⑤ ⚖️ Due parole che coincidono nel caso che hai davanti sono due parole, non una.** La frase
del gradino («le tue risposte sono da X, posso registrartelo») nasceva su Fabiola, dove
dichiarata e dimostrata coincidevano — ed è per questo che la trappola non si vedeva.

**⑥ 📌 Un `deno check` in locale non c'è** (deno non installato, `deno.land` bloccato dal proxy):
gli errori di tipo delle edge li vede **solo la CI**.

**⑦ 📏 I conteggi del banco sono PINZATI** (domande, opzioni, trappole): chi tocca la banca li
aggiorna a mano, ed è voluto.

---

## 7. 🧰 Attrezzi

| | |
|---|---|
| ordine push | prima `test-preview`, poi PR a `main` (≤15 file, mai dal ramo `test-preview`) e merge |
| ordine di messa in servizio | **il bot MANDA** una parola nuova ⇒ prima il gestionale; **il bot RICEVE** un campo nuovo ⇒ può andare prima. Il ponte della scelta rifiuta con **400** le parole che non conosce |
| deploy bot | `deploy-bot-hetzner.yml`, `bersaglio: soci` + `conferma_soci: SOCI`; poi `stato-bot.yml` per leggere dove punta |
| banco gestionale | `node test/<nome>.test.mjs` · bot: `node --test test/*.test.ts` + `npx tsc --noEmit` |
| DB | MCP Supabase `execute_sql` — PROD `qqbfphyslczzkxoncgex`, TEST `cudiqnrrlbyqryrtaprd` |
| edge in servizio | `get_edge_function` → salvare su file e `grep` (mai stampare) |
| commit | mai backtick in `-m`: heredoc con `-F -` |

---

## 8. 🤝 Come si procede (invariato)

> *«Procediamo sempre come tu pensi sia corretto»* — copre anche le promozioni; il freno è la
> **dichiarazione**. Fuori: inventare voci non in lista, e l'irreversibile/visibile (si dice
> prima). ✋ **Un task non è finito finché non è provato fisicamente** — e stanotte quella regola
> ha trovato tre difetti che nessun banco aveva visto. 📌 E: **«scrivi troppo»** — risposte corte.
