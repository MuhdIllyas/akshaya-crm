// Platform admin → one organization: details, plan & billing, record a
// payment, payment history, suspend/activate, portal links.

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FiCopy, FiX } from "react-icons/fi";
import platformApi, { errorText, formatBytes, formatDate, rupees } from "./platformApi";
import { BillingBadge, StatusBadge } from "./billingBadge";

const input = "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30 disabled:bg-slate-100";
const label = "mb-1.5 block text-sm font-medium text-slate-700";
const section = "rounded-2xl border border-slate-200 bg-white p-4 sm:p-5";

const usageLine = (used, max) => (used === null || used === undefined ? "—" : max === null || max === undefined ? `${used}` : `${used} / ${max}`);

function Usage({ org }) {
  const u = org.usage || {};
  const storageMax = org.storage_mb != null ? `${org.storage_mb} MB` : null;
  const items = [
    ["Centres", usageLine(u.centres, org.max_centres)],
    ["Staff", usageLine(u.staff, org.max_staff)],
    ["Customers", u.customers ?? "—"],
    ["Storage", org.is_default ? "Not counted" : `${formatBytes(u.storage_bytes)}${storageMax ? ` / ${storageMax}` : ""}`],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-xl bg-slate-50 px-3 py-2.5">
          <p className="text-xs text-slate-500">{k}</p>
          <p className="font-semibold text-slate-900">{v}</p>
        </div>
      ))}
    </div>
  );
}

