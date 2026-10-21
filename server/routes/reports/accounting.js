import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { todayIST, addDays } from "../../utils/dates.js";

const router = express.Router();

// same auth used everywhere else
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

router.use(authenticateToken);

/* Who may see / change the centre's accounts.
   Staff used to be able to read the whole ledger, income, daily summary and
   all wallet balances, and save reconciliation counts (found in the staging test).
   'supervisor' is kept because the supervisor dashboard reads the nightly close —
   remove it if supervisors shouldn't see the accounts. */
const ACCOUNTING_ROLES = ['admin', 'superadmin', 'supervisor'];
const requireAccounting = (req, res, next) => {
  if (!ACCOUNTING_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};
const isYMD = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

// ========== DAILY SUMMARY ==========
router.get('/daily-summary', requireAccounting, async (req, res) => {
  const { date, centreId: queryCentreId } = req.query;
  const isSuperAdmin = req.user.role === "superadmin";

  let centreId = req.user.centre_id;
  if (isSuperAdmin && queryCentreId) {
    centreId = Number(queryCentreId);
  }
  if (!centreId) {
    return res.status(400).json({ error: "centreId is required" });
  }
  if (!isYMD(date)) {
    return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
  }

  const client = await req.db.connect();

  try {

    await client.query('BEGIN');

/* --------------------------------------------------
       1. OPENING BALANCES (yesterday closing)
    -------------------------------------------------- */
    const openingRes = await client.query(
      `
      SELECT
        w.wallet_type,
        COALESCE(SUM(wdb.closing_balance), 0) AS opening_balance
      FROM wallet_daily_balances wdb
      JOIN wallets w ON w.id = wdb.wallet_id
      WHERE w.centre_id = $1
        AND wdb.date = ($2::date - INTERVAL '1 day')
      GROUP BY w.wallet_type
      `,
      [centreId, date]
    );

    let cashOpening = 0;
    let bankOpening = 0;
    let digitalOpening = 0;

    openingRes.rows.forEach(row => {
      const amt = Number(row.opening_balance);
      if (row.wallet_type === 'cash') cashOpening += amt;
      else if (row.wallet_type === 'bank') bankOpening += amt;
      else digitalOpening += amt;
    });
    
    // Total opening balance is the sum of all three
    const totalOpeningBalance = cashOpening + bankOpening + digitalOpening;

    /* --------------------------------------------------
       2. TODAY TRANSACTIONS 
    -------------------------------------------------- */
    const txRes = await client.query(
      `
      WITH latest_transactions AS (
        SELECT DISTINCT ON (COALESCE(NULLIF(wt.correction_group_id::text, ''), wt.id::text))
          wt.type,
          wt.amount,
          wt.category,
          wt.is_reversal,
          w.wallet_type
        FROM wallet_transactions wt
        JOIN wallets w ON w.id = wt.wallet_id
        WHERE w.centre_id = $1
          AND wt.created_at >= $2::date
          AND wt.created_at < ($2::date + INTERVAL '1 day')
          -- 🔥 TRANSFERS ARE NOW INCLUDED! No longer filtered out.
        ORDER BY COALESCE(NULLIF(wt.correction_group_id::text, ''), wt.id::text), wt.created_at DESC, wt.id DESC
      )
      SELECT
        lt.type,
        lt.wallet_type,
        lt.category,
        SUM(lt.amount) AS amount
      FROM latest_transactions lt
      WHERE (lt.is_reversal IS NULL OR lt.is_reversal = FALSE)
      GROUP BY lt.type, lt.wallet_type, lt.category
      `,
      [centreId, date]
    );

    // Business Inflow / Outflow
    let cashInflow = 0, digitalInflow = 0, bankInflow = 0;
    let cashOutflow = 0, digitalOutflow = 0, bankOutflow = 0;
    
    // Internal Transfers (Liquidity Movements)
    let cashTransferIn = 0, digitalTransferIn = 0, bankTransferIn = 0;
    let cashTransferOut = 0, digitalTransferOut = 0, bankTransferOut = 0;

    txRes.rows.forEach(row => {
      const amount = Number(row.amount);
      const walletType = row.wallet_type;
      const isCash = walletType === 'cash';
      const isBank = walletType === 'bank';
      const isDigital = !isCash && !isBank;
      
      const isTransfer = row.category === 'Transfer' || row.category === 'Internal Transfer';

      if (isTransfer) {
        if (row.type === 'credit') {
          if (isCash) cashTransferIn += amount;
          else if (isBank) bankTransferIn += amount;
          else if (isDigital) digitalTransferIn += amount;
        } else if (row.type === 'debit') {
          if (isCash) cashTransferOut += amount;
          else if (isBank) bankTransferOut += amount;
          else if (isDigital) digitalTransferOut += amount;
        }
      } else {
        // Standard Inflow/Outflow for Revenue and Expenses
        if (row.type === 'credit') {
          if (isCash) cashInflow += amount;
          else if (isBank) bankInflow += amount;
          else if (isDigital) digitalInflow += amount;
        } else if (row.type === 'debit') {
          if (isCash) cashOutflow += amount;
          else if (isBank) bankOutflow += amount;
          else if (isDigital) digitalOutflow += amount;
        }
      }
    });

    await client.query('COMMIT');

    const closureRes = await client.query(
      `SELECT actual_cash FROM daily_accounting_closure WHERE centre_id = $1 AND accounting_date = $2`,
      [centreId, date]
    );
    const actualCashInHand = closureRes.rows.length > 0 ? Number(closureRes.rows[0].actual_cash) : 0;

    res.json({
          date,
          derived: {
            openingBalance: totalOpeningBalance,
            cashOpening,      
            bankOpening,      
            digitalOpening,   

            cashInflow,
            digitalInflow,
            bankInflow,

            cashOutflow,
            digitalOutflow,
            bankOutflow,

            cashTransferIn,
            digitalTransferIn,
            bankTransferIn,

            cashTransferOut,
            digitalTransferOut,
            bankTransferOut
          },
          actualCashInHand: actualCashInHand
        });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Daily summary error:', err);
    res.status(500).json({ error: 'Failed to load daily summary' });
  } finally {
    client.release();
  }
});

// ========== SAVE ACTUAL CASH (DAILY SUMMARY) ==========
router.post('/daily-summary/actual-cash', requireAccounting, async (req, res) => {
  const { date } = req.body;
  const actual_cash = Number(req.body.actual_cash);
  const centreId = req.user.centre_id;
  const userId = req.user.id;

  if (!centreId) {
    return res.status(400).json({ error: 'No centre assigned to this user' });
  }
  if (!isYMD(date) || date > todayIST()) {
    return res.status(400).json({ error: 'A valid date (not in the future) is required' });
  }
  if (!Number.isFinite(actual_cash) || actual_cash < 0) {
    return res.status(400).json({ error: 'Actual cash must be 0 or more' });
  }

  const client = await req.db.connect();
  try {

    await client.query(
      `INSERT INTO daily_accounting_closure 
        (centre_id, accounting_date, opening_balance, closing_balance, actual_cash, cash_variance, closed_by)
       VALUES ($1, $2, 0, 0, $3, 0, $4)
       ON CONFLICT (centre_id, accounting_date) 
       DO UPDATE SET 
        actual_cash = EXCLUDED.actual_cash,
        closed_by = EXCLUDED.closed_by`,
      [centreId, date, actual_cash, userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Actual cash save error:', err);
    res.status(500).json({ error: 'Failed to save actual cash' });
  } finally {
    client.release();
  }
});

// ========== ADD MISCELLANEOUS INCOME / OVERAGE ==========
router.post('/misc-income', async (req, res) => {
  if (!['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
 
  const { wallet_id, description, date } = req.body;
  const amount = Math.round(Number(req.body.amount) * 100) / 100;
  const walletId = parseInt(wallet_id, 10);
 
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Amount must be greater than 0' });
  }
  if (amount > 10000000) {
    return res.status(400).json({ error: 'Amount is too large' });
  }
  if (Number.isNaN(walletId)) {
    return res.status(400).json({ error: 'Wallet ID is required' });
  }
 
  // Frontend sends "YYYY-MM-DDTHH:MM:SS+05:30" (IST). No date = now.
  const createdAt = date ? new Date(date) : new Date();
  if (Number.isNaN(createdAt.getTime())) {
    return res.status(400).json({ error: 'Invalid date' });
  }
  if (createdAt.getTime() > Date.now() + 5 * 60 * 1000) {
    return res.status(400).json({ error: 'Date cannot be in the future' });
  }
 
  const client = await req.db.connect();
  try {
    await client.query('BEGIN');
 
    // lock the wallet row, check it belongs to this centre
    const walletRes = await client.query(
      `SELECT id, centre_id FROM wallets WHERE id = $1 FOR UPDATE`,
      [walletId]
    );
    if (walletRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Wallet not found' });
    }
    if (req.user.role !== 'superadmin' && walletRes.rows[0].centre_id !== req.user.centre_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Invalid wallet for your centre' });
    }
 
    const groupId = crypto.randomUUID();
 
    await client.query(
      `UPDATE wallets SET balance = balance + $1 WHERE id = $2`,
      [amount, walletId]
    );
 
    await client.query(
      `INSERT INTO wallet_transactions (
        wallet_id, staff_id, type, amount, description, category,
        correction_group_id, created_at
      )
       VALUES ($1, $2, 'credit', $3, $4, 'Misc Income', $5, $6)`,
      [
        walletId,
        req.user.id,
        amount,
        String(description || '').trim().slice(0, 500) || 'Miscellaneous Income / Cash Overage',
        groupId,
        createdAt,
      ]
    );
 
    await client.query('COMMIT');
    res.json({ success: true, message: 'Income recorded successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Misc income error:', err);
    res.status(500).json({ error: 'Failed to record income' });
  } finally {
    client.release();
  }
});

// ========== LEDGER (FIXED - COALESCE to prevent NULL collapse) ==========
router.get('/ledger', requireAccounting, async (req, res) => {
  const client = await req.db.connect();

  try {
    const { centreId: queryCentreId } = req.query;
    const isSuperAdmin = req.user.role === "superadmin";

    let centreId = req.user.centre_id;

    if (isSuperAdmin && queryCentreId) {
      centreId = Number(queryCentreId);
    }

    if (!centreId) {
      return res.status(400).json({ error: "centreId is required" });
    }
    const {
      from,
      to,
      staff_id,
      wallet_id,
      category,
      service_id
    } = req.query;

    const params = [centreId];
    let whereClause = `WHERE w.centre_id = $1`;

    if (from) {
      params.push(from);
      whereClause += ` AND wt.created_at >= $${params.length}::date `;
    }
    if (to) {
      params.push(to);
      whereClause += ` AND wt.created_at < ($${params.length}::date + INTERVAL '1 day') `;
    }
    if (staff_id) {
      params.push(staff_id);
      whereClause += ` AND wt.staff_id = $${params.length} `;
    }
    if (wallet_id) {
      params.push(wallet_id);
      whereClause += ` AND wt.wallet_id = $${params.length} `;
    }
    if (category) {
      params.push(category);
      whereClause += ` AND wt.category = $${params.length} `;
    }
    if (service_id) {
      params.push(service_id);
      whereClause += ` AND se.category_id = $${params.length} `;
    }

    const ledgerRes = await client.query(
      `
      SELECT * FROM (
        SELECT DISTINCT ON (COALESCE(wt.correction_group_id::text, wt.id::text))
          wt.id,
          wt.created_at,
          wt.type,
          wt.amount,
          wt.category,
          wt.correction_group_id,
          wt.is_reversal,
          wt.reference_type,

          w.id AS wallet_id,
          w.name AS wallet_name,
          w.wallet_type,

          s.name AS staff_name,
          sv.name AS service_name

        FROM wallet_transactions wt
        JOIN wallets w ON w.id = wt.wallet_id

        LEFT JOIN staff s
          ON s.id = wt.staff_id

        LEFT JOIN service_entries se
          ON se.id = wt.reference_id
          AND wt.category IN ('Service Payment', 'Department Payment', 'Service Charge')

        LEFT JOIN services sv
          ON sv.id = se.category_id

        ${whereClause}
          AND (wt.is_reversal IS NULL OR wt.is_reversal = FALSE)

        ORDER BY COALESCE(wt.correction_group_id::text, wt.id::text), wt.created_at DESC
      ) AS distinct_transactions
      ORDER BY created_at DESC
      LIMIT 500
      `,
      params
    );

    res.json({
      count: ledgerRes.rowCount,
      rows: ledgerRes.rows
    });

  } catch (err) {
    console.error('Ledger filter error:', err);
    res.status(500).json({ error: 'Failed to load ledger' });
  } finally {
    client.release();
  }
});

// ========== INCOME REPORT ==========
router.get('/income', requireAccounting, async (req, res) => {
  const client = await req.db.connect();

  try {
    const { centreId: queryCentreId } = req.query;
    const isSuperAdmin = req.user.role === "superadmin";

    let centreId = req.user.centre_id;

    if (isSuperAdmin && queryCentreId) {
      centreId = Number(queryCentreId);
    }

    if (!centreId) {
      return res.status(400).json({ error: "centreId is required" });
    }
    const { date, from, to, staff_id, wallet_id } = req.query;

    const params = [centreId];
    let whereClause = `WHERE s.centre_id = $1`;

    if (date) {
      params.push(date);
      whereClause += ` AND wt.created_at::date = $${params.length} `;
    }
    if (from) {
      params.push(from);
      whereClause += ` AND wt.created_at >= $${params.length}::date `;
    }
    if (to) {
      params.push(to);
      whereClause += ` AND wt.created_at < ($${params.length}::date + INTERVAL '1 day') `;
    }
    if (staff_id) {
      params.push(staff_id);
      whereClause += ` AND se.staff_id = $${params.length} `;
    }
    if (wallet_id) {
      params.push(wallet_id);
      whereClause += ` AND wt.wallet_id = $${params.length} `;
    }

    const incomeRes = await client.query(
      `
      WITH latest_transactions AS (
        SELECT DISTINCT ON (COALESCE(correction_group_id::text, id::text))
          id,
          wallet_id,
          amount,
          created_at,
          reference_id,
          correction_group_id,
          category,
          type,
          reference_type,
          is_reversal
        FROM wallet_transactions
        WHERE category = 'Service Payment'
          AND type = 'credit'
          AND reference_type = 'payment'
          AND (is_reversal IS NULL OR is_reversal = FALSE)
        ORDER BY COALESCE(correction_group_id::text, id::text), created_at DESC
      )
      SELECT
        se.id AS service_entry_id,
        se.customer_name,
        sv.name AS service_name,
        s.name AS staff_name,
        se.created_at AS service_date,
        se.service_charges,
        se.department_charges,
        (se.service_charges + se.department_charges) AS service_total,
        SUM(wt.amount) AS received_amount,
        STRING_AGG(DISTINCT w.name, ', ') AS payment_wallets,
        JSON_AGG(
          JSONB_BUILD_OBJECT(
            'wallet', w.name,
            'amount', wt.amount,
            'received_at', wt.created_at
          )
          ORDER BY wt.created_at
        ) AS wallet_breakdown,
        MAX(wt.created_at) AS received_at,
        CASE
          WHEN MAX(wt.created_at)::date > se.created_at::date
          THEN true
          ELSE false
        END AS was_pending
      FROM latest_transactions wt
      JOIN service_entries se ON se.id = wt.reference_id
      JOIN staff s ON s.id = se.staff_id
      JOIN services sv ON sv.id = se.category_id
      JOIN wallets w ON w.id = wt.wallet_id
      ${whereClause}
      GROUP BY
        se.id,
        se.customer_name,
        sv.name,
        s.name,
        se.created_at,
        se.service_charges,
        se.department_charges
      ORDER BY MAX(wt.created_at) DESC;
      `,
      params
    );

    res.json({
      count: incomeRes.rowCount,
      rows: incomeRes.rows
    });

  } catch (err) {
    console.error('Income report error:', err);
    res.status(500).json({ error: 'Failed to load income report' });
  } finally {
    client.release();
  }
});

// ========== WALLET BALANCES ==========
router.get('/wallet-balances', async (req, res) => {
  const client = await req.db.connect();
  try {
    const { centreId: queryCentreId } = req.query;
    const isSuperAdmin = req.user.role === "superadmin";

    let centreId = req.user.centre_id;

    if (isSuperAdmin && queryCentreId) {
      centreId = Number(queryCentreId);
    }

    if (!centreId) {
      return res.status(400).json({ error: "centreId is required" });
    }

    const result = await client.query(`
      SELECT
        id,
        name,
        wallet_type,
        balance AS current_balance
      FROM wallets
      WHERE centre_id = $1
      ORDER BY name ASC
    `, [centreId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Wallet balances error:', err);
    res.status(500).json({ error: 'Failed to load wallet balances' });
  } finally {
    client.release();
  }
});

// ========== GET WALLET RECONCILIATIONS ==========
router.get('/wallet-reconciliations', requireAccounting, async (req, res) => {
  const { date, centreId: queryCentreId } = req.query;
  const isSuperAdmin = req.user.role === 'superadmin';
 
  let centreId = req.user.centre_id;
  if (isSuperAdmin && queryCentreId) {
    centreId = Number(queryCentreId);
  }
 
  if (!centreId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return res.status(400).json({ error: 'centreId and date (YYYY-MM-DD) are required' });
  }
 
  const client = await req.db.connect();
  try {
    // Latest count per wallet for that date (id breaks a tie on the same timestamp)
    const result = await client.query(
      `
      SELECT DISTINCT ON (wr.wallet_id)
        wr.id,
        wr.wallet_id,
        wr.book_balance,
        wr.actual_balance,
        wr.variance,
        wr.settled_amount,
        wr.recon_date,
        wr.reconciled_at
      FROM wallet_reconciliations wr
      JOIN wallets w ON w.id = wr.wallet_id
      WHERE w.centre_id = $1
        AND wr.recon_date = $2::date
      ORDER BY wr.wallet_id, wr.reconciled_at DESC, wr.id DESC
      `,
      [centreId, date]
    );
 
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching reconciliations:', err);
    res.status(500).json({ error: 'Failed to fetch wallet reconciliations' });
  } finally {
    client.release();
  }
});

/* ---------------------------------------------------------------------
   B. NEW — record a booking against a saved reconciliation count
   WalletReconciliation.jsx calls this after "Book shortage" (−amount),
   "Book excess" (+amount) and a suggested correction transfer (− from, + to).
   "To settle" = variance − settled_amount, so normal sales/expenses after
   the count no longer change it.
   --------------------------------------------------------------------- */
router.patch('/wallet-reconciliations/:id/settle', async (req, res) => {
  if (!['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
 
  const id = parseInt(req.params.id, 10);
  const amount = Math.round(Number(req.body.amount) * 100) / 100; // signed change in system balance
  if (Number.isNaN(id) || !Number.isFinite(amount) || amount === 0) {
    return res.status(400).json({ error: 'id and a non-zero amount are required' });
  }
 
  const client = await req.db.connect();
  try {
    const { rows } = await client.query(
      `UPDATE wallet_reconciliations r
       SET settled_amount = r.settled_amount + $1
       FROM wallets w
       WHERE r.id = $2
         AND w.id = r.wallet_id
         AND ($3 = 'superadmin' OR w.centre_id = $4)
       RETURNING r.id, r.wallet_id, r.settled_amount`,
      [amount, id, req.user.role, req.user.centre_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Reconciliation not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Reconciliation settle error:', err);
    res.status(500).json({ error: 'Failed to update reconciliation' });
  } finally {
    client.release();
  }
});

// ========== WALLET RECONCILIATION (SAVE COUNTS) ==========
router.post('/wallet-reconcile', requireAccounting, async (req, res) => {
  // Superadmin view is read-only
  if (req.user.role === 'superadmin') {
    return res.status(403).json({ error: 'Superadmin access is read-only' });
  }
 
  const centreId = req.user.centre_id;
  if (!centreId) {
    return res.status(400).json({ error: 'No centre assigned to this user' });
  }
 
  const { reconciliations, date } = req.body;
 
  if (!Array.isArray(reconciliations) || reconciliations.length === 0) {
    return res.status(400).json({ error: 'reconciliations array is required' });
  }
 
  // The day the count is for (the page sends it). Default: today in IST.
  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const reconDate = date === undefined || date === null || date === '' ? todayIST : String(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reconDate)) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }
  if (reconDate > todayIST) {
    return res.status(400).json({ error: 'Cannot reconcile a future date' });
  }
 
  // Validate every row; variance is worked out here, not taken from the browser
  const round2 = (n) => Math.round(n * 100) / 100;
  const rows = [];
  for (const r of reconciliations) {
    const walletId = parseInt(r.wallet_id, 10);
    const book = Number(r.book_balance);
    const actual = Number(r.actual_balance);
    if (Number.isNaN(walletId) || !Number.isFinite(book) || !Number.isFinite(actual)) {
      return res.status(400).json({ error: 'Each row needs wallet_id, book_balance and actual_balance as numbers' });
    }
    if (Math.abs(actual) > 1e10 || Math.abs(book) > 1e10) {
      return res.status(400).json({ error: 'Balance is too large' });
    }
    rows.push({ walletId, book: round2(book), actual: round2(actual), variance: round2(actual - book) });
  }
 
  // One row per wallet per save (the last one wins if a wallet is sent twice)
  const byWallet = new Map(rows.map((r) => [r.walletId, r]));
  const walletIds = [...byWallet.keys()];
 
  const client = await req.db.connect();
  try {
    // Every wallet must belong to the caller's centre
    const own = await client.query(
      `SELECT COUNT(*)::int AS n FROM wallets WHERE id = ANY($1::int[]) AND centre_id = $2`,
      [walletIds, centreId]
    );
    if (own.rows[0].n !== walletIds.length) {
      return res.status(403).json({ error: 'Invalid wallet for your centre' });
    }
 
    await client.query('BEGIN');
 
    for (const r of byWallet.values()) {
      await client.query(
        `
        INSERT INTO wallet_reconciliations
          (wallet_id, book_balance, actual_balance, variance, reconciled_by, recon_date)
        VALUES ($1, $2, $3, $4, $5, $6::date)
        `,
        [r.walletId, r.book, r.actual, r.variance, req.user.id, reconDate]
      );
    }
 
    await client.query('COMMIT');
    res.json({ success: true, date: reconDate, saved: byWallet.size });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Wallet reconciliation error:', err);
    res.status(500).json({ error: 'Wallet reconciliation failed' });
  } finally {
    client.release();
  }
});

router.get('/wallet-book-balances', requireAccounting, async (req, res) => {
  const { centreId: queryCentreId, date } = req.query;
  const isSuperAdmin = req.user.role === "superadmin";

  let centreId = req.user.centre_id;
  if (isSuperAdmin && queryCentreId) centreId = Number(queryCentreId);
  if (!centreId) {
    return res.status(400).json({ error: "centreId is required" });
  }
  if (date && !isYMD(date)) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }
  const targetDate = date || todayIST();

  const client = await req.db.connect();

  try {

    const result = await client.query(`
      SELECT
        w.id,
        w.name,
        w.wallet_type,
        COALESCE(wdb.closing_balance, w.balance) AS book_balance
      FROM wallets w
      LEFT JOIN wallet_daily_balances wdb 
        ON w.id = wdb.wallet_id 
        AND wdb.date = $2
      WHERE w.centre_id = $1
      ORDER BY w.name ASC
    `, [centreId, targetDate]);

    res.json(result.rows);

  } catch (err) {
    console.error('Error fetching book balances:', err);
    res.status(500).json({ error: 'Failed to fetch book balances' });
  } finally {
    client.release();
  }
});

// ========== WALLET LEDGER BALANCES ==========
router.get('/wallet-ledger-balances', requireAccounting, async (req, res) => {
  const client = await req.db.connect();

  try {
    const { centreId: queryCentreId } = req.query;
    const isSuperAdmin = req.user.role === "superadmin";

    let centreId = req.user.centre_id;

    if (isSuperAdmin && queryCentreId) {
      centreId = Number(queryCentreId);
    }

    if (!centreId) {
      return res.status(400).json({ error: "centreId is required" });
    }

    const result = await client.query(
      `
      SELECT
        id,
        name,
        wallet_type,
        balance AS book_balance
      FROM wallets
      WHERE centre_id = $1
      ORDER BY name ASC
      `,
      [centreId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Wallet ledger balance error:', err);
    res.status(500).json({ error: 'Failed to fetch wallet ledger balances' });
  } finally {
    client.release();
  }
});

//Accounting Nighty Closing
router.post('/nightly-close', requireAccounting, async (req, res) => {
  const centreId = req.user.centre_id;
  const userId = req.user.id;

  const {
    date, opening_balance, closing_balance,
    actual_cash, cash_variance, checklist, notes
  } = req.body;

  if (!centreId) {
    return res.status(400).json({ error: 'No centre assigned to this user' });
  }
  if (!isYMD(date) || date > todayIST()) {
    return res.status(400).json({ error: 'A valid date (not in the future) is required' });
  }
  for (const [k, v] of Object.entries({ opening_balance, closing_balance, actual_cash, cash_variance })) {
    if (v !== undefined && v !== null && v !== '' && !Number.isFinite(Number(v))) {
      return res.status(400).json({ error: `${k} must be a number` });
    }
  }

  const client = await req.db.connect();

  try {

    await client.query(
      `
      INSERT INTO daily_accounting_closure
        (centre_id, accounting_date, opening_balance, closing_balance,
         actual_cash, cash_variance, checklist, notes, closed_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (centre_id, accounting_date)
      DO UPDATE SET
        closing_balance = EXCLUDED.closing_balance,
        actual_cash = EXCLUDED.actual_cash,
        cash_variance = EXCLUDED.cash_variance,
        checklist = EXCLUDED.checklist,
        notes = EXCLUDED.notes,
        closed_by = EXCLUDED.closed_by,
        closed_at = NOW()
      `,
      [ centreId, date, opening_balance, closing_balance, actual_cash, cash_variance, checklist, notes, userId ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Nightly close error:', err);
    res.status(500).json({ error: 'Failed to close accounting day' });
  } finally {
    client.release();
  }
});

router.get('/nightly-close', requireAccounting, async (req, res) => {
  const { date, centreId: queryCentreId } = req.query;
  const isSuperAdmin = req.user.role === "superadmin";

  let centreId = req.user.centre_id;
  if (isSuperAdmin && queryCentreId) {
    centreId = Number(queryCentreId);
  }
  if (!centreId) {
    return res.status(400).json({ error: "centreId is required" });
  }
  if (!isYMD(date)) {
    return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
  }

  const client = await req.db.connect();

  try {

    const result = await client.query(
      `
      SELECT *
      FROM daily_accounting_closure
      WHERE centre_id = $1 AND accounting_date = $2
      `,
      [centreId, date]
    );

    res.json(result.rows[0] || null);
  } catch (err) {
    console.error('Nightly close fetch error:', err);
    res.status(500).json({ error: 'Failed to load nightly close' });
  } finally {
    client.release();
  }
});

// ========== CLOSING STATUS (dashboards) ==========
/* One row per centre for a day: the nightly close + what the wallet counts found.
   Shortage / excess come live from the saved counts (latest count per wallet for
   the day): variance = counted − system, settled_amount = what was booked for it
   (Shortage expense / Misc income / correction transfer). Nothing extra is stored
   at close time, so a booking made after the close still shows up.

   cash_variance in the close = calculated cash − counted cash
     → POSITIVE means cash was SHORT, negative means OVER.            */
const CLOSING_STATUS_SQL = `
  WITH target AS (
    SELECT COALESCE($1::date, (NOW() AT TIME ZONE 'Asia/Kolkata')::date - 1) AS day
  )
  SELECT
    c.id   AS centre_id,
    c.name AS centre_name,
    t.day::text AS accounting_date,
    d.opening_balance,
    d.closing_balance,
    d.actual_cash,
    d.cash_variance,
    d.notes,
    d.closed_at,
    s.name AS closed_by_name,
    CASE
      WHEN d.centre_id IS NULL THEN 'not_closed'
      WHEN d.checklist IS NULL THEN 'incomplete'   -- only actual cash was saved
      ELSE 'closed'
    END AS status,
    COALESCE(r.wallets_counted, 0) AS wallets_counted,
    COALESCE(r.short_total, 0)     AS short_total,
    COALESCE(r.excess_total, 0)    AS excess_total,
    COALESCE(r.short_booked, 0)    AS short_booked,
    COALESCE(r.excess_booked, 0)   AS excess_booked,
    COALESCE(r.open_short, 0)      AS open_short,
    COALESCE(r.open_excess, 0)     AS open_excess,
    COALESCE(r.wallet_diffs, '[]'::json) AS wallet_diffs
  FROM centres c
  CROSS JOIN target t
  LEFT JOIN daily_accounting_closure d
    ON d.centre_id = c.id AND d.accounting_date = t.day
  LEFT JOIN staff s ON s.id = d.closed_by
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::int AS wallets_counted,
      SUM(CASE WHEN lr.variance < 0 THEN -lr.variance ELSE 0 END) AS short_total,
      SUM(CASE WHEN lr.variance > 0 THEN  lr.variance ELSE 0 END) AS excess_total,
      SUM(CASE WHEN lr.variance < 0 THEN GREATEST(-lr.settled, 0) ELSE 0 END) AS short_booked,
      SUM(CASE WHEN lr.variance > 0 THEN GREATEST( lr.settled, 0) ELSE 0 END) AS excess_booked,
      SUM(CASE WHEN lr.variance - lr.settled < 0 THEN -(lr.variance - lr.settled) ELSE 0 END) AS open_short,
      SUM(CASE WHEN lr.variance - lr.settled > 0 THEN  (lr.variance - lr.settled) ELSE 0 END) AS open_excess,
      json_agg(
        json_build_object('wallet', lr.wallet_name, 'type', lr.wallet_type,
                          'variance', lr.variance, 'settled', lr.settled)
        ORDER BY lr.variance
      ) FILTER (WHERE lr.variance <> 0) AS wallet_diffs
    FROM (
      SELECT DISTINCT ON (wr.wallet_id)
        wr.wallet_id, w.name AS wallet_name, w.wallet_type,
        COALESCE(wr.variance, wr.actual_balance - wr.book_balance)::numeric AS variance,
        COALESCE(wr.settled_amount, 0)::numeric AS settled
      FROM wallet_reconciliations wr
      JOIN wallets w ON w.id = wr.wallet_id
      WHERE w.centre_id = c.id AND wr.recon_date = t.day
      ORDER BY wr.wallet_id, wr.reconciled_at DESC, wr.id DESC
    ) lr
  ) r ON true
  WHERE ($2::int IS NULL OR c.id = $2)
`;

const isYmdOrEmpty = (d) => !d || /^\d{4}-\d{2}-\d{2}$/.test(String(d));

// ========== NIGHTLY CLOSE STATUS - ALL CENTRES (SUPERADMIN DASHBOARD) ==========
router.get('/nightly-close/all', async (req, res) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Superadmin access required' });
  }
  const { date } = req.query; // optional, "YYYY-MM-DD" (default: yesterday IST)
  if (!isYmdOrEmpty(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });

  const client = await req.db.connect();
  try {
    const result = await client.query(
      `SELECT * FROM (${CLOSING_STATUS_SQL}) x
       ORDER BY
         CASE x.status WHEN 'not_closed' THEN 0 WHEN 'incomplete' THEN 1 ELSE 2 END,
         ABS(COALESCE(x.cash_variance, 0)) DESC,
         (x.open_short + x.open_excess) DESC,
         (x.short_total + x.excess_total) DESC,
         x.centre_name`,
      [date || null, null]
    );

    res.json({
      date: result.rows[0]?.accounting_date || date || null,
      rows: result.rows
    });
  } catch (err) {
    console.error('Nightly close (all centres) error:', err);
    res.status(500).json({ error: 'Failed to load closing log' });
  } finally {
    client.release();
  }
});

// ========== CLOSING STATUS - ONE CENTRE (ADMIN DASHBOARD) ==========
// Admin: own centre. Superadmin: ?centreId=. Same row shape as /nightly-close/all.
router.get('/closing-status', requireAccounting, async (req, res) => {
  const { date } = req.query;
  if (!isYmdOrEmpty(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });

  let centreId = req.user.centre_id;
  if (req.user.role === 'superadmin' && req.query.centreId) centreId = Number(req.query.centreId);
  if (!centreId) return res.status(400).json({ error: 'centreId is required' });

  const client = await req.db.connect();
  try {
    const { rows } = await client.query(CLOSING_STATUS_SQL, [date || null, centreId]);
    res.json(rows[0] || null);
  } catch (err) {
    console.error('Closing status error:', err);
    res.status(500).json({ error: 'Failed to load closing status' });
  } finally {
    client.release();
  }
});

export default router;