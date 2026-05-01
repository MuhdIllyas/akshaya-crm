import express from "express";
import jwt from "jsonwebtoken";
import pool from "../../db.js";

const router = express.Router();

/* ================================
   AUTH MIDDLEWARE
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
  if (!["admin", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

router.use(authenticateToken);
router.use(requireAdmin);

/* =========================================================
   1️⃣ STAFF PERFORMANCE + EFFICIENCY + INCENTIVE READINESS
========================================================= */
router.get("/staff-performance", async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: "from and to are required" });
    }

    const params = [from, to];
    let centreFilter = "";

    // Admin → fixed centre
    if (req.user.role === "admin") {
      params.push(req.user.centre_id);
      centreFilter = `AND s.centre_id = $${params.length}`;
    }

    // SuperAdmin → selected centre
    if (req.user.role === "superadmin" && req.query.centreId) {
      params.push(Number(req.query.centreId));
      centreFilter = `AND s.centre_id = $${params.length}`;
    }

    const { rows } = await pool.query(
      `
      WITH service_agg AS (
        SELECT
          se.staff_id,
          COUNT(se.id) AS services_completed,
          COUNT(DISTINCT se.created_at::date) AS active_days,
          SUM(se.total_charges) AS expected_amount,
          SUM(se.service_charges) AS service_charge_earned,

          ROUND(
            SUM(se.total_charges)::numeric
            / NULLIF(COUNT(se.id), 0),
            2
          ) AS avg_ticket_size,

          ROUND(
            SUM(se.total_charges)::numeric
            / NULLIF(COUNT(DISTINCT se.created_at::date), 0),
            2
          ) AS revenue_per_day,

          ROUND(
            SUM(se.service_charges)::numeric
            / NULLIF(COUNT(DISTINCT se.created_at::date), 0),
            2
          ) AS profit_per_day,

          MAX(
            ROUND(
              SUM(se.total_charges)::numeric
              / NULLIF(COUNT(DISTINCT se.created_at::date), 0),
              2
            )
          ) OVER () AS max_revenue_per_day

        FROM service_entries se
        WHERE se.created_at::date BETWEEN $1 AND $2
        GROUP BY se.staff_id
      ),

      payment_agg AS (
        SELECT
          se.staff_id,
          SUM(p.amount) FILTER (WHERE p.status = 'received') AS collected_amount
        FROM payments p
        JOIN service_entries se ON se.id = p.service_entry_id
        WHERE p.created_at::date BETWEEN $1 AND $2
          -- 🔥 CRITICAL FIX: Exclude payments that have been reversed/corrected
          AND COALESCE(p.is_reversal, FALSE) = FALSE
          AND NOT EXISTS (
            SELECT 1 FROM wallet_transactions wt 
            WHERE wt.reference_payment_id = p.id AND COALESCE(wt.is_reversal, FALSE) = TRUE
          )
        GROUP BY se.staff_id
      ),

      /* 🔥 NEW: Review Aggregation */
      review_agg AS (
        SELECT
          sr.staff_id,
          COUNT(sr.id) AS total_reviews,
          ROUND(AVG(sr.staff_rating)::numeric, 2) AS avg_staff_rating
        FROM service_reviews sr
        WHERE sr.is_submitted = true
          AND sr.staff_rating IS NOT NULL
        GROUP BY sr.staff_id
      )

      SELECT
        s.id   AS staff_id,
        s.name AS staff_name,

        COALESCE(sa.services_completed, 0) AS services_completed,
        COALESCE(sa.active_days, 0) AS active_days,

        COALESCE(sa.expected_amount, 0) AS expected_amount,
        COALESCE(sa.service_charge_earned, 0) AS service_charge_earned,
        COALESCE(pa.collected_amount, 0) AS collected_amount,

        COALESCE(sa.avg_ticket_size, 0) AS avg_ticket_size,
        COALESCE(sa.revenue_per_day, 0) AS revenue_per_day,
        COALESCE(sa.profit_per_day, 0) AS profit_per_day,

        /* 🔥 Review Data */
        COALESCE(ra.total_reviews, 0) AS total_reviews,
        COALESCE(ra.avg_staff_rating, 0) AS avg_staff_rating,

        /* Incentive Score */
        ROUND(
          (
            (COALESCE(pa.collected_amount, 0)
            / NULLIF(sa.expected_amount, 0)) * 50

            +

            (sa.revenue_per_day
            / NULLIF(sa.max_revenue_per_day, 0)) * 30

            +

            (sa.active_days
            / NULLIF(($2::date - $1::date + 1), 0)) * 20
          )::numeric,
          0
        ) AS incentive_score

      FROM staff s
      LEFT JOIN service_agg sa ON sa.staff_id = s.id
      LEFT JOIN payment_agg pa ON pa.staff_id = s.id
      LEFT JOIN review_agg ra  ON ra.staff_id = s.id

      WHERE s.role = 'staff'
      ${centreFilter}

      ORDER BY collected_amount DESC;
      `,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error("Staff performance report error:", err);
    res.status(500).json({ error: "Failed to fetch staff performance" });
  }
});

