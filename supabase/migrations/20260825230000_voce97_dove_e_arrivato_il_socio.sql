-- 🧩⭐⭐ VOCE 97 — DOVE È ARRIVATO IL SOCIO nel test, e perché quel posto è il gestionale.
--
-- 🗣️ Nasce da una domanda sua del 25/08/2026: *«forse facendolo con una domanda alla volta
-- potremmo anche metterlo dentro Telegram?»* — e la risposta è sì. Ma «una domanda alla volta»
-- vuol dire che qualcuno deve ricordare a che punto è chi sta rispondendo, e questa colonna è
-- quel qualcuno.
--
-- 🚨 IL BUCO CHE IL MOTORE A PASSI CHIUDE, per non perderlo di vista leggendo solo la colonna:
-- oggi il test è «tutto in una consegna» — la pagina si fa dare le QUATTRO domande del cancello
-- insieme e le disegna. Chi lo fa può leggersele tutte prima di rispondere alla prima: cercarle,
-- chiederle, aprirle in un'altra scheda. Le risposte giuste non escono dal server (voce 27), ma
-- le DOMANDE sì, e tutte in una volta. Un passo per volta quel tempo non esiste: la domanda dopo
-- **non è ancora uscita** finché non è arrivata la risposta a quella prima.
--
-- ⚖️ PERCHÉ LO STATO STA QUI E NON NEL BOT, che pure sarebbe più comodo — tre ragioni, e
-- nessuna è di gusto:
--   ① un aggiornamento del bot non deve buttare per terra chi è a metà test. I deploy sono
--      frequenti e durano secondi, ma un socio a metà di dodici domande non lo sa;
--   ② *il gestionale SA, il bot DICE*: a che punto è un socio è un fatto del circolo, non una
--      variabile di chi gli sta parlando. Il giorno in cui il canale cambia, questo non si tocca;
--   ③ la pagina e il bot devono poter guardare lo STESSO giro, o sarebbero due test diversi
--      con lo stesso nome.
--
-- ⛔ NON CONTIENE NIENTE DI SEGRETO, e va detto perché la tentazione di guardarla come «le
-- risposte del quiz» è forte: qui ci sono le risposte CHE HA DATO IL SOCIO — le sue, quelle che
-- ha appena scelto lui. Le risposte GIUSTE non ci passano e non ci passeranno: vivono nella
-- banca dentro l'edge, e la correzione avviene là (`assessKnowledgeEvaluate`). Chi leggesse
-- questa colonna vedrebbe ciò che il socio sa già di aver risposto.
--
-- ⚖️ ADDITIVA E ANNULLABILE: colonna nuova, `null` per tutte le righe di prima. La strada
-- vecchia (`pesca` + `consegna` in blocco) non la legge e non la scrive: chi fa il test dalla
-- pagina si comporta esattamente come ieri. Nessuna riga esistente cambia significato.
--
-- ↩️ RIPRISTINO:  alter table public.assessment_tokens drop column if exists progress;

alter table public.assessment_tokens
  add column if not exists progress jsonb;

comment on column public.assessment_tokens.progress is
  'Il test A PASSI: dove è arrivato il socio. Forma: {"risposte": {"<chiave>": "<opzione scelta>"}, '
  '"aggiornato": "<iso>"} — le chiavi sono i campi della scheda (experience, frequency, '
  'declaredLevel, …) e "k:<id>" per le domande di conoscenza. Contiene le risposte DATE dal socio, '
  'mai quelle giuste. NULL = test non cominciato, o fatto dalla pagina in una consegna sola. '
  'Voce 97, 25/08/2026.';
