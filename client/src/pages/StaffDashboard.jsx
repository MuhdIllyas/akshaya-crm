// src/pages/staff/StaffDashboard.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  FiUsers, FiClock, FiCheckCircle, FiPlayCircle, FiPlus, FiSearch,
  FiAlertCircle, FiRefreshCw, FiCalendar, FiBarChart2, FiTrendingUp,
  FiUser, FiAward, FiXCircle, FiCheckSquare, FiTarget, FiDollarSign, FiGlobe,
  FiBriefcase, FiActivity, FiStar, FiInfo, FiChevronRight, FiExternalLink,
  FiLogIn, FiLogOut, FiChevronDown, FiX,
} from "react-icons/fi";
import { getCategories, getTokens } from "/src/services/serviceService";
import { getWalletsForCentre } from "@/services/walletService";
import { postAttendance } from "/src/services/salaryService";
import QuickServiceModal from "@/components/QuickServiceModal";
import api from "@/services/serviceService";
import { socket } from "@/services/socket";

/* ---------- Helpers ---------- */
const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return "₹0";
  return `₹${Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

const formatDate = (date) => {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-navy-500/40 disabled:bg-slate-50 disabled:text-slate-400";

const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50";

const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-navy-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

const DATE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This week" },
  { id: "all", label: "All time" },
];

/* ---------- Shared UI Primitives ---------- */
const StatusChip = ({ status }) => {
  const normalized = String(status || "").toLowerCase();
  let cfg = { name: status ? String(status).replace(/[-_]/g, " ") : "Unknown", chip: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" };

  if (normalized === "completed" || normalized === "paid") {
    cfg = { name: normalized === "paid" ? "Paid" : "Completed", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" };
  } else if (normalized === "in-progress" || normalized === "in_progress" || normalized === "processing") {
    cfg = { name: normalized === "processing" ? "Processing" : "In progress", chip: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" };
  } else if (normalized === "pending") {
    cfg = { name: "Pending", chip: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" };
  } else if (normalized === "rejected" || normalized === "delayed" || normalized === "cancelled") {
    cfg = { name: normalized, chip: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" };
  } else if (normalized === "resubmit") {
    cfg = { name: "Resubmit", chip: "bg-orange-50 text-orange-700 ring-orange-200", dot: "bg-orange-500" };
  }

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${cfg.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.name}
    </span>
  );
};

const Card = ({ title, icon: Icon, action, children, className = "", onMouseEnter, onMouseLeave, role, ariaLabel }) => (
  <div
    role={role}
    aria-label={ariaLabel}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}
  >
    {(title || action) && (
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {Icon && <Icon className="h-4 w-4 text-navy-700" />} {title}
        </h3>
        {action}
      </div>
    )}
    {children}
  </div>
);

const StaffDashboard = () => {
  const navigate = useNavigate();
  const [tokens, setTokens] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recentServiceEntries, setRecentServiceEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDate, setActiveDate] = useState("today");
  const [activeView, setActiveView] = useState("active");
  const [workspaceTab, setWorkspaceTab] = useState("tokens");
  const staffId = localStorage.getItem("id")?.trim();
  const centreId = localStorage.getItem("centre_id")?.trim();
  const [showQuickService, setShowQuickService] = useState(false);
  const [wallets, setWallets] = useState([]);
  const [onlineBookings, setOnlineBookings] = useState([]);
  const [processingBookings, setProcessingBookings] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Period state (same as StaffPerformance)
  const [period, setPeriod] = useState("month");
  const [customDateRange, setCustomDateRange] = useState({ from: "", to: "" });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [performanceLoading, setPerformanceLoading] = useState(false);

  // Performance metrics from backend
  const [performance, setPerformance] = useState({
    completionRate: 0,
    avgTransactionValue: 0,
    customerSatisfaction: "N/A",
    totalServices: 0,
    totalCollected: 0,
    collectionRate: 0,
    incentiveScore: 0,
    avgRating: 0,
    totalReviews: 0,
    monthlyTarget: 0,
    currentAchieved: 0,
    dailyTarget: 0,
    todayAchieved: 0,
    targetProgress: 0,
    targetHistory: [],
  });

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTokenData, setCancelTokenData] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // --- Tasks & Events State ---
  const [myTasks, setMyTasks] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  // Dynamic Auto-Cycling States
  const [activeEventTab, setActiveEventTab] = useState("All");
  const [isEventsHovered, setIsEventsHovered] = useState(false);

  const getEventDayLabel = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return date.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" });
  };

  // Application Tracking State
  const [trackingStats, setTrackingStats] = useState({ total: 0, pending: 0, in_progress: 0, completed: 0, delayed: 0 });
  const [trackingEntries, setTrackingEntries] = useState([]);
  const [statView, setStatView] = useState("applications");
  const [activeAppView, setActiveAppView] = useState("active");

  // --- Welcome banner state ---
  const [currentTime, setCurrentTime] = useState(new Date());
  const staffName = localStorage.getItem("username") || "Staff";
  const staffInitials =
    staffName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "ST";

  // --- Birthdays ---
  const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [birthdays, setBirthdays] = useState([]);
  const [hideMyBirthday, setHideMyBirthday] = useState(() => {
    try {
      return localStorage.getItem(`bday-hidden-${todayKey}`) === "1";
    } catch {
      return false;
    }
  });

  const toPhotoUrl = (p) => {
    if (!p || p === "null" || p === "undefined") return null;
    return p.startsWith("http") || p.startsWith("data:image") ? p : `${import.meta.env.VITE_API_URL}${p}`;
  };

  // Photo Formatting
  const [imageError, setImageError] = useState(false);
  const rawPhoto = localStorage.getItem("photo");

  let staffPhotoUrl = null;
  if (rawPhoto && rawPhoto !== "null" && rawPhoto !== "undefined") {
    staffPhotoUrl =
      rawPhoto.startsWith("http") || rawPhoto.startsWith("data:image")
        ? rawPhoto
        : `${import.meta.env.VITE_API_URL}${rawPhoto}`;
  }

  const fetchTrackingData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, entriesRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/api/servicetracking/stats?staff=${staffId}`, { headers }),
        fetch(`${import.meta.env.VITE_API_URL}/api/servicetracking/entries?staff=${staffId}&limit=100`, { headers }),
      ]);

      if (!statsRes.ok) throw new Error("Failed to fetch tracking stats");
      if (!entriesRes.ok) throw new Error("Failed to fetch tracking entries");

      const statsData = await statsRes.json();
      const entriesData = await entriesRes.json();

      setTrackingStats(statsData || { total: 0, pending: 0, in_progress: 0, completed: 0, delayed: 0 });
      const entries = entriesData.data || [];
      setTrackingEntries(entries);
    } catch (err) {
      console.error("Error fetching tracking data:", err);
    }
  }, [staffId]);

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const formatCurrentTime = (date) =>
    date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const formatCurrentDate = (date) =>
    date.toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // --- Socket global listeners ---
  useEffect(() => {
    const onConnectError = (err) => {
      if (err.message === "Socket authentication failed") {
        toast.error("Session expired. Please login again.");
      }
    };

    socket.on("connect_error", onConnectError);
    return () => {
      socket.off("connect_error", onConnectError);
    };
  }, []);

  // --- Refresh tokens ---
  const refreshTokens = useCallback(async () => {
    try {
      const tokensRes = await getTokens(centreId, "all");
      setTokens(tokensRes.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Error refreshing tokens:", err);
    }
  }, [centreId]);

  // --- Fetch Entire Workspace (Hybrid BFF) ---
  const fetchWorkspaceInit = useCallback(async () => {
    try {
      setPerformanceLoading(true);
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();

      if (period === "custom" && customDateRange.from && customDateRange.to) {
        params.append("from", customDateRange.from);
        params.append("to", customDateRange.to);
        params.append("period", "custom");
      } else {
        params.append("period", period);
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/staffperformance/workspace-init?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error("Failed to fetch workspace data");

      const result = await response.json();
      const {
        performance: perfData,
        tasks,
        events,
        recentActivity,
        onlinePending,
        onlineProcessing,
        todayAttendance: att,
      } = result.data;

      setTodayAttendance(att);

      setPerformance({
        completionRate: perfData.summary.collection_rate || 0,
        avgTransactionValue: perfData.summary.avg_transaction_value || 0,
        customerSatisfaction: perfData.ratings?.avg_rating ? `${perfData.ratings.avg_rating}/5` : "N/A",
        totalServices: perfData.summary.total_services || 0,
        totalCollected: perfData.summary.total_collected || 0,
        collectionRate: perfData.summary.collection_rate || 0,
        incentiveScore: perfData.summary.incentive_score || 0,
        avgRating: perfData.ratings?.avg_rating || 0,
        totalReviews: perfData.ratings?.total_reviews || 0,
        monthlyTarget: perfData.target?.monthly_target || 0,
        currentAchieved: perfData.target?.current_achieved || 0,
        dailyTarget: perfData.target?.daily_target || 0,
        todayAchieved: perfData.target?.today_achieved || 0,
        targetProgress: perfData.target?.progress_percentage || 0,
        targetHistory: perfData.target?.history || [],
      });

      setMyTasks(tasks || []);

      const validEvents = (events || [])
        .filter((e) => {
          if (!e.assigned_to) return true;
          return String(e.assigned_to) === String(staffId);
        })
        .sort((a, b) => new Date(b.date || b.start_datetime) - new Date(a.date || a.start_datetime));
      setUpcomingEvents(validEvents);

      setRecentServiceEntries(recentActivity || []);
      setOnlineBookings(onlinePending || []);
      setProcessingBookings(onlineProcessing || []);
    } catch (err) {
      console.error("Error fetching workspace:", err);
      toast.error("Failed to load workspace data");
    } finally {
      setPerformanceLoading(false);
    }
  }, [period, customDateRange, staffId]);

  // --- Auto-cycle Events Tabs ---
  useEffect(() => {
    if (isEventsHovered || upcomingEvents.length === 0) return;
    const tabs = ["All", "Tasks", "Deliveries", "Expiries", "Days"];

    const interval = setInterval(() => {
      setActiveEventTab((prev) => {
        const currentIndex = tabs.indexOf(prev);
        return tabs[(currentIndex + 1) % tabs.length];
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [isEventsHovered, upcomingEvents.length]);

  const handleCompleteTask = async (taskId) => {
    try {
      const tasksUrl = (api.defaults.baseURL || "").replace("servicemanagement", "tasks");
      await api.patch(`/${taskId}/status`, { status: "completed" }, { baseURL: tasksUrl });
      toast.success("Task completed!");
      fetchWorkspaceInit();
    } catch {
      toast.error("Failed to complete task");
    }
  };

  const handleViewService = (event) => {
    const eventIdStr = String(event.id || "");
    let targetTrackingId;

    if (eventIdStr.startsWith("expiry-")) {
      targetTrackingId = event.tracking_id;
    } else if (eventIdStr.startsWith("delivery-")) {
      targetTrackingId = eventIdStr.replace("delivery-", "");
    } else if (event.tracking_id) {
      targetTrackingId = event.tracking_id;
    }

    if (targetTrackingId) {
      navigate(`/dashboard/staff/track_service/${targetTrackingId}`);
    } else {
      toast.error("Cannot open: No tracking steps exist for this service yet.");
    }
  };

  // Load wallets
  useEffect(() => {
    getWalletsForCentre()
      .then(setWallets)
      .catch(() => toast.error("Failed to load wallets"));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${import.meta.env.VITE_API_URL}/api/staff/birthdays/today`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setBirthdays(Array.isArray(data) ? data : []))
      .catch(() => setBirthdays([]));
  }, []);

  const myBirthday = birthdays.find((b) => b.isMe);
  const colleagueBirthdays = birthdays.filter((b) => !b.isMe);

  const dismissMyBirthday = () => {
    setHideMyBirthday(true);
    try {
      localStorage.setItem(`bday-hidden-${todayKey}`, "1");
    } catch {}
  };

  const MESSENGER_ROUTE = "/dashboard/staff/messenger";
  const [openingChatFor, setOpeningChatFor] = useState(null);

  const handleSendWishes = async (person) => {
    if (openingChatFor) return;
    setOpeningChatFor(person.id);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          participants: [person.id],
          is_group: false,
          conversationType: "internal",
          channel: "internal",
        }),
      });
      if (!res.ok) throw new Error("Failed to open chat");
      const conv = await res.json();

      const firstName = (person.name || "").split(" ")[0];
      navigate(MESSENGER_ROUTE, {
        state: {
          openConversationId: conv.id,
          draftMessage: `Happy Birthday, ${firstName}! 🎉 Wishing you a wonderful year ahead.`,
        },
      });
    } catch (err) {
      console.error(err);
      toast.error("Could not open chat. Please try again.");
    } finally {
      setOpeningChatFor(null);
    }
  };

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (!staffId || !centreId) throw new Error("Missing staff or centre ID");

        await Promise.all([
          getCategories().then((res) => setCategories(res.data || [])),
          refreshTokens(),
          fetchWorkspaceInit(),
          fetchTrackingData(),
        ]);
      } catch (err) {
        setError("Failed to load dashboard data: " + (err.response?.data?.error || err.message));
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [staffId, centreId, refreshTokens, fetchWorkspaceInit, fetchTrackingData]);

  const isMounted = useRef(false);

  useEffect(() => {
    if (isMounted.current && !loading) {
      fetchWorkspaceInit();
    } else if (!loading) {
      isMounted.current = true;
    }
  }, [period, customDateRange, fetchWorkspaceInit, loading]);

  // --- Socket events ---
  useEffect(() => {
    const onTokenUpdate = (data) => {
      setTokens((prev) => prev.map((t) => (t.tokenId === data.tokenId ? { ...t, status: data.status } : t)));
      refreshTokens();
    };
    const onCentreTokenUpdate = (data) => {
      setTokens((prev) => prev.map((t) => (t.tokenId === data.tokenId ? { ...t, status: data.status } : t)));
      refreshTokens();
    };
    const onNewToken = (data) => {
      toast.info(data.message || "New token created");
      refreshTokens();
    };
    const onTokenReassigned = (data) => {
      toast.info(data.message || "Token reassigned");
      refreshTokens();
    };
    const onServiceEntryCreated = async (data) => {
      const entryStaffId = String(data.staff_id || "").trim();
      if (!entryStaffId || entryStaffId === String(staffId).trim()) {
        await refreshTokens();
        await fetchWorkspaceInit();
      }
    };

    socket.on("tokenUpdate", onTokenUpdate);
    socket.on(`tokenUpdate:${centreId}`, onCentreTokenUpdate);
    socket.on("newToken", onNewToken);
    socket.on("tokenReassigned", onTokenReassigned);
    socket.on("serviceEntryCreated", onServiceEntryCreated);

    return () => {
      socket.off("tokenUpdate", onTokenUpdate);
      socket.off(`tokenUpdate:${centreId}`, onCentreTokenUpdate);
      socket.off("newToken", onNewToken);
      socket.off("tokenReassigned", onTokenReassigned);
      socket.off("serviceEntryCreated", onServiceEntryCreated);
    };
  }, [centreId, staffId, refreshTokens, fetchWorkspaceInit]);

  // --- Helper functions ---
  const getCategoryName = (id) => categories.find((c) => c.id === id)?.name || "N/A";
  const getSubcategoryName = (catId, subId) => {
    const cat = categories.find((c) => c.id === catId);
    return cat?.subcategories?.find((s) => s.id === subId)?.name || "N/A";
  };
  const shortenTokenId = (tokenId) => (tokenId ? `#${tokenId.split("-").pop()}` : "N/A");

  const handleStartService = async (tokenId, tokenStaffId, tokenStatus) => {
    try {
      if (!tokenStaffId || tokenStaffId === "null" || tokenStaffId === "") {
        await api.put(`/token/${tokenId}/assign`, { staffId });
      }
      if (tokenStatus === "pending") {
        await api.put(`/token/${tokenId}/status`, { status: "in-progress" });
      }
      navigate(`/dashboard/staff/token/${tokenId}/service`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to start service. Someone else might have already taken it.");
      refreshTokens();
    }
  };

  const openCancelModal = (token) => {
    setCancelTokenData({ tokenId: token.tokenId, customerName: token.customerName || "Customer" });
    setCancelReason("");
    setShowCancelModal(true);
  };

  const handleCancelConfirm = async () => {
    if (!cancelTokenData) return;
    setCancelling(true);
    try {
      await api.put(`/tokens/${cancelTokenData.tokenId}/cancel`, {
        reason: cancelReason.trim() || null,
      });
      toast.success(`Token ${cancelTokenData.tokenId} cancelled successfully`);
      setShowCancelModal(false);
      setCancelTokenData(null);
      setCancelReason("");
      refreshTokens();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to cancel token");
    } finally {
      setCancelling(false);
    }
  };

  const handleViewDetails = (tokenId, trackingId) => {
    if (trackingId) {
      navigate(`/dashboard/staff/track_service/${trackingId}`);
    } else if (tokenId) {
      navigate(`/dashboard/staff/token/${tokenId}/details`);
    } else {
      toast.info("No tracking details available for this quick service.");
    }
  };

  const formatTime = (dateString) =>
    new Date(dateString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const formatDateUI = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  // Token filtering optimized with useMemo
  const { activeTokens, completedTokens, campaignTokens, statusCounts } = useMemo(() => {
    const localStaff = String(staffId).trim();

    const active = tokens.filter((t) => {
      const tokenStaff = String(t.staffId || "").trim();
      const isAssignedToMe = tokenStaff === localStaff;
      const isUnassigned = !tokenStaff || tokenStaff === "null" || tokenStaff === "";
      return (isAssignedToMe || isUnassigned) && t.status !== "completed" && t.status !== "cancelled";
    });

    const completed = tokens.filter((t) => {
      const tokenStaff = String(t.staffId || "").trim();
      return tokenStaff === localStaff && t.status === "completed" && t.type !== "campaign";
    });

    const campaign = tokens.filter((t) => {
      const tokenStaff = String(t.staffId || "").trim();
      const isAssignedToMe = tokenStaff === localStaff;
      const isUnassigned = !tokenStaff || tokenStaff === "null" || tokenStaff === "";
      return (isAssignedToMe || isUnassigned) && t.type === "campaign" && t.status !== "cancelled";
    });

    return {
      activeTokens: active,
      completedTokens: completed,
      campaignTokens: campaign,
      statusCounts: {
        pending: active.filter((t) => t.status === "pending").length,
        inProgress: active.filter((t) => t.status === "in-progress" || t.status === "processing").length,
        completed: completed.length,
        campaign: campaign.length,
        total: active.length + completed.length,
      },
    };
  }, [tokens, staffId]);

  const filteredTokens = useMemo(() => {
    const source =
      activeView === "active" ? activeTokens : activeView === "completed" ? completedTokens : campaignTokens;

    const searchLower = searchQuery.toLowerCase().trim();

    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);

    const yesterdayObj = new Date(todayObj);
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);

    const weekAgoObj = new Date(todayObj);
    weekAgoObj.setDate(weekAgoObj.getDate() - 7);

    const todayStr = todayObj.toDateString();
    const yesterdayStr = yesterdayObj.toDateString();

    return source.filter((token) => {
      const matchesSearch =
        !searchLower ||
        String(token.customerName || "").toLowerCase().includes(searchLower) ||
        String(token.tokenId || "").toLowerCase().includes(searchLower) ||
        String(token.phone || "").toLowerCase().includes(searchLower);

      const tokenDateObj = new Date(token.createdAt);
      tokenDateObj.setHours(0, 0, 0, 0);
      const tokenDateStr = tokenDateObj.toDateString();

      const matchesDate =
        activeDate === "today"
          ? tokenDateStr === todayStr
          : activeDate === "yesterday"
            ? tokenDateStr === yesterdayStr
            : activeDate === "week"
              ? tokenDateObj >= weekAgoObj
              : true;

      return matchesSearch && matchesDate;
    });
  }, [activeTokens, completedTokens, campaignTokens, activeView, searchQuery, activeDate]);

  const groupedTokens = useMemo(() => {
    const grouped = {};
    filteredTokens.forEach((token) => {
      const date = new Date(token.createdAt).toDateString();
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(token);
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => new Date(b) - new Date(a))
      .reduce(
        (acc, [date, arr]) => ({
          ...acc,
          [date]: arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        }),
        {}
      );
  }, [filteredTokens]);

  const groupedRecentActivities = useMemo(() => {
    return recentServiceEntries.reduce((acc, entry) => {
      const date = new Date(entry.created_at).toDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(entry);
      return acc;
    }, {});
  }, [recentServiceEntries]);

  const filteredApplications = useMemo(() => {
    let source = trackingEntries;

    if (activeAppView === "active") {
      source = source.filter((app) => ["pending", "in_progress", "resubmit"].includes(app.status));
    } else if (activeAppView === "completed") {
      source = source.filter((app) => ["completed", "paid"].includes(app.status));
    } else if (activeAppView === "delayed") {
      source = source.filter((app) => ["rejected", "delayed"].includes(app.status));
    }

    const searchLower = searchQuery.toLowerCase().trim();
    if (searchLower) {
      source = source.filter(
        (app) =>
          String(app.customer_name || "").toLowerCase().includes(searchLower) ||
          String(app.application_number || "").toLowerCase().includes(searchLower) ||
          String(app.phone || "").toLowerCase().includes(searchLower)
      );
    }

    return source;
  }, [trackingEntries, activeAppView, searchQuery]);

  const handleTakeWork = async (bookingId) => {
    try {
      await api.put(`/customer-services/${bookingId}/take`);
      toast.success("Work assigned to you");
      await fetchWorkspaceInit();
    } catch (err) {
      toast.error(err.response?.data?.error || "Already taken by another staff");
    }
  };

  const handleQuickPunch = async () => {
    try {
      setAttendanceLoading(true);
      const isPunchOut = todayAttendance && todayAttendance.punch_in && !todayAttendance.punch_out;

      const now = new Date();
      const formattedDate = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const formattedTime = now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Kolkata",
      });

      await postAttendance({
        punch_type: isPunchOut ? "out" : "in",
        date: formattedDate,
        time: formattedTime,
      });

      toast.success(`Successfully punched ${isPunchOut ? "out" : "in"}`);
      await fetchWorkspaceInit();
    } catch (err) {
      console.error("Attendance Punch Error:", err.response?.data || err.message);
      toast.error(err.response?.data?.error || "Failed to update attendance");
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleStartOnlineService = (booking) => {
    setProcessingBookings((prev) => prev.filter((b) => b.id !== booking.id));
    navigate(`/dashboard/staff/online-service/${booking.id}`, {
      state: {
        customerServiceId: booking.id,
        customerName: booking.customer_name,
        phone: booking.phone,
        categoryId: booking.service_id,
        subcategoryId: booking.subcategory_id,
      },
    });
  };

  // history is newest-first; only months that had a real target count
  const targetHistory = (performance.targetHistory || []).filter((h) => h.target > 0);
  const lastMonth = targetHistory[0];
  const targetStreak = (() => {
    let n = 0;
    for (const h of targetHistory) {
      if (h.percent >= 100) n++;
      else break;
    }
    return n;
  })();

  // Derived values (Glance strip)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const overdueTasks = myTasks.filter((t) => t.due_date && new Date(t.due_date) < todayStart);
  const nextTask =
    [...myTasks].filter((t) => t.due_date).sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0] || null;

  const nextEvent =
    upcomingEvents
      .map((e) => ({ ...e, _d: new Date(e.date || e.start_datetime) }))
      .filter((e) => !isNaN(e._d) && e._d >= todayStart)
      .sort((a, b) => a._d - b._d)[0] || null;

  const scoreLabel =
    performance.incentiveScore >= 80
      ? "Excellent"
      : performance.incentiveScore >= 60
        ? "Good"
        : performance.incentiveScore >= 40
          ? "Average"
          : "Needs improvement";
  const scoreColor =
    performance.incentiveScore >= 80
      ? "bg-emerald-500"
      : performance.incentiveScore >= 60
        ? "bg-amber-400"
        : "bg-rose-500";

  const barColor = (p) => (p >= 100 ? "bg-emerald-500" : p >= 50 ? "bg-amber-400" : "bg-rose-500");
  const scrollToPerf = () =>
    document.getElementById("perf-details")?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Loading Skeleton (matches PendingPayments / ExpenseEntry / StaffAttendance)
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
        <div className="w-full animate-pulse space-y-4">
          <div className="h-10 w-80 rounded-lg bg-white" />
          <div className="h-24 rounded-2xl bg-white" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-white" />
            ))}
          </div>
          <div className="h-96 rounded-2xl bg-white" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
        <div className="mx-auto mt-12 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <FiAlertCircle className="mx-auto mb-4 h-12 w-12 text-rose-600" />
          <h3 className="mb-2 text-lg font-semibold text-slate-900">Data Loading Error</h3>
          <p className="mb-6 text-sm text-slate-600">{error}</p>
          <button onClick={() => window.location.reload()} className={btnPrimary}>
            <FiRefreshCw className="h-4 w-4" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  const myWallet = wallets.find((w) => String(w.assigned_staff_id) === String(staffId));

  const statTiles =
    statView === "applications"
      ? [
          { label: "Total applications", value: trackingStats.total || 0, sub: "Assigned to you", icon: FiTarget, tone: "bg-violet-50 text-violet-600" },
          { label: "Pending", value: trackingStats.pending || 0, sub: "Awaiting action", icon: FiClock, tone: "bg-amber-50 text-amber-600" },
          { label: "In progress", value: trackingStats.in_progress || 0, sub: "Currently active", icon: FiPlayCircle, tone: "bg-sky-50 text-sky-600" },
          { label: "Completed", value: trackingStats.completed || 0, sub: "Delivered / paid", icon: FiCheckCircle, tone: "bg-emerald-50 text-emerald-600" },
          { label: "Delayed", value: trackingStats.delayed || 0, sub: "Needs attention", icon: FiAlertCircle, tone: "bg-rose-50 text-rose-600" },
        ]
      : [
          { label: "Total tokens", value: statusCounts.total, sub: "Walk-in queue", icon: FiUsers, tone: "bg-violet-50 text-violet-600" },
          { label: "Pending", value: statusCounts.pending, sub: "Waiting in queue", icon: FiClock, tone: "bg-amber-50 text-amber-600" },
          { label: "In progress", value: statusCounts.inProgress, sub: "Being served", icon: FiPlayCircle, tone: "bg-sky-50 text-sky-600" },
          { label: "Completed", value: statusCounts.completed, sub: "Finished tokens", icon: FiCheckCircle, tone: "bg-emerald-50 text-emerald-600" },
          { label: "Campaign", value: statusCounts.campaign, sub: "Campaign tokens", icon: FiAward, tone: "bg-navy-700/10 text-navy-700" },
        ];

  const WORKSPACE_TABS = [
    { id: "tokens", label: "Walk-in Tokens", icon: FiUsers, count: statusCounts.total },
    { id: "queue", label: "Online Queue", icon: FiGlobe, count: onlineBookings.length },
    { id: "processing", label: "My Online Work", icon: FiPlayCircle, count: processingBookings.length },
    { id: "applications", label: "Applications", icon: FiTarget, count: trackingStats.total || 0 },
  ];

  const punchedIn = Boolean(todayAttendance?.punch_in && !todayAttendance?.punch_out);
  const punchedOut = Boolean(todayAttendance?.punch_in && todayAttendance?.punch_out);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6 sd-root">
      <style>{`.sd-root button:focus-visible,.sd-root a:focus-visible,.sd-root select:focus-visible,.sd-root input:focus-visible,.sd-root [tabindex]:focus-visible{outline:3px solid #3b5d8f;outline-offset:2px}`}</style>
      <a
        href="#sd-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-navy-800 focus:shadow-lg"
      >
        Skip to main content
      </a>

      <div className="w-full">
        {/* ===== PAGE HEADER (Same as PendingPayments / ExpenseEntry / StaffAttendance) ===== */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Service Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage tokens, track services, and view performance · {formatCurrentDate(currentTime)} · {formatCurrentTime(currentTime)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Period Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDatePicker(!showDatePicker)}
                className={btnGhost}
              >
                <FiCalendar className="h-4 w-4 text-slate-500" />
                <span>
                  {period === "today" && "Today"}
                  {period === "week" && "This Week"}
                  {period === "month" && "This Month"}
                  {period === "quarter" && "This Quarter"}
                  {period === "year" && "This Year"}
                  {period === "custom" && "Custom Range"}
                </span>
                <FiChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              <AnimatePresence>
                {showDatePicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDatePicker(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
                    >
                      {[
                        ["today", "Today"],
                        ["week", "This Week"],
                        ["month", "This Month"],
                        ["quarter", "This Quarter"],
                        ["year", "This Year"],
                      ].map(([val, label]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => {
                            setPeriod(val);
                            setShowDatePicker(false);
                          }}
                          className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium ${
                            period === val ? "bg-slate-100 text-navy-700" : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                      <div className="my-2 border-t border-slate-100" />
                      <div className="space-y-2">
                        <input
                          type="date"
                          value={customDateRange.from}
                          onChange={(e) => setCustomDateRange((prev) => ({ ...prev, from: e.target.value }))}
                          className={inputCls}
                          aria-label="From date"
                        />
                        <input
                          type="date"
                          value={customDateRange.to}
                          onChange={(e) => setCustomDateRange((prev) => ({ ...prev, to: e.target.value }))}
                          className={inputCls}
                          aria-label="To date"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setPeriod("custom");
                            setShowDatePicker(false);
                          }}
                          className={`${btnPrimary} w-full`}
                        >
                          Apply
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={refreshTokens}
              className={btnGhost}
              title={`Last updated: ${lastUpdated.toLocaleTimeString()}`}
            >
              <FiRefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button type="button" onClick={() => navigate("/dashboard/staff/token")} className={btnGhost}>
              <FiUsers className="h-4 w-4" /> New token
            </button>
            <button type="button" onClick={() => setShowQuickService(true)} className={btnPrimary}>
              <FiPlus className="h-4 w-4" /> Quick service
            </button>
          </div>
        </div>

        {/* ===== BIRTHDAY: MY OWN ===== */}
        <AnimatePresence>
          {myBirthday && !hideMyBirthday && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="relative mb-4 overflow-hidden rounded-2xl bg-rose-600 p-5 text-white shadow-sm"
            >
              {["🎉", "🎈", "🎂", "✨", "🎁", "🎊"].map((e, i) => (
                <motion.span
                  key={i}
                  className="pointer-events-none absolute select-none text-2xl"
                  style={{ left: `${8 + i * 16}%`, bottom: "-10px" }}
                  animate={{ y: [-10, -90], opacity: [0, 1, 0] }}
                  transition={{ duration: 3 + (i % 3), repeat: Infinity, delay: i * 0.6 }}
                >
                  {e}
                </motion.span>
              ))}
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">🎂</div>
                  <div>
                    <h3 className="text-lg font-bold">Happy Birthday, {myBirthday.name}! 🎉</h3>
                    <p className="mt-0.5 text-sm text-white/90">
                      Wishing you a wonderful year ahead from the whole team. Thank you for everything you do!
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={dismissMyBirthday}
                  className="shrink-0 rounded-full bg-white/20 p-2 hover:bg-white/30"
                  title="Dismiss"
                  aria-label="Dismiss birthday message"
                >
                  <FiXCircle className="h-5 w-5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ===== BIRTHDAY: COLLEAGUES ===== */}
        {colleagueBirthdays.length > 0 && (
          <div className="mb-4 flex flex-col justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3.5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex -space-x-2 shrink-0">
                {colleagueBirthdays.slice(0, 3).map((b) =>
                  toPhotoUrl(b.photo) ? (
                    <img
                      key={b.id}
                      src={toPhotoUrl(b.photo)}
                      alt={b.name}
                      className="h-9 w-9 rounded-full border-2 border-white object-cover"
                    />
                  ) : (
                    <div
                      key={b.id}
                      className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-rose-200 text-xs font-bold text-rose-800"
                    >
                      {b.name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )
                )}
              </div>
              <p className="text-sm text-rose-900">
                🎂 Today is{" "}
                <span className="font-bold">
                  {colleagueBirthdays
                    .map((b) => b.name)
                    .join(", ")
                    .replace(/, ([^,]*)$/, " & $1")}
                </span>
                &apos;s birthday! Don&apos;t forget to wish them 🎉
              </p>
            </div>
            {colleagueBirthdays.length === 1 ? (
              <button
                type="button"
                onClick={() => handleSendWishes(colleagueBirthdays[0])}
                disabled={!!openingChatFor}
                className="shrink-0 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
              >
                {openingChatFor ? "Opening…" : "Send Wishes"}
              </button>
            ) : (
              <div className="flex flex-wrap gap-2 shrink-0">
                {colleagueBirthdays.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleSendWishes(b)}
                    disabled={!!openingChatFor}
                    className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
                  >
                    {openingChatFor === b.id ? "Opening…" : `Wish ${(b.name || "").split(" ")[0]}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== STAFF WORKSPACE & ATTENDANCE CARD (Matches StaffAttendance / StaffTeamDashboard Banner) ===== */}
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-navy-700 text-base font-bold text-white">
              {staffPhotoUrl && !imageError ? (
                <img
                  src={staffPhotoUrl}
                  alt="Profile"
                  className="h-full w-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                staffInitials
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-bold text-slate-900">
                  {getGreeting()}, {staffName}!
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Online
                </span>
                {myWallet && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                    <FiBriefcase className="h-3 w-3 text-navy-700" />
                    {myWallet.name}: <strong className="tabular-nums text-slate-900">{formatCurrency(myWallet.balance)}</strong>
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span>
                  {!todayAttendance || !todayAttendance.punch_in
                    ? "You haven't punched in yet today"
                    : !todayAttendance.punch_out
                      ? `Punched in since ${new Date(`1970-01-01T${todayAttendance.punch_in}`).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                      : `Punched out at ${new Date(`1970-01-01T${todayAttendance.punch_out}`).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
                </span>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/my-profile")}
                  className="font-medium text-navy-700 hover:underline"
                >
                  View Profile
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/staff/performance")}
                  className="font-medium text-navy-700 hover:underline"
                >
                  View Reports
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleQuickPunch}
              disabled={attendanceLoading}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-sm transition disabled:opacity-50 ${
                !todayAttendance || !todayAttendance.punch_in
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : !todayAttendance.punch_out
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {punchedIn ? <FiLogOut className="h-4 w-4" /> : <FiLogIn className="h-4 w-4" />}
              {attendanceLoading
                ? "Processing…"
                : !todayAttendance || !todayAttendance.punch_in
                  ? "Punch in now"
                  : !todayAttendance.punch_out
                    ? "Punch out"
                    : "Punch back in"}
            </button>
          </div>
        </div>

        <main id="sd-main" className="pb-16">
          {/* ===== TODAY AT A GLANCE: TOGGLE + 5 STAT TILES ===== */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">Today at a glance</h2>
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1" role="tablist" aria-label="Statistics view">
              <button
                type="button"
                role="tab"
                aria-selected={statView === "applications"}
                onClick={() => setStatView("applications")}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
                  statView === "applications" ? "bg-navy-700 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Applications
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={statView === "tokens"}
                onClick={() => setStatView("tokens")}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
                  statView === "tokens" ? "bg-navy-700 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Walk-in Tokens
              </button>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {statTiles.map((t, i) => (
              <div
                key={t.label}
                className={`flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 ${
                  i === statTiles.length - 1 ? "col-span-2 lg:col-span-1" : ""
                }`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${t.tone}`}>
                  <t.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-slate-500">{t.label}</p>
                  <p className="truncate text-xl font-bold tabular-nums text-slate-900">{t.value}</p>
                  <p className="truncate text-xs text-slate-400">{t.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ===== MAIN WORK AREA + MY DAY PANEL + RECENT ACTIVITY ===== */}
          <div className="flex flex-col items-start gap-6 xl:flex-row xl:flex-wrap 2xl:flex-nowrap">
            {/* Main Column */}
            <div className="w-full min-w-0 flex-1 space-y-6">
              {/* Glance Strip */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Score */}
                <div
                  onClick={scrollToPerf}
                  role="button"
                  tabIndex={0}
                  aria-label="Performance score. Press to jump to performance details"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      scrollToPerf();
                    }
                  }}
                  className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-navy-500"
                >
                  <p className="mb-2 flex items-center text-xs font-semibold text-slate-600">
                    <FiAward className="mr-1.5 h-3.5 w-3.5 text-navy-700" />
                    Performance score
                  </p>
                  {performanceLoading ? (
                    <div className="h-14 animate-pulse rounded bg-slate-100" />
                  ) : (
                    <>
                      <p className="text-2xl font-bold tabular-nums text-slate-900">{performance.incentiveScore}%</p>
                      <p className="mb-2 text-xs text-slate-500">{scoreLabel}</p>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${scoreColor}`}
                          style={{ width: `${Math.min(performance.incentiveScore, 100)}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Tasks */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="mb-2 flex items-center text-xs font-semibold text-slate-600">
                    <FiCheckSquare className="mr-1.5 h-3.5 w-3.5 text-navy-700" />
                    Pending tasks
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-slate-900">{myTasks.length}</p>
                  {overdueTasks.length > 0 ? (
                    <p className="mt-1 text-xs font-semibold text-rose-600">{overdueTasks.length} overdue</p>
                  ) : nextTask ? (
                    <p className="mt-1 truncate text-xs text-slate-500" title={nextTask.title}>
                      Next: {nextTask.title}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-emerald-700">All clear</p>
                  )}
                </div>

                {/* Next Event */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="mb-2 flex items-center text-xs font-semibold text-slate-600">
                    <FiCalendar className="mr-1.5 h-3.5 w-3.5 text-navy-700" />
                    Next event
                  </p>
                  {nextEvent ? (
                    <>
                      <p className="line-clamp-2 text-sm font-semibold text-slate-900" title={nextEvent.title}>
                        {nextEvent.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {getEventDayLabel(nextEvent.date || nextEvent.start_datetime)}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500">Nothing upcoming</p>
                  )}
                </div>
              </div>

              {/* Search & Date Filter Card (Matches PendingPayments filter bar) */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative flex-1">
                    <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      aria-label="Search tokens or applications"
                      placeholder="Search by token, customer name, application no, or phone…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`${inputCls} pl-9`}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Quick date range">
                    {DATE_PRESETS.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setActiveDate(r.id)}
                        aria-pressed={activeDate === r.id}
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                          activeDate === r.id
                            ? "border-navy-700 bg-navy-700 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Master Workspace Tabs */}
                <div
                  role="tablist"
                  aria-label="Work queue sections"
                  className="mt-3 flex gap-1 overflow-x-auto border-t border-slate-100 pt-3"
                >
                  {WORKSPACE_TABS.map((t) => {
                    const active = workspaceTab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setWorkspaceTab(t.id)}
                        className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                          active ? "bg-navy-700 text-white" : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <t.icon className="h-4 w-4" />
                        {t.label}
                        <span
                          className={`rounded-full px-1.5 text-xs tabular-nums ${
                            active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {t.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Work Queue Content Card */}
              <div
                role="region"
                aria-label="Work queue"
                className="flex h-[min(780px,80vh)] min-h-[480px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                  {/* TAB 1: TOKENS */}
                  {workspaceTab === "tokens" && (
                    <div className="space-y-4">
                      <div className="flex gap-1.5 border-b border-slate-100 pb-3">
                        {["active", "completed", "campaign"].map((tab) => (
                          <button
                            key={tab}
                            type="button"
                            aria-pressed={activeView === tab}
                            onClick={() => setActiveView(tab)}
                            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition ${
                              activeView === tab
                                ? "border-navy-700 bg-navy-700 text-white"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>

                      {Object.keys(groupedTokens).length === 0 ? (
                        <div className="py-16 text-center text-slate-500">
                          <FiPlayCircle className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                          <p className="text-sm font-medium">No tokens found</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {Object.entries(groupedTokens).map(([date, dateTokens]) => (
                            <div key={date}>
                              <div className="mb-3 flex items-center gap-2 pl-1">
                                <FiCalendar className="h-3.5 w-3.5 text-navy-700" />
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                  {formatDateUI(date)}
                                </h3>
                                <div className="ml-2 h-px flex-1 bg-slate-100" />
                              </div>
                              <div className="grid grid-cols-1 gap-2.5">
                                {dateTokens.map((token) => {
                                  const isAssignedToMe = String(token.staffId || "").trim() === String(staffId).trim();
                                  const isUnassigned = !token.staffId || token.staffId === "null";

                                  return (
                                    <div
                                      key={token.tokenId}
                                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 transition hover:bg-slate-50/70"
                                    >
                                      <div className="flex min-w-0 flex-1 items-center gap-3">
                                        <div
                                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                                            activeView === "completed"
                                              ? "bg-emerald-50 text-emerald-700"
                                              : "bg-navy-700/10 text-navy-700"
                                          }`}
                                        >
                                          {shortenTokenId(token.tokenId)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="mb-0.5 flex flex-wrap items-center gap-2">
                                            <h4 className="truncate text-sm font-medium text-slate-900">
                                              {token.customerName || "Customer"}
                                            </h4>
                                            <StatusChip status={token.status} />
                                            {isAssignedToMe && activeView === "active" && (
                                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                                                Mine
                                              </span>
                                            )}
                                          </div>
                                          <p className="flex items-center gap-2 truncate text-xs text-slate-500">
                                            <span className="font-medium text-slate-700">
                                              {getCategoryName(token.categoryId)}
                                            </span>
                                            <span>·</span>
                                            <span>{formatTime(token.createdAt)}</span>
                                            {token.phone && (
                                              <>
                                                <span>·</span>
                                                <span>{token.phone}</span>
                                              </>
                                            )}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex shrink-0 items-center gap-1.5 pl-3">
                                        {(activeView === "active" || activeView === "campaign") &&
                                          (token.status === "pending" || token.status === "in-progress") &&
                                          (isAssignedToMe || isUnassigned) && (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleStartService(token.tokenId, token.staffId, token.status)
                                                }
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-navy-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-800"
                                              >
                                                <FiPlayCircle className="h-3.5 w-3.5" />
                                                {token.status === "pending" ? "Start" : "Resume"}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => openCancelModal(token)}
                                                className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                                title="Cancel Token"
                                                aria-label={`Cancel token ${token.tokenId}`}
                                              >
                                                <FiXCircle className="h-4 w-4" />
                                              </button>
                                            </>
                                          )}
                                        {(activeView === "completed" ||
                                          (activeView === "campaign" && token.status === "completed")) && (
                                          <button
                                            type="button"
                                            onClick={() => handleViewDetails(token.tokenId, token.trackingId)}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                          >
                                            <FiBarChart2 className="h-3.5 w-3.5" /> Details
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: ONLINE QUEUE */}
                  {workspaceTab === "queue" && (
                    <div className="space-y-2.5">
                      {onlineBookings.length === 0 ? (
                        <div className="py-16 text-center text-slate-500">
                          <FiGlobe className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                          <p className="text-sm font-medium">No pending online bookings</p>
                        </div>
                      ) : (
                        onlineBookings.map((booking) => (
                          <div
                            key={booking.id}
                            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50/70"
                          >
                            <div className="flex min-w-0 items-center gap-3.5">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-700/10 text-xs font-bold text-navy-700">
                                #{booking.id}
                              </div>
                              <div className="min-w-0">
                                <h4 className="truncate text-sm font-medium text-slate-900">{booking.customer_name}</h4>
                                <p className="mt-0.5 truncate text-xs text-slate-500">
                                  {getCategoryName(booking.service_id)} ·{" "}
                                  {getSubcategoryName(booking.service_id, booking.subcategory_id)}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  {new Date(booking.applied_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleTakeWork(booking.id)}
                              className="shrink-0 rounded-lg bg-navy-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-navy-800"
                            >
                              Take Work
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 3: MY ONLINE WORK */}
                  {workspaceTab === "processing" && (
                    <div className="space-y-2.5">
                      {processingBookings.length === 0 ? (
                        <div className="py-16 text-center text-slate-500">
                          <FiCheckSquare className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                          <p className="text-sm font-medium">No active online work</p>
                        </div>
                      ) : (
                        processingBookings.map((booking) => (
                          <div
                            key={booking.id}
                            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50/70"
                          >
                            <div className="flex min-w-0 items-center gap-3.5">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-xs font-bold text-emerald-700">
                                #{booking.id}
                              </div>
                              <div className="min-w-0">
                                <div className="mb-0.5 flex items-center gap-2">
                                  <h4 className="truncate text-sm font-medium text-slate-900">
                                    {booking.customer_name}
                                  </h4>
                                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                                    Assigned to you
                                  </span>
                                </div>
                                <p className="truncate text-xs text-slate-500">
                                  {getCategoryName(booking.service_id)} ·{" "}
                                  {getSubcategoryName(booking.service_id, booking.subcategory_id)}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  Taken at: {new Date(booking.taken_at || booking.applied_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleStartOnlineService(booking)}
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                            >
                              <FiPlayCircle className="h-4 w-4" /> Start
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 4: APPLICATIONS TRACKING */}
                  {workspaceTab === "applications" && (
                    <div className="space-y-4">
                      <div className="flex gap-1.5 border-b border-slate-100 pb-3">
                        {["active", "completed", "delayed"].map((tab) => {
                          let count = 0;
                          if (tab === "active")
                            count = (trackingStats.pending || 0) + (trackingStats.in_progress || 0);
                          if (tab === "completed") count = trackingStats.completed || 0;
                          if (tab === "delayed") count = trackingStats.delayed || 0;

                          return (
                            <button
                              key={tab}
                              type="button"
                              aria-pressed={activeAppView === tab}
                              onClick={() => setActiveAppView(tab)}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition ${
                                activeAppView === tab
                                  ? "border-navy-700 bg-navy-700 text-white"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {tab}
                              <span
                                className={`rounded-full px-1.5 text-xs tabular-nums ${
                                  activeAppView === tab ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="space-y-2.5">
                        {filteredApplications.length === 0 ? (
                          <div className="py-16 text-center text-slate-500">
                            <FiTarget className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                            <p className="text-sm font-medium">No {activeAppView} applications found</p>
                          </div>
                        ) : (
                          filteredApplications.map((app) => (
                            <div
                              key={app.id}
                              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50/70"
                            >
                              <div className="flex min-w-0 items-center gap-3.5">
                                <div
                                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                                    activeAppView === "completed"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : activeAppView === "delayed"
                                        ? "bg-rose-50 text-rose-700"
                                        : "bg-navy-700/10 text-navy-700"
                                  }`}
                                >
                                  {app.application_number ? `#${app.application_number.slice(-4)}` : "APP"}
                                </div>
                                <div className="min-w-0">
                                  <div className="mb-0.5 flex flex-wrap items-center gap-2">
                                    <h4 className="truncate text-sm font-medium text-slate-900">
                                      {app.customer_name}
                                    </h4>
                                    <StatusChip status={app.status} />
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">
                                      {app.progress}%
                                    </span>
                                  </div>
                                  <p className="flex items-center gap-2 truncate text-xs text-slate-500">
                                    <span className="font-medium text-slate-700">{app.service_name}</span>
                                    <span>·</span>
                                    <span>{app.current_step || "Submitted"}</span>
                                  </p>
                                  <p className="mt-1 text-xs text-slate-400">
                                    Last updated:{" "}
                                    {new Date(app.updated_at).toLocaleString("en-IN", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      day: "numeric",
                                      month: "short",
                                    })}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => navigate(`/dashboard/staff/track_service/${app.id}`)}
                                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                <FiBarChart2 className="h-4 w-4" /> Track
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ===== PERFORMANCE DETAILS ROW ===== */}
              <div
                id="perf-details"
                role="region"
                aria-label="Performance details"
                className="grid scroll-mt-20 grid-cols-1 items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3"
              >
                {/* 3a: MONTHLY & DAILY TARGET METER */}
                <Card title="Target (+10% Growth)" icon={FiTarget}>
                  {performanceLoading ? (
                    <div className="h-24 animate-pulse rounded bg-slate-100" />
                  ) : (
                    <div>
                      <div className="mb-2 flex items-end justify-between">
                        <div>
                          <p className="text-xs text-slate-500">Month achieved</p>
                          <p className="text-xl font-bold tabular-nums text-slate-900">
                            {formatCurrency(performance.currentAchieved)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Month target</p>
                          <p className="text-base font-semibold tabular-nums text-slate-800">
                            {formatCurrency(performance.monthlyTarget)}
                          </p>
                        </div>
                      </div>

                      <div
                        role="progressbar"
                        aria-label="Monthly target progress"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(Math.min(performance.targetProgress, 100))}
                        className="mb-1 h-2 w-full overflow-hidden rounded-full bg-slate-100"
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${
                            performance.targetProgress >= 100
                              ? "bg-emerald-500"
                              : performance.targetProgress >= 50
                                ? "bg-amber-400"
                                : "bg-rose-500"
                          }`}
                          style={{ width: `${Math.min(performance.targetProgress, 100)}%` }}
                        />
                      </div>
                      <p className="mb-4 text-right text-xs font-medium tabular-nums text-slate-500">
                        {performance.targetProgress.toFixed(1)}% completed
                      </p>

                      {/* Daily Progress */}
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="mb-1.5 flex items-center justify-between">
                          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                            <FiActivity className="h-3.5 w-3.5 text-navy-700" />
                            Today&apos;s goal
                          </h4>
                          <span className="text-xs font-semibold tabular-nums text-slate-800">
                            {formatCurrency(performance.todayAchieved)} / {formatCurrency(performance.dailyTarget)}
                          </span>
                        </div>

                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ${
                              performance.todayAchieved >= performance.dailyTarget ? "bg-emerald-500" : "bg-navy-700"
                            }`}
                            style={{
                              width: `${Math.min(
                                performance.dailyTarget > 0
                                  ? (performance.todayAchieved / performance.dailyTarget) * 100
                                  : 0,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                        {performance.todayAchieved >= performance.dailyTarget && performance.dailyTarget > 0 && (
                          <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <FiCheckCircle className="h-3 w-3" /> Daily target met!
                          </p>
                        )}
                      </div>

                      {/* Previous Months */}
                      {targetHistory.length > 0 && (
                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <div className="mb-2 flex items-center justify-between">
                            <h4 className="text-xs font-semibold text-slate-700">Previous months</h4>
                            {targetStreak >= 2 && (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                🔥 {targetStreak} months in a row
                              </span>
                            )}
                          </div>

                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {[...targetHistory].reverse().map((h) => {
                              const met = h.percent >= 100;
                              return (
                                <div
                                  key={h.month}
                                  title={`Target ${formatCurrency(h.target)} · Achieved ${formatCurrency(h.achieved)}`}
                                  className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-center ${
                                    met
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                      : "border-rose-200 bg-rose-50 text-rose-700"
                                  }`}
                                >
                                  <p className="text-xs font-medium">
                                    {new Date(h.month).toLocaleString("en-IN", { month: "short" })}
                                  </p>
                                  <p className="text-xs font-bold tabular-nums">
                                    {met ? "✓" : "✗"} {Math.round(h.percent || 0)}%
                                  </p>
                                </div>
                              );
                            })}
                          </div>

                          {lastMonth && (
                            <p className="mt-2 text-xs text-slate-500">
                              Last month:{" "}
                              {lastMonth.percent >= 100 ? (
                                <span className="font-semibold text-emerald-700">target achieved 🎉</span>
                              ) : (
                                <span className="font-semibold text-rose-600">
                                  {formatCurrency(Math.max(lastMonth.target - lastMonth.achieved, 0))} short of target
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </Card>

                {/* 3b: PERFORMANCE SCORE CARD */}
                <Card
                  title="Performance Score"
                  icon={FiAward}
                  action={
                    <div
                      className="group relative"
                      tabIndex={0}
                      aria-label="How the score is calculated: collection rate 50%, revenue efficiency 30%, consistency 20%"
                    >
                      <FiInfo className="h-4 w-4 cursor-pointer text-slate-400" />
                      <div className=" absolute bottom-full right-0 z-10 mb-2 hidden w-64 rounded-xl bg-slate-900 p-2.5 text-xs text-white group-focus-within:block group-hover:block">
                        Score based on collection rate (50%), revenue efficiency (30%), and consistency (20%)
                      </div>
                    </div>
                  }
                >
                  <div className="py-2 text-center">
                    <div className="relative inline-block">
                      <svg
                        className="h-32 w-32"
                        role="img"
                        aria-label={`Performance score ${performanceLoading ? 0 : performance.incentiveScore} percent`}
                      >
                        <circle
                          className="text-slate-100"
                          strokeWidth="12"
                          stroke="currentColor"
                          fill="transparent"
                          r="54"
                          cx="64"
                          cy="64"
                        />
                        <circle
                          className="transition-all duration-1000"
                          strokeWidth="12"
                          strokeDasharray={339.292}
                          strokeDashoffset={
                            339.292 * (1 - (performanceLoading ? 0 : performance.incentiveScore / 100))
                          }
                          strokeLinecap="round"
                          stroke="url(#gradient)"
                          fill="transparent"
                          r="54"
                          cx="64"
                          cy="64"
                        />
                        <defs>
                          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop
                              offset="0%"
                              stopColor={
                                performance.incentiveScore >= 80
                                  ? "#10B981"
                                  : performance.incentiveScore >= 60
                                    ? "#F59E0B"
                                    : "#EF4444"
                              }
                            />
                            <stop
                              offset="100%"
                              stopColor={
                                performance.incentiveScore >= 80
                                  ? "#059669"
                                  : performance.incentiveScore >= 60
                                    ? "#D97706"
                                    : "#DC2626"
                              }
                            />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                        <p className="text-2xl font-bold tabular-nums text-slate-900">
                          {performanceLoading ? "…" : `${performance.incentiveScore}%`}
                        </p>
                        <p className="text-xs text-slate-500">{!performanceLoading && scoreLabel}</p>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* 3c: PERFORMANCE METRICS */}
                <Card title="Performance Metrics" icon={FiActivity}>
                  {performanceLoading ? (
                    <div className="space-y-3">
                      <div className="h-8 animate-pulse rounded bg-slate-100" />
                      <div className="h-8 animate-pulse rounded bg-slate-100" />
                      <div className="h-8 animate-pulse rounded bg-slate-100" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="text-slate-600">Completion Rate</span>
                          <span className="font-medium tabular-nums text-slate-900">{performance.completionRate}%</span>
                        </div>
                        <div
                          role="progressbar"
                          aria-label="Completion rate"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Number(performance.completionRate) || 0}
                          className="h-1.5 w-full rounded-full bg-slate-100"
                        >
                          <div
                            className="h-1.5 rounded-full bg-emerald-500"
                            style={{ width: `${performance.completionRate}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="text-slate-600">Avg Transaction Value</span>
                          <span className="font-medium tabular-nums text-slate-900">
                            {formatCurrency(performance.avgTransactionValue)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100">
                          <div
                            className="h-1.5 rounded-full bg-navy-700"
                            style={{ width: `${Math.min((performance.avgTransactionValue / 1000) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="text-slate-600">Customer Satisfaction</span>
                          <span className="font-medium tabular-nums text-slate-900">
                            {performance.customerSatisfaction}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100">
                          <div
                            className="h-1.5 rounded-full bg-navy-700"
                            style={{ width: `${(performance.avgRating / 5) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2 border-t border-slate-100 pt-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Collection Rate</span>
                          <span className="font-medium tabular-nums text-slate-900">{performance.collectionRate}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Total Revenue</span>
                          <span className="font-medium tabular-nums text-slate-900">
                            {formatCurrency(performance.totalCollected)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Total Services</span>
                          <span className="font-medium tabular-nums text-slate-900">{performance.totalServices}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </div>

            {/* ===== LEFT RAIL: MY DAY PANEL ===== */}
            <aside aria-label="My day" className="w-full space-y-4 xl:order-first xl:w-[340px] xl:shrink-0">
              {/* Target Summary */}
              <div
                onClick={scrollToPerf}
                role="button"
                tabIndex={0}
                aria-label="Monthly target. Press to jump to target details"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    scrollToPerf();
                  }
                }}
                className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-navy-500"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="flex items-center text-sm font-semibold text-slate-800">
                    <FiTarget className="mr-2 h-4 w-4 text-navy-700" />
                    Target (+10% Growth)
                  </p>
                  {!performanceLoading && performance.monthlyTarget > 0 && (
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        performance.targetProgress >= 100 ? "text-emerald-700" : "text-slate-700"
                      }`}
                    >
                      {performance.targetProgress.toFixed(0)}%
                    </span>
                  )}
                </div>

                {performanceLoading ? (
                  <div className="h-14 animate-pulse rounded bg-slate-100" />
                ) : performance.monthlyTarget > 0 ? (
                  <>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-bold tabular-nums text-slate-900">
                        {formatCurrency(performance.currentAchieved)}
                      </span>
                      <span className="text-xs text-slate-500">
                        of {formatCurrency(performance.monthlyTarget)}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label="Monthly target progress"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(Math.min(performance.targetProgress, 100))}
                      className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
                    >
                      <div
                        className={`h-full rounded-full ${barColor(performance.targetProgress)}`}
                        style={{ width: `${Math.min(performance.targetProgress, 100)}%` }}
                      />
                    </div>

                    <div className="mb-1 mt-3 flex justify-between text-xs text-slate-500">
                      <span>Today&apos;s goal</span>
                      <span
                        className={`tabular-nums ${
                          performance.dailyTarget > 0 && performance.todayAchieved >= performance.dailyTarget
                            ? "font-semibold text-emerald-700"
                            : ""
                        }`}
                      >
                        {formatCurrency(performance.todayAchieved)} / {formatCurrency(performance.dailyTarget)}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label="Today goal progress"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(
                        Math.min(
                          performance.dailyTarget > 0
                            ? (performance.todayAchieved / performance.dailyTarget) * 100
                            : 0,
                          100
                        )
                      )}
                      className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
                    >
                      <div
                        className={`h-full rounded-full ${
                          performance.dailyTarget > 0 && performance.todayAchieved >= performance.dailyTarget
                            ? "bg-emerald-500"
                            : "bg-navy-700"
                        }`}
                        style={{
                          width: `${Math.min(
                            performance.dailyTarget > 0
                              ? (performance.todayAchieved / performance.dailyTarget) * 100
                              : 0,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="py-2 text-xs text-slate-500">No target set for this month yet</p>
                )}
              </div>

              {/* My Pending Tasks */}
              <Card
                role="region"
                ariaLabel="My pending tasks"
                title="My Pending Tasks"
                icon={FiCheckSquare}
                action={
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700">
                    {myTasks.length}
                  </span>
                }
              >
                {myTasks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-5 text-center">
                    <p className="text-sm text-slate-500">No pending tasks! 🎉</p>
                  </div>
                ) : (
                  <div className="max-h-60 space-y-2.5 overflow-y-auto pr-1">
                    {myTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50 p-3 transition hover:bg-white"
                      >
                        <button
                          type="button"
                          onClick={() => handleCompleteTask(task.id)}
                          className="mt-0.5 text-slate-400 transition-colors hover:text-emerald-600"
                          title="Mark as complete"
                          aria-label={`Mark task complete: ${task.title}`}
                        >
                          <FiCheckCircle className="h-5 w-5" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800">{task.title}</p>
                          {task.due_date && (
                            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-rose-600">
                              <FiClock className="h-3 w-3" /> Due {getEventDayLabel(task.due_date)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* My Wallet */}
              <Card role="region" ariaLabel="My wallet" title="My Wallet" icon={FiDollarSign}>
                <dl className="divide-y divide-slate-100 text-sm">
                  <div className="flex justify-between py-1.5">
                    <dt className="text-slate-600">{myWallet ? myWallet.name : "Assigned wallet"}</dt>
                    <dd className="font-semibold tabular-nums text-slate-900">
                      {myWallet ? formatCurrency(myWallet.balance) : "Not assigned"}
                    </dd>
                  </div>
                </dl>
              </Card>

              {/* Upcoming Calendar */}
              <Card
                role="region"
                ariaLabel="Upcoming calendar"
                title="Upcoming Calendar"
                icon={FiCalendar}
                onMouseEnter={() => setIsEventsHovered(true)}
                onMouseLeave={() => setIsEventsHovered(false)}
                action={
                  <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
                    {isEventsHovered ? (
                      <FiClock className="text-amber-500" />
                    ) : (
                      <FiPlayCircle className="animate-pulse text-emerald-500" />
                    )}
                    {isEventsHovered ? "Paused" : "Auto"}
                  </span>
                }
              >
                <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
                  {["All", "Tasks", "Deliveries", "Expiries", "Days"].map((tab) => {
                    const count = upcomingEvents.filter((e) => {
                      const displayKey = e.event_type || e.type;
                      if (tab === "All") return true;
                      if (tab === "Tasks") return e.source === "task" || displayKey === "task" || displayKey === "deadline";
                      if (tab === "Deliveries") return e.source === "service_delivery";
                      if (tab === "Expiries") return e.source === "service_expiry";
                      if (tab === "Days") return ["working", "holiday", "weekend"].includes(displayKey);
                      return false;
                    }).length;

                    return (
                      <button
                        key={tab}
                        type="button"
                        aria-pressed={activeEventTab === tab}
                        onClick={() => setActiveEventTab(tab)}
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition ${
                          activeEventTab === tab
                            ? "border-navy-700 bg-navy-700 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {tab}
                        <span
                          className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                            activeEventTab === tab ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <motion.div
                  key={activeEventTab}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="max-h-60 space-y-2.5 overflow-y-auto pr-1"
                >
                  {(() => {
                    const filteredEvents = upcomingEvents.filter((e) => {
                      const displayKey = e.event_type || e.type;
                      if (activeEventTab === "All") return true;
                      if (activeEventTab === "Tasks")
                        return e.source === "task" || displayKey === "task" || displayKey === "deadline";
                      if (activeEventTab === "Deliveries") return e.source === "service_delivery";
                      if (activeEventTab === "Expiries") return e.source === "service_expiry";
                      if (activeEventTab === "Days") return ["working", "holiday", "weekend"].includes(displayKey);
                      return false;
                    });

                    if (filteredEvents.length === 0) {
                      return (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-6 text-center">
                          <p className="text-sm text-slate-500">No {activeEventTab.toLowerCase()} scheduled.</p>
                        </div>
                      );
                    }

                    return filteredEvents.map((event) => {
                      const dayLabel = getEventDayLabel(event.date || event.start_datetime);
                      const isToday = dayLabel === "Today";
                      const isTomorrow = dayLabel === "Tomorrow";
                      const displayKey = event.event_type || event.type;

                      let Icon = FiCalendar;
                      let typeColor = "border-slate-200 bg-slate-50 text-navy-700";
                      let badgeLabel = "Event";

                      if (event.source === "service_delivery") {
                        Icon = FiBriefcase;
                        typeColor = "border-slate-200 bg-slate-50 text-navy-700";
                        badgeLabel = "Delivery";
                      } else if (event.source === "service_expiry") {
                        Icon = FiAlertCircle;
                        typeColor = "border-rose-100 bg-rose-50/60 text-rose-600";
                        badgeLabel = "Expiry";
                      } else if (event.source === "task" || displayKey === "task" || displayKey === "deadline") {
                        Icon = FiCheckSquare;
                        typeColor = "border-emerald-100 bg-emerald-50/60 text-emerald-700";
                        badgeLabel = "Task";
                      } else if (displayKey === "working" || displayKey === "start") {
                        Icon = FiBriefcase;
                        typeColor = "border-emerald-100 bg-emerald-50/60 text-emerald-700";
                        badgeLabel = displayKey === "working" ? "Working Day" : "Start";
                      } else if (displayKey === "holiday") {
                        Icon = FiStar;
                        typeColor = "border-rose-100 bg-rose-50/60 text-rose-600";
                        badgeLabel = "Holiday";
                      } else if (displayKey === "weekend") {
                        Icon = FiClock;
                        typeColor = "border-slate-200 bg-slate-50 text-slate-600";
                        badgeLabel = "Weekend";
                      } else if (displayKey === "announcement") {
                        Icon = FiInfo;
                        typeColor = "border-slate-200 bg-slate-50 text-navy-700";
                        badgeLabel = "Announcement";
                      }

                      return (
                        <div
                          key={event.id}
                          className={`flex items-start gap-3 rounded-xl border p-3 ${typeColor}`}
                        >
                          <div className="mt-0.5 shrink-0 rounded-lg bg-white p-1.5 shadow-sm">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900" title={event.title}>
                              {event.title}
                            </p>
                            {event.description && (
                              <p className="mt-0.5 truncate text-xs text-slate-500">{event.description}</p>
                            )}
                            <div className="mt-1.5 flex items-center justify-between">
                              <p className="flex items-center gap-1 text-xs font-medium">
                                <FiClock className="h-3 w-3" />
                                <span
                                  className={
                                    isToday
                                      ? "font-semibold text-rose-600"
                                      : isTomorrow
                                        ? "font-semibold text-amber-700"
                                        : "text-slate-500"
                                  }
                                >
                                  {dayLabel}
                                </span>
                              </p>
                              <span className="text-[11px] font-semibold uppercase tracking-wider opacity-75">
                                {badgeLabel}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleViewService(event)}
                            className="shrink-0 self-center rounded-lg bg-white p-2 text-slate-500 shadow-sm hover:text-navy-700"
                            title="Go to Service Tracking"
                            aria-label={`Open ${event.title} in service tracking`}
                          >
                            <FiExternalLink className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    });
                  })()}
                </motion.div>
              </Card>
            </aside>

            {/* ===== RIGHT RAIL: RECENT ACTIVITY ===== */}
            <div className="order-last w-full 2xl:w-[340px] 2xl:shrink-0">
              <Card
                role="region"
                ariaLabel="Recent activity"
                title="Recent Activity"
                icon={FiActivity}
                action={
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">
                    {recentServiceEntries.length} items
                  </span>
                }
              >
                <div className="max-h-[520px] overflow-y-auto pr-1">
                  {Object.keys(groupedRecentActivities).length > 0 ? (
                    <div className="space-y-5">
                      {Object.entries(groupedRecentActivities).map(([date, entries]) => (
                        <div key={date} className="relative">
                          <div className="sticky top-0 z-10 mb-2.5 flex items-center gap-2 bg-white/95 py-1 backdrop-blur-sm">
                            <FiCalendar className="h-3.5 w-3.5 text-navy-700" />
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                              {formatDateUI(date)}
                            </h4>
                            <div className="ml-1 h-px flex-1 bg-slate-100" />
                          </div>

                          <div className="space-y-2.5">
                            {entries.map((entry) => (
                              <div
                                key={entry.id}
                                className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 transition hover:bg-white hover:border-slate-200"
                              >
                                <div className="mb-1.5 flex items-center justify-between gap-2">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <p className="truncate text-sm font-medium text-slate-900">
                                      {entry.customerName || "Customer"}
                                    </p>
                                    <StatusChip status={entry.status} />
                                  </div>
                                  <span className="shrink-0 text-xs text-slate-400">
                                    {formatTime(entry.created_at)}
                                  </span>
                                </div>

                                <div className="flex items-end justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                    <span className="max-w-[150px] truncate font-medium text-slate-700">
                                      {getCategoryName(entry.category)}
                                    </span>
                                    {entry.tokenId && (
                                      <span className="font-mono text-xs text-slate-500">
                                        · {shortenTokenId(entry.tokenId)}
                                      </span>
                                    )}
                                    {entry.workSource === "online" && (
                                      <span className="inline-flex items-center gap-0.5 rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-navy-700">
                                        <FiGlobe className="h-2.5 w-2.5" /> Online
                                      </span>
                                    )}
                                    {entry.is_edited && (
                                      <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                                        Edited
                                      </span>
                                    )}
                                  </div>

                                  {(entry.tokenId || entry.tracking_id) && (
                                    <button
                                      type="button"
                                      onClick={() => handleViewDetails(entry.tokenId, entry.tracking_id)}
                                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-navy-700 hover:bg-slate-50"
                                    >
                                      Details <FiChevronRight className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-10 text-center text-slate-400">
                      <FiActivity className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                      <p className="text-sm">No recent activity</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* ===== CANCEL TOKEN MODAL ===== */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setShowCancelModal(false);
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Cancel token"
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Cancel token</h3>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Are you sure you want to cancel token{" "}
                    <span className="font-mono font-semibold text-slate-800">{cancelTokenData?.tokenId}</span> for{" "}
                    <span className="font-medium text-slate-800">{cancelTokenData?.customerName}</span>?
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                  aria-label="Close"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-5">
                <label htmlFor="cancel-reason" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Reason <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows="3"
                  className={inputCls}
                  placeholder="e.g., customer requested, duplicate entry…"
                />
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setShowCancelModal(false)} className={btnGhost}>
                  No, keep token
                </button>
                <button
                  type="button"
                  onClick={handleCancelConfirm}
                  disabled={cancelling}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {cancelling ? "Cancelling…" : "Yes, cancel token"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <QuickServiceModal open={showQuickService} onClose={() => setShowQuickService(false)} wallets={wallets} />
    </div>
  );
};

export default StaffDashboard;