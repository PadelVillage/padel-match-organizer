# Matchpoint / DATI (in/out)

Stato: pubblicata in v5.310.

## Obiettivo

La sezione deve essere una schermata operativa rapida per importare dati e creare backup, senza trasformarsi in dashboard o report.

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

Stato: integrata e pubblicata in TEST con app v5.344 dopo approvazione mockup; funzione server pubblicata su Supabase TEST. La validazione reale login/export richiede secret Matchpoint configurati nel progetto TEST.

Obiettivo della prima fase:

- automatizzare solo il flusso `Clienti Matchpoint`;
- mantenere manuali prenotazioni future, storico e backup;
- non introdurre cron o schedulazioni automatiche;
- non salvare credenziali Matchpoint in HTML, repository o localStorage.

Funzione server:

- `supabase/functions/matchpoint-clients-sync`;
- ambiente iniziale: solo Supabase TEST;
- deploy TEST: attivo su progetto `cudiqnrrlbyqryrtaprd`, funzione `matchpoint-clients-sync`, versione 7, `verify_jwt=true`;
- invocazione manuale dalla sezione `DATI (in/out)` con il pulsante `Aggiorna clienti da Matchpoint`;
- credenziali lette solo da secret Supabase: `MATCHPOINT_USERNAME` e `MATCHPOINT_PASSWORD`;
- URL base predefinito: `https://app-padelvillage-it.matchpoint.com.es`;
- pagina clienti predefinita: `/clientes/Listadoclientes.aspx?pagesize=15`;
- postback export predefinito: `ctl01$ctl00$CC$ContentPlaceHolderAcciones$LinkButtonExportar`.
- da versione funzione 4, se il postback predefinito non compare nella pagina, la funzione cerca automaticamente un comando export/Excel/XLS/CSV nella pagina clienti;
- da versione funzione 5, se il comando export non viene riconosciuto, la funzione salva una diagnostica tecnica sanificata in `pmo_cloud_records` con `record_type = matchpoint_data` e `local_key = matchpoint_clients_auto_diagnostic_last`. La diagnostica non deve contenere credenziali, HTML completo o file clienti: solo URL, campi ASP.NET, target postback e possibili controlli tecnici.
- da versione funzione 6, la diagnostica di errore non dipende dall'attore staff e viene tracciata anche nei log tecnici della funzione, cosi' si puo' leggere il dettaglio del problema quando la UI mostra solo il messaggio sintetico.
- da versione funzione 7, prima di aprire la pagina clienti viene fatto un warm-up su `default.aspx`; la funzione cerca URL clienti anche nella home Matchpoint e scarta `Error.aspx` anche quando la pagina errore contiene `__VIEWSTATE`.

Validazioni bloccanti:

- il file esportato deve essere Excel;
- deve esistere il foglio `Risultati`;
- colonne minime: `Cliente`, `Telefono cellulare`, `E-mail`, `Eta/Età`, `Sesso`, `Livello`;
- deve esserci almeno una riga cliente importabile;
- la riga tecnica `TPC app NON CANCELLARE` viene esclusa;
- se il file non supera i controlli, la funzione non scrive record `member`.

Scrittura cloud:

- i clienti validi vengono salvati in `pmo_cloud_records` con `record_type = member`;
- la chiave cloud e' deterministica su telefono, email o nome;
- se esiste gia un socio cloud compatibile, i dati operativi vengono preservati;
- il riepilogo dell'ultimo import automatico viene salvato come `record_type = matchpoint_data`, `local_key = matchpoint_clients_auto_import_last`;
- il salvataggio diagnostico del file esportato e' opzionale tramite secret `MATCHPOINT_EXPORT_BUCKET`.

Permessi:

- la funzione richiede token staff Supabase valido;
- la funzione richiede permesso `cloud_sync` oppure ruolo `owner/admin`;
- `SUPABASE_SERVICE_ROLE_KEY` resta solo nella funzione server e non viene mai esposto al browser.

Mockup UI:

- file: `mockup/dati-clienti-automatici-mockup.html`;
- approvato prima dell'integrazione reale;
- mostra il box `Clienti Matchpoint` con pulsante `Aggiorna clienti da Matchpoint`;
- mostra stato ultimo import automatico, data/ora, righe importate ed eventuale errore bloccante;
- non collega il mockup a Supabase o dati reali.

Integrazione app v5.342:

- il box Clienti non usa piu il selettore file manuale nella UI principale;
- il click invoca la funzione Edge `matchpoint-clients-sync`;
- dopo la scrittura cloud l'app legge i record `member` tramite RPC staff e aggiorna `giocatori` in localStorage;
- restano preservati livello, preferenze, stato operativo e dati curati localmente dove gia presenti;
- lo stato sotto al box mostra `Ultimo automatico`, data/ora e righe lette quando l'import riesce;
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
