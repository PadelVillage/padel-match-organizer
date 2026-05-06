-- Supabase schema per Autovalutazione Livelli
-- Versione: v5.332
-- Eseguire in Supabase SQL Editor.

create extension if not exists pgcrypto with schema extensions;

create table if not exists assessment_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  member_local_id text,
  member_name text,
  phone_last4 text,
  status text not null default 'created',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz
);

alter table assessment_tokens add column if not exists registered_at timestamptz;
alter table assessment_tokens add column if not exists updated_at timestamptz not null default now();

create table if not exists self_assessments (
  id uuid primary key default gen_random_uuid(),
  token text not null references assessment_tokens(token),
  submitted_at timestamptz not null default now(),
  first_name text,
  last_name text,
  phone text,
  experience text,
  monthly_frequency text,
  basic_strokes text,
  glass_usage text,
  net_play text,
  positioning text,
  rally_patience text,
  competitions text,
  declared_level numeric,
  wants_matches text,
  preferred_days text,
  preferred_hours text,
  notes text,
  calculated_level numeric,
  staff_status text not null default ''
);

alter table self_assessments alter column staff_status set default '';
alter table self_assessments add column if not exists consistency_status text;
alter table self_assessments add column if not exists raw_response jsonb not null default '{}'::jsonb;
alter table self_assessments add column if not exists balanced_level numeric;
alter table self_assessments add column if not exists technical_average numeric;
alter table self_assessments add column if not exists raw_score numeric;
alter table self_assessments add column if not exists availability_time text;
alter table self_assessments add column if not exists desired_frequency text;
alter table self_assessments add column if not exists notice text;
alter table self_assessments add column if not exists preferred_match_type text;
alter table self_assessments add column if not exists staff_notes text;
alter table self_assessments add column if not exists applied_level numeric;
alter table self_assessments add column if not exists applied_at timestamptz;
alter table self_assessments add column if not exists applied_member_id text;
alter table self_assessments add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_self_assessments_token_unique on self_assessments(token);
create index if not exists idx_self_assessments_token on self_assessments(token);
create index if not exists idx_assessment_tokens_token on assessment_tokens(token);
create index if not exists idx_assessment_tokens_status on assessment_tokens(status);

create table if not exists assessment_admin_config (
  id text primary key default 'main',
  admin_pin_hash text not null,
  updated_at timestamptz not null default now()
);

-- Compatibilita' legacy: assessment_admin_config resta per vecchie RPC con PIN.
-- L'app corrente usa Supabase Auth + profili staff, senza PIN operativo.

create or replace function public.assessment_text_to_numeric(value text)
returns numeric
language sql
immutable
as $$
  select case
    when nullif(trim(value), '') is null then null
    when trim(value) ~ '^[0-9]+([.,][0-9]+)?$' then replace(trim(value), ',', '.')::numeric
    else null
  end
$$;

create or replace function public.assessment_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_assessment_tokens_updated_at on assessment_tokens;
create trigger trg_assessment_tokens_updated_at
before update on assessment_tokens
for each row execute function public.assessment_touch_updated_at();

drop trigger if exists trg_self_assessments_updated_at on self_assessments;
create trigger trg_self_assessments_updated_at
before update on self_assessments
for each row execute function public.assessment_touch_updated_at();

create or replace function public.assessment_mark_token_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update assessment_tokens
  set status = 'completed',
      completed_at = coalesce(new.submitted_at, now())
  where token = new.token;
  return new;
end;
$$;

drop trigger if exists trg_self_assessments_mark_token_completed on self_assessments;
create trigger trg_self_assessments_mark_token_completed
after insert or update on self_assessments
for each row execute function public.assessment_mark_token_completed();

