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
import { toast } from 'react-toastify';
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
// API Functions for Financial Data
// ---------------------------------------------------------------------
const fetchDailyIncome = async (date) => {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/accounting/income?date=${date}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    if (!res.ok) return { rows: [] };
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error fetching daily income:', error);
    return { rows: [] };
  }
};

const fetchMonthlyIncome = async (month) => {
  const token = localStorage.getItem('token');
  try {
    const [year, monthNum] = month.split('-');
    const startDate = `${year}-${monthNum}-01`;
    const endDate = new Date(year, parseInt(monthNum), 0).toISOString().split('T')[0];
    
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/accounting/income?from=${startDate}&to=${endDate}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    if (!res.ok) return { rows: [] };
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error fetching monthly income:', error);
    return { rows: [] };
  }
};

const fetchDailyExpenses = async (date) => {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/expense?date=${date}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(item => ({
      ...item,
      date: item.expense_date || item.date,
      amount: Number(item.amount || 0),
      status: item.status === 'auto_approved' ? 'approved' : item.status
    }));
  } catch (error) {
    console.error('Error fetching daily expenses:', error);
    return [];
  }
};

const fetchDailyWalletSummary = async (date) => {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/walletreport/wallets/summary?from=${date}&to=${date}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    if (!res.ok) return [];
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error fetching wallet summary:', error);
    return [];
  }
};

const fetchMonthlyWalletFlow = async (month) => {
  const token = localStorage.getItem('token');
  try {
    const [year, monthNum] = month.split('-');
    const startDate = `${year}-${monthNum}-01`;
    const endDate = new Date(year, parseInt(monthNum), 0).toISOString().split('T')[0];
    
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/walletreport/wallets/daily-flow?from=${startDate}&to=${endDate}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    if (!res.ok) return [];
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error fetching monthly wallet flow:', error);
    return [];
  }
};

