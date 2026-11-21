import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiX, FiMinus, FiMaximize2, FiSend, FiLink, FiSettings, FiMessageCircle, FiPaperclip } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";
import { toast } from "react-toastify";
import { socket } from "@/services/socket";
import ChatAvatar from "@/components/chat/ChatAvatar";
import TrackingMentionCard from "@/components/chat/TrackingMentionCard";
import { LiveTaskCard, TaskReplyChip } from "@/components/chat/TaskCards";
import EventMentionCard from "@/components/chat/EventMentionCard";
import NoteMentionCard from "@/components/chat/NoteMentionCard";
import {
  getConversationDisplayName, getConversationPhoto, getOtherParticipants, isGroupConversation,
  isCustomerChat, getAvatarColor, getAvatarUrl,
} from "@/components/chat/chatUtils";
import { onOpenStaffChat, useIsOnline, currentUserId, messengerPath } from "./staffDirectory";
import {
  useBubbleSettings, loadBubbleSettings, saveBubbleSettings, onOpenBubbleSettings, openBubbleSettings,
  BUBBLE_KIND_LABELS,
} from "./bubbleSettings";

const API_BASE_URL = import.meta.env.VITE_API_URL;
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const MAX_BUBBLES = 4;
const PREVIEW_MS = 6000;

const parseMentions = (m) => {
  if (Array.isArray(m)) return m;
  if (typeof m === "string") { try { return JSON.parse(m); } catch { return []; } }
  return [];
};

const toMsg = (m) => ({
  id: m.id,
  text: m.text ?? m.message ?? "",
  type: m.type ?? m.message_type ?? "text",
  senderType: m.sender_type || "staff",
  senderName: m.sender_name || null,
  // a customer's id can match a staff id, so only staff messages can be "mine"
  mine: (m.sender_type || "staff") === "staff" && String(m.sender_id) === String(currentUserId()),
  at: m.created_at,
  mentions: parseMentions(m.mentions),
  fileUrl: m.file_url || null,
  fileName: m.file_name || null,
  // task messages carry the task id as their text; the server adds the live row
  task: m.live_task_data || m.data || null,
});

const isTaskMsg = (m, taskId) => m.type === "task" && String(m.task?.id ?? m.text) === String(taskId);

const timeOf = (d) =>
  d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";

/**
 * What the chat is "about", sent the same way the Messenger does it, so every
 * participant sees a live card instead of plain text:
 *  - service: `@<tracking id>` tracking mention → service card
 *  - task already in this chat: a "task" mention → small reply chip above the text
 *    (a task whose card isn't here yet gets the card posted first, see send())
 * Calendar events, notes, leads etc. will add their own mention_type here and in Chat.jsx.
 */
const buildContextMessage = (context, text) => {
  if (context?.type === "task" && context.id) {
    const tag = `Task: ${context.title || context.label || `#${context.id}`}`;
    return {
      body: `${tag}\n${text}`,
      mentions: [{ mention_type: "task", entity_id: Number(context.id), display_text: tag, start_index: 0, end_index: tag.length }],
    };
  }
  if (context?.type === "note" && context.id) {
    const tag = `📝 ${context.title || context.label || "Note"}`;
    return {
      body: `${tag}\n${text}`,
      mentions: [{ mention_type: "note", entity_id: Number(context.id), display_text: tag, start_index: 0, end_index: tag.length }],
    };
  }
  if (context?.type === "event" && context.id) {
    // The tag stays readable in previews and notifications; chats show the card in its place.
    const tag = `📅 ${context.title || context.label || "Calendar event"}`;
    return {
      body: `${tag}\n${text}`,
      mentions: [{ mention_type: "event", entity_id: Number(context.id), display_text: tag, start_index: 0, end_index: tag.length }],
    };
  }
  if (context?.type === "tracking" && context.id) {
    const tag = `@${context.id}`;
    return {
      body: `${tag} ${text}`,
      mentions: [{ mention_type: "tracking", entity_id: Number(context.id), display_text: tag, start_index: 0, end_index: tag.length }],
    };
  }
  return { body: text, mentions: [] };
};

// Service, calendar event and note cards sit outside the bubble at a fixed
// width (like task cards); the bubble keeps the text and the task reply tag.
const BLOCK_CARD_TYPES = ["tracking", "event", "note"];
const blockCardsOf = (mentions) =>
  (mentions || []).filter((m) => BLOCK_CARD_TYPES.includes(m.mention_type)).sort((a, b) => a.start_index - b.start_index);

const BlockCard = ({ m, bare }) =>
  m.mention_type === "event" ? <EventMentionCard entityId={m.entity_id} displayText={m.display_text} bare={bare} />
  : m.mention_type === "note" ? <NoteMentionCard entityId={m.entity_id} displayText={m.display_text} bare={bare} />
  : <TrackingMentionCard entityId={m.entity_id} displayText={m.display_text} bare={bare} />;

