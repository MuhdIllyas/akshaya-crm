import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "@/services/socket";

/* The work waiting for me (walk-in tokens, online bookings), for the
   "My queue" chip and the My Work badge a supervisor sees on every page.
   Refreshes every minute, when the tab comes back into view, and right
   after token / booking events. */

const API = import.meta.env.VITE_API_URL;
const TOKEN_EVENTS = ["tokenUpdate", "newToken", "tokenCancelled", "tokenReassigned", "serviceEntryCreated", "notification"];

export default function useMyQueue({ enabled = true } = {}) {
  const [queue, setQueue] = useState(null); // { tokens_waiting, online_waiting, online_mine }
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/staffperformance/my-queue`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (res.ok) setQueue(await res.json());
    } catch {
      /* keep the last numbers */
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    const interval = setInterval(load, 60000);
    const onVisible = () => document.visibilityState === "visible" && load();
    // several events can arrive together: refresh once, shortly after the last
    const soon = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(load, 800);
    };
    document.addEventListener("visibilitychange", onVisible);
    TOKEN_EVENTS.forEach((e) => socket.on(e, soon));
    return () => {
      clearInterval(interval);
      clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      TOKEN_EVENTS.forEach((e) => socket.off(e, soon));
    };
  }, [enabled, load]);

  const waiting = queue ? queue.tokens_waiting + queue.online_waiting : 0;
  return { queue, waiting, refresh: load };
}
