// routes/webhook.js
import express from 'express';
import pool from '../db.js';
import { resolveConversation } from '../utils/conversationService.js';
import { sendMessage } from '../utils/messageRouter.js';

const router = express.Router();

router.post('/whatsapp', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log("Webhook payload:", JSON.stringify(req.body, null, 2));

    // 🔥 FIX: Extract from Libromi format
    const msg = req.body.messages?.[0];

    if (!msg) {
      return res.sendStatus(200);
    }

    const from = msg.from ? `+${msg.from}` : null;
    const text = msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title;
    const message_id = msg.id;
    const timestamp = msg.timestamp;

    if (!from || !text) {
      console.log("Invalid message format", { from, text });
      return res.sendStatus(200);
    }

    await client.query('BEGIN');

    const conversation = await resolveConversation({
      channel: 'whatsapp',
      context_type: 'customer',
      context_id: null,
      phone_number: from,
      centre_id: null,
      created_by: null,
      is_group: false,
    });

    const savedMessage = await sendMessage({
      conversation_id: conversation.id,
      sender_id: null,
      sender_type: 'customer',
      message: text,
      message_type: 'text',
      direction: 'incoming',
      io: req.io,
      external_message_id: message_id,
    });

    await client.query('COMMIT');

    if (req.io) {
      req.io.to(`conversation:${conversation.id}`).emit('new_message', savedMessage);
    }

    res.sendStatus(200);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('WhatsApp webhook error:', err);
    res.sendStatus(500);
  } finally {
    client.release();
  }
});

export default router;
