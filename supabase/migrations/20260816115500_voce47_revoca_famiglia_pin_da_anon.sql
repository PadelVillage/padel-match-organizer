-- Voce 47, reperto B — 16/08/2026, 26ª sessione. Autorizzata dal committente, da sola.
--
-- IL DIFETTO: pmo_admin_pin_ok(text) e' SECURITY DEFINER, eseguibile da anon, e
-- risponde vero/falso su ogni tentativo di PIN. Da anon e' un ORACOLO a tentativi
-- illimitati, senza blocco e senza traccia. E' la stessa forma di
-- pmo_verify_data_routine_secret, che la voce 36 chiuse chiamandola «la chiave
-- che apre le altre porte».
--
-- MISURATO, non dedotto:
--   · hash $2a$06$  => bcrypt a costo 6, il minimo pratico
--   · da anon: 100 tentativi in 508 ms  => ~197-213/s in una sola chiamata SQL
--   · il PIN apre le 11 varianti *_admin(p_admin_pin, …): leggere i record,
--     l'elenco staff con email e permessi, il registro di controllo, e SCRIVERE
--     (upsert record, creare utenti staff, cambiarne lo stato). E' una
--     scorciatoia che scavalca l'intero login staff.
--
-- PERCHE' NON BASTA REVOCARE SOLO L'ORACOLO, ed e' il punto di questa migrazione:
-- pmo_admin_pin_ok e' la guardia INTERNA delle 11 varianti, quindi ognuna di esse
-- e' a sua volta un oracolo. Misurato ai due lati:
--     pmo_admin_pin_ok            100 tentativi in 508 ms
--     pmo_get_staff_users_admin   100 tentativi in 486 ms
--     pmo_upsert_records_admin    100 tentativi in 472 ms
-- Le varianti sono oracoli ALLA STESSA VELOCITA' — anzi appena piu' rapide — e
-- pmo_upsert_records_admin e' per giunta quella che, a indovinare, concede le
-- scritture. Revocare il solo pmo_admin_pin_ok avrebbe spostato l'attacco senza
-- ridurlo: una cura che sembra una cura.
--
-- COSA NON TOCCA: le varianti SENZA PIN, che sono quelle che l'app usa davvero e
-- che gia' reggono per conto loro (AUTH_REQUIRED via pmo_current_staff_profile).
-- E non tocca `authenticated`, il cui grant e' ESPLICITO in ACL e quindi
-- sopravvive al revoke da PUBLIC.
--
-- ⚠️ PERIMETRO VERIFICATO SU TUTTI E TRE I LATI prima di chiudere, perche'
-- chiudere alla cieca e' l'errore che insegna il reperto C della stessa voce:
--   · app        p_admin_pin: 0 occorrenze in index.html
--   · edge       0 occorrenze in supabase/functions/ e consumer-app/
--   · bot        repo assistente-padel-agent agganciato apposta su sua
--                autorizzazione: 0 occorrenze in 65 file / 16.460 righe, con
--                controllo positivo (la sonda trova i tre ponti noti —
--                consumer-booking-write, consumer-player-readmodel,
--                consumer-assessment-link — quindi lo zero e' un esito, non
--                una sonda cieca)
--
-- ✅ VERIFICATA DOPO, sul bersaglio:
--   · come anon: permission denied su l'oracolo E sulle varianti col PIN
--   · CONTROPROVA NEGATIVA: la variante SENZA pin resta raggiungibile da anon e
--     risponde AUTH_REQUIRED => la strada dell'app non e' stata toccata
--   · CONTROPROVA POSITIVA: authenticated continua a eseguire
--   · SECURITY DEFINER aperte ad anon: 32 -> 20, confermato TRE volte
--     (pg_proc; il linter a 20 anon_security_definer_function_executable; e il
--      totale avvisi 99 -> 87, cioe' esattamente -12, senza avvisi nuovi)
--   · authenticated_security_definer_function_executable resta 40: dall'altro
--     lato non e' stato toccato niente
--
-- ↩️ RIPRISTINO (verbatim): rieseguire per ognuna delle 12
--     GRANT EXECUTE ON FUNCTION public.<firma> TO anon;
--     GRANT EXECUTE ON FUNCTION public.<firma> TO PUBLIC;

REVOKE EXECUTE ON FUNCTION public.pmo_admin_pin_ok(p_admin_pin text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pmo_get_audit_log_admin(p_admin_pin text, p_limit integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pmo_get_records_admin(p_admin_pin text, p_record_types text[], p_since timestamp with time zone) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pmo_get_routines_admin(p_admin_pin text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pmo_get_staff_users_admin(p_admin_pin text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pmo_log_routine_run_admin(p_admin_pin text, p_routine_local_key text, p_status text, p_summary jsonb, p_created_records jsonb, p_error_message text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pmo_set_group_match_routine_admin(p_admin_pin text, p_group_id text, p_group_name text, p_enabled boolean, p_hours_before integer, p_config jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pmo_set_staff_user_status_admin(p_admin_pin text, p_email text, p_status text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pmo_upsert_records_admin(p_admin_pin text, p_records jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pmo_upsert_staff_user_admin(p_admin_pin text, p_email text, p_full_name text, p_role text, p_status text, p_permissions jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_assessment_tokens_admin(p_admin_pin text, p_tokens jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_post_match_feedback_tokens_admin(p_admin_pin text, p_tokens jsonb) FROM anon, PUBLIC;
