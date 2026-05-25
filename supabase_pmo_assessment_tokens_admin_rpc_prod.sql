-- Padel Match Organizer - PROD: deploy get_assessment_tokens_admin RPC.
-- Apply to the PROD Supabase project (qqbfphyslczzkxoncgex).
--
-- Scope:
--   Crea/aggiorna la funzione get_assessment_tokens_admin usata dal tokenSync
--   del client (v5.558+) per importare i token inviati dal cron mentre il Mac
--   era spento. Senza questa funzione il tokenSync fallisce silenziosamente e
--   i soci inviati in automatico non appaiono nella tab Solleciti.
--
-- Idempotente: sicuro da rieseguire più volte.

-- ─── RPC get_assessment_tokens_admin ──────────────────────────────────────────

create or replace function public.get_assessment_tokens_admin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_data  jsonb;
begin
  select * into v_actor
  from public.pmo_current_staff_profile()
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;

  if not public.pmo_staff_permission_ok(v_actor.role, v_actor.permissions, 'cloud_sync') then
    return jsonb_build_object('ok', false, 'error', 'PERMISSION_DENIED');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'token',                token,
    'member_local_id',      member_local_id,
    'member_name',          member_name,
    'phone_last4',          phone_last4,
    'status',               status,
    'status_autovalutazione', status_autovalutazione,
    'created_at',           created_at,
    'sent_at',              sent_at,
    'completed_at',         completed_at,
    'registered_at',        registered_at
  )), '[]'::jsonb) into v_data
  from public.assessment_tokens;

  return jsonb_build_object('ok', true, 'data', v_data);
end;
$$;

-- ─── Permessi ─────────────────────────────────────────────────────────────────

revoke all    on function public.get_assessment_tokens_admin() from public;
revoke all    on function public.get_assessment_tokens_admin() from anon;
revoke all    on function public.get_assessment_tokens_admin() from authenticated;
grant execute on function public.get_assessment_tokens_admin() to authenticated;

-- ─── Diagnostica (risultato visibile nel SQL Editor) ──────────────────────────
-- Mostra quanti token esistono per status e status_autovalutazione.

select
  status,
  status_autovalutazione,
  count(*) as n,
  min(created_at) as prima,
  max(sent_at)    as ultimo_invio
from public.assessment_tokens
group by status, status_autovalutazione
order by status, status_autovalutazione;
