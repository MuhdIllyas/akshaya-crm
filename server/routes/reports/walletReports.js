import express from "express";
import jwt from "jsonwebtoken";
import pool from "../../db.js";
import generateDailyBalances from "../walletDailyBalanceService.js";

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

/* ======================================================
   1️⃣ WALLET SUMMARY REPORT (ADMIN)
   OPENING / CREDIT / DEBIT / CLOSING
====================================================== */
router.get("/wallets/summary", async (req, res) => {
  try {
    const { from, to, centreId: queryCentreId } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        error: "from and to dates are required (YYYY-MM-DD)",
      });
    }

    const isSuperAdmin = req.user.role === "superadmin";

    // 🔑 Decide centreId source
    let centreId = req.user.centre_id;

    if (isSuperAdmin && queryCentreId) {
      centreId = Number(queryCentreId);
    }

    if (!centreId) {
      return res.status(400).json({
        error: "centreId is required for superadmin",
      });
    }

    const params = [from, to, centreId];

    const query = `
      SELECT
        w.id   AS wallet_id,
        w.name AS wallet_name,
        w.wallet_type,
        MIN(d.opening_balance)  AS opening_balance,
        SUM(d.total_credit)     AS total_credit,
        SUM(d.total_debit)      AS total_debit,
        MAX(d.closing_balance)  AS closing_balance
      FROM wallet_daily_balances d
      JOIN wallets w ON w.id = d.wallet_id
      WHERE d.date BETWEEN $1 AND $2
        AND w.centre_id = $3
      GROUP BY w.id, w.name, w.wallet_type
      ORDER BY w.name ASC
    `;

    const { rows } = await pool.query(query, params);

    res.json(rows);
  } catch (err) {
    console.error("Wallet summary report error:", err);
    res.status(500).json({
      error: "Failed to load wallet summary report",
    });
  }
});

/* ======================================================
   2️⃣ WALLET DAILY BALANCE HISTORY
====================================================== */
router.get("/wallets/:walletId/daily", async (req, res) => {
  try {
    const walletId = parseInt(req.params.walletId, 10);
    const { from, to, centreId: queryCentreId } = req.query;

    if (Number.isNaN(walletId)) {
      return res.status(400).json({ error: "Invalid wallet id" });
    }

    if (!from || !to) {
      return res.status(400).json({
        error: "from and to dates are required (YYYY-MM-DD)",
      });
    }

    const isSuperAdmin = req.user.role === "superadmin";

    // 🔑 Decide centreId source
    let centreId = req.user.centre_id;

    if (isSuperAdmin && queryCentreId) {
      centreId = Number(queryCentreId);
    }

    if (!centreId) {
      return res.status(400).json({
        error: "centreId is required for superadmin",
      });
    }

    // 🔐 Access validation
    const walletCheck = await pool.query(
      `SELECT id FROM wallets WHERE id = $1 AND centre_id = $2`,
      [walletId, centreId]
    );

    if (walletCheck.rows.length === 0) {
      return res.status(403).json({
        error: "Access denied to this wallet",
      });
    }

    const result = await pool.query(
      `
      SELECT
        date,
        opening_balance,
        total_credit,
        total_debit,
        closing_balance
      FROM wallet_daily_balances
      WHERE wallet_id = $1
        AND date BETWEEN $2 AND $3
      ORDER BY date DESC
      `,
      [walletId, from, to]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Wallet daily report error:", err);
    res.status(500).json({
      error: "Failed to load wallet daily balances",
    });
  }
});

/* ======================================================
   3️⃣ MANUAL DAILY CLOSE (ADMIN ONLY)
====================================================== */
router.post("/daily-close/re-run", requireAdmin, async (req, res) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({
        error: "date is required (YYYY-MM-DD)",
      });
    }

    await generateDailyBalances(date, "admin");

    res.json({
      success: true,
      message: `Daily close re-run completed for ${date}`,
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
====================================================== */
router.get("/wallets/daily-flow", async (req, res) => {
  try {
    const { from, to, centreId: queryCentreId } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        error: "from and to are required (YYYY-MM-DD)",
      });
    }

    const isSuperAdmin = req.user.role === "superadmin";

    // 🔑 Decide centreId source
    let centreId = req.user.centre_id;

    if (isSuperAdmin && queryCentreId) {
      centreId = Number(queryCentreId);
    }

    if (!centreId) {
      return res.status(400).json({
        error: "centreId is required for superadmin",
      });
    }

    // 🧠 Build dynamic SQL safely
    const params = [from, to, centreId];

    const query = `
      SELECT
        d.date,
        SUM(d.total_credit) AS total_in,
        SUM(d.total_debit)  AS total_out
      FROM wallet_daily_balances d
      JOIN wallets w ON w.id = d.wallet_id
      WHERE d.date BETWEEN $1 AND $2
        AND w.centre_id = $3
      GROUP BY d.date
      ORDER BY d.date
    `;

    const { rows } = await pool.query(query, params);

    res.json(rows);
  } catch (err) {
    console.error("Daily flow chart error:", err);
    res.status(500).json({
      error: "Failed to fetch daily flow data",
    });
  }
});

/* ======================================================
   WALLET-WISE DISTRIBUTION (CHART DATA)
====================================================== */
router.get("/wallets/distribution", authenticateToken, async (req, res) => {
  try {
    const { from, to, centreId: queryCentreId } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        error: "from and to are required (YYYY-MM-DD)",
      });
    }

    const isSuperAdmin = req.user.role === "superadmin";

    // 🔑 Decide centreId source
    let centreId = req.user.centre_id;

    if (isSuperAdmin && queryCentreId) {
      centreId = Number(queryCentreId);
    }

    if (!centreId) {
      return res.status(400).json({
        error: "centreId is required for superadmin",
      });
    }

    // 🧠 SQL params (always filtered by centre)
    const params = [from, to, centreId];

    const query = `
      SELECT
        w.id   AS wallet_id,
        w.name AS wallet_name,
        SUM(d.total_credit + d.total_debit) AS total_movement
      FROM wallet_daily_balances d
      JOIN wallets w ON w.id = d.wallet_id
      WHERE d.date BETWEEN $1 AND $2
        AND w.centre_id = $3
      GROUP BY w.id, w.name
      ORDER BY total_movement DESC
    `;

    const { rows } = await pool.query(query, params);

    res.json(rows);
  } catch (err) {
    console.error("Wallet distribution chart error:", err);
    res.status(500).json({
      error: "Failed to fetch wallet distribution",
    });
  }
});

export default router;