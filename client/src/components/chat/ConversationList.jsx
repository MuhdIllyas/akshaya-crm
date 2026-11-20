import React, { useState, useEffect, useMemo, useRef } from "react";
import { FiGlobe, FiSearch, FiPlus, FiX, FiMessageSquare, FiSmartphone, FiBriefcase, FiUsers, FiChevronDown } from "react-icons/fi";
import { BsPinAngleFill } from "react-icons/bs";
import ChatAvatar from "./ChatAvatar";
import ChatFolders from "./ChatFolders";
import { TagBadges } from "@/components/tags/TagModals";
import {
  CHAT_FOLDERS,
  inFolder,
  isWaiting,
  formatWaiting,
  waitingIsLate,
  listSection,
  getConversationDisplayName,
  getConversationPhoto,
  getOtherParticipants,
  isGroupConversation,
  getAvatarColor,
  formatListTime,
} from "./chatUtils";

const SECTIONS = ["Pinned", "Today", "Yesterday", "Earlier"];

const ConversationList = ({
  conversations = [],
  activeConversationId,
  currentUser,
  onlineUsers = new Set(),
  typingUsers = {},
  onSelect,
  onNewChat,
  folder = "all",
  onFolderChange,
  tags = [],
  tagsByConversation = new Map(),
  onManageTags,
  foldersInColumn = false,
}) => {
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // "waiting 12m" badges tick once a minute
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenuOpen(false);
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const activeTag = String(folder).startsWith("tag:")
    ? tags.find((t) => `tag:${t.id}` === folder) || null
    : null;
  const tagIds = useMemo(() => new Set((activeTag?.conversation_ids || []).map(String)), [activeTag]);
  const folderLabel = activeTag?.name || CHAT_FOLDERS.find((f) => f.id === folder)?.label || "All chats";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (!inFolder(c, folder, tagIds)) return false;
      if (!q) return true;
      const name = getConversationDisplayName(c, currentUser.id).toLowerCase();
      const last = (c.last_message || c.lastMessage || "").toLowerCase();
      const phone = String(c.context_identifier || "").toLowerCase();
      return name.includes(q) || last.includes(q) || phone.includes(q);
    });
  }, [conversations, folder, tagIds, search, currentUser.id]);

  // Pinned first (in pin order), then by day
  const sections = useMemo(() => {
    const today = new Date(now);
    const groups = {};
    filtered.forEach((c) => {
      const s = listSection(c, today);
      (groups[s] = groups[s] || []).push(c);
    });
    if (groups.Pinned) groups.Pinned.sort((a, b) => new Date(a.pinned_at) - new Date(b.pinned_at));
    return SECTIONS.filter((s) => groups[s]?.length).map((s) => ({ label: s, rows: groups[s] }));
  }, [filtered, now]);

  const unreadInFolder = filtered.reduce((n, c) => n + (c.unread || 0), 0);

  const getPreview = (c) => {
    const text = c.last_message || c.lastMessage || "";
    if (!text) return "No messages yet";
    if (!isNaN(text) && text.trim() !== "") return "📋 Task";
    const senderId = c.last_message_sender_id;
    // a customer's id can equal a staff id, so check who sent it
    if (senderId && c.last_message_sender_type !== "customer" && String(senderId) === String(currentUser.id)) return `You: ${text}`;
    if (isGroupConversation(c, currentUser.id) && c.last_message_sender) {
      return `${String(c.last_message_sender).split(" ")[0]}: ${text}`;
    }
    return text;
  };

  const renderRow = (c) => {
    const name = getConversationDisplayName(c, currentUser.id);
    const isGroup = isGroupConversation(c, currentUser.id);
    const isWhatsApp = c.channel === "whatsapp";
    const isPortal = c.channel === "portal";
    const isService = c.context_type === "service_entry";
    const isTeam = c.context_type === "team";
    const others = getOtherParticipants(c, currentUser.id);
    const isOnline =
      !isGroup && !isWhatsApp && !isPortal && !isTeam && others[0] ? onlineUsers.has(String(others[0].staff_id)) : undefined;
    const typing = typingUsers[c.id] || [];
    const active = String(activeConversationId) === String(c.id);
    const hasUnread = (c.unread || 0) > 0;
    const waiting = isWaiting(c);
    const late = waiting && waitingIsLate(c.waiting_since, now);
    const rowTags = tagsByConversation.get(String(c.id)) || [];

    return (
      <button
        key={c.id}
        type="button"
        onClick={() => onSelect(c)}
        className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left transition ${
          active ? "bg-blue-50" : "hover:bg-slate-50"
        }`}
      >
        <ChatAvatar
          name={name}
          photo={getConversationPhoto(c, currentUser.id)}
          size="lg"
          color={isWhatsApp ? "bg-emerald-600" : isPortal ? "bg-sky-600" : isTeam ? "bg-navy-700" : c.avatarColor || getAvatarColor(c.id)}
          isGroup={isGroup && !isTeam}
          icon={isWhatsApp ? FiSmartphone : isPortal ? FiGlobe : isTeam ? FiUsers : undefined}
          online={isOnline === true ? true : undefined}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`truncate text-[14px] ${hasUnread ? "font-semibold text-slate-900" : "font-medium text-slate-800"}`}>
              {name}
            </span>
            {isWhatsApp && <FiSmartphone className="shrink-0 text-emerald-600" size={12} title="WhatsApp" />}
            {isPortal && <FiGlobe className="shrink-0 text-sky-600" size={12} title="Customer portal" />}
            {isService && <FiBriefcase className="shrink-0 text-violet-600" size={12} title="Service" />}
            {isTeam && <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-navy-700">Team</span>}
            {c.pinned_at && <BsPinAngleFill className="shrink-0 text-slate-400" size={11} title="Pinned" aria-label="Pinned" />}
            <span className={`ml-auto shrink-0 text-[11px] ${hasUnread ? "text-navy-700 font-semibold" : "text-slate-500"}`}>
              {formatListTime(c.last_message_at)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            {!activeTag && rowTags.length > 0 && <TagBadges tags={rowTags} max={1} className="shrink-0" />}
            {typing.length > 0 ? (
              <p className="flex-1 truncate text-[13px] text-emerald-600 italic">
                {isGroup ? `${typing.map((u) => u.name).join(", ")} typing…` : "typing…"}
              </p>
            ) : (
              <p className={`flex-1 truncate text-[13px] ${hasUnread ? "text-slate-700" : "text-slate-500"}`}>{getPreview(c)}</p>
            )}
            {waiting && (
              <span
                className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold ${
                  late ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"
                }`}
                title="The customer is waiting for a reply"
              >
                waiting {formatWaiting(c.waiting_since, now)}
              </span>
            )}
            {hasUnread && (
              <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-navy-700 text-white text-[11px] font-semibold flex items-center justify-center">
                {c.unread > 99 ? "99+" : c.unread}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 space-y-3 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          {/* Without the folders column, the folders live in this dropdown */}
          {!foldersInColumn && (
          <div ref={menuRef} className="relative min-w-0">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-haspopup="true"
              className="flex min-h-[40px] max-w-full items-center gap-1.5 rounded-lg px-1 text-lg font-semibold tracking-tight text-slate-900 hover:bg-slate-50"
            >
              <span className="truncate">{folderLabel}</span>
              <FiChevronDown size={16} className={`shrink-0 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
            </button>
            {menuOpen && (
              <div className="absolute left-0 top-full z-30 mt-1 max-h-[70vh] w-64 overflow-y-auto rounded-xl bg-white shadow-lg ring-1 ring-slate-200">
                <ChatFolders
                  variant="menu"
                  folder={folder}
                  onChange={(id) => {
                    onFolderChange(id);
                    setMenuOpen(false);
                  }}
                  conversations={conversations}
                  tags={tags}
                  onManageTags={onManageTags && (() => { setMenuOpen(false); onManageTags(); })}
                />
              </div>
            )}
          </div>
          )}
          {foldersInColumn && (
            <h2 className="min-w-0 truncate text-[15px] font-semibold text-slate-900">{folderLabel}</h2>
          )}
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-slate-500">
              {filtered.length} chat{filtered.length === 1 ? "" : "s"}
              {unreadInFolder > 0 ? ` · ${unreadInFolder} unread` : ""}
            </span>
            {!foldersInColumn && (
            <button
              type="button"
              onClick={onNewChat}
              className="h-9 w-9 rounded-full bg-navy-700 text-white flex items-center justify-center hover:bg-navy-800 transition shadow-sm"
              title="New chat"
              aria-label="New chat"
            >
              <FiPlus size={18} />
            </button>
            )}
          </div>
        </div>

        <div className="relative">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search names, numbers, messages"
            aria-label="Search chats"
            className="w-full h-10 pl-10 pr-9 rounded-xl bg-slate-100 text-sm text-slate-800 placeholder:text-slate-400 border border-transparent focus:bg-white focus:border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-50 transition"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              title="Clear"
              aria-label="Clear search"
            >
              <FiX size={14} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2" style={{ scrollbarWidth: "thin" }}>
        {sections.length > 0 ? (
          sections.map((s) => (
            <div key={s.label}>
              <p className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
              {s.rows.map(renderRow)}
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center text-center px-6 py-16">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <FiMessageSquare className="text-slate-400" size={20} />
            </div>
            <p className="text-sm font-medium text-slate-700">
              {search
                ? "No chats match your search"
                : folder === "all"
                ? "No conversations yet"
                : folder === "unread"
                ? "You're all caught up"
                : folder === "pinned"
                ? "No pinned chats"
                : activeTag
                ? `No chats tagged ${folderLabel}`
                : `No ${folderLabel.toLowerCase()} chats`}
            </p>
            {!search && folder === "pinned" && (
              <p className="mt-1 text-xs text-slate-500">Open a chat and choose “Pin chat” from its menu.</p>
            )}
            {!search && activeTag && (
              <p className="mt-1 text-xs text-slate-500">Open a chat and choose “Add tag” from its menu.</p>
            )}
            {!search && folder === "all" && (
              <button type="button" onClick={onNewChat} className="mt-2 text-sm font-medium text-navy-700 hover:underline">
                Start a new chat
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationList;
