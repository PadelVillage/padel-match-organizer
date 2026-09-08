-- Voce 176 — LE FASCE PRENOTABILI DIVENTANO UNA TABELLA NOSTRA.
--
-- 🗣️ Richiesta del committente, 08/09/2026: «dobbiamo in test realizzare la tabella su cui basare
-- per gli utenti gli slot prenotabili» · «dobbiamo rifarla per conto nostro».
--
-- 📍 COSA SOSTITUISCE, e perché una tabella e non un'altra impostazione.
-- Fino a oggi la griglia degli orari è UNA RIGA di `pmo_cloud_records`
-- (`record_type='app_setting'`, `local_key='potentialSlotSchedule'`): un blocco jsonb con le sole
-- chiavi 0..6 del giorno della settimana, scritto a mano in una casella di testo in Amministrazione
-- e riempito dal bottone «Sincronizza da Matchpoint». ⇒ Niente vincoli, niente prezzo, e soprattutto
-- niente da cui il gestionale possa calcolare quanto deve un giocatore.
-- 🔌 Quel bottone muore col distacco (~27/09): `matchpoint-slot-schedule-sync` legge la pagina
-- «Sistema → Campi → Orari» dal worker, e senza Matchpoint non ha più da dove leggere.
-- ⇒ Da qui in poi le fasce sono **un dato nostro**, non una copia di qualcun altro.
--
-- ⚖️ LE DUE DECISIONI DEL COMMITTENTE, prese l'08/09 e scritte qui perché la tabella le incarna:
--   ① **una griglia sola per tutti i campi** — se il lunedì c'è la fascia 18:00-19:30, c'è su tutti
--      e quattro. ⇒ NESSUNA colonna `campo`: quale campo sia libero lo decide chi ha già prenotato,
--      non la griglia. Il giorno in cui i campi avessero orari diversi, questa tabella cresce di una
--      colonna e di un vincolo — non si riscrive.
--   ② **il prezzo sta sulla fascia, ed è QUELLO DI OGNI GIOCATORE** — non il costo del campo da
--      dividere. ⇒ Chi entra paga `prezzo_cents`, e l'importo di chi c'era già NON cambia. È la
--      differenza che decide cosa succede quando un quarto giocatore entra all'ultimo momento.
--
-- 🚨 IL PREZZO NASCE NULL, ED È VOLUTO. Nessuno ha ancora dettato i prezzi per fascia, e l'unica
-- cifra che esiste nel codice (40 € feriali / 32 € festivi, `index.html:25223`) è una **stima da
-- cruscotto** per il fatturato potenziale: non ha mai toccato una prenotazione né un incasso, non
-- distingue le fasce, ed è **per partita** e non per giocatore. Seminarla qui vorrebbe dire mettere
-- una supposizione dentro il posto in cui poi si andrà a cercare una misura.
-- ⇒ `prezzo_cents is null` significa **«non ancora deciso»**, e chi legge deve dirlo invece di
-- mostrare uno zero — che sarebbe «gratis», cioè un'altra cosa.
--
-- ⛔ COSA QUESTA TABELLA NON FA, per non far cercare qui cose che stanno altrove:
--   · non dice quali campi esistono (sono 4, e stanno cablati in tre punti diversi del codice);
--   · non dice quando il circolo è chiuso per manutenzione (è una riga `booking_occupancy`);
--   · non porta le regole di chi può prenotare e con quanto anticipo: quelle sono già definite e
--     vivono in `consumer-booking-write/index.ts:143-150` (30 giorni avanti, durata 30-180 min,
--     07:00-23:30, 4 giocatori). Qui c'è il QUANDO e il QUANTO, non il CHI.
--
-- 📌 Il seme è la griglia vera del circolo al 08/09/2026 — quella allineata da PROD stamattina,
-- che il 27/08 aveva cambiato gli orari (via le fasce del mattino dal lunedì al venerdì, dentro la
-- 16:30-18:00). 41 fasce.
--
-- ↩️ RIPRISTINO VERBATIM (annulla per intero questa migrazione):
--   drop function if exists public.pmo_set_fasce_prenotabili(jsonb);
--   drop function if exists public.pmo_get_fasce_prenotabili();
--   drop table if exists public.pmo_fasce_prenotabili;
--
-- Idempotente: si può rieseguire.

