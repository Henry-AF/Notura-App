-- Many-to-many mapping between tasks and labels
BEGIN;

CREATE TABLE IF NOT EXISTS task_label_map (
  task_id   uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id  uuid NOT NULL REFERENCES task_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

ALTER TABLE task_label_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_label_map: owner full access"
  ON task_label_map FOR ALL
  USING (
    EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND t.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND t.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS task_label_map_task_id_idx ON task_label_map(task_id);
CREATE INDEX IF NOT EXISTS task_label_map_label_id_idx ON task_label_map(label_id);

COMMIT;
