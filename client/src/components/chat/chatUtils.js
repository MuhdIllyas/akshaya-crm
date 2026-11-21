// Shared helpers for the Messenger UI (Chat, ConversationList, ConversationDetails)

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

/* ---------------- Folders (Messenger left column) ---------------- */

// Built-in folders. Your tags are added after these as "tag:<id>".
export const CHAT_FOLDERS = [
  { id: "all", label: "All chats" },
  { id: "unread", label: "Unread" },
  { id: "pinned", label: "Pinned" },
  { id: "customers", label: "Customers", group: "Chats" },
  { id: "staff", label: "Staff", group: "Chats" },
  { id: "services", label: "Services", group: "Chats" },
  { id: "teams", label: "Teams", group: "Chats" },
];

export const isCustomerChat = (c) =>
  c?.channel === "whatsapp" || c?.channel === "portal" || c?.context_type === "customer";

export const getFolderKind = (c) => {
  if (isCustomerChat(c)) return "customers";
  if (c?.context_type === "service_entry") return "services";
  if (c?.context_type === "team") return "teams";
  return "staff";
};

export const inFolder = (c, folder, tagIds) => {
  if (folder === "all") return true;
  if (folder === "unread") return (c.unread || 0) > 0;
  if (folder === "pinned") return !!c.pinned_at;
  if (String(folder).startsWith("tag:")) return !!tagIds?.has(String(c.id));
  return getFolderKind(c) === folder;
};

// A customer chat is waiting when the customer wrote last and nobody has replied yet.
export const isWaiting = (c) => isCustomerChat(c) && !!c.waiting_since;

// "4m", "2h 10m", "3d"
export const formatWaiting = (since, now = Date.now()) => {
  const t = new Date(since).getTime();
  if (!since || isNaN(t)) return "";
  const mins = Math.max(0, Math.floor((now - t) / 60000));
  if (mins < 60) return `${mins || 1}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return mins % 60 ? `${hours}h ${mins % 60}m` : `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

// Over 2 hours waiting shows red, otherwise amber
export const waitingIsLate = (since, now = Date.now()) => now - new Date(since).getTime() > 2 * 3600000;

// Section a chat goes under in the list
export const listSection = (c, now = new Date()) => {
  if (c.pinned_at) return "Pinned";
  const d = new Date(c.last_message_at || 0);
  if (!c.last_message_at || isNaN(d.getTime())) return "Earlier";
  if (isSameDay(d, now)) return "Today";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (isSameDay(d, y)) return "Yesterday";
  return "Earlier";
};

/* ---------------- Conversation identity ---------------- */

export const getOtherParticipants = (conv, currentUserId) =>
  (conv?.participants || []).filter(
    (p) => String(p.staff_id) !== String(currentUserId)
  );

export const isGroupConversation = (conv, currentUserId) =>
  !!conv?.is_group || getOtherParticipants(conv, currentUserId).length > 1;

// Placeholder names WhatsApp chats were created with ("WhatsApp - Customer", "WhatsApp +9190…")
const GENERIC_WHATSAPP_NAME = /^whatsapp(\s*-\s*customer|\s*-?\s*\+?[\d\s]+)?$/i;

// "+919090000000" -> "+91 90900 00000"
export const formatPhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  return phone || "";
};

// WhatsApp chat name, best first: the name staff saved, the customer this number belongs
// to, the person's own WhatsApp name, a real name the chat was created with, the number.
export const getWhatsAppName = (conv) => {
  const created = String(conv.context_name || conv.name || "").trim();
  const createdName = created && !GENERIC_WHATSAPP_NAME.test(created) ? created.replace(/^whatsapp\s*-\s*/i, "") : "";
  return (
    conv.contact_name ||
    conv.customer_name ||
    conv.wa_profile_name ||
    createdName ||
    formatPhone(conv.context_identifier) ||
    "WhatsApp user"
  );
};

export const getConversationDisplayName = (conv, currentUserId) => {
  if (!conv) return "";
  if (conv.channel === "whatsapp") return getWhatsAppName(conv);
  if (conv.name) return conv.name;
  const others = getOtherParticipants(conv, currentUserId);
  if (others.length) return others.map((p) => p.name).filter(Boolean).join(", ");
  // A chat with only yourself (e.g. tasks you gave yourself), like WhatsApp's "Message yourself"
  const self = (conv.participants || []).find((p) => String(p.staff_id) === String(currentUserId));
  if (self?.name) return `${self.name} (You)`;
  return "Unknown Chat";
};

export const getConversationPhoto = (conv, currentUserId) => {
  // customer chats: no staff photo (it would be the other staff member's)
  if (!conv || conv.channel === "whatsapp" || conv.channel === "portal") return null;
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
/* ---------------- Group members ---------------- */

// Plain internal group chats have editable members. Team, service and customer chats follow their team / work,
// WhatsApp / portal chats use "Assigned to" instead.
export const hasEditableMembers = (conv) =>
  !!conv && (conv.channel || "internal") === "internal" && !!conv.is_group && !conv.context_type;

// Group admins: the chat's owners, plus admins / superadmins who are in it.
export const isGroupAdmin = (conv, user) => {
  if (!hasEditableMembers(conv) || !user) return false;
  const me = (conv.participants || []).find((p) => String(p.staff_id) === String(user.id));
  if (!me) return false;
  return me.member_role === "owner" || user.role === "admin" || user.role === "superadmin";
};
