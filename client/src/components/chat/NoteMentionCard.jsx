import React, { useEffect, useState } from "react";
import { FiFileText, FiUser, FiChevronRight, FiLock, FiBriefcase } from "react-icons/fi";
import StaffName from "@/components/staff/StaffName";

const API_BASE_URL = import.meta.env.VITE_API_URL;

const notesPath = () => {
  const role = localStorage.getItem("role")?.trim()?.toLowerCase();
  if (role === "superadmin") return "/dashboard/superadmin/notes";
  if (role === "admin") return "/dashboard/admin/notes";
  return "/dashboard/staff/notes";
};

const VISIBILITY = { private: "Private", mention: "Mentioned staff", centre: "Centre", global: "Everyone" };

/**
 * Note card for a "note" mention in a chat message. The server applies the
 * notes list's own visibility rules and returns only a short preview, so a
 * private note shared in a chat shows a locked card to everyone else.
 */
const NoteMentionCard = ({ entityId, displayText }) => {
  const [state, setState] = useState({ loading: true, data: null, status: 0 });

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE_URL}/api/chat/mentions/note/${entityId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then(async (r) => ({ status: r.status, data: r.ok ? await r.json() : null }))
      .catch(() => ({ status: 0, data: null }))
      .then((res) => alive && setState({ loading: false, ...res }));
    return () => { alive = false; };
  }, [entityId]);

  const shell = "my-2 block w-full max-w-[18rem] overflow-hidden rounded-xl bg-white text-left text-slate-800 ring-1 ring-slate-200";

  if (state.loading) return <span className="animate-pulse font-medium opacity-70">{displayText}</span>;
  if (state.status === 403) {
    return (
      <div className={`${shell} flex items-center gap-2 px-3 py-2.5 text-xs text-slate-500`}>
        <FiLock className="shrink-0" size={13} /> You don't have access to this note
      </div>
    );
  }
  if (!state.data) return <span className="font-medium line-through opacity-70" title="Note not found">{displayText}</span>;

  const n = state.data;
  return (
    <div
      onClick={(e) => { e.stopPropagation(); window.open(notesPath(), "_blank"); }}
      className={`${shell} cursor-pointer select-none transition hover:ring-blue-300`}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-navy-700">
          <FiFileText size={12} /> Note
        </span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
          {VISIBILITY[n.visibility] || n.visibility}
        </span>
      </div>
      <div className="space-y-1.5 p-3">
        <p className="text-sm font-semibold leading-tight">{n.title || "Untitled note"}</p>
        {n.preview && <p className="line-clamp-3 text-[13px] leading-snug text-slate-600">{n.preview}</p>}
        {n.linked_service_name && (
          <p className="flex items-center gap-2 truncate text-[12px] text-slate-500">
            <FiBriefcase className="shrink-0 text-slate-400" size={12} /> {n.linked_service_name}
          </p>
        )}
        <p className="flex items-center gap-2 text-[12px] text-slate-500">
          <FiUser className="shrink-0 text-slate-400" size={12} />
          <StaffName id={n.created_by} name={n.creator_name} showDot={false} fallback="Staff" />
        </p>
      </div>
      <div className="flex justify-end border-t border-slate-100 px-3 py-2">
        <span className="flex items-center gap-0.5 text-xs font-medium text-navy-700">
          Open notes <FiChevronRight size={12} />
        </span>
      </div>
    </div>
  );
};

export default NoteMentionCard;
