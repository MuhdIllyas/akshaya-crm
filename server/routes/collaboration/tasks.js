import express from "express";
import pool from "../../db.js";
import jwt from "jsonwebtoken";
import { io } from "../../server.js";
import { logActivity } from "../../utils/activityLogger.js";
import { createTask } from "../../services/taskService.js";

const router = express.Router();

/* ================================
   AUTH MIDDLEWARE
================================ */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

router.use(authenticateToken);

/* ================================
   RECURRING TEMPLATE CREATION
================================ */
async function createRecurringTemplate(req) {
  const {
    title,
    description,
    assigned_to,
    priority = "medium",
    is_global = false,
    recurrence_type,
    recurrence_interval = 1,
    recurrence_day,
    recurrence_date,
    due_offset_days = 0,
    assignment_mode = "centre_admin",
  } = req.body;

  if (!["admin", "superadmin"].includes(req.user.role)) {
    throw new Error("Only admin or superadmin can create recurring tasks");
  }
  if (req.user.role === "admin" && is_global) {
    throw new Error("Admin cannot create global recurring tasks");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let centreId = is_global ? null : req.user.centre_id;
    let templateAssignedTo = null;

    // (Previously this block was duplicated; the 2nd copy undid the superadmin fix.)
    if (assignment_mode === "specific_staff") {
      if (!assigned_to) throw new Error("assigned_to required for specific_staff mode");

      const staffRes = await client.query(`SELECT centre_id FROM staff WHERE id=$1`, [assigned_to]);
      if (staffRes.rows.length === 0) throw new Error("Staff not found");

      const staffCentreId = staffRes.rows[0].centre_id;
      if (req.user.role === "superadmin") {
        centreId = staffCentreId;
      } else if (staffCentreId !== centreId) {
        throw new Error("Staff must belong to same centre");
      }
      templateAssignedTo = assigned_to;
    }

    const templateRes = await client.query(
      `INSERT INTO task_templates
       (centre_id, title, description, priority,
        assigned_to, assigned_by, assigned_by_role,
        is_active, is_global,
        recurrence_type, recurrence_interval,
        recurrence_day, recurrence_date,
        due_offset_days, assignment_mode)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        centreId,
        title,
        description || null,
        priority,
        templateAssignedTo,
        req.user.id,
        req.user.role,
        is_global,
        recurrence_type,
        recurrence_interval,
        recurrence_day || null,
        recurrence_date || null,
        due_offset_days,
        assignment_mode,
      ]
    );

    await client.query("COMMIT");

    await logActivity({
      centre_id: centreId,
      related_type: "task_template",
      related_id: templateRes.rows[0].id,
      action: "Recurring Task Template Created",
      description: `Created recurring task template: ${title} (${recurrence_type})`,
      performed_by: req.user.id,
      performed_by_role: req.user.role,
    });

    return templateRes.rows[0];
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/* ================================
   CREATE TASK OR TEMPLATE
================================ */
router.post("/add", async (req, res) => {
  try {
    if (!req.body.title) return res.status(400).json({ error: "Title required" });

    if (req.body.recurrence_type) {
      const template = await createRecurringTemplate(req);
      return res.status(201).json({
        message: "Recurring template created successfully",
        template,
      });
    }

    const { task } = await createTask({
      actor: req.user,
      title: req.body.title,
      description: req.body.description || null,
      assigned_to: req.body.assigned_to,
      due_date: req.body.due_date || null,
      priority: req.body.priority || "medium",
      related_service_id: req.body.related_service_id || null,
      related_service_entry_id: req.body.related_service_entry_id || null,
      related_customer_id: req.body.related_customer_id || null,
      note_id: req.body.note_id || null,
      source: "manual",
    });

    res.status(201).json(task);
  } catch (err) {
    console.error("TASK CREATION ERROR:", err);
    res.status(400).json({ error: err.message });
  }
});

/* ================================
   LIST TASKS
================================ */
router.get("/all", async (req, res) => {
  try {
    const {
      status,
      priority,
      assigned_to,
      created_by,
      due_before,
      overdue,
      related_service_entry_id,
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 500);
    const offset = (pageNum - 1) * limitNum;

    const values = [];
    const conditions = [];
    const add = (sql, v) => {
      values.push(v);
      conditions.push(sql.replace("?", `$${values.length}`));
    };

    if (req.user.role !== "superadmin") add("t.centre_id = ?", req.user.centre_id);
    if (status) add("t.status = ?", status);
    if (priority) add("t.priority = ?", priority);
    if (assigned_to) add("t.assigned_to = ?", assigned_to);
    if (created_by) add("t.assigned_by = ?", created_by);
    if (due_before) add("t.due_date <= ?", due_before);
    if (related_service_entry_id) add("t.related_service_entry_id = ?", related_service_entry_id);
    if (overdue === "true") conditions.push(`t.due_date < NOW() AND t.status != 'completed'`);

    // Service info so the UI can show which service a task belongs to
    // and link straight to its tracking page.
    let query = `
      SELECT t.*,
             se.customer_name   AS service_customer_name,
             se.phone           AS service_phone,
             srv.name           AS service_name,
             sub.name           AS service_subcategory_name,
             trk.id             AS tracking_id,
             trk.application_number
      FROM tasks t
      LEFT JOIN service_entries se ON se.id = t.related_service_entry_id
      LEFT JOIN services srv       ON srv.id = se.category_id
      LEFT JOIN subcategories sub  ON sub.id = se.subcategory_id
      LEFT JOIN LATERAL (
        SELECT st.id, st.application_number
        FROM service_tracking st
        WHERE st.service_entry_id = se.id
        ORDER BY st.id DESC
        LIMIT 1
      ) trk ON true`;

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    values.push(limitNum, offset);
    query += ` ORDER BY t.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`;

    const result = await pool.query(query, values);

    res.json(result.rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================================
   SERVICE LINK RESOLVER
   GET /service-link?task_id=12  or  ?entry_id=34
   -> { service_entry_id, tracking_id, service_name, customer_name }
   Used by the calendar "View Details" button when an event
   doesn't carry a tracking id itself.
================================ */
router.get("/service-link", async (req, res) => {
  try {
    const taskId = parseInt(req.query.task_id, 10);
    let entryId = parseInt(req.query.entry_id, 10);

    if (!entryId && taskId) {
      const t = await pool.query(
        `SELECT related_service_entry_id, centre_id FROM tasks WHERE id = $1`,
        [taskId]
      );
      if (!t.rows.length) return res.status(404).json({ error: "Task not found" });
      if (req.user.role !== "superadmin" && Number(t.rows[0].centre_id) !== Number(req.user.centre_id)) {
        return res.status(403).json({ error: "Not allowed" });
      }
      entryId = t.rows[0].related_service_entry_id;
    }

    if (!entryId) return res.status(404).json({ error: "Not linked to a service" });

    const r = await pool.query(
      `SELECT se.id AS service_entry_id, se.customer_name, srv.name AS service_name,
              st.centre_id,
              (SELECT trk.id FROM service_tracking trk
                WHERE trk.service_entry_id = se.id
                ORDER BY trk.id DESC LIMIT 1) AS tracking_id
         FROM service_entries se
         LEFT JOIN services srv ON srv.id = se.category_id
         LEFT JOIN staff st ON st.id = se.staff_id
        WHERE se.id = $1`,
      [entryId]
    );
    const row = r.rows[0];
    if (!row) return res.status(404).json({ error: "Service entry not found" });
    if (req.user.role !== "superadmin" && Number(row.centre_id) !== Number(req.user.centre_id)) {
      return res.status(403).json({ error: "Not allowed" });
    }

    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================================
   UPDATE STATUS
================================ */
router.patch("/:id/status", async (req, res) => {
  const client = await pool.connect();

  try {
    const { status } = req.body;
    const { id } = req.params;

    await client.query("BEGIN");

    const taskRes = await client.query(
      `SELECT * FROM tasks WHERE id=$1`,
      [id]
    );

    if (taskRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Task not found" });
    }

    const task = taskRes.rows[0];

    const staffRes = await client.query(
      `SELECT name FROM staff WHERE id=$1`,
      [task.assigned_to]
    );
    const assignedStaffName = staffRes.rows[0]?.name || 'Unknown';

    if (
      req.user.role !== "superadmin" &&
      task.centre_id !== req.user.centre_id
    ) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Not allowed" });
    }

    if (
      req.user.role === "staff" &&
      task.assigned_to !== req.user.id
    ) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Not allowed" });
    }

    const completedAt =
      status === "completed" ? new Date() : null;

    await client.query(
      `UPDATE tasks
       SET status=$1,
           completed_at=$2,
           updated_at=NOW()
       WHERE id=$3`,
      [status, completedAt, id]
    );

    if (status === "completed") {
      await client.query(
        `DELETE FROM calendar_events WHERE related_task_id=$1`,
        [id]
      );
    }

    await client.query("COMMIT");

    const action = status === 'completed' ? 'Task Completed' : `Task Status Updated to ${status}`;
    const description = status === 'completed' 
      ? `Task completed: ${task.title} (assigned to ${assignedStaffName})`
      : `Task status updated to ${status}: ${task.title}`;
    
    await logActivity({
      centre_id: task.centre_id,
      related_type: 'task',
      related_id: id,
      action: action,
      description: description,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });

    // Notify the creator on completion (system-created tasks have no assigned_by)
    if (status === "completed" && task.assigned_by && task.assigned_by !== req.user.id) {
      try {
        const { default: notificationService } = await import("../../utils/notificationService.js");
        await notificationService.createNotification({
          recipientStaffId: task.assigned_by,
          senderStaffId: req.user.id,
          centreId: task.centre_id,
          relatedEntityType: 'task',
          relatedEntityId: task.id,
          type: 'task_completed',
          category: 'work',
          title: 'Task Completed',
          message: `${assignedStaffName} completed the task: ${task.title}`,
          priority: 'normal',
          metadata: { taskId: task.id }
        });
      } catch (notifErr) {
        console.error("Non-fatal: Failed to send completion notification:", notifErr);
      }
    }

    io.to(`centre_${task.centre_id}`).emit("taskUpdated", {
      id,
      status
    });

    res.json({ success: true });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ================================
   DELETE TASK
================================ */
router.delete("/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query("BEGIN");

    const taskRes = await client.query(
      `SELECT * FROM tasks WHERE id=$1`,
      [id]
    );

    if (taskRes.rows.length === 0)
      throw new Error("Task not found");

    const task = taskRes.rows[0];

    const staffRes = await client.query(
      `SELECT name FROM staff WHERE id=$1`,
      [task.assigned_to]
    );
    const assignedStaffName = staffRes.rows[0]?.name || 'Unknown';

    if (
      req.user.role !== "superadmin" &&
      task.centre_id !== req.user.centre_id
    ) {
      throw new Error("Not allowed");
    }

    await client.query(
      `DELETE FROM calendar_events WHERE related_task_id=$1`,
      [id]
    );

    await client.query(
      `DELETE FROM tasks WHERE id=$1`,
      [id]
    );

    await client.query("COMMIT");

    await logActivity({
      centre_id: task.centre_id,
      related_type: 'task',
      related_id: id,
      action: 'Task Deleted',
      description: `Deleted task: ${task.title} (assigned to ${assignedStaffName})`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });

    io.to(`centre_${task.centre_id}`).emit("taskDeleted", { id });

    res.json({ message: "Task deleted" });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ================================
   LIST RECURRING TEMPLATES
================================ */
router.get("/templates", async (req, res) => {
  try {
    const { related_service_id } = req.query;

    const values = [];
    let query = `
      SELECT *
      FROM task_templates
      WHERE recurrence_type IS NOT NULL
    `;

    if (req.user.role !== "superadmin") {
      query += ` AND (centre_id = $1 OR is_global = true)`;
      values.push(req.user.centre_id);
    }

    if (related_service_id) {
      query += ` AND related_service_id = $${values.length + 1}`;
      values.push(related_service_id);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, values);

    res.json(result.rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================================
   UPDATE RECURRING TEMPLATE
================================ */
router.patch("/template/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const {
      title,
      description,
      priority,
      recurrence_type,
      recurrence_interval,
      recurrence_day,
      recurrence_date,
      due_offset_days,
      assignment_mode,
      is_active
    } = req.body;

    await client.query("BEGIN");

    const templateRes = await client.query(
      `SELECT * FROM task_templates WHERE id=$1`,
      [id]
    );

    if (templateRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Template not found" });
    }

    const template = templateRes.rows[0];

    if (req.user.role === "admin" && template.centre_id !== req.user.centre_id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Not allowed" });
    }

    if (req.user.role === "staff") {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Not allowed" });
    }

    await client.query(
      `UPDATE task_templates
       SET title=$1,
           description=$2,
           priority=$3,
           recurrence_type=$4,
           recurrence_interval=$5,
           recurrence_day=$6,
           recurrence_date=$7,
           due_offset_days=$8,
           assignment_mode=$9,
           is_active=$10,
           updated_at=NOW()
       WHERE id=$11`,
      [
        title,
        description,
        priority,
        recurrence_type,
        recurrence_interval,
        recurrence_day || null,
        recurrence_date || null,
        due_offset_days,
        assignment_mode,
        is_active,
        id
      ]
    );

    await client.query("COMMIT");

    await logActivity({
      centre_id: template.centre_id,
      related_type: 'task_template',
      related_id: id,
      action: 'Recurring Task Template Updated',
      description: `Updated recurring task template: ${title || template.title}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });

    res.json({ message: "Recurring template updated successfully" });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ================================
   TOGGLE RECURRING TEMPLATE (Pause/Resume)
================================ */
router.patch("/template/:id/toggle", async (req, res) => {
  try {
    const { id } = req.params;

    const templateRes = await pool.query(
      `SELECT * FROM task_templates WHERE id=$1`,
      [id]
    );

    if (templateRes.rows.length === 0)
      return res.status(404).json({ error: "Template not found" });

    const template = templateRes.rows[0];

    if (req.user.role === "admin" && template.centre_id !== req.user.centre_id) {
      return res.status(403).json({ error: "Not allowed" });
    }

    if (req.user.role === "staff") {
      return res.status(403).json({ error: "Not allowed" });
    }

    const result = await pool.query(
      `UPDATE task_templates
       SET is_active = NOT is_active,
           updated_at = NOW()
       WHERE id=$1
       RETURNING is_active`,
      [id]
    );

    const newStatus = result.rows[0].is_active ? 'resumed' : 'paused';
    await logActivity({
      centre_id: template.centre_id,
      related_type: 'task_template',
      related_id: id,
      action: `Recurring Task Template ${newStatus === 'resumed' ? 'Resumed' : 'Paused'}`,
      description: `${newStatus === 'resumed' ? 'Resumed' : 'Paused'} recurring task template: ${template.title}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });

    res.json({
      message: result.rows[0].is_active
        ? "Template resumed"
        : "Template paused"
    });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ================================
   DELETE RECURRING TEMPLATE
================================ */
router.delete("/template/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query("BEGIN");

    const templateRes = await client.query(
      `SELECT * FROM task_templates WHERE id=$1`,
      [id]
    );

    if (templateRes.rows.length === 0)
      throw new Error("Template not found");

    const template = templateRes.rows[0];

    if (req.user.role === "admin" && template.centre_id !== req.user.centre_id) {
      throw new Error("Not allowed");
    }

    if (req.user.role === "staff") {
      throw new Error("Not allowed");
    }

    await client.query(
      `DELETE FROM task_templates WHERE id=$1`,
      [id]
    );

    await client.query("COMMIT");

    await logActivity({
      centre_id: template.centre_id,
      related_type: 'task_template',
      related_id: id,
      action: 'Recurring Task Template Deleted',
      description: `Deleted recurring task template: ${template.title}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });

    res.json({ message: "Template deleted successfully" });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;