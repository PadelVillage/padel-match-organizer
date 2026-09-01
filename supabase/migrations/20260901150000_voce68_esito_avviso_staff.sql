-- VOCE 68 — «consegnato_at» diceva FATTO su un messaggio mai partito.
--
-- 🚨⭐⭐ IL DIFETTO, che era DICHIARATO e non curato (scheda della voce 68, 21/08/2026):
-- `consegnato_at` si scrive **anche** quando il destinatario non si riconosce — o quando il
-- netto del confronto è nullo, o quando la riga se l'è presa questo giro ma la sua compagna
-- se l'è presa un altro e l'evento non è uscito. In tutti e tre i casi la colonna dice
-- *«fatto»* e al socio non è arrivato niente.
-- ⇒ Chi guarda quella colonna per sapere «è arrivato?» ottiene **sì** per una cosa che non è
-- successa, e lo ottiene con la stessa sicurezza con cui otterrebbe la verità.
--
-- 📏 MISURATO su PROD il 01/09/2026, ed è la cifra che rende il difetto concreto: la coda ha
-- **605** righe, **605** con `consegnato_at`, **0** aperte. Nello stesso periodo il registro
-- del bot mostra **22** messaggi davvero partiti (`🔔 detto a …`, dal 29/08 al 01/09), su
-- **274** righe chiuse negli ultimi quattro giorni. ⇒ La stragrande maggioranza di quei
-- «fatto» riguarda persone che il bot non ce l'hanno — il che va benissimo, ma **non è
-- «consegnato»**, ed è l'unica cosa che la colonna sa dire.
--
-- 🔨 LA CURA NON RINOMINA NIENTE, ed è deliberato: `consegnato_at` resta dov'è e continua a
-- voler dire *«questa riga è chiusa, non riesaminarla»* — che è il fatto su cui poggia
-- l'intera protezione contro il doppio invio (la chiusura atomica del 24/08). Cambiarle
-- significato vorrebbe dire toccare quella. ⇒ Si AGGIUNGE accanto il **perché**:
--
--   · `consegnato`       — l'evento è uscito verso il bot;
--   · `non_riconosciuto` — il nome non è di UNA persona viva in anagrafica (o non è nostro,
--                          o sono due omonimi veri): non lo diventerà domani, e infatti si
--                          chiude lo stesso;
--   · `netto_nullo`      — il confronto non aveva niente da dire per quella persona;
--   · `corsa_persa`      — questo giro l'ha presa, ma una riga sorella se l'è presa un altro
--                          giro ⇒ l'evento non è uscito (vedi i `soffiati`).
--
-- ⚖️ È la stessa forma della voce 71 e della voce 70: **far uscire il perché insieme al
-- dato**. Un valore che significa quattro cose non è ambiguo per chi lo scrive — lo è per chi
-- lo legge, e chi lo legge è sempre qualcun altro.
--
-- ⚠️ Le **605 righe di prima restano a NULL**, e va letto per quello che è: *non misurato*,
-- non «consegnato». Riempirle a posteriori vorrebbe dire inventare un esito che nessuno ha
-- osservato — esattamente il difetto che questa colonna esiste per togliere.
--
-- ⛔ Nessun indice: la colonna si legge a mano quando si indaga, non in un giro caldo.
--
-- Idempotente: si può rieseguire.

ALTER TABLE public.pmo_eventi_staff
  ADD COLUMN IF NOT EXISTS esito text;

COMMENT ON COLUMN public.pmo_eventi_staff.esito IS
  'Perché questa riga è stata chiusa: consegnato | non_riconosciuto | netto_nullo | corsa_persa. '
  'NULL = riga chiusa prima del 01/09/2026, esito non misurato. '
  'consegnato_at dice SE è chiusa, questa colonna dice COM È ANDATA: le due non sono la stessa domanda.';
