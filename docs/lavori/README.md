# Padel Match Organizer — i lavori

**Fotografia del 14/08/2026, 13ª sessione.** Misurata, non ricordata.

🔎 **La 13ª sessione ha misurato prima di eseguire, e la misura ha smentito la scheda.** La voce 22
elencava quattro «righe di prova» da togliere su TEST: tre lo erano e sono state tolte, **la quarta
no** — era una prenotazione vera del circolo, presente anche su PROD. Da lì è uscita la **voce 32**,
promossa da lui a urgente: su TEST lo **specchio delle prenotazioni è fermo dal 7 agosto**.

⚠️ **È la prima volta che scatta la clausola** *«se risulta anche su PROD, fermati e chiedi»*, scritta
nella voce 22 mesi prima da chi non sapeva che sarebbe servita. Ha funzionato perché qualcuno ha
**misurato invece di fidarsi**: la scheda diceva «partita 9305 del 13/08», e di quella riga erano
sbagliati **il numero, la data e la natura**. Da qui la riga nuova nel prompt di apertura — *la scheda
di un lavoro è un'ipotesi, non una misura* — e i due prompt finalmente **scritti nel repo**.

🔄 Il resto — cron, versioni, il blocco «verificato sul bersaglio» — è la misura del **13/08**
e **non è stato ricontrollato**.

⬆️➡️✅ **Voce 30: nata, promossa e chiusa nello stesso giorno.** Unica finora. Nata in coda la
mattina, **promossa alle urgenti dal committente**, chiusa in serata con **due** guardie — non una:

| | | |
|---|---|---|
| **parità** | `guard-worker-sync` esteso a `docs/` | #683 |
| **verità** | `guard-docs-truth.yml`, dichiarato vs misurato | #684 |

⇒ coda 16→**15**, urgenti 2→**1**. 🚨 **Sono legate: si tolgono insieme o mai.** La parità non vede
la *menzogna concorde*, la verità controlla una copia sola e non protegge l'altro ramo.

🔢 **Perché ne servivano due, misurato non ipotizzato.** Rifacendo i conteggi a mano: la sezione **C**
ne dichiarava 11 con 12 voci, la **D** 5 con 4 righe. I due errori si **annullavano** e il totale 16
tornava — **nessuna guardia di parità li avrebbe presi**, erano sbagliati uguali su entrambi i rami.
E `stato-progetto-corrente.md`, curato la mattina dalla #674 dopo tre mesi a v5.527, **la sera
dichiarava già 6.216/6.217 contro 6.219/6.222 reali**: da solo non resta vero. Ora la CI verifica
entrambe le cose, **ogni numero per conto suo** e non solo la somma.

| | |
|---|---|
| 🔴 **Urgenti** | **1** |
| 📋 **In coda** | **15** |
| 📦 **Chiuse** | **9** il 13–14/08 + ~56 dal 7/08 + ~41 fino al 6/08 |

**Stato del sistema:** app PROD **6.219** · TEST **6.222** · gestionale `main` `908c5d2`,
`test-preview` `ec8bc72`, alberi puliti · **0 PR aperte** · cron PROD **11 accesi / 2 spenti**,
TEST 5 accesi / 4 spenti (misura del 13/08, non ricontrollata) · `server.mjs`,
`.github/workflows/**`, `CLAUDE.md` e **tutto `docs/`** **identici** fra i rami — e non per
diligenza, ma perché la CI lo impone.

⚠️ Le versioni **non si sono mosse** né il 13/08 in serata né il 14/08: da #680 in poi è CI,
documentazione e **dati**, nessun file dell'app toccato. Gli sha sì, ed è il motivo per cui
**non** sono sorvegliati: un file che cita il proprio sha è vecchio nell'istante in cui lo si salva,
e riallinearlo ne aggiunge un altro. Quelli qui sopra saranno vecchi appena questa riga è committata.

🖐️ **La 13ª sessione ha scritto sui dati, non sul codice**: 5 righe a `deleted=true` e 1 a
`attivo=false` (reversibili), 3 righe rimosse su TEST. **Nessuna scrittura su PROD**, solo `SELECT`.

⚠️ **PROD e TEST non sono più adiacenti**: 3 di distanza, non 1. Il *contenuto* è equivalente —
TEST bumpa a ogni passo (6.219→6.222), PROD una volta per promozione (6.218, 6.219). Non è drift,
ma la regola dell'adiacenza non regge più come indicatore.

**Verificato sul bersaglio il 13/08**, non dedotto dal repo:
- ✅ `app.padelvillage.club` serve **v6.219** (confermato dal committente sullo schermo)
- ✅ la edge in servizio su PROD contiene davvero `ALLOWED_ACTIONS = ['config-check','gmail-check','staff_invite','staff_delete_full']` e il 410 sul canale ritirato — letta da Supabase
- ✅ `main` su `raw.githubusercontent` espone 6.219
- ✅ `soci.padelvillage.club` **non risolve più**; `ayly…` ha **ZERO edge function**

