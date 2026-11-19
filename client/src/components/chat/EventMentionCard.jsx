import React, { useEffect, useState } from "react";
import { FiCalendar, FiClock, FiUser, FiMapPin, FiChevronRight, FiLock } from "react-icons/fi";
import StaffName from "@/components/staff/StaffName";

const API_BASE_URL = import.meta.env.VITE_API_URL;

const calendarPath = () => {
  const role = localStorage.getItem("role")?.trim()?.toLowerCase();
  if (role === "superadmin") return "/dashboard/superadmin/calendar";
  if (role === "admin") return "/dashboard/admin/calendar";
  return "/dashboard/staff/calendar";
};

const fmtDay = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "";
const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";

/**
 * Calendar event card for an "event" mention in a chat message.
 * The server applies the calendar's own visibility rules, so someone who
 * can't see the event gets a locked card instead of its details.
 */
// bare: no border/shadow of its own, for when it sits inside a joined message block
const EventMentionCard = ({ entityId, displayText, bare = false }) => {
  const [state, setState] = useState({ loading: true, data: null, status: 0 });

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE_URL}/api/chat/mentions/event/${entityId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then(async (r) => ({ status: r.status, data: r.ok ? await r.json() : null }))
      .catch(() => ({ status: 0, data: null }))
      .then((res) => alive && setState({ loading: false, ...res }));
    return () => { alive = false; };
  }, [entityId]);

  const shell = bare ? "block w-full overflow-hidden bg-white text-left text-slate-800" : "block w-72 max-w-full overflow-hidden rounded-xl bg-white text-left text-slate-800 shadow-sm ring-1 ring-slate-200";

  if (state.loading) return <span className="animate-pulse font-medium opacity-70">{displayText}</span>;
  if (state.status === 403) {
    return (
      <div className={`${shell} flex items-center gap-2 px-3 py-2.5 text-xs text-slate-500`}>
        <FiLock className="shrink-0" size={13} /> You don't have access to this calendar event
      </div>
    );
  }
  if (!state.data) return <span className="font-medium line-through opacity-70" title="Event not found">{displayText}</span>;

  const ev = state.data;
  const start = ev.start_datetime || ev.date;
  const hasTime = !!ev.start_datetime;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); window.open(calendarPath(), "_blank"); }}
      className={`${shell} cursor-pointer select-none transition hover:ring-blue-300`}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-navy-700">
          <FiCalendar size={12} /> Calendar event
        </span>
        {ev.event_type && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold capitalize text-slate-600">
            {String(ev.event_type).replace(/_/g, " ")}
          </span>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <p className="text-sm font-semibold leading-tight">{ev.title || "Untitled event"}</p>
        <p className="flex items-center gap-2 text-[13px] text-slate-600">
          <FiClock className="shrink-0 text-slate-400" size={13} />
          {fmtDay(start)}
          {hasTime && ` · ${fmtTime(ev.start_datetime)}${ev.end_datetime ? `–${fmtTime(ev.end_datetime)}` : ""}`}
        </p>
        {ev.assigned_to && (
          <p className="flex items-center gap-2 text-[13px] text-slate-600">
            <FiUser className="shrink-0 text-slate-400" size={13} />
            <StaffName id={ev.assigned_to} name={ev.assigned_staff_name} showDot={false} />
          </p>
        )}
        {ev.centre_name && (
          <p className="flex items-center gap-2 truncate text-[13px] text-slate-600">
            <FiMapPin className="shrink-0 text-slate-400" size={13} />
            {ev.visibility === "global" ? "All centres" : ev.centre_name}
          </p>
        )}
      </div>
      <div className="flex justify-end border-t border-slate-100 px-3 py-2">
        <span className="flex items-center gap-0.5 text-xs font-medium text-navy-700">
          Open calendar <FiChevronRight size={12} />
        </span>
      </div>
    </div>
  );
};

export default EventMentionCard;
