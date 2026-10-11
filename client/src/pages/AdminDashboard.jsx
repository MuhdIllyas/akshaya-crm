// src/pages/AdminDashboard.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from "recharts";
import {
  FiArrowUp, FiArrowDown, FiRefreshCw, FiLoader, FiChevronRight
} from "react-icons/fi";

// ==========================================
// SHARED PRIMITIVES (same look as the superadmin dashboard)
// ==========================================
const money = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

const shortINR = (v) => {
  const n = Number(v) || 0;
  const s = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 10000000) return `${s}₹${(a / 10000000).toFixed(1)}Cr`;
  if (a >= 100000) return `${s}₹${(a / 100000).toFixed(1)}L`;
  if (a >= 1000) return `${s}₹${(a / 1000).toFixed(0)}k`;
  return `${s}₹${a}`;
};

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

const MiniStat = ({ label, value, hint }) => (
  <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
    <p className="mt-0.5 text-lg font-semibold tabular-nums leading-tight tracking-tight text-slate-900">
      {value}
    </p>
    {hint && <p className="mt-0.5 truncate text-[11px] text-slate-500">{hint}</p>}
  </div>
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

const StatusDonut = ({ items, label = "open" }) => {
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
          <p className="text-[11px] text-slate-500">{label}</p>
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

const TargetBar = ({ value, max, tone }) => (
  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
    <div className={`h-full rounded-full ${tone}`} style={{ width: `${max > 0 ? Math.min((value / max) * 100, 100) : 0}%` }} />
  </div>
);

const StaffTargets = ({ targets, scoped }) => {
  const [filter, setFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const staff = targets?.staff || [];
  const sum = targets?.summary || {};
  if (staff.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No staff targets are set for this month yet.</p>;
  }
  const rows = [...staff]
    .filter((x) => (filter === "met" ? x.todayMet : filter === "notyet" ? !x.todayMet : true))
    .sort((a, b) => b.progress - a.progress || a.name.localeCompare(b.name));
  const visible = showAll ? rows : rows.slice(0, 8);
  const monthPct = sum.totalTarget > 0 ? Math.round((sum.totalAchieved / sum.totalTarget) * 100) : 0;

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Met today's target</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
            {sum.metToday} <span className="text-sm font-normal text-slate-500">of {sum.staffCount} staff</span>
          </p>
          <p className="text-xs text-slate-500">{money(sum.todayAchieved)} of {money(sum.todayTarget)} today</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">On pace this month</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
            {sum.onPace} <span className="text-sm font-normal text-slate-500">of {sum.staffCount} staff</span>
          </p>
          <p className="text-xs text-slate-500">{sum.reached} already reached the full target</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Month so far</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
            {monthPct}% <span className="text-sm font-normal text-slate-500">of target</span>
          </p>
          <p className="text-xs text-slate-500">{money(sum.totalAchieved)} of {money(sum.totalTarget)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">Day {targets.dayOfMonth} of {targets.daysInMonth}. Daily target is the monthly target divided by days in the month</p>
        <Segmented
          value={filter}
          onChange={(v) => { setFilter(v); setShowAll(false); }}
          options={[{ value: "all", label: "All" }, { value: "met", label: "Met today" }, { value: "notyet", label: "Not yet" }]}
        />
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">No staff in this view.</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100">
          {visible.map((x) => {
            const monthTone = x.progress >= 100 ? "bg-emerald-500" : x.onPace ? "bg-indigo-500" : "bg-amber-500";
            return (
              <li key={x.id} className="grid grid-cols-1 gap-x-6 gap-y-2 py-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.3fr)_4.5rem] md:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{x.name}</p>
                  {!scoped && <p className="truncate text-xs text-slate-500">{x.centre || "No centre"}</p>}
                </div>
                <div>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="text-slate-500">Today</span>
                    <span className={`tabular-nums ${x.todayMet ? "font-semibold text-emerald-700" : "text-slate-700"}`}>
                      {x.todayMet ? "Met · " : ""}{money(x.today)} / {money(x.dailyTarget)}
                    </span>
                  </div>
                  <TargetBar value={x.today} max={x.dailyTarget} tone={x.todayMet ? "bg-emerald-500" : "bg-indigo-500"} />
                </div>
                <div>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="text-slate-500">
                      Month <span className={x.progress >= 100 ? "text-emerald-700" : x.onPace ? "text-slate-500" : "text-amber-700"}>
                        {x.progress >= 100 ? "· reached" : x.onPace ? "· on pace" : "· behind pace"}
                      </span>
                    </span>
                    <span className="tabular-nums text-slate-700">
                      {money(x.achieved)} / {money(x.target)} <span className="font-semibold text-slate-900">{Math.round(x.progress)}%</span>
                    </span>
                  </div>
                  <TargetBar value={x.achieved} max={x.target} tone={monthTone} />
                </div>
                <div className="text-xs text-slate-500 md:text-right" title="Past days this month on which the daily target was met">
                  <span className="font-semibold tabular-nums text-slate-900">{x.daysMet}</span>/{x.completeDays} days
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > 8 && (
        <button type="button" onClick={() => setShowAll((v) => !v)}
          className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">
          {showAll ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
};

const TREND_COLORS = { revenue: "#4f46e5", serviceCharges: "#0891b2", profit: "#059669", expenses: "#e11d48" };
const TREND_LABELS = { revenue: "Revenue", serviceCharges: "Service charges", profit: "Profit", expenses: "Expenses" };

const RevenueChart = ({ data, view, height = 280 }) => {
  if (!data || data.length === 0) {
    return <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">No data for this period</div>;
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
    <ResponsiveContainer width="100%" height={height}>
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
// ADMIN-ONLY PIECES
// ==========================================
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// One row in the "Needs attention" strip: coloured dot, count/label, optional click-through
const AttentionTile = ({ tone, title, detail, onClick }) => {
  const dot = { ok: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-rose-500", idle: "bg-slate-300" }[tone] || "bg-slate-300";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left ${
        onClick ? "transition-colors hover:border-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600" : ""
      }`}
    >
      <span className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{detail}</span>
      </span>
      {onClick && <FiChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-slate-300" aria-hidden="true" />}
    </Tag>
  );
};

// Top staff this month, ranked by service charges
const TopStaffBars = ({ staff }) => {
  const rows = [...(staff || [])]
    .map((s) => ({
      name: s.staff_name || s.name,
      services: Number(s.service_count) || 0,
      charges: Number(s.total_revenue) || 0,
    }))
    .sort((a, b) => b.charges - a.charges)
    .slice(0, 5);
  if (rows.length === 0 || rows.every((r) => r.charges === 0)) {
    return <p className="py-10 text-center text-sm text-slate-500">No services completed this month yet.</p>;
  }
  const max = Math.max(1, ...rows.map((r) => r.charges));
  return (
    <ul className="space-y-4">
      {rows.map((r, i) => (
        <li key={`${r.name}-${i}`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-semibold text-slate-600">{i + 1}</span>
              <span className="truncate text-sm font-medium text-slate-900">{r.name}</span>
            </span>
            <span className="text-sm font-semibold tabular-nums text-slate-900">{money(r.charges)}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-cyan-600" style={{ width: `${(r.charges / max) * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{r.services} {r.services === 1 ? "service" : "services"}</p>
        </li>
      ))}
    </ul>
  );
};

// Attendance, last 7 days: present vs late
const AttendanceBars = ({ data }) => {
  const rows = (data || []).map((d) => ({ day: d.day, present: Number(d.present) || 0, late: Number(d.late) || 0 }));
  if (rows.length === 0) return <p className="py-10 text-center text-sm text-slate-500">No attendance recorded in the last 7 days.</p>;
  return (
    <>
      <div className="mb-2 flex gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#1baf7a" }} />Present</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#eb6834" }} />Late</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={rows} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "rgba(100,116,139,0.08)" }} />
          <Bar dataKey="present" name="Present" fill="#1baf7a" radius={[3, 3, 0, 0]} maxBarSize={22} />
          <Bar dataKey="late" name="Late" fill="#eb6834" radius={[3, 3, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
};

const TransactionList = ({ rows }) => {
  if (!rows || rows.length === 0) return <p className="py-6 text-center text-sm text-slate-500">No recent wallet transactions.</p>;
  return (
    <ul className="grid grid-cols-1 gap-x-8 xl:grid-cols-2">
      {rows.map((t, i) => {
        const credit = t.transactionType === "credit";
        return (
          <li key={i} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-b-0">
            <span className="flex min-w-0 items-center gap-3">
              <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${credit ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                {credit ? <FiArrowDown className="h-3.5 w-3.5" aria-hidden="true" /> : <FiArrowUp className="h-3.5 w-3.5" aria-hidden="true" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-900">{t.category || "Transaction"}</span>
                <span className="block truncate text-xs text-slate-500">{t.localTime || ""}{t.localTime && t.walletName ? " · " : ""}{t.walletName || ""}</span>
              </span>
            </span>
            <span className={`whitespace-nowrap text-sm font-semibold tabular-nums ${credit ? "text-emerald-700" : "text-rose-700"}`}>
              {credit ? "+" : "-"}{money(Math.abs(Number(t.amount) || 0))}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

// ==========================================
// MAIN DASHBOARD
// ==========================================
const WALLET_COLORS = { cash: "#2a78d6", bank: "#eb6834", digital: "#1baf7a" };

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [trendView, setTrendView] = useState("revenue");
  const isMounted = useRef(true);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/analytics/admin/dashboard`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      const json = await res.json();
      if (!isMounted.current) return;
      setData(json);
      setUpdatedAt(new Date());
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      if (isMounted.current) toast.error("Failed to load dashboard data");
    } finally {
      if (isMounted.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    load();
    return () => { isMounted.current = false; };
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center">
        <FiLoader className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-slate-600">Could not load the dashboard.</p>
        <button onClick={() => load(true)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Try again
        </button>
      </div>
    );
  }

  const stats = data.stats || {};
  const charts = data.charts || {};
  const lists = data.lists || {};
  const closing = data.alerts?.yesterdayClosing ?? null;
  const reviews = data.customerSatisfaction || { rating: "0.0", count: 0 };
  const targets = data.targets || null;

  // ---- Monthly trend (current year, Jan up to this month) ----
  const year = new Date().getFullYear();
  const upTo = new Date().getMonth() + 1;
  const ft = charts.financialTrend || {};
  const seriesKey = { revenue: "revenueCollected", serviceCharges: "grossProfit", profit: "netProfit", expenses: "operatingExpenses" };
  const trendData = MONTHS.slice(0, upTo).map((_, i) => ({
    label: `${year}-${String(i + 1).padStart(2, "0")}`,
    value: Number((ft[seriesKey[trendView]] || [])[i]) || 0,
  }));

  // ---- Wallet split ----
  const walletParts = [
    { label: "Cash", value: stats.cashInHand, color: WALLET_COLORS.cash },
    { label: "Bank", value: stats.bankBalance, color: WALLET_COLORS.bank },
    { label: "Digital", value: stats.digitalBalance, color: WALLET_COLORS.digital },
  ];
  const walletSum = walletParts.reduce((a, p) => a + (Number(p.value) || 0), 0) || 1;

  // ---- Open services (excludes the lifetime "completed" count) ----
  const ss = charts.serviceStatus || {};
  const openItems = [
    { name: "Pending", value: Number(ss.pending) || 0, color: "#eda100" },
    { name: "In progress", value: Number(ss.in_progress) || 0, color: "#2a78d6" },
    { name: "Delayed", value: Number(ss.delayed) || 0, color: "#e11d48" },
  ];

  // ---- Yesterday's register ----
  const hasClosing = closing && closing.cash_variance !== undefined && closing.cash_variance !== null;
  const variance = hasClosing ? Number(closing.cash_variance) : 0;
  const closingTile = !hasClosing
    ? { tone: "bad", title: "Yesterday's register not closed", detail: "Verify cash balances and close the day" }
    : variance === 0
    ? { tone: "ok", title: "Yesterday's register closed", detail: "Cash matched the ledger exactly" }
    : { tone: "bad", title: "Cash variance yesterday", detail: `${money(Math.abs(variance))} ${variance < 0 ? "short" : "over"}. Check the accounting logs` };

  const present = Number(stats.presentToday) || 0;
  const staffTotal = Number(stats.totalStaff) || 0;
  const netProfit = Number(stats.todayNetProfit) || 0;
  const to = (path) => () => navigate(path);

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Your centre today
            {updatedAt && <span> · updated {updatedAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:opacity-60"
        >
          <FiRefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* Needs attention */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AttentionTile {...closingTile} onClick={to("/dashboard/admin/reports")} />
        <AttentionTile
          tone={stats.pendingLeaves > 0 ? "warn" : "ok"}
          title={stats.pendingLeaves > 0 ? `${stats.pendingLeaves} leave ${stats.pendingLeaves === 1 ? "request" : "requests"} waiting` : "No leave requests waiting"}
          detail={stats.pendingLeaves > 0 ? "Needs your approval" : "All caught up"}
          onClick={to("/dashboard/admin/attendancemanagement?tab=leave")}
        />
        <AttentionTile
          tone={stats.salaryPending > 0 ? "warn" : "ok"}
          title={stats.salaryPending > 0 ? `${stats.salaryPending} ${stats.salaryPending === 1 ? "salary" : "salaries"} pending` : "Salaries up to date"}
          detail={stats.salaryPending > 0 ? "For this month" : "Nothing pending this month"}
          onClick={to("/dashboard/admin/attendancemanagement?tab=salary")}
        />
        <AttentionTile
          tone={stats.pendingPayments > 0 ? "warn" : "ok"}
          title={stats.pendingPayments > 0 ? `${money(stats.pendingPaymentsTotal)} to collect` : "No payments due"}
          detail={stats.pendingPayments > 0 ? `${stats.pendingPayments} ${stats.pendingPayments === 1 ? "service" : "services"} not fully paid` : "Everything collected"}
          onClick={to("/dashboard/admin/reports?tab=pendingPayments")}
        />
      </div>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Service charges today"
          value={money(stats.todayGrossProfit)}
          note={`Billed ${money(stats.todayRevenueCollected)}`}
        />
        <Kpi
          label="Net profit today"
          value={money(netProfit)}
          tone={netProfit < 0 ? "text-rose-600" : "text-slate-900"}
          note={`After ${money(stats.todayOperatingExpenses)} expenses`}
        />
        <Kpi
          label="Cash in hand"
          value={money(stats.cashInHand)}
          note={`All wallets ${money(stats.totalWalletBalance)}`}
        />
        <Kpi
          label="Present today"
          value={`${present} of ${staffTotal}`}
          context={`${stats.attendanceRate ?? 0}% attendance`}
          note="Active staff"
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MiniStat label="Open services" value={openItems.reduce((a, i) => a + i.value, 0)} hint="Pending, in progress, delayed" />
        <MiniStat label="Avg order today" value={money(stats.averageOrderValue)} hint="Per completed service" />
        <MiniStat label="Customer rating" value={`${reviews.rating} / 5`} hint={`${reviews.count} ${Number(reviews.count) === 1 ? "review" : "reviews"} this month`} />
        <MiniStat label="Services completed" value={stats.servicesCompleted ?? 0} hint="All time, this centre" />
      </div>

      {/* Trend + wallet */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <Panel
            title="Trend"
            hint={`${year}, month by month`}
            action={
              <Segmented
                value={trendView}
                onChange={setTrendView}
                options={[
                  { value: "revenue", label: "Revenue" },
                  { value: "serviceCharges", label: "Service charges" },
                  { value: "profit", label: "Profit" },
                  { value: "expenses", label: "Expenses" },
                ]}
              />
            }
          >
            <RevenueChart data={trendData} view={trendView} height={340} />
          </Panel>
        </div>
        <div className="flex flex-col gap-4 xl:col-span-4">
          <Panel title="Wallet position" hint="This centre">
            <p className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{money(stats.totalWalletBalance)}</p>
            <div className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-full bg-slate-100">
              {walletParts.filter((p) => (Number(p.value) || 0) > 0).map((p) => (
                <div key={p.label} title={`${p.label}: ${money(p.value)}`} style={{ width: `${((Number(p.value) || 0) / walletSum) * 100}%`, minWidth: 8, background: p.color }} />
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
                      <span className="font-medium tabular-nums text-slate-900">{money(p.value)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
          <Panel title="Open services" hint="Waiting to be finished">
            <StatusDonut items={openItems} label="open" />
          </Panel>
        </div>
      </div>

      {/* Staff targets */}
      <div className="mt-4">
        <Panel title="Staff targets" hint="Today's daily target and this month's target">
          <StaffTargets targets={targets} scoped />
        </Panel>
      </div>

      {/* People */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Top staff" hint="This month, ranked by service charges">
          <TopStaffBars staff={lists.topStaff} />
        </Panel>
        <Panel title="Attendance" hint="Last 7 days">
          <AttendanceBars data={charts.attendanceTrend} />
        </Panel>
      </div>

      {/* Money movement */}
      <div className="mt-4">
        <Panel
          title="Recent wallet transactions"
          hint="Latest 10 movements"
          action={
            <button type="button" onClick={to("/dashboard/admin/wallets")} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">
              Open wallets
            </button>
          }
        >
          <TransactionList rows={lists.recentTransactions} />
        </Panel>
      </div>
    </div>
  );
};

export default AdminDashboard;