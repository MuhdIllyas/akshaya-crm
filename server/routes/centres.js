import express from "express";
import pool from "../db.js";
import jwt from "jsonwebtoken";
import multer from "multer"; 
import path from "path";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// Middleware to verify token and role
const authMiddleware = (allowedRoles) => async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query("SELECT role, centre_id FROM staff WHERE id = $1", [decoded.id]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const userRole = result.rows[0].role;
    if (!allowedRoles.includes(userRole)) {
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
             c.admin_id, s2.name AS admin_name, c.communication_account_id,
             c.address, c.district, c.state, c.pincode, c.latitude, 
             c.longitude, c.google_place_id, c.working_hours, c.phone, c.email, c.logo
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
router.get("/:id", authMiddleware(["staff" ,"admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.created_by, s1.name AS created_by_name,
             c.admin_id, s2.name AS admin_name, c.communication_account_id,
             c.address, c.district, c.state, c.pincode, c.latitude, 
             c.longitude, c.google_place_id, c.working_hours, c.phone, c.email, c.logo
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
router.get("/:id/staff", authMiddleware(["staff" , "admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;

  try {
    const centreResult = await pool.query(`
      SELECT c.id, c.name, c.created_by, s1.name AS created_by_name,
             c.admin_id, s2.name AS admin_name, c.communication_account_id,
             c.address, c.district, c.state, c.pincode, c.latitude, 
             c.longitude, c.google_place_id, c.working_hours, c.phone, c.email, c.logo
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
router.post("/", authMiddleware(["superadmin"]), upload.single("logo"), async (req, res) => {
  const { 
    name, admin_id, communication_account_id, address, district, state, 
    pincode, latitude, longitude, google_place_id, working_hours, phone, email 
  } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: "Centre name is required" });
  }

  const logoPath = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    if (admin_id) {
      const adminCheck = await pool.query("SELECT id, name FROM staff WHERE id = $1 AND role = $2", [admin_id, "admin"]);
      if (adminCheck.rows.length === 0) {
        return res.status(400).json({ error: "Invalid admin ID" });
      }
    }

    const result = await pool.query(
      `INSERT INTO centres (
        name, created_by, admin_id, communication_account_id, address, district, state, 
        pincode, latitude, longitude, google_place_id, working_hours, phone, email, logo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [
        name, req.user.id, admin_id || null, communication_account_id || null, address, district, state, 
        pincode, latitude, longitude, google_place_id, working_hours, phone, email, logoPath
      ]
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
router.put("/:id", authMiddleware(["superadmin"]), upload.single("logo"), async (req, res) => {
  const { id } = req.params;
  const { 
    name, admin_id, communication_account_id, address, district, state, 
    pincode, latitude, longitude, google_place_id, working_hours, phone, email 
  } = req.body;

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

    // Dynamically build the update query to avoid overwriting the logo if a new one isn't uploaded
    let updateQuery = `
      UPDATE centres 
      SET name = COALESCE($1, name), 
          admin_id = $2,
          communication_account_id = $3,
          address = $4,
          district = $5,
          state = $6,
          pincode = $7,
          latitude = $8,
          longitude = $9,
          google_place_id = $10,
          working_hours = $11,
          phone = $12,
          email = $13
    `;
    
    const params = [
      name, admin_id || null, communication_account_id || null, 
      address, district, state, pincode, latitude, longitude, 
      google_place_id, working_hours, phone, email
    ];

    if (req.file) {
      updateQuery += `, logo = $14`;
      params.push(`/uploads/${req.file.filename}`);
    }

    updateQuery += ` WHERE id = $${params.length + 1} RETURNING *`;
    params.push(id);

    const result = await pool.query(updateQuery, params);
    
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