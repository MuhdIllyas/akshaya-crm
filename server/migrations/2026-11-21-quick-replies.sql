-- Quick replies: short saved messages shown as chips above the Messenger
-- message box ("Documents list", "Office timings"). Shared by a centre;
-- centre_id NULL = every centre (made by a superadmin).

CREATE TABLE IF NOT EXISTS chat_quick_replies (
  id SERIAL PRIMARY KEY,
  centre_id INTEGER REFERENCES centres(id) ON DELETE CASCADE,
  title VARCHAR(40) NOT NULL,
  body TEXT NOT NULL,
  created_by INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_quick_replies_centre_idx ON chat_quick_replies (centre_id);
