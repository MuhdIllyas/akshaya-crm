// analyticsService.js
import pool from "../../db.js";

export const getAdminDashboardData = async (centreId) => {
  const today = new Date().toISOString().split('T')[0];
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().split('T')[0];
  const currentMonthStr = today.substring(0, 7); // YYYY-MM
  const firstDayOfMonth = `${currentMonthStr}-01`;
  const sevenDaysAgoDate = new Date();
  sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 6);
  const sevenDaysAgo = sevenDaysAgoDate.toISOString().split('T')[0];

  const client = await pool.connect();

  try {
    const [
      staffRes,
      attendanceRes,
      hrRes,
      serviceOpsRes,         // Tracks operational pipeline
      serviceFinanceRes,     // Tracks actual profit & margins
      financeTodayRes,
      walletRes,
      pendingPaymentRes,
      dailyChartRes,
      monthlyChartRes,
      staffPerfRes,
      reviewsRes,
      transactionsRes,
      closingRes
    ] = await Promise.all([
      // 1. Staff & Today's Attendance count
      client.query(`
        SELECT 
          (SELECT COUNT(*) FROM staff WHERE centre_id = $1 AND status = 'Active') as total_staff,
          (SELECT COUNT(*) FROM attendance a JOIN staff s ON a.staff_id = s.id WHERE s.centre_id = $1 AND a.date = $2 AND a.status = 'present') as present_today
      `, [centreId, today]),

      // 2. Attendance Trend (Last 7 Days)
      client.query(`
        SELECT TO_CHAR(a.date, 'Dy') as day, 
               COUNT(*) FILTER (WHERE a.status = 'present') as present,
               COUNT(*) FILTER (WHERE a.late_minutes > 0) as late
        FROM attendance a JOIN staff s ON a.staff_id = s.id 
        WHERE s.centre_id = $1 AND a.date >= $2
        GROUP BY a.date ORDER BY a.date ASC
      `, [centreId, sevenDaysAgo]),

      // 3. HR Pending Actions
      client.query(`
        SELECT 
          (SELECT COUNT(*) FROM leaves l JOIN staff s ON l.staff_id = s.id WHERE s.centre_id = $1 AND l.status = 'pending') as pending_leaves,
          (SELECT COUNT(*) FROM salaries sal JOIN staff s ON sal.staff_id = s.id WHERE s.centre_id = $1 AND sal.month = $2 AND sal.status = 'pending') as pending_salaries
      `, [centreId, currentMonthStr]),

      // 4. Service Operations (From tracking table)
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

      // 4b. Service Financials (DIRECTLY from service_entries - fixes the 0 charge bug)
      client.query(`
        SELECT 
          COALESCE(AVG(se.total_charges) FILTER (WHERE se.status = 'completed' AND se.created_at::date = $2), 0) as avg_order_value,
          COALESCE(SUM(se.service_charges) FILTER (WHERE se.created_at::date = $2), 0) as today_service_charge
        FROM service_entries se 
        JOIN staff s ON se.staff_id = s.id 
        WHERE s.centre_id = $1
      `, [centreId, today]),

      // 5. Today's Financial Summary
      client.query(`
      SELECT
        COALESCE(
            (
                SELECT SUM(wt.amount)
                FROM wallet_transactions wt
                JOIN wallets w ON w.id = wt.wallet_id
                WHERE w.centre_id = $1
                  AND wt.created_at::date = $2
                  AND wt.type = 'credit'
                  AND wt.category <> 'Transfer'
                  AND COALESCE(wt.is_reversal,FALSE)=FALSE
            ),
            0
        ) AS today_revenue,

        COALESCE(
            (
                SELECT SUM(e.amount)
                FROM expenses e
                WHERE e.centre_id = $1
                  AND e.expense_date = $2
                  AND e.status IN ('approved','auto_approved')
                  AND COALESCE(e.is_reversal,FALSE)=FALSE
            ),
            0
        ) AS today_expenses
      `, [centreId, today]),

      // 6. Live Wallet Balances
      client.query(`
        SELECT wallet_type, COALESCE(SUM(balance), 0) as total_balance 
        FROM wallets WHERE centre_id = $1 GROUP BY wallet_type
      `, [centreId]),

      // 7. Pending Payments (Using the exact schema rules you provided)
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

      // 8. Daily Revenue Chart (Last 7 days)
      client.query(`
        SELECT TO_CHAR(d.date, 'Mon DD') as label, COALESCE(SUM(d.total_credit), 0) as revenue
        FROM wallet_daily_balances d JOIN wallets w ON d.wallet_id = w.id
        WHERE w.centre_id = $1 AND d.date >= $2
        GROUP BY d.date ORDER BY d.date ASC
      `, [centreId, sevenDaysAgo]),

      // 9. Monthly Revenue Chart (Current Year)
      client.query(`
        SELECT
          m.month,

          COALESCE((
              SELECT SUM(wdb.total_credit)
              FROM wallet_daily_balances wdb
              JOIN wallets w
                  ON w.id = wdb.wallet_id
              WHERE w.centre_id = $1
                AND EXTRACT(MONTH FROM wdb.date)=m.month
                AND EXTRACT(YEAR FROM wdb.date)=EXTRACT(YEAR FROM CURRENT_DATE)
          ),0) AS revenue,

          COALESCE((
              SELECT SUM(e.amount)
              FROM expenses e
              WHERE e.centre_id = $1
                AND e.status IN ('approved','auto_approved')
                AND COALESCE(e.is_reversal,FALSE)=FALSE
                AND EXTRACT(MONTH FROM e.expense_date)=m.month
                AND EXTRACT(YEAR FROM e.expense_date)=EXTRACT(YEAR FROM CURRENT_DATE)
          ),0) AS expenses

      FROM generate_series(1,12) AS m(month)
      ORDER BY m.month
        
      `, [centreId]),

      // 10. Staff Leaderboard (This Month)
      client.query(`
        SELECT s.name as staff_name, COUNT(se.id) as service_count, COALESCE(SUM(se.service_charges), 0) as total_revenue
        FROM staff s 
        LEFT JOIN service_entries se ON s.id = se.staff_id AND se.created_at::date >= $2
        WHERE s.centre_id = $1 AND s.role = 'staff'
        GROUP BY s.id, s.name ORDER BY total_revenue DESC LIMIT 5
      `, [centreId, firstDayOfMonth]),

      // 11. Review Stats (This Month)
      client.query(`
        SELECT COUNT(*) as review_count, COALESCE(AVG(staff_rating), 0) as avg_rating
        FROM service_reviews sr JOIN staff s ON sr.staff_id = s.id
        WHERE s.centre_id = $1 AND sr.is_submitted = true AND sr.submitted_at::date >= $2
      `, [centreId, firstDayOfMonth]),

      // 12. Recent Transactions (Last 10)
      client.query(`
        SELECT wt.category, wt.amount, wt.type as "transactionType", w.name as "walletName", wt.created_at
        FROM wallet_transactions wt JOIN wallets w ON wt.wallet_id = w.id
        WHERE w.centre_id = $1 AND (wt.is_reversal IS NULL OR wt.is_reversal = FALSE)
        ORDER BY wt.created_at DESC LIMIT 10
      `, [centreId]),

      // 13. Yesterday's Nightly Close Variance
      client.query(`
        SELECT actual_cash, cash_variance FROM daily_accounting_closure 
        WHERE centre_id = $1 AND accounting_date = $2
      `, [centreId, yesterday])
    ]);

    // Format Wallet Data
    let cashInHand = 0, bankBalance = 0, digitalBalance = 0, totalWalletBalance = 0;
    walletRes.rows.forEach(w => {
      const bal = Number(w.total_balance);
      totalWalletBalance += bal;
      if (w.wallet_type === 'cash') cashInHand += bal;
      else if (w.wallet_type === 'bank') bankBalance += bal;
      else digitalBalance += bal;
    });

    // Format Monthly Chart Array
    const monthlyRevenue = new Array(12).fill(0);
    const monthlyExpenses = new Array(12).fill(0);

    monthlyChartRes.rows.forEach(r => {
        const month = Number(r.month);

        monthlyRevenue[month - 1] = Number(r.revenue);
        monthlyExpenses[month - 1] = Number(r.expenses);
    });

    const totalStaff = Number(staffRes.rows[0].total_staff);
    const presentToday = Number(staffRes.rows[0].present_today);
    const todayRevenue = Number(financeTodayRes.rows[0].today_revenue);
    const todayExpenses = Number(financeTodayRes.rows[0].today_expenses);

    return {
      stats: {
        totalStaff,
        presentToday,
        attendanceRate: totalStaff > 0 ? Math.round((presentToday / totalStaff) * 100) : 0,
        pendingLeaves: Number(hrRes.rows[0].pending_leaves),
        salaryPending: Number(hrRes.rows[0].pending_salaries),
        
        pendingServices: Number(serviceOpsRes.rows[0].pending_services),
        servicesCompleted: Number(serviceOpsRes.rows[0].completed_services),
        
        // Data pulled safely from service_entries
        averageOrderValue: Math.round(Number(serviceFinanceRes.rows[0].avg_order_value)),
        todayServiceCharge: Number(serviceFinanceRes.rows[0].today_service_charge),
        
        todayRevenue,
        todayExpenses,
        todayProfit: todayRevenue - todayExpenses,
        monthlyRevenue: monthlyRevenue[new Date().getMonth()],
        monthlyExpenses: monthlyExpenses[new Date().getMonth()],
        
        // Pending payments safely using se.status and p.status = 'received'
        pendingPayments: Number(pendingPaymentRes.rows[0].count),
        pendingPaymentsTotal: Number(pendingPaymentRes.rows[0].total_pending),
        
        cashInHand,
        bankBalance,
        digitalBalance,
        totalWalletBalance
      },
      customerSatisfaction: {
        count: Number(reviewsRes.rows[0].review_count),
        rating: Number(reviewsRes.rows[0].avg_rating).toFixed(1)
      },
      charts: {
        attendanceTrend: attendanceRes.rows,
        serviceStatus: serviceOpsRes.rows[0],
        dailyRevenue: {
          labels: dailyChartRes.rows.map(r => r.label),
          data: dailyChartRes.rows.map(r => Number(r.revenue))
        },
        monthlyRevenue: monthlyRevenue,
        monthlyExpenses: monthlyExpenses
      },
      lists: {
        topStaff: staffPerfRes.rows,
        recentTransactions: transactionsRes.rows.map(t => ({
          ...t,
          localTime: new Date(t.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        }))
      },
      alerts: {
        yesterdayClosing: closingRes.rows.length > 0 ? closingRes.rows[0] : null
      }
    };
  } catch (error) {
    console.error("Dashboard Data Aggregation Error:", error);
    throw error;
  } finally {
    client.release();
  }
};
