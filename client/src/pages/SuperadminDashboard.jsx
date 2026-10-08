import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  BarChart, Bar, ScatterChart, Scatter, CartesianGrid, ZAxis, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, LabelList
} from 'recharts';
import { useNavigate } from "react-router-dom";
import {
  FiArrowUp, FiArrowDown, FiBarChart2,
  FiLoader, FiPlus, FiSend, FiUserPlus
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

// Short currency for chart labels — 1.2Cr / 4.5L / 32k
const shortINR = (v) => {
  const n = Number(v) || 0;
  const s = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 10000000) return `${s}₹${(a / 10000000).toFixed(1)}Cr`;
  if (a >= 100000) return `${s}₹${(a / 100000).toFixed(1)}L`;
  if (a >= 1000) return `${s}₹${(a / 1000).toFixed(0)}k`;
  return `${s}₹${a}`;
};

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
const Panel = ({ title, hint, summary, action, children, className = "" }) => (
  <section className={`flex h-full flex-col rounded-xl border border-slate-200 bg-white ${className}`}>
    <div className="flex items-start justify-between gap-3 px-5 pt-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      {action}
    </div>
    {summary && <div className="px-5 pt-3">{summary}</div>}
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

// Small stat pill — for the glance strip
const MiniStat = ({ label, value, hint }) => (
  <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
    <p className="mt-0.5 text-lg font-semibold tabular-nums leading-tight tracking-tight text-slate-900">
      {value}
    </p>
    {hint && <p className="mt-0.5 truncate text-[11px] text-slate-500">{hint}</p>}
  </div>
);

// KPI — label / hero number / context / sparkline
const Kpi = ({ label, value, delta, note, context, spark, sparkColor, tone = "text-slate-900" }) => {
  const v = Number(delta);
  const hasDelta = Number.isFinite(v) && v !== 0;
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        {hasDelta && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${v > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {v > 0 ? <FiArrowUp className="h-3 w-3" /> : <FiArrowDown className="h-3 w-3" />}
            {Math.abs(v)}%
          </span>
        )}
      </div>
      <p className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight ${tone}`}>{value}</p>
      {context && <p className="mt-1 text-xs text-slate-500">{context}</p>}
      <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
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
        {items.map((i) => {
          const pct = total ? Math.round(((Number(i.value) || 0) / total) * 100) : 0;
          return (
            <li key={i.name} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} />
                {i.name}
              </span>
              <span className="flex items-baseline gap-2">
                <span className="text-[11px] text-slate-400">{pct}%</span>
                <span className="font-semibold tabular-nums text-slate-900">{i.value ?? 0}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const HEALTH_HEX = { green: "#059669", yellow: "#d97706", red: "#e11d48" };

// Centre profit chart — ranked, value-labelled
const CentreProfitChart = ({ centres, selectedId = "all" }) => {
  const data = centres .map((c) => ({ id: c.id, name: c.name,
      profit: Number(c.profit) || 0,
      rating: c.rating || 0,
      health: c.healthStatus?.label || "Unknown",
      fill: HEALTH_HEX[c.healthStatus?.color] || "#94a3b8",
    }))
    .sort((a, b) => b.profit - a.profit);

  if (data.length === 0) return <p className="py-10 text-center text-sm text-slate-500">No centres yet.</p>;

  const rankedData = data.map((d, i) => ({ ...d, rankName: `${i + 1}.  ${d.name}` }));

  const Tip = ({ active, payload }) =>
    active && payload?.length ? (
      <div className="rounded-lg bg-slate-900 p-3 text-xs text-white shadow-xl">
        <p className="text-sm font-semibold">{payload[0].payload.name}</p>
        <p className="mt-1 text-slate-300">Profit {money(payload[0].payload.profit)}</p>
        <p className="text-slate-300">Rating {payload[0].payload.rating}, {payload[0].payload.health}</p>
      </div>
    ) : null;

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 44)}>
      <BarChart data={rankedData} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis type="number" tickFormatter={shortINR} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="rankName" width={140} tick={{ fontSize: 12, fill: "#334155" }} axisLine={false} tickLine={false} />
        <Tooltip content={<Tip />} cursor={{ fill: "rgba(100,116,139,0.08)" }} />
        <Bar dataKey="profit" radius={[0, 4, 4, 0]} barSize={18}>
          <LabelList
            dataKey="profit"
            position="right"
            formatter={(v) => shortINR(v)}
            style={{ fontSize: 11, fill: "#334155", fontWeight: 600 }}
          />
          {rankedData.map((d, i) => (
            <Cell key={i} fill={d.fill} fillOpacity={selectedId === "all" || String(d.id) === String(selectedId) ? 1 : 0.25} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// Team bars — with rank + % of total
const TeamBars = ({ teams }) => {
  const totalRev = teams.reduce((a, t) => a + (Number(t.revenue) || 0), 0) || 1;
  const maxRev = Math.max(1, ...teams.map((t) => Number(t.revenue) || 0));
  if (teams.length === 0) return <p className="py-10 text-center text-sm text-slate-500">No team data.</p>;

  return (
    <ul className="space-y-4">
      {teams.map((t, i) => {
        const rev = Number(t.revenue) || 0;
        const profit = Number(t.profit) || 0;
        const pct = (rev / totalRev) * 100;
        return (
          <li key={t.id || i}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-semibold text-slate-600">
                  {i + 1}
                </span>
                <span className="truncate text-sm font-medium text-slate-900">{t.name}</span>
              </span>
              <span className={`text-sm font-semibold tabular-nums ${profit < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                {money(profit)}
              </span>
            </div>
            <div className="relative mt-1.5 h-2 rounded-full bg-slate-100">
              <div className="absolute inset-y-0 left-0 rounded-full bg-slate-300" style={{ width: `${(rev / maxRev) * 100}%` }} />
              <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: `${(Math.max(0, profit) / maxRev) * 100}%` }} />
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-3 text-xs text-slate-500">
              <span>Revenue {money(rev)}, expenses {money(t.expenses || 0)}</span>
              <span className="tabular-nums">{pct.toFixed(0)}% of total</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

const HighlightRow = ({ label, name, value, tone = "text-slate-900" }) => (
  <li className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
    <span className="text-slate-500">{label}</span>
    <span className="flex min-w-0 items-baseline gap-2">
      <span className="truncate font-medium text-slate-700">{name || "N/A"}</span>
      {value !== undefined && value !== null && value !== "" && (
        <span className={`tabular-nums font-semibold ${tone}`}>{value}</span>
      )}
    </span>
  </li>
);

// ==========================================
// STAFF PERFORMANCE CHART
// ==========================================
const StaffPerformanceChart = ({ staffData, scopeLabel = "Ranked across all centres" }) => {
  const [metric, setMetric] = useState('serviceCharges');

  if (!staffData || staffData.length === 0) {
    return <div className="text-gray-500 text-sm p-4">No staff data available</div>;
  }

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const totalCharges = staffData.reduce((a, s) => a + (Number(s.serviceCharges) || 0), 0);
  const totalServices = staffData.reduce((a, s) => a + (Number(s.servicesCompleted) || 0), 0);
  const avgCharges = staffData.length ? totalCharges / staffData.length : 0;

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
    <div className="flex h-[520px] flex-col rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-700">👨‍💼 Top Staff Performers</h2>
          <p className="text-xs text-gray-500">Ranked across all centres</p>
        </div>
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
            Apps
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

      {/* Summary stats */}
      <div className="mb-4 grid grid-cols-3 gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Service Charges</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(totalCharges)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total apps</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{totalServices}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Avg / staff</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(avgCharges)}</p>
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
                tickFormatter={(val) => `₹${(val / 1000)}k`}
                tick={{ fontSize: 12 }}
              />
              <ZAxis type="number" dataKey="serviceCharges" range={[100, 500]} name="Volume" />
              <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter name="Staff" data={staffData} fill="#10B981" opacity={0.7} />
            </ScatterChart>
          ) : (
            <BarChart data={staffData} layout="vertical" margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#4B5563' }}
                width={110}
              />
              <Tooltip content={<BarTooltip />} cursor={{ fill: '#F3F4F6' }} />
              <Bar dataKey={metric} radius={[0, 4, 4, 0]} barSize={18} animationDuration={1000}>
                <LabelList
                  dataKey={metric}
                  position="right"
                  formatter={(v) => (metric === 'serviceCharges' ? shortINR(v) : v)}
                  style={{ fontSize: 11, fill: "#334155", fontWeight: 600 }}
                />
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
// REVENUE CHART
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

  const short = (v) => shortINR(v);
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
              customEndDate: end,
              centreId: centreId === "all" ? undefined : centreId
            },
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
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
  }, [period, centreId]);

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
  const { stats = {}, health = {}, alerts = [], insights = [] } = executive;
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

  const MapView = () => {
    return (
      <div className="relative bg-gray-100 rounded-lg h-64 flex items-center justify-center">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <path d="M50,50 L150,50 L180,120 L120,180 L40,160 Z" fill="#e2e8f0" stroke="#94a3b8" />
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
        <div className="absolute bottom-2 left-2 text-xs text-gray-600">Kerala Map</div>
      </div>
    );
  };

  // Prepare data for the new StatCards
  const kpiData = [
    {
      title: "Total Centres",
      value: totalCentres,
      icon: FiHome,
      color: "bg-blue-500",
      subtitle: `+${newCentresThisMonth ?? 0} this month`,
      trend: newCentresThisMonth > 0 ? 5 : -2,
      onClick: () => navigate('/dashboard/superadmin/centremanagement')
    },
    {
      title: "Total Staff",
      value: totalStaff,
      icon: FiUsers,
      color: "bg-purple-500",
      subtitle: `${admins ?? 0} Admins, ${staffCount ?? 0} Staff`,
      trend: 0,
      onClick: () => navigate('/dashboard/superadmin/staffmanagement')
    },
    {
      title: "Customers",
      value: totalCustomers?.toLocaleString(),
      icon: FiUserCheck,
      color: "bg-green-500",
      subtitle: `+${customerGrowth ?? 0} this month`,
      trend: customerGrowth > 0 ? 8 : -3,
    },
    {
      label: "Health",
      value: `${networkScore}/100`,
      hint: healthTotal
        ? `${greenN} healthy · ${yellowN} watch · ${redN} at risk`
        : "no centre data",
    },
  ];

  const revSpark = (chartData.revenue || []).map((d) => d.value);
  const profitSpark = (chartData.profit || []).map((d) => d.value);
  const closingDay = closingData.date
    ? new Date(`${closingData.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : "";

  // Closing summary
  const closingSummary = {
    closed: closingRows.filter((r) => r.status === "closed" && Number(r.cash_variance || 0) === 0).length,
    variance: closingRows.filter((r) => r.status === "closed" && Number(r.cash_variance || 0) !== 0).length,
    incomplete: closingRows.filter((r) => r.status === "incomplete").length,
    notClosed: closingRows.filter((r) => r.status === "not_closed").length,
  };

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
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-800 tracking-tight">📊 Superadmin Dashboard</h1>
        <div className="flex items-center space-x-2">
          {loading && <FiLoader className="animate-spin h-5 w-5 text-indigo-600" />}
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

      {/* Glance strip — compact stat tiles */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {glance.map((g) => (
          <MiniStat key={g.label} {...g} />
        ))}
      </div>

      {/* Revenue Analytics + Centre Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-700">📈 Revenue Analytics</h2>
            <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setRevenueView("revenue")}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  revenueView === "revenue" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Revenue
              </button>
              <button
                onClick={() => setRevenueView("profit")}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  revenueView === "profit" ? "bg-white text-green-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Profit
              </button>
              <button
                onClick={() => setRevenueView("expenses")}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  revenueView === "expenses" ? "bg-white text-red-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Expenses
              </button>
            </div>
          </div>
          <RevenueChart data={revenueChartData} view={revenueView} />
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">🏆 Centre Leaderboard</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Centre</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {centreList.slice(0, 5).map((centre, idx) => (
                  <tr key={centre.id} className="hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx+1}`}
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-800">{centre.name}</td>
                    <td className="px-3 py-2 text-gray-600">{formatCurrency(centre.profit)}</td>
                    <td className="px-3 py-2 text-gray-600">{centre.rating || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Centre Health */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow mb-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">🏥 Centre Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {centreList.map((centre) => {
            const status = centre.healthStatus || { label: "Unknown", icon: "❓", color: "gray" };
            return (
              <div key={centre.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors">
                <div>
                  <div className="font-medium text-gray-800">{centre.name}</div>
                  <div className="text-sm mt-1">{status.icon} <span className="font-medium text-gray-700">{status.label}</span></div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-800">{centre.rating || 0}</div>
                  <div className="text-xs text-gray-500">Rating</div>
                </div>
              </div>
            );
          })}
        </div>
        {health?.overallScore !== undefined && (
          <div className="mt-4 text-sm text-gray-600 border-t pt-3 flex items-center justify-between">
            <span>Overall Network Health Score</span>
            <span className="font-bold text-lg text-gray-800 ml-2">{health.overallScore}/100</span>
          </div>
        )}
      </div>

      {/* Live Operations */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {pendingServices !== undefined && (
          <div className="bg-red-50 p-4 rounded-2xl border border-red-200 shadow-sm hover:shadow-md transition-all">
            <div className="text-sm text-red-800 font-medium">🕒 Pending Services</div>
            <div className="text-2xl font-bold text-red-900 mt-1">{pendingServices}</div>
          </div>
        )}
        {todayServices !== undefined && (
          <div className="bg-green-50 p-4 rounded-2xl border border-green-200 shadow-sm hover:shadow-md transition-all">
            <div className="text-sm text-green-800 font-medium">✅ Completed Today</div>
            <div className="text-2xl font-bold text-green-900 mt-1">{todayServices}</div>
          </div>
        )}
        {delayedServices !== undefined && (
          <div className="bg-orange-50 p-4 rounded-2xl border border-orange-200 shadow-sm hover:shadow-md transition-all">
            <div className="text-sm text-orange-800 font-medium">⏳ Delayed Services</div>
            <div className="text-2xl font-bold text-orange-900 mt-1">{delayedServices}</div>
          </div>
        )}
        {inProgressServices !== undefined && (
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200 shadow-sm hover:shadow-md transition-all">
            <div className="text-sm text-blue-800 font-medium">📋 In Progress</div>
            <div className="text-2xl font-bold text-blue-900 mt-1">{inProgressServices}</div>
          </div>
        )}
      </div>

      {/* Financial Health */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow mb-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">💰 Financial Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors">
            <div className="text-sm text-gray-600 mb-1">Cash Wallet</div>
            <div className="text-xl font-bold text-gray-800">{formatCurrency(walletCash)}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors">
            <div className="text-sm text-gray-600 mb-1">Bank</div>
            <div className="text-xl font-bold text-gray-800">{formatCurrency(walletBank)}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors">
            <div className="text-sm text-gray-600 mb-1">Digital</div>
            <div className="text-xl font-bold text-gray-800">{formatCurrency(walletDigital)}</div>
          </div>
          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 hover:bg-indigo-100 transition-colors">
            <div className="text-sm text-indigo-800 font-semibold mb-1">Total Wallets</div>
            <div className="text-2xl font-bold text-indigo-900">{formatCurrency(walletTotal)}</div>
          </div>
        </div>
      </div>

      {/* Best & Worst Centres */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">🏆 Best Performing Centres</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 p-4 rounded-xl border border-green-100">
              <div className="text-xs text-green-700 font-medium mb-1">Best Revenue</div>
              <div className="font-bold text-gray-800 truncate">{best.revenue?.name || "N/A"}</div>
              <div className="text-lg text-green-700">{formatCurrency(best.revenue?.value)}</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <div className="text-xs text-blue-700 font-medium mb-1">Best Profit</div>
              <div className="font-bold text-gray-800 truncate">{best.profit?.name || "N/A"}</div>
              <div className="text-lg text-blue-700">{formatCurrency(best.profit?.value)}</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 col-span-2">
              <div className="text-xs text-yellow-700 font-medium mb-1">Best Rating</div>
              <div className="flex justify-between items-end">
                <div className="font-bold text-gray-800">{best.rating?.name || "N/A"}</div>
                <div className="text-lg text-yellow-700 font-bold">{best.rating?.value || 0} ⭐</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">⚠️ Worst Performing Centres</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-red-50 p-4 rounded-xl border border-red-100">
              <div className="text-xs text-red-700 font-medium mb-1">Lowest Profit</div>
              <div className="font-bold text-gray-800 truncate">{worst.revenue?.name || "N/A"}</div>
              <div className="text-lg text-red-700">{formatCurrency(worst.revenue?.value)}</div>
            </div>
            <div className="bg-red-50 p-4 rounded-xl border border-red-100">
              <div className="text-xs text-red-700 font-medium mb-1">Highest Pending</div>
              <div className="font-bold text-gray-800 truncate">{worst.pending?.name || "N/A"}</div>
              <div className="text-lg text-red-700">{worst.pending?.value ? formatCurrency(worst.pending.value) : "N/A"}</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
              <div className="text-xs text-orange-700 font-medium mb-1">Most Delayed</div>
              <div className="font-bold text-gray-800 truncate">{worst.delayed?.name || "N/A"}</div>
              <div className="text-lg text-orange-700">{worst.delayed?.value ?? "N/A"}</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
              <div className="text-xs text-orange-700 font-medium mb-1">Most Complaints</div>
              <div className="font-bold text-gray-800 truncate">{worst.complaints?.name || "N/A"}</div>
              <div className="text-lg text-orange-700">{worst.complaints?.value ?? "N/A"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Staff & Teams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <StaffPerformanceChart staffData={topStaffList} />

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
          <h2 className="text-lg font-semibold text-gray-700 mb-6">👥 Top Teams</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Team</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Revenue</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Profit</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Expenses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {topTeamsList.map((team, idx) => (
                  <tr key={team.id || idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-4 whitespace-nowrap font-medium text-gray-900">{team.name}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-gray-600">{formatCurrency(team.revenue)}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-green-600 font-medium">{formatCurrency(team.profit || 0)}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-red-600">{formatCurrency(team.expenses || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Notifications & Accounting Closing Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
          <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
            <span className="mr-2">🔔</span> Action Required
          </h2>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <div key={notif.id} className={`p-4 rounded-lg flex items-start border-l-4 shadow-sm ${
                  notif.priority === "critical" ? "bg-red-50 border-red-500" :
                  notif.priority === "warning" ? "bg-yellow-50 border-yellow-500" : "bg-blue-50 border-blue-500"
                }`}>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800 text-sm mb-1">{notif.title}</div>
                    <div className="text-gray-600 text-sm">{notif.message}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-sm italic p-4 text-center bg-gray-50 rounded-lg">All caught up! No pending notifications.</div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
          <div className="flex items-start justify-between mb-4 gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-700 flex items-center">
                <span className="mr-2">📒</span> Accounting Closing Log
              </h2>
              {!closingLoading && !closingError && (
                <p className="text-xs text-gray-500 mt-1">
                  {closedCount} of {closingRows.length} centres closed
                </p>
              )}
            </div>
            <input
              type="date"
              value={closingDate || closingData.date || ""}
              max={todayIST()}
              onChange={(e) => setClosingDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-700"
              aria-label="Accounting date"
            />
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300">
            {closingLoading ? (
              <div className="flex justify-center py-8">
                <FiLoader className="animate-spin h-6 w-6 text-indigo-600" />
              </div>
            ) : closingError ? (
              <div className="text-sm text-rose-600 p-4 text-center bg-rose-50 rounded-lg">
                Could not load closing log.
              </div>
            ) : closingRows.length === 0 ? (
              <div className="text-gray-500 text-sm italic p-4 text-center bg-gray-50 rounded-lg">
                No centres found.
              </div>
            ) : (
              closingRows.map((row) => {
                const v = getClosingView(row);
                return (
                  <div key={row.centre_id} className={`p-3 rounded-lg border flex items-start space-x-3 ${v.wrap}`}>
                    <v.Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${v.text}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{row.centre_name}</p>
                        <span className={`text-xs font-medium whitespace-nowrap ${v.text}`}>{v.label}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">{v.detail}</p>
                      {row.status === "closed" && row.closed_at && (
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Closed {new Date(row.closed_at).toLocaleString("en-IN", {
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
        </div>
      </div>

      {/* Map View */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow mb-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">🗺️ Centre Network Map</h2>
        <MapView />
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">⚡ Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => navigate('/dashboard/superadmin/centremanagement')} 
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition shadow-sm"
          >
            + Create Centre
          </button>
          <button 
            onClick={() => navigate('/dashboard/superadmin/centremanagement')} 
            className="px-5 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 transition shadow-md hover:shadow-lg flex items-center"
          >
            <span className="mr-1">👤</span> Create Admin
          </button>
          <button 
            onClick={() => navigate('/dashboard/superadmin/messenger')} 
            className="px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition shadow-md hover:shadow-lg flex items-center"
          >
            <span className="mr-1">📢</span> Broadcast
          </button>
          <button 
            onClick={() => navigate('/dashboard/superadmin/analytics')} 
            className="px-5 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition shadow-md hover:shadow-lg flex items-center"
          >
            <span className="mr-1">📊</span> Global Report
          </button>
          <button 
            onClick={() => navigate('/dashboard/superadmin/analytics')} 
            className="px-5 py-2.5 bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-900 transition shadow-md hover:shadow-lg flex items-center"
          >
            <span className="mr-1">📤</span> Export Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuperadminDashboard;