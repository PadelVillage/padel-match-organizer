# Autovalutazione - invio automatico email

Stato: mockup approvato; prima integrazione UI in TEST `index.html` v5.375, rifiniture UI fino a v5.382; prima funzione backend Gmail TEST predisposta in v5.383 per prova invio su email staff, con segreti Gmail solo lato Supabase; ricerca completa nella coda `Da inviare 0.5` integrata in v5.384; email HTML e log invio piu robusto in TEST v5.385; area alta Autovalutazione piu compatta e ricerca con rimando alla sottosezione corretta in TEST v5.386; reinvio email manuale e scheda pubblica come pannello dedicato in TEST v5.387; tab operative riordinate in TEST v5.388; testi email e impaginazione bottone aggiornati in TEST v5.389; bottone WhatsApp segreteria e testo fallback link rifiniti in TEST v5.390; stato controllo scheda reso automatico e leggibile in TEST v5.391; storico e conferma livello via email chiariti in TEST v5.392; chiusura automatica delle schede coerenti post-invio integrata in TEST v5.393; controlli dati e ripristino livello validato integrati in TEST v5.394; testo assistenza staff/LoZio nel primo invio email integrato in TEST v5.395; indicatori testata compattati con conteggio `senza email` in TEST v5.396; barra schede separata tra processi operativi e consultazione in TEST v5.397; bottone `Apri WhatsApp` aggiunto a scheda socio e storico in TEST v5.398; barra alta Autovalutazione rimossa e tab compatte con conteggi integrate in TEST v5.400; lettura Gmail di risposte e mancate consegne e WhatsApp precompilato dalle email integrati in TEST v5.401; regola a tre invii email integrata in TEST v5.402; visibilita delle risposte Gmail agganciate chiarita in TEST v5.403; risposte email rese visibili anche nello Storico in TEST v5.404; scheda lettura risposte e sospensione solleciti su risposta email integrate in TEST/PROD v5.405; storico compatto e filtri aggiornati in TEST/PROD v5.406; `Stato invio` compattato come cruscotto operativo in TEST/PROD v5.407; pubblicata in PROD dentro `index.html` v5.408 con `assessment-email-send` v12 TEST / v1 PROD e `verify_jwt=true`; tab `Matchpoint` integrata in TEST v5.409 per tenere traccia dei livelli validati da riportare manualmente su Matchpoint; modalita demo non persistente `demoMatchpoint=1` aggiunta in TEST v5.410 per verifica visiva; tab `Cruscotto mattutino` integrata in TEST/PROD v5.411 come riepilogo operativo compatto; prima routine backend email TEST v5.412 impostata con invio 05:45 massimo 10 soci/giorno e controlli Gmail quattro volte al giorno; cruscotto mattutino tabellare `Processo utenti` integrato in TEST v5.413, con `Stato invio` assorbito nella vista unica; barra informativa Matchpoint rimossa dal cruscotto in TEST v5.414; cruscotto limitato a 20 righe progressive per filtro in TEST v5.415; hotfix box filtro cruscotto in TEST v5.416; ricerca cruscotto/storico rafforzata in TEST v5.417; controlli manuali Gmail spostati in `Strumenti tecnici avanzati` in TEST/PROD v5.418, senza attivazione scheduler email PROD; import log cloud e nuovo ciclo post-storico corretti in TEST v5.419; evidenza dello stadio sui box filtro del cruscotto integrata in TEST v5.420; ricerca a parole indipendenti nel cruscotto/storico integrata in TEST/PROD v5.421; refresh Autovalutazione dopo modifiche socio e ricerca Database soci a parole indipendenti integrati in TEST/PROD v5.422, senza attivazione scheduler email PROD; sync cloud puntuale delle modifiche scheda socio pubblicato in TEST v5.423; invio mattutino con approvazione manuale staff pubblicato in TEST v5.424; comando `Prepara lotto` / `Approva invio N` spostato nella testata del `Cruscotto mattutino` in TEST v5.425; fix del pulsante `Pulisci` nella ricerca del `Cruscotto mattutino` pubblicato in TEST v5.426; pulsanti WhatsApp diretti rimossi dalle sottosezioni operative Autovalutazione in TEST v5.427; oggetto del primo invio email chiarito in TEST v5.428; barra alta dei sei box routine rimossa dal `Cruscotto mattutino` in TEST v5.429; popup scelta messaggio WhatsApp dalla scheda socio integrato in TEST v5.430; lotto email manuale con invio tutti/selezionati/singola riga integrato nel `Cruscotto mattutino` in TEST v5.434; rigenerazione controllata del lotto non inviato integrata in TEST v5.435.

Ultimo aggiornamento: 2026-05-16 00:32

Nota TEST/PROD: le regole operative generali su invii, destinatari TEST, scheduler, separazione dati, promozione PROD e rollback sono centralizzate in `docs/pmo-policy-test-prod-routine-deploy.md`. Questo documento descrive il funzionamento specifico dell'Autovalutazione.

## Nota tecnica TEST v5.424 - 2026-05-15 11:25

L'invio mattutino Autovalutazione passa a controllo manuale staff. La modifica e' pubblicata in TEST al commit `90deb5e`; la Edge Function TEST `assessment-email-send` e' versione 15 con `verify_jwt=false`.

Regole operative:

- la routine puo' preparare un lotto fino a 10 soci pronti;
- se i soci pronti sono meno di 10, il lotto contiene solo quelli disponibili e non e' un errore;
- se non ci sono soci pronti, il lotto resta vuoto e non parte nessuna email;
- `routine-plan` prepara il lotto e lo salva nei record cloud `assessment_email`;
- `routine-approve` approva il lotto e avvia l'invio solo dopo click staff da `Cruscotto mattutino`;
- `routine-send`, se chiamata dalla routine generale senza lotto approvato, non invia email e registra blocco `APPROVAL_REQUIRED`;
- i test mirati con `targetMemberIds` restano diretti per simulazioni controllate;
- nessun SQL, nessuno scheduler e nessuna modifica PROD sono stati introdotti da questa versione;
- il deploy della Edge Function e' stato eseguito solo sul progetto Supabase TEST `cudiqnrrlbyqryrtaprd`.

La UI mostra `Prepara lotto` quando non esiste un lotto del giorno e `Approva invio N` quando il lotto e' pronto. Il testo della sequenza viene indicato come `giro controllato`, non come invio completamente automatico.

## Nota UI TEST v5.425 - 2026-05-15 14:54

Nel `Cruscotto mattutino`, il comando `Prepara lotto` / `Approva invio N` viene mostrato direttamente nella testata del pannello, sulla riga del titolo.

Il riquadro descrittivo separato dell'invio mattutino con approvazione manuale viene rimosso. La logica operativa resta invariata:

- `Prepara lotto` crea il lotto senza inviare email;
- `Approva invio N` resta l'unico comando che autorizza l'invio del lotto pronto;
- nessuna modifica a Edge Function, SQL, scheduler, Gmail, destinatari TEST, Matchpoint, dati reali o PROD.

## Nota UI TEST v5.426 - 2026-05-15 16:49

Corretto il pulsante `Pulisci` nella ricerca `Cerca nel processo` del `Cruscotto mattutino`.

Prima il comando azzerava lo stato interno, ma il campo input manteneva il testo e al rerender la ricerca veniva riapplicata. Ora il comando svuota anche l'input visibile prima di ridisegnare il pannello, cosi' i filtri come `Problemi` tornano a mostrare le righe attese.

La modifica e' solo UI/ricerca locale: non cambia invii email, Gmail, Edge Function, SQL, scheduler, Matchpoint, dati reali o PROD.

## Nota UI TEST v5.427 - 2026-05-15 18:56

Rimossi i pulsanti WhatsApp diretti dalle sottosezioni operative Autovalutazione.

Regole aggiornate:

- in `Cruscotto mattutino`, `Problemi`, `Contattati / in attesa` e `Storico`, le azioni operative rimandano a `Dettaglio` / `Scheda socio`;
- i flussi legacy di invio guidato Autovalutazione aprono la scheda socio invece di aprire WhatsApp direttamente;
- il recupero manuale resta possibile dalla scheda socio, dove il pulsante WhatsApp rimane disponibile;
- non sono stati rimossi i template/testi WhatsApp, per non perdere storico e materiale di supporto;
- nessuna modifica a invii email, Gmail, Edge Function, SQL, scheduler, Matchpoint, dati reali o PROD.

## Nota TEST v5.428 - 2026-05-15 19:20

Dopo il test positivo con lotto approvato da 10 email ricevute, e' stato chiarito l'oggetto del primo invio Autovalutazione.

Nuovo oggetto:

`Padel Village - Completa la tua autovalutazione del livello di gioco`

La modifica e' stata applicata:

- nel template app `primary-email`, con migrazione del vecchio oggetto standard salvato localmente;
- nel fallback backend della Edge Function TEST `assessment-email-send`, pubblicata come versione 16 con `verify_jwt=false`.

Non sono stati modificati corpo email, logica invio, approvazione lotto, SQL, scheduler, Matchpoint, dati reali o PROD.

## Nota UI TEST v5.429 - 2026-05-15 19:51

Integrata la soluzione finale Mix del mockup `mockup/autovalutazione-cruscotto-processo-utenti-mockup.html`.

Nel `Cruscotto mattutino` e' stata rimossa la barra alta con i sei box:

- `Invio email`;
- `Limite oggi`;
- `Inviate oggi`;
- `Prossimo controllo Gmail`;
- `Ultimo controllo`;
- `Stato routine`.

Le informazioni operative restano disponibili riga per riga nella tabella `Processo utenti`, con la colonna `Routine` subito dopo `Socio`.

Restano invariati:

- filtri rapidi `Tutti`, `Oggi`, `Da inviare`, `In attesa`, `Problemi`, `Risposte`, `Da controllare`, `Matchpoint`, `Completati`;
- ricerca `Cerca nel processo`;
- pulsante `Pulisci`;
- comandi `Prepara lotto` / `Approva invio N` nella testata;
- logica di invio email e approvazione lotto.

Nessuna modifica a Edge Function, SQL, scheduler, Gmail, WhatsApp, Matchpoint, dati reali o PROD.

## Nota UI TEST v5.430 - 2026-05-15 20:41

Integrato il mockup `mockup/scheda-socio-whatsapp-autovalutazione-mockup.html`.

