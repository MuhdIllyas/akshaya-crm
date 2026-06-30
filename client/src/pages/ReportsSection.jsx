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
    const serviceRevenue = apiData.serviceRevenue || {};

    // ✅ NEW: Smart Trend Calculator
    const periodTrendRaw = apiData.financials?.periodTrend || [];
    let displayTrend = [];

    if (periodTrendRaw.length > 31) {
        // If the date range is huge (e.g. Yearly), automatically group the daily data into Months!
        const monthlyGroups = {};
        periodTrendRaw.forEach(pt => {
            const date = new Date(pt.label);
            const monthKey = date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
            if (!monthlyGroups[monthKey]) monthlyGroups[monthKey] = { label: monthKey, revenue: 0, expenses: 0, profit: 0 };
            monthlyGroups[monthKey].revenue += pt.revenueCollected;
            monthlyGroups[monthKey].expenses += pt.operatingExpenses;
            monthlyGroups[monthKey].profit += pt.netProfit;
        });
        displayTrend = Object.values(monthlyGroups);
    } else {
        // If the range is a month or less, show the exact Days!
        displayTrend = periodTrendRaw.map(pt => ({
            label: new Date(pt.label).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
            revenue: pt.revenueCollected,
            expenses: pt.operatingExpenses,
            profit: pt.netProfit
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
                                            <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
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
                                            <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN')}`} />
                                            <Legend />
                                            <Bar dataKey="revenue_collected" name="Revenue" fill="#10B981" radius={[2, 2, 0, 0]} />
                                            <Bar dataKey="gross_profit" name="Net Profit" fill="#6366F1" radius={[2, 2, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* DATA TAB - LIVE RENDERING */}
                    {activeTab === 'data' && (
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            
                            {/* Service Revenue Table */}
                            {serviceRevenueData.length > 0 ? (
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
                            ) : monthlyTrend.length > 0 ? (
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Month</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Revenue Collected</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Operating Expenses</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {displayTrend.map((row, idx) => {
                                            return (
                                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                    {/* Change row.month to row.label */}
                                                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{row.label}</td>
                                                    <td className="px-4 py-3 text-sm text-emerald-600 text-right font-medium">
                                                        ₹{row.revenue.toLocaleString('en-IN')}
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
                                            <td className="px-4 py-3 text-sm font-bold text-emerald-600 text-right">
                                                ₹{displayTrend.reduce((sum, r) => sum + r.revenue, 0).toLocaleString('en-IN')}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-bold text-rose-600 text-right">
                                                ₹{displayTrend.reduce((sum, r) => sum + r.expenses, 0).toLocaleString('en-IN')}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-bold text-indigo-600 text-right">
                                                ₹{displayTrend.reduce((sum, r) => sum + (r.revenue - r.expenses), 0).toLocaleString('en-IN')}
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
                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                <h3 className="font-semibold text-gray-900 text-sm mb-3">Wallet Distribution</h3>
                                
                                {walletDistribution.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={250}>
                                        <PieChart>
                                            <Pie 
                                                data={walletDistribution} // 👈 Using real data here
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
                                            <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN')}`} />
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