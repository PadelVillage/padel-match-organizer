-- ─────────────────────────────────────────────────────────────────────────────
-- Il ponte fra il cron e l'edge `assessment-apply-level` (voce `A4ter`).
--
-- Gemella di `pmo_dispatch_assessment_notify`: legge i tre segreti dal vault e
-- chiama la funzione. Il segreto della routine non esce mai da qui — è il motivo
-- per cui la chiamata parte dal database e non dall'app.
--
-- ⭐ `p_simula` fa fare all'edge il giro A VUOTO: legge, decide, e restituisce
-- l'elenco di cosa farebbe senza scrivere niente. Serve a guardare PRIMA di
-- accendere il cron, e resta utile dopo — è lo stesso principio dei bottoni che
-- scrivono davvero: si guarda, poi si arma.
--
-- ⚠️ Le migrazioni di questo repo NON si applicano da sole: va lanciata a mano
-- sui due progetti, TEST prima e PROD poi.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.pmo_dispatch_assessment_apply_level(p_simula boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'vault', 'net', 'pg_temp'
as $function$
declare
  v_project_url     text;
  v_publishable_key text;
  v_secret          text;
  v_request_id      bigint;
begin
  select decrypted_secret into v_project_url
  from vault.decrypted_secrets where name = 'pmo_data_routine_project_url';
  select decrypted_secret into v_publishable_key
  from vault.decrypted_secrets where name = 'pmo_data_routine_publishable_key';
  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'pmo_data_routine_secret';

  -- Segreti mancanti: si esce senza chiamare nessuno. Una chiamata senza segreto
  -- tornerebbe 401 e sembrerebbe un guasto dell'edge.
  if coalesce(v_project_url, '') = '' or coalesce(v_publishable_key, '') = '' or coalesce(v_secret, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'PMO_ASSESSMENT_APPLY_VAULT_SECRET_MISSING');
  end if;

  select net.http_post(
    url     := rtrim(v_project_url, '/') || '/functions/v1/assessment-apply-level',
    headers := jsonb_build_object(
      'Content-Type',         'application/json',
      'apikey',               v_publishable_key,
      'Authorization',        'Bearer ' || v_publishable_key,
      'x-pmo-routine-secret', v_secret
    ),
    body    := jsonb_build_object('source', 'pmo_assessment_apply_level_scheduler', 'simula', coalesce(p_simula, false)),
    timeout_milliseconds := 120000
  ) into v_request_id;

  return jsonb_build_object('ok', true, 'simula', coalesce(p_simula, false), 'requestId', v_request_id, 'dispatchedAt', now());
end;
$function$;

revoke all on function public.pmo_dispatch_assessment_apply_level(boolean) from public, anon, authenticated;
