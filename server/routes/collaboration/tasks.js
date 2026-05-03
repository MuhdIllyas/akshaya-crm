import express from "express";
import pool from "../../db.js";
import jwt from "jsonwebtoken";
import { io } from "../../server.js";
import { logActivity } from "../../utils/activityLogger.js";
import { resolveConversation } from "../../utils/conversationService.js";

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
   CREATE TASK OR TEMPLATE
================================ */
router.post("/add", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      title,
      description,
      assigned_to,
      due_date,
      priority = "medium",
      related_service_id,
      related_service_entry_id,
      related_customer_id,
      is_global = false,

      // 🔁 Recurring fields
      recurrence_type,
      recurrence_interval = 1,
      recurrence_day,
      recurrence_date,
      due_offset_days = 0,
      assignment_mode = "centre_admin"
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title required" });
    }

    await client.query("BEGIN");

    /* =====================================================
       🔁 RECURRING TEMPLATE CREATION
    ====================================================== */
    if (recurrence_type) {

      if (!["admin", "superadmin"].includes(req.user.role)) {
        throw new Error("Only admin or superadmin can create recurring tasks");
      }

      if (req.user.role === "admin" && is_global) {
        throw new Error("Admin cannot create global recurring tasks");
      }

      let centreId = is_global ? null : req.user.centre_id;
      let templateAssignedTo = null;

      if (assignment_mode === "specific_staff") {

        if (!assigned_to) {
          throw new Error("assigned_to required for specific_staff mode");
        }

        const staffRes = await client.query(
          `SELECT centre_id FROM staff WHERE id=$1`,
          [assigned_to]
        );

        if (staffRes.rows.length === 0)
          throw new Error("Staff not found");

        const staffCentreId = staffRes.rows[0].centre_id;

        // 🔥 IMPORTANT FIX
        if (req.user.role === "superadmin") {
          centreId = staffCentreId;
        } else {
          if (staffCentreId !== centreId)
            throw new Error("Staff must belong to same centre");
        }

        templateAssignedTo = assigned_to;
      }

      // ✅ specific_staff support
      if (assignment_mode === "specific_staff") {

        if (!assigned_to) {
          throw new Error("assigned_to required for specific_staff mode");
        }

        const staffRes = await client.query(
          `SELECT centre_id FROM staff WHERE id=$1`,
          [assigned_to]
        );

        if (staffRes.rows.length === 0)
          throw new Error("Staff not found");

        if (!is_global && staffRes.rows[0].centre_id !== centreId)
          throw new Error("Staff must belong to same centre");

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
         VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,
                 $9,$10,$11,$12,$13,$14)
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
          assignment_mode
        ]
      );

      await client.query("COMMIT");

      // ========== ACTIVITY LOGGING ==========
      // Log recurring task template creation
      await logActivity({
        centre_id: centreId,
        related_type: 'task_template',
        related_id: templateRes.rows[0].id,
        action: 'Recurring Task Template Created',
        description: `Created recurring task template: ${title} (${recurrence_type})`,
        performed_by: req.user.id,
        performed_by_role: req.user.role
      });
      // ======================================

      return res.status(201).json({
        message: "Recurring template created successfully",
        template: templateRes.rows[0]
      });
    }

    /* =====================================================
       NORMAL ONE-TIME TASK
    ====================================================== */

    if (!["admin", "superadmin", "staff"].includes(req.user.role)) {
      throw new Error("Permission denied");
    }

    let centreId = req.user.centre_id;

    if (req.user.role === "superadmin") {
      if (!assigned_to) throw new Error("assigned_to required");

      const staffRes = await client.query(
        `SELECT centre_id FROM staff WHERE id=$1`,
        [assigned_to]
      );

      if (staffRes.rows.length === 0)
        throw new Error("Assigned staff not found");

      centreId = staffRes.rows[0].centre_id;
    }

    // Get assigned staff name for logging
    const assignedStaffRes = await client.query(
      `SELECT name FROM staff WHERE id=$1`,
      [assigned_to]
    );
    const assignedStaffName = assignedStaffRes.rows[0]?.name || 'Unknown';

    const insertRes = await client.query(
      `INSERT INTO tasks
       (centre_id,title,description,
        assigned_to,assigned_by,assigned_by_role,
        priority,due_date,
        related_service_id,
        related_service_entry_id,
        related_customer_id,
        conversation_id) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        centreId,
        title,
        description || null,
        assigned_to,
        req.user.id,
        req.user.role,
        priority,
        due_date || null,
        related_service_id || null,
        related_service_entry_id || null,
        related_customer_id || null,
        conversation.id || null
      ]
    );

    const task = insertRes.rows[0];

    /* ================================
   🔥 RESOLVE CONVERSATION
    ================================ */

    let conversationInput = {
      channel: "internal",
      centre_id: centreId,
      created_by: req.user.id
    };

    if (related_service_entry_id) {
      conversationInput.context_type = "service_entry";
      conversationInput.context_id = related_service_entry_id;
    } else if (related_customer_id) {
      conversationInput.context_type = "customer";
      conversationInput.customer_id = related_customer_id;
    } else {
      conversationInput.participant_ids = [req.user.id, assigned_to];
    }

    const conversation = await resolveConversation(conversationInput);

    /* ================================
      🔥 INSERT CHAT MESSAGE (TASK)
    ================================ */

    await client.query(
      `INSERT INTO chat_messages
      (conversation_id, sender_type, sender_id, message, message_type, created_at)
      VALUES ($1,'staff',$2,$3,'task',NOW())`,
      [
        conversation.id,
        req.user.id,
        task.id.toString() 
      ]
    );

    if (due_date) {
      await client.query(
        `INSERT INTO calendar_events
         (date, title, type, event_type,
          description, centre_id,
          related_task_id, created_by, created_at)
         VALUES ($1,$2,'task','task',$3,$4,$5,$6,NOW())`,
        [
          due_date,
          title,
          description || null,
          centreId,
          task.id,
          req.user.id
        ]
      );
    }

    await client.query("COMMIT");

    // ========== ACTIVITY LOGGING ==========
    // Log task creation
    await logActivity({
      centre_id: centreId,
      related_type: 'task',
      related_id: task.id,
      action: 'Task Created',
      description: `Created task: ${title} - assigned to ${assignedStaffName}${due_date ? ` (due: ${due_date})` : ''}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });
    // ======================================

    io.to(`conversation_${conversation.id}`).emit("new_message", {
      conversation_id: conversation.id,
      message_type: "task",
      data: task
    });

    res.status(201).json(task);

  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
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
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const values = [];
    const conditions = [];

    if (req.user.role !== "superadmin") {
      conditions.push(`centre_id = $${values.length + 1}`);
      values.push(req.user.centre_id);
    }

    if (status) {
      conditions.push(`status = $${values.length + 1}`);
      values.push(status);
    }

    if (priority) {
      conditions.push(`priority = $${values.length + 1}`);
      values.push(priority);
    }

    if (assigned_to) {
      conditions.push(`assigned_to = $${values.length + 1}`);
      values.push(assigned_to);
    }

    if (created_by) {
      conditions.push(`assigned_by = $${values.length + 1}`);
      values.push(created_by);
    }

    if (due_before) {
      conditions.push(`due_date <= $${values.length + 1}`);
      values.push(due_before);
    }

    if (overdue === "true") {
      conditions.push(`due_date < NOW() AND status != 'completed'`);
    }

    let query = `SELECT * FROM tasks`;

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += ` ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(limitNum, offset);

    const result = await pool.query(query, values);

    res.json(result.rows);

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

    if (taskRes.rows.length === 0)
      return res.status(404).json({ error: "Task not found" });

    const task = taskRes.rows[0];

    // Get assigned staff name for logging
    const staffRes = await client.query(
      `SELECT name FROM staff WHERE id=$1`,
      [task.assigned_to]
    );
    const assignedStaffName = staffRes.rows[0]?.name || 'Unknown';

    if (
      req.user.role !== "superadmin" &&
      task.centre_id !== req.user.centre_id
    ) {
      return res.status(403).json({ error: "Not allowed" });
    }

    if (
      req.user.role === "staff" &&
      task.assigned_to !== req.user.id
    ) {
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

    // ========== ACTIVITY LOGGING ==========
    // Log task status update
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
    // ======================================

    io.to(`centre_${task.centre_id}`).emit("taskUpdated", {
      id,
      status
    });

    res.json({ success: true });

  } catch (err) {
    await client.query("ROLLBACK");
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

    // Get assigned staff name for logging
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

    // ========== ACTIVITY LOGGING ==========
    // Log task deletion
    await logActivity({
      centre_id: task.centre_id,
      related_type: 'task',
      related_id: id,
      action: 'Task Deleted',
      description: `Deleted task: ${task.title} (assigned to ${assignedStaffName})`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });
    // ======================================

    io.to(`centre_${task.centre_id}`).emit("taskDeleted", { id });

    res.json({ message: "Task deleted" });

  } catch (err) {
    await client.query("ROLLBACK");
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

    // Role-based filtering
    if (req.user.role !== "superadmin") {
      query += ` AND (centre_id = $1 OR is_global = true)`;
      values.push(req.user.centre_id);
    }

    // Optional service filter
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

    if (templateRes.rows.length === 0)
      return res.status(404).json({ error: "Template not found" });

    const template = templateRes.rows[0];

    // Permission check
    if (req.user.role === "admin") {
      if (template.centre_id !== req.user.centre_id) {
        return res.status(403).json({ error: "Not allowed" });
      }
    }

    if (req.user.role === "staff") {
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

    // ========== ACTIVITY LOGGING ==========
    // Log recurring template update
    await logActivity({
      centre_id: template.centre_id,
      related_type: 'task_template',
      related_id: id,
      action: 'Recurring Task Template Updated',
      description: `Updated recurring task template: ${title || template.title}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });
    // ======================================

    res.json({ message: "Recurring template updated successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
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

    // Permission check
    if (req.user.role === "admin") {
      if (template.centre_id !== req.user.centre_id) {
        return res.status(403).json({ error: "Not allowed" });
      }
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

    // ========== ACTIVITY LOGGING ==========
    // Log template pause/resume
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
    // ======================================

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

    // Permission check
    if (req.user.role === "admin") {
      if (template.centre_id !== req.user.centre_id) {
        throw new Error("Not allowed");
      }
    }

    if (req.user.role === "staff") {
      throw new Error("Not allowed");
    }

    // Delete the template (tasks generated from it will remain)
    await client.query(
      `DELETE FROM task_templates WHERE id=$1`,
      [id]
    );

    await client.query("COMMIT");

    // ========== ACTIVITY LOGGING ==========
    // Log template deletion
    await logActivity({
      centre_id: template.centre_id,
      related_type: 'task_template',
      related_id: id,
      action: 'Recurring Task Template Deleted',
      description: `Deleted recurring task template: ${template.title}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });
    // ======================================

    res.json({ message: "Template deleted successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;