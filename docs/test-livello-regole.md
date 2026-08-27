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
| A3 | Il gettone si **riusa** finché non è consumato; stesso gettone ⇒ stesse domande, stesso ordine | `consumer-assessment-link` + `pescaPerGettone` | ✅ |
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
| B5 | **Principiante non ha quiz** (9/08: chi dichiara il minimo non guadagna mentendo); Semi-Pro e Professionista nemmeno — la loro scheda va in segreteria (`skip`) | `regole_fascia`, `fasciaDaLivello` | ✅ |
| B6 | Il segnale «Non esiste» è **rotto**: 12 trabocchetto **alla rovescia** (regole vere che sembrano inventate) — vedere «Non esiste» non dice più dove sta la verità | banca in `conoscenza.js`, guardia nel banco | 🔵 |
| B7 | La risposta giusta e il marchio `trap` **non escono mai** verso il telefono; si corregge sul server ripescando col gettone | `assessment-quiz` | ✅ |
| B8 | Banca: 27 normali + 12 trabocchetto per fascia; in un giro se ne vedono 5 ⇒ memorizzarla vuole molti giri | banca | ✅ |

## C. Cosa si scrive in scheda (il gestionale)

| # | regola | dove vive | stato |
|---|---|---|---|
| C1 | Il livello lo scrive **il gestionale**, mai il test da solo sopra il tetto: **3,5 (Intermedio) è il massimo automatico** — sopra certifica il **maestro** guardando giocare | `TETTO_AUTOMATICO`, `decidi` | ✅ |
| C2 | **Il livello non scende mai da solo** (27/08): un test più basso non scrive niente; a far scendere resta la segreteria | `decidi` | ✅ |
| C3 | Dal maestro si va solo per una **PAROLA nuova**: stessa fascia (4 → 4,5, tutti e due «Avanzato») = niente da certificare, bottoni «Tengo / Riprovo» | `sopraIlTetto` + gemella `assessmentAspettaIlMaestro` | ✅ provata (Maurizio, 12:26) |
| C4 | Chi dimostra **meno** di ciò che ha: niente domanda — «il tuo livello resta X» + bottone riprova | `ilTestDiceMeno`, P7 | 🔵 prova fisica |
| C5 | Coerenza: dichiarato e calcolato oltre **0,5** di distanza ⇒ scheda ferma (`review` per lo staff); risposte incoerenti ⇒ `consistency low`, non si applica | `decidi` | ✅ |
| C6 | Una scheda **vecchia** non scavalca un livello aggiornato dopo; una scheda **in mano allo staff** non si tocca; **una scheda sola per socio**, la più recente | `decidi` | ✅ |
| C7 | Chi sta **sotto** il tetto e dimostra sopra: si scrive **Intermedio** intanto, il resto lo dà il maestro (sua scelta 26-27/08) | `decidi` | ✅ |
| C8 | L'applicazione parte **al tocco** su «Tengo» e col cron dei 15′ come rete | `consumer-assessment-decision` + cron | ✅ |

## D. Cosa dice il bot (il gestionale SA, il bot DICE)

| # | regola | dove vive | stato |
|---|---|---|---|
| D1 | A ogni esito **un messaggio esce sempre** — il silenzio eterno della terza prova è curato (P0) | `siPuoAnnunciareIlTest` | ✅ provata (12:26) |
| D2 | `pass` normale: domanda **«tieni o riprovi?»** coi due bottoni; il livello si annuncia solo quando è **scritto** | `testoDomandaScelta` | ✅ |
| D3 | `pass` sopra il tetto con parola nuova: messaggio del **maestro** («in scheda hai X… ti certifica il maestro, passa dalla segreteria») — la parola detta è quella dell'**anagrafica**, mai la dichiarata | `testoEsitoTest` | ✅ provata (Laura) |
| D4 | «Tengo» quando la parola è già in scheda: **niente promessa di registrazione** — «è già il livello che hai in scheda» | `testoSceltaRegistrata` | 🔵 |
| D5 | `fail`: «è rimasta un'incongruenza» + bottoni «Rifaccio» / «Mi tengo il mio livello» (il tengo si **registra** anche su prova bocciata) | `testoEsitoTest` + decision | ✅ |
| D6 | I **bottoni vecchi** rimasti in chat non promettono mai il falso: reti su maestro, stessa-parola, dice-meno | `testoSceltaRegistrata` | 🔵 (B della lista) |
| D7 | Mai un numero al socio: **sempre la parola** | ovunque | ✅ |
| D8 | Mai un vicolo cieco: ogni messaggio ha un bottone o la via a parole | promemoria.ts | ✅ |
| D9 | L'esito arriva in **secondi** (sorveglianza ogni 5″, riarmata a ogni tocco; rete dei 15′) | bot promemoria.ts | ✅ misurata (4″ il 27/08) |

