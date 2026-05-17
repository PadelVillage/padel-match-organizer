# Stato progetto corrente

Ultimo aggiornamento: 2026-05-17 13:28

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
| PROD | v5.441 | `main` | `85edd3e` |
| TEST | v5.447 | `test-preview` | `a2ef869` |
| TEST sviluppo | v5.447 | `test/accessi-staff-guidati` | `a2ef869` |

Nota: TEST app e' avanti a v5.447. La v5.447 corregge titolo, meta tag e link copiati del flusso pubblico `Autovalutazione > Scheda pubblica > Link esterno`: il titolo preview diventa `Autovalutazione Livello di Gioco`, la descrizione diventa `Padel Village`, il link pubblico punta a `autovalutazione.html?assessment=link-esterno` e il link TEST punta a `test/autovalutazione.html?env=test&assessment=link-esterno&memberId=PMO-000948`. Il codice pubblicato su branch TEST e' corretto; la preview reale WhatsApp/Telegram del link pubblico radice cambiera solo dopo promozione PROD, perche quel link e' servito da `main`. Nessuna modifica a PROD, SQL, Edge Function, scheduler, Matchpoint, Gmail reale, WhatsApp automatico o dati reali.

Nota precedente v5.446: TEST app rendeva ufficiale il socio test `PMO-000948` con email `aprea.maurizio@gmail.com` nel `Cruscotto mattutino` Autovalutazione e nel test form `Scheda pubblica > Link esterno`. I bottoni test `Invia seconda email` e `Invia terza email` sono limitati alla doppia verifica `PMO-000948` + `aprea.maurizio@gmail.com`. Non cancella automaticamente il vecchio record `PMO-000956`: l'eventuale pulizia dati resta un passaggio separato in TEST Anagrafica. Nessuna modifica a PROD, SQL, Edge Function, scheduler, Matchpoint, Gmail reale, WhatsApp automatico o dati reali.

Nota precedente v5.445: TEST app correggeva il bottone `Socio test` nel `Cruscotto mattutino` Autovalutazione: la ricerca del socio prova considera ID PMO e campi ID alternativi, usa l'email `aprea.maurizio@gmail.com` come fallback per mostrare una riga bloccata se l'ID non coincide, e se il socio non esiste nei dati caricati non svuota piu la lista `Processo utenti`. Non crea soci, non scrive Supabase e non modifica dati reali.

Nota precedente v5.444: TEST app integrava in `Autovalutazione > Scheda pubblica > Link esterno` il campo `Sesso` nel test form staff e nel form pubblico tokenizzato marcato `assessment=link-esterno`. Le opzioni sono `Maschio`, `Femmina` e `Preferisco non indicarlo`; quest'ultima prosegue ma lato staff resta `Da completare`. Il dato viene salvato nel `raw_response` JSON dell'autovalutazione e, se il socio riconosciuto aveva sesso mancante, viene applicato alla scheda locale quando la risposta viene importata. Nessuna modifica a PROD, SQL, Edge Function, scheduler, Supabase schema, Matchpoint, Gmail reale, WhatsApp automatico o dati reali.

Nota precedente v5.443: TEST app integrava nel `Cruscotto mattutino` Autovalutazione il bottone compatto `Socio test`, che recupera direttamente `PMO-000956` con email `aprea.maurizio@gmail.com` senza dipendere da filtro, ricerca o limite progressivo. I bottoni `Invia seconda email` e `Invia terza email` sono disponibili solo se ID PMO ed email corrispondono; se l'email non coincide viene mostrato `Email socio test non verificata`. Ogni invio resta manuale e richiede conferma. Nessuna modifica a PROD, SQL, Edge Function, scheduler, Matchpoint, Gmail reale, WhatsApp o dati reali.

