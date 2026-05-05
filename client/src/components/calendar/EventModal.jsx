// components/calendar/EventModal.jsx
import { FiX, FiCalendar, FiFlag, FiEye } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

export default function EventModal({ event, onClose, onDelete, onUpdate }) {
  if (!event) return null;

  const getEventTypeLabel = () => {
    switch (event.event_type) {
      case "deadline": return "Deadline";
      case "start": return "Start";
      case "expiry": return "Expiry";
      case "announcement": return "Announcement";
      default: return "Event";
    }
  };

  const bgColor = {
    deadline: "bg-red-50 border-red-200",
    start: "bg-green-50 border-green-200",
    expiry: "bg-yellow-50 border-yellow-200",
    announcement: "bg-blue-50 border-blue-200",
  }[event.event_type] || "bg-gray-50 border-gray-200";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className={`bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border ${bgColor}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">{event.title}</h2>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
              <FiX className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="space-y-3 text-sm">
            <p className="flex items-start gap-2">
              <span className="font-medium text-gray-500">Description:</span>
              <span className="text-gray-700">{event.description || "N/A"}</span>
            </p>
            <p className="flex items-center gap-2">
              <FiCalendar className="h-4 w-4 text-gray-400" />
              <span className="font-medium text-gray-500">Date:</span>
              <span className="text-gray-700">
                {event.start_datetime
                  ? new Date(event.start_datetime).toLocaleString()
                  : event.date}
              </span>
            </p>
            <p className="flex items-center gap-2">
              <FiFlag className="h-4 w-4 text-gray-400" />
              <span className="font-medium text-gray-500">Type:</span>
              <span className="text-gray-700 capitalize">
                {getEventTypeLabel()}
              </span>
            </p>
            <p className="flex items-center gap-2">
              <span className="font-medium text-gray-500">Priority:</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                event.priority === "high"
                  ? "bg-red-100 text-red-700"
                  : event.priority === "medium"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-green-100 text-green-700"
              }`}>
                {event.priority}
              </span>
            </p>
            {event.visibility && (
              <p className="flex items-center gap-2">
                <FiEye className="h-4 w-4 text-gray-400" />
                <span className="font-medium text-gray-500">Visibility:</span>
                <span className="text-gray-700 capitalize">{event.visibility}</span>
              </p>
            )}
            {event.assigned_to && event.assigned_to.length > 0 && (
              <p className="flex items-center gap-2">
                <span className="font-medium text-gray-500">Assigned to:</span>
                <span className="text-gray-700">
                  {event.assigned_to.join(", ")}
                </span>
              </p>
            )}
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={() => onUpdate(event.id, { status: "completed" })}
              className="flex-1 bg-green-600 text-white py-2 rounded-md text-sm font-medium hover:bg-green-700"
            >
              Mark Complete
            </button>
            <button
              onClick={() => {
                onDelete(event.id);
                onClose();
              }}
              className="flex-1 bg-red-600 text-white py-2 rounded-md text-sm font-medium hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}