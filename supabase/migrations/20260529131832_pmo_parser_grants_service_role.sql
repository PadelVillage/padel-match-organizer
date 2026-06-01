-- PMO Parser Config - grant service_role su tabelle del ciclo Parser
-- Concede a service_role i privilegi DML mancanti sulle 3 tabelle usate dalla
-- Edge Function `parser-rules-update` (che scrive con service_role).
--
-- Contesto: queste tabelle sono di proprieta' del ruolo `postgres` e sono nate
-- senza i grant DML per service_role, perche' la default ACL configurata
-- FOR ROLE postgres IN SCHEMA public concede solo TRUNCATE/REFERENCES/TRIGGER/
-- MAINTAIN (acl `Dxtm`) a anon/authenticated/service_role, escludendo
-- SELECT/INSERT/UPDATE/DELETE. La default ACL "sana" di Supabase e' invece
-- quella FOR ROLE supabase_admin (acl `arwdDxtm`, DML inclusa). Le tabelle
-- create direttamente come `postgres` ereditano quella ridotta e restano senza
-- DML, generando `permission denied for table` lato Edge Function.
--
-- Questa migration replica/versiona il fix gia' applicato a caldo sul DB TEST:
-- agisce SOLO su service_role e SOLO su queste 3 tabelle. Non tocca RLS e non
-- concede privilegi DML a anon/authenticated.

grant select, insert, update, delete on public.pmo_parser_config to service_role;
grant select, insert, update, delete on public.pmo_parser_errors to service_role;
grant select, insert, update, delete on public.booking_parses    to service_role;
