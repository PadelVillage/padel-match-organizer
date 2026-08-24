-- 🚨⭐⭐ VOCE 84 — QUANDO IL SOCIO APRE IL QUIZ, e perché è un fatto e non un dettaglio.
--
-- 🗣️ Decisione del committente, 24/08/2026 sera, dopo il collaudo di Marco Aprea:
-- *«Il tempo bisogna calcolarlo da quando si inizia a fare il quiz.»*
--
-- 📏 IL FATTO CHE L'HA RESA NECESSARIA, misurato al secondo quella sera:
--     20:53:20  il bot dà il link e accende la sorveglianza (tetto: 20 minuti)
--     21:13:22  il tetto scade — il quiz non è ancora stato aperto
--     21:16:49  il socio apre il quiz
--     21:18:23  consegna, in 1 minuto e 34 secondi — ma non lo guarda più nessuno
--   ⇒ Il quiz è durato UN MINUTO E MEZZO. I 23 minuti stanno fra il RICEVERE il link e
--   l'APRIRLO, che è la cosa che fa una persona qualunque: una telefonata, la cena, il
--   parcheggio. Il cronometro era ancorato al momento sbagliato.
--
-- 📌 E il codice del bot DICHIARAVA la sua ipotesi: *«chi apre il link domani non è un caso da
-- coprire qui»*. La categoria «domani» sembra rara e invece copre quasi tutti.
-- ⇒ *Un limite dichiarato con l'esempio estremo si fa credere raro: chi lo scrive difende
-- l'esempio, non il confine.*
--
-- ⭐⭐ IL FATTO ESISTEVA GIÀ E NESSUNO LO SCRIVEVA. Quando la pagina del quiz si apre chiama
-- `assessment-quiz` con `azione: 'pesca'` per farsi dare le domande: quello È il momento in cui
-- il socio comincia. Non serve inventare un segnale nuovo — serve conservare quello che passa
-- già. Questa colonna è l'unico pezzo mancante.
--
-- ⚖️ PERCHÉ NON SI RIUSA `sent_at`: quella dice quando il link è stato SPEDITO per e-mail, ed è
-- un'altra domanda. Due domande diverse nella stessa casella sono esattamente il difetto della
-- voce 71 (*un valore che significa due cose*), e qui costerebbe caro: chi legge il cronometro
-- crederebbe che il socio abbia aperto il quiz quando invece gli è solo arrivata una mail.
--
-- 🚨 NON TOCCA IL RIUSO DEL GETTONE (cura A della stessa voce): un gettone APERTO ma senza
-- scheda resta riusabile, ed è giusto — è il socio che ha aperto il quiz e l'ha abbandonato,
-- e tornando deve ritrovare il suo. A rendere un gettone «usato» è la SCHEDA, non l'apertura.
--
-- ⚖️ ADDITIVA E ANNULLABILE: colonna nuova, `null` per tutte le righe di prima. Chi legge e non
-- la trova si comporta come oggi. Nessuna riga esistente cambia significato.

alter table public.assessment_tokens
  add column if not exists opened_at timestamptz;

comment on column public.assessment_tokens.opened_at is
  'Quando il socio ha APERTO il quiz (ultima chiamata `pesca` per questo gettone). Da qui parte il '
  'cronometro della sorveglianza del bot. NULL = mai aperto. Non è `sent_at`, che dice quando il '
  'link è stato spedito. Voce 84, 24/08/2026.';
