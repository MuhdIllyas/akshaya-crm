// components/calendar/AgendaView.jsx
import { FiCalendar, FiClock, FiUser } from "react-icons/fi";

export default function AgendaView({ calendarData = [], leavesData = [], onEventClick, onEdit, onDelete }) {
  // Build aggregated list similar to your List view logic
  const allItems = useMemo(() => {
    const items = [];
    calendarData.forEach(e => {
      const date = e.date;
      items.push({ ...e, itemType: 'event' });
    });
    leavesData.forEach(l => {
      if (l.status !== "approved") return;
      items.push({ ...l, itemType: 'leave', date: l.from_date });
    });
    // Sort by date
    return items.sort((a, b) => new Date(a.date || a.from_date) - new Date(b.date || b.from_date));
  }, [calendarData, leavesData]);

  // Group by date
  const grouped = useMemo(() => {
    const map = {};
    allItems.forEach(item => {
      const key = item.date || item.from_date?.split("T")[0];
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [allItems]);

  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));

  return (
    <div className="space-y-4">
      {sortedDates.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FiCalendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p>No events this month</p>
        </div>
      ) : (
        sortedDates.map(date => (
          <div key={date}>
            <div className="flex items-center mb-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold">
                {new Date(date).getDate()}
              </div>
              <span className="ml-3 text-sm font-semibold text-gray-700 capitalize">
                {new Date(date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </span>
            </div>
            <div className="space-y-2 ml-11">
              {grouped[date].map((item, idx) => {
                if (item.itemType === 'leave') {
                  return (
                    <div key={`leave-${item.id}-${idx}`} className="p-2 rounded-lg bg-yellow-50 border border-yellow-200 text-sm flex items-center gap-2">
                      <FiUser className="h-4 w-4 text-yellow-600" />
                      <span className="font-medium">{item.staff_name || "Staff"}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(item.from_date).toLocaleDateString()} – {new Date(item.to_date).toLocaleDateString()}
                      </span>
                    </div>
                  );
                }
                // Event
                const colors = {
                  working: "border-green-200 bg-green-50",
                  holiday: "border-red-200 bg-red-50",
                  weekend: "border-gray-200 bg-gray-50",
                  task: "border-purple-200 bg-purple-50",
                };
                const colorClass = colors[item.type] || "border-gray-200 bg-gray-50";
                return (
                  <div
                    key={`ev-${item.id}-${idx}`}
                    onClick={() => onEventClick(item)}
                    className="p-2 rounded-lg border bg-white cursor-pointer hover:shadow-md transition-shadow flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${item.type === "holiday" ? "bg-red-500" : item.type === "working" ? "bg-green-500" : item.type === "task" ? "bg-purple-500" : "bg-gray-500"}`} />
                      <span className="font-medium text-gray-800">
                        {item.type === "holiday" ? "Holiday" : item.type === "working" ? "Working Day" : item.type === "task" ? "Task" : "Event"}
                      </span>
                      {item.description && <span className="text-xs text-gray-500 ml-2">{item.description}</span>}
                    </div>
                    <div className="flex gap-1 text-gray-400">
                      <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className="hover:text-indigo-600"><FiEdit className="h-3 w-3" /></button>
                      <button onClick={(e) => { e.stopPropagation(); onDelete(item); }} className="hover:text-red-600"><FiTrash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}