# Matchpoint / DATI (in/out)

Stato: pubblicata in v5.310; flusso clienti automatici pubblicato in PROD v5.346; hotfix sincronizzazione cancellazioni cloud in v5.347; hotfix deduplica import automatico in v5.348/funzione v19; policy no-archivio file clienti in v5.349/funzione v20; fallback diretto worker in v5.350; fotografia clienti cloud in v5.351/funzione v21; pulizia duplicati fotografia in v5.352/funzione v22; feedback righe importate in v5.353; deduplica batch finale upsert pubblicata in v5.354/funzione v23 TEST e v7 PROD; hotfix quota `dailyDiffHistory` validato in v5.355 TEST e incluso in PROD da v5.356; retry worker Render pubblicato in v5.356/funzione v24 TEST e v8 PROD; backup cloud sovrascritto pubblicato in v5.357/funzione `pmo-cloud-backup` v1 TEST e v1 PROD; storico Matchpoint automatico pubblicato in PROD v5.360 con funzione `matchpoint-history-sync` v1 TEST e v1 PROD; layout riepilogo storico compatto e pulizia testi azione Clienti/Storico inclusi in v5.360; box Backup compatto pubblicato in PROD v5.361; riepilogo clienti pubblicato in PROD v5.362; hotfix paginazione record cloud clienti pubblicato in v5.363; RPC paginata stabile pubblicata in v5.364; prenotazioni future automatiche pubblicate in PROD v5.367 con funzione `matchpoint-bookings-sync` v1 TEST e v1 PROD; hotfix quota localStorage per prenotazioni/storico incluso in v5.367; metriche operative prenotazioni future pubblicate in v5.367; pannello routine dati automatiche pubblicato in PROD v5.373; intestazione sezione DATI rimossa in PROD v5.373; formato prossime esecuzioni aggiornato in PROD v5.373; orari Clienti/Storico invertiti in PROD v5.373; backup cloud e backup locale separati in PROD v5.373; auto-backup cloud post aggiornamento dati pubblicato in PROD v5.373; scheduler backend Matchpoint automatico disattivato su TEST e attivo su Supabase PROD dal 2026-05-11; hotfix UI v5.374 pubblicato in PROD per aggiornare automaticamente la colonna `Prossima esecuzione` mentre DATI resta aperta.

## Obiettivo

La sezione deve essere una schermata operativa rapida per importare dati e creare backup, senza trasformarsi in dashboard o report.

## Documenti collegati

- `docs/routine-dati-automatiche.md`: bozza operativa della routine automatica dati, con sequenza temporale, stati esito, gestione errori e pannello di controllo in `DATI (in/out)`.

## Struttura UI v5.236

- Voce menu principale: `DATI (in/out)`.
- Nessun sottomenu dedicato.
- Titolo sezione: `DATI (in/out)`.
- Sottotitolo: importare i file scaricati da Matchpoint e creare un backup locale quando serve.
- Prima riga con quattro box operativi:
  - Clienti Matchpoint;
  - Prenotazioni future Matchpoint;
  - Storico Matchpoint;
  - Backup dati.
- Sotto i bottoni dei primi tre box compare il feedback operativo dell'ultimo import con data e ora, non una scritta generica.
- Sotto i bottoni del box Backup compare il feedback operativo dell'ultimo backup scaricato con data e ora.
- Seconda riga con riquadro largo `Slot potenziali Matchpoint`, aperto di default senza barra di apertura.

## Feedback import v5.309

Nei box `Clienti Matchpoint`, `Prenotazioni future Matchpoint` e `Storico Matchpoint`, il testo verde sotto il bottone deve mostrare la data e l'orario dell'ultimo import salvato, nel formato operativo:

`Ultimo import: gg/mm/aaaa • hh:mm`

La fonte e' lo storico locale degli import (`dailyDiffHistory`) gia aggiornato dalle funzioni di import. Il feedback resta sintetico: non deve diventare un riepilogo, non deve mostrare metriche e non deve duplicare la Dashboard.

Da v5.355 lo storico locale `dailyDiffHistory` viene salvato in forma compatta per non saturare localStorage:

- massimo 10 import recenti;
- massimo 30 righe di dettaglio per nuovi/assenti/modificati;
- conteggi completi conservati separatamente;
- nessun salvataggio di liste complete di soci o prenotazioni dentro la cronologia locale.

## Feedback backup v5.310

Nel box `Backup dati`, il testo verde sotto i bottoni deve mostrare quando il file di backup e' stato scaricato o salvato localmente, nel formato operativo:

`Ultimo backup scaricato: gg/mm/aaaa • hh:mm`

La fonte e' `lastBackupInfo`, aggiornata solo quando il download/salvataggio del backup viene avviato con successo. Il feedback resta sintetico e non deve mostrare nome file, contenuti del backup, conteggi o metriche.

## Backup dati v5.249

Il box `Backup dati` deve restare un controllo rapido, non un report.

Da v5.249:

- il bottone principale e' neutro e si chiama `Scarica backup`;
- dopo il download non viene mostrato nessun riquadro riepilogativo sotto al box;
- da v5.310 il feedback sotto i bottoni mostra `Ultimo backup scaricato` con data e ora del download/salvataggio del file;
- non devono comparire nella sezione DATI conteggi lunghi, liste di contenuti tecnici, nome file o riepiloghi interni del file;
- il ripristino resta disponibile come azione separata nello stesso box.

## Backup cloud sovrascritto v5.357

Obiettivo:

- conservare dentro l'ecosistema Supabase un backup completo dei dati del browser;
- mantenere un solo file JSON per ambiente, sempre sovrascritto;
- non creare versioni multiple e non appesantire Storage;
- lasciare invariato il backup locale esistente.

Destinazione:

- bucket Supabase privato `pmo-app-backups`;
- oggetto fisso `latest/browser-backup.json`;
- accesso solo tramite Edge Function `pmo-cloud-backup`, non diretto dal browser;
- `verify_jwt=true`;
- permesso richiesto: `cloud_sync`, oppure ruolo `owner/admin`.

Stato TEST:

- bucket privato `pmo-app-backups` creato su `cudiqnrrlbyqryrtaprd`;
- Edge Function `pmo-cloud-backup` attiva in versione 1 con `verify_jwt=true`;
- UI `DATI (in/out)` collegata in `index.html` v5.357 dopo approvazione mockup;
- salvataggio validato: due eventi `cloud_backup_save` hanno lasciato un solo oggetto `latest/browser-backup.json`.

Stato PROD:

