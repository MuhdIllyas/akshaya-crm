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
            // Assuming Indian Financial Year (April 1 to March 31)
            const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
            startDate = new Date(startYear, 3, 1); // April 1
            endDate = new Date(startYear + 1, 2, 31, 23, 59, 59, 999); // March 31
            break;
        case 'allTime':
            startDate = new Date(2000, 0, 1); // Or your company's founding date
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
 * Main entry point for the SuperAdmin Executive Dashboard
 */
const getSuperAdminDashboard = async (filters = {}) => {
    const modules = filters.modules ? filters.modules.split(',') : ['stats']; 
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
        
        // NEW: Alerts Module
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
 * Fetches top-level KPIs for the Executive Dashboard
 */
async function fetchOrganisationStats(client, dates) {
    const { startDate, endDate } = dates;

    // We use Promise.all to run these lightweight aggregations concurrently
    const [
        revenueResult,
        expenseResult,
        entityCountsResult
    ] = await Promise.all([
        // 1. Revenue for the period
        client.query(`
            SELECT COALESCE(SUM(total_charges), 0) as total_revenue, 
                   COUNT(id) as total_services 
            FROM service_entries 
            WHERE status = 'completed' 
            AND created_at >= $1 AND created_at <= $2
        `, [startDate, endDate]),

        // 2. Expenses for the period
        client.query(`
            SELECT COALESCE(SUM(amount), 0) as total_expenses 
            FROM expenses 
            WHERE status = 'approved'
            AND expense_date >= $1 AND expense_date <= $2
        `, [startDate, endDate]),

        // 3. Global Entity Counts (Usually lifetime totals, not filtered by date)
        client.query(`
            SELECT 
                (SELECT COUNT(*) FROM centres WHERE status = 'active') as total_centres,
                (SELECT COUNT(*) FROM staff WHERE status = 'active') as total_staff,
                (SELECT COUNT(*) FROM customers) as total_customers
        `)
    ]);

    const revenue = parseFloat(revenueResult.rows[0].total_revenue);
    const expenses = parseFloat(expenseResult.rows[0].total_expenses);
    const profit = revenue - expenses;

    return {
        revenue,
        expenses,
        profit,
        servicesCompleted: parseInt(revenueResult.rows[0].total_services, 10),
        totalCentres: parseInt(entityCountsResult.rows[0].total_centres, 10),
        totalStaff: parseInt(entityCountsResult.rows[0].total_staff, 10),
        totalCustomers: parseInt(entityCountsResult.rows[0].total_customers, 10)
    };
}

/**
 * FETCH LAYER: FINANCIAL ENGINE
 * Gets raw financial data from the database.
 */
async function fetchFinancialOverview(client, dates) {
    const { startDate, endDate } = dates;

    const [
        revenueBreakdownResult,
        expenseBreakdownResult,
        revenueTrendResult,
        expenseTrendResult
    ] = await Promise.all([
        // 1. Revenue by Service Category
        client.query(`
            SELECT sv.category, COALESCE(SUM(se.total_charges), 0) as total
            FROM service_entries se
            JOIN services sv ON se.service_id = sv.id
            WHERE se.status = 'completed'
            AND se.created_at >= $1 AND se.created_at <= $2
            GROUP BY sv.category
            ORDER BY total DESC
        `, [startDate, endDate]),

        // 2. Expenses by Category
        client.query(`
            SELECT category, COALESCE(SUM(amount), 0) as total
            FROM expenses
            WHERE status = 'approved'
            AND expense_date >= $1 AND expense_date <= $2
            GROUP BY category
            ORDER BY total DESC
        `, [startDate, endDate]),

        // 3. Daily Revenue Trend
        client.query(`
            SELECT DATE(created_at) as date, COALESCE(SUM(total_charges), 0) as total
            FROM service_entries
            WHERE status = 'completed'
            AND created_at >= $1 AND created_at <= $2
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `, [startDate, endDate]),

        // 4. Daily Expense Trend
        client.query(`
            SELECT DATE(expense_date) as date, COALESCE(SUM(amount), 0) as total
            FROM expenses
            WHERE status = 'approved'
            AND expense_date >= $1 AND expense_date <= $2
            GROUP BY DATE(expense_date)
            ORDER BY date ASC
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
 * Transforms raw SQL data into ready-to-use business metrics.
 */
function calculateFinancialMetrics(rawFinancial) {
    // 1. Calculate Totals
    const totalRevenue = rawFinancial.revenueBreakdown.reduce((sum, item) => sum + parseFloat(item.total), 0);
    const totalExpenses = rawFinancial.expenseBreakdown.reduce((sum, item) => sum + parseFloat(item.total), 0);
    const netProfit = totalRevenue - totalExpenses;
    
    // 2. Calculate Margins safely
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0;

    // 3. Merge Trends for a single Chart (e.g., Recharts expects one array of objects)
    const trendMap = new Map();

    // Initialize map with revenue
    rawFinancial.revenueTrend.forEach(row => {
        const dateStr = row.date.toISOString().split('T')[0];
        trendMap.set(dateStr, { 
            date: dateStr, 
            revenue: parseFloat(row.total), 
            expense: 0, 
            profit: parseFloat(row.total) 
        });
    });

    // Merge expenses into the map
    rawFinancial.expenseTrend.forEach(row => {
        const dateStr = row.date.toISOString().split('T')[0];
        if (trendMap.has(dateStr)) {
            const entry = trendMap.get(dateStr);
            entry.expense = parseFloat(row.total);
            entry.profit = entry.revenue - entry.expense;
        } else {
            trendMap.set(dateStr, { 
                date: dateStr, 
                revenue: 0, 
                expense: parseFloat(row.total), 
                profit: -parseFloat(row.total) 
            });
        }
    });

    // Convert map to sorted array
    const combinedTrend = Array.from(trendMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));

    return {
        totals: {
            revenue: totalRevenue,
            expenses: totalExpenses,
            profit: netProfit,
            margin: parseFloat(profitMargin)
        },
        breakdowns: {
            revenue: rawFinancial.revenueBreakdown.map(r => ({ category: r.category, amount: parseFloat(r.total) })),
            expenses: rawFinancial.expenseBreakdown.map(e => ({ category: e.category, amount: parseFloat(e.total) }))
        },
        trends: combinedTrend
    };
}

/**
 * WALLET ENGINE
 * Tracks liquidity, current balances across payment modes, and transaction flow.
 */
async function fetchWalletAnalytics(client, dates) {
    const { startDate, endDate } = dates;

    const [
        balancesResult,
        flowResult
    ] = await Promise.all([
        // 1. Current Balances (Grouped by Wallet Type)
        // Note: We don't use date filters here because balances are absolute current states.
        client.query(`
            SELECT type, COALESCE(SUM(balance), 0) as total_balance
            FROM wallets
            WHERE status = 'active'
            GROUP BY type
        `),

        // 2. Transaction Flow (In/Out within the date range)
        client.query(`
            SELECT transaction_type, COALESCE(SUM(amount), 0) as total_amount
            FROM wallet_transactions
            WHERE created_at >= $1 AND created_at <= $2
            GROUP BY transaction_type
        `, [startDate, endDate])
    ]);

    // Format Balances
    const balances = {
        cash: 0,
        bank: 0,
        digital: 0,
        total: 0
    };

    balancesResult.rows.forEach(row => {
        const amount = parseFloat(row.total_balance);
        if (balances[row.type] !== undefined) {
            balances[row.type] = amount;
        }
        balances.total += amount;
    });

    // Format Cash Flow
    const flow = {
        moneyIn: 0,
        moneyOut: 0,
        netFlow: 0
    };

    flowResult.rows.forEach(row => {
        const amount = parseFloat(row.total_amount);
        // Adjust these strings based on your actual database ENUMs for transaction_type
        if (row.transaction_type === 'credit' || row.transaction_type === 'income') {
            flow.moneyIn += amount;
        } else if (row.transaction_type === 'debit' || row.transaction_type === 'expense') {
            flow.moneyOut += amount;
        }
    });

    flow.netFlow = flow.moneyIn - flow.moneyOut;

    return {
        summary: balances,
        cashFlow: flow
    };
}

/**
 * CENTRE LEADERBOARD
 * Ranks centres by profitability, revenue, service volume, and customer ratings.
 */
async function fetchCentreLeaderboard(client, dates) {
    const { startDate, endDate } = dates;

    // We use CTEs (WITH clauses) to independently calculate revenue, expenses, 
    // and ratings per centre, then join them together in one highly optimized query.
    const leaderboardQuery = `
        WITH CentreRevenue AS (
            SELECT 
                c.id as centre_id, 
                c.name as centre_name, 
                COALESCE(SUM(se.total_charges), 0) as revenue, 
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
            WHERE status = 'approved' 
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
        )
        SELECT 
            cr.centre_id as id,
            cr.centre_name as name,
            cr.revenue,
            cr.services_completed,
            COALESCE(ce.expenses, 0) as expenses,
            (cr.revenue - COALESCE(ce.expenses, 0)) as profit,
            COALESCE(rt.avg_rating, 0) as rating
        FROM CentreRevenue cr
        LEFT JOIN CentreExpenses ce ON cr.centre_id = ce.centre_id
        LEFT JOIN CentreRatings rt ON cr.centre_id = rt.centre_id
        WHERE cr.revenue > 0 OR COALESCE(ce.expenses, 0) > 0 -- Only show active centres
        ORDER BY profit DESC; 
    `;

    const result = await client.query(leaderboardQuery, [startDate, endDate]);

    // Format the SQL output into clean JavaScript types
    const formattedList = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        revenue: parseFloat(row.revenue),
        expenses: parseFloat(row.expenses),
        profit: parseFloat(row.profit),
        servicesCompleted: parseInt(row.services_completed, 10),
        rating: parseFloat(row.rating)
    }));

    // Pre-slice top and bottom performers for the Executive Dashboard
    return {
        fullList: formattedList,
        topPerformers: formattedList.slice(0, 5),
        worstPerformers: [...formattedList].sort((a, b) => a.profit - b.profit).slice(0, 5) // Sort ascending by profit
    };
}

/**
 * CUSTOMER ANALYTICS ENGINE
 * Tracks customer acquisition, review volume, and satisfaction.
 */
async function fetchCustomerAnalytics(client, dates) {
    const { startDate, endDate } = dates;

    const [
        statsResult,
        trendResult
    ] = await Promise.all([
        // 1. Overall Acquisition & Satisfaction in this period
        client.query(`
            SELECT 
                COUNT(*) as new_customers,
                (SELECT COUNT(*) FROM service_reviews WHERE submitted_at >= $1 AND submitted_at <= $2) as total_reviews,
                (SELECT ROUND(AVG(service_rating), 1) FROM service_reviews WHERE submitted_at >= $1 AND submitted_at <= $2) as avg_rating
            FROM customers 
            WHERE created_at >= $1 AND created_at <= $2
        `, [startDate, endDate]),

        // 2. Daily Registration Trend
        client.query(`
            SELECT DATE(created_at) as date, COUNT(*) as registrations
            FROM customers
            WHERE created_at >= $1 AND created_at <= $2
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `, [startDate, endDate])
    ]);

    return {
        summary: {
            newRegistrations: parseInt(statsResult.rows[0].new_customers, 10) || 0,
            totalReviews: parseInt(statsResult.rows[0].total_reviews, 10) || 0,
            averageRating: parseFloat(statsResult.rows[0].avg_rating) || 0
        },
        registrationTrend: trendResult.rows.map(row => ({
            date: row.date.toISOString().split('T')[0],
            registrations: parseInt(row.registrations, 10)
        }))
    };
}

/**
 * STAFF ANALYTICS ENGINE
 * Ranks staff by productivity and revenue generation.
 */
async function fetchStaffAnalytics(client, dates) {
    const { startDate, endDate } = dates;

    // We rank staff by revenue generation. We also fetch their centre 
    // so the SuperAdmin knows exactly where the top performers are located.
    const topStaffQuery = `
        SELECT 
            st.id,
            st.name as staff_name,
            c.name as centre_name,
            COUNT(se.id) as services_completed,
            COALESCE(SUM(se.total_charges), 0) as revenue_generated
        FROM staff st
        JOIN centres c ON st.centre_id = c.id
        JOIN service_entries se ON se.staff_id = st.id
        WHERE se.status = 'completed' 
          AND se.created_at >= $1 AND se.created_at <= $2
        GROUP BY st.id, st.name, c.name
        ORDER BY revenue_generated DESC
        LIMIT 10
    `;

    const result = await client.query(topStaffQuery, [startDate, endDate]);

    return {
        topPerformers: result.rows.map(row => ({
            id: row.id,
            name: row.staff_name,
            centre: row.centre_name,
            servicesCompleted: parseInt(row.services_completed, 10),
            revenue: parseFloat(row.revenue_generated)
        }))
    };
}

/**
 * ACTIVITY ENGINE
 * Creates a unified live feed of everything happening across the organization.
 */
async function fetchRecentActivities(client) {
    // Note: We often don't pass date filters here because a live feed 
    // usually just wants the absolute latest 100 events regardless of the timeframe.

    const [
        servicesResult,
        expensesResult,
        reviewsResult,
        customersResult,
        walletsResult
    ] = await Promise.all([
        // 1. Completed Services
        client.query(`
            SELECT 
                'service_completed' as type,
                se.created_at,
                se.total_charges as amount,
                c.name as centre_name,
                st.name as staff_name,
                sv.name as title,
                se.id as reference_id
            FROM service_entries se
            JOIN staff st ON st.id = se.staff_id
            JOIN centres c ON c.id = st.centre_id
            JOIN services sv ON sv.id = se.service_id
            WHERE se.status = 'completed'
            ORDER BY se.created_at DESC LIMIT 25
        `),

        // 2. Expenses Added
        client.query(`
            SELECT 
                'expense_added' as type,
                e.created_at,
                e.amount,
                c.name as centre_name,
                'Admin' as staff_name,
                e.category as title,
                e.id as reference_id
            FROM expenses e
            JOIN centres c ON c.id = e.centre_id
            ORDER BY e.created_at DESC LIMIT 25
        `),

        // 3. Customer Reviews
        client.query(`
            SELECT 
                'customer_review' as type,
                sr.submitted_at as created_at,
                0 as amount,
                c.name as centre_name,
                st.name as staff_name,
                'New Review: ' || sr.service_rating || ' Stars' as title,
                sr.id as reference_id
            FROM service_reviews sr
            JOIN staff st ON st.id = sr.staff_id
            JOIN centres c ON c.id = st.centre_id
            ORDER BY sr.submitted_at DESC LIMIT 25
        `),

        // 4. New Customers
        client.query(`
            SELECT 
                'customer_registered' as type,
                created_at,
                0 as amount,
                'System' as centre_name,
                'System' as staff_name,
                name as title,
                id as reference_id
            FROM customers
            ORDER BY created_at DESC LIMIT 25
        `),

        // 5. Wallet Transactions
        client.query(`
            SELECT 
                'wallet_transaction' as type,
                wt.created_at,
                wt.amount,
                w.type || ' Wallet' as centre_name, 
                wt.transaction_type as staff_name,
                'Wallet ' || wt.transaction_type as title,
                wt.id as reference_id
            FROM wallet_transactions wt
            JOIN wallets w ON w.id = wt.wallet_id
            ORDER BY wt.created_at DESC LIMIT 25
        `)
    ]);

    // Merge all the rows into a single array
    const allActivities = [
        ...servicesResult.rows,
        ...expensesResult.rows,
        ...reviewsResult.rows,
        ...customersResult.rows,
        ...walletsResult.rows
    ];

    // Sort chronologically (newest first)
    allActivities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Slice to keep only the absolute 100 most recent events
    const timeline = allActivities.slice(0, 100).map(act => ({
        type: act.type,
        title: act.title,
        amount: parseFloat(act.amount) || 0,
        centre: act.centre_name,
        staff: act.staff_name,
        createdAt: act.created_at.toISOString(),
        referenceId: act.reference_id
    }));

    // Calculate Summary based on the pulled timeline
    const summary = {
        totalActivities: timeline.length,
        completedServices: timeline.filter(a => a.type === 'service_completed').length,
        expensesAdded: timeline.filter(a => a.type === 'expense_added').length,
        reviewsReceived: timeline.filter(a => a.type === 'customer_review').length,
        newCustomers: timeline.filter(a => a.type === 'customer_registered').length
    };

    return {
        timeline,
        summary,
        // Alerts and Achievements will eventually be hydrated by the Health Engine 
        // passing data in, but we scaffold them here for the frontend.
        alerts: [], 
        achievements: [] 
    };
}

async function fetchTeamAnalytics(client, dates) {
    const { startDate, endDate } = dates;
    
    // Note: Replaced created_at with expense_date for expenses!
    const query = `
        SELECT 
            t.id, 
            t.name as team_name, 
            c.name as centre_name,
            COUNT(DISTINCT st.id) as members,
            COUNT(se.id) as services_completed,
            COALESCE(SUM(se.total_charges), 0) as revenue
        FROM teams t
        JOIN centres c ON c.id = t.centre_id
        LEFT JOIN staff st ON st.team_id = t.id
        LEFT JOIN service_entries se ON se.staff_id = st.id 
            AND se.status = 'completed' 
            AND se.created_at >= $1 AND se.created_at <= $2
        GROUP BY t.id, t.name, c.name
        ORDER BY revenue DESC
    `;
    
    const result = await client.query(query, [startDate, endDate]);
    
    const formatted = result.rows.map(r => ({
        id: r.id,
        name: r.team_name,
        centre: r.centre_name,
        members: parseInt(r.members, 10),
        servicesCompleted: parseInt(r.services_completed, 10),
        revenue: parseFloat(r.revenue)
    }));

    return {
        topTeams: formatted.slice(0, 5),
        worstTeams: [...formatted].sort((a, b) => a.revenue - b.revenue).slice(0, 5),
        fullList: formatted
    };
}

async function fetchHealthAnalytics(client, dates) {
    const { startDate, endDate } = dates;

    const [negativeWallets, pendingPayments, unassignedServices] = await Promise.all([
        client.query(`
            SELECT w.type, w.balance, c.name as centre_name 
            FROM wallets w JOIN centres c ON c.id = w.centre_id 
            WHERE w.balance < 0
        `),
        client.query(`
            SELECT COUNT(id) as count, COALESCE(SUM(balance_amount), 0) as total_value 
            FROM service_entries 
            WHERE payment_status = 'pending' AND created_at >= $1 AND created_at <= $2
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

    // A simple 1-100 score logic (starts at 100, drops for bad metrics)
    let score = 100;
    score -= (negativeWallets.rows.length * 5);
    score -= (pendingCount > 50 ? 10 : 0);

    return {
        overallScore: Math.max(0, score), // Prevent negative score
        alerts: warnings,
        metrics: {
            negativeWallets: negativeWallets.rows.length,
            pendingPaymentValue: parseFloat(pendingPayments.rows[0].total_value),
            unassignedServices: parseInt(unassignedServices.rows[0].count, 10)
        }
    };
}

/**
 * ALERT ENGINE
 * Proactively scans the CRM for operational bottlenecks and required actions.
 */
async function fetchSystemAlerts(client) {
    // Run all system health checks simultaneously
    const [
        negativeWallets,
        largePendingPayments,
        badReviews,
        stagnantServices
    ] = await Promise.all([
        // 1. Wallets below 0
        client.query(`
            SELECT w.id, w.type, w.balance, c.name as centre_name
            FROM wallets w 
            JOIN centres c ON c.id = w.centre_id
            WHERE w.balance < 0
        `),
        // 2. Pending payments over ₹5,000 (Adjust threshold as needed)
        client.query(`
            SELECT se.id, se.balance_amount, c.name as centre_name, sv.name as service_name
            FROM service_entries se
            JOIN staff st ON st.id = se.staff_id
            JOIN centres c ON c.id = st.centre_id
            JOIN services sv ON sv.id = se.service_id
            WHERE se.payment_status = 'pending' AND se.balance_amount > 5000
        `),
        // 3. Bad reviews in the last 7 days (Requires immediate damage control)
        client.query(`
            SELECT sr.id, sr.service_rating, sr.customer_name, c.name as centre_name
            FROM service_reviews sr
            JOIN staff st ON st.id = sr.staff_id
            JOIN centres c ON c.id = st.centre_id
            WHERE sr.service_rating <= 2 
            AND sr.submitted_at >= NOW() - INTERVAL '7 days'
        `),
        // 4. Services stuck for more than 5 days
        client.query(`
            SELECT se.id, c.name as centre_name, sv.name as service_name, se.created_at
            FROM service_entries se
            JOIN staff st ON st.id = se.staff_id
            JOIN centres c ON c.id = st.centre_id
            JOIN services sv ON sv.id = se.service_id
            WHERE se.status IN ('pending', 'processing')
            AND se.created_at < NOW() - INTERVAL '5 days'
        `)
    ]);

    const alerts = [];

    // Map Wallet Alerts (Critical)
    negativeWallets.rows.forEach(row => {
        alerts.push({
            id: `wallet_${row.id}`,
            priority: 'critical',
            title: 'Negative Wallet Balance',
            message: `${row.centre_name}'s ${row.type} wallet is overdrawn by ₹${Math.abs(row.balance)}.`,
            centre: row.centre_name,
            actionCode: 'VIEW_WALLET'
        });
    });

    // Map Review Alerts (Critical)
    badReviews.rows.forEach(row => {
        alerts.push({
            id: `review_${row.id}`,
            priority: 'critical',
            title: 'Poor Customer Review',
            message: `${row.customer_name} gave ${row.service_rating} stars at ${row.centre_name}.`,
            centre: row.centre_name,
            actionCode: 'VIEW_REVIEW'
        });
    });

    // Map Payment Alerts (Warning)
    largePendingPayments.rows.forEach(row => {
        alerts.push({
            id: `payment_${row.id}`,
            priority: 'warning',
            title: 'High Pending Payment',
            message: `₹${row.balance_amount} pending for ${row.service_name} at ${row.centre_name}.`,
            centre: row.centre_name,
            actionCode: 'VIEW_SERVICE'
        });
    });

    // Map Stagnant Service Alerts (Warning)
    stagnantServices.rows.forEach(row => {
        const daysDelayed = Math.floor((new Date() - new Date(row.created_at)) / (1000 * 60 * 60 * 24));
        alerts.push({
            id: `stuck_${row.id}`,
            priority: 'warning',
            title: 'Service Delayed',
            message: `${row.service_name} at ${row.centre_name} has been pending for ${daysDelayed} days.`,
            centre: row.centre_name,
            actionCode: 'VIEW_SERVICE'
        });
    });

    // Sort so critical alerts appear at the top of the frontend list
    alerts.sort((a, b) => {
        if (a.priority === 'critical' && b.priority === 'warning') return -1;
        if (a.priority === 'warning' && b.priority === 'critical') return 1;
        return 0;
    });

    return alerts;
}