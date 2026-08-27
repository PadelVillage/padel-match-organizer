# Il test di livello — LE REGOLE, una per una, per validarle

**Chiesta dal committente il 27/08/2026** — *«dammi la lista delle regole del bot riguardo il
test di livello, così analizziamo tutti i casi uno per uno e li validiamo»*. È la gemella di
`docs/test-livello-varianti.md`: là **le combinazioni**, qui **le regole** — ognuna con dove
vive e con lo stato. Si legge dall'alto e si valida riga per riga: ✅ = in servizio e vista
funzionare · 🔵 = in servizio, prova fisica non ancora fatta · ⚠️ = **da decidere con lui**.

📌 Misurata sul codice in servizio il 27/08 sera. Quando una regola cambia, la sua riga **si
corregge**, non si affianca.

---

## A. Chi può fare il test, e come comincia

| # | regola | dove vive | stato |
|---|---|---|---|
| A1 | Il test si fa **dentro Telegram**, una domanda alla volta; il link web resta come ripiego | `passi.js` (motore), bot `test-a-passi.ts` | ✅ |
| A2 | Chiunque può cominciare, **sempre**: giri da 3 prove, attesa fra i giri **zero** (25/08) e silenzio-assenso **zero** (26/08) | `giro-del-test.ts`: `GIORNI_DI_ATTESA=0`, `ORE_SILENZIO_ASSENSO=0` | ✅ |
| A3 | Il gettone si **riusa** finché non è consumato; stesso gettone ⇒ stesse domande, stesso ordine — **ed è un requisito di sicurezza**: alla consegna il server ripesca per correggere invece di fidarsi degli id del telefono | `consumer-assessment-link` + `pescaPerGettone` | ✅ |
| A4 | Il conto delle domande annunciato (**13**) esce dalla pescata vera, non da un numero scritto | `quantePescate` in `conoscenza.js` | 🔵 |
| A5 | A chi non ha livello, un **promemoria gentile** ogni 15 giorni | `promemoria-livello.ts` | ✅ |
| A6 | ⚠️ Il promemoria **non sa** di chi aspetta il maestro o è fermo per coerenza bassa: dopo 15 giorni chiederebbe di rifare il test a chi l'ha appena passato | `promemoria-livello.ts` (esclude solo `skip`) | ⚠️ da curare |

## B. Le domande