**Misurato il 14/08**, dal cloud:
- ✅ la **whitelist** su `ayly…` (`telegram_operatori`, 5 righe): non era più da dare per buona, ora lo è
- ✅ lo stato delle prenotazioni su TEST **e** su PROD ⇒ voce 32
- ✅ 9305 e 9306 su **entrambi** i database, prima di toccare qualsiasi cosa

> ⚠️ **Ancora non misurati**, e da non dare per buoni: la VM (worker e i due bot, riavvii), il
> `.env` dei soci e i suoi interruttori, i ponti, i cron. Dalla sessione cloud manca l'accesso
> a Hetzner.

---

## 🔴 URGENTI — 1

### 🧊 32. Su TEST le PRENOTAZIONI non le aggiorna nessuno — e non è mai successo
*Nata misurando la voce 22 il 14/08, **promossa da lui** lo stesso giorno. Diagnosi chiusa in
giornata; **la decisione è sua** e non è stata presa.* È la **causa** di cui la 22 vedeva un sintomo.

⚠️ **Il titolo di stamattina diceva «fermo dal 7 agosto»: era sbagliato.** Su TEST le prenotazioni
non sono **mai** state aggiornate da un cron. Il 7/08 è solo l'ultima volta che qualcuno ha lanciato
l'import **a mano** — non c'è nessun `data_routine_dispatch_*` che gli corrisponda.

| tabella su TEST | righe | ultimo tocco |
|---|---|---|
| `booking` | 2721 | **`2026-08-07 09:31:31`** — tutte, allo stesso istante |
| `booking_occupancy` | 2151 | **`2026-08-07 09:31:31`** — tutte |
| `booking_history` | 2964 | `2026-08-02 08:41` |
| `member` | 2919 | 13/08 05:00 ✅ (`anagrafica-mirror`, jobid 14, acceso) |
| `payment` | 2503 | 13/08 21:23 ✅ (jobid 11, acceso) |

**La prova che chiude il caso:** righe `data_routine_dispatch_bookings_live_*` — su TEST **0 in tutta
la storia del database**, su PROD **1575**, l'ultima il 13/08 alle 22:02 con l'import 39 secondi dopo.

#### Tre disallineamenti sovrapposti, ognuno da solo sufficiente

| | su TEST | su PROD |
|---|---|---|
| ① **il cron** | `pmo-data-routines-clients-nightly-test` (jobid 13) — **spento**, e non gira dal 3/08 | `pmo-data-routines-dispatcher-prod` (jobid 6), `*/2 * * * *`, **acceso** |
| ② **come lo chiama** | `pmo_dispatch_data_routines(<oggi 04:30>)` — l'ora **inchiodata** manda sempre al ramo `clients_0430`: le prenotazioni non le raggiunge **mai**, nemmeno da acceso | `pmo_dispatch_data_routines()` senza argomento ⇒ `now()` |
| ③ **la funzione** | versione **vecchia**: slot fissi, prenotazioni 5 volte al giorno (05:30, 10:30, 14:30, 17:30, 21:30). Impronta `1609186e…` | versione **nuova**: gli slot fissi solo per i clienti, più un ramo `else` che fa `bookings_live` **a ogni giro** con anti-sovrapposizione a 150 s. Impronta `e38984df…` |

✅ L'edge `matchpoint-bookings-sync` **c'è ed è ACTIVE su TEST** (v70): il pezzo che manca è solo
la **pianificazione**, non il motore.

🚨 **Perché è urgente e non cosmetica**: ogni prova su TEST che tocchi il calendario parte da una
fotografia vecchia. Le partite non sono quelle vere, le disdette non arrivano, i roster restano come
erano. Una prova su dati fermi **non dimostra niente, e sembra dimostrare**.

🔗 **Spiega da sé la voce 26** («il "Fatto" del togli non si vede»): su TEST non c'è nessun sync che
riconcili, quindi la riga non sparisce mai. In PROD si auto-corregge in ~2 minuti — **con lo stesso
codice**. Non era un guasto del bot, e la 26 si chiude con questa.

#### ⚖️ La decisione, che è sua

🚨 **Accendere non è gratis: il worker è UNO SOLO, condiviso TEST+PROD.** Portare TEST al ritmo di
PROD (`*/2`) **raddoppia** il carico sul worker vero e i login su Matchpoint. È **lettura**, quindi
non sporca il Matchpoint del circolo — ma il costo ricade su PROD, non su TEST.

| strada | cosa comporta |
|---|---|
| **A — allineare** | portare ③ alla versione di PROD, correggere ② togliendo l'argomento, accendere ①. ⚠️ Da valutare a ritmo **ridotto** (non `*/2`): serve freschezza, non parità |
| **B — congelare** | lasciare com'è e **dichiararlo in `CLAUDE.md`**: «su TEST il calendario è una fotografia, non provarci sopra nulla che dipenda dalle prenotazioni» |

⚖️ Sono opposte ma **entrambe oneste**. Quella di oggi — un TEST che sembra vivo e non lo è — non lo è.

---

## 📋 IN CODA — 15

