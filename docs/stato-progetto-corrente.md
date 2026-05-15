# Stato progetto corrente

Ultimo aggiornamento: 2026-05-15 23:17

Questo file e' la fonte rapida ufficiale per capire su quale versione del progetto stanno lavorando le chat RAGIONAMENTO, MOCK-UP e SVILUPPO.

Se le informazioni scritte in un prompt non coincidono con questo file, considera piu affidabile questo file e chiedi conferma prima di procedere.

## Lettura obbligatoria prima di iniziare

Per le chat RAGIONAMENTO e MOCK-UP, prima di proporre idee, piani, layout o testi:

1. leggere questo file;
2. leggere il `Registro versioni per sezione`;
3. leggere i documenti collegati alla sezione su cui si sta lavorando;
4. dichiarare in apertura quale versione TEST/PROD risulta corrente;
5. non modificare codice, funzioni, SQL, deploy o dati reali.

Per la chat SVILUPPO, prima di modificare file reali:

1. leggere questo file;
2. leggere i documenti obbligatori del progetto;
3. verificare branch, stato Git e commit corrente;
4. integrare solo piani o mockup approvati;
5. aggiornare questo file quando cambia la versione TEST o PROD.

## Versione corrente

| Ambiente | Versione | Branch | Commit app pubblicata |
|---|---:|---|---|
| PROD | v5.422 | `main` | `6549f18` |
| TEST | v5.433 | `test-preview` | `63f3920` |
| TEST sviluppo | v5.433 | `test/accessi-staff-guidati` | `63f3920` |

Nota: PROD resta fermo a v5.422. In TEST e' pubblicata v5.433: `Anagrafica soci` diventa una voce unica del menu, apre direttamente l'attuale pagina soci, la sottovoce `Database soci` sparisce e `Gruppi soci` viene rimosso dalla UI e dai flussi operativi. Restano schede soci, ricerca, filtri, export rubrica v5.432, nuovo/modifica/disattivazione/cancellazione socio e refresh Autovalutazione. La Edge Function TEST `assessment-email-send` resta v16 con `verify_jwt=false`. Lo scheduler email Autovalutazione PROD resta non attivo.

## Link

- TEST: `https://padelvillage.github.io/padel-match-organizer/test/?env=test`
- PROD: `https://padelvillage.github.io/padel-match-organizer/`

## Ultimo lavoro pubblicato

La versione v5.433 e' pubblicata in TEST al commit `63f3920`; PROD resta a v5.422.

Contiene:

