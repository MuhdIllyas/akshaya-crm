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
   ROLE FILTER (CORRECTED)
====================================================== */

const buildRoleFilter = (user) => {
  // SUPERADMIN → ALL EVENTS
  if (user.role === "superadmin") {
    return {
      query: "",
      values: [],
    };
  }

  // ADMIN + STAFF:
  //   - GLOBAL events (visible to everyone)
  //   - CENTRE events only if they belong to the user's centre
  return {
    query: `
      AND (
        e.visibility = 'global'
        OR (
          e.visibility = 'centre'
          AND e.centre_id = $1
        )
      )
    `,
    values: [user.centre_id],
  };
};

/* ======================================================
   GET EVENTS (UNIFIED FEED)
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

    /* ======================================================
       DATE FILTER
    ====================================================== */

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

    /* ======================================================
       TYPE FILTER
    ====================================================== */

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

    /* ======================================================
       1. MANUAL CALENDAR EVENTS
    ====================================================== */

    const manualEventsQuery = `
      SELECT
        e.id,

        e.title,
        e.description,

        e.date,
        e.start_datetime,
        e.end_datetime,

        e.type,
        e.event_type,

        e.priority,
        e.status,
        e.visibility,

        e.created_at,
        e.centre_id,

        e.related_service_id,
        e.related_task_id,

        s.name AS service_name,

        st.name AS assigned_staff_name,
        st.id AS assigned_staff_id,

        'calendar_event' AS source

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

    const manualEventsRes = await client.query(
      manualEventsQuery,
      values
    );

    /* ======================================================
       2. TASK EVENTS
    ====================================================== */

    let taskFilter = "";
    let taskValues = [];

    // STAFF → only assigned tasks
    if (req.user.role === "staff") {
      taskFilter = `
        AND t.assigned_to = $1
      `;

      taskValues.push(req.user.id);
    }

    // ADMIN → centre tasks
    else if (req.user.role === "admin") {
      taskFilter = `
        AND t.centre_id = $1
      `;

      taskValues.push(req.user.centre_id);
    }

    const tasksQuery = `
      SELECT
        t.id,

        t.title,
        t.description,

        t.due_date AS date,

        NULL AS start_datetime,
        NULL AS end_datetime,

        'task' AS type,
        'deadline' AS event_type,

        t.priority,
        t.status,

        'centre' AS visibility,

        t.created_at,
        t.centre_id,

        t.related_service_id,
        NULL AS related_task_id,

        s.name AS service_name,

        st.name AS assigned_staff_name,
        st.id AS assigned_staff_id,

        'task' AS source

      FROM tasks t

      LEFT JOIN services s
        ON s.id = t.related_service_id

      LEFT JOIN staff st
        ON st.id = t.assigned_to

      WHERE t.due_date IS NOT NULL
      ${taskFilter}

      ORDER BY t.due_date ASC
    `;

    const taskRes = await client.query(
      tasksQuery,
      taskValues
    );

    /* ======================================================
      3. SERVICE TRACKING EVENTS
    ====================================================== */

    let trackingFilter = "";
    let trackingValues = [];

    // STAFF → only their entries
    if (req.user.role === "staff") {
      trackingFilter = `
        WHERE se.staff_id = $1
      `;

      trackingValues.push(req.user.id);
    }

    // ADMIN → only centre entries
    else if (req.user.role === "admin") {
      trackingFilter = `
        WHERE sf.centre_id = $1
      `;

      trackingValues.push(req.user.centre_id);
    }

    const serviceTrackingQuery = `
      SELECT
        tr.id,

        se.customer_name,

        sv.name AS service_name,

        se.id AS service_entry_id,

        se.staff_id,

        sf.name AS staff_name,

        sf.centre_id,

        se.expiry_date,

        tr.estimated_delivery

      FROM service_tracking tr

      LEFT JOIN service_entries se
        ON se.id = tr.service_entry_id

      LEFT JOIN services sv
        ON sv.id = se.subcategory_id

      LEFT JOIN staff sf
        ON sf.id = se.staff_id

      ${trackingFilter}
    `;

    const trackingRes = await client.query(
      serviceTrackingQuery,
      trackingValues
    );

    /* ======================================================
      BUILD SERVICE TRACKING EVENTS
    ====================================================== */

    const serviceTrackingEvents = [];

    trackingRes.rows.forEach((row) => {

      /* ======================
        EXPIRY EVENT
      ====================== */

      if (row.expiry_date) {
        serviceTrackingEvents.push({
          id: `expiry-${row.id}`,

          title: `${row.service_name} Expiry`,

          description: row.customer_name
            ? `Customer: ${row.customer_name}`
            : null,

          date: row.expiry_date,

          start_datetime: null,
          end_datetime: null,

          type: "service",
          event_type: "expiry",

          priority: "high",
          status: "active",

          visibility: "centre",

          created_at: null,
          centre_id: row.centre_id,

          related_service_id: row.service_entry_id,

          service_name: row.service_name,

          assigned_staff_name: row.staff_name,
          assigned_staff_id: row.staff_id,

          source: "service_tracking_expiry",
        });
      }

      /* ======================
        DELIVERY EVENT
      ====================== */

      if (row.estimated_delivery) {
        serviceTrackingEvents.push({
          id: `delivery-${row.id}`,

          title: `${row.service_name} Delivery`,

          description: row.customer_name
            ? `Customer: ${row.customer_name}`
            : null,

          date: row.estimated_delivery,

          start_datetime: null,
          end_datetime: null,

          type: "service",
          event_type: "deadline",

          priority: "medium",
          status: "active",

          visibility: "centre",

          created_at: null,
          centre_id: row.centre_id,

          related_service_id: row.service_entry_id,

          service_name: row.service_name,

          assigned_staff_name: row.staff_name,
          assigned_staff_id: row.staff_id,

          source: "service_tracking_delivery",
        });
      }
    });

    /* ======================================================
       COMBINE ALL EVENTS
    ====================================================== */

    const combinedEvents = [
      ...manualEventsRes.rows,
      ...taskRes.rows,
      ...serviceTrackingEvents,
    ];

    /* ======================================================
       SORT EVENTS
    ====================================================== */

    combinedEvents.sort((a, b) => {
      const aDate = new Date(
        a.start_datetime || a.date || 0
      );

      const bDate = new Date(
        b.start_datetime || b.date || 0
      );

      return aDate - bDate;
    });

    /* ======================================================
       RESPONSE
    ====================================================== */

    res.json(combinedEvents);

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
        title ?? event.title,
        description ?? event.description,

        date ?? event.date,
        start_datetime ?? event.start_datetime,
        end_datetime ?? event.end_datetime,

        type ?? event.type,
        event_type ?? event.event_type,

        visibility ?? event.visibility,
        priority ?? event.priority,
        status ?? event.status,

        assigned_to ?? event.assigned_to,

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