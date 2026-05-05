// components/calendar/MiniCalendar.jsx
export default function MiniCalendar({ events = [], onDateClick }) {
  // Simplified: show current month with indicators
  return (
    <div className="p-2 bg-white rounded-lg border border-gray-200">
      <div className="text-xs text-gray-500 text-center">May 2026</div>
      {/* ... minimal implementation ... */}
    </div>
  );
}