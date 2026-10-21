// WalletReconciliation.jsx — put next to AccountingSection.jsx
// Count → Save (keeps history of variances) → Settle each wallet:
//   actual < system  → "Book shortage"  → admin expense (category: Shortage, no approval)
//   actual > system  → "Book excess"    → misc income
//   short in one wallet + excess in another → suggested transfer (fixes a wrong-wallet entry)
//
// History vs. live:
//   - "Variance"  = saved actual − saved system balance  → never changes, this is your history
//   - "To settle" = variance − what was booked FOR this count (settled_amount on the saved row)
//     Normal sales / expenses after the count don't change it any more — only the shortage /
//     excess bookings and the suggested correction transfers made from this screen do.
//   So a wallet can't be adjusted twice: once the bookings cover the variance, the button disappears.
//
// Needs (backend): wallet_reconciliations.settled_amount column,
//   PATCH /api/accounting/wallet-reconciliations/:id/settle,
//   and GET /api/accounting/wallet-reconciliations returning id + settled_amount.
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  FiCheckCircle, FiAlertCircle, FiAlertTriangle, FiRefreshCw, FiInfo,
  FiDollarSign, FiCreditCard, FiSmartphone, FiHome, FiDatabase, FiPackage, FiBook,
  FiPieChart, FiCheck, FiRepeat, FiArrowRight, FiTrendingDown, FiTrendingUp, FiSave,
} from 'react-icons/fi';
import { transferWallet } from '@/services/walletService';

const API = import.meta.env.VITE_API_URL;
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});
const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const istNowTime = () =>
  new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' }); // "HH:MM:SS" in IST