- Autovalutazione fino a v5.407, inclusi storico compatto, lettura risposte email, gestione mancate consegne e stato invio compatto.
- Database soci con riepilogo KPI in tabella compatta.
- Conteggio `Senza email` nel riepilogo Database soci e nel filtro `Attenzione dati`.
- Autovalutazione v5.409 TEST con nuova tab `Matchpoint`: livelli validati internamente da riportare manualmente su Matchpoint, bottone `Segna inserito su Matchpoint` e traccia nello storico.
- Autovalutazione v5.410 TEST con demo non persistente `?env=test&demoMatchpoint=1` per mostrare una riga fittizia in Matchpoint senza salvare dati reali.
- Autovalutazione v5.411 TEST con nuova tab `Cruscotto mattutino`: riepiloga Problemi, Post-invio, Da controllare, Matchpoint e Da inviare con azioni rapide verso i flussi esistenti.
- Autovalutazione v5.412 TEST con prima routine backend email: invio massimo 10 soci alle 05:45 e controlli Gmail automatici alle 06:10, 10:30, 15:30 e 20:30. Edge Function TEST `assessment-email-send` v14 con `verify_jwt=false`, controllo interno JWT staff o secret Vault, filtro tecnico `targetMemberIds` per test mirati e GRANT espliciti `service_role` per le tabelle lette/scritte dalla routine. Nota operativa: il cron TEST generale e' stato rimosso il 2026-05-14 07:39 per evitare invii automatici reali; il test reale controllato delle 09:00 Europe/Rome sul socio `PMO-000948` ha inviato una sola email.
- Autovalutazione v5.413 TEST con nuovo `Cruscotto mattutino` tabellare `Processo utenti`: assorbe le informazioni della vecchia tab `Stato invio`, mantiene come tab principali solo `Cruscotto mattutino`, `Storico`, `Testi` e `Scheda pubblica`, e usa filtri rapidi (`Tutti`, `Oggi`, `Da inviare`, `In attesa`, `Problemi`, `Risposte`, `Da controllare`, `Matchpoint`, `Completati`) alimentati dalle logiche gia esistenti.
- Autovalutazione v5.414 TEST: rimossa dal `Cruscotto mattutino` la barra informativa `Matchpoint va aggiornato manualmente...`, gia nota allo staff. Nessuna modifica a invii, scheduler, Gmail, storico, Matchpoint reale o PROD.
- Autovalutazione v5.415 TEST: il `Cruscotto mattutino` mostra al massimo 20 righe per volta per il filtro attivo, mantenendo i conteggi reali e aggiungendo `Mostra altri 20` quando esistono altri soci. Nessuna modifica a invii, scheduler, Gmail, storico, Matchpoint reale o PROD.
- Autovalutazione v5.416 TEST: hotfix del `Cruscotto mattutino`; il limite progressivo a 20 righe usa uno stato separato dalla funzione di calcolo, evitando il blocco dei box filtro. Nessuna modifica a invii, scheduler, Gmail, storico, Matchpoint reale o PROD.
- Autovalutazione v5.417 TEST: aggiunta ricerca interna al `Cruscotto mattutino` / `Processo utenti`, estesa la ricerca a ID socio, email, telefono, token e dati del giro, e resa stabile la ricerca nello `Storico` mentre si digita. Serve a ritrovare anche soci usciti dai primi 20 o finiti in filtri diversi. Nessuna modifica a invii, scheduler, Gmail, storico dati, Matchpoint reale o PROD.
- Autovalutazione v5.418 TEST/PROD: i controlli manuali Gmail `Aggiorna risposte email` e `Controlla mancate consegne` non compaiono piu nei pannelli operativi e sono disponibili solo dentro `Strumenti tecnici avanzati`. Il deploy PROD non ha applicato SQL scheduler e non ha attivato cron email Autovalutazione.
- Autovalutazione v5.419 TEST: il `Cruscotto mattutino` aggancia i log cloud `assessment_email` anche tramite ID giocatore `memberId`/`PMO-...`, importa automaticamente in modo silenzioso gli ultimi log cloud quando si apre Autovalutazione, archivia il token precedente se arriva un nuovo invio e considera un nuovo invio successivo a un ciclo gia chiuso come nuovo ciclo `In attesa`, non come `Completato`.
- Autovalutazione v5.420 TEST: nella ricerca `Cerca nel processo`, i box filtro sopra la tabella si evidenziano quando contengono il socio cercato, cosi' lo staff vede subito se il socio e' in `Da inviare`, `In attesa`, `Problemi`, `Risposte`, `Da controllare`, `Matchpoint` o `Completati`.
- Autovalutazione v5.421 TEST/PROD: la ricerca del `Cruscotto mattutino` e dello `Storico` diventa a parole indipendenti: se il nome/cognome del socio viene digitato in ordine diverso, il socio viene comunque trovato.
- Anagrafica soci / Autovalutazione v5.422 TEST/PROD: dopo aggiunta, modifica, disattivazione o cancellazione socio, la sezione Autovalutazione viene rinfrescata subito; la ricerca del Database soci usa parole indipendenti, coerente con cruscotto e storico.
- Anagrafica soci / Cloud v5.423 TEST sviluppo: aggiunta, modifica, disattivazione/riattivazione e cancellazione socio preparano subito la scrittura puntuale del record `member` in Supabase tramite RPC staff, senza attendere il backup cloud. Se la scrittura cloud non riesce, la modifica locale resta salvata e viene mostrato un avviso.
- Autovalutazione v5.424 TEST: l'invio mattutino delle email passa a controllo manuale staff. La Edge Function TEST `assessment-email-send` v15, `verify_jwt=false`, aggiunge `routine-plan` per preparare il lotto e `routine-approve` per approvarlo/inviarlo; `routine-send` blocca gli invii generali se non esiste un lotto approvato. La UI del `Cruscotto mattutino` mostra `Prepara lotto` e `Approva invio`; il limite resta massimo 10 email, senza obbligo di arrivare a 10 se i soci pronti sono meno. Nessuna modifica SQL, nessun scheduler attivato, nessun cambio a PROD.
- Autovalutazione v5.425 TEST: micro-pulizia UI del `Cruscotto mattutino`; il comando `Prepara lotto` / `Approva invio N` viene spostato nella testata del pannello e il riquadro descrittivo separato dell'invio mattutino viene rimosso. Nessuna modifica a Edge Function, SQL, invii, scheduler, Gmail, Matchpoint, dati reali o PROD.
- Autovalutazione v5.426 TEST: hotfix del pulsante `Pulisci` nella ricerca `Cerca nel processo`; oltre allo stato interno, ora viene svuotato anche il campo input prima del rerender, evitando che una ricerca rimasta attiva nasconda le righe del filtro `Problemi`. Nessuna modifica a Edge Function, SQL, invii, scheduler, Gmail, Matchpoint, dati reali o PROD.
- Autovalutazione v5.427 TEST: micro-pulizia UI prima del test; rimossi i pulsanti WhatsApp diretti dalle sottosezioni operative Autovalutazione (`Cruscotto mattutino`, `Problemi`, `Contattati / in attesa`, `Storico` e flussi legacy di invio guidato). Le azioni operative rimandano alla scheda socio/dettaglio. Il pulsante WhatsApp resta disponibile solo nella scheda socio o nelle aree generali non Autovalutazione. Nessuna modifica a Edge Function, SQL, invii email, scheduler, Gmail, Matchpoint, dati reali o PROD.
- Autovalutazione v5.428 TEST: dopo test positivo con lotto approvato da 10 email ricevute, l'oggetto del primo invio viene chiarito in `Padel Village - Completa la tua autovalutazione del livello di gioco`. Aggiornati template app, migrazione del vecchio oggetto standard salvato localmente e fallback della Edge Function TEST `assessment-email-send`, pubblicata come versione 16 con `verify_jwt=false`. Nessuna modifica a SQL, scheduler, Matchpoint, dati reali o PROD.
- Autovalutazione v5.429 TEST: integrata la soluzione finale Mix del mockup `mockup/autovalutazione-cruscotto-processo-utenti-mockup.html`; rimossa dal `Cruscotto mattutino` la barra alta con i sei box routine (`Invio email`, `Limite oggi`, `Inviate oggi`, `Prossimo controllo Gmail`, `Ultimo controllo`, `Stato routine`). La tabella `Processo utenti` mantiene la colonna `Routine` subito dopo `Socio`, con filtri, ricerca, `Pulisci` e comandi `Prepara lotto` / `Approva invio N` invariati. Nessuna modifica a Edge Function, SQL, invii email, scheduler, Gmail, Matchpoint, dati reali o PROD.
- Autovalutazione / Scheda socio v5.430 TEST: integrato il mockup `mockup/scheda-socio-whatsapp-autovalutazione-mockup.html`; il bottone `Apri WhatsApp` nella scheda socio apre una finestra di scelta messaggio con i testi manuali Autovalutazione `Richiesta email mancante`, `Verifica ricezione email` e `Promemoria controllo mail`. Lo staff puo' copiare il testo, aprire WhatsApp con testo precompilato oppure aprire WhatsApp senza testo. WhatsApp resta manuale, senza link diretto alla scheda e senza invio automatico. Nessuna modifica a Edge Function, SQL, scheduler, Gmail, Matchpoint, dati reali o PROD.
- Anagrafica soci / Database soci v5.431 TEST: integrato il mockup `mockup/database-soci-esporta-rubrica-soci-mockup.html`; in `Database soci` compare il comando `Esporta rubrica soci`, che scarica solo CSV Google per import manuale in Google Contatti. La prima esportazione scarica i soci attivi con telefono valido; le successive scaricano solo i nuovi soci importati da Matchpoint e non ancora esportati. La app salva in localStorage lo stato `memberContactsExportState`, include lo stato in backup/snapshot, segnala telefoni cambiati, telefoni mancanti/non validi, duplicati, elementi da verificare e inattivi esclusi, e prevede `Riesporta tutti` con conferma. Nessuna API Google, nessuna sincronizzazione automatica, nessun invio WhatsApp automatico, nessuna modifica a SQL, Edge Function, scheduler, dati reali o PROD.
- Anagrafica soci / Database soci v5.432 TEST: integrato l'aggiornamento approvato del mockup `mockup/database-soci-esporta-rubrica-soci-mockup.html` per gestire `Email mancante` nell'export rubrica. Il riepilogo mostra `Senza email`; la tabella `Da correggere` distingue `Email mancante` da `Senza telefono`; un socio senza email viene esportato se ha telefono valido e il campo email resta vuoto nel CSV Google; un socio senza telefono resta escluso. Rimossi dal pannello export i testi lunghi di spiegazione. Nessuna API Google, nessuna sincronizzazione automatica, nessun invio WhatsApp automatico, nessuna modifica a SQL, Edge Function, scheduler, Matchpoint reale, dati reali o PROD.
- Anagrafica soci v5.433 TEST: integrato il mockup `mockup/anagrafica-soci-voce-unica-mockup.html`. `Anagrafica soci` e' una voce singola del menu laterale con sottotitolo `Schede e contatti`; cliccandola si apre direttamente l'elenco soci. La sottovoce `Database soci`, la voce `Gruppi soci`, il badge gruppi e il bottone `+` gruppi non compaiono piu. La pagina mantiene KPI, ricerca, filtri, lista soci, `+ Nuovo socio`, `Esporta rubrica soci`, scheda socio, salvataggio/modifica/disattivazione/cancellazione socio e refresh Autovalutazione. Apri Partite non usa piu gruppi salvati come sorgente; Chiudi Partite non mostra piu riferimenti a gruppo origine. Nessuna modifica a SQL, Edge Function, scheduler, Supabase schema, Matchpoint reale, dati reali o PROD.
- Routine TEST una tantum: il job `pmo-assessment-email-single-test-1630` per `PMO-000948` si e' eseguito correttamente alle 16:30 Europe/Rome, si e' rimosso e ha inviato una sola email confermata dall'utente. Non ha coinvolto la coda generale e non ha toccato PROD.
- Documentazione aggiornata per v5.433 TEST.

