import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { socket } from '@/services/socket';
import { useNotifications } from '../context/NotificationContext';
import ThemeToggle from '../components/ThemeToggle';

const DashboardLayout = () => {
  const role = localStorage.getItem("role");
  const staffName = localStorage.getItem("name");
  const customerName = localStorage.getItem("customer_name");
  const [collapsedPref, setCollapsedPref] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(min-width: 768px)').matches : true
  );
  // Collapsed (icon-only) mode is a desktop feature; the phone drawer always shows labels
  const isCollapsed = collapsedPref && isDesktop;
  const [activePath, setActivePath] = useState(window.location.pathname);
  const location = useLocation();
  const navigate = useNavigate();

  // Top bar "jump to page" box (Ctrl/Cmd + K focuses it)
  const [jumpQuery, setJumpQuery] = useState("");
  const [jumpOpen, setJumpOpen] = useState(false);
  const jumpRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === "k") {
        e.preventDefault();
        jumpRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const token = localStorage.getItem("token");

  // Centre name shown under the admin's name. Read from localStorage ("centre_name", saved at login);
  // no API call here because /api/centres is superadmin-only.
  const centreName = localStorage.getItem("centre_name") || "";
  
  // Add state for conversations and unread count
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadNotesCount, setUnreadNotesCount] = useState(0);
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // global notification count
  const { unreadCount: notificationsCount } = useNotifications();

  // Get current user info for socket
  let currentUserId = null;
  if (token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));
      currentUserId = payload.id || payload.staff_id || payload.userId || payload.sub;
    } catch (err) {
      console.error("Could not decode token", err);
    }
  }

  const API_BASE_URL = import.meta.env.VITE_API_URL;
    if (!API_BASE_URL) {
      throw new Error("VITE_API_URL is not defined");
  }

  // Fetch all unread counts from the new API endpoint
  const fetchAllUnreadCounts = async () => {
    if (!token) return;
    
    try {
      console.log("Fetching unread counts...");
      const res = await fetch(`${API_BASE_URL}/api/chat/unread/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch unread counts');
      const unreadMap = await res.json();
      
      // Calculate total unread count
      const totalUnread = Object.values(unreadMap).reduce((acc, count) => acc + count, 0);
      console.log("Total unread count:", totalUnread);
      setUnreadCount(totalUnread);
      setInitialLoadDone(true);
      
    } catch (err) {
      console.error('Error fetching unread counts:', err);
    }
  };

  // Fetch unread notes count
  const fetchUnreadNotesCount = async () => {
    if (!token) return;
    try {
      // Fix route path depending on how your Axios instance is set up, normally:
      const res = await fetch(`${API_BASE_URL}/api/notes/unread`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch unread notes');
      const data = await res.json();
      setUnreadNotesCount(data.count);
    } catch (err) {
      console.error('Error fetching unread notes:', err);
    }
  };

  // New leads waiting for a reply (badge on "Leads")
  const hasLeads = ["staff", "admin", "superadmin"].includes(role);
  const fetchNewLeadsCount = async () => {
    if (!token || !hasLeads) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/leads/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setNewLeadsCount(Number(data.new) || 0);
    } catch (err) {
      console.error('Error fetching leads count:', err);
    }
  };

  // Initial fetch on component mount
  useEffect(() => {
    if (token && currentUserId) {
      fetchAllUnreadCounts();
      fetchUnreadNotesCount();
      fetchNewLeadsCount();
    }
  }, [token, currentUserId]);

  // Socket connection for real-time unread updates
  useEffect(() => {
    if (!token || !currentUserId) return;

    console.log("Setting up socket listeners for dashboard...");

    const handleConnect = () => {
      console.log("Dashboard socket connected");
      setSocketConnected(true);
      fetchAllUnreadCounts();
      fetchUnreadNotesCount();
      fetchNewLeadsCount();
    };

    // A lead was created or changed anywhere → refresh the badge (server counts only this user's centre)
    let leadsTimer;
    const handleLeadsChange = () => {
      clearTimeout(leadsTimer);
      leadsTimer = setTimeout(fetchNewLeadsCount, 500);
    };

    const handleUnreadNotesUpdate = () => {
      console.log("New note event received!");
      fetchUnreadNotesCount(); // 🔥 Add this
    };

    const handleUnreadUpdate = (data) => {
      console.log("Unread update received in dashboard:", data);
      fetchAllUnreadCounts();
    };

    const handleNewMessage = (msg) => {
      const isCurrentUser = String(msg.sender_id) === String(currentUserId);
      if (!isCurrentUser) {
        fetchAllUnreadCounts();
      }
    };

    const handleMessagesRead = (data) => {
      fetchAllUnreadCounts();
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
    };

    // Attach listeners
    socket.on("connect", handleConnect);
    socket.on("unread_update", handleUnreadUpdate);
    socket.on("unread_notes_update", handleUnreadNotesUpdate);
    socket.on("new_message", handleNewMessage);
    socket.on("messages_read", handleMessagesRead);
    socket.on("disconnect", handleDisconnect);
    socket.on("new_lead_global", handleLeadsChange);
    socket.on("lead_changed_global", handleLeadsChange);

    // If socket is already connected when this component mounts, run logic manually
    if (socket.connected) {
      handleConnect();
    }

    // Cleanup ONLY these specific functions
    return () => {
      socket.off("connect", handleConnect);
      socket.off("unread_update", handleUnreadUpdate);
      socket.off("unread_notes_update", handleUnreadNotesUpdate);
      socket.off("new_message", handleNewMessage);
      socket.off("messages_read", handleMessagesRead);
      socket.off("disconnect", handleDisconnect);
      socket.off("new_lead_global", handleLeadsChange);
      socket.off("lead_changed_global", handleLeadsChange);
      clearTimeout(leadsTimer);
    };
  }, [token, currentUserId]);

  // Poll as fallback when socket is disconnected or initial load not done
  useEffect(() => {
    // Only start polling if we have token
    if (!token) return;
    
    const interval = setInterval(() => {
      if (!socketConnected || !initialLoadDone) {
        console.log("Polling for unread counts...");
        fetchAllUnreadCounts();
        fetchUnreadNotesCount();
        fetchNewLeadsCount();
      }
    }, 15000); // Poll every 15 seconds as fallback
    
    return () => clearInterval(interval);
  }, [token, socketConnected, initialLoadDone]);

  // 🔥 Instantly clear the badge when they open the page
  useEffect(() => {
    if (location.pathname.includes('/notes')) {
      setUnreadNotesCount(0);
      // We also trigger a fetch just to sync the backend
      fetchUnreadNotesCount(); 
    }
  }, [location.pathname]);

  // Track the desktop breakpoint
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange);
    };
  }, []);

  // Close the phone drawer after navigating
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Drawer open: close on Escape and lock background scroll
  useEffect(() => {
    if (!isMobileOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setIsMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isMobileOpen]);

  // Updated Role-based navigation configuration with MessengerIconWithBadge
  const roleNavigation = {
    superadmin: [
      { path: "/dashboard/superadmin", label: "Overview", icon: DashboardIcon },
      { path: "/dashboard/superadmin/centremanagement", label: "Centre Management", icon: CentreIcon },
      { path: "/dashboard/superadmin/calendar", label: "Calendar", icon: EventsIcon },
      { path: "/dashboard/superadmin/notes", label: "Notes", icon: NotesIconWithBadge },
      { path: "/dashboard/superadmin/staffmanagement", label: "Staff Management", icon: UsersIcon },
      { path: "/dashboard/superadmin/walletmanagement", label: "Wallets", icon: WalletIcon },
      { path: "/dashboard/superadmin/servicemanagement", label: "Service Management", icon: ServicesIcon },
      { path: "/dashboard/superadmin/servicelogs", label: "Service Logs", icon: ServiceLogsIcon },
      { path: "/dashboard/superadmin/attendance", label: "Salary Calculations", icon: SalaryIcon },
      { path: "/dashboard/superadmin/expensemanagement", label: "Expense Management", icon: ExpenseManagementIcon },
      { path: "/dashboard/superadmin/teams", label: "Teams", icon: TeamIcon },
      { path: "/dashboard/superadmin/notifications", label: "Notifications", icon: NotificationsIconWithBadge },
      { path: "/dashboard/superadmin/leads", label: "Leads", icon: LeadsIconWithBadge },
      { path: "/dashboard/superadmin/messenger", label: "Messenger", icon: MessengerIconWithBadge },
      { path: "/dashboard/superadmin/operationshub", label: "Knowledge Hub", icon: KnowledgeHubIcon },
      { path: "/dashboard/superadmin/campaigns", label: "Campaigns", icon: CampaignIcon },
      { path: "/dashboard/superadmin/reports", label: "Reports", icon: ReportsIcon },
      { path: "/dashboard/superadmin/analytics", label: "Analytics", icon: AnalyticsIcon },
      { path: "/dashboard/superadmin/settings", label: "Settings", icon: SettingsIcon }
    ],
    
    admin: [
      { path: "/dashboard/admin", label: "Overview", icon: DashboardIcon },
      { path: "/dashboard/admin/calendar", label: "Calendar", icon: EventsIcon },
      { path: "/dashboard/admin/notes", label: "Notes", icon: NotesIconWithBadge },
      { path: "/dashboard/admin/staff", label: "Staff Management", icon: UsersIcon },
      { path: "/dashboard/admin/wallets", label: "Wallets", icon: WalletIcon },
      { path: "/dashboard/admin/services", label: "Service Management", icon: ServicesIcon },
      { path: "/dashboard/admin/servicelogs", label: "Service Logs", icon: ServiceLogsIcon },
      { path: "/dashboard/admin/token", label: "Token Generator", icon: TokenGeneratorIcon },
      { path: "/dashboard/admin/attendancemanagement", label: "Salary Calculations", icon: SalaryIcon },
      { path: "/dashboard/admin/expensemanagement", label: "Expense Management", icon: ExpenseManagementIcon },
      { path: "/dashboard/admin/notifications", label: "Notifications", icon: NotificationsIconWithBadge },
      { path: "/dashboard/admin/leads", label: "Leads", icon: LeadsIconWithBadge },
      { path: "/dashboard/admin/messenger", label: "Messenger", icon: MessengerIconWithBadge },
      { path: "/dashboard/admin/operationshub", label: "Knowledge Hub", icon: KnowledgeHubIcon },
      { path: "/dashboard/admin/teams", label: "Teams", icon: TeamIcon },
      { path: "/dashboard/admin/campaigns", label: "Campaigns", icon: CampaignIcon },
      { path: "/dashboard/admin/reports", label: "Reports", icon: ReportsIcon },
      { path: "/dashboard/admin/analytics", label: "Analytics", icon: AnalyticsIcon },
      { path: "/dashboard/admin/settings", label: "Settings", icon: SettingsIcon }
    ],
    staff: [
      { path: "/dashboard/staff", label: "My Dashboard", icon: DashboardIcon },
      { path: "/dashboard/staff/calendar", label: "Calendar", icon: CalendarIcon },
      { path: "/dashboard/staff/tasks", label: "My Tasks", icon: TasksIcon },
      { path: "/dashboard/staff/notes", label: "Notes", icon: NotesIconWithBadge },
      { path: "/dashboard/staff/performance", label: "Performance", icon: ChartIcon },
      { path: "/dashboard/staff/attendance", label: "Salary & Attendance", icon: SalaryAttendanceIcon },
      { path: "/dashboard/staff/service_entry", label: "Service Entry", icon: ServiceEntryIcon },
      { path: "/dashboard/staff/leads", label: "Leads", icon: LeadsIconWithBadge },
      { path: "/dashboard/staff/expense_entry", label: "Expense Entry", icon: ExpenseEntryIcon },
      { path: "/dashboard/staff/pending_payments", label: "Pending Payments", icon: PendingPaymentIcon },
      { path: "/dashboard/staff/notifications", label: "Notifications", icon: NotificationsIconWithBadge }, 
      { path: "/dashboard/staff/teams", label: "My Team", icon: TeamIcon },
      { path: "/dashboard/staff/messenger", label: "Messenger", icon: MessengerIconWithBadge },
      { path: "/dashboard/staff/operationshub", label: "Knowledge Hub", icon: KnowledgeHubIcon },
      { path: "/dashboard/staff/token", label: "Token Generator", icon: TokenGeneratorIcon },
      { path: "/dashboard/staff/campaigns", label: "Campaigns", icon: CampaignIcon },
      { path: "/dashboard/staff/track_service", label: "Track Service", icon: TrackServiceIcon },
      { path: "/dashboard/staff/customers", label: "Customers Profile", icon: CustomersIcon }
    ],
    supervisor: [
      { path: "/dashboard/supervisor", label: "Team Overview", icon: DashboardIcon },
      { path: "/dashboard/supervisor/team", label: "My Team", icon: TeamIcon },
      { path: "/dashboard/supervisor/approvals", label: "Approvals", icon: ApprovalIcon },
      { path: "/dashboard/supervisor/reports", label: "Reports", icon: ReportsIcon },
      { path: "/dashboard/supervisor/analytics", label: "Analytics", icon: AnalyticsIcon }
    ],
    customer: [
      { path: "/customer/dashboard", label: "Home", icon: DashboardIcon },
      { path: "/customer/myservices", label: "My Services", icon: ServicesIcon },
      { path: "/customer/mydocuments", label: "My Documents", icon: ServiceLogsIcon },
      { path: "/customer/myprofile", label: "Profile", icon: ProfileIcon }
    ]
  };

  // Get user-specific navigation
  const userNavigation = roleNavigation[role] || [];

  // Role display names
  const roleDisplayNames = {
    superadmin: staffName || "Super Admin",
    admin: staffName || "Administrator",
    staff: staffName || "Staff Member",
    supervisor: staffName || "Supervisor",
    customer: customerName
  };

  const toggleSidebar = () => {
    setCollapsedPref(!collapsedPref);
  };

  const handleNavigation = (path) => {
    setActivePath(path);
  };

  // Group the menu into sections (display only; routes and labels are unchanged)
  const sectionByLabel = {
    "Overview": "Main", "My Dashboard": "Main", "Team Overview": "Main", "Home": "Main",
    "Calendar": "Workspace", "My Tasks": "Workspace", "Notes": "Workspace", "Messenger": "Workspace",
    "Notifications": "Workspace", "Knowledge Hub": "Workspace",
    "Service Entry": "Operations", "Track Service": "Operations", "Service Logs": "Operations",
    "Service Management": "Operations", "Token Generator": "Operations", "Pending Payments": "Operations",
    "Leads": "Operations", "Campaigns": "Operations", "Customers Profile": "Operations",
    "My Services": "Operations", "My Documents": "Operations", "Approvals": "Operations",
    "Staff Management": "People", "Teams": "People", "My Team": "People", "Centre Management": "People",
    "Salary Calculations": "People", "Salary & Attendance": "People", "Performance": "People",
    "Wallets": "Money", "Expense Management": "Money", "Expense Entry": "Money",
    "Reports": "Insights", "Analytics": "Insights",
    "Settings": "System", "Profile": "System"
  };
  const sectionOrder = ["Main", "Workspace", "Operations", "People", "Money", "Insights", "System"];
  const navSections = sectionOrder
    .map((name) => ({
      name,
      items: userNavigation.filter((item) => (sectionByLabel[item.label] || "Main") === name)
    }))
    .filter((section) => section.items.length > 0);
  const showSectionTitles = userNavigation.length > 6;

  const notificationsItem = userNavigation.find((item) => item.label === "Notifications");
  const jumpMatches = jumpQuery.trim()
    ? userNavigation.filter((item) => item.label.toLowerCase().includes(jumpQuery.trim().toLowerCase())).slice(0, 6)
    : [];
  const goTo = (path) => {
    navigate(path);
    setJumpQuery("");
    setJumpOpen(false);
    jumpRef.current?.blur();
  };
  const quickTokenItem = userNavigation.find((item) => item.label === "Token Generator");
  // Notification / event strip in the top bar (desktop only; not for customers or supervisors)
  const showTicker = ["staff", "admin", "superadmin"].includes(role) && !!notificationsItem;
  const quickEntryItem = userNavigation.find((item) => item.label === "Service Entry");
  const userInitials = String(roleDisplayNames[role] || "U").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  // Staff photo (same source as the Staff Dashboard); initials are the fallback
  const rawPhoto = localStorage.getItem("photo");
  const profilePhoto =
    role !== "customer" && rawPhoto && rawPhoto !== "null" && rawPhoto !== "undefined"
      ? (rawPhoto.startsWith("http") || rawPhoto.startsWith("data:image") ? rawPhoto : `${API_BASE_URL}${rawPhoto}`)
      : "";

  // Single-key shortcuts: T = Track Service, S = Service Entry (ignored while typing or with Ctrl/Alt/Cmd held)
  const trackPath = userNavigation.find((item) => item.label === "Track Service")?.path;
  const entryPath = quickEntryItem?.path;
  useEffect(() => {
    if (!trackPath && !entryPath) return undefined;
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.repeat) return;
      const el = e.target;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return;
      const k = String(e.key).toLowerCase();
      if (k === "t" && trackPath) { e.preventDefault(); navigate(trackPath); }
      if (k === "s" && entryPath) { e.preventDefault(); navigate(entryPath); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [trackPath, entryPath, navigate]);

  // Unread total in the browser tab title, e.g. "(3) Akshaya Sahayi" (same total as the phone menu dot)
  const unreadTotal = role === "customer" ? 0 : (unreadCount || 0) + (unreadNotesCount || 0) + (notificationsCount || 0) + (newLeadsCount || 0);
  const baseTitleRef = useRef(null);
  useEffect(() => {
    if (baseTitleRef.current === null) baseTitleRef.current = document.title.replace(/^\(\d+\+?\)\s*/, "");
    const base = baseTitleRef.current;
    document.title = unreadTotal > 0 ? `(${unreadTotal > 99 ? "99+" : unreadTotal}) ${base}` : base;
  }, [unreadTotal, location.pathname]);
  useEffect(() => () => { if (baseTitleRef.current !== null) document.title = baseTitleRef.current; }, []);

  return (
    <div className="flex min-h-screen min-h-dvh bg-slate-50">
      {/* Phone: dimmed backdrop behind the open drawer */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar with original navy blue colors (off-canvas drawer on phones) */}
      <aside 
        id="app-sidebar"
        className={`bg-slate-50 text-slate-700 p-2 gap-2 fixed top-0 left-0 bottom-0 h-screen h-dvh flex flex-col transition-all duration-300 z-50 w-64 max-w-[85vw] ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 md:max-w-none ${
          isCollapsed ? "md:w-20" : "md:w-64"
        }`}
      >
        {/* Header Section */}
        <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${isCollapsed ? "p-2" : "p-3"}`}>
          
          <div className={`relative flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
            <div className="flex items-center">
              <div className="bg-navy-700 text-white p-2 rounded-xl">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 21V5C16 4.46957 15.7893 3.96086 15.4142 3.58579C15.0391 3.21071 14.5304 3 14 3H10C9.46957 3 8.96086 3.21071 8.58579 3.58579C8.21071 3.96086 8 4.46957 8 5V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              {!isCollapsed && (
                <div className="ml-3">
                  <h1 className="text-base font-semibold text-slate-900">
                    {role === "customer" ? "Client Suite" : "Office Suite"}
                  </h1>
                  <p className="text-slate-500 text-xs">
                    {role === "customer" ? "Service Portal" : "Management Portal"}
                  </p>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <button
                onClick={toggleSidebar}
                className="hidden md:block p-2 rounded-lg transition duration-200 text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                title="Collapse Sidebar"
              >
                <CollapseIcon />
              </button>
            )}
            <button
              onClick={() => setIsMobileOpen(false)}
              className="md:hidden grid h-11 w-11 place-items-center rounded-lg transition duration-200 text-slate-400 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Close menu"
            >
              <CloseIcon />
            </button>
          </div>
          {isCollapsed && (
            <div className="mt-3 flex justify-center">
              <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full text-xs font-semibold bg-navy-500/10 text-navy-700"><UserAvatar photo={profilePhoto} initials={userInitials} /></span>
            </div>
          )}
          {!isCollapsed && (
            <div className="relative mt-3 flex items-center gap-2.5 rounded-xl p-2 bg-slate-50 border border-slate-200">
              <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-semibold bg-navy-500/10 text-navy-700"><UserAvatar photo={profilePhoto} initials={userInitials} /></span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-semibold text-slate-900">{roleDisplayNames[role] || "User"}</p>
                <p className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-500">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"></span>
                  {role === "customer" ? "Customer" : (
                    <>
                      <span>Online</span>
                      <span className="text-slate-300">•</span>
                      <span className="truncate font-medium text-navy-700">
                        {{ superadmin: "Super Admin", admin: "Admin", staff: "Staff", supervisor: "Supervisor" }[role] || role}
                      </span>
                    </>
                  )}
                </p>
                {role === "admin" && centreName && (
                  <p className="truncate text-[11px] text-slate-500" title={centreName}>{centreName}</p>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Navigation Section - Custom scrollbar */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar rounded-2xl border border-slate-200 bg-white py-2 shadow-sm">
          <nav className={isCollapsed ? "px-2" : "px-3"} aria-label="Main navigation">
            {navSections.map((section) => (
              <div key={section.name} className={showSectionTitles ? "mb-2" : ""}>
                {showSectionTitles && !isCollapsed && (
                  <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{section.name}</p>
                )}
                {showSectionTitles && isCollapsed && (
                  <div className="mx-3 my-2 border-t border-slate-200"></div>
                )}
                <div className="space-y-0.5">
            {section.items.map((item) => {
              const index = userNavigation.indexOf(item);
              const isActive = activePath === item.path;
              const IconComponent = item.icon;
              const isMessenger = item.label === "Messenger";
              const isNotes = item.label === "Notes";
              const isNotifications = item.label === "Notifications";
              const isLeads = item.label === "Leads";
              
              return (
                <Link 
                  key={index}
                  to={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={`flex items-center rounded-xl transition-all duration-200 group relative ${
                    isCollapsed ? "justify-center p-3" : "px-3 py-2.5"
                  } ${
                    isActive 
                      ? "bg-navy-700 text-white shadow-sm" 
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                  title={isCollapsed ? item.label : ""}
                >
                  <div className={`transition-transform duration-200 relative ${
                    isActive ? "scale-110" : "group-hover:scale-105"
                  } ${isCollapsed ? "w-6 h-6" : "w-5 h-5"}`}>
                    <IconComponent 
                      isActive={isActive} 
                      isCollapsed={isCollapsed} 
                      unreadCount={
                        isMessenger ? unreadCount : 
                        isNotes ? unreadNotesCount : 
                        isNotifications ? notificationsCount :
                        isLeads ? newLeadsCount : 0 
                      }
                    />
                  </div>
                  {!isCollapsed && (
                    <span className={`ml-3 font-medium transition-all duration-200 ${
                      isActive ? "text-white" : "text-slate-600 group-hover:text-slate-900"
                    }`}>
                      {item.label}
                    </span>
                  )}

                  {/* Enhanced Tooltip */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-3 px-3 py-2 bg-slate-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap z-10 shadow-lg">
                      {item.label}
                      
                      {/* Messenger Badge */}
                      {isMessenger && unreadCount > 0 && (
                        <span className="ml-2 bg-red-500 px-1.5 py-0.5 rounded-full text-xs">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                      
                      {/* 🔥 ADDED: Notes Badge */}
                      {isNotes && unreadNotesCount > 0 && (
                        <span className="ml-2 bg-red-500 px-1.5 py-0.5 rounded-full text-xs">
                          {unreadNotesCount > 99 ? '99+' : unreadNotesCount}
                        </span>
                      )}

                      {isLeads && newLeadsCount > 0 && (
                        <span className="ml-2 bg-red-500 px-1.5 py-0.5 rounded-full text-xs">
                          {newLeadsCount > 99 ? '99+' : newLeadsCount}
                        </span>
                      )}

                      {/* 🔥 ADDED: Notifications Badge */}
                      {isNotifications && notificationsCount > 0 && (
                        <span className="ml-2 bg-red-500 px-1.5 py-0.5 rounded-full text-xs">
                          {notificationsCount > 99 ? '99+' : notificationsCount}
                        </span>
                      )}

                      <div className="absolute right-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-2 border-b-2 border-l-0 border-r-2 border-r-slate-900 border-transparent"></div>
                    </div>
                  )}
                  {!isCollapsed && isActive && (
                    <div className="absolute right-3 w-2 h-2 bg-white/70 rounded-full"></div>
                  )}
                </Link>
              );
            })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Common Actions Section */}
        <div className={`rounded-2xl border border-slate-200 bg-white py-2 shadow-sm ${isCollapsed ? "px-2" : "px-3"}`}>
          <nav className="space-y-1">
            <ThemeToggle collapsed={isCollapsed} />
            <Link
              to="/dashboard/my-profile"   // Changed from "/dashboard/profile" to the unified profile route
              onClick={() => handleNavigation("/dashboard/my-profile")}
              className={`flex items-center rounded-xl transition-all duration-200 group relative ${
                isCollapsed ? "justify-center p-3" : "px-3 py-2.5"
              } ${
                activePath === "/dashboard/my-profile"
                  ? "bg-navy-700 text-white shadow-sm" 
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
              title={isCollapsed ? "My Profile" : ""}
            >
              <div className={isCollapsed ? "w-6 h-6" : "w-5 h-5"}>
                <ProfileIcon isActive={activePath === "/dashboard/my-profile"} isCollapsed={isCollapsed} />
              </div>
              {!isCollapsed && (
                <span className={`ml-3 font-medium ${
                  activePath === "/dashboard/my-profile" ? "text-white" : "text-slate-600"
                }`}>
                  My Profile
                </span>
              )}
              {isCollapsed && (
                <div className="absolute left-full ml-3 px-3 py-2 bg-slate-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap shadow-lg">
                  My Profile
                  <div className="absolute right-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-2 border-b-2 border-l-0 border-r-2 border-r-slate-900 border-transparent"></div>
                </div>
              )}
            </Link>

            <Link 
              to="/logout"
              className={`flex items-center rounded-xl transition-all duration-200 group relative ${
                isCollapsed ? "justify-center p-3" : "px-3 py-2.5"
              } text-slate-600 hover:bg-slate-100 hover:text-slate-900`}
              title={isCollapsed ? "Logout" : ""}
            >
              <div className={isCollapsed ? "w-6 h-6" : "w-5 h-5"}>
                <LogoutIcon isActive={false} isCollapsed={isCollapsed} />
              </div>
              {!isCollapsed && <span className="ml-3 font-medium">Logout</span>}
              {isCollapsed && (
                <div className="absolute left-full ml-3 px-3 py-2 bg-slate-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap shadow-lg">
                  Logout
                  <div className="absolute right-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-2 border-b-2 border-l-0 border-r-2 border-r-slate-900 border-transparent"></div>
                </div>
              )}
            </Link>
          </nav>
        </div>
        
        {/* Footer Section */}
        <div className="pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          {/* Toggle Button for collapsed state */}
          {isCollapsed && (
            <button
              onClick={toggleSidebar}
              className="w-full flex items-center justify-center p-3 rounded-2xl border border-slate-200 bg-white shadow-sm hover:bg-slate-100 transition duration-200 text-slate-500 hover:text-slate-900"
              title="Expand Sidebar"
            >
              <ExpandIcon />
            </button>
          )}

          {!isCollapsed && (
            <div className="px-4 [@media(max-height:820px)]:hidden">
              <p className="text-slate-400 text-xs text-center">© 2026 Business Management System</p>
              <p className="text-slate-400 text-xs text-center mt-1">All rights reserved</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={`flex-1 min-w-0 flex flex-col transition-all duration-300 ml-0 ${
          isCollapsed ? "md:ml-20" : "md:ml-64"
        }`}
      >
        {/* Top bar: menu button on phones, jump-to-page search, quick actions, notifications, profile */}
        <div className="sticky top-0 z-30 bg-slate-50 px-2 pb-2 pt-2 sm:px-4 sm:pt-4 md:px-6">
        <header className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:px-4">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="md:hidden relative grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-600 hover:bg-slate-100"
            aria-label="Open menu"
            aria-expanded={isMobileOpen}
            aria-controls="app-sidebar"
          >
            <MenuIcon />
            {(unreadCount + unreadNotesCount + (notificationsCount || 0) + newLeadsCount) > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white"></span>
            )}
          </button>

          <div className={`relative min-w-0 flex-1 max-w-md ${showTicker ? "xl:max-w-[240px]" : ""}`}>
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4-4M11 18a7 7 0 110-14 7 7 0 010 14z" />
            </svg>
            <input
              ref={jumpRef}
              type="text"
              value={jumpQuery}
              onChange={(e) => { setJumpQuery(e.target.value); setJumpOpen(true); }}
              onFocus={() => setJumpOpen(true)}
              onBlur={() => setTimeout(() => setJumpOpen(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && jumpMatches[0]) goTo(jumpMatches[0].path);
                if (e.key === "Escape") { setJumpQuery(""); e.currentTarget.blur(); }
              }}
              placeholder="Jump to page…"
              aria-label="Jump to page"
              className="min-h-[44px] w-full rounded-xl border border-transparent bg-slate-100 py-2 pl-9 pr-3 text-base focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/30 sm:text-sm md:pr-14"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded bg-white px-1.5 py-0.5 text-[11px] text-slate-400 md:block">Ctrl K</span>
            {jumpOpen && jumpMatches.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                {jumpMatches.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => goTo(item.path)}
                    className="flex min-h-[40px] w-full items-center rounded-lg px-3 text-left text-sm text-slate-700 hover:bg-slate-100"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {showTicker && (
            <HeaderTicker
              token={token}
              apiBase={API_BASE_URL}
              unreadSignal={notificationsCount}
              notificationsPath={notificationsItem?.path}
              navigate={navigate}
            />
          )}

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            {quickTokenItem && (
              <Link
                to={quickTokenItem.path}
                className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-navy-700 px-3 text-sm font-medium text-white transition-colors hover:bg-navy-800"
                title="New Token"
              >
                <span className="text-lg leading-none">+</span>
                <span className="hidden lg:inline">New Token</span>
              </Link>
            )}
            {quickEntryItem && (
              <Link
                to={quickEntryItem.path}
                className="hidden h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-navy-700 transition-colors hover:bg-slate-50 sm:inline-flex"
                title="Service Entry (S)"
              >
                <span className="text-lg leading-none">+</span>
                <span className="hidden lg:inline">Service Entry</span>
              </Link>
            )}
            {notificationsItem && (
              <Link
                to={notificationsItem.path}
                className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Notifications"
              >
                <NotificationsIcon />
                {notificationsCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] leading-[18px] text-center border-2 border-white">
                    {notificationsCount > 99 ? '99+' : notificationsCount}
                  </span>
                )}
              </Link>
            )}
          </div>
        </header>
        </div>

        {/* Hidden scrollbar */}
        <main className="flex-1 min-w-0 overflow-auto main-content-scrollbar">
          <div className="px-2 pb-2 sm:px-4 sm:pb-4 md:px-6 md:pb-6">
            <div className="bg-white rounded-2xl shadow-sm p-3 sm:p-5 md:p-6 min-h-full border border-slate-200">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
      
      {/* Color definitions and custom scrollbar styles */}
      <style>{`
        .bg-navy-800 { background-color: #172a45; }
        .bg-navy-700 { background-color: #1e3a5f; }
        .border-navy-700 { border-color: #1e3a5f; }
        .text-blue-200 { color: #bfdbfe; }
        
        /* Sidebar scrollbar - hidden by default, shows on hover */
        .custom-scrollbar {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE and Edge */
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 0px;
          background: transparent; /* Chrome, Safari, Opera */
        }
        
        .custom-scrollbar:hover::-webkit-scrollbar {
          width: 6px;
        }
        
        .custom-scrollbar:hover::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        
        .custom-scrollbar:hover::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        
        .header-ticker-fade { animation: headerTickerFade 0.35s ease-out; }
        @keyframes headerTickerFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .header-ticker-fade { animation: none; } }

        /* Main content scrollbar - completely hidden */
        .main-content-scrollbar {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE and Edge */
        }
        
        .main-content-scrollbar::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }
      `}</style>
    </div>
  );
};

// ---- Top bar strip: rotates through your recent unread notifications ----
const timeAgoShort = (value) => {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};
const HeaderTicker = ({ token, apiBase, unreadSignal, notificationsPath, navigate }) => {
  const [notifs, setNotifs] = useState([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // recent notifications (same route as the Notifications page)
  useEffect(() => {
    if (!token || !apiBase) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/notifications?limit=20`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : Array.isArray(data?.notifications) ? data.notifications : [];
        if (!cancelled) setNotifs(list);
      } catch { /* the strip simply stays empty */ }
    })();
    return () => { cancelled = true; };
  }, [token, apiBase, unreadSignal]);

  useEffect(() => {
    const onNew = (n) => setNotifs((prev) => [n, ...prev.filter((x) => x.id !== n.id)]);
    const onUpd = (n) => setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, ...n } : x)));
    socket.on("notification", onNew);
    socket.on("notification_updated", onUpd);
    return () => { socket.off("notification", onNew); socket.off("notification_updated", onUpd); };
  }, []);

  const items = React.useMemo(() => {
    const sorted = [...notifs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const unread = sorted.filter((n) => !n.is_read).slice(0, 4);
    const noteItems = (unread.length ? unread : sorted.slice(0, 2)).map((n) => ({
      key: `n${n.id}`,
      title: n.title || "Notification",
      meta: [n.sender_name, timeAgoShort(n.created_at)].filter(Boolean).join(" · "),
    }));
    return noteItems;
  }, [notifs]);

  useEffect(() => { if (index >= items.length) setIndex(0); }, [items.length, index]);
  useEffect(() => {
    if (paused || items.length < 2) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), 5000);
    return () => clearInterval(t);
  }, [paused, items.length]);

  if (items.length === 0) return <div className="hidden min-w-0 flex-1 xl:block" />;
  const item = items[Math.min(index, items.length - 1)];
  const go = () => { if (notificationsPath) navigate(notificationsPath); };

  return (
    <div className="hidden min-w-0 flex-1 xl:block" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <button
        type="button"
        onClick={go}
        className="flex h-11 w-full min-w-0 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-left transition-colors hover:bg-slate-100"
        title={`${item.title} — ${item.meta}`}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-navy-500/10 text-navy-700">
          <span className="block h-4 w-4 [&>svg]:h-4 [&>svg]:w-4"><NotificationsIcon /></span>
        </span>
        <span key={item.key} className="header-ticker-fade flex min-w-0 flex-1 items-baseline gap-2">
          <span className="truncate text-sm font-medium text-slate-900">{item.title}</span>
          <span className="shrink-0 whitespace-nowrap text-xs text-slate-500">{item.meta}</span>
        </span>
        {items.length > 1 && (
          <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
            {items.map((it, i) => (
              <span key={it.key} className={`h-1.5 rounded-full transition-all ${i === index ? "w-3 bg-navy-700" : "w-1.5 bg-slate-300"}`} />
            ))}
          </span>
        )}
      </button>
    </div>
  );
};