Nella scheda socio il bottone `Apri WhatsApp` apre una finestra in sovraimpressione sopra la scheda, con tre testi manuali Autovalutazione:

- `Richiesta email mancante`;
- `Verifica ricezione email`;
- `Promemoria controllo mail`.

Lo staff puo':

- selezionare un testo e vedere l'anteprima;
- usare `Copia testo`;
- usare `Apri WhatsApp con testo`;
- usare `Apri senza testo`;
- chiudere con `Chiudi`, click fuori o `Esc` senza aprire WhatsApp e senza cambiare stato.

I testi vengono letti da `assessmentCommunicationTemplates`, con fallback su `DEFAULT_ASSESSMENT_COMMUNICATION_TEMPLATES`, e restano modificabili dalla tab `Testi`.

WhatsApp resta manuale: il messaggio non contiene link diretto alla scheda di autovalutazione e l'invio resta a carico dello staff dentro WhatsApp. Non sono stati reintrodotti pulsanti WhatsApp diretti nelle sottosezioni operative Autovalutazione.

Nessuna modifica a Edge Function, SQL, scheduler, Gmail, invii email, oggetto email, Matchpoint, dati reali o PROD.

## Nota UI TEST v5.434 - 2026-05-15 23:58

Integrato il mockup `mockup/autovalutazione-cruscotto-lotto-manuale-mockup.html`.

Nel `Cruscotto mattutino` la gestione del lotto email resta manuale:

- senza lotto pronto viene mostrato `Prepara lotto`;
- con lotto pronto vengono mostrati `Invia selezionati` e `Invia tutti`;
- sotto ricerca e filtri compare la sezione compatta `Lotto email manuale`;
- la tabella del lotto mostra `Sel.`, `Socio`, `Routine`, `Fase`, `Prossimo step`, `Email`, `Invii`, `Azioni`;
- ogni riga non inviata puo essere gestita con `Invia email` oppure aperta con `Dettaglio`;
- `Invia selezionati` non opera senza righe selezionate;
- `Invia tutti` invia solo righe non ancora inviate del lotto.

La UI usa la logica TEST gia disponibile di `routine-send` con `targetMemberIds` per invii mirati controllati. Non sono state modificate Edge Function, SQL, scheduler, Gmail, oggetto email, WhatsApp, Matchpoint, dati reali o PROD.

## Nota TEST v5.435 - 2026-05-16 00:32

Micro-correzione del `Cruscotto mattutino` / `Lotto email manuale`.

Quando esiste un lotto del giorno in stato `pending`, con almeno una riga e senza invii o errori, la testata mostra anche `Rigenera lotto` dopo:

- `Invia selezionati`;
- `Invia tutti`.

Regole:

- `Rigenera lotto` chiede conferma prima di operare;
- sostituisce solo il lotto non inviato con un nuovo calcolo dei soci pronti;
- non invia email;
- non compare se il lotto e' gia parzialmente inviato, inviato, in invio, approvato o contiene righe `sent`/`failed`;
- se i soci disponibili sono meno di 10, il lotto rigenerato resta valido;
- se non ci sono soci disponibili, il lotto mostra lo stato vuoto gia previsto.

La Edge Function TEST `assessment-email-send` e' stata pubblicata come versione 17 con `verify_jwt=false`. Il comportamento standard di `routine-plan` resta invariato; solo quando riceve `regenerate:true` puo sostituire un lotto esistente e solo se il lotto e' `pending`, senza `sent`, senza `failed`, senza `sendingAt` e senza `sentAt`. Negli altri casi risponde con `ROUTINE_BATCH_REGENERATE_NOT_ALLOWED`.

Nessuna modifica a SQL, scheduler, Gmail template, oggetto email v5.428, WhatsApp, Matchpoint, dati reali o PROD.

## Procedura deploy Edge Function TEST - 2026-05-16

Per i prossimi deploy TEST della Edge Function `assessment-email-send` non e' necessario che la CLI Supabase sia installata globalmente nel `PATH`.

Se la funzione cambia davvero e va pubblicata su Supabase TEST Admin, usare:

```bash
npx supabase functions deploy assessment-email-send \
  --project-ref cudiqnrrlbyqryrtaprd \
  --no-verify-jwt \
  --use-api
```

Regole operative:

- usare solo il project ref TEST Admin `cudiqnrrlbyqryrtaprd`;
- mantenere `--no-verify-jwt`, perche' la funzione TEST ha protezione interna JWT staff o routine secret;
- usare `--use-api` per evitare dipendenze locali da Docker;
- non fare deploy se la funzione non e' cambiata;
- non modificare PROD, SQL, scheduler, segreti Gmail o dati reali per questa procedura;
- per PROD serve sempre la chat PROMOZIONE PROD con autorizzazione esplicita.

Verifica non distruttiva eseguita il 2026-05-16:

- `command -v supabase`: comando globale non trovato;
- `npx supabase --version`: `2.98.2`;
- `npx supabase functions deploy --help`: confermati i flag `--project-ref`, `--no-verify-jwt` e `--use-api`.

## Regola PROD da preservare - 2026-05-16

Regola validata per la futura promozione/attivazione PROD dell'Autovalutazione email.

In PROD il primo invio del ciclo viene avviato dallo staff: lo staff prepara il lotto, sceglie i soci e conferma l'invio email. Dopo il primo invio, il singolo socio entra automaticamente nel ciclo di follow-up.

Da quel momento la routine PROD deve lavorare senza nuove approvazioni staff per il secondo e terzo richiamo, ma solo dopo aver controllato gli stop operativi.

Prima di ogni richiamo automatico la routine deve controllare:

- scheda compilata tramite token personale;
- risposta email ricevuta dal socio su Gmail;
- mancata consegna/bounce della mail precedente;
- pausa o problema operativo gia registrato.

Se la scheda e' compilata:

- il socio esce dal ciclo dei richiami;
- la risposta entra in `Post-invio`;
- lo staff valuta/applica il livello;
- dopo applicazione livello parte la mail di conferma livello validato;
- il giro va nello `Storico`;
- se il livello e' da riportare su Matchpoint, il socio resta nella lista Matchpoint manuale.

Se il socio risponde via email prima di compilare:

- secondo e terzo richiamo restano sospesi;
- la risposta deve essere visibile in app con `Leggi risposta`;
- lo staff gestisce il caso manualmente.

Se viene trovata una mancata consegna:

- il socio non deve ricevere altri richiami automatici;
- il caso va in `Problemi`;
- lo staff corregge email o recupera il socio manualmente.

Se non ci sono stop:

- dopo 2 giorni dal primo invio parte automaticamente il secondo richiamo;
- dopo altri 2 giorni dal secondo invio parte automaticamente il terzo richiamo;
- dopo il terzo richiamo senza esito non partono altre email automatiche e il socio passa al recupero manuale.

Regola di validazione livello:

- le schede con differenza bassa e coerenza sufficiente possono essere chiuse/applicate secondo la logica app;
- le schede con scostamento alto o coerenza bassa richiedono controllo staff prima di applicare il livello;
- la soglia operativa da riesaminare prima del deploy PROD e': controllo staff obbligatorio se lo scostamento supera 1 livello oppure se la coerenza e' bassa. Fino a decisione finale, resta valida la regola prudente gia in app: controllo manuale quando lo scostamento supera 0.5 o la coerenza e' bassa.

Questa regola deve essere riportata nel prompt di PROMOZIONE PROD e verificata prima di attivare lo scheduler email Autovalutazione PROD.

## Obiettivo

Affiancare al canale WhatsApp manuale un invio email automatico del modulo di autovalutazione.

Il perimetro iniziale considera solo i soci che nel gestionale Padel Match Organizer hanno livello `0.5`, cioe' soci ancora da valutare.

WhatsApp resta disponibile come canale manuale di controllo e recupero dalla scheda socio.

## Nota UI TEST v5.377

Le tabelle operative della sezione Autovalutazione devono adattarsi alla larghezza dello schermo senza scroll orizzontale interno.

Regole grafiche:

- niente larghezza minima fissa sulle tabelle del nuovo flusso email;
- testi, date, note e bottoni possono andare a capo;
- su schermi stretti le righe tabellari diventano schede verticali con etichette leggibili;
- la logica dati e le azioni operative restano invariate.

## Nota UI TEST v5.378

Dopo approvazione dei mockup grafici, in app TEST sono state integrate le sole rifiniture UI gia validate:

- intestazione `Autovalutazione` compattata in un unico blocco con modalita prova e indicatori principali;
- tab `Stato invio` trasformata in tabella `Controllo / Stato / Dettaglio / Prossima azione`;
- intestazioni fisse nelle tabelle operative su desktop e tablet, con righe scrollabili nel riquadro;
- su mobile resta la resa a schede verticali, senza scroll orizzontale interno.

Non sono stati attivati backend Gmail, scheduler email o invii reali.

## Nota UI TEST v5.379

Dopo approvazione del mockup `Problemi / email mancante / WhatsApp`, in app TEST viene integrato il recupero manuale delle email mancanti.

Regole operative integrate:

- i soci attivi con livello `0.5` e senza email valida non compaiono in `Da inviare 0.5`, ma entrano direttamente in `Problemi`;
- quando lo staff inserisce una email valida nella scheda socio, il socio esce automaticamente da `Problemi` e rientra in `Da inviare 0.5`, se non e' gia stato chiuso, messo in pausa o contattato nel ciclo corrente;
- il pulsante `Apri WhatsApp` nei problemi apre una finestra sovrapposta con tre testi selezionabili: `Richiesta email mancante`, `Verifica ricezione email` e `Promemoria controllo mail`;
- i messaggi WhatsApp non contengono il link diretto alla scheda di autovalutazione;
- copiare il testo non cambia lo stato del socio;
- quando lo staff preme `Apri WhatsApp`, l'app salva subito data e ora come ultimo WhatsApp aperto;
- per le richieste email gia inviate e senza risposta da oltre soglia, il socio resta visibile nei problemi con la data dell'ultimo WhatsApp aperto finche' non risponde, viene corretto il dato o viene messo in pausa;
- per le email mancanti, il socio resta in `Problemi` finche non viene salvata una email valida.

Anche questa integrazione resta solo UI/localStorage: Gmail, lettura mancate consegne e scheduler email automatico saranno un passaggio backend separato.

