// pages/CalendarPage.jsx
import { useState } from "react";
import CalendarToolbar from "../components/calendar/CalendarToolbar";
import CalendarView from "../components/calendar/CalendarView";
import EventModal from "../components/calendar/EventModal";
import CreateEventModal from "../components/calendar/CreateEventModal";
import AgendaView from "../components/calendar/AgendaView";
import { useEvents } from "../hooks/useEvents";

export default function CalendarPage() {
  const {
    events,
    filters,
    setFilters,
    createEvent,
    updateEvent,
    deleteEvent,
  } = useEvents();

  const [viewMode, setViewMode] = useState("month"); // month | week | agenda
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <CalendarToolbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        filters={filters}
        setFilters={setFilters}
        onAddEvent={() => setShowCreateModal(true)}
      />

      <div className="flex-1 overflow-auto p-4">
        {viewMode === "agenda" ? (
          <AgendaView events={events} onEventClick={setSelectedEvent} />
        ) : (
          <CalendarView
            events={events}
            onEventClick={setSelectedEvent}
            viewMode={viewMode}
          />
        )}
      </div>

      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={deleteEvent}
          onUpdate={updateEvent}
        />
      )}

      {showCreateModal && (
        <CreateEventModal
          onSave={createEvent}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}