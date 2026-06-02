# Versioni

## 2026-06-02 / TEST (edge matchpoint-bookings-create): rimosso il retry automatico (erano 3 tentativi) della chiamata al worker per create-booking — anti-doppione su prenotazioni lente. Una sola chiamata.

## v5.600 — Assistente prenotazioni: invio nome→codice Matchpoint (campo giocatori[]) alla edge per le partite; più giocatori; omonimi → 'specifica meglio'. Lezione invariata.

## 2026-06-02 / TEST: il pulsante test prenotazione prenota una PARTITA su un socio per nome, risolvendo il codice Matchpoint dal DB locale (solo numerico; PMO-/vuoto -> nome). Valida la catena con disambiguazione per codice.

## 2026-06-02 / TEST: rimossi gli ultimi riferimenti placeholder PMO-000948; i test (notifiche/follow-up/link autovalutazione/testValidare) puntano al socio di prova Maurizio Aprea via email/codice reale. Mantenuti gli override email/telefono di test.

## 2026-06-02 / TEST: rimosso il trattamento segnaposto/test del socio Maurizio Aprea nell'audit soci e nei default del modulo autovalutazione; ora gestito come socio normale (codice Matchpoint 000004). Notifiche/email di test trattate a parte.

## 2026-06-02 / TEST · Edge function `matchpoint-bookings-create` — giocatori con codice Matchpoint

- edge `matchpoint-bookings-create` — accetta e inoltra al worker la lista giocatori con codice Matchpoint (retrocompatibile).

## 2026-06-01 / TEST · Edge function `matchpoint-clients-sync` v45 + browser worker + guardrail PROD

- **Solo ambiente TEST** (Supabase `cudiqnrrlbyqryrtaprd`; nessuna modifica a PROD). Modifiche a Edge Function `matchpoint-clients-sync` (versione 45) e al browser worker, non alla UI dell'app.
- **ID Matchpoint nei soci**: la sync clienti scarica anche il report `Listadoclientes` (colonna `Codice`) e riempie `memberId` con il codice interno a 6 cifre (es. `000004`), abbinando per telefono/email. Collaudo: 982/983 soci agganciati; 1 segnalato per revisione manuale (Fabio De Luca).
- **Login HTTP non operativo**: entrambi i report (livello + Codice) passano dal browser worker; il report Codice usa la modalita' `direct_clients`. La sync risulta piu' lenta (due chiamate al worker).
- **Pulizia doppioni legacy**: i record non-Matchpoint (`PMO-xxxxxx`) con gemello Matchpoint vengono soft-deleted (`legacy_duplicate_superseded`), con due guardie (sopravvissuto Matchpoint + nessun dato curato); i doppioni con dati curati vengono solo segnalati. Collaudo: 1 eliminato (`PMO-000948`), 0 in revisione, 0 soci attivi con id `PMO-` residuo. **Supera la decisione v5.488** (vedi `docs/matchpoint.md`, nota TEST 2026-06-01).
- **Guardrail PROD (su `main`)**: aggiunto workflow `guard-main` (`.github/workflows/guard-main-prs.yml`) + ruleset GitHub sul branch `main`. La verifica fallisce se una PR verso `main` proviene da `test-preview`, cancella file, o tocca piu' di 15 file; il ruleset blocca anche force-push e cancellazione del branch.

## v5.596 / TEST: slot prova Matchpoint allineato a 90 min

- **Solo ambiente TEST**: aggiornato il payload di prova del pulsante **🧪 Test prenotazione Matchpoint** da 60 a 90 minuti (`ora: "09:00"`, `oraFine: "10:30"`, `durata: 90`), allineando la prenotazione di test al default Matchpoint per le partite.

## v5.595 / TEST: pulsante test prenotazione Matchpoint

- **Solo ambiente TEST** (guard su `PMO_IS_TEST_ENV` / `data-test-env-only`): aggiunto pulsante nascosto **🧪 Test prenotazione Matchpoint** nell'area dati Matchpoint, dopo il box "Backup dati". Permette allo staff con permesso `cloud_sync` di lanciare una singola prenotazione di prova reale (`Campo 1 · 2026-06-01 · 08:00–09:00 · "TEST PV — CANCELLARE"`) chiamando la edge function `matchpoint-bookings-create`. Il pulsante richiede conferma esplicita, mostra lo stato di avanzamento, disabilita il pulsante durante l'attesa e visualizza l'esito (successo o errore) in un riquadro colorato. In produzione non compare mai.

