// Sign-in for the platform-admin page (the software owner), separate from
// organization staff logins. Same layout as the staff/customer login
// (AuthShell), with its own illustration: a coastal lighthouse that watches
// over every centre.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiAlertTriangle, FiCheck, FiEye, FiEyeOff, FiLock, FiUser } from "react-icons/fi";
import AuthShell, { Field, Spinner, pillPrimary } from "../../components/login/AuthShell";
import LighthouseScene from "../../components/login/LighthouseScene";
import platformApi, { errorText, setPlatformToken } from "./platformApi";

const REMEMBER_KEY = "platform_remembered_username";

const POINTS = [
  "Organizations and their portals",
  "Plans, trials and subscriptions",
  "Payments and renewals",
  "Usage across every centre",
];

const readRemembered = () => {
  try {
    return localStorage.getItem(REMEMBER_KEY) || "";
  } catch {
    return "";
  }
};

export default function PlatformLogin() {
  const navigate = useNavigate();
  const remembered = readRemembered();
  const [form, setForm] = useState({ username: remembered, password: "" });
  const [remember, setRemember] = useState(Boolean(remembered));
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pointIndex, setPointIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPointIndex((i) => (i + 1) % POINTS.length), 3000);
    return () => clearInterval(t);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await platformApi.post("/auth/login", form);
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, form.username.trim());
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        /* storage blocked: nothing to remember */
      }
      setPlatformToken(data.token);
      navigate("/platform", { replace: true });
    } catch (err) {
      setError(errorText(err, "Couldn't sign in. Check your username and password."));
    } finally {
      setBusy(false);
    }
  };

  const watchCaps = (e) => setCapsLock(Boolean(e.getModifierState?.("CapsLock")));

  const brandCard = (
    <>
      <h2 className="text-lg font-bold text-white">Platform administration</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-white/80">
        One place to run every organization on Akshaya Sahayi, securely.
      </p>
      <div className="mt-4 flex min-h-[3.25rem] items-center overflow-hidden border-t border-white/15 pt-3">
        <p key={pointIndex} className="animate-fade-slide flex items-center gap-2 text-sm font-semibold leading-snug text-white">
          <FiCheck className="h-4 w-4 shrink-0 text-teal-300" aria-hidden="true" />
          {POINTS[pointIndex]}
        </p>
      </div>
    </>
  );

  return (
    <AuthShell brandCard={brandCard} scene={LighthouseScene}>
      <form className="my-auto w-full max-w-sm py-8 md:mx-auto xl:max-w-md" onSubmit={submit}>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Platform Admin Login</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
          Control Panel<span className="text-teal-500">.</span>
        </h1>
        <p className="mt-2 text-sm text-slate-500">Restricted to platform administrators. Every sign-in is recorded.</p>

        <div className="mt-7 space-y-3">
          <Field
            id="platform-username"
            label="Username"
            icon={FiUser}
            type="text"
            autoComplete="username"
            placeholder="Enter your username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            disabled={busy}
            autoFocus={!remembered}
          />
          <Field
            id="platform-password"
            label="Password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            onKeyUp={watchCaps}
            onKeyDown={watchCaps}
            disabled={busy}
            autoFocus={Boolean(remembered)}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={busy}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="shrink-0 text-slate-400 transition-colors hover:text-teal-600"
              >
                {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
              </button>
            }
          />

          {capsLock && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
              <FiAlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Caps Lock is on
            </p>
          )}

          <label className="flex cursor-pointer items-center pt-1 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-teal-600"
              disabled={busy}
            />
            <span className="ml-2 select-none font-medium">Remember my username</span>
          </label>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </p>
        )}

        <div className="mt-7 flex">
          <button type="submit" disabled={busy || !form.username.trim() || !form.password} className={`${pillPrimary} flex items-center justify-center`}>
            {busy ? (
              <>
                <Spinner /> Signing in…
              </>
            ) : (
              <>
                <FiLock className="mr-2 h-4 w-4" aria-hidden="true" /> Sign in securely
              </>
            )}
          </button>
        </div>

        <p className="mt-6 text-xs text-slate-400">Authorised access only. Forgotten your password? Reset it on the server.</p>
      </form>
    </AuthShell>
  );
}