Non contiene modifiche a:

- API Google o Google Contatti;
- invio WhatsApp automatico;
- Edge Function, SQL o scheduler;
- Matchpoint reale o dati reali;
- PROD.

Nota tecnica: per permettere l'export incrementale, i soli nuovi soci aggiunti da un import clienti Matchpoint vengono marcati localmente con metadati `matchpointImportedAt` / `matchpointLastImportedAt` / `matchpointSource`. I soci gia esistenti non vengono sovrascritti da questa modifica.

Nota: il deploy PROD v5.422 non applica SQL scheduler e non attiva routine email automatiche. Il controllo live su Supabase PROD del 2026-05-15 08:52 mostra in `cron.job` solo `pmo-data-routines-dispatcher-prod`, cioe' lo scheduler dati/Matchpoint gia esistente. Il cron scheduler TEST generale non e' attivo dopo la rimozione manuale del 2026-05-14 07:39. Il job una tantum TEST `pmo-assessment-email-single-test-1630` per `PMO-000948` si e' gia eseguito e rimosso.

Nota tecnica PROD 2026-05-13 20:08: durante il test controllato in PROD e' stato riallineato lo schema Supabase `assessment_tokens`, aggiungendo la colonna `registered_at` richiesta dalla RPC `upsert_assessment_tokens_admin`. La modifica non cambia la versione app e non invia email.

