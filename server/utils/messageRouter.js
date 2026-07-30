import pool from "../db.js";
import { addStaffToConversation } from './conversationService.js';
import { triggerNotification } from "./communication/notificationEngine.js";

/**
 * 🧮 Centralized Unread Count Calculator
 * Guarantees every part of the app uses the exact same unread logic.
 */
export async function getUnreadCount(staffId, conversationId) {
  const result = await pool.query(
    `
    SELECT COUNT(*) AS count
    FROM chat_messages m
    LEFT JOIN chat_message_reads r
      ON m.id = r.message_id
     AND r.staff_id = $1
    WHERE
      m.conversation_id = $2
      AND (
        m.sender_id IS NULL
        OR m.sender_id <> $1
      )
      AND r.id IS NULL
      AND m.is_deleted = false
    `,
    [staffId, conversationId]
  );

  return Number(result.rows[0].count) || 0;
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
  external_message_id = null,
  incoming_file_url = null, 
  incoming_file_name = null,
  mentions = null 
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let fileUrl = incoming_file_url || null; 
    let fileName = incoming_file_name || null; 
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
    if (mentions) {
       // Attach mentions to the payload before broadcasting
       completeMessage.mentions = typeof mentions === 'string' ? JSON.parse(mentions) : mentions;
    }

    if (io) {
      io.to(`conversation:${conversation_id}`).emit("new_message", completeMessage);
    }

    // ==========================================
    // 🌟 GLOBAL PUSH NOTIFICATION TO SIDEBARS 🌟
    // ==========================================
    try {
      const participantsRes = await pool.query(
        `SELECT staff_id FROM chat_participants WHERE conversation_id = $1 AND participant_type = 'staff'`,
        [conversation_id]
      );

      // Normalize ID to prevent strict equality (===) bugs in React
      const safeConvId = Number(conversation_id);

      for (const p of participantsRes.rows) {
        // 🔥 Use our centralized helper!
        const unreadCount = await getUnreadCount(p.staff_id, safeConvId);

        console.log(`📡 [Backend] Emit unread to user:${p.staff_id} | Conv: ${safeConvId} | Count: ${unreadCount}`);

        if (io) {
          io.to(`user:${p.staff_id}`).emit('unread_update', {
            conversationId: safeConvId,
            unread: unreadCount
          });

          io.to(`user:${p.staff_id}`).emit('conversation_updated', {
            conversationId: safeConvId,
            lastMessage: message || 'Attachment',
            lastMessageSenderId: sender_id,
            lastMessageSender: completeMessage?.sender_name || 'Customer',
            time: completeMessage.created_at,
            unread: unreadCount
          });
        }
      }
    } catch (pushErr) {
      console.error("❌ [Socket] Error pushing global notification:", pushErr);
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
 * 🚀 MANUAL TEMPLATE ROUTER
 * Takes the frontend request, routes it through the Notification Engine, and updates the UI.
 */
export async function sendManualWhatsAppTemplate({ conversationId, templateName, params = [], io }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const convRes = await client.query(`SELECT * FROM chat_conversations WHERE id = $1 AND channel = 'whatsapp'`, [conversationId]);
    if (!convRes.rows.length) throw new Error("WhatsApp conversation not found");
    const conversation = convRes.rows[0];

    // 🔴 1. Delegate the API heavy lifting to the Notification Engine!
    // templateName here is the abstract event key (e.g., 'reengagement_message') from the React frontend
    const result = await triggerNotification({
      eventKey: templateName,
      centreId: conversation.centre_id,
      customerPhone: conversation.phone_number,
      templateParams: params
    });

    if (!result.success) {
      // If the engine fails (e.g., template not mapped), throw the exact error back to the frontend UI
      throw new Error(result.error?.error || result.reason || "Failed to route template through Notification Engine");
    }

    // 🟢 2. If the engine succeeded, save the visual record to the chat database
    const savedMsg = await client.query(
      `INSERT INTO chat_messages
       (conversation_id, sender_type, sender_id, message, message_type, direction, created_at)
       VALUES ($1, 'system', NULL, $2, 'template', 'outgoing', NOW())
       RETURNING *`,
      [conversationId, `📨 Template sent: ${templateName}`]
    );

    await client.query("COMMIT");
    
    // 3. Emit the socket event so the bubble appears instantly for the staff
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