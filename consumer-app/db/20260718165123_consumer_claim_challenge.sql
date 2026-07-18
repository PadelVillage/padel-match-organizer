-- Progetto CONSUMER `aylykijfirtegyxzdwgu` — GIÀ APPLICATA il 18/07/2026.
--
-- Consuma un tentativo di verifica del codice, atomicamente.
--
-- Guardia e incremento nella STESSA istruzione: se fossero due (leggo, decido,
-- scrivo) un attacco concorrente potrebbe far passare più tentativi di quelli
-- consentiti fra la lettura e la scrittura. Nessuna riga in uscita = challenge
-- inesistente, scaduta, già usata o tentativi esauriti: al chiamante servono
-- indistinguibili, quindi la funzione non dice quale dei quattro.

create or replace function public.consumer_claim_challenge(p_id uuid)
returns table (member_id text, email text, decoy boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.consumer_login_challenges c
     set attempts = c.attempts + 1
   where c.id           = p_id
     and c.consumed_at is null
     and c.expires_at   > now()
     and c.attempts     < 5          -- 5 tentativi per challenge sul codice a 6 cifre
  returning c.member_id, c.email, c.decoy;
end;
$$;

revoke all on function public.consumer_claim_challenge(uuid) from public, anon, authenticated;
grant execute on function public.consumer_claim_challenge(uuid) to service_role;

comment on function public.consumer_claim_challenge(uuid) is
  'Brucia un tentativo su una challenge di login e ne restituisce i dati se è ancora valida. Solo service_role.';
