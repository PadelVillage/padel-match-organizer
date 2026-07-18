-- Progetto CONSUMER `aylykijfirtegyxzdwgu` — GIÀ APPLICATA il 18/07/2026.
-- Versionata qui perché quel progetto non ha una CI: senza copia in repo il
-- suo schema esisterebbe solo in dashboard.
--
-- Challenge di login dell'app consumer: la riga che tiene insieme i due passi
-- «email confrontata» e «codice a 6 cifre», e che fa da substrato al rate limit.
--
-- Tabella SOLO service_role: RLS attiva e NESSUNA policy, più revoke espliciti.
-- Contiene l'email in anagrafica del socio, che non deve mai raggiungere il
-- browser — è tutto il senso del login (il codice va all'indirizzo in scheda,
-- mai a quello digitato).
--
-- Le challenge DECOY sono quelle create quando l'email digitata NON combacia:
-- stessa risposta al client, nessun codice spedito, verifica sempre fallita.
-- Servono a non far diventare l'app un oracolo per indovinare le email dei soci.

create table if not exists public.consumer_login_challenges (
  id          uuid        primary key default gen_random_uuid(),
  phone_hash  text        not null,
  member_id   text,
  email       text,
  decoy       boolean     not null default false,
  attempts    smallint    not null default 0,
  consumed_at timestamptz,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '10 minutes'),

  -- Stesso formato imposto da consumer_profiles: 6 cifre zero-padded.
  constraint consumer_login_challenges_member_id_fmt
    check (member_id is null or member_id ~ '^[0-9]{6}$'),

  -- Invariante: una challenge decoy non porta identità. Se questo CHECK
  -- scattasse significherebbe che un ramo del codice ha confuso i due casi.
  constraint consumer_login_challenges_decoy_senza_identita
    check (not decoy or (member_id is null and email is null))
);

comment on table public.consumer_login_challenges is
  'Login app consumer: stato fra «email confrontata» e «codice verificato». Solo service_role.';
comment on column public.consumer_login_challenges.phone_hash is
  'SHA-256 delle ultime 10 cifre del telefono: chiave del rate limit, senza tenere il numero in chiaro.';
comment on column public.consumer_login_challenges.decoy is
  'true = email digitata non combaciante: nessun codice spedito, la verifica fallisce sempre.';
comment on column public.consumer_login_challenges.email is
  'Email IN ANAGRAFICA a cui è stato spedito il codice. Azzerata al consumo. Mai esposta al client.';

-- Rate limit: quante challenge per quel telefono nell'ultima ora.
create index if not exists consumer_login_challenges_rate_idx
  on public.consumer_login_challenges (phone_hash, created_at desc);

alter table public.consumer_login_challenges enable row level security;

-- Nessuna policy: con RLS attiva e zero policy, anon e authenticated non
-- leggono e non scrivono nulla. I revoke tolgono anche i grant di default che
-- Supabase concede alle nuove tabelle in public.
revoke all on public.consumer_login_challenges from anon, authenticated;
