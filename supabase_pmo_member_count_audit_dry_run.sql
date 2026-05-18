-- Padel Match Organizer - dry-run read-only conteggi soci
-- File preparatorio TEST-first: non applica cleanup e non modifica record.
-- Da usare solo dopo approvazione esplicita della lista candidata.

create or replace function public.pmo_member_count_audit_dry_run_admin()
returns table (
  local_key text,
  member_id text,
  full_name text,
  email text,
  phone text,
  source_label text,
  updated_at timestamptz,
  is_deleted boolean,
  is_active boolean,
  is_technical boolean,
  is_matchpoint boolean,
  matched_local_key text,
  classification text,
  suggested_action text,
  risk text,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
begin
  select * into v_actor
  from public.pmo_current_staff_profile()
  limit 1;

  if not found then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.pmo_staff_permission_ok(v_actor.role, v_actor.permissions, 'cloud_sync') then
    raise exception 'PERMISSION_DENIED';
  end if;

  return query
  with base as (
    select
      r.local_key,
      r.payload,
      r.deleted as record_deleted,
      r.updated_at,
      coalesce(nullif(trim(r.payload->>'memberId'), ''), nullif(trim(r.payload->>'pmoId'), ''), '') as member_id,
      coalesce(
        nullif(trim(r.payload->>'name'), ''),
        nullif(trim(concat_ws(' ', r.payload->>'firstName', r.payload->>'surname')), ''),
        nullif(trim(concat_ws(' ', r.payload->>'nome', r.payload->>'cognome')), ''),
        '-'
      ) as full_name,
      lower(trim(coalesce(r.payload->>'email', r.payload->>'mail', ''))) as email,
      trim(coalesce(r.payload->>'phone', r.payload->>'telefono', r.payload->>'mobile', r.payload->>'cellulare', '')) as phone,
      regexp_replace(coalesce(r.payload->>'phone', r.payload->>'telefono', r.payload->>'mobile', r.payload->>'cellulare', ''), '[^0-9]', '', 'g') as phone_digits,
      lower(concat_ws(' ',
        r.payload->>'source',
        r.payload->>'matchpointSource',
        r.payload->>'origin',
        r.payload->>'importSource',
        r.payload->>'createdFrom'
      )) as source_text,
      coalesce(
        nullif(trim(r.payload->>'source'), ''),
        nullif(trim(r.payload->>'matchpointSource'), ''),
        nullif(trim(r.payload->>'origin'), ''),
        nullif(trim(r.payload->>'importSource'), ''),
        '-'
      ) as source_label
    from public.pmo_cloud_records r
    where r.record_type = 'member'
  ),
  enriched as (
    select
      b.*,
      lower(regexp_replace(b.full_name, '[[:space:]]+', ' ', 'g')) as full_name_key,
      (b.record_deleted or b.payload ? 'deletedAt') as is_deleted,
      (
        not b.record_deleted
        and not (b.payload ? 'deletedAt')
        and coalesce(nullif(lower(trim(b.payload->>'active')), ''), 'true') not in ('false', '0', 'no', 'inactive', 'deleted')
      ) as is_active,
      (lower(regexp_replace(b.full_name, '[[:space:]]+', ' ', 'g')) in ('padel village', 'tennisup', 'tennis up', 'tennis app')) as is_technical,
      (
        b.source_text like '%matchpoint%' or
        b.payload ? 'matchpointImportedAt' or
        b.payload ? 'matchpointLastImportedAt' or
        b.payload ? 'matchpointClientId' or
        b.payload ? 'matchpointCode'
      ) as is_matchpoint
    from base b
  ),
  matchpoint_rows as (
    select *
    from enriched
    where is_active and is_matchpoint
  ),
  maurizio_rows as (
    select *
    from enriched
    where full_name_key like '%maurizio%'
      and full_name_key like '%aprea%'
  ),
  classified as (
    select
      e.*,
      coalesce(twin.local_key, maurizio_twin.local_key) as matched_local_key,
      coalesce(twin.full_name_key, maurizio_twin.full_name_key) as matched_full_name_key,
      twin.local_key as matchpoint_matched_local_key
    from enriched e
    left join lateral (
      select mp.local_key, mp.full_name_key
      from matchpoint_rows mp
      where mp.local_key <> e.local_key
        and e.is_active
        and not e.is_matchpoint
        and (
          (e.member_id <> '' and mp.member_id = e.member_id) or
          (e.email <> '' and mp.email = e.email) or
          (e.phone_digits <> '' and mp.phone_digits = e.phone_digits)
        )
      order by
        case when e.member_id <> '' and mp.member_id = e.member_id then 0 else 1 end,
        case when e.email <> '' and mp.email = e.email then 0 else 1 end,
        case when e.phone_digits <> '' and mp.phone_digits = e.phone_digits then 0 else 1 end,
        mp.updated_at desc
      limit 1
    ) twin on true
    left join lateral (
      select mr.local_key, mr.full_name_key
      from maurizio_rows mr
      where mr.local_key <> e.local_key
        and e.is_active
        and (
          (e.member_id <> '' and mr.member_id = e.member_id) or
          (e.email <> '' and mr.email = e.email) or
          (e.phone_digits <> '' and mr.phone_digits = e.phone_digits)
        )
      order by
        case when e.member_id <> '' and mr.member_id = e.member_id then 0 else 1 end,
        case when e.email <> '' and mr.email = e.email then 0 else 1 end,
        case when e.phone_digits <> '' and mr.phone_digits = e.phone_digits then 0 else 1 end,
        mr.updated_at desc
      limit 1
    ) maurizio_twin on true
  )
  select
    c.local_key,
    c.member_id,
    c.full_name,
    c.email,
    c.phone,
    c.source_label,
    c.updated_at,
    c.is_deleted,
    c.is_active,
    c.is_technical,
    c.is_matchpoint,
    coalesce(c.matched_local_key, '') as matched_local_key,
    case
      when c.is_deleted
        and c.member_id = 'PMO-000948'
        and c.email = 'aprea.maurizio@gmail.com'
        and c.full_name_key like '%maurizio%'
        and c.full_name_key like '%aprea%' then 'approved_restore'
      when c.is_deleted then 'deleted'
      when c.member_id = 'PMO-000948'
        and c.email = 'aprea.maurizio@gmail.com'
        and c.full_name_key like '%test%'
        and c.full_name_key like '%autovalutaz%' then 'approved_soft_delete'
      when c.member_id = 'PMO-000948'
        and c.email = 'aprea.maurizio@gmail.com'
        and c.full_name_key like '%maurizio%'
        and c.full_name_key like '%aprea%' then 'keep_non_matchpoint'
      when c.is_technical and not c.is_matchpoint and c.full_name_key in ('tennisup', 'tennis up', 'tennis app') then 'approved_soft_delete'
      when not c.is_matchpoint
        and c.full_name_key like '%test%'
        and c.full_name_key like '%autovalutaz%'
        and coalesce(c.matched_full_name_key, '') like '%maurizio%'
        and coalesce(c.matched_full_name_key, '') like '%aprea%' then 'approved_soft_delete'
      when c.is_technical then case when c.is_matchpoint then 'keep_matchpoint' else 'technical_excluded' end
      when c.is_matchpoint then 'keep_matchpoint'
      when c.matchpoint_matched_local_key is not null then 'candidate_soft_delete'
      else 'keep_non_matchpoint'
    end as classification,
    case
      when c.is_deleted
        and c.member_id = 'PMO-000948'
        and c.email = 'aprea.maurizio@gmail.com'
        and c.full_name_key like '%maurizio%'
        and c.full_name_key like '%aprea%' then 'Ripristino approvato'
      when c.is_deleted then 'Gia soft-delete'
      when c.member_id = 'PMO-000948'
        and c.email = 'aprea.maurizio@gmail.com'
        and c.full_name_key like '%test%'
        and c.full_name_key like '%autovalutaz%' then 'Soft-delete approvato'
      when c.member_id = 'PMO-000948'
        and c.email = 'aprea.maurizio@gmail.com'
        and c.full_name_key like '%maurizio%'
        and c.full_name_key like '%aprea%' then 'Mantenere Maurizio Aprea'
      when c.is_technical and not c.is_matchpoint and c.full_name_key in ('tennisup', 'tennis up', 'tennis app') then 'Soft-delete approvato'
      when not c.is_matchpoint
        and c.full_name_key like '%test%'
        and c.full_name_key like '%autovalutaz%'
        and coalesce(c.matched_full_name_key, '') like '%maurizio%'
        and coalesce(c.matched_full_name_key, '') like '%aprea%' then 'Soft-delete approvato'
      when c.is_technical then case when c.is_matchpoint then 'Mantenere in Matchpoint' else 'Escludere dalla UI' end
      when c.is_matchpoint then 'Mantenere'
      when c.matchpoint_matched_local_key is not null then 'Verifica manuale per soft-delete'
      else 'Mantenere o verificare'
    end as suggested_action,
    case
      when c.is_deleted
        and c.member_id = 'PMO-000948'
        and c.email = 'aprea.maurizio@gmail.com'
        and c.full_name_key like '%maurizio%'
        and c.full_name_key like '%aprea%' then 'Basso'
      when c.is_deleted or c.is_matchpoint then 'Basso'
      when c.member_id = 'PMO-000948'
        and c.email = 'aprea.maurizio@gmail.com'
        and c.full_name_key like '%test%'
        and c.full_name_key like '%autovalutaz%' then 'Medio'
      when c.member_id = 'PMO-000948' and c.email = 'aprea.maurizio@gmail.com' then 'Basso'
      when c.is_technical and not c.is_matchpoint and c.full_name_key in ('tennisup', 'tennis up', 'tennis app') then 'Basso'
      when not c.is_matchpoint
        and c.full_name_key like '%test%'
        and c.full_name_key like '%autovalutaz%'
        and coalesce(c.matched_full_name_key, '') like '%maurizio%'
        and coalesce(c.matched_full_name_key, '') like '%aprea%' then 'Medio'
      when c.is_technical then 'Basso'
      when c.matchpoint_matched_local_key is not null and (c.email <> '' or c.phone_digits <> '') then 'Medio'
      when c.matchpoint_matched_local_key is not null then 'Alto'
      when c.email = '' and c.phone_digits = '' and c.member_id = '' then 'Medio'
      else 'Basso'
    end as risk,
    case
      when c.is_deleted
        and c.member_id = 'PMO-000948'
        and c.email = 'aprea.maurizio@gmail.com'
        and c.full_name_key like '%maurizio%'
        and c.full_name_key like '%aprea%' then 'Decisione Maurizio: tenere Maurizio Aprea come scheda ufficiale PMO-000948; il record va ripristinato se era finito in soft-delete.'
      when c.is_deleted then 'Record gia marcato deleted o payload con deletedAt.'
      when c.member_id = 'PMO-000948'
        and c.email = 'aprea.maurizio@gmail.com'
        and c.full_name_key like '%test%'
        and c.full_name_key like '%autovalutaz%' then 'Decisione Maurizio: record Test Maurizio Autovalutazione duplicato della scheda Maurizio Aprea; tenere Maurizio Aprea.'
      when c.member_id = 'PMO-000948'
        and c.email = 'aprea.maurizio@gmail.com'
        and c.full_name_key like '%maurizio%'
        and c.full_name_key like '%aprea%' then 'Scheda Maurizio Aprea preservata come record ufficiale PMO-000948.'
      when c.is_technical and not c.is_matchpoint and c.full_name_key in ('tennisup', 'tennis up', 'tennis app') then 'Decisione Maurizio: record tecnico Tennis Up/App da rimuovere dalla base soci app; resta disponibile solo la sorgente Matchpoint.'
      when not c.is_matchpoint
        and c.full_name_key like '%test%'
        and c.full_name_key like '%autovalutaz%'
        and coalesce(c.matched_full_name_key, '') like '%maurizio%'
        and coalesce(c.matched_full_name_key, '') like '%aprea%' then 'Decisione Maurizio: record Test di autovalutazione duplicato di Maurizio Aprea; tenere la scheda Maurizio Aprea.'
      when c.is_technical then case when c.is_matchpoint then 'Record tecnico Matchpoint mantenuto come sorgente Matchpoint.' else 'Record tecnico riconosciuto: non va contato in Dashboard.' end
      when c.is_matchpoint then 'Record Matchpoint attivo o sorgente Matchpoint riconosciuta.'
      when c.matchpoint_matched_local_key is not null then 'Possibile gemello Matchpoint su PMO, email o telefono. Serve approvazione manuale prima del soft-delete.'
      else 'Socio non Matchpoint senza gemello Matchpoint trovato: non cancellare automaticamente.'
    end as reason
  from classified c
  order by
    case
      when c.is_deleted
        and c.member_id = 'PMO-000948'
        and c.email = 'aprea.maurizio@gmail.com'
        and c.full_name_key like '%maurizio%'
        and c.full_name_key like '%aprea%' then 0
      when (
        c.is_technical and not c.is_matchpoint and c.full_name_key in ('tennisup', 'tennis up', 'tennis app')
      ) or (
        c.member_id = 'PMO-000948'
        and c.email = 'aprea.maurizio@gmail.com'
        and c.full_name_key like '%test%'
        and c.full_name_key like '%autovalutaz%'
      ) or (
        not c.is_matchpoint
        and c.full_name_key like '%test%'
        and c.full_name_key like '%autovalutaz%'
        and coalesce(c.matched_full_name_key, '') like '%maurizio%'
        and coalesce(c.matched_full_name_key, '') like '%aprea%'
      ) then 0
      when c.is_deleted then 5
      when c.is_technical then 4
      when c.matchpoint_matched_local_key is not null then 2
      when not c.is_matchpoint then 3
      else 5
    end,
    c.updated_at desc,
    c.local_key;
end;
$$;

revoke all on function public.pmo_member_count_audit_dry_run_admin() from public;
revoke all on function public.pmo_member_count_audit_dry_run_admin() from anon;
grant execute on function public.pmo_member_count_audit_dry_run_admin() to authenticated;