function PaymentForm({ org, onSaved }) {
  const [form, setForm] = useState({ amount: org.price ?? "", paid_on: "", covers_until: "", method: "UPI", reference: "", note: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await platformApi.post(`/orgs/${org.slug}/payments`, form);
      toast.success(`Payment recorded · covered until ${formatDate(data.covers_until)}${data.reactivated ? " · organization switched back on" : ""}`);
      setForm({ ...form, reference: "", note: "", covers_until: "" });
      onSaved();
    } catch (err) {
      toast.error(errorText(err, "Couldn't record the payment"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="pay-amount">Amount (₹)</label>
          <input id="pay-amount" className={input} type="number" min="0" step="0.01" value={form.amount} onChange={set("amount")} required />
        </div>
        <div>
          <label className={label} htmlFor="pay-on">Paid on</label>
          <input id="pay-on" className={input} type="date" value={form.paid_on} onChange={set("paid_on")} />
        </div>
        <div>
          <label className={label} htmlFor="pay-until">Covers until</label>
          <input id="pay-until" className={input} type="date" value={form.covers_until} onChange={set("covers_until")} />
        </div>
        <div>
          <label className={label} htmlFor="pay-method">Method</label>
          <select id="pay-method" className={input} value={form.method} onChange={set("method")}>
            {["UPI", "Bank transfer", "Cash", "Cheque", "Other"].map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
      </div>
      <p className="text-xs text-slate-500">Leave "Covers until" empty to add one {org.billing_cycle === "yearly" ? "year" : "month"} after the current paid period. Leave "Paid on" empty for today.</p>
      <div className="grid grid-cols-2 gap-3">
        <input className={input} placeholder="Reference (UTR, cheque no.)" value={form.reference} onChange={set("reference")} aria-label="Reference" />
        <input className={input} placeholder="Note" value={form.note} onChange={set("note")} aria-label="Note" />
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={busy} className="rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60">
          {busy ? "Saving…" : "Record payment"}
        </button>
      </div>
    </form>
  );
}

export default function OrgDetail({ slug, plans, onClose, onChanged }) {
  const [org, setOrg] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    platformApi
      .get(`/orgs/${slug}`)
      .then(({ data }) => {
        setOrg(data);
        setForm({
          name: data.name || "",
          contact_name: data.contact_name || "",
          contact_phone: data.contact_phone || "",
          contact_email: data.contact_email || "",
          notes: data.notes || "",
          plan_id: data.plan_id || "",
          billing_cycle: data.billing_cycle || "monthly",
          trial_ends_at: data.trial_ends_at || "",
          paid_until: data.paid_until || "",
          grace_days: data.grace_days ?? 7,
        });
      })
      .catch((err) => toast.error(errorText(err, "Couldn't load the organization")));

  useEffect(() => {
    load();
  }, [slug]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const refresh = () => {
    load();
    onChanged();
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = org.is_default
        ? { name: form.name, contact_name: form.contact_name, contact_phone: form.contact_phone, contact_email: form.contact_email, notes: form.notes }
        : { ...form, plan_id: form.plan_id ? Number(form.plan_id) : null };
      await platformApi.put(`/orgs/${slug}`, body);
      toast.success("Saved");
      refresh();
    } catch (err) {
      toast.error(errorText(err, "Couldn't save"));
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status) => {
    let reason;
    if (status === "suspended") {
      reason = window.prompt(`Suspend ${org.name}? Their staff and customers won't be able to use the app.\n\nReason (optional):`, "Suspended by platform admin");
      if (reason === null) return;
    }
    try {
      await platformApi.post(`/orgs/${slug}/status`, { status, reason });
      toast.success(status === "active" ? "Organization switched on" : "Organization suspended");
      refresh();
    } catch (err) {
      toast.error(errorText(err, "Couldn't change the status"));
    }
  };

  const front = window.location.origin;
  const links = org
    ? [
        ["Staff login", `${front}/portal/${org.slug}/login`],
        ["Customer registration", `${front}/portal/${org.slug}/customer/register`],
      ]
    : [];
  const copy = (text) => navigator.clipboard.writeText(text).then(() => toast.info("Copied"), () => toast.error(text));

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" role="dialog" aria-modal="true" aria-label="Organization details">
      <div className="flex h-full w-full max-w-2xl flex-col bg-slate-50 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-900">{org?.name || slug}</h2>
            <p className="font-mono text-xs text-slate-500">{slug}</p>
            {org && (
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge status={org.status} />
                <BillingBadge billing={org.billing} />
              </div>
            )}
            {org?.status === "suspended" && org.status_reason && <p className="mt-1.5 text-sm text-rose-700">{org.status_reason}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <FiX size={20} />
          </button>
        </div>

        {!org || !form ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            <div className={section}>
              <h3 className="mb-3 font-semibold text-slate-900">Usage</h3>
              <Usage org={org} />
            </div>

            <form onSubmit={save} className={`${section} space-y-4`}>
              <h3 className="font-semibold text-slate-900">Details{org.is_default ? "" : " and billing"}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={label} htmlFor="o-name">Name</label>
                  <input id="o-name" className={input} value={form.name} onChange={set("name")} required />
                </div>
                <div>
                  <label className={label} htmlFor="o-cname">Contact person</label>
                  <input id="o-cname" className={input} value={form.contact_name} onChange={set("contact_name")} />
                </div>
                <div>
                  <label className={label} htmlFor="o-cphone">Phone</label>
                  <input id="o-cphone" className={input} value={form.contact_phone} onChange={set("contact_phone")} />
                </div>
                <div className="sm:col-span-2">
                  <label className={label} htmlFor="o-cemail">Email</label>
                  <input id="o-cemail" className={input} type="email" value={form.contact_email} onChange={set("contact_email")} />
                </div>
              </div>

              {!org.is_default && (
                <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                  <div>
                    <label className={label} htmlFor="o-plan">Plan</label>
                    <select id="o-plan" className={input} value={form.plan_id} onChange={set("plan_id")}>
                      <option value="">No plan (no limits)</option>
                      {plans.filter((p) => p.is_active || p.id === org.plan_id).map((p) => (
                        <option key={p.id} value={p.id}>{p.name} · {rupees(p.price_monthly)}/mo</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={label} htmlFor="o-cycle">Billing cycle</label>
                    <select id="o-cycle" className={input} value={form.billing_cycle} onChange={set("billing_cycle")}>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className={label} htmlFor="o-trial">Trial ends</label>
                    <input id="o-trial" className={input} type="date" value={form.trial_ends_at} onChange={set("trial_ends_at")} />
                  </div>
                  <div>
                    <label className={label} htmlFor="o-paid">Paid until</label>
                    <input id="o-paid" className={input} type="date" value={form.paid_until} onChange={set("paid_until")} />
                  </div>
                  <div>
                    <label className={label} htmlFor="o-grace">Grace days</label>
                    <input id="o-grace" className={input} type="number" min="0" max="90" value={form.grace_days} onChange={set("grace_days")} />
                  </div>
                  <p className="self-end text-xs text-slate-500">After the trial or paid period ends, the organization keeps working for the grace days, then is suspended automatically.</p>
                </div>
              )}

              <div>
                <label className={label} htmlFor="o-notes">Notes</label>
                <textarea id="o-notes" className={input} rows={2} value={form.notes} onChange={set("notes")} />
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={busy} className="rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60">
                  {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </form>

            {!org.is_default && (
              <div className={section}>
                <h3 className="mb-3 font-semibold text-slate-900">Record a payment</h3>
                <PaymentForm org={org} onSaved={refresh} />
              </div>
            )}

            {!org.is_default && (
              <div className={section}>
                <h3 className="mb-3 font-semibold text-slate-900">Payments</h3>
                {org.payments.length === 0 ? (
                  <p className="text-sm text-slate-500">No payments recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="py-2 pr-4 font-semibold">Paid on</th>
                          <th className="py-2 pr-4 font-semibold">Amount</th>
                          <th className="py-2 pr-4 font-semibold">Covers until</th>
                          <th className="py-2 font-semibold">Method</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {org.payments.map((p) => (
                          <tr key={p.id}>
                            <td className="whitespace-nowrap py-2 pr-4">{formatDate(p.paid_on)}</td>
                            <td className="whitespace-nowrap py-2 pr-4 font-medium">{rupees(p.amount)}</td>
                            <td className="whitespace-nowrap py-2 pr-4">{formatDate(p.covers_until)}</td>
                            <td className="py-2 text-slate-600">{[p.method, p.reference].filter(Boolean).join(" · ") || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className={section}>
              <h3 className="mb-3 font-semibold text-slate-900">Portal links</h3>
              <ul className="space-y-2">
                {links.map(([name, url]) => (
                  <li key={name} className="flex items-center gap-2">
                    <span className="w-44 shrink-0 text-sm text-slate-500">{name}</span>
                    <code className="min-w-0 flex-1 truncate text-sm text-slate-800">{url}</code>
                    <button onClick={() => copy(url)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={`Copy ${name} link`}>
                      <FiCopy />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {!org.is_default && (
              <div className={`${section} flex flex-wrap items-center justify-between gap-3`}>
                <div>
                  <h3 className="font-semibold text-slate-900">{org.status === "active" ? "Suspend organization" : "Switch organization back on"}</h3>
                  <p className="text-sm text-slate-500">
                    {org.status === "active" ? "Blocks all logins and API calls for its staff and customers. Data is kept." : "Its staff and customers can use the app again."}
                  </p>
                </div>
                {org.status === "active" ? (
                  <button onClick={() => setStatus("suspended")} className="rounded-xl border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50">Suspend</button>
                ) : (
                  <button onClick={() => setStatus("active")} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">Switch on</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
