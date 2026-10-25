// backend/routes/staffPerformance.js
import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { logActivity } from '../utils/activityLogger.js';
import { ensureTargets, refreshActive } from '../utils/staffTargets.js';
import { todayIST, addDays } from '../utils/dates.js';

const router = express.Router();

// 🔥 FIXED: was an uncorrelated subquery that re-scanned the ENTIRE wallet_transactions
// table (no staff_id/date/reference_id filter) on every single usage — 18 uses per file,
// up to ~4 concurrent requests per page load. Cost grew with table size ("after some usage")
// until it starved the pg pool. Now a LATERAL join filtered to ONE reference_id per row,
// so Postgres can use an index seek instead of a full scan + sort each time.
// Requires: CREATE INDEX idx_wallet_tx_service_payment ON wallet_transactions
//   (reference_id, category, type, reference_type, created_at DESC)
//   WHERE category = 'Service Payment' AND type = 'credit' AND reference_type = 'payment';
const paymentsLateralJoin = (seAlias = 'se') => `
  LEFT JOIN LATERAL (
    SELECT
      SUM(amount) AS amount,
      SUM(amount) AS received_amount,
      MAX(created_at) AS payment_date
    FROM (
      SELECT DISTINCT ON (COALESCE(NULLIF(correction_group_id::text, ''), id::text))
        amount, is_reversal, created_at
      FROM wallet_transactions
      WHERE reference_id = ${seAlias}.id
        AND category = 'Service Payment'
        AND type = 'credit'
        AND reference_type = 'payment'
      ORDER BY COALESCE(NULLIF(correction_group_id::text, ''), id::text), created_at DESC, is_reversal ASC
    ) lt
    WHERE (lt.is_reversal IS NULL OR lt.is_reversal = FALSE)
  ) p ON true
`;

// Middleware to verify token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token verification error:', err.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Middleware to restrict to staff role
const requireStaff = (req, res, next) => {
  if (req.user.role !== 'staff') {
    return res.status(403).json({ error: 'Staff access required' });
  }
  next();
};

// Apply middleware to all routes
router.use(authenticateToken);
router.use(requireStaff);

/* =========================================================
   SHARED: periods and the performance score
   (staging test: the staff dashboard said 74% and the Performance page 64%,
   because the two routes used different formulas, different statuses and
   different rating periods. Both now use the helpers below.)
========================================================= */
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const isYMD = (v) => typeof v === 'string' && YMD_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const ymdUTC = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10); // month 0 = Dec of year before
const daysIncl = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) + 1;
const weekdayMon0 = (ymd) => (new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
const ALL_START = '2000-01-01';

/* Resolve ?period= / ?from=&to= into IST calendar days.
   start..end   = the days counted for performance (never after today)
   windowEnd    = last day of the calendar period (for upcoming deliveries / events)
   all          = no date limit
   Returns { error } for bad input. */
const resolvePeriod = (query = {}, fallback = 'month') => {
  const today = todayIST();
  const [ty, tm] = today.split('-').map(Number);
  const { from, to } = query;
  let period = query.period || fallback;
  if (period === 'monthly') period = 'month'; // old default spelling

  if (from || to || period === 'custom') {
    if (!isYMD(from) || !isYMD(to)) return { error: 'from and to must be YYYY-MM-DD' };
    if (from > to) return { error: 'from must be on or before to' };
    return { period: 'custom', start: from, end: to, windowEnd: to, all: false };
  }

  switch (period) {
    case 'today':
      return { period, start: today, end: today, windowEnd: today, all: false };
    case 'yesterday': {
      const y = addDays(today, -1);
      return { period, start: y, end: y, windowEnd: y, all: false };
    }
    case 'week': { // Monday → today (same as date_trunc('week'))
      const start = addDays(today, -weekdayMon0(today));
      return { period, start, end: today, windowEnd: addDays(start, 6), all: false };
    }
    case 'quarter': {
      const q = Math.floor((tm - 1) / 3) * 3 + 1;
      return { period, start: ymdUTC(ty, q, 1), end: today, windowEnd: ymdUTC(ty, q + 3, 0), all: false };
    }
    case 'year':
      return { period, start: `${ty}-01-01`, end: today, windowEnd: `${ty}-12-31`, all: false };
    case 'all':
      return { period, start: ALL_START, end: today, windowEnd: null, all: true };
    case 'month':
    default:
      return { period: 'month', start: ymdUTC(ty, tm, 1), end: today, windowEnd: ymdUTC(ty, tm + 1, 0), all: false };
  }
};

/* One formula everywhere (matches the tooltip on the Performance page):
   collection rate 50% + revenue efficiency 30% (₹5,000/day = full marks) + consistency 20% */
const computeIncentiveScore = ({ collectionRate, avgDailyRevenue, activeDays, totalDays }) => {
  const collectionScore = Math.min(Math.max(Number(collectionRate) || 0, 0), 100);
  const revenueScore = Math.min(((Number(avgDailyRevenue) || 0) / 5000) * 100, 100);
  const consistencyScore = totalDays > 0 ? Math.min(((Number(activeDays) || 0) / totalDays) * 100, 100) : 0;
  return Math.round(collectionScore * 0.5 + revenueScore * 0.3 + consistencyScore * 0.2);
};

/* Summary used by BOTH /dashboard and /workspace-init, so their numbers match.
   Counts completed + pending entries (pending = still has money to collect). */
const loadPerformanceSummary = async (client, staffId, range) => {
  const { rows } = await client.query(`
    SELECT
      COUNT(DISTINCT se.id)                    AS total_services,
      COUNT(DISTINCT se.customer_name)         AS unique_customers,
      COUNT(DISTINCT DATE(se.created_at))      AS active_days,
      MIN(DATE(se.created_at))::text           AS first_day,
      COALESCE(SUM(se.total_charges), 0)       AS total_billed,
      COALESCE(SUM(se.service_charges), 0)     AS total_service_charges,
      COALESCE(SUM(se.department_charges), 0)  AS total_department_charges,
      COALESCE(SUM(p.amount), 0)               AS total_collected,
      COALESCE(AVG(p.amount), 0)               AS avg_transaction_value
    FROM service_entries se
    ${paymentsLateralJoin()}
    WHERE se.staff_id = $1
      AND se.status IN ('completed', 'pending')
      AND se.created_at >= $2::date AND se.created_at < ($3::date + 1)
  `, [staffId, range.start, range.end]);

  const r = rows[0] || {};
  const totalServices = parseInt(r.total_services || 0, 10);
  const activeDays = parseInt(r.active_days || 0, 10);
  const totalBilled = parseFloat(r.total_billed || 0);
  const totalCollected = parseFloat(r.total_collected || 0);
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 10000) / 100 : 0;
  const avgDailyRevenue = activeDays > 0 ? Math.round((totalCollected / activeDays) * 100) / 100 : 0;
  // "All time" counts from the first service day, not from the year 2000
  const startForDays = range.all ? (r.first_day || range.end) : range.start;
  const totalDays = Math.max(daysIncl(startForDays, range.end), 1);

  return {
    total_services: totalServices,
    unique_customers: parseInt(r.unique_customers || 0, 10),
    active_days: activeDays,
    total_billed: totalBilled,
    total_service_charges: parseFloat(r.total_service_charges || 0),
    total_department_charges: parseFloat(r.total_department_charges || 0),
    total_collected: totalCollected,
    avg_transaction_value: parseFloat(r.avg_transaction_value || 0),
    collection_rate: collectionRate,
    avg_daily_revenue: avgDailyRevenue,
    avg_daily_services: activeDays > 0 ? Math.round((totalServices / activeDays) * 100) / 100 : 0,
    total_days: totalDays,
    incentive_score: computeIncentiveScore({ collectionRate, avgDailyRevenue, activeDays, totalDays }),
  };
};

