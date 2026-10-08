import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  BarChart, Bar, ScatterChart, Scatter, CartesianGrid, ZAxis, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { useNavigate } from "react-router-dom";
import {
  FiArrowUp, FiArrowDown, FiBarChart2,
  FiLoader, FiPlus, FiSend, FiUserPlus
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
    return { label: "Not closed", detail: "No closing submitted", text: "text-rose-700", dot: "bg-rose-500" };
  }
  if (row.status === "incomplete") {
    return {
      label: "Incomplete",
      detail: `Cash counted (${inr(row.actual_cash)}), closing not completed`,
      text: "text-amber-700",
      dot: "bg-amber-500",
    };
  }
  const variance = Number(row.cash_variance || 0);
  if (variance === 0) {
    return { label: "Closed", detail: `Cash ${inr(row.actual_cash)}, no variance`, text: "text-emerald-700", dot: "bg-emerald-500" };
  }
  return {
    label: "Variance",
    detail: `Cash ${inr(row.actual_cash)}, ${inr(variance)} ${variance < 0 ? "short" : "over"}`,
    text: "text-rose-700",
    dot: "bg-rose-500",
  };
};

// ==========================================
// STAFF PERFORMANCE CHART (unchanged)
// ==========================================
const StaffPerformanceChart = ({ staffData }) => {
  const [metric, setMetric] = useState('serviceCharges');

  if (!staffData || staffData.length === 0) {
    return <div className="text-gray-500 text-sm p-4">No staff data available</div>;
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  const BarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 text-white p-3 rounded-lg shadow-xl text-sm border border-gray-700 z-50">
          <p className="font-bold text-base mb-1">{data.name}</p>
          <p className="text-gray-300 text-xs mb-2">{data.centre}</p>
          <p className="text-blue-400 font-semibold">Service Charges: {formatCurrency(data.serviceCharges)}</p>
          <p className="text-purple-400 font-semibold">Services: {data.servicesCompleted}</p>
        </div>
      );
    }
    return null;
  };

  const ScatterTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 text-white p-3 rounded-lg shadow-xl text-sm border border-gray-700 z-50">
          <p className="font-bold text-base mb-1">{data.name}</p>
          <p className="text-gray-300 text-xs mb-2">{data.centre}</p>
          <p className="text-purple-400 font-semibold">Services: {data.servicesCompleted}</p>
          <p className="text-blue-400 font-semibold">Service Charges: {formatCurrency(data.serviceCharges)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-[450px] flex-col rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">Top staff by service charges</h2>
          <p className="text-xs text-gray-500">Ranked across all centres</p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button
              onClick={() => setMetric('serviceCharges')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                metric === 'serviceCharges' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Service Charges
            </button>
            <button
              onClick={() => setMetric('servicesCompleted')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                metric === 'servicesCompleted' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Applications
            </button>
            <button
              onClick={() => setMetric('scatter')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                metric === 'scatter' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Efficiency
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {metric === 'scatter' ? (
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                type="number"
                dataKey="servicesCompleted"
                name="Applications"
                tick={{ fontSize: 12 }}
                label={{ value: 'Total Applications', position: 'insideBottom', offset: -10, fontSize: 12 }}
              />
              <YAxis
                type="number"
                dataKey="serviceCharges"
                name="Service Charges"
                tickFormatter={(val) => `₹${(val/1000)}k`}
                tick={{ fontSize: 12 }}
              />
              <ZAxis type="number" dataKey="serviceCharges" range={[100, 500]} name="Volume" />
              <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter name="Staff" data={staffData} fill="#10B981" opacity={0.7} />
            </ScatterChart>
          ) : (
            <BarChart data={staffData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#4B5563' }}
                width={120}
              />
              <Tooltip content={<BarTooltip />} cursor={{ fill: '#F3F4F6' }} />
              <Bar dataKey={metric} radius={[0, 4, 4, 0]} barSize={20} animationDuration={1000}>
                {staffData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={metric === 'serviceCharges' ? '#3B82F6' : '#8B5CF6'}
                    className="hover:opacity-80 transition-opacity duration-200 cursor-pointer"
                  />
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
// REVENUE CHART COMPONENT (unchanged)
// ==========================================
const RevenueChart = ({ data, view }) => {
  if (!data || data.length === 0) {
    return <div className="flex h-[280px] items-center justify-center text-sm text-slate-500">No data for this period</div>;
  }

  const fmt = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

  const formatLabel = (label) => {
    if (!label) return '';
    if (label.length === 7) {
      return new Date(label + '-01').toLocaleString('default', { month: 'short', year: '2-digit' });
    }
    if (label.length === 10) return label.slice(5);
    return label;
  };

  const short = (v) => (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${v / 1000}k` : `₹${v}`);
  const color = view === 'profit' ? '#059669' : view === 'expenses' ? '#e11d48' : '#4f46e5';
  const gid = `fill-${view}`;

  const Tip = ({ active, payload }) =>
    active && payload?.length ? (
      <div className="rounded-lg bg-slate-900 p-3 text-xs text-white shadow-xl">
        <p className="text-slate-300">{formatLabel(payload[0].payload.label)}</p>
        <p className="mt-0.5 text-base font-semibold">{fmt(payload[0].payload.value)}</p>
      </div>
    ) : null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.95} />
            <stop offset="100%" stopColor={color} stopOpacity={0.55} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
        <XAxis dataKey="label" tickFormatter={formatLabel} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} minTickGap={16} />
        <YAxis tickFormatter={short} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={52} />
        <Tooltip content={<Tip />} cursor={{ fill: 'rgba(100,116,139,0.08)' }} />
        <Bar dataKey="value" fill={`url(#${gid})`} radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={600} />
      </BarChart>
    </ResponsiveContainer>
  );
};

// ==========================================
// DESIGN PRIMITIVES
// ==========================================
const Panel = ({ title, hint, action, children, className = "" }) => (
  <section className={`flex h-full flex-col rounded-xl border border-slate-200 bg-white ${className}`}>
    <div className="flex items-start justify-between gap-3 px-5 pt-4">
      <div>
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      {action}
    </div>
    <div className="flex-1 px-5 pb-5 pt-3">{children}</div>
  </section>
);

const Segmented = ({ options, value, onChange }) => (
  <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="tablist">
    {options.map((o) => (
      <button
        key={o.value}
        role="tab"
        aria-selected={value === o.value}
        onClick={() => onChange(o.value)}
        className={`rounded-md px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
          value === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const money = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

const Sparkline = ({ data = [], color = "#4f46e5" }) => {
  const pts = data.map(Number).filter(Number.isFinite);
  if (pts.length < 2) return null;
  const w = 104, h = 36;
  const max = Math.max(...pts), min = Math.min(...pts), span = max - min || 1;
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)]);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="flex-shrink-0">
      <polygon points={`0,${h} ${line} ${w},${h}`} fill={color} opacity="0.12" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

const Kpi = ({ label, value, delta, note, spark, sparkColor, tone = "text-slate-900" }) => {
  const v = Number(delta);
  const hasDelta = Number.isFinite(v) && v !== 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {hasDelta && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${v > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {v > 0 ? <FiArrowUp className="h-3 w-3" /> : <FiArrowDown className="h-3 w-3" />}
            {Math.abs(v)}%
          </span>
        )}
      </div>
      <p className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight ${tone}`}>{value}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-xs text-slate-500">{note}</p>
        {spark && <Sparkline data={spark} color={sparkColor} />}
      </div>
    </div>
  );
};

const Gauge = ({ value = 0, label }) => {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const arc = Math.PI * 52;
  const color = v >= 75 ? "#059669" : v >= 50 ? "#d97706" : "#e11d48";
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 140 80" className="w-44" aria-hidden="true">
        <path d="M 18 70 A 52 52 0 0 1 122 70" fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
        <path d="M 18 70 A 52 52 0 0 1 122 70" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(v / 100) * arc} ${arc}`} />
      </svg>
      <p className="-mt-9 text-3xl font-semibold tabular-nums text-slate-900">{Math.round(v)}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
};

const StatusDonut = ({ items }) => {
  const total = items.reduce((a, i) => a + (Number(i.value) || 0), 0);
  const slices = total ? items.map((i) => ({ ...i, value: Number(i.value) || 0 })) : [{ name: "none", value: 1, color: "#e2e8f0" }];
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-32 w-32 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" innerRadius={42} outerRadius={60} paddingAngle={total ? 2 : 0} stroke="none">
              {slices.map((s, k) => <Cell key={k} fill={s.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-semibold tabular-nums text-slate-900">{total}</p>
          <p className="text-[11px] text-slate-500">open</p>
        </div>
      </div>
      <ul className="flex-1 space-y-2 text-sm">
        {items.map((i) => (
          <li key={i.name} className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} />
              {i.name}
            </span>
            <span className="font-semibold tabular-nums text-slate-900">{i.value ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const HEALTH_HEX = { green: "#059669", yellow: "#d97706", red: "#e11d48" };

const CentreProfitChart = ({ centres }) => {
  const data = centres.map((c) => ({
    name: c.name,
    profit: Number(c.profit) || 0,
    rating: c.rating || 0,
    health: c.healthStatus?.label || "Unknown",
    fill: HEALTH_HEX[c.healthStatus?.color] || "#94a3b8",
  }));
  if (data.length === 0) return <p className="py-10 text-center text-sm text-slate-500">No centres yet.</p>;
  const Tip = ({ active, payload }) =>
    active && payload?.length ? (
      <div className="rounded-lg bg-slate-900 p-3 text-xs text-white shadow-xl">
        <p className="text-sm font-semibold">{payload[0].payload.name}</p>
        <p className="mt-1 text-slate-300">Profit {money(payload[0].payload.profit)}</p>
        <p className="text-slate-300">Rating {payload[0].payload.rating}, {payload[0].payload.health}</p>
      </div>
    ) : null;
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis type="number" tickFormatter={(v) => `₹${v / 1000}k`} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: "#334155" }} axisLine={false} tickLine={false} />
        <Tooltip content={<Tip />} cursor={{ fill: "rgba(100,116,139,0.08)" }} />
        <Bar dataKey="profit" radius={[0, 4, 4, 0]} barSize={18}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

const TeamBars = ({ teams }) => {
  const maxRev = Math.max(1, ...teams.map((t) => Number(t.revenue) || 0));
  if (teams.length === 0) return <p className="py-10 text-center text-sm text-slate-500">No team data.</p>;
  return (
    <ul className="space-y-4">
      {teams.map((t, i) => {
        const rev = Number(t.revenue) || 0;
        const profit = Number(t.profit) || 0;
        return (
          <li key={t.id || i}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium text-slate-900">{t.name}</span>
              <span className={`text-sm font-semibold tabular-nums ${profit < 0 ? "text-rose-600" : "text-emerald-700"}`}>{money(profit)}</span>
            </div>
            <div className="relative mt-1.5 h-2 rounded-full bg-slate-100">
              <div className="absolute inset-y-0 left-0 rounded-full bg-slate-300" style={{ width: `${(rev / maxRev) * 100}%` }} />
              <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: `${(Math.max(0, profit) / maxRev) * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-500">Revenue {money(rev)}, expenses {money(t.expenses || 0)}</p>
          </li>
        );
      })}
    </ul>
  );
};

const HighlightRow = ({ label, name, value }) => (
  <li className="flex items-baseline justify-between gap-3 py-2 text-sm">
    <span className="text-slate-500">{label}</span>
    <span className="min-w-0 truncate text-right">
      <span className="font-medium text-slate-900">{name || "N/A"}</span>
      {value !== undefined && value !== null && value !== "" && (
        <span className="ml-2 tabular-nums text-slate-500">{value}</span>
      )}
    </span>
  </li>
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
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 flex items-center justify-center min-h-[400px]">
        <svg className="animate-spin h-8 w-8 text-indigo-600 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-gray-600 font-medium">Loading Superadmin Dashboard...</span>
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

  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label || "";
  const margin = financials.totals?.margin;
  const needsLook = closingRows.filter((r) => r.status !== "closed" || Number(r.cash_variance || 0) !== 0).length;

  const walletParts = [
    { label: "Cash", value: walletCash, bar: "bg-indigo-600" },
    { label: "Bank", value: walletBank, bar: "bg-sky-600" },
    { label: "Digital", value: walletDigital, bar: "bg-indigo-500" },
  ];
  const walletSum = walletParts.reduce((a, p) => a + (Number(p.value) || 0), 0) || 1;

  const glance = [
    { label: "Centres", value: totalCentres ?? centreList.length, note: `+${newCentresThisMonth ?? 0} this month` },
    { label: "Staff", value: totalStaff ?? 0, note: `${admins ?? 0} admins` },
    { label: "Customers", value: totalCustomers?.toLocaleString() ?? 0, note: `+${customerGrowth ?? 0} this month` },
    { label: "Rating", value: avgRating ? `${Number(avgRating).toFixed(1)}/5` : "-", note: `${totalReviews ?? 0} reviews` },
    { label: "Network health", value: health?.overallScore !== undefined ? `${health.overallScore}/100` : "-" },
  ];

  const revSpark = (chartData.revenue || []).map((d) => d.value);
  const profitSpark = (chartData.profit || []).map((d) => d.value);
  const closingDay = closingData.date
    ? new Date(`${closingData.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : "";
  const healthCount = (color) => centreList.filter((c) => c.healthStatus?.color === color).length;
  const btnPrimary =
    "inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2";
  const btnGhost =
    "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600";
  const serviceItems = [
    { name: "Pending", value: pendingServices ?? 0, color: "#d97706" },
    { name: "In progress", value: inProgressServices ?? 0, color: "#2563eb" },
    { name: "Delayed", value: delayedServices ?? 0, color: "#e11d48" },
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Superadmin dashboard</h1>
          <p className={`mt-1 text-sm ${needsLook > 0 ? "text-amber-700" : "text-slate-500"}`}>
            {closingLoading
              ? "Checking registers..."
              : closingError || closingRows.length === 0
              ? periodLabel
              : needsLook === 0
              ? `${periodLabel}. All ${closingRows.length} registers closed cleanly for ${closingDay}.`
              : `${periodLabel}. ${needsLook} of ${closingRows.length} registers need a look for ${closingDay}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {loading && <FiLoader className="h-5 w-5 animate-spin text-indigo-600" />}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            aria-label="Select period"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button className={btnGhost} onClick={() => navigate("/dashboard/superadmin/messenger")}><FiSend className="h-4 w-4" /> Broadcast</button>
          <button className={btnGhost} onClick={() => navigate("/dashboard/superadmin/analytics")}><FiBarChart2 className="h-4 w-4" /> Reports</button>
          <button className={btnGhost} onClick={() => navigate("/dashboard/superadmin/centremanagement")}><FiUserPlus className="h-4 w-4" /> New admin</button>
          <button className={btnPrimary} onClick={() => navigate("/dashboard/superadmin/centremanagement")}><FiPlus className="h-4 w-4" /> New centre</button>
        </div>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {glance.filter((g) => g.label !== "Network health").map((g) => (
          <div key={g.label} className="flex items-baseline gap-1.5">
            <dt className="text-slate-500">{g.label}</dt>
            <dd className="font-semibold tabular-nums text-slate-900">{g.value}</dd>
          </div>
        ))}
      </dl>

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Revenue" value={formatCurrency(monthlyRevenue)} delta={revenueGrowthPercent} note="vs previous period" spark={revSpark} sparkColor="#4f46e5" />
        <Kpi
          label="Profit"
          value={formatCurrency(netProfit)}
          tone={netProfit < 0 ? "text-rose-600" : "text-slate-900"}
          note={margin !== undefined ? `${margin}% margin` : "after expenses"}
          spark={profitSpark}
          sparkColor="#059669"
        />
        <Kpi label="Today's revenue" value={formatCurrency(todayRevenue)} note={`${todayServices ?? 0} services today`} />
        <Kpi
          label="Pending payments"
          value={formatCurrency(health?.metrics?.pendingPaymentValue)}
          tone={health?.metrics?.pendingPaymentValue > 0 ? "text-amber-700" : "text-slate-900"}
          note={`${health?.metrics?.pendingCustomers ?? 0} customers`}
        />
      </div>

      {/* Trend + health + services */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8"><Panel
            title="Trend"
            hint={periodLabel}
            action={
              <Segmented
                value={revenueView}
                onChange={setRevenueView}
                options={[
                  { value: "revenue", label: "Revenue" },
                  { value: "profit", label: "Profit" },
                  { value: "expenses", label: "Expenses" },
                ]}
              />
            }
          >
            <RevenueChart data={revenueChartData} view={revenueView} />
          </Panel></div>
        <div className="flex flex-col gap-4 xl:col-span-4">
          <Panel title="Network health" hint="Overall score across centres">
            <Gauge value={health?.overallScore} label="out of 100" />
            <div className="mt-3 flex justify-center gap-4 text-xs text-slate-600">
              {[["green", "Healthy", "bg-emerald-500"], ["yellow", "Watch", "bg-amber-500"], ["red", "At risk", "bg-rose-500"]].map(([k, l, dot]) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${dot}`} />
                  {healthCount(k)} {l}
                </span>
              ))}
            </div>
          </Panel>
          <Panel title="Open services" hint={`${todayServices ?? 0} created today`}>
            <StatusDonut items={serviceItems} />
          </Panel>
        </div>
      </div>

      {/* Centres + closing log */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <Panel title="Profit by centre" hint="Bar colour shows centre health">
            <CentreProfitChart centres={centreList} />
          </Panel>
        </div>
        <div className="xl:col-span-5"><Panel
            title="Accounting closing log"
            hint={closingLoading || closingError ? "" : `${closingRows.filter((r) => r.status === "closed").length} of ${closingRows.length} centres closed`}
            action={
              <input
                type="date"
                value={closingDate || closingData.date || ""}
                max={todayIST()}
                onChange={(e) => setClosingDate(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                aria-label="Accounting date"
              />
            }
          >
            <div className="max-h-96 overflow-y-auto">
              {closingLoading ? (
                <div className="flex justify-center py-8"><FiLoader className="h-6 w-6 animate-spin text-indigo-600" /></div>
              ) : closingError ? (
                <p className="rounded-lg bg-rose-50 p-4 text-center text-sm text-rose-600">Could not load closing log.</p>
              ) : closingRows.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No centres found.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {closingRows.map((row) => {
                    const v = getClosingView(row);
                    return (
                      <li key={row.centre_id} className="flex items-start gap-3 py-2.5">
                        <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${v.dot}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{row.centre_name}</p>
                          <p className="text-xs text-slate-500">{v.detail}</p>
                          {row.status === "closed" && row.closed_at && (
                            <p className="text-[11px] text-slate-400">
                              {new Date(row.closed_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              {row.closed_by_name ? `, ${row.closed_by_name}` : ""}
                            </p>
                          )}
                        </div>
                        <span className={`text-xs font-medium ${v.text}`}>{v.label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Panel></div>
      </div>

      {/* People */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <StaffPerformanceChart staffData={topStaffList} />
        <Panel title="Top teams" hint="Grey bar is revenue, green is profit">
          <TeamBars teams={topTeamsList} />
        </Panel>
      </div>

      {/* Money, alerts, highlights */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Wallet position" hint="Across all centres">
            <p className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{formatCurrency(walletTotal)}</p>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100">
              {walletParts.map((p) => (
                <div key={p.label} className={p.bar} style={{ width: `${((Number(p.value) || 0) / walletSum) * 100}%` }} />
              ))}
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {walletParts.map((p) => (
                <li key={p.label} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className={`h-2 w-2 rounded-full ${p.bar}`} />
                    {p.label}
                  </span>
                  <span className="tabular-nums text-slate-900">{formatCurrency(p.value)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        <Panel title="Action required" hint={notifications.length ? `${notifications.length} open` : ""}>
            {notifications.length > 0 ? (
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`rounded-r-lg border-l-4 py-2 pl-3 pr-2 ${
                      n.priority === "critical" ? "border-rose-500 bg-rose-50" : n.priority === "warning" ? "border-amber-500 bg-amber-50" : "border-sky-500 bg-sky-50"
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-900">{n.title}</p>
                    <p className="text-xs text-slate-600">{n.message}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-center text-sm text-slate-500">Nothing needs action right now.</p>
            )}
          </Panel>
        <div className="flex flex-col gap-4">
          <Panel title="Leading">
              <ul className="divide-y divide-slate-100">
                <HighlightRow label="Revenue" name={best.revenue?.name} value={best.revenue?.value ? formatCurrency(best.revenue.value) : ""} />
                <HighlightRow label="Profit" name={best.profit?.name} value={best.profit?.value ? formatCurrency(best.profit.value) : ""} />
                <HighlightRow label="Rating" name={best.rating?.name} value={best.rating?.value ? `${best.rating.value}/5` : ""} />
              </ul>
            </Panel>
          <Panel title="Needs work">
              <ul className="divide-y divide-slate-100">
                <HighlightRow label="Lowest revenue" name={worst.revenue?.name} value={worst.revenue?.value !== undefined ? formatCurrency(worst.revenue.value) : ""} />
                <HighlightRow label="Highest pending" name={worst.pending?.name} value={worst.pending?.value ? formatCurrency(worst.pending.value) : ""} />
                <HighlightRow label="Most delayed" name={worst.delayed?.name} value={worst.delayed?.value ?? ""} />
                <HighlightRow label="Most complaints" name={worst.complaints?.name} value={worst.complaints?.value ?? ""} />
              </ul>
            </Panel>
        </div>
      </div>
    </div>
  );
};

export default SuperadminDashboard;