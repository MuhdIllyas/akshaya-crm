import React, { useState, useEffect, useMemo } from "react";
import { FiSearch, FiPlus, FiX, FiMessageSquare, FiSmartphone, FiBriefcase } from "react-icons/fi";
import ChatAvatar from "./ChatAvatar";
import {
  CHAT_TABS,
  ALWAYS_VISIBLE_TABS,
  getConversationCategory,
  getConversationDisplayName,
  getConversationPhoto,
  getOtherParticipants,
  isGroupConversation,
  getAvatarColor,
  formatListTime,
} from "./chatUtils";

const TAB_STORAGE_KEY = "messenger_chat_tab";

const ConversationList = ({
  conversations = [],
  activeConversationId,
  currentUser,
  onlineUsers = new Set(),
  typingUsers = {},
  onSelect,
  onNewChat,
}) => {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem(TAB_STORAGE_KEY) || "all";
    } catch {
      return "all";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(TAB_STORAGE_KEY, tab);
    } catch {
      /* storage unavailable */
    }
  }, [tab]);

  // Counts per tab (ignores search so badges stay accurate)
  const tabStats = useMemo(
    () =>
      conversations.reduce(
        (acc, c) => {
          const cat = getConversationCategory(c);
          acc[cat] = acc[cat] || { count: 0, unread: 0 };
          acc[cat].count += 1;
          acc[cat].unread += c.unread || 0;
          acc.all.count += 1;
          acc.all.unread += c.unread || 0;
          return acc;
        },
        { all: { count: 0, unread: 0 } }
      ),
    [conversations]
  );

  const visibleTabs = CHAT_TABS.filter(
    (t) => ALWAYS_VISIBLE_TABS.includes(t.id) || t.id === tab || (tabStats[t.id]?.count || 0) > 0
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (tab !== "all" && getConversationCategory(c) !== tab) return false;
      if (!q) return true;
      const name = getConversationDisplayName(c, currentUser.id).toLowerCase();
      const last = (c.last_message || c.lastMessage || "").toLowerCase();
      return name.includes(q) || last.includes(q);
    });
  }, [conversations, tab, search, currentUser.id]);

  const getPreview = (c) => {
    const text = c.last_message || c.lastMessage || "";
    if (!text) return "No messages yet";
    if (!isNaN(text) && text.trim() !== "") return "📋 Task";
    const senderId = c.last_message_sender_id;
    if (senderId && String(senderId) === String(currentUser.id)) return `You: ${text}`;
    if (isGroupConversation(c, currentUser.id) && c.last_message_sender) {
      return `${String(c.last_message_sender).split(" ")[0]}: ${text}`;
    }
    return text;
  };

  const activeTabLabel = CHAT_TABS.find((t) => t.id === tab)?.label || "All";

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 space-y-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Messages</h2>
          <button
            onClick={onNewChat}
            className="h-9 w-9 rounded-full bg-navy-700 text-white flex items-center justify-center hover:bg-navy-800 transition shadow-sm"
            title="New conversation"
          >
            <FiPlus size={18} />
          </button>
        </div>

        <div className="relative">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="w-full h-10 pl-10 pr-9 rounded-xl bg-slate-100 text-sm text-slate-800 placeholder:text-slate-400 border border-transparent focus:bg-white focus:border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-50 transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              title="Clear"
            >
              <FiX size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5" style={{ scrollbarWidth: "none" }}>
          {visibleTabs.map((t) => {
            const s = tabStats[t.id] || { count: 0, unread: 0 };
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition ${
                  active
                    ? "bg-navy-700 text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {t.label}
                {s.unread > 0 && (
                  <span
                    className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center ${
                      active ? "bg-white text-navy-700" : "bg-navy-700 text-white"
                    }`}
                  >
                    {s.unread > 99 ? "99+" : s.unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2" style={{ scrollbarWidth: "thin" }}>
        {filtered.length > 0 ? (
          filtered.map((c) => {
            const name = getConversationDisplayName(c, currentUser.id);
            const isGroup = isGroupConversation(c, currentUser.id);
            const isWhatsApp = c.channel === "whatsapp";
            const isService = c.context_type === "service_entry";
            const others = getOtherParticipants(c, currentUser.id);
            const isOnline =
              !isGroup && !isWhatsApp && others[0] ? onlineUsers.has(String(others[0].staff_id)) : undefined;
            const typing = typingUsers[c.id] || [];
            const active = String(activeConversationId) === String(c.id);
            const hasUnread = (c.unread || 0) > 0;

            return (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left transition ${
                  active ? "bg-blue-50" : "hover:bg-slate-50"
                }`}
              >
                <ChatAvatar
                  name={name}
                  photo={getConversationPhoto(c, currentUser.id)}
                  size="lg"
                  color={isWhatsApp ? "bg-emerald-600" : c.avatarColor || getAvatarColor(c.id)}
                  isGroup={isGroup}
                  icon={isWhatsApp ? FiSmartphone : undefined}
                  online={isOnline === true ? true : undefined}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`truncate text-[14px] ${
                        hasUnread ? "font-semibold text-slate-900" : "font-medium text-slate-800"
                      }`}
                    >
                      {name}
                    </span>
                    {isWhatsApp && <FiSmartphone className="shrink-0 text-emerald-600" size={12} title="WhatsApp" />}
                    {isService && <FiBriefcase className="shrink-0 text-violet-600" size={12} title="Service" />}
                    <span
                      className={`ml-auto shrink-0 text-[11px] ${
                        hasUnread ? "text-navy-700 font-semibold" : "text-slate-400"
                      }`}
                    >
                      {formatListTime(c.last_message_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-0.5">
                    {typing.length > 0 ? (
                      <p className="flex-1 truncate text-[13px] text-emerald-600 italic">
                        {isGroup ? `${typing.map((u) => u.name).join(", ")} typing…` : "typing…"}
                      </p>
                    ) : (
                      <p
                        className={`flex-1 truncate text-[13px] ${
                          hasUnread ? "text-slate-700" : "text-slate-500"
                        }`}
                      >
                        {getPreview(c)}
                      </p>
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
          })
        ) : (
          <div className="flex flex-col items-center justify-center text-center px-6 py-16">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <FiMessageSquare className="text-slate-400" size={20} />
            </div>
            <p className="text-sm font-medium text-slate-700">
              {search
                ? "No chats match your search"
                : tab === "all"
                ? "No conversations yet"
                : `No ${activeTabLabel} chats`}
            </p>
            {!search && tab === "all" && (
              <button onClick={onNewChat} className="mt-2 text-sm font-medium text-navy-700 hover:underline">
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