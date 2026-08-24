-- Voce 87 — LA CONOSCENZA CHE MANCAVA AL BOT (24/08/2026)
--
-- Misura che l'ha aperta: nel cervello dell'agente (`prompt/intenti.ts`,
-- `agents/assistente-padel.ts`, `tools/*.ts`) la parola «rubrica» compare ZERO volte, e
-- «quiz»/«autovalutazione» pure. Qui dentro la chiave `livello` era un oggetto VUOTO `{}`.
-- ⇒ Su tre funzioni in servizio da settimane — la rubrica (5/08), gli inviti, il test del
--   livello (voce 61) — il bot non aveva niente da dire a chi gliene chiedeva a parole.
--
-- ⚖️ PERCHÉ LA CURA STA QUI E NON (SOLO) NEL PROMPT. È la regola ferma del progetto:
-- *il gestionale SA, il bot DICE*. Le regole di come funziona la rubrica, quanto dura un
-- invito e quante prove ha un giro del test le decide il circolo, non il bot: scritte qui
-- cambiano senza rideployare niente, scritte nel prompt sarebbero una seconda copia da
-- tenere allineata a mano. Nel prompt va SOLO la riga che manda il modello a chiedere.
--
-- 📏 I fatti scritti qui sotto sono tutti MISURATI sul codice in servizio, non ricordati:
--   · rubrica: `src/mastra/lib/rubrica.ts` (non esiste «aggiungi», si entra invitando;
--     privata anche allo staff; invitabile solo chi è cliente del circolo);
--   · rubrica, i due bottoni: `src/telegram/rubrica.ts` (CB_RUBRICA_INVITA_NUOVO, _ELENCA);
--   · invito a una partita: `src/mastra/lib/invito-partita.ts`
--     (DURATA_INVITO_MS = 1 ora, ORA_MINIMA_MORTE = 9, mai oltre l'inizio della partita);
--   · test del livello: `supabase/functions/consumer-assessment-link/giro-del-test.ts`
--     (TENTATIVI_PER_GIRO = 3, GIORNI_DI_ATTESA = 30, ORE_SILENZIO_ASSENSO = 24; `skip`
--     per Semi-Pro e Professionista);
--   · il link del test lo propone il BOT e non si può chiedere: `src/telegram/bot.ts`
--     lo attacca solo su `motivo === 'serve_livello'` (`rifiutoSenzaLivello`).
--
-- 🚨 E UNA CORREZIONE, che è la parte che oggi dice il FALSO:
-- `disdetta.come_si_disdice` mandava il socio a «Le tue prossime partite». Quella voce di
-- menu NON esiste più (oggi `TITOLO_ELENCO = 'Le mie prenotazioni'`). Nel bot c'è già un
-- caso che difende proprio da questo (`test/seconda-porta.test.ts`, «manda ancora il socio
-- a “Le tue prossime partite”») — ma legge i SORGENTI, e la kb sta in un database: la
-- guardia non poteva vederla.
-- ⇒ Qui il nome del bottone NON si sostituisce con quello nuovo: si TOGLIE. In tre
--   settimane quella porta ha cambiato nome tre volte, e una kb che la nomina è la quarta
--   copia che andrà a marcire. Si dice DOVE si apre (il menu ☰), non come si chiama oggi.
--
-- ↩️ RIPRISTINO: le tre chiavi nuove si tolgono e la vecchia frase si rimette con
--    supabase_pmo_assistant_kb_voce_87_undo.sql (accanto a questo file).
--
-- Si esegue IDENTICO sui due progetti: PROD `qqbfphyslczzkxoncgex`, TEST `cudiqnrrlbyqryrtaprd`.

update pmo_ai_settings
set value = value
  || jsonb_build_object(
    'rubrica', jsonb_build_object(
      '_nota', 'Aggiunta il 24/08/2026 (voce 87). La rubrica esiste dal 5/08 ma qui non c''era: chi la nominava a parole non riceveva risposta.',
      'cos_e', 'La rubrica è l''elenco delle persone che il socio ha fatto entrare al circolo col proprio invito. Serve a invitare qualcuno a una partita: i nomi si scelgono da lì.',
      'dove_si_apre', 'Dal menu ☰ del bot, voce «La mia rubrica».',
      'come_si_riempie', 'Non esiste il gesto «aggiungi una persona»: in rubrica si entra solo ricevendo un invito ed entrando nel bot. Dalla schermata della rubrica il socio tocca il bottone per invitare qualcuno di nuovo e riceve un link personale da mandargli.',
      'come_si_toglie', 'Dalla stessa schermata si può togliere una persona dalla propria rubrica.',
      'e_privata', 'La rubrica di un socio non la vede nessun altro socio, e non la vede nemmeno la segreteria. Non dire mai chi c''è nella rubrica di qualcun altro.',
      'chi_si_puo_invitare', 'A una partita si può invitare solo chi il circolo conosce già come proprio cliente. Gli altri li mette in campo la segreteria, e il bot non mostra il bottone per invitarli: se il socio chiede perché una persona che vede in rubrica non compare fra quelle invitabili, il motivo è questo.',
      'serve_per_invitare', 'Avere qualcuno in rubrica è la condizione per invitare a una partita: a rubrica vuota non c''è nessuno da chiamare, e il primo passo è mandare un invito.'
    ),
    'inviti', jsonb_build_object(
      '_nota', 'Aggiunta il 24/08/2026 (voce 87). Sono DUE cose diverse e si confondono facilmente.',
      'invito_al_circolo', 'Un link personale che il socio manda a chi vuole far entrare. Chi lo apre entra nel bot e finisce nella rubrica di chi l''ha invitato. Si chiede dalla schermata «La mia rubrica».',
      'invito_a_una_partita', 'Un messaggio che arriva nel bot a una persona già in rubrica, coi bottoni per accettare o rifiutare. Si manda dalla schermata della partita, scegliendo i nomi dalla rubrica.',
      'quanto_dura', 'Un invito a una partita vale un''ora. Se scadesse di notte resta vivo fino alle 9 del mattino, e in nessun caso oltre l''inizio della partita. Il posto può finire anche prima, se risponde qualcun altro.',
      'chi_risponde', 'Accettare o rifiutare si fa col bottone dentro il messaggio: l''assistente non accetta e non rifiuta per conto di nessuno, e non sollecita nessuno.'
    ),
    'livello', jsonb_build_object(
      '_nota', 'Riempita il 24/08/2026 (voce 87): questa chiave era un oggetto VUOTO, quindi sul livello il bot sapeva dire solo quello del socio e nient''altro.',
      'come_si_dice', 'Il livello al socio si dice sempre a PAROLE (Principiante, Base, Intermedio, Avanzato, Agonista, Semi-Pro, Professionista) e mai a numeri.',
      'a_cosa_serve', 'Serve al circolo per formare partite equilibrate. Finché un socio non ha un livello misurato non può organizzare una partita.',
      'come_si_ottiene', 'Con un test di autovalutazione: un questionario che si apre da un link personale. Il link lo propone il BOT con un bottone quando serve — di solito quando il socio prova a organizzare una partita senza avere ancora un livello. All''assistente non si può chiedere di mandarlo, e l''assistente non deve prometterlo.',
      'quante_prove', 'Un giro sono tre prove. Dopo ogni prova il bot dice l''esito e chiede se tenere quel livello o riprovare; se il socio non risponde, dopo 24 ore il livello si applica da sé. Chiuso il giro, se ne può fare un altro dopo 30 giorni.',
      'chi_non_lo_fa', 'Chi si dichiara Semi-Pro o Professionista il questionario non lo fa.',
      'chi_lo_cambia', 'Il livello lo registra il circolo. L''assistente lo legge e lo dice: non lo cambia, non lo negozia e non lo anticipa.',
      'niente_tempi', 'ISTRUZIONE PER TE, non da riferire: non promettere MAI tempi sul livello — niente «a breve», «subito», «entro stasera». Se il socio dice di aver già fatto il test e il livello non è cambiato, non inventare una spiegazione e non dare una scadenza: mandalo in segreteria.'
    )
  ),
  updated_by = 'claude-code/voce-87',
  updated_at = now()
where key = 'assistant_kb';

-- La frase che nominava una porta che non esiste più.
update pmo_ai_settings
set value = jsonb_set(
  value,
  '{disdetta,come_si_disdice}',
  to_jsonb('L''assistente sa far uscire il socio dalla propria partita, e annullarla se non c''è nessun altro dentro: si fa dai bottoni della schermata della partita, che si apre dal menu ☰ alla voce delle proprie prenotazioni, entro la finestra di disdetta. Tutto il resto — annullare una partita con altri dentro, spostarla, lezioni e periodici, rimborsi — va in segreteria; non disdire di tua iniziativa e non promettere di avvisare i compagni.'::text)
),
  updated_by = 'claude-code/voce-87',
  updated_at = now()
where key = 'assistant_kb';

-- ── (b) SERA DEL 24/08 — la SETTIMA copia del nome della porta, tolta ────────────────────
--
-- Curando i residui della voce 87 il caso nuovo `seconda-porta.test.ts` («nessun testo scrive
-- quel nome a mano») ne ha trovate SEI nel codice, non le tre contate rileggendo. La settima
-- era qui: `rubrica.dove_si_apre` citava «La mia rubrica», e `inviti.invito_al_circolo` pure.
-- ⚖️ Oggi quel nome è GIUSTO — non è un difetto, è una copia. E la kb è l'unico posto dove
--    nessuna guardia arriva: le altre leggono i sorgenti, questa sta in un database.
-- ⇒ Si toglie invece di correggerla. A portare il socio nella rubrica adesso c'è il bottone
--   della TERZA PORTA (`apri_rubrica`), che la kb non ha bisogno di descrivere.

update pmo_ai_settings
set value = jsonb_set(value, '{rubrica,dove_si_apre}',
      to_jsonb('Si apre dal menu ☰ del bot. Se il socio te ne parla, sotto la tua risposta gli compare da sé il bottone che ce lo porta: non serve che gli spieghi dove cercare.'::text)),
    updated_by = 'claude-code/voce-87b',
    updated_at = now()
where key = 'assistant_kb';

update pmo_ai_settings
set value = jsonb_set(value, '{inviti,invito_al_circolo}',
      to_jsonb('Un link personale che il socio manda a chi vuole far entrare. Chi lo apre entra nel bot e finisce nella rubrica di chi l''ha invitato. Si chiede dalla schermata della rubrica.'::text)),
    updated_by = 'claude-code/voce-87b',
    updated_at = now()
where key = 'assistant_kb';
