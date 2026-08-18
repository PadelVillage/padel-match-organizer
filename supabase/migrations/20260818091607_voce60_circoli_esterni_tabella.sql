-- Voce 60 — «Campi liberi nei circoli vicini», PASSO 1 del disegno.
-- Disegno completo: docs/circoli-esterni-disegno.md
--
-- Questo passo fa SOLO due cose: crea l'anagrafica dei circoli e la strada per
-- leggerla. NESSUNO SCAN, nessuna credenziale, nessun contatto coi portali altrui.
-- Le colonne della geometria (slot_minuti, apertura, chiusura, campi) e quelle
-- dell'ultimo scan nascono VUOTE di proposito: le riempirà `circoli-scan` al passo 2.
-- ⚠️ Vuote vuol dire vuote: chi legge questa tabella oggi non sa a che ora apre
-- nessuno di questi circoli, e la sezione deve dirlo invece di disegnare un trattino
-- che sembra un dato.
--
-- ↩️ RIPRISTINO VERBATIM (annulla per intero questa migrazione):
--   drop function if exists public.pmo_get_circoli_esterni();
--   drop table if exists public.pmo_circoli_esterni;
--
-- ────────────────────────────────────────────────────────────────────────────────
-- ① L'ANAGRAFICA
-- ────────────────────────────────────────────────────────────────────────────────
create table if not exists public.pmo_circoli_esterni (
  -- Chiave TESTUALE e non uuid: questa tabella è un seme scritto a mano e riletto a
  -- ogni deploy, e con una chiave generata il seme non sarebbe idempotente — al
  -- secondo giro nascerebbero nove circoli doppi. Lo slug è anche ciò che il passo 2
  -- userà per legare le fotografie al circolo, ed è leggibile in un log.
  id                text        primary key,
  nome              text        not null,
  comune            text        not null,

  -- 📍 NON MISURATE, e per questo nascono NULL invece che con un valore plausibile.
  -- Il disegno le chiede perché il perimetro è «vicinanza, non provincia», ma le
  -- coordinate dei nove circoli nessuno le ha ancora rilevate. Scriverne di
  -- verosimili qui vorrebbe dire che al passo 2 l'ordinamento per distanza
  -- funzionerebbe *sembrando* giusto: è il difetto peggiore, non quello più visibile.
  lat               double precision,
  lon               double precision,

  piattaforma       text        not null,
  base_url          text,

  stato_utenza      text        not null default 'assente',
  attivo            boolean     not null default false,

  -- 🚨 La geometria si RILEVA dalla pagina, non si assume: il disegno misura 90′ al
  -- Marco Polo, 60′ a Padel Conegliano e fasce orarie allo Sporting Life, e la
  -- differenza sta DENTRO il padel. Perciò qui non c'è nessun valore predefinito:
  -- un `slot_minuti` che nasce a 60 sarebbe una supposizione travestita da misura.
  slot_minuti       integer,
  apertura          time,
  chiusura          time,
  campi             text[],

  ultimo_scan_at    timestamptz,
  ultimo_esito      text,
  ultima_latenza_ms integer,

  -- Il perché di uno stato, in italiano. Non è decorazione: «in approvazione» e
  -- «assente» sono stati che dipendono da UNA PERSONA di quel circolo, e senza il
  -- perché nessuno saprebbe più cosa chiedere né a chi. Sono le «questioni aperte»
  -- del disegno, tenute accanto alla riga a cui appartengono invece che in un elenco
  -- che invecchia da un'altra parte.
  note              text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint pmo_circoli_esterni_piattaforma_ck
    check (piattaforma in ('wansport', 'matchpoint', 'playtomic')),
  constraint pmo_circoli_esterni_stato_utenza_ck
    check (stato_utenza in ('attiva', 'in_approvazione', 'assente')),

  -- ⛔ Un circolo che si INTERROGA senza indirizzo non si può leggere: il vincolo
  -- impedisce che una riga muta arrivi fino allo scanner e ci muoia dentro.
  -- ⚖️ Vincola solo gli `attivo`, di proposito: dei circoli non operativi l'indirizzo
  -- NON è stato rilevato, e obbligarlo qui costringerebbe a dedurlo dal formato degli
  -- altri — cioè a scrivere una misura inventata dentro il vincolo che dovrebbe
  -- garantirla. Un indirizzo assente è un fatto; uno indovinato è un guasto che
  -- aspetta il giorno in cui qualcuno accende quella riga.
  constraint pmo_circoli_esterni_base_url_ck
    check (attivo = false or piattaforma = 'matchpoint' or base_url is not null),

  -- 🚨⭐ IL VINCOLO CHE CONTA: `attivo` non può stare in piedi da solo.
  -- Interrogare un circolo la cui utenza è «in approvazione» o «assente» produce un
  -- login rifiutato a ogni giro — cioè rumore verso un portale di terzi, che è
  -- esattamente il modo di farsi chiudere l'account (la questione aperta n.1 del
  -- disegno). La regola sta QUI e non nello scanner perché lo scanner è codice che
  -- un domani si riscrive, e questa tabella è ciò che gli sopravvive.
  constraint pmo_circoli_esterni_attivo_richiede_utenza_ck
    check (attivo = false or stato_utenza = 'attiva')
);

