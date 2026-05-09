-- Padel Match Organizer - Cloud data + routines foundation
-- Safe to run multiple times in Supabase SQL Editor.
-- Requires the existing staff PIN row in assessment_admin_config.

create extension if not exists pgcrypto with schema extensions;

create table if not exists assessment_admin_config (
  id text primary key default 'main',
  admin_pin_hash text not null,
  updated_at timestamptz not null default now()
);

create or replace function public.pmo_admin_pin_ok(p_admin_pin text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from assessment_admin_config cfg
    where cfg.id = 'main'
      and cfg.admin_pin_hash = extensions.crypt(coalesce(p_admin_pin, ''), cfg.admin_pin_hash)
  );
$$;

create or replace function public.pmo_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists pmo_cloud_records (
  id uuid primary key default gen_random_uuid(),
  record_type text not null,
  local_key text not null,
  payload jsonb not null default '{}'::jsonb,
  payload_hash text,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  constraint pmo_cloud_records_unique unique (record_type, local_key),
  constraint pmo_cloud_records_type_check check (
    record_type in (
      'member',
      'booking',
      'booking_occupancy',
      'booking_history',
      'player_group',
      'match_invitation',
      'fill_slot_created_match',
      'fill_slot_player_request',
      'guided_invite_session',
      'whatsapp_message_history',
      'whatsapp_message_template',
      'matchpoint_data',
      'app_setting'
    )
  )
);

alter table pmo_cloud_records add column if not exists payload_hash text;
alter table pmo_cloud_records add column if not exists deleted boolean not null default false;
alter table pmo_cloud_records add column if not exists synced_at timestamptz not null default now();

create index if not exists idx_pmo_cloud_records_type on pmo_cloud_records(record_type);
create index if not exists idx_pmo_cloud_records_updated_at on pmo_cloud_records(updated_at);
create index if not exists idx_pmo_cloud_records_payload_gin on pmo_cloud_records using gin(payload);
create index if not exists idx_pmo_cloud_records_group_date
  on pmo_cloud_records (
    record_type,
    ((payload->>'groupId')),
    ((payload->>'date')),
    ((payload->>'time')),
    ((payload->>'endTime'))
  )
  where record_type = 'match_invitation' and deleted = false;

-- Private Storage bucket for the single overwritten browser backup.
-- The app does not access this bucket directly: reads/writes go through the
-- pmo-cloud-backup Edge Function using service_role after staff auth checks.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pmo-app-backups',
  'pmo-app-backups',
  false,
  52428800,
  array['application/json']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop trigger if exists trg_pmo_cloud_records_updated_at on pmo_cloud_records;
create trigger trg_pmo_cloud_records_updated_at
before update on pmo_cloud_records
for each row execute function public.pmo_touch_updated_at();

create table if not exists pmo_routines (
  id uuid primary key default gen_random_uuid(),
  routine_type text not null,
  local_key text not null unique,
  name text not null,
  status text not null default 'paused',
  source_record_type text,
  source_local_key text,
  config jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  next_action_at timestamptz,
  last_status text,
  last_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pmo_routines_type_check check (routine_type in ('group_match_auto_create')),
  constraint pmo_routines_status_check check (status in ('active', 'paused', 'archived'))
);

create index if not exists idx_pmo_routines_type_status on pmo_routines(routine_type, status);
create index if not exists idx_pmo_routines_next_action on pmo_routines(next_action_at);

drop trigger if exists trg_pmo_routines_updated_at on pmo_routines;
create trigger trg_pmo_routines_updated_at
before update on pmo_routines
for each row execute function public.pmo_touch_updated_at();

create table if not exists pmo_routine_runs (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid references pmo_routines(id) on delete set null,
  routine_type text not null,
  run_status text not null default 'started',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  created_records jsonb not null default '[]'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  constraint pmo_routine_runs_status_check check (run_status in ('started', 'success', 'blocked', 'error', 'noop'))
);

create index if not exists idx_pmo_routine_runs_started on pmo_routine_runs(started_at desc);
create index if not exists idx_pmo_routine_runs_routine on pmo_routine_runs(routine_id, started_at desc);