// The message text with block cards removed and task mentions shown as tags.
const MessageText = ({ text, mentions, mine }) => {
  const marks = (mentions || [])
    .filter((m) => m.mention_type === "task" || BLOCK_CARD_TYPES.includes(m.mention_type))
    .sort((a, b) => a.start_index - b.start_index);
  if (!marks.length) return <p className="whitespace-pre-wrap break-words">{text}</p>;
  const parts = [];
  let last = 0;
  let afterCard = false;
  const pushText = (t) => { parts.push(afterCard ? t.replace(/^\s+/, "") : t); afterCard = false; };
  marks.forEach((m, i) => {
    if (m.start_index > last) pushText(text.slice(last, m.start_index));
    if (m.mention_type === "task") parts.push(<TaskReplyChip key={`t-${i}`} text={m.display_text} isOwn={mine} />);
    else afterCard = true; // drawn outside the bubble
    last = m.end_index;
  });
  if (last < text.length) pushText(text.slice(last));
  return <div className="whitespace-pre-wrap break-words">{parts}</div>;
};

const textWithoutCards = (text = "", mentions) => {
  let out = "";
  let last = 0;
  blockCardsOf(mentions).forEach((m) => { out += text.slice(last, m.start_index); last = m.end_index; });
  return out + text.slice(last);
};

/* ---------------- bubbles: helpers ---------------- */

// Which "Show bubbles for" setting a chat falls under
const bubbleKind = (c) => {
  if (!c) return "staff";
  if (c.channel === "whatsapp") return "whatsapp";
  if (isCustomerChat(c)) return "portal";
  if (c.context_type || isGroupConversation(c, currentUserId())) return "group";
  return "staff";
};

// A new message the signed-in person should be told about
const shouldNotify = (d) => {
  if (d?.notify) return true;
  if (d?.lastMessageSenderType === "customer") return true;
  return d?.lastMessageSenderType === "staff" && String(d.lastMessageSenderId) !== String(currentUserId());
};

// Two short notes, quiet enough for a counter. Browsers only play sound after
// the person has clicked somewhere on the page, which staff always have.
let audioCtx = null;
const playDing = () => {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      o.connect(g);
      g.connect(audioCtx.destination);
      const at = t + i * 0.12;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.1, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
      o.start(at);
      o.stop(at + 0.3);
    });
  } catch { /* no sound is fine */ }
};

const cleanPreview = (text = "") =>
  String(text).replace(/^(Task: [^\n]*|📝 [^\n]*|📅 [^\n]*)\n/, "").trim() || "New message";

// A 1:1 staff chat is named after the other person (some carry a stored "A & B" name)
const chatName = (c, me) => {
  if (bubbleKind(c) === "staff") {
    const others = getOtherParticipants(c, me);
    if (others.length === 1 && others[0].name) return others[0].name;
  }
  return getConversationDisplayName(c, me);
};

// Where the bubbles sit: a side and a distance from the top. Starts at the top
// right, under the page header, so a new message is seen. Kept per browser.
const POS_DEFAULT = { side: "right", y: 76 };
const posKey = () => `chat_bubbles_pos_${currentUserId()}`;
const readPos = () => {
  try {
    const p = JSON.parse(localStorage.getItem(posKey()));
    if (p && (p.side === "left" || p.side === "right") && Number.isFinite(p.y)) return p;
  } catch { /* use the default */ }
  return POS_DEFAULT;
};

const storageKey = () => `chat_bubbles_${currentUserId()}`;
const readStoredBubbles = () => {
  try { return JSON.parse(sessionStorage.getItem(storageKey())) || []; } catch { return []; }
};

/* ---------------- the chat window ---------------- */

const OnlineDot = ({ staffId, children }) => children(useIsOnline(staffId));