## Nota UI TEST v5.380

Dopo revisione del testo operativo, viene introdotto un secondo comando di conferma manuale.

Questa regola e' superata dalla semplificazione v5.382, che registra direttamente il click su `Apri WhatsApp`.

## Nota UI TEST v5.381

Dopo il click su `Apri WhatsApp` nella finestra di scelta messaggio:

- la finestra si chiude automaticamente;
- la sezione torna alla tab `Problemi`;
- la riga del socio appena lavorato viene centrata ed evidenziata brevemente;
- la data dell'ultimo WhatsApp aperto e' gia visibile sotto l'azione del socio.

## Nota UI TEST v5.382

Dopo semplificazione del flusso manuale WhatsApp:

- nella tab `Problemi` resta un solo comando operativo: `Apri WhatsApp`;
- quando lo staff preme `Apri WhatsApp` nella finestra di scelta messaggio, l'app salva subito data e ora in `selfAssessmentWhatsappCheckAt`;
- sotto l'azione compare `Ultimo WhatsApp aperto: gg/mm/aaaa, hh:mm`;
- se lo staff apre di nuovo WhatsApp per lo stesso socio, viene aggiornata l'ultima data;
- il comando non garantisce che il messaggio sia stato inviato dentro WhatsApp: registra il momento in cui lo staff ha aperto WhatsApp dalla scheda.

## Nota tecnica TEST v5.383

Prima integrazione backend per il test email:

- nuova Edge Function Supabase TEST `assessment-email-send`;
- `verify_jwt=true`;
- accesso consentito solo a staff autenticato con permesso `cloud_sync`, oppure ruolo `owner/admin`;
- invio tramite Gmail API usando solo segreti Supabase, mai HTML o repo;
- in modalita prova il destinatario reale del socio viene sostituito lato server dal destinatario prova configurato oppure dall'email staff autenticata;
- la mail di test aggiunge prefisso `[TEST]` nell'oggetto e una nota interna nel corpo;
- ogni invio riuscito salva un log leggero in `pmo_cloud_records` con `record_type = assessment_email` e una riga audit `assessment_email_send`;
- la UI `Da inviare 0.5` permette `Prepara` e poi `Prova email` sulla singola riga;
- il bottone alto `Prova invio sulla mia email` usa il primo socio eleggibile della coda.

Segreti richiesti nella Edge Function:

- `GMAIL_CLIENT_ID`;
- `GMAIL_CLIENT_SECRET`;
- `GMAIL_REFRESH_TOKEN`;
- `GMAIL_SENDER_EMAIL`;
- opzionale `ASSESSMENT_EMAIL_TEST_TO`, se si vuole forzare un destinatario prova fisso invece dell'email staff autenticata;
- opzionale `ASSESSMENT_EMAIL_FROM_NAME`;
- opzionale `ASSESSMENT_EMAIL_REPLY_TO`.

Nella fase v5.383 la funzione non attivava ancora lo scheduler email automatico e non leggeva ancora le mancate consegne. Questi passaggi vengono ripresi nelle note successive.

## Nota tecnica PROD v5.411 - 2026-05-13 20:08

Durante il primo giro controllato in PROD e' emerso che la RPC `upsert_assessment_tokens_admin` usava la colonna `registered_at`, ma la tabella PROD `assessment_tokens` non la conteneva.

Correzione applicata solo a Supabase PROD dopo autorizzazione esplicita:

- aggiunta `assessment_tokens.registered_at timestamptz` se mancante;
- valorizzate le righe esistenti con `created_at` quando `registered_at` era nullo;
- nessun dato cancellato;
- nessuna modifica a `index.html`, funzioni Edge, scheduler o invii automatici.

Verifica post-intervento: colonna presente, 0 righe senza `registered_at`, 971 token conservati.

## Nota tecnica TEST v5.412 - 2026-05-13 23:10

Prima fase controllata della routine backend Autovalutazione, predisposta solo in TEST.

Regole impostate:

- invio automatico giornaliero alle `05:45`;
- limite iniziale ridotto a 10 email al giorno;
- invii scaglionati lato Edge Function per non partire tutti nello stesso istante;
- controlli Gmail automatici quattro volte al giorno: `06:10`, `10:30`, `15:30`, `20:30`;
- la routine usa i soci cloud attivi con livello `0.5`, email valida e nessun ciclo gia completato;
- la routine riusa i testi salvati in `assessmentCommunicationTemplates` quando presenti, altrimenti usa il testo standard approvato;
- i log email cloud vengono importati dalla UI prima dei controlli manuali, cosi gli invii fatti dal backend risultano visibili anche nel browser staff.

Ambiente:

- SQL applicato solo su Supabase TEST;
- cron TEST `pmo-assessment-email-dispatcher-test` rimosso il 2026-05-14 07:39 per evitare invii automatici reali durante le simulazioni;
- Edge Function TEST `assessment-email-send` v13 protetta da JWT staff per i pulsanti manuali o da secret Vault `x-pmo-routine-secret` per il cron;
- GRANT espliciti TEST a `service_role` per `assessment_tokens`, `self_assessments` e `pmo_routine_runs`, necessari alla routine backend e coerenti con la nuova regola Data API Supabase;
- nessuna routine email automatica attivata in PROD.

Nota operativa 2026-05-14 07:39: domattina non deve partire nessun invio automatico reale. Eventuali prove della routine vanno fatte con lancio manuale controllato, preferibilmente con limite ridotto e destinatario di prova verificato.

Nota operativa 2026-05-14 08:04: la Edge Function TEST `assessment-email-send` e' stata aggiornata a v14 con filtro tecnico `targetMemberIds`, usato per prove mirate senza coinvolgere la coda completa. Per il test reale controllato delle 09:00 Europe/Rome e' stato creato in Supabase TEST il job una tantum `pmo-assessment-email-single-test-0900`, schedulato in UTC come `0 7 14 5 *`, che invia al massimo 1 email al solo socio `PMO-000948` e poi si rimuove.

Nota operativa 2026-05-14 14:55: il test delle 09:00 ha inviato una sola email al socio `PMO-000948`. Per completare un nuovo giro controllato, e' stato schedulato in Supabase TEST il job una tantum `pmo-assessment-email-single-test-1630`, schedulato in UTC come `30 14 14 5 *`, quindi 16:30 Europe/Rome. Il job e' mirato solo a `PMO-000948`, non coinvolge la coda generale e si rimuove dopo l'esecuzione.

## Nota UI TEST v5.414 - 2026-05-14 14:55

Nel `Cruscotto mattutino` tabellare e' stata rimossa la barra informativa:

`Matchpoint va aggiornato manualmente. Dopo l'inserimento, segna qui l'operazione come completata.`

La regola operativa non cambia: Matchpoint resta un passaggio manuale e il testo corretto del bottone resta `Segna inserito su Matchpoint`.

## Nota UI TEST v5.415 - 2026-05-14 15:18

Nel `Cruscotto mattutino`, la tabella `Processo utenti` mostra al massimo 20 righe per il filtro attivo. I box filtro continuano a mostrare il conteggio reale completo, ma la lista operativa parte dai primi 20 soci ordinati per priorita.

Quando esistono altri soci nel filtro, sotto la tabella compare `Mostra altri 20`. Cambiando filtro il limite torna automaticamente a 20 righe.

Non sono state modificate le regole di invio email, lettura Gmail, validazione livello, storico o Matchpoint.

## Nota UI TEST v5.416 - 2026-05-14 16:51

Hotfix del limite progressivo introdotto in v5.415.

Il contatore interno delle righe visibili usa ora uno stato dedicato (`assessmentProcessVisibleRowsLimit`) e non collide piu con la funzione che calcola il limite. Questo evita il blocco dei box filtro del `Cruscotto mattutino`.

Nessuna modifica a invio email, lettura Gmail, scheduler, storico, Matchpoint reale o PROD.

## Nota UI TEST v5.417 - 2026-05-14 18:02

Hotfix di ricerca dopo il passaggio al `Cruscotto mattutino` tabellare.

Regole integrate:

- nel `Cruscotto mattutino` / `Processo utenti` e' disponibile una ricerca interna per nome, cognome, email, telefono o ID socio;
- il limite a 20 righe resta attivo, ma la ricerca filtra l'intero processo prima di applicare il limite;
- se il socio cercato esiste ma sta in un filtro diverso da quello attivo, la UI suggerisce di passare a `Tutti`;
- la ricerca include anche ID socio, `memberId`, token e dati del giro email/autovalutazione;
- nello `Storico` la ricerca resta stabile mentre si digita e usa gli stessi dati estesi.

Nessuna modifica a invio email, lettura Gmail, scheduler, storico dati, Matchpoint reale o PROD.

## Nota UI TEST v5.418 - 2026-05-14 20:07

Pulizia dei controlli manuali Gmail.

I bottoni `Aggiorna risposte email` e `Controlla mancate consegne` sono stati rimossi dai pannelli operativi visibili e spostati dentro `Strumenti tecnici avanzati`.

La routine automatica e i flussi operativi restano invariati: i due bottoni servono solo per anticipare manualmente un controllo o verificare un problema.

Nessuna modifica a invio email, lettura Gmail backend, scheduler, storico dati, Matchpoint reale o PROD.

## Nota PROD v5.418 - 2026-05-14 21:18

La UI Autovalutazione fino a v5.418 e' stata promossa in PROD.

Non e' stato applicato nessun SQL scheduler Autovalutazione in PROD e non e' stato attivato nessun cron email automatico. Il controllo live su Supabase PROD mostra solo il cron dati/Matchpoint gia esistente `pmo-data-routines-dispatcher-prod`.

## Nota UI TEST v5.419 - 2026-05-14 23:50

Correzione mirata del `Cruscotto mattutino` dopo il test cron PROD one-shot su `PMO-000956`.

- I log cloud `assessment_email` vengono agganciati anche tramite ID giocatore `memberId`/`PMO-...`, non solo tramite ID interno browser.
- All'apertura di Autovalutazione l'app prova a importare in modo silenzioso gli ultimi log cloud, cosi' il cruscotto non resta fermo al vecchio stato locale.
- Se arriva un nuovo invio dopo un ciclo gia chiuso, il token precedente viene archiviato e il socio torna nel ciclo attivo `In attesa`.
- Nessuna modifica a scheduler generale, SQL, Gmail backend o Matchpoint reale.

