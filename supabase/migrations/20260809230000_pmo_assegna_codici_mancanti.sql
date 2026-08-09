-- 🆔 L'ID giocatore Padel Village lo assegna il DATABASE, non il browser.
--
-- 🚨🚨⭐⭐ Perché esiste (9/08/2026). Fino a oggi il codice lo coniava l'app, con
-- `nextPmoPlayerId()`: massimo dei soci **in memoria del browser**, più uno. Il commento
-- nel codice lo dava per un limite accettabile («due postazioni nello stesso momento»),
-- ma il guasto era più largo: **non serve la contemporaneità**. Basta che la postazione
-- abbia una copia INCOMPLETA dell'anagrafica perché il massimo letto sia basso e il codice
-- «nuovo» sia già di qualcun altro. In silenzio.
--
-- 📏 Misurato su PROD: **24 codici finiti a 48 persone**, e la cosa è emersa solo perché il
-- bot Telegram non riconosceva la prima socia vera invitata — il ponte trovava due schede e
-- si rifiutava di servirne una a caso. Tre schede salvate il 9/08 avevano preso
-- `PMO-001050 · 001051 · 001052`, tre numeri consecutivi in MEZZO alla numerazione, mentre
-- il massimo vero era 2837.
--
-- ⛔ Non era riparabile lato app: l'informazione non c'è. Il codice che collide appartiene
--    per definizione a un socio che quella postazione non ha in memoria.
-- ⇒ L'app smette di coniare (il campo resta vuoto) e il numero lo dà questa funzione, che
--   gira dove i soci si vedono tutti insieme e in una transazione sola.
--
-- ⭐ Idempotente: chi ha già un codice non viene toccato. Rilanciarla assegna 0.
-- 🚨 Chi NON ha telefono resta senza codice, di proposito: sono utenze di servizio
--    (Ospite, Demo App, Tennis App), non persone. È la regola del 2/08/2026.

create or replace function public.pmo_assegna_codici_mancanti()
returns table(assegnati int, saltati_senza_telefono int, massimo_dopo int)
language plpgsql
security definer
set search_path = public
as $$
declare n int; base int;
begin
  select coalesce(max((substring(payload->>'pmoPlayerId' from 5))::int), 0) into base
    from pmo_cloud_records
   where record_type='member' and deleted is not true
     and payload->>'pmoPlayerId' ~ '^PMO-[0-9]{6}$';

  with cand as (
    select id, row_number() over (order by created_at, id) rn
      from pmo_cloud_records
     where record_type='member' and deleted is not true
       and coalesce(payload->>'pmoPlayerId','') = ''
       and length(regexp_replace(coalesce(payload->>'phone',''),'\D','','g')) >= 8)
  update pmo_cloud_records p
     set payload = p.payload || jsonb_build_object(
           'pmoPlayerId', 'PMO-'||lpad((base + c.rn)::text, 6, '0'),
           'updatedAt', to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
         updated_at = now()
    from cand c where p.id = c.id;
  get diagnostics n = row_count;

  return query
  select n,
         (select count(*)::int from pmo_cloud_records
           where record_type='member' and deleted is not true
             and coalesce(payload->>'pmoPlayerId','')=''),
         (select coalesce(max((substring(payload->>'pmoPlayerId' from 5))::int),0)::int
            from pmo_cloud_records
           where record_type='member' and deleted is not true
             and payload->>'pmoPlayerId' ~ '^PMO-[0-9]{6}$');
end $$;

revoke all on function public.pmo_assegna_codici_mancanti() from public, anon, authenticated;

comment on function public.pmo_assegna_codici_mancanti() is
  'Assegna l''ID giocatore Padel Village a chi non ce l''ha, col massimo VERO del database. Sostituisce il conio lato browser, che il 9/08/2026 aveva dato 24 codici a 48 persone. Chi non ha telefono resta senza (utenze di servizio).';
