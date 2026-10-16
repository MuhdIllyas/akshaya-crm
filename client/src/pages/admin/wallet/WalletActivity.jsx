import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FiArrowLeft, FiDownload, FiSearch, FiRefreshCw, FiX, FiPlus, FiArrowDownLeft, FiArrowUpRight,
  FiChevronUp, FiChevronDown, FiChevronLeft, FiChevronRight, FiCreditCard, FiDollarSign,
  FiSmartphone, FiHome, FiBriefcase, FiActivity, FiTrendingUp, FiTrendingDown, FiUser, FiList,
} from "react-icons/fi";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { format, isValid, subDays, startOfDay, endOfDay } from "date-fns";
import {
  getWalletTransactions,
  getStaff,
  rechargeWallet,
  getWalletById,
  getWalletTodayBalance,
} from "@/services/walletService";

/* ───────────── constants & helpers ───────────── */
const WALLET_TYPES = {
  bank: { name: "Bank Account", icon: FiHome, tone: "bg-blue-50 text-blue-600 border-blue-100" },
  cash: { name: "Cash", icon: FiDollarSign, tone: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  card: { name: "Credit Card", icon: FiCreditCard, tone: "bg-purple-50 text-purple-600 border-purple-100" },
  digital: { name: "Digital Wallet", icon: FiSmartphone, tone: "bg-amber-50 text-amber-600 border-amber-100" },
  savings: { name: "Savings", icon: FiBriefcase, tone: "bg-rose-50 text-rose-600 border-rose-100" },
};
const CATEGORY_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#84cc16", "#64748b", "#f97316"];
const COLOR_IN = "#10b981";
const COLOR_OUT = "#ef4444";
const COLOR_NET = "#2563eb";

const PERIODS = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["week", "7 days"],
  ["month", "30 days"],
  ["quarter", "90 days"],
  ["year", "1 year"],
  ["all", "All"],
  ["custom", "Custom"],
];
const PER_PAGE = 10;

