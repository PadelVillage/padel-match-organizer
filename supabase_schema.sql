-- Schema iniziale Supabase per Autovalutazione Livelli
-- Versione: bozza iniziale
-- Eseguire in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists assessment_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  member_local_id text,
  member_name text,
  phone_last4 text,
  status text not null default 'created',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz
);

create table if not exists self_assessments (
  id uuid primary key default gen_random_uuid(),
  token text not null references assessment_tokens(token),
  submitted_at timestamptz not null default now(),
  first_name text,
  last_name text,
  phone text,
  experience text,
  monthly_frequency text,
  basic_strokes text,
  glass_usage text,
  net_play text,
  positioning text,
  rally_patience text,
  competitions text,
  declared_level numeric,
  wants_matches text,
  preferred_days text,
  preferred_hours text,
  notes text,
  calculated_level numeric,
  staff_status text not null default 'pending_review'
);

-- Row Level Security
alter table assessment_tokens enable row level security;
alter table self_assessments enable row level security;

-- Prima versione semplice: la pagina pubblica può inserire autovalutazioni.
-- Nota: prima dell'uso reale, verificare le policy con attenzione.
create policy "public_insert_self_assessments"
on self_assessments
for insert
with check (true);

-- Lettura pubblica minima del token solo se attivo.
-- Da rivedere in fase di hardening sicurezza.
create policy "public_read_active_tokens"
on assessment_tokens
for select
using (status in ('created', 'sent'));

-- Aggiornamento token al completamento.
create policy "public_update_token_completed"
on assessment_tokens
for update
using (status in ('created', 'sent'))
with check (status in ('completed'));

-- Indici utili
create index if not exists idx_self_assessments_token on self_assessments(token);
create index if not exists idx_assessment_tokens_token on assessment_tokens(token);
create index if not exists idx_assessment_tokens_status on assessment_tokens(status);
