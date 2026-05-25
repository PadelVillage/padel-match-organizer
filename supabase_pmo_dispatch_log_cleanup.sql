-- PMO — Cleanup automatico dispatch log (matchpoint_data)
-- Elimina i record data_routine_dispatch_* più vecchi di 7 giorni.
-- I record "last" e "auto_import_last" non vengono mai toccati.
-- Applicare su PROD e TEST.

create or replace function public.pmo_cleanup_dispatch_logs(
  p_retention_days int default 7
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted int;
  v_cutoff timestamptz := now() - (p_retention_days || ' days')::interval;
begin
  delete from public.pmo_cloud_records
  where record_type = 'matchpoint_data'
    and local_key like 'data_routine_dispatch_%'
    and local_key <> 'data_routine_dispatch_last'
    and synced_at < v_cutoff;

  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'ok', true,
    'deleted', v_deleted,
    'cutoff', v_cutoff,
    'retentionDays', p_retention_days
  );
end;
$$;

revoke all on function public.pmo_cleanup_dispatch_logs(int) from public;
grant execute on function public.pmo_cleanup_dispatch_logs(int) to service_role;

-- Schedula ogni domenica alle 03:00 ora italiana (02:00 UTC in estate)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'pmo-dispatch-log-cleanup') then
    perform cron.unschedule('pmo-dispatch-log-cleanup');
  end if;

  perform cron.schedule(
    'pmo-dispatch-log-cleanup',
    '0 2 * * 0',
    'select public.pmo_cleanup_dispatch_logs();'
  );
end $$;
