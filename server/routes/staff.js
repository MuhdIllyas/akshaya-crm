import express from "express";
import bcrypt from "bcryptjs";
import pool from "../db.js";
import jwt from "jsonwebtoken";
import { logActivity } from "../utils/activityLogger.js";

const router = express.Router();

// ==============================================
// Middleware (case‑insensitive role check)
// ==============================================
export const authMiddleware = (allowedRoles) => async (req, res, next) => {
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

    // Normalize role to lowercase for comparison
    const userRole = result.rows[0].role.toLowerCase();
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

// ==============================================
// 1. SELF‑PROFILE ROUTES (must come before /:id)
// ==============================================

// Get logged‑in staff profile
router.get("/me", authMiddleware(["staff", "supervisor", "admin", "superadmin"]), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, name, role, department, email, phone, status,
        join_date AS "joinDate", photo, employee_id AS "employeeId",
        employment_type AS "employmentType", reports_to AS "reportsTo",
        salary, dob, gender, emergency_contact AS "emergencyContact",
        emergency_relationship AS "emergencyRelationship", centre_id AS "centreId",
        created_at
      FROM staff WHERE id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Staff not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching own profile:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update own profile
router.put("/me", authMiddleware(["staff", "supervisor", "admin", "superadmin"]), async (req, res) => {
  const { name, phone, emergencyContact, emergencyRelationship, photo } = req.body;
  try {
    const result = await pool.query(
      `UPDATE staff SET name = $1, phone = $2, emergency_contact = $3, emergency_relationship = $4, photo = $5
       WHERE id = $6 RETURNING id, username, name, role, department, email, phone, status,
         join_date AS "joinDate", photo, employee_id AS "employeeId",
         employment_type AS "employmentType", reports_to AS "reportsTo",
         salary, dob, gender, emergency_contact AS "emergencyContact",
         emergency_relationship AS "emergencyRelationship", centre_id AS "centreId"`,
      [name, phone, emergencyContact, emergencyRelationship, photo, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Staff not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating own profile:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// Change own password
router.post("/me/change-password", authMiddleware(["staff", "supervisor", "admin", "superadmin"]), async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const userResult = await pool.query("SELECT password FROM staff WHERE id = $1", [req.user.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: "User not found" });
    const match = await bcrypt.compare(currentPassword, userResult.rows[0].password);
    if (!match) return res.status(401).json({ error: "Current password is incorrect" });
    const hashedNew = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE staff SET password = $1 WHERE id = $2", [hashedNew, req.user.id]);
    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Password change error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==============================================
// 2. ADMIN/SUPERADMIN ROUTES (operate on other staff)
// ==============================================

// Add new staff member
router.post("/add", authMiddleware(["admin", "superadmin"]), async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      username,
      name,
      role,
      department,
      email,
      phone,
      status,
      joinDate,
      employeeId,
      employmentType,
      reportsTo,
      salary,
      dateOfBirth,
      gender,
      emergencyContact,
      emergencyRelationship,
      centre_id,
      photo,
      password,
      permissions,
      start_time,
      end_time,
      effective_from,
    } = req.body;

    if (!username || !name || !role || !email || !password) {
      return res.status(400).json({ error: "Username, name, role, email, and password are required" });
    }
    if (role !== "superadmin" && role !== "admin" && (!start_time || !end_time || !effective_from)) {
      return res.status(400).json({ error: "Start time, end time, and effective from date are required for non-superadmin roles" });
    }

    const centreId = req.user.role === "admin" ? req.user.centre_id : centre_id;
    if (!centreId && role !== "superadmin") {
      return res.status(400).json({ error: "Centre ID is required for non-superadmin roles" });
    }

    if (centreId) {
      const centreCheck = await client.query("SELECT id FROM centres WHERE id = $1", [centreId]);
      if (centreCheck.rows.length === 0) {
        return res.status(400).json({ error: "Invalid centre ID" });
      }
    }

    const existingUser = await client.query(
      "SELECT id FROM staff WHERE username = $1 OR email = $2",
      [username, email]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Username or email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await client.query("BEGIN");

    const staffResult = await client.query(
      `INSERT INTO staff (
        username, name, role, department, email, phone, status, join_date, photo,
        employee_id, employment_type, reports_to, salary, dob, gender,
        emergency_contact, emergency_relationship, centre_id, created_at, password,
        permissions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, NOW(), $19, $20)
      RETURNING id, username, name, role, department, email, phone, status,
        join_date AS "joinDate", photo, employee_id AS "employeeId",
        employment_type AS "employmentType", reports_to AS "reportsTo",
        salary, dob, gender, emergency_contact AS "emergencyContact",
        emergency_relationship AS "emergencyRelationship", centre_id AS "centreId",
        created_at`,
      [
        username, name, role, department || null, email, phone || null, status || "Active",
        joinDate || new Date().toISOString(), photo || null, employeeId || null,
        employmentType || null, reportsTo || null, salary || null, dateOfBirth || null,
        gender || null, emergencyContact || null, emergencyRelationship || null,
        centreId || null, hashedPassword, permissions || null,
      ]
    );

    const newStaff = staffResult.rows[0];

    if (start_time && end_time && effective_from && role !== "superadmin") {
      const [startHour, startMinute] = start_time.split(':').map(Number);
      const [endHour, endMinute] = end_time.split(':').map(Number);
      let standardHours = endHour - startHour + (endMinute - startMinute) / 60;
      if (standardHours < 0) standardHours += 24;
      await client.query(
        `INSERT INTO staff_schedules (staff_id, centre_id, start_time, end_time, standard_hours, effective_from, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [newStaff.id, centreId, start_time, end_time, standardHours, effective_from]
      );
    }

    await client.query(
      `INSERT INTO activity_log (staff_id, action, timestamp, details) VALUES ($1, $2, $3, $4)`,
      [req.user.id, "staff_created", new Date(), `Created staff: ${newStaff.username} (ID: ${newStaff.id})`]
    );

    if (role === "admin") {
      await client.query("UPDATE centres SET admin_id = $1 WHERE id = $2", [newStaff.id, centreId]);
    }

    await client.query("COMMIT");

    await logActivity({
      centre_id: centreId,
      related_type: 'staff',
      related_id: newStaff.id,
      action: 'Staff Added',
      description: `New staff member ${name} (${role}) added`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });

    res.status(201).json({ message: "Staff created successfully", staff: newStaff, password });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error adding staff:", err.message);
    if (err.code === "23505") return res.status(400).json({ error: "Username or email already exists" });
    if (err.code === "23502") return res.status(400).json({ error: `Missing required field: ${err.column}` });
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// Get all staff (for reportsTo dropdown and other uses)
router.get("/all", authMiddleware(["admin", "superadmin"]), async (req, res) => {
  try {
    const centreId = req.user.role === "admin" ? req.user.centre_id : req.query.centre_id;
    const roleFilter = req.query.role ? req.query.role.split(",") : null;
    let query = `
      SELECT 
        s.id, s.username, s.name, s.role, s.department, s.email, s.phone, s.status,
        s.join_date AS "joinDate", s.photo, s.employee_id AS "employeeId",
        s.employment_type AS "employmentType", s.reports_to AS "reportsTo",
        s.salary, s.dob, s.gender, s.emergency_contact AS "emergencyContact",
        s.emergency_relationship AS "emergencyRelationship", s.centre_id AS "centreId",
        s.created_at,
        ss.start_time, ss.end_time, ss.effective_from,
        COALESCE(
          (SELECT json_agg(activity)
           FROM (SELECT json_build_object('action', al.action, 'timestamp', al.timestamp, 'details', al.details) AS activity
                 FROM activity_log al WHERE al.staff_id = s.id ORDER BY al.timestamp DESC LIMIT 5) sub),
          '[]'::json
        ) AS recent_activity
      FROM staff s
      LEFT JOIN staff_schedules ss ON s.id = ss.staff_id 
        AND ss.effective_from = (SELECT effective_from FROM staff_schedules WHERE staff_id = s.id ORDER BY effective_from DESC LIMIT 1)
    `;
    const params = [];
    let conditions = [];

    if (centreId) {
      conditions.push(`s.centre_id = $${params.length + 1}`);
      params.push(Number(centreId));
    }
    if (roleFilter) {
      conditions.push(`s.role = ANY($${params.length + 1})`);
      params.push(roleFilter);
    }
    if (conditions.length) query += ` WHERE ${conditions.join(" AND ")}`;
    query += " ORDER BY s.join_date DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching staff:", err.message);
    res.status(500).json({ error: "Failed to fetch staff data" });
  }
});

// Change password for another user (admin / superadmin only)
router.post("/users/change-password", authMiddleware(["admin", "superadmin"]), async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;
  if (!username || !currentPassword || !newPassword) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const client = await pool.connect();
  try {
    const userResult = await client.query("SELECT password FROM staff WHERE username = $1", [username]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: "User not found" });
    const match = await bcrypt.compare(currentPassword, userResult.rows[0].password);
    if (!match) return res.status(401).json({ error: "Current password is incorrect" });
    const hashedNew = await bcrypt.hash(newPassword, 10);
    await client.query("UPDATE staff SET password = $1 WHERE username = $2", [hashedNew, username]);
    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Change password error:", err.message);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// ==============================================
// 3. GENERIC /:id ROUTES (must come after /me)
// ==============================================

// Get staff by ID
router.get("/:id", authMiddleware(["admin", "superadmin"]), async (req, res) => {
  const client = await pool.connect();
  const { id } = req.params;
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;

  try {
    const staffResult = await client.query(
      `SELECT id, username, name, role, department, email, phone, status,
        join_date AS "joinDate", photo, employee_id AS "employeeId",
        employment_type AS "employmentType", reports_to AS "reportsTo",
        salary, dob, gender, emergency_contact AS "emergencyContact",
        emergency_relationship AS "emergencyRelationship", centre_id AS "centreId",
        created_at
      FROM staff WHERE id = $1`,
      [id]
    );
    if (staffResult.rows.length === 0) return res.status(404).json({ error: "Staff not found" });
    const staffData = staffResult.rows[0];

    if (req.user.role === "admin") {
      const isDifferentCentre = Number(req.user.centre_id) !== Number(staffData.centreId);
      const isSuperadminTarget = staffData.role === "superadmin";
      if (isDifferentCentre || isSuperadminTarget) {
        return res.status(403).json({ error: "Unauthorized access to this staff profile" });
      }
    }

    const activityResult = await client.query(
      `SELECT action, timestamp, details FROM activity_log WHERE staff_id = $1 ORDER BY timestamp DESC LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );
    staffData.recentActivity = activityResult.rows;
    res.json(staffData);
  } catch (err) {
    console.error("Error fetching staff by ID:", err.message);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// Delete staff by ID
router.delete("/:id", authMiddleware(["admin", "superadmin"]), async (req, res) => {
  const client = await pool.connect();
  const { id } = req.params;
  try {
    await client.query("BEGIN");
    const staffResult = await client.query("SELECT centre_id, username, name FROM staff WHERE id = $1", [id]);
    if (staffResult.rows.length === 0) return res.status(404).json({ error: "Staff not found" });
    const staff = staffResult.rows[0];
    if (req.user.role === "admin" && req.user.centre_id !== staff.centre_id) {
      return res.status(403).json({ error: "Unauthorized to delete this staff member" });
    }
    await client.query(
      `INSERT INTO activity_log (staff_id, action, timestamp, details) VALUES ($1, $2, $3, $4)`,
      [req.user.id, "staff_deleted", new Date(), `Deleted staff: ${staff.username} (ID: ${id})`]
    );
    await client.query("DELETE FROM staff WHERE id = $1", [id]);
    await client.query("UPDATE centres SET admin_id = NULL WHERE admin_id = $1", [id]);
    await client.query("COMMIT");
    await logActivity({
      centre_id: staff.centre_id,
      related_type: 'staff',
      related_id: id,
      action: 'Staff Deleted',
      description: `Staff member ${staff.name} (${staff.username}) removed`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });
    res.json({ message: "Staff deleted successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting staff:", err.message);
    res.status(500).json({ error: "Failed to delete staff" });
  } finally {
    client.release();
  }
});

// Get staff schedule by ID
router.get("/schedule/:id", authMiddleware(["admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;
  const client = await pool.connect();
  try {
    const staffCheck = await client.query("SELECT role, centre_id FROM staff WHERE id = $1", [id]);
    if (staffCheck.rows.length === 0) return res.status(404).json({ error: "Staff not found" });
    const { role, centre_id } = staffCheck.rows[0];
    if (req.user.role === "admin" && req.user.centre_id !== centre_id) {
      return res.status(403).json({ error: "Unauthorized to access this staff member's schedule" });
    }
    if (role === "superadmin") return res.json({});
    const result = await client.query(
      `SELECT start_time, end_time, standard_hours, effective_from::text
       FROM staff_schedules
       WHERE staff_id = $1 AND effective_from <= $2 AND (effective_to IS NULL OR effective_to >= $2)
       ORDER BY effective_from DESC LIMIT 1`,
      [id, date || new Date().toISOString().split("T")[0]]
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error("Error fetching staff schedule:", err.message);
    res.status(500).json({ error: "Failed to fetch staff schedule" });
  } finally {
    client.release();
  }
});

// Update staff by ID
router.put("/:id", authMiddleware(["admin", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const {
    username, name, role, department, email, phone, status, joinDate, photo,
    employeeId, employmentType, reportsTo, salary, dateOfBirth, gender,
    emergencyContact, emergencyRelationship, centre_id, permissions,
    start_time, end_time, effective_from,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const staffCheck = await client.query("SELECT id, centre_id, role FROM staff WHERE id = $1", [id]);
    if (staffCheck.rows.length === 0) return res.status(404).json({ error: "Staff not found" });
    const existingStaff = staffCheck.rows[0];

    if (req.user.role === "admin") {
      const isDifferentCentre = Number(req.user.centre_id) !== Number(existingStaff.centre_id);
      const isSuperadminTarget = existingStaff.role === "superadmin";
      if (isDifferentCentre || isSuperadminTarget) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Unauthorized access: You cannot edit this staff member" });
      }
    }

    const targetCentreId = req.user.role === "admin" ? req.user.centre_id : centre_id;
    if (!targetCentreId && role !== "superadmin") {
      return res.status(400).json({ error: "Centre ID is required" });
    }
    if (!username || !name || !role || !email) {
      return res.status(400).json({ error: "Username, name, role, and email are required" });
    }
    if (role !== "superadmin" && (!start_time || !end_time || !effective_from)) {
      return res.status(400).json({ error: "Schedule details are required" });
    }

    const result = await client.query(
      `UPDATE staff SET username=$1, name=$2, role=$3, department=$4, email=$5, phone=$6, status=$7,
        join_date=$8, photo=$9, employee_id=$10, employment_type=$11, reports_to=$12,
        salary=$13, dob=$14, gender=$15, emergency_contact=$16, emergency_relationship=$17,
        centre_id=$18, permissions=$19 WHERE id=$20
      RETURNING id, username, name, role, department, email, phone, status,
        join_date AS "joinDate", photo, employee_id AS "employeeId",
        employment_type AS "employmentType", reports_to AS "reportsTo",
        salary, dob, gender, emergency_contact AS "emergencyContact",
        emergency_relationship AS "emergencyRelationship", centre_id AS "centreId",
        created_at`,
      [
        username, name, role, department || null, email, phone || null, status || "Active",
        joinDate || new Date().toISOString(), photo || null, employeeId || null,
        employmentType || null, reportsTo || null, salary || null, dateOfBirth || null,
        gender || null, emergencyContact || null, emergencyRelationship || null,
        targetCentreId || null, permissions || null, id
      ]
    );

    const updatedStaff = result.rows[0];

    if (start_time && end_time && effective_from && role !== "superadmin") {
      const [startHour, startMinute] = start_time.split(':').map(Number);
      const [endHour, endMinute] = end_time.split(':').map(Number);
      let standardHours = endHour - startHour + (endMinute - startMinute) / 60;
      if (standardHours < 0) standardHours += 24;
      const existingSchedule = await client.query(
        `SELECT id FROM staff_schedules WHERE staff_id = $1 AND effective_from = $2`,
        [id, effective_from]
      );
      if (existingSchedule.rows.length > 0) {
        await client.query(
          `UPDATE staff_schedules SET start_time=$1, end_time=$2, standard_hours=$3, updated_at=NOW()
           WHERE staff_id=$4 AND effective_from=$5`,
          [start_time, end_time, standardHours, id, effective_from]
        );
      } else {
        await client.query(
          `INSERT INTO staff_schedules (staff_id, centre_id, start_time, end_time, standard_hours, effective_from, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [id, targetCentreId, start_time, end_time, standardHours, effective_from]
        );
      }
    }

    await client.query(
      `INSERT INTO activity_log (staff_id, action, timestamp, details) VALUES ($1, $2, $3, $4)`,
      [req.user.id, "staff_updated", new Date(), `Updated staff: ${username} (ID: ${id})`]
    );

    if (role === "admin") {
      await client.query("UPDATE centres SET admin_id = $1 WHERE id = $2", [id, targetCentreId]);
    } else {
      await client.query("UPDATE centres SET admin_id = NULL WHERE admin_id = $1", [id]);
    }

    await client.query("COMMIT");

    await logActivity({
      centre_id: targetCentreId || existingStaff.centre_id,
      related_type: 'staff',
      related_id: id,
      action: 'Staff Updated',
      description: `Staff member ${name} (${role}) information updated`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });

    res.status(200).json({ message: "Staff updated successfully", staff: updatedStaff });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update failed:", err.message);
    if (err.code === "23505") return res.status(400).json({ error: "Username or email already exists" });
    res.status(500).json({ error: "Failed to update staff" });
  } finally {
    client.release();
  }
});

export default router;
