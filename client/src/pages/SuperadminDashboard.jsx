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
  FiCheckCircle, FiXCircle, FiLoader
} from "react-icons/fi";

// ==========================================
// ACCOUNTING CLOSING LOG HELPERS
// ==========================================
// Adjust the path if your accounting router is mounted somewhere else
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

// Returns { start, end } as "YYYY-MM-DD" (IST calendar dates)
const getPeriodRange = (period) => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [y, m, d] = today.split("-").map(Number);
  const fmt = (dt) => dt.toISOString().split("T")[0]; // dt is built with Date.UTC, so no timezone drift

  let start;
  switch (period) {
    case "today":
      start = new Date(Date.UTC(y, m - 1, d));
      break;
    case "week": {
      // week starts on Monday
      const base = new Date(Date.UTC(y, m - 1, d));
      const dow = base.getUTCDay(); // 0 = Sunday
      start = new Date(Date.UTC(y, m - 1, d - (dow === 0 ? 6 : dow - 1)));
      break;
    }
    case "3months": // current month + previous 2 full months
      start = new Date(Date.UTC(y, m - 1 - 2, 1));
      break;
    case "6months": // current month + previous 5 full months
      start = new Date(Date.UTC(y, m - 1 - 5, 1));
      break;
    case "year":
      start = new Date(Date.UTC(y, 0, 1));
      break;
    case "month":
    default:
      start = new Date(Date.UTC(y, m - 1, 1));
  }
  return { start: fmt(start), end: today };
};

const inr = (n) => `₹${Math.abs(Number(n || 0)).toLocaleString("en-IN")}`;

const todayIST = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const getClosingView = (row) => {
  if (row.status === "not_closed") {
    return {
      Icon: FiXCircle,
      label: "Not closed",
      detail: "No closing submitted",
      wrap: "bg-rose-50/80 border-rose-200",
      chip: "bg-rose-100 text-rose-700",
      icon: "text-rose-600",
    };
  }
  if (row.status === "incomplete") {
    return {
      Icon: FiAlertCircle,
      label: "Not fully closed",
      detail: `Cash counted (${inr(row.actual_cash)}), closing not completed`,
      wrap: "bg-amber-50/80 border-amber-200",
      chip: "bg-amber-100 text-amber-700",
      icon: "text-amber-600",
    };
  }
  const variance = Number(row.cash_variance || 0);
  if (variance === 0) {
    return {
      Icon: FiCheckCircle,
      label: "Closed",
      detail: `Cash ${inr(row.actual_cash)} • no variance`,
      wrap: "bg-emerald-50/80 border-emerald-200",
      chip: "bg-emerald-100 text-emerald-700",
      icon: "text-emerald-600",
    };
  }
  return {
    Icon: FiAlertCircle,
    label: "Closed with variance",
    detail: `Cash ${inr(row.actual_cash)} • ${inr(variance)} ${variance < 0 ? "short" : "over"}`,
    wrap: "bg-rose-50/80 border-rose-200",
    chip: "bg-rose-100 text-rose-700",
    icon: "text-rose-600",
  };
};

// ==========================================
// SHARED UI PRIMITIVES
// ==========================================
const SectionCard = ({ title, subtitle, icon, action, children, className = "", bodyClassName = "" }) => (
  <div
    className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 transition-shadow duration-300 hover:shadow-lg hover:shadow-slate-200/60 ${className}`}
  >
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 text-base ring-1 ring-slate-200/70">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-tight text-slate-800">{title}</h2>
          {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
    <div className={`p-5 ${bodyClassName}`}>{children}</div>
  </div>
);

const TrendPill = ({ trend }) => {
  if (trend === undefined || trend === null || trend === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
        —
      </span>
    );
  }
  const up = trend > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
        up ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
      }`}
    >
      {up ? <FiArrowUp className="h-3 w-3" /> : <FiArrowDown className="h-3 w-3" />}
      {Math.abs(trend)}%
    </span>
  );
};

