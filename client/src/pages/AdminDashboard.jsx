// src/pages/AdminDashboard.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FiUsers, FiClock, FiCalendar, FiDollarSign,
  FiTrendingUp, FiBarChart2, FiCheckCircle, FiAlertCircle,
  FiUserCheck, FiUserX, FiShoppingBag, FiMessageSquare,
  FiPackage, FiCreditCard, FiActivity, FiBell,
  FiArrowUp, FiArrowDown, FiRefreshCw, FiEye,
  FiFileText, FiAward, FiPercent, FiStar,
  FiLogIn, FiLogOut, FiHome, FiBriefcase,
  FiSmartphone, FiDatabase, FiPieChart
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Import services
import {
  getStaffList,
  getAllAttendance,
  getPendingLeaves,
  getSalaryData,
  getCalendarData
} from '/src/services/salaryService';

import { getServiceEntries, getTrackingEntries } from '/src/services/serviceService';

// ---------------------------------------------------------------------
// Safe Toast Implementation
// ---------------------------------------------------------------------
const createSafeToast = () => {
  let toast = null;
  
  import('react-toastify').then((module) => {
    toast = module.toast;
  }).catch((error) => {
    console.warn('Toast notifications disabled:', error);
    toast = {
      success: (msg) => console.log('SUCCESS:', msg),
      error: (msg) => console.error('ERROR:', msg),
      info: (msg) => console.info('INFO:', msg),
      warn: (msg) => console.warn('WARN:', msg),
    };
  });

  return {
    success: (message, options = {}) => {
      setTimeout(() => {
        if (toast && toast.success) {
          toast.success(message, { position: "top-right", autoClose: 3000, ...options });
        } else {
          console.log('SUCCESS:', message);
        }
      }, 0);
    },
    error: (message, options = {}) => {
      setTimeout(() => {
        if (toast && toast.error) {
          toast.error(message, { position: "top-right", autoClose: 3000, ...options });
        } else {
          console.error('ERROR:', message);
        }
      }, 0);
    },
    info: (message, options = {}) => {
      setTimeout(() => {
        if (toast && toast.info) {
          toast.info(message, { position: "top-right", autoClose: 2000, ...options });
        } else {
          console.info('INFO:', message);
        }
      }, 0);
    },
    warn: (message, options = {}) => {
      setTimeout(() => {
        if (toast && toast.warn) {
          toast.warn(message, { position: "top-right", autoClose: 3000, ...options });
        } else {
          console.warn('WARN:', message);
        }
      }, 0);
    }
  };
};

const toast = createSafeToast();

