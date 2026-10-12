// services/taskService.js
// Single place that creates a task. Used by:
//   - POST /tasks/add          (actor = logged-in staff)
//   - scheduledActionWorker    (actor = SYSTEM_ACTOR)
//   - later: bulk service entry (inside its own transaction)

import pool from "../db.js";
import { io } from "../server.js";
import { logActivity } from "../utils/activityLogger.js";
import { resolveConversation, addStaffToConversation } from "../utils/conversationService.js";
import { getUnreadCount } from "../utils/messageRouter.js";
import notificationService from "../utils/notificationService.js";
import { notificationTemplates } from "../utils/notificationTemplates.js";

export const SYSTEM_ACTOR = Object.freeze({ id: null, role: "system", centre_id: null });

const ALLOWED_ROLES = ["admin", "superadmin", "staff", "system"];

const toId = (v) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};

/**
 * Create a one-time task.
 *
 * @param {object} input
 * @param {object} input.actor            req.user or SYSTEM_ACTOR
 * @param {string} input.title
 * @param {number} [input.centre_id]      only needed for system tasks without assignee centre
 * @param {object} [externalClient]       pass a pg client to run inside YOUR transaction.
 *                                        You must then COMMIT and call runSideEffects() yourself.
 * @returns {{ task, conversation, runSideEffects: Function|null }}
 */
