import React, { useEffect, useState } from "react";
import { FiGlobe,
  FiX,
  FiUsers,
  FiBriefcase,
  FiFile,
  FiStar,
  FiCheckSquare,
  FiCheck,
  FiUser,
  FiCalendar,
  FiClock,
  FiMapPin,
  FiSmartphone,
  FiMessageSquare,
  FiAlertCircle,
  FiExternalLink,
  FiUserPlus,
  FiLogOut,
  FiMoreHorizontal,
  FiEdit2,
  FiShield,
  FiUserMinus,
} from "react-icons/fi";
import { tagColor } from "@/components/tags/tagColors";
import ChatAvatar from "./ChatAvatar";
import {
  getAvatarUrl,
  getAvatarColor,
  getConversationDisplayName,
  getConversationPhoto,
  getOtherParticipants,
  isGroupConversation,
  formatShortDate,
  API_BASE_URL,
  hasEditableMembers,
  isGroupAdmin,
  isCustomerChat,
  formatPhone,
} from "./chatUtils";
import StaffName from '@/components/staff/StaffName';
import { useNavigate } from "react-router-dom";
import { customersPath } from "@/utils/customersPath";

// Customer chats show this many of the customer's latest applications
const RECENT_APPLICATIONS = 5;
import { isServiceTask, isClosedTask, startServiceEntry } from "@/components/tasks/ServiceTaskBits";

/* ---------------- small building blocks ---------------- */

// A titled block in the panel: small uppercase label, optional action on the right
const Section = ({ title, count, action, children }) => (
  <section className="px-5 pb-5">
    <div className="mb-2 flex items-center justify-between">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
        {count > 0 && <span className="ml-1.5 font-medium normal-case tracking-normal text-slate-400">{count}</span>}
      </h4>
      {action}
    </div>
    {children}
  </section>
);

const monthYear = (d) => {
  const t = new Date(d);
  return isNaN(t.getTime()) ? "" : t.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};

const trackingPill = (status) => {
  const s = String(status || "").toLowerCase();
  if (["completed", "approved", "delivered", "closed"].includes(s)) return ["Done", "bg-emerald-100 text-emerald-800"];
  if (["rejected", "cancelled"].includes(s)) return ["Closed", "bg-rose-100 text-rose-700"];
  return ["Open", "bg-sky-100 text-sky-800"];
};

const KV = ({ label, children }) => (
  <div className="min-w-0">
    <p className="text-[11px] text-slate-400 mb-0.5">{label}</p>
    <div className="text-[13px] font-medium text-slate-800 truncate">{children}</div>
  </div>
);

const EmptyHint = ({ icon: Icon, text }) => (
  <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-500">
    <Icon className="text-slate-300" size={16} />
    {text}
  </div>
);

const statusPill = (status) => {
  const s = String(status || "pending").toLowerCase();
  if (s === "completed") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (s === "processing" || s === "in_progress") return "bg-blue-50 text-blue-700 ring-blue-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
};

const priorityPill = (priority) => {
  const p = String(priority || "").toLowerCase();
  if (p === "high") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (p === "medium") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (p === "low") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  return "bg-slate-50 text-slate-600 ring-slate-200";
};

/* ---------------- main panel ---------------- */

