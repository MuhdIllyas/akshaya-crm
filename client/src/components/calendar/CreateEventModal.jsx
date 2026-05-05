// components/calendar/CreateEventModal.jsx
import { useState } from "react";
import { FiX, FiCalendar, FiClock } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

export default function CreateEventModal({
  onSave,
  onClose,
  initialData,
  services = [],
  staffList = [],
  userRole = "admin",
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState(
    initialData || {
      title: "",
      description: "",
      date: today,
      start_datetime: `${today}T09:00`,
      end_datetime: `${today}T17:00`,

      type: "task", // application / task / service / holiday
      event_type: "deadline",

      priority: "medium",
      visibility: "centre",

      service_id: "",
      assigned_to: "",
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.title.trim()) return;

    if (
      form.start_datetime &&
      form.end_datetime &&
      new Date(form.end_datetime) < new Date(form.start_datetime)
    ) {
      alert("End time cannot be before start time");
      return;
    }

    onSave(form);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">
              {initialData ? "Edit Event" : "Create Event"}
            </h2>
            <button onClick={onClose}>
              <FiX />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <input
              className="w-full border p-2 rounded"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />

            {/* Description */}
            <textarea
              className="w-full border p-2 rounded"
              placeholder="Description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />

            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm({ ...form, date: e.target.value })
                }
              />

              <div className="flex gap-2">
                <input
                  type="time"
                  value={form.start_datetime.split("T")[1]}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      start_datetime: `${form.date}T${e.target.value}`,
                    })
                  }
                />
                <input
                  type="time"
                  value={form.end_datetime.split("T")[1]}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      end_datetime: `${form.date}T${e.target.value}`,
                    })
                  }
                />
              </div>
            </div>

            {/* TYPE */}
            <select
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value })
              }
            >
              <option value="application">Application</option>
              <option value="task">Task</option>
              <option value="service">Service</option>
              <option value="holiday">Holiday</option>
            </select>

            {/* EVENT TYPE */}
            <select
              value={form.event_type}
              onChange={(e) =>
                setForm({ ...form, event_type: e.target.value })
              }
            >
              <option value="start">Start</option>
              <option value="deadline">Deadline</option>
              <option value="expiry">Expiry</option>
              <option value="announcement">Announcement</option>
            </select>

            {/* SERVICE LINK */}
            <select
              value={form.service_id}
              onChange={(e) =>
                setForm({ ...form, service_id: e.target.value })
              }
            >
              <option value="">No Service</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* ASSIGN STAFF */}
            <select
              value={form.assigned_to}
              onChange={(e) =>
                setForm({ ...form, assigned_to: e.target.value })
              }
            >
              <option value="">Unassigned</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* PRIORITY */}
            <select
              value={form.priority}
              onChange={(e) =>
                setForm({ ...form, priority: e.target.value })
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>

            {/* VISIBILITY */}
            {userRole === "superadmin" && (
              <select
                value={form.visibility}
                onChange={(e) =>
                  setForm({ ...form, visibility: e.target.value })
                }
              >
                <option value="centre">Centre</option>
                <option value="global">Global</option>
              </select>
            )}

            {/* Buttons */}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose}>
                Cancel
              </button>
              <button type="submit">
                {initialData ? "Update" : "Save"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}