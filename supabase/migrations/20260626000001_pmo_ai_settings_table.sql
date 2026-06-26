-- Impostazioni GLOBALI dell'assistente AI, condivise da tutto il circolo (non per-utente).
-- Prima voce: 'learning_mode' (interruttore "modalità apprendimento" del ragionatore Gemini).
-- Lettura: ogni staff autenticato. Scrittura: solo via edge `ai-settings` (service_role, con
-- controllo owner/admin), così l'interruttore è un'impostazione owner/admin. Applicata su TEST 2026-06-26.
create table if not exists public.pmo_ai_settings (
  id          uuid primary key default gen_random_uuid(),
  env         text not null default 'test',     -- 'test' | 'prod'
  key         text not null,                     -- 'learning_mode' | …
  value       jsonb not null default 'null'::jsonb,
  updated_by  text,                              -- email staff che ha cambiato (audit)
  updated_at  timestamptz not null default now(),
  unique (env, key)
);

alter table public.pmo_ai_settings enable row level security;

grant select on public.pmo_ai_settings to authenticated;
grant select, insert, update on public.pmo_ai_settings to service_role;

drop policy if exists pmo_ai_settings_select_authenticated on public.pmo_ai_settings;
create policy pmo_ai_settings_select_authenticated on public.pmo_ai_settings
  for select to authenticated using (true);

-- Seed: modalità apprendimento ON di default (env test). PROD verrà seedato alla promozione.
insert into public.pmo_ai_settings (env, key, value, updated_by)
  values ('test', 'learning_mode', 'true'::jsonb, 'migration')
  on conflict (env, key) do nothing;
