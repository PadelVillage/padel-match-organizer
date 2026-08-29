-- 🆕 29/08/2026 (voce 108, seguito) — UNA SPINTA A VUOTO DEVE DIRE COSA PORTAVA.
--
-- 📌 NON e' una voce nuova, ed e' deliberato: le 67 spinte a vuoto sono la domanda che la
--    scheda della 108 lascia aperta. La delega copre l'ORDINE delle voci, non la loro
--    ESISTENZA ⇒ questo lavoro si attacca alla 108, non si numera da se'.
--
-- 📏 IL FATTO, misurato sul registro di PROD: dal 15 al 29 agosto **67 spinte su 411** hanno
--    scritto ZERO record. Una su sei, tutti i giorni, quasi tutte dalla segreteria.
--
-- 🚨 E la domanda NON SI PUÒ CHIUDERE dal registro, perché il registro annota il RISULTATO e
--    non l'OGGETTO: `pmo_audit_log` scrive `{count: 0}` e basta ⇒ di quelle 67 non si sa cosa
--    portassero. È la trappola ③ del 29/08: *chi scrive una diagnostica scelga cosa servirà a
--    chi la leggerà tra un mese.*
--
-- ⛔ LE DUE PISTE DEL 29/08 SONO CADUTE TUTTE E DUE, e questa cura nasce da lì:
--    ② «un tipo fuori whitelist»: dei sette che mancavano alla lista, l'app ne scrive UNO SOLO
--      (`payment`, dal percorso omaggi) — gli altri sei non compaiono in `index.html` se non in
--      lettura. E l'omaggio non l'ha mai fatto nessuno: su 3014 pagamenti in tre mesi non c'è
--      **nessuna** riga a 0 €. ⇒ la whitelist NON può spiegare le 67.
--    ① «`local_key` vuota»: tutti i punti che spingono la costruiscono o la sorvegliano — i 12
--      siti `staff_booking` filtrano su `b.id`, `pmoAddCloudRecord` rifiuta la chiave vuota,
--      `pmoBuildMemberCloudRecord` e `pmoBuildAppSettingCloudRecord` tornano `null` senza chiave,
--      e `pmoSyncCloudRecordsNow` esce prima di chiamare se il lotto è vuoto.
--      ⇒ nessuna strada NOTA sa costruire un record senza chiave.
--
-- ⇒ La causa resta IGNOTA, ed è per questo che si cura il REGISTRO invece di indovinare un ramo:
--   è la stessa forma della voce 108 — *una perdita silenziosa non si cura indovinando, si cura
--   rendendola rumorosa*. Dalla prossima spinta a vuoto, il registro dice da sé quale delle tre
--   regole di scarto è scattata, e su quale tipo.
--
-- ⚖️ COSA CAMBIA E COSA NO, dichiarato:
--   · il comportamento della RPC **non cambia di una riga**: stessi scarti, stesso `count`,
--     stessa risposta. Cambia solo cosa viene ANNOTATO;
--   · l'arricchimento scatta **solo quando `v_count = 0`**. Le spinte riuscite continuano a
--     scrivere `{count: N}` identico a prima ⇒ il registro non si gonfia e nessuna sonda
--     esistente cambia lettura;
--   · si annotano **nomi di tipo e conteggi**, mai un payload: nel registro non entra nessun
--     dato di nessun socio.
--
-- 🔎 Serve anche dove l'avviso della 108 NON arriverebbe: `_pmoGiftSyncFromRoster` si chiude
--    con `catch (e) { return 0; }` e inghiottirebbe l'errore. Il registro no.