- bucket privato `pmo-app-backups` creato su `qqbfphyslczzkxoncgex`;
- Edge Function `pmo-cloud-backup` attiva in versione 1 con `verify_jwt=true`;
- hash funzione uguale a TEST (`5b23ab7726948cc3247da83b2709e295b82f3093f00840e11824c002cf1d36e9`);
- nessun oggetto presente finche' la UI PROD non invia il primo `save`.

Metadati:

- riepilogo leggero in `pmo_cloud_records`;
- `record_type = app_setting`;
- `local_key = cloud_backup_latest`;
- payload con data, versione, ambiente, dimensione, hash, conteggi e utente staff;
- il JSON completo resta solo in Storage.

Ripristino:

- la funzione `pmo-cloud-backup` legge il JSON unico da Storage;
- la app deve creare prima uno snapshot locale di sicurezza;
- il ripristino richiede conferma forte `RIPRISTINA`;
- resta il controllo ambiente TEST/PROD gia presente per i backup locali.

Nota UI v5.361 TEST/PROD:

- dopo mockup approvato `mockup/backup-cloud-supabase-mockup.html`, il box `Backup dati` non mostra piu' i pulsanti locali separati `Scarica backup` e `Ripristina backup`;
- il pulsante `Salva backup cloud` diventa l'azione unica: salva il JSON su Supabase Storage e avvia automaticamente anche il download della stessa copia locale;
- resta visibile `Ripristina backup cloud`, con le stesse conferme forti e snapshot locale di sicurezza gia previsti.

Nota UI v5.372 TEST:

- dopo mockup approvato `mockup/backup-cloud-locale-separato-mockup.html`, il box `Backup dati` separa di nuovo backup cloud e copia locale;
- `Salva backup cloud` salva solo su Supabase Storage e non avvia piu' il download locale automatico;
- `Ripristina backup cloud` resta vicino all'azione cloud;
- `Scarica backup locale` resta in basso come download manuale del backup browser.

Nota comportamento v5.373 TEST:

- dopo un aggiornamento automatico riuscito da app per `Clienti Matchpoint`, `Prenotazioni future Matchpoint` o `Storico Matchpoint`, l'app esegue anche un backup cloud completo;
- il backup usa lo stesso payload browser di `Salva backup cloud`, quindi include i dati locali dell'app;
- non viene scaricata alcuna copia locale automatica;
- un eventuale errore del backup cloud non annulla l'import dati gia riuscito, ma aggiorna lo stato del box Backup.

## Storico Matchpoint automatico v5.360 TEST/PROD

Obiettivo:

- scaricare automaticamente da Matchpoint lo storico prenotazioni degli ultimi 30 giorni;
- aggiungere in Supabase solo le righe `booking_history` mancanti;
- non sovrascrivere record storici gia presenti;
- non archiviare il file Excel scaricato, ne' in locale ne' in Supabase Storage.

Percorso Matchpoint validato il 2026-05-09:

1. Pagina iniziale dopo login: `Pannello di controllo generale`.
2. Aprire il menu alto `Inf. e statistiche`.
3. Scorrere fino al capitolo `Occupazione`.
4. Cliccare `Elenco degli utenti negli spazi`.
5. Nella pagina `Utenti negli spazi`, impostare `Dal Giorno` e `Al Giorno` sugli ultimi 30 giorni.
6. Lasciare vuoti/neutri gli altri filtri: ora, spazio, giorno settimana, provenienza, tipo, gruppo e tipo prenotazioni.
7. Lasciare non selezionato `Solo clienti che hanno gia pagato`.
8. Cliccare `Generare una relazione`.
9. Cliccare `Esportare in Excel`.

Validazione file:

- foglio richiesto: `Risultati`;
- colonne minime: `Nome`, `Numero`, `Giorno`, `Ora`, `Ore`, `Spazio`;
- colonne viste nel file reale: `Cod.`, `Identificatore`, `Nome`, `Sesso`, `Età`, `E-mail`, `Telefono cellulare`, `Numero`, `Giorno`, `Ora`, `Ore`, `G. sett`, `Spazio`, `Descrizione`, `Tipo`, `Importo Totale`, `Riscossa`;
- il parser salta righe senza giocatore/data/ora/campo, righe `Ospite` e duplicati `Numero + Giocatore`.

Scrittura cloud:

- Edge Function: `matchpoint-history-sync`;
- worker browser/headless: nuova rotta `POST /export-booking-history`;
- record normalizzati in `pmo_cloud_records`;
- `record_type = booking_history`;
- chiave cloud allineata all'app: `history|numero|data|ora|campo|giocatore|durata`;
- riepilogo leggero: `record_type = matchpoint_data`, `local_key = matchpoint_history_auto_import_last`;
- diagnostica leggera piu recente: `local_key = matchpoint_history_auto_diagnostic_last`;
- audit: `matchpoint_history_auto_import_success`, `matchpoint_history_auto_import_blocked`, `matchpoint_history_auto_import_error`.

Stato deploy v5.360:

- TEST: `matchpoint-history-sync` versione 1, `verify_jwt=true`, hash `ba6969fd2e337af919a9ebeb270bf1fb84f965dd858657683f5b7c120d198f6a`;
- PROD: `matchpoint-history-sync` versione 1, `verify_jwt=true`, stesso hash TEST;
- UI pubblicata con `APP_VERSION = '5.360'`.

Regola dati:

- il dato storico ufficiale resta quello cloud PROD;
- TEST va riallineato da PROD prima dei collaudi quando serve confrontare la stessa base storica;
- lo storico non e' una fotografia sostitutiva come i clienti: e' cumulativo;
- ogni import aggiunge solo righe mancanti e protegge eventuali righe esistenti con la stessa chiave;
- l'Excel Matchpoint e' solo temporaneo durante download, parse e upsert. Non va salvato in repo, documentazione, cartelle locali permanenti o Supabase Storage.

Nota UI v5.359 TEST/PROD:

- nel box `Storico Matchpoint`, dopo mockup approvato, la descrizione diventa `Analisi prenotazioni degli ultimi 12 mesi.`;
- il riepilogo viene mostrato subito sotto la descrizione in tre righe label-valore: `Periodo file`, `Nuove righe`, `Totale prenotazioni storiche`;
- il testo tecnico sul file temporaneo eliminato non viene mostrato nella UI, ma resta una regola tecnica della funzione/import.

Nota UI v5.360 TEST/PROD:

- nei box `Clienti Matchpoint` e `Storico Matchpoint` vengono rimosse le label duplicate sopra al bottone;
- i bottoni restano azioni brevi anche dopo l'esito verde: `Aggiorna clienti` e `Aggiorna storico`;
- lo stato sotto ai bottoni automatici usa `Ultimo aggiornamento automatico`, con data/ora e conteggi sintetici.

