import { useEffect, useState, useCallback } from "react";

import {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} from "../services/eventsApi";

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
      const newEvent = await createEvent(payload);

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
      const updated = await updateEvent(id, payload);

      setEvents((prev) =>
        prev.map((e) => (e.id === id ? updated : e))
      );

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
      await deleteEvent(id);

      setEvents((prev) =>
        prev.filter((e) => e.id !== id)
      );
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