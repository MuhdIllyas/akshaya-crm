import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  BarChart, Bar, ScatterChart, Scatter, CartesianGrid, ZAxis, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiHome, FiUsers, FiUserCheck, FiShoppingBag, FiDollarSign,
  FiTrendingUp, FiPieChart, FiAlertCircle, FiArrowUp, FiArrowDown,
  FiCheckCircle, FiXCircle, FiLoader, FiGrid, FiActivity, FiBell,
  FiMenu, FiX, FiMapPin
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
    case "today":
      start = new Date(Date.UTC(y, m - 1, d));
      break;
    case "week": {
      const base = new Date(Date.UTC(y, m - 1, d));
      const dow = base.getUTCDay();
      start = new Date(Date.UTC(y, m - 1, d - (dow === 0 ? 6 : dow - 1)));
      break;
    }
    case "3months":
      start = new Date(Date.UTC(y, m - 1 - 2, 1));
      break;
    case "6months":
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
const SectionCard = ({
  title, subtitle, icon, action, children,
  className = "", bodyClassName = "", tone = "default",
}) => {
  const toneRing =
    tone === "indigo"
      ? "ring-indigo-100"
      : tone === "emerald"
      ? "ring-emerald-100"
      : tone === "rose"
      ? "ring-rose-100"
      : "ring-slate-200/70";

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 ring-1 ${toneRing} transition-all duration-300 hover:shadow-lg hover:shadow-slate-200/70 ${className}`}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 text-base ring-1 ring-slate-200/70">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="truncate text-sm font-semibold tracking-tight text-slate-800">{title}</h2>
              )}
              {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </div>
  );
};

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
// STAT CARD (compact, bento-friendly)
// ==========================================
const StatCard = ({
  title, value, icon: Icon, gradient = "from-indigo-500 to-blue-500",
  subtitle, trend, onClick, delay = 0, compact = false,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay, ease: "easeOut" }}
    whileHover={{ y: -3 }}
    whileTap={{ scale: 0.985 }}
    onClick={onClick}
    className={`group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40 transition-all duration-300 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/70 ${
      compact ? "p-4" : "p-5"
    } ${onClick ? "cursor-pointer" : ""}`}
  >
    <div
      className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${gradient} opacity-[0.10] blur-2xl transition-opacity duration-300 group-hover:opacity-25`}
    />
    <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />

    <div className="relative flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
        <div className="mt-2 flex items-end gap-2">
          <p className={`font-bold tracking-tight text-slate-900 ${compact ? "text-xl" : "text-2xl"}`}>{value}</p>
          <div className="pb-0.5">
            <TrendPill trend={trend} />
          </div>
        </div>
        {subtitle && <p className="mt-1 truncate text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div
        className={`flex flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-md shadow-slate-200/80 transition-transform duration-300 group-hover:scale-110 ${
          compact ? "h-9 w-9" : "h-11 w-11"
        }`}
      >
        <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
      </div>
    </div>
  </motion.div>
);

