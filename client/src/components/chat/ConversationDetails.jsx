import React, { useState } from "react";
import {
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
} from "react-icons/fi";
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
} from "./chatUtils";

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
}) => {
  if (!conversation) return null;

  const name = getConversationDisplayName(conversation, currentUser.id);
  const others = getOtherParticipants(conversation, currentUser.id);
  const isGroup = isGroupConversation(conversation, currentUser.id);
  const isWhatsApp = conversation.channel === "whatsapp";
  const isService = conversation.context_type === "service_entry";
  const onlineOthers = others.filter((p) => onlineUsers.has(String(p.staff_id)));
  const singleOnline = !isGroup && !isWhatsApp ? onlineOthers.length > 0 : undefined;

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

      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Profile */}
        <div className="px-5 py-6 flex flex-col items-center text-center">
          <ChatAvatar
            name={name}
            photo={getConversationPhoto(conversation, currentUser.id)}
            size="xl"
            color={isWhatsApp ? "bg-emerald-600" : conversation.avatarColor || getAvatarColor(conversation.id)}
            isGroup={isGroup}
            icon={isWhatsApp ? FiSmartphone : undefined}
            online={singleOnline}
          />
          <h3 className="mt-3 text-base font-semibold text-slate-900 break-words">{name}</h3>
          <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-1">
            {!isGroup && !isWhatsApp && others[0]?.centre_name && <FiMapPin size={11} />}
            {subtitle}
          </p>

          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {isWhatsApp && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2 py-0.5 text-[11px] font-medium">
                <FiSmartphone size={10} /> WhatsApp
              </span>
            )}
            {isService && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 text-violet-700 ring-1 ring-violet-200 px-2 py-0.5 text-[11px] font-medium">
                <FiBriefcase size={10} /> Service
              </span>
            )}
            {!isGroup && !isWhatsApp && (
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
                        {serviceDetails.assigned_staff_name || serviceDetails.staff_name || "Unassigned"}
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
          <Section title="Members" icon={FiUsers} count={conversation.participants?.length || 0} defaultOpen={isGroup}>
            <div className="space-y-1">
              {(conversation.participants || []).map((p, i) => {
                const isOnline = onlineUsers.has(String(p.staff_id));
                const isMe = String(p.staff_id) === String(currentUser.id);
                return (
                  <div key={`${p.staff_id}-${i}`} className="flex items-center gap-3 py-1.5">
                    <ChatAvatar
                      name={p.name}
                      photo={getAvatarUrl(p.photo)}
                      size="sm"
                      color="bg-slate-400"
                      online={isOnline ? true : undefined}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-slate-800 truncate">
                        {p.name}
                        {isMe && <span className="text-slate-400 font-normal"> (You)</span>}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate capitalize">
                        {p.role || "member"}
                        {p.centre_name ? ` · ${p.centre_name}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
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
                  return (
                    <div key={task.id} className="flex items-start gap-3 rounded-xl ring-1 ring-slate-200 p-3">
                      <button
                        onClick={() => !done && onCompleteTask && onCompleteTask(task)}
                        disabled={done}
                        title={done ? "Completed" : "Mark complete"}
                        className={`mt-0.5 h-5 w-5 shrink-0 rounded-md flex items-center justify-center transition ${
                          done
                            ? "bg-emerald-500 text-white"
                            : "ring-1 ring-slate-300 text-transparent hover:ring-emerald-500 hover:text-emerald-500"
                        }`}
                      >
                        <FiCheck size={12} strokeWidth={3} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-[13px] font-medium truncate ${
                            done ? "line-through text-slate-400" : "text-slate-800"
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
                        </div>
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