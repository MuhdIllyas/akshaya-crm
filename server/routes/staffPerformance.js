// backend/routes/staffPerformance.js
import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { logActivity } from '../utils/activityLogger.js';

const router = express.Router();

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
    
    // 2️⃣ Performance Summary - Calculate from payments and service_entries
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
      LEFT JOIN payments p ON p.service_entry_id = se.id AND p.status = 'received'
      WHERE se.staff_id = $1 
        AND se.status = 'completed'
        AND DATE(se.created_at) BETWEEN $2 AND $3
    `;
    const performanceData = await client.query(performanceQuery, [staffId, startDate, endDate]);
    const perf = performanceData.rows[0];
    
    // 3️⃣ Pending Payments - Calculate from payments (services with partial or no payment)
    const pendingQuery = `
      SELECT 
        COUNT(se.id) as pending_count,
        COALESCE(SUM(se.total_charges - COALESCE(p.received_amount, 0)), 0) as pending_amount,
        COUNT(CASE WHEN (CURRENT_DATE - se.created_at::date) > 7 
              AND (se.total_charges - COALESCE(p.received_amount, 0)) > 0 THEN 1 END) as overdue_count,
        COALESCE(SUM(CASE WHEN (CURRENT_DATE - se.created_at::date) > 7 
              THEN (se.total_charges - COALESCE(p.received_amount, 0)) ELSE 0 END), 0) as overdue_amount
      FROM service_entries se
      LEFT JOIN (
        SELECT service_entry_id, SUM(amount) as received_amount
        FROM payments
        WHERE status = 'received'
        GROUP BY service_entry_id
      ) p ON p.service_entry_id = se.id
      WHERE se.staff_id = $1 
        AND se.status != 'completed'
        AND (se.total_charges - COALESCE(p.received_amount, 0)) > 0
    `;
    const pendingData = await client.query(pendingQuery, [staffId]);
    
    // 4️⃣ Daily Performance for Charts - Calculate received amount from payments
    const dailyPerformanceQuery = `
      SELECT 
        DATE(se.created_at) as date,
        COUNT(DISTINCT se.id) as services_count,
        COALESCE(SUM(se.total_charges), 0) as billed_amount,
        COALESCE(SUM(p.amount), 0) as collected_amount,
        COALESCE(SUM(se.service_charges), 0) as service_charges
      FROM service_entries se
      LEFT JOIN payments p ON p.service_entry_id = se.id AND p.status = 'received'
      WHERE se.staff_id = $1 
        AND se.status = 'completed'
        AND DATE(se.created_at) BETWEEN $2 AND $3
      GROUP BY DATE(se.created_at)
      ORDER BY date ASC
    `;
    const dailyData = await client.query(dailyPerformanceQuery, [staffId, startDate, endDate]);
    
    // 5️⃣ Service Category Breakdown - Calculate revenue from payments
    const categoryQuery = `
      SELECT 
        s.id as service_id,
        s.name as service_name,
        COUNT(se.id) as count,
        COALESCE(SUM(p.amount), 0) as total_revenue,
        COALESCE(SUM(se.service_charges), 0) as total_profit
      FROM service_entries se
      JOIN services s ON se.category_id = s.id
      LEFT JOIN payments p ON p.service_entry_id = se.id AND p.status = 'received'
      WHERE se.staff_id = $1 
        AND se.status = 'completed'
        AND DATE(se.created_at) BETWEEN $2 AND $3
      GROUP BY s.id, s.name
      ORDER BY total_revenue DESC
      LIMIT 10
    `;
    const categoryData = await client.query(categoryQuery, [staffId, startDate, endDate]);
    
    // 6️⃣ Top Customers - Using customer_name and payments
    const topCustomersQuery = `
      SELECT 
        se.customer_name,
        se.phone,
        COUNT(se.id) as service_count,
        COALESCE(SUM(p.amount), 0) as total_spent
      FROM service_entries se
      LEFT JOIN payments p ON p.service_entry_id = se.id AND p.status = 'received'
      WHERE se.staff_id = $1 
        AND se.status = 'completed'
        AND DATE(se.created_at) BETWEEN $2 AND $3
        AND se.customer_name IS NOT NULL
        AND se.customer_name != ''
      GROUP BY se.customer_name, se.phone
      ORDER BY total_spent DESC
      LIMIT 5
    `;
    const topCustomers = await client.query(topCustomersQuery, [staffId, startDate, endDate]);
    
    // 7️⃣ Recent Services - Include payment info
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
      LEFT JOIN (
        SELECT service_entry_id, SUM(amount) as received_amount
        FROM payments
        WHERE status = 'received'
        GROUP BY service_entry_id
      ) p ON p.service_entry_id = se.id
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
    
    // 9️⃣ Monthly Trends - PostgreSQL compatible
    const monthlyTrendsQuery = `
      SELECT 
        TO_CHAR(se.created_at, 'YYYY-MM') as month,
        COUNT(*) as total_services,
        COALESCE(SUM(p.amount), 0) as total_collected,
        COALESCE(SUM(se.service_charges), 0) as service_charges
      FROM service_entries se
      LEFT JOIN payments p ON p.service_entry_id = se.id AND p.status = 'received'
      WHERE se.staff_id = $1 
        AND se.status = 'completed'
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
      LEFT JOIN payments p ON p.service_entry_id = se.id AND p.status = 'received'
      WHERE se.staff_id = $1 
        AND se.status = 'completed'
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
          incentive_score: incentiveScore
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
    
    // Get current period performance - using payments
    const currentQuery = `
      SELECT 
        COUNT(DISTINCT se.id) as total_services,
        COALESCE(SUM(p.amount), 0) as total_collected,
        COALESCE(SUM(se.service_charges), 0) as total_profit,
        COALESCE(AVG(p.amount), 0) as avg_transaction
      FROM service_entries se
      LEFT JOIN payments p ON p.service_entry_id = se.id AND p.status = 'received'
      WHERE se.staff_id = $1 
        AND se.status = 'completed'
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
   Track staff achievements and milestones
========================================================= */
router.get('/achievements', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const staffId = req.user.id;
    
    // Get lifetime totals - using payments
    const lifetimeQuery = `
      SELECT 
        COUNT(DISTINCT se.id) as total_services,
        COALESCE(SUM(p.amount), 0) as total_revenue,
        COUNT(DISTINCT se.customer_name) as unique_customers,
        COUNT(DISTINCT DATE(se.created_at)) as active_days
      FROM service_entries se
      LEFT JOIN payments p ON p.service_entry_id = se.id AND p.status = 'received'
      WHERE se.staff_id = $1 AND se.status = 'completed'
    `;
    const lifetime = await client.query(lifetimeQuery, [staffId]);
    
    // Get best day - using payments
    const bestDayQuery = `
      SELECT 
        DATE(se.created_at) as date,
        COUNT(DISTINCT se.id) as services_count,
        COALESCE(SUM(p.amount), 0) as revenue
      FROM service_entries se
      LEFT JOIN payments p ON p.service_entry_id = se.id AND p.status = 'received'
      WHERE se.staff_id = $1 AND se.status = 'completed'
      GROUP BY DATE(se.created_at)
      ORDER BY revenue DESC
      LIMIT 1
    `;
    const bestDay = await client.query(bestDayQuery, [staffId]);
    
    // Get top customer - using payments
    const topCustomerQuery = `
      SELECT 
        se.customer_name,
        COUNT(se.id) as services_count,
        COALESCE(SUM(p.amount), 0) as total_spent
      FROM service_entries se
      LEFT JOIN payments p ON p.service_entry_id = se.id AND p.status = 'received'
      WHERE se.staff_id = $1 
        AND se.status = 'completed'
        AND se.customer_name IS NOT NULL
        AND se.customer_name != ''
      GROUP BY se.customer_name
      ORDER BY total_spent DESC
      LIMIT 1
    `;
    const topCustomer = await client.query(topCustomerQuery, [staffId]);
    
    // Calculate achievements
    const achievements = [];
    const totalServices = parseInt(lifetime.rows[0].total_services || 0);
    const totalRevenue = parseFloat(lifetime.rows[0].total_revenue || 0);
    const uniqueCustomers = parseInt(lifetime.rows[0].unique_customers || 0);
    
    // Service count achievements
    if (totalServices >= 100) {
      achievements.push({ 
        name: 'Century Club', 
        description: 'Completed 100+ services', 
        earned: true, 
        icon: '🏆' 
      });
    } else if (totalServices >= 50) {
      achievements.push({ 
        name: 'Golden Service', 
        description: 'Completed 50+ services', 
        earned: true, 
        icon: '⭐' 
      });
    } else if (totalServices >= 25) {
      achievements.push({ 
        name: 'Silver Service', 
        description: 'Completed 25+ services', 
        earned: true, 
        icon: '🥈' 
      });
    } else {
      achievements.push({ 
        name: 'First Steps', 
        description: 'Complete 25 services', 
        earned: false, 
        icon: '🎯', 
        progress: totalServices, 
        target: 25 
      });
    }
    
    // Revenue achievements
    if (totalRevenue >= 500000) {
      achievements.push({ 
        name: 'Revenue Master', 
        description: 'Generated ₹5,00,000+ revenue', 
        earned: true, 
        icon: '💰' 
      });
    } else if (totalRevenue >= 250000) {
      achievements.push({ 
        name: 'Revenue Star', 
        description: 'Generated ₹2,50,000+ revenue', 
        earned: true, 
        icon: '🌟' 
      });
    } else if (totalRevenue >= 100000) {
      achievements.push({ 
        name: 'Revenue Rookie', 
        description: 'Generated ₹1,00,000+ revenue', 
        earned: true, 
        icon: '💵' 
      });
    } else {
      achievements.push({ 
        name: 'Revenue Hunter', 
        description: 'Generate ₹1,00,000 revenue', 
        earned: false, 
        icon: '🎯', 
        progress: totalRevenue, 
        target: 100000 
      });
    }
    
    // Customer achievements
    if (uniqueCustomers >= 50) {
      achievements.push({ 
        name: 'People\'s Champion',
        description: 'Served 50+ unique customers', 
        earned: true, 
        icon: '👥' 
      });
    } else if (uniqueCustomers >= 25) {
      achievements.push({ 
        name: 'Customer Magnet', 
        description: 'Served 25+ unique customers', 
        earned: true, 
        icon: '🧲' 
      });
    } else {
      achievements.push({ 
        name: 'Customer First', 
        description: 'Serve 25 unique customers', 
        earned: false, 
        icon: '🎯', 
        progress: uniqueCustomers, 
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
          active_days: parseInt(lifetime.rows[0].active_days || 0)
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
      LEFT JOIN payments p ON p.service_entry_id = se.id AND p.status = 'received'
      WHERE se.staff_id = $1 
        AND se.status = 'completed'
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
    
    // Get services for the day - with payments
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
      LEFT JOIN (
        SELECT service_entry_id, SUM(amount) as received_amount
        FROM payments
        WHERE status = 'received'
        GROUP BY service_entry_id
      ) p ON p.service_entry_id = se.id
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

export default router;