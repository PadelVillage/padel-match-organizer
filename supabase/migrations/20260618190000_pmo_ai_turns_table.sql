-- Fase 1 autoapprendimento assistente: diario completo dei turni (chat + manuale) con esito.
-- Solo cattura, nessuna auto-applicazione. Applicata su TEST il 2026-06-18.
create table if not exists public.pmo_ai_turns (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  session_id    text,
  staff_id      text,
  env           text not null default 'test',
  domain        text,                       -- 'prenotazione' | 'anagrafica' | null
  source        text not null,              -- 'rules' | 'gemini' | 'manual'
  utterance     text,                       -- frase utente (null per azioni manuali pure)
  confidence    numeric,
  azione        text,
  parsed_json   jsonb,
  outcome       text,                       -- confirmed|cancelled|reformulated|reported|validation_error|abandoned
  outcome_at    timestamptz,
  next_utterance text,
  versione_parser text not null default 'unknown',
  meta          jsonb not null default '{}'::jsonb
);

create index if not exists pmo_ai_turns_created_idx on public.pmo_ai_turns (created_at desc);
create index if not exists pmo_ai_turns_env_dom_out_idx on public.pmo_ai_turns (env, domain, outcome);
create index if not exists pmo_ai_turns_session_idx on public.pmo_ai_turns (session_id);

alter table public.pmo_ai_turns enable row level security;

-- Privilegi di tabella (necessari oltre alla RLS).
grant select, insert, update on public.pmo_ai_turns to authenticated;
grant insert on public.pmo_ai_turns to anon;

-- Policy: stesso pattern di pmo_parser_errors (insert aperto, select/update per authenticated).
drop policy if exists pmo_ai_turns_insert_any on public.pmo_ai_turns;
create policy pmo_ai_turns_insert_any on public.pmo_ai_turns
  for insert to authenticated, anon with check (true);

drop policy if exists pmo_ai_turns_select_authenticated on public.pmo_ai_turns;
create policy pmo_ai_turns_select_authenticated on public.pmo_ai_turns
  for select to authenticated using (true);

drop policy if exists pmo_ai_turns_update_authenticated on public.pmo_ai_turns;
create policy pmo_ai_turns_update_authenticated on public.pmo_ai_turns
  for update to authenticated using (true) with check (true);
