// components/calendar/CreateEventModal.jsx
import { useState } from "react";
import { FiX } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

export default function CreateEventModal({ onSave, onClose, initialData }) {
  const [form, setForm] = useState(
    initialData || {
      title: "",
      description: "",
      date: "",
      start_datetime: "",
      end_datetime: "",
      type: "working",        // matches your existing types
      event_type: "start",
      priority: "medium",
      visibility: "centre",
      assigned_to: [],
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

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
          className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              {initialData ? "Edit Event" : "Add Event"}
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
              <FiX className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 text-sm">
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
              placeholder="Description"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                className="border border-gray-200 rounded-lg px-3 py-2"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
              <input
                type="time"
                className="border border-gray-200 rounded-lg px-3 py-2"
                value={form.start_datetime ? form.start_datetime.split("T")[1]?.substring(0,5) : ""}
                onChange={(e) => {
                  const date = form.date || new Date().toISOString().split("T")[0];
                  setForm({ ...form, start_datetime: `${date}T${e.target.value}` });
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                className="border border-gray-200 rounded-lg px-3 py-2"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="working">Working Day</option>
                <option value="holiday">Holiday</option>
                <option value="weekend">Weekend</option>
                <option value="task">Task</option>
              </select>
              <select
                className="border border-gray-200 rounded-lg px-3 py-2"
                value={form.event_type}
                onChange={(e) => setForm({ ...form, event_type: e.target.value })}
              >
                <option value="start">Start</option>
                <option value="deadline">Deadline</option>
                <option value="expiry">Expiry</option>
                <option value="announcement">Announcement</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                className="border border-gray-200 rounded-lg px-3 py-2"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <select
                className="border border-gray-200 rounded-lg px-3 py-2"
                value={form.visibility}
                onChange={(e) => setForm({ ...form, visibility: e.target.value })}
              >
                <option value="centre">Centre</option>
                <option value="global">Global</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
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