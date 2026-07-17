import express from "express";
import jwt from "jsonwebtoken";
import pool from "../../db.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import { resolveConversation, addParticipantsToConversation } from '../../utils/conversationService.js';
import { sendMessage, getUnreadCount } from '../../utils/messageRouter.js';
import notificationService from "../../utils/notificationService.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================================
   MULTER CONFIGURATION FOR FILE UPLOADS
================================ */

// Ensure upload directory exists
const uploadDir = "uploads/chat";
const fullUploadPath = path.join(__dirname, '..', '..', uploadDir);
if (!fs.existsSync(fullUploadPath)) {
  fs.mkdirSync(fullUploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, fullUploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|ppt|pptx/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype.split('/')[1]?.toLowerCase() || '');
    
    if (extname || mimetype) {
      return cb(null, true);
    }
    cb(new Error("File type not allowed. Allowed types: images, PDF, DOC, DOCX, XLS, XLSX, TXT, PPT"));
  },
});

/* ================================
   AUTH MIDDLEWARE
================================ */

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized - No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error("Token verification error:", err);
      return res.status(403).json({ error: "Invalid or expired token" });
    }

    req.user = user;
    next();
  });
};

/* ================================
   HELPER FUNCTIONS
================================ */

const checkConversationAccess = async (conversationId, userId) => {
  const result = await pool.query(
    `SELECT 1 FROM chat_participants 
     WHERE conversation_id = $1 AND staff_id = $2`,
    [conversationId, userId]
  );
  return result.rows.length > 0;
};

const canReplyToWhatsApp = async (conversationId, userId, userRole) => {
  if (userRole === 'admin' || userRole === 'superadmin') return true;
  
  const result = await pool.query(
    `SELECT assigned_staff_id FROM chat_conversations WHERE id = $1`,
    [conversationId]
  );
  
  return result.rows[0]?.assigned_staff_id === userId;
};

const getAvatarColor = (id) => {
  const colors = [
    "bg-navy-700",
    "bg-blue-600",
    "bg-pink-500",
    "bg-purple-600",
    "bg-orange-500",
    "bg-green-600",
    "bg-red-500",
    "bg-indigo-600",
  ];
  return colors[(id || 0) % colors.length];
};

