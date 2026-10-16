// StaffTeamDashboard.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";
import {
  FiGlobe, FiUsers, FiRefreshCw, FiLoader, FiChevronRight, FiArrowUp, FiArrowDown, FiBell, FiAward, FiGift
} from "react-icons/fi";

// ==========================================
// SHARED PRIMITIVES (same look as the dashboards)
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

const Kpi = ({ label, value, delta, goodWhen = "up", compareLabel, note, context, spark, sparkColor, bar, tone = "text-slate-900" }) => {
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
      {bar && <div className="mt-3">{bar}</div>}
      <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
        <p className="text-xs text-slate-500">{note}</p>
        {spark && <Sparkline data={spark} color={sparkColor} />}
      </div>
    </div>
  );
};

const TargetBar = ({ value, max, tone }) => (
  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
    <div className={`h-full rounded-full ${tone}`} style={{ width: `${max > 0 ? Math.min((value / max) * 100, 100) : 0}%` }} />
  </div>
);

// Photos can be a full URL, a data URL, or a path on the API server (like on the staff dashboard)
const photoSrc = (raw) => {
  if (!raw || raw === "null" || raw === "undefined") return null;
  if (/^(https?:|data:image|blob:)/i.test(raw)) return raw;
  const base = import.meta.env.VITE_API_URL || "";
  return `${base}${raw.startsWith("/") ? "" : "/"}${raw}`;
};

const Avatar = ({ name, photo, size = 36 }) => {
  const [failed, setFailed] = useState(false);
  const src = photoSrc(photo);
  const initials = (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const dim = { width: size, height: size };
  return src && !failed ? (
    <img src={src} alt="" onError={() => setFailed(true)} style={dim} className="flex-shrink-0 rounded-full border border-slate-200 object-cover" />
  ) : (
    <span style={dim} className="flex flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700" aria-hidden="true">{initials}</span>
  );
};

const TREND_COLORS = { revenue: "#4f46e5", serviceCharges: "#059669", profit: "#059669", expenses: "#e11d48" };
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

const MIX_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];
const MIX_OTHER = "#94a3b8";

