// backend/routes/staffPerformance.js
import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { logActivity } from '../utils/activityLogger.js';

const router = express.Router();

// 🔥 NEW: Subquery variable to handle corrections and reversals perfectly
// Aliased as both 'amount' and 'received_amount' so it seamlessly replaces the old payments table everywhere
const TRUE_PAYMENTS_SUBQUERY = `
  (
    SELECT reference_id AS service_entry_id, SUM(amount) AS amount, SUM(amount) AS received_amount
    FROM (
      SELECT DISTINCT ON (COALESCE(NULLIF(correction_group_id::text, ''), id::text))
        reference_id, amount, is_reversal
      FROM wallet_transactions
      WHERE category = 'Service Payment' 
        AND type = 'credit' 
        AND reference_type = 'payment'
      ORDER BY COALESCE(NULLIF(correction_group_id::text, ''), id::text), created_at DESC, is_reversal ASC
    ) lt
    WHERE (lt.is_reversal IS NULL OR lt.is_reversal = FALSE)
    GROUP BY reference_id
  )
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
   1️⃣ STAFF PERFORMANCE DASHBOARD
   Comprehensive performance metrics for current staff member
========================================================= */
router.get('/dashboard', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const staffId = req.user.id;
    const { from, to, period = 'monthly' } = req.query;
    
    // Set date range based on period
    let startDate, endDate = new Date().toISOString().split('T')[0];
    const now = new Date();
    
    if (from && to) {
      startDate = from;
      endDate = to;
    } else if (period === 'today') {
      startDate = endDate;
    } else if (period === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      startDate = weekAgo.toISOString().split('T')[0];
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    } else if (period === 'quarter') {
      const quarter = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), quarter, 1).toISOString().split('T')[0];
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    } else {
      // Default to last 30 days
      const monthAgo = new Date(now);
      monthAgo.setDate(now.getDate() - 30);
      startDate = monthAgo.toISOString().split('T')[0];
    }
    
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
    
    // 2️⃣ Performance Summary - Includes both completed AND pending for true collection rate
    const performanceQuery = `
      SELECT 
        COUNT(DISTINCT se.id) as total_services,
        COUNT(DISTINCT se.customer_name) as unique_customers,
        COUNT(DISTINCT DATE(se.created_at)) as active_days,
        
        COALESCE(SUM(se.total_charges), 0) as total_billed,
        COALESCE(SUM(se.service_charges), 0) as total_service_charges,
        COALESCE(SUM(se.department_charges), 0) as total_department_charges,
        
        COALESCE(SUM(p.amount), 0) as total_collected,
        
        COALESCE(AVG(p.amount), 0) as avg_transaction_value,
        
        -- Collection rate
        CASE 
          WHEN COALESCE(SUM(se.total_charges), 0) > 0 
          THEN ROUND((COALESCE(SUM(p.amount), 0) / COALESCE(SUM(se.total_charges), 0)) * 100, 2)
          ELSE 0 
        END as collection_rate,
        
        -- Average daily revenue
        CASE 
          WHEN COUNT(DISTINCT DATE(se.created_at)) > 0 
          THEN ROUND(COALESCE(SUM(p.amount), 0) / COUNT(DISTINCT DATE(se.created_at)), 2)
          ELSE 0 
        END as avg_daily_revenue,
        
        -- Average daily services
        CASE 
          WHEN COUNT(DISTINCT DATE(se.created_at)) > 0 
          THEN ROUND(COUNT(DISTINCT se.id)::numeric / COUNT(DISTINCT DATE(se.created_at)), 2)
          ELSE 0 
        END as avg_daily_services
        
      FROM service_entries se
      LEFT JOIN ${TRUE_PAYMENTS_SUBQUERY} p ON p.service_entry_id = se.id
      WHERE se.staff_id = $1 
        AND se.status IN ('completed', 'pending')
        AND DATE(se.created_at) BETWEEN $2 AND $3
    `;
    const performanceData = await client.query(performanceQuery, [staffId, startDate, endDate]);
    const perf = performanceData.rows[0];
    
    // 2b️⃣ Additional Metrics: Repeat Customer Rate
    const repeatCustomerQuery = `
      WITH customer_visits AS (
        SELECT 
          customer_name,
          COUNT(DISTINCT se.id) as visit_count
        FROM service_entries se
        WHERE se.staff_id = $1 
          AND se.status IN ('completed', 'pending')
          AND DATE(se.created_at) BETWEEN $2 AND $3
          AND se.customer_name IS NOT NULL
          AND se.customer_name != ''
        GROUP BY customer_name
      )
      SELECT 
        COUNT(*) as total_customers,
        COUNT(CASE WHEN visit_count > 1 THEN 1 END) as repeat_customers
      FROM customer_visits
    `;
    const repeatCustomerData = await client.query(repeatCustomerQuery, [staffId, startDate, endDate]);
    
    const totalCustomersWithVisits = parseInt(repeatCustomerData.rows[0]?.total_customers || 0);
    const repeatCustomers = parseInt(repeatCustomerData.rows[0]?.repeat_customers || 0);
    const repeatCustomerRate = totalCustomersWithVisits > 0 ? (repeatCustomers / totalCustomersWithVisits) * 100 : 0;
    
    // 2c️⃣ Revenue Per Service
    const revenuePerService = perf.total_services > 0 ? perf.total_collected / perf.total_services : 0;
    
    // 2d️⃣ Collection Efficiency (combines rate and speed - % of payments within 7 days)
    const collectionEfficiencyQuery = `
      SELECT 
        COUNT(DISTINCT se.id) as total_services_with_payments,
        COUNT(DISTINCT CASE 
          WHEN p.received_amount > 0 AND (se.created_at::date + INTERVAL '7 days') >= p.payment_date
          THEN se.id 
        END) as ontime_paid_services
      FROM service_entries se
      LEFT JOIN LATERAL (
        SELECT received_amount, created_at as payment_date
        FROM ${TRUE_PAYMENTS_SUBQUERY} p_sub
        WHERE p_sub.service_entry_id = se.id
        LIMIT 1
      ) p ON true
      WHERE se.staff_id = $1 
        AND se.status IN ('completed', 'pending')
        AND DATE(se.created_at) BETWEEN $2 AND $3
        AND p.received_amount > 0
    `;
    const efficiencyData = await client.query(collectionEfficiencyQuery, [staffId, startDate, endDate]);
    const paidServices = parseInt(efficiencyData.rows[0]?.total_services_with_payments || 0);
    const ontimePaid = parseInt(efficiencyData.rows[0]?.ontime_paid_services || 0);
    const collectionEfficiency = paidServices > 0 ? (ontimePaid / paidServices) * 100 : 0;
    
    // 3️⃣ Pending Payments
    const pendingQuery = `
      SELECT 
        COUNT(se.id) as pending_count,
        COALESCE(SUM(se.total_charges - COALESCE(p.received_amount, 0)), 0) as pending_amount,
        COUNT(CASE WHEN (CURRENT_DATE - se.created_at::date) > 7 
              AND (se.total_charges - COALESCE(p.received_amount, 0)) > 0 THEN 1 END) as overdue_count,
        COALESCE(SUM(CASE WHEN (CURRENT_DATE - se.created_at::date) > 7 
              THEN (se.total_charges - COALESCE(p.received_amount, 0)) ELSE 0 END), 0) as overdue_amount
      FROM service_entries se
      LEFT JOIN ${TRUE_PAYMENTS_SUBQUERY} p ON p.service_entry_id = se.id
      WHERE se.staff_id = $1 
        AND se.status != 'completed'
        AND (se.total_charges - COALESCE(p.received_amount, 0)) > 0
    `;
    const pendingData = await client.query(pendingQuery, [staffId]);
    
    // 4️⃣ Daily Performance for Charts
    const dailyPerformanceQuery = `
      SELECT 
        DATE(se.created_at) as date,
        COUNT(DISTINCT se.id) as services_count,
        COALESCE(SUM(se.total_charges), 0) as billed_amount,
        COALESCE(SUM(p.amount), 0) as collected_amount,
        COALESCE(SUM(se.service_charges), 0) as service_charges
      FROM service_entries se
      LEFT JOIN ${TRUE_PAYMENTS_SUBQUERY} p ON p.service_entry_id = se.id
      WHERE se.staff_id = $1 
        AND se.status IN ('completed', 'pending')
        AND DATE(se.created_at) BETWEEN $2 AND $3
      GROUP BY DATE(se.created_at)
      ORDER BY date ASC
    `;
    const dailyData = await client.query(dailyPerformanceQuery, [staffId, startDate, endDate]);
    
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
      LEFT JOIN ${TRUE_PAYMENTS_SUBQUERY} p ON p.service_entry_id = se.id
      WHERE se.staff_id = $1 
        AND se.status IN ('completed', 'pending')
        AND DATE(se.created_at) BETWEEN $2 AND $3
      GROUP BY s.id, s.name
      ORDER BY total_revenue DESC
      LIMIT 10
    `;
    const categoryData = await client.query(categoryQuery, [staffId, startDate, endDate]);
    
    // 6️⃣ Top Customers
    const topCustomersQuery = `
      SELECT 
        se.customer_name,
        se.phone,
        COUNT(se.id) as service_count,
        COALESCE(SUM(p.amount), 0) as total_spent
      FROM service_entries se
      LEFT JOIN ${TRUE_PAYMENTS_SUBQUERY} p ON p.service_entry_id = se.id
      WHERE se.staff_id = $1 
        AND se.status IN ('completed', 'pending')
        AND DATE(se.created_at) BETWEEN $2 AND $3
        AND se.customer_name IS NOT NULL
        AND se.customer_name != ''
      GROUP BY se.customer_name, se.phone
      ORDER BY total_spent DESC
      LIMIT 5
    `;
    const topCustomers = await client.query(topCustomersQuery, [staffId, startDate, endDate]);
    
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
      LEFT JOIN ${TRUE_PAYMENTS_SUBQUERY} p ON p.service_entry_id = se.id
      WHERE se.staff_id = $1 
        AND DATE(se.created_at) BETWEEN $2 AND $3
      ORDER BY se.created_at DESC
      LIMIT 20
    `;
    const recentServices = await client.query(recentServicesQuery, [staffId, startDate, endDate]);
    
    // 8️⃣ Rating Summary
    const ratingQuery = `
      SELECT 
        COUNT(*) as total_reviews,
        COALESCE(AVG(staff_rating), 0) as avg_staff_rating,
        COALESCE(AVG(service_rating), 0) as avg_service_rating,
        COUNT(CASE WHEN staff_rating >= 4 THEN 1 END) as positive_reviews,
        COUNT(CASE WHEN staff_rating <= 2 THEN 1 END) as negative_reviews,
        COUNT(CASE WHEN staff_rating = 5 THEN 1 END) as five_star,
        COUNT(CASE WHEN staff_rating = 4 THEN 1 END) as four_star,
        COUNT(CASE WHEN staff_rating = 3 THEN 1 END) as three_star,
        COUNT(CASE WHEN staff_rating = 2 THEN 1 END) as two_star,
        COUNT(CASE WHEN staff_rating = 1 THEN 1 END) as one_star
      FROM service_reviews
      WHERE staff_id = $1 
        AND is_submitted = true
        AND DATE(created_at) BETWEEN $2 AND $3
    `;
    const ratingData = await client.query(ratingQuery, [staffId, startDate, endDate]);
    
    // CSAT Score (percentage of 4 & 5 star reviews)
    const totalReviews = parseInt(ratingData.rows[0]?.total_reviews || 0);
    const positiveReviews = parseInt(ratingData.rows[0]?.positive_reviews || 0);
    const csatScore = totalReviews > 0 ? (positiveReviews / totalReviews) * 100 : 0;
    
    // 9️⃣ Monthly Trends
    const monthlyTrendsQuery = `
      SELECT 
        TO_CHAR(se.created_at, 'YYYY-MM') as month,
        COUNT(*) as total_services,
        COALESCE(SUM(p.amount), 0) as total_collected,
        COALESCE(SUM(se.service_charges), 0) as service_charges
      FROM service_entries se
      LEFT JOIN ${TRUE_PAYMENTS_SUBQUERY} p ON p.service_entry_id = se.id
      WHERE se.staff_id = $1 
        AND se.status IN ('completed', 'pending')
        AND se.created_at >= (CURRENT_DATE - INTERVAL '6 months')
      GROUP BY TO_CHAR(se.created_at, 'YYYY-MM')
      ORDER BY month ASC
    `;
    const monthlyTrends = await client.query(monthlyTrendsQuery, [staffId]);
    
    // 🔟 Calculate Incentive Score
    const activeDays = perf.active_days || 1;
    const totalDaysInPeriod = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
    const consistencyScore = Math.min((activeDays / totalDaysInPeriod) * 100, 100);
    const collectionScore = Math.min(perf.collection_rate || 0, 100);
    const revenueScore = Math.min((perf.avg_daily_revenue / 5000) * 100, 100); // ₹5000 target per day
    
    const incentiveScore = Math.round(
      (collectionScore * 0.5) + (revenueScore * 0.3) + (consistencyScore * 0.2)
    );
    
    // 1️⃣1️⃣ Rating Distribution for Chart
    const ratingDistribution = [
      { rating: 5, count: ratingData.rows[0]?.five_star || 0 },
      { rating: 4, count: ratingData.rows[0]?.four_star || 0 },
      { rating: 3, count: ratingData.rows[0]?.three_star || 0 },
      { rating: 2, count: ratingData.rows[0]?.two_star || 0 },
      { rating: 1, count: ratingData.rows[0]?.one_star || 0 }
    ];
    
    // 1️⃣2️⃣ Attendance Summary
    const attendanceQuery = `
      SELECT 
        COUNT(*) as total_days,
        COUNT(CASE WHEN status = 'present' THEN 1 END) as present_days,
        COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_days,
        COUNT(CASE WHEN status = 'late' THEN 1 END) as late_days,
        COALESCE(SUM(hours), 0) as total_hours,
        COALESCE(SUM(late_minutes), 0) as total_late_minutes,
        COALESCE(SUM(extra_minutes), 0) as total_extra_minutes
      FROM attendance
      WHERE staff_id = $1 
        AND date BETWEEN $2::date AND $3::date
    `;
    const attendanceData = await client.query(attendanceQuery, [staffId, startDate, endDate]);
    
    // 1️⃣3️⃣ Weekly Performance Breakdown
    const weeklyBreakdownQuery = `
      SELECT 
        EXTRACT(WEEK FROM se.created_at) as week_number,
        MIN(DATE(se.created_at)) as week_start,
        COUNT(*) as services_count,
        COALESCE(SUM(p.amount), 0) as total_collected
      FROM service_entries se
      LEFT JOIN ${TRUE_PAYMENTS_SUBQUERY} p ON p.service_entry_id = se.id
      WHERE se.staff_id = $1 
        AND se.status IN ('completed', 'pending')
        AND DATE(se.created_at) BETWEEN $2 AND $3
      GROUP BY EXTRACT(WEEK FROM se.created_at)
      ORDER BY week_start ASC
    `;
    const weeklyBreakdown = await client.query(weeklyBreakdownQuery, [staffId, startDate, endDate]);
    
    // Calculate average rating
    const avgRating = ratingData.rows[0]?.total_reviews > 0 
      ? parseFloat(ratingData.rows[0].avg_staff_rating).toFixed(1)
      : '0.0';
    
    // Prepare response
    res.json({
      success: true,
      data: {
        staff: staffInfo.rows[0],
        period: { 
          from: startDate, 
          to: endDate, 
          period,
          total_days: totalDaysInPeriod
        },
        summary: {
          total_services: parseInt(perf.total_services || 0),
          total_billed: parseFloat(perf.total_billed || 0),
          total_collected: parseFloat(perf.total_collected || 0),
          total_service_charges: parseFloat(perf.total_service_charges || 0),
          total_department_charges: parseFloat(perf.total_department_charges || 0),
          collection_rate: parseFloat(perf.collection_rate || 0),
          avg_transaction_value: parseFloat(perf.avg_transaction_value || 0),
          active_days: parseInt(perf.active_days || 0),
          unique_customers: parseInt(perf.unique_customers || 0),
          avg_daily_revenue: parseFloat(perf.avg_daily_revenue || 0),
          avg_daily_services: parseFloat(perf.avg_daily_services || 0),
          incentive_score: incentiveScore,
          // New metrics
          repeat_customer_rate: parseFloat(repeatCustomerRate.toFixed(2)),
          revenue_per_service: parseFloat(revenuePerService.toFixed(2)),
          collection_efficiency: parseFloat(collectionEfficiency.toFixed(2)),
          csat_score: parseFloat(csatScore.toFixed(2))
        },
        pending: {
          pending_count: parseInt(pendingData.rows[0]?.pending_count || 0),
          pending_amount: parseFloat(pendingData.rows[0]?.pending_amount || 0),
          overdue_count: parseInt(pendingData.rows[0]?.overdue_count || 0),
          overdue_amount: parseFloat(pendingData.rows[0]?.overdue_amount || 0)
        },
        daily_performance: dailyData.rows.map(row => ({
          date: row.date,
          services_count: parseInt(row.services_count),
          billed_amount: parseFloat(row.billed_amount),
          collected_amount: parseFloat(row.collected_amount),
          service_charges: parseFloat(row.service_charges)
        })),
        category_breakdown: categoryData.rows.map(row => ({
          service_id: row.service_id,
          service_name: row.service_name,
          count: parseInt(row.count),
          total_revenue: parseFloat(row.total_revenue),
          total_profit: parseFloat(row.total_profit)
        })),
        top_customers: topCustomers.rows.map(row => ({
          customer_name: row.customer_name,
          phone: row.phone,
          service_count: parseInt(row.service_count),
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
          total_reviews: parseInt(ratingData.rows[0]?.total_reviews || 0),
          avg_rating: parseFloat(avgRating),
          avg_service_rating: parseFloat(ratingData.rows[0]?.avg_service_rating || 0),
          positive_reviews: parseInt(ratingData.rows[0]?.positive_reviews || 0),
          negative_reviews: parseInt(ratingData.rows[0]?.negative_reviews || 0),
          distribution: ratingDistribution
        },
        monthly_trends: monthlyTrends.rows.map(row => ({
          month: row.month,
          total_services: parseInt(row.total_services),
          total_collected: parseFloat(row.total_collected),
          service_charges: parseFloat(row.service_charges)
        })),
        weekly_breakdown: weeklyBreakdown.rows.map(row => ({
          week_number: parseInt(row.week_number),
          week_start: row.week_start,
          services_count: parseInt(row.services_count),
          total_collected: parseFloat(row.total_collected)
        })),
        attendance: {
          total_days: parseInt(attendanceData.rows[0]?.total_days || 0),
          present_days: parseInt(attendanceData.rows[0]?.present_days || 0),
          absent_days: parseInt(attendanceData.rows[0]?.absent_days || 0),
          late_days: parseInt(attendanceData.rows[0]?.late_days || 0),
          attendance_rate: attendanceData.rows[0]?.total_days > 0 
            ? Math.round((attendanceData.rows[0].present_days / attendanceData.rows[0].total_days) * 100)
            : 0,
          total_hours: parseFloat(attendanceData.rows[0]?.total_hours || 0),
          total_late_minutes: parseInt(attendanceData.rows[0]?.total_late_minutes || 0),
          total_extra_minutes: parseInt(attendanceData.rows[0]?.total_extra_minutes || 0)
        }
      }
    });
    
    // Log activity
    await logActivity({
      centre_id: staffInfo.rows[0].centreId,
      related_type: 'staff_performance',
      related_id: staffId,
      action: 'Performance Viewed',
      description: `Staff ${staffInfo.rows[0].name} viewed their performance dashboard`,
      performed_by: staffId,
      performed_by_role: 'staff'
    });
    
  } catch (err) {
    console.error('Staff performance dashboard error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load performance data',
      details: err.message 
    });
  } finally {
    client.release();
  }
});

/* =========================================================
   2️⃣ STAFF PERFORMANCE COMPARISON
   Compare current performance with previous period
========================================================= */
router.get('/compare', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const staffId = req.user.id;
    const { period = 'month' } = req.query;
    
    // Get current period dates
    const now = new Date();
    let currentStart, currentEnd = now.toISOString().split('T')[0];
    let previousStart, previousEnd;
    
    if (period === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      currentStart = weekAgo.toISOString().split('T')[0];
      const twoWeeksAgo = new Date(now);
      twoWeeksAgo.setDate(now.getDate() - 14);
      previousStart = twoWeeksAgo.toISOString().split('T')[0];
      previousEnd = weekAgo.toISOString().split('T')[0];
    } else if (period === 'month') {
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousStart = prevMonth.toISOString().split('T')[0];
      previousEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    } else if (period === 'quarter') {
      const quarter = Math.floor(now.getMonth() / 3) * 3;
      currentStart = new Date(now.getFullYear(), quarter, 1).toISOString().split('T')[0];
      const prevQuarterStart = new Date(now.getFullYear(), quarter - 3, 1);
      previousStart = prevQuarterStart.toISOString().split('T')[0];
      previousEnd = new Date(now.getFullYear(), quarter, 0).toISOString().split('T')[0];
    } else {
      currentStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      previousStart = new Date(now.getFullYear() - 1, 0, 1).toISOString().split('T')[0];
      previousEnd = new Date(now.getFullYear() - 1, 11, 31).toISOString().split('T')[0];
    }
    
    // Get current period performance
    const currentQuery = `
      SELECT 
        COUNT(DISTINCT se.id) as total_services,
        COALESCE(SUM(p.amount), 0) as total_collected,
        COALESCE(SUM(se.service_charges), 0) as total_profit,
        COALESCE(AVG(p.amount), 0) as avg_transaction,
        COUNT(DISTINCT se.customer_name) as unique_customers
      FROM service_entries se
      LEFT JOIN ${TRUE_PAYMENTS_SUBQUERY} p ON p.service_entry_id = se.id
      WHERE se.staff_id = $1 
        AND se.status IN ('completed', 'pending')
        AND DATE(se.created_at) BETWEEN $2 AND $3
    `;
    const currentResult = await client.query(currentQuery, [staffId, currentStart, currentEnd]);
    
    // Get previous period performance
    const previousResult = await client.query(currentQuery, [staffId, previousStart, previousEnd]);
    
    // Calculate changes
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };
    
    const current = currentResult.rows[0];
    const previous = previousResult.rows[0];
    
    res.json({
      success: true,
      data: {
        period: {
          current: { from: currentStart, to: currentEnd },
          previous: { from: previousStart, to: previousEnd }
        },
        metrics: {
          services: {
            current: parseInt(current.total_services || 0),
            previous: parseInt(previous.total_services || 0),
            change: calculateChange(current.total_services, previous.total_services)
          },
          revenue: {
            current: parseFloat(current.total_collected || 0),
            previous: parseFloat(previous.total_collected || 0),
            change: calculateChange(current.total_collected, previous.total_collected)
          },
          profit: {
            current: parseFloat(current.total_profit || 0),
            previous: parseFloat(previous.total_profit || 0),
            change: calculateChange(current.total_profit, previous.total_profit)
          },
          avgTransaction: {
            current: parseFloat(current.avg_transaction || 0),
            previous: parseFloat(previous.avg_transaction || 0),
            change: calculateChange(current.avg_transaction, previous.avg_transaction)
          },
          customers: {
            current: parseInt(current.unique_customers || 0),
            previous: parseInt(previous.unique_customers || 0),
            change: calculateChange(current.unique_customers, previous.unique_customers)
          }
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
      LEFT JOIN ${TRUE_PAYMENTS_SUBQUERY} p ON p.service_entry_id = se.id
      WHERE se.staff_id = $1 AND se.status IN ('completed', 'pending')
    `;
    const lifetime = await client.query(lifetimeQuery, [staffId]);
    
    // Get best day
    const bestDayQuery = `
      SELECT 
        DATE(se.created_at) as date,
        COUNT(DISTINCT se.id) as services_count,
        COALESCE(SUM(p.amount), 0) as revenue
      FROM service_entries se
      LEFT JOIN ${TRUE_PAYMENTS_SUBQUERY} p ON p.service_entry_id = se.id
      WHERE se.staff_id = $1 AND se.status IN ('completed', 'pending')
      GROUP BY DATE(se.created_at)
      ORDER BY revenue DESC
      LIMIT 1
    `;
    const bestDay = await client.query(bestDayQuery, [staffId]);
    
    // Get top customer
    const topCustomerQuery = `
      SELECT 
        se.customer_name,
        COUNT(se.id) as services_count,
        COALESCE(SUM(p.amount), 0) as total_spent
      FROM service_entries se
      LEFT JOIN ${TRUE_PAYMENTS_SUBQUERY} p ON p.service_entry_id = se.id
      WHERE se.staff_id = $1 
        AND se.status IN ('completed', 'pending')
        AND se.customer_name IS NOT NULL
        AND se.customer_name != ''
      GROUP BY se.customer_name
      ORDER BY total_spent DESC
      LIMIT 1
    `;
    const topCustomer = await client.query(topCustomerQuery, [staffId]);
    
    // Get weekly streak (consecutive weeks with at least one service)
    const weeklyStreakQuery = `
      WITH weekly_activity AS (
        SELECT 
          DATE_TRUNC('week', se.created_at) as week_start,
          COUNT(*) as services_count
        FROM service_entries se
        WHERE se.staff_id = $1 AND se.status IN ('completed', 'pending')
        GROUP BY DATE_TRUNC('week', se.created_at)
      ),
      streak_calc AS (
        SELECT 
          week_start,
          services_count,
          ROW_NUMBER() OVER (ORDER BY week_start) as rn,
          week_start - (ROW_NUMBER() OVER (ORDER BY week_start) * INTERVAL '7 days') as streak_group
        FROM weekly_activity
      )
      SELECT COUNT(*) as current_streak FROM (
        SELECT streak_group, COUNT(*) as streak_length
        FROM streak_calc
        GROUP BY streak_group
        ORDER BY MAX(week_start) DESC
        LIMIT 1
      ) current_streak
    `;
    const weeklyStreakResult = await client.query(weeklyStreakQuery, [staffId]);
    const weeklyStreak = parseInt(weeklyStreakResult.rows[0]?.current_streak || 0);
    
    // Get daily revenue streak (consecutive days with revenue > 0)
    const dailyStreakQuery = `
      WITH daily_revenue AS (
        SELECT 
          DATE(se.created_at) as day,
          COALESCE(SUM(p.amount), 0) as revenue
        FROM service_entries se
        LEFT JOIN ${TRUE_PAYMENTS_SUBQUERY} p ON p.service_entry_id = se.id
        WHERE se.staff_id = $1 AND se.status IN ('completed', 'pending')
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
      )
      SELECT COUNT(*) as current_streak FROM (
        SELECT streak_group, COUNT(*) as streak_length
        FROM streak_calc
        GROUP BY streak_group
        ORDER BY MAX(day) DESC
        LIMIT 1
      ) current_streak
    `;
    const dailyStreakResult = await client.query(dailyStreakQuery, [staffId]);
    const dailyRevenueStreak = parseInt(dailyStreakResult.rows[0]?.current_streak || 0);
    
    // Get service variety (distinct service categories)
    const varietyQuery = `
      SELECT COUNT(DISTINCT se.category_id) as distinct_categories
      FROM service_entries se
      WHERE se.staff_id = $1 AND se.status IN ('completed', 'pending')
    `;
    const varietyResult = await client.query(varietyQuery, [staffId]);
    const distinctCategories = parseInt(varietyResult.rows[0]?.distinct_categories || 0);
    
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
    const topCategory = await client.query(topCategoryQuery, [staffId]);
    
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
    const ratingAchievements = await client.query(ratingAchievementsQuery, [staffId]);
    const totalFiveStar = ratingAchievements.rows.reduce((sum, row) => sum + parseInt(row.five_star_count || 0), 0);
    const perfectMonths = ratingAchievements.rows.filter(row => {
      const totalReviewsQuery = `
        SELECT COUNT(*) as total
        FROM service_reviews
        WHERE staff_id = $1 AND is_submitted = true 
          AND DATE_TRUNC('month', created_at) = $2::timestamp
      `;
      // Simplified - we'll calculate later
      return false;
    });
    
    // Get collection rate achievements
    const collectionRateQuery = `
      SELECT 
        CASE 
          WHEN SUM(se.total_charges) > 0 
          THEN (SUM(p.amount) / SUM(se.total_charges)) * 100 
          ELSE 0 
        END as lifetime_collection_rate
      FROM service_entries se
      LEFT JOIN ${TRUE_PAYMENTS_SUBQUERY} p ON p.service_entry_id = se.id
      WHERE se.staff_id = $1 AND se.status IN ('completed', 'pending')
    `;
    const collectionRateResult = await client.query(collectionRateQuery, [staffId]);
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
          date: bestDay.rows[0].date,
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
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load achievements',
      details: err.message 
    });
  } finally {
    client.release();
  }
});

