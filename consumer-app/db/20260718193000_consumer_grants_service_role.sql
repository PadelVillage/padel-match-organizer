-- Progetto CONSUMER `aylykijfirtegyxzdwgu` — APPLICATA il 18/07/2026.
--
-- Difetto trovato collaudando il rate limit, ma PREESISTENTE e più grave di
-- quello: `service_role` non aveva SELECT/INSERT/DELETE su NESSUNA delle
-- tabelle del login. `consumer-auth-start` rispondeva `DB_ERROR` (503).
--
-- RLS e policy non bastano: in Postgres servono ANCHE i GRANT. Su questo
-- progetto le tabelle create di recente via migration non hanno ricevuto i
-- privilegi che Supabase concede per default — le whatsapp_*, più vecchie, ce
-- li hanno; consumer_*, preferenze_giocatori, proposte_partita no.
--
-- ⚠️ Perché non se n'era accorto nessuno, ed è la parte istruttiva: tutto ciò
-- che era stato provato passa da RPC SECURITY DEFINER (consumer_claim_challenge,
-- consumer_bind_profile, custom_access_token_hook), che girano coi privilegi
-- del proprietario e IGNORANO i grant. Il curl che dava `401 INVALID_CODE`
-- passava di lì, e sembrava una prova che il DB rispondesse. A rompersi era
-- solo l'accesso DIRETTO via PostgREST — cioè il primo login vero, che nessuno
-- aveva ancora fatto.
--
-- Privilegio minimo, deliberatamente:
--  · niente UPDATE: le challenge le aggiorna consumer_claim_challenge, che è
--    SECURITY DEFINER e non ha bisogno di grant;
--  · niente grant ad anon/authenticated sulle due tabelle di login: restano
--    service_role-only, come da disegno.

grant select, insert, delete on public.consumer_login_challenges to service_role;
grant select, insert, delete on public.consumer_identify_throttle  to service_role;

-- consumer_profiles ha già una policy «SELECT della propria riga» per
-- authenticated, ma senza GRANT quella policy è inerte: il socio non potrebbe
-- leggere il proprio profilo. Oggi il frontend passa solo dalle edge function e
-- non se ne accorgerebbe, ma la policy dichiara un'intenzione e questo la rende
-- vera. Restano fuori INSERT e UPDATE: il profilo lo scrive il server dopo
-- l'OTP verificato, altrimenti un socio potrebbe rivendicare un memberId altrui.
grant select on public.consumer_profiles to authenticated;
