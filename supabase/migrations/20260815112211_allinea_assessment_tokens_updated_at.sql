-- 🔴 15/08/2026 — LA COLONNA CHE NON C'È, E L'APP LA SCRIVE LO STESSO.
--
-- Vista dal vivo dalla console del committente, in produzione, mentre si collaudava la voce 23:
--   POST …/rpc/update_assessment_token_status_admin → 400 (Bad Request)
--   column "updated_at" of relation "assessment_tokens" does not exist
--
-- 🔎 L'ORIGINE HA UNA DATA, e non è di stamattina. La migrazione `20260522120000` aggiunge
-- `status_autovalutazione` e, dentro la RPC, scrive `updated_at = now()` DANDO PER SCONTATO che
-- la colonna esista. Su TEST esisteva davvero, perché là era stato applicato per intero
-- `supabase/manual-sql/supabase_schema.sql`, che alla riga 21 la dichiara. Su PROD no: il file
-- del repo la promette dal principio, e la produzione non l'ha mai avuta.
-- ⇒ Quella RPC su PROD **non ha mai funzionato**, dal 22/05/2026. Non è un caso raro: è il 100%.
--
-- 📊 MISURATO PRIMA DI TOCCARE (le due parti sono il controllo l'una dell'altra):
--   · PROD, 22 ore di log: **40 POST → 400, zero 200**
--   · TEST, le stesse ore, stessa app, stessa RPC: **4 POST → 200**
--   · su PROD la colonna la nomina UNA sola funzione, questa
--   · riprodotto sul bersaglio per la strada dell'app (JWT di uno staff vero, transazione
--     annullata): `42703`, con lo stesso testo della console.
--
-- ⚠️ COSA COSTAVA, ed è più sottile di «un bottone rotto»: gli stati che si VEDONO su PROD
-- (PRIMO_SOLLECITO, GESTIONE_MANUALE…) li scrive `assessment-email-send` con un PATCH, che
-- `updated_at` non lo tocca — quindi funzionavano. A non arrivare mai al cloud era solo il
-- cambio di stato **fatto a mano dallo staff**, che restava nel `localStorage` di quel browser.
-- Un pezzo sano accanto a uno rotto è il modo migliore per non vedere quello rotto (voce del
-- 11/08, e vale di nuovo). E tre dei quattro punti di chiamata fallivano in SILENZIO
-- (`console.error` e nient'altro): uno solo avvisava l'operatore.
--
-- ⚖️ Strada scelta dal committente fra le due proposte: si aggiunge la COLONNA, non si toglie la
-- riga dalla RPC. Ragione sua: così è la produzione a tornare uguale a ciò che il repo dichiara,
-- invece del contrario. È la stessa forma — e la stessa cura — delle 5 colonne di
-- `pmo_parser_errors` del 14/08.
--
-- 🔗 Reversibile: in fondo c'è come si torna indietro.

-- ── 1. La colonna, IDENTICA a quella di TEST ─────────────────────────────────────────────────
-- `timestamptz not null default now()`, verbatim: l'impronta della colonna dev'essere la stessa
-- da entrambe le parti, o si è sanato il sintomo e lasciata la divergenza.
alter table public.assessment_tokens
  add column if not exists updated_at timestamptz not null default now();

-- ── 2. Le righe già in tabella: la data VERA, non «adesso» ───────────────────────────────────
-- 🚨 Il default avrebbe scritto `now()` in tutte e 1364 le righe, anche in quelle ferme da
-- maggio: 1364 date false, cioè esattamente il «documento che mente» che in questi giorni si sta
-- togliendo di mezzo. Si ricostruisce invece l'ultimo momento in cui a quella riga è successo
-- qualcosa davvero.
-- 📌 `greatest` ignora i NULL, e `created_at` è NOT NULL: il risultato non è mai vuoto.
-- ⛔ QUESTO PASSO STA PRIMA DEL TRIGGER, e l'ordine non è estetico: il trigger scrive
--    `new.updated_at = now()` su OGNI update, quindi montato prima si mangerebbe il valore vero
--    e lascerebbe le 1364 date false che questo passo esiste per evitare.
update public.assessment_tokens
set updated_at = greatest(created_at, sent_at, registered_at, completed_at);

-- ── 3. I due trigger che TEST ha e PROD non aveva ────────────────────────────────────────────
-- 🔎 Trovato guardando: su PROD queste due tabelle non avevano NESSUN trigger, mentre la
-- funzione `assessment_touch_updated_at` c'era già — identica a quella di TEST, impronta
-- `77cd2033…` da entrambe le parti. Mancava solo il cablaggio, come nella voce 23.
-- ⚖️ Perché servono: senza, `updated_at` si muove solo quando la RPC la scrive per nome. Ogni
-- altro scrittore (le edge, che fanno PATCH) la lascerebbe indietro, e una colonna che si
-- aggiorna a volte sì e a volte no è peggio di una che non c'è: si finisce per crederle.
drop trigger if exists trg_assessment_tokens_updated_at on public.assessment_tokens;
create trigger trg_assessment_tokens_updated_at
before update on public.assessment_tokens
for each row execute function public.assessment_touch_updated_at();

drop trigger if exists trg_self_assessments_updated_at on public.self_assessments;
create trigger trg_self_assessments_updated_at
before update on public.self_assessments
for each row execute function public.assessment_touch_updated_at();

-- ⛔ NON TOCCATO, e va dichiarato invece che fatto di nascosto: su PROD manca anche
-- `trg_self_assessments_mark_token_completed`, che su TEST c'è. Quello NON è un allineamento di
-- schema, è un cambio di COMPORTAMENTO — brucerebbe il gettone da dentro il database, mentre su
-- PROD a farlo è la edge (misurato nella voce 27: 0,15 secondi dopo). Due strade che fanno la
-- stessa cosa vanno guardate insieme, non aggiunte una sopra l'altra di sfuggita. Resta scritto
-- fra le divergenze da guardare.

-- ── Come si torna indietro ───────────────────────────────────────────────────────────────────
--   drop trigger if exists trg_assessment_tokens_updated_at on public.assessment_tokens;
--   drop trigger if exists trg_self_assessments_updated_at on public.self_assessments;
--   alter table public.assessment_tokens drop column if exists updated_at;
-- ⚠️ Tornando indietro torna anche il 400: è il motivo per cui si va avanti, non una scappatoia.