Nota UI v5.362 TEST/PROD:

- nel box `Clienti Matchpoint`, dopo mockup approvato `mockup/dati-clienti-automatici-mockup.html`, compare un riepilogo compatto con `Totale clienti database` e `Variazione ultimo import`;
- il totale clienti viene letto da `matchpointData.clientCount`, aggiornato dopo la sincronizzazione cloud;
- la variazione viene salvata in `matchpointData.lastClientsDelta` confrontando il totale appena importato con il totale dell'import clienti precedente;
- lo stato sotto al bottone clienti resta solo `Ultimo aggiornamento automatico` con data e ora, senza duplicare il totale gia mostrato nel riepilogo.

Nota tecnica v5.363 TEST/PROD:

- il caricamento cloud dei record operativi ora usa paginazione REST/RPC invece della prima pagina implicita da 1000 record;
- `Clienti Matchpoint` conta solo record `member` provenienti da Matchpoint (`source = matchpoint_auto` o `matchpointImportedAt`), evitando che record manuali o legacy sporchino il riepilogo;
- anche `Storico Matchpoint` e `Scarica novita cloud` usano la stessa lettura paginata;
- causa del disallineamento rilevato il 2026-05-10: in PROD la tabella `pmo_cloud_records` conteneva piu di 1000 record `member`, quindi la lettura non paginata vedeva solo una finestra parziale e mostrava 640 clienti invece della fotografia completa.

Nota tecnica v5.364 TEST/PROD:

- l'errore PROD `Paginazione cloud non applicata correttamente` ha confermato che gli header HTTP `Range` non sono affidabili sulla RPC PostgREST usata dall'app;
- creata su TEST e PROD la RPC permanente `pmo_get_records_admin_page(p_record_types, p_since, p_limit, p_offset)`, con lo stesso controllo staff/cloud_sync di `pmo_get_records_admin`;
- la app usa `p_limit`/`p_offset` nel payload della nuova RPC, quindi la paginazione non dipende piu dagli header e resta valida anche quando TEST superera 1000 record.

## Prenotazioni future Matchpoint automatiche v5.365-v5.367 TEST/PROD

Obiettivo:

- scaricare automaticamente da Matchpoint la fotografia delle prenotazioni/occupazioni future;
- usare il periodo dinamico `oggi -> oggi + 30 giorni`;
- sostituire la fotografia corrente solo dopo validazione positiva;
- aggiornare sia `prenotazioni` sia `prenotazioniOccupazione`, usate da Dashboard, Slot Liberi e Apri Partite;
- non archiviare il file Excel scaricato, ne' in locale ne' in Supabase Storage.

Percorso Matchpoint validato il 2026-05-10:

1. Pagina iniziale dopo login: `Pannello di controllo generale`.
2. Aprire il menu alto `Inf. e statistiche`.
3. Scorrere fino al capitolo `Occupazione`.
4. Cliccare solo la voce ufficiale `Elenco degli utenti negli spazi`.
5. Nella pagina `Utenti negli spazi`, impostare `Dal Giorno` sulla data odierna e `Al Giorno` su data odierna + 30 giorni.
6. Lasciare vuoti/neutri gli altri filtri: ora, spazio, giorno settimana, provenienza, tipo, gruppo e tipo prenotazioni.
7. Lasciare non selezionato `Solo clienti che hanno gia pagato`.
8. Cliccare prima `Generare una relazione`.
9. Cliccare poi `Esportare in Excel`.

Validazione file:

- foglio richiesto: `Risultati`;
- colonne minime: `Nome`, `Numero`, `Giorno`, `Ora`, `Ore`, `Spazio`;
- colonne viste nel file reale: `Cod.`, `Identificatore`, `Nome`, `Sesso`, `Età`, `E-mail`, `Telefono cellulare`, `Numero`, `Giorno`, `Ora`, `Ore`, `G. sett`, `Spazio`, `Descrizione`, `Tipo`, `Importo Totale`, `Riscossa`;
- il parser salva le righe giocatore in `booking`, ma calcola le occupazioni campo da tutte le righe con data/ora/campo, inclusi eventuali `Ospite`;
- se il file e' vuoto, non ha occupazioni valide o contiene solo date passate, l'import viene bloccato e non sostituisce la fotografia corrente.

Scrittura cloud:

- Edge Function: `matchpoint-bookings-sync`;
- worker browser/headless: riusa la rotta `POST /export-booking-history` passando `fromDate = oggi` e `toDate = oggi + 30 giorni`;
- record normalizzati in `pmo_cloud_records`;
- `record_type = booking` per righe prenotazione con giocatore;
- `record_type = booking_occupancy` per occupazioni campo deduplicate;
- riepilogo leggero: `record_type = matchpoint_data`, `local_key = matchpoint_bookings_auto_import_last`;
- diagnostica leggera piu recente: `local_key = matchpoint_bookings_auto_diagnostic_last`;
- audit: `matchpoint_bookings_auto_import_success`, `matchpoint_bookings_auto_import_blocked`, `matchpoint_bookings_auto_import_error`.

Regola dati:

- le prenotazioni future sono una fotografia sostitutiva, non uno storico cumulativo;
- a ogni import riuscito i record `booking` e `booking_occupancy` non piu presenti vengono marcati `deleted=true`;
- la app rilegge il risultato cloud e sostituisce le liste locali `prenotazioni` e `prenotazioniOccupazione`;
- l'Excel Matchpoint e' solo temporaneo durante download, parse e upsert. Non va salvato in repo, documentazione, cartelle locali permanenti o Supabase Storage.

Hotfix localStorage v5.366 TEST/PROD:

- dopo validazione utente del flusso automatico, TEST ha restituito `Failed to execute 'setItem' on 'Storage': Setting the value of 'test:prenotazioni' exceeded the quota`;
- la causa era il salvataggio locale in JSON esteso di liste pesanti gia presenti: `prenotazioni`, `prenotazioniOccupazione` e `storicoPrenotazioni`;
- la app ora salva queste tre liste in formato compatto con array di campi e le riespande automaticamente in memoria all'avvio;
- il contenuto logico dei record non cambia: restano disponibili `numero`, `giocatore`, `data`, `ora`, `durata`, `campo`, `tipo`, `descrizione`;
- la migrazione compatta le chiavi esistenti quando la nuova versione viene caricata, riducendo lo spazio occupato senza cancellare dati.

Nota UI v5.367 TEST/PROD:

