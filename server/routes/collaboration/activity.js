import express from "express";
import pool from "../../db.js";
import jwt from "jsonwebtoken";

const router = express.Router();

/* =========================================================
   AUTH MIDDLEWARE
========================================================= */

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

/* =========================================================
   SHARED QUERY PARTS
========================================================= */

const FROM_SQL = `
  FROM activities a
  LEFT JOIN centres c ON a.centre_id = c.id
  LEFT JOIN staff s ON a.performed_by = s.id
`;

// Chat messages are private: never returned by this API, whatever the filters.
const NOT_PRIVATE_SQL = `
  NOT (
    COALESCE(a.action, '') ILIKE '%message%'
    OR COALESCE(a.related_type, '') IN ('message', 'chat_message', 'chat')
  )
`;

// Same categories as the Activity page tabs
const CATEGORY_SQL = `
  CASE
    WHEN COALESCE(a.action, '') ILIKE '%task%' THEN 'task'
    WHEN COALESCE(a.action, '') ILIKE '%document%' OR COALESCE(a.action, '') ILIKE '%file%' THEN 'document'
    WHEN COALESCE(a.action, '') ~* '(collaborator|participant|login|logout|staff)' THEN 'team'
    WHEN (COALESCE(a.action, '') || ' ' || COALESCE(a.related_type, '')) ~* '(service|workspace|tracking)' THEN 'service'
    WHEN COALESCE(a.related_type, '') ILIKE '%task%' THEN 'task'
    ELSE 'other'
  END
`;

const CATEGORIES = ["task", "service", "document", "team", "other"];

const toInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};

const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const escapeLike = (s) => String(s).replace(/[\\%_]/g, (ch) => `\\${ch}`);

/**
 * Builds the WHERE clause from the query string.
 *   search   – text in action, description, staff name or centre name
 *   staff    – staff id (performed_by)
 *   from, to – ISO timestamps; `to` is exclusive (the browser sends local day bounds)
 *   category – task | service | document | team | other
 *   centre   – centre id (superadmin only; everyone else is locked to their own centre)
 */
function buildFilters(req, { category = true, staff = true, date = true, search = true } = {}) {
  const where = [NOT_PRIVATE_SQL];
  const values = [];
  const param = (v) => {
    values.push(v);
    return `$${values.length}`;
  };
  const q = req.query;

  if (req.user.role !== "superadmin") {
    where.push(`a.centre_id = ${param(req.user.centre_id)}`);
  } else if (q.centre && q.centre !== "all" && toInt(q.centre) !== null) {
    where.push(`a.centre_id = ${param(toInt(q.centre))}`);
  }

  if (staff && q.staff && q.staff !== "all" && toInt(q.staff) !== null) {
    where.push(`a.performed_by = ${param(toInt(q.staff))}`);
  }

  if (date) {
    const from = toDate(q.from);
    const to = toDate(q.to);
    if (from) where.push(`a.created_at >= ${param(from.toISOString())}`);
    if (to) where.push(`a.created_at < ${param(to.toISOString())}`);
  }

  if (search && q.search && String(q.search).trim()) {
    const p = param(`%${escapeLike(String(q.search).trim().replace(/_/g, " "))}%`);
    where.push(`(
      replace(COALESCE(a.action, ''), '_', ' ') ILIKE ${p}
      OR replace(COALESCE(a.description, ''), '_', ' ') ILIKE ${p}
      OR COALESCE(s.name, '') ILIKE ${p}
      OR COALESCE(c.name, '') ILIKE ${p}
    )`);
  }

  if (category && q.category && CATEGORIES.includes(q.category)) {
    where.push(`(${CATEGORY_SQL}) = ${param(q.category)}`);
  }

  return { whereSql: `WHERE ${where.join(" AND ")}`, values, param };
}

/* =========================================================
   GET ACTIVITIES
   GET /api/activities?page=1&limit=20&search=&staff=&from=&to=&category=&centre=
========================================================= */

