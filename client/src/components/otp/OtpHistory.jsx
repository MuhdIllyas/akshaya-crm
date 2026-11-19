import React, { useEffect, useMemo, useState } from "react";
import { FiSearch, FiRefreshCw, FiCopy, FiKey } from "react-icons/fi";
import { socket } from "@/services/socket";
import { copyOtp, timeAgoOtp } from "@/utils/otpAlert";

// Notifications → OTPs: SMS forwarded by the centre's companion phone.
// Live OTPs are on top; expired ones stay here for lookup. No unread state.
const formatTime = (value) =>
  new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const OtpHistory = () => {
  const token = localStorage.getItem("token");
  const apiBase = import.meta.env.VITE_API_URL;
  const [rows, setRows] = useState([]);
  const [liveMinutes, setLiveMinutes] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [type, setType] = useState("otp");
  const [days, setDays] = useState(7);
  const [query, setQuery] = useState("");
  const [, setTick] = useState(0);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ type, days: String(days) });
      const res = await fetch(`${apiBase}/api/sms/history?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRows(data.messages || []);
      if (data.live_minutes) setLiveMinutes(data.live_minutes);
    } catch {
      setError("Couldn't load OTPs. Try again.");
    } finally {
      setLoading(false);
    }
  }, [apiBase, token, type, days]);

  useEffect(() => { load(); }, [load]);

  // New OTPs appear at the top while the page is open
  useEffect(() => {
    const onOtp = (otp) => setRows((prev) => [{ ...otp, is_otp: true }, ...prev.filter((r) => r.id !== otp.id)]);
    socket.on("centre_otp", onOtp);
    return () => socket.off("centre_otp", onOtp);
  }, []);

  // Keep "live" and "2m ago" current
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  const isLive = (r) => r.is_otp && Date.now() - new Date(r.received_at).getTime() < liveMinutes * 60000;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => !q || `${r.sender} ${r.message} ${r.code || ""}`.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-4 md:px-5 py-3 border-b border-slate-200">
        <div className="relative min-w-[180px] flex-1">
          <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sender, message or code"
            aria-label="Search OTPs"
            className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label="Message type"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-navy-500"
        >
          <option value="otp">OTPs only</option>
          <option value="all">All SMS</option>
        </select>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          aria-label="Time range"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-navy-500"
        >
          <option value={1}>Today</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
        <button
          type="button"
          onClick={load}
          className="grid h-9 w-9 place-items-center rounded-xl border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          aria-label="Refresh"
          title="Refresh"
        >
          <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <p className="px-4 md:px-5 pt-3 text-xs text-slate-500">
        OTPs show in the top bar for {liveMinutes} minutes after they arrive. They are never counted as unread.
      </p>

      {error ? (
        <p className="px-5 py-10 text-center text-sm text-red-600">{error}</p>
      ) : !loading && shown.length === 0 ? (
        <div className="px-4 py-14 text-center">
          <FiKey className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">No OTPs in this period</p>
          <p className="mt-1 text-xs text-slate-500">OTPs received on the centre's companion phone appear here.</p>
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
                    ) : r.is_otp ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Expired</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">SMS</span>
                    )}
                    <span className="text-sm font-medium text-slate-800">{r.sender || "Unknown sender"}</span>
                    {r.centre_name && <span className="text-xs text-slate-400">· {r.centre_name}</span>}
                  </div>
                  <p className={`mt-0.5 break-words text-sm ${live ? "text-slate-700" : "text-slate-500"}`}>{r.message}</p>
                  <p className="mt-0.5 text-xs text-slate-400" title={formatTime(r.received_at)}>
                    {timeAgoOtp(r.received_at)} · {formatTime(r.received_at)}
                  </p>
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
    </div>
  );
};

export default OtpHistory;
