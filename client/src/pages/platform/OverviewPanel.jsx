// Control panel → Overview: key figures, what needs attention today, and
// payments collected over the last 6 months.

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FiAlertCircle, FiCheckCircle } from "react-icons/fi";
import platformApi, { errorText, rupees } from "./platformApi";

const KIND_STYLE = {
  suspended: "bg-rose-50 text-rose-700 border-rose-200",
  overdue: "bg-rose-50 text-rose-700 border-rose-200",
  grace: "bg-amber-50 text-amber-700 border-amber-200",
  due: "bg-amber-50 text-amber-700 border-amber-200",
  trial: "bg-sky-50 text-sky-700 border-sky-200",
  storage: "bg-amber-50 text-amber-700 border-amber-200",
};

const monthLabel = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short" });

function Kpi({ label, value, note, tone = "text-slate-900" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
      {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

export default function OverviewPanel({ onOpenOrg }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    platformApi
      .get("/overview")
      .then(({ data: d }) => setData(d))
      .catch((err) => toast.error(errorText(err, "Couldn't load the overview")));
  }, []);

  if (!data) return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading…</div>;

  const k = data.kpis;
  const max = Math.max(1, ...data.collections.map((c) => c.total));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Active organizations" value={k.active_organizations} note={k.new_this_month ? `+${k.new_this_month} this month` : "None new this month"} />
        <Kpi label="Monthly revenue" value={rupees(k.monthly_revenue)} note="From paid plans (yearly ÷ 12)" tone="text-emerald-700" />
        <Kpi label="Collected this month" value={rupees(k.collected_this_month)} note={`${k.payments_this_month} payment${k.payments_this_month === 1 ? "" : "s"}`} tone="text-emerald-700" />
        <Kpi label="In trial" value={k.in_trial} note={k.trials_ending_soon ? `${k.trials_ending_soon} ending within 7 days` : "None ending this week"} tone="text-sky-700" />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-3">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FiAlertCircle className="text-amber-600" aria-hidden="true" /> Needs attention
          </h2>
          {data.attention.length === 0 ? (
            <p className="flex items-center gap-2 py-6 text-sm text-slate-500">
              <FiCheckCircle className="text-emerald-600" aria-hidden="true" /> Nothing needs attention right now.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.attention.map((a, i) => (
                <li key={`${a.slug}-${a.kind}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{a.name}</p>
                    <p className="font-mono text-xs text-slate-400">{a.slug}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${KIND_STYLE[a.kind]}`}>{a.label}</span>
                    <button onClick={() => onOpenOrg(a.slug)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-navy-700 hover:bg-slate-50">
                      Open
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Collected, last 6 months</h2>
          <div className="flex h-40 items-end gap-2" role="img" aria-label="Payments collected per month for the last six months">
            {data.collections.map((c, i) => {
              const last = i === data.collections.length - 1;
              return (
                <div key={c.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] text-slate-500">{c.total ? rupees(c.total).replace("₹", "₹ ") : ""}</span>
                  <div
                    className={`w-full rounded-md ${last ? "bg-navy-700" : "bg-slate-300"}`}
                    style={{ height: `${Math.max(c.total ? 6 : 2, (c.total / max) * 100)}%` }}
                    title={`${monthLabel(c.month)}: ${rupees(c.total)}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex gap-2">
            {data.collections.map((c) => (
              <span key={c.month} className="flex-1 text-center text-xs text-slate-500">{monthLabel(c.month)}</span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
