import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
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
  FiChevronRight,
  FiArrowUp,
  FiLock,
  FiSearch,
  FiX,
  FiSliders,
  FiUser,
  FiCalendar,
} from "react-icons/fi";
// Shared socket
import { socket } from "@/services/socket";

const API_BASE_URL = import.meta.env.VITE_API_URL;
const PAGE_SIZE = 20;

/* ══════════════════════════════════════════════════════════════
   Privacy: chat messages never appear in the activity feed.
   ══════════════════════════════════════════════════════════════ */
const isPrivateChatActivity = (a) => {
  const action = String(a?.action || "").toLowerCase();
  const type = String(a?.related_type || "").toLowerCase();
  return action.includes("message") || type === "message" || type === "chat_message" || type === "chat";
};

/* ══════════════════════════════════════════════════════════════
   Categories, visuals, text
   ══════════════════════════════════════════════════════════════ */
const CATEGORY_TABS = [
  { id: "all", label: "All" },
  { id: "task", label: "Tasks" },
  { id: "service", label: "Services" },
  { id: "document", label: "Documents" },
  { id: "team", label: "Team" },
];

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

const humanize = (text = "") => {
  const t = String(text).replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Activity";
};

const normalise = (s = "") => String(s).replace(/_/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

// "Task Completed" + "Task completed: Testing task" -> "Testing task"
const cleanDescription = (action, description) => {
  if (!description) return "";
  const d = String(description);
  const idx = d.indexOf(":");
  if (idx > 0 && normalise(d.slice(0, idx)) === normalise(action)) {
    return humanize(d.slice(idx + 1));
  }
  return humanize(d);
};

const initials = (name = "") =>
  String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

/* ══════════════════════════════════════════════════════════════
   Dates
   ══════════════════════════════════════════════════════════════ */
const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

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

const DATE_RANGES = [
  { id: "all", label: "Any time" },
  { id: "today", label: "Today" },
  { id: "week", label: "Last 7 days" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom" },
];

// Local-day bounds sent to the server (`to` is exclusive)
const getDateBounds = (range, from, to) => {
  const now = new Date();
  const today = startOfDay(now);
  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  if (range === "today") return { from: today.toISOString(), to: addDays(today, 1).toISOString() };
  if (range === "week") return { from: addDays(today, -6).toISOString(), to: null };
  if (range === "month") return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: null };
  if (range === "custom") {
    return {
      from: from ? startOfDay(from).toISOString() : null,
      to: to ? addDays(startOfDay(to), 1).toISOString() : null,
    };
  }
  return { from: null, to: null };
};

const EMPTY_SUMMARY = {
  total: 0,
  byCategory: { all: 0 },
  tasksDone: 0,
  tasksCreated: 0,
  services: 0,
  documents: 0,
  mostActive: [],
  performers: [],
  centres: [],
};

const ROLE_STYLES = {
  superadmin: "bg-violet-50 text-violet-700 ring-violet-200",
  admin: "bg-blue-50 text-blue-700 ring-blue-200",
  manager: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

/* ══════════════════════════════════════════════════════════════
   Where an entry leads when clicked
   ══════════════════════════════════════════════════════════════ */
const getTarget = (a) => {
  const type = String(a?.related_type || "").toLowerCase();
  if (!a?.related_id) return null;
  if (type === "service_entry") return { kind: "service", id: a.related_id };
  if (type === "service_tracking" || type === "tracking") return { kind: "tracking", id: a.related_id };
  if (type === "task") return { kind: "task", id: a.related_id };
  return null;
};

/* ══════════════════════════════════════════════════════════════
   Small UI pieces
   ══════════════════════════════════════════════════════════════ */
const SelectField = ({ icon: Icon, value, onChange, children, className = "" }) => (
  <div className={`relative ${className}`}>
    {Icon && <Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full h-9 appearance-none rounded-lg bg-white border border-slate-200 ${Icon ? "pl-8" : "pl-3"} pr-7 text-xs font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-slate-300`}
    >
      {children}
    </select>
    <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
  </div>
);

const Filters = ({
  staffOptions,
  staff,
  setStaff,
  range,
  setRange,
  from,
  setFrom,
  to,
  setTo,
  centreOptions,
  centre,
  setCentre,
  showCentre,
  hasActive,
  onClear,
}) => (
  <div className="space-y-2">
    <SelectField icon={FiUser} value={staff} onChange={setStaff}>
      <option value="all">Everyone</option>
      {staffOptions.map((s) => (
        <option key={s.id} value={String(s.id)}>
          {s.name}
        </option>
      ))}
    </SelectField>

    <SelectField icon={FiCalendar} value={range} onChange={setRange}>
      {DATE_RANGES.map((r) => (
        <option key={r.id} value={r.id}>
          {r.label}
        </option>
      ))}
    </SelectField>

    {range === "custom" && (
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-[10px] font-medium text-slate-400 mb-0.5">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full h-9 rounded-lg bg-white border border-slate-200 px-2 text-xs text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-50"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] font-medium text-slate-400 mb-0.5">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full h-9 rounded-lg bg-white border border-slate-200 px-2 text-xs text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-50"
          />
        </label>
      </div>
    )}

    {showCentre && centreOptions.length > 1 && (
      <SelectField icon={FiHome} value={centre} onChange={setCentre}>
        <option value="all">All centres</option>
        {centreOptions.map((c) => (
          <option key={c.id} value={String(c.id)}>
            {c.name}
          </option>
        ))}
      </SelectField>
    )}

    {hasActive && (
      <button onClick={onClear} className="text-xs font-medium text-navy-700 hover:underline">
        Clear filters
      </button>
    )}
  </div>
);

/* ══════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════ */
const ActivityPanel = ({ token, userRole, onOpenTasks }) => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [staff, setStaff] = useState("all");
  const [range, setRange] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [centre, setCentre] = useState("all");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [openingId, setOpeningId] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const containerRef = useRef(null);
  const loadingRef = useRef(false);
  const requestIdRef = useRef(0);
  const summaryTimerRef = useRef(null);
  const isSuperadmin = userRole === "superadmin";

  // Wait for typing to pause before searching
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const dateBounds = useMemo(() => getDateBounds(range, from, to), [range, from, to]);

  // Filters shared by the feed and the summary
  const filterQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedSearch) p.set("search", debouncedSearch);
    if (staff !== "all") p.set("staff", staff);
    if (dateBounds.from) p.set("from", dateBounds.from);
    if (dateBounds.to) p.set("to", dateBounds.to);
    if (isSuperadmin && centre !== "all") p.set("centre", centre);
    return p.toString();
  }, [debouncedSearch, staff, dateBounds, centre, isSuperadmin]);

  const fetchActivities = useCallback(
    async (pageNum = 1) => {
      if (pageNum > 1 && loadingRef.current) return;
      const requestId = ++requestIdRef.current;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const p = new URLSearchParams(filterQuery);
        p.set("page", String(pageNum));
        p.set("limit", String(PAGE_SIZE));
        if (category !== "all") p.set("category", category);
        const res = await fetch(`${API_BASE_URL}/api/activities?${p.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (requestId !== requestIdRef.current) return; // a newer request replaced this one
        const rows = Array.isArray(data) ? data : [];
        setHasMore(rows.length >= PAGE_SIZE);
        setPage(pageNum);
        setActivities((prev) => {
          const merged = pageNum === 1 ? rows : [...prev, ...rows];
          const seen = new Set();
          return merged.filter((a) => (seen.has(a.id) ? false : seen.add(a.id)));
        });
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        console.error("Activity fetch error:", err);
        setError("Couldn't load activity. Try refreshing.");
      } finally {
        if (requestId === requestIdRef.current) {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    },
    [token, filterQuery, category]
  );

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/activities/summary?${filterQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSummary({ ...EMPTY_SUMMARY, ...data });
    } catch (err) {
      console.error("Activity summary error:", err);
    }
  }, [token, filterQuery]);

  // Reload the feed whenever filters or the tab change
  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0 });
    fetchActivities(1);
  }, [fetchActivities]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const noFiltersActive = !filterQuery && category === "all";

  // Live updates: add new entries when no filter is applied; always refresh the counts
  useEffect(() => {
    const handleActivityCreated = (activity) => {
      if (!activity || isPrivateChatActivity(activity)) return;
      if (noFiltersActive) {
        setActivities((prev) => (prev.some((a) => a.id === activity.id) ? prev : [activity, ...prev]));
      }
      clearTimeout(summaryTimerRef.current);
      summaryTimerRef.current = setTimeout(fetchSummary, 1500);
    };
    socket.on("activityCreated", handleActivityCreated);
    return () => {
      socket.off("activityCreated", handleActivityCreated);
      clearTimeout(summaryTimerRef.current);
    };
  }, [noFiltersActive, fetchSummary]);

  /* ------------------------ derived data ------------------------ */
  const visible = useMemo(() => activities.filter((a) => !isPrivateChatActivity(a)), [activities]);

  const groups = useMemo(() => {
    const out = [];
    visible.forEach((a) => {
      const d = new Date(a.created_at);
      const label = isNaN(d.getTime()) ? "Earlier" : dayLabel(d);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(a);
      else out.push({ label, items: [a] });
    });
    return out;
  }, [visible]);

  const filtered = visible;
  const categoryCounts = summary.byCategory || {};
  const staffOptions = summary.performers || [];
  const centreOptions = summary.centres || [];
  const mostActive = summary.mostActive || [];

  const rangeLabel = DATE_RANGES.find((r) => r.id === range)?.label || "Any time";
  const hasActiveFilters = staff !== "all" || range !== "all" || centre !== "all" || !!search;
  const clearFilters = () => {
    setStaff("all");
    setRange("all");
    setFrom("");
    setTo("");
    setCentre("all");
    setSearch("");
  };

  /* ------------------------ actions ------------------------ */
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
    fetchSummary();
  };

  const openActivity = async (a) => {
    const target = getTarget(a);
    if (!target) return;

    if (target.kind === "task") {
      if (onOpenTasks) onOpenTasks(target.id);
      return;
    }
    if (target.kind === "tracking") {
      navigate(`/dashboard/staff/track_service/${target.id}`);
      return;
    }
    // service_entry id -> look up its tracking id first
    setOpeningId(a.id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/servicecollaboration/${target.id}/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (!data.tracking_id) throw new Error("This service has no tracking record");
      navigate(`/dashboard/staff/track_service/${data.tracking_id}`);
    } catch (err) {
      toast.error(err.message || "Couldn't open this service");
    } finally {
      setOpeningId(null);
    }
  };

  const filterProps = {
    staffOptions,
    staff,
    setStaff,
    range,
    setRange,
    from,
    setFrom,
    to,
    setTo,
    centreOptions,
    centre,
    setCentre,
    showCentre: isSuperadmin,
    hasActive: hasActiveFilters,
    onClear: clearFilters,
  };

  /* ------------------------ render ------------------------ */
  return (
    <div className="relative flex flex-col h-full min-h-0 bg-slate-50">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 mr-auto">
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Activity</h2>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="truncate">Live updates for tasks, services and documents</span>
            </p>
          </div>

          <div className="relative hidden sm:block w-56 lg:w-72">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activity"
              className="w-full h-9 pl-9 pr-8 rounded-lg bg-slate-100 text-sm text-slate-800 placeholder:text-slate-400 border border-transparent focus:bg-white focus:border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-50 transition"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600" title="Clear">
                <FiX size={13} />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowMobileFilters((v) => !v)}
            className={`lg:hidden h-9 w-9 rounded-full flex items-center justify-center transition ${
              showMobileFilters || hasActiveFilters ? "bg-blue-50 text-navy-700" : "text-slate-500 hover:bg-slate-100"
            }`}
            title="Filters"
          >
            <FiSliders size={16} />
          </button>
          <button
            onClick={refresh}
            className="h-9 w-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
            title="Refresh"
          >
            <FiRefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Search on phones */}
        <div className="relative sm:hidden mt-3">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activity"
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-100 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-50"
          />
        </div>

        {/* Tabs */}
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
                {count > 0 && <span className={`text-[10px] font-semibold ${active ? "text-blue-100" : "text-slate-400"}`}>{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Filters on smaller screens */}
        <AnimatePresence initial={false}>
          {showMobileFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden overflow-hidden"
            >
              <div className="pt-3 grid sm:grid-cols-2 gap-2">
                <Filters {...filterProps} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Body: feed + summary */}
      <div className="flex-1 min-h-0 flex">
        {/* Feed */}
        <div ref={containerRef} onScroll={handleScroll} className="flex-1 min-w-0 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          <div className="px-3 sm:px-6 py-4">
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
                <p className="text-sm font-medium text-slate-700">
                  {hasActiveFilters || category !== "all" ? "No activity matches these filters" : "No activity yet"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {hasActiveFilters ? (
                    <button onClick={clearFilters} className="font-medium text-navy-700 hover:underline">
                      Clear filters
                    </button>
                  ) : (
                    "Task, service and document updates will show up here."
                  )}
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
                        const target = getTarget(a);
                        const clickable = !!target && (target.kind !== "task" || !!onOpenTasks);
                        const description = cleanDescription(a.action, a.description);
                        const Row = clickable ? "button" : "div";

                        return (
                          <motion.li
                            key={a.id}
                            layout
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <Row
                              {...(clickable ? { type: "button", onClick: () => openActivity(a) } : {})}
                              className={`group w-full text-left flex gap-3 px-4 py-3.5 transition-colors ${
                                clickable ? "hover:bg-slate-50 cursor-pointer" : ""
                              }`}
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

                                {description && (
                                  <p className="mt-0.5 text-[13px] text-slate-600 leading-relaxed break-words line-clamp-3">{description}</p>
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
                                  {clickable && (
                                    <span className="ml-auto inline-flex items-center gap-0.5 font-medium text-navy-700 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {openingId === a.id ? "Opening…" : target.kind === "task" ? "Open tasks" : "Open service"}
                                      <FiChevronRight size={12} />
                                    </span>
                                  )}
                                </div>
                              </div>
                            </Row>
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

            {!loading && filtered.length > 0 && (
              <p className="text-center text-[11px] text-slate-400 py-4 flex items-center justify-center gap-1.5">
                {hasMore ? (
                  "Scroll for older activity"
                ) : (
                  <>
                    <FiLock size={10} /> Chat messages are private and never shown here
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Summary column (laptops and up) */}
        <aside className="hidden lg:flex w-72 2xl:w-80 shrink-0 flex-col border-l border-slate-200 bg-white overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          <div className="p-5 space-y-6">
            {/* Summary */}
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-[13px] font-semibold text-slate-800">Summary</h3>
                <span className="text-[11px] text-slate-400">{range === "custom" ? "Custom range" : rangeLabel}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Tasks done", value: summary.tasksDone, Icon: FiCheckCircle, cls: "text-emerald-600 bg-emerald-50", cat: "task" },
                  { label: "Tasks created", value: summary.tasksCreated, Icon: FiCheckSquare, cls: "text-amber-600 bg-amber-50", cat: "task" },
                  { label: "Service updates", value: summary.services, Icon: FiBriefcase, cls: "text-violet-600 bg-violet-50", cat: "service" },
                  { label: "Documents", value: summary.documents, Icon: FiFileText, cls: "text-sky-600 bg-sky-50", cat: "document" },
                ].map(({ label, value, Icon: StatIcon, cls, cat }) => (
                  <button
                    key={label}
                    onClick={() => setCategory(cat)}
                    className="text-left rounded-xl ring-1 ring-slate-200 p-3 hover:ring-slate-300 hover:bg-slate-50 transition"
                  >
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${cls}`}>
                      <StatIcon size={14} />
                    </span>
                    <p className="mt-2 text-xl font-semibold text-slate-900 tabular-nums leading-none">{value}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{label}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* Most active */}
            <section>
              <h3 className="text-[13px] font-semibold text-slate-800 mb-2">Most active</h3>
              {mostActive.length === 0 ? (
                <p className="text-xs text-slate-400">No one yet in this period.</p>
              ) : (
                <ul className="space-y-0.5">
                  {mostActive.map((p) => {
                    const active = staff === String(p.id);
                    const max = mostActive[0].count || 1;
                    return (
                      <li key={p.id}>
                        <button
                          onClick={() => setStaff(active ? "all" : String(p.id))}
                          className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition ${active ? "bg-blue-50" : "hover:bg-slate-50"}`}
                        >
                          <span className="h-7 w-7 shrink-0 rounded-full bg-slate-200 text-slate-600 text-[10px] font-semibold flex items-center justify-center">
                            {initials(p.name)}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className={`block text-[13px] truncate ${active ? "font-semibold text-navy-700" : "font-medium text-slate-700"}`}>{p.name}</span>
                            <span className="mt-1 block h-1 rounded-full bg-slate-100 overflow-hidden">
                              <span className="block h-full rounded-full bg-blue-800/60" style={{ width: `${(p.count / max) * 100}%` }} />
                            </span>
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500 tabular-nums">{p.count}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Filters */}
            <section>
              <h3 className="text-[13px] font-semibold text-slate-800 mb-2">Filters</h3>
              <Filters {...filterProps} />
            </section>

            <p className="text-[11px] text-slate-400 leading-relaxed flex items-start gap-1.5">
              <FiLock size={11} className="mt-0.5 shrink-0" />
              Chat messages are private and never shown in activity.
            </p>
          </div>
        </aside>
      </div>

      {/* Back to top */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
            className="absolute bottom-5 right-5 lg:right-[19.5rem] 2xl:right-[21.5rem] h-10 w-10 rounded-full bg-navy-700 text-white shadow-lg flex items-center justify-center hover:bg-navy-800 transition"
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