import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FiActivity, 
  FiUser, 
  FiClock, 
  FiMapPin,
  FiMoreVertical,
  FiRefreshCw,
  FiFilter,
  FiDownload,
  FiCalendar,
  FiCheck,
  FiX,
  FiAlertCircle,
  FiHome
} from "react-icons/fi";
import { 
  FaUserCircle, 
  FaBuilding, 
  FaRegBell,
  FaRegClock,
  FaRegUser,
  FaMapMarkerAlt
} from "react-icons/fa";
import { MdAccessTime, MdPerson, MdBusinessCenter, MdLocationOn } from "react-icons/md";
import { BsCircleFill } from "react-icons/bs";
import { IoMdCheckmarkCircle, IoMdClose } from "react-icons/io";
// Import centralized socket and connection function
import { socket, connectSocket } from '@/services/socket';

const ActivityPanel = ({ token, userRole }) => {
  const [activities, setActivities] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [filter, setFilter] = useState("all"); // all, myCentre, mentions
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const containerRef = useRef(null);
  const filterMenuRef = useRef(null);
  
  // Refs to track connection state to avoid duplicate joins
  const hasConnected = useRef(false);

  const limit = 20;

  // Initialize socket connection using centralized socket
  useEffect(() => {
    if (!token) {
      console.error('No token provided for socket connection');
      return;
    }

    // Connect if not already connected
    if (!socket.connected && !hasConnected.current) {
      connectSocket(token);
      hasConnected.current = true;
    }

    // Optional: If already connected but we need to ensure it's using the token?
    // The centralized socket already uses the token from connectSocket.
    
    // Cleanup on unmount? We don't disconnect the shared socket because other components might use it.
    // So we just leave it connected. No cleanup needed for the socket itself.
  }, [token]);

  const fetchActivities = async (pageNum = 1) => {
    try {
      setLoading(true);

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/activities?page=${pageNum}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await res.json();
      
      if (data.length < limit) {
        setHasMore(false);
      }

      if (pageNum === 1) {
        setActivities(data);
      } else {
        setActivities(prev => [...prev, ...data]);
      }

    } catch (err) {
      console.error("Activity fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities(1);
  }, []);

  // Socket event listeners - using shared socket
  useEffect(() => {
    // Only add listener if socket is defined (it is, imported)
    const handleActivityCreated = (activity) => {
      setActivities(prev => [activity, ...prev]);
    };

    socket.on("activityCreated", handleActivityCreated);

    // Cleanup on unmount
    return () => {
      socket.off("activityCreated", handleActivityCreated);
    };
  }, []); // No dependency on socket because it's stable

  // Infinite scroll
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el || loading || !hasMore) return;

    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchActivities(nextPage);
    }

    setShowScrollTop(el.scrollTop > 300);
  };

  const scrollToTop = () => {
    containerRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Close filter menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setShowFilterMenu(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getActionIcon = (action) => {
    const actionLower = action?.toLowerCase() || '';
    if (actionLower.includes('create') || actionLower.includes('added')) return '➕';
    if (actionLower.includes('update') || actionLower.includes('edit')) return '✏️';
    if (actionLower.includes('delete') || actionLower.includes('remove')) return '🗑️';
    if (actionLower.includes('login')) return '🔐';
    if (actionLower.includes('logout')) return '👋';
    if (actionLower.includes('approve')) return '✅';
    if (actionLower.includes('reject')) return '❌';
    if (actionLower.includes('task')) return '📋';
    if (actionLower.includes('message') || actionLower.includes('chat')) return '💬';
    if (actionLower.includes('file') || actionLower.includes('document')) return '📎';
    if (actionLower.includes('meeting')) return '📅';
    return '📌';
  };

  const getRoleBadgeColor = (role) => {
    switch(role?.toLowerCase()) {
      case 'superadmin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'admin':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'manager':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'staff':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getActionColor = (action) => {
    const actionLower = action?.toLowerCase() || '';
    if (actionLower.includes('create')) return 'border-green-200 bg-green-50';
    if (actionLower.includes('update') || actionLower.includes('edit')) return 'border-blue-200 bg-blue-50';
    if (actionLower.includes('delete')) return 'border-red-200 bg-red-50';
    if (actionLower.includes('login')) return 'border-indigo-200 bg-indigo-50';
    if (actionLower.includes('logout')) return 'border-gray-200 bg-gray-50';
    return 'border-navy-200 bg-navy-50';
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getCentreBadgeStyle = (centreName) => {
    // Generate consistent color based on centre name
    const colours = [
      'bg-blue-100 text-blue-800 border-blue-200',
      'bg-green-100 text-green-800 border-green-200',
      'bg-purple-100 text-purple-800 border-purple-200',
      'bg-pink-100 text-pink-800 border-pink-200',
      'bg-indigo-100 text-indigo-800 border-indigo-200',
      'bg-orange-100 text-orange-800 border-orange-200',
      'bg-teal-100 text-teal-800 border-teal-200',
      'bg-cyan-100 text-cyan-800 border-cyan-200',
    ];
    
    // Simple hash function to get consistent index
    const hash = centreName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colours[hash % colours.length];
  };

  const filteredActivities = activities.filter(activity => {
    if (filter === "all") return true;
    if (filter === "myCentre" && userRole !== "superadmin") {
      // This needs to be fixed - you might want to compare with actual user's centre_id
      // return activity.centre_id === userCentreId;
      return true; // Temporary fix
    }
    if (filter === "mentions") {
      // Implement mentions filter logic here
      return activity.description?.includes('@') || false;
    }
    return true;
  });

  return (
    <div className="flex flex-col bg-white h-full border-l border-gray-200">
      {/* Header with gradient - matching MessengerPage style */}
      <div className="bg-gradient-to-r from-navy-700 to-navy-800 p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <FiActivity className="text-white text-xl" />
            </div>
            <div>
              <h3 className="font-semibold text-navy-blue text-lg">Activity Feed</h3>
              <p className="text-navy-100 text-xs flex items-center gap-1">
                <FaRegBell className="text-xs" />
                Real-time updates
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showScrollTop && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={scrollToTop}
                className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-all"
                title="Scroll to top"
              >
                <FiRefreshCw className="text-sm" />
              </motion.button>
            )}
            <div className="relative" ref={filterMenuRef}>
              <button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-all"
              >
                <FiFilter className="text-sm" />
              </button>
              <AnimatePresence>
                {showFilterMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden"
                  >
                    <button
                      onClick={() => { setFilter("all"); setShowFilterMenu(false); }}
                      className={`flex items-center w-full p-3 text-sm hover:bg-gray-50 ${filter === "all" ? "bg-navy-50 text-navy-700" : "text-gray-700"}`}
                    >
                      <FiActivity className="mr-3" /> All Activities
                    </button>
                    {userRole !== "superadmin" && (
                      <button
                        onClick={() => { setFilter("myCentre"); setShowFilterMenu(false); }}
                        className={`flex items-center w-full p-3 text-sm hover:bg-gray-50 ${filter === "myCentre" ? "bg-navy-50 text-navy-700" : "text-gray-700"}`}
                      >
                        <FaBuilding className="mr-3" /> My Centre Only
                      </button>
                    )}
                    <button
                      onClick={() => { setFilter("mentions"); setShowFilterMenu(false); }}
                      className={`flex items-center w-full p-3 text-sm hover:bg-gray-50 ${filter === "mentions" ? "bg-navy-50 text-navy-700" : "text-gray-700"}`}
                    >
                      <FaRegUser className="mr-3" /> Mentions
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between text-xs">
        <span className="text-gray-600 flex items-center gap-1">
          <MdAccessTime className="text-navy-700" />
          {filteredActivities.length} activities
        </span>
        <span className="text-gray-400">
          Last update: {activities[0] ? formatTimeAgo(activities[0].created_at) : 'N/A'}
        </span>
      </div>

      {/* Feed */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar"
      >
        {filteredActivities.length === 0 && !loading ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-64 text-gray-400"
          >
            <div className="bg-gray-100 p-4 rounded-full mb-3">
              <FiActivity className="text-3xl text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-600">No activities yet</p>
            <p className="text-xs mt-1 text-gray-500">Activities will appear here</p>
          </motion.div>
        ) : (
          <AnimatePresence>
            {filteredActivities.map((a, index) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: index * 0.05 }}
                className={`group relative bg-white border rounded-xl p-4 hover:shadow-lg transition-all duration-300 ${getActionColor(a.action)}`}
              >
                {/* Timeline connector */}
                {index < filteredActivities.length - 1 && (
                  <div className="absolute left-8 top-12 bottom-0 w-0.5 bg-gradient-to-b from-navy-200 to-transparent" />
                )}

                <div className="flex gap-3">
                  {/* Icon/Avatar section */}
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy-50 to-navy-100 flex items-center justify-center text-lg border-2 border-white shadow-sm">
                      {getActionIcon(a.action)}
                    </div>
                    {userRole === "superadmin" && a.centre_name && (
                      <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-md border border-gray-200">
                        <FaBuilding className="text-xs text-navy-700" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Header with centre and time - ENHANCED CENTRE LABEL */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Enhanced Centre Label - More prominent for superadmin */}
                        {userRole === "superadmin" && a.centre_name ? (
                          <div className="flex items-center gap-1.5">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getCentreBadgeStyle(a.centre_name)}`}>
                              <FiHome className="text-xs" />
                              <span>{a.centre_name}</span>
                            </div>
                            <span className="text-gray-300 mx-0.5">•</span>
                          </div>
                        ) : (
                          /* For non-superadmin, show centre name if available in a subtle way */
                          a.centre_name && (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                              <FiHome className="text-xs text-gray-400" />
                              {a.centre_name}
                            </span>
                          )
                        )}
                        
                        {/* Time */}
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <FiClock className="text-xs" />
                          {formatTimeAgo(a.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Action */}
                    <h4 className="font-semibold text-gray-800 text-sm mb-1.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-navy-700 rounded-full"></span>
                      {a.action}
                    </h4>

                    {/* Description */}
                    {a.description && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2 bg-white/80 p-2 rounded-lg border border-gray-100">
                        {a.description}
                      </p>
                    )}

                    {/* Performer info */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                            <FaUserCircle className="text-xs text-gray-600" />
                          </div>
                          <span className="text-xs font-medium text-gray-700">
                            {a.performer_name || "System"}
                          </span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getRoleBadgeColor(a.performed_by_role)}`}>
                          {a.performed_by_role || 'N/A'}
                        </span>
                      </div>
                      
                      {/* Quick actions on hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="text-gray-400 hover:text-navy-700 p-1">
                          <FiMoreVertical className="text-xs" />
                        </button>
                      </div>
                    </div>

                    {/* Additional centre indicator for non-superadmin users (optional) */}
                    {userRole !== "superadmin" && a.centre_name && (
                      <div className="mt-1 flex justify-end">
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <FiHome className="text-[8px]" />
                          {a.centre_name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {/* Loading indicator */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-6"
            >
              <div className="relative">
                <div className="w-10 h-10 border-2 border-navy-200 border-t-navy-700 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-navy-700 rounded-full animate-pulse"></div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">Loading activities...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* End of feed indicator */}
        {!hasMore && filteredActivities.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-4"
          >
            <div className="inline-flex items-center gap-2 text-xs text-gray-400 bg-gray-100 px-4 py-2 rounded-full">
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              End of feed
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Floating action button */}
      <AnimatePresence>
        {filteredActivities.length > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute bottom-6 right-6"
          >
            <button
              onClick={() => fetchActivities(1)}
              className="bg-navy-700 hover:bg-navy-800 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              title="Refresh"
            >
              <FiRefreshCw className={`text-lg ${loading ? 'animate-spin' : ''}`} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// CSS styles matching MessengerPage
const styles = `
  :root {
    --navy-700: #1e3a8a;
    --navy-800: #172554;
  }
  
  .bg-navy-700 {
    background-color: var(--navy-700);
  }
  
  .bg-navy-800 {
    background-color: var(--navy-800);
  }
  
  .text-navy-700 {
    color: var(--navy-700);
  }
  
  .border-navy-700 {
    border-color: var(--navy-700);
  }
  
  .hover\\:bg-navy-800:hover {
    background-color: var(--navy-800);
  }
  
  .hover\\:text-navy-700:hover {
    color: var(--navy-700);
  }
  
  .bg-navy-50 {
    background-color: #eef2ff;
  }
  
  .border-navy-200 {
    border-color: #c7d2fe;
  }
  
  .bg-navy-100 {
    background-color: #dbeafe;
  }
  
  .from-navy-700 {
    --tw-gradient-from: var(--navy-700);
  }
  
  .to-navy-800 {
    --tw-gradient-to: var(--navy-800);
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out forwards;
  }

  /* Custom scrollbar - matching MessengerPage */
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #c5c5c5;
    border-radius: 10px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }

  /* Line clamp utility */
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;

// Inject styles
const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
if (!document.head.querySelector('style[data-activity-panel]')) {
  styleSheet.setAttribute('data-activity-panel', 'true');
  document.head.appendChild(styleSheet);
}

export default ActivityPanel;
