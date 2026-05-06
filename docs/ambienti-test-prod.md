# Ambienti TEST e PROD

## URL

- PROD: https://padelvillage.github.io/padel-match-organizer/
- TEST: https://padelvillage.github.io/padel-match-organizer/test/?env=test

## Supabase

- PROD e TEST sono due progetti Supabase separati.
- PROD usa il progetto Supabase reale di produzione e viene raggiunto dall'app tramite `config.js`.
- TEST usa un progetto Supabase dedicato a test/collaudo e viene raggiunto dall'app tramite `config-test.js`.
- Non usare mai lo stesso project ref Supabase per PROD e TEST.
- TEST deve restare senza dati sensibili reali.

Project ref:

- PROD: `qqbfphyslczzkxoncgex`
- TEST: `cudiqnrrlbyqryrtaprd`

Schema previsto:

```text
App PROD             -> config.js      -> Supabase PROD
App TEST in /test/   -> config-test.js -> Supabase TEST
```

## Procedura consigliata

1. Sviluppare nel repo locale lavorando su `index.html`, senza creare nuove copie `padel_match_organizer_v5_*.html`.
2. Pubblicare automaticamente ogni modifica pronta per verifica nella branch `test-preview`.
3. La pagina `/test/` carica automaticamente l'ultima versione della branch `test-preview`.
4. Aprire/verificare la versione TEST con `https://padelvillage.github.io/padel-match-organizer/test/?env=test`.
5. Se la modifica richiede database/Auth/funzioni, applicarla prima solo su Supabase TEST.
6. Verificare login, routine, permessi, sync e form pubblici su TEST.
7. Prima di replicare qualsiasi modifica su PROD, chiedere autorizzazione esplicita a Maurizio.
8. Solo dopo autorizzazione, applicare gli stessi cambi app/database/Auth/funzioni su Supabase PROD e/o pubblicare la versione PROD.
9. Usare Git/GitHub per storico, commit e tag versione.

## Regola pubblicazione TEST

Ogni modifica sviluppata deve essere pubblicata automaticamente in TEST appena e' pronta per la verifica di Maurizio.

La branch stabile di collaudo e' `test-preview`. La pagina `/test/` legge automaticamente l'ultima versione pubblicata su quella branch:

```text
https://padelvillage.github.io/padel-match-organizer/test/?env=test
```

La pubblicazione TEST serve a vedere e provare le modifiche reali prima della produzione. La regola vale per:

- modifiche dell'interfaccia app;
- correzioni di flusso e testi;
- nuove funzioni applicative;
- SQL, Auth, policy e configurazioni Supabase, sempre prima su Supabase TEST;
- routine cloud o sincronizzazioni da validare.

PROD non deve ricevere automaticamente le modifiche di TEST. La radice GitHub Pages resta il canale di produzione; la cartella `/test/` e' solo un loader del canale di verifica.

## Regola autorizzazione PROD

L'ambiente TEST e il repository GitHub possono essere usati per sviluppo, verifica e collaudo.

La replica in PROD non e' automatica: prima di ogni passaggio verso produzione bisogna chiedere e ricevere autorizzazione esplicita da Maurizio. La regola vale per:

- pubblicazione o promozione dell'app da TEST a PROD;
- esecuzione di SQL, funzioni, Auth, policy o configurazioni su Supabase PROD;
- sincronizzazione di dati o routine che possono modificare lo stato operativo reale;
- qualunque modifica che renda disponibile ai soci o allo staff una nuova versione in produzione.

L'autorizzazione deve essere chiara nella conversazione prima dell'intervento su PROD.

## Configurazione Auth Supabase TEST

Nel progetto Supabase TEST:

- Site URL: `https://padelvillage.github.io/padel-match-organizer/test/?env=test`
- Redirect URLs: `https://padelvillage.github.io/padel-match-organizer/*`

## Setup iniziale Supabase TEST

Stato attuale: completato il 2026-05-06 sul progetto `cudiqnrrlbyqryrtaprd`.

1. Crea un nuovo progetto Supabase chiamato `Padel Match Organizer TEST`.
2. Usa la regione `eu-west-1`, come il progetto PROD, salvo necessita' operative diverse.
3. In SQL Editor esegui gli schema in questo ordine:
   - `supabase_schema.sql`
   - `supabase_pmo_cloud_schema.sql`
   - `supabase_pmo_staff_admin_schema.sql`
4. Inserisci il primo profilo proprietario nel progetto TEST, una sola volta:

   ```sql
   insert into public.pmo_staff_profiles (email, full_name, role, status, permissions)
   values (
     'padelvillage.club@gmail.com',
     'Maurizio Aprea',
     'owner',
     'active',
     public.pmo_default_staff_permissions('owner')
   )
   on conflict (email) do update
   set full_name = excluded.full_name,
       role = excluded.role,
       status = excluded.status,
       permissions = excluded.permissions,
       updated_at = now();
   ```

5. In Project Settings copia Project URL e anon/public key nel file `config-test.js`.
6. In Authentication > URL Configuration imposta:
   - Site URL: `https://padelvillage.github.io/padel-match-organizer/test/?env=test`
   - Redirect URLs: `https://padelvillage.github.io/padel-match-organizer/*`
7. Apri `https://padelvillage.github.io/padel-match-organizer/test/?env=test`, crea l'accesso con email personale e verifica login staff, recupero password, sync cloud, routine, autovalutazione e feedback post-partita.

## Verifica Supabase TEST

Health check SQL eseguito sul progetto TEST:

```sql
select
  exists (select 1 from pmo_staff_profiles where role = 'owner' and status = 'active') as owner_profile_configured,
  to_regclass('public.assessment_tokens') is not null as assessment_tokens_ok,
  to_regclass('public.self_assessments') is not null as self_assessments_ok,
  to_regclass('public.post_match_feedback_tokens') is not null as feedback_tokens_ok,
  to_regclass('public.pmo_cloud_records') is not null as cloud_records_ok,
  to_regclass('public.pmo_routines') is not null as routines_ok,
  to_regclass('public.pmo_staff_profiles') is not null as staff_profiles_ok,
  to_regprocedure('public.pmo_get_my_staff_profile()') is not null as staff_auth_rpc_ok;
```

Risultato atteso/verificato: tutte le colonne `true`.

## Nota dati

La web app separa localStorage, sessioni staff, snapshot e backup tra TEST e PROD.
Un backup creato in TEST viene marcato come `environment: "test"`.
