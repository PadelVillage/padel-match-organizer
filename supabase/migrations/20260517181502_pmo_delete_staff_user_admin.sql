-- Padel Match Organizer - staff authorization delete RPC
-- TEST-first migration. Removes only the staff profile authorization, never Supabase Auth users.

create or replace function public.pmo_delete_staff_user_admin(
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_deleted public.pmo_staff_profiles%rowtype;
begin
  select * into v_actor
  from public.pmo_current_staff_profile()
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;

  if not public.pmo_staff_permission_ok(v_actor.role, v_actor.permissions, 'manage_users') then
    return jsonb_build_object('ok', false, 'error', 'PERMISSION_DENIED');
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_EMAIL');
  end if;

  if v_email = 'padelvillage.club@gmail.com' then
    return jsonb_build_object('ok', false, 'error', 'CANNOT_DELETE_OWNER');
  end if;

  select * into v_deleted
  from public.pmo_staff_profiles
  where email = v_email
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'USER_NOT_FOUND');
  end if;

  if v_deleted.role = 'owner' then
    return jsonb_build_object('ok', false, 'error', 'CANNOT_DELETE_OWNER');
  end if;

  delete from public.pmo_staff_profiles
  where email = v_email;

  insert into public.pmo_audit_log (actor_user_id, actor_email, actor_role, action, detail)
  values (
    v_actor.auth_user_id,
    v_actor.email,
    v_actor.role,
    'staff_user_delete',
    jsonb_build_object(
      'email', v_deleted.email,
      'role', v_deleted.role,
      'status', v_deleted.status,
      'auth_user_preserved', v_deleted.auth_user_id is not null
    )
  );

  return jsonb_build_object(
    'ok', true,
    'email', v_deleted.email,
    'role', v_deleted.role,
    'status', v_deleted.status,
    'auth_user_preserved', v_deleted.auth_user_id is not null
  );
end;
$$;

revoke all on function public.pmo_delete_staff_user_admin(text) from public;
revoke all on function public.pmo_delete_staff_user_admin(text) from anon;
grant execute on function public.pmo_delete_staff_user_admin(text) to authenticated;
