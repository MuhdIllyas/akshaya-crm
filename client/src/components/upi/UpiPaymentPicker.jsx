import React, { useCallback, useEffect, useState } from "react";
import { FiSmartphone, FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import { socket } from "@/services/socket";
import { getUnclaimed, rupees, SOURCE, sameAmount } from "./upiApi";

// Shown under a Service Entry payment whose wallet has "UPI payment check" on.
// Lists that wallet's UPI payments from the last 3 hours that no entry has
// claimed yet; staff tick the customer's one(s). Loaded only for such wallets
// (lazy), one small request, then refreshed by the live socket — no polling.

const ago = (v) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(v).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h ${m % 60} min ago`;
};

export default function UpiPaymentPicker({ walletId, walletName, amount, selected = [], onChange }) {
  const [credits, setCredits] = useState(null);

  const load = useCallback(() => {
    getUnclaimed(walletId, 3)
      .then(setCredits)
      .catch(() => setCredits([]));
  }, [walletId]);

  useEffect(() => {
    setCredits(null);
    load();
    const refresh = () => load();
    socket.on("centre_upi_credit", refresh);
    socket.on("upi_links_updated", refresh);
    return () => {
      socket.off("centre_upi_credit", refresh);
      socket.off("upi_links_updated", refresh);
    };
  }, [load]);

  // A ticked payment that another entry took meanwhile is dropped
  useEffect(() => {
    if (!credits) return;
    const still = selected.filter((id) => credits.some((c) => c.id === id));
    if (still.length !== selected.length) {
      onChange(still, credits.filter((c) => still.includes(c.id)).reduce((t, c) => t + c.amount, 0));
    }
  }, [credits]); // eslint-disable-line react-hooks/exhaustive-deps

  if (credits === null) return null;

  if (credits.length === 0) {
    return (
      <p className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <FiSmartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        No new UPI payment in {walletName} in the last 3 hours. Save anyway: it links on its own when the money arrives.
      </p>
    );
  }

  const toggle = (id) => {
    const ids = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    onChange(ids, credits.filter((c) => ids.includes(c.id)).reduce((t, c) => t + c.amount, 0));
  };
  const total = credits.filter((c) => selected.includes(c.id)).reduce((t, c) => t + c.amount, 0);
  const entered = parseFloat(amount) || 0;
  const matches = selected.length > 0 && sameAmount(total, entered);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-emerald-300 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        <span className="flex items-center gap-1.5 font-semibold">
          <FiSmartphone className="h-3.5 w-3.5" /> UPI received in {walletName} · last 3 hours
        </span>
        <span>Tick the customer's payment</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {credits.map((c) => {
          const on = selected.includes(c.id);
          return (
            <li key={c.id}>
              <label className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${on ? "bg-emerald-50/70" : "hover:bg-slate-50"}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(c.id)} className="h-4 w-4 accent-emerald-600" />
                <span className="w-20 font-bold text-slate-900">{rupees(c.amount)}</span>
                <span className="min-w-0 flex-1 truncate text-slate-700">
                  {c.payer || "Unknown payer"} · {SOURCE[c.source] || c.source}
                </span>
                <span className="shrink-0 text-xs text-slate-500">{ago(c.credited_at)}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {selected.length > 0 && (
        <div
          className={`flex items-center gap-1.5 border-t px-3 py-2 text-xs font-semibold ${
            matches ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-amber-100 bg-amber-50 text-amber-800"
          }`}
        >
          {matches ? (
            <>
              <FiCheckCircle className="h-3.5 w-3.5" /> {rupees(total)} matches — this entry will be saved as UPI verified
            </>
          ) : (
            <>
              <FiAlertCircle className="h-3.5 w-3.5" /> Ticked {rupees(total)} but this payment is {rupees(entered)} — they must be equal to link
            </>
          )}
        </div>
      )}
    </div>
  );
}