// Staff photo when there is one, otherwise the initials
const UserAvatar = ({ photo, initials }) => {
  const [failed, setFailed] = useState(false);
  if (photo && !failed) {
    return <img src={photo} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />;
  }
  return <>{initials}</>;
};

// Toggle Icons
const CollapseIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const MenuIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const ExpandIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

// Icon Factory
const createIcon = (paths) => ({ isActive = false, isCollapsed = false }) => (
  <svg 
    className={isCollapsed ? "w-6 h-6" : "w-5 h-5"} 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2.2 : 1.8} d={paths} />
  </svg>
);

// Messenger Icon with Badge (special component that shows unread count)
const MessengerIconWithBadge = ({ isActive = false, isCollapsed = false, unreadCount = 0 }) => (
  <div className="relative inline-block">
    <svg 
      className={isCollapsed ? "w-6 h-6" : "w-5 h-5"} 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2.2 : 1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
    {unreadCount > 0 && (
      <span className={`absolute ${
        isCollapsed ? '-top-2 -right-2' : '-top-2 -right-3'
      } bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] 
      flex items-center justify-center px-1 border-2 border-white z-10`}>
        {unreadCount > 99 ? '99+' : unreadCount}
      </span>
    )}
  </div>
);

// Notes Icon with Badge
const NotesIconWithBadge = ({ isActive = false, isCollapsed = false, unreadCount = 0 }) => (
  <div className="relative inline-block">
    <svg 
      className={isCollapsed ? "w-6 h-6" : "w-5 h-5"} 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      {/* This is the exact path from your NotesIcon */}
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2.2 : 1.8} d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" />
    </svg>
    {unreadCount > 0 && (
      <span className={`absolute ${
        isCollapsed ? '-top-2 -right-2' : '-top-2 -right-3'
      } bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] 
      flex items-center justify-center px-1 border-2 border-white z-10`}>
        {unreadCount > 99 ? '99+' : unreadCount}
      </span>
    )}
  </div>
);

