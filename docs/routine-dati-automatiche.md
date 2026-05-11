# Routine dati automatiche

Stato: mockup grafico approvato; pannello UI integrato in `index.html` v5.368; intestazione DATI rimossa in TEST v5.369; formato prossime esecuzioni aggiornato in TEST v5.370; orari Clienti/Storico invertiti in TEST v5.371; backup cloud e backup locale separati in TEST v5.372; auto-backup cloud post aggiornamento dati pubblicato in PROD v5.373; scheduler backend Matchpoint automatico disattivato su Supabase TEST e attivo su Supabase PROD dal 2026-05-11.

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
| 04:30 | Clienti Matchpoint | Aggiorna la fotografia anagrafica dei clienti. |
| 05:00 | Storico Matchpoint | Scarica gli ultimi 30 giorni e aggiunge solo righe storiche mancanti. |
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

## Rifinitura UI v5.370

La colonna `Prossima esecuzione` non usa piu' il testo relativo `domani`.

Il formato visibile e' giorno abbreviato, data completa e ora:

`Lun 11/05/2026 • 04:30`

## Rifinitura UI v5.371

Gli orari di `Clienti Matchpoint` e `Storico Matchpoint` sono invertiti:

- `Clienti Matchpoint`: 04:30;
- `Storico Matchpoint`: 05:00.

## Rifinitura UI v5.372

Dopo approvazione del mockup `mockup/backup-cloud-locale-separato-mockup.html`, nel box `Backup dati` il salvataggio cloud e il download locale tornano separati:

- `Salva backup cloud` salva solo su Supabase Storage;
- `Ripristina backup cloud` resta vicino all'azione cloud;
- `Scarica backup locale` resta in basso come azione manuale su richiesta.

## Auto-backup cloud app v5.373

Quando lo staff usa l'app e un aggiornamento Matchpoint automatico va a buon fine, l'app salva subito un backup cloud completo usando lo stesso payload browser di `Salva backup cloud`.

Trigger attivi:

- `Clienti Matchpoint`;
- `Prenotazioni future Matchpoint`;
- `Storico Matchpoint`.

Regole:

- il backup cloud automatico non scarica file locali;
- se il backup cloud fallisce, l'aggiornamento dati resta valido;
- l'esito del backup viene riflesso nel box e nella riga `Backup cloud` del pannello routine;
- lo scheduler backend puro non crea backup browser completi, perche' non vede il localStorage dell'app.

## Regola scheduler TEST/PROD

Lo scheduler automatico deve essere attivo in un solo ambiente alla volta.

Quando si decide di promuovere lo scheduler in PROD:

1. disattivare prima il job pmo-data-routines-dispatcher-test su Supabase TEST;
2. lasciare TEST utilizzabile solo con azioni manuali dall'app;
3. attivare poi il job pmo-data-routines-dispatcher-prod su Supabase PROD;
4. non tenere TEST e PROD schedulati agli stessi orari, per evitare doppie chiamate allo stesso account Matchpoint.

Stato attuale dal 2026-05-11:

- Supabase TEST `cudiqnrrlbyqryrtaprd`: job `pmo-data-routines-dispatcher-test` rimosso da `cron.job`; TEST resta manuale dall'app.
- Supabase PROD `qqbfphyslczzkxoncgex`: job `pmo-data-routines-dispatcher-prod` attivo ogni 5 minuti; il dispatcher esegue le routine solo agli orari locali previsti.

## Scheduler backend TEST

Lo scheduler backend e' stato attivato prima solo sul progetto Supabase TEST `cudiqnrrlbyqryrtaprd`, validato, e poi disattivato il 2026-05-11 prima dell'attivazione PROD.

Componenti:

- SQL di riferimento: `supabase_pmo_data_routines_scheduler.sql`;
- estensioni Supabase: `pg_cron`, `pg_net` e `supabase_vault`;
- funzione database `pmo_dispatch_data_routines(p_now timestamptz default now())`;
- secret interno `pmo_data_routine_secret` generato in Supabase Vault, mai salvato in HTML, repo o documentazione;
- verifica server-side tramite `pmo_verify_data_routine_secret(p_secret text)`;
- Edge Function Matchpoint gia esistenti, aggiornate per accettare sia staff JWT sia richiesta routine firmata:
  - `matchpoint-clients-sync`;
  - `matchpoint-history-sync`;
  - `matchpoint-bookings-sync`.

