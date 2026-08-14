# Padel Match Organizer — i lavori

**Fotografia del 14/08/2026, a fine 17ª sessione.** Misurata, non ricordata.

## 🔎 Il filo della giornata: **la prova che ti dà ragione**

La 15ª sessione aveva imparato che *una porta chiusa non è LA porta chiusa*. La 16ª ha imparato la
cosa accanto, e le è successo **tre volte**, sempre con la stessa forma: una misura che sembrava
confermare, e non confermava niente. 🚨 **La 17ª ha scoperto che una di quelle tre era falsa a sua
volta** — e l'ha aggiunta in fondo alla stessa tabella, che è il posto dove doveva stare.

| la prova diceva | cosa era davvero |
|---|---|
| «`wa-shadow-proxy` non riceve più chiamate» — sonda su `edge_logs`, **0 risultati** | sorgente sbagliata: le edge stanno in **`function_edge_logs`**, dove i 404 erano **619 in 24 ore**. Salvata dal controllo negativo — chiedere alla sonda se sa trovare *qualcosa* (7398 righe) prima di credere a uno zero |
| «le tre policy `ALL` su TEST aprono lettura e scrittura ad `anon`» | **decorative**: ad `anon` mancano i grant di tabella, e l'attacco risponde `42501` **prima** di qualunque modifica. Il no non veniva dall'RLS |
| «i 404 sono andati a zero dopo il disarmo: funziona» | **no**: si erano fermati **12 e 13 minuti PRIMA** che la cura fosse live. Non era una riparazione, era **una scheda del gestionale chiusa** |
| *(17ª)* «i 404 si erano comunque fermati, alle 18:26 e alle 18:29» | **nemmeno per idea**: non si sono **mai** fermati. Ne arrivava uno al minuto ancora alle **19:31**, da una scheda rimasta aperta col codice vecchio. La 16ª aveva letto una finestra che finiva lì e l'aveva presa per la fine del traffico |

⚠️ **Le prime tre avevano un tratto comune**: erano tutte prove che *davano ragione*. Una verifica
che conferma non va guardata meno di una che smentisce — va guardata **di più**, perché è quella che
nessuno ricontrolla. ⇒ Il rimedio non è diffidare: è chiedere alla prova **di cosa sarebbe capace
se il fatto fosse falso**.

🎯 **La quarta insegna il pezzo mancante, ed è più scomodo: anche la prova che ti dà TORTO va
ricontrollata.** La 16ª sessione ha fatto la cosa difficile — ha rifiutato un risultato che la
assolveva — e si è fermata **un passo prima**, senza chiedersi se il dato su cui poggiava lo
smascheramento fosse a sua volta vero. ⇒ Lo scetticismo applicato una volta sola non è scetticismo:
è **un cambio di conclusione**. La domanda non è «questa prova mi conviene?», è sempre e solo
«questa sonda, in questa finestra, con questo campo, cosa sa vedere?».

🎯 **E il censimento ha trovato il lavoro, non solo la mappa.** La voce 39 doveva produrre un
elenco di divergenze. Ha prodotto un **guasto vivo in produzione**: `pmo_parser_errors` con 9
colonne su PROD e 14 su TEST, e l'app che dal 7/08 ne scriveva e leggeva cinque che di là non
esistono — **in silenzio**. È la terza volta in tre giorni che a trovare la causa è **misurare il
contesto**, non eseguire il compito scritto.

## 📌 Le decisioni prese dal committente oggi

| | |
|---|---|
| ⬆️ **quattro voci promosse** | 37, 38, 39 dalle note «nate misurando», e la **23** dalla coda. La lista urgenti era **vuota** e nessuna si promuove da sé |
| 🔓 **quattro autorizzazioni distinte** | famiglia feedback su PROD, le 5 colonne di `pmo_parser_errors`, le tre policy decorative su TEST, e il disarmo WhatsApp — una per ripresa, mai una delega in bianco |
| ✋ **due «no» impliciti, rispettati** | le due policy **portanti** su PROD non sono state toccate, e il **TRUNCATE** ad `anon` neppure: erano fuori da ciò che aveva autorizzato |
| 🔀 **due merge in squash, su sua richiesta** | #698 e #699 |

**E nella 17ª, la sera dello stesso giorno:**

| | |
|---|---|
| 🔓 **famiglia feedback tolta anche su TEST** | la divergenza che la 16ª si era auto-denunciata e aveva lasciato scritta come «la prima cosa da chiedere alla prossima ripresa». Chiesta, autorizzata, fatta |
| 📚 **sanare `docs/` e correggere la voce 38** | non solo riallineare i rami: riscrivere la misura dei 404 con quella vera, invece di portare su `main` un fatto falso |
| ✋ **voce 23: diagnosi sì, patch no** | la correzione tocca la strada che prenota **davvero** e dal cloud non è verificabile ⇒ si scrive cosa non va, non si tocca |
| 📦 **voce 37 chiusa DICHIARANDO, non eseguendo** | messo davanti alle tre strade — dichiarare, fare l'RPC, o la «riga di SQL» — ha scelto la prima. Le due «portanti» restano **per scelta misurata**, con la ragione scritta nella loro riga: chiuderle con la riga di SQL sarebbe stato un passo indietro travestito da chiusura |
| 🔄 **ha ricaricato le due schede, e ha chiuso la 38** | la prova che mancava da due sessioni non era una misura più fine: era **una persona davanti allo schermo**. Due secondi di `Cmd-R` contro quattro sonde false — ed è la terza volta in tre giorni che la verifica che conta la fa lui |

| | |
|---|---|
| 🔴 **Urgenti** | **1** |
| 📋 **In coda** | **13** |
| 📦 **Chiuse** | **18** il 13–14/08 + ~56 dal 7/08 + ~41 fino al 6/08 |

**Stato del sistema, rimisurato alla chiusura della 17ª:** app PROD **6.221** · TEST **6.231**
(nessuna delle due toccata oggi) · alla ripresa `main` era `481e2a0` e `test-preview` `70b48ac`,
più un commit per ramo da questa sessione · linter **PROD 101** (`WARN` 83, `ERROR` **0**) e **TEST
97** (`WARN` 80, `ERROR` **1**, `security_definer_view`, preesistente) · cron PROD 11 accesi / 2
spenti, TEST 5 accesi / 4 spenti (misura del **13/08, non ricontrollata**).

