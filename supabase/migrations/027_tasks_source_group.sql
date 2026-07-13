-- Add source classification and group linkage to tasks table
BEGIN;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES meeting_groups(id) ON DELETE SET NULL;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_source_check CHECK (source IN ('ai_extracted', 'manual'));

CREATE INDEX IF NOT EXISTS tasks_source_idx ON tasks(source);
CREATE INDEX IF NOT EXISTS tasks_group_id_idx ON tasks(group_id);

COMMIT;