const checkTableColumns = async () => {
  try {
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'chat_messages' 
      AND column_name IN ('file_name', 'file_size')
    `);
    return result.rows.map(row => row.column_name);
  } catch (err) {
    console.error("Error checking table columns:", err);
    return [];
  }
};

/* ================================
   GET CONVERSATIONS (Alias phone_number → context_identifier, name → context_name)
================================ */
router.get("/conversations", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const centreId = req.user.centre_id;
    const role = req.user.role;
    const { status = 'active' } = req.query;

    const idsRes = await pool.query(
      `SELECT conversation_id FROM chat_participants WHERE staff_id=$1`,
      [userId]
    );

    const ids = idsRes.rows.map(r => r.conversation_id);
    if (!ids.length) return res.json([]);

    const result = await pool.query(
      `
      SELECT 
        c.id,
        c.name,
        c.is_group,
        c.channel,
        c.context_type,
        c.context_id,
        c.phone_number AS context_identifier,
        c.name AS context_name,
        c.status,
        c.last_message_at,
        (
          SELECT m.message
          FROM chat_messages m
          WHERE m.conversation_id = c.id AND m.is_deleted = false
          ORDER BY m.created_at DESC LIMIT 1
        ) as last_message,
        (
          SELECT s.name
          FROM chat_messages m
          LEFT JOIN staff s ON m.sender_id = s.id
          WHERE m.conversation_id = c.id AND m.is_deleted = false
          ORDER BY m.created_at DESC LIMIT 1
        ) as last_message_sender,
        (
          SELECT m.sender_id
          FROM chat_messages m
          WHERE m.conversation_id = c.id AND m.is_deleted = false
          ORDER BY m.created_at DESC LIMIT 1
        ) as last_message_sender_id,
        (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'staff_id', p.staff_id,
                'name', s.name,
                'role', s.role
              )
            ),
            '[]'::json
          )
          FROM chat_participants p
          LEFT JOIN staff s ON p.staff_id = s.id
          WHERE p.conversation_id = c.id AND p.participant_type = 'staff'
        ) as participants
      FROM chat_conversations c
      INNER JOIN chat_participants p ON c.id = p.conversation_id
      WHERE p.staff_id = $1 
        AND c.status = $2
        ${role !== "superadmin" ? "AND c.centre_id = $3" : ""}
      ORDER BY c.last_message_at DESC NULLS LAST
      `,
      role !== "superadmin" ? [userId, status, centreId] : [userId, status]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching conversations:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ================================
   CREATE CONVERSATION 
================================ */

router.post("/conversation", authenticateToken, async (req, res) => {
  try {
    const {
      participants = [],
      conversationType = "internal",
      customerId,
      phoneNumber,
      context_type,
      context_id,
      channel,
      name,
      is_group = false,
      context_identifier,
      context_name
    } = req.body;

    const centreId = req.user.centre_id;
    const userId = req.user.id;

    let finalContextType = context_type;
    let finalCustomerId = customerId;
    let finalPhoneNumber = phoneNumber || context_identifier;
    let finalName = name || context_name;
    let participantIds = null;
    let finalIsGroup = is_group;
    let commAccountId = null; // 🔥 NEW: Variable to hold the tenant ID

    // Determine if this is a WhatsApp conversation
    const isWhatsApp = channel === 'whatsapp';

    if (isWhatsApp) {
      finalContextType = 'customer';
      const phone = finalPhoneNumber;
      if (!phone) {
        return res.status(400).json({ error: "Phone number is required for WhatsApp conversation" });
      }

      // 🔥 NEW: Fetch the specific Communication Account ID for this Centre
      const accountRes = await pool.query(
        `SELECT communication_account_id FROM centres WHERE id = $1`,
        [centreId]
      );
      commAccountId = accountRes.rows[0]?.communication_account_id;

      if (!commAccountId) {
        return res.status(400).json({ error: "No WhatsApp account is linked to your centre." });
      }

      // ⭐ Do NOT create a customer record. Just store the phone number and name in the conversation.
      finalCustomerId = null;          // No link to customers table
      finalPhoneNumber = phone;
      finalName = finalName || `WhatsApp ${phone}`;

      participantIds = [userId];
      finalIsGroup = false;
    } else {
      // Internal conversation
      const shouldBeGroup = is_group || (participants.length > 1) || (name && participants.length > 0);
      finalIsGroup = shouldBeGroup;
      
      if (!shouldBeGroup && participants.length === 1) {
        finalContextType = null;
        finalCustomerId = null;
        participantIds = [userId, participants[0]];
      } else if (shouldBeGroup && participants.length > 0) {
        participantIds = [userId, ...participants];
      }
    }

    // Call resolveConversation (this function will handle creation based on phone_number)
    const conversation = await resolveConversation({
      channel: isWhatsApp ? "whatsapp" : "internal",
      context_type: finalContextType,
      context_id: finalCustomerId,
      customer_id: finalCustomerId,
      phone_number: finalPhoneNumber,
      centre_id: centreId,
      created_by: userId,
      name: finalName,
      is_group: finalIsGroup,
      participant_ids: participantIds,
      communication_account_id: commAccountId // 🔥 PASSING THE TENANT ID HERE
    });

    // Add participants if needed (resolveConversation might have added them, but ensure)
    if (participantIds) {
      for (const staffId of participantIds) {
        await pool.query(
          `INSERT INTO chat_participants
          (conversation_id, staff_id, participant_type, role, joined_at)
          VALUES ($1, $2, 'staff', $3, NOW())
          ON CONFLICT (conversation_id, staff_id) DO NOTHING`,
          [conversation.id, staffId, staffId === userId ? 'owner' : 'member']
        );
      }
    }

    // Fetch the complete conversation with participants
    const fullConversation = await pool.query(
      `
      SELECT 
        c.id,
        c.name,
        c.is_group,
        c.channel,
        c.context_type,
        c.context_id,
        c.phone_number AS context_identifier,
        c.name AS context_name,
        c.status,
        c.last_message_at,
        (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'staff_id', p.staff_id,
                'name', s.name,
                'role', s.role,
                'joined_at', p.joined_at
              )
            ),
            '[]'::json
          )
          FROM chat_participants p
          JOIN staff s ON p.staff_id = s.id
          WHERE p.conversation_id = c.id
        ) as participants
      FROM chat_conversations c
      WHERE c.id = $1
      `,
      [conversation.id]
    );

    const result = fullConversation.rows[0] || conversation;
    
    // Emit new conversation via socket
    const io = req.io;
    if (io && result && result.participants) {
      for (const participant of result.participants) {
        io.to(`user:${participant.staff_id}`).emit("new_conversation", result);
      }
    }

    res.json(result);
  } catch (err) {
    console.error("Error creating conversation:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ================================
   GET MESSAGES
================================ */
router.get("/messages/:conversationId", authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    if (!conversationId || isNaN(parseInt(conversationId))) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }

    const hasAccess = await checkConversationAccess(conversationId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Not a participant in this conversation" });
    }

    const existingColumns = await checkTableColumns();
    const hasFileColumns = existingColumns.includes('file_name') && existingColumns.includes('file_size');

    let query;
    if (hasFileColumns) {
      query = `
        SELECT
          m.id,
          m.message as text,
          m.sender_id,
          m.sender_type,
          m.message_type as type,
          m.file_url,
          m.file_name,
          m.file_size,
          m.created_at,
          m.is_deleted,
          COALESCE(s.name, 'Unknown User') as sender_name,
          CASE 
            WHEN m.message_type = 'task' THEN (
              SELECT row_to_json(t) FROM tasks t WHERE t.id::text = m.message
            )
            ELSE NULL 
          END as live_task_data,
          (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'id', mn.id,
                  'mention_type', mn.mention_type,
                  'entity_id', mn.entity_id,
                  'display_text', mn.display_text,
                  'start_index', mn.start_index,
                  'end_index', mn.end_index
                )
              ), '[]'::json
            ) 
            FROM chat_mentions mn 
            WHERE mn.message_id = m.id
          ) as mentions,
          (
            SELECT COUNT(*)
            FROM chat_message_reads r
            WHERE r.message_id = m.id
          ) as read_count,
          EXISTS(
            SELECT 1
            FROM chat_message_reads r
            WHERE r.message_id = m.id AND r.staff_id = $2
          ) as is_read_by_me
        FROM chat_messages m
        LEFT JOIN staff s ON m.sender_id = s.id
        WHERE m.conversation_id = $1 AND m.is_deleted = false
        ORDER BY m.created_at ASC
      `;
    } else {
      query = `
        SELECT
          m.id,
          m.message as text,
          m.sender_id,
          m.sender_type,
          m.message_type as type,
          m.file_url,
          '' as file_name,
          0 as file_size,
          m.created_at,
          m.is_deleted,
          COALESCE(s.name, 'Unknown User') as sender_name,
          CASE 
            WHEN m.message_type = 'task' THEN (
              SELECT row_to_json(t) FROM tasks t WHERE t.id::text = m.message
            )
            ELSE NULL 
          END as live_task_data,
          (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'id', mn.id,
                  'mention_type', mn.mention_type,
                  'entity_id', mn.entity_id,
                  'display_text', mn.display_text,
                  'start_index', mn.start_index,
                  'end_index', mn.end_index
                )
              ), '[]'::json
            ) 
            FROM chat_mentions mn 
            WHERE mn.message_id = m.id
          ) as mentions,
          (
            SELECT COUNT(*)
            FROM chat_message_reads r
            WHERE r.message_id = m.id
          ) as read_count,
          EXISTS(
            SELECT 1
            FROM chat_message_reads r
            WHERE r.message_id = m.id AND r.staff_id = $2
          ) as is_read_by_me
        FROM chat_messages m
        LEFT JOIN staff s ON m.sender_id = s.id
        WHERE m.conversation_id = $1 AND m.is_deleted = false
        ORDER BY m.created_at ASC
      `;
    }

    const result = await pool.query(query, [conversationId, userId]);

    // Mark messages as read
    const unreadMessages = result.rows
      .filter(msg => msg.sender_id !== userId && !msg.is_read_by_me)
      .map(msg => msg.id);

    if (unreadMessages.length > 0) {
      const existingReads = await pool.query(
        `SELECT message_id FROM chat_message_reads 
         WHERE message_id = ANY($1::int[]) AND staff_id = $2`,
        [unreadMessages, userId]
      );
      
      const existingReadIds = existingReads.rows.map(row => row.message_id);
      const newUnreadMessages = unreadMessages.filter(id => !existingReadIds.includes(id));
      
      if (newUnreadMessages.length > 0) {
        const values = newUnreadMessages.map((_, index) => `($${index + 1}, $${newUnreadMessages.length + 1}, NOW())`).join(',');
        const allParams = [...newUnreadMessages, userId];
        
        await pool.query(
          `INSERT INTO chat_message_reads (message_id, staff_id, read_at) VALUES ${values}`,
          allParams
        );

        const io = req.io;
        if (io) {
          const messageSenders = await pool.query(
            `SELECT DISTINCT sender_id FROM chat_messages WHERE id = ANY($1::int[])`,
            [newUnreadMessages]
          );

          for (const row of messageSenders.rows) {
            if (row.sender_id !== userId) {
              io.to(`user:${row.sender_id}`).emit("messages_read", {
                conversationId: parseInt(conversationId),
                readerId: userId,
                messageIds: newUnreadMessages
              });
            }
          }

          const unreadCount = await pool.query(
            `SELECT COUNT(*) as count
             FROM chat_messages m
             LEFT JOIN chat_message_reads r ON m.id = r.message_id AND r.staff_id = $1
             WHERE m.conversation_id = $2 
               AND m.sender_id != $1
               AND r.id IS NULL
               AND m.is_deleted = false`,
            [userId, conversationId]
          );

          io.to(`user:${userId}`).emit("unread_update", {
            conversationId: parseInt(conversationId),
            unread: parseInt(unreadCount.rows[0].count)
          });
        }
      }
    }

    // Format the messages before sending to the frontend
    const formatted = result.rows.map(m => ({
      ...m,
      // Since we don't care about historical JSON data, we just pass the live data straight through.
      // If it's a regular message, live_task_data will naturally be null based on our SQL query.
      time: new Date(m.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      }),
      isCurrentUser: m.sender_id === userId,
      messageType: m.type,
      isFile: m.type !== "text"
      // Note: 'mentions' is automatically carried over via the spread operator (...m)
    }));
    
    res.json(formatted);

  } catch (err) {
    console.error("Fetch messages error:", err);
    res.status(500).json({ error: "Failed to fetch messages", details: err.message });
  }
});

/* ================================
   SEND MESSAGE (Smart Auto-Join)
================================ */

router.post("/message", authenticateToken, upload.single("file"), async (req, res) => {
  const client = await pool.connect(); // Use a dedicated client for transactions
  try {
    // 1. FIX: Added 'mentions' to the destructured body
    const { conversation_id, message, message_type, mentions } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    const userCentreId = req.user.centre_id;

    // 1. Get the conversation details to verify Centre ownership
    const convRes = await client.query(
      `SELECT centre_id, channel FROM chat_conversations WHERE id = $1`,
      [conversation_id]
    );

    if (convRes.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const conversation = convRes.rows[0];

    // 2. Security Check: Prevent staff from messaging other centres' customers
    if (userRole !== 'superadmin' && conversation.centre_id !== userCentreId) {
       return res.status(403).json({ error: "This conversation belongs to another centre." });
    }

    // 3. Participant Check & Auto-Join (The Magic Fix)
    if (userRole === 'staff') {
      const participantCheck = await client.query(
        `SELECT 1 FROM chat_participants WHERE conversation_id = $1 AND staff_id = $2`,
        [conversation_id, userId]
      );

      // If the staff member isn't in the DB yet, auto-enroll them so they can reply!
      if (participantCheck.rows.length === 0) {
        await client.query(
          `INSERT INTO chat_participants (conversation_id, staff_id, participant_type, role, joined_at)
           VALUES ($1, $2, 'staff', 'member', NOW())
           ON CONFLICT DO NOTHING`,
          [conversation_id, userId]
        );
      }
    }

    await client.query('BEGIN'); // 2. FIX: Start transaction to ensure safety

    // 4. Send the message to the central router
    const savedMessage = await sendMessage({
      conversation_id,
      sender_id: userId,
      sender_type: "staff",
      message,
      message_type,
      file: req.file,
      io: req.io,
      mentions
    });

    // 🔥 Fetch the sender's real name from the database
    const senderRes = await client.query(`SELECT name FROM staff WHERE id = $1`, [userId]);
    const senderName = senderRes.rows[0]?.name || 'A team member';

    // 5. 🔥 Insert Mentions safely
    if (mentions) {
      const parsedMentions = typeof mentions === 'string' ? JSON.parse(mentions) : mentions;
      
      for (const m of parsedMentions) {
        await client.query(
          `INSERT INTO chat_mentions (message_id, mention_type, entity_id, display_text, start_index, end_index)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [savedMessage.id, m.mention_type, m.entity_id, m.display_text, m.start_index, m.end_index]
        );
        
        // 6. Centralized Notification Engine
        if (m.mention_type === 'staff') {
          try {
            await notificationService.createBulkNotifications({
              recipientStaffIds: [m.entity_id], 
              senderStaffId: userId,            
              centreId: userCentreId,           
              relatedEntityType: 'message',
              relatedEntityId: savedMessage.id,
              conversationId: conversation_id,  
              
              type: 'mention',
              category: 'communications',
              title: '💬 New Mention',
              
              // 🔥 Use the database-fetched name instead of req.user.name
              message: `${senderName} mentioned you in a chat.`, 
              
              priority: 'high',
              metadata: {
                'Chat Room': conversation.name || 'Internal Chat'
              }
            });
          } catch (notifErr) {
            console.error("Non-fatal: Failed to trigger mention notification", notifErr);
          }
        }
      }
    }

    await client.query('COMMIT'); // Commit the transaction
    res.json(savedMessage);
  } catch (err) {
    await client.query('ROLLBACK'); // Rollback if anything fails
    console.error("Message send error:", err);
    res.status(500).json({ error: "Failed to send message" });
  } finally {
    client.release(); // Always release the client back to the pool
  }
});

