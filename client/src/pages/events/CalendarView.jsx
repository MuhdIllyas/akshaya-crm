/**
 * 📅 Notion‑like Central Planning & Alert Calendar
 *
 * Designed with clean typography, soft shadows, minimal cards,
 * and intuitive interactions – inspired by Notion’s design language.
 *
 * All features retained:
 * - Month / Week / Day / Agenda views
 * - Filters (type, scope, service, priority)
 * - Event CRUD with modal forms
 * - Role‑based visibility & permissions
 * - Colour‑coded events & status badges
 * - Search, Quick Add, Performance optimisations
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
  format, parseISO, differenceInDays, getDate, getMonth, getYear, setDate, setMonth, setYear
} from 'date-fns';
import {
  FiChevronLeft, FiChevronRight, FiPlus, FiEdit, FiTrash2, FiCheck,
  FiX, FiFilter, FiUser, FiCalendar, FiClock, FiMapPin, FiBarChart2,
  FiList, FiGrid, FiSearch, FiRefreshCw, FiEye, FiBell, FiTag,
  FiChevronDown, FiMoreHorizontal,
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

/* -------------------------------------------------------------------------- */
/*   HELPERS (keep from original, no changes)                                 */
/* -------------------------------------------------------------------------- */
const generateId = () => `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const getColorClasses = (colorName) => {
  const map = {
    rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
    gray: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400' },
  };
  return map[colorName] || map.amber;
};

const getEventStatus = (event) => {
  const now = new Date();
  const eventDate = typeof event.date === 'string' ? parseISO(event.date) : event.date;
  if (event.completed) return { label: '✓ Done', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  if (isPast(eventDate) && !isToday(eventDate)) return { label: '⚠ Overdue', class: 'bg-rose-100 text-rose-700 border-rose-200', pulse: true };
  if (isToday(eventDate)) return { label: '🔴 Due Today', class: 'bg-amber-100 text-amber-700 border-amber-200', pulse: true };
  if (differenceInDays(eventDate, now) <= STATUS_THRESHOLDS.UPCOMING_DAYS)
    return { label: '⏳ Upcoming', class: 'bg-purple-100 text-purple-700 border-purple-200' };
  return null;
};

/* Simulated API – replace with real service calls */
const fetchEvents = async () => [];
const createEventAPI = async (data) => ({ ...data, id: generateId(), createdAt: new Date().toISOString() });
const updateEventAPI = async (id, data) => ({ id, ...data, updatedAt: new Date().toISOString() });
const deleteEventAPI = async (id) => true;

/* -------------------------------------------------------------------------- */
/*   CONTEXT                                                                  */
/* -------------------------------------------------------------------------- */
const CalendarContext = React.createContext(null);
const useCalendar = () => useContext(CalendarContext);

/* -------------------------------------------------------------------------- */
/*   PROVIDER                                                                 */
/* -------------------------------------------------------------------------- */
const CalendarProvider = ({ children }) => {
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month');
  const [filters, setFilters] = useState({ type: 'all', scope: 'all', service: 'all', priority: 'all' });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [quickAddDate, setQuickAddDate] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  const userId = localStorage.getItem('id') || 'staff_001';
  const userRole = localStorage.getItem('role') || ROLES.ADMIN;
  const userCentre = localStorage.getItem('centre_id') || '1';

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try { setEvents(await fetchEvents()); } catch { toast.error('Failed to load events'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  /* Filtered events – role‑based */
  const filteredEvents = useMemo(() => {
    let result = events;
    if (userRole === ROLES.STAFF) result = result.filter(e => e.scope === SCOPES.GLOBAL || e.assignedTo === userId || e.centre === userCentre);
    else if (userRole === ROLES.ADMIN) result = result.filter(e => e.scope === SCOPES.GLOBAL || e.centre === userCentre);
    if (filters.type !== 'all') result = result.filter(e => e.category === filters.type);
    if (filters.scope !== 'all') result = result.filter(e => e.scope === filters.scope);
    if (filters.service !== 'all') result = result.filter(e => e.service === filters.service);
    if (filters.priority !== 'all') result = result.filter(e => e.priority === filters.priority);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => e.title?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q) || e.service?.toLowerCase().includes(q));
    }
    return result;
  }, [events, filters, searchQuery, userRole, userId, userCentre]);

  const getEventsForDate = useCallback((date) => filteredEvents.filter(e => isSameDay(parseISO(e.date), date)), [filteredEvents]);
  const todayEvents = useMemo(() => getEventsForDate(new Date()), [getEventsForDate]);
  const overdueEvents = useMemo(() => filteredEvents.filter(e => !e.completed && isPast(parseISO(e.date)) && !isToday(parseISO(e.date))), [filteredEvents]);
  const upcomingEvents = useMemo(() => filteredEvents.filter(e => !e.completed && isFuture(parseISO(e.date))), [filteredEvents]);

  const addEvent = useCallback(async (data) => { try { const e = await createEventAPI(data); setEvents(prev => [...prev, e]); toast.success('Event created'); } catch { toast.error('Failed'); } }, []);
  const updateEvent = useCallback(async (id, data) => { try { const e = await updateEventAPI(id, data); setEvents(prev => prev.map(ev => ev.id === id ? { ...ev, ...e } : ev)); toast.success('Updated'); } catch { toast.error('Failed'); } }, []);
  const deleteEvent = useCallback(async (id) => { try { await deleteEventAPI(id); setEvents(prev => prev.filter(e => e.id !== id)); toast.success('Deleted'); setShowDetailModal(false); setSelectedEvent(null); } catch { toast.error('Failed'); } }, []);
  const completeEvent = useCallback((id) => setEvents(prev => prev.map(e => e.id === id ? { ...e, completed: !e.completed } : e)), []);

  const ctx = {
    events: filteredEvents, currentDate, setCurrentDate, view, setView, filters, setFilters,
    searchQuery, setSearchQuery, selectedEvent, setSelectedEvent, showDetailModal, setShowDetailModal,
    showEventModal, setShowEventModal, editingEvent, setEditingEvent, quickAddDate, setQuickAddDate,
    sidebarOpen, setSidebarOpen, loading, todayEvents, overdueEvents, upcomingEvents,
    getEventsForDate, addEvent, updateEvent, deleteEvent, completeEvent,
    userRole, setRole: (r) => localStorage.setItem('role', r),
    userCentre, userId,
  };

  return React.createElement(CalendarContext.Provider, { value: ctx }, children);
};

/* -------------------------------------------------------------------------- */
/*   SMALL COMPONENTS                                                         */
/* -------------------------------------------------------------------------- */
const StatusBadge = ({ event }) => {
  const status = getEventStatus(event);
  if (!status) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${status.class} ${status.pulse ? 'animate-pulse' : ''}`}>
      {status.label}
    </span>
  );
};

