// pages/CalendarPage.jsx
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  FiGrid,
  FiCalendar,
  FiList,
  FiPlus,
  FiUser,
  FiX,
  FiFlag,
  FiEye,
  FiClock,
  FiEdit,
  FiTrash2,
} from "react-icons/fi";
import useEvents from "../hooks/useEvents";

// ----------------------------------------------------------------------
//  MiniCalendar
// ----------------------------------------------------------------------
function MiniCalendar({ events = [], currentDate, onDateChange }) {
  const [displayDate, setDisplayDate] = useState(
    currentDate ? new Date(currentDate) : new Date()
  );
  const selectedDateStr = currentDate
    ? new Date(currentDate).toISOString().slice(0, 10)
    : null;

  useEffect(() => {
    if (currentDate) setDisplayDate(new Date(currentDate));
  }, [currentDate]);

  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();
  const startOfMonth = new Date(year, month, 1);
  const startDay = (startOfMonth.getDay() + 6) % 7; // Monday start
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const eventMap = useMemo(() => {
    const map = {};
    events.forEach((e) => {
      const dateStr = (e.start_datetime || e.date)?.toString().slice(0, 10);
      if (!dateStr) return;
      if (!map[dateStr]) map[dateStr] = { count: 0, hasHigh: false };
      map[dateStr].count++;
      if (e.priority === "high") map[dateStr].hasHigh = true;
    });
    return map;
  }, [events]);

  const days = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dateStr = dateObj.toISOString().slice(0, 10);
    days.push({
      day: d,
      dateStr,
      isToday: dateStr === new Date().toISOString().slice(0, 10),
      isSelected: dateStr === selectedDateStr,
      events: eventMap[dateStr],
    });
  }

  const changeMonth = (delta) => {
    const newDate = new Date(displayDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setDisplayDate(newDate);
  };

  return (
    <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => changeMonth(-1)}><FiChevronLeft /></button>
        <h3 className="text-sm font-semibold">
          {displayDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h3>
        <button onClick={() => changeMonth(1)}><FiChevronRight /></button>
      </div>
      <div className="grid grid-cols-7 text-xs text-center text-gray-400 mb-1">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((cell, i) =>
          !cell ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              onClick={() => onDateChange?.(new Date(year, month, cell.day))}
              className={`aspect-square flex items-center justify-center text-xs rounded-full relative ${
                cell.isSelected
                  ? "bg-indigo-600 text-white font-bold"
                  : cell.isToday
                  ? "border border-indigo-500 text-indigo-600"
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              {cell.day}
              {cell.events && (
                <span
                  className={`absolute bottom-0.5 w-1.5 h-1.5 rounded-full ${
                    cell.events.hasHigh ? "bg-red-500" : "bg-indigo-400"
                  }`}
                />
              )}
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
//  AgendaView
// ----------------------------------------------------------------------
function AgendaView({ calendarData = [], leavesData = [], onEventClick, onEdit, onDelete }) {
  const allItems = useMemo(() => {
    const items = [];
    calendarData.forEach((e) => {
      const date = e.date || e.start_datetime?.split("T")[0];
      if (!date) return;
      items.push({ ...e, itemType: "event", sortDate: date });
    });
    leavesData
      .filter((l) => l.status === "approved")
      .forEach((l) => {
        const date = l.from_date?.split("T")[0];
        if (!date) return;
        items.push({ ...l, itemType: "leave", sortDate: date });
      });
    return items;
  }, [calendarData, leavesData]);

  const grouped = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const overdue = [], todayItems = [], tomorrowItems = [], upcoming = [];
    allItems.forEach((item) => {
      if (!item.sortDate) return;
      if (item.sortDate < todayStr) overdue.push(item);
      else if (item.sortDate === todayStr) todayItems.push(item);
      else if (item.sortDate === tomorrowStr) tomorrowItems.push(item);
      else upcoming.push(item);
    });

    const sortFn = (a, b) => {
      if (a.priority === "high" && b.priority !== "high") return -1;
      if (b.priority === "high" && a.priority !== "high") return 1;
      return new Date(a.sortDate) - new Date(b.sortDate);
    };
    return {
      overdue: overdue.sort(sortFn),
      today: todayItems.sort(sortFn),
      tomorrow: tomorrowItems.sort(sortFn),
      upcoming: upcoming.sort(sortFn),
    };
  }, [allItems]);

  const eventTypeStyles = {
    deadline: { dot: "bg-red-500", label: "Deadline" },
    start: { dot: "bg-green-500", label: "Start" },
    announcement: { dot: "bg-blue-500", label: "Announcement" },
    expiry: { dot: "bg-yellow-500", label: "Expiry" },
    task: { dot: "bg-purple-500", label: "Task" },
    default: { dot: "bg-gray-400", label: "Event" },
  };

  const renderSection = (title, items, highlight) => {
    if (!items.length) return null;
    return (
      <div>
        <h3 className={`text-sm font-semibold mb-3 ${
          highlight === "overdue" ? "text-red-600" : highlight === "today" ? "text-indigo-600" : "text-gray-700"
        }`}>
          {title}
        </h3>
        <div className="space-y-2">
          {items.map((item, idx) => {
            if (item.itemType === "leave") {
              return (
                <div key={`leave-${item.id}-${idx}`} className="flex items-center gap-2 p-2 rounded-lg bg-yellow-50 border border-yellow-200 text-sm">
                  <FiUser className="h-4 w-4 text-yellow-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800">{item.staff_name || "Staff"}</span>
                    <span className="text-xs text-gray-500 ml-1">
                      Leave: {new Date(item.from_date).toLocaleDateString()} – {new Date(item.to_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            }
            const style = eventTypeStyles[item.event_type] || eventTypeStyles.default;
            return (
              <div
                key={`ev-${item.id}-${idx}`}
                onClick={() => onEventClick(item)}
                className={`group flex items-center justify-between p-2.5 rounded-lg border bg-white hover:shadow-sm transition cursor-pointer ${
                  highlight === "overdue" ? "border-red-200 bg-red-50" : highlight === "today" ? "border-indigo-200 bg-indigo-50" : "border-gray-200"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {item.title || style.label}
                      {item.priority === "high" && <span className="ml-2 text-[10px] text-red-600 font-semibold">HIGH</span>}
                    </p>
                    {item.service_name && <p className="text-xs text-gray-400 truncate">{item.service_name}</p>}
                    {item.description && <p className="text-xs text-gray-400 truncate">{item.description}</p>}
                    {item.start_datetime && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <FiClock className="h-3 w-3" />
                        {new Date(item.start_datetime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600">
                    <FiEdit className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(item); }} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600">
                    <FiTrash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!grouped.overdue.length && !grouped.today.length && !grouped.tomorrow.length && !grouped.upcoming.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <FiCalendar className="h-12 w-12 mb-4 text-gray-200" />
        <p className="text-sm">No upcoming events 🎉</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderSection("Overdue", grouped.overdue, "overdue")}
      {renderSection("Today", grouped.today, "today")}
      {renderSection("Tomorrow", grouped.tomorrow)}
      {renderSection("Upcoming", grouped.upcoming)}
    </div>
  );
}

// ----------------------------------------------------------------------
//  CalendarView
// ----------------------------------------------------------------------
const eventColors = {
  deadline: { bg: "#fecaca", border: "#f87171", text: "#991b1b" },
  start: { bg: "#bbf7d0", border: "#4ade80", text: "#166534" },
  announcement: { bg: "#bfdbfe", border: "#60a5fa", text: "#1e3a8a" },
  expiry: { bg: "#fde68a", border: "#facc15", text: "#713f12" },
  task: { bg: "#fbd38d", border: "#f6ad55", text: "#7c2d12" },
  default: { bg: "#e5e7eb", border: "#9ca3af", text: "#374151" },
};

function getEventStyle(event) {
  const key = event.event_type || (event.type === "task" ? "task" : null);
  return eventColors[key] || eventColors.default;
}

function CalendarView({ events, viewMode, onEventClick, onDateClick }) {
  const mappedEvents = useMemo(() => {
    return events
      .sort((a, b) => {
        if (a.priority === "high" && b.priority !== "high") return -1;
        if (b.priority === "high" && a.priority !== "high") return 1;
        const aDate = new Date(a.start_datetime || a.date || 0);
        const bDate = new Date(b.start_datetime || b.date || 0);
        return aDate - bDate;
      })
      .map((ev) => {
        const colors = getEventStyle(ev);
        return {
          id: ev.id.toString(),
          title: ev.title,
          start: ev.start_datetime || ev.date,
          end: ev.end_datetime,
          allDay: !ev.start_datetime,
          backgroundColor: colors.bg,
          borderColor: colors.border,
          textColor: colors.text,
          extendedProps: ev,
        };
      });
  }, [events]);

  const handleDateClick = (arg) => {
    onDateClick?.({ date: arg.dateStr, isNew: true });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex flex-wrap gap-3 mb-3 text-xs">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded-full" /> Deadline</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-400 rounded-full" /> Start</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-400 rounded-full" /> Announcement</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-orange-400 rounded-full" /> Task</span>
      </div>
      <FullCalendar
        key={viewMode}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={viewMode === "week" ? "timeGridWeek" : "dayGridMonth"}
        initialDate={new Date()}
        events={mappedEvents}
        eventClick={(info) =>
          onEventClick({ ...info.event.extendedProps, start: info.event.start, end: info.event.end })
        }
        dateClick={handleDateClick}
        headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
        height="auto"
        dayMaxEvents={true}
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", meridiem: "short" }}
        slotLabelFormat={{ hour: "2-digit", minute: "2-digit", meridiem: "short" }}
        eventDisplay="block"
        nowIndicator={true}
        dayCellClassNames={(arg) => (arg.isToday ? ["bg-blue-50"] : [])}
        eventContent={(arg) => {
          const { event_type, priority } = arg.event.extendedProps;
          return (
            <div className="px-1 py-0.5 text-xs font-medium leading-tight">
              <div>{arg.event.title}</div>
              {event_type && (
                <div className="text-[10px] opacity-70 capitalize">
                  {event_type}
                  {priority && priority !== "medium" && ` · ${priority}`}
                </div>
              )}
            </div>
          );
        }}
        eventDidMount={(info) => {
          const { description, event_type, priority } = info.event.extendedProps;
          const parts = [`Type: ${event_type || "event"}`];
          if (priority) parts.push(`Priority: ${priority}`);
          if (description) parts.push(description);
          info.el.title = parts.join("\n");
        }}
      />
    </div>
  );
}

// ----------------------------------------------------------------------
//  EventModal
// ----------------------------------------------------------------------
function EventModal({ event, onClose, onDelete, onUpdate, onEdit }) {
  if (!event) return null;

  const eventTypeLabel = {
    deadline: "Deadline",
    start: "Start",
    expiry: "Expiry",
    announcement: "Announcement",
  }[event.event_type] || "Event";

  const colorSets = {
    deadline: "border-red-200 bg-red-50",
    start: "border-green-200 bg-green-50",
    expiry: "border-yellow-200 bg-yellow-50",
    announcement: "border-blue-200 bg-blue-50",
    task: "border-purple-200 bg-purple-50",
    default: "border-gray-200 bg-gray-50",
  };
  const borderColor = colorSets[event.event_type] || (event.type === "task" ? colorSets.task : colorSets.default);

  const priorityColor = {
    high: "bg-red-100 text-red-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-green-100 text-green-700",
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border ${borderColor}`}
        >
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-black/5">
            <FiX className="h-5 w-5 text-gray-400" />
          </button>
          <h2 className="text-xl font-semibold text-gray-900 pr-8 mb-2">{event.title}</h2>
          {event.status === "completed" && (
            <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">Completed</span>
          )}
          {event.description && <p className="text-gray-600 text-sm mt-3">{event.description}</p>}
          <div className="space-y-3 text-sm mt-4">
            <div className="flex items-center gap-2 text-gray-700">
              <FiCalendar className="h-4 w-4 text-gray-400" />
              <span>
                {event.start_datetime
                  ? new Date(event.start_datetime).toLocaleDateString()
                  : event.date}
              </span>
            </div>
            {event.start_datetime && (
              <div className="flex items-center gap-2 text-gray-700">
                <FiClock className="h-4 w-4 text-gray-400" />
                <span>
                  {new Date(event.start_datetime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {event.end_datetime &&
                    ` - ${new Date(event.end_datetime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-gray-700">
              <FiFlag className="h-4 w-4 text-gray-400" />
              <span>{eventTypeLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Priority:</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColor[event.priority] || "bg-gray-100 text-gray-600"}`}>
                {event.priority}
              </span>
            </div>
            {event.visibility && (
              <div className="flex items-center gap-2 text-gray-700">
                <FiEye className="h-4 w-4 text-gray-400" />
                <span className="capitalize">{event.visibility}</span>
              </div>
            )}
            {event.service_name && (
              <div className="flex items-center gap-2 text-gray-700">
                <span className="text-gray-500">Service:</span>
                <span>{event.service_name}</span>
              </div>
            )}
            {event.assigned_to && (
              <div className="flex items-center gap-2 text-gray-700">
                <FiUser className="h-4 w-4 text-gray-400" />
                <span>{event.assigned_to}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-6 pt-4 border-t">
            {onEdit && (
              <button
                onClick={() => { onEdit(event); onClose(); }}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm"
              >
                <FiEdit className="inline mr-1" /> Edit
              </button>
            )}
            {event.status !== "completed" && (
              <button
                onClick={() => { onUpdate(event.id, { status: "completed" }); onClose(); }}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm"
              >
                Complete
              </button>
            )}
            <button
              onClick={() => { onDelete(event.id); onClose(); }}
              className="flex-1 bg-white border border-red-200 text-red-600 py-2 rounded-lg text-sm"
            >
              Delete
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ----------------------------------------------------------------------
//  CreateEventModal
// ----------------------------------------------------------------------
function CreateEventModal({ onSave, onClose, initialData, services = [], staffList = [], userRole = "admin" }) {
  const today = new Date().toISOString().slice(0, 10);
  // 🔥 fixed: default integer fields to null instead of ""
  const [form, setForm] = useState(
    initialData || {
      title: "",
      description: "",
      date: today,
      start_datetime: `${today}T09:00`,
      end_datetime: `${today}T17:00`,
      type: "task",
      event_type: "deadline",
      priority: "medium",
      visibility: "centre",
      related_service_id: null,    // now null
      assigned_to: null,           // now null
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (form.start_datetime && form.end_datetime && new Date(form.end_datetime) < new Date(form.start_datetime)) {
      alert("End time cannot be before start time");
      return;
    }
    // ensure empty strings become null before sending
    onSave({
      ...form,
      assigned_to: form.assigned_to || null,
      related_service_id: form.related_service_id || null,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">{initialData ? "Edit Event" : "Create Event"}</h2>
            <button onClick={onClose}><FiX /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              className="w-full border p-2 rounded"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <textarea
              className="w-full border p-2 rounded"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <div className="flex gap-2">
                <input
                  type="time"
                  value={form.start_datetime.split("T")[1]}
                  onChange={(e) => setForm({ ...form, start_datetime: `${form.date}T${e.target.value}` })}
                />
                <input
                  type="time"
                  value={form.end_datetime.split("T")[1]}
                  onChange={(e) => setForm({ ...form, end_datetime: `${form.date}T${e.target.value}` })}
                />
              </div>
            </div>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="application">Application</option>
              <option value="task">Task</option>
              <option value="service">Service</option>
              <option value="holiday">Holiday</option>
            </select>
            <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>
              <option value="start">Start</option>
              <option value="deadline">Deadline</option>
              <option value="expiry">Expiry</option>
              <option value="announcement">Announcement</option>
            </select>
            {/* Service dropdown */}
            <select
              value={form.related_service_id || ""}
              onChange={(e) => setForm({ ...form, related_service_id: e.target.value || null })}
            >
              <option value="">No Service</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {/* Staff dropdown */}
            <select
              value={form.assigned_to || ""}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value || null })}
            >
              <option value="">Unassigned</option>
              {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            {userRole === "superadmin" && (
              <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
                <option value="centre">Centre</option>
                <option value="global">Global</option>
              </select>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose}>Cancel</button>
              <button type="submit">{initialData ? "Update" : "Save"}</button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ----------------------------------------------------------------------
//  CalendarToolbar
// ----------------------------------------------------------------------
function CalendarToolbar({ viewMode, setViewMode, filters, setFilters, onAddEvent, userRole = "admin", services = [] }) {
  const viewOptions = [
    { key: "month", label: "Month", icon: <FiGrid className="h-4 w-4" /> },
    { key: "week", label: "Week", icon: <FiCalendar className="h-4 w-4" /> },
    { key: "agenda", label: "Agenda", icon: <FiList className="h-4 w-4" /> },
  ];

  const typeFilters = [
    { key: "application", label: "Applications" },
    { key: "task", label: "Tasks" },
    { key: "service", label: "Services" },
    { key: "holiday", label: "Holidays" },
  ];

  const handleTypeToggle = (type) => {
    setFilters((prev) => ({ ...prev, type: prev.type === type ? null : type }));
  };
  const handleMyEventsToggle = () => {
    setFilters((prev) => ({ ...prev, myEvents: !prev.myEvents }));
  };
  const handleClearFilters = () => {
    setFilters({ type: null, priority: "", event_type: "", visibility: "centre", service_id: "", myEvents: false });
  };

  return (
    <motion.div
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-gray-200 px-4 py-2.5"
    >
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1" role="group">
            {viewOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setViewMode(opt.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === opt.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
          <button onClick={handleClearFilters} className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-800 transition">
            <FiX className="h-3 w-3" /> Clear
          </button>
        </div>
        <button onClick={onAddEvent} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 active:bg-indigo-800 shadow-sm transition-all">
          <FiPlus className="h-3.5 w-3.5" />
          <span>Add Event</span>
        </button>
      </div>
      <div className="flex items-center flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1">
          {typeFilters.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleTypeToggle(key)}
              className={`px-3 py-1 rounded-full border font-medium capitalize transition-colors ${
                filters.type === key
                  ? key === "application"
                    ? "bg-indigo-100 text-indigo-700 border-indigo-300"
                    : key === "task"
                    ? "bg-purple-100 text-purple-700 border-purple-300"
                    : key === "service"
                    ? "bg-cyan-100 text-cyan-700 border-cyan-300"
                    : "bg-red-100 text-red-700 border-red-300"
                  : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select className="border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-600 shadow-sm" value={filters.priority || ""} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
          <option value="">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select className="border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-600 shadow-sm" value={filters.event_type || ""} onChange={(e) => setFilters({ ...filters, event_type: e.target.value })}>
          <option value="">All Event Types</option>
          <option value="start">Start</option>
          <option value="deadline">Deadline</option>
          <option value="expiry">Expiry</option>
          <option value="announcement">Announcement</option>
        </select>
        {services.length > 0 && (
          <select className="border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-600 shadow-sm" value={filters.service_id || ""} onChange={(e) => setFilters({ ...filters, service_id: e.target.value })}>
            <option value="">All Services</option>
            {services.map((svc) => <option key={svc.id} value={svc.id.toString()}>{svc.name}</option>)}
          </select>
        )}
        {userRole === "superadmin" && (
          <select className="border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-600 shadow-sm" value={filters.visibility || "centre"} onChange={(e) => setFilters({ ...filters, visibility: e.target.value })}>
            <option value="">All Visibility</option>
            <option value="centre">Centre</option>
            <option value="global">Global</option>
          </select>
        )}
        <button
          onClick={handleMyEventsToggle}
          className={`flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
            filters.myEvents ? "bg-indigo-100 text-indigo-700 border-indigo-300" : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
          }`}
        >
          <FiUser className="h-3 w-3" /> My Events
        </button>
      </div>
    </motion.div>
  );
}

// ----------------------------------------------------------------------
//  JWT helpers (inline)
// ----------------------------------------------------------------------
function getTokenClaims() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload));
    return {
      id: decoded.id,
      role: decoded.role,
      centreId: decoded.centre_id,
      name: decoded.name,
    };
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------
//  Main CalendarPage
// ----------------------------------------------------------------------
export default function CalendarPage() {
  // ---------- Auth ----------
  const claims = getTokenClaims();
  const userRole = claims?.role || "staff";
  const userId = claims?.id;
  const userCentreId = claims?.centreId;

  // ---------- Centres (superadmin) ----------
  const [centres, setCentres] = useState([]);
  const [activeCentreId, setActiveCentreId] = useState(null);

  useEffect(() => {
    if (userRole === "superadmin") {
      fetch(`${import.meta.env.VITE_API_URL}/api/wallet/centres`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      })
        .then(res => res.json())
        .then(data => setCentres(data))
        .catch(() => setCentres([]));
    } else {
      setActiveCentreId(userCentreId);
    }
  }, [userRole, userCentreId]);

  // ---------- Services & Staff for dropdowns ----------
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);

  // Fetch services & staff when centre is active
  useEffect(() => {
    if (!activeCentreId) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    // Services – correct endpoint from servicemanagement.js
    fetch(`${import.meta.env.VITE_API_URL}/api/servicemanagement/services`, { headers })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setServices(data.map(s => ({ id: s.id, name: s.name })));
        } else {
          console.error("Services response is not an array", data);
          setServices([]);
        }
      })
      .catch(err => {
        console.error("FETCH SERVICES ERROR:", err);
        setServices([]);
      });

    // Staff – correct endpoint from servicemanagement.js
    fetch(`${import.meta.env.VITE_API_URL}/api/servicemanagement/staff?centre_id=${activeCentreId}`, { headers })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setStaff(data.map(s => ({ id: s.id, name: s.name })));
        } else {
          console.error("Staff response is not an array", data);
          setStaff([]);
        }
      })
      .catch(err => {
        console.error("FETCH STAFF ERROR:", err);
        setStaff([]);
      });
  }, [activeCentreId]);

  // Toolbar services list (reuse the same `services` array)
  const servicesList = services;

  const leavesData = []; // placeholder

  // ---------- Hook filters (sync centreId) ----------
  const [hookFilters, setHookFilters] = useState({
    centreId: activeCentreId,
  });

  useEffect(() => {
    setHookFilters(prev => ({ ...prev, centreId: activeCentreId }));
  }, [activeCentreId]);

  const {
    events = [],
    loading,
    error,
    addEvent: hookCreateEvent,
    editEvent: hookUpdateEvent,
    removeEvent: hookDeleteEvent,
  } = useEvents(hookFilters);

  // ---------- UI filters ----------
  const [filters, setFilters] = useState({
    type: "",
    priority: "",
    event_type: "",
    visibility: "centre",
    service_id: "",
    myEvents: false,
  });

  const [viewMode, setViewMode] = useState("month");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  // ---------- Client‑side filtering ----------
  const filteredEvents = useMemo(() => {
    if (!Array.isArray(events)) return [];
    return events.filter((e) => {
      if (filters.type && e.type !== filters.type) return false;
      if (filters.priority && e.priority !== filters.priority) return false;
      if (filters.event_type && e.event_type !== filters.event_type) return false;
      if (filters.visibility && e.visibility !== filters.visibility) return false;
      if (filters.service_id && e.related_service_id?.toString() !== filters.service_id) return false;
      if (filters.myEvents) {
        const isMine = e.created_by === userId || e.assigned_to === userId;
        if (!isMine) return false;
      }
      return true;
    });
  }, [events, filters, userId]);

  // ---------- CRUD handlers ----------
  const handleAddEvent = useCallback((data) => { hookCreateEvent(data); setShowCreateModal(false); setEditEvent(null); }, [hookCreateEvent]);
  const handleEditEvent = useCallback((data) => { hookUpdateEvent(data.id, data); setShowCreateModal(false); setEditEvent(null); }, [hookUpdateEvent]);
  const handleDeleteEvent = useCallback((id) => { hookDeleteEvent(id); setSelectedEvent(null); }, [hookDeleteEvent]);

  const openCreateModal = () => { setEditEvent(null); setShowCreateModal(true); };
  const openEditModal = (event) => { setEditEvent(event); setShowCreateModal(true); };

  const handleMiniCalendarDateChange = (date) => {
    setCurrentDate(date);
  };

  const handleCalendarEventClick = (event) => {
    if (event.isNew) {
      setEditEvent({ date: event.date });
      setShowCreateModal(true);
    } else {
      setSelectedEvent(event);
    }
  };

  // ---------- Superadmin centre picker ----------
  if (userRole === "superadmin" && !activeCentreId) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Select a Centre to View Calendar</h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {centres.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCentreId(c.id)}
                className="bg-white p-6 rounded-xl border hover:shadow-md text-left"
              >
                <h3 className="font-bold text-lg">{c.name}</h3>
                <p className="text-sm text-gray-500">{c.location || 'No Location'}</p>
                <div className="mt-4 text-indigo-600 text-sm font-medium">View Calendar →</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------- Main calendar view ----------
  const isLoading = loading;
  const hasEvents = filteredEvents.length > 0;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {userRole === "superadmin" && activeCentreId && (
        <div className="bg-indigo-50 px-4 py-1 text-xs text-indigo-700 border-b border-indigo-200 flex justify-between items-center">
          <span>
            Viewing: {centres.find(c => c.id === activeCentreId)?.name || `Centre ${activeCentreId}`}
          </span>
          <button
            onClick={() => setActiveCentreId(null)}
            className="underline hover:text-indigo-900"
          >
            Change centre
          </button>
        </div>
      )}

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
        {viewMode !== "agenda" && (
          <aside className="hidden lg:block w-64 p-4 border-r border-gray-200 overflow-y-auto bg-white">
            <MiniCalendar events={filteredEvents} currentDate={currentDate} onDateChange={handleMiniCalendarDateChange} />
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
              onDelete={(item) => handleDeleteEvent(item.id)}
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
              events={filteredEvents}
              viewMode={viewMode}
              onEventClick={handleCalendarEventClick}
              onDateClick={handleCalendarEventClick}
            />
          )}
        </main>
      </div>

      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={handleDeleteEvent}
          onUpdate={hookUpdateEvent}
          onEdit={openEditModal}
        />
      )}

      {showCreateModal && (
        <CreateEventModal
          initialData={editEvent || undefined}
          onSave={(data) => {
            if (editEvent?.id) handleEditEvent({ ...editEvent, ...data });
            else handleAddEvent(data);
          }}
          onClose={() => { setShowCreateModal(false); setEditEvent(null); }}
          userRole={userRole}
          services={services}
          staffList={staff}
        />
      )}
    </div>
  );
}