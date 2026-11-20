import React, { useEffect, useRef, useState } from "react";
import { FiPlus, FiX, FiTrash2 } from "react-icons/fi";
import { toast } from "react-toastify";
import { API_BASE_URL } from "./chatUtils";

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

let cache = null; // shared by every chat, loaded once per page

/** Saved replies as chips above the message box. Clicking one puts its text in the box. */
const QuickReplies = ({ onPick, disabled = false }) => {
  const [replies, setReplies] = useState(cache || []);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef(null);
  const me = String(localStorage.getItem("id"));
  const role = (localStorage.getItem("role") || "").trim().toLowerCase();

  useEffect(() => {
    if (cache) return;
    fetch(`${API_BASE_URL}/api/chat/quick-replies`, { headers: headers() })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        cache = Array.isArray(rows) ? rows : [];
        setReplies(cache);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const update = (next) => {
    cache = next;
    setReplies(next);
  };

  const add = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/quick-replies`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save the quick reply");
      update([...replies, data].sort((a, b) => a.title.localeCompare(b.title)));
      setTitle("");
      setBody("");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/quick-replies/${r.id}`, { method: "DELETE", headers: headers() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't delete the quick reply");
      update(replies.filter((x) => x.id !== r.id));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const canDelete = (r) =>
    role === "superadmin" || role === "admin" || String(r.created_by) === me;

  return (
    <div ref={boxRef} className="relative mb-2.5 flex flex-wrap items-center gap-1.5">
      {replies.map((r) => (
        <button
          key={r.id}
          type="button"
          disabled={disabled}
          onClick={() => onPick(r.body)}
          title={r.body}
          className="h-7 max-w-[180px] truncate rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
        >
          {r.title}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-slate-300 bg-white px-2.5 text-xs text-slate-500 transition hover:text-navy-700"
      >
        <FiPlus size={12} /> {replies.length ? "Quick replies" : "Add quick reply"}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-40 mb-2 w-[min(360px,calc(100vw-2rem))] rounded-xl bg-white p-3 shadow-lg ring-1 ring-slate-200">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Quick replies</p>
            <button type="button" onClick={() => setOpen(false)} className="grid h-7 w-7 place-items-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close">
              <FiX size={15} />
            </button>
          </div>
          {replies.length > 0 && (
            <ul className="mb-3 max-h-48 space-y-1 overflow-y-auto">
              {replies.map((r) => (
                <li key={r.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-800">{r.title}</p>
                    <p className="line-clamp-2 text-xs text-slate-500">{r.body}</p>
                  </div>
                  {canDelete(r) && (
                    <button type="button" onClick={() => remove(r)} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${r.title}`}>
                      <FiTrash2 size={13} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={add} className="space-y-2 rounded-lg bg-slate-50 p-2.5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={40}
              placeholder="Name, like Office timings"
              aria-label="Quick reply name"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-50"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="We're open 9 am to 6 pm, Monday to Saturday."
              aria-label="Quick reply message"
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-50"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Shared with your centre</span>
              <button
                type="submit"
                disabled={!title.trim() || !body.trim() || busy}
                className="h-8 rounded-lg bg-navy-700 px-3 text-xs font-semibold text-white hover:bg-navy-800 disabled:opacity-40"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default QuickReplies;
