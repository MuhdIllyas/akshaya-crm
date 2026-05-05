// pages/CalendarPage.jsx
import { useState, useCallback, useRef, useMemo } from "react";
import CalendarToolbar from "../components/calendar/CalendarToolbar";
import CalendarView from "../components/calendar/CalendarView";
import MiniCalendar from "../components/calendar/MiniCalendar";
import EventModal from "../components/calendar/EventModal";
import CreateEventModal from "../components/calendar/CreateEventModal";
import AgendaView from "../components/calendar/AgendaView";
import { useEvents } from "../hooks/useEvents";

export default function CalendarPage() {
  // ---- Safe hook fallback ----
  const eventsHookData = typeof useEvents === "function" ? useEvents() : {};

  const {
    events = [],
    leavesData = [],
    createEvent: hookCreateEvent,
    updateEvent: hookUpdateEvent,
    deleteEvent: hookDeleteEvent,
    userRole = "admin",
    services: servicesList = [],
  } = eventsHookData;

  // ---- Filters (aligned with new system) ----
  const [filters, setFilters] = useState({
    type: "",           // "application" | "task" | "service" | "holiday"
    priority: "",
    event_type: "",
    visibility: "centre",
    service_id: "",
    myEvents: false,
  });

  // ---- View & UI state ----
  const [viewMode, setViewMode] = useState("month"); // month | week | agenda
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);   // optional – set from hook if needed

  // Ref to control FullCalendar API
  const calendarRef = useRef(null);

  // ---- Filter events ----
  const filteredEvents = useMemo(() => {
    if (!Array.isArray(events)) return [];

    return events.filter((e) => {
      // type filter (single select)
      if (filters.type && e.type !== filters.type) return false;
      // priority filter
      if (filters.priority && e.priority !== filters.priority) return false;
      // event_type filter
      if (filters.event_type && e.event_type !== filters.event_type) return false;
      // visibility filter
      if (filters.visibility && e.visibility !== filters.visibility) return false;
      // service filter
      if (filters.service_id && e.service_id?.toString() !== filters.service_id) return false;

      // myEvents filter – example: assume each event has assigned_to array or created_by field
      if (filters.myEvents) {
        const currentUserId = "CURRENT_USER_ID"; // replace with actual logged‑in user ID
        const isMine =
          e.created_by === currentUserId ||
          (Array.isArray(e.assigned_to) && e.assigned_to.includes(currentUserId));
        if (!isMine) return false;
      }
      return true;
    });
  }, [events, filters]);

  // ---- CRUD fallbacks ----
  const createEvent = hookCreateEvent || ((data) => console.warn("createEvent not implemented", data));
  const updateEvent = hookUpdateEvent || ((id, data) => console.warn("updateEvent not implemented", id, data));
  const deleteEvent = hookDeleteEvent || ((id) => console.warn("deleteEvent not implemented", id));

  // ---- Handlers ----
  const handleAddEvent = useCallback(
    (data) => {
      createEvent(data);
      setShowCreateModal(false);
      setEditEvent(null);
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
    // Sync the main FullCalendar
    const api = calendarRef.current?.getApi?.();
    api?.gotoDate(date);
  };

  // Handle calendar clicks: if a date is clicked (new event), open create modal
  const handleCalendarEventClick = (event) => {
    if (event.isNew) {
      // Pre‑fill date in create modal (via editEvent)
      setEditEvent(null);
      setShowCreateModal(true);
      // Optionally store pre‑selected date
      setSelectedEvent(null);
      // You can also pass a "defaultDate" to CreateEventModal if you wish
      // We'll store it in component state or context
      // For simplicity, set editEvent to { date: event.date } so modal picks it up
      setEditEvent({ date: event.date });
      setShowCreateModal(true);
    } else {
      setSelectedEvent(event);
    }
  };

  // Loading / Empty state helpers
  const isLoading = !eventsHookData || loading;
  const hasEvents = filteredEvents.length > 0;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <CalendarToolbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        filters={filters}
        setFilters={setFilters}
        onAddEvent={openCreateModal}
        userRole={userRole}
        services={servicesList}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* MiniCalendar sidebar (hidden on small screens) */}
        {viewMode !== "agenda" && (
          <aside className="hidden lg:block w-64 p-4 border-r border-gray-200 overflow-y-auto bg-white">
            <MiniCalendar
              events={filteredEvents}
              currentDate={currentDate}
              onDateChange={handleMiniCalendarDateChange}
            />
          </aside>
        )}

        <main className="flex-1 overflow-auto p-4 relative">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="animate-spin mr-2 h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
              Loading events…
            </div>
          ) : viewMode === "agenda" ? (
            <AgendaView
              calendarData={filteredEvents}
              leavesData={leavesData}
              onEventClick={setSelectedEvent}
              onEdit={openEditModal}
              onDelete={(item) => {
                // Standardised delete: assumes item has id and possibly type
                deleteEvent(item.id);
              }}
            />
          ) : !hasEvents ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-lg font-medium">No events found</p>
              <p className="text-sm mt-1">Try adjusting your filters or add a new event.</p>
            </div>
          ) : (
            <CalendarView
              ref={calendarRef}
              key={viewMode + currentDate.toISOString()}
              events={filteredEvents}
              viewMode={viewMode}
              onEventClick={handleCalendarEventClick}
              onDateClick={handleCalendarEventClick} // unified handler for date clicks
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
            if (editEvent?.id) {
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