/* =========================================================
   1.5️⃣ TRAINEE / PROBATION PERFORMANCE (SEPARATE VIEW)
========================================================= */
router.get("/trainee-performance", async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: "from and to are required" });
    }

    const params = [from, to];
    let centreFilter = "";

    // Admin → fixed centre
    if (req.user.role === "admin") {
      params.push(req.user.centre_id);
      centreFilter = `AND s.centre_id = $${params.length}`;
    }

    // SuperAdmin → selected centre
    if (req.user.role === "superadmin" && req.query.centreId) {
      params.push(Number(req.query.centreId));
      centreFilter = `AND s.centre_id = $${params.length}`;
    }

    const { rows } = await pool.query(
      `
      WITH service_agg AS (
        SELECT
          se.staff_id,
          COUNT(se.id) AS services_completed,
          COUNT(DISTINCT se.created_at::date) AS active_days,
          SUM(se.total_charges) AS expected_amount,
          SUM(se.service_charges) AS service_charge_earned,

          ROUND(
            SUM(se.total_charges)::numeric
            / NULLIF(COUNT(se.id), 0),
            2
          ) AS avg_ticket_size,

          ROUND(
            SUM(se.total_charges)::numeric
            / NULLIF(COUNT(DISTINCT se.created_at::date), 0),
            2
          ) AS revenue_per_day,

          ROUND(
            SUM(se.service_charges)::numeric
            / NULLIF(COUNT(DISTINCT se.created_at::date), 0),
            2
          ) AS profit_per_day,

          MAX(
            ROUND(
              SUM(se.total_charges)::numeric
              / NULLIF(COUNT(DISTINCT se.created_at::date), 0),
              2
            )
          ) OVER () AS max_revenue_per_day

        FROM service_entries se
        WHERE se.created_at::date BETWEEN $1 AND $2
        GROUP BY se.staff_id
      ),

      payment_agg AS (
        SELECT
          se.staff_id,
          SUM(p.amount) FILTER (WHERE p.status = 'received') AS collected_amount
        FROM payments p
        JOIN service_entries se ON se.id = p.service_entry_id
        WHERE p.created_at::date BETWEEN $1 AND $2
          AND COALESCE(p.is_reversal, FALSE) = FALSE
          AND NOT EXISTS (
            SELECT 1 FROM wallet_transactions wt 
            WHERE wt.reference_payment_id = p.id AND COALESCE(wt.is_reversal, FALSE) = TRUE
          )
        GROUP BY se.staff_id
      ),

      /* Review Aggregation */
      review_agg AS (
        SELECT
          sr.staff_id,
          COUNT(sr.id) AS total_reviews,
          ROUND(AVG(sr.staff_rating)::numeric, 2) AS avg_staff_rating
        FROM service_reviews sr
        WHERE sr.is_submitted = true
          AND sr.staff_rating IS NOT NULL
        GROUP BY sr.staff_id
      )

      SELECT
        s.id   AS staff_id,
        s.name AS staff_name,

        COALESCE(sa.services_completed, 0) AS services_completed,
        COALESCE(sa.active_days, 0) AS active_days,

        COALESCE(sa.expected_amount, 0) AS expected_amount,
        COALESCE(sa.service_charge_earned, 0) AS service_charge_earned,
        COALESCE(pa.collected_amount, 0) AS collected_amount,

        COALESCE(sa.avg_ticket_size, 0) AS avg_ticket_size,
        COALESCE(sa.revenue_per_day, 0) AS revenue_per_day,
        COALESCE(sa.profit_per_day, 0) AS profit_per_day,

        /* Review Data */
        COALESCE(ra.total_reviews, 0) AS total_reviews,
        COALESCE(ra.avg_staff_rating, 0) AS avg_staff_rating,

        /* Incentive Score (Even for trainees, it's good to see their metric progress) */
        ROUND(
          (
            (COALESCE(pa.collected_amount, 0)
            / NULLIF(sa.expected_amount, 0)) * 50

            +

            (sa.revenue_per_day
            / NULLIF(sa.max_revenue_per_day, 0)) * 30

            +

            (sa.active_days
            / NULLIF(($2::date - $1::date + 1), 0)) * 20
          )::numeric,
          0
        ) AS incentive_score

      FROM staff s
      LEFT JOIN service_agg sa ON sa.staff_id = s.id
      LEFT JOIN payment_agg pa ON pa.staff_id = s.id
      LEFT JOIN review_agg ra  ON ra.staff_id = s.id

      WHERE s.role = 'staff'
        -- 🔥 CRITICAL: ONLY FETCH PROBATION/TRAINEE STAFF
        AND s.employment_type = 'probation'
      ${centreFilter}

      ORDER BY collected_amount DESC;
      `,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error("Trainee performance report error:", err);
    res.status(500).json({ error: "Failed to fetch trainee performance" });
  }
});

