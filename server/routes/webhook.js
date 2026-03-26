// routes/webhook.js
import express from 'express';
import pool from '../db.js';
import { resolveConversation } from '../utils/conversationService.js';
import { sendMessage } from '../utils/messageRouter.js';

const router = express.Router();

router.post('/whatsapp', async (req, res) => {
  const client = await pool.connect();
  try {
    const { from, text, timestamp, message_id } = req.body;

    if (!from || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await client.query('BEGIN');

    // Resolve conversation using phone number only (no customer record)
    const conversation = await resolveConversation({
      channel: 'whatsapp',
      context_type: 'customer',
      context_id: null,          // No customer ID
      phone_number: from,
      centre_id: null,           // Can be assigned later
      created_by: null,          // System message
      is_group: false,
    });

    // Save incoming message
    const savedMessage = await sendMessage({
      conversation_id: conversation.id,
      sender_id: null,           // No staff ID for customer
      sender_type: 'customer',
      message: text,
      message_type: 'text',
      direction: 'incoming',
      io: req.io,
      external_message_id: message_id,
    });

    await client.query('COMMIT');

    // Emit socket event to staff (those in the conversation room)
    if (req.io) {
      req.io.to(`conversation:${conversation.id}`).emit('new_message', savedMessage);
    }

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('WhatsApp webhook error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

export default router;