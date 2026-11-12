// Control panel → Subscriptions: every organization's plan, billing cycle,
// next due date and state in one list. Opening a row shows its details,
// where payments are recorded and plans changed.

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import platformApi, { errorText, formatDate, rupees } from "./platformApi";
import { BillingBadge, StatusBadge } from "./billingBadge";

const FILTERS = [
  ["all", "All", () => true],
  ["due", "Due soon", (s) => ["active", "trial"].includes(s.billing.state) && s.billing.days_left <= 7],
  ["overdue", "Overdue", (s) => ["grace", "overdue"].includes(s.billing.state) || s.status === "suspended"],
  ["trial", "Trial", (s) => s.billing.state === "trial"],
  ["unbilled", "No billing dates", (s) => s.billing.state === "unbilled"],
];

export default function SubscriptionsPanel({ onOpenOrg }) {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    platformApi
      .get("/subscriptions")
      .then(({ data }) => setRows(data))
      .catch((err) => toast.error(errorText(err, "Couldn't load subscriptions")));
  }, []);

  const test = FILTERS.find(([k]) => k === filter)[2];
  const q = query.trim().toLowerCase();
  const shown = (rows || [])
    .filter(test)
    .filter((s) => !q || s.name.toLowerCase().includes(q) || s.slug.includes(q))
    .sort((a, b) => (a.billing.covered_until || "9999").localeCompare(b.billing.covered_until || "9999"));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Filter subscriptions">
          {FILTERS.map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={filter === k}
              onClick={() => setFilter(k)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${filter === k ? "bg-white text-navy-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              {label}
              {rows && <span className="ml-1.5 text-xs text-slate-400">{rows.filter(FILTERS.find(([x]) => x === k)[2]).length}</span>}
            </button>
          ))}
        </div>
        <input
          className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30 sm:w-64"
          placeholder="Search organization"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search organization"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Organization</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Cycle</th>
                <th className="px-4 py-3 font-semibold">Next due</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((s) => (
                <tr key={s.slug} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{s.name}</p>
                    <p className="font-mono text-xs text-slate-500">{s.slug}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {s.plan_name || "No plan"}
                    {s.price != null && <span className="block text-xs text-slate-500">{rupees(s.price)}</span>}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-700">{s.billing_cycle}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(s.billing.covered_until)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      {s.status !== "active" && <StatusBadge status={s.status} />}
                      <BillingBadge billing={s.billing} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => onOpenOrg(s.slug)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-navy-700 hover:bg-slate-50">
                      Open
                    </button>
                  </td>
                </tr>
              ))}
              {rows && shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">No organizations here.</td>
                </tr>
              )}
              {!rows && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">Loading…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
