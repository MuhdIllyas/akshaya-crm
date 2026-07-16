import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FiBell, FiMessageCircle, FiAtSign, FiBriefcase, FiCheckSquare,
  FiCalendar, FiDollarSign, FiUsers, FiStar, FiClock, FiX,
  FiAlertCircle, FiChevronRight, FiFilter, FiCheck,
  FiMail, FiPhone, FiUser, FiActivity, FiEye, FiSearch,
  FiMoreHorizontal, FiFileText, FiTag, FiAward, FiSettings,
  FiSlack, FiMessageSquare as FiMessageSquareIcon,
  FiRepeat, FiBookOpen, FiLink, FiThumbsUp, FiTrendingUp,
  FiMenu, FiPlus, FiMinus, FiChevronDown, FiRefreshCw,
  FiPlay, FiPause, FiTrash2, FiEdit2, FiSend,
  FiMapPin
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

import { socket } from '@/services/socket'; 
import { useNotifications } from '../../context/NotificationContext';

import PaymentReceiptDrawer from '@/components/PaymentReceiptDrawer';

const timeAgo = (dateString) => {
  if (!dateString) return 'Just now';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Just now'; // Fallback for invalid dates

  const seconds = Math.round((new Date() - date) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
};

const mapDBNotificationToUI = (dbNotif) => {
  const role = localStorage.getItem('role') || 'staff';
  // Construct a frontend route based on the entity
  let actionUrl = '#';
  if (dbNotif.related_entity_type === 'task') actionUrl = `/dashboard/${role}/tasks`; 
  if (dbNotif.related_entity_type === 'service') actionUrl = `/dashboard/${role}/track_service/${dbNotif.related_entity_id}`;
  if (dbNotif.type === 'whatsapp_message') actionUrl = `/dashboard/${role}/messenger`;
  
  // Route to the correct expense page based on the user's role
  if (dbNotif.related_entity_type === 'expense' || dbNotif.type?.includes('expense')) {
    actionUrl = ["admin", "superadmin"].includes(role) 
      ? `/dashboard/${role}/expensemanagement` 
      : `/dashboard/staff/expense_entry`;
  }

  // Safely get type to prevent .includes() crashing
  const typeStr = dbNotif.type || 'system';

  return {
      id: dbNotif.id,
      
      related_entity_id: dbNotif.related_entity_id,
      related_entity_type: dbNotif.related_entity_type,
      
      type: typeStr,
      icon: typeStr.includes('message') ? FiMessageSquareIcon : 
            typeStr.includes('task') ? FiCheckSquare : 
            typeStr.includes('service') ? FiBriefcase : FiBell,
      color: typeStr.includes('message') ? 'blue' : 
            typeStr.includes('task') ? 'emerald' : 
            typeStr.includes('service') ? 'indigo' : 'gray',
      module: dbNotif.category ? dbNotif.category.toUpperCase() : 'CRM',
      title: dbNotif.title || 'Notification',
      message: dbNotif.message || '',
      time: timeAgo(dbNotif.created_at),
      isRead: dbNotif.is_read || false,
      isPinned: dbNotif.is_pinned || false,
      priority: dbNotif.priority || 'normal',
      sender: dbNotif.sender_name ? { name: dbNotif.sender_name, role: dbNotif.sender_role } : null,
      centre: dbNotif.centre_name || null,
      actionUrl,
      actionLabel: 'View →',
      actions: ['mark_read', 'view'],
      metadata: dbNotif.metadata || {},
      preview: dbNotif.metadata || {}
    };
  };

const PRIORITY_LABELS = {
  high: 'HIGH',
  medium: 'MEDIUM',
  normal: 'NORMAL',
  low: 'LOW',
};

const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-orange-100 text-orange-700 border-orange-200',
  normal: 'bg-blue-100 text-blue-700 border-blue-200',
  low: 'bg-gray-100 text-gray-500 border-gray-200',
};

const ICON_COLORS = {
  blue: 'bg-blue-50 text-blue-600',
  purple: 'bg-purple-50 text-purple-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  orange: 'bg-orange-50 text-orange-600',
  green: 'bg-green-50 text-green-600',
  pink: 'bg-pink-50 text-pink-600',
  yellow: 'bg-yellow-50 text-yellow-600',
  red: 'bg-red-50 text-red-600',
  gray: 'bg-gray-50 text-gray-600',
};