## Nota UI TEST v5.420 - 2026-05-15 00:27

Nel `Cruscotto mattutino`, la ricerca `Cerca nel processo` evidenzia i box filtro corrispondenti allo stadio del socio cercato.

Se un socio trovato e' in `Da inviare`, `In attesa`, `Problemi`, `Risposte`, `Da controllare`, `Matchpoint`, `Completati` o `Oggi`, il relativo box sopra la tabella riceve un bordo/arancione visibile.

La modifica e' solo UI: non cambia invii email, Gmail, scheduler, storico, Matchpoint reale o dati.

## Nota UI TEST v5.421 - 2026-05-15 00:51

La ricerca del `Cruscotto mattutino` e dello `Storico` ora lavora anche per parole indipendenti.

Se lo staff cerca un socio digitando nome e cognome in ordine diverso, per esempio `Utente Prova` oppure `Prova Utente`, il socio viene comunque trovato se entrambe le parole sono presenti nei dati della riga.

La modifica e' solo UI/ricerca: non cambia invii email, Gmail, scheduler, storico, Matchpoint reale o dati.

## Nota UI TEST/PROD v5.422 - 2026-05-15 08:52

Le azioni interne sulla scheda socio aggiornano subito anche Autovalutazione:

- nuovo socio;
- modifica scheda socio;
- disattivazione o riattivazione socio;
- cancellazione socio.

La ricerca del `Database soci` usa la stessa logica a parole indipendenti del cruscotto: nomi e cognomi composti, o digitati in ordine diverso, vengono trovati se tutte le parole cercate sono presenti.

La modifica e' solo UI/refresh locale: non cambia invii email, Gmail, scheduler, storico, Matchpoint reale o dati Supabase. Il controllo live Supabase PROD del 2026-05-15 08:52 mostra solo il cron dati/Matchpoint esistente; lo scheduler email Autovalutazione PROD resta non attivo.

## Nota tecnica TEST sviluppo v5.423 - 2026-05-15 09:34

Le modifiche interne alla scheda socio non devono aspettare il backup cloud:

- nuovo socio;
- modifica scheda socio;
- disattivazione o riattivazione socio;
- cancellazione socio.

La web app salva prima il dato locale e poi tenta subito la scrittura puntuale del solo record `member` su Supabase tramite `pmo_upsert_records_admin`. Per cancellazione viene inviato lo stesso record con `deleted = true`, cosi' le routine cloud non continuano a leggere una scheda ormai rimossa localmente.

Se la scrittura cloud fallisce, la modifica locale resta salvata e lo staff vede un avviso. La routine richiede il permesso Supabase `cloud_sync`, perche' riusa la RPC gia esistente. Nessuna modifica a SQL, Edge Function, scheduler email, Gmail o Matchpoint reale.

## Nota UI TEST v5.413 - 2026-05-14 11:22

Dopo approvazione del mockup `autovalutazione-cruscotto-processo-utenti-mockup.html`, il `Cruscotto mattutino` viene riorganizzato come vista unica operativa `Processo utenti`.

Regole integrate:

- Autovalutazione apre di default su `Cruscotto mattutino`;
- le tab principali visibili sono solo `Cruscotto mattutino`, `Storico`, `Testi` e `Scheda pubblica`;
- `Da inviare 0.5`, `Contattati / in attesa`, `Problemi`, `Post-invio`, `Matchpoint` e `Stato invio` non sono piu tab principali, ma le loro logiche restano disponibili per filtri, righe e azioni;
- le informazioni principali della vecchia tab `Stato invio` sono assorbite nella barra routine compatta e nella colonna `Routine`;
- i filtri rapidi del cruscotto sono `Tutti`, `Oggi`, `Da inviare`, `In attesa`, `Problemi`, `Risposte`, `Da controllare`, `Matchpoint`, `Completati`;
- Matchpoint resta un passaggio manuale: il testo corretto e' `Segna inserito su Matchpoint`;
- WhatsApp resta manuale: il testo corretto e' `Apri WhatsApp`;
- non sono state modificate Edge Function, SQL, scheduler, Matchpoint reale o PROD.

## Nota UI TEST v5.384

La tab `Da inviare 0.5` non deve nascondere soci per limite di visualizzazione.

Regole operative:

- la lista completa dei soci eleggibili resta disponibile, anche quando i nominativi sono molti;
- sopra la tabella c'e' una ricerca per nome, cognome, email o telefono;
- il conteggio mostra quanti soci sono visibili rispetto al totale eleggibile;
- il bottone alto `Prova invio sulla mia email` usa il socio filtrato quando e' attiva una ricerca, cosi' il test puo' essere fatto su un nominativo specifico;
- l'ordine resta alfabetico, ma la visualizzazione non si ferma piu' ai primi nominativi.

## Nota tecnica TEST v5.385

Dopo il primo test reale di invio Gmail:

- la Edge Function `assessment-email-send` invia anche una versione HTML della mail, con paragrafi leggibili e pulsante `Compila la scheda` al posto del link lungo come contenuto principale;
- la versione solo testo resta presente come alternativa tecnica per client email che non leggono HTML;
- in modalita TEST resta visibile il riquadro interno che indica socio selezionato ed email reale in anagrafica;
- se Gmail invia correttamente ma il salvataggio log Supabase fallisce, la funzione non restituisce piu' un errore totale di invio: risponde con successo e `logWarning`, evitando di far ripetere una mail gia partita;
- su Supabase TEST il vincolo `pmo_cloud_records_type_check` accetta anche `record_type = assessment_email`, necessario per registrare gli invii.

Nota test del 2026-05-12: le copie viste nella casella Gmail Padel Village sono coerenti con i tentativi manuali fatti durante la configurazione. Il mittente appare come `me` perche' l'account Gmail visualizza le proprie email inviate.

## Nota UI TEST v5.386

La parte alta della sezione `Autovalutazione` viene resa piu compatta per lasciare piu spazio operativo alle tabelle:

- barra superiore della sezione piu bassa quando si lavora in Autovalutazione;
- blocco di sintesi, indicatori, tab e testate delle sottosezioni con padding ridotto;
- rimozione del margine alto ereditato dagli `h3`, che aumentava inutilmente l'altezza delle testate interne;
- riquadri tabellari con piu altezza utile prima dello scroll interno.

La ricerca in `Da inviare 0.5` ora distingue il caso in cui il socio esiste ma non appartiene piu alla coda da inviare. Se il socio cercato e' gia stato contattato, e' in `Contattati / in attesa`, `Post-invio`, `Storico` o `Problemi`, l'app mostra un rimando leggibile alla sottosezione corretta e un pulsante per aprirla ed evidenziare la riga.

## Nota UI TEST v5.387

La demo della scheda di autovalutazione non resta piu visibile sotto tutti gli stati operativi.

Regole integrate:

- la tab `Scheda pubblica` diventa un pannello autonomo da controllare quando serve vedere l'anteprima del modulo;
- le tab operative `Stato invio`, `Da inviare 0.5`, `Contattati / in attesa`, `Problemi`, `Post-invio`, `Storico` e `Testi` non mostrano piu la demo sotto le rispettive tabelle;
- nella tab `Contattati / in attesa` e' disponibile `Reinvia email`;
- il reinvio usa il secondo testo email e, se serve, il terzo promemoria;
- in TEST il reinvio resta protetto: la mail va al destinatario prova, non direttamente al socio reale;
- dopo il reinvio la riga resta in attesa, aggiorna data/ora dell'ultimo invio e mostra il conteggio degli invii.

## Nota UI TEST v5.388

L'ordine delle tab della sezione `Autovalutazione` viene riallineato al lavoro quotidiano.

Regole integrate:

- la prima tab aperta e' `Da inviare 0.5`;
- l'ordine operativo diventa `Da inviare 0.5`, `Contattati / in attesa`, `Problemi`, `Post-invio`, `Storico`, `Testi`, `Scheda pubblica`, `Stato invio`;
- anche il sottomenu laterale segue lo stesso ordine;
- `Stato invio` resta disponibile, ma come controllo finale a destra invece che come punto di partenza.

## Nota email TEST v5.389

Le email del flusso Autovalutazione vengono aggiornate per essere piu leggibili:

- il testo indica che la compilazione richiede meno di 1 minuto;
- tutte le email includono il contatto segreteria Padel Village `+39 379 115 1472`;
- nel formato HTML il numero segreteria diventa un link WhatsApp cliccabile;
- il link personale della scheda viene trasformato nel pulsante `Compila la scheda`, con link di fallback sotto al pulsante;
- la versione solo testo resta disponibile come alternativa tecnica per i client email che non leggono HTML.

## Nota email TEST v5.390

Dopo il primo controllo visuale della mail ricevuta:

- il contatto segreteria viene reso piu evidente nel formato HTML con il bottone `Scrivi alla segreteria su WhatsApp`;
- il numero `+39 379 115 1472` resta visibile nel testo e viene collegato a WhatsApp quando il client email lo supporta;
- il testo sopra al link di fallback della scheda non dice piu di copiare il link, ma indica che si puo usare il link se il pulsante non si apre;
- i testi email salvati in locale vengono normalizzati aggiungendo `{whatsapp_segreteria}` quando avevano gia il telefono ma non ancora il link WhatsApp.

## Nota UI TEST v5.391

Dopo il primo test completo con risposta ricevuta in `Post-invio`:

- nella finestra `Modifica valutazione` la tendina manuale `Stato staff` viene rimossa;
- lo stato diventa automatico e leggibile come `Da controllare`, `Corretto dallo staff` o `Livello aggiornato`;
- salvando una modifica al livello, la risposta passa automaticamente a `Corretto dallo staff`;
- applicando il livello alla scheda socio, la risposta passa automaticamente a `Livello aggiornato`;
- le etichette operative di `Post-invio` vengono riallineate a `Da controllare` e `Da controllare con attenzione`, evitando il termine tecnico `Da verificare staff`.

## Nota UI TEST v5.392

Dopo il primo passaggio in `Storico`, viene chiarita la parte finale del giro:

