import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { FiAlertTriangle, FiChevronLeft, FiEdit3, FiTrash2, FiX } from "react-icons/fi";
import { rupees, timeOf } from "./entryFormat";

/* The supervisor's Today's entries page: the open entry (EntryPanel, a side panel
   on wide screens and a full screen on phones) and the delete confirmation.

   EntryPanel saves, in this order:
     1. a changed department fee through the correction engine
        (PUT /transactions/:id/correct), which also fixes the department wallet debit
     2. PUT /entry/:id for the rest of the entry (new total, reason in the audit log)
     3. each changed payment through the correction engine on its wallet transaction
        (amount and/or wallet; the money moves with it)
   "Collect" is separate: POST /pending-payments/:id/receive-payment right away
   (counted for the entry's staff member). */

const API = import.meta.env.VITE_API_URL;
const ymdIST = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const whenOf = (d, day) =>
  ymdIST(d) === day
    ? timeOf(d)
    : `${new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}, ${timeOf(d)}`;

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
const friendly = (err) =>
  /insufficient balance/i.test(err.message) ? `${err.message}: the wallet doesn't have enough money for this change` : err.message;

const field = "min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30";
const label = "mb-1 block text-sm font-semibold text-slate-800";

export const EditedTag = ({ e }) => {
  const text = `Edited${e.editedBy ? ` by ${e.editedBy}` : ""}${e.editedAt ? ` at ${timeOf(e.editedAt)}` : ""}`;
  return (
    <span title={text} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-800 ring-1 ring-sky-200">
      <FiEdit3 className="h-3 w-3" aria-hidden="true" /> Edited
      <span className="sr-only">: {text}</span>
    </span>
  );
};

/* ------------------------------------------------------------------ */

