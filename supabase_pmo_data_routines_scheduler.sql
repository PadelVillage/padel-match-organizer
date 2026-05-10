-- Padel Match Organizer - TEST data routines scheduler.
-- Apply only to the TEST Supabase project until PROD is explicitly approved.

create extension if not exists pg_net;
create extension if not exists pg_cron;
create extension if not exists supabase_vault with schema vault;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'pmo_data_routine_project_url') then
    perform vault.create_secret(
      'https://cudiqnrrlbyqryrtaprd.supabase.co',
      'pmo_data_routine_project_url',
      'Padel Match Organizer TEST project URL for data routine cron'
    );
  end if;

  if not exists (select 1 from vault.secrets where name = 'pmo_data_routine_publishable_key') then
    perform vault.create_secret(
      'sb_publishable_ewpTKg4yQVxoK8-wA9XhOA_5voSNLuQ',
      'pmo_data_routine_publishable_key',
      'Padel Match Organizer TEST publishable key for data routine cron'
    );
  end if;

  if not exists (select 1 from vault.secrets where name = 'pmo_data_routine_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'pmo_data_routine_secret',
      'Padel Match Organizer TEST internal secret for data routine cron'
    );
  end if;
end $$;

create or replace function public.pmo_verify_data_routine_secret(p_secret text)
returns boolean
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
begin
  return exists (
    select 1
    from vault.decrypted_secrets
    where name = 'pmo_data_routine_secret'
      and decrypted_secret = coalesce(p_secret, '')
      and coalesce(p_secret, '') <> ''
  );
end;
$$;

revoke all on function public.pmo_verify_data_routine_secret(text) from public;
grant execute on function public.pmo_verify_data_routine_secret(text) to anon, authenticated, service_role;

