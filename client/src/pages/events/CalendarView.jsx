/**
 * 🗓️ Dribbble‑inspired Legal Calendar Style
 * Default view: "List" (vertical timeline grouped by day).
 * Other views: Month, Week, Day (classic), Agenda (text list).
 */

import React, {
  useState, useEffect, useMemo, useCallback, useContext,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths,
  addWeeks, subWeeks, isSameDay, isSameMonth, isToday, isPast, isFuture,
  format, parseISO, differenceInDays, getDate, getMonth, getYear, setDate, setMonth, setYear,
} from 'date-fns';
import {
  FiChevronLeft, FiChevronRight, FiPlus, FiSearch, FiFilter, FiCalendar,
  FiClock, FiList, FiGrid, FiMapPin, FiUser, FiCheck, FiX, FiTrash2,
  FiEdit, FiMoreHorizontal, FiArrowDown, FiArrowUp,
} from 'react-icons/fi';

/* -------------------------------------------------------------------------- */
/*   TYPES & CONSTANTS                                                        */
/* -------------------------------------------------------------------------- */
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

// Colour map for left border & badge
const BORDER_COLORS = {
  [EVENT_SUB_TYPES.DEADLINE]: '#EF4444', // red
  [EVENT_SUB_TYPES.START]: '#22C55E',    // green
  [EVENT_SUB_TYPES.ANNOUNCEMENT]: '#3B82F6', // blue
  [EVENT_SUB_TYPES.TASK]: '#EAB308',     // yellow
  [EVENT_SUB_TYPES.HOLIDAY]: '#6B7280',  // gray
  [EVENT_SUB_TYPES.EXPIRY]: '#EF4444',
  [EVENT_SUB_TYPES.REMINDER]: '#EAB308',
  [EVENT_SUB_TYPES.EXAM]: '#EF4444',
  [EVENT_SUB_TYPES.RESULT]: '#3B82F6',
  [EVENT_SUB_TYPES.FOLLOWUP]: '#EAB308',
  [EVENT_SUB_TYPES.PROCESSING]: '#22C55E',
};

const getEventStatus = (event) => {
  const now = new Date();
  const d = typeof event.date === 'string' ? parseISO(event.date) : event.date;
  if (event.completed) return { label: '✓ Done', color: '#10B981' };
  if (isPast(d) && !isToday(d)) return { label: '⚠ Overdue', color: '#EF4444' };
  if (isToday(d)) return { label: '🔴 Due Today', color: '#F59E0B' };
  if (differenceInDays(d, now) <= 3) return { label: '⏳ Upcoming', color: '#8B5CF6' };
  return null;
};

/* -------------------------------------------------------------------------- */
/*   MOCK API (replace with real services)                                    */
/* -------------------------------------------------------------------------- */
const fetchEvents = async () => [
  // Example events for initial render – you can replace with actual API call
];
const createEventAPI = async (d) => ({ ...d, id: 'evt_' + Date.now() });
const updateEventAPI = async (id, d) => ({ ...d, id });
const deleteEventAPI = async () => true;

/* -------------------------------------------------------------------------- */
/*   CONTEXT                                                                  */
/* -------------------------------------------------------------------------- */
const CalendarContext = React.createContext();
const useCal = () => useContext(CalendarContext);

