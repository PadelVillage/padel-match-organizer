-- Padel Match Organizer - FASE 1 assessment plan scheduler TEST.
-- Apply ONLY to the TEST Supabase project (cudiqnrrlbyqryrtaprd).
-- DO NOT apply to PROD (qqbfphyslczzkxoncgex).
--
-- Scope:
--   06:30 Europe/Rome  → routine-plan   : pre-pianifica il lotto giornaliero (nessun invio)
--   05:45 Europe/Rome  → routine-send   : invio legacy (richiede approvazione manuale)
--   06:10 Europe/Rome  → routine-check  : lettura risposte Gmail
--   10:30 Europe/Rome  → routine-check
--   15:30 Europe/Rome  → routine-check
--   20:30 Europe/Rome  → routine-check
--
-- Auth:
--   In TEST la Edge Function assessment-email-send è deployata con --no-verify-jwt.
--   Il dispatcher usa comunque x-pmo-routine-secret come controllo interno.
--   I tre secret Vault (pmo_data_routine_project_url, pmo_data_routine_publishable_key,
--   pmo_data_routine_secret) sono già stati creati da supabase_pmo_data_routines_scheduler.sql.
--   Lo script li crea solo se assenti (idempotente).
--
-- Job cron:
--   Lo script crea il job pmo-assessment-email-dispatcher-test se non esiste,
--   oppure lo ri-schedula se esiste già. Non tocca nessun job PROD.

-- ─── Estensioni (idempotenti) ─────────────────────────────────────────────────

create extension if not exists pg_net;
create extension if not exists pg_cron;
create extension if not exists supabase_vault with schema vault;

-- ─── Secret Vault (idempotenti) ───────────────────────────────────────────────
-- I tre secret sono già stati creati da supabase_pmo_data_routines_scheduler.sql.
-- Questo blocco li crea solo se per qualsiasi motivo non fossero presenti,
-- evitando sovrascritture accidentali.

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'pmo_data_routine_project_url') then
    perform vault.create_secret(
      'https://cudiqnrrlbyqryrtaprd.supabase.co',
      'pmo_data_routine_project_url',
      'Padel Match Organizer TEST project URL for assessment plan cron'
    );
  end if;

  if not exists (select 1 from vault.secrets where name = 'pmo_data_routine_publishable_key') then
    perform vault.create_secret(
      'sb_publishable_ewpTKg4yQVxoK8-wA9XhOA_5voSNLuQ',
      'pmo_data_routine_publishable_key',
      'Padel Match Organizer TEST publishable key for assessment plan cron'
    );
  end if;

  if not exists (select 1 from vault.secrets where name = 'pmo_data_routine_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'pmo_data_routine_secret',
      'Padel Match Organizer TEST internal secret for assessment plan cron'
    );
  end if;
end $$;

-- ─── Dispatcher assessment email con routine-plan ─────────────────────────────