- nello storico la colonna `Canale` viene sostituita da `Invio scheda`, per indicare solo come e' arrivata la scheda di autovalutazione;
- la colonna `Nota` viene sostituita da `Conferma livello`, con stato leggibile `Email da inviare`, `Email inviata`, `Email mancante` o `Non prevista`;
- quando lo staff applica il livello, l'app prova a inviare automaticamente la conferma livello via email usando il testo `Livello validato`;
- se la conferma non parte, nello storico resta il pulsante `Invia conferma email`;
- da v5.406, se la conferma e' gia partita, nello storico resta solo lo stato `Email inviata` con data e non viene mostrato un bottone di reinvio;
- WhatsApp resta solo canale manuale di recupero prima della compilazione, non canale di notifica finale del livello validato.

## Nota tecnica TEST v5.393

Dopo l'approvazione del flusso finale, `Post-invio` viene automatizzato per i casi semplici:

- quando lo staff preme `Aggiorna risposte`, l'app importa le schede compilate da Supabase;
- le schede coerenti con differenza livello `0` o `0.5` vengono chiuse automaticamente;
- la chiusura automatica applica il livello calcolato alla scheda socio e sposta il giro nello `Storico`;
- subito dopo l'app prova a inviare via email la conferma del livello validato;
- se l'email di conferma non parte, lo storico conserva lo stato `Email da inviare` e il pulsante manuale;
- le schede con differenza alta o dati dubbi restano in `Post-invio` per controllo staff;
- il bottone `Applica automatiche ora` resta come recupero manuale se serve rilanciare la chiusura delle schede automatiche gia importate.

## Nota UI TEST v5.394

Dopo i test su scheda socio e storico vengono aggiunti controlli di protezione dati:

- in `Anagrafica soci`, il filtro `Attenzione dati` include anche `Senza email`;
- in `Anagrafica soci`, il filtro include `Livello 0.5 dopo autovalutazione` per trovare soci gia valutati rimessi per errore a livello 0.5;
- dopo `Salva` nella scheda socio, la scheda si chiude automaticamente e le liste operative vengono ricalcolate;
- in `Storico` Autovalutazione, quando un socio risulta a livello 0.5 ma ha uno storico applicato con livello validato diverso, compare il bottone `Ripristina livello validato`;
- nella scheda socio compare la stessa attenzione e lo stesso ripristino quando serve;
- `Nuova autovalutazione` resta un'azione esplicita dalla scheda socio: serve per aprire un nuovo ciclo voluto, non per correggere un errore dati;
- una nuova autovalutazione avviata dalla scheda socio puo' rientrare nella coda email anche se il socio non ha piu' livello 0.5, per gestire richieste reali di rivalutazione.

## Nota email TEST v5.395

Nel testo del primo invio email viene aggiunta una rassicurazione operativa per chi non vuole compilare la scheda in autonomia:

- il socio viene invitato a scrivere su WhatsApp se ha dubbi o preferisce essere aiutato;
- il testo chiarisce che lo staff Padel Village, con LoZio, puo' aiutare a definire insieme il livello;
- la normalizzazione dei testi salvati aggiunge questo passaggio anche quando nel browser era rimasto il vecchio testo del primo invio;
- il promemoria, la conferma ricezione e la conferma livello non vengono modificati.

## Nota UI TEST v5.396

La testata compatta della sezione `Autovalutazione` viene rifinita:

- gli indicatori numerici vengono resi piu stretti per occupare meno spazio;
- viene aggiunto l'indicatore `senza email`, calcolato sui soci del flusso autovalutazione che sono in `Problemi` per email mancante;
- il conteggio `problemi` resta il totale dei problemi operativi, quindi puo' includere anche telefono mancante, recupero WhatsApp o soci messi in pausa.

## Nota UI TEST v5.397

La barra delle schede della sezione `Autovalutazione` viene separata in due gruppi visivi:

- `Operativi`: `Da inviare 0.5`, `Contattati / in attesa`, `Problemi`, `Post-invio` e `Storico`;
- `Consultazione`: `Testi`, `Scheda pubblica` e `Stato invio`;
- una linea divisoria rende chiara la separazione senza cambiare stati, filtri, invii o logiche dati.

## Nota UI TEST v5.398

Aggiunto un comando rapido `Apri WhatsApp`:

- nella scheda socio, vicino alle azioni principali;
- nello `Storico` Autovalutazione, nella colonna azioni di ogni socio;
- il comando apre la chat WhatsApp del socio usando il telefono salvato, o il telefono scritto nella scheda se la scheda e' aperta;
- non cambia stati, non registra verifiche e non sostituisce il recupero WhatsApp dei `Problemi`, che resta il flusso con scelta messaggio e data dell'ultimo WhatsApp aperto.

## Nota UI TEST v5.400

Dopo approvazione del mockup, la sezione `Autovalutazione` non mostra piu' il blocco alto con titolo, descrizione e pill riepilogative.

La schermata parte direttamente dalla barra compatta delle schede:

- `Da inviare 0.5`, con invii effettuati oggi su 10 e soci rimasti;
- `Contattati / in attesa`, con conteggio dei soci in attesa;
- `Problemi`, con conteggio dei problemi da risolvere;
- `Post-invio`, con conteggio delle risposte ricevute;
- `Storico`, con conteggio dei giri chiusi;
- `Testi`, `Scheda pubblica` e `Stato invio`.

Le etichette di gruppo `Operativi` e `Consultazione` vengono rimosse per tenere tutto su una riga quando lo spazio lo consente. La modifica e' solo UI: non cambia invii, stati, filtri, storico o logiche Gmail.

## Nota tecnica/UI TEST v5.401

La funzione Gmail `assessment-email-send` viene estesa, sempre con accesso staff e permesso `cloud_sync`, con due controlli di lettura:

- `scan-replies`: legge le email ricevute su Gmail e prova ad abbinarle agli invii di Autovalutazione tramite thread Gmail, email del socio, nome socio e dati dell'invio;
- `scan-bounces`: legge le notifiche di mancata consegna e, quando le abbina a un socio, sposta il caso in `Problemi` con stato leggibile `Mancata consegna`.

Regole operative:

- la lettura Gmail riguarda solo gli invii di Autovalutazione passati dall'app alla funzione, non diventa ancora il cruscotto completo `Conversazioni`;
- `Contattati / in attesa` mostra quando un socio ha risposto via email, cosi' lo staff sa che deve leggere la risposta su Gmail e gestirla manualmente;
- le mancate consegne non restano in `Contattati / in attesa`, ma passano in `Problemi` per recupero WhatsApp e correzione email;
- il bottone WhatsApp dentro le email apre la segreteria con un testo precompilato diverso per primo invio, promemoria, conferma ricezione e livello di gioco validato;
- nei testi collegati si usa la dicitura `livello di gioco`.

La tab `Stato invio` viene aggiornata alla regola oraria approvata: invio giornaliero dalle `05:45`. Da v5.412 il limite operativo iniziale e' 10 email al giorno.

Nella scheda socio i pulsanti vengono compattati: in alto restano solo `Chiudi` e `Salva`, mentre `Apri WhatsApp`, `Nuova autovalutazione`, `Disattiva/Riattiva` e `Cancella socio` restano nel pannello `Azioni operative`.

## Nota processo TEST v5.402

Il ciclo email passa da due a tre invii:

- primo invio email automatico;
- secondo invio dopo 2 giorni dal primo, con il testo promemoria gia approvato;
- terzo invio dopo altri 2 giorni, con un testo piu esplicito che chiede al socio se ha difficolta, se non vuole compilare o se preferisce spiegare il motivo via WhatsApp;
- dopo il terzo invio senza compilazione, il socio passa al recupero manuale WhatsApp/problemi invece di ricevere altre email.

Il link personale resta lo stesso in tutti e tre gli invii.

## Nota UI TEST v5.403

Quando `Aggiorna risposte email` trova una risposta Gmail, la UI deve essere esplicita:

- il messaggio di esito indica a quale socio e' stata agganciata la risposta;
- l'app porta alla sottosezione in cui quel socio si trova davvero, invece di indicare sempre `Contattati / in attesa`;
- se il socio e' ancora in `Contattati / in attesa`, la riga mostra `Risposta email ricevuta`, data/ora, mittente e anteprima del testo;
- se il socio e' gia in `Post-invio`, `Storico` o `Problemi`, la risposta viene comunque registrata ma il messaggio rimanda alla sottosezione corretta.

## Nota UI TEST v5.404

Anche nello `Storico` deve essere visibile se il socio ha risposto via email dopo la chiusura del giro:

- la tabella storico separa `Invio scheda`, `Risposta socio` e `Conferma livello`;
- `Risposta socio` mostra `Risposta ricevuta`, data/ora, mittente e anteprima del testo quando Gmail ha agganciato una risposta;
- se non esiste risposta email agganciata, la riga indica `Nessuna risposta email registrata`.

## Nota UI TEST/PROD v5.405

Se un socio risponde via email prima di compilare la scheda:

- resta in `Contattati / in attesa`, non passa a `Post-invio` e non va nello `Storico`;
- secondo e terzo invio restano sospesi finche lo staff gestisce la risposta;
- la colonna `Contatto` mostra che la risposta email e' stata ricevuta;
- nelle azioni compare `Leggi risposta`, che apre una scheda sopra con data, mittente, oggetto e testo letto da Gmail;
- la funzione `assessment-email-send` restituisce anche `replyText`, oltre all'anteprima, per permettere la lettura direttamente in app;
- la funzione e' pubblicata con `verify_jwt=true` sia in TEST sia in PROD.

## Nota UI TEST/PROD v5.406

Dopo approvazione mockup, lo `Storico` Autovalutazione viene compattato per ridurre l'altezza delle schede socio:

- i bottoni `Apri WhatsApp` e `Scheda socio` passano sotto il nome del socio, sulla stessa riga quando c'e' spazio;
- l'eventuale risposta email non mostra piu il doppione `Risposta ricevuta` ne' l'anteprima lunga: restano data/mittente e il pulsante `Leggi risposta`, che apre la scheda sopra;
- la colonna `Invio scheda` distingue `Email`, `Email + WhatsApp` ed eventuale `Email non inviata`, con date compatte;
- i filtri dello storico diventano `Stato`, `Periodo`, `Invio scheda`, `Risposta socio` e `Livello finale`;
- il filtro `Stato` usa voci operative chiare: `Auto-applicato`, `Validato staff` e `In pausa - nessuna risposta`.

