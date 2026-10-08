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
  FiCheckCircle, FiXCircle, FiLoader, FiActivity, FiZap, FiRadio
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

// ==========================================
// CLOSING VIEW (dark theme tones)
// ==========================================
const getClosingView = (row) => {
  if (row.status === "not_closed") {
    return {
      Icon: FiXCircle,
      label: "Not closed",
      detail: "No closing submitted",
      wrap: "bg-rose-500/[0.06] border-rose-500/25",
      chip: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",
      icon: "text-rose-400",
      glow: "shadow-[0_0_24px_-8px_rgba(244,63,94,0.5)]",
    };
  }
  if (row.status === "incomplete") {
    return {
      Icon: FiAlertCircle,
      label: "Not fully closed",
      detail: `Cash counted (${inr(row.actual_cash)}), closing not completed`,
      wrap: "bg-amber-500/[0.06] border-amber-500/25",
      chip: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
      icon: "text-amber-400",
      glow: "shadow-[0_0_24px_-8px_rgba(245,158,11,0.5)]",
    };
  }
  const variance = Number(row.cash_variance || 0);
  if (variance === 0) {
    return {
      Icon: FiCheckCircle,
      label: "Closed",
      detail: `Cash ${inr(row.actual_cash)} • no variance`,
      wrap: "bg-emerald-500/[0.06] border-emerald-500/25",
      chip: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
      icon: "text-emerald-400",
      glow: "shadow-[0_0_24px_-8px_rgba(16,185,129,0.5)]",
    };
  }
  return {
    Icon: FiAlertCircle,
    label: "Closed with variance",
    detail: `Cash ${inr(row.actual_cash)} • ${inr(variance)} ${variance < 0 ? "short" : "over"}`,
    wrap: "bg-rose-500/[0.06] border-rose-500/25",
    chip: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",
    icon: "text-rose-400",
    glow: "shadow-[0_0_24px_-8px_rgba(244,63,94,0.5)]",
  };
};

// ==========================================
// SHARED UI PRIMITIVES (dark)
// ==========================================
const Panel = ({
  title, subtitle, icon, action, children,
  className = "", bodyClassName = "", accent = "cyan",
}) => {
  const accentRing = {
    cyan: "hover:border-cyan-400/30 hover:shadow-[0_0_40px_-12px_rgba(34,211,238,0.35)]",
    violet: "hover:border-violet-400/30 hover:shadow-[0_0_40px_-12px_rgba(167,139,250,0.35)]",
    emerald: "hover:border-emerald-400/30 hover:shadow-[0_0_40px_-12px_rgba(16,185,129,0.35)]",
    rose: "hover:border-rose-400/30 hover:shadow-[0_0_40px_-12px_rgba(244,63,94,0.35)]",
    amber: "hover:border-amber-400/30 hover:shadow-[0_0_40px_-12px_rgba(245,158,11,0.35)]",
  }[accent];

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-slate-950/40 backdrop-blur-sm transition-all duration-300 ${accentRing} ${className}`}
    >
      {/* top hairline */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {(title || action) && (
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.04] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-sm">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="truncate text-[13px] font-semibold tracking-tight text-slate-100">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="truncate text-[11px] font-medium text-slate-500">{subtitle}</p>
              )}
            </div>
          </div>
          {action}
        </div>
      )}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </div>
  );
};

const TrendChip = ({ trend }) => {
  if (trend === undefined || trend === null || trend === 0) {
    return (
      <span className="inline-flex items-center rounded-md border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500">
        —
      </span>
    );
  }
  const up = trend > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${
        up
          ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/25"
          : "bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/25"
      }`}
    >
      {up ? <FiArrowUp className="h-2.5 w-2.5" /> : <FiArrowDown className="h-2.5 w-2.5" />}
      {Math.abs(trend)}%
    </span>
  );
};

