-- Voce 60 — «Max Padel» è Padel Conegliano.
--
-- Il committente ha chiesto di provare «Max Padel a Conegliano», che in tabella non
-- esiste: a Conegliano ci sono Padel Village, Padel Conegliano e Collalbrigo. Chiesto
-- invece di indovinare, ed è risultato l'altro nome dello STESSO circolo.
--
-- ⚖️ La nota va sulla riga e non in un documento perché è lì che qualcuno la cercherà:
-- la prossima volta che qualcuno dice «Max Padel» — lui, la segreteria, o una chat
-- nuova senza questa storia — la riga risponde da sé. È la stessa ragione per cui la
-- colonna `note` esiste: il perché accanto al dato, non in un elenco che invecchia
-- da un'altra parte.
--
-- ⚠️ Nota di ordine: la migrazione del seme (20260818091607) è idempotente e in un
-- eventuale rilancio riscriverebbe `note` col testo originale. Se un domani si rilancia
-- quella, si rilancia anche questa — oppure si porta l'alias dentro il seme.
--
-- ↩️ RIPRISTINO VERBATIM:
--   update public.pmo_circoli_esterni
--      set note = 'Griglia rilevata dal disegno (18/08): fasce da 60 minuti, 05:00-23:00, nomi campo con sponsor (es. «Esterno 1 - Bravi»). Da riconfermare allo scan.'
--    where id = 'padel-conegliano';

update public.pmo_circoli_esterni
   set note = 'Detto anche «MAX PADEL»: è lo stesso circolo, non un decimo. '
              || 'Griglia rilevata dal disegno (18/08): fasce da 60 minuti, 05:00-23:00, '
              || 'nomi campo con sponsor (es. «Esterno 1 - Bravi»). Da riconfermare allo scan.',
       updated_at = now()
 where id = 'padel-conegliano';