## Regole operative per le chat

### Chat RAGIONAMENTO

- Legge questo file prima di proporre piani.
- Definisce idee, requisiti, flussi e priorita.
- Non modifica il codice principale.
- Se la proposta ha impatto grafico, prepara un passaggio per la chat MOCK-UP.
- Se la proposta richiede integrazione reale, prepara un passaggio per la chat SVILUPPO.

### Chat MOCK-UP

- Legge questo file prima di creare mockup.
- Crea solo prototipi separati dentro `mockup/`.
- Non modifica `index.html`, versioni ufficiali, SQL, funzioni Supabase o file di deploy.
- A fine lavoro prepara un passaggio consegne per SVILUPPO con file, stato approvazione, testi, regole grafiche e verifiche consigliate.

### Chat SVILUPPO

- E' l'unica chat autorizzata a modificare la web app principale.
- Integra solo piani o mockup approvati.
- Aggiorna questo file a ogni nuova versione TEST o PROD.
- Non porta modifiche in PROD senza autorizzazione esplicita.

### Chat SVILUPPO TEST

- Legge questo file, la policy TEST/PROD e `ambienti-test-prod.md` prima di modificare file reali.
- Implementa e corregge solo in TEST.
- Pubblica le versioni validate sul canale TEST quando richiesto.
- Non promuove in PROD, non attiva routine PROD e non modifica dati reali PROD.
- Mantiene le routine TEST manuali o one-shot autorizzate.

