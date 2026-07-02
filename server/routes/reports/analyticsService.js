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

// ✅ Service Profit Fetcher (Ranked by Margins)
const fetchServiceProfitAnalytics = async (client, centreId, dates) => {
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
      LEFT JOIN services srv ON se.category_id = srv.id 
      LEFT JOIN subcategories sub ON se.subcategory_id = sub.id 
      WHERE s.centre_id = $1 
        AND se.created_at::date >= $2 
        AND se.created_at::date <= $3 
        AND se.status = 'completed'
      GROUP BY srv.name, sub.name
      ORDER BY gross_profit DESC -- 👈 The crucial difference: Sorted by Margin!
    `, [centreId, dates.fromDate, dates.toDate]);
    
    return res.rows.map(row => ({
      service_name: row.service_name,
      total_requests: Number(row.total_requests),
      revenue_collected: Number(row.revenue_collected),
      department_charges: Number(row.department_charges),
      gross_profit: Number(row.gross_profit)
    }));
  } catch (error) {
    console.error("SQL Error in fetchServiceProfitAnalytics:", error.message);
    throw error;
  }
};

// ✅ Pending Services Fetcher (Filters out 'completed', 'paid', and 'delivered')
const fetchPendingServicesAnalytics = async (client, centreId, dates) => {
  try {
    const res = await client.query(`
      SELECT 
        se.created_at as application_date,
        se.token_id,
        COALESCE(se.customer_name, 'Anonymous') as customer_name,
        se.phone,
        CASE 
          WHEN sub.name IS NOT NULL THEN srv.name || ' - ' || sub.name
          ELSE COALESCE(srv.name, 'Uncategorized Service')
        END as service_name,
        st.name as assigned_staff,
        strak.status
      FROM service_entries se
      JOIN service_tracking strak ON strak.service_entry_id = se.id 
      JOIN staff st ON se.staff_id = st.id
      LEFT JOIN services srv ON se.category_id = srv.id
      LEFT JOIN subcategories sub ON se.subcategory_id = sub.id
      WHERE st.centre_id = $1 
        -- 👇 CRITICAL FIX: Exclude ALL terminal statuses so finished bills drop off the list!
        AND LOWER(strak.status) NOT IN ('completed', 'paid', 'delivered')
        AND se.created_at::date >= $2 
        AND se.created_at::date <= $3
      ORDER BY se.created_at ASC 
    `, [centreId, dates.fromDate, dates.toDate]);

    return res.rows.map(row => {
      const applied = new Date(row.application_date);
      const today = new Date();
      const daysPending = Math.floor((today - applied) / (1000 * 60 * 60 * 24));

      return {
        date: applied.toISOString(),
        token_id: row.token_id || '-',
        customer_name: row.customer_name,
        phone: row.phone || 'N/A',
        service_name: row.service_name,
        assigned_staff: row.assigned_staff || 'Unassigned',
        status: row.status ? row.status.toLowerCase() : 'unknown',
        days_pending: daysPending
      };
    });
  } catch (error) {
    console.error("SQL Error in fetchPendingServicesAnalytics:", error.message);
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

// ✅ Cash Flow Fetcher (Daily Inflow vs Outflow)
const fetchCashFlowAnalytics = async (client, centreId, dates) => {
  try {
    const res = await client.query(`
      SELECT
        TO_CHAR(d.date, 'YYYY-MM-DD') as flow_date,
        SUM(d.total_credit) AS total_in,
        SUM(d.total_debit)  AS total_out
      FROM wallet_daily_balances d
      JOIN wallets w ON w.id = d.wallet_id
      WHERE d.date >= $2 AND d.date <= $3
        AND w.centre_id = $1
      GROUP BY d.date
      ORDER BY d.date ASC
    `, [centreId, dates.fromDate, dates.toDate]);

    return res.rows.map(row => ({
      date: row.flow_date,
      inflow: Number(row.total_in || 0),
      outflow: Number(row.total_out || 0),
      // Net flow is Inflow minus Outflow
      net_flow: Number(row.total_in || 0) - Number(row.total_out || 0) 
    }));
  } catch (error) {
    console.error("SQL Error in fetchCashFlowAnalytics:", error.message);
    throw error;
  }
};

// ✅ General Ledger Fetcher (Strict Audit Trail with Reversals)
const fetchLedgerAnalytics = async (client, centreId, dates) => {
  try {
    const res = await client.query(`
      SELECT 
        wt.created_at as transaction_date,
        w.name as wallet_name,
        wt.type as transaction_type,
        COALESCE(wt.category, 'Uncategorized') as category,
        wt.amount,
        wt.is_reversal -- 👈 We fetch this so the UI knows it's a correction!
      FROM wallet_transactions wt
      JOIN wallets w ON wt.wallet_id = w.id
      WHERE w.centre_id = $1
        AND wt.created_at::date >= $2 
        AND wt.created_at::date <= $3
        -- ❌ REMOVED the filter so Reversals can offset original mistakes!
      ORDER BY wt.created_at DESC
    `, [centreId, dates.fromDate, dates.toDate]);

    return res.rows.map(row => ({
      date: new Date(row.transaction_date).toISOString(),
      wallet: row.wallet_name || 'Unknown Wallet',
      type: row.transaction_type, 
      category: row.category,
      amount: Number(row.amount || 0),
      isReversal: row.is_reversal === true // 👈 Pass boolean to frontend
    }));
  } catch (error) {
    console.error("SQL Error in fetchLedgerAnalytics:", error.message);
    throw error;
  }
};

// ✅ NEW: Pending Collections Fetcher (Customer Balances)
const fetchPendingCollectionsAnalytics = async (client, centreId, dates) => {
  try {
    const res = await client.query(`
      SELECT 
        se.created_at,
        se.customer_name,
        se.phone,
        se.token_id,
        CASE 
          WHEN sub.name IS NOT NULL THEN srv.name || ' - ' || sub.name
          ELSE COALESCE(srv.name, 'Uncategorized Service')
        END as service_name,
        se.total_charges,
        COALESCE(p.paid_amount, 0) as paid_amount,
        (se.total_charges - COALESCE(p.paid_amount, 0)) as balance_due
      FROM service_entries se
      JOIN staff s ON se.staff_id = s.id
      LEFT JOIN services srv ON se.category_id = srv.id
      LEFT JOIN subcategories sub ON se.subcategory_id = sub.id
      -- 👇 Calculate how much has been paid towards this specific service
      LEFT JOIN (
        SELECT service_entry_id, SUM(amount) as paid_amount 
        FROM payments 
        WHERE status = 'received' AND (is_reversal IS NULL OR is_reversal = FALSE)
        GROUP BY service_entry_id
      ) p ON p.service_entry_id = se.id
      WHERE s.centre_id = $1 
        AND se.created_at::date >= $2 
        AND se.created_at::date <= $3
        -- 👇 Only show entries where they still owe money
        AND (se.total_charges - COALESCE(p.paid_amount, 0)) > 0
      ORDER BY balance_due DESC, se.created_at DESC
    `, [centreId, dates.fromDate, dates.toDate]);

    return res.rows.map(row => ({
      date: new Date(row.created_at).toISOString(),
      customer_name: row.customer_name || 'Walk-in Customer',
      phone: row.phone || 'N/A',
      token_id: row.token_id || '-',
      service_name: row.service_name,
      total_charges: Number(row.total_charges || 0),
      paid_amount: Number(row.paid_amount || 0),
      balance_due: Number(row.balance_due || 0)
    }));
  } catch (error) {
    console.error("SQL Error in fetchPendingCollectionsAnalytics:", error.message);
    throw error;
  }
};

const fetchDetailedAttendanceAnalytics = async (client, centreId, dates) => {
  try {
    console.log(`[API] Fetching Attendance for Centre ${centreId} from ${dates.fromDate} to ${dates.toDate}`);
    
    const res = await client.query(`
      SELECT 
        a.date,
        s.id as staff_id,
        s.name as staff_name,
        COALESCE(s.role, 'staff') as role,
        MAX(a.status) as status, 
        MIN(a.punch_in) as punch_in,   
        MAX(a.punch_out) as punch_out, 
        MAX(COALESCE(a.late_minutes, 0)) as late_minutes,
        SUM(COALESCE(a.hours, 0)) as total_hours 
      FROM attendance a
      JOIN staff s ON a.staff_id = s.id
      WHERE s.centre_id = $1
        AND a.date::date >= $2 
        AND a.date::date <= $3
      GROUP BY a.date, s.id, s.name, s.role 
      ORDER BY a.date DESC, s.name ASC
    `, [centreId, dates.fromDate, dates.toDate]);

    console.log(`[API] Found ${res.rows.length} Aggregated Attendance records in DB.`);

    return res.rows.map(row => ({
      date: new Date(row.date).toISOString().split('T')[0],
      staff_name: row.staff_name || 'Unknown',
      role: row.role,
      status: row.status ? row.status.toLowerCase() : 'unknown',
      check_in: row.punch_in ? row.punch_in.substring(0, 5) : '-', 
      check_out: row.punch_out ? row.punch_out.substring(0, 5) : '-',
      late_minutes: Number(row.late_minutes),
      total_hours: Number(row.total_hours).toFixed(2) 
    }));
  } catch (error) {
    console.error("SQL Error in fetchDetailedAttendanceAnalytics:", error.message);
    throw error; 
  }
};

// ✅ NEW: Staff Performance Fetcher (Revenue & Productivity)
const fetchPerformanceAnalytics = async (client, centreId, dates) => {
  try {
    const res = await client.query(`
      SELECT 
        s.id as staff_id,
        s.name as staff_name,
        COALESCE(s.role, 'staff') as role,
        COUNT(se.id) as total_services,
        COALESCE(SUM(se.total_charges), 0) as total_revenue,
        COALESCE(SUM(se.service_charges), 0) as gross_profit
      FROM staff s
      -- 👇 Join services completed within the date range
      LEFT JOIN service_entries se ON s.id = se.staff_id 
        AND se.created_at::date >= $2 
        AND se.created_at::date <= $3
        AND se.status = 'completed'
      WHERE s.centre_id = $1 
        -- 👇 Include Active staff OR anyone who happened to complete a service
        AND (s.status = 'Active' OR se.id IS NOT NULL)
      GROUP BY s.id, s.name, s.role
      ORDER BY total_revenue DESC, total_services DESC
    `, [centreId, dates.fromDate, dates.toDate]);

    return res.rows.map(row => ({
      staff_name: row.staff_name,
      role: row.role,
      total_services: Number(row.total_services),
      total_revenue: Number(row.total_revenue),
      gross_profit: Number(row.gross_profit)
    }));
  } catch (error) {
    console.error("SQL Error in fetchPerformanceAnalytics:", error.message);
    throw error;
  }
};

// ✅ Salary Report Fetcher (Payroll Calculations)
const fetchSalaryAnalytics = async (client, centreId, dates) => {
  try {
    console.log(`[API] Fetching Salaries for Centre ${centreId} from ${dates.fromDate} to ${dates.toDate}`);
    
    const res = await client.query(`
      SELECT 
        s.id,
        st.name as staff_name,
        COALESCE(st.role, 'staff') as role,
        s.month,
        s.basic,
        s.hra,
        s.ta,
        s.other_allowances,
        s.deductions,
        s.net_salary,
        s.status,
        s.working_days,
        s.present_days
      FROM salaries s
      JOIN staff st ON s.staff_id = st.id
      WHERE st.centre_id = $1 
        -- 👇 Smartly match the YYYY-MM strings based on the selected date range
        AND s.month >= TO_CHAR($2::date, 'YYYY-MM')
        AND s.month <= TO_CHAR($3::date, 'YYYY-MM')
      ORDER BY s.month DESC, s.net_salary DESC
    `, [centreId, dates.fromDate, dates.toDate]);

    return res.rows.map(row => ({
      staff_name: row.staff_name,
      role: row.role,
      month: row.month,
      basic: Number(row.basic || 0),
      // Group all allowances together for cleaner reporting
      total_allowances: Number(row.hra || 0) + Number(row.ta || 0) + Number(row.other_allowances || 0),
      deductions: Number(row.deductions || 0),
      net_salary: Number(row.net_salary || 0),
      status: row.status.toLowerCase(), // 'pending' or 'sent'
      working_days: Number(row.working_days || 0),
      present_days: Number(row.present_days || 0)
    }));
  } catch (error) {
    console.error("SQL Error in fetchSalaryAnalytics:", error.message);
    throw error;
  }
};

// ✅ Incentive Report Fetcher (Staff KPI & Bonus Calculator)
const fetchIncentiveAnalytics = async (client, centreId, dates) => {
  try {
    const res = await client.query(`
      WITH service_agg AS (
        SELECT
          se.staff_id,
          COUNT(se.id) AS services_completed,
          COUNT(DISTINCT se.created_at::date) AS active_days,
          SUM(se.total_charges) AS expected_amount,
          SUM(se.service_charges) AS service_charge_earned,
          ROUND(SUM(se.total_charges)::numeric / NULLIF(COUNT(DISTINCT se.created_at::date), 0), 2) AS revenue_per_day,
          MAX(ROUND(SUM(se.total_charges)::numeric / NULLIF(COUNT(DISTINCT se.created_at::date), 0), 2)) OVER () AS max_revenue_per_day
        FROM service_entries se
        WHERE se.created_at::date >= $2 AND se.created_at::date <= $3
        GROUP BY se.staff_id
      ),
      payment_agg AS (
        SELECT
          se.staff_id,
          SUM(p.amount) FILTER (WHERE p.status = 'received') AS collected_amount
        FROM payments p
        JOIN service_entries se ON se.id = p.service_entry_id
        WHERE p.created_at::date >= $2 AND p.created_at::date <= $3
          AND COALESCE(p.is_reversal, FALSE) = FALSE
          AND NOT EXISTS (
            SELECT 1 FROM wallet_transactions wt 
            WHERE wt.reference_payment_id = p.id AND COALESCE(wt.is_reversal, FALSE) = TRUE
          )
        GROUP BY se.staff_id
      ),
      review_agg AS (
        SELECT
          sr.staff_id,
          COUNT(sr.id) AS total_reviews,
          ROUND(AVG(sr.staff_rating)::numeric, 2) AS avg_staff_rating
        FROM service_reviews sr
        WHERE sr.is_submitted = true AND sr.staff_rating IS NOT NULL
        GROUP BY sr.staff_id
      )
      SELECT
        s.id AS staff_id,
        s.name AS staff_name,
        COALESCE(sa.services_completed, 0) AS services_completed,
        COALESCE(sa.active_days, 0) AS active_days,
        COALESCE(sa.service_charge_earned, 0) AS service_charge_earned,
        COALESCE(pa.collected_amount, 0) AS collected_amount,
        COALESCE(ra.total_reviews, 0) AS total_reviews,
        COALESCE(ra.avg_staff_rating, 0) AS avg_staff_rating,
        -- Calculate Incentive Score (0 to 100) exactly as in staffReports.js
        ROUND(
          (
            (COALESCE(pa.collected_amount, 0) / NULLIF(sa.expected_amount, 0)) * 50
            +
            (sa.revenue_per_day / NULLIF(sa.max_revenue_per_day, 0)) * 30
            +
            (sa.active_days / NULLIF(($3::date - $2::date + 1), 0)) * 20
          )::numeric, 0
        ) AS incentive_score
      FROM staff s
      LEFT JOIN service_agg sa ON sa.staff_id = s.id
      LEFT JOIN payment_agg pa ON pa.staff_id = s.id
      LEFT JOIN review_agg ra ON ra.staff_id = s.id
      WHERE s.role = 'staff' AND s.centre_id = $1
      ORDER BY incentive_score DESC NULLS LAST
    `, [centreId, dates.fromDate, dates.toDate]);

    return res.rows.map(row => {
      const score = Number(row.incentive_score || 0);
      const profit = Number(row.service_charge_earned || 0);
      
      // Dynamic Suggestion: 10% of their generated profit, scaled by their KPI score!
      const suggestedBonus = Math.round(profit * 0.10 * (score / 100));

      return {
        staff_name: row.staff_name,
        services_completed: Number(row.services_completed),
        collected_amount: Number(row.collected_amount),
        service_charge_earned: profit, // 👈 ADD THIS LINE!
        total_reviews: Number(row.total_reviews),
        avg_staff_rating: Number(row.avg_staff_rating),
        incentive_score: score,
        suggested_bonus: suggestedBonus
      };
    }).filter(r => r.services_completed > 0);
  } catch (error) {
    console.error("SQL Error in fetchIncentiveAnalytics:", error.message);
    throw error;
  }
};

// ✅ Review Report Fetcher (Smart Service Name Mapping)
const fetchReviewAnalytics = async (client, centreId, dates) => {
  try {
    const res = await client.query(`
      SELECT 
        sr.submitted_at,
        COALESCE(sr.customer_name, se.customer_name, 'Anonymous') as customer_name,
        COALESCE(sr.customer_phone, se.phone) as customer_phone,
        
        -- 👇 Smart mapping: Get exact Category + Subcategory from the original entry!
        COALESCE(
          CASE 
            WHEN sub.name IS NOT NULL THEN srv.name || ' - ' || sub.name
            ELSE srv.name
          END,
          direct_srv.name,
          'General Service'
        ) as service_name,
        
        st.name as staff_name,
        sr.service_rating,
        sr.staff_rating,
        sr.review_text
      FROM service_reviews sr
      LEFT JOIN staff st ON sr.staff_id = st.id
      
      -- 👇 Join the original service entry via tracking_id
      LEFT JOIN service_entries se ON sr.tracking_id = se.id
      LEFT JOIN services srv ON se.category_id = srv.id
      LEFT JOIN subcategories sub ON se.subcategory_id = sub.id
      
      -- 👇 Fallback in case it's a direct review without an entry
      LEFT JOIN services direct_srv ON sr.service_id = direct_srv.id
      
      WHERE sr.centre_id = $1 
        AND sr.is_submitted = true
        AND sr.submitted_at::date >= $2 
        AND sr.submitted_at::date <= $3
      ORDER BY sr.submitted_at DESC
    `, [centreId, dates.fromDate, dates.toDate]);

    return res.rows.map(row => ({
      date: new Date(row.submitted_at).toISOString(),
      customer_name: row.customer_name,
      phone: row.customer_phone || 'N/A',
      service_name: row.service_name, // 👈 Now pulls the perfectly formatted name!
      staff_name: row.staff_name || 'Unassigned',
      service_rating: Number(row.service_rating || 0),
      staff_rating: Number(row.staff_rating || 0),
      review_text: row.review_text || ''
    }));
  } catch (error) {
    console.error("SQL Error in fetchReviewAnalytics:", error.message);
    throw error;
  }
};

// ✅ Leave Report Fetcher (Staff Leave History)
const fetchLeaveAnalytics = async (client, centreId, dates) => {
  try {
    const res = await client.query(`
      SELECT 
        l.applied_date,
        s.name as staff_name,
        COALESCE(s.role, 'staff') as role,
        l.type as leave_type,
        l.from_date,
        l.to_date,
        l.reason,
        l.status
      FROM leaves l
      JOIN staff s ON l.staff_id = s.id
      WHERE s.centre_id = $1
        -- 👇 Overlap Logic: Leave starts before Period Ends, AND ends after Period Starts
        AND l.from_date <= $3::date 
        AND l.to_date >= $2::date
      ORDER BY l.from_date DESC
    `, [centreId, dates.fromDate, dates.toDate]);

    return res.rows.map(row => {
      // Calculate the number of days taken
      const start = new Date(row.from_date);
      const end = new Date(row.to_date);
      const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;

      return {
        applied_date: new Date(row.applied_date).toISOString(),
        staff_name: row.staff_name,
        role: row.role,
        leave_type: row.leave_type || 'General',
        from_date: start.toISOString(),
        to_date: end.toISOString(),
        days_taken: days > 0 ? days : 1,
        reason: row.reason || 'No reason provided',
        status: row.status.toLowerCase()
      };
    });
  } catch (error) {
    console.error("SQL Error in fetchLeaveAnalytics:", error.message);
    throw error;
  }
};

// ✅ NEW: Completed Services Fetcher (Tracks Turnaround Time)
const fetchCompletedServicesAnalytics = async (client, centreId, dates) => {
  try {
    const res = await client.query(`
      SELECT 
        se.created_at as application_date,
        strak.updated_at as completion_date,
        se.token_id,
        COALESCE(se.customer_name, 'Anonymous') as customer_name,
        se.phone,
        CASE 
          WHEN sub.name IS NOT NULL THEN srv.name || ' - ' || sub.name
          ELSE COALESCE(srv.name, 'Uncategorized Service')
        END as service_name,
        st.name as assigned_staff,
        strak.status
      FROM service_entries se
      JOIN service_tracking strak ON strak.service_entry_id = se.id 
      JOIN staff st ON se.staff_id = st.id
      LEFT JOIN services srv ON se.category_id = srv.id
      LEFT JOIN subcategories sub ON se.subcategory_id = sub.id
      WHERE st.centre_id = $1 
        -- 👇 Look ONLY for terminal operational statuses!
        AND LOWER(strak.status) IN ('completed', 'paid', 'delivered')
        AND se.created_at::date >= $2 
        AND se.created_at::date <= $3
      ORDER BY strak.updated_at DESC, se.created_at DESC 
    `, [centreId, dates.fromDate, dates.toDate]);

    return res.rows.map(row => {
      // Calculate Turnaround Time (TAT) in days
      const applied = new Date(row.application_date);
      const completed = row.completion_date ? new Date(row.completion_date) : new Date();
      const daysTaken = Math.max(0, Math.ceil((completed - applied) / (1000 * 60 * 60 * 24)));

      return {
        application_date: applied.toISOString(),
        completion_date: completed.toISOString(),
        token_id: row.token_id || '-',
        customer_name: row.customer_name,
        phone: row.phone || 'N/A',
        service_name: row.service_name,
        assigned_staff: row.assigned_staff || 'Unassigned',
        status: row.status ? row.status.toLowerCase() : 'completed',
        days_taken: daysTaken
      };
    });
  } catch (error) {
    console.error("SQL Error in fetchCompletedServicesAnalytics:", error.message);
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
      if ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].includes(id) && !hasFetchedFinancials) {
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
        case 6: {
          compiledReport.data.cashFlow = await fetchCashFlowAnalytics(client, targetCentreId, reportDates);
          break;
        }
        case 1:
        case 2: {
          compiledReport.data.wallets = await fetchWalletAnalytics(client, targetCentreId);
          break;
        }
        // ID 7: General Ledger Report
        case 7: {
          compiledReport.data.ledger = await fetchLedgerAnalytics(client, targetCentreId, reportDates);
          break;
        }
        // ID 8: Pending Collections
        case 8: {
          compiledReport.data.pendingCollections = await fetchPendingCollectionsAnalytics(client, targetCentreId, reportDates);
          break;
        }
        case 9: {
          // High-level stats for the Top Cards
          compiledReport.data.staff = await fetchStaffAnalytics(client, targetCentreId, reportDates);
          // Detailed list for the Table & Charts
          compiledReport.data.attendanceReport = await fetchDetailedAttendanceAnalytics(client, targetCentreId, reportDates);
          break;
        }
        case 10: {
          compiledReport.data.staff = await fetchStaffAnalytics(client, targetCentreId, reportDates);
          compiledReport.data.performanceReport = await fetchPerformanceAnalytics(client, targetCentreId, reportDates);
          break;
        }
        // ID 11: Salary Report
        case 11: {
          compiledReport.data.salaryReport = await fetchSalaryAnalytics(client, targetCentreId, reportDates);
          break;
        }
        case 12: {
          compiledReport.data.incentiveReport = await fetchIncentiveAnalytics(client, targetCentreId, reportDates);
          break;
        }
        // ID 13: Review Report
        case 13: {
          compiledReport.data.reviewReport = await fetchReviewAnalytics(client, targetCentreId, reportDates);
          break;
        }
        // ID 14: Leave Report
        case 14: {
          compiledReport.data.leaveReport = await fetchLeaveAnalytics(client, targetCentreId, reportDates);
          break;
        }
        case 3:
        case 15: {
          compiledReport.data.serviceRevenue = await fetchServiceRevenueAnalytics(client, targetCentreId, reportDates);
          break;
        }
        case 16: {
          compiledReport.data.serviceProfit = await fetchServiceProfitAnalytics(client, targetCentreId, reportDates);
          break;
        }
        case 4: {
          compiledReport.data.expenseReport = await fetchExpenseAnalytics(client, targetCentreId, reportDates);
          compiledReport.data.expenseByWallet = await fetchExpenseByWalletAnalytics(client, targetCentreId, reportDates);
          compiledReport.data.wallets = await fetchWalletAnalytics(client, targetCentreId);
          break;
        }
        case 17: {
          compiledReport.data.pendingServices = await fetchPendingServicesAnalytics(client, targetCentreId, reportDates);
          break;
        }
        // ID 18: Completed Services Report
        case 18: {
          compiledReport.data.serviceOps = await fetchServiceAnalytics(client, targetCentreId, reportDates);
          compiledReport.data.completedServicesReport = await fetchCompletedServicesAnalytics(client, targetCentreId, reportDates);
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