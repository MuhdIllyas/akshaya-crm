import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  BarChart, Bar, ScatterChart, Scatter, CartesianGrid, ZAxis, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, LabelList
} from 'recharts';
import { useNavigate } from "react-router-dom";
import {
  FiArrowUp, FiArrowDown, FiBarChart2, FiGlobe, FiMapPin,
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

// ==========================================
// COMPARISON WINDOW (like-for-like)
// ==========================================
// Compares the selected period so far with the same elapsed time in the previous period,
// e.g. on 10 Oct at 07:07, "This Month" is measured against 1 Sep to 10 Sep at 07:07.
// Comparing against a full earlier window would understate the current period.
const COMPARE_LABELS = {
  today: "yesterday, same time",
  week: "same days last week",
  month: "same days last month",
  "3months": "3 months earlier",
  "6months": "6 months earlier",
  year: "same days last year",
};

const getComparisonRange = (period) => {
  const { start } = getPeriodRange(period);
  const [y, m, d] = start.split("-").map(Number);
  const istMidnight = (ymd) => new Date(`${ymd}T00:00:00+05:30`);
  const ymd = (dt) => dt.toISOString().split("T")[0]; // dt is built with Date.UTC, so no timezone drift

  let prevStart;
  switch (period) {
    case "today":   prevStart = new Date(Date.UTC(y, m - 1, d - 1)); break;
    case "week":    prevStart = new Date(Date.UTC(y, m - 1, d - 7)); break;
    case "3months": prevStart = new Date(Date.UTC(y, m - 1 - 3, 1)); break;
    case "6months": prevStart = new Date(Date.UTC(y, m - 1 - 6, 1)); break;
    case "year":    prevStart = new Date(Date.UTC(y - 1, 0, 1)); break;
    case "month":
    default:        prevStart = new Date(Date.UTC(y, m - 2, 1));
  }

  const curStartMs = istMidnight(start).getTime();
  const prevStartMs = istMidnight(ymd(prevStart)).getTime();
  const elapsed = Math.max(Date.now() - curStartMs, 0);
  // never let the earlier window run into the current one (e.g. 31 Mar vs a 28-day February)
  const prevEndMs = Math.min(prevStartMs + elapsed, curStartMs - 1);

  return {
    start: new Date(prevStartMs).toISOString(),
    end: new Date(prevEndMs).toISOString(),
    label: COMPARE_LABELS[period] || COMPARE_LABELS.month,
  };
};

// % change vs the previous period. null when a percentage would mislead (no or negative baseline).
const pctChange = (current, previous) => {
  const c = Number(current), p = Number(previous);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p <= 0) return null;
  return Math.round(((c - p) / p) * 100);
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
// DESIGN PRIMITIVES
// ==========================================
const Panel = ({ title, hint, summary, action, children, className = "" }) => (
  <section className={`flex h-full flex-col rounded-xl border border-slate-200 bg-white ${className}`}>
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
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
  <div className="inline-flex max-w-full overflow-x-auto rounded-lg bg-slate-100 p-0.5" role="tablist">
    {options.map((o) => (
      <button
        key={o.value}
        role="tab"
        aria-selected={value === o.value}
        onClick={() => onChange(o.value)}
        className={`whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
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
// "vs ₹1,98,000" with the comparison basis on its own line underneath
const CompareNote = ({ value, label }) => (
  <>
    vs {value}
    <span className="block">{label}</span>
  </>
);

const Kpi = ({ label, value, delta, goodWhen = "up", compareLabel, note, context, spark, sparkColor, tone = "text-slate-900" }) => {
  const v = delta === null || delta === undefined ? NaN : Number(delta);
  const hasDelta = Number.isFinite(v);
  const isGood = goodWhen === "down" ? v < 0 : v > 0;
  const badgeTone = v === 0 ? "bg-slate-100 text-slate-600" : isGood ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700";
  const shown = Math.abs(v) > 999 ? "999%+" : `${Math.abs(v)}%`;
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        {hasDelta && (
          <span
            title={v === 0 ? `Same as ${compareLabel || "the previous period"}` : `${shown} ${v > 0 ? "higher" : "lower"} than ${compareLabel || "the previous period"}`}
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${badgeTone}`}
          >
            {v > 0 && <FiArrowUp className="h-3 w-3" aria-hidden="true" />}
            {v < 0 && <FiArrowDown className="h-3 w-3" aria-hidden="true" />}
            {shown}
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
  const data = centres
    .map((c) => ({
      id: c.id,
      name: c.name,
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
              <span className="flex min-w-0 items-start gap-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-semibold text-slate-600">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">{t.name}</span>
                  {t.centre ? (
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <FiMapPin className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                      <span className="truncate">{t.centre}</span>
                    </span>
                  ) : (
                    <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-indigo-700">
                      <FiGlobe className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                      Global
                    </span>
                  )}
                </span>
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
          <h2 className="text-[15px] font-semibold text-slate-900">Top staff</h2>
          <p className="text-xs text-gray-500">{scopeLabel}</p>
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
const TREND_COLORS = { revenue: "#4f46e5", serviceCharges: "#0891b2", profit: "#059669", expenses: "#e11d48" };
const TREND_LABELS = { revenue: "Revenue", serviceCharges: "Service charges", profit: "Profit", expenses: "Expenses" };
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
  const color = TREND_COLORS[view] || TREND_COLORS.revenue;
  const seriesName = TREND_LABELS[view] || "Revenue";
  const gid = `fill-${view}`;

  const Tip = ({ active, payload }) =>
    active && payload?.length ? (
      <div className="rounded-lg bg-slate-900 p-3 text-xs text-white shadow-xl">
        <p className="text-slate-300">{formatLabel(payload[0].payload.label)}</p>
        <p className="mt-0.5 text-base font-semibold">{fmt(payload[0].payload.value)}</p>
        <p className="text-slate-400">{seriesName}</p>
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
  const [dataPeriod, setDataPeriod] = useState("month"); // period the loaded data was fetched for

  const [closingDate, setClosingDate] = useState("");
  const [closingData, setClosingData] = useState({ date: "", rows: [] });
  const [closingLoading, setClosingLoading] = useState(true);
  const [closingError, setClosingError] = useState(false);

  // Centre filter ("all" = whole network)
  const [centreId, setCentreId] = useState(() => localStorage.getItem("superadmin_dash_centre") || "all");
  const [centreOptions, setCentreOptions] = useState([]);

  useEffect(() => {
    localStorage.setItem("superadmin_dash_centre", centreId);
  }, [centreId]);

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/wallet/centres`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setCentreOptions(list);
        // a saved centre that no longer exists falls back to the whole network
        setCentreId((prev) => (prev === "all" || list.some((c) => String(c.id) === String(prev)) ? prev : "all"));
      })
      .catch((err) => console.error("Failed to load centres", err));
  }, []);

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
        const prevRange = getComparisonRange(period);

        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/analytics/superadmin/dashboard`,
          {
            params: {
              modules: "stats,financials,leaderboards,health,alerts,customers,staff,teams,wallets,insights,comparison",
              timeframe: "custom",
              customStartDate: start,
              customEndDate: end,
              compareStart: prevRange.start,
              compareEnd: prevRange.end,
              centreId: centreId === "all" ? undefined : centreId
            },
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
          }
        );

        setDashboard(response.data);
        setDataPeriod(period);
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
  const previous = executive.comparison?.previous || null;
  const { financials = {}, wallets = {} } = finance;
  const chartData = financials.charts || {};
  const revenueChartData = chartData[revenueView] || [];
  const { customers = {}, staff = {}, teams = {} } = operations;
  const { centres = {} } = leaderboards;
  const centreList = centres.fullList || [];
  const best = centres.best || {};
  const worst = centres.worst || {};

  const {
    totalCentres, totalStaff, totalCustomers, customerGrowth,
    newCentresThisMonth, todayRevenue, todayServices, pendingServices, delayedServices,
    inProgressServices, admins, staffCount
  } = stats;

  const { revenue: monthlyRevenue, profit: netProfit } = financials.totals || {};
  const { cash: walletCash, bank: walletBank, digital: walletDigital, total: walletTotal } = wallets.summary || {};
  const { averageRating: avgRating, totalReviews } = customers.summary || {};

  const topStaffList = staff.topPerformers || [];
  const topTeamsList = teams.topTeams || [];
  const notifications = alerts;

  const closingRows = (closingData.rows || []).filter(
    (r) => centreId === "all" || String(r.centre_id) === String(centreId)
  );

  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label || "";
  const selectedCentreName = centreOptions.find((c) => String(c.id) === String(centreId))?.name || "";
  const scoped = centreId !== "all";
  const margin = financials.totals?.margin;
  const needsLook = closingRows.filter((r) => r.status !== "closed" || Number(r.cash_variance || 0) !== 0).length;

  const walletParts = [
    { label: "Cash", value: walletCash, color: "#2a78d6" },
    { label: "Bank", value: walletBank, color: "#eb6834" },
    { label: "Digital", value: walletDigital, color: "#1baf7a" },
  ];
  const walletSum = walletParts.reduce((a, p) => a + (Number(p.value) || 0), 0) || 1;

  // ==========================================
  // NETWORK HEALTH — derived from the centre health distribution
  // (defined BEFORE glance so the tile can read networkScore)
  // ==========================================
  const scopedCentres = scoped ? centreList.filter((c) => String(c.id) === String(centreId)) : centreList;
  const healthCount = (color) => scopedCentres.filter((c) => c.healthStatus?.color === color).length;
  const greenN = healthCount("green");
  const yellowN = healthCount("yellow");
  const redN = healthCount("red");
  const healthTotal = greenN + yellowN + redN;

  // Weighted: healthy 100 · watch 60 · at risk 20
  // Falls back to backend value only when there is no centre data at all.
  const computedScore = healthTotal
    ? Math.round((greenN * 100 + yellowN * 60 + redN * 20) / healthTotal)
    : null;
  const networkScore =
    computedScore !== null
      ? computedScore
      : Number.isFinite(Number(health?.overallScore))
      ? Math.round(Number(health.overallScore))
      : 0;

  const glance = [
    { label: "Centres", value: totalCentres ?? centreList.length, hint: `+${newCentresThisMonth ?? 0} this month` },
    { label: "Staff", value: totalStaff ?? 0, hint: `${admins ?? 0} admins` },
    { label: "Customers", value: totalCustomers?.toLocaleString() ?? 0, hint: `+${customerGrowth ?? 0} this month` },
    { label: "Rating", value: avgRating ? `${Number(avgRating).toFixed(1)}/5` : "—", hint: `${totalReviews ?? 0} reviews` },
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Superadmin dashboard
            {scoped && selectedCentreName && (
              <span className="ml-3 rounded-full bg-indigo-50 px-2.5 py-1 align-middle text-xs font-semibold text-indigo-700">
                {selectedCentreName}
              </span>
            )}
          </h1>
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
            value={centreId}
            onChange={(e) => setCentreId(e.target.value)}
            className="max-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            aria-label="Select centre"
          >
            <option value="all">All centres</option>
            {centreOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
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

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Revenue"
          value={formatCurrency(monthlyRevenue)}
          delta={previous ? pctChange(monthlyRevenue, previous.revenue) : null}
          compareLabel={COMPARE_LABELS[dataPeriod]}
          context={periodLabel}
          note={previous ? <CompareNote value={formatCurrency(previous.revenue)} label={COMPARE_LABELS[dataPeriod]} /> : "Total billed"}
          spark={revSpark}
          sparkColor="#4f46e5"
        />
        <Kpi
          label="Profit"
          value={formatCurrency(netProfit)}
          tone={netProfit < 0 ? "text-rose-600" : "text-slate-900"}
          delta={previous ? pctChange(netProfit, previous.profit) : null}
          compareLabel={COMPARE_LABELS[dataPeriod]}
          context={margin !== undefined ? `${margin}% margin` : "after expenses"}
          note={previous ? <CompareNote value={formatCurrency(previous.profit)} label={COMPARE_LABELS[dataPeriod]} /> : "Net of expenses"}
          spark={profitSpark}
          sparkColor="#059669"
        />
        <Kpi
          label="Today's revenue"
          value={formatCurrency(todayRevenue)}
          context={`${todayServices ?? 0} services today`}
          note="Live collection"
        />
        <Kpi
          label="Pending payments"
          value={formatCurrency(health?.metrics?.pendingPaymentValue)}
          tone={health?.metrics?.pendingPaymentValue > 0 ? "text-amber-700" : "text-slate-900"}
          context={`${health?.metrics?.pendingCustomers ?? 0} customers`}
          note="Dues on services in this period"
        />
      </div>

      {/* Trend + health + services */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <Panel
            title="Trend"
            hint={revenueView === "serviceCharges" ? `${periodLabel}. Earnings before expenses.` : periodLabel}
            action={
              <Segmented
                value={revenueView}
                onChange={setRevenueView}
                options={[
                  { value: "revenue", label: "Revenue" },
                  { value: "serviceCharges", label: "Service charges" },
                  { value: "profit", label: "Profit" },
                  { value: "expenses", label: "Expenses" },
                ]}
              />
            }
          >
            <RevenueChart data={revenueChartData} view={revenueView} />
          </Panel>
        </div>
        <div className="flex flex-col gap-4 xl:col-span-4">
          <Panel title={scoped ? "Centre health" : "Network health"} hint={scoped ? selectedCentreName : "Overall score across centres"}>
            <Gauge value={networkScore} label="out of 100" />

            {/* Stacked breakdown bar */}
            <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-slate-100">
              {greenN > 0 && <div className="bg-emerald-500" style={{ width: `${(greenN / healthTotal) * 100}%` }} />}
              {yellowN > 0 && <div className="bg-amber-500" style={{ width: `${(yellowN / healthTotal) * 100}%` }} />}
              {redN > 0 && <div className="bg-rose-500" style={{ width: `${(redN / healthTotal) * 100}%` }} />}
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-600">
              {[
                ["green", "Healthy", "bg-emerald-500", greenN],
                ["yellow", "Watch", "bg-amber-500", yellowN],
                ["red", "At risk", "bg-rose-500", redN],
              ].map(([k, l, dot, n]) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${dot}`} />
                  <span className="font-semibold tabular-nums text-slate-900">{n}</span> {l}
                </span>
              ))}
            </div>

            {/* How the score is calculated */}
            <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                How this score is calculated
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Each centre gets a health weight:{" "}
                <span className="font-medium text-emerald-700">healthy = 100</span>,{" "}
                <span className="font-medium text-amber-700">watch = 60</span>,{" "}
                <span className="font-medium text-rose-700">at risk = 20</span>. The network score is
                the average across active centres.
              </p>
              {healthTotal > 0 ? (
                <p className="mt-2 border-t border-slate-200/70 pt-2 font-mono text-[11px] text-slate-500">
                  ({greenN}×100 + {yellowN}×60 + {redN}×20) ÷ {healthTotal} ={" "}
                  <span className="font-semibold text-slate-700">{networkScore}</span>
                </p>
              ) : (
                <p className="mt-2 border-t border-slate-200/70 pt-2 text-[11px] text-slate-500">
                  No centre health data available — falling back to backend score.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>

      {/* Centres + closing log */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <Panel
            title="Profit by centre"
            hint={scoped ? `${selectedCentreName} highlighted · all centres shown for comparison` : "Ranked high to low · bar colour = centre health"}
          >
            <CentreProfitChart centres={centreList} selectedId={centreId} />
          </Panel>
        </div>
        <div className="xl:col-span-5">
          <Panel
            title="Accounting closing log"
            hint={
              closingLoading || closingError
                ? ""
                : `${closingRows.filter((r) => r.status === "closed").length} of ${closingRows.length} centres closed`
            }
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
            summary={
              !closingLoading && !closingError && closingRows.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Closed", value: closingSummary.closed, dot: "bg-emerald-500", tone: "text-emerald-700" },
                    { label: "Variance", value: closingSummary.variance, dot: "bg-rose-500", tone: "text-rose-700" },
                    { label: "Incomplete", value: closingSummary.incomplete, dot: "bg-amber-500", tone: "text-amber-700" },
                    { label: "Not closed", value: closingSummary.notClosed, dot: "bg-rose-500", tone: "text-rose-700" },
                  ].map((c) => (
                    <span
                      key={c.label}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                      <span className="font-semibold tabular-nums text-slate-900">{c.value}</span>
                      <span className="text-slate-500">{c.label}</span>
                    </span>
                  ))}
                </div>
              ) : null
            }
          >
            <div className="max-h-96 overflow-y-auto">
              {closingLoading ? (
                <div className="flex justify-center py-8">
                  <FiLoader className="h-6 w-6 animate-spin text-indigo-600" />
                </div>
              ) : closingError ? (
                <p className="rounded-lg bg-rose-50 p-4 text-center text-sm text-rose-600">
                  Could not load closing log.
                </p>
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
          </Panel>
        </div>
      </div>

      {/* People */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <StaffPerformanceChart staffData={topStaffList} scopeLabel={scoped ? "Ranked within this centre" : "Ranked across all centres"} />
        <Panel title="Top teams" hint="Grey bar is revenue, green is profit">
          <TeamBars teams={topTeamsList} />
        </Panel>
      </div>

      {/* Money, alerts, highlights */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4">
          <Panel title="Wallet position" hint={scoped ? "This centre" : "Across all centres"}>
            <p className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{formatCurrency(walletTotal)}</p>
            <div className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-full bg-slate-100">
              {walletParts
                .filter((p) => (Number(p.value) || 0) > 0)
                .map((p) => (
                  <div
                    key={p.label}
                    title={`${p.label}: ${formatCurrency(p.value)}`}
                    style={{ width: `${((Number(p.value) || 0) / walletSum) * 100}%`, minWidth: 8, background: p.color }}
                  />
                ))}
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {walletParts.map((p) => {
                const pct = ((Number(p.value) || 0) / walletSum) * 100;
                return (
                  <li key={p.label} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                      {p.label}
                    </span>
                    <span className="flex items-baseline gap-2">
                      <span className="text-[11px] tabular-nums text-slate-400">{pct > 0 && pct < 1 ? "<1" : pct.toFixed(0)}%</span>
                      <span className="tabular-nums font-medium text-slate-900">{formatCurrency(p.value)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
          <Panel
            title="Open services"
            hint={`${todayServices ?? 0} completed today`}
          >
            <StatusDonut items={serviceItems} />
          </Panel>
        </div>

        <Panel title="Action required" hint={notifications.length ? `${notifications.length} open` : ""}>
          {notifications.length > 0 ? (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`rounded-r-lg border-l-4 py-2 pl-3 pr-2 ${
                    n.priority === "critical"
                      ? "border-rose-500 bg-rose-50"
                      : n.priority === "warning"
                      ? "border-amber-500 bg-amber-50"
                      : "border-sky-500 bg-sky-50"
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
          <Panel title="Leading" hint={scoped ? "Network-wide comparison" : undefined}>
            <ul className="divide-y divide-slate-100">
              <HighlightRow label="Revenue" name={best.revenue?.name} value={best.revenue?.value ? formatCurrency(best.revenue.value) : ""} tone="text-emerald-700" />
              <HighlightRow label="Profit" name={best.profit?.name} value={best.profit?.value ? formatCurrency(best.profit.value) : ""} tone="text-emerald-700" />
              <HighlightRow label="Rating" name={best.rating?.name} value={best.rating?.value ? `${best.rating.value}/5` : ""} tone="text-amber-700" />
            </ul>
          </Panel>
          <Panel title="Needs work" hint={scoped ? "Network-wide comparison" : undefined}>
            <ul className="divide-y divide-slate-100">
              <HighlightRow label="Lowest revenue" name={worst.revenue?.name} value={worst.revenue?.value !== undefined ? formatCurrency(worst.revenue.value) : ""} tone="text-rose-700" />
              <HighlightRow label="Highest pending" name={worst.pending?.name} value={worst.pending?.value ? formatCurrency(worst.pending.value) : ""} tone="text-rose-700" />
              <HighlightRow label="Most delayed" name={worst.delayed?.name} value={worst.delayed?.value ?? ""} tone="text-amber-700" />
              <HighlightRow label="Most complaints" name={worst.complaints?.name} value={worst.complaints?.value ?? ""} tone="text-amber-700" />
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
};

export default SuperadminDashboard;