//Used by both admin and superadmin
import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";
import {
  FiPlus, FiDollarSign, FiCalendar, FiFileText, FiDownload, FiUser, FiCheck, FiX, FiClock,
  FiRefreshCw, FiTrash2, FiTrendingUp, FiAlertCircle, FiBarChart2, FiHome, FiSearch,
  FiEdit3, FiChevronDown,
} from "react-icons/fi";
import AdminExpenseEntry from "@/pages/reports/components/AdminExpenseEntry";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";
import { getWalletsForCentre, getWalletsByCentre } from "@/services/walletService";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);
ChartJS.defaults.color = "#64748b";

/* ---------- Helpers ---------- */
const IST = "Asia/Kolkata";

const getUserFromToken = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
};

// 'YYYY-MM-DD' in IST for any date value (a plain date string is used as it is)
const ymd = (v) => {
  if (!v) return "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-CA", { timeZone: IST });
};
const formatDate = (v) => {
  const s = ymd(v);
  if (!s) return "-";
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
};
const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(amount) || 0);
const csvCell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toList = (res, ...keys) => {
  if (Array.isArray(res)) return res;
  for (const k of ["data", ...keys]) if (Array.isArray(res?.[k])) return res[k];
  return [];
};

const PALETTE = ["#1e3a5f", "#3b5d8f", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#94a3b8"];
const PAGE_SIZE = 50;

const STATUSES = [
  { id: "pending", name: "Pending", chip: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  { id: "approved", name: "Approved", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  { id: "auto_approved", name: "Auto approved", chip: "bg-violet-50 text-violet-700 ring-violet-200", dot: "bg-violet-500" },
  { id: "paid", name: "Paid", chip: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  { id: "rejected", name: "Rejected", chip: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
];

// Metadata (same as staff)
const CATEGORIES = [
  { id: 1, name: "Salary", color: "#3B82F6", icon: "💰", requires_approval: true },
  { id: 2, name: "Salary Advance", color: "#3B82F6", icon: "💰", requires_approval: true },
  { id: 3, name: "Rent Payment", color: "#10B981", icon: "🏠", requires_approval: true },
  { id: 4, name: "Electricity Bill", color: "#EF4444", icon: "⚡", requires_approval: false },
  { id: 5, name: "Maintenance", color: "#F59E0B", icon: "🔧", requires_approval: false },
  { id: 6, name: "Ink Purchase", color: "#8B5CF6", icon: "🖨️", requires_approval: false },
  { id: 7, name: "Paper Purchase", color: "#8B5CF6", icon: "📄", requires_approval: false },
  { id: 8, name: "Internet Bill", color: "#EC4899", icon: "🌐", requires_approval: false },
  { id: 9, name: "Transportation", color: "#14B8A6", icon: "🚗", requires_approval: false },
  { id: 10, name: "Office Supplies", color: "#84CC16", icon: "📦", requires_approval: false },
  { id: 11, name: "Cleaning Supplies", color: "#84CC16", icon: "🧹", requires_approval: false },
  { id: 12, name: "Stationery", color: "#84CC16", icon: "✏️", requires_approval: false },
  { id: 13, name: "Bank / CDM Charges", color: "#64748B", icon: "🏦", requires_approval: false },
  { id: 14, name: "Other Expenses", color: "#6B7280", icon: "📝", requires_approval: false },
  { id: 15, name: "Entrepreneur Withdrawal", color: "#4F46E5", icon: "💼", requires_approval: true },
  { id: 16, name: "Shortage", color: "#EF4444", icon: "📉", requires_approval: false },
  { id: 17, name: "Daily Adjustment", color: "#F59E0B", icon: "⚖️", requires_approval: false },
  { id: 18, name: "Refreshments / Pantry", color: "#0EA5E9", icon: "💧", requires_approval: false },
  { id: 19, name: "Software Subscriptions", color: "#8B5CF6", icon: "☁️", requires_approval: false },
];

const WALLET_TYPE_META = {
  bank: { label: "Bank account", icon: "🏦" },
  cash: { label: "Cash", icon: "💰" },
  credit_card: { label: "Credit card", icon: "💳" },
  digital: { label: "Digital wallet", icon: "📱" },
  savings: { label: "Savings", icon: "🏧" },
};
const getWalletMeta = (wallet) => {
  if (!wallet) return { label: "Unknown", icon: "💼" };
  const type = wallet.type || wallet.wallet_type || "unknown";
  return WALLET_TYPE_META[type] || { label: "Wallet", icon: "💼" };
};

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-navy-500/40 disabled:bg-slate-50 disabled:text-slate-400";

/* ---------- Small components ---------- */
const StatusChip = ({ status }) => {
  const s = STATUSES.find((x) => x.id === status) || { name: status || "Unknown", chip: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.name}
    </span>
  );
};

const Card = ({ title, icon: Icon, action, children, className = "" }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}>
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {action || (Icon && <Icon className="h-4 w-4 text-slate-400" />)}
    </div>
    {children}
  </div>
);

const EmptyChart = () => <div className="flex h-full items-center justify-center text-sm text-slate-400">No data for this selection</div>;

const doughnutOptions = {
  maintainAspectRatio: false,
  cutout: "62%",
  plugins: {
    legend: { position: "bottom", labels: { boxWidth: 10, padding: 12, font: { size: 11 } } },
    tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.raw)}` } },
  },
};

const StatusChart = ({ expenses }) => {
  const rows = useMemo(() => {
    const sums = { Approved: 0, Pending: 0, Rejected: 0, Paid: 0 };
    expenses.forEach((e) => {
      const a = Number(e.amount || 0);
      if (e.status === "approved" || e.status === "auto_approved") sums.Approved += a;
      else if (e.status === "pending") sums.Pending += a;
      else if (e.status === "rejected") sums.Rejected += a;
      else if (e.status === "paid") sums.Paid += a;
    });
    return sums;
  }, [expenses]);
  const total = Object.values(rows).reduce((a, b) => a + b, 0);
  return (
    <Card title="Status overview" icon={FiAlertCircle}>
      <div className="h-56">
        {total === 0 ? <EmptyChart /> : (
          <Doughnut
            data={{ labels: Object.keys(rows), datasets: [{ data: Object.values(rows), backgroundColor: ["#10b981", "#f59e0b", "#f43f5e", "#0ea5e9"], borderWidth: 0 }] }}
            options={doughnutOptions}
          />
        )}
      </div>
    </Card>
  );
};

const DailyTrendChart = ({ expenses, month, year }) => {
  const series = useMemo(() => {
    const days = new Date(year, month, 0).getDate();
    const arr = new Array(days).fill(0);
    expenses.forEach((e) => {
      const s = ymd(e.expense_date);
      if (!s) return;
      const day = Number(s.slice(8, 10));
      if (day >= 1 && day <= days) arr[day - 1] += Number(e.amount || 0);
    });
    return arr;
  }, [expenses, month, year]);
  const total = series.reduce((a, b) => a + b, 0);
  return (
    <Card title="Daily spend this month" icon={FiTrendingUp}>
      <div className="h-56">
        {total === 0 ? <EmptyChart /> : (
          <Line
            data={{
              labels: series.map((_, i) => String(i + 1)),
              datasets: [{ label: "Expense (₹)", data: series, borderColor: "#1e3a5f", backgroundColor: "rgba(30,58,95,0.10)", tension: 0.35, fill: true, pointRadius: 2 }],
            }}
            options={{
              maintainAspectRatio: false,
              plugins: { legend: { display: false }, tooltip: { callbacks: { title: (i) => `Day ${i[0].label}`, label: (c) => ` ${formatCurrency(c.raw)}` } } },
              scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } }, y: { beginAtZero: true, ticks: { callback: (v) => (v >= 1000 ? `${v / 1000}k` : v) } } },
            }}
          />
        )}
      </div>
    </Card>
  );
};

const WalletChart = ({ expenses }) => {
  const rows = useMemo(() => {
    const map = {};
    expenses.forEach((e) => { const w = e.wallet_name || "Unknown"; map[w] = (map[w] || 0) + Number(e.amount || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);
  return (
    <Card title="By wallet" icon={FiDollarSign}>
      <div className="h-56">
        {rows.length === 0 ? <EmptyChart /> : (
          <Doughnut data={{ labels: rows.map((r) => r[0]), datasets: [{ data: rows.map((r) => r[1]), backgroundColor: PALETTE, borderWidth: 0 }] }} options={doughnutOptions} />
        )}
      </div>
    </Card>
  );
};

const ApprovalChart = ({ expenses }) => {
  const [req, auto] = useMemo(() => {
    let r = 0, a = 0;
    expenses.forEach((e) => { if (e.requires_approval) r += Number(e.amount || 0); else a += Number(e.amount || 0); });
    return [r, a];
  }, [expenses]);
  return (
    <Card title="Approval type" icon={FiCheck}>
      <div className="h-56">
        {req + auto === 0 ? <EmptyChart /> : (
          <Doughnut data={{ labels: ["Requires approval", "Auto-approved"], datasets: [{ data: [req, auto], backgroundColor: ["#f59e0b", "#10b981"], borderWidth: 0 }] }} options={doughnutOptions} />
        )}
      </div>
    </Card>
  );
};

// ranked bars with a Top 6 / Show all switch
const RankCard = ({ title, icon, rows, color }) => {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, 6);
  const max = Math.max(...rows.map((r) => r[1]), 1);
  return (
    <Card
      title={title}
      icon={icon}
      action={rows.length > 6 ? (
        <button type="button" onClick={() => setAll((v) => !v)} className="text-xs font-medium text-navy-700 hover:underline">
          {all ? "Show top 6" : `Show all (${rows.length})`}
        </button>
      ) : null}
    >
      {rows.length === 0 ? (
        <div className="h-56"><EmptyChart /></div>
      ) : (
        <ul className={`space-y-2.5 ${all ? "max-h-72 overflow-y-auto pr-1" : ""}`}>
          {shown.map(([name, value]) => (
            <li key={name}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-slate-700" title={name}>{name}</span>
                <span className="shrink-0 tabular-nums font-medium text-slate-900">{formatCurrency(value)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, backgroundColor: color }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

const Modal = ({ onClose, children, width = "max-w-md" }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }}
        className={`max-h-[90vh] w-full ${width} overflow-y-auto rounded-2xl bg-white shadow-xl`}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

/* ========== MAIN COMPONENT ========== */
const AdminExpenseManagement = () => {
  // ---- Auth & Centre ----
  const user = getUserFromToken();
  const isSuperAdmin = user?.role === "superadmin";
  const defaultCentreId = user?.centre_id ? Number(user.centre_id) : null;

  const [centres, setCentres] = useState([]);
  const [selectedCentreId, setSelectedCentreId] = useState(defaultCentreId);

  // notification deep link
  const location = useLocation();
  const [highlightedExpenseId, setHighlightedExpenseId] = useState(null);
  const handledOpenId = useRef(null);

  // ---- Data ----
  const [expenses, setExpenses] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCorrectModal, setShowCorrectModal] = useState(false);
  const [correctingExpense, setCorrectingExpense] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const reqRef = useRef(0);

  // ---- Filters ----
  const now = new Date();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedWallet, setSelectedWallet] = useState("all");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const [correctionForm, setCorrectionForm] = useState({ amount: "", wallet_id: "", reason: "" });

  const [showFutureAnalysis, setShowFutureAnalysis] = useState(false);
  const [showCharts, setShowCharts] = useState(true);

  const getCategoryById = (id) => CATEGORIES.find((c) => c.id === id);

  // ---- API helper (fetch does not throw on 4xx/5xx, so check res.ok) ----
  const api = async (path, { method = "GET", body } = {}) => {
    const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
    return data;
  };

  // ---- Centres (superadmin only) ----
  useEffect(() => {
    if (!isSuperAdmin) return;
    (async () => {
      try {
        const data = toList(await api("/api/centres"), "centres");
        setCentres(data);
        if (!selectedCentreId && data.length > 0) setSelectedCentreId(data[0].id);
      } catch {
        toast.error("Failed to load centres");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  const buildQueryString = (params = {}) => {
    const all = { ...params };
    if (isSuperAdmin && selectedCentreId) all.centreId = selectedCentreId;
    return new URLSearchParams(all).toString();
  };

  const loadAllData = async (isRefresh = false) => {
    const req = ++reqRef.current;
    if (isRefresh) setRefreshing(true);
    setLoadError(false);
    try {
      const [expRes, walletRes] = await Promise.allSettled([
        api(`/api/expense?${buildQueryString()}`),
        isSuperAdmin && selectedCentreId ? getWalletsByCentre(selectedCentreId) : getWalletsForCentre(),
      ]);
      if (req !== reqRef.current) return;
      if (expRes.status === "fulfilled") setExpenses(toList(expRes.value, "expenses"));
      else { setLoadError(true); toast.error("Failed to load expenses"); }
      if (walletRes.status === "fulfilled") setWallets(toList(walletRes.value, "wallets"));
      else toast.error("Failed to load wallets");
    } catch {
      if (req === reqRef.current) { setLoadError(true); toast.error("Network error while loading data"); }
    } finally {
      if (req === reqRef.current) { setLoading(false); setRefreshing(false); }
    }
  };

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCentreId]);

  // ---- Open a specific expense from a notification ----
  useEffect(() => {
    const targetId = location.state?.openExpenseId;
    if (!targetId || expenses.length === 0 || handledOpenId.current === String(targetId)) return;
    const target = expenses.find((e) => String(e.id) === String(targetId));
    if (!target) return;
    handledOpenId.current = String(targetId);

    // make sure the row is not hidden by the current filters
    const day = ymd(target.expense_date);
    if (day) { setSelectedYear(Number(day.slice(0, 4))); setSelectedMonth(Number(day.slice(5, 7))); }
    setSelectedCategory("all"); setSelectedStatus("all"); setSelectedWallet("all"); setSearchQuery("");
    setVisible(Infinity);
    setHighlightedExpenseId(String(targetId));

    const t1 = setTimeout(() => {
      // the list renders as cards on phones and a table on desktop; scroll to whichever is visible
      const el = [`expense-row-${targetId}`, `expense-card-${targetId}`].map((id) => document.getElementById(id)).find((x) => x && x.offsetParent !== null);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
    const t2 = setTimeout(() => setHighlightedExpenseId(null), 5000);
    window.history.replaceState({}, document.title);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [location.state, expenses]);

  // ---- Filtering ----
  const filteredExpenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return expenses.filter((expense) => {
      if (q) {
        const hit = [expense.description, expense.receipt_number, expense.category, expense.remarks, expense.wallet_name, expense.staff_name]
          .some((f) => f && String(f).toLowerCase().includes(q));
        if (!hit) return false;
      }
      if (selectedCategory !== "all" && expense.category_id !== parseInt(selectedCategory, 10)) return false;
      if (selectedStatus !== "all" && expense.status !== selectedStatus) return false;
      if (selectedWallet !== "all" && expense.wallet_id !== parseInt(selectedWallet, 10)) return false;
      if (selectedMonth && selectedYear) {
        const day = ymd(expense.expense_date);
        if (!day || Number(day.slice(5, 7)) !== selectedMonth || Number(day.slice(0, 4)) !== selectedYear) return false;
      }
      return true;
    });
  }, [expenses, searchQuery, selectedCategory, selectedStatus, selectedWallet, selectedMonth, selectedYear]);

  useEffect(() => { setVisible(PAGE_SIZE); }, [searchQuery, selectedCategory, selectedStatus, selectedWallet, selectedMonth, selectedYear, selectedCentreId]);

  // ---- Statistics ----
  const stats = useMemo(() => {
    const sum = (list) => list.reduce((s, e) => s + Number(e.amount || 0), 0);
    const pending = filteredExpenses.filter((e) => e.status === "pending");
    const approved = filteredExpenses.filter((e) => e.status === "approved" || e.status === "auto_approved");
    const staffCounts = {};
    filteredExpenses.forEach((e) => { const s = e.staff_name || "Unknown"; staffCounts[s] = (staffCounts[s] || 0) + 1; });
    const busiest = Object.entries(staffCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";
    return {
      totalAmount: sum(filteredExpenses),
      totalCount: filteredExpenses.length,
      pendingCount: pending.length,
      pendingAmount: sum(pending),
      approvedCount: approved.length,
      busiestStaff: busiest,
    };
  }, [filteredExpenses]);

  const categoryRows = useMemo(() => {
    const map = {};
    filteredExpenses.forEach((e) => { const c = e.category || "Other"; map[c] = (map[c] || 0) + Number(e.amount || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredExpenses]);
  const staffRows = useMemo(() => {
    const map = {};
    filteredExpenses.forEach((e) => { const s = e.staff_name || "Unknown"; map[s] = (map[s] || 0) + Number(e.amount || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredExpenses]);

  // ---- Future payments (latest entry of each recurring expense, next 6 occurrences) ----
  const futureProjections = useMemo(() => {
    const STEP = { monthly: (d) => d.setMonth(d.getMonth() + 1), quarterly: (d) => d.setMonth(d.getMonth() + 3), yearly: (d) => d.setFullYear(d.getFullYear() + 1) };
    // every past occurrence of a recurring expense is its own row, so keep only the newest of each
    const latest = new Map();
    expenses.forEach((e) => {
      if (!e.is_recurring || !STEP[e.recurrence_type]) return;
      const key = [e.description, e.category_id, e.amount, e.wallet_id, e.recurrence_type].join("|");
      const prev = latest.get(key);
      if (!prev || ymd(e.expense_date) > ymd(prev.expense_date)) latest.set(key, e);
    });
    const today = ymd(new Date());
    const out = [];
    latest.forEach((exp) => {
      const base = ymd(exp.expense_date);
      if (!base) return;
      const next = new Date(`${base}T00:00:00Z`);
      const step = STEP[exp.recurrence_type];
      let guard = 0;
      while (next.toISOString().slice(0, 10) <= today && guard++ < 600) step(next);
      for (let i = 0; i < 6; i++) {
        out.push({
          key: `${exp.id}-${i}`,
          description: exp.description,
          category: exp.category,
          amount: exp.amount,
          due_date: next.toISOString().slice(0, 10),
          wallet_name: exp.wallet_name,
        });
        step(next);
      }
    });
    return out.sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [expenses]);
  const futureTotal = futureProjections.reduce((s, p) => s + Number(p.amount || 0), 0);

  const walletBalances = useMemo(() => wallets.reduce((acc, w) => { acc[w.id] = Number(w.balance); return acc; }, {}), [wallets]);
  const totalBalance = wallets.reduce((s, w) => s + (Number(w.balance) || 0), 0);

  // ---- Actions ----
  const runAction = async (id, fn, okMsg, failMsg) => {
    setBusyId(id);
    try {
      await fn();
      toast.success(okMsg);
      await loadAllData(true);
    } catch (err) {
      toast.error(`${failMsg}: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  };
  const handleApprove = (id) => runAction(id, () => api(`/api/expense/${id}/approve`, { method: "PUT" }), "Expense approved", "Approval failed");
  const handleReject = (id) => runAction(id, () => api(`/api/expense/${id}/reject`, { method: "PUT" }), "Expense rejected", "Rejection failed");
  const confirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (target) await runAction(target.id, () => api(`/api/expense/${target.id}`, { method: "DELETE" }), "Expense deleted", "Delete failed");
  };

  const openCorrectModal = (expense) => {
    setCorrectingExpense(expense);
    setCorrectionForm({ amount: String(expense.amount ?? ""), wallet_id: expense.wallet_id != null ? String(expense.wallet_id) : "", reason: "" });
    setShowCorrectModal(true);
  };

  const handleCorrectExpense = async (e) => {
    e.preventDefault();
    if (!correctionForm.amount || Number(correctionForm.amount) <= 0 || !correctionForm.wallet_id) {
      toast.error("Enter an amount greater than 0 and select a wallet");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/expense/${correctingExpense.id}/correct`, {
        method: "PUT",
        body: {
          amount: Number(correctionForm.amount),
          wallet_id: Number(correctionForm.wallet_id),
          reason: correctionForm.reason || "Admin correction",
        },
      });
      toast.success("Expense corrected");
      setShowCorrectModal(false);
      await loadAllData(true);
    } catch (err) {
      toast.error(`Correction failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddExpenseSubmit = async (payload) => {
    setSaving(true);
    try {
      await api(`/api/expense?${buildQueryString()}`, { method: "POST", body: payload });
      toast.success("Expense created");
      setShowAddModal(false);
      await loadAllData(true);
    } catch (err) {
      toast.error(`Creation failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const exportToCSV = () => {
    if (filteredExpenses.length === 0) { toast.info("Nothing to export for this selection"); return; }
    const rows = [
      ["Date", "Category", "Description", "Amount", "Wallet", "Status", "Staff", "Receipt", "Remarks"],
      ...filteredExpenses.map((e) => [ymd(e.expense_date), e.category, e.description, e.amount, e.wallet_name, e.status, e.staff_name, e.receipt_number, e.remarks]),
    ];
    const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses_${selectedYear}_${String(selectedMonth).padStart(2, "0")}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredExpenses.length} entries`);
  };

  const resetFilters = () => {
    setSearchQuery(""); setSelectedCategory("all"); setSelectedStatus("all"); setSelectedWallet("all");
    setSelectedMonth(now.getMonth() + 1); setSelectedYear(now.getFullYear());
  };

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const years = useMemo(() => {
    const y = new Date().getFullYear();
    const list = Array.from({ length: 5 }, (_, i) => y - i);
    if (!list.includes(selectedYear)) list.push(selectedYear);
    return list.sort((a, b) => b - a);
  }, [selectedYear]);

  const tiles = [
    { label: "Total expenses", value: formatCurrency(stats.totalAmount), sub: `${stats.totalCount} entries`, icon: FiDollarSign, tone: "bg-navy-700/10 text-navy-700" },
    { label: "Pending approval", value: stats.pendingCount, sub: `${formatCurrency(stats.pendingAmount)} pending`, icon: FiClock, tone: "bg-amber-50 text-amber-600" },
    { label: "Approved / auto", value: stats.approvedCount, sub: `Top: ${categoryRows[0]?.[0] || "—"}`, icon: FiCheck, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Future recurring", value: formatCurrency(futureTotal), sub: futureProjections.length ? "View projections" : "None defined", icon: FiTrendingUp, tone: "bg-violet-50 text-violet-600", onClick: () => setShowFutureAnalysis((v) => !v) },
  ];

  const filtersActive = searchQuery || selectedCategory !== "all" || selectedStatus !== "all" || selectedWallet !== "all"
    || selectedMonth !== now.getMonth() + 1 || selectedYear !== now.getFullYear();
  const shownExpenses = filteredExpenses.slice(0, visible);

  const renderActions = (expense) => {
    const busy = busyId === expense.id;
    const pending = expense.status === "pending";
    const btn = "rounded-lg p-2 transition disabled:opacity-40";
    return (
      <div className="flex items-center gap-1">
        {pending && (
          <>
            <button type="button" disabled={busy} onClick={() => handleApprove(expense.id)} className={`${btn} text-emerald-600 hover:bg-emerald-50`} title="Approve" aria-label="Approve"><FiCheck className="h-[18px] w-[18px]" /></button>
            <button type="button" disabled={busy} onClick={() => handleReject(expense.id)} className={`${btn} text-rose-600 hover:bg-rose-50`} title="Reject" aria-label="Reject"><FiX className="h-[18px] w-[18px]" /></button>
            <button type="button" disabled={busy} onClick={() => setDeleteTarget(expense)} className={`${btn} text-slate-500 hover:bg-slate-100`} title="Delete" aria-label="Delete"><FiTrash2 className="h-[18px] w-[18px]" /></button>
          </>
        )}
        {!pending && (
          <button type="button" disabled={busy} onClick={() => openCorrectModal(expense)} className={`${btn} text-navy-700 hover:bg-slate-100`} title="Correct" aria-label="Correct"><FiEdit3 className="h-[18px] w-[18px]" /></button>
        )}
      </div>
    );
  };

  const renderDetails = (expense) => {
    const category = getCategoryById(expense.category_id);
    return (
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg">{category?.icon || "📝"}</span>
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900" title={expense.description}>{expense.description}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><FiCalendar className="h-3 w-3" />{formatDate(expense.expense_date)}</span>
            <span className="rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: `${category?.color || "#6B7280"}1f`, color: category?.color || "#6B7280" }}>{expense.category}</span>
            {expense.receipt_number && <span>#{expense.receipt_number}</span>}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
        <div className="mx-auto max-w-7xl animate-pulse space-y-4">
          <div className="h-10 w-72 rounded-lg bg-white" />
          <div className="h-28 rounded-2xl bg-white" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-white" />)}</div>
          <div className="h-80 rounded-2xl bg-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Expense Manager</h1>
            <p className="mt-1 text-sm text-slate-500">Oversight, corrections, analytics and upcoming payments</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isSuperAdmin && (
              <div className="relative">
                <FiHome className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={selectedCentreId || ""} onChange={(e) => setSelectedCentreId(Number(e.target.value))} aria-label="Centre"
                  className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-500/40"
                >
                  {centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <button type="button" onClick={() => loadAllData(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-navy-700 hover:bg-slate-50 disabled:opacity-60">
              <FiRefreshCw className={refreshing ? "animate-spin" : ""} /> Refresh
            </button>
            <button type="button" onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-navy-800">
              <FiPlus /> Add expense
            </button>
          </div>
        </div>

        {loadError && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span className="flex items-center gap-2"><FiAlertCircle className="h-4 w-4" /> Could not load expenses.</span>
            <button type="button" onClick={() => loadAllData(true)} className="font-medium underline">Retry</button>
          </div>
        )}

        {/* Wallets */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">Wallet balances</h2>
            {wallets.length > 0 && <p className="text-sm text-slate-500">Total <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(totalBalance)}</span></p>}
          </div>
          {wallets.length === 0 ? (
            <p className="text-sm text-slate-400">No wallets found for this centre.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {wallets.map((wallet) => {
                const meta = getWalletMeta(wallet);
                const low = Number(wallet.balance) < 0;
                return (
                  <div key={wallet.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{meta.icon}</span>
                      <span className="truncate text-sm font-medium text-slate-800" title={wallet.name}>{wallet.name}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{meta.label}</p>
                    <p className={`mt-1.5 text-lg font-bold tabular-nums ${low ? "text-rose-600" : "text-slate-900"}`}>{formatCurrency(walletBalances[wallet.id])}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((t) => {
            const Tag = t.onClick ? "button" : "div";
            return (
              <Tag key={t.label} type={t.onClick ? "button" : undefined} onClick={t.onClick} className={`flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left ${t.onClick ? "hover:bg-slate-50" : ""}`}>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${t.tone}`}><t.icon className="h-5 w-5" /></span>
                <span className="min-w-0">
                  <span className="block truncate text-xs text-slate-500">{t.label}</span>
                  <span className="block truncate text-xl font-bold tabular-nums text-slate-900">{t.value}</span>
                  <span className="block truncate text-xs text-slate-400">{t.sub}</span>
                </span>
              </Tag>
            );
          })}
        </div>

        {/* Future payments */}
        <AnimatePresence>
          {showFutureAnalysis && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><FiTrendingUp className="h-4 w-4 text-violet-600" /> Projected recurring payments (next 6 occurrences)</h2>
                <button type="button" onClick={() => setShowFutureAnalysis(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close"><FiX className="h-4 w-4" /></button>
              </div>
              {futureProjections.length === 0 ? (
                <p className="text-sm text-slate-500">No recurring expenses defined.</p>
              ) : (
                <div className="max-h-80 overflow-auto rounded-xl border border-slate-100">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      <tr><th className="px-4 py-2.5">Due</th><th className="px-4 py-2.5">Description</th><th className="px-4 py-2.5">Category</th><th className="px-4 py-2.5 text-right">Amount</th><th className="px-4 py-2.5">Wallet</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {futureProjections.map((p) => (
                        <tr key={p.key} className="hover:bg-slate-50/70">
                          <td className="whitespace-nowrap px-4 py-2.5">{formatDate(p.due_date)}</td>
                          <td className="px-4 py-2.5">{p.description}</td>
                          <td className="px-4 py-2.5 text-slate-500">{p.category}</td>
                          <td className="px-4 py-2.5 text-right font-medium tabular-nums">{formatCurrency(p.amount)}</td>
                          <td className="px-4 py-2.5 text-slate-500">{p.wallet_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 text-right text-sm font-semibold text-slate-700">Total projected outflow: {formatCurrency(futureTotal)}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Insights / charts */}
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-slate-500">Showing <span className="font-medium text-slate-700">{months[selectedMonth - 1]} {selectedYear}</span>{stats.totalCount > 0 && <> · busiest staff <span className="font-medium text-slate-700">{stats.busiestStaff}</span></>}</p>
          <button type="button" onClick={() => setShowCharts((v) => !v)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-navy-700 hover:bg-slate-50">
            <FiBarChart2 /> {showCharts ? "Hide charts" : "Show charts"}
          </button>
        </div>
        <AnimatePresence>
          {showCharts && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <StatusChart expenses={filteredExpenses} />
                <DailyTrendChart expenses={filteredExpenses} month={selectedMonth} year={selectedYear} />
                <WalletChart expenses={filteredExpenses} />
                <RankCard title="By category" icon={FiBarChart2} rows={categoryRows} color="#1e3a5f" />
                <RankCard title="Staff expense volume" icon={FiUser} rows={staffRows} color="#8b5cf6" />
                <ApprovalChart expenses={filteredExpenses} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-12">
            <select className={`${inputCls} lg:col-span-2`} value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))} aria-label="Month">
              {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select className={`${inputCls} lg:col-span-1`} value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))} aria-label="Year">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className={`${inputCls} lg:col-span-3`} value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} aria-label="Category">
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={`${inputCls} lg:col-span-3`} value={selectedWallet} onChange={(e) => setSelectedWallet(e.target.value)} aria-label="Wallet">
              <option value="all">All wallets</option>
              {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select className={`${inputCls} col-span-2 lg:col-span-3`} value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} aria-label="Status">
              <option value="all">All status</option>
              {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search description, receipt, remarks, staff…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`${inputCls} pl-9`} aria-label="Search expenses" />
            </div>
            {filtersActive && (
              <button type="button" onClick={resetFilters} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"><FiRefreshCw className="h-4 w-4" /> Reset</button>
            )}
            <button type="button" onClick={exportToCSV} className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-navy-800">
              <FiDownload className="h-4 w-4" /> Export CSV
            </button>
          </div>
        </div>

        {/* Entries */}
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-sm font-semibold text-slate-800">Expense entries</h2>
          <span className="text-sm text-slate-500">Showing {Math.min(shownExpenses.length, filteredExpenses.length)} of {filteredExpenses.length} · {expenses.length} in total</span>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
            <FiFileText className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-3 text-sm font-semibold text-slate-800">No expenses found</h3>
            <p className="mt-1 text-sm text-slate-500">Try adjusting your filters or add a new expense.</p>
          </div>
        ) : (
          <>
            {/* phones: cards */}
            <div className="space-y-3 md:hidden">
              {shownExpenses.map((expense) => {
                const wallet = wallets.find((w) => w.id === expense.wallet_id);
                return (
                  <div key={expense.id} id={`expense-card-${expense.id}`} className={`rounded-2xl border bg-white p-4 transition-colors duration-700 ${highlightedExpenseId === String(expense.id) ? "border-navy-500 bg-indigo-50" : "border-slate-200"}`}>
                    <div className="flex items-start justify-between gap-2">
                      {renderDetails(expense)}
                      <p className="shrink-0 text-lg font-bold tabular-nums text-slate-900">{formatCurrency(expense.amount)}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusChip status={expense.status} />
                        <span className="text-xs text-slate-500">{getWalletMeta(wallet).icon} {expense.wallet_name}</span>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500"><FiUser className="h-3 w-3" />{expense.staff_name || "N/A"}</span>
                      </div>
                      {renderActions(expense)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* desktop: table */}
            <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
              <table className="w-full">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Date & details</th>
                    <th className="px-4 py-3">Amount & wallet</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Staff</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shownExpenses.map((expense) => {
                    const wallet = wallets.find((w) => w.id === expense.wallet_id);
                    return (
                      <tr key={expense.id} id={`expense-row-${expense.id}`} className={`align-top transition-colors duration-700 ${highlightedExpenseId === String(expense.id) ? "border-l-4 border-navy-500 bg-indigo-50" : "hover:bg-slate-50/70"}`}>
                        <td className="max-w-xs px-4 py-3.5">{renderDetails(expense)}</td>
                        <td className="px-4 py-3.5">
                          <p className="text-lg font-bold tabular-nums text-slate-900">{formatCurrency(expense.amount)}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{getWalletMeta(wallet).icon} {expense.wallet_name}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusChip status={expense.status} />
                          {expense.requires_approval && <p className="mt-1.5 text-xs text-amber-600">Requires approval</p>}
                        </td>
                        <td className="px-4 py-3.5"><span className="inline-flex items-center gap-1.5 text-sm text-slate-700"><FiUser className="h-4 w-4 text-slate-400" />{expense.staff_name || "N/A"}</span></td>
                        <td className="px-4 py-3.5">{renderActions(expense)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredExpenses.length > shownExpenses.length && (
              <div className="mt-4 text-center">
                <button type="button" onClick={() => setVisible((v) => v + PAGE_SIZE)} className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Show {Math.min(PAGE_SIZE, filteredExpenses.length - shownExpenses.length)} more
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Expense Modal */}
      <AnimatePresence>
        {showAddModal && (
          <Modal onClose={() => setShowAddModal(false)} width="max-w-2xl">
            <AdminExpenseEntry
              title="Add New Expense"
              submitButtonText="Create Expense"
              wallets={wallets}
              categories={CATEGORIES}
              onSubmit={handleAddExpenseSubmit}
              onCancel={() => setShowAddModal(false)}
              isLoading={saving}
            />
          </Modal>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {deleteTarget && (
          <Modal onClose={() => setDeleteTarget(null)} width="max-w-sm">
            <div className="p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600"><FiTrash2 className="h-5 w-5" /></span>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">Delete this expense?</h2>
              <p className="mt-1 text-sm text-slate-500">{deleteTarget.description} · {formatCurrency(deleteTarget.amount)}. Only pending expenses can be deleted. This cannot be undone.</p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="button" onClick={confirmDelete} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">Delete</button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Correction Modal */}
      <AnimatePresence>
        {showCorrectModal && correctingExpense && (
          <Modal onClose={() => setShowCorrectModal(false)}>
            <div className="border-b border-slate-100 p-6">
              <h2 className="text-lg font-semibold text-slate-900">Correct expense</h2>
              <p className="mt-1 text-sm text-slate-500">
                Original: {correctingExpense.description} · {formatCurrency(correctingExpense.amount)} on {formatDate(correctingExpense.expense_date)}
              </p>
            </div>
            <form onSubmit={handleCorrectExpense} className="space-y-4 p-6">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">New amount (₹) *</span>
                <input type="number" value={correctionForm.amount} onChange={(e) => setCorrectionForm((p) => ({ ...p, amount: e.target.value }))} className={inputCls} required min="0.01" step="0.01" />
              </label>
              <div className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">New wallet *</span>
                <div className="max-h-44 space-y-2 overflow-y-auto">
                  {wallets.map((wallet) => {
                    const on = correctionForm.wallet_id === String(wallet.id);
                    return (
                      <label key={wallet.id} className={`flex cursor-pointer items-center justify-between rounded-xl border-2 p-3 transition ${on ? "border-navy-500 bg-slate-50" : "border-slate-200 hover:border-slate-300"}`}>
                        <span className="flex items-center gap-2">
                          <input type="radio" name="correction_wallet" value={String(wallet.id)} checked={on} onChange={(e) => setCorrectionForm((p) => ({ ...p, wallet_id: e.target.value }))} className="sr-only" required />
                          <span className="text-xl">{getWalletMeta(wallet).icon}</span>
                          <span>
                            <span className="block text-sm font-medium text-slate-900">{wallet.name}</span>
                            <span className="block text-xs text-slate-500">{getWalletMeta(wallet).label}</span>
                          </span>
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-slate-700">{formatCurrency(walletBalances[wallet.id])}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Reason for correction</span>
                <textarea value={correctionForm.reason} onChange={(e) => setCorrectionForm((p) => ({ ...p, reason: e.target.value }))} className={inputCls} rows="3" placeholder="Explain why…" />
              </label>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setShowCorrectModal(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-60">
                  <FiRefreshCw className="h-4 w-4" /> {saving ? "Saving…" : "Submit correction"}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminExpenseManagement;