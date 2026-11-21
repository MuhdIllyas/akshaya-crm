// services/serviceTaskLink.js
// When a staff member saves the service entry for a service task, link the
// entry to the task and complete it — inside the entry's own transaction, so
// either both happen or neither does.

import pool from "../db.js";
import { io } from "../server.js";
import { logActivity } from "../utils/activityLogger.js";

/**
 * Lock and check the task before any money moves. Throws (status 400/403/404)
 * if the task can't be completed by this user.
 */
export async function lockServiceTask(client, taskId, user) {
  const id = parseInt(taskId, 10);
  if (!id) return null;

  const task = (await client.query(`SELECT * FROM tasks WHERE id = $1 FOR UPDATE`, [id])).rows[0];
  const fail = (status, message) => Object.assign(new Error(message), { status });

  if (!task) throw fail(404, "Service task not found");
  if (task.task_kind !== "service") throw fail(400, "That task is not a service task");
  if (Number(task.assigned_to) !== Number(user.id)) throw fail(403, "This service task is assigned to someone else");
  if (!["pending", "in_progress"].includes(task.status)) {
    throw fail(400, `This service task is already ${task.status}`);
  }
  return task;
}

/**
 * Pick the entry that matches the task's service (falls back to the first one),
 * link it and complete the task. `entries` = [{ id, categoryId, subcategoryId }].
 */
export async function completeServiceTask(client, task, entries) {
  if (!task || !entries.length) return null;

  const match =
    entries.find((e) => Number(e.categoryId) === Number(task.related_service_id) &&
      (!task.related_subcategory_id || Number(e.subcategoryId) === Number(task.related_subcategory_id))) ||
    entries.find((e) => Number(e.categoryId) === Number(task.related_service_id)) ||
    entries[0];

  const upd = await client.query(
    `UPDATE tasks
        SET related_service_entry_id = $1, status = 'completed', completed_at = NOW(), updated_at = NOW()
      WHERE id = $2
      RETURNING *`,
    [match.id, task.id]
  );
  await client.query(`DELETE FROM calendar_events WHERE related_task_id = $1`, [task.id]);
  return upd.rows[0];
}

/** After COMMIT: activity log, tell the assigner, refresh task lists. Never throws. */
export async function afterServiceTaskCompleted(task, user) {
  if (!task) return;
  try {
    const who = (await pool.query(`SELECT name FROM staff WHERE id = $1`, [user.id])).rows[0]?.name || "Staff";

    await logActivity({
      centre_id: task.centre_id,
      related_type: "task",
      related_id: task.id,
      action: "Task Completed",
      description: `${who} completed the service task "${task.title}" (service entry #${task.related_service_entry_id})`,
      performed_by: user.id,
      performed_by_role: user.role,
    });

    if (task.assigned_by && Number(task.assigned_by) !== Number(user.id)) {
      const { default: notificationService } = await import("../utils/notificationService.js");
      await notificationService.createNotification({
        recipientStaffId: task.assigned_by,
        senderStaffId: user.id,
        centreId: task.centre_id,
        relatedEntityType: "task",
        relatedEntityId: task.id,
        type: "task_completed",
        category: "work",
        title: "Service task completed",
        message: `${who} saved the service entry for "${task.title}"`,
        priority: "normal",
        metadata: { taskId: task.id, serviceEntryId: task.related_service_entry_id },
      });
    }

    io.to(`centre_${task.centre_id}`).emit("taskUpdated", {
      id: task.id,
      status: "completed",
      related_service_entry_id: task.related_service_entry_id,
    });
  } catch (e) {
    console.error("Non-fatal: service task follow-up failed:", e.message);
  }
}
