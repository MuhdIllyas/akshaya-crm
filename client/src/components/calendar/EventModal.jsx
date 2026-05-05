// components/calendar/EventModal.jsx
export default function EventModal({ event, onClose, onDelete, onUpdate }) {
  if (!event) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">X</button>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">{event.title}</h2>
        <div className="space-y-3 text-sm">
          <p><span className="text-gray-500">Description:</span> {event.description || "N/A"}</p>
          <p><span className="text-gray-500">Date:</span> {event.start_datetime ? new Date(event.start_datetime).toLocaleString() : event.date}</p>
          <p><span className="text-gray-500">Event Type:</span> {event.event_type}</p>
          <p><span className="text-gray-500">Priority:</span> {event.priority}</p>
          <p><span className="text-gray-500">Visibility:</span> {event.visibility}</p>
          <p><span className="text-gray-500">Assigned to:</span> {event.assigned_to?.join(", ") || "None"}</p>
        </div>
        <div className="flex gap-2 mt-6">
          <button
            onClick={() => onUpdate(event.id, { status: "completed" })}
            className="flex-1 bg-green-600 text-white py-2 rounded-md text-sm font-medium"
          >
            Mark Complete
          </button>
          <button
            onClick={() => {
              onDelete(event.id);
              onClose();
            }}
            className="flex-1 bg-red-600 text-white py-2 rounded-md text-sm font-medium"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}