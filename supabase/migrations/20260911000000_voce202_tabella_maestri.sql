-- Voce 202 — I MAESTRI DIVENTANO UNA TABELLA NOSTRA (e la voce 205 ci si appoggia).
--
-- 🗣️ Richiesta del committente, 10/09/2026: «bisogna creare un posto nel gestionale di test dove
-- si possono aggiungere e modificare i nomi dei maestri che poi si vedono dentro la scheda che si
-- apre dal calendario».
--
-- 📍 COSA SOSTITUISCE, e perché una tabella e non un file.
-- Fino a oggi l'elenco dei maestri è un ARRAY DENTRO UN FILE IN GIT:
-- `supabase/functions/parser-rules/parser_rules.json` → `campi_opzionali.istruttore.valori_validi`
-- = ['LoZio', 'Spinazze', 'Lucas Vidal'].
-- ⇒ Per aggiungere un maestro bisogna modificare un file in git, e la segreteria non può.
-- 🚨 E non è solo scomodo: l'app quel file lo SCARICA A RUNTIME da `raw.githubusercontent.com`
-- (`index.html:41550`), con un ripiego cablato sugli stessi tre nomi. È **la stessa strada della
-- voce 58** — il 17/08 GitHub strozzò quei download anonimi (429) e TEST restò a terra.
-- 📌 Una lista che si modifica altrove non è configurazione: è codice travestito.
--
-- ⭐⭐ E QUESTA TABELLA PORTA UN DATO CHE OGGI NON ESISTE DA NESSUNA PARTE: `nome`.
-- Il campo `istruttore` di una prenotazione porta un CODICE del circolo (`Spinazze`); nel roster
-- la stessa persona compare col suo NOME (`Gianluca Spinazzè`). I due non si somigliano, e senza
-- un posto che li leghi **non c'è modo di sapere che sono la stessa persona**.
-- ⇒ È il dato che serve alla voce 205: per dire «Lezione con il maestro, insieme agli allievi»
-- bisogna prima poter TOGLIERE il maestro dall'elenco degli allievi, e per toglierlo bisogna
-- riconoscerlo.
-- ⚠️ `parser_rules.json` ha già un `fuzzy_match`, ma è un'altra cosa e non serve a questo: lega
-- errori di BATTITURA al codice ('Lo Zio'→'LoZio', 'Vidal'→'Lucas Vidal'), non il codice alla
-- persona. Nessuna delle sue voci nomina Maurizio Aprea né Gianluca Spinazzè.
--
-- 📏 IL SEME È MISURATO, NON SUPPOSTO — 10/09/2026, su tutte le 47 lezioni vive di `cudi` che
-- dichiarano un maestro. Per ognuno dei tre codici il roster contiene SEMPRE la stessa persona,
-- e mai quella di un altro:
--
--     codice        lezioni   il roster contiene…
--     LoZio            9      «Maurizio Aprea»      9 su 9      (zero Lucas, zero Spinazzè)
--     Lucas Vidal     35      «Lucas Vidal»        35 su 35     (zero Maurizio, zero Spinazzè)
--     Spinazze         3      «Gianluca Spinazzè»   3 su 3      (zero Maurizio, zero Lucas)
--
-- 🚨 E il legame `LoZio` = `Maurizio Aprea` NON è stato dedotto da quel 9 su 9: la misura ha fatto
-- nascere la domanda, e **l'ha confermato il committente** (10/09/2026, è lui). La differenza
-- conta: 9 casi su 9 sono compatibili anche con «un allievo che va sempre dallo stesso maestro»,
-- e quella lettura avrebbe prodotto la tabella opposta.
-- 📌 Una coincidenza perfetta non è una prova d'identità: è una domanda ben posta.
--
-- ⚖️ PERCHÉ IL MAESTRO STA NEL ROSTER, e perché la tabella serve lo stesso dopo il distacco.
-- Sulle lezioni che arrivano dal sync il maestro OCCUPA UN POSTO IN CAMPO (47 su 47). Su una
-- lezione nata da noi non è detto: `istruttore` e l'elenco dei giocatori sono due campi separati,
-- e il maestro ci finisce solo se qualcuno ce lo aggiunge a mano. ⇒ Chi legge deve reggere
-- **tutt'e due i mondi**, e in tutt'e due la domanda è la stessa: «questo nome è il maestro?».
--
-- ⛔ COSA QUESTA TABELLA NON FA:
--   · non decide chi può tenere una lezione (nessun permesso, nessun ruolo: è un elenco di nomi);
--   · non lega il maestro a un socio dell'anagrafica — `nome` è testo, e resta testo: il maestro
--     può non essere un socio, e un domani due persone potrebbero chiamarsi uguale. Quel giorno
--     questa tabella cresce di una colonna, non si riscrive;
--   · non tocca `parser_rules.json`, che resta la fonte finché l'app non legge di qui. ⚠️ Due
--     elenchi che devono restare uguali sono un debito dichiarato: si chiude togliendo l'altro,
--     non tenendoli allineati a mano.
--
-- ↩️ RIPRISTINO VERBATIM (annulla per intero questa migrazione):
--   drop function if exists public.pmo_set_maestri(jsonb);
--   drop function if exists public.pmo_get_maestri();
--   drop table if exists public.pmo_maestri;
--
-- Idempotente: si può rieseguire.