// ==========================================
// STAFF PERFORMANCE CHART
// ==========================================
const StaffPerformanceChart = ({ staffData }) => {
  const [metric, setMetric] = useState('serviceCharges');

  if (!staffData || staffData.length === 0) {
    return (
      <SectionCard title="Top Staff Performers" subtitle="Ranked across all centres" icon="👨‍💼">
        <div className="py-10 text-center text-sm text-slate-400">No staff data available</div>
      </SectionCard>
    );
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  const BarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-xl border border-white/10 bg-slate-900/95 p-3 text-sm shadow-2xl backdrop-blur">
          <p className="mb-1 text-base font-bold text-white">{data.name}</p>
          <p className="mb-2 text-xs text-slate-400">{data.centre}</p>
          <p className="font-semibold text-blue-400">Service Charges: {formatCurrency(data.serviceCharges)}</p>
          <p className="font-semibold text-purple-400">Services: {data.servicesCompleted}</p>
        </div>
      );
    }
    return null;
  };

  const ScatterTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-xl border border-white/10 bg-slate-900/95 p-3 text-sm shadow-2xl backdrop-blur">
          <p className="mb-1 text-base font-bold text-white">{data.name}</p>
          <p className="mb-2 text-xs text-slate-400">{data.centre}</p>
          <p className="font-semibold text-purple-400">Services: {data.servicesCompleted}</p>
          <p className="font-semibold text-blue-400">Service Charges: {formatCurrency(data.serviceCharges)}</p>
        </div>
      );
    }
    return null;
  };

  const tabs = [
    { key: 'serviceCharges', label: 'Service Charges', active: 'text-blue-600' },
    { key: 'servicesCompleted', label: 'Applications', active: 'text-purple-600' },
    { key: 'scatter', label: 'Efficiency', active: 'text-emerald-600' },
  ];

  return (
    <SectionCard
      title="Top Staff Performers"
      subtitle="Ranked across all centres"
      icon="👨‍💼"
      className="flex h-[450px] flex-col"
      bodyClassName="flex flex-1 flex-col p-5 pt-4"
      action={
        <div className="flex rounded-xl bg-slate-100/90 p-1 ring-1 ring-slate-200/70">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setMetric(t.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                metric === t.key
                  ? `bg-white ${t.active} shadow-sm`
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="min-h-0 flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {metric === 'scatter' ? (
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                type="number"
                dataKey="servicesCompleted"
                name="Applications"
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                label={{ value: 'Total Applications', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#94a3b8' }}
              />
              <YAxis
                type="number"
                dataKey="serviceCharges"
                name="Service Charges"
                tickFormatter={(val) => `₹${(val / 1000)}k`}
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <ZAxis type="number" dataKey="serviceCharges" range={[100, 500]} name="Volume" />
              <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter name="Staff" data={staffData} fill="#10B981" opacity={0.75} />
            </ScatterChart>
          ) : (
            <BarChart data={staffData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#475569' }}
                width={110}
              />
              <Tooltip content={<BarTooltip />} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey={metric} radius={[0, 6, 6, 0]} barSize={18} animationDuration={1000}>
                {staffData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={metric === 'serviceCharges' ? '#3B82F6' : '#8B5CF6'}
                    className="cursor-pointer transition-opacity duration-200 hover:opacity-80"
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
};

// ==========================================
// REVENUE CHART COMPONENT
// ==========================================
const RevenueChart = ({ data, view }) => {
  if (!data || data.length === 0) {
    return <div className="p-6 text-center text-sm text-slate-400">No revenue data available</div>;
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
  };

  const formatLabel = (label) => {
    if (!label) return '';
    if (label.length === 7) {
      const date = new Date(label + '-01');
      return date.toLocaleString('default', { month: 'short', year: '2-digit' });
    }
    if (label.length === 10) return label.slice(5);
    return label;
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="rounded-xl border border-white/10 bg-slate-900/95 p-3 text-sm shadow-2xl backdrop-blur">
          <p className="text-base font-bold text-white">{formatLabel(item.label)}</p>
          <p className="font-semibold text-blue-400">Value: {formatCurrency(item.value)}</p>
        </div>
      );
    }
    return null;
  };

  const getBarColor = () => {
    if (view === 'profit') return '#22c55e';
    if (view === 'expenses') return '#ef4444';
    return '#3b82f6';
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis
          dataKey="label"
          tickFormatter={formatLabel}
          tick={{ fontSize: 12, fill: '#64748b' }}
          axisLine={{ stroke: '#e2e8f0' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(val) => `₹${(val / 1000)}k`}
          tick={{ fontSize: 12, fill: '#64748b' }}
          axisLine={{ stroke: '#e2e8f0' }}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
        <Bar
          dataKey="value"
          fill={getBarColor()}
          radius={[6, 6, 0, 0]}
          barSize={data.length > 6 ? 30 : Math.min(60, 80 / data.length)}
          animationDuration={800}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill="url(#revenueGradient)"
              className="transition-opacity hover:opacity-80"
            />
          ))}
        </Bar>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={getBarColor()} stopOpacity={0.95} />
            <stop offset="100%" stopColor={getBarColor()} stopOpacity={0.35} />
          </linearGradient>
        </defs>
      </BarChart>
    </ResponsiveContainer>
  );
};

// ==========================================
// StatCard Component
// ==========================================
const StatCard = ({ title, value, icon: Icon, gradient = "from-indigo-500 to-blue-500", subtitle, trend, onClick, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay, ease: "easeOut" }}
    whileHover={{ y: -4 }}
    whileTap={{ scale: 0.985 }}
    onClick={onClick}
    className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 transition-shadow duration-300 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100/60 ${
      onClick ? 'cursor-pointer' : ''
    }`}
  >
    {/* soft gradient glow */}
    <div
      className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${gradient} opacity-[0.10] blur-2xl transition-opacity duration-300 group-hover:opacity-25`}
    />
    {/* top accent line */}
    <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />

    <div className="relative flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
        <div className="mt-2 flex items-end gap-2">
          <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          <div className="pb-0.5">
            <TrendPill trend={trend} />
          </div>
        </div>
        <p className="mt-1.5 truncate text-xs text-slate-500">{subtitle}</p>
      </div>
      <div
        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg shadow-slate-200/80 transition-transform duration-300 group-hover:scale-110`}
      >
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </motion.div>
);

// ==========================================
// MAIN DASHBOARD COMPONENT
// ==========================================
const SuperadminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [revenueView, setRevenueView] = useState("revenue");
  const [period, setPeriod] = useState("month"); // default: This Month

  // Accounting closing log (all centres)
  const [closingDate, setClosingDate] = useState(""); // empty = backend default (yesterday, IST)
  const [closingData, setClosingData] = useState({ date: "", rows: [] });
  const [closingLoading, setClosingLoading] = useState(true);
  const [closingError, setClosingError] = useState(false);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
  };

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
            params: {
              modules: "stats,financials,leaderboards,health,alerts,customers,staff,teams,wallets,insights",
              timeframe: "custom",
              customStartDate: start,
              customEndDate: end
            },
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
          }
        );

        setDashboard(response.data);
        setLoading(false);
      } catch (err) {
        if (axios.isCancel(err)) return; // superseded by a newer request
        console.error("Error fetching dashboard:", err);
        toast.error("Failed to load dashboard data.", { position: "top-right" });
        setLoading(false);
      }
    };
    fetchDashboard();

    // cancel the previous request if the period changes quickly
    return () => controller.abort();
  }, [period]);

  // Fetch accounting closing log for all centres
  useEffect(() => {
    const controller = new AbortController();
    setClosingLoading(true);
    setClosingError(false);

    axios
      .get(CLOSING_ENDPOINT, {
        params: closingDate ? { date: closingDate } : {},
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        signal: controller.signal,
      })
      .then((res) => {
        setClosingData(res.data);
        setClosingLoading(false);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        console.error("Closing log error:", err);
        setClosingError(true);
        setClosingLoading(false);
      });

    return () => controller.abort();
  }, [closingDate]);

  if (loading && !dashboard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/50 p-4 lg:p-8">
        <div className="mx-auto max-w-[1600px] animate-pulse space-y-6">
          <div className="h-14 w-full rounded-2xl bg-white/70" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl border border-slate-200/70 bg-white/70" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="h-80 rounded-2xl border border-slate-200/70 bg-white/70 lg:col-span-2" />
            <div className="h-80 rounded-2xl border border-slate-200/70 bg-white/70" />
          </div>
          <div className="flex items-center justify-center gap-2 py-6 text-slate-500">
            <FiLoader className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">Loading Superadmin Dashboard…</span>
          </div>
        </div>
      </div>
    );
  }

  const { executive = {}, finance = {}, operations = {}, leaderboards = {} } = dashboard || {};

  // --- Executive ---
  const { stats = {}, health = {}, alerts = [], insights = [] } = executive;

  // --- Finance ---
  const { financials = {}, wallets = {} } = finance;
  const chartData = financials.charts || {};
  const revenueChartData = chartData[revenueView] || [];

  // --- Operations ---
  const { customers = {}, staff = {}, teams = {} } = operations;

  // --- Leaderboards ---
  const { centres = {} } = leaderboards;
  const centreList = centres.fullList || [];
  const best = centres.best || {};
  const worst = centres.worst || {};

  // Direct access to pre‑computed fields
  const {
    totalCentres, totalStaff, totalCustomers, customerGrowth, revenueGrowthPercent,
    newCentresThisMonth, todayRevenue, todayServices, pendingServices, delayedServices,
    inProgressServices, admins, staffCount
  } = stats;

  const { revenue: monthlyRevenue, profit: netProfit } = financials.totals || {};
  const { cash: walletCash, bank: walletBank, digital: walletDigital, total: walletTotal } = wallets.summary || {};
  const { averageRating: avgRating, totalReviews } = customers.summary || {};

  const topStaffList = staff.topPerformers || [];
  const topTeamsList = teams.topTeams || [];
  const notifications = alerts;

  const closingRows = closingData.rows || [];
  const closedCount = closingRows.filter((r) => r.status === "closed").length;
  const closeProgress = closingRows.length ? Math.round((closedCount / closingRows.length) * 100) : 0;

  const MapView = () => {
    return (
      <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/60 ring-1 ring-slate-200/70">
        <svg viewBox="0 0 200 200" className="h-full w-full">
          <path d="M50,50 L150,50 L180,120 L120,180 L40,160 Z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
          {centreList.map((centre) => {
            const status = centre.healthStatus || { color: "gray" };
            const color = status.color === "green" ? "#22c55e" : status.color === "yellow" ? "#eab308" : "#ef4444";
            const x = 40 + (centre.id * 30) % 140;
            const y = 40 + (centre.id * 20) % 120;
            return (
              <circle key={centre.id} cx={x} cy={y} r="6" fill={color} stroke="white" strokeWidth="2" />
            );
          })}
        </svg>
        <div className="absolute bottom-3 left-3 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm backdrop-blur">
          Kerala Map
        </div>
      </div>
    );
  };

  // Prepare data for the StatCards
  const kpiData = [
    {
      title: "Total Centres",
      value: totalCentres,
      icon: FiHome,
      gradient: "from-blue-500 to-indigo-500",
      subtitle: `+${newCentresThisMonth ?? 0} this month`,
      trend: newCentresThisMonth > 0 ? 5 : -2,
      onClick: () => navigate('/dashboard/superadmin/centremanagement')
    },
    {
      title: "Total Staff",
      value: totalStaff,
      icon: FiUsers,
      gradient: "from-violet-500 to-purple-500",
      subtitle: `${admins ?? 0} Admins, ${staffCount ?? 0} Staff`,
      trend: 0,
      onClick: () => navigate('/dashboard/superadmin/staffmanagement')
    },
    {
      title: "Customers",
      value: totalCustomers?.toLocaleString(),
      icon: FiUserCheck,
      gradient: "from-emerald-500 to-teal-500",
      subtitle: `+${customerGrowth ?? 0} this month`,
      trend: customerGrowth > 0 ? 8 : -3,
    },
    {
      title: "Today's Services",
      value: todayServices ?? 0,
      icon: FiShoppingBag,
      gradient: "from-indigo-500 to-blue-500",
      subtitle: "All centres",
      trend: 0,
    },
    {
      title: "Today's Revenue",
      value: formatCurrency(todayRevenue),
      icon: FiDollarSign,
      gradient: "from-amber-500 to-orange-500",
      subtitle: "Live collection",
      trend: todayRevenue > 0 ? 12 : -5,
    },
    {
      title: "Period Revenue",
      value: formatCurrency(monthlyRevenue),
      icon: FiTrendingUp,
      gradient: "from-orange-500 to-rose-500",
      subtitle: "vs previous",
      trend: revenueGrowthPercent,
    },
    {
      title: "Period Profit",
      value: formatCurrency(netProfit),
      icon: FiPieChart,
      gradient: "from-rose-500 to-pink-500",
      subtitle: "Selected range",
      trend: netProfit > 0 ? 6 : -2,
    },
    {
      title: "Pending Payments",
      value: formatCurrency(health?.metrics?.pendingPaymentValue),
      icon: FiAlertCircle,
      gradient: "from-pink-500 to-fuchsia-500",
      subtitle: `${health?.metrics?.pendingCustomers ?? 0} Customers`,
      trend: health?.metrics?.pendingCustomers > 5 ? 15 : -4,
    }
  ];

  const revenueTabs = [
    { key: 'revenue', label: 'Revenue', active: 'text-blue-600' },
    { key: 'profit', label: 'Profit', active: 'text-emerald-600' },
    { key: 'expenses', label: 'Expenses', active: 'text-rose-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/50">
      {/* ================= Sticky Header ================= */}
      <div className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3.5 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-lg shadow-lg shadow-indigo-200">
              📊
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 lg:text-xl">
                Superadmin Dashboard
              </h1>
              <p className="text-[11px] font-medium text-slate-500">
                Network-wide overview &amp; performance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {loading && <FiLoader className="h-4 w-4 animate-spin text-indigo-600" />}
            <div className="relative">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-4 pr-9 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                aria-label="Select period"
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                ▾
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= Content ================= */}
      <div className="mx-auto max-w-[1600px] space-y-6 p-4 lg:p-8">

        {/* ---------- KPI Cards ---------- */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpiData.map((kpi, index) => (
            <StatCard key={index} {...kpi} delay={index * 0.04} />
          ))}
        </div>

        {/* ---------- Revenue Analytics + Centre Leaderboard ---------- */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <SectionCard
            title="Revenue Analytics"
            subtitle="Trend for the selected period"
            icon="📈"
            className="lg:col-span-2"
            action={
              <div className="flex rounded-xl bg-slate-100/90 p-1 ring-1 ring-slate-200/70">
                {revenueTabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setRevenueView(t.key)}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                      revenueView === t.key
                        ? `bg-white ${t.active} shadow-sm`
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            }
          >
            <RevenueChart data={revenueChartData} view={revenueView} />
          </SectionCard>

          <SectionCard
            title="Centre Leaderboard"
            subtitle="Top 5 by profit"
            icon="🏆"
            bodyClassName="p-3 pt-2"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Rank</th>
                    <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Centre</th>
                    <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Profit</th>
                    <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {centreList.slice(0, 5).map((centre, idx) => (
                    <tr key={centre.id} className="cursor-pointer transition-colors hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-3 py-3">
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                            idx === 0
                              ? 'bg-amber-100 text-amber-700'
                              : idx === 1
                              ? 'bg-slate-200 text-slate-700'
                              : idx === 2
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-800">{centre.name}</td>
                      <td className="px-3 py-3 font-semibold text-emerald-600">{formatCurrency(centre.profit)}</td>
                      <td className="px-3 py-3 text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          {centre.rating || 0} <span className="text-amber-400">★</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        {/* ---------- Centre Health ---------- */}
        <SectionCard
          title="Centre Health"
          subtitle="Live status across the network"
          icon="🏥"
          bodyClassName="p-5"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {centreList.map((centre) => {
              const status = centre.healthStatus || { label: "Unknown", icon: "❓", color: "gray" };
              const dot =
                status.color === "green"
                  ? "bg-emerald-500"
                  : status.color === "yellow"
                  ? "bg-amber-500"
                  : status.color === "gray"
                  ? "bg-slate-400"
                  : "bg-rose-500";
              return (
                <div
                  key={centre.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-white hover:shadow-md"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-800">{centre.name}</div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                      <span className={`h-2 w-2 rounded-full ${dot}`} />
                      <span className="font-medium text-slate-600">{status.icon} {status.label}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-slate-800">{centre.rating || 0}</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">Rating</div>
                  </div>
                </div>
              );
            })}
          </div>

          {health?.overallScore !== undefined && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Overall Network Health Score</span>
                <span className="text-sm font-bold text-slate-800">{health.overallScore}/100</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(0, health.overallScore))}%` }}
                />
              </div>
            </div>
          )}
        </SectionCard>

        {/* ---------- Live Operations ---------- */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {pendingServices !== undefined && (
            <div className="group rounded-2xl border border-rose-200/70 bg-gradient-to-br from-rose-50 to-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
              <div className="text-xs font-semibold text-rose-700">🕒 Pending Services</div>
              <div className="mt-1.5 text-2xl font-bold tracking-tight text-rose-900">{pendingServices}</div>
            </div>
          )}
          {todayServices !== undefined && (
            <div className="group rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
              <div className="text-xs font-semibold text-emerald-700">✅ Completed Today</div>
              <div className="mt-1.5 text-2xl font-bold tracking-tight text-emerald-900">{todayServices}</div>
            </div>
          )}
          {delayedServices !== undefined && (
            <div className="group rounded-2xl border border-orange-200/70 bg-gradient-to-br from-orange-50 to-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
              <div className="text-xs font-semibold text-orange-700">⏳ Delayed Services</div>
              <div className="mt-1.5 text-2xl font-bold tracking-tight text-orange-900">{delayedServices}</div>
            </div>
          )}
          {inProgressServices !== undefined && (
            <div className="group rounded-2xl border border-blue-200/70 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
              <div className="text-xs font-semibold text-blue-700">📋 In Progress</div>
              <div className="mt-1.5 text-2xl font-bold tracking-tight text-blue-900">{inProgressServices}</div>
            </div>
          )}
        </div>

        {/* ---------- Financial Health ---------- */}
        <SectionCard title="Financial Health" subtitle="Wallet balances across the network" icon="💰">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: "Cash Wallet", value: walletCash, tone: "bg-slate-50/70" },
              { label: "Bank", value: walletBank, tone: "bg-slate-50/70" },
              { label: "Digital", value: walletDigital, tone: "bg-slate-50/70" },
            ].map((w) => (
              <div
                key={w.label}
                className={`rounded-xl border border-slate-200/80 ${w.tone} p-4 transition-all duration-200 hover:bg-white hover:shadow-md`}
              >
                <div className="mb-1 text-xs font-medium text-slate-500">{w.label}</div>
                <div className="text-xl font-bold tracking-tight text-slate-800">{formatCurrency(w.value)}</div>
              </div>
            ))}
            <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm transition-all duration-200 hover:shadow-md">
              <div className="mb-1 text-xs font-semibold text-indigo-700">Total Wallets</div>
              <div className="text-2xl font-bold tracking-tight text-indigo-900">{formatCurrency(walletTotal)}</div>
            </div>
          </div>
        </SectionCard>

        {/* ---------- Best & Worst Centres ---------- */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SectionCard title="Best Performing Centres" subtitle="Top of the network" icon="🏆">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Best Revenue</div>
                <div className="truncate font-bold text-slate-800">{best.revenue?.name || "N/A"}</div>
                <div className="mt-0.5 text-lg font-semibold text-emerald-700">{formatCurrency(best.revenue?.value)}</div>
              </div>
              <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-blue-700">Best Profit</div>
                <div className="truncate font-bold text-slate-800">{best.profit?.name || "N/A"}</div>
                <div className="mt-0.5 text-lg font-semibold text-blue-700">{formatCurrency(best.profit?.value)}</div>
              </div>
              <div className="col-span-2 rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-700">Best Rating</div>
                <div className="flex items-end justify-between">
                  <div className="truncate font-bold text-slate-800">{best.rating?.name || "N/A"}</div>
                  <div className="text-lg font-bold text-amber-600">{best.rating?.value || 0} ★</div>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Worst Performing Centres" subtitle="Needs attention" icon="⚠️">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-4">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-rose-700">Lowest Profit</div>
                <div className="truncate font-bold text-slate-800">{worst.revenue?.name || "N/A"}</div>
                <div className="mt-0.5 text-lg font-semibold text-rose-700">{formatCurrency(worst.revenue?.value)}</div>
              </div>
              <div className="rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-4">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-rose-700">Highest Pending</div>
                <div className="truncate font-bold text-slate-800">{worst.pending?.name || "N/A"}</div>
                <div className="mt-0.5 text-lg font-semibold text-rose-700">
                  {worst.pending?.value ? formatCurrency(worst.pending.value) : "N/A"}
                </div>
              </div>
              <div className="rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-4">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-orange-700">Most Delayed</div>
                <div className="truncate font-bold text-slate-800">{worst.delayed?.name || "N/A"}</div>
                <div className="mt-0.5 text-lg font-semibold text-orange-700">{worst.delayed?.value ?? "N/A"}</div>
              </div>
              <div className="rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-4">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-orange-700">Most Complaints</div>
                <div className="truncate font-bold text-slate-800">{worst.complaints?.name || "N/A"}</div>
                <div className="mt-0.5 text-lg font-semibold text-orange-700">{worst.complaints?.value ?? "N/A"}</div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ---------- Top Staff & Teams ---------- */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <StaffPerformanceChart staffData={topStaffList} />

          <SectionCard
            title="Top Teams"
            subtitle="Revenue, profit & expenses"
            icon="👥"
            bodyClassName="p-3 pt-2"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Team</th>
                    <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Revenue</th>
                    <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Profit</th>
                    <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Expenses</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topTeamsList.map((team, idx) => (
                    <tr key={team.id || idx} className="transition-colors hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-3 py-3.5 font-medium text-slate-900">{team.name}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-slate-600">{formatCurrency(team.revenue)}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 font-semibold text-emerald-600">{formatCurrency(team.profit || 0)}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 font-medium text-rose-500">{formatCurrency(team.expenses || 0)}</td>
                    </tr>
                  ))}
                  {topTeamsList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-400">
                        No team data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        {/* ---------- Notifications & Accounting Closing Log ---------- */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SectionCard
            title="Action Required"
            subtitle={`${notifications.length} item${notifications.length === 1 ? "" : "s"} needing attention`}
            icon="🔔"
            bodyClassName="p-5 pt-4"
          >
            <div className="max-h-80 space-y-3 overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-300">
              {notifications.length > 0 ? (
                notifications.map((notif) => {
                  const tone =
                    notif.priority === "critical"
                      ? { bar: "bg-rose-500", bg: "bg-rose-50/70", ring: "border-rose-200/70", dot: "bg-rose-500" }
                      : notif.priority === "warning"
                      ? { bar: "bg-amber-500", bg: "bg-amber-50/70", ring: "border-amber-200/70", dot: "bg-amber-500" }
                      : { bar: "bg-blue-500", bg: "bg-blue-50/70", ring: "border-blue-200/70", dot: "bg-blue-500" };
                  return (
                    <div
                      key={notif.id}
                      className={`relative flex items-start gap-3 overflow-hidden rounded-xl border ${tone.ring} ${tone.bg} p-4 transition-all duration-200 hover:shadow-sm`}
                    >
                      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} />
                      <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${tone.dot}`} />
                      <div className="flex-1">
                        <div className="mb-0.5 text-sm font-semibold text-slate-800">{notif.title}</div>
                        <div className="text-sm leading-relaxed text-slate-600">{notif.message}</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl bg-slate-50 p-6 text-center text-sm italic text-slate-400">
                  All caught up! No pending notifications.
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Accounting Closing Log"
            subtitle={
              !closingLoading && !closingError
                ? `${closedCount} of ${closingRows.length} centres closed`
                : "Daily close status by centre"
            }
            icon="📒"
            bodyClassName="p-5 pt-4"
            action={
              <input
                type="date"
                value={closingDate || closingData.date || ""}
                max={todayIST()}
                onChange={(e) => setClosingDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                aria-label="Accounting date"
              />
            }
          >
            {!closingLoading && !closingError && closingRows.length > 0 && (
              <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700"
                  style={{ width: `${closeProgress}%` }}
                />
              </div>
            )}

            <div className="max-h-80 space-y-3 overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-300">
              {closingLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : closingError ? (
                <div className="rounded-xl bg-rose-50 p-4 text-center text-sm font-medium text-rose-600">
                  Could not load closing log.
                </div>
              ) : closingRows.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-6 text-center text-sm italic text-slate-400">
                  No centres found.
                </div>
              ) : (
                closingRows.map((row) => {
                  const v = getClosingView(row);
                  return (
                    <div
                      key={row.centre_id}
                      className={`flex items-start gap-3 rounded-xl border p-3.5 transition-all duration-200 hover:shadow-sm ${v.wrap}`}
                    >
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/80 ${v.icon}`}>
                        <v.Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">{row.centre_name}</p>
                          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${v.chip}`}>
                            {v.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{v.detail}</p>
                        {row.status === "closed" && row.closed_at && (
                          <p className="mt-1 text-[11px] text-slate-400">
                            Closed{" "}
                            {new Date(row.closed_at).toLocaleString("en-IN", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {row.closed_by_name ? ` by ${row.closed_by_name}` : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </SectionCard>
        </div>

        {/* ---------- Map View ---------- */}
        <SectionCard title="Centre Network Map" subtitle="Geographic distribution & health" icon="🗺️">
          <MapView />
        </SectionCard>

        {/* ---------- Quick Actions ---------- */}
        <SectionCard title="Quick Actions" subtitle="Shortcuts to common tasks" icon="⚡">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/dashboard/superadmin/centremanagement')}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-300"
            >
              <span>➕</span> Create Centre
            </button>
            <button
              onClick={() => navigate('/dashboard/superadmin/centremanagement')}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-purple-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-300"
            >
              <span>👤</span> Create Admin
            </button>
            <button
              onClick={() => navigate('/dashboard/superadmin/messenger')}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-300"
            >
              <span>📢</span> Broadcast
            </button>
            <button
              onClick={() => navigate('/dashboard/superadmin/analytics')}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-rose-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-rose-300"
            >
              <span>📊</span> Global Report
            </button>
            <button
              onClick={() => navigate('/dashboard/superadmin/analytics')}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-slate-700 to-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-300"
            >
              <span>📤</span> Export Data
            </button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};

export default SuperadminDashboard;