Le sezioni **A** (cose sue già decise), **B** (lavoretti minuti) ed **E** (manutenzione memoria) sono **vuote**.

### C — Cose sapute e non risolte — 11

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

#### 24. 🔴 Il raddoppio dell'ultimo avviso di disdetta è SPENTO
Il codice c'è e la colonna `finale_bis` è stata aggiunta su `ayly…` il 6/08, ma la chiave `disdetta.avvisi_ore_prima_scadenza_bis` **non è in kb**, né PROD né TEST. ⚖️ **Accenderlo è una sua decisione**: significa **due** solleciti invece di uno.

#### 26. 🔴 Il «Fatto» del togli non si vede
Trovato provando l'`A6`: il bot dice di aver tolto il giocatore, ma **la riga non sparisce** dalla scheda. La forma del dato è **identica in PROD**; là si auto-corregge in ~2 minuti col sync, in prova mai. ⇒ Non è un guasto del bot: è la **terza forma del roster** che diverge fra le due copie.

#### 🧟 28. Le ~60 funzioni dei pannelli email rimossi restano nel file
*Nata il 13/08.* Tolti i 5 pannelli (PR #677), le funzioni che li disegnavano sono rimaste: scrivono in `getElementById` che ora dà `null`, e cominciano tutte con `if (!box) return;` ⇒ **no-op, irraggiungibili**. Lasciate di proposito: asportarle è una potatura da provare per bene. Il perché è scritto nel commento HTML nel punto dove stavano i pannelli.

#### 🧟 29. Le azioni email restano dentro `assessment-email-send`
*Nata il 13/08.* `sendAssessmentEmailCore` e le sue compagne ci sono ancora, ma `ALLOWED_ACTIONS` non le ammette più e rispondono **410**. Riaccenderle = rimetterle nell'elenco.
🚨 La funzione **non si cancella** e i secret Gmail **non si tolgono**: vedi la memoria tematica Gmail.

#### ⚠️ 31. La sicura dei bottoni Matchpoint stava solo su TEST
*Nata il 13/08.* Chiusa di fatto (banco rimosso, PR #678), ma **il pattern resta**: la sicura fu scritta su TEST il 3/08 dopo un clic per sbaglio, e **mai promossa** ⇒ per dieci giorni in PROD gli stessi bottoni sono rimasti **senza**. È il caso da manuale per cui esiste la regola anti-disallineamento. Da decidere se cercarne altri della stessa forma.

### D — Corpose: solo se si vogliono ATTIVARE — 4

| # | cosa |
|---|---|
| **15** | 🎾 **Card «Partita aperta · 0/4»** sul calendario staff — oggi appare come partita normale col solo intestatario, irriconoscibile. Piccola, prima su TEST |
| **16** | 💰 **Storno/cobro PARTITA** — flag OFF mai validati; validare in TEST prima di qualsiasi attivazione |
| **17** | 🔐 **Consumer: hook Auth «Customize Access Token»** — senza, l'RLS nega in silenzio. Rilevante **solo** quando si riprende l'app soci (0 utenti veri oggi) |
| **18** | 📣 **Pannello avvisi nel gestionale** (lo staff vede cosa il bot ha mandato ai soci). 🚨 Stesso nodo del pannello autorizzazioni ⇒ **si disegnano insieme** |

---

## 🆕 Nate misurando, **non** ancora in coda

Misurando il **12/08**:

- 🔓 Su **TEST** ci sono policy `ALL` (lettura **e scrittura**) per anonimo su `pmo_bookings`, `pmo_parse_history`, `pmo_parser_rules_versions`. Su PROD no.
- 🔓 Su PROD altre **tre tabelle** accettano inserimenti anonimi (`pmo_ai_turns`, `pmo_parser_errors`, `post_match_feedback_responses`): non guardate.

Misurando il **14/08**, aprendo la voce 22:

- 🧊 Lo specchio delle prenotazioni di TEST fermo dal 7/08 → **promossa da lui a urgente: è la voce 32.**
- 🔢 `payment` su TEST ha **2503** righe contro le **2502** di PROD: una in più, non guardata.

---

## 📦 CHIUSE — 13 e 14/08/2026 — 9 voci

⚠️ **Una sola sezione datata per volta.** `guard-docs-truth` conta le righe di **tutte** le
intestazioni `CHIUSE —` ma legge il numero della **prima**: due blocchi datati affiancati dichiarano
1 e ne contano 9, e la guardia fallisce. Chi chiude in un giorno nuovo **allarga la data di questa**,
non ne apre un'altra sotto.

**La prima voce è del 14/08; le otto successive del 13/08.**

| voce | cosa |
|---|---|
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

<sub>Generato il 13/08/2026 a fine 12ª sessione; ripreso in serata (PR #680→#684) per rimisurare sha, versioni, PR aperte e conteggi e per chiudere la voce 30. Stato misurato, non ricordato. I conteggi di questo file e le versioni dichiarate nei registri sono ora verificati dalla CI (`guard-docs-truth.yml`). Le promozioni dalla coda alle urgenti le decide il committente.</sub>