// Notifications Icon with Badge
const NotificationsIconWithBadge = ({ isActive = false, isCollapsed = false, unreadCount = 0 }) => (
  <div className="relative inline-block">
    <svg 
      className={isCollapsed ? "w-6 h-6" : "w-5 h-5"} 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2.2 : 1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
    {unreadCount > 0 && (
      <span className={`absolute ${
        isCollapsed ? '-top-2 -right-2' : '-top-2 -right-3'
      } bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] 
      flex items-center justify-center px-1 border-2 border-white z-10`}>
        {unreadCount > 99 ? '99+' : unreadCount}
      </span>
    )}
  </div>
);

// Leads Icon with Badge (new leads waiting for a reply)
const LeadsIconWithBadge = ({ isActive = false, isCollapsed = false, unreadCount = 0 }) => (
  <div className="relative inline-block">
    <svg
      className={isCollapsed ? "w-6 h-6" : "w-5 h-5"}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2.2 : 1.8} d="M3 4h18l-7 8.5V19l-4 2v-8.5L3 4z" />
    </svg>
    {unreadCount > 0 && (
      <span className={`absolute ${
        isCollapsed ? '-top-2 -right-2' : '-top-2 -right-3'
      } bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px]
      flex items-center justify-center px-1 border-2 border-white z-10`}>
        {unreadCount > 99 ? '99+' : unreadCount}
      </span>
    )}
  </div>
);

