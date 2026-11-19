// SMS forwarded by the companion phone: the live OTPs for the top bar and the
// Notifications → OTPs tab. Staff see their own centre's OTPs.
//
// OTPs are useless a few minutes after they arrive, so they are not kept:
// each one is live for OTP_LIVE_MINUTES, and is deleted OTP_KEEP_HOURS later.
import express from "express";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import { io } from "../tenancy/io.js";
import { scheduleForEachOrg } from "../tenancy/jobs.js";
import { OTP_LIVE_MINUTES, OTP_KEEP_HOURS } from "../utils/smsOtp.js";

const router = express.Router();

router.use((req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err || user?.type === "device" || user?.role === "customer") {
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = { ...user, role: String(user.role || "").toLowerCase() };
    next();
  });
});

// A superadmin without a centre sees every centre; everyone else only their own.
const centreScope = (user, params) => {
  if (user.role === "superadmin" && !user.centre_id) return "";
  params.push(user.centre_id);
  return ` AND l.centre_id = $${params.length}`;
};

const LIVE = `l.received_at > NOW() - make_interval(mins => ${OTP_LIVE_MINUTES})`;
const TODAY = `l.received_at >= (date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`;

const SELECT = `
  SELECT l.id, l.centre_id, c.name AS centre_name, l.sender, l.message, l.is_otp,
         l.otp_code AS code, l.received_at, ${LIVE} AS is_live
    FROM companion_sms_logs l
    LEFT JOIN centres c ON c.id = l.centre_id
   WHERE l.is_otp = TRUE AND l.received_at IS NOT NULL`;

const listOtps = async (user, window) => {
  const params = [];
  const scope = centreScope(user, params);
  const { rows } = await pool.query(
    `${SELECT} AND ${window === "today" ? TODAY : LIVE}${scope}
     ORDER BY l.received_at DESC LIMIT 200`,
    params
  );
  return rows;
};

/** GET /api/sms/otps/live — OTPs still inside their live window (top bar). */
router.get("/otps/live", async (req, res) => {
  try {
    res.json({ otps: await listOtps(req.user, "live"), live_minutes: OTP_LIVE_MINUTES });
  } catch (err) {
    console.error("Live OTPs error:", err.message);
    res.status(500).json({ error: "Failed to load OTPs" });
  }
});

/** GET /api/sms/otps?window=live|today — the Notifications → OTPs tab. */
router.get("/otps", async (req, res) => {
  try {
    const window = req.query.window === "today" ? "today" : "live";
    res.json({ otps: await listOtps(req.user, window), live_minutes: OTP_LIVE_MINUTES });
  } catch (err) {
    console.error("OTP list error:", err.message);
    res.status(500).json({ error: "Failed to load OTPs" });
  }
});

/**
 * DELETE /api/sms/otps — admins clear their centre's OTPs now (everyone's view,
 * since OTPs are shared by the centre). Other SMS are kept.
 */
router.delete("/otps", async (req, res) => {
  if (!["admin", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({ error: "Only admins can clear OTPs" });
  }
  try {
    const params = [];
    const scope = centreScope(req.user, params);
    const { rowCount } = await pool.query(`DELETE FROM companion_sms_logs l WHERE l.is_otp = TRUE${scope}`, params);
    const payload = { centre_id: req.user.centre_id ?? null };
    if (req.user.role === "superadmin" && !req.user.centre_id) io.emit("centre_otps_cleared", payload);
    else io.to(`centre:${req.user.centre_id}`).emit("centre_otps_cleared", payload);
    res.json({ cleared: rowCount });
  } catch (err) {
    console.error("Clear OTPs error:", err.message);
    res.status(500).json({ error: "Failed to clear OTPs" });
  }
});

// Every hour, delete OTPs older than OTP_KEEP_HOURS in every organization.
scheduleForEachOrg("17 * * * *", async () => {
  await pool.query(
    `DELETE FROM companion_sms_logs
      WHERE is_otp = TRUE AND received_at < NOW() - make_interval(hours => ${OTP_KEEP_HOURS})`
  );
}, { timezone: "Asia/Kolkata" });

export default router;