## Nota UI TEST/PROD v5.407

Dopo approvazione mockup, la tab `Stato invio` diventa un cruscotto operativo piu compatto:

- vengono rimossi i quattro box grandi di sintesi;
- la testata mostra pillole leggere con orario routine, invii del giorno, elementi da controllare e ultimo controllo;
- la tabella usa le colonne `Area`, `Situazione`, `Ultimo controllo` e `Cosa succede ora`;
- le righe riepilogano Gmail Padel Village, modalita TEST/produzione, invio mattutino 05:45, coda soci 0.5, secondo invio, terzo invio, risposte email, mancate consegne, schede ricevute e recupero WhatsApp;
- resta invariata la logica backend: la modifica e' solo di lettura e controllo operativo.

## Nota pubblicazione PROD v5.408

Il 2026-05-13 la UI Autovalutazione gia validata in TEST fino a v5.407 viene inclusa nella promozione PROD `index.html` v5.408.

La promozione non cambia funzioni Supabase, segreti Gmail, scheduler, Matchpoint, import dati o regole di invio backend.

## Nota UI TEST v5.409

Dopo approvazione mockup `mockup/matchpoint-livelli-validati-mockup.html`, viene aggiunta una tab `Matchpoint` dentro Autovalutazione.

- dopo l'applicazione interna del livello, il socio viene marcato come livello validato da riportare manualmente su Matchpoint;
- la tab mostra una tabella semplice con `Socio`, `Contatto`, `Livello validato` e `Azione`;
- il bottone `Segna inserito su Matchpoint` salva data/ora e operatore, rimuove il socio dalla lista e lascia traccia nello storico;
- nello Storico Autovalutazione la conferma livello mostra anche l'eventuale evento `Inserito su Matchpoint da [operatore]`;
- il campo ricerca storico diventa `Cerca nello storico` con placeholder `Nome o cognome`;
- non viene aggiunta nessuna automazione reale verso Matchpoint e non cambiano Supabase, funzioni Edge, scheduler, Gmail o invii ai soci.

## Nota UI TEST v5.410

Per verificare visivamente la nuova tab `Matchpoint` senza creare dati reali, in TEST e' disponibile il parametro:

`?env=test&demoMatchpoint=1`

Con questo parametro l'app apre Autovalutazione > Matchpoint e mostra una riga fittizia `Test Matchpoint`.

La demo:

- non salva soci;
- non scrive in Supabase;
- non modifica Matchpoint;
- non invia email o WhatsApp;
- serve solo per controllare layout, tabella e bottone.

## Nota UI TEST/PROD v5.411

Dopo approvazione mockup `mockup/autovalutazione-cruscotto-mattutino-matchpoint-mockup.html`, viene aggiunta la tab `Cruscotto mattutino` dentro Autovalutazione.

Il cruscotto:

- diventa la prima tab aperta, salvo la demo `demoMatchpoint=1` che continua ad aprire `Matchpoint`;
- mostra sezioni compatte per `Problemi`, `Post-invio`, `Da controllare`, `Matchpoint` e `Da inviare`;
- riusa solo dati e azioni gia esistenti: correzione scheda socio, WhatsApp manuale, lettura risposta email, controllo livello, `Segna inserito su Matchpoint` e rimando alla coda `Da inviare 0.5`;
- conserva la nota operativa che Matchpoint va aggiornato manualmente;
- non aggiunge Supabase, Edge Function, scheduler, invii, scritture automatiche o automazioni verso Matchpoint.

Il 2026-05-13 la stessa versione viene promossa in PROD dopo autorizzazione esplicita dell'utente. TEST e PROD sono allineati sulla UI v5.411.

## Nota mockup 2026-05-11 19:05

Il mockup `mockup/autovalutazioni-email-routine-mockup.html` viene aggiornato prima dell'integrazione app:

- l'intestazione alta viene compattata in un solo blocco con titolo, descrizione breve, modalita prova e indicatori principali;
- la tab `Stato invio` parte da una tabella operativa invece che da card separate;
- la tabella usa le colonne `Controllo`, `Stato`, `Dettaglio`, `Prossima azione`;
- le voci leggibili includono Email Padel Village, destinatario prova, invio automatico, limite giornaliero, secondo invio, mancate consegne, WhatsApp recupero e schede ricevute;
- il mockup mantiene la resa responsive senza scroll orizzontale interno.

## Nota mockup 2026-05-11 19:09

Le tabelle operative del mockup hanno intestazione fissa su desktop e tablet: quando il contenuto e' lungo, dentro il riquadro scorrono solo le righe dei soci, mentre le colonne restano leggibili.

Su mobile resta la resa a schede verticali, perche' ogni riga mostra gia' le proprie etichette e non serve una barra fissa separata.

## Nota mockup 2026-05-11 19:16

Il controllo email mancanti puo' essere fatto subito sull'anagrafica soci, senza attendere il collegamento Gmail.

Regola operativa:

- i soci livello `0.5` senza email valida entrano direttamente in `Problemi`;
- il problema leggibile e' `Email mancante`;
- l'azione WhatsApp apre una finestra sovrapposta di scelta messaggio;
- i messaggi proposti nel mockup sono `Richiesta email mancante`, `Verifica ricezione email` e `Promemoria controllo mail`;
- il messaggio `Richiesta email mancante` spiega che l'email serve per inviare la scheda di autovalutazione e aggiornare correttamente il livello;
- nessun messaggio WhatsApp contiene il link diretto alla scheda;
- quando lo staff preme `Apri WhatsApp`, l'app registra data e ora sotto la riga del socio.

## Lettura rapida del flusso

| Step | Fase | Cosa succede | Controllo operativo |
|---|---|---|
| 1-2 | Avvio invio | Il sistema legge i soci attivi dal gestionale. | In TEST resta manuale/protetto. In PROD il primo blocco viene avviato dallo staff; solo dopo il primo invio il socio entra nel ciclo automatico. |
| 3 | Selezione livello | Passano solo i soci con livello `0.5`. | Tutti gli altri livelli sono esclusi. |
| 4 | Contatto email | Serve una email valida in anagrafica. | Se manca, il socio va nei problemi e si usa WhatsApp manuale. |
| 5 | Link personale | Il sistema prepara il link personale di autovalutazione. | Il link deve essere salvato nel sistema prima dell'invio. |
| 6-7 | Prova sicura | Il mittente e' Gmail Padel Village; in modalita prova il destinatario reale viene forzato sulla tua email personale. | Nessun socio reale riceve email durante i test. |
| 8 | Invio | Il sistema invia tramite Gmail Padel Village. | Nessuna password o chiave Gmail nel file HTML. |
| 9-10 | Esito invio | Gmail puo' accettare o rifiutare l'invio. | Se fallisce, va nel pannello Problemi. |
| 11-12 | Mancata consegna | Il sistema legge da Gmail gli avvisi di email non consegnata. | Se trova una mancata consegna, propone controllo email o WhatsApp. |
| 13 | Attesa/compilazione | Se non ci sono mancate consegne, il socio resta in attesa; se compila, passa a completato. | Non diciamo "consegnata con certezza", solo "inviata/in attesa" finche' non compila. |
| 14 | Secondo invio | Se dopo 2 giorni non ci sono scheda compilata, risposta email, mancata consegna, pausa o problema, parte il secondo richiamo automatico. | Il secondo invio usa lo stesso link personale e non richiede nuova approvazione staff. |
| 15 | Terzo invio | Se dopo altri 2 giorni dal secondo invio non ci sono scheda compilata, risposta email, mancata consegna, pausa o problema, parte il terzo richiamo automatico. | Il terzo invio usa lo stesso link personale e chiede anche un feedback via WhatsApp se ci sono problemi. |
| 16 | WhatsApp manuale | Se dopo il terzo invio non c'e' compilazione, il socio passa a `da contattare via WhatsApp`. | Il sistema non insiste oltre via email. |
| 17 | Verifica WhatsApp | Lo staff apre WhatsApp dal pannello problemi e l'app registra subito data e ora dell'apertura. | Il socio resta gestibile con l'ultima data WhatsApp aperta visibile, senza un secondo bottone di conferma. |
| 18 | Nessuna risposta | Se il socio non risponde ne' alle email ne' a WhatsApp, lo staff puo' chiudere il tentativo in pausa. | Stato leggibile: `Autovalutazione in pausa - nessuna risposta`. Il socio resta attivo e livello `0.5`. |
| 19 | Conferma compilazione | Quando il socio compila la scheda, viene inviata una email automatica di conferma ricezione. | La conferma non comunica ancora il livello validato. |
| 20-22 | Validazione | La risposta passa in Post-invio, lo staff valida/applica il livello; gli scostamenti alti o la coerenza bassa richiedono controllo staff. | Il socio esce dal bacino `0.5`, riceve una email automatica con il livello validato e poi va nello storico. |

## Regola base

Ogni giorno l'invio automatico deve mandare al massimo 10 email di autovalutazione nella prima fase controllata.

Orario invio automatico:

- invio giornaliero alle `05:45`;
- obiettivo: far trovare la mail gia' disponibile quando il socio si sveglia o arriva al lavoro;
- eventuale invio manuale staff deve rispettare gli stessi controlli anti-doppio invio.

Il sistema deve:

- selezionare solo soci attivi con livello `0.5`;
- usare solo soci con email valida presente in anagrafica;
- generare o riusare un link personale di autovalutazione;
- salvare il link personale prima dell'invio;
- inviare una email con testo prestabilito e link personale;
- salvare lo stato dell'invio;
- non inviare due volte allo stesso socio nello stesso ciclo operativo;
- non sostituire WhatsApp, che resta azione manuale.

Se i soci eleggibili sono piu' di 10, l'ordine consigliato e':

1. soci livello `0.5` con email valida;
2. mai contattati via email autovalutazione;
3. iscritti/importati da piu' tempo;
4. a parita', ordinamento alfabetico per controllo staff.

## Canali

### Email automatica

Canale principale per il nuovo flusso.

Serve per:

- inviare il link della scheda di autovalutazione;
- tracciare gli invii eseguiti;
- distinguere invii riusciti, errori e possibili mancate consegne.

### WhatsApp manuale

Resta nella sezione Autovalutazione.

Serve per:

