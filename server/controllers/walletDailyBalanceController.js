import pool from "../db.js";

/**
 * Get today's balance for a wallet
 */
export async function getTodayBalance(req, res) {
  const { walletId } = req.params;
  const today = new Date().toLocaleDateString("en-CA", {
  timeZone: "Asia/Kolkata",
});

  try {
    const { rows } = await pool.query(
      `
      SELECT
        date,
        opening_balance,
        total_credit,
        total_debit,
        closing_balance
      FROM wallet_daily_balances
      WHERE wallet_id = $1
        AND date = $2
      `,
      [walletId, today]
    );

    if (rows.length === 0) {
      return res.json({
        date: today,
        opening_balance: null,
        total_credit: 0,
        total_debit: 0,
        closing_balance: null,
      });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("getTodayBalance error:", err);
    res.status(500).json({ error: "Failed to fetch today's balance" });
  }
}

/**
 * Get daily balances for a wallet in a date range
 */
export async function getDailyBalances(req, res) {
  const { walletId } = req.params;
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({
      error: "from and to dates are required (YYYY-MM-DD)",
    });
  }

  try {
    const { rows } = await pool.query(
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
      ORDER BY date ASC
      `,
      [walletId, from, to]
    );

    res.json(rows);
  } catch (err) {
    console.error("getDailyBalances error:", err);
    res.status(500).json({ error: "Failed to fetch daily balances" });
  }
}