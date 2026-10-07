import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  BarChart, Bar, ScatterChart, Scatter, CartesianGrid, ZAxis, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiHome, FiUsers, FiUserCheck, FiShoppingBag, FiDollarSign,
  FiTrendingUp, FiPieChart, FiAlertCircle, FiArrowUp, FiArrowDown,
  FiCheckCircle, FiXCircle, FiLoader, FiCalendar, FiActivity, FiMap,
  FiBell, FiStar, FiAward, FiTarget, FiClock, FiFileText, FiLayers,
  FiLayout, FiPlus, FiMessageSquare, FiDownload, FiBarChart2
} from "react-icons/fi";

// ==========================================
// ACCOUNTING CLOSING LOG HELPERS
// ==========================================
const CLOSING_ENDPOINT = `${import.meta.env.VITE_API_URL}/api/accounting/nightly-close/all`;

// ==========================================
// PERIOD FILTER HELPERS
// ==========================================
const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "3months", label: "Last 3 Months" },
  { value: "6months", label: "Last 6 Months" },
  { value: "year", label: "This Year" },
];

const getPeriodRange = (period) => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [y, m, d] = today.split("-").map(Number);
  const fmt = (dt) => dt.toISOString().split("T")[0]; 

  let start;
  switch (period) {
    case "today": start = new Date(Date.UTC(y, m - 1, d)); break;
    case "week": {
      const base = new Date(Date.UTC(y, m - 1, d));
      const dow = base.getUTCDay();
      start = new Date(Date.UTC(y, m - 1, d - (dow === 0 ? 6 : dow - 1)));
      break;
    }
    case "3months": start = new Date(Date.UTC(y, m - 1 - 2, 1)); break;
    case "6months": start = new Date(Date.UTC(y, m - 1 - 5, 1)); break;
    case "year": start = new Date(Date.UTC(y, 0, 1)); break;
    case "month":
    default: start = new Date(Date.UTC(y, m - 1, 1));
  }
  return { start: fmt(start), end: today };
};

const inr = (n) => `₹${Math.abs(Number(n || 0)).toLocaleString("en-IN")}`;

const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const getClosingView = (row) => {
  if (row.status === "not_closed") return { Icon: FiXCircle, label: "Not closed", detail: "No closing submitted", wrap: "bg-rose-50/50 border-rose-100", text: "text-rose-600" };
  if (row.status === "incomplete") return { Icon: FiAlertCircle, label: "Incomplete", detail: `Cash counted (${inr(row.actual_cash)})`, wrap: "bg-amber-50/50 border-amber-100", text: "text-amber-600" };
  const variance = Number(row.cash_variance || 0);
  if (variance === 0) return { Icon: FiCheckCircle, label: "Closed", detail: `Cash ${inr(row.actual_cash)} • Matched`, wrap: "bg-emerald-50/50 border-emerald-100", text: "text-emerald-600" };
  return { Icon: FiAlertCircle, label: "Closed w/ Variance", detail: `Cash ${inr(row.actual_cash)} • ${inr(variance)} ${variance < 0 ? "short" : "over"}`, wrap: "bg-rose-50/50 border-rose-100", text: "text-rose-600" };
};

