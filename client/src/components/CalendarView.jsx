import React, { useMemo, useState } from "react";
import {
  FiPlus, FiTrash2, FiChevronLeft, FiChevronRight,
  FiMove, FiEdit, FiCalendar, FiHeart, FiCoffee, FiBriefcase, FiCheckCircle,
  FiUser, FiUsers, FiX, FiClock, FiMapPin
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";

// ==========================================
// OUTSIDE HELPERS (Prevents Re-renders)
// ==========================================
const getPhotoUrl = (photoPath) => {
  if (!photoPath) return null;
  if (photoPath.startsWith('http') || photoPath.startsWith('data:image')) return photoPath;
  return `${import.meta.env.VITE_API_URL || ''}${photoPath}`;
};

const normalizeDate = (dateStr) => {
  if (!dateStr) return "";
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (isNaN(d)) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "Invalid Date";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Invalid Date";
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (e) {
    return "Invalid Date";
  }
};

const formatShortDate = (dateStr) => {
  if (!dateStr) return "N/A";
  try {
    let date;
    if (typeof dateStr === 'string') {
      if (dateStr.includes('-')) {
        date = new Date(dateStr + 'T12:00:00');
      } else {
        date = new Date(dateStr);
      }
    } else if (dateStr instanceof Date) {
      date = dateStr;
    } else {
      return "N/A";
    }

    if (isNaN(date.getTime())) {
      return "N/A";
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return "N/A";
  }
};

// ==========================================
// DRAGGABLE EVENT COMPONENT (Extracted)
// ==========================================
const DraggableEvent = ({ event, onDragStart, onEdit, onDelete, isCompact = false, centresMap = {} }) => {
  const displayKey = event.event_type || event.type;

  const colors = {
    holiday: 'bg-rose-100 text-rose-800 border-rose-200',
    deadline: 'bg-rose-100 text-rose-800 border-rose-200',
    weekend: 'bg-slate-100 text-slate-800 border-slate-200',
    working: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    start: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    task: 'bg-slate-100 text-navy-800 border-slate-300',
    expiry: 'bg-amber-100 text-amber-800 border-amber-200',
    announcement: 'bg-slate-100 text-navy-800 border-slate-200',
    default: 'bg-slate-100 text-slate-800 border-slate-200'
  };

  const icons = {
    holiday: FiHeart,
    weekend: FiCoffee,
    working: FiBriefcase,
    task: FiCheckCircle,
    deadline: FiClock,
    start: FiCalendar,
    default: FiCalendar
  };

  const Icon = icons[displayKey] || icons.default;

  const getEventLabel = () => {
    switch (displayKey) {
      case 'holiday': return 'Holiday';
      case 'weekend': return 'Weekend';
      case 'working': return 'Working Day';
      case 'task': return 'Task';
      case 'deadline': return 'Deadline';
      case 'start': return 'Start';
      case 'expiry': return 'Expiry';
      case 'announcement': return 'Announcement';
      default: return 'Event';
    }
  };

  const getStaffInitials = (name) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const getStaffColor = (staffId) => {
    const colorsList = [
      'bg-navy-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
      'bg-slate-500', 'bg-orange-500', 'bg-navy-700', 'bg-teal-500'
    ];
    if (!staffId) return 'bg-slate-400';
    return colorsList[staffId % colorsList.length];
  };

  return (
    <motion.div
      draggable={!isCompact && event.type !== 'task'}
      onDragStart={e => !isCompact && onDragStart(e, event)}
      whileHover={!isCompact ? { scale: 1.02 } : {}}
      whileTap={!isCompact ? { scale: 0.98 } : {}}
      className={`${isCompact ? 'p-3' : 'p-1.5'} rounded text-xs border ${!isCompact && event.type !== 'task' ? 'cursor-move' : ''} ${colors[event.type] || colors.default} group relative`}
    >
      <div className="flex items-start justify-between gap-1 mb-0.5">
        <div className="flex items-center space-x-1 flex-1 min-w-0">
          <Icon className="h-3 w-3 shrink-0 mt-0.5" />
          <span className="truncate font-bold">
            {event.title || event.description || getEventLabel()}
          </span>
        </div>

        {(event.centre_name || (event.centre_id && centresMap[event.centre_id])) && (
          <span 
            className="px-1.5 py-0.5 bg-black/5 rounded-full text-[8px] font-medium text-slate-700 shrink-0 max-w-[35%] truncate" 
            title={event.centre_name || centresMap[event.centre_id] || `Centre ${event.centre_id}`}
          >
            {event.centre_name || centresMap[event.centre_id] || `Centre ${event.centre_id}`}
          </span>
        )}

        {!isCompact && event.type !== 'task' && (
          <FiMove className="h-2 w-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        )}
      </div>

      {event.description && event.description !== event.title && (
        <p className="truncate text-xs mt-0.5 text-slate-600">{event.description}</p>
      )}

      {event.type === 'task' && (
        <div className={`flex items-center ${isCompact ? 'mt-2' : 'mt-1 pt-1 border-t border-slate-300'}`}>
          {event.staff_name ? (
            <>
              {event.staff_photo ? (
                <img src={getPhotoUrl(event.staff_photo)} alt={event.staff_name} className={`${isCompact ? 'w-5 h-5' : 'w-4 h-4'} rounded-full object-cover mr-1 shrink-0 border border-slate-200`} />
              ) : (
                <div className={`${isCompact ? 'w-5 h-5' : 'w-4 h-4'} rounded-full ${getStaffColor(event.staff_id)} flex items-center justify-center ${isCompact ? 'text-xs' : 'text-[8px]'} text-white font-medium mr-1 shrink-0`}>
                  {getStaffInitials(event.staff_name)}
                </div>
              )}
              <span className={`${isCompact ? 'text-xs' : 'text-[8px]'} text-slate-700 font-medium truncate`}>
                {event.staff_name}
              </span>
              {!isCompact && event.staff_role && (
                <span className="ml-1 text-[6px] bg-slate-200 text-slate-600 px-1 rounded-full">
                  {event.staff_role}
                </span>
              )}
            </>
          ) : (
            <>
              <div className={`${isCompact ? 'w-5 h-5' : 'w-4 h-4'} rounded-full bg-slate-400 flex items-center justify-center ${isCompact ? 'text-xs' : 'text-[8px]'} text-white font-medium mr-1 shrink-0`}>
                ?
              </div>
              <span className={`${isCompact ? 'text-xs' : 'text-[8px]'} text-slate-500 italic truncate`}>
                Unassigned
              </span>
            </>
          )}
        </div>
      )}

      {!isCompact && event.type !== 'task' && (
        <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 flex space-x-1 bg-white/80 rounded-bl p-0.5">
          <button
            onClick={e => { e.stopPropagation(); onEdit(event); }}
            aria-label={`Edit ${event.title || event.description || "event"}`}
            className="p-0.5 bg-white rounded text-slate-600 hover:text-navy-700"
          >
            <FiEdit className="h-2 w-2" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(event); }}
            aria-label={`Delete ${event.title || event.description || "event"}`}
            className="p-0.5 bg-white rounded text-slate-600 hover:text-rose-600"
          >
            <FiTrash2 className="h-2 w-2" />
          </button>
        </div>
      )}
    </motion.div>
  );
};

// ==========================================
// DAY DETAILS MODAL (Extracted to prevent layout shivering)
// ==========================================
const DayDetailsModal = ({ day, onClose, onEditEvent, onDeleteEvent, centresMap }) => {
  const [activeTab, setActiveTab] = useState("all"); // Internal state keeps parent clean

  if (!day) return null;

  const events = day.events || [];
  const leaves = day.leavesForDay || [];

  const getFilteredItems = () => {
    const mappedEvents = events.map(e => ({ ...e, _isLeave: false }));
    const mappedLeaves = leaves.map(l => ({ ...l, _isLeave: true }));

    if (activeTab === "all") {
      return [...mappedEvents, ...mappedLeaves].sort((a, b) => {
        const dateA = new Date(a.date || a.from_date || 0);
        const dateB = new Date(b.date || b.from_date || 0);
        return dateA - dateB;
      });
    }

    if (activeTab === "events") return mappedEvents;
    if (activeTab === "leaves") return mappedLeaves;
    if (activeTab === "tasks") return mappedEvents.filter(e => e.type === 'task');

    return [];
  };

  const filteredItems = getFilteredItems();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-navy-800/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        // Strict height and flex layout prevent UI shivering when tabs change
        role="dialog"
        aria-modal="true"
        aria-label={`Details for ${formatDate(day.date)}`}
        className="bg-white rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
          <div>
            <h3 className="text-xl font-bold text-slate-800">
              {formatDate(day.date)}
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {events.length} events • {leaves.length} staff on leave
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-slate-200 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-navy-500/30">
            <FiX size={20} className="text-slate-600" />
          </button>
        </div>

        <div className="border-b border-slate-200 px-6 pt-4 shrink-0">
          <div className="flex space-x-6 overflow-x-auto" role="tablist">
            {["all", "events", "tasks", "leaves"].map((tab) => {
              const count = tab === "all" ? events.length + leaves.length :
                            tab === "events" ? events.length :
                            tab === "tasks" ? events.filter(e => e.type === 'task').length : leaves.length;
              
              const labels = { all: "All Items", events: "Events", tasks: "Tasks", leaves: "Leaves" };

              return (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab
                      ? "border-navy-700 text-navy-700"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {labels[tab]} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area takes the remaining space securely */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <FiCalendar className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">No items in this category</p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              if (item._isLeave) {
                const formattedFromDate = formatShortDate(item.from_date);
                const formattedToDate = formatShortDate(item.to_date);

                return (
                  <div key={`leave-${item.id}-${idx}`} className="p-4 rounded-xl border bg-amber-50 border-amber-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center text-amber-800 font-bold">
                          {item.staff_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-amber-800">
                            {item.staff_name || 'Unknown Staff'}
                          </p>
                          <p className="text-sm text-amber-600 flex items-center gap-1">
                            <FiClock className="h-3 w-3" />
                            {formattedFromDate} - {formattedToDate}
                          </p>
                        </div>
                      </div>
                    </div>
                    {item.reason && (
                      <p className="text-sm text-amber-700 mt-3 border-t border-amber-200 pt-3">
                        <span className="font-medium">Reason:</span> {item.reason}
                      </p>
                    )}
                  </div>
                );
              }

              return (
                <DraggableEvent
                  key={`event-${item.id}-${idx}`}
                  event={item}
                  onDragStart={() => {}}
                  onEdit={onEditEvent}
                  onDelete={onDeleteEvent}
                  isCompact={true}
                  centresMap={centresMap}
                />
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end shrink-0">
          <button onClick={onClose} className="px-4 py-2 bg-navy-700 text-white rounded-xl hover:bg-navy-800 transition text-sm font-medium focus:outline-none focus:ring-2 focus:ring-navy-500/30">
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ==========================================
// MAIN CALENDAR VIEW
// ==========================================
const CalendarView = ({
  calendarData = [],
  leavesData = [],
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onUpdateEvent,
  userRole = "admin",
  centresMap = {}
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("month");
  const [draggedEvent, setDraggedEvent] = useState(null);
  const [dragOverDate, setDragOverDate] = useState(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  
  const [selectedCentreFilter, setSelectedCentreFilter] = useState("all"); 

  const [filters, setFilters] = useState({
    working: true,
    holiday: true,
    weekend: true,
    task: true
  });

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const colorMapping = {
    holiday: { background: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800' },
    deadline: { background: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800' },
    weekend: { background: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700' },
    working: { background: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
    start: { background: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
    task: { background: 'bg-slate-100', border: 'border-slate-300', text: 'text-navy-800' },
    expiry: { background: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' },
    announcement: { background: 'bg-white', border: 'border-navy-500', text: 'text-navy-800' },
    today: { background: 'bg-white', border: 'border-navy-500', text: 'text-navy-800' },
    default: { background: 'bg-white', border: 'border-slate-200', text: 'text-slate-900' }
  };

  const getDayStyle = (day) => {
    if (!day) return colorMapping.default;
    const s = { ...colorMapping.default };
    if (day.isToday) Object.assign(s, colorMapping.today);
    if (day.isWeekend && !day.events.some(e => e.type === 'working')) Object.assign(s, colorMapping.weekend);
    if (day.events.length) {
      if (day.events.some(e => e.type === 'holiday')) Object.assign(s, colorMapping.holiday);
      else if (day.events.some(e => e.type === 'working')) Object.assign(s, colorMapping.working);
      else if (day.events.some(e => e.type === 'task')) Object.assign(s, colorMapping.task);
    }
    if (day.isDragOver) {
      s.background = 'bg-slate-200';
      s.border = 'border-navy-500';
    }
    return s;
  };

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

  const calendarDays = useMemo(() => {
    const days = [];
    const total = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const todayStr = normalizeDate(new Date());

    const eventMap = {};
    for (const e of calendarData) {
      if (!filters[e.type]) continue;
      if (selectedCentreFilter !== "all" && String(e.centre_id) !== selectedCentreFilter) continue;
      
      const d = normalizeDate(e.date);
      if (!eventMap[d]) eventMap[d] = [];
      eventMap[d].push(e);
    }

    const leaveMap = {};
    for (const leave of leavesData) {
      if (leave.status !== "approved") continue;
      if (selectedCentreFilter !== "all" && String(leave.centre_id) !== selectedCentreFilter) continue;

      try {
        if (!leave.from_date || !leave.to_date) continue;

        let current = new Date(leave.from_date + 'T12:00:00');
        const end = new Date(leave.to_date + 'T12:00:00');

        if (isNaN(current.getTime()) || isNaN(end.getTime())) continue;

        while (current <= end) {
          const key = normalizeDate(current);
          if (!leaveMap[key]) leaveMap[key] = [];
          leaveMap[key].push(leave);
          current.setDate(current.getDate() + 1);
        }
      } catch (e) {
        console.error("Error processing leave:", leave);
      }
    }

    for (let i = 0; i < firstDay; i++) days.push(null);

    for (let d = 1; d <= total; d++) {
      const date = new Date(currentYear, currentMonth, d);
      const dateStr = normalizeDate(date);

      days.push({
        date,
        dateStr,
        day: d,
        events: eventMap[dateStr] || [],
        leavesForDay: leaveMap[dateStr] || [],
        isToday: dateStr === todayStr,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        isDragOver: dragOverDate === dateStr
      });
    }

    return days;
  }, [currentYear, currentMonth, calendarData, leavesData, dragOverDate, filters, selectedCentreFilter]);

  const handleDayClick = (day) => {
    if (day && (day.events.length > 0 || day.leavesForDay.length > 0)) {
      setSelectedDayEvents(day);
      setIsDayModalOpen(true);
    }
  };

  const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

  const handleDragStart = (e, ev) => {
    if (ev.type === 'task') {
      e.preventDefault();
      return;
    }
    setDraggedEvent(ev);
    e.dataTransfer.setData("text/plain", ev.id);
  };

  const handleDragOver = (e, dateStr) => {
    e.preventDefault();
    setDragOverDate(dateStr);
  };

  const handleDragLeave = () => {
    setDragOverDate(null);
  };

  const handleDrop = async (e, dateStr) => {
    e.preventDefault();
    setDragOverDate(null);
    if (draggedEvent && draggedEvent.date !== dateStr) {
      try {
        await onUpdateEvent(draggedEvent.id, {
          ...draggedEvent,
          date: dateStr
        });
        toast.success("Event moved");
      } catch {
        toast.error("Failed to move");
      }
    }
    setDraggedEvent(null);
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 relative">
      
      {/* Properly wrapped Modal so it fades in and out */}
      <AnimatePresence>
        {isDayModalOpen && (
          <DayDetailsModal
            day={selectedDayEvents}
            onClose={() => setIsDayModalOpen(false)}
            onEditEvent={onEditEvent}
            onDeleteEvent={onDeleteEvent}
            centresMap={centresMap}
          />
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center space-x-4 flex-wrap gap-2">
          <h2 className="text-xl font-bold text-slate-900">Working Days Calendar</h2>
          <div className="flex items-center flex-wrap gap-1 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setView('month')}
              aria-pressed={view === 'month'}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${view === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Month View
            </button>
            <button
              onClick={() => setView('list')}
              aria-pressed={view === 'list'}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${view === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              List View
            </button>
            
            {userRole === "superadmin" && Object.keys(centresMap).length > 0 && (
              <select
                value={selectedCentreFilter}
                onChange={(e) => setSelectedCentreFilter(e.target.value)}
                aria-label="Filter by centre"
                className="ml-2 px-3 py-1 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 shadow-sm cursor-pointer hover:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500"
              >
                <option value="all">All Centres</option>
                {Object.entries(centresMap).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2 ml-4 flex-wrap">
            {Object.keys(filters).map(type => (
              <button
                key={type}
                onClick={() => setFilters(prev => ({ ...prev, [type]: !prev[type] }))}
                aria-pressed={filters[type]}
                className={`px-3 py-1 text-xs font-medium rounded-full border capitalize transition-colors ${
                  filters[type]
                    ? type === 'working' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
                      type === 'holiday' ? 'bg-rose-100 text-rose-700 border-rose-300' :
                      type === 'weekend' ? 'bg-slate-100 text-slate-700 border-slate-300' :
                      'bg-slate-100 text-navy-700 border-slate-300'
                    : "bg-slate-100 text-slate-500 border-slate-200"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <button onClick={prevMonth} aria-label="Previous month" className="p-2 hover:bg-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30">
              <FiChevronLeft className="h-5 w-5 text-slate-600" />
            </button>
            <h3 className="text-lg font-semibold text-slate-900 min-w-32 text-center">
              {monthNames[currentMonth]} {currentYear}
            </h3>
            <button onClick={nextMonth} aria-label="Next month" className="p-2 hover:bg-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30">
              <FiChevronRight className="h-5 w-5 text-slate-600" />
            </button>
          </div>
          <button
            onClick={onAddEvent}
            className="flex items-center space-x-2 px-4 py-2 bg-navy-700 text-white rounded-xl hover:bg-navy-800 transition-colors focus:outline-none focus:ring-2 focus:ring-navy-500/30"
          >
            <FiPlus className="h-4 w-4" />
            <span>Add Event</span>
          </button>
        </div>
      </div>

      {view === 'month' ? (
        <div className="calendar-grid">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map(d => (
              <div key={d} className="p-3 text-center text-sm font-medium text-slate-500 uppercase">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, i) => {
              const style = getDayStyle(day);
              const hasEvents = day && (day.events.length > 0 || day.leavesForDay.length > 0);
              return (
                <div
                  key={i}
                  onDragOver={e => day && handleDragOver(e, day.dateStr)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => day && handleDrop(e, day.dateStr)}
                  onClick={() => handleDayClick(day)}
                  {...(hasEvents ? {
                    role: "button",
                    tabIndex: 0,
                    "aria-label": `${formatDate(day.dateStr)}, ${day.events.length + day.leavesForDay.length} items`,
                    onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleDayClick(day); } }
                  } : {})}
                  className={`min-h-24 p-2 rounded-xl ${day ? 'border' : ''} transition-all ${style.background} ${style.border} ${day ? 'cursor-pointer hover:shadow-md' : ''} ${day?.isDragOver ? 'border-navy-500 bg-slate-200 shadow-inner' : ''} ${hasEvents ? 'font-medium focus:outline-none focus:ring-2 focus:ring-navy-500/30' : ''}`}
                >
                  {day && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium ${style.text}`}>
                          {day.day}
                        </span>
                        {day.isToday && (
                          <span className="px-1.5 py-0.5 bg-navy-700 text-white rounded text-xs">
                            Today
                          </span>
                        )}
                        {hasEvents && (
                          <span className="px-1.5 py-0.5 bg-slate-200 text-navy-700 rounded text-xs">
                            {day.events.length + day.leavesForDay.length}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                        {day.events.slice(0, 2).map((ev, idx) => {
                          const displayKey = ev.event_type || ev.type;
                          return (
                            <div
                              key={`event-preview-${ev.id}-${idx}`}
                              className={`px-1.5 py-1 text-[10px] rounded border ${
                                displayKey === 'holiday' || displayKey === 'deadline' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                                displayKey === 'weekend' ? 'bg-slate-100 text-slate-800 border-slate-200' :
                                displayKey === 'working' || displayKey === 'start' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                displayKey === 'task' ? 'bg-slate-100 text-navy-800 border-slate-300' :
                                displayKey === 'expiry' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                'bg-white text-navy-800 border-navy-500'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <span className="truncate flex-1 font-semibold" title={ev.title || ev.description || ev.type}>
                                  {ev.type === 'task' ? '📋' : '📅'} {ev.title || ev.description || ev.type}
                                </span>
                              </div>
                              {ev.type === 'task' && ev.staff_name && (
                                <div className="flex items-center mt-1 text-[8px] text-slate-600 gap-1">
                                  {ev.staff_photo ? (
                                    <img src={getPhotoUrl(ev.staff_photo)} alt={ev.staff_name} className="w-3.5 h-3.5 rounded-full object-cover shrink-0 border border-slate-200" />
                                  ) : (
                                    <FiUser className="h-2.5 w-2.5 shrink-0" />
                                  )}
                                  <span className="truncate font-medium">{ev.staff_name}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {day.leavesForDay.slice(0, 1).map((leave, i) => {
                          const formattedFromDate = formatShortDate(leave.from_date);
                          const formattedToDate = formatShortDate(leave.to_date);

                          return (
                            <div
                              key={`leave-preview-${leave.id}-${i}`}
                              className="px-1.5 py-1 text-[10px] rounded border bg-amber-100 text-amber-800 border-amber-200"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium truncate">{leave.staff_name || 'Staff'}</span>
                                <span className="ml-1 text-[8px] bg-amber-200 px-1 rounded-full">
                                  Leave
                                </span>
                              </div>
                              {(formattedFromDate !== "N/A" || formattedToDate !== "N/A") && (
                                <div className="flex items-center mt-0.5 text-[8px] text-amber-600">
                                  <FiClock className="h-2 w-2 mr-0.5" />
                                  <span className="truncate">
                                    {formattedFromDate} - {formattedToDate}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {(day.events.length + day.leavesForDay.length) > 2 && (
                          <div className="text-[10px] text-slate-500 text-center bg-slate-100 rounded py-1">
                            +{day.events.length + day.leavesForDay.length - 2} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {calendarData
            .filter(e => filters[e.type])
            .filter(e => selectedCentreFilter === "all" || String(e.centre_id) === selectedCentreFilter)
            .filter(e => {
              try {
                const date = new Date(e.date);
                return !isNaN(date.getTime()) &&
                  date.getMonth() === currentMonth &&
                  date.getFullYear() === currentYear;
              } catch {
                return false;
              }
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map((ev, i) => {
              const displayKey = ev.event_type || ev.type;
              const s = colorMapping[displayKey] || colorMapping.default;

              const getEventLabel = () => {
                switch (displayKey) {
                  case 'holiday': return 'Holiday';
                  case 'weekend': return 'Weekend';
                  case 'working': return 'Working Day';
                  case 'task': return 'Task';
                  case 'deadline': return 'Deadline';
                  case 'start': return 'Start';
                  case 'expiry': return 'Expiry';
                  case 'announcement': return 'Announcement';
                  default: return 'Event';
                }
              };

              const getStaffInitials = (name) => {
                if (!name) return '';
                return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
              };

              const getStaffColor = (staffId) => {
                const colorsList = [
                  'bg-navy-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
                  'bg-slate-500', 'bg-orange-500', 'bg-navy-700', 'bg-teal-500'
                ];
                if (!staffId) return 'bg-slate-400';
                return colorsList[staffId % colorsList.length];
              };

              return (
                <motion.div
                  key={ev.id || i}
                  layout
                  className={`flex items-center justify-between p-4 rounded-xl border ${s.background} ${s.border} ${ev.type !== 'task' ? 'cursor-move' : ''}`}
                  draggable={ev.type !== 'task'}
                  onDragStart={e => handleDragStart(e, ev)}
                >
                  <div className="flex items-center space-x-4 flex-1">
                    <div className={`flex items-center justify-center w-12 h-12 ${s.background} rounded-xl border ${s.border} relative shrink-0`}>
                      <span className={`text-lg font-bold ${s.text}`}>
                        {new Date(ev.date).getDate()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-semibold ${s.text}`}>
                          {getEventLabel()}
                        </p>
                      </div>
                      <p className="text-sm text-slate-600 flex items-center gap-1">
                        <FiCalendar className="h-3 w-3" />
                        {formatDate(ev.date)}
                      </p>
                      {ev.description && (
                        <p className="text-sm text-slate-700 mt-1">
                          {ev.description}
                        </p>
                      )}

                      {ev.type === 'task' && (
                        <div className="flex items-center mt-2">
                          {ev.staff_name ? (
                            <>
                              {ev.staff_photo ? (
                                <img src={getPhotoUrl(ev.staff_photo)} alt={ev.staff_name} className="w-6 h-6 rounded-full object-cover mr-2 shrink-0 border border-slate-200" />
                              ) : (
                                <div className={`w-6 h-6 rounded-full ${getStaffColor(ev.staff_id)} flex items-center justify-center text-[10px] text-white font-medium mr-2 shrink-0`}>
                                  {getStaffInitials(ev.staff_name)}
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-700">
                                  {ev.staff_name}
                                </span>
                                {ev.staff_role && (
                                  <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                                    {ev.staff_role}
                                  </span>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center text-xs text-slate-500 italic">
                              <FiUser className="h-3 w-3 mr-1" />
                              Unassigned
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    {ev.type !== 'task' && <FiMove className="h-4 w-4 text-slate-400" />}
                    {ev.type !== 'task' && (
                      <>
                        <button
                          onClick={() => onEditEvent(ev)}
                          aria-label={`Edit ${ev.title || ev.description || "event"}`}
                          className="p-2 text-slate-600 hover:bg-white rounded-xl"
                        >
                          <FiEdit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDeleteEvent(ev)}
                          aria-label={`Delete ${ev.title || ev.description || "event"}`}
                          className="p-2 text-rose-600 hover:bg-white rounded-xl"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}

          {calendarData.filter(e => filters[e.type]).filter(e => {
            try {
              const date = new Date(e.date);
              return !isNaN(date.getTime()) &&
                date.getMonth() === currentMonth &&
                date.getFullYear() === currentYear;
            } catch {
              return false;
            }
          }).length === 0 && (
            <div className="text-center py-8">
              <FiCalendar className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">No events match the selected filters</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-slate-900 mb-3">Color Legend</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-white border border-navy-500 rounded"></div>
                <span className="text-sm text-slate-600">Today</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-emerald-100 border border-emerald-200 rounded"></div>
                <span className="text-sm text-slate-600">Working Day</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-rose-100 border border-rose-200 rounded"></div>
                <span className="text-sm text-slate-600">Holiday</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-slate-100 border border-slate-200 rounded"></div>
                <span className="text-sm text-slate-600">Weekend</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-slate-100 border border-slate-300 rounded"></div>
                <span className="text-sm text-slate-600">Task</span>
              </div>
            </div>
          </div>
          <div className="text-sm text-slate-500 flex items-center space-x-2">
            <FiMove className="h-4 w-4" />
            <span>Drag & drop to move (tasks cannot be moved)</span>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #c5c5c5;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }
      `}</style>
    </div>
  );
};

export default CalendarView;