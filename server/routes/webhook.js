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
    // console.log("📩 RAW BODY:", JSON.stringify(body, null, 2)); // Uncomment if you need to deeply debug the payload

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
    
    // Aggressively hunt for how Libromi identified the receiver
    let incomingChannelId = body.channel_id || body.data?.channel_id || null;
    let fallbackRecipientPhone = recipientPhone || body.to || body.data?.to || null;

    let communicationAccountId = null;

    // First try: Match by exact channel_id (Most accurate for Libromi)
    if (incomingChannelId) {
        const accountQuery = await pool.query(
            `SELECT id FROM communication_accounts WHERE channel_id = $1 LIMIT 1`,
            [String(incomingChannelId)]
        );
        if (accountQuery.rows.length > 0) {
            communicationAccountId = accountQuery.rows[0].id;
        }
    }

    // Second try: Fallback to matching by the phone number
    if (!communicationAccountId && fallbackRecipientPhone) {
        const formattedRecipient = fallbackRecipientPhone.startsWith('+') ? fallbackRecipientPhone : `+${fallbackRecipientPhone}`;
        const accountQuery = await pool.query(
            `SELECT id FROM communication_accounts WHERE phone_number = $1 OR phone_number = $2 LIMIT 1`,
            [formattedRecipient, fallbackRecipientPhone]
        );
        if (accountQuery.rows.length > 0) {
            communicationAccountId = accountQuery.rows[0].id;
        }
    }

    // Find the customer who sent the message
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
      name: `WhatsApp - ${customerName}`,
      is_group: false,
    });

    // ===============================
    // 💾 SAVE MESSAGE & EMIT SOCKET
    // ===============================
    const io = req.app.get('io') || req.io;

    await sendMessage({
      conversation_id: conversation.id,
      sender_id: customerId, // Will associate with customer if they exist
      sender_type: 'customer',
      message: text,
      message_type: 'text',
      direction: 'incoming',
      io: io,
      external_message_id: message_id
    });

    console.log(`✅ Message safely routed and saved from ${from}: "${text.substring(0, 20)}..."`);

  } catch (err) {
    console.error('❌ WhatsApp webhook processing error:', err);
  }
});

export default router;