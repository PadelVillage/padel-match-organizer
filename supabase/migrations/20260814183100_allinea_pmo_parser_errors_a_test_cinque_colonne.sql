-- ════════════════════════════════════════════════════════════════════════════
-- Voce 39 (coda) — 14/08/2026, 16ª sessione. PROD (qqbf…).
-- Allinea `pmo_parser_errors` a TEST: le 5 colonne del flusso «segnalazione risolta».
--
-- IL GUASTO CHE RIPARA, misurato prima sul bersaglio:
--   Dalla PR #648 del 7/08/2026 l'app di `main` usa colonne che su PROD non esistono:
--     · scrive  `origine`  a OGNI segnalazione        (logParserError)
--     · legge   `stato`, `risolto_il`,
--               `risolto_in_versione`, `nota_risoluzione`  (pannello «Le mie segnalazioni»,
--                                                            filtro origine=eq.manuale)
--   Provato come SQL diretto su PROD:
--     LETTURA di origine ....................... 42703 — column "origine" does not exist
--     LETTURA delle 4 colonne del pannello ..... 42703 — column "stato" does not exist
--     INSERT con origine ....................... 42703 — column "origine" ... does not exist
--   ⇒ nessuna segnalazione del parser poteva essere registrata (e falliva in SILENZIO:
--     console.warn + return false), e quel pannello non poteva caricare.
--
-- ⚖️ NON è la causa del silenzio della tabella, e va detto perché l'ipotesi era mia ed
--    è stata smentita dalla misura: le 45 righe di PROD sono TUTTE del 16/06/2026, cioè
--    due mesi PRIMA che il disallineamento nascesse. Sono due fatti distinti; questa
--    migrazione ne chiude uno solo. Perché la tabella taccia dal 16/06 resta da capire.
--
-- 📋 DEFINIZIONI COPIATE VERBATIM DA TEST (`cudi…`), non inventate — misurate su
--    information_schema.columns: `stato` e `origine` NOT NULL con default, le altre tre
--    libere. Indici e vincoli erano GIÀ identici fra i due progetti (pkey, timestamp DESC,
--    admin_selected): non si tocca nulla lì.
--
-- 📌 EFFETTO SULLE 45 RIGHE ESISTENTI: prendono i default, cioè `stato='aperta'` e
--    `origine='auto'`. È il valore giusto — sono segnalazioni automatiche del 16/06 mai
--    risolte — e non le fa comparire nel pannello, che filtra `origine=eq.manuale`.
--
-- VERIFICATO DOPO:
--   · lettura di `origine`, lettura delle 4 del pannello, INSERT nella forma ESATTA
--     dell'app: tutte RIUSCITE (l'insert in transazione annullata — 0 residui, la tabella
--     resta a 45 righe con l'ultima ancora del 16/06);
--   · l'impronta delle colonne di PROD è ora IDENTICA a quella censita per TEST prima di
--     toccare niente: 6db832dc59717b2ba20f32782ebd89c8 su entrambi;
--   · prova end-to-end attraverso PostgREST (pg_net, stessa URL e stessa chiave dell'app):
--       PRIMA  → 400  {"code":"42703","message":"column pmo_parser_errors.stato does not exist"}
--       DOPO   → 200  []
--   · linter di PROD: 101 → 101 avvisi, WARN 83, ERROR 0. Nessuna variazione, in nessun
--     verso: aggiungere colonne non apre né chiude avvisi.
--
-- ↩️ RIPRISTINO:
--    alter table public.pmo_parser_errors
--      drop column if exists stato,
--      drop column if exists origine,
--      drop column if exists risolto_il,
--      drop column if exists risolto_in_versione,
--      drop column if exists nota_risoluzione;
--    ⚠️ Il ripristino PERDE i dati eventualmente scritti in quelle colonne dopo oggi.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.pmo_parser_errors
  add column if not exists stato               text        not null default 'aperta',
  add column if not exists origine             text        not null default 'auto',
  add column if not exists risolto_il          timestamptz,
  add column if not exists risolto_in_versione text,
  add column if not exists nota_risoluzione    text;
