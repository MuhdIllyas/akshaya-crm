import { sendMessage } from '../../utils/messageRouter.js'; 

class InternalAdapter {
  async send(payload) {
    const { conversation_id, sender, message, io } = payload;

    // 1. Save the message using your existing router
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

    // 2. 🔥 GUARANTEE SOCKET DELIVERY
    // Because cross-centre internal chats have no centre_id, legacy routers often 
    // drop the socket broadcast. We force the emission here to all participants.
    if (io) {
        io.to(`conversation:${conversation_id}`).emit("new_message", savedMessage);
    }

    return { 
      success: true,
      conversationId: conversation_id, 
      message: savedMessage 
    };
  }
}

export default new InternalAdapter();