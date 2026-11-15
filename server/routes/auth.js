import express from "express";
import pool from "../db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { currentTenant } from "../tenancy/context.js";
import { authMiddleware } from "./staff.js";
import { LOCK_MINUTES, isLocked, previousSignIn, recordSignIn } from "../utils/staffLogins.js";

const router = express.Router();

/*
 * GET /api/auth/sign-ins  (superadmin: everyone; admin: their centre's staff)
 *   ?staff_id=<id>  one person    ?failed=1  wrong passwords only
 *   ?limit=<1–200>  ?before=<id>  older entries (paging)
 */
router.get("/sign-ins", authMiddleware(["admin", "superadmin"]), async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const staffId = req.query.staff_id ? Number(req.query.staff_id) : null;
  const before = req.query.before ? Number(req.query.before) : null;
  const failedOnly = req.query.failed === "1";
  const isAdmin = req.user.role === "admin";
  try {
    const { rows } = await pool.query(
      `SELECT l.id, l.staff_id, l.username, l.success, l.ip, l.user_agent, l.created_at,
              s.name AS staff_name, s.role AS staff_role, c.name AS centre_name
         FROM staff_logins l
         LEFT JOIN staff s ON s.id = l.staff_id
         LEFT JOIN centres c ON c.id = s.centre_id
        WHERE ($1::int IS NULL OR l.staff_id = $1)
          AND ($2::boolean = false OR l.success = false)
          AND ($3::int IS NULL OR l.id < $3)
          AND ($4::int IS NULL OR s.centre_id = $4)
        ORDER BY l.id DESC
        LIMIT $5`,
      [staffId, failedOnly, before, isAdmin ? req.user.centre_id : null, limit]
    );
    res.json(rows);
  } catch (err) {
    if (err.code === "42P01") return res.json([]); // migration not applied yet
    console.error("sign-ins error:", err.message);
    res.status(500).json({ error: "Couldn't load the sign-in history" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    // Too many wrong passwords for this username recently: refuse for a while.
    if (await isLocked(username)) {
      return res.status(429).json({
        error: `Too many wrong passwords. This account is locked for ${LOCK_MINUTES} minutes. Ask your admin if you've forgotten your password.`,
      });
    }

    // LEFT JOIN so superadmin (no centre) still logs in
    const result = await pool.query(
      `SELECT s.id, s.name, s.username, s.password, s.role, s.centre_id, s.photo,
              c.name AS centre_name
         FROM staff s
         LEFT JOIN centres c ON c.id = s.centre_id
        WHERE s.username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      await recordSignIn(req, { username, success: false });
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const user = result.rows[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await recordSignIn(req, { staffId: user.id, username, success: false });
      return res.status(401).json({ error: "Invalid username or password" });
    }
    await recordSignIn(req, { staffId: user.id, username, success: true });

    // Generate JWT
    const token = jwt.sign(
      // `org` ties the token to this organization's database (see tenancy/middleware.js).
      { id: user.id, username: user.username, role: user.role, centre_id: user.centre_id, org: currentTenant().slug },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      centre_id: user.centre_id || null,
      centre_name: user.centre_name || null,
      photo: user.photo || null,
      org_slug: currentTenant().slug,
      // Shown as "Last sign-in" so staff notice if someone else used their account.
      previous_sign_in: await previousSignIn(user.id),
    });
  } catch (err) {
    console.error("Login error:", err.message, err.stack);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/verify
router.get("/verify", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    console.warn("Verify endpoint: No token provided");
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      `SELECT s.id, s.name, s.username, s.role, s.centre_id, s.photo,
              c.name AS centre_name
         FROM staff s
         LEFT JOIN centres c ON c.id = s.centre_id
        WHERE s.id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      console.warn(`Verify endpoint: User not found for ID ${decoded.id}`);
      return res.status(401).json({ error: "User not found" });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      centre_id: user.centre_id || null,
      centre_name: user.centre_name || null,
      photo: user.photo || null
    });
  } catch (err) {
    console.error("Token verification error:", err.message, err.stack);
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    } else if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;