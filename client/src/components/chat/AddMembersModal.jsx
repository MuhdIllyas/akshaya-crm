import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FiX, FiSearch, FiCheck, FiUserPlus } from "react-icons/fi";
import ChatAvatar from "./ChatAvatar";
import { getAvatarUrl } from "./chatUtils";

/** Pick staff to add to a group chat. staffList: everyone who can be added. */
const AddMembersModal = ({ open, onClose, conversationName, staffList = [], memberIds = [], onAdd }) => {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setSearch("");
      setPicked([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const inChat = useMemo(() => new Set(memberIds.map(String)), [memberIds]);

  // grouped by centre, people already in the chat left out
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map();
    staffList
      .filter((s) => !inChat.has(String(s.id)))
      .filter((s) => !q || `${s.name} ${s.role || ""} ${s.centre_name || ""}`.toLowerCase().includes(q))
      .forEach((s) => {
        const key = s.centre_name || "Other";
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(s);
      });
    return [...map.entries()];
  }, [staffList, inChat, search]);

  const toggle = (id) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async () => {
    if (!picked.length || busy) return;
    setBusy(true);
    const ok = await onAdd(picked);
    setBusy(false);
    if (ok) onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Add people"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 340 }}
            className="flex max-h-[85vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-slate-900">Add people</h2>
                {conversationName && <p className="mt-0.5 truncate text-xs text-slate-500">to {conversationName}</p>}
              </div>
              <button onClick={onClose} className="-mr-1 grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close">
                <FiX size={18} />
              </button>
            </div>

            <div className="px-5 pt-3">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search staff"
                  aria-label="Search staff"
                  className="h-10 w-full rounded-xl bg-slate-100 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-50"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: "thin" }}>
              {groups.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-slate-500">
                  {search ? "Nobody matches your search" : "Everyone is already in this chat"}
                </p>
              ) : (
                groups.map(([centre, people]) => (
                  <div key={centre} className="mb-2">
                    <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{centre}</p>
                    {people.map((s) => {
                      const on = picked.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          onClick={() => toggle(s.id)}
                          className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition ${on ? "bg-blue-50" : "hover:bg-slate-50"}`}
                        >
                          <ChatAvatar name={s.name} photo={getAvatarUrl(s.photo)} size="sm" color="bg-slate-400" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-slate-800">{s.name}</span>
                            <span className="block truncate text-[11px] capitalize text-slate-500">{s.role}</span>
                          </span>
                          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${on ? "bg-navy-700 text-white" : "ring-1 ring-slate-300 text-transparent"}`}>
                            <FiCheck size={12} strokeWidth={3} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
              <span className="text-xs text-slate-500">{picked.length ? `${picked.length} selected` : "Pick one or more people"}</span>
              <button
                onClick={submit}
                disabled={!picked.length || busy}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-navy-700 px-4 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-40"
              >
                <FiUserPlus size={15} />
                {busy ? "Adding…" : "Add"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default AddMembersModal;
