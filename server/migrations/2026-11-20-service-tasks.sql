-- Service tasks: an admin or superadmin assigns a service (and customer) to a staff
-- member as a task. The staff member opens it in a pre-filled Service Entry form;
-- saving the entry links it to the task and completes the task.
--
-- Staff can also:
--   * decline (hand it back to the admin)        -> status 'declined'
--   * cancel it (e.g. customer has no documents) -> status 'cancelled'
-- Both need a note, kept in close_reason and shown to admin / superadmin.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_kind VARCHAR(20) NOT NULL DEFAULT 'general';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS related_subcategory_id INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS close_reason TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS closed_by INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;

-- Older databases may be missing these (taskService has inserted them for a while).
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source VARCHAR(30) DEFAULT 'manual';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_action_id INTEGER;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS chk_task_kind;
ALTER TABLE tasks ADD CONSTRAINT chk_task_kind CHECK (task_kind IN ('general', 'service'));

-- Allow the new 'declined' status.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS chk_status;
ALTER TABLE tasks ADD CONSTRAINT chk_status
  CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'declined'));

CREATE INDEX IF NOT EXISTS tasks_service_open_idx
  ON tasks (assigned_to, status) WHERE task_kind = 'service';
