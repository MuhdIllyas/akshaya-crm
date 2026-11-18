import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { FiMessageCircle, FiLink, FiUser, FiX, FiCheckSquare } from "react-icons/fi";
import ChatAvatar from "@/components/chat/ChatAvatar";
import { getAvatarUrl } from "@/components/chat/chatUtils";
import { useIsOnline, loadStaffDirectory, currentUserId, openStaffChat, findIdByName, findIdByNameSync, messengerPath } from "./staffDirectory";

/**
 * A staff member's name that opens a small staff card with "Message" actions.
 *
 *   <StaffName id={service.assignedToId} name={service.staffName}
 *              context={{ label: "TR-104 · Income certificate" }} />
 *
 * `id` is optional: without it the name is matched against the active staff
 * list, and used only when exactly one person has that name. Anything that
 * can't be matched (e.g. "Unassigned", "System", former staff) stays plain text.
 *
 * `profilePath` defaults to the admin staff profile for admins and superadmins;
 * pass `profilePath={null}` explicitly to hide "View profile".
 */
const StaffName = ({ id: givenId, name: givenName, context = null, profilePath, className = "", showDot = true, fallback = "—" }) => {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  // Records that only store the staff id (e.g. tasks) get the name from the staff list.
  const [lookedUpName, setLookedUpName] = useState(null);
  useEffect(() => {
    if (givenName || !hasId(givenId)) return;
    if (String(givenId) === String(currentUserId())) { setLookedUpName("You"); return; }
    let alive = true;
    loadStaffDirectory().then((m) => alive && setLookedUpName(m.get(String(givenId))?.name || null));
    return () => { alive = false; };
  }, [givenId, givenName]);
  const name = givenName || lookedUpName;
  const [matchedId, setMatchedId] = useState(() => (hasId(givenId) ? null : findIdByNameSync(name)));
  const id = hasId(givenId) ? givenId : matchedId;
  const online = useIsOnline(id);
  const isSelf = id != null && String(id) === String(currentUserId());

  useEffect(() => {
    if (hasId(givenId) || !name) return;
    let alive = true;
    findIdByName(name).then((found) => alive && setMatchedId(found));
    return () => { alive = false; };
  }, [givenId, name]);

  if (!name) return <span className={className}>{fallback}</span>;
  if (!hasId(id) || isSelf) return <span className={className}>{name}</span>;

  const profile = profilePath !== undefined ? profilePath : defaultProfilePath(id);

  return (
    <>
      {/* A span, not a <button>: names often sit inside clickable rows/cards that are buttons themselves. */}
      <span
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }
        }}
        className={`inline-flex max-w-full items-center gap-1.5 rounded text-left decoration-slate-300 decoration-dashed underline-offset-4 hover:text-navy-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-300 ${className}`}
        title={isSelf ? name : `${name} — click to message`}
      >
        {showDot && (
          <span className={`h-2 w-2 shrink-0 rounded-full ${online ? "bg-emerald-500" : "bg-slate-300"}`} aria-hidden="true" />
        )}
        <span className="truncate">{name}</span>
      </span>
      {open && (
        <StaffCard
          anchor={ref.current}
          id={id}
          name={name}
          online={online}
          isSelf={isSelf}
          context={context}
          profilePath={profile}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

const CARD_W = 272;

const StaffCard = ({ anchor, id, name, online, isSelf, context, profilePath, onClose }) => {
  const navigate = useNavigate();
  const cardRef = useRef(null);
  const [info, setInfo] = useState(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    let alive = true;
    loadStaffDirectory().then((m) => alive && setInfo(m.get(String(id)) || {}));
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    const place = () => {
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const left = Math.max(8, Math.min(r.left, window.innerWidth - CARD_W - 8));
      const below = r.bottom + 6;
      const h = cardRef.current?.offsetHeight || 220;
      const top = below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 6) : below;
      setPos({ left, top });
    };
    place();
    const onDown = (e) => {
      if (cardRef.current?.contains(e.target) || anchor?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [anchor, onClose, info]);

  const inactive = info && !info.id && !isSelf; // not in the active staff list
  const photo = info?.photo ? getAvatarUrl(info.photo) : null;
  const subtitle = [info?.role && cap(info.role), info?.centre_name].filter(Boolean).join(" · ");

  const message = (withContext) => {
    openStaffChat({ id, name, photo }, withContext ? context : null);
    onClose();
  };

  return createPortal(
    <div
      ref={cardRef}
      onClick={(e) => e.stopPropagation()}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: CARD_W }}
      className="fixed z-[1000] rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl"
      role="dialog"
      aria-label={`${name} staff card`}
    >
      <div className="flex items-start gap-3">
        <ChatAvatar name={name} photo={photo} size="md" online={online} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
          <p className="truncate text-xs text-slate-500">{info ? subtitle || "Staff" : "Loading…"}</p>
          <p className={`mt-0.5 text-xs font-medium ${online ? "text-emerald-600" : "text-slate-400"}`}>
            {isSelf ? "This is you" : online ? "Online" : "Offline"}
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
          <FiX className="h-4 w-4" />
        </button>
      </div>

      {!isSelf && (
        <div className="mt-3 space-y-1.5">
          {inactive ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">This staff member isn't active, so you can't message them.</p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => message(false)}
                className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-navy-700 text-sm font-medium text-white hover:bg-navy-800"
              >
                <FiMessageCircle className="h-4 w-4" /> Message
              </button>
              {context?.label && (
                <button
                  type="button"
                  onClick={() => message(true)}
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
                  title={context.label}
                >
                  <FiLink className="h-4 w-4 shrink-0" />
                  <span className="truncate">Message about {context.short || context.label}</span>
                </button>
              )}
              {context?.type === "task" && context.conversationId && (
                // The task's own chat (where its card was posted when it was created),
                // e.g. the service's group chat, so everyone involved sees the reply.
                <button
                  type="button"
                  onClick={() => { onClose(); navigate(messengerPath(), { state: { openConversationId: context.conversationId } }); }}
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <FiCheckSquare className="h-4 w-4 shrink-0" /> Open task chat
                </button>
              )}
            </>
          )}
          {profilePath && (
            <button
              type="button"
              onClick={() => { onClose(); navigate(profilePath); }}
              className="flex h-8 w-full items-center justify-center gap-2 rounded-lg text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            >
              <FiUser className="h-4 w-4" /> View profile
            </button>
          )}
        </div>
      )}
    </div>,
    document.body
  );
};

const cap = (s = "") => s.charAt(0).toUpperCase() + s.slice(1);

const hasId = (v) => v != null && v !== "" && v !== "N/A";

const defaultProfilePath = (id) => {
  const role = localStorage.getItem("role")?.trim()?.toLowerCase();
  return role === "admin" || role === "superadmin" ? `/dashboard/admin/staff/${id}` : null;
};

export default StaffName;