/* Ratings for the same period (both pages). Uses the review's own date. */
const loadRatings = (client, staffId, range) => client.query(`
  SELECT
    COUNT(*) AS total_reviews,
    COALESCE(AVG(staff_rating), 0)   AS avg_staff_rating,
    COALESCE(AVG(service_rating), 0) AS avg_service_rating,
    COUNT(CASE WHEN staff_rating >= 4 THEN 1 END) AS positive_reviews,
    COUNT(CASE WHEN staff_rating <= 2 THEN 1 END) AS negative_reviews,
    COUNT(CASE WHEN staff_rating = 5 THEN 1 END) AS five_star,
    COUNT(CASE WHEN staff_rating = 4 THEN 1 END) AS four_star,
    COUNT(CASE WHEN staff_rating = 3 THEN 1 END) AS three_star,
    COUNT(CASE WHEN staff_rating = 2 THEN 1 END) AS two_star,
    COUNT(CASE WHEN staff_rating = 1 THEN 1 END) AS one_star
  FROM service_reviews
  WHERE staff_id = $1
    AND is_submitted = true
    AND created_at >= $2::date AND created_at < ($3::date + 1)
`, [staffId, range.start, range.end]);

const pct = (n) => Math.round(n * 100) / 100;

/* =========================================================
   1️⃣ STAFF PERFORMANCE DASHBOARD
   Comprehensive performance metrics for current staff member
========================================================= */
router.get('/dashboard', async (req, res) => {
  const range = resolvePeriod(req.query, 'month');
  if (range.error) return res.status(400).json({ success: false, error: range.error });
  const { start: startDate, end: endDate } = range;

  const client = await pool.connect();

  try {
    const staffId = req.user.id;

    // 1️⃣ Get staff basic info
    const staffInfoQuery = `
      SELECT
        s.id,
        s.name,
        s.username,
        s.email,
        s.phone,
        s.role,
        s.join_date as "joinDate",
        s.photo,
        s.department,
        s.centre_id as "centreId",
        c.name as "centreName"
      FROM staff s
      LEFT JOIN centres c ON s.centre_id = c.id
      WHERE s.id = $1
    `;
    const staffInfo = await client.query(staffInfoQuery, [staffId]);

    if (staffInfo.rows.length === 0) {
      return res.status(404).json({ error: 'Staff not found' });
    }

    // 2b️⃣ Repeat Customer Rate
    const repeatCustomerQuery = `
      WITH customer_visits AS (
        SELECT
          customer_name,
          COUNT(DISTINCT se.id) as visit_count
        FROM service_entries se
        WHERE se.staff_id = $1
          AND se.status IN ('completed', 'pending')
          AND se.created_at >= $2::date AND se.created_at < ($3::date + 1)
          AND se.customer_name IS NOT NULL
          AND se.customer_name != ''
        GROUP BY customer_name
      )
      SELECT
        COUNT(*) as total_customers,
        COUNT(CASE WHEN visit_count > 1 THEN 1 END) as repeat_customers
      FROM customer_visits
    `;

    // 2d️⃣ Collection Efficiency (% of paid services paid within 7 days)
    const collectionEfficiencyQuery = `
      SELECT
        COUNT(DISTINCT se.id) as total_services_with_payments,
        COUNT(DISTINCT CASE
          WHEN p.received_amount > 0 AND (se.created_at::date + INTERVAL '7 days') >= p.payment_date
          THEN se.id
        END) as ontime_paid_services
      FROM service_entries se
      ${paymentsLateralJoin()}
      WHERE se.staff_id = $1
        AND se.status IN ('completed', 'pending')
        AND se.created_at >= $2::date AND se.created_at < ($3::date + 1)
        AND p.received_amount > 0
    `;

    // 3️⃣ Pending Payments (all open ones, not only this period)
    const pendingQuery = `
      SELECT
        COUNT(se.id) as pending_count,
        COALESCE(SUM(se.total_charges - COALESCE(p.received_amount, 0)), 0) as pending_amount,
        COUNT(CASE WHEN (CURRENT_DATE - se.created_at::date) > 7
              AND (se.total_charges - COALESCE(p.received_amount, 0)) > 0 THEN 1 END) as overdue_count,
        COALESCE(SUM(CASE WHEN (CURRENT_DATE - se.created_at::date) > 7
              THEN (se.total_charges - COALESCE(p.received_amount, 0)) ELSE 0 END), 0) as overdue_amount
      FROM service_entries se
      ${paymentsLateralJoin()}
      WHERE se.staff_id = $1
        AND se.status != 'completed'
        AND (se.total_charges - COALESCE(p.received_amount, 0)) > 0
    `;

    // 4️⃣ Daily Performance for Charts (date as plain "YYYY-MM-DD", IST day)
    const dailyPerformanceQuery = `
      SELECT
        TO_CHAR(DATE(se.created_at), 'YYYY-MM-DD') as date,
        COUNT(DISTINCT se.id) as services_count,
        COALESCE(SUM(se.total_charges), 0) as billed_amount,
        COALESCE(SUM(p.amount), 0) as collected_amount,
        COALESCE(SUM(se.service_charges), 0) as service_charges
      FROM service_entries se
      ${paymentsLateralJoin()}
      WHERE se.staff_id = $1
        AND se.status IN ('completed', 'pending')
        AND se.created_at >= $2::date AND se.created_at < ($3::date + 1)
      GROUP BY DATE(se.created_at)
      ORDER BY DATE(se.created_at) ASC
    `;

    // 5️⃣ Service Category Breakdown
    const categoryQuery = `
      SELECT
        s.id as service_id,
        s.name as service_name,
        COUNT(se.id) as count,
        COALESCE(SUM(p.amount), 0) as total_revenue,
        COALESCE(SUM(se.service_charges), 0) as total_profit
      FROM service_entries se
      JOIN services s ON se.category_id = s.id
      ${paymentsLateralJoin()}
      WHERE se.staff_id = $1
        AND se.status IN ('completed', 'pending')
        AND se.created_at >= $2::date AND se.created_at < ($3::date + 1)
      GROUP BY s.id, s.name
      ORDER BY total_revenue DESC
      LIMIT 10
    `;

    // 6️⃣ Top Customers
    const topCustomersQuery = `
      SELECT
        se.customer_name,
        se.phone,
        COUNT(se.id) as service_count,
        COALESCE(SUM(p.amount), 0) as total_spent
      FROM service_entries se
      ${paymentsLateralJoin()}
      WHERE se.staff_id = $1
        AND se.status IN ('completed', 'pending')
        AND se.created_at >= $2::date AND se.created_at < ($3::date + 1)
        AND se.customer_name IS NOT NULL
        AND se.customer_name != ''
      GROUP BY se.customer_name, se.phone
      ORDER BY total_spent DESC
      LIMIT 5
    `;

    // 7️⃣ Recent Services
    const recentServicesQuery = `
      SELECT
        se.id,
        se.created_at,
        se.customer_name,
        se.phone as customer_phone,
        s.name as service_name,
        sc.name as subcategory_name,
        se.status,
        se.service_charges,
        se.department_charges,
        se.total_charges,
        COALESCE(p.received_amount, 0) as received_amount,
        (se.total_charges - COALESCE(p.received_amount, 0)) as pending_amount
      FROM service_entries se
      JOIN services s ON se.category_id = s.id
      LEFT JOIN subcategories sc ON se.subcategory_id = sc.id
      ${paymentsLateralJoin()}
      WHERE se.staff_id = $1
        AND se.created_at >= $2::date AND se.created_at < ($3::date + 1)
      ORDER BY se.created_at DESC
      LIMIT 20
    `;

    // 9️⃣ Monthly Trends (last 6 months)
    const monthlyTrendsQuery = `
      SELECT
        TO_CHAR(se.created_at, 'YYYY-MM') as month,
        COUNT(*) as total_services,
        COALESCE(SUM(p.amount), 0) as total_collected,
        COALESCE(SUM(se.service_charges), 0) as service_charges
      FROM service_entries se
      ${paymentsLateralJoin()}
      WHERE se.staff_id = $1
        AND se.status IN ('completed', 'pending')
        AND se.created_at >= (CURRENT_DATE - INTERVAL '6 months')
      GROUP BY TO_CHAR(se.created_at, 'YYYY-MM')
      ORDER BY month ASC
    `;

    // 1️⃣2️⃣ Attendance Summary
    const attendanceQuery = `
      SELECT
        COUNT(DISTINCT date) as total_days,
        COUNT(DISTINCT CASE WHEN status = 'present' THEN date END) as present_days,
        COUNT(DISTINCT CASE WHEN status = 'absent' THEN date END) as absent_days,
        COUNT(DISTINCT CASE WHEN COALESCE(late_minutes, 0) > 0 OR status = 'late' THEN date END) as late_days,
        COALESCE(SUM(hours), 0) as total_hours,
        COALESCE(SUM(late_minutes), 0) as total_late_minutes,
        COALESCE(SUM(extra_minutes), 0) as total_extra_minutes
      FROM attendance
      WHERE staff_id = $1
        AND date BETWEEN $2::date AND $3::date
    `;

    // 1️⃣3️⃣ Weekly Performance Breakdown (Monday-start weeks; EXTRACT(WEEK) mixed
    // up weeks of different years in a range across New Year)
    const weeklyBreakdownQuery = `
      SELECT
        EXTRACT(WEEK FROM DATE_TRUNC('week', se.created_at)) as week_number,
        TO_CHAR(DATE_TRUNC('week', se.created_at), 'YYYY-MM-DD') as week_start,
        COUNT(*) as services_count,
        COALESCE(SUM(p.amount), 0) as total_collected
      FROM service_entries se
      ${paymentsLateralJoin()}
      WHERE se.staff_id = $1
        AND se.status IN ('completed', 'pending')
        AND se.created_at >= $2::date AND se.created_at < ($3::date + 1)
      GROUP BY DATE_TRUNC('week', se.created_at)
      ORDER BY DATE_TRUNC('week', se.created_at) ASC
    `;

    const args = [staffId, startDate, endDate];
    const [
      summary,
      repeatCustomerData,
      efficiencyData,
      pendingData,
      dailyData,
      categoryData,
      topCustomers,
      recentServices,
      ratingData,
      monthlyTrends,
      attendanceData,
      weeklyBreakdown
    ] = await Promise.all([
      loadPerformanceSummary(client, staffId, range),
      client.query(repeatCustomerQuery, args),
      client.query(collectionEfficiencyQuery, args),
      client.query(pendingQuery, [staffId]),
      client.query(dailyPerformanceQuery, args),
      client.query(categoryQuery, args),
      client.query(topCustomersQuery, args),
      client.query(recentServicesQuery, args),
      loadRatings(client, staffId, range),
      client.query(monthlyTrendsQuery, [staffId]),
      client.query(attendanceQuery, args),
      client.query(weeklyBreakdownQuery, args)
    ]);

    const totalCustomersWithVisits = parseInt(repeatCustomerData.rows[0]?.total_customers || 0, 10);
    const repeatCustomers = parseInt(repeatCustomerData.rows[0]?.repeat_customers || 0, 10);
    const repeatCustomerRate = totalCustomersWithVisits > 0 ? (repeatCustomers / totalCustomersWithVisits) * 100 : 0;

    const revenuePerService = summary.total_services > 0 ? summary.total_collected / summary.total_services : 0;

    const paidServices = parseInt(efficiencyData.rows[0]?.total_services_with_payments || 0, 10);
    const ontimePaid = parseInt(efficiencyData.rows[0]?.ontime_paid_services || 0, 10);
    const collectionEfficiency = paidServices > 0 ? (ontimePaid / paidServices) * 100 : 0;

    const rating = ratingData.rows[0] || {};
    const totalReviews = parseInt(rating.total_reviews || 0, 10);
    const positiveReviews = parseInt(rating.positive_reviews || 0, 10);
    const csatScore = totalReviews > 0 ? (positiveReviews / totalReviews) * 100 : 0;
    const avgRating = totalReviews > 0 ? Math.round(parseFloat(rating.avg_staff_rating) * 10) / 10 : 0;

    const ratingDistribution = [5, 4, 3, 2, 1].map((n) => ({
      rating: n,
      count: parseInt(rating[{ 5: 'five_star', 4: 'four_star', 3: 'three_star', 2: 'two_star', 1: 'one_star' }[n]] || 0, 10)
    }));

    const att = attendanceData.rows[0] || {};
    const attTotalDays = parseInt(att.total_days || 0, 10);
    const attPresentDays = parseInt(att.present_days || 0, 10);

    res.json({
      success: true,
      data: {
        staff: staffInfo.rows[0],
        period: {
          from: range.all ? null : startDate,
          to: endDate,
          period: range.period,
          total_days: summary.total_days
        },
        summary: {
          total_services: summary.total_services,
          total_billed: summary.total_billed,
          total_collected: summary.total_collected,
          total_service_charges: summary.total_service_charges,
          total_department_charges: summary.total_department_charges,
          collection_rate: summary.collection_rate,
          avg_transaction_value: summary.avg_transaction_value,
          active_days: summary.active_days,
          unique_customers: summary.unique_customers,
          avg_daily_revenue: summary.avg_daily_revenue,
          avg_daily_services: summary.avg_daily_services,
          incentive_score: summary.incentive_score,
          repeat_customer_rate: pct(repeatCustomerRate),
          revenue_per_service: pct(revenuePerService),
          collection_efficiency: pct(collectionEfficiency),
          csat_score: pct(csatScore)
        },
        pending: {
          pending_count: parseInt(pendingData.rows[0]?.pending_count || 0, 10),
          pending_amount: parseFloat(pendingData.rows[0]?.pending_amount || 0),
          overdue_count: parseInt(pendingData.rows[0]?.overdue_count || 0, 10),
          overdue_amount: parseFloat(pendingData.rows[0]?.overdue_amount || 0)
        },
        daily_performance: dailyData.rows.map(row => ({
          date: row.date,
          services_count: parseInt(row.services_count, 10),
          billed_amount: parseFloat(row.billed_amount),
          collected_amount: parseFloat(row.collected_amount),
          service_charges: parseFloat(row.service_charges)
        })),
        category_breakdown: categoryData.rows.map(row => ({
          service_id: row.service_id,
          service_name: row.service_name,
          count: parseInt(row.count, 10),
          total_revenue: parseFloat(row.total_revenue),
          total_profit: parseFloat(row.total_profit)
        })),
        top_customers: topCustomers.rows.map(row => ({
          customer_name: row.customer_name,
          phone: row.phone,
          service_count: parseInt(row.service_count, 10),
          total_spent: parseFloat(row.total_spent)
        })),
        recent_services: recentServices.rows.map(row => ({
          id: row.id,
          created_at: row.created_at,
          customer_name: row.customer_name,
          customer_phone: row.customer_phone,
          service_name: row.service_name,
          subcategory_name: row.subcategory_name,
          received_amount: parseFloat(row.received_amount || 0),
          pending_amount: parseFloat(row.pending_amount || 0),
          total_charges: parseFloat(row.total_charges || 0),
          service_charges: parseFloat(row.service_charges || 0),
          department_charges: parseFloat(row.department_charges || 0),
          status: row.status
        })),
        ratings: {
          total_reviews: totalReviews,
          avg_rating: avgRating,
          avg_service_rating: parseFloat(rating.avg_service_rating || 0),
          positive_reviews: positiveReviews,
          negative_reviews: parseInt(rating.negative_reviews || 0, 10),
          distribution: ratingDistribution
        },
        monthly_trends: monthlyTrends.rows.map(row => ({
          month: row.month,
          total_services: parseInt(row.total_services, 10),
          total_collected: parseFloat(row.total_collected),
          service_charges: parseFloat(row.service_charges)
        })),
        weekly_breakdown: weeklyBreakdown.rows.map(row => ({
          week_number: parseInt(row.week_number, 10),
          week_start: row.week_start,
          services_count: parseInt(row.services_count, 10),
          total_collected: parseFloat(row.total_collected)
        })),
        attendance: {
          total_days: attTotalDays,
          present_days: attPresentDays,
          absent_days: parseInt(att.absent_days || 0, 10),
          late_days: parseInt(att.late_days || 0, 10),
          attendance_rate: attTotalDays > 0 ? Math.round((attPresentDays / attTotalDays) * 100) : 0,
          total_hours: parseFloat(att.total_hours || 0),
          total_late_minutes: parseInt(att.total_late_minutes || 0, 10),
          total_extra_minutes: parseInt(att.total_extra_minutes || 0, 10)
        }
      }
    });

    // Log activity — after the response; a failure here must not try to send a second response
    logActivity({
      centre_id: staffInfo.rows[0].centreId,
      related_type: 'staff_performance',
      related_id: staffId,
      action: 'Performance Viewed',
      description: `Staff ${staffInfo.rows[0].name} viewed their performance dashboard`,
      performed_by: staffId,
      performed_by_role: 'staff'
    }).catch((e) => console.error('Non-fatal: performance view log failed', e));

  } catch (err) {
    console.error('Staff performance dashboard error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Failed to load performance data' });
    }
  } finally {
    client.release();
  }
});

