-- VOCE 123 — IL CIRCOLO ANNUNCIAVA A UN SOCIO UN GESTO CHE AVEVA FATTO LUI.
--
-- 📏 VISTO SUCCEDERE il 02/09/2026, sul telefono del committente, non dedotto. Alle 00:02:47
-- Maurizio toglie Marco dalla partita del 7 settembre (gesto suo, dal bot, riuscito). Alle
-- 00:03:26 gli arriva:
--     «🔄 È cambiata la formazione della tua partita … Esce Marco Aprea.
--      L'ha chiesto Maurizio Aprea … Se non te lo aspettavi, parlane con Maurizio Aprea.»
-- ⇒ Il circolo gli attribuisce un gesto suo e lo manda a chiedere spiegazioni a sé stesso:
-- un'istruzione che non si può eseguire, cioè il vicolo cieco che questo progetto evita.
--
-- ⚖️ PERCHÉ LA RICEVUTA DELLA VOCE 70 NON LO COPRIVA — ed è la misura che ha CORRETTO la
-- scheda della voce, che proponeva di allargare la ricevuta a chi ha chiesto. Non avrebbe
-- funzionato: chi chiede **resta in campo**, quindi il fatto che lo raggiunge ha gesto
-- `formazione`, e il vocabolario delle ricevute è `aggiunto | tolto | annullata`. La funzione
-- `copertura()` accoppia fatto e ricevuta **anche sul gesto** ⇒ nessuna ricevuta può coprire
-- un `formazione`, né oggi né allargandola.
-- 📌 *Una protezione si estende dove arriva la sua CHIAVE, non dove arriva la sua ragione.*
--
-- 📏 E LA MISURA SUI CINQUE GESTI, fatta prima di scegliere (righe di `pmo_eventi_staff` con
-- `chiesto_da` non vuoto, PROD, 30 giorni) invece di supporre che gli altri facessero come il
-- `remove`:
--   · create · entra · leave · cancel → chi chiede riceve un fatto SU DI SÉ
--     (`aggiunto`/`tolto`/`annullata`), che la ricevuta copre. Misurato sul caso vero del
--     01/09 20:44:28 (Marco entra): la sua riga esce con `consegnato_at` e `esito` NULL,
--     cioè coperta. ✅ nessun difetto.
--   · remove · add → chi chiede RESTA in campo ⇒ riceve `formazione`, che nessuna ricevuta
--     può coprire. ❌ È il difetto, e sono i due gesti in cui esiste.
--
-- 🔨 LA CURA: lo scarto sta nel GESTIONALE (`consumer-staff-events`), non nel bot — il bot non
-- riceve niente da scartare, e la regola di casa resta intera: *il gestionale SA, il bot DICE*.
-- Vale per tutti i gesti, presenti e futuri, perché non passa dal vocabolario delle ricevute.
--
-- ⛔ E SCARTA SOLO SE LA RAFFICA È TUTTA SUA: un gruppo che mescola un suo gesto e uno della
-- segreteria si consegna lo stesso, o gli si toglierebbe l'unica notizia che nessun altro gli
-- darà. *Ogni scarto in più è un avviso che qualcuno non riceve.*
--
-- ⚠️ QUESTA MIGRAZIONE NON TOCCA NESSUN DATO e non aggiunge nessun vincolo: la colonna `esito`
-- è testo libero, senza CHECK. Aggiorna il **commento**, che è il posto in cui il quinto valore
-- va documentato — e sta qui perché quei nomi vivono in tre posti (il codice che chiude, questa
-- migrazione, e chi un domani andrà a interrogare la colonna). Tre stringhe scritte a mano in
-- tre posti divergono.
--
-- Idempotente: si può rieseguire.

COMMENT ON COLUMN public.pmo_eventi_staff.esito IS
  'Perché questa riga è stata chiusa: passato_al_bot | non_riconosciuto | netto_nullo | '
  'corsa_persa | suo_gesto. '
  'NULL = riga chiusa prima del 01/09/2026, esito non misurato. '
  'consegnato_at dice SE è chiusa, questa colonna dice COM È ANDATA DA QUESTA PARTE. '
  '🚨 passato_al_bot NON vuol dire che il socio lo sappia: il bot ha un suo filtro e scarta '
  'chi non è nella whitelist Telegram, che è il caso frequente. Chi è stato avvisato davvero '
  'lo dice SOLO il registro del bot (righe «detto a …»). '
  '🆕 suo_gesto (voce 123, 02/09/2026) = non detto di proposito, perché chi lo riceverebbe è '
  'la stessa persona che lo ha chiesto: il circolo non annuncia a un socio un gesto suo.';
