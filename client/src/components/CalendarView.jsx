import React, { useMemo, useState } from "react";
import {
  FiPlus, FiTrash2, FiChevronLeft, FiChevronRight,
  FiMove, FiEdit, FiCalendar, FiHeart, FiCoffee, FiBriefcase, FiCheckCircle,
  FiUser, FiUsers, FiX, FiClock, FiMapPin
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";

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
  const [activeTab, setActiveTab] = useState("all");
  
  // Event filters
  const [filters, setFilters] = useState({
    working: true,
    holiday: true,
    weekend: true,
    task: true
  });

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const colorMapping = {
    holiday: { background: 'bg-red-50', border: 'border-red-200', text: 'text-red-800' },
    weekend: { background: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800' },
    working: { background: 'bg-green-50', border: 'border-green-200', text: 'text-green-800' },
    task: { background: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800' },
    today: { background: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800' },
    default: { background: 'bg-white', border: 'border-gray-200', text: 'text-gray-900' }
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

  const DraggableEvent = ({ event, onDragStart, onEdit, onDelete, isCompact = false }) => {
    const colors = {
      holiday: 'bg-red-100 text-red-800 border-red-200',
      weekend: 'bg-gray-100 text-gray-800 border-gray-200',
      working: 'bg-green-100 text-green-800 border-green-200',
      task: 'bg-purple-100 text-purple-800 border-purple-200',
      default: 'bg-blue-100 text-blue-800 border-blue-200'
    };
    
    const icons = {
      holiday: FiHeart,
      weekend: FiCoffee,
      working: FiBriefcase,
      task: FiCheckCircle,
      default: FiCalendar
    };
    
    const Icon = icons[event.type] || icons.default;
    
    const getEventLabel = () => {
      switch(event.type) {
        case 'holiday':
          return 'Holiday';
        case 'weekend':
          return 'Weekend';
        case 'working':
          return 'Working Day';
        case 'task':
          return 'Task';
        default:
          return 'Event';
      }
    };

    // Get staff initials for avatar
    const getStaffInitials = (name) => {
      if (!name) return '';
      return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    // Get random color for staff avatar based on staff_id
    const getStaffColor = (staffId) => {
      const colors = [
        'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 
        'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
      ];
      if (!staffId) return 'bg-gray-400';
      const index = (staffId % colors.length);
      return colors[index];
    };
    
    return (
      <motion.div 
        draggable={!isCompact && event.type !== 'task'}
        onDragStart={e => !isCompact && onDragStart(e, event)} 
        whileHover={!isCompact ? { scale: 1.02 } : {}}
        whileTap={!isCompact ? { scale: 0.98 } : {}}
        className={`${isCompact ? 'p-3' : 'p-1.5'} rounded text-xs border ${!isCompact && event.type !== 'task' ? 'cursor-move' : ''} ${colors[event.type] || colors.default} group relative`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1 flex-1 min-w-0">
            <Icon className="h-3 w-3 flex-shrink-0" />
            <span className="truncate font-medium">
              {getEventLabel()}
            </span>
          </div>
          
          {/* Centre badge */}
          {(event.centre_name || (event.centre_id && centresMap[event.centre_id])) && (
            <span className="ml-1 px-1.5 py-0.5 bg-white/80 rounded-full text-[8px] font-medium text-gray-700 border border-gray-200 flex-shrink-0">
              {event.centre_name || centresMap[event.centre_id] || `Centre ${event.centre_id}`}
            </span>
          )}
          
          {!isCompact && event.type !== 'task' && (
            <FiMove className="h-2 w-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          )}
        </div>
        
        {event.description && (
          <p className="truncate text-xs mt-0.5 text-gray-600">{event.description}</p>
        )}
        
        {/* Staff information for tasks */}
        {event.type === 'task' && (
          <div className={`flex items-center ${isCompact ? 'mt-2' : 'mt-1 pt-1 border-t border-purple-200 border-opacity-50'}`}>
            {event.staff_name ? (
              <>
                <div className={`${isCompact ? 'w-5 h-5' : 'w-4 h-4'} rounded-full ${getStaffColor(event.staff_id)} flex items-center justify-center ${isCompact ? 'text-xs' : 'text-[8px]'} text-white font-medium mr-1 flex-shrink-0`}>
                  {getStaffInitials(event.staff_name)}
                </div>
                <span className={`${isCompact ? 'text-xs' : 'text-[8px]'} text-gray-700 font-medium truncate`}>
                  {event.staff_name}
                </span>
                {!isCompact && event.staff_role && (
                  <span className="ml-1 text-[6px] bg-gray-200 text-gray-600 px-1 rounded-full">
                    {event.staff_role}
                  </span>
                )}
              </>
            ) : (
              <>
                <div className={`${isCompact ? 'w-5 h-5' : 'w-4 h-4'} rounded-full bg-gray-400 flex items-center justify-center ${isCompact ? 'text-xs' : 'text-[8px]'} text-white font-medium mr-1 flex-shrink-0`}>
                  ?
                </div>
                <span className={`${isCompact ? 'text-xs' : 'text-[8px]'} text-gray-500 italic truncate`}>
                  Unassigned
                </span>
              </>
            )}
          </div>
        )}
        
        {/* Only show edit/delete buttons for non-task events in non-compact mode */}
        {!isCompact && event.type !== 'task' && (
          <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 flex space-x-1 bg-white/80 rounded-bl p-0.5">
            <button 
              onClick={e => { e.stopPropagation(); onEdit(event); }} 
              className="p-0.5 bg-white rounded text-gray-600 hover:text-indigo-600"
            >
              <FiEdit className="h-2 w-2" />
            </button>
            <button 
              onClick={e => { e.stopPropagation(); onDelete(event); }} 
              className="p-0.5 bg-white rounded text-gray-600 hover:text-red-600"
            >
              <FiTrash2 className="h-2 w-2" />
            </button>
          </div>
        )}
      </motion.div>
    );
  };

  // Day Details Modal
  const DayDetailsModal = ({ day, onClose }) => {
    if (!day) return null;

    const events = day.events || [];
    const leaves = day.leavesForDay || [];

    const getFilteredItems = () => {
      if (activeTab === "all") {
        return [
          ...events.map(e => ({ ...e, type: 'event' })),
          ...leaves.map(l => ({ ...l, type: 'leave' }))
        ].sort((a, b) => {
          const dateA = new Date(a.date || a.from_date || 0);
          const dateB = new Date(b.date || b.from_date || 0);
          return dateA - dateB;
        });
      } else if (activeTab === "events") {
        return events;
      } else if (activeTab === "leaves") {
        return leaves;
      } else if (activeTab === "tasks") {
        return events.filter(e => e.type === 'task');
      }
      return [];
    };

    const filteredItems = getFilteredItems();

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  {formatDate(day.date)}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {events.length} events • {leaves.length} staff on leave
                </p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <FiX size={20} className="text-gray-600" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200 px-6 pt-4">
              <div className="flex space-x-6 overflow-x-auto">
                <button
                  onClick={() => setActiveTab("all")}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === "all"
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  All Items ({events.length + leaves.length})
                </button>
                <button
                  onClick={() => setActiveTab("events")}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === "events"
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Events ({events.length})
                </button>
                <button
                  onClick={() => setActiveTab("tasks")}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === "tasks"
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Tasks ({events.filter(e => e.type === 'task').length})
                </button>
                <button
                  onClick={() => setActiveTab("leaves")}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === "leaves"
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Leaves ({leaves.length})
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-200px)] space-y-4">
              {filteredItems.length === 0 ? (
                <div className="text-center py-12">
                  <FiCalendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No items in this category</p>
                </div>
              ) : (
                filteredItems.map((item, idx) => {
                  if (item.type === 'leave' || item.staff_name) {
                    const fromDate = item.from_date;
                    const toDate = item.to_date;
                    
                    const formattedFromDate = formatShortDate(fromDate);
                    const formattedToDate = formatShortDate(toDate);
                    
                    return (
                      <div
                        key={`leave-${item.id}-${idx}`}
                        className="p-4 rounded-lg border bg-yellow-50 border-yellow-200"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-yellow-200 flex items-center justify-center text-yellow-800 font-bold">
                              {item.staff_name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className="font-semibold text-yellow-800">
                                {item.staff_name || 'Unknown Staff'}
                              </p>
                              <p className="text-sm text-yellow-600 flex items-center gap-1">
                                <FiClock className="h-3 w-3" />
                                {formattedFromDate} - {formattedToDate}
                              </p>
                            </div>
                          </div>
                          {item.centre_name && (
                            <span className="text-sm bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full flex items-center gap-1">
                              <FiMapPin className="h-3 w-3" />
                              {item.centre_name}
                            </span>
                          )}
                        </div>
                        {item.reason && (
                          <p className="text-sm text-yellow-700 mt-3 border-t border-yellow-200 pt-3">
                            <span className="font-medium">Reason:</span> {item.reason}
                          </p>
                        )}
                      </div>
                    );
                  } else {
                    return (
                      <DraggableEvent 
                        key={`event-${item.id}-${idx}`} 
                        event={item} 
                        onDragStart={() => {}} 
                        onEdit={onEditEvent} 
                        onDelete={onDeleteEvent}
                        isCompact={true}
                      />
                    );
                  }
                })
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
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
      s.background = 'bg-indigo-100'; 
      s.border = 'border-indigo-300'; 
    }
    return s;
  };

  const getLeavesForDate = (dateStr) => {
    const d = normalizeDate(dateStr);
    return leavesData.filter(
      l =>
        l?.status === "approved" &&
        d >= normalizeDate(l.from_date) &&
        d <= normalizeDate(l.to_date)
    );
  };

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

  // OPTIMIZED VERSION: Pre-index events and leaves by date
  const calendarDays = useMemo(() => {
    const days = [];
    const total = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const todayStr = normalizeDate(new Date());

    // 1️⃣ Pre-index events by date with filters (O(n))
    const eventMap = {};
    for (const e of calendarData) {
      if (!filters[e.type]) continue;
      const d = normalizeDate(e.date);
      if (!eventMap[d]) eventMap[d] = [];
      eventMap[d].push(e);
    }

    // 2️⃣ Pre-index leaves by date range (O(n))
    const leaveMap = {};
    for (const leave of leavesData) {
      if (leave.status !== "approved") continue;

      try {
        if (!leave.from_date || !leave.to_date) {
          continue;
        }

        let current = new Date(leave.from_date + 'T12:00:00');
        const end = new Date(leave.to_date + 'T12:00:00');
        
        if (isNaN(current.getTime()) || isNaN(end.getTime())) {
          continue;
        }

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
  }, [currentYear, currentMonth, calendarData, leavesData, dragOverDate, filters]);

  const handleDayClick = (day) => {
    if (day && (day.events.length > 0 || day.leavesForDay.length > 0)) {
      setSelectedDayEvents(day);
      setIsDayModalOpen(true);
      setActiveTab("all");
    }
  };

  const prevMonth = () =>
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () =>
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

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
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Day Details Modal */}
      {isDayModalOpen && (
        <DayDetailsModal 
          day={selectedDayEvents} 
          onClose={() => setIsDayModalOpen(false)} 
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center space-x-4 flex-wrap gap-2">
          <h2 className="text-xl font-bold text-gray-900">Working Days Calendar</h2>
          <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
            <button 
              onClick={() => setView('month')} 
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${view === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Month View
            </button>
            <button 
              onClick={() => setView('list')} 
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              List View
            </button>
          </div>

          {/* Event Filter Toggles */}
          <div className="flex items-center gap-2 ml-4 flex-wrap">
            {Object.keys(filters).map(type => (
              <button
                key={type}
                onClick={() =>
                  setFilters(prev => ({ ...prev, [type]: !prev[type] }))
                }
                className={`px-3 py-1 text-xs font-medium rounded-full border capitalize ${
                  filters[type]
                    ? type === 'working' ? 'bg-green-100 text-green-700 border-green-300' :
                      type === 'holiday' ? 'bg-red-100 text-red-700 border-red-300' :
                      type === 'weekend' ? 'bg-gray-100 text-gray-700 border-gray-300' :
                      'bg-purple-100 text-purple-700 border-purple-300'
                    : "bg-gray-100 text-gray-500 border-gray-200"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
              <FiChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <h3 className="text-lg font-semibold text-gray-900 min-w-32 text-center">
              {monthNames[currentMonth]} {currentYear}
            </h3>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
              <FiChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>
          <button 
            onClick={onAddEvent} 
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <FiPlus className="h-4 w-4" />
            <span>Add Event</span>
          </button>
        </div>
      </div>

      {/* Month view */}
      {view === 'month' ? (
        <div className="calendar-grid">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map(d => (
              <div key={d} className="p-3 text-center text-sm font-medium text-gray-500 uppercase">
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
                  className={`min-h-24 p-2 rounded-lg transition-all ${style.background} ${style.border} ${day ? 'cursor-pointer hover:shadow-md' : ''} ${day?.isDragOver ? 'border-indigo-400 bg-indigo-100 shadow-inner' : ''} ${hasEvents ? 'font-medium' : ''}`}
                >
                  {day && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium ${style.text}`}>
                          {day.day}
                        </span>
                        {day.isToday && (
                          <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-xs">
                            Today
                          </span>
                        )}
                        {hasEvents && (
                          <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">
                            {day.events.length + day.leavesForDay.length}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                        {/* Show first 2 items */}
                        {day.events.slice(0, 2).map((ev, idx) => (
                          <div
                            key={`event-preview-${ev.id}-${idx}`}
                            className={`px-1.5 py-1 text-[10px] rounded border ${
                              ev.type === 'holiday' ? 'bg-red-100 text-red-800 border-red-200' :
                              ev.type === 'weekend' ? 'bg-gray-100 text-gray-800 border-gray-200' :
                              ev.type === 'working' ? 'bg-green-100 text-green-800 border-green-200' :
                              'bg-purple-100 text-purple-800 border-purple-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate">
                                {ev.type === 'task' ? '📋' : '📅'} {ev.description || ev.type}
                              </span>
                              {ev.centre_name && (
                                <span className="ml-1 text-[8px] bg-white/50 px-1 rounded-full flex-shrink-0">
                                  {ev.centre_name}
                                </span>
                              )}
                            </div>
                            {/* Show staff name for tasks */}
                            {ev.type === 'task' && ev.staff_name && (
                              <div className="flex items-center mt-0.5 text-[8px] text-gray-600">
                                <FiUser className="h-2 w-2 mr-0.5" />
                                <span className="truncate">{ev.staff_name}</span>
                              </div>
                            )}
                          </div>
                        ))}
                        
                        {/* Show leaves with staff names */}
                        {day.leavesForDay.slice(0, 1).map((leave, i) => {
                          const fromDate = leave.from_date;
                          const toDate = leave.to_date;
                          
                          const formattedFromDate = formatShortDate(fromDate);
                          const formattedToDate = formatShortDate(toDate);
                          
                          return (
                            <div
                              key={`leave-preview-${leave.id}-${i}`}
                              className="px-1.5 py-1 text-[10px] rounded border bg-yellow-100 text-yellow-800 border-yellow-200"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium truncate">{leave.staff_name || 'Staff'}</span>
                                <span className="ml-1 text-[8px] bg-yellow-200 px-1 rounded-full">
                                  Leave
                                </span>
                              </div>
                              {(formattedFromDate !== "N/A" || formattedToDate !== "N/A") && (
                                <div className="flex items-center mt-0.5 text-[8px] text-yellow-600">
                                  <FiClock className="h-2 w-2 mr-0.5" />
                                  <span className="truncate">
                                    {formattedFromDate} - {formattedToDate}
                                  </span>
                                </div>
                              )}
                              {leave.centre_name && (
                                <div className="flex items-center mt-0.5 text-[8px] text-yellow-600">
                                  <FiMapPin className="h-2 w-2 mr-0.5" />
                                  <span className="truncate">{leave.centre_name}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        
                        {/* Show count if more items */}
                        {(day.events.length + day.leavesForDay.length) > 2 && (
                          <div className="text-[10px] text-gray-500 text-center bg-gray-100 rounded py-1">
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
        /* List view with filters applied */
        <div className="space-y-3">
          {calendarData
            .filter(e => filters[e.type])
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
              const s = colorMapping[ev.type] || colorMapping.default;
              
              const getEventLabel = () => {
                switch(ev.type) {
                  case 'holiday':
                    return 'Holiday';
                  case 'weekend':
                    return 'Weekend';
                  case 'working':
                    return 'Working Day';
                  case 'task':
                    return 'Task';
                  default:
                    return 'Event';
                }
              };

              // Get staff initials for avatar
              const getStaffInitials = (name) => {
                if (!name) return '';
                return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
              };

              // Get random color for staff avatar based on staff_id
              const getStaffColor = (staffId) => {
                const colors = [
                  'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 
                  'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
                ];
                if (!staffId) return 'bg-gray-400';
                const index = (staffId % colors.length);
                return colors[index];
              };
              
              return (
                <motion.div 
                  key={ev.id || i} 
                  layout 
                  className={`flex items-center justify-between p-4 rounded-lg border ${s.background} ${s.border} ${ev.type !== 'task' ? 'cursor-move' : ''}`} 
                  draggable={ev.type !== 'task'}
                  onDragStart={e => handleDragStart(e, ev)}
                >
                  <div className="flex items-center space-x-4 flex-1">
                    <div className={`flex items-center justify-center w-12 h-12 ${s.background} rounded-lg border ${s.border} relative flex-shrink-0`}>
                      <span className={`text-lg font-bold ${s.text}`}>
                        {new Date(ev.date).getDate()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-semibold ${s.text}`}>
                          {getEventLabel()}
                        </p>
                        {/* Centre badge */}
                        {ev.centre_name ? (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <FiMapPin className="h-3 w-3" />
                            {ev.centre_name}
                          </span>
                        ) : ev.centre_id && centresMap && centresMap[ev.centre_id] ? (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <FiMapPin className="h-3 w-3" />
                            {centresMap[ev.centre_id]}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <FiCalendar className="h-3 w-3" />
                        {formatDate(ev.date)}
                      </p>
                      {ev.description && (
                        <p className="text-sm text-gray-700 mt-1">
                          {ev.description}
                        </p>
                      )}
                      
                      {/* Staff information for tasks */}
                      {ev.type === 'task' && (
                        <div className="flex items-center mt-2">
                          {ev.staff_name ? (
                            <>
                              <div className={`w-5 h-5 rounded-full ${getStaffColor(ev.staff_id)} flex items-center justify-center text-[10px] text-white font-medium mr-2`}>
                                {getStaffInitials(ev.staff_name)}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-700">
                                  {ev.staff_name}
                                </span>
                                {ev.staff_role && (
                                  <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                                    {ev.staff_role}
                                  </span>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center text-xs text-gray-500 italic">
                              <FiUser className="h-3 w-3 mr-1" />
                              Unassigned
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {ev.type !== 'task' && <FiMove className="h-4 w-4 text-gray-400" />}
                    {ev.type !== 'task' && (
                      <>
                        <button 
                          onClick={() => onEditEvent(ev)} 
                          className="p-2 text-gray-600 hover:bg-white rounded-lg"
                        >
                          <FiEdit className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => onDeleteEvent(ev)} 
                          className="p-2 text-red-600 hover:bg-white rounded-lg"
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
              <FiCalendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No events match the selected filters</p>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Color Legend</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
                <span className="text-sm text-gray-600">Today</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div>
                <span className="text-sm text-gray-600">Working Day</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-100 border border-red-200 rounded"></div>
                <span className="text-sm text-gray-600">Holiday</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded"></div>
                <span className="text-sm text-gray-600">Weekend</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-purple-100 border border-purple-200 rounded"></div>
                <span className="text-sm text-gray-600">Task</span>
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-500 flex items-center space-x-2">
            <FiMove className="h-4 w-4" />
            <span>Drag & drop to move (tasks cannot be moved)</span>
          </div>
        </div>

        {/* Centre Legend - Only show for superadmin */}
        {userRole === "superadmin" && Object.keys(centresMap).length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Centres</h4>
            <div className="flex flex-wrap gap-3">
              {Object.entries(centresMap).map(([id, name]) => (
                <div key={id} className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span className="text-xs text-gray-600">{name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
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