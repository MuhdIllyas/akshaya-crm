import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiX, FiMinus, FiMaximize2, FiSend, FiLink } from "react-icons/fi";
import { toast } from "react-toastify";
import { socket } from "@/services/socket";
import ChatAvatar from "@/components/chat/ChatAvatar";
import TrackingMentionCard from "@/components/chat/TrackingMentionCard";
import { LiveTaskCard, TaskReplyChip } from "@/components/chat/TaskCards";
import { onOpenStaffChat, useIsOnline, currentUserId, messengerPath } from "./staffDirectory";

const API_BASE_URL = import.meta.env.VITE_API_URL;
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const parseMentions = (m) => {
  if (Array.isArray(m)) return m;
  if (typeof m === "string") { try { return JSON.parse(m); } catch { return []; } }
  return [];
};

const toMsg = (m) => ({
  id: m.id,
  text: m.text ?? m.message ?? "",
  type: m.type ?? m.message_type ?? "text",
  mine: String(m.sender_id) === String(currentUserId()),
  at: m.created_at,
  mentions: parseMentions(m.mentions),
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
  if (context?.type === "tracking" && context.id) {
    const tag = `@${context.id}`;
    return {
      body: `${tag} ${text}`,
      mentions: [{ mention_type: "tracking", entity_id: Number(context.id), display_text: tag, start_index: 0, end_index: tag.length }],
    };
  }
  return { body: text, mentions: [] };
};

const MessageText = ({ text, mentions, mine }) => {
  const cards = (mentions || [])
    .filter((m) => m.mention_type === "tracking" || m.mention_type === "task")
    .sort((a, b) => a.start_index - b.start_index);
  if (!cards.length) return <p className="whitespace-pre-wrap break-words">{text}</p>;
  const parts = [];
  let last = 0;
  cards.forEach((m, i) => {
    if (m.start_index > last) parts.push(text.slice(last, m.start_index));
    parts.push(
      m.mention_type === "task"
        ? <TaskReplyChip key={`t-${i}`} text={m.display_text} isOwn={mine} />
        : <TrackingMentionCard key={`t-${i}`} entityId={m.entity_id} displayText={m.display_text} />
    );
    last = m.end_index;
  });
  if (last < text.length) parts.push(text.slice(last).replace(/^\s+/, ""));
  return <div className="whitespace-pre-wrap break-words">{parts}</div>;
};

/**
 * Floating chat window for a 1:1 chat with a staff member. Mounted once in the
 * dashboard layout; opened from anywhere with openStaffChat().
 */
const StaffChatDock = () => {
  const navigate = useNavigate();
  const [staff, setStaff] = useState(null);
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [draft, setDraft] = useState("");
  const [context, setContext] = useState(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const readIds = useRef(new Set());
  const online = useIsOnline(staff?.id);

  const close = useCallback(() => {
    if (conv) socket.emit("leave_conversation", conv.id);
    setStaff(null); setConv(null); setMessages([]); setDraft(""); setContext(null);
  }, [conv]);

  // Open (or switch to) a chat
  useEffect(() => onOpenStaffChat(async ({ staff: s, context: ctx }) => {
    setStaff(s); setMinimized(false); setContext(ctx); setMessages([]); setConv(null);
    readIds.current = new Set();
    setDraft(ctx?.label ? "Can you check this one?" : "");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/conversation`, {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ participants: [Number(s.id)] }),
      });
      if (!res.ok) throw new Error();
      const c = await res.json();
      setConv(c);
      const mRes = await fetch(`${API_BASE_URL}/api/chat/messages/${c.id}`, { headers: auth() });
      const rows = mRes.ok ? await mRes.json() : [];
      // Already-read messages shouldn't be sent to /read again.
      rows.forEach((m) => { if (m.is_read_by_me) readIds.current.add(m.id); });
      setMessages(rows.filter((m) => !m.is_deleted).map(toMsg));
    } catch {
      toast.error(`Couldn't open a chat with ${s.name}`);
      setStaff(null);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }), []);

  // Live messages for the open conversation
  useEffect(() => {
    if (!conv) return;
    socket.emit("join_conversation", conv.id);
    const onNew = (m) => {
      if (String(m.conversation_id) !== String(conv.id)) return;
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, toMsg(m)]));
    };
    socket.on("new_message", onNew);
    return () => { socket.off("new_message", onNew); socket.emit("leave_conversation", conv.id); };
  }, [conv]);

  // Whatever the window shows (open, not minimized) counts as read, so the
  // Messenger unread badge doesn't keep counting it.
  useEffect(() => {
    if (!conv || minimized || loading) return;
    const unread = messages.filter((m) => !m.mine && !readIds.current.has(m.id)).map((m) => m.id);
    if (!unread.length) return;
    unread.forEach((id) => readIds.current.add(id));
    fetch(`${API_BASE_URL}/api/chat/read`, {
      method: "POST",
      headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ message_ids: unread }),
    }).catch(() => unread.forEach((id) => readIds.current.delete(id)));
  }, [messages, minimized, conv, loading]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, minimized]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !conv || sending) return;
    setSending(true);
    try {
      let ctx = context;
      // A task whose card isn't in this chat yet: post the card once (a normal
      // task message, like task creation does), then send the text on its own.
      if (ctx?.type === "task" && !messages.some((m) => isTaskMsg(m, ctx.id))) {
        const tf = new FormData();
        tf.append("conversation_id", conv.id);
        tf.append("message", String(ctx.id));
        tf.append("message_type", "task");
        const tr = await fetch(`${API_BASE_URL}/api/chat/message`, { method: "POST", headers: auth(), body: tf });
        if (!tr.ok) throw new Error();
        const savedTask = await tr.json();
        setMessages((prev) => (prev.some((x) => x.id === savedTask.id) ? prev : [...prev, toMsg({ ...savedTask, sender_id: currentUserId(), live_task_data: ctx.task || null })]));
        ctx = null;
      }
      const { body, mentions } = buildContextMessage(ctx, text);
      const fd = new FormData();
      fd.append("conversation_id", conv.id);
      fd.append("message", body);
      fd.append("message_type", "text");
      if (mentions.length) fd.append("mentions", JSON.stringify(mentions));
      const res = await fetch(`${API_BASE_URL}/api/chat/message`, { method: "POST", headers: auth(), body: fd });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      setMessages((prev) => (prev.some((x) => x.id === saved.id) ? prev : [...prev, toMsg({ mentions, ...saved, sender_id: currentUserId() })]));
      setDraft(""); setContext(null);
    } catch {
      toast.error("Message not sent. Try again.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  if (!staff) return null;

  return (
    <div className="fixed bottom-0 right-4 z-[900] w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-t-xl border border-slate-200 bg-white shadow-2xl">
      <div
        className="flex cursor-pointer items-center gap-2.5 bg-navy-700 px-3 py-2.5 text-white"
        onClick={() => setMinimized((m) => !m)}
      >
        <ChatAvatar name={staff.name} photo={staff.photo} size="sm" online={online} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{staff.name}</p>
          <p className="text-[11px] text-navy-100">{online ? "Online" : "Offline"}</p>
        </div>
        <button type="button" title="Open in Messenger" aria-label="Open in Messenger"
          onClick={(e) => { e.stopPropagation(); if (conv) navigate(messengerPath(), { state: { openConversationId: conv.id } }); close(); }}
          className="rounded p-1.5 hover:bg-white/10"><FiMaximize2 className="h-4 w-4" /></button>
        <button type="button" title={minimized ? "Expand" : "Minimize"} aria-label={minimized ? "Expand" : "Minimize"}
          onClick={(e) => { e.stopPropagation(); setMinimized((m) => !m); }}
          className="rounded p-1.5 hover:bg-white/10"><FiMinus className="h-4 w-4" /></button>
        <button type="button" title="Close" aria-label="Close"
          onClick={(e) => { e.stopPropagation(); close(); }}
          className="rounded p-1.5 hover:bg-white/10"><FiX className="h-4 w-4" /></button>
      </div>

      {!minimized && (
        <>
          <div ref={listRef} className="h-80 space-y-1.5 overflow-y-auto bg-slate-50 px-3 py-3">
            {loading ? (
              <p className="pt-24 text-center text-sm text-slate-400">Opening chat…</p>
            ) : messages.length === 0 ? (
              <p className="pt-24 text-center text-sm text-slate-400">Say hello to {staff.name.split(" ")[0]}</p>
            ) : (
              messages.map((m) => m.type === "task" ? (
                // Task cards sit outside a bubble, like in the Messenger
                <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                  {m.task ? <LiveTaskCard task={m.task} /> : <p className="text-xs text-slate-400">Task #{m.text}</p>}
                </div>
              ) : (
                <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm leading-snug ${m.mine ? "rounded-br-md bg-navy-700 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-800"}`}>
                    {m.type === "text" ? <MessageText text={m.text} mentions={m.mentions} mine={m.mine} /> : <p>[{m.type}]</p>}
                    <p className={`mt-0.5 text-right text-[10px] ${m.mine ? "text-navy-200" : "text-slate-400"}`}>{timeOf(m.at)}</p>
                  </div>
                </div>
              ))
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
                  : `Service card attached: ${context.label}`}
              </span>
              <button type="button" onClick={() => setContext(null)} aria-label="Remove attachment" className="text-navy-500 hover:text-navy-800"><FiX className="h-3.5 w-3.5" /></button>
            </div>
          )}

          <form className="flex items-center gap-2 p-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message"
              disabled={loading || !conv}
              className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-navy-400 focus:ring-2 focus:ring-navy-100"
            />
            <button type="submit" disabled={!draft.trim() || sending || !conv} aria-label="Send"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-700 text-white hover:bg-navy-800 disabled:opacity-40">
              <FiSend className="h-4 w-4" />
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default StaffChatDock;
