// Customer portal chat (channel "portal"), shown to staff in Messenger.
//
//   GET  /api/customer/chat/conversations                list this customer's chats
//   POST /api/customer/chat/conversations                { centre_id } chat with a centre
//                                                        { booking_id } chat with the staff
//                                                          member handling a booking
//   GET  /api/customer/chat/conversations/:id/messages   ?after=<message id> for new ones
//   POST /api/customer/chat/conversations/:id/messages   { text }
//
// A centre chat goes to that centre's admin (and anyone they bring in); a
// booking chat goes to the assigned staff member and the centre admin only.
// Customers don't get live socket updates yet, so the portal asks for new
// messages every few seconds.

import express from "express";
import pool from "../db.js";
import { customerAuthMiddleware } from "../middlewares/customerAuthMiddleware.js";
import Communication from "../services/communication/communicationEngine.js";
import { addStaffToConversation } from "../utils/conversationService.js";

const router = express.Router();
router.use(customerAuthMiddleware);

const MAX_LENGTH = 2000;

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    if (!err.status) console.error("[customer-chat]", err);
    res.status(err.status || 500).json({ message: err.status ? err.message : "Something went wrong. Please try again." });
  });
const bad = (message, status = 400) => Object.assign(new Error(message), { status });

const LIST_SQL = `
  SELECT c.id, c.channel, c.context_type, c.context_id, c.centre_id, c.last_message_at,
         ce.name AS centre_name,
         cs.application_number, sv.name AS service_name,
         st.id AS staff_id, st.name AS staff_name,
         (SELECT m.message FROM chat_messages m WHERE m.conversation_id = c.id AND m.is_deleted = false
           ORDER BY m.created_at DESC LIMIT 1) AS last_message,
         (SELECT m.sender_type FROM chat_messages m WHERE m.conversation_id = c.id AND m.is_deleted = false
           ORDER BY m.created_at DESC LIMIT 1) AS last_sender_type
    FROM chat_conversations c
    LEFT JOIN centres ce ON ce.id = c.centre_id
    LEFT JOIN customer_services cs ON c.context_type = 'customer_service' AND cs.id = c.context_id
    LEFT JOIN services sv ON sv.id = cs.service_id
    LEFT JOIN staff st ON st.id = cs.assigned_staff_id
   WHERE c.channel = 'portal' AND c.customer_id = $1 AND c.status <> 'deleted'`;

async function ownConversation(customerId, id) {
  const { rows } = await pool.query(
    `${LIST_SQL} AND c.id = $2`,
    [customerId, Number(id)]
  );
  if (!rows[0]) throw bad("Conversation not found", 404);
  return rows[0];
}

router.get(
  "/conversations",
  wrap(async (req, res) => {
    const { rows } = await pool.query(`${LIST_SQL} ORDER BY c.last_message_at DESC NULLS LAST, c.id DESC`, [req.customer.id]);
    res.json(rows);
  })
);