export async function createTask(input, externalClient = null) {
  const {
    actor,
    title,
    description = null,
    assigned_to,
    due_date = null,
    priority = "medium",
    status = "pending",
    related_service_id = null,
    related_service_entry_id = null,
    related_customer_id = null,
    note_id = null,
    source = "manual",
    scheduled_action_id = null,
  } = input;

  if (!actor || !actor.role) throw new Error("actor required");
  if (!ALLOWED_ROLES.includes(actor.role)) throw new Error("Permission denied");
  if (!title || !String(title).trim()) throw new Error("Title required");

  const isSystem = actor.role === "system";
  const assignedTo = toId(assigned_to);
  const ownTx = !externalClient;
  const client = externalClient || (await pool.connect());

  let task;
  let conversation;
  let savedMsg;
  let centreId;
  let assignedStaffName = "Unassigned";

  try {
    if (ownTx) await client.query("BEGIN");

    /* ---------- 1. Resolve centre + validate assignee ---------- */
    centreId = isSystem ? toId(input.centre_id) : toId(actor.centre_id);

    if (assignedTo) {
      const staffRes = await client.query(
        `SELECT name, centre_id FROM staff WHERE id = $1`,
        [assignedTo]
      );
      if (!staffRes.rows.length) throw new Error("Assigned staff not found");

      assignedStaffName = staffRes.rows[0].name;
      const staffCentreId = staffRes.rows[0].centre_id;

      if (actor.role === "superadmin" || (isSystem && !centreId)) {
        centreId = staffCentreId;
      } else if (staffCentreId !== centreId) {
        throw new Error("Staff must belong to the same centre");
      }
    } else if (actor.role === "superadmin" || isSystem) {
      throw new Error("assigned_to required");
    }

    if (!centreId) throw new Error("Could not resolve centre for task");

    /* ---------- 2. Resolve conversation ---------- */
    // System has no staff id, so the assignee "owns" the chat
    const ownerId = isSystem ? assignedTo : toId(actor.id);

    const convInput = { channel: "internal", created_by: ownerId };

    if (related_service_entry_id) {
      Object.assign(convInput, {
        context_type: "service_entry",
        context_id: related_service_entry_id,
        centre_id: centreId,
        is_group: true,
      });
    } else if (related_customer_id) {
      Object.assign(convInput, {
        context_type: "customer",
        customer_id: related_customer_id,
        centre_id: centreId,
        is_group: true,
      });
    } else {
      Object.assign(convInput, {
        participant_ids: [...new Set([ownerId, assignedTo].filter(Boolean))],
        is_group: false,
        centre_id: null,
      });
    }

    conversation = await resolveConversation(convInput);

    // An existing service chat may not include the assignee yet — make sure they can see it
    if (assignedTo) {
      await addStaffToConversation(conversation.id, assignedTo, "collaborator", client);
    }

    /* ---------- 3. Insert task ---------- */
    const insertRes = await client.query(
      `INSERT INTO tasks
         (centre_id, title, description,
          assigned_to, assigned_by, assigned_by_role,
          priority, due_date,
          related_service_id, related_service_entry_id, related_customer_id,
          conversation_id, note_id, source, scheduled_action_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        centreId,
        String(title).trim(),
        description,
        assignedTo,
        isSystem ? null : toId(actor.id),
        actor.role,
        priority,
        due_date,
        related_service_id,
        related_service_entry_id,
        related_customer_id,
        conversation.id,
        toId(note_id),
        source,
        scheduled_action_id,
        status,
      ]
    );
    task = insertRes.rows[0];

    /* ---------- 4. Task bubble in chat ---------- */
    const msgRes = await client.query(
      `INSERT INTO chat_messages
         (conversation_id, sender_type, sender_id, message, message_type, created_at)
       VALUES ($1, $2, $3, $4, 'task', NOW())
       RETURNING *`,
      [conversation.id, isSystem ? "system" : "staff", isSystem ? null : toId(actor.id), String(task.id)]
    );
    savedMsg = msgRes.rows[0];

    await client.query(
      `UPDATE chat_conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [conversation.id]
    );

    /* ---------- 5. Calendar ---------- */
    if (due_date) {
      await client.query(
        `INSERT INTO calendar_events
           (date, title, type, event_type, description, centre_id,
            related_task_id, created_by, created_at)
         VALUES ($1, $2, 'task', 'task', $3, $4, $5, $6, NOW())`,
        [due_date, task.title, description, centreId, task.id, ownerId]
      );
    }

    if (ownTx) await client.query("COMMIT");
  } catch (err) {
    if (ownTx) await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    if (ownTx) client.release();
  }

  /* ---------- 6. Side effects (only after commit; all non-fatal) ---------- */
  const runSideEffects = async () => {
    try {
      await logActivity({
        centre_id: centreId,
        related_type: "task",
        related_id: task.id,
        action: isSystem ? "Task Auto-Created" : "Task Created",
        description: `${isSystem ? "System created" : "Created"} task: ${task.title} - assigned to ${assignedStaffName}${
          due_date ? ` (due: ${due_date})` : ""
        }`,
        performed_by: isSystem ? null : toId(actor.id),
        performed_by_role: actor.role,
      });
    } catch (e) {
      console.error("Non-fatal: task activity log failed:", e.message);
    }

    if (assignedTo && assignedTo !== toId(actor.id)) {
      try {
        await notificationService.createNotification({
          recipientStaffId: assignedTo,
          senderStaffId: isSystem ? null : toId(actor.id),
          centreId,
          relatedEntityType: "task",
          relatedEntityId: task.id,
          ...notificationTemplates.taskAssigned({
            taskTitle: task.title,
            metadata: {
              dueDate: due_date || "No due date",
              assignedBy: isSystem ? "System (scheduled)" : actor.role,
            },
          }),
        });
      } catch (e) {
        console.error("Non-fatal: task notification failed:", e.message);
      }
    }

    try {
      const messagePayload = { ...savedMsg, data: task, live_task_data: task };

      // messageRouter.js uses "conversation:ID"; the old task route used "conversation_ID".
      // Emit both until the frontend is confirmed to join only one of them.
      io.to(`conversation:${conversation.id}`).emit("new_message", messagePayload);
      io.to(`conversation_${conversation.id}`).emit("new_message", messagePayload);

      const participantsRes = await pool.query(
        `SELECT staff_id FROM chat_participants
         WHERE conversation_id = $1 AND participant_type = 'staff'`,
        [conversation.id]
      );

      for (const { staff_id } of participantsRes.rows) {
        if (staff_id === toId(actor.id)) continue;
        const unread = await getUnreadCount(staff_id, conversation.id);
        io.to(`user:${staff_id}`).emit("new_message", messagePayload);
        io.to(`user:${staff_id}`).emit("unread_update", {
          conversationId: Number(conversation.id),
          unread,
        });
      }
    } catch (e) {
      console.error("Non-fatal: task socket emit failed:", e.message);
    }
  };

  if (ownTx) {
    await runSideEffects();
    return { task, conversation, runSideEffects: null };
  }

  return { task, conversation, runSideEffects };
}