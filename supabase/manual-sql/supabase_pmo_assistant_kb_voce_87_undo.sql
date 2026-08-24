-- ↩️ RIPRISTINO della voce 87 — riporta `assistant_kb` a com'era il 21/08/2026 21:08.
--
-- Le tre chiavi nuove si tolgono; `livello` torna l'oggetto vuoto che era (NON si cancella:
-- la chiave esisteva, vuota, e toglierla sarebbe uno stato diverso da quello di prima).
-- La frase della disdetta torna quella che nominava «Le tue prossime partite».
-- ⚠️ Rimettendola si rimette anche il difetto: quella voce di menu non esiste.
--
-- Si esegue IDENTICO sui due progetti: PROD `qqbfphyslczzkxoncgex`, TEST `cudiqnrrlbyqryrtaprd`.

update pmo_ai_settings
set value = (value - 'rubrica' - 'inviti') || jsonb_build_object('livello', '{}'::jsonb),
    updated_by = 'claude-code/voce-87-undo',
    updated_at = now()
where key = 'assistant_kb';

update pmo_ai_settings
set value = jsonb_set(
  value,
  '{disdetta,come_si_disdice}',
  to_jsonb('L''assistente sa far uscire il socio dalla propria partita, e annullarla se non c''è nessun altro dentro: si fa dai bottoni sotto «Le tue prossime partite», entro la finestra di disdetta. Tutto il resto — annullare una partita con altri dentro, spostarla, lezioni e periodici, rimborsi — va in segreteria; non disdire di tua iniziativa e non promettere di avvisare i compagni.'::text)
),
    updated_by = 'claude-code/voce-87-undo',
    updated_at = now()
where key = 'assistant_kb';