create or replace function public.pmo_dispatch_assessment_email_routines(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public, vault, net, pg_temp
as $$
declare
  v_local_ts    timestamp := p_now at time zone 'Europe/Rome';
  v_local_date  text      := to_char(p_now at time zone 'Europe/Rome', 'YYYY-MM-DD');
  v_local_time  text      := to_char(p_now at time zone 'Europe/Rome', 'HH24:MI');
  v_routine_key   text := '';
  v_routine_label text := '';
  v_action        text := '';
  v_dispatch_key  text := '';
  v_record_id   uuid;
  v_project_url       text;
  v_publishable_key   text;
  v_secret            text;
  v_request_id  bigint;
  v_payload     jsonb;
  v_body        jsonb;
begin

  -- ── Tabella orari dispatcher TEST ──────────────────────────────────────────
  -- In TEST: solo routine-plan (crea batch pending) — invio automatico disabilitato.
  -- L'invio va eseguito manualmente dall'UI per evitare invii massivi in ambiente di test.
  case v_local_time
    when '05:45' then
      v_routine_key   := 'daily_plan_0545';
      v_routine_label := 'Pre-pianificazione lotto Autovalutazione';
      v_action        := 'routine-plan';
    when '06:10' then
      v_routine_key   := 'check_0610';
      v_routine_label := 'Controllo risposte autovalutazione';
      v_action        := 'routine-check';
    when '10:30' then
      v_routine_key   := 'check_1030';
      v_routine_label := 'Controllo risposte autovalutazione';
      v_action        := 'routine-check';
    when '15:30' then
      v_routine_key   := 'check_1530';
      v_routine_label := 'Controllo risposte autovalutazione';
      v_action        := 'routine-check';
    when '20:30' then
      v_routine_key   := 'check_2030';
      v_routine_label := 'Controllo risposte autovalutazione';
      v_action        := 'routine-check';
    else
      -- Orario fuori tabella: noop, nessuna chiamata HTTP.
      return jsonb_build_object(
        'ok',          true,
        'dispatched',  false,
        'localDate',   v_local_date,
        'localTime',   v_local_time
      );
  end case;

  -- ── Chiave dispatch univoca per evitare doppi dispatch ───────────────────────
  v_dispatch_key := 'assessment_email_dispatch_' ||
    v_routine_key || '_' ||
    replace(v_local_date, '-', '') || '_' ||
    replace(v_local_time, ':', '');

  -- ── Payload base del record di tracciatura ───────────────────────────────────
  v_payload := jsonb_build_object(
    'id',                   v_dispatch_key,
    'source',               'pmo_assessment_email_scheduler',
    'routine',              v_routine_key,
    'routineLabel',         v_routine_label,
    'functionSlug',         'assessment-email-send',
    'action',               v_action,
    'scheduledLocalDate',   v_local_date,
    'scheduledLocalTime',   v_local_time,
    'scheduledLocalTimestamp', v_local_ts,
    'dailyLimit',           10,
    'status',               'dispatching',
    'runtimeEnv',           'test',
    'appVersion',           '5.555',
    'createdAt',            now()
  );

  -- ── Inserisce il record di tracciatura (on conflict do nothing = deduplica) ──
  insert into public.pmo_cloud_records (
    record_type, local_key, payload, payload_hash, deleted, synced_at
  )
  values (
    'assessment_email', v_dispatch_key, v_payload, null, false, now()
  )
  on conflict (record_type, local_key) do nothing
  returning id into v_record_id;

  -- Record già presente → dispatch già eseguito per questo orario oggi.
  if v_record_id is null then
    return jsonb_build_object(
      'ok',          true,
      'dispatched',  false,
      'duplicate',   true,
      'routine',     v_routine_key,
      'action',      v_action,
      'localDate',   v_local_date,
      'localTime',   v_local_time
    );
  end if;

  -- ── Legge i secret Vault ──────────────────────────────────────────────────────
  select decrypted_secret into v_project_url
  from vault.decrypted_secrets
  where name = 'pmo_data_routine_project_url';

  select decrypted_secret into v_publishable_key
  from vault.decrypted_secrets
  where name = 'pmo_data_routine_publishable_key';

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'pmo_data_routine_secret';

  -- ── Secret mancanti → blocca senza chiamata HTTP ─────────────────────────────
  if coalesce(v_project_url, '') = ''
    or coalesce(v_publishable_key, '') = ''
    or coalesce(v_secret, '') = ''
  then
    update public.pmo_cloud_records
    set payload   = v_payload || jsonb_build_object(
                      'status',    'blocked',
                      'error',     'PMO_ASSESSMENT_EMAIL_VAULT_SECRET_MISSING',
                      'updatedAt', now()
                    ),
        synced_at = now()
    where record_type = 'assessment_email'
      and local_key   = v_dispatch_key;

    return jsonb_build_object(
      'ok',         false,
      'dispatched', false,
      'error',      'PMO_ASSESSMENT_EMAIL_VAULT_SECRET_MISSING',
      'routine',    v_routine_key,
      'action',     v_action
    );
  end if;

  -- ── Body HTTP specifico per azione ────────────────────────────────────────────
  v_body := jsonb_build_object(
    'action',              v_action,
    'source',              'pmo_assessment_email_scheduler',
    'routine',             v_routine_key,
    'scheduledLocalDate',  v_local_date,
    'scheduledLocalTime',  v_local_time,
    'runtimeEnv',          'test',
    'appVersion',          '5.516',
    'limit',               10
  );

  -- routine-plan: nessun parametro extra richiesto.
  -- routine-send: usa i default (require approved batch già presenti nel codice EF).
  -- routine-check: usa i default.

  -- ── Chiamata HTTP alla Edge Function ─────────────────────────────────────────
  -- In TEST: verify_jwt=false → il Bearer con publishable key è sufficiente.
  -- Il controllo interno di autorizzazione usa x-pmo-routine-secret.
  select net.http_post(
    url     := rtrim(v_project_url, '/') || '/functions/v1/assessment-email-send',
    headers := jsonb_build_object(
      'Content-Type',       'application/json',
      'apikey',             v_publishable_key,
      'Authorization',      'Bearer ' || v_publishable_key,
      'x-pmo-routine-secret', v_secret
    ),
    body    := v_body,
    timeout_milliseconds := 300000
  ) into v_request_id;

  -- ── Aggiorna il record con esito dispatched ───────────────────────────────────
  v_payload := v_payload || jsonb_build_object(
    'status',     'dispatched',
    'requestId',  v_request_id,
    'updatedAt',  now()
  );

  update public.pmo_cloud_records
  set payload   = v_payload,
      synced_at = now()
  where record_type = 'assessment_email'
    and local_key   = v_dispatch_key;

  -- Aggiorna la chiave "last dispatch" per la UI pannello routine.
  insert into public.pmo_cloud_records (
    record_type, local_key, payload, payload_hash, deleted, synced_at
  )
  values (
    'assessment_email', 'assessment_email_dispatch_last', v_payload, null, false, now()
  )
  on conflict (record_type, local_key) do update
    set payload   = excluded.payload,
        payload_hash = excluded.payload_hash,
        deleted   = excluded.deleted,
        synced_at = excluded.synced_at;

  return jsonb_build_object(
    'ok',          true,
    'dispatched',  true,
    'routine',     v_routine_key,
    'action',      v_action,
    'functionSlug', 'assessment-email-send',
    'requestId',   v_request_id,
    'localDate',   v_local_date,
    'localTime',   v_local_time
  );
end;
$$;

-- ── Permessi ──────────────────────────────────────────────────────────────────

revoke all on function public.pmo_dispatch_assessment_email_routines(timestamptz) from public;
revoke all on function public.pmo_dispatch_assessment_email_routines(timestamptz) from anon;
revoke all on function public.pmo_dispatch_assessment_email_routines(timestamptz) from authenticated;
grant execute on function public.pmo_dispatch_assessment_email_routines(timestamptz) to service_role;

-- ── Job cron pmo-assessment-email-dispatcher-test ─────────────────────────────
-- Il job esegue il dispatcher ogni 5 minuti.
-- Il dispatcher reagisce solo agli orari previsti (case v_local_time).
-- In tutti gli altri minuti restituisce dispatched=false senza effetti.
-- NON viene creato nessun job PROD né modificato pmo-assessment-followup-dispatcher-prod.

do $$
begin
  -- Se il job esiste già (da script precedente), lo ri-schedula per sicurezza.
  if exists (select 1 from cron.job where jobname = 'pmo-assessment-email-dispatcher-test') then
    perform cron.unschedule('pmo-assessment-email-dispatcher-test');
  end if;

  perform cron.schedule(
    'pmo-assessment-email-dispatcher-test',
    '*/5 * * * *',
    'select public.pmo_dispatch_assessment_email_routines();'
  );
end $$;
