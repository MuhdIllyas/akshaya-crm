import pool from "../db.js";
import axios from 'axios';
import { addStaffToConversation } from './conversationService.js';
import { isWithin24Hours } from './whatsappWindow.js'; 
import { triggerNotification } from "./communication/notificationEngine.js";

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
  incoming_file_name = null 
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
 * 🚀 MULTI-TENANT WHATSAPP SENDER (Native Media Support)
 */
async function handleWhatsAppSend({ conversation, message, fileUrl, fileName }) {
  const client = await pool.connect();
  try {
    const to = conversation.phone_number;
    if (!to) return;

    // 1. Check 24-Hour Customer Service Window
    const lastCustomerTime = await getLastCustomerMessageTime(conversation.id);
    const within24h = isWithin24Hours(lastCustomerTime);

    if (!within24h) {
      console.log(`Outside 24h window for ${to}, routing via Notification Engine.`);
      const customerName = conversation.name ? conversation.name.replace(/Chat with |WhatsApp /ig, '').trim() : 'Customer';
      
      await triggerNotification({
        eventKey: 'reengagement_message',
        centreId: conversation.centre_id,
        customerPhone: to,
        templateParams: [customerName]
      });
      return; 
    }

    // 2. Fetch Account Credentials
    let accountQuery;
    if (conversation.communication_account_id) {
      accountQuery = await client.query(`SELECT id, access_token, base_url, channel_id, name FROM communication_accounts WHERE id = $1 AND is_active = true`, [conversation.communication_account_id]);
    } else if (conversation.centre_id) {
      accountQuery = await client.query(`
        SELECT ca.id, ca.access_token, ca.base_url, ca.channel_id, ca.name 
        FROM communication_accounts ca 
        JOIN centres c ON c.communication_account_id = ca.id 
        WHERE c.id = $1 AND ca.is_active = true
      `, [conversation.centre_id]);
    }

    if (!accountQuery || accountQuery.rows.length === 0) return;
    
    const account = accountQuery.rows[0];
    const formattedPhone = to.startsWith('+91') ? to : `+91${to.replace(/^\+91/, '')}`;

    // 3. Construct Native Media Payload
    let payload = {
      to: formattedPhone,
      channel_id: account.channel_id,
    };

    if (fileUrl) {
      // ⚠️ IMPORTANT: Libromi requires a PUBLIC URL to download the file from your server.
      // Make sure VITE_API_URL or a dedicated BACKEND_URL environment variable is set to your staging/prod domain.
      const baseUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL || 'https://staging-api.akshayasahayi.com';
      
      // Prevent double slashes
      const safeBase = baseUrl.replace(/\/$/, '');
      const safePath = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
      const fullFileUrl = `${safeBase}${safePath}`;

      // Detect File Type
      const ext = fileName ? fileName.split('.').pop().toLowerCase() : '';
      
      if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        payload.type = 'image';
        payload.image = { link: fullFileUrl };
        if (message) payload.image.caption = message; // Add text as caption!
      } 
      else if (['mp4', '3gp'].includes(ext)) {
        payload.type = 'video';
        payload.video = { link: fullFileUrl };
        if (message) payload.video.caption = message;
      } 
      else if (['mp3', 'wav', 'ogg', 'aac'].includes(ext)) {
        payload.type = 'audio';
        payload.audio = { link: fullFileUrl };
        // Audio usually doesn't support captions in WhatsApp API
      } 
      else {
        payload.type = 'document';
        payload.document = { link: fullFileUrl, filename: fileName || 'Document' };
        if (message) payload.document.caption = message; 
      }
    } else {
      payload.type = 'text';
      payload.text = { body: message || "" };
    }

    // 4. Send to Libromi
    await axios.post(`${account.base_url}/messages`, payload, {
      headers: { Authorization: `Bearer ${account.access_token}`, 'Content-Type': 'application/json' }
    });

    console.log(`✅ WhatsApp ${payload.type} sent to ${formattedPhone} via Account: ${account.name}`);

  } catch (err) {
    console.error(`❌ Failed to send WhatsApp media:`, err.response?.data || err.message);
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