import express from "express";
import pool from "../db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const result = await pool.query(
      "SELECT id, username, password, role, centre_id FROM staff WHERE username = $1",
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
      { id: user.id, username: user.username, role: user.role, centre_id: user.centre_id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      id: user.id,
      username: user.username,
      role: user.role,
      centre_id: user.centre_id || null
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
      "SELECT id, username, role, centre_id FROM staff WHERE id = $1",
      [decoded.id]
    );

    if (result.rows.length === 0) {
      console.warn(`Verify endpoint: User not found for ID ${decoded.id}`);
      return res.status(401).json({ error: "User not found" });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      centre_id: user.centre_id || null
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