Nota precedente v5.442: TEST app integrava in `Autovalutazione > Scheda pubblica` il pannello staff `Link esterno`, con campo link readonly, `Copia link`, test form locale per `PMO-000956` / `aprea.maurizio@gmail.com`, preview con logo Padel Village, privacy obbligatoria e invio test solo simulato. La modifica era solo UI TEST: non crea dati, non invia email, non modifica Supabase, SQL, Edge Function, scheduler, Matchpoint, Gmail reale, WhatsApp automatico o PROD.

Nota precedente v5.441: TEST e PROD app erano allineati a v5.441. La v5.441 integra nel `Cruscotto mattutino` Autovalutazione le colonne operative del follow-up email (`Ultimo invio`, `Prossimo step`, `Prossima finestra`, `Stop / Alert`) e i bottoni test `Invia seconda email` / `Invia terza email` solo per `PMO-000956` con email `aprea.maurizio@gmail.com` in ambiente TEST. In PROD i bottoni test non sono visibili perche' protetti da `PMO_IS_TEST_ENV`. Nessuna modifica a SQL, scheduler, Edge Function, segreti PROD, Gmail reale, Matchpoint o dati reali.

Nota precedente v5.440: TEST e PROD app erano allineati a v5.440. La promozione PROD ha pubblicato la micro-correzione del testo della riga `Protezione email Autovalutazione`, che mostra `TEST protetto: destinatari reali sostituiti. Comportamento atteso in ambiente TEST.` con separatore chiaro in TEST e `PROD corretto: invii reali abilitati.` in PROD quando la configurazione e' corretta. La Edge Function PROD `assessment-email-send` e' stata allineata al sorgente validato come versione 14 con `verify_jwt=true`; la Edge Function TEST resta versione 18 con `verify_jwt=false`. Nessun SQL, scheduler, segreto PROD, Gmail reale, Matchpoint o dato reale e' stato modificato; lo scheduler email Autovalutazione PROD resta non attivo.

Nota Supabase PROD 2026-05-16 23:24: ricevuto comando esplicito `PROMUOVI PROD`, e' stata applicata solo la migrazione idempotente `supabase/migrations/20260516204711_pmo_post_match_feedback_no_pin_schema.sql` sul project ref PROD `qqbfphyslczzkxoncgex`, gia preparata e testata in TEST al commit `467f536`. Stato verificato dopo applicazione: `post_match_feedback_tokens` e `post_match_feedback_responses` esistono; RPC `upsert_post_match_feedback_tokens_admin`, `submit_post_match_feedback_public` e `get_post_match_feedback_by_tokens` presenti; `upsert_post_match_feedback_tokens_admin('[]'::jsonb)` restituisce `AUTH_REQUIRED` e non errore relazione; `get_post_match_feedback_by_tokens(array[]::text[])` restituisce 0 righe. Non sono stati modificati app HTML, Edge Function, scheduler, segreti, Gmail, WhatsApp, Matchpoint o dati reali; `cron.job` PROD contiene ancora solo `pmo-data-routines-dispatcher-prod`.

## Link

- TEST: `https://padelvillage.github.io/padel-match-organizer/test/?env=test`
- PROD: `https://padelvillage.github.io/padel-match-organizer/`

## Ultimo lavoro pubblicato

