-- PMO Autovalutazione - pulizia richieste link esterno duplicate dopo validazione staff
-- Mantiene la richiesta validata corrente e rimuove solo richieste piu vecchie
-- della stessa persona/socio da public.assessment_external_requests.

create or replace function public.cleanup_assessment_external_requests_admin(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_current public.assessment_external_requests%rowtype;
  v_email text;
  v_phone text;
  v_member_ids text[];
  v_deleted_codes text[] := array[]::text[];
  v_deleted_count integer := 0;
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

  if p_request_id is null then
    return jsonb_build_object('ok', false, 'error', 'INVALID_CLEANUP_REQUEST');
  end if;

  select * into v_current
  from public.assessment_external_requests
  where id = p_request_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'REQUEST_NOT_FOUND');
  end if;

  if v_current.status <> 'validated' then
    return jsonb_build_object('ok', false, 'error', 'REQUEST_NOT_VALIDATED');
  end if;

  v_email := lower(trim(coalesce(v_current.email, '')));
  v_phone := regexp_replace(coalesce(v_current.phone, ''), '[^0-9]', '', 'g');
  v_member_ids := array_remove(array[
    lower(nullif(trim(coalesce(v_current.matched_member_local_id, '')), '')),
    lower(nullif(trim(coalesce(v_current.created_member_local_id, '')), '')),
    lower(nullif(trim(coalesce(v_current.created_member_pmo_id, '')), '')),
    lower(nullif(trim(coalesce(v_current.raw_response->>'member_local_id', '')), '')),
    lower(nullif(trim(coalesce(v_current.raw_response->>'created_member_local_id', '')), '')),
    lower(nullif(trim(coalesce(v_current.raw_response->>'matched_member_local_id', '')), '')),
    lower(nullif(trim(coalesce(v_current.raw_response->>'member_id', '')), '')),
    lower(nullif(trim(coalesce(v_current.raw_response->>'memberId', '')), '')),
    lower(nullif(trim(coalesce(v_current.raw_response->>'pmo_id', '')), '')),
    lower(nullif(trim(coalesce(v_current.raw_response->>'pmoId', '')), ''))
  ], null);

  if v_email = '' and v_phone = '' and coalesce(array_length(v_member_ids, 1), 0) = 0 then
    return jsonb_build_object(
      'ok', true,
      'deleted', 0,
      'reason', 'NO_IDENTITY_KEYS',
      'kept_request_id', v_current.id,
      'kept_request_code', v_current.request_code
    );
  end if;

  with deleted as (
    delete from public.assessment_external_requests r
    where r.id <> v_current.id
      and r.submitted_at < v_current.submitted_at
      and (
        (v_email <> '' and lower(trim(coalesce(r.email, ''))) = v_email)
        or (v_phone <> '' and regexp_replace(coalesce(r.phone, ''), '[^0-9]', '', 'g') = v_phone)
        or (
          coalesce(array_length(v_member_ids, 1), 0) > 0
          and array_remove(array[
            lower(nullif(trim(coalesce(r.matched_member_local_id, '')), '')),
            lower(nullif(trim(coalesce(r.created_member_local_id, '')), '')),
            lower(nullif(trim(coalesce(r.created_member_pmo_id, '')), '')),
            lower(nullif(trim(coalesce(r.raw_response->>'member_local_id', '')), '')),
            lower(nullif(trim(coalesce(r.raw_response->>'created_member_local_id', '')), '')),
            lower(nullif(trim(coalesce(r.raw_response->>'matched_member_local_id', '')), '')),
            lower(nullif(trim(coalesce(r.raw_response->>'member_id', '')), '')),
            lower(nullif(trim(coalesce(r.raw_response->>'memberId', '')), '')),
            lower(nullif(trim(coalesce(r.raw_response->>'pmo_id', '')), '')),
            lower(nullif(trim(coalesce(r.raw_response->>'pmoId', '')), ''))
          ], null) && v_member_ids
        )
      )
    returning r.request_code
  )
  select coalesce(array_agg(request_code), array[]::text[])
  into v_deleted_codes
  from deleted;

  v_deleted_count := coalesce(array_length(v_deleted_codes, 1), 0);

  if v_deleted_count > 0 then
    insert into public.pmo_audit_log (actor_user_id, actor_email, actor_role, action, detail)
    values (
      v_actor.auth_user_id,
      v_actor.email,
      v_actor.role,
      'assessment_external_requests_cleanup',
      jsonb_build_object(
        'kept_request_id', v_current.id,
        'kept_request_code', v_current.request_code,
        'deleted', v_deleted_count,
        'deleted_request_codes', v_deleted_codes
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'deleted', v_deleted_count,
    'deleted_request_codes', v_deleted_codes,
    'kept_request_id', v_current.id,
    'kept_request_code', v_current.request_code
  );
end;
$$;

revoke all on function public.cleanup_assessment_external_requests_admin(uuid) from public;
grant execute on function public.cleanup_assessment_external_requests_admin(uuid) to authenticated;