| # | regola | dove vive | stato |
|---|---|---|---|
| B1 | **8 domande di scheda** (le prime 3 fisse: esperienza, frequenza, livello dichiarato — la fascia si sceglie alla terza) | `SCHEDA_DOMANDE` in `passi.js` | ✅ |
| B2 | **5 di conoscenza: 2 normali + 3 trabocchetto**, pescate dalla fascia dichiarata, **mischiate** fra le domande 4-13 con ordine ripetibile per gettone | `conoscenza.js` + `domandeDelGiro` | 🔵 prova fisica |
| B3 | Soglia **4 su 5**: UNA sbagliata concessa, **qualunque** — trabocchetto compresa (sua regola «una su cinque»). Due trabocchetto sbagliate bocciano | `pass_min_correct=4`, `trap_wrong_fails=false` | 🔵 prova fisica |
| B4 | **Base gioca con la regola di tutti** — i margini del 9/08 sono tolti (sua delega: «il più difficile da azzeccare in basso») | `regole_fascia` | 🔵 |
| B5 | 🔄 **Principiante HA il quiz, ma non boccia** (sua decisione 27/08 sera: *«sblocca le domande della banca per principiante»*, soglia **0** perché *«un principiante mi può sbagliare 4 su 5»*). Qui c'era «Principiante non ha quiz», regola del 9/08: **corretta**. ⚖️ La soglia zero è l'unica possibile — la fascia va da 0,5 a 1,5, sotto non c'è nessun gradino dove mandare un bocciato. Semi-Pro e Professionista il quiz non ce l'hanno affatto: `skip`, e la scheda va in segreteria | `regole_fascia`, `fasciaDaLivello` | ✅ provata (Fabiola, 22:05) |
| B6 | Il segnale «Non esiste» è **rotto**: 12 trabocchetto **alla rovescia** (regole vere che sembrano inventate) — vedere «Non esiste» non dice più dove sta la verità | banca in `conoscenza.js`, guardia nel banco | 🔵 |
| B7 | La risposta giusta e il marchio `trap` **non escono mai** verso il telefono; si corregge sul server ripescando col gettone | `assessment-quiz` | ✅ |
| B8 | Banca: 27 normali + 12 trabocchetto per fascia; in un giro se ne vedono 5 ⇒ memorizzarla vuole molti giri | banca | ✅ |
| B9 | 🆕 **La pescata ha MEMORIA**: non ripropone le domande già viste nelle ultime 8 prove, finché ce n'è altro da dare. Le «già viste» sono quelle delle schede consegnate **prima che il gettone nascesse** — un fatto immutabile, così la pescata resta ripetibile (vedi A3). Con la banca esaurita ricomincia dalle **più vecchie**: degrada, non fallisce | `ordinaPerFreschezza` in `conoscenza.js` + `domandeGiaViste` in `assessment-quiz/index.ts` | 🔵 prova fisica |
| B10 | 🆕 Le **36 domande di Principiante** (27 normali + 9 trabocchetto) sono state **rilette una per una col committente** il 27/08 sera: una sola correzione, la **P-14** («Dietro la linea di **servizio**», che prima non diceva quale linea) | banca in `conoscenza.js` | ✅ |

## C. Cosa si scrive in scheda (il gestionale)

| # | regola | dove vive | stato |
|---|---|---|---|
| C1 | Il livello lo scrive **il gestionale**, mai il test da solo sopra il tetto: **3,5 (Intermedio) è il massimo automatico** — sopra certifica il **maestro** guardando giocare | `TETTO_AUTOMATICO`, `decidi` | ✅ |
| C2 | 🔄 **Il livello non scende mai DA SOLO** (27/08). Dalla sera del 27/08 c'è **una** strada in più e passa dal socio: il **gradino** (C9), che scende solo col suo tocco. Col silenzio non si scende mai, e a far scendere qualcuno senza che l'abbia chiesto resta la segreteria | `decidi` | ✅ |
| C3 | Dal maestro si va solo per una **PAROLA nuova**: stessa fascia (4 → 4,5, tutti e due «Avanzato») = niente da certificare, bottoni «Tengo / Riprovo» | `sopraIlTetto` + gemella `assessmentAspettaIlMaestro` | ✅ provata (Maurizio, 12:26) |
| C4 | 🔄 Chi dimostra **meno** di ciò che ha: niente domanda — «il tuo livello resta X» — e **TRE** bottoni (il gradino, «mi tengo il mio», «lo rifaccio»). Fino al 27/08 sera il bottone era **uno solo**, e rifare il test dava lo stesso risultato **per sempre**: l'unica uscita portava dove il socio era già | `ilTestDiceMeno`, P7 | 🔵 il ramo P7 coi tre bottoni non è ancora stato visto dal vivo |
| C5 | Coerenza: dichiarato e calcolato oltre **0,5** di distanza ⇒ scheda ferma (`review` per lo staff); risposte incoerenti ⇒ `consistency low`, non si applica | `decidi` | ✅ |
| C6 | Una scheda **vecchia** non scavalca un livello aggiornato dopo; una scheda **in mano allo staff** non si tocca; **una scheda sola per socio**, la più recente | `decidi` | ✅ |
| C7 | Chi sta **sotto** il tetto e dimostra sopra: si scrive **Intermedio** intanto, il resto lo dà il maestro (sua scelta 26-27/08) | `decidi` | ✅ |
| C8 | L'applicazione parte **al tocco** su «Tengo» e col cron dei 15′ come rete | `consumer-assessment-decision` + cron | ✅ |
| C9 | 🆕⭐ **IL GRADINO** — sua regola del 27/08 sera: *«non dobbiamo ferire l'orgoglio del giocatore: possiamo proporgli di scendere di un gradino, o di rimanere al livello dell'ultimo test, oppure di rifare il test»*. Si offre **la fascia più alta che il test non smentisce** (la **dimostrata** su una prova passata, quella **sotto la dichiarata** su una bocciata) e si scrive il **massimo** di quella fascia. 🔒 Solo col tocco, mai col silenzio; **mai una fascia più alta** di quella che il socio ha già (una bocciatura non promuove nessuno); l'unica eccezione è chi sta a `0.5`, che non è un livello ma il «da definire» dell'81% dei soci. ⛔ Il bottone **non dice mai «scendo»**: dice la parola | `gradinoOfferto` + ramo `SCELTA_SCENDO` di `decidi` | ✅ **provata dal vivo** (Fabiola 27/08: tocco 22:06:12 → livello 1,5 in anagrafica 22:07:21) |