create table if not exists pmo_routine_skips (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid references pmo_routines(id) on delete cascade,
  routine_type text not null,
  skip_key text not null,
  reason text,
  skipped_until timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  constraint pmo_routine_skips_unique unique (routine_id, skip_key)
);

create index if not exists idx_pmo_routine_skips_routine on pmo_routine_skips(routine_id);

create or replace function public.pmo_upsert_records_admin(
  p_records jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_count integer := 0;
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

  if p_records is null or jsonb_typeof(p_records) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_RECORDS_PAYLOAD');
  end if;

  with incoming as (
    select
      nullif(trim(item->>'record_type'), '') as record_type,
      nullif(trim(item->>'local_key'), '') as local_key,
      coalesce(item->'payload', '{}'::jsonb) as payload,
      coalesce((item->>'deleted')::boolean, false) as deleted
    from jsonb_array_elements(p_records) item
  ),
  valid as (
    select *
    from incoming
    where record_type is not null
      and local_key is not null
      and record_type in (
        'member',
        'booking',
        'booking_occupancy',
        'booking_history',
        'player_group',
        'match_invitation',
        'fill_slot_created_match',
        'fill_slot_player_request',
        'guided_invite_session',
        'whatsapp_message_history',
        'whatsapp_message_template',
        'matchpoint_data',
        'app_setting'
      )
  ),
  upserted as (
    insert into pmo_cloud_records (
      record_type,
      local_key,
      payload,
      payload_hash,
      deleted,
      synced_at
    )
    select
      record_type,
      local_key,
      payload,
      encode(extensions.digest(payload::text, 'sha256'), 'hex'),
      deleted,
      now()
    from valid
    on conflict (record_type, local_key) do update
    set payload = excluded.payload,
        payload_hash = excluded.payload_hash,
        deleted = excluded.deleted,
        synced_at = now()
    returning 1
  )
  select count(*) into v_count from upserted;

  insert into public.pmo_audit_log (actor_user_id, actor_email, actor_role, action, detail)
  values (
    v_actor.auth_user_id,
    v_actor.email,
    v_actor.role,
    'cloud_records_upsert',
    jsonb_build_object('count', v_count)
  );

  return jsonb_build_object('ok', true, 'count', v_count);
end;
$$;

create or replace function public.pmo_get_records_admin(
  p_record_types text[] default null,
  p_since timestamptz default null
)
returns table (
  record_type text,
  local_key text,
  payload jsonb,
  deleted boolean,
  updated_at timestamptz,
  synced_at timestamptz
)
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
    raise exception 'AUTH_REQUIRED';
  end if;
  if not public.pmo_staff_permission_ok(v_actor.role, v_actor.permissions, 'cloud_sync') then
    raise exception 'PERMISSION_DENIED';
  end if;

  return query
  select
    r.record_type,
    r.local_key,
    r.payload,
    r.deleted,
    r.updated_at,
    r.synced_at
  from pmo_cloud_records r
  where (p_record_types is null or r.record_type = any(p_record_types))
    and (p_since is null or r.updated_at >= p_since)
  order by r.record_type, r.updated_at, r.local_key;
end;
$$;

create or replace function public.pmo_set_group_match_routine_admin(
  p_group_id text,
  p_group_name text,
  p_enabled boolean default true,
  p_hours_before integer default 48,
  p_config jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_routine_id uuid;
  v_local_key text;
  v_status text;
  v_config jsonb;
begin
  select * into v_actor
  from public.pmo_current_staff_profile()
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;
  if not public.pmo_staff_permission_ok(v_actor.role, v_actor.permissions, 'routines') then
    return jsonb_build_object('ok', false, 'error', 'PERMISSION_DENIED');
  end if;

  if nullif(trim(p_group_id), '') is null then
    return jsonb_build_object('ok', false, 'error', 'GROUP_ID_REQUIRED');
  end if;

  v_local_key := 'group_match_auto_create:' || trim(p_group_id);
  v_status := case when coalesce(p_enabled, false) then 'active' else 'paused' end;
  v_config := jsonb_build_object(
    'hoursBefore', greatest(1, coalesce(p_hours_before, 48)),
    'createOnlyIfFieldFree', coalesce((p_config->>'createOnlyIfFieldFree')::boolean, true),
    'createWithEmptyFieldIfBlocked', coalesce((p_config->>'createWithEmptyFieldIfBlocked')::boolean, false),
    'maxOccurrencesAhead', greatest(1, coalesce((p_config->>'maxOccurrencesAhead')::integer, 1)),
    'timezone', coalesce(nullif(p_config->>'timezone', ''), 'Europe/Rome')
  ) || coalesce(p_config, '{}'::jsonb);

  insert into pmo_routines (
    routine_type,
    local_key,
    name,
    status,
    source_record_type,
    source_local_key,
    config
  )
  values (
    'group_match_auto_create',
    v_local_key,
    coalesce(nullif(trim(p_group_name), ''), 'Gruppo soci'),
    v_status,
    'player_group',
    trim(p_group_id),
    v_config
  )
  on conflict (local_key) do update
  set name = excluded.name,
      status = excluded.status,
      source_record_type = excluded.source_record_type,
      source_local_key = excluded.source_local_key,
      config = excluded.config
  returning id into v_routine_id;

  insert into public.pmo_audit_log (actor_user_id, actor_email, actor_role, action, detail)
  values (
    v_actor.auth_user_id,
    v_actor.email,
    v_actor.role,
    'routine_upsert',
    jsonb_build_object('group_id', trim(p_group_id), 'status', v_status)
  );

  return jsonb_build_object('ok', true, 'routine_id', v_routine_id, 'local_key', v_local_key, 'status', v_status);
end;
$$;

create or replace function public.pmo_get_routines_admin()
returns table (
  id uuid,
  routine_type text,
  local_key text,
  name text,
  status text,
  source_record_type text,
  source_local_key text,
  config jsonb,
  last_checked_at timestamptz,
  next_action_at timestamptz,
  last_status text,
  last_message text,
  updated_at timestamptz
)
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
    raise exception 'AUTH_REQUIRED';
  end if;
  if not public.pmo_staff_permission_ok(v_actor.role, v_actor.permissions, 'routines') then
    raise exception 'PERMISSION_DENIED';
  end if;

  return query
  select
    r.id,
    r.routine_type,
    r.local_key,
    r.name,
    r.status,
    r.source_record_type,
    r.source_local_key,
    r.config,
    r.last_checked_at,
    r.next_action_at,
    r.last_status,
    r.last_message,
    r.updated_at
  from pmo_routines r
  where r.status <> 'archived'
  order by r.routine_type, r.name;
end;
$$;

create or replace function public.pmo_log_routine_run_admin(
  p_routine_local_key text,
  p_status text,
  p_summary jsonb default '{}'::jsonb,
  p_created_records jsonb default '[]'::jsonb,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_routine pmo_routines%rowtype;
  v_run_id uuid;
begin
  select * into v_actor
  from public.pmo_current_staff_profile()
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;
  if not public.pmo_staff_permission_ok(v_actor.role, v_actor.permissions, 'routines') then
    return jsonb_build_object('ok', false, 'error', 'PERMISSION_DENIED');
  end if;

  select * into v_routine
  from pmo_routines
  where local_key = p_routine_local_key
  limit 1;

  insert into pmo_routine_runs (
    routine_id,
    routine_type,
    run_status,
    started_at,
    finished_at,
    summary,
    created_records,
    error_message
  )
  values (
    v_routine.id,
    coalesce(v_routine.routine_type, 'group_match_auto_create'),
    case when p_status in ('started', 'success', 'blocked', 'error', 'noop') then p_status else 'error' end,
    now(),
    now(),
    coalesce(p_summary, '{}'::jsonb),
    coalesce(p_created_records, '[]'::jsonb),
    p_error_message
  )
  returning id into v_run_id;

  if v_routine.id is not null then
    update pmo_routines
    set last_checked_at = now(),
        last_status = case when p_status in ('started', 'success', 'blocked', 'error', 'noop') then p_status else 'error' end,
        last_message = coalesce(p_error_message, p_summary->>'message', ''),
        next_action_at = null
    where id = v_routine.id;
  end if;

  return jsonb_build_object('ok', true, 'run_id', v_run_id);
end;
$$;

create or replace function public.pmo_upsert_records_admin(
  p_admin_pin text,
  p_records jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if not public.pmo_admin_pin_ok(p_admin_pin) then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ADMIN_PIN');
  end if;

  if p_records is null or jsonb_typeof(p_records) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_RECORDS_PAYLOAD');
  end if;

  with incoming as (
    select
      nullif(trim(item->>'record_type'), '') as record_type,
      nullif(trim(item->>'local_key'), '') as local_key,
      coalesce(item->'payload', '{}'::jsonb) as payload,
      coalesce((item->>'deleted')::boolean, false) as deleted
    from jsonb_array_elements(p_records) item
  ),
  valid as (
    select *
    from incoming
    where record_type is not null
      and local_key is not null
      and record_type in (
        'member',
        'booking',
        'booking_occupancy',
        'booking_history',
        'player_group',
        'match_invitation',
        'fill_slot_created_match',
        'fill_slot_player_request',
        'guided_invite_session',
        'whatsapp_message_history',
        'whatsapp_message_template',
        'matchpoint_data',
        'app_setting'
      )
  ),
  upserted as (
    insert into pmo_cloud_records (
      record_type,
      local_key,
      payload,
      payload_hash,
      deleted,
      synced_at
    )
    select
      record_type,
      local_key,
      payload,
      encode(extensions.digest(payload::text, 'sha256'), 'hex'),
      deleted,
      now()
    from valid
    on conflict (record_type, local_key) do update
    set payload = excluded.payload,
        payload_hash = excluded.payload_hash,
        deleted = excluded.deleted,
        synced_at = now()
    returning 1
  )
  select count(*) into v_count from upserted;

  return jsonb_build_object('ok', true, 'count', v_count);
end;
$$;

create or replace function public.pmo_get_records_admin(
  p_admin_pin text,
  p_record_types text[] default null,
  p_since timestamptz default null
)
returns table (
  record_type text,
  local_key text,
  payload jsonb,
  deleted boolean,
  updated_at timestamptz,
  synced_at timestamptz
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
    r.record_type,
    r.local_key,
    r.payload,
    r.deleted,
    r.updated_at,
    r.synced_at
  from pmo_cloud_records r
  where (p_record_types is null or r.record_type = any(p_record_types))
    and (p_since is null or r.updated_at >= p_since)
  order by r.record_type, r.updated_at, r.local_key;
end;
$$;

create or replace function public.pmo_set_group_match_routine_admin(
  p_admin_pin text,
  p_group_id text,
  p_group_name text,
  p_enabled boolean default true,
  p_hours_before integer default 48,
  p_config jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_routine_id uuid;
  v_local_key text;
  v_status text;
  v_config jsonb;
begin
  if not public.pmo_admin_pin_ok(p_admin_pin) then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ADMIN_PIN');
  end if;

  if nullif(trim(p_group_id), '') is null then
    return jsonb_build_object('ok', false, 'error', 'GROUP_ID_REQUIRED');
  end if;

  v_local_key := 'group_match_auto_create:' || trim(p_group_id);
  v_status := case when coalesce(p_enabled, false) then 'active' else 'paused' end;
  v_config := jsonb_build_object(
    'hoursBefore', greatest(1, coalesce(p_hours_before, 48)),
    'createOnlyIfFieldFree', coalesce((p_config->>'createOnlyIfFieldFree')::boolean, true),
    'createWithEmptyFieldIfBlocked', coalesce((p_config->>'createWithEmptyFieldIfBlocked')::boolean, false),
    'maxOccurrencesAhead', greatest(1, coalesce((p_config->>'maxOccurrencesAhead')::integer, 1)),
    'timezone', coalesce(nullif(p_config->>'timezone', ''), 'Europe/Rome')
  ) || coalesce(p_config, '{}'::jsonb);

  insert into pmo_routines (
    routine_type,
    local_key,
    name,
    status,
    source_record_type,
    source_local_key,
    config
  )
  values (
    'group_match_auto_create',
    v_local_key,
    coalesce(nullif(trim(p_group_name), ''), 'Gruppo soci'),
    v_status,
    'player_group',
    trim(p_group_id),
    v_config
  )
  on conflict (local_key) do update
  set name = excluded.name,
      status = excluded.status,
      source_record_type = excluded.source_record_type,
      source_local_key = excluded.source_local_key,
      config = excluded.config
  returning id into v_routine_id;

  return jsonb_build_object('ok', true, 'routine_id', v_routine_id, 'local_key', v_local_key, 'status', v_status);
end;
$$;

create or replace function public.pmo_get_routines_admin(
  p_admin_pin text
)
returns table (
  id uuid,
  routine_type text,
  local_key text,
  name text,
  status text,
  source_record_type text,
  source_local_key text,
  config jsonb,
  last_checked_at timestamptz,
  next_action_at timestamptz,
  last_status text,
  last_message text,
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
    r.id,
    r.routine_type,
    r.local_key,
    r.name,
    r.status,
    r.source_record_type,
    r.source_local_key,
    r.config,
    r.last_checked_at,
    r.next_action_at,
    r.last_status,
    r.last_message,
    r.updated_at
  from pmo_routines r
  where r.status <> 'archived'
  order by r.routine_type, r.name;
end;
$$;

create or replace function public.pmo_log_routine_run_admin(
  p_admin_pin text,
  p_routine_local_key text,
  p_status text,
  p_summary jsonb default '{}'::jsonb,
  p_created_records jsonb default '[]'::jsonb,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_routine pmo_routines%rowtype;
  v_run_id uuid;
begin
  if not public.pmo_admin_pin_ok(p_admin_pin) then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ADMIN_PIN');
  end if;

  select * into v_routine
  from pmo_routines
  where local_key = p_routine_local_key
  limit 1;

  insert into pmo_routine_runs (
    routine_id,
    routine_type,
    run_status,
    started_at,
    finished_at,
    summary,
    created_records,
    error_message
  )
  values (
    v_routine.id,
    coalesce(v_routine.routine_type, 'group_match_auto_create'),
    case when p_status in ('started', 'success', 'blocked', 'error', 'noop') then p_status else 'error' end,
    now(),
    now(),
    coalesce(p_summary, '{}'::jsonb),
    coalesce(p_created_records, '[]'::jsonb),
    p_error_message
  )
  returning id into v_run_id;

  if v_routine.id is not null then
    update pmo_routines
    set last_checked_at = now(),
        last_status = case when p_status in ('started', 'success', 'blocked', 'error', 'noop') then p_status else 'error' end,
        last_message = coalesce(p_error_message, p_summary->>'message', ''),
        next_action_at = null
    where id = v_routine.id;
  end if;

  return jsonb_build_object('ok', true, 'run_id', v_run_id);
end;
$$;

alter table pmo_cloud_records enable row level security;
alter table pmo_routines enable row level security;
alter table pmo_routine_runs enable row level security;
alter table pmo_routine_skips enable row level security;

revoke all on pmo_cloud_records from anon, authenticated;
revoke all on pmo_routines from anon, authenticated;
revoke all on pmo_routine_runs from anon, authenticated;
revoke all on pmo_routine_skips from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on pmo_cloud_records to service_role;
grant select, insert, update, delete on pmo_audit_log to service_role;
grant execute on function public.pmo_admin_pin_ok(text) to anon, authenticated;
grant execute on function public.pmo_upsert_records_admin(jsonb) to authenticated;
grant execute on function public.pmo_get_records_admin(text[], timestamptz) to authenticated;
grant execute on function public.pmo_set_group_match_routine_admin(text, text, boolean, integer, jsonb) to authenticated;
grant execute on function public.pmo_get_routines_admin() to authenticated;
grant execute on function public.pmo_log_routine_run_admin(text, text, jsonb, jsonb, text) to authenticated;
grant execute on function public.pmo_upsert_records_admin(text, jsonb) to anon, authenticated;
grant execute on function public.pmo_get_records_admin(text, text[], timestamptz) to anon, authenticated;
grant execute on function public.pmo_set_group_match_routine_admin(text, text, text, boolean, integer, jsonb) to anon, authenticated;
grant execute on function public.pmo_get_routines_admin(text) to anon, authenticated;
grant execute on function public.pmo_log_routine_run_admin(text, text, text, jsonb, jsonb, text) to anon, authenticated;
