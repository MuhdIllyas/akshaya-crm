// Shared state behind <StaffName>: who is online, a cached staff list for the
// staff card, and a tiny event bus that opens the floating chat window.
import { useSyncExternalStore } from "react";
import { socket } from "@/services/socket";

const API_BASE_URL = import.meta.env.VITE_API_URL;

/* ---------------- presence ---------------- */
let online = new Set();
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const setOnline = (next) => { online = next; emit(); };

// Listeners are attached at import time so the one-off "online_users" event
// sent right after the socket connects is never missed.
socket.on("online_users", (ids = []) => setOnline(new Set(ids.map(String))));
socket.on("user_online", ({ userId }) => setOnline(new Set(online).add(String(userId))));
socket.on("user_offline", ({ userId }) => {
  const next = new Set(online);
  next.delete(String(userId));
  setOnline(next);
});

const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };
export const useIsOnline = (staffId) =>
  useSyncExternalStore(subscribe, () => staffId != null && online.has(String(staffId)));

/* ---------------- staff directory ---------------- */
let staffPromise = null;
export const loadStaffDirectory = () => {
  if (!staffPromise) {
    const token = localStorage.getItem("token");
    staffPromise = fetch(`${API_BASE_URL}/api/chat/staff`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => new Map(rows.map((s) => [String(s.id), s])))
      .catch(() => { staffPromise = null; return new Map(); });
  }
  return staffPromise;
};

export const currentUserId = () => localStorage.getItem("id");

/* ---------------- open chat ---------------- */
const OPEN_EVENT = "staff-chat:open";
// staff: { id, name, photo }, context: optional { label } e.g. "TR-104 · Income certificate"
export const openStaffChat = (staff, context = null) =>
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { staff, context } }));
export const onOpenStaffChat = (handler) => {
  const fn = (e) => handler(e.detail);
  window.addEventListener(OPEN_EVENT, fn);
  return () => window.removeEventListener(OPEN_EVENT, fn);
};

export const messengerPath = () => {
  const role = localStorage.getItem("role")?.trim()?.toLowerCase();
  if (role === "superadmin") return "/dashboard/superadmin/messenger";
  if (role === "admin") return "/dashboard/admin/messenger";
  return "/dashboard/staff/messenger";
};