/* =========================================================
   2️⃣ STAFF PERFORMANCE COMPARISON
   Compare current performance with the previous period, like for like:
   this month 1–20 vs last month 1–20 (not vs the whole of last month),
   today vs yesterday, custom range vs the same number of days before it.
========================================================= */
router.get('/compare', async (req, res) => {
  const range = resolvePeriod(req.query, 'month');
  if (range.error) return res.status(400).json({ success: false, error: range.error });
  if (range.all) {
    // nothing to compare "all time" with
    return res.json({ success: true, data: { period: { current: null, previous: null }, metrics: null } });
  }

  const today = todayIST();
  const [ty, tm, td] = today.split('-').map(Number);
  const currentStart = range.start;
  const currentEnd = range.end;
  const len = daysIncl(currentStart, currentEnd);
  let previousStart, previousEnd;

  const sameDayCapped = (y, m, d) => ymdUTC(y, m, Math.min(d, new Date(Date.UTC(y, m, 0)).getUTCDate()));

  if (range.period === 'month') {
    previousStart = ymdUTC(ty, tm - 1, 1);
    const pm = new Date(`${previousStart}T00:00:00Z`);
    previousEnd = sameDayCapped(pm.getUTCFullYear(), pm.getUTCMonth() + 1, td);
  } else if (range.period === 'quarter') {
    const q = Math.floor((tm - 1) / 3) * 3 + 1;
    previousStart = ymdUTC(ty, q - 3, 1);
    previousEnd = addDays(previousStart, len - 1);
  } else if (range.period === 'year') {
    previousStart = `${ty - 1}-01-01`;
    previousEnd = sameDayCapped(ty - 1, tm, td);
  } else {
    // today / yesterday / week / custom: the same number of days just before
    previousEnd = addDays(currentStart, -1);
    previousStart = addDays(previousEnd, -(len - 1));
  }

  const client = await pool.connect();

  try {
    const staffId = req.user.id;

    const currentQuery = `
      SELECT
        COUNT(DISTINCT se.id) as total_services,
        COALESCE(SUM(p.amount), 0) as total_collected,
        COALESCE(SUM(se.service_charges), 0) as total_profit,
        COALESCE(AVG(p.amount), 0) as avg_transaction,
        COUNT(DISTINCT se.customer_name) as unique_customers
      FROM service_entries se
      ${paymentsLateralJoin()}
      WHERE se.staff_id = $1
        AND se.status IN ('completed', 'pending')
        AND se.created_at >= $2::date AND se.created_at < ($3::date + 1)
    `;

    const [currentResult, previousResult] = await Promise.all([
      client.query(currentQuery, [staffId, currentStart, currentEnd]),
      client.query(currentQuery, [staffId, previousStart, previousEnd])
    ]);

    // pg returns COUNT/SUM as strings: "0" === 0 was false, so a previous
    // period with nothing gave Infinity / NaN instead of 100% / 0%
    const calculateChange = (cur, prev) => {
      const c = Number(cur) || 0;
      const p = Number(prev) || 0;
      if (p === 0) return c > 0 ? 100 : 0;
      return pct(((c - p) / p) * 100);
    };

    const current = currentResult.rows[0];
    const previous = previousResult.rows[0];
    const metric = (key, parse) => ({
      current: parse(current[key] || 0),
      previous: parse(previous[key] || 0),
      change: calculateChange(current[key], previous[key])
    });
    const int = (v) => parseInt(v, 10);

    res.json({
      success: true,
      data: {
        period: {
          current: { from: currentStart, to: currentEnd },
          previous: { from: previousStart, to: previousEnd }
        },
        metrics: {
          services: metric('total_services', int),
          revenue: metric('total_collected', parseFloat),
          profit: metric('total_profit', parseFloat),
          avgTransaction: metric('avg_transaction', parseFloat),
          customers: metric('unique_customers', int)
        }
      }
    });

  } catch (err) {
    console.error('Performance comparison error:', err);
    res.status(500).json({ success: false, error: 'Failed to load comparison data' });
  } finally {
    client.release();
  }
});