create or replace function public.pmo_dispatch_data_routines(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public, vault, net, pg_temp
as $$
declare
  v_local_ts timestamp := p_now at time zone 'Europe/Rome';
  v_local_date text := to_char(p_now at time zone 'Europe/Rome', 'YYYY-MM-DD');
  v_local_time text := to_char(p_now at time zone 'Europe/Rome', 'HH24:MI');
  v_routine_key text := '';
  v_routine_label text := '';
  v_function_slug text := '';
  v_dispatch_key text := '';
  v_record_id uuid;
  v_project_url text;
  v_publishable_key text;
  v_secret text;
  v_request_id bigint;
  v_payload jsonb;
begin
  case v_local_time
    when '04:30' then
      v_routine_key := 'clients';
      v_routine_label := 'Clienti Matchpoint';
      v_function_slug := 'matchpoint-clients-sync';
    when '05:00' then
      v_routine_key := 'history';
      v_routine_label := 'Storico Matchpoint';
      v_function_slug := 'matchpoint-history-sync';
    when '05:30' then
      v_routine_key := 'bookings_morning';
      v_routine_label := 'Prenotazioni future Matchpoint';
      v_function_slug := 'matchpoint-bookings-sync';
    when '10:30' then
      v_routine_key := 'bookings_1030';
      v_routine_label := 'Prenotazioni future Matchpoint';
      v_function_slug := 'matchpoint-bookings-sync';
    when '14:30' then
      v_routine_key := 'bookings_1430';
      v_routine_label := 'Prenotazioni future Matchpoint';
      v_function_slug := 'matchpoint-bookings-sync';
    when '17:30' then
      v_routine_key := 'bookings_1730';
      v_routine_label := 'Prenotazioni future Matchpoint';
      v_function_slug := 'matchpoint-bookings-sync';
    when '21:30' then
      v_routine_key := 'bookings_2130';
      v_routine_label := 'Prenotazioni future Matchpoint';
      v_function_slug := 'matchpoint-bookings-sync';
    else
      return jsonb_build_object(
        'ok', true,
        'dispatched', false,
        'localDate', v_local_date,
        'localTime', v_local_time
      );
  end case;

  v_dispatch_key := 'data_routine_dispatch_' ||
    v_routine_key || '_' ||
    replace(v_local_date, '-', '') || '_' ||
    replace(v_local_time, ':', '');

  v_payload := jsonb_build_object(
    'id', v_dispatch_key,
    'source', 'pmo_data_routine_scheduler',
    'routine', v_routine_key,
    'routineLabel', v_routine_label,
    'functionSlug', v_function_slug,
    'scheduledLocalDate', v_local_date,
    'scheduledLocalTime', v_local_time,
    'scheduledLocalTimestamp', v_local_ts,
    'status', 'dispatching',
    'createdAt', now()
  );

  insert into public.pmo_cloud_records (
    record_type,
    local_key,
    payload,
    payload_hash,
    deleted,
    synced_at
  )
  values (
    'matchpoint_data',
    v_dispatch_key,
    v_payload,
    null,
    false,
    now()
  )
  on conflict (record_type, local_key) do nothing
  returning id into v_record_id;

  if v_record_id is null then
    return jsonb_build_object(
      'ok', true,
      'dispatched', false,
      'duplicate', true,
      'routine', v_routine_key,
      'localDate', v_local_date,
      'localTime', v_local_time
    );
  end if;

  select decrypted_secret into v_project_url
  from vault.decrypted_secrets
  where name = 'pmo_data_routine_project_url';

  select decrypted_secret into v_publishable_key
  from vault.decrypted_secrets
  where name = 'pmo_data_routine_publishable_key';

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'pmo_data_routine_secret';

  if coalesce(v_project_url, '') = '' or coalesce(v_publishable_key, '') = '' or coalesce(v_secret, '') = '' then
    update public.pmo_cloud_records
    set payload = v_payload || jsonb_build_object(
        'status', 'blocked',
        'error', 'PMO_DATA_ROUTINE_VAULT_SECRET_MISSING',
        'updatedAt', now()
      ),
      synced_at = now()
    where record_type = 'matchpoint_data'
      and local_key = v_dispatch_key;

    return jsonb_build_object(
      'ok', false,
      'dispatched', false,
      'error', 'PMO_DATA_ROUTINE_VAULT_SECRET_MISSING',
      'routine', v_routine_key
    );
  end if;

  select net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/' || v_function_slug,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_publishable_key,
      'Authorization', 'Bearer ' || v_publishable_key,
      'x-pmo-routine-secret', v_secret
    ),
    body := jsonb_build_object(
      'source', 'pmo_data_routine_scheduler',
      'routine', v_routine_key,
      'scheduledLocalDate', v_local_date,
      'scheduledLocalTime', v_local_time
    )
  ) into v_request_id;

  v_payload := v_payload || jsonb_build_object(
    'status', 'dispatched',
    'requestId', v_request_id,
    'updatedAt', now()
  );

  update public.pmo_cloud_records
  set payload = v_payload,
      synced_at = now()
  where record_type = 'matchpoint_data'
    and local_key = v_dispatch_key;

  insert into public.pmo_cloud_records (
    record_type,
    local_key,
    payload,
    payload_hash,
    deleted,
    synced_at
  )
  values (
    'matchpoint_data',
    'data_routine_dispatch_last',
    v_payload,
    null,
    false,
    now()
  )
  on conflict (record_type, local_key) do update
  set payload = excluded.payload,
      payload_hash = excluded.payload_hash,
      deleted = excluded.deleted,
      synced_at = excluded.synced_at;

  return jsonb_build_object(
    'ok', true,
    'dispatched', true,
    'routine', v_routine_key,
    'functionSlug', v_function_slug,
    'requestId', v_request_id,
    'localDate', v_local_date,
    'localTime', v_local_time
  );
end;
$$;

revoke all on function public.pmo_dispatch_data_routines(timestamptz) from public;
grant execute on function public.pmo_dispatch_data_routines(timestamptz) to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'pmo-data-routines-dispatcher-test') then
    perform cron.unschedule('pmo-data-routines-dispatcher-test');
  end if;

  perform cron.schedule(
    'pmo-data-routines-dispatcher-test',
    '*/5 * * * *',
    'select public.pmo_dispatch_data_routines();'
  );
end $$;