---

## E. ⚠️ DA VALIDARE UNO PER UNO — i punti aperti della rilettura del 27/08

Trovati misurando, **nessuno ancora deciso**. Ordinati per quanto costano se restano.

| # | il punto | perché conta | proposta |
|---|---|---|---|
| E1 | **Il ponte che REGISTRA la scelta non ha le protezioni del ponte che PARLA**: `consumer-assessment-decision` non sa di maestro/stessa-fascia/dice-meno — un bot vecchio o un bottone di settimane fa può ancora registrare scelte senza effetto | è la strada da cui il caso Laura può rinascere | portare i tre fatti anche lì, o accettarlo dichiarandolo (le reti del bot già coprono chi è aggiornato) |
| E2 | **`livello_applicato` è DEDOTTO dalle date** (`selfAssessmentDate` vs `submitted_at`, ±60″) mentre `applied_at` sta nella stessa tabella e non è nella select | stessa forma della select monca già pagata; una scheda applicata dopo rende «applicate» anche le precedenti | aggiungere `applied_at` alla select e leggerlo |
| E3 | **I giri si ricostruiscono su 20 schede** (le ultime): oltre 20 prove i confini dei giri slittano in silenzio | Maurizio è già a quota 10+ | alzare il limite o leggere in ordine crescente completo |
| E4 | **`fascia` (dichiarata) fa da «il test dice»** nei messaggi: con dichiarato ≠ calcolato entro 0,5 la parola può essere sbagliata di una fascia | messaggio impreciso al socio | mandare anche la fascia **calcolata** e usare quella |
| E5 | **Il NUMERO del livello esce verso il bot** (`livello`), contro la regola «mai il numero» | oggi il bot non lo mostra, ma il campo invita | toglierlo o rinominarlo a uso diagnostico |
| E6 | **`applicazione_lanciata` può dire il vero a vuoto** (il dispatcher è «spara e dimentica») — oggi il bot **non lo legge**: campo morto | un campo morto è la prossima promessa falsa | toglierlo, o renderlo vero prima di usarlo |
| E7 | **Codici di rifiuto fuori contratto**: `AMBIGUA`, `SCHEDA_NON_TROVATA` non hanno frase nel bot → uscirebbe il ripiego generico | raro ma possibile coi bottoni vecchi | aggiungere le due frasi |
| E8 | **Campi inerti**: `scelta_entro` (attesa zero), ramo `attesa` del link (giri infiniti), `senza_cancello` (doppione di `skip`) | documentare o potare | dichiararli reversibili dov'è già scritto, potare il resto |
| E9 | **A6 qui sopra**: il promemoria a chi aspetta il maestro | messaggio irritante a chi ha appena fatto il test | escludere chi ha una scheda `pass` recente sopra il tetto |
| E10 | **`nome` ripiega su «Socio»** nell'URL del quiz per anagrafiche incomplete | scheda che nasce anonima | rifiutare o chiedere il nome |

---

## F. Le prove fisiche che mancano (in ordine)

1. **Un test intero col cancello nuovo**: 13 domande, conoscenza sparse, 2+3, e — sbagliandone due — la bocciatura (B2, B3, B6).
2. **Bottone vecchio** «✅ Tengo Agonista» di ieri: deve rispondere il maestro (D6).
3. **P7 dal vivo**: dichiarare una fascia più bassa di quella in scheda e passare — «il tuo livello resta X» (C4).
4. **«Tengo» a parola uguale**: «è già il livello che hai in scheda» (D4).
5. La **voce 100**: Laura nel filtro «Da certificare dal maestro» del gestionale.
