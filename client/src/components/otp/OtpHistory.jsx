import React, { useEffect, useState } from "react";
import { FiRefreshCw, FiCopy, FiKey, FiTrash2 } from "react-icons/fi";
import { toast } from "react-toastify";
import { socket } from "@/services/socket";
import { copyOtp, timeAgoOtp } from "@/utils/otpAlert";

// Notifications → OTPs: OTPs from the centre's companion phone.
// Shows only live OTPs (same window as the top bar), with a link for today's
// earlier ones. OTPs are deleted by the server 24 hours after they arrive.
const formatTime = (value) =>
  new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

const OtpHistory = () => {
  const token = localStorage.getItem("token");
  const role = (localStorage.getItem("role") || "").toLowerCase();
  const canClear = role === "admin" || role === "superadmin";
  const apiBase = import.meta.env.VITE_API_URL;
  const [rows, setRows] = useState([]);
  const [liveMinutes, setLiveMinutes] = useState(10);
  const [showEarlier, setShowEarlier] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [, setTick] = useState(0);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/api/sms/otps?window=${showEarlier ? "today" : "live"}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRows(data.otps || []);
      if (data.live_minutes) setLiveMinutes(data.live_minutes);
    } catch {
      setError("Couldn't load OTPs. Try again.");
    } finally {
      setLoading(false);
    }
  }, [apiBase, token, showEarlier]);

  useEffect(() => { load(); }, [load]);

  // New OTPs appear at the top; a clear empties the list for everyone
  useEffect(() => {
    const onOtp = (otp) => setRows((prev) => [otp, ...prev.filter((r) => r.id !== otp.id)]);
    const onCleared = () => setRows([]);
    socket.on("centre_otp", onOtp);
    socket.on("centre_otps_cleared", onCleared);
    return () => {
      socket.off("centre_otp", onOtp);
      socket.off("centre_otps_cleared", onCleared);
    };
  }, []);

  // Keep "live" and "2m ago" current
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  const isLive = (r) => Date.now() - new Date(r.received_at).getTime() < liveMinutes * 60000;
  const shown = showEarlier ? rows : rows.filter(isLive);

  const clearAll = async () => {
    setClearing(true);
    try {
      const res = await fetch(`${apiBase}/api/sms/otps`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRows([]);
      toast.success(data.cleared ? `Cleared ${data.cleared} OTP${data.cleared === 1 ? "" : "s"}` : "No OTPs to clear");
    } catch {
      toast.error("Couldn't clear OTPs. Try again.");
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-4 md:px-5 py-3 border-b border-slate-200">
        <p className="min-w-0 flex-1 text-sm text-slate-600">
          {showEarlier
            ? "All OTPs received today."
            : `Live OTPs: each one shows for ${liveMinutes} minutes after it arrives.`}
          <span className="block text-xs text-slate-400">OTPs are never counted as unread and are deleted after 24 hours.</span>
        </p>
        <button
          type="button"
          onClick={load}
          className="grid h-9 w-9 place-items-center rounded-xl border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          aria-label="Refresh"
          title="Refresh"
        >
          <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
        {canClear && (
          confirmClear ? (
            <span className="flex items-center gap-1.5">
              <span className="text-xs text-slate-600">Clear for everyone in the centre?</span>
              <button
                type="button"
                onClick={clearAll}
                disabled={clearing}
                className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {clearing ? "Clearing…" : "Yes, clear"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <FiTrash2 className="h-4 w-4" /> Clear all
            </button>
          )
        )}
      </div>

      {error ? (
        <p className="px-5 py-10 text-center text-sm text-red-600">{error}</p>
      ) : !loading && shown.length === 0 ? (
        <div className="px-4 py-14 text-center">
          <FiKey className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">{showEarlier ? "No OTPs today" : "No live OTPs"}</p>
          <p className="mt-1 text-xs text-slate-500">New OTPs on the centre's companion phone show here and in the top bar.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 py-1 lg:max-h-[calc(100vh-24rem)] lg:overflow-y-auto">
          {shown.map((r) => {
            const live = isLive(r);
            return (
              <li key={r.id} className={`flex items-start gap-3 px-4 md:px-5 py-3 ${live ? "bg-amber-50" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {r.code && (
                      <span className={`font-mono text-lg font-bold tracking-widest ${live ? "text-amber-950" : "text-slate-400"}`}>{r.code}</span>
                    )}
                    {live ? (
                      <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white">Live</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Expired</span>
                    )}
                    <span className="text-sm font-medium text-slate-800">{r.sender || "Unknown sender"}</span>
                    {r.centre_name && <span className="text-xs text-slate-400">· {r.centre_name}</span>}
                  </div>
                  <p className={`mt-0.5 break-words text-sm ${live ? "text-slate-700" : "text-slate-500"}`}>{r.message}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{timeAgoOtp(r.received_at)} · {formatTime(r.received_at)}</p>
                </div>
                {r.code && (
                  <button
                    type="button"
                    onClick={() => copyOtp(r.code)}
                    className={`mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      live ? "bg-amber-500 text-white hover:bg-amber-600" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <FiCopy className="h-3.5 w-3.5" /> Copy
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-slate-100 px-4 md:px-5 py-2.5 text-center">
        <button
          type="button"
          onClick={() => setShowEarlier((v) => !v)}
          className="text-sm font-medium text-navy-700 hover:underline"
        >
          {showEarlier ? "Show live OTPs only" : "Show today's earlier OTPs"}
        </button>
      </div>
    </div>
  );
};

export default OtpHistory;
