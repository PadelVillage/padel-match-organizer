-- Tracker consumo Gemini: una riga per ogni chiamata alle edge AI (ai-parse, ai-reason,
-- ai-propose-lexicon, ai-lex-examples), scritta lato server con service_role (così copre
-- anche le routine/cron senza client). La UI (scheda Assistente AI, gated view_assistante_ai)
-- aggrega token + costo stimato + frequenza (free tier). Applicata su TEST il 2026-06-26.
create table if not exists public.pmo_ai_usage (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  env             text not null default 'test',          -- 'test' | 'prod'
  function_name   text not null,                          -- ai-parse | ai-reason | ai-propose-lexicon | ai-lex-examples
  model           text not null default 'gemini-2.5-flash',
  prompt_tokens   integer not null default 0,             -- input
  output_tokens   integer not null default 0,             -- candidati (output visibile)
  thinking_tokens integer not null default 0,             -- "thoughts" (contano come output per il costo)
  total_tokens    integer not null default 0,
  est_cost_usd    numeric not null default 0,             -- stima ($0,30/1M in, $2,50/1M out+thinking)
  actor_email     text,                                   -- staff che ha originato (null per cron)
  meta            jsonb not null default '{}'::jsonb
);

create index if not exists pmo_ai_usage_created_idx on public.pmo_ai_usage (created_at desc);
create index if not exists pmo_ai_usage_env_created_idx on public.pmo_ai_usage (env, created_at desc);

alter table public.pmo_ai_usage enable row level security;

-- Lettura: staff autenticato (la UI restringe a view_assistante_ai). Inserimento: solo gli edge
-- con service_role (che bypassa la RLS) → nessuna policy di insert per authenticated.
grant select on public.pmo_ai_usage to authenticated;
grant select, insert on public.pmo_ai_usage to service_role;

drop policy if exists pmo_ai_usage_select_authenticated on public.pmo_ai_usage;
create policy pmo_ai_usage_select_authenticated on public.pmo_ai_usage
  for select to authenticated using (true);
