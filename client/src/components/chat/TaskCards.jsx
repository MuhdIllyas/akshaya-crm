import React, { useState } from "react";
import { FiCheckSquare } from "react-icons/fi";
import StaffName from "@/components/staff/StaffName";
import { TaskActionButtons, TaskCloseNote, isServiceTask, isClosedTask, serviceLabel } from "@/components/tasks/ServiceTaskBits";

// Helper to format date for task due dates
const formatDate = (dateString) => {
  if (!dateString) return "No due date";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid date";
    return date.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "Invalid date";
  }
};

/* ══════════════════════════════════════════════════════════════
   Task cards
   ══════════════════════════════════════════════════════════════ */

const STATUS_PILL = {
  pending: ["Pending", "bg-amber-100 text-amber-800"],
  in_progress: ["In progress", "bg-sky-100 text-sky-800"],
  completed: ["Completed", "bg-emerald-100 text-emerald-800"],
  declined: ["Handed back", "bg-amber-100 text-amber-800"],
  cancelled: ["Cancelled", "bg-rose-100 text-rose-700"],
};

const Pill = ({ className, children }) => (
  <span className={`inline-flex h-[18px] items-center rounded-full px-2 text-[10px] font-semibold ${className}`}>{children}</span>
);

// Card for a task in a chat: kind + status pills, title, one line of details, actions.
export const TaskCardShell = ({ title, completed, meta, onComplete, completing, footer, kind = "Task", status }) => {
  const [statusLabel, statusClass] = STATUS_PILL[status || (completed ? "completed" : "pending")] || STATUS_PILL.pending;
  return (
    <div className="w-[340px] max-w-full rounded-[14px] bg-white p-3.5 ring-1 ring-slate-200 shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill className={kind === "Service task" ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-700"}>{kind}</Pill>
        <Pill className={statusClass}>{statusLabel}</Pill>
      </div>
      <h4 className={`mt-2 text-sm font-semibold leading-snug ${completed ? "line-through text-slate-400" : "text-slate-900"}`}>{title}</h4>
      <div className="mt-1 space-y-0.5 text-xs text-slate-500">{meta}</div>
      <div className="mt-2.5 flex justify-end">
        {footer ? footer : completed ? null : (
          <button
            onClick={onComplete}
            disabled={completing}
            className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {completing ? "Saving…" : "Mark complete"}
          </button>
        )}
      </div>
    </div>
  );
};

// Service task card (system message with task id in fileName)
export const TaskMessage = ({ taskId, text, taskData, onStatusUpdate }) => {
  const [completing, setCompleting] = useState(false);
  const completed = taskData?.status === "completed";

  const handleComplete = async () => {
    if (completing || completed) return;
    setCompleting(true);
    try {
      if (onStatusUpdate) await onStatusUpdate(taskId, "completed");
    } catch {
      // Error toast is handled by parent
    } finally {
      setCompleting(false);
    }
  };

  const match = text.match(/📋 Task created: "(.*?)" assigned to (.*?)\. Due: (.*?)(\.|$)/);
  const title = match ? match[1] : text.replace(/^📋 Task created: /, "").replace(/\.$/, "");
  const assignee = match ? match[2] : "";
  const dueDate = match ? match[3] : "";

  return (
    <TaskCardShell
      title={title}
      completed={completed}
      completing={completing}
      onComplete={handleComplete}
      status={taskData?.status}
      meta={[assignee && `Assigned to ${assignee}`, dueDate && `due ${dueDate}`].filter(Boolean).join(" · ") || null}
    />
  );
};

// Normal task shared into a chat
export const NormalTaskMessage = ({ taskId, taskData, onStatusUpdate, onTaskChanged }) => {
  const [completing, setCompleting] = useState(false);
  const completed = taskData?.status === "completed";

  const handleComplete = async () => {
    if (completing || completed) return;
    setCompleting(true);
    try {
      if (onStatusUpdate) await onStatusUpdate(taskId, taskData.status);
    } catch {
      // parent handles the error toast
    } finally {
      setCompleting(false);
    }
  };

  // Service tasks are completed by saving the entry; closed tasks show their note.
  const special = isServiceTask(taskData) || isClosedTask(taskData);
  const footer = special && !completed ? (
    <div className="w-full space-y-1.5">
      <TaskCloseNote task={taskData} />
      <div className="flex justify-end">
        <TaskActionButtons
          task={taskData}
          currentUser={{ id: localStorage.getItem("id"), role: localStorage.getItem("role")?.trim()?.toLowerCase() }}
          onChanged={(t) => t && onTaskChanged?.(t)}
          compact
        />
      </div>
    </div>
  ) : null;

  return (
    <TaskCardShell
      title={taskData.title}
      completed={completed}
      completing={completing}
      onComplete={handleComplete}
      footer={footer}
      kind={isServiceTask(taskData) ? "Service task" : "Task"}
      status={taskData.status}
      meta={
        <>
          {isServiceTask(taskData) && (
            <p className="font-medium text-violet-700">
              {[serviceLabel(taskData), taskData.customer_name].filter(Boolean).join(" · ") || "Service"}
            </p>
          )}
          <p>
            {taskData.assigned_to && (
              <>
                Assigned to{" "}
                <StaffName id={taskData.assigned_to} name={taskData.assigned_to_name} showDot={false} fallback="staff" />
              </>
            )}
            {taskData.due_date && ` · due ${formatDate(taskData.due_date)}`}
            {` · ${taskData.priority || "medium"} priority`}
          </p>
        </>
      }
    />
  );
};

/**
 * A task card that handles its own "Mark complete", for places outside the
 * Messenger (the floating staff chat). Same look as NormalTaskMessage.
 */
export const LiveTaskCard = ({ task: initial }) => {
  const [task, setTask] = useState(initial);
  const toggle = async (taskId, currentStatus) => {
    const status = currentStatus === "completed" ? "pending" : "completed";
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/tasks/${taskId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error(`Task update failed: ${res.status}`);
    setTask((t) => ({ ...t, status }));
  };
  if (!task) return null;
  return <NormalTaskMessage taskId={task.id} taskData={task} onStatusUpdate={toggle} onTaskChanged={setTask} />;
};

// Shown at the start of a message that replies about a task (a "task" mention).
// display_text is the task title as it was when the message was sent.
export const TaskReplyChip = ({ text, isOwn }) => (
  <span
    className={`mb-1 inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
      isOwn ? "bg-white/15 text-white" : "bg-blue-50 text-navy-700"
    }`}
    title="About this task"
  >
    <FiCheckSquare size={11} className="shrink-0" />
    <span className="truncate">{String(text || "").replace(/^Task:\s*/, "")}</span>
  </span>
);
