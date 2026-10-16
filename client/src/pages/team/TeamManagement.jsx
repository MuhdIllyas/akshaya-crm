// TeamManagement.jsx
import React, { useState, useEffect, useMemo, Fragment } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";
import {
  FiGlobe, FiBarChart2, FiSearch, FiPlus, FiX, FiStar, FiTrash2,
  FiChevronRight, FiLoader, FiMapPin, FiArrowUp, FiArrowDown
} from "react-icons/fi";
import { toast } from "react-toastify";

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

const TargetBar = ({ value, max, tone }) => (
  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
    <div className={`h-full rounded-full ${tone}`} style={{ width: `${max > 0 ? Math.min((value / max) * 100, 100) : 0}%` }} />
  </div>
);

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

// ==========================================
// TEAMS
// ==========================================
// ----------------------------------------------------------------------
// JWT helper – exactly as in CalendarPage.jsx
// ----------------------------------------------------------------------
function getTokenClaims() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload));
    return {
      id: decoded.id,
      role: decoded.role,
      centreId: decoded.centre_id,
      name: decoded.name,
    };
  } catch {
    return null;
  }
}

const API_BASE = import.meta.env.VITE_API_URL || "";


// Compact "₹a / ₹t  42%" bar, same look as the staff-targets rows on the dashboards
const MiniTargetBar = ({ achieved, target, onPace }) => {
  if (!target) return <span className="text-xs text-slate-400">No target set</span>;
  const raw = (achieved / target) * 100;
  const tone = raw >= 100 ? "bg-emerald-500" : onPace ? "bg-indigo-500" : "bg-amber-500";
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

// ----------------------------------------------------------------------
// TeamManagement Component
// ----------------------------------------------------------------------
const TeamManagement = () => {
  // ---- Auth from JWT ----
  const claims = getTokenClaims();
  const user = claims || { id: null, role: "staff", centreId: null, name: "" };
  const isAdmin = ["admin", "superadmin"].includes(user.role);
  const isSuperAdmin = user.role === "superadmin";

  // ---- State ----
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [totalStats, setTotalStats] = useState({
    total: 0,
    global: 0,
    centre: 0,
    members: 0,
  });

  // Service-charge data from the analytics endpoint
  const [financialData, setFinancialData] = useState({ teams: [], totals: {} });

  // Filters
  const [period, setPeriod] = useState("month");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); 
  const [centreFilter, setCentreFilter] = useState("all");

  // Centres list (superadmin) + admin's own centre name
  const [centres, setCentres] = useState([]);
  const [adminCentreName, setAdminCentreName] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageMembersModal, setShowManageMembersModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);

  // Analytics modal state
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [analyticsTeam, setAnalyticsTeam] = useState(null);
  const [analyticsTab, setAnalyticsTab] = useState("overview"); 
  const [contributionData, setContributionData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [serviceMix, setServiceMix] = useState([]);
  const [teamTargets, setTeamTargets] = useState(null); // sum of members' targets, this month
  const [trendYear, setTrendYear] = useState(new Date().getFullYear());
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // --- EXPANDABLE ROW STATE (Replaces the Manage Members Modal) ---
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [teamMembersMap, setTeamMembersMap] = useState({});
  const [teamTargetsMap, setTeamTargetsMap] = useState({});
  const [membersLoading, setMembersLoading] = useState(false);

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

  // Roster + this month's targets for one team (members and targets are fetched together)
  const loadTeamExtras = async (teamId) => {
    const [membersRes, targetsRes] = await Promise.all([
      fetch(`${API_BASE}/api/teams/${teamId}/members`, { headers: authHeaders() }),
      fetch(`${API_BASE}/api/teams/${teamId}/targets`, { headers: authHeaders() }).catch(() => ({ ok: false })),
    ]);
    const membersData = await membersRes.json();
    setTeamMembersMap((prev) => ({ ...prev, [teamId]: Array.isArray(membersData) ? membersData : [] }));
    if (targetsRes.ok) {
      const targetsData = await targetsRes.json();
      setTeamTargetsMap((prev) => ({ ...prev, [teamId]: targetsData }));
    }
  };

  const toggleTeamExpand = async (team) => {
    if (expandedTeamId === team.id) {
      setExpandedTeamId(null);
      return;
    }
    setExpandedTeamId(team.id);
    setMembersLoading(true);
    try {
      await loadTeamExtras(team.id);
    } catch (error) {
      console.error("Fetch members failed:", error);
    } finally {
      setMembersLoading(false);
    }
  };

  const handleInlineAddMember = async (teamId) => {
    const staffId = Number(addMemberValue);
    if (!teamId || !staffId) return;
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ staff_id: staffId, is_primary: false }),
      });
      if (!response.ok) throw new Error("Failed to add member");

      await loadTeamExtras(teamId); // refresh just this row, targets included
      setAddMemberValue("");
      fetchTeams(); fetchFinancials();
    } catch (error) { toast.error(error.message); } finally { setSubmitting(false); }
  };

  const handleInlineRemoveMember = async (teamId, staffId) => {
    if (!window.confirm("Remove this member?")) return;
    setSubmitting(true);
    try {
      await fetch(`${API_BASE}/api/teams/${teamId}/members/${staffId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      await loadTeamExtras(teamId);
      fetchTeams(); fetchFinancials();
    } catch (error) { console.error(error); } finally { setSubmitting(false); }
  };

  const handleInlineSetPrimary = async (teamId, memberId) => {
    setSubmitting(true);
    try {
      await fetch(`${API_BASE}/api/teams/member/${memberId}/primary`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const updatedRes = await fetch(`${API_BASE}/api/teams/${teamId}/members`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }});
      const updatedMembers = await updatedRes.json();
      setTeamMembersMap(prev => ({ ...prev, [teamId]: updatedMembers }));
    } catch (error) { console.error(error); } finally { setSubmitting(false); }
  };

  // Targets switch (the amount itself is the sum of members' individual targets)
  const [targetsEnabled, setTargetsEnabled] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const handleSaveSettings = async () => {
    if (!analyticsTeam) return;
    setSavingSettings(true);
    try {
      const response = await fetch(`${API_BASE}/api/teams/${analyticsTeam.id}/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ targets_enabled: targetsEnabled }),
      });
      if (!response.ok) throw new Error("Failed to save settings");
      toast.success("Team settings saved successfully!");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // Form for create / edit team
  const [teamForm, setTeamForm] = useState({
    name: "",
    description: "",
    is_global: false,
    centre_id: null,
    members: [],
  });

  // Available staff for member selection
  const [availableStaff, setAvailableStaff] = useState([]);
  const [addMemberValue, setAddMemberValue] = useState("");

  // ------------------------------------------------------------------
  // Fetch teams
  // ------------------------------------------------------------------
  const fetchTeams = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/teams`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await response.json();
      setTeams(data);

      const total = data.length;
      const global = data.filter((t) => t.is_global).length;
      const centre = total - global;
      const members = data.reduce(
        (sum, t) => sum + Number(t.member_count),
        0
      );
      setTotalStats({ total, global, centre, members });
    } catch (error) {
      console.error("Fetch teams failed:", error);
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Fetch financial summary (Now with Date Filters!)
  // ------------------------------------------------------------------
  const fetchFinancials = async () => {
    try {
      const { from, to } = getDatesFromPeriod(period);
      const response = await fetch(`${API_BASE}/api/teams/analytics/summary?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (response.ok) {
        const data = await response.json();
        setFinancialData(data);
      }
    } catch (error) {
      console.error("Fetch financials failed:", error);
    }
  };

  // ------------------------------------------------------------------
  // Fetch centres (superadmin = all, admin = own)
  // ------------------------------------------------------------------
  const fetchCentres = async () => {
    if (isSuperAdmin) {
      try {
        const response = await fetch(`${API_BASE}/api/wallet/centres`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const data = await response.json();
        setCentres(Array.isArray(data) ? data : data.centres || []);
      } catch (error) {
        console.error("Fetch centres failed:", error);
      }
    } else if (isAdmin) {
      try {
        const response = await fetch(`${API_BASE}/api/centres/${user.centreId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (response.ok) {
          const centre = await response.json();
          setAdminCentreName(centre.name || "");
        }
      } catch (error) {
        console.error("Fetch admin centre failed:", error);
      }
    }
  };

  // Helper to get centre name by ID
  const getCentreName = (centreId) => {
    if (isSuperAdmin) {
      const centre = centres.find((c) => c.id === centreId);
      return centre?.name || `Centre #${centreId}`;
    }
    if (isAdmin) {
      return adminCentreName || `Centre #${centreId}`;
    }
    return `Centre #${centreId}`;
  };

  // ------------------------------------------------------------------
  // Fetch staff (same logic as CalendarPage)
  // ------------------------------------------------------------------
  const fetchStaff = async () => {
    try {
      let url = `${API_BASE}/api/servicemanagement/staff`;
      if (!isSuperAdmin) {
        url += `?centre_id=${user.centreId}`;
      }
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok) throw new Error("Failed to fetch staff");
      const data = await response.json();
      const staffList = Array.isArray(data) ? data : data.staff || [];
      setAvailableStaff(staffList);
    } catch (error) {
      console.error("Fetch staff failed:", error);
      setAvailableStaff([]);
    }
  };

  // Initial load (Static data)
  useEffect(() => {
    fetchTeams();
    fetchCentres();
    fetchStaff();
  }, []);

  // Dynamic load (Fires when period changes)
  useEffect(() => {
    fetchFinancials();
  }, [period]);

  // ------------------------------------------------------------------
  // Merge team list with financials
  // ------------------------------------------------------------------
  const mergedTeams = useMemo(() => {
    return teams.map((team) => {
      const fin = (financialData.teams || []).find((t) => t.id === team.id);
      return {
        ...team,
        service_charges: fin ? fin.service_charges : 0,
        services_completed: fin ? fin.services_completed : 0,
        revenue_billed: fin ? fin.revenue_billed : 0,
        expense: fin ? fin.expense : 0,
        net_profit: fin ? fin.net_profit : 0,
        targets: fin ? fin.targets : null,
      };
    });
  }, [teams, financialData]);

  // ------------------------------------------------------------------
  // Filtered teams
  // ------------------------------------------------------------------
  const filteredTeams = useMemo(() => {
    return mergedTeams.filter((team) => {
      const matchesSearch = team.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "centre" && !team.is_global) ||
        (typeFilter === "global" && team.is_global);
      const matchesCentre =
        centreFilter === "all" || String(team.centre_id) === centreFilter;
      return matchesSearch && matchesType && matchesCentre;
    }).sort((a, b) => (Number(b.service_charges) || 0) - (Number(a.service_charges) || 0) || a.name.localeCompare(b.name));
  }, [mergedTeams, searchTerm, typeFilter, centreFilter]);

  // ------------------------------------------------------------------
  // Create team modal helpers
  // ------------------------------------------------------------------
  const openCreateModal = () => {
    setTeamForm({
      name: "",
      description: "",
      is_global: false,
      centre_id: user.role === "admin" ? user.centreId : null,
      members: [],
    });
    fetchStaff();
    setShowCreateModal(true);
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!teamForm.name.trim()) return alert("Team name is required");
    if (submitting) return;

    setSubmitting(true);
    try {
      const payload = {
        name: teamForm.name.trim(),
        description: teamForm.description,
        is_global: teamForm.is_global,
        centre_id: teamForm.centre_id,
        members: teamForm.members.map((staffId) => ({
          staff_id: staffId,
          is_primary: false,
        })),
      };

      const response = await fetch(`${API_BASE}/api/teams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create team");

      setShowCreateModal(false);
      fetchTeams();
      fetchFinancials();
    } catch (error) {
      alert(error.message || "Error creating team");
    } finally {
      setSubmitting(false);
    }
  };

  const addMemberToForm = (staffId) => {
    if (!staffId) return;
    setTeamForm((prev) => ({
      ...prev,
      members: prev.members.includes(staffId)
        ? prev.members
        : [...prev.members, staffId],
    }));
  };

  const removeMemberFromForm = (staffId) => {
    setTeamForm((prev) => ({
      ...prev,
      members: prev.members.filter((id) => id !== staffId),
    }));
  };

  // ------------------------------------------------------------------
  // Manage members modal helpers
  // ------------------------------------------------------------------
  const openManageMembers = async (team) => {
    setSelectedTeam(team);
    fetchStaff();
    try {
      const response = await fetch(`${API_BASE}/api/teams/${team.id}/members`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const membersData = await response.json();
      setSelectedTeam((prev) => ({ ...prev, membersList: membersData }));
      setAddMemberValue("");
      setShowManageMembersModal(true);
    } catch (error) {
      console.error("Fetch members failed:", error);
    }
  };

  const handleSetPrimary = async (memberId) => {
    try {
      await fetch(`${API_BASE}/api/teams/member/${memberId}/primary`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (selectedTeam) openManageMembers(selectedTeam);
    } catch (error) {
      console.error("Set primary failed:", error);
    }
  };

  const handleRemoveMember = async (teamId, staffId) => {
    if (!window.confirm("Remove this member?")) return;
    try {
      await fetch(`${API_BASE}/api/teams/${teamId}/members/${staffId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (selectedTeam) openManageMembers(selectedTeam);
      fetchTeams();
      fetchFinancials();
    } catch (error) {
      console.error("Remove member failed:", error);
    }
  };

  const handleAddMemberToTeam = async (staffId) => {
    if (!selectedTeam || !staffId) return;
    setSubmitting(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/teams/${selectedTeam.id}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ staff_id: staffId, is_primary: false }),
        }
      );
      if (!response.ok) throw new Error("Failed to add member");

      const updatedRes = await fetch(
        `${API_BASE}/api/teams/${selectedTeam.id}/members`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      const updatedMembers = await updatedRes.json();
      setSelectedTeam((prev) => ({ ...prev, membersList: updatedMembers }));
      setAddMemberValue("");
      fetchTeams();
      fetchFinancials();
    } catch (error) {
      alert(error.message || "Error adding member");
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------------------------
  // Delete team
  // ------------------------------------------------------------------
  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm("Delete this team? This action cannot be undone."))
      return;
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/teams/${teamId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok) throw new Error("Failed to delete team");
      fetchTeams();
      fetchFinancials();
    } catch (error) {
      alert(error.message || "Error deleting team");
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------------------------
  // Analytics modal helpers
  // ------------------------------------------------------------------
  const fetchAnalyticsData = async (teamId) => {
    setAnalyticsLoading(true);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
      const { from, to } = getDatesFromPeriod(period);
      const range = `from=${from}&to=${to}`;

      // Fetch everything at the same time
      const [contribRes, trendRes, mixRes, settingsRes, targetsRes] = await Promise.all([
        fetch(`${API_BASE}/api/teams/${teamId}/contribution?${range}`, { headers }),
        fetch(`${API_BASE}/api/teams/${teamId}/trend?year=${trendYear}`, { headers }),
        fetch(`${API_BASE}/api/teams/${teamId}/service-mix?${range}`, { headers }).catch(() => ({ ok: false })),
        fetch(`${API_BASE}/api/teams/${teamId}/settings`, { headers }).catch(() => ({ ok: false })),
        fetch(`${API_BASE}/api/teams/${teamId}/targets`, { headers }).catch(() => ({ ok: false })),
      ]);

      setContributionData(contribRes.ok ? await contribRes.json() : []);
      setTrendData(trendRes.ok ? await trendRes.json() : []);
      setServiceMix(mixRes.ok ? await mixRes.json() : []);
      setTeamTargets(targetsRes.ok ? await targetsRes.json() : null);

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setTargetsEnabled(!!settingsData.targets_enabled);
      } else {
        setTargetsEnabled(false);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const openAnalyticsModal = (team) => {
    setAnalyticsTeam(team);
    setAnalyticsTab("overview");
    setShowAnalyticsModal(true);
    fetchAnalyticsData(team.id);
  };

  // Analytics calculations for the team dashboard
  const activeTeamStats = useMemo(() => mergedTeams.find(t => t.id === analyticsTeam?.id), [analyticsTeam, mergedTeams]);
  const netMargin = activeTeamStats && activeTeamStats.service_charges > 0
    ? ((activeTeamStats.net_profit / activeTeamStats.service_charges) * 100).toFixed(1)
    : 0;
  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label || "";

  // Service charges by month for the chart (months that have not happened yet are left out)
  const monthlyChartData = useMemo(() => {
    const lastMonth = trendYear === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;
    return trendData
      .filter((t) => t.month <= lastMonth)
      .map((t) => ({ label: `${trendYear}-${String(t.month).padStart(2, "0")}`, value: Number(t.service_charges) || 0 }));
  }, [trendData, trendYear]);

  // Rows for the service-charges donut
  const mixRows = useMemo(
    () => serviceMix.map((s) => ({ category: s.service_type, amount: Number(s.total) || 0, subcategories: [] })),
    [serviceMix]
  );

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  const btnPrimary =
    "inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:opacity-60";
  const btnGhost =
    "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:opacity-60";
  const selectCls =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600";
  const inputCls =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:bg-slate-50";
  const thCls = "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500";

  // Totals for the teams currently shown
  const sumTotals = filteredTeams.reduce(
    (a, t) => ({
      charges: a.charges + (Number(t.service_charges) || 0),
      expense: a.expense + (Number(t.expense) || 0),
      net: a.net + (Number(t.net_profit) || 0),
      target: a.target + (Number(t.targets?.target) || 0),
      achieved: a.achieved + (Number(t.targets?.achieved) || 0),
    }),
    { charges: 0, expense: 0, net: 0, target: 0, achieved: 0 }
  );
  const targetPct = sumTotals.target > 0 ? Math.round((sumTotals.achieved / sumTotals.target) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Teams</h1>
          <p className="text-sm text-slate-500">Service charges and monthly targets · {periodLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search teams"
              aria-label="Search teams"
              className="w-44 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className={selectCls} aria-label="Select period">
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectCls} aria-label="Team type">
            <option value="all">All types</option>
            <option value="centre">Centre teams</option>
            <option value="global">Global teams</option>
          </select>
          {isSuperAdmin && (
            <select value={centreFilter} onChange={(e) => setCentreFilter(e.target.value)} className={selectCls} aria-label="Centre">
              <option value="all">All centres</option>
              {centres.map((centre) => (
                <option key={centre.id} value={centre.id}>{centre.name}</option>
              ))}
            </select>
          )}
          {isAdmin && (
            <button onClick={openCreateModal} disabled={submitting} className={btnPrimary}>
              <FiPlus className="h-4 w-4" aria-hidden="true" /> New team
            </button>
          )}
        </div>
      </div>

      {/* Glance strip */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Teams" value={totalStats.total} hint="All teams" />
        <MiniStat label="Global teams" value={totalStats.global} hint="Across centres" />
        <MiniStat label="Centre teams" value={totalStats.centre} hint="Inside one centre" />
        <MiniStat label="Members" value={totalStats.members} hint="Active, all teams" />
      </div>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi label="Service charges" value={money(sumTotals.charges)} context={periodLabel} note="Completed services, teams shown" />
        <Kpi
          label="Net profit"
          value={money(sumTotals.net)}
          tone={sumTotals.net < 0 ? "text-rose-600" : "text-slate-900"}
          context={`After ${money(sumTotals.expense)} expenses`}
          note="Service charges less expenses"
        />
        <Kpi
          label="Monthly target"
          value={`${targetPct}%`}
          context={`${money(sumTotals.achieved)} of ${money(sumTotals.target)}`}
          note="Sum of members' targets, this month"
        />
      </div>

      {/* Teams table */}
      <div className="mt-4">
        <Panel title="Teams" hint={`Ranked by service charges · ${periodLabel}. Targets are always this month`}>
          {loading ? (
            <div className="flex justify-center py-10"><FiLoader className="h-6 w-6 animate-spin text-indigo-600" /></div>
          ) : filteredTeams.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No teams match these filters.</p>
          ) : (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/70 text-left">
                    <th className={thCls}>Team</th>
                    <th className={`${thCls} text-center`}>Members</th>
                    <th className={`${thCls} text-right`}>Service charges</th>
                    <th className={`${thCls} text-right`}>Expense</th>
                    <th className={`${thCls} text-right`}>Net profit</th>
                    <th className={thCls}>Monthly target</th>
                    <th className={`${thCls} text-right`}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTeams.map((team) => (
                    <Fragment key={team.id}>
                      <tr className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => toggleTeamExpand(team)}
                              aria-expanded={expandedTeamId === team.id}
                              aria-label={`${expandedTeamId === team.id ? "Hide" : "Show"} ${team.name} members`}
                              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                            >
                              <FiChevronRight className={`h-4 w-4 transition-transform ${expandedTeamId === team.id ? "rotate-90" : ""}`} />
                            </button>
                            <div className="min-w-0">
                              <button type="button" onClick={() => toggleTeamExpand(team)} className="block max-w-[260px] truncate text-left text-sm font-medium text-slate-900 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">
                                {team.name}
                              </button>
                              {team.is_global ? (
                                <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-indigo-700">
                                  <FiGlobe className="h-3 w-3 flex-shrink-0" aria-hidden="true" /> Global
                                </span>
                              ) : (
                                <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                                  <FiMapPin className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                                  <span className="truncate">{getCentreName(team.centre_id)}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-sm tabular-nums text-slate-700">{team.member_count}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">{money(team.service_charges)}</td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-600">{money(team.expense)}</td>
                        <td className={`px-4 py-3 text-right text-sm font-semibold tabular-nums ${team.net_profit < 0 ? "text-rose-600" : "text-slate-900"}`}>{money(team.net_profit)}</td>
                        <td className="px-4 py-3">
                          <MiniTargetBar achieved={team.targets?.achieved || 0} target={team.targets?.target || 0} onPace={team.targets?.onPace} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => openAnalyticsModal(team)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600" title="Team dashboard" aria-label={`Open ${team.name} dashboard`}>
                              <FiBarChart2 className="h-4 w-4" />
                            </button>
                            {isAdmin && (
                              <button onClick={() => handleDeleteTeam(team.id)} disabled={submitting} className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:opacity-50" title="Delete team" aria-label={`Delete ${team.name}`}>
                                <FiTrash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {expandedTeamId === team.id && (
                        <tr className="bg-slate-50/70">
                          <td colSpan="7" className="px-5 py-4">
                            {membersLoading ? (
                              <div className="flex items-center py-4 text-sm text-slate-500"><FiLoader className="mr-2 animate-spin" /> Loading members</div>
                            ) : (
                              <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <h3 className="text-[15px] font-semibold text-slate-900">Team roster</h3>
                                  {isAdmin && (
                                    <div className="flex gap-2">
                                      <select
                                        className={selectCls}
                                        aria-label={`Add staff to ${team.name}`}
                                        value={addMemberValue}
                                        onChange={(e) => setAddMemberValue(e.target.value)}
                                      >
                                        <option value="">Add staff</option>
                                        {availableStaff.filter((s) => !teamMembersMap[team.id]?.some((m) => m.staff_id === s.id)).map((staff) => (
                                          <option key={staff.id} value={staff.id}>{staff.name} ({staff.role})</option>
                                        ))}
                                      </select>
                                      <button onClick={() => handleInlineAddMember(team.id)} disabled={!addMemberValue || submitting} className={btnPrimary}>Add</button>
                                    </div>
                                  )}
                                </div>

                                {teamTargetsMap[team.id] && (
                                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Team target this month</p>
                                      {teamTargetsMap[team.id].target > 0 ? (
                                        <>
                                          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
                                            {Math.round(teamTargetsMap[team.id].progress)}% <span className="text-sm font-normal text-slate-500">of target</span>
                                          </p>
                                          <p className="text-xs text-slate-500">{money(teamTargetsMap[team.id].achieved)} of {money(teamTargetsMap[team.id].target)}</p>
                                        </>
                                      ) : (
                                        <p className="mt-1 text-sm text-slate-500">No member has a target this month</p>
                                      )}
                                    </div>
                                    <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Met today's target</p>
                                      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
                                        {teamTargetsMap[team.id].metToday} <span className="text-sm font-normal text-slate-500">of {teamTargetsMap[team.id].membersWithTarget} members</span>
                                      </p>
                                      <p className="text-xs text-slate-500">{money(teamTargetsMap[team.id].today)} of {money(teamTargetsMap[team.id].dailyTarget)} today</p>
                                    </div>
                                    <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Targets set</p>
                                      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
                                        {teamTargetsMap[team.id].membersWithTarget} <span className="text-sm font-normal text-slate-500">of {teamTargetsMap[team.id].memberCount} members</span>
                                      </p>
                                      <p className="text-xs text-slate-500">Members without one are left out</p>
                                    </div>
                                  </div>
                                )}

                                <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                  {teamMembersMap[team.id]?.map((member) => {
                                    const t = teamTargetsMap[team.id]?.members?.find((x) => x.staff_id === member.staff_id);
                                    return (
                                      <li key={member.id} className="rounded-lg border border-slate-200 p-3">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="min-w-0">
                                            <p className="flex items-center gap-1 truncate text-sm font-medium text-slate-900">
                                              {member.name}
                                              {member.is_primary && <FiStar className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" title="Primary team" aria-label="Primary team" />}
                                            </p>
                                            <p className="truncate text-xs text-slate-500">{member.role}{member.centre_name ? ` · ${member.centre_name}` : ""}</p>
                                          </div>
                                          {isAdmin && (
                                            <div className="flex flex-shrink-0 gap-0.5">
                                              {!member.is_primary && (
                                                <button onClick={() => handleInlineSetPrimary(team.id, member.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600" title="Make primary team" aria-label={`Make ${team.name} the primary team of ${member.name}`}><FiStar className="h-4 w-4" /></button>
                                              )}
                                              <button onClick={() => handleInlineRemoveMember(team.id, member.staff_id)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600" title="Remove from team" aria-label={`Remove ${member.name}`}><FiTrash2 className="h-4 w-4" /></button>
                                            </div>
                                          )}
                                        </div>
                                        {t && <div className="mt-2.5"><MiniTargetBar achieved={t.achieved} target={t.target} onPace={t.on_pace} /></div>}
                                      </li>
                                    );
                                  })}
                                </ul>
                                {teamMembersMap[team.id]?.length === 0 && (
                                  <p className="py-6 text-center text-sm text-slate-500">No members assigned to this team yet.</p>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* ---- CREATE TEAM MODAL ---- */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="New team">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <h2 className="text-[15px] font-semibold text-slate-900">New team</h2>
              <button onClick={() => setShowCreateModal(false)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600" aria-label="Close">
                <FiX className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTeam} className="space-y-4 p-5">
              <div>
                <label htmlFor="team-name" className="mb-1 block text-sm font-medium text-slate-700">Team name</label>
                <input id="team-name" type="text" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} className={inputCls} required disabled={submitting} />
              </div>
              <div>
                <label htmlFor="team-desc" className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <textarea id="team-desc" value={teamForm.description} onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })} className={inputCls} rows={2} disabled={submitting} />
              </div>

              {isSuperAdmin && (
                <label htmlFor="is_global" className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    id="is_global"
                    checked={teamForm.is_global}
                    onChange={(e) => setTeamForm({ ...teamForm, is_global: e.target.checked, centre_id: e.target.checked ? null : teamForm.centre_id })}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                    disabled={submitting}
                  />
                  Global team (members from different centres)
                </label>
              )}

              {!teamForm.is_global && isSuperAdmin && (
                <div>
                  <label htmlFor="team-centre" className="mb-1 block text-sm font-medium text-slate-700">Centre</label>
                  <select id="team-centre" value={teamForm.centre_id || ""} onChange={(e) => setTeamForm({ ...teamForm, centre_id: e.target.value ? Number(e.target.value) : null })} className={inputCls} disabled={submitting}>
                    <option value="">Select centre</option>
                    {centres.map((centre) => (
                      <option key={centre.id} value={centre.id}>{centre.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="team-members" className="mb-1 block text-sm font-medium text-slate-700">Initial members</label>
                {teamForm.members.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {teamForm.members.map((staffId) => {
                      const staff = availableStaff.find((s) => s.id === staffId);
                      return (
                        <span key={staffId} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                          {staff?.name || `ID ${staffId}`}
                          <button type="button" onClick={() => removeMemberFromForm(staffId)} className="rounded-full p-0.5 hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600" aria-label={`Remove ${staff?.name || staffId}`} disabled={submitting}>
                            <FiX className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <select
                  id="team-members"
                  className={inputCls}
                  value=""
                  onChange={(e) => {
                    const staffId = Number(e.target.value);
                    if (staffId) addMemberToForm(staffId);
                  }}
                  disabled={submitting}
                >
                  <option value="">Add a staff member</option>
                  {availableStaff.filter((s) => !teamForm.members.includes(s.id)).map((staff) => (
                    <option key={staff.id} value={staff.id}>{staff.name} {staff.role ? `(${staff.role})` : ""}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className={btnGhost} disabled={submitting}>Cancel</button>
                <button type="submit" disabled={submitting} className={btnPrimary}>
                  {submitting && <FiLoader className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Create team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---- TEAM DASHBOARD MODAL ---- */}
      {showAnalyticsModal && analyticsTeam && activeTeamStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label={`${analyticsTeam.name} dashboard`}>
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold tracking-tight text-slate-900">{analyticsTeam.name}</h2>
                <p className="text-sm text-slate-500">
                  {analyticsTeam.is_global ? "Global team" : getCentreName(analyticsTeam.centre_id)} · {periodLabel}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Segmented
                  value={analyticsTab}
                  onChange={setAnalyticsTab}
                  options={[
                    { value: "overview", label: "Overview" },
                    { value: "leaderboard", label: "Leaderboard" },
                    { value: "settings", label: "Targets" },
                  ]}
                />
                <button onClick={() => setShowAnalyticsModal(false)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600" aria-label="Close">
                  <FiX className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {analyticsLoading ? (
                <div className="flex justify-center py-20"><FiLoader className="h-8 w-8 animate-spin text-indigo-600" /></div>
              ) : (
                <>
                  {/* OVERVIEW */}
                  {analyticsTab === "overview" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <Kpi
                          label="Service charges"
                          value={money(activeTeamStats.service_charges)}
                          context={periodLabel}
                          note={`${activeTeamStats.services_completed} completed ${activeTeamStats.services_completed === 1 ? "service" : "services"}`}
                        />
                        <Kpi label="Expenses" value={money(activeTeamStats.expense)} context={periodLabel} note="Approved expenses" />
                        <Kpi
                          label="Net profit"
                          value={money(activeTeamStats.net_profit)}
                          tone={activeTeamStats.net_profit < 0 ? "text-rose-600" : "text-slate-900"}
                          context={`${netMargin}% of service charges`}
                          note="Service charges less expenses"
                        />
                        <Kpi
                          label="Monthly target"
                          value={teamTargets && teamTargets.target > 0 ? `${Math.round(teamTargets.progress)}%` : "Not set"}
                          context={teamTargets && teamTargets.target > 0 ? `${money(teamTargets.achieved)} of ${money(teamTargets.target)}` : "No member targets this month"}
                          note="Sum of members' targets"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                        <div className="xl:col-span-7">
                          <Panel title="Service charges by month" hint={`${trendYear}, completed services`}>
                            <RevenueChart data={monthlyChartData} view="serviceCharges" />
                          </Panel>
                        </div>
                        <div className="xl:col-span-5">
                          <Panel title="Service charges by service" hint={periodLabel}>
                            <MixDonut rows={mixRows} totalLabel="earned" emptyText="No completed services in this period." />
                          </Panel>
                        </div>
                      </div>

                      <Panel title="Monthly target" hint="Sum of members' individual targets, this month">
                        {!targetsEnabled ? (
                          <p className="py-6 text-center text-sm text-slate-500">
                            Targets are switched off for this team, so it is not measured against them. Turn them on in the Targets tab.
                          </p>
                        ) : teamTargets && teamTargets.target > 0 ? (
                          <div>
                            <div className="mb-1 flex items-baseline justify-between text-xs">
                              <span className="text-slate-500">
                                Month <span className={teamTargets.progress >= 100 ? "text-emerald-700" : teamTargets.onPace ? "text-slate-500" : "text-amber-700"}>
                                  {teamTargets.progress >= 100 ? "· reached" : teamTargets.onPace ? "· on pace" : "· behind pace"}
                                </span>
                              </span>
                              <span className="tabular-nums text-slate-700">
                                {money(teamTargets.achieved)} / {money(teamTargets.target)} <span className="font-semibold text-slate-900">{Math.round(teamTargets.progress)}%</span>
                              </span>
                            </div>
                            <TargetBar value={teamTargets.achieved} max={teamTargets.target} tone={teamTargets.progress >= 100 ? "bg-emerald-500" : teamTargets.onPace ? "bg-indigo-500" : "bg-amber-500"} />
                            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Today</p>
                                <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{money(teamTargets.today)}</p>
                                <p className="text-xs text-slate-500">of {money(teamTargets.dailyTarget)} daily target</p>
                              </div>
                              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Met today's target</p>
                                <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
                                  {teamTargets.metToday} <span className="text-sm font-normal text-slate-500">of {teamTargets.membersWithTarget} members</span>
                                </p>
                              </div>
                              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Month progress</p>
                                <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
                                  Day {teamTargets.dayOfMonth} <span className="text-sm font-normal text-slate-500">of {teamTargets.daysInMonth}</span>
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="py-6 text-center text-sm text-slate-500">
                            None of this team's members has a target for this month. Set them on the staff profiles and the team target adds up by itself.
                          </p>
                        )}
                      </Panel>
                    </div>
                  )}

                  {/* LEADERBOARD */}
                  {analyticsTab === "leaderboard" && (
                    <Panel title="Staff leaderboard" hint={`Ranked by service charges · ${periodLabel}. Target bars show this month`}>
                      {contributionData.length === 0 ? (
                        <p className="py-10 text-center text-sm text-slate-500">This team has no members yet.</p>
                      ) : (
                        <ul className="space-y-5">
                          {contributionData.map((member, idx) => {
                            const max = Math.max(1, ...contributionData.map((m) => m.service_charges));
                            return (
                              <li key={member.id} className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2 md:items-center">
                                <div>
                                  <div className="flex items-baseline justify-between gap-3">
                                    <span className="flex min-w-0 items-center gap-2">
                                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-semibold text-slate-600">{idx + 1}</span>
                                      <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium text-slate-900">{member.name}</span>
                                        <span className="block truncate text-xs text-slate-500">{member.role}{member.centre_name ? ` · ${member.centre_name}` : ""}</span>
                                      </span>
                                    </span>
                                    <span className="text-sm font-semibold tabular-nums text-slate-900">{money(member.service_charges)}</span>
                                  </div>
                                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                                    <div className="h-full rounded-full bg-cyan-600" style={{ width: `${(member.service_charges / max) * 100}%` }} />
                                  </div>
                                  <p className="mt-1 text-xs text-slate-500">{member.services_completed} {member.services_completed === 1 ? "service" : "services"}</p>
                                </div>
                                <div>
                                  <p className="mb-1 text-xs text-slate-500">This month's target</p>
                                  <MiniTargetBar achieved={member.month_achieved} target={member.target} onPace={member.on_pace} />
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </Panel>
                  )}

                  {/* TARGETS */}
                  {analyticsTab === "settings" && (
                    <Panel
                      title="Team targets"
                      hint="A team's monthly target is the sum of its members' individual targets. Change one on a staff profile and the team figure follows"
                    >
                      <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                        <span>
                          <span className="block text-sm font-medium text-slate-900">Measure this team against targets</span>
                          <span className="block text-xs text-slate-500">When off, the target section is hidden on this team's dashboard</span>
                        </span>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                          checked={targetsEnabled}
                          onChange={(e) => setTargetsEnabled(e.target.checked)}
                          disabled={!isAdmin}
                        />
                      </label>

                      <div className="-mx-5 mt-4 overflow-x-auto">
                        <table className="w-full min-w-[560px]">
                          <thead>
                            <tr className="border-y border-slate-100 bg-slate-50/70 text-left">
                              <th className={thCls}>Member</th>
                              <th className={`${thCls} text-right`}>Monthly target</th>
                              <th className={`${thCls} text-right`}>Achieved</th>
                              <th className={`${thCls} text-right`}>Daily target</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-sm">
                            {(teamTargets?.members || []).map((m) => (
                              <tr key={m.staff_id}>
                                <td className="px-4 py-3">
                                  <p className="font-medium text-slate-900">{m.name}</p>
                                  <p className="text-xs text-slate-500">{m.centre_name || m.role}</p>
                                </td>
                                {m.has_target ? (
                                  <>
                                    <td className="px-4 py-3 text-right tabular-nums text-slate-900">{money(m.target)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-slate-900">{money(m.achieved)} <span className="text-xs text-slate-500">{Math.round(m.progress)}%</span></td>
                                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{money(m.daily_target)}</td>
                                  </>
                                ) : (
                                  <td colSpan="3" className="px-4 py-3 text-right text-xs text-slate-500">No target set this month</td>
                                )}
                              </tr>
                            ))}
                            {teamTargets && teamTargets.members.length > 0 && (
                              <tr className="bg-slate-50/70 font-semibold text-slate-900">
                                <td className="px-4 py-3">Team total</td>
                                <td className="px-4 py-3 text-right tabular-nums">{money(teamTargets.target)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{money(teamTargets.achieved)} <span className="text-xs font-medium text-slate-500">{Math.round(teamTargets.progress)}%</span></td>
                                <td className="px-4 py-3 text-right tabular-nums">{money(teamTargets.dailyTarget)}</td>
                              </tr>
                            )}
                            {(!teamTargets || teamTargets.members.length === 0) && (
                              <tr><td colSpan="4" className="px-4 py-8 text-center text-sm text-slate-500">This team has no members yet.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        Achieved is each member's completed service charges this month, the same figure they see on their own dashboard. Members without a target are left out of the totals.
                      </p>

                      {isAdmin && (
                        <div className="mt-4 flex justify-end">
                          <button onClick={handleSaveSettings} disabled={savingSettings} className={btnPrimary}>
                            {savingSettings && <FiLoader className="h-4 w-4 animate-spin" aria-hidden="true" />}
                            {savingSettings ? "Saving" : "Save"}
                          </button>
                        </div>
                      )}
                    </Panel>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;