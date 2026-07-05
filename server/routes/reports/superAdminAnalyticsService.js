import pool from "../../db.js";

/**
 * UTILS
 * Standardizes date filters for all SQL queries.
 */
function getDateContext(filters = {}) {
    const { timeframe = 'today', customStartDate, customEndDate } = filters;
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    switch (timeframe) {
        case 'today':
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'yesterday':
            startDate.setDate(now.getDate() - 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'last7days':
            startDate.setDate(now.getDate() - 7);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'last30days':
            startDate.setDate(now.getDate() - 30);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
        case 'previousMonth':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
            break;
        case 'financialYear':
            const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
            startDate = new Date(startYear, 3, 1); 
            endDate = new Date(startYear + 1, 2, 31, 23, 59, 59, 999); 
            break;
        case 'allTime':
            startDate = new Date(2000, 0, 1);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'custom':
            if (!customStartDate || !customEndDate) throw new Error("Missing custom dates");
            startDate = new Date(customStartDate);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(customEndDate);
            endDate.setHours(23, 59, 59, 999);
            break;
        default:
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
    }

    return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
}

/**
 * EXPORT
 */
export const getSuperAdminDashboard = async (filters = {}) => {
    let modules = ['stats'];
    if (filters.modules) {
        modules = Array.isArray(filters.modules) ? filters.modules : filters.modules.split(',');
    }

    const dates = getDateContext(filters);
    const client = await pool.connect();
    
    const data = {};
    const tasks = [];

    try {
        if (modules.includes('stats')) tasks.push(fetchOrganisationStats(client, dates).then(r => data.stats = r));
        if (modules.includes('financials')) tasks.push(fetchFinancialOverview(client, dates).then(r => data.financials = calculateFinancialMetrics(r)));
        if (modules.includes('wallets')) tasks.push(fetchWalletAnalytics(client, dates).then(r => data.wallets = r));
        if (modules.includes('leaderboards')) tasks.push(fetchCentreLeaderboard(client, dates).then(r => data.leaderboard = r));
        if (modules.includes('customers')) tasks.push(fetchCustomerAnalytics(client, dates).then(r => data.customers = r));
        if (modules.includes('staff')) tasks.push(fetchStaffAnalytics(client, dates).then(r => data.staff = r));
        if (modules.includes('teams')) tasks.push(fetchTeamAnalytics(client, dates).then(r => data.teams = r));
        if (modules.includes('health')) tasks.push(fetchHealthAnalytics(client, dates).then(r => data.health = r));
        if (modules.includes('activity')) tasks.push(fetchRecentActivities(client).then(r => data.activity = r));
        if (modules.includes('alerts')) tasks.push(fetchSystemAlerts(client).then(r => data.alerts = r));

        await Promise.all(tasks);
        return buildDashboard(data);

    } catch (error) {
        console.error("SuperAdmin Analytics Engine Error:", error);
        throw new Error("Failed to generate SuperAdmin dashboard data.");
    } finally {
        client.release();
    }
};

function buildDashboard(data) {
    return {
        generatedAt: new Date().toISOString(),
        executive: { 
            ...(data.stats && { stats: data.stats }), 
            ...(data.health && { health: data.health }),
            ...(data.alerts && { alerts: data.alerts }) 
        },
        finance: { 
            ...(data.financials && { financials: data.financials }), 
            ...(data.wallets && { wallets: data.wallets }) 
        },
        operations: { 
            ...(data.customers && { customers: data.customers }), 
            ...(data.staff && { staff: data.staff }), 
            ...(data.teams && { teams: data.teams }), 
            ...(data.activity && { activity: data.activity }) 
        },
        leaderboards: { 
            ...(data.leaderboard && { centres: data.leaderboard }) 
        }
    };
}

/**
 * ORGANISATION ENGINE
 */
async function fetchOrganisationStats(client, dates) {
    const { startDate, endDate } = dates;

    const [revenueResult, expenseResult, entityCountsResult, operationsResult] = await Promise.all([
        // 1. Revenue
        client.query(`
            SELECT 
                COALESCE(SUM(total_charges), 0) as total_revenue, 
                COALESCE(SUM(service_charges), 0) as gross_profit,
                COUNT(id) as total_services 
            FROM service_entries 
            WHERE status = 'completed' 
            AND created_at >= $1 AND created_at <= $2
        `, [startDate, endDate]),

        // 2. Expenses
        client.query(`
            SELECT COALESCE(SUM(amount), 0) as total_expenses 
            FROM expenses 
            WHERE status IN ('approved', 'auto_approved')
            AND (is_reversal IS NULL OR is_reversal = FALSE)
            AND expense_date >= $1 AND expense_date <= $2
        `, [startDate, endDate]),

        // 3. Global Entity Counts
        client.query(`
            SELECT 
                (SELECT COUNT(*) FROM centres WHERE status = 'active') as total_centres,
                (SELECT COUNT(*) FROM staff WHERE status = 'active') as total_staff,
                (SELECT COUNT(*) FROM customers) as total_customers
        `),

        // 4. Live Operations (FIXED: Now uses service_tracking perfectly matching Admin dashboard)
        client.query(`
            SELECT 
                COUNT(se.id) FILTER (WHERE LOWER(strak.status) IN ('pending')) as pending_services,
                COUNT(se.id) FILTER (WHERE LOWER(strak.status) IN ('processing', 'in_progress')) as in_progress_services,
                COUNT(se.id) FILTER (WHERE LOWER(strak.status) = 'rejected') as delayed_services,
                COUNT(se.id) FILTER (WHERE DATE(se.created_at) = CURRENT_DATE AND se.status = 'completed') as today_services,
                COALESCE(SUM(se.total_charges) FILTER (WHERE DATE(se.created_at) = CURRENT_DATE AND se.status = 'completed'), 0) as today_revenue
            FROM service_entries se
            LEFT JOIN service_tracking strak ON strak.service_entry_id = se.id
        `)
    ]);

    const revenue = parseFloat(revenueResult.rows[0].total_revenue) || 0;
    const grossProfit = parseFloat(revenueResult.rows[0].gross_profit) || 0;
    const expenses = parseFloat(expenseResult.rows[0].total_expenses) || 0;

    return {
        revenue,
        expenses,
        profit: grossProfit - expenses, 
        servicesCompleted: parseInt(revenueResult.rows[0].total_services, 10) || 0,
        totalCentres: parseInt(entityCountsResult.rows[0].total_centres, 10) || 0,
        totalStaff: parseInt(entityCountsResult.rows[0].total_staff, 10) || 0,
        totalCustomers: parseInt(entityCountsResult.rows[0].total_customers, 10) || 0,
        todayRevenue: parseFloat(operationsResult.rows[0].today_revenue) || 0,
        todayServices: parseInt(operationsResult.rows[0].today_services, 10) || 0,
        pendingServices: parseInt(operationsResult.rows[0].pending_services, 10) || 0,
        inProgressServices: parseInt(operationsResult.rows[0].in_progress_services, 10) || 0,
        delayedServices: parseInt(operationsResult.rows[0].delayed_services, 10) || 0 // <-- Added this for your UI!
    };
}

/**
 * FETCH LAYER: FINANCIAL ENGINE
 */
async function fetchFinancialOverview(client, dates) {
    const { startDate, endDate } = dates;
    const diffTime = Math.abs(new Date(endDate) - new Date(startDate));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const timeFormat = diffDays > 60 ? 'YYYY-MM' : 'YYYY-MM-DD';

    const [revenueBreakdownResult, expenseBreakdownResult, revenueTrendResult, expenseTrendResult] = await Promise.all([
        client.query(`
            SELECT sv.category_id, COALESCE(SUM(se.total_charges), 0) as total
            FROM service_entries se
            JOIN services sv ON se.category_id = sv.id
            WHERE se.status = 'completed'
            AND se.created_at >= $1 AND se.created_at <= $2
            GROUP BY sv.category_id
            ORDER BY total DESC
        `, [startDate, endDate]),

        // FIXED: Expenses Reversals and Auto Approved
        client.query(`
            SELECT category, COALESCE(SUM(amount), 0) as total
            FROM expenses
            WHERE status IN ('approved', 'auto_approved')
            AND (is_reversal IS NULL OR is_reversal = FALSE)
            AND expense_date >= $1 AND expense_date <= $2
            GROUP BY category
            ORDER BY total DESC
        `, [startDate, endDate]),

        // FIXED: Grabbing gross_profit (service_charges) alongside total_charges
        client.query(`
            SELECT 
                TO_CHAR(created_at, '${timeFormat}') as date_label, 
                COALESCE(SUM(total_charges), 0) as total_revenue,
                COALESCE(SUM(service_charges), 0) as gross_profit
            FROM service_entries
            WHERE status = 'completed'
            AND created_at >= $1 AND created_at <= $2
            GROUP BY TO_CHAR(created_at, '${timeFormat}')
            ORDER BY date_label ASC
        `, [startDate, endDate]),

        // FIXED: Expenses Reversals and Auto Approved
        client.query(`
            SELECT TO_CHAR(expense_date, '${timeFormat}') as date_label, COALESCE(SUM(amount), 0) as total
            FROM expenses
            WHERE status IN ('approved', 'auto_approved')
            AND (is_reversal IS NULL OR is_reversal = FALSE)
            AND expense_date >= $1 AND expense_date <= $2
            GROUP BY TO_CHAR(expense_date, '${timeFormat}')
            ORDER BY date_label ASC
        `, [startDate, endDate])
    ]);

    return {
        revenueBreakdown: revenueBreakdownResult.rows,
        expenseBreakdown: expenseBreakdownResult.rows,
        revenueTrend: revenueTrendResult.rows,
        expenseTrend: expenseTrendResult.rows
    };
}

/**
 * CALCULATION LAYER
 */
function calculateFinancialMetrics(rawFinancial) {
    const totalRevenue = rawFinancial.revenueTrend.reduce((sum, item) => sum + parseFloat(item.total_revenue), 0);
    const totalGrossProfit = rawFinancial.revenueTrend.reduce((sum, item) => sum + parseFloat(item.gross_profit), 0);
    const totalExpenses = rawFinancial.expenseTrend.reduce((sum, item) => sum + parseFloat(item.total), 0);
    
    // FIXED: Net Profit = Service Charges - Expenses
    const netProfit = totalGrossProfit - totalExpenses;
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0;

    const trendMap = new Map();

    rawFinancial.revenueTrend.forEach(row => {
        const dateStr = row.date_label; 
        trendMap.set(dateStr, { 
            date: dateStr, 
            revenue: parseFloat(row.total_revenue), 
            expense: 0, 
            grossProfit: parseFloat(row.gross_profit), // Track this for accurate chart rendering
            profit: parseFloat(row.gross_profit) // Before expenses, profit = grossProfit
        });
    });

    rawFinancial.expenseTrend.forEach(row => {
        const dateStr = row.date_label;
        if (trendMap.has(dateStr)) {
            const entry = trendMap.get(dateStr);
            entry.expense = parseFloat(row.total);
            entry.profit = entry.grossProfit - entry.expense; // FIXED: Net Profit logic
        } else {
            trendMap.set(dateStr, { 
                date: dateStr, revenue: 0, expense: parseFloat(row.total), grossProfit: 0, profit: -parseFloat(row.total) 
            });
        }
    });

    const combinedTrend = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    const charts = {
        revenue: combinedTrend.map(t => ({ label: t.date, value: t.revenue })),
        profit: combinedTrend.map(t => ({ label: t.date, value: t.profit })), // Will now correctly look different!
        expenses: combinedTrend.map(t => ({ label: t.date, value: t.expense }))
    };

    return {
        totals: { revenue: totalRevenue, expenses: totalExpenses, profit: netProfit, margin: parseFloat(profitMargin) },
        breakdowns: {
            revenue: rawFinancial.revenueBreakdown.map(r => ({ category: r.category, amount: parseFloat(r.total) })),
            expenses: rawFinancial.expenseBreakdown.map(e => ({ category: e.category, amount: parseFloat(e.total) }))
        },
        trends: combinedTrend,
        charts 
    };
}

/**
 * WALLET ENGINE
 */
async function fetchWalletAnalytics(client, dates) {
    const { startDate, endDate } = dates;

    const [balancesResult, flowResult] = await Promise.all([
        client.query(`
            SELECT wallet_type, COALESCE(SUM(balance), 0) as total_balance
            FROM wallets
            GROUP BY wallet_type
        `),
        client.query(`
            SELECT type, COALESCE(SUM(amount), 0) as total_amount
            FROM wallet_transactions
            WHERE created_at >= $1 AND created_at <= $2
            GROUP BY type
        `, [startDate, endDate])
    ]);

    const balances = { cash: 0, bank: 0, digital: 0, total: 0 };

    balancesResult.rows.forEach(row => {
        const amount = parseFloat(row.total_balance) || 0;
        const type = (row.wallet_type || "").toLowerCase();

        if (type === 'cash') {
            balances.cash += amount;
        } else if (type === 'bank') {
            balances.bank += amount;
        } else {
            // Everything else (UPI, GPay, Card, etc.) gets bucketed into Digital
            balances.digital += amount;
        }
        
        balances.total += amount;
    });

    const flow = { moneyIn: 0, moneyOut: 0, netFlow: 0 };
    flowResult.rows.forEach(row => {
        const amount = parseFloat(row.total_amount) || 0;
        if (row.type === 'credit' || row.type === 'income') flow.moneyIn += amount;
        else if (row.type === 'debit' || row.type === 'expense') flow.moneyOut += amount;
    });

    flow.netFlow = flow.moneyIn - flow.moneyOut;
    
    return { summary: balances, cashFlow: flow };
}

/**
 * CENTRE LEADERBOARD
 * Ranks centres by profitability, revenue, service volume, customer ratings, and operational bottlenecks.
 */
async function fetchCentreLeaderboard(client, dates) {
    const { startDate, endDate } = dates;

    const leaderboardQuery = `
        WITH CentreRevenue AS (
            SELECT 
                c.id as centre_id, 
                c.name as centre_name, 
                COALESCE(SUM(se.total_charges), 0) as revenue,
                COALESCE(SUM(se.service_charges), 0) as gross_profit,
                COUNT(se.id) as services_completed
            FROM centres c
            LEFT JOIN staff st ON st.centre_id = c.id
            LEFT JOIN service_entries se ON se.staff_id = st.id 
                AND se.status = 'completed' 
                AND se.created_at >= $1 AND se.created_at <= $2
            GROUP BY c.id, c.name
        ),
        CentreExpenses AS (
            SELECT 
                centre_id, 
                COALESCE(SUM(amount), 0) as expenses
            FROM expenses
            WHERE status IN ('approved', 'auto_approved')
                AND (is_reversal IS NULL OR is_reversal = FALSE)
                AND expense_date >= $1 AND expense_date <= $2
            GROUP BY centre_id
        ),
        CentreRatings AS (
            SELECT 
                c.id as centre_id, 
                ROUND(AVG(sr.service_rating), 1) as avg_rating
            FROM centres c
            JOIN staff st ON st.centre_id = c.id
            JOIN service_reviews sr ON sr.staff_id = st.id
            WHERE sr.submitted_at >= $1 AND sr.submitted_at <= $2
            GROUP BY c.id
        ),
        CentrePending AS (
            SELECT 
                c.id as centre_id,
                COALESCE(SUM(se.total_charges - COALESCE(sp.paid, 0)), 0) as pending_amount
            FROM centres c
            JOIN staff st ON st.centre_id = c.id
            JOIN service_entries se ON se.staff_id = st.id 
                AND se.created_at >= $1 AND se.created_at <= $2
            LEFT JOIN (
                SELECT service_entry_id, COALESCE(SUM(amount), 0) as paid 
                FROM payments 
                -- 👇 FIXED: Only count actual received money!
                WHERE status = 'received' AND (is_reversal IS NULL OR is_reversal = FALSE)
                GROUP BY service_entry_id
            ) sp ON sp.service_entry_id = se.id
            WHERE (se.total_charges - COALESCE(sp.paid, 0)) > 0
            GROUP BY c.id
        ),
        CentreDelayed AS (
            SELECT 
                c.id as centre_id,
                COUNT(se.id) as delayed_count
            FROM centres c
            JOIN staff st ON st.centre_id = c.id
            JOIN service_entries se ON se.staff_id = st.id 
                AND se.created_at >= $1 AND se.created_at <= $2
            JOIN service_tracking strak ON strak.service_entry_id = se.id
            WHERE LOWER(strak.status) = 'rejected'
            GROUP BY c.id
        ),
        CentreComplaints AS (
            SELECT 
                c.id as centre_id,
                COUNT(sr.id) as complaint_count
            FROM centres c
            JOIN staff st ON st.centre_id = c.id
            JOIN service_reviews sr ON sr.staff_id = st.id 
                AND sr.submitted_at >= $1 AND sr.submitted_at <= $2
            WHERE sr.service_rating <= 2
            GROUP BY c.id
        )
        SELECT 
            cr.centre_id as id,
            cr.centre_name as name,
            cr.revenue,
            cr.services_completed,
            COALESCE(ce.expenses, 0) as expenses,
            (cr.gross_profit - COALESCE(ce.expenses, 0)) as profit,
            COALESCE(rt.avg_rating, 0) as rating,
            COALESCE(cp.pending_amount, 0) as pending_amount,
            COALESCE(cd.delayed_count, 0) as delayed_count,
            COALESCE(cc.complaint_count, 0) as complaint_count
        FROM CentreRevenue cr
        LEFT JOIN CentreExpenses ce ON cr.centre_id = ce.centre_id
        LEFT JOIN CentreRatings rt ON cr.centre_id = rt.centre_id
        LEFT JOIN CentrePending cp ON cr.centre_id = cp.centre_id
        LEFT JOIN CentreDelayed cd ON cr.centre_id = cd.centre_id
        LEFT JOIN CentreComplaints cc ON cr.centre_id = cc.centre_id
        WHERE cr.revenue > 0 OR COALESCE(ce.expenses, 0) > 0 
        ORDER BY profit DESC; 
    `;

    const result = await client.query(leaderboardQuery, [startDate, endDate]);

    const formattedList = result.rows.map(row => {
        const revenue = parseFloat(row.revenue);
        const expenses = parseFloat(row.expenses);
        const profit = parseFloat(row.profit);
        const rating = parseFloat(row.rating);
        const margin = revenue > 0 ? (profit / revenue) : 0;

        let healthStatus = { label: "Healthy", icon: "🟢", color: "green" };

        if (revenue === 0 && expenses === 0) {
            healthStatus = { label: "Inactive", icon: "⚪", color: "gray" };
        } else if (profit < 0) {
            healthStatus = { label: "Loss Making", icon: "🔴", color: "red" };
        } else if (rating > 0 && rating < 3.0) {
            healthStatus = { label: "Poor Rating", icon: "🔴", color: "red" };
        } else if (profit >= 0 && margin < 0.15) {
            healthStatus = { label: "Low Margin", icon: "🟡", color: "yellow" };
        } else if (rating >= 3.0 && rating < 4.0) {
            healthStatus = { label: "Needs Improvement", icon: "🟡", color: "yellow" };
        } else {
            healthStatus = { label: "Excellent", icon: "🟢", color: "green" };
        }

        return {
            id: row.id,
            name: row.name,
            revenue,
            expenses,
            profit,
            servicesCompleted: parseInt(row.services_completed, 10),
            rating,
            pendingAmount: parseFloat(row.pending_amount) || 0,
            delayedCount: parseInt(row.delayed_count, 10) || 0,
            complaintCount: parseInt(row.complaint_count, 10) || 0,
            healthStatus
        };
    });

    const sortedByRevenue = [...formattedList].sort((a, b) => b.revenue - a.revenue);
    const sortedByProfit = [...formattedList].sort((a, b) => b.profit - a.profit);
    const sortedByRating = [...formattedList].sort((a, b) => b.rating - a.rating);
    const sortedByPending = [...formattedList].sort((a, b) => b.pendingAmount - a.pendingAmount);
    const sortedByDelayed = [...formattedList].sort((a, b) => b.delayedCount - a.delayedCount);
    const sortedByComplaints = [...formattedList].sort((a, b) => b.complaintCount - a.complaintCount);

    return {
        fullList: formattedList,
        topPerformers: formattedList.slice(0, 5),
        worstPerformers: [...formattedList].sort((a, b) => a.profit - b.profit).slice(0, 5),
        best: {
            revenue: { name: sortedByRevenue[0]?.name, value: sortedByRevenue[0]?.revenue },
            profit: { name: sortedByProfit[0]?.name, value: sortedByProfit[0]?.profit },
            rating: { name: sortedByRating[0]?.name, value: sortedByRating[0]?.rating }
        },
        worst: {
            revenue: { name: sortedByRevenue[sortedByRevenue.length - 1]?.name, value: sortedByRevenue[sortedByRevenue.length - 1]?.revenue },
            pending: { name: sortedByPending[0]?.name, value: sortedByPending[0]?.pendingAmount },
            delayed: { name: sortedByDelayed[0]?.name, value: sortedByDelayed[0]?.delayedCount },
            complaints: { name: sortedByComplaints[0]?.name, value: sortedByComplaints[0]?.complaintCount },
        }
    };
}

/**
 * CUSTOMER ANALYTICS ENGINE
 */
async function fetchCustomerAnalytics(client, dates) {
    const { startDate, endDate } = dates;
    const [statsResult, trendResult] = await Promise.all([
        client.query(`
            SELECT 
                COUNT(*) as new_customers,
                (SELECT COUNT(*) FROM service_reviews WHERE submitted_at >= $1 AND submitted_at <= $2) as total_reviews,
                (SELECT ROUND(AVG(service_rating), 1) FROM service_reviews WHERE submitted_at >= $1 AND submitted_at <= $2) as avg_rating
            FROM customers WHERE created_at >= $1 AND created_at <= $2
        `, [startDate, endDate]),
        client.query(`
            SELECT DATE(created_at) as date, COUNT(*) as registrations
            FROM customers WHERE created_at >= $1 AND created_at <= $2
            GROUP BY DATE(created_at) ORDER BY date ASC
        `, [startDate, endDate])
    ]);
    return {
        summary: {
            newRegistrations: parseInt(statsResult.rows[0].new_customers, 10) || 0,
            totalReviews: parseInt(statsResult.rows[0].total_reviews, 10) || 0,
            averageRating: parseFloat(statsResult.rows[0].avg_rating) || 0
        },
        registrationTrend: trendResult.rows.map(row => ({ date: row.date.toISOString().split('T')[0], registrations: parseInt(row.registrations, 10) }))
    };
}

/**
 * STAFF ANALYTICS ENGINE
 */
async function fetchStaffAnalytics(client, dates) {
    const { startDate, endDate } = dates;
    const topStaffQuery = `
        SELECT 
            st.id, st.name as staff_name, c.name as centre_name,
            COUNT(se.id) as services_completed,
            COALESCE(SUM(se.total_charges), 0) as revenue_generated
        FROM staff st
        JOIN centres c ON st.centre_id = c.id
        JOIN service_entries se ON se.staff_id = st.id
        WHERE se.status = 'completed' AND se.created_at >= $1 AND se.created_at <= $2
        GROUP BY st.id, st.name, c.name
        ORDER BY revenue_generated DESC LIMIT 10
    `;
    const result = await client.query(topStaffQuery, [startDate, endDate]);
    return {
        topPerformers: result.rows.map(row => ({
            id: row.id, name: row.staff_name, centre: row.centre_name,
            servicesCompleted: parseInt(row.services_completed, 10), revenue: parseFloat(row.revenue_generated)
        }))
    };
}

/**
 * ACTIVITY ENGINE
 */
async function fetchRecentActivities(client) {
    const [servicesResult, expensesResult, reviewsResult, customersResult, walletsResult] = await Promise.all([
        client.query(`SELECT 'service_completed' as type, se.created_at, se.total_charges as amount, c.name as centre_name, st.name as staff_name, sv.name as title, se.id as reference_id FROM service_entries se JOIN staff st ON st.id = se.staff_id JOIN centres c ON c.id = st.centre_id JOIN services sv ON sv.id = se.category_id WHERE se.status = 'completed' ORDER BY se.created_at DESC LIMIT 25`),
        client.query(`SELECT 'expense_added' as type, e.created_at, e.amount, c.name as centre_name, 'Admin' as staff_name, e.category as title, e.id as reference_id FROM expenses e JOIN centres c ON c.id = e.centre_id ORDER BY e.created_at DESC LIMIT 25`),
        client.query(`SELECT 'customer_review' as type, sr.submitted_at as created_at, 0 as amount, c.name as centre_name, st.name as staff_name, 'New Review: ' || sr.service_rating || ' Stars' as title, sr.id as reference_id FROM service_reviews sr JOIN staff st ON st.id = sr.staff_id JOIN centres c ON c.id = st.centre_id ORDER BY sr.submitted_at DESC LIMIT 25`),
        client.query(`SELECT 'customer_registered' as type, created_at, 0 as amount, 'System' as centre_name, 'System' as staff_name, name as title, id as reference_id FROM customers ORDER BY created_at DESC LIMIT 25`),
        client.query(`SELECT 'wallet_transaction' as type, wt.created_at, wt.amount, w.wallet_type || ' Wallet' as centre_name, wt.type as staff_name, 'Wallet ' || wt.type as title, wt.id as reference_id FROM wallet_transactions wt JOIN wallets w ON w.id = wt.wallet_id ORDER BY wt.created_at DESC LIMIT 25`)
    ]);

    const allActivities = [...servicesResult.rows, ...expensesResult.rows, ...reviewsResult.rows, ...customersResult.rows, ...walletsResult.rows];
    const validActivities = allActivities.filter(act => act.created_at != null);
    validActivities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const timeline = validActivities.slice(0, 100).map(act => {
        const safeDate = act.created_at ? new Date(act.created_at) : new Date();
        return {
            type: act.type, title: act.title, amount: parseFloat(act.amount) || 0,
            centre: act.centre_name || 'Unknown', staff: act.staff_name || 'System',
            createdAt: safeDate.toISOString(), referenceId: act.reference_id
        };
    });

    const summary = {
        totalActivities: timeline.length,
        completedServices: timeline.filter(a => a.type === 'service_completed').length,
        expensesAdded: timeline.filter(a => a.type === 'expense_added').length,
        reviewsReceived: timeline.filter(a => a.type === 'customer_review').length,
        newCustomers: timeline.filter(a => a.type === 'customer_registered').length
    };
    return { timeline, summary, alerts: [], achievements: [] };
}

async function fetchTeamAnalytics(client, dates) {
    const { startDate, endDate } = dates;
    
    const query = `
        WITH TeamRevenue AS (
            SELECT 
                t.id as team_id, 
                t.name as team_name, 
                c.name as centre_name,
                COUNT(DISTINCT st.id) as members,
                COUNT(se.id) as services_completed,
                COALESCE(SUM(se.total_charges), 0) as revenue,
                COALESCE(SUM(se.service_charges), 0) as gross_profit
            FROM teams t
            JOIN centres c ON c.id = t.centre_id
            LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.is_active = true
            LEFT JOIN staff st ON st.id = tm.staff_id
            LEFT JOIN service_entries se ON se.staff_id = st.id 
                AND se.status = 'completed' 
                AND se.created_at >= $1 AND se.created_at <= $2
            GROUP BY t.id, t.name, c.name
        ),
        TeamExpenses AS (
            SELECT 
                team_id, 
                COALESCE(SUM(amount), 0) as expenses
            FROM expenses
            WHERE status IN ('approved', 'auto_approved')
                AND (is_reversal IS NULL OR is_reversal = FALSE)
                AND expense_date >= $1 AND expense_date <= $2
                AND team_id IS NOT NULL
            GROUP BY team_id
        )
        SELECT 
            tr.team_id as id, 
            tr.team_name, 
            tr.centre_name, 
            tr.members,
            tr.services_completed, 
            tr.revenue, 
            tr.gross_profit,
            COALESCE(te.expenses, 0) as expenses,
            (tr.gross_profit - COALESCE(te.expenses, 0)) as net_profit
        FROM TeamRevenue tr
        LEFT JOIN TeamExpenses te ON tr.team_id = te.team_id
        ORDER BY net_profit DESC
    `;
    
    const result = await client.query(query, [startDate, endDate]);
    
    const formatted = result.rows.map(r => ({
        id: r.id, 
        name: r.team_name, 
        centre: r.centre_name, 
        members: parseInt(r.members, 10),
        servicesCompleted: parseInt(r.services_completed, 10), 
        revenue: parseFloat(r.revenue),
        grossProfit: parseFloat(r.gross_profit),
        expenses: parseFloat(r.expenses),
        profit: parseFloat(r.net_profit) // Maps perfectly to the frontend table now
    }));

    return { 
        topTeams: formatted.slice(0, 5), 
        worstTeams: [...formatted].sort((a, b) => a.profit - b.profit).slice(0, 5), 
        fullList: formatted 
    };
}

async function fetchHealthAnalytics(client, dates) {
    const { startDate, endDate } = dates;

    const [negativeWallets, pendingPayments, unassignedServices] = await Promise.all([
        client.query(`
            SELECT w.wallet_type, w.balance, c.name as centre_name 
            FROM wallets w 
            JOIN centres c ON c.id = w.centre_id 
            WHERE w.balance < 0
        `),
        client.query(`
            WITH ServicePayments AS (
                SELECT service_entry_id, COALESCE(SUM(amount), 0) as paid
                FROM payments
                -- 👇 FIXED
                WHERE status = 'received' AND (is_reversal IS NULL OR is_reversal = FALSE)
                GROUP BY service_entry_id
            )
            SELECT 
                COUNT(se.id) as count, 
                COALESCE(SUM(se.total_charges - COALESCE(sp.paid, 0)), 0) as total_value 
            FROM service_entries se
            LEFT JOIN ServicePayments sp ON sp.service_entry_id = se.id
            WHERE (se.total_charges - COALESCE(sp.paid, 0)) > 0 
            AND se.created_at >= $1 AND se.created_at <= $2
        `, [startDate, endDate]),
        client.query(`
            SELECT COUNT(id) as count 
            FROM service_entries 
            WHERE status = 'pending' AND staff_id IS NULL
        `)
    ]);

    const warnings = [];
    if (negativeWallets.rows.length > 0) {
        warnings.push({ type: 'critical', message: `${negativeWallets.rows.length} wallets are in negative balance.` });
    }
    
    const pendingCount = parseInt(pendingPayments.rows[0].count, 10);
    if (pendingCount > 50) {
        warnings.push({ type: 'warning', message: `High volume of pending payments (${pendingCount}).` });
    }

    let score = 100;
    score -= (negativeWallets.rows.length * 5);
    score -= (pendingCount > 50 ? 10 : 0);

    return {
        overallScore: Math.max(0, score), 
        alerts: warnings,
        metrics: {
            negativeWallets: negativeWallets.rows.length,
            pendingPaymentValue: parseFloat(pendingPayments.rows[0].total_value),
            unassignedServices: parseInt(unassignedServices.rows[0].count, 10)
        }
    };
}

async function fetchSystemAlerts(client) {
    const [
        negativeWallets,
        largePendingPayments,
        badReviews,
        stagnantServices
    ] = await Promise.all([
        client.query(`
            SELECT w.id, w.wallet_type, w.balance, c.name as centre_name
            FROM wallets w 
            JOIN centres c ON c.id = w.centre_id
            WHERE w.balance < 0
        `),
        client.query(`
            WITH ServicePayments AS (
                SELECT service_entry_id, COALESCE(SUM(amount), 0) as paid
                FROM payments
                -- 👇 FIXED
                WHERE status = 'received' AND (is_reversal IS NULL OR is_reversal = FALSE)
                GROUP BY service_entry_id
            )
            SELECT 
                se.id, 
                (se.total_charges - COALESCE(sp.paid, 0)) as balance_amount, 
                c.name as centre_name, 
                sv.name as service_name
            FROM service_entries se
            JOIN staff st ON st.id = se.staff_id
            JOIN centres c ON c.id = st.centre_id
            JOIN services sv ON sv.id = se.category_id
            LEFT JOIN ServicePayments sp ON sp.service_entry_id = se.id
            WHERE (se.total_charges - COALESCE(sp.paid, 0)) > 5000
        `),
        client.query(`
            SELECT sr.id, sr.service_rating, sr.customer_name, c.name as centre_name
            FROM service_reviews sr
            JOIN staff st ON st.id = sr.staff_id
            JOIN centres c ON c.id = st.centre_id
            WHERE sr.service_rating <= 2 
            AND sr.submitted_at >= NOW() - INTERVAL '7 days'
        `),
        client.query(`
            SELECT se.id, c.name as centre_name, sv.name as service_name, se.created_at
            FROM service_entries se
            JOIN staff st ON st.id = se.staff_id
            JOIN centres c ON c.id = st.centre_id
            JOIN services sv ON sv.id = se.category_id
            WHERE se.status IN ('pending', 'processing')
            AND se.created_at < NOW() - INTERVAL '5 days'
        `)
    ]);

    const alerts = [];

    negativeWallets.rows.forEach(row => {
        alerts.push({
            id: `wallet_${row.id}`, priority: 'critical', title: 'Negative Wallet Balance',
            message: `${row.centre_name}'s ${row.wallet_type} wallet is overdrawn by ₹${Math.abs(row.balance)}.`, centre: row.centre_name, actionCode: 'VIEW_WALLET'
        });
    });

    badReviews.rows.forEach(row => {
        alerts.push({
            id: `review_${row.id}`, priority: 'critical', title: 'Poor Customer Review',
            message: `${row.customer_name} gave ${row.service_rating} stars at ${row.centre_name}.`, centre: row.centre_name, actionCode: 'VIEW_REVIEW'
        });
    });

    largePendingPayments.rows.forEach(row => {
        alerts.push({
            id: `payment_${row.id}`, priority: 'warning', title: 'High Pending Payment',
            message: `₹${row.balance_amount} pending for ${row.service_name} at ${row.centre_name}.`, centre: row.centre_name, actionCode: 'VIEW_SERVICE'
        });
    });

    stagnantServices.rows.forEach(row => {
        const daysDelayed = Math.floor((new Date() - new Date(row.created_at)) / (1000 * 60 * 60 * 24));
        alerts.push({
            id: `stuck_${row.id}`, priority: 'warning', title: 'Service Delayed',
            message: `${row.service_name} at ${row.centre_name} has been pending for ${daysDelayed} days.`, centre: row.centre_name, actionCode: 'VIEW_SERVICE'
        });
    });

    alerts.sort((a, b) => {
        if (a.priority === 'critical' && b.priority === 'warning') return -1;
        if (a.priority === 'warning' && b.priority === 'critical') return 1;
        return 0;
    });

    return alerts;
}