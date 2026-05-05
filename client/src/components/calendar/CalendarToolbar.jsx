// components/calendar/CalendarToolbar.jsx
export default function CalendarToolbar({
  viewMode,
  setViewMode,
  filters,
  setFilters,
  onAddEvent,
}) {
  const viewOptions = [
    { key: "month", label: "Month" },
    { key: "week", label: "Week" },
    { key: "agenda", label: "Agenda" },
  ];

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3">
      {/* View Switcher */}
      <div className="flex space-x-1">
        {viewOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setViewMode(opt.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
              viewMode === opt.key
                ? "bg-gray-800 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-1 items-center space-x-2 ml-auto">
        <select
          className="border border-gray-200 text-xs rounded-md px-2 py-1.5 bg-white"
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
        >
          <option value="">All Types</option>
          <option value="application">Application</option>
          <option value="task">Task</option>
          <option value="service">Service</option>
        </select>

        <select
          className="border border-gray-200 text-xs rounded-md px-2 py-1.5 bg-white"
          value={filters.priority}
          onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
        >
          <option value="">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          className="border border-gray-200 text-xs rounded-md px-2 py-1.5 bg-white"
          value={filters.event_type}
          onChange={(e) => setFilters({ ...filters, event_type: e.target.value })}
        >
          <option value="">All Event Types</option>
          <option value="deadline">Deadline</option>
          <option value="start">Start</option>
          <option value="expiry">Expiry</option>
          <option value="announcement">Announcement</option>
        </select>

        <button
          onClick={onAddEvent}
          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 ml-2"
        >
          + Add Event
        </button>
      </div>
    </div>
  );
}