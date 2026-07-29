-- Controllo notturno dell'allineamento dei MAESTRI fra Matchpoint e il gestionale.
--
-- Perché serve: la lista dei maestri è scritta a mano in parser_rules.json e creare
-- un maestro su Matchpoint NON la aggiorna (caso Lucas Vidal, #603). Dal dato che già
-- abbiamo non si può dedurre nulla: sulle lezioni sincronizzate `istruttore` è sempre
-- null. L'edge function legge i maestri veri dal worker (/read-instructors, sola
-- lettura) e manda una email SOLO quando le due liste non coincidono.
--
-- Riusa gli stessi vault secret e lo stesso header x-pmo-routine-secret delle altre
-- routine (pmo_dispatch_ai_lexicon_proposals, pmo_dispatch_assessment_email_routines).

create or replace function public.pmo_dispatch_maestri_allineamento()
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
    return jsonb_build_object('ok', false, 'error', 'PMO_MAESTRI_VAULT_SECRET_MISSING');
  end if;

  -- timeout generoso: la lettura apre un browser headless su Matchpoint e passa
  -- dalla coda del worker, che può avere altre operazioni davanti.
  select net.http_post(
    url     := rtrim(v_project_url, '/') || '/functions/v1/maestri-allineamento-check',
    headers := jsonb_build_object(
      'Content-Type',         'application/json',
      'apikey',               v_publishable_key,
      'Authorization',        'Bearer ' || v_publishable_key,
      'x-pmo-routine-secret', v_secret
    ),
    body    := jsonb_build_object('source', 'pmo_maestri_scheduler'),
    timeout_milliseconds := 180000
  ) into v_request_id;

  return jsonb_build_object('ok', true, 'requestId', v_request_id, 'dispatchedAt', now());
end;
$function$;

-- Job GIORNALIERO alle 03:40 UTC (~05:40 in Italia d'estate): di notte il worker
-- condiviso è scarico, e l'eventuale email si trova la mattina. Minuto non tondo di
-- proposito, per non accodarsi agli altri job che partono allo scoccare dell'ora.
-- Nome con suffisso ambiente per non confondere TEST/PROD.
--
-- PROD:
--   select cron.schedule('pmo-maestri-allineamento-prod', '40 3 * * *', $$ select public.pmo_dispatch_maestri_allineamento(); $$);
-- TEST (opzionale: legge lo stesso Matchpoint vero, quindi di norma basta PROD):
--   select cron.schedule('pmo-maestri-allineamento-test', '40 3 * * *', $$ select public.pmo_dispatch_maestri_allineamento(); $$);
--
-- Prova a mano (manda l'email anche se il disallineamento era già stato segnalato):
--   select net.http_post(... body := jsonb_build_object('force', true) ...);
