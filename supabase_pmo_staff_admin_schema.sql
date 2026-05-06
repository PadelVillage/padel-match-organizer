-- Padel Match Organizer - Staff administration and Supabase Auth bridge
-- Safe to run multiple times in Supabase SQL Editor.
-- Run after supabase_pmo_cloud_schema.sql.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.pmo_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.pmo_staff_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text not null unique,
  full_name text not null default '',
  role text not null default 'staff',
  status text not null default 'invited',
  permissions jsonb not null default '{}'::jsonb,
  invited_at timestamptz not null default now(),
  activated_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pmo_staff_profiles_email_lower check (email = lower(email)),
  constraint pmo_staff_profiles_role_check check (role in ('owner', 'admin', 'staff', 'readonly')),
  constraint pmo_staff_profiles_status_check check (status in ('invited', 'active', 'paused'))
);

create index if not exists idx_pmo_staff_profiles_email on public.pmo_staff_profiles(email);
create index if not exists idx_pmo_staff_profiles_auth_user on public.pmo_staff_profiles(auth_user_id);
create index if not exists idx_pmo_staff_profiles_status on public.pmo_staff_profiles(status);

drop trigger if exists trg_pmo_staff_profiles_updated_at on public.pmo_staff_profiles;
create trigger trg_pmo_staff_profiles_updated_at
before update on public.pmo_staff_profiles
for each row execute function public.pmo_touch_updated_at();

create table if not exists public.pmo_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_email text,
  actor_role text,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_pmo_audit_log_created_at on public.pmo_audit_log(created_at desc);
create index if not exists idx_pmo_audit_log_actor on public.pmo_audit_log(actor_email, created_at desc);

create or replace function public.pmo_default_staff_permissions(p_role text)
returns jsonb
language sql
stable
as $$
  select case coalesce(p_role, 'staff')
    when 'owner' then jsonb_build_object(
      'manage_users', true,
      'cloud_sync', true,
      'routines', true,
      'members_write', true,
      'matches_write', true,
      'messages_write', true,
      'data_export', true,
      'read_all', true
    )
    when 'admin' then jsonb_build_object(
      'manage_users', true,
      'cloud_sync', true,
      'routines', true,
      'members_write', true,
      'matches_write', true,
      'messages_write', true,
      'data_export', true,
      'read_all', true
    )
    when 'staff' then jsonb_build_object(
      'manage_users', false,
      'cloud_sync', false,
      'routines', false,
      'members_write', true,
      'matches_write', true,
      'messages_write', true,
      'data_export', false,
      'read_all', true
    )
    else jsonb_build_object(
      'manage_users', false,
      'cloud_sync', false,
      'routines', false,
      'members_write', false,
      'matches_write', false,
      'messages_write', false,
      'data_export', false,
      'read_all', true
    )
  end;
$$;