## v5.594 / TEST: storico prenotazioni disattivato

- **Solo ambiente TEST** (guard su `PMO_IS_TEST_ENV`): lo storico prenotazioni non viene più caricato, salvato in localStorage, né spinto sul cloud. Evita l'errore `setItem ... exceeded the quota` dovuto al localStorage di dominio condiviso con PROD, e non serve in TEST. Quattro guard: (a) `importMatchpointHistoryAutomatic()` no-op, (b) `save()` salta `storicoPrenotazioni`, (c) backup cloud non spinge `booking_history`, (d) restore non ripopola lo storico. **PROD invariato.**

## v5.588 / Fix: Tab 2 INVALID_RULES

- **Correzione INVALID_RULES nel Parser Config (Tab 2 "Genera Aggiornamento")**: Il pulsante "Approva e Aggiorna File" ritornava `INVALID_RULES`. Causa: il front-end inviava alla Edge Function `parser-rules-update` solo le `modifiche` e il frammento filtrato di regole mostrato in Tab 2, mentre la funzione valida lo schema completo delle regole. Ora il client costruisce il SET COMPLETO di regole applicando le modifiche all'intero `PARSER_RULES` e lo invia nel campo `regole` del payload. La Edge Function è stata irrobustita per accettare e validare l'oggetto `regole` completo (con fallback su `modifiche`), restituendo `INVALID_RULES` solo se mancano `intents` o `campi_obbligatori`.

## v5.538 / Scorciatoia di sincronizzazione nel lotto vuoto dell'Autovalutazione

- **Pulsante Sincronizza Ora nel Flusso**: Aggiunto un pulsante di sincronizzazione rapida ("Sincronizza dati locali ora") direttamente nel riquadro dell'Autovalutazione quando il lotto risulta vuoto. Questo evita allo staff di dover cercare il pannello "Amministrazione > Supabase", guidandoli visivamente all'azione corretta e gestendo in tempo reale la notifica di eventuali errori di permessi.

## v5.537 / Fix errata formattazione righe in Da Inviare

- **Correzione Errata Formattazione Righe**: Risolto il problema per cui i soci pronti al primo invio (senza risposta) venivano erroneamente formattati come "Scheda compilata / Da validare". Questo accadeva a causa di un fallback scorretto nella funzione `assessmentProcessEntryResponse` che confondeva l'oggetto di presentazione del rendering con la risposta Supabase reale. Ora gli stati e i bottoni vengono renderizzati in modo impeccabile per ciascun socio.

## v5.536 / Fix visualizzazione tabella Da inviare autovalutazione

- **Correzione visualizzazione tabella Da inviare**: Risolto il problema del caricamento vuoto (con soli trattini `-` sotto le colonne *Routine*, *Fase*, *Prossimo step*, ecc.) per i soci pronti al primo invio nel pannello Autovalutazione. Ora le righe vengono visualizzate con tutti i relativi stati operativi e pulsanti d'azione completi.

## v5.535 / Messaggi manuali editabili ed eliminazione testi

- **Integrazione WhatsApp Desktop Forzata**: Corretta l'idratazione e salvataggio dei dati per impostare di default la modalità Desktop (`whatsapp://`) anziché Web.
- **Eliminazione Modelli Personalizzati**: Introdotta la possibilità per lo staff di eliminare i modelli email e whatsapp creati su misura sia dalla scheda "Testi" che direttamente dalle liste di invio.
- **Modello di Sistema "Solo saluto"**: Creato il modello protetto `'whatsapp-saluto'` per inviare messaggi liberi ai soci mantenendo l'intestazione iniziale automatica.
- **Messaggi Editabili al Volo**: Sostituita l'anteprima statica del modal WhatsApp manuale di Kanban con una `<textarea>` interattiva, che permette allo staff di personalizzare o completare il messaggio prima dell'invio.
- **Copia e Apri Dinamici**: I pulsanti "Copia" e "Apri WhatsApp" acquisiscono in tempo reale le modifiche scritte a mano dallo staff nella textarea.
- **Iniezione ZWSP per WhatsApp**: Risolto il problema del comportamento del parser di WhatsApp Desktop su macOS ( Catalyst app) tramite l'iniezione automatica e dinamica di un carattere invisibile a larghezza zero (Zero-Width Space, `\u200B`) subito dopo l'a capo finale di qualsiasi messaggio generato o modificato a mano.
- **Pulizia Interfaccia**: Rimosso il pulsante verde "Segna gestito" dal modal WhatsApp per rendere l'azione immediata e intuitiva.

## v5.526 / Compattazione filtri Autovalutazione su riga unica

- Compattata la barra dei filtri della sezione Autovalutazione riducendo il gap orizzontale (da 24px a 12px) e il padding interno dei bottoni (da 16px a 12px) per assicurare che tutti i 5 tab stiano su una riga singola su desktop.
- Ridotto lo spazio a sinistra del dot pulsante e del badge "Lotto pronto" per guadagnare ulteriore compattezza visiva.

## v5.525 / Evidenziato lotto pronto in Da inviare

- Inserito un indicatore visivo "Lotto pronto" ed un dot verde pulsante sul tab "1. Da inviare" quando il lotto manuale di email quotidiano è preparato.
- Disegnato uno stile coordinato con sfondo verde tenue e bordi definiti per guidare visivamente lo staff verso l'invio.

## v5.341 / Permesso solo consultazione

- Rinominata la dicitura del permesso `read_all` da "Lettura completa" a "Solo consultazione".
- Allineato il mockup Amministrazione alla nuova etichetta.

## v5.340 / Amministrazione in TEST ottimizzata

- Riorganizzata Amministrazione in due sottosezioni: Utenti e Supabase.
- Spostata la sessione personale in un box account compatto, senza capitolo dedicato.
- Semplificata la gestione Utenti: lista caricata automaticamente, tabella piu leggera e modifiche ruolo/stato/permessi tramite Modifica.
- Chiarita la sezione Supabase come area diagnostica TEST/PROD senza modifiche ai dati.

## v5.339 / Occhio password in angolo destro

- Spostata l'icona mostra/nascondi password sul bordo inferiore destro del campo.
- Rimossa l'interferenza del tooltip globale `button[title]` dal controllo password.

## v5.338 / Fix rendering icona password

- Azzerati padding e margin globali sul bottone icona password, che schiacciavano l'SVG e lasciavano visibile solo un puntino.
- Bloccata la dimensione del controllo a 34px per renderlo stabile dentro il campo password.

## v5.337 / Icona password sempre visibile

- Inserita l'icona occhio direttamente nel markup dei campi password, senza dipendere dall'inizializzazione JavaScript.
- Mantenuto il toggle mostra/nascondi con icona coerente e label accessibile.

## v5.336 / Icona mostra password

- Sostituito il pulsante testuale "Mostra" con una piccola icona occhio dentro i campi password.
- Allineato il controllo mostra/nascondi a destra del campo per evitare sovrapposizioni tra email e password.

## v5.335 / Login solo accesso personale

- Rimossa dalla login la sezione "Oppure accesso beta".
- Disattivato il fallback tecnico con password beta condivisa: l'accesso staff passa solo da email e password personale Supabase.
- Aggiornati i testi in Amministrazione per mostrare solo lo stato della sessione personale.

## v5.334 / Registrazione staff guidata

- Separata la login staff in due stati: accesso e registrazione.
- Aggiunto mostra/nascondi password nei campi personali e nel recupero password.
- La registrazione controlla prima la nuova RPC `pmo_can_register_staff`: solo email gia autorizzate in Amministrazione possono creare l'accesso Supabase.
- Dopo la conferma email l'app collega il profilo staff, chiude la sessione temporanea e torna alla login con email precompilata.
- La password resta quella scelta nella schermata di registrazione e non viene inviata via email.

## v5.333 / Accessi staff guidati in TEST

- Ridisegnata in ambiente TEST la sezione Amministrazione > Accessi staff come flusso guidato: autorizza email, crea accesso, lavora con permessi.
- Semplificata la gestione quotidiana con preset ruolo e riepilogo permessi visibile.
- Spostate le checkbox avanzate dietro "Personalizza permessi", lasciando invariata la logica Supabase Auth + permessi.
- Rinominata l'azione principale in "Autorizza email" per chiarire che la password viene scelta dalla persona dalla schermata iniziale.
- Preparata la versione TEST per funzionare anche dal canale Pages `/test/?env=test`.

## v5.332 / Admin Supabase senza PIN staff

- Rimosso il PIN operativo dalle sezioni Amministrazione, Routine cloud, registrazione token autovalutazione e feedback post-partita.
- Le RPC amministrative usano Supabase Auth e controllano ruolo/permessi del profilo staff (`owner`, `admin`, `staff`, `readonly`).
- Aggiunte RPC no-PIN compatibili per utenti staff autenticati, lasciando le vecchie firme con PIN solo come compatibilita' legacy.
- Ripulito `assessmentSettings` dal vecchio `adminPin` prima del sync cloud.

## v5.331 / Verifica ambiente Supabase

- Aggiunto in Amministrazione il pannello "Ambiente Supabase" per controllare ambiente app, config caricata, project ref, Auth e principali RPC.
- Il check segnala se TEST punta per errore al project ref PROD.
- Migliorato il messaggio quando in TEST `config-test.js` e' presente ma mancano URL o anon key.
- Collegato `config-test.js` al progetto Supabase TEST `cudiqnrrlbyqryrtaprd`.

## v5.151 / Scheda socio ottimizzata

- Ridisegnata la scheda socio con header compatto, dati socio, preferenze operative e stato rapido separati.
- Rinominati i KPI operativi in "Messaggi inviati totali", "Messaggi inviati questa settimana" e "Ultimo messaggio inviato".
- Spostati dettagli tecnici di autovalutazione e storico invii/token/risposte in una colonna dedicata con blocco richiudibile.
- Mantenute le funzioni esistenti di salvataggio, reinvio autovalutazione, disattivazione e cancellazione socio.

## v5.150 / Messaggio livello validato compatto

- Reso più compatto il messaggio WhatsApp "Avvisa socio" dopo la validazione del livello.
- Ridotti gli spazi verticali tra le frasi, mantenendo una sola separazione prima della firma.

## v5.149 / Archivio senza scroll orizzontale

- Rimosso lo scroll orizzontale dall'Archivio autovalutazioni.
- La lista ora si adatta al box: layout tabellare su desktop ampio e layout compatto/card quando lo spazio non basta.
- I pulsanti Azioni rientrano nel contenitore e vanno a capo senza tagliare il testo.

## v5.148 / Archivio autovalutazioni essenziale

- Alleggerita la lista Archivio autovalutazioni: resta visibile solo il riepilogo operativo essenziale.
- Spostato lo storico completo di invii/token e risposte dentro la scheda socio, in un blocco richiudibile.

## v5.147 / Archivio autovalutazioni responsive

- Corretta la griglia dell'Archivio autovalutazioni: la colonna Azioni non si sovrappone più al riepilogo invio/risposta.
- Migliorato il comportamento responsive dell'Archivio con layout a card su larghezze intermedie e mobile.
- Allineata la costante interna `APP_VERSION` alla versione mostrata nell'interfaccia.

## v5.146 / Avviso socio livello validato

- Dopo l'applicazione del livello da autovalutazione, l'app mostra l'azione manuale "Avvisa socio" per preparare un messaggio WhatsApp con il livello validato.
- La notifica viene tracciata come preparata nella scheda socio, nel Post-invio e nell'Archivio, senza invio automatico.

## v5.145 / Scheda test in nuova tab

- I pulsanti "Apri scheda test" aprono la scheda pubblica in una nuova tab, mantenendo l'app admin nella posizione corrente.

## v5.144 / Codice staff nel Pre-invio

- Il bottone "Prepara" resta nel flusso Pre-invio: se serve il Codice staff Supabase, apre le azioni tecniche locali sotto il pulsante invece di portare in fondo agli strumenti avanzati.
- Aggiunto il campo Codice staff Supabase dentro le azioni tecniche del Pre-invio, sincronizzato con le impostazioni avanzate.

## v5.143 / Riga senza telefono Pre-invio

- La riga "Senza telefono" nel Pre-invio usa un layout dedicato: il pulsante "Apri scheda" resta sotto al nome e non viene più tagliato nelle larghezze intermedie.

## v5.142 / Responsive riga Pre-invio