- dopo mockup approvato `mockup/prenotazioni-future-matchpoint-automatiche-mockup.html`, il riepilogo del box `Prenotazioni future Matchpoint` mostra tre metriche operative: `Periodo`, `Ore campo prenotate`, `Occupazione stimata`;
- `Ore campo prenotate` somma la durata delle occupazioni future campo deduplicate;
- `Occupazione stimata` confronta le ore prenotate con le ore potenziali calcolate dalla griglia `Slot potenziali` per lo stesso periodo;
- rimossi dal box i dati tecnici `Righe importate` e `Totale occupazioni future`.

Nota deploy PROD v5.367, 2026-05-10:

- Edge Function `matchpoint-bookings-sync` pubblicata anche su PROD project ref `qqbfphyslczzkxoncgex`;
- TEST e PROD hanno `verify_jwt=true`, versione `1` e hash Supabase identico `dca5a1c472a19628e10f47e4bbdf4d1a8a86737321d05590fab58ac74bce67e2`;
- accesso anonimo senza JWT bloccato con `401` sia in TEST sia in PROD;
- `main`, `test-preview` e `test/accessi-staff-guidati` allineati al commit finale di pubblicazione;
- raw GitHub `main` e `test-preview` con stesso SHA-256 HTML `2af8dfdea7f0309f5b35bec5fb0d2dc2eb1380bd184f3144197ece41a2f14998` e `APP_VERSION = '5.367'`.

Nota deploy PROD v5.373, 2026-05-11:

- pubblicata in PROD la UI DATI validata in TEST da v5.368 a v5.373;
- il box `Backup dati` mantiene separati cloud e locale: `Salva backup cloud` e auto-backup post aggiornamento non scaricano file locali;
- l'auto-backup cloud post aggiornamento dati e' attivo quando l'aggiornamento viene avviato dall'app;
- in un secondo passaggio autorizzato il 2026-05-11, lo scheduler TEST e' stato spento e lo scheduler PROD e' stato attivato.

Nota worker 2026-05-10:

- dopo un errore PROD `MATCHPOINT_BROWSER_WORKER_FAILED`, la diagnostica ha indicato un timeout sul click del menu Matchpoint `Programmazione`;
- il worker ora tratta il timeout del click come voce non cliccabile e attiva il fallback diretto gia previsto su `/Reservas/ListadoJugadores.aspx`;
- la modifica non cambia credenziali, salvataggio file, validazione Excel o logica di import: rende solo piu robusta la navigazione clienti.

## Routine dati automatiche v5.368-v5.373

Dopo mockup approvato `mockup/routine-dati-automatiche-mockup.html`, la sezione `DATI (in/out)` viene riorganizzata cosi:

- la prima schermata diventa `Stato routine automatiche`;
- la tabella mostra, in ordine, `Clienti Matchpoint`, `Storico Matchpoint`, `Prenotazioni future` e `Backup cloud`;
- le colonne operative sono `Ultimo dato valido`, `Ultimo tentativo`, `Esito`, `Prossima esecuzione` e `Azione manuale`;
- gli esiti sono letti dagli stati gia esistenti dei bottoni import/backup e dagli ultimi riepiloghi salvati;
- le azioni manuali riusano le funzioni gia validate: aggiorna clienti, aggiorna storico, aggiorna prenotazioni e salva backup cloud;
- `Aggiornamenti Matchpoint e backup` diventa un'area espandibile chiusa di default con le sezioni 2-5;
- `Slot potenziali Matchpoint` diventa la sezione 6, espandibile e chiusa di default, mantenendo le opzioni reali gia presenti.

Nota: v5.368 introduce il pannello di controllo e la predisposizione UI. v5.369 rimuove l'intestazione visibile `DATI (in/out)`, il sottotitolo e la linea divisoria, cosi' la schermata DATI parte direttamente dal box `Stato routine automatiche`. v5.370 mostra nella colonna `Prossima esecuzione` giorno abbreviato, data completa e ora, per esempio `Lun 11/05/2026 • 04:30`, invece del testo relativo `domani`. v5.371 inverte gli orari proposti: `Clienti Matchpoint` alle 04:30 e `Storico Matchpoint` alle 05:00. v5.372 separa di nuovo backup cloud e backup locale: il salvataggio cloud non scarica file locali, mentre `Scarica backup locale` resta un'azione manuale in basso nel box Backup. v5.373 aggiunge auto-backup cloud post aggiornamento dati quando l'operazione viene avviata dall'app. v5.374 ricalcola automaticamente la colonna `Prossima esecuzione` quando DATI e' aperta, evitando che resti visibile un orario gia passato come `14:30`.

## Scheduler routine dati TEST/PROD

Lo scheduler backend e' stato validato prima su TEST con `supabase_pmo_data_routines_scheduler.sql`. Dal 2026-05-11 TEST resta manuale e lo scheduler automatico e' attivo solo su PROD.

Scelte operative:

- `pg_cron` esegue il dispatcher `pmo_dispatch_data_routines()` ogni 5 minuti;
- il dispatcher decide in base all'orario locale `Europe/Rome`, cosi' gli orari restano coerenti con ora legale e ora solare;
- `pg_net` invoca direttamente le Edge Function esistenti, senza creare chiamate annidate tra Edge Function;
- l'autorizzazione usa un secret generato in Supabase Vault (`pmo_data_routine_secret`) e verificato dalla RPC `pmo_verify_data_routine_secret`;
- le funzioni `matchpoint-clients-sync`, `matchpoint-history-sync` e `matchpoint-bookings-sync` mantengono il flusso staff JWT gia validato e aggiungono solo il canale server-to-server per le routine;
- gli Excel Matchpoint continuano a non essere archiviati in locale, GitHub o Storage.

Nota sicurezza: su autorizzazione esplicita, le tre funzioni Matchpoint sono deployate con `verify_jwt=false` dove serve lo scheduler `pg_net`. L'accesso resta protetto nel codice: JWT staff valido oppure secret interno Supabase Vault.

Routine attive in PROD:

| Ora locale | Funzione |
|---|---|
| 04:30 | `matchpoint-clients-sync` |
| 05:00 | `matchpoint-history-sync` |
| 05:30, 10:30, 14:30, 17:30, 21:30 | `matchpoint-bookings-sync` |

Il dispatcher usa `timeout_milliseconds = 300000`, perche' il timeout default `pg_net` di 5 secondi non e' sufficiente per gli import Matchpoint.

Validazione TEST del 2026-05-10:

