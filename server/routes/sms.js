// SMS forwarded by the companion phone: the live OTPs for the top bar and the
// history on Notifications → OTPs. Staff see their own centre's messages.
import express from "express";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import { OTP_LIVE_MINUTES } from "../utils/smsOtp.js";

const router = express.Router();

router.use((req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err || user?.type === "device" || user?.role === "customer") {
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = user;
    next();
  });
});

// A superadmin without a centre sees every centre; everyone else only their own.
const centreScope = (user, params) => {
  if (user.role === "superadmin" && !user.centre_id) return "";
  params.push(user.centre_id);
  return ` AND l.centre_id = $${params.length}`;
};

const SELECT = `
  SELECT l.id, l.centre_id, c.name AS centre_name, l.sender, l.message, l.is_otp,
         l.otp_code AS code, l.received_at,
         l.received_at > NOW() - make_interval(mins => ${OTP_LIVE_MINUTES}) AS is_live
    FROM companion_sms_logs l
    LEFT JOIN centres c ON c.id = l.centre_id
   WHERE l.received_at IS NOT NULL`;

/** GET /api/sms/otps/live — OTPs still inside their live window, newest first. */
router.get("/otps/live", async (req, res) => {
  try {
    const params = [];
    const scope = centreScope(req.user, params);
    const { rows } = await pool.query(
      `${SELECT} AND l.is_otp = TRUE
         AND l.received_at > NOW() - make_interval(mins => ${OTP_LIVE_MINUTES})${scope}
       ORDER BY l.received_at DESC LIMIT 20`,
      params
    );
    res.json({ otps: rows, live_minutes: OTP_LIVE_MINUTES });
  } catch (err) {
    console.error("Live OTPs error:", err.message);
    res.status(500).json({ error: "Failed to load OTPs" });
  }
});

/**
 * GET /api/sms/history?type=otp|all&days=7&q=&limit=200
 * Recent SMS for the Notifications → OTPs tab. No read/unread state.
 */
router.get("/history", async (req, res) => {
  try {
    const params = [];
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 500);
    let where = ` AND l.received_at > NOW() - make_interval(days => ${days})`;
    if (req.query.type !== "all") where += " AND l.is_otp = TRUE";
    where += centreScope(req.user, params);
    const q = String(req.query.q || "").trim();
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (l.sender ILIKE $${params.length} OR l.message ILIKE $${params.length})`;
    }
    const { rows } = await pool.query(
      `${SELECT}${where} ORDER BY l.received_at DESC LIMIT ${limit}`,
      params
    );
    res.json({ messages: rows, live_minutes: OTP_LIVE_MINUTES });
  } catch (err) {
    console.error("SMS history error:", err.message);
    res.status(500).json({ error: "Failed to load SMS history" });
  }
});

export default router;
