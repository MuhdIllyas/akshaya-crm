import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from "react-router-dom";
import { socket } from '@/services/socket';

const DashboardLayout = () => {
  const role = localStorage.getItem("role");
  const staffName = localStorage.getItem("name");
  const customerName = localStorage.getItem("customer_name");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activePath, setActivePath] = useState(window.location.pathname);
  const location = useLocation();
  const token = localStorage.getItem("token");
  
  // Add state for conversations and unread count
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadNotesCount, setUnreadNotesCount] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

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

  // Initial fetch on component mount
  useEffect(() => {
    if (token && currentUserId) {
      fetchAllUnreadCounts();
      fetchUnreadNotesCount();
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
      }
    }, 15000); // Poll every 15 seconds as fallback
    
    return () => clearInterval(interval);
  }, [token, socketConnected, initialLoadDone]);

  // Updated Role-based navigation configuration with MessengerIconWithBadge
  const roleNavigation = {
    superadmin: [
      { path: "/dashboard/superadmin", label: "Overview", icon: DashboardIcon },
      { path: "/dashboard/superadmin/centremanagement", label: "Centre Management", icon: CentreIcon },
      { path: "/dashboard/superadmin/calendar", label: "Calendar", icon: EventsIcon },
      { path: "/dashboard/superadmin/staffmanagement", label: "Staff Management", icon: UsersIcon },
      { path: "/dashboard/superadmin/walletmanagement", label: "Wallets", icon: WalletIcon },
      { path: "/dashboard/superadmin/servicemanagement", label: "Service Management", icon: ServicesIcon },
      { path: "/dashboard/superadmin/servicelogs", label: "Service Logs", icon: ServiceLogsIcon },
      { path: "/dashboard/superadmin/attendance", label: "Salary Calculations", icon: SalaryIcon },
      { path: "/dashboard/superadmin/expensemanagement", label: "Expense Management", icon: ExpenseManagementIcon },
      { path: "/dashboard/superadmin/teams", label: "Teams", icon: TeamIcon },
      { path: "/dashboard/superadmin/messenger", label: "Messenger", icon: MessengerIconWithBadge },
      { path: "/dashboard/superadmin/campaigns", label: "Campaigns", icon: CampaignIcon },
      { path: "/dashboard/superadmin/settings", label: "Settings", icon: SettingsIcon },
      { path: "/dashboard/superadmin/reports", label: "Reports", icon: ReportsIcon },
      { path: "/dashboard/superadmin/analytics", label: "Analytics", icon: AnalyticsIcon }
    ],
    
    admin: [
      { path: "/dashboard/admin", label: "Overview", icon: DashboardIcon },
      { path: "/dashboard/admin/calendar", label: "Calendar", icon: EventsIcon },
      { path: "/dashboard/admin/staff", label: "Staff Management", icon: UsersIcon },
      { path: "/dashboard/admin/wallets", label: "Wallets", icon: WalletIcon },
      { path: "/dashboard/admin/services", label: "Service Management", icon: ServicesIcon },
      { path: "/dashboard/admin/servicelogs", label: "Service Logs", icon: ServiceLogsIcon },
      { path: "/dashboard/admin/token", label: "Token Generator", icon: TokenGeneratorIcon },
      { path: "/dashboard/admin/attendancemanagement", label: "Salary Calculations", icon: SalaryIcon },
      { path: "/dashboard/admin/expensemanagement", label: "Expense Management", icon: ExpenseManagementIcon },
      { path: "/dashboard/admin/messenger", label: "Messenger", icon: MessengerIconWithBadge },
      { path: "/dashboard/admin/teams", label: "Teams", icon: TeamIcon },
      { path: "/dashboard/admin/campaigns", label: "Campaigns", icon: CampaignIcon },
      { path: "/dashboard/admin/settings", label: "Settings", icon: SettingsIcon },
      { path: "/dashboard/admin/reports", label: "Reports", icon: ReportsIcon },
      { path: "/dashboard/admin/analytics", label: "Analytics", icon: AnalyticsIcon }
    ],
    staff: [
      { path: "/dashboard/staff", label: "My Dashboard", icon: DashboardIcon },
      { path: "/dashboard/staff/calendar", label: "Calendar", icon: CalendarIcon },
      { path: "/dashboard/staff/tasks", label: "My Tasks", icon: TasksIcon },
      { path: "/dashboard/staff/notes", label: "Notes", icon: NotesIconWithBadge },
      { path: "/dashboard/staff/performance", label: "Performance", icon: ChartIcon },
      { path: "/dashboard/staff/attendance", label: "Salary & Attendance", icon: SalaryAttendanceIcon },
      { path: "/dashboard/staff/service_entry", label: "Service Entry", icon: ServiceEntryIcon },
      { path: "/dashboard/staff/expense_entry", label: "Expense Entry", icon: ExpenseEntryIcon },
      { path: "/dashboard/staff/pending_payments", label: "Pending Payments", icon: PendingPaymentIcon },
      { path: "/dashboard/staff/messages", label: "Notifications", icon: NotificationsIcon },
      { path: "/dashboard/staff/team", label: "My Team", icon: TeamIcon },
      { path: "/dashboard/staff/messenger", label: "Messenger", icon: MessengerIconWithBadge },
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
    superadmin: "Super Admin",
    admin: "Administrator",
    staff: staffName || "Staff Member",
    supervisor: "Supervisor",
    customer: customerName
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleNavigation = (path) => {
    setActivePath(path);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar with original navy blue colors */}
      <aside 
        className={`bg-navy-800 text-white min-h-screen fixed top-0 left-0 bottom-0 flex flex-col transition-all duration-300 z-50 ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Header Section */}
        <div className={`p-6 border-b border-navy-700 ${isCollapsed ? "px-4" : ""}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="bg-white p-2 rounded-xl shadow-lg">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z" stroke="#172a45" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 21V5C16 4.46957 15.7893 3.96086 15.4142 3.58579C15.0391 3.21071 14.5304 3 14 3H10C9.46957 3 8.96086 3.21071 8.58579 3.58579C8.21071 3.96086 8 4.46957 8 5V21" stroke="#172a45" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              {!isCollapsed && (
                <div className="ml-3">
                  <h1 className="text-xl font-bold text-white">
                    {role === "customer" ? "Client Suite" : "Office Suite"}
                  </h1>
                  <p className="text-blue-200 text-xs">
                    {role === "customer" ? "Service Portal" : "Management Portal"}
                  </p>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-lg hover:bg-navy-700 transition duration-200 text-blue-200 hover:text-white"
                title="Collapse Sidebar"
              >
                <CollapseIcon />
              </button>
            )}
          </div>
          {!isCollapsed && (
            <p className="text-blue-200 text-sm mt-3">
              Hello, {roleDisplayNames[role] || "User"}
            </p>
          )}
        </div>
        
        {/* Navigation Section - Custom scrollbar */}
        <div className="flex-1 py-4 overflow-y-auto custom-scrollbar">
          <nav className="space-y-1 px-3">
            {userNavigation.map((item, index) => {
              const isActive = activePath === item.path;
              const IconComponent = item.icon;
              const isMessenger = item.label === "Messenger";
              const isNotes = item.label === "Notes";
              
              return (
                <Link 
                  key={index}
                  to={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={`flex items-center rounded-xl transition-all duration-200 group relative ${
                    isCollapsed ? "justify-center p-3" : "p-3"
                  } ${
                    isActive 
                      ? "bg-navy-700 text-white border-r-2 border-blue-400 shadow-sm" 
                      : "text-blue-200 hover:bg-navy-700 hover:text-white"
                  }`}
                  title={isCollapsed ? item.label : ""}
                >
                  <div className={`transition-transform duration-200 relative ${
                    isActive ? "scale-110" : "group-hover:scale-105"
                  } ${isCollapsed ? "w-6 h-6" : "w-5 h-5"}`}>
                    <IconComponent 
                      isActive={isActive} 
                      isCollapsed={isCollapsed} 
                      unreadCount={isMessenger ? unreadCount : (isNotes ? unreadNotesCount : 0)}
                    />
                  </div>
                  {!isCollapsed && (
                    <span className={`ml-3 font-medium transition-all duration-200 ${
                      isActive ? "text-white" : "text-blue-200 group-hover:text-white"
                    }`}>
                      {item.label}
                    </span>
                  )}

                  {/* Enhanced Tooltip */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-3 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap z-10 shadow-lg">
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

                      <div className="absolute right-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-2 border-b-2 border-l-0 border-r-2 border-r-gray-900 border-transparent"></div>
                    </div>
                  )}
                  {!isCollapsed && isActive && (
                    <div className="absolute right-3 w-2 h-2 bg-blue-400 rounded-full"></div>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Common Actions Section */}
        <div className="border-t border-navy-700 py-4 px-3">
          <nav className="space-y-1">
            <Link 
              to="/dashboard/my-profile"   // Changed from "/dashboard/profile" to the unified profile route
              onClick={() => handleNavigation("/dashboard/my-profile")}
              className={`flex items-center rounded-xl transition-all duration-200 group relative ${
                isCollapsed ? "justify-center p-3" : "p-3"
              } ${
                activePath === "/dashboard/my-profile"
                  ? "bg-navy-700 text-white border-r-2 border-blue-400 shadow-sm" 
                  : "text-blue-200 hover:bg-navy-700 hover:text-white"
              }`}
              title={isCollapsed ? "My Profile" : ""}
            >
              <div className={isCollapsed ? "w-6 h-6" : "w-5 h-5"}>
                <ProfileIcon isActive={activePath === "/dashboard/my-profile"} isCollapsed={isCollapsed} />
              </div>
              {!isCollapsed && (
                <span className={`ml-3 font-medium ${
                  activePath === "/dashboard/my-profile" ? "text-white" : "text-blue-200"
                }`}>
                  My Profile
                </span>
              )}
              {isCollapsed && (
                <div className="absolute left-full ml-3 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap shadow-lg">
                  My Profile
                  <div className="absolute right-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-2 border-b-2 border-l-0 border-r-2 border-r-gray-900 border-transparent"></div>
                </div>
              )}
            </Link>

            <Link 
              to="/logout"
              className={`flex items-center rounded-xl transition-all duration-200 group relative ${
                isCollapsed ? "justify-center p-3" : "p-3"
              } text-blue-200 hover:bg-navy-700 hover:text-white`}
              title={isCollapsed ? "Logout" : ""}
            >
              <div className={isCollapsed ? "w-6 h-6" : "w-5 h-5"}>
                <LogoutIcon isActive={false} isCollapsed={isCollapsed} />
              </div>
              {!isCollapsed && <span className="ml-3 font-medium">Logout</span>}
              {isCollapsed && (
                <div className="absolute left-full ml-3 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap shadow-lg">
                  Logout
                  <div className="absolute right-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-2 border-b-2 border-l-0 border-r-2 border-r-gray-900 border-transparent"></div>
                </div>
              )}
            </Link>
          </nav>
        </div>
        
        {/* Footer Section */}
        <div className="border-t border-navy-700 py-4">
          {/* Toggle Button for collapsed state */}
          {isCollapsed && (
            <button
              onClick={toggleSidebar}
              className="w-full flex items-center justify-center p-4 hover:bg-navy-700 transition duration-200 text-blue-200 hover:text-white"
              title="Expand Sidebar"
            >
              <ExpandIcon />
            </button>
          )}

          {!isCollapsed && (
            <div className="px-4">
              <p className="text-blue-200 text-xs text-center">© 2025 Business Management System</p>
              <p className="text-blue-200 text-xs text-center mt-1">All rights reserved</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area - Hidden scrollbar */}
      <main 
        className={`flex-1 transition-all duration-300 min-h-screen overflow-auto main-content-scrollbar ${
          isCollapsed ? "ml-20" : "ml-64"
        }`}
      >
        <div className="p-6">
          <div className="bg-white rounded-2xl shadow-sm p-6 min-h-full border border-gray-200">
            <Outlet />
          </div>
        </div>
      </main>
      
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
          background: #172a45;
        }
        
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: #1e3a5f;
          border-radius: 3px;
        }
        
        .custom-scrollbar:hover::-webkit-scrollbar-thumb:hover {
          background: #2d4a75;
        }
        
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

// Toggle Icons
const CollapseIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
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
      flex items-center justify-center px-1 border-2 border-navy-800 z-10`}>
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
      flex items-center justify-center px-1 border-2 border-navy-800 z-10`}>
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

export default DashboardLayout;