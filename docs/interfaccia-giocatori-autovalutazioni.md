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

## Versione v5.165 - 2026-05-02

Correzione dopo test visivo della v5.164.

- Ripristinata la base stabile della v5.163 per non rompere Riempi Slot.
- Rimossa l'integrazione invasiva della v5.164 su Database giocatori e Autovalutazioni.
- Aggiornata solo la sezione **Giocatori / gruppi staff** con KPI e layout piu' vicino al mockup approvato.
- Riempi Slot resta isolato: calendario, overlay e logica derivano dalla v5.163 stabile.

## Versione v5.252 - 2026-05-03

Semplificazione della sezione **Autovalutazioni** su base v5.251.

- Rimossa la sezione visibile **Archivio / Ricerca soci** dalla pagina Autovalutazioni.
- Rimossa la voce **Archivio / ricerca soci** dal sottomenu Autovalutazioni.
- Il capitolo Autovalutazioni ora descrive solo il flusso operativo `Invii e risposte`.
- La ricerca anagrafica resta in **Giocatori / Database giocatori**.
- Lo storico autovalutazioni resta disponibile dove serve, dentro scheda socio e funzioni interne, senza duplicare una ricerca soci autonoma.

## Versione v5.253 - 2026-05-03

Riorganizzazione di **Post-invio e risposte**.

- La vista Post-invio passa da card verticali a tabella gestionale orizzontale.
- Le righe sono ordinate per anzianita': il record piu' vecchio, calcolato su data/ora risposta oppure invio, resta in alto.
- Le colonne principali mostrano socio, livello, telefono, invio, risposta, livello dichiarato/calcolato, disponibilita sintetica, stato e azioni.
- Le azioni restano essenziali: reinvio, pausa/riattiva, scheda test, modifica/applica, avviso socio quando previsto.
- Su schermi stretti la tabella si adatta in layout compatto per non rompere l'uso mobile.

## Versione v5.254 - 2026-05-03

Correzione impaginazione di **Post-invio e risposte**.

- La tabella resta orizzontale ma passa a 6 colonne reali: selezione, socio, date, esito, stato, azioni.
- Livello, telefono e ID vengono accorpati nella colonna Socio.
- Invio e Risposta vengono accorpati nella colonna Date.
- Stato e Azioni restano sempre dentro il box, senza sbordi o colonne tagliate.

## Versione v5.255 - 2026-05-03

Correzione della tabella **Post-invio e risposte**.

- La colonna `Socio` diventa `Giocatore`.
- La colonna `Azioni` separata viene rimossa.
- Le azioni operative vengono mostrate sotto ogni giocatore, subito sotto livello/telefono/ID, in una riga orizzontale.
- Questo evita che i pulsanti escano dal box quando la tabella viene vista con il menu laterale aperto.

## Versione v5.256 - 2026-05-03

Rifinitura responsive di **Post-invio e risposte**.

- La colonna `Esito` viene rinominata in `Risposta`, per distinguere meglio il contenuto dal flusso operativo `Stato`.
- Aggiunto un breakpoint dedicato alla tabella Post-invio per laptop stretti / 13 pollici.
- Sulle larghezze intermedie la testata si nasconde e lo Stato scende sotto, evitando sbordi orizzontali senza modificare il layout globale.
## Versione v5.257 - 2026-05-03

Semplificazione della pagina **Autovalutazioni**.

- Rimossa la voce separata `Cruscotto autovalutazioni` dal sottomenu.
- Entrando in Autovalutazioni si arriva direttamente alla pagina operativa con Pre-invio come primo flusso.
- Sopra Pre-invio e' stata aggiunta una testata sticky con i cinque KPI gia' usati in Dashboard: `Pronti da inviare`, `Risposte nuove`, `Da verificare staff`, `Inviati senza risposta`, `Token da registrare`.
- Le vecchie statistiche interne (`Inviati`, `Hanno risposto`, `Non hanno risposto`, ecc.) sono state rimosse per evitare doppioni e letture diverse.
- La testata resta fissa durante lo scroll desktop della sezione; su mobile torna statica per non rubare spazio verticale.
## Versione v5.258 - 2026-05-03

Micro-ottimizzazione visuale di **Autovalutazioni**.

