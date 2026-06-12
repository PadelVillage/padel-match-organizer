-- Padel Match Organizer
-- Tabella booking_parses: storico dei booking riparsificati dal parser admin
-- Idempotente. Applicare prima in TEST, poi in PROD tramite Promuovi Prod Admin.

create table if not exists public.booking_parses (
  id                   uuid        primary key default gen_random_uuid(),
  booking_id           text        not null,
  parsed_by_staff_id   text,
  parse_version        text,
  original_booking_text text       not null,
  confidence_original  numeric,
  confidence_new       numeric,
  istruttore_original  text,
  istruttore_new       text,
  campo_original       text,
  campo_new            text,
  orario_original      text,
  orario_new           text,
  snapshot_parser_rules jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- colonne idempotenti
alter table public.booking_parses add column if not exists id                   uuid        default gen_random_uuid();
alter table public.booking_parses add column if not exists booking_id           text;
alter table public.booking_parses add column if not exists parsed_by_staff_id   text;
alter table public.booking_parses add column if not exists parse_version        text;
alter table public.booking_parses add column if not exists original_booking_text text;
alter table public.booking_parses add column if not exists confidence_original  numeric;
alter table public.booking_parses add column if not exists confidence_new       numeric;
alter table public.booking_parses add column if not exists istruttore_original  text;
alter table public.booking_parses add column if not exists istruttore_new       text;
alter table public.booking_parses add column if not exists campo_original       text;
alter table public.booking_parses add column if not exists campo_new            text;
alter table public.booking_parses add column if not exists orario_original      text;
alter table public.booking_parses add column if not exists orario_new           text;
alter table public.booking_parses add column if not exists snapshot_parser_rules jsonb;
alter table public.booking_parses add column if not exists created_at           timestamptz not null default now();
alter table public.booking_parses add column if not exists updated_at           timestamptz not null default now();

create index if not exists idx_booking_parses_booking_id
  on public.booking_parses (booking_id);

create index if not exists idx_booking_parses_created_at
  on public.booking_parses (created_at desc);

-- trigger updated_at
drop trigger if exists trg_booking_parses_updated_at on public.booking_parses;
create trigger trg_booking_parses_updated_at
  before update on public.booking_parses
  for each row execute function public.assessment_touch_updated_at();

-- RLS
alter table public.booking_parses enable row level security;

-- SELECT: solo utenti autenticati (tab "Storico Parses" del parser config panel)
drop policy if exists "booking_parses_select_authenticated" on public.booking_parses;
create policy "booking_parses_select_authenticated"
  on public.booking_parses
  for select
  to authenticated
  using (true);

-- INSERT/UPDATE/DELETE: solo service_role (gestito dalla Edge Function parser-rules-update)

grant usage  on schema public to authenticated;
grant select on table public.booking_parses to authenticated;