const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${inr(Math.abs(v))}`;

const RECON_TOLERANCE = 10; // within ±₹10 is shown as "Reconciled" (same rule as before)
const MIN_ADJUST = 1; // any difference of ₹1 or more can be booked
const SHORTAGE_CATEGORY = { id: 16, name: 'Shortage' }; // same as DEFAULT_CATEGORIES in AdminExpenseEntry

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed';
const labelCls = 'mb-1 block text-sm font-medium text-slate-700';
const sideCardCls = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';
const sideTitleCls = 'mb-3 flex items-center text-sm font-bold text-slate-900';
const thCls = 'px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500';
const actionBtnCls =
  'flex w-full items-center justify-between rounded-xl p-2 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-navy-500/30 disabled:cursor-not-allowed disabled:opacity-50';

const walletIcons = {
  cash: FiDollarSign, bank: FiCreditCard, digital: FiSmartphone,
  SBI: FiCreditCard, Counter: FiHome, 'Counter Cash': FiHome, Edistrict: FiSmartphone,
  'Pan Card': FiDatabase, 'PAN Card': FiDatabase, 'Paper 70 GSM': FiPackage, PVC: FiPackage,
  'Digital Wallet': FiSmartphone, 'Cash in Hand': FiDollarSign,
};
const typeTone = (t) =>
  t === 'cash' ? 'bg-emerald-500' : t === 'bank' ? 'bg-navy-700' : t === 'digital' ? 'bg-slate-500' : 'bg-navy-500';

const ReconModal = ({ title, subtitle, onClose, children, footer }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    onClick={onClose} role="dialog" aria-modal="true" aria-label={title}
  >
    <motion.div
      initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
      onClick={(e) => e.stopPropagation()}
      className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl"
    >
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="space-y-4 p-5">{children}</div>
      <div className="flex justify-end gap-3 border-t border-slate-200 p-4">{footer}</div>
    </motion.div>
  </motion.div>
);

const CancelBtn = (props) => (
  <button type="button" {...props}
    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
    Cancel
  </button>
);

const WalletReconciliation = ({
  wallets = [],
  onRefreshWallets,
  onAdjusted, // called after an expense / misc income / transfer is posted (e.g. refetch expenses)
  date,
  centreId,
  isSuperAdmin = false,
  readOnly = false,
}) => {
  const [walletBalances, setWalletBalances] = useState({}); // wallet_id -> typed actual (string)
  const [savedRows, setSavedRows] = useState({}); // wallet_id -> { recId, actual, book, settled }
  const [isSaving, setIsSaving] = useState(false);
  const [adjust, setAdjust] = useState(null); // { wallet, kind: 'shortage'|'excess', amount, description }
  const [transfer, setTransfer] = useState(null); // { from, to, amount, description }
  const [busy, setBusy] = useState(false);
  const isToday = date === todayIST();

  /* ---------- load saved reconciliation for this date ---------- */
  const loadSaved = useCallback(async () => {
    try {
      const params = new URLSearchParams({ date });
      if (isSuperAdmin && centreId) params.append('centreId', centreId);
      const res = await fetch(`${API}/api/accounting/wallet-reconciliations?${params}`, { headers: authHeaders() });
      if (!res.ok) return;
      const rows = await res.json();
      const saved = {};
      const actuals = {};
      (Array.isArray(rows) ? rows : []).forEach((r) => {
        const id = String(r.wallet_id);
        saved[id] = {
          recId: r.id ?? null,
          actual: Number(r.actual_balance),
          book: r.book_balance !== undefined && r.book_balance !== null ? Number(r.book_balance) : null,
          settled: Number(r.settled_amount || 0), // booked against this count so far (signed)
        };
        actuals[id] = String(Number(r.actual_balance));
      });
      setSavedRows(saved);
      setWalletBalances(actuals);
    } catch (err) {
      console.error('Failed to load saved reconciliations', err);
    }
  }, [date, centreId, isSuperAdmin]);

  useEffect(() => {
    setSavedRows({});
    setWalletBalances({});
    if (date) loadSaved();
  }, [date, loadSaved]);

  /* ---------- derived per wallet ---------- */
  const processed = useMemo(
    () =>
      wallets.map((w) => {
        const id = String(w.id);
        const saved = savedRows[id];
        const entry = walletBalances[id];
        const actual = entry === undefined || entry === '' ? null : Number(entry);
        const liveBook = round2(w.book_balance ?? 0); // current system balance (moves with every transaction)
        const dirty = actual !== null && (!saved || round2(saved.actual) !== round2(actual));
        const savedBook = saved && saved.book !== null ? round2(saved.book) : null;
        // System balance the count is compared with:
        //  - saved row → the balance at the time of saving (history)
        //  - re-counting a saved wallet → that balance plus what was already booked for it,
        //    so a new save doesn't ask you to book the same difference again
        const book =
          savedBook === null ? liveBook : dirty ? round2(savedBook + (saved.settled || 0)) : savedBook;
        const variance = actual === null ? null : round2(actual - book);
        // still to book = variance − what was booked for this count
        const remaining =
          saved && !dirty && savedBook !== null ? round2(saved.actual - savedBook - (saved.settled || 0)) : null;
        const type = w.wallet_type || w.type || 'unknown';
        const status = actual === null ? 'uncounted' : Math.abs(variance) <= RECON_TOLERANCE ? 'reconciled' : 'mismatch';
        const settled = remaining !== null && Math.abs(remaining) < MIN_ADJUST;
        return { ...w, id, type, actual, liveBook, book, variance, saved: !!saved, dirty, remaining, status, settled };
      }),
    [wallets, savedRows, walletBalances]
  );

  const countedCount = processed.filter((w) => w.actual !== null).length;
  const reconciledCount = processed.filter((w) => w.status === 'reconciled').length;
  const unsavedCount = processed.filter((w) => w.dirty).length;
  const toSettle = processed.filter((w) => w.remaining !== null && !w.settled);
  const totalVariance = processed.reduce((s, w) => s + Math.abs(w.variance || 0), 0);
  const totalShort = toSettle.filter((w) => w.remaining < 0).reduce((s, w) => s - w.remaining, 0);
  const totalExcess = toSettle.filter((w) => w.remaining > 0).reduce((s, w) => s + w.remaining, 0);

  // Short wallet + excess wallet = money probably recorded in the wrong wallet.
  // Fix in the system: move the amount FROM the short wallet TO the excess wallet.
  const suggestions = useMemo(() => {
    const shorts = toSettle.filter((w) => w.remaining < 0).map((w) => ({ w, left: -w.remaining })).sort((a, b) => b.left - a.left);
    const excess = toSettle.filter((w) => w.remaining > 0).map((w) => ({ w, left: w.remaining })).sort((a, b) => b.left - a.left);
    const out = [];
    shorts.forEach((s) => {
      excess.forEach((e) => {
        const amount = round2(Math.min(s.left, e.left));
        if (amount >= MIN_ADJUST) {
          out.push({ from: s.w, to: e.w, amount });
          s.left = round2(s.left - amount);
          e.left = round2(e.left - amount);
        }
      });
    });
    return out;
  }, [toSettle]);

  /* ---------- actions ---------- */
  const afterPosting = async () => {
    await onRefreshWallets?.(date);
    await onAdjusted?.();
  };

  const handleSave = async () => {
    if (readOnly) return;
    if (processed.every((w) => w.actual === null)) return toast.error('Enter the actual balance for at least one wallet');
    // Only new or changed counts. Re-saving an unchanged wallet would create a new row with
    // nothing booked against it, and the page would ask you to book the same difference again.
    const counted = processed.filter((w) => w.dirty);
    if (counted.length === 0) return toast.info('Nothing new to save');
    setIsSaving(true);
    try {
      const res = await fetch(`${API}/api/accounting/wallet-reconcile`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          date,
          reconciliations: counted.map((w) => ({
            wallet_id: Number(w.id),
            book_balance: w.book,
            actual_balance: w.actual,
            variance: w.variance,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save reconciliation');
      }
      await loadSaved();
      await onRefreshWallets?.(date);
      toast.success('Reconciliation saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Record a booking against the saved count. amount = change in the system balance
  // (+ excess booked / correction in, − shortage booked / correction out).
  const markSettled = async (wallet, amount) => {
    const recId = savedRows[String(wallet?.id)]?.recId;
    if (!recId) throw new Error('missing reconciliation id');
    const res = await fetch(`${API}/api/accounting/wallet-reconciliations/${recId}/settle`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ amount: round2(amount) }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to mark as settled');
    }
    // Update the saved count on screen straight away, so "To settle" drops to Nil
    // and the Book button disappears (it used to stay until the page was reloaded,
    // which let the same shortage be booked twice).
    const data = await res.json().catch(() => null);
    const id = String(wallet.id);
    setSavedRows((prev) => {
      if (!prev[id]) return prev;
      const settled = data && data.settled_amount !== undefined
        ? Number(data.settled_amount)
        : round2((prev[id].settled || 0) + amount);
      return { ...prev, [id]: { ...prev[id], settled } };
    });
  };

  // The booking itself went through; only the "settled" mark failed.
  const warnNotMarked = (names) =>
    toast.warning(
      `Booked, but it couldn't be marked against the count for ${names}. Don't book it again — refresh and check the ledger.`,
      { autoClose: 10000 }
    );

  const openAdjust = (w) => {
    const kind = w.remaining < 0 ? 'shortage' : 'excess';
    setAdjust({
      wallet: w,
      kind,
      amount: String(Math.abs(w.remaining)),
      description: kind === 'shortage'
        ? `Shortage in ${w.name} – reconciliation ${date}`
        : `Excess in ${w.name} – reconciliation ${date}`,
    });
  };

  const submitAdjust = async () => {
    const amount = Number(adjust.amount);
    if (!(amount > 0)) return toast.error('Enter a valid amount');
    if (!adjust.description.trim()) return toast.error('Add a description');
    const w = adjust.wallet;
    setBusy(true);
    try {
      let res;
      if (adjust.kind === 'shortage') {
        // Same payload shape AdminExpenseEntry sends
        res = await fetch(`${API}/api/expense`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            category_id: SHORTAGE_CATEGORY.id,
            category: SHORTAGE_CATEGORY.name,
            amount,
            description: adjust.description.trim(),
            payment_method: w.type === 'cash' ? 'cash' : 'online',
            wallet_id: Number(w.id),
            team_id: null,
            expense_date: date,
            receipt_number: '',
            remarks: `Wallet reconciliation ${date}: system ${inr(w.liveBook)}, actual ${inr(w.actual)}`,
            is_recurring: false,
            recurrence_type: 'none',
            attachment: '',
            requires_approval: false,
          }),
        });
      } else {
        // Same as the "Add Misc Income" modal: reconciliation date + current time, in IST
        res = await fetch(`${API}/api/accounting/misc-income`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            amount,
            wallet_id: Number(w.id),
            description: adjust.description.trim(),
            date: `${date}T${istNowTime()}+05:30`,
          }),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to post adjustment');
      }
      try {
        await markSettled(w, adjust.kind === 'shortage' ? -amount : amount);
      } catch (e) {
        console.error(e);
        warnNotMarked(w.name);
      }
      toast.success(
        adjust.kind === 'shortage'
          ? `${inr(amount)} shortage booked as expense for ${w.name}`
          : `${inr(amount)} excess booked as misc income for ${w.name}`
      );
      setAdjust(null);
      await afterPosting();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openTransfer = (s) =>
    setTransfer(
      s
        ? {
            from: s.from.id,
            to: s.to.id,
            amount: String(s.amount),
            description: `Reconciliation correction ${date}: ${s.from.name} → ${s.to.name}`,
            correction: true, // fixes a wrong-wallet entry → counts against both saved counts
          }
        : // a normal transfer (e.g. cash deposited to bank) moves real money too,
          // so it doesn't change the variance and isn't marked as settled
          { from: '', to: '', amount: '', description: '', correction: false }
    );

  const submitTransfer = async () => {
    const amount = Number(transfer.amount);
    if (!transfer.from || !transfer.to || !(amount > 0)) return toast.error('Choose both wallets and enter a valid amount');
    if (transfer.from === transfer.to) return toast.error('Source and destination must be different');
    const staffId = Number(localStorage.getItem('id'));
    if (!staffId) return toast.error('Session expired. Please log in again.');
    const fromW = processed.find((w) => w.id === transfer.from);
    const toW = processed.find((w) => w.id === transfer.to);
    setBusy(true);
    try {
      await transferWallet({
        from_wallet_id: Number(transfer.from),
        to_wallet_id: Number(transfer.to),
        amount,
        description: transfer.description.trim() || `Transfer from ${fromW?.name} to ${toW?.name}`,
        category: 'Transfer',
        staff_id: staffId,
      });
      if (transfer.correction) {
        const failed = [];
        for (const [w, change] of [[fromW, -amount], [toW, amount]]) {
          if (!savedRows[String(w?.id)]) continue; // wallet wasn't counted
          try {
            await markSettled(w, change);
          } catch (e) {
            console.error(e);
            failed.push(w?.name);
          }
        }
        if (failed.length) warnNotMarked(failed.join(' and '));
      }
      toast.success(`${inr(amount)} moved from ${fromW?.name} to ${toW?.name}`);
      setTransfer(null);
      await afterPosting();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Transfer failed');
    } finally {
      setBusy(false);
    }
  };

  /* ---------- small renderers ---------- */
  const statusPill = (w) => {
    const map = {
      uncounted: ['bg-slate-100 text-slate-600', null, 'Not counted'],
      reconciled: ['bg-emerald-50 text-emerald-700', FiCheck, 'Reconciled'],
      mismatch: ['bg-rose-50 text-rose-700', FiAlertCircle, 'Review'],
    };
    const [cls, Icon, label] = map[w.status];
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
        {Icon && <Icon className="mr-1 h-2.5 w-2.5" />}
        {label}
      </span>
    );
  };

  const actualInput = (w) => (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">₹</span>
      <input
        type="number"
        value={walletBalances[w.id] ?? ''}
        onChange={(e) => setWalletBalances((p) => ({ ...p, [w.id]: e.target.value }))}
        disabled={readOnly}
        aria-label={`Actual balance for ${w.name}`}
        placeholder="Count"
        className={`w-full rounded-xl border bg-white py-1.5 pl-6 pr-2 text-sm text-slate-900 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30 disabled:cursor-not-allowed disabled:bg-slate-50 md:w-32 ${
          w.dirty ? 'border-amber-400' : 'border-slate-300'
        }`}
      />
    </div>
  );

  const varianceText = (w) =>
    w.variance === null ? (
      <span className="text-xs text-slate-400">—</span>
    ) : (
      <span className={`text-xs font-bold ${w.status === 'reconciled' ? 'text-emerald-600' : 'text-rose-600'}`}>
        {signed(w.variance)}
      </span>
    );

  const remainingText = (w) => {
    if (w.remaining === null) return <span className="text-xs text-slate-400">{w.dirty ? 'Unsaved' : '—'}</span>;
    if (w.settled) return <span className="text-xs font-medium text-emerald-600">✓ Nil</span>;
    return (
      <span className={`text-xs font-bold ${w.remaining < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
        {w.remaining < 0 ? `Short ${inr(-w.remaining)}` : `Excess ${inr(w.remaining)}`}
      </span>
    );
  };

  const actionCell = (w) => {
    if (w.actual === null) return <span className="text-xs text-slate-400">Enter count</span>;
    if (w.dirty) return <span className="text-xs font-medium text-amber-600">Save first</span>;
    if (w.settled) {
      return Math.abs(w.variance || 0) >= MIN_ADJUST ? (
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          <FiCheckCircle className="mr-1 h-3 w-3" /> Settled
        </span>
      ) : (
        <span className="text-xs text-slate-400">—</span>
      );
    }
    if (readOnly) return null;
    // Expense wallet entries are always posted at NOW(), so a back-dated booking would land
    // in today's ledger, not the reconciliation date. Settling is therefore today-only.
    if (!isToday) return <span className="text-xs text-slate-400">Today only</span>;
    const short = w.remaining < 0;
    return (
      <button
        type="button"
        onClick={() => openAdjust(w)}
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold text-white focus:outline-none focus:ring-2 ${
          short ? 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500/40' : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/40'
        }`}
      >
        {short ? <FiTrendingDown className="h-3 w-3" /> : <FiTrendingUp className="h-3 w-3" />}
        {short ? 'Book shortage' : 'Book excess'}
      </button>
    );
  };

  const walletLabel = (w) => {
    const Icon = walletIcons[w.name] || walletIcons[w.type] || FiSmartphone;
    return (
      <div className="flex min-w-0 items-center">
        <div className={`mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${typeTone(w.type)}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-900">{w.name}</p>
          <p className="text-xs capitalize text-slate-500">{w.type}</p>
        </div>
      </div>
    );
  };

  const transferFrom = transfer ? processed.find((w) => w.id === transfer.from) : null;
  const transferExceeds = transferFrom && Number(transfer.amount) > transferFrom.liveBook;

  /* ---------- render ---------- */
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Left column */}
      <div className="order-2 space-y-4 lg:order-1 lg:col-span-1">
        <div className={sideCardCls}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-slate-100 p-2">
                <FiCheckCircle className="h-4 w-4 text-navy-700" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Reconciliation Status</p>
                <p className="text-lg font-bold text-slate-900">
                  {reconciledCount}/{wallets.length} Wallets
                </p>
              </div>
            </div>
            <span className={`inline-flex items-center rounded-lg px-2 py-1 text-xs font-medium ${
              wallets.length > 0 && reconciledCount === wallets.length ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {wallets.length > 0 && reconciledCount === wallets.length ? 'All Synced' : 'Pending'}
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-slate-600">Counted</span><span className="font-medium text-slate-900">{countedCount} of {wallets.length}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Total variance (saved)</span><span className={`font-bold ${totalVariance === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{inr(totalVariance)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Shortage to settle</span><span className="font-bold text-rose-600">{inr(totalShort)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Excess to settle</span><span className="font-bold text-emerald-600">{inr(totalExcess)}</span></div>
            {unsavedCount > 0 && (
              <div className="flex justify-between"><span className="text-amber-700">Unsaved counts</span><span className="font-bold text-amber-700">{unsavedCount}</span></div>
            )}
          </div>
        </div>

        {/* Wallet types */}
        <div className={sideCardCls}>
          <h3 className={sideTitleCls}><FiPieChart className="mr-2 h-4 w-4 text-navy-700" />Wallet Types</h3>
          <div className="space-y-2">
            {Object.entries(processed.reduce((acc, w) => {
              acc[w.type] = acc[w.type] || { count: 0, total: 0 };
              acc[w.type].count += 1;
              acc[w.type].total += w.liveBook;
              return acc;
            }, {})).map(([type, v]) => (
              <div key={type} className="flex items-center justify-between rounded-lg p-2 hover:bg-slate-50">
                <span className="text-xs font-medium capitalize text-slate-700">{type}</span>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-900">{v.count} wallets</p>
                  <p className="text-xs text-slate-500">{inr(v.total)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className={sideCardCls}>
          <h3 className={sideTitleCls}><FiRefreshCw className="mr-2 h-4 w-4 text-navy-700" />Quick Actions</h3>
          <div className="space-y-1">
            <button type="button" onClick={() => onRefreshWallets?.(date)} className={actionBtnCls}>
              <span className="flex items-center gap-2"><FiRefreshCw className="h-4 w-4 text-navy-700" /><span className="text-xs font-medium text-slate-900">Refresh Balances</span></span>
            </button>
            {!readOnly && (
              <>
                <button type="button" onClick={handleSave} disabled={isSaving} className={actionBtnCls}>
                  <span className="flex items-center gap-2"><FiSave className="h-4 w-4 text-emerald-600" /><span className="text-xs font-medium text-slate-900">{isSaving ? 'Saving…' : 'Save Reconciliation'}</span></span>
                </button>
                <button type="button" onClick={() => openTransfer(null)} disabled={!isToday || wallets.length < 2} className={actionBtnCls}>
                  <span className="flex items-center gap-2"><FiRepeat className="h-4 w-4 text-amber-600" /><span className="text-xs font-medium text-slate-900">Transfer Between Wallets</span></span>
                </button>
              </>
            )}
          </div>
          {!readOnly && !isToday && (
            <p className="mt-2 text-xs text-slate-500">Bookings and transfers post to today's ledger, so they're only available for today's reconciliation. Past dates can be viewed and saved only.</p>
          )}
        </div>
      </div>

      {/* Right column */}
      <div className="order-1 min-w-0 space-y-4 lg:order-2 lg:col-span-2">
        {/* Suggested transfers */}
        {!readOnly && suggestions.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="mb-1 flex items-center text-sm font-bold text-amber-900">
              <FiAlertTriangle className="mr-2 h-4 w-4" /> Possible wrong-wallet entries
            </h3>
            <p className="mb-3 text-xs text-amber-800">
              One wallet is short and another has excess. If the money was recorded in the wrong wallet, a transfer fixes both — no expense or income needed.
            </p>
            <div className="space-y-2">
              {suggestions.map((s) => (
                <div key={`${s.from.id}-${s.to.id}`} className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-slate-900">{s.from.name}</span>
                    <FiArrowRight className="h-4 w-4 text-slate-400" />
                    <span className="font-medium text-slate-900">{s.to.name}</span>
                    <span className="font-bold text-navy-700">{inr(s.amount)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openTransfer(s)}
                    disabled={!isToday}
                    title={isToday ? undefined : 'Only for today’s reconciliation'}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FiRepeat className="h-3 w-3" /> Transfer
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center text-sm font-bold text-slate-900">
                <FiSmartphone className="mr-2 h-4 w-4 text-navy-700" /> Wallet Reconciliation
              </h3>
              <button type="button" onClick={() => onRefreshWallets?.(date)} aria-label="Refresh balances"
                className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-500/30">
                <FiRefreshCw className="h-3 w-3" />
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              <b>Variance</b> is what you saved (kept as history). <b>To settle</b> is the variance minus what you have booked or correction-transferred for this count. Normal sales and expenses after the count don't change it.
            </p>
          </div>

          {processed.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-xs text-slate-500">
              <FiSmartphone className="mb-2 h-8 w-8 text-slate-300" /> No wallets to reconcile
            </div>
          )}

          {/* Mobile cards */}
          <div className="divide-y divide-slate-100 md:hidden">
            {processed.map((w) => (
              <div key={`m-${w.id}`} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  {walletLabel(w)}
                  {statusPill(w)}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1 text-xs text-slate-500">System balance</p>
                    <p className="text-sm font-bold text-slate-900">{inr(w.book)}</p>
                    {w.saved && w.liveBook !== w.book && <p className="text-xs text-slate-500">Now {inr(w.liveBook)}</p>}
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-slate-500">Actual balance</p>
                    {actualInput(w)}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <div className="text-xs">
                    <span className="text-slate-500">Variance </span>{varianceText(w)}
                    <span className="mx-1 text-slate-300">·</span>
                    {remainingText(w)}
                  </div>
                  {actionCell(w)}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          {processed.length > 0 && (
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className={thCls}>Wallet</th>
                    <th className={thCls}>System</th>
                    <th className={thCls}>Actual</th>
                    <th className={thCls}>Variance</th>
                    <th className={thCls}>To settle</th>
                    <th className={thCls}>Status</th>
                    <th className={thCls}><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processed.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3">{walletLabel(w)}</td>
                      <td className="px-3 py-3">
                        <p className="text-xs font-bold text-slate-900">{inr(w.book)}</p>
                        {w.saved && w.liveBook !== w.book ? (
                          <p className="text-xs text-slate-500">Now {inr(w.liveBook)}</p>
                        ) : (
                          <p className="flex items-center text-xs text-slate-500"><FiBook className="mr-1 h-2 w-2" />Ledger</p>
                        )}
                      </td>
                      <td className="px-3 py-3">{actualInput(w)}</td>
                      <td className="px-3 py-3">{varianceText(w)}</td>
                      <td className="px-3 py-3">{remainingText(w)}</td>
                      <td className="px-3 py-3">{statusPill(w)}</td>
                      <td className="px-3 py-3 text-right">{actionCell(w)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!readOnly && processed.length > 0 && (
            <div className="border-t border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <FiInfo className="h-3 w-3 shrink-0" />
                  <span>1. Enter counts → 2. Save → 3. Transfer or book each shortage / excess</span>
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center justify-center gap-2 rounded-xl bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                >
                  {isSaving ? <FiRefreshCw className="h-4 w-4 animate-spin" /> : <FiCheckCircle className="h-4 w-4" />}
                  {isSaving ? 'Saving…' : unsavedCount > 0 ? `Save Reconciliation (${unsavedCount})` : 'Save Reconciliation'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Book shortage / excess */}
      <AnimatePresence>
        {adjust && (
          <ReconModal
            title={adjust.kind === 'shortage' ? 'Book Shortage as Expense' : 'Book Excess as Misc Income'}
            subtitle={`${adjust.wallet.name} · system ${inr(adjust.wallet.liveBook)} · actual ${inr(adjust.wallet.actual)}`}
            onClose={() => !busy && setAdjust(null)}
            footer={
              <>
                <CancelBtn onClick={() => setAdjust(null)} disabled={busy} />
                <button
                  type="button"
                  onClick={submitAdjust}
                  disabled={busy}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60 ${
                    adjust.kind === 'shortage' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {busy && <FiRefreshCw className="h-4 w-4 animate-spin" />}
                  {adjust.kind === 'shortage' ? 'Add Expense' : 'Record Income'}
                </button>
              </>
            }
          >
            <div className={`rounded-xl border p-3 text-xs ${adjust.kind === 'shortage' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
              {adjust.kind === 'shortage'
                ? `An expense in category "${SHORTAGE_CATEGORY.name}" will be debited from ${adjust.wallet.name}, dated ${date}. No approval needed.`
                : `A misc income will be credited to ${adjust.wallet.name}, dated ${date}.`}
            </div>
            <p className="flex items-start gap-1.5 text-xs text-slate-500">
              <FiInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {adjust.kind === 'shortage'
                ? 'If this is a forgotten expense or a payment entered in the wrong wallet, add the real expense or transfer instead. Booking both counts the money twice.'
                : 'If this is an unrecorded service payment or money entered in the wrong wallet, record that instead. Booking both counts it twice.'}
            </p>
            <div>
              <label htmlFor="adj-amount" className={labelCls}>Amount (₹) *</label>
              <input id="adj-amount" type="number" min="0" step="0.01" className={inputCls}
                value={adjust.amount} onChange={(e) => setAdjust((a) => ({ ...a, amount: e.target.value }))} />
              {Number(adjust.amount) > 0 && Math.abs(Number(adjust.amount) - Math.abs(adjust.wallet.remaining)) >= MIN_ADJUST && (
                <p className="mt-1 text-xs text-amber-600">
                  The difference is {inr(Math.abs(adjust.wallet.remaining))}. A different amount leaves the wallet unsettled.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="adj-desc" className={labelCls}>Description *</label>
              <textarea id="adj-desc" rows={2} className={inputCls}
                value={adjust.description} onChange={(e) => setAdjust((a) => ({ ...a, description: e.target.value }))} />
            </div>
          </ReconModal>
        )}
      </AnimatePresence>

      {/* Transfer */}
      <AnimatePresence>
        {transfer && (
          <ReconModal
            title="Transfer Between Wallets"
            subtitle="Posted now, with today's date"
            onClose={() => !busy && setTransfer(null)}
            footer={
              <>
                <CancelBtn onClick={() => setTransfer(null)} disabled={busy} />
                <button
                  type="button"
                  onClick={submitTransfer}
                  disabled={busy || !transfer.from || !transfer.to || !(Number(transfer.amount) > 0)}
                  className="flex items-center gap-2 rounded-xl bg-navy-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-navy-800 disabled:opacity-50"
                >
                  {busy ? <FiRefreshCw className="h-4 w-4 animate-spin" /> : <FiRepeat className="h-4 w-4" />}
                  Transfer
                </button>
              </>
            }
          >
            <div>
              <label htmlFor="tr-from" className={labelCls}>From *</label>
              <select id="tr-from" className={inputCls} value={transfer.from}
                onChange={(e) => setTransfer((t) => ({ ...t, from: e.target.value, to: t.to === e.target.value ? '' : t.to, correction: false }))}>
                <option value="">Select source wallet</option>
                {processed.map((w) => <option key={w.id} value={w.id}>{w.name} ({inr(w.liveBook)})</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="tr-to" className={labelCls}>To *</label>
              <select id="tr-to" className={inputCls} value={transfer.to}
                onChange={(e) => setTransfer((t) => ({ ...t, to: e.target.value, correction: false }))}>
                <option value="">Select destination wallet</option>
                {processed.filter((w) => w.id !== transfer.from).map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({inr(w.liveBook)})</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tr-amount" className={labelCls}>Amount (₹) *</label>
              <input id="tr-amount" type="number" min="0" step="0.01" className={inputCls}
                value={transfer.amount} onChange={(e) => setTransfer((t) => ({ ...t, amount: e.target.value }))} />
              {transferExceeds && (
                <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                  <FiAlertCircle className="h-3.5 w-3.5" /> More than the {inr(transferFrom.liveBook)} in {transferFrom.name}.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="tr-desc" className={labelCls}>Note</label>
              <input id="tr-desc" className={inputCls} placeholder="e.g. Deposit counter cash to bank"
                value={transfer.description} onChange={(e) => setTransfer((t) => ({ ...t, description: e.target.value }))} />
            </div>
          </ReconModal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WalletReconciliation;