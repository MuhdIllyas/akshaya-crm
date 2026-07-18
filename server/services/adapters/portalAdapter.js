import { sendMessage } from '../../utils/messageRouter.js';

class PortalAdapter {
  async send(payload) {
    const { conversation_id, sender, message, io } = payload;

    // 1. Save the message to the database
    const savedMessage = await sendMessage({
      conversation_id: conversation_id,
      sender_id: sender.id,
      sender_type: sender.type, // 'staff' or 'customer'
      message: message.text,
      message_type: message.type || 'text',
      file: message.file || null,
      mentions: message.mentions || [],
      io: io
      // Note: We do not pass direction here, the messageRouter defaults to 'internal' 
      // which is perfect for portal chats.
    });

    // 2. Guarantee Socket Delivery for the Customer Portal
    // Portal chats require both the staff and the specific customer to get the socket
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

export default new PortalAdapter();