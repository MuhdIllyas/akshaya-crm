/* Day vs evening home for supervisors.
   Before the centre's evening time (Admin → Settings → Supervisor, 6 PM if
   not set) a supervisor's home opens on My Work; from it, on the centre
   accounts dashboard. Only the FIRST home visit of a login (and again once
   the evening starts) is redirected: after that "Dashboard" always shows
   the accounts dashboard. */

import { todayIST } from "./dates";

const API = import.meta.env.VITE_API_URL;
export const DEFAULT_CLOSE_TIME = "18:00";
let closeTimePromise = null;

export function fetchCloseTime() {
  if (!closeTimePromise) {
    closeTimePromise = fetch(`${API}/api/org-settings/supervisor-close-time`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d && /^\d\d:\d\d$/.test(d.close_time) ? d.close_time : DEFAULT_CLOSE_TIME))
      .catch(() => DEFAULT_CLOSE_TIME);
    // ask again in 10 minutes, in case the admin changed it
    setTimeout(() => { closeTimePromise = null; }, 10 * 60 * 1000);
  }
  return closeTimePromise;
}

// Is it evening-close time now (India time)?
export function isEvening(closeTime, now = new Date()) {
  const hhmm = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
  return hhmm >= (closeTime || DEFAULT_CLOSE_TIME);
}

export function to12h(hhmm) {
  const [h, m] = String(hhmm || DEFAULT_CLOSE_TIME).split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

// One key per login (the token's issue time), day and phase
function homeKey(phase) {
  let iat = "";
  try {
    iat = JSON.parse(atob(localStorage.getItem("token").split(".")[1])).iat || "";
  } catch {
    /* no token */
  }
  return `${iat}:${todayIST()}:${phase}`;
}

/* Should this visit to the supervisor home go to My Work instead?
   True only for the first home visit of this login during the day. */
export function shouldOpenMyWork(closeTime) {
  const phase = isEvening(closeTime) ? "evening" : "day";
  const key = homeKey(phase);
  let seen = null;
  try { seen = sessionStorage.getItem("sv-home"); } catch { /* storage blocked */ }
  if (seen === key) return false;
  try { sessionStorage.setItem("sv-home", key); } catch { /* storage blocked */ }
  return phase === "day";
}