create or replace function public.upsert_assessment_tokens_admin(
  p_tokens jsonb
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

  if p_tokens is null or jsonb_typeof(p_tokens) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_TOKENS_PAYLOAD');
  end if;

  with incoming as (
    select
      nullif(trim(item->>'token'), '') as token,
      nullif(trim(item->>'member_local_id'), '') as member_local_id,
      coalesce(nullif(trim(item->>'member_name'), ''), 'Socio') as member_name,
      nullif(trim(item->>'phone_last4'), '') as phone_last4
    from jsonb_array_elements(p_tokens) item
  ),
  valid as (
    select *
    from incoming
    where token is not null and member_local_id is not null
  ),
  upserted as (
    insert into assessment_tokens (
      token,
      member_local_id,
      member_name,
      phone_last4,
      status,
      registered_at
    )
    select
      token,
      member_local_id,
      member_name,
      phone_last4,
      'created',
      now()
    from valid
    on conflict (token) do update
    set member_local_id = excluded.member_local_id,
        member_name = excluded.member_name,
        phone_last4 = excluded.phone_last4,
        registered_at = now()
    returning 1
  )
  select count(*) into v_count from upserted;

  return jsonb_build_object('ok', true, 'count', v_count);
end;
$$;

create or replace function public.upsert_assessment_tokens_admin(
  p_admin_pin text,
  p_tokens jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if not exists (
    select 1
    from assessment_admin_config cfg
    where cfg.id = 'main'
      and cfg.admin_pin_hash = extensions.crypt(coalesce(p_admin_pin, ''), cfg.admin_pin_hash)
  ) then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ADMIN_PIN');
  end if;

  if p_tokens is null or jsonb_typeof(p_tokens) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_TOKENS_PAYLOAD');
  end if;

  with incoming as (
    select
      nullif(trim(item->>'token'), '') as token,
      nullif(trim(item->>'member_local_id'), '') as member_local_id,
      coalesce(nullif(trim(item->>'member_name'), ''), 'Socio') as member_name,
      nullif(trim(item->>'phone_last4'), '') as phone_last4
    from jsonb_array_elements(p_tokens) item
  ),
  valid as (
    select *
    from incoming
    where token is not null and member_local_id is not null
  ),
  upserted as (
    insert into assessment_tokens (
      token,
      member_local_id,
      member_name,
      phone_last4,
      status,
      registered_at
    )
    select
      token,
      member_local_id,
      member_name,
      phone_last4,
      'created',
      now()
    from valid
    on conflict (token) do update
    set member_local_id = excluded.member_local_id,
        member_name = excluded.member_name,
        phone_last4 = excluded.phone_last4,
        registered_at = now()
    returning 1
  )
  select count(*) into v_count from upserted;

  return jsonb_build_object('ok', true, 'count', v_count);
end;
$$;

create or replace function public.submit_self_assessment_public(
  p_response jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := nullif(trim(p_response->>'token'), '');
  v_raw jsonb := coalesce(p_response->'raw_response', '{}'::jsonb);
  v_availability jsonb := coalesce(p_response #> '{raw_response,availability_profile}', '{}'::jsonb);
begin
  if v_token is null then
    raise exception 'TOKEN_MISSING';
  end if;

  if not exists (
    select 1
    from assessment_tokens t
    where t.token = v_token
      and t.status in ('created', 'sent')
      and (t.expires_at is null or t.expires_at > now())
  ) then
    raise exception 'TOKEN_NOT_VALID';
  end if;

  insert into self_assessments (
    token,
    submitted_at,
    first_name,
    last_name,
    phone,
    declared_level,
    calculated_level,
    consistency_status,
    staff_status,
    raw_response,
    balanced_level,
    technical_average,
    raw_score,
    availability_time,
    preferred_days,
    desired_frequency,
    notice,
    preferred_match_type
  )
  values (
    v_token,
    coalesce(nullif(trim(p_response->>'submitted_at'), '')::timestamptz, now()),
    nullif(trim(p_response->>'first_name'), ''),
    nullif(trim(p_response->>'last_name'), ''),
    nullif(trim(p_response->>'phone'), ''),
    public.assessment_text_to_numeric(p_response->>'declared_level'),
    public.assessment_text_to_numeric(p_response->>'calculated_level'),
    nullif(trim(p_response->>'consistency_status'), ''),
    coalesce(nullif(trim(p_response->>'staff_status'), ''), ''),
    v_raw,
    public.assessment_text_to_numeric(p_response #>> '{raw_response,balanced_level}'),
    public.assessment_text_to_numeric(p_response #>> '{raw_response,technical_average}'),
    public.assessment_text_to_numeric(p_response #>> '{raw_response,raw_score}'),
    coalesce(nullif(trim(p_response->>'availability_time'), ''), nullif(trim(v_availability->>'time'), '')),
    coalesce(nullif(trim(p_response->>'preferred_days'), ''), nullif(trim(v_availability->>'days'), '')),
    coalesce(nullif(trim(p_response->>'desired_frequency'), ''), nullif(trim(v_availability->>'frequency'), '')),
    coalesce(nullif(trim(p_response->>'notice'), ''), nullif(trim(v_availability->>'notice'), '')),
    coalesce(nullif(trim(p_response->>'preferred_match_type'), ''), nullif(trim(v_availability->>'matchType'), ''))
  )
  on conflict (token) do update
  set submitted_at = excluded.submitted_at,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      phone = excluded.phone,
      declared_level = excluded.declared_level,
      calculated_level = excluded.calculated_level,
      consistency_status = excluded.consistency_status,
      staff_status = excluded.staff_status,
      raw_response = excluded.raw_response,
      balanced_level = excluded.balanced_level,
      technical_average = excluded.technical_average,
      raw_score = excluded.raw_score,
      availability_time = excluded.availability_time,
      preferred_days = excluded.preferred_days,
      desired_frequency = excluded.desired_frequency,
      notice = excluded.notice,
      preferred_match_type = excluded.preferred_match_type;

  return jsonb_build_object('ok', true, 'token', v_token);
end;
$$;

create or replace function public.get_self_assessments_by_tokens(
  p_tokens text[]
)
returns table (
  token text,
  submitted_at timestamptz,
  first_name text,
  last_name text,
  phone text,
  declared_level numeric,
  calculated_level numeric,
  consistency_status text,
  staff_status text,
  raw_response jsonb,
  availability_time text,
  preferred_days text,
  desired_frequency text,
  notice text,
  preferred_match_type text
)
language sql
security definer
set search_path = public
as $$
  select
    s.token,
    s.submitted_at,
    s.first_name,
    s.last_name,
    s.phone,
    s.declared_level,
    s.calculated_level,
    coalesce(s.consistency_status, '') as consistency_status,
    coalesce(s.staff_status, '') as staff_status,
    coalesce(s.raw_response, '{}'::jsonb) as raw_response,
    s.availability_time,
    s.preferred_days,
    s.desired_frequency,
    s.notice,
    s.preferred_match_type
  from self_assessments s
  where s.token = any(p_tokens)
  order by s.submitted_at desc;
$$;

alter table assessment_tokens enable row level security;
alter table self_assessments enable row level security;
alter table assessment_admin_config enable row level security;

drop policy if exists "public_read_active_tokens" on assessment_tokens;
create policy "public_read_active_tokens"
on assessment_tokens
for select
to anon, authenticated
using (
  status in ('created', 'sent')
  and (expires_at is null or expires_at > now())
);

drop policy if exists "public_insert_self_assessments" on self_assessments;
create policy "public_insert_self_assessments"
on self_assessments
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from assessment_tokens t
    where t.token = self_assessments.token
      and t.status in ('created', 'sent')
      and (t.expires_at is null or t.expires_at > now())
  )
);

drop policy if exists "public_update_self_assessments" on self_assessments;
create policy "public_update_self_assessments"
on self_assessments
for update
to anon, authenticated
using (
  exists (
    select 1
    from assessment_tokens t
    where t.token = self_assessments.token
      and t.status in ('created', 'sent', 'completed')
      and (t.expires_at is null or t.expires_at > now())
  )
)
with check (
  exists (
    select 1
    from assessment_tokens t
    where t.token = self_assessments.token
      and t.status in ('created', 'sent', 'completed')
      and (t.expires_at is null or t.expires_at > now())
  )
);

grant usage on schema public to anon, authenticated;
grant select on assessment_tokens to anon, authenticated;
grant insert, update on self_assessments to anon, authenticated;
grant execute on function public.upsert_assessment_tokens_admin(jsonb) to authenticated;
grant execute on function public.upsert_assessment_tokens_admin(text, jsonb) to anon, authenticated;
grant execute on function public.submit_self_assessment_public(jsonb) to anon, authenticated;
grant execute on function public.get_self_assessments_by_tokens(text[]) to anon, authenticated;


-- v5.329 - Feedback post-partita WhatsApp

create table if not exists post_match_feedback_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  member_local_id text not null,
  member_name text,
  phone_last4 text,
  match_key text not null,
  match_label text,
  status text not null default 'created',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  registered_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists post_match_feedback_responses (
  id uuid primary key default gen_random_uuid(),
  token text not null references post_match_feedback_tokens(token),
  submitted_at timestamptz not null default now(),
  match_key text,
  member_local_id text,
  level_experience text,
  composition_preference text,
  future_interest text,
  note text,
  raw_response jsonb not null default '{}'::jsonb,
  staff_status text not null default '',
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_post_match_feedback_responses_token_unique on post_match_feedback_responses(token);
create index if not exists idx_post_match_feedback_tokens_token on post_match_feedback_tokens(token);
create index if not exists idx_post_match_feedback_tokens_match_key on post_match_feedback_tokens(match_key);
create index if not exists idx_post_match_feedback_responses_match_key on post_match_feedback_responses(match_key);

drop trigger if exists trg_post_match_feedback_tokens_updated_at on post_match_feedback_tokens;
create trigger trg_post_match_feedback_tokens_updated_at
before update on post_match_feedback_tokens
for each row execute function public.assessment_touch_updated_at();

drop trigger if exists trg_post_match_feedback_responses_updated_at on post_match_feedback_responses;
create trigger trg_post_match_feedback_responses_updated_at
before update on post_match_feedback_responses
for each row execute function public.assessment_touch_updated_at();

create or replace function public.post_match_feedback_mark_token_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update post_match_feedback_tokens
  set status = 'completed',
      completed_at = coalesce(new.submitted_at, now())
  where token = new.token;
  return new;
end;
$$;

drop trigger if exists trg_post_match_feedback_mark_token_completed on post_match_feedback_responses;
create trigger trg_post_match_feedback_mark_token_completed
after insert or update on post_match_feedback_responses
for each row execute function public.post_match_feedback_mark_token_completed();

create or replace function public.upsert_post_match_feedback_tokens_admin(
  p_tokens jsonb
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

  if p_tokens is null or jsonb_typeof(p_tokens) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_TOKENS_PAYLOAD');
  end if;

  with incoming as (
    select
      nullif(trim(item->>'token'), '') as token,
      nullif(trim(item->>'member_local_id'), '') as member_local_id,
      coalesce(nullif(trim(item->>'member_name'), ''), 'Socio') as member_name,
      nullif(trim(item->>'phone_last4'), '') as phone_last4,
      nullif(trim(item->>'match_key'), '') as match_key,
      nullif(trim(item->>'match_label'), '') as match_label
    from jsonb_array_elements(p_tokens) item
  ),
  valid as (
    select * from incoming where token is not null and member_local_id is not null and match_key is not null
  ),
  upserted as (
    insert into post_match_feedback_tokens (
      token, member_local_id, member_name, phone_last4, match_key, match_label, status, registered_at
    )
    select token, member_local_id, member_name, phone_last4, match_key, match_label, 'created', now()
    from valid
    on conflict (token) do update
    set member_local_id = excluded.member_local_id,
        member_name = excluded.member_name,
        phone_last4 = excluded.phone_last4,
        match_key = excluded.match_key,
        match_label = excluded.match_label,
        registered_at = now()
    returning 1
  )
  select count(*) into v_count from upserted;

  return jsonb_build_object('ok', true, 'count', v_count);
end;
$$;

create or replace function public.upsert_post_match_feedback_tokens_admin(
  p_admin_pin text,
  p_tokens jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if not exists (
    select 1
    from assessment_admin_config cfg
    where cfg.id = 'main'
      and cfg.admin_pin_hash = extensions.crypt(coalesce(p_admin_pin, ''), cfg.admin_pin_hash)
  ) then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ADMIN_PIN');
  end if;

  if p_tokens is null or jsonb_typeof(p_tokens) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_TOKENS_PAYLOAD');
  end if;

  with incoming as (
    select
      nullif(trim(item->>'token'), '') as token,
      nullif(trim(item->>'member_local_id'), '') as member_local_id,
      coalesce(nullif(trim(item->>'member_name'), ''), 'Socio') as member_name,
      nullif(trim(item->>'phone_last4'), '') as phone_last4,
      nullif(trim(item->>'match_key'), '') as match_key,
      nullif(trim(item->>'match_label'), '') as match_label
    from jsonb_array_elements(p_tokens) item
  ),
  valid as (
    select * from incoming where token is not null and member_local_id is not null and match_key is not null
  ),
  upserted as (
    insert into post_match_feedback_tokens (
      token, member_local_id, member_name, phone_last4, match_key, match_label, status, registered_at
    )
    select token, member_local_id, member_name, phone_last4, match_key, match_label, 'created', now()
    from valid
    on conflict (token) do update
    set member_local_id = excluded.member_local_id,
        member_name = excluded.member_name,
        phone_last4 = excluded.phone_last4,
        match_key = excluded.match_key,
        match_label = excluded.match_label,
        registered_at = now()
    returning 1
  )
  select count(*) into v_count from upserted;

  return jsonb_build_object('ok', true, 'count', v_count);
end;
$$;

create or replace function public.submit_post_match_feedback_public(
  p_response jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := nullif(trim(p_response->>'token'), '');
  v_token_row post_match_feedback_tokens%rowtype;
begin
  if v_token is null then
    raise exception 'TOKEN_MISSING';
  end if;

  select * into v_token_row
  from post_match_feedback_tokens t
  where t.token = v_token
    and t.status in ('created', 'sent')
    and (t.expires_at is null or t.expires_at > now())
  limit 1;

  if v_token_row.token is null then
    raise exception 'TOKEN_NOT_VALID';
  end if;

  insert into post_match_feedback_responses (
    token,
    submitted_at,
    match_key,
    member_local_id,
    level_experience,
    composition_preference,
    future_interest,
    note,
    raw_response
  )
  values (
    v_token,
    coalesce(nullif(trim(p_response->>'submitted_at'), '')::timestamptz, now()),
    coalesce(nullif(trim(p_response->>'match_key'), ''), v_token_row.match_key),
    coalesce(nullif(trim(p_response->>'member_local_id'), ''), v_token_row.member_local_id),
    nullif(trim(p_response->>'level_experience'), ''),
    nullif(trim(p_response->>'composition_preference'), ''),
    nullif(trim(p_response->>'future_interest'), ''),
    nullif(trim(p_response->>'note'), ''),
    coalesce(p_response->'raw_response', '{}'::jsonb)
  )
  on conflict (token) do update
  set submitted_at = excluded.submitted_at,
      match_key = excluded.match_key,
      member_local_id = excluded.member_local_id,
      level_experience = excluded.level_experience,
      composition_preference = excluded.composition_preference,
      future_interest = excluded.future_interest,
      note = excluded.note,
      raw_response = excluded.raw_response;

  return jsonb_build_object('ok', true, 'token', v_token);
end;
$$;

create or replace function public.get_post_match_feedback_by_tokens(
  p_tokens text[]
)
returns table (
  token text,
  submitted_at timestamptz,
  match_key text,
  member_local_id text,
  level_experience text,
  composition_preference text,
  future_interest text,
  note text,
  raw_response jsonb,
  staff_status text
)
language sql
security definer
set search_path = public
as $$
  select
    r.token,
    r.submitted_at,
    r.match_key,
    r.member_local_id,
    r.level_experience,
    r.composition_preference,
    r.future_interest,
    r.note,
    coalesce(r.raw_response, '{}'::jsonb) as raw_response,
    coalesce(r.staff_status, '') as staff_status
  from post_match_feedback_responses r
  where r.token = any(p_tokens)
  order by r.submitted_at desc;
$$;

alter table post_match_feedback_tokens enable row level security;
alter table post_match_feedback_responses enable row level security;

drop policy if exists "public_read_active_post_match_feedback_tokens" on post_match_feedback_tokens;
create policy "public_read_active_post_match_feedback_tokens"
on post_match_feedback_tokens
for select
to anon, authenticated
using (
  status in ('created', 'sent')
  and (expires_at is null or expires_at > now())
);

drop policy if exists "public_insert_post_match_feedback" on post_match_feedback_responses;
create policy "public_insert_post_match_feedback"
on post_match_feedback_responses
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from post_match_feedback_tokens t
    where t.token = post_match_feedback_responses.token
      and t.status in ('created', 'sent')
      and (t.expires_at is null or t.expires_at > now())
  )
);

drop policy if exists "public_update_post_match_feedback" on post_match_feedback_responses;
create policy "public_update_post_match_feedback"
on post_match_feedback_responses
for update
to anon, authenticated
using (
  exists (
    select 1
    from post_match_feedback_tokens t
    where t.token = post_match_feedback_responses.token
      and t.status in ('created', 'sent', 'completed')
      and (t.expires_at is null or t.expires_at > now())
  )
)
with check (
  exists (
    select 1
    from post_match_feedback_tokens t
    where t.token = post_match_feedback_responses.token
      and t.status in ('created', 'sent', 'completed')
      and (t.expires_at is null or t.expires_at > now())
  )
);

grant select on post_match_feedback_tokens to anon, authenticated;
grant insert, update on post_match_feedback_responses to anon, authenticated;
grant execute on function public.upsert_post_match_feedback_tokens_admin(jsonb) to authenticated;
grant execute on function public.upsert_post_match_feedback_tokens_admin(text, jsonb) to anon, authenticated;
grant execute on function public.submit_post_match_feedback_public(jsonb) to anon, authenticated;
grant execute on function public.get_post_match_feedback_by_tokens(text[]) to anon, authenticated;
