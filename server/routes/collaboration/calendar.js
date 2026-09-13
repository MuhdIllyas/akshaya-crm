import express from "express";
import pool from "../../db.js";
import { authMiddleware } from "../staff.js";

const router = express.Router();

router.use(authMiddleware(["admin", "superadmin", "staff"]));

/* ==========================================
   GET GLOBAL / ROLE-BASED CALENDAR
========================================== */
router.get("/", async (req, res) => {
  const client = await pool.connect();

  try {
    const targetCentre = req.query.centre_id || req.query.centreId;
    let centreFilter = "WHERE ce.related_task_id IS NULL";
    let values = [];

    // Allow global visibility at the database level for all roles
    if (req.user.role === "superadmin") {
      if (targetCentre) {
        centreFilter += " AND (ce.centre_id = $1 OR ce.visibility = 'global')";
        values.push(targetCentre);
      }
    } else if (req.user.role === "admin") {
      centreFilter += " AND (ce.centre_id = $1 OR ce.visibility = 'global')";
      values.push(req.user.centre_id);
    } else if (req.user.role === "staff") {
      centreFilter += " AND (ce.visibility = 'global' OR (ce.centre_id = $1 AND (ce.assigned_to IS NULL OR ce.assigned_to = $2)))";
      values.push(req.user.centre_id, req.user.id);
    }

    const eventsQuery = `
      SELECT 
        ce.id,
        ce.date,
        ce.type,
        ce.visibility, 
        ce.description,
        ce.centre_id,
        c.name AS centre_name,
        ce.assigned_to AS staff_id,
        s.name AS staff_name,
        s.role AS staff_role,
        s.photo AS staff_photo -- 🔥 FIX: Added staff photo
      FROM calendar_events ce
      JOIN centres c ON ce.centre_id = c.id
      LEFT JOIN staff s ON ce.assigned_to = s.id
      ${centreFilter}
    `;

    const eventsRes = await client.query(eventsQuery, values);

    // Task due dates with staff information
    let taskFilter = "";
    let taskValues = [];

    if (req.user.role === "superadmin") {
      if (targetCentre) {
        taskFilter = "AND t.centre_id = $1";
        taskValues.push(targetCentre);
      }
    } else if (req.user.role === "admin") {
      taskFilter = "AND t.centre_id = $1";
      taskValues.push(req.user.centre_id);
    } else if (req.user.role === "staff") {
      taskFilter = "AND t.centre_id = $1 AND t.assigned_to = $2";
      taskValues.push(req.user.centre_id, req.user.id);
    }

    const tasksQuery = `
      SELECT
        t.id,
        t.due_date AS date,
        'task' AS type,
        t.title AS description,
        t.centre_id,
        c.name AS centre_name,
        t.assigned_to AS staff_id,
        s.name AS staff_name,
        s.role AS staff_role,
        s.photo AS staff_photo -- 🔥 FIX: Added staff photo
      FROM tasks t
      JOIN centres c ON t.centre_id = c.id
      LEFT JOIN staff s ON t.assigned_to = s.id
      WHERE t.due_date IS NOT NULL
        AND t.status != 'completed'
        ${taskFilter}
    `;

    const taskRes = await client.query(tasksQuery, taskValues);

    const merged = [
      ...eventsRes.rows,
      ...taskRes.rows
    ];

    merged.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json(merged);

  } catch (err) {
    console.error("Calendar error:", err);
    res.status(500).json({ error: "Failed to fetch calendar" });
  } finally {
    client.release();
  }
});

/* ==========================================
   CREATE OPERATION EVENT
========================================== */
router.post("/", authMiddleware(["admin", "superadmin"]), async (req, res) => {
  // 🔥 RESTORED FIX: Include visibility in the destructuring
  const { date, type, description, centre_id, visibility } = req.body;
  const client = await pool.connect();

  try {
    const centreId =
      req.user.role === "admin"
        ? req.user.centre_id
        : centre_id;

    if (!centreId) {
      return res.status(400).json({ error: "Centre ID required" });
    }

    const eventVisibility = visibility || 'centre';

    // 🔥 RESTORED FIX: Insert visibility into the database
    const result = await client.query(
      `
      INSERT INTO calendar_events
      (date, type, description, centre_id, visibility, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
      `,
      [date, type, description, centreId, eventVisibility]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error("Create event error:", err);
    res.status(500).json({ error: "Failed to create event" });
  } finally {
    client.release();
  }
});

export default router;