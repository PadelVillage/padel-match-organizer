# Versioni

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
