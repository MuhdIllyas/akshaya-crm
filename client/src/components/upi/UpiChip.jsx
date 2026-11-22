import React, { useCallback, useEffect, useRef, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiChevronDown, FiLink } from "react-icons/fi";
import { socket } from "@/services/socket";
import { getBoard, todayIST, rupees, timeOf, SOURCE, servicesText, customersText } from "./upiApi";
import { LinkPaymentsModal, PickEntryModal } from "./UpiLinkModals";

// Top-bar chip: today's UPI payments caught by the centre's companion phone.
// Amber when a payment has no entry, red when an entry has no payment.
// The dropdown links them (payment → entry, or entry → payment).
// Opens itself when the "₹ received" toast is clicked (window event "upi-chip-open").

export default function UpiChip() {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [pickFor, setPickFor] = useState(null); // credit → choose entry
  const [linkSave, setLinkSave] = useState(null); // entry → choose payment(s)
  const ref = useRef(null);

  const load = useCallback(() => {
    getBoard(todayIST()).then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const refresh = () => load();
    const openIt = () => {
      load();
      setOpen(true);
    };
    socket.on("centre_upi_credit", refresh);
    socket.on("upi_links_updated", refresh);
    socket.on("centre_upi_credit_updated", refresh);
    window.addEventListener("upi-chip-open", openIt);
    return () => {
      socket.off("centre_upi_credit", refresh);
      socket.off("upi_links_updated", refresh);
      socket.off("centre_upi_credit_updated", refresh);
      window.removeEventListener("upi-chip-open", openIt);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!data) return null;
  const credits = data.credits || [];
  const notVerified = data.not_verified || [];
  if (credits.length === 0 && notVerified.length === 0) return null;

  const unclaimed = credits.filter((c) => c.status === "unclaimed");
  // An entry saved in the last 10 minutes may still be waiting for the customer to pay
  const isWaiting = (s) => Date.now() - new Date(s.saved_at).getTime() < 10 * 60 * 1000;
  const notSeen = notVerified.filter((s) => !isWaiting(s));
  const linked = credits.filter((c) => c.status === "matched");
  const tone = unclaimed.length
    ? ["border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100", "bg-amber-500", `UPI · ${unclaimed.length} to link`]
    : notSeen.length
      ? ["border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100", "bg-rose-500", `UPI · ${notSeen.length} not seen`]
      : ["border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100", "bg-emerald-500", `UPI ✓ ${rupees(data.summary.received)}`];

  const done = () => {
    setPickFor(null);
    setLinkSave(null);
    load();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors ${tone[0]}`}
        title="Today's UPI payments"
      >
        <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold text-white ${tone[1]}`}>₹</span>
        <span className="hidden sm:inline">{tone[2]}</span>
        <FiChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[380px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Today's UPI payments</p>
              <p className="text-xs text-slate-500">From the centre's companion phone</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-900">{rupees(data.summary.received)}</p>
              <p className="text-xs text-slate-500">{credits.length} payment{credits.length === 1 ? "" : "s"}</p>
            </div>
          </div>

          <ul className="max-h-[360px] divide-y divide-slate-100 overflow-y-auto">
            {unclaimed.map((c) => (
              <li key={c.id} className="flex items-center gap-3 bg-amber-50 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 font-bold text-amber-700">₹</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-amber-900">
                    {rupees(c.amount)} · {c.payer || "Unknown payer"}
                  </p>
                  <p className="text-xs text-amber-700">
                    {SOURCE[c.source] || c.source} · {timeOf(c.credited_at)} · no entry yet
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPickFor(c)}
                  className="rounded-xl bg-navy-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-800"
                >
                  Link
                </button>
              </li>
            ))}
            {notVerified.map((s) => (
              <li key={`${s.wallet_id}|${s.save_key}`} className="flex items-center gap-3 bg-rose-50/60 px-4 py-2.5 text-sm">
                <FiAlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-rose-900">{customersText(s)} · {servicesText(s)}</p>
                  <p className="text-xs text-rose-700">
                    {timeOf(s.saved_at)} · {s.wallet_name} · {isWaiting(s) ? "waiting for payment" : "payment not seen"}
                  </p>
                </div>
                <span className="font-semibold text-rose-900">{rupees(s.open)}</span>
                <button
                  type="button"
                  onClick={() => setLinkSave(s)}
                  aria-label="Link payment"
                  className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-100"
                >
                  <FiLink className="h-4 w-4" />
                </button>
              </li>
            ))}
            {linked.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-14 shrink-0 text-xs text-slate-500">{timeOf(c.credited_at)}</span>
                <span className="w-16 shrink-0 font-bold text-slate-900">{rupees(c.amount)}</span>
                <span className="min-w-0 flex-1 truncate text-slate-700">{c.linked.map(servicesText).join("; ")}</span>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700">
                  <FiCheckCircle className="h-3.5 w-3.5" /> Linked
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pickFor && (
        <PickEntryModal credit={pickFor} saves={notVerified} credits={credits} onClose={() => setPickFor(null)} onLinked={done} />
      )}
      {linkSave && <LinkPaymentsModal save={linkSave} credits={credits} onClose={() => setLinkSave(null)} onLinked={done} />}
    </div>
  );
}
