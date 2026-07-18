-- Progetto CONSUMER `aylykijfirtegyxzdwgu` — GIÀ APPLICATA il 18/07/2026.
--
-- Aggancio auth.users ↔ memberId Matchpoint, eseguito DOPO che l'OTP è stato
-- verificato. Sta qui e non nell'edge function perché è l'unico punto in cui il
-- vincolo UNIQUE su matchpoint_member_id va negoziato, e va fatto atomicamente.
--
-- Perché il socio non può chiamarla: consumer_profiles non ha policy INSERT o
-- UPDATE apposta — se potesse scrivere il proprio profilo rivendicherebbe
-- qualunque memberId. L'execute è concesso al solo service_role.

create or replace function public.consumer_bind_profile(
  p_auth_user_id uuid,
  p_member_id    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_member_id !~ '^[0-9]{6}$' then
    raise exception 'memberId non valido: %', p_member_id
      using errcode = 'check_violation';
  end if;

  -- Il socio ha appena dimostrato di controllare la casella che l'anagrafica
  -- associa a questo memberId. Se lo stesso memberId risultava agganciato a un
  -- altro utente — caso tipico: la segreteria gli ha cambiato l'email in
  -- scheda, quindi GoTrue crea un utente nuovo — l'aggancio si sposta, perché
  -- l'autorità sull'identità è l'anagrafica Matchpoint, non auth.users.
  delete from public.consumer_profiles
   where matchpoint_member_id = p_member_id
     and auth_user_id <> p_auth_user_id;

  insert into public.consumer_profiles (auth_user_id, matchpoint_member_id)
  values (p_auth_user_id, p_member_id)
  on conflict (auth_user_id) do update
    set matchpoint_member_id = excluded.matchpoint_member_id,
        updated_at           = now();
end;
$$;

revoke all on function public.consumer_bind_profile(uuid, text) from public, anon, authenticated;
grant execute on function public.consumer_bind_profile(uuid, text) to service_role;

comment on function public.consumer_bind_profile(uuid, text) is
  'Aggancia un utente GoTrue al suo memberId Matchpoint dopo la verifica OTP. Solo service_role.';
