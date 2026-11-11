// Platform admin → Organizations: summary, list with plan/billing/usage,
// create a new organization, open one for billing and payments.

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FiPlus, FiRefreshCw } from "react-icons/fi";
import platformApi, { errorText, formatBytes, formatDate, rupees } from "./platformApi";
import { BillingBadge, StatusBadge } from "./billingBadge";
import OrgDetail from "./OrgDetail";

const input = "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30";
const label = "mb-1.5 block text-sm font-medium text-slate-700";

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 41);

function NewOrgForm({ plans, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: "",
    slug: "",
    admin_username: "",
    admin_password: "",
    admin_name: "",
    phone: "",
    admin_email: "",
    plan_id: "",
    billing_cycle: "monthly",
    trial_days: "14",
    grace_days: "7",
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v, ...(k === "name" && !slugTouched ? { slug: slugify(v) } : {}) }));
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await platformApi.post("/orgs", { ...form, plan_id: form.plan_id ? Number(form.plan_id) : null });
      toast.success(`${form.name} created`);
      onCreated(data.slug);
    } catch (err) {
      toast.error(errorText(err, "Couldn't create the organization"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="New organization">
      <form onSubmit={save} className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-navy-700 px-5 py-4 text-white">
          <h2 className="text-lg font-semibold">New organization</h2>
          <p className="text-sm text-white/70">Creates its own empty database and its first superadmin login.</p>
        </div>
        <div className="space-y-4 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="n-name">Business name</label>
              <input id="n-name" className={input} value={form.name} onChange={set("name")} required />
            </div>
            <div>
              <label className={label} htmlFor="n-slug">Portal address</label>
              <input
                id="n-slug"
                className={`${input} font-mono`}
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm({ ...form, slug: slugify(e.target.value) });
                }}
                required
              />
              <p className="mt-1 truncate text-xs text-slate-500">{window.location.origin}/portal/{form.slug || "…"}</p>
            </div>
          </div>

          <fieldset className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold text-slate-900">Their superadmin</legend>
            <div>
              <label className={label} htmlFor="n-user">Username</label>
              <input id="n-user" className={input} value={form.admin_username} onChange={set("admin_username")} autoComplete="off" required />
            </div>
            <div>
              <label className={label} htmlFor="n-pass">Password</label>
              <input id="n-pass" className={input} type="password" minLength={8} value={form.admin_password} onChange={set("admin_password")} autoComplete="new-password" required />
            </div>
            <div>
              <label className={label} htmlFor="n-aname">Owner name</label>
              <input id="n-aname" className={input} value={form.admin_name} onChange={set("admin_name")} />
            </div>
            <div>
              <label className={label} htmlFor="n-phone">Phone</label>
              <input id="n-phone" className={input} value={form.phone} onChange={set("phone")} />
            </div>
            <div className="sm:col-span-2">
              <label className={label} htmlFor="n-email">Email</label>
              <input id="n-email" className={input} type="email" value={form.admin_email} onChange={set("admin_email")} />
            </div>
          </fieldset>

          <fieldset className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold text-slate-900">Plan and billing</legend>
            <div>
              <label className={label} htmlFor="n-plan">Plan</label>
              <select id="n-plan" className={input} value={form.plan_id} onChange={set("plan_id")}>
                <option value="">No plan (no limits)</option>
                {plans.filter((p) => p.is_active).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} · {rupees(p.price_monthly)}/mo</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="n-cycle">Billing cycle</label>
              <select id="n-cycle" className={input} value={form.billing_cycle} onChange={set("billing_cycle")}>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className={label} htmlFor="n-trial">Free trial (days)</label>
              <input id="n-trial" className={input} type="number" min="0" max="365" value={form.trial_days} onChange={set("trial_days")} />
            </div>
            <div>
              <label className={label} htmlFor="n-grace">Grace days after due date</label>
              <input id="n-grace" className={input} type="number" min="0" max="90" value={form.grace_days} onChange={set("grace_days")} />
            </div>
          </fieldset>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-xl bg-navy-700 px-5 py-2.5 font-semibold text-white hover:bg-navy-800 disabled:opacity-60">
            {busy ? "Creating… (up to a minute)" : "Create organization"}
          </button>
        </div>
      </form>
    </div>
  );
}