- contattare soci senza email;
- contattare soci con email rimbalzata;
- chiedere se la mail e' stata ricevuta;
- chiedere una email corretta se il socio non ha ricevuto la mail;
- sollecitare manualmente chi non compila dopo aver ricevuto la mail;
- avvisare il socio dopo validazione livello, almeno nella prima fase.

WhatsApp non deve contenere il link diretto alla scheda di autovalutazione. Se il socio non ha ricevuto la mail, lo staff chiede l'email corretta, aggiorna la scheda socio e fa ripartire l'invio email.

## Gmail / Google Workspace

Il collegamento con Gmail deve stare sul server, non nel file HTML aperto dal browser.

Non devono mai essere salvati in HTML, repo o documentazione:

- password Gmail;
- codici di accesso Google;
- codici di rinnovo accesso Google;
- chiavi Google Cloud;
- chiavi riservate di servizio.

Le chiavi riservate devono stare solo in Supabase Vault o nei segreti delle funzioni server.

### Account consigliato

Per produzione e test e' consigliato usare l'account Gmail/Google Workspace ufficiale di Padel Village, non un account personale.

Per i test iniziali il mittente resta Gmail Padel Village, ma il destinatario viene forzato sulla email personale dello staff. In questo modo si testa il flusso reale senza inviare email ai soci.

### Abbonamento

Per 10 email al giorno nella prima fase non serve un piano marketing dedicato.

Serve pero' un account Gmail utilizzabile via API:

- un account Gmail personale puo' bastare per test tecnici a basso volume;
- per il progetto Padel Village si decide di impostare subito Google Workspace o l'account Gmail ufficiale del club, cosi' test e produzione usano lo stesso mittente operativo.

Limiti ufficiali da tenere presenti:

- Gmail personale: Google indica blocchi se si superano circa 500 email/recipienti al giorno.
- Google Workspace: Google indica 2.000 messaggi al giorno per utente su account paganti, con limiti separati su destinatari e account trial.
- il servizio tecnico Gmail ha anche limiti di quota per progetto e per utente, ma 10 invii al giorno sono molto sotto quei limiti.

Fonte verificata il 2026-05-11:

- https://support.google.com/mail/answer/22839
- https://support.google.com/a/answer/166852
- https://developers.google.com/workspace/gmail/api/reference/quota
- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://workspace.google.it/intl/it/

## Stati invio email

Ogni invio deve avere uno stato chiaro. I nomi qui sotto sono codici interni: nella schermata verranno mostrate etichette leggibili.

Stati minimi:

- `queued`: socio in coda;
- `token_ready`: link personale creato e salvato;
- `sending`: invio in corso;
- `sent`: Gmail ha accettato l'invio;
- `delivery_pending`: inviata, in attesa di eventuale mancata consegna o scheda compilata;
- `bounced`: Gmail ha ricevuto una notifica di mancata consegna;
- `send_failed`: invio non partito per errore tecnico;
- `reminder_sent`: secondo invio automatico eseguito dopo 2 giorni senza esito;
- `third_reminder_sent`: terzo invio automatico eseguito dopo altri 2 giorni senza esito;
- `completed`: scheda compilata dal socio;
- `manual_whatsapp_needed`: serve contatto manuale WhatsApp;
- `whatsapp_check_pending`: verifica WhatsApp avviata, in attesa risposta;
- `no_response_paused`: autovalutazione in pausa per nessuna risposta;
- `confirmation_sent`: email di conferma compilazione inviata;
- `paused`: socio escluso temporaneamente.

Nota importante: `sent` non significa consegna certa nella casella del socio. Significa che Gmail ha accettato il messaggio in uscita.

## Controllo mancate consegne

Il sistema deve controllare la casella Gmail usata per l'invio e cercare notifiche di mancata consegna.

Esempi di segnali da leggere:

- mittente tipo `Mail Delivery Subsystem`;
- mittente tipo `mailer-daemon`;
- oggetto o contenuto con mancata consegna;
- destinatario originale;
- Message-ID o riferimento alla email inviata, quando disponibile.

Se viene trovata una mancata consegna:

- lo stato interno diventa `bounced`;
- il socio entra nel pannello problemi;
- viene proposta l'azione WhatsApp manuale;
- la mail deve essere controllata o corretta in anagrafica.

Se non arriva una mancata consegna entro una finestra definita, per esempio 48 ore:

- lo stato interno puo' diventare `delivery_pending` o `no_bounce`;
- non va dichiarato come consegnato certo;
- il socio resta in attesa compilazione.

## Reinvio automatico e passaggio a WhatsApp

Regola operativa:

- primo invio email avviato dallo staff; dopo l'invio, il socio entra nel ciclo automatico di follow-up;
- se dopo 2 giorni non ci sono scheda compilata, risposta email, mancata consegna, pausa o blocchi tecnici, parte un secondo invio automatico;
- il secondo invio usa lo stesso link personale;
- se dopo altri 2 giorni dal secondo invio non ci sono scheda compilata, risposta email, mancata consegna, pausa o blocchi tecnici, parte un terzo invio automatico;
- il terzo invio usa lo stesso link personale e chiede anche un feedback via WhatsApp se ci sono problemi;
- se dopo il terzo invio non c'e' compilazione, il sistema non invia altre email;
- il socio passa allo stato `manual_whatsapp_needed`;
- il pannello propone l'azione WhatsApp manuale.

Questa regola evita invii ripetuti e mantiene il controllo umano dopo tre tentativi email.

Regola WhatsApp:

- cliccare `Apri WhatsApp` prepara o apre il messaggio, ma non cambia automaticamente lo stato del socio;
- il messaggio WhatsApp chiede se la mail e' stata ricevuta, non contiene il link di autovalutazione;
- se il socio non ha ricevuto la mail, lo staff chiede l'email corretta;
- quando lo staff preme `Apri WhatsApp`, l'app registra data e ora sotto il socio;
- il socio resta gestibile nei pannelli operativi con l'ultima data WhatsApp aperta visibile;
- quando arriva una email corretta, lo staff aggiorna la scheda socio e rimette il socio nel giro di invio email;
- il livello del socio resta `0.5` finche' la scheda non viene compilata, controllata e applicata dallo staff;
- se la scheda non arriva ma la mail era stata ricevuta, il socio resta gestibile con solleciti WhatsApp manuali senza link diretto.

Regola nessuna risposta:

- se dopo email, secondo invio, terzo invio e verifica WhatsApp il socio non risponde, lo staff puo' usare `Metti in pausa`;
- lo stato leggibile diventa `Autovalutazione in pausa - nessuna risposta`;
- non significa socio sospeso dal club;
- il socio resta attivo e con livello `0.5`;
- non riceve piu' invii automatici finche' resta in pausa;
- esce dai pannelli operativi e passa nello storico con esito `In pausa - nessuna risposta`;
- deve esistere un comando `Riattiva` per rimetterlo nel giro se aggiorna i dati o chiede di procedere.

## Apertura email

La lettura "email vista/aperta" non e' affidabile al 100%.

Per saperlo servirebbe un controllo tecnico di apertura, ma:

- Gmail e altri programmi di posta possono bloccare o filtrare le immagini;
- alcuni utenti leggono l'email senza caricare immagini;
- il dato puo' essere utile come indizio, non come verita' operativa.

Prima fase consigliata:

- non basare il flusso operativo su "vista";
- usare come segnali principali: inviata, mancata consegna, scheda completata;
- aggiungere eventualmente la lettura apertura solo come dato informativo in una fase successiva.

## Scheda compilata

La compilazione resta il segnale principale.

Quando il socio compila la scheda:

- la risposta viene salvata in `self_assessments`;
- il link personale passa a completato;
- il pannello invio automatico non mostra piu' il socio;
- `Post-invio e risposte` mostra il socio tra le risposte da gestire;
- l'invio email collegato deve passare a `completed`;
- viene inviata una email automatica di conferma ricezione al socio;
- il socio esce dalla coda di invio automatico.

La email di conferma compilazione deve dire solo che la scheda e' stata ricevuta correttamente. Non deve comunicare il livello definitivo, perche' il livello resta da validare dallo staff.

La scheda pubblica di autovalutazione non deve chiedere in basso la disponibilita' del socio. In questo flusso serve solo a raccogliere le risposte necessarie al livello.

Regola applicazione automatica livello:

- se livello dichiarato e livello calcolato coincidono, il livello puo' essere applicato automaticamente;
- se differiscono al massimo di `0.5`, il livello puo' essere applicato automaticamente;
- se differiscono di `1.0` o piu', la risposta resta in `Post-invio e risposte` con stato `Da validare staff`;
- i casi auto-applicati inviano la email automatica di livello aggiornato e passano nello storico;
- i casi da validare restano in Post-invio, ordinati dalla scheda piu' vecchia.

Quando lo staff applica il livello validato:

- viene inviata una seconda email automatica al socio;
- la email comunica il livello validato;
- il testo deve essere configurabile nella sezione Autovalutazione;
- WhatsApp resta disponibile solo come eventuale comunicazione manuale aggiuntiva, senza sostituire il flusso email.

## Post-invio e storico

`Post-invio e risposte` e' una coda operativa, non un pannello problemi.

Regole:

- contiene solo schede compilate e ricevute correttamente;
- non contiene email fallite, email mancanti o mancate consegne;
- se una email fallisce, il socio resta nel pannello Problemi dell'invio automatico;
- se via WhatsApp viene recuperata una email corretta, si aggiorna la scheda socio e si reinvia la mail;
- i casi con differenza livello `0` o `0.5` possono essere auto-applicati e uscire subito dal Post-invio;
- i casi con differenza livello `1.0` o superiore restano da validare manualmente;
- ordinamento predefinito Post-invio: data compilazione crescente, quindi schede piu' vecchie in alto.

Quando lo staff applica il livello e chiude il giro, il socio passa nello storico autovalutazioni.

Regole storico:

- niente pannelli operativi pesanti;
- motore di ricerca e filtri;
- filtri utili: nome/cognome, periodo, livello applicato, canale usato, esito;
- include anche i soci messi in pausa per nessuna risposta, con livello ancora `0.5`;
- dai record in pausa deve esistere un comando `Riattiva`;
- ordinamento predefinito storico: data chiusura decrescente, quindi piu' recenti in alto.

## Perche' serve un link personale

Il link personale contiene un codice riservato che collega in modo sicuro la scheda compilata al socio corretto.