## D. Cosa dice il bot (il gestionale SA, il bot DICE)

| # | regola | dove vive | stato |
|---|---|---|---|
| D1 | A ogni esito **un messaggio esce sempre** — il silenzio eterno della terza prova è curato (P0) | `siPuoAnnunciareIlTest` | ✅ provata (12:26) |
| D2 | 🔄 `pass` normale: domanda **«tieni o riprovi?»** coi due bottoni. La parola nella domanda e sul bottone è quella **DIMOSTRATA**, cioè quella che verrà scritta — non la dichiarata. 📏 Curato il 27/08 sera sul caso di Marco: dichiarato **Base**, calcolato **Intermedio**, il bot chiedeva «Tengo Base» e in scheda finiva **Intermedio** | `testoDomandaScelta` + `livello_dimostrato` dal ponte | 🔵 curato, non ancora rivisto dal vivo |
| D3 | `pass` sopra il tetto con parola nuova: messaggio del **maestro** («in scheda hai X… ti certifica il maestro, passa dalla segreteria») — la parola detta è quella dell'**anagrafica**, mai la dichiarata | `testoEsitoTest` | ✅ provata (Laura) |
| D4 | «Tengo» quando la parola è già in scheda: **niente promessa di registrazione** — «è già il livello che hai in scheda» | `testoSceltaRegistrata` | 🔵 |
| D5 | 🔄 `fail`: «è rimasta un'incongruenza» + **TRE** bottoni quando un gradino c'è (il gradino, «Mi tengo il mio livello», «Rifaccio»); due quando non c'è | `testoEsitoTest` + decision | ✅ provata (Fabiola e Laura, 27/08 sera) |
| D6 | I **bottoni vecchi** rimasti in chat non promettono mai il falso: reti su maestro, stessa-parola, dice-meno | `testoSceltaRegistrata` | 🔵 (B della lista) |
| D7 | Mai un numero al socio: **sempre la parola** | ovunque | ✅ |
| D8 | Mai un vicolo cieco: ogni messaggio ha un bottone o la via a parole | promemoria.ts | ✅ |
| D9 | L'esito arriva in **secondi** (sorveglianza ogni 5″, riarmata a ogni tocco; rete dei 15′) | bot promemoria.ts | ✅ misurata (4″ il 27/08) |
| D10 | 🆕 **Niente passati che non sono ancora veri.** Al tocco sul gradino il bot dice *«Prendo X. Lo sto registrando: fra poco lo trovi in «il mio livello»»* — non «te l'ho registrato». 📏 Misurato su Fabiola: fra il tocco e il livello in anagrafica passano **69 secondi**, e lei è andata a guardare **prima** | `testoSceltaRegistrata` | 🔵 curato stasera |

