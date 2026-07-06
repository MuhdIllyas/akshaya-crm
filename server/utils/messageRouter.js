import pool from "../db.js";
import axios from 'axios';
import { addStaffToConversation } from './conversationService.js';
import { isWithin24Hours } from './whatsappWindow.js'; // Note: Adjusted import path if it's in the same folder

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
       3. ENSURE STAFF IS PARTICIPANT
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
      `UPDATE chat_conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`,
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
        `SELECT m.*, s.name as sender_name FROM chat_messages m LEFT JOIN staff s ON m.sender_id = s.id WHERE m.id = $1`,
        [savedMessage.id]
      );
      completeMessage = staffRes.rows[0];
    } else if (sender_type === 'customer') {
      const customerRes = await pool.query(
        `SELECT m.*, c.name as sender_name FROM chat_messages m LEFT JOIN customers c ON m.sender_id = c.id WHERE m.id = $1`,
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
       9. WHATSAPP SEND (Outgoing Only)
    ========================= */
    if (conversation.channel === "whatsapp" && finalDirection === "outgoing") {
      // Fire and forget, no await
      handleWhatsAppSend({ conversation, message, fileUrl, fileName }).catch(err => console.error("WhatsApp send error:", err));
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
 * 🚀 MULTI-TENANT WHATSAPP SENDER
 * Dynamically fetches credentials for this specific conversation.
 */
async function handleWhatsAppSend({ conversation, message, fileUrl, fileName }) {
  const client = await pool.connect();
  try {
    const to = conversation.phone_number;
    if (!to) {
      console.error('No phone number for WhatsApp conversation');
      return;
    }

    // 1. Fetch the correct Communication Account (NOW INCLUDES channel_id)
    let accountQuery;
    if (conversation.communication_account_id) {
      accountQuery = await client.query(`SELECT access_token, base_url, channel_id, name FROM communication_accounts WHERE id = $1 AND is_active = true`, [conversation.communication_account_id]);
    } else if (conversation.centre_id) {
      accountQuery = await client.query(`
        SELECT ca.access_token, ca.base_url, ca.channel_id, ca.name 
        FROM communication_accounts ca 
        JOIN centres c ON c.communication_account_id = ca.id 
        WHERE c.id = $1 AND ca.is_active = true
      `, [conversation.centre_id]);
    }

    if (!accountQuery || accountQuery.rows.length === 0) {
      console.warn(`[Message Router] No active WhatsApp account found for Conversation ${conversation.id}.`);
      return;
    }

    const account = accountQuery.rows[0];
    const formattedPhone = to.startsWith('+91') ? to : `+91${to.replace(/^\+91/, '')}`;

    // 2. Check 24-Hour Customer Service Window
    const lastCustomerTime = await getLastCustomerMessageTime(conversation.id);
    const within24h = isWithin24Hours(lastCustomerTime);

    let payload;

    if (!within24h) {
      // OUTSIDE 24H WINDOW: Force a Re-engagement Template
      console.log(`Outside 24h window for ${formattedPhone}, sending template instead.`);
      const customerName = conversation.name ? conversation.name.replace('Chat with ', '') : 'Customer';
      
      const tplQuery = await client.query(`SELECT provider_template_name FROM communication_template_mappings WHERE communication_account_id = $1 AND event_key = 'reengagement_message'`, [account.id]);
      const templateName = tplQuery.rows.length > 0 ? tplQuery.rows[0].provider_template_name : "reengagement_message";

      payload = {
        to: formattedPhone,
        channel_id: account.channel_id, // 👈 THE MAGIC ROUTING KEY
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en', policy: 'deterministic' },
          components: [
            { type: 'header' }, // Ensure uniform structure
            { type: 'body', parameters: [{ type: 'text', text: customerName }] }
          ]
        }
      };
    } else {
      // WITHIN 24H WINDOW: Send standard free-form text or files
      let textBody = message || "";
      if (fileUrl) {
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
        const fullFileUrl = `${baseUrl}${fileUrl}`;
        textBody = `📎 ${fileName || 'File'} shared: ${fullFileUrl}\n\n${message || ''}`;
      }

      payload = {
        to: formattedPhone,
        channel_id: account.channel_id, // 👈 THE MAGIC ROUTING KEY
        type: 'text',
        text: { body: textBody }
      };
    }

    // 3. Dispatch the dynamic request
    await axios.post(`${account.base_url}/messages`, payload, {
      headers: { Authorization: `Bearer ${account.access_token}`, 'Content-Type': 'application/json' }
    });

    console.log(`✅ WhatsApp outgoing sent to ${formattedPhone} via Account: ${account.name}`);

  } catch (err) {
    console.error('❌ Failed to send WhatsApp reply:', err.response?.data || err.message);
  } finally {
    client.release();
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

    const convRes = await client.query(`SELECT * FROM chat_conversations WHERE id = $1 AND channel = 'whatsapp'`, [conversationId]);
    if (!convRes.rows.length) throw new Error("WhatsApp conversation not found");
    const conversation = convRes.rows[0];

    const to = conversation.phone_number;
    if (!to) throw new Error("No phone number for this conversation");

    let accountQuery;
    if (conversation.communication_account_id) {
      accountQuery = await client.query(`SELECT access_token, base_url, channel_id FROM communication_accounts WHERE id = $1 AND is_active = true`, [conversation.communication_account_id]);
    } else {
      accountQuery = await client.query(`
        SELECT ca.access_token, ca.base_url, ca.channel_id 
        FROM communication_accounts ca 
        JOIN centres c ON c.communication_account_id = ca.id 
        WHERE c.id = $1 AND ca.is_active = true
      `, [conversation.centre_id]);
    }

    if (!accountQuery.rows.length) throw new Error("No active WhatsApp account mapped to this conversation.");
    const account = accountQuery.rows[0];
    const formattedPhone = to.startsWith('+91') ? to : `+91${to.replace(/^\+91/, '')}`;

    const payload = {
      to: formattedPhone,
      channel_id: account.channel_id, // 👈 THE MAGIC ROUTING KEY
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en', policy: 'deterministic' },
        components: [
          { type: 'header' },
          {
            type: 'body',
            parameters: params.map(p => ({ type: 'text', text: String(p || '-') }))
          }
        ]
      }
    };

    await axios.post(`${account.base_url}/messages`, payload, {
      headers: { Authorization: `Bearer ${account.access_token}`, 'Content-Type': 'application/json' }
    });

    const savedMsg = await client.query(
      `INSERT INTO chat_messages
       (conversation_id, sender_type, sender_id, message, message_type, direction, created_at)
       VALUES ($1, 'system', NULL, $2, 'template', 'outgoing', NOW())
       RETURNING *`,
      [conversationId, `📨 Template sent: ${templateName}`]
    );

    await client.query("COMMIT");
    if (io) io.to(`conversation:${conversationId}`).emit("new_message", savedMsg.rows[0]);
    return { success: true, messageId: savedMsg.rows[0].id };

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Manual template send error:", err.message);
    throw err;
  } finally {
    client.release();
  }
}