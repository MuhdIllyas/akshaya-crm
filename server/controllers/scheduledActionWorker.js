// controllers/scheduledActionWorker.js
// Runs every minute from routes/scheduler.js.
// Picks up due scheduled_actions and either:
//   - sends a WhatsApp template through the notification engine, or
//   - creates a task for a staff member.

import pool from "../db.js";
import { io } from "../server.js";
import { triggerNotification } from "../utils/communication/notificationEngine.js";
import { createTask, SYSTEM_ACTOR } from "../services/taskService.js";
import { buildActionParams, PermanentError } from "../utils/automationParams.js";
import { getUnreadCount } from "../utils/messageRouter.js";
import { logActivity } from "../utils/activityLogger.js";
import notificationService from "../utils/notificationService.js";

const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 3;
const RETRY_AFTER_MINUTES = [5, 15, 30]; // after attempt 1, 2, 3
const STUCK_AFTER_MINUTES = 10;

let running = false; // prevents overlapping ticks if Libromi is slow

export default async function runScheduledActions() {
  if (running) return;
  running = true;

  try {
    await recoverStuckActions();

    const actions = await claimDueActions();
    if (!actions.length) return;

    console.log(`[SCHEDULED] ⏰ ${actions.length} action(s) due`);
    for (const action of actions) {
      await executeAction(action);
    }
  } catch (err) {
    console.error("[SCHEDULED] Worker error:", err);
  } finally {
    running = false;
  }
}

/* =========================================================
   1. CLAIM (atomic — safe even with 2 server instances)
========================================================= */
async function claimDueActions() {
  const { rows } = await pool.query(
    `UPDATE scheduled_actions
        SET status = 'processing',
            attempts = attempts + 1,
            updated_at = NOW()
      WHERE id IN (
        SELECT id FROM scheduled_actions
         WHERE status = 'pending' AND run_at <= NOW()
         ORDER BY run_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED
      )
      RETURNING *`,
    [BATCH_SIZE]
  );
  return rows;
}

/* =========================================================
   2. RECOVER rows left in 'processing' by a crash/restart
========================================================= */
async function recoverStuckActions() {
  // WhatsApp: we can't know if Meta accepted it -> never auto-resend (avoid duplicates)
  await pool.query(
    `UPDATE scheduled_actions
        SET status = 'failed',
            last_error = 'Interrupted while sending (server restart). Check the chat before resending.',
            updated_at = NOW()
      WHERE status = 'processing'
        AND action_type = 'whatsapp_template'
        AND updated_at < NOW() - ($1 || ' minutes')::interval`,
    [STUCK_AFTER_MINUTES]
  );

  // Staff tasks are idempotent (checked by scheduled_action_id) -> safe to retry
  await pool.query(
    `UPDATE scheduled_actions
        SET status = 'pending', updated_at = NOW()
      WHERE status = 'processing'
        AND action_type = 'staff_task'
        AND updated_at < NOW() - ($1 || ' minutes')::interval`,
    [STUCK_AFTER_MINUTES]
  );
}

/* =========================================================
   3. EXECUTE
========================================================= */
async function executeAction(action) {
  try {
    const entry = action.service_entry_id ? await loadServiceEntry(action.service_entry_id) : null;

    // Guards: don't fire for things that no longer make sense
    if (action.service_entry_id && !entry) {
      return markCancelled(action, "Service entry no longer exists");
    }
    if (entry?.status === "cancelled") {
      return markCancelled(action, "Service entry was cancelled");
    }
    if (action.action_type === "staff_task" && entry?.workspace_closed_at) {
      return markCancelled(action, "Service workspace was closed");
    }
    const expiresAt = action.payload?.expires_at;
    if (expiresAt && new Date(expiresAt) <= new Date()) {
      return markCancelled(action, "Expired: the scheduled time had already passed when it was picked up");
    }

    const result =
      action.action_type === "whatsapp_template"
        ? await runWhatsAppAction(action, entry)
        : await runStaffTaskAction(action, entry);

    await markDone(action, entry, result);
  } catch (err) {
    await handleFailure(action, err);
  }
}

async function loadServiceEntry(id) {
  const { rows } = await pool.query(
    `SELECT se.*, s.name AS service_name
       FROM service_entries se
       LEFT JOIN services s ON s.id = se.category_id
      WHERE se.id = $1`,
    [id]
  );
  return rows[0] || null;
}