const MixDonut = ({ rows, totalLabel, emptyText }) => {
  const [open, setOpen] = useState(null);
  const clean = (rows || [])
    .map((r) => ({ name: r.category || "Uncategorised", amount: Number(r.amount) || 0, subs: r.subcategories || [] }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  if (clean.length === 0) return <p className="py-10 text-center text-sm text-slate-500">{emptyText}</p>;
  const total = clean.reduce((a, r) => a + r.amount, 0);
  const rest = clean.slice(6).reduce((a, r) => a + r.amount, 0);
  const list = [
    ...clean.slice(0, 6).map((r, i) => ({ ...r, color: MIX_COLORS[i] })),
    ...(rest > 0 ? [{ name: `Other (${clean.length - 6})`, amount: rest, subs: [], color: MIX_OTHER }] : []),
  ];
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative h-40 w-40 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={list} dataKey="amount" nameKey="name" innerRadius="64%" outerRadius="100%" paddingAngle={list.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>
              {list.map((r) => <Cell key={r.name} fill={r.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-semibold tabular-nums text-slate-900">{money(total)}</span>
          <span className="text-[11px] text-slate-500">{totalLabel}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1">
        {list.map((r) => {
          const expandable = r.subs.length > 0 && !(r.subs.length === 1 && r.subs[0].name === "No subcategory");
          const isOpen = open === r.name;
          const Row = expandable ? "button" : "div";
          return (
            <li key={r.name}>
              <Row
                {...(expandable ? { type: "button", onClick: () => setOpen(isOpen ? null : r.name), "aria-expanded": isOpen } : {})}
                className={`flex w-full items-center gap-2 rounded px-1 py-1 text-left text-sm ${expandable ? "hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600" : ""}`}
              >
                <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
                  {expandable && <FiChevronRight className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />}
                </span>
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ backgroundColor: r.color }} />
                <span className="min-w-0 flex-1 truncate text-slate-800" title={r.name}>{r.name}</span>
                <span className="whitespace-nowrap font-medium tabular-nums text-slate-900">{money(r.amount)}</span>
                <span className="w-9 text-right text-xs tabular-nums text-slate-500">{Math.round((r.amount / total) * 100)}%</span>
              </Row>
              {isOpen && (
                <ul className="mb-1 ml-[34px] space-y-1 border-l-2 border-slate-100 pl-3">
                  {r.subs.map((sub) => (
                    <li key={sub.name} className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="truncate text-slate-600" title={sub.name}>{sub.name}</span>
                      <span className="whitespace-nowrap tabular-nums text-slate-700">
                        {money(sub.amount)} <span className="text-slate-400">{Math.round((sub.amount / r.amount) * 100)}% · {sub.services}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const MiniTargetBar = ({ achieved, target, onPace }) => {
  if (!target) return <span className="text-xs text-slate-400">No target set</span>;
  const raw = (achieved / target) * 100;
  const tone = raw >= 100 ? "bg-emerald-500" : onPace ? "bg-blue-500" : "bg-amber-500";
  return (
    <div className="min-w-[150px]">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="tabular-nums text-slate-700">{money(achieved)} / {money(target)}</span>
        <span className="font-semibold tabular-nums text-slate-900">{Math.round(raw)}%</span>
      </div>
      <TargetBar value={achieved} max={target} tone={tone} />
    </div>
  );
};

// ---- Period filter (same options and IST day boundaries as the dashboards) ----
const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "3months", label: "Last 3 Months" },
  { value: "6months", label: "Last 6 Months" },
  { value: "year", label: "This Year" },
];

const getDatesFromPeriod = (period) => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [y, m, d] = today.split("-").map(Number);
  let start;
  switch (period) {
    case "today": start = new Date(Date.UTC(y, m - 1, d)); break;
    case "week": {
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      start = new Date(Date.UTC(y, m - 1, d - (dow === 0 ? 6 : dow - 1)));
      break;
    }
    case "3months": start = new Date(Date.UTC(y, m - 3, 1)); break;
    case "6months": start = new Date(Date.UTC(y, m - 6, 1)); break;
    case "year": start = new Date(Date.UTC(y, 0, 1)); break;
    case "month":
    default: start = new Date(Date.UTC(y, m - 1, 1));
  }
  return { from: start.toISOString().split("T")[0], to: today };
};


// ==========================================
// STAFF TEAM DASHBOARD
// ==========================================
const API_BASE = import.meta.env.VITE_API_URL || "";

// Token claims (base64url safe)
const getMyId = () => {
  try {
    const token = localStorage.getItem("token");
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(part)).id ?? null;
  } catch {
    return null;
  }
};

const api = async (path, signal) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
};

// Optional pieces: a failure leaves that panel empty instead of breaking the page
const tryApi = (path, signal) =>
  api(path, signal).catch((err) => {
    if (err.name === "AbortError") throw err;
    return null;
  });

const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

// Birthdays arrive as "MM-DD" (no birth year is sent to staff)
const istTodayUtc = () => {
  const [y, m, d] = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

const nextBirthday = (mmdd, base) => {
  const [m, d] = String(mmdd).split("-").map(Number);
  if (!m || !d) return null;
  const y0 = new Date(base).getUTCFullYear();
  for (const y of [y0, y0 + 1]) {
    let t = Date.UTC(y, m - 1, d);
    // 29 Feb falls on 1 Mar in years without one
    if (m === 2 && d === 29 && new Date(t).getUTCMonth() !== 1) t = Date.UTC(y, 2, 1);
    if (t >= base) return t;
  }
  return null;
};

const paceTone = (progress, onPace) => (progress >= 100 ? "bg-emerald-500" : onPace ? "bg-blue-500" : "bg-amber-500");
const paceText = (progress, onPace) => (progress >= 100 ? "reached" : onPace ? "on pace" : "behind pace");
const paceTextTone = (progress, onPace) => (progress >= 100 ? "text-emerald-700" : onPace ? "text-slate-500" : "text-amber-700");

const Tile = ({ label, value, hint, tone = "text-slate-900" }) => (
  <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
    <p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
    {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
  </div>
);

const AvatarStack = ({ people, max = 6 }) => (
  <div className="flex items-center">
    {people.slice(0, max).map((p, i) => (
      <span key={p.id ?? i} className={`rounded-full ring-2 ring-white ${i > 0 ? "-ml-1" : ""}`}>
        <Avatar name={p.name} photo={p.photo} size={32} />
      </span>
    ))}
    {people.length > max && (
      <span className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 ring-2 ring-white">
        +{people.length - max}
      </span>
    )}
  </div>
);

const StaffTeamDashboard = () => {
  const myId = useMemo(getMyId, []);

  const [period, setPeriod] = useState("month");
  const [reloadKey, setReloadKey] = useState(0);

  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState(false);
  const [myTeams, setMyTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);

  // Period-bound data
  const [periodLoading, setPeriodLoading] = useState(false);
  const [periodError, setPeriodError] = useState(false);
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [mix, setMix] = useState([]);
  const [targets, setTargets] = useState(null);

  // Team-bound data
  const [trend, setTrend] = useState([]);
  const [settings, setSettings] = useState(null);
  const [announcements, setAnnouncements] = useState([]);

  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label || "This Month";
  const trendYear = new Date().getFullYear();

  // 1. The teams I belong to
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const list = await api("/api/teams", ctrl.signal);
        if (Array.isArray(list) && list.length > 0) {
          setMyTeams(list);
          setSelectedTeamId(Number((list.find((t) => t.is_primary) || list[0]).id));
        }
      } catch (err) {
        if (err.name !== "AbortError") setTeamsError(true);
      } finally {
        if (!ctrl.signal.aborted) setTeamsLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, []);

  const switchTeam = (id) => {
    setStats(null);
    setMembers([]);
    setMix([]);
    setTargets(null);
    setTrend([]);
    setSettings(null);
    setAnnouncements([]);
    setSelectedTeamId(Number(id));
  };

  // 2. Numbers for the chosen period
  useEffect(() => {
    if (!selectedTeamId) return undefined;
    const ctrl = new AbortController();
    const { from, to } = getDatesFromPeriod(period);
    const range = `from=${from}&to=${to}`;

    (async () => {
      setPeriodLoading(true);
      setPeriodError(false);
      try {
        const [summary, contribution, mixRows, targetRows] = await Promise.all([
          api(`/api/teams/analytics/summary?team_id=${selectedTeamId}&${range}`, ctrl.signal),
          tryApi(`/api/teams/${selectedTeamId}/contribution?${range}`, ctrl.signal),
          tryApi(`/api/teams/${selectedTeamId}/service-mix?${range}`, ctrl.signal),
          tryApi(`/api/teams/${selectedTeamId}/targets?photos=1`, ctrl.signal),
        ]);
        setStats(summary?.teams?.[0] || null);
        setMembers(Array.isArray(contribution) ? contribution : []);
        setMix(Array.isArray(mixRows) ? mixRows : []);
        setTargets(targetRows);
      } catch (err) {
        if (err.name !== "AbortError") setPeriodError(true);
      } finally {
        if (!ctrl.signal.aborted) setPeriodLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [selectedTeamId, period, reloadKey]);

  // 3. Things that belong to the team, not the period
  useEffect(() => {
    if (!selectedTeamId) return undefined;
    const ctrl = new AbortController();

    (async () => {
      try {
        const [trendRows, settingRow, notes] = await Promise.all([
          tryApi(`/api/teams/${selectedTeamId}/trend?year=${trendYear}`, ctrl.signal),
          tryApi(`/api/teams/${selectedTeamId}/settings`, ctrl.signal),
          tryApi(`/api/knowledge/hub/announcements?teamId=${selectedTeamId}`, ctrl.signal),
        ]);
        setTrend(Array.isArray(trendRows) ? trendRows : []);
        setSettings(settingRow);
        setAnnouncements(Array.isArray(notes) ? notes : []);
      } catch {
        /* aborted */
      }
    })();

    return () => ctrl.abort();
  }, [selectedTeamId, trendYear, reloadKey]);

  // ------------------------------------------------------------------
  // Derived
  // ------------------------------------------------------------------
  const team = myTeams.find((t) => Number(t.id) === selectedTeamId);
  const targetsEnabled = !!settings?.targets_enabled;
  const teamTargets = stats?.targets || null;

  const meIdx = members.findIndex((m) => Number(m.id) === Number(myId));
  const me = meIdx >= 0 ? members[meIdx] : null;
  const myTarget = (targets?.members || []).find((m) => Number(m.staff_id) === Number(myId)) || null;

  const charges = Number(stats?.service_charges) || 0;
  const expense = Number(stats?.expense) || 0;
  const net = Number(stats?.net_profit) || 0;
  const margin = charges > 0 ? Math.round((net / charges) * 100) : 0;

  const chargesSpark = (stats?.series || []).map((p) => Number(p.service_charges) || 0);
  const expenseSpark = (stats?.series || []).map((p) => Number(p.expense) || 0);
  const netSpark = chargesSpark.map((v, i) => v - expenseSpark[i]);

  const monthlyChartData = useMemo(() => {
    const lastMonth = new Date().getMonth() + 1;
    return trend
      .filter((t) => t.month <= lastMonth)
      .map((t) => ({ label: `${trendYear}-${String(t.month).padStart(2, "0")}`, value: Number(t.service_charges) || 0 }));
  }, [trend, trendYear]);

  const mixRows = useMemo(
    () => mix.map((s) => ({ category: s.service_type, amount: Number(s.total) || 0, subcategories: [] })),
    [mix]
  );

  // Upcoming birthdays in the team, soonest first
  const birthdays = useMemo(() => {
    const base = istTodayUtc();
    return members
      .filter((m) => m.birthday)
      .map((m) => {
        const ts = nextBirthday(m.birthday, base);
        return ts === null ? null : { member: m, ts, days: Math.round((ts - base) / 86400000) };
      })
      .filter(Boolean)
      .sort((a, b) => a.days - b.days);
  }, [members]);
  const birthdaysSoon = birthdays.filter((b) => b.days <= 30);
  const birthdaysToday = birthdays.filter((b) => b.days === 0);

  const maxCharges = Math.max(1, ...members.map((m) => Number(m.service_charges) || 0));

  const selectCls =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500";
  const btnGhost =
    "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 disabled:opacity-60";
  const btnPrimary =
    "inline-flex items-center gap-1.5 rounded-lg bg-navy-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-navy-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2";

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  if (teamsLoading) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center bg-slate-50">
        <div className="text-center">
          <FiLoader className="mx-auto mb-3 h-8 w-8 animate-spin text-navy-700" />
          <p className="text-sm text-slate-500">Loading your team…</p>
        </div>
      </div>
    );
  }

  if (teamsError || myTeams.length === 0) {
    return (
      <div className="h-full overflow-y-auto bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto mt-10 max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <FiUsers className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-lg font-semibold text-slate-900">
            {teamsError ? "Couldn't load your teams" : "You're not in a team yet"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {teamsError ? "Check your connection and try again." : "Once your admin adds you to a team, its numbers and targets show up here."}
          </p>
          {teamsError && (
            <button type="button" onClick={() => window.location.reload()} className={`${btnPrimary} mt-5`}>
              <FiRefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">My Team</h1>
          <p className="text-sm text-slate-500">Service charges and targets · {periodLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {myTeams.length > 1 && (
            <select value={selectedTeamId || ""} onChange={(e) => switchTeam(e.target.value)} className={selectCls} aria-label="Select team">
              {myTeams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.is_primary ? " (Primary)" : ""}</option>
              ))}
            </select>
          )}
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className={selectCls} aria-label="Select period">
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} disabled={periodLoading} className={btnGhost} title="Refresh" aria-label="Refresh">
            <FiRefreshCw className={`h-4 w-4 ${periodLoading ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Team banner */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            {team?.is_global ? <FiGlobe className="h-5 w-5" aria-hidden="true" /> : <FiUsers className="h-5 w-5" aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-slate-900">{team?.name}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <span>{members.length || team?.member_count || 0} members</span>
              {team?.is_global && <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">Global team</span>}
              {(team?.is_primary || me?.is_primary) && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">Your primary team</span>}
              {team?.created_at && <span>Created {formatDate(team.created_at)}</span>}
              {birthdaysToday.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2 py-0.5 font-medium text-pink-700">
                  <FiGift className="h-3 w-3" aria-hidden="true" />
                  {birthdaysToday.map((b) => (Number(b.member.id) === Number(myId) ? "Your" : `${b.member.name.split(" ")[0]}'s`)).join(", ")} birthday today
                </span>
              )}
            </div>
          </div>
        </div>
        {members.length > 0 && <AvatarStack people={members} />}
      </div>

      {periodError && (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>Couldn't load this team's numbers.</span>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="font-semibold underline">Try again</button>
        </div>
      )}

      <div className={`transition-opacity ${periodLoading && stats ? "opacity-60" : ""}`}>
        {/* KPIs */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Service charges"
            value={money(charges)}
            tone="text-emerald-600"
            context={periodLabel}
            note={`${stats?.services_completed ?? 0} completed ${stats?.services_completed === 1 ? "service" : "services"}`}
            spark={chargesSpark}
            sparkColor="#059669"
          />
          <Kpi
            label="Expenses"
            value={money(expense)}
            tone="text-rose-600"
            context={periodLabel}
            note="Approved expenses"
            spark={expenseSpark}
            sparkColor="#e11d48"
          />
          <Kpi
            label="Net profit"
            value={money(net)}
            tone={net < 0 ? "text-rose-600" : "text-emerald-600"}
            context={`${margin}% of service charges`}
            note="Service charges less expenses"
            spark={netSpark}
            sparkColor={net < 0 ? "#e11d48" : "#059669"}
          />
          {targetsEnabled ? (
            <Kpi
              label="Monthly target"
              value={teamTargets && teamTargets.target > 0 ? `${Math.round(teamTargets.progress)}%` : "Not set"}
              tone={teamTargets && teamTargets.progress >= 100 ? "text-emerald-600" : "text-slate-900"}
              context={teamTargets && teamTargets.target > 0 ? `${money(teamTargets.achieved)} of ${money(teamTargets.target)}` : "No member targets this month"}
              note={teamTargets?.mode === "manual" ? "Set for the team" : "Sum of members' targets"}
              bar={teamTargets && teamTargets.target > 0 ? (
                <TargetBar value={teamTargets.achieved} max={teamTargets.target} tone={paceTone(teamTargets.progress, teamTargets.onPace)} />
              ) : null}
            />
          ) : (
            <Kpi
              label="Team size"
              value={String(members.length || team?.member_count || 0)}
              context="Members in this team"
              note={members.length ? `${members.filter((m) => m.has_target).length} with a target this month` : ""}
            />
          )}
        </div>

        {/* My contribution */}
        {me && (
          <div className="mt-4">
            <Panel
              title="My contribution"
              hint={`${periodLabel}. Target figures are for this month`}
              action={
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  <FiAward className="h-3.5 w-3.5" aria-hidden="true" /> Rank #{meIdx + 1} of {members.length}
                </span>
              }
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
                <div className="flex min-w-0 items-center gap-3 lg:w-64 lg:flex-shrink-0">
                  <Avatar name={me.name} photo={me.photo} size={52} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{me.name}</p>
                    <p className="truncate text-xs text-slate-500">{me.role}{me.centre_name ? ` · ${me.centre_name}` : ""}</p>
                  </div>
                </div>
                <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-4">
                  <Tile label="Service charges" value={money(me.service_charges)} tone="text-emerald-700" hint={periodLabel} />
                  <Tile label="Services" value={me.services_completed} hint="Completed" />
                  {me.has_target ? (
                    <>
                      <Tile
                        label="Today"
                        value={money(myTarget?.today)}
                        hint={myTarget?.daily_target ? `of ${money(myTarget.daily_target)} daily target` : "No daily target"}
                        tone={myTarget?.today_met ? "text-emerald-700" : "text-slate-900"}
                      />
                      <Tile
                        label="Days on target"
                        value={myTarget ? `${myTarget.days_met}` : "—"}
                        hint={myTarget ? `of ${myTarget.complete_days} full days` : ""}
                      />
                    </>
                  ) : (
                    <div className="col-span-2 flex items-center rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">
                      You have no personal target set for this month.
                    </div>
                  )}
                </div>
              </div>
              {me.has_target && (
                <div className="mt-5">
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="text-slate-500">
                      My monthly target <span className={paceTextTone(me.target_progress, me.on_pace)}>· {paceText(me.target_progress, me.on_pace)}</span>
                    </span>
                    <span className="tabular-nums text-slate-700">
                      {money(me.month_achieved)} / {money(me.target)} <span className="font-semibold text-slate-900">{Math.round(me.target_progress)}%</span>
                    </span>
                  </div>
                  <TargetBar value={me.month_achieved} max={me.target} tone={paceTone(me.target_progress, me.on_pace)} />
                </div>
              )}
            </Panel>
          </div>
        )}

        {/* Leaderboard + service mix */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-7">
            <Panel title="Team leaderboard" hint={`Ranked by service charges · ${periodLabel}${targetsEnabled ? ". Target bars show this month" : ""}`}>
              {members.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">No member activity to show yet.</p>
              ) : (
                <ul className="space-y-4">
                  {members.map((m, idx) => {
                    const mine = Number(m.id) === Number(myId);
                    return (
                      <li
                        key={m.id}
                        className={`grid grid-cols-1 gap-x-8 gap-y-2 rounded-lg md:items-center ${targetsEnabled ? "md:grid-cols-2" : ""} ${mine ? "bg-blue-50/60 p-3 ring-1 ring-blue-100" : "px-3"}`}
                      >
                        <div>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="flex min-w-0 items-center gap-3">
                              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-semibold text-slate-600">{idx + 1}</span>
                              <Avatar name={m.name} photo={m.photo} size={40} />
                              <span className="min-w-0">
                                <span className="flex items-center gap-1.5">
                                  <span className="truncate text-sm font-medium text-slate-900">{m.name}</span>
                                  {mine && <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">You</span>}
                                </span>
                                <span className="block truncate text-xs text-slate-500">{m.role}{m.centre_name ? ` · ${m.centre_name}` : ""}</span>
                              </span>
                            </span>
                            <span className="text-sm font-semibold tabular-nums text-emerald-700">{money(m.service_charges)}</span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${((Number(m.service_charges) || 0) / maxCharges) * 100}%` }} />
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{m.services_completed} {m.services_completed === 1 ? "service" : "services"}</p>
                        </div>
                        {targetsEnabled && (
                          <div>
                            <p className="mb-1 text-xs text-slate-500">This month's target</p>
                            <MiniTargetBar achieved={m.month_achieved} target={m.target} onPace={m.on_pace} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>
          <div className="xl:col-span-5">
            <Panel title="Service charges by service" hint={periodLabel}>
              <MixDonut rows={mixRows} totalLabel="earned" emptyText="No completed services in this period." />
            </Panel>
          </div>
        </div>

        {/* Team target */}
        {targetsEnabled && (
          <div className="mt-4">
            <Panel title="Team target" hint={teamTargets?.mode === "manual" ? "Target set for the team, this month" : "Sum of members' individual targets, this month"}>
              {teamTargets && teamTargets.target > 0 ? (
                <div>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="text-slate-500">
                      Month <span className={paceTextTone(teamTargets.progress, teamTargets.onPace)}>· {paceText(teamTargets.progress, teamTargets.onPace)}</span>
                    </span>
                    <span className="tabular-nums text-slate-700">
                      {money(teamTargets.achieved)} / {money(teamTargets.target)} <span className="font-semibold text-slate-900">{Math.round(teamTargets.progress)}%</span>
                    </span>
                  </div>
                  <TargetBar value={teamTargets.achieved} max={teamTargets.target} tone={paceTone(teamTargets.progress, teamTargets.onPace)} />
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Tile label="Today" value={money(teamTargets.today)} hint={`of ${money(teamTargets.dailyTarget)} daily target`} />
                    <Tile
                      label="Met today's target"
                      value={<>{teamTargets.metToday} <span className="text-sm font-normal text-slate-500">of {teamTargets.membersWithTarget} members</span></>}
                    />
                    <Tile
                      label="Month progress"
                      value={<>Day {teamTargets.dayOfMonth} <span className="text-sm font-normal text-slate-500">of {teamTargets.daysInMonth}</span></>}
                    />
                  </div>
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-slate-500">No target is set for this team this month.</p>
              )}
            </Panel>
          </div>
        )}

        {/* Trend */}
        <div className="mt-4">
          <Panel title="Service charges by month" hint={`${trendYear}, completed services`}>
            <RevenueChart data={monthlyChartData} view="serviceCharges" />
          </Panel>
        </div>

        {/* Announcements + birthdays */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-7">
            <Panel title="Team announcements" hint="From your team leaders and admins">
            {announcements.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No announcements for this team.</p>
            ) : (
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                {announcements.map((a, i) => {
                  const body = a.content || a.message || a.body || a.description;
                  const author = a.author || a.author_name || a.created_by_name || a.posted_by;
                  const when = formatDate(a.created_at || a.date);
                  return (
                    <li key={a.id ?? i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                        <FiBell className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{a.title}</p>
                        {body && <p className="mt-0.5 whitespace-pre-line text-sm text-slate-600">{body}</p>}
                        {(author || when) && (
                          <p className="mt-1 text-xs text-slate-400">{[author && `Posted by ${author}`, when].filter(Boolean).join(" · ")}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          </div>
          <div className="xl:col-span-5">
            <Panel title="Team birthdays" hint="Next 30 days">
              {birthdaysSoon.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  No birthdays in the next 30 days.
                  {birthdays[0] && (
                    <span className="mt-1 block text-xs text-slate-400">
                      Next: {birthdays[0].member.name} on {new Date(birthdays[0].ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}
                    </span>
                  )}
                </p>
              ) : (
                <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                  {birthdaysSoon.map(({ member, ts, days }) => (
                    <li key={member.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <Avatar name={member.name} photo={member.photo} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                          <span className="truncate">{member.name}</span>
                          {Number(member.id) === Number(myId) && <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">You</span>}
                        </p>
                        <p className="text-xs text-slate-500">{new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${days === 0 ? "bg-pink-50 text-pink-700" : "bg-slate-100 text-slate-600"}`}>
                        {days === 0 && <FiGift className="h-3 w-3" aria-hidden="true" />}
                        {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffTeamDashboard;