-- One WhatsApp chat per customer phone PER CENTRE ACCOUNT, not per phone.
-- The old index allowed a single WhatsApp chat per phone across all centres,
-- but each centre has its own WhatsApp number (communication account) and
-- its own chat with the customer. So when a customer who already had a chat
-- with one centre messaged another centre, creating that centre's chat failed
-- ("duplicate key value violates unique constraint uniq_whatsapp_phone") and
-- the message never reached the CRM.
-- Apply with: node scripts/orgs.js migrate migrations/2026-11-16-whatsapp-chat-per-centre.sql

DROP INDEX IF EXISTS uniq_whatsapp_phone;

-- Present on every live database already; here so this file also runs on older copies.
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS communication_account_id INT;

-- The old index allowed at most one chat per phone, so this can't conflict
-- with existing rows. Chats without an account (old data) aren't limited.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_whatsapp_phone_account
  ON chat_conversations (channel, phone_number, communication_account_id)
  WHERE channel = 'whatsapp';
