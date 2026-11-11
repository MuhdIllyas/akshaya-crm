// Platform admin → Plans: create and edit subscription plans.
// Empty limit = unlimited. A flat-fee plan is simply one with no limits.

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FiEdit2, FiPlus } from "react-icons/fi";
import platformApi, { errorText, rupees } from "./platformApi";

const EMPTY = {
  name: "",
  description: "",
  price_monthly: "",
  price_yearly: "",
  max_centres: "",
  max_staff: "",
  storage_mb: "",
  customer_portal: true,
  whatsapp: true,
  is_active: true,
};

const limitText = (v, unit = "") => (v === null || v === undefined ? "Unlimited" : `${v}${unit}`);

function PlanForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(() => {
    const f = { ...EMPTY, ...(initial || {}) };
    for (const k of ["price_monthly", "price_yearly", "max_centres", "max_staff", "storage_mb"]) f[k] = f[k] === null ? "" : String(f[k]);
    return f;
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        name: form.name,
        description: form.description,
        price_monthly: form.price_monthly,
        price_yearly: form.price_yearly,
        max_centres: form.max_centres,
        max_staff: form.max_staff,
        storage_mb: form.storage_mb,
        customer_portal: form.customer_portal,
        whatsapp: form.whatsapp,
        is_active: form.is_active,
      };
      if (initial?.id) await platformApi.put(`/plans/${initial.id}`, body);
      else await platformApi.post("/plans", body);
      toast.success("Plan saved");
      onSaved();
    } catch (err) {
      toast.error(errorText(err, "Couldn't save the plan"));
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30";
  const label = "mb-1.5 block text-sm font-medium text-slate-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label={initial?.id ? "Edit plan" : "New plan"}>
      <form onSubmit={save} className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-navy-700 px-5 py-4 text-white">
          <h2 className="text-lg font-semibold">{initial?.id ? "Edit plan" : "New plan"}</h2>
        </div>
        <div className="space-y-4 overflow-y-auto p-5">
          <div>
            <label className={label} htmlFor="plan-name">Name</label>
            <input id="plan-name" className={input} value={form.name} onChange={set("name")} placeholder="e.g. Basic" required />
          </div>
          <div>
            <label className={label} htmlFor="plan-desc">Description</label>
            <input id="plan-desc" className={input} value={form.description || ""} onChange={set("description")} placeholder="Shown only to you" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="plan-pm">Price / month (₹)</label>
              <input id="plan-pm" className={input} type="number" min="0" step="0.01" value={form.price_monthly} onChange={set("price_monthly")} />
            </div>
            <div>
              <label className={label} htmlFor="plan-py">Price / year (₹)</label>
              <input id="plan-py" className={input} type="number" min="0" step="0.01" value={form.price_yearly} onChange={set("price_yearly")} />
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">Limits <span className="font-normal text-slate-500">(leave empty for unlimited)</span></p>
            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Centres</span>
                <input className={input} type="number" min="0" step="1" value={form.max_centres} onChange={set("max_centres")} placeholder="∞" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Staff</span>
                <input className={input} type="number" min="0" step="1" value={form.max_staff} onChange={set("max_staff")} placeholder="∞" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Storage (MB)</span>
                <input className={input} type="number" min="0" step="1" value={form.storage_mb} onChange={set("storage_mb")} placeholder="∞" />
              </label>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">Staff counts active staff members; superadmins don't count.</p>
          </div>
          <div className="space-y-2">
            {[
              ["customer_portal", "Customer portal", "Online registration, login and booking for customers"],
              ["whatsapp", "WhatsApp", "Centres can connect WhatsApp numbers. Turning this off switches off their accounts."],
              ["is_active", "Available", "Can be chosen for organizations"],
            ].map(([key, title, text]) => (
              <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3.5 py-3">
                <input type="checkbox" checked={!!form[key]} onChange={set(key)} className="mt-0.5 h-4 w-4 accent-navy-700" />
                <span>
                  <span className="block text-sm font-medium text-slate-800">{title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{text}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-xl bg-navy-700 px-5 py-2.5 font-semibold text-white hover:bg-navy-800 disabled:opacity-60">
            {busy ? "Saving…" : "Save plan"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PlansPanel() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // plan, {} for new, null closed

  const load = () =>
    platformApi
      .get("/plans")
      .then(({ data }) => setPlans(data))
      .catch((err) => toast.error(errorText(err, "Couldn't load plans")))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Plans set the price and what each organization can use.</p>
        <button onClick={() => setEditing({})} className="inline-flex items-center gap-2 rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800">
          <FiPlus /> New plan
        </button>
      </div>

      {!loading && plans.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          No plans yet. Create your first plan, then assign it to organizations.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((p) => (
          <div key={p.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${p.is_active ? "border-slate-200" : "border-dashed border-slate-300 opacity-75"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-slate-900">{p.name}</h3>
                {p.description && <p className="mt-0.5 text-sm text-slate-500">{p.description}</p>}
              </div>
              <button onClick={() => setEditing(p)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-navy-700" aria-label={`Edit ${p.name}`}>
                <FiEdit2 />
              </button>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">
              {rupees(p.price_monthly)}<span className="text-sm font-normal text-slate-500"> / month</span>
            </p>
            <p className="text-sm text-slate-500">{rupees(p.price_yearly)} / year</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-slate-500">Centres</dt><dd className="text-right font-medium text-slate-800">{limitText(p.max_centres)}</dd>
              <dt className="text-slate-500">Staff</dt><dd className="text-right font-medium text-slate-800">{limitText(p.max_staff)}</dd>
              <dt className="text-slate-500">Storage</dt><dd className="text-right font-medium text-slate-800">{limitText(p.storage_mb, " MB")}</dd>
              <dt className="text-slate-500">Customer portal</dt><dd className="text-right font-medium text-slate-800">{p.customer_portal ? "Yes" : "No"}</dd>
              <dt className="text-slate-500">WhatsApp</dt><dd className="text-right font-medium text-slate-800">{p.whatsapp ? "Yes" : "No"}</dd>
            </dl>
            <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
              {p.organizations} organization{p.organizations === 1 ? "" : "s"}{p.is_active ? "" : " · not available for new organizations"}
            </p>
          </div>
        ))}
      </div>

      {editing && (
        <PlanForm
          initial={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
