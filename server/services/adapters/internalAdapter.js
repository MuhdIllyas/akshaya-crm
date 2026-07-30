import { sendMessage } from '../../utils/messageRouter.js'; 

class InternalAdapter {
  async send(payload) {
    const { conversation_id, sender, message, io } = payload;

    const savedMessage = await sendMessage({
      conversation_id: conversation_id,
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
      conversationId: conversation_id, 
      message: savedMessage 
    };
  }
}

export default new InternalAdapter();