const EventChip = ({ event, compact = true, onClick }) => {
  const color = getColorClasses(COLOR_MAP[event.eventSubType || 'task']);
  const status = getEventStatus(event);
  if (compact) {
    return (
      <div onClick={(e) => { e.stopPropagation(); onClick(event); }}
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs cursor-pointer truncate hover:shadow-sm transition-all ${color.bg} ${color.text} border ${color.border}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${color.dot} flex-shrink-0`} />
        <span className="truncate">{event.title}</span>
        {status && <span className="flex-shrink-0 text-[10px] opacity-80">{status.label.split(' ')[0]}</span>}
      </div>
    );
  }
  return (
    <div onClick={(e) => { e.stopPropagation(); onClick(event); }}
      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:shadow-md transition ${color.bg} ${color.text} border ${color.border}`}
    >
      <span className={`w-2 h-2 rounded-full ${color.dot} flex-shrink-0`} />
      <span className="font-medium text-sm truncate flex-1">{event.title}</span>
      {event.time && <span className="text-xs opacity-75">{event.time}</span>}
      {status && <StatusBadge event={event} />}
    </div>
  );
};

const FilterBtn = ({ active, onClick, children }) => (
  <button onClick={onClick}
    className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition ${active ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}>
    {children}
  </button>
);