La versione v5.447 e' pubblicata in TEST al commit app `a2ef869`. PROD resta v5.441 al commit app `85edd3e`. La modifica v5.447 aggiorna solo titolo, meta tag e URL copiati del flusso pubblico `Autovalutazione > Scheda pubblica > Link esterno`, preparando la preview WhatsApp/Telegram con `Autovalutazione Livello di Gioco` e `Padel Village`. Nota: il link pubblico radice resta servito da PROD/main finche' la modifica non viene promossa in PROD. Non sono stati eseguiti deploy Edge Function, SQL, modifiche scheduler, modifiche segreti, invii email reali, modifiche Matchpoint o dati reali.

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
- Anagrafica soci v5.433 TEST: integrato il mockup `mockup/anagrafica-soci-voce-unica-mockup.html`. `Anagrafica soci` e' una voce singola del menu laterale con sottotitolo `Schede e contatti`; cliccandola si apre direttamente l'elenco soci. La sottovoce `Database soci`, la voce `Gruppi soci`, il badge gruppi e il bottone `+` gruppi non compaiono piu. La pagina mantiene KPI, ricerca, filtri, lista soci, `+ Nuovo socio`, `Esporta rubrica soci`, scheda socio, salvataggio/modifica/disattivazione/cancellazione socio e refresh Autovalutazione. Apri Partite non usa piu gruppi salvati come sorgente; Chiudi Partite non mostra piu riferimenti a gruppo origine e i testi attivi rimandano ad Apri Partite / lista soci, non a partite da gruppo. Nessuna modifica a SQL, Edge Function, scheduler, Supabase schema, Matchpoint reale, dati reali o PROD.
- Autovalutazione v5.434 TEST: integrato il mockup `mockup/autovalutazione-cruscotto-lotto-manuale-mockup.html`; nel `Cruscotto mattutino` il lotto email resta manuale e non parte nessuna email senza conferma staff. La testata mostra `Prepara lotto` quando non c'e' un lotto e, a lotto pronto, `Invia selezionati` e `Invia tutti`; sotto ricerca e filtri compare `Lotto email manuale` con colonne `Sel.`, `Socio`, `Routine`, `Fase`, `Prossimo step`, `Email`, `Invii`, `Azioni`. Ogni riga puo essere inviata singolarmente con `Invia email` oppure aperta in `Dettaglio`. Nessuna modifica a Edge Function, SQL, scheduler, Gmail, WhatsApp, Matchpoint, dati reali o PROD.
- Autovalutazione v5.435 TEST: micro-correzione del lotto email manuale. Se esiste un lotto del giorno in stato `pending`, senza righe inviate o fallite, la testata del `Cruscotto mattutino` mostra anche `Rigenera lotto` dopo `Invia selezionati` e `Invia tutti`. Il comando chiede conferma, sostituisce il lotto non inviato usando `routine-plan` con `regenerate:true` e non invia email. La Edge Function TEST `assessment-email-send` e' pubblicata come v17 con `verify_jwt=false`; il comportamento standard di `routine-plan` resta invariato senza flag. Nessuna modifica a SQL, scheduler, Gmail, WhatsApp, Matchpoint, dati reali o PROD.
- Anagrafica soci / Database soci v5.436 TEST: nella tabella `Da correggere` del pannello `Esporta rubrica soci`, `Email mancante` diventa un bottone solo quando il socio ha telefono valido e `member.id`. Il click apre la scheda socio reale con `openMemberCard(..., { force:true })`, senza aprire WhatsApp direttamente e senza salvare dati. `Email mancante` nell'anteprima contatti resta statico; `Senza telefono`, `Telefono non valido`, `Duplicato telefono`, `Telefono cambiato` e `Inattivo` restano statici. Nessuna modifica a CSV Google, API Google, sincronizzazione Google, WhatsApp automatico, SQL, Edge Function, scheduler, Matchpoint reale, dati reali o PROD.
- Autovalutazione v5.437 TEST: bugfix del `Cruscotto mattutino`; i box filtro del `Processo utenti` diventano filtri rapidi reali collegati con listener dedicati dopo il render. Il filtro selezionato resta evidenziato, la lista si aggiorna subito, compare una riga `Filtro attivo` quando non e' `Tutti` e i filtri senza risultati mostrano `Nessun socio in questo stato.`. Nessuna modifica a lotto manuale, invii email, Edge Function, SQL, scheduler, Gmail, WhatsApp, Matchpoint, dati reali o PROD.
- Autovalutazione v5.438 TEST: micro-correzione UX del `Cruscotto mattutino`; il blocco `Lotto email manuale` non compare piu tra box filtro e risultati, ma viene mostrato dopo la lista filtrata `Processo utenti` o dopo il messaggio vuoto. Restano invariati filtri, ricerca, `Pulisci`, comandi testata `Prepara lotto` / `Invia selezionati` / `Invia tutti` / `Rigenera lotto`, checkbox lotto, invio singola riga e `Dettaglio`. Nessuna modifica a logica lotto, invii email, Edge Function, SQL, scheduler, Gmail, WhatsApp, Matchpoint, dati reali o PROD.
- Amministrazione / Supabase / Autovalutazione v5.439 TEST: integrato il mockup `mockup/supabase-diagnostica-email-autovalutazione-mockup.html`. La verifica `Verifica TEST/PROD` mostra la riga `Protezione email Autovalutazione` con badge `Protetto`, `OK`, `ALERT` o `Non verificato`. La Edge Function TEST `assessment-email-send` e' v18, `verify_jwt=false`, e aggiunge l'azione non inviante `config-check`, che non invia email, non scrive log operativi e restituisce solo stato sanificato su ambiente runtime, modalita test destinatari e sicurezza invii reali. In PROD il codice UI blocca `Invia selezionati`, `Invia tutti` e `Invia email` se la diagnostica segnala modalita test email o controllo non verificabile. Nessuna modifica a PROD, SQL, scheduler, segreti PROD, Gmail reale, Matchpoint o dati reali.
- Amministrazione / Supabase / Autovalutazione v5.440 TEST: micro-correzione del testo diagnostico `Protezione email Autovalutazione`; in TEST il messaggio `TEST protetto: destinatari reali sostituiti.` viene separato chiaramente da `Comportamento atteso in ambiente TEST.`. Nessuna modifica a Edge Function, SQL, scheduler, segreti PROD, Gmail reale, Matchpoint, dati reali o PROD.
- Autovalutazione v5.441 TEST/PROD: integrato il mockup `mockup/autovalutazione-followup-email-cruscotto-mockup.html` nel `Cruscotto mattutino`. La tabella `Processo utenti` mostra riga per riga `Ultimo invio`, `Prossimo step`, `Prossima finestra` e `Stop / Alert`, calcolando la prima finestra utile dei richiami alle 09:30 solo dopo almeno 48 ore reali dall'ultimo invio. Gli stop operativi visibili includono risposta email, scheda compilata, mancata consegna, socio in pausa, problemi email e recupero manuale dopo terza email. I bottoni test `Invia seconda email` e `Invia terza email` compaiono solo in TEST per `PMO-000956` con email `aprea.maurizio@gmail.com` e non sono visibili in PROD. Nessuna modifica a Edge Function, SQL, scheduler, segreti PROD, Gmail reale, Matchpoint o dati reali.
- Autovalutazione v5.442 TEST: integrato il mockup `mockup/registrazione-link-esterno-autovalutazione-mockup.html` in `Scheda pubblica`. Aggiunto pannello `Link esterno` per copiare un link pubblico e un test form locale per `PMO-000956` / `aprea.maurizio@gmail.com`, con privacy obbligatoria e `Invia test` solo simulato. Nessuna modifica a PROD, SQL, Edge Function, scheduler, Supabase, dati reali, Gmail reale, WhatsApp automatico o Matchpoint.
- Autovalutazione v5.443 TEST: integrato il mockup `mockup/autovalutazione-socio-test-cruscotto-mockup.html` nel `Cruscotto mattutino`. Aggiunto bottone `Socio test` in testata, recupero diretto di `PMO-000956` fuori da filtro/ricerca/limite 20 righe, feedback `Socio test aperto` o `Email socio test non verificata`, e bottoni `Invia seconda email` / `Invia terza email` basati solo su doppia verifica ID+email, senza dipendenza dall'ambiente. Nessuna modifica a PROD, SQL, Edge Function, scheduler, Matchpoint, Gmail reale, WhatsApp o dati reali.
- Autovalutazione v5.444 TEST: integrato il mockup `mockup/registrazione-link-esterno-sesso-mockup.html` in `Scheda pubblica > Link esterno`. Il test form staff e il form pubblico tokenizzato marcato `assessment=link-esterno` gestiscono `Sesso` con opzioni `Maschio`, `Femmina`, `Preferisco non indicarlo`; se viene scelto `Preferisco non indicarlo`, il flusso prosegue ma lo stato staff resta `Da completare`. Il dato viene salvato nel `raw_response` JSON e puo completare la scheda socio locale quando la risposta viene importata. Nessuna modifica a PROD, SQL, Edge Function, scheduler, Supabase schema, Matchpoint, Gmail reale, WhatsApp automatico o dati reali.
- Autovalutazione v5.445 TEST: bugfix del bottone `Socio test` nel `Cruscotto mattutino`. La ricerca accetta ID PMO e campi ID alternativi, usa l'email test come fallback per mostrare una riga bloccata se l'ID non coincide, e non svuota piu la lista `Processo utenti` quando il socio non e' presente nei dati caricati. Nessuna creazione socio automatica, nessuna modifica a Supabase, SQL, Edge Function, scheduler, Matchpoint, Gmail reale, WhatsApp automatico, dati reali o PROD.
- Autovalutazione v5.446 TEST: allineato il socio test ufficiale a `PMO-000948` con email `aprea.maurizio@gmail.com` nel `Cruscotto mattutino` e nel test form `Scheda pubblica > Link esterno`. I bottoni test `Invia seconda email` e `Invia terza email` sono consentiti solo con doppia verifica `PMO-000948` + email protetta. Il vecchio `PMO-000956` non viene cancellato dai dati: eventuale rimozione/disattivazione va gestita separatamente da Anagrafica TEST. Nessuna modifica a PROD, SQL, Edge Function, scheduler, Matchpoint, Gmail reale, WhatsApp automatico o dati reali.
- Autovalutazione v5.447 TEST: aggiornati `autovalutazione.html`, `test/autovalutazione.html` e i link copiati dal pannello `Scheda pubblica > Link esterno`. Il branch TEST contiene la preview `Autovalutazione Livello di Gioco`, descrizione `Padel Village` e logo Padel Village; il link pubblico punta alla pagina dedicata `autovalutazione.html?assessment=link-esterno`; il link TEST usa `test/autovalutazione.html?env=test&assessment=link-esterno&memberId=PMO-000948`. Il cambio della preview reale del link pubblico richiede futura promozione PROD. Nessuna modifica a PROD, SQL, Supabase, Edge Function, scheduler, Matchpoint, Gmail reale, WhatsApp automatico o dati reali.
- Routine TEST una tantum: il job `pmo-assessment-email-single-test-1630` per `PMO-000948` si e' eseguito correttamente alle 16:30 Europe/Rome, si e' rimosso e ha inviato una sola email confermata dall'utente. Non ha coinvolto la coda generale e non ha toccato PROD.
- Documentazione aggiornata per v5.440 TEST.

