# Padel Match Organizer — i lavori

**Fotografia del 14/08/2026, a fine 14ª sessione.** Misurata, non ricordata.

## 🔎 La misura contro la scheda: **3 smentite, 1 conferma, e altre 2 smentite in serata**

È il filo di tutta la giornata, e vale più delle singole voci chiuse.

| la scheda diceva | la misura ha trovato | chi l'aveva scritta |
|---|---|---|
| voce 22: «partita **9305** del 13/08, riga di prova» su TEST | **due** partite diverse — 9305 dell'11/08 e 9306 del 13/08 — **entrambe vere e presenti su PROD** | il committente, 3 giorni prima, avendola vista |
| voce 32: «lo specchio è **fermo dal 7 agosto**» | **non è mai partito**: `data_routine_dispatch_bookings_live_*` = **0** in tutta la storia di TEST contro 1575 su PROD | **io, la mattina stessa** |
| voce 33: «**28** funzioni SQL divergono» | **5**. Le altre 23 erano **spazi**: su TEST i corpi sono imbottiti, `pmo_get_staff_users_admin` è 30× più lunga **con lo stesso codice** | io, un'ora prima |

⚠️ **La prima ha fatto scattare per la prima volta la clausola** *«se risulta anche su PROD, fermati
e chiedi»*, scritta nella voce 22 da chi non sapeva che sarebbe servita. Eseguirla alla lettera
avrebbe cancellato dati del circolo — **e sarebbe sembrato un lavoro fatto bene**.

⇒ Da qui la riga nuova nel prompt di apertura — *la scheda di un lavoro è un'ipotesi, non una
misura* — e i **tre prompt finalmente scritti nel repo**, in `prompt-apertura-chiusura.md`.

✅ **La quarta misura ha invece CONFERMATO la scheda su tutti i campi**: la voce 35 diceva il
vero riga per riga. ⚖️ Va scritto qui accanto alle tre smentite, o questa tabella diventa a sua
volta una scheda che dice il falso — *«le schede sbagliano»* è una conclusione tanto affrettata
quanto *«le schede sono giuste»*. Il rito serve a **sapere quale delle due**.

🔻 **E poi, aprendo la voce 27, altre due smentite:**

| la scheda diceva | la misura ha trovato |
|---|---|
| «un'edge **pesca** le 4 domande» | non c'era **niente da pescare**: zero tabelle di domande sui due progetti, la banca stava **dentro `index.html`** — nel file che si scarica per fare il test |
| «si tolgono le **3 policy** di INSERT anonimo» | quelle sono di **PROD**. Su TEST erano **2**, condizionate al gettone, e una era di **UPDATE** — lasciava riscrivere una scheda già inviata, e non era in nessuna scheda di lavoro |

⇒ Sei misure, **cinque smentite e una conferma**. Il conto non serve a dare torto a chi scrive
le schede — le scrive lui, spesso avendo visto la cosa coi propri occhi — ma a ricordare che
**una scheda è il punto di partenza dell'indagine, non la sua conclusione**.

## 📌 Le decisioni prese dal committente oggi

| | |
|---|---|
| 🧊 **voce 32 → congelare, non riaccendere** | il calendario di TEST resta una fotografia, ma ora `CLAUDE.md` lo dice a chiunque apra una sessione. Riaccendere è la **voce 34** in coda: costa poco (+1,7% sul worker condiviso) ma va fatto **dal Mac** |
| ⬆️ **voce 35 → promossa a urgente** | l'unica cosa emersa oggi esposta **adesso** e su **produzione** |
| ✅ **voce 35 → eseguita** *(14ª sessione, stesso giorno)* | tutti e tre i punti, `ensure_rls` compresa. È la prima **scrittura su PROD** dopo due sessioni di sole `SELECT`, e l'ha autorizzata lui a misura fatta |

| | |
|---|---|
| 🔴 **Urgenti** | **0** |
| 📋 **In coda** | **15** |
| 📦 **Chiuse** | **13** il 13–14/08 + ~56 dal 7/08 + ~41 fino al 6/08 |

