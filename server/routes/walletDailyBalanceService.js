// routes/walletDailyBalanceService.js
//
// What changed vs the old version
// 1. Re-running a day now UPDATES its snapshot (was ON CONFLICT DO NOTHING, so
//    "Re-run Close" never changed an existing day).
// 2. regenerateDailyBalancesFrom(date) re-runs that day AND every day after it up to
//    yesterday, because each day's opening = the previous day's closing.
// 3. Day boundaries are IST midnight to midnight, written explicitly in SQL
//    (does not depend on the database session time zone).
// 4. A missing previous snapshot (server was down, first close of a new wallet) no longer
//    uses the CURRENT balance as if nothing happened since. It works back from the
//    current balance through every later transaction.
// 5. Drift check: if a snapshot doesn't match what the transactions say (e.g. a wallet
//    balance was edited directly), it is logged instead of silently carried forward.
// 6. One set-based query per day instead of 2 queries per wallet, plus a lock so two
//    closes can't run at the same time.
import pool from "../db.js";
import { isYMD, todayIST, yesterdayIST, addDays, daysBetween } from "../utils/dates.js";

const MAX_DAYS_PER_RERUN = 400;

const UPSERT_DAY_SQL = `
  WITH bounds AS (
    SELECT ($1::date)::timestamp       AT TIME ZONE 'Asia/Kolkata' AS day_start,
           ($1::date + 1)::timestamp   AT TIME ZONE 'Asia/Kolkata' AS day_end
  ),
  day_tx AS (
    SELECT wt.wallet_id,
           COALESCE(SUM(wt.amount) FILTER (WHERE wt.type = 'credit'), 0) AS credit,
           COALESCE(SUM(wt.amount) FILTER (WHERE wt.type = 'debit'),  0) AS debit
    FROM wallet_transactions wt, bounds b
    WHERE wt.created_at >= b.day_start AND wt.created_at < b.day_end
    GROUP BY wt.wallet_id
  ),
  later_tx AS (
    SELECT wt.wallet_id,
           SUM(CASE WHEN wt.type = 'credit' THEN wt.amount ELSE -wt.amount END) AS net
    FROM wallet_transactions wt, bounds b
    WHERE wt.created_at >= b.day_end
    GROUP BY wt.wallet_id
  ),
  calc AS (
    SELECT w.id AS wallet_id,
           COALESCE(d.credit, 0) AS credit,
           COALESCE(d.debit, 0)  AS debit,
           w.balance - COALESCE(l.net, 0) AS ledger_closing,   -- closing according to the transactions
           prev.closing_balance           AS prev_closing      -- closing of the day before (snapshot)
    FROM wallets w
    LEFT JOIN day_tx d   ON d.wallet_id = w.id
    LEFT JOIN later_tx l ON l.wallet_id = w.id
    LEFT JOIN wallet_daily_balances prev
           ON prev.wallet_id = w.id AND prev.date = $1::date - 1
    WHERE w.status != 'deleted'
  )
  INSERT INTO wallet_daily_balances
    (wallet_id, date, opening_balance, total_credit, total_debit, closing_balance)
  SELECT wallet_id,
         $1::date,
         COALESCE(prev_closing, ledger_closing - (credit - debit)),
         credit,
         debit,
         COALESCE(prev_closing, ledger_closing - (credit - debit)) + credit - debit
  FROM calc
  ON CONFLICT (wallet_id, date) DO UPDATE SET
    opening_balance = EXCLUDED.opening_balance,
    total_credit    = EXCLUDED.total_credit,
    total_debit     = EXCLUDED.total_debit,
    closing_balance = EXCLUDED.closing_balance
  RETURNING wallet_id
`;