/* =========================================================
   3️⃣ STAFF ACHIEVEMENTS & MILESTONES
   Track staff achievements and milestones (ENHANCED)
========================================================= */
router.get('/achievements', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const staffId = req.user.id;
    
    // Get lifetime totals
    const lifetimeQuery = `
      SELECT 
        COUNT(DISTINCT se.id) as total_services,
        COALESCE(SUM(p.amount), 0) as total_revenue,
        COUNT(DISTINCT se.customer_name) as unique_customers,
        COUNT(DISTINCT DATE(se.created_at)) as active_days
      FROM service_entries se
      ${paymentsLateralJoin()}
      WHERE se.staff_id = $1 AND se.status IN ('completed', 'pending')
    `;
    
    // Get best day
    const bestDayQuery = `
      SELECT
        TO_CHAR(DATE(se.created_at), 'YYYY-MM-DD') as date,
        COUNT(DISTINCT se.id) as services_count,
        COALESCE(SUM(p.amount), 0) as revenue
      FROM service_entries se
      ${paymentsLateralJoin()}
      WHERE se.staff_id = $1 AND se.status IN ('completed', 'pending')
      GROUP BY DATE(se.created_at)
      ORDER BY revenue DESC, DATE(se.created_at) DESC
      LIMIT 1
    `;
    
    // Get top customer
    const topCustomerQuery = `
      SELECT 
        se.customer_name,
        COUNT(se.id) as services_count,
        COALESCE(SUM(p.amount), 0) as total_spent
      FROM service_entries se
      ${paymentsLateralJoin()}
      WHERE se.staff_id = $1 
        AND se.status IN ('completed', 'pending')
        AND se.customer_name IS NOT NULL
        AND se.customer_name != ''
      GROUP BY se.customer_name
      ORDER BY total_spent DESC
      LIMIT 1
    `;
    
    // Get weekly streak (consecutive weeks with at least one service)
    // 🔥 Bounded to the last 2 years — an unbounded lifetime window-function scan here
    // will slow down again as history grows, the same class of problem as the payments
    // subquery. A "current streak" only ever needs recent history anyway.
    const weeklyStreakQuery = `
      WITH weekly_activity AS (
        SELECT 
          DATE_TRUNC('week', se.created_at) as week_start,
          COUNT(*) as services_count
        FROM service_entries se
        WHERE se.staff_id = $1 
          AND se.status IN ('completed', 'pending')
          AND se.created_at >= (CURRENT_DATE - INTERVAL '2 years')
        GROUP BY DATE_TRUNC('week', se.created_at)
      ),
      streak_calc AS (
        SELECT
          week_start,
          services_count,
          ROW_NUMBER() OVER (ORDER BY week_start) as rn,
          week_start - (ROW_NUMBER() OVER (ORDER BY week_start) * INTERVAL '7 days') as streak_group
        FROM weekly_activity
      ),
      latest AS (
        SELECT COUNT(*) AS streak_length, MAX(week_start) AS last_week
        FROM streak_calc
        GROUP BY streak_group
        ORDER BY MAX(week_start) DESC
        LIMIT 1
      )
      -- FIX: this returned COUNT(*) of the one-row result (always 1), not the streak length.
      -- A streak is "current" only if it reaches this week or last week.
      SELECT COALESCE((
        SELECT streak_length FROM latest
        WHERE last_week >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days'
      ), 0) AS current_streak
    `;
    
    // Get daily revenue streak (consecutive days with revenue > 0)
    // 🔥 Bounded to the last 6 months for the same reason as above.
    const dailyStreakQuery = `
      WITH daily_revenue AS (
        SELECT 
          DATE(se.created_at) as day,
          COALESCE(SUM(p.amount), 0) as revenue
        FROM service_entries se
        ${paymentsLateralJoin()}
        WHERE se.staff_id = $1 
          AND se.status IN ('completed', 'pending')
          AND se.created_at >= (CURRENT_DATE - INTERVAL '6 months')
        GROUP BY DATE(se.created_at)
      ),
      streak_calc AS (
        SELECT
          day,
          revenue,
          ROW_NUMBER() OVER (ORDER BY day) as rn,
          day - (ROW_NUMBER() OVER (ORDER BY day) * INTERVAL '1 day') as streak_group
        FROM daily_revenue
        WHERE revenue > 0
      ),
      latest AS (
        SELECT COUNT(*) AS streak_length, MAX(day) AS last_day
        FROM streak_calc
        GROUP BY streak_group
        ORDER BY MAX(day) DESC
        LIMIT 1
      )
      -- FIX: same as the weekly streak (always returned 1).
      -- "Current" = the streak reaches today or yesterday.
      SELECT COALESCE((
        SELECT streak_length FROM latest
        WHERE last_day >= CURRENT_DATE - 1
      ), 0) AS current_streak
    `;
    
    // Get service variety (distinct service categories)
    const varietyQuery = `
      SELECT COUNT(DISTINCT se.category_id) as distinct_categories
      FROM service_entries se
      WHERE se.staff_id = $1 AND se.status IN ('completed', 'pending')
    `;
    
    // Get top service category
    const topCategoryQuery = `
      SELECT 
        s.name as category_name,
        COUNT(se.id) as services_count
      FROM service_entries se
      JOIN services s ON se.category_id = s.id
      WHERE se.staff_id = $1 AND se.status IN ('completed', 'pending')
      GROUP BY s.id, s.name
      ORDER BY services_count DESC
      LIMIT 1
    `;
    
    // Get rating achievements
    const ratingAchievementsQuery = `
      SELECT 
        COUNT(*) as total_5_star,
        COUNT(DISTINCT DATE(created_at)) as days_with_5_star,
        DATE_TRUNC('month', created_at) as month,
        COUNT(CASE WHEN staff_rating = 5 THEN 1 END) as five_star_count
      FROM service_reviews
      WHERE staff_id = $1 AND is_submitted = true AND staff_rating = 5
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
    `;
    
    // Get collection rate achievements
    const collectionRateQuery = `
      SELECT 
        CASE 
          WHEN SUM(se.total_charges) > 0 
          THEN (SUM(p.amount) / SUM(se.total_charges)) * 100 
          ELSE 0 
        END as lifetime_collection_rate
      FROM service_entries se
      ${paymentsLateralJoin()}
      WHERE se.staff_id = $1 AND se.status IN ('completed', 'pending')
    `;

    // 🔥 FIXED: 9 independent queries fired together instead of one at a time.
    const [
      lifetime,
      bestDay,
      topCustomer,
      weeklyStreakResult,
      dailyStreakResult,
      varietyResult,
      topCategory,
      ratingAchievements,
      collectionRateResult
    ] = await Promise.all([
      client.query(lifetimeQuery, [staffId]),
      client.query(bestDayQuery, [staffId]),
      client.query(topCustomerQuery, [staffId]),
      client.query(weeklyStreakQuery, [staffId]),
      client.query(dailyStreakQuery, [staffId]),
      client.query(varietyQuery, [staffId]),
      client.query(topCategoryQuery, [staffId]),
      client.query(ratingAchievementsQuery, [staffId]),
      client.query(collectionRateQuery, [staffId])
    ]);

    const weeklyStreak = parseInt(weeklyStreakResult.rows[0]?.current_streak || 0);
    const dailyRevenueStreak = parseInt(dailyStreakResult.rows[0]?.current_streak || 0);
    const distinctCategories = parseInt(varietyResult.rows[0]?.distinct_categories || 0);
    
    const totalFiveStar = ratingAchievements.rows.reduce((sum, row) => sum + parseInt(row.five_star_count || 0), 0);
    
    const lifetimeCollectionRate = parseFloat(collectionRateResult.rows[0]?.lifetime_collection_rate || 0);
    
    // Calculate achievements
    const achievements = [];
    const totalServices = parseInt(lifetime.rows[0].total_services || 0);
    const totalRevenue = parseFloat(lifetime.rows[0].total_revenue || 0);
    const uniqueCustomers = parseInt(lifetime.rows[0].unique_customers || 0);
    const activeDays = parseInt(lifetime.rows[0].active_days || 0);
    
    // ----- SERVICE COUNT ACHIEVEMENTS -----
    const serviceMilestones = [
      { threshold: 10, name: 'First Steps', description: 'Completed 10 services', icon: '🎯' },
      { threshold: 50, name: 'Silver Service', description: 'Completed 50 services', icon: '🥈' },
      { threshold: 100, name: 'Century Club', description: 'Completed 100 services', icon: '🏆' },
      { threshold: 500, name: 'Service Master', description: 'Completed 500 services', icon: '👑' },
      { threshold: 1000, name: 'Legendary Service', description: 'Completed 1000+ services', icon: '💎' }
    ];
    
    serviceMilestones.forEach(milestone => {
      if (totalServices >= milestone.threshold) {
        achievements.push({
          name: milestone.name,
          description: milestone.description,
          earned: true,
          icon: milestone.icon,
          earned_at: null
        });
      } else {
        achievements.push({
          name: milestone.name,
          description: milestone.description,
          earned: false,
          icon: milestone.icon,
          progress: totalServices,
          target: milestone.threshold
        });
      }
    });
    
    // ----- REVENUE ACHIEVEMENTS -----
    const revenueMilestones = [
      { threshold: 10000, name: '₹10K Club', description: 'Generated ₹10,000+ revenue', icon: '💰' },
      { threshold: 50000, name: '₹50K Club', description: 'Generated ₹50,000+ revenue', icon: '💵' },
      { threshold: 100000, name: '₹1 Lakh Club', description: 'Generated ₹1,00,000+ revenue', icon: '🌟' },
      { threshold: 500000, name: '₹5 Lakh Club', description: 'Generated ₹5,00,000+ revenue', icon: '⭐' },
      { threshold: 1000000, name: '₹10 Lakh Club', description: 'Generated ₹10,00,000+ revenue', icon: '🏅' }
    ];
    
    revenueMilestones.forEach(milestone => {
      if (totalRevenue >= milestone.threshold) {
        achievements.push({
          name: milestone.name,
          description: milestone.description,
          earned: true,
          icon: milestone.icon,
          earned_at: null
        });
      } else {
        achievements.push({
          name: milestone.name,
          description: milestone.description,
          earned: false,
          icon: milestone.icon,
          progress: totalRevenue,
          target: milestone.threshold
        });
      }
    });
    
    // ----- CUSTOMER ACHIEVEMENTS -----
    const customerMilestones = [
      { threshold: 10, name: 'Welcome Host', description: 'Served 10 unique customers', icon: '🤝' },
      { threshold: 50, name: 'People\'s Choice', description: 'Served 50 unique customers', icon: '👥' },
      { threshold: 100, name: 'Customer Magnet', description: 'Served 100 unique customers', icon: '🧲' },
      { threshold: 250, name: 'Community Hero', description: 'Served 250+ unique customers', icon: '🦸' }
    ];
    
    customerMilestones.forEach(milestone => {
      if (uniqueCustomers >= milestone.threshold) {
        achievements.push({
          name: milestone.name,
          description: milestone.description,
          earned: true,
          icon: milestone.icon,
          earned_at: null
        });
      } else {
        achievements.push({
          name: milestone.name,
          description: milestone.description,
          earned: false,
          icon: milestone.icon,
          progress: uniqueCustomers,
          target: milestone.threshold
        });
      }
    });
    
    // ----- STREAK ACHIEVEMENTS -----
    if (weeklyStreak >= 4) {
      achievements.push({
        name: 'Weekly Warrior',
        description: `Maintained ${weeklyStreak} week streak of service`,
        earned: true,
        icon: '⚡',
        earned_at: null
      });
    } else if (weeklyStreak > 0) {
      achievements.push({
        name: 'Weekly Warrior',
        description: 'Maintain 4+ weeks of continuous service',
        earned: false,
        icon: '⚡',
        progress: weeklyStreak,
        target: 4
      });
    }
    
    if (dailyRevenueStreak >= 5) {
      achievements.push({
        name: 'Revenue Streak',
        description: `${dailyRevenueStreak} consecutive days with revenue`,
        earned: true,
        icon: '📈',
        earned_at: null
      });
    } else if (dailyRevenueStreak > 0) {
      achievements.push({
        name: 'Revenue Streak',
        description: '5 consecutive days with revenue',
        earned: false,
        icon: '📈',
        progress: dailyRevenueStreak,
        target: 5
      });
    }
    
    // ----- SERVICE VARIETY ACHIEVEMENTS -----
    if (distinctCategories >= 5) {
      achievements.push({
        name: 'Versatile Pro',
        description: `Expert in ${distinctCategories} different service categories`,
        earned: true,
        icon: '🎨',
        earned_at: null
      });
    } else if (distinctCategories >= 3) {
      achievements.push({
        name: 'Multi-Talented',
        description: `Skilled in ${distinctCategories} service categories`,
        earned: true,
        icon: '🎭',
        earned_at: null
      });
    } else {
      achievements.push({
        name: 'Specialist',
        description: 'Master one service category first',
        earned: false,
        icon: '🎯',
        progress: distinctCategories,
        target: 3
      });
    }
    
    // Top category specialization
    if (topCategory.rows[0] && topCategory.rows[0].services_count >= 50) {
      achievements.push({
        name: `${topCategory.rows[0].category_name} Specialist`,
        description: `Completed ${topCategory.rows[0].services_count}+ ${topCategory.rows[0].category_name} services`,
        earned: true,
        icon: '🏅',
        earned_at: null
      });
    }
    
    // ----- RATING ACHIEVEMENTS -----
    if (totalFiveStar >= 10) {
      achievements.push({
        name: 'Star Performer',
        description: `Received ${totalFiveStar} five-star ratings`,
        earned: true,
        icon: '⭐',
        earned_at: null
      });
    } else if (totalFiveStar >= 5) {
      achievements.push({
        name: 'Rising Star',
        description: `Received ${totalFiveStar} five-star ratings`,
        earned: true,
        icon: '✨',
        earned_at: null
      });
    } else if (totalFiveStar > 0) {
      achievements.push({
        name: 'First Five-Star',
        description: 'Receive your first five-star rating',
        earned: true,
        icon: '🌟',
        earned_at: null
      });
    } else {
      achievements.push({
        name: 'First Five-Star',
        description: 'Receive your first five-star rating',
        earned: false,
        icon: '🌟',
        progress: 0,
        target: 1
      });
    }
    
    // ----- COLLECTION ACHIEVEMENTS -----
    if (lifetimeCollectionRate >= 95) {
      achievements.push({
        name: 'Collection Master',
        description: `${lifetimeCollectionRate.toFixed(1)}% collection rate - Excellent!`,
        earned: true,
        icon: '💯',
        earned_at: null
      });
    } else if (lifetimeCollectionRate >= 90) {
      achievements.push({
        name: 'Collection Expert',
        description: `${lifetimeCollectionRate.toFixed(1)}% collection rate - Great!`,
        earned: true,
        icon: '✅',
        earned_at: null
      });
    } else if (lifetimeCollectionRate >= 80) {
      achievements.push({
        name: 'Good Collector',
        description: `${lifetimeCollectionRate.toFixed(1)}% collection rate`,
        earned: true,
        icon: '📊',
        earned_at: null
      });
    } else if (lifetimeCollectionRate > 0) {
      achievements.push({
        name: 'Perfect Collection',
        description: 'Achieve 90%+ collection rate',
        earned: false,
        icon: '🎯',
        progress: lifetimeCollectionRate,
        target: 90
      });
    }
    
    // ----- ATTENDANCE/DEDICATION ACHIEVEMENTS -----
    if (activeDays >= 200) {
      achievements.push({
        name: 'Dedication Diamond',
        description: `${activeDays} active service days - Incredible dedication!`,
        earned: true,
        icon: '💎',
        earned_at: null
      });
    } else if (activeDays >= 100) {
      achievements.push({
        name: 'Dedication Gold',
        description: `${activeDays} active service days`,
        earned: true,
        icon: '🏅',
        earned_at: null
      });
    } else if (activeDays >= 50) {
      achievements.push({
        name: 'Dedication Silver',
        description: `${activeDays} active service days`,
        earned: true,
        icon: '🥈',
        earned_at: null
      });
    } else if (activeDays >= 25) {
      achievements.push({
        name: 'Dedication Bronze',
        description: `${activeDays} active service days`,
        earned: true,
        icon: '🥉',
        earned_at: null
      });
    } else {
      achievements.push({
        name: 'Getting Started',
        description: 'Complete 25 active service days',
        earned: false,
        icon: '🌱',
        progress: activeDays,
        target: 25
      });
    }
    
    res.json({
      success: true,
      data: {
        lifetime: {
          total_services: totalServices,
          total_revenue: totalRevenue,
          unique_customers: uniqueCustomers,
          active_days: activeDays,
          lifetime_collection_rate: lifetimeCollectionRate,
          weekly_streak: weeklyStreak,
          daily_revenue_streak: dailyRevenueStreak,
          distinct_categories: distinctCategories,
          total_five_star_ratings: totalFiveStar
        },
        best_day: bestDay.rows[0] ? {
          date: bestDay.rows[0].date, // "YYYY-MM-DD" (see bestDayQuery)
          services_count: parseInt(bestDay.rows[0].services_count),
          revenue: parseFloat(bestDay.rows[0].revenue)
        } : null,
        top_customer: topCustomer.rows[0] ? {
          name: topCustomer.rows[0].customer_name,
          services_count: parseInt(topCustomer.rows[0].services_count),
          total_spent: parseFloat(topCustomer.rows[0].total_spent)
        } : null,
        top_category: topCategory.rows[0] ? {
          name: topCategory.rows[0].category_name,
          services_count: parseInt(topCategory.rows[0].services_count)
        } : null,
        achievements
      }
    });
    
  } catch (err) {
    console.error('Achievements error:', err);
    res.status(500).json({ success: false, error: 'Failed to load achievements' });
  } finally {
    client.release();
  }
});

