-- VOCE 84 ⓑ — IL MOTIVO DEL «review» ARRIVA FINO A CHI DEVE VEDERLO.
--
-- ⛔ SENZA QUESTA MIGRAZIONE LA CURA È MEZZA E NON SI VEDE. La colonna `review_reason` esiste
-- (migrazione `20260902120000`) e `assessment-quiz` la scrive, ma l'app dei gestori le schede
-- **non le legge dalla tabella**: passa da questa RPC, che ha un elenco di colonne FISSO. Una
-- colonna che la RPC non nomina, per l'app non esiste — e il motivo sarebbe rimasto scritto in
-- un posto che nessuno guarda, cioè esattamente il difetto che stiamo curando.
-- 📌 *Un dato scritto non è un dato arrivato: fra i due c'è sempre qualcuno che lo trasporta,
--    ed è quello che di solito non si guarda.*
--
-- 🚨 CAMBIA IL TIPO DI RITORNO, quindi si DROPPA e si ricrea: PostgreSQL non permette a
-- `CREATE OR REPLACE` di aggiungere una colonna al `RETURNS TABLE`. Le due istruzioni stanno
-- in una transazione sola — la migrazione gira in transazione — così non esiste un istante in
-- cui la funzione manca e il pannello delle autovalutazioni si rompe.
--
-- ⚖️ E IL CAMBIO È COMPATIBILE NEI DUE VERSI, il che è la ragione per cui si può fare senza
-- coordinare app e database allo stesso minuto:
--   · app VECCHIA + RPC nuova → la colonna in più viene ignorata: legge per nome i campi che sa;
--   · app NUOVA + RPC vecchia → il campo torna `undefined`, l'etichetta non compare, e non si
--     rompe niente. È il verso prudente: si perde una spiegazione, non una scheda.
--
-- 🔒 I GRANT SI RIMETTONO, e sono la parte che un `drop` porta via in silenzio: misurati prima
-- (`information_schema.routine_privileges`) sono `service_role`, `authenticated`, `postgres`.
-- ⚠️ Dimenticarli non darebbe un errore qui: darebbe un `permission denied` all'app, dopo, a
-- chiunque apra il pannello. La guardia di staff dentro la funzione **resta identica**: il
-- grant apre la porta, il profilo staff decide chi passa, e sono due cose diverse.
--
-- Idempotente: si può rieseguire.

DROP FUNCTION IF EXISTS public.get_self_assessments_by_tokens(text[]);

CREATE FUNCTION public.get_self_assessments_by_tokens(p_tokens text[])
RETURNS TABLE(
  token text, submitted_at timestamp with time zone, first_name text, last_name text, phone text,
  declared_level numeric, calculated_level numeric, consistency_status text, staff_status text,
  raw_response jsonb, availability_time text, preferred_days text, desired_frequency text,
  notice text, preferred_match_type text,
  review_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare v_actor record;
begin
  -- Guardia di staff (idioma di pmo_get_records_admin & c.): senza profilo staff attivo
  -- questa funzione non versa nulla. Aggiunta il 16/08/2026: la registrazione utenti su
  -- Supabase è APERTA, quindi `authenticated` non è un cerchio chiuso e il solo grant
  -- non bastava a proteggere nome/cognome/telefono dei soci.
  select * into v_actor from public.pmo_current_staff_profile() limit 1;
  if not found then raise exception 'AUTH_REQUIRED'; end if;

  return query
    select s.token, s.submitted_at, s.first_name, s.last_name, s.phone,
           s.declared_level, s.calculated_level,
           coalesce(s.consistency_status,'') as consistency_status,
           coalesce(s.staff_status,'') as staff_status,
           coalesce(s.raw_response,'{}'::jsonb) as raw_response,
           s.availability_time, s.preferred_days, s.desired_frequency, s.notice, s.preferred_match_type,
           -- 🆕 VOCE 84 ⓑ: perché la MACCHINA l'ha mandata in «review». `''` = non misurato —
           -- o la scheda è di prima del 02/09/2026, o in review ce l'ha messa una PERSONA.
           -- ⚠️ Le due non si distinguono a posteriori e non si indovinano: chi legge deve
           -- poterle trattare uguale, cioè non dire niente.
           coalesce(s.review_reason,'') as review_reason
      from self_assessments s
     where s.token = any(p_tokens)
     order by s.submitted_at desc;
end $function$;

GRANT EXECUTE ON FUNCTION public.get_self_assessments_by_tokens(text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_self_assessments_by_tokens(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_self_assessments_by_tokens(text[]) TO postgres;
