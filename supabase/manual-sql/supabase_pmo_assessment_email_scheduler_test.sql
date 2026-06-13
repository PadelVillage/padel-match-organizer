-- Padel Match Organizer - TEST assessment email scheduler.
-- Apply only to the TEST Supabase project until PROD is explicitly approved.

create extension if not exists pg_net;
create extension if not exists pg_cron;
create extension if not exists supabase_vault with schema vault;

create or replace function public.pmo_dispatch_assessment_email_routines(p_now timestamptz default now())
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
  v_action text := '';
  v_dispatch_key text := '';
  v_record_id uuid;
  v_project_url text;
  v_publishable_key text;
  v_secret text;
  v_request_id bigint;
  v_payload jsonb;
begin
  case v_local_time
    when '05:45' then
      v_routine_key := 'daily_send_0545';
      v_routine_label := 'Invio autovalutazione mattutino';
      v_action := 'routine-send';
    when '06:10' then
      v_routine_key := 'check_0610';
      v_routine_label := 'Controllo risposte autovalutazione';
      v_action := 'routine-check';
    when '10:30' then
      v_routine_key := 'check_1030';
      v_routine_label := 'Controllo risposte autovalutazione';
      v_action := 'routine-check';
    when '15:30' then
      v_routine_key := 'check_1530';
      v_routine_label := 'Controllo risposte autovalutazione';
      v_action := 'routine-check';
    when '20:30' then
      v_routine_key := 'check_2030';
      v_routine_label := 'Controllo risposte autovalutazione';
      v_action := 'routine-check';
    else
      return jsonb_build_object(
        'ok', true,
        'dispatched', false,
        'localDate', v_local_date,
        'localTime', v_local_time
      );
  end case;

  v_dispatch_key := 'assessment_email_dispatch_' ||
    v_routine_key || '_' ||
    replace(v_local_date, '-', '') || '_' ||
    replace(v_local_time, ':', '');

  v_payload := jsonb_build_object(
    'id', v_dispatch_key,
    'source', 'pmo_assessment_email_scheduler',
    'routine', v_routine_key,
    'routineLabel', v_routine_label,
    'functionSlug', 'assessment-email-send',
    'action', v_action,
    'scheduledLocalDate', v_local_date,
    'scheduledLocalTime', v_local_time,
    'scheduledLocalTimestamp', v_local_ts,
    'dailyLimit', 10,
    'status', 'dispatching',
    'runtimeEnv', 'test',
    'appVersion', '5.412',
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
    'assessment_email',
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
      'action', v_action,
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
        'error', 'PMO_ASSESSMENT_EMAIL_VAULT_SECRET_MISSING',
        'updatedAt', now()
      ),
      synced_at = now()
    where record_type = 'assessment_email'
      and local_key = v_dispatch_key;

    return jsonb_build_object(
      'ok', false,
      'dispatched', false,
      'error', 'PMO_ASSESSMENT_EMAIL_VAULT_SECRET_MISSING',
      'routine', v_routine_key,
      'action', v_action
    );
  end if;

  select net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/assessment-email-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_publishable_key,
      'Authorization', 'Bearer ' || v_publishable_key,
      'x-pmo-routine-secret', v_secret
    ),
    body := jsonb_build_object(
      'action', v_action,
      'source', 'pmo_assessment_email_scheduler',
      'routine', v_routine_key,
      'scheduledLocalDate', v_local_date,
      'scheduledLocalTime', v_local_time,
      'limit', 10,
      'runtimeEnv', 'test',
      'appVersion', '5.412'
    ),
    timeout_milliseconds := 300000
  ) into v_request_id;

  v_payload := v_payload || jsonb_build_object(
    'status', 'dispatched',
    'requestId', v_request_id,
    'updatedAt', now()
  );

  update public.pmo_cloud_records
  set payload = v_payload,
      synced_at = now()
  where record_type = 'assessment_email'
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
    'assessment_email',
    'assessment_email_dispatch_last',
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
    'action', v_action,
    'functionSlug', 'assessment-email-send',
    'requestId', v_request_id,
    'localDate', v_local_date,
    'localTime', v_local_time
  );
end;
$$;

revoke all on function public.pmo_dispatch_assessment_email_routines(timestamptz) from public;
grant execute on function public.pmo_dispatch_assessment_email_routines(timestamptz) to service_role;

grant select, insert, update on table public.assessment_tokens to service_role;
grant select on table public.self_assessments to service_role;
grant select, insert on table public.pmo_routine_runs to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'pmo-assessment-email-dispatcher-test') then
    perform cron.unschedule('pmo-assessment-email-dispatcher-test');
  end if;

  perform cron.schedule(
    'pmo-assessment-email-dispatcher-test',
    '*/5 * * * *',
    'select public.pmo_dispatch_assessment_email_routines();'
  );
end $$;
