// pages/CalendarPage.jsx
import { useState, useCallback } from "react";
import CalendarToolbar from "../components/calendar/CalendarToolbar";
import CalendarView from "../components/calendar/CalendarView";
import MiniCalendar from "../components/calendar/MiniCalendar";
import EventModal from "../components/calendar/EventModal";
import CreateEventModal from "../components/calendar/CreateEventModal";
import AgendaView from "../components/calendar/AgendaView";
import { useEvents } from "../hooks/useEvents"; // assuming this exports events, filters, CRUD

export default function CalendarPage() {
  const {
    events,
    leavesData = [],
    filters,
    setFilters,
    createEvent,
    updateEvent,
    deleteEvent,
    userRole,
    centresMap,
  } = useEvents();

  const [viewMode, setViewMode] = useState("month");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  const handleAddEvent = useCallback((data) => {
    createEvent(data);
    setShowCreateModal(false);
  }, [createEvent]);

  const handleEditEvent = useCallback((data) => {
    updateEvent(data.id, data);
    setShowCreateModal(false);
    setEditEvent(null);
  }, [updateEvent]);

  const handleDeleteEvent = useCallback((id) => {
    deleteEvent(id);
    setSelectedEvent(null);
  }, [deleteEvent]);

  const openCreateModal = () => {
    setEditEvent(null);
    setShowCreateModal(true);
  };

  const openEditModal = (event) => {
    setEditEvent(event);
    setShowCreateModal(true);
  };

  // Use MiniCalendar to change main calendar date
  const handleMiniCalendarDateChange = (date) => {
    setCurrentDate(date);
    // trigger a date change on the FullCalendar if possible (via ref or key)
    // For simplicity, we could rerender with new key; see below.
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <CalendarToolbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        filters={filters}
        setFilters={setFilters}
        onAddEvent={openCreateModal}
        userRole={userRole}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar with MiniCalendar (hidden on small screens) */}
        {viewMode !== "agenda" && (
          <aside className="hidden lg:block w-64 p-4 border-r border-gray-200 overflow-y-auto bg-white">
            <MiniCalendar
              events={events}
              currentDate={currentDate}
              onDateChange={handleMiniCalendarDateChange}
            />
            {/* You can add additional filters or quick stats here */}
          </aside>
        )}

        <main className="flex-1 overflow-auto p-4">
          {viewMode === "agenda" ? (
            <AgendaView
              calendarData={events}
              leavesData={leavesData}
              onEventClick={setSelectedEvent}
              onEdit={openEditModal}
              onDelete={(item) => {
                if (item.itemType === "leave") {
                  // handle leave delete if needed
                } else {
                  deleteEvent(item.id);
                }
              }}
            />
          ) : (
            <CalendarView
              key={currentDate.toISOString()} // force re-mount when date changes via mini cal
              events={events}
              viewMode={viewMode}
              onEventClick={setSelectedEvent}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={handleDeleteEvent}
          onUpdate={updateEvent}
        />
      )}

      {showCreateModal && (
        <CreateEventModal
          initialData={editEvent || undefined}
          onSave={(data) => {
            if (editEvent) {
              handleEditEvent({ ...editEvent, ...data });
            } else {
              handleAddEvent(data);
            }
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