const formatAmount = (amount) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount) || 0);
const compactAmount = (v) => {
  const a = Math.abs(v);
  if (a >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (a >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (a >= 1000) return `₹${Math.round(v / 1000)}K`;
  return `₹${Math.round(v)}`;
};
const fmt = (d, f = "dd MMM yyyy") => {
  const date = d instanceof Date ? d : new Date(d);
  return isValid(date) ? format(date, f) : "—";
};
// "yyyy-MM-dd" from a date input -> local date (no UTC shift)
const parseInputDate = (v) => {
  const [y, m, d] = String(v).split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const rangeFor = (period, custom) => {
  const now = new Date();
  switch (period) {
    case "today": return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday": return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) };
    case "week": return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "month": return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case "quarter": return { start: startOfDay(subDays(now, 89)), end: endOfDay(now) };
    case "year": return { start: startOfDay(subDays(now, 364)), end: endOfDay(now) };
    case "custom": return { start: startOfDay(custom.start), end: endOfDay(custom.end) };
    default: return { start: null, end: null };
  }
};

const Card = ({ title, action, children, className = "" }) => (
  <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm ${className}`}>
    {(title || action) && (
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        {title && <h3 className="text-sm font-semibold text-gray-900">{title}</h3>}
        {action}
      </div>
    )}
    {children}
  </div>
);

const Stat = ({ label, value, sub, icon: Icon, tone, valueCls = "text-gray-900" }) => (
  <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone}`}>
        <Icon size={15} />
      </div>
    </div>
    <p className={`text-xl font-bold mt-2 truncate ${valueCls}`}>{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
  </div>
);

/* ───────────── page ───────────── */
const WalletActivity = () => {
  const { walletId } = useParams();
  const navigate = useNavigate();

  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [todayBalance, setTodayBalance] = useState(null);
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [period, setPeriod] = useState("month");
  const [customRange, setCustomRange] = useState({ start: subDays(new Date(), 30), end: new Date() });
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ key: "date", dir: "desc" });
  const [page, setPage] = useState(1);
  const [chartType, setChartType] = useState("bar");
  const [selected, setSelected] = useState(null);
  const [recharge, setRecharge] = useState(null); // { amount, description }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  /* ---------- data ---------- */
  const fetchData = useCallback(async () => {
    if (!walletId || isNaN(walletId)) {
      setError("Invalid or missing wallet ID");
      return;
    }
    setError(null);
    try {
      const [walletRes, txRes, staffRes, todayRes] = await Promise.all([
        getWalletById(walletId),
        getWalletTransactions(walletId, 100, 0),
        getStaff().catch(() => []),
        getWalletTodayBalance(walletId).catch(() => null),
      ]);
      const w = walletRes.data || {};
      if (!w.id) throw new Error("Wallet data is incomplete");

      setWallet({
        id: w.id,
        name: w.name || `Wallet ${walletId}`,
        balance: Number(w.balance) || 0,
        type: w.wallet_type || "bank",
        isShared: !!w.is_shared,
        status: w.status || "online",
        updatedAt: w.updated_at,
      });
      setTodayBalance(todayRes);
      setStaffMembers(Array.isArray(staffRes) ? staffRes : []);
      setTransactions(
        (Array.isArray(txRes.data) ? txRes.data : []).map((t, i) => ({
          id: t.id ?? `tmp-${i}`,
          date: t.created_at,
          description: t.description || "No description",
          type: t.type === "credit" ? "credit" : "debit",
          amount: Math.abs(Number(t.amount) || 0), // always positive; use .type for direction
          category:
            t.category ||
            (/^initial balance/i.test(t.description || "") ? "Opening Balance"
              : /^transfer/i.test(t.description || "") ? "Transfer"
              : "Uncategorised"),
          staffId: t.staff_id != null ? String(t.staff_id) : null,
          staffName: t.staff_name || null,
        }))
      );
    } catch (err) {
      console.error("WalletActivity fetch error:", err);
      if (err.response?.status === 401) return navigate("/login");
      setError(err.response?.status === 404 ? "Wallet not found" : `Failed to load: ${err.message}`);
    }
  }, [walletId, navigate]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    })();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  /* ---------- lookups ---------- */
  const staffById = useMemo(() => {
    const m = {};
    staffMembers.forEach((s) => (m[String(s.id)] = s));
    return m;
  }, [staffMembers]);
  const staffName = useCallback((t) => (t.staffId ? staffById[t.staffId]?.name || t.staffName || `Staff #${t.staffId}` : "System"), [staffById]);

  const categories = useMemo(() => [...new Set(transactions.map((t) => t.category))].sort(), [transactions]);
  const colorFor = useCallback((cat) => CATEGORY_COLORS[Math.max(0, categories.indexOf(cat)) % CATEGORY_COLORS.length], [categories]);

  /* ---------- filtering ---------- */
  const range = rangeFor(period, customRange);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return transactions.filter((t) => {
      const d = new Date(t.date);
      if (range.start && (d < range.start || d > range.end)) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (q && ![t.description, t.category, staffName(t)].some((f) => String(f).toLowerCase().includes(q))) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, range.start?.getTime(), range.end?.getTime(), typeFilter, categoryFilter, search, staffName]);

  useEffect(() => setPage(1), [filtered.length, sort]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    items.sort((a, b) => {
      let c = 0;
      if (sort.key === "date") c = new Date(a.date) - new Date(b.date);
      else if (sort.key === "amount") c = a.amount - b.amount;
      return sort.dir === "asc" ? c : -c;
    });
    return items;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const pageStart = (page - 1) * PER_PAGE;
  const pageItems = sorted.slice(pageStart, pageStart + PER_PAGE);

  /* ---------- stats ---------- */
  const stats = useMemo(() => {
    let moneyIn = 0, moneyOut = 0, inCount = 0, outCount = 0, largest = null;
    const byStaff = {};
    filtered.forEach((t) => {
      if (t.type === "credit") { moneyIn += t.amount; inCount++; } else { moneyOut += t.amount; outCount++; }
      if (!largest || t.amount > largest.amount) largest = t;
      if (t.staffId) byStaff[t.staffId] = (byStaff[t.staffId] || 0) + 1;
    });
    const topStaffId = Object.keys(byStaff).sort((a, b) => byStaff[b] - byStaff[a])[0];
    return { moneyIn, moneyOut, inCount, outCount, net: moneyIn - moneyOut, largest, topStaffId, topStaffCount: byStaff[topStaffId] || 0 };
  }, [filtered]);

  // Previous period of the same length, for comparison
  const comparison = useMemo(() => {
    if (!range.start) return null;
    const len = range.end - range.start;
    const prevStart = new Date(range.start.getTime() - len - 1);
    const prevEnd = new Date(range.start.getTime() - 1);
    let pin = 0, pout = 0;
    transactions.forEach((t) => {
      const d = new Date(t.date);
      if (d >= prevStart && d <= prevEnd) t.type === "credit" ? (pin += t.amount) : (pout += t.amount);
    });
    const days = Math.max(1, Math.round(len / 86400000));
    return { inChange: stats.moneyIn - pin, outChange: stats.moneyOut - pout, perDay: filtered.length / days, outPerDay: stats.moneyOut / days };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, range.start?.getTime(), range.end?.getTime(), stats, filtered.length]);

  /* ---------- charts ---------- */
  const flowData = useMemo(() => {
    // Daily buckets for short ranges, monthly otherwise
    const daily = period === "today" || period === "yesterday" || period === "week" || period === "month" ||
      (period === "custom" && range.end - range.start <= 62 * 86400000);
    const buckets = {};
    filtered.forEach((t) => {
      const d = new Date(t.date);
      const key = daily ? format(d, "yyyy-MM-dd") : format(d, "yyyy-MM");
      if (!buckets[key]) buckets[key] = { key, name: daily ? format(d, "dd MMM") : format(d, "MMM yy"), in: 0, out: 0 };
      t.type === "credit" ? (buckets[key].in += t.amount) : (buckets[key].out += t.amount);
    });
    return Object.values(buckets).sort((a, b) => a.key.localeCompare(b.key)).map((b) => ({ ...b, net: b.in - b.out }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, period, range.start?.getTime(), range.end?.getTime()]);

  const categoryData = useMemo(() => {
    const totals = {};
    filtered.forEach((t) => {
      if (!totals[t.category]) totals[t.category] = { name: t.category, value: 0, count: 0 };
      totals[t.category].value += t.amount;
      totals[t.category].count++;
    });
    return Object.values(totals).sort((a, b) => b.value - a.value);
  }, [filtered]);
  const categoryTotal = categoryData.reduce((s, c) => s + c.value, 0);

  /* ---------- actions ---------- */
  const resetFilters = () => {
    setPeriod("month");
    setTypeFilter("all");
    setCategoryFilter("all");
    setSearchInput("");
  };
  const hasFilters = period !== "month" || typeFilter !== "all" || categoryFilter !== "all" || searchInput;

  const toggleSort = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));

  const exportCsv = () => {
    if (!sorted.length) return toast.info("Nothing to export");
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Date", "Time", "Description", "Category", "Type", "Amount", "Staff"].map(esc).join(","),
      ...sorted.map((t) =>
        [fmt(t.date, "dd-MM-yyyy"), fmt(t.date, "HH:mm"), t.description, t.category, t.type === "credit" ? "Credit" : "Debit", t.type === "credit" ? t.amount : -t.amount, staffName(t)]
          .map(esc).join(",")
      ),
    ];
    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(wallet?.name || "wallet").replace(/\s+/g, "-")}-transactions-${fmt(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doRecharge = async () => {
    const amount = Number(recharge.amount);
    if (!amount || amount <= 0) return toast.error("Enter a valid amount.");
    setBusy(true);
    try {
      const id = localStorage.getItem("id");
      await rechargeWallet({
        wallet_id: walletId,
        amount,
        description: recharge.description.trim() || "Wallet Recharge",
        category: "Recharge",
        staff_id: id ? parseInt(id, 10) : null,
      });
      toast.success(`${formatAmount(amount)} added to ${wallet.name}`);
      setRecharge(null);
      await fetchData();
    } catch (err) {
      console.error("Recharge failed:", err);
      toast.error(err.response?.data?.error || "Recharge failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const highlight = (text) => {
    if (!search || !text) return text;
    const parts = String(text).split(new RegExp(`(${escapeRegExp(search)})`, "gi"));
    return parts.map((p, i) => (p.toLowerCase() === search.toLowerCase() ? <mark key={i} className="bg-yellow-100 rounded px-0.5">{p}</mark> : p));
  };

  /* ---------- states ---------- */
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-navy-700 mx-auto" />
          <p className="mt-3 text-sm text-gray-500">Loading wallet activity…</p>
        </div>
      </div>
    );
  }

  if (error || !wallet) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
            <FiX size={24} />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">{error === "Wallet not found" ? "Wallet not found" : "Couldn't load wallet"}</h2>
          <p className="text-sm text-gray-500 mb-5">{error || "This wallet doesn't exist or has been removed."}</p>
          <div className="flex justify-center gap-3">
            <button onClick={handleRefresh} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-navy-700 hover:bg-navy-800">
              <FiRefreshCw size={15} /> Retry
            </button>
            <Link to="/dashboard/admin/wallets" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50">
              <FiArrowLeft size={15} /> Back to Wallets
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const type = WALLET_TYPES[wallet.type] || { name: "Wallet", icon: FiCreditCard, tone: "bg-gray-50 text-gray-600 border-gray-100" };
  const TYPE_COLOR = { bank: "#2563eb", cash: "#059669", card: "#9333ea", digital: "#ea580c", savings: "#e11d48" };
  const accent = TYPE_COLOR[wallet.type] || "#64748b";
  const TypeIcon = type.icon;
  const online = wallet.status === "online";
  const topStaff = stats.topStaffId ? staffById[stats.topStaffId] : null;
  const rangeLabel = range.start ? `${fmt(range.start, "dd MMM")} – ${fmt(range.end, "dd MMM yyyy")}` : "All time";
  const tooltipFmt = (v, name) => [formatAmount(v), name];

  const Change = ({ value, goodWhenUp = true }) => {
    if (!value) return <span className="text-gray-400">No change</span>;
    const up = value > 0;
    const good = up === goodWhenUp;
    const Icon = up ? FiTrendingUp : FiTrendingDown;
    return (
      <span className={`inline-flex items-center gap-1 font-medium ${good ? "text-emerald-600" : "text-red-600"}`}>
        <Icon size={14} /> {up ? "+" : "−"}{formatAmount(Math.abs(value))}
      </span>
    );
  };

  const SortIcon = ({ k }) => (sort.key === k ? (sort.dir === "asc" ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />) : null);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/dashboard/admin/wallets" className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 shrink-0" title="Back to wallets">
              <FiArrowLeft size={20} />
            </Link>
            <div
              className="w-12 h-12 rounded-xl border flex items-center justify-center shrink-0"
              style={{ background: `${accent}1A`, borderColor: `${accent}33`, color: accent }}
            >
              <TypeIcon size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">{wallet.name}</h1>
              <p className="text-sm text-gray-500 flex flex-wrap items-center gap-x-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-gray-400"}`} />
                  {online ? "Online" : "Offline"}
                </span>
                <span className="text-gray-300">·</span>
                {type.name}
                <span className="text-gray-300">·</span>
                {wallet.isShared ? "Shared" : "Personal"}
                <span className="text-gray-300">·</span>
                #{wallet.id}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleRefresh} disabled={refreshing} className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 bg-white rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
              <FiRefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Refresh
            </button>
            <button onClick={exportCsv} className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 bg-white rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
              <FiDownload size={15} /> Export
            </button>
            <button onClick={() => setRecharge({ amount: "", description: "" })} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-navy-700 hover:bg-navy-800 shadow-sm">
              <FiPlus size={16} /> Add Money
            </button>
          </div>
        </div>

        {/* Balance strip */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4" style={{ borderTop: `3px solid ${accent}` }}>
          <div className="col-span-2 md:col-span-1">
            <p className="text-sm text-gray-500">Current balance</p>
            <p className="text-3xl font-bold text-gray-900">{formatAmount(wallet.balance)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Today opening</p>
            <p className="text-lg font-semibold text-gray-800">{todayBalance?.opening_balance != null ? formatAmount(todayBalance.opening_balance) : "—"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Today closing</p>
            <p className="text-lg font-semibold text-gray-800">{todayBalance?.closing_balance != null ? formatAmount(todayBalance.closing_balance) : "—"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Last activity</p>
            <p className="text-lg font-semibold text-gray-800">{transactions[0]?.date ? fmt(transactions.reduce((m, t) => (new Date(t.date) > new Date(m) ? t.date : m), transactions[0].date), "dd MMM, hh:mm a") : "—"}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6 space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
              <input
                type="text"
                placeholder="Search description, category or staff…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              {searchInput && (
                <button onClick={() => setSearchInput("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <FiX size={16} />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="all">Money in & out</option>
                <option value="credit">Money in only</option>
                <option value="debit">Money out only</option>
              </select>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="all">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap bg-gray-100 rounded-xl p-1">
              {PERIODS.map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setPeriod(val)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${period === val ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {period === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={fmt(customRange.start, "yyyy-MM-dd")}
                  max={fmt(customRange.end, "yyyy-MM-dd")}
                  onChange={(e) => { const d = parseInputDate(e.target.value); if (d) setCustomRange((r) => ({ ...r, start: d })); }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <span className="text-gray-400 text-sm">to</span>
                <input
                  type="date"
                  value={fmt(customRange.end, "yyyy-MM-dd")}
                  min={fmt(customRange.start, "yyyy-MM-dd")}
                  onChange={(e) => { const d = parseInputDate(e.target.value); if (d) setCustomRange((r) => ({ ...r, end: d })); }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            )}
            <span className="text-sm text-gray-500 ml-auto">{rangeLabel}</span>
            {hasFilters && (
              <button onClick={resetFilters} className="text-sm font-medium text-blue-600 hover:text-blue-800">Reset</button>
            )}
          </div>
          {transactions.length >= 100 && (
            <p className="text-xs text-gray-400">Showing the latest 100 transactions for this wallet.</p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Stat label="Money in" value={formatAmount(stats.moneyIn)} sub={`${stats.inCount} transaction${stats.inCount === 1 ? "" : "s"}`} icon={FiArrowDownLeft} tone="bg-emerald-50 text-emerald-600" valueCls="text-emerald-600" />
          <Stat label="Money out" value={formatAmount(stats.moneyOut)} sub={`${stats.outCount} transaction${stats.outCount === 1 ? "" : "s"}`} icon={FiArrowUpRight} tone="bg-red-50 text-red-600" valueCls="text-red-600" />
          <Stat label="Net flow" value={`${stats.net < 0 ? "−" : ""}${formatAmount(Math.abs(stats.net))}`} sub={rangeLabel} icon={FiActivity} tone="bg-blue-50 text-blue-600" valueCls={stats.net < 0 ? "text-red-600" : "text-gray-900"} />
          <Stat label="Transactions" value={filtered.length} sub={comparison ? `${comparison.perDay.toFixed(1)} per day` : "All time"} icon={FiList} tone="bg-gray-100 text-gray-600" />
          <Stat
            label="Most active"
            value={topStaff?.name || (stats.topStaffId ? `Staff #${stats.topStaffId}` : "—")}
            sub={stats.topStaffId ? `${stats.topStaffCount} transactions` : "No staff activity"}
            icon={FiUser}
            tone="bg-purple-50 text-purple-600"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          <Card
            className="lg:col-span-2"
            title="Money in vs out"
            action={
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                {[["bar", "Bars"], ["line", "Lines"]].map(([v, l]) => (
                  <button key={v} onClick={() => setChartType(v)} className={`px-2.5 py-1 rounded-md text-xs font-medium ${chartType === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
                    {l}
                  </button>
                ))}
              </div>
            }
          >
            <div className="h-72 px-2 pb-4">
              {flowData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">No transactions in this period</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "bar" ? (
                    <BarChart data={flowData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={compactAmount} width={56} />
                      <Tooltip formatter={tooltipFmt} cursor={{ fill: "#f8fafc" }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="in" name="Money in" fill={COLOR_IN} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="out" name="Money out" fill={COLOR_OUT} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  ) : (
                    <LineChart data={flowData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={compactAmount} width={56} />
                      <Tooltip formatter={tooltipFmt} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="in" name="Money in" stroke={COLOR_IN} strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="out" name="Money out" stroke={COLOR_OUT} strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="net" name="Net" stroke={COLOR_NET} strokeWidth={2} strokeDasharray="4 3" dot={false} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card title="By category" action={<span className="text-xs text-gray-500">{formatAmount(categoryTotal)}</span>}>
            {categoryData.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-sm text-gray-400">No data</div>
            ) : (
              <div className="px-5 pb-5">
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2} stroke="none">
                        {categoryData.map((c) => <Cell key={c.name} fill={colorFor(c.name)} />)}
                      </Pie>
                      <Tooltip formatter={tooltipFmt} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-3 space-y-2">
                  {categoryData.slice(0, 6).map((c) => (
                    <li key={c.name}>
                      <button
                        onClick={() => setCategoryFilter(categoryFilter === c.name ? "all" : c.name)}
                        className={`w-full flex items-center gap-2 text-sm rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-gray-50 ${categoryFilter === c.name ? "bg-gray-50" : ""}`}
                        title="Filter by this category"
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorFor(c.name) }} />
                        <span className="flex-1 text-left text-gray-700 truncate">{c.name}</span>
                        <span className="text-gray-400 text-xs">{categoryTotal ? Math.round((c.value / categoryTotal) * 100) : 0}%</span>
                        <span className="font-medium text-gray-900 w-20 text-right">{compactAmount(c.value)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>

        {/* Insights */}
        {comparison && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 mb-1">Money in vs previous period</p>
              <Change value={comparison.inChange} goodWhenUp />
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 mb-1">Money out vs previous period</p>
              <Change value={comparison.outChange} goodWhenUp={false} />
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 mb-1">Average spent per day</p>
              <p className="font-semibold text-gray-900">{formatAmount(comparison.outPerDay)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 min-w-0">
              <p className="text-xs text-gray-500 mb-1">Largest transaction</p>
              {stats.largest ? (
                <button onClick={() => setSelected(stats.largest)} className="text-left w-full min-w-0">
                  <p className={`font-semibold ${stats.largest.type === "credit" ? "text-emerald-600" : "text-red-600"}`}>{formatAmount(stats.largest.amount)}</p>
                  <p className="text-xs text-gray-500 truncate">{stats.largest.description}</p>
                </button>
              ) : (
                <p className="text-gray-400">—</p>
              )}
            </div>
          </div>
        )}

        {/* Transactions */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Transactions</h3>
            <p className="text-sm text-gray-500">{filtered.length} result{filtered.length === 1 ? "" : "s"}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <button onClick={() => toggleSort("date")} className="inline-flex items-center gap-1 uppercase">Date <SortIcon k="date" /></button>
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="hidden md:table-cell px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="hidden sm:table-cell px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Staff</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <button onClick={() => toggleSort("amount")} className="inline-flex items-center gap-1 uppercase">Amount <SortIcon k="amount" /></button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-5 py-12 text-center">
                      <p className="text-sm font-medium text-gray-700">No transactions found</p>
                      <p className="text-xs text-gray-400 mt-1">{search ? "Try different search terms" : "Try a longer time period"}</p>
                    </td>
                  </tr>
                ) : (
                  pageItems.map((t) => {
                    const credit = t.type === "credit";
                    return (
                      <tr key={t.id} onClick={() => setSelected(t)} className="hover:bg-gray-50 cursor-pointer">
                        <td className="px-5 py-3 whitespace-nowrap">
                          <p className="text-sm text-gray-900">{fmt(t.date, "dd MMM yyyy")}</p>
                          <p className="text-xs text-gray-400">{fmt(t.date, "hh:mm a")}</p>
                        </td>
                        <td className="px-5 py-3 max-w-[220px] sm:max-w-sm">
                          <p className="text-sm font-medium text-gray-900 truncate">{highlight(t.description)}</p>
                          <p className="md:hidden text-xs text-gray-500 truncate">{t.category}</p>
                        </td>
                        <td className="hidden md:table-cell px-5 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: colorFor(t.category) }} />
                            {highlight(t.category)}
                          </span>
                        </td>
                        <td className="hidden sm:table-cell px-5 py-3 whitespace-nowrap text-sm text-gray-600">{highlight(staffName(t))}</td>
                        <td className={`px-5 py-3 whitespace-nowrap text-right text-sm font-semibold ${credit ? "text-emerald-600" : "text-red-600"}`}>
                          {credit ? "+" : "−"}{formatAmount(t.amount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {sorted.length > PER_PAGE && (
            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
              <span>{pageStart + 1}–{Math.min(pageStart + PER_PAGE, sorted.length)} of {sorted.length}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                  <FiChevronLeft size={16} />
                </button>
                <span className="px-2">Page {page} of {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                  <FiChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transaction details */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Transaction</h3>
              <button onClick={() => setSelected(null)} className="p-2 -mr-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><FiX size={18} /></button>
            </div>
            <div className="px-6 py-5">
              <p className={`text-3xl font-bold ${selected.type === "credit" ? "text-emerald-600" : "text-red-600"}`}>
                {selected.type === "credit" ? "+" : "−"}{formatAmount(selected.amount)}
              </p>
              <p className="text-gray-900 font-medium mt-1">{selected.description}</p>
              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div><dt className="text-xs text-gray-500">Date & time</dt><dd className="font-medium text-gray-900">{fmt(selected.date, "dd MMM yyyy, hh:mm a")}</dd></div>
                <div><dt className="text-xs text-gray-500">Type</dt><dd className="font-medium text-gray-900">{selected.type === "credit" ? "Money in" : "Money out"}</dd></div>
                <div><dt className="text-xs text-gray-500">Category</dt><dd className="font-medium text-gray-900">{selected.category}</dd></div>
                <div><dt className="text-xs text-gray-500">Staff</dt><dd className="font-medium text-gray-900">{staffName(selected)}</dd></div>
                <div><dt className="text-xs text-gray-500">Wallet</dt><dd className="font-medium text-gray-900">{wallet.name}</dd></div>
                <div><dt className="text-xs text-gray-500">Transaction ID</dt><dd className="font-medium text-gray-900">#{selected.id}</dd></div>
              </dl>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button onClick={() => setSelected(null)} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-navy-700 hover:bg-navy-800">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add money */}
      {recharge && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => !busy && setRecharge(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Add Money</h3>
                <p className="text-sm text-gray-500">{wallet.name} · balance {formatAmount(wallet.balance)}</p>
              </div>
              <button onClick={() => setRecharge(null)} className="p-2 -mr-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><FiX size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
                  <input
                    type="number"
                    min="0"
                    autoFocus
                    value={recharge.amount}
                    onChange={(e) => setRecharge((r) => ({ ...r, amount: e.target.value }))}
                    className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter amount"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <input
                  value={recharge.description}
                  onChange={(e) => setRecharge((r) => ({ ...r, description: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Cash deposit"
                />
              </div>
              {Number(recharge.amount) > 0 && (
                <p className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                  New balance will be <span className="font-semibold text-gray-900">{formatAmount(wallet.balance + Number(recharge.amount))}</span>
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setRecharge(null)} disabled={busy} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={doRecharge} disabled={busy || !(Number(recharge.amount) > 0)} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-navy-700 hover:bg-navy-800 disabled:opacity-50">
                {busy ? "Adding…" : "Add Money"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletActivity;