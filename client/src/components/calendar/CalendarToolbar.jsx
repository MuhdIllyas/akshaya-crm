// components/calendar/CalendarToolbar.jsx
import { FiGrid, FiList, FiFilter, FiPlus } from "react-icons/fi";
import { motion } from "framer-motion";

export default function CalendarToolbar({
  viewMode,
  setViewMode,
  filters,
  setFilters,
  onAddEvent,
  userRole = "admin",
}) {
  const viewOptions = [
    { key: "month", label: "Month", icon: <FiGrid className="h-4 w-4" /> },
    { key: "list", label: "List", icon: <FiList className="h-4 w-4" /> },
    { key: "agenda", label: "Agenda", icon: <FiFilter className="h-4 w-4" /> },
  ];

  const typeFilters = ["working", "holiday", "weekend", "task"];

  return (
    <motion.div
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-4 py-2.5 flex items-center justify-between flex-wrap gap-3"
    >
      {/* Left: View switcher + type toggles */}
      <div className="flex items-center flex-wrap gap-2">
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

        <div className="flex items-center gap-1 ml-1">
          {typeFilters.map((type) => (
            <button
              key={type}
              onClick={() =>
                setFilters((prev) => ({ ...prev, [type]: !prev[type] }))
              }
              className={`px-3 py-1 text-xs font-medium rounded-full border capitalize transition-colors ${
                filters[type]
                  ? type === "working"
                    ? "bg-green-100 text-green-700 border-green-300"
                    : type === "holiday"
                    ? "bg-red-100 text-red-700 border-red-300"
                    : type === "weekend"
                    ? "bg-gray-200 text-gray-700 border-gray-400"
                    : "bg-purple-100 text-purple-700 border-purple-300"
                  : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Right: additional filters + add btn */}
      <div className="flex items-center gap-2">
        {filters.priority !== undefined && (
          <select
            className="border border-gray-200 text-xs rounded-md px-2 py-1.5 bg-white text-gray-600 shadow-sm"
            value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
          >
            <option value="">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        )}
        {filters.event_type !== undefined && (
          <select
            className="border border-gray-200 text-xs rounded-md px-2 py-1.5 bg-white text-gray-600 shadow-sm"
            value={filters.event_type}
            onChange={(e) => setFilters({ ...filters, event_type: e.target.value })}
          >
            <option value="">All Event Types</option>
            <option value="start">Start</option>
            <option value="deadline">Deadline</option>
            <option value="expiry">Expiry</option>
            <option value="announcement">Announcement</option>
          </select>
        )}
        {userRole === "superadmin" && filters.visibility !== undefined && (
          <select
            className="border border-gray-200 text-xs rounded-md px-2 py-1.5 bg-white text-gray-600 shadow-sm"
            value={filters.visibility}
            onChange={(e) => setFilters({ ...filters, visibility: e.target.value })}
          >
            <option value="">All Visibility</option>
            <option value="centre">Centre</option>
            <option value="global">Global</option>
          </select>
        )}

        <button
          onClick={onAddEvent}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 active:bg-indigo-800 shadow-sm transition-all ml-1"
        >
          <FiPlus className="h-3.5 w-3.5" />
          <span>Add Event</span>
        </button>
      </div>
    </motion.div>
  );
}