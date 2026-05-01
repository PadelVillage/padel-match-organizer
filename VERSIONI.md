# Versioni

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
