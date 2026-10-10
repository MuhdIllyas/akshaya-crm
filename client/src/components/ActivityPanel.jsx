import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiActivity,
  FiRefreshCw,
  FiCheckSquare,
  FiCheckCircle,
  FiEdit2,
  FiPlus,
  FiTrash2,
  FiFileText,
  FiUserPlus,
  FiUserMinus,
  FiBriefcase,
  FiLogIn,
  FiLogOut,
  FiXCircle,
  FiHome,
  FiChevronDown,
  FiArrowUp,
  FiLock,
} from "react-icons/fi";
// Shared socket
import { socket } from "@/services/socket";

/* ══════════════════════════════════════════════════════════════
   Privacy: chat messages never appear in the activity feed.
   (The backend should also stop logging them — see notes.)
   ══════════════════════════════════════════════════════════════ */
const isPrivateChatActivity = (a) => {
  const action = String(a?.action || "").toLowerCase();
  const type = String(a?.related_type || "").toLowerCase();
  return (
    action.includes("message") ||
    type === "message" ||
    type === "chat_message" ||
    type === "chat"
  );
};

/* ══════════════════════════════════════════════════════════════
   Presentation helpers
   ══════════════════════════════════════════════════════════════ */
const CATEGORY_TABS = [
  { id: "all", label: "All" },
  { id: "task", label: "Tasks" },
  { id: "service", label: "Services" },
  { id: "document", label: "Documents" },
  { id: "team", label: "Team" },
];

const getCategory = (a) => {
  const text = `${a?.action || ""} ${a?.related_type || ""}`.toLowerCase();
  if (text.includes("task")) return "task";
  if (text.includes("document") || text.includes("file")) return "document";
  if (text.includes("collaborator") || text.includes("participant") || text.includes("login") || text.includes("logout") || text.includes("staff"))
    return "team";
  if (text.includes("service") || text.includes("workspace") || text.includes("tracking")) return "service";
  return "other";
};

// Icon + colour for each kind of action
const getVisual = (action = "") => {
  const s = action.toLowerCase();
  if (s.includes("complete") || s.includes("approve")) return { Icon: FiCheckCircle, cls: "bg-emerald-50 text-emerald-600 ring-emerald-100" };
  if (s.includes("reject") || s.includes("cancel")) return { Icon: FiXCircle, cls: "bg-rose-50 text-rose-600 ring-rose-100" };
  if (s.includes("delete") || s.includes("remove") || s.includes("closed")) {
    return s.includes("collaborator") || s.includes("participant")
      ? { Icon: FiUserMinus, cls: "bg-rose-50 text-rose-600 ring-rose-100" }
      : { Icon: FiTrash2, cls: "bg-rose-50 text-rose-600 ring-rose-100" };
  }
  if (s.includes("collaborator") || s.includes("participant") || s.includes("assign")) return { Icon: FiUserPlus, cls: "bg-violet-50 text-violet-600 ring-violet-100" };
  if (s.includes("document") || s.includes("file") || s.includes("upload")) return { Icon: FiFileText, cls: "bg-sky-50 text-sky-600 ring-sky-100" };
  if (s.includes("login")) return { Icon: FiLogIn, cls: "bg-indigo-50 text-indigo-600 ring-indigo-100" };
  if (s.includes("logout")) return { Icon: FiLogOut, cls: "bg-slate-100 text-slate-500 ring-slate-200" };
  if (s.includes("update") || s.includes("edit") || s.includes("status")) return { Icon: FiEdit2, cls: "bg-blue-50 text-blue-600 ring-blue-100" };
  if (s.includes("create") || s.includes("added") || s.includes("new")) {
    return s.includes("task")
      ? { Icon: FiCheckSquare, cls: "bg-amber-50 text-amber-600 ring-amber-100" }
      : { Icon: FiPlus, cls: "bg-amber-50 text-amber-600 ring-amber-100" };
  }
  if (s.includes("service") || s.includes("workspace")) return { Icon: FiBriefcase, cls: "bg-violet-50 text-violet-600 ring-violet-100" };
  return { Icon: FiActivity, cls: "bg-slate-100 text-slate-500 ring-slate-200" };
};

// "task_status_updated to in_progress" -> "Task status updated to in progress"
const humanize = (text = "") => {
  const t = String(text).replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Activity";
};

const initials = (name = "") =>
  String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const dayLabel = (d) => {
  const now = new Date();
  if (isSameDay(d, now)) return "Today";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (isSameDay(d, y)) return "Yesterday";
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
};