---

## E. ⚠️ DA VALIDARE UNO PER UNO — i punti aperti della rilettura del 27/08

Trovati misurando, **nessuno ancora deciso**. Ordinati per quanto costano se restano.

| # | il punto | perché conta | proposta |
|---|---|---|---|
| E1 | **Il ponte che REGISTRA la scelta non ha le protezioni del ponte che PARLA**: `consumer-assessment-decision` non sa di maestro/stessa-fascia/dice-meno — un bot vecchio o un bottone di settimane fa può ancora registrare scelte senza effetto | è la strada da cui il caso Laura può rinascere | portare i tre fatti anche lì, o accettarlo dichiarandolo (le reti del bot già coprono chi è aggiornato) |
| E2 | **`livello_applicato` è DEDOTTO dalle date** (`selfAssessmentDate` vs `submitted_at`, ±60″) mentre `applied_at` sta nella stessa tabella e non è nella select | stessa forma della select monca già pagata; una scheda applicata dopo rende «applicate» anche le precedenti | aggiungere `applied_at` alla select e leggerlo |
| E3 | **I giri si ricostruiscono su 20 schede** (le ultime): oltre 20 prove i confini dei giri slittano in silenzio | Maurizio è già a quota 10+ | alzare il limite o leggere in ordine crescente completo |
| E5 | **Il NUMERO del livello esce verso il bot** (`livello`), contro la regola «mai il numero» | oggi il bot non lo mostra, ma il campo invita | toglierlo o rinominarlo a uso diagnostico |
| E6 | **`applicazione_lanciata` può dire il vero a vuoto** (il dispatcher è «spara e dimentica») — oggi il bot **non lo legge**: campo morto | un campo morto è la prossima promessa falsa | toglierlo, o renderlo vero prima di usarlo |
| E7 | **Codici di rifiuto fuori contratto**: `AMBIGUA`, `SCHEDA_NON_TROVATA` non hanno frase nel bot → uscirebbe il ripiego generico | raro ma possibile coi bottoni vecchi | aggiungere le due frasi |
| E8 | **Campi inerti**: `scelta_entro` (attesa zero), ramo `attesa` del link (giri infiniti), `senza_cancello` (doppione di `skip`) | documentare o potare | dichiararli reversibili dov'è già scritto, potare il resto |
| E9 | **A6 qui sopra**: il promemoria a chi aspetta il maestro | messaggio irritante a chi ha appena fatto il test | escludere chi ha una scheda `pass` recente sopra il tetto |
| E10 | **`nome` ripiega su «Socio»** nell'URL del quiz per anagrafiche incomplete | scheda che nasce anonima | rifiutare o chiedere il nome |
| ~~E11~~ | ✅ **CURATO il 27/08 notte, opzione Ⓐ scelta da lui.** 📏 Il difetto: a Laura alle 22:15 il messaggio del maestro ha detto *«per adesso in scheda hai **Base**»* e **7 secondi dopo** il tetto le ha scritto **Intermedio** — il bot nominava lo stato di PRIMA della scrittura che quella stessa scheda provoca. ⇒ Adesso si nomina **una parola che non corre**: il **tetto** se sta per essere scritto (*«Il test da solo arriva fino a Intermedio, e te lo sto scrivendo adesso»*), quello che ha **adesso** se non cambia niente (*«In scheda ti resta Avanzato»*). ⛔ Scartata la Ⓑ (aspettare la scrittura): riaprirebbe il silenzio di P0 per chi sta già sopra il tetto. 📌 *Contro una corsa non si aggiunge un'attesa: si sceglie una parola che non corre* | — | ✅ chiuso |
| ~~E4~~ | ✅ **CURATO il 27/08 sera** — e non era teorico: è capitato a **Marco Aprea alle 22:08:53** (dichiarato Base, calcolato Intermedio, bottone «Tengo Base», in scheda **Intermedio** nove secondi dopo). Il ponte manda `livello_dimostrato` e il bot usa quella nella domanda, sul bottone e nella conferma | — | ✅ chiuso |

