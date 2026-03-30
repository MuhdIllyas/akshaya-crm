// routes/webhook.js
import express from 'express';
import pool from '../db.js';
import { resolveConversation } from '../utils/conversationService.js';
import { sendMessage } from '../utils/messageRouter.js';

const router = express.Router();

router.post('/whatsapp', async (req, res) => {
  try {
    console.log("🔥 LIBROMI WEBHOOK HIT");
    console.log("BODY:", JSON.stringify(req.body, null, 2));

    const msg = req.body;

    // ⚠️ Adjust after seeing actual payload
    const from = msg.from || msg.phone || msg.sender;
    const text = msg.text || msg.message || msg.body;

    if (!from || !text) {
      return res.sendStatus(200);
    }

    // Save to DB
    // (your existing logic here)

    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

export default router;
