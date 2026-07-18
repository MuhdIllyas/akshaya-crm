import pool from '../../db.js';
import axios from 'axios';
import { isWithin24Hours } from '../../utils/whatsappWindow.js';
import { triggerNotification } from '../../utils/communication/notificationEngine.js';
import { sendMessage } from '../../utils/messageRouter.js';

class WhatsAppAdapter {
  async send(payload) {
    const { conversation_id, sender, message, io } = payload;

    // 1. Save the message to the database (and emit sockets)
    const savedMessage = await sendMessage({
      conversation_id: conversation_id,
      sender_id: sender.id,
      sender_type: sender.type || 'staff',
      message: message.text,
      message_type: message.type || 'text',
      file: message.file || null,
      direction: 'outgoing', // 🔥 Explicitly mark as outgoing for external chats
      mentions: message.mentions || [],
      io: io
    });

    // 2. Deliver to Meta / Libromi API (Fire and forget, don't block the UI)
    this.deliverToMeta(conversation_id, message.text, savedMessage)
        .catch(err => console.error("[WhatsAppAdapter] Meta delivery failed:", err));

    return { 
      success: true,
      conversationId: conversation_id, 
      message: savedMessage 
    };
  }

  async deliverToMeta(conversationId, textMessage, savedMessage) {
    const client = await pool.connect();
    try {
      const convRes = await client.query(`SELECT * FROM chat_conversations WHERE id = $1`, [conversationId]);
      const conversation = convRes.rows[0];
      const to = conversation.phone_number;

      if (!to) return;

      // 1. Check 24-Hour Customer Service Window
      const lastCustomerTime = await this.getLastCustomerMessageTime(client, conversationId);
      const within24h = isWithin24Hours(lastCustomerTime);

      if (!within24h) {
        console.log(`[WhatsAppAdapter] Outside 24h window for ${to}, routing via Notification Engine.`);
        const customerName = conversation.name ? conversation.name.replace(/Chat with |WhatsApp /ig, '').trim() : 'Customer';
        
        await triggerNotification({
          eventKey: 'reengagement_message',
          centreId: conversation.centre_id,
          customerPhone: to,
          templateParams: [customerName]
        });
        return; 
      }

      // 2. Fetch Account Credentials
      let accountQuery;
      if (conversation.communication_account_id) {
        accountQuery = await client.query(`SELECT id, access_token, base_url, channel_id, name FROM communication_accounts WHERE id = $1 AND is_active = true`, [conversation.communication_account_id]);
      } else if (conversation.centre_id) {
        accountQuery = await client.query(`
          SELECT ca.id, ca.access_token, ca.base_url, ca.channel_id, ca.name 
          FROM communication_accounts ca 
          JOIN centres c ON c.communication_account_id = ca.id 
          WHERE c.id = $1 AND ca.is_active = true
        `, [conversation.centre_id]);
      }

      if (!accountQuery || accountQuery.rows.length === 0) return;
      
      const account = accountQuery.rows[0];
      const formattedPhone = to.startsWith('+91') ? to : `+91${to.replace(/^\+91/, '')}`;

      // 3. Construct Native Media Payload using the saved database URLs
      let payload = {
        to: formattedPhone,
        channel_id: account.channel_id,
      };

      if (savedMessage.file_url) {
        const baseUrl = process.env.VITE_API_URL || 'https://staging-api.akshayasahayi.com';
        const safeBase = baseUrl.replace(/\/$/, '');
        const safePath = savedMessage.file_url.startsWith('/') ? savedMessage.file_url : `/${savedMessage.file_url}`;
        const fullPublicUrl = `${safeBase}${safePath}`;

        const ext = savedMessage.file_name ? savedMessage.file_name.split('.').pop().toLowerCase() : '';
        
        if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
          payload.type = 'image';
          payload.image = { link: fullPublicUrl };
          if (textMessage) payload.image.caption = textMessage;
        } 
        else if (['mp4', '3gp'].includes(ext)) {
          payload.type = 'video';
          payload.video = { link: fullPublicUrl };
          if (textMessage) payload.video.caption = textMessage;
        } 
        else if (['mp3', 'wav', 'ogg', 'aac'].includes(ext)) {
          payload.type = 'audio';
          payload.audio = { link: fullPublicUrl };
        } 
        else {
          payload.type = 'document';
          payload.document = { 
            link: fullPublicUrl, 
            filename: savedMessage.file_name || 'Document.pdf' 
          };
          if (textMessage) payload.document.caption = textMessage; 
        }
      } else {
        payload.type = 'text';
        payload.text = { body: textMessage || "" };
      }

      // 4. Send to Libromi
      await axios.post(`${account.base_url}/messages`, payload, {
        headers: { Authorization: `Bearer ${account.access_token}`, 'Content-Type': 'application/json' }
      });

      console.log(`✅ [WhatsAppAdapter] ${payload.type} sent to ${formattedPhone} via Account: ${account.name}`);

    } finally {
      client.release();
    }
  }

  // Helper method moved from the main router
  async getLastCustomerMessageTime(client, conversationId) {
    const result = await client.query(
      `SELECT created_at FROM chat_messages
       WHERE conversation_id = $1 AND sender_type = 'customer'
       ORDER BY created_at DESC LIMIT 1`,
      [conversationId]
    );
    return result.rows[0]?.created_at || null;
  }
}

export default new WhatsAppAdapter();