/* ---------- WhatsApp ---------- */
async function runWhatsAppAction(action, entry) {
  const phone = action.customer_phone || entry?.phone;
  if (!phone) throw new PermanentError("No customer phone number");
  if (!action.template_key) throw new PermanentError("No template configured");

  const params = await buildActionParams(action, entry);

  const res = await triggerNotification({
    eventKey: action.template_key,
    centreId: action.centre_id,
    customerPhone: phone,
    templateParams: params,
  });

  if (!res.success) {
    const reason =
      res.reason ||
      (typeof res.error === "string" ? res.error : JSON.stringify(res.error || "Unknown send error"));
    // Config problems won't fix themselves by retrying
    if (["no_account_mapped", "template_unmapped"].includes(res.reason)) {
      throw new PermanentError(reason);
    }
    throw new Error(reason);
  }

  const externalId = res.data?.messages?.[0]?.id || res.data?.message_id || res.data?.id || null;

  try {
    await logWhatsAppToChats(action, entry, phone, params, externalId);
  } catch (e) {
    console.error("[SCHEDULED] Non-fatal: could not log message to chat:", e.message);
  }

  return { sent_to: phone, params, external_message_id: externalId };
}

/* ---------- Staff task ---------- */
async function runStaffTaskAction(action, entry) {
  // Idempotency: if a previous attempt already created the task, don't make another
  const existing = await pool.query(
    `SELECT id FROM tasks WHERE scheduled_action_id = $1 LIMIT 1`,
    [action.id]
  );
  if (existing.rows.length) return { task_id: existing.rows[0].id, reused: true };

  const p = action.payload || {};
  const assignee = p.assigned_to || entry?.staff_id;

  if (!p.task_title || !String(p.task_title).trim()) throw new PermanentError("Task title missing");
  if (!assignee) throw new PermanentError("No staff to assign the task to");

  const { task } = await createTask({
    actor: SYSTEM_ACTOR,
    centre_id: action.centre_id,
    title: p.task_title,
    description: p.description || null,
    assigned_to: assignee,
    due_date: p.due_date || todayIST(),
    priority: p.priority || "medium",
    related_service_id: entry?.category_id || null,
    related_service_entry_id: action.service_entry_id || null,
    source: "scheduled",
    scheduled_action_id: action.id,
  });

  return { task_id: task.id, assigned_to: assignee };
}

/* =========================================================
   4. CHAT LOGGING (so staff can SEE what the system sent)
========================================================= */
async function logWhatsAppToChats(action, entry, phone, params, externalId) {
  const label = action.payload?.label || action.template_key;
  const summary = params.join(" · ");
  const last10 = String(phone).replace(/\D/g, "").slice(-10);

  // a) The customer's WhatsApp conversation (only if one already exists — never create here)
  const waConv = await pool.query(
    `SELECT id FROM chat_conversations
      WHERE channel = 'whatsapp'
        AND centre_id = $1
        AND RIGHT(regexp_replace(COALESCE(phone_number, ''), '\\D', '', 'g'), 10) = $2
        AND status <> 'deleted'
      ORDER BY last_message_at DESC NULLS LAST
      LIMIT 1`,
    [action.centre_id, last10]
  );

  if (waConv.rows.length) {
    await insertSystemChatMessage({
      conversationId: waConv.rows[0].id,
      message: `📨 Auto-sent: ${label}\n${summary}`,
      messageType: "template",
      direction: "outgoing",
      externalId,
    });
  }

  // b) The service entry's internal chat, so the team sees it happened
  if (action.service_entry_id) {
    const svcConv = await pool.query(
      `SELECT id FROM chat_conversations
        WHERE context_type = 'service_entry' AND context_id = $1
          AND status IN ('active', 'archived')
        LIMIT 1`,
      [action.service_entry_id]
    );
    if (svcConv.rows.length) {
      await insertSystemChatMessage({
        conversationId: svcConv.rows[0].id,
        message: `✅ Scheduled WhatsApp sent to ${entry?.customer_name || "customer"} (${phone}): ${label}`,
        messageType: "system",
        direction: "internal",
      });
    }
  }
}

