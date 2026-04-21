import express from "express";
import jwt from "jsonwebtoken";
import pool from "../../db.js";

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
router.use(requireAdmin);

/* ================================
   TRANSACTION REPORTS (FIXED FOR CORRECTION SYSTEM)
================================ */
router.get("/transactions", async (req, res) => {
  const {
    from,
    to,
    status,
    transaction_type,
    wallet_id,
    staff_id,
    search,
    sort_by = "created_at",
    sort_order = "desc",
    page = 1,
    limit = 50
  } = req.query;

  // Map frontend sort_by to actual database column names
  const sortColumnMap = {
    date: "created_at",
    time: "created_at",
    amount: "amount",
    transactionType: "transaction_type",
    status: "status",
    category: "category",
    staffName: "staff_name",
    customerName: "customer_name",
    description: "description"
  };

  const { centreId: queryCentreId } = req.query;
  const isSuperAdmin = req.user.role === "superadmin";
  let centreId = req.user.centre_id;

  if (isSuperAdmin && queryCentreId) {
    centreId = Number(queryCentreId);
  }
  if (!centreId) {
    return res.status(400).json({ error: "centreId is required" });
  }

  // Get the actual database column name for sorting
  const dbSortBy = sortColumnMap[sort_by] || sort_by;

  const offset = (page - 1) * limit;
  const filters = [];
  const values = [centreId];

  /* ----------------------------
     Filters
  ---------------------------- */
  let filterIndex = 2;

  if (from) {
    values.push(from);
    filters.push(`t.created_at >= $${filterIndex++}::date`);
  }

  if (to) {
    values.push(to);
    filters.push(`t.created_at < ($${filterIndex++}::date + INTERVAL '1 day')`);
  }

  if (status) {
    values.push(status);
    filters.push(`t.status = $${filterIndex++}`);
  }

  if (transaction_type) {
    values.push(transaction_type);
    filters.push(`t.transaction_type = $${filterIndex++}`);
  }

  if (wallet_id) {
    values.push(wallet_id);
    filters.push(`(t.from_wallet_id = $${filterIndex} OR t.to_wallet_id = $${filterIndex})`);
    filterIndex++;
  }

  if (staff_id) {
    values.push(staff_id);
    filters.push(`t.staff_id = $${filterIndex++}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    // Build the main query
    const query = `
      WITH
      -- 1️⃣ All non-transfer transactions (ONLY LATEST NON-REVERSAL)
      normal_transactions AS (
        SELECT
          wt.id::INTEGER,
          wt.wallet_id::INTEGER       AS from_wallet_id,
          NULL::INTEGER               AS to_wallet_id,
          wt.amount::NUMERIC,
          wt.type::TEXT               AS transaction_type,
          wt.category::TEXT,
          COALESCE(se.status, 'Completed')::TEXT AS status,
          wt.reference_id::INTEGER,
          wt.description::TEXT,
          wt.created_at::TIMESTAMP,
          wt.staff_id::INTEGER,
          se.customer_name::TEXT
        FROM (
          -- 🔥 FIXED: Only get latest non-reversal transaction per correction group
          SELECT DISTINCT ON (correction_group_id)
            *
          FROM wallet_transactions
          WHERE (is_reversal IS NULL OR is_reversal = FALSE)
          ORDER BY correction_group_id, created_at DESC
        ) wt
        JOIN wallets w ON w.id = wt.wallet_id
        LEFT JOIN service_entries se
          ON se.id = wt.reference_id
         AND wt.category = 'Service Payment'
        WHERE wt.category <> 'Transfer'
        AND w.centre_id = $1
      ),
      
      -- 2️⃣ Group transfer debit + credit into one logical row (exclude reversals)
      grouped_transfers AS (
        SELECT
          wt.reference_id::INTEGER    AS id,
          MAX(CASE WHEN wt.type = 'debit'  THEN wt.wallet_id END)::INTEGER AS from_wallet_id,
          MAX(CASE WHEN wt.type = 'credit' THEN wt.wallet_id END)::INTEGER AS to_wallet_id,
          MAX(wt.amount)::NUMERIC     AS amount,
          MAX(wt.created_at)::TIMESTAMP AS created_at,
          MAX(wt.staff_id)::INTEGER   AS staff_id,
          'transfer'::TEXT            AS transaction_type,
          'Transfer'::TEXT            AS category,
          'Completed'::TEXT           AS status,
          wt.reference_id::INTEGER    AS reference_id,
          'Wallet Transfer'::TEXT     AS description,
          NULL::TEXT                  AS customer_name
        FROM wallet_transactions wt
        JOIN wallets w ON w.id = wt.wallet_id
        WHERE wt.category = 'Transfer'
        -- 🔥 FIXED: Exclude reversals (transfers shouldn't have them, but safe)
        AND (wt.is_reversal IS NULL OR wt.is_reversal = FALSE)
        AND w.centre_id = $1
        GROUP BY wt.reference_id
      ),
      
      -- 3️⃣ Combine both with staff and wallet info
      all_transactions AS (
        SELECT
          nt.id,
          nt.from_wallet_id,
          nt.to_wallet_id,
          nt.amount,
          nt.transaction_type,
          nt.category,
          nt.status,
          nt.reference_id,
          nt.description,
          nt.created_at,
          nt.staff_id,
          s.name AS staff_name,
          nt.customer_name,
          w1.name AS from_wallet_name,
          w2.name AS to_wallet_name
        FROM normal_transactions nt
        LEFT JOIN staff s ON nt.staff_id = s.id
        LEFT JOIN wallets w1 ON nt.from_wallet_id = w1.id
        LEFT JOIN wallets w2 ON nt.to_wallet_id = w2.id
        
        UNION ALL
        
        SELECT
          gt.id,
          gt.from_wallet_id,
          gt.to_wallet_id,
          gt.amount,
          gt.transaction_type,
          gt.category,
          gt.status,
          gt.reference_id,
          gt.description,
          gt.created_at,
          gt.staff_id,
          s.name AS staff_name,
          gt.customer_name,
          w1.name AS from_wallet_name,
          w2.name AS to_wallet_name
        FROM grouped_transfers gt
        LEFT JOIN staff s ON gt.staff_id = s.id
        LEFT JOIN wallets w1 ON gt.from_wallet_id = w1.id
        LEFT JOIN wallets w2 ON gt.to_wallet_id = w2.id
      )
      
      -- 4️⃣ Apply filters, sorting and pagination
      SELECT *
      FROM all_transactions t
      ${whereClause}
      ORDER BY ${dbSortBy} ${sort_order}
      LIMIT $${filterIndex} OFFSET $${filterIndex + 1}`;

    // Count query (FIXED to exclude reversals and duplicates)
    const countQuery = `
      WITH
      normal_transactions AS (
        SELECT
          wt.id::INTEGER,
          wt.wallet_id::INTEGER       AS from_wallet_id,
          NULL::INTEGER               AS to_wallet_id,
          wt.amount::NUMERIC,
          wt.type::TEXT               AS transaction_type,
          wt.category::TEXT,
          COALESCE(se.status, 'Completed')::TEXT AS status,
          wt.reference_id::INTEGER,
          wt.description::TEXT,
          wt.created_at::TIMESTAMP,
          wt.staff_id::INTEGER,
          se.customer_name::TEXT
        FROM (
          -- 🔥 FIXED: Only get latest non-reversal transaction per correction group
          SELECT DISTINCT ON (correction_group_id)
            *
          FROM wallet_transactions
          WHERE (is_reversal IS NULL OR is_reversal = FALSE)
          ORDER BY correction_group_id, created_at DESC
        ) wt
        JOIN wallets w ON w.id = wt.wallet_id
        LEFT JOIN service_entries se
          ON se.id = wt.reference_id
         AND wt.category = 'Service Payment'
        WHERE wt.category <> 'Transfer'
        AND w.centre_id = $1
      ),
      
      grouped_transfers AS (
        SELECT
          wt.reference_id::INTEGER    AS id,
          MAX(CASE WHEN wt.type = 'debit'  THEN wt.wallet_id END)::INTEGER AS from_wallet_id,
          MAX(CASE WHEN wt.type = 'credit' THEN wt.wallet_id END)::INTEGER AS to_wallet_id,
          MAX(wt.amount)::NUMERIC     AS amount,
          MAX(wt.created_at)::TIMESTAMP AS created_at,
          MAX(wt.staff_id)::INTEGER   AS staff_id,
          'transfer'::TEXT            AS transaction_type,
          'Transfer'::TEXT            AS category,
          'Completed'::TEXT           AS status,
          wt.reference_id::INTEGER    AS reference_id,
          'Wallet Transfer'::TEXT     AS description,
          NULL::TEXT                  AS customer_name
        FROM wallet_transactions wt
        JOIN wallets w ON w.id = wt.wallet_id
        WHERE wt.category = 'Transfer'
        -- 🔥 FIXED: Exclude reversals
        AND (wt.is_reversal IS NULL OR wt.is_reversal = FALSE)
        AND w.centre_id = $1
        GROUP BY wt.reference_id
      )
      
      SELECT COUNT(*) as total
      FROM (
        SELECT id FROM normal_transactions
        UNION ALL
        SELECT id FROM grouped_transfers
      ) AS combined_ids`;

    // Get total count
    const { rows: countRows } = await pool.query(countQuery, [centreId]);
    const total = parseInt(countRows[0].total);

    // Add limit and offset to values array for main query
    values.push(limit, offset);

    // Get paginated data
    const { rows } = await pool.query(query, values);

    res.json({
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit),
      transactions: rows.map(r => ({
        id: r.id,
        transactionType: r.transaction_type,
        amount: Number(r.amount),
        status: r.status,
        category: r.category,
        fromWalletId: r.from_wallet_id,
        fromWalletName: r.from_wallet_name,
        toWalletId: r.to_wallet_id,
        toWalletName: r.to_wallet_name,
        staffId: r.staff_id,
        staffName: r.staff_name,
        customerName: r.customer_name || null,
        description: r.description,
        referenceId: r.reference_id,
        date: r.created_at ? r.created_at.toISOString().split("T")[0] : null,
        time: r.created_at ? r.created_at.toISOString().split("T")[1].slice(0, 5) : null
      }))
    });
  } catch (err) {
    console.error("Transaction report error:", err);
    res.status(500).json({ error: "Failed to load transaction reports" });
  }
});

export default router;
