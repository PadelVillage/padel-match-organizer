-- Parser Intelligente v1.0 — tabelle per tracking errori e versionamento regole

CREATE TABLE IF NOT EXISTS pmo_parser_errors (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  input_originale  TEXT        NOT NULL,
  intent_riconosciuto VARCHAR,
  confidence       FLOAT       CHECK (confidence >= 0 AND confidence <= 1),
  error_message    TEXT,
  timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  admin_selected   BOOLEAN     NOT NULL DEFAULT FALSE,
  versione_parser  VARCHAR,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pmo_parser_errors_timestamp
  ON pmo_parser_errors (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_pmo_parser_errors_admin_selected
  ON pmo_parser_errors (admin_selected);

CREATE INDEX IF NOT EXISTS idx_pmo_parser_errors_staff_id
  ON pmo_parser_errors (staff_id);

ALTER TABLE pmo_parser_errors ENABLE ROW LEVEL SECURITY;

-- Staff vede solo i propri errori
CREATE POLICY "staff_own_errors" ON pmo_parser_errors
  FOR SELECT USING (auth.uid() = staff_id);

-- Staff può inserire i propri errori
CREATE POLICY "staff_insert_errors" ON pmo_parser_errors
  FOR INSERT WITH CHECK (auth.uid() = staff_id OR staff_id IS NULL);

-- Admin (owner o admin) vede e gestisce tutto
CREATE POLICY "admin_all_errors" ON pmo_parser_errors
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM pmo_staff_profiles
      WHERE auth_user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pmo_parser_config (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  versione            VARCHAR     NOT NULL,
  regole_json         JSONB       NOT NULL,
  aggiornato_da       VARCHAR,
  data_aggiornamento  TIMESTAMPTZ NOT NULL,
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pmo_parser_config_versione_unique UNIQUE (versione)
);

CREATE INDEX IF NOT EXISTS idx_pmo_parser_config_versione
  ON pmo_parser_config (versione DESC);

ALTER TABLE pmo_parser_config ENABLE ROW LEVEL SECURITY;

-- Solo admin (owner o admin) può leggere e scrivere
CREATE POLICY "admin_all_config" ON pmo_parser_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM pmo_staff_profiles
      WHERE auth_user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Inserisce la versione iniziale v1.0 nel config (eseguito una volta sola)
-- Il JSON viene popolato dall'admin panel dopo il deploy
