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
let byName = null; // normalized name -> id, or null when two people share it
const norm = (n) => String(n || "").trim().replace(/\s+/g, " ").toLowerCase();

let staffToken = null;
export const loadStaffDirectory = () => {
  const token = localStorage.getItem("token");
  if (token !== staffToken) { staffPromise = null; byName = null; } // signed in as someone else
  if (!staffPromise) {
    staffToken = token;
    staffPromise = fetch(`${API_BASE_URL}/api/chat/staff`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        byName = new Map();
        rows.forEach((s) => {
          const k = norm(s.name);
          byName.set(k, byName.has(k) ? null : s.id);
        });
        return new Map(rows.map((s) => [String(s.id), s]));
      })
      .catch(() => { staffPromise = null; return new Map(); });
  }
  return staffPromise;
};

// For lists that only carry a staff name: the id of the one active staff member
// with that name, or null (no match, or the name is shared).
export const findIdByNameSync = (name) => (byName && name ? byName.get(norm(name)) ?? null : null);
export const findIdByName = (name) => loadStaffDirectory().then(() => findIdByNameSync(name));

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

/* ---------------- "Message about…" contexts ---------------- */
// For <StaffName context={...}> on a task row. `task` is the task record (or
// a calendar event that points at one). conversationId is the chat the task's
// card was posted in when it was created (tasks.conversation_id).
export const taskContext = (task, taskId = task?.id) => {
  if (!taskId) return null;
  const title = task?.title || `Task #${taskId}`;
  return {
    type: "task",
    id: taskId,
    title,
    label: title,
    short: "this task",
    conversationId: task?.conversation_id || null,
    // only a real task row can be shown as a card straight away
    task: task?.id === taskId && task?.status ? task : null,
  };
};

/* ---------------- my conversations ---------------- */
// Ids of the chats the signed-in user is in, so "Open task chat" only shows
// for a chat they can actually open. Cached for a minute.
let convPromise = null;
let convAt = 0;
export const loadMyConversationIds = () => {
  if (!convPromise || Date.now() - convAt > 60000) {
    convAt = Date.now();
    convPromise = fetch(`${API_BASE_URL}/api/chat/conversations`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => new Set((Array.isArray(rows) ? rows : []).map((c) => String(c.id))))
      .catch(() => { convPromise = null; return new Set(); });
  }
  return convPromise;
};

// For <StaffName context={...}> on a calendar event (a calendar_events row).
// Generated calendar items (expiry-…, delivery-…) have no card.
export const eventContext = (ev) => {
  if (!ev || !/^\d+$/.test(String(ev.id))) return null;
  const title = ev.title || "Calendar event";
  return { type: "event", id: Number(ev.id), title, label: title, short: "this event" };
};