// ==========================================
// NEON STAT CARD
// ==========================================
const StatCard = ({
  title, value, icon: Icon, accent = "cyan",
  subtitle, trend, onClick, delay = 0,
}) => {
  const accents = {
    cyan: { text: "text-cyan-400", from: "from-cyan-400", shadow: "shadow-[0_0_30px_-10px_rgba(34,211,238,0.6)]" },
    emerald: { text: "text-emerald-400", from: "from-emerald-400", shadow: "shadow-[0_0_30px_-10px_rgba(16,185,129,0.6)]" },
    violet: { text: "text-violet-400", from: "from-violet-400", shadow: "shadow-[0_0_30px_-10px_rgba(167,139,250,0.6)]" },
    amber: { text: "text-amber-400", from: "from-amber-400", shadow: "shadow-[0_0_30px_-10px_rgba(245,158,11,0.6)]" },
    rose: { text: "text-rose-400", from: "from-rose-400", shadow: "shadow-[0_0_30px_-10px_rgba(244,63,94,0.6)]" },
  }[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-slate-950/40 p-5 backdrop-blur-sm transition-all duration-300 hover:border-white/[0.12] ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      {/* top edge glow line */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${accents.text}`}
      />
      {/* corner glow */}
      <div
        className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${accents.from} to-transparent opacity-[0.06] blur-2xl transition-opacity duration-300 group-hover:opacity-[0.15]`}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            {title}
          </p>
          <div className="mt-2 flex items-end gap-2">
            <p className="font-mono text-2xl font-bold tabular-nums tracking-tight text-slate-50">
              {value}
            </p>
            <div className="pb-0.5">
              <TrendChip trend={trend} />
            </div>
          </div>
          {subtitle && (
            <p className="mt-1.5 truncate text-[11px] font-medium text-slate-500">{subtitle}</p>
          )}
        </div>
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] ${accents.text} transition-transform duration-300 group-hover:scale-110`}
        >
          <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
        </div>
      </div>
    </motion.div>
  );
};

// ==========================================
// STAFF PERFORMANCE CHART (dark)
// ==========================================
const StaffPerformanceChart = ({ staffData }) => {
  const [metric, setMetric] = useState('serviceCharges');

  if (!staffData || staffData.length === 0) {
    return (
      <Panel title="Top Staff Performers" subtitle="Ranked across all centres" icon="👨‍💼">
        <div className="py-10 text-center text-sm text-slate-600">No staff data available</div>
      </Panel>
    );
  }

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const DarkTooltip = ({ active, payload, variant }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    const border = variant === "cyan" ? "border-cyan-400/40" : "border-violet-400/40";
    return (
      <div className={`rounded-xl border ${border} bg-slate-950/95 p-3 text-sm shadow-2xl shadow-black/60 backdrop-blur`}>
        <p className="mb-1 text-sm font-bold text-slate-50">{data.name}</p>
        <p className="mb-2 text-[11px] text-slate-500">{data.centre}</p>
        <p className="font-mono text-xs font-semibold text-cyan-300">
          Service Charges: {formatCurrency(data.serviceCharges)}
        </p>
        <p className="font-mono text-xs font-semibold text-violet-300">
          Services: {data.servicesCompleted}
        </p>
      </div>
    );
  };

  const tabs = [
    { key: 'serviceCharges', label: 'Charges', active: 'text-cyan-300' },
    { key: 'servicesCompleted', label: 'Apps', active: 'text-violet-300' },
    { key: 'scatter', label: 'Efficiency', active: 'text-emerald-300' },
  ];

  return (
    <Panel
      title="Top Staff Performers"
      subtitle="Ranked across all centres"
      icon="👨‍💼"
      accent="cyan"
      className="flex h-[460px] flex-col"
      bodyClassName="flex flex-1 flex-col p-5 pt-4"
      action={
        <div className="flex rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setMetric(t.key)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 ${
                metric === t.key
                  ? `bg-white/[0.06] ${t.active}`
                  : 'text-slate-500 hover:text-slate-300'
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
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
              <XAxis
                type="number" dataKey="servicesCompleted" name="Applications"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#1e293b' }} tickLine={false}
                label={{ value: 'Total Applications', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#475569' }}
              />
              <YAxis
                type="number" dataKey="serviceCharges" name="Service Charges"
                tickFormatter={(val) => `₹${(val / 1000)}k`}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#1e293b' }} tickLine={false}
              />
              <ZAxis type="number" dataKey="serviceCharges" range={[100, 500]} name="Volume" />
              <Tooltip
                content={<DarkTooltip variant="cyan" />}
                cursor={{ strokeDasharray: '3 3', stroke: '#334155' }}
              />
              <Scatter name="Staff" data={staffData} fill="#22d3ee" opacity={0.85} />
            </ScatterChart>
          ) : (
            <BarChart data={staffData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <XAxis type="number" hide />
              <YAxis
                dataKey="name" type="category" axisLine={false} tickLine={false}
                tick={{ fontSize: 11, fill: '#94a3b8' }} width={110}
              />
              <Tooltip content={<DarkTooltip variant={metric === 'serviceCharges' ? 'cyan' : 'violet'} />} cursor={{ fill: 'rgba(148,163,184,0.05)' }} />
              <Bar dataKey={metric} radius={[0, 6, 6, 0]} barSize={16} animationDuration={1000}>
                {staffData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={metric === 'serviceCharges' ? 'url(#staffCyanGrad)' : 'url(#staffVioletGrad)'}
                    className="cursor-pointer transition-opacity duration-200 hover:opacity-80"
                  />
                ))}
              </Bar>
              <defs>
                <linearGradient id="staffCyanGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={1} />
                </linearGradient>
                <linearGradient id="staffVioletGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={1} />
                </linearGradient>
              </defs>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </Panel>
  );
};

// ==========================================
// REVENUE CHART (dark)
// ==========================================
const RevenueChart = ({ data, view }) => {
  if (!data || data.length === 0) {
    return <div className="p-6 text-center text-sm text-slate-600">No revenue data available</div>;
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
      const color =
        view === 'profit' ? 'text-emerald-300'
        : view === 'expenses' ? 'text-rose-300'
        : 'text-cyan-300';
      return (
        <div className="rounded-xl border border-white/10 bg-slate-950/95 p-3 text-sm shadow-2xl shadow-black/60 backdrop-blur">
          <p className="text-sm font-bold text-slate-50">{formatLabel(item.label)}</p>
          <p className={`font-mono text-xs font-semibold ${color}`}>
            Value: {formatCurrency(item.value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const getBarColor = () => {
    if (view === 'profit') return '#10b981';
    if (view === 'expenses') return '#f43f5e';
    return '#22d3ee';
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
        <XAxis
          dataKey="label" tickFormatter={formatLabel}
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={{ stroke: '#1e293b' }} tickLine={false}
        />
        <YAxis
          tickFormatter={(val) => `₹${(val / 1000)}k`}
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={{ stroke: '#1e293b' }} tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.04)' }} />
        <Bar
          dataKey="value" fill={getBarColor()} radius={[4, 4, 0, 0]}
          barSize={data.length > 6 ? 28 : Math.min(56, 76 / data.length)}
          animationDuration={800}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill="url(#revenueGradientDark)" className="transition-opacity hover:opacity-80" />
          ))}
        </Bar>
        <defs>
          <linearGradient id="revenueGradientDark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={getBarColor()} stopOpacity={1} />
            <stop offset="100%" stopColor={getBarColor()} stopOpacity={0.15} />
          </linearGradient>
        </defs>
      </BarChart>
    </ResponsiveContainer>
  );
};

// ==========================================
// MINI MAP (dark)
// ==========================================
const MapView = ({ centreList }) => (
  <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-xl border border-white/[0.06] bg-slate-950/60">
    {/* grid overlay */}
    <div
      className="absolute inset-0 opacity-[0.35]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    />
    <svg viewBox="0 0 200 200" className="relative h-full w-full">
      <path
        d="M50,50 L150,50 L180,120 L120,180 L40,160 Z"
        fill="rgba(30,41,59,0.5)"
        stroke="#334155"
        strokeWidth="1.25"
      />
      {centreList.map((centre) => {
        const status = centre.healthStatus || { color: "gray" };
        const color =
          status.color === "green" ? "#10b981"
          : status.color === "yellow" ? "#f59e0b"
          : "#f43f5e";
        const x = 40 + (centre.id * 30) % 140;
        const y = 40 + (centre.id * 20) % 120;
        return (
          <g key={centre.id}>
            <circle cx={x} cy={y} r="10" fill={color} opacity="0.15" />
            <circle cx={x} cy={y} r="5" fill={color} stroke="#020617" strokeWidth="1.5" />
          </g>
        );
      })}
    </svg>
    <div className="absolute bottom-3 left-3 rounded-md border border-white/[0.06] bg-slate-950/80 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400 backdrop-blur">
      Kerala · Network
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

  const [closingDate, setClosingDate] = useState("");
  const [closingData, setClosingData] = useState({ date: "", rows: [] });
  const [closingLoading, setClosingLoading] = useState(true);
  const [closingError, setClosingError] = useState(false);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

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
      <div className="relative min-h-screen bg-slate-950 p-4 lg:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 10%, rgba(34,211,238,0.08), transparent 40%), radial-gradient(circle at 85% 90%, rgba(167,139,250,0.08), transparent 40%)",
          }}
        />
        <div className="relative mx-auto max-w-[1500px] space-y-6">
          <div className="h-16 animate-pulse rounded-2xl border border-white/[0.06] bg-slate-900/40" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-white/[0.06] bg-slate-900/40" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="h-80 animate-pulse rounded-2xl border border-white/[0.06] bg-slate-900/40 lg:col-span-2" />
            <div className="h-80 animate-pulse rounded-2xl border border-white/[0.06] bg-slate-900/40" />
          </div>
          <div className="flex items-center justify-center gap-2 py-4 text-slate-500">
            <FiLoader className="h-4 w-4 animate-spin text-cyan-400" />
            <span className="font-mono text-xs font-medium uppercase tracking-widest">
              Initializing Command Center…
            </span>
          </div>
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

  const kpiData = [
    {
      title: "Total Centres", value: totalCentres, icon: FiHome, accent: "cyan",
      subtitle: `+${newCentresThisMonth ?? 0} this month`,
      trend: newCentresThisMonth > 0 ? 5 : -2,
      onClick: () => navigate('/dashboard/superadmin/centremanagement'),
    },
    {
      title: "Total Staff", value: totalStaff, icon: FiUsers, accent: "violet",
      subtitle: `${admins ?? 0} admins · ${staffCount ?? 0} staff`,
      trend: 0,
      onClick: () => navigate('/dashboard/superadmin/staffmanagement'),
    },
    {
      title: "Customers", value: totalCustomers?.toLocaleString(), icon: FiUserCheck, accent: "emerald",
      subtitle: `+${customerGrowth ?? 0} this month`,
      trend: customerGrowth > 0 ? 8 : -3,
    },
    {
      title: "Today's Services", value: todayServices ?? 0, icon: FiShoppingBag, accent: "cyan",
      subtitle: "All centres",
      trend: 0,
    },
    {
      title: "Today's Revenue", value: formatCurrency(todayRevenue), icon: FiDollarSign, accent: "amber",
      subtitle: "Live collection",
      trend: todayRevenue > 0 ? 12 : -5,
    },
    {
      title: "Period Revenue", value: formatCurrency(monthlyRevenue), icon: FiTrendingUp, accent: "amber",
      subtitle: "vs previous",
      trend: revenueGrowthPercent,
    },
    {
      title: "Period Profit", value: formatCurrency(netProfit), icon: FiPieChart, accent: "emerald",
      subtitle: "Selected range",
      trend: netProfit > 0 ? 6 : -2,
    },
    {
      title: "Pending Payments", value: formatCurrency(health?.metrics?.pendingPaymentValue), icon: FiAlertCircle, accent: "rose",
      subtitle: `${health?.metrics?.pendingCustomers ?? 0} customers`,
      trend: health?.metrics?.pendingCustomers > 5 ? 15 : -4,
    },
  ];

  const revenueTabs = [
    { key: 'revenue', label: 'Revenue', active: 'text-cyan-300' },
    { key: 'profit', label: 'Profit', active: 'text-emerald-300' },
    { key: 'expenses', label: 'Expenses', active: 'text-rose-300' },
  ];

  return (
    <div className="relative min-h-screen bg-slate-950">
      {/* ambient background glows */}
      <div
        className="pointer-events-none fixed inset-0 opacity-100"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 0%, rgba(34,211,238,0.07), transparent 35%), radial-gradient(circle at 88% 100%, rgba(167,139,250,0.07), transparent 35%), radial-gradient(circle at 50% 50%, rgba(15,23,42,0.4), transparent 70%)",
        }}
      />
      {/* subtle grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative">
        {/* ================= HEADER ================= */}
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-slate-950/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3.5 lg:px-8">
            <div className="flex items-center gap-3">
              <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-500/10 text-lg shadow-[0_0_24px_-8px_rgba(34,211,238,0.7)]">
                <FiRadio className="h-5 w-5 text-cyan-300" />
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400 ring-2 ring-slate-950" />
              </span>
              <div>
                <h1 className="text-base font-bold tracking-tight text-slate-50 lg:text-lg">
                  Command Center
                </h1>
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-slate-500">
                  Superadmin · Live Network
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {loading && <FiLoader className="h-4 w-4 animate-spin text-cyan-400" />}
              <div className="relative">
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="cursor-pointer appearance-none rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 pl-3.5 pr-9 font-mono text-xs font-medium uppercase tracking-wider text-slate-300 transition hover:border-cyan-400/30 focus:border-cyan-400/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  aria-label="Select period"
                >
                  {PERIOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-200">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">▾</span>
              </div>
            </div>
          </div>
        </header>

        {/* ================= CONTENT ================= */}
        <div className="mx-auto max-w-[1500px] space-y-6 p-4 lg:p-8">

          {/* ---------- KPI TILES ---------- */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpiData.map((kpi, index) => (
              <StatCard key={index} {...kpi} delay={index * 0.03} />
            ))}
          </div>

          {/* ---------- REVENUE + LEADERBOARD ---------- */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel
              title="Revenue Analytics"
              subtitle="Trend for selected period"
              icon={<FiActivity className="h-4 w-4 text-cyan-300" />}
              accent="cyan"
              className="lg:col-span-2"
              action={
                <div className="flex rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
                  {revenueTabs.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setRevenueView(t.key)}
                      className={`rounded-md px-3 py-1 text-[11px] font-semibold transition-all duration-200 ${
                        revenueView === t.key
                          ? `bg-white/[0.06] ${t.active}`
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              }
            >
              <RevenueChart data={revenueChartData} view={revenueView} />
            </Panel>

            <Panel
              title="Centre Leaderboard"
              subtitle="Top 5 by profit"
              icon="🏆"
              accent="amber"
              bodyClassName="p-3 pt-2"
            >
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">Rank</th>
                      <th className="px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">Centre</th>
                      <th className="px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">Profit</th>
                      <th className="px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {centreList.slice(0, 5).map((centre, idx) => (
                      <tr key={centre.id} className="cursor-pointer border-t border-white/[0.03] transition-colors hover:bg-white/[0.02]">
                        <td className="whitespace-nowrap px-3 py-3">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-md font-mono text-[10px] font-bold ${
                              idx === 0 ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
                              : idx === 1 ? 'bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30'
                              : idx === 2 ? 'bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30'
                              : 'bg-white/[0.03] text-slate-500 ring-1 ring-white/[0.06]'
                            }`}
                          >
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[13px] font-medium text-slate-200">{centre.name}</td>
                        <td className="px-3 py-3 font-mono text-[12px] font-semibold text-emerald-300">
                          {formatCurrency(centre.profit)}
                        </td>
                        <td className="px-3 py-3 font-mono text-[12px] text-slate-400">
                          {centre.rating || 0} <span className="text-amber-400">★</span>
                        </td>
                      </tr>
                    ))}
                    {centreList.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-600">No centres</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          {/* ---------- LIVE OPS STRIP ---------- */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: "Pending", value: pendingServices, color: "rose" },
              { label: "In Progress", value: inProgressServices, color: "cyan" },
              { label: "Delayed", value: delayedServices, color: "amber" },
              { label: "Completed", value: todayServices, color: "emerald" },
            ].map((item) => {
              if (item.value === undefined) return null;
              const tone = {
                rose: { ring: "border-rose-500/25", glow: "shadow-[0_0_36px_-16px_rgba(244,63,94,0.9)]", text: "text-rose-300", dot: "bg-rose-400" },
                cyan: { ring: "border-cyan-500/25", glow: "shadow-[0_0_36px_-16px_rgba(34,211,238,0.9)]", text: "text-cyan-300", dot: "bg-cyan-400" },
                amber: { ring: "border-amber-500/25", glow: "shadow-[0_0_36px_-16px_rgba(245,158,11,0.9)]", text: "text-amber-300", dot: "bg-amber-400" },
                emerald: { ring: "border-emerald-500/25", glow: "shadow-[0_0_36px_-16px_rgba(16,185,129,0.9)]", text: "text-emerald-300", dot: "bg-emerald-400" },
              }[item.color];
              return (
                <div
                  key={item.label}
                  className={`relative overflow-hidden rounded-2xl border bg-slate-950/40 p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 ${tone.ring} ${tone.glow}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${tone.dot}`} />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {item.label}
                    </span>
                  </div>
                  <div className={`mt-2 font-mono text-2xl font-bold tabular-nums ${tone.text}`}>
                    {item.value}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ---------- HEALTH + MAP ---------- */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel
              title="Centre Health"
              subtitle="Live status · network-wide"
              icon="🏥"
              accent="emerald"
              className="lg:col-span-2"
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {centreList.map((centre) => {
                  const status = centre.healthStatus || { label: "Unknown", icon: "❓", color: "gray" };
                  const dotColor =
                    status.color === "green" ? "bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.9)]"
                    : status.color === "yellow" ? "bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.9)]"
                    : status.color === "gray" ? "bg-slate-500"
                    : "bg-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.9)]";
                  return (
                    <div
                      key={centre.id}
                      className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.04]"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-slate-200">{centre.name}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                          <span className="text-[11px] font-medium text-slate-500">
                            {status.label}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-base font-bold text-slate-100">{centre.rating || 0}</div>
                        <div className="font-mono text-[9px] uppercase tracking-widest text-slate-600">rate</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {health?.overallScore !== undefined && (
                <div className="mt-5 border-t border-white/[0.04] pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Network Health Score
                    </span>
                    <span className="font-mono text-sm font-bold text-emerald-300">
                      {health.overallScore}<span className="text-slate-600">/100</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-[0_0_12px_rgba(34,211,238,0.7)] transition-all duration-700"
                      style={{ width: `${Math.min(100, Math.max(0, health.overallScore))}%` }}
                    />
                  </div>
                </div>
              )}
            </Panel>

            <Panel title="Network Map" subtitle="Distribution & health" icon="🗺️" accent="violet">
              <MapView centreList={centreList} />
            </Panel>
          </div>

          {/* ---------- WALLETS ---------- */}
          <Panel title="Wallet Balances" subtitle="Cash · bank · digital" icon="💰" accent="emerald">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: "Cash", value: walletCash, accent: "emerald" },
                { label: "Bank", value: walletBank, accent: "cyan" },
                { label: "Digital", value: walletDigital, accent: "violet" },
              ].map((w) => {
                const tone = {
                  emerald: { text: "text-emerald-300", dot: "bg-emerald-400" },
                  cyan: { text: "text-cyan-300", dot: "bg-cyan-400" },
                  violet: { text: "text-violet-300", dot: "bg-violet-400" },
                }[w.accent];
                return (
                  <div
                    key={w.label}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        {w.label}
                      </span>
                    </div>
                    <div className={`mt-2 font-mono text-lg font-bold tabular-nums ${tone.text}`}>
                      {formatCurrency(w.value)}
                    </div>
                  </div>
                );
              })}
              <div className="relative overflow-hidden rounded-xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/[0.08] to-violet-500/[0.06] p-4 shadow-[0_0_40px_-16px_rgba(34,211,238,0.8)]">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-300">
                    Total
                  </span>
                </div>
                <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-50">
                  {formatCurrency(walletTotal)}
                </div>
              </div>
            </div>
          </Panel>

          {/* ---------- BEST / WORST ---------- */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Panel title="Best Performers" subtitle="Top of the network" icon="🏆" accent="emerald">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-400">Best Revenue</div>
                  <div className="mt-1 truncate text-[13px] font-bold text-slate-100">{best.revenue?.name || "N/A"}</div>
                  <div className="mt-0.5 font-mono text-base font-bold text-emerald-300">
                    {formatCurrency(best.revenue?.value)}
                  </div>
                </div>
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-400">Best Profit</div>
                  <div className="mt-1 truncate text-[13px] font-bold text-slate-100">{best.profit?.name || "N/A"}</div>
                  <div className="mt-0.5 font-mono text-base font-bold text-cyan-300">
                    {formatCurrency(best.profit?.value)}
                  </div>
                </div>
                <div className="col-span-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-400">Best Rating</div>
                  <div className="mt-1 flex items-end justify-between">
                    <div className="truncate text-[13px] font-bold text-slate-100">{best.rating?.name || "N/A"}</div>
                    <div className="font-mono text-base font-bold text-amber-300">
                      {best.rating?.value || 0} <span className="text-amber-400">★</span>
                    </div>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Needs Attention" subtitle="Underperformers" icon="⚠️" accent="rose">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Lowest Profit", name: worst.revenue?.name, value: formatCurrency(worst.revenue?.value), tone: "rose" },
                  { label: "Highest Pending", name: worst.pending?.name, value: worst.pending?.value ? formatCurrency(worst.pending.value) : "N/A", tone: "rose" },
                  { label: "Most Delayed", name: worst.delayed?.name, value: worst.delayed?.value ?? "N/A", tone: "amber" },
                  { label: "Most Complaints", name: worst.complaints?.name, value: worst.complaints?.value ?? "N/A", tone: "amber" },
                ].map((item) => {
                  const tone = item.tone === "rose"
                    ? { ring: "border-rose-500/20", bg: "bg-rose-500/[0.04]", text: "text-rose-300" }
                    : { ring: "border-amber-500/20", bg: "bg-amber-500/[0.04]", text: "text-amber-300" };
                  return (
                    <div key={item.label} className={`rounded-xl border ${tone.ring} ${tone.bg} p-4`}>
                      <div className={`font-mono text-[10px] font-bold uppercase tracking-widest ${tone.text}`}>
                        {item.label}
                      </div>
                      <div className="mt-1 truncate text-[13px] font-bold text-slate-100">{item.name || "N/A"}</div>
                      <div className={`mt-0.5 font-mono text-base font-bold ${tone.text}`}>{item.value}</div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>

          {/* ---------- STAFF + TEAMS ---------- */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <StaffPerformanceChart staffData={topStaffList} />

            <Panel
              title="Top Teams"
              subtitle="Revenue · profit · expenses"
              icon="👥"
              accent="violet"
              bodyClassName="p-3 pt-2"
            >
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">Team</th>
                      <th className="px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">Revenue</th>
                      <th className="px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">Profit</th>
                      <th className="px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">Expenses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topTeamsList.map((team, idx) => (
                      <tr key={team.id || idx} className="border-t border-white/[0.03] transition-colors hover:bg-white/[0.02]">
                        <td className="whitespace-nowrap px-3 py-3.5 text-[13px] font-medium text-slate-200">{team.name}</td>
                        <td className="whitespace-nowrap px-3 py-3.5 font-mono text-[12px] text-slate-400">{formatCurrency(team.revenue)}</td>
                        <td className="whitespace-nowrap px-3 py-3.5 font-mono text-[12px] font-semibold text-emerald-300">{formatCurrency(team.profit || 0)}</td>
                        <td className="whitespace-nowrap px-3 py-3.5 font-mono text-[12px] font-medium text-rose-300">{formatCurrency(team.expenses || 0)}</td>
                      </tr>
                    ))}
                    {topTeamsList.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-600">
                          No team data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          {/* ---------- ALERTS + CLOSING ---------- */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel
              title="Action Required"
              subtitle={`${notifications.length} item${notifications.length === 1 ? "" : "s"}`}
              icon={<FiZap className="h-4 w-4 text-amber-300" />}
              accent="amber"
              bodyClassName="p-5 pt-4"
            >
              <div className="max-h-80 space-y-3 overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-700">
                {notifications.length > 0 ? (
                  notifications.map((notif) => {
                    const tone =
                      notif.priority === "critical"
                        ? { bar: "bg-rose-400", bg: "bg-rose-500/[0.05]", ring: "border-rose-500/25", dot: "bg-rose-400", glow: "shadow-[0_0_20px_-8px_rgba(244,63,94,0.7)]" }
                        : notif.priority === "warning"
                        ? { bar: "bg-amber-400", bg: "bg-amber-500/[0.05]", ring: "border-amber-500/25", dot: "bg-amber-400", glow: "shadow-[0_0_20px_-8px_rgba(245,158,11,0.7)]" }
                        : { bar: "bg-cyan-400", bg: "bg-cyan-500/[0.05]", ring: "border-cyan-500/25", dot: "bg-cyan-400", glow: "shadow-[0_0_20px_-8px_rgba(34,211,238,0.7)]" };
                    return (
                      <div
                        key={notif.id}
                        className={`relative flex items-start gap-3 overflow-hidden rounded-xl border ${tone.ring} ${tone.bg} p-4 ${tone.glow}`}
                      >
                        <span className={`absolute inset-y-0 left-0 w-0.5 ${tone.bar}`} />
                        <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 animate-pulse rounded-full ${tone.dot}`} />
                        <div className="flex-1">
                          <div className="mb-0.5 text-[13px] font-semibold text-slate-100">{notif.title}</div>
                          <div className="text-[12px] leading-relaxed text-slate-400">{notif.message}</div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center font-mono text-xs uppercase tracking-widest text-slate-600">
                    All systems nominal
                  </div>
                )}
              </div>
            </Panel>

            <Panel
              title="Closing Log"
              subtitle={
                !closingLoading && !closingError
                  ? `${closedCount} of ${closingRows.length} centres closed`
                  : "Daily close status"
              }
              icon="📒"
              accent="cyan"
              bodyClassName="p-5 pt-4"
              action={
                <input
                  type="date"
                  value={closingDate || closingData.date || ""}
                  max={todayIST()}
                  onChange={(e) => setClosingDate(e.target.value)}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 font-mono text-[11px] font-medium text-slate-300 transition focus:border-cyan-400/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  aria-label="Accounting date"
                  style={{ colorScheme: "dark" }}
                />
              }
            >
              {!closingLoading && !closingError && closingRows.length > 0 && (
                <div className="mb-4">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Completion
                    </span>
                    <span className="font-mono text-xs font-bold text-emerald-300">{closeProgress}%</span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.04]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-[0_0_12px_rgba(16,185,129,0.8)] transition-all duration-700"
                      style={{ width: `${closeProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="max-h-80 space-y-3 overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-700">
                {closingLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-16 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
                    ))}
                  </div>
                ) : closingError ? (
                  <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.05] p-4 text-center text-sm font-medium text-rose-300">
                    Could not load closing log.
                  </div>
                ) : closingRows.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center font-mono text-xs uppercase tracking-widest text-slate-600">
                    No centres found
                  </div>
                ) : (
                  closingRows.map((row) => {
                    const v = getClosingView(row);
                    return (
                      <div
                        key={row.centre_id}
                        className={`flex items-start gap-3 rounded-xl border p-3.5 transition-all duration-200 ${v.wrap} ${v.glow}`}
                      >
                        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] ${v.icon}`}>
                          <v.Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-[13px] font-semibold text-slate-100">{row.centre_name}</p>
                            <span className={`whitespace-nowrap rounded-md px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest ${v.chip}`}>
                              {v.label}
                            </span>
                          </div>
                          <p className="mt-1 font-mono text-[11px] text-slate-400">{v.detail}</p>
                          {row.status === "closed" && row.closed_at && (
                            <p className="mt-1 font-mono text-[10px] text-slate-600">
                              {new Date(row.closed_at).toLocaleString("en-IN", {
                                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                              })}
                              {row.closed_by_name ? ` · ${row.closed_by_name}` : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Panel>
          </div>

          {/* ---------- QUICK ACTIONS ---------- */}
          <Panel title="Quick Actions" subtitle="Shortcuts to common tasks" icon="⚡" accent="violet">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/dashboard/superadmin/centremanagement')}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/[0.08] px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-widest text-cyan-300 transition-all duration-200 hover:-translate-y-0.5 hover:bg-cyan-500/[0.15] hover:shadow-[0_0_30px_-8px_rgba(34,211,238,0.9)]"
              >
                ➕ Create Centre
              </button>
              <button
                onClick={() => navigate('/dashboard/superadmin/centremanagement')}
                className="inline-flex items-center gap-2 rounded-lg border border-violet-400/30 bg-violet-500/[0.08] px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-widest text-violet-300 transition-all duration-200 hover:-translate-y-0.5 hover:bg-violet-500/[0.15] hover:shadow-[0_0_30px_-8px_rgba(167,139,250,0.9)]"
              >
                👤 Create Admin
              </button>
              <button
                onClick={() => navigate('/dashboard/superadmin/messenger')}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/[0.08] px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-widest text-emerald-300 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-500/[0.15] hover:shadow-[0_0_30px_-8px_rgba(16,185,129,0.9)]"
              >
                📢 Broadcast
              </button>
              <button
                onClick={() => navigate('/dashboard/superadmin/analytics')}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/[0.08] px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-widest text-rose-300 transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-500/[0.15] hover:shadow-[0_0_30px_-8px_rgba(244,63,94,0.9)]"
              >
                📊 Global Report
              </button>
              <button
                onClick={() => navigate('/dashboard/superadmin/analytics')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-400/30 bg-slate-500/[0.08] px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-widest text-slate-300 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-500/[0.15] hover:shadow-[0_0_30px_-8px_rgba(148,163,184,0.9)]"
              >
                📤 Export Data
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};

export default SuperadminDashboard;