// ---------------------------------------------------------------------
// UI Components (StatCard, QuickActionCard, DashboardCard, RecentActivityItem)
// ---------------------------------------------------------------------
const StatCard = ({ title, value, icon: Icon, color, subtitle, trend, onClick }) => (
  <motion.div
    whileHover={{ y: -4, scale: 1.02 }}
    onClick={onClick}
    className={`bg-white rounded-xl border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 cursor-pointer ${onClick ? 'hover:border-indigo-300' : ''}`}
  >
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
        <div className="flex items-end space-x-2">
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {trend !== undefined && (
            <div className={`flex items-center text-xs font-medium ${trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-rose-600' : 'text-gray-500'}`}>
              {trend > 0 ? <FiArrowUp className="h-3 w-3" /> : <FiArrowDown className="h-3 w-3" />}
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      </div>
      <div className={`p-3 rounded-xl ${color} shadow-md`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
    </div>
  </motion.div>
);

const QuickActionCard = ({ title, description, icon: Icon, color, onClick, buttonText = "View" }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-all duration-300"
  >
    <div className="flex items-start space-x-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900 text-sm mb-1">{title}</h3>
        <p className="text-xs text-gray-600 mb-3">{description}</p>
        <button
          onClick={onClick}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-medium"
        >
          {buttonText}
        </button>
      </div>
    </div>
  </motion.div>
);

const DashboardCard = ({ title, icon: Icon, children, className = "", headerAction }) => (
  <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${className}`}>
    <div className="p-4 border-b border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {Icon && <Icon className="h-4 w-4 text-indigo-600" />}
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        </div>
        {headerAction}
      </div>
    </div>
    <div className="p-4">
      {children}
    </div>
  </div>
);

const RecentActivityItem = ({ icon: Icon, title, description, time, color = "text-blue-600", bg = "bg-blue-50" }) => (
  <div className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
    <div className={`p-1.5 rounded ${bg} flex-shrink-0`}>
      <Icon className={`h-3 w-3 ${color}`} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-gray-900 truncate">{title}</p>
      <p className="text-xs text-gray-600 truncate">{description}</p>
    </div>
    <span className="text-xs text-gray-500 flex-shrink-0">{time}</span>
  </div>
);

// ---------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------
const normalizeDate = (dateStr) => {
  try {
    if (!dateStr) return '';
    let date;
    if (dateStr instanceof Date) date = dateStr;
    else if (typeof dateStr === 'string' && dateStr.includes('GMT')) date = new Date(dateStr);
    else if (typeof dateStr === 'string' && dateStr.includes('T')) date = new Date(dateStr);
    else if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) date = new Date(dateStr + 'T00:00:00');
    else date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  } catch (e) {
    console.error('Error normalizing date:', e);
    return '';
  }
};

const getCurrentMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getCurrentDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const getLast12Months = () => {
  const months = [];
  const now = new Date();
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    });
  }
  
  return months;
};

// Safe array function
const safeArray = (data) => {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    if (data.data && Array.isArray(data.data)) return data.data;
    if (data.results && Array.isArray(data.results)) return data.results;
    if (data.items && Array.isArray(data.items)) return data.items;
    if (data.rows && Array.isArray(data.rows)) return data.rows;
  }
  return [];
};


// ---------------------------------------------------------------------
// Chart Components
// ---------------------------------------------------------------------
const AttendanceTrendChart = ({ attendanceData = [] }) => {
  // Backend now returns an array of objects: { day: 'Mon', present: 5, late: 1 }
  const chartData = {
    labels: attendanceData.map(d => d.day),
    datasets: [
      {
        label: 'Present',
        data: attendanceData.map(d => Number(d.present) || 0),
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Late',
        data: attendanceData.map(d => Number(d.late) || 0),
        backgroundColor: 'rgba(245, 158, 11, 0.5)',
        borderColor: 'rgb(245, 158, 11)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { font: { size: 11 } } },
    },
    scales: {
      y: { beginAtZero: true, ticks: { font: { size: 10 } } },
      x: { ticks: { font: { size: 10 } } }
    },
  };

  return (
    <div className="h-48">
      {attendanceData.length > 0 ? (
        <Line data={chartData} options={options} />
      ) : (
         <div className="h-full flex items-center justify-center">
          <p className="text-gray-500 text-sm">No attendance data</p>
        </div>
      )}
    </div>
  );
};

const ServiceStatusChart = ({ services = {} }) => {
  // Backend now returns the exact counts object directly
  const data = {
    labels: ['Pending', 'In Progress', 'Completed', 'Delayed'],
    datasets: [{
      data: [
        Number(services?.pending_services || 0),
        Number(services?.in_progress_services || 0),
        Number(services?.completed_services || 0),
        Number(services?.delayed_services || 0)
      ],
      backgroundColor: [
        'rgba(245, 158, 11, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(239, 68, 68, 0.8)',
      ],
      borderColor: [
        'rgb(245, 158, 11)',
        'rgb(59, 130, 246)',
        'rgb(16, 185, 129)',
        'rgb(239, 68, 68)',
      ],
      borderWidth: 2,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { font: { size: 10 }, boxWidth: 10 } },
    },
    cutout: '65%',
  };

  const hasData = Object.values(services).some(val => Number(val) > 0);

  return (
    <div className="h-48">
      {hasData ? (
        <Doughnut data={data} options={options} />
      ) : (
        <div className="h-full flex items-center justify-center">
          <p className="text-gray-500 text-sm">No service data available</p>
        </div>
      )}
    </div>
  );
};

const RevenueChart = ({ monthlyRevenueData = [], labels = [] }) => {
  const chartData = {
    labels: labels.length > 0 ? labels : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        label: 'Revenue (₹)',
        data: monthlyRevenueData,
        backgroundColor: 'rgba(99, 102, 241, 0.5)',
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 2,
        borderRadius: 4,
      }
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              label += '₹' + context.parsed.y.toLocaleString('en-IN');
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return '₹' + (value / 1000).toFixed(0) + 'k';
          },
          font: { size: 10 }
        },
      },
      x: {
        ticks: { font: { size: 10 } }
      }
    },
  };

  return (
    <div className="h-48">
      <Bar data={chartData} options={options} />
    </div>
  );
};

const DailyRevenueChart = ({ dailyData = [], labels = [] }) => {
  const chartData = {
    labels: labels.length > 0 ? labels : Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    }),
    datasets: [
      {
        label: 'Daily Revenue',
        data: dailyData,
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
      }
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function(context) {
            return '₹' + context.parsed.y.toLocaleString('en-IN');
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return '₹' + (value / 1000).toFixed(0) + 'k';
          },
          font: { size: 10 }
        }
      },
      x: {
        ticks: { font: { size: 10 } }
      }
    },
  };

  return (
    <div className="h-48">
      <Line data={chartData} options={options} />
    </div>
  );
};

// ---------------------------------------------------------------------
// NEW WIDGET COMPONENTS
// ---------------------------------------------------------------------
const StaffLeaderboard = ({ staffData = [] }) => {
  const topStaff = [...staffData]
    .sort((a, b) => (Number(b.total_revenue) || 0) - (Number(a.total_revenue) || 0))
    .slice(0, 5);

  if (topStaff.length === 0) return <div className="p-4 text-sm text-gray-500 text-center">No staff data available yet.</div>;

  return (
    <div className="space-y-4">
      {topStaff.map((staff, i) => (
        <div key={i} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition-all">
          <div className="flex items-center space-x-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-200 text-gray-700' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-indigo-50 text-indigo-700'}`}>
              #{i + 1}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{staff.staff_name || staff.name}</p>
              <p className="text-xs text-gray-500">{staff.service_count || 0} services completed</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-emerald-600">₹{Number(staff.total_revenue || 0).toLocaleString('en-IN')}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const LiveTransactionFeed = ({ transactions = [] }) => {
  if (transactions.length === 0) return <div className="p-4 text-sm text-gray-500 text-center">No recent transactions.</div>;

  return (
    <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
      {transactions.map((txn, i) => {
        const isCredit = txn.transactionType === 'credit';
        return (
          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-full ${isCredit ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                {isCredit ? <FiArrowDown className="h-4 w-4 text-emerald-600" /> : <FiArrowUp className="h-4 w-4 text-rose-600" />}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900 truncate max-w-[150px]">{txn.category || 'Transaction'}</p>
                <p className="text-[10px] text-gray-500">{txn.localTime || new Date().toLocaleTimeString()} • {txn.fromWalletName || txn.toWalletName || 'Wallet'}</p>
              </div>
            </div>
            <span className={`text-sm font-bold ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isCredit ? '+' : '-'}₹{Number(txn.amount).toLocaleString('en-IN')}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const NightlyCloseAlert = ({ closingData }) => {
  if (!closingData || !closingData.data) {
    return (
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start space-x-3">
        <FiAlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-amber-900">Yesterday's Register Unclosed</h4>
          <p className="text-xs text-amber-700 mt-1">The accounting day for yesterday was not formally closed. Please verify cash balances.</p>
        </div>
      </div>
    );
  }

  const variance = Number(closingData.data.cash_variance || 0);
  const isPerfect = variance === 0;

  return (
    <div className={`p-4 rounded-xl border flex items-start space-x-3 ${isPerfect ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
      {isPerfect ? <FiCheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" /> : <FiAlertCircle className="h-5 w-5 text-rose-600 mt-0.5" />}
      <div>
        <h4 className={`text-sm font-semibold ${isPerfect ? 'text-emerald-900' : 'text-rose-900'}`}>
          {isPerfect ? "Register Closed Perfectly" : "Cash Variance Detected"}
        </h4>
        <p className={`text-xs mt-1 ${isPerfect ? 'text-emerald-700' : 'text-rose-700'}`}>
          {isPerfect 
            ? "Yesterday's physical cash matched the digital ledger exactly." 
            : `Yesterday's closing reported a variance of ₹${variance.toLocaleString('en-IN')}. Check the accounting logs.`}
        </p>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// MAIN DASHBOARD COMPONENT
// ---------------------------------------------------------------------
const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalStaff: 0,
    presentToday: 0,
    pendingLeaves: 0,
    pendingServices: 0,
    monthlyRevenue: 0,
    attendanceRate: 0,
    salaryPending: 0,
    servicesCompleted: 0,
    averageOrderValue: 0,  // new
    
    // Financial stats
    todayRevenue: 0,
    todayExpenses: 0,
    todayProfit: 0,
    pendingPayments: 0,
    cashInHand: 0,
    bankBalance: 0,
    digitalBalance: 0,
    totalWalletBalance: 0,
  });
  
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);
  const [services, setServices] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [salaryData, setSalaryData] = useState([]);
  const [staffList, setStaffList] = useState([]);
  
  // Financial data states
  const [dailyRevenueData, setDailyRevenueData] = useState([]);
  const [dailyRevenueLabels, setDailyRevenueLabels] = useState([]);
  const [monthlyRevenueData, setMonthlyRevenueData] = useState([]);
  const [monthlyRevenueLabels, setMonthlyRevenueLabels] = useState([]);
  const [pendingPaymentsList, setPendingPaymentsList] = useState([]);
  const [walletSummary, setWalletSummary] = useState([]);
  
  // New widget states
  const [topStaffData, setTopStaffData] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [yesterdayClosing, setYesterdayClosing] = useState(null);
  const [reviewStats, setReviewStats] = useState({ rating: 0, count: 0 });
  
  const [currentMonth] = useState(getCurrentMonth());
  const isMountedRef = useRef(true);

  // Load dashboard data
  useEffect(() => {
    isMountedRef.current = true;
    
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/analytics/admin/dashboard`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error("Failed to fetch dashboard data");
        const dashboardData = await res.json();

        if (!isMountedRef.current) return;

        // Instantly populate all dashboard states from the single response
        setStats(dashboardData.stats);
        setReviewStats(dashboardData.customerSatisfaction);
        
        setAttendanceData(dashboardData.charts.attendanceTrend);
        setServices(dashboardData.charts.serviceStatus); 
        setDailyRevenueData(dashboardData.charts.dailyRevenue.data);
        setDailyRevenueLabels(dashboardData.charts.dailyRevenue.labels);
        setMonthlyRevenueData(dashboardData.charts.monthlyRevenue);
        
        setTopStaffData(dashboardData.lists.topStaff);
        setRecentTransactions(dashboardData.lists.recentTransactions);
        setYesterdayClosing(dashboardData.alerts.yesterdayClosing);

        // Generate Recent Activity Notification Feed
        const activities = [];
        if (dashboardData.stats.todayRevenue > 0) {
          activities.push({
            icon: FiDollarSign,
            title: 'Revenue recorded',
            description: `₹${dashboardData.stats.todayRevenue.toLocaleString('en-IN')} collected today`,
            time: 'Today',
            color: 'text-emerald-600',
            bg: 'bg-emerald-50'
          });
        }
        if (dashboardData.stats.pendingPayments > 0) {
          activities.push({
            icon: FiAlertCircle,
            title: 'Pending payments',
            description: `${dashboardData.stats.pendingPayments} customers owe ₹${dashboardData.stats.pendingPaymentsTotal.toLocaleString('en-IN')}`,
            time: 'Due now',
            color: 'text-amber-600',
            bg: 'bg-amber-50'
          });
        }
        if (dashboardData.stats.pendingLeaves > 0) {
          activities.push({
            icon: FiCalendar,
            title: 'Leave requests',
            description: `${dashboardData.stats.pendingLeaves} pending approval`,
            time: 'Today',
            color: 'text-blue-600',
            bg: 'bg-blue-50'
          });
        }
        if (dashboardData.stats.pendingServices > 0) {
          activities.push({
            icon: FiShoppingBag,
            title: 'Pending services',
            description: `${dashboardData.stats.pendingServices} need attention`,
            time: 'Active',
            color: 'text-indigo-600',
            bg: 'bg-indigo-50'
          });
        }
        setRecentActivity(activities.slice(0, 5));

        toast.success(`Dashboard metrics synced.`);

      } catch (error) {
        console.error('Failed to load dashboard data:', error);
        if (isMountedRef.current) {
          toast.error('Failed to load dashboard data');
          setRecentActivity([
            {
              icon: FiAlertCircle,
              title: 'Data load error',
              description: 'Some data may be unavailable',
              time: 'Just now',
              color: 'text-rose-600',
              bg: 'bg-rose-50'
            }
          ]);
        }
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    };

    loadDashboardData();
    
    return () => { isMountedRef.current = false; };
  }, []);

  // Handle refresh (kept minimal, only refreshing financial summary & pending payments)
  const handleRefresh = async () => {
    toast.info('Refreshing data...');
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/analytics/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      const dashboardData = await res.json();
      
      if (!isMountedRef.current) return;
      
      setStats(dashboardData.stats);
      setReviewStats(dashboardData.customerSatisfaction);
      setAttendanceData(dashboardData.charts.attendanceTrend);
      setServices(dashboardData.charts.serviceStatus); 
      setDailyRevenueData(dashboardData.charts.dailyRevenue.data);
      setDailyRevenueLabels(dashboardData.charts.dailyRevenue.labels);
      setMonthlyRevenueData(dashboardData.charts.monthlyRevenue);
      setTopStaffData(dashboardData.lists.topStaff);
      setRecentTransactions(dashboardData.lists.recentTransactions);
      setYesterdayClosing(dashboardData.alerts.yesterdayClosing);
      
      toast.success('Data refreshed successfully');
    } catch (error) {
      console.error('Refresh failed:', error);
      if (isMountedRef.current) toast.error('Failed to refresh data');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  // Navigation handlers
  const navigateToAttendance = () => window.location.href = '/dashboard/admin/attendancemanagement';
  const navigateToLeaves = () => window.location.href = '/dashboard/admin/attendancemanagement?tab=leave';
  const navigateToSalary = () => window.location.href = '/dashboard/admin/attendancemanagement?tab=salary';
  const navigateToServices = () => window.location.href = '/dashboard/admin/servicelogs';
  const navigateToWallets = () => window.location.href = '/dashboard/admin/wallets';
  const navigateToReports = () => window.location.href = '/dashboard/admin/reports';
  const navigateToPendingPayments = () => window.location.href = '/dashboard/admin/reports?tab=pendingPayments';

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Welcome back! Here's your business overview.</p>
            <p className="text-sm text-gray-500 mt-1">
              Last updated: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRefresh}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-sm">Refresh</span>
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative">
              <FiBell className="h-5 w-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid - Row 1: Staff & Operations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Staff"
          value={stats.totalStaff}
          subtitle={`${stats.attendanceRate}% present today`}
          icon={FiUsers}
          color="bg-blue-500"
          trend={stats.attendanceRate > 80 ? 2.5 : -1.5}
          onClick={navigateToAttendance}
        />
        <StatCard
          title="Pending Leaves"
          value={stats.pendingLeaves}
          subtitle="Requiring approval"
          icon={FiCalendar}
          color="bg-amber-500"
          trend={stats.pendingLeaves > 5 ? 8.7 : -2.3}
          onClick={navigateToLeaves}
        />
        <StatCard
          title="Active Services"
          value={stats.pendingServices}
          subtitle={`${stats.servicesCompleted} completed`}
          icon={FiShoppingBag}
          color="bg-indigo-500"
          trend={stats.pendingServices > 10 ? 12.3 : -5.6}
          onClick={navigateToServices}
        />
        <StatCard
          title="Monthly Revenue"
          value={`₹${(stats.monthlyRevenue / 1000).toFixed(0)}k`}
          subtitle={`${stats.salaryPending} salaries pending`}
          icon={FiDollarSign}
          color="bg-emerald-500"
          trend={stats.monthlyRevenue > 500000 ? 15.2 : 3.4}
          onClick={navigateToSalary}
        />
      </div>

      {/* Row 2: Financial Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        <StatCard
          title="Today's Revenue"
          value={`₹${(stats.todayRevenue || 0).toLocaleString('en-IN')}`}
          subtitle={`₹${(stats.todayProfit || 0).toLocaleString('en-IN')} profit`}
          icon={FiTrendingUp}
          color="bg-emerald-600"
          trend={stats.todayProfit > 0 ? 8.5 : -2.1}
          onClick={navigateToReports}
        />
        <StatCard
          title="Pending Payments"
          value={`₹${(stats.pendingPaymentsTotal || 0).toLocaleString('en-IN')}`}
          subtitle={`${stats.pendingPayments || 0} customers`}
          icon={FiAlertCircle}
          color="bg-amber-600"
          trend={stats.pendingPayments > 10 ? 12.3 : -5.6}
          onClick={navigateToPendingPayments}
        />
        <StatCard
          title="Cash in Hand"
          value={`₹${(stats.cashInHand || 0).toLocaleString('en-IN')}`}
          subtitle="Physical cash"
          icon={FiHome}
          color="bg-blue-600"
          onClick={navigateToReports}
        />
        <StatCard
          title="Total Wallets"
          value={`₹${(stats.totalWalletBalance || 0).toLocaleString('en-IN')}`}
          subtitle="All accounts"
          icon={FiSmartphone}
          color="bg-purple-600"
          onClick={navigateToWallets}
        />
      </div>

      {/* Row 3: New Performance Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        <StatCard
          title="Average Order Value"
          value={`₹${(stats.averageOrderValue || 0).toLocaleString('en-IN')}`}
          subtitle="Per completed service today"
          icon={FiShoppingBag}
          color="bg-teal-600"
        />
        <StatCard
          title="Customer Satisfaction"
          value={`${reviewStats.rating} / 5`}
          subtitle={`Based on ${reviewStats.count} reviews this month`}
          icon={FiStar}
          color="bg-yellow-500"
          onClick={() => window.location.href = '/admin/reports?tab=reviews'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <DashboardCard 
          title="Attendance Trends (Last 7 Days)" 
          icon={FiTrendingUp}
          headerAction={
            <button onClick={navigateToAttendance} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              View Details
            </button>
          }
        >
          <AttendanceTrendChart attendanceData={attendanceData} />
        </DashboardCard>
        
        <DashboardCard 
          title="Service Status" 
          icon={FiBarChart2}
          headerAction={
            <button onClick={navigateToServices} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              View All
            </button>
          }
        >
          <ServiceStatusChart services={services} />
        </DashboardCard>
      </div>

      {/* Daily Revenue Chart */}
      <div className="mt-6">
        <DashboardCard 
          title="Daily Revenue (Last 7 Days)" 
          icon={FiDollarSign}
          headerAction={
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">
                Today: ₹{(stats.todayRevenue || 0).toLocaleString('en-IN')}
              </span>
              <button onClick={navigateToReports} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                View Reports
              </button>
            </div>
          }
        >
          <DailyRevenueChart dailyData={dailyRevenueData} labels={dailyRevenueLabels} />
        </DashboardCard>
      </div>

      {/* Monthly Revenue Chart */}
      <div className="mt-6">
        <DashboardCard 
          title="Monthly Revenue Overview" 
          icon={FiBarChart2}
          headerAction={
            <div className="flex items-center space-x-2">
              <select className="border border-gray-300 rounded px-2 py-1 text-xs">
                <option>Last 12 Months</option>
                <option>This Year</option>
                <option>Last Year</option>
              </select>
              <button onClick={navigateToReports} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                Export
              </button>
            </div>
          }
        >
          <RevenueChart monthlyRevenueData={monthlyRevenueData} labels={monthlyRevenueLabels} />
        </DashboardCard>
      </div>

      {/* New Widgets Row: Leaderboard & Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        
        {/* Top Performing Staff Leaderboard */}
        <div className="lg:col-span-1">
          <DashboardCard 
            title="Top Performing Staff" 
            icon={FiAward}
            headerAction={<span className="text-xs font-medium text-gray-500">This Month</span>}
          >
            <StaffLeaderboard staffData={topStaffData} />
          </DashboardCard>
        </div>

        {/* Live Transaction Feed */}
        <div className="lg:col-span-1">
          <DashboardCard 
            title="Live Transactions" 
            icon={FiActivity}
            headerAction={<button onClick={navigateToReports} className="text-xs text-indigo-600">View Ledger</button>}
          >
            <LiveTransactionFeed transactions={recentTransactions} />
          </DashboardCard>
        </div>

        {/* System Alerts & Expenses */}
        <div className="lg:col-span-1 space-y-4">
          <NightlyCloseAlert closingData={yesterdayClosing} />
          
          <DashboardCard title="Quick Metrics" icon={FiPieChart}>
             <div className="space-y-4">
                <div>
                   <div className="flex justify-between text-sm mb-1">
                     <span className="text-gray-600">Today's Profit Margin</span>
                     <span className="font-bold text-gray-900">
                        {stats.todayRevenue > 0 ? Math.round((stats.todayProfit / stats.todayRevenue) * 100) : 0}%
                     </span>
                   </div>
                   <div className="w-full bg-gray-200 rounded-full h-2">
                     <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${stats.todayRevenue > 0 ? Math.max(0, Math.min((stats.todayProfit / stats.todayRevenue) * 100, 100)) : 0}%` }}></div>
                   </div>
                </div>
             </div>
          </DashboardCard>
        </div>

      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <div className="lg:col-span-2">
          <DashboardCard title="Quick Actions" icon={FiActivity}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <QuickActionCard
                title="Process Salaries"
                description={`${stats.salaryPending} salaries pending for ${getCurrentMonth()}`}
                icon={FiCreditCard}
                color="bg-green-500"
                buttonText="Process"
                onClick={navigateToSalary}
              />
              <QuickActionCard
                title="Review Leaves"
                description={`${stats.pendingLeaves} leave requests pending`}
                icon={FiCalendar}
                color="bg-amber-500"
                onClick={navigateToLeaves}
              />
              <QuickActionCard
                title="Collect Payments"
                description={`${stats.pendingPayments} customers owe ₹${(stats.pendingPaymentsTotal || 0).toLocaleString('en-IN')}`}
                icon={FiDollarSign}
                color="bg-emerald-500"
                buttonText="Collect"
                onClick={navigateToPendingPayments}
              />
              <QuickActionCard
                title="View Reports"
                description="Financial & performance reports"
                icon={FiFileText}
                color="bg-indigo-500"
                buttonText="View"
                onClick={navigateToReports}
              />
            </div>
          </DashboardCard>
        </div>
        
        <DashboardCard 
          title="Recent Activity" 
          icon={FiBell}
          headerAction={<button className="text-xs text-gray-500 hover:text-gray-700">See All</button>}
        >
          <div className="space-y-1">
            {recentActivity.map((activity, index) => (
              <RecentActivityItem key={index} {...activity} />
            ))}
          </div>
        </DashboardCard>
      </div>

      {/* Wallet & Payment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <DashboardCard title="Wallet Summary" icon={FiDatabase}>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center">
                <FiHome className="h-4 w-4 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-gray-700">Cash in Hand</span>
              </div>
              <span className="font-bold text-gray-900">₹{(stats.cashInHand || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
              <div className="flex items-center">
                <FiCreditCard className="h-4 w-4 text-indigo-600 mr-2" />
                <span className="text-sm font-medium text-gray-700">Bank Balance</span>
              </div>
              <span className="font-bold text-gray-900">₹{(stats.bankBalance || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center">
                <FiSmartphone className="h-4 w-4 text-purple-600 mr-2" />
                <span className="text-sm font-medium text-gray-700">Digital Balance</span>
              </div>
              <span className="font-bold text-gray-900">₹{(stats.digitalBalance || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="pt-2">
              <button onClick={navigateToReports} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                View All Wallets →
              </button>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard title="Today's Financial Summary" icon={FiPieChart}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Revenue Collected</span>
              <span className="font-bold text-emerald-600">₹{(stats.todayRevenue || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Expenses</span>
              <span className="font-bold text-rose-600">₹{(stats.todayExpenses || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="border-t border-gray-200 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Net Profit</span>
                <span className={`font-bold ${(stats.todayProfit || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  ₹{(stats.todayProfit || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className={`h-2 rounded-full ${(stats.todayProfit || 0) >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  style={{ width: `${stats.todayRevenue > 0 ? Math.min(Math.abs((stats.todayProfit / stats.todayRevenue) * 100), 100) : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </DashboardCard>
      </div>
    </div>
  );
};

export default AdminDashboard;
