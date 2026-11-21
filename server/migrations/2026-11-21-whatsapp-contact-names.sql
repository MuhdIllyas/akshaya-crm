-- Names for WhatsApp chats (they used to show as "WhatsApp - Customer"):
--   wa_profile_name: the name the person set in WhatsApp, sent with each incoming message
--   contact_name:    a name staff saved for this number (optional, wins over everything)
-- Shown in this order: contact_name, the matching customer's name, wa_profile_name, the number.

ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS wa_profile_name TEXT;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS contact_name TEXT;
