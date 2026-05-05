// hooks/useEvents.js
import { useState, useCallback } from "react";

// ---------- MOCK EVENTS ----------
const MOCK_EVENTS = [
  {
    id: 1,
    title: "Passport Renewal Deadline",
    description: "Submit documents before expiry.",
    date: "2026-05-10",
    start_datetime: "2026-05-10T09:00:00",
    end_datetime: "2026-05-10T17:00:00",
    type: "application",
    event_type: "deadline",
    priority: "high",
    status: "pending",
    related_service_id: 101,
    assigned_to: [2],
    visibility: "centre",
  },
  {
    id: 2,
    title: "Staff Meeting",
    description: "Weekly sync with the team.",
    date: "2026-05-08",
    start_datetime: "2026-05-08T14:00:00",
    end_datetime: "2026-05-08T15:00:00",
    type: "service",
    event_type: "announcement",
    priority: "medium",
    status: "completed",
    related_service_id: 102,
    assigned_to: [],
    visibility: "global",
  },
  {
    id: 3,
    title: "Exam Result Announcement",
    description: "Results for May exams.",
    date: "2026-05-15",
    start_datetime: "2026-05-15T08:00:00",
    end_datetime: "2026-05-15T12:00:00",
    type: "service",
    event_type: "announcement",
    priority: "high",
    status: "upcoming",
    related_service_id: 103,
    assigned_to: [],
    visibility: "global",
  },
  {
    id: 4,
    title: "Scholarship Application Last Date",
    description: "Submit application before midnight.",
    date: "2026-05-12",
    start_datetime: "2026-05-12T23:59:00",
    end_datetime: "2026-05-12T23:59:00",
    type: "application",
    event_type: "deadline",
    priority: "high",
    status: "pending",
    related_service_id: 104,
    assigned_to: [1],
    visibility: "centre",
  },
  {
    id: 5,
    title: "Office Maintenance Task",
    description: "Check HVAC system.",
    date: "2026-05-07",
    start_datetime: "2026-05-07T10:00:00",
    end_datetime: "2026-05-07T12:00:00",
    type: "task",
    event_type: "start",
    priority: "low",
    status: "pending",
    related_service_id: null,
    assigned_to: [3],
    visibility: "centre",
  },
];

export function useEvents() {
  const [events, setEvents] = useState(MOCK_EVENTS);
  const [filters, setFilters] = useState({
    type: "",
    priority: "",
    visibility: "",
    event_type: "",
  });

  const filteredEvents = events.filter((e) => {
    if (filters.type && e.type !== filters.type) return false;
    if (filters.priority && e.priority !== filters.priority) return false;
    if (filters.visibility && e.visibility !== filters.visibility) return false;
    if (filters.event_type && e.event_type !== filters.event_type) return false;
    return true;
  });

  const createEvent = useCallback((newEvent) => {
    const id = Math.max(0, ...events.map((e) => e.id)) + 1;
    setEvents((prev) => [...prev, { ...newEvent, id }]);
  }, [events]);

  const updateEvent = useCallback((id, updatedData) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updatedData } : e))
    );
  }, []);

  const deleteEvent = useCallback((id) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return {
    events: filteredEvents,
    allEvents: events,
    filters,
    setFilters,
    createEvent,
    updateEvent,
    deleteEvent,
  };
}