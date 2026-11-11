import express from "express";
import pool from "../db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { currentTenant } from "../tenancy/context.js";

const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
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
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const user = result.rows[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

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
      org_slug: currentTenant().slug
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