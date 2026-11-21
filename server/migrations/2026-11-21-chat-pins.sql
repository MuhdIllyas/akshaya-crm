-- Pinned chats: each staff member pins chats for themselves (Messenger shows
-- them in a "Pinned" section at the top). Stored on their own participant row.

ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS chat_participants_pinned_idx
  ON chat_participants (staff_id) WHERE pinned_at IS NOT NULL;
