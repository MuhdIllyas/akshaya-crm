import React, { useMemo } from "react";
import {
  FiList, FiCircle, FiSmartphone, FiUsers, FiBriefcase, FiShield, FiPlus, FiTag,
} from "react-icons/fi";
import { BsPinAngle } from "react-icons/bs";
import { CHAT_FOLDERS, inFolder, isWaiting } from "./chatUtils";
import { tagColor } from "@/components/tags/tagColors";

const ICONS = {
  all: FiList,
  unread: FiCircle,
  pinned: BsPinAngle,
  customers: FiSmartphone,
  staff: FiUsers,
  services: FiBriefcase,
  teams: FiShield,
};
const ICON_COLOR = {
  customers: "text-emerald-600",
  services: "text-violet-600",
  teams: "text-sky-700",
};

/**
 * Messenger folders: All / Unread / Pinned, chat kinds, then your tags.
 * variant "column": the left column on wide screens. "menu": the dropdown on smaller ones.
 */
const ChatFolders = ({
  folder,
  onChange,
  conversations = [],
  tags = [],
  onManageTags,
  onNewChat,
  variant = "column",
}) => {
  const stats = useMemo(() => {
    const out = {};
    CHAT_FOLDERS.forEach((f) => {
      const list = conversations.filter((c) => inFolder(c, f.id));
      out[f.id] = {
        count: list.length,
        unread: list.reduce((n, c) => n + (c.unread || 0), 0),
        waiting: list.filter(isWaiting).length,
      };
    });
    tags.forEach((t) => {
      const ids = new Set((t.conversation_ids || []).map(String));
      const list = conversations.filter((c) => ids.has(String(c.id)));
      out[`tag:${t.id}`] = { count: list.length, unread: list.reduce((n, c) => n + (c.unread || 0), 0) };
    });
    return out;
  }, [conversations, tags]);

  const isMenu = variant === "menu";
  const rowCls = (active) =>
    `w-full flex items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition ${
      isMenu ? "min-h-[44px]" : "h-9"
    } ${active ? "bg-blue-50 text-navy-700 font-semibold" : "text-slate-700 hover:bg-slate-100"}`;

  const Count = ({ id }) => {
    const s = stats[id] || {};
    if (id === "customers" && s.waiting > 0) {
      return (
        <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-800">
          {s.waiting} waiting
        </span>
      );
    }
    if (id === "unread") {
      return s.count > 0 ? (
        <span className="ml-auto shrink-0 min-w-[20px] rounded-full bg-navy-700 px-1.5 py-px text-center text-[10px] font-semibold text-white">
          {s.count}
        </span>
      ) : null;
    }
    if (s.unread > 0 && id !== "all") {
      return (
        <span className="ml-auto shrink-0 min-w-[20px] rounded-full bg-navy-700 px-1.5 py-px text-center text-[10px] font-semibold text-white">
          {s.unread > 99 ? "99+" : s.unread}
        </span>
      );
    }
    return <span className="ml-auto shrink-0 text-[11px] font-semibold tabular-nums text-slate-500">{s.count || 0}</span>;
  };

  const FolderButton = ({ f }) => {
    const Icon = ICONS[f.id];
    const active = folder === f.id;
    return (
      <button type="button" onClick={() => onChange(f.id)} aria-current={active ? "true" : undefined} className={rowCls(active)}>
        <Icon size={15} className={`shrink-0 ${active ? "" : ICON_COLOR[f.id] || "text-slate-500"}`} aria-hidden="true" />
        <span className="truncate">{f.label}</span>
        <Count id={f.id} />
      </button>
    );
  };

  const groupHeading = (text, action) => (
    <div className="flex items-center justify-between px-2.5 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {text}
      {action}
    </div>
  );

  return (
    <nav aria-label="Chat folders" className={isMenu ? "p-1.5" : "flex h-full min-h-0 flex-col bg-white px-3 pt-4"}>
      {!isMenu && (
        <div className="flex items-center justify-between px-1 pb-3">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Messages</h2>
          {onNewChat && (
            <button
              type="button"
              onClick={onNewChat}
              className="grid h-9 w-9 place-items-center rounded-full bg-navy-700 text-white shadow-sm transition hover:bg-navy-800"
              aria-label="New chat"
              title="New chat"
            >
              <FiPlus size={17} />
            </button>
          )}
        </div>
      )}

      <div className={isMenu ? "" : "min-h-0 flex-1 overflow-y-auto pb-4"} style={{ scrollbarWidth: "thin" }}>
        {CHAT_FOLDERS.filter((f) => !f.group).map((f) => <FolderButton key={f.id} f={f} />)}

        {groupHeading("Chats")}
        {CHAT_FOLDERS.filter((f) => f.group).map((f) => <FolderButton key={f.id} f={f} />)}

        {groupHeading(
          "Your tags",
          onManageTags && (
            <button
              type="button"
              onClick={onManageTags}
              className="grid h-6 w-6 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-navy-700"
              aria-label={tags.length ? "Edit tags" : "New tag"}
              title={tags.length ? "Edit tags" : "New tag"}
            >
              {tags.length ? <FiTag size={13} /> : <FiPlus size={14} />}
            </button>
          )
        )}
        {tags.length === 0 ? (
          <button type="button" onClick={onManageTags} className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-slate-500 hover:bg-slate-50">
            Make tags like “Passport” to group chats and notes.
          </button>
        ) : (
          tags.map((t) => {
            const id = `tag:${t.id}`;
            const active = folder === id;
            return (
              <button key={t.id} type="button" onClick={() => onChange(id)} aria-current={active ? "true" : undefined} className={rowCls(active)}>
                <span className={`mx-[3px] h-2.5 w-2.5 shrink-0 rounded-full ${tagColor(t.color).dot}`} aria-hidden="true" />
                <span className="truncate">{t.name}</span>
                <Count id={id} />
              </button>
            );
          })
        )}
      </div>
    </nav>
  );
};

export default ChatFolders;
