-- VOCE 115 — `esito IS NULL` VOLEVA DIRE DUE COSE, e la cura della 68 aveva creato la seconda.
--
-- 📏 MISURATO su PROD il 01/09/2026 e rimisurato il 05/09: la strada della RICEVUTA (voce 70,
-- `consumer-staff-events` passo 1) chiude il fatto scrivendo `consegnato_at` e basta — non
-- arriva mai al passo in cui gli altri esiti vengono scritti. ⇒ Quelle righe uscivano con
-- `esito` NULL, come le 605 chiuse prima che la colonna esistesse. Al 05/09: 26 ricevute
-- consumate, 26 righe mute — la categoria che cresce era esattamente quella cieca.
--
-- ⚖️ È la forma della voce 71 — *un solo silenzio per due domande diverse* — e la lezione è
-- la stessa: la domanda non è come si chiama il valore, è CHI È IN GRADO DI RISPONDERE. Qui
-- risponde il gestionale, che la ricevuta l'ha in mano: `pmo_ricevute_gesti.usata_da` porta
-- l'id del fatto che ha coperto.
--
-- 🔨 LA CURA, in due metà:
--   ① il codice (`consumer-staff-events`) scrive `esito = 'gesto_dal_bot'` NELLO STESSO
--      update che chiude la riga — non dopo, o la finestra «chiusa e muta» resterebbe;
--   ② questa migrazione RIEMPIE le righe già chiuse per quella strada. ⚠️ Non è «inventare un
--      esito che nessuno ha osservato» (la regola delle migrazioni della voce 68): qui l'esito
--      È osservato — sta scritto in `usata_da`, riga per riga. Si copia un fatto, non si deduce.
--
-- ⛔ Le righe NULL SENZA ricevuta restano NULL: sono quelle chiuse prima del 01/09, e il loro
-- NULL continua a voler dire «non misurato». Dopo questa migrazione vuol dire SOLO quello.
--
-- Idempotente: si può rieseguire.

UPDATE public.pmo_eventi_staff e
   SET esito = 'gesto_dal_bot'
 WHERE e.esito IS NULL
   AND EXISTS (SELECT 1 FROM public.pmo_ricevute_gesti r WHERE r.usata_da = e.id);

COMMENT ON COLUMN public.pmo_eventi_staff.esito IS
  'Perché questa riga è stata chiusa: passato_al_bot | non_riconosciuto | netto_nullo | '
  'corsa_persa | suo_gesto | gesto_dal_bot. '
  'NULL = riga chiusa prima del 01/09/2026, esito non misurato. '
  'consegnato_at dice SE è chiusa, questa colonna dice COM È ANDATA DA QUESTA PARTE. '
  '🚨 passato_al_bot NON vuol dire che il socio lo sappia: il bot ha un suo filtro e scarta '
  'chi non è nella whitelist Telegram, che è il caso frequente. Chi è stato avvisato davvero '
  'lo dice SOLO il registro del bot (righe «detto a …»). '
  '🆕 suo_gesto (voce 123, 02/09/2026) = non detto di proposito, perché chi lo riceverebbe è '
  'la stessa persona che lo ha chiesto: il circolo non annuncia a un socio un gesto suo. '
  '🆕 gesto_dal_bot (voce 115, 05/09/2026) = non detto perché il gesto l ha fatto un socio '
  'dal bot, e lo prova la ricevuta in pmo_ricevute_gesti (usata_da = id di questa riga).';
