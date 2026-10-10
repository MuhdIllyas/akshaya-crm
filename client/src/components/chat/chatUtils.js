// Shared helpers for the Messenger UI (Chat, ConversationList, ConversationDetails)
import { FiUsers, FiSmartphone, FiBriefcase, FiUser } from "react-icons/fi";

export const API_BASE_URL = import.meta.env.VITE_API_URL;

export const getAvatarUrl = (photoPath) => {
  if (!photoPath) return null;
  if (photoPath.startsWith("http")) return photoPath;
  const safeBase = (API_BASE_URL || "").replace(/\/$/, "");
  const safePath = photoPath.startsWith("/") ? photoPath : `/${photoPath}`;
  return `${safeBase}${safePath}`;
};

const AVATAR_COLORS = [
  "bg-navy-700",
  "bg-blue-600",
  "bg-sky-600",
  "bg-teal-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-rose-500",
  "bg-amber-500",
];

export const getAvatarColor = (id) =>
  AVATAR_COLORS[Math.abs(parseInt(id, 10) || 0) % AVATAR_COLORS.length];

export const initials = (name = "") =>
  String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

/* ---------------- Conversation categories (tabs) ---------------- */

export const CHAT_TABS = [
  { id: "all", label: "All" },
  { id: "internal", label: "Internal", icon: FiUsers },
  { id: "whatsapp", label: "WhatsApp", icon: FiSmartphone },
  { id: "service", label: "Service", icon: FiBriefcase },
  { id: "customer", label: "Customer", icon: FiUser },
];

// Shown even when empty; "Customer" only appears once it has chats
export const ALWAYS_VISIBLE_TABS = ["all", "internal", "whatsapp", "service"];

export const getConversationCategory = (c) => {
  if (c?.channel === "whatsapp") return "whatsapp";
  if (c?.context_type === "service_entry") return "service";
  if (c?.context_type === "customer") return "customer";
  return "internal";
};

/* ---------------- Conversation identity ---------------- */

export const getOtherParticipants = (conv, currentUserId) =>
  (conv?.participants || []).filter(
    (p) => String(p.staff_id) !== String(currentUserId)
  );

export const isGroupConversation = (conv, currentUserId) =>
  !!conv?.is_group || getOtherParticipants(conv, currentUserId).length > 1;

export const getConversationDisplayName = (conv, currentUserId) => {
  if (!conv) return "";
  if (conv.channel === "whatsapp") {
    return conv.context_name || conv.context_identifier || "WhatsApp User";
  }
  if (conv.name) return conv.name;
  const others = getOtherParticipants(conv, currentUserId);
  if (others.length) return others.map((p) => p.name).filter(Boolean).join(", ");
  return "Unknown Chat";
};

export const getConversationPhoto = (conv, currentUserId) => {
  if (!conv || conv.channel === "whatsapp") return null;
  if (isGroupConversation(conv, currentUserId)) return null;
  const others = getOtherParticipants(conv, currentUserId);
  return others.length === 1 ? getAvatarUrl(others[0]?.photo) : null;
};

/* ---------------- Dates ---------------- */

export const toDate = (value) => {
  if (!value) return new Date();
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date() : d;
};

export const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

// "10:42", "Yesterday", "Mon", "03 Oct", "03 Oct 2025"
export const formatListTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  if (isSameDay(d, now)) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, yesterday)) return "Yesterday";
  if ((now - d) / 86400000 < 7) {
    return d.toLocaleDateString("en-IN", { weekday: "short" });
  }
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
};

// Day separator label inside a chat: "Today", "Yesterday", "Monday, 6 October"
export const formatDayLabel = (d) => {
  const now = new Date();
  if (isSameDay(d, now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
};

export const formatShortDate = (value) => {
  if (!value) return "N/A";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

/* ---------------- Group sender names ---------------- */

const SENDER_NAME_COLORS = [
  "text-rose-600",
  "text-emerald-600",
  "text-sky-600",
  "text-amber-600",
  "text-violet-600",
  "text-teal-600",
  "text-pink-600",
  "text-indigo-600",
];

export const getSenderNameColor = (id) => {
  const str = String(id ?? "");
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return SENDER_NAME_COLORS[Math.abs(hash) % SENDER_NAME_COLORS.length];
};