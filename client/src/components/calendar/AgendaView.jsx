// components/calendar/AgendaView.jsx
import { useMemo } from "react";
import { FiCalendar, FiUser, FiEdit, FiTrash2, FiClock } from "react-icons/fi";

export default function AgendaView({ calendarData = [], leavesData = [], onEventClick, onEdit, onDelete }) {
  const allItems = useMemo(() => {
    const items = [];
    calendarData.forEach(e => {
      const date = e.date || e.start_datetime?.split("T")[0];
      items.push({ ...e, itemType: "event", sortDate: date });
    });
    leavesData
      .filter(l => l.status === "approved")
      .forEach(l => {
        items.push({ ...l, itemType: "leave", sortDate: l.from_date?.split("T")[0] });
      });
    return items.sort((a, b) => new Date(a.sortDate) - new Date(b.sortDate));
  }, [calendarData, leavesData]);

  const grouped = useMemo(() => {
    const map = {};
    allItems.forEach(item => {
      const key = item.sortDate || "unknown";
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [allItems]);

  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));

  const eventTypeStyles = {
    working: { bg: "bg-green-50 border-green-200", dot: "bg-green-500", label: "Working Day" },
    holiday: { bg: "bg-red-50 border-red-200", dot: "bg-red-500", label: "Holiday" },
    weekend: { bg: "bg-gray-100 border-gray-200", dot: "bg-gray-500", label: "Weekend" },
    task:    { bg: "bg-purple-50 border-purple-200", dot: "bg-purple-500", label: "Task" },
    default: { bg: "bg-white border-gray-200", dot: "bg-gray-300", label: "Event" },
  };

  if (sortedDates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <FiCalendar className="h-12 w-12 mb-4 text-gray-200" />
        <p className="text-sm">No events or approved leaves this month</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedDates.map(date => (
        <div key={date}>
          {/* Date Header */}
          <div className="flex items-center mb-3">
            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shadow-sm">
              {new Date(date).getDate()}
            </div>
            <span className="ml-3 text-sm font-semibold text-gray-700 capitalize">
              {new Date(date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </span>
            {date === new Date().toISOString().slice(0, 10) && (
              <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">Today</span>
            )}
          </div>

          {/* Items */}
          <div className="ml-10 space-y-2">
            {grouped[date].map((item, idx) => {
              if (item.itemType === "leave") {
                return (
                  <div
                    key={`leave-${item.id}-${idx}`}
                    className="flex items-center gap-2 p-2 rounded-lg bg-yellow-50 border border-yellow-200 text-sm"
                  >
                    <FiUser className="h-4 w-4 text-yellow-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800">{item.staff_name || item.user_name || "Staff"}</span>
                      <span className="text-xs text-gray-500 ml-1">
                        Leave: {new Date(item.from_date).toLocaleDateString()} – {new Date(item.to_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              }

              // Event item
              const style = eventTypeStyles[item.type] || eventTypeStyles.default;
              return (
                <div
                  key={`ev-${item.id}-${idx}`}
                  onClick={() => onEventClick(item)}
                  className="group flex items-center justify-between p-2.5 rounded-lg border bg-white hover:shadow-sm transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {item.title || style.label}
                      </p>
                      {item.description && (
                        <p className="text-xs text-gray-400 truncate">{item.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    {item.start_datetime && (
                      <FiClock className="h-3.5 w-3.5 text-gray-400" />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                      className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600"
                    >
                      <FiEdit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                      className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600"
                    >
                      <FiTrash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}