/* =========================================================
   4️⃣ STAFF PERFORMANCE BY SERVICE TYPE
   Detailed breakdown by service category
========================================================= */
router.get('/service-breakdown', async (req, res) => {
  // FIX: used to ignore ?period= (always "last 30 days" unless a custom range was sent),
  // so the Services tab didn't match the period picked on the page
  const range = resolvePeriod(req.query, 'month');
  if (range.error) return res.status(400).json({ success: false, error: range.error });
  const startDate = range.start;
  const endDate = range.end;

  const client = await pool.connect();

  try {
    const staffId = req.user.id;
    
    const breakdownQuery = `
      SELECT 
        s.id as service_id,
        s.name as service_name,
        COUNT(se.id) as total_services,
        COALESCE(SUM(p.amount), 0) as total_revenue,
        COALESCE(SUM(se.service_charges), 0) as total_profit,
        COALESCE(AVG(p.amount), 0) as avg_revenue,
        COUNT(DISTINCT se.customer_name) as unique_customers,
        ROUND(COALESCE(SUM(p.amount), 0) / NULLIF(COUNT(se.id), 0), 2) as revenue_per_service
      FROM service_entries se
      JOIN services s ON se.category_id = s.id
      ${paymentsLateralJoin()}
      WHERE se.staff_id = $1 
        AND se.status IN ('completed', 'pending')
        AND se.created_at >= $2::date AND se.created_at < ($3::date + 1)
      GROUP BY s.id, s.name
      ORDER BY total_revenue DESC
    `;
    const breakdown = await client.query(breakdownQuery, [staffId, startDate, endDate]);
    
    // Calculate total for percentages
    const totalRevenue = breakdown.rows.reduce((sum, row) => sum + parseFloat(row.total_revenue), 0);
    const totalServices = breakdown.rows.reduce((sum, row) => sum + parseInt(row.total_services), 0);
    
    res.json({
      success: true,
      data: breakdown.rows.map(row => ({
        service_id: row.service_id,
        service_name: row.service_name,
        total_services: parseInt(row.total_services),
        total_revenue: parseFloat(row.total_revenue),
        total_profit: parseFloat(row.total_profit),
        avg_revenue: parseFloat(row.avg_revenue),
        unique_customers: parseInt(row.unique_customers),
        revenue_per_service: parseFloat(row.revenue_per_service),
        revenue_percentage: totalRevenue > 0 ? (parseFloat(row.total_revenue) / totalRevenue) * 100 : 0,
        service_percentage: totalServices > 0 ? (parseInt(row.total_services) / totalServices) * 100 : 0
      })),
      totals: {
        total_revenue: totalRevenue,
        total_services: totalServices,
        total_profit: breakdown.rows.reduce((sum, row) => sum + parseFloat(row.total_profit), 0)
      }
    });
    
  } catch (err) {
    console.error('Service breakdown error:', err);
    res.status(500).json({ success: false, error: 'Failed to load service breakdown' });
  } finally {
    client.release();
  }
});

