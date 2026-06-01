-- FASE 4 v1.3 — Tabella booking_parses per persistenza storica riparsificazioni

CREATE TABLE IF NOT EXISTS booking_parses (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id             TEXT        NOT NULL,
  parsed_by_staff_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  parse_version          VARCHAR,
  original_booking_text  TEXT        NOT NULL,
  confidence_original    FLOAT       CHECK (confidence_original >= 0 AND confidence_original <= 1),
  confidence_new         FLOAT       CHECK (confidence_new >= 0 AND confidence_new <= 1),
  istruttore_original    VARCHAR,
  istruttore_new         VARCHAR,
  campo_original         VARCHAR,
  campo_new              VARCHAR,
  orario_original        VARCHAR,
  orario_new             VARCHAR,
  snapshot_parser_rules  JSONB,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS booking_parses_booking_id
  ON booking_parses (booking_id);

CREATE INDEX IF NOT EXISTS booking_parses_created_at
  ON booking_parses (created_at DESC);

ALTER TABLE booking_parses ENABLE ROW LEVEL SECURITY;

-- Staff vede solo i propri parse
CREATE POLICY "staff_own_parses" ON booking_parses
  FOR SELECT USING (auth.uid() = parsed_by_staff_id);

-- Admin (owner o admin) vede e gestisce tutti i parse
CREATE POLICY "admin_all_parses" ON booking_parses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM pmo_staff_profiles
      WHERE auth_user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
