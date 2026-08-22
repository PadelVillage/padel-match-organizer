-- Padel Match Organizer — le RICEVUTE dei gesti passati dal canale del socio (voce 70).
-- Safe to run multiple times in Supabase SQL Editor.
-- Va eseguito sul progetto del GESTIONALE: qqbfphyslczzkxoncgex (PROD) e cudiqnrrlbyqryrtaprd (TEST).
--
-- 🗣️ Nasce da un difetto MISURATO al secondo la notte del 21/08/2026, durante il collaudo del
-- bot: Maurizio invita Lidia, Lidia tocca «Ci sto», il bot le dice «✅ Sei in campo» — e pochi
-- minuti dopo il **circolo** le annuncia che è stata aggiunta alla partita. Fra il proprio gesto
-- e l'avviso passavano fra 4 e 19 minuti.
--
-- 🔎 LA CAUSA È STRUTTURALE, NON UNA SVISTA, ed è il rovescio del pregio dichiarato in
-- `eventi-staff.ts`: quel modulo confronta **DATI**, non eventi — vede *cosa* è cambiato in una
-- partita e **non può sapere CHI** l'ha cambiato. La stessa scelta che regala gratis il ③
-- («toccato ≠ cambiato») rende impossibile distinguere il gesto della segreteria da quello del
-- socio. ⇒ *Un pregio dichiarato descrive metà di una scelta: l'altra metà è il difetto gemello,
-- e sta nella stessa riga.*
--
-- ⭐⭐ PERCHÉ LA CURA È UNA RICEVUTA, e perché sta di qua. L'informazione che manca al confronto
-- **il gestionale ce l'ha già**: la scrittura l'ha eseguita lui, in `consumer-booking-write`. Non
-- serve indovinarla a valle — basta che chi scrive lasci detto cosa ha scritto. È la regola
-- ferrea del 19/08 alla lettera: *il gestionale SA, il bot DICE*.
-- ⛔ La strada scartata, e va saputa: far confrontare al **bot** il fatto con un proprio ricordo
-- di ciò che ha appena chiesto. Sarebbe la memoria parallela esclusa dalla voce 64, e la 68 è
-- nata apposta per non averla.
--
-- ⚖️ COSA VUOL DIRE DAVVERO UNA RIGA QUI DENTRO, perché la regola di scarto ne discende:
-- *«questo cambiamento NON l'ha fatto la segreteria — è passato dal canale del socio»*. Gli
-- avvisi della voce 68 si chiamano «avvisi dal circolo» e dicono, in sostanza, *il circolo ha
-- fatto questo*: su un gesto arrivato dal bot quella frase è **falsa nell'attribuzione**, per
-- chiunque la riceva. Perciò si scarta il fatto, non solo quello di chi ha toccato il bottone.
-- 📌 E i conti tornano su tutti e cinque i gesti che il ponte sa scrivere (misurato il 22/08):
--   · `add` — il bot dice già «✅ Sei in campo» a chi entra  ⇒ l'avviso sarebbe un doppione;
--   · `remove` — il bot dice già «ti ha tolto X»             ⇒ doppione;
--   · `cancel` — il bot avvisa già tutti i compagni          ⇒ doppione;
--   · `leave` — il bot non avvisa NESSUNO, per decisione del committente, ma il fatto riguarda
--     chi è uscito **da sé**: annunciarglielo è il difetto della voce 70 in persona;
--   · `create` — dal bot nasce una partita col solo organizzatore, e l'organizzatore
--     `eventi-staff` lo salta già. La ricevuta si scrive lo stesso, ed è una rete: quel salto
--     poggia sull'ORDINE dell'elenco del circolo, che è una convenzione di Matchpoint; questa
--     riga invece è un fatto nostro, e regge anche il giorno in cui l'ordine cambiasse.

