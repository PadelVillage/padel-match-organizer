-- Padel Match Organizer - feedback post-partita no-PIN
-- Idempotente. Da eseguire prima in TEST, poi eventualmente in PROD tramite Promuovi Prod Admin.
-- Non crea scheduler, non invia comunicazioni e non modifica dati Matchpoint.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.assessment_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.post_match_feedback_tokens (
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

alter table public.post_match_feedback_tokens add column if not exists id uuid default gen_random_uuid();
alter table public.post_match_feedback_tokens add column if not exists token text;
alter table public.post_match_feedback_tokens add column if not exists member_local_id text;
alter table public.post_match_feedback_tokens add column if not exists member_name text;
alter table public.post_match_feedback_tokens add column if not exists phone_last4 text;
alter table public.post_match_feedback_tokens add column if not exists match_key text;
alter table public.post_match_feedback_tokens add column if not exists match_label text;
alter table public.post_match_feedback_tokens add column if not exists status text not null default 'created';
alter table public.post_match_feedback_tokens add column if not exists created_at timestamptz not null default now();
alter table public.post_match_feedback_tokens add column if not exists sent_at timestamptz;
alter table public.post_match_feedback_tokens add column if not exists completed_at timestamptz;
alter table public.post_match_feedback_tokens add column if not exists expires_at timestamptz;
alter table public.post_match_feedback_tokens add column if not exists registered_at timestamptz;
alter table public.post_match_feedback_tokens add column if not exists updated_at timestamptz not null default now();

create table if not exists public.post_match_feedback_responses (
  id uuid primary key default gen_random_uuid(),
  token text not null references public.post_match_feedback_tokens(token),
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

alter table public.post_match_feedback_responses add column if not exists id uuid default gen_random_uuid();
alter table public.post_match_feedback_responses add column if not exists token text;
alter table public.post_match_feedback_responses add column if not exists submitted_at timestamptz not null default now();
alter table public.post_match_feedback_responses add column if not exists match_key text;
alter table public.post_match_feedback_responses add column if not exists member_local_id text;
alter table public.post_match_feedback_responses add column if not exists level_experience text;
alter table public.post_match_feedback_responses add column if not exists composition_preference text;
alter table public.post_match_feedback_responses add column if not exists future_interest text;
alter table public.post_match_feedback_responses add column if not exists note text;
alter table public.post_match_feedback_responses add column if not exists raw_response jsonb not null default '{}'::jsonb;
alter table public.post_match_feedback_responses add column if not exists staff_status text not null default '';
alter table public.post_match_feedback_responses add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_post_match_feedback_tokens_token_unique on public.post_match_feedback_tokens(token);
create unique index if not exists idx_post_match_feedback_responses_token_unique on public.post_match_feedback_responses(token);
create index if not exists idx_post_match_feedback_tokens_token on public.post_match_feedback_tokens(token);
create index if not exists idx_post_match_feedback_tokens_match_key on public.post_match_feedback_tokens(match_key);
create index if not exists idx_post_match_feedback_responses_match_key on public.post_match_feedback_responses(match_key);

drop trigger if exists trg_post_match_feedback_tokens_updated_at on public.post_match_feedback_tokens;
create trigger trg_post_match_feedback_tokens_updated_at
before update on public.post_match_feedback_tokens
for each row execute function public.assessment_touch_updated_at();

drop trigger if exists trg_post_match_feedback_responses_updated_at on public.post_match_feedback_responses;
create trigger trg_post_match_feedback_responses_updated_at
before update on public.post_match_feedback_responses
for each row execute function public.assessment_touch_updated_at();

create or replace function public.post_match_feedback_mark_token_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.post_match_feedback_tokens
  set status = 'completed',
      completed_at = coalesce(new.submitted_at, now())
  where token = new.token;
  return new;
end;
$$;

drop trigger if exists trg_post_match_feedback_mark_token_completed on public.post_match_feedback_responses;
create trigger trg_post_match_feedback_mark_token_completed
after insert or update on public.post_match_feedback_responses
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
    insert into public.post_match_feedback_tokens (
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
    from public.assessment_admin_config cfg
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
    insert into public.post_match_feedback_tokens (
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
  v_token_row public.post_match_feedback_tokens%rowtype;
begin
  if v_token is null then
    raise exception 'TOKEN_MISSING';
  end if;

  select * into v_token_row
  from public.post_match_feedback_tokens t
  where t.token = v_token
    and t.status in ('created', 'sent')
    and (t.expires_at is null or t.expires_at > now())
  limit 1;

  if v_token_row.token is null then
    raise exception 'TOKEN_NOT_VALID';
  end if;

  insert into public.post_match_feedback_responses (
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
  from public.post_match_feedback_responses r
  where r.token = any(p_tokens)
  order by r.submitted_at desc;
$$;

alter table public.post_match_feedback_tokens enable row level security;
alter table public.post_match_feedback_responses enable row level security;

drop policy if exists "public_read_active_post_match_feedback_tokens" on public.post_match_feedback_tokens;
create policy "public_read_active_post_match_feedback_tokens"
on public.post_match_feedback_tokens
for select
to anon, authenticated
using (
  status in ('created', 'sent')
  and (expires_at is null or expires_at > now())
);

drop policy if exists "public_insert_post_match_feedback" on public.post_match_feedback_responses;
create policy "public_insert_post_match_feedback"
on public.post_match_feedback_responses
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.post_match_feedback_tokens t
    where t.token = post_match_feedback_responses.token
      and t.status in ('created', 'sent')
      and (t.expires_at is null or t.expires_at > now())
  )
);

drop policy if exists "public_update_post_match_feedback" on public.post_match_feedback_responses;
create policy "public_update_post_match_feedback"
on public.post_match_feedback_responses
for update
to anon, authenticated
using (
  exists (
    select 1
    from public.post_match_feedback_tokens t
    where t.token = post_match_feedback_responses.token
      and t.status in ('created', 'sent', 'completed')
      and (t.expires_at is null or t.expires_at > now())
  )
)
with check (
  exists (
    select 1
    from public.post_match_feedback_tokens t
    where t.token = post_match_feedback_responses.token
      and t.status in ('created', 'sent', 'completed')
      and (t.expires_at is null or t.expires_at > now())
  )
);

grant usage on schema public to anon, authenticated;
grant select on public.post_match_feedback_tokens to anon, authenticated;
grant insert, update on public.post_match_feedback_responses to anon, authenticated;
grant execute on function public.upsert_post_match_feedback_tokens_admin(jsonb) to authenticated;
grant execute on function public.upsert_post_match_feedback_tokens_admin(text, jsonb) to anon, authenticated;
grant execute on function public.submit_post_match_feedback_public(jsonb) to anon, authenticated;
grant execute on function public.get_post_match_feedback_by_tokens(text[]) to anon, authenticated;