const CalendarProvider = ({ children }) => {
  // States
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('list');  // default = list
  const [filters, setFilters] = useState({ type: 'all', scope: 'all', service: 'all', priority: 'all' });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [quickAddDate, setQuickAddDate] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // for filters drawer

  const userId = localStorage.getItem('id') || 'staff_001';
  const userRole = localStorage.getItem('role') || ROLES.ADMIN;
  const userCentre = localStorage.getItem('centre_id') || '1';

  // Fetch events (simulated)
  useEffect(() => { fetchEvents().then(setEvents); }, []);

  // Filtered events (role + filters + search)
  const filteredEvents = useMemo(() => {
    let res = events;
    if (userRole === ROLES.STAFF) res = res.filter(e => e.scope === SCOPES.GLOBAL || e.assignedTo === userId || e.centre === userCentre);
    else if (userRole === ROLES.ADMIN) res = res.filter(e => e.scope === SCOPES.GLOBAL || e.centre === userCentre);
    if (filters.type !== 'all') res = res.filter(e => e.category === filters.type);
    if (filters.scope !== 'all') res = res.filter(e => e.scope === filters.scope);
    if (filters.service !== 'all') res = res.filter(e => e.service === filters.service);
    if (filters.priority !== 'all') res = res.filter(e => e.priority === filters.priority);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      res = res.filter(e => e.title?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q) || e.service?.toLowerCase().includes(q));
    }
    return res;
  }, [events, filters, searchQuery, userRole, userId, userCentre]);

  // Helpers
  const getEventsForDate = useCallback((date) => filteredEvents.filter(e => isSameDay(parseISO(e.date), date)), [filteredEvents]);
  const todayEvents = useMemo(() => getEventsForDate(new Date()), [getEventsForDate]);
  const overdueEvents = useMemo(() => filteredEvents.filter(e => !e.completed && isPast(parseISO(e.date)) && !isToday(parseISO(e.date))), [filteredEvents]);
  const upcomingEvents = useMemo(() => filteredEvents.filter(e => !e.completed && isFuture(parseISO(e.date))), [filteredEvents]);

  // CRUD
  const addEvent = useCallback(async (data) => {
    const ev = await createEventAPI(data);
    setEvents(prev => [...prev, ev]);
    toast.success('Event created');
  }, []);
  const updateEvent = useCallback(async (id, data) => {
    const ev = await updateEventAPI(id, data);
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...ev } : e));
    toast.success('Updated');
  }, []);
  const deleteEvent = useCallback(async (id) => {
    await deleteEventAPI(id);
    setEvents(prev => prev.filter(e => e.id !== id));
    toast.success('Deleted');
    setShowDetail(false);
  }, []);
  const completeEvent = useCallback((id) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, completed: !e.completed } : e));
  }, []);

  const ctx = {
    events: filteredEvents, currentDate, setCurrentDate, view, setView,
    filters, setFilters, searchQuery, setSearchQuery,
    selectedEvent, setSelectedEvent, showDetail, setShowDetail,
    showForm, setShowForm, editingEvent, setEditingEvent,
    quickAddDate, setQuickAddDate, sidebarOpen, setSidebarOpen,
    todayEvents, overdueEvents, upcomingEvents, getEventsForDate,
    addEvent, updateEvent, deleteEvent, completeEvent,
    userRole, userCentre, userId,
  };
  return React.createElement(CalendarContext.Provider, { value: ctx }, children);
};

