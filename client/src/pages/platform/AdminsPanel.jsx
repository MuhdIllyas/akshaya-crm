// Control panel → Platform admins (owners only): who can open the control
// panel, with what role. Owner = everything; Billing = organizations,
// subscriptions and payments; Viewer = read only.

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FiEdit2, FiUserPlus } from "react-icons/fi";
import platformApi, { errorText, formatDateTime, ROLE_LABELS } from "./platformApi";

const ROLE_HELP = {
  owner: "Everything, including plans, admins and the activity log",
  billing: "Organizations, subscriptions and payments",
  viewer: "Read only",
};

const input = "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30 disabled:bg-slate-100";
const label = "mb-1.5 block text-sm font-medium text-slate-700";

function AdminForm({ admin, onClose, onSaved }) {
  const editing = Boolean(admin);
  const [form, setForm] = useState({
    username: admin?.username || "",
    name: admin?.name || "",
    role: admin?.role || "billing",
    is_active: admin?.is_active ?? true,
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        const body = { name: form.name };
        if (!admin.is_you) Object.assign(body, { role: form.role, is_active: form.is_active });
        if (form.password) body.password = form.password;
        await platformApi.put(`/admins/${admin.id}`, body);
        toast.success("Admin updated");
      } else {
        await platformApi.post("/admins", form);
        toast.success(`${form.username} can now sign in`);
      }
      onSaved();
    } catch (err) {
      toast.error(errorText(err, "Couldn't save"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label={editing ? "Edit admin" : "Add admin"}>
      <form onSubmit={save} className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-navy-700 px-5 py-4 text-white">
          <h2 className="text-lg font-semibold">{editing ? `Edit ${admin.username}` : "Add a platform admin"}</h2>
        </div>
        <div className="space-y-4 p-5">
          {!editing && (
            <div>
              <label className={label} htmlFor="ad-user">Username</label>
              <input id="ad-user" className={input} value={form.username} onChange={set("username")} autoComplete="off" required />
            </div>
          )}
          <div>
            <label className={label} htmlFor="ad-name">Name</label>
            <input id="ad-name" className={input} value={form.name} onChange={set("name")} />
          </div>
          <div>
            <label className={label} htmlFor="ad-role">Role</label>
            <select id="ad-role" className={input} value={form.role} onChange={set("role")} disabled={admin?.is_you}>
              {Object.keys(ROLE_LABELS).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500">{admin?.is_you ? "You can't change your own role." : ROLE_HELP[form.role]}</p>
          </div>
          <div>
            <label className={label} htmlFor="ad-pass">{editing ? "New password (leave empty to keep)" : "Password"}</label>
            <input id="ad-pass" className={input} type="password" minLength={10} value={form.password} onChange={set("password")} autoComplete="new-password" required={!editing} />
            <p className="mt-1 text-xs text-slate-500">At least 10 characters. Share it with them privately.</p>
          </div>
          {editing && !admin.is_you && (
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3">
              <input type="checkbox" checked={form.is_active} onChange={set("is_active")} className="h-4 w-4 accent-navy-700" />
              <span className="text-sm text-slate-800">Can sign in <span className="block text-xs text-slate-500">Untick to switch this account off without deleting it.</span></span>
            </label>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-xl bg-navy-700 px-5 py-2.5 font-semibold text-white hover:bg-navy-800 disabled:opacity-60">
            {busy ? "Saving…" : editing ? "Save" : "Add admin"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminsPanel() {
  const [admins, setAdmins] = useState(null);
  const [editing, setEditing] = useState(null); // admin, {} = new, null = closed

  const load = () =>
    platformApi
      .get("/admins")
      .then(({ data }) => setAdmins(data))
      .catch((err) => toast.error(errorText(err, "Couldn't load admins")));

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="px-1 text-sm text-slate-600">People who can open this control panel. Your organizations' staff are managed inside each organization.</p>
        <button onClick={() => setEditing({})} className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy-700 px-4 text-sm font-semibold text-white hover:bg-navy-800">
          <FiUserPlus aria-hidden="true" /> Add admin
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Last sign-in</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(admins || []).map((a) => (
                <tr key={a.id} className={a.is_active ? "" : "opacity-60"}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{a.name || a.username}{a.is_you && <span className="ml-2 text-xs font-normal text-slate-400">You</span>}</p>
                    <p className="text-xs text-slate-500">{a.username}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">{ROLE_LABELS[a.role]}</span>
                  </td>
                  <td className="px-4 py-3">
                    {a.is_active ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Active</span>
                    ) : (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">Switched off</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {a.last_login_at ? formatDateTime(a.last_login_at) : "Never"}
                    {a.last_login_ip && <span className="block text-xs text-slate-400">{a.last_login_ip}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditing(a)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-navy-700 hover:bg-slate-50">
                      <FiEdit2 aria-hidden="true" /> Edit
                    </button>
                  </td>
                </tr>
              ))}
              {!admins && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">Loading…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        <p className="mb-1 font-semibold text-slate-900">Roles</p>
        {Object.keys(ROLE_LABELS).map((r) => (
          <p key={r}><span className="font-medium text-slate-800">{ROLE_LABELS[r]}:</span> {ROLE_HELP[r]}.</p>
        ))}
        <p className="mt-2 text-xs text-slate-500">If every owner gets locked out, run <code className="rounded bg-slate-100 px-1">node scripts/orgs.js add-admin</code> on the server.</p>
      </div>

      {editing && (
        <AdminForm
          admin={editing.id ? editing : null}
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