comment on table public.pmo_circoli_esterni is
  'Voce 60 — anagrafica dei circoli della zona di cui leggere i campi liberi. SOLA LETTURA verso l''esterno: qui non si prenota nulla. Le credenziali NON stanno in questa tabella (account Wansport unico, nei segreti della edge function).';
comment on column public.pmo_circoli_esterni.attivo is
  'Se interrogarlo allo scan. Vincolato: può essere true solo con stato_utenza = attiva.';
comment on column public.pmo_circoli_esterni.base_url is
  'Radice del portale. NULL quando non è stata rilevata (circoli non operativi). NULL anche per Padel Village: il suo calendario si legge dal gestionale, e il suo tenant Wansport è MORTO (licenza scaduta il 16/02/2021) — non va interrogato.';
comment on column public.pmo_circoli_esterni.lat is
  'NON ancora rilevata. Nasce NULL di proposito: vedi il commento nella migrazione.';

create index if not exists idx_pmo_circoli_esterni_attivo
  on public.pmo_circoli_esterni (attivo, piattaforma);

-- RLS accesa SENZA policy: la porta è la funzione qui sotto, che è `security definer`
-- e ha la guardia dello staff dentro di sé. È l'assetto voluto (il linter lo segnala
-- come `rls_enabled_no_policy`, che è INFO e non un buco): una policy in più sarebbe
-- una seconda porta da tenere chiusa, e la lezione della voce 50 è che la guardia va
-- messa DENTRO la funzione, perché i grant si possono ridare per sbaglio.
alter table public.pmo_circoli_esterni enable row level security;

-- ────────────────────────────────────────────────────────────────────────────────
-- ② LA STRADA PER LEGGERLA
-- ────────────────────────────────────────────────────────────────────────────────
-- 🔒 Guardia: profilo staff ATTIVO, e nient'altro.
-- Nessun permesso specifico, e la ragione è scritta perché non sembri una svista:
-- qui non c'è un solo dato personale — sono nove indirizzi di circoli, pubblici come
-- l'insegna sulla porta — quindi un permesso in più proteggerebbe qualcosa che non
-- ha bisogno di protezione, e in cambio lascerebbe fuori chi la sezione la deve
-- guardare. A governare CHI vede la voce di menu è già `view_admin_circoli` nell'app.
-- ⚖️ Ciò che invece NON deve poter leggere questa tabella è `anon`, e infatti la
-- guardia risponde AUTH_REQUIRED prima di toccare una riga.
create or replace function public.pmo_get_circoli_esterni()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_righe jsonb;
begin
  select * into v_actor
  from public.pmo_current_staff_profile()
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  end if;

  select coalesce(jsonb_agg(riga order by ord, nome), '[]'::jsonb)
  into v_righe
  from (
    select
      -- Gli operativi in cima, poi chi aspetta un'approvazione, poi chi non ha
      -- utenza: è l'ordine in cui la segreteria ha qualcosa da farci.
      case
        when c.attivo then 0
        when c.stato_utenza = 'in_approvazione' then 1
        else 2
      end as ord,
      c.nome,
      to_jsonb(c) - 'created_at' as riga
    from public.pmo_circoli_esterni c
  ) s;

  return jsonb_build_object('ok', true, 'circoli', v_righe);
end;
$$;

revoke all on function public.pmo_get_circoli_esterni() from public;
revoke all on function public.pmo_get_circoli_esterni() from anon;
grant execute on function public.pmo_get_circoli_esterni() to authenticated;

-- ────────────────────────────────────────────────────────────────────────────────
-- ③ IL SEME — i circoli del disegno, con lo stato che il disegno ha MISURATO
-- ────────────────────────────────────────────────────────────────────────────────
-- Idempotente: rilanciare la migrazione riallinea le colonne dell'anagrafica e NON
-- tocca né la geometria né l'esito dell'ultimo scan, che appartengono allo scanner.
insert into public.pmo_circoli_esterni
  (id, nome, comune, piattaforma, base_url, stato_utenza, attivo, note)