/* ================================
   MARK MESSAGES READ
================================ */

router.post("/read", authenticateToken, async (req, res) => {
  try {
    const { message_ids } = req.body;
    const userId = req.user.id;

    if (!message_ids || !Array.isArray(message_ids) || message_ids.length === 0) {
      return res.status(400).json({ error: "Invalid message_ids" });
    }

    const existingReads = await pool.query(
      `SELECT message_id FROM chat_message_reads 
       WHERE message_id = ANY($1::int[]) AND staff_id = $2`,
      [message_ids, userId]
    );
    
    const existingReadIds = existingReads.rows.map(row => row.message_id);
    const newMessages = message_ids.filter(id => !existingReadIds.includes(id));
    
    if (newMessages.length > 0) {
      const values = newMessages.map((_, index) => `($${index + 1}, $${newMessages.length + 1}, NOW())`).join(',');
      const allParams = [...newMessages, userId];
      
      await pool.query(
        `INSERT INTO chat_message_reads (message_id, staff_id, read_at) VALUES ${values}`,
        allParams
      );

      const convInfo = await pool.query(
        `SELECT DISTINCT conversation_id FROM chat_messages WHERE id = ANY($1::int[])`,
        [newMessages]
      );

      if (convInfo.rows.length > 0) {
        const conversationId = convInfo.rows[0].conversation_id;

        const messageSenders = await pool.query(
          `SELECT DISTINCT sender_id FROM chat_messages WHERE id = ANY($1::int[])`,
          [newMessages]
        );

        const io = req.io;
        if (io) {
          for (const row of messageSenders.rows) {
            if (row.sender_id !== userId) {
              io.to(`user:${row.sender_id}`).emit("messages_read", {
                conversationId,
                readerId: userId,
                messageIds: newMessages
              });
            }
          }

          const unreadCount = await pool.query(
            `SELECT COUNT(*) as count
             FROM chat_messages m
             LEFT JOIN chat_message_reads r ON m.id = r.message_id AND r.staff_id = $1
             WHERE m.conversation_id = $2 
               AND m.sender_id != $1
               AND r.id IS NULL
               AND m.is_deleted = false`,
            [userId, conversationId]
          );

          io.to(`user:${userId}`).emit("unread_update", {
            conversationId,
            unread: parseInt(unreadCount.rows[0].count)
          });
        }
      }
    }

    res.json({ success: true, count: newMessages.length });
  } catch (err) {
    console.error("Read message error:", err);
    res.status(500).json({ error: "Failed to mark read", details: err.message });
  }
});