// ==========================================
// SIDEBAR NAV ITEM
// ==========================================
const NavItem = ({ id, label, icon: Icon, badge, active, onClick, badgeTone = "indigo" }) => {
  const badgeColors =
    badgeTone === "rose"
      ? "bg-rose-100 text-rose-700"
      : badgeTone === "amber"
      ? "bg-amber-100 text-amber-700"
      : "bg-indigo-100 text-indigo-700";

  return (
    <button
      onClick={() => onClick(id)}
      className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
        active
          ? "bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {active && (
        <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-gradient-to-b from-indigo-500 to-blue-500" />
      )}
      <Icon className={`h-4.5 w-4.5 flex-shrink-0 ${active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"}`} style={{ width: 18, height: 18 }} />
      <span className="flex-1 truncate text-left">{label}</span>
      {badge !== undefined && badge !== null && badge !== 0 && (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeColors}`}>
          {badge}
        </span>
      )}
    </button>
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

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

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
    { key: 'serviceCharges', label: 'Charges', active: 'text-blue-600' },
    { key: 'servicesCompleted', label: 'Apps', active: 'text-purple-600' },
    { key: 'scatter', label: 'Efficiency', active: 'text-emerald-600' },
  ];

  return (
    <SectionCard
      title="Top Staff Performers"
      subtitle="Ranked across all centres"
      icon="👨‍💼"
      className="flex h-[460px] flex-col"
      bodyClassName="flex flex-1 flex-col p-5 pt-4"
      action={
        <div className="flex rounded-xl bg-slate-100/90 p-1 ring-1 ring-slate-200/70">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setMetric(t.key)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                metric === t.key ? `bg-white ${t.active} shadow-sm` : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="min-h-0 w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          {metric === 'scatter' ? (
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                type="number" dataKey="servicesCompleted" name="Applications"
                tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false}
                label={{ value: 'Total Applications', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#94a3b8' }}
              />
              <YAxis
                type="number" dataKey="serviceCharges" name="Service Charges"
                tickFormatter={(val) => `₹${(val / 1000)}k`}
                tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false}
              />
              <ZAxis type="number" dataKey="serviceCharges" range={[100, 500]} name="Volume" />
              <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter name="Staff" data={staffData} fill="#10B981" opacity={0.75} />
            </ScatterChart>
          ) : (
            <BarChart data={staffData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <XAxis type="number" hide />
              <YAxis
                dataKey="name" type="category" axisLine={false} tickLine={false}
                tick={{ fontSize: 12, fill: '#475569' }} width={110}
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
// REVENUE CHART
// ==========================================
const RevenueChart = ({ data, view }) => {
  if (!data || data.length === 0) {
    return <div className="p-6 text-center text-sm text-slate-400">No revenue data available</div>;
  }

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

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
          dataKey="label" tickFormatter={formatLabel}
          tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false}
        />
        <YAxis
          tickFormatter={(val) => `₹${(val / 1000)}k`}
          tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
        <Bar
          dataKey="value" fill={getBarColor()} radius={[6, 6, 0, 0]}
          barSize={data.length > 6 ? 30 : Math.min(60, 80 / data.length)}
          animationDuration={800}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill="url(#revenueGradient)" className="transition-opacity hover:opacity-80" />
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
// MINI MAP
// ==========================================
const MapView = ({ centreList }) => (
  <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/60 ring-1 ring-slate-200/70">
    <svg viewBox="0 0 200 200" className="h-full w-full">
      <path d="M50,50 L150,50 L180,120 L120,180 L40,160 Z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
      {centreList.map((centre) => {
        const status = centre.healthStatus || { color: "gray" };
        const color = status.color === "green" ? "#22c55e" : status.color === "yellow" ? "#eab308" : "#ef4444";
        const x = 40 + (centre.id * 30) % 140;
        const y = 40 + (centre.id * 20) % 120;
        return <circle key={centre.id} cx={x} cy={y} r="6" fill={color} stroke="white" strokeWidth="2" />;
      })}
    </svg>
    <div className="absolute bottom-3 left-3 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm backdrop-blur">
      Kerala Map
    </div>
  </div>
);

// ==========================================
// MAIN DASHBOARD
// ==========================================
const SuperadminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [revenueView, setRevenueView] = useState("revenue");
  const [period, setPeriod] = useState("month");
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Closing log
  const [closingDate, setClosingDate] = useState("");
  const [closingData, setClosingData] = useState({ date: "", rows: [] });
  const [closingLoading, setClosingLoading] = useState(true);
  const [closingError, setClosingError] = useState(false);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

  // Fetch dashboard
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
              customEndDate: end,
            },
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          }
        );

        setDashboard(response.data);
        setLoading(false);
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("Error fetching dashboard:", err);
        toast.error("Failed to load dashboard data.", { position: "top-right" });
        setLoading(false);
      }
    };
    fetchDashboard();
    return () => controller.abort();
  }, [period]);

  // Fetch closing log
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

  // ------- Loading skeleton -------
  if (loading && !dashboard) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <aside className="hidden w-64 border-r border-slate-200 bg-white lg:block">
          <div className="space-y-3 p-4">
            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </aside>
        <main className="mx-auto w-full max-w-[1400px] flex-1 space-y-6 p-6 lg:p-8">
          <div className="h-14 animate-pulse rounded-2xl bg-white" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
            <div className="h-64 animate-pulse rounded-2xl bg-white lg:col-span-4 lg:row-span-2" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-white lg:col-span-1" />
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 py-4 text-slate-500">
            <FiLoader className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">Loading Superadmin Dashboard…</span>
          </div>
        </main>
      </div>
    );
  }

  // ------- Destructure -------
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

  const {
    totalCentres, totalStaff, totalCustomers, customerGrowth, revenueGrowthPercent,
    newCentresThisMonth, todayRevenue, todayServices, pendingServices, delayedServices,
    inProgressServices, admins, staffCount,
  } = stats;

  const { revenue: monthlyRevenue, profit: netProfit } = financials.totals || {};
  const { cash: walletCash, bank: walletBank, digital: walletDigital, total: walletTotal } = wallets.summary || {};
  const { averageRating: avgRating, totalReviews } = customers.summary || {};

  const topStaffList = staff.topPerformers || [];
  const topTeamsList = teams.topTeams || [];
  const notifications = alerts;

  const closingRows = closingData.rows || [];
  const closedCount = closingRows.filter((r) => r.status === "closed").length;
  const unclosedCount = closingRows.length - closedCount;
  const closeProgress = closingRows.length ? Math.round((closedCount / closingRows.length) * 100) : 0;
  const opsAlertCount = (pendingServices || 0) + (delayedServices || 0);

  // ------- Navigation config -------
  const navItems = [
    { id: "overview", label: "Overview", icon: FiGrid, badge: null },
    { id: "centres", label: "Centres", icon: FiHome, badge: totalCentres },
    { id: "finance", label: "Finance", icon: FiDollarSign, badge: null },
    { id: "operations", label: "Operations", icon: FiActivity, badge: opsAlertCount, badgeTone: "amber" },
    { id: "alerts", label: "Alerts & Closing", icon: FiBell, badge: notifications.length + unclosedCount, badgeTone: "rose" },
  ];

  const handleNav = (id) => {
    setActiveSection(id);
    setSidebarOpen(false);
  };

  const periodSelector = (
    <div className="relative">
      <select
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
        className="cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3.5 pr-9 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        aria-label="Select period"
      >
        {PERIOD_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">▾</span>
    </div>
  );

  const sectionTitle = {
    overview: { title: "Overview", subtitle: "Live snapshot of the whole network" },
    centres: { title: "Centres", subtitle: "Health, ranking & geography" },
    finance: { title: "Finance", subtitle: "Revenue, profit & wallets" },
    operations: { title: "Operations", subtitle: "Services, staff & teams" },
    alerts: { title: "Alerts & Closing", subtitle: "Action items and daily close status" },
  }[activeSection];

  // ==========================================
  // SECTION RENDERERS
  // ==========================================

  const OverviewSection = () => {
    const kpiTiles = [
      {
        title: "Total Centres", value: totalCentres, icon: FiHome,
        gradient: "from-blue-500 to-indigo-500",
        subtitle: `+${newCentresThisMonth ?? 0} this month`,
        trend: newCentresThisMonth > 0 ? 5 : -2,
        onClick: () => navigate('/dashboard/superadmin/centremanagement'),
      },
      {
        title: "Total Staff", value: totalStaff, icon: FiUsers,
        gradient: "from-violet-500 to-purple-500",
        subtitle: `${admins ?? 0} Admins · ${staffCount ?? 0} Staff`,
        trend: 0,
        onClick: () => navigate('/dashboard/superadmin/staffmanagement'),
      },
      {
        title: "Customers", value: totalCustomers?.toLocaleString(), icon: FiUserCheck,
        gradient: "from-emerald-500 to-teal-500",
        subtitle: `+${customerGrowth ?? 0} this month`,
        trend: customerGrowth > 0 ? 8 : -3,
      },
      {
        title: "Today's Services", value: todayServices ?? 0, icon: FiShoppingBag,
        gradient: "from-indigo-500 to-blue-500",
        subtitle: "All centres",
        trend: 0,
      },
    ];

    const revenueTabs = [
      { key: 'revenue', label: 'Revenue', active: 'text-blue-600' },
      { key: 'profit', label: 'Profit', active: 'text-emerald-600' },
      { key: 'expenses', label: 'Expenses', active: 'text-rose-600' },
    ];

    return (
      <div className="space-y-6">
        {/* BENTO HERO */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-6 lg:grid-rows-[auto_auto]">
          {/* Hero: revenue chart */}
          <div className="lg:col-span-4 lg:row-span-2">
            <SectionCard
              title="Revenue Analytics"
              subtitle="Trend for the selected period"
              icon="📈"
              tone="indigo"
              className="h-full flex flex-col"
              bodyClassName="flex-1 p-5 pt-4"
              action={
                <div className="flex rounded-xl bg-slate-100/90 p-1 ring-1 ring-slate-200/70">
                  {revenueTabs.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setRevenueView(t.key)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                        revenueView === t.key ? `bg-white ${t.active} shadow-sm` : 'text-slate-500 hover:text-slate-700'
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
          </div>

          {/* 4 KPI tiles */}
          {kpiTiles.map((kpi, i) => (
            <div key={i} className="lg:col-span-1">
              <StatCard {...kpi} delay={i * 0.04} compact />
            </div>
          ))}
        </div>

        {/* SECONDARY ROW: leaderboard + live ops */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SectionCard
            title="Centre Leaderboard"
            subtitle="Top 5 by profit"
            icon="🏆"
            className="lg:col-span-2"
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
                            idx === 0 ? 'bg-amber-100 text-amber-700'
                            : idx === 1 ? 'bg-slate-200 text-slate-700'
                            : idx === 2 ? 'bg-orange-100 text-orange-700'
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
                  {centreList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-400">No centres</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Live Operations" subtitle="Today" icon="📋" bodyClassName="p-4">
            <div className="space-y-3">
              {[
                { label: "Pending", value: pendingServices, tone: "from-rose-500 to-red-500", bg: "bg-rose-50/60 border-rose-200/70", text: "text-rose-900" },
                { label: "In Progress", value: inProgressServices, tone: "from-blue-500 to-indigo-500", bg: "bg-blue-50/60 border-blue-200/70", text: "text-blue-900" },
                { label: "Delayed", value: delayedServices, tone: "from-orange-500 to-amber-500", bg: "bg-orange-50/60 border-orange-200/70", text: "text-orange-900" },
                { label: "Completed", value: todayServices, tone: "from-emerald-500 to-teal-500", bg: "bg-emerald-50/60 border-emerald-200/70", text: "text-emerald-900" },
              ].map((row) => (
                row.value !== undefined && (
                  <div key={row.label} className={`flex items-center justify-between rounded-xl border ${row.bg} px-4 py-3`}>
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full bg-gradient-to-r ${row.tone}`} />
                      <span className="text-xs font-semibold text-slate-600">{row.label}</span>
                    </div>
                    <span className={`text-lg font-bold ${row.text}`}>{row.value}</span>
                  </div>
                )
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    );
  };

  const CentresSection = () => (
    <div className="space-y-6">
      <SectionCard title="Centre Health" subtitle="Live status across the network" icon="🏥">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {centreList.map((centre) => {
            const status = centre.healthStatus || { label: "Unknown", icon: "❓", color: "gray" };
            const dot =
              status.color === "green" ? "bg-emerald-500"
              : status.color === "yellow" ? "bg-amber-500"
              : status.color === "gray" ? "bg-slate-400"
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

      <SectionCard title="Centre Network Map" subtitle="Geographic distribution & health" icon="🗺️">
        <MapView centreList={centreList} />
      </SectionCard>
    </div>
  );

  const FinanceSection = () => {
    const moneyTiles = [
      {
        title: "Today's Revenue", value: formatCurrency(todayRevenue), icon: FiDollarSign,
        gradient: "from-amber-500 to-orange-500", subtitle: "Live collection",
        trend: todayRevenue > 0 ? 12 : -5,
      },
      {
        title: "Period Revenue", value: formatCurrency(monthlyRevenue), icon: FiTrendingUp,
        gradient: "from-orange-500 to-rose-500", subtitle: "vs previous",
        trend: revenueGrowthPercent,
      },
      {
        title: "Period Profit", value: formatCurrency(netProfit), icon: FiPieChart,
        gradient: "from-rose-500 to-pink-500", subtitle: "Selected range",
        trend: netProfit > 0 ? 6 : -2,
      },
      {
        title: "Pending Payments",
        value: formatCurrency(health?.metrics?.pendingPaymentValue),
        icon: FiAlertCircle, gradient: "from-pink-500 to-fuchsia-500",
        subtitle: `${health?.metrics?.pendingCustomers ?? 0} Customers`,
        trend: health?.metrics?.pendingCustomers > 5 ? 15 : -4,
      },
    ];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {moneyTiles.map((kpi, i) => (
            <StatCard key={i} {...kpi} delay={i * 0.04} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SectionCard title="Wallet Balances" subtitle="Cash, bank & digital" icon="💰">
            <div className="space-y-3">
              {[
                { label: "Cash Wallet", value: walletCash, tone: "from-emerald-500 to-teal-500" },
                { label: "Bank", value: walletBank, tone: "from-blue-500 to-indigo-500" },
                { label: "Digital", value: walletDigital, tone: "from-violet-500 to-purple-500" },
              ].map((w) => (
                <div key={w.label} className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 transition-all hover:bg-white hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full bg-gradient-to-r ${w.tone}`} />
                      <span className="text-xs font-semibold text-slate-500">{w.label}</span>
                    </div>
                    <span className="text-lg font-bold text-slate-800">{formatCurrency(w.value)}</span>
                  </div>
                </div>
              ))}
              <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-700">Total Wallets</span>
                  <span className="text-2xl font-bold tracking-tight text-indigo-900">{formatCurrency(walletTotal)}</span>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Revenue Trend" subtitle="Selected period" icon="📈" bodyClassName="p-5 pt-4">
            <RevenueChart data={revenueChartData} view={revenueView} />
          </SectionCard>
        </div>
      </div>
    );
  };

  const OperationsSection = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Pending Services", value: pendingServices, emoji: "🕒", tone: "from-rose-500 to-red-500", bg: "bg-rose-50/70 border-rose-200/70", text: "text-rose-900" },
          { label: "Completed Today", value: todayServices, emoji: "✅", tone: "from-emerald-500 to-teal-500", bg: "bg-emerald-50/70 border-emerald-200/70", text: "text-emerald-900" },
          { label: "Delayed Services", value: delayedServices, emoji: "⏳", tone: "from-orange-500 to-amber-500", bg: "bg-orange-50/70 border-orange-200/70", text: "text-orange-900" },
          { label: "In Progress", value: inProgressServices, emoji: "📋", tone: "from-blue-500 to-indigo-500", bg: "bg-blue-50/70 border-blue-200/70", text: "text-blue-900" },
        ].map((item) => (
          item.value !== undefined && (
            <div
              key={item.label}
              className={`rounded-2xl border ${item.bg} p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full bg-gradient-to-r ${item.tone}`} />
                <span className="text-xs font-semibold text-slate-600">{item.emoji} {item.label}</span>
              </div>
              <div className={`mt-1.5 text-2xl font-bold tracking-tight ${item.text}`}>{item.value}</div>
            </div>
          )
        ))}
      </div>

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
    </div>
  );

  const AlertsSection = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Action Required"
          subtitle={`${notifications.length} item${notifications.length === 1 ? "" : "s"} needing attention`}
          icon="🔔"
          bodyClassName="p-5 pt-4"
        >
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-300">
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
            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-slate-500">
                <span>Completion</span>
                <span className="font-bold text-slate-700">{closeProgress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700"
                  style={{ width: `${closeProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-300">
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
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
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
  );

  // ==========================================
  // FINAL RENDER — SPLIT WORKSPACE
  // ==========================================
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40">

      {/* ================= SIDEBAR (desktop) ================= */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-shrink-0 flex-col border-r border-slate-200/80 bg-white/80 backdrop-blur-xl lg:flex">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-lg shadow-lg shadow-indigo-200">
            📊
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold tracking-tight text-slate-900">Superadmin</div>
            <div className="truncate text-[11px] font-medium text-slate-500">Control Center</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <p className="px-3 pb-2 pt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Navigation
          </p>
          {navItems.map((item) => (
            <NavItem
              key={item.id}
              {...item}
              active={activeSection === item.id}
              onClick={handleNav}
            />
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 p-3 ring-1 ring-indigo-100">
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Network Status</div>
            <div className="mt-1 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${unclosedCount > 0 ? "bg-amber-500" : "bg-emerald-500"} animate-pulse`} />
              <span className="text-xs font-semibold text-slate-700">
                {unclosedCount > 0 ? `${unclosedCount} closing pending` : "All centres closed"}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* ================= SIDEBAR (mobile drawer) ================= */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 24, stiffness: 260 }}
              className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white lg:hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-lg shadow-lg shadow-indigo-200">
                    📊
                  </span>
                  <div>
                    <div className="text-sm font-bold tracking-tight text-slate-900">Superadmin</div>
                    <div className="text-[11px] font-medium text-slate-500">Control Center</div>
                  </div>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                {navItems.map((item) => (
                  <NavItem
                    key={item.id}
                    {...item}
                    active={activeSection === item.id}
                    onClick={handleNav}
                  />
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ================= MAIN ================= */}
      <main className="flex min-w-0 flex-1 flex-col">

        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3.5 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50 lg:hidden"
                aria-label="Open navigation"
              >
                <FiMenu className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold tracking-tight text-slate-900 lg:text-lg">
                  {sectionTitle.title}
                </h1>
                <p className="truncate text-[11px] font-medium text-slate-500">
                  {sectionTitle.subtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {loading && <FiLoader className="h-4 w-4 animate-spin text-indigo-600" />}
              {periodSelector}
            </div>
          </div>
        </header>

        {/* Section content */}
        <div className="mx-auto w-full max-w-[1400px] flex-1 p-4 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {activeSection === "overview" && <OverviewSection />}
              {activeSection === "centres" && <CentresSection />}
              {activeSection === "finance" && <FinanceSection />}
              {activeSection === "operations" && <OperationsSection />}
              {activeSection === "alerts" && <AlertsSection />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default SuperadminDashboard;