// ==========================================================================
// ACTION BUTTONS PER TYPE
// ==========================================================================
const TYPE_ACTIONS = {
  mention: ['reply', 'mark_read'],
  whatsapp_message: ['reply', 'mark_read'],       
  service_assigned: ['accept', 'mark_read'],      
  service_completed: ['view', 'mark_read'],       
  task_assigned: ['open', 'complete', 'mark_read'],
  task_completed: ['open', 'mark_read'],          
  calendar: ['view', 'mark_read'],
  expense: ['view', 'mark_read'],
  expense_approved: ['view', 'mark_read'],
  payment: ['view', 'mark_read'],
  review: ['view', 'mark_read'],
  team: ['view', 'mark_read'],
  system: ['view', 'mark_read'],
  default: ['view', 'mark_read']
};

// ==========================================================================
// QUICK PREVIEW COMPONENT
// ==========================================================================
const QuickPreview = ({ notification }) => {
  if (!notification.preview) return null;
  const { preview, metadata } = notification;
  return (
    <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-4 text-sm">
      <div className="font-semibold text-gray-900 mb-1">{notification.title}</div>
      {preview.lastMessage && (
        <p className="text-gray-600 border-l-2 border-indigo-300 pl-2 mt-1 italic">{preview.lastMessage}</p>
      )}
      {preview.conversation && (
        <p className="text-gray-600 mt-1">Conversation: <span className="font-medium">{preview.conversation}</span></p>
      )}
      {preview.customer && (
        <p className="text-gray-600">Customer: <span className="font-medium">{preview.customer}</span></p>
      )}
      {preview.currentStep && (
        <p className="text-gray-600">Current Step: <span className="font-medium">{preview.currentStep}</span></p>
      )}
      {preview.receivedAt && (
        <p className="text-xs text-gray-400 mt-2">Received: {preview.receivedAt}</p>
      )}
      {metadata?.trackingId && (
        <p className="text-xs text-gray-400">Tracking: {metadata.trackingId}</p>
      )}
    </div>
  );
};

