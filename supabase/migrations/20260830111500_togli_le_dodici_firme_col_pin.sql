-- ── Le 12 firme col PIN se ne vanno: erano peso morto, e il sovraccarico era un piede di porco ──
--
-- 🗣️ Fatto il 30/08/2026 su sua parola ripetuta («procedi come pensi sia giusto per il progetto»),
--    dopo che la scheda in docs/lavori/README.md ne aveva dichiarato il drop come «NON fatto,
--    perché i chiamanti li ho contati in un repo solo». Quel conteggio ora è chiuso.
--
-- 📏 CINQUE FRONTI MISURATI, non dedotti — ed è il motivo per cui questo drop si può fare:
--    ① `padel-match-organizer`: `p_admin_pin` non compare in nessun .ts/.js/.mjs/.html, e ogni
--       punto di chiamata vero passa `p_records` o `p_record_types` col token di staff, cioè il
--       gemello SENZA pin;
--    ② `assistente-padel-agent` (clonato apposta, 177 file .ts, 52.382 righe): zero occorrenze di
--       `p_admin_pin` e zero dei 12 nomi. La sonda è stata provata di vedere codice vero — trova
--       le cinque edge `consumer-*` che il bot chiama davvero;
--    ③ `cron.job`: nessun job le nomina;
--    ④ dentro il database: le uniche funzioni la cui definizione contiene `p_admin_pin` sono le 12
--       stesse — nessun terzo le chiama;
--    ⑤ `pmo_admin_pin_ok` è nominata solo dalle altre firme col PIN ⇒ il gruppo è CHIUSO IN SÉ, e
--       toglierlo tutto insieme non lascia un riferimento penzolante.
--
-- ⚖️ NON erano un buco, e va detto perché la scheda non venga riletta come un allarme: la voce 47
--    aveva già tolto `anon` e `PUBLIC` il 16/08, quindi restava solo `service_role` — la chiave
--    segreta, che scavalca tutto comunque. Se ne vanno per due ragioni più piccole e vere:
--    · sono `SECURITY DEFINER` che non serve a nessuno, e una superficie inutile conta il giorno
--      in cui qualcuno riconcede un EXECUTE per sbaglio;
--    · 🚨 il SOVRACCARICO è la ragione seria: `pmo_upsert_records_admin` esisteva in `(jsonb)` e in
--      `(text, jsonb)`, e una chiamata futura che mandasse per caso una chiave `p_admin_pin`
--      sarebbe finita IN SILENZIO sulla strada vecchia, con un controllo diverso da quello vivo.
--
-- 🔙 COME SI TORNA INDIETRO, e questa riga è la condizione che rendeva lecito il drop: le
--    definizioni stanno in git — supabase/manual-sql/supabase_pmo_cloud_schema.sql,
--    supabase/manual-sql/supabase_pmo_staff_admin_schema.sql, supabase/manual-sql/supabase_schema.sql.
--    📌 Un drop si fa quando i chiamanti sono stati CONTATI e il sorgente è RECUPERABILE: se manca
--       una delle due, non è prudenza rimandarlo — è l'unica cosa che si può fare.
--
-- ⛔ Niente CASCADE, di proposito: se qualcosa dipendesse davvero da una di queste, questo
--    script deve FALLIRE e dirlo, non portarsi via il dipendente in silenzio.

drop function if exists public.pmo_get_audit_log_admin(text, integer);
drop function if exists public.pmo_get_records_admin(text, text[], timestamp with time zone);
drop function if exists public.pmo_get_routines_admin(text);
drop function if exists public.pmo_get_staff_users_admin(text);
drop function if exists public.pmo_log_routine_run_admin(text, text, text, jsonb, jsonb, text);
drop function if exists public.pmo_set_group_match_routine_admin(text, text, text, boolean, integer, jsonb);
drop function if exists public.pmo_set_staff_user_status_admin(text, text, text);
drop function if exists public.pmo_upsert_records_admin(text, jsonb);
drop function if exists public.pmo_upsert_staff_user_admin(text, text, text, text, text, jsonb);
drop function if exists public.upsert_assessment_tokens_admin(text, jsonb);
drop function if exists public.upsert_post_match_feedback_tokens_admin(text, jsonb);

-- per ultima, perché è quella da cui dipendevano le altre dieci
drop function if exists public.pmo_admin_pin_ok(text);
