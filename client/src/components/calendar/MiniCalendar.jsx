// components/calendar/MiniCalendar.jsx
import { useState, useMemo } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

export default function MiniCalendar({ events = [], currentDate, onDateChange }) {
  const [displayDate, setDisplayDate] = useState(currentDate ? new Date(currentDate) : new Date());

  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  // Build dates with events count
  const eventMap = useMemo(() => {
    const map = {};
    events.forEach(e => {
      const dateStr = (e.start_datetime || e.date)?.toString().slice(0, 10);
      if (dateStr) {
        map[dateStr] = (map[dateStr] || 0) + 1;
      }
    });
    return map;
  }, [events]);

  const weeks = [];
  let day = 1;
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dateObj = new Date(year, month, day);
      const dateStr = dateObj.toISOString().slice(0, 10);
      const isCurrentMonth = day > 0 && day <= daysInMonth && (w === 0 ? d >= firstDayOfWeek : true);
      const isToday = dateStr === new Date().toISOString().slice(0, 10);
      week.push({
        day: isCurrentMonth ? day : null,
        dateStr,
        isToday,
        hasEvents: eventMap[dateStr] || 0,
      });
      if (isCurrentMonth) day++;
      if (day > daysInMonth && isCurrentMonth) {
        day = 0; // stop adding month days
      }
    }
    weeks.push(week);
  }

  const changeMonth = (delta) => {
    const newDate = new Date(displayDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setDisplayDate(newDate);
    onDateChange?.(newDate);
  };

  return (
    <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => changeMonth(-1)}
          className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
        >
          <FiChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-semibold text-gray-700">
          {displayDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h3>
        <button
          onClick={() => changeMonth(1)}
          className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
        >
          <FiChevronRight className="h-4 w-4" />
        </button>
      </div>
      {/* Weekdays */}
      <div className="grid grid-cols-7 text-xs text-center text-gray-400 mb-1">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(d => (
          <div key={d}>{d}</div>
        ))}
      </div>
      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {weeks.flatMap(week =>
          week.map((cell, i) => (
            <button
              key={i}
              disabled={!cell.day}
              onClick={() => {
                if (cell.day) {
                  onDateChange?.(new Date(year, month, cell.day));
                }
              }}
              className={`
                aspect-square flex items-center justify-center text-xs rounded-full relative
                ${cell.isToday ? "bg-indigo-600 text-white font-bold" : "hover:bg-gray-100 text-gray-700"}
                ${!cell.day && "text-transparent pointer-events-none"}
              `}
            >
              {cell.day || ""}
              {cell.hasEvents > 0 && cell.day && (
                <span className={`absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full ${cell.isToday ? 'bg-white' : 'bg-indigo-400'}`}></span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}