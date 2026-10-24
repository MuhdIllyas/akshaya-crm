import express from "express";
import jwt from "jsonwebtoken";
import pool from "../../db.js";
import { isYMD } from "../../utils/dates.js";

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

/* Frontend sort keys → SQL. Anything else falls back to date.
   (sort_by / sort_order used to be pasted straight into the SQL.) */
const SORT_COLUMNS = {
  date: "t.created_at",
  time: "t.created_at",
  created_at: "t.created_at",
  amount: "t.amount",
  transactionType: "t.transaction_type",
  status: "t.status",
  category: "t.category",
  staffName: "t.staff_name",
  customerName: "t.customer_name",
  description: "t.description",
};

/* One row per normal transaction, one row per transfer (both legs merged).
   created_at stays timestamptz; the IST date/time are formatted in SQL.

   Transfer legs: new transfers point at each other through reference_id, so
   LEAST(id, reference_id) is the same for both legs. Old transfers had
   reference_id NULL and were ALL merged into a single row; run
   link-old-transfers.sql once to link them. A leg that still has no partner
   is shown on its own. */
const BASE_CTE = `
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
      wt.created_at,
      wt.staff_id::INTEGER,
      se.customer_name::TEXT
    FROM wallet_transactions wt
    LEFT JOIN service_entries se
      ON se.id = wt.reference_id
      AND wt.category = 'Service Payment'
    WHERE wt.category <> 'Transfer'
  ),

  grouped_transfers AS (
    SELECT
      COALESCE(LEAST(wt.id, wt.reference_id), wt.id)::INTEGER AS id,
      MAX(CASE WHEN wt.type = 'debit'  THEN wt.wallet_id END)::INTEGER AS from_wallet_id,
      MAX(CASE WHEN wt.type = 'credit' THEN wt.wallet_id END)::INTEGER AS to_wallet_id,
      -- same column order as normal_transactions (combined uses UNION ALL of SELECT *)
      MAX(wt.amount)::NUMERIC     AS amount,
      'transfer'::TEXT            AS transaction_type,
      'Transfer'::TEXT            AS category,
      'Completed'::TEXT           AS status,
      COALESCE(LEAST(wt.id, wt.reference_id), wt.id)::INTEGER AS reference_id,
      'Wallet Transfer'::TEXT     AS description,
      MAX(wt.created_at)          AS created_at,
      MAX(wt.staff_id)::INTEGER   AS staff_id,
      NULL::TEXT                  AS customer_name
    FROM wallet_transactions wt
    WHERE wt.category = 'Transfer'
    GROUP BY COALESCE(LEAST(wt.id, wt.reference_id), wt.id)
  ),

  combined AS (
    SELECT * FROM normal_transactions
    UNION ALL
    SELECT * FROM grouped_transfers
  ),

  all_transactions AS (
    SELECT
      c.*,
      COALESCE(w1.centre_id, w2.centre_id) AS centre_id,
      s.name  AS staff_name,
      w1.name AS from_wallet_name,
      w2.name AS to_wallet_name
    FROM combined c
    LEFT JOIN staff s    ON c.staff_id = s.id
    LEFT JOIN wallets w1 ON c.from_wallet_id = w1.id
    LEFT JOIN wallets w2 ON c.to_wallet_id = w2.id
  )
`;

/* ================================
   TRANSACTION REPORTS
   Fixes vs old version:
   - filtered by centre (admin = own centre; superadmin = ?centreId=, or all)
   - search actually filters (it was ignored)
   - total / totalPages count the FILTERED rows (they counted everything)
   - from/to are IST days; date/time returned in IST (were UTC)
   - transfers no longer collapse into one row
   - sort column/direction whitelisted
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
    sort_by = "date",
    sort_order = "desc",
  } = req.query;

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = (page - 1) * limit;

  const orderBy = SORT_COLUMNS[sort_by] || "t.created_at";
  const direction = String(sort_order).toLowerCase() === "asc" ? "ASC" : "DESC";

  const filters = [];
  const values = [];
  const add = (sql, value) => {
    values.push(value);
    filters.push(sql.replaceAll("?", `$${values.length}`));
  };

  // Centre scope
  if (req.user.role === "superadmin") {
    const centreId = parseInt(req.query.centreId, 10);
    if (!Number.isNaN(centreId)) add("t.centre_id = ?", centreId);
  } else {
    add("t.centre_id = ?", req.user.centre_id);
  }

  // IST day bounds
  if (from) {
    if (!isYMD(from)) return res.status(400).json({ error: "from must be YYYY-MM-DD" });
    add("t.created_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'", from);
  }
  if (to) {
    if (!isYMD(to)) return res.status(400).json({ error: "to must be YYYY-MM-DD" });
    add("t.created_at < (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'", to);
  }

  if (status) add("t.status = ?", status);
  if (transaction_type) add("t.transaction_type = ?", transaction_type);
  if (wallet_id) add("(t.from_wallet_id = ? OR t.to_wallet_id = ?)", parseInt(wallet_id, 10));
  if (staff_id) add("t.staff_id = ?", parseInt(staff_id, 10));

  if (search && String(search).trim()) {
    add(
      `(t.description ILIKE ? OR t.staff_name ILIKE ? OR t.customer_name ILIKE ?
        OR t.category ILIKE ? OR t.from_wallet_name ILIKE ? OR t.to_wallet_name ILIKE ?)`,
      `%${String(search).trim()}%`
    );
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const countQuery = `${BASE_CTE}
      SELECT COUNT(*)::int AS total
      FROM all_transactions t
      ${whereClause}`;

    const dataQuery = `${BASE_CTE}
      SELECT
        t.*,
        to_char(t.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS ist_date,
        to_char(t.created_at AT TIME ZONE 'Asia/Kolkata', 'HH24:MI')    AS ist_time
      FROM all_transactions t
      ${whereClause}
      ORDER BY ${orderBy} ${direction}, t.id ${direction}
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;

    const [{ rows: countRows }, { rows }] = await Promise.all([
      pool.query(countQuery, values),
      pool.query(dataQuery, [...values, limit, offset]),
    ]);
    const total = countRows[0].total;

    res.json({
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      transactions: rows.map((r) => ({
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
        date: r.ist_date, // IST "YYYY-MM-DD"
        time: r.ist_time, // IST "HH:MM"
      })),
    });
  } catch (err) {
    console.error("Transaction report error:", err);
    res.status(500).json({ error: "Failed to load transaction reports" });
  }
});

export default router;