- `matchpoint-clients-sync` v26 TEST: esecuzione scheduler `200 OK`, actor `routine-dati@test.padel-match-organizer`, 949 clienti importabili;
- `matchpoint-history-sync` v3 TEST: esecuzione scheduler `200 OK`, periodo 2026-04-10 / 2026-05-10;
- `matchpoint-bookings-sync` v3 TEST: esecuzione scheduler `200 OK`, periodo 2026-05-10 / 2026-06-09.

Attivazione PROD del 2026-05-11:

- prima rimosso da TEST il job `pmo-data-routines-dispatcher-test`;
- deployate in PROD `matchpoint-clients-sync` v9, `matchpoint-history-sync` v2 e `matchpoint-bookings-sync` v2 con `verify_jwt=false`;
- creati/verificati i secret Vault PROD e la RPC `pmo_verify_data_routine_secret`;
- attivato in PROD il job `pmo-data-routines-dispatcher-prod` ogni 5 minuti;
- verificato che una chiamata senza JWT staff e senza secret routine venga respinta con `AUTH_REQUIRED`.

La riga `Backup cloud` non viene automatizzata in questa prima fase backend, perche' il backup completo attuale e' un backup del browser e include dati di localStorage non ricostruibili con certezza dal solo database cloud.

## Slot potenziali v5.234

Il box `Slot potenziali` salva in localStorage la griglia teorica settimanale degli slot vendibili del club con chiave `potentialSlotSchedule`.

Da v5.234 il box consente anche di caricare un'immagine aggiornata della griglia come riferimento visivo locale. L'immagine viene salvata nel browser con chiave `potentialSlotImage` e puo' essere sostituita quando cambia la griglia del club.

Nello stesso riquadro e' presente l'editor `Griglia slot operativa`: lo staff aggiorna gli orari testuali e clicca `Salva griglia slot`. Solo questo salvataggio aggiorna `potentialSlotSchedule` e quindi Dashboard / Slot Liberi e Apri Partite.

L'immagine non viene usata come OCR e non modifica da sola `potentialSlotSchedule`: serve a mantenere visibile il riferimento operativo aggiornato.


Da v5.236 il riquadro resta aperto di default e senza barra di apertura: mostra subito il layout orizzontale con immagine di riferimento a sinistra e griglia operativa con salvataggio a destra.

Stati colore dei bottoni DATI:

- blu: pronto;
- arancione: file, immagine o modifiche selezionate ma non ancora confermate;
- verde: operazione salvata/importata.

Eccezione: il bottone `Scarica backup` resta neutro anche dopo la creazione del backup, per non dare alla sezione DATI un peso visivo da report.

Questa griglia e' la fonte comune per:

- Dashboard / `Slot Liberi`;
- Apri Partite / calendario e proposte slot liberi.

Regola di calcolo:

`slot potenziali configurati - prenotazioni/occupazioni Matchpoint importate = slot liberi reali`

La sezione DATI deve restare operativa: non mostra statistiche, report o riepiloghi estesi della griglia. La visualizzazione dei risultati resta in Dashboard o nelle viste operative.

## Cosa non deve stare nella sezione

- Statistiche generali.
- Riepiloghi lunghi ultimo import.
- Controllo operativo post-import.
- Differenze giornaliere sempre visibili.
- Consulta storico prenotazioni.

Questi contenuti, quando servono, devono stare in Dashboard o in viste dedicate, non nella schermata operativa di import.

## Regole import

Prima di salvare dati locali, l'app deve controllare:

- che il tipo file sia plausibile per il box usato;
- che i dati parsati siano importabili;
- che le prenotazioni future non siano tutte nel passato;
- che lo storico non sia composto solo da date future;
- che file vuoti o con poche righe valide non svuotino o sostituiscano dati operativi.

Se il controllo blocca l'import, nessun dato deve essere salvato in localStorage.

## Clienti automatici Matchpoint

Stato: integrata e validata in TEST con app v5.344-v5.346 dopo approvazione mockup; pubblicata in PROD v5.346 con funzione server Supabase e worker browser/headless.

Obiettivo della prima fase:

- automatizzare solo il flusso `Clienti Matchpoint`;
- mantenere manuali prenotazioni future, storico e backup;
- non introdurre cron o schedulazioni automatiche;
- non salvare credenziali Matchpoint in HTML, repository o localStorage.

Funzione server:

- `supabase/functions/matchpoint-clients-sync`;
- ambienti:
  - TEST: progetto Supabase `cudiqnrrlbyqryrtaprd`;
  - PROD: progetto Supabase `qqbfphyslczzkxoncgex`;
