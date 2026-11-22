// UPI payments caught by the companion phone (see services/upiCredits.js).
// Staff see their own centre's payments; a superadmin without a centre sees all
// (or one centre with ?centre_id=).
import express from "express";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import { io } from "../tenancy/io.js";
import { scheduleForEachOrg } from "../tenancy/jobs.js";

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

const isManager = (user) => ["admin", "superadmin"].includes(user.role);

const centreScope = (req, params) => {
  const { user } = req;
  if (user.role === "superadmin" && !user.centre_id) {
    const c = parseInt(req.query.centre_id, 10);
    if (Number.isNaN(c)) return "";
    params.push(c);
    return ` AND u.centre_id = $${params.length}`;
  }
  params.push(user.centre_id ?? -1);
  return ` AND u.centre_id = $${params.length}`;
};

const TODAY = `u.credited_at >= (date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`;

/**
 * GET /api/upi-credits
 *   ?status=unclaimed|matched|ignored|all   (default: all)
 *   ?wallet_id=12
 *   ?window=today|7d|30d                    (default: today)
 *   ?unassigned=1   admins: payments that matched no wallet (to set wallets up)
 */
router.get("/", async (req, res) => {
  try {
    const params = [];
    let where = centreScope(req, params);

    const window = req.query.window;
    if (window === "7d") where += ` AND u.credited_at > NOW() - INTERVAL '7 days'`;
    else if (window === "30d") where += ` AND u.credited_at > NOW() - INTERVAL '30 days'`;
    else where += ` AND ${TODAY}`;

    if (req.query.unassigned === "1") {
      if (!isManager(req.user)) return res.status(403).json({ error: "Only admins can see this" });
      where += ` AND u.wallet_id IS NULL`;
    } else {
      where += ` AND u.wallet_id IS NOT NULL`;
    }

    const status = req.query.status;
    if (["unclaimed", "matched", "ignored"].includes(status)) {
      params.push(status);
      where += ` AND u.status = $${params.length}`;
    }

    const walletId = parseInt(req.query.wallet_id, 10);
    if (!Number.isNaN(walletId)) {
      params.push(walletId);
      where += ` AND u.wallet_id = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT u.id, u.centre_id, c.name AS centre_name, u.wallet_id, w.name AS wallet_name,
              u.source, u.amount::float AS amount, u.payer, u.utr, u.account_last4,
              u.credited_at, u.status, u.matched_payment_id, u.matched_at,
              ${isManager(req.user) ? "u.raw_text," : ""} u.created_at
         FROM upi_credits u
         LEFT JOIN wallets w ON w.id = u.wallet_id
         LEFT JOIN centres c ON c.id = u.centre_id
        WHERE TRUE${where}
        ORDER BY u.credited_at DESC
        LIMIT 500`,
      params
    );

    const summary = rows.reduce(
      (s, r) => {
        s.count += 1;
        s.total += r.amount;
        if (r.status === "unclaimed") { s.unclaimed += 1; s.unclaimed_total += r.amount; }
        return s;
      },
      { count: 0, total: 0, unclaimed: 0, unclaimed_total: 0 }
    );

    res.json({ credits: rows, summary });
  } catch (err) {
    console.error("UPI credits list error:", err.message);
    res.status(500).json({ error: "Failed to load UPI payments" });
  }
});

/**
 * POST /api/upi-credits/:id/ignore   { ignore: true|false }
 * Admins mark a credit as not a customer payment (own transfer, refund…), or undo.
 */
router.post("/:id/ignore", async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ error: "Only admins can do this" });
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const ignore = req.body?.ignore !== false;
  try {
    const params = [id];
    const scope = centreScope({ ...req, query: {} }, params);
    const { rows } = await pool.query(
      `UPDATE upi_credits u
          SET status = $${params.length + 1}, matched_by = $${params.length + 2}, matched_at = NOW()
        WHERE u.id = $1 AND u.status <> 'matched'${scope}
        RETURNING u.id, u.centre_id, u.status`,
      [...params, ignore ? "ignored" : "unclaimed", req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Payment not found, or already linked to an entry" });
    io.to(`centre:${rows[0].centre_id}`).emit("centre_upi_credit_updated", rows[0]);
    res.json(rows[0]);
  } catch (err) {
    console.error("UPI credit ignore error:", err.message);
    res.status(500).json({ error: "Failed to update payment" });
  }
});

// Raw UPI app notifications are only kept to check the parser: 30 days.
scheduleForEachOrg("27 3 * * *", async () => {
  await pool.query(`DELETE FROM companion_notification_logs WHERE received_at < NOW() - INTERVAL '30 days'`);
}, { timezone: "Asia/Kolkata" });

export default router;
