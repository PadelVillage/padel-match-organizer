-- PMO Parser Config - default privileges service_role su tabelle future (schema public)
-- Sana la causa SISTEMICA del problema "permission denied for table" sul ciclo Parser.
--
-- Diagnosi (vedi anche migration 20260529131832 per il fix puntuale sulle 3
-- tabelle gia' esistenti):
-- In questo progetto la default ACL per ruolo `postgres` in schema public era
-- anomala: concedeva ad anon/authenticated/service_role solo `Dxtm`
-- (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN), SENZA i privilegi DML
-- (SELECT/INSERT/UPDATE/DELETE). La default ACL "sana" di Supabase e' quella
-- per ruolo `supabase_admin` (`arwdDxtm`, DML inclusa). Poiche' le default
-- privileges sono indicizzate sul ruolo che CREA l'oggetto, ogni tabella creata
-- come `postgres` (SQL editor / migration) nasceva senza DML per service_role,
-- generando `permission denied for table` lato Edge Function.
--
-- Questo ALTER allinea la default ACL del ruolo `postgres`: da qui in avanti
-- ogni NUOVA tabella creata come `postgres` in schema public concede
-- automaticamente la DML a service_role, senza GRANT espliciti per-tabella.
--
-- Ambito volutamente ristretto a `service_role`: anon/authenticated NON vengono
-- aggiunti (l'accesso di quei ruoli e' mediato da RLS, la mancanza di DML di
-- default e' intenzionale). RLS non viene toccata.
--
-- Su TEST e' gia' applicato a caldo; questa migration lo versiona e ne garantisce
-- l'applicazione automatica al deploy PROD.

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