const timeAgo = (value) => {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const exactTime = (value) => {
  const d = new Date(value);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const ROLE_STYLES = {
  superadmin: "bg-violet-50 text-violet-700 ring-violet-200",
  admin: "bg-blue-50 text-blue-700 ring-blue-200",
  manager: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

/* ══════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════ */
const PAGE_SIZE = 20;

const ActivityPanel = ({ token, userRole }) => {
  const [activities, setActivities] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState("all");
  const [centre, setCentre] = useState("all");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const containerRef = useRef(null);
  const loadingRef = useRef(false);

  const isSuperadmin = userRole === "superadmin";

  const fetchActivities = useCallback(
    async (pageNum = 1) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/activities?page=${pageNum}&limit=${PAGE_SIZE}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const rows = Array.isArray(data) ? data : [];
        setHasMore(rows.length >= PAGE_SIZE);
        setPage(pageNum);
        setActivities((prev) => {
          const merged = pageNum === 1 ? rows : [...prev, ...rows];
          const seen = new Set();
          return merged.filter((a) => (seen.has(a.id) ? false : seen.add(a.id)));
        });
      } catch (err) {
        console.error("Activity fetch error:", err);
        setError("Couldn't load activity. Try refreshing.");
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    fetchActivities(1);
  }, [fetchActivities]);

  // Live updates
  useEffect(() => {
    const handleActivityCreated = (activity) => {
      if (!activity || isPrivateChatActivity(activity)) return;
      setActivities((prev) => (prev.some((a) => a.id === activity.id) ? prev : [activity, ...prev]));
    };
    socket.on("activityCreated", handleActivityCreated);
    return () => socket.off("activityCreated", handleActivityCreated);
  }, []);

  // Everything visible: never chat messages
  const visible = useMemo(() => activities.filter((a) => !isPrivateChatActivity(a)), [activities]);

  const centreOptions = useMemo(
    () => (isSuperadmin ? [...new Set(visible.map((a) => a.centre_name).filter(Boolean))].sort() : []),
    [visible, isSuperadmin]
  );

  const categoryCounts = useMemo(() => {
    const counts = { all: visible.length };
    visible.forEach((a) => {
      const c = getCategory(a);
      counts[c] = (counts[c] || 0) + 1;
    });
    return counts;
  }, [visible]);

  const filtered = useMemo(
    () =>
      visible.filter(
        (a) =>
          (category === "all" || getCategory(a) === category) &&
          (centre === "all" || a.centre_name === centre)
      ),
    [visible, category, centre]
  );

  // Group by day
  const groups = useMemo(() => {
    const out = [];
    filtered.forEach((a) => {
      const d = new Date(a.created_at);
      const label = isNaN(d.getTime()) ? "Earlier" : dayLabel(d);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(a);
      else out.push({ label, items: [a] });
    });
    return out;
  }, [filtered]);

  // Infinite scroll
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    setShowScrollTop(el.scrollTop > 400);
    if (!loadingRef.current && hasMore && el.scrollTop + el.clientHeight >= el.scrollHeight - 160) {
      fetchActivities(page + 1);
    }
  };

  const refresh = () => {
    containerRef.current?.scrollTo({ top: 0 });
    fetchActivities(1);
  };

  return (
    <div className="relative flex flex-col h-full min-h-0 bg-slate-50">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Activity</h2>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live updates for tasks, services and documents
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isSuperadmin && centreOptions.length > 1 && (
              <div className="relative">
                <FiHome className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                <select
                  value={centre}
                  onChange={(e) => setCentre(e.target.value)}
                  className="h-9 appearance-none rounded-lg bg-slate-50 border border-slate-200 pl-8 pr-7 text-xs font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-50"
                >
                  <option value="all">All centres</option>
                  {centreOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
              </div>
            )}
            <button
              onClick={refresh}
              className="h-9 w-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
              title="Refresh"
            >
              <FiRefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 mt-3 overflow-x-auto -mx-1 px-1 pb-0.5" style={{ scrollbarWidth: "none" }}>
          {CATEGORY_TABS.map((t) => {
            const active = category === t.id;
            const count = categoryCounts[t.id] || 0;
            return (
              <button
                key={t.id}
                onClick={() => setCategory(t.id)}
                className={`shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition ${
                  active ? "bg-navy-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {t.label}
                {count > 0 && (
                  <span className={`text-[10px] font-semibold ${active ? "text-blue-100" : "text-slate-400"}`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Feed */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto"
        style={{ scrollbarWidth: "thin" }}
      >
        <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4">
          {error && (
            <div className="mb-4 rounded-xl bg-rose-50 ring-1 ring-rose-200 px-4 py-3 text-sm text-rose-700 flex items-center justify-between gap-3">
              {error}
              <button onClick={refresh} className="text-xs font-medium underline">
                Retry
              </button>
            </div>
          )}

          {groups.length === 0 && !loading && !error ? (
            <div className="flex flex-col items-center justify-center text-center py-20">
              <div className="h-12 w-12 rounded-full bg-white ring-1 ring-slate-200 flex items-center justify-center mb-3">
                <FiActivity className="text-slate-400" size={20} />
              </div>
              <p className="text-sm font-medium text-slate-700">No activity yet</p>
              <p className="text-xs text-slate-500 mt-1">
                {category === "all" ? "Task, service and document updates will show up here." : "Nothing in this category yet."}
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.label} className="mb-6 last:mb-2">
                <div className="sticky top-0 z-10 -mx-1 px-1 py-1.5 bg-slate-50/95 backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</p>
                </div>

                <ol className="mt-1 bg-white rounded-2xl ring-1 ring-slate-200 divide-y divide-slate-100 overflow-hidden">
                  <AnimatePresence initial={false}>
                    {group.items.map((a) => {
                      const { Icon, cls } = getVisual(a.action);
                      const role = String(a.performed_by_role || "").toLowerCase();
                      return (
                        <motion.li
                          key={a.id}
                          layout
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="flex gap-3 px-4 py-3.5 hover:bg-slate-50/70 transition-colors"
                        >
                          <div className={`mt-0.5 h-9 w-9 shrink-0 rounded-full ring-1 flex items-center justify-center ${cls}`}>
                            <Icon size={16} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-[14px] font-semibold text-slate-900 leading-snug">{humanize(a.action)}</p>
                              <span className="shrink-0 text-[11px] text-slate-400 mt-0.5" title={exactTime(a.created_at)}>
                                {timeAgo(a.created_at)}
                              </span>
                            </div>

                            {a.description && (
                              <p className="mt-0.5 text-[13px] text-slate-600 leading-relaxed break-words line-clamp-3">
                                {humanize(a.description)}
                              </p>
                            )}

                            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="h-5 w-5 rounded-full bg-slate-200 text-slate-600 text-[9px] font-semibold flex items-center justify-center">
                                  {a.performer_name ? initials(a.performer_name) : "S"}
                                </span>
                                <span className="font-medium text-slate-700">{a.performer_name || "System"}</span>
                              </span>
                              {role && role !== "staff" && (
                                <span className={`rounded px-1.5 py-px font-medium capitalize ring-1 ${ROLE_STYLES[role] || "bg-slate-50 text-slate-600 ring-slate-200"}`}>
                                  {role}
                                </span>
                              )}
                              {isSuperadmin && a.centre_name && (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <span className="inline-flex items-center gap-1">
                                    <FiHome size={10} /> {a.centre_name}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ol>
              </section>
            ))
          )}

          {loading && (
            <div className="flex justify-center py-6">
              <div className="h-6 w-6 rounded-full border-2 border-slate-200 border-t-blue-800 animate-spin" />
            </div>
          )}

          {!hasMore && filtered.length > 0 && !loading && (
            <p className="text-center text-[11px] text-slate-400 py-4 flex items-center justify-center gap-1.5">
              <FiLock size={10} /> Chat messages are private and never shown here
            </p>
          )}
        </div>
      </div>

      {/* Back to top */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
            className="absolute bottom-5 right-5 h-10 w-10 rounded-full bg-navy-700 text-white shadow-lg flex items-center justify-center hover:bg-navy-800 transition"
            title="Back to top"
          >
            <FiArrowUp size={18} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

// Shared navy tokens (kept from the original file, other screens rely on them)
const styles = `
  :root { --navy-700: #1e3a8a; --navy-800: #172554; }
  .bg-navy-700 { background-color: var(--navy-700); }
  .bg-navy-800 { background-color: var(--navy-800); }
  .text-navy-700 { color: var(--navy-700); }
  .border-navy-700 { border-color: var(--navy-700); }
  .hover\\:bg-navy-800:hover { background-color: var(--navy-800); }
  .hover\\:text-navy-700:hover { color: var(--navy-700); }
  .bg-navy-50 { background-color: #eef2ff; }
  .border-navy-200 { border-color: #c7d2fe; }
  .bg-navy-100 { background-color: #dbeafe; }
  .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
`;

if (typeof document !== "undefined" && !document.head.querySelector("style[data-activity-panel]")) {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  styleSheet.setAttribute("data-activity-panel", "true");
  document.head.appendChild(styleSheet);
}

export default ActivityPanel;