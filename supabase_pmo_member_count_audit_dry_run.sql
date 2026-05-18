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
    where is_active and not is_technical and is_matchpoint
  ),
  classified as (
    select
      e.*,
      twin.local_key as matched_local_key
    from enriched e
    left join lateral (
      select mp.local_key
      from matchpoint_rows mp
      where mp.local_key <> e.local_key
        and e.is_active
        and not e.is_technical
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
      when c.is_deleted then 'deleted'
      when c.is_technical then 'technical_excluded'
      when c.is_matchpoint then 'keep_matchpoint'
      when c.matched_local_key is not null then 'candidate_soft_delete'
      else 'keep_non_matchpoint'
    end as classification,
    case
      when c.is_deleted then 'Gia soft-delete'
      when c.is_technical then 'Escludere dalla UI'
      when c.is_matchpoint then 'Mantenere'
      when c.matched_local_key is not null then 'Verifica manuale per soft-delete'
      else 'Mantenere o verificare'
    end as suggested_action,
    case
      when c.is_deleted or c.is_technical or c.is_matchpoint then 'Basso'
      when c.matched_local_key is not null and (c.email <> '' or c.phone_digits <> '') then 'Medio'
      when c.matched_local_key is not null then 'Alto'
      when c.email = '' and c.phone_digits = '' and c.member_id = '' then 'Medio'
      else 'Basso'
    end as risk,
    case
      when c.is_deleted then 'Record gia marcato deleted o payload con deletedAt.'
      when c.is_technical then 'Record tecnico riconosciuto: non va contato in Dashboard.'
      when c.is_matchpoint then 'Record Matchpoint attivo o sorgente Matchpoint riconosciuta.'
      when c.matched_local_key is not null then 'Possibile gemello Matchpoint su PMO, email o telefono. Serve approvazione manuale prima del soft-delete.'
      else 'Socio non Matchpoint senza gemello Matchpoint trovato: non cancellare automaticamente.'
    end as reason
  from classified c
  order by
    case
      when c.is_deleted then 4
      when c.is_technical then 3
      when c.matched_local_key is not null then 1
      when not c.is_matchpoint then 2
      else 5
    end,
    c.updated_at desc,
    c.local_key;
end;
$$;

revoke all on function public.pmo_member_count_audit_dry_run_admin() from public;
revoke all on function public.pmo_member_count_audit_dry_run_admin() from anon;
grant execute on function public.pmo_member_count_audit_dry_run_admin() to authenticated;
