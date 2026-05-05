// components/calendar/EventModal.jsx
import { FiX, FiCalendar, FiFlag, FiEye, FiUser } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

export default function EventModal({ event, onClose, onDelete, onUpdate }) {
  if (!event) return null;

  const eventTypeLabel = {
    deadline: "Deadline",
    start: "Start",
    expiry: "Expiry",
    announcement: "Announcement",
  }[event.event_type] || "Event";

  const colorSets = {
    deadline: "border-red-200 bg-red-50",
    start: "border-green-200 bg-green-50",
    expiry: "border-yellow-200 bg-yellow-50",
    announcement: "border-blue-200 bg-blue-50",
    task: "border-orange-200 bg-orange-50",
    default: "border-gray-200 bg-gray-50",
  };
  const borderColor = colorSets[event.event_type] || (event.type === "task" ? colorSets.task : colorSets.default);

  const priorityColor = {
    high: "bg-red-100 text-red-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-green-100 text-green-700",
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border ${borderColor}`}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-black/5 transition"
          >
            <FiX className="h-5 w-5 text-gray-400" />
          </button>

          {/* Title */}
          <h2 className="text-xl font-semibold text-gray-900 pr-8 mb-4">{event.title}</h2>

          {/* Details */}
          <div className="space-y-3 text-sm">
            {event.description && (
              <p className="text-gray-600 leading-relaxed">{event.description}</p>
            )}
            <div className="flex items-center gap-2 text-gray-700">
              <FiCalendar className="h-4 w-4 text-gray-400" />
              <span>
                {event.start_datetime
                  ? new Date(event.start_datetime).toLocaleString("en-US", {
                      dateStyle: "full",
                      timeStyle: "short",
                    })
                  : event.date || "—"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <FiFlag className="h-4 w-4 text-gray-400" />
              <span>{eventTypeLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Priority:</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColor[event.priority] || "bg-gray-100 text-gray-600"}`}>
                {event.priority}
              </span>
            </div>
            {event.visibility && (
              <div className="flex items-center gap-2 text-gray-700">
                <FiEye className="h-4 w-4 text-gray-400" />
                <span className="capitalize">{event.visibility}</span>
              </div>
            )}
            {event.assigned_to?.length > 0 && (
              <div className="flex items-start gap-2 text-gray-700">
                <FiUser className="h-4 w-4 mt-0.5 text-gray-400" />
                <span>{event.assigned_to.join(", ")}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                onUpdate(event.id, { status: "completed" });
                onClose();
              }}
              className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 active:bg-green-800 transition"
            >
              Mark Complete
            </button>
            <button
              onClick={() => {
                onDelete(event.id);
                onClose();
              }}
              className="flex-1 bg-white border border-red-200 text-red-600 py-2.5 rounded-lg text-sm font-medium hover:bg-red-50 active:bg-red-100 transition"
            >
              Delete
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}