/* =========================================================
   2️⃣ SERVICE-WISE (CATEGORY-WISE) STRENGTH
   service_entries.category_id → services.id
========================================================= */
router.get("/staff/:staffId/category-strength", async (req, res) => {
  try {
    const { staffId } = req.params;
    const { from, to, centreId: queryCentreId } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        error: "from and to are required",
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

    const params = [staffId, from, to, centreId];

    const { rows } = await pool.query(
      `
      SELECT
        srv.id   AS service_id,
        srv.name AS service_name,

        COUNT(se.id) AS applications,
        COALESCE(SUM(se.total_charges), 0) AS revenue,
        COALESCE(SUM(se.service_charges), 0) AS profit

      FROM service_entries se
      JOIN services srv ON srv.id = se.category_id
      JOIN staff st     ON st.id = se.staff_id

      WHERE se.staff_id = $1
        AND se.created_at::date BETWEEN $2 AND $3
        AND st.centre_id = $4

      GROUP BY srv.id, srv.name
      ORDER BY revenue DESC;
      `,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error("Service-wise staff performance error:", err);
    res.status(500).json({
      error: "Failed to fetch service-wise strength",
    });
  }
});

router.get("/review-summary", async (req, res) => {
  try {
    const { from, to, centreId } = req.query;

    const params = [];
    let centreFilter = "";
    let dateFilter = "";

    // 🔐 Admin → fixed centre
    if (req.user.role === "admin") {
      params.push(req.user.centre_id);
      centreFilter = `AND s.centre_id = $${params.length}`;
    }

    // 🔐 Superadmin → selected centre
    if (req.user.role === "superadmin" && centreId) {
      params.push(Number(centreId));
      centreFilter = `AND s.centre_id = $${params.length}`;
    }

    // 📅 Date filter (based on review submission date)
    if (from && to) {
      params.push(from, to);
      dateFilter = `AND sr.submitted_at::date BETWEEN $${params.length - 1} AND $${params.length}`;
    }

    const { rows } = await pool.query(
      `
      SELECT
        COUNT(sr.id) AS total_reviews,
        ROUND(AVG(sr.service_rating)::numeric, 2) AS avg_service_rating,
        ROUND(AVG(sr.staff_rating)::numeric, 2) AS avg_staff_rating
      FROM service_reviews sr
      JOIN staff s ON s.id = sr.staff_id
      WHERE sr.is_submitted = true
      ${centreFilter}
      ${dateFilter};
      `,
      params
    );

    res.json(rows[0] || {
      total_reviews: 0,
      avg_service_rating: 0,
      avg_staff_rating: 0
    });

  } catch (err) {
    console.error("Review summary error:", err);
    res.status(500).json({ error: "Failed to fetch review summary" });
  }
});

//ratiing distribution for chart
router.get("/rating-distribution", async (req, res) => {
  try {
    const { centreId, from, to } = req.query;

    const params = [];
    let centreFilter = "";
    let dateFilter = "";

    // 🔐 Admin
    if (req.user.role === "admin") {
      params.push(req.user.centre_id);
      centreFilter = `AND s.centre_id = $${params.length}`;
    }

    // 🔐 Superadmin
    if (req.user.role === "superadmin" && centreId) {
      params.push(Number(centreId));
      centreFilter = `AND s.centre_id = $${params.length}`;
    }

    // 📅 Date filter
    if (from && to) {
      params.push(from, to);
      dateFilter = `AND sr.submitted_at::date BETWEEN $${params.length - 1} AND $${params.length}`;
    }

    const { rows } = await pool.query(
      `
      SELECT
        sr.staff_rating,
        COUNT(sr.id) AS count
      FROM service_reviews sr
      JOIN staff s ON s.id = sr.staff_id
      WHERE sr.is_submitted = true
        AND sr.staff_rating IS NOT NULL
      ${centreFilter}
      ${dateFilter}
      GROUP BY sr.staff_rating
      ORDER BY sr.staff_rating;
      `,
      params
    );

    res.json(rows);

  } catch (err) {
    console.error("Rating distribution error:", err);
    res.status(500).json({ error: "Failed to fetch rating distribution" });
  }
});

export default router;