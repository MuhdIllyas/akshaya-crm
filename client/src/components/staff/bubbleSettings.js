// Chat bubble settings for the signed-in person. Saved on their staff record
// (GET/PUT /api/chat/bubble-settings) so they follow them to every device.
import { useSyncExternalStore } from "react";
import { toast } from "react-toastify";
import { socket } from "@/services/socket";

const API_BASE_URL = import.meta.env.VITE_API_URL;
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

export const BUBBLE_DEFAULTS = {
  on: true,
  preview: true,
  sound: true,
  kinds: { staff: true, group: true, whatsapp: true, portal: false },
};

export const BUBBLE_KIND_LABELS = {
  staff: "Staff chats",
  group: "Groups",
  whatsapp: "WhatsApp",
  portal: "Portal customers",
};

let settings = BUBBLE_DEFAULTS;
let loadedFor = null;
const listeners = new Set();
const set = (next) => { settings = next; listeners.forEach((l) => l()); };
const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };

export const useBubbleSettings = () => useSyncExternalStore(subscribe, () => settings);

// Another tab or device changed them
socket.on("bubble_settings_updated", (s) => { if (s && typeof s === "object") set({ ...BUBBLE_DEFAULTS, ...s }); });

export const loadBubbleSettings = async () => {
  const token = localStorage.getItem("token");
  if (!token || loadedFor === token) return settings;
  loadedFor = token;
  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/bubble-settings`, { headers: auth() });
    if (res.ok) set({ ...BUBBLE_DEFAULTS, ...(await res.json()) });
  } catch {
    loadedFor = null; // try again next time
  }
  return settings;
};

export const saveBubbleSettings = async (patch) => {
  const prev = settings;
  const next = { ...settings, ...patch, kinds: { ...settings.kinds, ...(patch.kinds || {}) } };
  set(next);
  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/bubble-settings`, {
      method: "PUT",
      headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!res.ok) throw new Error();
  } catch {
    set(prev);
    toast.error("Couldn't save your bubble settings. Try again.");
  }
};

/* Open the settings panel from anywhere (sidebar, the bubble stack) */
const SETTINGS_EVENT = "chat-bubbles:settings";
export const openBubbleSettings = () => window.dispatchEvent(new Event(SETTINGS_EVENT));
export const onOpenBubbleSettings = (fn) => {
  window.addEventListener(SETTINGS_EVENT, fn);
  return () => window.removeEventListener(SETTINGS_EVENT, fn);
};