🚨 **E `docs/` NON era allineato: la 17ª è partita con la guardia rossa.** La 16ª sessione ha spinto
la propria chiusura su `test-preview` (`70b48ac`, 19:18) e **non l'ha portata su `main`**:
`guard-worker-sync` è fallita lì alle 19:18 e nessuno l'ha ri-lanciata, mentre `main` — il ramo
predefinito, quello che deve sembrare affidabile a colpo d'occhio — continuava a dichiarare la
fotografia della **15ª**. Non era la finestra transitoria dei 90 secondi del punto ⑥: erano venti
minuti, cioè drift vero.
⚖️ È la regola 4bis presa a metà — *prima `test-preview`, POI il merge su `main`* — dove si fa la
prima metà e si considera finito. La cura non è una guardia in più: è che **una sessione non è
chiusa finché i due rami non dicono la stessa cosa**, e la chiusura scritta su un ramo solo è
esattamente il documento che mente di cui parla la voce 30.

⭐ **PROD è stato verificato dal SERVER, non dall'etichetta**: `pg_net` ha scaricato
`app.padelvillage.club/index.html` → **200**, `APP_VERSION = '6.221'`, e il blocco del disarmo
**presente nel file servito**. È la stessa strada che ha provato l'edge il 14/08: da una sessione
cloud il browser non arriva a `*.supabase.co` né al dominio, ma **il database sì**.

🖐️ **La 16ª sessione ha scritto su PERMESSI, SCHEMA e APP.**
① **PROD**: 3 policy anonime tolte (famiglia feedback), **5 colonne aggiunte** a
`pmo_parser_errors`, app **6.220 → 6.221**.
② **TEST**: 3 policy decorative tolte, app **6.230 → 6.231** con lo **stesso identico blocco** di
PROD — estratto dal file vero, non riscritto.
③ **Dati**: **nessuna riga cancellata, nessuna riga scritta**. Tutte le prove d'attacco e gli
INSERT di verifica stavano in **transazioni annullate**: verificato dopo, 0 residui.
↩️ Tutte e tre le migrazioni reversibili, con l'SQL di ripristino **verbatim** in testa.

**Verificato sul bersaglio il 14/08, 16ª sessione:**
- ✅ **prova d'attacco come `anon`, prima e dopo**, su ogni policy toccata — col **seme** che
  soddisfa la chiave esterna, altrimenti a fermare l'attacco sarebbe il vincolo e non l'RLS
- ✅ **la strada legittima regge**: la RPC pubblica del feedback risponde `{"ok": true}` e scrive
- ✅ **end-to-end via PostgREST** su `pmo_parser_errors`: **400 `42703` → 200 `[]`**, stessa URL e
  stessa chiave dell'app
- ✅ **l'impronta delle colonne** di PROD ora **identica** a quella censita per TEST *prima*
- ✅ **linter diffato voce per voce** a ogni passo, su entrambi i progetti, con la **previsione
  dichiarata prima**: giusta due volte su tre (la terza sbagliata **di due**, in meglio)
- ✅ **rete di regressione**: 13/13 Node, **55/55** su `main` e **90/90** su `test-preview`, prima
  e dopo
- ✅ i **quattro percorsi** di `guard-worker-sync` fra i rami, dopo ogni merge

> ⚠️ **Ancora non misurati**, e da non dare per buoni: la VM (worker e i due bot, riavvii), il
> `.env` del bot e i suoi interruttori, i ponti, i secret Supabase, i cron di entrambi i progetti
> e la **memoria dell'app**. Dalla sessione cloud manca l'accesso a Hetzner.
> ⚠️ **L'app col login STAFF resta non vista, per la seconda sessione di fila.** Ed è la mancanza
> che pesa di più oggi, perché il disarmo WhatsApp **cambia ciò che lo staff vede** e nessuno l'ha
> guardato. 📌 `pg_net` resta la porta di servizio per provare il **server**; lo **schermo** no.

---

## 🔴 URGENTI — 1

**Promosse dal committente il 14/08/2026, 16ª sessione**, dopo che la lista era rimasta vuota per
la prima volta da quando esiste. Tre nascono dalle note «🆕 nate misurando» e una — la **23** —
sale dalla coda. Proposte a misura fatta, scelte da lui: quattro su quattro.
📦 Delle quattro ne resta **una**: la **39** chiusa dalla 16ª sessione, la **37** e la **38** dalla
17ª. La 37 è stata chiusa **dichiarando** ciò che resta invece di eseguirlo — una chiusura, non una
rinuncia; la 38 con la prova che le mancava, arrivata da lui in due secondi (il perché di entrambe
sta nelle loro righe fra le chiuse).

### 23. ⛔ `writeBookingJob` in `create` non guarda com'è andata
*Salita dalla coda il 14/08.* La creazione manda il lavoro al worker e **non controlla l'esito**.
Stessa forma di un guasto già visto: *«non ho ricevuto risposta» non è «non è stato scritto»*, e
gli esiti sono **tre**.

#### 🔎 Diagnosi, 17ª sessione — *(scritta e basta: patch NON fatta, per sua decisione)*

🛑 **Primo: la scheda sbaglia il bersaglio, e non di poco.** Diceva «la correzione è nell'**app**».
Misurato: **0 occorrenze** di `writeBookingJob` in `index.html`. Vive nella edge function
`supabase/functions/matchpoint-bookings-create/index.ts`. Chi avesse eseguito la scheda alla lettera
avrebbe cercato per un pezzo nel file sbagliato.
🔀 **E i due rami divergono**: `main` ha **4** chiamate a `writeBookingJob`, `test-preview` **5** —
la quinta è il ramo «prova a vuoto» del 7/08, che su TEST chiude il lavoro con `done` invece che con
`error`. Non è la voce 23, ma chi la ripara deve saperlo prima di toccare, o promuoverà una riga che
di là significa un'altra cosa.

**Il titolo ammette due letture, e la misura dice che sono vere tutt'e due.**

① **`writeBookingJob` scarta l'esito della propria scrittura.** Il corpo è un `await ... .upsert(...)`
e nient'altro: nessun controllo dell'errore. La sorella `saveStaffBookingRecord`, **dieci righe più
su nello stesso file**, quel controllo ce l'ha (`if (erroreRiga) throw ...`) — quindi non è una
convenzione del file, è una dimenticanza. ⇒ Se la riga di stato non si scrive, il lavoro resta
`pending` **per sempre** e chi guarda non saprà mai com'è finita: esattamente ciò che il commento
lì accanto dichiara di voler evitare.

② **Il terzo esito viene raccontato come il secondo.** `callWorkerCreateBooking` su errore di rete
lancia, e `runBookingJobInBackground` scrive `error`. Ma il commento nel codice **dice già il
problema**, e chi l'ha scritto lo sapeva:

> `// NESSUN retry: la prenotazione potrebbe essere già stata creata dal worker.`