- deploy TEST: attivo su progetto `cudiqnrrlbyqryrtaprd`, funzione `matchpoint-clients-sync`, versione 24, `verify_jwt=true`;
- deploy PROD: attivo su progetto `qqbfphyslczzkxoncgex`, funzione `matchpoint-clients-sync`, versione 8, `verify_jwt=true`, con secret dedicati nel progetto PROD;
- invocazione manuale dalla sezione `DATI (in/out)` con il pulsante `Aggiorna clienti`;
- credenziali lette solo da secret Supabase: `MATCHPOINT_USERNAME` e `MATCHPOINT_PASSWORD`;
- URL base predefinito: `https://app-padelvillage-it.matchpoint.com.es`;
- pagina clienti predefinita: `/clientes/Listadoclientes.aspx?pagesize=15`;
- postback export predefinito: `ctl01$ctl00$CC$ContentPlaceHolderAcciones$LinkButtonExportar`.
- da versione funzione 4, se il postback predefinito non compare nella pagina, la funzione cerca automaticamente un comando export/Excel/XLS/CSV nella pagina clienti;
- da versione funzione 5, se il comando export non viene riconosciuto, la funzione salva una diagnostica tecnica sanificata in `pmo_cloud_records` con `record_type = matchpoint_data` e `local_key = matchpoint_clients_auto_diagnostic_last`. La diagnostica non deve contenere credenziali, HTML completo o file clienti: solo URL, campi ASP.NET, target postback e possibili controlli tecnici.
- da versione funzione 6, la diagnostica di errore non dipende dall'attore staff e viene tracciata anche nei log tecnici della funzione, cosi' si puo' leggere il dettaglio del problema quando la UI mostra solo il messaggio sintetico.
- da versione funzione 7, prima di aprire la pagina clienti viene fatto un warm-up su `default.aspx`; la funzione cerca URL clienti anche nella home Matchpoint e scarta `Error.aspx` anche quando la pagina errore contiene `__VIEWSTATE`.
- da versione funzione 8, una pagina `Login.aspx` con campo password non viene piu' scambiata per scelta cassa: il login fallito viene bloccato e restituito come diagnostica esplicita.
- da versione funzione 9, il login ASP.NET invia anche `__EVENTTARGET` quando il pulsante usa `__doPostBack('btnLogin','')`, oltre al valore del bottone.
- da versione funzione 10, se il bottone login usa `__doPostBack`, vengono inviati `__EVENTTARGET` e `__EVENTARGUMENT` senza aggiungere il bottone come submit normale.
- da versione funzione 11, i secret `MATCHPOINT_USERNAME` e `MATCHPOINT_PASSWORD` vengono ripuliti da spazi iniziali/finali prima del login.
- da versione funzione 12, il login HTTP allinea `ddlLenguaje` al valore runtime `HiddenFieldLang` e replica la chiamata leggera `CambiarLenguaje`, per non inviare la prima lingua della select (`es-ES`) quando la pagina Matchpoint imposta `it-IT` via JavaScript.
- da versione funzione 13, se il flusso HTTP fallisce su login, pagina clienti o export, la funzione puo' delegare a un worker browser/headless esterno configurato con `MATCHPOINT_BROWSER_WORKER_URL` e `MATCHPOINT_BROWSER_WORKER_API_KEY`; senza questi secret il comportamento resta quello precedente.
- da versione funzione 14, la Edge Function passa al worker le credenziali Matchpoint lette dai secret Supabase solo nella chiamata server-to-server protetta da API key; il worker non deve duplicare `MATCHPOINT_USERNAME` e `MATCHPOINT_PASSWORD` salvo test locali isolati.
- da versione funzione 16, se il fallback browser/headless dovrebbe partire ma i secret worker non sono disponibili nella Edge Function, la risposta distingue l'errore `MATCHPOINT_BROWSER_WORKER_SECRETS_MISSING` senza esporre i valori segreti.
- da versione funzione 17, se il file esportato dal worker non supera la validazione clienti, la funzione salva una diagnostica sanificata in `matchpoint_clients_auto_diagnostic_last` con intestazioni trovate, colonne mancanti, nome/dimensione file e diagnostica worker. Nessun dato cliente viene scritto quando la validazione fallisce.
- da versione funzione 18, la validazione resta allineata al formato clienti corretto esportato da Matchpoint: `Cliente`, `Telefono cellulare`, `E-mail`, `Eta/Età`, `Sesso` e `Livello`. La colonna `Posizione` viene letta come riferimento operativo quando presente. `Codice` e `N. socio` non vengono usati come chiave cliente: il match resta su telefono, email e nome normalizzato.
- da versione funzione 19, prima dell'upsert in `pmo_cloud_records`, la funzione deduplica i clienti che generano la stessa chiave cloud (`phone:...`, `email:...`, `name:...`). Questo evita l'errore Postgres `21000` quando il file Matchpoint contiene righe diverse con stessa chiave cliente. Il riepilogo salva `duplicateRows`.
- da versione funzione 20, il file Excel clienti esportato da Matchpoint non viene archiviato in Supabase Storage, in locale o in altri percorsi permanenti. Anche se esiste un vecchio secret `MATCHPOINT_EXPORT_BUCKET`, la funzione non carica il file: conserva solo dati normalizzati, ultimo riepilogo import e diagnostica leggera.
- da versione funzione 21, l'import clienti viene trattato come fotografia corrente Matchpoint: dopo un import riuscito, i vecchi record `member` provenienti da Matchpoint e non presenti nella fotografia appena importata vengono marcati `deleted=true`. Questo evita accumuli e discrepanze tra TEST e PROD. I record manuali/non Matchpoint non vengono cancellati automaticamente.
- da versione funzione 22, quando la base cloud contiene duplicati storici, la funzione disattiva anche i record duplicati che combaciano con un cliente della fotografia appena importata ma non sono il record scelto come valido. Il riepilogo salva `duplicateDeleted`.
- da versione funzione 23, prima dell'upsert finale la funzione deduplica tutto il batch `record_type/local_key`, non solo le righe clienti importate. Questo evita l'errore Postgres `ON CONFLICT DO UPDATE command cannot affect row a second time` quando una cancellazione duplicato e una cancellazione fotografia puntano allo stesso record cloud nello stesso import. In caso di conflitto tra record attivo e cancellazione, vince il record attivo corrente.
- da versione funzione 24, la chiamata al worker browser/headless fa retry automatico sui 502/503/504 o errori di rete, con warm-up `/health` tra i tentativi. Serve a gestire cold start o risposte transitorie vuote di Render senza richiedere un nuovo click manuale.
- da app v5.353, il feedback verde del box clienti automatici mostra le righe importabili dell'export Matchpoint (`importableRows`) e non il numero di soci ritornati dal cloud dopo la sincronizzazione.
- worker browser/headless iniziale: `tools/matchpoint-browser-worker`, Node/Playwright, endpoint `POST /export-clients`, protetto da `MATCHPOINT_WORKER_API_KEY`. Le credenziali Matchpoint non vengono salvate in HTML, repository o localStorage.
- da aggiornamento worker 2026-05-08, l'export clienti corretto non viene scaricato dalla sezione `Clienti`, ma dalla navigazione Matchpoint `Programmazione` -> `Elenco dei giocatori` -> `Esportare in excel`. Il worker usa questa navigazione menu-driven come modalita' predefinita e mantiene `direct_clients` solo come fallback diagnostico configurabile.
- da aggiornamento worker 2026-05-08 successivo, i click sui menu Matchpoint vengono eseguiti senza attendere una navigazione classica della pagina: Matchpoint apre pannelli e viste interne mantenendo `default.aspx`, quindi l'attesa deve basarsi sulla comparsa di `Elenco dei giocatori` e del pulsante `Esportare in excel`.
- da aggiornamento worker 2026-05-08 successivo, la ricerca della vista `Giocatori` e del pulsante `Esportare in excel` controlla anche gli iframe interni di Matchpoint, non solo il corpo principale di `default.aspx`.
- da aggiornamento worker v5.350, se il menu `Programmazione` non compare o `Elenco dei giocatori` non e' cliccabile, il worker usa il fallback diretto `/Reservas/ListadoJugadores.aspx` e cerca comunque `Giocatori` / `Esportare in excel` nella pagina e negli iframe.
- deploy stabile worker: predisposto `render.yaml` e `tools/matchpoint-browser-worker/Dockerfile` per pubblicare il worker come servizio web Docker su Render, branch `test-preview`, health check `/health`, piano `free` per il primo test senza carta di pagamento. Se il cold start risulta troppo lento, passare a `starter`. Render deve contenere solo `MATCHPOINT_WORKER_API_KEY`; username/password Matchpoint restano nei secret Supabase dell'ambiente chiamante.

