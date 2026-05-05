// components/calendar/CalendarView.jsx
import { useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

// Centralised colour mapping
const eventColors = {
  deadline: { bg: "#fecaca", border: "#f87171", text: "#991b1b" },
  start: { bg: "#bbf7d0", border: "#4ade80", text: "#166534" },
  announcement: { bg: "#bfdbfe", border: "#60a5fa", text: "#1e3a8a" },
  expiry: { bg: "#fde68a", border: "#facc15", text: "#713f12" },
  task: { bg: "#fbd38d", border: "#f6ad55", text: "#7c2d12" },
  default: { bg: "#e5e7eb", border: "#9ca3af", text: "#374151" },
};

function getEventStyle(event) {
  const key = event.event_type || (event.type === "task" ? "task" : null);
  return eventColors[key] || eventColors.default;
}

export default function CalendarView({ events, viewMode, onEventClick, onDateClick }) {
  // Map + sort events
  const mappedEvents = useMemo(() => {
    return events
      .sort((a, b) => {
        // High priority first
        if (a.priority === "high" && b.priority !== "high") return -1;
        if (b.priority === "high" && a.priority !== "high") return 1;
        // Then by date
        const aDate = new Date(a.start_datetime || a.date || 0);
        const bDate = new Date(b.start_datetime || b.date || 0);
        return aDate - bDate;
      })
      .map((ev) => {
        const colors = getEventStyle(ev);
        return {
          id: ev.id.toString(),
          title: ev.title,
          start: ev.start_datetime || ev.date,
          end: ev.end_datetime,
          allDay: !ev.start_datetime, // timed event if start_datetime exists
          backgroundColor: colors.bg,
          borderColor: colors.border,
          textColor: colors.text,
          extendedProps: ev,
        };
      });
  }, [events]);

  const handleDateClick = (arg) => {
    // Pass a 'new event' signal with the clicked date
    if (onDateClick) {
      onDateClick({ date: arg.dateStr, isNew: true });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      {/* Event type legend */}
      <div className="flex flex-wrap gap-3 mb-3 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-red-400 rounded-full" /> Deadline
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-green-400 rounded-full" /> Start
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-blue-400 rounded-full" /> Announcement
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-orange-400 rounded-full" /> Task
        </span>
      </div>

      <FullCalendar
        key={viewMode} // forces reinitialisation when view changes
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={viewMode === "week" ? "timeGridWeek" : "dayGridMonth"}
        initialDate={new Date()}
        events={mappedEvents}
        eventClick={(info) =>
          onEventClick({
            ...info.event.extendedProps,
            start: info.event.start,
            end: info.event.end,
          })
        }
        dateClick={handleDateClick}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "",
        }}
        height="auto"
        dayMaxEvents={true}
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", meridiem: "short" }}
        slotLabelFormat={{ hour: "2-digit", minute: "2-digit", meridiem: "short" }}
        eventDisplay="block"
        nowIndicator={true}
        dayCellClassNames={(arg) => (arg.isToday ? ["bg-blue-50"] : [])}
        eventContent={(arg) => {
          const { event_type, priority } = arg.event.extendedProps;

          return (
            <div className="px-1 py-0.5 text-xs font-medium leading-tight">
              <div>{arg.event.title}</div>
              {event_type && (
                <div className="text-[10px] opacity-70 capitalize">
                  {event_type}
                  {priority && priority !== "medium" && ` · ${priority}`}
                </div>
              )}
            </div>
          );
        }}
        eventDidMount={(info) => {
          const { description, event_type, priority } = info.event.extendedProps;
          const parts = [];
          parts.push(`Type: ${event_type || "event"}`);
          if (priority) parts.push(`Priority: ${priority}`);
          if (description) parts.push(description);
          info.el.title = parts.join("\n");
        }}
      />
    </div>
  );
}