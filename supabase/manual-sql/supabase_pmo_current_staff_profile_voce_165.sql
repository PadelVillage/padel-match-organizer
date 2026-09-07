-- ═══════════════════════════════════════════════════════════════════════════════
-- VOCE 165 — «OGNI LETTURA DELLO STAFF È ANCHE UNA SCRITTURA»
-- Applicata il 07/09/2026 su TEST (cudi…) e PROD (qqbf…).
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- IL DIFETTO. `pmo_current_staff_profile()` è la guardia dei permessi: ci passano 17 RPC
-- dello staff, e scriveva `last_seen_at = now()` a OGNI chiamata. Non è un battito da
-- allungare — è proporzionale a quanto si usa il gestionale, quindi cresce proprio quando
-- il database è sotto sforzo. È la stessa forma della voce 162.
--
-- LA CURA. Si scrive solo se `last_seen_at` è più vecchio di 5 minuti; altrimenti si LEGGE.
-- `last_seen_at` è mostrato in UN solo posto (colonna «ultimo accesso» in amministrazione,
-- index.html:31367): una granularità di 5 minuti lì non la nota nessuno.
--
-- ⚖️ IL PEZZO CHE RENDE LA CURA SICURA: il ramo di lettura ③ usa lo STESSO IDENTICO
-- predicato dell'update ② che sostituisce. Saltare la scrittura non può quindi restituire
-- una riga diversa da quella che si sarebbe scritta. La rete di sicurezza ④ (per email O
-- per uid) è preesistente e non è stata toccata.
--
-- 📏 PROVATA, e in tutti e due i versi:
--   · TEST — 2 giri di console interi (login + decine di RPC + 6 chiamate esplicite)
--     ⇒ UN SOLO aggiornamento; ruolo e 16 permessi intatti in tutte le risposte;
--     e col campo riportato indietro di 30 minuti il ramo «vecchio» SCRIVE (12:24:42 → 12:55:00).
--   · PROD — 6 chiamate, tutte http 200, ruolo `staff`, 15 permessi, `last_seen_at`
--     identico in tutte e sei (scritto una volta alle 12:57:09, poi mai).
--
-- 🚨 E LA TRAPPOLA DA NON RIPETERE, se un domani si rimisura: uno ZERO di aggiornamenti
-- non prova che la cura funzioni — una funzione che va in eccezione produce lo stesso zero.
-- Va SEMPRE verificato che la guardia RISPONDA (ruolo + permessi), non solo che non scriva.
--
-- ↩️  PER TORNARE INDIETRO: rimettere la sola riga
--       and (p.last_seen_at is null or p.last_seen_at < now() - interval '5 minutes')
--     e il blocco ③, cioè riportare l'update ② a scrivere sempre. Nient'altro è cambiato:
--     ①, ④ e la `return query` sono identici a prima (impronta normalizzata della versione
--     precedente su TEST e PROD: f24b6cd06d651b2f334c2bffee714b19).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.pmo_current_staff_profile()
 RETURNS TABLE(id uuid, auth_user_id uuid, email text, full_name text, role text, status text, permissions jsonb, last_seen_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(nullif(trim(coalesce(auth.jwt()->>'email', '')), ''));
  v_profile public.pmo_staff_profiles%rowtype;
begin
  if v_uid is null or v_email is null then
    return;
  end if;

  -- ① primo accesso: il profilo non è ancora legato all'utenza. Qui si SCRIVE sempre.
  update public.pmo_staff_profiles p
     set auth_user_id = v_uid,
         status       = case when p.status = 'invited' then 'active' else p.status end,
         activated_at = coalesce(p.activated_at, now()),
         last_seen_at = now()
   where p.auth_user_id is null
     and p.email = v_email
     and p.status in ('invited', 'active')
   returning * into v_profile;

  if not found then
    -- ② profilo già legato: si scrive SOLO se l'ultimo accesso è vecchio.
    update public.pmo_staff_profiles p
       set last_seen_at = now()
     where p.auth_user_id = v_uid
       and p.email = v_email
       and p.status = 'active'
       and (p.last_seen_at is null or p.last_seen_at < now() - interval '5 minutes')
     returning * into v_profile;

    if not found then
      -- ③ già fresco (o niente da scrivere): si legge, con lo STESSO predicato del ②.
      select * into v_profile
        from public.pmo_staff_profiles p
       where p.auth_user_id = v_uid
         and p.email = v_email
         and p.status = 'active';
    end if;
  end if;

  -- ④ rete di sicurezza preesistente: profilo raggiungibile per email O per uid.
  if not found and v_profile.id is null then
    select * into v_profile
      from public.pmo_staff_profiles p
     where (p.auth_user_id = v_uid or p.email = v_email)
       and p.status = 'active'
     limit 1;
  end if;

  if v_profile.id is null or v_profile.status <> 'active' then
    return;
  end if;

  return query
  select v_profile.id,
         v_profile.auth_user_id,
         v_profile.email,
         v_profile.full_name,
         v_profile.role,
         v_profile.status,
         v_profile.permissions,
         v_profile.last_seen_at,
         v_profile.updated_at;
end;
$function$;