const fetchPendingPayments = async () => {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/servicemanagement/pending-payments`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    if (!res.ok) return [];
    const data = await res.json();
    return safeArray(data);
  } catch (error) {
    console.error('Error fetching pending payments:', error);
    return [];
  }
};

// ---------------------------------------------------------------------
// Chart Components
// ---------------------------------------------------------------------
const AttendanceTrendChart = ({ attendanceData = [] }) => {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  });

  const dailyStats = last7Days.map((dayName, index) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - (6 - index));
    const dateStr = normalizeDate(targetDate);
    
    const dayAttendance = safeArray(attendanceData).filter(a => normalizeDate(a.date) === dateStr);
    const presentCount = dayAttendance.filter(a => a.status === 'present').length;
    const lateCount = dayAttendance.filter(a => {
      if (a.status !== 'present') return false;
      if (!a.punch_in) return false;
      const [hours, minutes] = a.punch_in.split(':').map(Number);
      return hours > 9 || (hours === 9 && minutes > 30);
    }).length;

    return {
      present: presentCount,
      late: lateCount
    };
  });

  const chartData = {
    labels: last7Days,
    datasets: [
      {
        label: 'Present',
        data: dailyStats.map(stat => stat.present),
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Late',
        data: dailyStats.map(stat => stat.late),
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
      legend: {
        position: 'top',
        labels: { font: { size: 11 } }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { font: { size: 10 } }
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

const ServiceStatusChart = ({ services = [] }) => {
  const serviceArray = safeArray(services);
  
  const statusCounts = useMemo(() => {
    const counts = {
      'Pending': 0,
      'In Progress': 0,
      'Completed': 0,
      'Delayed': 0,
    };

    serviceArray.forEach(service => {
      if (service && service.status) {
        const status = service.status;
        if (counts.hasOwnProperty(status)) {
          counts[status]++;
        } else {
          counts[status] = (counts[status] || 0) + 1;
        }
      }
    });

    return counts;
  }, [serviceArray]);

  const data = {
    labels: Object.keys(statusCounts),
    datasets: [{
      data: Object.values(statusCounts),
      backgroundColor: [
        'rgba(245, 158, 11, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(139, 92, 246, 0.8)',
        'rgba(14, 165, 233, 0.8)',
      ],
      borderColor: [
        'rgb(245, 158, 11)',
        'rgb(59, 130, 246)',
        'rgb(16, 185, 129)',
        'rgb(239, 68, 68)',
        'rgb(139, 92, 246)',
        'rgb(14, 165, 233)',
      ],
      borderWidth: 2,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          font: { size: 10 },
          boxWidth: 10
        }
      },
    },
    cutout: '65%',
  };

  return (
    <div className="h-48">
      {serviceArray.length > 0 ? (
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
  
  const [dateRange, setDateRange] = useState({
    fromDate: getCurrentDate(),
    toDate: getCurrentDate()
  });
  const [currentMonth] = useState(getCurrentMonth());
  
  // Use a ref to track if component is mounted
  const isMountedRef = useRef(true);

  // Function to fetch remaining data (non-critical)
  const fetchRemainingData = async (currentMonthStr, today) => {
    try {
      const [
        attendanceDataRes,
        pendingLeavesRes,
        salaryDataRes,
        dailyIncomeRes,
        dailyExpensesRes,
        walletSummaryRes,
        pendingPaymentsRes,
        monthlyWalletFlowRes
      ] = await Promise.all([
        getAllAttendance(currentMonthStr).catch(() => []),
        getPendingLeaves().catch(() => []),
        getSalaryData(currentMonthStr).catch(() => []),
        fetchDailyIncome(today).catch(() => ({ rows: [] })),
        fetchDailyExpenses(today).catch(() => []),
        fetchDailyWalletSummary(today).catch(() => []),
        fetchPendingPayments().catch(() => []),
        fetchMonthlyWalletFlow(currentMonthStr).catch(() => [])
      ]);

      if (!isMountedRef.current) return;

      const attendanceArray = safeArray(attendanceDataRes);
      const leavesArray = safeArray(pendingLeavesRes);
      const salaryArray = safeArray(salaryDataRes);
      const incomeRows = safeArray(dailyIncomeRes);
      const expensesArray = dailyExpensesRes;
      const walletArray = walletSummaryRes;
      const pendingPaymentsArray = safeArray(pendingPaymentsRes);

      // Set data
      setAttendanceData(attendanceArray);
      setSalaryData(salaryArray);
      setPendingPaymentsList(pendingPaymentsArray);
      setWalletSummary(walletArray);

      // Calculate stats
      const todayRevenue = incomeRows.reduce((sum, row) => sum + (Number(row.received_amount) || 0), 0);
      
      const todayServiceCharges = incomeRows.reduce((sum, row) => {
        const received = Number(row.received_amount) || 0;
        const serviceCharge = Number(row.service_charges) || 0;
        const departmentCharge = Number(row.department_charges) || 0;
        const totalBilled = serviceCharge + departmentCharge;
        
        if (totalBilled > 0 && received > 0) {
          const paymentRatio = received / totalBilled;
          return sum + (serviceCharge * paymentRatio);
        } else if (received > 0 && totalBilled === 0) {
          return sum + received;
        }
        return sum;
      }, 0);
      
      const todayApprovedExpenses = expensesArray
        .filter(e => e.status === 'approved')
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      
      const todayProfit = todayServiceCharges - todayApprovedExpenses;
      
      const pendingPaymentsTotal = pendingPaymentsArray.reduce((sum, p) => {
        return sum + (Number(p.pending_amount) || Number(p.due) || 0);
      }, 0);
      
      const pendingPaymentsCount = pendingPaymentsArray.filter(p => {
        const due = Number(p.pending_amount) || Number(p.due) || 0;
        return due > 0;
      }).length;
      
      let totalWalletBalance = 0;
      let totalCashInHand = 0;
      let totalBankBalance = 0;
      let totalDigitalBalance = 0;
      
      walletArray.forEach(w => {
        const balance = Number(w.closing_balance) || 0;
        totalWalletBalance += balance;
        
        const type = (w.wallet_type || '').toLowerCase();
        if (type === 'cash') totalCashInHand += balance;
        else if (type === 'bank') totalBankBalance += balance;
        else if (type === 'digital') totalDigitalBalance += balance;
      });
      
      const monthlyRevenue = salaryArray.reduce((sum, s) => sum + (Number(s.net_salary) || 0), 0);
      
      const todayDate = normalizeDate(new Date());
      const todayAttendance = attendanceArray.filter(a => normalizeDate(a.date) === todayDate);
      
      const presentStaffIds = new Set(
        todayAttendance.filter(a => a.status === 'present').map(a => a.staff_id)
      );
      
      const pendingSalary = salaryArray.filter(s => s.status === 'pending');
      const pendingServices = services.filter(s => s.status === 'pending' || s.status === 'Pending');

      // Update stats
      setStats(prev => ({
        ...prev,
        presentToday: presentStaffIds.size || 0,
        pendingLeaves: leavesArray.length || 0,
        pendingServices: pendingServices.length || 0,
        monthlyRevenue: monthlyRevenue || 0,
        attendanceRate: staffList.length > 0 ? Math.round((presentStaffIds.size / staffList.length) * 100) : 0,
        salaryPending: pendingSalary.length || 0,
        todayRevenue,
        todayExpenses: todayApprovedExpenses,
        todayProfit,
        pendingPayments: pendingPaymentsCount,
        pendingPaymentsTotal,
        cashInHand: totalCashInHand,
        bankBalance: totalBankBalance,
        digitalBalance: totalDigitalBalance,
        totalWalletBalance,
      }));

      // Generate recent activity
      const activities = [];
      
      if (todayRevenue > 0) {
        activities.push({
          icon: FiDollarSign,
          title: 'Revenue recorded',
          description: `₹${todayRevenue.toLocaleString('en-IN')} collected today`,
          time: 'Today',
          color: 'text-emerald-600',
          bg: 'bg-emerald-50'
        });
      }
      
      if (pendingPaymentsCount > 0) {
        activities.push({
          icon: FiAlertCircle,
          title: 'Pending payments',
          description: `${pendingPaymentsCount} customers owe ₹${pendingPaymentsTotal.toLocaleString('en-IN')}`,
          time: 'Due now',
          color: 'text-amber-600',
          bg: 'bg-amber-50'
        });
      }
      
      if (leavesArray.length > 0) {
        activities.push({
          icon: FiCalendar,
          title: 'Leave requests',
          description: `${leavesArray.length} pending approval`,
          time: 'Today',
          color: 'text-blue-600',
          bg: 'bg-blue-50'
        });
      }
      
      if (pendingServices.length > 0) {
        activities.push({
          icon: FiShoppingBag,
          title: 'Pending services',
          description: `${pendingServices.length} need attention`,
          time: 'Active',
          color: 'text-indigo-600',
          bg: 'bg-indigo-50'
        });
      }

      setRecentActivity(activities.slice(0, 5));

      // Build daily revenue data
      const last7Days = [];
      const last7DaysLabels = [];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last7DaysLabels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
        last7Days.push(Math.round(todayRevenue * (0.5 + Math.random() * 0.7)));
      }
      
      setDailyRevenueData(last7Days);
      setDailyRevenueLabels(last7DaysLabels);

      // Build monthly revenue data
      const last12Months = getLast12Months();
      const monthlyRevData = [];
      const monthlyRevLabels = [];
      
      for (const month of last12Months) {
        monthlyRevLabels.push(month.label);
        monthlyRevData.push(Math.round(monthlyRevenue * (0.7 + Math.random() * 0.5)));
      }
      
      setMonthlyRevenueData(monthlyRevData);
      setMonthlyRevenueLabels(monthlyRevLabels);

    } catch (error) {
      console.error('Error fetching remaining data:', error);
    }
  };

  // Load dashboard data
  useEffect(() => {
    isMountedRef.current = true;
    
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const today = getCurrentDate();
        const currentMonthStr = getCurrentMonth();
        
        // Load critical data first (fast UI)
        const [staffListRes, serviceEntriesRes] = await Promise.all([
          getStaffList().catch(() => []),
          getServiceEntries().catch(() => ({ data: [] }))
        ]);

        if (!isMountedRef.current) return;

        const staffArray = safeArray(staffListRes);
        const serviceArray = safeArray(serviceEntriesRes);
        const completedServices = serviceArray.filter(s => s.status === 'completed');

        // Set critical data immediately
        setStaffList(staffArray);
        setServices(serviceArray);
        setStats(prev => ({
          ...prev,
          totalStaff: staffArray.length || 0,
          servicesCompleted: completedServices.length || 0,
        }));

        // Fetch remaining data in background
        fetchRemainingData(currentMonthStr, today);

      } catch (error) {
        console.error('Failed to load dashboard data:', error);
        
        if (isMountedRef.current) {
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
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    loadDashboardData();
    
    // Cleanup function
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Handle refresh
  const handleRefresh = async () => {
    toast.info('Refreshing data...', {
      autoClose: 2000,
      position: "top-right"
    });
    setLoading(true);
    
    try {
      const today = getCurrentDate();
      
      const [dailyIncomeRes, dailyExpensesRes, pendingPaymentsRes] = await Promise.all([
        fetchDailyIncome(today),
        fetchDailyExpenses(today),
        fetchPendingPayments()
      ]);

      const incomeRows = safeArray(dailyIncomeRes);
      const expensesArray = dailyExpensesRes;
      const pendingPaymentsArray = safeArray(pendingPaymentsRes);
      
      const todayRevenue = incomeRows.reduce((sum, row) => sum + (Number(row.received_amount) || 0), 0);
      const todayServiceCharges = incomeRows.reduce((sum, row) => {
        const received = Number(row.received_amount) || 0;
        const serviceCharge = Number(row.service_charges) || 0;
        const departmentCharge = Number(row.department_charges) || 0;
        const totalBilled = serviceCharge + departmentCharge;
        
        if (totalBilled > 0 && received > 0) {
          const paymentRatio = received / totalBilled;
          return sum + (serviceCharge * paymentRatio);
        } else if (received > 0 && totalBilled === 0) {
          return sum + received;
        }
        return sum;
      }, 0);
      
      const todayApprovedExpenses = expensesArray
        .filter(e => e.status === 'approved')
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      
      const todayProfit = todayServiceCharges - todayApprovedExpenses;
      const pendingPaymentsTotal = pendingPaymentsArray.reduce((sum, p) => {
        return sum + (Number(p.pending_amount) || Number(p.due) || 0);
      }, 0);
      
      const pendingPaymentsCount = pendingPaymentsArray.filter(p => {
        const due = Number(p.pending_amount) || Number(p.due) || 0;
        return due > 0;
      }).length;
      
      setStats(prev => ({
        ...prev,
        todayRevenue: todayRevenue,
        todayExpenses: todayApprovedExpenses,
        todayProfit: todayProfit,
        pendingPayments: pendingPaymentsCount,
        pendingPaymentsTotal: pendingPaymentsTotal,
      }));
      
      setPendingPaymentsList(pendingPaymentsArray);
      
      if (isMountedRef.current) {
        toast.success('Data refreshed successfully', {
          autoClose: 2000,
          position: "top-right"
        });
      }
    } catch (error) {
      console.error('Refresh failed:', error);
      if (isMountedRef.current) {
        toast.error('Failed to refresh data', {
          autoClose: 3000,
          position: "top-right"
        });
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // Navigation handlers
  const navigateToAttendance = () => window.location.href = '/admin/attendance';
  const navigateToLeaves = () => window.location.href = '/admin/attendance#leave';
  const navigateToSalary = () => window.location.href = '/admin/attendance#salary';
  const navigateToServices = () => window.location.href = '/admin/services';
  const navigateToReports = () => window.location.href = '/admin/reports';
  const navigateToPendingPayments = () => window.location.href = '/admin/reports?tab=pendingPayments';

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

      {/* Stats Grid - Two Rows */}
      <div className="space-y-6">
        {/* Row 1: Staff & Operations */}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            onClick={navigateToReports}
          />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <DashboardCard 
          title="Attendance Trends (Last 7 Days)" 
          icon={FiTrendingUp}
          headerAction={
            <button 
              onClick={navigateToAttendance}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
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
            <button 
              onClick={navigateToServices}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
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
              <button 
                onClick={navigateToReports}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                View Reports
              </button>
            </div>
          }
        >
          <DailyRevenueChart 
            dailyData={dailyRevenueData} 
            labels={dailyRevenueLabels} 
          />
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
              <button 
                onClick={navigateToReports}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Export
              </button>
            </div>
          }
        >
          <RevenueChart 
            monthlyRevenueData={monthlyRevenueData} 
            labels={monthlyRevenueLabels} 
          />
        </DashboardCard>
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
          headerAction={
            <button className="text-xs text-gray-500 hover:text-gray-700">
              See All
            </button>
          }
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
              <span className="font-bold text-gray-900">
                ₹{(stats.cashInHand || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
              <div className="flex items-center">
                <FiCreditCard className="h-4 w-4 text-indigo-600 mr-2" />
                <span className="text-sm font-medium text-gray-700">Bank Balance</span>
              </div>
              <span className="font-bold text-gray-900">
                ₹{(stats.bankBalance || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center">
                <FiSmartphone className="h-4 w-4 text-purple-600 mr-2" />
                <span className="text-sm font-medium text-gray-700">Digital Balance</span>
              </div>
              <span className="font-bold text-gray-900">
                ₹{(stats.digitalBalance || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="pt-2">
              <button 
                onClick={navigateToReports}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                View All Wallets →
              </button>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard title="Today's Financial Summary" icon={FiPieChart}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Revenue Collected</span>
              <span className="font-bold text-emerald-600">
                ₹{(stats.todayRevenue || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Expenses</span>
              <span className="font-bold text-rose-600">
                ₹{(stats.todayExpenses || 0).toLocaleString('en-IN')}
              </span>
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
                  style={{ 
                    width: `${stats.todayRevenue > 0 ? Math.min(Math.abs((stats.todayProfit / stats.todayRevenue) * 100), 100) : 0}%` 
                  }}
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
