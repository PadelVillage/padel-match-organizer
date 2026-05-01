# Interfaccia Giocatori e Autovalutazioni

## Versione v5.164 - 2026-05-02

Questa versione riallinea dentro l'app finale le sezioni che prima erano visibili solo come mockup o come parti non ancora aggiornate graficamente.

## Cosa e' stato integrato

- **Database giocatori**: nuova testata operativa, KPI live e tabella filtrabile collegata ai dati reali salvati in locale.
- **Giocatori / gruppi staff**: aggiunto riepilogo live con gruppi staff, giocatori nei gruppi, storico Matchpoint e giocatori stimabili dallo storico.
- **Autovalutazioni**: nuova testata, KPI live e tre aree operative chiare: Pre-invio, Post-invio, Archivio.
- **Continuita' dati**: mantenuti gli ID e le funzioni esistenti, cosi' import Matchpoint, filtri, schede giocatore, invii WhatsApp e archivio autovalutazioni continuano a usare gli stessi dati.

## Regola di salvataggio locale

Tutti i file operativi devono restare sotto:

`/Users/maurizioaprea/Downloads/Padel Match Organizer`

Struttura usata:

- App finale: `/Users/maurizioaprea/Downloads/Padel Match Organizer/padel_match_organizer_v5_164.html`
- Archivio versioni: `/Users/maurizioaprea/Downloads/Padel Match Organizer/versioni/padel_match_organizer_v5_164.html`
- Documentazione: `/Users/maurizioaprea/Downloads/Padel Match Organizer/docs/`
- Repository locale GitHub: `/Users/maurizioaprea/Downloads/Padel Match Organizer/padel-match-organizer-github/`

## Nota operativa

La v5.164 non apre una nuova logica dati: rende coerenti le sezioni gia' presenti nell'app e le collega ai contatori reali. Le evoluzioni successive possono entrare senza ricreare una chat o perdere memoria del progetto.
