// hooks/useEvents.js
import { useEffect, useState, useCallback } from "react";
import {
  getEvents,
  createEvent as apiCreate,
  updateEvent as apiUpdate,
  deleteEvent as apiDelete,
} from "../services/eventsApi";

/**
 * Custom hook for calendar event CRUD.
 * 
 * @param {Object}  [filters={}]          Query parameters for the GET /api/events request.
 * @param {number}  [filters.centreId]    Superadmin: fetch events for a specific centre.
 * @param {string}  [filters.type]        Filter by event type.
 * @param {string}  [filters.priority]    Filter by priority.
 * @param {string}  [filters.event_type]  Filter by event sub‑type.
 * @param {string}  [filters.visibility]  Filter by visibility.
 * @param {string}  [filters.service_id]  Filter by service.
 * @param {boolean} [filters.myEvents]    Show only the current user's events.
 */
export default function useEvents(filters = {}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* =========================
     FETCH
  ========================= */
  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      // Pass all filters (including centreId if present) directly to the API
      const data = await getEvents(filters);
      setEvents(data);
    } catch (err) {
      console.error("FETCH EVENTS ERROR:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  /* =========================
     CREATE
  ========================= */
  const addEvent = async (payload) => {
    try {
      const newEvent = await apiCreate(payload);
      setEvents((prev) => [newEvent, ...prev]);
      return newEvent;
    } catch (err) {
      console.error("CREATE EVENT ERROR:", err);
      throw err;
    }
  };

  /* =========================
     UPDATE
  ========================= */
  const editEvent = async (id, payload) => {
    try {
      const updated = await apiUpdate(id, payload);
      setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
      return updated;
    } catch (err) {
      console.error("UPDATE EVENT ERROR:", err);
      throw err;
    }
  };

  /* =========================
     DELETE
  ========================= */
  const removeEvent = async (id) => {
    try {
      await apiDelete(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error("DELETE EVENT ERROR:", err);
      throw err;
    }
  };

  return {
    events,
    loading,
    error,
    fetchEvents,
    addEvent,
    editEvent,
    removeEvent,
  };
}