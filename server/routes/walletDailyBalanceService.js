// services/walletDailyBalanceService.js
import pool from "../db.js";

/**
 * Generate daily balances for all wallets for a given date
 * @param {string} date - YYYY-MM-DD
 * @param {string} triggeredBy - scheduler | manual | admin
 */
async function generateDailyBalances(date, triggeredBy = "scheduler") {
  const client = await pool.connect();
  let walletsProcessed = 0;

  try {
    await client.query("BEGIN");

    /* --------------------------------------------------
     * 0. Mark daily close as RUNNING (idempotent)
     * -------------------------------------------------- */
    await client.query(
      `
      INSERT INTO daily_close_logs (
        close_date,
        status,
        triggered_by
      )
      VALUES ($1, 'running', $2)
      ON CONFLICT (close_date)
      DO UPDATE SET
        status = 'running',
        started_at = NOW(),
        triggered_by = EXCLUDED.triggered_by
      `,
      [date, triggeredBy]
    );

    /* --------------------------------------------------
     * 1. Fetch active wallets
     * -------------------------------------------------- */
    const { rows: wallets } = await client.query(
      `
      SELECT id, balance
      FROM wallets
      WHERE status != 'deleted'
      `
    );

    /* --------------------------------------------------
     * 2. Process each wallet
     * -------------------------------------------------- */
    for (const wallet of wallets) {
      const walletId = wallet.id;

      /* 2a. Yesterday closing balance */
      const { rows: prev } = await client.query(
        `
        SELECT closing_balance
        FROM wallet_daily_balances
        WHERE wallet_id = $1
          AND date = ($2::date - INTERVAL '1 day')::date
        `,
        [walletId, date]
      );

      /* 2b. Aggregate today's transactions */
      const { rows: tx } = await client.query(
        `
        SELECT
          COALESCE(
            SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END),
            0
          ) AS total_credit,
          COALESCE(
            SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END),
            0
          ) AS total_debit
        FROM wallet_transactions
        WHERE wallet_id = $1
          AND DATE(created_at) = $2
        `,
        [walletId, date]
      );

      const totalCredit = Number(tx[0].total_credit);
      const totalDebit = Number(tx[0].total_debit);

      /* 2c. Determine opening balance */
      let openingBalance;
      if (prev.length) {
        openingBalance = Number(prev[0].closing_balance);
      } else {
        // First ever close for this wallet
        openingBalance =
          Number(wallet.balance) - (totalCredit - totalDebit);
      }

      /* 2d. Closing balance */
      const closingBalance =
        openingBalance + totalCredit - totalDebit;

      /* 2e. Accounting identity validation */
      const diff =
        openingBalance + totalCredit - totalDebit - closingBalance;

      if (Math.abs(diff) > 0.01) {
        throw new Error(
          `Balance mismatch for wallet ${walletId} on ${date}`
        );
      }

      /* 2f. Insert daily balance (idempotent) */
      await client.query(
        `
        INSERT INTO wallet_daily_balances (
          wallet_id,
          date,
          opening_balance,
          total_credit,
          total_debit,
          closing_balance
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (wallet_id, date)
        DO NOTHING
        `,
        [
          walletId,
          date,
          openingBalance,
          totalCredit,
          totalDebit,
          closingBalance
        ]
      );

      walletsProcessed++;
    }

    /* --------------------------------------------------
     * 3. Mark daily close SUCCESS
     * -------------------------------------------------- */
    await client.query(
      `
      UPDATE daily_close_logs
      SET
        status = 'success',
        finished_at = NOW(),
        wallets_processed = $2
      WHERE close_date = $1
      `,
      [date, walletsProcessed]
    );

    await client.query("COMMIT");

    console.log(
      `[WalletDailyBalance] SUCCESS | ${date} | wallets: ${walletsProcessed}`
    );
  } catch (err) {
    await client.query("ROLLBACK");

    /* --------------------------------------------------
     * 4. Mark daily close FAILED
     * -------------------------------------------------- */
    try {
      await client.query(
        `
        UPDATE daily_close_logs
        SET
          status = 'failed',
          finished_at = NOW(),
          error_message = $2
        WHERE close_date = $1
        `,
        [date, err.message]
      );
    } catch (_) {
      // avoid masking original error
    }

    console.error(
      `[WalletDailyBalance] FAILED | ${date} |`,
      err
    );
    throw err;
  } finally {
    client.release();
  }
}

export default generateDailyBalances;