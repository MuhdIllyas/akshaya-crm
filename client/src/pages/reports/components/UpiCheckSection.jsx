import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FiAlertTriangle, FiCheckCircle, FiLink, FiRefreshCw, FiSlash } from "react-icons/fi";
import { socket } from "@/services/socket";
import {
  getBoard, unlinkCredit, ignoreCredit, rupees, timeOf, SOURCE, servicesText, customersText, errorText,
} from "@/components/upi/upiApi";
import { LinkPaymentsModal } from "@/components/upi/UpiLinkModals";

// Reports → Accounting → UPI Check
// UPI payments the centre's companion phone caught on `date`, checked against
// the entries: verified (linked), entries with no payment, payments with no entry.

function Tile({ label, value, sub, tone = "white" }) {
  const tones = {
    white: ["border-slate-200 bg-white", "text-slate-500", "text-slate-900"],
    green: ["border-emerald-200 bg-emerald-50", "text-emerald-700", "text-emerald-800"],
    amber: ["border-amber-200 bg-amber-50", "text-amber-700", "text-amber-800"],
    red: ["border-rose-200 bg-rose-50", "text-rose-700", "text-rose-800"],
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 ${tones[0]}`}>
      <p className={`text-xs font-medium ${tones[1]}`}>{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tones[2]}`}>{value}</p>
      {sub && <p className={`mt-0.5 text-xs ${tones[1]}`}>{sub}</p>}
    </div>
  );
}