- Rimossa la riga titolo grande `Autovalutazioni` sopra le statistiche.
- La testata sticky ora mostra direttamente i cinque KPI operativi sopra Pre-invio.
- Obiettivo: recuperare spazio verticale senza toccare dati, Supabase o flussi di invio/risposta.
## Versione v5.259 - 2026-05-03

Pulizia operativa di **Post-invio e risposte**.

- Rimossi i bottoni `Apri scheda test` dalla sezione Autovalutazioni: il link pubblico non serve nel controllo staff.
- Il filtro `Stato risposta` passa da 8 opzioni a 5: `Tutti`, `Risposte da gestire`, `Senza risposta`, `In pausa`, `Livello applicato`.
- Le differenze fini come `Da verificare staff` e `Pronta da applicare` restano visibili nella riga del giocatore, non nel filtro.
- Rimossa la colonna laterale `Stato`: lo stato operativo ora compare sotto ogni giocatore, vicino ai bottoni.
## Versione v5.260 - 2026-05-03

Micro-pulizia delle etichette in **Post-invio e risposte**.

- Per le righe gia applicate ora compare una sola etichetta: `Livello già applicato`.
- Rimosso il badge duplicato `Già applicato`.
- Il bottone `Avvisa socio` resta l'azione successiva, separata dallo stato.
## Versione v5.261 - 2026-05-03

Semplificazione dei controlli in **Post-invio e risposte**.

- Rimosso il badge `Notifica preparata` dalla lista: non aggiunge una decisione operativa utile.
- Rimosso il filtro `Livello attuale` dalla sezione Post-invio.
- Restano solo ricerca libera e filtro `Stato risposta`, piu' coerenti con il lavoro dello staff sulle risposte.
## Versione v5.262 - 2026-05-03

Rifinitura di **Autovalutazioni**.

- La voce `Scheda autovalutazione` viene rinominata in `Demo scheda autovalutazione`.
- Nell'app staff la scheda e' una sola anteprima: campi disabilitati, WhatsApp e invio nascosti.
- Nel link pubblico con token il modulo resta compilabile dal giocatore.
- La ricerca libera in Post-invio ora mostra la situazione del giocatore cercato anche se il livello e' gia applicato o la riga sarebbe normalmente nascosta dal filtro `Tutti`.
## Versione v5.263 - 2026-05-03

Rifinitura del comando **Aggiorna risposte** in Post-invio.

- Il pulsante non cambia piu' colore tra rosso e verde.
- Il testo resta stabile: `Aggiorna risposte`.
- Sotto al pulsante viene mostrato `Ultimo controllo` con data e ora dell'ultimo click.
- La sincronizzazione Supabase resta invariata.
## Versione v5.264 - 2026-05-03

Rifinitura di **Post-invio e risposte**.

- Nella modale `Modifica valutazione` e' stato rimosso `Salva e applica`.
- La modale resta dedicata alla sola correzione/validazione del livello: `Salva modifica`.
- L'applicazione alla scheda giocatore resta un'azione esplicita dalla riga del giocatore.
- Aggiunta pulizia mirata per Alan Ceschin/Ceskin: se non esiste una risposta collegata, il falso stato `Inviato senza risposta` viene rimosso e il token torna non inviato.
## Versione v5.265 - 2026-05-03

Correzione di **Post-invio e risposte**.

- Il bottone `Aggiorna risposte` viene forzato visibile sopra la riga `Ultimo controllo`.
- La ricerca libera per nome, cognome o telefono mostra anche la situazione storica/gia applicata del giocatore.
- Obiettivo: cercando un cognome come `Aprea`, la tabella deve mostrare la situazione disponibile anche se il ciclo e' gia stato chiuso.

## Versione v5.266 - 2026-05-03

Micro-correzione di **Post-invio e risposte**. Versione validata manualmente dall'utente e pubblicata su GitHub Pages.

- Il filtro `Livello applicato` ora include anche le situazioni storiche/gia applicate rilevate dalla stessa logica usata per mostrare il badge `Livello già applicato` nella riga.
- Obiettivo: se un giocatore appare con `Livello già applicato` cercando per nome/cognome, deve restare visibile anche quando si seleziona il filtro `Livello applicato`.
- Se esiste una nuova risposta corrente non ancora applicata, lo stato storico non deve coprirla: la riga resta `Pronta da applicare` oppure `Da verificare staff`.
