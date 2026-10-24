import express from "express";
import jwt from "jsonwebtoken";
import pool from "../../db.js";
// Keep this path pointing at wherever you saved the new walletDailyBalanceService.js
import { regenerateDailyBalancesFrom } from "../walletDailyBalanceService.js";
import { isYMD, todayIST } from "../../utils/dates.js";

const router = express.Router();

/* ================================
   AUTH MIDDLEWARE (read-only)
================================ */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  const allowedRoles = ["admin", "superadmin"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

router.use(authenticateToken);

/* Which centre a request may see.
   Superadmin: ?centreId=… for one centre, or null = all centres.
   Everyone else: always their own centre (query param ignored). */
const scopeCentre = (req) => {
  if (req.user.role === "superadmin") {
    const id = parseInt(req.query.centreId, 10);
    return Number.isNaN(id) ? null : id;
  }
  return req.user.centre_id;
};

/* from/to must be YYYY-MM-DD; swapped if reversed. Returns null if invalid. */
const readRange = (req) => {
  let { from, to } = req.query;
  if (!isYMD(from) || !isYMD(to)) return null;
  if (from > to) [from, to] = [to, from];
  return { from, to };
};

/* ======================================================
   1. WALLET SUMMARY REPORT
   OPENING / CREDIT / DEBIT / CLOSING
   FIX: opening = first day's opening, closing = last day's closing.
   (Old MIN(opening)/MAX(closing) gave the lowest/highest value in the range,
   not the start/end — wrong whenever a balance went down and up again.)
====================================================== */
router.get("/wallets/summary", async (req, res) => {
  try {
    const range = readRange(req);
    if (!range) {
      return res.status(400).json({
        error: "from and to dates are required (YYYY-MM-DD)",
      });
    }
    const centreId = scopeCentre(req);

    const result = await pool.query(
      `
      SELECT
        w.id AS wallet_id,
        w.name AS wallet_name,
        w.wallet_type,
        w.centre_id,
        (ARRAY_AGG(d.opening_balance ORDER BY d.date ASC))[1]  AS opening_balance,
        COALESCE(SUM(d.total_credit), 0)                         AS total_credit,
        COALESCE(SUM(d.total_debit), 0)                          AS total_debit,
        (ARRAY_AGG(d.closing_balance ORDER BY d.date DESC))[1] AS closing_balance
      FROM wallet_daily_balances d
      JOIN wallets w ON w.id = d.wallet_id
      WHERE d.date BETWEEN $1 AND $2
        AND ($3::int IS NULL OR w.centre_id = $3)
      GROUP BY w.id, w.name, w.wallet_type, w.centre_id
      ORDER BY w.name ASC
      `,
      [range.from, range.to, centreId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Wallet summary report error:", err);
    res.status(500).json({ error: "Failed to load wallet summary report" });
  }
});

/* ======================================================
   2. WALLET DAILY BALANCE HISTORY
   FIX: superadmin can open any centre's wallet.
====================================================== */
router.get("/wallets/:walletId/daily", async (req, res) => {
  try {
    const walletId = parseInt(req.params.walletId, 10);
    if (Number.isNaN(walletId)) {
      return res.status(400).json({ error: "Invalid wallet id" });
    }

    const range = readRange(req);
    if (!range) {
      return res.status(400).json({
        error: "from and to dates are required (YYYY-MM-DD)",
      });
    }

    const walletCheck = await pool.query(`SELECT centre_id FROM wallets WHERE id = $1`, [walletId]);
    if (walletCheck.rows.length === 0) {
      return res.status(404).json({ error: "Wallet not found" });
    }
    if (req.user.role !== "superadmin" && walletCheck.rows[0].centre_id !== req.user.centre_id) {
      return res.status(403).json({ error: "Access denied to this wallet" });
    }

    const result = await pool.query(
      `
      SELECT date, opening_balance, total_credit, total_debit, closing_balance
      FROM wallet_daily_balances
      WHERE wallet_id = $1
        AND date BETWEEN $2 AND $3
      ORDER BY date DESC
      `,
      [walletId, range.from, range.to]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Wallet daily report error:", err);
    res.status(500).json({ error: "Failed to load wallet daily balances" });
  }
});

/* ======================================================
   3. MANUAL DAILY CLOSE (ADMIN ONLY)
   FIX: re-runs the chosen day AND every day after it up to yesterday,
   because each day's opening is the previous day's closing.
   Future dates are refused. Returns any drift found.
====================================================== */
router.post("/daily-close/re-run", requireAdmin, async (req, res) => {
  try {
    const { date } = req.body;

    if (!isYMD(date)) {
      return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });
    }
    if (date > todayIST()) {
      return res.status(400).json({ error: "Cannot close a future date" });
    }

    const results = await regenerateDailyBalancesFrom(date, req.user.role);
    const last = results[results.length - 1];
    const drift = results.flatMap((r) => (r.drift || []).map((d) => ({ date: r.date, ...d })));

    res.json({
      success: true,
      message:
        results.length === 1
          ? `Daily close re-run completed for ${date}`
          : `Daily close re-run completed for ${date} to ${last.date} (${results.length} days)`,
      days: results.length,
      drift,
    });
  } catch (err) {
    console.error("Manual daily close failed:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to re-run daily close",
    });
  }
});

/* ======================================================
   DAILY INFLOW vs OUTFLOW (CHART DATA)
   FIX: was not filtered by centre — every admin saw the totals of ALL centres.
====================================================== */
router.get("/wallets/daily-flow", async (req, res) => {
  try {
    const range = readRange(req);
    if (!range) {
      return res.status(400).json({ error: "from and to are required (YYYY-MM-DD)" });
    }
    const centreId = scopeCentre(req);

    const { rows } = await pool.query(
      `
      SELECT
        d.date,
        SUM(d.total_credit) AS total_in,
        SUM(d.total_debit)  AS total_out
      FROM wallet_daily_balances d
      JOIN wallets w ON w.id = d.wallet_id
      WHERE d.date BETWEEN $1 AND $2
        AND ($3::int IS NULL OR w.centre_id = $3)
      GROUP BY d.date
      ORDER BY d.date
      `,
      [range.from, range.to, centreId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Daily flow chart error:", err);
    res.status(500).json({ error: "Failed to fetch daily flow data" });
  }
});

/* ======================================================
   WALLET-WISE DISTRIBUTION (CHART DATA)
   FIX: superadmin can pick a centre (?centreId=), same as the other reports.
====================================================== */
router.get("/wallets/distribution", async (req, res) => {
  try {
    const range = readRange(req);
    if (!range) {
      return res.status(400).json({ error: "from and to are required (YYYY-MM-DD)" });
    }
    const centreId = scopeCentre(req);

    const { rows } = await pool.query(
      `
      SELECT
        w.id AS wallet_id,
        w.name AS wallet_name,
        SUM(d.total_credit + d.total_debit) AS total_movement
      FROM wallet_daily_balances d
      JOIN wallets w ON w.id = d.wallet_id
      WHERE d.date BETWEEN $1 AND $2
        AND ($3::int IS NULL OR w.centre_id = $3)
      GROUP BY w.id, w.name
      ORDER BY total_movement DESC
      `,
      [range.from, range.to, centreId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Wallet distribution chart error:", err);
    res.status(500).json({ error: "Failed to fetch wallet distribution" });
  }
});

export default router;