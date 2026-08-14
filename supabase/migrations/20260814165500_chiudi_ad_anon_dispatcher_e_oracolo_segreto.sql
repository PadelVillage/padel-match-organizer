-- 🔒 Voce 36, seconda ripresa — i SETTE dispatcher rimasti e l'ORACOLO del segreto.
-- Nata da un mio errore di classificazione: erano finiti fra le «letture» perché non
-- contengono insert/update/delete — ma fanno `net.http_post`. Vedi
-- `20260814165955_rassegna_security_definer_anon.sql`.
--
-- Applicata il 14/08/2026 su PROD (8) e su TEST (7: `maestri_allineamento` lì non esiste),
-- più la parità di `service_role` su TEST per i 6 toccati.
-- 🚨 `pmo_dispatch_assessment_apply_level` su TEST NON è stata toccata: aveva
--    `service_role = false` già prima, e "ripristinarlo" sarebbe stato un cambiamento.
--
-- ↩️ PER RIMETTERE: `grant execute on function public.<nome>(…) to anon, authenticated;`

revoke execute on function public.pmo_dispatch_payments_sync()          from public, anon, authenticated;
revoke execute on function public.pmo_dispatch_payments_sync_today()    from public, anon, authenticated;
revoke execute on function public.pmo_dispatch_wallet_sync()            from public, anon, authenticated;
revoke execute on function public.pmo_dispatch_google_contacts_import() from public, anon, authenticated;
revoke execute on function public.pmo_dispatch_maestri_allineamento()   from public, anon, authenticated;  -- solo PROD
revoke execute on function public.pmo_dispatch_assessment_notify()      from public, anon, authenticated;
revoke execute on function public.pmo_dispatch_ai_lexicon_proposals()   from public, anon, authenticated;
revoke execute on function public.pmo_verify_data_routine_secret(text)  from public, anon, authenticated;

-- ── Parità `service_role` su TEST, per i sei toccati ────────────────────────────
--   grant execute on function public.pmo_dispatch_payments_sync()          to service_role;
--   grant execute on function public.pmo_dispatch_payments_sync_today()    to service_role;
--   grant execute on function public.pmo_dispatch_wallet_sync()            to service_role;
--   grant execute on function public.pmo_dispatch_google_contacts_import() to service_role;
--   grant execute on function public.pmo_dispatch_assessment_notify()      to service_role;
--   grant execute on function public.pmo_dispatch_ai_lexicon_proposals()   to service_role;
