-- PMO Autovalutazione - richieste pubbliche da Link esterno
-- La tabella raccoglie pratiche ricevute da link esterno senza creare automaticamente soci.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.assessment_external_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique default ('EXT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  status text not null default 'received',
  origin text not null default 'link-esterno',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz,
  first_name text,
  last_name text,
  phone text,
  email text,
  gender text not null default '',
  privacy_accepted boolean not null default false,
  privacy_accepted_at timestamptz,
  declared_level numeric,
  calculated_level numeric,
  consistency_status text,
  staff_status text not null default 'da_validare',
  raw_response jsonb not null default '{}'::jsonb,
  matched_member_local_id text,
  created_member_local_id text,
  created_member_pmo_id text,
  staff_notes text,
  constraint assessment_external_requests_status_check check (status in ('received','member_created','linked','validated','rejected')),
  constraint assessment_external_requests_origin_check check (origin = 'link-esterno'),
  constraint assessment_external_requests_gender_check check (gender in ('M','F','NA',''))
);

alter table public.assessment_external_requests add column if not exists request_code text;
alter table public.assessment_external_requests add column if not exists status text not null default 'received';
alter table public.assessment_external_requests add column if not exists origin text not null default 'link-esterno';
alter table public.assessment_external_requests add column if not exists submitted_at timestamptz not null default now();
alter table public.assessment_external_requests add column if not exists updated_at timestamptz not null default now();
alter table public.assessment_external_requests add column if not exists processed_at timestamptz;
alter table public.assessment_external_requests add column if not exists first_name text;
alter table public.assessment_external_requests add column if not exists last_name text;
alter table public.assessment_external_requests add column if not exists phone text;
alter table public.assessment_external_requests add column if not exists email text;
alter table public.assessment_external_requests add column if not exists gender text not null default '';
alter table public.assessment_external_requests add column if not exists privacy_accepted boolean not null default false;
alter table public.assessment_external_requests add column if not exists privacy_accepted_at timestamptz;
alter table public.assessment_external_requests add column if not exists declared_level numeric;
alter table public.assessment_external_requests add column if not exists calculated_level numeric;
alter table public.assessment_external_requests add column if not exists consistency_status text;
alter table public.assessment_external_requests add column if not exists staff_status text not null default 'da_validare';
alter table public.assessment_external_requests add column if not exists raw_response jsonb not null default '{}'::jsonb;
alter table public.assessment_external_requests add column if not exists matched_member_local_id text;
alter table public.assessment_external_requests add column if not exists created_member_local_id text;
alter table public.assessment_external_requests add column if not exists created_member_pmo_id text;
alter table public.assessment_external_requests add column if not exists staff_notes text;
alter table public.assessment_external_requests alter column request_code set default ('EXT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)));

update public.assessment_external_requests
set request_code = 'EXT-' || upper(substr(replace(id::text, '-', ''), 1, 10))
where nullif(trim(coalesce(request_code, '')), '') is null;

alter table public.assessment_external_requests alter column request_code set not null;

create unique index if not exists idx_assessment_external_requests_code on public.assessment_external_requests(request_code);
create index if not exists idx_assessment_external_requests_status on public.assessment_external_requests(status);
create index if not exists idx_assessment_external_requests_submitted_at on public.assessment_external_requests(submitted_at desc);
create index if not exists idx_assessment_external_requests_email on public.assessment_external_requests(lower(email));
create index if not exists idx_assessment_external_requests_phone on public.assessment_external_requests(phone);

create or replace function public.assessment_external_requests_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_assessment_external_requests_updated_at on public.assessment_external_requests;
create trigger trg_assessment_external_requests_updated_at
before update on public.assessment_external_requests
for each row execute function public.assessment_external_requests_set_updated_at();

create or replace function public.submit_assessment_external_request_public(
  p_request jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
  v_first_name text := left(nullif(trim(coalesce(p_request->>'first_name', '')), ''), 120);
  v_last_name text := left(nullif(trim(coalesce(p_request->>'last_name', '')), ''), 120);
  v_phone text := left(nullif(trim(coalesce(p_request->>'phone', '')), ''), 60);
  v_email text := lower(left(nullif(trim(coalesce(p_request->>'email', '')), ''), 180));
  v_gender text := upper(left(nullif(trim(coalesce(p_request->>'gender', '')), ''), 2));
  v_raw jsonb := coalesce(p_request->'raw_response', '{}'::jsonb);
  v_staff_status text := coalesce(nullif(trim(p_request->>'staff_status'), ''), 'da_validare');
  v_consistency text := nullif(trim(coalesce(p_request->>'consistency_status', '')), '');
begin
  if p_request is null or jsonb_typeof(p_request) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_REQUEST_PAYLOAD');
  end if;

  if coalesce(p_request->>'source', p_request->>'origin', v_raw->>'source', '') not in ('link-esterno', 'Da link esterno') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ORIGIN');
  end if;

  if coalesce((p_request->>'privacy_accepted')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'PRIVACY_REQUIRED');
  end if;

  if v_first_name is null or v_last_name is null or v_phone is null or v_email is null then
    return jsonb_build_object('ok', false, 'error', 'REQUIRED_FIELDS_MISSING');
  end if;

  if v_gender not in ('M','F','NA') then
    return jsonb_build_object('ok', false, 'error', 'GENDER_REQUIRED');
  end if;

  if nullif(trim(coalesce(p_request->>'declared_level', '')), '') is null
     or nullif(trim(coalesce(p_request->>'calculated_level', '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'ASSESSMENT_LEVEL_MISSING');
  end if;

  insert into public.assessment_external_requests (
    status,
    origin,
    submitted_at,
    first_name,
    last_name,
    phone,
    email,
    gender,
    privacy_accepted,
    privacy_accepted_at,
    declared_level,
    calculated_level,
    consistency_status,
    staff_status,
    raw_response
  )
  values (
    'received',
    'link-esterno',
    coalesce(nullif(trim(p_request->>'submitted_at'), '')::timestamptz, now()),
    v_first_name,
    v_last_name,
    v_phone,
    v_email,
    v_gender,
    true,
    coalesce(nullif(trim(p_request->>'privacy_accepted_at'), '')::timestamptz, now()),
    public.assessment_text_to_numeric(p_request->>'declared_level'),
    public.assessment_text_to_numeric(p_request->>'calculated_level'),
    v_consistency,
    case
      when v_gender = 'NA' then 'da_completare'
      when v_staff_status in ('da_controllare','review','attention') then 'da_controllare'
      else 'da_validare'
    end,
    jsonb_set(
      jsonb_set(v_raw, '{source}', '"link-esterno"'::jsonb, true),
      '{origin_label}', '"Origine: Da link esterno"'::jsonb,
      true
    )
  )
  returning id, request_code into v_id, v_code;

  return jsonb_build_object('ok', true, 'request_id', v_id, 'request_code', v_code, 'status', 'received');
exception
  when invalid_text_representation then
    return jsonb_build_object('ok', false, 'error', 'INVALID_REQUEST_VALUE');
  when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

create or replace function public.get_assessment_external_requests_admin(
  p_status text default '',
  p_limit integer default 100
)
returns table (
  id uuid,
  request_code text,
  status text,
  origin text,
  submitted_at timestamptz,
  updated_at timestamptz,
  processed_at timestamptz,
  first_name text,
  last_name text,
  phone text,
  email text,
  gender text,
  privacy_accepted boolean,
  privacy_accepted_at timestamptz,
  declared_level numeric,
  calculated_level numeric,
  consistency_status text,
  staff_status text,
  raw_response jsonb,
  matched_member_local_id text,
  created_member_local_id text,
  created_member_pmo_id text,
  staff_notes text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
  v_status text := nullif(trim(coalesce(p_status, '')), '');
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
    r.id,
    r.request_code,
    r.status,
    r.origin,
    r.submitted_at,
    r.updated_at,
    r.processed_at,
    r.first_name,
    r.last_name,
    r.phone,
    r.email,
    r.gender,
    r.privacy_accepted,
    r.privacy_accepted_at,
    r.declared_level,
    r.calculated_level,
    r.consistency_status,
    r.staff_status,
    r.raw_response,
    r.matched_member_local_id,
    r.created_member_local_id,
    r.created_member_pmo_id,
    r.staff_notes
  from public.assessment_external_requests r
  where v_status is null or r.status = v_status
  order by r.submitted_at desc
  limit v_limit;
end;
$$;

create or replace function public.update_assessment_external_request_admin(
  p_request_id uuid,
  p_status text,
  p_member_local_id text default null,
  p_member_pmo_id text default null,
  p_staff_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_status text := nullif(trim(coalesce(p_status, '')), '');
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

  if p_request_id is null or v_status not in ('received','member_created','linked','validated','rejected') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_UPDATE_REQUEST');
  end if;

  update public.assessment_external_requests
  set status = v_status,
      processed_at = case when v_status in ('member_created','linked','validated','rejected') then now() else processed_at end,
      matched_member_local_id = case when v_status = 'linked' then nullif(trim(coalesce(p_member_local_id, '')), '') else matched_member_local_id end,
      created_member_local_id = case when v_status in ('member_created','validated') then nullif(trim(coalesce(p_member_local_id, '')), '') else created_member_local_id end,
      created_member_pmo_id = case when v_status in ('member_created','validated') then nullif(trim(coalesce(p_member_pmo_id, '')), '') else created_member_pmo_id end,
      staff_notes = coalesce(nullif(trim(coalesce(p_staff_notes, '')), ''), staff_notes)
  where id = p_request_id;

  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', v_count = 1, 'updated', v_count);
end;
$$;

alter table public.assessment_external_requests enable row level security;

drop policy if exists "assessment_external_requests_no_direct_anon_read" on public.assessment_external_requests;

revoke all on table public.assessment_external_requests from anon, authenticated;
grant select, insert, update, delete on table public.assessment_external_requests to service_role;

revoke all on function public.submit_assessment_external_request_public(jsonb) from public;
revoke all on function public.get_assessment_external_requests_admin(text, integer) from public;
revoke all on function public.update_assessment_external_request_admin(uuid, text, text, text, text) from public;

grant execute on function public.submit_assessment_external_request_public(jsonb) to anon, authenticated;
grant execute on function public.get_assessment_external_requests_admin(text, integer) to authenticated;
grant execute on function public.update_assessment_external_request_admin(uuid, text, text, text, text) to authenticated;
