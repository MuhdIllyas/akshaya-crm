// components/calendar/MiniCalendar.jsx
import { useState, useMemo, useEffect } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

export default function MiniCalendar({
  events = [],
  currentDate,
  onDateChange,
}) {
  const [displayDate, setDisplayDate] = useState(
    currentDate ? new Date(currentDate) : new Date()
  );

  const selectedDateStr = currentDate
    ? new Date(currentDate).toISOString().slice(0, 10)
    : null;

  useEffect(() => {
    if (currentDate) {
      setDisplayDate(new Date(currentDate));
    }
  }, [currentDate]);

  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();

  const startOfMonth = new Date(year, month, 1);
  const startDay = (startOfMonth.getDay() + 6) % 7; // Monday start
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Event map with priority awareness
  const eventMap = useMemo(() => {
    const map = {};

    events.forEach((e) => {
      const dateStr = (e.start_datetime || e.date)
        ?.toString()
        .slice(0, 10);

      if (!dateStr) return;

      if (!map[dateStr]) {
        map[dateStr] = {
          count: 0,
          hasHigh: false,
        };
      }

      map[dateStr].count++;
      if (e.priority === "high") map[dateStr].hasHigh = true;
    });

    return map;
  }, [events]);

  // Build grid
  const days = [];

  // Empty slots before start
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }

  // Month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dateStr = dateObj.toISOString().slice(0, 10);

    days.push({
      day: d,
      dateStr,
      isToday:
        dateStr === new Date().toISOString().slice(0, 10),
      isSelected: dateStr === selectedDateStr,
      events: eventMap[dateStr],
    });
  }

  const changeMonth = (delta) => {
    const newDate = new Date(displayDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setDisplayDate(newDate);
  };

  return (
    <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => changeMonth(-1)}>
          <FiChevronLeft />
        </button>

        <h3 className="text-sm font-semibold">
          {displayDate.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </h3>

        <button onClick={() => changeMonth(1)}>
          <FiChevronRight />
        </button>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 text-xs text-center text-gray-400 mb-1">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((cell, i) =>
          !cell ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              onClick={() => {
                onDateChange?.(
                  new Date(year, month, cell.day)
                );
              }}
              className={`
                aspect-square flex items-center justify-center text-xs rounded-full relative
                ${
                  cell.isSelected
                    ? "bg-indigo-600 text-white font-bold"
                    : cell.isToday
                    ? "border border-indigo-500 text-indigo-600"
                    : "hover:bg-gray-100 text-gray-700"
                }
              `}
            >
              {cell.day}

              {/* Event indicator */}
              {cell.events && (
                <span
                  className={`absolute bottom-0.5 w-1.5 h-1.5 rounded-full ${
                    cell.events.hasHigh
                      ? "bg-red-500"
                      : "bg-indigo-400"
                  }`}
                />
              )}
            </button>
          )
        )}
      </div>
    </div>
  );
}