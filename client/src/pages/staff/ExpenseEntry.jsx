import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  FiPlus, FiDollarSign, FiCalendar, FiFileText, FiTag, FiSave, FiTrash2, FiDownload, FiUser,
  FiCheck, FiClock, FiRefreshCw, FiEdit3, FiSearch, FiAlertCircle, FiInfo, FiInbox,
} from "react-icons/fi";
import { createExpense, getMyExpenses, deleteExpense, correctExpense } from "@/services/expenseService";
import { getWalletsForCentre } from "@/services/walletService";

/* ---------- Helpers ---------- */
const IST = "Asia/Kolkata";
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
const errMsg = (err, fallback) => err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;

const PAGE_SIZE = 50;

// Hardcoded expense categories with approval requirement flag
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

const STATUSES = [
  { id: "pending", name: "Pending", chip: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  { id: "approved", name: "Approved", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  { id: "auto_approved", name: "Auto approved", chip: "bg-violet-50 text-violet-700 ring-violet-200", dot: "bg-violet-500" },
  { id: "paid", name: "Paid", chip: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  { id: "rejected", name: "Rejected", chip: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
];

const WALLET_TYPE_META = {
  bank: { label: "Bank account", icon: "🏦" },
  cash: { label: "Cash", icon: "💰" },
  credit_card: { label: "Credit card", icon: "💳" },
  digital: { label: "Digital wallet", icon: "📱" },
  savings: { label: "Savings", icon: "🏧" },
};
const getWalletMeta = (wallet) => WALLET_TYPE_META[wallet?.type || wallet?.wallet_type] || { label: "Wallet", icon: "💼" };

const PAYMENT_METHODS = [
  { id: "cash", name: "Cash", icon: "💰" },
  { id: "bank_transfer", name: "Bank transfer", icon: "🏦" },
  { id: "cheque", name: "Cheque", icon: "📝" },
  { id: "online", name: "Online payment", icon: "💳" },
];
const paymentMeta = (id) => PAYMENT_METHODS.find((p) => p.id === id);

const inputCls =
  "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-navy-500/40 disabled:bg-slate-50";

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

const Field = ({ label, required, error, hint, children }) => (
  <div className="space-y-1.5" data-error={error ? "true" : undefined}>
    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
      {label}{required && <span className="text-rose-500"> *</span>}
    </span>
    {children}
    {error ? (
      <p className="flex items-center gap-1 text-xs text-rose-600"><FiAlertCircle className="h-3.5 w-3.5 shrink-0" />{error}</p>
    ) : hint ? (
      <p className="text-xs text-slate-400">{hint}</p>
    ) : null}
  </div>
);

const IconInput = ({ icon: Icon, error, ...props }) => (
  <span className="relative block">
    <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    <input {...props} className={`${inputCls} pl-9 ${error ? "border-rose-300" : "border-slate-200"}`} />
  </span>
);

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

const emptyForm = () => ({
  category_id: "",
  amount: "",
  description: "",
  payment_method: "cash",
  wallet_id: "",
  expense_date: new Date().toLocaleDateString("en-CA", { timeZone: IST }),
  receipt_number: "",
  remarks: "",
});

const ExpenseEntry = () => {
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

  const now = new Date();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedWallet, setSelectedWallet] = useState("all");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const [newExpense, setNewExpense] = useState(emptyForm());
  const [categorySearch, setCategorySearch] = useState("");
  const [errors, setErrors] = useState({});
  const [errorTick, setErrorTick] = useState(0);
  const [correctionForm, setCorrectionForm] = useState({ amount: "", wallet_id: "", reason: "" });
  const reqRef = useRef(0);

  /* ---------- data ---------- */
  const loadData = async (isRefresh = false) => {
    const req = ++reqRef.current;
    if (isRefresh) setRefreshing(true);
    setLoadError(false);
    try {
      const [w, e] = await Promise.allSettled([getWalletsForCentre(), getMyExpenses()]);
      if (req !== reqRef.current) return;
      if (w.status === "fulfilled") setWallets(toList(w.value, "wallets"));
      else toast.error("Failed to load wallets");
      if (e.status === "fulfilled") setExpenses(toList(e.value, "expenses"));
      else { setLoadError(true); toast.error("Failed to load expenses"); }
    } finally {
      if (req === reqRef.current) { setLoading(false); setRefreshing(false); }
    }
  };
  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const walletBalances = useMemo(() => wallets.reduce((acc, w) => { acc[w.id] = Number(w.balance); return acc; }, {}), [wallets]);
  const totalBalance = wallets.reduce((s, w) => s + (Number(w.balance) || 0), 0);

  /* ---------- filtering & stats ---------- */
  const inSelectedMonth = (exp) => {
    const day = ymd(exp.expense_date);
    return !!day && Number(day.slice(5, 7)) === selectedMonth && Number(day.slice(0, 4)) === selectedYear;
  };

  const stats = useMemo(() => {
    const month = expenses.filter(inSelectedMonth);
    const sum = month.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const pending = month.filter((e) => e.status === "pending");
    return {
      totalAmount: sum,
      totalCount: month.length,
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, e) => s + (Number(e.amount) || 0), 0),
      autoApprovedCount: month.filter((e) => e.status === "auto_approved").length,
      approvedCount: month.filter((e) => e.status === "approved" || e.status === "auto_approved" || e.status === "paid").length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, selectedMonth, selectedYear]);

  const filteredExpenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return expenses.filter((expense) => {
      if (q) {
        // any of these can be null, so never call string methods on them directly
        const hit = [expense.description, expense.receipt_number, expense.category, expense.remarks, expense.wallet_name]
          .some((f) => f && String(f).toLowerCase().includes(q));
        if (!hit) return false;
      }
      if (selectedCategory !== "all" && expense.category_id !== parseInt(selectedCategory, 10)) return false;
      if (selectedStatus !== "all" && expense.status !== selectedStatus) return false;
      if (selectedWallet !== "all" && expense.wallet_id !== parseInt(selectedWallet, 10)) return false;
      return inSelectedMonth(expense);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, searchQuery, selectedCategory, selectedStatus, selectedWallet, selectedMonth, selectedYear]);

  useEffect(() => { setVisible(PAGE_SIZE); }, [searchQuery, selectedCategory, selectedStatus, selectedWallet, selectedMonth, selectedYear]);
  const shownExpenses = filteredExpenses.slice(0, visible);

  /* ---------- add expense ---------- */
  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    return CATEGORIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [categorySearch]);

  const selectedCat = CATEGORIES.find((c) => c.id === parseInt(newExpense.category_id, 10));
  const selectedFormWallet = wallets.find((w) => w.id === parseInt(newExpense.wallet_id, 10));
  const amountNum = Number(newExpense.amount) || 0;
  const formBalance = selectedFormWallet ? Number(selectedFormWallet.balance) || 0 : 0;
  const overdraw = !!selectedFormWallet && amountNum > formBalance;

  useEffect(() => {
    if (errorTick === 0) return;
    document.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [errorTick]);

  const setField = (name, value) => {
    setNewExpense((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };
  const handleInputChange = (e) => setField(e.target.name, e.target.value);

  const resetForm = () => { setNewExpense(emptyForm()); setCategorySearch(""); setErrors({}); };
  const closeAdd = () => { setShowAddModal(false); resetForm(); };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (saving) return;
    const er = {};
    if (!selectedCat) er.category_id = "Select a category";
    if (!(amountNum > 0)) er.amount = "Enter an amount greater than 0";
    if (!newExpense.description.trim()) er.description = "Add a short description";
    if (!newExpense.expense_date) er.expense_date = "Select the expense date";
    if (!selectedFormWallet) er.wallet_id = "Select the wallet the money is debited from";
    setErrors(er);
    if (Object.keys(er).length > 0) { setErrorTick((t) => t + 1); return; }

    setSaving(true);
    try {
      const payload = {
        category: selectedCat.name,
        category_id: selectedCat.id,
        amount: Number(newExpense.amount),
        description: newExpense.description.trim(),
        payment_method: newExpense.payment_method,
        wallet_id: Number(newExpense.wallet_id),
        expense_date: newExpense.expense_date,
        receipt_number: newExpense.receipt_number,
        remarks: newExpense.remarks,
        requires_approval: selectedCat.requires_approval,
      };
      await createExpense(payload);
      toast.success(selectedCat.requires_approval ? "Expense submitted for admin approval" : "Expense auto-approved and wallet debited");
      closeAdd();
      await loadData(true);
    } catch (err) {
      toast.error(errMsg(err, "Failed to add expense"));
    } finally {
      setSaving(false);
    }
  };

  /* ---------- correct / delete ---------- */
  const openCorrectModal = (expense) => {
    setCorrectingExpense(expense);
    setCorrectionForm({ amount: String(expense.amount ?? ""), wallet_id: expense.wallet_id != null ? String(expense.wallet_id) : "", reason: "" });
    setShowCorrectModal(true);
  };
  const closeCorrect = () => { setShowCorrectModal(false); setCorrectingExpense(null); };

  const handleCorrectExpense = async (e) => {
    e.preventDefault();
    if (!correctionForm.amount || Number(correctionForm.amount) <= 0 || !correctionForm.wallet_id) {
      toast.error("Enter an amount greater than 0 and select a wallet");
      return;
    }
    setSaving(true);
    try {
      await correctExpense(correctingExpense.id, {
        amount: Number(correctionForm.amount),
        wallet_id: Number(correctionForm.wallet_id),
        reason: correctionForm.reason || "Correction",
      });
      toast.success("Expense corrected successfully");
      closeCorrect();
      await loadData(true);
    } catch (err) {
      toast.error(errMsg(err, "Failed to correct expense"));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    setBusyId(target.id);
    try {
      await deleteExpense(target.id);
      toast.success("Expense deleted successfully");
      await loadData(true);
    } catch (err) {
      toast.error(errMsg(err, "Failed to delete expense"));
    } finally {
      setBusyId(null);
    }
  };

  /* ---------- export ---------- */
  const exportToCSV = () => {
    if (filteredExpenses.length === 0) { toast.info("Nothing to export for this selection"); return; }
    const rows = [
      ["Date", "Category", "Description", "Amount", "Wallet", "Payment Method", "Receipt No", "Status", "Remarks"],
      ...filteredExpenses.map((e) => [ymd(e.expense_date), e.category, e.description, e.amount, e.wallet_name, e.payment_method, e.receipt_number, e.status, e.remarks]),
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
  const filtersActive = searchQuery || selectedCategory !== "all" || selectedStatus !== "all" || selectedWallet !== "all"
    || selectedMonth !== now.getMonth() + 1 || selectedYear !== now.getFullYear();

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const years = useMemo(() => {
    const y = new Date().getFullYear();
    const list = Array.from({ length: 3 }, (_, i) => y - i);
    if (!list.includes(selectedYear)) list.push(selectedYear);
    return list.sort((a, b) => b - a);
  }, [selectedYear]);

  const tiles = [
    { label: "Monthly total", value: formatCurrency(stats.totalAmount), sub: `${months[selectedMonth - 1]} ${selectedYear}`, icon: FiDollarSign, tone: "bg-navy-700/10 text-navy-700" },
    { label: "Pending approval", value: stats.pendingCount, sub: `${formatCurrency(stats.pendingAmount)} waiting`, icon: FiClock, tone: "bg-amber-50 text-amber-600" },
    { label: "Approved", value: stats.approvedCount, sub: `${stats.autoApprovedCount} auto-approved`, icon: FiCheck, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Total entries", value: stats.totalCount, sub: "this month", icon: FiFileText, tone: "bg-violet-50 text-violet-600" },
  ];

  const todayLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: IST });

  const renderActions = (expense) => {
    const canDelete = expense.status === "pending" && expense.requires_approval === true;
    const canCorrect = expense.status !== "pending"; // any non-pending expense can be corrected
    const busy = busyId === expense.id;
    const btn = "rounded-lg p-2 transition disabled:opacity-40";
    if (!canDelete && !canCorrect) return <span className="text-xs italic text-slate-400">No actions available</span>;
    return (
      <div className="flex items-center gap-1">
        {canDelete && <button type="button" disabled={busy} onClick={() => setDeleteTarget(expense)} className={`${btn} text-rose-600 hover:bg-rose-50`} title="Delete expense" aria-label="Delete expense"><FiTrash2 className="h-[18px] w-[18px]" /></button>}
        {canCorrect && <button type="button" disabled={busy} onClick={() => openCorrectModal(expense)} className={`${btn} text-navy-700 hover:bg-slate-100`} title="Correct expense" aria-label="Correct expense"><FiEdit3 className="h-[18px] w-[18px]" /></button>}
      </div>
    );
  };

  const renderDetails = (expense) => {
    const category = CATEGORIES.find((c) => c.id === expense.category_id);
    const pm = paymentMeta(expense.payment_method);
    return (
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg">{category?.icon || "📝"}</span>
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{expense.description}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><FiCalendar className="h-3 w-3" />{formatDate(expense.expense_date)}</span>
            <span className="rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: `${category?.color || "#6B7280"}1f`, color: category?.color || "#6B7280" }}>{expense.category}</span>
            {expense.receipt_number && <span className="inline-flex items-center gap-1"><FiFileText className="h-3 w-3" />{expense.receipt_number}</span>}
            {expense.payment_method && <span>{pm?.icon} {pm?.name || String(expense.payment_method).replace(/_/g, " ")}</span>}
            {expense.is_recurring && <span className="rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700">Recurring{expense.recurrence_type && expense.recurrence_type !== "none" ? ` (${expense.recurrence_type})` : ""}</span>}
          </div>
          {expense.remarks && <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">{expense.remarks}</p>}
        </div>
      </div>
    );
  };

  const renderStatus = (expense) => (
    <div className="space-y-1.5">
      <StatusChip status={expense.status} />
      <p className={`text-xs ${expense.requires_approval ? "text-amber-600" : "text-emerald-600"}`}>{expense.requires_approval ? "Needs admin approval" : "Auto-approved"}</p>
      <p className="text-xs text-slate-400">Submitted {formatDate(expense.submitted_at)}{expense.approved_at ? ` · Approved ${formatDate(expense.approved_at)}` : ""}</p>
      {expense.approved_by && <p className="flex items-center gap-1 text-xs text-slate-500"><FiUser className="h-3 w-3" />By {expense.approved_by}</p>}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
        <div className="w-full animate-pulse space-y-4">
          <div className="h-10 w-80 rounded-lg bg-white" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-white" />)}</div>
          <div className="h-28 rounded-2xl bg-white" />
          <div className="h-80 rounded-2xl bg-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Expense Entry</h1>
            <p className="mt-1 text-sm text-slate-500">Enter and track your expense claims · {todayLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => loadData(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-navy-700 hover:bg-slate-50 disabled:opacity-60">
              <FiRefreshCw className={refreshing ? "animate-spin" : ""} /> Refresh
            </button>
            <button type="button" onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-navy-800">
              <FiPlus /> New expense entry
            </button>
          </div>
        </div>

        {loadError && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span className="flex items-center gap-2"><FiAlertCircle className="h-4 w-4" /> Could not load your expenses.</span>
            <button type="button" onClick={() => loadData(true)} className="font-medium underline">Retry</button>
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${t.tone}`}><t.icon className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="truncate text-xs text-slate-500">{t.label}</p>
                <p className="truncate text-xl font-bold tabular-nums text-slate-900">{t.value}</p>
                <p className="truncate text-xs text-slate-400">{t.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Wallets */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">Wallet balances</h2>
            {wallets.length > 0 && <p className="text-sm text-slate-500">Total <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(totalBalance)}</span></p>}
          </div>
          {wallets.length === 0 ? (
            <p className="text-sm text-slate-400">No wallets found for your centre.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {wallets.map((wallet) => {
                const meta = getWalletMeta(wallet);
                const neg = Number(wallet.balance) < 0;
                return (
                  <div key={wallet.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{meta.icon}</span>
                      <span className="truncate text-sm font-medium text-slate-800" title={wallet.name}>{wallet.name}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{meta.label}</p>
                    <p className={`mt-1.5 text-lg font-bold tabular-nums ${neg ? "text-rose-600" : "text-slate-900"}`}>{formatCurrency(walletBalances[wallet.id])}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-12">
            <select className={`${inputCls} border-slate-200 lg:col-span-2`} value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))} aria-label="Month">
              {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select className={`${inputCls} border-slate-200 lg:col-span-1`} value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))} aria-label="Year">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className={`${inputCls} border-slate-200 lg:col-span-3`} value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} aria-label="Category">
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}{c.requires_approval ? " · needs approval" : ""}</option>)}
            </select>
            <select className={`${inputCls} border-slate-200 lg:col-span-3`} value={selectedWallet} onChange={(e) => setSelectedWallet(e.target.value)} aria-label="Wallet">
              <option value="all">All wallets</option>
              {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select className={`${inputCls} col-span-2 border-slate-200 lg:col-span-3`} value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} aria-label="Status">
              <option value="all">All status</option>
              {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search description, receipt, wallet…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`${inputCls} border-slate-200 pl-9`} aria-label="Search expenses" />
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
          <h2 className="text-sm font-semibold text-slate-800">My expense entries</h2>
          <span className="text-sm text-slate-500">Showing {shownExpenses.length} of {filteredExpenses.length} · {expenses.length} in total</span>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
            <FiInbox className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-3 text-sm font-semibold text-slate-800">No expenses found</h3>
            <p className="mt-1 text-sm text-slate-500">
              {filtersActive ? "Try changing your filters or search." : "Get started by adding your first expense entry."}
            </p>
          </div>
        ) : (
          <>
            {/* phones: cards */}
            <div className="space-y-3 md:hidden">
              {shownExpenses.map((expense) => (
                <div key={expense.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    {renderDetails(expense)}
                    <p className="shrink-0 text-lg font-bold tabular-nums text-slate-900">{formatCurrency(expense.amount)}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-500">{getWalletMeta(wallets.find((w) => w.id === expense.wallet_id)).icon} {expense.wallet_name}</span>
                    {renderActions(expense)}
                  </div>
                  <div className="mt-3 border-t border-slate-100 pt-3">{renderStatus(expense)}</div>
                </div>
              ))}
            </div>

            {/* desktop: table */}
            <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
              <table className="w-full">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Date & details</th>
                    <th className="px-4 py-3">Amount & wallet</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shownExpenses.map((expense) => {
                    const wallet = wallets.find((w) => w.id === expense.wallet_id);
                    return (
                      <tr key={expense.id} className="align-top transition-colors hover:bg-slate-50/70">
                        <td className="max-w-md px-4 py-3.5">{renderDetails(expense)}</td>
                        <td className="px-4 py-3.5">
                          <p className="text-lg font-bold tabular-nums text-slate-900">{formatCurrency(expense.amount)}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{getWalletMeta(wallet).icon} {expense.wallet_name}</p>
                          <p className="text-xs text-slate-400">Balance {formatCurrency(walletBalances[expense.wallet_id])}</p>
                        </td>
                        <td className="px-4 py-3.5">{renderStatus(expense)}</td>
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
          <Modal onClose={closeAdd} width="max-w-2xl">
            <div className="border-b border-slate-100 px-6 py-5">
              <h2 className="text-lg font-semibold text-slate-900">New expense entry</h2>
              <p className="mt-1 text-sm text-slate-500">Choose what it was for, how much, and which wallet it is paid from.</p>
            </div>
            <form onSubmit={handleAddExpense} className="space-y-6 px-6 py-5" noValidate>
              {/* Category */}
              <Field label="Category" required error={errors.category_id}>
                <div className="relative">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Search categories…" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} className={`${inputCls} border-slate-200 pl-9`} aria-label="Search categories" />
                </div>
                <div className="grid max-h-52 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2" role="radiogroup" aria-label="Category">
                  {filteredCategories.length === 0 && <p className="col-span-full py-4 text-center text-sm text-slate-400">No category matches “{categorySearch}”</p>}
                  {filteredCategories.map((category) => {
                    const on = parseInt(newExpense.category_id, 10) === category.id;
                    return (
                      <label key={category.id} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3 py-2 transition focus-within:ring-2 focus-within:ring-navy-500/40 ${on ? "border-navy-500 bg-slate-50" : "border-slate-200 hover:border-slate-300"}`}>
                        <input type="radio" name="category_id" value={category.id} checked={on} onChange={handleInputChange} className="sr-only" />
                        <span className="text-lg">{category.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-800">{category.name}</span>
                          <span className={`block text-xs ${category.requires_approval ? "text-amber-600" : "text-emerald-600"}`}>{category.requires_approval ? "Needs admin approval" : "Auto-approved"}</span>
                        </span>
                        {on && <FiCheck className="h-4 w-4 shrink-0 text-navy-700" />}
                      </label>
                    );
                  })}
                </div>
                {selectedCat && (
                  <p className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <FiInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {selectedCat.requires_approval ? "This will be sent to an admin for approval before the wallet is debited." : "This is auto-approved and the wallet is debited straight away."}
                  </p>
                )}
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Amount (₹)" required error={errors.amount}>
                  <IconInput icon={FiDollarSign} error={errors.amount} type="number" inputMode="decimal" name="amount" value={newExpense.amount} onChange={handleInputChange} placeholder="0.00" min="0" step="0.01" />
                </Field>
                <Field label="Expense date" required error={errors.expense_date}>
                  <IconInput icon={FiCalendar} error={errors.expense_date} type="date" name="expense_date" value={newExpense.expense_date} onChange={handleInputChange} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Description" required error={errors.description}>
                    <IconInput icon={FiFileText} error={errors.description} type="text" name="description" value={newExpense.description} onChange={handleInputChange} placeholder="Brief description of the expense" />
                  </Field>
                </div>
              </div>

              {/* Wallet */}
              <Field label="Pay from wallet" required error={errors.wallet_id} hint={wallets.length === 0 ? "No wallets are available for your centre." : undefined}>
                <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2" role="radiogroup" aria-label="Wallet">
                  {wallets.map((wallet) => {
                    const on = parseInt(newExpense.wallet_id, 10) === wallet.id;
                    const meta = getWalletMeta(wallet);
                    const bal = Number(wallet.balance) || 0;
                    return (
                      <label key={wallet.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 px-3 py-2.5 transition focus-within:ring-2 focus-within:ring-navy-500/40 ${on ? "border-navy-500 bg-slate-50" : "border-slate-200 hover:border-slate-300"}`}>
                        <span className="flex min-w-0 items-center gap-2.5">
                          <input type="radio" name="wallet_id" value={wallet.id} checked={on} onChange={handleInputChange} className="sr-only" />
                          <span className="text-xl">{meta.icon}</span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-slate-900">{wallet.name}</span>
                            <span className="block text-xs text-slate-500">{meta.label}</span>
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className={`block text-sm font-semibold tabular-nums ${bal < 0 ? "text-rose-600" : "text-slate-900"}`}>{formatCurrency(bal)}</span>
                          <span className="block text-xs text-slate-400">Available</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {selectedFormWallet && amountNum > 0 && (
                  <p className={`flex items-center gap-1.5 text-xs ${overdraw ? "text-amber-600" : "text-slate-500"}`}>
                    {overdraw && <FiAlertCircle className="h-3.5 w-3.5" />}
                    {overdraw ? `This is ${formatCurrency(amountNum - formBalance)} more than the wallet holds.` : `Balance after this expense: ${formatCurrency(formBalance - amountNum)}`}
                  </p>
                )}
              </Field>

              {/* Payment method */}
              <Field label="Payment method" required>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Payment method">
                  {PAYMENT_METHODS.map((method) => {
                    const on = newExpense.payment_method === method.id;
                    return (
                      <label key={method.id} className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-2 py-2 text-sm font-medium transition focus-within:ring-2 focus-within:ring-navy-500/40 ${on ? "border-navy-500 bg-slate-50 text-navy-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                        <input type="radio" name="payment_method" value={method.id} checked={on} onChange={handleInputChange} className="sr-only" />
                        <span>{method.icon}</span><span className="truncate">{method.name}</span>
                      </label>
                    );
                  })}
                </div>
              </Field>

              <Field label="Receipt / bill number">
                <IconInput icon={FiTag} type="text" name="receipt_number" value={newExpense.receipt_number} onChange={handleInputChange} placeholder="If any" />
              </Field>

              <Field label="Remarks / notes">
                <textarea name="remarks" value={newExpense.remarks} onChange={handleInputChange} className={`${inputCls} border-slate-200`} placeholder="Any additional notes or explanation…" rows={3} />
              </Field>

              <div className="sticky bottom-0 -mx-6 -mb-5 flex justify-end gap-2 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
                <button type="button" onClick={closeAdd} disabled={saving} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60">
                  <FiSave className="h-4 w-4" /> {saving ? "Submitting…" : "Submit expense"}
                </button>
              </div>
            </form>
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
              <p className="mt-1 text-sm text-slate-500">{deleteTarget.description} · {formatCurrency(deleteTarget.amount)}. This cannot be undone.</p>
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
          <Modal onClose={closeCorrect}>
            <div className="border-b border-slate-100 p-6">
              <h2 className="text-lg font-semibold text-slate-900">Correct expense</h2>
              <p className="mt-1 text-sm text-slate-500">Original: {correctingExpense.description} · {formatCurrency(correctingExpense.amount)} on {formatDate(correctingExpense.expense_date)}</p>
            </div>
            <form onSubmit={handleCorrectExpense} className="space-y-4 p-6">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">New amount (₹) *</span>
                <input type="number" value={correctionForm.amount} onChange={(e) => setCorrectionForm((p) => ({ ...p, amount: e.target.value }))} className={`${inputCls} border-slate-200`} required min="0.01" step="0.01" />
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
                <textarea value={correctionForm.reason} onChange={(e) => setCorrectionForm((p) => ({ ...p, reason: e.target.value }))} className={`${inputCls} border-slate-200`} rows={3} placeholder="Explain why you are correcting this expense…" />
              </label>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={closeCorrect} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
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

export default ExpenseEntry;