### Secret Supabase richiesti

Ogni progetto Supabase ha secret separati. Averli configurati in TEST non li rende disponibili in PROD.

Secret obbligatori per `matchpoint-clients-sync`:

- `MATCHPOINT_USERNAME`: utente Matchpoint dedicato;
- `MATCHPOINT_PASSWORD`: password Matchpoint dedicata;
- `MATCHPOINT_BROWSER_WORKER_URL`: URL HTTPS del worker browser/headless Render;
- `MATCHPOINT_BROWSER_WORKER_API_KEY`: stessa chiave impostata nel worker Render.

Secret opzionali, perché hanno default nel codice:

- `MATCHPOINT_BASE_URL`;
- `MATCHPOINT_CLIENTS_PATH`;
- `MATCHPOINT_EXPORT_TARGET`.

Errore atteso se mancano username/password:

`MATCHPOINT_SECRETS_MISSING`

In questo caso l'import non arriva neanche al worker: bisogna configurare i secret nel progetto Supabase dell'ambiente in uso e poi riprovare dal box `Clienti Matchpoint`.

Nota PROD 2026-05-08/09:

- la funzione PROD `matchpoint-clients-sync` e' attiva sul progetto `qqbfphyslczzkxoncgex`;
- il primo tentativo in PROD e' stato bloccato da `MATCHPOINT_SECRETS_MISSING`;
- causa: i secret TEST non vengono ereditati da PROD;
- prima di considerare chiuso un deploy PROD Matchpoint, verificare sempre che PROD abbia almeno `MATCHPOINT_USERNAME`, `MATCHPOINT_PASSWORD`, `MATCHPOINT_BROWSER_WORKER_URL`, `MATCHPOINT_BROWSER_WORKER_API_KEY`.

## Pulizia gruppi cloud PROD 2026-05-09

Durante la verifica PROD sono stati trovati 10 record `player_group` attivi, mentre l'operativita' attesa era di 5 gruppi.

Operazione eseguita:

- backup tecnico creato in `pmo_cloud_records` con:
  - `record_type = app_setting`;
  - `local_key = prod_player_group_cleanup_2026_05_09_extra_groups_backup`;
- marcati `deleted=true` i 5 gruppi extra;
- mantenuti solo i 5 gruppi `Gioca con LoZio (partita)` da lunedi a venerdi;
- verifica post-pulizia: 5 gruppi attivi, 72 nominativi totali, 0 nominativi non agganciati a soci cloud.

Hotfix app v5.347:

- `Scarica novità cloud` ora propaga anche le cancellazioni cloud;
- se Supabase restituisce record `player_group` o `match_invitation` con `deleted=true`, la app rimuove il record corrispondente dal localStorage;
- senza questa correzione, i gruppi eliminati dal cloud potevano restare visibili nel browser che li aveva gia' scaricati.

Hotfix app v5.348 / funzione v19:

- dopo la configurazione dei secret PROD, il primo test ha superato il blocco `MATCHPOINT_SECRETS_MISSING` ma ha restituito errore database `21000`;
- causa tecnica: piu' righe clienti potevano generare la stessa chiave cloud nello stesso upsert;
- la funzione ora scarta le righe duplicate nello stesso batch, registra `duplicateRows` e prosegue con le righe uniche;
- la app converte gli errori-oggetto in testo leggibile, evitando la visualizzazione `[object Object]`.

## Conservazione dati e file clienti

Regola operativa da v5.349 / funzione v20:

- il file clienti Matchpoint e' una fotografia corrente dell'anagrafica, non uno storico operativo;
- non si conservano versioni multiple del file Excel clienti;
- non si salvano file clienti Excel sul Mac locale, in Supabase Storage o in altri archivi permanenti;
- l'import aggiorna i record normalizzati `member` in `pmo_cloud_records` tramite upsert;
- resta solo il riepilogo dell'ultimo import automatico in `matchpoint_clients_auto_import_last`;
- resta solo la diagnostica leggera piu recente in `matchpoint_clients_auto_diagnostic_last`, senza credenziali, HTML completo o contenuto del file clienti;
- gli audit tecnici possono registrare esito, data/ora, righe importate, righe scartate, righe duplicate e messaggi errore;
- documentazione e codice restano in GitHub; dati operativi e log tecnici restano in Supabase.

Regola fotografia da v5.351 / funzione v21:

- il file clienti Matchpoint rappresenta lo stato corrente degli iscritti esportati da Matchpoint;
- ogni import riuscito aggiorna i record presenti nella fotografia corrente;
- i vecchi record `member` con `source = matchpoint_auto` o con `matchpointImportedAt` non piu' presenti nella fotografia corrente vengono marcati `deleted=true`;
- i record duplicati storici senza `source` vengono marcati `deleted=true` solo se combaciano con un cliente della fotografia corrente e non sono il record scelto come valido;
- i record manuali con `source` esplicita diversa da `matchpoint_auto` non vengono cancellati automaticamente;
- il riepilogo dell'ultimo import salva anche `staleDeleted`, cioe' quanti vecchi record Matchpoint sono stati disattivati dalla fotografia corrente.
- il riepilogo salva anche `duplicateDeleted`, cioe' quanti duplicati storici agganciati ai clienti correnti sono stati disattivati.

### Navigazione Matchpoint per scaricare Clienti/Giocatori

Percorso corretto validato il 2026-05-08:

1. Aprire `https://app-padelvillage-it.matchpoint.com.es/default.aspx`.
2. Fare login con l'account Matchpoint dedicato.
3. Nel menu alto non usare `Clienti`.
4. Aprire `Programmazione`.
5. Nel gruppo `Giocatori, classifica e Sistema partite aperte`, scegliere `Elenco dei giocatori`.
6. Attendere la vista `Giocatori`, che mantiene spesso la URL `default.aspx` senza cambio pagina visibile.
7. Cliccare `Esportare in excel`.
8. Il file corretto deve avere foglio `Risultati` e colonne come `Cliente`, `Telefono cellulare`, `E-mail`, `Età`, `Sesso`, `Disciplina sportiva`, `Centro`, `Posizione`, `Livello`.

Note tecniche:

