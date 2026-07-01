-- Fix: paginazione instabile in pmo_get_records_admin_page.
--
-- Il client (pmoCloudRpcPaged) scarica TUTTI i record del calendario a pagine
-- sequenziali da 1000 (finestra di ~2-4s, e crescente col numero di record). La
-- ORDER BY precedente includeva `updated_at`, una colonna MUTABILE: ogni sync (o
-- azione staff cross-device) durante la finestra di paginazione riscrive
-- l'updated_at di molte righe booking_occupancy, spingendole in fondo all'ordine
-- MENTRE la lettura è a metà. Con l'offset che avanza, le righe scavalcate dal
-- cursore vengono SALTATE → una prenotazione attiva (es. la partita delle 19:30)
-- sparisce dall'occupazione dell'app e lo slot appare "Libero"/stantio. Sintomo:
-- app e Matchpoint "non si allineano" in modo intermittente e via via peggiore
-- man mano che i record crescono.
--
-- Il set di righe è identico; il client ri-ordina comunque lato suo per
-- data/ora/campo, quindi `updated_at` nell'ORDER BY non serviva ad altro se non a
-- destabilizzare la paginazione. Si ordina per la chiave IMMUTABILE e UNIVOCA
-- (record_type, local_key): l'offset resta stabile anche con update concorrenti.

CREATE OR REPLACE FUNCTION public.pmo_get_records_admin_page(
  p_record_types text[] DEFAULT NULL::text[],
  p_since timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(record_type text, local_key text, payload jsonb, deleted boolean, updated_at timestamp with time zone, synced_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_actor record;
  v_limit integer := greatest(1, least(coalesce(p_limit, 1000), 1000));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
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
    select
      r.record_type,
      r.local_key,
      r.payload,
      r.deleted,
      r.updated_at,
      r.synced_at
    from public.pmo_cloud_records r
    where (p_record_types is null or r.record_type = any(p_record_types))
      and (p_since is null or r.updated_at >= p_since)
    order by r.record_type, r.local_key   -- chiave immutabile+univoca: paginazione stabile
    limit v_limit
    offset v_offset;
end;
$function$;
