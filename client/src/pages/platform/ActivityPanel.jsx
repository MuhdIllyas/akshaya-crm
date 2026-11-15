// Control panel → Activity log (owners only): who did what, when, from where.

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import platformApi, { errorText, formatDate, formatDateTime, rupees } from "./platformApi";

const PAGE = 100;

/** A readable sentence for each recorded action. */
function describe({ action, target, details }) {
  const d = details || {};
  switch (action) {
    case "organization.created":
      return `created organization ${target}${d.trial_ends_at ? `, trial until ${formatDate(String(d.trial_ends_at).slice(0, 10))}` : ""}`;
    case "organization.updated":
      return `updated organization ${target}${d.plan_id !== undefined ? " (plan or billing)" : ""}`;
    case "organization.suspended":
      return `suspended ${target}${d.reason ? `: ${d.reason}` : ""}`;
    case "organization.activated":
      return `switched ${target} back on`;
    case "payment.recorded":
      return `recorded ${rupees(d.amount)} from ${target}, covered until ${formatDate(d.covers_until)}${d.reactivated ? " (switched back on)" : ""}`;
    case "plan.created":
      return `created plan ${target}`;
    case "plan.updated":
      return `updated ${target}`;
    case "billing.check_run":
      return `ran the overdue check${d.suspended?.length ? `, suspended ${d.suspended.join(", ")}` : ""}`;
    case "admin.created":
      return `added admin ${target} as ${d.role}`;
    case "admin.updated": {
      const bits = [];
      if (d.role) bits.push(`role ${d.role}`);
      if (d.is_active === false) bits.push("switched off");
      if (d.is_active === true) bits.push("switched on");
      if (d.password_reset) bits.push("password reset");
      return `updated admin ${target}${bits.length ? ` (${bits.join(", ")})` : ""}`;
    }
    case "account.password_changed":
      return "changed their password";
    default:
      return `${action}${target ? ` ${target}` : ""}`;
  }
}

export default function ActivityPanel() {
  const [items, setItems] = useState(null);
  const [more, setMore] = useState(false);

  const load = (before) =>
    platformApi
      .get("/activity", { params: { limit: PAGE, before } })
      .then(({ data }) => {
        setItems((prev) => (before ? [...(prev || []), ...data] : data));
        setMore(data.length === PAGE);
      })
      .catch((err) => toast.error(errorText(err, "Couldn't load the activity log")));

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {!items ? (
        <p className="p-6 text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">Nothing recorded yet. Actions in the control panel appear here.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((it) => (
            <li key={it.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
              <p className="min-w-0 text-slate-700">
                <span className="font-semibold text-slate-900">{it.admin_name || "Someone"}</span> {describe(it)}
              </p>
              <p className="shrink-0 text-xs text-slate-500">
                {formatDateTime(it.created_at)}
                {it.ip && <span className="ml-2 text-slate-400">{it.ip}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
      {more && (
        <div className="border-t border-slate-100 p-3 text-center">
          <button onClick={() => load(items[items.length - 1].id)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy-700 hover:bg-slate-50">
            Show older
          </button>
        </div>
      )}
    </div>
  );
}
