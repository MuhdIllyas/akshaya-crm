-- Chat bubbles: each person's own settings (on/off, message text, sound, and which
-- kinds of chats get a bubble). NULL = the defaults in routes/collaboration/chat.js.

ALTER TABLE staff ADD COLUMN IF NOT EXISTS chat_bubble_settings JSONB;
