-- PMO — Pulizia della FOTOGRAFIA delle prenotazioni (`booking` · `booking_occupancy`)
-- Applicare su PROD (qqbf…) e su TEST (cudi…).
--
-- 🗣️ DECISIONE DEL COMMITTENTE, 05/09/2026, in tre messaggi:
--    «ricordati che i dati vecchi non ci servono quindi si possono buttare. a noi servono
--     sempre i dati freschi, quindi l'ultimo download dei dati»
--    «questo sia per quanto riguarda prod che per quanto riguarda test»
--    «come dati di storico io direi di non tenere più di 30 giorni»
--    «⚠️ attenzione a non cancellare le partite degli ultimi 30 giorni e quelle future»
--
-- 🚨⭐⭐ LA SUA ULTIMA RIGA HA CORRETTO UN DIFETTO VERO DI QUESTA BOZZA, e non era una
--    precisazione: la prima stesura buttava tutto ciò che aveva `deleted = true` **senza
--    guardare la data**. Fra quelle righe ci sono le lapidi delle partite **FUTURE annullate**
--    — data di domani, marcate cancellate — e sarebbero sparite. ⇒ Adesso il taglio è **solo
--    sulla data**: `< oggi − 30`. Chi è dentro i 30 giorni o nel futuro non si tocca, marcato
--    o no.
--    📌 *Un filtro su «è cancellato» non è un filtro su «è vecchio»: la prima domanda parla
--       dello stato della riga, la seconda del tempo, e solo la seconda era quella giusta.*
--
-- ✅ COSA RESTA, sempre: le partite degli ULTIMI 30 GIORNI e TUTTE quelle FUTURE.
--
-- 📏 PERCHÉ SERVE, misurato su PROD il 05/09 mentre il database era in affanno:
--    · `pmo_cloud_records` aveva **31.193 righe vive**, ma il giro di sync ne tocca **437**
--      (272 prenotazioni + 165 occupazioni, finestra 05/09 → 07/10). Tutto il resto sono
--      LAPIDI: righe di prenotazioni passate marcate `deleted = true` e mai tolte.
--    · quelle lapidi non le legge nessuno — `consumer-player-readmodel` chiede
--      `payload->>data >= oggi` e `deleted is not true` — ma pesano su tabella, indici e
--      autovacuum a ogni giro.
--
-- ⚖️ COSA NON TOCCA, e non è prudenza generica: solo `booking` e `booking_occupancy`, che sono
--    lo SPECCHIO dell'ultimo scarico da Matchpoint e si rifanno da soli al sync successivo.
--    Restano intatti `booking_history` (lo storico, da cui nascono gli incassi), `payment`,
--    `staff_booking` (le nostre copie locali, che hanno una loro riconciliazione), `member`.
--    📌 *Si butta ciò che il prossimo scarico ricostruirebbe, non ciò che nessuno riscriverebbe.*
--
-- 🚨 A LOTTI, e non in un colpo solo: una `delete` da trentamila righe su un database già in
--    affanno prende lock e genera un botto di WAL — cioè esattamente il male che stiamo curando.

create or replace function public.pmo_cleanup_booking_snapshot(
  p_grace_days int default 30,
  p_batch int default 2000,
  p_max_batches int default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cutoff date := (current_date - p_grace_days);
  v_tot int := 0;
  v_n int;
  v_giri int := 0;
begin
  loop
    v_giri := v_giri + 1;
    exit when v_giri > p_max_batches;

    with vittime as (
      select ctid
      from public.pmo_cloud_records
      where record_type in ('booking', 'booking_occupancy')
        -- 🚨 SOLO la data, e nient'altro. Niente `deleted = true`: una partita futura annullata
        --    è una lapide con data di domani, e va tenuta.
        -- ⛔ Una data illeggibile NON si butta: fallire CHIUSI, nel dubbio si tiene.
        and (payload->>'data') ~ '^\d{4}-\d{2}-\d{2}$'
        and (payload->>'data')::date < v_cutoff
      limit p_batch
    )
    delete from public.pmo_cloud_records r
    using vittime v
    where r.ctid = v.ctid;

    get diagnostics v_n = row_count;
    v_tot := v_tot + v_n;
    exit when v_n = 0;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'buttate', v_tot,
    'lotti', v_giri - 1,
    'primaDi', v_cutoff,
    'graceDays', p_grace_days,
    'finito', v_giri <= p_max_batches
  );
end;
$$;

revoke all on function public.pmo_cleanup_booking_snapshot(int, int, int) from public;
grant execute on function public.pmo_cleanup_booking_snapshot(int, int, int) to service_role;

-- Ogni notte alle 03:30 italiane (02:30 UTC d'estate): la finestra è dentro la PAUSA NOTTURNA
-- del sync (01:00-06:00), quindi non litiga con lui per le stesse righe.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'pmo-booking-snapshot-cleanup') then
    perform cron.unschedule('pmo-booking-snapshot-cleanup');
  end if;
  perform cron.schedule(
    'pmo-booking-snapshot-cleanup',
    '30 2 * * *',
    'select public.pmo_cleanup_booking_snapshot();'
  );
end $$;