values
  -- ⚠️ Padel Village è il caso a parte: NON si interroga su Wansport. Il suo tenant
  -- (padelvillage.wansport.com) è morto con la licenza ENTERPRISE scaduta il
  -- 16/02/2021; il suo calendario si legge dal gestionale, con un lettore diverso.
  ('padel-village',      'Padel Village',                'Conegliano',       'matchpoint', null,
     'attiva', true,  'Casa nostra: il calendario si legge dal gestionale, non da Wansport. Il tenant padelvillage.wansport.com è MORTO (licenza ENTERPRISE scaduta il 16/02/2021) e non va interrogato.'),

  ('marco-polo',         'Marco Polo Sporting Center',   'Vittorio Veneto',  'wansport',   'https://asdmarcopolovittorioveneto.wansport.com/',
     'attiva', true,  'Griglia rilevata dal disegno (18/08): fasce da 90 minuti, 07:30-22:30, campi 1-4. Da riconfermare allo scan, non da dare per buona.'),
  ('padel-conegliano',   'Padel Conegliano',             'Conegliano',       'wansport',   'https://padelconegliano.wansport.com/',
     'attiva', true,  'Griglia rilevata dal disegno (18/08): fasce da 60 minuti, 05:00-23:00, nomi campo con sponsor (es. «Esterno 1 - Bravi»). Da riconfermare allo scan.'),
  ('collalbrigo',        'Centro Sportivo Collalbrigo',  'Conegliano',       'wansport',   'https://centrosportivocollalbrigo.wansport.com/',
     'attiva', true,  null),
  ('ah-padel',           'AH Padel Club',                'Spresiano',        'wansport',   'https://ahpadel.wansport.com/',
     'attiva', true,  null),
  ('jungle-padel',       'Jungle Padel',                 'Fonte',            'wansport',   'https://junglepadel.wansport.com/',
     'attiva', true,  null),
  ('solero',             'Solerò Padel Center',          'Gaiarine',         'wansport',   'https://soleropadelcenter.wansport.com/',
     'attiva', true,  null),
  ('futbol-latino',      'Futbol Latino Social Club',    'Cappella Maggiore','wansport',   'https://futbollatinosc.wansport.com/',
     'attiva', true,  'Sulla home Wansport la parola «padel» compare ZERO volte, eppure ha due campi WPT: le menzioni sulla home non provano niente, contano solo le schede sport dentro /start dopo il login.'),
  ('xtre-padel',         'XTRE Padel Club',              'Fontanafredda (PN)','wansport',  'https://x3padelclub.wansport.com/',
     'attiva', true,  'Fuori provincia ma dentro il perimetro: la regola è la vicinanza, non il confine amministrativo.'),

  -- Non operativi. Stanno qui e non in un elenco a parte perché ognuno è una
  -- QUESTIONE APERTA con un nome e un destinatario: senza la riga, la domanda da
  -- fare si perde. Tutti `attivo = false`, quindi nessuno scan li toccherà mai —
  -- e il vincolo qui sopra impedisce che qualcuno li accenda per distrazione.
  -- ⚠️ `base_url` NULL: di questi cinque l'indirizzo del portale NON è stato
  -- rilevato. Il formato degli altri lo renderebbe facile da indovinare, ed è
  -- esattamente ciò che non si fa: il giorno che uno di questi si attiva,
  -- l'indirizzo si MISURA aprendolo, e il vincolo qui sopra lo pretende.
  ('padel-oderzo',       'Padel Oderzo',                 'Ponte di Piave',   'wansport',   null,
     'in_approvazione', false, 'Password impostata, ma il login è rifiutato: «account non ancora approvato dall''amministrazione». Dipende da una persona di quel circolo: va chiesto loro di approvarlo.'),
  ('eurotennis-treviso', 'Eurotennis Treviso',           'Treviso',          'wansport',   null,
     'assente', false, 'Nessuna utenza: il reset non manda nessuna mail. Servirebbe registrarsi, e la registrazione è una SCRITTURA coi dati anagrafici del committente: da autorizzare.'),
  ('dlf-treviso',        'DLF Treviso',                  'Treviso',          'wansport',   null,
     'assente', false, 'Nessuna utenza: il reset non manda nessuna mail. Registrarsi è una scrittura da autorizzare.'),
  ('tc-oderzo',          'TC Oderzo',                    'Oderzo',           'wansport',   null,
     'assente', false, 'Nessuna utenza: il reset non manda nessuna mail. Registrarsi è una scrittura da autorizzare.'),
  ('tc-salgareda',       'TC Salgareda',                 'Salgareda',        'wansport',   null,
     'assente', false, 'Nessuna utenza: il reset non manda nessuna mail. Registrarsi è una scrittura da autorizzare.')
on conflict (id) do update set
  nome         = excluded.nome,
  comune       = excluded.comune,
  piattaforma  = excluded.piattaforma,
  base_url     = excluded.base_url,
  stato_utenza = excluded.stato_utenza,
  attivo       = excluded.attivo,
  note         = excluded.note,
  updated_at   = now();
