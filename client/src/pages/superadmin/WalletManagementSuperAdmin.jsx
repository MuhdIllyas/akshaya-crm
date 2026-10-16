import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  FiPlus, FiRefreshCw, FiSearch, FiX, FiEdit2, FiTrash2, FiArrowDownLeft, FiArrowUpRight,
  FiRepeat, FiMapPin, FiChevronLeft, FiChevronRight, FiCreditCard, FiDollarSign,
  FiSmartphone, FiHome, FiBriefcase, FiUsers, FiActivity, FiAlertCircle, FiFileText,
} from "react-icons/fi";
import {
  getWallets,
  createWallet,
  getTransactions,
  updateWallet,
  getStaff,
  rechargeWallet,
  transferWallet,
  deleteWallet,
  getAuditLogs,
  getWalletTodayBalance,
} from "@/services/walletService";

const API_BASE = import.meta.env.VITE_API_URL;

/* ───────────── constants & helpers ───────────── */
const WALLET_TYPES = [
  { id: "bank", name: "Bank Account", icon: FiHome },
  { id: "cash", name: "Cash", icon: FiDollarSign },
  { id: "card", name: "Credit Card", icon: FiCreditCard },
  { id: "digital", name: "Digital Wallet", icon: FiSmartphone },
  { id: "savings", name: "Savings", icon: FiBriefcase },
];
// One accent colour per wallet category (same as the admin page)
const TYPE_COLOR = { bank: "#2563eb", cash: "#059669", card: "#9333ea", digital: "#ea580c", savings: "#e11d48" };
const walletColor = (w) => TYPE_COLOR[w?.wallet_type] || "#64748b";
const tint = (hex, alpha = "1A") => `${hex}${alpha}`;
const getType = (id) => WALLET_TYPES.find((t) => t.id === id) || { id, name: "Wallet", icon: FiCreditCard };

const formatAmount = (amount) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount) || 0);

const getPhotoUrl = (photo) => {
  if (!photo || photo === "null" || photo === "undefined") return null;
  if (photo.startsWith("http") || photo.startsWith("data:image")) return photo;
  return `${API_BASE}${photo.startsWith("/") ? "" : "/"}${photo}`;
};

const isToday = (value) => {
  if (!value) return false;
  const d = new Date(value);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

const Avatar = ({ name = "", photo, size = "w-8 h-8", text = "text-xs" }) => {
  const [failed, setFailed] = useState(false);
  const url = getPhotoUrl(photo);
  if (url && !failed) {
    return <img src={url} alt={name} onError={() => setFailed(true)} className={`${size} rounded-full object-cover border border-gray-200 shrink-0`} />;
  }
  const initials = name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <div className={`${size} rounded-full bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-semibold ${text} shrink-0`}>
      {initials}
    </div>
  );
};

const inputCls =
  "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50";