const DRIFT_SQL = `
  WITH later_tx AS (
    SELECT wt.wallet_id,
           SUM(CASE WHEN wt.type = 'credit' THEN wt.amount ELSE -wt.amount END) AS net
    FROM wallet_transactions wt
    WHERE wt.created_at >= ($1::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
    GROUP BY wt.wallet_id
  )
  SELECT wdb.wallet_id, w.name, w.centre_id,
         wdb.closing_balance,
         w.balance - COALESCE(l.net, 0) AS ledger_closing
  FROM wallet_daily_balances wdb
  JOIN wallets w ON w.id = wdb.wallet_id
  LEFT JOIN later_tx l ON l.wallet_id = wdb.wallet_id
  WHERE wdb.date = $1::date
    AND ABS(wdb.closing_balance - (w.balance - COALESCE(l.net, 0))) > 0.01
`;

/**
 * Create or refresh the daily balances of every wallet for ONE day.
 * @param {string} date        YYYY-MM-DD (IST calendar day)
 * @param {string} triggeredBy scheduler | manual | admin
 */
async function generateDailyBalances(date, triggeredBy = "scheduler") {
  if (!isYMD(date)) throw new Error(`Invalid close date: ${date}`);
  if (date > todayIST()) throw new Error(`Cannot close ${date}: that day hasn't started yet`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // one daily close at a time (cron + manual re-run racing each other)
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('wallet_daily_close'))`);

    await client.query(
      `INSERT INTO daily_close_logs (close_date, status, triggered_by)
       VALUES ($1, 'running', $2)
       ON CONFLICT (close_date) DO UPDATE SET
         status = 'running', started_at = NOW(), finished_at = NULL,
         error_message = NULL, triggered_by = EXCLUDED.triggered_by`,
      [date, triggeredBy]
    );

    const upsert = await client.query(UPSERT_DAY_SQL, [date]);
    const drift = await client.query(DRIFT_SQL, [date]);

    if (drift.rows.length) {
      console.warn(
        `[WalletDailyBalance] DRIFT | ${date} | snapshot ≠ transactions for ${drift.rows.length} wallet(s):`,
        drift.rows.map((r) => `${r.name} (#${r.wallet_id}) snapshot ${r.closing_balance} vs ledger ${r.ledger_closing}`).join("; ")
      );
    }

    await client.query(
      `UPDATE daily_close_logs
          SET status = 'success', finished_at = NOW(), wallets_processed = $2, error_message = $3
        WHERE close_date = $1`,
      [
        date,
        upsert.rowCount,
        drift.rows.length
          ? `Drift on ${drift.rows.length} wallet(s): ${drift.rows.map((r) => `#${r.wallet_id}`).join(", ")}`
          : null,
      ]
    );

    await client.query("COMMIT");
    console.log(`[WalletDailyBalance] SUCCESS | ${date} | wallets: ${upsert.rowCount}`);
    return { date, wallets: upsert.rowCount, drift: drift.rows };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    try {
      await pool.query(
        `INSERT INTO daily_close_logs (close_date, status, triggered_by, finished_at, error_message)
         VALUES ($1, 'failed', $2, NOW(), $3)
         ON CONFLICT (close_date) DO UPDATE SET
           status = 'failed', finished_at = NOW(), error_message = EXCLUDED.error_message`,
        [date, triggeredBy, err.message]
      );
    } catch (_) {
      // don't hide the original error
    }
    console.error(`[WalletDailyBalance] FAILED | ${date} |`, err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Re-run a past day and every day after it, up to yesterday (or just that day if it is today).
 * Use this for "Re-run Close": a later day's opening depends on the earlier day's closing.
 */
export async function regenerateDailyBalancesFrom(fromDate, triggeredBy = "manual") {
  if (!isYMD(fromDate)) throw new Error(`Invalid date: ${fromDate}`);
  const end = fromDate > yesterdayIST() ? fromDate : yesterdayIST();
  if (daysBetween(fromDate, end) > MAX_DAYS_PER_RERUN) {
    throw new Error(`Re-run is limited to ${MAX_DAYS_PER_RERUN} days at a time`);
  }

  const results = [];
  for (let d = fromDate; d <= end; d = addDays(d, 1)) {
    results.push(await generateDailyBalances(d, triggeredBy));
  }
  return results;
}

export default generateDailyBalances;