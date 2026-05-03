/**
 * 📅 Central Planning & Alert Calendar
 *
 * Full-featured React component covering:
 * - Month / Week / Day / Agenda views
 * - Filters (type, scope, service, priority)
 * - Event CRUD with modal forms
 * - Role‑based visibility & permissions
 * - Colour‑coded events & status badges
 * - Search, Quick Add, Performance optimisations
 *
 * Dependencies: react, date-fns, react-icons/fi, react-toastify, framer-motion
 * API calls are simulated – replace with your actual service functions.
 */

import React, {
  useState, useEffect, useMemo, useCallback, useRef, createContext, useContext
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths,
  addWeeks, subWeeks, isSameDay, isSameMonth, isToday, isPast, isFuture,
  format, parseISO, differenceInDays, getDate, getMonth, getYear, setDate, setMonth, setYear
} from 'date-fns';
import {
  FiChevronLeft, FiChevronRight, FiPlus, FiEdit, FiTrash2, FiCheck,
  FiX, FiFilter, FiUser, FiCalendar, FiClock, FiMapPin, FiBarChart2,
  FiList, FiGrid, FiSearch, FiRefreshCw, FiEye, FiBell, FiTag,
} from 'react-icons/fi';

// ----------------------------------------------------------------------------
// TYPES & CONSTANTS
// ----------------------------------------------------------------------------
const EVENT_CATEGORIES = {
  APPLICATION: 'application',
  TASK: 'task',
  SERVICE: 'service',
  HOLIDAY: 'holiday',
  SYSTEM: 'system',
};

const EVENT_SUB_TYPES = {
  DEADLINE: 'deadline',
  START: 'start',
  ANNOUNCEMENT: 'announcement',
  TASK: 'task',
  HOLIDAY: 'holiday',
  EXPIRY: 'expiry',
  REMINDER: 'reminder',
  EXAM: 'exam',
  RESULT: 'result',
  FOLLOWUP: 'followup',
  PROCESSING: 'processing',
};

const PRIORITIES = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };
const SCOPES = { GLOBAL: 'global', CENTRE: 'centre', PERSONAL: 'personal' };
const ROLES = { SUPERADMIN: 'superadmin', ADMIN: 'admin', STAFF: 'staff' };

const SERVICES = ['Passport', 'PSC', 'Scholarship', 'Visa', 'Driving License', 'ID Card'];

const COLOR_MAP = {
  [EVENT_SUB_TYPES.DEADLINE]: 'rose',
  [EVENT_SUB_TYPES.START]: 'emerald',
  [EVENT_SUB_TYPES.ANNOUNCEMENT]: 'blue',
  [EVENT_SUB_TYPES.TASK]: 'amber',
  [EVENT_SUB_TYPES.HOLIDAY]: 'gray',
  [EVENT_SUB_TYPES.EXPIRY]: 'rose',
  [EVENT_SUB_TYPES.REMINDER]: 'amber',
  [EVENT_SUB_TYPES.EXAM]: 'rose',
  [EVENT_SUB_TYPES.RESULT]: 'blue',
  [EVENT_SUB_TYPES.FOLLOWUP]: 'amber',
  [EVENT_SUB_TYPES.PROCESSING]: 'emerald',
};

const STATUS_THRESHOLDS = {
  OVERDUE_DAYS: -1,
  DUE_TODAY_DAYS: 0,
  UPCOMING_DAYS: 3,
};

