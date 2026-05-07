# Padel Match Organizer

Web app per gestione soci, import file Matchpoint, analisi slot, creazione partite e futura autovalutazione livello soci.

## Stato progetto

Versione base inclusa nel repository: **v5.334**

Questa versione funziona ancora come app HTML locale/pubblicabile e salva i dati operativi nel browser con `localStorage`.

## File principali

```text
index.html                 Web app admin attuale
autovalutazione.html       Prima pagina pubblica per autovalutazione soci
config.js                  Configurazione Supabase usata dalla pagina pubblicata
supabase_schema.sql        Schema iniziale database Supabase
VERSIONI.md                Registro versioni
README.md                  Istruzioni progetto
.gitignore                 File da non caricare su GitHub
```

## Attenzione: dati personali

NON caricare mai su GitHub:

```text
out.xlsx
out_prenotazioni.xlsx
Backup_Padel_*.json
file Excel clienti
file Excel prenotazioni
numeri di telefono reali
email reali
backup reali della web app
```

GitHub deve contenere solo codice e documentazione.

## Obiettivo prossimo

Creare un sistema online per permettere ai soci con livello `0,5` di compilare una scheda di autovalutazione.

Flusso previsto:

```text
Socio riceve link WhatsApp
↓
Apre autovalutazione.html
↓
Compila il modulo
↓
La risposta viene salvata su Supabase
↓
La web app admin legge le risposte
↓
Lo staff conferma/applica il livello
```

## Primo setup GitHub semplice

1. Crea un repository GitHub chiamato `padel-match-organizer`.
2. Carica questi file.
3. Non caricare file Excel o backup.
4. Pubblica `index.html`, `autovalutazione.html` e `config.js` tramite GitHub Pages o servizio equivalente.

## Primo setup Supabase

1. Crea un progetto Supabase.
2. Apri SQL Editor.
3. Incolla ed esegui gli schema SQL del progetto.
4. Crea il primo profilo proprietario in `pmo_staff_profiles`.
5. Inserisci in `config.js` `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
6. Prima di aprire la pagina ai soci, verifica che le policy Supabase/RLS permettano solo le operazioni previste.

## Nota operativa

La pagina `autovalutazione.html` è una prima base tecnica. Prima di inviarla ai soci va testata con pochi utenti interni.

## Flusso TEST/PROD

Il computer locale resta un workspace pulito: non si creano piu' copie HTML di versione per ogni modifica.

- Git/GitHub conserva lo storico del codice.
- `index.html` e' sempre l'app corrente.
- TEST e PROD sono separati in Supabase, non in copie diverse dell'app.
- TEST si apre con `https://padelvillage.github.io/padel-match-organizer/test/?env=test` e usa `config-test.js`.
- PROD si apre con `https://padelvillage.github.io/padel-match-organizer/` e usa `config.js`.
- La branch `test-preview` viene pubblicata automaticamente nella cartella Pages `/test/`.
- Ogni modifica pronta per verifica viene pubblicata automaticamente in TEST.
- Ogni modifica passa prima da Supabase TEST; prima di replicarla su PROD serve autorizzazione esplicita di Maurizio.
- Le operazioni amministrative usano Supabase Auth e i permessi del profilo staff, senza PIN operativo.

Regola operativa: GitHub e TEST sono ambienti di sviluppo/collaudo; TEST viene aggiornato automaticamente per la verifica, mentre PROD non va aggiornato, pubblicato o modificato senza conferma esplicita nella conversazione.

## Flusso di lavoro a sezioni

La branch `main` deve rimanere stabile. Ogni sezione va lavorata su una branch dedicata, validata, poi consolidata su `main`.

Prima sezione validata: **Scheda Autovalutazione**.