Non contiene modifiche a:

- API Google o Google Contatti;
- invio WhatsApp automatico;
- SQL o scheduler;
- Matchpoint reale o dati reali.

Nota tecnica: per permettere l'export incrementale, i soli nuovi soci aggiunti da un import clienti Matchpoint vengono marcati localmente con metadati `matchpointImportedAt` / `matchpointLastImportedAt` / `matchpointSource`. I soci gia esistenti non vengono sovrascritti da questa modifica.

Nota: il deploy PROD v5.422 non applica SQL scheduler e non attiva routine email automatiche. Il controllo live su Supabase PROD del 2026-05-15 08:52 mostra in `cron.job` solo `pmo-data-routines-dispatcher-prod`, cioe' lo scheduler dati/Matchpoint gia esistente. Il cron scheduler TEST generale non e' attivo dopo la rimozione manuale del 2026-05-14 07:39. Il job una tantum TEST `pmo-assessment-email-single-test-1630` per `PMO-000948` si e' gia eseguito e rimosso.

Nota Supabase PROD 2026-05-16 08:03: dopo audit bloccante e autorizzazione esplicita di Maurizio, la Edge Function residua `assessment-email-cron-test` e' stata rimossa dal project ref PROD `qqbfphyslczzkxoncgex`. Verifica successiva: la funzione non compare piu nella lista Edge Function PROD; `assessment-email-send` resta `ACTIVE`, versione `11`, `verify_jwt=true`; `cron.job` mostra ancora solo `pmo-data-routines-dispatcher-prod`. Non sono stati eseguiti deploy app, deploy di altre Edge Function, SQL, modifiche scheduler, modifiche segreti o modifiche dati. PROD resta v5.422.

