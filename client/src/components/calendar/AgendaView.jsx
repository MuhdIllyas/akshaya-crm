// components/calendar/AgendaView.jsx
import { format } from "date-fns"; // optional, you can use any date library

export default function AgendaView({ events, onEventClick }) {
  // Group events by date
  const grouped = events.reduce((acc, ev) => {
    const date = ev.start_datetime || ev.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(ev);
    return acc;
  }, {});

  // Sort dates ascending, today first
  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-600">Agenda</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {sortedDates.map((date) => (
          <div key={date} className="p-3">
            <div className="text-xs font-medium text-gray-400 mb-2">
              {formatDate(date)}
            </div>
            {grouped[date].map((ev) => (
              <div
                key={ev.id}
                onClick={() => onEventClick(ev)}
                className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer"
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: getColor(ev) }}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{ev.title}</p>
                  <p className="text-xs text-gray-500">{ev.event_type} · {ev.priority}</p>
                </div>
                <span className="text-xs text-gray-400">
                  {formatTime(ev.start_datetime)}
                </span>
              </div>
            ))}
          </div>
        ))}
        {events.length === 0 && (
          <p className="p-4 text-sm text-gray-400 text-center">No events found</p>
        )}
      </div>
    </div>
  );
}

// Helper functions (replace with date-fns or Intl.DateTimeFormat)
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}
function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function getColor(event) {
  if (event.event_type === "deadline") return "#ef4444";
  if (event.event_type === "start") return "#22c55e";
  if (event.event_type === "announcement") return "#3b82f6";
  if (event.type === "task") return "#f59e0b";
  return "#6b7280";
}