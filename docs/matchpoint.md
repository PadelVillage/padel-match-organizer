# Matchpoint / DATI (in/out)

Stato: in prova locale su v5.228.

## Obiettivo

La sezione deve essere una schermata operativa rapida per importare dati e creare backup, senza trasformarsi in dashboard o report.

## Struttura UI v5.228

- Voce menu principale: `DATI (in/out)`.
- Nessun sottomenu dedicato.
- Titolo sezione: `DATI (in/out)`.
- Sottotitolo: importare i file scaricati da Matchpoint e creare un backup locale quando serve.
- Quattro box operativi:
  - Clienti Matchpoint;
  - Prenotazioni future Matchpoint;
  - Storico Matchpoint;
  - Backup dati.

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
