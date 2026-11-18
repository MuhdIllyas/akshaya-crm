import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiMessageCircle, FiSearch, FiX } from "react-icons/fi";
import ChatAvatar from "@/components/chat/ChatAvatar";
import { getAvatarUrl } from "@/components/chat/chatUtils";
import { loadStaffDirectory, openStaffChat, useIsOnline } from "./staffDirectory";

/**
 * "Share in chat" for things that aren't tied to one person (a calendar event,
 * a task…): pick a staff member, and their chat window opens with the card
 * attached. `context` is the same object <StaffName context> takes.
 *
 *   <ShareInChat context={eventContext(event)} onShared={onClose} />
 */
const ShareInChat = ({ context, onShared, className = "" }) => {
  const [open, setOpen] = useState(false);
  if (!context) return null;
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={className || "flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2 text-sm text-slate-700 hover:bg-slate-50"}
      >
        <FiMessageCircle className="h-4 w-4" /> Share in chat
      </button>
      {open && (
        <StaffPicker
          title={`Share "${context.label}"`}
          onClose={() => setOpen(false)}
          onPick={(s) => {
            openStaffChat({ id: s.id, name: s.name, photo: s.photo ? getAvatarUrl(s.photo) : null }, context);
            setOpen(false);
            onShared?.();
          }}
        />
      )}
    </>
  );
};

const StaffPicker = ({ title, onClose, onPick }) => {
  const [staff, setStaff] = useState(null);
  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    let alive = true;
    loadStaffDirectory().then((m) => alive && setStaff([...m.values()]));
    setTimeout(() => inputRef.current?.focus(), 30);
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => { alive = false; document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (staff || []).filter((s) =>
      !needle || [s.name, s.role, s.centre_name].some((v) => String(v || "").toLowerCase().includes(needle))
    );
  }, [staff, q]);

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="truncate pr-2 text-sm font-semibold text-slate-900">{title}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <FiX className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-slate-100 p-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5">
            <FiSearch className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search staff"
              className="h-9 min-w-0 flex-1 text-sm outline-none"
            />
          </div>
        </div>
        <div className="overflow-y-auto p-1.5">
          {staff === null ? (
            <p className="p-4 text-center text-sm text-slate-400">Loading staff…</p>
          ) : shown.length === 0 ? (
            <p className="p-4 text-center text-sm text-slate-400">No staff match "{q}"</p>
          ) : (
            shown.map((s) => <PickerRow key={s.id} s={s} onPick={onPick} />)
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

const PickerRow = ({ s, onPick }) => {
  const online = useIsOnline(s.id);
  return (
    <button
      type="button"
      onClick={() => onPick(s)}
      className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-slate-50"
    >
      <ChatAvatar name={s.name} photo={s.photo ? getAvatarUrl(s.photo) : null} size="sm" online={online} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-900">{s.name}</span>
        <span className="block truncate text-xs text-slate-500">
          {[s.role && s.role.charAt(0).toUpperCase() + s.role.slice(1), s.centre_name].filter(Boolean).join(" · ")}
        </span>
      </span>
    </button>
  );
};

export default ShareInChat;
