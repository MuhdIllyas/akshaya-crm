// routes/events.js

import express from "express";
import pool from "../db.js";
import jwt from "jsonwebtoken";

const router = express.Router();

/* ======================================================
   AUTH MIDDLEWARE
====================================================== */

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        error: "Invalid token",
      });
    }

    req.user = user;
    next();
  });
};

router.use(authenticateToken);

/* ======================================================
   ROLE FILTER
====================================================== */

const buildRoleFilter = (user) => {
  // SUPERADMIN → ALL EVENTS
  if (user.role === "superadmin") {
    return {
      query: "",
      values: [],
    };
  }

  // ADMIN → CENTRE + GLOBAL
  if (user.role === "admin") {
    return {
      query: `
        AND (
          e.centre_id = $1
          OR e.visibility = 'global'
        )
      `,
      values: [user.centre_id],
    };
  }

  // STAFF → ASSIGNED + CENTRE + GLOBAL
  return {
    query: `
      AND (
        e.assigned_to = $1
        OR e.centre_id = $2
        OR e.visibility = 'global'
      )
    `,
    values: [user.id, user.centre_id],
  };
};

/* ======================================================
   GET EVENTS
====================================================== */

router.get("/", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      start,
      end,
      type,
      event_type,
      priority,
      visibility,
    } = req.query;

    const roleFilter = buildRoleFilter(req.user);

    let conditions = [];
    let values = [...roleFilter.values];
    let idx = values.length + 1;

    /* ======================
       DATE FILTER
    ====================== */

    if (start && end) {
      conditions.push(`
        (
          e.date BETWEEN $${idx} AND $${idx + 1}
          OR e.start_datetime BETWEEN $${idx} AND $${idx + 1}
        )
      `);

      values.push(start, end);
      idx += 2;
    }

    /* ======================
       TYPE FILTER
    ====================== */

    if (type) {
      conditions.push(`e.type = $${idx}`);
      values.push(type);
      idx++;
    }

    if (event_type) {
      conditions.push(`e.event_type = $${idx}`);
      values.push(event_type);
      idx++;
    }

    if (priority) {
      conditions.push(`e.priority = $${idx}`);
      values.push(priority);
      idx++;
    }

    if (visibility) {
      conditions.push(`e.visibility = $${idx}`);
      values.push(visibility);
      idx++;
    }

    const whereClause =
      conditions.length > 0
        ? `AND ${conditions.join(" AND ")}`
        : "";

    /* ======================
       MAIN QUERY
    ====================== */

    const query = `
      SELECT
        e.*,

        s.name AS service_name,

        st.name AS assigned_staff_name

      FROM calendar_events e

      LEFT JOIN services s
        ON s.id = e.related_service_id

      LEFT JOIN staff st
        ON st.id = e.assigned_to

      WHERE 1=1
      ${roleFilter.query}
      ${whereClause}

      ORDER BY
        COALESCE(e.start_datetime, e.date) ASC
    `;

    const result = await client.query(query, values);

    res.json(result.rows);

  } catch (err) {
    console.error("GET EVENTS ERROR:", err);

    res.status(500).json({
      message: "Failed to fetch events",
    });

  } finally {
    client.release();
  }
});

/* ======================================================
   CREATE EVENT
====================================================== */

router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      title,
      description,

      date,
      start_datetime,
      end_datetime,

      type,
      event_type,

      related_task_id,
      related_service_id,

      visibility = "centre",
      priority = "medium",
      status = "active",

      assigned_to,
    } = req.body;

    /* ======================
       VALIDATION
    ====================== */

    if (!title || !title.trim()) {
      return res.status(400).json({
        message: "Title is required",
      });
    }

    /* ======================
       INSERT
    ====================== */

    const query = `
      INSERT INTO calendar_events (
        title,
        description,

        date,
        start_datetime,
        end_datetime,

        type,
        event_type,

        related_task_id,
        related_service_id,

        created_by,
        centre_id,

        visibility,
        priority,
        status,

        assigned_to,

        created_at
      )
      VALUES (
        $1, $2,
        $3, $4, $5,
        $6, $7,
        $8, $9,
        $10, $11,
        $12, $13, $14,
        $15,
        NOW()
      )
      RETURNING *
    `;

    const values = [
      title,

      description || null,

      date || null,
      start_datetime || null,
      end_datetime || null,

      type || "task",
      event_type || "deadline",

      related_task_id || null,
      related_service_id || null,

      req.user.id,
      req.user.centre_id,

      visibility || "centre",
      priority || "medium",
      status || "active",

      assigned_to || null,
    ];

    const result = await client.query(query, values);

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error("CREATE EVENT ERROR:", err);

    res.status(500).json({
      message: "Failed to create event",
    });

  } finally {
    client.release();
  }
});

/* ======================================================
   UPDATE EVENT
====================================================== */

router.put("/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const existing = await client.query(
      `
      SELECT * FROM calendar_events
      WHERE id = $1
      `,
      [id]
    );

    if (!existing.rows.length) {
      return res.status(404).json({
        message: "Event not found",
      });
    }

    const event = existing.rows[0];

    /* ======================
       PERMISSION CHECK
    ====================== */

    if (
      req.user.role !== "superadmin" &&
      event.centre_id !== req.user.centre_id
    ) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    const {
      title,
      description,

      date,
      start_datetime,
      end_datetime,

      type,
      event_type,

      visibility,
      priority,
      status,

      assigned_to,
    } = req.body;

    const query = `
      UPDATE calendar_events
      SET
        title = $1,
        description = $2,

        date = $3,
        start_datetime = $4,
        end_datetime = $5,

        type = $6,
        event_type = $7,

        visibility = $8,
        priority = $9,
        status = $10,

        assigned_to = $11

      WHERE id = $12

      RETURNING *
    `;

    const values = [
      title,
      description,

      date || null,
      start_datetime || null,
      end_datetime || null,

      type,
      event_type,

      visibility,
      priority,
      status,

      assigned_to || null,

      id,
    ];

    const result = await client.query(query, values);

    res.json(result.rows[0]);

  } catch (err) {
    console.error("UPDATE EVENT ERROR:", err);

    res.status(500).json({
      message: "Failed to update event",
    });

  } finally {
    client.release();
  }
});

/* ======================================================
   DELETE EVENT
====================================================== */

router.delete("/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const existing = await client.query(
      `
      SELECT * FROM calendar_events
      WHERE id = $1
      `,
      [id]
    );

    if (!existing.rows.length) {
      return res.status(404).json({
        message: "Event not found",
      });
    }

    const event = existing.rows[0];

    /* ======================
       PERMISSION CHECK
    ====================== */

    if (
      req.user.role !== "superadmin" &&
      event.centre_id !== req.user.centre_id
    ) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    await client.query(
      `
      DELETE FROM calendar_events
      WHERE id = $1
      `,
      [id]
    );

    res.json({
      message: "Event deleted successfully",
    });

  } catch (err) {
    console.error("DELETE EVENT ERROR:", err);

    res.status(500).json({
      message: "Failed to delete event",
    });

  } finally {
    client.release();
  }
});

export default router;