-- ── Le ricevute ───────────────────────────────────────────────────────────────────────────
create table if not exists public.pmo_ricevute_gesti (
  id uuid primary key default gen_random_uuid(),

  -- La partita, con la stessa chiave del readmodel e della coda: `data|ora|campo-in-cifre`.
  -- ⚠️ Si conserva per leggibilità e per le diagnosi: l'ACCOPPIAMENTO col fatto NON si fa su
  -- questa stringa ma sui tre campi qui sotto, normalizzati al momento del confronto. Il perché
  -- sta in `consumer-staff-events/ricevute.ts`: le due copie della stessa partita scrivono l'ora
  -- in due modi («09:30» e «09:30:00») e il campo in due modi («Campo 1» e «1»).
  slot text not null,
  data date not null,
  ora text not null default '',
  campo text not null default '',

  -- 🚨 La persona è un NOME, come nella coda dei fatti e per la stessa ragione: le prenotazioni
  -- identificano i giocatori solo per nome. Qui si scrive il nome che finisce SULLA SCHEDA DEL
  -- CIRCOLO, perché è quello che il sync rileggerà e con cui il fatto nascerà.
  persona text not null,

  gesto text not null,

  -- Chi ha chiesto la scrittura, e quale azione del ponte l'ha eseguita. ⚠️ Non servono
  -- all'accoppiamento: servono a chi legge i registri per capire, mesi dopo, perché un avviso
  -- non è partito. Una riga che sopprime un messaggio deve poter dire da sola perché.
  richiesta_da text not null default '',
  azione text not null default '',

  -- Quando il gestionale ha finito di scrivere. È l'istante da cui parte la finestra.
  scritta_at timestamptz not null default now(),

  -- Quando questa ricevuta ha coperto un fatto, e quale. NULL = non ha ancora coperto niente.
  -- 🚨⭐ SI CONSUMA, e non è un dettaglio contabile: una ricevuta che restasse buona per tutta
  -- la finestra potrebbe coprire un SECONDO fatto identico — e il secondo sarebbe della
  -- segreteria. Un socio che entra dal bot e che la segreteria toglie e rimette nella stessa
  -- mezz'ora deve sentire il secondo gesto. ⇒ Una ricevuta, un fatto.
  usata_at timestamptz,
  usata_da uuid,

  created_at timestamptz not null default now(),

  constraint pmo_ricevute_gesti_gesto_check check (gesto in ('aggiunto', 'tolto', 'annullata'))
);

-- La consegna chiede sempre «quali ricevute recenti non hanno ancora coperto niente»:
-- l'indice parziale tiene piccolo l'unico accesso caldo.
create index if not exists idx_pmo_ricevute_gesti_da_usare
  on public.pmo_ricevute_gesti(scritta_at)
  where usata_at is null;

-- ── Chi può leggerle ──────────────────────────────────────────────────────────────────────
-- 🚨 Nessuno, se non il service role — stesso ragionamento della coda dei fatti: queste righe
-- dicono CHI GIOCA CON CHI e QUANDO, ed è esattamente il dato che non deve poter uscire da una
-- query anonima.
alter table public.pmo_ricevute_gesti enable row level security;
-- Nessuna policy = nessun accesso per anon/authenticated. Il service role bypassa RLS.

-- ── La potatura ───────────────────────────────────────────────────────────────────────────
-- Stessi quattordici giorni della coda dei fatti, e per la stessa ragione: una tabella che non
-- si pota diventa un archivio di chi giocava con chi, tenuto per sempre e senza che nessuno
-- l'abbia chiesto. La finestra utile è di venti minuti — quattordici giorni sono per le
-- diagnosi, non per il meccanismo.
create or replace function public.pmo_ricevute_gesti_pota(giorni int default 14)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  quanti integer;
begin
  delete from public.pmo_ricevute_gesti
   where created_at < now() - make_interval(days => giorni);
  get diagnostics quanti = row_count;
  return quanti;
end;
$$;

comment on table public.pmo_ricevute_gesti is
  'Voce 70 — cosa il gestionale ha scritto su richiesta di un socio (dal bot). consumer-staff-events '
  'scarta il fatto che combacia con una ricevuta recente, cosi il circolo non annuncia al socio '
  'una cosa che ha appena fatto lui. Si pota con pmo_ricevute_gesti_pota().';
