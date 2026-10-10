import React from "react";
import {
  FiSend,
  FiMessageSquare,
  FiActivity,
  FiCalendar,
  FiGrid,
  FiCheckSquare,
  FiClock,
} from "react-icons/fi";

export const MESSENGER_NAV_ITEMS = [
  { id: "chats", label: "Chats", icon: FiMessageSquare },
  { id: "activity", label: "Activity", icon: FiActivity },
  { id: "calendar", label: "Calendar", icon: FiCalendar },
  { id: "files", label: "Files", icon: FiGrid },
  { id: "tasks", label: "Tasks", icon: FiCheckSquare },
  { id: "schedules", label: "Schedules", icon: FiClock },
];

const Badge = ({ count }) =>
  count > 0 ? (
    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-semibold flex items-center justify-center ring-2 ring-white">
      {count > 99 ? "99+" : count}
    </span>
  ) : null;

/**
 * Desktop: slim icon rail on the left.
 * Mobile: bottom tab bar (hidden while a chat is open, like WhatsApp).
 * Render it as a direct child of the page's flex container.
 */
const MessengerNav = ({ activeView, onChange, unreadTotal = 0, hideMobileBar = false }) => (
  <>
    {/* Desktop rail */}
    <nav className="hidden md:flex order-first w-[72px] shrink-0 flex-col items-center gap-1 py-4 bg-white border-r border-slate-200">
      <div className="h-10 w-10 rounded-xl bg-navy-700 flex items-center justify-center mb-4 shadow-sm">
        <FiSend className="text-white" size={18} />
      </div>
      {MESSENGER_NAV_ITEMS.map(({ id, label, icon: Icon }) => {
        const active = activeView === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            title={label}
            className={`relative w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition ${
              active ? "bg-blue-50 text-navy-700" : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span className="relative">
              <Icon size={20} />
              {id === "chats" && <Badge count={unreadTotal} />}
            </span>
            <span className={`text-[10px] ${active ? "font-semibold" : "font-medium"}`}>{label}</span>
          </button>
        );
      })}
    </nav>

    {/* Mobile bottom bar */}
    {!hideMobileBar && (
      <nav
        className="md:hidden order-last shrink-0 grid grid-cols-6 bg-white border-t border-slate-200"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {MESSENGER_NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = activeView === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 transition ${
                active ? "text-navy-700" : "text-slate-400"
              }`}
            >
              <span className="relative">
                <Icon size={20} />
                {id === "chats" && <Badge count={unreadTotal} />}
              </span>
              <span className={`text-[10px] ${active ? "font-semibold" : "font-medium"}`}>{label}</span>
            </button>
          );
        })}
      </nav>
    )}
  </>
);

export default MessengerNav;