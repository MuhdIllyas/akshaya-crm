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
   GET ACTIVITIES (Pagination + Scope Control)
   GET /api/activities?page=1&limit=20
========================================================= */

router.get("/", authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        a.*,
        c.name AS centre_name,
        s.name AS performer_name
      FROM activities a
      LEFT JOIN centres c ON a.centre_id = c.id
      LEFT JOIN staff s ON a.performed_by = s.id
    `;

    let values = [];

    // Superadmin → see all activities
    if (req.user.role !== "superadmin") {
      query += ` WHERE a.centre_id = $1 `;
      values.push(req.user.centre_id);
    }

    query += `
      ORDER BY a.created_at DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    values.push(limit);
    values.push(offset);

    const result = await pool.query(query, values);

    res.json(result.rows);

  } catch (err) {
    console.error("Error fetching activities:", err);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
});

/* =========================================================
   CREATE ACTIVITY (Internal Use)
   POST /api/activities
========================================================= */

router.post("/", authenticateToken, async (req, res) => {
  try {
    const {
      centre_id,
      related_type,
      related_id,
      action,
      description
    } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Action is required" });
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
        req.user.role
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error("Error creating activity:", err);
    res.status(500).json({ error: "Failed to create activity" });
  }
});

/* =========================================================
   DELETE ACTIVITY (Optional - Superadmin Only)
========================================================= */

router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    await pool.query(
      `DELETE FROM activities WHERE id = $1`,
      [req.params.id]
    );

    res.json({ message: "Activity deleted" });

  } catch (err) {
    console.error("Error deleting activity:", err);
    res.status(500).json({ error: "Failed to delete activity" });
  }
});

export default router;