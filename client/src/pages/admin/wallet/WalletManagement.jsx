import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FiPlus, FiRefreshCw, FiSearch, FiX, FiEdit2, FiArrowDownLeft, FiArrowUpRight,
  FiRepeat, FiMapPin, FiChevronLeft, FiChevronRight, FiCreditCard, FiDollarSign,
  FiSmartphone, FiHome, FiBriefcase, FiUsers, FiActivity, FiAlertCircle,
} from "react-icons/fi";
import {
  getWallets,
  createWallet,
  getTransactions,
  updateWallet,
  getStaff,
  rechargeWallet,
  transferWallet,
  getWalletTodayBalance,
} from "@/services/walletService";

const API_BASE = import.meta.env.VITE_API_URL;

/* ───────────── constants & helpers ───────────── */
const WALLET_TYPES = [
  { id: "bank", name: "Bank Account", icon: FiHome, tone: "bg-blue-50 text-blue-600 border-blue-100" },
  { id: "cash", name: "Cash", icon: FiDollarSign, tone: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  { id: "card", name: "Credit Card", icon: FiCreditCard, tone: "bg-purple-50 text-purple-600 border-purple-100" },
  { id: "digital", name: "Digital Wallet", icon: FiSmartphone, tone: "bg-amber-50 text-amber-600 border-amber-100" },
  { id: "savings", name: "Savings", icon: FiBriefcase, tone: "bg-rose-50 text-rose-600 border-rose-100" },
];

// One accent colour per wallet category (all bank wallets share a colour, etc.)
const TYPE_COLOR = { bank: "#2563eb", cash: "#059669", card: "#9333ea", digital: "#ea580c", savings: "#e11d48" };
const walletColor = (w) => TYPE_COLOR[w?.wallet_type] || "#64748b";
const tint = (hex, alpha = "1A") => `${hex}${alpha}`; // hex + 2-digit alpha

const getType = (id) => WALLET_TYPES.find((t) => t.id === id) || { id, name: "Wallet", icon: FiCreditCard, tone: "bg-gray-50 text-gray-600 border-gray-100" };

const formatAmount = (amount) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount) || 0);

