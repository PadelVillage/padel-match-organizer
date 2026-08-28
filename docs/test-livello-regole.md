# Il test di livello — LE REGOLE, una per una, per validarle

**Chiesta dal committente il 27/08/2026** — *«dammi la lista delle regole del bot riguardo il
test di livello, così analizziamo tutti i casi uno per uno e li validiamo»*. È la gemella di
`docs/test-livello-varianti.md`: là **le combinazioni**, qui **le regole** — ognuna con dove
vive e con lo stato. Si legge dall'alto e si valida riga per riga: ✅ = in servizio e vista
funzionare · 🔵 = in servizio, prova fisica non ancora fatta · ⚠️ = **da decidere con lui**.

📌 Misurata sul codice in servizio il 27/08 sera, poi **passata riga per riga col committente** la
notte stessa: le righe segnate 🔄 sono quelle che ha corretto lui, e i punti della sezione E sono
**tutti decisi**. Quando una regola cambia, la sua riga **si corregge**, non si affianca.

---

## A. Chi può fare il test, e come comincia

| # | regola | dove vive | stato |
|---|---|---|---|
| A1 | 🔄 Il test si fa **dentro Telegram**, una domanda alla volta. *(Corretta con lui: «il link web non serve più» — il ripiego esce dalla regola.)* | `passi.js` (motore), bot `test-a-passi.ts` | ✅ |
| A2 | 🔄 Chiunque può cominciare, **sempre**: **nessun limite di prove** (sua parola: *«il test non ha limiti di prove»*), nessuna attesa fra un test e l'altro, silenzio-assenso zero. ⚖️ Il vocabolario dei «giri da 3 prove» esce da qui: la regola che lo reggeva non c'è più | `giro-del-test.ts`: `GIORNI_DI_ATTESA=0`, `ORE_SILENZIO_ASSENSO=0` | ✅ |
| A3 | 🔄 **Ogni test è una pescata nuova**: domande diverse e ordine diverso a ogni prova (è la memoria della B9). Un test lasciato a metà però **riprende dov'era**, con le stesse domande — il gettone si riusa finché non è consumato, **ed è un requisito di sicurezza**: alla consegna il server ripesca per correggere invece di fidarsi degli id del telefono | `consumer-assessment-link` + `pescaPerGettone` | ✅ |
| A4 | Il conto delle domande annunciato (**13**) esce dalla pescata vera, non da un numero scritto | `quantePescate` in `conoscenza.js` | 🔵 |
| A5 | A chi non ha livello, un **promemoria gentile** ogni 15 giorni | `promemoria-livello.ts` | ✅ |
| A6 | 🔄 **Chi aspetta il maestro non riceve il promemoria**: l'avviso va alla **segreteria**, non al socio (sua regola, e vale *solo* per chi aspetta il maestro — il promemoria normale ai soci senza livello resta, A5). Oggi il codice esclude solo `skip`, quindi a chi ha appena passato il test chiederebbe di rifarlo | `promemoria-livello.ts` | ⚠️ **da fare** |

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
| B10 | 🆕 Le **36 domande di Principiante** (27 normali + 9 trabocchetto) sono state **rilette una per una col committente** il 27/08 sera: una sola correzione, la **P-14** («Dietro la linea di **servizio**», che prima non diceva quale linea) | banca in `conoscenza.js` | ✅ · 🆕 **28/08: passata di ITALIANO su tutte e 192**, su sua richiesta (*«bisognerebbe fare un'analisi grammaticale di tutti i testi»*, errori visti scorrendo e non ricostruibili a memoria). Nessun errore di accento o apostrofo — **sette** correzioni più fini: la concordanza di **P-20** («che salgono» → «che sale», con soggetto singolare), lo spagnolo di **B-T10** (`contropared` → **controparete**, come già in AG-02), il pronome senza antecedente di **A-15**, la ripetizione di **I-15**, la preposizione fuori squadra di **P-14**, e la forma di **B-22** e **B-26**. ⛔ **Nessun `correct:` toccato e nessun significato cambiato**: solo testo, e il banco dei 36 caratteri gira verde |

## C. Cosa si scrive in scheda (il gestionale)

| # | regola | dove vive | stato |
|---|---|---|---|
| C1 | Il livello lo scrive **il gestionale**, mai il test da solo sopra il tetto: **3,5 (Intermedio) è il massimo automatico** — sopra certifica il **maestro** guardando giocare | `TETTO_AUTOMATICO`, `decidi` | ✅ |
| C2 | 🔄 **Il livello non scende mai DA SOLO** (27/08). Dalla sera del 27/08 c'è **una** strada in più e passa dal socio: il **gradino** (C9), che scende solo col suo tocco. Col silenzio non si scende mai, e a far scendere qualcuno senza che l'abbia chiesto resta la segreteria | `decidi` | ✅ |
| C3 | Dal maestro si va solo per una **PAROLA nuova**: stessa fascia (4 → 4,5, tutti e due «Avanzato») = niente da certificare, bottoni «Tengo / Riprovo» | `sopraIlTetto` + gemella `assessmentAspettaIlMaestro` | ✅ provata (Maurizio, 12:26) |
| C4 | 🔄 Chi dimostra **meno** di ciò che ha: niente domanda — «il tuo livello resta X» — e **TRE** bottoni (il gradino, «mi tengo il mio», «lo rifaccio»). Fino al 27/08 sera il bottone era **uno solo**, e rifare il test dava lo stesso risultato **per sempre**: l'unica uscita portava dove il socio era già | `ilTestDiceMeno`, P7 | ✅ **provata dal vivo** (Maurizio, 28/08 10:11: dichiarato Base con Avanzato in scheda, i tre bottoni sono usciti) |
| C5 | Coerenza: dichiarato e calcolato oltre **0,5** di distanza ⇒ scheda ferma (`review` per lo staff); risposte incoerenti ⇒ `consistency low`, non si applica | `decidi` | ✅ |
| C6 | Una scheda **vecchia** non scavalca un livello aggiornato dopo; una scheda **in mano allo staff** non si tocca; **una scheda sola per socio**, la più recente | `decidi` | ✅ |
| C7 | 🔄 Chi sta **sotto** il tetto e dimostra **almeno Avanzato**: si scrive **Intermedio** intanto, il resto lo dà il maestro (sua scelta 26-27/08, soglia precisata da lui la notte del 27). Sotto quella soglia il tetto non si tocca. ⚠️ **Da misurare** che il codice si comporti così: se bastasse un mezzo passo sopra Intermedio, la regola scritta e quella in servizio direbbero due cose diverse | `decidi` | ✅ |
| C8 | L'applicazione parte **al tocco** su «Tengo» e col cron dei 15′ come rete | `consumer-assessment-decision` + cron | ✅ |
| C9 | 🆕⭐ **IL GRADINO** — sua regola del 27/08 sera: *«non dobbiamo ferire l'orgoglio del giocatore: possiamo proporgli di scendere di un gradino, o di rimanere al livello dell'ultimo test, oppure di rifare il test»*. Si offre **la fascia più alta che il test non smentisce** (la **dimostrata** su una prova passata, quella **sotto la dichiarata** su una bocciata) e si scrive il **massimo** di quella fascia. 🔒 Solo col tocco, mai col silenzio; **mai una fascia più alta** di quella che il socio ha già (una bocciatura non promuove nessuno); l'unica eccezione è chi sta a `0.5`, che non è un livello ma il «da definire» dell'81% dei soci. ⛔ Il bottone **non dice mai «scendo»**: dice la parola | `gradinoOfferto` + ramo `SCELTA_SCENDO` di `decidi` | ✅ **provata dal vivo** (Fabiola 27/08: tocco 22:06:12 → livello 1,5 in anagrafica 22:07:21) |

## D. Cosa dice il bot (il gestionale SA, il bot DICE)

| # | regola | dove vive | stato |
|---|---|---|---|
| D1 | 🔄 A ogni esito **un messaggio esce sempre**: nessun test finisce nel silenzio (P0). *(Corretta con lui: il riferimento alla «terza prova» viene da una regola che non c'è più — vedi A2.)* | `siPuoAnnunciareIlTest` | ✅ provata (12:26) |
| D2 | 🔄 `pass` normale: domanda **«tieni o riprovi?»** coi due bottoni. La parola nella domanda e sul bottone è quella **DIMOSTRATA**, cioè quella che verrà scritta — non la dichiarata. 📏 Curato il 27/08 sera sul caso di Marco: dichiarato **Base**, calcolato **Intermedio**, il bot chiedeva «Tengo Base» e in scheda finiva **Intermedio** | `testoDomandaScelta` + `livello_dimostrato` dal ponte | 🔵 curato, non ancora rivisto dal vivo |
| D3 | `pass` sopra il tetto con parola nuova: messaggio del **maestro** («in scheda hai X… ti certifica il maestro, passa dalla segreteria») — la parola detta è quella dell'**anagrafica**, mai la dichiarata | `testoEsitoTest` | 🩹 **CURATA il 28/08, e il difetto era vivo**: la parola detta era quella **DICHIARATA**, non la dimostrata. 📏 Marco alle 10:58 — dichiarato Intermedio, dimostrato Avanzato — ha letto *«le tue risposte sono da Intermedio, ma un livello così alto non lo decide il test»* mentre la riga sopra annunciava di star scrivendo proprio Intermedio: due affermazioni opposte sulla stessa parola. È la E4 sopravvissuta in un altro ramo (curata la domanda, non l'esito). In servizio dalle 11:08 · ✅ **riprovata dal vivo** (Marco, 28/08 11:12: dichiarato Intermedio, dimostrato Avanzato, e il messaggio dice ora «le tue risposte sono da **Avanzato**»). ⚖️ La prova vecchia (Laura) valeva per il **ramo**, non per la **parola** |
| D4 | «Tengo» quando la parola è già in scheda: **niente promessa di registrazione** — «è già il livello che hai in scheda» | `testoSceltaRegistrata` | ✅ **provata dal vivo** (Maurizio, 27/08 21:52, letta sullo schermo il 28/08) |
| D5 | 🔄 `fail`: «è rimasta un'incongruenza» + **TRE** bottoni quando un gradino c'è (il gradino, «Mi tengo il mio livello», «Rifaccio»); due quando non c'è | `testoEsitoTest` + decision | ✅ provata (Fabiola e Laura, 27/08 sera) |
| D6 | I **bottoni vecchi** rimasti in chat non promettono mai il falso: reti su maestro, stessa-parola, dice-meno | `testoSceltaRegistrata` | 🔵 (B della lista) |
| D7 | Mai un numero al socio: **sempre la parola** | ovunque | ✅ |
| D8 | Mai un vicolo cieco: ogni messaggio ha un bottone o la via a parole | promemoria.ts | ✅ |
| D9 | 🔄 L'esito arriva in **secondi**: sorveglianza ogni **5″ da quando il socio apre il quiz** (ogni 30″ prima, fino a 4 ore), riarmata a ogni tocco; rete dei 15′. 🆕 **Sua decisione: portare i 5″ a 2″** — toglie ~1,5″ dei 4 misurati; costa ~600 domande al ponte invece di ~240 nel caso peggiore, e si sorveglia **una persona per volta**. ⏳ Vuole modifica al bot, deploy sulla VM e la prova col cronometro | bot `promemoria.ts` (`INTERVALLO_SORVEGLIANZA_TEST_MS`) | ✅ misurata (4″ il 27/08) · ⚠️ **i 2″ da fare** |
| D10 | 🆕 **Niente passati che non sono ancora veri.** Al tocco sul gradino il bot dice *«Prendo X. Lo sto registrando: fra poco lo trovi in «il mio livello»»* — non «te l'ho registrato». 🎯 **E l'obiettivo, deciso con lui**: un tocco sul gradino deve portare il livello in scheda negli stessi **~4 secondi** di «mi fermo». Se ne mette 70, è un difetto. 📏 Le quattro applicazioni vere che esistono: **4″** col giro veloce (24/08), **11′27″** e **14′03″** col solo cron (prima di quella cura), **70″** sul gradino di Fabiola. 🚨 E i 66 secondi in più **non hanno ancora una spiegazione**: la riga che lancia il giro su `scendo` c'è dal commit `3eb8026` (15:29 UTC), cinque ore prima del suo tocco, e il registro dei dispatch non conserva nessuna riga per quel giro. ⏳ **Primo passo: un gradino vero cronometrato** | `testoSceltaRegistrata` + `consumer-assessment-decision` | 🔵 curato · ⚠️ **i 70″ da capire** |
| D11 | 🆕 **«Test superato» non si dice su una scheda senza cancello**: zero domande su zero non sono una prova passata — si dice che il test è **arrivato**. *(Cura della notte del 27/08, validata con lui.)* | `testoEsitoTest` | 🔵 |

---

## E. ✅ VALIDATI UNO PER UNO — i punti della rilettura del 27/08

Trovati misurando, e **passati uno per uno con lui** la notte del 27/08: **tutti e nove approvati,
nessuno scartato**, e su tre ha scelto lui la forma (E3, E5, E8). Ordinati per quanto costano se
restano. ⏳ Approvato non vuol dire fatto: nessuno di questi è ancora costruito.

| # | il punto | perché conta | proposta |
|---|---|---|---|
| E1 | **Il ponte che REGISTRA la scelta non ha le protezioni del ponte che PARLA**: `consumer-assessment-decision` non sa di maestro/stessa-fascia/dice-meno — un bot vecchio o un bottone di settimane fa può ancora registrare scelte senza effetto | è la strada da cui il caso Laura può rinascere | ✅ **APPROVATA**: portare i tre fatti (maestro, stessa fascia, dice meno) anche nel ponte che registra |
| E2 | **`livello_applicato` è DEDOTTO dalle date** (`selfAssessmentDate` vs `submitted_at`, ±60″) mentre `applied_at` sta nella stessa tabella e non è nella select | stessa forma della select monca già pagata; una scheda applicata dopo rende «applicate» anche le precedenti | ✅ **APPROVATA**: leggere `applied_at` invece di dedurlo dalle date |
| E3 | **I giri si ricostruiscono su 20 schede** (le ultime): oltre 20 prove i confini dei giri slittano in silenzio | Maurizio è già a quota 10+ | ✅ **APPROVATA, e la forma l'ha scelta lui**: **leggere tutta la storia**, non alzare il limite — senza limite di prove (A2) un numero più grande rimanda soltanto lo stesso difetto a chi prova di più |
| E5 | **Il NUMERO del livello esce verso il bot** (`livello`), contro la regola «mai il numero» | oggi il bot non lo mostra, ma il campo invita | ✅ **APPROVATA, forma sua**: **toglierlo**, non rinominarlo — il bot la parola ce l'ha già dal gestionale, e un campo che non serve è la prossima occasione di sbagliare |
| E6 | **`applicazione_lanciata` può dire il vero a vuoto** (il dispatcher è «spara e dimentica») — oggi il bot **non lo legge**: campo morto | un campo morto è la prossima promessa falsa | ✅ **APPROVATA**: toglierlo per adesso. Se un domani serve dire «te l'ho registrato» con certezza, il campo giusto non è questo — è uno che dica **scritto**, e nascerà col lavoro dei 4 secondi (D10) |
| E7 | **Codici di rifiuto fuori contratto**: `AMBIGUA`, `SCHEDA_NON_TROVATA` non hanno frase nel bot → uscirebbe il ripiego generico | raro ma possibile coi bottoni vecchi | ✅ **APPROVATA**: scrivere le due frasi, così al posto del ripiego generico il socio legge cos'è successo |
| E8 | **Campi inerti**: `scelta_entro` (attesa zero), ramo `attesa` del link (giri infiniti), `senza_cancello` (doppione di `skip`) | documentare o potare | ✅ **APPROVATA, e la forma l'ha precisata lui**: potare **solo i campi morti**. Gli **interruttori a zero** (attesa fra i giri, silenzio-assenso) restano: sono un'impostazione, e rimetterli non dev'essere un lavoro |
| E9 | **A6 qui sopra**: il promemoria a chi aspetta il maestro | messaggio irritante a chi ha appena fatto il test | ✅ **DECISA**: a chi aspetta il maestro il promemoria non arriva — l'avviso va alla **segreteria** (è la A6) |
| E10 | **`nome` ripiega su «Socio»** nell'URL del quiz per anagrafiche incomplete | scheda che nasce anonima | ✅ **APPROVATA**: fermarla e chiedere il nome, invece di lasciar nascere una scheda anonima |
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
- ✅ 🆕 **Laura nel filtro «Da certificare dal maestro»** del gestionale — 📏 misurato il 28/08 sulla
  PROD viva (v6.253) con la console remota: nel filtro c'è **esattamente una riga**, ed è la sua,
  con la spiegazione accanto — *«il test dice Avanzato (4), in scheda Intermedio (3.5) · nessuna
  partita nei prossimi 30 giorni»*. ⇒ **voce 100 chiusa.**

- ✅ 🆕 **«Tengo» a parola uguale — 📏 misurata il 28/08 sullo SCHERMO del committente.** Il caso
  è il suo: in scheda **4** («Avanzato»), test dichiarato 4,5 e calcolato **4,5** («Avanzato») ⇒
  stessa parola. Al tocco su «Tengo questo livello» delle **21:52** del 27/08 il bot ha risposto
  *«Perfetto: tengo **Avanzato** 👍 — È già il livello che hai in scheda: resta tutto com'è.»* ⇒ la
  frase del ramo D4, parola per parola, e **senza** «Te lo registro sulla scheda a breve», che è
  la promessa vuota che la cura esiste per togliere. 📏 Concorda col database: `applied_level` e
  `applied_at` di quella scheda sono **vuoti** — non c'era niente da scrivere e infatti non si è
  scritto niente. ⚖️ **E la cura era davvero in servizio in quel momento**, non dedotto: il bot dei
  soci si è riavviato alle **21:03:48** col deploy #114, **49 minuti prima** del tocco. *(D4)*

- ✅ 🆕 **P7 coi TRE bottoni, su una prova SUPERATA — 📏 misurata il 28/08 alle 10:11 sul suo
  telefono, su PROD.** Dichiarato **Base** (2,5) con le risposte di profilo coerenti, calcolato
  **2,5**, coerenza `high`, in scheda **Avanzato** (4). Il bot ha scritto *«🎯 Test di livello di
  gioco superato — Il tuo livello resta **Avanzato**. Le tue risposte stavolta sono da **Base**, e
  se è il livello in cui ti riconosci, posso registrartelo io. Comunque il test puoi rifarlo quando
  vuoi.»* con **tre bottoni**: `✅ Va bene: Base` · `👍 Mi tengo il mio livello` · `🔄 Sì, lo
  rifaccio`. ⇒ Il gradino era provato solo su una **bocciatura**: adesso lo è anche su una prova
  **passata**, ed è sparita la domanda «tieni o riprovi?», che lì era finta. 📏 Il database concorda:
  `applied_level` e `applied_at` vuoti, livello in anagrafica **4** invariato.
  ⚠️ **Cosa NON prova, e va detto**: dichiarata e dimostrata qui **coincidono** (Base e Base) ⇒ che
  il bottone porti la parola **dimostrata** e non la **dichiarata** questa prova non lo distingue.
  È il caso che il codice stesso segnala — *due parole che coincidono nel caso che hai davanti sono
  due parole, non una* — e lo prova solo il caso di Marco, che resta aperto. *(C4, P7)*

**⏳ RESTANO:**

1. **Due test di fila con lo stesso socio**: nessuna domanda ripetuta fra il primo e il
   secondo (la memoria, B9). Misurato al banco: 0% di ripetizioni fino a 3 prove.
2. **La parola dimostrata nella domanda**: rivedere il caso di Marco (dichiarato Base,
   calcolato Intermedio) e leggere ora «Il test dice **Intermedio**» *(D2)*.
2bis. **Il messaggio del maestro senza corsa**: rifare il caso di Laura (sotto il tetto) e
   leggere «Il test da solo arriva fino a **Intermedio**, e te lo sto scrivendo adesso»
   invece del livello di prima *(E11 curata)*.
3. **Bottone vecchio** «✅ Tengo Agonista» di ieri: deve rispondere il maestro *(D6)*.
4. 🆕 **Il gradino cronometrato**: un tocco vero, e `applied_at` deve arrivare in **~4 secondi**
   come su «mi fermo», non in 70 *(D10)*.
5. 🆕 **La consegna cronometrata**, dopo il passaggio della sorveglianza da 5″ a 2″: quanto ci
   mette l'esito ad arrivare *(D9)*.

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
