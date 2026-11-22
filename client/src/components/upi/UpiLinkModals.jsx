import React, { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { FiX, FiCheck } from "react-icons/fi";
import {
  rupees, timeOf, SOURCE, servicesText, customersText, sameAmount, errorText, linkToSave,
} from "./upiApi";

const gap = (a, b) => Math.abs(new Date(a) - new Date(b));

function Shell({ title, subtitle, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <FiX className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
        {footer && <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Link UPI payment(s) to one entry (save). The ticked payments must add up to
 * exactly what the entry has in that wallet. `preselect`: payment ids ticked at start.
 */
export function LinkPaymentsModal({ save, credits, preselect = [], onClose, onLinked }) {
  const options = useMemo(
    () =>
      credits
        .filter((c) => c.status === "unclaimed" && Number(c.wallet_id) === Number(save.wallet_id))
        .sort((a, b) => gap(a.credited_at, save.saved_at) - gap(b.credited_at, save.saved_at)),
    [credits, save]
  );
  const [picked, setPicked] = useState(() => {
    if (preselect.length) return preselect;
    const exact = options.find((c) => sameAmount(c.amount, save.open));
    return exact ? [exact.id] : [];
  });
  const [busy, setBusy] = useState(false);
  const total = options.filter((c) => picked.includes(c.id)).reduce((t, c) => t + c.amount, 0);
  const exact = picked.length > 0 && sameAmount(total, save.open);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submit = async () => {
    setBusy(true);
    try {
      await linkToSave(picked, save.wallet_id, save.save_key);
      toast.success("Payment linked");
      onLinked?.();
    } catch (e) {
      toast.error(errorText(e, "Could not link"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      title="Link UPI payment"
      subtitle={`${customersText(save)} · ${servicesText(save)} · ${save.wallet_name} ${rupees(save.open)}`}
      onClose={onClose}
      footer={
        <>
          <p className={`text-sm ${exact ? "font-semibold text-emerald-700" : "text-slate-500"}`}>
            {rupees(total)} of {rupees(save.open)}
            {picked.length > 0 && !exact ? " · must be equal" : ""}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!exact || busy}
              className="rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Linking…" : "Link"}
            </button>
          </div>
        </>
      }
    >
      {options.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-slate-500">No unlinked UPI payments in {save.wallet_name} on this day.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {options.map((c) => {
            const on = picked.includes(c.id);
            return (
              <li key={c.id}>
                <label className={`flex cursor-pointer items-center gap-3 px-6 py-3 text-sm ${on ? "bg-emerald-50" : "hover:bg-slate-50"}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(c.id)} className="h-4 w-4 accent-emerald-600" />
                  <span className="w-20 font-bold text-slate-900">{rupees(c.amount)}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-700">{c.payer || "Unknown payer"}</span>
                  <span className="text-xs text-slate-500">{SOURCE[c.source] || c.source} · {timeOf(c.credited_at)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}

/**
 * Start from a payment: pick which entry it belongs to (entries in the same
 * wallet that are not verified yet). An entry for exactly this amount links
 * straight away; otherwise the payments picker opens with this one ticked.
 */
export function PickEntryModal({ credit, saves, credits, onClose, onLinked }) {
  const [busy, setBusy] = useState(null);
  const [more, setMore] = useState(null);
  const list = useMemo(
    () =>
      saves
        .filter((s) => Number(s.wallet_id) === Number(credit.wallet_id))
        .sort((a, b) => {
          const ea = sameAmount(a.open, credit.amount) ? 0 : 1;
          const eb = sameAmount(b.open, credit.amount) ? 0 : 1;
          return ea - eb || gap(a.saved_at, credit.credited_at) - gap(b.saved_at, credit.credited_at);
        }),
    [saves, credit]
  );

  if (more) {
    return <LinkPaymentsModal save={more} credits={credits} preselect={[credit.id]} onClose={onClose} onLinked={onLinked} />;
  }

  const choose = async (s) => {
    if (!sameAmount(s.open, credit.amount)) return setMore(s);
    setBusy(s.save_key);
    try {
      await linkToSave([credit.id], s.wallet_id, s.save_key);
      toast.success("Payment linked");
      onLinked?.();
    } catch (e) {
      toast.error(errorText(e, "Could not link"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Shell
      title="Which entry is this payment for?"
      subtitle={`${rupees(credit.amount)} · ${credit.payer || "Unknown payer"} · ${SOURCE[credit.source] || credit.source} ${timeOf(credit.credited_at)}`}
      onClose={onClose}
    >
      {list.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-slate-500">
          No entries in {credit.wallet_name} are waiting for a payment today. Save the entry first, then it links automatically.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {list.map((s) => {
            const exact = sameAmount(s.open, credit.amount);
            return (
              <li key={`${s.wallet_id}|${s.save_key}`}>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => choose(s)}
                  className="flex w-full items-center gap-3 px-6 py-3 text-left text-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  <span className="w-14 text-slate-500">{timeOf(s.saved_at)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-slate-900">{customersText(s)}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {servicesText(s)}{s.staff_name ? ` · by ${s.staff_name}` : ""}
                    </span>
                  </span>
                  <span className="font-bold text-slate-900">{rupees(s.open)}</span>
                  {exact ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      <FiCheck /> Same amount
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">Add more…</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}
