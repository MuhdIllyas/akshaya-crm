import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  FiDollarSign, FiCalendar, FiFileText, FiSave, FiTag, FiCheck, FiSearch, FiAlertCircle, FiRepeat, FiInfo,
} from "react-icons/fi";

// Default expense categories (can be overridden via props)
const DEFAULT_CATEGORIES = [
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
  { id: 20, name: "Donations", color: "#DB2777", icon: "🤝", requires_approval: false },
];

const PAYMENT_METHODS = [
  { id: "cash", name: "Cash", icon: "💰" },
  { id: "bank_transfer", name: "Bank transfer", icon: "🏦" },
  { id: "cheque", name: "Cheque", icon: "📝" },
  { id: "online", name: "Online payment", icon: "💳" },
];

// Wallet type metadata (same as staff)
const WALLET_TYPE_META = {
  bank: { label: "Bank account", icon: "🏦" },
  cash: { label: "Cash", icon: "💰" },
  credit_card: { label: "Credit card", icon: "💳" },
  digital: { label: "Digital wallet", icon: "📱" },
  savings: { label: "Savings", icon: "🏧" },
};
const getWalletMeta = (wallet) => WALLET_TYPE_META[wallet.type || wallet.wallet_type] || { label: "Wallet", icon: "💼" };

// today in IST as YYYY-MM-DD (toISOString() would give the UTC date, which is "yesterday" until 5:30 AM IST)
const todayIst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(amount) || 0);

const inputCls =
  "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-navy-500/40 disabled:bg-slate-50";

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