/* ================================
   TYPING INDICATOR
================================ */

router.post("/typing", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { conversation_id, isTyping } = req.body;
    const userId = req.user.id;

    if (!conversation_id) {
      return res.status(400).json({ error: "Conversation ID is required" });
    }

    const hasAccess = await checkConversationAccess(conversation_id, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Not a participant" });
    }

    const userInfo = await client.query(`SELECT name FROM staff WHERE id = $1`, [userId]);

    await client.query(
      `INSERT INTO chat_typing_status (conversation_id, staff_id, typing, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (conversation_id, staff_id) 
       DO UPDATE SET typing = $3, updated_at = NOW()`,
      [conversation_id, userId, isTyping]
    );

    const io = req.io;
    if (io) {
      io.to(`conversation:${conversation_id}`).emit("typing", {
        conversationId: parseInt(conversation_id),
        userId,
        userName: userInfo.rows[0]?.name || 'Unknown',
        isTyping
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Typing status error:", err);
    res.status(500).json({ error: "Failed to update typing status", details: err.message });
  } finally {
    client.release();
  }
});

/* ================================
   DELETE MESSAGE
================================ */

router.delete("/message/:messageId", authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await pool.query(
      `SELECT sender_id, file_url, conversation_id FROM chat_messages WHERE id = $1`,
      [messageId]
    );

    if (message.rows.length === 0) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.rows[0].sender_id !== userId) {
      return res.status(403).json({ error: "Can only delete your own messages" });
    }

    await pool.query(`UPDATE chat_messages SET is_deleted = true WHERE id = $1`, [messageId]);

    const fileUrl = message.rows[0].file_url;
    if (fileUrl) {
      const fileName = path.basename(fileUrl);
      const filePath = path.join(fullUploadPath, fileName);
      
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileErr) {
        console.error("Error deleting file:", fileErr);
      }
    }

    const io = req.io;
    if (io) {
      io.to(`conversation:${message.rows[0].conversation_id}`).emit("message_deleted", {
        messageId: parseInt(messageId),
        conversationId: message.rows[0].conversation_id,
        deletedBy: userId
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Delete message error:", err);
    res.status(500).json({ error: "Failed to delete message", details: err.message });
  }
});

