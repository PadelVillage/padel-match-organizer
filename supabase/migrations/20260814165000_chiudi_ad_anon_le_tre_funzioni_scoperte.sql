-- 🔒 Voce 36, prima ripresa — le TRE senza guardia. Il ragionamento sta in
-- `20260814165955_rassegna_security_definer_anon.sql`; qui c'è l'SQL applicato.
--
-- Applicata il 14/08/2026: su **PROD** tutte e tre; su **TEST** solo `pmo_audit_admin`,
-- perché le altre due lì erano già chiuse ad `anon` (la voce 31 al contrario).
--
-- ① pmo_dispatch_data_routines — faceva partire la catena dei cron, net.http_post coi
--    segreti pescati da sé, `p_now` scelto dal chiamante. NON provata da anon di proposito:
--    net.http_post non torna indietro con un rollback.
-- ② pmo_cleanup_dispatch_logs — DELETE senza guardia: con `0` cancellava 1457 righe.
-- ③ pmo_audit_admin — falsificava il registro di controllo. Provata come anon in transazione
--    annullata: scritta «presidente@padelvillage.club · owner · staff_delete_full».
--
-- ↩️ PER RIMETTERE:
--   grant execute on function public.pmo_dispatch_data_routines(timestamptz) to anon, authenticated;
--   grant execute on function public.pmo_cleanup_dispatch_logs(integer)      to anon, authenticated;
--   grant execute on function public.pmo_audit_admin(text,text,text,jsonb)   to anon, authenticated;

-- ── PROD (`qqbf…`) ──────────────────────────────────────────────────────────────
revoke execute on function public.pmo_dispatch_data_routines(timestamptz) from public, anon, authenticated;
revoke execute on function public.pmo_cleanup_dispatch_logs(integer)      from public, anon, authenticated;
revoke execute on function public.pmo_audit_admin(text, text, text, jsonb) from public, anon, authenticated;

-- ── TEST (`cudi…`): solo la terza, poi la parità di service_role ────────────────
--   revoke execute on function public.pmo_audit_admin(text,text,text,jsonb) from public, anon, authenticated;
--   grant  execute on function public.pmo_audit_admin(text,text,text,jsonb) to service_role;
