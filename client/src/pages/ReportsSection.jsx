import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    FiFileText, FiDownload, FiCalendar, FiFilter, FiSearch,
    FiTrendingUp, FiDollarSign, FiPieChart, FiUsers, FiUser,
    FiBriefcase, FiStar, FiClock, FiCheckCircle, FiX,
    FiArrowLeft, FiPrinter, FiEye, FiRefreshCw, FiPlus,
    FiChevronRight, FiClock as FiClockIcon, FiMail,
    FiBarChart2, FiActivity, FiAward, FiHome, FiCreditCard,
    FiSmartphone, FiUserCheck, FiBook, FiDatabase, FiSettings,
    FiStar as FiStarIcon, FiTrendingDown, FiCalendar as FiCalendarIcon
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, LineChart, Line, PieChart, Pie, Cell,
    Legend, ComposedChart
} from 'recharts';

// ─── StatCard Component (matching existing design) ───
const StatCard = ({ title, value, icon: Icon, color, subtitle, onClick, trend }) => (
    <motion.div
        whileHover={{ y: -2 }}
        className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-all duration-200 cursor-pointer p-3"
        onClick={onClick}
    >
        <div className="flex items-center justify-between">
            <div>
                <p className="font-medium text-gray-600 mb-1 text-xs">{title}</p>
                <p className="font-bold text-gray-900 mb-1 text-lg">{value}</p>
                <div className="flex items-center">
                    <p className="text-gray-500 text-xs">{subtitle}</p>
                    {trend && (
                        <span className={`ml-2 flex items-center text-xs font-medium ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {trend > 0 ? <FiTrendingUp className="mr-1" /> : <FiTrendingDown className="mr-1" />}
                            {Math.abs(trend)}%
                        </span>
                    )}
                </div>
            </div>
            <div className={`rounded-lg ${color} p-2`}>
                <Icon className="text-white h-4 w-4" />
            </div>
        </div>
    </motion.div>
);

// ─── InfoTooltip (matching existing design) ───
const InfoTooltip = ({ content, placement = "top", children }) => {
    const [isVisible, setIsVisible] = useState(false);
    const tooltipRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
                setIsVisible(false);
            }
        };
        if (isVisible) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isVisible]);

    return (
        <div
            ref={tooltipRef}
            className="relative inline-block"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
            onClick={(e) => e.stopPropagation()}
        >
            {children || <FiEye className="h-3 w-3 text-gray-400 cursor-pointer hover:text-gray-600" />}
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute z-[100] ${placement === 'top' ? 'bottom-full left-0 mb-2' : 'top-full left-0 mt-2'} min-w-[240px] max-w-[280px]`}
                        style={{ left: '50%', transform: 'translateX(-50%)' }}
                    >
                        <div className="relative bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl">
                            {content}
                            <div className={`absolute w-3 h-3 bg-gray-900 transform rotate-45 ${placement === 'top' ? '-bottom-1.5 left-1/2 -translate-x-1/2' : '-top-1.5 left-1/2 -translate-x-1/2'}`} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ─── Report Card Component ───
const ReportCard = ({ report, onClick, isFavourite, onToggleFavourite }) => {
    const iconMap = {
        'Executive Financial Summary': FiTrendingUp,
        'Profit & Loss Statement': FiDollarSign,
        'Revenue Report': FiBarChart2,
        'Expense Report': FiFileText,
        'Wallet Summary': FiSmartphone,
        'Cash Flow Report': FiActivity,
        'Ledger Report': FiBook,
        'Pending Collections': FiClock,
        'Attendance Report': FiUserCheck,
        'Performance Report': FiAward,
        'Salary Report': FiDollarSign,
        'Incentive Report': FiStar,
        'Review Report': FiStarIcon,
        'Leave Report': FiCalendarIcon,
        'Service Revenue': FiBriefcase,
        'Service Profit': FiTrendingUp,
        'Pending Services': FiClock,
        'Completed Services': FiCheckCircle,
        'Staff-wise Services': FiUsers,
        'Service Time Analysis': FiClockIcon,
        'Customer Summary': FiUsers,
        'New Customers': FiUser,
        'Returning Customers': FiUserCheck,
        'Customer Activity': FiActivity,
        'Customer Reviews': FiStarIcon,
        'Team Financial Report': FiDollarSign,
        'Team Performance': FiAward,
        'Team Contribution': FiPieChart,
        'Centre Comparison': FiHome,
        'Revenue by Centre': FiBarChart2,
        'Profit by Centre': FiTrendingUp,
        'Attendance by Centre': FiUserCheck,
        'Service Comparison': FiBriefcase,
    };

    const Icon = iconMap[report.name] || FiFileText;

    const categoryColors = {
        financial: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        staff: 'bg-blue-50 text-blue-700 border-blue-200',
        service: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        customer: 'bg-purple-50 text-purple-700 border-purple-200',
        team: 'bg-amber-50 text-amber-700 border-amber-200',
        centre: 'bg-rose-50 text-rose-700 border-rose-200',
    };

    const categoryLabels = {
        financial: 'Financial',
        staff: 'Staff',
        service: 'Service',
        customer: 'Customer',
        team: 'Team',
        centre: 'Centre',
    };

    return (
        <motion.div
            whileHover={{ y: -2, scale: 1.01 }}
            className="bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-all duration-200 cursor-pointer p-4 relative group"
            onClick={onClick}
        >
            {/* Favourite Star - Top Right */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavourite?.(report.id);
                }}
                className={`absolute top-2 right-2 p-1 rounded-full transition-colors ${isFavourite ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-amber-400'}`}
            >
                <FiStarIcon className={`h-4 w-4 ${isFavourite ? 'fill-amber-500' : ''}`} />
            </button>

            <div className="flex items-start space-x-3">
                <div className={`rounded-lg p-2.5 ${categoryColors[report.category] || 'bg-gray-100 text-gray-700'}`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 text-sm truncate pr-6">{report.name}</h4>
                    <p className="text-gray-500 text-xs mt-0.5">{report.description}</p>
                    <div className="flex items-center mt-2 space-x-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${categoryColors[report.category] || 'bg-gray-100 text-gray-700'}`}>
                            {categoryLabels[report.category] || report.category}
                        </span>
                        {report.updatedAt && (
                            <span className="text-gray-400 text-xs">
                                Updated {report.updatedAt}
                            </span>
                        )}
                    </div>
                </div>
                <FiChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-600 transition-colors mt-2" />
            </div>
        </motion.div>
    );
};

// ─── Quick Report Tile ───
const QuickReportTile = ({ label, value, icon: Icon, color, onClick }) => (
    <motion.div
        whileHover={{ scale: 1.02 }}
        className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-all"
        onClick={onClick}
    >
        <div className="flex items-center justify-between">
            <div>
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
            </div>
            <div className={`rounded-lg ${color} p-2`}>
                <Icon className="text-white h-4 w-4" />
            </div>
        </div>
    </motion.div>
);

// ─── Scheduled Report Card ───
const ScheduledReportCard = ({ schedule, onToggle }) => {
    const frequencyColors = {
        daily: 'bg-blue-50 text-blue-700 border-blue-200',
        weekly: 'bg-purple-50 text-purple-700 border-purple-200',
        monthly: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };

    return (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
            <div className="flex items-center space-x-3">
                <div className={`rounded-lg p-2 ${frequencyColors[schedule.frequency] || 'bg-gray-100 text-gray-700'}`}>
                    <FiMail className="h-4 w-4" />
                </div>
                <div>
                    <p className="font-medium text-gray-900 text-sm">{schedule.name}</p>
                    <p className="text-xs text-gray-500">
                        {schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1)} • {schedule.recipient}
                    </p>
                </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    checked={schedule.enabled}
                    onChange={() => onToggle?.(schedule.id)}
                    className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
        </div>
    );
};

// ─── Report Preview Panel (Wired to V3 Backend) ───
const ReportPreviewPanel = ({ report, previewData, onClose, onExport }) => {
    const [activeTab, setActiveTab] = useState('preview');
    const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

    // 1. SAFELY EXTRACT API DATA 
    // We default everything to empty objects/arrays so React never crashes
    const apiData = previewData?.data || {};
    const financials = apiData.financials?.today || {};
    const staffData = apiData.staff?.staff || {};
    const serviceRevenueData = apiData.serviceRevenue || [];
    const expenseData = apiData.expenseReport || [];

    // Extract the new Expense by Wallet data
    const expenseByWalletData = apiData.expenseByWallet || [];
    const expenseWalletDistribution = expenseByWalletData.map(w => ({
        name: w.wallet_name,
        value: Number(w.amount || 0)
    })).filter(w => w.value > 0);

    const walletSummaryData = apiData.walletSummary || [];
    const cashFlowData = apiData.cashFlow || [];

    // ✅ ADD THIS: Extract Ledger Data and calculate quick summaries
    const ledgerData = apiData.ledger || [];
    const ledgerSummary = { credit: 0, debit: 0, count: ledgerData.length };
    const ledgerCategories = {};
    
    ledgerData.forEach(tx => {
        if (tx.type === 'credit') ledgerSummary.credit += tx.amount;
        if (tx.type === 'debit') ledgerSummary.debit += tx.amount;
        if (!ledgerCategories[tx.category]) ledgerCategories[tx.category] = 0;
        ledgerCategories[tx.category] += tx.amount;
    });

    const ledgerCategoryChart = Object.entries(ledgerCategories)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10); // Top 10 volume categories

    const pendingCollectionsData = apiData.pendingCollections || [];
    const pendingSummary = { 
        totalDue: pendingCollectionsData.reduce((sum, r) => sum + r.balance_due, 0), 
        count: pendingCollectionsData.length 
    };

    // ✅ Extract Attendance Data and calculate distribution
    const attendanceData = apiData.attendanceReport || [];
    const attendanceSummary = { present: 0, absent: 0, late: 0, half_day: 0 };
    
    attendanceData.forEach(record => {
        if (attendanceSummary[record.status] !== undefined) {
            attendanceSummary[record.status]++;
        } else {
            attendanceSummary[record.status] = 1; // Catch anything else
        }
        // Also count as "Late" if they were present but late
        if (record.late_minutes > 0) attendanceSummary.late++;
    });

    const attendancePieData = [
        { name: 'Present', value: attendanceSummary.present },
        { name: 'Absent', value: attendanceSummary.absent },
        { name: 'Half Day', value: attendanceSummary.half_day || 0 }
    ].filter(d => d.value > 0);

    // ✅ Extract Performance Data and calculate leaderboard stats
    const performanceData = apiData.performanceReport || [];
    const topPerformer = performanceData.length > 0 ? performanceData[0] : null;
    const totalTeamServices = performanceData.reduce((sum, r) => sum + r.total_services, 0);
    const activeContributors = performanceData.filter(r => r.total_services > 0).length;

    // ✅ Extract Salary Data and calculate total payroll
    const salaryData = apiData.salaryReport || [];
    const salarySummary = { 
        totalPayroll: 0, 
        totalDeductions: 0, 
        pendingPayouts: 0 
    };

    // ✅ Extract Incentive Data
    const incentiveData = apiData.incentiveReport || [];
    const totalSuggestedBonus = incentiveData.reduce((sum, r) => sum + r.suggested_bonus, 0);

        salaryData.forEach(s => {
        salarySummary.totalPayroll += s.net_salary;
        salarySummary.totalDeductions += s.deductions;
        if (s.status === 'pending') salarySummary.pendingPayouts++;
    });

    // ✅ Extract Review Data and calculate averages/distribution
    const reviewData = apiData.reviewReport || [];
    let totalServiceStars = 0, totalStaffStars = 0, ratedStaffCount = 0;
    const ratingDist = { 5:0, 4:0, 3:0, 2:0, 1:0 };

    reviewData.forEach(r => {
        totalServiceStars += r.service_rating;
        if (r.staff_rating > 0) {
            totalStaffStars += r.staff_rating;
            ratedStaffCount++;
        }
        if (r.service_rating >= 1 && r.service_rating <= 5) {
            ratingDist[r.service_rating]++;
        }
    });

    const reviewSummary = {
        count: reviewData.length,
        avgService: reviewData.length > 0 ? (totalServiceStars / reviewData.length).toFixed(1) : 0,
        avgStaff: ratedStaffCount > 0 ? (totalStaffStars / ratedStaffCount).toFixed(1) : 0
    };

    const reviewChartData = [
        { stars: '5 Stars', count: ratingDist[5], fill: '#10B981' }, // Emerald
        { stars: '4 Stars', count: ratingDist[4], fill: '#34D399' },
        { stars: '3 Stars', count: ratingDist[3], fill: '#FBBF24' }, // Amber
        { stars: '2 Stars', count: ratingDist[2], fill: '#F87171' }, // Rose
        { stars: '1 Star',  count: ratingDist[1], fill: '#EF4444' },
    ];

    // ✅ ADD THIS: Extract Leave Data and calculate distribution
    const leaveData = apiData.leaveReport || [];
    const leaveSummary = { total_days: 0, pending: 0, approved: 0, rejected: 0 };
    
    leaveData.forEach(l => {
        leaveSummary.total_days += l.days_taken;
        if (leaveSummary[l.status] !== undefined) leaveSummary[l.status]++;
    });

    const leaveStatusChart = [
        { name: 'Approved', value: leaveSummary.approved, fill: '#10B981' }, // Emerald
        { name: 'Pending', value: leaveSummary.pending, fill: '#F59E0B' },   // Amber
        { name: 'Rejected', value: leaveSummary.rejected, fill: '#EF4444' }  // Rose
    ].filter(d => d.value > 0);

    // ✅ Extract Service Profit Data
    const serviceProfitData = apiData.serviceProfit || [];
    const profitSummary = { 
        totalProfit: 0, 
        totalServices: serviceProfitData.length,
        mostProfitable: serviceProfitData.length > 0 ? serviceProfitData[0] : null
    };
    
    serviceProfitData.forEach(s => {
        profitSummary.totalProfit += s.gross_profit;
    });
    
    // ✅ Check if the report includes "Today" - bcz today wallet daily balances will close on tmrw 12.05 am
    const todayStr = new Date().toISOString().split('T')[0];
    const includesToday = previewData?.metadata?.toDate === todayStr;

    // ✅ Smart Trend Calculator
    const periodTrendRaw = apiData.financials?.periodTrend || [];
    let displayTrend = [];

    if (periodTrendRaw.length > 31) {
        // If the date range is huge (e.g. Yearly), automatically group the daily data into Months!
        const monthlyGroups = {};
        periodTrendRaw.forEach(pt => {
            const date = new Date(pt.label);
            const monthKey = date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
            if (!monthlyGroups[monthKey]) monthlyGroups[monthKey] = { label: monthKey, revenue: 0, expenses: 0, profit: 0, grossProfit: 0 }; // 👈 Added grossProfit
            monthlyGroups[monthKey].revenue += pt.revenueCollected;
            monthlyGroups[monthKey].expenses += pt.operatingExpenses;
            monthlyGroups[monthKey].profit += pt.netProfit;
            monthlyGroups[monthKey].grossProfit += (pt.grossProfit || 0); // 👈 Added grossProfit
        });
        displayTrend = Object.values(monthlyGroups);
    } else {
        // If the range is a month or less, show the exact Days!
        displayTrend = periodTrendRaw.map(pt => ({
            label: new Date(pt.label).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
            revenue: pt.revenueCollected,
            expenses: pt.operatingExpenses,
            profit: pt.netProfit,
            grossProfit: pt.grossProfit || 0 // 👈 Added grossProfit
        }));
    }
    
    // Note: V3 Analytics returns 'monthly', not 'monthlyTrend'
    const monthlyTrendRaw = apiData.financials?.monthly || {}; 

    // Extract and format the live wallet data for the Pie Chart
    const rawWallets = apiData.wallets || [];
    const walletDistribution = rawWallets.map(w => ({
        name: w.wallet_type ? w.wallet_type.charAt(0).toUpperCase() + w.wallet_type.slice(1) : 'Unknown',
        value: Number(w.total_balance || 0)
    })).filter(w => w.value > 0); 

    // 2. TRANSFORM MONTHLY TREND FOR RECHARTS
    const monthlyTrend = monthlyTrendRaw.revenueCollected ? 
        monthlyTrendRaw.revenueCollected.map((rev, i) => ({
            month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
            revenue: rev,
            expenses: monthlyTrendRaw.operatingExpenses[i] || 0
        })).filter(m => m.revenue > 0 || m.expenses > 0)
        : [];

    // 3. SAFE FALLBACKS FOR UN-WIRED TABS 
    // We use mock data here temporarily so the Data/Charts tabs don't throw .map() errors!
    const fallbackWallets = [
        { name: 'Cash', value: 85000 },
        { name: 'Bank', value: 465000 },
        { name: 'Digital', value: 210000 },
    ];
    const fallbackServices = [
        { name: 'Photocopy', revenue: 320000 },
        { name: 'Printing', revenue: 280000 },
    ];

    return (
        <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" />

            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="fixed top-0 right-0 h-full bg-white shadow-lg z-50 flex flex-col w-full max-w-4xl">
                {/* Header */}
                <div className="border-b border-gray-200 bg-gray-50/80">
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center space-x-2">
                            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <FiArrowLeft className="h-4 w-4 text-gray-600" />
                            </button>
                            <div>
                                <h2 className="text-base font-bold text-gray-900">{report?.name}</h2>
                                <p className="text-xs text-gray-600">{report?.description}</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button onClick={() => onExport?.('pdf', report)} className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm">
                                <FiDownload className="h-4 w-4" /><span>Export PDF</span>
                            </button>
                            <button onClick={() => onExport?.('excel', report)} className="flex items-center space-x-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm">
                                <FiFileText className="h-4 w-4" /><span>Excel</span>
                            </button>
                            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <FiX className="h-4 w-4 text-gray-600" />
                            </button>
                        </div>
                    </div>

                    <div className="flex px-4 space-x-1">
                        {['preview', 'data', 'charts'].map((tab) => (
                            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {!previewData ? (
                        <div className="flex justify-center items-center h-full text-gray-500">Loading preview data...</div>
                    ) : activeTab === 'preview' && (
                        <div className="space-y-6">
                            
                            {/* V3 Financial Summary Cards (Now Guaranteed to Render) */}
                            {Object.keys(financials).length > 0 && (
                                <div className="grid grid-cols-4 gap-3">
                                    <StatCard title="Revenue Collected" value={`₹${(financials.revenueCollected || 0).toLocaleString()}`} subtitle="Selected Period" icon={FiTrendingUp} color="bg-emerald-600" />
                                    <StatCard title="Operating Expenses" value={`₹${(financials.operatingExpenses || 0).toLocaleString()}`} subtitle="Selected Period" icon={FiFileText} color="bg-rose-600" />
                                    <StatCard title="Net Profit" value={`₹${(financials.netProfit || 0).toLocaleString()}`} subtitle="Selected Period" icon={FiDollarSign} color="bg-indigo-600" />
                                </div>
                            )}

                            {/* V3 Staff Summary Cards */}
                            {Object.keys(staffData).length > 0 && (
                                <div className="grid grid-cols-3 gap-3">
                                    <StatCard title="Total Staff" value={staffData.total_staff || 0} subtitle="Active" icon={FiUsers} color="bg-blue-600" />
                                    <StatCard title="Present Today" value={staffData.present_today || 0} subtitle="Clocked In" icon={FiUserCheck} color="bg-emerald-600" />
                                </div>
                            )}

                            {/* Dynamic Trend Chart */}
                            {monthlyTrend.length > 0 && (
                                <div className="bg-white rounded-lg border border-gray-200 p-4 mt-6">
                                    <h3 className="font-semibold text-gray-900 text-sm mb-3">Revenue vs Expenses Trend</h3>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <BarChart data={monthlyTrend}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                                            <Tooltip 
                                                isAnimationActive={false} 
                                                formatter={(value) => `₹${value.toLocaleString('en-IN')}`} 
                                            />
                                            <Legend />
                                            <Bar dataKey="revenue" name="Revenue Collected" fill="#6366F1" radius={[2, 2, 0, 0]} />
                                            <Bar dataKey="expenses" name="Operating Expenses" fill="#EF4444" radius={[2, 2, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Service Revenue Chart */}
                            {serviceRevenueData.length > 0 && (
                                <div className="bg-white rounded-lg border border-gray-200 p-4 mt-6">
                                    <h3 className="font-semibold text-gray-900 text-sm mb-3">Top Services by Revenue</h3>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <BarChart data={serviceRevenueData.slice(0, 10)}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                            <XAxis dataKey="service_name" tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                                            <Tooltip 
                                                isAnimationActive={false} 
                                                formatter={(value) => `₹${value.toLocaleString('en-IN')}`} 
                                            />
                                            <Legend />
                                            <Bar dataKey="revenue_collected" name="Revenue" fill="#10B981" radius={[2, 2, 0, 0]} />
                                            <Bar dataKey="gross_profit" name="Net Profit" fill="#6366F1" radius={[2, 2, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Expense Category Chart */}
                            {expenseData.length > 0 && (
                                <div className="bg-white rounded-lg border border-gray-200 p-4 mt-6">
                                    <h3 className="font-semibold text-gray-900 text-sm mb-3">Expenses by Category</h3>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <BarChart data={expenseData} layout="vertical" margin={{ left: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                                            <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={100} />
                                            <Tooltip 
                                                isAnimationActive={false} 
                                                formatter={(value) => `₹${value.toLocaleString('en-IN')}`} 
                                            />
                                            <Legend />
                                            <Bar dataKey="amount" name="Total Spent" fill="#EF4444" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {report?.id === 6 && cashFlowData.length > 0 && (
                                <div className="bg-white rounded-lg border border-gray-200 p-4 mt-6">
                                    <h3 className="font-semibold text-gray-900 text-sm mb-3">Daily Cash Flow Trend</h3>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <ComposedChart data={cashFlowData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                            <XAxis 
                                                dataKey="date" 
                                                tick={{ fontSize: 11 }} 
                                                tickFormatter={(tick) => new Date(tick).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} 
                                            />
                                            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                                            <Tooltip 
                                                isAnimationActive={false} 
                                                labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                                formatter={(value) => `₹${value.toLocaleString('en-IN')}`} 
                                            />
                                            <Legend />
                                            <Bar dataKey="inflow" name="Cash Inflow" fill="#10B981" radius={[2, 2, 0, 0]} />
                                            <Bar dataKey="outflow" name="Cash Outflow" fill="#EF4444" radius={[2, 2, 0, 0]} />
                                            <Line type="monotone" dataKey="net_flow" name="Net Flow" stroke="#6366F1" strokeWidth={2} dot={{ r: 3 }} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Ledger Report Preview Summary */}
                            {report?.id === 7 && ledgerData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <StatCard title="Total Transactions" value={ledgerSummary.count} subtitle="Selected Period" icon={FiActivity} color="bg-blue-600" />
                                        <StatCard title="Total Credit (In)" value={`₹${ledgerSummary.credit.toLocaleString('en-IN')}`} subtitle="Selected Period" icon={FiTrendingUp} color="bg-emerald-600" />
                                        <StatCard title="Total Debit (Out)" value={`₹${ledgerSummary.debit.toLocaleString('en-IN')}`} subtitle="Selected Period" icon={FiTrendingDown} color="bg-rose-600" />
                                    </div>
                                    <div className="bg-white rounded-lg border border-gray-200 p-4 mt-6">
                                        <h3 className="font-semibold text-gray-900 text-sm mb-3">Transaction Volume by Category</h3>
                                        <ResponsiveContainer width="100%" height={250}>
                                            <BarChart data={ledgerCategoryChart}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                                                <Tooltip 
                                                    isAnimationActive={false} 
                                                    formatter={(value) => `₹${value.toLocaleString('en-IN')}`} 
                                                />
                                                <Bar dataKey="value" name="Total Volume" fill="#6366F1" radius={[2, 2, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </>
                            )}

                            {/* Pending Collections Preview Summary */}
                            {report?.id === 8 && pendingCollectionsData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <StatCard title="Total Outstanding" value={`₹${pendingSummary.totalDue.toLocaleString('en-IN')}`} subtitle="From Selected Period" icon={FiClock} color="bg-amber-600" />
                                        <StatCard title="Pending Customers" value={pendingSummary.count} subtitle="With Unpaid Balances" icon={FiUsers} color="bg-rose-600" />
                                    </div>
                                    <div className="bg-white rounded-lg border border-gray-200 p-4 mt-6">
                                        <h3 className="font-semibold text-gray-900 text-sm mb-3">Top 10 Highest Pending Balances</h3>
                                        <ResponsiveContainer width="100%" height={250}>
                                            <BarChart data={pendingCollectionsData.slice(0, 10)} layout="vertical" margin={{ left: 30 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                                                <YAxis type="category" dataKey="customer_name" tick={{ fontSize: 11 }} width={100} />
                                                <Tooltip 
                                                    isAnimationActive={false} 
                                                    formatter={(value) => `₹${value.toLocaleString('en-IN')}`} 
                                                />
                                                <Bar dataKey="balance_due" name="Balance Due" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </>
                            )}

                            {/* Performance Report Preview Summary */}
                            {report?.id === 10 && performanceData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        {/* Golden Top Performer Card */}
                                        <StatCard 
                                            title="Top Performer" 
                                            value={topPerformer?.staff_name || '-'} 
                                            subtitle={`₹${(topPerformer?.total_revenue || 0).toLocaleString('en-IN')} Generated`} 
                                            icon={FiAward} 
                                            color="bg-amber-500" 
                                        />
                                        <StatCard title="Team Services" value={totalTeamServices} subtitle="Successfully Completed" icon={FiCheckCircle} color="bg-emerald-600" />
                                        <StatCard title="Active Contributors" value={activeContributors} subtitle="Staff Generated Revenue" icon={FiUsers} color="bg-blue-600" />
                                    </div>
                                    <div className="bg-white rounded-lg border border-gray-200 p-4 mt-6">
                                        <h3 className="font-semibold text-gray-900 text-sm mb-3">Revenue by Staff Member</h3>
                                        <ResponsiveContainer width="100%" height={250}>
                                            <BarChart data={performanceData.filter(d => d.total_revenue > 0)}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                <XAxis dataKey="staff_name" tick={{ fontSize: 11 }} />
                                                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                                                <Tooltip 
                                                    isAnimationActive={false} 
                                                    formatter={(value) => `₹${value.toLocaleString('en-IN')}`} 
                                                />
                                                <Legend />
                                                <Bar dataKey="total_revenue" name="Total Revenue" fill="#10B981" radius={[2, 2, 0, 0]} />
                                                <Bar dataKey="gross_profit" name="Gross Profit" fill="#6366F1" radius={[2, 2, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </>
                            )}

                            {report?.id === 11 && salaryData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <StatCard title="Total Net Payroll" value={`₹${salarySummary.totalPayroll.toLocaleString('en-IN')}`} subtitle="For Selected Months" icon={FiDollarSign} color="bg-indigo-600" />
                                        <StatCard title="Pending Payouts" value={salarySummary.pendingPayouts} subtitle="Awaiting 'Send' Status" icon={FiClock} color="bg-amber-500" />
                                        <StatCard title="Total Deductions" value={`₹${salarySummary.totalDeductions.toLocaleString('en-IN')}`} subtitle="Recovered / Withheld" icon={FiTrendingDown} color="bg-rose-600" />
                                    </div>
                                    <div className="bg-white rounded-lg border border-gray-200 p-4 mt-6">
                                        <h3 className="font-semibold text-gray-900 text-sm mb-3">Net Salary Distribution</h3>
                                        <ResponsiveContainer width="100%" height={250}>
                                            <BarChart data={salaryData.slice(0, 15)} layout="vertical" margin={{ left: 30 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                                                <YAxis type="category" dataKey="staff_name" tick={{ fontSize: 11 }} width={100} />
                                                <Tooltip 
                                                    isAnimationActive={false} 
                                                    formatter={(value) => `₹${value.toLocaleString('en-IN')}`} 
                                                />
                                                <Bar dataKey="net_salary" name="Net Salary" fill="#6366F1" radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </>
                            )}

                            {/* Incentive Report Preview Summary */}
                            {report?.id === 12 && incentiveData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <StatCard title="Total Suggested Bonuses" value={`₹${totalSuggestedBonus.toLocaleString('en-IN')}`} subtitle="If 100% approved" icon={FiStar} color="bg-amber-500" />
                                        <StatCard title="Highest KPI Score" value={`${incentiveData[0]?.incentive_score || 0}/100`} subtitle={`Achieved by ${incentiveData[0]?.staff_name}`} icon={FiAward} color="bg-indigo-600" />
                                    </div>
                                    <div className="bg-white rounded-lg border border-gray-200 p-4 mt-6">
                                        <h3 className="font-semibold text-gray-900 text-sm mb-3">Staff KPI Scores (Performance & Efficiency)</h3>
                                        <ResponsiveContainer width="100%" height={250}>
                                            <BarChart data={incentiveData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                <XAxis dataKey="staff_name" tick={{ fontSize: 11 }} />
                                                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                                                <Tooltip isAnimationActive={false} />
                                                <Bar dataKey="incentive_score" name="KPI Score (out of 100)" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </>
                            )}

                            {/* Review Report Preview Summary */}
                            {report?.id === 13 && reviewData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <StatCard title="Total Reviews" value={reviewSummary.count} subtitle="In Selected Period" icon={FiFileText} color="bg-blue-600" />
                                        <StatCard title="Avg Service Rating" value={`${reviewSummary.avgService} / 5`} subtitle="Overall Satisfaction" icon={FiStar} color="bg-amber-500" />
                                        <StatCard title="Avg Staff Rating" value={`${reviewSummary.avgStaff} / 5`} subtitle="Staff Performance" icon={FiUsers} color="bg-indigo-600" />
                                    </div>
                                    <div className="bg-white rounded-lg border border-gray-200 p-4 mt-6">
                                        <h3 className="font-semibold text-gray-900 text-sm mb-3">Service Rating Distribution</h3>
                                        <ResponsiveContainer width="100%" height={250}>
                                            <BarChart data={reviewChartData} layout="vertical" margin={{ left: 30 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                                                <YAxis type="category" dataKey="stars" tick={{ fontSize: 11 }} width={60} />
                                                <Tooltip isAnimationActive={false} />
                                                <Bar dataKey="count" name="Number of Reviews" radius={[0, 4, 4, 0]}>
                                                    {reviewChartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </>
                            )}

                            {/* Leave Report Preview Summary */}
                            {report?.id === 14 && leaveData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <StatCard title="Total Leave Days" value={leaveSummary.total_days} subtitle="Requested in Period" icon={FiCalendarIcon} color="bg-indigo-600" />
                                        <StatCard title="Pending Approvals" value={leaveSummary.pending} subtitle="Action Required" icon={FiClock} color="bg-amber-500" />
                                        <StatCard title="Approved Leaves" value={leaveSummary.approved} subtitle="Authorized Absences" icon={FiCheckCircle} color="bg-emerald-600" />
                                    </div>
                                    <div className="bg-white rounded-lg border border-gray-200 p-4 mt-6 flex flex-col md:flex-row items-center">
                                        <div className="w-full md:w-1/2">
                                            <h3 className="font-semibold text-gray-900 text-sm mb-3">Leave Approval Status</h3>
                                            <ResponsiveContainer width="100%" height={250}>
                                                <PieChart>
                                                    <Pie 
                                                        data={leaveStatusChart}
                                                        dataKey="value" 
                                                        nameKey="name" 
                                                        cx="50%" cy="50%" 
                                                        innerRadius={50} outerRadius={80} 
                                                        paddingAngle={2} cornerRadius={4}
                                                    >
                                                        {leaveStatusChart.map((entry, idx) => (
                                                            <Cell key={idx} fill={entry.fill} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip isAnimationActive={false} />
                                                    <Legend />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Service Profit Preview Summary */}
                            {report?.id === 16 && serviceProfitData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <StatCard title="Total Service Profit" value={`₹${profitSummary.totalProfit.toLocaleString('en-IN')}`} subtitle="Across all completed services" icon={FiTrendingUp} color="bg-indigo-600" />
                                        <StatCard title="Most Profitable Service" value={profitSummary.mostProfitable?.service_name || '-'} subtitle={`Generated ₹${(profitSummary.mostProfitable?.gross_profit || 0).toLocaleString('en-IN')}`} icon={FiAward} color="bg-emerald-600" />
                                    </div>
                                    <div className="bg-white rounded-lg border border-gray-200 p-4 mt-6">
                                        <h3 className="font-semibold text-gray-900 text-sm mb-3">Top 10 Most Profitable Services</h3>
                                        <ResponsiveContainer width="100%" height={250}>
                                            <BarChart data={serviceProfitData.slice(0, 10)}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                <XAxis dataKey="service_name" tick={{ fontSize: 11 }} tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val} />
                                                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                                                <Tooltip 
                                                    isAnimationActive={false} 
                                                    formatter={(value) => `₹${value.toLocaleString('en-IN')}`} 
                                                />
                                                <Bar dataKey="gross_profit" name="Gross Profit" fill="#6366F1" radius={[2, 2, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    
                    {/* DATA TAB - LIVE RENDERING */}
                    {activeTab === 'data' && (
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            
                            {/* ✅ NEW: Service Profit Table */}
                            {report?.id === 16 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Service Name</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Requests</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Revenue Collected</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Govt/Dept Charges</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Gross Profit</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {serviceProfitData.length > 0 ? (
                                                serviceProfitData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                            <div className="flex items-center">
                                                                {idx === 0 && <FiAward className="h-4 w-4 text-amber-500 mr-2" />}
                                                                {row.service_name}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-600 text-center">{row.total_requests}</td>
                                                        <td className="px-4 py-3 text-sm text-emerald-600 text-right">₹{row.revenue_collected.toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 text-sm text-rose-600 text-right">- ₹{row.department_charges.toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 text-sm text-indigo-600 text-right font-bold bg-indigo-50/30">
                                                            ₹{row.gross_profit.toLocaleString('en-IN')}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="px-4 py-12 text-center">
                                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                            <FiBriefcase className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                        <h3 className="text-sm font-medium text-gray-900 mb-1">No Services Completed</h3>
                                                        <p className="text-xs text-gray-500">No profitable services were recorded in this period.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : report?.id === 14 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Staff Name</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Leave Details</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Duration</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {leaveData.length > 0 ? (
                                                leaveData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <p className="text-sm font-bold text-gray-900">{row.staff_name}</p>
                                                            <p className="text-[10px] text-gray-500 capitalize">{row.role}</p>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center mb-1">
                                                                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mr-2">
                                                                    {row.leave_type}
                                                                </span>
                                                                <span className="text-xs text-gray-400">Applied: {new Date(row.applied_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                                                            </div>
                                                            <p className="text-sm text-gray-600 max-w-xs truncate" title={row.reason}>"{row.reason}"</p>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p className="text-sm font-medium text-gray-900">
                                                                {new Date(row.from_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })} 
                                                                {row.days_taken > 1 && ` to ${new Date(row.to_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                                                            </p>
                                                            <p className="text-xs text-gray-500">{row.days_taken} {row.days_taken === 1 ? 'Day' : 'Days'}</p>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold tracking-wider ${
                                                                row.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                                                                row.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                                                                'bg-amber-100 text-amber-800'
                                                            }`}>
                                                                {row.status.toUpperCase()}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="4" className="px-4 py-12 text-center">
                                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                            <FiCalendarIcon className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                        <h3 className="text-sm font-medium text-gray-900 mb-1">No Leave Applications</h3>
                                                        <p className="text-xs text-gray-500">No staff took or applied for leave during the selected period.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : report?.id === 13 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-32">Date</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-48">Customer Info</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-48">Service & Staff</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-32">Ratings</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Feedback Comments</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {reviewData.length > 0 ? (
                                                reviewData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-xs text-gray-500">
                                                            {new Date(row.date).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p className="text-sm font-bold text-gray-900">{row.customer_name}</p>
                                                            <p className="text-xs text-gray-500">{row.phone}</p>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p className="text-sm font-medium text-gray-900 truncate max-w-[180px]">{row.service_name}</p>
                                                            <p className="text-xs text-gray-500">by {row.staff_name}</p>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex items-center justify-center text-amber-500 font-bold text-sm">
                                                                {row.service_rating} <FiStarIcon className="ml-1 h-3 w-3 fill-amber-500" />
                                                            </div>
                                                            {row.staff_rating > 0 && (
                                                                <div className="text-[10px] text-gray-400 mt-0.5">Staff: {row.staff_rating} ⭐</div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-700 italic">
                                                            "{row.review_text}"
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="px-4 py-12 text-center">
                                                        <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                            <FiStarIcon className="h-5 w-5 text-amber-500 fill-amber-500" />
                                                        </div>
                                                        <h3 className="text-sm font-medium text-gray-900 mb-1">No Reviews Yet</h3>
                                                        <p className="text-xs text-gray-500">No customers submitted reviews during the selected period.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : report?.id === 12 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Staff Name</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Services</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Service Charge (Profit)</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Avg Rating</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">KPI Score</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Suggested Bonus</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {incentiveData.length > 0 ? (
                                                incentiveData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-sm text-gray-900 font-bold">{row.staff_name}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-600 text-center">{row.services_completed}</td>
                                                        <td className="px-4 py-3 text-sm text-emerald-600 text-right font-medium">₹{row.service_charge_earned.toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-600 text-center">
                                                            {row.avg_staff_rating > 0 ? (
                                                                <span className="flex items-center justify-center text-amber-500 font-bold">
                                                                    {row.avg_staff_rating} <FiStarIcon className="ml-1 h-3 w-3 fill-amber-500" />
                                                                </span>
                                                            ) : <span className="text-gray-400 text-xs">No Ratings</span>}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`inline-flex items-center justify-center w-10 h-6 rounded text-xs font-bold ${
                                                                row.incentive_score >= 80 ? 'bg-emerald-100 text-emerald-800' :
                                                                row.incentive_score >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                                            }`}>
                                                                {row.incentive_score}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-indigo-600 text-right font-bold">
                                                            ₹{row.suggested_bonus.toLocaleString('en-IN')}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="6" className="px-4 py-12 text-center">
                                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                            <FiStar className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                        <h3 className="text-sm font-medium text-gray-900 mb-1">No Incentive Data</h3>
                                                        <p className="text-xs text-gray-500">Staff must complete services and collect payments to generate KPI scores.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : report?.id === 11 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Month</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Staff Name</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Attendance</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Basic + Allowances</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Deductions</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Net Salary</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {salaryData.length > 0 ? (
                                                salaryData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-sm text-gray-900 font-bold">{row.month}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                            {row.staff_name}
                                                            <div className="text-[10px] text-gray-400 capitalize font-normal mt-0.5">{row.role}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-600 text-center">
                                                            {row.present_days} / {row.working_days}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-600 text-right">
                                                            <div>₹{row.basic.toLocaleString('en-IN')} Basic</div>
                                                            <div className="text-xs text-gray-400">+ ₹{row.total_allowances.toLocaleString('en-IN')} Allw</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-rose-600 text-right font-medium">
                                                            - ₹{row.deductions.toLocaleString('en-IN')}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-indigo-600 text-right font-bold">
                                                            ₹{row.net_salary.toLocaleString('en-IN')}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                                                                row.status === 'sent' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                                            }`}>
                                                                {row.status.toUpperCase()}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="7" className="px-4 py-12 text-center">
                                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                            <FiDollarSign className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                        <h3 className="text-sm font-medium text-gray-900 mb-1">No Salary Records</h3>
                                                        <p className="text-xs text-gray-500">No salaries were generated for the selected months.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : report?.id === 10 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Staff Name</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Services Completed</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Revenue</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Gross Profit</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {performanceData.length > 0 ? (
                                                performanceData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                            <div className="flex items-center">
                                                                {/* Optional: Add a little trophy to #1! */}
                                                                {idx === 0 && row.total_services > 0 && <FiAward className="h-4 w-4 text-amber-500 mr-2" />}
                                                                {row.staff_name}
                                                                <span className="ml-2 text-[10px] text-gray-400 capitalize font-normal">({row.role})</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-600 text-center">{row.total_services}</td>
                                                        <td className="px-4 py-3 text-sm text-emerald-600 text-right font-medium">₹{row.total_revenue.toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 text-sm text-indigo-600 text-right font-bold">₹{row.gross_profit.toLocaleString('en-IN')}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="4" className="px-4 py-12 text-center">
                                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                            <FiUsers className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                        <h3 className="text-sm font-medium text-gray-900 mb-1">No Productivity Data</h3>
                                                        <p className="text-xs text-gray-500">No services were completed by staff in this period.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : report?.id === 9 ? (
                                <div className="p-0">
                                    {/* 1. Mathematically group the data by Date before rendering */}
                                    {(() => {
                                        const groupedAttendance = {};
                                        attendanceData.forEach(row => {
                                            if (!groupedAttendance[row.date]) groupedAttendance[row.date] = [];
                                            groupedAttendance[row.date].push(row);
                                        });

                                        return (
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Staff Name</th>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Check In</th>
                                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Check Out</th>
                                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Late (Mins)</th>
                                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Hours</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {Object.keys(groupedAttendance).length > 0 ? (
                                                        Object.entries(groupedAttendance).map(([dateStr, records], groupIdx) => (
                                                            <React.Fragment key={groupIdx}>
                                                                
                                                                {/* 🟦 BEAUTIFUL DATE BANNER ROW */}
                                                                <tr className="bg-indigo-50/60 border-t border-indigo-100">
                                                                    <td colSpan="6" className="px-4 py-2 text-sm font-bold text-indigo-900">
                                                                        <div className="flex items-center">
                                                                            <FiCalendarIcon className="mr-2 h-4 w-4 text-indigo-500" />
                                                                            {new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                                            <span className="ml-3 text-[10px] font-bold text-indigo-600 bg-indigo-100/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                                                {records.length} Staff Logged
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                </tr>

                                                                {/* 🧑‍🤝‍🧑 STAFF ROWS UNDERNEATH THE BANNER */}
                                                                {records.map((row, idx) => (
                                                                    <tr key={`${groupIdx}-${idx}`} className="hover:bg-gray-50 transition-colors">
                                                                        <td className="px-4 py-3 text-sm text-gray-900 font-medium pl-6">
                                                                            {row.staff_name}
                                                                            <span className="ml-2 text-[10px] text-gray-400 capitalize font-normal">({row.role})</span>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-sm">
                                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                                                                                row.status === 'present' ? 'bg-emerald-100 text-emerald-800' : 
                                                                                row.status === 'absent' ? 'bg-rose-100 text-rose-800' : 
                                                                                'bg-amber-100 text-amber-800'
                                                                            }`}>
                                                                                {row.status.toUpperCase()}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-sm text-gray-600 text-center">{row.check_in}</td>
                                                                        <td className="px-4 py-3 text-sm text-gray-600 text-center">{row.check_out}</td>
                                                                        <td className={`px-4 py-3 text-sm text-right font-medium ${row.late_minutes > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                                                                            {row.late_minutes > 0 ? `${row.late_minutes}m` : '-'}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-sm text-indigo-600 text-right font-bold">
                                                                            {row.total_hours > 0 ? `${row.total_hours} hrs` : '-'}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </React.Fragment>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan="6" className="px-4 py-12 text-center">
                                                                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                                    <FiUsers className="h-5 w-5 text-gray-400" />
                                                                </div>
                                                                <h3 className="text-sm font-medium text-gray-900 mb-1">No Attendance Records</h3>
                                                                <p className="text-xs text-gray-500">No staff punched in during the selected period.</p>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        );
                                    })()}
                                </div>
                            ) : report?.id === 8 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Contact</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Service</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Charges</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Balance Due</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {pendingCollectionsData.length > 0 ? (
                                                pendingCollectionsData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                            {row.customer_name}
                                                            <div className="text-[10px] text-gray-400 font-normal mt-0.5">Token: {row.token_id}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-600">{row.phone}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-600">{row.service_name}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-500 text-right">₹{row.total_charges.toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 text-sm text-amber-600 text-right font-bold">
                                                            ₹{row.balance_due.toLocaleString('en-IN')}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="px-4 py-12 text-center">
                                                        <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                            <FiCheckCircle className="h-5 w-5 text-emerald-500" />
                                                        </div>
                                                        <h3 className="text-sm font-medium text-gray-900 mb-1">No Pending Collections!</h3>
                                                        <p className="text-xs text-gray-500">All services in this period have been fully paid.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : report?.id === 7 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date & Time</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Wallet</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Type</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {ledgerData.length > 0 ? (
                                                ledgerData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-sm text-gray-500">
                                                            {new Date(row.date).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">{row.wallet}</td>
                                                        {/* ✅ NEW: Category with Smart Reversal Badge */}
                                                        <td className="px-4 py-3 text-sm text-gray-600">
                                                            <div className="flex flex-col items-start">
                                                                <span>{row.category}</span>
                                                                {row.isReversal && (
                                                                    <span className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                                                                        Reversal Entry
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-center">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${row.type === 'credit' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                                                {row.type.toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td className={`px-4 py-3 text-sm text-right font-bold ${row.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {row.type === 'credit' ? '+' : '-'}₹{row.amount.toLocaleString('en-IN')}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                                                        Loading ledger data or no transactions found for this period.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : report?.id === 6 ? (
                                <div className="p-0">
                                    {includesToday && (
                                        <div className="m-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start space-x-3">
                                            <FiClock className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                                            <div>
                                                <h4 className="text-sm font-medium text-blue-900">Pending End-of-Day Closing</h4>
                                                <p className="text-xs text-blue-700 mt-1">
                                                    This report relies on End-of-Day snapshots. Today's live transactions will be reflected here after the midnight closing schedule.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Cash Inflow (Credit)</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Cash Outflow (Debit)</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Net Flow</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {cashFlowData.length > 0 ? (
                                                cashFlowData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50">
                                                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                            {new Date(row.date).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-emerald-600 text-right font-medium">₹{row.inflow.toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 text-sm text-rose-600 text-right font-medium">₹{row.outflow.toLocaleString('en-IN')}</td>
                                                        <td className={`px-4 py-3 text-sm text-right font-bold ${row.net_flow >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                                            ₹{row.net_flow.toLocaleString('en-IN')}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                                                        Loading cash flow data or no transactions found for this period.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : report?.id === 5 ? (
                                <div className="p-0">
                                    {includesToday && (
                                        <div className="m-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start space-x-3">
                                            <FiClock className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                                            <div>
                                                <h4 className="text-sm font-medium text-blue-900">Pending End-of-Day Closing</h4>
                                                <p className="text-xs text-blue-700 mt-1">
                                                    Wallet summaries rely on End-of-Day snapshots. Today's live transactions will be reflected here after the midnight closing schedule.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Wallet Name</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Opening Balance</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Credit (In)</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Debit (Out)</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Closing Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {walletSummaryData.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm text-gray-900 font-medium">{row.wallet_name}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600 text-right font-medium">₹{row.opening_balance.toLocaleString('en-IN')}</td>
                                                <td className="px-4 py-3 text-sm text-emerald-600 text-right font-medium">₹{row.credit.toLocaleString('en-IN')}</td>
                                                <td className="px-4 py-3 text-sm text-rose-600 text-right font-medium">₹{row.debit.toLocaleString('en-IN')}</td>
                                                <td className="px-4 py-3 text-sm text-indigo-600 text-right font-bold">₹{row.closing_balance.toLocaleString('en-IN')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                            ) : expenseData.length > 0 ? (
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Expense Category</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Transactions</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Spent</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {expenseData.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm text-gray-900 font-medium">{row.category}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600 text-center">{row.transactions}</td>
                                                <td className="px-4 py-3 text-sm text-rose-600 text-right font-bold">₹{row.amount.toLocaleString('en-IN')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : serviceRevenueData.length > 0 ? (
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Service Name</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Requests</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Revenue Collected</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Gross Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {serviceRevenueData.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm text-gray-900 font-medium">{row.service_name}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600 text-center">{row.total_requests}</td>
                                                <td className="px-4 py-3 text-sm text-emerald-600 text-right font-medium">₹{row.revenue_collected.toLocaleString('en-IN')}</td>
                                                <td className="px-4 py-3 text-sm text-indigo-600 text-right font-bold">₹{row.gross_profit.toLocaleString('en-IN')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                ) : displayTrend.length > 0 ? (
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Revenue Collected</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Gross Profit</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Operating Expenses</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Profit</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {displayTrend.map((row, idx) => {
                                                return (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">{row.label}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-600 text-right font-medium">
                                                            ₹{row.revenue.toLocaleString('en-IN')}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-emerald-600 text-right font-medium">
                                                            ₹{(row.grossProfit || 0).toLocaleString('en-IN')}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-rose-600 text-right font-medium">
                                                            ₹{row.expenses.toLocaleString('en-IN')}
                                                        </td>
                                                        <td className={`px-4 py-3 text-sm text-right font-bold ${row.profit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                                            ₹{row.profit.toLocaleString('en-IN')}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-gray-50 border-t border-gray-200">
                                            <tr>
                                                <td className="px-4 py-3 text-sm font-bold text-gray-900">Total</td>
                                                <td className="px-4 py-3 text-sm font-bold text-gray-600 text-right">
                                                    ₹{displayTrend.reduce((sum, r) => sum + r.revenue, 0).toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-bold text-emerald-600 text-right">
                                                    ₹{displayTrend.reduce((sum, r) => sum + (r.grossProfit || 0), 0).toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-bold text-rose-600 text-right">
                                                    ₹{displayTrend.reduce((sum, r) => sum + r.expenses, 0).toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-bold text-indigo-600 text-right">
                                                    {/* 👇 This is the exact fix for your buggy Net Profit total! */}
                                                    ₹{displayTrend.reduce((sum, r) => sum + r.profit, 0).toLocaleString('en-IN')}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                ) : (
                                <div className="p-12 text-center">
                                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <FiDatabase className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <h3 className="text-sm font-medium text-gray-900 mb-1">No Tabular Data</h3>
                                    <p className="text-xs text-gray-500">Detailed tabular data is not available for this specific report period.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* CHARTS TAB - LIVE RENDERING */}
                    {activeTab === 'charts' && (
                        <div className="space-y-4">
                            
                            {/* ✅ NEW: Expenses by Wallet Chart (Only shows on the Expense Report) */}
                            {report?.id === 4 && expenseWalletDistribution.length > 0 && (
                                <div className="bg-white rounded-lg border border-gray-200 p-4">
                                    <h3 className="font-semibold text-gray-900 text-sm mb-3">Expenses by Source Account</h3>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <PieChart>
                                            <Pie 
                                                data={expenseWalletDistribution}
                                                dataKey="value" 
                                                nameKey="name" 
                                                cx="50%" cy="50%" 
                                                innerRadius={50} outerRadius={80} 
                                                paddingAngle={2} cornerRadius={4}
                                            >
                                                {/* We offset the colors so it looks different from the balance chart */}
                                                {expenseWalletDistribution.map((_, idx) => (
                                                    <Cell key={idx} fill={COLORS[(idx + 2) % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip 
                                                isAnimationActive={false} 
                                                formatter={(value) => `₹${value.toLocaleString('en-IN')}`} 
                                            />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Attendance Distribution Chart */}
                            {report?.id === 9 && attendancePieData.length > 0 && (
                                <div className="bg-white rounded-lg border border-gray-200 p-4">
                                    <h3 className="font-semibold text-gray-900 text-sm mb-3">Overall Attendance Distribution</h3>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <PieChart>
                                            <Pie 
                                                data={attendancePieData}
                                                dataKey="value" 
                                                nameKey="name" 
                                                cx="50%" cy="50%" 
                                                innerRadius={50} outerRadius={80} 
                                                paddingAngle={2} cornerRadius={4}
                                            >
                                                {/* Present: Emerald, Absent: Rose, Half Day: Amber */}
                                                {attendancePieData.map((entry, idx) => (
                                                    <Cell key={idx} fill={
                                                        entry.name === 'Present' ? '#10B981' : 
                                                        entry.name === 'Absent' ? '#EF4444' : 
                                                        '#F59E0B'
                                                    } />
                                                ))}
                                            </Pie>
                                            <Tooltip isAnimationActive={false} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-around text-center">
                                        <div>
                                            <p className="text-xs text-gray-500">Total Late Instances</p>
                                            <p className="text-lg font-bold text-amber-600">{attendanceSummary.late}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* EXISTING: Current Wallet Balances Chart */}
                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                <h3 className="font-semibold text-gray-900 text-sm mb-3">Current Wallet Balances</h3>
                                
                                {walletDistribution.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={250}>
                                        <PieChart>
                                            <Pie 
                                                data={walletDistribution}
                                                dataKey="value" 
                                                nameKey="name" 
                                                cx="50%" cy="50%" 
                                                innerRadius={50} outerRadius={80} 
                                                paddingAngle={2} cornerRadius={4}
                                            >
                                                {walletDistribution.map((_, idx) => (
                                                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip 
                                                isAnimationActive={false} 
                                                formatter={(value) => `₹${value.toLocaleString('en-IN')}`} 
                                            />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="p-10 text-center text-gray-500">
                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <FiPieChart className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <h3 className="text-sm font-medium text-gray-900 mb-1">No Wallet Data</h3>
                                        <p className="text-xs">There are no wallet balances to display.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </>
    );
};

// ─── MAIN REPORTS SECTION ───
const ReportsSection = ({
    centreId,
    isSuperAdmin = false,
    onExport,
    onGenerateReport,
}) => {
    // ─── State ───
    const [previewData, setPreviewData] = useState(null); 
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [period, setPeriod] = useState('monthly');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [selectedCentre, setSelectedCentre] = useState('all');
    const [selectedStaff, setSelectedStaff] = useState('all');
    const [exportFormat, setExportFormat] = useState('pdf');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedReport, setSelectedReport] = useState(null);
    const [favourites, setFavourites] = useState([1, 2, 3]);
    const [scheduledReports, setScheduledReports] = useState([
        { id: 1, name: 'CEO Monthly Report', frequency: 'monthly', recipient: 'ceo@company.com', enabled: true },
        { id: 2, name: 'Weekly Financial Report', frequency: 'weekly', recipient: 'finance@company.com', enabled: true },
        { id: 3, name: 'Attendance Report', frequency: 'weekly', recipient: 'hr@company.com', enabled: false },
        { id: 4, name: 'Daily Closing Report', frequency: 'daily', recipient: 'manager@company.com', enabled: true },
    ]);
    const [recentExports, setRecentExports] = useState([
        { name: 'Financial Report - June.pdf', date: '2026-06-28', size: '2.4 MB' },
        { name: 'Attendance Report.xlsx', date: '2026-06-27', size: '1.1 MB' },
        { name: 'Profit Report.pdf', date: '2026-06-26', size: '3.2 MB' },
        { name: 'Staff Report.xlsx', date: '2026-06-25', size: '1.8 MB' },
    ]);

    // ─── Report Data ───
    const allReports = [
        // Financial Reports
        { id: 1, name: 'Executive Financial Summary', description: 'Revenue, Expenses, Profit, Wallet Balances', category: 'financial', updatedAt: 'Today' },
        { id: 2, name: 'Profit & Loss Statement', description: 'Complete P&L', category: 'financial', updatedAt: 'Today' },
        { id: 3, name: 'Revenue Report', description: 'Revenue by services', category: 'financial', updatedAt: 'Yesterday' },
        { id: 4, name: 'Expense Report', description: 'Category-wise expenses', category: 'financial', updatedAt: 'Yesterday' },
        { id: 5, name: 'Wallet Summary', description: 'Opening, Credit, Debit, Closing', category: 'financial', updatedAt: 'Today' },
        { id: 6, name: 'Cash Flow Report', description: 'Cash movement', category: 'financial', updatedAt: 'Today' },
        { id: 7, name: 'Ledger Report', description: 'All transactions', category: 'financial', updatedAt: 'Yesterday' },
        { id: 8, name: 'Pending Collections', description: 'Pending customer payments', category: 'financial', updatedAt: 'Today' },

        // Staff Reports
        { id: 9, name: 'Attendance Report', description: 'Present, Absent, Late', category: 'staff', updatedAt: 'Today' },
        { id: 10, name: 'Performance Report', description: 'Revenue & productivity', category: 'staff', updatedAt: 'Yesterday' },
        { id: 11, name: 'Salary Report', description: 'Salary calculations', category: 'staff', updatedAt: 'Today' },
        { id: 12, name: 'Incentive Report', description: 'Suggested incentives', category: 'staff', updatedAt: 'Yesterday' },
        { id: 13, name: 'Review Report', description: 'Customer ratings', category: 'staff', updatedAt: 'Today' },
        { id: 14, name: 'Leave Report', description: 'Leave history', category: 'staff', updatedAt: 'Yesterday' },

        // Service Reports
        { id: 15, name: 'Service Revenue', description: 'Revenue by service', category: 'service', updatedAt: 'Today' },
        { id: 16, name: 'Service Profit', description: 'Profit by service', category: 'service', updatedAt: 'Yesterday' },
        { id: 17, name: 'Pending Services', description: 'Pending applications', category: 'service', updatedAt: 'Today' },
        { id: 18, name: 'Completed Services', description: 'Completed applications', category: 'service', updatedAt: 'Today' },
        { id: 19, name: 'Staff-wise Services', description: 'Staff performance', category: 'service', updatedAt: 'Yesterday' },
        { id: 20, name: 'Service Time Analysis', description: 'Average completion time', category: 'service', updatedAt: 'Today' },

        // Customer Reports
        { id: 21, name: 'Customer Summary', description: 'Customer statistics', category: 'customer', updatedAt: 'Today' },
        { id: 22, name: 'New Customers', description: 'Newly registered', category: 'customer', updatedAt: 'Yesterday' },
        { id: 23, name: 'Returning Customers', description: 'Repeat customers', category: 'customer', updatedAt: 'Today' },
        { id: 24, name: 'Customer Activity', description: 'Service history', category: 'customer', updatedAt: 'Yesterday' },
        { id: 25, name: 'Customer Reviews', description: 'Ratings', category: 'customer', updatedAt: 'Today' },

        // Team Reports
        { id: 26, name: 'Team Financial Report', description: 'Revenue & Profit', category: 'team', updatedAt: 'Today' },
        { id: 27, name: 'Team Performance', description: 'Productivity', category: 'team', updatedAt: 'Yesterday' },
        { id: 28, name: 'Team Contribution', description: 'Staff contribution', category: 'team', updatedAt: 'Today' },

        // Centre Reports (Superadmin only)
        { id: 29, name: 'Centre Comparison', description: 'Compare all centres', category: 'centre', updatedAt: 'Today' },
        { id: 30, name: 'Revenue by Centre', description: 'Financial comparison', category: 'centre', updatedAt: 'Yesterday' },
        { id: 31, name: 'Profit by Centre', description: 'Profit comparison', category: 'centre', updatedAt: 'Today' },
        { id: 32, name: 'Attendance by Centre', description: 'Staff attendance', category: 'centre', updatedAt: 'Yesterday' },
        { id: 33, name: 'Service Comparison', description: 'Services handled', category: 'centre', updatedAt: 'Today' },
    ];

    // ─── Filters ───
    const filteredReports = useMemo(() => {
        let reports = allReports;

        // Filter by category (superadmin)
        if (!isSuperAdmin) {
            reports = reports.filter(r => r.category !== 'centre');
        }

        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            reports = reports.filter(r =>
                r.name.toLowerCase().includes(q) ||
                r.description.toLowerCase().includes(q) ||
                r.category.toLowerCase().includes(q)
            );
        }

        return reports;
    }, [allReports, searchQuery, isSuperAdmin]);

    // ─── Group by Category ───
    const groupedReports = useMemo(() => {
        const groups = {};
        filteredReports.forEach(r => {
            if (!groups[r.category]) groups[r.category] = [];
            groups[r.category].push(r);
        });
        return groups;
    }, [filteredReports]);

    // ─── Favourite Reports ───
    const favouriteReports = useMemo(() => {
        return allReports.filter(r => favourites.includes(r.id));
    }, [allReports, favourites]);

    // ─── Handlers ───
    const toggleFavourite = (reportId) => {
        setFavourites(prev =>
            prev.includes(reportId)
                ? prev.filter(id => id !== reportId)
                : [...prev, reportId]
        );
    };

    const toggleScheduled = (scheduleId) => {
        setScheduledReports(prev =>
            prev.map(s =>
                s.id === scheduleId ? { ...s, enabled: !s.enabled } : s
            )
        );
    };

    const handleGenerate = async (overrideFormat = null, specificReport = null) => {
        const targetFormat = overrideFormat || exportFormat;
        const reportToGen = specificReport || selectedReport;
        const selectedIds = reportToGen ? [reportToGen.id] : filteredReports.map(r => r.id);

        const payload = {
            period,
            fromDate,
            toDate,
            centreId: selectedCentre,
            staffId: selectedStaff,
            format: targetFormat,
            reportIds: selectedIds,
        };

        try {
            if (targetFormat === 'preview') setIsPreviewLoading(true);

            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/reports/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Failed to generate report');

            // 1. Handle Preview (JSON)
            if (targetFormat === 'preview') {
                const data = await res.json();
                setPreviewData(data);
                setSelectedReport(reportToGen); // Open the panel
            } 
            // 2. Handle File Download (Blob)
            else {
                const blob = await res.blob();
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                
                // Get filename from header or fallback
                const disposition = res.headers.get('Content-Disposition');
                let filename = `${reportToGen?.name || 'Batch_Report'}_${new Date().toISOString().slice(0,10)}.${targetFormat}`;
                if (disposition && disposition.includes('filename=')) {
                    filename = disposition.split('filename=')[1].replace(/"/g, '');
                }
                
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(downloadUrl);

                // Add to recent exports UI
                const newExport = {
                    name: filename,
                    date: new Date().toISOString().slice(0, 10),
                    size: `${(blob.size / (1024 * 1024)).toFixed(2)} MB`,
                };
                setRecentExports(prev => [newExport, ...prev.slice(0, 9)]);
            }
        } catch (error) {
            console.error("Report generation failed:", error);
            alert("Failed to generate report. Please try again.");
        } finally {
            setIsPreviewLoading(false);
        }
    };

    // ─── Quick Reports Data ───
    const quickReports = [
        { label: "Today's Collection", value: '₹42,500', icon: FiTrendingUp, color: 'bg-emerald-600' },
        { label: "Today's Expenses", value: '₹18,200', icon: FiFileText, color: 'bg-rose-600' },
        { label: "Today's Profit", value: '₹24,300', icon: FiDollarSign, color: 'bg-indigo-600' },
        { label: "Today's Attendance", value: '18/22', icon: FiUserCheck, color: 'bg-blue-600' },
        { label: "Today's Services", value: '47', icon: FiBriefcase, color: 'bg-purple-600' },
        { label: "Today's Pending", value: '₹65,000', icon: FiClock, color: 'bg-amber-600' },
    ];

    // ─── Category Labels ───
    const categoryLabels = {
        financial: { label: 'Financial Reports', icon: FiDollarSign, color: 'text-indigo-600' },
        staff: { label: 'Staff Reports', icon: FiUsers, color: 'text-blue-600' },
        service: { label: 'Service Reports', icon: FiBriefcase, color: 'text-emerald-600' },
        customer: { label: 'Customer Reports', icon: FiUser, color: 'text-purple-600' },
        team: { label: 'Team Reports', icon: FiUsers, color: 'text-amber-600' },
        centre: { label: 'Centre Reports', icon: FiHome, color: 'text-rose-600' },
    };

    return (
        <div className="mb-6">
            {/* ─── HEADER ─── */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center">
                        <FiFileText className="h-5 w-5 mr-2 text-indigo-600" />
                        Reports
                    </h2>
                    <p className="text-gray-600 text-sm mt-1">Generate and export business reports</p>
                </div>
                <button
                    onClick={handleGenerate}
                    className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                    <FiRefreshCw className="h-4 w-4 mr-2" />
                    Generate Selected Reports
                </button>
            </div>

            {/* ─── GLOBAL FILTERS ─── */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 flex items-center text-sm">
                        <FiFilter className="h-4 w-4 mr-2 text-indigo-600" />
                        Global Filters
                    </h3>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <span>Apply filters to all reports</span>
                        <InfoTooltip
                            content="These filters apply to all reports generated from this page. Set your preferred period, centre, staff, and export format."
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                    {/* Period */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Period</label>
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                        >
                            <option value="daily">Today</option>
                            <option value="weekly">This Week</option>
                            <option value="monthly">This Month</option>
                            <option value="quarterly">This Quarter</option>
                            <option value="yearly">This Year</option>
                            <option value="custom">Custom</option>
                        </select>
                    </div>

                    {/* From Date */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">From</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                            disabled={period !== 'custom'}
                        />
                    </div>

                    {/* To Date */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                            disabled={period !== 'custom'}
                        />
                    </div>

                    {/* Centre (Superadmin only) */}
                    {isSuperAdmin && (
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Centre</label>
                            <select
                                value={selectedCentre}
                                onChange={(e) => setSelectedCentre(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                            >
                                <option value="all">All Centres</option>
                                <option value="1">Centre A</option>
                                <option value="2">Centre B</option>
                                <option value="3">Centre C</option>
                            </select>
                        </div>
                    )}

                    {/* Staff */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Staff</label>
                        <select
                            value={selectedStaff}
                            onChange={(e) => setSelectedStaff(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                        >
                            <option value="all">All Staff</option>
                            <option value="1">Rajesh Kumar</option>
                            <option value="2">Priya Singh</option>
                            <option value="3">Amit Verma</option>
                        </select>
                    </div>

                    {/* Export Format */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Export Format</label>
                        <select
                            value={exportFormat}
                            onChange={(e) => setExportFormat(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                        >
                            <option value="pdf">PDF</option>
                            <option value="excel">Excel</option>
                            <option value="csv">CSV</option>
                        </select>
                    </div>
                </div>

                {/* Search */}
                <div className="mt-3 relative">
                    <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search reports by name, description, or category..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                    />
                </div>
            </div>

            {/* ─── QUICK REPORTS ─── */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 flex items-center text-sm">
                        <FiActivity className="h-4 w-4 mr-2 text-indigo-600" />
                        Quick Reports
                    </h3>
                    <span className="text-xs text-gray-500">One-click access to today's key metrics</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {quickReports.map((qr, idx) => (
                        <QuickReportTile
                            key={idx}
                            label={qr.label}
                            value={qr.value}
                            icon={qr.icon}
                            color={qr.color}
                            onClick={() => {
                                // In a real app, this would generate the specific report
                                // For now, we'll just show a preview of the first report
                                const report = allReports.find(r => r.category === 'financial');
                                if (report) setSelectedReport(report);
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* ─── FAVOURITE REPORTS ─── */}
            {favouriteReports.length > 0 && (
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900 flex items-center text-sm">
                            <FiStarIcon className="h-4 w-4 mr-2 text-amber-500 fill-amber-500" />
                            Favourite Reports
                        </h3>
                        <span className="text-xs text-gray-500">One-click access to your most-used reports</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {favouriteReports.map((report) => (
                            <ReportCard
                                key={report.id}
                                report={report}
                                isFavourite={true}
                                onToggleFavourite={toggleFavourite}
                                onClick={() => handleGenerate('preview', report)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* ─── CATEGORIZED REPORTS ─── */}
            {Object.entries(groupedReports).map(([category, reports]) => {
                const meta = categoryLabels[category];
                if (!meta) return null;
                const Icon = meta.icon;

                return (
                    <div key={category} className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-900 flex items-center text-sm">
                                <Icon className={`h-4 w-4 mr-2 ${meta.color}`} />
                                {meta.label}
                            </h3>
                            <span className="text-xs text-gray-500">{reports.length} reports</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {reports.map((report) => (
                                <ReportCard
                                    key={report.id}
                                    report={report}
                                    isFavourite={favourites.includes(report.id)}
                                    onToggleFavourite={toggleFavourite}
                                    onClick={() => handleGenerate('preview', report)}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* ─── SCHEDULED REPORTS ─── */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 flex items-center text-sm">
                        <FiClockIcon className="h-4 w-4 mr-2 text-indigo-600" />
                        Scheduled Reports
                    </h3>
                    <span className="text-xs text-gray-500">Automated email delivery</span>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {scheduledReports.map((schedule) => (
                            <ScheduledReportCard
                                key={schedule.id}
                                schedule={schedule}
                                onToggle={toggleScheduled}
                            />
                        ))}
                    </div>
                    <button className="mt-3 flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
                        <FiPlus className="h-3 w-3 mr-1" />
                        Add Scheduled Report
                    </button>
                </div>
            </div>

            {/* ─── RECENT EXPORTS ─── */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 flex items-center text-sm">
                        <FiDownload className="h-4 w-4 mr-2 text-indigo-600" />
                        Recent Exports
                    </h3>
                    <span className="text-xs text-gray-500">Last 10 exports</span>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">File Name</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {recentExports.map((exp, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-xs text-gray-900 font-medium">{exp.name}</td>
                                    <td className="px-4 py-2 text-xs text-gray-600">{exp.date}</td>
                                    <td className="px-4 py-2 text-xs text-gray-600">{exp.size}</td>
                                    <td className="px-4 py-2 text-right">
                                        <button className="text-indigo-600 hover:text-indigo-800 text-xs font-medium transition-colors">
                                            Download
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ─── REPORT PREVIEW PANEL ─── */}
           <AnimatePresence>
                {selectedReport && (
                    <ReportPreviewPanel
                        report={selectedReport}
                        previewData={previewData}             
                        onClose={() => setSelectedReport(null)}
                        onExport={handleGenerate}            
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default ReportsSection;