const ConversationDetails = ({
  conversation,
  currentUser,
  onlineUsers = new Set(),
  staffList = [],
  onAssign,
  serviceDetails,
  loadingServiceDetails,
  serviceDetailsError = null,
  messages = [],
  notes = [],
  onAddNote,
  tasks = [],
  onCompleteTask,
  onOpenTracking,
  socketConnected = true,
  onClose,
  conversationTags = [],
  onOpenTagPicker,
  onAddMembers,
  onRemoveMember,
  onSetMemberRole,
  onLeaveGroup,
  onRenameGroup,
  onSaveContactName,
}) => {
  const navigate = useNavigate();
  const [memberMenu, setMemberMenu] = useState(null); // staff_id whose menu is open
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [changingAssignee, setChangingAssignee] = useState(false);
  // Customer chats: when they became a customer, their services
  const [summary, setSummary] = useState(null);
  const convId = conversation?.id;
  const customerChat = !!conversation && isCustomerChat(conversation);
  useEffect(() => {
    setSummary(null);
    setChangingAssignee(false);
    if (!convId || !customerChat) return undefined;
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/chat/conversation/${convId}/customer-summary`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && setSummary(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [convId, customerChat]);
  if (!conversation) return null;

  const editableMembers = hasEditableMembers(conversation);
  const canManageMembers = isGroupAdmin(conversation, currentUser);
  // WhatsApp chats: staff can save a name for the number (empty clears it)
  const canNameContact = conversation.channel === "whatsapp" && !!onSaveContactName;
  const saveRename = async () => {
    const value = newName.trim();
    if (canNameContact) {
      if (value === (conversation.contact_name || "")) return setRenaming(false);
      const ok = await onSaveContactName(value);
      if (ok !== false) setRenaming(false);
      return;
    }
    if (!value || value === conversation.name) return setRenaming(false);
    const ok = await onRenameGroup?.(value);
    if (ok !== false) setRenaming(false);
  };

  const name = getConversationDisplayName(conversation, currentUser.id);
  const others = getOtherParticipants(conversation, currentUser.id);
  const isGroup = isGroupConversation(conversation, currentUser.id);
  const isWhatsApp = conversation.channel === "whatsapp";
  const isPortal = conversation.channel === "portal";
  // customer chats (WhatsApp, portal): no staff "online" status or photo
  const isExternal = isWhatsApp || isPortal;
  const isService = conversation.context_type === "service_entry";
  const isTeam = conversation.context_type === "team";
  const onlineOthers = others.filter((p) => onlineUsers.has(String(p.staff_id)));
  const singleOnline = !isGroup && !isExternal ? onlineOthers.length > 0 : undefined;

  const sharedFiles = messages.filter((m) => m.isFile && !m.isOptimistic && !m.isDeleted).slice(-6).reverse();

  // Tasks: service chats -> all tasks of the service; normal chats -> tasks shared as messages
  let relevantTasks = [];
  if (isService) {
    relevantTasks = tasks.filter(
      (t) => String(t.related_service_entry_id) === String(conversation.context_id)
    );
  } else {
    const seen = new Set();
    messages
      .filter((m) => m.messageType === "task" && !m.isDeleted)
      .forEach((m) => {
        const t = m.live_task_data || tasks.find((x) => String(x.id) === String(m.text));
        if (t && !seen.has(String(t.id))) {
          seen.add(String(t.id));
          relevantTasks.push(t);
        }
      });
  }

  const customerLine = summary
    ? [
        summary.customer_since && `Customer since ${monthYear(summary.customer_since)}`,
        `${summary.service_count} application${summary.service_count === 1 ? "" : "s"}`,
      ].filter(Boolean).join(" · ")
    : null;
  const subtitle = customerLine
    ? customerLine
    : isWhatsApp
    ? "" // the number is shown on its own line above
    : isPortal
    ? "Customer portal"
    : isGroup
    ? `${conversation.participants?.length || 0} members${onlineOthers.length ? ` · ${onlineOthers.length} online` : ""}`
    : others[0]?.centre_name || (singleOnline ? "Online" : "Offline");

  const openFile = (file) => {
    if (!file.fileUrl) return;
    const url = file.fileUrl.startsWith("http") ? file.fileUrl : `${API_BASE_URL}${file.fileUrl}`;
    window.open(url, "_blank");
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Top bar */}
      <div className="shrink-0 h-14 flex items-center justify-between px-4">
        <p className="text-sm font-semibold text-slate-800">Details</p>
        {onClose && (
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100"
            title="Close"
          >
            <FiX size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        {/* Profile */}
        <div className="px-5 pb-6 pt-1 flex flex-col items-center text-center">
          <ChatAvatar
            name={name}
            photo={getConversationPhoto(conversation, currentUser.id)}
            size="xl"
            color={isWhatsApp ? "bg-emerald-600" : isPortal ? "bg-sky-600" : isTeam ? "bg-navy-700" : conversation.avatarColor || getAvatarColor(conversation.id)}
            isGroup={isGroup && !isTeam}
            icon={isWhatsApp ? FiSmartphone : isPortal ? FiGlobe : isTeam ? FiUsers : undefined}
            online={singleOnline}
          />
          {renaming ? (
            <div className="mt-3 flex w-full items-center gap-1.5">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveRename();
                  if (e.key === "Escape") setRenaming(false);
                }}
                maxLength={80}
                placeholder={canNameContact ? "Name for this number" : undefined}
                aria-label={canNameContact ? "Name for this number" : "Group name"}
                className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 text-sm text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-50"
              />
              <button onClick={saveRename} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy-700 text-white hover:bg-navy-800" aria-label="Save name">
                <FiCheck size={15} />
              </button>
              <button onClick={() => setRenaming(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Cancel">
                <FiX size={15} />
              </button>
            </div>
          ) : (
            <h3 className="mt-3 flex items-center justify-center gap-1.5 text-base font-semibold text-slate-900 break-words">
              {name}
              {((canManageMembers && onRenameGroup) || canNameContact) && (
                <button
                  onClick={() => {
                    setNewName(canNameContact ? conversation.contact_name || conversation.customer_name || conversation.wa_profile_name || "" : conversation.name || name);
                    setRenaming(true);
                  }}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-navy-700"
                  title={canNameContact ? "Save a name for this number" : "Rename group"}
                  aria-label={canNameContact ? "Save a name for this number" : "Rename group"}
                >
                  <FiEdit2 size={13} />
                </button>
              )}
            </h3>
          )}
          {renaming && canNameContact && (
            <p className="mt-1 text-[11px] text-slate-500">Only for this chat. Leave it empty to use their WhatsApp or customer name.</p>
          )}
          {!renaming && conversation.channel === "whatsapp" && (
            <p className="mt-0.5 text-xs text-slate-500">
              {formatPhone(conversation.context_identifier)}
              {conversation.wa_profile_name && conversation.wa_profile_name !== name ? ` · on WhatsApp: ${conversation.wa_profile_name}` : ""}
            </p>
          )}
          <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-1 empty:hidden">
            {!isGroup && !isExternal && others[0]?.centre_name && <FiMapPin size={11} />}
            {subtitle}
          </p>

          <div className="mt-3 flex flex-wrap justify-center gap-1.5 empty:hidden">
            {!isGroup && !isExternal && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                  singleOnline
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-slate-50 text-slate-500 ring-slate-200"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${singleOnline ? "bg-emerald-500" : "bg-slate-400"}`} />
                {singleOnline ? "Online" : "Offline"}
              </span>
            )}
          </div>

          {!socketConnected && (
            <p className="mt-3 text-xs text-amber-600 flex items-center gap-1">
              <FiAlertCircle size={12} /> Reconnecting…
            </p>
          )}

        </div>

        {/* Your tags */}
        {onOpenTagPicker && (
          <Section title="Your tags">
            <div className="flex flex-wrap gap-1.5">
              {conversationTags.map((l) => (
                <button
                  key={l.id}
                  onClick={onOpenTagPicker}
                  className={`inline-flex h-6 max-w-[180px] items-center rounded-full px-2.5 text-[11px] font-semibold ${tagColor(l.color).chip}`}
                  title={`Tagged "${l.name}"`}
                >
                  <span className="truncate">{l.name}</span>
                </button>
              ))}
              <button
                onClick={onOpenTagPicker}
                className="inline-flex h-6 items-center rounded-full border border-dashed border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-600 hover:text-navy-700"
              >
                + Tag
              </button>
            </div>
          </Section>
        )}

        {/* Assigned to (customer chats) */}
        {(isWhatsApp || isPortal || conversation.context_type === "customer") && onAssign && (() => {
          const assignee = staffList.find((s) => String(s.id) === String(conversation.assigned_staff_id));
          return (
            <Section title="Assigned to">
              {changingAssignee ? (
                <select
                  autoFocus
                  value={conversation.assigned_staff_id || ""}
                  onChange={(e) => {
                    onAssign(e.target.value);
                    setChangingAssignee(false);
                  }}
                  onBlur={() => setChangingAssignee(false)}
                  aria-label="Assign to"
                  className="w-full h-10 rounded-[10px] bg-white border border-slate-200 px-2.5 text-sm text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-slate-300"
                >
                  <option value="">Unassigned</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.role ? `(${s.role})` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-2.5 rounded-[10px] border border-slate-200 px-2.5 py-2">
                  {assignee ? (
                    <ChatAvatar name={assignee.name} photo={getAvatarUrl(assignee.photo)} size="xs" color={getAvatarColor(assignee.id)} />
                  ) : (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-slate-400"><FiUser size={12} /></span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800">
                    {assignee ? String(assignee.name).replace(/ \(Me\)$/, "") : "Unassigned"}
                  </span>
                  <button type="button" onClick={() => setChangingAssignee(true)} className="shrink-0 text-xs font-semibold text-navy-700 hover:underline">
                    Change
                  </button>
                </div>
              )}
            </Section>
          );
        })()}

        {/* Services (customer chats) */}
        {customerChat && summary && (
          <Section
            title="Recent applications"
            action={
              summary.customer_id && summary.service_count > 0 ? (
                <button
                  type="button"
                  onClick={() => navigate(customersPath(summary.customer_id))}
                  className="text-xs font-semibold text-navy-700 hover:underline"
                >
                  View all{summary.service_count > RECENT_APPLICATIONS ? ` ${summary.service_count}` : ""}
                </button>
              ) : null
            }
          >
            {summary.services.length === 0 ? (
              <EmptyHint icon={FiBriefcase} text="No applications for this customer yet" />
            ) : (
              <div className="space-y-2">
                {summary.services.slice(0, RECENT_APPLICATIONS).map((s) => {
                  const [label, cls] = trackingPill(s.tracking_status);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => s.tracking_id && onOpenTracking?.(s.tracking_id)}
                      className="w-full rounded-[10px] border border-slate-200 px-3 py-2.5 text-left transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-semibold text-slate-900">
                          {[s.service_name, s.subcategory_name].filter(Boolean).join(" – ") || "Service"}
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-px text-[10px] font-semibold ${cls}`}>{label}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {s.application_number ? `App #${s.application_number}` : formatShortDate(s.created_at)}
                        {s.staff_name ? ` · ${s.staff_name}` : ""}
                      </p>
                    </button>
                  );
                })}
                {!summary.customer_id && summary.service_count > RECENT_APPLICATIONS && (
                  <p className="text-center text-[11px] text-slate-500">
                    Latest {RECENT_APPLICATIONS} of {summary.service_count} for this number
                  </p>
                )}
              </div>
            )}
          </Section>
        )}

        {/* Service details */}
        {isService && (
          <Section title="Service" icon={FiBriefcase}>
            <div className="rounded-xl ring-1 ring-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900 truncate" title={conversation.context_name}>
                {serviceDetails?.service_name || conversation.context_name || "Service request"}
              </p>
              {(serviceDetails?.application_number || conversation.context_identifier) && (
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  App #{serviceDetails?.application_number || conversation.context_identifier}
                </p>
              )}

              {loadingServiceDetails ? (
                <div className="animate-pulse space-y-2 mt-4">
                  <div className="h-3 bg-slate-100 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                  <div className="h-3 bg-slate-100 rounded w-5/6" />
                </div>
              ) : serviceDetails ? (
                <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4">
                    <KV label="Status">
                      <span
                        className={`inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ${statusPill(
                          serviceDetails.status
                        )}`}
                      >
                        {String(serviceDetails.status || "pending").replace(/[-_]/g, " ")}
                      </span>
                    </KV>
                    <KV label="Priority">
                      <span
                        className={`inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ${priorityPill(
                          serviceDetails.priority
                        )}`}
                      >
                        {serviceDetails.priority || "Normal"}
                      </span>
                    </KV>
                    <KV label="Customer">{serviceDetails.customer_name || "N/A"}</KV>
                    <KV label="Subcategory">{serviceDetails.subcategory_name || "N/A"}</KV>
                    <KV label="Current step">
                      <span title={serviceDetails.current_step}>{serviceDetails.current_step || "Initial phase"}</span>
                    </KV>
                    <KV label="Avg time">
                      <span className="inline-flex items-center gap-1">
                        <FiClock size={11} className="text-slate-400" />
                        {serviceDetails.average_time || "N/A"}
                      </span>
                    </KV>
                    <KV label="Expiry">{formatShortDate(serviceDetails.expiry_date)}</KV>
                    <KV label="Updated">{formatShortDate(serviceDetails.updated_at)}</KV>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <KV label="Handled by">
                      <span className="inline-flex items-center gap-1">
                        <FiUser size={12} className="text-slate-400" />
                        <StaffName id={serviceDetails.assigned_staff_id ?? serviceDetails.staff_id} name={serviceDetails.assigned_staff_name || serviceDetails.staff_name} fallback="Unassigned" />
                      </span>
                    </KV>
                  </div>

                  {serviceDetails.notes && (
                    <p className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 italic">
                      “{serviceDetails.notes}”
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-4 text-xs text-slate-500">
                  Unable to load service details.
                  {serviceDetailsError && <span className="block text-rose-500 mt-1">{serviceDetailsError}</span>}
                </p>
              )}

              {onOpenTracking && (
                <button
                  onClick={() => onOpenTracking(serviceDetails?.tracking_id || conversation.context_id)}
                  className="mt-4 w-full h-9 rounded-lg bg-navy-700 hover:bg-navy-800 text-white text-sm font-medium flex items-center justify-center gap-2 transition"
                >
                  <FiExternalLink size={14} /> Open tracking
                </button>
              )}
            </div>
          </Section>
        )}

        {/* Participants */}
        {!isWhatsApp && (
          <Section
            title="Members"
            icon={FiUsers}
            count={conversation.participants?.length || 0}
            defaultOpen={isGroup}
            action={
              canManageMembers && onAddMembers && (
                <button onClick={onAddMembers} className="inline-flex items-center gap-1 text-xs font-medium text-navy-700 hover:underline">
                  <FiUserPlus size={12} /> Add
                </button>
              )
            }
          >
            <div className="space-y-1">
              {(conversation.participants || []).map((p, i) => {
                const isOnline = onlineUsers.has(String(p.staff_id));
                const isMe = String(p.staff_id) === String(currentUser.id);
                const isOwner = p.member_role === "owner";
                const menuOpen = memberMenu === p.staff_id;
                const canAct = canManageMembers && !isMe;
                return (
                  <div key={`${p.staff_id}-${i}`} className="relative flex items-center gap-3 py-1.5">
                    <ChatAvatar
                      name={p.name}
                      photo={getAvatarUrl(p.photo)}
                      size="sm"
                      color="bg-slate-400"
                      online={isOnline ? true : undefined}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="flex items-center gap-1.5 text-[13px] font-medium text-slate-800">
                        <span className="truncate">
                          {p.name}
                          {isMe && <span className="text-slate-400 font-normal"> (You)</span>}
                        </span>
                        {editableMembers && isOwner && (
                          <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
                            Group admin
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate capitalize">
                        {p.role || "member"}
                        {p.centre_name ? ` · ${p.centre_name}` : ""}
                      </p>
                    </div>
                    {canAct && (
                      <button
                        onClick={() => setMemberMenu(menuOpen ? null : p.staff_id)}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label={`Options for ${p.name}`}
                        aria-expanded={menuOpen}
                      >
                        <FiMoreHorizontal size={15} />
                      </button>
                    )}
                    {menuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMemberMenu(null)} />
                        <div className="absolute right-0 top-full z-20 -mt-1 w-48 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-200">
                          {onSetMemberRole && (
                            <button
                              onClick={() => {
                                setMemberMenu(null);
                                onSetMemberRole(p, isOwner ? "member" : "owner");
                              }}
                              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                            >
                              <FiShield size={14} className="text-slate-400" />
                              {isOwner ? "Dismiss as group admin" : "Make group admin"}
                            </button>
                          )}
                          {onRemoveMember && (
                            <button
                              onClick={() => {
                                setMemberMenu(null);
                                onRemoveMember(p);
                              }}
                              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-rose-600 hover:bg-rose-50"
                            >
                              <FiUserMinus size={14} />
                              Remove from group
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            {editableMembers && onLeaveGroup && (
              <button
                onClick={onLeaveGroup}
                className="mt-3 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-medium text-rose-600 hover:bg-rose-50"
              >
                <FiLogOut size={14} /> Leave group
              </button>
            )}
          </Section>
        )}

        {/* Tasks */}
        {!isWhatsApp && (
          <Section title="Tasks" icon={FiCheckSquare} count={relevantTasks.length}>
            {relevantTasks.length === 0 ? (
              <EmptyHint icon={FiCheckSquare} text="No tasks in this conversation" />
            ) : (
              <div className="space-y-2">
                {relevantTasks.map((task) => {
                  const done = task.status === "completed";
                  // Handed back / cancelled: closed with a note, can't be ticked
                  const closed = isClosedTask(task);
                  const declined = task.status === "declined";
                  // A service task completes when its entry is saved, not by ticking
                  const awaitingEntry = !done && !closed && isServiceTask(task) && !task.related_service_entry_id;
                  const canTick = !done && !closed && !awaitingEntry;
                  const isMine = String(task.assigned_to) === String(currentUser.id);
                  return (
                    <div key={task.id} className="flex items-start gap-3 rounded-xl ring-1 ring-slate-200 p-3">
                      <button
                        onClick={() => canTick && onCompleteTask && onCompleteTask(task)}
                        disabled={!canTick}
                        title={
                          done ? "Completed"
                            : closed ? (declined ? "Handed back" : "Cancelled")
                            : awaitingEntry ? "Completes when the service entry is saved"
                            : "Mark complete"
                        }
                        className={`mt-0.5 h-5 w-5 shrink-0 rounded-md flex items-center justify-center transition ${
                          done
                            ? "bg-emerald-500 text-white"
                            : closed
                            ? declined ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-600"
                            : awaitingEntry
                            ? "ring-1 ring-dashed ring-slate-300 text-transparent cursor-default"
                            : "ring-1 ring-slate-300 text-transparent hover:ring-emerald-500 hover:text-emerald-500"
                        }`}
                      >
                        {closed ? <FiX size={12} strokeWidth={3} /> : <FiCheck size={12} strokeWidth={3} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-[13px] font-medium truncate ${
                            done || closed ? "line-through text-slate-400" : "text-slate-800"
                          }`}
                          title={task.title}
                        >
                          {task.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                          {task.assigned_to_name && (
                            <span className="inline-flex items-center gap-1">
                              <FiUser size={10} /> {task.assigned_to_name}
                            </span>
                          )}
                          {task.due_date && (
                            <span className="inline-flex items-center gap-1">
                              <FiCalendar size={10} /> {formatShortDate(task.due_date)}
                            </span>
                          )}
                          <span
                            className={`rounded px-1.5 py-px font-semibold uppercase tracking-wide text-[9px] ring-1 ${priorityPill(
                              task.priority
                            )}`}
                          >
                            {task.priority || "normal"}
                          </span>
                          {closed && (
                            <span className={`rounded px-1.5 py-px font-semibold uppercase tracking-wide text-[9px] ${
                              declined ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-700"
                            }`}>
                              {declined ? "Handed back" : "Cancelled"}
                            </span>
                          )}
                        </div>
                        {closed && task.close_reason && (
                          <p className="mt-1 text-[11px] text-slate-500 line-clamp-2" title={task.close_reason}>
                            {task.close_reason}
                          </p>
                        )}
                        {awaitingEntry && isMine && (
                          <button
                            type="button"
                            onClick={() => startServiceEntry(navigate, task)}
                            className="mt-1.5 text-[11px] font-semibold text-indigo-700 hover:underline"
                          >
                            Start entry →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {/* Notes */}
        {!isWhatsApp && (
          <Section
            title="Notes"
            icon={FiStar}
            count={notes.length}
            action={
              onAddNote && (
                <button onClick={onAddNote} className="text-xs font-medium text-navy-700 hover:underline">
                  + Add
                </button>
              )
            }
          >
            {notes.length === 0 ? (
              <EmptyHint icon={FiStar} text="No notes yet" />
            ) : (
              <div className="space-y-2">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-xl bg-amber-50/60 ring-1 ring-amber-100 p-3">
                    <p className="text-[13px] font-semibold text-slate-800 truncate">{note.title || "Note"}</p>
                    <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap">{note.content}</p>
                    {note.origin_message_id && (
                      <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-amber-700">
                        <FiMessageSquare size={10} /> From a message
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* Files */}
        <Section title="Files" icon={FiFile} count={sharedFiles.length} defaultOpen={sharedFiles.length > 0}>
          {sharedFiles.length === 0 ? (
            <EmptyHint icon={FiFile} text="No files shared yet" />
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {sharedFiles.map((file) => {
                const url = file.fileUrl ? (file.fileUrl.startsWith("http") ? file.fileUrl : `${API_BASE_URL}${file.fileUrl}`) : null;
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => openFile(file)}
                    title={file.fileName || "File"}
                    className="relative h-[60px] overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-slate-600 transition hover:border-slate-300"
                  >
                    {file.messageType === "image" && url ? (
                      <img src={url} alt={file.fileName || "Image"} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full flex-col items-center justify-center gap-1 px-1.5">
                        <FiFile size={15} className="text-slate-400" aria-hidden="true" />
                        <span className="w-full truncate text-[10px]">{file.fileName || "File"}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </Section>

        <div className="h-6" />
      </div>
    </div>
  );
};

export default ConversationDetails;