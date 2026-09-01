-- VOCE 68 — «consegnato» prometteva una cosa che il gestionale NON PUÒ SAPERE.
--
-- 🚨⭐⭐ CORREZIONE DELLA CURA DI STAMATTINA, poche ore dopo, dalla PRIMA misura vera. Vale la
-- pena leggerla per intero, perché è il difetto che quella cura esisteva per togliere,
-- riprodotto da chi lo stava togliendo.
--
-- 📏 Il 01/09/2026 alle **18:22:07** il gestionale ha scritto `esito = 'consegnato'` su due
-- righe (Oriana Canzian e Valeria Moschet, aggiunte alla partita del 07/09 19:30). Nello
-- stesso istante il registro del bot dei soci dice:
--     🔔 circolo: 2 ritirati, 0 detti, 2 scartati
-- ⇒ **ZERO detti.** Il bot le ha scartate: quelle due persone il bot non ce l'hanno, e la
-- whitelist Telegram tiene i soci iscritti, non i 2.800 del circolo.
--
-- ⚖️ Il valore si chiamava «consegnato» e la sua funzione di lettura si chiamava
-- `eArrivatoAlSocio`, documentata come *«l'unico che vuol dire: il socio lo saprà»*. È la
-- stessa bugia di `consegnato_at`, **spostata di un passo**: il gestionale consegna **al
-- bot**, e cosa il bot ne faccia è un fatto che vive di là.
-- 📌 *Rinominare una colonna che mente non basta se il nome nuovo promette la stessa cosa: la
-- domanda non è come si chiama il valore, è CHI è in grado di rispondere.*
--
-- 🔨 LA CURA: il valore diventa **`passato_al_bot`**, che è ciò che il gestionale sa davvero,
-- e la funzione `eArrivatoAlSocio` **non esiste più** — al suo posto `ePassatoAlBot`, che non
-- promette niente su chi legge. Chi vuole sapere quanti avvisi sono arrivati a qualcuno lo
-- chiede al registro del bot (`stato-bot.yml`, regex `detto a`), che è l'unico posto che
-- quella risposta ce l'ha.
--
-- ⚠️ LE DUE RIGHE GIÀ SCRITTE si aggiornano, e va detto perché NON è riscrivere la storia: il
-- codice ha sempre marcato «l'evento è uscito verso il bot» — era il **nome** a essere
-- sbagliato, non il fatto osservato. Cambiare l'etichetta di un fatto misurato bene è una
-- correzione; inventare un esito che nessuno ha osservato sarebbe un'altra cosa, e infatti le
-- righe a NULL restano a NULL.
--
-- ⏳ COSA RESTA APERTO, dichiarato: il gestionale continua a non sapere se il socio è stato
-- avvisato. Per saperlo il bot dovrebbe riferire indietro — è un cambio di disegno che tocca
-- la regola ferrea del 19/08, e va deciso, non fatto di scivolo.
--
-- Idempotente: si può rieseguire.

UPDATE public.pmo_eventi_staff SET esito = 'passato_al_bot' WHERE esito = 'consegnato';

COMMENT ON COLUMN public.pmo_eventi_staff.esito IS
  'Perché questa riga è stata chiusa: passato_al_bot | non_riconosciuto | netto_nullo | corsa_persa. '
  'NULL = riga chiusa prima del 01/09/2026, esito non misurato. '
  'consegnato_at dice SE è chiusa, questa colonna dice COM È ANDATA DA QUESTA PARTE. '
  '🚨 passato_al_bot NON vuol dire che il socio lo sappia: il bot ha un suo filtro e scarta '
  'chi non è nella whitelist Telegram, che è il caso frequente. Chi è stato avvisato davvero '
  'lo dice SOLO il registro del bot (righe «detto a …»).';