const ChatWindow = ({ bubble, conv, context, setContext, onClose, onMinimize, onExpand, canMinimize, style }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(context?.label ? "Can you check this one?" : "");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const readIds = useRef(new Set());
  const convId = bubble.id;
  const me = currentUserId();

  const name = conv ? chatName(conv, me) : bubble.name;
  const photo = conv ? getConversationPhoto(conv, me) : bubble.photo;
  const kind = conv ? bubbleKind(conv) : "staff";
  const isGroup = kind === "group";
  const customer = kind === "whatsapp" || kind === "portal";
  const others = conv ? getOtherParticipants(conv, me) : [];
  const directStaffId = kind === "staff" ? (others[0]?.staff_id ?? bubble.staffId) : null;
  const subtitle = customer
    ? kind === "whatsapp" ? "WhatsApp" : "Portal customer"
    : isGroup ? `${(conv?.participants || []).length || ""} members`.trim() : null;

  // Load the messages
  useEffect(() => {
    let off = false;
    readIds.current = new Set();
    setLoading(true);
    fetch(`${API_BASE_URL}/api/chat/messages/${convId}`, { headers: auth() })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        if (off) return;
        rows.forEach((m) => { if (m.is_read_by_me) readIds.current.add(m.id); });
        setMessages((Array.isArray(rows) ? rows : []).filter((m) => !m.is_deleted).map(toMsg));
      })
      .catch(() => { if (!off) toast.error(`Couldn't load the chat with ${name}`); })
      .finally(() => {
        if (off) return;
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      });
    return () => { off = true; };
  }, [convId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live messages
  useEffect(() => {
    socket.emit("join_conversation", convId);
    const onNew = (m) => {
      if (String(m.conversation_id) !== String(convId)) return;
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, toMsg(m)]));
    };
    const onDeleted = (d) => {
      const id = d?.messageId ?? d?.id;
      if (id != null) setMessages((prev) => prev.filter((x) => String(x.id) !== String(id)));
    };
    socket.on("new_message", onNew);
    socket.on("message_deleted", onDeleted);
    return () => {
      socket.off("new_message", onNew);
      socket.off("message_deleted", onDeleted);
      socket.emit("leave_conversation", convId);
    };
  }, [convId]);

  // What the window shows counts as read, so the Messenger badge stops counting it.
  useEffect(() => {
    if (loading) return;
    const unread = messages.filter((m) => !m.mine && !readIds.current.has(m.id)).map((m) => m.id).filter(Boolean);
    if (!unread.length) return;
    unread.forEach((id) => readIds.current.add(id));
    fetch(`${API_BASE_URL}/api/chat/read`, {
      method: "POST",
      headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ message_ids: unread }),
    }).catch(() => unread.forEach((id) => readIds.current.delete(id)));
  }, [messages, loading]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      let ctx = context;
      // A task whose card isn't in this chat yet: post the card once (a normal
      // task message, like task creation does), then send the text on its own.
      if (ctx?.type === "task" && !messages.some((m) => isTaskMsg(m, ctx.id))) {
        const tf = new FormData();
        tf.append("conversation_id", convId);
        tf.append("message", String(ctx.id));
        tf.append("message_type", "task");
        const tr = await fetch(`${API_BASE_URL}/api/chat/message`, { method: "POST", headers: auth(), body: tf });
        if (!tr.ok) throw new Error();
        const savedTask = await tr.json();
        setMessages((prev) => (prev.some((x) => x.id === savedTask.id) ? prev : [...prev, toMsg({ ...savedTask, sender_id: me, sender_type: "staff", live_task_data: ctx.task || null })]));
        ctx = null;
      }
      const { body, mentions } = buildContextMessage(ctx, text);
      const fd = new FormData();
      fd.append("conversation_id", convId);
      fd.append("message", body);
      fd.append("message_type", "text");
      if (mentions.length) fd.append("mentions", JSON.stringify(mentions));
      const res = await fetch(`${API_BASE_URL}/api/chat/message`, { method: "POST", headers: auth(), body: fd });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      setMessages((prev) => (prev.some((x) => x.id === saved.id) ? prev : [...prev, toMsg({ mentions, ...saved, sender_id: me, sender_type: "staff" })]));
      setDraft(""); setContext(null);
    } catch {
      toast.error(customer ? "Message not sent. Open the chat in Messenger to send it." : "Message not sent. Try again.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // Opened again from a staff name with something attached
  useEffect(() => { if (context?.label) setDraft((d) => d || "Can you check this one?"); }, [context]);

  const showNames = isGroup || customer;
  const firstName = String(name || "").split(" ")[0];

  return (
    <section
      aria-label={`Chat with ${name}`}
      className="fixed z-[900] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      style={style}
    >
      <div className="flex items-center gap-2.5 border-b border-slate-200 px-3 py-2.5">
        {directStaffId ? (
          <OnlineDot staffId={directStaffId}>
            {(online) => (
              <>
                <ChatAvatar name={name} photo={photo} size="sm" online={online} color={getAvatarColor(directStaffId)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                  <p className={`text-[11px] ${online ? "text-emerald-600" : "text-slate-400"}`}>{online ? "Online" : "Offline"}</p>
                </div>
              </>
            )}
          </OnlineDot>
        ) : (
          <>
            <ChatAvatar name={name} photo={photo} size="sm" isGroup={isGroup} color={kind === "whatsapp" ? "bg-emerald-600" : getAvatarColor(convId)} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
              {subtitle && <p className="truncate text-[11px] text-slate-500">{subtitle}</p>}
            </div>
          </>
        )}
        <button type="button" title="Open in Messenger" aria-label="Open in Messenger" onClick={onExpand}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><FiMaximize2 className="h-4 w-4" /></button>
        {canMinimize && (
          <button type="button" title="Minimize" aria-label="Minimize" onClick={onMinimize}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><FiMinus className="h-4 w-4" /></button>
        )}
        <button type="button" title="Close" aria-label="Close" onClick={onClose}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><FiX className="h-4 w-4" /></button>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-slate-50 px-3 py-3">
        {loading ? (
          <p className="pt-24 text-center text-sm text-slate-400">Opening chat…</p>
        ) : messages.length === 0 ? (
          <p className="pt-24 text-center text-sm text-slate-400">Say hello to {firstName}</p>
        ) : (
          messages.map((m) => {
            if (m.type === "task") {
              // Task cards sit outside a bubble, like in the Messenger
              return (
                <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                  {m.task ? <LiveTaskCard task={m.task} /> : <p className="text-xs text-slate-400">This task was deleted</p>}
                </div>
              );
            }
            if (m.senderType === "system" || m.type === "system") {
              return (
                <div key={m.id} className="flex justify-center">
                  <p className="max-w-[90%] whitespace-pre-wrap rounded-lg bg-slate-200/70 px-2.5 py-1 text-center text-[11px] leading-snug text-slate-600">{m.text}</p>
                </div>
              );
            }
            const cards = m.type === "text" ? blockCardsOf(m.mentions) : [];
            const label = !m.mine && showNames && m.senderType === "staff" ? m.senderName : null;
            return (
              <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"} ${cards.length ? "py-1.5" : ""}`}>
                {cards.length > 0 ? (
                  // One block: card(s) on top, the text joined below
                  <div className={`w-72 max-w-full overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 ${m.mine ? "rounded-br-md" : "rounded-bl-md"}`}>
                    {label && <p className="px-3 pt-1.5 text-[11px] font-semibold text-navy-600">{label}</p>}
                    {cards.map((c, i) => (
                      <div key={`c-${i}`} className={i > 0 ? "border-t border-slate-100" : ""}><BlockCard m={c} bare /></div>
                    ))}
                    {!textWithoutCards(m.text, m.mentions).trim() ? (
                      <p className="border-t border-slate-100 px-3 py-1 text-right text-[10px] text-slate-400">{timeOf(m.at)}</p>
                    ) : (
                      <div className={`px-3 py-1.5 text-sm leading-snug ${m.mine ? "bg-navy-700 text-white" : "border-t border-slate-100 text-slate-800"}`}>
                        <MessageText text={m.text} mentions={m.mentions} mine={m.mine} />
                        <p className={`mt-0.5 text-right text-[10px] ${m.mine ? "text-navy-200" : "text-slate-400"}`}>{timeOf(m.at)}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm leading-snug ${m.mine ? "rounded-br-md bg-navy-700 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-800"}`}>
                    {label && <p className="mb-0.5 text-[11px] font-semibold text-navy-600">{label}</p>}
                    {m.type === "text" ? (
                      <MessageText text={m.text} mentions={m.mentions} mine={m.mine} />
                    ) : m.type === "image" && m.fileUrl ? (
                      <a href={getAvatarUrl(m.fileUrl)} target="_blank" rel="noreferrer">
                        <img src={getAvatarUrl(m.fileUrl)} alt={m.fileName || "Photo"} className="max-h-48 rounded-lg" />
                      </a>
                    ) : m.fileUrl ? (
                      <a href={getAvatarUrl(m.fileUrl)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 underline">
                        <FiPaperclip className="h-3.5 w-3.5 shrink-0" />{m.fileName || "Attachment"}
                      </a>
                    ) : (
                      <p className="italic opacity-80">{m.text || "Attachment"}</p>
                    )}
                    {m.type !== "text" && m.text && m.fileUrl && <p className="mt-1 whitespace-pre-wrap break-words">{m.text}</p>}
                    <p className={`mt-0.5 text-right text-[10px] ${m.mine ? "text-navy-200" : "text-slate-400"}`}>{timeOf(m.at)}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {context?.label && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-lg bg-navy-50 px-2.5 py-1.5 text-xs text-navy-700">
          <FiLink className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {context.type === "task"
              ? messages.some((m) => isTaskMsg(m, context.id))
                ? `Replying about task: ${context.label}`
                : `Task card attached: ${context.label}`
              : context.type === "event"
              ? `Event card attached: ${context.label}`
              : context.type === "note"
              ? context.visibility === "private"
                ? `Note card attached: ${context.label} (private, so ${firstName} will see it locked)`
                : `Note card attached: ${context.label}`
              : `Service card attached: ${context.label}`}
          </span>
          <button type="button" onClick={() => setContext(null)} aria-label="Remove attachment" className="text-navy-500 hover:text-navy-800"><FiX className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <form className="flex items-center gap-2 border-t border-slate-200 p-2.5" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${firstName}`}
          disabled={loading}
          className="h-9 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-navy-400 focus:ring-2 focus:ring-navy-100"
        />
        <button type="submit" disabled={!draft.trim() || sending} aria-label="Send"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-700 text-white hover:bg-navy-800 disabled:opacity-40">
          <FiSend className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
};

/* ---------------- settings panel ---------------- */

const Switch = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative h-[21px] w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-emerald-600" : "bg-slate-300"}`}
  >
    <span className={`absolute top-[2.5px] h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[17.5px]" : "left-[2.5px]"}`} />
  </button>
);

const BubbleSettingsPanel = ({ onClose, style }) => {
  const s = useBubbleSettings();
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  return (
    <div ref={ref} role="dialog" aria-label="Chat bubble settings"
      className="fixed z-[950] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl" style={style}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900">Chat bubbles</h3>
          <p className="mt-0.5 text-xs text-slate-500">Only for you. Saved to your account, so it follows you to any device.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close settings" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><FiX className="h-4 w-4" /></button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 py-2.5">
        <div className="text-sm text-slate-800">Show chat bubbles<span className="block text-[11.5px] text-slate-400">New messages pop up over any page</span></div>
        <Switch checked={s.on} label="Show chat bubbles" onChange={(v) => saveBubbleSettings({ on: v })} />
      </div>

      <div className={s.on ? "" : "pointer-events-none opacity-45"}>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 py-2.5">
          <div className="text-sm text-slate-800">Show message text<span className="block text-[11.5px] text-slate-400">Turn off to show only who wrote</span></div>
          <Switch checked={s.preview} label="Show message text" onChange={(v) => saveBubbleSettings({ preview: v })} />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 py-2.5">
          <div className="text-sm text-slate-800">Sound</div>
          <Switch checked={s.sound} label="Sound" onChange={(v) => saveBubbleSettings({ sound: v })} />
        </div>
        <div className="border-t border-slate-100 pt-2.5">
          <p className="text-xs text-slate-500">Show bubbles for</p>
          <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
            {Object.entries(BUBBLE_KIND_LABELS).map(([k, label]) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 py-0.5 text-[13px] text-slate-700">
                <input type="checkbox" checked={!!s.kinds?.[k]} onChange={(e) => saveBubbleSettings({ kinds: { [k]: e.target.checked } })}
                  className="h-4 w-4 rounded border-slate-300 text-navy-700 focus:ring-navy-200" />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-slate-400">WhatsApp and portal chats show only when you're in that chat (assigned or added).</p>
        </div>
      </div>
    </div>
  );
};

/* ---------------- bubbles ---------------- */

/**
 * Chat bubbles: new messages pop up as round bubbles at the bottom right of
 * every dashboard page (except the Messenger, which already shows them), with a
 * short preview and a sound. A bubble opens a small chat window. Clicking a
 * staff name (openStaffChat) opens that person's chat the same way.
 * Mounted once in the dashboard layout.
 */
const StaffChatDock = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useBubbleSettings();
  const onMessenger = /\/messenger(\/|$)/.test(location.pathname);

  // bubble: { id, name, photo, staffId, manual } — manual = opened by the person themself
  const [bubbles, setBubbles] = useState(readStoredBubbles);
  const [convs, setConvs] = useState({});
  const [unread, setUnread] = useState({});
  const [openId, setOpenId] = useState(null);
  const [context, setContext] = useState(null);
  const [preview, setPreview] = useState(null);
  const [anim, setAnim] = useState(null); // { id, kind: "pop" | "wiggle", at }
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pos, setPos] = useState(readPos);
  const [drag, setDrag] = useState(null); // { x, y } while being dragged
  const [view, setView] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const stackRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    const onResize = () => setView({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const convsRef = useRef({});
  const convsAt = useRef(0);
  const state = useRef({});
  state.current = { settings, onMessenger, openId, bubbles };
  const previewTimer = useRef(null);

  useEffect(() => { loadBubbleSettings(); }, []);
  useEffect(() => onOpenBubbleSettings(() => setSettingsOpen(true)), []);

  useEffect(() => {
    try { sessionStorage.setItem(storageKey(), JSON.stringify(bubbles.slice(0, 12))); } catch { /* private mode */ }
  }, [bubbles]);

  // My chats (names, kinds, unread), refreshed when a chat we don't know shows up
  const loadConvs = useCallback(async (force = false) => {
    if (!force && Date.now() - convsAt.current < 30000) return convsRef.current;
    convsAt.current = Date.now();
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/conversations`, { headers: auth() });
      const rows = res.ok ? await res.json() : [];
      const map = {};
      const counts = {};
      (Array.isArray(rows) ? rows : []).forEach((c) => {
        map[String(c.id)] = c;
        counts[String(c.id)] = Number(c.unread) || 0;
      });
      convsRef.current = map;
      setConvs(map);
      setUnread((prev) => ({ ...prev, ...counts }));
    } catch { /* keep what we have */ }
    return convsRef.current;
  }, []);

  useEffect(() => { loadConvs(true); }, [loadConvs]);

  const hidePreview = useCallback(() => { clearTimeout(previewTimer.current); setPreview(null); }, []);

  // A new message somewhere
  useEffect(() => {
    const onUpdated = async (d) => {
      if (d?.conversationId == null) return;
      const id = String(d.conversationId);
      if (typeof d.unread === "number") setUnread((prev) => ({ ...prev, [id]: d.unread }));
      if (!shouldNotify(d)) return;
      const { settings: s, onMessenger: inMessenger, openId: open } = state.current;
      if (inMessenger || !s.on || open === id) return;

      let conv = convsRef.current[id];
      if (!conv) conv = (await loadConvs(true))[id];
      if (!conv || !s.kinds?.[bubbleKind(conv)]) return;

      const isNew = !state.current.bubbles.some((b) => b.id === id);
      setBubbles((prev) => {
        const existing = prev.find((b) => b.id === id);
        return [existing || { id }, ...prev.filter((b) => b.id !== id)];
      });
      setAnim({ id, kind: isNew ? "pop" : "wiggle", at: Date.now() });
      if (s.sound) playDing();

      const who = d.lastMessageSenderType === "customer" || d.lastMessageSenderType === "system" ? null : d.lastMessageSender;
      clearTimeout(previewTimer.current);
      setPreview({ id, sender: who, text: s.preview ? cleanPreview(d.lastMessage) : "New message" });
      previewTimer.current = setTimeout(() => setPreview(null), PREVIEW_MS);

      // The tab is in the background: a system notification, if the person allowed them
      if (document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          const title = chatName(conv, currentUserId());
          new Notification(title, { body: s.preview ? cleanPreview(d.lastMessage) : "New message", tag: `chat-${id}` });
        } catch { /* not allowed here */ }
      }
    };
    const onUnread = (d) => {
      if (d?.conversationId == null) return;
      setUnread((prev) => ({ ...prev, [String(d.conversationId)]: Number(d.unread) || 0 }));
    };
    socket.on("conversation_updated", onUpdated);
    socket.on("unread_update", onUnread);
    return () => {
      socket.off("conversation_updated", onUpdated);
      socket.off("unread_update", onUnread);
    };
  }, [loadConvs]);

  // Leaving bubbles on Messenger: the preview would only repeat what's on screen
  useEffect(() => { if (onMessenger) hidePreview(); }, [onMessenger, hidePreview]);

  // Clicking a staff name: open (or start) the chat with them
  useEffect(() => onOpenStaffChat(async ({ staff: s, context: ctx }) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/conversation`, {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ participants: [Number(s.id)] }),
      });
      if (!res.ok) throw new Error();
      const c = await res.json();
      const id = String(c.id);
      const b = { id, name: s.name, photo: s.photo ? getAvatarUrl(s.photo) : null, staffId: s.id, manual: true };
      setBubbles((prev) => [{ ...(prev.find((x) => x.id === id) || {}), ...b }, ...prev.filter((x) => x.id !== id)]);
      setContext(ctx || null);
      setOpenId(id);
      setUnread((prev) => ({ ...prev, [id]: 0 }));
      hidePreview();
      if (!convsRef.current[id]) loadConvs(true);
    } catch {
      toast.error(`Couldn't open a chat with ${s.name}`);
    }
  }), [loadConvs, hidePreview]);

  const openBubble = (id) => {
    if (openId === id) { setOpenId(null); return; }
    setContext(null);
    setOpenId(id);
    setUnread((prev) => ({ ...prev, [id]: 0 }));
    // Opened from the "+N" pile: bring it to the front
    setBubbles((prev) => {
      const i = prev.findIndex((b) => b.id === id);
      return i >= MAX_BUBBLES ? [prev[i], ...prev.filter((b) => b.id !== id)] : prev;
    });
    hidePreview();
  };

  const closeBubble = (id) => {
    setBubbles((prev) => prev.filter((b) => b.id !== id));
    if (openId === id) { setOpenId(null); setContext(null); }
    if (preview?.id === id) hidePreview();
  };

  const markRead = async (id) => {
    hidePreview();
    setUnread((prev) => ({ ...prev, [id]: 0 }));
    try {
      const r = await fetch(`${API_BASE_URL}/api/chat/messages/${id}`, { headers: auth() });
      const rows = r.ok ? await r.json() : [];
      const ids = rows.filter((m) => !m.is_read_by_me && !m.is_deleted).map((m) => m.id);
      if (ids.length) {
        await fetch(`${API_BASE_URL}/api/chat/read`, {
          method: "POST",
          headers: { ...auth(), "Content-Type": "application/json" },
          body: JSON.stringify({ message_ids: ids }),
        });
      }
    } catch { /* the badge will catch up */ }
  };

  const expand = (id) => {
    setOpenId(null); setContext(null);
    navigate(messengerPath(), { state: { openConversationId: Number(id) } });
  };

  const totalUnread = Object.values(unread).reduce((a, n) => a + (Number(n) || 0), 0);

  // Bubbles of kinds the person switched off go away (ones they opened themselves stay)
  const visible = bubbles.filter((b) => b.manual || b.id === openId || settings.kinds?.[bubbleKind(convs[b.id])] !== false);
  const shown = visible.slice(0, MAX_BUBBLES);
  const pile = visible.slice(MAX_BUBBLES);
  const pileUnread = pile.reduce((a, b) => a + (unread[b.id] || 0), 0);
  const showStack = !onMessenger && settings.on && visible.length > 0;
  const showOffIcon = !onMessenger && !settings.on && totalUnread > 0;
  const openBubbleObj = openId ? bubbles.find((b) => b.id === openId) : null;

  const bubbleFace = (b) => {
    const c = convs[b.id];
    const me = currentUserId();
    const name = c ? chatName(c, me) : b.name || "Chat";
    const photo = c ? getConversationPhoto(c, me) : b.photo;
    const kind = c ? bubbleKind(c) : "staff";
    return { name, photo, kind, color: kind === "whatsapp" ? "bg-emerald-600" : getAvatarColor(kind === "staff" ? (getOtherParticipants(c, me)[0]?.staff_id ?? b.staffId) : b.id) };
  };

  /* ----- where things go ----- */
  const narrow = view.w < 640;
  const edge = narrow ? 12 : 16;
  const onLeft = pos.side === "left";
  const hasStack = showStack || showOffIcon;
  const beside = hasStack ? (narrow ? 72 : 84) : edge; // panels open next to the bubbles
  const stackH = showStack ? shown.length * 58 + (pile.length ? 54 : 0) + 32 : 48;
  const stackTop = Math.max(8, Math.min(pos.y, view.h - stackH - 8));
  const besideStyle = (width) => (narrow
    ? { left: onLeft ? beside : 8, right: onLeft ? 8 : beside }
    : { [onLeft ? "left" : "right"]: beside, width });
  const topFor = (h) => Math.max(16, Math.min(stackTop, view.h - h - 16));
  const winH = Math.min(480, view.h - 32);
  const stackStyle = drag
    ? { left: drag.x, top: drag.y, cursor: "grabbing", touchAction: "none" }
    : { top: stackTop, [onLeft ? "left" : "right"]: edge, cursor: "grab", touchAction: "none" };

  /* ----- dragging the bubbles ----- */
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    const r = stackRef.current?.getBoundingClientRect();
    if (!r) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, w: r.width, h: r.height, moved: false, id: e.pointerId };
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 6) return; // a click, not a drag
      d.moved = true;
      try { stackRef.current.setPointerCapture(d.id); } catch { /* fine */ }
      hidePreview();
    }
    setDrag({ x: Math.max(0, Math.min(d.ox + dx, view.w - d.w)), y: Math.max(0, Math.min(d.oy + dy, view.h - d.h)) });
  };
  const onPointerUp = (e) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d?.moved) return;
    const x = d.ox + (e.clientX - d.sx);
    const y = d.oy + (e.clientY - d.sy);
    // Snap to the nearer side
    const next = { side: x + d.w / 2 < view.w / 2 ? "left" : "right", y: Math.round(Math.max(8, Math.min(y, view.h - d.h - 8))) };
    setPos(next);
    setDrag(null);
    try { localStorage.setItem(posKey(), JSON.stringify(next)); } catch { /* private mode */ }
    suppressClick.current = true; // the click that ends a drag doesn't open a chat
    setTimeout(() => { suppressClick.current = false; }, 0);
  };
  const onPointerCancel = () => { dragRef.current = null; setDrag(null); };
  const dragProps = {
    ref: stackRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onDragStart: (e) => e.preventDefault(),
    onClickCapture: (e) => { if (suppressClick.current) { e.stopPropagation(); e.preventDefault(); } },
  };

  const previewIndex = preview ? shown.findIndex((b) => b.id === preview.id) : -1;
  const previewFace = preview ? bubbleFace(bubbles.find((b) => b.id === preview.id) || { id: preview.id }) : null;

  return (
    <>
      <style>{`
        @keyframes bubble-pop{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
        @keyframes bubble-wiggle{20%{transform:rotate(-10deg)}40%{transform:rotate(9deg)}60%{transform:rotate(-6deg)}80%{transform:rotate(3deg)}}
        @keyframes bubble-slide{from{transform:translateX(12px);opacity:0}to{transform:none;opacity:1}}
        @keyframes bubble-slide-l{from{transform:translateX(-12px);opacity:0}to{transform:none;opacity:1}}
        @media (prefers-reduced-motion:reduce){.bubble-anim{animation:none!important}}
      `}</style>

      {showStack && (
        <div {...dragProps} style={stackStyle}
          className="group/stack fixed z-[901] flex select-none flex-col items-center gap-2.5 [&_img]:pointer-events-none" aria-label="Chat bubbles">
          {shown.map((b) => {
            const f = bubbleFace(b);
            const n = unread[b.id] || 0;
            const a = anim?.id === b.id ? anim : null;
            return (
              <div key={b.id} className="group/b relative">
                <button
                  key={a ? a.at : "still"}
                  type="button"
                  onClick={() => openBubble(b.id)}
                  aria-label={`${f.name}${n ? `, ${n} unread` : ""}`}
                  className={`bubble-anim relative block rounded-full shadow-lg ring-2 transition-transform hover:scale-105 ${openId === b.id ? "ring-navy-500" : "ring-white"}`}
                  style={a ? { animation: a.kind === "pop" ? "bubble-pop .35s ease-out" : "bubble-wiggle .5s" } : undefined}
                >
                  <ChatAvatar name={f.name} photo={f.photo} size="lg" isGroup={f.kind === "group"} color={f.color} />
                  {n > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[11px] font-semibold text-white">
                      {n > 99 ? "99+" : n}
                    </span>
                  )}
                  {f.kind === "whatsapp" && (
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white">
                      <FaWhatsapp className="h-3 w-3" />
                    </span>
                  )}
                </button>
                <button type="button" onClick={() => closeBubble(b.id)} aria-label={`Close ${f.name} bubble`}
                  className="absolute -left-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-white shadow group-hover/b:flex group-focus-within/b:flex">
                  <FiX className="h-3 w-3" />
                </button>
                <span className={`pointer-events-none absolute ${onLeft ? "left-[60px]" : "right-[60px]"} top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white ${drag ? "" : "group-hover/b:block"}`}>
                  {f.name}<span className="ml-1.5 text-slate-400">· drag to move</span>
                </span>
              </div>
            );
          })}
          {pile.length > 0 && (
            <button type="button" onClick={() => openBubble(pile[0].id)}
              title={pile.map((b) => bubbleFace(b).name).join(", ")}
              aria-label={`${pile.length} more chats`}
              className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-600 shadow-lg hover:bg-slate-50">
              +{pile.length}
              {pileUnread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[11px] font-semibold text-white">{pileUnread}</span>
              )}
            </button>
          )}
          <button type="button" onClick={openBubbleSettings} title="Chat bubble settings" aria-label="Chat bubble settings"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 opacity-0 shadow transition-opacity hover:text-slate-900 focus:opacity-100 group-hover/stack:opacity-100 max-sm:opacity-100">
            <FiSettings className="h-4 w-4" />
          </button>
        </div>
      )}

      {showOffIcon && (
        <div {...dragProps} style={stackStyle} className="fixed z-[901] select-none">
        <button type="button" onClick={() => navigate(messengerPath())}
          title="Chat bubbles are off. Open Messenger" aria-label={`Open Messenger, ${totalUnread} unread`}
          className="relative flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-lg hover:bg-slate-50">
          <FiMessageCircle className="h-5 w-5" />
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[11px] font-semibold text-white">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        </button>
        </div>
      )}

      {preview && showStack && !drag && previewIndex >= 0 && openId !== preview.id && (
        <div role="status"
          className="bubble-anim fixed z-[902] rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-2xl"
          style={{ top: Math.min(stackTop + previewIndex * 58, view.h - 150), ...besideStyle(280), animation: `${onLeft ? "bubble-slide-l" : "bubble-slide"} .25s ease-out` }}>
          <div className="flex items-center gap-2 text-[13px]">
            <span className="min-w-0 truncate font-semibold text-slate-900">
              {previewFace.name}
              {preview.sender && previewFace.kind !== "staff" && <span className="font-normal text-slate-500"> · {preview.sender}</span>}
            </span>
            <span className="shrink-0 text-[11px] text-slate-400">now</span>
            <button type="button" onClick={hidePreview} aria-label="Dismiss" className="ml-auto rounded p-0.5 text-slate-400 hover:text-slate-700"><FiX className="h-3.5 w-3.5" /></button>
          </div>
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-[13px] leading-snug text-slate-600">{preview.text}</p>
          <div className="mt-2 flex gap-1.5">
            <button type="button" onClick={() => openBubble(preview.id)} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Reply</button>
            <button type="button" onClick={() => markRead(preview.id)} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Mark read</button>
          </div>
        </div>
      )}

      {openBubbleObj && (
        <ChatWindow
          key={openBubbleObj.id}
          bubble={openBubbleObj}
          conv={convs[openBubbleObj.id]}
          context={context}
          setContext={setContext}
          style={{ top: topFor(winH), height: winH, ...besideStyle(340) }}
          canMinimize={showStack}
          onMinimize={() => { setOpenId(null); setContext(null); }}
          onClose={() => closeBubble(openBubbleObj.id)}
          onExpand={() => expand(openBubbleObj.id)}
        />
      )}

      {settingsOpen && <BubbleSettingsPanel onClose={() => setSettingsOpen(false)} style={{ top: topFor(440), ...besideStyle(310) }} />}
    </>
  );
};

// Sidebar entry: shows whether bubbles are on and opens their settings
export const ChatBubblesButton = ({ collapsed = false }) => {
  const s = useBubbleSettings();
  useEffect(() => { loadBubbleSettings(); }, []);
  const label = `Chat bubbles: ${s.on ? "on" : "off"}`;
  return (
    <button
      type="button"
      onClick={openBubbleSettings}
      title={collapsed ? label : "Chat bubble settings"}
      aria-label={label}
      className={`flex w-full items-center rounded-xl text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900 ${collapsed ? "justify-center p-3" : "px-3 py-2.5"}`}
    >
      <FiMessageCircle className={collapsed ? "h-6 w-6" : "h-5 w-5"} aria-hidden="true" />
      {!collapsed && (
        <>
          <span className="ml-3 font-medium">Chat bubbles</span>
          <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.on ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            {s.on ? "On" : "Off"}
          </span>
        </>
      )}
    </button>
  );
};

export default StaffChatDock;
