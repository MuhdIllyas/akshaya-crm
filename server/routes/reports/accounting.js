import express from "express";
import jwt from "jsonwebtoken";

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

router.get('/daily-summary', async (req, res) => {
  const client = await req.db.connect();

  try {
    const { date, centreId: queryCentreId } = req.query;

    const isSuperAdmin = req.user.role === "superadmin";

    let centreId = req.user.centre_id;

    if (isSuperAdmin && queryCentreId) {
      centreId = Number(queryCentreId);
    }

    if (!centreId) {
      return res.status(400).json({ error: "centreId is required" });
    }

    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    await client.query('BEGIN');

    /* --------------------------------------------------
       1️⃣ OPENING BALANCE (yesterday closing)
    -------------------------------------------------- */
    const openingRes = await client.query(
      `
      SELECT
        COALESCE(SUM(wdb.closing_balance), 0) AS opening_balance
      FROM wallet_daily_balances wdb
      JOIN wallets w ON w.id = wdb.wallet_id
      WHERE w.centre_id = $1
        AND wdb.date = ($2::date - INTERVAL '1 day')
      `,
      [centreId, date]
    );

    const openingBalance = Number(openingRes.rows[0].opening_balance);

    /* --------------------------------------------------
       2️⃣ TODAY TRANSACTIONS (EXCLUDE TRANSFERS)
    -------------------------------------------------- */
    const txRes = await client.query(
      `
      SELECT
        wt.type,
        w.wallet_type,
        SUM(wt.amount) AS amount
      FROM wallet_transactions wt
      JOIN wallets w ON w.id = wt.wallet_id
      WHERE w.centre_id = $1
        AND wt.created_at >= $2::date
        AND wt.created_at < ($2::date + INTERVAL '1 day')
        AND (wt.category IS NULL OR wt.category != 'Transfer')
      GROUP BY wt.type, w.wallet_type
      `,
      [centreId, date]
    );

    let cashInflow = 0;
    let digitalInflow = 0;
    let bankInflow = 0;

    let cashOutflow = 0;
    let digitalOutflow = 0;
    let bankOutflow = 0;

    txRes.rows.forEach(row => {
      const amount = Number(row.amount);

      const walletType = row.wallet_type;
      const isCash = walletType === 'cash';
      const isBank = walletType === 'bank';
      const isDigital = !isCash && !isBank;

      if (row.type === 'credit') {
        if (isCash) cashInflow += amount;
        else if (isBank) bankInflow += amount;
        else if (isDigital) digitalInflow += amount;
      }

      if (row.type === 'debit') {
        if (isCash) cashOutflow += amount;
        else if (isBank) bankOutflow += amount;
        else if (isDigital) digitalOutflow += amount;
      }
    });

    await client.query('COMMIT');

    res.json({
      date,
      derived: {
        openingBalance,

        cashInflow,
        digitalInflow,
        bankInflow,

        cashOutflow,
        digitalOutflow,
        bankOutflow
      },
      actualCashInHand: 0
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Daily summary error:', err);
    res.status(500).json({ error: 'Failed to load daily summary' });
  } finally {
    client.release();
  }
});

router.get('/ledger', async (req, res) => {
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
      whereClause += `
        AND wt.created_at >= $${params.length}::date
      `;
    }

    if (to) {
      params.push(to);
      whereClause += `
        AND wt.created_at < ($${params.length}::date + INTERVAL '1 day')
      `;
    }

    if (staff_id) {
      params.push(staff_id);
      whereClause += `
        AND wt.staff_id = $${params.length}
      `;
    }

    if (wallet_id) {
      params.push(wallet_id);
      whereClause += `
        AND wt.wallet_id = $${params.length}
      `;
    }

    if (category) {
      params.push(category);
      whereClause += `
        AND wt.category = $${params.length}
      `;
    }

    if (service_id) {
      params.push(service_id);
      whereClause += `
        AND se.category_id = $${params.length}
      `;
    }

    const ledgerRes = await client.query(
      `
      SELECT DISTINCT ON (wt.id)
        wt.id,
        wt.created_at,
        wt.type,
        wt.amount,
        wt.category,

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
        ON se.staff_id = wt.staff_id
      AND DATE(se.created_at) = DATE(wt.created_at)

      LEFT JOIN services sv
        ON sv.id = se.category_id

      ${whereClause}

      ORDER BY wt.id, wt.created_at DESC
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

router.get('/income', async (req, res) => { const client = await req.db.connect();

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
    let whereClause = `
      WHERE s.centre_id = $1
        AND wt.category = 'Service Payment'
        AND wt.type = 'credit'
    `;

    // single day (payment date)
    if (date) {
      params.push(date);
      whereClause += `
        AND wt.created_at::date = $${params.length}
      `;
    }

    // date range (payment date)
    if (from) {
      params.push(from);
      whereClause += `
        AND wt.created_at >= $${params.length}::date
      `;
    }

    if (to) {
      params.push(to);
      whereClause += `
        AND wt.created_at < ($${params.length}::date + INTERVAL '1 day')
      `;
    }

    // optional staff filter
    if (staff_id) {
      params.push(staff_id);
      whereClause += `
        AND se.staff_id = $${params.length}
      `;
    }

    // optional wallet filter
    if (wallet_id) {
      params.push(wallet_id);
      whereClause += `
        AND wt.wallet_id = $${params.length}
      `;
    }

    const incomeRes = await client.query(
      `
      SELECT
        se.id AS service_entry_id,

        -- service context
        se.customer_name,
        sv.name AS service_name,
        s.name AS staff_name,

        se.created_at AS service_date,

        -- charges (reference)
        se.service_charges,
        se.department_charges,
        (se.service_charges + se.department_charges) AS service_total,

        -- 🔥 ACTUAL RECEIVED CASH
        SUM(wt.amount) AS received_amount,

        -- wallets involved
        STRING_AGG(DISTINCT w.name, ', ') AS payment_wallets,

        -- audit breakdown
        JSON_AGG(
          JSONB_BUILD_OBJECT(
            'wallet', w.name,
            'amount', wt.amount,
            'received_at', wt.created_at
          )
          ORDER BY wt.created_at
        ) AS wallet_breakdown,

        -- payment date
        MAX(wt.created_at) AS received_at,

        -- 🔥 PENDING → RECEIVED FLAG
        CASE
          WHEN MAX(wt.created_at)::date > se.created_at::date
          THEN true
          ELSE false
        END AS was_pending

      FROM wallet_transactions wt
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
        w.id,
        COALESCE(SUM(
          CASE
            WHEN wt.type = 'credit' THEN wt.amount
            WHEN wt.type = 'debit' THEN -wt.amount
          END
        ), 0) AS current_balance
      FROM wallets w
      LEFT JOIN wallet_transactions wt ON wt.wallet_id = w.id
      WHERE w.centre_id = $1
      GROUP BY w.id
    `, [centreId]);

    res.json(result.rows);
  } finally {
    client.release();
  }
});

//Reconcile Wallets
router.post('/wallet-reconcile', async (req, res) => {
  const client = await req.db.connect();

  try {
    const { reconciliations } = req.body;
    const userId = req.user.id;

    await client.query('BEGIN');

    for (const r of reconciliations) {
      await client.query(
        `
        INSERT INTO wallet_reconciliations
          (wallet_id, book_balance, actual_balance, variance, reconciled_by)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          r.wallet_id,
          r.book_balance,
          r.actual_balance,
          r.variance,
          userId
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Wallet reconciliation failed' });
  } finally {
    client.release();
  }
});

router.get('/wallet-book-balances', async (req, res) => {
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
        w.id,
        w.name,
        w.wallet_type,

        COALESCE(wdb.opening_balance, 0) AS opening_balance,

        COALESCE(
          SUM(
            CASE
              WHEN wt.type = 'credit' THEN wt.amount
              WHEN wt.type = 'debit' THEN -wt.amount
              ELSE 0
            END
          ),
          0
        ) AS net_movement,

        -- ✅ TRUE BOOK BALANCE
        COALESCE(wdb.opening_balance, 0) +
        COALESCE(
          SUM(
            CASE
              WHEN wt.type = 'credit' THEN wt.amount
              WHEN wt.type = 'debit' THEN -wt.amount
              ELSE 0
            END
          ),
          0
        ) AS book_balance

      FROM wallets w

      LEFT JOIN wallet_daily_balances wdb
        ON wdb.wallet_id = w.id
       AND wdb.date = CURRENT_DATE

      LEFT JOIN wallet_transactions wt
        ON wt.wallet_id = w.id
       AND wt.created_at::date = CURRENT_DATE

      WHERE w.centre_id = $1

      GROUP BY
        w.id,
        w.name,
        w.wallet_type,
        wdb.opening_balance

      ORDER BY w.name
    `, [centreId]);

    res.json(result.rows);

  } catch (err) {
    console.error('Wallet book balance error:', err);
    res.status(500).json({ error: 'Failed to load wallet book balances' });
  } finally {
    client.release();
  }
});

router.get('/wallet-ledger-balances', async (req, res) => {
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
        w.id,
        w.name,
        w.wallet_type,
        COALESCE(
          SUM(
            CASE
              WHEN wt.type = 'credit' THEN wt.amount
              WHEN wt.type = 'debit' THEN -wt.amount
              ELSE 0
            END
          ),
          0
        ) AS book_balance
      FROM wallets w
      LEFT JOIN wallet_transactions wt
        ON wt.wallet_id = w.id
      WHERE w.centre_id = $1
      GROUP BY w.id, w.name, w.wallet_type
      ORDER BY w.name
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
router.post('/nightly-close', async (req, res) => {
  const client = await req.db.connect();

  try {
    const centreId = req.user.centre_id;
    const userId = req.user.id;

    const {
      date,
      opening_balance,
      closing_balance,
      actual_cash,
      cash_variance,
      checklist,
      notes
    } = req.body;

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
      [
        centreId,
        date,
        opening_balance,
        closing_balance,
        actual_cash,
        cash_variance,
        checklist,
        notes,
        userId
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Nightly close error:', err);
    res.status(500).json({ error: 'Failed to close accounting day' });
  } finally {
    client.release();
  }
});

router.get('/nightly-close', async (req, res) => {
  const client = await req.db.connect();

  try {
    const { date, centreId: queryCentreId } = req.query;
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
      SELECT *
      FROM daily_accounting_closure
      WHERE centre_id = $1 AND accounting_date = $2
      `,
      [centreId, date]
    );

    res.json(result.rows[0] || null);
  } finally {
    client.release();
  }
});

export default router;