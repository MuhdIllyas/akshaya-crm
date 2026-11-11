// Sign-in for the platform-admin page (the software owner), separate from
// organization staff logins.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiLock, FiUser } from "react-icons/fi";
import platformApi, { errorText, setPlatformToken } from "./platformApi";

export default function PlatformLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await platformApi.post("/auth/login", form);
      setPlatformToken(data.token);
      navigate("/platform", { replace: true });
    } catch (err) {
      setError(errorText(err, "Couldn't sign in"));
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Akshaya Sahayi</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Platform admin</h1>
        <p className="mt-1 text-sm text-slate-500">Manage organizations, plans and billing.</p>

        <div className="mt-6 space-y-3">
          <label className="relative block">
            <span className="sr-only">Username</span>
            <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              className={input}
              placeholder="Username"
              autoComplete="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </label>
          <label className="relative block">
            <span className="sr-only">Password</span>
            <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              className={input}
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </label>
        </div>

        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 h-11 w-full rounded-xl bg-navy-700 font-semibold text-white transition-colors hover:bg-navy-800 disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
