// components/calendar/CalendarView.jsx
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

export default function CalendarView({ events, viewMode, onEventClick }) {
  // Map events to FullCalendar format with colors
  const mappedEvents = events.map((ev) => ({
    id: ev.id.toString(),
    title: ev.title,
    start: ev.start_datetime,
    end: ev.end_datetime,
    backgroundColor: getColor(ev),
    borderColor: getColor(ev),
    extendedProps: ev,
  }));

  const handleDateClick = (arg) => {
    // Could trigger quick-create with date; for now, nothing
  };

  return (
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
    />
  );
}

function getColor(event) {
  if (event.event_type === "deadline") return "#ef4444";
  if (event.event_type === "start") return "#22c55e";
  if (event.event_type === "announcement") return "#3b82f6";
  if (event.type === "task") return "#f59e0b";
  return "#6b7280";
}