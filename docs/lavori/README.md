# Padel Match Organizer — i lavori

**Fotografia del 13/08/2026, a fine 12ª sessione.** Misurata, non ricordata.

🔄 **Ripresa in serata, stesso giorno** (PR #680→#686): rimisurati **sha, versioni, PR aperte e
conteggi**, **chiusa la voce 30** e poi **estesa la guardia dei conteggi alle chiuse** (#686).
Tutto il resto — i cron e il blocco «verificato sul bersaglio» — è la misura della 12ª sessione
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
| 📦 **Chiuse** | **8** il 13/08 + ~56 dal 7/08 + ~41 fino al 6/08 |

**Stato del sistema:** app PROD **6.219** · TEST **6.222** · gestionale `main` `d0ba40e`,
`test-preview` `f33c678`, alberi puliti · **0 PR aperte** · cron PROD **11 accesi / 2 spenti**,
TEST 5 accesi / 4 spenti · `server.mjs`, `.github/workflows/**`, `CLAUDE.md` e **tutto `docs/`**
**identici** fra i rami — e da oggi **non per diligenza, ma perché la CI lo impone**.

⚠️ Le versioni **non si sono mosse** in tutta la serata: dalla #680 alla #686 era CI e
documentazione, nessun file dell'app toccato. Gli sha sì, **sette volte prima di questa riga** — ed è il motivo per cui
**non** sono sorvegliati: un file che cita il proprio sha è vecchio nell'istante in cui lo si salva,
e riallinearlo ne aggiunge un altro. Quelli qui sopra saranno vecchi appena questa riga è committata.

⚠️ **PROD e TEST non sono più adiacenti**: 3 di distanza, non 1. Il *contenuto* è equivalente —
TEST bumpa a ogni passo (6.219→6.222), PROD una volta per promozione (6.218, 6.219). Non è drift,
ma la regola dell'adiacenza non regge più come indicatore.

**Verificato sul bersaglio il 13/08**, non dedotto dal repo:
- ✅ `app.padelvillage.club` serve **v6.219** (confermato dal committente sullo schermo)
- ✅ la edge in servizio su PROD contiene davvero `ALLOWED_ACTIONS = ['config-check','gmail-check','staff_invite','staff_delete_full']` e il 410 sul canale ritirato — letta da Supabase
- ✅ `main` su `raw.githubusercontent` espone 6.219
- ✅ `soci.padelvillage.club` **non risolve più**; `ayly…` ha **ZERO edge function**

> ⚠️ **Non misurati il 13/08**, e da non dare per buoni: la VM (worker e i due bot, riavvii),
> il `.env` dei soci e i suoi interruttori, la whitelist, i ponti. Dalla sessione cloud manca
> l'accesso a Hetzner.

---

## 🔴 URGENTI — 1

### 🧹 22. Ripulire le righe di prova su TEST
Promossa da lui l'11/08. **Misurata il 14/08 sul bersaglio** — e la misura ha ribaltato il primo punto.
Nessuna fa danno: sono **rumore che sporca le prove future**.

| cosa | dove | misurato il 14/08 |
|---|---|---|
| ~~partita **9305** del 13/08 con **Manuel Casagrande**~~ | TEST | ⛔ **non è una riga di prova** — vedi il riquadro qui sotto. **In attesa di sua decisione** |
| partita di prova **14/08 12:30 C4** + le **4** righe `staff_edit` | TEST | ✅ nate in prova e **marchiate**: `nata_in_prova: true`, `ambiente: "prova"`, `simulato: true`, autore `consumer-assistente-soci`. Si tolgono |
| **Lidia Comes nella whitelist di `test`** | `ayly…` | ✅ `telegram_operatori`, riga `ambiente='test'` del **10/08** (non 7/08), `persona_id matchpoint_49efs2`. La gemella `ambiente='prod'` del 9/08 **resta** |
| socio di prova `matchpoint_n29tlt` a **1,5** + scheda `applied` | TEST | ⚠️ **non è un socio di prova**: è **Maurizio Aprea, `000004`**, socio vero usato come cavia. Il livello **è già tornato a 4**; resta solo la scheda `self_assessments` token `ITBAOQWO8CB5KU`, `applied` l'11/08 |

> 🚨 **Il primo punto esce dalla voce: è un dato del circolo, non rumore.** La scheda cita «9305 del
> 13/08», ma sono **due** partite diverse e **nessuna** delle due è nata da una prova:
>
> | | su TEST | su PROD |
> |---|---|---|
> | **9305** — 11/08 09:30 C2 | viva (`deleted=false`) | **c'è**, disdetta l'11/08 alle 07:17 |
> | **9306** — 13/08 09:30 C2 | Aprea + Casagrande, ferma al 07/08 | **viva, 4 giocatori** (De Luca, Spinazzè, Aprea, Ruzzini); Casagrande tolto l'11/08 alle 18:02 |
>
> Su TEST entrambe portano `created_at = updated_at = 2026-08-07 09:31:31` — lo **stesso istante**
> di 9272, 9273, 9274, 9278, 9293, 9317: è un **lotto di sync da Matchpoint**, non una prova.
> ⇒ Applicata la regola scritta nella voce stessa (*«se una di queste risultasse anche su PROD, ci
> si ferma e si chiede»*): **fermato**.

- ⚠️ Il mirror delle 05:00 rifà l'anagrafica, **non queste**: quello che è fuori dall'anagrafica resta finché non lo si toglie a mano.
- 🚨 **Il rito**: prima di togliere si **misura cosa punta a quella riga** e lo si dice — lezione dell'Ospite, dove «elimina tutto» avrebbe buttato **€ 7.937** di incassi.
- ⚖️ **Si tocca solo TEST.** Se una di queste risultasse anche su PROD, ci si **ferma** e si chiede: là non è rumore di prova, è un dato del circolo. **Il 14/08 è successo**, ed è la prima volta che la clausola scatta.
- 📌 Una delle 4 `staff_edit` punta a `idReserva 9306`, **prenotazione vera**: la riga è un'annotazione nata in prova (`simulato: true`, su Matchpoint non è successo nulla) e togliendola **la partita non si tocca**.

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

- 🧊 **Su TEST lo specchio delle prenotazioni è fermo dal 7 agosto.** Tutte e **2721** le `booking` e
  tutte e **2151** le `booking_occupancy` portano lo **stesso** `updated_at`: `2026-08-07 09:31:31`.
  `booking_history` è ferma al **02/08**. Intanto sullo stesso database `member` è viva (13/08 05:00,
  il mirror) e `payment` pure (13/08 21:23) — e su PROD **tutto** è vivo (13/08 21:47).
  ⇒ La divergenza che la voce 22 attribuiva a una prova è invece **lo specchio che non gira**:
  togliere quelle righe non pulirebbe nulla, ne resterebbero **2719** altrettanto vecchie.
  🔗 Spiega da sé anche la **voce 26** («il Fatto del togli non si vede»: su TEST non c'è nessun sync
  che riconcili) e avvelena **ogni prova futura sul calendario**, che è poi lo scopo della voce 22.
- 🔢 `payment` su TEST ha **2503** righe contro le **2502** di PROD: una in più, non guardata.

---

## 📦 CHIUSE — 13/08/2026 — 8 voci

Le prime 6 nella 12ª sessione, la **30** e l'ultima in serata.

| voce | cosa |
|---|---|
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
