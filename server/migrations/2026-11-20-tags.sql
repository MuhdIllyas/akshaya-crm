-- Tags (like WhatsApp lists): each staff member makes their own named tags,
-- tags chats and notes with them, then filters Messenger / Notes by a tag.
-- Tags are private to the person who made them; the same tag can be used on
-- both chats and notes.

CREATE TABLE IF NOT EXISTS staff_tags (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  name VARCHAR(40) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT 'blue',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_tags_owner_name_idx
  ON staff_tags (staff_id, lower(name));

CREATE TABLE IF NOT EXISTS staff_tag_conversations (
  tag_id INTEGER NOT NULL REFERENCES staff_tags(id) ON DELETE CASCADE,
  conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  added_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tag_id, conversation_id)
);

CREATE TABLE IF NOT EXISTS staff_tag_notes (
  tag_id INTEGER NOT NULL REFERENCES staff_tags(id) ON DELETE CASCADE,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  added_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tag_id, note_id)
);

CREATE INDEX IF NOT EXISTS staff_tag_conversations_conv_idx ON staff_tag_conversations (conversation_id);
CREATE INDEX IF NOT EXISTS staff_tag_notes_note_idx ON staff_tag_notes (note_id);
