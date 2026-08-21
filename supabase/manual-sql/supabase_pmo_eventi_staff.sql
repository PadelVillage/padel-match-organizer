-- Padel Match Organizer — la CODA DEI FATTI che il gestionale dichiara al bot (voce 68).
-- Safe to run multiple times in Supabase SQL Editor.
-- Va eseguito sul progetto del GESTIONALE: qqbfphyslczzkxoncgex (PROD) e cudiqnrrlbyqryrtaprd (TEST).
--
-- 🗣️ Nasce dalla segnalazione del committente: «quando da gestionale faccio un'azione, cioè metto,
-- levo giocatori o attivo partite o elimino partite, sul bot dei soci non succede niente».
--
-- ⭐⭐ PERCHÉ LA CODA VIVE QUI, sul gestionale, e non nel database del bot (ayly…):
-- è la regola ferrea del 19/08/2026 — *il gestionale SA, il bot DICE*. Il gestionale dichiara
-- **cosa è successo**; il bot legge questa coda attraverso `consumer-staff-events`, come già fa
-- con le altre quattro `consumer-*`, e decide **se e quando** dirlo. Nessuna credenziale
-- incrociata: il sync scrive solo dove ha già le proprie chiavi.
--
-- ⚖️ E la difesa contro il doppione NON è qui: sta nel bot, dove vivono già le memorie di
-- processo (`in-corso.ts`, `fatto-compiuto.ts`) e il registro degli avvisi. Questa tabella
-- ricorda soltanto **se un fatto è già stato consegnato**, che è un'altra domanda.

-- ── La coda ───────────────────────────────────────────────────────────────────────────────
create table if not exists public.pmo_eventi_staff (
  id uuid primary key default gen_random_uuid(),

  -- La partita, con la stessa chiave che usa il readmodel: `data|ora|campo-in-cifre`.
  slot text not null,
  data date not null,
  ora text not null default '',
  campo text not null default '',

  -- 🚨 La persona è un NOME, non un id, ed è deliberato: le prenotazioni identificano i
  -- giocatori solo per nome (non c'è id nel payload Matchpoint). A risolvere il nome in una
  -- scheda è `consumer-staff-events` al momento della consegna — e FAIL CLOSED sugli omonimi,
  -- perché scrivere alla persona sbagliata è peggio che non scrivere.
  persona text not null,

  gesto text not null,

  -- Quando il sync ha VISTO il cambiamento. È l'istante su cui si misurano i due minuti di
  -- quiete della decisione ②: finché l'ultimo fatto di una coppia (persona, slot) è più
  -- recente di così, la segreteria potrebbe non aver finito.
  visto_at timestamptz not null default now(),

  -- Quando il fatto è stato consegnato al bot. NULL = ancora in coda.
  -- ⚠️ «Consegnato» vuol dire *il bot l'ha ritirato*, non *il socio l'ha letto*: se il bot
  -- cade fra il ritiro e l'invio quel messaggio è perso, ed è il verso giusto in cui perderlo
  -- — un avviso in meno è un fastidio, un avviso doppio è il difetto che la voce 63 evita.
  consegnato_at timestamptz,

  created_at timestamptz not null default now(),

  constraint pmo_eventi_staff_gesto_check check (gesto in ('aggiunto', 'tolto', 'annullata'))
);

-- Il ritiro chiede sempre «cosa non è ancora consegnato»: l'indice parziale tiene piccolo
-- l'unico accesso caldo, anche quando la storia sarà lunga.
create index if not exists idx_pmo_eventi_staff_da_consegnare
  on public.pmo_eventi_staff(visto_at)
  where consegnato_at is null;

-- La riduzione al netto raggruppa per (persona, slot): togli-e-rimetti si annulla.
create index if not exists idx_pmo_eventi_staff_coppia
  on public.pmo_eventi_staff(persona, slot)
  where consegnato_at is null;

-- ── Chi può leggerla ──────────────────────────────────────────────────────────────────────
-- 🚨 Nessuno, se non il service role. Questa tabella dice CHI GIOCA CON CHI e QUANDO per
-- tutto il circolo: è esattamente il genere di dato che non deve poter uscire da una query
-- anonima. L'unica porta è `consumer-staff-events`, dietro `X-Consumer-Secret`.
alter table public.pmo_eventi_staff enable row level security;

drop policy if exists pmo_eventi_staff_no_public on public.pmo_eventi_staff;
-- Nessuna policy = nessun accesso per anon/authenticated. Il service role bypassa RLS.

-- ── La potatura ───────────────────────────────────────────────────────────────────────────
-- Una coda che non si pota diventa un archivio di chi giocava con chi, tenuto per sempre e
-- senza che nessuno l'abbia chiesto. Quattordici giorni bastano a qualunque diagnosi.
create or replace function public.pmo_eventi_staff_pota(giorni int default 14)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  quanti integer;
begin
  delete from public.pmo_eventi_staff
   where created_at < now() - make_interval(days => giorni)
  returning 1 into quanti;
  get diagnostics quanti = row_count;
  return quanti;
end;
$$;

comment on table public.pmo_eventi_staff is
  'Voce 68 — i fatti che il gestionale dichiara al bot: chi è stato aggiunto, tolto o ha visto '
  'saltare la partita, per mano dello staff. Il bot li ritira via consumer-staff-events e '
  'decide se e quando dirli. Si pota con pmo_eventi_staff_pota().';
