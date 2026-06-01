-- Padel Match Organizer
-- Tabella pmo_parser_config: storico versioni del parser (una riga per versione)
-- Idempotente. Applicare prima in TEST, poi in PROD tramite Promuovi Prod Admin.

create table if not exists public.pmo_parser_config (
  versione           text        primary key,
  snapshot_json      jsonb,
  aggiornato_da      text,
  data_aggiornamento timestamptz not null default now(),
  note               text,
  created_at         timestamptz not null default now()
);

-- colonne idempotenti
alter table public.pmo_parser_config add column if not exists versione           text;
alter table public.pmo_parser_config add column if not exists snapshot_json      jsonb;
alter table public.pmo_parser_config add column if not exists aggiornato_da      text;
alter table public.pmo_parser_config add column if not exists data_aggiornamento timestamptz not null default now();
alter table public.pmo_parser_config add column if not exists note               text;
alter table public.pmo_parser_config add column if not exists created_at         timestamptz not null default now();

create index if not exists idx_pmo_parser_config_data_aggiornamento
  on public.pmo_parser_config (data_aggiornamento desc);

-- RLS
alter table public.pmo_parser_config enable row level security;

-- SELECT: solo utenti autenticati (tab "Log Evoluzione" del parser config panel)
drop policy if exists "pmo_parser_config_select_authenticated" on public.pmo_parser_config;
create policy "pmo_parser_config_select_authenticated"
  on public.pmo_parser_config
  for select
  to authenticated
  using (true);

-- INSERT/UPDATE/DELETE: solo service_role (gestito dalla Edge Function parser-rules-update)

grant usage  on schema public to authenticated;
grant select on table public.pmo_parser_config to authenticated;