-- ────────────────────────────────────────────────────────────────────────────────
-- ① LA TABELLA
-- ────────────────────────────────────────────────────────────────────────────────
create table if not exists public.pmo_fasce_prenotabili (
  -- Chiave TESTUALE come in `pmo_circoli_esterni`, e per la stessa ragione: questo è un seme
  -- riletto a ogni deploy, e con una chiave generata al secondo giro nascerebbero 41 fasce doppie.
  -- Forma: `<giorno>-<hhmm>` (es. `1-1830`), leggibile in un log senza dover risalire a niente.
  id            text        primary key,

  -- 0 = domenica … 6 = sabato. È l'indice di `Date.getDay()`, ed è già la convenzione del blocco
  -- che questa tabella sostituisce: cambiarla qui vorrebbe dire tradurre in ogni lettore.
  giorno        smallint    not null,

  ora_inizio    time        not null,
  ora_fine      time        not null,

  -- 💶 Quanto paga OGNI GIOCATORE su questa fascia, in centesimi. NULL = non ancora deciso.
  prezzo_cents  integer,

  -- Spegnere una fascia senza cancellarla: serve per le variazioni di stagione, che tornano.
  attiva        boolean     not null default true,

  -- Il perché di una fascia o di un prezzo, in italiano, accanto alla riga a cui appartiene.
  note          text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint pmo_fasce_prenotabili_giorno_ck
    check (giorno between 0 and 6),

  -- ⛔ Una fascia che finisce prima di cominciare non è un dato strano: è una riga che farebbe
  -- sparire un campo dal calendario senza che nessuno capisca perché.
  constraint pmo_fasce_prenotabili_ordine_ck
    check (ora_fine > ora_inizio),

  -- ⚖️ Zero è un prezzo («gratis»), negativo non è niente. NULL resta lecito ed è «non deciso».
  constraint pmo_fasce_prenotabili_prezzo_ck
    check (prezzo_cents is null or prezzo_cents >= 0)
);

-- 🚨 Due fasce che cominciano allo stesso minuto nello stesso giorno sono un doppione che l'app
-- disegnerebbe due volte e il bot proporrebbe due volte. Il vincolo lo impedisce alla radice.
create unique index if not exists pmo_fasce_prenotabili_giorno_inizio_uk
  on public.pmo_fasce_prenotabili (giorno, ora_inizio);

create index if not exists idx_pmo_fasce_prenotabili_attiva
  on public.pmo_fasce_prenotabili (attiva, giorno, ora_inizio);

comment on table public.pmo_fasce_prenotabili is
  'Voce 176 — le fasce su cui i soci possono prenotare, e quanto costa ciascuna A GIOCATORE. Sostituisce il blocco app_setting/potentialSlotSchedule, che veniva da Matchpoint. Una sola griglia per tutti i campi: quale campo sia libero lo dice l''occupazione, non questa tabella.';
comment on column public.pmo_fasce_prenotabili.giorno is
  '0 = domenica … 6 = sabato, come Date.getDay(). Stessa convenzione del blocco che sostituisce.';
comment on column public.pmo_fasce_prenotabili.prezzo_cents is
  'Quanto paga OGNI giocatore, in centesimi. NULL = non ancora deciso: chi legge deve dirlo, non mostrare 0 (che vorrebbe dire gratis).';
comment on column public.pmo_fasce_prenotabili.attiva is
  'false = la fascia esiste ma oggi non si prenota. Si spegne invece di cancellare, perché le variazioni di stagione tornano.';

-- RLS accesa SENZA policy: la porta sono le due funzioni qui sotto, `security definer`, con la
-- guardia dello staff dentro. Stesso assetto della voce 60, e per la stessa ragione: i grant si
-- possono ridare per sbaglio, la guardia dentro la funzione no.
alter table public.pmo_fasce_prenotabili enable row level security;