-- ────────────────────────────────────────────────────────────────────────────────
-- ① LA TABELLA
-- ────────────────────────────────────────────────────────────────────────────────
create table if not exists public.pmo_maestri (
  -- Il codice com'è scritto nel campo `istruttore` di una prenotazione. Chiave TESTUALE come in
  -- `pmo_fasce_prenotabili`, e per la stessa ragione: questo è un seme riletto a ogni deploy, e
  -- con una chiave generata al secondo giro nascerebbero tre maestri doppi.
  codice      text        primary key,

  -- 👤 LA PERSONA, scritta COM'È NEL ROSTER. È la colonna che non esiste da nessun'altra parte.
  -- ⚠️ Non è «il nome bello»: è la stringa con cui questa persona compare fra i giocatori, perché
  -- il suo mestiere è farsi riconoscere lì dentro. Se un domani il circolo la scrivesse in due
  -- modi, il posto dove si aggiunge il secondo è qui.
  nome        text        not null,

  -- Un maestro che non tiene più lezioni si SPEGNE, non si cancella: le sue lezioni passate
  -- restano, e continuare a riconoscerlo nel loro roster è esattamente ciò che serve.
  attivo      boolean     not null default true,

  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Un codice o un nome vuoti renderebbero la tabella inutile nel modo peggiore: senza errore.
  -- Il riconoscimento del maestro nel roster confronta stringhe — con `nome` vuoto passerebbe
  -- tutto o niente, a seconda di come è scritto il confronto, e nessuno se ne accorgerebbe.
  constraint pmo_maestri_codice_non_vuoto check (btrim(codice) <> ''),
  constraint pmo_maestri_nome_non_vuoto   check (btrim(nome)   <> '')
);

-- Si cerca per nome quando si deve capire se un giocatore del roster è il maestro.
create index if not exists idx_pmo_maestri_attivo
  on public.pmo_maestri (attivo) where attivo;

-- RLS accesa SENZA policy: la porta sono le due funzioni qui sotto, `security definer`, con la
-- guardia dello staff dentro. Stesso assetto della voce 176, e per la stessa ragione: i grant si
-- danno alle funzioni, non alla tabella.
-- ⚠️ L'edge `consumer-player-readmodel` legge con la chiave di servizio, che la RLS non attraversa:
-- per lui la tabella è leggibile e basta. È voluto — è il gestionale che risolve il maestro, non
-- il bot (⇒ «il gestionale SA, il bot DICE»).
alter table public.pmo_maestri enable row level security;

-- ────────────────────────────────────────────────────────────────────────────────
-- ② IL SEME — i tre di oggi, con la persona misurata
-- ────────────────────────────────────────────────────────────────────────────────
-- 🚨 `on conflict do nothing` e non `do update`: questa migrazione si rilegge a ogni deploy, e un
-- `do update` riscriverebbe ogni volta le correzioni fatte dalla segreteria — cioè il seme
-- vincerebbe per sempre sul dato vero, che è l'esatto contrario di ciò per cui la tabella nasce.
insert into public.pmo_maestri (codice, nome, note) values
  ('LoZio',       'Maurizio Aprea',    'Confermato dal committente il 10/09/2026: «LoZio sono io». Nel roster compare come Maurizio Aprea.'),
  ('Spinazze',    'Gianluca Spinazzè', 'Il codice non porta l''accento, il roster sì: è la ragione per cui questa colonna esiste.'),
  ('Lucas Vidal', 'Lucas Vidal',       'Codice e nome coincidono. ⚠️ Nel roster compare anche tutto minuscolo («-lucas vidal.»): il confronto va fatto senza distinguere maiuscole.')
on conflict (codice) do nothing;