Nota Supabase PROD 2026-05-16 08:47: dopo alert di compatibilita UI v5.438 / Edge Function PROD v11, e su autorizzazione esplicita, e' stato eseguito solo il deploy controllato della Edge Function PROD `assessment-email-send` dal sorgente TEST validato, sul project ref `qqbfphyslczzkxoncgex`, con comando senza `--no-verify-jwt`. Stato successivo: funzione `ACTIVE`, versione `12`, `verify_jwt=true`; sorgente live compatibile con `send`, `scan-bounces`, `scan-replies`, `routine-plan`, `routine-approve`, `routine-send`, `targetMemberIds` e `regenerate:true`; `assessment-email-cron-test` resta assente; `cron.job` contiene ancora solo `pmo-data-routines-dispatcher-prod`. Non sono stati eseguiti deploy app, SQL, modifiche scheduler, modifiche segreti, invii email reali o modifiche dati. PROD app resta v5.422 e la promozione v5.438 richiede ancora comando separato `PROMUOVI PROD`.

Nota PROD 2026-05-16 09:08: ricevuto comando esplicito `PROMUOVI PROD`, la app v5.438 e' stata promossa in PROD con fast-forward da TEST. Verifica post-deploy: `main`, `test-preview` e `test/accessi-staff-guidati` allineati; raw GitHub `main` e `test-preview` espongono `APP_VERSION = '5.438'` con SHA-256 identico; render headless PROD e TEST carica la schermata login v5.438 senza errori console bloccanti. Stato Supabase preservato: `assessment-email-send` PROD `ACTIVE` v12 `verify_jwt=true`, `assessment-email-cron-test` assente, `cron.job` con solo `pmo-data-routines-dispatcher-prod`, nessuno scheduler email Autovalutazione PROD. Non sono stati eseguiti SQL, modifiche scheduler, modifiche segreti, invii email reali, modifiche dati o Matchpoint.

