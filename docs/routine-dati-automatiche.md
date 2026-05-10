# Routine dati automatiche

Stato: mockup grafico approvato; pannello UI integrato in `index.html` v5.368; intestazione DATI rimossa in TEST v5.369; scheduler backend ancora da progettare e validare.

## Obiettivo

Automatizzare la sequenza di aggiornamento dati della sezione `DATI (in/out)` senza cambiare le regole dell'algoritmo Riempi Slot.

La routine deve:

- aggiornare i dati Matchpoint con una sequenza prevedibile;
- mantenere sempre l'ultimo dato valido se un passaggio fallisce;
- mostrare in app lo stato delle routine, senza obbligare lo staff a controllare log tecnici;
- non archiviare file Excel Matchpoint in locale, repo, GitHub o Supabase Storage;
- lasciare TEST e PROD separati.

## Sequenza giornaliera proposta

| Orario | Routine | Scopo |
|---|---|---|
| 04:30 | Storico Matchpoint | Scarica gli ultimi 30 giorni e aggiunge solo righe storiche mancanti. |
| 05:00 | Clienti Matchpoint | Aggiorna la fotografia anagrafica dei clienti. |
| 05:30 | Prenotazioni future Matchpoint | Aggiorna la fotografia dei prossimi 30 giorni. |
| 05:45 | Controllo dati | Consolida esiti, ultimo dato valido, errori e alert visibili. |

## Aggiornamenti durante la giornata

Le `Prenotazioni future Matchpoint` sono la fonte piu variabile per Dashboard, Slot Liberi e Apri Partite. Oltre alla routine mattutina, sono previsti refresh durante la giornata:

| Orario | Routine | Nota |
|---|---|---|
| 10:30 | Prenotazioni future Matchpoint | Prima lettura operativa della mattina. |
| 14:30 | Prenotazioni future Matchpoint | Aggiornamento dopo la fascia pranzo. |
| 17:30 | Prenotazioni future Matchpoint | Aggiornamento prima della fascia serale. |
| 21:30 | Prenotazioni future Matchpoint | Aggiornamento serale, da confermare in base all'utilita operativa. |

## Stati esito

Ogni routine deve salvare un esito finale normalizzato:

- `success`: import/export completato e dati validati;
- `blocked`: dati non validi o risposta incompleta, quindi nessuna sostituzione;
- `failed`: errore tecnico durante login, worker, Edge Function, Supabase o parsing;
- `skipped`: routine non eseguita per regola operativa o prerequisito mancante.

## Regole in caso di errore

Se una routine fallisce:

- il dato valido precedente resta in uso;
- non vengono cancellati record locali o cloud gia validi;
- viene salvato il dettaglio leggero dell'errore;
- viene programmato un nuovo tentativo dopo circa 15 minuti;
- dopo errori ripetuti la sezione `DATI (in/out)` mostra un alert rosso nel pannello `Stato routine automatiche`.

Regole per tipo dato:

- `Clienti Matchpoint`: un errore non deve alterare `giocatori` o la fotografia clienti cloud precedente.
- `Prenotazioni future Matchpoint`: un errore non deve sostituire `prenotazioni` e `prenotazioniOccupazione`.
- `Storico Matchpoint`: un errore non deve cancellare lo storico accumulato.
- `Backup cloud`: un errore non deve eliminare il backup cloud precedente.

## Struttura UI proposta in DATI

Il pannello `Stato routine automatiche` diventa la prima schermata della sezione `DATI (in/out)`, per evitare che lo staff debba scorrere prima di capire se i dati sono aggiornati o se esiste un errore.

Campi minimi:

- routine;
- ultimo dato valido;
- ultimo tentativo;
- esito;
- prossima esecuzione;
- azione manuale, per esempio `Dettagli`, `Riprova ora`, `Salva backup`.

Ordine visuale della tabella:

1. Clienti Matchpoint;
2. Storico Matchpoint;
3. Prenotazioni future Matchpoint;
4. Backup cloud.

Colori esito:

- verde: OK;
- giallo: attenzione o dato vecchio;
- rosso: errore persistente;
- grigio: mai eseguito o non disponibile.

Sotto il pannello routine, la sezione DATI viene divisa in due aree espandibili chiuse di default:

- `Aggiornamenti Matchpoint e backup`, con Clienti, Prenotazioni future, Storico e Backup;
- `Slot potenziali Matchpoint`, che diventa la sezione 6 e mantiene le opzioni reali gia presenti: immagine griglia slot, editor `Griglia slot operativa`, `Salva griglia slot` e `Ripristina standard`.

## Integrazione UI v5.368

La prima integrazione in app e' solo visuale/operativa:

- il pannello legge gli ultimi riepiloghi gia salvati dagli import esistenti;
- il pannello mostra eventuali stati correnti `in corso` o `errore` gia prodotti dai bottoni automatici;
- i pulsanti `Aggiorna ora` e `Salva ora` chiamano le stesse funzioni manuali gia validate;
- gli orari mostrati sono una proposta di routine, non ancora un job schedulato;
- nessuna nuova funzione Supabase o automazione backend viene attivata in questa fase.

## Rifinitura UI v5.369

Dopo approvazione del mockup `mockup/routine-dati-automatiche-mockup.html`, la sezione DATI non mostra piu' l'intestazione alta `DATI (in/out)`, il sottotitolo `Stato dati, aggiornamenti Matchpoint, backup e slot potenziali.` e la relativa linea divisoria.

Il primo contenuto visibile deve essere il box `Stato routine automatiche`.

## Alert

Nella prima fase gli alert sono visibili dentro `DATI (in/out)`.

Non e' previsto invio automatico email finche non viene configurata e validata una funzione dedicata. Una futura notifica email potra essere aggiunta solo dopo nuova specifica e validazione.

## Conservazione dati

La routine deve rispettare la policy no-accumulo:

- nessun Excel clienti Matchpoint conservato;
- nessun Excel prenotazioni future conservato;
- nessun Excel storico Matchpoint conservato;
- backup cloud unico sovrascritto in Supabase Storage;
- storico prenotazioni usato dall'algoritmo limitato agli ultimi 12 mesi;
- restano solo record normalizzati, riepiloghi import e diagnostica leggera.

## Funzioni coinvolte

Le routine devono orchestrare le funzioni gia esistenti senza cambiare la logica di ranking dell'algoritmo:

- `matchpoint-clients-sync`;
- `matchpoint-bookings-sync`;
- `matchpoint-history-sync`;
- `pmo-cloud-backup`;
- caricamento cloud paginato tramite `pmo_get_records_admin_page`;
- funzioni app di lettura riepiloghi Matchpoint e render della sezione `DATI (in/out)`.

Ogni modifica operativa va prima in TEST e puo andare in PROD solo dopo conferma testuale esplicita.