⇒ Gli esiti sono **tre** — *fatto*, *non fatto*, *non lo so* — e oggi il terzo viene scritto come
«errore». Il costo non è cosmetico: lo staff legge «errore», rifà la prenotazione, e se il worker
l'aveva creata davvero il campo finisce **prenotato due volte** sul Matchpoint del circolo.
📌 Il confronto che lo conferma: la sorella `matchpoint-bookings-cancel` **i retry li fa** (`Worker
call failed after retries`), perché disdire due volte è innocuo mentre prenotare due volte no. La
differenza è deliberata — ciò che manca non è il retry, è **dirlo**.

⚠️ **Perché non ho scritto la patch**, e non è prudenza generica: la correzione tocca la strada che
prenota **davvero** al circolo, e da questa sessione cloud non è verificabile — i log del worker
stanno su **Hetzner**, e il worker è **uno solo, condiviso TEST+PROD**, quindi non esiste nemmeno un
posto dove provarla senza rischiare il Matchpoint vero. Una patch verde su un banco che non esercita
quella strada è la condizione descritta nella memoria «un banco più permissivo della produzione dà
fiducia sbagliata» — cioè peggio di non averla. ⇒ **Si fa dal Mac**, con i log sotto gli occhi.

---

## 📋 IN CODA — 13

Le sezioni **A** (cose sue già decise), **B** (lavoretti minuti) ed **E** (manutenzione memoria) sono **vuote**.

### C — Cose sapute e non risolte — 8

#### 11bis. Il bottone che CREA IN MATCHPOINT chi ha solo l'ID `PMO-`
Sua idea del 2/08. Ha **perso urgenza** il 3/08: la visibilità di quei soci è stata curata alla radice (PROD 6.169) ⇒ non è più una riparazione ma una **scelta**.

#### 13. 🇬🇧 Il ragionamento del modello, in inglese, dentro il messaggio al socio
Visto da lui il 29/07, **1 volta su 24**. È la 21ª trappola vista dalla strada della **prosa**, non dei bottoni — e i test guardavano i bottoni.

#### 14. 🔑 Le ⑩ chiavi «Ospite» che oscillano
Avanzata il 24/07, non chiusa. Servono le **3 sonde rieseguite a distanza di ore** e diffate; ≥1 campione pulito prima di concludere «benigna e rara». ⏳ La sonda `fp_hot` è **scaduta il 4/08**: va rifondata.

#### 14bis. 🎓 «Se lo staff mi prenota una LEZIONE, il bot me la ricorda?» — oggi NO
Sua domanda del 6/08, messa in coda da lui. **Voce a sé**, non una variante della 14.

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
  ⬆️ **Entrambe promosse da lui il 14/08: sono la voce 37**, dove sono anche rimisurate — le policy su PROD sono **quattro**, non tre, e una è un `UPDATE`.

Misurando il **14/08** nella 14ª sessione, provando la voce 27 dal vivo:

- 🔀 **Le TABELLE dei due progetti divergono**, non solo le funzioni SQL della voce 33.
  Misurate finora solo le due dell'autovalutazione: `assessment_tokens.member_email` e
  `self_assessments.email`, `consistency_score`, `inconsistency_reasons`, `review_note` **ci
  sono su PROD e non su TEST**. Nessuno le aveva mai confrontate. ⚠️ Le altre tabelle **non
  sono state guardate**: questa è una campionatura di due, non una misura.
  ⬆️ **Promossa da lui il 14/08: è la voce 39.**
- 📡 **Il gestionale di TEST chiama `wa-shadow-proxy` una volta al minuto e prende 404**: la
  funzione sta nel repo ma **non è mai stata deployata su `cudi…`**. **612 chiamate a vuoto in
  24 ore**, dal 13/08. Non rompe niente di visibile, ed è per questo che nessuno se n'era
  accorto. ⚠️ Non guardato se su PROD c'è.
  ⬆️ **Promossa da lui il 14/08: è la voce 38** — e guardato: **su PROD è uguale**, 623 chiamate
  a vuoto in 24 ore verso una funzione che non è deployata **né di qua né di là**.
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

Misurando il **14/08** nella 15ª sessione, aprendo il residuo della voce 27:

- 🕳️ **`fetchAssessmentRawResponsesByTokens` non può funzionare su PROD.** La sola `fetch` REST a
  `self_assessments` rimasta in `main` (riga 29939) è una **GET** con la chiave pubblicabile, ma su
  quella tabella **non esiste nessuna policy di SELECT** — ci sono solo le 3 di INSERT. ⇒ Risponde
  `200` con lista **vuota**, sempre, e il chiamante ha un `catch` che tace. Non l'ho toccata: non è
  la voce 27, e va capito **a cosa serviva** prima di decidere se ripararla o toglierla. ⚠️ Non
  guardato se su TEST si comporta uguale.

- 🔎 **`get_self_assessments_by_tokens` è `SECURITY DEFINER` eseguibile da `anon`**, quindi
  scavalca anche lei la chiusura della lettura del 12/08. **Non toccata di proposito**: l'app la
  usa davvero (`index.html:30062`, ed è la strada che funziona mentre la GET REST accanto non può)
  e vuole i **gettoni in ingresso**, che non si rastrellano più. È un fatto da sapere, non un buco
  aperto — ma è la terza funzione della stessa famiglia, e la famiglia andava guardata tutta.
- 🧮 **Le funzioni `SECURITY DEFINER` chiamabili da `anon` su PROD sono 47**, e due erano quelle
  della voce 27. Il linter le segnalava **tutte e 47 da sempre**, con lo stesso identico titolo:
  ⚠️ nessuno le ha mai lette una per una. Le altre 45 **non sono state guardate** — questa è una
  campionatura di due, esattamente come le tabelle divergenti di ieri.

Misurando il **14/08** nella 16ª sessione, disarmando la voce 38:

- 🧟 **Il riquadro WhatsApp e il suo blocco JS restano nel file, ora irraggiungibili**: ~150 righe di
  HTML (`index.html:7219–7369`) e ~700 di JS (il blocco `wa*`), tenute in vita solo dal `return` che
  le precede. **È la stessa forma delle voci 28 e 29** — codice dormiente di una cosa smontata — e
  come quelle l'asportazione va provata per bene, non fatta di slancio. ⚖️ **Non l'ho messa in coda
  da me**: le promozioni le decide lui, e questo vale anche per l'ingresso in lista.
- 🔎 **`wa_usage_stats` è rimasta su `ayly…` a leggere tabelle che non esistono più**, ed è
  `SECURITY DEFINER` eseguibile da `anon`. Non fa danno — muore in partenza con `42P01` — ma è la
  **quarta** funzione della famiglia «viva senza il suo mondo» incontrata in due giorni, dopo le tre
  della voce 36. Non toccata: non era la 38.

Misurando il **14/08** nella 16ª sessione, censendo le tabelle (voce 39):