Nota operativa PROD 2026-05-16 12:16: dopo alert su email Autovalutazione PROD con prefisso `[TEST]`, e' stata corretta solo la configurazione secret Supabase PROD `ASSESSMENT_EMAIL_FORCE_TEST_RECIPIENTS=false` sul project ref `qqbfphyslczzkxoncgex`. La causa era il secret PROD ancora impostato come TEST; il sorgente `assessment-email-send` aggiunge `[TEST]` e `TEST INTERNO PMO` quando quel valore non e' esattamente `false`. TEST non e' stato modificato e resta protetto. Non sono stati eseguiti deploy app, deploy Edge Function, SQL, modifiche scheduler, modifiche segreti diverse, invii email reali, modifiche dati o Matchpoint. `assessment-email-send` resta `ACTIVE` con `verify_jwt=true`; la modifica secret ha aggiornato la versione runtime Supabase senza cambiare hash/codice funzione.

Nota verifica PROD 2026-05-16 12:36: eseguito da app PROD un nuovo invio controllato al socio `Prova Utente (mauri)`. Log Supabase PROD `assessment_email` verificato: `testMode=false`, `runtimeEnv=prod`, `originalRecipient=aprea.maurizio@gmail.com`, `actualRecipient=aprea.maurizio@gmail.com`, oggetto senza `[TEST]`, nessun riferimento `TEST INTERNO PMO` nel payload. `assessment-email-send` resta `ACTIVE` con `verify_jwt=true`; `cron.job` contiene solo `pmo-data-routines-dispatcher-prod`; nessuno scheduler email Autovalutazione PROD. Invii PROD Autovalutazione riabilitabili.

