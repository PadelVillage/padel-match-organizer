-- Progetto CONSUMER `aylykijfirtegyxzdwgu`.
-- Versionata qui perché quel progetto non ha una CI: senza copia in repo il
-- suo schema esisterebbe solo in dashboard.
--
-- Rate limit del passo `identify`, che fino al 18/07/2026 non ne aveva.
--
-- Perché adesso: finché il ponte sul gestionale non era deployato, `identify`
-- rispondeva `BRIDGE_DOWN` e il limite dichiarato nel README era inerte. Dal
-- merge della #539 il passo risponde davvero, quindi la mappa telefono → nome
-- di battesimo è diventata effettivamente estraibile.
--
-- Cosa protegge, e cosa no. Non protegge un account: `identify` restituisce il
-- solo nome di battesimo, e per entrare serve comunque l'email in scheda più il
-- codice (quel passo, `challenge`, è limitato a parte). Protegge l'ANAGRAFICA:
-- senza limite, chi possiede una lista di numeri può sapere in pochi minuti
-- quali appartengono a soci del circolo, e con che nome. È un dato personale che
-- rivela un'affiliazione, quindi il tema è privacy, non autenticazione.
--
-- La chiave è l'IP, non il telefono: qui si difende l'anagrafica nel suo
-- insieme, e chi la setaccia cambia numero a ogni richiesta — un contatore per
-- telefono non lo vedrebbe nemmeno.
--
-- ⚠️ Mitigante, non barriera: chi ruota indirizzo IP aggira il limite. Alza il
-- costo di due-tre ordini di grandezza, non lo rende impossibile.
--
-- Tabella SOLO service_role: RLS attiva e NESSUNA policy, più revoke espliciti,
-- come consumer_login_challenges.

create table if not exists public.consumer_identify_throttle (
  id         uuid        primary key default gen_random_uuid(),
  ip_hash    text        not null,
  created_at timestamptz not null default now()
);

comment on table public.consumer_identify_throttle is
  'Rate limit del passo identify del login consumer, per IP. Solo service_role.';
comment on column public.consumer_identify_throttle.ip_hash is
  'SHA-256 dell''IP del chiamante. Hashato perché l''IP è un dato personale e qui serve solo per contare, mai per risalire a qualcuno.';

-- L'unica interrogazione è «quante richieste da questo ip_hash nell'ultima ora».
create index if not exists consumer_identify_throttle_rate_idx
  on public.consumer_identify_throttle (ip_hash, created_at desc);

-- Serve alla purga, che cancella per sola data attraverso tutti gli ip_hash.
create index if not exists consumer_identify_throttle_purge_idx
  on public.consumer_identify_throttle (created_at);

alter table public.consumer_identify_throttle enable row level security;

-- Nessuna policy: con RLS attiva e zero policy, anon e authenticated non
-- leggono e non scrivono nulla. I revoke tolgono anche i grant di default che
-- Supabase concede alle nuove tabelle in public.
revoke all on public.consumer_identify_throttle from anon, authenticated;
