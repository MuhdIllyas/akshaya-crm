import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    FiFileText, FiDownload, FiCalendar, FiFilter, FiSearch,
    FiTrendingUp, FiDollarSign, FiPieChart, FiUsers, FiUser,
    FiBriefcase, FiStar, FiClock, FiCheckCircle, FiX,
    FiArrowLeft, FiPrinter, FiEye, FiRefreshCw, FiPlus,
    FiChevronRight, FiClock as FiClockIcon, FiMail, FiUserPlus,
    FiBarChart2, FiActivity, FiAward, FiHome, FiCreditCard,
    FiSmartphone, FiUserCheck, FiBook, FiDatabase, FiSettings,
    FiStar as FiStarIcon, FiTrendingDown, FiCalendar as FiCalendarIcon
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, LineChart, Line, PieChart, Pie, Cell,
    Legend, ComposedChart, Area, AreaChart
} from 'recharts';
import { toPng } from 'html-to-image';
import { jspdf } from 'jspdf';

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
// ─── Scheduled Report Card ───
const ScheduledReportCard = ({ schedule, onToggle }) => {
    const frequencyColors = {
        daily: 'bg-blue-50 text-blue-700 border-blue-200',
        weekly: 'bg-purple-50 text-purple-700 border-purple-200',
        monthly: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };

    // Safely format the emails array
    const emails = schedule.resolved_emails || [];
    let displayEmails = 'No active users found';
    if (emails.length > 0) {
        // If there are more than 2 emails, show the first 2 and say "+X more"
        displayEmails = emails.length > 2 
            ? `${emails.slice(0, 2).join(', ')} +${emails.length - 2} more`
            : emails.join(', ');
    }

    return (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
            <div className="flex items-center space-x-3 overflow-hidden">
                <div className={`rounded-lg p-2 shrink-0 ${frequencyColors[schedule.frequency] || 'bg-gray-100 text-gray-700'}`}>
                    <FiMail className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{schedule.name}</p>
                    <p className="text-xs text-gray-500 capitalize">
                        {schedule.frequency} • {schedule.recipient_roles?.join(', ')}
                    </p>
                    {/* 👇 The new exact Email ID display 👇 */}
                    <div className="flex items-center mt-1 text-[10px] text-gray-400 font-mono" title={emails.join(', ')}>
                        <FiUserCheck className="mr-1 h-3 w-3 shrink-0" />
                        <span className="truncate">{displayEmails}</span>
                    </div>
                </div>
            </div>
            
            <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                <input
                    type="checkbox"
                    checked={schedule.is_active}
                    onChange={() => onToggle?.(schedule.id)}
                    className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
        </div>
    );
};

// ─── Custom Chart Components ───
const CHART_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

