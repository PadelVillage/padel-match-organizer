-- Padel Match Organizer
-- Tabella pmo_parser_errors: log degli errori di parsing dai client
-- Idempotente. Applicare prima in TEST, poi in PROD tramite Promuovi Prod Admin.

create table if not exists public.pmo_parser_errors (
  id               uuid        primary key default gen_random_uuid(),
  input_originale  text        not null,
  intent_riconosciuto text,
  confidence       numeric,
  error_message    text,
  versione_parser  text        not null default 'unknown',
  admin_selected   boolean     not null default false,
  staff_id         text,
  "timestamp"      timestamptz not null default now()
);

-- colonne idempotenti (nel caso la tabella esista già parzialmente)
alter table public.pmo_parser_errors add column if not exists id               uuid        default gen_random_uuid();
alter table public.pmo_parser_errors add column if not exists input_originale  text;
alter table public.pmo_parser_errors add column if not exists intent_riconosciuto text;
alter table public.pmo_parser_errors add column if not exists confidence       numeric;
alter table public.pmo_parser_errors add column if not exists error_message    text;
alter table public.pmo_parser_errors add column if not exists versione_parser  text        not null default 'unknown';
alter table public.pmo_parser_errors add column if not exists admin_selected   boolean     not null default false;
alter table public.pmo_parser_errors add column if not exists staff_id         text;
alter table public.pmo_parser_errors add column if not exists "timestamp"      timestamptz not null default now();

create index if not exists idx_pmo_parser_errors_timestamp
  on public.pmo_parser_errors ("timestamp" desc);

create index if not exists idx_pmo_parser_errors_admin_selected
  on public.pmo_parser_errors (admin_selected);

-- RLS
alter table public.pmo_parser_errors enable row level security;

-- INSERT: aperto ad anon e authenticated
-- logParserError() può essere chiamato senza sessione staff attiva
drop policy if exists "pmo_parser_errors_insert_any" on public.pmo_parser_errors;
create policy "pmo_parser_errors_insert_any"
  on public.pmo_parser_errors
  for insert
  to anon, authenticated
  with check (true);

-- SELECT: solo utenti autenticati (il controllo manage_users è a livello applicativo)
drop policy if exists "pmo_parser_errors_select_authenticated" on public.pmo_parser_errors;
create policy "pmo_parser_errors_select_authenticated"
  on public.pmo_parser_errors
  for select
  to authenticated
  using (true);

-- UPDATE/DELETE: solo service_role (la Edge Function parser-rules-update marca admin_selected)

grant usage  on schema public to anon, authenticated;
grant insert on table public.pmo_parser_errors to anon, authenticated;
grant select on table public.pmo_parser_errors to authenticated;
