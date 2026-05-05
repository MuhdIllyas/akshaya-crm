// components/calendar/CalendarView.jsx
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

// Centralised colour mapping
const eventColors = {
  deadline:   { bg: "#fecaca", border: "#f87171", text: "#991b1b" },
  start:      { bg: "#bbf7d0", border: "#4ade80", text: "#166534" },
  announcement:{ bg: "#bfdbfe", border: "#60a5fa", text: "#1e3a8a" },
  expiry:     { bg: "#fde68a", border: "#facc15", text: "#713f12" },
  task:       { bg: "#fbd38d", border: "#f6ad55", text: "#7c2d12" },
  default:    { bg: "#e5e7eb", border: "#9ca3af", text: "#374151" },
};

function getEventStyle(event) {
  // decide colour by event_type first, then fallback to type === 'task'
  const key = event.event_type || (event.type === 'task' ? 'task' : null);
  return eventColors[key] || eventColors.default;
}

export default function CalendarView({ events, viewMode, onEventClick }) {
  const mappedEvents = events.map((ev) => {
    const colors = getEventStyle(ev);
    return {
      id: ev.id.toString(),
      title: ev.title,
      start: ev.start_datetime || ev.date,
      end: ev.end_datetime,
      backgroundColor: colors.bg,
      borderColor: colors.border,
      textColor: colors.text,
      extendedProps: ev,
    };
  });

  const handleDateClick = (arg) => {
    // Optional: trigger quick-create with selected date
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={viewMode === "week" ? "timeGridWeek" : "dayGridMonth"}
        initialDate={new Date()}
        events={mappedEvents}
        eventClick={(info) => onEventClick(info.event.extendedProps)}
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
        // improved event rendering
        eventDisplay="block"
        nowIndicator={true}
        // month view event background
        eventContent={(arg) => (
          <div className="fc-event-main-frame px-1 py-0.5 text-xs font-medium leading-tight">
            <span className="fc-event-title">{arg.event.title}</span>
          </div>
        )}
      />
    </div>
  );
}