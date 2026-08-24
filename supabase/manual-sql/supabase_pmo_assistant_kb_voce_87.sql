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

-- ── (c) SERA DEL 24/08 — IL TESTO DELLA RUBRICA LO SCRIVE LUI ───────────────────────────
--
-- 🗣️ *«Scrivimi tu il testo qui così io poi te lo correggo»* — e l'ha corretto. Da qui in poi
-- `rubrica.come_funziona` sono le sue parole: la mia bozza le aveva scritte leggendo il codice,
-- che dice cos'è la rubrica ma non come la si racconta a un socio.
-- ✏️ Toccati solo un refuso (`pacerebbe`) e una virgola, dichiarati.
--
-- 🚨 E TOLTE QUATTRO CHIAVI mie (`cos_e`, `come_si_riempie`, `come_si_toglie`,
-- `serve_per_invitare`): dicevano le stesse cose con parole diverse — `cos_e` definiva la rubrica
-- come «le persone che hai fatto entrare», lui come «le persone con cui ti piacerebbe giocare».
-- ⇒ Non è una sfumatura: sono due definizioni della stessa cosa in pasto allo stesso modello, e
--   due definizioni divergono. È il difetto curato stamattina sul nome della voce di menu, nella
--   stessa giornata e nello stesso file.
--
-- ⚖️ Restano tre complementi, e sono complementi perché escono SOLO su domanda:
--   · `chi_si_puo_invitare` — la seconda condizione (dev'essere cliente del circolo, 6/08). Non
--     entra nella spiegazione generale per sua scelta: là sarebbe rumore, qui è la risposta a
--     «perché non riesco a invitare Tizio?»;
--   · `e_privata` — nemmeno la segreteria la vede (il suo testo dice «nessun altro socio»);
--   · `dove_si_apre` — che dal 24/08 non nomina più la voce di menu, perché c'è il bottone.

update pmo_ai_settings
set value = jsonb_set(value, '{rubrica}',
      ((value->'rubrica') - 'cos_e' - 'come_si_riempie' - 'come_si_toglie' - 'serve_per_invitare')
      || jsonb_build_object(
        'come_funziona', 'Testo del committente (24/08/2026), da usare come RISPOSTA quando il socio chiede come funziona la rubrica, a cosa serve, o come si aggiunge qualcuno. Sono le sue parole: seguine il senso e il tono, non aggiungere regole che qui non ci sono.

La rubrica è l''elenco delle persone con cui ti piacerebbe giocare. Serve a quello: quando organizzi una partita e vuoi chiamare qualcuno, i nomi li scegli da lì.

Non c''è un modo per aggiungerle a mano — in rubrica si entra solo con un invito. Mandi il link alla persona e, se accetta, te la ritrovi nella rubrica del bot.

• La tua rubrica è solo tua, non la vede nessun altro socio.
• Una cosa da sapere: a una partita puoi invitare solo le persone presenti nella tua rubrica.
• Quando apri la tua rubrica da lì inviti qualcuno di nuovo, o togli chi non ti serve più.',
        'chi_si_puo_invitare', 'SOLO se il socio chiede perché una certa persona non riesce a invitarla: oltre a stare in rubrica, la persona dev''essere già cliente del circolo. Chi non lo è ancora si vede in rubrica ma non ha il bottone per essere invitato, e per farlo giocare si passa dalla segreteria. Non dirlo di tua iniziativa quando spieghi come funziona la rubrica: è la risposta a una domanda, non parte della spiegazione.'
      )),
    updated_by = 'claude-code/voce-87-testi',
    updated_at = now()
where key = 'assistant_kb';

-- ── (d) SERA DEL 24/08 — anche il testo del LIVELLO è suo ───────────────────────────────
--
-- Stessa strada della rubrica: bozza mia dal codice, approvata da lui senza modifiche («il testo
-- della domanda 2 va bene»). E stessa potatura: tolte a_cosa_serve / come_si_ottiene /
-- quante_prove / chi_lo_cambia, che ridicevano le stesse cose con parole diverse.
--
-- ⭐ Restano TRE chiavi, e nessuna delle tre è una definizione — è la ragione per cui
-- sopravvivono alla potatura:
--   · `come_si_dice`   — il livello al socio si dice a PAROLE e mai a numeri (istruzione a te);
--   · `niente_tempi`   — nessuna promessa di tempi sul livello. Sta in piedi da sé finché la
--                        voce 84 è aperta, e regge anche dopo: un tempo promesso è un tempo da
--                        mantenere;
--   · `chi_non_lo_fa`  — Semi-Pro e Professionista non fanno il questionario. Fuori dal testo
--                        principale per scelta: riguarda pochi e allunga.

update pmo_ai_settings
set value = jsonb_set(value, '{livello}',
      ((value->'livello') - 'a_cosa_serve' - 'come_si_ottiene' - 'quante_prove' - 'chi_lo_cambia')
      || jsonb_build_object(
        'come_funziona', 'Testo del committente (24/08/2026), da usare come RISPOSTA quando il socio chiede come si ottiene un livello, come funziona il test, o se lo può rifare. Sono le sue parole: seguine il senso e il tono, non aggiungere regole che qui non ci sono.

Il livello serve al circolo per mettere insieme partite equilibrate. Finché non ce l''hai, non puoi organizzarne una tu.

Per averlo c''è un test: un questionario che si apre da un link tuo, e te lo propongo io con un bottone quando serve — non devi chiedermelo.

Finito il test ti dico com''è andata e ti chiedo se vuoi tenere quel livello o riprovare. Hai tre prove; se non mi rispondi, dopo un giorno tengo l''ultima. Quando il giro è chiuso, se ne può fare un altro dopo 30 giorni.

Il livello lo registra il circolo: io te lo leggo, ma non lo cambio io. Se qualcosa non ti torna, sentila con la segreteria.',
        'chi_non_lo_fa', 'SOLO se viene fuori: chi si dichiara Semi-Pro o Professionista il questionario non lo fa. Non dirlo di tua iniziativa quando spieghi il test — riguarda pochi e allunga la risposta.'
      )),
    updated_by = 'claude-code/voce-87-testi',
    updated_at = now()
where key = 'assistant_kb';

-- ⏳ NON scritto: il testo degli INVITI. La bozza gli è stata messa davanti la sera del 24/08 e
-- la sessione si è chiusa prima della sua correzione. ⇒ `inviti` resta con le MIE parole — sono
-- fatti giusti, letti da `invito-partita.ts`, ma non sono la sua voce. Il giorno che la vuole
-- dare, è una `update` sola e non serve nessun deploy.

-- ── (e) SERA DEL 24/08 — e anche il testo degli INVITI è suo ────────────────────────────
-- Approvato senza modifiche. Stessa potatura: via invito_al_circolo / invito_a_una_partita /
-- quanto_dura / chi_risponde. Qui la potatura è totale — il suo testo copre tutto, e di `inviti`
-- restano solo `_nota` e `come_funziona`.
-- ⇒ Con questo i TRE argomenti nati con la voce 87 parlano tutti con le sue parole.

update pmo_ai_settings
set value = jsonb_set(value, '{inviti}',
      ((value->'inviti') - 'invito_al_circolo' - 'invito_a_una_partita' - 'quanto_dura' - 'chi_risponde')
      || jsonb_build_object(
        'come_funziona', 'Testo del committente (24/08/2026), da usare come RISPOSTA quando il socio chiede come si invita qualcuno, quanto dura un invito, o cosa succede se chi ha invitato non risponde. Sono le sue parole: seguine il senso e il tono, non aggiungere regole che qui non ci sono.

Gli inviti sono due cose diverse.

Per far entrare al circolo una persona che ancora non c''è, dalla tua rubrica chiedi il link e glielo mandi tu: quando accetta, te la ritrovi in rubrica.

Per chiamare qualcuno a giocare, apri la partita e scegli i nomi dalla tua rubrica: gli arriva un messaggio qui sul bot, con i bottoni per accettare o rifiutare.

Un invito a una partita vale un''ora. Se scade di notte resta buono fino alle 9 del mattino, e in ogni caso non oltre l''inizio della partita. Il posto può finire anche prima, se risponde qualcun altro.

Rispondere sta a loro: io non sollecito nessuno e non accetto al posto di nessuno.'
      )),
    updated_by = 'claude-code/voce-87-testi',
    updated_at = now()
where key = 'assistant_kb';
