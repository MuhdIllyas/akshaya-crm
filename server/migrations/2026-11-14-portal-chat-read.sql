-- Customer portal chat: what the customer has read, for the unread badge on
-- "Messages". The last message id they have seen in each chat.
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS customer_last_read_id BIGINT;

-- Existing chats start as read, so customers aren't shown old replies as new.
UPDATE chat_conversations c
   SET customer_last_read_id = COALESCE((SELECT max(m.id) FROM chat_messages m WHERE m.conversation_id = c.id), 0)
 WHERE c.channel = 'portal' AND c.customer_last_read_id IS NULL;