export default function UpiCheckSection({ date, centreId, isSuperAdmin = false, readOnly = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(null);
  const needsCentre = isSuperAdmin && !centreId && !localStorage.getItem("centre_id");

  const load = useCallback(async () => {
    try {
      setData(await getBoard(date, isSuperAdmin ? centreId : undefined));
    } catch (e) {
      toast.error(errorText(e, "Could not load UPI payments"));
    } finally {
      setLoading(false);
    }
  }, [date, centreId, isSuperAdmin]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

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
    if (!window.confirm(`Unlink ${rupees(c.amount)}? It will not be linked automatically again.`)) return;
    try {
      await unlinkCredit(c.id);
      toast.success("Unlinked");
      load();
    } catch (e) {
      toast.error(errorText(e, "Could not unlink"));
    }
  };
  const ignore = async (c, value) => {
    try {
      await ignoreCredit(c.id, value);
      load();
    } catch (e) {
      toast.error(errorText(e, "Could not update"));
    }
  };

  if (needsCentre) {
    return <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Choose a centre to see its UPI payments.</p>;
  }

  if (data?.cleared) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="flex items-center text-lg font-bold text-slate-900">
          <FiCheckCircle className="mr-2 h-5 w-5 text-navy-700" />
          UPI Check
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          UPI payments are kept for the same day only and cleared at midnight. Choose today's date to check payments.
        </p>
      </div>
    );
  }

  const s = data?.summary;
  const credits = data?.credits || [];
  const notVerified = data?.not_verified || [];
  const unclaimed = credits.filter((c) => c.status === "unclaimed");
  const ignored = credits.filter((c) => c.status === "ignored");
  const linked = credits.filter((c) => c.status === "matched");
  const verifiedEntries = linked.reduce((t, c) => t + c.linked.reduce((n, l) => n + l.services.length, 0), 0);
  const bySource = credits.reduce((m, c) => ({ ...m, [c.source]: (m[c.source] || 0) + 1 }), {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center text-lg font-bold text-slate-900">
            <FiCheckCircle className="mr-2 h-5 w-5 text-navy-700" />
            UPI Check
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Payments caught by the centre's companion phone, matched to entries automatically every minute.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {s && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile
            label="UPI received"
            value={rupees(s.received)}
            sub={`${s.count} payment${s.count === 1 ? "" : "s"}${Object.keys(bySource).length ? " · " + Object.entries(bySource).map(([k, v]) => `${SOURCE[k] || k} ${v}`).join(" · ") : ""}`}
          />
          <Tile label="Verified entries" value={verifiedEntries} sub={`${rupees(linked.reduce((t, c) => t + c.amount, 0))} matched`} tone="green" />
          <Tile label="Unclaimed money" value={rupees(s.unclaimed_total)} sub={`${s.unclaimed} payment${s.unclaimed === 1 ? "" : "s"} with no entry`} tone={s.unclaimed ? "amber" : "white"} />
          <Tile label="Not verified" value={rupees(s.not_verified_total)} sub={`${s.not_verified} entr${s.not_verified === 1 ? "y" : "ies"} without payment`} tone={s.not_verified ? "red" : "white"} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-rose-800">
              <FiAlertTriangle className="h-4 w-4" /> Entries without a UPI payment
            </h3>
            <span className="text-xs text-slate-500">{notVerified.length}</span>
          </div>
          {notVerified.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">{loading ? "Loading…" : "Every UPI entry has a matching payment."}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notVerified.map((sv) => (
                <li key={`${sv.wallet_id}|${sv.save_key}`} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="w-14 shrink-0 text-slate-500">{timeOf(sv.saved_at)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{customersText(sv)} · {servicesText(sv)}</p>
                    <p className="truncate text-xs text-slate-500">{sv.wallet_name}{sv.staff_name ? ` · by ${sv.staff_name}` : ""}</p>
                  </div>
                  <span className="font-bold text-slate-900">{rupees(sv.open)}</span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => setLinking(sv)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-navy-700 hover:bg-slate-50"
                    >
                      <FiLink className="h-3.5 w-3.5" /> Link payment
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-amber-800">₹ Payments with no entry</h3>
            <span className="text-xs text-slate-500">{unclaimed.length}</span>
          </div>
          {unclaimed.length === 0 && ignored.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">{loading ? "Loading…" : "Every UPI payment belongs to an entry."}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {[...unclaimed, ...ignored].map((c) => (
                <li key={c.id} className={`flex items-center gap-3 px-4 py-3 text-sm ${c.status === "ignored" ? "opacity-60" : ""}`}>
                  <span className="w-14 shrink-0 text-slate-500">{timeOf(c.credited_at)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{c.payer || "Unknown payer"}</p>
                    <p className="truncate text-xs text-slate-500">
                      {SOURCE[c.source] || c.source} → {c.wallet_name}
                      {c.utr ? ` · Ref ${c.utr}` : ""}
                      {c.no_auto ? " · unlinked by hand" : ""}
                    </p>
                  </div>
                  <span className="font-bold text-slate-900">{rupees(c.amount)}</span>
                  {!readOnly &&
                    (c.status === "ignored" ? (
                      <button type="button" onClick={() => ignore(c, false)} className="rounded-xl px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100">
                        Undo ignore
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => ignore(c, true)}
                        title="Not a customer payment (own transfer, refund…)"
                        className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
                      >
                        <FiSlash className="h-3.5 w-3.5" /> Ignore
                      </button>
                    ))}
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
            Mark own transfers or refunds as Ignore so they don't count as missing entries.
          </p>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-800">
            <FiCheckCircle className="h-4 w-4" /> Verified
          </h3>
          <span className="text-xs text-slate-500">{linked.length} payment{linked.length === 1 ? "" : "s"} linked</span>
        </div>
        {linked.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">{loading ? "Loading…" : "No linked payments on this day."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Time</th>
                  <th className="px-3 py-2.5 font-semibold">Payment</th>
                  <th className="px-3 py-2.5 font-semibold">From</th>
                  <th className="px-3 py-2.5 font-semibold">Entry</th>
                  <th className="px-3 py-2.5 font-semibold">Staff</th>
                  <th className="px-3 py-2.5 font-semibold">Linked</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linked.map((c) => {
                  const manual = c.linked.some((l) => l.manual);
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-2.5 text-slate-500">{timeOf(c.credited_at)}</td>
                      <td className="px-3 py-2.5">
                        <span className="font-bold text-slate-900">{rupees(c.amount)}</span>{" "}
                        <span className="text-slate-500">{SOURCE[c.source] || c.source}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{c.payer || "—"}</td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {c.linked.map((l) => `${customersText(l)} · ${servicesText(l)}`).join("; ")}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{c.linked.map((l) => l.staff_name).filter(Boolean).join(", ") || "—"}</td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${manual ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
                          ✓ {manual ? `By ${c.matched_by_name || "staff"}` : "Auto"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {!readOnly && (
                          <button type="button" onClick={() => unlink(c)} className="text-xs text-slate-400 hover:text-rose-600">
                            Unlink
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {linking && (
        <LinkPaymentsModal
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
