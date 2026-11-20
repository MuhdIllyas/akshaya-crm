import React, { useState } from "react";
import { FiGlobe,
  FiX,
  FiUsers,
  FiBriefcase,
  FiFile,
  FiImage,
  FiDownload,
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
  FiChevronDown,
  FiExternalLink,
  FiTag,
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
} from "./chatUtils";
import StaffName from '@/components/staff/StaffName';
import { useNavigate } from "react-router-dom";
import { isServiceTask, isClosedTask, startServiceEntry } from "@/components/tasks/ServiceTaskBits";

/* ---------------- small building blocks ---------------- */

const Section = ({ title, icon: Icon, count, action, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-t border-slate-100">
      <div className="flex items-center justify-between px-5 py-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 hover:text-slate-900"
        >
          {Icon && <Icon className="text-slate-400" size={14} />}
          {title}
          {count > 0 && <span className="text-[11px] font-medium text-slate-400">{count}</span>}
          <FiChevronDown className={`text-slate-400 transition-transform ${open ? "" : "-rotate-90"}`} size={14} />
        </button>
        {action}
      </div>
      {open && <div className="px-5 pb-4">{children}</div>}
    </section>
  );
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
}) => {
  const navigate = useNavigate();
  const [memberMenu, setMemberMenu] = useState(null); // staff_id whose menu is open
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  if (!conversation) return null;

  const editableMembers = hasEditableMembers(conversation);
  const canManageMembers = isGroupAdmin(conversation, currentUser);
  const saveRename = async () => {
    const value = newName.trim();
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

  const subtitle = isWhatsApp
    ? conversation.context_identifier || "WhatsApp"
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
      <div className="shrink-0 h-14 flex items-center justify-between px-4 border-b border-slate-100">
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
        <div className="px-5 py-6 flex flex-col items-center text-center">
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
                aria-label="Group name"
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
              {canManageMembers && onRenameGroup && (
                <button
                  onClick={() => {
                    setNewName(conversation.name || name);
                    setRenaming(true);
                  }}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-navy-700"
                  title="Rename group"
                  aria-label="Rename group"
                >
                  <FiEdit2 size={13} />
                </button>
              )}
            </h3>
          )}
          <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-1">
            {!isGroup && !isExternal && others[0]?.centre_name && <FiMapPin size={11} />}
            {subtitle}
          </p>

          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {isWhatsApp && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2 py-0.5 text-[11px] font-medium">
                <FiSmartphone size={10} /> WhatsApp
              </span>
            )}
            {isTeam && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-navy-700 ring-1 ring-blue-200 px-2 py-0.5 text-[11px] font-medium">
                <FiUsers size={10} /> Team chat
              </span>
            )}
            {isService && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 text-violet-700 ring-1 ring-violet-200 px-2 py-0.5 text-[11px] font-medium">
                <FiBriefcase size={10} /> Service
              </span>
            )}
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

          {/* Your tags */}
          {onOpenTagPicker && (
            <div className="mt-4 flex w-full flex-wrap items-center justify-center gap-1.5">
              {conversationTags.map((l) => (
                <button
                  key={l.id}
                  onClick={onOpenTagPicker}
                  className={`inline-flex max-w-[160px] items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${tagColor(l.color).chip}`}
                  title={`Tagged "${l.name}"`}
                >
                  <FiTag size={10} className="shrink-0" />
                  <span className="truncate">{l.name}</span>
                </button>
              ))}
              <button
                onClick={onOpenTagPicker}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-dashed ring-slate-300 hover:text-navy-700 hover:ring-slate-400"
              >
                <FiTag size={10} /> {conversationTags.length ? "Edit tags" : "Add tag"}
              </button>
            </div>
          )}

          {/* Assignment (WhatsApp / customer chats) */}
          {(isWhatsApp || conversation.context_type === "customer") && onAssign && (
            <div className="mt-4 w-full text-left">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Assigned to</label>
              <select
                value={conversation.assigned_staff_id || ""}
                onChange={(e) => onAssign(e.target.value)}
                className="w-full h-9 rounded-lg bg-slate-50 border border-slate-200 px-2.5 text-sm text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-slate-300"
              >
                <option value="">Unassigned</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.role ? `(${s.role})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

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
            <div className="space-y-1">
              {sharedFiles.map((file) => (
                <button
                  key={file.id}
                  onClick={() => openFile(file)}
                  className="w-full flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 text-left transition"
                >
                  <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                    {file.messageType === "image" ? <FiImage size={16} /> : <FiFile size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-800 truncate">{file.fileName || "File"}</p>
                    <p className="text-[11px] text-slate-400">
                      {file.fileSize ? `${(file.fileSize / 1024).toFixed(1)} KB` : file.time}
                    </p>
                  </div>
                  <FiDownload className="text-slate-400" size={14} />
                </button>
              ))}
            </div>
          )}
        </Section>

        <div className="h-6" />
      </div>
    </div>
  );
};

export default ConversationDetails;