const FilterGroup = ({ title, children }) => (
  <div className="mb-5">
    <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</h4>
    <div className="space-y-0.5">{children}</div>
  </div>
);

/* ========================================================================== */
/*   MODALS                                                                    */
/* ========================================================================== */
const EventDetailModal = () => {
  const { selectedEvent, setShowDetailModal, deleteEvent, completeEvent, userRole, userId, setEditingEvent, setShowEventModal } = useCalendar();
  if (!selectedEvent) return null;
  const event = selectedEvent;
  const color = getColorClasses(COLOR_MAP[event.eventSubType || 'task']);
  const canEdit = userRole === ROLES.SUPERADMIN || (userRole === ROLES.ADMIN && event.scope !== SCOPES.GLOBAL) || event.assignedTo === userId;
  const canDelete = userRole === ROLES.SUPERADMIN || (userRole === ROLES.ADMIN && event.scope !== SCOPES.GLOBAL);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowDetailModal(false)}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className={`px-5 py-4 ${color.bg} bg-opacity-60`}>
          <div className="flex justify-between">
            <span className="text-xs uppercase tracking-wide text-gray-500">{event.category}</span>
            <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600"><FiX /></button>
          </div>
          <h2 className="text-xl font-bold mt-1 text-gray-900">{event.title}</h2>
        </div>
        <div className="p-5 space-y-4 text-sm">
          {event.description && <p className="text-gray-600">{event.description}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-xs text-gray-400">Date</span><p className="font-medium">{format(parseISO(event.date), 'PPP')}</p></div>
            <div><span className="text-xs text-gray-400">Time</span><p className="font-medium">{event.time || 'All day'}</p></div>
            <div><span className="text-xs text-gray-400">Priority</span><span className={`px-2 py-0.5 rounded text-xs font-medium ${event.priority === 'high' ? 'bg-rose-100 text-rose-700' : event.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{event.priority}</span></div>
            <div><span className="text-xs text-gray-400">Scope</span><p className="capitalize">{event.scope}</p></div>
            {event.service && <div className="col-span-2"><span className="text-xs text-gray-400">Service</span><p>{event.service}</p></div>}
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className={`px-2 py-1 rounded ${event.completed ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{event.completed ? 'Completed' : 'Pending'}</span>
            <span>{event.assignedName || 'Unassigned'}</span>
            {event.centre && <span>· {event.centre}</span>}
          </div>
        </div>
        <div className="px-5 py-3 bg-gray-50 flex justify-between border-t">
          <div className="flex gap-2">
            {canEdit && <button onClick={() => { setShowDetailModal(false); setEditingEvent(event); setShowEventModal(true); }} className="px-3 py-1.5 text-xs font-medium bg-white border rounded-lg hover:bg-gray-100">Edit</button>}
            {canDelete && <button onClick={() => { if (confirm('Delete?')) deleteEvent(event.id); }} className="px-3 py-1.5 text-xs font-medium bg-white border rounded-lg text-rose-600 hover:bg-rose-50">Delete</button>}
          </div>
          <button onClick={() => completeEvent(event.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg ${event.completed ? 'bg-gray-100 text-gray-600' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}>
            {event.completed ? 'Reopen' : 'Complete'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const EventModal = () => {
  const { showEventModal, setShowEventModal, editingEvent, quickAddDate, addEvent, updateEvent, userRole, userCentre } = useCalendar();
  const empty = () => ({
    title: '', description: '', date: quickAddDate ? format(quickAddDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    time: '09:00', category: EVENT_CATEGORIES.TASK, eventSubType: EVENT_SUB_TYPES.TASK,
    service: '', priority: PRIORITIES.MEDIUM, scope: userRole === ROLES.SUPERADMIN ? SCOPES.GLOBAL : SCOPES.CENTRE,
    assignedTo: '', assignedName: '', centre: userCentre,
  });
  const [form, setForm] = useState(empty());
  useEffect(() => {
    if (editingEvent) setForm({ title: editingEvent.title || '', description: editingEvent.description || '', date: editingEvent.date ? format(parseISO(editingEvent.date), 'yyyy-MM-dd') : '', time: editingEvent.time || '', category: editingEvent.category || EVENT_CATEGORIES.TASK, eventSubType: editingEvent.eventSubType || editingEvent.type || EVENT_SUB_TYPES.TASK, service: editingEvent.service || '', priority: editingEvent.priority || PRIORITIES.MEDIUM, scope: editingEvent.scope || SCOPES.CENTRE, assignedTo: editingEvent.assignedTo || '', assignedName: editingEvent.assignedName || '', centre: editingEvent.centre || userCentre, });
    else setForm(empty());
  }, [editingEvent, quickAddDate]);

  if (!showEventModal) return null;
  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...form, date: new Date(`${form.date}T00:00:00`).toISOString() };
    if (editingEvent) updateEvent(editingEvent.id, payload);
    else addEvent(payload);
    setShowEventModal(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowEventModal(false)}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b sticky top-0 bg-white flex justify-between items-center">
          <h2 className="text-lg font-bold">{editingEvent ? 'Edit event' : 'New event'}</h2>
          <button onClick={() => setShowEventModal(false)} className="text-gray-400 hover:text-gray-600"><FiX /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <input required value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} placeholder="Event title" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-gray-400 outline-none" />
          <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="Description" rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-gray-400 outline-none resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <input required type="date" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <input type="time" value={form.time} onChange={e => setForm(p => ({...p, time: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {Object.values(EVENT_CATEGORIES).map(cat => (
              <button key={cat} type="button" onClick={() => setForm(p => ({...p, category: cat, eventSubType: cat === EVENT_CATEGORIES.HOLIDAY ? EVENT_SUB_TYPES.HOLIDAY : EVENT_SUB_TYPES.TASK}))}
                className={`px-3 py-1 rounded-lg border ${form.category === cat ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{cat}</button>
            ))}
          </div>
          <select value={form.eventSubType} onChange={e => setForm(p => ({...p, eventSubType: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
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
          <select value={form.service} onChange={e => setForm(p => ({...p, service: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">No service</option>
            {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <select value={form.priority} onChange={e => setForm(p => ({...p, priority: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
            <select value={form.scope} onChange={e => setForm(p => ({...p, scope: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value={SCOPES.PERSONAL}>Personal</option><option value={SCOPES.CENTRE}>My centre</option>
              {userRole === ROLES.SUPERADMIN && <option value={SCOPES.GLOBAL}>Global</option>}
            </select>
          </div>
          <input value={form.assignedName} onChange={e => setForm(p => ({...p, assignedName: e.target.value, assignedTo: e.target.value ? 'staff_custom' : ''}))} placeholder="Assign to…" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          <input value={form.centre} onChange={e => setForm(p => ({...p, centre: e.target.value}))} placeholder="Centre" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowEventModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">{editingEvent ? 'Save' : 'Create event'}</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

/* ========================================================================== */
/*   SIDEBAR (filter panel)                                                    */
/* ========================================================================== */
const FilterSidebar = () => {
  const { filters, setFilters, sidebarOpen, setSidebarOpen } = useCalendar();
  const hasActive = Object.values(filters).some(v => v !== 'all');
  if (!sidebarOpen) return (
    <button onClick={() => setSidebarOpen(true)} className="fixed left-0 top-1/2 -translate-y-1/2 z-20 bg-white border p-2 shadow-sm rounded-r-xl hover:bg-gray-50">
      <FiFilter className="text-gray-500" />
    </button>
  );
  return (
    <div className="w-60 flex-shrink-0 bg-white border-r border-gray-100 p-4 overflow-y-auto h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-sm text-gray-700">Filters</h3>
        <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-600"><FiX size={16} /></button>
      </div>
      {hasActive && (
        <button onClick={() => setFilters({ type: 'all', scope: 'all', service: 'all', priority: 'all' })}
          className="w-full mb-4 text-xs text-rose-600 hover:text-rose-800 font-medium">Clear all</button>
      )}
      <FilterGroup title="Type">
        <FilterBtn active={filters.type==='all'} onClick={()=>setFilters(p=>({...p,type:'all'}))}>All</FilterBtn>
        <FilterBtn active={filters.type===EVENT_CATEGORIES.APPLICATION} onClick={()=>setFilters(p=>({...p,type:EVENT_CATEGORIES.APPLICATION}))}>Application</FilterBtn>
        <FilterBtn active={filters.type===EVENT_CATEGORIES.TASK} onClick={()=>setFilters(p=>({...p,type:EVENT_CATEGORIES.TASK}))}>Tasks</FilterBtn>
        <FilterBtn active={filters.type===EVENT_CATEGORIES.SERVICE} onClick={()=>setFilters(p=>({...p,type:EVENT_CATEGORIES.SERVICE}))}>Service</FilterBtn>
        <FilterBtn active={filters.type===EVENT_CATEGORIES.HOLIDAY} onClick={()=>setFilters(p=>({...p,type:EVENT_CATEGORIES.HOLIDAY}))}>Holiday</FilterBtn>
      </FilterGroup>
      <FilterGroup title="Scope">
        <FilterBtn active={filters.scope==='all'} onClick={()=>setFilters(p=>({...p,scope:'all'}))}>All</FilterBtn>
        <FilterBtn active={filters.scope===SCOPES.GLOBAL} onClick={()=>setFilters(p=>({...p,scope:SCOPES.GLOBAL}))}>Global</FilterBtn>
        <FilterBtn active={filters.scope===SCOPES.CENTRE} onClick={()=>setFilters(p=>({...p,scope:SCOPES.CENTRE}))}>My centre</FilterBtn>
        <FilterBtn active={filters.scope===SCOPES.PERSONAL} onClick={()=>setFilters(p=>({...p,scope:SCOPES.PERSONAL}))}>My tasks</FilterBtn>
      </FilterGroup>
      <FilterGroup title="Service">
        <FilterBtn active={filters.service==='all'} onClick={()=>setFilters(p=>({...p,service:'all'}))}>All</FilterBtn>
        {SERVICES.map(s=><FilterBtn key={s} active={filters.service===s} onClick={()=>setFilters(p=>({...p,service:s}))}>{s}</FilterBtn>)}
      </FilterGroup>
      <FilterGroup title="Priority">
        <FilterBtn active={filters.priority==='all'} onClick={()=>setFilters(p=>({...p,priority:'all'}))}>All</FilterBtn>
        <FilterBtn active={filters.priority===PRIORITIES.HIGH} onClick={()=>setFilters(p=>({...p,priority:PRIORITIES.HIGH}))}>High</FilterBtn>
        <FilterBtn active={filters.priority===PRIORITIES.MEDIUM} onClick={()=>setFilters(p=>({...p,priority:PRIORITIES.MEDIUM}))}>Medium</FilterBtn>
        <FilterBtn active={filters.priority===PRIORITIES.LOW} onClick={()=>setFilters(p=>({...p,priority:PRIORITIES.LOW}))}>Low</FilterBtn>
      </FilterGroup>
    </div>
  );
};

/* ========================================================================== */
/*   CALENDAR BODY                                                             */
/* ========================================================================== */
const CalendarMain = () => {
  const { currentDate, setCurrentDate, view, setView, getEventsForDate, setShowDetailModal, setShowEventModal, setQuickAddDate, setEditingEvent } = useCalendar();
  const navigate = (dir) => setCurrentDate(prev => {
    if (view==='month') return dir==='prev'?subMonths(prev,1):addMonths(prev,1);
    if (view==='week') return dir==='prev'?subWeeks(prev,1):addWeeks(prev,1);
    return dir==='prev'?addDays(prev,-1):addDays(prev,1);
  });
  return (
    <div className="flex h-full">
      <FilterSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b px-4 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button onClick={()=>navigate('prev')} className="p-1.5 hover:bg-gray-100 rounded"><FiChevronLeft size={18}/></button>
            <button onClick={()=>setCurrentDate(new Date())} className="text-sm px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 font-medium">Today</button>
            <button onClick={()=>navigate('next')} className="p-1.5 hover:bg-gray-100 rounded"><FiChevronRight size={18}/></button>
            <h2 className="text-base font-semibold ml-2">
              {view==='month'&&format(currentDate,'MMMM yyyy')}
              {view==='week'&&`Week ${format(startOfWeek(currentDate,{weekStartsOn:0}),'MMM d')}`}
              {view==='day'&&format(currentDate,'EEEE, MMMM d')}
              {view==='agenda'&&'Agenda'}
            </h2>
          </div>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {[{k:'month',i:FiCalendar},{k:'week',i:FiGrid},{k:'day',i:FiClock},{k:'agenda',i:FiList}].map(v=>(
              <button key={v.k} onClick={()=>setView(v.k)} className={`flex items-center gap-1 px-3 py-1 text-sm rounded-md ${view===v.k?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}><v.i size={14}/><span className="hidden sm:inline">{v.k}</span></button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {view==='month'&&<MonthView />}
          {view==='week'&&<WeekView />}
          {view==='day'&&<DayView />}
          {view==='agenda'&&<AgendaView />}
        </div>
      </div>
    </div>
  );
};

const MonthView = () => {
  const { currentDate, getEventsForDate, setQuickAddDate, setShowEventModal, setEditingEvent, setSelectedEvent, setShowDetailModal } = useCalendar();
  const days = useMemo(()=>{
    const s=startOfMonth(currentDate),e=endOfMonth(currentDate);
    let st=startOfWeek(s,{weekStartsOn:0}),en=endOfWeek(e,{weekStartsOn:0});
    const arr=[];let d=st;
    while(d<=en){arr.push(d);d=addDays(d,1);}
    while(arr.length<42) arr.push(addDays(arr[arr.length-1],1));
    return arr.slice(0,42);
  },[currentDate]);
  return (
    <div className="p-2">
      <div className="grid grid-cols-7 text-xs text-gray-400 font-medium mb-1">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className="py-1 text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-xl overflow-hidden">
        {days.map((day,idx)=>{
          const evs=getEventsForDate(day);
          const isCur=isSameMonth(day,currentDate);
          const today=isToday(day);
          return (
            <div key={idx}
              onClick={()=>{setQuickAddDate(day);setEditingEvent(null);setShowEventModal(true);}}
              className={`bg-white p-1 min-h-[90px] cursor-pointer hover:bg-gray-50 transition ${!isCur?'opacity-40':''} ${today?'ring-2 ring-inset ring-blue-400':''}`}
            >
              <div className="text-right mb-1"><span className={`text-xs font-semibold ${today?'bg-blue-500 text-white rounded-full w-5 h-5 inline-flex items-center justify-center':''}`}>{getDate(day)}</span></div>
              <div className="space-y-0.5">
                {evs.slice(0,3).map(ev=><EventChip key={ev.id} event={ev} compact onClick={()=>{setSelectedEvent(ev);setShowDetailModal(true);}}/>)}
                {evs.length>3&&<div className="text-xs text-gray-400 px-1">+{evs.length-3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const WeekView = () => {
  const { currentDate, getEventsForDate } = useCalendar();
  const weekDays = useMemo(()=>Array.from({length:7},(_,i)=>addDays(startOfWeek(currentDate,{weekStartsOn:0}),i)),[currentDate]);
  const hours=Array.from({length:14},(_,i)=>i+7);
  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-8 border-b text-xs">
        <div className="py-1 px-2 text-gray-400"></div>
        {weekDays.map((d,i)=><div key={i} className={`py-1 text-center font-medium ${isToday(d)?'text-blue-600':''}`}>{format(d,'EEE d')}</div>)}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-8">
          <div>{hours.map(h=><div key={h} className="h-12 border-r text-xs text-gray-400 text-right pr-1">{h}:00</div>)}</div>
          {weekDays.map((day,di)=>{
            const evs=getEventsForDate(day);
            return <div key={di} className="relative border-r">
              {hours.map(h=><div key={h} className="h-12 border-b border-gray-50 hover:bg-gray-50/30 cursor-pointer"></div>)}
              {evs.map(ev=>{
                const hour=ev.time?parseInt(ev.time.split(':')[0]):9;
                const top=(hour-7)*48;
                return <div key={ev.id} className="absolute left-1 right-1 px-1 py-0.5 text-xs bg-blue-50 border border-blue-200 rounded truncate" style={{top}}>{ev.time} {ev.title}</div>;
              })}
            </div>;
          })}
        </div>
      </div>
    </div>
  );
};

const DayView = () => {
  const { currentDate, getEventsForDate } = useCalendar();
  const evs=getEventsForDate(currentDate);
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">{format(currentDate,'EEEE, MMMM d')}</h2>
      <div className="space-y-1">
        {Array.from({length:14},(_,i)=>i+7).map(h=>{
          const hourEvs=evs.filter(e=>e.time&&parseInt(e.time.split(':')[0])===h);
          return <div key={h} className="flex border-b border-gray-100 h-14 hover:bg-gray-50/50">
            <div className="w-16 text-xs text-gray-400 pt-1">{h}:00</div>
            <div className="flex-1">{hourEvs.map(e=><EventChip key={e.id} event={e} compact={false} onClick={()=>{}} />)}</div>
          </div>;
        })}
      </div>
    </div>
  );
};

const AgendaView = () => {
  const { todayEvents, overdueEvents, upcomingEvents, setSelectedEvent, setShowDetailModal } = useCalendar();
  const [tab,setTab]=useState('today');
  const tabs=[{k:'today',l:'Today',e:todayEvents},{k:'overdue',l:'Overdue',e:overdueEvents},{k:'upcoming',l:'Upcoming',e:upcomingEvents}];
  const cur=tabs.find(t=>t.k===tab);
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex gap-6 mb-6 border-b border-gray-100">
        {tabs.map(t=><button key={t.k} onClick={()=>setTab(t.k)} className={`pb-2 text-sm font-medium ${tab===t.k?'border-b-2 border-gray-900 text-gray-900':'text-gray-400 hover:text-gray-600'}`}>{t.l} · {t.e.length}</button>)}
      </div>
      <div className="space-y-3">
        {cur.e.length===0?<p className="text-gray-400 text-center py-10">No events</p>:
          cur.e.map(ev=>(
            <div key={ev.id} onClick={()=>{setSelectedEvent(ev);setShowDetailModal(true);}} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm cursor-pointer transition">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${getColorClasses(COLOR_MAP[ev.eventSubType||'task']).dot}`}></span>
                    <span className="text-xs text-gray-400 uppercase">{ev.category}</span>
                    <StatusBadge event={ev}/>
                  </div>
                  <h4 className="font-semibold text-gray-900">{ev.title}</h4>
                  {ev.description&&<p className="text-sm text-gray-500 mt-1 line-clamp-1">{ev.description}</p>}
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-medium">{ev.time||'All day'}</p>
                  {ev.service&&<span className="text-xs bg-gray-100 rounded px-2 py-0.5">{ev.service}</span>}
                </div>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
};

/* ========================================================================== */
/*   ROOT EXPORT                                                               */
/* ========================================================================== */
const CalendarView = () => (
  <CalendarProvider>
    <div className="h-screen flex flex-col bg-white">
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar />
      <CalendarMain />
      <EventDetailModal />
      <EventModal />
    </div>
  </CalendarProvider>
);

export default CalendarView;