- 🔴 **`pmo_parser_errors`: l'app di PROD scrive e legge colonne che su PROD NON esistono.** Dalla
  **PR #648 del 7/08**, `logParserError` manda sempre `origine` e il pannello «Le mie segnalazioni»
  chiede `stato`, `risolto_il`, `risolto_in_versione`, `nota_risoluzione`: cinque colonne che stanno
  **solo su TEST**. Provato sul bersaglio: **`42703`** su tutte e tre le strade. ⇒ Su PROD nessuna
  segnalazione del parser si registra — **in silenzio** — e quel pannello non carica.
  ⚖️ **Non è la causa** del silenzio della tabella (45 righe, tutte del **16/06**, due mesi prima):
  la mia ipotesi è stata smentita dalla misura, e i due fatti restano distinti.
  ✅ **RIPARATA in giornata, strada scelta da lui: aggiungere le 5 colonne a PROD** — quella che
  allinea, non quella che mutila. Colonne **copiate verbatim da TEST** (`stato` e `origine` `NOT
  NULL` con default, le altre tre libere); indici e vincoli erano **già identici** e non sono stati
  toccati. Verificato: le tre strade che davano `42703` ora riescono (l'INSERT nella forma **esatta**
  dell'app, in transazione annullata, 0 residui); l'**impronta** delle colonne di PROD è ora
  **identica** a quella censita per TEST *prima* di toccare niente; e la prova **end-to-end via
  PostgREST**, stessa URL e stessa chiave dell'app, è passata da **400 `42703`** a **200 `[]`**.
  Linter **101 → 101**, `ERROR` 0. Le 45 righe storiche intatte, ultima ancora del 16/06.
  🔗 Migrazione `20260814183100`, reversibile.
  ⚠️ **Resta aperta la domanda vera**: *perché* quella tabella tace dal **16/06**. La migrazione
  chiude il disallineamento, non il silenzio — e i due non erano lo stesso problema, per quanto
  comodo sarebbe stato crederlo.
- 🧯 **Rivedere quel che ho detto sulla voce 37**: avevo chiamato «portante» la policy di INSERT
  anonimo su `pmo_parser_errors`. Resta vero in linea di principio — il codice ricade su `anon`
  quando la sessione staff manca — ma è **irrilevante in pratica finché resta il 42703**, perché su
  PROD quell'insert non riesce comunque. Ho fatto bene a non toglierla, per il motivo sbagliato.
- 🔎 **`assessment_tokens` diverge in DUE direzioni**, non una: `member_email` solo su PROD,
  `updated_at` solo su TEST, con **13 colonne da entrambe le parti**. Il conteggio non l'avrebbe
  mai mostrato.

Misurando il **14/08** nella 17ª sessione, sanando la 37 e rimisurando la 38:

- 🔓 **Il `TRUNCATE` ad `anon`, sceso qui dalla voce 37 quando è stata chiusa.** Non è stato tolto e
  la voce lo dichiara: riguarda i **grant** e non le policy, e non era ciò che era stato autorizzato.
  Il testo è quello misurato dalla 16ª sessione, intatto:

  🚨 **E sotto c'era altro, che nessuno cercava.** Quella `D` nell'ACL è **TRUNCATE**, e l'**RLS non
  filtra il TRUNCATE**. Provato come `anon` su TEST: `truncate public.pmo_parse_history` **RIUSCITO**.
  (Su `pmo_bookings` risponde `0A000`, ma è la **chiave esterna** di `pmo_parse_history`, non un
  rifiuto di permesso.)
  📊 Su **PROD** sono **14 le tabelle** dove `anon` ha TRUNCATE — con ACL piena `arwdDxtm`, quindi lì
  a trattenerlo è **solo l'RLS**: fra queste `admin_settings`, `assessment_admin_config` (il deposito
  del PIN), `pmo_lessico`, `pmo_ai_settings`, `pmo_parser_config` e i due backup del 9/08.
  ⚖️ **Non è un allarme, ed è importante dirlo**: chi ha la chiave pubblicabile parla **PostgREST**,
  che non ha un verbo TRUNCATE. Per usare quel permesso servirebbe eseguire SQL **come `anon`** — cosa
  che oggi nessuna strada nota permette. È una **configurazione sbagliata latente**, non una porta
  aperta. Ma è la stessa forma della voce 36: un permesso che nessun elenco di «chi scrive» mostra.

- 🔎 **`wa_usage_stats` su `ayly…` non muore come dice la scheda, e non muore sempre.** La voce 38
  dichiara «esiste ancora ma muore — `42P01: relation "whatsapp_inbound_messages" does not exist`».
  Misurato: la funzione **esiste** (`wa_usage_stats(days integer)`, `SECURITY DEFINER`), ma su
  `/rest/v1/rpc/wa_usage_stats` PostgREST risponde **404** — che non è un `42P01`, è «firma non
  trovata». E accanto ai **290** fallimenti ci sono **29 chiamate andate a 200**, l'ultima alle
  **18:56**. ⇒ Delle due cose una: o chiama in due modi diversi, o c'è un secondo chiamante. **Non
  l'ho stabilito**, e non l'ho toccata: il conto dei 404 che serviva alla 38 è giusto lo stesso,
  ma la *ragione* scritta nella scheda non è quella misurata.
- 🕳️ **Su TEST `service_role` non può leggere né scrivere le due tabelle del feedback.** Ha solo
  `REFERENCES/TRIGGER/TRUNCATE` su `post_match_feedback_responses` e `_tokens`, senza
  SELECT/INSERT/UPDATE — condizione **preesistente**, non prodotta dalla migrazione di stasera
  (misurata prima e identica dopo). È la firma del vecchio `revoke ... from public`. Oggi non fa
  danno perché la strada legittima è una RPC `SECURITY DEFINER`; il giorno in cui un'edge provasse
  a leggerle **col ruolo di servizio** fallirebbe, e su PROD la stessa prova riuscirebbe. ⚠️ È la
  forma della voce 39 spostata sui **permessi**: non le colonne a divergere, ma chi può toccarle.
- 🔀 **`matchpoint-bookings-create` diverge fra i rami**: 4 chiamate a `writeBookingJob` su `main`,
  **5** su `test-preview`. La quinta è il ramo «prova a vuoto» del 7/08, che su TEST chiude il
  lavoro con `done` mentre su PROD chiude con `error`. Trovata aprendo la voce 23.

Misurando il **14/08**, aprendo la voce 22:

- 🧊 Lo specchio delle prenotazioni di TEST fermo dal 7/08 → **promossa da lui a urgente: è la voce 32.**
- 🔢 `payment` su TEST ha **2503** righe contro le **2502** di PROD: una in più, non guardata.

---