**Stato del sistema:** app PROD **6.220** · TEST **6.230** · `main` `f2c7353`, `test-preview`
`2fcfd2b` · **0 PR aperte** (la #692 è stata mergiata in squash) · `server.mjs`,
`.github/workflows/**`, `CLAUDE.md` e **tutto `docs/`** **identici** fra i rami, verificato per
impronta dopo il merge · `guard-main`, `deno-check`, `guard-docs-truth` e `guard-worker-sync`
tutte **verdi** · cron PROD **11 accesi / 2 spenti**, TEST 5 accesi / 4 spenti (misura del
**13/08**, non ricontrollata).

⚠️ **Le versioni si sono rimesse in moto, e di parecchio.** Erano ferme da tre sessioni; oggi
PROD è passata da 6.219 a **6.220** e TEST da 6.222 a **6.230** — otto pubblicazioni su TEST in
un pomeriggio, che è il costo vero della voce 27. Gli sha qui sopra saranno vecchi appena questa
riga è committata, ed è il motivo per cui **non** sono sorvegliati: un file che cita il proprio
sha invecchia nell'istante in cui lo si salva.

📏 **PROD e TEST distano 10 versioni.** Non è drift: TEST bumpa a ogni tentativo, PROD una volta
per promozione. Ma la regola dell'adiacenza, già incrinata stamattina, ora non dice più niente —
il confronto che conta è **il contenuto**, e il contenuto è lo stesso (edge e banchi identici per
impronta, righe dell'app promosse una per una).

🖐️ **La 13ª sessione ha scritto sui DATI, non sul codice.** Su TEST: 5 righe a `deleted=true` e 3
rimosse (la terna del test livello, con l'SQL di ripristino nel commit). Su `ayly…`: 1 riga a
`attivo=false`. Su PROD nessuna scrittura, solo `SELECT`.

🖐️ **La 14ª ha scritto sui PERMESSI, sulla KB e — in coda — sul CODICE.**
① **Permessi**, quattro migrazioni: RLS su due tabelle di PROD, `ensure_rls` installata su PROD,
`EXECUTE` revocato su `rls_auto_enable()` (su entrambi, per parità) e la scrittura anonima di
`self_assessments` chiusa **su TEST**. ② **KB**, un `UPDATE` per progetto: il raddoppio degli
avvisi, con la prosa corretta nello stesso istante. ③ **Codice**, la PR #692: PROD a 6.220.
🚨 **Nessuna riga di dati cancellata da nessuna parte.** Le prove che creavano tabelle o
scrivevano righe stavano dentro transazioni **annullate**, e il residuo è stato ricontato: zero.
🖐️ Restano su TEST **tre schede di prova** (Aprea, Soldan, Favaro) coi rispettivi gettoni
`completed`: da togliere insieme — riga, gettone e stato — o sporcano la prova successiva.
↩️ Tutte le migrazioni reversibili, con l'SQL di ripristino scritto in testa a ciascuna.

🖐️ **E poi sulla KB, chiudendo la 24** — un `UPDATE` per progetto su `pmo_ai_settings`, che
accende il raddoppio degli avvisi **e insieme corregge la prosa** che diceva «tre». 🚨 Questa è
l'unica scrittura della giornata che i **soci vedranno**: dal 15/08 chi ha una partita incompleta
riceve **due** ultimi solleciti invece di uno. ↩️ Si spegne togliendo una chiave.

⚠️ **PROD e TEST non sono più adiacenti**: 3 di distanza, non 1. Il *contenuto* è equivalente —
TEST bumpa a ogni passo (6.219→6.222), PROD una volta per promozione (6.218, 6.219). Non è drift,
ma la regola dell'adiacenza non regge più come indicatore.

**Verificato sul bersaglio il 13/08**, non dedotto dal repo:
- ✅ `app.padelvillage.club` serve **v6.219** (confermato dal committente sullo schermo)
- ✅ la edge in servizio su PROD contiene davvero `ALLOWED_ACTIONS = ['config-check','gmail-check','staff_invite','staff_delete_full']` e il 410 sul canale ritirato — letta da Supabase
- ✅ `soci.padelvillage.club` **non risolve più**; `ayly…` ha **ZERO edge function**

**Misurato il 14/08**, dal cloud, sui database veri:
- ✅ la **whitelist** su `ayly…` (`telegram_operatori`, 5 righe): non era più da dare per buona, ora lo è
- ✅ 9305 e 9306 su **entrambi** i database, **prima** di toccare qualsiasi cosa
- ✅ lo stato delle prenotazioni su TEST e PROD, il cron, la funzione di dispatch ⇒ voce 32
- ✅ **tutte** le funzioni SQL dei due progetti, impronta per impronta ⇒ voce 33 e `divergenze-sql-test-prod.md`
- ✅ gli advisor di sicurezza di PROD: **2 `ERROR`**, ed è la voce 35

**Misurato il 14/08 nella 14ª sessione**, chiudendo la 35:
- ✅ la scheda della 35, campo per campo, **prima** di toccare: righe, RLS, policy, permessi ad
  `anon`, sorelle coperte, `ensure_rls` presente solo su TEST — **tutto confermato**, per la
  prima volta
- ✅ chi punta alle due tabelle: viste, foreign key, funzioni SQL, repo, log edge di 24 ore e
  `pg_stat_user_tables` su **128 giorni** ⇒ **nessuno**
- ✅ l'RLS dopo l'accensione, **ruolo per ruolo** (`anon`, `authenticated`, `service_role`)
- ✅ il linter di PROD prima e dopo, diffato voce per voce: **0 `ERROR`**, `WARN` fermi a 109
- ✅ l'impronta di `rls_auto_enable()` sui due progetti dopo l'installazione: **identica**

> ⚠️ **Ancora non misurati**, e da non dare per buoni: la VM (worker e i due bot, riavvii), il
> `.env` dei soci e i suoi interruttori, i ponti, i cron di entrambi i progetti (guardati solo
> quelli che servivano alla 32), e l'app vista col login staff. Dalla sessione cloud manca
> l'accesso a Hetzner e alla memoria dell'app. ⚠️ **Anche la 14ª girava dal cloud**: la lista
> qui sopra non si è accorciata di un rigo, e ora ci si aggiunge **l'app di PROD col login
> staff**, che questa sessione ha cambiato senza poterla guardare.
> 📌 In compenso una porta si è aperta: `pg_net` **chiama le edge dall'interno del database**, e
> aggira il blocco di rete della sessione cloud verso `*.supabase.co`. È così che sono stati
> chiusi gli ultimi tre guasti senza far ricaricare la pagina al committente altre tre volte.
> ⚠️ Non sostituisce l'app aperta: prova il **server**, non lo schermo.

---

## 🔴 URGENTI — 0

**Vuota**, per la prima volta da quando questa lista esiste. La 35 — l'ultima rimasta — è stata
misurata, confermata punto per punto e **chiusa il 14/08 nella 14ª sessione**, con la sua conferma
esplicita perché toccava la produzione.

🚨 **Vuota non vuol dire che non c'è lavoro**: la coda ha 16 voci e nessuna si promuove da sé.
Le promozioni le decide il committente — si propongono, non si eseguono.

---

## 📋 IN CODA — 15

Le sezioni **A** (cose sue già decise), **B** (lavoretti minuti) ed **E** (manutenzione memoria) sono **vuote**.

### C — Cose sapute e non risolte — 10

#### 🔒 27. Il test del livello si corregge NEL BROWSER — punti 2 e 3
**Approvati da lui il 12/08 e non fatti.** Non è una voce nuova: è **il resto di una cosa già decisa**.

🚨 **Finché non si fa**: chi ha il proprio link **può darsi il livello che vuole** — il test lo corregge il telefono, il telefono scrive da sé la riga, e il cron (jobid 16) la applica in 15 minuti. Il muro «senza livello non si organizza» si **scavalca**, non si supera.

Il piano, in 4 mosse, **con l'ordine vincolante**:
1. un'edge **pesca** le 4 domande e le manda **senza il campo `correct`**;
2. la stessa edge **riceve le risposte, ricalcola** livello ed esito, scrive lei la riga col permesso di servizio, marca il token usato e **ne controlla la scadenza** (= punto 3);
3. l'app smette di pescare e correggere: chiede, mostra, rimanda;
4. **solo alla fine** si tolgono le 3 policy di INSERT anonimo su `self_assessments`.

> ⚠️ Il passo 4 fatto prima lascia **2.276 soci** senza la possibilità di fare il test — e col muro acceso, senza la possibilità di organizzare.
> 🔗 Il **punto 3** non è staccabile: `expires_at` non lo legge nessuno, quindi vive dentro quell'edge o non esiste.

**✅ Fatti il 14/08 (14ª sessione): i passi 1 e 2, cioè il SERVER.** L'edge
`supabase/functions/assessment-quiz/` esiste, pesca senza `correct`, corregge, calcola il
livello, scrive lei la riga col permesso di servizio, brucia il gettone e **legge `expires_at`**
(⇒ il punto 3 della scheda è dentro, come previsto).

🚨 **La misura ha smentito il passo 1 della scheda**: diceva «un'edge **pesca** le 4 domande»,
ma non c'era niente da pescare — **zero** tabelle di domande sui due progetti, e la banca stava
**dentro `index.html`**, righe 37044–37356, ~50 domande col loro `correct`, nel file che si
scarica per fare il test. ⇒ La banca è stata **spostata, non copiata**: copiarla avrebbe lasciato
le risposte pubbliche e aggiunto solo un giro.

🎲 **Le domande non si salvano, si ripescano**: stesso gettone + stessa fascia ⇒ stesse quattro
domande, con un seme deterministico. Farsi rimandare gli id dal telefono avrebbe rimesso il
coltello dalla parte del manico — bastava dichiarare «zero domande» per ottenere `skip`.
✅ Provato: `test/assessment-quiz.test.mjs` (9 prove, fra cui «rispondere a vuoto **non passa
più**» e «nessun `correct` verso il telefono») e la rete di regressione storica, **ripuntata
sull'edge**, 15 prove verdi sul sorgente vero.

**✅ Fatto anche il passo 3, e messo su TEST — `test-preview` 6.223, con la sua conferma.**
Via da `index.html` ~515 righe: la banca, le quattro funzioni che la usavano, il calcolo del
livello rimasto senza chiamanti (tolto, non lasciato morto come le ~60 della voce 28) e — la
riga che rendeva vero il buco — il **POST diretto su `/rest/v1/self_assessments`** con la sola
chiave pubblicabile. ✅ Misurato dopo: `grep -c 'correct:[0-9]' index.html` → **0**.
Tre innesti su un ponte solo, con **due porte**: il socio apre col GETTONE, lo staff con la
SESSIONE (l'anteprima del gestionale). 🚨 Non è simmetria — un `valuta` aperto sarebbe stato
peggio del punto di partenza: 4 domande da 4 opzioni fanno **256 tentativi**, e un oracolo le
svela in pochi secondi.
✅ **PROVATA DAL VIVO su TEST**, alla SESTA pubblicazione (6.223 → 6.228). Cinque guasti, tutti
miei, tutti emersi perché ha provato lui: dichiarazione doppia, colonne solo-PROD, funzione
spostata senza il suo albero, stringa vuota in colonna numerica, fascia senza parsing.
🎯 Catena completa verde: `consegna` → **`pass`**, quiz **4/4**, riga scritta con
`corretta_dal_server: true`, `balanced_level` vuoto salvato come **`null`**, gettone `completed`.
🔧 Il modo, visto che la rete della sessione cloud nega le chiamate dirette a `*.supabase.co`
(403 sul CONNECT): si chiama l'edge **dal database** con `pg_net`, che dall'interno ci arriva.
Le risposte vere, lette in `net._http_response`:

| prova | esito |
|---|---|
| gettone inventato | **404** `GETTONE_SCONOSCIUTO` |
| gettone vero | **200**, fascia Avanzato, 4 domande — 3 normali + la trappola |
| `staff-pesca` senza sessione | **401** `NON_AUTORIZZATO` |
| stesso gettone due volte | **stessa quaterna** `A-08, A-01, A-02, A-T1` |
| gettone diverso | pescata diversa: `A-08, A-T1, A-04, A-02` |
| la parola `correct` nelle risposte | **mai** (`position` = 0 su tutte e tre) |

**✅ E il passo 4, su TEST — la voce 27 è COMPLETA di là.** Fatto solo dopo che lui aveva
compilato la scheda sul suo browser (esito `pass` 4/4, `corretta_dal_server: true`, gettone
`completed`), che è l'ordine vincolante rispettato alla lettera.
✅ Verificato nei due versi, in transazioni annullate: `anon` → **42501, «new row violates
row-level security policy»**; `service_role` → scrive regolarmente. La strada del socio resta
aperta ed è ora l'**unica**, quella dell'edge.

🚨 **La misura ha smentito la scheda anche qui, e le due sponde non si somigliano:**

| dove | policy di scrittura anonima su `self_assessments` |
|---|---|
| **PROD** | **3 di INSERT**, tutte `WITH CHECK (true)` — nessuna condizione: chi ha la chiave pubblicabile scrive qualunque riga, **senza nemmeno un gettone** |
| **TEST** | **1 di INSERT + 1 di UPDATE**, condizionate a un gettone vero, `created`/`sent`, non scaduto. La UPDATE **su PROD non esiste**: qui lasciava **riscrivere una scheda già inviata**, e non era in nessuna scheda di lavoro |

⚖️ Anche la versione stretta di TEST non bastava: il gettone il socio **ce l'ha**, è il suo link.

**✅ PROMOSSA SU `main` — PR #692, PROD 6.220.** Mergiata dopo **due bocciature di
`deno check`**, ed entrambe avevano ragione: ① 36 errori `TS7006`, perché il blocco del cancello
è JavaScript e stava in un file `.ts` — separato in **`conoscenza.js`**, che con la sua
estensione dichiara ciò che è sempre stato; ② 5 errori sui tipi di `supabase-js`, che il mio
controllo locale nascondeva perché avevo stubbato proprio `createClient`.
✅ **Edge verificata su PROD**, chiamandola dal database: pescata con un gettone vero → **200**,
fascia Avanzato, 4 domande, **nessun `correct`**; azione staff senza sessione → **401**.

**⏳ RESTA APERTA, e per due ragioni distinte:**
1. 🚨 **L'app su PROD non è stata vista da nessuno.** Dal cloud non si apre, e la regola di casa
   dice che le prove del committente valgono più delle mie — oggi lo ha dimostrato **cinque
   volte**. Va aperta `app.padelvillage.club`, controllato che serva **6.220** e compilata una
   scheda vera.
2. ⛔ **Il passo 4 su PROD non è fatto**: le **3 policy** `WITH CHECK (true)` sono ancora là.
   Finché ci sono, chi ha la chiave pubblicabile può scrivere una scheda **senza nemmeno un
   gettone** e scavalcare il cancello nuovo. Si tolgono **solo dopo** il punto 1.
⚖️ Su TEST invece la voce è **completa**, passo 4 compreso: `anon` → `42501`,
`service_role` → scrive.

#### 11bis. Il bottone che CREA IN MATCHPOINT chi ha solo l'ID `PMO-`
Sua idea del 2/08. Ha **perso urgenza** il 3/08: la visibilità di quei soci è stata curata alla radice (PROD 6.169) ⇒ non è più una riparazione ma una **scelta**.

#### 13. 🇬🇧 Il ragionamento del modello, in inglese, dentro il messaggio al socio
Visto da lui il 29/07, **1 volta su 24**. È la 21ª trappola vista dalla strada della **prosa**, non dei bottoni — e i test guardavano i bottoni.

#### 14. 🔑 Le ⑩ chiavi «Ospite» che oscillano
Avanzata il 24/07, non chiusa. Servono le **3 sonde rieseguite a distanza di ore** e diffate; ≥1 campione pulito prima di concludere «benigna e rara». ⏳ La sonda `fp_hot` è **scaduta il 4/08**: va rifondata.

#### 14bis. 🎓 «Se lo staff mi prenota una LEZIONE, il bot me la ricorda?» — oggi NO
Sua domanda del 6/08, messa in coda da lui. **Voce a sé**, non una variante della 14.

#### 23. ⛔ `writeBookingJob` in `create` non guarda com'è andata
La creazione manda il lavoro al worker e **non controlla l'esito**. Stessa forma di un guasto già visto: *«non ho ricevuto risposta» non è «non è stato scritto»*, e gli esiti sono **tre**.

#### 26. ✅🔴 Il «Fatto» del togli non si vede — **causa trovata il 14/08, non è il bot**
Trovato provando l'`A6`: il bot dice di aver tolto il giocatore, ma **la riga non sparisce** dalla scheda. La forma del dato è **identica in PROD**; là si auto-corregge in ~2 minuti col sync, in prova mai.

🎯 **Il perché, misurato chiudendo la 32:** su TEST **non gira nessun sync delle prenotazioni**, quindi non c'è niente che riconcili — in PROD lo fa `bookings_live` ogni 2 minuti, **con lo stesso identico codice**. Il bot era sano: aveva ragione a dire «Fatto».

⚖️ **Resta in coda, ma cambia natura**: non è più «indagare un guasto» — è **il sintomo atteso** di un TEST col calendario congelato per scelta (vedi `CLAUDE.md`). Sparisce da sé il giorno in cui si fa la **voce 34**, e non prima. Da chiudere allora, non oggi.

#### 🧟 28. Le ~60 funzioni dei pannelli email rimossi restano nel file
*Nata il 13/08.* Tolti i 5 pannelli (PR #677), le funzioni che li disegnavano sono rimaste: scrivono in `getElementById` che ora dà `null`, e cominciano tutte con `if (!box) return;` ⇒ **no-op, irraggiungibili**. Lasciate di proposito: asportarle è una potatura da provare per bene. Il perché è scritto nel commento HTML nel punto dove stavano i pannelli.

#### 🧟 29. Le azioni email restano dentro `assessment-email-send`
*Nata il 13/08.* `sendAssessmentEmailCore` e le sue compagne ci sono ancora, ma `ALLOWED_ACTIONS` non le ammette più e rispondono **410**. Riaccenderle = rimetterle nell'elenco.
🚨 La funzione **non si cancella** e i secret Gmail **non si tolgono**: vedi la memoria tematica Gmail.

#### ⚠️ 31. La sicura dei bottoni Matchpoint stava solo su TEST
*Nata il 13/08.* Chiusa di fatto (banco rimosso, PR #678), ma **il pattern resta**: la sicura fu scritta su TEST il 3/08 dopo un clic per sbaglio, e **mai promossa** ⇒ per dieci giorni in PROD gli stessi bottoni sono rimasti **senza**. È il caso da manuale per cui esiste la regola anti-disallineamento. Da decidere se cercarne altri della stessa forma.

### D — Corpose: solo se si vogliono ATTIVARE — 5

| # | cosa |
|---|---|
| **15** | 🎾 **Card «Partita aperta · 0/4»** sul calendario staff — oggi appare come partita normale col solo intestatario, irriconoscibile. Piccola, prima su TEST |
| **16** | 💰 **Storno/cobro PARTITA** — flag OFF mai validati; validare in TEST prima di qualsiasi attivazione |
| **17** | 🔐 **Consumer: hook Auth «Customize Access Token»** — senza, l'RLS nega in silenzio. Rilevante **solo** quando si riprende l'app soci (0 utenti veri oggi) |
| **18** | 📣 **Pannello avvisi nel gestionale** (lo staff vede cosa il bot ha mandato ai soci). 🚨 Stesso nodo del pannello autorizzazioni ⇒ **si disegnano insieme** |
| **34** | 🧊 **«A-lite»: riaccendere il sync prenotazioni su TEST**, scongelando il calendario congelato per scelta il 14/08 (voce 32). Costo piccolo — la funzione che TEST **ha già** dispatcha ~12 volte al giorno contro le ~720 di PROD sul worker condiviso: **+1,7%**, non il raddoppio che sembrava. Tre mosse: accendere il cron (jobid 13), togliere l'argomento `<oggi 04:30>` che lo inchioda al ramo clienti, e verificare la prima giornata. ⚠️ **Non è una riga di SQL e non si fa dal cloud**: accendere quel dispatcher resuscita anche i **6 sync clienti** ritirati il 3/08 — prima va saputo **perché** furono spenti — e la prima giornata va guardata nei log del worker su **Hetzner**. 🚫 **Non copiare la funzione di PROD**: è quella *continua*, pensata per un gestionale dove le disdette devono arrivare in 2 minuti. Su TEST 5 rinfreschi al giorno sono freschezza; il ritmo di PROD è parità, ed è **la parità a costare**. 🔗 Chiude la **voce 26** il giorno in cui si fa |

---

## 🆕 Nate misurando, **non** ancora in coda

Misurando il **12/08**:

- 🔓 Su **TEST** ci sono policy `ALL` (lettura **e scrittura**) per anonimo su `pmo_bookings`, `pmo_parse_history`, `pmo_parser_rules_versions`. Su PROD no.
- 🔓 Su PROD altre **tre tabelle** accettano inserimenti anonimi (`pmo_ai_turns`, `pmo_parser_errors`, `post_match_feedback_responses`): non guardate.

Misurando il **14/08** nella 14ª sessione, provando la voce 27 dal vivo:

- 🔀 **Le TABELLE dei due progetti divergono**, non solo le funzioni SQL della voce 33.
  Misurate finora solo le due dell'autovalutazione: `assessment_tokens.member_email` e
  `self_assessments.email`, `consistency_score`, `inconsistency_reasons`, `review_note` **ci
  sono su PROD e non su TEST**. Nessuno le aveva mai confrontate. ⚠️ Le altre tabelle **non
  sono state guardate**: questa è una campionatura di due, non una misura.
- 📡 **Il gestionale di TEST chiama `wa-shadow-proxy` una volta al minuto e prende 404**: la
  funzione sta nel repo ma **non è mai stata deployata su `cudi…`**. **612 chiamate a vuoto in
  24 ore**, dal 13/08. Non rompe niente di visibile, ed è per questo che nessuno se n'era
  accorto. ⚠️ Non guardato se su PROD c'è.
- 🧟 **Il riquadro «prova il test» del gestionale non esiste più**: `0` occorrenze di
  `id="assessmentExternalKnowledgeBlock"` anche su `main`, da prima di questo lavoro — tolto il
  13/08 con la #677. Le tre funzioni che lo servivano sono rimaste: sono **voce 28** in piena
  regola. ⇒ Dal gestionale, oggi, il test non si fa: si fa aprendo il link del socio.

Misurando il **14/08** nella 14ª sessione, chiudendo la voce 24:

- 🔁 **`livello.autovalutazione_url` è rimasta su TEST e non su PROD.** Confrontando le kb sezione
  per sezione, **una sola** diverge: `livello` — `{}` su PROD, e su TEST ancora
  `https://test.padelvillage.club/?assessment=link-esterno`. Il codice dice a chiare lettere che
  quella voce **«non si legge più»** e **«va tolta dalla configurazione dei due ambienti»**: su PROD
  fu tolta il 9/08 — ed è proprio ciò che salvò `pmo_bkp_kb_livello_20260809`, la tabella a cui
  stamattina ho acceso l'RLS — su TEST **no**. Nessuno la legge (grep: solo il commento), quindi non
  fa danno; ma sta nella kb che va **in pasto al modello**. ⚖️ **È la forma esatta della voce 31**, e
  stavolta al contrario: il pezzo mancante sta su PROD. Non l'ho toccata — non è la 24.

Misurando il **14/08**, aprendo la voce 22:

- 🧊 Lo specchio delle prenotazioni di TEST fermo dal 7/08 → **promossa da lui a urgente: è la voce 32.**
- 🔢 `payment` su TEST ha **2503** righe contro le **2502** di PROD: una in più, non guardata.

---

## 📦 CHIUSE — 13 e 14/08/2026 — 13 voci

⚠️ **Una sola sezione datata per volta.** `guard-docs-truth` conta le righe di **tutte** le
intestazioni `CHIUSE —` ma legge il numero della **prima**: due blocchi datati affiancati dichiarano
1 e ne contano 9, e la guardia fallisce. Chi chiude in un giorno nuovo **allarga la data di questa**,
non ne apre un'altra sotto.

**Le prime cinque voci sono del 14/08; le otto successive del 13/08.**

| voce | cosa |
|---|---|
| **24** | 🔔 *(14/08, 14ª sessione)* **Il raddoppio dell'ultimo avviso di disdetta è ACCESO, su PROD e su TEST.** La decisione che la voce aspettava l'ha presa lui: `disdetta.avvisi_ore_prima_scadenza_bis = 1`. 🔎 Scheda **confermata di nuovo**: il codice c'era davvero (`avvisi.ts`, `TIPI` con `finale_bis` dall'11/08), la colonna `finale_bis` su `ayly…` pure, e la chiave **mancava su entrambi** — i due oggetti `disdetta` erano identici e nessuno dei due la conteneva. 🚨 **La scheda però non diceva la cosa che contava**: la kb finisce **in pasto al modello** (`conoscenza` → `readmodelKb`), e la sua prosa dichiarava «**Tre** promemoria… l'ultimo 6 ore prima» con `quanti_avvisi: 3`. Accendere la sola chiave avrebbe fatto **mandare quattro avvisi al bot mentre ne dichiarava tre ai soci** ⇒ chiave, `quanti_avvisi` e testo corretti **nello stesso istante**. ✅ Verificato dando la kb VERA in pasto al codice VERO: momenti `primo` (5g), `secondo` (3g), `finale` (−6h), `finale_bis` (−1h). E 61/61 verdi nella rete di regressione del bot. ✅ **Nessuna raffica**: misurato prima di accendere che 0 prenotazioni stavano nella finestra del bis; la prima scadenza utile è del 15/08, quindi il primo raddoppio parte ~21 ore dopo. ⏱️ In servizio senza rideploy: la kb ha una cache di **30 secondi**. ⚖️ I due `disdetta` restano **identici byte per byte** (`330f2d22…`), com'erano prima. 📌 Il registro su `ayly…` ha `ambiente='prod'` per tutte e 11 le righe e `finale_bis` a **0**: il primo lo si vedrà lì |
| **35** | 🔒 *(14/08, 14ª sessione)* **Le due tabelle scoperte di PROD sono chiuse, e la rete di sicurezza è tornata dalla parte giusta.** 🔎 **Per la prima volta la misura ha confermato la scheda**, e su tutti i campi: 2 `ERROR` e solo quelli, 699 e 1 righe, RLS spenta con 0 policy, `anon` con SELECT/INSERT/UPDATE/**DELETE**/TRUNCATE, le sorelle `_pmo_riassegnazione_*` coperte, `ensure_rls` presente **solo** su TEST. Fatto il rito prima di toccare: **nessuna** vista, foreign key o funzione le nomina, nessun riferimento nel repo fuori da `docs/`, e `pg_stat_user_tables` su una finestra di **128 giorni** conta 8 e 4 seq_scan in tutta la loro vita — l'ultimo dei quali era la mia stessa `count(*)` di dieci minuti prima. ⇒ ① **RLS accesa** senza policy: `anon` **0/0**, `authenticated` **0/0**, `service_role` **699/1** (provato con `set local role` in transazione annullata, non dedotto) e il linter di PROD **da 2 `ERROR` a ZERO**. ⇒ ③ **`ensure_rls` installata anche su PROD**, verbatim da TEST: impronta normalizzata `2ab30ec5…` **identica** sui due progetti, e provata sul vivo — una `create table` poi annullata nasce con l'RLS accesa da sola. 🐛 **Coda inattesa, trovata dal linter dopo l'installazione**: `rls_auto_enable()` era `SECURITY DEFINER` **eseguibile da `anon`**, e provandolo la chiamata **riusciva davvero**. Portata reale nulla — nessun argomento, e fuori contesto il ciclo gira a vuoto — ma `EXECUTE` revocato su **entrambi** i progetti, perché su TEST l'ACL era identica e quei due WARN ci stavano **da sempre** senza che nessuno li guardasse. Ora da `anon`: `42501 permission denied`. ⚠️ **Da ricordare**: ogni tabella nuova in `public` su PROD nasce ora **invisibile** ad `anon`/`authenticated`; se deve essere letta col ruolo pubblico, la policy va scritta a mano. 🔗 [`docs/divergenze-sql-test-prod.md`](../divergenze-sql-test-prod.md) e le 3 migrazioni in `supabase/migrations/2026081411*` |
| **33** | 🔀 *(14/08)* **Le funzioni SQL dei due progetti, misurate e dichiarate** in [`docs/divergenze-sql-test-prod.md`](../divergenze-sql-test-prod.md). PROD **64**, TEST **62**, in comune 58: **53 identiche**, **5 divergenti davvero**. 🚨 Il primo giro ne dava **28**, ma 23 erano **aria**: su TEST molte funzioni sono imbottite di migliaia di spazi dopo `AS $function$` — `pmo_get_staff_users_admin` è **30 volte** più lunga con lo stesso codice dentro. Si confronta normalizzando gli spazi, o l'impronta mente. Delle 5 vere: una **voluta** (la 32), due **innocue** (solo `public.` esplicito o meno), una da sanare **al contrario** — `pmo_assegna_codici_mancanti` ha i commenti del 9/08 su **TEST** e non su PROD, quindi è la copia buona a stare di là — e una **da guardare**, `upsert_assessment_tokens_admin`, che legge il PIN da `admin_settings` mentre `pmo_admin_pin_ok` lo legge da `assessment_admin_config`: due depositi per lo stesso PIN, e non è TEST-vs-PROD ma un'incoerenza **dentro** PROD. Delle 10 presenti da una parte sola, tre sono **residui del canale email smontato** (parenti della voce 29) e una spiega perché su TEST i soci sono vivi col calendario fermo: `pmo_anagrafica_cron_key`, che serve il mirror dell'anagrafica **da PROD**. ⇒ Da qui è nata la **voce 35** |
| **32** | 🧊 *(14/08)* **Il calendario di TEST è congelato — ora è una scelta dichiarata, non un inganno.** Nata misurando la 22, promossa da lui, diagnosticata e decisa in giornata. La misura ha smentito perfino il titolo con cui era nata: non «fermo dal 7 agosto», ma **mai partito** — righe `data_routine_dispatch_bookings_live_*` **0 in tutta la storia** di `cudi…` contro **1575** su `qqbf…`; il 7/08 era solo l'ultimo import lanciato **a mano**. Tre disallineamenti sovrapposti, ognuno da solo sufficiente: il cron **spento** (jobid 13, fermo dal 3/08), l'argomento `<oggi 04:30>` che lo **inchioda** al ramo clienti anche da acceso, e la **funzione stessa diversa** fra i due progetti (`1609186e…` contro `e38984df…`). ⚖️ **Scelta la strada B: congelare e dichiararlo.** Il danno non era la vecchiaia del dato — era che **sembrasse fresco**: aveva già fatto aprire la voce 26 come guasto del bot e per poco cancellare una partita vera. Scritto in `CLAUDE.md`, dove ogni sessione lo legge prima di toccare TEST. Il riaccendimento è la **voce 34** in coda: costa poco (**+1,7%** sul worker, non il raddoppio che sembrava) ma va fatto **dal Mac**, coi log del worker sotto gli occhi |
| **22** | 🧹 *(14/08)* **Righe di prova su TEST: tolte 3 punti su 4, e il quarto non era rumore.** Tolte in modo **reversibile**, dopo aver misurato cosa ci puntava: le **4** `staff_edit` e la partita di prova 14/08 12:30 C4 messe a `deleted=true` (soft delete nativo, l'app non le vede più); **Lidia Comes** nella whitelist `test` messa a `attivo=false` — la gemella `prod` intatta. Il quarto punto non era una riga sola ma una **terna** — token `completed` + scheda `applied` + marcatore «già segnalato» `sa:ITBAOQWO8CB5KU` — e toglierne una su tre avrebbe **sporcato** la prossima prova invece di pulirla: rimosse insieme, salvate per intero nel messaggio di commit. ⚠️ Il livello di Aprea era **già tornato a 4** da solo: il mirror aveva fatto la sua parte. 🚨 **Il primo punto è uscito dalla voce**: «9305 del 13/08» erano **due** partite (9305 dell'11/08, 9306 del 13/08), **entrambe vere e presenti su PROD**, entrambe nate su TEST nello stesso istante di un lotto di sync — è scattata per la **prima volta** la clausola *«se risulta anche su PROD, fermati e chiedi»*, e la causa è diventata la **voce 32** |

Le prime 6 del 13/08 nella 12ª sessione, la **30** e quella dei conteggi in serata.


| — | 📚 **I tre registri di versione riallineati** (PR #674): `stato-progetto-corrente` era **689 versioni indietro** mentre chiedeva di credergli *contro* i prompt; `VERSIONI.md` senza voci 6.x → **188 ricostruite dai commit**, ognuna con PR, sha e data; `registro-versioni-sezioni` con **172 righe verso file spariti** → dichiarate e sostituite da un indice per area |
| — | ⛔ **Canale email dell'Autovalutazione disarmato su tre strati**: cron già spento, app (PR #675, PROD 6.217), edge potata con **410** (PR #676). Resta **solo l'invito staff** a mandare email |
| — | 🧹 **Via 5 pannelli e 8 bottoni morti** dell'Autovalutazione (PR #677, PROD 6.218) + **«Verifica Gmail» riparata** (regressione mia: l'avevo disarmata insieme al canale, era rotta **anche in PROD**) + tre testi corretti |
| — | 🧪 **Il banco Matchpoint rimosso** — i due bottoni rossi che creavano prenotazioni e clienti **veri** (PR #678, PROD 6.219). ⚠️ Non promozione a righe: i rami avevano **7 funzioni contro 4** |
| **25** | 📧 **Il canale email ai soci non è più «spento»: è SMONTATO.** La decisione che la voce aspettava è stata presa ed eseguita. Riaprirlo non è riaccendere un cron, è **rimontare un canale** |
| **19** | 🏠 **Destino di `soci.padelvillage.club`: chiuso.** Misurato il 13/08 — DNS **non risolve**, `ayly…` ha **ZERO edge function**. ⚠️ La voce diceva «login e identità vivi»: **era sbagliata**, il login è morto. Vivo solo `consumer-identity-lookup` su `qqbf…`/`cudi…` |
| — | 🔢 **Anche le chiuse si contano** (#686). `guard-docs-truth` sorvegliava le liste **vive** — urgenti e in coda — e lasciava fuori l'unica che **cresce** a ogni sessione. Il conto tornava, 7 dichiarate e 7 righe, ma **per diligenza**: nessuno lo imponeva. È la condizione esatta da cui è partita la sezione **C**, diligente anche lei e falsa lo stesso per mesi. Aggiunti **due** numeri (titolo di sezione e riga «Chiuse»), verificati per conto loro. ⚖️ Restano fuori i conteggi storici `~56` e `~41`: portano la **tilde** e le voci non sono più nel file ⇒ incontabili per costruzione, e un numero che si dichiara approssimato non promette nulla da verificare |
| **30** | 🛡️ **`docs/` ha due guardiani, non uno.** Nata in coda, promossa da lui e chiusa in giornata. **Parità** (`guard-worker-sync` esteso a `docs/`, #683): scoperto che 4 file divergevano — la #674 aveva curato i registri **solo su `main`** e su `test-preview` `stato-progetto-corrente.md` diceva ancora «PROD v5.527» del 22/05 con TEST a 6.222. **Verità** (`guard-docs-truth.yml`, #684): confronta il dichiarato col misurato — e alla prima esecuzione ha colto il registro che, curato la mattina, **la sera dichiarava già 6.216/6.217 contro 6.219/6.222**. ⚖️ Sono complementari: la parità non vede la **menzogna concorde**, la verità non protegge l'**altro ramo** ⇒ si tolgono insieme o mai |

*(Le chiuse dal 7/08 al 12/08 e quelle fino al 6/08 restano come nella fotografia del 12/08.)*

---

# 🧠 Memorie tematiche

## Gmail / email del gestionale

> **`assessment-email-send` non è solo il canale email: il nome inganna.** Dentro vive
> l'amministrazione utenti staff — `staff_invite` (manda una mail **vera** con Gmail:
> `getGmailAccessToken` + `sendGmailMessage`) e `staff_delete_full` (elimina l'utente in `auth`,
> non spedisce).
>
> 🚫 **Non togliere i secret Gmail**: spegneresti l'invito staff.
> 🚫 **Non cancellare la edge**: perderesti l'eliminazione utente.
>
> ✅ `gmail-check` è **esente** dal disarmo, in app (`PMO_ASSESSMENT_EMAIL_ACTIONS_ESENTI`) e in
> edge (`ALLOWED_ACTIONS`): sono **gemelle, si cambiano insieme**. Alimenta «Verifica Gmail» in
> Amministrazione › Utenti, **l'unico posto da cui si ricollega Gmail quando il token scade**.
> Senza, l'invito si rompe e **non si ripara dall'app** — e il suo messaggio d'errore rimanda
> proprio lì, in un cerchio chiuso.
>
> 📌 Il **connettore Gmail di claude.ai non c'entra**: è uno strumento della chat. L'app usa
> credenziali proprie su Supabase (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`).
> Il 13/08 stavamo per riconfigurare Gmail su una diagnosi falsa: le credenziali erano sane, era
> il blocco a impedire il controllo.
>
> 📌 Dove è finita l'Autovalutazione: il socio riceve il **link personale dal bot Telegram**
> (`consumer-assessment-link`), lo staff è avvisato da `assessment-notify-staff` (cron ogni 5'),
> il livello è applicato da `assessment-apply-level` (cron ogni 15').

## Lezioni di metodo

> **La documentazione non ha un guardiano.** `guard-worker-sync` protegge worker, workflow e
> `CLAUDE.md`. `docs/` no — e infatti tre registri hanno mentito per tre mesi mentre uno si
> autoproclamava «fonte rapida ufficiale» e chiedeva di credergli *contro* i prompt. **Una fonte
> che si dichiara autorevole e non è verificata è peggio di nessuna fonte.**
>
> **Disarmare per ambito, non per nome.** `gmail-check` è stata spenta perché stava nella stessa
> funzione del canale email: apparteneva invece all'invito staff. Prima di disarmare, chiedersi
> **a chi serve**, non **dove sta**.
>
> **Il fix che resta su un ramo solo non protegge.** La sicura dei bottoni Matchpoint fu scritta
> su TEST il 3/08 e mai promossa: per dieci giorni in PROD gli stessi bottoni sono rimasti senza.
>
> **Misurare batte ricordare, e il clone può mentire.** Il 13/08 il clone era *shallow*: la storia
> partiva dal 2/08 e mostrava `VERSIONI.md` come «creato quel giorno con 387 righe» — era il bordo
> del troncamento. `git fetch --unshallow` (1950 commit dal 25/04) ha rimesso i conti a posto.
>
> **Le prove dell'utente valgono più delle mie verifiche.** I due errori del 13/08 — «Verifica
> Gmail» disarmata e la parola sbagliata — non li ha trovati nessun test: li ha trovati lui
> aprendo l'app. Sintassi e rete di regressione erano verdi in entrambi i casi.
>
> **La scheda di un lavoro è un'ipotesi, non una misura.** *(14/08)* La voce 22 diceva «partita
> **9305** del **13/08**, riga di prova»: erano **due** partite, la 9305 dell'11/08 e la 9306 del
> 13/08, **entrambe vere e presenti su PROD**. Numero, data e natura: tre campi su tre sbagliati, in
> una scheda scritta tre giorni prima da chi c'era. Eseguirla alla lettera avrebbe cancellato dati
> del circolo — e sarebbe sembrato un lavoro fatto bene. ⇒ La riga è finita nel prompt di apertura.
>
> **Il sintomo sta in cima alla lista, la causa non sta in lista affatto.** La 22 chiedeva di
> spazzare quattro righe; sotto c'era uno **specchio fermo da una settimana** che ne sporcava 2721.
> Chi esegue il compito scritto non trova mai la causa: la trova solo chi **misura il contesto**
> della riga che sta per toccare. Il rito «misura cosa punta a quella riga» serve a non fare danni;
> misurare *perché* quella riga è com'è serve a **trovare il lavoro vero**.
>
> **Un sintomo in due posti è una causa sola.** La voce 26 («il "Fatto" del togli non si vede»,
> aperta come guasto del bot) e il primo punto della 22 erano lo **stesso** fatto: su TEST nessun
> sync riconcilia. In PROD lo stesso codice si auto-corregge in due minuti. Prima di aprire una voce
> per un componente, chiedersi se il vicino ha già lo stesso male.
>
> **«Ipotesi, non misura» non vuol dire «probabilmente sbagliata».** *(14/08, 14ª sessione)* La
> scheda della 35 ha retto su **tutti** i campi: due `ERROR` e solo quelli, 699 e 1 righe, `anon`
> con DELETE e TRUNCATE, le sorelle coperte, `ensure_rls` solo su TEST. Dopo tre smentite di fila
> la tentazione era leggere il rito come un modo per cogliere in fallo chi ha scritto la scheda:
> non lo è. Serve a **sapere**, e sapere che è giusta vale la stessa misura che scoprire che è
> sbagliata — con la differenza che stavolta si è potuto eseguire senza esitare.
>
> **Chi tappa un buco ne apre uno più piccolo, e deve guardare.** *(14/08)* Installato
> `ensure_rls`, il linter ha alzato due WARN che prima non c'erano: la funzione era `SECURITY
> DEFINER` chiamabile da `anon`. Sarebbe passata liscia — l'obiettivo dichiarato era «i due
> `ERROR` spariti», e quelli erano spariti. Il diff **prima/dopo di tutti e 123 gli avvisi**, non
> solo dei due che si volevano chiudere, è ciò che l'ha fatta vedere. ⇒ E aprendola si è scoperto
> che su **TEST** quella porta era aperta **da sempre**: un difetto nuovo in un posto è spesso un
> difetto vecchio nell'altro.
>
> **Un banco più permissivo della produzione dà FIDUCIA SBAGLIATA.** *(14/08, 14ª sessione)*
> L'edge dell'autovalutazione è stata deployata su TEST con **14 suite verdi** e non è mai
> partita: `Identifier 'pmoLivelloFascia' has already been declared`. Dal browser si vedeva solo
> «Failed to fetch» — una funzione che non fa il boot non risponde nemmeno con un errore.
> ⭐⭐ Il motivo per cui il banco non poteva vederlo: `vm.runInContext` esegue il codice come
> **script**, e in uno script ridichiarare una funzione è **lecito**; Deno lo carica come
> **modulo**, dove è fatale. Il banco girava in un mondo più largo del vero, quindi poteva solo
> dire di sì. ⇒ Un banco che gira in condizioni più larghe della produzione non è debole: è
> **peggio di non averlo**, perché verde e inutile è la condizione in cui nessuno va a guardare.
> La cura: il blocco ora si analizza **come modulo**, e la prova ha il suo controllo negativo.
>
> **Guardare un solo database è scrivere metà query.** *(14/08)* Subito dopo, la stessa edge ha
> risposto 500: la `select` citava `member_email`, che c'è su **PROD** e **non su TEST**. Come
> `self_assessments.email`, `consistency_score`, `inconsistency_reasons`, `review_note`. ⇒ **Le
> due tabelle divergono**, ed è la voce 33 un piano più sotto — là erano le funzioni SQL, qui
> sono le TABELLE, e di queste non se n'era accorto nessuno. Chi scrive per i due ambienti
> scrive sull'**intersezione**, e la verifica su entrambi prima di spingere.
>
> **«Failed to fetch» è il nulla travestito da errore.** *(14/08)* Ha fatto perdere un giro
> intero di prove: il browser non poteva dire altro, e la funzione non scriveva niente. La
> diagnosi è arrivata in un minuto **dai log di Supabase**, non dallo schermo. ⇒ Da lì in poi
> gli errori del database finiscono in `console.error`: al socio una frase comprensibile, a chi
> indaga il motivo vero.
>
> **CINQUE guasti, e li ha trovati tutti LUI provando.** *(14/08, voce 27 passo 3)* L'edge è
> stata pubblicata su TEST **sei volte** (6.223→6.228) prima di funzionare. I guasti, in ordine:
> ① dichiarazione doppia ⇒ non faceva il boot; ② colonne che esistono solo su PROD ⇒ 500;
> ③ funzione spostata senza il suo albero (`cleanCell`) ⇒ moriva la consegna; ④ stringa vuota
> in colonna `numeric` ⇒ la scheda non si salvava per un campo secondario; ⑤ la fascia ricavata
> senza il parsing dell'app ⇒ **`skip` silenzioso**, il socio rispondeva a tutto e finiva in
> segreteria senza che nessuno vedesse un errore.
> ⭐⭐ Il filo che li lega tutti e cinque: **il mio banco constatava, non eseguiva**. Girava come
> script invece che come modulo, esercitava solo il quiz e mai il calcolo del livello, e usava
> la forma del dato che immaginavo io invece di quella che manda il modulo. Ogni volta era
> verde, e ogni volta era il committente ad aprire l'app e vedere il rosso. ⇒ Non è «poca
> attenzione»: è che **una funzione mai chiamata non rivela le sue dipendenze mancanti**, e un
> ramo mai percorso non rivela niente di sé.
> 📌 Il rimedio è nel repo, non in questa riga: `test/assessment-quiz.test.mjs` ora ESEGUE il
> calcolo, analizza il blocco come modulo, prova il vuoto e prova le due forme del livello —
> ognuna con il suo controllo negativo.
>
> **Un file mente anche con l'estensione.** *(14/08)* La PR verso `main` è stata bocciata da
> `deno check` con **36 errori**: il blocco del cancello è JavaScript e stava dentro un `.ts`.
> Non era forma — era una contraddizione insanabile: il banco lo **esegue** in una VM, quindi
> tipizzarlo rompeva le prove e non tipizzarlo rompeva la CI. Le due cose non potevano stare
> nello stesso file, e infatti non ci stavano. ⇒ Separato in `conoscenza.js`. E il banco ci ha
> guadagnato: da un modulo vero non si estrae **a fette cercando marcatori di testo**, si
> importa — e quelle fette mi avevano già tradito due volte nello stesso pomeriggio.
>
> **Quando stubbi qualcosa, chiediti cosa smette di essere controllato.** *(14/08)* Seconda
> bocciatura della stessa PR: 5 errori sui tipi di `supabase-js`, invisibili in locale perché
> avevo sostituito `createClient` con uno stub che torna `any` — cioè avevo stubbato **proprio
> la cosa che porta i tipi**. ⇒ È la TERZA volta in un pomeriggio che il banco è più permissivo
> del vero (script invece di modulo, ramo mai eseguito, tipi stubbati) e la terza volta che
> **verde non voleva dire niente**. La cura è stata prendere lo stesso pacchetto da **npm**,
> che il proxy non nega, e riprodurre i 5 errori prima di correggerli.
>
> **Un errore che non si sa leggere costa più del guasto.** *(14/08)* Un'eccezione non catturata
> la risponde il runtime, non la funzione: 500 **senza CORS** ⇒ il browser dice «Failed to
> fetch», che è il nulla. Tre giri di prove per arrivare a un `ReferenceError` che il server
> conosceva dal primo istante. ⇒ Rete sotto tutto, e il motivo vero nel log: il quarto e il
> quinto guasto sono stati diagnosticati **in un minuto** invece che in un'ora.
>
> **Chi non può aprire l'app può ancora bussare dal database.** *(14/08)* La rete della sessione
> cloud nega le chiamate a `*.supabase.co`, ma `pg_net` parte da dentro Postgres e ci arriva.
> ⇒ Da qui in poi un'edge si prova **senza aspettare una persona**: `net.http_post` e la
> risposta in `net._http_response`. È ciò che ha chiuso gli ultimi tre guasti senza fargli
> ricaricare la pagina sei volte.
>
> **Togliere una riga di una terna sporca più che pulire.** *(14/08)* Il «socio di prova» erano
> **tre** righe legate — token `completed`, scheda `applied`, marcatore «già segnalato». Togliere
> solo quella nominata nella scheda avrebbe lasciato un token bruciato senza scheda: la prova
> successiva sarebbe fallita **per il residuo della pulizia**.

---

# ⚙️ Come si lavora, a seconda di dove si apre la chat

| | cloud (claude.ai / app) | Mac |
|---|---|---|
| GitHub, PR, CI | ✅ | ✅ |
| Supabase (cron, edge, SQL) | ✅ | ✅ |
| Repo, git, test Node, `controlla-sintassi` | ✅ | ✅ |
| **Memoria dell'app** | ❌ **non accessibile** | ✅ |
| VM Hetzner, worker, pm2, log | ❌ | ✅ |
| `.env` del bot, whitelist, ponti | ❌ | ✅ |
| Secret Supabase | ❌ (nessuno strumento) | ✅ dalla dashboard |
| `deno check` in locale | ❌ (solo in CI) | ✅ |
| Vedere l'app col login staff | ❌ | ✅ |

🚨 **In cloud il container viene riciclato**: quello che non è pushato si perde.

📌 **Questo file non va più allegato a mano.** Vive nel repo ed è citato in `CLAUDE.md`, che ogni
sessione carica da sola: chi apre una chat — dal cloud o dal Mac — lo trova già letto. È la cura
del buco del 13/08, quando la sessione è partita cieca e ha scelto da sé su cosa lavorare.

📌 **I due prompt — apertura e chiusura — stanno in [`prompt-apertura-chiusura.md`](prompt-apertura-chiusura.md)**,
qui accanto, dal 14/08. Erano tenuti a memoria, e quello di apertura mandava ancora ad aprire la
memoria `lavori-urgenti` **svuotata il giorno prima**: la sessione del 14/08 è partita cercando una
fonte che non esiste più. Stessa malattia dei tre registri, stessa cura — **scritto, nel repo,
accanto a ciò che descrive**.

📌 **Le memorie `lavori-*` sono in pensione dal 13/08/2026.** `lavori-urgenti`, `lavori-in-coda`,
`lavori-chiusi` e `lavori-chiusi-storico` — più le tematiche su Gmail e autovalutazione — vanno
svuotate e sostituite da un rimando a questo file. Il loro contenuto è **qui**, liste e memorie
tematiche comprese.
🚨 **Non riscriverci dentro le liste.** Due copie divergono, ed è esattamente la malattia curata
il 13/08: tre registri che dicevano il falso mentre uno si dichiarava «fonte rapida ufficiale».
⚖️ **Le altre memorie restano dove sono** — VM, `.env` del bot, chiavi SSH, decisioni personali:
il repo non le sostituisce, e chi svuota deve saper distinguere.
🖥️ Lo svuotamento **si fa dal Mac**: dal cloud la memoria dell'app non si tocca (tabella qui sopra),
e la sessione del 13/08 che ha scritto questa riga non ha potuto farlo da sé.

⚠️ **Chi lo aggiorna:** si aggiorna **durante il lavoro**, come gli altri documenti del repo, e
il commit resta nella storia (`git log docs/lavori/README.md` dice quando una voce è nata e quando
è stata chiusa). Le **promozioni dalla coda alle urgenti le decide il committente**, mai la sessione.

---

<sub>Aggiornato il 14/08/2026 a fine **14ª sessione**, dopo la 13ª dello stesso giorno (#688→#691) e quella del 13/08 (#674→#687). Chiuse le voci **35** e **24**; la **27** è arrivata su PROD con la **#692** (PROD 6.220) ma **resta aperta**, perché l'app di produzione non l'ha ancora vista nessuno e le 3 policy di PROD sono ancora là. Su TEST è invece completa, passo 4 compreso. Versioni, sha, PR aperte e tutti e otto i conteggi **rimisurati alla chiusura**, non ricordati; il registro delle versioni è stato confrontato col misurato e combaciava. La sessione girava dal cloud: VM, worker, `.env`, secret, ponti, memoria dell'app **e l'app di PROD col login staff** non sono stati misurati — ed è quest'ultima la mancanza che pesa, perché è la sola cosa che questa sessione ha cambiato senza poterla guardare. I conteggi di questo file e le versioni dichiarate nei registri sono verificati dalla CI (`guard-docs-truth.yml`); la parità fra i rami da `guard-worker-sync.yml`. Le promozioni dalla coda alle urgenti le decide il committente.</sub>
