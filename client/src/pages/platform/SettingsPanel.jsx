// Control panel → Settings: your own account. Change password, and your
// recent sign-in attempts (so you'd notice anyone else using the account).

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FiCheckCircle, FiShield, FiXCircle } from "react-icons/fi";
import platformApi, { errorText, formatDateTime, ROLE_LABELS } from "./platformApi";

const input = "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30";
const label = "mb-1.5 block text-sm font-medium text-slate-700";

// A short browser/device name from the user agent.
const device = (ua = "") => {
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
};

export default function SettingsPanel({ me }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [logins, setLogins] = useState(null);

  useEffect(() => {
    platformApi.get("/account/logins").then(({ data }) => setLogins(data)).catch(() => setLogins([]));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const change = async (e) => {
    e.preventDefault();
    if (form.next !== form.confirm) return toast.error("The new passwords don't match");
    setBusy(true);
    try {
      await platformApi.put("/account/password", { current: form.current, next: form.next });
      toast.success("Password changed");
      setForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      toast.error(errorText(err, "Couldn't change the password"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Your account</h2>
        {me && (
          <p className="mt-1 text-sm text-slate-600">
            {me.name || me.username} · <span className="text-slate-500">{me.username}</span> ·{" "}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{ROLE_LABELS[me.role]}</span>
          </p>
        )}

        <form onSubmit={change} className="mt-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Change password</h3>
          <div>
            <label className={label} htmlFor="pw-current">Current password</label>
            <input id="pw-current" type="password" className={input} value={form.current} onChange={set("current")} autoComplete="current-password" required />
          </div>
          <div>
            <label className={label} htmlFor="pw-next">New password</label>
            <input id="pw-next" type="password" minLength={10} className={input} value={form.next} onChange={set("next")} autoComplete="new-password" required />
            <p className="mt-1 text-xs text-slate-500">At least 10 characters.</p>
          </div>
          <div>
            <label className={label} htmlFor="pw-confirm">Repeat the new password</label>
            <input id="pw-confirm" type="password" minLength={10} className={input} value={form.confirm} onChange={set("confirm")} autoComplete="new-password" required />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={busy} className="rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60">
              {busy ? "Saving…" : "Change password"}
            </button>
          </div>
        </form>

        <div className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <FiShield className="mt-0.5 shrink-0 text-navy-700" aria-hidden="true" />
          <p>Two-step sign-in with an authenticator app is coming in a later update.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Recent sign-ins</h2>
        <p className="mt-1 text-xs text-slate-500">If you see one you don't recognise, change your password straight away.</p>
        {!logins ? (
          <p className="mt-4 text-sm text-slate-500">Loading…</p>
        ) : logins.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No sign-ins recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {logins.map((l, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="flex min-w-0 items-center gap-2.5">
                  {l.success ? (
                    <FiCheckCircle className="shrink-0 text-emerald-600" aria-label="Signed in" />
                  ) : (
                    <FiXCircle className="shrink-0 text-rose-600" aria-label="Wrong password" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-slate-800">{l.success ? "Signed in" : "Wrong password"} · {device(l.user_agent)}</p>
                    <p className="text-xs text-slate-500">{l.ip || "unknown IP"}</p>
                  </div>
                </div>
                <p className="shrink-0 text-xs text-slate-500">{formatDateTime(l.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