/* =========================================================
   5️⃣ STAFF DAILY LOG
   Detailed daily activity log
========================================================= */
router.get('/daily-log', async (req, res) => {
  const { date } = req.query;
  if (date && !isYMD(date)) {
    return res.status(400).json({ success: false, error: 'date must be YYYY-MM-DD' });
  }
  const targetDate = date || todayIST();

  const client = await pool.connect();

  try {
    const staffId = req.user.id;
    
    // Get services for the day
    const servicesQuery = `
      SELECT 
        se.id,
        se.created_at,
        se.customer_name,
        se.phone as customer_phone,
        s.name as service_name,
        sc.name as subcategory_name,
        se.service_charges,
        se.department_charges,
        se.total_charges,
        se.status,
        COALESCE(p.received_amount, 0) as received_amount,
        (se.total_charges - COALESCE(p.received_amount, 0)) as pending_amount
      FROM service_entries se
      JOIN services s ON se.category_id = s.id
      LEFT JOIN subcategories sc ON se.subcategory_id = sc.id
      ${paymentsLateralJoin()}
      WHERE se.staff_id = $1 AND DATE(se.created_at) = $2
      ORDER BY se.created_at DESC
    `;
    
    // Get attendance for the day — ALL sessions combined.
    // FIX: a day can have several punch-in/out sessions; the old query showed
    // whichever row came first, so hours were only one session's.
    const attendanceQuery = `
      SELECT
        MIN(id)                          AS id,
        COUNT(*)::int                    AS sessions,
        MIN(punch_in)                    AS punch_in,
        CASE WHEN BOOL_OR(punch_out IS NULL) THEN NULL ELSE MAX(punch_out) END AS punch_out,
        COALESCE(SUM(hours), 0)          AS hours,
        MAX(status)                      AS status,
        COALESCE(SUM(late_minutes), 0)   AS late_minutes,
        COALESCE(SUM(extra_minutes), 0)  AS extra_minutes
      FROM attendance
      WHERE staff_id = $1 AND date = $2
      HAVING COUNT(*) > 0
    `;

    // 🔥 FIXED: services and attendance are independent — run together.
    const [services, attendance] = await Promise.all([
      client.query(servicesQuery, [staffId, targetDate]),
      client.query(attendanceQuery, [staffId, targetDate])
    ]);
    
    // Calculate daily totals
    const dailyTotal = services.rows.reduce((sum, row) => sum + parseFloat(row.received_amount || 0), 0);
    const dailyServiceCount = services.rows.length;
    const dailyProfit = services.rows.reduce((sum, row) => sum + parseFloat(row.service_charges || 0), 0);
    
    res.json({
      success: true,
      data: {
        date: targetDate,
        attendance: attendance.rows[0]
          ? { ...attendance.rows[0], hours: parseFloat(attendance.rows[0].hours || 0) }
          : null,
        services: services.rows.map(row => ({
          id: row.id,
          time: row.created_at ? new Date(row.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : null,
          customer_name: row.customer_name,
          customer_phone: row.customer_phone,
          service_name: row.service_name,
          subcategory_name: row.subcategory_name,
          amount: parseFloat(row.received_amount || 0),
          service_charge: parseFloat(row.service_charges || 0),
          department_charge: parseFloat(row.department_charges || 0),
          total: parseFloat(row.total_charges || 0),
          status: row.status,
          pending: parseFloat(row.pending_amount || 0)
        })),
        summary: {
          total_services: dailyServiceCount,
          total_collected: dailyTotal,
          total_profit: dailyProfit,
          avg_transaction: dailyServiceCount > 0 ? dailyTotal / dailyServiceCount : 0
        }
      }
    });
    
  } catch (err) {
    console.error('Daily log error:', err);
    res.status(500).json({ success: false, error: 'Failed to load daily log' });
  } finally {
    client.release();
  }
});

/* ==============================================================
   HYBRID BFF WORKSPACE INIT ROUTE
   Aggregates Performance, Tasks, Events, Recent Activity & Bookings
============================================================== */
router.get('/workspace-init', async (req, res) => {
  // Same periods as /dashboard (today, yesterday, week, month, quarter, year, all, custom).
  // FIX: "yesterday" and "all" used to fall through to no filter at all, and custom
  // dates were pasted into the SQL text — now they're validated and sent as parameters.
  const range = resolvePeriod(req.query, 'month');
  if (range.error) return res.status(400).json({ error: range.error });

  const client = await pool.connect();
  // PERF: one pg client runs its queries strictly one after another, so sharing a
  // single client made the "concurrent" Promise.all below fully sequential.
  // Spread the 12 queries over 3 connections (3 lanes) -> ~3x faster, while still
  // using only 3 pool slots per request (not 12) so the pool can't be starved.
  const laneB = await pool.connect();
  const laneC = await pool.connect();
  try {
    const staffId = req.user.id;
    const centreId = req.user.centre_id;

    // Calendar window for events / deliveries / expiries (whole week / month …, may be in the future).
    // Returns SQL using the two given parameter numbers, or '' for "all".
    const eventWindow = (col, fromIdx, toIdx) =>
      range.all ? '' : `AND (${col})::date BETWEEN $${fromIdx}::date AND $${toIdx}::date`;
    const windowArgs = range.all ? [] : [range.start, range.windowEnd];

    await ensureTargets(client, { staffId });   // this month's row, no-op once it exists
    await refreshActive(client, { staffId });   // closes any finished month for this staff only

    // Fire ALL queries concurrently in PostgreSQL
    const [
      performanceSummary,
      ratingsRes,
      tasksRes,
      eventsRes,
      recentActivityRes,
      onlinePendingRes,
      onlineProcessingRes,
      deliveriesRes,
      expiriesRes,
      todayAttendanceRes,
      targetRes,
      targetHistoryRes
    ] = await Promise.all([
      // 1. Performance Summary — the SAME calculation as the Performance page
      loadPerformanceSummary(client, staffId, range),

      // 2. Ratings — same period as the Performance page (was all-time here)
      loadRatings(client, staffId, range),

      // 3. Tasks
      laneB.query(`
        -- 🔥 FIX: Added 'assigned_to' so the frontend filter can read it
        SELECT id, title, description, priority, due_date, status, assigned_to
        FROM tasks
        WHERE assigned_to = $1 AND status != 'completed'
        ORDER BY due_date ASC NULLS LAST
      `, [staffId]),

      // 4. Events (Sorted descending: largest dates first)
      laneB.query(`
        SELECT 
          id, 
          COALESCE(title, description, type, 'Event') AS title, 
          description, 
          date, 
          start_datetime, 
          type, 
          event_type, 
          CASE 
            WHEN type ILIKE '%delivery%' OR event_type ILIKE '%delivery%' THEN 'service_delivery'
            WHEN type ILIKE '%expiry%' OR event_type ILIKE '%expiry%' THEN 'service_expiry'
            ELSE 'calendar_event'
          END as source, 
          related_service_id as tracking_id
        FROM calendar_events
        WHERE related_task_id IS NULL 
          AND (
            visibility = 'global' 
            OR (visibility = 'centre' AND centre_id = $1 AND (assigned_to IS NULL OR assigned_to = $2))
          )
          ${eventWindow('COALESCE(date, start_datetime::date)', 3, 4)}
        ORDER BY COALESCE(date, start_datetime::date) DESC
        LIMIT 50
      `, [centreId, staffId, ...windowArgs]),

      // 5. Recent Activity
      laneB.query(`
        SELECT
          se.id, 
          se.created_at, 
          se.customer_name as "customerName", 
          se.phone, 
          se.status,
          se.category_id as category, 
          se.token_id as "tokenId",
          se.is_edited, 
          se.work_source as "workSource", 
          (SELECT id FROM service_tracking WHERE service_entry_id = se.id ORDER BY updated_at DESC LIMIT 1) as tracking_id
        FROM service_entries se
        WHERE se.staff_id = $1
        ORDER BY se.created_at DESC
        LIMIT 20
      `, [staffId]),

      // 6. Online Bookings (Pending)
      laneC.query(`
        SELECT cs.*, c.name as customer_name, c.primary_phone as phone
        FROM customer_services cs
        LEFT JOIN customers c ON cs.customer_id = c.id
        WHERE cs.status = 'under_review'
        ORDER BY cs.applied_at DESC
      `),

      // 7. Online Bookings (Processing)
      laneC.query(`
        SELECT cs.*, c.name as customer_name, c.primary_phone as phone
        FROM customer_services cs
        LEFT JOIN customers c ON cs.customer_id = c.id
        WHERE cs.status = 'processing' AND cs.assigned_staff_id = $1
        ORDER BY cs.taken_at DESC
      `, [staffId]),

      // 8. Deliveries (Dynamically respects the dropdown period!)
      laneC.query(`
        SELECT
          tr.id as tracking_id,
          tr.service_entry_id as related_service_id,
          se.customer_name,
          sv.name AS service_name,
          sc.name AS subcategory_name,
          tr.estimated_delivery as date
        FROM service_tracking tr
        LEFT JOIN service_entries se ON se.id = tr.service_entry_id
        LEFT JOIN services sv ON sv.id = se.category_id
        LEFT JOIN subcategories sc ON sc.id = se.subcategory_id
        WHERE tr.status NOT IN ('completed', 'paid', 'delivered')
          AND tr.assigned_to = $1
          AND tr.estimated_delivery IS NOT NULL
          ${eventWindow('tr.estimated_delivery', 2, 3)}
      `, [staffId, ...windowArgs]),

      // 9. Expiries (Dynamically respects the dropdown period!)
      laneC.query(`
        SELECT
          se.id as related_service_id,
          se.customer_name,
          sv.name AS service_name,
          sc.name AS subcategory_name,
          se.expiry_date as date,
          (SELECT id FROM service_tracking WHERE service_entry_id = se.id ORDER BY updated_at DESC LIMIT 1) AS tracking_id
        FROM service_entries se
        LEFT JOIN services sv ON sv.id = se.category_id
        LEFT JOIN subcategories sc ON sc.id = se.subcategory_id
        WHERE se.staff_id = $1
          AND se.expiry_date IS NOT NULL
          AND se.is_expiry_dismissed = FALSE
          ${eventWindow('se.expiry_date', 2, 3)}
      `, [staffId, ...windowArgs]),

      // 10. Today's Latest Attendance Session
      laneB.query(`
        SELECT id, status, punch_in, punch_out, hours as total_hours
        FROM attendance
        WHERE staff_id = $1 AND date = CURRENT_DATE
        ORDER BY id DESC
        LIMIT 1
      `, [staffId]),

      // 11. Target (frozen snapshot) + live achieved/today
      client.query(`
        SELECT
          t.target_amount AS monthly_target,
          COALESCE((SELECT SUM(se.service_charges) FROM service_entries se
                    WHERE se.staff_id = $1 AND se.status = 'completed'
                      AND se.created_at >= date_trunc('month', CURRENT_DATE)), 0) AS current_service_charge,
          COALESCE((SELECT SUM(se.service_charges) FROM service_entries se
                    WHERE se.staff_id = $1 AND se.status = 'completed'
                      AND se.created_at >= CURRENT_DATE), 0) AS today_service_charge
        FROM staff_monthly_targets t
        WHERE t.staff_id = $1
          AND t.month = date_trunc('month', CURRENT_DATE)::date
      `, [staffId]),

      // 12. Closed-month target history (last 6)
      client.query(`
        SELECT month, target_amount, achieved_amount, achievement_percent
        FROM staff_monthly_targets
        WHERE staff_id = $1
          AND status = 'closed'
          AND month < date_trunc('month', CURRENT_DATE)::date
        ORDER BY month DESC
        LIMIT 6
      `, [staffId])
    ]);

    // --- FORMAT DYNAMIC EVENTS ---
    const formattedDeliveries = deliveriesRes.rows.map(row => ({
      id: `delivery-${row.tracking_id}`,
      title: `${row.subcategory_name ? row.service_name + ' - ' + row.subcategory_name : row.service_name} Delivery`,
      description: row.customer_name ? `Customer: ${row.customer_name}` : null,
      date: row.date,
      source: 'service_delivery',
      related_service_id: row.related_service_id,
      tracking_id: row.tracking_id
    }));

    const formattedExpiries = expiriesRes.rows.map(row => ({
      id: `expiry-${row.related_service_id}`,
      title: `${row.subcategory_name ? row.service_name + ' - ' + row.subcategory_name : row.service_name} Expiry`,
      description: row.customer_name ? `Customer: ${row.customer_name}` : null,
      date: row.date,
      source: 'service_expiry',
      related_service_id: row.related_service_id,
      tracking_id: row.tracking_id
    }));

    // 🔥 FIX: Map actual tasks into the calendar events feed
    const formattedTasks = tasksRes.rows
      .filter(t => t.due_date) // Only tasks with a due date show on the calendar
      .map(t => ({
        id: `task-${t.id}`,
        title: t.title,
        description: t.description,
        date: t.due_date,
        type: 'task',
        event_type: 'deadline',
        source: 'task',
        priority: t.priority || 'medium'
      }));

    // Combine all event streams
    const combinedEvents = [
      ...eventsRes.rows,
      ...formattedTasks,       // 👈 Real tasks now included!
      ...formattedDeliveries,
      ...formattedExpiries
    ];

    const ratings = ratingsRes.rows[0] || {};
    const totalReviews = parseInt(ratings.total_reviews || 0, 10);
    const avgRating = totalReviews > 0 ? parseFloat(ratings.avg_staff_rating) || 0 : 0;

    // FIX: this used its own formula (collection 50% + service count + rating),
    // completed-only entries and all-time ratings, so it disagreed with the
    // Performance page (74% vs 64% on staging). Now both use loadPerformanceSummary.
    const totalServices = performanceSummary.total_services;
    const totalCollected = performanceSummary.total_collected;
    const collectionRate = Math.round(performanceSummary.collection_rate);
    const avgTransactionValue = Math.round(performanceSummary.avg_transaction_value);
    const incentiveScore = performanceSummary.incentive_score;

    // Target Calculations
    const targetRow = targetRes.rows[0] || { avg_service_charge: 0, monthly_target: 0, current_service_charge: 0, today_service_charge: 0 };
    const monthlyTarget = parseFloat(targetRow.monthly_target) || 0;
    const currentAchieved = parseFloat(targetRow.current_service_charge) || 0;
    const todayAchieved = parseFloat(targetRow.today_service_charge) || 0;
    
    // Calculate daily target based on days in the current month
    const [tYear, tMonth] = todayIST().split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(tYear, tMonth, 0)).getUTCDate(); // days in the current IST month
    const dailyTarget = monthlyTarget > 0 ? Math.round(monthlyTarget / daysInMonth) : 0;
    const progressPercentage = monthlyTarget > 0 ? (currentAchieved / monthlyTarget) * 100 : 0;

    res.json({
      success: true,
      data: {
        todayAttendance: todayAttendanceRes.rows[0] || null,
        performance: {
          summary: {
            total_services: totalServices,
            total_collected: totalCollected,
            collection_rate: collectionRate,
            avg_transaction_value: avgTransactionValue,
            incentive_score: incentiveScore
          },
          target: { 
            monthly_target: monthlyTarget,
            current_achieved: currentAchieved,
            daily_target: dailyTarget,
            today_achieved: todayAchieved,
            progress_percentage: progressPercentage,
            history: targetHistoryRes.rows.map(r => ({
              month: r.month,
              target: parseFloat(r.target_amount),
              achieved: parseFloat(r.achieved_amount),
              percent: r.achievement_percent === null ? null : parseFloat(r.achievement_percent)
            }))
          },
          ratings: {
            avg_rating: avgRating.toFixed(1),
            total_reviews: totalReviews
          },
          period: {
            period: range.period,
            from: range.all ? null : range.start,
            to: range.end
          }
        },
        tasks: tasksRes.rows,
        events: combinedEvents,
        recentActivity: recentActivityRes.rows,
        onlinePending: onlinePendingRes.rows,
        onlineProcessing: onlineProcessingRes.rows
      }
    });

  } catch (err) {
    console.error('Workspace Init Error:', err);
    res.status(500).json({ error: 'Failed to initialize workspace' });
  } finally {
    laneB.release();
    laneC.release();
    client.release();
  }
});

export default router;