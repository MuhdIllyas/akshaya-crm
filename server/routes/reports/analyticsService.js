// analyticsService.js
import pool from "../../db.js";

// ==========================================
// UTILS
// ==========================================

const getDateContext = () => {
  const dateObj = new Date();
  const today = dateObj.toISOString().split('T')[0];
  const currentYear = dateObj.getFullYear();
  const currentMonthStr = today.substring(0, 7);
  const firstDayOfMonth = `${currentMonthStr}-01`;
  
  const yesterdayDate = new Date(dateObj);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().split('T')[0];
  
  const sevenDaysAgoDate = new Date(dateObj);
  sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 6);
  const sevenDaysAgo = sevenDaysAgoDate.toISOString().split('T')[0];

  return { 
    today, 
    yesterday, 
    sevenDaysAgo, 
    currentYear, 
    currentMonthStr, 
    firstDayOfMonth,
    fromDate: today, 
    toDate: today    
  };
};

// ==========================================
// LAYER 1: FETCH LAYER
// ==========================================

const fetchStaffAnalytics = async (client, centreId, dates) => {
  const [staffRes, attendanceRes, staffPerfRes] = await Promise.all([
    client.query(`
      SELECT 
        (SELECT COUNT(*) FROM staff WHERE centre_id = $1 AND status = 'Active') as total_staff,
        (SELECT COUNT(*) FROM attendance a JOIN staff s ON a.staff_id = s.id WHERE s.centre_id = $1 AND a.date = $2 AND a.status = 'present') as present_today
    `, [centreId, dates.today]),
    client.query(`
      SELECT TO_CHAR(a.date, 'Dy') as day, 
             COUNT(*) FILTER (WHERE a.status = 'present') as present,
             COUNT(*) FILTER (WHERE a.late_minutes > 0) as late
      FROM attendance a JOIN staff s ON a.staff_id = s.id 
      WHERE s.centre_id = $1 AND a.date >= $2
      GROUP BY a.date ORDER BY a.date ASC
    `, [centreId, dates.sevenDaysAgo]),
    client.query(`
      SELECT s.name as staff_name, COUNT(se.id) as service_count, COALESCE(SUM(se.service_charges), 0) as total_revenue
      FROM staff s 
      LEFT JOIN service_entries se ON s.id = se.staff_id AND se.created_at::date >= $2
      WHERE s.centre_id = $1 AND s.role = 'staff'
      GROUP BY s.id, s.name ORDER BY total_revenue DESC LIMIT 5
    `, [centreId, dates.firstDayOfMonth])
  ]);
  return { staff: staffRes.rows[0], attendance: attendanceRes.rows, performance: staffPerfRes.rows };
};

const fetchHRAnalytics = async (client, centreId, dates) => {
  const hrRes = await client.query(`
    SELECT 
      (SELECT COUNT(*) FROM leaves l JOIN staff s ON l.staff_id = s.id WHERE s.centre_id = $1 AND l.status = 'pending') as pending_leaves,
      (SELECT COUNT(*) FROM salaries sal JOIN staff s ON sal.staff_id = s.id WHERE s.centre_id = $1 AND sal.month = $2 AND sal.status = 'pending') as pending_salaries
  `, [centreId, dates.currentMonthStr]);
  return hrRes.rows[0];
};

