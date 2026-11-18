import React, { useState } from "react";
import { FiCheckSquare, FiClock, FiUser } from "react-icons/fi";
import StaffName from "@/components/staff/StaffName";

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

export const TaskCardShell = ({ title, completed, meta, onComplete, completing }) => (
  <div className="w-full max-w-sm bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-3.5">
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ${completed ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-navy-700"}`}>
        <FiCheckSquare size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Task</p>
        <h4 className={`text-sm font-semibold leading-snug ${completed ? "line-through text-slate-400" : "text-slate-900"}`}>{title}</h4>
        <div className="mt-1 space-y-0.5 text-xs text-slate-500">{meta}</div>
      </div>
    </div>
    <div className="mt-3 flex justify-end">
      {completed ? (
        <span className="text-xs font-medium text-emerald-600">✓ Completed</span>
      ) : (
        <button
          onClick={onComplete}
          disabled={completing}
          className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition disabled:opacity-50"
        >
          {completing ? "Saving…" : "Mark complete"}
        </button>
      )}
    </div>
  </div>
);

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
      meta={
        <>
          {assignee && <p className="flex items-center gap-1"><FiUser size={11} /> {assignee}</p>}
          {dueDate && <p className="flex items-center gap-1"><FiClock size={11} /> {dueDate}</p>}
        </>
      }
    />
  );
};

// Normal task shared into a chat
export const NormalTaskMessage = ({ taskId, taskData, onStatusUpdate }) => {
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

  return (
    <TaskCardShell
      title={taskData.title}
      completed={completed}
      completing={completing}
      onComplete={handleComplete}
      meta={
        <>
          <p className="capitalize">
            {taskData.priority || "medium"} priority · {String(taskData.status || "pending").replace("_", " ")}
          </p>
          {taskData.assigned_to && (
            <p className="flex items-center gap-1">
              <FiUser size={11} />{" "}
              <StaffName id={taskData.assigned_to} name={taskData.assigned_to_name} showDot={false} fallback="Assigned staff" />
            </p>
          )}
          {taskData.due_date && <p className="flex items-center gap-1"><FiClock size={11} /> {formatDate(taskData.due_date)}</p>}
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
  return <NormalTaskMessage taskId={task.id} taskData={task} onStatusUpdate={toggle} />;
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
