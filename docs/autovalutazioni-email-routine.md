# Autovalutazione - invio automatico email

Stato: mockup approvato; prima integrazione UI in TEST `index.html` v5.375, rifiniture UI fino a v5.382; prima funzione backend Gmail TEST predisposta in v5.383 per prova invio su email staff, con segreti Gmail solo lato Supabase; ricerca completa nella coda `Da inviare 0.5` integrata in v5.384; email HTML e log invio piu robusto in TEST v5.385; area alta Autovalutazione piu compatta e ricerca con rimando alla sottosezione corretta in TEST v5.386.

Ultimo aggiornamento: 2026-05-12 12:31

## Obiettivo

Affiancare al canale WhatsApp manuale un invio email automatico del modulo di autovalutazione.

Il perimetro iniziale considera solo i soci che nel gestionale Padel Match Organizer hanno livello `0.5`, cioe' soci ancora da valutare.

WhatsApp resta disponibile come canale manuale di controllo e recupero.

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

La funzione non attiva ancora scheduler email automatico delle 07:00 e non legge ancora le mancate consegne. Questi restano step successivi.

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
| 1-2 | Avvio invio | Il sistema legge i soci attivi dal gestionale. | Parte ogni giorno alle `07:00`, oppure da comando manuale autorizzato. |
| 3 | Selezione livello | Passano solo i soci con livello `0.5`. | Tutti gli altri livelli sono esclusi. |
| 4 | Contatto email | Serve una email valida in anagrafica. | Se manca, il socio va nei problemi e si usa WhatsApp manuale. |
| 5 | Link personale | Il sistema prepara il link personale di autovalutazione. | Il link deve essere salvato nel sistema prima dell'invio. |
| 6-7 | Prova sicura | Il mittente e' Gmail Padel Village; in modalita prova il destinatario reale viene forzato sulla tua email personale. | Nessun socio reale riceve email durante i test. |
| 8 | Invio | Il sistema invia tramite Gmail Padel Village. | Nessuna password o chiave Gmail nel file HTML. |
| 9-10 | Esito invio | Gmail puo' accettare o rifiutare l'invio. | Se fallisce, va nel pannello Problemi. |
| 11-12 | Mancata consegna | Il sistema legge da Gmail gli avvisi di email non consegnata. | Se trova una mancata consegna, propone controllo email o WhatsApp. |
| 13 | Attesa/compilazione | Se non ci sono mancate consegne, il socio resta in attesa; se compila, passa a completato. | Non diciamo "consegnata con certezza", solo "inviata/in attesa" finche' non compila. |
| 14 | Secondo invio | Se dopo 7 giorni non c'e' compilazione ne' mancata consegna, parte un secondo invio automatico. | Il secondo invio usa lo stesso link personale. |
| 15 | WhatsApp manuale | Se dopo altri 7 giorni dal secondo invio non c'e' compilazione, il socio passa a `da contattare via WhatsApp`. | Il sistema non insiste oltre via email. |
| 15A | Verifica WhatsApp | Lo staff apre WhatsApp dal pannello problemi e l'app registra subito data e ora dell'apertura. | Il socio resta gestibile con l'ultima data WhatsApp aperta visibile, senza un secondo bottone di conferma. |
| 15B | Nessuna risposta | Se il socio non risponde ne' alle email ne' a WhatsApp, lo staff puo' chiudere il tentativo in pausa. | Stato leggibile: `Autovalutazione in pausa - nessuna risposta`. Il socio resta attivo e livello `0.5`. |
| 16 | Conferma compilazione | Quando il socio compila la scheda, viene inviata una email automatica di conferma ricezione. | La conferma non comunica ancora il livello validato. |
| 17-19 | Validazione | La risposta passa in Post-invio, lo staff valida e applica il livello. | Il socio esce dal bacino `0.5`, riceve una email automatica con il livello validato e poi va nello storico. |

## Regola base

Ogni giorno l'invio automatico deve mandare al massimo 20 email di autovalutazione.

Orario invio automatico:

- invio giornaliero alle `07:00`;
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

Se i soci eleggibili sono piu' di 20, l'ordine consigliato e':

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

Per 20 email al giorno non serve un piano marketing dedicato.

Serve pero' un account Gmail utilizzabile via API:

- un account Gmail personale puo' bastare per test tecnici a basso volume;
- per il progetto Padel Village si decide di impostare subito Google Workspace o l'account Gmail ufficiale del club, cosi' test e produzione usano lo stesso mittente operativo.

Limiti ufficiali da tenere presenti:

- Gmail personale: Google indica blocchi se si superano circa 500 email/recipienti al giorno.
- Google Workspace: Google indica 2.000 messaggi al giorno per utente su account paganti, con limiti separati su destinatari e account trial.
- il servizio tecnico Gmail ha anche limiti di quota per progetto e per utente, ma 20 invii al giorno sono molto sotto quei limiti.

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
- `reminder_sent`: secondo invio automatico eseguito dopo 7 giorni senza esito;
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

- primo invio email automatico;
- se dopo 7 giorni non ci sono scheda compilata, mancata consegna o blocchi tecnici, parte un secondo invio automatico;
- il secondo invio usa lo stesso link personale;
- se dopo altri 7 giorni dal secondo invio non c'e' compilazione, il sistema non invia altre email;
- il socio passa allo stato `manual_whatsapp_needed`;
- il pannello propone l'azione WhatsApp manuale.

Questa regola evita invii ripetuti e mantiene il controllo umano dopo due tentativi email.

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

- se dopo email, secondo invio e verifica WhatsApp il socio non risponde, lo staff puo' usare `Metti in pausa`;
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
- riusare lo stesso link nel secondo invio senza creare doppioni.

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
   - invio automatico alle `07:00`;
   - limite giornaliero 20;
   - secondo invio dopo 7 giorni;
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
   - secondo invio dopo 7 giorni;
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

Richiede circa 2 minuti.

Dopo l'invio controlleremo la scheda e aggiorneremo il tuo livello nel gestionale Padel Village.

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

Richiede circa 2 minuti e ci aiuta ad aggiornare correttamente il tuo livello.

Grazie,
Padel Village
```

### WhatsApp verifica ricezione email

Questo testo non contiene il link alla scheda. Serve solo a capire se la mail e' arrivata e, se serve, recuperare l'email corretta.

```text
Ciao {nome}, sono Maurizio di Padel Village.

Ti scrivo per verificare se hai ricevuto la mail per compilare la scheda di autovalutazione del livello.

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
8. verificare la regola di secondo invio dopo 7 giorni;
9. verificare che dopo il secondo tentativo il socio passi a verifica WhatsApp manuale;
10. verificare che il testo WhatsApp non contenga il link diretto alla scheda;
11. verificare che con email corretta il socio rientri nel giro di invio email.

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