Nota PROD 2026-05-16 22:13: ricevuto comando esplicito `PROMUOVI PROD`, la app v5.440 e' stata promossa in PROD con fast-forward remoto da TEST. Prima del push e' stata deployata solo la Edge Function PROD `assessment-email-send` dal sorgente TEST validato v5.440, sul project ref `qqbfphyslczzkxoncgex`, con comando senza `--no-verify-jwt`; stato successivo: funzione `ACTIVE`, versione `14`, `verify_jwt=true`, hash uguale alla funzione TEST v18. Verifica post-deploy: `main`, `test-preview` e `test/accessi-staff-guidati` allineati a `2ca85e1`; raw GitHub `main` e `test-preview` espongono `APP_VERSION = '5.440'` con SHA-256 identico `de5642c71410f38252809ebc9504b3a13b8f0d94f8ef86f34b60ef96b528d5ef`; render headless PROD e TEST carica la schermata login v5.440 senza errori console bloccanti. `assessment-email-cron-test` resta assente; `cron.job` contiene solo `pmo-data-routines-dispatcher-prod`; nessuno scheduler email Autovalutazione PROD. Non sono stati eseguiti SQL, modifiche scheduler, modifiche segreti, invii email reali, modifiche dati o Matchpoint.

Nota documentale 2026-05-16 22:27: aggiornata la procedura condivisa di deploy TEST -> PROD con la pipeline tecnica obbligatoria di promozione PROD. La modifica e' solo documentale: non cambia versioni app, branch, Edge Function, SQL, scheduler, segreti, dati reali o Matchpoint.

Nota Supabase TEST/PROD 2026-05-16 23:24: la migrazione idempotente `supabase/migrations/20260516204711_pmo_post_match_feedback_no_pin_schema.sql` per lo schema feedback post-partita no-PIN e' stata applicata prima in TEST e poi in PROD dopo comando esplicito `PROMUOVI PROD`. Verifica PROD: `upsert_post_match_feedback_tokens_admin('[]'::jsonb)` restituisce `AUTH_REQUIRED` e non errore relazione, `get_post_match_feedback_by_tokens(array[]::text[])` restituisce 0 righe, `cron.job` contiene ancora solo `pmo-data-routines-dispatcher-prod`. Non sono stati modificati app, Edge Function, scheduler, segreti, Gmail, WhatsApp, Matchpoint o dati reali.

Nota PROD 2026-05-17 00:40: ricevuto comando esplicito `PROMUOVI PROD`, la app v5.441 e' stata promossa in PROD con fast-forward remoto da TEST. La promozione e' solo app UI + documentazione: non sono stati eseguiti deploy Edge Function, SQL, modifiche scheduler, modifiche Supabase schema, modifiche segreti, invii email reali, modifiche Matchpoint o dati reali. Preflight Supabase PROD: `assessment-email-send` `ACTIVE` v14 `verify_jwt=true`; `cron.job` contiene solo `pmo-data-routines-dispatcher-prod`; nessuno scheduler email Autovalutazione PROD.

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
- Prompt definitivi per SVILUPPO TEST:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/docs/prompt-definitivi-sviluppo-test.md`
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
| Nuovi mockup grafici | `stato-progetto-corrente.md`, `registro-versioni-sezioni.md`, `regola-mockup-grafici.md`, `prompt-definitivi-sviluppo-test.md` e il mockup approvato piu recente della sezione |

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
