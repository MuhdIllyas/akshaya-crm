import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import {
  FiDollarSign, FiPhone, FiCalendar, FiEye, FiDownload, FiSearch, FiX,
  FiMessageSquare, FiFileText, FiCreditCard, FiAlertCircle, FiRefreshCw,
  FiCheckCircle, FiClock, FiPercent, FiBarChart2, FiUser, FiFile, FiChevronDown,
} from "react-icons/fi";
import { getPendingPayments, getPendingPaymentsHistory, receiveServicePayment, getWallets } from "@/services/serviceService";

/* ---------- Helpers ---------- */
const IST = "Asia/Kolkata";
const OVERDUE_DAYS = 7;
const PAGE_SIZE = 50;

// quick date ranges (IST) applied to the service date
const PRESETS = [
  { id: "today", label: "Today" },
  { id: "month", label: "This month" },
  { id: "year", label: "This year" },
  { id: "all", label: "All time" },
];
const presetRange = (id) => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: IST });
  if (id === "today") return { from: today, to: today };
  if (id === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  if (id === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return { from: "", to: "" };
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
  if (!s) return "—";
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
};
const dayNumber = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};
// whole calendar days (IST) since the given date
const daysSince = (v) => {
  const s = ymd(v);
  if (!s) return 0;
  return Math.max(0, dayNumber(ymd(new Date())) - dayNumber(s));
};
const isOverdue = (createdAt) => daysSince(createdAt) > OVERDUE_DAYS;

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
const errMsg = (err, fallback) =>
  err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;

const initials = (name) =>
  (name || "U").split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "U";

// wa.me needs the country code; 10-digit Indian numbers get 91
const waNumber = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
};

