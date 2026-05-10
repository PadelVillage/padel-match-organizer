# Procedura deploy TEST -> PROD

Ultimo aggiornamento: 2026-05-10

Questa procedura e' obbligatoria quando una modifica gia validata in TEST deve essere portata in PROD.

L'obiettivo e' evitare:

- pubblicazione da branch sbagliato;
- differenze non volute tra TEST e PROD;
- cache GitHub Pages ancora ferma a una versione vecchia;
- Edge Function TEST/PROD disallineate;
- modifiche accidentali a sezioni protette o file fuori perimetro;
- uso di credenziali o file Matchpoint permanenti.

## Percorsi e branch

Percorso progetto:

`/Users/maurizioaprea/Downloads/Padel Match Organizer`

Repo locale:

`/Users/maurizioaprea/Downloads/Padel Match Organizer/padel-match-organizer-github`

Non usare mai:

`/Users/maurizioaprea/Documents/New project`

Branch da allineare a fine deploy:

- `main`
- `test-preview`
- `test/accessi-staff-guidati`

Link pubblici:

- PROD: `https://padelvillage.github.io/padel-match-organizer/`
- TEST: `https://padelvillage.github.io/padel-match-organizer/test/?env=test`

## Regole bloccanti

- PROD si aggiorna solo dopo conferma testuale esplicita dell'utente.
- Ogni modifica visibile UI/layout/testi deve avere prima un mockup in `mockup/` approvato esplicitamente.
- Non usare credenziali Matchpoint in HTML, repo o documentazione.
- Non salvare Excel clienti o storico Matchpoint in locale permanente, repo o Supabase Storage.
- Non toccare file non tracciati o sezioni fuori perimetro salvo richiesta esplicita.
- Non usare comandi distruttivi come `git reset --hard` o checkout forzati senza autorizzazione esplicita.

File locali non tracciati da non toccare salvo richiesta:

- `feedback-partita.html`
- `supabase/functions/run-routines/`

## Lettura obbligatoria

Prima di modificare o pubblicare leggere:

1. `docs/registro-versioni-sezioni.md`
2. `docs/algoritmo-riempi-slot.md`
3. `docs/matchpoint.md`
4. eventuale documentazione specifica della sezione modificata.

## Preflight repo

Eseguire dalla repo locale.

1. Confermare branch e working tree:

   ```bash
   git status --short --branch
   git branch -vv
   ```

2. Confermare che la base TEST da promuovere sia quella attesa:

   ```bash
   git log --oneline --decorate -5
   git diff --stat main..test/accessi-staff-guidati
   ```

3. Controllare che il diff verso PROD tocchi solo i file previsti:

   ```bash
   git diff --name-status main..test/accessi-staff-guidati
   git diff --check
   ```

4. Se compaiono file non richiesti, fermarsi e chiarire prima del deploy.

## Controlli HTML/app

Se `index.html` e' stato modificato:

1. Confermare `APP_VERSION` nel file.
2. Eseguire parse JavaScript degli script inline.
3. Verificare che le copie HTML siano identiche quando create:

   - repo `index.html`
   - root `padel_match_organizer_vX_XXX.html`
   - root `versioni/padel_match_organizer_vX_XXX.html`

4. Eseguire render locale o su localhost.
5. Controllare console errori.
6. Verificare presenza/assenza dei testi o pulsanti attesi.
7. Fare controllo anti-effetto-collaterale:

   - leggere il diff `main..TEST`;
   - confermare che le sezioni protette non siano state modificate;
   - per modifiche DATI/Matchpoint, confermare che Dashboard, Apri Partite, Chiudi Partite, Anagrafica soci, Autovalutazioni, WhatsApp e Riempi Slot non siano stati toccati salvo richiesta.

## Controlli documentazione

Se cambia documentazione:

1. Aggiornare la copia repo in `padel-match-organizer-github/docs/`.
2. Aggiornare la copia root in `/Users/maurizioaprea/Downloads/Padel Match Organizer/docs/`.
3. Verificare che le due copie siano identiche.
4. Se la modifica cambia stato versione/sezione, aggiornare `docs/registro-versioni-sezioni.md`.