---

## F. Le prove fisiche che mancano (in ordine)

📏 **Aggiornate la sera del 27/08, dopo la sessione di prove vere sul telefono** — quattro soci
(Fabiola, Marco, Laura, Maurizio), otto schede, tre livelli cambiati davvero.

**✅ FATTE quella sera:**

- ✅ **Un test intero col cancello nuovo** — 13 domande, conoscenza sparse, e la **bocciatura**
  vista due volte (Fabiola 3/5 e 2/5, Laura 2/5). *(B2, B3, B6)*
- ✅ **Il GRADINO dal vivo**, ed era la prova che contava: Fabiola tocca `✅ Va bene:
  Principiante` alle **22:06:12** e alle **22:07:21** il livello **1,5** è in anagrafica.
  Ha attraversato la catena intera — bottone → ponte → `decidi` → scheda. *(C9)*
- ✅ **Il cancello di Principiante che non boccia** (Fabiola, 22:05). *(B5)*
- ✅ **Il messaggio del maestro** su un caso vero (Laura, 22:15). *(D3)*

**⏳ RESTANO:**

0. **Due test di fila con lo stesso socio**: nessuna domanda ripetuta fra il primo e il
   secondo (la memoria, B9). Misurato al banco: 0% di ripetizioni fino a 3 prove.
1. **P7 coi TRE bottoni**: dichiarare una fascia più bassa di quella in scheda e **passare**.
   ⚠️ Il gradino è provato su una **bocciatura**, non ancora su una prova passata *(C4)*.
2. **La parola dimostrata nella domanda**: rivedere il caso di Marco (dichiarato Base,
   calcolato Intermedio) e leggere ora «Il test dice **Intermedio**» *(D2)*.
2bis. **Il messaggio del maestro senza corsa**: rifare il caso di Laura (sotto il tetto) e
   leggere «Il test da solo arriva fino a **Intermedio**, e te lo sto scrivendo adesso»
   invece del livello di prima *(E11 curata)*.
3. **Bottone vecchio** «✅ Tengo Agonista» di ieri: deve rispondere il maestro *(D6)*.
4. **«Tengo» a parola uguale**: «è già il livello che hai in scheda» *(D4)*.
5. La **voce 100**: Laura nel filtro «Da certificare dal maestro» del gestionale.

---

## G. 🚨 Le tre trappole della sera del 27/08 — trovate dalle SUE prove, non dai banchi

Vale la pena tenerle: sono la ragione per cui la prova fisica non è una formalità.

**① Una regola giusta con in pasto una riga monca non gira.** Il gradino era **inerte**: due
`.select()` non chiedevano `declared_level` (e una nemmeno `calculated_level`) ⇒ la regola
riceveva schede senza i campi che legge e tornava sempre vuota. I banchi erano verdi — provano
la **regola**, e la regola era giusta. `deno check` nemmeno: una select è una stringa.
⇒ La sonda giusta non prova la regola: **confronta i due lati**. Adesso le colonne si leggono
dal modulo e si cercano in tutte le select.

**② Una guardia sull'ISTANZA non protegge la classe.** Per quel difetto una guardia **c'era
già** — nata la notte prima per `calculated_level` — ma congelava la **stringa** della select:
è rimasta verde mentre mancava la seconda colonna, e poi è diventata rossa per il motivo
sbagliato (la stringa era *cambiata*). 📌 *Curare l'istanza invece della classe non è una cura.*

**③ Un passato dichiarato prima del fatto lo scopre chi va a guardare.** «Te l'ho registrato»
era falso per **69 secondi**, e Fabiola ha chiesto «il mio livello» dentro quella finestra.
⇒ Si dice il gesto al presente e la scrittura come sta succedendo, senza promettere minuti.
