-- 🚨⭐⭐ VOCE 76 — CHI HA RIEMPITO IL FATTO: la CONFERMA del circolo, o lo SPECCHIO.
--
-- 🗣️ Promossa dal committente il 23/08/2026 (*«mettila tra le urgenti»*), dopo che la prova
-- della voce 74 gli aveva messo il ritardo davanti all'orologio: *«questi tempi sono troppo
-- lunghi… sul gestionale lo spostamento è avvenuto entro un minuto»*.
--
-- 🚨 MA L'ARGOMENTO NON È LA VELOCITÀ, ed è la cosa da non dimenticare leggendo questa riga.
-- Fino a oggi l'UNICO posto che riempiva `pmo_eventi_staff` era `matchpoint-bookings-sync`,
-- e quel sync **vive leggendo Matchpoint**. ⇒ Il giorno in cui Matchpoint si spegne, gli
-- avvisi ai soci non rallentano: **cessano**. Il gestionale continuerebbe a sapere tutto — le
-- scritture le esegue lui — ma la strada per dirlo al socio passa da una fonte che quel giorno
-- non c'è più.
-- ⚖️ È il rovescio della regola di `CLAUDE.md`: *«il giorno in cui Matchpoint si spegne, il bot
-- non si tocca»*. Vera per il **bot**, falsa per **ciò che il gestionale ha da dirgli**.
--
-- 🎯 La cura è il disegno che il committente ha dato il 22/08: l'ok di Matchpoint torna al
-- gestionale e **si ferma lì**; da quel punto a parlare col socio è sempre e solo il
-- gestionale. Questa colonna è ciò che rende la cosa DECIDIBILE sui dati: dice, per ogni riga,
-- se il fatto l'ha dichiarato il gestionale su una conferma in mano, o se l'ha ri-scoperto lo
-- specchio rileggendo Matchpoint minuti dopo.
--
-- ⚖️ PERCHÉ UNA COLONNA E NON UN'ALTRA TABELLA: il paletto 3 della scheda dice che il fatto
-- continua a nascere in `pmo_eventi_staff` — cambia **chi lo riempie**, non chi lo legge. Una
-- seconda tabella avrebbe costretto `consumer-staff-events` a fondere due code, cioè a
-- cambiare proprio il pezzo che il paletto protegge.
--
-- 🚨 E NON ESCE VERSO IL BOT: `consumer-staff-events` la usa per decidere quanto aspettare, e
-- non la mette nella risposta. Al bot arrivano i gesti che già conosce (`spostata`,
-- `annullata`, `aggiunto`, `tolto`) e nient'altro — è il paletto 4, zero righe nel suo repo.
--
-- Da applicare A MANO su qqbfphyslczzkxoncgex (PROD) e cudiqnrrlbyqryrtaprd (TEST),
-- PRIMA del codice che la scrive.

-- ⚠️ `default 'sync'` e non `not null` senza default: le righe già in coda al momento della
-- migrazione sono tutte nate dallo specchio, e devono continuare a valere esattamente come
-- prima — quiete piena compresa. Il verso in cui si sbaglia è «aspetto troppo», non «parlo
-- troppo presto».
alter table public.pmo_eventi_staff
  add column if not exists origine text not null default 'sync';

alter table public.pmo_eventi_staff
  drop constraint if exists pmo_eventi_staff_origine_check;

-- 🚨 Il `check` c'è perché questa colonna governa QUANTO SI ASPETTA prima di parlare a un
-- socio: un valore inatteso finirebbe nel ramo «non è una conferma» e allungherebbe l'attesa
-- in silenzio. Meglio un rifiuto del database, che si vede.
alter table public.pmo_eventi_staff
  add constraint pmo_eventi_staff_origine_check
  check (origine in ('sync', 'conferma'));

-- Il dedup della metà B chiede sempre la stessa cosa: «di questo slot, per questa persona,
-- con questo gesto, c'è già una dichiarazione da conferma nell'ultimo quarto d'ora?».
-- L'indice parziale tiene piccolo l'unico accesso caldo: le righe da conferma sono la
-- minoranza, e quelle vecchie non interessano.
create index if not exists idx_pmo_eventi_staff_conferme_recenti
  on public.pmo_eventi_staff(slot, persona, gesto, visto_at)
  where origine = 'conferma';

comment on column public.pmo_eventi_staff.origine is
  'Voce 76 — chi ha riempito il fatto: conferma = il gestionale lo ha dichiarato appena il '
  'circolo ha detto sì (istante vero); sync = lo specchio lo ha ri-scoperto rileggendo '
  'Matchpoint (visto_at è l''istante del giro, non del gesto). Non esce mai verso il bot.';
