import express from "express";
import pool from "../../db.js";
import jwt from "jsonwebtoken";

const router = express.Router();

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    if (user.role !== 'superadmin') return res.status(403).json({ error: "SuperAdmin access required" });
    req.user = user;
    next();
  });
};

router.use(authenticateToken);

router.get("/centre/:centreId", async (req, res) => {
  const { centreId } = req.params;
  const today = new Date().toISOString().split('T')[0];
  const year = new Date().getFullYear();

  try {
    // 1. Fetch Financial Trend (Revenue/Expenses/Profit)
    const financialRes = await pool.query(`
      SELECT 
        EXTRACT(MONTH FROM date) - 1 as month,
        SUM(total_credit) as revenue,
        SUM(total_debit) as expenses
      FROM wallet_daily_balances wdb
      JOIN wallets w ON w.id = wdb.wallet_id
      WHERE w.centre_id = $1 AND EXTRACT(YEAR FROM date) = $2
      GROUP BY month
      ORDER BY month
    `, [centreId, year]);

    const revenue = new Array(12).fill(0);
    const expenses = new Array(12).fill(0);
    const profit = new Array(12).fill(0);

    financialRes.rows.forEach(row => {
      const m = parseInt(row.month);
      revenue[m] = Number(row.revenue);
      expenses[m] = Number(row.expenses);
      profit[m] = Number(row.revenue) - Number(row.expenses);
    });

    // 2. Fetch Wallets + Calculate Today's In/Out (Fixes the "today_in" error)
    const walletRes = await pool.query(`
      SELECT 
        w.id, 
        w.name, 
        w.balance as "currentBalance",
        COALESCE(SUM(CASE WHEN wt.type = 'credit' AND wt.created_at::date = $2 THEN wt.amount ELSE 0 END), 0) as "todayIn",
        COALESCE(SUM(CASE WHEN wt.type = 'debit' AND wt.created_at::date = $2 THEN wt.amount ELSE 0 END), 0) as "todayOut"
      FROM wallets w
      LEFT JOIN wallet_transactions wt ON w.id = wt.wallet_id
      WHERE w.centre_id = $1
      GROUP BY w.id, w.name, w.balance
    `, [centreId, today]);

    // 3. Recent Transactions
    const transRes = await pool.query(`
      SELECT wt.amount, wt.type, wt.category, wt.created_at as date
      FROM wallet_transactions wt
      JOIN wallets w ON w.id = wt.wallet_id
      WHERE w.centre_id = $1
      ORDER BY wt.created_at DESC
      LIMIT 10
    `, [centreId]);

    // 4. Staff Performance
    const staffRes = await pool.query(`
      SELECT 
        s.name,
        COUNT(se.id) as services,
        COALESCE(SUM(se.total_charges), 0) as revenue
      FROM staff s
      LEFT JOIN service_entries se ON s.id = se.staff_id
      WHERE s.centre_id = $1
      GROUP BY s.id, s.name
      ORDER BY revenue DESC
      LIMIT 5
    `, [centreId]);

    res.json({
      revenue,
      expenses,
      profit,
      wallets: walletRes.rows,
      transactions: transRes.rows,
      staffPerformance: staffRes.rows
    });

  } catch (err) {
    console.error("SuperAdmin Analytics Error:", err);
    res.status(500).json({ error: "Failed to fetch centre analytics" });
  }
});

export default router;