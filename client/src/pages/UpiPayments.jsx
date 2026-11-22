import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  FiCheckCircle, FiAlertTriangle, FiClock, FiLink, FiRefreshCw, FiX, FiSlash,
} from "react-icons/fi";
import { socket } from "@/services/socket";

// UPI payments the centre's companion phone caught (bank SMS / GPay, Paytm…
// notifications) and the service entries they are linked to. Links are made
// automatically when a save's UPI-wallet total matches exactly; this page
// shows what is linked, what is not, and lets staff fix the rest by hand.

const API = `${import.meta.env.VITE_API_URL}/api/upi-credits`;
const IST = "Asia/Kolkata";
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: IST });
const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const timeOf = (v) =>
  v ? new Date(v).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" }) : "";
const SOURCE = { sms: "Bank SMS", gpay: "GPay", paytm: "Paytm", phonepe: "PhonePe", sbi: "SBI app" };
const minutesAgo = (v) => Math.round((Date.now() - new Date(v).getTime()) / 60000);

const servicesText = (s) => s.services.map((x) => x.name).join(" + ");
const customersText = (s) => s.customers.join(", ") || "Customer";

function Tile({ label, value, sub, tone }) {
  const tones = {
    slate: "border-slate-200 bg-white",
    green: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    red: "border-rose-200 bg-rose-50",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone] || tones.slate}`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-800">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

/** Pick the UPI payment(s) that pay for one save; they must add up exactly. */
function LinkModal({ save, credits, onClose, onLinked }) {
  const options = useMemo(
    () =>
      credits
        .filter((c) => c.status === "unclaimed" && Number(c.wallet_id) === Number(save.wallet_id))
        .sort(
          (a, b) =>
            Math.abs(new Date(a.credited_at) - new Date(save.saved_at)) -
            Math.abs(new Date(b.credited_at) - new Date(save.saved_at))
        ),
    [credits, save]
  );
  const [picked, setPicked] = useState(() => {
    const exact = options.find((c) => Math.round(c.amount * 100) === Math.round(save.open * 100));
    return exact ? [exact.id] : [];
  });
  const [busy, setBusy] = useState(false);
  const total = options.filter((c) => picked.includes(c.id)).reduce((t, c) => t + c.amount, 0);
  const exact = Math.round(total * 100) === Math.round(save.open * 100);

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submit = async () => {
    setBusy(true);
    try {
      await axios.post(`${API}/link`, { credit_ids: picked, wallet_id: save.wallet_id, save_key: save.save_key }, auth());
      toast.success("Linked");
      onLinked();
    } catch (e) {
      toast.error(e.response?.data?.error || "Could not link");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-100 p-5">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Link UPI payment</h3>
            <p className="mt-1 text-sm text-slate-500">
              {customersText(save)} · {servicesText(save)} · {save.wallet_name}{" "}
              <span className="font-semibold text-slate-700">{rupees(save.open)}</span>
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <FiX />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-3">
          {options.length === 0 ? (
            <p className="p-4 text-center text-sm text-slate-500">
              No unlinked UPI payments in {save.wallet_name} on this day.
            </p>
          ) : (
            options.map((c) => (
              <label
                key={c.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 ${
                  picked.includes(c.id) ? "bg-emerald-50" : ""
                }`}
              >
                <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 accent-emerald-600" />
                <span className="w-20 font-semibold text-slate-800">{rupees(c.amount)}</span>
                <span className="flex-1 truncate text-sm text-slate-600">{c.payer || "Unknown payer"}</span>
                <span className="text-xs text-slate-400">
                  {SOURCE[c.source] || c.source} · {timeOf(c.credited_at)}
                </span>
              </label>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 p-4">
          <p className={`text-sm ${exact ? "text-emerald-700" : "text-slate-500"}`}>
            Selected {rupees(total)} of {rupees(save.open)}
            {picked.length > 0 && !exact && " — must be equal"}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              disabled={!exact || busy}
              onClick={submit}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Linking…" : "Link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UpiPayments() {
  const role = localStorage.getItem("role");
  const isManager = role === "admin" || role === "superadmin";
  const [date, setDate] = useState(todayIST());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(null);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const { data: d } = await axios.get(`${API}/board`, { ...auth(), params: { date } });
      setData(d);
    } catch (e) {
      toast.error(e.response?.data?.error || "Could not load UPI payments");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Live: new payment caught, or links changed (by the matcher or someone else)
  useEffect(() => {
    const refresh = () => load();
    socket.on("centre_upi_credit", refresh);
    socket.on("upi_links_updated", refresh);
    socket.on("centre_upi_credit_updated", refresh);
    return () => {
      socket.off("centre_upi_credit", refresh);
      socket.off("upi_links_updated", refresh);
      socket.off("centre_upi_credit_updated", refresh);
    };
  }, [load]);

  const unlink = async (c) => {
    if (!window.confirm(`Unlink ${rupees(c.amount)} from ${c.linked.map(customersText).join(", ")}?`)) return;
    try {
      await axios.post(`${API}/${c.id}/unlink`, {}, auth());
      toast.success("Unlinked. It won't be linked automatically again.");
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || "Could not unlink");
    }
  };

  const ignore = async (c, value) => {
    try {
      await axios.post(`${API}/${c.id}/ignore`, { ignore: value }, auth());
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || "Could not update");
    }
  };

  const credits = data?.credits || [];
  const notVerified = data?.not_verified || [];
  const s = data?.summary;
  const shown = credits.filter((c) => filter === "all" || c.status === filter);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">UPI Payments</h1>
          <p className="mt-1 text-sm text-slate-500">
            Payments caught by the centre's companion phone, and the entries they belong to.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            max={todayIST()}
            onChange={(e) => setDate(e.target.value || todayIST())}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button onClick={load} className="rounded-lg border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50" title="Refresh">
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {s && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="UPI received" value={rupees(s.received)} sub={`${s.count} payment${s.count === 1 ? "" : "s"}`} />
          <Tile label="Linked to entries" value={s.linked} sub="verified" tone="green" />
          <Tile label="Unclaimed money" value={rupees(s.unclaimed_total)} sub={`${s.unclaimed} not entered`} tone={s.unclaimed ? "amber" : "slate"} />
          <Tile label="Entries not verified" value={rupees(s.not_verified_total)} sub={`${s.not_verified} entr${s.not_verified === 1 ? "y" : "ies"}`} tone={s.not_verified ? "red" : "slate"} />
        </div>
      )}

      {/* Entries with UPI money and no matching payment */}
      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
          <FiAlertTriangle className="text-rose-500" />
          <h2 className="font-semibold text-slate-800">Entries not verified</h2>
          <span className="text-xs text-slate-400">UPI-wallet money with no matching payment</span>
        </div>
        {notVerified.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">{loading ? "Loading…" : "Every UPI entry on this day has a matching payment."}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {notVerified.map((sv) => {
              const age = minutesAgo(sv.saved_at);
              const waiting = date === todayIST() && age < 30;
              return (
                <li key={`${sv.wallet_id}|${sv.save_key}`} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className="w-16 text-sm text-slate-500">{timeOf(sv.saved_at)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800">{customersText(sv)}</p>
                    <p className="truncate text-xs text-slate-500">
                      {servicesText(sv)} · {sv.wallet_name}
                      {sv.staff_name ? ` · by ${sv.staff_name}` : ""}
                    </p>
                  </div>
                  <span className="font-semibold text-slate-800">{rupees(sv.open)}</span>
                  {waiting ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                      <FiClock /> Waiting for payment
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs text-rose-700">
                      <FiAlertTriangle /> Not verified
                    </span>
                  )}
                  <button
                    onClick={() => setLinking(sv)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <FiLink /> Link payment
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* All UPI payments of the day */}
      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
          <FiCheckCircle className="text-emerald-600" />
          <h2 className="font-semibold text-slate-800">UPI payments</h2>
          <div className="ml-auto flex gap-1 text-xs">
            {[
              ["all", "All"],
              ["matched", "Linked"],
              ["unclaimed", "Unclaimed"],
              ["ignored", "Ignored"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`rounded-full px-3 py-1 ${filter === id ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">{loading ? "Loading…" : "No UPI payments."}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="w-16 text-sm text-slate-500">{timeOf(c.credited_at)}</span>
                <span className="w-20 font-semibold text-slate-800">{rupees(c.amount)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-700">{c.payer || "Unknown payer"}</p>
                  <p className="text-xs text-slate-400">
                    {SOURCE[c.source] || c.source} · {c.wallet_name}
                    {c.utr ? ` · Ref ${c.utr}` : ""}
                  </p>
                </div>

                {c.status === "matched" && (
                  <>
                    <div className="min-w-0 max-w-xs text-right">
                      {c.linked.map((l) => (
                        <p key={l.save_key} className="truncate text-sm text-slate-700">
                          {customersText(l)} · {servicesText(l)}
                        </p>
                      ))}
                      <p className="text-xs text-emerald-700">
                        <FiCheckCircle className="mr-1 inline" />
                        {c.linked.some((l) => l.manual) ? `Linked by ${c.matched_by_name || "staff"}` : "Linked automatically"}
                      </p>
                    </div>
                    <button onClick={() => unlink(c)} className="rounded-lg px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100">
                      Unlink
                    </button>
                  </>
                )}

                {c.status === "unclaimed" && (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
                      Unclaimed{c.no_auto ? " · unlinked by hand" : ""}
                    </span>
                    {isManager && (
                      <button onClick={() => ignore(c, true)} title="Not a customer payment (own transfer, refund…)" className="rounded-lg px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100">
                        <FiSlash className="mr-1 inline" /> Ignore
                      </button>
                    )}
                  </>
                )}

                {c.status === "ignored" && (
                  <>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">Ignored</span>
                    {isManager && (
                      <button onClick={() => ignore(c, false)} className="rounded-lg px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100">
                        Undo
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
          To link an unclaimed payment, use “Link payment” on its entry above. Payments are linked automatically when an
          entry's UPI amount matches exactly (within 3 hours).
        </p>
      </section>

      {linking && (
        <LinkModal
          save={linking}
          credits={credits}
          onClose={() => setLinking(null)}
          onLinked={() => {
            setLinking(null);
            load();
          }}
        />
      )}
    </div>
  );
}
