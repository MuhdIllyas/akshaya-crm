import express from 'express';
import { resolveConversation } from '../utils/conversationService.js';
import { sendMessage } from '../utils/messageRouter.js';
import pool from '../db.js';

const router = express.Router();

// Helper to safely extract text from any API provider structure
const extractText = (msg) => {
  if (!msg) return null;
  if (typeof msg === 'string') return msg;
  if (typeof msg.text === 'string') return msg.text;
  if (msg.text?.body) return msg.text.body;
  if (msg.button?.text) return msg.button.text;
  if (msg.interactive?.button_reply?.title) return msg.interactive.button_reply.title;
  if (msg.interactive?.list_reply?.title) return msg.interactive.list_reply.title;
  if (msg.message) return typeof msg.message === 'string' ? msg.message : msg.message.body;
  if (msg.body) return msg.body;
  return null;
};

router.post('/whatsapp', async (req, res) => {
  // 🔥 1. Immediately tell Libromi we got it to prevent duplicates
  res.sendStatus(200);

  try {
    const body = req.body;
    console.log("🔥 LIBROMI WEBHOOK HIT");

    let from = null;
    let text = null;
    let message_id = null;
    let recipientPhone = null;

    // ===============================
    // 🔥 FORMAT 1: META / WHATSAPP CLOUD STYLE
    // ===============================
    if (body.entry && Array.isArray(body.entry)) {
      const changes = body.entry[0]?.changes;
      if (changes && changes.length > 0) {
        const value = changes[0]?.value;
        recipientPhone = value?.metadata?.display_phone_number; 

        const messages = value?.messages;
        if (messages && messages.length > 0) {
          const msg = messages[0];
          from = msg.from;
          text = extractText(msg);
          message_id = msg.id;
        }
      }
    }
    // ===============================
    // 🔥 FORMAT 2: Flat / Alternative Libromi Structures
    // ===============================
    else if (body.messages && Array.isArray(body.messages)) {
      const msg = body.messages[0];
      from = msg.from;
      text = extractText(msg);
      message_id = msg.id;
    } else if (body.data) {
      from = body.data.from || body.data.phone || body.data.sender;
      text = extractText(body.data);
      message_id = body.data.id;
    } else if (body.from) {
      from = body.from;
      text = extractText(body);
      message_id = body.message_id || body.id;
    }

    // ===============================
    // 🧹 NORMALIZE PHONE
    // ===============================
    if (from) {
      from = from.toString().replace(/\s+/g, '');
      if (!from.startsWith('+')) from = '+' + from;
    }

    // ===============================
    // ❌ VALIDATION 
    // ===============================
    if (!from || !text) {
      console.log(`⚠️ Webhook Ignored. It was likely a read/delivery receipt. (From: ${from}, Text: ${text})`);
      return; 
    }

    // ===============================
    // 🔍 FIND ACCOUNTS AND CUSTOMERS
    // ===============================
    let communicationAccountId = null;
    let centreId = null;

    // First try: Aggressively hunt for the channel_id (Best for Libromi)
    let incomingChannelId = body.channel_id || body.data?.channel_id || null;
    
    if (incomingChannelId) {
        const accountQuery = await pool.query(
            `SELECT ca.id, c.id as centre_id 
             FROM communication_accounts ca
             LEFT JOIN centres c ON c.communication_account_id = ca.id
             WHERE ca.channel_id = $1 LIMIT 1`,
            [String(incomingChannelId)]
        );
        if (accountQuery.rows.length > 0) {
            communicationAccountId = accountQuery.rows[0].id;
            centreId = accountQuery.rows[0].centre_id;
        }
    }

    // Fallback: Match by the receiver's phone number
    if (!communicationAccountId && recipientPhone) {
        const formattedRecipient = recipientPhone.startsWith('+') ? recipientPhone : `+${recipientPhone}`;
        const accountQuery = await pool.query(
            `SELECT ca.id, c.id as centre_id 
             FROM communication_accounts ca
             LEFT JOIN centres c ON c.communication_account_id = ca.id
             WHERE ca.phone_number = $1 OR ca.phone_number = $2 LIMIT 1`,
            [formattedRecipient, recipientPhone]
        );
        if (accountQuery.rows.length > 0) {
            communicationAccountId = accountQuery.rows[0].id;
            centreId = accountQuery.rows[0].centre_id;
        }
    }

    const customerQuery = await pool.query(
        `SELECT id, name FROM customers WHERE primary_phone = $1 OR primary_phone = $2 LIMIT 1`,
        [from, from.replace('+', '')]
    );
    const customerId = customerQuery.rows.length > 0 ? customerQuery.rows[0].id : null;
    const customerName = customerQuery.rows.length > 0 ? customerQuery.rows[0].name : "Customer";

    // ===============================
    // 💬 RESOLVE CONVERSATION
    // ===============================
    const conversation = await resolveConversation({
      channel: 'whatsapp',
      context_type: customerId ? 'customer' : null,
      context_id: null,
      customer_id: customerId,
      phone_number: from,
      communication_account_id: communicationAccountId,
      centre_id: centreId, // 🔥 Pass Centre ID so the Admin gets automatically added to new chats!
      name: `WhatsApp - ${customerName}`,
      is_group: false,
    });

    // ===============================
    // 💾 SAVE MESSAGE
    // ===============================
    const io = req.app.get('io') || req.io;

    await sendMessage({
      conversation_id: conversation.id,
      sender_id: customerId, 
      sender_type: 'customer',
      message: text,
      message_type: 'text',
      direction: 'incoming',
      io: io,
      external_message_id: message_id
    });

    // ===============================
    // 🔔 PUSH NOTIFICATION TO STAFF UI
    // ===============================
    if (io && conversation.id) {
      // Find all staff who have access to this conversation
      const participantsRes = await pool.query(
        `SELECT staff_id FROM chat_participants WHERE conversation_id = $1 AND participant_type = 'staff'`,
        [conversation.id]
      );

      // We must use a for...of loop here to safely await the DB queries inside
      for (const p of participantsRes.rows) {
        
        // 🔥 FIX: Calculate the exact unread count for this specific staff member
        const unreadRes = await pool.query(`
          SELECT COUNT(*) as count
          FROM chat_messages m
          LEFT JOIN chat_message_reads r ON m.id = r.message_id AND r.staff_id = $1
          WHERE m.conversation_id = $2 
            AND (m.sender_id != $1 OR m.sender_id IS NULL) 
            AND r.id IS NULL
            AND m.is_deleted = false
        `, [p.staff_id, conversation.id]);

        const unreadCount = parseInt(unreadRes.rows[0].count) || 0;

        // 1. Tell DashboardLayout to bump the red badge number (Unread Count)
        io.to(`user:${p.staff_id}`).emit('unread_update', {
          conversationId: conversation.id,
          unread: unreadCount // 👈 The missing puzzle piece
        });
        
        // 2. Tell MessengerPage to update the text snippet in the sidebar list
        io.to(`user:${p.staff_id}`).emit('conversation_updated', {
          conversationId: conversation.id,
          lastMessage: text,
          lastMessageSenderId: customerId,
          lastMessageSender: customerName,
          time: new Date().toISOString(),
          unread: unreadCount // 👈 Ensures the sidebar UI gets the number too
        });
      }
    }

    console.log(`✅ Message safely routed and saved from ${from}: "${text.substring(0, 20)}..."`);

  } catch (err) {
    console.error('❌ WhatsApp webhook processing error:', err);
  }
});

export default router;