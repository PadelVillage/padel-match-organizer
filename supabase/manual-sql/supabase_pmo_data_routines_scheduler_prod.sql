-- Padel Match Organizer - PROD data routines scheduler.
-- Scheduler automatico Matchpoint: gira SOLO su PROD (account Matchpoint unico, condiviso
-- con TEST). Su TEST il dispatcher resta DISATTIVATO/manuale
-- (vedi supabase_pmo_data_routines_scheduler.sql e procedura-deploy-test-prod.md:354).
--
-- Cadenza: ogni 2 minuti. Job FISSI giornalieri: Clienti (6x), Storico 05:00, Backup 05:45.
-- Le PRENOTAZIONI FUTURE hanno UNA sola sorgente: il sync "live" (else), ogni 2 minuti,
-- attivo SEMPRE tranne la pausa notturna 01:00-06:00 (Europe/Rome) → porta i cambi Matchpoint
-- in app entro ~2 minuti. Riusa matchpoint-bookings-sync con la finestra piena di 30 giorni
-- (reconciliation corretta) + guard anti-accavallamento. (2026-06-25: rimossi i job fissi
-- bookings 05:30/10:30/14:30/17:30/21:30, ridondanti col live; finestra live 07-23 → 06-01.)
--
-- I secret vault PROD (pmo_data_routine_project_url / _publishable_key / _secret) sono GIA'
-- configurati su PROD: questo file NON li ricrea, per non sovrascriverli.

create extension if not exists pg_net;
create extension if not exists pg_cron;
create extension if not exists supabase_vault with schema vault;

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
  v_last_live_dispatch timestamptz;
  v_last_import_done timestamptz;
begin
  -- NB: branche giornaliere FISSE = clienti 6x/giorno + storico 05:00 + backup 05:45.
  -- I bookings NON hanno più job fissi: l'unica sorgente prenotazioni future è il sync
  -- "live" (else, ogni 2 min, attivo 06:00-01:00). NON reintrodurre i fissi bookings.
  case v_local_time
    when '04:30' then
      v_routine_key := 'clients_0430';
      v_routine_label := 'Clienti Matchpoint';
      v_function_slug := 'matchpoint-clients-sync';
    when '05:00' then
      v_routine_key := 'history';
      v_routine_label := 'Storico Matchpoint';
      v_function_slug := 'matchpoint-history-sync';
    when '06:00' then
      -- NB: 06:00 (minuto PARI) → scatta col cron */2. La vecchia 05:45 aveva minuto
      -- DISPARI e non veniva MAI eseguita (il cron gira solo a minuti pari).
      v_routine_key := 'cloud_backup';
      v_routine_label := 'Backup cloud automatico';
      v_function_slug := 'pmo-cloud-backup-auto';
    when '07:30' then
      v_routine_key := 'clients_0730';
      v_routine_label := 'Clienti Matchpoint';
      v_function_slug := 'matchpoint-clients-sync';
    when '12:30' then
      v_routine_key := 'clients_1230';
      v_routine_label := 'Clienti Matchpoint';
      v_function_slug := 'matchpoint-clients-sync';
    when '16:30' then
      v_routine_key := 'clients_1630';
      v_routine_label := 'Clienti Matchpoint';
      v_function_slug := 'matchpoint-clients-sync';
    when '19:30' then
      v_routine_key := 'clients_1930';
      v_routine_label := 'Clienti Matchpoint';
      v_function_slug := 'matchpoint-clients-sync';
    when '23:30' then
      v_routine_key := 'clients_2330';
      v_routine_label := 'Clienti Matchpoint';
      v_function_slug := 'matchpoint-clients-sync';
    else
      -- Sync "live" prenotazioni: UNICA sorgente delle prenotazioni future, ogni 2 min,
      -- attivo SEMPRE tranne la pausa notturna 01:00-06:00 (Europe/Rome). Riusa
      -- matchpoint-bookings-sync con la finestra piena di 30 giorni (reconciliation corretta).
      -- I vecchi job FISSI bookings (05:30/10:30/14:30/17:30/21:30) sono stati RIMOSSI:
      -- erano la STESSA importazione del live e quindi ridondanti. Clienti/Storico/Backup
      -- restano nei when sopra (anche dentro 01-06: non sono prenotazioni future).
      if not (v_local_time >= '01:00' and v_local_time < '06:00') then
        -- Guard anti-accavallamento: salta se l'ultimo dispatch live e' partito da poco
        -- (<150s) e non risulta ancora un import completato dopo di esso (run in volo).
        -- Il completamento e' segnalato dal record matchpoint_bookings_auto_import_last,
        -- aggiornato dall'edge function a ogni sync riuscito. Il worker e' comunque
        -- serializzato: questo evita solo login Matchpoint ridondanti.
        select max(synced_at) into v_last_live_dispatch
        from public.pmo_cloud_records
        where record_type = 'matchpoint_data'
          and local_key like 'data_routine_dispatch_bookings_live_%';

        select synced_at into v_last_import_done
        from public.pmo_cloud_records
        where record_type = 'matchpoint_data'
          and local_key = 'matchpoint_bookings_auto_import_last';

        if v_last_live_dispatch is not null
           and v_last_live_dispatch > now() - interval '150 seconds'
           and (v_last_import_done is null or v_last_import_done < v_last_live_dispatch) then
          return jsonb_build_object(
            'ok', true,
            'dispatched', false,
            'skipped', 'live_in_flight',
            'routine', 'bookings_live',
            'localDate', v_local_date,
            'localTime', v_local_time
          );
        end if;

        v_routine_key := 'bookings_live';
        v_routine_label := 'Prenotazioni future Matchpoint (live)';
        v_function_slug := 'matchpoint-bookings-sync';
      else
        return jsonb_build_object(
          'ok', true,
          'dispatched', false,
          'localDate', v_local_date,
          'localTime', v_local_time
        );
      end if;
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

-- Cron PROD ogni 2 minuti. Robusto sul jobname: rimuove qualunque dispatcher data-routines
-- gia' presente (qualsiasi nome) e lascia un solo job canonico, evitando doppioni.
do $$
declare
  r record;
begin
  for r in
    select jobname from cron.job
    where command ilike '%pmo_dispatch_data_routines%'
  loop
    perform cron.unschedule(r.jobname);
  end loop;

  perform cron.schedule(
    'pmo-data-routines-dispatcher-prod',
    '*/2 * * * *',
    'select public.pmo_dispatch_data_routines();'
  );
end $$;