const fetchServiceAnalytics = async (client, centreId, dates) => {
  const [opsRes, aovRes] = await Promise.all([
    client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE st.status IN ('pending', 'Pending')) as pending_services,
        COUNT(*) FILTER (WHERE st.status = 'completed') as completed_services,
        COUNT(*) FILTER (WHERE st.status = 'in_progress') as in_progress_services,
        COUNT(*) FILTER (WHERE st.status = 'rejected') as delayed_services
      FROM service_tracking st 
      JOIN service_entries se ON st.service_entry_id = se.id 
      JOIN staff s ON se.staff_id = s.id 
      WHERE s.centre_id = $1
    `, [centreId]),
    // AOV correctly moved to operational analytics
    client.query(`
      SELECT COALESCE(AVG(se.total_charges), 0) as avg_order_value
      FROM service_entries se 
      JOIN staff s ON se.staff_id = s.id 
      WHERE s.centre_id = $1 AND se.status = 'completed' AND se.created_at::date = $2
    `, [centreId, dates.today])
  ]);
  
  return { ...opsRes.rows[0], avg_order_value: aovRes.rows[0].avg_order_value };
};

const fetchFinancialAnalytics = async (client, centreId, dates) => {
  const [todayRev, todayOpEx, monthlyRev, monthlyOpEx, periodRev, periodOpEx] = await Promise.all([
    
    // ✅ 1. Updated to use date ranges (fromDate and toDate)
    client.query(`
      SELECT 
        COALESCE(SUM(se.total_charges), 0) as revenue_collected,
        COALESCE(SUM(se.department_charges), 0) as department_charges,
        COALESCE(SUM(se.service_charges), 0) as gross_profit
      FROM service_entries se 
      JOIN staff s ON se.staff_id = s.id 
      WHERE s.centre_id = $1 AND se.created_at::date >= $2 AND se.created_at::date <= $3
    `, [centreId, dates.fromDate, dates.toDate]),
    
    // ✅ 2. Updated to use date ranges (fromDate and toDate)
    client.query(`
      SELECT COALESCE(SUM(amount), 0) as operating_expenses
      FROM expenses 
      WHERE centre_id = $1 AND expense_date >= $2 AND expense_date <= $3 
      AND status IN ('approved', 'auto_approved') 
      AND (is_reversal IS NULL OR is_reversal = FALSE)
    `, [centreId, dates.fromDate, dates.toDate]),
    
    // ✅ 3. Monthly Revenue
    client.query(`
      SELECT 
        EXTRACT(MONTH FROM se.created_at) as month_num,
        COALESCE(SUM(se.total_charges), 0) as revenue_collected,
        COALESCE(SUM(se.department_charges), 0) as department_charges,
        COALESCE(SUM(se.service_charges), 0) as gross_profit
      FROM service_entries se 
      JOIN staff s ON se.staff_id = s.id 
      WHERE s.centre_id = $1 AND EXTRACT(YEAR FROM se.created_at) = $2 AND se.status = 'completed'
      GROUP BY month_num
    `, [centreId, dates.currentYear]),
    
    // ✅ 4. Monthly Operating Expenses
    client.query(`
      SELECT 
        EXTRACT(MONTH FROM expense_date) as month_num,
        COALESCE(SUM(amount), 0) as operating_expenses
      FROM expenses 
      WHERE centre_id = $1 AND EXTRACT(YEAR FROM expense_date) = $2 
      AND status IN ('approved', 'auto_approved') 
      AND (is_reversal IS NULL OR is_reversal = FALSE)
      GROUP BY month_num
    `, [centreId, dates.currentYear]),

    // ✅ 5. NEW: Dynamic Period Revenue (Grouped by Exact Date)
    client.query(`
      SELECT 
        TO_CHAR(se.created_at, 'YYYY-MM-DD') as date_label,
        COALESCE(SUM(se.total_charges), 0) as revenue_collected,
        COALESCE(SUM(se.service_charges), 0) as gross_profit
      FROM service_entries se 
      JOIN staff s ON se.staff_id = s.id 
      WHERE s.centre_id = $1 AND se.created_at::date >= $2 AND se.created_at::date <= $3 AND se.status = 'completed'
      GROUP BY date_label
    `, [centreId, dates.fromDate, dates.toDate]),
    
    // ✅ 6. NEW: Dynamic Period Expenses (Grouped by Exact Date)
    client.query(`
      SELECT 
        TO_CHAR(expense_date, 'YYYY-MM-DD') as date_label,
        COALESCE(SUM(amount), 0) as operating_expenses
      FROM expenses 
      WHERE centre_id = $1 AND expense_date >= $2 AND expense_date <= $3 
      AND status IN ('approved', 'auto_approved') 
      AND (is_reversal IS NULL OR is_reversal = FALSE)
      GROUP BY date_label
    `, [centreId, dates.fromDate, dates.toDate])
  ]);

  return {
    todayRev: todayRev.rows[0],
    todayOpEx: todayOpEx.rows[0],
    monthlyRev: monthlyRev.rows,
    monthlyOpEx: monthlyOpEx.rows,
    periodRev: periodRev.rows,
    periodOpEx: periodOpEx.rows
  };
};

const fetchWalletAnalytics = async (client, centreId) => {
  const walletRes = await client.query(`
    SELECT wallet_type, COALESCE(SUM(balance), 0) as total_balance 
    FROM wallets WHERE centre_id = $1 GROUP BY wallet_type
  `, [centreId]);
  return walletRes.rows;
};

const fetchCustomerAnalytics = async (client, centreId, dates) => {
  const reviewsRes = await client.query(`
    SELECT COUNT(*) as review_count, COALESCE(AVG(staff_rating), 0) as avg_rating
    FROM service_reviews sr JOIN staff s ON sr.staff_id = s.id
    WHERE s.centre_id = $1 AND sr.is_submitted = true AND sr.submitted_at::date >= $2
  `, [centreId, dates.firstDayOfMonth]);
  return reviewsRes.rows[0];
};

const fetchActivityAnalytics = async (client, centreId, dates) => {
  const [pendingPaymentRes, transactionsRes, closingRes] = await Promise.all([
    client.query(`
      SELECT 
        COUNT(se.id) as count, 
        COALESCE(SUM(se.total_charges - COALESCE(p.paid_amount, 0)), 0) as total_pending
      FROM service_entries se
      JOIN staff s ON se.staff_id = s.id
      LEFT JOIN (
          SELECT service_entry_id, SUM(amount) as paid_amount 
          FROM payments 
          WHERE status = 'received' AND (is_reversal IS NULL OR is_reversal = FALSE)
          GROUP BY service_entry_id
      ) p ON p.service_entry_id = se.id
      WHERE s.centre_id = $1 AND se.status != 'completed'
    `, [centreId]),
    client.query(`
      SELECT wt.category, wt.amount, wt.type as "transactionType", w.name as "walletName", wt.created_at
      FROM wallet_transactions wt JOIN wallets w ON wt.wallet_id = w.id
      WHERE w.centre_id = $1 AND (wt.is_reversal IS NULL OR wt.is_reversal = FALSE)
      ORDER BY wt.created_at DESC LIMIT 10
    `, [centreId]),
    client.query(`
      SELECT actual_cash, cash_variance FROM daily_accounting_closure 
      WHERE centre_id = $1 AND accounting_date = $2
    `, [centreId, dates.yesterday])
  ]);

  return {
    pendingPayments: pendingPaymentRes.rows[0],
    transactions: transactionsRes.rows, 
    closing: closingRes.rows[0] || null 
  };
};

// ✅ Service Revenue Fetcher
const fetchServiceRevenueAnalytics = async (client, centreId, dates) => {
  try {
    const res = await client.query(`
      SELECT 
        CASE 
          WHEN sub.name IS NOT NULL THEN srv.name || ' - ' || sub.name
          ELSE COALESCE(srv.name, 'Uncategorized Service')
        END as service_name,
        COUNT(se.id) as total_requests,
        COALESCE(SUM(se.total_charges), 0) as revenue_collected,
        COALESCE(SUM(se.department_charges), 0) as department_charges,
        COALESCE(SUM(se.service_charges), 0) as gross_profit
      FROM service_entries se 
      JOIN staff s ON se.staff_id = s.id 
      -- 👇 Join the services table (using category_id from entries)
      LEFT JOIN services srv ON se.category_id = srv.id 
      -- 👇 Join the subcategories table (using subcategory_id from entries)
      LEFT JOIN subcategories sub ON se.subcategory_id = sub.id 
      WHERE s.centre_id = $1 
        AND se.created_at::date >= $2 
        AND se.created_at::date <= $3 
        AND se.status = 'completed'
      GROUP BY srv.name, sub.name -- 👈 Group by both to keep them distinct
      ORDER BY revenue_collected DESC
    `, [centreId, dates.fromDate, dates.toDate]);
    
    return res.rows.map(row => ({
      service_name: row.service_name,
      total_requests: Number(row.total_requests),
      revenue_collected: Number(row.revenue_collected),
      department_charges: Number(row.department_charges),
      gross_profit: Number(row.gross_profit)
    }));
  } catch (error) {
    console.error("SQL Error in fetchServiceRevenueAnalytics:", error.message);
    throw error;
  }
};

// Expense Category Fetcher
const fetchExpenseAnalytics = async (client, centreId, dates) => {
  try {
    const res = await client.query(`
      SELECT 
        COALESCE(category, 'Uncategorized') as expense_category,
        COUNT(id) as total_transactions,
        COALESCE(SUM(amount), 0) as total_amount
      FROM expenses 
      WHERE centre_id = $1 
        AND expense_date >= $2 
        AND expense_date <= $3 
        AND status IN ('approved', 'auto_approved') 
        AND (is_reversal IS NULL OR is_reversal = FALSE)
      GROUP BY category
      ORDER BY total_amount DESC
    `, [centreId, dates.fromDate, dates.toDate]);
    
    return res.rows.map(row => ({
      category: row.expense_category,
      transactions: Number(row.total_transactions),
      amount: Number(row.total_amount)
    }));
  } catch (error) {
    console.error("SQL Error in fetchExpenseAnalytics:", error.message);
    throw error;
  }
};

// Expenses grouped by Wallet
const fetchExpenseByWalletAnalytics = async (client, centreId, dates) => {
  try {
    const res = await client.query(`
      SELECT 
        COALESCE(w.name, 'Cash / Uncategorized') as wallet_name,
        COALESCE(SUM(e.amount), 0) as total_amount
      FROM expenses e
      LEFT JOIN wallets w ON e.wallet_id = w.id
      WHERE e.centre_id = $1 
        AND e.expense_date >= $2 
        AND e.expense_date <= $3 
        AND e.status IN ('approved', 'auto_approved') 
        AND (e.is_reversal IS NULL OR e.is_reversal = FALSE)
      GROUP BY w.name
      ORDER BY total_amount DESC
    `, [centreId, dates.fromDate, dates.toDate]);
    
    return res.rows.map(row => ({
      wallet_name: row.wallet_name,
      amount: Number(row.total_amount)
    }));
  } catch (error) {
    // If your expenses table doesn't have a wallet_id, this catches it safely!
    console.error("SQL Error in fetchExpenseByWalletAnalytics:", error.message);
    return []; 
  }
};

// ✅ Wallet Summary Fetcher
const fetchWalletSummaryAnalytics = async (client, centreId, dates) => {
  try {
    const res = await client.query(`
      WITH period_summary AS (
        SELECT
          wallet_id,
          MIN(date) AS first_date,
          MAX(date) AS last_date,
          SUM(total_credit) AS total_credit,
          SUM(total_debit) AS total_debit
        FROM wallet_daily_balances
        WHERE date >= $2 AND date <= $3
        GROUP BY wallet_id
      )
      SELECT
        w.id AS wallet_id,
        w.name AS wallet_name,
        w.wallet_type,
        d_first.opening_balance AS opening_balance,
        p.total_credit,
        p.total_debit,
        d_last.closing_balance AS closing_balance
      FROM period_summary p
      JOIN wallets w ON w.id = p.wallet_id
      JOIN wallet_daily_balances d_first 
        ON d_first.wallet_id = p.wallet_id AND d_first.date = p.first_date
      JOIN wallet_daily_balances d_last 
        ON d_last.wallet_id = p.wallet_id AND d_last.date = p.last_date
      WHERE w.centre_id = $1
      ORDER BY w.name ASC
    `, [centreId, dates.fromDate, dates.toDate]);
    
    // Map the database rows to the keys the React frontend expects
    return res.rows.map(row => ({
      wallet_name: row.wallet_name || 'Unknown Wallet',
      opening_balance: Number(row.opening_balance || 0),
      credit: Number(row.total_credit || 0), // 👈 Mapped exactly to your DB column
      debit: Number(row.total_debit || 0),   // 👈 Mapped exactly to your DB column
      closing_balance: Number(row.closing_balance || 0)
    }));
  } catch (error) {
    console.error("SQL Error in fetchWalletSummaryAnalytics:", error.message);
    throw error;
  }
};

// ==========================================
// LAYER 2: CALCULATE LAYER (FINANCIAL MATH)
// ==========================================

const calculateFinancialMetrics = (raw) => {
  const today = {
    revenueCollected: Number(raw.todayRev.revenue_collected),
    departmentCharges: Number(raw.todayRev.department_charges),
    grossProfit: Number(raw.todayRev.gross_profit),
    operatingExpenses: Number(raw.todayOpEx.operating_expenses),
  };
  today.netProfit = today.grossProfit - today.operatingExpenses;

  const monthly = {
    revenueCollected: new Array(12).fill(0),
    departmentCharges: new Array(12).fill(0), 
    grossProfit: new Array(12).fill(0),
    operatingExpenses: new Array(12).fill(0),
    netProfit: new Array(12).fill(0)
  };

  raw.monthlyRev.forEach(row => {
    const m = parseInt(row.month_num) - 1;
    monthly.revenueCollected[m] = Number(row.revenue_collected);
    monthly.departmentCharges[m] = Number(row.department_charges);
    monthly.grossProfit[m] = Number(row.gross_profit);
  });

  raw.monthlyOpEx.forEach(row => {
    const m = parseInt(row.month_num) - 1;
    monthly.operatingExpenses[m] = Number(row.operating_expenses);
  });

  for (let i = 0; i < 12; i++) {
    monthly.netProfit[i] = monthly.grossProfit[i] - monthly.operatingExpenses[i];
  }

  // --- NEW: Calculate Dynamic Period Trend ---
  const periodTrendMap = {};
  
  if (raw.periodRev) {
    raw.periodRev.forEach(r => {
      periodTrendMap[r.date_label] = { label: r.date_label, revenueCollected: Number(r.revenue_collected), grossProfit: Number(r.gross_profit), operatingExpenses: 0 };
    });
  }
  
  if (raw.periodOpEx) {
    raw.periodOpEx.forEach(r => {
      if (!periodTrendMap[r.date_label]) {
        periodTrendMap[r.date_label] = { label: r.date_label, revenueCollected: 0, grossProfit: 0, operatingExpenses: 0 };
      }
      periodTrendMap[r.date_label].operatingExpenses = Number(r.operating_expenses);
    });
  }

  const periodTrend = Object.values(periodTrendMap).map(day => {
    day.netProfit = day.grossProfit - day.operatingExpenses;
    return day;
  }).sort((a, b) => a.label.localeCompare(b.label)); 
  return { today, monthly, periodTrend }; 

  return { today, monthly };
};

// ==========================================
// LAYER 3: FORMATTING LAYER (FINANCIAL UI)
// ==========================================

const buildFinancialSummary = (metrics) => {
  return {
    summary: { today: metrics.today }, 
    monthlyTrend: {
      revenueCollected: metrics.monthly.revenueCollected,
      grossProfit: metrics.monthly.grossProfit,
      operatingExpenses: metrics.monthly.operatingExpenses,
      netProfit: metrics.monthly.netProfit
    },
    periodTrend: metrics.periodTrend // <--- Add this!
  };
};

// ==========================================
// LAYER 4: PRESENTATION LAYER (DASHBOARD BUILDERS)
// ==========================================

const buildDashboardStats = (analytics) => {
  const totalStaff = Number(analytics.staff.staff.total_staff);
  const presentToday = Number(analytics.staff.staff.present_today);

  let cashInHand = 0, bankBalance = 0, digitalBalance = 0, totalWalletBalance = 0;
  analytics.wallets.forEach(w => {
    const bal = Number(w.total_balance);
    totalWalletBalance += bal;
    if (w.wallet_type === 'cash') cashInHand += bal;
    else if (w.wallet_type === 'bank') bankBalance += bal;
    else digitalBalance += bal;
  });

  return {
    totalStaff,
    presentToday,
    attendanceRate: totalStaff > 0 ? Math.round((presentToday / totalStaff) * 100) : 0,
    pendingLeaves: Number(analytics.hr.pending_leaves),
    salaryPending: Number(analytics.hr.pending_salaries),
    
    pendingServices: Number(analytics.services.pending_services),
    servicesCompleted: Number(analytics.services.completed_services),
    averageOrderValue: Math.round(Number(analytics.services.avg_order_value)),
    
    todayRevenueCollected: analytics.financials.summary.today.revenueCollected,
    todayDepartmentCharges: analytics.financials.summary.today.departmentCharges,
    todayGrossProfit: analytics.financials.summary.today.grossProfit,
    todayOperatingExpenses: analytics.financials.summary.today.operatingExpenses,
    todayNetProfit: analytics.financials.summary.today.netProfit,
    
    pendingPayments: Number(analytics.activity.pendingPayments.count),
    pendingPaymentsTotal: Number(analytics.activity.pendingPayments.total_pending),
    
    cashInHand,
    bankBalance,
    digitalBalance,
    totalWalletBalance
  };
};

const buildDashboardCharts = (analytics) => ({
  attendanceTrend: analytics.staff.attendance,
  serviceStatus: {
    pending: Number(analytics.services.pending_services),
    completed: Number(analytics.services.completed_services),
    in_progress: Number(analytics.services.in_progress_services),
    delayed: Number(analytics.services.delayed_services)
  },
  financialTrend: analytics.financials.monthlyTrend 
});

const buildDashboardLists = (analytics) => ({
  topStaff: analytics.staff.performance,
  wallets: analytics.wallets,
  recentTransactions: analytics.activity.transactions.map(t => ({
    ...t,
    localTime: new Date(t.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }))
});

const buildDashboardAlerts = (analytics) => ({
  yesterdayClosing: analytics.activity.closing
});

const buildDashboardResponse = (analytics) => {
  return {
    stats: buildDashboardStats(analytics),
    customerSatisfaction: {
      count: Number(analytics.customer.review_count),
      rating: Number(analytics.customer.avg_rating).toFixed(1)
    },
    charts: buildDashboardCharts(analytics),
    lists: buildDashboardLists(analytics),
    alerts: buildDashboardAlerts(analytics)
  };
};

// ==========================================
// MAIN EXPORT
// ==========================================

export const getDashboardAnalytics = async (centreId) => {
  const dates = getDateContext();
  const client = await pool.connect();

  try {
    // 1. FETCH LAYER
    const [staff, hr, services, rawFinancials, wallets, customer, activity] = await Promise.all([
      fetchStaffAnalytics(client, centreId, dates),
      fetchHRAnalytics(client, centreId, dates),
      fetchServiceAnalytics(client, centreId, dates),
      fetchFinancialAnalytics(client, centreId, dates),
      fetchWalletAnalytics(client, centreId),
      fetchCustomerAnalytics(client, centreId, dates),
      fetchActivityAnalytics(client, centreId, dates)
    ]);

    // 2. CALCULATE LAYER
    const financialMetrics = calculateFinancialMetrics(rawFinancials);

    // 3. FORMAT LAYER
    const financials = buildFinancialSummary(financialMetrics);

    // 4. MASTER ANALYTICS OBJECT
    const analytics = {
      staff,
      hr,
      services,
      financials,
      wallets,
      customer,
      activity
    };

    // 5. PRESENTATION BUILDER
    return buildDashboardResponse(analytics);
    
    // Future builders can easily be added here:
    // return buildMobileResponse(analytics);
    // return buildReportsResponse(analytics);

  } catch (error) {
    console.error("Dashboard Data Aggregation Error:", error);
    throw error;
  } finally {
    client.release();
  }
};

// ==========================================
// REPORTS EXPORT ORCHESTRATOR
// ==========================================
export const getReportData = async (params) => {
  const { reportIds, targetCentreId, staffId, period, fromDate, toDate } = params;
  const client = await pool.connect();
  
  // ✅ FIX: Smart Date Calculator
  // 1. Establish the "To" Date (Default to today if missing/invalid)
  let end = new Date();
  if (toDate && !isNaN(new Date(toDate).getTime())) {
    end = new Date(toDate);
  }
  const finalToDate = end.toISOString().split('T')[0];

  // 2. Establish the "From" Date based on the 'period' string
  let start = new Date(end);
  if (fromDate && !isNaN(new Date(fromDate).getTime())) {
    start = new Date(fromDate);
  } else {
    // If no custom date was provided, calculate it using the period dropdown!
    switch(period) {
      case 'weekly':
        start.setDate(end.getDate() - 6); // Last 7 days
        break;
      case 'monthly':
        start.setDate(1); // 1st day of the current month
        break;
      case 'quarterly':
        start.setMonth(Math.floor(end.getMonth() / 3) * 3, 1); // 1st day of current quarter
        break;
      case 'yearly':
        start.setMonth(0, 1); // Jan 1st of current year
        break;
      case 'daily':
      default:
        // Keep it the same as the end date (Today)
        break;
    }
  }
  const finalFromDate = start.toISOString().split('T')[0];

  // Create a unified payload object to return
  const compiledReport = {
    metadata: {
      generatedAt: new Date().toISOString(),
      period,
      fromDate: finalFromDate, // Use the calculated dates!
      toDate: finalToDate,
      centreId: targetCentreId
    },
    data: {}
  };

  try {
    // 3. Build the 'dates' context object for the V3 Fetchers
    const baseDateObj = new Date(finalToDate);
    
    const yesterdayObj = new Date(baseDateObj);
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    
    const sevenDaysAgoObj = new Date(baseDateObj);
    sevenDaysAgoObj.setDate(sevenDaysAgoObj.getDate() - 6);

    const reportDates = {
      today: finalToDate, 
      fromDate: finalFromDate,  // <--- The V3 Engine will now use this!
      toDate: finalToDate,      // <--- The V3 Engine will now use this!
      yesterday: yesterdayObj.toISOString().split('T')[0],
      sevenDaysAgo: sevenDaysAgoObj.toISOString().split('T')[0],
      currentYear: baseDateObj.getFullYear(),
      currentMonthStr: finalToDate.substring(0, 7),
      firstDayOfMonth: `${finalToDate.substring(0, 7)}-01`
    };

    // 2. Map over requested reports and reuse V3 Fetchers
    let hasFetchedFinancials = false;

    for (const id of reportIds) {
      // Always fetch base financials so the top cards render
      if ([1, 2, 3, 4, 5, 15, 16, 17, 18].includes(id) && !hasFetchedFinancials) {
        const rawFinancials = await fetchFinancialAnalytics(client, targetCentreId, reportDates);
        compiledReport.data.financials = calculateFinancialMetrics(rawFinancials);
        hasFetchedFinancials = true;
      }

      switch (id) {
        case 5: {
          compiledReport.data.walletSummary = await fetchWalletSummaryAnalytics(client, targetCentreId, reportDates);
          compiledReport.data.wallets = await fetchWalletAnalytics(client, targetCentreId);
          break;
        }
        case 1:
        case 2: {
          compiledReport.data.wallets = await fetchWalletAnalytics(client, targetCentreId);
          break;
        }
        case 9: {
          compiledReport.data.staff = await fetchStaffAnalytics(client, targetCentreId, reportDates);
          break;
        }
        case 3:
        case 15: {
          compiledReport.data.serviceRevenue = await fetchServiceRevenueAnalytics(client, targetCentreId, reportDates);
          break;
        }
        case 4: {
          compiledReport.data.expenseReport = await fetchExpenseAnalytics(client, targetCentreId, reportDates);
          compiledReport.data.expenseByWallet = await fetchExpenseByWalletAnalytics(client, targetCentreId, reportDates);
          compiledReport.data.wallets = await fetchWalletAnalytics(client, targetCentreId);
          break;
        }
        case 18: {
          compiledReport.data.serviceOps = await fetchServiceAnalytics(client, targetCentreId, reportDates);
          break;
        }
        default: {
          break;
        }
      }
    }

    return compiledReport;

  } catch (error) {
    console.error("Analytics Service - Report Fetch Error:", error);
    throw error;
  } finally {
    client.release();
  }
};