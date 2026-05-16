# Procedura deploy TEST -> PROD

Ultimo aggiornamento: 2026-05-16

Questa procedura e' obbligatoria quando una modifica gia validata in TEST deve essere portata in PROD.

Questa procedura tecnica va sempre letta insieme alla policy operativa:

`docs/pmo-policy-test-prod-routine-deploy.md`

e al documento ambienti:

`docs/ambienti-test-prod.md`

In caso di dubbio:

- versioni, commit, branch e link correnti si leggono da `docs/stato-progetto-corrente.md`;
- regole TEST/PROD, routine, dati e comunicazioni si leggono da `docs/pmo-policy-test-prod-routine-deploy.md`;
- passaggi tecnici di promozione e rollback si leggono da questo documento.

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

- PROD si aggiorna solo dopo conferma testuale esplicita dell'utente con comando `PROMUOVI PROD`.
- Il rollback PROD si esegue solo dopo conferma testuale esplicita dell'utente con comando `ROLLBACK PROD`.
- Su PROD non si sviluppa nulla: se durante la promozione emerge un problema, si torna a SVILUPPO TEST oppure si fa rollback.
- Ogni promozione PROD deve avere gia' annotati versione e commit di rollback.
- Le promozioni PROD devono avvenire solo in finestra di basso utilizzo, preferibilmente la sera, quando lo staff non usa l'app.
- Ogni deploy PROD deve dichiarare l'impatto su routine, scheduler, email, Matchpoint e dati reali.
- Prima di promuovere, va controllato che tutto cio' che e' stato fatto in TEST sia intenzionale e non rompa comportamenti gia' presenti in PROD.
- Se un controllo produce un alert bloccante, la promozione si ferma e la chat deve chiedere se correggere in TEST, annullare o continuare consapevolmente.
- In TEST le routine devono restare manuali o one-shot autorizzate; nessun cron generale TEST deve restare attivo per errore.
- La modalita' manuale di TEST non deve mai essere copiata come stato PROD: gli scheduler e le routine PROD gia' approvati devono restare attivi e invariati, salvo richiesta esplicita.
- In TEST ogni comunicazione verso soci deve essere neutralizzata: eventuali email devono andare solo a `aprea.maurizio@gmail.com`.
- In PROD sono automatiche solo le routine gia' approvate e documentate; nessuna nuova automazione nasce attiva in PROD.
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

1. `docs/stato-progetto-corrente.md`
2. `docs/pmo-policy-test-prod-routine-deploy.md`
3. `docs/ambienti-test-prod.md`
4. `docs/registro-versioni-sezioni.md`
5. `docs/algoritmo-riempi-slot.md`
6. `docs/matchpoint.md`
7. eventuale documentazione specifica della sezione modificata.

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

## Pipeline tecnica obbligatoria di promozione PROD

Questa pipeline e' obbligatoria per ogni promozione PROD. Serve a evitare deploy da repo sporca, branch locali obsoleti, worktree sporcati da strumenti CLI, controlli Supabase non certificati e promozioni app non compatibili con le Edge Function live.

### 1. Workspace Git pulito

- Non usare mai la repo principale sporca per promuovere in PROD.
- Creare sempre un worktree o workspace pulito derivato dai remoti aggiornati.
- Usare come fonti affidabili:
  - `origin/main` per PROD attuale;
  - `origin/test/accessi-staff-guidati` per TEST validata;
  - `origin/test-preview` per TEST pubblicata.
- Non fidarsi di branch locali vecchi o dietro ai remoti, anche se hanno lo stesso nome.
- Calcolare il diff TEST -> PROD tra remoti aggiornati o tra worktree derivati da quei remoti.
- Se il fast-forward non e' possibile, fermarsi: non risolvere conflitti durante la promozione PROD.

### 2. Repo principale sporca

- Se la repo principale contiene modifiche locali o file non tracciati, non ripulirla e non usarla per promuovere.
- Considerare la repo principale come ambiente di lavoro, non come ambiente di deploy.
- Non cancellare, spostare o modificare file non tracciati senza autorizzazione esplicita.
- Se modifiche locali non collegate impediscono la promozione, creare un workspace pulito separato basato sui remoti e continuare solo da li'.

### 3. Supabase CLI fuori dal worktree Git di promozione