router.get("/", authenticateToken, async (req, res) => {
  try {
    const page = Math.max(1, toInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, toInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const { whereSql, values, param } = buildFilters(req);

    const result = await pool.query(
      `
      SELECT
        a.*,
        c.name AS centre_name,
        s.name AS performer_name,
        ${CATEGORY_SQL} AS category
      ${FROM_SQL}
      ${whereSql}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ${param(limit)} OFFSET ${param(offset)}
      `,
      values
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching activities:", err);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
});

/* =========================================================
   SUMMARY (same filters, whole history)
   GET /api/activities/summary?search=&staff=&from=&to=&centre=
========================================================= */

router.get("/summary", authenticateToken, async (req, res) => {
  try {
    // Totals: everything except the category tab, so each tab can show its count
    const totals = buildFilters(req, { category: false });
    const totalsRes = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE x.category = 'task')::int AS task,
        COUNT(*) FILTER (WHERE x.category = 'service')::int AS service,
        COUNT(*) FILTER (WHERE x.category = 'document')::int AS document,
        COUNT(*) FILTER (WHERE x.category = 'team')::int AS team,
        COUNT(*) FILTER (WHERE x.category = 'task' AND x.action ILIKE '%complet%')::int AS tasks_done,
        COUNT(*) FILTER (WHERE x.category = 'task' AND x.action ILIKE '%creat%')::int AS tasks_created
      FROM (
        SELECT a.action, ${CATEGORY_SQL} AS category
        ${FROM_SQL}
        ${totals.whereSql}
      ) x
      `,
      totals.values
    );

    // Most active: same period/search/centre, but across all staff
    const active = buildFilters(req, { category: false, staff: false });
    const activeRes = await pool.query(
      `
      SELECT a.performed_by AS id, s.name, s.role, COUNT(*)::int AS count
      ${FROM_SQL}
      ${active.whereSql} AND a.performed_by IS NOT NULL
      GROUP BY a.performed_by, s.name, s.role
      ORDER BY count DESC, s.name ASC
      LIMIT 5
      `,
      active.values
    );

    // Staff dropdown: everyone who has any activity in scope (ignores date/search)
    const people = buildFilters(req, { category: false, staff: false, date: false, search: false });
    const peopleRes = await pool.query(
      `
      SELECT DISTINCT a.performed_by AS id, s.name
      ${FROM_SQL}
      ${people.whereSql} AND a.performed_by IS NOT NULL AND s.name IS NOT NULL
      ORDER BY s.name ASC
      `,
      people.values
    );

    // Centre dropdown (superadmin only)
    let centres = [];
    if (req.user.role === "superadmin") {
      const centresRes = await pool.query(`SELECT id, name FROM centres ORDER BY name ASC`);
      centres = centresRes.rows;
    }

    const t = totalsRes.rows[0] || {};
    res.json({
      total: t.total || 0,
      byCategory: {
        all: t.total || 0,
        task: t.task || 0,
        service: t.service || 0,
        document: t.document || 0,
        team: t.team || 0,
      },
      tasksDone: t.tasks_done || 0,
      tasksCreated: t.tasks_created || 0,
      services: t.service || 0,
      documents: t.document || 0,
      mostActive: activeRes.rows,
      performers: peopleRes.rows,
      centres,
    });
  } catch (err) {
    console.error("Error fetching activity summary:", err);
    res.status(500).json({ error: "Failed to fetch activity summary" });
  }
});

/* =========================================================
   CREATE ACTIVITY (Internal Use)
   POST /api/activities
========================================================= */

router.post("/", authenticateToken, async (req, res) => {
  try {
    const { centre_id, related_type, related_id, action, description } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Action is required" });
    }

    // Chat messages are private and are not logged
    if (/message/i.test(action) || ["message", "chat_message", "chat"].includes(related_type)) {
      return res.status(204).end();
    }

    const result = await pool.query(
      `
      INSERT INTO activities
      (centre_id, related_type, related_id, action, description, performed_by, performed_by_role, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
      RETURNING *
      `,
      [
        centre_id || req.user.centre_id,
        related_type || null,
        related_id || null,
        action,
        description || null,
        req.user.id,
        req.user.role,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating activity:", err);
    res.status(500).json({ error: "Failed to create activity" });
  }
});

/* =========================================================
   DELETE ACTIVITY (Superadmin Only)
========================================================= */

router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    await pool.query(`DELETE FROM activities WHERE id = $1`, [req.params.id]);

    res.json({ message: "Activity deleted" });
  } catch (err) {
    console.error("Error deleting activity:", err);
    res.status(500).json({ error: "Failed to delete activity" });
  }
});

export default router;