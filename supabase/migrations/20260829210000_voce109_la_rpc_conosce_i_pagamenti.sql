-- VOCE 109 — LA RPC NON CONOSCEVA I PAGAMENTI, e li buttava via senza dirlo.
--
-- 🔎 IL DIFETTO, ed è una DERIVA fra due liste, non una scelta. Quali `record_type` si possono
-- scrivere è dichiarato in DUE posti che devono restare in passo e non lo sono:
--   ① il vincolo della TABELLA (`pmo_cloud_records_type_check`) — esteso nel tempo fino a
--      **22** tipi, `payment` compreso dal 27/06/2026 (migrazione che si chiama proprio
--      «payments»), poi `wallet_txn`, `wallet_balance`, `staff_edit`, `staff_cancel`;
--   ② la lista DENTRO `pmo_upsert_records_admin` — ferma a **15**, mai estesa.
-- ⇒ I sette tipi che stanno solo nella prima venivano scartati dalla seconda **in silenzio**:
-- la RPC risponde `ok: true` con `count: 0`, e fino a stasera l'app chiamante guardava `ok` e
-- non `count`. Nessuno se n'è accorto per due mesi.
--
-- 📏 MISURATO su PROD, non dedotto:
--   · `pmo_audit_log`, dal 15 al 29 agosto: **67 spinte su 411 hanno scritto ZERO record** —
--     una su sei;
--   · record `payment` nel cloud: **3032**, e di questi **ZERO** vengono dall'app
--     (`source = 'pmo_gift'` → 0, `method = 'gift'` → 0). I 3032 arrivano tutti dal sync dei
--     pagamenti, che usa la chiave di servizio e questa RPC non l'attraversa.
-- ⇒ **Ogni «quota offerta» che la segreteria ha registrato è andata perduta.** Sullo schermo
-- l'omaggio compariva subito (`_staffCalPaidIndexAdd` scrive l'indice locale «senza aspettare
-- la sync») e spariva al primo ricaricamento, perché l'indice si ricostruisce dal cloud.
--
-- 🔨 COSA CAMBIA: si aggiunge **`payment`**, e solo quello. Non si riallinea la lista intera al
-- vincolo della tabella, ed è una decisione del committente presa stasera: `wallet_txn` e
-- `wallet_balance` sono tipi che riguardano soldi e che **nessuno chiede** — l'app non li spinge
-- mai. ⚖️ *Una lista di permessi si allarga su un bisogno misurato, non per simmetria.*
--
-- 🔒 LA DERIVA NON PUÒ TORNARE IN SILENZIO: `test/i-tipi-che-lapp-scrive.test.mjs` estrae i
-- `record_type` che `index.html` spinge davvero e pretende che ognuno stia in TUTTE E DUE le
-- liste. Non pretende che le due liste siano uguali — non devono esserlo — ma che nessun tipo
-- usato dall'app cada nella fessura fra loro, che è esattamente il difetto di qui sopra.
--
-- ⚠️ Il resto del corpo è IDENTICO alla migrazione della voce 105 (la riga viva del socio):
-- si ricrea per intero perché `create or replace` vuole la funzione tutta, non una riga.

create or replace function public.pmo_upsert_records_admin(p_records jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_count integer := 0;
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
  -- Gli id dei soci toccati da QUESTO lotto: la ricerca della riga viva si fa solo su quelli.
  ids_in_arrivo as (
    select distinct nullif(payload->>'id', '') as member_id
    from valid
    where record_type = 'member'
      and nullif(payload->>'id', '') is not null
  ),
  -- La riga VIVA di ogni socio, e solo quando ce n'è UNA SOLA: `having count(*) = 1` è la
  -- clausola che si rifiuta di indovinare davanti a un id ambiguo.
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
  -- Un solo record per bersaglio, ma SOLO fra i member: vedi la nota sulla trappola, sopra.
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

  insert into public.pmo_audit_log (actor_user_id, actor_email, actor_role, action, detail)
  values (
    v_actor.auth_user_id,
    v_actor.email,
    v_actor.role,
    'cloud_records_upsert',
    jsonb_build_object('count', v_count)
  );

  return jsonb_build_object('ok', true, 'count', v_count);
end;
$$;
