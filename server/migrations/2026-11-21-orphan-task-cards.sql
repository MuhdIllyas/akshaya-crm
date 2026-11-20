-- Task cards in chats whose task was deleted showed as an empty gap (a chat
-- holding only such cards looked blank). Deleting a task now hides its card;
-- this hides the cards already left behind.

UPDATE chat_messages m
   SET is_deleted = true
 WHERE m.message_type = 'task'
   AND m.is_deleted = false
   AND m.message ~ '^[0-9]+$'
   AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = m.message::int);
