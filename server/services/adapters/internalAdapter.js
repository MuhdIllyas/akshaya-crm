import { resolveConversation } from '../../utils/conversationService.js';
import { sendMessage } from '../../utils/messageRouter.js';

class InternalAdapter {
  async process(payload) {
    const { 
      conversation_id, // Optional: if they are replying to an existing chat
      sender, 
      recipients = {}, 
      message, 
      context = {},
      io 
    } = payload;

    let targetConversationId = conversation_id;

    // 1. Resolve or Create Conversation if not provided
    if (!targetConversationId) {
      const conversation = await resolveConversation({
        channel: 'internal',
        context_type: context.type || null,
        context_id: context.id || null,
        participant_ids: [sender.id, ...(recipients.staff || [])],
        is_group: recipients.staff?.length > 1 || context.is_group,
        name: context.name || null,
        created_by: sender.id,
        centre_id: null // 🔥 Enforcing the Tenant-less rule for internal chats
      });
      targetConversationId = conversation.id;
    }

    // 2. Route the Message using your existing router
    const savedMessage = await sendMessage({
      conversation_id: targetConversationId,
      sender_id: sender.id,
      sender_type: sender.type || 'staff',
      message: message.text,
      message_type: message.type || 'text',
      file: message.file || null,
      mentions: message.mentions || [],
      io: io
    });

    return { 
      success: true,
      conversationId: targetConversationId, 
      message: savedMessage 
    };
  }
}

export default new InternalAdapter();