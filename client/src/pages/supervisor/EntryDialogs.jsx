import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { FiAlertTriangle, FiTrash2, FiX } from "react-icons/fi";

/* Edit and delete a service entry right on the supervisor's Today's entries page.
   Edit: customer, phone, service charge, department fee. A changed department
   fee goes through the correction engine (PUT /transactions/:id/correct), which
   also fixes the department wallet debit; then PUT /entry/:id saves the rest.
   Delete: DELETE /entry/:id/force with a reason (kept in the audit log). */

const API = import.meta.env.VITE_API_URL;
const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const call = async (method, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
  return data;
};

const Dialog = ({ title, labelId, onClose, children }) => {
  const box = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    box.current?.querySelector("input, textarea, button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={labelId}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={labelId} className="text-lg font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">
            <FiX className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

const field = "min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30";

export const EditEntryDialog = ({ entry, onClose, onSaved, onFullEdit }) => {
  const [form, setForm] = useState({
    customerName: entry.customerName || "",
    phone: entry.phone || "",
    sc: String(entry.serviceCharge),
    dept: String(entry.departmentCharge),
    reason: "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: "" })); };

  const sc = Number(form.sc), dept = Number(form.dept);
  const scChanged = sc !== entry.serviceCharge;
  const deptChanged = dept !== entry.departmentCharge;
  const moneyChanged = scChanged || deptChanged;
  const hasUsual = entry.usualServiceCharge !== null && entry.usualDepartmentCharge !== null;
  const useUsual = () => {
    setForm((f) => ({
      ...f,
      sc: String(entry.usualServiceCharge),
      dept: String(entry.usualDepartmentCharge),
      reason: f.reason || (entry.check === "swapped" ? "Service and department charges were swapped" : "Charges set to the usual amounts"),
    }));
    setErrors({});
  };

  const save = async () => {
    const errs = {};
    if (!form.customerName.trim()) errs.customerName = "Enter the customer's name";
    if (!form.phone.trim()) errs.phone = "Enter a phone number";
    if (form.sc === "" || !Number.isFinite(sc) || sc < 0) errs.sc = "Enter 0 or more";
    if (form.dept === "" || !Number.isFinite(dept) || dept < 0) errs.dept = "Enter 0 or more";
    if (deptChanged && !entry.deptTxId) errs.dept = "This entry has no department payment to correct here. Use Full edit.";
    if (moneyChanged && form.reason.trim().length < 5) errs.reason = "Say why the charges change (at least 5 characters)";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      // 1. department fee: the correction engine moves the money too
      if (deptChanged) {
        await call("PUT", `/api/servicemanagement/transactions/${entry.deptTxId}/correct`, { new_amount: dept, reason: form.reason.trim() });
      }
      // 2. the rest of the entry
      await call("PUT", `/api/servicemanagement/entry/${entry.id}`, {
        customerName: form.customerName.trim(),
        phone: form.phone.trim(),
        serviceCharge: sc,
        departmentCharge: dept,
        totalCharge: Math.round((sc + dept) * 100) / 100,
      });
      toast.success(`Entry ${entry.id} updated`);
      onSaved();
    } catch (err) {
      toast.error(err.message);
      setSaving(false);
    }
  };

  const err = (k) => errors[k] && <p id={`ee-${k}-err`} className="mt-1 text-sm text-red-700">{errors[k]}</p>;

  return (
    <Dialog title={`Edit entry ${entry.id}`} labelId="ee-title" onClose={saving ? () => {} : onClose}>
      <p className="mb-4 text-sm text-slate-600">
        {entry.serviceName}{entry.subcategoryName ? ` · ${entry.subcategoryName}` : ""} · {entry.staffName}. It stays {entry.staffName}'s entry.
      </p>

      {entry.check && hasUsual && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <FiAlertTriangle className="h-4 w-4 text-amber-800" aria-hidden="true" />
          <span className="flex-1 text-sm text-amber-900">
            Usually service {rupees(entry.usualServiceCharge)}, department {rupees(entry.usualDepartmentCharge)}.
          </span>
          <button type="button" onClick={useUsual} className="min-h-[40px] rounded-lg bg-white px-3 text-sm font-semibold text-navy-700 ring-1 ring-amber-300 hover:bg-amber-100">
            Use usual charges
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="ee-name" className="mb-1 block text-sm font-semibold text-slate-800">Customer name</label>
          <input id="ee-name" value={form.customerName} onChange={set("customerName")} className={field} aria-invalid={!!errors.customerName} aria-describedby={errors.customerName ? "ee-customerName-err" : undefined} />
          {err("customerName")}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="ee-phone" className="mb-1 block text-sm font-semibold text-slate-800">Phone</label>
          <input id="ee-phone" inputMode="tel" value={form.phone} onChange={set("phone")} className={field} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "ee-phone-err" : undefined} />
          {err("phone")}
        </div>
        <div>
          <label htmlFor="ee-sc" className="mb-1 block text-sm font-semibold text-slate-800">Service charge (₹)</label>
          <input id="ee-sc" type="number" min="0" step="1" inputMode="decimal" value={form.sc} onChange={set("sc")} className={field} aria-invalid={!!errors.sc} aria-describedby={errors.sc ? "ee-sc-err" : undefined} />
          {err("sc")}
        </div>
        <div>
          <label htmlFor="ee-dept" className="mb-1 block text-sm font-semibold text-slate-800">Department (₹)</label>
          <input id="ee-dept" type="number" min="0" step="1" inputMode="decimal" value={form.dept} onChange={set("dept")} className={field} aria-invalid={!!errors.dept} aria-describedby={errors.dept ? "ee-dept-err" : undefined} />
          {err("dept")}
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-600">
        Total {rupees((Number.isFinite(sc) ? sc : 0) + (Number.isFinite(dept) ? dept : 0))} · paid {rupees(entry.received)}
        {deptChanged && entry.deptTxId ? " · the department wallet is corrected too" : ""}
      </p>

      {moneyChanged && (
        <div className="mt-4">
          <label htmlFor="ee-reason" className="mb-1 block text-sm font-semibold text-slate-800">Why are the charges changing?</label>
          <textarea id="ee-reason" rows={2} value={form.reason} onChange={set("reason")} className={`${field} py-2`} aria-invalid={!!errors.reason} aria-describedby={errors.reason ? "ee-reason-err" : undefined} />
          {err("reason")}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onFullEdit} className="text-sm font-semibold text-navy-700 underline-offset-2 hover:underline">
          Full edit (change the service)
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving} className="min-h-[44px] rounded-xl bg-navy-700 px-4 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

export const DeleteEntryDialog = ({ entry, onClose, onDeleted }) => {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (reason.trim().length < 5) {
      setError("Say why it is deleted (at least 5 characters)");
      return;
    }
    setBusy(true);
    try {
      await call("DELETE", `/api/servicemanagement/entry/${entry.id}/force`, { reason: reason.trim() });
      toast.success(`Entry ${entry.id} deleted`);
      onDeleted();
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <Dialog title={`Delete entry ${entry.id}?`} labelId="de-title" onClose={busy ? () => {} : onClose}>
      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
        <p className="font-semibold">{entry.customerName || "Customer"} · {entry.serviceName}{entry.subcategoryName ? ` · ${entry.subcategoryName}` : ""} · {entry.staffName}</p>
        <p className="mt-1">
          The entry, its payments ({rupees(entry.received)}) and its application are removed, and the wallet amounts are
          reversed. This can't be undone. Enter it again as a new entry afterwards if needed.
        </p>
      </div>
      <label htmlFor="de-reason" className="mb-1 block text-sm font-semibold text-slate-800">Reason (kept in the audit log)</label>
      <textarea id="de-reason" rows={2} value={reason} onChange={(e) => { setReason(e.target.value); setError(""); }}
        className={`${field} py-2`} aria-invalid={!!error} aria-describedby={error ? "de-reason-err" : undefined} />
      {error && <p id="de-reason-err" className="mt-1 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={busy} className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Cancel
        </button>
        <button type="button" onClick={remove} disabled={busy} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
          <FiTrash2 className="h-4 w-4" aria-hidden="true" /> {busy ? "Deleting…" : "Delete entry"}
        </button>
      </div>
    </Dialog>
  );
};