// Find or start the customer's chat with a centre, or about one booking.
router.post(
  "/conversations",
  wrap(async (req, res) => {
    const customerId = req.customer.id;
    const bookingId = Number(req.body?.booking_id) || null;
    let centreId = Number(req.body?.centre_id) || null;
    let contextType = "customer";
    let contextId = null;
    let staffId = null;
    let name;

    if (bookingId) {
      const { rows } = await pool.query(
        `SELECT cs.id, cs.assigned_staff_id, cs.application_number,
                COALESCE(cs.handling_centre_id, st.centre_id, cs.requested_centre_id) AS centre_id,
                sv.name AS service_name, st.name AS staff_name
           FROM customer_services cs
           LEFT JOIN staff st ON st.id = cs.assigned_staff_id
           LEFT JOIN services sv ON sv.id = cs.service_id
          WHERE cs.id = $1 AND cs.customer_id = $2`,
        [bookingId, customerId]
      );
      const booking = rows[0];
      if (!booking) throw bad("Application not found", 404);
      if (!booking.assigned_staff_id) throw bad("No one has taken this application yet. Chat with the centre instead.");
      centreId = booking.centre_id;
      contextType = "customer_service";
      contextId = booking.id;
      staffId = booking.assigned_staff_id;
      name = `${req.customer.name} — ${booking.service_name || "Application"} (${booking.application_number || `#${booking.id}`})`;
    } else {
      if (!centreId) throw bad("Choose a centre");
      const { rows } = await pool.query(`SELECT id FROM centres WHERE id = $1`, [centreId]);
      if (!rows[0]) throw bad("Centre not found", 404);
      name = `${req.customer.name} (portal)`;
    }

    // One chat per customer + centre, or per booking.
    const client = await pool.connect();
    let conversationId;
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`portal:${customerId}:${contextType}:${contextId || centreId}`]);
      const existing = await client.query(
        `SELECT id, status FROM chat_conversations
          WHERE channel = 'portal' AND customer_id = $1 AND context_type = $2
            AND ${contextId ? "context_id = $3" : "centre_id = $3"} AND status <> 'deleted'
          ORDER BY id LIMIT 1`,
        [customerId, contextType, contextId || centreId]
      );
      if (existing.rows[0]) {
        conversationId = existing.rows[0].id;
        if (existing.rows[0].status === "archived") {
          await client.query(`UPDATE chat_conversations SET status = 'active', archived_at = NULL WHERE id = $1`, [conversationId]);
        }
      } else {
        const created = await client.query(
          `INSERT INTO chat_conversations
             (name, is_group, channel, context_type, context_id, centre_id, customer_id, assigned_staff_id, status, created_at)
           VALUES ($1, false, 'portal', $2, $3, $4, $5, $6, 'active', NOW())
           RETURNING id`,
          [name, contextType, contextId, centreId, customerId, staffId]
        );
        conversationId = created.rows[0].id;
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    // Who sees it (besides the customer, by customer_id): the booking's staff
    // member and the centre admin.
    if (staffId) await addStaffToConversation(conversationId, staffId, "owner");
    const { rows: admin } = await pool.query(`SELECT admin_id FROM centres WHERE id = $1`, [centreId]);
    if (admin[0]?.admin_id) await addStaffToConversation(conversationId, admin[0].admin_id, "reviewer");

    res.status(201).json(await ownConversation(customerId, conversationId));
  })
);

router.get(
  "/conversations/:id/messages",
  wrap(async (req, res) => {
    const conversation = await ownConversation(req.customer.id, req.params.id);
    const after = Number(req.query.after) || 0;
    const { rows } = await pool.query(
      `SELECT m.id, m.message AS text, m.sender_type, m.message_type AS type, m.file_url, m.file_name, m.created_at,
              (m.sender_type = 'customer' AND m.sender_id = $2) AS is_mine,
              CASE WHEN m.sender_type = 'staff' THEN s.name
                   WHEN m.sender_type = 'customer' THEN cu.name
                   ELSE 'System' END AS sender_name
         FROM chat_messages m
         LEFT JOIN staff s ON m.sender_type = 'staff' AND s.id = m.sender_id
         LEFT JOIN customers cu ON m.sender_type = 'customer' AND cu.id = m.sender_id
        WHERE m.conversation_id = $1 AND m.is_deleted = false AND m.id > $3
          AND m.message_type IN ('text', 'image', 'file', 'document')
        ORDER BY m.id ASC
        LIMIT 200`,
      [conversation.id, req.customer.id, after]
    );
    res.json({ conversation, messages: rows });
  })
);

router.post(
  "/conversations/:id/messages",
  wrap(async (req, res) => {
    const conversation = await ownConversation(req.customer.id, req.params.id);
    const text = String(req.body?.text || "").trim();
    if (!text) throw bad("Type a message");
    if (text.length > MAX_LENGTH) throw bad(`Keep messages under ${MAX_LENGTH} characters`);

    const result = await Communication.send({
      channel: "portal",
      conversation_id: conversation.id,
      sender: { type: "customer", id: req.customer.id },
      message: { text, type: "text" },
      io: req.io,
    });
    const m = result.message;
    res.status(201).json({
      id: m.id,
      text: m.message,
      sender_type: "customer",
      type: m.message_type,
      created_at: m.created_at,
      is_mine: true,
      sender_name: req.customer.name,
    });
  })
);

export default router;
