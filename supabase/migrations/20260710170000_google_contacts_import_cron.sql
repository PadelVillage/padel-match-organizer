-- Import automatico contatti Google "padel" → anagrafica: routine GIORNALIERA che
-- chiama l'edge function google-contacts-import in modalità apply (percorso cron:
-- sesso "strict" NA quando incerto + email di riepilogo). L'import in PROD entra
-- senza revisione umana (filtro anti-spazzatura + NA sui dubbi); su TEST resta manuale.
-- Riusa i vault secret della routine dati (pmo_data_routine_*) e l'header
-- x-pmo-routine-secret, come pmo_dispatch_ai_lexicon_proposals.
--
-- ⚠️ Il body DEVE contenere mode:'apply': l'edge default è preview e la routine con
--    preview riceve ROUTINE_APPLY_ONLY (vedi handler google-contacts-import/index.ts).

create or replace function public.pmo_dispatch_google_contacts_import()
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
    return jsonb_build_object('ok', false, 'error', 'PMO_GOOGLE_CONTACTS_VAULT_SECRET_MISSING');
  end if;

  select net.http_post(
    url     := rtrim(v_project_url, '/') || '/functions/v1/google-contacts-import',
    headers := jsonb_build_object(
      'Content-Type',         'application/json',
      'apikey',               v_publishable_key,
      'Authorization',        'Bearer ' || v_publishable_key,
      'x-pmo-routine-secret', v_secret
    ),
    body    := jsonb_build_object('mode', 'apply', 'source', 'pmo_contacts_scheduler'),
    timeout_milliseconds := 120000
  ) into v_request_id;

  return jsonb_build_object('ok', true, 'requestId', v_request_id, 'dispatchedAt', now());
end;
$function$;

-- La funzione dispatcher è innocua su entrambi gli ambienti (nulla parte senza schedule).
-- Lo SCHEDULE si crea SOLO in PROD, a mano nel SQL editor (NON committato/eseguito qui).
-- pg_cron gira in UTC e non segue il DST: la finestra è ~03:15–05:15 Europe/Rome.
-- Un job notturno non è sensibile al minuto esatto; usare un orario di prima mattina.
--
-- PROD (una volta sola, SQL editor di qqbfphyslczzkxoncgex):
--   select cron.schedule('pmo-google-contacts-import-prod', '15 3 * * *',
--     $$ select public.pmo_dispatch_google_contacts_import(); $$);   -- ~04:15 CET / 05:15 CEST
--
-- Per rimuovere/riprogrammare:
--   select cron.unschedule('pmo-google-contacts-import-prod');
--
-- TEST resta MANUALE (pulsante nell'app): NON creare lo schedule su cudiqnrrlbyqryrtaprd.
