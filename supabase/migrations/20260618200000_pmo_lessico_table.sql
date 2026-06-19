-- Fase 2 autoapprendimento: lessico data-driven. Coppie surface→canonical (parola nuova
-- → parola che il parser già capisce), applicate come riscrittura del testo prima del parse.
-- Solo le righe 'approved' entrano nel parser. Niente auto-applicazione: l'approva è umana.
-- Applicata su TEST il 2026-06-18.
create table if not exists public.pmo_lessico (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  env         text not null default 'test',
  domain      text,                       -- 'prenotazione' | 'anagrafica' | null (entrambi)
  surface     text not null,              -- parola dell'utente (nuovo termine)
  canonical   text not null,              -- parola che il parser già capisce
  kind        text,                       -- 'verbo'|'campo'|'sinonimo'|'valore' (informativo)
  status      text not null default 'proposed',  -- proposed | approved | rejected
  source      text not null default 'manual',    -- manual | auto | gemini-distill
  examples    jsonb not null default '[]'::jsonb,
  approved_by text,
  approved_at timestamptz,
  meta        jsonb not null default '{}'::jsonb,
  unique (env, domain, surface)
);

create index if not exists pmo_lessico_env_status_idx on public.pmo_lessico (env, status);

alter table public.pmo_lessico enable row level security;

grant select, insert, update on public.pmo_lessico to authenticated;

drop policy if exists pmo_lessico_select_authenticated on public.pmo_lessico;
create policy pmo_lessico_select_authenticated on public.pmo_lessico
  for select to authenticated using (true);

drop policy if exists pmo_lessico_insert_authenticated on public.pmo_lessico;
create policy pmo_lessico_insert_authenticated on public.pmo_lessico
  for insert to authenticated with check (true);

drop policy if exists pmo_lessico_update_authenticated on public.pmo_lessico;
create policy pmo_lessico_update_authenticated on public.pmo_lessico
  for update to authenticated using (true) with check (true);