create or replace function public.pmo_upsert_records_admin(p_records jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor record;
  v_count integer := 0;
  v_diagnostica jsonb := '{}'::jsonb;
begin
  select * into v_actor
    from public.pmo_current_staff_profile()
    limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;
  if not public.pmo_staff_permission_ok(v_actor.role, v_actor.permissions, 'cloud_sync') then
    return jsonb_build_object('ok', false, 'error', 'PERMISSION_DENIED');
  end if;

  if p_records is null or jsonb_typeof(p_records) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_RECORDS_PAYLOAD');
  end if;

  with incoming as (
    select
      item.ord as ord,
      nullif(trim(item.value->>'record_type'), '') as record_type,
      nullif(trim(item.value->>'local_key'), '') as local_key,
      coalesce(item.value->'payload', '{}'::jsonb) as payload,
      coalesce((item.value->>'deleted')::boolean, false) as deleted
    from jsonb_array_elements(p_records) with ordinality as item(value, ord)
  ),
  valid as (
    select *
    from incoming
    where record_type is not null
      and local_key is not null
      and record_type in (
        'member',
        'booking',
        'booking_occupancy',
        'booking_history',
        'player_group',
        'match_invitation',
        'fill_slot_created_match',
        'fill_slot_player_request',
        'guided_invite_session',
        'whatsapp_message_history',
        'whatsapp_message_template',
        'matchpoint_data',
        'app_setting',
        'staff_booking',
        'staff_suppress',
        -- 🆕 29/08/2026 (voce 109) — I PAGAMENTI. Il vincolo della TABELLA li accetta dal
        -- 27/06, e da allora l'app li scrive: gli omaggi (`source: 'pmo_gift'`) che la
        -- segreteria registra dalla scheda partita. Ma questa lista, che è una SECONDA lista,
        -- non è mai stata allineata ⇒ ogni omaggio veniva scartato QUI, in silenzio, e la RPC
        -- rispondeva `ok: true` con `count: 0`.
        'payment'
      )
  ),
  ids_in_arrivo as (
    select distinct nullif(payload->>'id', '') as member_id
    from valid
    where record_type = 'member'
      and nullif(payload->>'id', '') is not null
  ),
  riga_viva as (
    select r.payload->>'id' as member_id, min(r.local_key) as local_key
    from public.pmo_cloud_records r
    join ids_in_arrivo i on i.member_id = r.payload->>'id'
    where r.record_type = 'member'
      and r.deleted = false
    group by 1
    having count(*) = 1
  ),
  mirato as (
    select
      v.ord,
      v.record_type,
      case when v.record_type = 'member' then coalesce(rv.local_key, v.local_key)
           else v.local_key end as local_key,
      v.payload,
      v.deleted
    from valid v
    left join riga_viva rv
      on v.record_type = 'member'
     and rv.member_id = nullif(v.payload->>'id', '')
  ),
  da_scrivere as (
    select record_type, local_key, payload, deleted
    from mirato
    where record_type <> 'member'
    union all
    select record_type, local_key, payload, deleted
    from (
      select distinct on (local_key) record_type, local_key, payload, deleted
      from mirato
      where record_type = 'member'
      order by local_key, ord desc
    ) ultimo_del_lotto
  ),
  upserted as (
    insert into public.pmo_cloud_records (
      record_type,
      local_key,
      payload,
      payload_hash,
      deleted,
      synced_at
    )
    select
      record_type,
      local_key,
      payload,
      encode(extensions.digest(payload::text, 'sha256'), 'hex'),
      deleted,
      now()
    from da_scrivere
    on conflict (record_type, local_key) do update
      set payload = excluded.payload,
          payload_hash = excluded.payload_hash,
          deleted = excluded.deleted,
          synced_at = now()
    returning 1
  )
  select count(*) into v_count from upserted;

  -- 🆕 voce 108 (seguito) — SOLO quando non è passato NIENTE: si annota cosa portava il lotto, così la
  -- prossima spinta a vuoto si spiega da sé invece di lasciare un altro zero muto.
  -- ⚠️ Nomi di tipo e CONTEGGI, mai un payload: nel registro non entra nessun dato di nessuno.
  if v_count = 0 then
    with elementi as (
      select
        nullif(trim(e->>'record_type'), '') as tipo,
        nullif(trim(e->>'local_key'), '')   as chiave
      from jsonb_array_elements(p_records) as e
    ),
    per_tipo as (
      select coalesce(tipo, '(senza tipo)') as tipo, count(*) as n
      from elementi
      group by 1
    )
    select jsonb_build_object(
      'ricevuti',     (select count(*) from elementi),
      -- quale delle TRE regole di scarto e' scattata, contata una per una
      'senza_tipo',   (select count(*) from elementi where tipo is null),
      'senza_chiave', (select count(*) from elementi where chiave is null),
      'tipi',         coalesce((select jsonb_object_agg(tipo, n) from per_tipo), '{}'::jsonb)
    )
    into v_diagnostica;
    v_diagnostica := coalesce(v_diagnostica, '{}'::jsonb);
  end if;

  insert into public.pmo_audit_log (actor_user_id, actor_email, actor_role, action, detail)
  values (
    v_actor.auth_user_id,
    v_actor.email,
    v_actor.role,
    'cloud_records_upsert',
    jsonb_build_object('count', v_count) || v_diagnostica
  );

  return jsonb_build_object('ok', true, 'count', v_count);
end;
$function$;
