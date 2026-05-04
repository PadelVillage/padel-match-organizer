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