const normalizePayments = (rows = []) =>
  rows.map((r) => ({
    id: String(r.service_entry_id || r.id),
    customer: { name: r.customer_name || "—", phone: r.customer_phone || "" },
    service: { type: r.service_name || "—", subcategory: r.subcategory_name || "", description: r.description || "" },
    staff: { id: r.staff_id || null, name: r.staff_name || "—" },
    total: Number(r.total_charges || 0),
    paid: Number(r.paid_amount || 0),
    due: Number(r.pending_amount || 0),
    createdAt: r.created_at,
    paymentHistory: Array.isArray(r.payment_history) ? r.payment_history : [],
    notes: Array.isArray(r.notes) ? r.notes : [],
    documents: Array.isArray(r.documents) ? r.documents : [],
  }));

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "credit_card", label: "Credit card" },
  { value: "debit_card", label: "Debit card" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

const TABS = [
  { id: "all", label: "All" },
  { id: "overdue", label: "Overdue" },
  { id: "pending", label: "Unpaid" },
  { id: "partially_paid", label: "Partially paid" },
  { id: "history", label: "Cleared history" },
];

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base sm:text-sm text-slate-800 placeholder-slate-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-navy-500/40 disabled:bg-slate-50 disabled:text-slate-400";

/* ---------- Small components ---------- */
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error("Error in PendingPaymentsSection:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <h3 className="text-lg font-bold text-rose-600">Something went wrong</h3>
          <p className="text-slate-600">Please refresh the page or contact support.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const StatusChip = ({ payment }) => {
  let cfg;
  if (payment.due <= 0) cfg = { name: "Cleared", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" };
  else if (isOverdue(payment.createdAt)) cfg = { name: "Overdue", chip: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" };
  else if (payment.paid > 0) cfg = { name: "Partially paid", chip: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" };
  else cfg = { name: "Unpaid", chip: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cfg.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.name}
    </span>
  );
};

const PaidBar = ({ paid, total }) => {
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
    </div>
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
        className={`max-h-[90dvh] w-full ${width} overflow-y-auto rounded-2xl bg-white shadow-xl`}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

const Section = ({ title, icon: Icon, children }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
      <Icon className="h-4 w-4 text-navy-700" /> {title}
    </h4>
    {children}
  </div>
);

const Row = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
    <span className="shrink-0 text-slate-500">{label}</span>
    <span className="min-w-0 break-words text-right font-medium text-slate-800">{children}</span>
  </div>
);

/* ---------- Detail modal ---------- */
const PendingPaymentDetailModal = ({ payment, onClose, onRecord, canRecord }) => {
  const pct = payment.total > 0 ? Math.min(100, Math.round((payment.paid / payment.total) * 100)) : 0;
  const days = daysSince(payment.createdAt);
  const notes = Array.isArray(payment.notes) ? payment.notes : [];
  const documents = Array.isArray(payment.documents) ? payment.documents : [];
  const history = (Array.isArray(payment.paymentHistory) ? payment.paymentHistory : []).map((ph) => ({
    amount: Number(ph.amount) || 0,
    method: ph.method || ph.wallet_name || "Wallet",
    date: ph.date || formatDate(ph.created_at),
    remarks: ph.remarks || (ph.status === "received" ? "Payment received" : ph.status ? "Pending payment" : ""),
  }));

  return (
    <Modal onClose={onClose} width="max-w-4xl">
      <div className="p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Service entry details</h3>
            <p className="mt-0.5 text-sm text-slate-500">ID: {payment.id} · Staff: {payment.staff?.name || "—"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close"><FiX className="h-5 w-5" /></button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Section title="Customer" icon={FiUser}>
              <Row label="Name">{payment.customer.name}</Row>
              <Row label="Phone">
                {payment.customer.phone
                  ? <a href={`tel:${payment.customer.phone}`} className="text-navy-700 hover:underline">{payment.customer.phone}</a>
                  : "—"}
              </Row>
            </Section>

            <Section title="Service" icon={FiCheckCircle}>
              <Row label="Service type">{payment.service.type}</Row>
              <Row label="Subcategory">{payment.service.subcategory || "—"}</Row>
              <Row label="Description">{payment.service.description || "—"}</Row>
              <Row label="Service date">{formatDate(payment.createdAt)}</Row>
              <Row label="Pending for">
                <span className={payment.due > 0 && days > OVERDUE_DAYS ? "text-rose-600" : ""}>{days} {days === 1 ? "day" : "days"}</span>
              </Row>
            </Section>

            {notes.length > 0 && (
              <Section title="Workflow & notes" icon={FiMessageSquare}>
                <ul className="space-y-2">
                  {notes.map((note, i) => (
                    <li key={i} className="rounded-lg border border-slate-100 bg-white p-3">
                      <p className="text-sm text-slate-700">{note.text}</p>
                      {note.date && <p className="mt-1 text-xs text-slate-400">{note.date}</p>}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>

          <div className="space-y-4">
            <Section title="Payment summary" icon={FiBarChart2}>
              <Row label="Total amount"><span className="tabular-nums">{formatCurrency(payment.total)}</span></Row>
              <Row label="Amount paid"><span className="tabular-nums text-emerald-600">{formatCurrency(payment.paid)}</span></Row>
              <div className="mt-1 border-t border-slate-200 pt-1">
                <Row label="Balance due"><span className="text-base font-bold tabular-nums text-rose-600">{formatCurrency(payment.due)}</span></Row>
              </div>
              {payment.total > 0 && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Collected</span><span className="font-medium text-slate-700">{pct}%</span></div>
                  <PaidBar paid={payment.paid} total={payment.total} />
                </div>
              )}
            </Section>

            <Section title="Payment history" icon={FiCreditCard}>
              {history.length > 0 ? (
                <ul className="space-y-2">
                  {history.map((h, i) => (
                    <li key={i}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{h.date}</p>
                          <p className="text-xs text-slate-500">{h.method}</p>
                        </div>
                        <span className="text-sm font-bold tabular-nums text-emerald-600">+{formatCurrency(h.amount)}</span>
                      </div>
                      {h.remarks && <p className="mt-0.5 text-xs text-slate-500">{h.remarks}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">No payment recorded yet</p>
              )}
            </Section>

            {documents.length > 0 && (
              <Section title="Documents" icon={FiFileText}>
                <ul className="space-y-1.5">
                  {documents.map((doc, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm text-slate-700">
                      <FiFile className="h-4 w-4 shrink-0 text-slate-400" /> <span className="truncate">{doc.name}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Close</button>
          {canRecord && payment.due > 0 && (
            <button type="button" onClick={() => onRecord(payment)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-800">
              <FiCreditCard /> Record payment
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

/* ---------- Receive payment modal ---------- */
const ReceivePaymentModal = ({ payment, wallets, walletsLoading, onClose, onSuccess }) => {
  const [amount, setAmount] = useState(String(payment.due));
  const [wallet, setWallet] = useState("");
  const [method, setMethod] = useState("cash");
  const [remarks, setRemarks] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  // a single wallet is picked automatically
  useEffect(() => {
    if (!wallet && wallets.length === 1) setWallet(String(wallets[0].id));
  }, [wallets, wallet]);

  const amt = Number(amount);
  const amountError = !amount
    ? "Enter an amount"
    : !(amt > 0)
      ? "Amount must be greater than 0"
      : amt > payment.due
        ? `Cannot be more than the balance due (${formatCurrency(payment.due)})`
        : "";
  const walletError = wallet ? "" : "Select a wallet";
  const close = () => { if (!saving) onClose(); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (amountError || walletError || saving) return;
    setSaving(true);
    try {
      await receiveServicePayment(payment.id, {
        amount: amt,
        wallet_id: wallet,
        payment_method: method,
        remarks: remarks.trim(),
      });
      toast.success("Payment recorded successfully");
      onSuccess();
    } catch (err) {
      toast.error(errMsg(err, "Payment failed"));
      setSaving(false);
    }
  };

  return (
    <Modal onClose={close} width="max-w-md">
      <form onSubmit={handleSubmit} className="p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Receive payment</h3>
            <p className="mt-0.5 text-sm text-slate-500">{payment.customer.name} · ID {payment.id}</p>
          </div>
          <button type="button" onClick={close} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close"><FiX className="h-5 w-5" /></button>
        </div>

        <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
          <div className="flex justify-between py-0.5"><span className="text-slate-500">Total amount</span><span className="font-semibold tabular-nums">{formatCurrency(payment.total)}</span></div>
          <div className="flex justify-between py-0.5"><span className="text-slate-500">Already paid</span><span className="font-semibold tabular-nums text-emerald-600">{formatCurrency(payment.paid)}</span></div>
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-2"><span className="font-medium text-slate-700">Balance due</span><span className="text-base font-bold tabular-nums text-rose-600">{formatCurrency(payment.due)}</span></div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="pps-amount" className="text-sm font-medium text-slate-700">Amount (₹)</label>
              <button type="button" onClick={() => setAmount(String(payment.due))} className="text-xs font-medium text-navy-700 hover:underline">Full balance</button>
            </div>
            <input
              id="pps-amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount}
              onChange={(e) => setAmount(e.target.value)} className={inputCls} autoFocus
            />
            {submitted && amountError && <p className="mt-1 text-xs text-rose-600">{amountError}</p>}
          </div>

          <div>
            <label htmlFor="pps-method" className="mb-1.5 block text-sm font-medium text-slate-700">Payment method</label>
            <div className="relative">
              <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select id="pps-method" value={method} onChange={(e) => setMethod(e.target.value)} className={`${inputCls} appearance-none pr-9`}>
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="pps-wallet" className="mb-1.5 block text-sm font-medium text-slate-700">Credit to wallet</label>
            <div className="relative">
              <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select id="pps-wallet" value={wallet} onChange={(e) => setWallet(e.target.value)} disabled={walletsLoading} className={`${inputCls} appearance-none pr-9`}>
                <option value="">{walletsLoading ? "Loading wallets…" : "Select wallet"}</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}{w.balance !== undefined ? ` · ${formatCurrency(w.balance)}` : ""}</option>
                ))}
              </select>
            </div>
            {!walletsLoading && wallets.length === 0 && <p className="mt-1 text-xs text-amber-600">No wallets available for this centre.</p>}
            {submitted && walletError && wallets.length > 0 && <p className="mt-1 text-xs text-rose-600">{walletError}</p>}
          </div>

          <div>
            <label htmlFor="pps-remarks" className="mb-1.5 block text-sm font-medium text-slate-700">Remarks <span className="font-normal text-slate-400">(optional)</span></label>
            <textarea
              id="pps-remarks" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add any remarks about this payment…" className={inputCls}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={close} disabled={saving} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-60">
            {saving ? <><FiRefreshCw className="animate-spin" /> Saving…</> : <><FiCheckCircle /> Record payment</>}
          </button>
        </div>
      </form>
    </Modal>
  );
};

/* ========== MAIN COMPONENT ========== */
const PendingPaymentsSection = ({
  isMobile, // kept for compatibility: the layout is now responsive on its own
  pendingPayments: externalPayments,
  loading: externalLoading,
  filter: externalFilter,
  setFilter: setExternalFilter,
  fromDate: externalFromDate,
  setFromDate: setExternalFromDate,
  toDate: externalToDate,
  setToDate: setExternalToDate,
  isSuperAdmin = false,
  readOnly = false
}) => {
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);

  const [detailPayment, setDetailPayment] = useState(null);
  const [receivePayment, setReceivePayment] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [walletsLoading, setWalletsLoading] = useState(false);
  const [sendingWhatsappId, setSendingWhatsappId] = useState(null);
  const reqRef = useRef(0);

  // superadmin: the parent owns the data, the status filter and the dates
  const payments = (isSuperAdmin ? externalPayments : pendingPayments) || [];
  const isLoading = isSuperAdmin ? externalLoading : loading;

  const activeFilter = isSuperAdmin ? externalFilter : filter;
  const setActiveFilter = isSuperAdmin ? setExternalFilter : setFilter;

  const activeFromDate = (isSuperAdmin ? externalFromDate : fromDate) || "";
  const setActiveFromDate = isSuperAdmin ? setExternalFromDate : setFromDate;

  const activeToDate = (isSuperAdmin ? externalToDate : toDate) || "";
  const setActiveToDate = isSuperAdmin ? setExternalToDate : setToDate;

  const mode = activeFilter === "history" ? "history" : "pending";

  const fetchPayments = async (silent = false) => {
    if (isSuperAdmin) return;
    const id = ++reqRef.current;
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const response = mode === "history" ? await getPendingPaymentsHistory() : await getPendingPayments();
      if (id !== reqRef.current) return;
      setPendingPayments(normalizePayments(toList(response)));
      setLoadError(false);
    } catch (err) {
      if (id !== reqRef.current) return;
      console.error("Pending payments fetch error:", err);
      setLoadError(true);
      toast.error("Failed to load payments: " + errMsg(err, "Unknown error"));
    } finally {
      if (id === reqRef.current) { setLoading(false); setRefreshing(false); }
    }
  };

  // reload only when switching between the pending list and the cleared history
  useEffect(() => {
    if (isSuperAdmin) return;
    setPendingPayments([]);
    fetchPayments(false);
  }, [mode]);

  // wallets for the receive-payment dropdown, refreshed each time the modal opens
  useEffect(() => {
    if (!receivePayment) return undefined;
    let cancelled = false;
    setWalletsLoading(true);
    getWallets()
      .then((res) => { if (!cancelled) setWallets(toList(res, "wallets")); })
      .catch((err) => { if (!cancelled) toast.error("Could not load wallets: " + errMsg(err, "Unknown error")); })
      .finally(() => { if (!cancelled) setWalletsLoading(false); });
    return () => { cancelled = true; };
  }, [receivePayment?.id]);

  // search + date range (the status tabs are applied on top of this)
  const scopedPayments = useMemo(() => {
    let list = payments;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        (p.customer.name || "").toLowerCase().includes(q) ||
        (p.customer.phone || "").includes(q) ||
        (p.service.type || "").toLowerCase().includes(q) ||
        (p.service.subcategory || "").toLowerCase().includes(q) ||
        (p.staff?.name || "").toLowerCase().includes(q) ||
        String(p.id).includes(q)
      );
    }
    if (activeFromDate || activeToDate) {
      list = list.filter((p) => {
        const d = ymd(p.createdAt);
        if (!d) return false;
        if (activeFromDate && d < activeFromDate) return false;
        if (activeToDate && d > activeToDate) return false;
        return true;
      });
    }
    return list;
  }, [payments, searchQuery, activeFromDate, activeToDate]);

  const filteredPayments = useMemo(() => {
    let list = scopedPayments;
    if (activeFilter === "overdue") list = list.filter((p) => isOverdue(p.createdAt));
    else if (activeFilter === "pending") list = list.filter((p) => p.paid === 0);
    else if (activeFilter === "partially_paid") list = list.filter((p) => p.paid > 0 && p.due > 0);
    return [...list].sort((a, b) => b.due - a.due);
  }, [scopedPayments, activeFilter]);

  useEffect(() => { setShown(PAGE_SIZE); }, [searchQuery, activeFilter, activeFromDate, activeToDate, payments]);

  const stats = useMemo(() => {
    const totalDue = filteredPayments.reduce((s, p) => s + p.due, 0);
    const totalReceivables = filteredPayments.reduce((s, p) => s + p.total, 0);
    const paidTotal = filteredPayments.reduce((s, p) => s + p.paid, 0);
    return {
      totalDue,
      totalReceivables,
      paidTotal,
      overdueCount: filteredPayments.filter((p) => p.due > 0 && isOverdue(p.createdAt)).length,
      unpaidCount: filteredPayments.filter((p) => p.paid === 0).length,
      partialCount: filteredPayments.filter((p) => p.paid > 0 && p.due > 0).length,
      collectionRate: totalReceivables > 0 ? Math.round((paidTotal / totalReceivables) * 100) : 0,
    };
  }, [filteredPayments]);

  const tabCounts = useMemo(() => {
    if (mode === "history") return {};
    return {
      all: scopedPayments.length,
      overdue: scopedPayments.filter((p) => isOverdue(p.createdAt)).length,
      pending: scopedPayments.filter((p) => p.paid === 0).length,
      partially_paid: scopedPayments.filter((p) => p.paid > 0 && p.due > 0).length,
    };
  }, [scopedPayments, mode]);

  const activePreset = PRESETS.find((r) => { const x = presetRange(r.id); return x.from === activeFromDate && x.to === activeToDate; })?.id || "custom";
  const applyPreset = (id) => { const r = presetRange(id); setActiveFromDate(r.from); setActiveToDate(r.to); };
  // "active" = anything other than the default view (all time, all statuses, no search)
  const filtersActive = Boolean(searchQuery || activePreset !== "all" || (activeFilter !== "all" && activeFilter !== "history"));
  const clearFilters = () => { setSearchQuery(""); applyPreset("all"); if (activeFilter !== "history") setActiveFilter("all"); };

  const visible = filteredPayments.slice(0, shown);

  const handleSendReminder = async (payment) => {
    setSendingWhatsappId(payment.id);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/servicemanagement/pending-payments/${payment.id}/send-whatsapp`,
        { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Failed to send WhatsApp");
      toast.success(`WhatsApp reminder sent to ${payment.customer.name}`);
    } catch (error) {
      console.error("WhatsApp reminder error:", error);
      toast.error(error.message || "Failed to send WhatsApp reminder");
    } finally {
      setSendingWhatsappId(null);
    }
  };

  const openReceive = (payment) => { setDetailPayment(null); setReceivePayment(payment); };

  const handlePaymentSuccess = () => {
    setReceivePayment(null);
    if (!isSuperAdmin) fetchPayments(true);
  };

  const exportCsv = () => {
    if (filteredPayments.length === 0) { toast.info("Nothing to export"); return; }
    const head = ["Service ID", "Customer", "Phone", "Service", "Subcategory", "Staff", "Total", "Paid", "Due", "Service date", "Days pending", "Status"];
    const lines = [head, ...filteredPayments.map((p) => [
      p.id, p.customer.name, p.customer.phone, p.service.type, p.service.subcategory, p.staff?.name || "",
      p.total, p.paid, p.due, ymd(p.createdAt), daysSince(p.createdAt),
      p.due <= 0 ? "Cleared" : isOverdue(p.createdAt) ? "Overdue" : p.paid > 0 ? "Partially paid" : "Unpaid",
    ])].map((r) => r.map(csvCell).join(","));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${mode === "history" ? "cleared-payments" : "pending-payments"}-${ymd(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const tiles = [
    { label: "Total receivables", value: formatCurrency(stats.totalReceivables), sub: `${filteredPayments.length} ${filteredPayments.length === 1 ? "service" : "services"}`, icon: FiBarChart2, tone: "bg-slate-100 text-navy-700" },
    { label: "Pending amount", value: formatCurrency(stats.totalDue), sub: "Balance to collect", icon: FiDollarSign, tone: "bg-rose-50 text-rose-600" },
    { label: "Unpaid services", value: stats.unpaidCount, sub: `${stats.partialCount} partially paid`, icon: FiAlertCircle, tone: "bg-amber-50 text-amber-600", onClick: () => setActiveFilter("pending") },
    { label: "Overdue", value: stats.overdueCount, sub: `Older than ${OVERDUE_DAYS} days`, icon: FiClock, tone: "bg-red-50 text-red-600", onClick: () => setActiveFilter("overdue") },
    { label: "Collection rate", value: `${stats.collectionRate}%`, sub: `${formatCurrency(stats.paidTotal)} collected`, icon: FiPercent, tone: "bg-emerald-50 text-emerald-600", bar: true },
  ];

  const topDue = filteredPayments.filter((p) => p.due > 0).slice(0, 5);

  /* ---- render helpers (functions, not components, so they never remount) ---- */
  const renderActions = (p) => (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => setDetailPayment(p)} title="View details" aria-label={`View ${p.customer.name}`} className="rounded-lg p-2.5 text-navy-700 hover:bg-slate-100 sm:p-2">
        <FiEye className="h-4 w-4" />
      </button>
      {!readOnly && (
        <button
          type="button" onClick={() => handleSendReminder(p)} disabled={sendingWhatsappId === p.id || p.due <= 0}
          title="Send WhatsApp reminder" aria-label={`Send WhatsApp reminder to ${p.customer.name}`}
          className="rounded-lg p-2.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 sm:p-2"
        >
          {sendingWhatsappId === p.id ? <FiRefreshCw className="h-4 w-4 animate-spin" /> : <FiMessageSquare className="h-4 w-4" />}
        </button>
      )}
      {!readOnly && (
        <button
          type="button" onClick={() => openReceive(p)} disabled={p.due <= 0}
          className="ml-1 inline-flex items-center gap-1.5 rounded-lg bg-navy-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:py-1.5"
        >
          <FiCreditCard className="h-3.5 w-3.5" /> Receive
        </button>
      )}
    </div>
  );

  const renderPhone = (p) =>
    p.customer.phone ? (
      <a href={`https://wa.me/${waNumber(p.customer.phone)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-emerald-600">
        <FiPhone className="h-3.5 w-3.5" /> {p.customer.phone}
      </a>
    ) : (
      <span className="text-sm text-slate-400">—</span>
    );

  if (isLoading && payments.length === 0) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-xl bg-slate-100" />)}</div>
        <div className="h-24 rounded-2xl bg-slate-100" />
        <div className="h-80 rounded-2xl bg-slate-100" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="space-y-5">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!isSuperAdmin && (
            <button type="button" onClick={() => fetchPayments(true)} disabled={refreshing || isLoading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-navy-700 hover:bg-slate-50 disabled:opacity-60">
              <FiRefreshCw className={refreshing || isLoading ? "animate-spin" : ""} /> Refresh
            </button>
          )}
          <button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-navy-800">
            <FiDownload /> Export CSV
          </button>
        </div>

        {loadError && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span className="flex items-center gap-2"><FiAlertCircle className="h-4 w-4" /> Could not load payments.</span>
            <button type="button" onClick={() => fetchPayments(true)} className="font-medium underline">Retry</button>
          </div>
        )}

        {/* Stats */}
        <div>
          <div className="mb-2 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {tiles.map((t, i) => {
              const Tag = t.onClick ? "button" : "div";
              return (
                <Tag
                  key={t.label} type={t.onClick ? "button" : undefined} onClick={t.onClick}
                  className={`flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm ${t.onClick ? "hover:bg-slate-50" : ""} ${i === tiles.length - 1 ? "col-span-2 lg:col-span-1" : ""}`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${t.tone}`}><t.icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-slate-500">{t.label}</span>
                    <span className="block truncate text-xl font-bold tabular-nums text-slate-900">{t.value}</span>
                    <span className="block truncate text-xs text-slate-400">{t.sub}</span>
                    {t.bar && <span className="mt-1.5 block"><PaidBar paid={stats.paidTotal} total={stats.totalReceivables} /></span>}
                  </span>
                </Tag>
              );
            })}
          </div>
          <p className="text-xs text-slate-400">Figures reflect the date range and filters below.</p>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Quick date range">
            {PRESETS.map((r) => (
              <button
                key={r.id} type="button" onClick={() => applyPreset(r.id)} aria-pressed={activePreset === r.id}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${activePreset === r.id ? "border-navy-700 bg-navy-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {r.label}
              </button>
            ))}
            {activePreset === "custom" && <span className="px-1 text-xs text-slate-400">Custom range</span>}
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative lg:w-96">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customer, phone, service, staff or ID…" aria-label="Search payments"
                className={`${inputCls} pl-9`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1 sm:flex-none">
                <FiCalendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="date" value={activeFromDate} max={activeToDate || undefined} onChange={(e) => setActiveFromDate(e.target.value)} aria-label="From date" className={`${inputCls} min-w-0 pl-9 sm:w-auto`} />
              </div>
              <span className="text-sm text-slate-400">to</span>
              <div className="relative min-w-0 flex-1 sm:flex-none">
                <FiCalendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="date" value={activeToDate} min={activeFromDate || undefined} onChange={(e) => setActiveToDate(e.target.value)} aria-label="To date" className={`${inputCls} min-w-0 pl-9 sm:w-auto`} />
              </div>
              {filtersActive && (
                <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium text-navy-700 hover:bg-slate-100">
                  <FiX className="h-4 w-4" /> Reset
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 flex gap-1 overflow-x-auto border-t border-slate-100 pt-3" role="tablist" aria-label="Payment status">
            {TABS.map((t) => {
              const active = activeFilter === t.id;
              return (
                <button
                  key={t.id} type="button" role="tab" aria-selected={active} onClick={() => setActiveFilter(t.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${active ? "bg-navy-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {t.label}
                  {tabCounts[t.id] !== undefined && (
                    <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>{tabCounts[t.id]}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {mode === "history" && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
            Showing payments that were pending and have since been cleared. This list is read-only.
          </div>
        )}

        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {filteredPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
              <FiFileText className="mb-3 h-12 w-12 text-slate-300" />
              <p className="text-base font-medium text-slate-600">
                {filtersActive
                  ? `No ${mode === "history" ? "cleared" : "pending"} payments${activePreset === "today" ? " for today" : activePreset === "all" ? " match these filters" : " in this range"}`
                  : mode === "history" ? "No cleared payments yet" : "No pending payments"}
              </p>
              {activePreset !== "all" && (
                <button type="button" onClick={() => applyPreset("all")} className="mt-2 text-sm font-medium text-navy-700 hover:underline">Show all time</button>
              )}
              {filtersActive && <button type="button" onClick={clearFilters} className="mt-1 text-sm font-medium text-slate-500 hover:underline">Reset filters</button>}
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <ul className="divide-y divide-slate-100 md:hidden">
                {visible.map((p) => {
                  const overdue = p.due > 0 && isOverdue(p.createdAt);
                  return (
                    <li key={p.id} className={`p-4 ${overdue ? "bg-rose-50/40" : ""}`}>
                      <div className="flex items-start justify-between gap-3">
                        <button type="button" onClick={() => setDetailPayment(p)} className="flex min-w-0 items-center gap-3 text-left">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-700 text-xs font-bold text-white">{initials(p.customer.name)}</span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-900">{p.customer.name}</span>
                            <span className="block text-xs text-slate-400">ID: {p.id}</span>
                          </span>
                        </button>
                        <StatusChip payment={p} />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{p.service.type}</p>
                          {p.service.subcategory && <p className="truncate text-xs text-slate-500">{p.service.subcategory}</p>}
                        </div>
                        {renderPhone(p)}
                      </div>
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-xs text-slate-500">
                          <span>Paid <span className="font-medium tabular-nums text-emerald-600">{formatCurrency(p.paid)}</span> of <span className="tabular-nums">{formatCurrency(p.total)}</span></span>
                          <span className="font-semibold tabular-nums text-rose-600">Due {formatCurrency(p.due)}</span>
                        </div>
                        <PaidBar paid={p.paid} total={p.total} />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Staff: <span className="font-medium text-slate-700">{p.staff?.name || "—"}</span></p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1.5 text-xs ${overdue ? "text-rose-600" : "text-slate-500"}`}>
                          <FiCalendar className="h-3.5 w-3.5" /> {formatDate(p.createdAt)} · {daysSince(p.createdAt)}d
                        </span>
                        {renderActions(p)}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Service</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3">Paid</th>
                      <th className="px-4 py-3 text-right">Due</th>
                      <th className="px-4 py-3">Pending since</th>
                      <th className="px-4 py-3">Staff</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visible.map((p) => {
                      const overdue = p.due > 0 && isOverdue(p.createdAt);
                      return (
                        <tr key={p.id} className={overdue ? "bg-rose-50/40 hover:bg-rose-50" : "hover:bg-slate-50"}>
                          <td className="px-4 py-3">
                            <button type="button" onClick={() => setDetailPayment(p)} className="group flex items-center gap-3 text-left">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-700 text-xs font-bold text-white">{initials(p.customer.name)}</span>
                              <span>
                                <span className="block font-medium text-slate-900 group-hover:text-navy-700">{p.customer.name}</span>
                                <span className="block text-xs text-slate-400">ID: {p.id}</span>
                              </span>
                            </button>
                          </td>
                          <td className="px-4 py-3">{renderPhone(p)}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">{p.service.type}</p>
                            {p.service.subcategory && <p className="max-w-[14rem] truncate text-xs text-slate-500" title={p.service.subcategory}>{p.service.subcategory}</p>}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{formatCurrency(p.total)}</td>
                          <td className="min-w-[8rem] px-4 py-3">
                            <p className={`font-medium tabular-nums ${p.paid > 0 ? "text-emerald-600" : "text-slate-400"}`}>{formatCurrency(p.paid)}</p>
                            <div className="mt-1"><PaidBar paid={p.paid} total={p.total} /></div>
                          </td>
                          <td className={`px-4 py-3 text-right font-bold tabular-nums ${p.due > 0 ? "text-rose-600" : "text-emerald-600"}`}>{formatCurrency(p.due)}</td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <p className="text-slate-700">{formatDate(p.createdAt)}</p>
                            <p className="mt-0.5"><StatusChip payment={p} /></p>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{p.staff?.name || "—"}</td>
                          <td className="px-4 py-3">{renderActions(p)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">
                  Showing <span className="font-medium">{visible.length}</span> of <span className="font-medium">{filteredPayments.length}</span>
                  {filteredPayments.length !== payments.length && <> (of {payments.length} total)</>}
                  <span className="mx-2 text-slate-300">·</span>
                  Total due <span className="font-bold tabular-nums text-rose-600">{formatCurrency(stats.totalDue)}</span>
                </p>
                {visible.length < filteredPayments.length && (
                  <button type="button" onClick={() => setShown((n) => n + PAGE_SIZE)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-navy-700 hover:bg-slate-50">
                    Show {Math.min(PAGE_SIZE, filteredPayments.length - visible.length)} more
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Summary cards */}
        {filteredPayments.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Payment distribution</h3>
              <ul className="space-y-3">
                {[
                  { label: "Unpaid", n: stats.unpaidCount, bar: "bg-amber-500", text: "text-amber-600" },
                  { label: "Partially paid", n: stats.partialCount, bar: "bg-sky-500", text: "text-sky-600" },
                  { label: "Overdue", n: stats.overdueCount, bar: "bg-rose-500", text: "text-rose-600" },
                ].map((r) => (
                  <li key={r.label}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-slate-600">{r.label}</span>
                      <span className={`font-medium tabular-nums ${r.text}`}>{r.n} {r.n === 1 ? "service" : "services"}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${r.bar}`} style={{ width: `${(r.n / filteredPayments.length) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Top due amounts</h3>
              {topDue.length === 0 ? (
                <p className="text-sm text-slate-400">Nothing due.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {topDue.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => setDetailPayment(p)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-slate-50">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-900">{p.customer.name}</span>
                          <span className="block truncate text-xs text-slate-500">{p.service.type}</span>
                        </span>
                        <span className="shrink-0 font-bold tabular-nums text-rose-600">{formatCurrency(p.due)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <AnimatePresence>
          {detailPayment && (
            <PendingPaymentDetailModal key="detail" payment={detailPayment} onClose={() => setDetailPayment(null)} onRecord={openReceive} canRecord={!readOnly} />
          )}
          {receivePayment && !readOnly && (
            <ReceivePaymentModal
              key={`receive-${receivePayment.id}`} payment={receivePayment} wallets={wallets} walletsLoading={walletsLoading}
              onClose={() => setReceivePayment(null)} onSuccess={handlePaymentSuccess}
            />
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
};

export default PendingPaymentsSection;