/* =========================================================
   4️⃣ STAFF PERFORMANCE BY SERVICE TYPE
   Detailed breakdown by service category
========================================================= */
router.get('/service-breakdown', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const staffId = req.user.id;
    const { from, to } = req.query;
    
    let startDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    let endDate = to || new Date().toISOString().split('T')[0];
    
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
      LEFT JOIN ${TRUE_PAYMENTS_SUBQUERY} p ON p.service_entry_id = se.id
      WHERE se.staff_id = $1 
        AND se.status IN ('completed', 'pending')
        AND DATE(se.created_at) BETWEEN $2 AND $3
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
  const client = await pool.connect();
  
  try {
    const staffId = req.user.id;
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
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
      LEFT JOIN ${TRUE_PAYMENTS_SUBQUERY} p ON p.service_entry_id = se.id
      WHERE se.staff_id = $1 AND DATE(se.created_at) = $2
      ORDER BY se.created_at DESC
    `;
    const services = await client.query(servicesQuery, [staffId, targetDate]);
    
    // Get attendance for the day
    const attendanceQuery = `
      SELECT 
        id,
        punch_in,
        punch_out,
        breaks,
        hours,
        status,
        late_minutes,
        extra_minutes
      FROM attendance
      WHERE staff_id = $1 AND date = $2
    `;
    const attendance = await client.query(attendanceQuery, [staffId, targetDate]);
    
    // Calculate daily totals
    const dailyTotal = services.rows.reduce((sum, row) => sum + parseFloat(row.received_amount || 0), 0);
    const dailyServiceCount = services.rows.length;
    const dailyProfit = services.rows.reduce((sum, row) => sum + parseFloat(row.service_charges || 0), 0);
    
    res.json({
      success: true,
      data: {
        date: targetDate,
        attendance: attendance.rows[0] || null,
        services: services.rows.map(row => ({
          id: row.id,
          time: row.created_at ? new Date(row.created_at).toLocaleTimeString() : null,
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
   NEW: HYBRID BFF WORKSPACE INIT ROUTE
   Aggregates Performance, Tasks, Events, Recent Activity & Bookings
============================================================== */
router.get('/workspace-init', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const staffId = req.user.id;
    const centreId = req.user.centre_id;
    const { period = 'month', from, to } = req.query;

    // Date Filtering Logic for Performance
    let dateFilter = '';
    let queryParams = [staffId];
    let paramIndex = 2;

    if (period === 'today') dateFilter = `AND se.created_at::date = CURRENT_DATE`;
    else if (period === 'week') dateFilter = `AND se.created_at >= date_trunc('week', CURRENT_DATE)`;
    else if (period === 'month') dateFilter = `AND se.created_at >= date_trunc('month', CURRENT_DATE)`;
    else if (period === 'quarter') dateFilter = `AND se.created_at >= date_trunc('quarter', CURRENT_DATE)`;
    else if (period === 'year') dateFilter = `AND se.created_at >= date_trunc('year', CURRENT_DATE)`;
    else if (period === 'custom' && from && to) {
      dateFilter = `AND se.created_at::date BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      queryParams.push(from, to);
      paramIndex += 2;
    }

    // Fire ALL queries concurrently in PostgreSQL 
    const [
      performanceRes,
      ratingsRes,
      tasksRes,
      eventsRes,
      recentActivityRes,
      onlinePendingRes,
      onlineProcessingRes
    ] = await Promise.all([
      // 1. Performance Summary
      client.query(`
        SELECT
          COUNT(se.id) as total_services,
          COALESCE(SUM(se.total_charges), 0) as total_amount,
          COALESCE(SUM(p.received_amount), 0) as total_collected
        FROM service_entries se
        LEFT JOIN ${TRUE_PAYMENTS_SUBQUERY} p ON p.service_entry_id = se.id
        WHERE se.staff_id = $1 AND se.status = 'completed' ${dateFilter}
      `, queryParams),

      // 2. Ratings
      client.query(`
        SELECT
          COUNT(sr.id) as total_reviews,
          COALESCE(AVG(sr.staff_rating), 0) as avg_rating
        FROM service_reviews sr
        WHERE sr.staff_id = $1 AND sr.is_submitted = true
      `, [staffId]),

      // 3. Tasks (Pending)
      client.query(`
        SELECT id, title, due_date
        FROM tasks
        WHERE assigned_to = $1 AND status = 'pending'
        ORDER BY due_date ASC NULLS LAST
      `, [staffId]),

      // 4. Events (Aliased safely to your exact table columns)
      client.query(`
        SELECT 
          id, title, description, date, start_datetime, 
          type as source, 
          related_service_id as tracking_id
        FROM calendar_events
        WHERE (visibility = 'global' OR (visibility = 'centre' AND centre_id = $1))
          AND COALESCE(date, start_datetime::date) >= CURRENT_DATE
          AND COALESCE(date, start_datetime::date) <= CURRENT_DATE + INTERVAL '7 days'
        ORDER BY COALESCE(date, start_datetime::date) ASC
        LIMIT 10
      `, [centreId]),

      // 5. Recent Activity (Service Entries)
      client.query(`
        SELECT
          se.id, se.created_at, se.customer_name, se.phone, se.status,
          se.category_id as category, se.token_id as "tokenId",
          se.is_edited, se.work_source, se.id as tracking_id
        FROM service_entries se
        WHERE se.staff_id = $1
        ORDER BY se.created_at DESC
        LIMIT 20
      `, [staffId]),

      // 6. Online Bookings (Pending - Fixed: using 'customers' table)
      client.query(`
        SELECT cs.*, c.name as customer_name, c.phone
        FROM customer_services cs
        LEFT JOIN customers c ON cs.customer_id = c.id
        WHERE cs.status = 'under_review'
        ORDER BY cs.applied_at DESC
      `),

      // 7. Online Bookings (Processing by this staff - Fixed: using 'customers' table)
      client.query(`
        SELECT cs.*, c.name as customer_name, c.phone
        FROM customer_services cs
        LEFT JOIN customers c ON cs.customer_id = c.id
        WHERE cs.status = 'processing' AND cs.assigned_staff_id = $1
        ORDER BY cs.taken_at DESC
      `, [staffId])
    ]);

    const summary = performanceRes.rows[0];
    const ratings = ratingsRes.rows[0];

    const totalServices = parseInt(summary.total_services) || 0;
    const totalCollected = parseFloat(summary.total_collected) || 0;
    const totalAmount = parseFloat(summary.total_amount) || 0;

    const collectionRate = totalAmount > 0 ? Math.round((totalCollected / totalAmount) * 100) : 0;
    const avgTransactionValue = totalServices > 0 ? Math.round(totalCollected / totalServices) : 0;
    const avgRating = parseFloat(ratings.avg_rating) || 0;

    // Basic Incentive Score Calculation
    const incentiveScore = Math.min(100, Math.round(
      (collectionRate * 0.5) +
      (totalServices > 10 ? 30 : totalServices * 3) +
      (avgRating * 4) // 5 * 4 = 20
    ));

    res.json({
      success: true,
      data: {
        performance: {
          summary: {
            total_services: totalServices,
            total_collected: totalCollected,
            collection_rate: collectionRate,
            avg_transaction_value: avgTransactionValue,
            incentive_score: incentiveScore
          },
          ratings: {
            avg_rating: avgRating.toFixed(1),
            total_reviews: parseInt(ratings.total_reviews)
          }
        },
        tasks: tasksRes.rows,
        events: eventsRes.rows,
        recentActivity: recentActivityRes.rows,
        onlinePending: onlinePendingRes.rows,
        onlineProcessing: onlineProcessingRes.rows
      }
    });

  } catch (err) {
    console.error('Workspace Init Error:', err);
    res.status(500).json({ error: 'Failed to initialize workspace' });
  } finally {
    client.release();
  }
});

export default router;