const Modal = ({ title, subtitle, onClose, children, footer, size = "max-w-lg" }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
    <div className={`bg-white rounded-2xl w-full ${size} max-h-[92vh] flex flex-col shadow-2xl`} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <button onClick={onClose} className="p-2 -mr-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
          <FiX size={18} />
        </button>
      </div>
      <div className="px-6 py-5 overflow-y-auto space-y-4">{children}</div>
      {footer && <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">{footer}</div>}
    </div>
  </div>
);

const Field = ({ label, required, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
  </div>
);

const AmountInput = ({ value, onChange, autoFocus }) => (
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
    <input type="number" min="0" value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} placeholder="Enter amount" className={`${inputCls} pl-7`} />
  </div>
);

const Segmented = ({ options, value, onChange }) => (
  <div className="flex bg-gray-100 rounded-lg p-1">
    {options.map(([val, label]) => (
      <button
        key={String(val)}
        type="button"
        onClick={() => onChange(val)}
        className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${value === val ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
      >
        {label}
      </button>
    ))}
  </div>
);

const SecondaryBtn = ({ children, ...props }) => (
  <button {...props} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-60">
    {children}
  </button>
);
const PrimaryBtn = ({ children, danger, ...props }) => (
  <button
    {...props}
    className={`px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed ${danger ? "bg-red-600 hover:bg-red-700" : "bg-navy-700 hover:bg-navy-800"}`}
  >
    {children}
  </button>
);

const Pager = ({ page, total, perPage, onChange }) => {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (total <= perPage) return null;
  const start = (page - 1) * perPage;
  return (
    <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
      <span>{start + 1}–{Math.min(start + perPage, total)} of {total}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40"><FiChevronLeft size={16} /></button>
        <span className="px-2">Page {page} of {pages}</span>
        <button onClick={() => onChange(Math.min(pages, page + 1))} disabled={page === pages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40"><FiChevronRight size={16} /></button>
      </div>
    </div>
  );
};

const EMPTY_WALLET = { name: "", balance: "", type: "personal", isOnline: true, staffId: "", walletType: "bank", centreId: "" };
const TX_PER_PAGE = 8;
const LOG_PER_PAGE = 8;

/* ───────────── page ───────────── */
const WalletManagementSuperAdmin = () => {
  const storedId = localStorage.getItem("id");
  const role = (localStorage.getItem("role") || "").toLowerCase();
  const isSuperAdmin = role === "superadmin";
  const staffId = storedId ? Number(storedId) : null;

  const [wallets, setWallets] = useState([]);
  const [todayBalances, setTodayBalances] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [centres, setCentres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [staffError, setStaffError] = useState(null);

  const [selectedCentre, setSelectedCentre] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [txPage, setTxPage] = useState(1);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditPage, setAuditPage] = useState(1);
  const [selectedWallets, setSelectedWallets] = useState([]);

  // Modals
  const [walletForm, setWalletForm] = useState(null); // { mode, id?, data }
  const [recharge, setRecharge] = useState(null); // { walletId, amount, description }
  const [transfer, setTransfer] = useState(null); // { from, to, amount, description }
  const [confirmDelete, setConfirmDelete] = useState(null); // { ids: [], label }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);
  useEffect(() => setTxPage(1), [search, selectedCentre]);
  useEffect(() => setAuditPage(1), [auditSearch, selectedCentre]);

  /* ---------- data (same service calls as before) ---------- */
  const fetchCentres = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/centres`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      setCentres(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching centres:", err);
      toast.error("Failed to load centres.");
    }
  }, []);

  const fetchWalletData = useCallback(async () => {
    try {
      const [walletRes, txRes] = await Promise.all([getWallets(), getTransactions()]);
      const list = walletRes.data || [];
      setWallets(list);
      setTransactions(txRes.data || []);
      // Today's opening/closing per wallet (same endpoint as before, now in parallel)
      const results = await Promise.all(list.map((w) => getWalletTodayBalance(w.id).catch(() => null)));
      const map = {};
      list.forEach((w, i) => (map[w.id] = results[i]));
      setTodayBalances(map);
    } catch (err) {
      console.error("Error loading wallet data:", err);
      toast.error("Failed to load wallet data.");
    }
  }, []);

  const fetchStaffData = useCallback(async () => {
    try {
      setStaffError(null);
      const data = await getStaff();
      setStaffMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading staff data:", err);
      setStaffError("Failed to load staff.");
      setStaffMembers([]);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setAuditLoading(true);
      const res = await getAuditLogs();
      const d = res.data;
      setAuditLogs(Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : Array.isArray(d?.logs) ? d.logs : []);
    } catch (err) {
      console.error("Error loading audit logs:", err);
      setAuditLogs([]);
      toast.error("Failed to load audit logs.");
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) {
      toast.error("Access denied. Superadmin privileges required.");
      window.location.href = "/dashboard";
      return;
    }
    (async () => {
      setLoading(true);
      await Promise.all([fetchWalletData(), fetchStaffData(), fetchCentres(), fetchAuditLogs()]);
      setLoading(false);
    })();
  }, [isSuperAdmin, fetchWalletData, fetchStaffData, fetchCentres, fetchAuditLogs]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchWalletData(), fetchStaffData(), fetchAuditLogs()]);
    setRefreshing(false);
    toast.success("Wallets refreshed");
  };

  /* ---------- lookups ---------- */
  const staffById = useMemo(() => {
    const m = {};
    staffMembers.forEach((s) => (m[String(s.id)] = s));
    return m;
  }, [staffMembers]);
  const walletById = useMemo(() => {
    const m = {};
    wallets.forEach((w) => (m[String(w.id)] = w));
    return m;
  }, [wallets]);
  const centreNameById = useCallback(
    (id) => centres.find((c) => String(c.id) === String(id))?.name || wallets.find((w) => String(w.centre_id) === String(id))?.centre_name || "Unknown centre",
    [centres, wallets]
  );
  const staffCentre = (s) => s.centreId ?? s.centre_id;

  /* ---------- derived ---------- */
  const centreWallets = useMemo(
    () => (selectedCentre ? wallets.filter((w) => String(w.centre_id) === String(selectedCentre)) : wallets),
    [wallets, selectedCentre]
  );

  const filteredWallets = useMemo(() => {
    if (!search) return centreWallets;
    return centreWallets.filter((w) => {
      const staff = staffById[String(w.assigned_staff_id)];
      return [w.name, w.centre_name, getType(w.wallet_type).name, staff?.name, `#${w.id}`].some((f) => String(f || "").toLowerCase().includes(search));
    });
  }, [centreWallets, search, staffById]);

  const todaysTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        const w = walletById[String(t.wallet_id)];
        if (selectedCentre && (!w || String(w.centre_id) !== String(selectedCentre))) return false;
        return isToday(t.created_at);
      }),
    [transactions, walletById, selectedCentre]
  );
  const todayIn = todaysTransactions.filter((t) => t.type === "credit").reduce((s, t) => s + Number(t.amount || 0), 0);
  const todayOut = todaysTransactions.filter((t) => t.type !== "credit").reduce((s, t) => s + Number(t.amount || 0), 0);

  const filteredTransactions = useMemo(() => {
    if (!search) return todaysTransactions;
    return todaysTransactions.filter((t) =>
      [t.description, t.category, t.staff_name, walletById[String(t.wallet_id)]?.name, walletById[String(t.wallet_id)]?.centre_name]
        .some((f) => String(f || "").toLowerCase().includes(search))
    );
  }, [todaysTransactions, search, walletById]);
  const txStart = (txPage - 1) * TX_PER_PAGE;

  const filteredLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs.filter((log) => {
      if (selectedCentre && String(log.centre_id) !== String(selectedCentre)) return false;
      if (!isToday(log.created_at)) return false;
      return !q || [log.action, log.performed_by, log.details, log.centre_name].some((f) => String(f || "").toLowerCase().includes(q));
    });
  }, [auditLogs, selectedCentre, auditSearch]);
  const logStart = (auditPage - 1) * LOG_PER_PAGE;

  const totalBalance = centreWallets.reduce((s, w) => s + (Number(w.balance) || 0), 0);
  const personalCount = centreWallets.filter((w) => !w.is_shared).length;
  const sharedCount = centreWallets.filter((w) => w.is_shared).length;
  const centreCount = new Set(centreWallets.map((w) => w.centre_id)).size;

  const staffWallets = useMemo(
    () =>
      staffMembers
        .map((s) => {
          const own = centreWallets.filter((w) => !w.is_shared && String(w.assigned_staff_id) === String(s.id));
          return { ...s, wallets: own, walletCount: own.length, walletTotal: own.reduce((sum, w) => sum + (Number(w.balance) || 0), 0) };
        })
        .filter((s) => s.walletCount > 0)
        .sort((a, b) => b.walletTotal - a.walletTotal),
    [staffMembers, centreWallets]
  );

  /* ---------- actions (payloads unchanged from the original page) ---------- */
  const openAdd = () => setWalletForm({ mode: "add", data: { ...EMPTY_WALLET, centreId: selectedCentre || "" } });
  const openEdit = (w) =>
    setWalletForm({
      mode: "edit",
      id: w.id,
      centreId: w.centre_id,
      data: {
        name: w.name || "",
        balance: String(w.balance ?? ""),
        type: w.is_shared ? "shared" : "personal",
        isOnline: w.status === "online",
        staffId: w.assigned_staff_id ? String(w.assigned_staff_id) : "",
        walletType: w.wallet_type || "bank",
        permissions: w.permissions || [],
      },
    });
  const setFormField = (k, v) => setWalletForm((f) => ({ ...f, data: { ...f.data, [k]: v } }));

  const saveWallet = async () => {
    const d = walletForm.data;
    if (!d.name.trim() || d.balance === "") return toast.error("Wallet name and balance are required.");
    if (walletForm.mode === "add" && !d.centreId) return toast.error("Please choose a centre.");
    setBusy(true);
    try {
      if (walletForm.mode === "add") {
        await createWallet({
          name: d.name.trim(),
          balance: Number(d.balance),
          is_shared: d.type === "shared",
          assigned_staff_id: d.type === "personal" ? d.staffId : null,
          wallet_type: d.walletType,
          status: d.isOnline ? "online" : "offline",
          permissions: [],
          centre_id: d.centreId,
        });
        toast.success("Wallet added");
      } else {
        await updateWallet(walletForm.id, {
          name: d.name.trim(),
          balance: Number(d.balance),
          is_shared: d.type === "shared",
          assigned_staff_id: d.type === "personal" ? d.staffId : null,
          wallet_type: d.walletType,
          status: d.isOnline ? "online" : "offline",
          permissions: d.permissions || [],
        });
        toast.success("Wallet updated");
      }
      setWalletForm(null);
      await fetchWalletData();
      fetchAuditLogs();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || `Failed to ${walletForm.mode === "add" ? "create" : "update"} wallet.`);
    } finally {
      setBusy(false);
    }
  };

  const doRecharge = async () => {
    const amount = Number(recharge.amount);
    if (!amount || amount <= 0) return toast.error("Enter a valid amount.");
    setBusy(true);
    try {
      await rechargeWallet({
        wallet_id: recharge.walletId,
        amount,
        description: recharge.description || "Wallet Recharge",
        category: "Recharge",
        staff_id: staffId,
      });
      toast.success(`${formatAmount(amount)} added to ${walletById[String(recharge.walletId)]?.name || "wallet"}`);
      setRecharge(null);
      await fetchWalletData();
      fetchAuditLogs();
    } catch (err) {
      console.error("Recharge failed:", err);
      toast.error(err.response?.data?.error || "Recharge failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const doTransfer = async () => {
    const amount = Number(transfer.amount);
    if (!transfer.from || !transfer.to || !amount || amount <= 0) return toast.error("Choose both wallets and enter a valid amount.");
    if (transfer.from === transfer.to) return toast.error("Source and destination must be different.");
    if (!staffId) {
      toast.error("Session expired. Please log in again.");
      window.location.href = "/login";
      return;
    }
    const fromWallet = walletById[transfer.from];
    const toWallet = walletById[transfer.to];
    const description =
      transfer.description ||
      `Transferred ${amount} from ${fromWallet?.name || "Unknown Wallet"} (${fromWallet?.centre_name || "Unknown Centre"}) to ${toWallet?.name || "Unknown Wallet"} (${toWallet?.centre_name || "Unknown Centre"})`;
    setBusy(true);
    try {
      await transferWallet({
        from_wallet_id: Number(transfer.from),
        to_wallet_id: Number(transfer.to),
        amount,
        description,
        category: "Transfer",
        staff_id: staffId,
      });
      toast.success(`${formatAmount(amount)} moved from ${fromWallet?.name} to ${toWallet?.name}`);
      setTransfer(null);
      await fetchWalletData();
      fetchAuditLogs();
    } catch (err) {
      console.error("Transfer failed:", err);
      toast.error(err.response?.data?.error || "Transfer failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    const ids = confirmDelete.ids;
    setBusy(true);
    let failed = 0;
    for (const id of ids) {
      try {
        await deleteWallet(id);
      } catch (err) {
        console.error("Delete failed for wallet", id, err);
        failed++;
      }
    }
    setBusy(false);
    setConfirmDelete(null);
    setSelectedWallets((sel) => sel.filter((id) => !ids.includes(id)));
    if (failed) toast.error(`${failed} of ${ids.length} wallet(s) could not be deleted.`);
    else toast.success(ids.length === 1 ? "Wallet deleted" : `${ids.length} wallets deleted`);
    await fetchWalletData();
    fetchAuditLogs();
  };

  const toggleSelect = (id) => setSelectedWallets((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));

  /* ---------- render ---------- */
  const stats = [
    { label: "Total Balance", value: formatAmount(totalBalance), sub: `${centreCount} centre${centreCount === 1 ? "" : "s"}`, icon: FiCreditCard, tone: "bg-blue-50 text-blue-600" },
    { label: "Today In", value: formatAmount(todayIn), icon: FiArrowDownLeft, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Today Out", value: formatAmount(todayOut), icon: FiArrowUpRight, tone: "bg-red-50 text-red-600" },
    { label: "Wallets", value: centreWallets.length, sub: `${personalCount} personal · ${sharedCount} shared`, icon: FiUsers, tone: "bg-purple-50 text-purple-600" },
  ];

  const formCentre = walletForm ? (walletForm.mode === "add" ? walletForm.data.centreId : walletForm.centreId) : null;
  const formStaffOptions = walletForm
    ? staffMembers.filter((s) => !formCentre || String(staffCentre(s)) === String(formCentre))
    : [];
  const transferFrom = transfer ? walletById[transfer.from] : null;
  const transferExceeds = transfer && transferFrom && Number(transfer.amount) > Number(transferFrom.balance);
  const walletLabel = (w) => (w.centre_name ? `${w.centre_name} – ${w.name}` : w.name);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Wallet Management</h1>
            <p className="text-gray-500 mt-1">All wallets across every centre</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
              <select
                value={selectedCentre}
                onChange={(e) => setSelectedCentre(e.target.value)}
                className="pl-9 pr-8 py-2.5 border border-gray-300 bg-white rounded-xl text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                aria-label="Filter by centre"
              >
                <option value="">All centres</option>
                {centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 bg-white rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <FiRefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Refresh
            </button>
            <button
              onClick={() => setShowAuditLogs((v) => !v)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium ${showAuditLogs ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              <FiFileText size={15} /> Audit Logs
            </button>
            <button
              onClick={() => setTransfer({ from: "", to: "", amount: "", description: "" })}
              disabled={wallets.length < 2}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 bg-white rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <FiRepeat size={15} /> Transfer
            </button>
            <button onClick={openAdd} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-navy-700 hover:bg-navy-800 shadow-sm">
              <FiPlus size={16} /> Add Wallet
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map(({ label, value, sub, icon: Icon, tone }) => (
            <div key={label} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-500 font-medium">{label}</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900 mt-1 truncate">{loading ? "–" : value}</p>
                {sub && !loading && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
              </div>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
                <Icon size={20} />
              </div>
            </div>
          ))}
        </div>

        {/* Audit logs */}
        {showAuditLogs && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Today's Audit Logs</h2>
                <p className="text-sm text-gray-500">{filteredLogs.length} entr{filteredLogs.length === 1 ? "y" : "ies"}</p>
              </div>
              <div className="relative sm:w-72">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Search logs…"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {["Time", "Action", "By", "Centre", "Details"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {auditLoading ? (
                    <tr><td colSpan="5" className="px-5 py-10 text-center text-sm text-gray-400">Loading…</td></tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr><td colSpan="5" className="px-5 py-10 text-center text-sm text-gray-500">No audit logs today</td></tr>
                  ) : (
                    filteredLogs.slice(logStart, logStart + LOG_PER_PAGE).map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-600">
                          {new Date(log.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{log.action}</span>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-700">{log.performed_by}</td>
                        <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-600">{log.centre_name || "System"}</td>
                        <td className="px-5 py-3 text-sm text-gray-600 min-w-[240px]">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pager page={auditPage} total={filteredLogs.length} perPage={LOG_PER_PAGE} onChange={setAuditPage} />
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6">
          <div className="relative">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
            <input
              type="text"
              placeholder="Search wallets, centres, staff or today's transactions…"
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
        </div>

        {/* Wallets header + bulk bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Wallets {selectedCentre && <span className="text-gray-400 font-normal">· {centreNameById(selectedCentre)}</span>}
          </h2>
          {selectedWallets.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{selectedWallets.length} selected</span>
              <button onClick={() => setSelectedWallets([])} className="text-sm font-medium text-gray-500 hover:text-gray-700 px-2">Clear</button>
              <button
                onClick={() => setConfirmDelete({ ids: selectedWallets, label: `${selectedWallets.length} wallet(s)` })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700"
              >
                <FiTrash2 size={14} /> Delete
              </button>
            </div>
          ) : (
            search && <p className="text-sm text-gray-500">{filteredWallets.length} of {centreWallets.length}</p>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gray-200" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                  </div>
                </div>
                <div className="h-7 bg-gray-200 rounded w-1/2 mt-5" />
                <div className="h-12 bg-gray-100 rounded-xl mt-4" />
              </div>
            ))}
          </div>
        ) : centreWallets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <FiCreditCard size={24} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No wallets {selectedCentre ? "in this centre" : "yet"}</h3>
            <p className="text-gray-500 mt-1 mb-5">Add a wallet to start tracking balances.</p>
            <PrimaryBtn onClick={openAdd}>Add Wallet</PrimaryBtn>
          </div>
        ) : filteredWallets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-500 mb-8">No wallets match “{searchInput}”.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">
            {filteredWallets.map((w) => {
              const type = getType(w.wallet_type);
              const TypeIcon = type.icon;
              const color = walletColor(w);
              const staff = staffById[String(w.assigned_staff_id)];
              const today = todayBalances[w.id];
              const online = w.status === "online";
              const checked = selectedWallets.includes(w.id);
              return (
                <div
                  key={w.id}
                  className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden ${checked ? "border-red-300 ring-2 ring-red-100" : "border-gray-200"}`}
                >
                  <div className="h-1" style={{ background: color }} />
                  <div className="p-5 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-11 h-11 rounded-xl border flex items-center justify-center shrink-0"
                          style={{ background: tint(color), borderColor: tint(color, "33"), color }}
                        >
                          <TypeIcon size={20} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate" title={w.name}>{w.name}</h3>
                          <p className="text-xs text-gray-500 flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-gray-400"}`} />
                            {online ? "Online" : "Offline"} · {type.name}
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(w.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        title="Select for bulk delete"
                        aria-label={`Select ${w.name}`}
                      />
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border bg-gray-50 text-gray-600 border-gray-200 max-w-full">
                        <FiMapPin size={11} className="shrink-0" /> <span className="truncate">{w.centre_name || centreNameById(w.centre_id)}</span>
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${w.is_shared ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                        {w.is_shared ? "Shared" : "Personal"}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 mt-4">Current balance</p>
                    <p className="text-2xl font-bold text-gray-900">{formatAmount(w.balance)}</p>

                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                        <p className="text-[11px] text-gray-500">Today opening</p>
                        <p className="text-sm font-semibold text-gray-800">{today?.opening_balance != null ? formatAmount(today.opening_balance) : "—"}</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                        <p className="text-[11px] text-gray-500">Today closing</p>
                        <p className="text-sm font-semibold text-gray-800">{today?.closing_balance != null ? formatAmount(today.closing_balance) : "—"}</p>
                      </div>
                    </div>

                    {!w.is_shared && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                        {staff ? (
                          <>
                            <Avatar name={staff.name} photo={staff.photo || staff.photoUrl} size="w-6 h-6" text="text-[10px]" />
                            <span className="truncate">Assigned to <span className="font-medium text-gray-900">{staff.name}</span></span>
                          </>
                        ) : (
                          <span className="flex items-center gap-1.5 text-amber-600"><FiAlertCircle size={14} /> Not assigned to anyone</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
                    <Link to={`/dashboard/admin/wallets/${w.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 px-2 py-1.5 rounded-lg hover:bg-blue-50">
                      <FiActivity size={14} /> Activity
                    </Link>
                    <div className="flex gap-1">
                      <button onClick={() => setRecharge({ walletId: w.id, amount: "", description: "" })} className="p-2 rounded-lg text-gray-500 hover:text-emerald-600 hover:bg-emerald-50" title="Add money">
                        <FiArrowDownLeft size={16} />
                      </button>
                      <button
                        onClick={() => setTransfer({ from: String(w.id), to: "", amount: "", description: "" })}
                        disabled={wallets.length < 2}
                        className="p-2 rounded-lg text-gray-500 hover:text-amber-600 hover:bg-amber-50 disabled:opacity-40"
                        title="Transfer"
                      >
                        <FiRepeat size={16} />
                      </button>
                      <button onClick={() => openEdit(w)} className="p-2 rounded-lg text-gray-500 hover:text-blue-700 hover:bg-blue-50" title="Edit">
                        <FiEdit2 size={16} />
                      </button>
                      <button onClick={() => setConfirmDelete({ ids: [w.id], label: w.name })} className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50" title="Delete">
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Today's transactions */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Today's Transactions</h2>
            <p className="text-sm text-gray-500">
              {filteredTransactions.length} transaction{filteredTransactions.length === 1 ? "" : "s"}
              {search && " matching your search"}
              {transactions.length >= 50 && " · from the latest 50 across all centres"}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {["Time", "Description", "Wallet", "Staff", "Category"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="6" className="px-5 py-10 text-center text-sm text-gray-400">Loading…</td></tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-12 text-center">
                      <p className="text-sm font-medium text-gray-700">{search ? "No matching transactions today" : "No transactions yet today"}</p>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.slice(txStart, txStart + TX_PER_PAGE).map((t) => {
                    const credit = t.type === "credit";
                    const w = walletById[String(t.wallet_id)];
                    return (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-600">
                          {new Date(t.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-5 py-3 text-sm font-medium text-gray-900 max-w-xs truncate">{t.description || "No description"}</td>
                        <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-600">
                          {w ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ background: walletColor(w) }} />
                              <span>
                                {w.name}
                                {!selectedCentre && w.centre_name && <span className="block text-xs text-gray-400">{w.centre_name}</span>}
                              </span>
                            </span>
                          ) : (t.wallet_name || "—")}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          {t.staff_id ? (
                            <div className="flex items-center gap-2">
                              <Avatar name={t.staff_name || ""} photo={t.staff_photo} size="w-7 h-7" text="text-[10px]" />
                              <span className="text-sm text-gray-700">{t.staff_name || `Staff #${t.staff_id}`}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">System</span>
                          )}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{t.category || "General"}</span>
                        </td>
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
          <Pager page={txPage} total={filteredTransactions.length} perPage={TX_PER_PAGE} onChange={setTxPage} />
        </div>

        {/* Staff wallets (only staff who have personal wallets) */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Staff Wallets</h2>
          {staffError ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
              <p className="text-sm text-gray-600 mb-3">{staffError}</p>
              <SecondaryBtn onClick={fetchStaffData}>Retry</SecondaryBtn>
            </div>
          ) : staffWallets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-sm text-gray-500">
              {loading ? "Loading…" : "No personal wallets are assigned to staff yet."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {staffWallets.map((s) => (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} photo={s.photo || s.photoUrl} size="w-11 h-11" text="text-sm" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 truncate">{s.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        <span className="capitalize">{s.role}</span>
                        {!selectedCentre && staffCentre(s) && <> · {centreNameById(staffCentre(s))}</>}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{formatAmount(s.walletTotal)}</p>
                      <p className="text-xs text-gray-400">{s.walletCount} wallet{s.walletCount === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                    {s.wallets.map((w) => (
                      <Link key={w.id} to={`/dashboard/admin/wallets/${w.id}`} className="flex items-center gap-2 text-sm rounded-lg px-2 py-1 -mx-2 hover:bg-gray-50">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: walletColor(w) }} />
                        <span className="flex-1 truncate text-gray-700">{w.name}</span>
                        <span className="font-medium text-gray-900">{formatAmount(w.balance)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit wallet */}
      {walletForm && (
        <Modal
          title={walletForm.mode === "add" ? "Add Wallet" : "Edit Wallet"}
          subtitle={walletForm.mode === "edit" ? `Wallet #${walletForm.id} · ${centreNameById(walletForm.centreId)}` : "Create a wallet for a centre"}
          onClose={() => !busy && setWalletForm(null)}
          footer={
            <>
              <SecondaryBtn onClick={() => setWalletForm(null)} disabled={busy}>Cancel</SecondaryBtn>
              <PrimaryBtn onClick={saveWallet} disabled={busy}>{busy ? "Saving…" : walletForm.mode === "add" ? "Add Wallet" : "Save Changes"}</PrimaryBtn>
            </>
          }
        >
          {walletForm.mode === "add" && (
            <Field label="Centre" required>
              <select
                value={walletForm.data.centreId}
                onChange={(e) => setWalletForm((f) => ({ ...f, data: { ...f.data, centreId: e.target.value, staffId: "" } }))}
                className={inputCls}
              >
                <option value="">Select centre</option>
                {centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Wallet name" required>
            <input value={walletForm.data.name} onChange={(e) => setFormField("name", e.target.value)} className={inputCls} placeholder="e.g. HDFC Bank" />
          </Field>
          <Field
            label={walletForm.mode === "add" ? "Opening balance" : "Balance"}
            required
            hint={walletForm.mode === "edit" ? "To add money, use “Add money” instead so it's recorded as a transaction." : undefined}
          >
            <AmountInput value={walletForm.data.balance} onChange={(v) => setFormField("balance", v)} />
          </Field>
          <Field label="Wallet type">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {WALLET_TYPES.map((t) => {
                const Icon = t.icon;
                const active = walletForm.data.walletType === t.id;
                const c = TYPE_COLOR[t.id];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFormField("walletType", t.id)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs font-medium transition-colors ${active ? "" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                    style={active ? { borderColor: c, background: `${c}14`, color: c } : undefined}
                  >
                    <Icon size={16} style={active ? undefined : { color: c }} />
                    <span className="truncate w-full text-center">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Status">
              <Segmented options={[[true, "Online"], [false, "Offline"]]} value={walletForm.data.isOnline} onChange={(v) => setFormField("isOnline", v)} />
            </Field>
            <Field label="Ownership">
              <Segmented options={[["personal", "Personal"], ["shared", "Shared"]]} value={walletForm.data.type} onChange={(v) => setFormField("type", v)} />
            </Field>
          </div>
          {walletForm.data.type === "personal" && (
            <Field label="Assign to staff" hint={!formCentre ? "Choose a centre first to see its staff" : undefined}>
              <select value={walletForm.data.staffId} onChange={(e) => setFormField("staffId", e.target.value)} className={inputCls} disabled={!formCentre}>
                <option value="">Not assigned</option>
                {formStaffOptions.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.name} ({s.role})</option>
                ))}
              </select>
            </Field>
          )}
        </Modal>
      )}

      {/* Recharge */}
      {recharge && (
        <Modal
          title="Add Money"
          subtitle={`${walletLabel(walletById[String(recharge.walletId)] || {})} · balance ${formatAmount(walletById[String(recharge.walletId)]?.balance)}`}
          onClose={() => !busy && setRecharge(null)}
          footer={
            <>
              <SecondaryBtn onClick={() => setRecharge(null)} disabled={busy}>Cancel</SecondaryBtn>
              <PrimaryBtn onClick={doRecharge} disabled={busy || !(Number(recharge.amount) > 0)}>{busy ? "Adding…" : "Add Money"}</PrimaryBtn>
            </>
          }
        >
          <Field label="Amount" required>
            <AmountInput value={recharge.amount} onChange={(v) => setRecharge((r) => ({ ...r, amount: v }))} autoFocus />
          </Field>
          <Field label="Note">
            <input value={recharge.description} onChange={(e) => setRecharge((r) => ({ ...r, description: e.target.value }))} className={inputCls} placeholder="e.g. Cash deposit" />
          </Field>
          {Number(recharge.amount) > 0 && (
            <p className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              New balance will be <span className="font-semibold text-gray-900">{formatAmount(Number(walletById[String(recharge.walletId)]?.balance || 0) + Number(recharge.amount))}</span>
            </p>
          )}
        </Modal>
      )}

      {/* Transfer */}
      {transfer && (
        <Modal
          title="Transfer Funds"
          subtitle="Move money between wallets (any centre)"
          onClose={() => !busy && setTransfer(null)}
          footer={
            <>
              <SecondaryBtn onClick={() => setTransfer(null)} disabled={busy}>Cancel</SecondaryBtn>
              <PrimaryBtn onClick={doTransfer} disabled={busy || !transfer.from || !transfer.to || !(Number(transfer.amount) > 0)}>
                {busy ? "Transferring…" : "Transfer"}
              </PrimaryBtn>
            </>
          }
        >
          <Field label="From" required>
            <select value={transfer.from} onChange={(e) => setTransfer((t) => ({ ...t, from: e.target.value, to: t.to === e.target.value ? "" : t.to }))} className={inputCls}>
              <option value="">Select source wallet</option>
              {wallets.map((w) => <option key={w.id} value={String(w.id)}>{walletLabel(w)} ({formatAmount(w.balance)})</option>)}
            </select>
          </Field>
          <Field label="To" required>
            <select value={transfer.to} onChange={(e) => setTransfer((t) => ({ ...t, to: e.target.value }))} className={inputCls}>
              <option value="">Select destination wallet</option>
              {wallets.filter((w) => String(w.id) !== transfer.from).map((w) => (
                <option key={w.id} value={String(w.id)}>{walletLabel(w)} ({formatAmount(w.balance)})</option>
              ))}
            </select>
          </Field>
          <Field label="Amount" required>
            <AmountInput value={transfer.amount} onChange={(v) => setTransfer((t) => ({ ...t, amount: v }))} />
          </Field>
          {transferExceeds && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <FiAlertCircle size={15} /> This is more than the {formatAmount(transferFrom.balance)} available in {transferFrom.name}.
            </p>
          )}
          <Field label="Note">
            <input value={transfer.description} onChange={(e) => setTransfer((t) => ({ ...t, description: e.target.value }))} className={inputCls} placeholder="Optional" />
          </Field>
        </Modal>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <Modal
          title={confirmDelete.ids.length === 1 ? "Delete wallet?" : `Delete ${confirmDelete.ids.length} wallets?`}
          onClose={() => !busy && setConfirmDelete(null)}
          size="max-w-md"
          footer={
            <>
              <SecondaryBtn onClick={() => setConfirmDelete(null)} disabled={busy}>Cancel</SecondaryBtn>
              <PrimaryBtn danger onClick={doDelete} disabled={busy}>{busy ? "Deleting…" : "Delete permanently"}</PrimaryBtn>
            </>
          }
        >
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{confirmDelete.label}</span> will be permanently deleted. This cannot be undone.
          </p>
          {confirmDelete.ids.length > 1 && (
            <ul className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 max-h-40 overflow-y-auto space-y-1">
              {confirmDelete.ids.map((id) => {
                const w = walletById[String(id)];
                return <li key={id}>{w ? `${walletLabel(w)} · ${formatAmount(w.balance)}` : `Wallet #${id}`}</li>;
              })}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
};

export default WalletManagementSuperAdmin;