// ==========================================
// STAFF PERFORMANCE CHART
// ==========================================
const StaffPerformanceChart = ({ staffData }) => {
  const [metric, setMetric] = useState('serviceCharges');
  if (!staffData || staffData.length === 0) return <div className="text-slate-500 text-sm p-4">No staff data available</div>;

  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-sm text-white p-4 rounded-xl shadow-2xl text-sm border border-slate-700/50 z-50">
          <p className="font-semibold text-base mb-1">{data.name}</p>
          <p className="text-slate-400 text-xs mb-3">{data.centre}</p>
          <div className="space-y-1">
            <p className="flex justify-between gap-4"><span className="text-slate-300">Revenue:</span> <span className="text-blue-400 font-medium">{formatCurrency(data.serviceCharges)}</span></p>
            <p className="flex justify-between gap-4"><span className="text-slate-300">Services:</span> <span className="text-purple-400 font-medium">{data.servicesCompleted}</span></p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col h-[450px]">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <FiAward className="text-indigo-500" /> Top Staff Performers
          </h2>
          <p className="text-sm text-slate-500 mt-1">Ranked across all centres</p>
        </div>
        <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
          {['serviceCharges', 'servicesCompleted', 'scatter'].map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${metric === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {m === 'serviceCharges' ? 'Revenue' : m === 'servicesCompleted' ? 'Volume' : 'Efficiency'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {metric === 'scatter' ? (
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis type="number" dataKey="servicesCompleted" name="Applications" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis type="number" dataKey="serviceCharges" name="Service Charges" tickFormatter={(val) => `₹${(val/1000)}k`} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <ZAxis type="number" dataKey="serviceCharges" range={[100, 500]} />
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#cbd5e1' }} />
              <Scatter name="Staff" data={staffData} fill="#6366f1" opacity={0.8} />
            </ScatterChart>
          ) : (
            <BarChart data={staffData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#475569' }} width={120} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey={metric} radius={[0, 6, 6, 0]} barSize={24} animationDuration={1000}>
                {staffData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={metric === 'serviceCharges' ? '#3b82f6' : '#8b5cf6'} className="hover:opacity-80 transition-opacity duration-200 cursor-pointer" />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ==========================================
// REVENUE CHART COMPONENT
// ==========================================
const RevenueChart = ({ data, view }) => {
  if (!data || data.length === 0) return <div className="text-slate-500 text-sm p-4">No revenue data available</div>;

  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
  const formatLabel = (label) => {
    if (!label) return '';
    if (label.length === 7) return new Date(label + '-01').toLocaleString('default', { month: 'short', year: '2-digit' });
    if (label.length === 10) return label.slice(5);
    return label;
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-sm text-white p-3 rounded-xl shadow-xl text-sm border border-slate-700/50">
          <p className="font-semibold text-slate-300 mb-1">{formatLabel(item.label)}</p>
          <p className="text-white font-bold text-lg">{formatCurrency(item.value)}</p>
        </div>
      );
    }
    return null;
  };

  const getBarColor = () => view === 'profit' ? '#10b981' : view === 'expenses' ? '#f43f5e' : '#3b82f6';

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="label" tickFormatter={formatLabel} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} dy={10} />
        <YAxis tickFormatter={(val) => `₹${(val/1000)}k`} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} dx={-10} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
        <Bar dataKey="value" fill={getBarColor()} radius={[6, 6, 0, 0]} barSize={data.length > 6 ? 24 : Math.min(60, 80 / data.length)} animationDuration={800}>
          {data.map((entry, index) => <Cell key={`cell-${index}`} fill={`url(#revenueGradient)`} className="hover:opacity-80 transition-opacity" />)}
        </Bar>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={getBarColor()} stopOpacity={0.9} />
            <stop offset="100%" stopColor={getBarColor()} stopOpacity={0.2} />
          </linearGradient>
        </defs>
      </BarChart>
    </ResponsiveContainer>
  );
};

// ==========================================
// STAT CARD COMPONENT
// ==========================================
const StatCard = ({ title, value, icon: Icon, color, subtitle, trend, onClick }) => {
  // Extract base color name (e.g., "blue" from "bg-blue-500") for dynamic styling
  const baseColorMatch = color.match(/bg-([a-z]+)-/);
  const baseColor = baseColorMatch ? baseColorMatch[1] : 'indigo';

  return (
    <motion.div
      whileHover={{ y: -4 }}
      onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-200/60 p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 relative overflow-hidden ${onClick ? 'cursor-pointer hover:border-indigo-300/50' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 z-10">
          <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
          <div className="flex flex-wrap items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold text-slate-800 tracking-tight">{value}</p>
            {trend !== undefined && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold ${trend > 0 ? 'bg-emerald-100 text-emerald-700' : trend < 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                {trend > 0 ? <FiArrowUp className="mr-0.5" /> : trend < 0 ? <FiArrowDown className="mr-0.5" /> : null}
                {Math.abs(trend)}%
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-2 font-medium">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-xl bg-${baseColor}-50 border border-${baseColor}-100 z-10`}>
          <Icon className={`h-6 w-6 text-${baseColor}-600`} />
        </div>
      </div>
      {/* Decorative background blob */}
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-[0.03] bg-${baseColor}-500 blur-xl pointer-events-none`} />
    </motion.div>
  );
}

// ==========================================
// MAIN DASHBOARD COMPONENT
// ==========================================
const SuperadminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [revenueView, setRevenueView] = useState("revenue");
  const [period, setPeriod] = useState("month");

  const [closingDate, setClosingDate] = useState("");
  const [closingData, setClosingData] = useState({ date: "", rows: [] });
  const [closingLoading, setClosingLoading] = useState(true);
  const [closingError, setClosingError] = useState(false);

  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

  useEffect(() => {
    const controller = new AbortController();
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) throw new Error("No token");
        const { start, end } = getPeriodRange(period);
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/analytics/superadmin/dashboard`,
          {
            params: { modules: "stats,financials,leaderboards,health,alerts,customers,staff,teams,wallets,insights", timeframe: "custom", customStartDate: start, customEndDate: end },
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
          }
        );
        setDashboard(response.data);
        setLoading(false);
      } catch (err) {
        if (axios.isCancel(err)) return;
        toast.error("Failed to load dashboard data.");
        setLoading(false);
      }
    };
    fetchDashboard();
    return () => controller.abort();
  }, [period]);

  useEffect(() => {
    const controller = new AbortController();
    setClosingLoading(true);
    setClosingError(false);
    axios.get(CLOSING_ENDPOINT, {
        params: closingDate ? { date: closingDate } : {},
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        signal: controller.signal,
      })
      .then((res) => { setClosingData(res.data); setClosingLoading(false); })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setClosingError(true);
        setClosingLoading(false);
      });
    return () => controller.abort();
  }, [closingDate]);

  if (loading && !dashboard) {
    return (
      <div className="bg-slate-50 min-h-screen p-8 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <FiLoader className="animate-spin h-10 w-10 text-indigo-500 mb-4" />
          <span className="text-slate-500 font-medium tracking-wide">Loading Workspace...</span>
        </div>
      </div>
    );
  }

  const { executive = {}, finance = {}, operations = {}, leaderboards = {} } = dashboard || {};
  const { stats = {}, health = {}, alerts = [] } = executive;
  const { financials = {}, wallets = {} } = finance;
  const chartData = financials.charts || {};
  const revenueChartData = chartData[revenueView] || [];
  const { customers = {}, staff = {}, teams = {} } = operations;
  const { centres = {} } = leaderboards;
  const centreList = centres.fullList || [];
  const best = centres.best || {};
  const worst = centres.worst || {};

  const { totalCentres, totalStaff, totalCustomers, customerGrowth, revenueGrowthPercent, newCentresThisMonth, todayRevenue, todayServices, pendingServices, delayedServices, inProgressServices, admins, staffCount } = stats;
  const { revenue: monthlyRevenue, profit: netProfit } = financials.totals || {};
  const { cash: walletCash, bank: walletBank, digital: walletDigital, total: walletTotal } = wallets.summary || {};
  
  const topStaffList = staff.topPerformers || [];
  const topTeamsList = teams.topTeams || [];
  const notifications = alerts;
  const closingRows = closingData.rows || [];
  const closedCount = closingRows.filter((r) => r.status === "closed").length;

  const kpiData = [
    { title: "Total Centres", value: totalCentres, icon: FiHome, color: "bg-blue-500", subtitle: `+${newCentresThisMonth ?? 0} this month`, trend: newCentresThisMonth > 0 ? 5 : -2, onClick: () => navigate('/dashboard/superadmin/centremanagement') },
    { title: "Total Staff", value: totalStaff, icon: FiUsers, color: "bg-purple-500", subtitle: `${admins ?? 0} Admins, ${staffCount ?? 0} Staff`, trend: 0, onClick: () => navigate('/dashboard/superadmin/staffmanagement') },
    { title: "Total Customers", value: totalCustomers?.toLocaleString(), icon: FiUserCheck, color: "bg-emerald-500", subtitle: `+${customerGrowth ?? 0} this month`, trend: customerGrowth > 0 ? 8 : -3 },
    { title: "Period Revenue", value: formatCurrency(monthlyRevenue), icon: FiTrendingUp, color: "bg-indigo-500", subtitle: "Selected range", trend: revenueGrowthPercent },
  ];

  const MapView = () => (
    <div className="relative bg-slate-50 border border-slate-200/50 rounded-xl h-64 flex items-center justify-center overflow-hidden">
      <svg viewBox="0 0 200 200" className="w-full h-full opacity-60">
        <path d="M50,50 L150,50 L180,120 L120,180 L40,160 Z" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" strokeLinejoin="round" />
        {centreList.map((centre) => {
          const statusColor = centre.healthStatus?.color === "green" ? "#10b981" : centre.healthStatus?.color === "yellow" ? "#f59e0b" : "#ef4444";
          const x = 40 + (centre.id * 30) % 140;
          const y = 40 + (centre.id * 20) % 120;
          return (
            <motion.circle initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: Math.random() * 0.5 }} key={centre.id} cx={x} cy={y} r="5" fill={statusColor} stroke="#ffffff" strokeWidth="1.5" className="shadow-md" />
          );
        })}
      </svg>
      <div className="absolute bottom-3 left-3 px-3 py-1 bg-white/80 backdrop-blur-md rounded-full text-xs font-medium text-slate-500 border border-slate-200/50 shadow-sm flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Active Nodes
      </div>
    </div>
  );

  return (
    <div className="bg-[#f8fafc] min-h-screen pb-12 font-sans">
      
      {/* Top Header & Navigation Area */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 lg:px-8 py-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <FiLayers className="text-indigo-600" /> Superadmin
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Global overview & management</p>
        </div>
        
        <div className="flex items-center gap-3">
          {loading && <FiLoader className="animate-spin h-4 w-4 text-slate-400" />}
          <div className="relative">
            <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4 pointer-events-none" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer appearance-none transition-colors"
            >
              {PERIOD_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="p-4 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
        
        {/* Global KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {kpiData.map((kpi, index) => <StatCard key={index} {...kpi} />)}
        </div>

        {/* Pulse / Live Operations */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 tracking-tight">
            <FiActivity className="text-rose-500" /> Live Pulse
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl">
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">Live Revenue</p>
              <p className="text-2xl font-bold text-indigo-900">{formatCurrency(todayRevenue)}</p>
            </div>
            <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl">
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">Completed</p>
              <p className="text-2xl font-bold text-emerald-900">{todayServices ?? 0}</p>
            </div>
            <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">In Progress</p>
              <p className="text-2xl font-bold text-blue-900">{inProgressServices ?? 0}</p>
            </div>
            <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-xl">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">Delayed</p>
              <p className="text-2xl font-bold text-amber-900">{delayedServices ?? 0}</p>
            </div>
            <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-xl">
              <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider mb-1">Pending</p>
              <p className="text-2xl font-bold text-rose-900">{pendingServices ?? 0}</p>
            </div>
          </div>
        </div>

        {/* Analytics & Leaderboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col h-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
                <FiBarChart2 className="text-blue-500" /> Revenue Analytics
              </h2>
              <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
                {['revenue', 'profit', 'expenses'].map((view) => (
                  <button
                    key={view}
                    onClick={() => setRevenueView(view)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all capitalize ${revenueView === view ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    {view}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-[300px]">
              <RevenueChart data={revenueChartData} view={revenueView} />
            </div>
          </div>

          <div className="bg-white p-0 rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-slate-100 bg-slate-50/30">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
                <FiStar className="text-amber-500" /> Top Centres
              </h2>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50/80">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Rank</th>
                    <th className="px-5 py-3 font-semibold">Centre</th>
                    <th className="px-5 py-3 font-semibold text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {centreList.slice(0, 5).map((centre, idx) => (
                    <tr key={centre.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-slate-200 text-slate-700' : idx === 2 ? 'bg-orange-100 text-orange-800' : 'text-slate-400'}`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-800 group-hover:text-indigo-600 transition-colors">{centre.name}</td>
                      <td className="px-5 py-3.5 text-right font-medium text-emerald-600">{formatCurrency(centre.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Financial & Performance Highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Wallets */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
            <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2 tracking-tight">
              <FiDollarSign className="text-emerald-500" /> Wallet Balances
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-sm font-medium text-slate-600">Cash</span>
                <span className="text-base font-bold text-slate-800">{formatCurrency(walletCash)}</span>
              </div>
              <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-sm font-medium text-slate-600">Bank</span>
                <span className="text-base font-bold text-slate-800">{formatCurrency(walletBank)}</span>
              </div>
              <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-sm font-medium text-slate-600">Digital</span>
                <span className="text-base font-bold text-slate-800">{formatCurrency(walletDigital)}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-indigo-50 rounded-xl border border-indigo-100 mt-4">
                <span className="text-sm font-bold text-indigo-800">Total Asset</span>
                <span className="text-lg font-black text-indigo-900">{formatCurrency(walletTotal)}</span>
              </div>
            </div>
          </div>

          {/* Extreme Performers */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100">
              <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <FiTarget className="text-emerald-500" /> Best Metrics
              </h2>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Top Revenue</p>
                  <p className="text-lg font-bold text-slate-800 mt-0.5">{best.revenue?.name || "N/A"}</p>
                  <p className="text-sm text-slate-500">{formatCurrency(best.revenue?.value)}</p>
                </div>
                <div className="h-px bg-slate-100"></div>
                <div>
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Top Rated</p>
                  <p className="text-lg font-bold text-slate-800 mt-0.5">{best.rating?.name || "N/A"}</p>
                  <p className="text-sm text-slate-500 flex items-center gap-1"><FiStar className="text-amber-400 fill-current" /> {best.rating?.value || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-rose-100">
              <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <FiAlertCircle className="text-rose-500" /> Needs Attention
              </h2>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide">Lowest Profit</p>
                  <p className="text-lg font-bold text-slate-800 mt-0.5">{worst.revenue?.name || "N/A"}</p>
                  <p className="text-sm text-slate-500">{formatCurrency(worst.revenue?.value)}</p>
                </div>
                <div className="h-px bg-slate-100"></div>
                <div>
                  <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide">Highest Delayed</p>
                  <p className="text-lg font-bold text-slate-800 mt-0.5">{worst.delayed?.name || "N/A"}</p>
                  <p className="text-sm text-slate-500">{worst.delayed?.value ?? "N/A"} issues</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Staff & Teams */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StaffPerformanceChart staffData={topStaffList} />
          <div className="bg-white p-0 rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50/30">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
                <FiUsers className="text-purple-500" /> Top Teams Overview
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50/80">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Team Name</th>
                    <th className="px-6 py-4 font-semibold text-right">Revenue</th>
                    <th className="px-6 py-4 font-semibold text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topTeamsList.map((team, idx) => (
                    <tr key={team.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">{team.name}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(team.revenue)}</td>
                      <td className="px-6 py-4 text-right font-medium text-emerald-600">{formatCurrency(team.profit || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Logs & Actions Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notifications */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col h-[400px]">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 tracking-tight">
              <FiBell className="text-amber-500" /> Action Required
            </h2>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 scrollbar-thin scrollbar-thumb-slate-200">
              {notifications.length > 0 ? (
                notifications.map((notif) => (
                  <div key={notif.id} className={`p-4 rounded-xl flex gap-3 border ${notif.priority === "critical" ? "bg-rose-50/50 border-rose-100" : notif.priority === "warning" ? "bg-amber-50/50 border-amber-100" : "bg-blue-50/50 border-blue-100"}`}>
                    <FiAlertCircle className={`mt-0.5 flex-shrink-0 ${notif.priority === "critical" ? "text-rose-500" : notif.priority === "warning" ? "text-amber-500" : "text-blue-500"}`} />
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">{notif.title}</h4>
                      <p className="text-xs text-slate-600 mt-1">{notif.message}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <FiCheckCircle className="h-8 w-8 mb-2 text-emerald-400" />
                  <p className="text-sm">All caught up!</p>
                </div>
              )}
            </div>
          </div>

          {/* Closing Log */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col h-[400px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
                <FiFileText className="text-indigo-500" /> Closing Log
              </h2>
              <input
                type="date"
                value={closingDate || closingData.date || ""}
                max={todayIST()}
                onChange={(e) => setClosingDate(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
            {!closingLoading && !closingError && (
              <p className="text-xs text-slate-500 mb-3 font-medium bg-slate-50 py-1.5 px-3 rounded-lg inline-block">
                {closedCount} of {closingRows.length} centres closed
              </p>
            )}
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 scrollbar-thin scrollbar-thumb-slate-200">
              {closingLoading ? (
                 <div className="h-full flex items-center justify-center"><FiLoader className="animate-spin text-slate-400 h-6 w-6" /></div>
              ) : closingError ? (
                 <p className="text-sm text-rose-500 p-4 bg-rose-50 rounded-lg text-center">Could not load closing log.</p>
              ) : closingRows.length === 0 ? (
                 <p className="text-sm text-slate-500 text-center mt-10">No records found.</p>
              ) : (
                closingRows.map((row) => {
                  const v = getClosingView(row);
                  return (
                    <div key={row.centre_id} className={`p-3.5 rounded-xl border flex items-start gap-3 ${v.wrap}`}>
                      <v.Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${v.text}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-semibold text-slate-800 truncate pr-2">{row.centre_name}</p>
                          <span className={`text-[10px] uppercase tracking-wider font-bold whitespace-nowrap ${v.text}`}>{v.label}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{v.detail}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Map + Quick Actions */}
          <div className="flex flex-col gap-6 h-[400px]">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 flex-1 flex flex-col">
              <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <FiMap className="text-blue-500" /> Network Map
              </h2>
              <div className="flex-1 rounded-xl overflow-hidden">
                <MapView />
              </div>
            </div>
            
            <div className="bg-indigo-900 p-5 rounded-2xl shadow-md border border-indigo-800 text-white">
              <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
                <FiLayout className="text-indigo-300" /> Quick Actions
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => navigate('/dashboard/superadmin/centremanagement')} className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors border border-white/5">
                  <FiPlus /> New Centre
                </button>
                <button onClick={() => navigate('/dashboard/superadmin/messenger')} className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors border border-white/5">
                  <FiMessageSquare /> Broadcast
                </button>
                <button onClick={() => navigate('/dashboard/superadmin/analytics')} className="flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-medium transition-colors border border-indigo-400/30 col-span-2">
                  <FiDownload /> Export Master Report
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SuperadminDashboard;