// ----------------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------------
const generateId = () => `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const getColorClasses = (colorName) => {
  const palette = {
    rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
    gray: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400' },
  };
  return palette[colorName] || palette.amber;
};

const getEventStatus = (event) => {
  const now = new Date();
  const eventDate = typeof event.date === 'string' ? parseISO(event.date) : event.date;
  if (event.completed) return { label: '✓ Done', class: 'bg-emerald-100 text-emerald-700' };
  if (isPast(eventDate) && !isToday(eventDate)) return { label: '⚠ Overdue', class: 'bg-rose-100 text-rose-700', pulse: true };
  if (isToday(eventDate)) return { label: '🔴 Due Today', class: 'bg-amber-100 text-amber-700', pulse: true };
  if (differenceInDays(eventDate, now) <= STATUS_THRESHOLDS.UPCOMING_DAYS)
    return { label: '⏳ Upcoming', class: 'bg-purple-100 text-purple-700' };
  return null;
};

// ----------------------------------------------------------------------------
// CONTEXT (to avoid prop drilling)
// ----------------------------------------------------------------------------
const CalendarContext = createContext();

const useCalendarContext = () => {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error('useCalendarContext must be used within CalendarProvider');
  return ctx;
};

// ----------------------------------------------------------------------------
// MOCK API SERVICE (replace with your actual service functions)
// ----------------------------------------------------------------------------
const mockEventsData = [
  // Insert initial sample events if desired, or leave empty and load from API
];

const fetchEvents = async () => {
  // Simulate API call – replace with your actual service
  // e.g., const res = await getCalendarData();
  // return res;
  return [...mockEventsData]; // Return a copy
};

const createEventAPI = async (eventData) => {
  // Simulate – replace with addCalendarEvent(eventData) etc.
  return { ...eventData, id: generateId() };
};

const updateEventAPI = async (id, updates) => {
  return { id, ...updates, updatedAt: new Date().toISOString() };
};

const deleteEventAPI = async (id) => {
  return true;
};

// ----------------------------------------------------------------------------
// PROVIDER
// ----------------------------------------------------------------------------
const CalendarProvider = ({ children }) => {
  // Auth / organisation
  const [userRole, setUserRole] = useState(() => localStorage.getItem('role') || ROLES.ADMIN);
  const [userCentre, setUserCentre] = useState(() => localStorage.getItem('centre_id') || '1');
  const [userId, setUserId] = useState(() => localStorage.getItem('id') || 'usr_001');

  // Calendar state
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // month | week | day | agenda
  const [filters, setFilters] = useState({
    type: 'all',
    scope: 'all',
    service: 'all',
    priority: 'all',
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [quickAddDate, setQuickAddDate] = useState(null);

  // UI
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  // --------------------------------------------------------------------
  // Data fetching (lazy by current month)
  // --------------------------------------------------------------------
  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEvents();
      setEvents(data);
    } catch (err) {
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // --------------------------------------------------------------------
  // Role‑based & filtered events
  // --------------------------------------------------------------------
  const filteredEvents = useMemo(() => {
    let result = [...events];

    // Role‑based filtering
    if (userRole === ROLES.STAFF) {
      result = result.filter(
        (e) =>
          e.scope === SCOPES.GLOBAL ||
          e.assignedTo === userId ||
          e.centre === userCentre
      );
    } else if (userRole === ROLES.ADMIN) {
      result = result.filter(
        (e) =>
          e.scope === SCOPES.GLOBAL ||
          e.centre === userCentre
      );
    }
    // Superadmin sees all

    // Filters
    if (filters.type !== 'all') result = result.filter((e) => e.category === filters.type);
    if (filters.scope !== 'all') result = result.filter((e) => e.scope === filters.scope);
    if (filters.service !== 'all') result = result.filter((e) => e.service === filters.service);
    if (filters.priority !== 'all') result = result.filter((e) => e.priority === filters.priority);

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.service?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [events, filters, searchQuery, userRole, userId, userCentre]);

  // --------------------------------------------------------------------
  // CRUD operations
  // --------------------------------------------------------------------
  const addEvent = useCallback(
    async (data) => {
      try {
        const newEvent = await createEventAPI(data);
        setEvents((prev) => [...prev, newEvent]);
        toast.success('Event created');
        return newEvent;
      } catch {
        toast.error('Failed to create event');
      }
    },
    []
  );

  const updateEvent = useCallback(async (id, data) => {
    try {
      const updated = await updateEventAPI(id, data);
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...updated } : e)));
      toast.success('Event updated');
    } catch {
      toast.error('Failed to update event');
    }
  }, []);

  const deleteEvent = useCallback(async (id) => {
    try {
      await deleteEventAPI(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      toast.success('Event deleted');
      setShowDetailModal(false);
      setSelectedEvent(null);
    } catch {
      toast.error('Failed to delete event');
    }
  }, []);

  const completeEvent = useCallback((id) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, completed: !e.completed } : e))
    );
  }, []);

  // --------------------------------------------------------------------
  // Helper: events for a specific date
  // --------------------------------------------------------------------
  const getEventsForDate = useCallback(
    (date) => filteredEvents.filter((e) => isSameDay(parseISO(e.date), date)),
    [filteredEvents]
  );

  // Quick stats for dashboard widgets
  const todayEvents = useMemo(() => getEventsForDate(new Date()), [getEventsForDate]);
  const overdueEvents = useMemo(
    () =>
      filteredEvents.filter(
        (e) => !e.completed && isPast(parseISO(e.date)) && !isToday(parseISO(e.date))
      ),
    [filteredEvents]
  );
  const upcomingEvents = useMemo(
    () =>
      filteredEvents.filter(
        (e) => !e.completed && isFuture(parseISO(e.date))
      ),
    [filteredEvents]
  );

  // --------------------------------------------------------------------
  // Context value
  // --------------------------------------------------------------------
  const value = {
    // State
    events: filteredEvents,
    currentDate,
    setCurrentDate,
    view,
    setView,
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
    selectedEvent,
    setSelectedEvent,
    showDetailModal,
    setShowDetailModal,
    showEventModal,
    setShowEventModal,
    editingEvent,
    setEditingEvent,
    quickAddDate,
    setQuickAddDate,
    sidebarOpen,
    setSidebarOpen,
    loading,

    // Derived
    todayEvents,
    overdueEvents,
    upcomingEvents,
    getEventsForDate,

    // CRUD
    addEvent,
    updateEvent,
    deleteEvent,
    completeEvent,

    // Auth
    userRole,
    setUserRole,
    userCentre,
    setUserCentre,
    userId,
  };

  return React.createElement(CalendarContext.Provider, { value }, children);
};

// ----------------------------------------------------------------------------
// STATUS BADGE
// ----------------------------------------------------------------------------
const StatusBadge = ({ event }) => {
  const status = getEventStatus(event);
  if (!status) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.class} ${status.pulse ? 'animate-pulse' : ''}`}>
      {status.label}
    </span>
  );
};