-- ────────────────────────────────────────────────────────────────────────────────
-- ② IL SEME — la griglia vera del circolo all'08/09/2026
-- ────────────────────────────────────────────────────────────────────────────────
-- `on conflict do update` sui soli campi della geometria: se qualcuno ha già messo un prezzo o
-- spento una fascia, rieseguire la migrazione NON glielo cancella.
insert into public.pmo_fasce_prenotabili (id, giorno, ora_inizio, ora_fine)
values
  ('0-0900', 0, '09:00', '10:30'), ('0-1030', 0, '10:30', '12:00'),
  ('0-1600', 0, '16:00', '17:30'), ('0-1730', 0, '17:30', '19:00'),

  ('1-1230', 1, '12:30', '14:00'), ('1-1400', 1, '14:00', '15:30'),
  ('1-1630', 1, '16:30', '18:00'), ('1-1800', 1, '18:00', '19:30'),
  ('1-1930', 1, '19:30', '21:00'), ('1-2100', 1, '21:00', '22:30'),

  ('2-1230', 2, '12:30', '14:00'), ('2-1400', 2, '14:00', '15:30'),
  ('2-1630', 2, '16:30', '18:00'), ('2-1800', 2, '18:00', '19:30'),
  ('2-1930', 2, '19:30', '21:00'), ('2-2100', 2, '21:00', '22:30'),

  ('3-1230', 3, '12:30', '14:00'), ('3-1400', 3, '14:00', '15:30'),
  ('3-1630', 3, '16:30', '18:00'), ('3-1800', 3, '18:00', '19:30'),
  ('3-1930', 3, '19:30', '21:00'), ('3-2100', 3, '21:00', '22:30'),

  ('4-1230', 4, '12:30', '14:00'), ('4-1400', 4, '14:00', '15:30'),
  ('4-1630', 4, '16:30', '18:00'), ('4-1800', 4, '18:00', '19:30'),
  ('4-1930', 4, '19:30', '21:00'), ('4-2100', 4, '21:00', '22:30'),

  ('5-1230', 5, '12:30', '14:00'), ('5-1400', 5, '14:00', '15:30'),
  ('5-1530', 5, '15:30', '17:00'), ('5-1730', 5, '17:30', '19:00'),
  ('5-1900', 5, '19:00', '20:30'), ('5-2030', 5, '20:30', '22:00'),

  ('6-0900', 6, '09:00', '10:30'), ('6-1030', 6, '10:30', '12:00'),
  ('6-1200', 6, '12:00', '13:30'), ('6-1330', 6, '13:30', '15:00'),
  ('6-1500', 6, '15:00', '16:30'), ('6-1630', 6, '16:30', '18:00'),
  ('6-1800', 6, '18:00', '19:30')
on conflict (id) do update
  set giorno     = excluded.giorno,
      ora_inizio = excluded.ora_inizio,
      ora_fine   = excluded.ora_fine,
      updated_at = now();

-- ────────────────────────────────────────────────────────────────────────────────
-- ③ LEGGERLA
-- ────────────────────────────────────────────────────────────────────────────────
-- 🔒 Guardia: profilo staff ATTIVO. Nessun permesso specifico — qui non c'è un solo dato
-- personale, sono gli orari del circolo, pubblici come il cartello all'ingresso. Ciò che NON deve
-- poter leggere è `anon`, e la guardia risponde AUTH_REQUIRED prima di toccare una riga.
-- ⚠️ Le edge function NON passano di qui: usano `service_role`, che salta la RLS. Questa funzione
-- è la porta dell'APP, non del sistema.
create or replace function public.pmo_get_fasce_prenotabili()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_righe jsonb;
begin
  select * into v_actor from public.pmo_current_staff_profile() limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', id,
             'giorno', giorno,
             'ora_inizio', to_char(ora_inizio, 'HH24:MI'),
             'ora_fine', to_char(ora_fine, 'HH24:MI'),
             'prezzo_cents', prezzo_cents,
             'attiva', attiva,
             'note', note
           ) order by giorno, ora_inizio), '[]'::jsonb)
  into v_righe
  from public.pmo_fasce_prenotabili;

  return jsonb_build_object('ok', true, 'fasce', v_righe);