## Controlli Supabase condizionali

Questi controlli servono solo se il deploy tocca Supabase, dati cloud, Storage, Auth, Edge Function, RPC o worker.

Progetti:

- TEST: `cudiqnrrlbyqryrtaprd`
- PROD: `qqbfphyslczzkxoncgex`

### Edge Function

Per ogni Edge Function coinvolta:

1. Verificare versione TEST e PROD.
2. Verificare `verify_jwt=true`.
3. Verificare hash o contenuto deploy quando deve essere identico tra TEST e PROD.
4. Verificare accesso anonimo bloccato con `401`, quando la funzione richiede autenticazione.
5. Non stampare o salvare secret nei log, nei file o nella documentazione.

### Storage

Se il deploy tocca Storage:

1. Verificare bucket corretto per ambiente.
2. Verificare se il bucket deve essere privato.
3. Verificare numero oggetti e dimensione quando il flusso prevede sovrascrittura.
4. Verificare metadata leggeri in `pmo_cloud_records`, se previsti.

### Database

Se il deploy tocca dati:

1. Verificare record count mirati prima/dopo.
2. Separare sempre TEST e PROD.
3. Se TEST deve essere allineato a PROD, copiare solo i record richiesti e documentare la procedura.
4. Non creare RPC temporanee o funzioni database senza autorizzazione esplicita.
5. Eliminare subito eventuali strumenti temporanei approvati.

## Promozione branch

Quando tutti i controlli sono passati e l'utente ha autorizzato PROD:

1. Commit finale della documentazione/stato, se necessario.
2. Allineare localmente i branch con fast-forward:

   ```bash
   git switch main
   git merge --ff-only test/accessi-staff-guidati
   git switch test-preview
   git merge --ff-only test/accessi-staff-guidati
   git switch test/accessi-staff-guidati
   ```

3. Pushare i tre branch:

   ```bash
   git push origin main test-preview test/accessi-staff-guidati
   ```

4. Verificare che locale e remoto puntino allo stesso commit:

   ```bash
   git rev-parse main test-preview test/accessi-staff-guidati origin/main origin/test-preview origin/test/accessi-staff-guidati
   git branch -vv
   ```

## Verifica online post deploy

1. Leggere raw GitHub:

   - `https://raw.githubusercontent.com/PadelVillage/padel-match-organizer/main/index.html`
   - `https://raw.githubusercontent.com/PadelVillage/padel-match-organizer/test-preview/index.html`

2. Confrontare SHA-256 raw `main` e `test-preview`.
3. Verificare `APP_VERSION` raw.
4. Aprire PROD con cache-bust:

   `https://padelvillage.github.io/padel-match-organizer/?cachebust=vX_XXX-COMMIT`

5. Aprire TEST con cache-bust:

   `https://padelvillage.github.io/padel-match-organizer/test/?env=test&cachebust=vX_XXX-COMMIT`

6. Verificare:

   - titolo pagina PROD;
   - titolo pagina TEST;
   - `APP_VERSION`;
   - console errori;
   - testi/pulsanti principali della modifica;
   - assenza di loader error in TEST.

7. Se GitHub Pages serve ancora versione vecchia, attendere propagazione e ripetere con nuovo cache-bust.

## Report finale obbligatorio

Nel messaggio finale indicare sempre:

- versione pubblicata;
- commit finale;
- branch allineati;
- SHA raw `main` e `test-preview`;
- risultato `git diff --check`;
- risultato controllo JavaScript, se applicabile;
- risultato render PROD/TEST;
- eventuali Edge Function o controlli Supabase;
- file non tracciati lasciati intatti;
- eventuali controlli non eseguiti e motivo.

## Rollback

Prima del deploy annotare il commit PROD precedente.

In caso di errore:

1. non usare comandi distruttivi senza autorizzazione;
2. identificare il commit precedente stabile;
3. proporre rollback con commit di revert o nuova promozione controllata;
4. eseguire rollback solo dopo conferma testuale esplicita;
5. ripetere la verifica online completa dopo il rollback.