## 📦 CHIUSE — 13 e 14/08/2026 — 18 voci

⚠️ **Una sola sezione datata per volta.** `guard-docs-truth` conta le righe di **tutte** le
intestazioni `CHIUSE —` ma legge il numero della **prima**: due blocchi datati affiancati dichiarano
1 e ne contano 9, e la guardia fallisce. Chi chiude in un giorno nuovo **allarga la data di questa**,
non ne apre un'altra sotto.

**Le prime dieci voci sono del 14/08; le otto successive del 13/08.**

| voce | cosa |
|---|---|
| **38** | 📡 *(14/08, chiusa dalla 17ª sessione — nata come nota dalla 14ª, promossa alla 16ª)* **`wa-shadow-proxy`: ~1540 chiamate a vuoto al giorno, disarmate e VERIFICATE.** Il pannello WhatsApp dello staff bussava una volta al minuto a una funzione **mai deployata da nessuna parte** — 623 404 al giorno su PROD, 619 su TEST — più un secondo temporizzatore, `wa_usage_stats` su `ayly…` ogni 300 s, **295 fallimenti al giorno**. Un canale **smontato il 25/07** di cui il gestionale non si era accorto: stessa famiglia delle voci 28 e 29. ⚖️ Rideployare non era un'opzione, e l'ha deciso la misura: su `ayly…` ci sono **zero** edge function e **zero** tabelle `whatsapp*`. ✅ **Disarmo minimo**: un `return` in testa a `waInit()` — il riquadro non si mostra, i due temporizzatori non partono, il codice resta dormiente — su **entrambi i rami** con lo **stesso identico blocco** estratto dal file vero (PROD **6.221**, TEST **6.231**), che è il punto della voce 31. La libreria testi e template resta viva. 🎯 **Ma il valore di questa voce non è il disarmo: è la CATENA DI PROVE FALSE che ci è voluta per crederlo, quattro in due giorni.** ① La prima sonda cercava in `edge_logs` e rispondeva **0**: le edge stanno in **`function_edge_logs`** — salvata dal controllo negativo. ② Poi i 404 sembravano fermi alle **18:26/18:29**, *prima* della cura, e la 16ª sessione ha fatto la cosa difficile: **ha rifiutato un risultato che la assolveva**, concludendo «non è la mia riparazione, è una scheda chiusa». ③ 🚨 **E anche quella era falsa**: i 404 **non si erano mai fermati** — ne arrivava uno al minuto ancora alle **19:31** — era una finestra di log che finiva lì, scambiata per la fine del traffico. ④ E alla ripresa la prima query ha risposto **0** di nuovo, perché cercava `request.path` invece di `request.pathname`: di nuovo il controllo negativo (2461 righe) a smascherarla. ⭐⭐ **La lezione, che vale più della voce**: lo scetticismo applicato **una volta sola** non è scetticismo, è un cambio di conclusione. Anche la prova che ti dà **torto** va ricontrollata — la 16ª si è fermata un passo prima, senza chiedersi se il dato su cui poggiava lo smascheramento fosse vero. 🔎 **La causa vera era banale e nessuno l'aveva nominata**: una scheda del gestionale rimasta **aperta col codice vecchio**. Una pagina già caricata non prende il codice nuovo finché non la si **ricarica**, e il buco nei log fra le 23:00 e le 10:00 era il computer chiuso per la notte, non il traffico che cessa. ✅ **CHIUSA con la prova che serviva, e non è un silenzio.** Alle **19:57** il committente ha ricaricato **entrambe** le schede — la firma è inconfondibile nei log (`pmo_get_my_staff_profile`, `pmo_ai_settings`, `pmo_lessico`, il websocket `101`) — e da lì: PROD **0** chiamate al proxy mentre l'app ne faceva **206** fino alle 20:05; TEST ultimo 404 alle **19:57:24** e poi **zero**, con **271** chiamate fino alle 20:05; `ayly…` ultimo fallimento di `wa_usage_stats` alle **19:56:24**. ⭐ **È silenzio CON L'APP CHE PARLA ACCANTO**, ed è esattamente ciò che mancava alle prove precedenti: il controllo **positivo**, non l'assenza di traffico. 📌 Il disarmo era stato verificato anche **sul file SERVITO** via `pg_net` — `200`, `APP_VERSION = '6.221'`, e il `return;` **nudo** dentro `waInit()`: controllato il **return**, non il commento, perché un blocco che *dice* di essere disarmato e non lo è sarebbe la peggiore delle prove comode. ⛔ **Resta fuori, dichiarato**: la potatura del riquadro (~150 righe di HTML) e del blocco JS `wa*` (~700), oggi irraggiungibili — è fra le «nate misurando», stessa forma delle voci 28 e 29 |
| **37** | 🔓 *(14/08, chiusa dalla 17ª sessione — aperta dalla 16ª, nata come nota il 12/08)* **Le policy di scrittura anonima rimaste: sette tolte, due lasciate con la ragione scritta.** 🚨 **La lezione della voce non sono le policy: è che due gruppi con lo STESSO aspetto avevano portata OPPOSTA**, e solo la misura li distingueva. Su TEST le tre `ALL` (`pmo_bookings`, `pmo_parse_history`, `pmo_parser_rules_versions`) sembravano «lettura e scrittura per anonimo» e sono risultate **decorative** — ad `anon` mancano i grant di tabella, e l'attacco rispondeva `42501` **prima** di qualunque modifica ⇒ la 16ª si è **fermata** e le ha tolte solo dopo, con la ragione giusta (`20260814191255`). Le tre della **famiglia feedback**, invece, su TEST erano **portanti davvero**: i grant ci sono (INSERT+UPDATE su `responses`, SELECT su `tokens`), e la prova d'attacco prima di toccare le dà **riuscite** — 2 gettoni letti, risposta scritta (`20260814194040`). ⇒ Un rattoppo «per parità» fatto senza rimisurare sarebbe stato **giusto per caso**. ✅ **Tolte in tutto 7**: 3 su PROD (famiglia feedback, e la terza — `SELECT` sui gettoni — **non la nominava nessuna nota**: è saltata fuori guardando la famiglia intera invece della singola tabella), 3 decorative su TEST, 3 famiglia feedback su TEST. 🔀 **E fra le due ultime c'è la voce 31 in diretta, con la mano della 16ª**: l'autorizzazione diceva «PROD» ed è stata eseguita alla lettera, lasciando la famiglia chiusa di qua e aperta di là — difetto che la sessione **si è auto-denunciata** invece di sanare da sé, e che la 17ª ha chiuso il giorno stesso. ⚪ **Le due «portanti» RESTANO, ed è una scelta misurata, non una rinuncia**: `pmo_ai_turns` e `pmo_parser_errors` scrivono con la chiave pubblicabile **solo come ripiego** quando la sessione staff manca — tutte le chiamanti stanno in schermate staff, e l'app **sale** al token staff quando c'è. Una riga di SQL esisterebbe (`to anon, authenticated` → `to authenticated`) ed è **proprio quella da non fare**: il ripiego ripara un guasto vero, dichiarato nel commento del codice — *«il token grezzo dava 401 quando era scaduto, insert silenziosamente perso»* — e toglierlo lo **ricrea**. ⚖️ Portata di ciò che resta aperto: inserire **spazzatura** in due tabelle di diagnostica, niente lettura e nessun dato del circolo; `pmo_parser_errors` è ferma dal **16/06**, `pmo_ai_turns` dal **13/08**. ✅ Prove: attacco come `anon` **prima e dopo su ognuna**, col **seme** che soddisfa la chiave esterna (senza, a fermarlo sarebbe il vincolo e non l'RLS), e il **controllo negativo**. Linter PROD **99 → 101**, TEST **92 → 95** e **95 → 97**, `WARN` ed `ERROR` invariati ovunque, ogni scarto **previsto e dichiarato prima** di applicare; i nuovi sono tutti `rls_enabled_no_policy` INFO, cioè l'esito voluto. Residui zero. 🧯 **Un errore mio, tenuto perché è il pezzo che insegna**: la prima sonda «dopo» dava `42501` anche sulla RPC legittima e sembrava dire che avessi rotto la strada vera — avevo aggiunto al blocco un `count(*)` che girava ancora come `anon`. **Era la sonda a essere cambiata fra il prima e il dopo**, e stavolta il risultato comodo era quello che mi dava *torto*. ⛔ **Resta fuori, e la voce lo dichiara**: il **TRUNCATE** ad `anon` (14 tabelle su PROD) — riguarda i **grant**, non le policy, e non era ciò che era stato autorizzato. È sceso fra le «nate misurando», dove le promozioni le decide il committente. 🔗 3 migrazioni: `20260814181002`, `20260814191255`, `20260814194040`, tutte reversibili |
| **39** | 🔀 *(14/08, 16ª sessione — promossa da lui)* **Le TABELLE dei due progetti, censite e dichiarate** in [`docs/divergenze-tabelle-test-prod.md`](../divergenze-tabelle-test-prod.md). È il gemello della voce 33, un piano sotto: là le funzioni SQL, qui le tabelle. PROD **25**, TEST **23**, in comune **20**: **17 identiche**, **3 divergenti**. 🎯 **E il censimento ha trovato un guasto vivo in PRODUZIONE, che era il suo scopo:** `pmo_parser_errors` ha 9 colonne su PROD e **14** su TEST, e dalla **PR #648 del 7/08** l'app di `main` **scrive `origine`** a ogni segnalazione e **legge** `stato`, `risolto_il`, `risolto_in_versione`, `nota_risoluzione` per il pannello «Le mie segnalazioni» — colonne che su PROD **non esistono**. Provato sul bersaglio: **`42703`** in lettura, in scrittura e sulle quattro del pannello ⇒ su PROD nessuna segnalazione del parser poteva essere registrata (e falliva in **silenzio**: `console.warn`, `return false`) e quel pannello non poteva caricare. ✅ **Riparato in giornata, strada scelta da lui**: le 5 colonne aggiunte a PROD verbatim da TEST (migrazione `20260814183100`). Prova **end-to-end via PostgREST**, stessa URL e chiave dell'app: **400 `42703` → 200 `[]`**; impronta delle colonne di PROD ora **identica** a quella censita per TEST prima di toccare niente; linter 101 → 101, `ERROR` 0; 45 righe storiche intatte. ⚖️ **Ma non è la causa del silenzio della tabella**, e la misura ha smentito la mia ipotesi: le 45 righe sono **tutte del 16/06**, cioè due mesi **prima** del disallineamento. Sono due fatti distinti, e vanno tenuti distinti. 🔎 **La divergenza che la campionatura non poteva vedere**: `assessment_tokens` ha **13 colonne da entrambe le parti**, ma non le stesse — `member_email` solo su PROD, `updated_at` solo su TEST. Col solo conteggio sarebbe rimasta invisibile: per questo si confronta l'**impronta**. ✅ Confermate le 4 colonne di `self_assessments` già viste il 14/08: la campionatura diceva il vero. 🔗 **Chiude un cerchio della voce 33**: `admin_settings` esiste **solo su PROD**, e su PROD **esattamente una** funzione la nomina (`upsert_assessment_tokens_admin`) mentre su TEST **nessuna** ⇒ non sono «due depositi del PIN in PROD e uno in TEST», è un deposito in più che vive solo di là, con la sua unica lettrice. ⛔ **Non misurati, e il documento lo dichiara**: indici, vincoli, default, trigger, policy e contenuti — due tabelle qui dette «identiche» possono avere trigger diversi, ed è successo davvero con quello che ha avuto un ruolo nella voce 37 |
| **36** | 🔎 *(14/08, 15ª sessione — promossa da lui)* **Le 45 funzioni `SECURITY DEFINER` chiamabili da `anon` su PROD, passate in rassegna. Undici erano aperte.** Nata dalla 27, che ne aveva scoperte due. 🚨 **La prima classificazione era sbagliata, ed è il pezzo che vale più delle funzioni chiuse**: avevo diviso in «24 che scrivono / 21 che leggono» cercando `insert|update|delete` nel sorgente — ma **far partire una chiamata HTTP non è una scrittura SQL**, e sette `pmo_dispatch_*` stavano fra le «letture» mentre fanno `net.http_post`. Ne avevo chiusa **una su otto** credendo di aver chiuso la famiglia. ⇒ Una funzione si classifica per **cosa provoca**, non per quali parole contiene. 🎯 E il pezzo peggiore non scriveva né chiamava nessuno: **`pmo_verify_data_routine_secret(text)`**, che confronta un candidato col segreto nel vault e risponde sì/no ⇒ da `anon` è un **oracolo a tentativi illimitati** sul segreto che autorizza tutte le routine; con quello in mano le edge si chiamano dritte. Non sarebbe comparso in nessun elenco di «funzioni che scrivono», per costruzione. 🔴 **Chiuse 11**: i **7 dispatcher** (pagamenti ×2, portafoglio, contatti Google, maestri, avvisi autovalutazione, lessico AI), **`pmo_dispatch_data_routines`** (faceva partire la catena dei cron, `p_now` a scelta del chiamante), **`pmo_cleanup_dispatch_logs`** (`DELETE` senza guardia: con `0` cancellava **1457** righe di storia dei dispatch), **`pmo_audit_admin`** (falsificava il registro di controllo — provato come `anon`: scritta «`presidente@padelvillage.club` · `owner` · `staff_delete_full`») e l'**oracolo**. ✅ **Guardate e a posto**: tutta la famiglia `*_admin` risponde **`AUTH_REQUIRED`** — provata come `anon`, non dedotta — più `INVALID_ORIGIN` e i cancelli a gettone. ⚪ **Aperta per disegno**: `pmo_can_register_staff`, oracolo di enumerazione ma chiamata dalla schermata di **registrazione**, dove nessuno è ancora autenticato. 🔀 **Su TEST due erano già chiuse e su PROD no**: è la **voce 31 al contrario**, e sul resto della famiglia TEST era un rattoppo a campione senza criterio. 🚨 **Trappola `service_role`, incontrata TRE volte oggi**: su PROD i grant sono espliciti e il `revoke ... from public` non li tocca, su TEST spesso passano da PUBLIC ⇒ la stessa revoca glieli toglie. Su TEST si rimisura **dopo**, contro la fotografia presa **prima** — non contro PROD. ✅ Linter di PROD, quattro fotografie diffate: **123 → 125 → 121 → 99**, `WARN` 109 → **83**, `ERROR` **0** sempre; spariti 26 avvisi, esattamente 13 funzioni × 2 ruoli, **nessuno nuovo**. ⛔ **Non esaminate**: 3 letture per gettone e la robustezza del PIN. 🔗 4 migrazioni `2026081416*` |
| **27** | 🔒 *(14/08, 15ª sessione)* **Il cancello dell'autovalutazione è chiuso davvero — e la prima chiusura non bastava.** Punto 1 fatto **da lui**: scheda vera compilata su `app.padelvillage.club` col gettone `TEST456`, quiz 3/4 con la trappola indovinata (soglia **3** ⇒ `pass`), riga con `corretta_dal_server: true`, gettone bruciato dall'edge **0,15 secondi dopo**. ⭐ È quella riga a dimostrare che PROD serve la **6.220**, non l'etichetta della scheda: la 6.219 scriveva da sé con la chiave pubblicabile e non avrebbe potuto scrivere quel campo. ⇒ Poi il **passo 4**: tolte le **4** policy di scrittura anonima (3 di INSERT su `self_assessments` + `public_update_token_completed` su `assessment_tokens`, che la scheda non nominava). ✅ Verificato: `anon` → **42501**, `service_role` → scrive. 🚨 **E lì sembrava finita, e non lo era.** Facendo il rito «cosa punta a questa riga» prima di togliere la scheda di prova, è saltata fuori **`submit_self_assessment_public`**: `SECURITY DEFINER`, eseguibile da `anon`, **scavalca l'RLS per costruzione** e prende `staff_status` dal payload — se manca resta **vuoto**, cioè lo stato in cui `apply-level` applica da sé. Provato come `anon` in transazione annullata: livello **7** scritto, segreteria vuota, nessun `knowledge` ⇒ in `decidi()` il controllo sul quiz **non viene proprio fatto**. Le policy non la riguardavano nemmeno. ⇒ `EXECUTE` revocato a `public`/`anon`/`authenticated` su **PROD e TEST** (là il passo 4 era stato dichiarato completo il 14/08 con una verifica **giusta e insufficiente**: guardava l'RLS). `service_role` conserva l'esecuzione — su TEST è stato rimesso con una migrazione di parità, perché là il grant non era esplicito. ✅ `anon` → **42501 permission denied**; linter **125 → 121** avvisi, `WARN` 109 → **105**, `ERROR` **0**, spariti esattamente i 4 attesi e **nessuno nuovo**. ⚪ `get_self_assessments_by_tokens` non toccata: è lettura e l'app la usa (`index.html:30062`). 🧹 Residuo della prova ripulito: scheda tolta (salvata per intero nel commit) e `TEST456` riarmato a `created`. 🔗 3 migrazioni `2026081416*` |
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
> **Una funzione si classifica per COSA PROVOCA, non per quali parole contiene.** *(14/08,
> voce 36)* Per passare in rassegna 45 funzioni le ho divise in «scrivono» e «leggono»
> cercando `insert|update|delete` nel sorgente. Sembrava rigoroso ed era un setaccio a maglie
> larghe: **far partire una chiamata HTTP non è una scrittura SQL**, e sette `pmo_dispatch_*`
> sono finite fra le «letture» mentre fanno `net.http_post` verso le edge. Avevo chiuso una
> funzione su otto della stessa famiglia **credendo di aver chiuso la famiglia**, che è la
> forma peggiore dell'errore: non lascia un buco, lascia un buco e la convinzione di averlo
> tappato. ⇒ Un classificatore per parole chiave è un punto di partenza, **mai** una misura.
>
> **Il pezzo peggiore non scriveva niente.** *(14/08)* `pmo_verify_data_routine_secret`
> confronta un candidato col segreto nel vault e risponde sì/no: da `anon` è un oracolo a
> tentativi illimitati sulla chiave che autorizza tutte le routine. Non scrive, non chiama
> nessuno, non compare in nessun elenco di «funzioni pericolose» — e con quello in mano ogni
> altro cancello è aggirato. ⇒ Cercare *chi fa danno* non basta: va cercato anche **chi dice
> qualcosa che non dovrebbe dire**.
>
> **Un avviso ripetuto 47 volte non è un avviso.** *(14/08)* Tutte e 13 le funzioni chiuse
> oggi erano già nel linter, sotto due titoli soli — `anon_security_definer_function_executable`
> e il gemello per `authenticated` — insieme ad altre decine identiche. Nessuno le aveva mai
> lette una per una, ed è ragionevole: 47 righe uguali sono rumore. ⇒ Un avviso che non si
> può **contare fino a zero** smette di essere letto. Il diff prima/dopo funziona solo perché
> si sa già cosa cercare.
>
> **Su TEST i permessi passano da PUBLIC, su PROD sono espliciti.** *(14/08, tre volte nella
> stessa sessione)* Ogni `revoke ... from public` su `cudi…` ha tolto a `service_role` un
> permesso che su `qqbf…` sopravviveva, perché lì il grant è esplicito in ACL. ⇒ Su TEST si
> rimisura **dopo ogni revoca**, e ci si confronta con la fotografia presa **prima** — non con
> PROD: `pmo_dispatch_assessment_apply_level` aveva già `false` da prima, e "ripristinarlo"
> sarebbe stato un cambiamento travestito da ripristino.
>
> **`SECURITY DEFINER` scavalca l'RLS: chiudere le policy non chiude la porta.** *(14/08, 15ª
> sessione)* Tolte le 4 policy di scrittura anonima su `self_assessments`, la verifica è stata
> fatta come si deve — `anon` → `42501`, `service_role` → scrive, linter diffato voce per voce — e
> **sembrava finita**. Non lo era: `submit_self_assessment_public` è `SECURITY DEFINER`, gira come
> proprietario e l'RLS non la riguarda. Prende `staff_status` dal payload e, se manca, lo lascia
> vuoto: livello 7 scritto da `anon` in tre righe di SQL, e `apply-level` l'avrebbe applicato in 15
> minuti. ⭐⭐ Il punto non è che mancava una verifica: le verifiche c'erano ed erano giuste. È che
> **erano tutte sullo stesso strato**. Chi chiude una porta deve chiedersi *quante ne esistono di
> quel tipo*, non *se quella è chiusa bene*. ⇒ E la stessa svista stava su TEST, dove il passo 4
> era stato dichiarato completo il giorno prima con la medesima verifica corretta e parziale.
>
> **Il rito «cosa punta a questa riga» trova cose che non c'entrano con la riga.** *(14/08)* La
> seconda porta non l'ha trovata un controllo di sicurezza: è saltata fuori mentre misuravo chi
> puntasse alla **scheda di prova da cancellare**, e la risposta conteneva tre funzioni con
> `self_assessments` dentro. Il rito serve a non fare danni cancellando; qui ha trovato il lavoro
> vero, come già il 14/08 con la voce 22. ⇒ Vale la pena farlo **anche quando si è certi** che
> nulla punti lì: il valore non è la risposta, è l'inventario che si è costretti a guardare.
>
> **Un controllo negativo mal fatto assolve l'imputato.** *(14/08)* Per provare che la 4ª policy
> fosse davvero pericolosa l'ho rimessa in una transazione annullata e ho rilanciato l'attacco:
> **0 righe**. Sembrava la smentita del mio stesso allarme. Era invece il mio controllo a essere
> sbagliato — avevo scritto un `where`, che legge una colonna, e la lettura è chiusa dal 12/08.
> Senza `where`: **1364 righe su 1364**. ⇒ Quando la prova ti dà ragione *troppo comodamente*, o
> torto troppo comodamente, la prima cosa da controllare è la prova.
>
> **Il linter lo diceva da sempre, in mezzo a 47 uguali.** *(14/08)* Le due funzioni scavalcabili
> erano già negli avvisi come `anon_security_definer_function_executable` — insieme ad altre 45
> con lo stesso identico titolo. Un avviso ripetuto 47 volte non è un avviso: è rumore, e il
> rumore lo si smette di leggere. ⇒ Il diff prima/dopo le ha fatte vedere in mezzo secondo, ma
> solo perché **si sapeva già cosa cercare**.
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

<sub>Aggiornato il 14/08/2026 a fine **17ª sessione**, la quinta dello stesso giorno. Chiuse **due**
voci, la **37** e la **38**, e nessuna promossa: le urgenti scendono da 3 a **1**. La sessione è partita trovando `docs/`
disallineato e `guard-worker-sync` **rossa** su `test-preview` — la 16ª aveva spinto la propria
chiusura là e non l'aveva portata su `main` — e la prima cosa fatta è stata sanare quello. La **37** è stata prima
sanata e poi chiusa: tolto il residuo che la 16ª si era auto-denunciata — le 3 policy della famiglia
feedback su TEST, dove però la misura ha smentito l'aspettativa mostrandole **portanti** e non
decorative — con prova d'attacco a sonda identica prima e dopo, previsione del linter dichiarata
prima (95 → 97) e zero residui. Le **due portanti** restano, e la voce si chiude **dichiarandole**:
misurando il codice è saltato fuori che la «riga di SQL» esiste (`to anon, authenticated` →
`to authenticated`) e che è **proprio quella da non fare**, perché il ripiego ad `anon` ripara un
guasto dichiarato nel commento del codice e toglierlo lo ricrea. ⇒ La scheda diceva «è lavoro, non
una riga di SQL»: la misura ha smentito anche quello, e nel verso che conta — non è che il lavoro
sia più piccolo, è che la scorciatoia sarebbe **un passo indietro**. Il `TRUNCATE` ad `anon` non è
sparito con la voce: è sceso fra le «nate misurando», perché le promozioni le decide lui. Della **38** è stata smentita la misura della 16ª: i 404 **non si sono mai
fermati**, ne arrivava uno al minuto ancora alle 19:31 da una scheda aperta col codice vecchio, e
il disarmo — verificato sul file **servito**, sul `return` e non sul commento — è giusto: la prova
che manca è un **ricaricamento**, non un'attesa. Della **23** è stata scritta la diagnosi e **non**
la patch, per sua decisione: la scheda sbagliava bersaglio (è nella edge, non nell'app), i due rami
divergono, e la correzione tocca la strada che prenota davvero, non verificabile dal cloud.
📌 Quanto segue è la chiusura della **16ª**, lasciata come l'ha scritta:</sub>

<sub>Aggiornato il 14/08/2026 a fine **16ª sessione**, la quarta dello stesso giorno. La lista urgenti era **vuota**: le quattro promozioni le ha decise il committente, su proposta fatta a misura già presa. Chiusa **una sola** voce, la **39** — il censimento delle tabelle dei due progetti — perché è l'unica verificata sul bersaglio fino in fondo. La **38** è chiusa, e la sua storia vale più del suo contenuto: quattro prove false in due giorni prima di poterci credere, e la quarta era la smentita della terza. A chiuderla non è stata una sonda più fine ma **lui che ha ricaricato le due schede alle 19:57** — dopodiché i 404 sono spariti *mentre l'app continuava a chiamare*, che è il controllo positivo che mancava a tutte le prove precedenti. La **37** resta aperta con un residuo che è colpa mia: la famiglia del feedback è chiusa su PROD e **ancora aperta su TEST**, perché l'autorizzazione diceva «PROD» e l'ho eseguita alla lettera — giusto rispetto al mandato, sbagliato rispetto al sistema, ed è la voce 31 in diretta. La **23** non è stata toccata: metà del suo lavoro vuole i log del worker su Hetzner. Versioni, sha, PR aperte, linter dei due progetti e tutti e otto i conteggi **rimisurati alla chiusura**, non ricordati; PROD verificato **dal server** con `pg_net`, non dall'etichetta. La sessione girava dal cloud: VM, worker, `.env`, secret, ponti e memoria dell'app non sono stati misurati — e con loro **il gestionale col login staff**, che stavolta pesa il doppio, perché il disarmo cambia proprio ciò che lo staff vede. I conteggi di questo file e le versioni dichiarate nei registri sono verificati dalla CI (`guard-docs-truth.yml`); la parità fra i rami da `guard-worker-sync.yml`. Le promozioni dalla coda alle urgenti le decide il committente.</sub>
