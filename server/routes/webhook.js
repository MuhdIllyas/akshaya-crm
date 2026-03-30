// routes/webhook.js
import express from 'express';
import pool from '../db.js';
import { resolveConversation } from '../utils/conversationService.js';
import { sendMessage } from '../utils/messageRouter.js';

const router = express.Router();

router.post('/whatsapp', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log("🔥 LIBROMI WEBHOOK HIT");
    console.log("📩 RAW BODY:", JSON.stringify(req.body, null, 2));

    let from = null;
    let text = null;
    let message_id = null;
    let timestamp = null;

    const body = req.body;

    // ===============================
    // 🔥 HANDLE MULTIPLE PAYLOAD FORMATS
    // ===============================

    // Format 1: Flat structure
    if (body.from && body.text) {
      from = body.from;
      text = body.text;
      message_id = body.message_id || body.id;
      timestamp = body.timestamp;
    }

    // Format 2: WhatsApp-like (messages array)
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

    // Format 3: Alternative structure
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

      if (!from.startsWith('+')) {
        from = '+' + from;
      }
    }

    // ===============================
    // ❌ VALIDATION
    // ===============================
    if (!from || !text) {
      console.log("⚠️ Invalid payload received:", body);
      return res.sendStatus(200); // Do not fail webhook
    }

    await client.query('BEGIN');

    // ===============================
    // 💬 RESOLVE CONVERSATION
    // ===============================
    const conversation = await resolveConversation({
      channel: 'whatsapp',
      context_type: 'customer',
      context_id: null,
      phone_number: from,
      centre_id: null,
      created_by: null,
      is_group: false,
    });

    // ===============================
    // 💾 SAVE MESSAGE
    // ===============================
    const savedMessage = await sendMessage({
      conversation_id: conversation.id,
      sender_id: null,
      sender_type: 'customer',
      message: text,
      message_type: 'text',
      direction: 'incoming',
      io: req.io,
      external_message_id: message_id,
      created_at: timestamp ? new Date(timestamp * 1000) : new Date(),
    });

    await client.query('COMMIT');

    // ===============================
    // 🔴 REAL-TIME SOCKET EMIT
    // ===============================
    if (req.io) {
      req.io.to(`conversation:${conversation.id}`).emit('new_message', savedMessage);
    }

    console.log(`✅ Message saved from ${from}`);

    res.sendStatus(200);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ WhatsApp webhook error:', err);
    res.sendStatus(500);
  } finally {
    client.release();
  }
});

export default router;
