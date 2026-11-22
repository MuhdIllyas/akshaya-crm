// Pop-up settings for OTPs and UPI payments, per staff member on this computer.
// (The top-bar OTP pill and UPI chip always show everything; these only decide
// what pops up and whether it chimes.) My Profile → Alerts changes them.
import { useSyncExternalStore } from "react";

export const ALERT_DEFAULTS = {
  otpPopup: true, // latest OTP pops up for 8 s (one at a time)
  upiNeedsLink: true, // pop-up when a UPI payment still has no entry after 2 min
  sound: true, // soft chime for OTPs and unlinked UPI payments
  everyUpi: false, // old behaviour: a pop-up for every UPI payment
};

// Settings belong to the signed-in person, so two staff sharing a counter PC keep their own
const userKey = () => {
  try {
    const token = localStorage.getItem("token") || "";
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return `alert-settings:${payload.role || "user"}:${payload.id ?? "me"}`;
  } catch {
    return "alert-settings:me";
  }
};

const read = () => {
  try {
    return { ...ALERT_DEFAULTS, ...JSON.parse(localStorage.getItem(userKey()) || "{}") };
  } catch {
    return { ...ALERT_DEFAULTS };
  }
};

let cache = null;
let cacheKey = null;
const listeners = new Set();

export const getAlertSettings = () => {
  const key = userKey();
  if (!cache || cacheKey !== key) {
    cache = read();
    cacheKey = key;
  }
  return cache;
};

export const saveAlertSettings = (patch) => {
  const next = { ...getAlertSettings(), ...patch };
  try { localStorage.setItem(userKey(), JSON.stringify(next)); } catch { /* private mode */ }
  cache = next;
  listeners.forEach((l) => l());
};

const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };
export const useAlertSettings = () => useSyncExternalStore(subscribe, getAlertSettings);

// Another tab changed them
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key && e.key.startsWith("alert-settings:")) { cache = null; listeners.forEach((l) => l()); }
  });
}
