# Supabase Data API - regole operative

Ultimo aggiornamento: 2026-05-13 22:05

## Contesto

Supabase ha comunicato il cambio di comportamento per l'esposizione automatica alla Data API:

- dal 30 maggio 2026, nei nuovi progetti, le nuove tabelle in schema `public` non saranno piu esposte automaticamente alla Data API;
- dal 30 ottobre 2026, la regola sara applicata anche ai progetti esistenti;
- le tabelle esistenti mantengono i grant attuali;
- per nuove tabelle e nuove funzioni/RPC serviranno permessi espliciti ai ruoli necessari.

## Regola tecnica da adottare

Da ora in poi ogni nuova tabella o funzione SQL creata nello schema `public` deve includere grant espliciti per i ruoli realmente necessari.

Non affidarsi piu all'esposizione automatica della Data API.

Per ogni nuova tabella:

- abilitare RLS;
- creare policy coerenti;
- aggiungere grant espliciti;
- evitare accessi `anon`/`authenticated` se non necessari;
- concedere `service_role` solo dove serve alle Edge Function o alle routine server;
- testare prima in TEST tramite web app e/o RPC;
- verificare Security Advisor prima del passaggio PROD.

## Metodo di lavoro

Prima di modificare schema TEST o PROD:

1. leggere `docs/stato-progetto-corrente.md`;
2. leggere `docs/registro-versioni-sezioni.md`;
3. leggere questo documento;
4. auditare in lettura i file SQL locali rilevanti;
5. preparare un piano se servono correzioni;
6. applicare eventuali modifiche prima in TEST;
7. non intervenire in PROD senza autorizzazione esplicita.

## Audit richiesto

Quando si lavora su Supabase, verificare nei file SQL locali se per le tabelle/funzioni interessate sono presenti:

- `enable row level security`;
- policy RLS coerenti con l'uso reale;
- grant espliciti;
- grant a `service_role` dove richiesto dalle Edge Function;
- grant `anon`/`authenticated` solo dove davvero necessari.

File da controllare se presenti:

- `supabase_schema.sql`;
- `supabase_pmo_cloud_schema.sql`;
- `supabase_pmo_staff_admin_schema.sql`;
- `supabase_pmo_data_routines_scheduler.sql`;
- altri file SQL presenti nel repo o nella cartella progetto.

## Vincoli

- Non modificare schema TEST/PROD solo per questa verifica senza autorizzazione.
- Non cambiare `index.html` o funzioni Edge solo per questa verifica.
- Non fare correzioni affrettate sui permessi reali.
- Prima audit in lettura, poi eventuale piano SQL.

## Piano se emergono mancanze

Se l'audit trova mancanze, preparare un piano con:

- ambiente coinvolto;
- rischio;
- SQL proposto;
- test da fare prima in TEST;
- eventuale impatto PROD;
- rollback o mitigazione.

Questa nota non richiede interventi urgenti sull'app attuale: serve a prevenire problemi sulle prossime tabelle/migrazioni e a prepararsi alla scadenza del 30 ottobre 2026.