/* ================================
   GET STAFF FOR NEW CHAT
================================ */

router.get("/staff", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const centreId = req.user.centre_id;

    let query;
    let params;

    if (userRole === "superadmin") {
      query = `
        SELECT 
          id,
          name,
          role,
          email,
          phone,
          centre_id,
          COALESCE(status, 'active') as status
        FROM staff
        WHERE id != $1
        ORDER BY name
      `;
      params = [userId];
    } else {
      query = `
        SELECT 
          id,
          name,
          role,
          email,
          phone,
          centre_id,
          COALESCE(status, 'active') as status
        FROM staff
        WHERE id != $1 
          AND centre_id = $2
        ORDER BY name
      `;
      params = [userId, centreId];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch staff error:", err);
    res.status(500).json({ error: "Failed to fetch staff", details: err.message });
  }
});

/* ================================
   ARCHIVE CONVERSATION
================================ */

router.patch("/conversation/:conversationId/archive", authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const role = req.user.role;
    
    if (role !== 'admin' && role !== 'superadmin') {
      return res.status(403).json({ error: "Only admins can archive conversations" });
    }
    
    await pool.query(
      `UPDATE chat_conversations SET status = 'archived', archived_at = NOW() WHERE id = $1`,
      [conversationId]
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================================
   GET ALL UNREAD COUNTS
================================ */

router.get("/unread/all", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT c.id as conversation_id, COUNT(m.id) as unread_count
      FROM chat_conversations c
      JOIN chat_participants p ON c.id = p.conversation_id
      JOIN chat_messages m ON c.id = m.conversation_id
        AND (m.sender_id IS NULL OR m.sender_id <> $1) -- 🔥 PERFECT LOGIC SYNC
        AND m.is_deleted = false
        AND NOT EXISTS (
          SELECT 1 FROM chat_message_reads r
          WHERE r.message_id = m.id AND r.staff_id = $1
        )
      WHERE p.staff_id = $1
      GROUP BY c.id
      `,
      [userId]
    );

    const unreadMap = {};
    result.rows.forEach(row => {
      unreadMap[row.conversation_id] = parseInt(row.unread_count);
    });

    res.json(unreadMap);
  } catch (err) {
    console.error("Fetch all unread error:", err);
    res.status(500).json({ error: "Failed to fetch unread counts", details: err.message });
  }
});

/* ================================
   GET CONVERSATION UNREAD COUNT
================================ */

router.get("/unread/:conversationId", authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // 🔥 Use the central helper!
    const unreadCount = await getUnreadCount(userId, conversationId);

    res.json({ unread: unreadCount });
  } catch (err) {
    console.error("Fetch unread error:", err);
    res.status(500).json({ error: "Failed to fetch unread count" });
  }
});

/* ================================
   DELETE ENTIRE CONVERSATION
================================ */

router.delete("/conversation/:conversationId", authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Security check: Only participants or admins can delete
    const hasAccess = await checkConversationAccess(conversationId, userId);
    if (!hasAccess && userRole !== 'superadmin' && userRole !== 'admin') {
      return res.status(403).json({ error: "Not authorized to delete this conversation" });
    }

    // 🔥 Soft Delete: Update status to 'deleted' so it vanishes from the GET /conversations query
    await pool.query(
      `UPDATE chat_conversations SET status = 'deleted', updated_at = NOW() WHERE id = $1`,
      [conversationId]
    );

    // Tell all connected staff participants to instantly remove it from their UI
    const io = req.io;
    if (io) {
       const participantsRes = await pool.query(
        `SELECT staff_id FROM chat_participants WHERE conversation_id = $1 AND participant_type = 'staff'`,
        [conversationId]
      );
      for (const p of participantsRes.rows) {
        io.to(`user:${p.staff_id}`).emit('conversation_deleted', { 
          conversationId: parseInt(conversationId) 
        });
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Delete conversation error:", err);
    res.status(500).json({ error: "Failed to delete conversation", details: err.message });
  }
});

/* ================================
   MENTIONS API (Search & Tracking)
================================ */

// Search staff for autocomplete
router.get("/mentions/search-staff", authenticateToken, async (req, res) => {
  console.log("Mention search called");
  console.log(req.query);

  try {
    const { q } = req.query;
    const { centre_id, role } = req.user; // Extract centre_id and role
    
    if (!q) return res.json([]);

    let queryStr = `SELECT id, name, role FROM staff WHERE name ILIKE $1 AND status = 'Active'`;
    const params = [`%${q}%`];

    // FIX: Restrict to the same centre unless the user is a superadmin
    if (role !== 'superadmin') {
      queryStr += ` AND centre_id = $2`;
      params.push(centre_id);
    }
    
    queryStr += ` LIMIT 5`;

    const result = await pool.query(queryStr, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fast lookup for Tracking ID OR Application Number
router.get("/mentions/tracking/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Removed isNaN check in case your app numbers have letters later (e.g. APP-10936)
    if (!id) return res.status(400).json({ error: 'Invalid ID' });

    const result = await pool.query(
      `SELECT
          st.id AS tracking_id,
          st.application_number,
          st.status,
          st.current_step,
          st.priority,
          st.average_time AS estimated_delivery,
          
          se.customer_name,
          srv.name AS service_name,
          sub.name AS subcategory_name,
          
          COALESCE(staff.name, st.assigned_to::text) AS assigned_to

      FROM service_tracking st
      
      -- Join directly to service_entries
      LEFT JOIN service_entries se 
          ON st.service_entry_id = se.id
          
      -- Grab the service and subcategory names directly from service_entries
      LEFT JOIN services srv 
          ON se.category_id = srv.id
      LEFT JOIN subcategories sub 
          ON se.subcategory_id = sub.id

      -- Grab the staff name
      LEFT JOIN staff 
          ON staff.id = st.assigned_to

      -- 🔥 CRITICAL FIX: Search both the primary key AND the application number
      WHERE st.id::text = $1 OR st.application_number = $1`, 
      [id]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tracking not found' });
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Tracking lookup error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;