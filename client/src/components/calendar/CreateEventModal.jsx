// components/calendar/CreateEventModal.jsx
import { useState } from "react";
import { FiX, FiCalendar, FiClock } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

export default function CreateEventModal({ onSave, onClose, initialData }) {
  const [form, setForm] = useState(
    initialData || {
      title: "",
      description: "",
      date: new Date().toISOString().slice(0, 10),
      start_datetime: `${new Date().toISOString().slice(0, 10)}T09:00`,
      end_datetime: `${new Date().toISOString().slice(0, 10)}T17:00`,
      type: "working",
      event_type: "start",
      priority: "medium",
      visibility: "centre",
      assigned_to: [],
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;
    onSave({ ...form });
    onClose();
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
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {initialData ? "Edit Event" : "Add Event"}
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
              <FiX className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
              <input
                autoFocus
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Event title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <textarea
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Brief description"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date *</label>
                <div className="relative">
                  <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="date"
                    className="w-full pl-9 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    value={form.date}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setForm(prev => ({
                        ...prev,
                        date: newDate,
                        start_datetime: prev.start_datetime
                          ? `${newDate}T${prev.start_datetime.split("T")[1] || "09:00"}`
                          : `${newDate}T09:00`,
                        end_datetime: prev.end_datetime
                          ? `${newDate}T${prev.end_datetime.split("T")[1] || "17:00"}`
                          : `${newDate}T17:00`,
                      }));
                    }}
                    required
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Start</label>
                  <div className="relative">
                    <FiClock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="time"
                      className="w-full pl-9 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      value={form.start_datetime ? form.start_datetime.split("T")[1]?.slice(0, 5) : "09:00"}
                      onChange={(e) => {
                        const date = form.date || new Date().toISOString().slice(0, 10);
                        setForm({ ...form, start_datetime: `${date}T${e.target.value}` });
                      }}
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">End</label>
                  <div className="relative">
                    <FiClock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="time"
                      className="w-full pl-9 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      value={form.end_datetime ? form.end_datetime.split("T")[1]?.slice(0, 5) : "17:00"}
                      onChange={(e) => {
                        const date = form.date || new Date().toISOString().slice(0, 10);
                        setForm({ ...form, end_datetime: `${date}T${e.target.value}` });
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="working">Working Day</option>
                  <option value="holiday">Holiday</option>
                  <option value="weekend">Weekend</option>
                  <option value="task">Task</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Event Type</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={form.event_type}
                  onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                >
                  <option value="start">Start</option>
                  <option value="deadline">Deadline</option>
                  <option value="expiry">Expiry</option>
                  <option value="announcement">Announcement</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Visibility</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={form.visibility}
                  onChange={(e) => setForm({ ...form, visibility: e.target.value })}
                >
                  <option value="centre">Centre</option>
                  <option value="global">Global</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 active:bg-indigo-800 transition"
              >
                {initialData ? "Update" : "Save"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}