Nota sicurezza TEST/PROD: su autorizzazione esplicita del 2026-05-10 per TEST e del 2026-05-11 per PROD, queste tre Edge Function sono deployate con `verify_jwt=false` per consentire le chiamate `pg_net`. L'autorizzazione non e' anonima: il codice della funzione accetta solo un JWT staff valido oppure il secret interno Vault `pmo_data_routine_secret`.

Per gestire correttamente ora legale e ora solare, il job Cron non usa orari UTC fissi per ogni routine. Esegue invece un dispatcher ogni 5 minuti e confronta l'orario corrente in `Europe/Rome` con la tabella operativa:

| Ora locale Europe/Rome | Funzione chiamata |
|---|---|
| 04:30 | `matchpoint-clients-sync` |
| 05:00 | `matchpoint-history-sync` |
| 05:30 | `matchpoint-bookings-sync` |
| 10:30 | `matchpoint-bookings-sync` |
| 14:30 | `matchpoint-bookings-sync` |
| 17:30 | `matchpoint-bookings-sync` |
| 21:30 | `matchpoint-bookings-sync` |

Ogni dispatch viene registrato in `pmo_cloud_records` come `record_type = matchpoint_data`, con chiave `data_routine_dispatch_*`, e viene aggiornata la chiave `data_routine_dispatch_last`.

`pg_net` usa `timeout_milliseconds = 300000`, perche' gli import Matchpoint possono superare il timeout default di 5 secondi.

Validazione TEST del 2026-05-10:

- Clienti Matchpoint via scheduler: `200 OK`, actor `routine-dati@test.padel-match-organizer`, 949 clienti importabili, nessun Excel archiviato;
- Storico Matchpoint via scheduler: `200 OK`, actor `routine-dati@test.padel-match-organizer`, periodo 2026-04-10 / 2026-05-10, nessun Excel archiviato;
- Prenotazioni future via scheduler: `200 OK`, actor `routine-dati@test.padel-match-organizer`, periodo 2026-05-10 / 2026-06-09, nessun Excel archiviato.

La riga `Backup cloud` resta manuale nella prima attivazione backend: il backup completo attuale nasce dal localStorage del browser e contiene anche dati non ricostruibili integralmente dal solo backend, quindi non viene generato automaticamente da Supabase per evitare backup incompleti o fuorvianti.

## Scheduler backend PROD

Attivo dal 2026-05-11 sul progetto Supabase PROD `qqbfphyslczzkxoncgex`.

Attivazione eseguita:

- disattivato prima lo scheduler TEST;
- deployate in PROD con `verify_jwt=false` le funzioni `matchpoint-clients-sync` v9, `matchpoint-history-sync` v2 e `matchpoint-bookings-sync` v2;
- create/verificate in Vault PROD le chiavi `pmo_data_routine_project_url`, `pmo_data_routine_publishable_key` e `pmo_data_routine_secret`;
- creata la RPC `pmo_verify_data_routine_secret(p_secret text)`;
- creato il dispatcher `pmo_dispatch_data_routines(p_now timestamptz default now())`;
- attivato il job `pmo-data-routines-dispatcher-prod` con schedule `*/5 * * * *`.

Verifiche 2026-05-11:

- TEST: nessun job `pmo-data-routines-dispatcher-test` in `cron.job`;
- PROD: job `pmo-data-routines-dispatcher-prod` attivo;
- secret Vault PROD valido tramite `pmo_verify_data_routine_secret`;
- dispatcher fuori orario (`04:31` locale) restituisce `dispatched=false`;
- chiamata PROD senza JWT staff e senza secret routine respinta con `AUTH_REQUIRED`.

Gli actor audit delle chiamate routine vengono etichettati in base all'ambiente:

- `routine-dati@test.padel-match-organizer` su TEST;
- `routine-dati@prod.padel-match-organizer` su PROD.

Il backup cloud completo resta automatico solo quando un aggiornamento viene avviato dall'app, perche' il backend scheduler non vede il localStorage del browser.

## Alert

Nella prima fase gli alert sono visibili dentro `DATI (in/out)`.

Non e' previsto invio automatico email finche non viene configurata e validata una funzione dedicata. Una futura notifica email potra essere aggiunta solo dopo nuova specifica e validazione.

## Conservazione dati

La routine deve rispettare la policy no-accumulo:

- nessun Excel clienti Matchpoint conservato;
- nessun Excel prenotazioni future conservato;
- nessun Excel storico Matchpoint conservato;
- backup cloud unico sovrascritto in Supabase Storage;
- backup locale creato solo su richiesta manuale dello staff;
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