const usage = (used, max) => (used === null || used === undefined ? "—" : max === null || max === undefined ? used : `${used}/${max}`);

export default function OrgsPanel() {
  const [orgs, setOrgs] = useState([]);
  const [plans, setPlans] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openSlug, setOpenSlug] = useState(null);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const [o, p, s] = await Promise.all([platformApi.get("/orgs"), platformApi.get("/plans"), platformApi.get("/summary")]);
      setOrgs(o.data);
      setPlans(p.data);
      setSummary(s.data);
    } catch (err) {
      toast.error(errorText(err, "Couldn't load organizations"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const FILTERS = {
    all: () => true,
    attention: (o) => ["grace", "overdue"].includes(o.billing.state) || (["active", "trial"].includes(o.billing.state) && o.billing.days_left <= 7),
    trial: (o) => o.billing.state === "trial",
    suspended: (o) => o.status === "suspended",
  };
  const shown = orgs.filter(FILTERS[filter]);

  const cards = summary
    ? [
        ["Organizations", summary.organizations, "text-slate-900"],
        ["In trial", summary.in_trial, "text-sky-700"],
        ["Due within 7 days", summary.due_soon, "text-amber-600"],
        ["Grace / overdue", summary.in_grace + summary.overdue, "text-rose-600"],
        ["Suspended", summary.suspended, "text-rose-600"],
        ["Monthly revenue", rupees(summary.monthly_revenue), "text-emerald-700"],
        ["Collected this month", rupees(summary.collected_this_month), "text-emerald-700"],
      ]
    : [];

  return (
    <div className="space-y-5">
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {cards.map(([k, v, tone]) => (
            <div key={k} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-medium text-slate-500">{k}</p>
              <p className={`text-xl font-bold ${tone}`}>{v}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl bg-slate-200/70 p-1" role="tablist" aria-label="Filter organizations">
          {[["all", "All"], ["attention", "Needs attention"], ["trial", "Trial"], ["suspended", "Suspended"]].map(([k, t]) => (
            <button
              key={k}
              role="tab"
              aria-selected={filter === k}
              onClick={() => setFilter(k)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${filter === k ? "bg-white text-navy-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50" aria-label="Refresh">
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800">
            <FiPlus /> New organization
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Organization</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Covered until</th>
                <th className="px-4 py-3 font-semibold">Centres</th>
                <th className="px-4 py-3 font-semibold">Staff</th>
                <th className="px-4 py-3 font-semibold">Customers</th>
                <th className="px-4 py-3 font-semibold">Storage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((o) => (
                <tr key={o.slug} onClick={() => setOpenSlug(o.slug)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <button className="text-left" onClick={() => setOpenSlug(o.slug)}>
                      <span className="block font-medium text-slate-900">{o.name}</span>
                      <span className="block font-mono text-xs text-slate-500">{o.slug}</span>
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {o.is_default ? "—" : o.plan_name || "No plan"}
                    {!o.is_default && o.price != null && <span className="block text-xs text-slate-500">{rupees(o.price)} / {o.billing_cycle === "yearly" ? "year" : "month"}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={o.status} />
                      <BillingBadge billing={o.billing} />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(o.billing.covered_until)}</td>
                  <td className="px-4 py-3 text-slate-700">{usage(o.usage?.centres, o.max_centres)}</td>
                  <td className="px-4 py-3 text-slate-700">{usage(o.usage?.staff, o.max_staff)}</td>
                  <td className="px-4 py-3 text-slate-700">{o.usage?.customers ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{o.is_default ? "—" : formatBytes(o.usage?.storage_bytes)}</td>
                </tr>
              ))}
              {!loading && shown.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">No organizations here.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {creating && (
        <NewOrgForm
          plans={plans}
          onClose={() => setCreating(false)}
          onCreated={(slug) => {
            setCreating(false);
            load();
            setOpenSlug(slug);
          }}
        />
      )}
      {openSlug && <OrgDetail slug={openSlug} plans={plans} onClose={() => setOpenSlug(null)} onChanged={load} />}
    </div>
  );
}