- Matchpoint non sempre cambia URL durante la navigazione: il worker deve verificare il contenuto della pagina, non la URL.
- La vista e il pulsante export possono comparire in frame/iframe interni.
- Fallback tecnico worker: se il menu non e' disponibile, aprire direttamente `/Reservas/ListadoJugadores.aspx` dopo login e scelta cassa, poi cercare il pulsante export.
- La sezione `Clienti` di Matchpoint esporta un file diverso con colonne come `Codice`, `Identificazione`, `Nome`, `Cognome`, `N. socio`; quel file non va usato per l'import automatico soci dell'app.
- `Codice` e `N. socio` non sono chiavi identificative nell'app: il match resta su telefono, email e nome normalizzato.

Validazioni bloccanti:

- il file esportato deve essere Excel;
- deve esistere il foglio `Risultati`;
- colonne minime: `Cliente`, `Telefono cellulare`, `E-mail`, `Eta/Età`, `Sesso`, `Livello`;
- `Posizione` e' letta quando presente, ma non viene usata come chiave di identificazione;
- deve esserci almeno una riga cliente importabile;
- la riga tecnica `TPC app NON CANCELLARE` viene esclusa;
- se il file non supera i controlli, la funzione non scrive record `member`.

Scrittura cloud:

- i clienti validi vengono salvati in `pmo_cloud_records` con `record_type = member`;
- la chiave cloud e' deterministica su telefono, email o nome;
- se esiste gia un socio cloud compatibile, i dati operativi vengono preservati;
- il riepilogo dell'ultimo import automatico viene salvato come `record_type = matchpoint_data`, `local_key = matchpoint_clients_auto_import_last`;
- il file Excel esportato non viene archiviato; eventuali riferimenti a vecchi bucket diagnostici sono ignorati dalla funzione per policy di no-accumulo.

Permessi:

- la funzione richiede token staff Supabase valido;
- la funzione richiede permesso `cloud_sync` oppure ruolo `owner/admin`;
- `SUPABASE_SERVICE_ROLE_KEY` resta solo nella funzione server e non viene mai esposto al browser.
- permessi database verificati il 2026-05-08: `service_role` deve avere `usage` sullo schema `public` e `select, insert, update, delete` su `pmo_cloud_records` e `pmo_audit_log`; senza questi grant la funzione non riesce a salvare diagnostica o import e restituisce errori tipo `permission denied for table pmo_cloud_records`.
- PROD verificato il 2026-05-08: tabelle, RPC profilo staff e grant `service_role` risultano presenti sul progetto `qqbfphyslczzkxoncgex`.

Mockup UI:

- file: `mockup/dati-clienti-automatici-mockup.html`;
- approvato prima dell'integrazione reale;
- mostra il box `Clienti Matchpoint` con pulsante automatico clienti; da v5.360 il testo visibile e' `Aggiorna clienti`;
- mostra stato ultimo import automatico, data/ora, righe importate ed eventuale errore bloccante;
- non collega il mockup a Supabase o dati reali.

Integrazione app v5.342:

- il box Clienti non usa piu il selettore file manuale nella UI principale;
- il click invoca la funzione Edge `matchpoint-clients-sync`;
- dopo la scrittura cloud l'app legge i record `member` tramite RPC staff e aggiorna `giocatori` in localStorage;
- restano preservati livello, preferenze, stato operativo e dati curati localmente dove gia presenti;
- lo stato sotto al box mostra `Ultimo aggiornamento automatico`, data/ora e righe lette quando l'import riesce;
- gli errori bloccanti vengono mostrati nel box e non scrivono dati locali.

Integrazione app v5.343-v5.344:

- versione TEST diagnostica, senza modifiche visibili alla UI;
- quando la funzione clienti automatici risponde con errore, l'app scrive in console `PMO_MATCHPOINT_CLIENTS_SYNC_ERROR` con la risposta completa ricevuta;
- da v5.344 il dettaglio viene stampato come JSON testuale, per evitare che Chrome mostri solo `Object`;
- lo scopo e' leggere il dettaglio server dell'errore `Pagina clienti Matchpoint trovata, ma il pulsante export non e riconosciuto` e correggere il riconoscimento export;
- non modifica import prenotazioni, storico, backup, slot potenziali, dati locali o logica giocatori.

Nota di verifica:

- il deploy TEST della funzione e' riuscito;
- il test reale login/export richiede secret Matchpoint configurati nel progetto Supabase TEST;
- senza secret la funzione deve rispondere con errore esplicito `MATCHPOINT_SECRETS_MISSING`.
- con secret presenti e password confermate corrette dall'utente, la funzione v11 arriva al login Matchpoint ma viene rimandata a `Login.aspx`;
- test TEST 2026-05-08: la funzione v12 ha provato l'allineamento lingua rilevato nel form, ma Matchpoint ha restituito ancora `MATCHPOINT_LOGIN_FAILED` con diagnostica salvata; la strada tecnica successiva e' il fallback con worker browser/headless, gia previsto dal piano.
- sviluppo 2026-05-08: aggiunto il fallback worker/headless nella funzione v13 e creato il worker Node/Playwright. La v14 evita la duplicazione delle credenziali Matchpoint nel worker: le legge dai secret Supabase e le invia solo alla chiamata server-to-server protetta. L'import automatico completo richiede ancora un URL pubblico HTTPS del worker e la configurazione dei secret `MATCHPOINT_BROWSER_WORKER_URL` / `MATCHPOINT_BROWSER_WORKER_API_KEY` su Supabase TEST.
- sviluppo worker Render 2026-05-08: aggiunta configurazione Docker/Render stabile per evitare tunnel temporanei. Prima del test finale occorre creare il servizio Render, recuperare l'URL `onrender.com` e impostare in Supabase TEST i secret `MATCHPOINT_BROWSER_WORKER_URL` e `MATCHPOINT_BROWSER_WORKER_API_KEY`.

## Test locali v5.228

File verificati in `dati scaricati`:

- `out.xlsx`: riconosciuto come Clienti Matchpoint; bloccato se usato come prenotazioni o storico.
- `out (1).xlsx`: riconosciuto come Prenotazioni future Matchpoint; bloccato se usato come clienti; richiede conferma se usato come storico.
- `out (2).xlsx`: riconosciuto come Storico Matchpoint; bloccato se usato come clienti; richiede conferma se usato come prenotazioni future.

La validazione clienti avvisa sui telefoni mancanti solo se il numero supera una soglia significativa, cosi pochi casi fisiologici non interrompono l'import quotidiano.

## Protezioni da mantenere

- Clienti Matchpoint non deve sovrascrivere dati operativi curati nell'app.
- Prenotazioni future sostituisce la fotografia corrente solo dopo validazione.
- Storico resta cumulativo e non sovrascrive record gia presenti.
- Backup dati deve restare disponibile nella stessa sezione.
- Nessuna pubblicazione GitHub senza conferma esplicita dell'utente.