const AdminExpenseEntry = ({
  initialData = {},
  onSubmit,
  onCancel,
  wallets = [],
  categories = [],
  teams = [],
  title = "New Expense Entry",
  submitButtonText = "Submit Expense",
  isLoading = false,
}) => {
  // Use provided categories or defaults
  const expenseCategories = categories.length > 0 ? categories : DEFAULT_CATEGORIES;

  const [formData, setFormData] = useState({
    category_id: initialData.category_id || "",
    amount: initialData.amount || "",
    description: initialData.description || "",
    payment_method: initialData.payment_method || "cash",
    wallet_id: initialData.wallet_id || "",
    team_id: initialData.team_id || "",
    expense_date: initialData.expense_date || todayIst(),
    receipt_number: initialData.receipt_number || "",
    remarks: initialData.remarks || "",
    is_recurring: initialData.is_recurring || false,
    recurrence_type: initialData.recurrence_type || "none",
    attachment: initialData.attachment || "",
  });
  const [categorySearch, setCategorySearch] = useState("");
  const [errors, setErrors] = useState({});
  const [errorTick, setErrorTick] = useState(0);

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    return expenseCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [expenseCategories, categorySearch]);

  const selectedCategory = expenseCategories.find((c) => c.id === parseInt(formData.category_id, 10));
  const selectedWallet = wallets.find((w) => w.id === parseInt(formData.wallet_id, 10));
  const amountNum = Number(formData.amount) || 0;
  const balance = selectedWallet ? Number(selectedWallet.balance) || 0 : 0;
  const overdraw = selectedWallet && amountNum > balance;

  // bring the first invalid field into view after a failed submit
  useEffect(() => {
    if (errorTick === 0) return;
    document.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [errorTick]);

  const set = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    set(name, type === "checkbox" ? checked : value);
  };

  const validate = () => {
    const er = {};
    if (!selectedCategory) er.category_id = "Select a category";
    if (!(amountNum > 0)) er.amount = "Enter an amount greater than 0";
    if (!formData.description.trim()) er.description = "Add a short description";
    if (!formData.expense_date) er.expense_date = "Select the expense date";
    if (!selectedWallet) er.wallet_id = "Select the wallet the money is debited from";
    if (formData.is_recurring && formData.recurrence_type === "none") er.recurrence_type = "Choose how often it repeats";
    return er;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLoading) return;
    const er = validate();
    setErrors(er);
    if (Object.keys(er).length > 0) { setErrorTick((t) => t + 1); return; }

    // Prepare payload (unchanged shape)
    const payload = {
      ...formData,
      description: formData.description.trim(),
      amount: Number(formData.amount),
      wallet_id: Number(formData.wallet_id),
      team_id: formData.team_id ? Number(formData.team_id) : null,
      category: selectedCategory?.name,
      // ADMIN OVERRIDE
      requires_approval: false,
    };
    onSubmit(payload);
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-white">
      <div className="border-b border-slate-100 px-6 py-5">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">Choose what it was for, how much, and which wallet it is paid from.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 px-6 py-5" noValidate>
        <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <FiInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Entries made by an admin skip the approval step.
        </p>

        {/* Category */}
        <Field label="Category" required error={errors.category_id}>
          <div className="relative">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text" placeholder="Search categories…" value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              className={`${inputCls} border-slate-200 pl-9`} aria-label="Search categories"
            />
          </div>
          <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2" role="radiogroup" aria-label="Category">
            {filteredCategories.length === 0 && <p className="col-span-full py-4 text-center text-sm text-slate-400">No category matches “{categorySearch}”</p>}
            {filteredCategories.map((category) => {
              const on = parseInt(formData.category_id, 10) === category.id;
              return (
                <label
                  key={category.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3 py-2 transition focus-within:ring-2 focus-within:ring-navy-500/40 ${on ? "border-navy-500 bg-slate-50" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <input type="radio" name="category_id" value={category.id} checked={on} onChange={handleInputChange} className="sr-only" />
                  <span className="text-lg">{category.icon}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{category.name}</span>
                  {on && <FiCheck className="h-4 w-4 shrink-0 text-navy-700" />}
                </label>
              );
            })}
          </div>
        </Field>

        {/* Amount / date / description */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Amount (₹)" required error={errors.amount}>
            <IconInput icon={FiDollarSign} error={errors.amount} type="number" inputMode="decimal" name="amount" value={formData.amount} onChange={handleInputChange} placeholder="0.00" min="0" step="0.01" />
          </Field>
          <Field label="Expense date" required error={errors.expense_date}>
            <IconInput icon={FiCalendar} error={errors.expense_date} type="date" name="expense_date" value={formData.expense_date} onChange={handleInputChange} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description" required error={errors.description}>
              <IconInput icon={FiFileText} error={errors.description} type="text" name="description" value={formData.description} onChange={handleInputChange} placeholder="Brief description of the expense" />
            </Field>
          </div>
        </div>

        {/* Wallet */}
        <Field label="Pay from wallet" required error={errors.wallet_id} hint={wallets.length === 0 ? "No wallets are available for this centre." : undefined}>
          <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2" role="radiogroup" aria-label="Wallet">
            {wallets.map((wallet) => {
              const on = parseInt(formData.wallet_id, 10) === wallet.id;
              const meta = getWalletMeta(wallet);
              const bal = Number(wallet.balance) || 0;
              return (
                <label
                  key={wallet.id}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 px-3 py-2.5 transition focus-within:ring-2 focus-within:ring-navy-500/40 ${on ? "border-navy-500 bg-slate-50" : "border-slate-200 hover:border-slate-300"}`}
                >
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
          {selectedWallet && amountNum > 0 && (
            <p className={`flex items-center gap-1.5 text-xs ${overdraw ? "text-amber-600" : "text-slate-500"}`}>
              {overdraw && <FiAlertCircle className="h-3.5 w-3.5" />}
              {overdraw
                ? `This is ${formatCurrency(amountNum - balance)} more than the wallet holds.`
                : `Balance after this expense: ${formatCurrency(balance - amountNum)}`}
            </p>
          )}
        </Field>

        {/* Payment method */}
        <Field label="Payment method" required>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Payment method">
            {PAYMENT_METHODS.map((method) => {
              const on = formData.payment_method === method.id;
              return (
                <label key={method.id} className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-2 py-2 text-sm font-medium transition focus-within:ring-2 focus-within:ring-navy-500/40 ${on ? "border-navy-500 bg-slate-50 text-navy-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                  <input type="radio" name="payment_method" value={method.id} checked={on} onChange={handleInputChange} className="sr-only" />
                  <span>{method.icon}</span><span className="truncate">{method.name}</span>
                </label>
              );
            })}
          </div>
        </Field>

        {/* Team (only when teams are provided) */}
        {teams.length > 0 && (
          <Field label="Assign team" hint="Optional: assign this expense to a specific team">
            <select name="team_id" value={formData.team_id} onChange={handleInputChange} className={`${inputCls} border-slate-200`}>
              <option value="">No team (general expense)</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}{team.is_global || team.centre_id == null ? " (Global)" : ""}</option>)}
            </select>
          </Field>
        )}

        {/* Receipt + recurring */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Receipt / bill number">
            <IconInput icon={FiTag} type="text" name="receipt_number" value={formData.receipt_number} onChange={handleInputChange} placeholder="If any" />
          </Field>
          <div className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Repeats</span>
            <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition ${formData.is_recurring ? "border-navy-500 bg-slate-50 text-navy-700" : "border-slate-200 text-slate-600"}`}>
              <input type="checkbox" name="is_recurring" checked={formData.is_recurring} onChange={handleInputChange} className="h-4 w-4 rounded border-slate-300 text-navy-700 focus:ring-navy-500" />
              <FiRepeat className="h-4 w-4" /> This is a recurring expense
            </label>
          </div>
          {formData.is_recurring && (
            <div className="sm:col-span-2">
              <Field label="Recurrence" required error={errors.recurrence_type}>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1" role="radiogroup" aria-label="Recurrence">
                  {[["monthly", "Monthly"], ["quarterly", "Quarterly"], ["yearly", "Yearly"]].map(([v, l]) => (
                    <button key={v} type="button" role="radio" aria-checked={formData.recurrence_type === v} onClick={() => set("recurrence_type", v)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${formData.recurrence_type === v ? "bg-white text-navy-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}
        </div>

        {/* Remarks */}
        <Field label="Remarks / notes">
          <textarea name="remarks" value={formData.remarks} onChange={handleInputChange} className={`${inputCls} border-slate-200`} placeholder="Any additional notes or explanation…" rows={3} />
        </Field>

        {/* Actions */}
        <div className="sticky bottom-0 -mx-6 -mb-5 flex justify-end gap-2 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={isLoading} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
              Cancel
            </button>
          )}
          <button type="submit" disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60">
            {isLoading ? (
              <>
                <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing…
              </>
            ) : (
              <><FiSave className="h-4 w-4" /> {submitButtonText}</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

// Modal wrapper version for convenience
export const ExpenseFormModal = ({ isOpen, onClose, ...props }) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog" aria-modal="true"
    >
      <motion.div
        initial={{ scale: 0.97, y: 16, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl shadow-xl"
      >
        <AdminExpenseEntry onCancel={onClose} {...props} />
      </motion.div>
    </div>
  );
};

export default AdminExpenseEntry;