// ----------------------------------------------------------------------------
// EVENT CHIP (compact for month view)
// ----------------------------------------------------------------------------
const EventChip = ({ event, compact = true, onClick }) => {
  const color = getColorClasses(COLOR_MAP[event.eventSubType || event.type] || 'amber');
  const status = getEventStatus(event);

  if (compact) {
    return (
      <div
        onClick={(e) => { e.stopPropagation(); onClick(event); }}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs cursor-pointer truncate ${color.bg} ${color.text} border ${color.border} mb-0.5 hover:brightness-95 transition`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${color.dot} flex-shrink-0`} />
        <span className="truncate">{event.title}</span>
        {status && <span className="flex-shrink-0 text-[10px]">{status.label.split(' ')[0]}</span>}
      </div>
    );
  }

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(event); }}
      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${color.bg} ${color.text} border ${color.border} hover:shadow-md transition`}
    >
      <span className={`w-2.5 h-2.5 rounded-full ${color.dot} flex-shrink-0`} />
      <span className="font-medium text-sm truncate flex-1">{event.title}</span>
      {event.time && <span className="text-xs opacity-75">{event.time}</span>}
      {status && <StatusBadge event={event} />}
    </div>
  );
};

// ----------------------------------------------------------------------------
// EVENT DETAIL MODAL
// ----------------------------------------------------------------------------
const EventDetailModal = () => {
  const { selectedEvent, setShowDetailModal, deleteEvent, completeEvent, userRole, userId, editingEvent, setEditingEvent, setShowEventModal } = useCalendarContext();
  if (!selectedEvent) return null;

  const event = selectedEvent;
  const color = getColorClasses(COLOR_MAP[event.eventSubType || event.type] || 'amber');
  const canEdit = userRole === ROLES.SUPERADMIN || (userRole === ROLES.ADMIN && event.scope !== SCOPES.GLOBAL) || event.assignedTo === userId;
  const canDelete = userRole === ROLES.SUPERADMIN || (userRole === ROLES.ADMIN && event.scope !== SCOPES.GLOBAL);

  const handleEdit = () => {
    setShowDetailModal(false);
    setEditingEvent(event);
    setShowEventModal(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDetailModal(false)}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-5 ${color.bg} rounded-t-2xl`}>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <span className="px-2 py-0.5 bg-white/20 rounded text-xs uppercase">{event.category}</span>
              <h2 className="text-xl font-bold mt-1">{event.title}</h2>
            </div>
            <button onClick={() => setShowDetailModal(false)} className="p-1 text-white/80 hover:text-white">
              <FiX className="text-xl" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {event.description && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Description</label>
              <p className="text-gray-700">{event.description}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Date & Time</label>
              <p>{format(parseISO(event.date), 'PPP')}{event.time && ` at ${event.time}`}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Priority</label>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                event.priority === PRIORITIES.HIGH ? 'bg-rose-100 text-rose-700' :
                event.priority === PRIORITIES.MEDIUM ? 'bg-amber-100 text-amber-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>{event.priority}</span>
            </div>
          </div>
          {event.service && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Service</label>
              <p>{event.service}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Assigned To</label>
              <p>{event.assignedName || 'Unassigned'}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Scope</label>
              <p className="capitalize">{event.scope}</p>
            </div>
          </div>
          {event.centre && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Centre</label>
              <p>{event.centre}</p>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Status</label>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${event.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
              {event.completed ? 'Completed' : 'Pending'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-between">
          <div className="flex gap-2">
            {canEdit && (
              <button onClick={handleEdit} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600">
                <FiEdit className="mr-1 inline" /> Edit
              </button>
            )}
            {canDelete && (
              <button onClick={() => { if (confirm('Delete this event?')) deleteEvent(event.id); }} className="px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-medium hover:bg-rose-600">
                <FiTrash2 className="mr-1 inline" /> Delete
              </button>
            )}
          </div>
          <button
            onClick={() => completeEvent(event.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              event.completed ? 'bg-gray-200 text-gray-600' : 'bg-emerald-500 text-white hover:bg-emerald-600'
            }`}
          >
            <FiCheck className="mr-1 inline" /> {event.completed ? 'Reopen' : 'Mark Complete'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// CREATE / EDIT EVENT MODAL
// ----------------------------------------------------------------------------
const EventModal = () => {
  const { showEventModal, setShowEventModal, editingEvent, quickAddDate, addEvent, updateEvent, userRole, userCentre, userId } = useCalendarContext();

  const emptyForm = {
    title: '',
    description: '',
    date: quickAddDate ? format(quickAddDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    category: EVENT_CATEGORIES.TASK,
    eventSubType: EVENT_SUB_TYPES.TASK,
    service: '',
    priority: PRIORITIES.MEDIUM,
    scope: userRole === ROLES.SUPERADMIN ? SCOPES.GLOBAL : SCOPES.CENTRE,
    assignedTo: '',
    assignedName: '',
    centre: userCentre,
  };

  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    if (editingEvent) {
      setFormData({
        title: editingEvent.title || '',
        description: editingEvent.description || '',
        date: editingEvent.date ? format(parseISO(editingEvent.date), 'yyyy-MM-dd') : '',
        time: editingEvent.time || '',
        category: editingEvent.category || EVENT_CATEGORIES.TASK,
        eventSubType: editingEvent.eventSubType || editingEvent.type || EVENT_SUB_TYPES.TASK,
        service: editingEvent.service || '',
        priority: editingEvent.priority || PRIORITIES.MEDIUM,
        scope: editingEvent.scope || SCOPES.CENTRE,
        assignedTo: editingEvent.assignedTo || '',
        assignedName: editingEvent.assignedName || '',
        centre: editingEvent.centre || userCentre,
      });
    } else {
      setFormData(emptyForm);
    }
  }, [editingEvent, quickAddDate, userRole, userCentre, showEventModal]);

  if (!showEventModal) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      date: new Date(`${formData.date}T00:00:00`).toISOString(),
    };
    if (editingEvent) {
      updateEvent(editingEvent.id, payload);
    } else {
      addEvent(payload);
    }
    setShowEventModal(false);
  };

  const isSuperAdmin = userRole === ROLES.SUPERADMIN;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowEventModal(false)}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b sticky top-0 bg-white z-10">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">{editingEvent ? 'Edit Event' : 'Create New Event'}</h2>
            <button onClick={() => setShowEventModal(false)} className="p-1 text-gray-500 hover:text-gray-700">
              <FiX className="text-xl" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Title *</label>
            <input required type="text" value={formData.title} onChange={e => setFormData(p => ({...p, title: e.target.value}))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
            <textarea value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Date *</label>
              <input required type="date" value={formData.date} onChange={e => setFormData(p => ({...p, date: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Time</label>
              <input type="time" value={formData.time} onChange={e => setFormData(p => ({...p, time: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {Object.values(EVENT_CATEGORIES).map(cat => (
                <button key={cat} type="button" onClick={() => setFormData(p => ({...p, category: cat, eventSubType: cat === EVENT_CATEGORIES.HOLIDAY ? EVENT_SUB_TYPES.HOLIDAY : EVENT_SUB_TYPES.TASK}))}
                  className={`px-3 py-1.5 rounded-lg text-sm ${formData.category === cat ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{cat}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Event Type</label>
            <select value={formData.eventSubType} onChange={e => setFormData(p => ({...p, eventSubType: e.target.value, type: e.target.value}))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              <option value={EVENT_SUB_TYPES.DEADLINE}>Deadline</option>
              <option value={EVENT_SUB_TYPES.START}>Start</option>
              <option value={EVENT_SUB_TYPES.ANNOUNCEMENT}>Announcement</option>
              <option value={EVENT_SUB_TYPES.EXPIRY}>Expiry</option>
              <option value={EVENT_SUB_TYPES.REMINDER}>Reminder</option>
              <option value={EVENT_SUB_TYPES.TASK}>Task</option>
              <option value={EVENT_SUB_TYPES.HOLIDAY}>Holiday</option>
              <option value={EVENT_SUB_TYPES.EXAM}>Exam</option>
              <option value={EVENT_SUB_TYPES.RESULT}>Result</option>
              <option value={EVENT_SUB_TYPES.FOLLOWUP}>Follow-up</option>
              <option value={EVENT_SUB_TYPES.PROCESSING}>Processing Stage</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Service (optional)</label>
            <select value={formData.service} onChange={e => setFormData(p => ({...p, service: e.target.value}))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              <option value="">None</option>
              {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Priority</label>
              <select value={formData.priority} onChange={e => setFormData(p => ({...p, priority: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value={PRIORITIES.HIGH}>High</option>
                <option value={PRIORITIES.MEDIUM}>Medium</option>
                <option value={PRIORITIES.LOW}>Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Visibility</label>
              <select value={formData.scope} onChange={e => setFormData(p => ({...p, scope: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                disabled={!isSuperAdmin && formData.scope === SCOPES.GLOBAL}>
                <option value={SCOPES.PERSONAL}>Personal</option>
                <option value={SCOPES.CENTRE}>My Centre</option>
                {isSuperAdmin && <option value={SCOPES.GLOBAL}>Global</option>}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Assign To</label>
            <input type="text" value={formData.assignedName} onChange={e => setFormData(p => ({...p, assignedName: e.target.value, assignedTo: e.target.value ? 'staff_custom' : ''}))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Staff name..." />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Centre</label>
            <input type="text" value={formData.centre} onChange={e => setFormData(p => ({...p, centre: e.target.value}))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setShowEventModal(false)}
              className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              {editingEvent ? 'Update Event' : 'Create Event'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// FILTER SIDEBAR
// ----------------------------------------------------------------------------
const FilterSidebar = () => {
  const { filters, setFilters, sidebarOpen, setSidebarOpen } = useCalendarContext();

  const hasActive = Object.values(filters).some(v => v !== 'all');

  if (!sidebarOpen) {
    return (
      <button onClick={() => setSidebarOpen(true)}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-20 bg-white border rounded-r-xl p-2 shadow-lg hover:bg-gray-50">
        <FiFilter className="text-xl text-gray-600" />
      </button>
    );
  }

  return (
    <div className="w-64 flex-shrink-0 bg-white border-r border-gray-200 p-4 overflow-y-auto h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg">Filters</h3>
        <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-600"><FiX /></button>
      </div>
      {hasActive && (
        <button onClick={() => setFilters({ type: 'all', scope: 'all', service: 'all', priority: 'all' })}
          className="w-full mb-4 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-sm hover:bg-rose-100">
          Clear All
        </button>
      )}
      <FilterGroup title="Event Type">
        <FilterBtn active={filters.type === 'all'} onClick={() => setFilters(p => ({...p, type: 'all'}))}>All</FilterBtn>
        <FilterBtn active={filters.type === EVENT_CATEGORIES.APPLICATION} onClick={() => setFilters(p => ({...p, type: EVENT_CATEGORIES.APPLICATION}))}>Application</FilterBtn>
        <FilterBtn active={filters.type === EVENT_CATEGORIES.TASK} onClick={() => setFilters(p => ({...p, type: EVENT_CATEGORIES.TASK}))}>Tasks</FilterBtn>
        <FilterBtn active={filters.type === EVENT_CATEGORIES.SERVICE} onClick={() => setFilters(p => ({...p, type: EVENT_CATEGORIES.SERVICE}))}>Service</FilterBtn>
        <FilterBtn active={filters.type === EVENT_CATEGORIES.HOLIDAY} onClick={() => setFilters(p => ({...p, type: EVENT_CATEGORIES.HOLIDAY}))}>Holiday</FilterBtn>
      </FilterGroup>
      <FilterGroup title="Scope">
        <FilterBtn active={filters.scope === 'all'} onClick={() => setFilters(p => ({...p, scope: 'all'}))}>All</FilterBtn>
        <FilterBtn active={filters.scope === SCOPES.GLOBAL} onClick={() => setFilters(p => ({...p, scope: SCOPES.GLOBAL}))}>Global</FilterBtn>
        <FilterBtn active={filters.scope === SCOPES.CENTRE} onClick={() => setFilters(p => ({...p, scope: SCOPES.CENTRE}))}>My Centre</FilterBtn>
        <FilterBtn active={filters.scope === SCOPES.PERSONAL} onClick={() => setFilters(p => ({...p, scope: SCOPES.PERSONAL}))}>My Tasks</FilterBtn>
      </FilterGroup>
      <FilterGroup title="Service">
        <FilterBtn active={filters.service === 'all'} onClick={() => setFilters(p => ({...p, service: 'all'}))}>All</FilterBtn>
        {SERVICES.map(s => (
          <FilterBtn key={s} active={filters.service === s} onClick={() => setFilters(p => ({...p, service: s}))}>{s}</FilterBtn>
        ))}
      </FilterGroup>
      <FilterGroup title="Priority">
        <FilterBtn active={filters.priority === 'all'} onClick={() => setFilters(p => ({...p, priority: 'all'}))}>All</FilterBtn>
        <FilterBtn active={filters.priority === PRIORITIES.HIGH} onClick={() => setFilters(p => ({...p, priority: PRIORITIES.HIGH}))}>High</FilterBtn>
        <FilterBtn active={filters.priority === PRIORITIES.MEDIUM} onClick={() => setFilters(p => ({...p, priority: PRIORITIES.MEDIUM}))}>Medium</FilterBtn>
        <FilterBtn active={filters.priority === PRIORITIES.LOW} onClick={() => setFilters(p => ({...p, priority: PRIORITIES.LOW}))}>Low</FilterBtn>
      </FilterGroup>
    </div>
  );
};

const FilterGroup = ({ title, children }) => (
  <div className="mb-4">
    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">{title}</h4>
    <div className="space-y-1">{children}</div>
  </div>
);

const FilterBtn = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition ${active ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}
  >
    {children}
  </button>
);

// ----------------------------------------------------------------------------
// MAIN CALENDAR (Combines all views)
// ----------------------------------------------------------------------------
const CalendarMain = () => {
  const {
    currentDate, setCurrentDate, view, setView,
    getEventsForDate, setShowDetailModal, setShowEventModal, setQuickAddDate, setEditingEvent,
  } = useCalendarContext();

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const navigate = (dir) => {
    setCurrentDate(prev => {
      if (view === 'month') return dir === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1);
      if (view === 'week') return dir === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1);
      return dir === 'prev' ? addDays(prev, -1) : addDays(prev, 1);
    });
  };

  const goToToday = () => setCurrentDate(new Date());

  const handleDateClick = (date) => {
    setQuickAddDate(date);
    setEditingEvent(null);
    setShowEventModal(true);
  };

  const handleEventClick = (event) => {
    setEditingEvent(null);
    setShowDetailModal(true);
  };

  return (
    <div className="flex h-full">
      {/* Filters Sidebar */}
      <FilterSidebar />

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between flex-wrap gap-2 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('prev')} className="p-2 hover:bg-gray-100 rounded-lg"><FiChevronLeft /></button>
            <button onClick={goToToday} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600">Today</button>
            <button onClick={() => navigate('next')} className="p-2 hover:bg-gray-100 rounded-lg"><FiChevronRight /></button>
            <h2 className="text-xl font-bold ml-2">
              {view === 'month' && format(currentDate, 'MMMM yyyy')}
              {view === 'week' && `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 0 }), 'MMM d')}`}
              {view === 'day' && format(currentDate, 'EEEE, MMMM d, yyyy')}
              {view === 'agenda' && 'Agenda / Timeline'}
            </h2>
          </div>

          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[
              { key: 'month', icon: FiCalendar, label: 'Month' },
              { key: 'week', icon: FiGrid, label: 'Week' },
              { key: 'day', icon: FiClock, label: 'Day' },
              { key: 'agenda', icon: FiList, label: 'Agenda' },
            ].map(v => (
              <button key={v.key} onClick={() => setView(v.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${view === v.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                <v.icon className="w-4 h-4" /> <span className="hidden sm:inline">{v.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* View content */}
        <div className="flex-1 overflow-y-auto">
          {view === 'month' && <MonthView handleDateClick={handleDateClick} handleEventClick={handleEventClick} />}
          {view === 'week' && <WeekView handleDateClick={handleDateClick} handleEventClick={handleEventClick} />}
          {view === 'day' && <DayView handleDateClick={handleDateClick} handleEventClick={handleEventClick} />}
          {view === 'agenda' && <AgendaView handleEventClick={handleEventClick} />}
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// MONTH VIEW
// ----------------------------------------------------------------------------
const MonthView = ({ handleDateClick, handleEventClick }) => {
  const { currentDate, getEventsForDate } = useCalendarContext();
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    let start = startOfWeek(monthStart, { weekStartsOn: 0 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const arr = [];
    while (start <= end) {
      arr.push(start);
      start = addDays(start, 1);
    }
    // ensure 6 rows
    while (arr.length < 42) arr.push(addDays(arr[arr.length-1], 1));
    return arr.slice(0, 42);
  }, [currentDate]);

  return (
    <div>
      <div className="grid grid-cols-7 border-b bg-gray-50">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="py-2 text-center text-xs font-bold text-gray-500 uppercase">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDate(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isTodayDate = isToday(day);
          return (
            <div
              key={idx}
              onClick={() => handleDateClick(day)}
              className={`border border-gray-100 p-1 min-h-[100px] cursor-pointer transition-colors ${isCurrentMonth ? 'bg-white' : 'bg-gray-50/50'} ${isTodayDate ? 'ring-2 ring-blue-500' : ''}`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={`text-sm font-semibold px-1.5 py-0.5 rounded-full ${isTodayDate ? 'bg-blue-500 text-white' : isCurrentMonth ? 'text-gray-800' : 'text-gray-400'}`}>
                  {getDate(day)}
                </span>
                {dayEvents.length > 3 && <span className="text-xs text-gray-400">+{dayEvents.length - 3}</span>}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(ev => (
                  <EventChip key={ev.id} event={ev} compact onClick={() => handleEventClick(ev)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// WEEK VIEW
// ----------------------------------------------------------------------------
const WeekView = ({ handleDateClick, handleEventClick }) => {
  const { currentDate, getEventsForDate } = useCalendarContext();
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 - 20:00

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-8 border-b bg-gray-50 sticky top-0 z-10">
        <div className="py-2 px-3 text-xs font-bold text-gray-500">Time</div>
        {weekDays.map((day, idx) => (
          <div key={idx} className={`py-2 text-center border-r ${isToday(day) ? 'bg-blue-50' : ''}`}>
            <div className="text-xs font-bold text-gray-500">{format(day, 'EEE')}</div>
            <div className={`text-xl font-bold ${isToday(day) ? 'text-blue-600' : 'text-gray-800'}`}>{getDate(day)}</div>
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-8">
          <div>
            {hours.map(h => (
              <div key={h} className="h-16 border-b border-r text-xs text-gray-400 text-right pr-2 pt-0.5">{`${h}:00`}</div>
            ))}
          </div>
          {weekDays.map((day, dayIdx) => {
            const dayEvents = getEventsForDate(day);
            return (
              <div key={dayIdx} className="relative" onClick={() => handleDateClick(day)}>
                {hours.map(h => (
                  <div key={h} className="h-16 border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer" />
                ))}
                {dayEvents.map(ev => {
                  const hour = ev.time ? parseInt(ev.time.split(':')[0]) : 9;
                  const top = Math.max(0, (hour - 7) * 64);
                  const color = getColorClasses(COLOR_MAP[ev.eventSubType || 'task']);
                  return (
                    <div key={ev.id} onClick={(e) => { e.stopPropagation(); handleEventClick(ev); }}
                      className={`absolute left-1 right-1 px-1.5 py-1 rounded text-xs cursor-pointer ${color.bg} ${color.text} border ${color.border} z-10 truncate`}
                      style={{ top: `${top}px`, minHeight: '24px' }}>
                      <span className="font-semibold">{ev.time} {ev.title}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// DAY VIEW
// ----------------------------------------------------------------------------
const DayView = ({ handleDateClick, handleEventClick }) => {
  const { currentDate, getEventsForDate } = useCalendarContext();
  const dayEvents = getEventsForDate(currentDate);
  const hours = Array.from({ length: 16 }, (_, i) => i + 6);

  return (
    <div className="p-4">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold">{format(currentDate, 'EEEE, MMMM d, yyyy')}</h2>
        {isToday(currentDate) && <span className="inline-block mt-1 px-3 py-0.5 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">Today</span>}
      </div>
      <div className="space-y-1">
        {hours.map(hour => {
          const hourEvents = dayEvents.filter(e => {
            if (!e.time) return false;
            return parseInt(e.time.split(':')[0]) === hour;
          });
          return (
            <div key={hour} className="flex border-b border-gray-100 min-h-[60px] hover:bg-gray-50/50 cursor-pointer" onClick={() => handleDateClick(setDate(setMonth(setYear(currentDate, getYear(currentDate)), getMonth(currentDate)), getDate(currentDate)))}>
              <div className="w-20 flex-shrink-0 py-2 px-3 text-right text-sm text-gray-500 font-medium border-r">{`${hour}:00`}</div>
              <div className="flex-1 py-1 px-2">
                {hourEvents.map(ev => (
                  <EventChip key={ev.id} event={ev} compact={false} onClick={() => handleEventClick(ev)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// AGENDA VIEW
// ----------------------------------------------------------------------------
const AgendaView = ({ handleEventClick }) => {
  const { todayEvents, overdueEvents, upcomingEvents } = useCalendarContext();
  const [activeTab, setActiveTab] = useState('today');

  const tabs = [
    { key: 'today', label: 'Today', events: todayEvents, color: 'text-blue-600' },
    { key: 'overdue', label: 'Overdue', events: overdueEvents, color: 'text-rose-600' },
    { key: 'upcoming', label: 'Upcoming', events: upcomingEvents, color: 'text-purple-600' },
  ];

  const currentTab = tabs.find(t => t.key === activeTab);

  return (
    <div className="p-4">
      <div className="flex gap-4 mb-4 border-b">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`pb-2 px-2 text-sm font-semibold border-b-2 transition ${activeTab === tab.key ? `${tab.color} border-current` : 'text-gray-500 border-transparent hover:text-gray-700'}`}>
            {tab.label} ({tab.events.length})
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {currentTab.events.length === 0 ? (
          <p className="text-center text-gray-400 py-4">No events</p>
        ) : (
          currentTab.events.sort((a, b) => (a.date > b.date ? 1 : -1)).map(ev => (
            <div key={ev.id} onClick={() => handleEventClick(ev)}
              className="bg-white rounded-xl p-4 shadow-sm border hover:shadow-md transition cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${getColorClasses(COLOR_MAP[ev.eventSubType || 'task']).dot}`}></span>
                    <span className="text-xs font-semibold uppercase text-gray-500">{ev.category}</span>
                    <StatusBadge event={ev} />
                  </div>
                  <h4 className="font-bold">{ev.title}</h4>
                  {ev.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{ev.description}</p>}
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-sm font-semibold">{ev.time || 'All day'}</p>
                  {ev.service && <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 rounded text-xs">{ev.service}</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// EXPORTED CALENDAR COMPONENT
// ----------------------------------------------------------------------------
const CalendarView = () => {
  return (
    <CalendarProvider>
      <div className="h-full flex flex-col">
        <ToastContainer position="top-right" autoClose={3000} />
        <CalendarMain />
        <EventDetailModal />
        <EventModal />
      </div>
    </CalendarProvider>
  );
};

export default CalendarView;