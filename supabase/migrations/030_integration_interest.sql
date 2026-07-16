BEGIN;

CREATE TABLE IF NOT EXISTS integration_interest (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel     text        NOT NULL CHECK (channel IN ('zoom','chrome_extension')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel)
);

ALTER TABLE integration_interest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integration_interest: owner full access"
  ON integration_interest FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS integration_interest_user_id_idx
  ON integration_interest(user_id);

COMMIT;