end;
$$;

revoke all on function public.pmo_get_fasce_prenotabili() from public;
revoke all on function public.pmo_get_fasce_prenotabili() from anon;
grant execute on function public.pmo_get_fasce_prenotabili() to authenticated;

-- ────────────────────────────────────────────────────────────────────────────────
-- ④ SCRIVERLA — dall'Amministrazione, non a mano nel database
-- ────────────────────────────────────────────────────────────────────────────────
-- Riceve l'elenco COMPLETO delle fasce e lo fa diventare lo stato della tabella: aggiorna quelle
-- che ci sono, aggiunge quelle nuove, toglie quelle sparite.
-- 🚨 «Toglie quelle sparite» è la parte che può far danno, ed è per questo che la funzione
-- RIFIUTA un elenco vuoto: un salvataggio partito con la lista non ancora caricata svuoterebbe la
-- griglia del circolo senza che nessuno se ne accorga fino al primo socio che non trova più orari.
-- ⚖️ È la stessa prudenza della QUOTA_MINIMA di `anagrafica-mirror`, ridotta al caso che qui può
-- capitare davvero.
create or replace function public.pmo_set_fasce_prenotabili(p_fasce jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor   record;
  v_quante  integer;
begin
  select * into v_actor from public.pmo_current_staff_profile() limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;

  if jsonb_typeof(p_fasce) is distinct from 'array' then
    return jsonb_build_object('ok', false, 'error', 'ELENCO_NON_VALIDO');
  end if;

  v_quante := jsonb_array_length(p_fasce);
  if v_quante = 0 then
    return jsonb_build_object('ok', false, 'error', 'ELENCO_VUOTO',
      'message', 'Un elenco vuoto cancellerebbe tutte le fasce: se è quello che vuoi, spegnile una a una.');
  end if;

  -- ⚖️ Un'UNICA istruzione, non una tabella temporanea: una `create temporary table` dentro una
  -- funzione si scontrerebbe con sé stessa se la funzione venisse chiamata due volte nella stessa
  -- transazione, e il guasto uscirebbe come un errore incomprensibile invece che come un rifiuto.
  -- La cancellazione e la scrittura vedono lo stesso `nuove`, e gli insiemi sono disgiunti per `id`.
  with nuove as (
    select
      coalesce(nullif(trim(f->>'id'), ''),
               (f->>'giorno') || '-' || replace(substring(f->>'ora_inizio' from 1 for 5), ':', '')) as id,
      (f->>'giorno')::smallint                                      as giorno,
      (f->>'ora_inizio')::time                                      as ora_inizio,
      (f->>'ora_fine')::time                                        as ora_fine,
      nullif(f->>'prezzo_cents', '')::integer                       as prezzo_cents,
      coalesce((f->>'attiva')::boolean, true)                       as attiva,
      nullif(trim(coalesce(f->>'note', '')), '')                    as note
    from jsonb_array_elements(p_fasce) as f
  ),
  cancellate as (
    delete from public.pmo_fasce_prenotabili t
     where not exists (select 1 from nuove n where n.id = t.id)
    returning 1
  )
  insert into public.pmo_fasce_prenotabili (id, giorno, ora_inizio, ora_fine, prezzo_cents, attiva, note)
  select id, giorno, ora_inizio, ora_fine, prezzo_cents, attiva, note from nuove
  on conflict (id) do update
    set giorno       = excluded.giorno,
        ora_inizio   = excluded.ora_inizio,
        ora_fine     = excluded.ora_fine,
        prezzo_cents = excluded.prezzo_cents,
        attiva       = excluded.attiva,
        note         = excluded.note,
        updated_at   = now();

  return jsonb_build_object('ok', true, 'quante', v_quante);
end;
$$;

revoke all on function public.pmo_set_fasce_prenotabili(jsonb) from public;
revoke all on function public.pmo_set_fasce_prenotabili(jsonb) from anon;
grant execute on function public.pmo_set_fasce_prenotabili(jsonb) to authenticated;