export const EntryPanel = ({ entry, day, focus, onClose, onSaved, onFullEdit, onDelete }) => {
  const original = entry.payments || [];
  const [form, setForm] = useState({
    customerName: entry.customerName || "",
    phone: entry.phone || "",
    sc: String(entry.serviceCharge),
    dept: String(entry.departmentCharge),
    reason: "",
  });
  const [pays, setPays] = useState(() => original.map((p) => ({ ...p, amount: String(p.amount), walletId: String(p.walletId || ""), open: false })));
  const [collect, setCollect] = useState({ walletId: String(original[0]?.walletId || ""), amount: entry.pending > 0 ? String(entry.pending) : "" });
  const [wallets, setWallets] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(""); // "save" | "collect"
  const root = useRef(null);
  const scRef = useRef(null);
  const collectRef = useRef(null);

  useEffect(() => {
    call("GET", "/api/wallet/my-centre-wallets")
      .then((rows) => setWallets((Array.isArray(rows) ? rows : []).filter((w) => !w.status || w.status === "active")))
      .catch(() => setWallets([]));
  }, []);

  // focus: the collect amount, the service charge, or the heading
  useEffect(() => {
    const el = focus === "collect" ? collectRef.current : focus === "fix" ? scRef.current : root.current?.querySelector("h2");
    el?.focus();
  }, [focus]);

  // Escape closes (the panel is a full screen on phones)
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const set = (k) => (e) => { const v = e.target.value; setForm((f) => ({ ...f, [k]: v })); setErrors((x) => ({ ...x, [k]: "" })); };
  const setPay = (i, k) => (e) => {
    const v = e.target.value;
    setPays((list) => list.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
    setErrors((x) => ({ ...x, [`pay${i}`]: "", paid: "" }));
  };
  const openPay = (i) => setPays((list) => list.map((p, j) => (j === i ? { ...p, open: true } : p)));
  const setCol = (k) => (e) => { const v = e.target.value; setCollect((c) => ({ ...c, [k]: v })); setErrors((x) => ({ ...x, collect: "" })); };

  const sc = Number(form.sc), dept = Number(form.dept);
  const scChanged = sc !== entry.serviceCharge;
  const deptChanged = dept !== entry.departmentCharge;
  const detailsChanged = form.customerName.trim() !== (entry.customerName || "") || form.phone.trim() !== (entry.phone || "");
  const payChanged = (p, i) => Number(p.amount) !== original[i].amount || p.walletId !== String(original[i].walletId || "");
  const changedPays = pays.map((p, i) => ({ p, i })).filter(({ p, i }) => payChanged(p, i));
  const moneyChanged = scChanged || deptChanged || changedPays.length > 0;
  const dirty = moneyChanged || detailsChanged;
  const total = Math.round(((Number.isFinite(sc) ? sc : 0) + (Number.isFinite(dept) ? dept : 0)) * 100) / 100;
  const paid = Math.round(pays.reduce((t, p) => t + (Number(p.amount) || 0), 0) * 100) / 100;
  const due = Math.round((total - paid) * 100) / 100;
  const hasUsual = entry.usualServiceCharge !== null && entry.usualDepartmentCharge !== null;
  const knownWallet = (id) => wallets.some((w) => String(w.id) === String(id));

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
    pays.forEach((p, i) => {
      const a = Number(p.amount);
      if (p.amount === "" || !Number.isFinite(a) || a < 0) errs[`pay${i}`] = "Enter 0 or more";
      else if (payChanged(p, i) && !p.txId) errs[`pay${i}`] = "This payment can't be corrected here. Use Full edit.";
    });
    if (paid > total + 0.009) errs.paid = `Paid ${rupees(paid)} is more than the total ${rupees(total)}`;
    if (moneyChanged && form.reason.trim().length < 5) errs.reason = "Say why it changes (at least 5 characters)";
    setErrors(errs);
    if (Object.keys(errs).length) {
      root.current?.querySelector("[aria-invalid='true']")?.focus();
      return;
    }

    setBusy("save");
    const reason = form.reason.trim();
    let step = 0;
    try {
      if (deptChanged) {
        await call("PUT", `/api/servicemanagement/transactions/${entry.deptTxId}/correct`, { new_amount: dept, reason, match: "transaction" });
        step += 1;
      }
      await call("PUT", `/api/servicemanagement/entry/${entry.id}`, {
        customerName: form.customerName.trim(),
        phone: form.phone.trim(),
        serviceCharge: sc,
        departmentCharge: dept,
        totalCharge: total,
        reason: reason || undefined,
      });
      step += 1;
      for (const { p, i } of changedPays) {
        const body = { new_amount: Number(p.amount), reason, match: "transaction" };
        if (p.walletId !== String(original[i].walletId || "")) body.new_wallet_id = Number(p.walletId);
        await call("PUT", `/api/servicemanagement/transactions/${p.txId}/correct`, body);
        step += 1;
      }
      toast.success(`Entry ${entry.id} saved`);
      onSaved();
    } catch (err) {
      if (step > 0) {
        toast.error(`Part of the change was saved, the rest failed. ${friendly(err)}`);
        onSaved();
      } else {
        toast.error(friendly(err));
        setBusy("");
      }
    }
  };

  const doCollect = async () => {
    const amount = Number(collect.amount);
    let msg = "";
    if (collect.amount === "" || !Number.isFinite(amount) || amount <= 0) msg = "Enter the amount received";
    else if (amount > entry.pending + 0.009) msg = `Only ${rupees(entry.pending)} is due`;
    else if (!collect.walletId) msg = "Choose the wallet the money went to";
    if (msg) {
      setErrors((x) => ({ ...x, collect: msg }));
      collectRef.current?.focus();
      return;
    }
    setBusy("collect");
    try {
      await call("POST", `/api/servicemanagement/pending-payments/${entry.id}/receive-payment`, { wallet_id: Number(collect.walletId), amount });
      toast.success(`${rupees(amount)} collected for ${entry.staffName}`);
      onSaved();
    } catch (err) {
      toast.error(friendly(err));
      setBusy("");
    }
  };

  const err = (k) => errors[k] && <p id={`ep-${k}-err`} className="mt-1 text-sm text-red-700">{errors[k]}</p>;
  const inv = (k) => ({ "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `ep-${k}-err` : undefined });

  return (
    <section ref={root} aria-labelledby="ep-title"
      className="max-xl:fixed max-xl:inset-0 max-xl:z-[60] max-xl:overflow-y-auto bg-white p-4 sm:p-5 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:rounded-2xl xl:border xl:border-slate-200 xl:shadow-sm">
      <button type="button" onClick={onClose} disabled={!!busy}
        className="mb-3 inline-flex min-h-[44px] items-center gap-1 font-semibold text-navy-700 xl:hidden">
        <FiChevronLeft className="h-5 w-5" aria-hidden="true" /> All entries
      </button>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Entry {entry.id} · {entry.staffName}</p>
          <h2 id="ep-title" tabIndex={-1} className="mt-1 flex flex-wrap items-center gap-2 text-xl font-bold text-slate-900 focus:outline-none">
            {entry.customerName || "Customer"} {entry.edited && <EditedTag e={entry} />}
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            {entry.serviceName}{entry.subcategoryName ? ` · ${entry.subcategoryName}` : ""} · {timeOf(entry.createdAt)}{entry.phone ? ` · ${entry.phone}` : ""}
          </p>
        </div>
        <button type="button" onClick={onClose} disabled={!!busy} aria-label="Close"
          className="hidden h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 xl:grid">
          <FiX className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {entry.check && hasUsual && (
        <div className={`mt-4 flex flex-wrap items-center gap-3 rounded-xl border p-3 ${entry.check === "swapped" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
          <FiAlertTriangle className={`h-4 w-4 ${entry.check === "swapped" ? "text-red-700" : "text-amber-800"}`} aria-hidden="true" />
          <span className={`min-w-[180px] flex-1 text-sm ${entry.check === "swapped" ? "text-red-900" : "text-amber-900"}`}>
            {entry.check === "swapped" ? "Looks swapped. " : "Service charge is below the usual. "}
            Usually service {rupees(entry.usualServiceCharge)}, department {rupees(entry.usualDepartmentCharge)}.
          </span>
          <button type="button" onClick={useUsual} className="min-h-[40px] rounded-lg bg-white px-3 text-sm font-semibold text-navy-700 ring-1 ring-slate-300 hover:bg-slate-50">
            Use usual charges
          </button>
        </div>
      )}

      {/* Charges */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ep-sc" className={label}>Service charge (₹)</label>
          <input ref={scRef} id="ep-sc" type="number" min="0" step="1" inputMode="decimal" value={form.sc} onChange={set("sc")} className={field} {...inv("sc")} />
          {err("sc")}
        </div>
        <div>
          <label htmlFor="ep-dept" className={label}>Department (₹)</label>
          <input id="ep-dept" type="number" min="0" step="1" inputMode="decimal" value={form.dept} onChange={set("dept")} className={field} {...inv("dept")} />
          {err("dept")}
        </div>
      </div>
      {deptChanged && entry.deptTxId && <p className="mt-2 text-sm text-slate-600">The department wallet is corrected too.</p>}

      <details className="mt-3 rounded-xl border border-slate-200 px-3 py-2" open={!!errors.customerName || !!errors.phone}>
        <summary className="min-h-[36px] cursor-pointer py-1 text-sm font-semibold text-slate-700">Customer name and phone</summary>
        <div className="mt-2 grid grid-cols-1 gap-3 pb-2 sm:grid-cols-2">
          <div>
            <label htmlFor="ep-name" className={label}>Customer name</label>
            <input id="ep-name" value={form.customerName} onChange={set("customerName")} className={field} {...inv("customerName")} />
            {err("customerName")}
          </div>
          <div>
            <label htmlFor="ep-phone" className={label}>Phone</label>
            <input id="ep-phone" inputMode="tel" value={form.phone} onChange={set("phone")} className={field} {...inv("phone")} />
            {err("phone")}
          </div>
        </div>
      </details>

      {/* Payments */}
      <div className="mt-4 rounded-xl border border-slate-200 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">Payments</h3>
          <p className="text-sm" aria-live="polite">
            {dirty ? (
              <>Total {rupees(total)} · paid {rupees(paid)}{due > 0 && <strong className="font-semibold text-amber-700"> · {rupees(due)} due</strong>}</>
            ) : entry.pending > 0 ? (
              <strong className="font-semibold text-amber-700">{rupees(entry.pending)} due of {rupees(entry.totalCharge)}</strong>
            ) : (
              <span className="font-semibold text-emerald-700">Fully paid</span>
            )}
          </p>
        </div>
        {errors.paid && <p className="mt-1 text-sm text-red-700">{errors.paid}</p>}

        {pays.length === 0 && <p className="mt-2 text-sm text-slate-600">No payment yet.</p>}
        <ul className="mt-2 flex flex-col gap-2">
          {pays.map((p, i) => (
            <li key={p.id} className="rounded-lg bg-slate-50 p-2.5">
              {!p.open ? (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 text-slate-700">{p.walletName || "Wallet"} · {timeOf(p.createdAt)}</span>
                  <span className="flex items-center gap-2">
                    <strong>{rupees(p.amount)}</strong>
                    <button type="button" onClick={() => openPay(i)} aria-label={`Change payment of ${rupees(p.amount)}`}
                      className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-semibold text-navy-700 hover:bg-slate-50">
                      Change
                    </button>
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-[1fr_6.5rem] gap-2">
                  <div>
                    <label htmlFor={`ep-pw-${i}`} className="mb-1 block text-xs font-semibold text-slate-600">Wallet</label>
                    <select id={`ep-pw-${i}`} value={p.walletId} onChange={setPay(i, "walletId")} className={field}>
                      {!knownWallet(p.walletId) && <option value={p.walletId}>{p.walletName || "Wallet"}</option>}
                      {wallets.map((w) => <option key={w.id} value={String(w.id)}>{w.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`ep-pa-${i}`} className="mb-1 block text-xs font-semibold text-slate-600">Amount (₹)</label>
                    <input id={`ep-pa-${i}`} type="number" min="0" step="1" inputMode="decimal" value={p.amount} onChange={setPay(i, "amount")} className={field} {...inv(`pay${i}`)} />
                  </div>
                  {errors[`pay${i}`] && <p id={`ep-pay${i}-err`} className="col-span-2 text-sm text-red-700">{errors[`pay${i}`]}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>

        {entry.pending > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="grid grid-cols-[1fr_6.5rem] gap-2">
              <div>
                <label htmlFor="ep-cw" className="mb-1 block text-xs font-semibold text-slate-600">Collect into</label>
                <select id="ep-cw" value={collect.walletId} onChange={setCol("walletId")} className={field} disabled={dirty} {...inv("collect")}>
                  <option value="">Choose a wallet</option>
                  {wallets.map((w) => <option key={w.id} value={String(w.id)}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ep-ca" className="mb-1 block text-xs font-semibold text-slate-600">Amount (₹)</label>
                <input ref={collectRef} id="ep-ca" type="number" min="0" step="1" inputMode="decimal" value={collect.amount} onChange={setCol("amount")} className={field} disabled={dirty} {...inv("collect")} />
              </div>
            </div>
            {err("collect")}
            <button type="button" onClick={doCollect} disabled={dirty || !!busy}
              className="mt-2 min-h-[44px] w-full rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
              {busy === "collect" ? "Collecting…" : `Collect ${collect.amount && Number(collect.amount) > 0 ? rupees(collect.amount) : ""}`}
            </button>
            {dirty && <p className="mt-1 text-sm text-slate-600">Save the changes above first, then collect.</p>}
          </div>
        )}
      </div>

      {/* History */}
      {entry.history?.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-bold text-slate-900">History</h3>
          <ol className="flex flex-col gap-2 border-l-2 border-slate-200 pl-3 text-sm text-slate-700">
            {entry.history.map((h, i) => (
              <li key={i}>
                <strong className="font-semibold text-slate-900">{whenOf(h.at, day)}</strong>
                {h.by ? ` · ${h.by}` : ""}: {h.text}
                {h.reason && <span className="text-slate-600"> · “{h.reason}”</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {moneyChanged && (
        <div className="mt-4">
          <label htmlFor="ep-reason" className={label}>Why is it changing? (kept in the history)</label>
          <textarea id="ep-reason" rows={2} value={form.reason} onChange={set("reason")} className={`${field} py-2`} {...inv("reason")} />
          {err("reason")}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {onDelete && (
            <button type="button" onClick={onDelete} disabled={!!busy}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-50">
              <FiTrash2 className="h-4 w-4" aria-hidden="true" /> Delete
            </button>
          )}
          <button type="button" onClick={onFullEdit} disabled={!!busy}
            className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-navy-700 hover:bg-slate-50">
            Full edit
          </button>
        </div>
        <button type="button" onClick={save} disabled={!dirty || !!busy}
          className="min-h-[44px] rounded-xl bg-navy-700 px-5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50">
          {busy === "save" ? "Saving…" : "Save changes"}
        </button>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */

const Dialog = ({ title, labelId, onClose, children }) => {
  const box = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    box.current?.querySelector("textarea, input, button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
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
      <label htmlFor="de-reason" className={label}>Reason (kept in the audit log)</label>
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