Serve per:

- evitare che il socio debba fare login;
- sapere che la scheda compilata appartiene proprio a quel socio;
- non basarsi solo su nome, cognome o email, che possono essere duplicati, scritti male o cambiati;
- impedire che una compilazione generica venga agganciata al socio sbagliato;
- sapere se quel link e' stato creato, inviato, completato o scaduto;
- riusare lo stesso link nel secondo e terzo invio senza creare doppioni.

Esempio:

- Mario Rossi riceve un link con `?t=ABC123`;
- quando compila, il sistema salva la risposta con il codice `ABC123`;
- il gestionale cerca `ABC123` e capisce che la risposta e' di Mario Rossi;
- lo stato email di Mario Rossi passa a completato.

## Pannello operativo proposto

La sezione viene rinominata al singolare: `Autovalutazione`.

La sezione Autovalutazione viene rimodulata con un nuovo pannello dedicato al flusso automatico.

Prima integrazione TEST v5.375:

- menu e titolo rinominati al singolare `Autovalutazione`;
- nuovo pannello a tab: `Stato invio`, `Da inviare 0.5`, `Contattati / in attesa`, `Problemi`, `Post-invio`, `Storico`, `Testi`;
- i dati esistenti non vengono cancellati: restano riusati `assessmentTokens`, `assessmentResponses`, `assessmentDailySendLog`, `assessmentPausedTokens` e schede soci;
- `Post-invio` mostra solo schede compilate e ricevute, ordinate dalla piu' vecchia;
- `Storico` mostra giri chiusi e soci in pausa con ricerca/filtri;
- la scheda pubblica non mostra piu' il blocco `Disponibilita di gioco`;
- l'applicazione livello aggiorna la scheda socio ma non scrive piu' disponibilita dall'autovalutazione;
- la tab `Testi` salva i testi base email/WhatsApp in `assessmentCommunicationTemplates`;
- i pulsanti Gmail automatici sono predisposti ma non inviano ancora email reali: il backend Gmail resta uno step tecnico separato.

Blocchi proposti:

1. Stato invio automatico
   - tabella `Controllo / Stato / Dettaglio / Prossima azione`;
   - Email Padel Village;
   - destinatario prova;
   - invio automatico alle `05:45`;
   - limite giornaliero 10;
   - secondo invio dopo 2 giorni;
   - terzo invio dopo altri 2 giorni;
   - mancate consegne;
   - WhatsApp recupero;
   - schede ricevute da mandare a Post-invio.

2. Da inviare 0.5
   - soci livello `0.5` con email valida;
   - link personale pronto/non pronto;
   - ordine invio;
   - possibilita' di pausa.

3. Contattati / in attesa
   - email accettate da Gmail;
   - verifica WhatsApp avviata dallo staff;
   - nessuna mancata consegna rilevata;
   - scheda non ancora compilata.

4. Problemi
   - mancata consegna;
   - email mancante o non valida;
   - errore invio;
   - azione WhatsApp manuale per verificare ricezione email o recuperare email corretta;
   - data e ora dell'ultimo `Apri WhatsApp`;
   - stato `Autovalutazione in pausa - nessuna risposta` per chi non risponde mai.

5. Post-invio e risposte
   - contiene solo schede compilate e ricevute;
   - mostra in alto schede piu' vecchie;
   - separa casi auto-applicabili da casi da validare staff;
   - non mostra email fallite, email mancanti, mancate consegne o nessuna risposta.

6. Storico
   - archivio unico con ricerca e filtri;
   - contiene livelli applicati, auto-applicati e soci in pausa per nessuna risposta;
   - ordinato dai piu' recenti;
   - consente `Riattiva` sui soci in pausa.

7. Testi
   - primo invio autovalutazione;
   - secondo invio dopo 2 giorni;
   - terzo invio dopo altri 2 giorni;
   - conferma ricezione scheda;
   - comunicazione livello validato;
   - WhatsApp verifica ricezione email;
   - WhatsApp promemoria controllo mail.

## Bozze testi iniziali

Questi testi sono proposti nel mockup come base modificabile. Prima della pubblicazione devono essere riletti e approvati.

### Email primo invio

Oggetto:

`Completa la tua autovalutazione Padel Village`

Testo:

```text
Ciao {nome},

stiamo aggiornando i livelli dei soci Padel Village per organizzare partite sempre piu' equilibrate.

Ti chiediamo di compilare questa breve scheda di autovalutazione:
{link_autovalutazione}

Richiede meno di 1 minuto.

Se hai dubbi o preferisci non compilare la scheda da solo, nessun problema: ti aiutiamo noi.

Puoi scriverci su WhatsApp cliccando il bottone qui sotto. Lo staff Padel Village, con LoZio, ti aiutera a definire insieme il tuo livello di gioco.

Dopo l'invio controlleremo la scheda e aggiorneremo il tuo livello di gioco nel gestionale Padel Village.

Per informazioni o chiarimenti puoi contattare la segreteria Padel Village anche via WhatsApp:
{telefono_segreteria}
{whatsapp_segreteria}

Grazie,
Padel Village
```

### Email secondo invio

Oggetto:

`Promemoria autovalutazione Padel Village`

Testo:

```text
Ciao {nome},

ti ricordiamo la scheda di autovalutazione Padel Village che ti abbiamo inviato qualche giorno fa.

Se non l'hai ancora compilata, puoi farlo da questo link:
{link_autovalutazione}

Richiede meno di 1 minuto e ci aiuta ad aggiornare correttamente il tuo livello di gioco.

Per informazioni o chiarimenti puoi contattare la segreteria Padel Village anche via WhatsApp:
{telefono_segreteria}
{whatsapp_segreteria}

Grazie,
Padel Village
```

### Email terzo invio

Oggetto:

`Ultimo promemoria autovalutazione Padel Village`

Testo:

```text
Ciao {nome},

ti scriviamo un'ultima volta per la scheda di autovalutazione del livello di gioco Padel Village.

Se ti va di compilarla, puoi usare questo link:
{link_autovalutazione}

Richiede meno di 1 minuto.

Se invece hai problemi a fare il test, non ti va di compilarlo o preferisci essere aiutato, ci farebbe comodo capirlo.
Puoi scriverci su WhatsApp cliccando il bottone qui sotto e dirci come possiamo aiutarti.

Per informazioni o chiarimenti puoi contattare la segreteria Padel Village anche via WhatsApp:
{telefono_segreteria}
{whatsapp_segreteria}

Grazie,
Padel Village
```

### WhatsApp verifica ricezione email

Questo testo non contiene il link alla scheda. Serve solo a capire se la mail e' arrivata e, se serve, recuperare l'email corretta.

```text
Ciao {nome}, sono Maurizio di Padel Village.

Ti scrivo per verificare se hai ricevuto la mail per compilare la scheda di autovalutazione del livello di gioco.

Puoi controllare anche in spam o promozioni?

Se non l'hai ricevuta, mi rimandi qui la tua email corretta e te la rinviamo.

Grazie.
```

## Test sicuro con email personale

Prima di qualsiasi uso in produzione serve un giro completo in modalita prova.

Regola modalita prova:

- il sistema puo' selezionare soci reali livello `0.5`;
- il destinatario reale viene pero' sostituito dalla email personale indicata per il test;
- nel log resta salvata anche la email originale del socio, ma non viene usata per spedire;
- il testo email deve indicare che e' un test interno;
- i link devono puntare all'ambiente di prova;
- nessuna email reale deve partire verso soci finche' non c'e' autorizzazione esplicita.
- il mittente del test deve essere Gmail Padel Village, cosi' si verifica gia' l'account reale.

Test minimo:

1. selezionare 1-3 soci livello `0.5`;
2. inviare tutto alla email personale di test;
3. aprire una email ricevuta;
4. compilare la scheda;
5. verificare che il socio esca dal pannello invio automatico e compaia in Post-invio;
6. verificare la email automatica di conferma compilazione;
7. simulare o forzare un indirizzo errato per verificare il flusso di mancata consegna/problemi;
8. verificare la regola di secondo invio dopo 2 giorni;
9. verificare la regola di terzo invio dopo altri 2 giorni;
10. verificare che dopo il terzo tentativo il socio passi a verifica WhatsApp manuale;
11. verificare che il testo WhatsApp non contenga il link diretto alla scheda;
12. verificare che con email corretta il socio rientri nel giro di invio email.

## Componenti tecnici interni proposti

Componenti da progettare dopo approvazione mockup:

- Edge Function `assessment-email-send`;
- Edge Function o controllo automatico `assessment-email-check`;
- tabella o record cloud per log invii email;
- chiavi riservate Gmail in Supabase Vault;
- invii programmati separati tra prova e produzione;
- pannello UI in `index.html`;
- documentazione di attivazione e test.

## Sicurezza e privacy

Regole:

- nessuna credenziale Gmail in HTML;
- nessun codice di accesso Google in repo;
- nessun invio automatico in PROD senza autorizzazione esplicita;
- la modalita prova deve poter forzare tutti i destinatari su email interna;
- i log devono salvare solo dati necessari: socio, email, stato, link personale, errore sintetico, date;
- eventuali testi email devono restare modificabili e verificabili prima della pubblicazione.

Aspetto da validare con il club:

- testo privacy/consenso;
- eventuale frase per non ricevere piu' comunicazioni automatiche;
- indirizzo mittente ufficiale.

## Decisioni ancora aperte

- Indirizzo mittente PROD: Gmail personale, Gmail Padel Village o Google Workspace con dominio ufficiale.
- Oggetto email.
- Testo definitivo della email.
- Modalita finale di attivazione del giro automatico in PROD.
- Finestra dopo cui una email senza mancata consegna viene considerata "in attesa valida".
- Se aggiungere o no la lettura apertura email nella prima fase.

## Sequenza consigliata

1. Validare in TEST la UI v5.375 della nuova sezione Autovalutazione.
2. Verificare che la scheda pubblica non chieda piu' disponibilita.
3. Verificare che Post-invio contenga solo schede compilate.
4. Verificare che Storico includa livelli applicati e soci in pausa con `Riattiva`.
5. Collegare Gmail Padel Village in modalita prova sicura.
6. Eseguire test end-to-end sulla email personale staff.
7. Solo dopo, decidere account ufficiale e attivazione PROD.
