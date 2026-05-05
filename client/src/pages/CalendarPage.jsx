// pages/CalendarPage.jsx
import { useState } from "react";
import CalendarToolbar from "../components/calendar/CalendarToolbar";
import CalendarView from "../components/calendar/CalendarView";   // your big existing calendar
import EventModal from "../components/calendar/EventModal";
import CreateEventModal from "../components/calendar/CreateEventModal";
import AgendaView from "../components/calendar/AgendaView";

export default function CalendarPage() {
  // Assuming you already have calendarData, leavesData, centresMap, onAddEvent, etc.
  // Pass them as props from wherever you originally fetched them.
  const [viewMode, setViewMode] = useState("month");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editEvent, setEditEvent] = useState(null);

  // ... your existing logic for calendarData, leavesData, etc. ...
  // Example mock (replace with your real data)
  const calendarData = [ /* your events */ ];
  const leavesData = [ /* your leaves */ ];
  const onAddEvent = (data) => { /* ... */ };
  const onEditEvent = (data) => { /* ... */ };
  const onDeleteEvent = (id) => { /* ... */ };
  const onUpdateEvent = (id, updates) => { /* ... */ };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <CalendarToolbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        filters={filters}            // your existing filters object
        setFilters={setFilters}
        onAddEvent={() => {
          setEditEvent(null);
          setShowCreateModal(true);
        }}
        userRole={userRole}          // if you have it
      />

      <div className="flex-1 overflow-auto p-4">
        {viewMode === "agenda" ? (
          <AgendaView
            calendarData={calendarData}
            leavesData={leavesData}
            onEventClick={setSelectedEvent}
            onEdit={(ev) => {
              setEditEvent(ev);
              setShowCreateModal(true);
            }}
            onDelete={onDeleteEvent}
          />
        ) : (
          <CalendarView
            calendarData={calendarData}
            leavesData={leavesData}
            onAddEvent={() => {
              setEditEvent(null);
              setShowCreateModal(true);
            }}
            onEditEvent={(ev) => {
              setEditEvent(ev);
              setShowCreateModal(true);
            }}
            onDeleteEvent={onDeleteEvent}
            onUpdateEvent={onUpdateEvent}
            userRole={userRole}
            centresMap={centresMap}
          />
        )}
      </div>

      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={onDeleteEvent}
          onUpdate={onUpdateEvent}
        />
      )}

      {showCreateModal && (
        <CreateEventModal
          initialData={editEvent || null}
          onSave={(data) => {
            if (editEvent) {
              onEditEvent({ ...editEvent, ...data });
            } else {
              onAddEvent(data);
            }
            setShowCreateModal(false);
          }}
          onClose={() => {
            setShowCreateModal(false);
            setEditEvent(null);
          }}
        />
      )}
    </div>
  );
}