-- Fase 3b autoapprendimento: routine ORARIA che chiama l'edge function
-- ai-propose-lexicon (diario → Gemini → proposte di lessico). L'approvazione resta UMANA.
-- Riusa i vault secret della routine dati (pmo_data_routine_*) e il secret x-pmo-routine-secret,
-- come pmo_dispatch_assessment_email_routines.

create or replace function public.pmo_dispatch_ai_lexicon_proposals()
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

  if coalesce(v_project_url, '') = '' or coalesce(v_publishable_key, '') = '' or coalesce(v_secret, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'PMO_AI_LEXICON_VAULT_SECRET_MISSING');
  end if;

  select net.http_post(
    url     := rtrim(v_project_url, '/') || '/functions/v1/ai-propose-lexicon',
    headers := jsonb_build_object(
      'Content-Type',         'application/json',
      'apikey',               v_publishable_key,
      'Authorization',        'Bearer ' || v_publishable_key,
      'x-pmo-routine-secret', v_secret
    ),
    body    := jsonb_build_object('source', 'pmo_ai_lexicon_scheduler'),
    timeout_milliseconds := 120000
  ) into v_request_id;

  return jsonb_build_object('ok', true, 'requestId', v_request_id, 'dispatchedAt', now());
end;
$function$;

-- Job ORARIO (minuto 0 di ogni ora). Nome con suffisso ambiente per non confondere TEST/PROD.
-- TEST:
--   select cron.schedule('pmo-ai-lexicon-proposals-test', '0 * * * *', $$ select public.pmo_dispatch_ai_lexicon_proposals(); $$);
-- PROD:
--   select cron.schedule('pmo-ai-lexicon-proposals-prod', '0 * * * *', $$ select public.pmo_dispatch_ai_lexicon_proposals(); $$);
