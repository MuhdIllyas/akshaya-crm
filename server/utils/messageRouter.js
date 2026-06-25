// messageRouter.js
import pool from "../db.js";
import axios from 'axios';
import { addStaffToConversation } from './conversationService.js';
import { isWithin24Hours } from '../utils/whatsappWindow.js';
import { sendWhatsAppText, sendWhatsAppTemplate } from './whatsapp.js';

/**
 * Helper: Get last customer message time for a conversation
 */
async function getLastCustomerMessageTime(conversationId) {
  const result = await pool.query(
    `SELECT created_at FROM chat_messages
     WHERE conversation_id = $1 AND sender_type = 'customer'
     ORDER BY created_at DESC LIMIT 1`,
    [conversationId]
  );
  return result.rows[0]?.created_at || null;
}

/**
 * Central Message Router
 */
export async function sendMessage({
  conversation_id,
  sender_id,
  sender_type = "staff",
  message = "",
  message_type = "text",
  file = null,
  io = null,
  direction = null,
  external_message_id = null
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* =========================
       1. FILE HANDLING
    ========================= */
    let fileUrl = null;
    let fileName = null;
    let fileSize = null;

    if (file) {
      fileUrl = `/uploads/chat/${file.filename}`;
      fileName = file.originalname;
      fileSize = file.size;
    }

    /* =========================
       2. GET CONVERSATION
    ========================= */
    const convRes = await client.query(
      `SELECT * FROM chat_conversations WHERE id = $1`,
      [conversation_id]
    );

    if (!convRes.rows.length) {
      throw new Error("Conversation not found");
    }

    const conversation = convRes.rows[0];

    /* =========================
       3. ENSURE STAFF IS PARTICIPANT (if needed)
    ========================= */
    if (sender_type === 'staff' && sender_id) {
      const isParticipant = await client.query(
        `SELECT 1 FROM chat_participants WHERE conversation_id = $1 AND staff_id = $2`,
        [conversation_id, sender_id]
      );
      if (isParticipant.rows.length === 0) {
        await addStaffToConversation(conversation_id, sender_id);
      }
    }

    /* =========================
       4. DETERMINE FINAL DIRECTION
    ========================= */
    const finalDirection = direction || (conversation.channel === "whatsapp" ? "outgoing" : "internal");

    /* =========================
       5. INSERT MESSAGE
    ========================= */
    const msgRes = await client.query(
      `
      INSERT INTO chat_messages
      (conversation_id, sender_type, sender_id, message, message_type, file_url, file_name, file_size, direction, external_message_id, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
      RETURNING *
      `,
      [
        conversation_id,
        sender_type,
        sender_id,
        message,
        message_type,
        fileUrl,
        fileName,
        fileSize,
        finalDirection,
        external_message_id || null
      ]
    );

    const savedMessage = msgRes.rows[0];

    /* =========================
       6. UPDATE CONVERSATION
    ========================= */
    await client.query(
      `
      UPDATE chat_conversations
      SET last_message_at = NOW(), updated_at = NOW()
      WHERE id = $1
      `,
      [conversation_id]
    );

    /* =========================
       7. CREATE ACTIVITY
    ========================= */
    await client.query(
      `
      INSERT INTO activities
      (centre_id, related_type, related_id, action, description, performed_by, performed_by_role, created_at)
      VALUES ($1,'conversation',$2,'message_sent',$3,$4,'staff',NOW())
      `,
      [
        conversation.centre_id,
        conversation_id,
        message || "File sent",
        sender_id
      ]
    );

    await client.query("COMMIT");

    // Fetch the complete message with sender name for socket emission
    let completeMessage;
    if (sender_type === 'staff') {
      const staffRes = await pool.query(
        `SELECT m.*, s.name as sender_name
         FROM chat_messages m
         LEFT JOIN staff s ON m.sender_id = s.id
         WHERE m.id = $1`,
        [savedMessage.id]
      );
      completeMessage = staffRes.rows[0];
    } else if (sender_type === 'customer') {
      const customerRes = await pool.query(
        `SELECT m.*, c.name as sender_name
         FROM chat_messages m
         LEFT JOIN customers c ON m.sender_id = c.id
         WHERE m.id = $1`,
        [savedMessage.id]
      );
      completeMessage = customerRes.rows[0];
    } else {
      completeMessage = savedMessage;
    }

    /* =========================
       8. SOCKET EMIT
    ========================= */
    if (io) {
      io.to(`conversation:${conversation_id}`).emit("new_message", completeMessage);
    }

    /* =========================
       9. WHATSAPP SEND (only for outgoing)
    ========================= */
    if (conversation.channel === "whatsapp" && finalDirection === "outgoing") {
      // Don't wait for this; fire and forget
      handleWhatsAppSend({
        conversation,
        message,
        fileUrl,
        fileName
      }).catch(err => console.error("WhatsApp send error:", err));
    }

    return completeMessage;

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Send message error:", err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Send outgoing WhatsApp message with automatic 24‑hour window detection & fallback to template
 */
async function handleWhatsAppSend({ conversation, message, fileUrl, fileName }) {
  const to = conversation.phone_number;
  if (!to) {
    console.error('No phone number for WhatsApp conversation');
    return;
  }

  // Get last customer message time
  const lastCustomerTime = await getLastCustomerMessageTime(conversation.id);
  const within24h = isWithin24Hours(lastCustomerTime);

  try {
    if (!within24h) {
      // Outside 24h window – send a re‑engagement template
      console.log(`Outside 24h window for ${to}, sending template instead.`);
      const customerName = conversation.context_name || 'Customer';
      await sendWhatsAppTemplate({
        to,
        templateName: "reengagement_message",
        params: [customerName]
      });
    } else {
      // Within 24h – send normal text (or file note)
      if (fileUrl) {
        const baseUrl = process.env.APP_URL || 'http://localhost:5000';
        const fullFileUrl = `${baseUrl}${fileUrl}`;
        await sendWhatsAppText({
          to,
          message: `📎 ${fileName || 'File'} shared: ${fullFileUrl}\n\n${message || ''}`
        });
      } else {
        await sendWhatsAppText({ to, message });
      }
    }
  } catch (err) {
    console.error('Failed to send WhatsApp message:', err.response?.data || err.message);
    // Smart fallback: if normal message fails because of 24‑hour rule, retry with template
    if (within24h && err.response?.data?.error?.includes("24 hours")) {
      console.log("Normal message rejected due to 24h rule, retrying with template...");
      const customerName = conversation.context_name || 'Customer';
      await sendWhatsAppTemplate({
        to,
        templateName: "reengagement_template",
        params: [customerName]
      });
    }
  }
}

/**
 * Send a system message (e.g., task assigned, document uploaded)
 */
export async function sendSystemMessage(conversationId, message, io, taskId = null) {
  const result = await pool.query(
    `INSERT INTO chat_messages
     (conversation_id, sender_type, sender_id, message, message_type, direction, file_name, created_at)
     VALUES ($1, 'system', NULL, $2, 'system', 'internal', $3, NOW())
     RETURNING *`,
    [conversationId, message, taskId ? String(taskId) : null]
  );
  const systemMsg = result.rows[0];
  if (io) {
    io.to(`conversation:${conversationId}`).emit('new_message', systemMsg);
  }
  return systemMsg;
}

/**
 * Manually send a WhatsApp template (used by API route)
 */
export async function sendManualWhatsAppTemplate({ conversationId, templateName, params = [], io }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Fetch conversation
    const convRes = await client.query(
      `SELECT * FROM chat_conversations WHERE id = $1 AND channel = 'whatsapp'`,
      [conversationId]
    );
    if (!convRes.rows.length) throw new Error("WhatsApp conversation not found");
    const conversation = convRes.rows[0];

    const to = conversation.phone_number;
    if (!to) throw new Error("No phone number for this conversation");

    // Send the template via our utility
    await sendWhatsAppTemplate({ to, templateName, params });

    // Save a system message to the conversation (for history)
    const savedMsg = await client.query(
      `INSERT INTO chat_messages
       (conversation_id, sender_type, sender_id, message, message_type, direction, created_at)
       VALUES ($1, 'system', NULL, $2, 'template', 'outgoing', NOW())
       RETURNING *`,
      [conversationId, `📨 Template sent: ${templateName}`]
    );

    await client.query("COMMIT");

    if (io) {
      io.to(`conversation:${conversationId}`).emit("new_message", savedMsg.rows[0]);
    }

    return { success: true, messageId: savedMsg.rows[0].id };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Manual template send error:", err);
    throw err;
  } finally {
    client.release();
  }
}