async function insertSystemChatMessage({ conversationId, message, messageType, direction, externalId = null }) {
  const { rows } = await pool.query(
    `INSERT INTO chat_messages
       (conversation_id, sender_type, sender_id, message, message_type, direction, external_message_id, created_at)
     VALUES ($1, 'system', NULL, $2, $3, $4, $5, NOW())
     RETURNING *`,
    [conversationId, message, messageType, direction, externalId]
  );
  const saved = rows[0];

  await pool.query(
    `UPDATE chat_conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [conversationId]
  );

  io.to(`conversation:${conversationId}`).emit("new_message", { ...saved, sender_name: "System" });

  const participants = await pool.query(
    `SELECT staff_id FROM chat_participants WHERE conversation_id = $1 AND participant_type = 'staff'`,
    [conversationId]
  );
  for (const { staff_id } of participants.rows) {
    const unread = await getUnreadCount(staff_id, conversationId);
    io.to(`user:${staff_id}`).emit("unread_update", { conversationId: Number(conversationId), unread });
    io.to(`user:${staff_id}`).emit("conversation_updated", {
      conversationId: Number(conversationId),
      lastMessage: message,
      lastMessageSenderId: null,
      lastMessageSender: "System",
      time: saved.created_at,
      unread,
    });
  }
}

/* =========================================================
   5. STATUS UPDATES
========================================================= */
async function markDone(action, entry, result) {
  await pool.query(
    `UPDATE scheduled_actions
        SET status = 'done', executed_at = NOW(), result = $2,
            last_error = NULL, updated_at = NOW()
      WHERE id = $1`,
    [action.id, JSON.stringify(result || {})]
  );

  console.log(`[SCHEDULED] ✅ Action ${action.id} (${action.action_type}) done`);

  try {
    const label = action.payload?.label || action.template_key || action.payload?.task_title || action.action_type;
    await logActivity({
      centre_id: action.centre_id,
      related_type: action.service_entry_id ? "service_entry" : "scheduled_action",
      related_id: action.service_entry_id || action.id,
      action: action.action_type === "whatsapp_template" ? "Scheduled WhatsApp Sent" : "Scheduled Task Created",
      description:
        action.action_type === "whatsapp_template"
          ? `System sent "${label}" to ${result?.sent_to || "customer"}${entry ? ` (${entry.customer_name})` : ""}`
          : `System created task "${label}"${entry ? ` for ${entry.customer_name}` : ""}`,
      performed_by: null,
      performed_by_role: "system",
    });
  } catch (e) {
    console.error("[SCHEDULED] Non-fatal: activity log failed:", e.message);
  }
}

async function markCancelled(action, reason) {
  await pool.query(
    `UPDATE scheduled_actions
        SET status = 'cancelled', cancelled_at = NOW(), last_error = $2, updated_at = NOW()
      WHERE id = $1`,
    [action.id, reason]
  );
  console.log(`[SCHEDULED] ⏭️ Action ${action.id} cancelled: ${reason}`);
}

async function handleFailure(action, err) {
  const message = err?.message || String(err);
  const isFinal = err instanceof PermanentError || action.attempts >= MAX_ATTEMPTS;

  if (isFinal) {
    await pool.query(
      `UPDATE scheduled_actions
          SET status = 'failed', last_error = $2, updated_at = NOW()
        WHERE id = $1`,
      [action.id, message]
    );
    console.error(`[SCHEDULED] ❌ Action ${action.id} failed permanently: ${message}`);
    await notifyFailure(action, message);
    return;
  }

  const waitMinutes = RETRY_AFTER_MINUTES[Math.min(action.attempts - 1, RETRY_AFTER_MINUTES.length - 1)];
  await pool.query(
    `UPDATE scheduled_actions
        SET status = 'pending',
            run_at = NOW() + ($3 || ' minutes')::interval,
            last_error = $2,
            updated_at = NOW()
      WHERE id = $1`,
    [action.id, message, waitMinutes]
  );
  console.warn(
    `[SCHEDULED] 🔁 Action ${action.id} attempt ${action.attempts} failed, retrying in ${waitMinutes} min: ${message}`
  );
}

// Tell the staff who scheduled it, so a failed reminder never goes unnoticed
async function notifyFailure(action, reason) {
  if (!action.created_by) return;
  try {
    const label = action.payload?.label || action.template_key || action.payload?.task_title || "Scheduled action";
    await notificationService.createNotification({
      recipientStaffId: action.created_by,
      senderStaffId: null,
      centreId: action.centre_id,
      relatedEntityType: "service_entry",
      relatedEntityId: action.service_entry_id,
      type: "scheduled_action_failed",
      category: "work",
      title: "Scheduled action failed",
      message: `"${label}" could not be completed: ${reason}`,
      priority: "high",
      metadata: { scheduledActionId: action.id },
    });
  } catch (e) {
    console.error("[SCHEDULED] Non-fatal: failure notification failed:", e.message);
  }
}

/* ========================================================= */
function todayIST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
}