const getPhotoUrl = (photo) => {
  if (!photo || photo === "null" || photo === "undefined") return null;
  if (photo.startsWith("http") || photo.startsWith("data:image")) return photo;
  return `${API_BASE}${photo.startsWith("/") ? "" : "/"}${photo}`;
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
  "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

const Modal = ({ title, subtitle, onClose, children, footer }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
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

const AmountInput = ({ value, onChange, placeholder = "Enter amount", autoFocus }) => (
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
    <input type="number" min="0" value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} placeholder={placeholder} className={`${inputCls} pl-7`} />
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
const PrimaryBtn = ({ children, ...props }) => (
  <button {...props} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-navy-700 hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed">
    {children}
  </button>
);

const EMPTY_WALLET = { name: "", balance: "", type: "personal", isOnline: true, staffId: "", walletType: "bank" };
const PER_PAGE = 8;

/* ───────────── page ───────────── */
const WalletManagement = () => {
  const navigate = useNavigate();
  const storedId = localStorage.getItem("id");
  const role = localStorage.getItem("role") || "";
  const storedCentreId = localStorage.getItem("centre_id");
  const staffId = storedId ? Number(storedId) : null;
  const adminCentreId = storedCentreId ? Number(storedCentreId) : null;

  const [wallets, setWallets] = useState([]);
  const [todayBalances, setTodayBalances] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [staffError, setStaffError] = useState(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [walletForm, setWalletForm] = useState(null); // { mode: 'add'|'edit', id?, data }
  const [recharge, setRecharge] = useState(null); // { walletId, amount, description }
  const [transfer, setTransfer] = useState(null); // { from, to, amount, description }
  const [busy, setBusy] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);
  useEffect(() => setCurrentPage(1), [search]);

  /* ---------- data ---------- */
  const fetchWalletData = useCallback(async () => {
    try {
      const walletRes = await getWallets();
      const list = (walletRes.data || []).filter(
        (w) => w && (role === "superadmin" || Number(w.centre_id) === adminCentreId)
      );
      setWallets(list);

      const balances = {};
      if (list.length) {
        try {
          const res = await axios.post(
            `${API_BASE}/api/wallet/today-balances`,
            { walletIds: list.map((w) => w.id) },
            { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
          );
          Object.assign(balances, res.data);
        } catch {
          // Fallback: one request per wallet, in parallel
          const results = await Promise.all(list.map((w) => getWalletTodayBalance(w.id).catch(() => null)));
          list.forEach((w, i) => (balances[w.id] = results[i]));
        }
      }
      setTodayBalances(balances);

      const txRes = await getTransactions(100, 0);
      setTransactions(txRes.data || []);
    } catch (err) {
      console.error(err);
      setWallets([]);
      setTransactions([]);
      toast.error("Failed to load wallet data.");
    }
  }, [role, adminCentreId]);

  const fetchStaffData = useCallback(async () => {
    try {
      setStaffError(null);
      const data = await getStaff(role === "superadmin" ? null : adminCentreId);
      setStaffMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setStaffError("Failed to load staff.");
      setStaffMembers([]);
    }
  }, [role, adminCentreId]);

  useEffect(() => {
    if (role !== "superadmin" && !adminCentreId) {
      toast.error("Centre ID is missing. Please log in again.");
      navigate("/login");
      return;
    }
    (async () => {
      setLoading(true);
      await Promise.all([fetchWalletData(), fetchStaffData()]);
      setLoading(false);
    })();
  }, [role, adminCentreId, navigate, fetchWalletData, fetchStaffData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchWalletData(), fetchStaffData()]);
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
  const centreName = wallets.find((w) => w.centre_name)?.centre_name;

  /* ---------- derived ---------- */
  const totalBalance = wallets.reduce((s, w) => s + (Number(w.balance) || 0), 0);
  const personalCount = wallets.filter((w) => !w.is_shared).length;
  const sharedCount = wallets.filter((w) => w.is_shared).length;

  const todaysTransactions = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return transactions.filter((t) => {
      if (!walletById[String(t.wallet_id)]) return false;
      const d = new Date(t.created_at);
      return d >= start && d < end;
    });
  }, [transactions, walletById]);

  const todayIn = todaysTransactions.filter((t) => t.type === "credit").reduce((s, t) => s + Number(t.amount || 0), 0);
  const todayOut = todaysTransactions.filter((t) => t.type !== "credit").reduce((s, t) => s + Number(t.amount || 0), 0);

  const filteredWallets = useMemo(() => {
    if (!search) return wallets;
    return wallets.filter((w) => {
      const staff = staffById[String(w.assigned_staff_id)];
      return [w.name, getType(w.wallet_type).name, staff?.name, `#${w.id}`].some((f) => String(f || "").toLowerCase().includes(search));
    });
  }, [wallets, search, staffById]);

  const filteredTransactions = useMemo(() => {
    if (!search) return todaysTransactions;
    return todaysTransactions.filter((t) =>
      [t.description, t.category, t.staff_name, walletById[String(t.wallet_id)]?.name].some((f) => String(f || "").toLowerCase().includes(search))
    );
  }, [todaysTransactions, search, walletById]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PER_PAGE));
  const pageStart = (currentPage - 1) * PER_PAGE;
  const pageTransactions = filteredTransactions.slice(pageStart, pageStart + PER_PAGE);

  const staffWallets = useMemo(
    () =>
      staffMembers
        .map((s) => {
          const own = wallets.filter((w) => !w.is_shared && String(w.assigned_staff_id) === String(s.id));
          return { ...s, wallets: own, walletCount: own.length, walletTotal: own.reduce((sum, w) => sum + (Number(w.balance) || 0), 0) };
        })
        .filter((s) => s.walletCount > 0)
        .sort((a, b) => b.walletTotal - a.walletTotal),
    [staffMembers, wallets]
  );

  /* ---------- actions ---------- */
  const openAdd = () => setWalletForm({ mode: "add", data: { ...EMPTY_WALLET } });
  const openEdit = (w) =>
    setWalletForm({
      mode: "edit",
      id: w.id,
      data: {
        name: w.name || "",
        balance: String(w.balance ?? ""),
        type: w.is_shared ? "shared" : "personal",
        isOnline: w.status === "online",
        staffId: w.assigned_staff_id ? String(w.assigned_staff_id) : "",
        walletType: w.wallet_type || "bank",
      },
    });
  const setFormField = (k, v) => setWalletForm((f) => ({ ...f, data: { ...f.data, [k]: v } }));

  const saveWallet = async () => {
    const d = walletForm.data;
    if (!d.name.trim() || d.balance === "") return toast.error("Wallet name and balance are required.");
    const payload = {
      name: d.name.trim(),
      balance: Number(d.balance),
      is_shared: d.type === "shared",
      assigned_staff_id: d.type === "personal" && d.staffId ? Number(d.staffId) : null,
      wallet_type: d.walletType,
      status: d.isOnline ? "online" : "offline",
    };
    setBusy(true);
    try {
      if (walletForm.mode === "add") {
        await createWallet({ ...payload, centre_id: adminCentreId });
        toast.success("Wallet added");
      } else {
        await updateWallet(walletForm.id, payload);
        toast.success("Wallet updated");
      }
      setWalletForm(null);
      await fetchWalletData();
    } catch (err) {
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
        description: recharge.description.trim() || "Wallet Recharge",
        category: "Recharge",
        staff_id: staffId,
      });
      toast.success(`${formatAmount(amount)} added to ${walletById[String(recharge.walletId)]?.name || "wallet"}`);
      setRecharge(null);
      await fetchWalletData();
    } catch (err) {
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
      return navigate("/login");
    }
    const fromName = walletById[transfer.from]?.name;
    const toName = walletById[transfer.to]?.name;
    setBusy(true);
    try {
      await transferWallet({
        from_wallet_id: Number(transfer.from),
        to_wallet_id: Number(transfer.to),
        amount,
        description: transfer.description.trim() || `Transfer from ${fromName} to ${toName}`,
        category: "Transfer",
        staff_id: staffId,
      });
      toast.success(`${formatAmount(amount)} moved from ${fromName} to ${toName}`);
      setTransfer(null);
      await fetchWalletData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Transfer failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  /* ---------- render ---------- */
  const stats = [
    { label: "Total Balance", value: formatAmount(totalBalance), icon: FiCreditCard, tone: "bg-blue-50 text-blue-600" },
    { label: "Today In", value: formatAmount(todayIn), icon: FiArrowDownLeft, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Today Out", value: formatAmount(todayOut), icon: FiArrowUpRight, tone: "bg-red-50 text-red-600" },
    { label: "Wallets", value: wallets.length, sub: `${personalCount} personal · ${sharedCount} shared`, icon: FiUsers, tone: "bg-purple-50 text-purple-600" },
  ];

  const transferFrom = transfer ? walletById[transfer.from] : null;
  const transferExceeds = transfer && transferFrom && Number(transfer.amount) > Number(transferFrom.balance);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Wallet Management</h1>
            <p className="text-gray-500 mt-1 flex items-center gap-1.5">
              <FiMapPin size={14} /> {centreName || (adminCentreId ? `Centre #${adminCentreId}` : "All centres")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 bg-white rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <FiRefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Refresh
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

        {/* Search */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6">
          <div className="relative">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
            <input
              type="text"
              placeholder="Search wallets, staff or today's transactions…"
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

        {/* Wallets */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Wallets</h2>
          {search && <p className="text-sm text-gray-500">{filteredWallets.length} of {wallets.length}</p>}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">
            {Array.from({ length: 3 }).map((_, i) => (
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
        ) : wallets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <FiCreditCard size={24} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No wallets yet</h3>
            <p className="text-gray-500 mt-1 mb-5">Add your first wallet to start tracking balances.</p>
            <PrimaryBtn onClick={openAdd}>Add Wallet</PrimaryBtn>
          </div>
        ) : filteredWallets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-500 mb-8">No wallets match “{searchInput}”.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">
            {filteredWallets.map((w) => {
              const type = getType(w.wallet_type);
              const color = walletColor(w);
              const TypeIcon = type.icon;
              const staff = staffById[String(w.assigned_staff_id)];
              const today = todayBalances[w.id];
              const online = w.status === "online";
              return (
                <div key={w.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden">
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
                          <h3 className="font-semibold text-gray-900 truncate">{w.name}</h3>
                          <p className="text-xs text-gray-500 flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-gray-400"}`} />
                            {online ? "Online" : "Offline"} · {type.name}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${w.is_shared ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                        {w.is_shared ? "Shared" : "Personal"}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 mt-5">Current balance</p>
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
                            <Avatar name={staff.name} photo={staff.photo} size="w-6 h-6" text="text-[10px]" />
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
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Today's transactions */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Today's Transactions</h2>
              <p className="text-sm text-gray-500">{filteredTransactions.length} transaction{filteredTransactions.length === 1 ? "" : "s"}{search && " matching your search"}</p>
            </div>
            <Link to="/dashboard/admin/transactions" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800">
              Full report <FiChevronRight size={15} />
            </Link>
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
                ) : pageTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-12 text-center">
                      <p className="text-sm font-medium text-gray-700">{search ? "No matching transactions today" : "No transactions yet today"}</p>
                      <p className="text-xs text-gray-400 mt-1">Recharges, transfers and service payments will appear here.</p>
                    </td>
                  </tr>
                ) : (
                  pageTransactions.map((t) => {
                    const credit = t.type === "credit";
                    return (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-600">
                          {t.created_at ? new Date(t.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </td>
                        <td className="px-5 py-3 text-sm font-medium text-gray-900 max-w-xs truncate">{t.description || "No description"}</td>
                        <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-600">
                          {walletById[String(t.wallet_id)] ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ background: walletColor(walletById[String(t.wallet_id)]) }} />
                              {walletById[String(t.wallet_id)].name}
                            </span>
                          ) : "—"}
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

          {filteredTransactions.length > PER_PAGE && (
            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
              <span>
                {pageStart + 1}–{Math.min(pageStart + PER_PAGE, filteredTransactions.length)} of {filteredTransactions.length}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                  <FiChevronLeft size={16} />
                </button>
                <span className="px-2">Page {currentPage} of {totalPages}</span>
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                  <FiChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Staff wallets */}
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
                      <p className="text-xs text-gray-500 capitalize">{s.role}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{formatAmount(s.walletTotal)}</p>
                      <p className="text-xs text-gray-400">{s.walletCount} wallet{s.walletCount === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                    {s.wallets.map((w) => (
                      <Link
                        key={w.id}
                        to={`/dashboard/admin/wallets/${w.id}`}
                        className="flex items-center gap-2 text-sm rounded-lg px-2 py-1 -mx-2 hover:bg-gray-50"
                      >
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
          subtitle={walletForm.mode === "edit" ? `Wallet #${walletForm.id}` : "Create a wallet for this centre"}
          onClose={() => !busy && setWalletForm(null)}
          footer={
            <>
              <SecondaryBtn onClick={() => setWalletForm(null)} disabled={busy}>Cancel</SecondaryBtn>
              <PrimaryBtn onClick={saveWallet} disabled={busy}>{busy ? "Saving…" : walletForm.mode === "add" ? "Add Wallet" : "Save Changes"}</PrimaryBtn>
            </>
          }
        >
          <Field label="Wallet name" required>
            <input value={walletForm.data.name} onChange={(e) => setFormField("name", e.target.value)} className={inputCls} placeholder="e.g. HDFC Bank" autoFocus />
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
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFormField("walletType", t.id)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs font-medium transition-colors ${
                      active ? "" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                    style={active ? { borderColor: TYPE_COLOR[t.id], background: `${TYPE_COLOR[t.id]}14`, color: TYPE_COLOR[t.id] } : undefined}
                  >
                    <Icon size={16} style={active ? undefined : { color: TYPE_COLOR[t.id] }} />
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
            <Field label="Assign to staff">
              <select value={walletForm.data.staffId} onChange={(e) => setFormField("staffId", e.target.value)} className={inputCls}>
                <option value="">Not assigned</option>
                {staffMembers.map((s) => (
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
          subtitle={`${walletById[String(recharge.walletId)]?.name} · balance ${formatAmount(walletById[String(recharge.walletId)]?.balance)}`}
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
          subtitle="Move money between wallets"
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
              {wallets.map((w) => <option key={w.id} value={String(w.id)}>{w.name} ({formatAmount(w.balance)})</option>)}
            </select>
          </Field>
          <Field label="To" required>
            <select value={transfer.to} onChange={(e) => setTransfer((t) => ({ ...t, to: e.target.value }))} className={inputCls}>
              <option value="">Select destination wallet</option>
              {wallets.filter((w) => String(w.id) !== transfer.from).map((w) => (
                <option key={w.id} value={String(w.id)}>{w.name} ({formatAmount(w.balance)})</option>
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
            <input value={transfer.description} onChange={(e) => setTransfer((t) => ({ ...t, description: e.target.value }))} className={inputCls} placeholder="e.g. Move cash to bank" />
          </Field>
        </Modal>
      )}
    </div>
  );
};

export default WalletManagement;