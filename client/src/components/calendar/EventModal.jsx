// components/calendar/EventModal.jsx
import {
  FiX,
  FiCalendar,
  FiFlag,
  FiEye,
  FiUser,
  FiClock,
  FiEdit,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

export default function EventModal({
  event,
  onClose,
  onDelete,
  onUpdate,
  onEdit,
}) {
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
    task: "border-purple-200 bg-purple-50",
    default: "border-gray-200 bg-gray-50",
  };

  const borderColor =
    colorSets[event.event_type] ||
    (event.type === "task" ? colorSets.task : colorSets.default);

  const priorityColor = {
    high: "bg-red-100 text-red-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-green-100 text-green-700",
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border ${borderColor}`}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-black/5"
          >
            <FiX className="h-5 w-5 text-gray-400" />
          </button>

          {/* Title */}
          <h2 className="text-xl font-semibold text-gray-900 pr-8 mb-2">
            {event.title}
          </h2>

          {/* Status */}
          {event.status === "completed" && (
            <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">
              Completed
            </span>
          )}

          {/* Description */}
          {event.description && (
            <p className="text-gray-600 text-sm mt-3">
              {event.description}
            </p>
          )}

          {/* Details */}
          <div className="space-y-3 text-sm mt-4">
            {/* Date + Time */}
            <div className="flex items-center gap-2 text-gray-700">
              <FiCalendar className="h-4 w-4 text-gray-400" />
              <span>
                {event.start_datetime
                  ? new Date(event.start_datetime).toLocaleDateString()
                  : event.date}
              </span>
            </div>

            {event.start_datetime && (
              <div className="flex items-center gap-2 text-gray-700">
                <FiClock className="h-4 w-4 text-gray-400" />
                <span>
                  {new Date(event.start_datetime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {event.end_datetime &&
                    ` - ${new Date(event.end_datetime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`}
                </span>
              </div>
            )}

            {/* Event Type */}
            <div className="flex items-center gap-2 text-gray-700">
              <FiFlag className="h-4 w-4 text-gray-400" />
              <span>{eventTypeLabel}</span>
            </div>

            {/* Priority */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Priority:</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  priorityColor[event.priority] ||
                  "bg-gray-100 text-gray-600"
                }`}
              >
                {event.priority}
              </span>
            </div>

            {/* Visibility */}
            {event.visibility && (
              <div className="flex items-center gap-2 text-gray-700">
                <FiEye className="h-4 w-4 text-gray-400" />
                <span className="capitalize">{event.visibility}</span>
              </div>
            )}

            {/* Service */}
            {event.service_name && (
              <div className="flex items-center gap-2 text-gray-700">
                <span className="text-gray-500">Service:</span>
                <span>{event.service_name}</span>
              </div>
            )}

            {/* Assigned */}
            {event.assigned_to && (
              <div className="flex items-center gap-2 text-gray-700">
                <FiUser className="h-4 w-4 text-gray-400" />
                <span>{event.assigned_to}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-6 pt-4 border-t">
            {onEdit && (
              <button
                onClick={() => {
                  onEdit(event);
                  onClose();
                }}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm"
              >
                <FiEdit className="inline mr-1" /> Edit
              </button>
            )}

            {event.status !== "completed" && (
              <button
                onClick={() => {
                  onUpdate(event.id, { status: "completed" });
                  onClose();
                }}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm"
              >
                Complete
              </button>
            )}

            <button
              onClick={() => {
                onDelete(event.id);
                onClose();
              }}
              className="flex-1 bg-white border border-red-200 text-red-600 py-2 rounded-lg text-sm"
            >
              Delete
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}