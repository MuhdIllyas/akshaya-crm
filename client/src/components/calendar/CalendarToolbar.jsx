// components/calendar/CalendarToolbar.jsx
import { FiGrid, FiCalendar, FiList, FiPlus, FiUser, FiX } from "react-icons/fi";
import { motion } from "framer-motion";

export default function CalendarToolbar({
  viewMode,
  setViewMode,
  filters,
  setFilters,
  onAddEvent,
  userRole = "admin",
  services = [],        // Array of { id, name } for service filter
}) {
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

  // Toggle a single type filter (single‑select)
  const handleTypeToggle = (type) => {
    setFilters((prev) => ({
      ...prev,
      type: prev.type === type ? null : type,
    }));
  };

  // Toggle myEvents
  const handleMyEventsToggle = () => {
    setFilters((prev) => ({ ...prev, myEvents: !prev.myEvents }));
  };

  // Clear all filters except view‑related
  const handleClearFilters = () => {
    setFilters({
      // keep essential defaults if needed, but empty is fine
      type: null,
      priority: "",
      event_type: "",
      visibility: "centre",
      service_id: "",
      myEvents: false,
    });
  };

  return (
    <motion.div
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-gray-200 px-4 py-2.5"
    >
      {/* Top row: view switcher + add button */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Switcher */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1" role="group">
            {viewOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setViewMode(opt.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === opt.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>

          {/* Clear filters button */}
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-800 transition"
          >
            <FiX className="h-3 w-3" />
            Clear
          </button>
        </div>

        <button
          onClick={onAddEvent}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 active:bg-indigo-800 shadow-sm transition-all"
        >
          <FiPlus className="h-3.5 w-3.5" />
          <span>Add Event</span>
        </button>
      </div>

      {/* Filters row */}
      <div className="flex items-center flex-wrap gap-2 text-xs">
        {/* Type filter pills (single select) */}
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

        {/* Priority dropdown */}
        <select
          className="border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-600 shadow-sm"
          value={filters.priority || ""}
          onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
        >
          <option value="">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Event type dropdown */}
        <select
          className="border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-600 shadow-sm"
          value={filters.event_type || ""}
          onChange={(e) => setFilters({ ...filters, event_type: e.target.value })}
        >
          <option value="">All Event Types</option>
          <option value="start">Start</option>
          <option value="deadline">Deadline</option>
          <option value="expiry">Expiry</option>
          <option value="announcement">Announcement</option>
        </select>

        {/* Service filter (visible if services list provided) */}
        {services.length > 0 && (
          <select
            className="border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-600 shadow-sm"
            value={filters.service_id || ""}
            onChange={(e) => setFilters({ ...filters, service_id: e.target.value })}
          >
            <option value="">All Services</option>
            {services.map((svc) => (
              <option key={svc.id} value={svc.id.toString()}>
                {svc.name}
              </option>
            ))}
          </select>
        )}

        {/* Visibility dropdown (superadmin only) */}
        {userRole === "superadmin" && (
          <select
            className="border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-600 shadow-sm"
            value={filters.visibility || "centre"}
            onChange={(e) => setFilters({ ...filters, visibility: e.target.value })}
          >
            <option value="">All Visibility</option>
            <option value="centre">Centre</option>
            <option value="global">Global</option>
          </select>
        )}

        {/* My Events toggle */}
        <button
          onClick={handleMyEventsToggle}
          className={`flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
            filters.myEvents
              ? "bg-indigo-100 text-indigo-700 border-indigo-300"
              : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
          }`}
        >
          <FiUser className="h-3 w-3" />
          My Events
        </button>
      </div>
    </motion.div>
  );
}