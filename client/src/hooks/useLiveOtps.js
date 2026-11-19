import { useEffect, useState } from "react";
import { socket } from "@/services/socket";

// OTPs from the companion phone that are still fresh (default 10 minutes).
// They drop out on their own, so nothing piles up and there is no unread state.
const DEFAULT_LIVE_MINUTES = 10;

const isFresh = (otp, minutes) =>
  Date.now() - new Date(otp.received_at).getTime() < minutes * 60000;

export default function useLiveOtps({ token, apiBase, enabled = true }) {
  const [otps, setOtps] = useState([]);
  const [liveMinutes, setLiveMinutes] = useState(DEFAULT_LIVE_MINUTES);
  const [, setTick] = useState(0);

  // OTPs that arrived before this page was opened
  useEffect(() => {
    if (!enabled || !token || !apiBase) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/sms/otps/live`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.live_minutes) setLiveMinutes(data.live_minutes);
        setOtps((prev) => {
          const byId = new Map([...(data.otps || []), ...prev].map((o) => [o.id, o]));
          return [...byId.values()];
        });
      } catch { /* the top bar simply shows no OTPs */ }
    })();
    return () => { cancelled = true; };
  }, [enabled, token, apiBase]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onOtp = (otp) => {
      if (otp.live_minutes) setLiveMinutes(otp.live_minutes);
      setOtps((prev) => [otp, ...prev.filter((o) => o.id !== otp.id)]);
    };
    // An admin cleared the centre's OTPs
    const onCleared = () => setOtps([]);
    socket.on("centre_otp", onOtp);
    socket.on("centre_otps_cleared", onCleared);
    return () => {
      socket.off("centre_otp", onOtp);
      socket.off("centre_otps_cleared", onCleared);
    };
  }, [enabled]);

  // Re-check every 15s so expired OTPs leave and "2m ago" stays current
  useEffect(() => {
    if (!enabled || otps.length === 0) return undefined;
    const t = setInterval(() => {
      setTick((n) => n + 1);
      setOtps((prev) => (prev.every((o) => isFresh(o, liveMinutes)) ? prev : prev.filter((o) => isFresh(o, liveMinutes))));
    }, 15000);
    return () => clearInterval(t);
  }, [enabled, otps.length, liveMinutes]);

  const live = otps
    .filter((o) => isFresh(o, liveMinutes))
    .sort((a, b) => new Date(b.received_at) - new Date(a.received_at));

  return { otps: live, liveMinutes };
}
