-- Ogni autovalutazione ricevuta arriva via email a padelvillage.club@gmail.com.
--
-- Chiesta dal committente il 9/08/2026: vuole leggere OGNI scheda — quelle che passano
-- e quelle che no — per poi darle in pasto a un agente. A differenza del controllo
-- maestri, qui il silenzio non è un esito buono: si manda sempre.
--
-- ⭐ Il guardiano sta sul DATABASE, non nell'app: guarda le righe nuove delle DUE
-- tabelle delle schede. Così copre il link personale, il link generico e — quando
-- arriverà — il bot Telegram, senza agganciare un canale per volta.
--
-- Riusa gli stessi vault secret e lo stesso header x-pmo-routine-secret delle altre
-- routine (pmo_dispatch_maestri_allineamento, pmo_dispatch_assessment_email_routines).

-- ── Memoria di quello che è già stato mandato ───────────────────────────────────
-- Una riga per scheda: la chiave primaria è la garanzia che la stessa scheda non
-- produca due email nemmeno se il cron parte due volte insieme.
--
-- 🚨 LE TABELLE DELLE SCHEDE SONO DUE, e la cosa è costata una prova per venire fuori:
--   • `self_assessments`            ← link PERSONALE (?t=token), il socio è già riconosciuto
--   • `assessment_external_requests` ← link GENERICO (?assessment=link-esterno), chi non è socio
-- Guardarne una sola voleva dire che metà delle schede non avrebbe mai prodotto un'email.
-- Da qui la chiave con il prefisso: `sa:<token>` oppure `ext:<request_code>`.
create table if not exists public.pmo_assessment_notifications (
  chiave        text primary key,
  notified_at   timestamptz not null default now(),
  email_id      text,
  destinatario  text,
  nota          text
);

comment on table public.pmo_assessment_notifications is
  'Autovalutazioni già segnalate allo staff via email (assessment-notify-staff). Chiave: sa:<token> o ext:<request_code>.';

alter table public.pmo_assessment_notifications enable row level security;
-- Nessuna policy: ci arriva solo la service role dell''edge function, che RLS non la
-- guarda. Il gestionale non ha motivo di leggere questa tabella.

-- 🚨 IL PEZZO PERICOLOSO: senza queste righe, la prima passata manderebbe un'email per
-- OGNI autovalutazione mai ricevuta (centinaia). Lo storico entra già marcato come
-- «preesistente», così il guardiano nasce guardando solo in avanti.
insert into public.pmo_assessment_notifications (chiave, notified_at, nota)
select 'sa:' || token, now(), 'preesistente all''accensione: email non inviata'
from public.self_assessments
on conflict (chiave) do nothing;

insert into public.pmo_assessment_notifications (chiave, notified_at, nota)
select 'ext:' || request_code, now(), 'preesistente all''accensione: email non inviata'
from public.assessment_external_requests
where coalesce(request_code, '') <> ''
on conflict (chiave) do nothing;

-- ── Il lanciatore ───────────────────────────────────────────────────────────────
create or replace function public.pmo_dispatch_assessment_notify()
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
    return jsonb_build_object('ok', false, 'error', 'PMO_ASSESSMENT_NOTIFY_VAULT_SECRET_MISSING');
  end if;

  select net.http_post(
    url     := rtrim(v_project_url, '/') || '/functions/v1/assessment-notify-staff',
    headers := jsonb_build_object(
      'Content-Type',         'application/json',
      'apikey',               v_publishable_key,
      'Authorization',        'Bearer ' || v_publishable_key,
      'x-pmo-routine-secret', v_secret
    ),
    body    := jsonb_build_object('source', 'pmo_assessment_notify_scheduler'),
    timeout_milliseconds := 120000
  ) into v_request_id;

  return jsonb_build_object('ok', true, 'requestId', v_request_id, 'dispatchedAt', now());
end;
$function$;

-- Job ogni 5 minuti: una scheda compilata deve arrivare mentre il socio è ancora
-- al telefono con la segreteria, non il giorno dopo. Nome col suffisso ambiente.
--
-- TEST (si accende per primo):
--   select cron.schedule('pmo-assessment-notify-test', '*/5 * * * *', $$ select public.pmo_dispatch_assessment_notify(); $$);
-- PROD (solo dopo il collaudo su TEST e l''ok del committente):
--   select cron.schedule('pmo-assessment-notify-prod', '*/5 * * * *', $$ select public.pmo_dispatch_assessment_notify(); $$);
--
-- Prova del canale email (non legge le schede, non segna nulla come mandato):
--   select net.http_post(
--     url     := '<project_url>/functions/v1/assessment-notify-staff',
--     headers := jsonb_build_object('Content-Type','application/json','apikey','<key>','Authorization','Bearer <key>','x-pmo-routine-secret','<secret>'),
--     body    := jsonb_build_object('provaEmail', true)
--   );
--
-- Spegnere: select cron.unschedule('pmo-assessment-notify-test');