-- ────────────────────────────────────────────────────────────────────────────────
-- ③ LEGGERLI
-- ────────────────────────────────────────────────────────────────────────────────
create or replace function public.pmo_get_maestri()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_righe jsonb;
begin
  select * into v_actor from public.pmo_current_staff_profile() limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'codice', codice,
             'nome',   nome,
             'attivo', attivo,
             'note',   note
           ) order by attivo desc, codice), '[]'::jsonb)
  into v_righe
  from public.pmo_maestri;

  return jsonb_build_object('ok', true, 'maestri', v_righe);
end;
$$;

revoke all on function public.pmo_get_maestri() from public;
revoke all on function public.pmo_get_maestri() from anon;
grant execute on function public.pmo_get_maestri() to authenticated;

-- ────────────────────────────────────────────────────────────────────────────────
-- ④ SCRIVERLI — dall'Amministrazione, non a mano nel database
-- ────────────────────────────────────────────────────────────────────────────────
-- Riceve l'elenco COMPLETO dei maestri e lo fa diventare lo stato della tabella.
--
-- 🚨 A DIFFERENZA DELLE FASCE, QUI NON SI CANCELLA NIENTE, e la differenza è di sostanza.
-- Una fascia sparita è una fascia che non si prenota più: nessuno la stava già usando. Un maestro
-- cancellato invece **smette di essere riconoscibile dentro le lezioni che ha già tenuto** — e da
-- quel momento il bot ricomincia a chiamarlo «allievo» in tutto il passato, che è esattamente il
-- difetto della voce 205 fatto tornare da un salvataggio.
-- ⇒ Chi sparisce dall'elenco viene SPENTO (`attivo = false`), non tolto. Chi torna si riaccende.
-- 📌 Un elenco che si può svuotare per sbaglio non va protetto dal caso vuoto: va reso incapace
-- di perdere quello che gli è stato dato.
create or replace function public.pmo_set_maestri(p_maestri jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor   record;
  v_codici  text[];
  v_toccati int := 0;
  v_spenti  int := 0;
begin
  select * into v_actor from public.pmo_current_staff_profile() limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;

  if p_maestri is null or jsonb_typeof(p_maestri) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'ELENCO_NON_VALIDO');
  end if;

  -- ⛔ Un elenco vuoto spegnerebbe TUTTI i maestri in un colpo — cioè il danno della voce 205 su
  -- ogni lezione insieme. Si rifiuta, come le fasce rifiutano il vuoto: il caso vero («non ci sono
  -- più maestri») si ottiene spegnendoli uno per uno, che è un gesto che si vede.
  if jsonb_array_length(p_maestri) = 0 then
    return jsonb_build_object('ok', false, 'error', 'ELENCO_VUOTO');
  end if;

  -- Ogni riga deve avere codice e nome non vuoti: senza `nome` il maestro non si riconosce nel
  -- roster, ed è come non averlo messo — ma in silenzio.
  if exists (
    select 1 from jsonb_array_elements(p_maestri) r
    where btrim(coalesce(r->>'codice', '')) = ''
       or btrim(coalesce(r->>'nome',   '')) = ''
  ) then
    return jsonb_build_object('ok', false, 'error', 'CODICE_O_NOME_MANCANTE');
  end if;

  with righe as (
    select btrim(r->>'codice')                                as codice,
           btrim(r->>'nome')                                  as nome,
           coalesce((r->>'attivo')::boolean, true)            as attivo,
           nullif(btrim(coalesce(r->>'note', '')), '')        as note
    from jsonb_array_elements(p_maestri) r
  ), scritte as (
    insert into public.pmo_maestri as m (codice, nome, attivo, note)
    select codice, nome, attivo, note from righe
    on conflict (codice) do update
      set nome       = excluded.nome,
          attivo     = excluded.attivo,
          note       = excluded.note,
          updated_at = now()
    returning m.codice
  )
  select array_agg(codice) into v_codici from scritte;

  v_toccati := coalesce(array_length(v_codici, 1), 0);

  -- Chi non è nell'elenco si SPEGNE (vedi il blocco qui sopra: non si cancella).
  update public.pmo_maestri
     set attivo = false, updated_at = now()
   where attivo
     and not (codice = any (coalesce(v_codici, array[]::text[])));
  get diagnostics v_spenti = row_count;

  return jsonb_build_object('ok', true, 'scritti', v_toccati, 'spenti', v_spenti);
end;
$$;

revoke all on function public.pmo_set_maestri(jsonb) from public;
revoke all on function public.pmo_set_maestri(jsonb) from anon;
grant execute on function public.pmo_set_maestri(jsonb) to authenticated;