// ==========================================================================
// NOTIFICATION ITEM COMPONENT
// ==========================================================================
const NotificationItem = ({ notification, onAction, onMarkRead, onClick, onTogglePin, viewMode }) => {
  const Icon = notification.icon || FiBell;
  const iconColor = ICON_COLORS[notification.color] || ICON_COLORS.gray;
  const priorityLabel = PRIORITY_LABELS[notification.priority] || 'NORMAL';
  const priorityColor = PRIORITY_COLORS[notification.priority] || PRIORITY_COLORS.normal;
  const [showPreview, setShowPreview] = useState(false);

  const typeActions = TYPE_ACTIONS[notification.type] || ['mark_read'];
  const actions = notification.actions && notification.actions.length > 0
    ? notification.actions.filter(a => typeActions.includes(a) || a === 'mark_read')
    : typeActions;

  const handleAction = (e, action) => {
    e.stopPropagation();
    onAction(notification.id, action);
  };

  const handleClick = () => {
    if (viewMode === 'activity') onMarkRead(notification.id);
    onClick(notification.actionUrl);
  };

  const handlePin = (e) => {
    e.stopPropagation();
    onTogglePin(notification.id);
  };

  // Helper to format camelCase keys (e.g. "dueDate" -> "Due Date")
  const formatKey = (str) => {
    const spaced = str.replace(/([A-Z])/g, ' $1');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  };

  return (
    <div
      className={`relative rounded-xl border transition-all hover:shadow-md cursor-pointer ${
        notification.isPinned ? 'border-amber-300 bg-amber-50' :
        !notification.isRead ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
      } ${viewMode === 'activity' ? 'opacity-80' : ''}`}
      onMouseEnter={() => setShowPreview(true)}
      onMouseLeave={() => setShowPreview(false)}
      onClick={handleClick}
    >
      <div className="p-4">
        <div className="flex items-start gap-4">
          
          {/* ICON BADGE */}
          <div className="relative flex-shrink-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconColor}`}>
              <Icon className="h-5 w-5" />
            </div>
            {notification.module && (
              <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-[#172a45] text-white px-1.5 py-0.5 rounded-full">
                {notification.module}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* HEADER ROW */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900 text-sm">{notification.title}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityColor}`}>{priorityLabel}</span>
              {!notification.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>}
              {notification.isPinned && <FiMapPin className="h-3 w-3 text-amber-500 fill-current" />}
              <span className="text-xs text-gray-400 ml-auto">{notification.time}</span>
            </div>

            {/* MAIN MESSAGE */}
            <div className="text-sm text-gray-700 mb-3">{notification.message}</div>

            {/* STRUCTURED METADATA CARD */}
            {notification.metadata && Object.keys(notification.metadata).length > 0 && (
              <div className="mb-3 bg-gray-50 rounded-lg p-3 text-xs text-gray-700 space-y-1.5 border border-gray-100">
                {Object.entries(notification.metadata).map(([key, value]) => {
                  // Hide ugly backend IDs
                  if (key.toLowerCase().includes('id')) return null;
                  
                  // Hide 'assignedBy' if we are already rendering the sender below
                  if ((key === 'assignedBy' || key === 'Assigned by') && notification.sender) return null;

                  return (
                    <div key={key} className="flex">
                      <span className="w-28 font-medium text-gray-500">{formatKey(key)}:</span>
                      <span className="flex-1 font-semibold text-gray-900">{value}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* FOOTER: SENDER AND CENTRE */}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              {notification.sender && (
                <span className="flex items-center gap-1">
                  <FiUser className="h-3.5 w-3.5 text-gray-400" /> 
                  <span className="font-medium text-gray-700">{notification.sender.name}</span>
                  {notification.sender.role && <span>({notification.sender.role})</span>}
                </span>
              )}
              {notification.centre && (
                <span className="flex items-center gap-1">
                  <FiTag className="h-3.5 w-3.5 text-gray-400" /> 
                  <span className="font-medium text-gray-700">{notification.centre}</span>
                </span>
              )}
            </div>

            {/* ACTION BUTTONS */}
            {actions && actions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                {actions.includes('reply') && <button className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg bg-indigo-50" onClick={(e) => handleAction(e, 'reply')}>Reply</button>}
                {actions.includes('open') && <button className="text-xs font-medium text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded-lg bg-gray-100" onClick={(e) => handleAction(e, 'open')}>Open</button>}
                {actions.includes('accept') && <button className="text-xs font-medium text-emerald-600 hover:text-emerald-800 px-3 py-1.5 rounded-lg bg-emerald-50" onClick={(e) => handleAction(e, 'accept')}>Accept</button>}
                {actions.includes('complete') && <button className="text-xs font-medium text-emerald-600 hover:text-emerald-800 px-3 py-1.5 rounded-lg bg-emerald-50" onClick={(e) => handleAction(e, 'complete')}>Mark Complete</button>}
                {actions.includes('view') && <button className="text-xs font-medium text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded-lg bg-gray-100" onClick={(e) => handleAction(e, 'view')}>View Details</button>}
                {actions.includes('mark_read') && !notification.isRead && <button className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg bg-gray-50" onClick={(e) => handleAction(e, 'mark_read')}>Mark as Read</button>}
                <button className="text-xs font-medium text-amber-500 hover:text-amber-700 px-2 py-1.5 rounded-lg hover:bg-amber-50 ml-auto" onClick={handlePin}><FiMapPin className={`h-3.5 w-3.5 ${notification.isPinned ? 'fill-current text-amber-500' : 'text-gray-400'}`} /></button>
                {notification.actionLabel && <span className="text-xs text-indigo-600 font-medium flex items-center gap-1 ml-2">{notification.actionLabel} <FiChevronRight className="h-3 w-3" /></span>}
              </div>
            )}
          </div>
        </div>
      </div>
      {showPreview && <QuickPreview notification={notification} />}
    </div>
  );
};

// ==========================================================================
// NOTIFICATIONS PAGE
// ==========================================================================
const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState('notifications');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const [isReceiptDrawerOpen, setIsReceiptDrawerOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState(null);

  // --- NEW: HOOKS & VARIABLES ---
  const { decrementUnread, clearUnread } = useNotifications();
  const navigate = useNavigate();
  const API_BASE_URL = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem('token');

  // --- NEW: FETCH & SOCKETS ---
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/notifications?limit=50`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        // ACCEPT BOTH FORMATS: { notifications: [...] } OR [...]
        let notificationArray = [];
        if (data.notifications && Array.isArray(data.notifications)) {
          notificationArray = data.notifications;
        } else if (Array.isArray(data)) {
          notificationArray = data;
        }

        console.log("Fetched notifications raw data:", notificationArray); // <-- Great for debugging!
        setNotifications(notificationArray.map(mapDBNotificationToUI));
        
      } catch (error) {
        console.error("Fetch Error:", error);
        toast.error('Failed to load notifications');
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    // Socket Listeners
    const handleNewNotification = (newDbNotif) => {
      setNotifications((prev) => [mapDBNotificationToUI(newDbNotif), ...prev]);
    };

    const handleUpdatedNotification = (updatedDbNotif) => {
      setNotifications((prev) => 
        prev.map(n => n.id === updatedDbNotif.id ? mapDBNotificationToUI(updatedDbNotif) : n)
      );
    };

    socket.on('notification', handleNewNotification);
    socket.on('notification_updated', handleUpdatedNotification);

    return () => {
      socket.off('notification', handleNewNotification);
      socket.off('notification_updated', handleUpdatedNotification);
    };
  }, [API_BASE_URL, token]);

  const tabs = [
    { id: 'all', label: 'All', icon: FiBell },
    { id: 'unread', label: 'Unread', icon: FiEye },
    { id: 'mentions', label: 'Mentions', icon: FiAtSign },
    { id: 'tasks', label: 'Tasks', icon: FiCheckSquare },
    { id: 'messages', label: 'Messages', icon: FiMessageCircle },
    { id: 'services', label: 'Services', icon: FiBriefcase },
    { id: 'assignments', label: 'Assignments', icon: FiCheckSquare },
    { id: 'system', label: 'System', icon: FiActivity },
  ];

  // Helper to get count for assignment tab
  const getTabCount = (tabId) => {
    if (tabId === 'all') return notifications.length;
    if (tabId === 'unread') return notifications.filter(n => !n.isRead).length;
    if (tabId === 'assignments') {
      // Tasks + Services
      return notifications.filter(n => n.type === 'task' || n.type === 'service').length;
    }
    return notifications.filter(n => n.type === tabId).length;
  };

  // Filter logic
  const filtered = useMemo(() => {
    let items = notifications;

    switch (activeTab) {
      case 'all': break;
      case 'unread': items = items.filter(n => !n.isRead); break;
      case 'mentions': items = items.filter(n => n.type === 'mention'); break;
      case 'tasks': items = items.filter(n => n.type.includes('task')); break;
      case 'messages': items = items.filter(n => n.type === 'whatsapp_message' || n.type === 'message'); break;
      case 'services': items = items.filter(n => n.type.includes('service')); break;
      case 'assignments': items = items.filter(n => n.type.includes('task') || n.type.includes('service')); break;
      case 'system': items = items.filter(n => n.type === 'system'); break;
      default: break;
    }

    // Search – include metadata
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(n => {
        const metadataStr = n.metadata ? JSON.stringify(n.metadata).toLowerCase() : '';
        return (
          n.title.toLowerCase().includes(q) ||
          n.message.toLowerCase().includes(q) ||
          (n.sender?.name?.toLowerCase().includes(q)) ||
          (n.centre?.toLowerCase().includes(q)) ||
          metadataStr.includes(q) ||
          (n.metadata?.trackingId?.toLowerCase().includes(q)) ||
          (n.metadata?.customer?.toLowerCase().includes(q)) ||
          (n.metadata?.serviceId?.toLowerCase().includes(q))
        );
      });
    }

    // Time filter
    if (timeFilter === 'today') {
      items = items.filter(n => n.time.includes('min') || n.time.includes('hour'));
    } else if (timeFilter === 'week') {
      items = items.filter(n => n.time.includes('day') || n.time.includes('Yesterday'));
    } else if (timeFilter === 'earlier') {
      items = items.filter(n => !n.time.includes('min') && !n.time.includes('hour') && !n.time.includes('day') && !n.time.includes('Yesterday'));
    }

    // Pinned items float to top
    const pinned = items.filter(n => n.isPinned);
    const unpinned = items.filter(n => !n.isPinned);
    return [...pinned, ...unpinned];
  }, [notifications, activeTab, searchQuery, timeFilter]);

  const grouped = useMemo(() => {
    const groups = { Today: [], Yesterday: [], Older: [] };
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    filtered.forEach(n => {
      if (n.time.includes('min') || n.time.includes('hour') || n.time.includes('Just')) {
        groups.Today.push(n);
      } else if (n.time.includes('Yesterday')) {
        groups.Yesterday.push(n);
      } else {
        groups.Older.push(n);
      }
    });
    return groups;
  }, [filtered]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Actions
  const handleMarkRead = async (id) => {
    // Optimistic UI update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    decrementUnread(); // Instantly lower the global sidebar bell count

    try {
      await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (error) {
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    // Optimistic UI update
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    clearUnread(); // Instantly clear the global sidebar bell count
    toast.success('All notifications marked as read');

    try {
      await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleAction = (id, action) => {
    const notification = notifications.find(n => n.id === id);
    if (!notification) return;
    
    const role = localStorage.getItem('role') || 'staff';

    if (action === 'mark_read') {
      handleMarkRead(id);
      return;
    }

    // Handle "View Details" specifically for expenses
    if (action === 'view' && notification.type.includes('expense')) {
      handleMarkRead(id);
      
      const targetRoute = ["admin", "superadmin"].includes(role) 
        ? `/dashboard/${role}/expensemanagement` 
        : `/dashboard/staff/expense_entry`;

      // Pass the ID in state so the destination page can highlight the row
      navigate(targetRoute, { 
        state: { openExpenseId: notification.related_entity_id } 
      });
      return;
    }

    // Handle "Open" for tasks
    if (action === 'open' && notification.type.includes('task')) {
      handleMarkRead(id);
      navigate(`/dashboard/${role}/tasks`);
      return;
    }

    // Handle "View Details" specifically for Payments
    if (action === 'view' && notification.type === 'payment') {
      handleMarkRead(id); // Instantly mark as read
      
      console.log("Notification:", notification);
      console.log("Payment ID:", notification.related_entity_id);

      // Grab the ID from the notification metadata/entity and open the drawer
      setSelectedPaymentId(notification.related_entity_id || id);
      setIsReceiptDrawerOpen(true);
      return;
    }

    // Handle Messenger
    if (action === 'reply' && notification.type === 'whatsapp_message') {
      handleMarkRead(id);
      navigate(`/dashboard/${role}/messenger`);
      return;
    }

    // Fallback for actions not yet wired up
    toast.info(`${action.toUpperCase()} action triggered for: ${notification.title}`);
  };

  const handleTogglePin = async (id) => {
    // Optimistic UI update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isPinned: !n.isPinned } : n));
    try {
      await fetch(`${API_BASE_URL}/api/notifications/${id}/pin`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {
      toast.error('Failed to pin notification');
    }
  };

  const handleClick = (url) => {
    if (url && url !== '#') {
      navigate(url); 
    }
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <FiRefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-xl">
            <FiBell className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-500">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'} • {notifications.length} total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 transition"
            onClick={handleMarkAllRead}
          >
            <FiCheck className="h-4 w-4" /> Mark all read
          </button>
          <button
            className="text-sm text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
            onClick={() => setViewMode(prev => prev === 'notifications' ? 'activity' : 'notifications')}
          >
            {viewMode === 'notifications' ? '📊' : '🔔'}
            {viewMode === 'notifications' ? ' Activity' : ' Notifications'}
          </button>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[200px] relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search notifications (title, message, sender, centre, tracking ID, customer…)"
            value={searchQuery}
            onChange={handleSearch}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
        </div>
        <button
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          onClick={() => setShowFilters(!showFilters)}
        >
          <FiFilter className="h-4 w-4" />
          Filters
        </button>
        <select
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="earlier">Earlier</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200 pb-0.5">
        {tabs.map(tab => {
          const count = getTabCount(tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-500'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {count > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Grouped list */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([group, items]) => {
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">{group}</h3>
              <div className="space-y-3">
                {items.map(n => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onAction={handleAction}
                    onMarkRead={handleMarkRead}
                    onClick={handleClick}
                    onTogglePin={handleTogglePin}
                    viewMode={viewMode}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              {viewMode === 'notifications' ? (
                <FiBell className="h-10 w-10 text-gray-300" />
              ) : (
                <FiActivity className="h-10 w-10 text-gray-300" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-700">
              {viewMode === 'notifications' ? '🎉 You\'re all caught up!' : 'No activity yet'}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {viewMode === 'notifications'
                ? 'We\'ll notify you when something requires your attention.'
                : 'Activity from your team will appear here.'}
            </p>
          </div>
        )}
      </div>

      {/* Notification Preferences */}
      <div className="mt-8 text-center border-t border-gray-200 pt-4">
        <button
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mx-auto"
          onClick={() => toast.info('Notification preferences dialog (demo)')}
        >
          <FiSettings className="h-3 w-3" /> Manage preferences
        </button>
      </div>

      {/* Pending Payments Drawer */}
      <PaymentReceiptDrawer 
        isOpen={isReceiptDrawerOpen} 
        onClose={() => setIsReceiptDrawerOpen(false)} 
        paymentId={selectedPaymentId} 
      />
    </div>
  );
};

export default NotificationsPage;