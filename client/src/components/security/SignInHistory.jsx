// Staff sign-in history (successful sign-ins and wrong passwords).
// Superadmins see everyone; admins see their own centre's staff.
// With `staffId` it shows one person (used on the staff profile page).

import { useEffect, useState } from "react";
import axios from "axios";
import { FiCheckCircle, FiRefreshCw, FiXCircle } from "react-icons/fi";

const API = import.meta.env.VITE_API_URL;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const formatWhen = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";

// A short browser/device name from the user agent.
const deviceName = (ua = "") => {
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
};

export default function SignInHistory({ staffId = null, limit = 50, compact = false }) {
  const [rows, setRows] = useState(null);
  const [failedOnly, setFailedOnly] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");

  const load = async (before) => {
    setError("");
    try {
      const { data } = await axios.get(`${API}/api/auth/sign-ins`, {
        headers: authHeaders(),
        params: { staff_id: staffId || undefined, failed: failedOnly ? 1 : undefined, limit, before },
      });
      setRows((prev) => (before ? [...(prev || []), ...data] : data));
      setMore(data.length === limit);
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't load the sign-in history");
      setRows((prev) => prev || []);
    }
  };

  useEffect(() => {
    setRows(null);
    load();
  }, [staffId, failedOnly]);

  return (
    <div className={compact ? "" : "rounded-2xl border border-slate-200 bg-white shadow-sm"}>
      <div className={`flex flex-wrap items-center justify-between gap-3 ${compact ? "mb-2" : "border-b border-slate-100 p-4"}`}>
        {!compact && (
          <div>
            <h2 className="text-base font-semibold text-slate-900">Sign-in history</h2>
            <p className="text-sm text-slate-500">Every staff sign-in and wrong password. Five wrong passwords lock that username for 15 minutes.</p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={failedOnly} onChange={(e) => setFailedOnly(e.target.checked)} className="h-4 w-4 accent-navy-700" />
            Wrong passwords only
          </label>
          <button onClick={() => { setRows(null); load(); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Refresh">
            <FiRefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && <p className="px-4 py-2 text-sm text-rose-700">{error}</p>}

      {!rows ? (
        <p className="p-4 text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">{failedOnly ? "No wrong passwords recorded." : "No sign-ins recorded yet."}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id} className={`flex items-center justify-between gap-3 py-2.5 text-sm ${compact ? "" : "px-4"}`}>
              <div className="flex min-w-0 items-center gap-2.5">
                {r.success ? (
                  <FiCheckCircle className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Signed in" />
                ) : (
                  <FiXCircle className="h-4 w-4 shrink-0 text-rose-600" aria-label="Wrong password" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-slate-800">
                    {!staffId && <span className="font-medium text-slate-900">{r.staff_name || r.username} </span>}
                    {!staffId && !r.staff_name && <span className="text-xs text-slate-400">(unknown username) </span>}
                    <span className={r.success ? "text-slate-600" : "font-medium text-rose-700"}>{r.success ? "signed in" : "wrong password"}</span>
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {deviceName(r.user_agent)} · {r.ip || "unknown IP"}
                    {!staffId && r.centre_name ? ` · ${r.centre_name}` : ""}
                  </p>
                </div>
              </div>
              <p className="shrink-0 text-xs text-slate-500">{formatWhen(r.created_at)}</p>
            </li>
          ))}
        </ul>
      )}

      {more && (
        <div className={`text-center ${compact ? "pt-2" : "border-t border-slate-100 p-3"}`}>
          <button onClick={() => load(rows[rows.length - 1].id)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy-700 hover:bg-slate-50">
            Show older
          </button>
        </div>
      )}
    </div>
  );
}
