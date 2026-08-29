-- VOCE 105 — LA CURA DEFINITIVA: chi scrive un socio finisce sulla RIGA VIVA, non su una chiave.
--
-- 🔎 IL DIFETTO. `pmo_upsert_records_admin` fa `on conflict (record_type, local_key)`: si fida
-- della chiave che arriva dal browser. Se quella chiave non è quella della riga viva di quel
-- socio, l'upsert non aggiorna niente — ne CREA un'altra, e se al suo posto c'era una riga
-- archiviata la RESUSCITA (`deleted` da true a false). È così che il 28/08 una modifica di livello
-- dalla segreteria ha sdoppiato Maurizio Aprea riportando in vita una riga del 19 luglio.
--
-- ⚖️ PERCHÉ SERVE ANCHE QUESTA, con la cura dell'app (v6.255) già in servizio. Quella insegna al
-- browser a portare la chiave giusta; questa toglie al browser il potere di sbagliarla. Copre il
-- caso che l'altra dichiara di NON coprire: la chiave STANTIA — il sync ri-chiava quel socio e
-- archivia la riga vecchia dopo l'ultima idratazione (finestra: i 10 minuti di throttle), e il
-- browser manda in buona fede un indirizzo che nel frattempo non esiste più.
-- 📌 *Una scrittura non deve poter inventare un'identità, e men che meno riportare in vita una
-- riga che qualcuno aveva archiviato.* Il posto dove questo si garantisce è il database, perché è
-- l'unico che sa qual è la riga viva ADESSO.
--
-- 🔨 COSA CAMBIA, in una riga: per i soli record `member`, se esiste UNA SOLA riga viva con lo
-- stesso `payload->>'id'`, si scrive su QUELLA — la `local_key` che arriva viene ignorata.
--
-- ⛔ E COSA NON CAMBIA, di proposito:
-- · **solo `member`**. Gli altri quattordici tipi passano identici: il difetto è misurato lì, e
--   per gli altri `payload.id` non è detto che sia un'identità. Allargare sarebbe una supposizione;
-- · **niente `id` in payload, o socio mai visto** ⇒ nessuna deviazione, si scrive dove chiede il
--   browser. È il caso del socio NUOVO, che deve poter nascere;
-- · **id ambiguo — due o più righe vive con lo stesso `id`** ⇒ NON si devia. Non è un caso di
--   scuola: su TEST c'è (`matchpoint_1at99i`, due righe `phone:` diverse). Davanti a due righe
--   vive non si indovina: si tiene il comportamento di oggi e si lascia il doppione a chi lo sa
--   sciogliere. 📌 *Una cura che sceglie a caso fra due identità fa il danno che vuole evitare.*
--
-- 🚨 LA TRAPPOLA CHE LA CURA STESSA CREA, e per cui c'è il `distinct on`. Deviando, due record in
-- arrivo che prima finivano su due chiavi diverse possono ora puntare allo STESSO posto — è
-- esattamente il browser che porta la riga viva `email:` e la gemella `phone:` nata per sbaglio.
-- Senza dedup, `on conflict do update` esplode («cannot affect row a second time») e fallisce
-- l'INTERO lotto: la cura trasformerebbe un doppione silenzioso in un salvataggio perduto. Vince
-- l'ULTIMO del lotto (`ord desc`), che è l'ordine in cui l'app li ha messi in fila.
-- ⛔ Il dedup vale SOLO per i `member`: per gli altri tipi un lotto con due chiavi uguali continua
-- a fallire come prima, perché non è questo il lavoro di questa cura.
--
-- ✅ PERCHÉ È SICURA VERSO IL SYNC: questa RPC la chiama **solo l'app** (`index.html`). Le edge —
-- `anagrafica-mirror` compresa, che è l'unica che ri-chiava i soci per mestiere — scrivono dritte
-- sulla tabella col ruolo di servizio e non passano di qui. ⇒ Un rinomino legittimo della chiave
-- non viene toccato da questa cura. Misurato prima di scriverla, non supposto.

create index if not exists idx_pmo_cloud_records_member_id
  on public.pmo_cloud_records ((payload->>'id'))
  where record_type = 'member' and deleted = false;

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
        'staff_suppress'
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
