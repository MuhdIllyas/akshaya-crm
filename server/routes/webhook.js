import express from 'express';
import pool from '../db.js';
import { resolveConversation } from '../utils/conversationService.js';
import { sendMessage } from '../utils/messageRouter.js';

const router = express.Router();

router.post('/whatsapp', async (req, res) => {
  // 🔥 BUG FIX 3: Immediately tell Libromi "We got it!" to prevent retries/duplicates
  res.sendStatus(200);

  const client = await pool.connect();

  try {
    console.log("🔥 LIBROMI WEBHOOK HIT");
    
    let from = null;
    let text = null;
    let message_id = null;
    let timestamp = null;
    let recipientPhone = null; // 👈 NEW: We need to know which Centre received this

    const body = req.body;

    // ===============================
    // 🔥 FORMAT 1: META / WHATSAPP CLOUD STYLE
    // ===============================
    if (body.entry && Array.isArray(body.entry)) {
      const changes = body.entry[0]?.changes;
      if (changes && changes.length > 0) {
        const value = changes[0]?.value;
        
        // Extract the receiving WhatsApp number
        recipientPhone = value?.metadata?.display_phone_number; 

        const messages = value?.messages;
        if (messages && messages.length > 0) {
          const msg = messages[0];
          from = msg.from;
          text =
            msg.text?.body ||
            msg.button?.text ||
            msg.interactive?.button_reply?.title ||
            msg.interactive?.list_reply?.title;

          message_id = msg.id;
          timestamp = msg.timestamp;
        }
      }
    }
    // ===============================
    // 🔥 FORMAT 2: Flat structure
    // ===============================
    else if (body.from && body.text) {
      from = body.from;
      text = body.text;
      message_id = body.message_id || body.id;
      timestamp = body.timestamp;
    }
    // ===============================
    // 🔥 FORMAT 3: messages array
    // ===============================
    else if (body.messages && Array.isArray(body.messages)) {
      const msg = body.messages[0];
      from = msg.from;
      text =
        msg.text?.body ||
        msg.message ||
        msg.body ||
        msg.button?.text ||
        msg.interactive?.button_reply?.title;

      message_id = msg.id;
      timestamp = msg.timestamp;
    }
    // ===============================
    // 🔥 FORMAT 4: Alternative structure
    // ===============================
    else if (body.data) {
      const msg = body.data;
      from = msg.from || msg.phone || msg.sender;
      text = msg.text || msg.message || msg.body;
      message_id = msg.id;
      timestamp = msg.timestamp;
    }

    // ===============================
    // 🧹 NORMALIZE PHONE
    // ===============================
    if (from) {
      from = from.toString().replace(/\s+/g, '');
      if (!from.startsWith('+')) from = '+' + from;
    }

    // ===============================
    // ❌ VALIDATION (DO NOT BREAK WEBHOOK)
    // ===============================
    if (!from || !text) {
      // Don't log errors for read/delivery receipts, just silently exit
      return; 
    }

    await client.query('BEGIN');

    // 🔥 NEW: Find the Communication Account ID based on the receiving number
    let communicationAccountId = null;
    if (recipientPhone) {
        const formattedRecipient = recipientPhone.startsWith('+') ? recipientPhone : `+${recipientPhone}`;
        const accountQuery = await client.query(
            `SELECT id FROM communication_accounts WHERE phone_number = $1 OR phone_number = $2 LIMIT 1`,
            [formattedRecipient, recipientPhone]
        );
        if (accountQuery.rows.length > 0) {
            communicationAccountId = accountQuery.rows[0].id;
        }
    }

    // 🔥 NEW: Find the Customer ID based on their phone number
    const customerQuery = await client.query(
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
      customer_id: customerId, // 👈 Ensures the conversation is linked to the CRM Profile
      phone_number: from,
      communication_account_id: communicationAccountId, // 🔥 BUG FIX 1: Passes the exact routing account
      name: `WhatsApp - ${customerName}`,
      is_group: false,
    });

    // ===============================
    // 💾 SAVE MESSAGE
    // ===============================
    const savedMessage = await sendMessage({
      conversation_id: conversation.id,
      sender_id: customerId, // 👈 Associates the message with the actual CRM customer
      sender_type: 'customer',
      message: text,
      message_type: 'text',
      direction: 'incoming',
      io: req.app.get('io'), // 🔥 BUG FIX 2: Safely fetches the Socket instance
      external_message_id: message_id
    });

    await client.query('COMMIT');
    console.log(`✅ Message saved and routed from ${from}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ WhatsApp webhook processing error:', err);
  } finally {
    client.release();
  }
});

export default router;