// components/calendar/CreateEventModal.jsx
import { useState } from "react";

export default function CreateEventModal({ onSave, onClose }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    start_datetime: "",
    end_datetime: "",
    type: "service",
    event_type: "announcement",
    priority: "medium",
    visibility: "centre",
    assigned_to: [],
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Create Event</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <input className="border rounded px-3 py-1.5 col-span-2" placeholder="Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
          <textarea className="border rounded px-3 py-1.5 col-span-2" placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          <input type="date" className="border rounded px-3 py-1.5" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
          <input type="datetime-local" className="border rounded px-3 py-1.5" value={form.start_datetime} onChange={e => setForm({...form, start_datetime: e.target.value})} />
          <input type="datetime-local" className="border rounded px-3 py-1.5" value={form.end_datetime} onChange={e => setForm({...form, end_datetime: e.target.value})} />
          <select className="border rounded px-3 py-1.5" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
            <option value="application">Application</option>
            <option value="task">Task</option>
            <option value="service">Service</option>
          </select>
          <select className="border rounded px-3 py-1.5" value={form.event_type} onChange={e => setForm({...form, event_type: e.target.value})}>
            <option value="start">Start</option>
            <option value="deadline">Deadline</option>
            <option value="expiry">Expiry</option>
            <option value="announcement">Announcement</option>
          </select>
          <select className="border rounded px-3 py-1.5" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <select className="border rounded px-3 py-1.5" value={form.visibility} onChange={e => setForm({...form, visibility: e.target.value})}>
            <option value="centre">Centre</option>
            <option value="global">Global</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium">Save</button>
        </div>
      </form>
    </div>
  );
}