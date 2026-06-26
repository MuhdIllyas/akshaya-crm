import express from "express";
import bcrypt from "bcryptjs";
import pool from "../db.js";
import jwt from "jsonwebtoken";

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

router.get('/communication-accounts', authenticateToken, async (req, res) => {
  try {
    // Superadmins can see all accounts. You might want to filter this based on role later.
    const result = await pool.query(
      `SELECT id, name, phone_number FROM communication_accounts WHERE is_active = true ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;