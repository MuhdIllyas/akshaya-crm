// Control panel → Payments: every payment recorded, across all organizations,
// filtered by month, with a download that opens in Excel.

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FiDownload } from "react-icons/fi";
import platformApi, { errorText, formatDate, rupees } from "./platformApi";

const thisMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);

const lastMonths = (n) => {
  const [y, m] = thisMonth().split("-").map(Number);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
};

const monthName = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

export default function PaymentsPanel({ onOpenOrg }) {
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setData(null);
    platformApi
      .get("/payments", { params: { month } })
      .then(({ data: d }) => setData(d))
      .catch((err) => toast.error(errorText(err, "Couldn't load payments")));
  }, [month]);

  const download = async () => {
    setDownloading(true);
    try {
      const { data: blob } = await platformApi.get("/payments", { params: { month, format: "csv" }, responseType: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payments-${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't download the payments");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <label htmlFor="pay-month" className="text-sm text-slate-600">Month</label>
          <select
            id="pay-month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30"
          >
            {lastMonths(24).map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
            <option value="all">All time</option>
          </select>
        </div>
        <div className="flex items-center gap-4">
          {data && (
            <p className="text-sm text-slate-600">
              {data.count} payment{data.count === 1 ? "" : "s"} · <span className="font-semibold text-emerald-700">{rupees(data.total)}</span>
            </p>
          )}
          <button
            onClick={download}
            disabled={downloading || !data?.count}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-medium text-navy-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <FiDownload aria-hidden="true" /> {downloading ? "Preparing…" : "Download for Excel"}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Paid on</th>
                <th className="px-4 py-3 font-semibold">Organization</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Covers until</th>
                <th className="px-4 py-3 font-semibold">Method</th>
                <th className="px-4 py-3 font-semibold">Recorded by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.payments || []).map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(p.paid_on)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => onOpenOrg(p.org_slug)} className="text-left font-medium text-navy-700 hover:underline">
                      {p.org_name || p.org_slug}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">{rupees(p.amount)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(p.covers_until)}</td>
                  <td className="px-4 py-3 text-slate-600">{[p.method, p.reference].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{p.recorded_by_name || "—"}</td>
                </tr>
              ))}
              {data && data.payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">No payments recorded {month === "all" ? "yet" : `in ${monthName(month)}`}.</td>
                </tr>
              )}
              {!data && (
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
