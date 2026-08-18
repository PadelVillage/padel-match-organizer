-- Voce 60 — Marco Polo Sporting Center ESCLUSO, per decisione del committente (18/08/2026).
--
-- ⚖️ SPENTO, NON CANCELLATO, e la differenza è voluta: la riga conserva l'indirizzo, la
-- griglia rilevata e la sonda riuscita del 18/08 (login in 1,76 s). Cancellarla butterebbe
-- una misura vera per registrare una decisione, e il giorno che rientrasse si ripartirebbe
-- da zero. `attivo = false` dice tutto quello che serve: **non lo si interroga**.
--
-- 🚨 Il vincolo `attivo = false or stato_utenza = 'attiva'` NON si oppone: vieta di ACCENDERE
-- un circolo senza utenza, non di spegnerne uno che ce l'ha. `stato_utenza` resta 'attiva'
-- perché è un fatto misurato — l'account funziona — mentre `attivo` è una scelta nostra.
-- Le due colonne dicono cose diverse ed è proprio in casi come questo che si vede perché.
--
-- ⚠️ Il MOTIVO della decisione non è stato dichiarato, e qui non se ne inventa uno: la nota
-- dice «scelta del committente» e basta. Se un domani si saprà, si aggiunge.
--
-- ↩️ RIPRISTINO VERBATIM (lo rimette in servizio com'era):
--   update public.pmo_circoli_esterni
--      set attivo = true,
--          note = 'Griglia rilevata dal disegno (18/08): fasce da 90 minuti, 07:30-22:30, campi 1-4. Da riconfermare allo scan, non da dare per buona.'
--    where id = 'marco-polo';

update public.pmo_circoli_esterni
   set attivo = false,
       note = 'FUORI PERIMETRO per scelta del committente (18/08/2026) — motivo non dichiarato. '
              || 'Non si interroga. L''utenza resta attiva e funzionante: la sonda del 18/08 ha '
              || 'fatto login in 1,76 s. Griglia rilevata dal disegno: fasce da 90 minuti, '
              || '07:30-22:30, campi 1-4. Se rientra, basta rimettere attivo = true.',
       updated_at = now()
 where id = 'marco-polo';
