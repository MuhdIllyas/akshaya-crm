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

// Shared style tokens (UI only)
const fieldCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500';
const cardCls = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const thCls = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500';
const walletTone = (wallet) =>
  wallet.type?.toLowerCase() === 'bank' ? 'bg-blue-600' :
  wallet.type?.toLowerCase() === 'cash' ? 'bg-emerald-600' :
  wallet.type?.toLowerCase() === 'digital' ? 'bg-purple-600' :
  'bg-navy-700';

// Compact StatCard Component
const StatCard = ({ title, value, icon: Icon, color, subtitle, onClick, trend }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className={`${cardCls} p-4 transition-shadow hover:shadow-md ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="mb-1 text-xs font-medium text-slate-500">{title}</p>
        <p className="mb-1 truncate text-xl font-bold text-slate-900">{value}</p>
        <div className="flex items-center">
          <p className="text-xs text-slate-500">{subtitle}</p>
          {trend && (
            <span className={`ml-2 flex items-center text-xs font-medium ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend > 0 ? <FiTrendingUp2 className="mr-1" /> : <FiTrendingDown2 className="mr-1" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
      </div>
      <div className={`shrink-0 rounded-xl ${color} p-2.5`}>
        <Icon className="h-4 w-4 text-white" />
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
      <div className="flex flex-col items-center justify-center py-8 text-center text-sm">
        <FiBarChart2 className="mb-2 h-8 w-8 text-slate-300" />
        <p className="text-slate-500">No closed-day data available</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-md">
          <p className="mb-1 text-sm font-semibold text-slate-900">{formatDateTime(label)}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center">
                <div className="mr-2 h-2 w-2 rounded-full bg-emerald-500"></div>
                <span className="text-sm text-slate-600">Inflow</span>
              </div>
              <span className="text-sm font-bold text-emerald-600">₹{payload[0]?.value?.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center">
                <div className="mr-2 h-2 w-2 rounded-full bg-rose-500"></div>
                <span className="text-sm text-slate-600">Outflow</span>
              </div>
              <span className="text-sm font-bold text-rose-600">₹{payload[1]?.value?.toLocaleString()}</span>
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
            stroke="#eef2f7" 
            vertical={false}
          />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatDateTime}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 11 }}
            padding={{ left: 5, right: 5 }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickFormatter={(value) => `₹${value / 1000}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="inflow"
            name="Inflow"
            fill="#10B981"
            radius={[4, 4, 0, 0]}
            barSize={16}
          />
          <Bar
            dataKey="outflow"
            name="Outflow"
            fill="#EF4444"
            radius={[4, 4, 0, 0]}
            barSize={16}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

const COLORS = [
  "#1e3a5f", // navy
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
      <div className="flex flex-col items-center justify-center py-8 text-center text-sm">
        <FiPieChart className="mb-2 h-8 w-8 text-slate-300" />
        <p className="text-slate-500">No wallet distribution data available</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-md">
          <div className="mb-1 flex items-center">
            <div 
              className="mr-2 h-2 w-2 rounded-full" 
              style={{ backgroundColor: payload[0].color }}
            ></div>
            <p className="text-sm font-semibold text-slate-900">{data.name}</p>
          </div>
          <p className="text-lg font-bold text-slate-900">
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
      <div className="flex flex-col items-stretch sm:h-64 sm:flex-row sm:items-center">
        <div className="relative h-56 w-full sm:h-full sm:w-auto sm:flex-1">
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
                className="fill-slate-900 text-lg font-bold"
              >
                ₹{totalValue.toLocaleString()}
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className="flex-1 pt-3 sm:pl-4 sm:pt-0">
          <div className="max-h-56 space-y-2 overflow-y-auto pr-2">
            {data.map((item, index) => {
              const percentage = ((item.value / totalValue) * 100).toFixed(1);
              return (
                <div key={index} className="flex items-center justify-between rounded-xl bg-slate-50 p-2 transition-colors hover:bg-slate-100">
                  <div className="flex min-w-0 flex-1 items-center">
                    <div 
                      className="mr-2 h-2 w-2 shrink-0 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    ></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                    </div>
                  </div>
                  <div className="whitespace-nowrap text-right">
                    <p className="text-sm font-bold text-slate-900">₹{item.value.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">{percentage}%</p>
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
      className={`cursor-pointer rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md ${
        isSelected ? 'border-navy-500 bg-slate-50 ring-2 ring-navy-500/20' : 'border-slate-200 bg-white'
      }`}
      onClick={onClick}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${walletTone(wallet)}`}>
            <WalletIcon className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900">{wallet.name}</h3>
            <p className="text-xs capitalize text-slate-500">{wallet.type}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-slate-900">
            ₹{wallet.currentBalance.toLocaleString()}
          </p>
          <div className={`mt-0.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${
            balanceChange >= 0 
              ? 'bg-emerald-50 text-emerald-700' 
              : 'bg-rose-50 text-rose-700'
          }`}>
            {balanceChange >= 0 ? <FiTrendingUp2 className="mr-1 h-2.5 w-2.5" /> : <FiTrendingDown2 className="mr-1 h-2.5 w-2.5" />}
            {Math.abs(changePercentage)}%
          </div>
        </div>
      </div>

      <div className="mb-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Opening Balance</span>
          <span className="text-xs font-medium text-blue-600">
            ₹{wallet.openingBalance.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Closing Balance</span>
          <span className="text-xs font-medium text-navy-700">
            ₹{wallet.currentBalance.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Last Closed Day In</span>
          <span className="text-xs font-medium text-emerald-600">
            ₹{wallet.credit.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Last Closed Day Out</span>
          <span className="text-xs font-medium text-rose-600">
            ₹{wallet.debit.toLocaleString()}
          </span>
        </div>
      </div>
      
      <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-400">
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
        role="dialog"
        aria-modal="true"
        aria-label="Balance history"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-4xl flex-col border-l border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/60 p-4">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              aria-label="Back"
              className="rounded-lg p-2 transition-colors hover:bg-slate-100"
            >
              <FiArrowLeft className="h-4 w-4 text-slate-600" />
            </button>
            <div>
              <h2 className="text-base font-bold text-slate-900">Balance History</h2>
              <p className="text-xs text-slate-500">Opening & Closing Balances</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 transition-colors hover:bg-slate-100"
          >
            <FiX className="h-4 w-4 text-slate-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Filters */}
          <div className={`${cardCls} mb-4 p-4`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center text-sm font-semibold text-slate-900">
                <FiFilter className="mr-2 h-4 w-4 text-navy-700" />
                Filters
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  <FiDownload className="h-3 w-3" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={loadData}
                  className="flex items-center gap-2 rounded-xl bg-navy-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-navy-800"
                >
                  <FiRefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {/* Wallet Filter */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Wallet
                </label>
                <select
                  value={selectedWallet ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedWallet(val ? Number(val) : null);
                  }}
                  className={fieldCls}
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
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Start Date
                </label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                  className={fieldCls}
                />
              </div>
              
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  End Date
                </label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                  className={fieldCls}
                />
              </div>
            </div>
            
            {/* View Mode Toggle */}
            <div className="mt-3">
              <label className="mb-2 block text-xs font-medium text-slate-600">
                View Mode
              </label>
              <div role="tablist" className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
                {['daily', 'weekly', 'monthly'].map(mode => (
                  <button
                    key={mode}
                    role="tab"
                    aria-selected={viewMode === mode}
                    onClick={() => setViewMode(mode)}
                    className={`rounded-lg px-3 py-1.5 text-sm capitalize transition-colors ${viewMode === mode ? 'bg-navy-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
              <p className="mb-1 text-xs text-blue-700">Opening</p>
              <p className="font-bold text-blue-900">₹{summary.totalOpening.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-100 p-3">
              <p className="mb-1 text-xs text-navy-700">Closing</p>
              <p className="font-bold text-slate-900">₹{summary.totalClosing.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="mb-1 text-xs text-emerald-700">Inflow</p>
              <p className="font-bold text-emerald-900">₹{summary.totalIn.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
              <p className="mb-1 text-xs text-rose-700">Outflow</p>
              <p className="font-bold text-rose-900">₹{summary.totalOut.toLocaleString()}</p>
            </div>
          </div>

          {/* Balance History Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className={thCls}>
                    {viewMode === 'daily' ? 'Date' : 'Period'}
                  </th>
                  <th className={thCls}>Wallet</th>
                  <th className={thCls}>Opening</th>
                  <th className={thCls}>Closing</th>
                  <th className={thCls}>In</th>
                  <th className={thCls}>Out</th>
                  <th className={thCls}>TXN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredData.length > 0 ? (
                  filteredData.map((item, index) => {
                    // Format the date based on view mode
                    const displayDate = viewMode === 'daily' 
                      ? formatBalanceHistoryDate(item.date)
                      : formatPeriod(item.period, viewMode);
                    
                    return (
                      <tr key={index} className="transition-colors hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-2.5 text-sm text-slate-900">
                          {displayDate}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-sm text-slate-600">
                          {item.walletId ? getWalletName(item.walletId) : 'Multiple'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-blue-600">
                          ₹{item.openingBalance.toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-navy-700">
                          ₹{item.closingBalance.toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-emerald-600">
                          ₹{item.totalIn.toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-rose-600">
                          ₹{item.totalOut.toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
                            {item.transactions}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center">
                      <FiFileText className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                      <p className="text-sm text-slate-500">No balance history found</p>
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
        role="dialog"
        aria-modal="true"
        aria-label={`${wallet.name} details`}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 z-40 flex h-full w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/60 p-4">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              aria-label="Back"
              className="rounded-lg p-2 transition-colors hover:bg-slate-100"
            >
              <FiArrowLeft className="h-4 w-4 text-slate-600" />
            </button>
            <div>
              <h2 className="text-base font-bold text-slate-900">{wallet.name}</h2>
              <p className="text-xs capitalize text-slate-500">{wallet.type}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 transition-colors hover:bg-slate-100"
          >
            <FiX className="h-4 w-4 text-slate-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Balance Summary */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${walletTone(wallet)}`}>
                  <WalletIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{wallet.name}</h3>
                  <div className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
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
                <p className="mb-1 text-sm text-slate-500">Current Balance</p>
                <p className="text-2xl font-bold text-slate-900">₹{wallet.currentBalance.toLocaleString()}</p>
              </div>

              {/* Balance list */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Opening Balance</span>
                  <span className="text-sm font-medium text-blue-600">
                    ₹{wallet.openingBalance.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Closing Balance</span>
                  <span className="text-sm font-medium text-navy-700">
                    ₹{wallet.currentBalance.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Today In</span>
                  <span className="text-sm font-medium text-emerald-600">
                    ₹{wallet.credit.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Today Out</span>
                  <span className="text-sm font-medium text-rose-600">
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center text-lg font-bold text-slate-900">
              <FiSmartphone className="mr-2 h-5 w-5 text-navy-700" />
              Wallet Management
            </h2>
            <p className="mt-1 text-sm text-slate-500">Manage your financial accounts</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowBalanceHistory(true)}
              className="flex items-center gap-2 rounded-xl bg-navy-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-800"
            >
              <FiCalendar className="h-4 w-4" />
              <span>Balance History</span>
            </button>

            <button
              onClick={handleManualDailyClose}
              disabled={closing}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                closing
                  ? "cursor-not-allowed bg-slate-200 text-slate-500"
                  : "bg-amber-500 text-white hover:bg-amber-600"
              }`}
            >
              <FiRefreshCw className={`h-4 w-4 ${closing ? "animate-spin" : ""}`} />
              <span>{closing ? "Processing…" : "Re-run Close"}</span>
            </button>
          </div>
        </div>

        {/* Date Range Filters */}
        <div className={`${cardCls} mb-4 flex flex-wrap items-end gap-3 p-3`}>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">From</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange(prev => ({ ...prev, start: e.target.value }))
              }
              className={fieldCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange(prev => ({ ...prev, end: e.target.value }))
              }
              className={fieldCls}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDateRange({ start: today, end: today })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
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
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              This Month
            </button>
          </div>
        </div>

        {/* Wallet Stats */}
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            title="Total Balance"
            value={`₹${walletStats.totalWalletBalance.toLocaleString()}`}
            subtitle="All wallets"
            icon={FiSmartphone}
            color="bg-navy-700"
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
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="text-sm font-medium text-blue-900">
            Last accounting close
          </div>
          <div className="mt-1 text-sm text-blue-700">
            Closed at <span className="font-semibold">
              {lastClosedAt
                ? formatDateTime(lastClosedAt)
                : "Not closed yet"}
            </span>
          </div>
        </div>

        {/* Charts Section */}
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Daily Inflow vs Outflow Chart */}
          <div className={`${cardCls} p-4 sm:p-5`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Daily Inflow vs Outflow</h3>
                <p className="text-xs text-slate-500">Closed days</p>
              </div>
              <FiBarChart2 className="h-4 w-4 text-navy-700" />
            </div>
            <DailyFlowChart data={dailyFlowData} />
          </div>

          {/* Wallet-wise Distribution */}
          <div className={`${cardCls} p-4 sm:p-5`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Wallet Distribution</h3>
                <p className="text-xs text-slate-500">Movement across wallets</p>
              </div>
              <FiPieChart className="h-4 w-4 text-navy-700" />
            </div>
            <WalletDistributionChart data={walletDistribution} />
          </div>
        </div>

        {/* Wallets Grid */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">All Wallets</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
              {wallets.length} wallets
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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