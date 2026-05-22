-- Padel Match Organizer
-- Migrazione per la riprogettazione del flusso autovalutazione e della dashboard Kanban dello staff
-- Timestamp: 20260522120000

-- 1. Aggiunta colonna status_autovalutazione
alter table public.assessment_tokens 
  add column if not exists status_autovalutazione text not null default 'INVITO_INVIATO';

-- 2. Vincolo CHECK per gli stati ammessi
alter table public.assessment_tokens 
  drop constraint if exists chk_status_autovalutazione;

alter table public.assessment_tokens 
  add constraint chk_status_autovalutazione 
  check (status_autovalutazione in ('INVITO_INVIATO', 'PRIMO_SOLLECITO', 'ULTIMO_SOLLECITO', 'GESTIONE_MANUALE', 'COMPILATO', 'VALIDATO'));

-- 3. Migrazione dati pregressi
update public.assessment_tokens
set status_autovalutazione = 'COMPILATO'
where status = 'completed';

update public.assessment_tokens
set status_autovalutazione = 'INVITO_INVIATO'
where status in ('created', 'sent') and status_autovalutazione = 'INVITO_INVIATO';

-- 4. Aggiornamento trigger automatico sottomissione scheda
create or replace function public.assessment_mark_token_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update assessment_tokens
  set status = 'completed',
      status_autovalutazione = 'COMPILATO',
      completed_at = coalesce(new.submitted_at, now())
  where token = new.token;
  return new;
end;
$$;

-- 5. RPC per consentire allo staff autenticato di leggere tutti i token
create or replace function public.get_assessment_tokens_admin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_data jsonb;
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
    'token', token,
    'member_local_id', member_local_id,
    'member_name', member_name,
    'phone_last4', phone_last4,
    'status', status,
    'status_autovalutazione', status_autovalutazione,
    'created_at', created_at,
    'sent_at', sent_at,
    'completed_at', completed_at,
    'registered_at', registered_at
  )), '[]'::jsonb) into v_data
  from assessment_tokens;

  return jsonb_build_object('ok', true, 'data', v_data);
end;
$$;

revoke all on function public.get_assessment_tokens_admin() from public;
revoke all on function public.get_assessment_tokens_admin() from anon;
revoke all on function public.get_assessment_tokens_admin() from authenticated;
grant execute on function public.get_assessment_tokens_admin() to authenticated;

-- 6. RPC per consentire allo staff di aggiornare manualmente lo stato del token
create or replace function public.update_assessment_token_status_admin(
  p_token text,
  p_status_autovalutazione text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
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

  if p_status_autovalutazione not in ('INVITO_INVIATO', 'PRIMO_SOLLECITO', 'ULTIMO_SOLLECITO', 'GESTIONE_MANUALE', 'COMPILATO', 'VALIDATO') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  end if;

  update assessment_tokens
  set status_autovalutazione = p_status_autovalutazione,
      status = case when p_status_autovalutazione in ('COMPILATO', 'VALIDATO') then 'completed'::text else status end,
      updated_at = now()
  where token = p_token;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.update_assessment_token_status_admin(text, text) from public;
revoke all on function public.update_assessment_token_status_admin(text, text) from anon;
revoke all on function public.update_assessment_token_status_admin(text, text) from authenticated;
grant execute on function public.update_assessment_token_status_admin(text, text) to authenticated;
