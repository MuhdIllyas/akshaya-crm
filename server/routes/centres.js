import express from "express";
import pool from "../db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const router = express.Router();

// Middleware to verify token and role
const authMiddleware = (allowedRoles) => async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    console.log("Auth middleware: No token provided");
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query("SELECT role, centre_id FROM staff WHERE id = $1", [decoded.id]);
    if (result.rows.length === 0) {
      console.log(`Auth middleware: User not found for ID ${decoded.id}`);
      return res.status(401).json({ error: "User not found" });
    }

    const userRole = result.rows[0].role;
    if (!allowedRoles.includes(userRole)) {
      console.log(`Auth middleware: Role ${userRole} not allowed. Required: ${allowedRoles}`);
      return res.status(403).json({ error: "Unauthorized access" });
    }

    req.user = decoded;
    req.user.centre_id = result.rows[0].centre_id;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

// GET /api/centres
router.get("/", authMiddleware(["superadmin"]), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.created_by, s1.name AS created_by_name,
             c.admin_id, s2.name AS admin_name
      FROM centres c
      LEFT JOIN staff s1 ON c.created_by = s1.id
      LEFT JOIN staff s2 ON c.admin_id = s2.id
      ORDER BY c.id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching centres:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/centres/:id
router.get("/:id", authMiddleware(["admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.created_by, s1.name AS created_by_name,
             c.admin_id, s2.name AS admin_name
      FROM centres c
      LEFT JOIN staff s1 ON c.created_by = s1.id
      LEFT JOIN staff s2 ON c.admin_id = s2.id
      WHERE c.id = $1
    `, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Centre not found" });
    }

    if (req.user.role === "admin" && req.user.centre_id !== parseInt(id)) {
      return res.status(403).json({ error: "Unauthorized to access this centre" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching centre:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/centres/:id/staff
router.get("/:id/staff", authMiddleware(["admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;

  try {
    const centreResult = await pool.query(`
      SELECT c.id, c.name, c.created_by, s1.name AS created_by_name,
             c.admin_id, s2.name AS admin_name
      FROM centres c
      LEFT JOIN staff s1 ON c.created_by = s1.id
      LEFT JOIN staff s2 ON c.admin_id = s2.id
      WHERE c.id = $1
    `, [id]);

    if (centreResult.rows.length === 0) {
      return res.status(404).json({ error: "Centre not found" });
    }

    if (req.user.role === "admin" && req.user.centre_id !== parseInt(id)) {
      return res.status(403).json({ error: "Unauthorized to access this centre" });
    }

    const staffResult = await pool.query(`
      SELECT s.id, s.username, s.name, s.role, s.department, s.email, s.phone,
             s.status, s.join_date, s.photo, s.employee_id, s.employment_type,
             s.reports_to, s2.name AS reports_to_name, s.salary, s.dob, s.gender,
             s.emergency_contact, s.emergency_relationship
      FROM staff s
      LEFT JOIN staff s2 ON s.reports_to = s2.id
      WHERE s.centre_id = $1
      ORDER BY s.id
    `, [id]);

    res.json({
      centre: centreResult.rows[0],
      staff: staffResult.rows
    });
  } catch (err) {
    console.error("Error fetching centre staff:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/centres
router.post("/", authMiddleware(["superadmin"]), async (req, res) => {
  const { name, admin_id } = req.body;
  console.log("POST /api/centres request body:", req.body);
  if (!name) {
    return res.status(400).json({ error: "Centre name is required" });
  }

  try {
    if (admin_id) {
      const adminCheck = await pool.query("SELECT id, name FROM staff WHERE id = $1 AND role = $2", [admin_id, "admin"]);
      if (adminCheck.rows.length === 0) {
        return res.status(400).json({ error: "Invalid admin ID" });
      }
    }

    const result = await pool.query(
      "INSERT INTO centres (name, created_by, admin_id) VALUES ($1, $2, $3) RETURNING *",
      [name, req.user.id, admin_id || null]
    );
    const centre = result.rows[0];
    const createdByResult = await pool.query("SELECT name FROM staff WHERE id = $1", [centre.created_by]);
    const adminResult = centre.admin_id ? await pool.query("SELECT name FROM staff WHERE id = $1", [centre.admin_id]) : null;
    res.status(201).json({
      message: "Centre created successfully",
      centre: {
        ...centre,
        created_by_name: createdByResult.rows[0]?.name || null,
        admin_name: adminResult?.rows[0]?.name || null
      }
    });
  } catch (err) {
    console.error("Error creating centre:", err.message);
    if (err.code === "23505") {
      return res.status(400).json({ error: "Centre name already exists" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/centres/:id
router.put("/:id", authMiddleware(["superadmin"]), async (req, res) => {
  const { id } = req.params;
  const { name, admin_id } = req.body;
  console.log("PUT /api/centres/:id request body:", req.body);

  try {
    const centreCheck = await pool.query("SELECT id FROM centres WHERE id = $1", [id]);
    if (centreCheck.rows.length === 0) {
      return res.status(404).json({ error: "Centre not found" });
    }

    if (admin_id) {
      const adminCheck = await pool.query("SELECT id, name FROM staff WHERE id = $1 AND role = $2", [admin_id, "admin"]);
      if (adminCheck.rows.length === 0) {
        return res.status(400).json({ error: "Invalid admin ID" });
      }
    }

    const result = await pool.query(
      "UPDATE centres SET name = COALESCE($1, name), admin_id = COALESCE($2, admin_id) WHERE id = $3 RETURNING *",
      [name, admin_id, id]
    );
    const centre = result.rows[0];
    const createdByResult = await pool.query("SELECT name FROM staff WHERE id = $1", [centre.created_by]);
    const adminResult = centre.admin_id ? await pool.query("SELECT name FROM staff WHERE id = $1", [centre.admin_id]) : null;
    res.json({
      message: "Centre updated successfully",
      centre: {
        ...centre,
        created_by_name: createdByResult.rows[0]?.name || null,
        admin_name: adminResult?.rows[0]?.name || null
      }
    });
  } catch (err) {
    console.error("Error updating centre:", err.message);
    if (err.code === "23505") {
      return res.status(400).json({ error: "Centre name already exists" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/centres/:id
router.delete("/:id", authMiddleware(["superadmin"]), async (req, res) => {
  const { id } = req.params;
  console.log(`DELETE /api/centres/${id} requested`);

  try {
    const centreCheck = await pool.query("SELECT id, name, created_by, admin_id FROM centres WHERE id = $1", [id]);
    if (centreCheck.rows.length === 0) {
      return res.status(404).json({ error: "Centre not found" });
    }
    const centre = centreCheck.rows[0];
    const createdByResult = await pool.query("SELECT name FROM staff WHERE id = $1", [centre.created_by]);
    const adminResult = centre.admin_id ? await pool.query("SELECT name FROM staff WHERE id = $1", [centre.admin_id]) : null;

    const result = await pool.query("DELETE FROM centres WHERE id = $1 RETURNING *", [id]);
    res.json({
      message: "Centre deleted successfully",
      centre: {
        ...result.rows[0],
        created_by_name: createdByResult.rows[0]?.name || null,
        admin_name: adminResult?.rows[0]?.name || null
      }
    });
  } catch (err) {
    console.error("Error deleting centre:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;