const CustomTooltip = ({ active, payload, label, formatter, labelFormatter }) => {
    if (active && payload && payload.length) {
        const displayLabel = labelFormatter ? labelFormatter(label) : label;
        return (
            <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs min-w-[140px]">
                <p className="font-medium text-gray-700 mb-1">{displayLabel}</p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between gap-4 py-0.5">
                        <span style={{ color: entry.color }} className="font-medium">{entry.name}:</span>
                        <span className="font-bold text-gray-900">
                            {formatter ? formatter(entry.value, entry) : entry.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const formatCurrency = (value) => `₹${value.toLocaleString('en-IN')}`;
const formatDays = (value) => `${value} ${value === 1 ? 'Day' : 'Days'}`;

// ─── Report Preview Panel (Wired to V3 Backend) ───
const ReportPreviewPanel = ({ report, previewData, onClose, onExport }) => {
    const [activeTab, setActiveTab] = useState('preview');
    const COLORS = CHART_COLORS;

    // 👇 1. Create a reference to attach to our report content
    const reportRef = useRef(null);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    // 👇 2. Add the Visual PDF Generator Function
    const generateVisualPDF = async () => {
        if (!reportRef.current) return;
        setIsGeneratingPDF(true);

        try {
            // Take snapshot using native browser rendering (Supports oklch & modern CSS!)
            const dataUrl = await toPng(reportRef.current, {
                pixelRatio: 2, // High resolution for crisp charts
                backgroundColor: '#ffffff'
            });

            // Set up the PDF
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            
            // Get the image properties to maintain the exact aspect ratio
            const imgProps = pdf.getImageProperties(dataUrl);
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            // Add the image to the PDF and download
            pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`${report?.name?.replace(/\s+/g, '_')}_Visual_Report.pdf`);
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate visual PDF.');
        } finally {
            setIsGeneratingPDF(false);
        }
    };

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

    // ✅ ADD THIS: Extract Pending Services Data
    const pendingServicesData = apiData.pendingServices || [];
    const pendingServicesSummary = { pending: 0, in_progress: 0, rejected: 0, totalDays: 0 };
    
    pendingServicesData.forEach(s => {
        if (s.status === 'pending') pendingServicesSummary.pending++;
        else if (s.status === 'in_progress') pendingServicesSummary.in_progress++;
        else pendingServicesSummary.rejected++;
        
        pendingServicesSummary.totalDays += s.days_pending;
    });

    const avgDaysPending = pendingServicesData.length > 0 
        ? Math.round(pendingServicesSummary.totalDays / pendingServicesData.length) 
        : 0;

    const pendingChartData = [
        { name: 'Not Started', value: pendingServicesSummary.pending, fill: '#F59E0B' },   // Amber
        { name: 'In Progress', value: pendingServicesSummary.in_progress, fill: '#6366F1' }, // Indigo
        { name: 'Rejected/Delayed', value: pendingServicesSummary.rejected, fill: '#EF4444' } // Rose
    ].filter(d => d.value > 0);

    // ✅ Extract Completed Services Data
    const completedServicesData = apiData.completedServicesReport || [];
    const completedSummary = {
        total: completedServicesData.length,
        avgDays: completedServicesData.length > 0 
            ? Math.round(completedServicesData.reduce((sum, r) => sum + r.days_taken, 0) / completedServicesData.length)
            : 0
    };
    
    const completedByCategory = {};
    completedServicesData.forEach(r => {
        completedByCategory[r.service_name] = (completedByCategory[r.service_name] || 0) + 1;
    });
    
    const completedChartData = Object.entries(completedByCategory)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10); // Top 10 completed volume

    // ✅ Extract Staff-wise Services Data
    const staffWiseServicesData = apiData.staffWiseServices || [];

    // ✅ Extract Service Time Data
    const serviceTimeData = apiData.serviceTimeReport || [];
    
    // Smart Time Formatter
    const formatDuration = (hours) => {
        if (hours < 1) return '< 1 Hr';
        if (hours < 24) return `${hours.toFixed(1)} Hrs`;
        return `${(hours / 24).toFixed(1)} Days`;
    };

    // Calculate overall averages
    let totalServiceHours = 0, totalServiceVolume = 0;
    serviceTimeData.forEach(r => {
        totalServiceHours += (r.avg_hours * r.total_requests);
        totalServiceVolume += r.total_requests;
    });
    
    const overallAvgHours = totalServiceVolume > 0 ? (totalServiceHours / totalServiceVolume) : 0;
    const slowestService = serviceTimeData.length > 0 ? serviceTimeData[0] : null; // Already sorted DESC by backend
    
    // Convert to days for the Bar Chart so it scales nicely
    const timeChartData = serviceTimeData.slice(0, 10).map(r => ({
        name: r.service_name,
        avg_days: Number((r.avg_hours / 24).toFixed(1))
    }));

    // ✅ Extract Customer Summary Data
    const customerSummaryData = apiData.customerSummary || [];
    const custStats = { total: customerSummaryData.length, registered: 0, walkIn: 0, returning: 0, new: 0 };
    
    customerSummaryData.forEach(c => {
        if (c.is_registered) custStats.registered++; else custStats.walkIn++;
        if (c.is_returning) custStats.returning++; else custStats.new++;
    });

    const registeredChart = [
        { name: 'Portal Registered', value: custStats.registered, fill: '#6366F1' }, // Indigo
        { name: 'Walk-ins', value: custStats.walkIn, fill: '#94A3B8' }               // Slate
    ].filter(d => d.value > 0);

    const returningChart = [
        { name: 'Returning', value: custStats.returning, fill: '#10B981' }, // Emerald
        { name: 'New Customers', value: custStats.new, fill: '#F59E0B' }    // Amber
    ].filter(d => d.value > 0);
    
    // ✅ ADD THIS: Extract Returning Customers Data
    const repeatCustomerData = apiData.repeatCustomers || [];
    const repeatStats = { 
        totalVips: repeatCustomerData.length,
        totalLTV: 0,
        mostFrequent: repeatCustomerData.length > 0 ? repeatCustomerData[0] : null
    };
    
    repeatCustomerData.forEach(c => {
        repeatStats.totalLTV += c.lifetime_spent;
    });

    const avgLTV = repeatStats.totalVips > 0 ? Math.round(repeatStats.totalLTV / repeatStats.totalVips) : 0;

    // ✅ Extract New Customers Data
    const newCustomerData = apiData.newCustomers || [];

    // ✅ Extract Customer Activity Data
    const activityData = apiData.customerActivity || [];
    
    // Generate an Activity Timeline (Services per day)
    const timelineMap = {};
    activityData.forEach(r => {
        const dStr = new Date(r.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        timelineMap[dStr] = (timelineMap[dStr] || 0) + 1;
    });
    
    // Convert to array and reverse it so the chart reads left-to-right chronologically
    const activityTimelineChart = Object.keys(timelineMap)
        .map(key => ({ date: key, volume: timelineMap[key] }))
        .reverse();

    // ✅ Extract Customer Feedback Data
    const feedbackData = apiData.customerFeedback || [];
    const feedbackStats = { total: feedbackData.length, sumStars: 0, fiveStar: 0 };
    const distMap = { 5:0, 4:0, 3:0, 2:0, 1:0 };
    
    feedbackData.forEach(r => {
        feedbackStats.sumStars += r.service_rating;
        if (r.service_rating === 5) feedbackStats.fiveStar++;
        if (distMap[r.service_rating] !== undefined) distMap[r.service_rating]++;
    });

    const avgCentreRating = feedbackStats.total > 0 ? (feedbackStats.sumStars / feedbackStats.total).toFixed(1) : 0;

    const feedbackChartData = [
        { stars: '5 Stars', count: distMap[5], fill: '#10B981' }, // Emerald
        { stars: '4 Stars', count: distMap[4], fill: '#34D399' },
        { stars: '3 Stars', count: distMap[3], fill: '#FBBF24' }, // Amber
        { stars: '2 Stars', count: distMap[2], fill: '#F87171' }, // Rose
        { stars: '1 Star',  count: distMap[1], fill: '#EF4444' }
    ];    

    // ✅ Extract Team Financial Data
    const teamFinData = apiData.teamFinancials || [];
    const teamStats = { totalRev: 0, totalExp: 0, totalNet: 0, topTeam: null };
    
    teamFinData.forEach((t, index) => {
        teamStats.totalRev += t.total_revenue;
        teamStats.totalExp += t.total_expenses;
        teamStats.totalNet += t.net_profit;
        if (index === 0) teamStats.topTeam = t; // Since SQL sorted by Net Profit DESC
    });

    // ✅ Extract Team Performance Data
    const teamPerfData = apiData.teamPerformance || [];
    
    let highestVolumeTeam = null;
    let highestRatedTeam = null;
    let fastestTeam = null;

    if (teamPerfData.length > 0) {
        // Find top volume
        highestVolumeTeam = [...teamPerfData].sort((a, b) => b.total_services - a.total_services)[0];
        // Find highest rated (must have ratings)
        const ratedTeams = teamPerfData.filter(t => t.avg_rating > 0);
        if (ratedTeams.length > 0) {
            highestRatedTeam = [...ratedTeams].sort((a, b) => b.avg_rating - a.avg_rating)[0];
        }
        // Find fastest (must have handled services)
        const activeTeams = teamPerfData.filter(t => t.total_services > 0);
        if (activeTeams.length > 0) {
            fastestTeam = [...activeTeams].sort((a, b) => a.avg_tat_hours - b.avg_tat_hours)[0];
        }
    }

    // Helper to format hours cleanly in the UI
    const formatHoursToText = (hours) => {
        if (hours === 0) return '-';
        if (hours < 1) return '< 1 Hr';
        if (hours < 24) return `${hours.toFixed(1)} Hrs`;
        return `${(hours / 24).toFixed(1)} Days`;
    };

    // ✅ Extract Team Contribution Data
    const teamContribData = apiData.teamContribution || [];
    let topOverallContributor = null;
    
    if (teamContribData.length > 0) {
        // Find the absolute highest earner across all teams
        topOverallContributor = [...teamContribData].sort((a, b) => b.gross_profit - a.gross_profit)[0];
    }

    // 👇 THE CENTRE COMPARISON EXTRACTION 👇
    const centreComparisonData = apiData.centreComparison || [];
    let topRevenueCentre = null;
    let topProfitCentre = null;
    let topVolumeCentre = null;

    if (centreComparisonData.length > 0) {
        topRevenueCentre = [...centreComparisonData].sort((a, b) => b.total_revenue - a.total_revenue)[0];
        topProfitCentre = [...centreComparisonData].sort((a, b) => b.net_profit - a.net_profit)[0];
        topVolumeCentre = [...centreComparisonData].sort((a, b) => b.total_services - a.total_services)[0];
    }

    // 👇 THE REVENUE BY CENTRE EXTRACTION 👇
    const revByCentreData = apiData.revenueByCentre || { summary: [], trend: [] };
    const revCentreSummary = revByCentreData.summary || [];
    
    // Calculate Top Stats
    const totalGlobalRevenue = revCentreSummary.reduce((sum, c) => sum + c.total_revenue, 0);
    const topRevCentreObj = revCentreSummary.length > 0 ? revCentreSummary[0] : null; 
    const avgRevenuePerCentre = revCentreSummary.length > 0 ? Math.round(totalGlobalRevenue / revCentreSummary.length) : 0;

    // Pivot the Trend Data so Recharts can draw multiple lines easily
    const revTrendMap = {};
    const revCentresSet = new Set();
    (revByCentreData.trend || []).forEach(row => {
        const dStr = new Date(row.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        if (!revTrendMap[dStr]) revTrendMap[dStr] = { date: dStr };
        revTrendMap[dStr][row.centre_name] = row.revenue;
        revCentresSet.add(row.centre_name);
    });
    const revTrendChartData = Object.values(revTrendMap);
    const activeRevCentres = Array.from(revCentresSet);

    // 👇 THE PROFIT BY CENTRE EXTRACTION 👇
    const profitByCentreData = apiData.profitByCentre || { summary: [], trend: [] };
    const profitCentreSummary = profitByCentreData.summary || [];
    
    // Calculate Top Stats
    const totalGlobalProfit = profitCentreSummary.reduce((sum, c) => sum + c.net_profit, 0);
    const topProfitCentreObj2 = profitCentreSummary.length > 0 ? profitCentreSummary[0] : null; 
    const profitableCentresCount = profitCentreSummary.filter(c => c.net_profit > 0).length;

    // Pivot the Trend Data so Recharts can draw multiple lines
    const profitTrendMap = {};
    const profitCentresSet = new Set();
    (profitByCentreData.trend || []).forEach(row => {
        const dStr = new Date(row.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        if (!profitTrendMap[dStr]) profitTrendMap[dStr] = { date: dStr };
        profitTrendMap[dStr][row.centre_name] = row.daily_net_profit;
        profitCentresSet.add(row.centre_name);
    });
    const profitTrendChartData = Object.values(profitTrendMap);
    const activeProfitCentres = Array.from(profitCentresSet);

    // 👇 THE ATTENDANCE & SERVICE COMPARISON EXTRACTION 👇
    // 1. Attendance by Centre (ID 32)
    const attByCentreData = apiData.attendanceByCentre || [];
    let topAttendanceCentre = null;
    let mostLateCentre = null;

    if (attByCentreData.length > 0) {
        topAttendanceCentre = [...attByCentreData].sort((a, b) => b.present_days - a.present_days)[0];
        mostLateCentre = [...attByCentreData].sort((a, b) => b.late_mins - a.late_mins)[0];
    }

    // 2. Service Comparison (ID 33)
    const svcCompareDataRaw = apiData.serviceComparison || [];
    
    // We need to pivot the data to build a Stacked Bar Chart for Recharts
    const svcPivotMap = {};
    const svcCategories = new Set();
    
    svcCompareDataRaw.forEach(row => {
        if (!svcPivotMap[row.centre_name]) svcPivotMap[row.centre_name] = { centre_name: row.centre_name, total_volume: 0 };
        svcPivotMap[row.centre_name][row.service_category] = row.volume;
        svcPivotMap[row.centre_name].total_volume += row.volume;
        svcCategories.add(row.service_category);
    });
    
    const svcCompareChartData = Object.values(svcPivotMap).sort((a, b) => b.total_volume - a.total_volume);
    const activeSvcCategories = Array.from(svcCategories);
    const topVolumeCompareCentre = svcCompareChartData.length > 0 ? svcCompareChartData[0] : null;

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

    // ─── Modern Chart Helpers ───
    const renderChartCard = (title, children, icon = FiBarChart2) => (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4">
            <div className="flex items-center space-x-2 mb-3">
                <div className="p-1.5 bg-indigo-50 rounded-lg">
                    <icon className="h-4 w-4 text-indigo-600" />
                </div>
                <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
            </div>
            <div className="w-full h-64">
                {children}
            </div>
        </div>
    );

    const renderGradient = (id, color) => (
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.9} />
            <stop offset="100%" stopColor={color} stopOpacity={0.1} />
        </linearGradient>
    );

    const CustomTooltipComponent = ({ active, payload, label, formatter, labelFormatter }) => {
        if (active && payload && payload.length) {
            const displayLabel = labelFormatter ? labelFormatter(label) : label;
            return (
                <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs min-w-[140px]">
                    <p className="font-medium text-gray-700 mb-1">{displayLabel}</p>
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center justify-between gap-4 py-0.5">
                            <span style={{ color: entry.color }} className="font-medium">{entry.name}:</span>
                            <span className="font-bold text-gray-900">
                                {formatter ? formatter(entry.value, entry) : entry.value}
                            </span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

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
                            <button 
                                onClick={generateVisualPDF} 
                                disabled={isGeneratingPDF || activeTab !== 'preview'}
                                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                                    activeTab !== 'preview' 
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                                title={activeTab !== 'preview' ? "Please switch to the Preview tab to download visual PDF" : "Download PDF"}
                            >
                                <FiDownload className="h-4 w-4" />
                                <span>{isGeneratingPDF ? 'Creating...' : 'Export PDF'}</span>
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

                        <div ref={reportRef} className="space-y-6 bg-white p-4">
                            
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
                            {monthlyTrend.length > 0 && renderChartCard('Revenue vs Expenses Trend', 
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            {renderGradient('revenueGrad', '#6366F1')}
                                            {renderGradient('expenseGrad', '#EF4444')}
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `₹${v/1000}k`} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomTooltipComponent formatter={formatCurrency} />} />
                                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                        <Bar dataKey="revenue" name="Revenue Collected" fill="url(#revenueGrad)" radius={[4, 4, 0, 0]} animationDuration={800} />
                                        <Bar dataKey="expenses" name="Operating Expenses" fill="url(#expenseGrad)" radius={[4, 4, 0, 0]} animationDuration={800} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}

                            {/* Service Revenue Chart */}
                            {serviceRevenueData.length > 0 && renderChartCard('Top Services by Revenue',
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={serviceRevenueData.slice(0, 10)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            {renderGradient('revGrad', '#10B981')}
                                            {renderGradient('profitGrad', '#6366F1')}
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                        <XAxis dataKey="service_name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `₹${v/1000}k`} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomTooltipComponent formatter={formatCurrency} />} />
                                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                        <Bar dataKey="revenue_collected" name="Revenue" fill="url(#revGrad)" radius={[4, 4, 0, 0]} animationDuration={800} />
                                        <Bar dataKey="gross_profit" name="Net Profit" fill="url(#profitGrad)" radius={[4, 4, 0, 0]} animationDuration={800} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}

                            {/* Expense Category Chart */}
                            {expenseData.length > 0 && renderChartCard('Expenses by Category',
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={expenseData} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                                        <defs>
                                            {renderGradient('expCatGrad', '#EF4444')}
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                        <XAxis type="number" tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `₹${v/1000}k`} axisLine={false} tickLine={false} />
                                        <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: '#6B7280' }} width={100} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomTooltipComponent formatter={formatCurrency} />} />
                                        <Bar dataKey="amount" name="Total Spent" fill="url(#expCatGrad)" radius={[0, 4, 4, 0]} animationDuration={800} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}

                            {report?.id === 6 && cashFlowData.length > 0 && renderChartCard('Daily Cash Flow Trend',
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={cashFlowData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            {renderGradient('inflowGrad', '#10B981')}
                                            {renderGradient('outflowGrad', '#EF4444')}
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(tick) => new Date(tick).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `₹${v/1000}k`} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomTooltipComponent formatter={formatCurrency} labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} />} />
                                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                        <Bar dataKey="inflow" name="Cash Inflow" fill="url(#inflowGrad)" radius={[4, 4, 0, 0]} animationDuration={800} />
                                        <Bar dataKey="outflow" name="Cash Outflow" fill="url(#outflowGrad)" radius={[4, 4, 0, 0]} animationDuration={800} />
                                        <Line type="monotone" dataKey="net_flow" name="Net Flow" stroke="#6366F1" strokeWidth={3} dot={{ r: 4, fill: '#6366F1' }} activeDot={{ r: 6 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            )}

                            {/* Ledger Report Preview Summary */}
                            {report?.id === 7 && ledgerData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <StatCard title="Total Transactions" value={ledgerSummary.count} subtitle="Selected Period" icon={FiActivity} color="bg-blue-600" />
                                        <StatCard title="Total Credit (In)" value={`₹${ledgerSummary.credit.toLocaleString('en-IN')}`} subtitle="Selected Period" icon={FiTrendingUp} color="bg-emerald-600" />
                                        <StatCard title="Total Debit (Out)" value={`₹${ledgerSummary.debit.toLocaleString('en-IN')}`} subtitle="Selected Period" icon={FiTrendingDown} color="bg-rose-600" />
                                    </div>
                                    {renderChartCard('Transaction Volume by Category',
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={ledgerCategoryChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <defs>
                                                    {renderGradient('ledgerGrad', '#6366F1')}
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `₹${v/1000}k`} axisLine={false} tickLine={false} />
                                                <Tooltip content={<CustomTooltipComponent formatter={formatCurrency} />} />
                                                <Bar dataKey="value" name="Total Volume" fill="url(#ledgerGrad)" radius={[4, 4, 0, 0]} animationDuration={800} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </>
                            )}

                            {/* Pending Collections Preview Summary */}
                            {report?.id === 8 && pendingCollectionsData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <StatCard title="Total Outstanding" value={`₹${pendingSummary.totalDue.toLocaleString('en-IN')}`} subtitle="From Selected Period" icon={FiClock} color="bg-amber-600" />
                                        <StatCard title="Pending Customers" value={pendingSummary.count} subtitle="With Unpaid Balances" icon={FiUsers} color="bg-rose-600" />
                                    </div>
                                    {renderChartCard('Top 10 Highest Pending Balances',
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={pendingCollectionsData.slice(0, 10)} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                                                <defs>
                                                    {renderGradient('pendingGrad', '#F59E0B')}
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                                <XAxis type="number" tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `₹${v}`} axisLine={false} tickLine={false} />
                                                <YAxis type="category" dataKey="customer_name" tick={{ fontSize: 11, fill: '#6B7280' }} width={100} axisLine={false} tickLine={false} />
                                                <Tooltip content={<CustomTooltipComponent formatter={formatCurrency} />} />
                                                <Bar dataKey="balance_due" name="Balance Due" fill="url(#pendingGrad)" radius={[0, 4, 4, 0]} animationDuration={800} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
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
                                    {renderChartCard('Revenue by Staff Member',
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={performanceData.filter(d => d.total_revenue > 0)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <defs>
                                                    {renderGradient('staffRevGrad', '#10B981')}
                                                    {renderGradient('staffProfitGrad', '#6366F1')}
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                <XAxis dataKey="staff_name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `₹${v/1000}k`} axisLine={false} tickLine={false} />
                                                <Tooltip content={<CustomTooltipComponent formatter={formatCurrency} />} />
                                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                                <Bar dataKey="total_revenue" name="Total Revenue" fill="url(#staffRevGrad)" radius={[4, 4, 0, 0]} animationDuration={800} />
                                                <Bar dataKey="gross_profit" name="Gross Profit" fill="url(#staffProfitGrad)" radius={[4, 4, 0, 0]} animationDuration={800} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </>
                            )}

                            {report?.id === 11 && salaryData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <StatCard title="Total Net Payroll" value={`₹${salarySummary.totalPayroll.toLocaleString('en-IN')}`} subtitle="For Selected Months" icon={FiDollarSign} color="bg-indigo-600" />
                                        <StatCard title="Pending Payouts" value={salarySummary.pendingPayouts} subtitle="Awaiting 'Send' Status" icon={FiClock} color="bg-amber-500" />
                                        <StatCard title="Total Deductions" value={`₹${salarySummary.totalDeductions.toLocaleString('en-IN')}`} subtitle="Recovered / Withheld" icon={FiTrendingDown} color="bg-rose-600" />
                                    </div>
                                    {renderChartCard('Net Salary Distribution',
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={salaryData.slice(0, 15)} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                                                <defs>
                                                    {renderGradient('salaryGrad', '#6366F1')}
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                                <XAxis type="number" tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `₹${v/1000}k`} axisLine={false} tickLine={false} />
                                                <YAxis type="category" dataKey="staff_name" tick={{ fontSize: 11, fill: '#6B7280' }} width={100} axisLine={false} tickLine={false} />
                                                <Tooltip content={<CustomTooltipComponent formatter={formatCurrency} />} />
                                                <Bar dataKey="net_salary" name="Net Salary" fill="url(#salaryGrad)" radius={[0, 4, 4, 0]} animationDuration={800} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </>
                            )}

                            {/* Incentive Report Preview Summary */}
                            {report?.id === 12 && incentiveData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <StatCard title="Total Suggested Bonuses" value={`₹${totalSuggestedBonus.toLocaleString('en-IN')}`} subtitle="If 100% approved" icon={FiStar} color="bg-amber-500" />
                                        <StatCard title="Highest KPI Score" value={`${incentiveData[0]?.incentive_score || 0}/100`} subtitle={`Achieved by ${incentiveData[0]?.staff_name}`} icon={FiAward} color="bg-indigo-600" />
                                    </div>
                                    {renderChartCard('Staff KPI Scores (Performance & Efficiency)',
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={incentiveData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <defs>
                                                    {renderGradient('kpiGrad', '#F59E0B')}
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                <XAxis dataKey="staff_name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                                                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                                                <Tooltip content={<CustomTooltipComponent />} />
                                                <Bar dataKey="incentive_score" name="KPI Score (out of 100)" fill="url(#kpiGrad)" radius={[4, 4, 0, 0]} animationDuration={800} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
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
                                    {renderChartCard('Service Rating Distribution',
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={reviewChartData} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                                <XAxis type="number" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                <YAxis type="category" dataKey="stars" tick={{ fontSize: 11, fill: '#6B7280' }} width={60} axisLine={false} tickLine={false} />
                                                <Tooltip content={<CustomTooltipComponent />} />
                                                <Bar dataKey="count" name="Number of Reviews" radius={[0, 4, 4, 0]} animationDuration={800}>
                                                    {reviewChartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
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
                                    {renderChartCard('Leave Approval Status',
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie 
                                                    data={leaveStatusChart}
                                                    dataKey="value" 
                                                    nameKey="name" 
                                                    cx="50%" cy="50%" 
                                                    innerRadius={50} outerRadius={80} 
                                                    paddingAngle={2} cornerRadius={4}
                                                    animationDuration={800}
                                                >
                                                    {leaveStatusChart.map((entry, idx) => (
                                                        <Cell key={idx} fill={entry.fill} />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<CustomTooltipComponent />} />
                                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </>
                            )}

                            {/* Service Profit Preview Summary */}
                            {report?.id === 16 && serviceProfitData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <StatCard title="Total Service Profit" value={`₹${profitSummary.totalProfit.toLocaleString('en-IN')}`} subtitle="Across all completed services" icon={FiTrendingUp} color="bg-indigo-600" />
                                        <StatCard title="Most Profitable Service" value={profitSummary.mostProfitable?.service_name || '-'} subtitle={`Generated ₹${(profitSummary.mostProfitable?.gross_profit || 0).toLocaleString('en-IN')}`} icon={FiAward} color="bg-emerald-600" />
                                    </div>
                                    {renderChartCard('Top 10 Most Profitable Services',
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={serviceProfitData.slice(0, 10)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <defs>
                                                    {renderGradient('serviceProfitGrad', '#6366F1')}
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                <XAxis dataKey="service_name" tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `₹${v/1000}k`} axisLine={false} tickLine={false} />
                                                <Tooltip content={<CustomTooltipComponent formatter={formatCurrency} />} />
                                                <Bar dataKey="gross_profit" name="Gross Profit" fill="url(#serviceProfitGrad)" radius={[4, 4, 0, 0]} animationDuration={800} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </>
                            )}

                            {/* Pending Services Preview Summary */}
                            {report?.id === 17 && pendingServicesData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <StatCard title="Total Backlog" value={pendingServicesData.length} subtitle="Active Applications" icon={FiBriefcase} color="bg-rose-600" />
                                        <StatCard title="In Progress" value={pendingSummary.in_progress} subtitle="Currently being worked on" icon={FiActivity} color="bg-indigo-600" />
                                        <StatCard title="Avg Time in Queue" value={`${avgDaysPending} Days`} subtitle="Across all pending items" icon={FiClock} color="bg-amber-500" />
                                    </div>
                                    {renderChartCard('Pipeline Status',
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie 
                                                    data={pendingChartData}
                                                    dataKey="value" 
                                                    nameKey="name" 
                                                    cx="50%" cy="50%" 
                                                    innerRadius={50} outerRadius={80} 
                                                    paddingAngle={2} cornerRadius={4}
                                                    animationDuration={800}
                                                >
                                                    {pendingChartData.map((entry, idx) => (
                                                        <Cell key={idx} fill={entry.fill} />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<CustomTooltipComponent />} />
                                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </>
                            )}
                            
                            {/* Completed Services Preview Summary */}
                            {report?.id === 18 && completedServicesData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <StatCard title="Total Completed" value={completedSummary.total} subtitle="Services finished in period" icon={FiCheckCircle} color="bg-emerald-600" />
                                        <StatCard title="Avg Turnaround Time" value={`${completedSummary.avgDays} Days`} subtitle="From application to completion" icon={FiClock} color="bg-indigo-600" />
                                    </div>
                                    {renderChartCard('Top Completed Services',
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={completedChartData} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                                                <defs>
                                                    {renderGradient('completedGrad', '#10B981')}
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                                <XAxis type="number" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} width={120} tickFormatter={(val) => val.length > 20 ? val.substring(0, 20) + '...' : val} axisLine={false} tickLine={false} />
                                                <Tooltip content={<CustomTooltipComponent />} />
                                                <Bar dataKey="value" name="Services Completed" fill="url(#completedGrad)" radius={[0, 4, 4, 0]} animationDuration={800} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </>
                            )}

                            {/* Staff-wise Services Preview Summary */}
                            {report?.id === 19 && staffWiseServicesData.length > 0 && (
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                                    <div className="flex items-center space-x-3 mb-4">
                                        <div className="p-2 bg-indigo-50 rounded-lg">
                                            <FiUsers className="h-5 w-5 text-indigo-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900 text-sm">Staff Specialization Overview</h3>
                                            <p className="text-xs text-gray-500">Switch to the Data tab for a detailed breakdown of services performed by each staff member.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Service Time Analysis Preview Summary */}
                            {report?.id === 20 && serviceTimeData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <StatCard title="Overall Avg Turnaround" value={formatDuration(overallAvgHours)} subtitle={`Across ${totalServiceVolume} completed services`} icon={FiClock} color="bg-indigo-600" />
                                        <StatCard title="Slowest Service Type" value={slowestService?.service_name || '-'} subtitle={`Averages ${formatDuration(slowestService?.avg_hours || 0)}`} icon={FiTrendingUp} color="bg-rose-600" />
                                    </div>
                                    {renderChartCard('Longest Running Services (Average Days)',
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={timeChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <defs>
                                                    {renderGradient('timeGrad', '#F59E0B')}
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                                                <Tooltip content={<CustomTooltipComponent formatter={formatDays} />} />
                                                <Bar dataKey="avg_days" name="Average Time (Days)" fill="url(#timeGrad)" radius={[4, 4, 0, 0]} animationDuration={800} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </>
                            )}

                            {/* Customer Summary Preview */}
                            {report?.id === 21 && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <StatCard title="Total Unique Customers" value={custStats.total} subtitle="Serviced in Period" icon={FiUsers} color="bg-blue-600" />
                                        <StatCard title="New Customers" value={custStats.new} subtitle="First time visits" icon={FiUserPlus} color="bg-emerald-600" />
                                        <StatCard title="Returning Customers" value={custStats.returning} subtitle="Loyal clients" icon={FiRefreshCw} color="bg-indigo-600" />
                                    </div>
                                    
                                    {customerSummaryData.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                            {renderChartCard('Customer Acquisition (New vs Returning)',
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie data={returningChart} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} cornerRadius={4} animationDuration={800}>
                                                            {returningChart.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                                                        </Pie>
                                                        <Tooltip content={<CustomTooltipComponent />} />
                                                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            )}
                                            {renderChartCard('Profile Type (Registered vs Walk-in)',
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie data={registeredChart} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} cornerRadius={4} animationDuration={800}>
                                                            {registeredChart.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                                                        </Pie>
                                                        <Tooltip content={<CustomTooltipComponent />} />
                                                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-lg border border-gray-200 p-12 mt-6 text-center">
                                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <FiUsers className="h-5 w-5 text-gray-400" />
                                            </div>
                                            <h3 className="text-sm font-medium text-gray-900 mb-1">No Customer Data</h3>
                                            <p className="text-xs text-gray-500">No services were recorded during this period.</p>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* New Customers Preview Summary */}
                            {report?.id === 22 && (
                                <div className="grid grid-cols-2 gap-3">
                                    <StatCard title="Total New Customers" value={newCustomerData.length} subtitle="Acquired in Period" icon={FiUserPlus} color="bg-emerald-600" />
                                    <StatCard title="Total Initial Revenue" value={`₹${newCustomerData.reduce((sum, c) => sum + c.total_spent, 0).toLocaleString('en-IN')}`} subtitle="Generated by new clients" icon={FiDollarSign} color="bg-indigo-600" />
                                </div>
                            )}

                            {/* Returning Customers Preview Summary */}
                            {report?.id === 23 && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <StatCard title="Total Repeat Customers" value={repeatStats.totalVips} subtitle="Visited in this period" icon={FiRefreshCw} color="bg-emerald-600" />
                                        <StatCard title="Avg Lifetime Value (LTV)" value={`₹${avgLTV.toLocaleString('en-IN')}`} subtitle="Per returning customer" icon={FiTrendingUp} color="bg-indigo-600" />
                                        <StatCard title="Most Loyal VIP" value={repeatStats.mostFrequent?.customer_name || '-'} subtitle={`${repeatStats.mostFrequent?.lifetime_visits || 0} lifetime visits`} icon={FiAward} color="bg-amber-500" />
                                    </div>
                                    
                                    {repeatCustomerData.length > 0 ? (
                                        renderChartCard('Top 10 VIP Customers (By Lifetime Visits)',
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={repeatCustomerData.slice(0, 10)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                    <defs>
                                                        {renderGradient('vipGrad', '#10B981')}
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                    <XAxis dataKey="customer_name" tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(val) => val.length > 10 ? val.substring(0, 10) + '..' : val} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                    <Tooltip content={<CustomTooltipComponent />} />
                                                    <Bar dataKey="lifetime_visits" name="Lifetime Visits" fill="url(#vipGrad)" radius={[4, 4, 0, 0]} animationDuration={800} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        )
                                    ) : (
                                        <div className="bg-white rounded-lg border border-gray-200 p-12 mt-6 text-center">
                                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <FiRefreshCw className="h-5 w-5 text-gray-400" />
                                            </div>
                                            <h3 className="text-sm font-medium text-gray-900 mb-1">No Repeat Customers Yet</h3>
                                            <p className="text-xs text-gray-500">To appear on this report, a phone number must have at least 2 completed services in the system.</p>
                                        </div>
                                    )}
                                </>
                            )}
                            {/* Customer Activity Preview Summary */}
                            {report?.id === 24 && activityData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <StatCard title="Total Interactions" value={activityData.length} subtitle="Services logged in period" icon={FiActivity} color="bg-indigo-600" />
                                        <StatCard title="Unique Customers" value={new Set(activityData.map(a => a.phone)).size} subtitle="Distinct individuals" icon={FiUsers} color="bg-emerald-600" />
                                        <StatCard title="Total Value Generated" value={`₹${activityData.reduce((sum, a) => sum + a.amount, 0).toLocaleString('en-IN')}`} subtitle="Across all logged activity" icon={FiDollarSign} color="bg-amber-500" />
                                    </div>
                                    {renderChartCard('Customer Footfall Timeline',
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={activityTimelineChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <defs>
                                                    {renderGradient('activityGrad', '#6366F1')}
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                <Tooltip content={<CustomTooltipComponent />} />
                                                <Line type="monotone" dataKey="volume" name="Services Requested" stroke="#6366F1" strokeWidth={3} dot={{ r: 4, fill: '#6366F1' }} activeDot={{ r: 6 }} animationDuration={800} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )}
                                </>
                            )}

                            {/* Customer Feedback Preview Summary */}
                            {report?.id === 25 && feedbackData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <StatCard title="Overall Centre Rating" value={`${avgCentreRating} / 5`} subtitle={`From ${feedbackStats.total} reviews`} icon={FiStar} color="bg-amber-500" />
                                        <StatCard title="5-Star Reviews" value={feedbackStats.fiveStar} subtitle="Perfect scores" icon={FiAward} color="bg-emerald-600" />
                                        <StatCard title="Total Feedback" value={feedbackStats.total} subtitle="Submitted by customers" icon={FiFileText} color="bg-blue-600" />
                                    </div>
                                    {renderChartCard('Customer Satisfaction Distribution',
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={feedbackChartData} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                                <XAxis type="number" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                <YAxis type="category" dataKey="stars" tick={{ fontSize: 11, fill: '#6B7280' }} width={60} axisLine={false} tickLine={false} />
                                                <Tooltip content={<CustomTooltipComponent />} />
                                                <Bar dataKey="count" name="Number of Reviews" radius={[0, 4, 4, 0]} animationDuration={800}>
                                                    {feedbackChartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </>
                            )}

                            {/* Team Financials Preview Summary */}
                            {report?.id === 26 && teamFinData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <StatCard title="Team Gross Profit" value={`₹${teamStats.totalRev.toLocaleString('en-IN')}`} subtitle="Across all active teams" icon={FiTrendingUp} color="bg-emerald-600" />
                                        <StatCard title="Team Overhead Expenses" value={`₹${teamStats.totalExp.toLocaleString('en-IN')}`} subtitle="Directly mapped team costs" icon={FiTrendingDown} color="bg-rose-600" />
                                        <StatCard title="Most Profitable Team" value={teamStats.topTeam?.team_name || '-'} subtitle={`₹${(teamStats.topTeam?.net_profit || 0).toLocaleString('en-IN')} Net Profit`} icon={FiAward} color="bg-indigo-600" />
                                    </div>
                                    {renderChartCard('Team Performance (Gross Profit vs Overhead)',
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={teamFinData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <defs>
                                                    {renderGradient('teamProfitGrad', '#10B981')}
                                                    {renderGradient('teamExpGrad', '#F87171')}
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                <XAxis dataKey="team_name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `₹${v/1000}k`} axisLine={false} tickLine={false} />
                                                <Tooltip content={<CustomTooltipComponent formatter={formatCurrency} />} />
                                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                                <Bar dataKey="gross_profit" name="Gross Service Profit" fill="url(#teamProfitGrad)" radius={[4, 4, 0, 0]} animationDuration={800} />
                                                <Bar dataKey="total_expenses" name="Team Expenses" fill="url(#teamExpGrad)" radius={[4, 4, 0, 0]} animationDuration={800} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </>
                            )}

                            {/* Team Performance Preview Summary */}
                            {report?.id === 27 && teamPerfData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <StatCard title="Highest Volume Team" value={highestVolumeTeam?.team_name || '-'} subtitle={`${highestVolumeTeam?.total_services || 0} services completed`} icon={FiActivity} color="bg-indigo-600" />
                                        <StatCard title="Highest Rated Team" value={highestRatedTeam?.team_name || '-'} subtitle={highestRatedTeam ? `${highestRatedTeam.avg_rating} / 5 Stars` : 'No ratings yet'} icon={FiStar} color="bg-amber-500" />
                                        <StatCard title="Fastest Turnaround" value={fastestTeam?.team_name || '-'} subtitle={fastestTeam ? `Averages ${formatHoursToText(fastestTeam.avg_tat_hours)}` : '-'} icon={FiClock} color="bg-emerald-600" />
                                    </div>
                                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center space-x-3">
                                        <div className="p-2 bg-indigo-50 rounded-lg">
                                            <FiUsers className="h-5 w-5 text-indigo-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900 text-sm">Team Productivity Leaderboard</h3>
                                            <p className="text-xs text-gray-500">Switch to the Data tab to view the complete operational breakdown for every active team.</p>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Team Contribution Preview Summary */}
                            {report?.id === 28 && teamContribData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <StatCard title="Top Overall Contributor" value={topOverallContributor?.staff_name || '-'} subtitle={`Generated ₹${(topOverallContributor?.gross_profit || 0).toLocaleString('en-IN')} in profit`} icon={FiAward} color="bg-amber-500" />
                                        <StatCard title="Total Assigned Members" value={teamContribData.length} subtitle="Staff members mapped to teams" icon={FiUsers} color="bg-indigo-600" />
                                    </div>
                                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center space-x-3">
                                        <div className="p-2 bg-emerald-50 rounded-lg">
                                            <FiBriefcase className="h-5 w-5 text-emerald-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900 text-sm">Staff Contribution Ledger</h3>
                                            <p className="text-xs text-gray-500">Switch to the Data tab to view exactly how much revenue and profit each individual member brought to their team.</p>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Centre Comparison Preview Summary */}
                            {report?.id === 29 && centreComparisonData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <StatCard title="Highest Revenue" value={topRevenueCentre?.centre_name || '-'} subtitle={`₹${(topRevenueCentre?.total_revenue || 0).toLocaleString('en-IN')}`} icon={FiTrendingUp} color="bg-emerald-600" />
                                        <StatCard title="Highest Net Profit" value={topProfitCentre?.centre_name || '-'} subtitle={`₹${(topProfitCentre?.net_profit || 0).toLocaleString('en-IN')}`} icon={FiAward} color="bg-indigo-600" />
                                        <StatCard title="Highest Service Volume" value={topVolumeCentre?.centre_name || '-'} subtitle={`${topVolumeCentre?.total_services || 0} services`} icon={FiActivity} color="bg-amber-500" />
                                    </div>
                                    {renderChartCard('Centre Comparison (Gross Profit vs Expenses)',
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={centreComparisonData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <defs>
                                                    {renderGradient('centreProfitGrad', '#10B981')}
                                                    {renderGradient('centreExpGrad', '#EF4444')}
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                <XAxis dataKey="centre_name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `₹${v/1000}k`} axisLine={false} tickLine={false} />
                                                <Tooltip content={<CustomTooltipComponent formatter={formatCurrency} />} />
                                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                                <Bar dataKey="gross_profit" name="Gross Profit" fill="url(#centreProfitGrad)" radius={[4, 4, 0, 0]} animationDuration={800} />
                                                <Bar dataKey="total_expenses" name="Operating Expenses" fill="url(#centreExpGrad)" radius={[4, 4, 0, 0]} animationDuration={800} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </>
                            )}

                            {/* Revenue by Centre Preview Summary */}
                            {report?.id === 30 && revCentreSummary.length > 0 && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <StatCard title="Total Global Revenue" value={`₹${totalGlobalRevenue.toLocaleString('en-IN')}`} subtitle="Across all centres" icon={FiDollarSign} color="bg-indigo-600" />
                                        <StatCard title="Top Generating Centre" value={topRevCentreObj?.centre_name || '-'} subtitle={`Generated ₹${(topRevCentreObj?.total_revenue || 0).toLocaleString('en-IN')}`} icon={FiAward} color="bg-emerald-600" />
                                        <StatCard title="Average per Centre" value={`₹${avgRevenuePerCentre.toLocaleString('en-IN')}`} subtitle="Baseline comparison" icon={FiActivity} color="bg-amber-500" />
                                    </div>
                                    
                                    {renderChartCard('Daily Revenue Timeline Comparison',
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={revTrendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `₹${v/1000}k`} axisLine={false} tickLine={false} />
                                                <Tooltip content={<CustomTooltipComponent formatter={formatCurrency} />} />
                                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                                
                                                {/* Dynamically generate a line for every active centre */}
                                                {activeRevCentres.map((centreName, idx) => (
                                                    <Line 
                                                        key={idx}
                                                        type="monotone" 
                                                        dataKey={centreName} 
                                                        name={centreName}
                                                        stroke={CHART_COLORS[idx % CHART_COLORS.length]} 
                                                        strokeWidth={3} 
                                                        dot={false}
                                                        activeDot={{ r: 6 }} 
                                                        animationDuration={800} 
                                                    />
                                                ))}
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )}
                                </>
                            )}
                            {/* Profit by Centre Preview Summary */}
                            {report?.id === 31 && profitCentreSummary.length > 0 && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <StatCard title="Total Global Net Profit" value={`₹${totalGlobalProfit.toLocaleString('en-IN')}`} subtitle="Across all centres" icon={FiDollarSign} color="bg-indigo-600" />
                                        <StatCard title="Most Profitable Centre" value={topProfitCentreObj2?.centre_name || '-'} subtitle={`Generated ₹${(topProfitCentreObj2?.net_profit || 0).toLocaleString('en-IN')}`} icon={FiAward} color="bg-emerald-600" />
                                        <StatCard title="Profitable Centres" value={`${profitableCentresCount} / ${profitCentreSummary.length}`} subtitle="Operating in the green" icon={FiTrendingUp} color={profitableCentresCount === profitCentreSummary.length ? "bg-emerald-500" : "bg-amber-500"} />
                                    </div>
                                    
                                    {renderChartCard('Daily Net Profit Timeline Comparison',
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={profitTrendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `₹${v/1000}k`} axisLine={false} tickLine={false} />
                                                <Tooltip content={<CustomTooltipComponent formatter={formatCurrency} />} />
                                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                                
                                                {/* Dynamically generate a line for every active centre */}
                                                {activeProfitCentres.map((centreName, idx) => (
                                                    <Line 
                                                        key={idx}
                                                        type="monotone" 
                                                        dataKey={centreName} 
                                                        name={centreName}
                                                        stroke={CHART_COLORS[(idx + 1) % CHART_COLORS.length]} 
                                                        strokeWidth={3} 
                                                        dot={false}
                                                        activeDot={{ r: 6 }} 
                                                        animationDuration={800} 
                                                    />
                                                ))}
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )}
                                </>
                            )}

                            {/* Attendance by Centre Preview Summary */}
                            {report?.id === 32 && attByCentreData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <StatCard title="Highest Attendance Logged" value={topAttendanceCentre?.centre_name || '-'} subtitle={`${topAttendanceCentre?.present_days || 0} Total Present Days`} icon={FiUserCheck} color="bg-emerald-600" />
                                        <StatCard title="Most Late Minutes" value={mostLateCentre?.centre_name || '-'} subtitle={`${mostLateCentre?.late_mins || 0} Minutes Total`} icon={FiClock} color="bg-rose-600" />
                                    </div>
                                    {renderChartCard('Centre Attendance Profile (Present vs Absent Days)',
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={attByCentreData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <defs>
                                                    {renderGradient('attPresentGrad', '#10B981')}
                                                    {renderGradient('attAbsentGrad', '#EF4444')}
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                <XAxis dataKey="centre_name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                                                <Tooltip content={<CustomTooltipComponent />} />
                                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                                <Bar dataKey="present_days" name="Total Present Days" fill="url(#attPresentGrad)" radius={[4, 4, 0, 0]} animationDuration={800} />
                                                <Bar dataKey="absent_days" name="Total Absent Days" fill="url(#attAbsentGrad)" radius={[4, 4, 0, 0]} animationDuration={800} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </>
                            )}

                            {/* Service Comparison Preview Summary */}
                            {report?.id === 33 && svcCompareChartData.length > 0 && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <StatCard title="Highest Volume Centre" value={topVolumeCompareCentre?.centre_name || '-'} subtitle={`${topVolumeCompareCentre?.total_volume || 0} Total Services`} icon={FiBriefcase} color="bg-indigo-600" />
                                        <StatCard title="Unique Service Categories" value={activeSvcCategories.length} subtitle="Handled across the network" icon={FiPieChart} color="bg-amber-500" />
                                    </div>
                                    {renderChartCard('Service Distribution Matrix (Stacked Category Volume)',
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={svcCompareChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                <XAxis dataKey="centre_name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                                                <Tooltip content={<CustomTooltipComponent />} />
                                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                                {/* Stack the bars using the generated category list! */}
                                                {activeSvcCategories.map((cat, idx) => (
                                                    <Bar key={idx} dataKey={cat} name={cat} stackId="a" fill={CHART_COLORS[idx % CHART_COLORS.length]} animationDuration={800} />
                                                ))}
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </>
                            )}

                        </div>
                    )}
                    
                    {/* DATA TAB - LIVE RENDERING */}
                    {activeTab === 'data' && (
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            
                            {/* 👇 NEW: Service Comparison Table (ID 33) 👇 */}
                            {report?.id === 33 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Centre Name</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Service Category</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Volume Processed</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Revenue Generated</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {svcCompareDataRaw.length > 0 ? (
                                                svcCompareDataRaw.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-sm font-bold text-gray-900">{row.centre_name}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-600">{row.service_category}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-600 text-center font-medium">{row.volume}</td>
                                                        <td className="px-4 py-3 text-sm text-emerald-600 text-right font-medium">₹{row.revenue.toLocaleString('en-IN')}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="4" className="px-4 py-12 text-center text-gray-500">No service data found across centres for this period.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            
                            ) : report?.id === 32 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Centre Name</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Active Staff Roster</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase text-emerald-600">Total Present Days</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase text-rose-600">Total Absent Days</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase text-amber-600">Total Late Minutes</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {attByCentreData.length > 0 ? (
                                                attByCentreData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-sm font-bold text-gray-900">{row.centre_name}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-600 text-center">{row.total_staff} Employees</td>
                                                        <td className="px-4 py-3 text-sm text-emerald-600 text-center font-bold">{row.present_days}</td>
                                                        <td className="px-4 py-3 text-sm text-rose-600 text-center font-bold">{row.absent_days}</td>
                                                        <td className={`px-4 py-3 text-sm text-right font-medium ${row.late_mins > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                                                            {row.late_mins > 0 ? `${row.late_mins} Mins` : '-'}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="px-4 py-12 text-center text-gray-500">No attendance data found across centres for this period.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                
                            ) : report?.id === 31 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Centre Name</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Gross Profit (Service Charges)</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase text-rose-600">Operating Expenses</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase text-indigo-600">Net Profit</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {profitCentreSummary.length > 0 ? (
                                                profitCentreSummary.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-sm font-bold text-gray-900">
                                                            <div className="flex items-center">
                                                                {idx === 0 && row.net_profit > 0 && <FiAward className="h-4 w-4 text-amber-500 mr-2" />}
                                                                {row.centre_name}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-emerald-600 text-right font-medium">₹{row.gross_profit.toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 text-sm text-rose-600 text-right font-medium">- ₹{row.total_expenses.toLocaleString('en-IN')}</td>
                                                        <td className={`px-4 py-3 text-sm text-right font-bold ${row.net_profit >= 0 ? 'text-indigo-600 bg-indigo-50/30' : 'text-rose-600 bg-rose-50/30'}`}>
                                                            ₹{row.net_profit.toLocaleString('en-IN')}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] font-bold tracking-wider ${row.net_profit >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                                                {row.net_profit >= 0 ? 'PROFITABLE' : 'AT LOSS'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="px-4 py-12 text-center">
                                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                            <FiTrendingUp className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                        <h3 className="text-sm font-medium text-gray-900 mb-1">No Profit Data</h3>
                                                        <p className="text-xs text-gray-500">No profit or expense data was recorded across the centres during this period.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : report?.id === 30 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Centre Name</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Completed Services</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Revenue</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase text-rose-600">Govt/Dept Charges</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase text-indigo-600">Gross Profit</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {revCentreSummary.length > 0 ? (
                                                revCentreSummary.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-sm font-bold text-gray-900">
                                                            <div className="flex items-center">
                                                                {idx === 0 && <FiAward className="h-4 w-4 text-amber-500 mr-2" />}
                                                                {row.centre_name}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-600 text-center font-medium">{row.total_services}</td>
                                                        <td className="px-4 py-3 text-sm text-emerald-600 text-right font-medium">₹{row.total_revenue.toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 text-sm text-rose-600 text-right font-medium">- ₹{row.total_dept_charges.toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 text-sm text-indigo-600 text-right font-bold bg-indigo-50/30">₹{row.gross_profit.toLocaleString('en-IN')}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="px-4 py-12 text-center">
                                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                            <FiBarChart2 className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                        <h3 className="text-sm font-medium text-gray-900 mb-1">No Revenue Data</h3>
                                                        <p className="text-xs text-gray-500">No profitable services were recorded across the centres during this period.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : report?.id === 29 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Centre Name</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Active Staff</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Services</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Revenue</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Gross Profit</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase text-rose-600">Expenses</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase text-indigo-600">Net Profit</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {centreComparisonData.length > 0 ? (
                                                centreComparisonData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-sm font-bold text-gray-900">
                                                            <div className="flex items-center">
                                                                {idx === 0 && <FiAward className="h-4 w-4 text-amber-500 mr-2" />}
                                                                {row.centre_name}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-sm text-gray-600">
                                                            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs font-medium">
                                                                {row.active_staff} Users
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-600 text-center font-medium">{row.total_services}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-600 text-right">₹{row.total_revenue.toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 text-sm text-emerald-600 text-right font-medium">₹{row.gross_profit.toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 text-sm text-rose-600 text-right font-medium">- ₹{row.total_expenses.toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 text-sm text-indigo-600 text-right font-bold bg-indigo-50/30">₹{row.net_profit.toLocaleString('en-IN')}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="7" className="px-4 py-12 text-center">
                                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                            <FiHome className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                        <h3 className="text-sm font-medium text-gray-900 mb-1">No Centre Data Found</h3>
                                                        <p className="text-xs text-gray-500">No operational data across centres for this period.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : report?.id === 28 ? (
                                <div className="p-0">
                                    {(() => {
                                        // Mathematically group the data by Team Name
                                        const groupedByTeam = {};
                                        teamContribData.forEach(row => {
                                            if (!groupedByTeam[row.team_name]) {
                                                groupedByTeam[row.team_name] = { totalServices: 0, totalProfit: 0, members: [] };
                                            }
                                            groupedByTeam[row.team_name].members.push(row);
                                            groupedByTeam[row.team_name].totalServices += row.services_completed;
                                            groupedByTeam[row.team_name].totalProfit += row.gross_profit;
                                        });

                                        return (
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Staff Member</th>
                                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Services Handled</th>
                                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Revenue Contributed</th>
                                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Profit Contributed</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {Object.keys(groupedByTeam).length > 0 ? (
                                                        Object.entries(groupedByTeam).map(([teamName, data], groupIdx) => (
                                                            <React.Fragment key={groupIdx}>
                                                                
                                                                {/* 🟦 BEAUTIFUL TEAM BANNER ROW */}
                                                                <tr className="bg-indigo-50/60 border-t border-indigo-100">
                                                                    <td colSpan="4" className="px-4 py-2 text-sm font-bold text-indigo-900">
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="flex items-center uppercase tracking-wider">
                                                                                <FiBriefcase className="mr-2 h-4 w-4 text-indigo-500" />
                                                                                {teamName}
                                                                            </div>
                                                                            <div className="flex items-center space-x-4">
                                                                                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-100/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                                                    {data.totalServices} Total Services
                                                                                </span>
                                                                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                                                    ₹{data.totalProfit.toLocaleString('en-IN')} Team Profit
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>

                                                                {/* 🗂️ STAFF ROWS UNDERNEATH THE BANNER */}
                                                                {data.members.map((row, idx) => (
                                                                    <tr key={`${groupIdx}-${idx}`} className="hover:bg-gray-50 transition-colors">
                                                                        <td className="px-4 py-3 pl-8">
                                                                            <div className="flex items-center">
                                                                                {idx === 0 && row.gross_profit > 0 && <FiAward className="h-4 w-4 text-amber-500 mr-2" title="Top Earner for this Team!" />}
                                                                                <div>
                                                                                    <p className="text-sm font-bold text-gray-900">{row.staff_name}</p>
                                                                                    <p className="text-[10px] text-gray-500 capitalize">{row.role}</p>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-sm text-gray-600 text-center font-medium">
                                                                            {row.services_completed}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-sm text-gray-600 text-right">
                                                                            ₹{row.revenue_generated.toLocaleString('en-IN')}
                                                                        </td>
                                                                        <td className={`px-4 py-3 text-sm text-right font-bold ${row.gross_profit === 0 ? 'text-gray-400' : 'text-indigo-600'}`}>
                                                                            ₹{row.gross_profit.toLocaleString('en-IN')}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </React.Fragment>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan="4" className="px-4 py-12 text-center">
                                                                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                                    <FiUsers className="h-5 w-5 text-gray-400" />
                                                                </div>
                                                                <h3 className="text-sm font-medium text-gray-900 mb-1">No Staff Data Found</h3>
                                                                <p className="text-xs text-gray-500">No active staff members are mapped to teams.</p>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        );
                                    })()}
                                </div>
                            ) : report?.id === 27 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Team Name</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Active Members</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Services Completed</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Avg Turnaround Time</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Avg Rating</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {teamPerfData.length > 0 ? (
                                                teamPerfData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-sm font-bold text-gray-900">
                                                            {row.team_name}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs font-medium">
                                                                {row.active_members} Users
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className="text-sm font-bold text-indigo-600">
                                                                {row.total_services}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                                                            {formatHoursToText(row.avg_tat_hours)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            {row.avg_rating > 0 ? (
                                                                <div className="flex items-center justify-end text-amber-500 font-bold text-sm">
                                                                    {row.avg_rating} <FiStarIcon className="ml-1 h-3 w-3 fill-amber-500" />
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-gray-400">No Ratings</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="px-4 py-12 text-center">
                                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                            <FiBriefcase className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                        <h3 className="text-sm font-medium text-gray-900 mb-1">No Team Data Found</h3>
                                                        <p className="text-xs text-gray-500">No teams generated productivity metrics during this period.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : report?.id === 26 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Team Name</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Services Handled</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Revenue</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Gross Profit</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase text-rose-600">Expenses</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase text-indigo-600">Net Profit</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {teamFinData.length > 0 ? (
                                                teamFinData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-sm font-bold text-gray-900">
                                                            <div className="flex items-center">
                                                                {idx === 0 && <FiAward className="h-4 w-4 text-amber-500 mr-2" />}
                                                                {row.team_name}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-600 text-center font-medium">
                                                            {row.total_services}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-600 text-right">
                                                            ₹{row.total_revenue.toLocaleString('en-IN')}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-emerald-600 text-right font-medium">
                                                            ₹{row.gross_profit.toLocaleString('en-IN')}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-rose-600 text-right font-medium">
                                                            - ₹{row.total_expenses.toLocaleString('en-IN')}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-indigo-600 text-right font-bold bg-indigo-50/30">
                                                            ₹{row.net_profit.toLocaleString('en-IN')}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="6" className="px-4 py-12 text-center">
                                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                            <FiUsers className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                        <h3 className="text-sm font-medium text-gray-900 mb-1">No Team Financials</h3>
                                                        <p className="text-xs text-gray-500">No services or expenses were mapped to a team during this period.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : report?.id === 25 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Service Evaluated</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Rating</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Written Feedback</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {feedbackData.length > 0 ? (
                                                feedbackData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <p className="text-sm font-bold text-gray-900">{row.customer_name}</p>
                                                            <p className="text-[10px] text-gray-500">{new Date(row.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p className="text-sm text-gray-800 max-w-[200px] truncate" title={row.service_name}>{row.service_name}</p>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex items-center justify-center text-amber-500 font-bold text-sm">
                                                                {row.service_rating} <FiStarIcon className="ml-1 h-3 w-3 fill-amber-500" />
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-700 italic max-w-md break-words">
                                                            {row.review_text ? `"${row.review_text}"` : <span className="text-gray-400 not-italic text-xs">No comment provided</span>}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="4" className="px-4 py-12 text-center">
                                                        <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                            <FiStarIcon className="h-5 w-5 text-amber-500 fill-amber-500" />
                                                        </div>
                                                        <h3 className="text-sm font-medium text-gray-900 mb-1">No Reviews Found</h3>
                                                        <p className="text-xs text-gray-500">No customers submitted ratings during this period.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : report?.id === 24 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date & Time</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Service Handled</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {activityData.length > 0 ? (
                                                activityData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <p className="text-sm font-bold text-gray-900">
                                                                {new Date(row.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </p>
                                                            <p className="text-[10px] text-gray-500 font-mono">
                                                                {new Date(row.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center">
                                                                <p className="text-sm font-medium text-gray-900">{row.customer_name}</p>
                                                                {row.is_registered && <span className="ml-2 text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded uppercase tracking-wider">Reg</span>}
                                                            </div>
                                                            <p className="text-[10px] text-gray-500">{row.phone} • TKN: {row.token_id}</p>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p className="text-sm text-gray-800 max-w-[200px] truncate" title={row.service_name}>{row.service_name}</p>
                                                            <p className="text-[10px] text-gray-400">By: {row.staff_name}</p>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                                row.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                                                                row.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'
                                                            }`}>
                                                                {row.status.replace('_', ' ')}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-indigo-600 text-right font-bold">
                                                            ₹{row.amount.toLocaleString('en-IN')}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="px-4 py-12 text-center">
                                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                            <FiActivity className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                        <h3 className="text-sm font-medium text-gray-900 mb-1">No Activity Found</h3>
                                                        <p className="text-xs text-gray-500">No customer interactions were logged during this period.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : report?.id === 23 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer Information</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Lifetime Visits</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Lifetime Spent (LTV)</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">First Visit</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Latest Visit</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {repeatCustomerData.length > 0 ? (
                                                repeatCustomerData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center">
                                                                {idx < 3 && <FiAward className={`h-4 w-4 mr-2 ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-gray-400' : 'text-amber-700'}`} />}
                                                                <div>
                                                                    <p className="text-sm font-bold text-gray-900">
                                                                        {row.customer_name}
                                                                        {row.is_registered && <span className="ml-2 text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded uppercase tracking-wider">Reg</span>}
                                                                    </p>
                                                                    <p className="text-xs text-gray-500 font-mono">{row.phone}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className="inline-flex items-center justify-center bg-emerald-100 text-emerald-800 w-8 h-8 rounded-full font-bold text-sm">
                                                                {row.lifetime_visits}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-indigo-600 text-right font-bold">
                                                            ₹{row.lifetime_spent.toLocaleString('en-IN')}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-500 text-right">
                                                            {new Date(row.first_visit).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-900 font-medium text-right bg-gray-50/50">
                                                            {new Date(row.latest_visit).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="px-4 py-12 text-center">
                                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                            <FiRefreshCw className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                        <h3 className="text-sm font-medium text-gray-900 mb-1">No Repeat Customers</h3>
                                                        <p className="text-xs text-gray-500">No returning customers were found for the selected period.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : report?.id === 22 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer Information</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Profile Type</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">First Visit Date</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Services Count</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Initial Spent</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {newCustomerData.length > 0 ? (
                                                newCustomerData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <p className="text-sm font-bold text-gray-900">{row.customer_name}</p>
                                                            <p className="text-xs text-gray-500 font-mono">{row.phone}</p>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                                row.is_registered ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'
                                                            }`}>
                                                                {row.is_registered ? 'Registered' : 'Walk-in'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-500 text-right">
                                                            {new Date(row.first_visit).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </td>
                                                        <td className="px-4 py-3 text-center font-bold text-gray-700">
                                                            {row.total_services}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-emerald-600 text-right font-bold">
                                                            ₹{row.total_spent.toLocaleString('en-IN')}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="px-4 py-12 text-center">
                                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                            <FiUserPlus className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                        <h3 className="text-sm font-medium text-gray-900 mb-1">No New Customers</h3>
                                                        <p className="text-xs text-gray-500">No new first-time customers were acquired during this period.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                            ) : report?.id === 21 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer Details</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Profile Type</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Visit Type</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Services Count</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Spent</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {customerSummaryData.length > 0 ? (
                                                customerSummaryData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <p className="text-sm font-bold text-gray-900">{row.customer_name}</p>
                                                            <p className="text-xs text-gray-500 font-mono">{row.phone}</p>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                                row.is_registered ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'
                                                            }`}>
                                                                {row.is_registered ? 'Registered' : 'Walk-in'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                                row.is_returning ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                                            }`}>
                                                                {row.is_returning ? 'Returning' : 'New'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-600 text-center font-medium">
                                                            {row.total_services}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-emerald-600 text-right font-bold">
                                                            ₹{row.total_spent.toLocaleString('en-IN')}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="px-4 py-12 text-center">
                                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                            <FiUsers className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                        <h3 className="text-sm font-medium text-gray-900 mb-1">No Customers Found</h3>
                                                        <p className="text-xs text-gray-500">No customers requested services during this period.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : report?.id === 20 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Service Category</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Total Completed</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Fastest Time</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase text-rose-600">Slowest Time</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase text-indigo-600">Average Turnaround</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {serviceTimeData.length > 0 ? (
                                                serviceTimeData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                            {row.service_name}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-600 text-center">{row.total_requests}</td>
                                                        <td className="px-4 py-3 text-sm text-emerald-600 text-right font-medium">
                                                            {formatDuration(row.min_hours)}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-rose-600 text-right font-medium">
                                                            {formatDuration(row.max_hours)}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-indigo-600 text-right font-bold bg-indigo-50/30">
                                                            {formatDuration(row.avg_hours)}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="px-4 py-12 text-center">
                                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                            <FiClock className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                        <h3 className="text-sm font-medium text-gray-900 mb-1">No Completed Services</h3>
                                                        <p className="text-xs text-gray-500">There is no data to analyze turnaround times for this period.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : report?.id === 19 ? (
                                <div className="p-0">
                                    {(() => {
                                        // Mathematically group the data by Staff Name
                                        const groupedByStaff = {};
                                        staffWiseServicesData.forEach(row => {
                                            if (!groupedByStaff[row.staff_name]) {
                                                groupedByStaff[row.staff_name] = { totalServices: 0, totalProfit: 0, rows: [] };
                                            }
                                            groupedByStaff[row.staff_name].rows.push(row);
                                            groupedByStaff[row.staff_name].totalServices += row.total_requests;
                                            groupedByStaff[row.staff_name].totalProfit += row.gross_profit;
                                        });

                                        return (
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Service Handled</th>
                                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Volume</th>
                                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Revenue Collected</th>
                                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Gross Profit</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {Object.keys(groupedByStaff).length > 0 ? (
                                                        Object.entries(groupedByStaff).map(([staffName, data], groupIdx) => (
                                                            <React.Fragment key={groupIdx}>
                                                                
                                                                {/* 🟦 BEAUTIFUL STAFF BANNER ROW */}
                                                                <tr className="bg-indigo-50/60 border-t border-indigo-100">
                                                                    <td colSpan="4" className="px-4 py-2 text-sm font-bold text-indigo-900">
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="flex items-center">
                                                                                <FiUser className="mr-2 h-4 w-4 text-indigo-500" />
                                                                                {staffName}
                                                                            </div>
                                                                            <div className="flex items-center space-x-4">
                                                                                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-100/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                                                    {data.totalServices} Total Services
                                                                                </span>
                                                                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                                                    ₹{data.totalProfit.toLocaleString('en-IN')} Profit
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>

                                                                {/* 🗂️ SERVICE ROWS UNDERNEATH THE BANNER */}
                                                                {data.rows.map((row, idx) => (
                                                                    <tr key={`${groupIdx}-${idx}`} className="hover:bg-gray-50 transition-colors">
                                                                        <td className="px-4 py-3 text-sm text-gray-900 font-medium pl-8">
                                                                            {row.service_name}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-sm text-gray-600 text-center">{row.total_requests}</td>
                                                                        <td className="px-4 py-3 text-sm text-gray-600 text-right font-medium">₹{row.revenue_collected.toLocaleString('en-IN')}</td>
                                                                        <td className="px-4 py-3 text-sm text-indigo-600 text-right font-bold">
                                                                            ₹{row.gross_profit.toLocaleString('en-IN')}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </React.Fragment>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan="4" className="px-4 py-12 text-center">
                                                                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                                    <FiBriefcase className="h-5 w-5 text-gray-400" />
                                                                </div>
                                                                <h3 className="text-sm font-medium text-gray-900 mb-1">No Services Found</h3>
                                                                <p className="text-xs text-gray-500">No services were completed by the selected staff in this period.</p>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        );
                                    })()}
                                </div>
                            ) : report?.id === 18 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer & Token</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Service Handled</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Timeline</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">TAT (Days)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {completedServicesData.length > 0 ? (
                                                completedServicesData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <p className="text-sm font-bold text-gray-900">{row.customer_name}</p>
                                                            <p className="text-[10px] text-gray-500">{row.phone} • TKN: {row.token_id}</p>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p className="text-sm font-medium text-gray-900 max-w-[200px] truncate" title={row.service_name}>{row.service_name}</p>
                                                            <p className="text-xs text-gray-500">By: {row.assigned_staff}</p>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                                                                {row.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p className="text-[11px] text-gray-500">Applied: {new Date(row.application_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</p>
                                                            <p className="text-xs font-medium text-indigo-600">Finished: {new Date(row.completion_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</p>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span className="text-sm font-bold text-gray-900">
                                                                {row.days_taken} {row.days_taken === 1 ? 'Day' : 'Days'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="px-4 py-12 text-center">
                                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                            <FiCheckCircle className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                        <h3 className="text-sm font-medium text-gray-900 mb-1">No Completed Services</h3>
                                                        <p className="text-xs text-gray-500">No applications reached completion during the selected period.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : report?.id === 17 ? (
                                <div className="p-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Applied On</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer Info</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Service Request</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Age (Days)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {pendingServicesData.length > 0 ? (
                                                pendingServicesData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-sm text-gray-600">
                                                            {new Date(row.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p className="text-sm font-bold text-gray-900">{row.customer_name}</p>
                                                            <p className="text-[10px] text-gray-500">{row.phone} • TKN: {row.token_id}</p>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p className="text-sm font-medium text-gray-900 max-w-[200px] truncate" title={row.service_name}>{row.service_name}</p>
                                                            <p className="text-xs text-gray-500">Assigned: {row.assigned_staff}</p>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                                row.status === 'in_progress' ? 'bg-indigo-100 text-indigo-800' :
                                                                row.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                                            }`}>
                                                                {row.status.replace('_', ' ')}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span className={`text-sm font-bold ${row.days_pending > 14 ? 'text-rose-600' : row.days_pending > 7 ? 'text-amber-500' : 'text-gray-900'}`}>
                                                                {row.days_pending} Days
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="px-4 py-12 text-center">
                                                        <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                            <FiCheckCircle className="h-5 w-5 text-emerald-500" />
                                                        </div>
                                                        <h3 className="text-sm font-medium text-gray-900 mb-1">Queue is Empty!</h3>
                                                        <p className="text-xs text-gray-500">There are no pending applications for this period.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : report?.id === 16 ? (
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

                    {/* CHARTS TAB - LIVE RENDERING with Modern Design */}
                    {activeTab === 'charts' && (
                        <div className="space-y-4">
                            
                            {/* ✅ NEW: Expenses by Wallet Chart (Only shows on the Expense Report) */}
                            {report?.id === 4 && expenseWalletDistribution.length > 0 && (
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4">
                                    <div className="flex items-center space-x-2 mb-3">
                                        <div className="p-1.5 bg-indigo-50 rounded-lg">
                                            <FiPieChart className="h-4 w-4 text-indigo-600" />
                                        </div>
                                        <h3 className="font-semibold text-gray-800 text-sm">Expenses by Source Account</h3>
                                    </div>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <PieChart>
                                            <Pie 
                                                data={expenseWalletDistribution}
                                                dataKey="value" 
                                                nameKey="name" 
                                                cx="50%" cy="50%" 
                                                innerRadius={50} outerRadius={80} 
                                                paddingAngle={2} cornerRadius={4}
                                                animationDuration={800}
                                            >
                                                {expenseWalletDistribution.map((_, idx) => (
                                                    <Cell key={idx} fill={CHART_COLORS[(idx + 2) % CHART_COLORS.length]} stroke="#fff" strokeWidth={2} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltipComponent formatter={formatCurrency} />} />
                                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Attendance Distribution Chart */}
                            {report?.id === 9 && attendancePieData.length > 0 && (
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4">
                                    <div className="flex items-center space-x-2 mb-3">
                                        <div className="p-1.5 bg-indigo-50 rounded-lg">
                                            <FiPieChart className="h-4 w-4 text-indigo-600" />
                                        </div>
                                        <h3 className="font-semibold text-gray-800 text-sm">Overall Attendance Distribution</h3>
                                    </div>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <PieChart>
                                            <Pie 
                                                data={attendancePieData}
                                                dataKey="value" 
                                                nameKey="name" 
                                                cx="50%" cy="50%" 
                                                innerRadius={50} outerRadius={80} 
                                                paddingAngle={2} cornerRadius={4}
                                                animationDuration={800}
                                            >
                                                {attendancePieData.map((entry, idx) => (
                                                    <Cell key={idx} fill={
                                                        entry.name === 'Present' ? '#10B981' : 
                                                        entry.name === 'Absent' ? '#EF4444' : 
                                                        '#F59E0B'
                                                    } stroke="#fff" strokeWidth={2} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltipComponent />} />
                                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
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
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4">
                                <div className="flex items-center space-x-2 mb-3">
                                    <div className="p-1.5 bg-indigo-50 rounded-lg">
                                        <FiPieChart className="h-4 w-4 text-indigo-600" />
                                    </div>
                                    <h3 className="font-semibold text-gray-800 text-sm">Current Wallet Balances</h3>
                                </div>
                                
                                {walletDistribution.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={280}>
                                        <PieChart>
                                            <Pie 
                                                data={walletDistribution}
                                                dataKey="value" 
                                                nameKey="name" 
                                                cx="50%" cy="50%" 
                                                innerRadius={50} outerRadius={80} 
                                                paddingAngle={2} cornerRadius={4}
                                                animationDuration={800}
                                            >
                                                {walletDistribution.map((_, idx) => (
                                                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} stroke="#fff" strokeWidth={2} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltipComponent formatter={formatCurrency} />} />
                                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
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
const ReportsSection = () => {
    
    // Read directly from the browser storage saved during Login.jsx
    const storedRole = localStorage.getItem('role');
    const storedCentreId = localStorage.getItem('centre_id');
    const isSuper = storedRole === 'superadmin';

    // ─── Native Auth State ───
    const [isSuperAdmin] = useState(isSuper);
    const [userCentreId] = useState(storedCentreId);

    // ─── Report States ───
    const [previewData, setPreviewData] = useState(null); 
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [period, setPeriod] = useState('monthly');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    
    // 👇 2. Instantly defaults to 'all' for Superadmin, or locks to specific Centre for Admin
    const [selectedCentre, setSelectedCentre] = useState(isSuper ? 'all' : storedCentreId); 
    const [selectedStaff, setSelectedStaff] = useState('all');
    const [exportFormat, setExportFormat] = useState('pdf');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedReport, setSelectedReport] = useState(null);
    const [favourites, setFavourites] = useState([1, 2, 3]);
    const [scheduledReports, setScheduledReports] = useState([]);
    const [centresList, setCentresList] = useState([]);

    // 👇 3. Only fetch the Centres Dropdown List if they are a Superadmin
    useEffect(() => {
        if (isSuper) {
            const fetchCentres = async () => {
                try {
                    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/centres`, {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setCentresList(data);
                    }
                } catch (error) {
                    console.error("Failed to fetch centres:", error);
                }
            };
            fetchCentres();
        }
    }, [isSuper]);

    // 👇 State and Fetch logic for Staff Dropdown 👇
    const [staffList, setStaffList] = useState([]);

    useEffect(() => {
        const fetchStaff = async () => {
            try {
                // If 'all' is selected, send 'all'. Otherwise, send the specific centre ID.
                // This perfectly matches the route you used in SuperAdminAccountingSection!
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/staff/all?centreId=${selectedCentre}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setStaffList(data);
                }
            } catch (error) {
                console.error("Failed to fetch staff:", error);
            }
        };

        // Fetch staff immediately, and re-fetch anytime the selectedCentre changes
        fetchStaff();
    }, [selectedCentre]);

        // 👇 STATE & FETCH LOGIC FOR QUICK CARDS 👇
    const [quickMetrics, setQuickMetrics] = useState({
        collection: 0, expenses: 0, profit: 0, 
        attendancePresent: 0, attendanceTotal: 0, 
        servicesCount: 0, pendingAmount: 0, isLoading: true
    });
    
        useEffect(() => {
        const fetchQuickMetrics = async () => {
            setQuickMetrics(prev => ({ ...prev, isLoading: true }));
            try {
                // Fetches metrics and reacts if the Superadmin changes the centre filter!
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/reports/quick-metrics?centre_id=${selectedCentre}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setQuickMetrics({ ...data, isLoading: false });
                }
            } catch (error) {
                console.error("Failed to fetch quick metrics:", error);
                setQuickMetrics(prev => ({ ...prev, isLoading: false }));
            }
        };

        fetchQuickMetrics();
    }, [selectedCentre]);

    const fetchSchedules = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/reports/schedules`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setScheduledReports(data);
            }
        } catch (error) {
            console.error("Failed to fetch schedules:", error);
        }
    };

    // Fetch schedules when the component loads
    useEffect(() => {
        fetchSchedules();
    }, []);

    // 👇 ADD THESE NEW LINES HERE 👇
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [scheduleForm, setScheduleForm] = useState({
        name: '',
        report_ids: [],
        frequency: 'daily',
        run_time: '08:00',
        send_to_mode: 'specific', // 👈 NEW: Default to specific emails
        specific_emails: '',      // 👈 NEW: Empty string for text input
        recipient_roles: []       // 👈 CHANGED: Empty by default
    });

    const SCHEDULABLE_REPORTS = [
        { id: 1, name: "Financial Summary" },
        { id: 2, name: "Profit & Loss" },
        { id: 17, name: "Pending Services" },
        { id: 18, name: "Completed Services" },
        { id: 21, name: "Customer Summary" },
        { id: 26, name: "Team Financials" },
        { id: 27, name: "Team Productivity" }
    ];

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

    const toggleScheduled = async (scheduleId) => {
        // Find the current status
        const schedule = scheduledReports.find(s => s.id === scheduleId);
        if (!schedule) return;

        // Optimistic UI Update (flips it instantly for a snappy feel)
        setScheduledReports(prev => prev.map(s => 
            s.id === scheduleId ? { ...s, is_active: !s.is_active } : s
        ));

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/reports/schedules/${scheduleId}/toggle`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (!res.ok) throw new Error("Failed to toggle");
        } catch (error) {
            console.error("Error toggling schedule:", error);
            fetchSchedules(); // If it fails, fetch the real data to revert the UI
        }
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

    // ─── Quick Reports Data (DYNAMIC) ───
    const quickReports = [
        { 
            label: "Today's Collection", 
            value: quickMetrics.isLoading ? '...' : `₹${quickMetrics.collection.toLocaleString('en-IN')}`, 
            icon: FiTrendingUp, color: 'bg-emerald-600' 
        },
        { 
            label: "Today's Expenses", 
            value: quickMetrics.isLoading ? '...' : `₹${quickMetrics.expenses.toLocaleString('en-IN')}`, 
            icon: FiFileText, color: 'bg-rose-600' 
        },
        { 
            label: "Today's Profit", 
            value: quickMetrics.isLoading ? '...' : `₹${quickMetrics.profit.toLocaleString('en-IN')}`, 
            icon: FiDollarSign, color: 'bg-indigo-600' 
        },
        { 
            label: "Today's Attendance", 
            value: quickMetrics.isLoading ? '...' : `${quickMetrics.attendancePresent}/${quickMetrics.attendanceTotal}`, 
            icon: FiUserCheck, color: 'bg-blue-600' 
        },
        { 
            label: "Today's Services", 
            value: quickMetrics.isLoading ? '...' : quickMetrics.servicesCount, 
            icon: FiBriefcase, color: 'bg-purple-600' 
        },
        { 
            label: "Overall Pending", 
            value: quickMetrics.isLoading ? '...' : `₹${quickMetrics.pendingAmount.toLocaleString('en-IN')}`, 
            icon: FiClock, color: 'bg-amber-600' 
        },
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
                                onChange={(e) => {
                                    setSelectedCentre(e.target.value);
                                    setSelectedStaff('all'); 
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                            >
                                <option value="all">All Centres</option>
                                {/* 👇 Maps over your real database centres 👇 */}
                                {centresList.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
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
                            {/* 👇 Maps over the real staff for the selected centre 👇 */}
                            {staffList.map(staffMember => (
                                <option key={staffMember.id} value={staffMember.id}>
                                    {staffMember.name} {staffMember.role ? `(${staffMember.role})` : ''}
                                </option>
                            ))}
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {scheduledReports.map((schedule) => (
                            <ScheduledReportCard
                                key={schedule.id}
                                schedule={schedule}
                                onToggle={toggleScheduled}
                            />
                        ))}
                    </div>
                    <button 
                        onClick={() => setIsScheduleModalOpen(true)}
                        className="mt-3 flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
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

            {/* ─── SCHEDULE CREATION MODAL ─── */}
            {isScheduleModalOpen && (
                <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h3 className="text-lg font-bold text-gray-900">Create Automated Report</h3>
                            <button onClick={() => setIsScheduleModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <FiX className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-4">
                            {/* Schedule Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Name</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g., Morning Financial Summary"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    value={scheduleForm.name}
                                    onChange={(e) => setScheduleForm({...scheduleForm, name: e.target.value})}
                                />
                            </div>

                            {/* Reports Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Select Reports to Include (PDF)</label>
                                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200 h-40 overflow-y-auto">
                                    {SCHEDULABLE_REPORTS.map(rep => (
                                        <label key={rep.id} className="flex items-center space-x-2 text-sm cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                className="rounded text-indigo-600 focus:ring-indigo-500"
                                                checked={scheduleForm.report_ids.includes(rep.id)}
                                                onChange={(e) => {
                                                    if(e.target.checked) {
                                                        setScheduleForm({...scheduleForm, report_ids: [...scheduleForm.report_ids, rep.id]});
                                                    } else {
                                                        setScheduleForm({...scheduleForm, report_ids: scheduleForm.report_ids.filter(id => id !== rep.id)});
                                                    }
                                                }}
                                            />
                                            <span className="text-gray-700 truncate">{rep.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Time & Frequency */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                                    <select 
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                        value={scheduleForm.frequency}
                                        onChange={(e) => setScheduleForm({...scheduleForm, frequency: e.target.value})}
                                    >
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Run Time (24H)</label>
                                    <input 
                                        type="time" 
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                        value={scheduleForm.run_time}
                                        onChange={(e) => setScheduleForm({...scheduleForm, run_time: e.target.value})}
                                    />
                                </div>
                            </div>
                            {/* Smart Delivery Selection */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <label className="block text-sm font-bold text-gray-900 mb-3">Delivery Method</label>
                                
                                {/* The Toggle */}
                                <div className="flex space-x-4 mb-4">
                                    <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                        <input 
                                            type="radio" 
                                            className="text-indigo-600 focus:ring-indigo-500"
                                            checked={scheduleForm.send_to_mode === 'specific'}
                                            onChange={() => setScheduleForm({...scheduleForm, send_to_mode: 'specific', recipient_roles: []})}
                                        />
                                        <span className="font-medium text-gray-700">Specific Emails</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                        <input 
                                            type="radio" 
                                            className="text-indigo-600 focus:ring-indigo-500"
                                            checked={scheduleForm.send_to_mode === 'roles'}
                                            onChange={() => setScheduleForm({...scheduleForm, send_to_mode: 'roles', specific_emails: ''})}
                                        />
                                        <span className="font-medium text-gray-700">Broadcast to Roles</span>
                                    </label>
                                </div>

                                {/* Dynamic Input: Specific Emails */}
                                {scheduleForm.send_to_mode === 'specific' && (
                                    <div>
                                        <input 
                                            type="text" 
                                            placeholder="admin@akshaya.com, staff@akshaya.com"
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                            value={scheduleForm.specific_emails}
                                            onChange={(e) => setScheduleForm({...scheduleForm, specific_emails: e.target.value})}
                                        />
                                        <p className="text-[10px] text-gray-500 mt-1">Separate multiple emails with commas.</p>
                                    </div>
                                )}

                                {/* Dynamic Input: Broadcast Roles */}
                                {scheduleForm.send_to_mode === 'roles' && (
                                    <div>
                                        <div className="flex flex-wrap gap-4">
                                            {['superadmin', 'admin', 'manager', 'staff'].map(role => (
                                                <label key={role} className="flex items-center space-x-2 text-sm cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        className="rounded text-indigo-600 focus:ring-indigo-500"
                                                        checked={scheduleForm.recipient_roles.includes(role)}
                                                        onChange={(e) => {
                                                            if(e.target.checked) setScheduleForm({...scheduleForm, recipient_roles: [...scheduleForm.recipient_roles, role]});
                                                            else setScheduleForm({...scheduleForm, recipient_roles: scheduleForm.recipient_roles.filter(r => r !== role)});
                                                        }}
                                                    />
                                                    <span className="text-gray-700 capitalize">{role}</span>
                                                </label>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-amber-600 mt-1 font-medium">⚠️ Warning: This will send the report to every active user with these roles.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
                            <button 
                                onClick={() => setIsScheduleModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={async () => {
                                    try {
                                        const payload = {
                                            ...scheduleForm,
                                            // Convert comma-separated string into a clean array
                                            specific_emails: scheduleForm.specific_emails 
                                                ? scheduleForm.specific_emails.split(',').map(e => e.trim()).filter(e => e) 
                                                : [],
                                            centre_id: selectedCentre === 'all' ? null : parseInt(selectedCentre)
                                        };

                                        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/reports/schedules`, {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                                            },
                                            body: JSON.stringify(payload)
                                        });

                                        if (res.ok) {
                                            fetchSchedules(); 
                                            setIsScheduleModalOpen(false); 
                                            // Reset form
                                            setScheduleForm({ name: '', report_ids: [], frequency: 'daily', run_time: '08:00', recipient_roles: ['admin', 'superadmin'] });
                                        } else {
                                            alert("Failed to save schedule.");
                                        }
                                    } catch (error) {
                                        console.error("Error saving schedule:", error);
                                        alert("An error occurred.");
                                    }
                                    // 👆 END OF REPLACEMENT 👆
                                }}
                                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                                Save Schedule
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
            {/* 👆 END OF MODAL BLOCK 👆 */}

        </div>
    );
};

export default ReportsSection;