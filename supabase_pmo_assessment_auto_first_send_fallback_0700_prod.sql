-- Padel Match Organizer - PROD assessment email scheduler with 07:00 selected-batch fallback.
-- Apply only to the PROD Supabase project after explicit PROMUOVI PROD authorization.
--
-- Scope:
-- - 07:00 Europe/Rome: send only a pre-existing manual batch, only rows still selected;
-- - no automatic batch preparation;
-- - no send if staff already sent the batch manually;
-- - 09:00 Europe/Rome: scan replies and bounces;
-- - 09:30 Europe/Rome: send only due second/third follow-up emails;
-- - TEST must remain without persistent cron jobs.

create extension if not exists pg_net;
create extension if not exists pg_cron;
create extension if not exists supabase_vault with schema vault;

create or replace function public.pmo_dispatch_assessment_followup_email_prod(p_now timestamptz default now())
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
  v_body jsonb;
begin
  case v_local_time
    when '07:00' then
      v_routine_key := 'first_send_selected_batch_0700';
      v_routine_label := 'Invio automatico lotto selezionato Autovalutazione';
      v_action := 'routine-autosend-selected';
    when '09:00' then
      v_routine_key := 'followup_check_0900';
      v_routine_label := 'Controllo stop follow-up Autovalutazione';
      v_action := 'routine-check';
    when '09:30' then
      v_routine_key := 'followup_send_0930';
      v_routine_label := 'Invio richiami follow-up Autovalutazione';
      v_action := 'routine-followup';
    else
      return jsonb_build_object(
        'ok', true,
        'dispatched', false,
        'localDate', v_local_date,
        'localTime', v_local_time
      );
  end case;

  v_dispatch_key := 'assessment_followup_dispatch_' ||
    v_routine_key || '_' ||
    replace(v_local_date, '-', '') || '_' ||
    replace(v_local_time, ':', '');

  v_payload := jsonb_build_object(
    'id', v_dispatch_key,
    'source', 'pmo_assessment_scheduler_prod',
    'routine', v_routine_key,
    'routineLabel', v_routine_label,
    'functionSlug', 'assessment-email-send',
    'action', v_action,
    'scheduledLocalDate', v_local_date,
    'scheduledLocalTime', v_local_time,
    'scheduledLocalTimestamp', v_local_ts,
    'status', 'dispatching',
    'runtimeEnv', 'prod',
    'appVersion', '5.491',
    'firstSendAutomaticFallback', v_action = 'routine-autosend-selected',
    'requiresPreparedBatch', v_action = 'routine-autosend-selected',
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
        'error', 'PMO_ASSESSMENT_SCHEDULER_VAULT_SECRET_MISSING',
        'updatedAt', now()
      ),
      synced_at = now()
    where record_type = 'assessment_email'
      and local_key = v_dispatch_key;

    return jsonb_build_object(
      'ok', false,
      'dispatched', false,
      'error', 'PMO_ASSESSMENT_SCHEDULER_VAULT_SECRET_MISSING',
      'routine', v_routine_key,
      'action', v_action
    );
  end if;

  v_body := jsonb_build_object(
    'action', v_action,
    'source', 'pmo_assessment_scheduler_prod',
    'routine', v_routine_key,
    'scheduledLocalDate', v_local_date,
    'scheduledLocalTime', v_local_time,
    'runtimeEnv', 'prod',
    'appVersion', '5.491',
    'limit', case when v_action = 'routine-followup' then 20 else 10 end
  );

  if v_action = 'routine-followup' then
    v_body := v_body || jsonb_build_object(
      'intervalHours', 48,
      'checkBeforeSend', true
    );
  elsif v_action = 'routine-autosend-selected' then
    v_body := v_body || jsonb_build_object(
      'firstSendAutomaticFallback', true,
      'requiresPreparedBatch', true,
      'sendOnlySelected', true
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
    body := v_body,
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
    'assessment_scheduler_dispatch_last',
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

revoke all on function public.pmo_dispatch_assessment_followup_email_prod(timestamptz) from public;
revoke all on function public.pmo_dispatch_assessment_followup_email_prod(timestamptz) from anon;
revoke all on function public.pmo_dispatch_assessment_followup_email_prod(timestamptz) from authenticated;
grant execute on function public.pmo_dispatch_assessment_followup_email_prod(timestamptz) to service_role;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'pmo-assessment-followup-dispatcher-prod') then
    perform cron.schedule(
      'pmo-assessment-followup-dispatcher-prod',
      '*/5 * * * *',
      'select public.pmo_dispatch_assessment_followup_email_prod();'
    );
  end if;
end $$;