### Chat PROMOZIONE PROD

- Legge questo file, la policy TEST/PROD, la procedura deploy e `ambienti-test-prod.md` prima di ogni passaggio.
- Non sviluppa nuove funzioni e non corregge direttamente in PROD.
- Promuove solo versioni TEST gia validate, dopo preflight pulito e comando esplicito `PROMUOVI PROD`.
- Esegue rollback solo verso versione stabile precedente e solo dopo comando esplicito `ROLLBACK PROD`.
- Verifica che scheduler, routine e dati PROD approvati restino preservati salvo richiesta esplicita.

## File principali da consultare

- Policy TEST/PROD, routine e deploy:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/docs/pmo-policy-test-prod-routine-deploy.md`
- Procedura deploy TEST -> PROD:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/docs/procedura-deploy-test-prod.md`
- Ambienti TEST e PROD:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/docs/ambienti-test-prod.md`
- Registro versioni per sezione:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/docs/registro-versioni-sezioni.md`
- Regola mockup grafici:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/docs/regola-mockup-grafici.md`
- Regole Supabase Data API / grant futuri:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/docs/supabase-data-api-regole.md`
- Algoritmo Riempi Slot:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/docs/algoritmo-riempi-slot.md`
- Matchpoint / DATI:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/docs/matchpoint.md`
- Routine dati automatiche:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/docs/routine-dati-automatiche.md`
- Autovalutazione email:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/docs/autovalutazioni-email-routine.md`

## Documentazione da leggere in base all'area

| Area di lavoro | Documenti da leggere prima |
|---|---|
| Autovalutazione | `stato-progetto-corrente.md`, `registro-versioni-sezioni.md`, `autovalutazioni-email-routine.md` |
| Database soci / Anagrafica | `stato-progetto-corrente.md`, `registro-versioni-sezioni.md`, `algoritmo-riempi-slot.md` |
| DATI / Matchpoint / backup | `stato-progetto-corrente.md`, `registro-versioni-sezioni.md`, `matchpoint.md`, `routine-dati-automatiche.md` |
| Supabase / SQL / Data API | `stato-progetto-corrente.md`, `registro-versioni-sezioni.md`, `ambienti-test-prod.md`, `supabase-data-api-regole.md` |
| Sviluppo TEST | `stato-progetto-corrente.md`, `pmo-policy-test-prod-routine-deploy.md`, `ambienti-test-prod.md`, `registro-versioni-sezioni.md`, documento della sezione |
| Promozione PROD / rollback | `stato-progetto-corrente.md`, `pmo-policy-test-prod-routine-deploy.md`, `procedura-deploy-test-prod.md`, `ambienti-test-prod.md`, `registro-versioni-sezioni.md`, documenti delle sezioni toccate |
| Routine / scheduler / comunicazioni | `stato-progetto-corrente.md`, `pmo-policy-test-prod-routine-deploy.md`, `ambienti-test-prod.md`, documento area (`routine-dati-automatiche.md`, `autovalutazioni-email-routine.md` o `matchpoint.md`) |
| Apri Partite / algoritmo | `stato-progetto-corrente.md`, `registro-versioni-sezioni.md`, `algoritmo-riempi-slot.md`, `matchpoint.md` |
| Chiudi Partite / WhatsApp | `stato-progetto-corrente.md`, `registro-versioni-sezioni.md`, `algoritmo-riempi-slot.md` |
| Nuovi mockup grafici | `stato-progetto-corrente.md`, `registro-versioni-sezioni.md`, `regola-mockup-grafici.md` e il mockup approvato piu recente della sezione |

## Percorsi progetto

- Root progetto:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer`
- Repo Git:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/padel-match-organizer-github`
- App principale:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/padel-match-organizer-github/index.html`
- Mockup:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/padel-match-organizer-github/mockup`
- File temporanei:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/lavoro-codex`

## Percorso da non usare

Non usare:

`/Users/maurizioaprea/Documents/New project`
