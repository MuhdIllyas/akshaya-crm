// components/calendar/AgendaView.jsx
import { useMemo } from "react";
import {
  FiCalendar,
  FiUser,
  FiEdit,
  FiTrash2,
  FiClock,
} from "react-icons/fi";

export default function AgendaView({
  calendarData = [],
  leavesData = [],
  onEventClick,
  onEdit,
  onDelete,
}) {
  // Normalize + merge data
  const allItems = useMemo(() => {
    const items = [];

    calendarData.forEach((e) => {
      const date = e.date || e.start_datetime?.split("T")[0];
      if (!date) return;

      items.push({
        ...e,
        itemType: "event",
        sortDate: date,
      });
    });

    leavesData
      .filter((l) => l.status === "approved")
      .forEach((l) => {
        const date = l.from_date?.split("T")[0];
        if (!date) return;

        items.push({
          ...l,
          itemType: "leave",
          sortDate: date,
        });
      });

    return items;
  }, [calendarData, leavesData]);

  // Group into Overdue / Today / Tomorrow / Upcoming
  const grouped = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const overdue = [];
    const todayItems = [];
    const tomorrowItems = [];
    const upcoming = [];

    allItems.forEach((item) => {
      if (!item.sortDate) return;

      if (item.sortDate < todayStr) overdue.push(item);
      else if (item.sortDate === todayStr) todayItems.push(item);
      else if (item.sortDate === tomorrowStr) tomorrowItems.push(item);
      else upcoming.push(item);
    });

    const sortFn = (a, b) => {
      // High priority first
      if (a.priority === "high" && b.priority !== "high") return -1;
      if (b.priority === "high" && a.priority !== "high") return 1;

      return new Date(a.sortDate) - new Date(b.sortDate);
    };

    return {
      overdue: overdue.sort(sortFn),
      today: todayItems.sort(sortFn),
      tomorrow: tomorrowItems.sort(sortFn),
      upcoming: upcoming.sort(sortFn),
    };
  }, [allItems]);

  // Event type styles (updated system)
  const eventTypeStyles = {
    deadline: { dot: "bg-red-500", label: "Deadline" },
    start: { dot: "bg-green-500", label: "Start" },
    announcement: { dot: "bg-blue-500", label: "Announcement" },
    expiry: { dot: "bg-yellow-500", label: "Expiry" },
    task: { dot: "bg-purple-500", label: "Task" },
    default: { dot: "bg-gray-400", label: "Event" },
  };

  const renderSection = (title, items, highlight) => {
    if (!items.length) return null;

    return (
      <div>
        <h3
          className={`text-sm font-semibold mb-3 ${
            highlight === "overdue"
              ? "text-red-600"
              : highlight === "today"
              ? "text-indigo-600"
              : "text-gray-700"
          }`}
        >
          {title}
        </h3>

        <div className="space-y-2">
          {items.map((item, idx) => {
            if (item.itemType === "leave") {
              return (
                <div
                  key={`leave-${item.id}-${idx}`}
                  className="flex items-center gap-2 p-2 rounded-lg bg-yellow-50 border border-yellow-200 text-sm"
                >
                  <FiUser className="h-4 w-4 text-yellow-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800">
                      {item.staff_name || "Staff"}
                    </span>
                    <span className="text-xs text-gray-500 ml-1">
                      Leave:{" "}
                      {new Date(item.from_date).toLocaleDateString()} –{" "}
                      {new Date(item.to_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            }

            const style =
              eventTypeStyles[item.event_type] ||
              eventTypeStyles.default;

            return (
              <div
                key={`ev-${item.id}-${idx}`}
                onClick={() => onEventClick(item)}
                className={`group flex items-center justify-between p-2.5 rounded-lg border bg-white hover:shadow-sm transition cursor-pointer ${
                  highlight === "overdue"
                    ? "border-red-200 bg-red-50"
                    : highlight === "today"
                    ? "border-indigo-200 bg-indigo-50"
                    : "border-gray-200"
                }`}
              >
                {/* Left */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-2 h-2 rounded-full ${style.dot}`} />

                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {item.title || style.label}
                      {item.priority === "high" && (
                        <span className="ml-2 text-[10px] text-red-600 font-semibold">
                          HIGH
                        </span>
                      )}
                    </p>

                    {item.service_name && (
                      <p className="text-xs text-gray-400 truncate">
                        {item.service_name}
                      </p>
                    )}

                    {item.description && (
                      <p className="text-xs text-gray-400 truncate">
                        {item.description}
                      </p>
                    )}

                    {/* Time */}
                    {item.start_datetime && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <FiClock className="h-3 w-3" />
                        {new Date(item.start_datetime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(item);
                    }}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600"
                  >
                    <FiEdit className="h-3.5 w-3.5" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item);
                    }}
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
    );
  };

  if (
    !grouped.overdue.length &&
    !grouped.today.length &&
    !grouped.tomorrow.length &&
    !grouped.upcoming.length
  ) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <FiCalendar className="h-12 w-12 mb-4 text-gray-200" />
        <p className="text-sm">No upcoming events 🎉</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderSection("Overdue", grouped.overdue, "overdue")}
      {renderSection("Today", grouped.today, "today")}
      {renderSection("Tomorrow", grouped.tomorrow)}
      {renderSection("Upcoming", grouped.upcoming)}
    </div>
  );
}