// Icon Definitions
const DashboardIcon = createIcon("M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6");
const EventsIcon = createIcon(`M8 7V3m8 4V3m-9 8h10 M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z M12 16h.01 M12 12h.01 M12 20h.01`);
const CentreIcon = createIcon("M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4");
const UsersIcon = createIcon("M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z");
const WalletIcon = createIcon("M3 10h18M7 15h1m2 0h1m-1 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z");
const ServicesIcon = createIcon("M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z");
const SalaryIcon = createIcon("M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z");
const SalaryAttendanceIcon = createIcon("M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z M12 11v5m0 0l-2-2m2 2l2-2");
const ExpenseManagementIcon = createIcon("M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2M8 4v2h8V4M8 4a2 2 0 012-2h4a2 2 0 012 2 M12 8v8 M10 10l2-2 2 2 M10 14l2 2 2-2");
const CampaignIcon = createIcon("M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z");
const SettingsIcon = createIcon("M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z");
const ReportsIcon = createIcon("M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z");
const TasksIcon = createIcon("M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2");
const NotesIcon = createIcon(`M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8`);
const CalendarIcon = createIcon("M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z");
const ChartIcon = createIcon("M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z");
const TeamIcon = createIcon("M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z");
const ApprovalIcon = createIcon("M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z");
const AnalyticsIcon = createIcon("M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z");
const ProfileIcon = createIcon("M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z");
const LogoutIcon = createIcon("M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1");
const ServiceEntryIcon = createIcon("M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z");
const ExpenseEntryIcon = createIcon("M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z");
const PendingPaymentIcon = createIcon("M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15h-2v-2h2v2zm0-4h-2V7h2v6zM9.5 10.5h5v2h-5z");
const NotificationsIcon = createIcon("M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9");
const TokenGeneratorIcon = createIcon("M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z");
const TrackServiceIcon = createIcon("M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7");
const CustomersIcon = createIcon("M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z");
const ServiceLogsIcon = createIcon("M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01");
const KnowledgeHubIcon = createIcon("M12 2a7 7 0 00-4 12.74V17a1 1 0 001 1h6a1 1 0 001-1v-2.26A7 7 0 0012 2zm-2 18h4m-3 2h2");
export default DashboardLayout;