- Non eseguire Supabase CLI dentro il worktree Git usato per promuovere.
- Anche comandi apparentemente read-only possono creare `supabase/.temp/`.
- Usare una cartella separata per controlli Supabase, per esempio:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/lavoro-codex/supabase-prod-readonly`
- I file `supabase/.temp/` sono temporanei e non devono entrare in commit, deploy o pacchetti di promozione.
- Se `supabase/.temp/` compare in un worktree di controllo, lasciarlo intatto e non usarlo come workspace di pubblicazione.

### 4. Deploy Edge Function da copia temporanea pulita

Se la promozione richiede il deploy di una Edge Function PROD:

- usare solo sorgente TEST gia validato;
- preferire una copia temporanea pulita generata da `git archive` o equivalente in `/private/tmp`;
- non usare la repo principale sporca;
- non usare un worktree di promozione gia sporcato da `supabase/.temp/`;
- deployare solo la funzione prevista;
- in PROD preservare `verify_jwt=true`, salvo diversa decisione esplicita e documentata;
- non usare `--no-verify-jwt` in PROD senza autorizzazione separata.

Dopo il deploy funzione verificare:

- funzione `ACTIVE`;
- versione aumentata rispetto allo stato precedente;
- `verify_jwt=true` in PROD;
- sorgente/hash compatibile con il sorgente TEST validato;
- nessuno scheduler modificato;
- nessun invio email reale;
- nessun SQL, segreto, dato reale o Matchpoint modificato.

### 5. Query Supabase PROD seriali

- Eseguire i controlli Supabase PROD uno alla volta.
- Non lanciare controlli Supabase PROD in parallelo.
- In particolare non parallelizzare:
  - lista Edge Function;
  - query `cron.job`;
  - log email;
  - controlli scheduler;
  - deploy o check funzione.
- Se Supabase CLI restituisce errori tipo `ECIRCUITBREAKER / too many authentication failures`, fermare il preflight e riprovare piu tardi oppure usare un controllo alternativo autorizzato.
- Non dichiarare pulito un preflight se `cron.job` PROD non e' certificato.

### 6. Gate scheduler PROD

Prima di promuovere in PROD bisogna certificare la lista completa di `cron.job` PROD.

Se la modifica non riguarda scheduler, deve risultare:

- presente solo `pmo-data-routines-dispatcher-prod`, salvo altri cron gia documentati e approvati;
- assenti scheduler email Autovalutazione PROD non autorizzati;
- assenti scheduler imprevisti;
- schedule e comando dei cron approvati invariati.

Se non si riesce a leggere `cron.job`, la promozione resta bloccata. Non continuare a fiducia su scheduler PROD.

### 7. Compatibilita app / Edge Function

Ogni preflight deve confrontare:

- azioni Edge Function chiamate dalla UI TEST da promuovere;
- azioni supportate dalla Edge Function PROD live;
- versione e `verify_jwt` della funzione PROD;
- eventuali flag o payload nuovi usati dalla UI.

Se la UI richiede azioni non presenti nella Edge Function PROD live, la promozione app e' bloccata. Serve deploy controllato della Edge Function PROD prima del deploy app, con verifica post-deploy.

### 8. Fasi obbligatorie separate

La sequenza corretta e':

1. preflight Git da remoti/worktree pulito;
2. preflight Supabase in cartella separata;
3. eventuale deploy Edge Function PROD da copia temporanea pulita;
4. nuovo preflight Supabase post-funzione;
5. riepilogo preflight e attesa comando esplicito `PROMUOVI PROD`;
6. promozione branch/app solo con fast-forward;
7. verifica raw GitHub `main` e `test-preview`;
8. verifica render TEST/PROD;
9. verifica scheduler post-deploy;
10. aggiornamento documentazione;
11. riallineamento documenti root/repo/branch;
12. riepilogo finale con rollback annotato.

### 9. Documentazione root/repo

- Dopo modifiche PROD o documentali, verificare che documentazione root e documentazione repo siano coerenti.
- Se la documentazione viene aggiornata in un branch da promuovere, non deve regredire note gia presenti sullo stato reale PROD.
- Se c'e' divergenza documentale tra root, repo e branch, fermarsi e allineare prima di promuovere.
- La documentazione condivisa deve indicare solo stati realmente verificati: non dichiarare scheduler, Edge Function o automazioni attive se non sono stati controllati.

### 10. `.gitignore` e `supabase/.temp/`

- `supabase/.temp/` e' temporaneo e non va incluso nei commit.
- Durante una promozione PROD non aggiungere modifiche tecniche a `.gitignore` se non erano nel pacchetto TEST validato.
- L'eventuale modifica `.gitignore` per ignorare `supabase/.temp/` deve passare da SVILUPPO TEST Admin, non da PROMOZIONE PROD Admin durante una promozione.

## Gate anti-regressione TEST -> PROD

Prima di promuovere, la chat PROMOZIONE PROD deve confrontare cio' che e' stato fatto in TEST con cio' che e' stabile in PROD.

Il controllo deve rispondere esplicitamente a queste domande:

| Domanda | Esito richiesto |
|---|---|
| Il diff TEST -> PROD contiene solo file previsti? | Si' |
| Le sezioni protette sono rimaste fuori dal diff? | Si', salvo richiesta esplicita |
| Le routine PROD approvate restano preservate? | Si' |
| Nuovi scheduler o automatismi sono assenti o autorizzati? | Si' |
| Email/WhatsApp verso soci reali restano sotto controllo? | Si' |
| I dati TEST e PROD restano separati? | Si' |
| Eventuali copie dati da PROD/Matchpoint verso TEST sono controllate e documentate? | Si' |
| Supabase PROD viene toccato solo se previsto? | Si' |
| Matchpoint PROD viene toccato solo se previsto? | Si' |
| Il rollback e' pronto? | Si' |

Se una risposta e' `No`, `Non so`, `Da verificare` o `Non controllato`, la promozione deve fermarsi.

## Alert bloccanti

Questi alert bloccano automaticamente il deploy PROD finche' l'utente non decide come procedere:

| Alert | Cosa significa | Azione corretta |
|---|---|---|
| File inattesi nel diff | TEST contiene modifiche non previste | Fermarsi e chiarire |
| Sezione protetta modificata | Una sezione non richiesta risulta toccata | Fermarsi e valutare rischio |
| Scheduler PROD modificato | Un cron approvato cambia o sparisce | Fermarsi, salvo richiesta esplicita |
| Scheduler TEST attivo | TEST non e' completamente manuale | Fermarsi e spegnere/giustificare |
| Nuova routine PROD attiva | Automazione nuova pronta a partire in PROD | Fermarsi e chiedere autorizzazione separata |
| Email TEST verso soci reali | Protezione destinatario non garantita | Fermarsi |
| Email PROD nuova o modificata | Invii reali potenzialmente impattati | Fermarsi e richiedere approvazione |
| WhatsApp automatico | Invio automatico non autorizzato | Fermarsi |
| Dati TEST e PROD condivisi come dato vivo | Separazione ambienti non garantita | Fermarsi |
| Scrittura TEST verso Supabase PROD | Rischio dati reali | Fermarsi |
| Autovalutazione TEST mischiata con PROD | Token/log/risposte/livelli reali a rischio | Fermarsi |
| Copia dati non documentata | Non e' chiaro quale ambiente sia fonte | Fermarsi e chiarire |
| Supabase PROD toccato senza piano | Dati reali o funzioni reali coinvolti | Fermarsi |
| Matchpoint PROD toccato senza piano | Routine/import reali coinvolti | Fermarsi |
| Rollback non pronto | Non c'e' ritorno rapido alla versione stabile | Fermarsi |
| Test o verifica non eseguiti | Non e' chiaro se PROD restera' stabile | Fermarsi o dichiarare rischio |

Quando compare un alert, la chat deve mostrare:

```text
ALERT DEPLOY:
- cosa non torna;
- rischio concreto;
- opzioni:
  1. correggere in TEST;
  2. annullare la promozione;
  3. continuare solo con autorizzazione esplicita.
