-- VOCE 161 — LA MEMORIA DELLA SENTINELLA DELLA SALUTE DEL DATABASE.
--
-- 📏 Da dove nasce: l'avaria del 05/09 (voce 160) era visibile da SETTIMANE in tre numeri che
-- nessuno guardava — `n_tup_upd` di `pmo_cloud_records` a 14 milioni su 31 mila righe,
-- `n_tup_hot_upd` a ZERO, e 62 GB di WAL per un database da 685 MB (90 a 1). Nessuno dei tre
-- e' un'opinione: stavano tutti in `pg_stat_user_tables` e nei contatori di Supabase.
--
-- ⚖️ PERCHE' UNA TABELLA E NON UN FILE, che e' la ragione per cui questa migrazione esiste:
-- `pg_stat_user_tables` conta dall'ultimo riavvio e si AZZERA con lui (il 05/09 alle 12:08 e'
-- ripartito da zero). ⇒ Una soglia sul TOTALE tacerebbe per giorni dopo ogni riavvio, cioe'
-- proprio dopo un'avaria. La forma giusta e' un DELTA, e un delta vuole la lettura di ieri.
-- La sentinella gira su GitHub Actions, dove un «accanto» che duri non c'e': la cache si
-- sfratta, un file committato sporcherebbe il repo ogni notte. Qui invece la memoria e'
-- STORIA — e se il database e' morto la sentinella non la legge, quindi esce CIECA, che e'
-- l'unica cosa onesta da dire quando non si e' guardato.
--
-- 🚨 Una riga al giorno, e si cancella da sola dopo 400 giorni: una sentinella della salute
-- che gonfia il database che sorveglia sarebbe la voce 160 in miniatura.
--
-- 🔒 RLS accesa e NESSUNA policy, di proposito: qui dentro c'e' la fotografia interna del
-- database e non la deve leggere ne' `anon` ne' `authenticated`. Ci arriva solo chi passa da
-- `postgres`/`service_role`, cioe' la sentinella con la sua credenziale di amministrazione.
--
-- Idempotente: si puo' rieseguire.

CREATE TABLE IF NOT EXISTS public.pmo_sentinella_salute (
  id              bigserial PRIMARY KEY,
  misurato_at     timestamptz NOT NULL DEFAULT now(),
  progetto        text        NOT NULL,
  misura          jsonb       NOT NULL,
  verdetto        text        NOT NULL,
  regole          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  consecutivi     integer     NOT NULL DEFAULT 0,
  allarme_attivo  boolean     NOT NULL DEFAULT false,
  ultimo_battito  timestamptz,
  mandati         jsonb       NOT NULL DEFAULT '[]'::jsonb
);

COMMENT ON TABLE public.pmo_sentinella_salute IS
  'Voce 161 — la memoria della sentinella della salute: una lettura al giorno di pg_stat_user_tables, del WAL e della dimensione del database. Serve a calcolare il DELTA, perche i contatori si azzerano a ogni riavvio.';
COMMENT ON COLUMN public.pmo_sentinella_salute.verdetto IS
  'serena | allarme | non-giudicabile — e cieca non compare mai qui, perche una lettura cieca non arriva a scriversi.';
COMMENT ON COLUMN public.pmo_sentinella_salute.regole IS
  'Esito di OGNI regola: allarme | a-posto | non-giudicata. «Non ho potuto guardare» resta distinto da «ho guardato ed e a posto».';

-- Si legge sempre l'ultima riga di un progetto: e' l'unico accesso che la sentinella fa.
CREATE INDEX IF NOT EXISTS pmo_sentinella_salute_progetto_id_idx
  ON public.pmo_sentinella_salute (progetto, id DESC);

ALTER TABLE public.pmo_sentinella_salute ENABLE ROW LEVEL SECURITY;