- Corretto l'allineamento del pulsante "Apri scheda" nelle righe Pre-invio, evitando tagli del testo su desktop e mantenendo l'azione sotto al nome su mobile/tablet.

## v5.141 / Feedback bottone 0.5 da inviare

- Quando il bottone "0.5 da inviare" non trova candidati, il Pre-invio mostra un messaggio esplicito con riepilogo dei soci 0.5 invece del generico "nessun socio trovato".

## v5.140 / Post-invio più leggibile e sync a sessione

- Ridisegnata la riga del Post-invio con intestazione socio/stato/azioni e dettagli risposta in blocchi compatti.
- Il pulsante "Aggiorna risposte" torna rosso a ogni ricarica pagina finché non viene eseguita una sincronizzazione Supabase nella sessione corrente.

## v5.139 / Flusso unico 0.5 da inviare

- Rimosso il bottone rapido separato "Token da registrare" dal Pre-invio.
- Il bottone "0.5 da inviare" mostra i candidati livello 0.5 sia pronti sia da preparare, fino a 10 soci.
- Se tra i selezionati ci sono token mancanti o non registrati, il pannello di invio propone la preparazione token/Supabase prima di WhatsApp.

## v5.138 / Pre-invio solo livello 0.5

- Il bottone rapido "Pronti 0.5 da inviare" mostra e preseleziona solo soci con livello attuale 0.5.
- Aggiornati conteggi e testo del Pre-invio per rendere esplicita la routine dedicata ai nuovi soci da autovalutare.

## v5.137 / Fix scroll lista Pre-invio

- Ripristinato lo scroll interno della lista "Controlla" nel Pre-invio quando sono selezionati fino a 10 soci pronti.
- Mantenuta fissa l'intestazione con conteggio risultati/selezionati durante lo scroll.

## v5.136 / Layout admin Autovalutazioni

- Resa più compatta e leggibile la sezione interna Autovalutazioni.
- Allineato il comando "Aggiorna risposte" nell'header del box Post-invio.
- Ridotto l'ingombro di pannelli, righe, filtri e azioni nei flussi Pre-invio, Post-invio e Archivio.

## v5.135 / Autovalutazioni app interna

- Validata la sezione interna Autovalutazioni: Pre-invio, Post-invio, Archivio, Token e Supabase.
- Il link laterale Token e Supabase apre direttamente gli strumenti tecnici avanzati.
- Nel Post-invio una risposta già applicata non mostra più l'azione Applica come se fosse ancora da lavorare.
- L'applicazione del livello salva origine, data, token, coerenza e disponibilità nella scheda giocatore.
- L'Archivio mostra storico token/invii e risposte ricevute anche dopo la preparazione di una nuova autovalutazione.
- Il payload pubblico include anche i campi disponibilità top-level per il fallback diretto su Supabase.
- Reso più robusto l'RPC Supabase quando `submitted_at` arriva vuoto.

## v5.134 / Scheda Autovalutazione

- Validata la scheda pubblica di autovalutazione compilata dal socio.
- Allineato il calcolo tecnico alle risposte reali del modulo pubblico.
- Reso configurabile il link pubblico generato per WhatsApp.
- Corretti i rientri interni verso Pre-invio e Archivio.
- Aggiornato lo schema Supabase con RPC, campi risposta, disponibilità e PIN staff.

## v5.133

- Versione base corrente importata come nuovo punto stabile di lavoro.
- Da questa versione si lavora per sezioni autonome tramite branch dedicate.
- Ogni sezione validata viene consolidata su `main` prima di aprire la sezione successiva.

## v5.10.1

- Archivio storico prenotazioni cumulativo.
- Conservazione automatica solo degli ultimi 12 mesi di storico.
- Import clienti e prenotazioni manuale da Matchpoint.
- Backup e ripristino dati locali.
- Gestione soci e schede socio.
- Analisi slot vuoti.
- Creazione partita e contatti giocatori.

## Prossima area di sviluppo: v5.11 / Autovalutazione Livelli

Obiettivo:

- individuare soci con livello 0,5;
- generare link personale di autovalutazione;
- inviare messaggio WhatsApp;
- ricevere risposte online;
- proporre livello operativo;
- permettere conferma staff prima di applicare il livello.