```

Continuare con un alert aperto richiede una conferma separata e testuale dell'utente. Il comando `PROMUOVI PROD` da solo non basta se dopo il preflight emerge un alert bloccante.

## Preflight promozione PROD

Prima di qualsiasi promozione, la chat PROMOZIONE PROD deve dichiarare e attendere conferma:

```text
Versione PROD attuale:
- versione
- commit

Versione TEST da promuovere:
- versione
- commit

Rollback pronto verso:
- versione precedente
- commit precedente

Impatto routine:
- Scheduler nuovi: si/no
- Scheduler modificati: si/no
- Scheduler PROD gia' approvati preservati: si/no
- Email automatiche: si/no
- Matchpoint automatico: si/no
- Dati reali coinvolti: si/no
- Rollback pronto: si/no

Alert preflight:
- Alert bloccanti presenti: si/no
- Se si', elenco alert e decisione richiesta

Attendo conferma: PROMUOVI PROD
```

Se l'utente non scrive esattamente `PROMUOVI PROD`, fermarsi.

Se dopo `PROMUOVI PROD` emerge un nuovo alert bloccante, fermarsi di nuovo e chiedere conferma separata prima di continuare.

## Controlli routine TEST/PROD

Questi controlli sono obbligatori prima di promuovere in PROD, anche quando la modifica sembra solo UI.

| Controllo | Regola |
|---|---|
| Scheduler TEST | Nessun cron generale TEST attivo, salvo autorizzazione esplicita documentata |
| Scheduler PROD | Cron gia' approvati e documentati devono restare attivi e invariati, salvo richiesta esplicita |
| Email TEST | Destinatario forzato a `aprea.maurizio@gmail.com` |
| Email PROD | Destinatari reali solo se la routine e' approvata |
| WhatsApp | Nessun invio automatico |
| Matchpoint TEST | Routine manuali o test controllati |
| Matchpoint PROD | Automatiche solo se gia' approvate |
| Nuove routine | Spente in PROD finche' non autorizzate |
| Dati anagrafica soci | TEST usa copia separata o riallineamento controllato; PROD resta fonte reale |
| Import Matchpoint | TEST manuale/copia controllata; PROD automatico solo se approvato |
| Autovalutazione | TEST e PROD mantengono token, log, risposte, storico e livelli separati |

Per routine dati Matchpoint, non tenere scheduler automatici attivi contemporaneamente in TEST e PROD sullo stesso account/servizio.

TEST e PROD non devono usare lo stesso dato vivo. Se serve testare su dati realistici, usare una copia controllata su ambiente TEST, documentando fonte, data e perimetro della copia. Nessuna scrittura TEST deve finire su Supabase PROD, Matchpoint reale o stati Autovalutazione PROD.

Prima della promozione, annotare lo stato degli scheduler PROD approvati. Dopo la promozione, verificare che siano ancora presenti e invariati. Per esempio, se il job `pmo-data-routines-dispatcher-prod` era attivo prima del deploy e la modifica non riguarda le routine dati, deve restare attivo dopo il deploy con la stessa schedule.

La promozione dell'app non deve:

- copiare lo stato manuale di TEST su PROD;
- disattivare cron PROD gia' approvati;
- modificare orari o dispatcher PROD;
- cambiare secret o funzioni Supabase PROD;
- attivare nuove routine PROD non autorizzate.

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
2. Verificare `verify_jwt=true`, salvo eccezione approvata esplicitamente e documentata con autenticazione interna equivalente.
3. Verificare hash o contenuto deploy quando deve essere identico tra TEST e PROD.
4. Verificare accesso anonimo bloccato con `401`, quando la funzione richiede autenticazione via gateway o via codice interno.
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

Quando tutti i controlli sono passati e l'utente ha autorizzato PROD con `PROMUOVI PROD`:

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
   - routine/scheduler coerenti con l'impatto dichiarato;
   - scheduler PROD gia' approvati ancora attivi e invariati;
   - nessuna email automatica non autorizzata;
   - nessun invio WhatsApp automatico;
   - nessuna nuova automazione Matchpoint attivata per errore.

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
- impatto routine dichiarato e verificato;
- scheduler PROD approvati preservati o variazioni autorizzate;
- alert preflight trovati e come sono stati risolti;
- commit/versione rollback annotati;
- file non tracciati lasciati intatti;
- eventuali controlli non eseguiti e motivo.

## Rollback

Prima del deploy annotare il commit PROD precedente.

In caso di errore:

1. non usare comandi distruttivi senza autorizzazione;
2. identificare il commit precedente stabile;
3. proporre rollback con commit di revert o nuova promozione controllata;
4. eseguire rollback solo dopo conferma testuale esplicita `ROLLBACK PROD`;
5. ripetere la verifica online completa dopo il rollback.

Il rollback non e' una correzione nuova in PROD: e' solo il ritorno alla versione precedente stabile. Le correzioni successive si fanno in TEST.
