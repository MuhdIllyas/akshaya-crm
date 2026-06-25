import React, { useState, useEffect } from 'react'; 
import { 
  FiSmartphone, FiCreditCard, FiHome, FiPlus, 
  FiDollarSign, FiDatabase, FiBook, FiBarChart2,
  FiCalendar, FiTrendingUp, FiTrendingDown, FiCheckCircle, FiPieChart,
  FiX, FiArrowLeft, FiFileText, FiFilter, FiDownload, FiRefreshCw,
  FiChevronRight, FiTrendingUp as FiTrendingUp2, FiTrendingDown as FiTrendingDown2
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  ComposedChart
} from "recharts";

// Compact StatCard Component
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
              {trend > 0 ? <FiTrendingUp2 className="mr-1" /> : <FiTrendingDown2 className="mr-1" />}
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

const getWalletIcon = (wallet) => {
  if (!wallet) return FiSmartphone;

  const iconsByType = {
    bank: FiCreditCard,
    cash: FiHome,
    digital: FiSmartphone,
  };

  // Prefer wallet.type (best)
  if (wallet.type && iconsByType[wallet.type.toLowerCase()]) {
    return iconsByType[wallet.type.toLowerCase()];
  }

  // Fallback by name (optional)
  const iconsByName = {
    'Bank': FiCreditCard,
    'Cash': FiHome,
    'Counter Cash': FiHome,
    'Digital Wallet': FiSmartphone,
  };

  return iconsByName[wallet.name] || FiSmartphone;
};

const formatDateTime = (value) => {
  if (!value) return "";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Enhanced DailyFlowChart Component
const DailyFlowChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center text-sm text-gray-400 py-8">
        <FiBarChart2 className="h-8 w-8 mb-2 text-gray-300" />
        <p className="text-gray-500">No closed-day data available</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-100">
          <p className="font-semibold text-gray-900 mb-1 text-sm">{formatDateTime(label)}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></div>
                <span className="text-gray-600 text-sm">Inflow</span>
              </div>
              <span className="font-bold text-emerald-600 text-sm">₹{payload[0]?.value?.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-rose-500 mr-2"></div>
                <span className="text-gray-600 text-sm">Outflow</span>
              </div>
              <span className="font-bold text-rose-600 text-sm">₹{payload[1]?.value?.toLocaleString()}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#f0f0f0" 
            vertical={false}
          />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatDateTime}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            padding={{ left: 5, right: 5 }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickFormatter={(value) => `₹${value / 1000}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="inflow"
            name="Inflow"
            fill="#10B981"
            radius={[2, 2, 0, 0]}
            barSize={16}
          />
          <Bar
            dataKey="outflow"
            name="Outflow"
            fill="#EF4444"
            radius={[2, 2, 0, 0]}
            barSize={16}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

const COLORS = [
  "#6366F1", // indigo
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#06B6D4", // cyan
];

// Enhanced WalletDistributionChart Component
const WalletDistributionChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center text-sm text-gray-400 py-8">
        <FiPieChart className="h-8 w-8 mb-2 text-gray-300" />
        <p className="text-gray-500">No wallet distribution data available</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-100">
          <div className="flex items-center mb-1">
            <div 
              className="w-2 h-2 rounded-full mr-2" 
              style={{ backgroundColor: payload[0].color }}
            ></div>
            <p className="font-semibold text-gray-900 text-sm">{data.name}</p>
          </div>
          <p className="text-lg font-bold text-gray-900">
            ₹{data.value.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  const totalValue = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="relative">
      <div className="flex items-center h-64">
        <div className="relative flex-1 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
                cornerRadius={4}
                strokeWidth={1}
                stroke="#fff"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-lg font-bold fill-gray-900"
              >
                ₹{totalValue.toLocaleString()}
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className="flex-1 pl-4">
          <div className="space-y-2 max-h-56 overflow-y-auto pr-2">
            {data.map((item, index) => {
              const percentage = ((item.value / totalValue) * 100).toFixed(1);
              return (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
                  <div className="flex items-center flex-1 min-w-0">
                    <div 
                      className="w-2 h-2 rounded-full mr-2" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    ></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <p className="font-bold text-gray-900 text-sm">₹{item.value.toLocaleString()}</p>
                    <p className="text-gray-500 text-xs">{percentage}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// Compact WalletCard Component with original list layout (4 balance items)
const WalletCard = ({ wallet, onClick, isSelected = false }) => {
  const WalletIcon = getWalletIcon(wallet);
  const balanceChange = wallet.currentBalance - wallet.openingBalance;
  const changePercentage =
    wallet.openingBalance > 0
      ? ((balanceChange / wallet.openingBalance) * 100).toFixed(1)
      : 0;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`bg-white rounded-lg border hover:shadow-md transition-all duration-200 cursor-pointer p-3 ${
        isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className={`rounded-lg flex items-center justify-center w-8 h-8 ${
            wallet.type?.toLowerCase() === 'bank' ? 'bg-blue-500' :
            wallet.type?.toLowerCase() === 'cash' ? 'bg-emerald-500' :
            wallet.type?.toLowerCase() === 'digital' ? 'bg-purple-500' :
            'bg-indigo-500'
          }`}>
            <WalletIcon className="text-white h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 text-xs truncate">{wallet.name}</h3>
            <p className="text-gray-500 text-xs capitalize">{wallet.type}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-gray-900 text-sm">
            ₹{wallet.currentBalance.toLocaleString()}
          </p>
          <div className={`inline-flex items-center px-1 py-0.5 rounded text-xs font-medium mt-0.5 ${
            balanceChange >= 0 
              ? 'bg-emerald-50 text-emerald-700' 
              : 'bg-rose-50 text-rose-700'
          }`}>
            {balanceChange >= 0 ? <FiTrendingUp2 className="mr-1 h-2 w-2" /> : <FiTrendingDown2 className="mr-1 h-2 w-2" />}
            {Math.abs(changePercentage)}%
          </div>
        </div>
      </div>

      {/* Original list layout for balance items */}
      <div className="space-y-1.5 mb-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 text-xs">Opening Balance</span>
          <span className="font-medium text-blue-600 text-xs">
            ₹{wallet.openingBalance.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 text-xs">Closing Balance</span>
          <span className="font-medium text-indigo-600 text-xs">
            ₹{wallet.currentBalance.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 text-xs">Last Closed Day In</span>
          <span className="font-medium text-emerald-600 text-xs">
            ₹{wallet.credit.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 text-xs">Last Closed Day Out</span>
          <span className="font-medium text-rose-600 text-xs">
            ₹{wallet.debit.toLocaleString()}
          </span>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
        <span>View details</span>
        <FiChevronRight className="h-3 w-3" />
      </div>
    </motion.div>
  );
};

// API functions remain the same
const rerunDailyClose = async (date) => {
  const token = localStorage.getItem("token");

  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/api/walletreport/daily-close/re-run`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ date }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to re-run daily close");
  }

  return await res.json();
};

const fetchWalletSummary = async (from, to, centreId) => {
  const token = localStorage.getItem("token");

  const params = new URLSearchParams({ from, to });
  if (centreId) params.append("centreId", centreId);

  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/api/walletreport/wallets/summary?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) throw new Error("Failed to fetch wallet summary");
  return res.json();
};

const fetchDailyFlow = async (from, to, centreId) => {
  const token = localStorage.getItem("token");

  const params = new URLSearchParams({ from, to });
  if (centreId) params.append("centreId", centreId);

  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/api/walletreport/wallets/daily-flow?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) throw new Error("Failed to fetch daily flow");
  return res.json();
};

const fetchWalletDistribution = async (from, to, centreId) => {
  const token = localStorage.getItem("token");

  const params = new URLSearchParams({ from, to });
  if (centreId) params.append("centreId", centreId);

  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/api/walletreport/wallets/distribution?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) throw new Error("Failed to fetch wallet distribution");
  return res.json();
};


// Updated format function for balance history
const formatBalanceHistoryDate = (dateString) => {
  if (!dateString) return "";
  
  const date = new Date(dateString);
  
  // Format for display: DD MMM YYYY
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Format period for weekly/monthly views
const formatPeriod = (period, viewMode) => {
  if (!period) return "";
  
  if (viewMode === 'monthly') {
    // period format: "2025-12"
    const [year, month] = period.split('-');
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
    });
  }
  
  if (viewMode === 'weekly') {
    // period format: "2025-12-27" (start of week)
    const date = new Date(period);
    return `Week of ${date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })}`;
  }
  
  // For daily view, format normally
  return formatBalanceHistoryDate(period);
};

// BalanceHistoryPanel Component - Updated with proper date formatting
const BalanceHistoryPanel = ({ wallets, onClose, showBalanceHistory, centreId }) => {

const fetchDailyBalances = async (walletId, start, end, centreId) => {
  const token = localStorage.getItem("token");

  const params = new URLSearchParams({
    from: start,
    to: end,
  });

  if (centreId) params.append("centreId", centreId);

  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/api/walletreport/wallets/${walletId}/daily?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to fetch wallet balance history");
  }

  return res.json();
};

  const [selectedWallet, setSelectedWallet] = useState(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [rawData, setRawData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('daily');
  const [loadingWallets, setLoadingWallets] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedWallet, dateRange]);

  useEffect(() => {
    applyFilters(rawData);
  }, [viewMode]);

  const loadData = async () => {
    if (!selectedWallet) {
      setRawData([]);
      setFilteredData([]);
      return;
  }

    try {
      setLoading(true);

      const data = await fetchDailyBalances(
        Number(selectedWallet),
        dateRange.start,
        dateRange.end,
        centreId
      );

      // Map backend → UI format
      const mapped = data.map((d) => ({
        date: d.date, // This is the ISO date string from backend
        walletId: Number(selectedWallet),
        openingBalance: Number(d.opening_balance),
        closingBalance: Number(d.closing_balance),
        totalIn: Number(d.total_credit),
        totalOut: Number(d.total_debit),
        transactions:
          Number(d.total_credit) > 0 || Number(d.total_debit) > 0 ? 1 : 0,
      }));

      setRawData(mapped);
      applyFilters(mapped);

    } catch (err) {
      console.error(err);
      setRawData([]);
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (data) => {
    let filtered = [...data];

    if (viewMode === "weekly" || viewMode === "monthly") {
      filtered = groupByPeriod(filtered);
    }

    setFilteredData(filtered);
  };

  const groupByPeriod = (data) => {
    const grouped = {};
    
    data.forEach(item => {
      let periodKey;
      const date = new Date(item.date);
      
      if (viewMode === 'weekly') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        periodKey = weekStart.toISOString().split('T')[0]; // YYYY-MM-DD format
      } else if (viewMode === 'monthly') {
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      
      if (!grouped[periodKey]) {
        grouped[periodKey] = {
          period: periodKey,
          openingBalance: item.openingBalance,
          closingBalance: item.closingBalance,
          totalIn: 0,
          totalOut: 0,
          transactions: 0,
          wallets: new Set()
        };
      }
      
      // For grouped periods, we want the closing balance from the last day
      grouped[periodKey].closingBalance = item.closingBalance;
      grouped[periodKey].totalIn += item.totalIn;
      grouped[periodKey].totalOut += item.totalOut;
      grouped[periodKey].transactions += item.transactions;
      grouped[periodKey].wallets.add(item.walletId);
    });
    
    return Object.values(grouped);
  };

  const getWalletName = (walletId) => {
    const wallet = wallets.find(w => w.id === walletId);
    return wallet ? wallet.name : 'Unknown';
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Wallet', 'Opening Balance', 'Closing Balance', 'Total In', 'Total Out', 'Transactions'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(item => {
        const displayDate = viewMode === 'daily' 
          ? formatBalanceHistoryDate(item.date)
          : formatPeriod(item.period, viewMode);
        
        return [
          displayDate,
          item.walletId ? getWalletName(item.walletId) : 'Multiple Wallets',
          `₹${item.openingBalance.toLocaleString()}`,
          `₹${item.closingBalance.toLocaleString()}`,
          `₹${item.totalIn.toLocaleString()}`,
          `₹${item.totalOut.toLocaleString()}`,
          item.transactions
        ].join(',');
      })
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `balance-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const calculateSummary = () => {
    const summary = {
      totalOpening: 0,
      totalClosing: 0,
      totalIn: 0,
      totalOut: 0,
      totalTransactions: 0
    };
    
    filteredData.forEach(item => {
      summary.totalOpening += item.openingBalance;
      summary.totalClosing += item.closingBalance;
      summary.totalIn += item.totalIn;
      summary.totalOut += item.totalOut;
      summary.totalTransactions += item.transactions;
    });
    
    return summary;
  };

  const summary = calculateSummary();

  return (
    <>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 h-full bg-white shadow-lg z-50 flex flex-col border-l border-gray-200 w-full max-w-4xl"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FiArrowLeft className="h-4 w-4 text-gray-600" />
            </button>
            <div>
              <h2 className="text-base font-bold text-gray-900">Balance History</h2>
              <p className="text-xs text-gray-600">Opening & Closing Balances</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiX className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Filters */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center text-sm">
                <FiFilter className="h-4 w-4 mr-2 text-indigo-600" />
                Filters
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={exportToCSV}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-xs"
                >
                  <FiDownload className="h-3 w-3" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={loadData}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-xs"
                >
                  <FiRefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Wallet Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Wallet
                </label>
                <select
                  value={selectedWallet ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedWallet(val ? Number(val) : null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                >
                  <option value="">Select Wallet</option>
                  {wallets.map(wallet => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Date Range */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>
            
            {/* View Mode Toggle */}
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                View Mode
              </label>
              <div className="flex space-x-2">
                {['daily', 'weekly', 'monthly'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1.5 rounded-lg capitalize text-sm ${viewMode === mode ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-xs text-blue-700 mb-1">Opening</p>
              <p className="font-bold text-blue-900">₹{summary.totalOpening.toLocaleString()}</p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
              <p className="text-xs text-indigo-700 mb-1">Closing</p>
              <p className="font-bold text-indigo-900">₹{summary.totalClosing.toLocaleString()}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
              <p className="text-xs text-emerald-700 mb-1">Inflow</p>
              <p className="font-bold text-emerald-900">₹{summary.totalIn.toLocaleString()}</p>
            </div>
            <div className="bg-rose-50 rounded-lg p-3 border border-rose-200">
              <p className="text-xs text-rose-700 mb-1">Outflow</p>
              <p className="font-bold text-rose-900">₹{summary.totalOut.toLocaleString()}</p>
            </div>
          </div>

          {/* Balance History Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {viewMode === 'daily' ? 'Date' : 'Period'}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Wallet
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Opening
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Closing
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    In
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Out
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    TXN
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.length > 0 ? (
                  filteredData.map((item, index) => {
                    // Format the date based on view mode
                    const displayDate = viewMode === 'daily' 
                      ? formatBalanceHistoryDate(item.date)
                      : formatPeriod(item.period, viewMode);
                    
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                          {displayDate}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                          {item.walletId ? getWalletName(item.walletId) : 'Multiple'}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-blue-600">
                          ₹{item.openingBalance.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-indigo-600">
                          ₹{item.closingBalance.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-emerald-600">
                          ₹{item.totalIn.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-rose-600">
                          ₹{item.totalOut.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {item.transactions}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" className="px-4 py-6 text-center">
                      <FiFileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-gray-500 text-sm">No balance history found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </>
  );
};

// Compact WalletDetailsPanel Component
const WalletDetailsPanel = ({ wallet, onClose }) => {
  const WalletIcon = getWalletIcon(wallet);
  const netChange = wallet.currentBalance - wallet.openingBalance;
  const percentageChange = wallet.openingBalance > 0 ? (netChange / wallet.openingBalance) * 100 : 0;

  return (
    <>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 h-full bg-white shadow-lg z-40 flex flex-col border-l border-gray-200 w-full max-w-sm"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FiArrowLeft className="h-4 w-4 text-gray-600" />
            </button>
            <div>
              <h2 className="text-base font-bold text-gray-900">{wallet.name}</h2>
              <p className="text-xs text-gray-600 capitalize">{wallet.type}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiX className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Balance Summary */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-3 mb-3">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  wallet.type?.toLowerCase() === 'bank' ? 'bg-blue-500' :
                  wallet.type?.toLowerCase() === 'cash' ? 'bg-emerald-500' :
                  wallet.type?.toLowerCase() === 'digital' ? 'bg-purple-500' :
                  'bg-indigo-500'
                }`}>
                  <WalletIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{wallet.name}</h3>
                  <div className={`inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-bold ${
                    netChange >= 0 
                      ? 'bg-emerald-50 text-emerald-700' 
                      : 'bg-rose-50 text-rose-700'
                  }`}>
                    {netChange >= 0 ? <FiTrendingUp2 className="mr-1" /> : <FiTrendingDown2 className="mr-1" />}
                    {netChange >= 0 ? '+' : ''}{percentageChange.toFixed(1)}%
                  </div>
                </div>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">Current Balance</p>
                <p className="text-2xl font-bold text-gray-900">₹{wallet.currentBalance.toLocaleString()}</p>
              </div>

              {/* Balance list (original style) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-sm">Opening Balance</span>
                  <span className="font-medium text-blue-600 text-sm">
                    ₹{wallet.openingBalance.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-sm">Closing Balance</span>
                  <span className="font-medium text-indigo-600 text-sm">
                    ₹{wallet.currentBalance.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-sm">Today In</span>
                  <span className="font-medium text-emerald-600 text-sm">
                    ₹{wallet.credit.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-sm">Today Out</span>
                  <span className="font-medium text-rose-600 text-sm">
                    ₹{wallet.debit.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
};

// Main Wallets Section Component - Compact UI with 5 wallet cards per row
const WalletsSection = ({
  selectedWallet: externalSelectedWallet,
  setSelectedWallet: externalSetSelectedWallet,
  centreId
}) => {
  const [internalSelectedWallet, setInternalSelectedWallet] = useState(null);
  const selectedWallet = externalSelectedWallet ?? internalSelectedWallet;
  const setSelectedWallet = externalSetSelectedWallet ?? setInternalSelectedWallet;
  const [showBalanceHistory, setShowBalanceHistory] = useState(false);
  const [dailyFlowData, setDailyFlowData] = useState([]);
  const [walletDistribution, setWalletDistribution] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [walletStats, setWalletStats] = useState({
    totalWalletBalance: 0,
    totalBankBalance: 0,
    totalCashInHand: 0,
    totalDigitalBalance: 0,
  });
  const today = new Date().toISOString().split("T")[0];
  const [dateRange, setDateRange] = useState({
    start: today,
    end: today,
  });

  const [lastClosedAt, setLastClosedAt] = useState(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    loadWalletSummary();
  }, [dateRange, centreId]);

  useEffect(() => {
  loadDailyFlow();
}, [dateRange, centreId]);

const loadDailyFlow = async () => {
  try {
    const data = await fetchDailyFlow(dateRange.start, dateRange.end, centreId);

    setDailyFlowData(
      data.map(row => ({
        date: row.date,
        inflow: Number(row.total_in),
        outflow: Number(row.total_out),
      }))
    );
  } catch (err) {
    console.error("Failed to load daily flow chart", err);
    setDailyFlowData([]);
  }
};

useEffect(() => {
  loadWalletDistribution();
}, [dateRange, centreId]);

const loadWalletDistribution = async () => {
  try {
    const data = await fetchWalletDistribution(
      dateRange.start,
      dateRange.end,
      centreId
    );

    setWalletDistribution(
      data.map(row => ({
        name: row.wallet_name,
        value: Number(row.total_movement),
      }))
    );
  } catch (err) {
    console.error("Failed to load wallet distribution", err);
    setWalletDistribution([]);
  }
};

const handleManualDailyClose = async () => {
  try {
    setClosing(true);
    await rerunDailyClose(dateRange.end);

    toast.success(`Daily close re-run completed for ${dateRange.end}`);

    // Refresh wallet summary after close
    await loadWalletSummary();
  } catch (err) {
    alert(err.message);
  } finally {
    setClosing(false);
  }
};

const loadWalletSummary = async () => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const data = await fetchWalletSummary(dateRange.start, dateRange.end, centreId);

    // Build wallets
    const mappedWallets = data.map(row => ({
      id: Number(row.wallet_id),          // DB id
      name: row.wallet_name,
      type: row.wallet_type,
      openingBalance: Number(row.opening_balance),
      currentBalance: Number(row.closing_balance),
      credit: Number(row.total_credit),
      debit: Number(row.total_debit),
      transactions: []
    }));

    setWallets(mappedWallets);

    // Build stats
    const stats = {
      totalWalletBalance: 0,
      totalBankBalance: 0,
      totalCashInHand: 0,
      totalDigitalBalance: 0,
    };

    data.forEach(row => {
      const balance = Number(row.closing_balance);
      const type = row.wallet_type?.toLowerCase();

      stats.totalWalletBalance += balance;

      if (type === "bank") stats.totalBankBalance += balance;
      else if (type === "cash") stats.totalCashInHand += balance;
      else if (type === "digital") stats.totalDigitalBalance += balance;
    });

    setWalletStats(stats);

  } catch (err) {
    console.error("Failed to load wallet summary", err);
    setWallets([]);
  }
};

  return (
    <>
      <div className="mb-6">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <FiSmartphone className="h-5 w-5 mr-2 text-indigo-600" />
              Wallet Management
            </h2>
            <p className="text-gray-600 text-sm mt-1">Manage your financial accounts</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowBalanceHistory(true)}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <FiCalendar className="h-4 w-4" />
              <span>Balance History</span>
            </button>

            <button
              onClick={handleManualDailyClose}
              disabled={closing}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm ${
                closing
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-amber-500 text-white hover:bg-amber-600"
              }`}
            >
              <FiRefreshCw className={`h-4 w-4 ${closing ? "animate-spin" : ""}`} />
              <span>{closing ? "Processing…" : "Re-run Close"}</span>
            </button>
          </div>
        </div>

        {/* Date Range Filters */}
        <div className="flex flex-wrap gap-3 mb-4 items-end">
          <div>
            <label className="block text-sm text-gray-600 mb-1">From</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange(prev => ({ ...prev, start: e.target.value }))
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">To</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange(prev => ({ ...prev, end: e.target.value }))
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setDateRange({ start: today, end: today })}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
            >
              Today
            </button>
            <button
              onClick={() => {
                const firstDay = new Date();
                firstDay.setDate(1);
                setDateRange({
                  start: firstDay.toISOString().split("T")[0],
                  end: today,
                });
              }}
              className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 text-sm"
            >
              This Month
            </button>
          </div>
        </div>

        {/* Wallet Stats */}
        <div className="grid gap-3 mb-4 grid-cols-2 md:grid-cols-4">
          <StatCard
            title="Total Balance"
            value={`₹${walletStats.totalWalletBalance.toLocaleString()}`}
            subtitle="All wallets"
            icon={FiSmartphone}
            color="bg-indigo-600"
          />
          <StatCard
            title="Bank Balance"
            value={`₹${walletStats.totalBankBalance.toLocaleString()}`}
            subtitle="Bank accounts"
            icon={FiCreditCard}
            color="bg-blue-600"
          />
          <StatCard
            title="Cash in Hand"
            value={`₹${walletStats.totalCashInHand.toLocaleString()}`}
            subtitle="Physical cash"
            icon={FiHome}
            color="bg-emerald-600"
          />
          <StatCard
            title="Digital Balance"
            value={`₹${walletStats.totalDigitalBalance.toLocaleString()}`}
            subtitle="Digital wallets"
            icon={FiSmartphone}
            color="bg-purple-600"
          />
        </div>

        {/* Last Closed Info */}
        <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
          <div className="font-medium text-blue-900 text-sm">
            Last accounting close
          </div>
          <div className="mt-1 text-blue-700 text-sm">
            Closed at <span className="font-semibold">
              {lastClosedAt
                ? formatDateTime(lastClosedAt)
                : "Not closed yet"}
            </span>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Daily Inflow vs Outflow Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Daily Inflow vs Outflow</h3>
                <p className="text-gray-500 text-xs">Closed days</p>
              </div>
              <FiBarChart2 className="h-4 w-4 text-indigo-600" />
            </div>
            <DailyFlowChart data={dailyFlowData} />
          </div>

          {/* Wallet-wise Distribution */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Wallet Distribution</h3>
                <p className="text-gray-500 text-xs">Movement across wallets</p>
              </div>
              <FiPieChart className="h-4 w-4 text-indigo-600" />
            </div>
            <WalletDistributionChart data={walletDistribution} />
          </div>
        </div>

        {/* Wallets Grid - 5 cards per row on large screens */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 text-sm">All Wallets</h3>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {wallets.length} wallets
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {wallets.map((wallet) => (
              <WalletCard
                key={wallet.id}
                wallet={wallet}
                isSelected={selectedWallet?.id === wallet.id}
                onClick={() => setSelectedWallet(wallet)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Wallet Details Panel */}
      <AnimatePresence>
        {selectedWallet && (
          <WalletDetailsPanel
            wallet={selectedWallet}
            onClose={() => setSelectedWallet(null)}
          />
        )}
      </AnimatePresence>

      {/* Balance History Panel */}
      <AnimatePresence>
        {showBalanceHistory && (
          <BalanceHistoryPanel
            wallets={wallets}
            dateRange={dateRange}
            centreId={centreId}
            onClose={() => setShowBalanceHistory(false)}
            showBalanceHistory={showBalanceHistory}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default WalletsSection;
