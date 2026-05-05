// pages/CalendarPage.jsx
import { useState, useCallback } from "react";
import CalendarToolbar from "../components/calendar/CalendarToolbar";
import CalendarView from "../components/calendar/CalendarView";
import MiniCalendar from "../components/calendar/MiniCalendar";
import EventModal from "../components/calendar/EventModal";
import CreateEventModal from "../components/calendar/CreateEventModal";
import AgendaView from "../components/calendar/AgendaView";
import { useEvents } from "../hooks/useEvents";

export default function CalendarPage() {
  // Safely retrieve hook data – useEvents might not be available everywhere
  const eventsHookData = typeof useEvents === "function" ? useEvents() : {};

  const {
    events = [],
    leavesData = [],
    filters: hookFilters,
    setFilters: hookSetFilters,
    createEvent: hookCreateEvent,
    updateEvent: hookUpdateEvent,
    deleteEvent: hookDeleteEvent,
    userRole = "admin",
    centresMap = {},
  } = eventsHookData;

  // Fallback filters (in case the hook doesn't provide them)
  const [localFilters, setLocalFilters] = useState({
    working: true,
    holiday: true,
    weekend: true,
    task: true,
    priority: "",
    event_type: "",
    visibility: "centre",
  });

  // Use hook filters if available, otherwise use local state
  const filters = hookFilters !== undefined ? hookFilters : localFilters;
  const setFilters = hookSetFilters || setLocalFilters;

  // Fallback CRUD operations (prevent crashes)
  const createEvent = hookCreateEvent || ((data) => console.warn("createEvent not implemented", data));
  const updateEvent = hookUpdateEvent || ((id, data) => console.warn("updateEvent not implemented", id, data));
  const deleteEvent = hookDeleteEvent || ((id) => console.warn("deleteEvent not implemented", id));

  const [viewMode, setViewMode] = useState("month");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  const handleAddEvent = useCallback(
    (data) => {
      createEvent(data);
      setShowCreateModal(false);
    },
    [createEvent]
  );

  const handleEditEvent = useCallback(
    (data) => {
      updateEvent(data.id, data);
      setShowCreateModal(false);
      setEditEvent(null);
    },
    [updateEvent]
  );

  const handleDeleteEvent = useCallback(
    (id) => {
      deleteEvent(id);
      setSelectedEvent(null);
    },
    [deleteEvent]
  );

  const openCreateModal = () => {
    setEditEvent(null);
    setShowCreateModal(true);
  };

  const openEditModal = (event) => {
    setEditEvent(event);
    setShowCreateModal(true);
  };

  const handleMiniCalendarDateChange = (date) => {
    setCurrentDate(date);
    // Optional: also trigger a gotoDate on the FullCalendar if you keep a ref
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
        {/* MiniCalendar sidebar (hidden on mobile) */}
        {viewMode !== "agenda" && (
          <aside className="hidden lg:block w-64 p-4 border-r border-gray-200 overflow-y-auto bg-white">
            <MiniCalendar
              events={events}
              currentDate={currentDate}
              onDateChange={handleMiniCalendarDateChange}
            />
            {/* Additional quick‑stats or filter chips can go here */}
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
                  // If you need leave deletion, handle it here
                  console.warn("Leave deletion is not yet implemented");
                } else {
                  deleteEvent(item.id);
                }
              }}
            />
          ) : (
            <CalendarView
              key={currentDate.toISOString()} // force re‑render when date changes
              events={events}
              viewMode={viewMode}
              onEventClick={setSelectedEvent}
            />
          )}
        </main>
      </div>

      {/* Event detail modal */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={handleDeleteEvent}
          onUpdate={updateEvent}
        />
      )}

      {/* Create / Edit modal */}
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