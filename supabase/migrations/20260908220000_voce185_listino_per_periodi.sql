-- Voce 185 — IL LISTINO HA UN CALENDARIO: PERIODI, ORARI E PREZZI CHE CAMBIANO CON LA STAGIONE.
--
-- 🗣️ Richiesta del committente, 08/09/2026 sera, in tre frasi di fila:
--   «ho bisogno di un admin affinché poi in futuro io possa cambiare i prezzi relativamente a un
--    periodo di tempo […] per esempio fare dei prezzi per l'estate e dei prezzi per l'inverno»
--   «devo poter cambiare sia gli orari degli slot che i prezzi relativi agli orari inseriti nella
--    griglia»
--   «devo poter inserire delle festività […] non devo lasciare dei buchi di giorni»
--
-- 📍 COSA CAMBIA RISPETTO ALLA VOCE 176. Lì la griglia era UNA: 41 fasce, valide per sempre.
-- Qui la griglia diventa una proprietà del PERIODO — orari E prezzi insieme, perché lui ha
-- risposto «tutti e due» alla domanda se col cambio di stagione cambino solo i prezzi. ⇒ «Estate»
-- e «Inverno» non sono due listini sopra la stessa griglia: sono due griglie complete.
--
-- ⚖️ LE QUATTRO DECISIONI DI DISEGNO, e perché ciascuna è così:
--
--   ① C'È UNA GRIGLIA **BASE**, senza date, sempre valida. I periodi le stanno sopra e la coprono
--      finché durano; dove nessun periodo arriva, vale la base.
--      🚨 È la risposta al suo «non devo lasciare dei buchi di giorni», e la dà per COSTRUZIONE
--      invece che per disciplina: un giorno scoperto non può esistere, perché la base non ha date
--      e quindi copre tutto. L'alternativa — solo periodi — trasforma una data dimenticata in un
--      circolo chiuso, e nessuno se ne accorge finché un socio non ci sbatte contro.
--      📌 *Il peggio che può capitare così è un prezzo vecchio, che si vede. Il peggio dell'altra
--      strada è un calendario vuoto, che si legge «siamo chiusi».*
--
--   ② I PERIODI DATATI NON SI POSSONO SOVRAPPORRE, e a impedirlo è il database (`exclude using
--      gist`), non la buona volontà di chi compila il pannello. Due periodi sovrapposti non danno
--      un errore: danno un prezzo che dipende dall'ordine con cui il database restituisce le
--      righe — cioè un prezzo che cambia da solo.
--
--   ③ LE CHIUSURE SONO UNA COSA A PARTE, sopra il calendario. Non si spengono le fasce una per
--      una per fare Natale: si dice «il 25/12 è chiuso» e vale per qualunque periodo sia in
--      vigore quel giorno. Le festività fisse (Natale, Capodanno, Ferragosto) si segnano `ogni_anno`
--      e non si ripassano più; Pasqua e i ponti si mettono con le loro date.
--      ⛔ Una chiusura è di GIORNO INTERO. Per una domenica in cui si chiude alle 18 non serve una
--      mezza chiusura: serve un periodo corto con la sua griglia, che è la cosa che già sa fare.
--
--   ④ IL PREZZO RESTA **A GIOCATORE** (decisione della voce 176, non toccata) e `null` resta
--      «non ancora deciso», diverso da `0` che è «gratis».
--
-- 💶 E QUI DENTRO ENTRANO I PRIMI PREZZI VERI, che fino a stasera erano `null` su tutte e 41.
-- Non sono inventati: sono stati **misurati** sui 3.336 pagamenti veri arrivati da Matchpoint
-- (24/05 → 07/09/2026) e poi **confermati dal committente** l'08/09 sera («confermo»).
-- 📏 Metodo: importo più frequente per (giorno della settimana, ora d'inizio), sui pagamenti
-- `paid` dal 01/07/2026, tolte le righe da 20,00 € delle giornate-torneo (dove tutti e quattro i
-- campi vanno allo stesso prezzo speciale: sono eventi, non listino).
-- ⚠️ **Quattro fasce non hanno NESSUN pagamento dietro** — lunedì 16:30, mercoledì 14:00,
-- giovedì 14:00, sabato 12:00 — e il loro prezzo viene dal disegno della fascia gemella, non da
-- una misura. Altre sei ne hanno pochissimi (1-4). Sta scritto qui perché chi un domani trovasse
-- uno di quei numeri sbagliato sappia che era il più debole della fila, e non cerchi altrove.
--
-- ↩️ RIPRISTINO VERBATIM (annulla per intero questa migrazione):
--   drop function if exists public.pmo_calendario_effettivo(date, date);
--   drop function if exists public.pmo_get_listino();
--   drop function if exists public.pmo_set_periodo(jsonb, jsonb);
--   drop function if exists public.pmo_elimina_periodo(text);
--   drop function if exists public.pmo_set_chiusure(jsonb, boolean);
--   drop table if exists public.pmo_chiusure;
--   alter table public.pmo_fasce_prenotabili drop column if exists periodo_id;
--   drop table if exists public.pmo_listino_periodi;
--   (le due funzioni della voce 176 vanno rimesse dalla loro migrazione)
--
-- Idempotente: si può rieseguire.

-- ────────────────────────────────────────────────────────────────────────────────
-- ① I PERIODI
-- ────────────────────────────────────────────────────────────────────────────────
create table if not exists public.pmo_listino_periodi (
  -- Chiave TESTUALE come nelle fasce, e per la stessa ragione: si legge in un log senza risalire
  -- a niente (`estate-2026`), e un seme rieseguito non crea gemelli.
  id         text        primary key,
  nome       text        not null,

  -- 🚨 `dal` e `al` NULL insieme = questa è la BASE, quella senza date che vale sempre.
  -- Valorizzate insieme = periodo datato, estremi COMPRESI.
  dal        date,
  al         date,

  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint pmo_listino_periodi_date_ck check (
    (dal is null and al is null) or (dal is not null and al is not null and al >= dal)
  )
);

-- ⛔ Una BASE sola. Due griglie «sempre valide» sarebbero due risposte alla stessa domanda.
create unique index if not exists pmo_listino_periodi_una_base_uk
  on public.pmo_listino_periodi ((dal is null)) where dal is null;

-- ⛔ Periodi datati che si accavallano: impedito dal database. Vedi decisione ②.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pmo_listino_periodi_no_overlap') then
    alter table public.pmo_listino_periodi
      add constraint pmo_listino_periodi_no_overlap
      exclude using gist (daterange(dal, al, '[]') with &&) where (dal is not null);
  end if;
end $$;

comment on table public.pmo_listino_periodi is
  'Voce 185 — i periodi del listino. La riga con dal/al NULL è la griglia BASE, sempre valida: i periodi datati la coprono finché durano, e per questo un giorno scoperto non può esistere.';

alter table public.pmo_listino_periodi enable row level security;

-- La BASE esiste sempre: è il fondo su cui poggia tutto il resto.
insert into public.pmo_listino_periodi (id, nome, note)
values ('base', 'Griglia base', 'Vale quando nessun periodo copre il giorno. Non si può cancellare.')
on conflict (id) do nothing;

-- ────────────────────────────────────────────────────────────────────────────────
-- ② LE FASCE APPARTENGONO A UN PERIODO
-- ────────────────────────────────────────────────────────────────────────────────
-- Le 41 fasce della voce 176 diventano quelle della BASE: `default 'base'` le adotta tutte senza
-- toccarle, e nessun lettore di oggi cambia comportamento finché non nasce un secondo periodo.
alter table public.pmo_fasce_prenotabili
  add column if not exists periodo_id text not null default 'base';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pmo_fasce_prenotabili_periodo_fk') then
    alter table public.pmo_fasce_prenotabili
      add constraint pmo_fasce_prenotabili_periodo_fk
      foreign key (periodo_id) references public.pmo_listino_periodi(id) on delete cascade;
  end if;
end $$;

-- 🚨 Il vincolo di unicità della 176 era (giorno, ora_inizio): con i periodi diventerebbe il
-- divieto di avere la stessa fascia in due stagioni diverse — cioè il divieto di fare la cosa
-- per cui questa migrazione esiste.
drop index if exists pmo_fasce_prenotabili_giorno_inizio_uk;
create unique index if not exists pmo_fasce_prenotabili_periodo_giorno_inizio_uk
  on public.pmo_fasce_prenotabili (periodo_id, giorno, ora_inizio);

drop index if exists idx_pmo_fasce_prenotabili_attiva;
create index if not exists idx_pmo_fasce_prenotabili_periodo
  on public.pmo_fasce_prenotabili (periodo_id, attiva, giorno, ora_inizio);

comment on column public.pmo_fasce_prenotabili.periodo_id is
  'A quale periodo appartiene questa fascia. ''base'' = la griglia sempre valida.';

-- ────────────────────────────────────────────────────────────────────────────────
-- ③ LE CHIUSURE
-- ────────────────────────────────────────────────────────────────────────────────
create table if not exists public.pmo_chiusure (
  id         text        primary key,
  dal        date        not null,
  al         date        not null,   -- uguale a `dal` per un giorno solo
  motivo     text        not null,   -- esce dal calendario e (un domani) dalla bocca del bot
  -- true = festività fissa: si confrontano mese e giorno, l'anno non conta.
  ogni_anno  boolean     not null default false,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint pmo_chiusure_ordine_ck check (al >= dal),

  -- ⚖️ Una chiusura ricorrente che scavalca il capodanno (28/12 → 02/01) col confronto mese-giorno
  -- non funzionerebbe, e fallirebbe in SILENZIO: il circolo risulterebbe aperto. ⇒ Si vieta, e per
  -- quel caso si fanno due righe (28-31/12 e 01-02/01), che è esplicito e si vede nel pannello.
  constraint pmo_chiusure_ricorrente_stesso_anno_ck check (
    not ogni_anno or extract(year from dal) = extract(year from al)
  )
);

comment on table public.pmo_chiusure is
  'Voce 185 — i giorni in cui il circolo è chiuso. Stanno SOPRA i periodi: valgono qualunque griglia sia in vigore. Giorno intero; per un orario ridotto si usa un periodo corto.';

alter table public.pmo_chiusure enable row level security;

create index if not exists idx_pmo_chiusure_dal on public.pmo_chiusure (dal, al);

-- ────────────────────────────────────────────────────────────────────────────────
-- ④ LA REGOLA CHE DECIDE — e sta QUI, in un posto solo
-- ────────────────────────────────────────────────────────────────────────────────
-- 🎯 «Che orari e che prezzi valgono il giorno X?» ha UNA risposta, e la dà il gestionale.
-- L'app la chiama per disegnare il calendario, le edge del bot la chiamano per rispondere al
-- socio. ⇒ Nessuno rifà il conto per conto suo: è *il gestionale SA, il bot DICE* applicato al
-- listino. Il giorno in cui la regola cambia, cambia qui e basta.
--
-- 🔒 Guardia doppia: profilo staff attivo (l'app) OPPURE `service_role` (le edge, che non hanno
-- un utente). ⚠️ Dentro una `security definer` non si può guardare `current_user` — sarebbe il
-- proprietario della funzione — quindi il ruolo si legge dal JWT con `auth.role()`.
create or replace function public.pmo_calendario_effettivo(p_dal date, p_al date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff   boolean := exists (select 1 from public.pmo_current_staff_profile());
  v_sistema boolean := coalesce(auth.role(), '') = 'service_role';
  v_giorni  jsonb;
begin
  if not (v_staff or v_sistema) then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;

  if p_dal is null or p_al is null or p_al < p_dal then
    return jsonb_build_object('ok', false, 'error', 'INTERVALLO_NON_VALIDO');
  end if;

  -- Un intervallo enorme non è una richiesta legittima: è un ciclo partito per sbaglio.
  if (p_al - p_dal) > 400 then
    return jsonb_build_object('ok', false, 'error', 'INTERVALLO_TROPPO_LUNGO',
      'message', 'Al massimo 400 giorni per volta.');
  end if;

  with giorni as (
    select d::date as data from generate_series(p_dal, p_al, interval '1 day') d
  ),
  risolti as (
    select g.data,
           coalesce(p.id, 'base')   as periodo_id,
           coalesce(p.nome, b.nome) as periodo_nome,
           (p.id is not null)       as da_periodo,
           c.motivo                 as chiusura_motivo
      from giorni g
      cross join (select nome from public.pmo_listino_periodi where id = 'base') b
      -- il periodo datato che copre il giorno (ce n'è al massimo uno: lo garantisce il vincolo)
      left join lateral (
        select pp.id, pp.nome
          from public.pmo_listino_periodi pp
         where pp.dal is not null and g.data between pp.dal and pp.al
         limit 1
      ) p on true
      -- la chiusura che tocca il giorno: prima quelle con le date vere, poi le ricorrenti
      left join lateral (
        select cc.motivo
          from public.pmo_chiusure cc
         where (not cc.ogni_anno and g.data between cc.dal and cc.al)
            or (cc.ogni_anno and to_char(g.data, 'MM-DD')
                                 between to_char(cc.dal, 'MM-DD') and to_char(cc.al, 'MM-DD'))
         order by cc.ogni_anno asc
         limit 1
      ) c on true
  )
  select jsonb_agg(
           jsonb_build_object(
             'data',         to_char(r.data, 'YYYY-MM-DD'),
             'periodo_id',   r.periodo_id,
             'periodo_nome', r.periodo_nome,
             'chiuso',       r.chiusura_motivo is not null,
             'motivo',       r.chiusura_motivo,
             -- ⛔ Un giorno chiuso NON rende le sue fasce: renderle e poi fidarsi che chi legge
             -- guardi anche `chiuso` è il modo in cui un socio prenota a Natale.
             'fasce', case when r.chiusura_motivo is not null then '[]'::jsonb else coalesce((
               select jsonb_agg(jsonb_build_object(
                        'ora_inizio',   to_char(f.ora_inizio, 'HH24:MI'),
                        'ora_fine',     to_char(f.ora_fine, 'HH24:MI'),
                        'prezzo_cents', f.prezzo_cents,
                        'note',         f.note
                      ) order by f.ora_inizio)
                 from public.pmo_fasce_prenotabili f
                where f.periodo_id = r.periodo_id
                  and f.attiva
                  and f.giorno = extract(dow from r.data)::smallint
             ), '[]'::jsonb) end
           ) order by r.data
         )
    into v_giorni
    from risolti r;

  return jsonb_build_object('ok', true, 'giorni', coalesce(v_giorni, '[]'::jsonb));
end;
$$;

revoke all on function public.pmo_calendario_effettivo(date, date) from public;
revoke all on function public.pmo_calendario_effettivo(date, date) from anon;
grant execute on function public.pmo_calendario_effettivo(date, date) to authenticated;
grant execute on function public.pmo_calendario_effettivo(date, date) to service_role;

-- ────────────────────────────────────────────────────────────────────────────────
-- ⑤ IL PANNELLO: leggere tutto, salvare un periodo, cancellarlo, salvare le chiusure
-- ────────────────────────────────────────────────────────────────────────────────
create or replace function public.pmo_get_listino()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_periodi  jsonb;
  v_chiusure jsonb;
begin
  if not exists (select 1 from public.pmo_current_staff_profile()) then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;

  select coalesce(jsonb_agg(x order by x.ordine, x.dal nulls first, x.nome), '[]'::jsonb)
    into v_periodi
    from (
      select p.id, p.nome, p.dal, p.al, p.note,
             case when p.dal is null then 0 else 1 end as ordine,
             coalesce((
               select jsonb_agg(jsonb_build_object(
                        'id', f.id, 'giorno', f.giorno,
                        'ora_inizio', to_char(f.ora_inizio, 'HH24:MI'),
                        'ora_fine',   to_char(f.ora_fine, 'HH24:MI'),
                        'prezzo_cents', f.prezzo_cents,
                        'attiva', f.attiva, 'note', f.note
                      ) order by f.giorno, f.ora_inizio)
                 from public.pmo_fasce_prenotabili f where f.periodo_id = p.id
             ), '[]'::jsonb) as fasce
        from public.pmo_listino_periodi p
    ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'dal', to_char(c.dal, 'YYYY-MM-DD'), 'al', to_char(c.al, 'YYYY-MM-DD'),
           'motivo', c.motivo, 'ogni_anno', c.ogni_anno, 'note', c.note
         ) order by c.ogni_anno, c.dal), '[]'::jsonb)
    into v_chiusure
    from public.pmo_chiusure c;

  return jsonb_build_object('ok', true, 'periodi', v_periodi, 'chiusure', v_chiusure);
end;
$$;

revoke all on function public.pmo_get_listino() from public;
revoke all on function public.pmo_get_listino() from anon;
grant execute on function public.pmo_get_listino() to authenticated;

-- Salva UN periodo e TUTTE le sue fasce insieme: sono la stessa cosa, e salvarle separate
-- lascerebbe una finestra in cui un periodo esiste senza orari — cioè un giorno senza fasce che
-- però non è chiuso.
create or replace function public.pmo_set_periodo(p_periodo jsonb, p_fasce jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      text;
  v_nome    text;
  v_dal     date;
  v_al      date;
  v_note    text;
  v_quante  integer;
  v_sovrapp record;
begin
  if not exists (select 1 from public.pmo_current_staff_profile()) then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;

  v_id   := nullif(trim(coalesce(p_periodo->>'id', '')), '');
  v_nome := nullif(trim(coalesce(p_periodo->>'nome', '')), '');
  v_note := nullif(trim(coalesce(p_periodo->>'note', '')), '');
  if v_id is null or v_nome is null then
    return jsonb_build_object('ok', false, 'error', 'PERIODO_INCOMPLETO',
      'message', 'Servono un identificativo e un nome.');
  end if;

  if v_id = 'base' then
    -- La base non ha date, e provare a dargliele vorrebbe dire lasciare il calendario scoperto
    -- fuori da quelle: si ignorano invece di obbedire.
    v_dal := null; v_al := null;
  else
    v_dal := nullif(p_periodo->>'dal', '')::date;
    v_al  := nullif(p_periodo->>'al', '')::date;
    if v_dal is null or v_al is null then
      return jsonb_build_object('ok', false, 'error', 'DATE_MANCANTI',
        'message', 'Un periodo vuole una data di inizio e una di fine. Senza date c''è già la griglia base.');
    end if;
    if v_al < v_dal then
      return jsonb_build_object('ok', false, 'error', 'DATE_INVERTITE');
    end if;
    select id, nome into v_sovrapp
      from public.pmo_listino_periodi
     where dal is not null and id <> v_id and daterange(dal, al, '[]') && daterange(v_dal, v_al, '[]')
     limit 1;
    if found then
      return jsonb_build_object('ok', false, 'error', 'PERIODI_SOVRAPPOSTI',
        'message', format('Si accavalla con «%s». Due periodi sullo stesso giorno darebbero due prezzi diversi.', v_sovrapp.nome));
    end if;
  end if;

  if jsonb_typeof(p_fasce) is distinct from 'array' then
    return jsonb_build_object('ok', false, 'error', 'ELENCO_NON_VALIDO');
  end if;
  v_quante := jsonb_array_length(p_fasce);
  if v_quante = 0 then
    return jsonb_build_object('ok', false, 'error', 'ELENCO_VUOTO',
      'message', 'Un periodo senza fasce è un periodo in cui non si prenota niente: se è quello che vuoi, usa una chiusura.');
  end if;

  -- 🚨 Le sovrapposizioni DENTRO un giorno non le prende il vincolo di unicità (guarda solo l'ora
  -- d'inizio): due fasce accavallate proporrebbero lo stesso campo due volte nello stesso momento.
  -- Il controllo sta QUI e non solo nel pannello, perché una regola che vive nella schermata non
  -- protegge chi chiama la funzione da un'altra parte.
  if exists (
    select 1
      from (select (f->>'giorno')::smallint as g,
                   (f->>'ora_inizio')::time as i,
                   (f->>'ora_fine')::time   as fi
              from jsonb_array_elements(p_fasce) f) a
      join (select (f->>'giorno')::smallint as g,
                   (f->>'ora_inizio')::time as i,
                   (f->>'ora_fine')::time   as fi
              from jsonb_array_elements(p_fasce) f) b
        on a.g = b.g and a.i < b.i and b.i < a.fi
  ) then
    return jsonb_build_object('ok', false, 'error', 'FASCE_ACCAVALLATE',
      'message', 'Due fasce dello stesso giorno si accavallano.');
  end if;

  insert into public.pmo_listino_periodi (id, nome, dal, al, note)
  values (v_id, v_nome, v_dal, v_al, v_note)
  on conflict (id) do update
    set nome = excluded.nome, dal = excluded.dal, al = excluded.al,
        note = excluded.note, updated_at = now();

  with nuove as (
    select
      coalesce(nullif(trim(f->>'id'), ''),
               v_id || '-' || (f->>'giorno') || '-' ||
               replace(substring(f->>'ora_inizio' from 1 for 5), ':', '')) as id,
      v_id                                                   as periodo_id,
      (f->>'giorno')::smallint                               as giorno,
      (f->>'ora_inizio')::time                               as ora_inizio,
      (f->>'ora_fine')::time                                 as ora_fine,
      nullif(f->>'prezzo_cents', '')::integer                as prezzo_cents,
      coalesce((f->>'attiva')::boolean, true)                as attiva,
      nullif(trim(coalesce(f->>'note', '')), '')             as note
    from jsonb_array_elements(p_fasce) as f
  ),
  cancellate as (
    delete from public.pmo_fasce_prenotabili t
     where t.periodo_id = v_id
       and not exists (select 1 from nuove n where n.id = t.id)
    returning 1
  )
  insert into public.pmo_fasce_prenotabili (id, periodo_id, giorno, ora_inizio, ora_fine, prezzo_cents, attiva, note)
  select id, periodo_id, giorno, ora_inizio, ora_fine, prezzo_cents, attiva, note from nuove
  on conflict (id) do update
    set periodo_id   = excluded.periodo_id,
        giorno       = excluded.giorno,
        ora_inizio   = excluded.ora_inizio,
        ora_fine     = excluded.ora_fine,
        prezzo_cents = excluded.prezzo_cents,
        attiva       = excluded.attiva,
        note         = excluded.note,
        updated_at   = now();

  return jsonb_build_object('ok', true, 'periodo', v_id, 'quante', v_quante);
end;
$$;

revoke all on function public.pmo_set_periodo(jsonb, jsonb) from public;
revoke all on function public.pmo_set_periodo(jsonb, jsonb) from anon;
grant execute on function public.pmo_set_periodo(jsonb, jsonb) to authenticated;

create or replace function public.pmo_elimina_periodo(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quante integer;
begin
  if not exists (select 1 from public.pmo_current_staff_profile()) then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;
  if p_id = 'base' then
    return jsonb_build_object('ok', false, 'error', 'BASE_NON_CANCELLABILE',
      'message', 'La griglia base è il fondo su cui poggia tutto: senza, i giorni scoperti resterebbero senza orari.');
  end if;

  select count(*) into v_quante from public.pmo_fasce_prenotabili where periodo_id = p_id;
  delete from public.pmo_listino_periodi where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'PERIODO_INESISTENTE');
  end if;
  return jsonb_build_object('ok', true, 'fasce_tolte', v_quante);
end;
$$;

revoke all on function public.pmo_elimina_periodo(text) from public;
revoke all on function public.pmo_elimina_periodo(text) from anon;
grant execute on function public.pmo_elimina_periodo(text) to authenticated;

-- Le chiusure si salvano tutte insieme, come le fasce.
-- ⚠️ Un elenco vuoto è uno stato legittimo («nessuna chiusura»), ma è anche la faccia di un
-- salvataggio partito prima che la lista fosse caricata — e cancellerebbe Natale in silenzio.
-- ⇒ Si accetta solo se chi chiama lo dichiara con `p_svuota`.
create or replace function public.pmo_set_chiusure(p_chiusure jsonb, p_svuota boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quante integer;
begin
  if not exists (select 1 from public.pmo_current_staff_profile()) then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;
  if jsonb_typeof(p_chiusure) is distinct from 'array' then
    return jsonb_build_object('ok', false, 'error', 'ELENCO_NON_VALIDO');
  end if;

  v_quante := jsonb_array_length(p_chiusure);
  if v_quante = 0 and not coalesce(p_svuota, false) then
    return jsonb_build_object('ok', false, 'error', 'ELENCO_VUOTO',
      'message', 'Nessuna chiusura in elenco: se vuoi davvero toglierle tutte, dillo esplicitamente.');
  end if;

  with nuove as (
    select
      coalesce(nullif(trim(c->>'id'), ''),
               'ch-' || replace(c->>'dal', '-', '') || '-' || replace(c->>'al', '-', '')) as id,
      (c->>'dal')::date                                   as dal,
      (c->>'al')::date                                    as al,
      nullif(trim(coalesce(c->>'motivo', '')), '')        as motivo,
      coalesce((c->>'ogni_anno')::boolean, false)         as ogni_anno,
      nullif(trim(coalesce(c->>'note', '')), '')          as note
    from jsonb_array_elements(p_chiusure) as c
  ),
  cancellate as (
    delete from public.pmo_chiusure t
     where not exists (select 1 from nuove n where n.id = t.id)
    returning 1
  )
  insert into public.pmo_chiusure (id, dal, al, motivo, ogni_anno, note)
  select id, dal, al, coalesce(motivo, 'Chiuso'), ogni_anno, note from nuove
  on conflict (id) do update
    set dal = excluded.dal, al = excluded.al, motivo = excluded.motivo,
        ogni_anno = excluded.ogni_anno, note = excluded.note, updated_at = now();

  return jsonb_build_object('ok', true, 'quante', v_quante);
end;
$$;

revoke all on function public.pmo_set_chiusure(jsonb, boolean) from public;
revoke all on function public.pmo_set_chiusure(jsonb, boolean) from anon;
grant execute on function public.pmo_set_chiusure(jsonb, boolean) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────────
-- ⑥ LE DUE FUNZIONI DELLA VOCE 176 GUARDANO LA BASE
-- ────────────────────────────────────────────────────────────────────────────────
-- Restano in servizio e non cambiano contratto: chi le chiama continua a vedere «le fasce»,
-- e quelle sono quelle della BASE. ⛔ Senza questo filtro, il giorno in cui nasce «Estate»
-- il pannello vecchio mostrerebbe le fasce di TUTTI i periodi mescolate, e salvandole le
-- riscriverebbe tutte nella base.
create or replace function public.pmo_get_fasce_prenotabili()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_righe jsonb;
begin
  if not exists (select 1 from public.pmo_current_staff_profile()) then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', id, 'giorno', giorno,
             'ora_inizio', to_char(ora_inizio, 'HH24:MI'),
             'ora_fine', to_char(ora_fine, 'HH24:MI'),
             'prezzo_cents', prezzo_cents,
             'attiva', attiva, 'note', note
           ) order by giorno, ora_inizio), '[]'::jsonb)
  into v_righe
  from public.pmo_fasce_prenotabili
  where periodo_id = 'base';

  return jsonb_build_object('ok', true, 'fasce', v_righe);
end;
$$;

create or replace function public.pmo_set_fasce_prenotabili(p_fasce jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Un solo corpo per due porte: la vecchia scrive sulla base, e la regola sta in un posto solo.
  return public.pmo_set_periodo(
    jsonb_build_object('id', 'base', 'nome',
      coalesce((select nome from public.pmo_listino_periodi where id = 'base'), 'Griglia base')),
    p_fasce);
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────────
-- ⑦ I PREZZI CONFERMATI — misurati sui pagamenti veri, confermati da lui l'08/09/2026
-- ────────────────────────────────────────────────────────────────────────────────
-- ⚖️ `where prezzo_cents is null`: si riempie solo la casella vuota. Se un domani lui cambia un
-- prezzo dal pannello, una riesecuzione di questa migrazione NON glielo riscrive addosso.
update public.pmo_fasce_prenotabili f
   set prezzo_cents = v.cents, updated_at = now()
  from (values
    -- domenica
    (0, time '09:00',  800), (0, time '10:30',  800), (0, time '16:00', 1000), (0, time '17:30',  800),
    -- lunedì → giovedì (identici tutti e quattro)
    (1, time '12:30', 1000), (1, time '14:00', 1000), (1, time '16:30',  800),
    (1, time '18:00', 1200), (1, time '19:30', 1300), (1, time '21:00', 1200),
    (2, time '12:30', 1000), (2, time '14:00', 1000), (2, time '16:30',  800),
    (2, time '18:00', 1200), (2, time '19:30', 1300), (2, time '21:00', 1200),
    (3, time '12:30', 1000), (3, time '14:00', 1000), (3, time '16:30',  800),
    (3, time '18:00', 1200), (3, time '19:30', 1300), (3, time '21:00', 1200),
    (4, time '12:30', 1000), (4, time '14:00', 1000), (4, time '16:30',  800),
    (4, time '18:00', 1200), (4, time '19:30', 1300), (4, time '21:00', 1200),
    -- venerdì
    (5, time '12:30', 1000), (5, time '14:00', 1000), (5, time '15:30',  800),
    (5, time '17:30', 1000), (5, time '19:00', 1200), (5, time '20:30', 1200),
    -- sabato
    (6, time '09:00',  800), (6, time '10:30',  800), (6, time '12:00',  800), (6, time '13:30',  800),
    (6, time '15:00',  800), (6, time '16:30',  800), (6, time '18:00',  800)
  ) as v(giorno, ora, cents)
 where f.periodo_id = 'base'
   and f.giorno = v.giorno
   and f.ora_inizio = v.ora
   and f.prezzo_cents is null;