create or replace function public.pmo_audit_admin(
  p_actor_email text,
  p_actor_role text,
  p_action text,
  p_detail jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pmo_audit_log (actor_email, actor_role, action, detail)
  values (
    nullif(lower(trim(coalesce(p_actor_email, ''))), ''),
    nullif(trim(coalesce(p_actor_role, '')), ''),
    nullif(trim(coalesce(p_action, '')), ''),
    coalesce(p_detail, '{}'::jsonb)
  );
end;
$$;

create or replace function public.pmo_get_my_staff_profile()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  status text,
  permissions jsonb,
  last_seen_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(nullif(trim(coalesce(auth.jwt()->>'email', '')), ''));
  v_profile public.pmo_staff_profiles%rowtype;
begin
  if v_uid is null or v_email is null then
    return;
  end if;

  update public.pmo_staff_profiles p
  set auth_user_id = v_uid,
      status = case when p.status = 'invited' then 'active' else p.status end,
      activated_at = coalesce(p.activated_at, now()),
      last_seen_at = now()
  where p.auth_user_id is null
    and p.email = v_email
    and p.status in ('invited', 'active')
  returning * into v_profile;

  if not found then
    update public.pmo_staff_profiles p
    set last_seen_at = now()
    where p.auth_user_id = v_uid
      and p.email = v_email
      and p.status = 'active'
    returning * into v_profile;
  end if;

  if not found and v_profile.id is null then
    select * into v_profile
    from public.pmo_staff_profiles p
    where (p.auth_user_id = v_uid or p.email = v_email)
      and p.status = 'active'
    limit 1;
  end if;

  if v_profile.id is null or v_profile.status <> 'active' then
    return;
  end if;

  insert into public.pmo_audit_log (actor_user_id, actor_email, actor_role, action, detail)
  values (v_uid, v_profile.email, v_profile.role, 'staff_login', jsonb_build_object('source', 'supabase_auth'));

  return query
  select
    v_profile.id,
    v_profile.email,
    v_profile.full_name,
    v_profile.role,
    v_profile.status,
    v_profile.permissions,
    v_profile.last_seen_at,
    v_profile.updated_at;
end;
$$;

create or replace function public.pmo_upsert_staff_user_admin(
  p_admin_pin text,
  p_email text,
  p_full_name text default '',
  p_role text default 'staff',
  p_status text default 'invited',
  p_permissions jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_role text := case when p_role in ('owner', 'admin', 'staff', 'readonly') then p_role else 'staff' end;
  v_status text := case when p_status in ('invited', 'active', 'paused') then p_status else 'invited' end;
  v_permissions jsonb := coalesce(p_permissions, public.pmo_default_staff_permissions(v_role));
  v_id uuid;
begin
  if not public.pmo_admin_pin_ok(p_admin_pin) then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ADMIN_PIN');
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_EMAIL');
  end if;

  insert into public.pmo_staff_profiles (email, full_name, role, status, permissions)
  values (v_email, trim(coalesce(p_full_name, '')), v_role, v_status, v_permissions)
  on conflict (email) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      status = excluded.status,
      permissions = excluded.permissions
  returning id into v_id;

  perform public.pmo_audit_admin(
    'pin-admin',
    'admin',
    'staff_user_upsert',
    jsonb_build_object('email', v_email, 'role', v_role, 'status', v_status)
  );

  return jsonb_build_object('ok', true, 'id', v_id, 'email', v_email, 'role', v_role, 'status', v_status);
end;
$$;

create or replace function public.pmo_set_staff_user_status_admin(
  p_admin_pin text,
  p_email text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_status text := case when p_status in ('invited', 'active', 'paused') then p_status else null end;
begin
  if not public.pmo_admin_pin_ok(p_admin_pin) then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ADMIN_PIN');
  end if;

  if v_email = '' or v_status is null then
    return jsonb_build_object('ok', false, 'error', 'INVALID_REQUEST');
  end if;

  update public.pmo_staff_profiles
  set status = v_status
  where email = v_email;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'USER_NOT_FOUND');
  end if;

  perform public.pmo_audit_admin(
    'pin-admin',
    'admin',
    'staff_user_status',
    jsonb_build_object('email', v_email, 'status', v_status)
  );

  return jsonb_build_object('ok', true, 'email', v_email, 'status', v_status);
end;
$$;

create or replace function public.pmo_get_staff_users_admin(
  p_admin_pin text
)
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  status text,
  permissions jsonb,
  auth_user_id uuid,
  invited_at timestamptz,
  activated_at timestamptz,
  last_seen_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pmo_admin_pin_ok(p_admin_pin) then
    raise exception 'INVALID_ADMIN_PIN';
  end if;

  return query
  select
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.status,
    p.permissions,
    p.auth_user_id,
    p.invited_at,
    p.activated_at,
    p.last_seen_at,
    p.updated_at
  from public.pmo_staff_profiles p
  order by
    case p.role when 'owner' then 1 when 'admin' then 2 when 'staff' then 3 else 4 end,
    p.email;
end;
$$;

create or replace function public.pmo_get_audit_log_admin(
  p_admin_pin text,
  p_limit integer default 100
)
returns table (
  id uuid,
  actor_user_id uuid,
  actor_email text,
  actor_role text,
  action text,
  detail jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pmo_admin_pin_ok(p_admin_pin) then
    raise exception 'INVALID_ADMIN_PIN';
  end if;

  return query
  select
    l.id,
    l.actor_user_id,
    l.actor_email,
    l.actor_role,
    l.action,
    l.detail,
    l.created_at
  from public.pmo_audit_log l
  order by l.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 300));
end;
$$;

alter table public.pmo_staff_profiles enable row level security;
alter table public.pmo_audit_log enable row level security;

revoke all on public.pmo_staff_profiles from anon, authenticated;
revoke all on public.pmo_audit_log from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant execute on function public.pmo_get_my_staff_profile() to authenticated;
grant execute on function public.pmo_upsert_staff_user_admin(text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.pmo_set_staff_user_status_admin(text, text, text) to anon, authenticated;
grant execute on function public.pmo_get_staff_users_admin(text) to anon, authenticated;
grant execute on function public.pmo_get_audit_log_admin(text, integer) to anon, authenticated;