/* -------------------------------------------------------------------------- */
/*   FILTERS DRAWER                                                           */
/* -------------------------------------------------------------------------- */
const FilterDrawer = () => {
  const { filters, setFilters, sidebarOpen, setSidebarOpen } = useCal();
  const hasActive = Object.values(filters).some(v => v !== 'all');

  return (
    <AnimatePresence>
      {sidebarOpen && (
        <motion.div
          initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
          className="fixed left-0 top-0 h-full w-72 bg-white shadow-xl z-50 p-6 border-r overflow-y-auto"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-bold text-lg text-gray-800">Filters</h2>
            <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-gray-100 rounded"><FiX /></button>
          </div>
          {hasActive && (
            <button onClick={() => setFilters({ type: 'all', scope: 'all', service: 'all', priority: 'all' })}
              className="w-full mb-4 text-sm text-red-600 hover:text-red-800 font-medium">
              Clear all filters
            </button>
          )}
          <FilterSection title="Type">
            <FilterOption active={filters.type === 'all'} onClick={() => setFilters(p => ({ ...p, type: 'all' }))}>All</FilterOption>
            <FilterOption active={filters.type === EVENT_CATEGORIES.APPLICATION} onClick={() => setFilters(p => ({ ...p, type: EVENT_CATEGORIES.APPLICATION }))}>Application</FilterOption>
            <FilterOption active={filters.type === EVENT_CATEGORIES.TASK} onClick={() => setFilters(p => ({ ...p, type: EVENT_CATEGORIES.TASK }))}>Tasks</FilterOption>
            <FilterOption active={filters.type === EVENT_CATEGORIES.SERVICE} onClick={() => setFilters(p => ({ ...p, type: EVENT_CATEGORIES.SERVICE }))}>Service</FilterOption>
            <FilterOption active={filters.type === EVENT_CATEGORIES.HOLIDAY} onClick={() => setFilters(p => ({ ...p, type: EVENT_CATEGORIES.HOLIDAY }))}>Holiday</FilterOption>
          </FilterSection>
          <FilterSection title="Scope">
            <FilterOption active={filters.scope === 'all'} onClick={() => setFilters(p => ({ ...p, scope: 'all' }))}>All</FilterOption>
            <FilterOption active={filters.scope === SCOPES.GLOBAL} onClick={() => setFilters(p => ({ ...p, scope: SCOPES.GLOBAL }))}>Global</FilterOption>
            <FilterOption active={filters.scope === SCOPES.CENTRE} onClick={() => setFilters(p => ({ ...p, scope: SCOPES.CENTRE }))}>My centre</FilterOption>
            <FilterOption active={filters.scope === SCOPES.PERSONAL} onClick={() => setFilters(p => ({ ...p, scope: SCOPES.PERSONAL }))}>My tasks</FilterOption>
          </FilterSection>
          <FilterSection title="Service">
            <FilterOption active={filters.service === 'all'} onClick={() => setFilters(p => ({ ...p, service: 'all' }))}>All</FilterOption>
            {SERVICES.map(s => (
              <FilterOption key={s} active={filters.service === s} onClick={() => setFilters(p => ({ ...p, service: s }))}>{s}</FilterOption>
            ))}
          </FilterSection>
          <FilterSection title="Priority">
            <FilterOption active={filters.priority === 'all'} onClick={() => setFilters(p => ({ ...p, priority: 'all' }))}>All</FilterOption>
            <FilterOption active={filters.priority === 'high'} onClick={() => setFilters(p => ({ ...p, priority: 'high' }))}>High</FilterOption>
            <FilterOption active={filters.priority === 'medium'} onClick={() => setFilters(p => ({ ...p, priority: 'medium' }))}>Medium</FilterOption>
            <FilterOption active={filters.priority === 'low'} onClick={() => setFilters(p => ({ ...p, priority: 'low' }))}>Low</FilterOption>
          </FilterSection>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const FilterSection = ({ title, children }) => (
  <div className="mb-6">
    <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">{title}</h3>
    <div className="space-y-1">{children}</div>
  </div>
);

const FilterOption = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${active ? 'bg-gray-100 font-medium text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
  >
    {children}
  </button>
);

/* -------------------------------------------------------------------------- */
/*   EVENT DETAIL MODAL (compact, on‑click)                                   */
/* -------------------------------------------------------------------------- */
const EventDetailModal = () => {
  const { selectedEvent, setShowDetail, deleteEvent, completeEvent, userRole, userId, setEditingEvent, setShowForm } = useCal();
  if (!selectedEvent) return null;
  const ev = selectedEvent;
  const canEdit = userRole === ROLES.SUPERADMIN || (userRole === ROLES.ADMIN && ev.scope !== SCOPES.GLOBAL) || ev.assignedTo === userId;
  const canDelete = userRole === ROLES.SUPERADMIN || (userRole === ROLES.ADMIN && ev.scope !== SCOPES.GLOBAL);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowDetail(false)}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs uppercase text-gray-400">{ev.category}</span>
              <h2 className="text-xl font-bold mt-1">{ev.title}</h2>
            </div>
            <button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-gray-600"><FiX /></button>
          </div>
          <div className="flex items-center gap-2 mt-3 text-sm">
            <FiClock className="text-gray-400" />
            <span>{format(parseISO(ev.date), 'PPP')}{ev.time ? `, ${ev.time} - ${ev.endTime || ''}` : ''}</span>
          </div>
          {ev.location && (
            <div className="flex items-center gap-2 mt-1 text-sm">
              <FiMapPin className="text-gray-400" />
              <span>{ev.location}</span>
            </div>
          )}
          {ev.description && <p className="mt-3 text-gray-600 text-sm">{ev.description}</p>}
          <div className="flex items-center gap-4 mt-4 text-sm">
            <span className={`px-2 py-1 rounded ${ev.completed ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {ev.completed ? 'Completed' : 'Pending'}
            </span>
            {ev.assignedName && <span className="text-gray-500">· {ev.assignedName}</span>}
          </div>
        </div>
        <div className="bg-gray-50 px-5 py-3 flex justify-between items-center border-t">
          <div className="flex gap-2">
            {canEdit && (
              <button onClick={() => { setShowDetail(false); setEditingEvent(ev); setShowForm(true); }} className="text-xs px-3 py-1.5 bg-white border rounded-lg hover:bg-gray-100">Edit</button>
            )}
            {canDelete && (
              <button onClick={() => { if (confirm('Delete?')) deleteEvent(ev.id); }} className="text-xs px-3 py-1.5 bg-white border rounded-lg text-red-600 hover:bg-red-50">Delete</button>
            )}
          </div>
          <button onClick={() => completeEvent(ev.id)} className={`text-xs px-3 py-1.5 rounded-lg ${ev.completed ? 'bg-gray-200 text-gray-600' : 'bg-green-500 text-white hover:bg-green-600'}`}>
            {ev.completed ? 'Reopen' : 'Mark Complete'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*   EVENT FORM MODAL (create / edit)                                         */
/* -------------------------------------------------------------------------- */
const EventFormModal = () => {
  const { showForm, setShowForm, editingEvent, quickAddDate, addEvent, updateEvent, userRole, userCentre } = useCal();
  const empty = () => ({
    title: '', description: '', date: quickAddDate ? format(quickAddDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    time: '09:00', endTime: '', location: '', category: EVENT_CATEGORIES.TASK,
    eventSubType: EVENT_SUB_TYPES.TASK, service: '', priority: PRIORITIES.MEDIUM,
    scope: userRole === ROLES.SUPERADMIN ? SCOPES.GLOBAL : SCOPES.CENTRE,
    assignedName: '', assignedTo: '', centre: userCentre,
  });
  const [form, setForm] = useState(empty());
  useEffect(() => {
    if (editingEvent) {
      setForm({
        title: editingEvent.title || '', description: editingEvent.description || '',
        date: editingEvent.date ? format(parseISO(editingEvent.date), 'yyyy-MM-dd') : '',
        time: editingEvent.time || '', endTime: editingEvent.endTime || '', location: editingEvent.location || '',
        category: editingEvent.category || EVENT_CATEGORIES.TASK, eventSubType: editingEvent.eventSubType || EVENT_SUB_TYPES.TASK,
        service: editingEvent.service || '', priority: editingEvent.priority || PRIORITIES.MEDIUM,
        scope: editingEvent.scope || SCOPES.CENTRE, assignedName: editingEvent.assignedName || '',
        assignedTo: editingEvent.assignedTo || '', centre: editingEvent.centre || userCentre,
      });
    } else {
      setForm(empty());
    }
  }, [editingEvent, quickAddDate]);
  if (!showForm) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...form, date: new Date(`${form.date}T00:00:00`).toISOString() };
    if (editingEvent) updateEvent(editingEvent.id, payload);
    else addEvent(payload);
    setShowForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b flex justify-between">
          <h2 className="font-bold text-lg">{editingEvent ? 'Edit event' : 'New event'}</h2>
          <button onClick={() => setShowForm(false)}><FiX /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <input required value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} placeholder="Event title" className="w-full px-3 py-2 border rounded-lg text-sm" />
          <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="Description" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <input required type="date" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" />
            <div className="flex gap-2">
              <input type="time" value={form.time} onChange={e => setForm(p => ({...p, time: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <input type="time" value={form.endTime} onChange={e => setForm(p => ({...p, endTime: e.target.value}))} placeholder="End" className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <input value={form.location} onChange={e => setForm(p => ({...p, location: e.target.value}))} placeholder="Location" className="w-full px-3 py-2 border rounded-lg text-sm" />
          <div className="flex flex-wrap gap-2">
            {Object.values(EVENT_CATEGORIES).map(cat => (
              <button key={cat} type="button" onClick={() => setForm(p => ({...p, category: cat}))}
                className={`px-3 py-1 rounded-lg border text-sm ${form.category === cat ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{cat}</button>
            ))}
          </div>
          <select value={form.eventSubType} onChange={e => setForm(p => ({...p, eventSubType: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
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
          </select>
          <select value={form.service} onChange={e => setForm(p => ({...p, service: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
            <option value="">No service</option>
            {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <select value={form.priority} onChange={e => setForm(p => ({...p, priority: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
            <select value={form.scope} onChange={e => setForm(p => ({...p, scope: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value={SCOPES.PERSONAL}>Personal</option><option value={SCOPES.CENTRE}>My centre</option>
              {userRole === ROLES.SUPERADMIN && <option value={SCOPES.GLOBAL}>Global</option>}
            </select>
          </div>
          <input value={form.assignedName} onChange={e => setForm(p => ({...p, assignedName: e.target.value, assignedTo: e.target.value ? 'staff_custom' : ''}))} placeholder="Assign to…" className="w-full px-3 py-2 border rounded-lg text-sm" />
          <input value={form.centre} onChange={e => setForm(p => ({...p, centre: e.target.value}))} placeholder="Centre" className="w-full px-3 py-2 border rounded-lg text-sm" />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">{editingEvent ? 'Save' : 'Create event'}</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*   MAIN HEADER (date range, view toggles, actions)                          */
/* -------------------------------------------------------------------------- */
const CalendarHeader = () => {
  const { currentDate, setCurrentDate, view, setView, sidebarOpen, setSidebarOpen, setShowForm, setEditingEvent, setQuickAddDate } = useCal();

  const goToday = () => {
    setCurrentDate(new Date());
  };

  const goPrev = () => {
    setCurrentDate(prev => {
      if (view === 'month') return subMonths(prev, 1);
      if (view === 'week') return subWeeks(prev, 1);
      return addDays(prev, -1);
    });
  };

  const goNext = () => {
    setCurrentDate(prev => {
      if (view === 'month') return addMonths(prev, 1);
      if (view === 'week') return addWeeks(prev, 1);
      return addDays(prev, 1);
    });
  };

  const getDateRangeLabel = () => {
    if (view === 'month') return format(currentDate, 'MMMM yyyy');
    if (view === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = addDays(start, 6);
      return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
    }
    return format(currentDate, 'EEEE, MMMM d, yyyy');
  };

  return (
    <div className="bg-white border-b px-4 py-2 flex items-center justify-between gap-4 flex-wrap">
      {/* Left: navigation + date */}
      <div className="flex items-center gap-2">
        <button onClick={goPrev} className="p-1.5 hover:bg-gray-100 rounded"><FiChevronLeft size={18} /></button>
        <button onClick={goNext} className="p-1.5 hover:bg-gray-100 rounded"><FiChevronRight size={18} /></button>
        <h1 className="text-base font-semibold whitespace-nowrap">{getDateRangeLabel()}</h1>
        <button onClick={goToday} className="ml-2 text-sm font-medium text-blue-600 hover:text-blue-800">Today</button>
      </div>

      {/* Center: search */}
      <div className="hidden sm:flex items-center bg-gray-50 border rounded-lg px-3 py-1.5 w-60">
        <FiSearch size={16} className="text-gray-400 mr-2" />
        <input
          type="text"
          placeholder="Search events…"
          className="bg-transparent text-sm outline-none w-full"
          value={useCal().searchQuery}
          onChange={e => useCal().setSearchQuery(e.target.value)}
        />
      </div>

      {/* Right: view toggles + actions */}
      <div className="flex items-center gap-2">
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {[
            { key: 'month', Icon: FiCalendar },
            { key: 'week', Icon: FiGrid },
            { key: 'day', Icon: FiClock },
            { key: 'list', Icon: FiList },
          ].map(({ key, Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`p-1.5 rounded-md transition ${view === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 hover:bg-gray-100 rounded-lg relative"
          title="Filters"
        >
          <FiFilter size={18} className="text-gray-600" />
          {Object.values(useCal().filters).some(v => v !== 'all') && (
            <span className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full" />
          )}
        </button>
        <button
          onClick={() => { setEditingEvent(null); setQuickAddDate(null); setShowForm(true); }}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <FiPlus size={16} /> New Event
        </button>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*   LIST VIEW (Dribbble style) – grouped by day, vertical timeline           */
/* -------------------------------------------------------------------------- */
const ListView = () => {
  const { currentDate, events, setSelectedEvent, setShowDetail } = useCal();
  // Show events for 7 days starting from Monday of current week
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // Sunday start? Dribbble shows Sun-Sat
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const grouped = days.map(day => {
    const dayEvents = events.filter(e => isSameDay(parseISO(e.date), day));
    const allDay = dayEvents.filter(e => !e.time || e.time === '00:00');
    const timed = dayEvents.filter(e => e.time && e.time !== '00:00').sort((a, b) => a.time.localeCompare(b.time));
    return { date: day, allDay, timed };
  });

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-7 gap-4">
        {/* Date headers */}
        {days.map((day, idx) => (
          <div key={idx} className="text-center border-b pb-2">
            <div className="text-xs font-semibold text-gray-500 uppercase">{format(day, 'EEE')}</div>
            <div className={`text-2xl font-bold mt-1 ${isToday(day) ? 'text-blue-600' : 'text-gray-900'}`}>{format(day, 'd')}</div>
          </div>
        ))}
      </div>

      {/* Display days side‑by‑side, each with its events stacked */}
      <div className="grid grid-cols-7 gap-4 mt-4">
        {grouped.map(({ date, allDay, timed }, idx) => (
          <div key={idx} className="space-y-3">
            {/* All day events */}
            {allDay.map(ev => (
              <div
                key={ev.id}
                onClick={() => { setSelectedEvent(ev); setShowDetail(true); }}
                className="bg-purple-50 border-l-4 rounded-r-lg px-3 py-2 text-sm cursor-pointer hover:shadow-sm transition"
                style={{ borderLeftColor: BORDER_COLORS[ev.eventSubType] || '#6B7280' }}
              >
                <div className="font-medium text-gray-900">{ev.title}</div>
                {ev.description && <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{ev.description}</div>}
              </div>
            ))}

            {/* Timed events – show a placeholder for each hour block */}
            <div className="space-y-1">
              {timed.map(ev => {
                const hour = parseInt(ev.time.split(':')[0]);
                // simple display: just list with time
                return (
                  <div key={ev.id}
                    onClick={() => { setSelectedEvent(ev); setShowDetail(true); }}
                    className="flex items-start gap-2 group cursor-pointer"
                  >
                    <div className="w-12 text-right text-xs text-gray-400 pt-0.5">{ev.time}</div>
                    <div
                      className="flex-1 bg-white border rounded-lg p-2 text-sm hover:shadow-sm transition"
                      style={{ borderLeftWidth: 3, borderLeftColor: BORDER_COLORS[ev.eventSubType] || '#6B7280' }}
                    >
                      <div className="font-medium">{ev.title}</div>
                      <div className="text-xs text-gray-500">{ev.time}{ev.endTime ? ` - ${ev.endTime}` : ''}</div>
                      {ev.location && <div className="text-xs text-gray-400 flex items-center gap-1"><FiMapPin size={10} /> {ev.location}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*   OTHER VIEWS (kept simple)                                                */
/* -------------------------------------------------------------------------- */
const MonthView = () => {
  const { currentDate, getEventsForDate, setSelectedEvent, setShowDetail, setQuickAddDate, setEditingEvent, setShowForm } = useCal();
  const days = useMemo(() => {
    const s = startOfMonth(currentDate), e = endOfMonth(currentDate);
    let st = startOfWeek(s, { weekStartsOn: 0 }), en = endOfWeek(e, { weekStartsOn: 0 });
    const arr = [];
    let d = st;
    while (d <= en) { arr.push(d); d = addDays(d, 1); }
    while (arr.length < 42) arr.push(addDays(arr[arr.length - 1], 1));
    return arr.slice(0, 42);
  }, [currentDate]);

  return (
    <div className="p-2">
      <div className="grid grid-cols-7 text-xs text-gray-400 font-medium mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="py-1 text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-xl">
        {days.map((day, idx) => {
          const evs = getEventsForDate(day);
          const isCur = isSameMonth(day, currentDate);
          const today = isToday(day);
          return (
            <div key={idx}
              onClick={() => { setQuickAddDate(day); setEditingEvent(null); setShowForm(true); }}
              className={`bg-white p-1 min-h-[90px] cursor-pointer hover:bg-gray-50 transition ${!isCur ? 'opacity-40' : ''} ${today ? 'ring-2 ring-inset ring-blue-400' : ''}`}
            >
              <div className="text-right mb-1"><span className={`text-xs font-semibold ${today ? 'bg-blue-500 text-white rounded-full w-5 h-5 inline-flex items-center justify-center' : ''}`}>{getDate(day)}</span></div>
              <div className="space-y-0.5">
                {evs.slice(0, 3).map(ev => (
                  <div key={ev.id} onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); setShowDetail(true); }}
                    className="text-xs px-1 py-0.5 rounded bg-gray-50 border truncate" style={{ borderLeftColor: BORDER_COLORS[ev.eventSubType] || '#6B7280', borderLeftWidth: 2 }}>
                    {ev.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const WeekView = () => {
  const { currentDate, getEventsForDate } = useCal();
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(currentDate, { weekStartsOn: 0 }), i)), [currentDate]);
  const hours = Array.from({ length: 14 }, (_, i) => i + 7);
  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-8 text-xs border-b">
        <div className="py-1 px-2 text-gray-400"></div>
        {weekDays.map((d, i) => <div key={i} className={`py-1 text-center font-medium ${isToday(d) ? 'text-blue-600' : ''}`}>{format(d, 'EEE d')}</div>)}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-8">
          <div>{hours.map(h => <div key={h} className="h-12 border-r text-xs text-gray-400 text-right pr-1">{h}:00</div>)}</div>
          {weekDays.map((day, di) => {
            const evs = getEventsForDate(day);
            return <div key={di} className="relative border-r">
              {hours.map(h => <div key={h} className="h-12 border-b border-gray-50 hover:bg-gray-50/30 cursor-pointer"></div>)}
              {evs.map(ev => {
                const hour = ev.time ? parseInt(ev.time.split(':')[0]) : 9;
                const top = (hour - 7) * 48;
                return <div key={ev.id} className="absolute left-1 right-1 px-1 py-0.5 text-xs bg-blue-50 border border-blue-200 rounded truncate" style={{ top }}>{ev.time} {ev.title}</div>;
              })}
            </div>;
          })}
        </div>
      </div>
    </div>
  );
};

const DayView = () => {
  const { currentDate, getEventsForDate } = useCal();
  const evs = getEventsForDate(currentDate);
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">{format(currentDate, 'EEEE, MMMM d')}</h2>
      <div className="space-y-1">
        {Array.from({ length: 14 }, (_, i) => i + 7).map(h => {
          const hourEvs = evs.filter(e => e.time && parseInt(e.time.split(':')[0]) === h);
          return <div key={h} className="flex border-b border-gray-100 h-14 hover:bg-gray-50/50">
            <div className="w-16 text-xs text-gray-400 pt-1">{h}:00</div>
            <div className="flex-1">{hourEvs.map(e => <div key={e.id} className="text-sm px-2 py-1">{e.title}</div>)}</div>
          </div>;
        })}
      </div>
    </div>
  );
};

const AgendaView = () => {
  const { todayEvents, overdueEvents, upcomingEvents, setSelectedEvent, setShowDetail } = useCal();
  const [tab, setTab] = useState('today');
  const tabs = [
    { k: 'today', l: 'Today', e: todayEvents },
    { k: 'overdue', l: 'Overdue', e: overdueEvents },
    { k: 'upcoming', l: 'Upcoming', e: upcomingEvents },
  ];
  const cur = tabs.find(t => t.k === tab);
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex gap-6 mb-6 border-b border-gray-100">
        {tabs.map(t => <button key={t.k} onClick={() => setTab(t.k)} className={`pb-2 text-sm font-medium ${tab === t.k ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>{t.l} · {t.e.length}</button>)}
      </div>
      <div className="space-y-3">
        {cur.e.length === 0 ? <p className="text-gray-400 text-center py-10">No events</p> :
          cur.e.map(ev => (
            <div key={ev.id} onClick={() => { setSelectedEvent(ev); setShowDetail(true); }} className="bg-white border rounded-xl p-3 hover:shadow-sm cursor-pointer">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BORDER_COLORS[ev.eventSubType] || '#6B7280' }}></span>
                <span className="font-medium">{ev.title}</span>
                <span className="text-xs text-gray-400 ml-auto">{ev.time}</span>
              </div>
              {ev.location && <div className="text-xs text-gray-500 mt-1 flex items-center gap-1"><FiMapPin size={10} />{ev.location}</div>}
            </div>
          ))
        }
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*   ROOT COMPONENT                                                           */
/* -------------------------------------------------------------------------- */
const CalendarView = () => {
  const { view } = useCal();
  return (
    <CalendarProvider>
      <div className="h-screen flex flex-col bg-white text-gray-800">
        <ToastContainer position="top-right" autoClose={3000} hideProgressBar />
        {/* Filters drawer */}
        <FilterDrawer />
        {/* Header */}
        <CalendarHeader />
        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {view === 'list' && <ListView />}
          {view === 'month' && <MonthView />}
          {view === 'week' && <WeekView />}
          {view === 'day' && <DayView />}
          {view === 'agenda' && <AgendaView />}
        </div>
        {/* Modals */}
        <EventDetailModal />
        <EventFormModal />
      </div>
    </CalendarProvider>
  );
};

export default CalendarView;