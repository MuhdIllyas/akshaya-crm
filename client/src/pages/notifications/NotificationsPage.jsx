import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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

import ReviewDetailsDrawer from '@/components/ReviewDetailsDrawer';

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
  if (dbNotif.related_entity_type === 'task') {
    actionUrl = ["admin", "superadmin"].includes(role) 
      ? `/dashboard/${role}/messenger` 
      : `/dashboard/staff/tasks`;
  }

  if (dbNotif.related_entity_type === 'service') {
    actionUrl = ["admin", "superadmin"].includes(role)
      ? `/dashboard/${role}/servicelogs`
      : `/dashboard/staff/track_service/${dbNotif.related_entity_id}`;
  }
  if (dbNotif.type === 'whatsapp_message' || dbNotif.type === 'mention' || dbNotif.related_entity_type === 'conversation') {
    actionUrl = `/dashboard/${role}/messenger`;
  }

  // 🔥 Route for Notes
  if (dbNotif.related_entity_type === 'note') {
    actionUrl = ["admin", "superadmin"].includes(role) 
      ? `/dashboard/${role}/notes`  
      : `/dashboard/staff/notes`;
  }

  // 🔥 Route for Token assignments (routes to queue/tokens page)
  if (dbNotif.related_entity_type === 'token') {
    actionUrl = ["admin", "superadmin"].includes(role) 
      ? `/dashboard/${role}/token` 
      : `/dashboard/staff`; 
  }
  
  // Route to the correct expense page based on the user's role
  if (dbNotif.related_entity_type === 'expense' || dbNotif.type?.includes('expense')) {
    actionUrl = ["admin", "superadmin"].includes(role) 
      ? `/dashboard/${role}/expensemanagement` 
      : `/dashboard/staff/expense_entry`;
  }

  // 🔥 Route for Salary Paid (Goes straight to Payslips)
  if (dbNotif.type === 'salary_paid') {
    actionUrl = `/dashboard/${role}/attendance?tab=payslips`;
  }

  // 🔥 Route for Knowledge/Operations Hub Discussions
  if (dbNotif.related_entity_type === 'discussion' || dbNotif.type?.startsWith('knowledge_')) {
    actionUrl = `/dashboard/${role}/operationshub`; 
  }

  // Safely get type to prevent .includes() crashing
  const typeStr = dbNotif.type || 'system';

  return {
      id: dbNotif.id,
      
      related_entity_id: dbNotif.related_entity_id,
      related_entity_type: dbNotif.related_entity_type,
      conversationId: dbNotif.conversation_id,
      
      type: typeStr,
      icon: typeStr === 'salary_paid' ? FiDollarSign :
            typeStr.startsWith('knowledge_') ? FiMessageCircle :
            typeStr.includes('message') ? FiMessageSquareIcon : 
            typeStr.includes('task') ? FiCheckSquare : 
            typeStr.includes('service') ? FiBriefcase : FiBell,
      color: typeStr === 'salary_paid' ? 'emerald' :
            typeStr === 'knowledge_solved' ? 'emerald' : 
            typeStr.startsWith('knowledge_') ? 'indigo' :
            typeStr.includes('message') ? 'blue' : 
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

      // 🔥 The state to pass when clicking the whole card
      actionState: { 
        openConversationId: dbNotif.conversation_id,
        openDiscussionId: (dbNotif.related_entity_type === 'discussion' || typeStr.startsWith('knowledge_')) ? dbNotif.related_entity_id : undefined,

        // 🔥 Tell Messenger to open the Tasks tab for admins
        openTasksView: dbNotif.related_entity_type === 'task' && ["admin", "superadmin"].includes(role) ? true : undefined
      },

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
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  normal: 'bg-slate-100 text-navy-700 border-slate-200',
  low: 'bg-slate-100 text-slate-500 border-slate-200',
};

const ICON_COLORS = {
  blue: 'bg-navy-500/10 text-navy-500',
  purple: 'bg-slate-100 text-slate-600',
  indigo: 'bg-slate-100 text-navy-700',
  emerald: 'bg-emerald-50 text-emerald-600',
  orange: 'bg-orange-50 text-orange-600',
  green: 'bg-green-50 text-green-600',
  pink: 'bg-pink-50 text-pink-600',
  yellow: 'bg-yellow-50 text-yellow-600',
  red: 'bg-red-50 text-red-600',
  gray: 'bg-slate-50 text-slate-600',
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
  salary_paid: ['view', 'mark_read'],

  // 🔥 knowledge hub
  knowledge_mention: ['reply', 'mark_read'],
  knowledge_reply: ['reply', 'mark_read'],
  knowledge_solved: ['view', 'mark_read'],

  default: ['view', 'mark_read']
};

// Single source of truth for tab membership (used by both the counts and the list)
const matchesTab = (n, tabId) => {
  const type = n.type || '';
  switch (tabId) {
    case 'all': return true;
    case 'unread': return !n.isRead;
    case 'mentions': return type === 'mention';
    case 'tasks': return type.includes('task');
    case 'messages': return type === 'whatsapp_message' || type === 'message';
    case 'services': return type.includes('service');
    case 'assignments': return type.includes('task') || type.includes('service');
    case 'system': return type === 'system';
    default: return true;
  }
};


// ==========================================================================
// NOTIFICATION LIST ROW (left column)
// ==========================================================================
const NotificationRow = ({ notification, isSelected, onSelect, onMarkRead, viewMode }) => {
  const Icon = notification.icon || FiBell;
  const iconColor = ICON_COLORS[notification.color] || ICON_COLORS.gray;

  const handleSelect = () => {
    if (viewMode === 'activity') onMarkRead(notification.id);
    onSelect(notification.id);
  };

  const stateClass = isSelected
    ? 'bg-navy-500/10 border-l-navy-700'
    : notification.isPinned
      ? 'bg-amber-50 border-l-amber-400 hover:bg-amber-100/60'
      : !notification.isRead
        ? 'bg-white border-l-navy-700 hover:bg-slate-50'
        : 'bg-slate-50/70 border-l-transparent hover:bg-slate-100';

  return (
    <button
      type="button"
      onClick={handleSelect}
      aria-current={isSelected ? 'true' : undefined}
      className={`w-full text-left flex items-start gap-3 px-4 py-3 border-l-4 border-b border-b-slate-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy-500/40 ${stateClass} ${viewMode === 'activity' ? 'opacity-80' : ''}`}
    >
      <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColor}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm truncate ${notification.isRead ? 'text-slate-700' : 'font-semibold text-slate-900'}`}>{notification.title}</span>
          {notification.isPinned && <FiMapPin className="h-3 w-3 text-amber-500 fill-current flex-shrink-0" />}
          {!notification.isRead && <span className="w-2 h-2 rounded-full bg-navy-700 flex-shrink-0" aria-label="Unread"></span>}
          <span className="text-xs text-slate-400 ml-auto whitespace-nowrap">{notification.time}</span>
        </div>
        <p className={`text-xs truncate mt-0.5 ${notification.isRead ? 'text-slate-400' : 'text-slate-500'}`}>{notification.message}</p>
      </div>
    </button>
  );
};

// ==========================================================================
// NOTIFICATION DETAIL PANEL (right column)
// ==========================================================================
const NotificationDetail = ({ notification, onAction, onClick, onTogglePin, onBack }) => {
  const Icon = notification.icon || FiBell;
  const iconColor = ICON_COLORS[notification.color] || ICON_COLORS.gray;
  const priorityLabel = PRIORITY_LABELS[notification.priority] || 'NORMAL';
  const priorityColor = PRIORITY_COLORS[notification.priority] || PRIORITY_COLORS.normal;

  const typeActions = TYPE_ACTIONS[notification.type] || ['mark_read'];
  const actions = notification.actions && notification.actions.length > 0
    ? notification.actions.filter(a => typeActions.includes(a) || a === 'mark_read')
    : typeActions;

  const handleAction = (e, action) => {
    e.stopPropagation();
    onAction(notification.id, action);
  };

  // Helper to format camelCase keys (e.g. "dueDate" -> "Due Date")
  const formatKey = (str) => {
    const spaced = str.replace(/([A-Z])/g, ' $1');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  };

  const metaEntries = notification.metadata
    ? Object.entries(notification.metadata).filter(([key]) => {
        // Hide ugly backend IDs
        if (key.toLowerCase().includes('id')) return false;
        // Hide 'assignedBy' if we are already rendering the sender
        if ((key === 'assignedBy' || key === 'Assigned by') && notification.sender) return false;
        return true;
      })
    : [];

  const canGoToPage = notification.actionUrl && notification.actionUrl !== '#';

  return (
    <div className="p-5 md:p-6">
      <button
        type="button"
        onClick={onBack}
        className="lg:hidden mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-navy-700 hover:text-navy-800"
      >
        <FiChevronRight className="h-4 w-4 rotate-180" /> Back to list
      </button>

      <div className="flex items-start gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColor}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`font-bold px-2 py-0.5 rounded-full border ${priorityColor}`}>{priorityLabel}</span>
            {notification.module && (
              <span className="font-semibold bg-navy-800 text-white px-2 py-0.5 rounded-full">{notification.module}</span>
            )}
            {!notification.isRead && <span className="font-semibold text-navy-700">Unread</span>}
            <span className="text-slate-400">{notification.time}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-2 break-words">{notification.title}</h2>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onTogglePin(notification.id); }}
          aria-label={notification.isPinned ? 'Unpin' : 'Pin'}
          aria-pressed={notification.isPinned}
          className="p-2 rounded-lg hover:bg-amber-50 flex-shrink-0"
        >
          <FiMapPin className={`h-4 w-4 ${notification.isPinned ? 'fill-current text-amber-500' : 'text-slate-400'}`} />
        </button>
      </div>

      <p className="text-sm text-slate-700 mt-4 whitespace-pre-line break-words">{notification.message}</p>

      {(notification.sender || notification.centre || metaEntries.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          {notification.sender && (
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <div className="text-xs text-slate-400 flex items-center gap-1"><FiUser className="h-3 w-3" /> From</div>
              <div className="text-sm font-medium text-slate-800 mt-0.5">
                {notification.sender.name}{notification.sender.role && <span className="text-slate-500 font-normal"> ({notification.sender.role})</span>}
              </div>
            </div>
          )}
          {notification.centre && (
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <div className="text-xs text-slate-400 flex items-center gap-1"><FiTag className="h-3 w-3" /> Centre</div>
              <div className="text-sm font-medium text-slate-800 mt-0.5">{notification.centre}</div>
            </div>
          )}
          {metaEntries.map(([key, value]) => (
            <div key={key} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <div className="text-xs text-slate-400">{formatKey(key)}</div>
              <div className="text-sm font-medium text-slate-800 mt-0.5 break-words">{value}</div>
            </div>
          ))}
        </div>
      )}

      {((actions && actions.length > 0) || canGoToPage) && (
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-slate-100">
          {canGoToPage && (
            <button className="text-sm font-semibold text-white bg-navy-700 hover:bg-navy-800 px-4 py-2 rounded-lg shadow-sm inline-flex items-center gap-1" onClick={() => onClick(notification.actionUrl, notification.actionState)}>
              Go to page <FiChevronRight className="h-4 w-4" />
            </button>
          )}
          {actions.includes('reply') && <button className="text-sm font-semibold text-navy-700 hover:text-navy-800 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200" onClick={(e) => handleAction(e, 'reply')}>Reply</button>}
          {actions.includes('open') && <button className="text-sm font-medium text-slate-700 hover:text-slate-900 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200" onClick={(e) => handleAction(e, 'open')}>Open</button>}
          {actions.includes('accept') && <button className="text-sm font-medium text-emerald-600 hover:text-emerald-800 px-4 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100" onClick={(e) => handleAction(e, 'accept')}>Accept</button>}
          {actions.includes('complete') && <button className="text-sm font-medium text-emerald-600 hover:text-emerald-800 px-4 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100" onClick={(e) => handleAction(e, 'complete')}>Mark Complete</button>}
          {actions.includes('view') && <button className="text-sm font-medium text-slate-700 hover:text-slate-900 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200" onClick={(e) => handleAction(e, 'view')}>View Details</button>}
          {actions.includes('mark_read') && !notification.isRead && <button className="text-sm font-medium text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200" onClick={(e) => handleAction(e, 'mark_read')}>Mark as Read</button>}
        </div>
      )}
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
  const [selectedId, setSelectedId] = useState(null);
  const [showDetailMobile, setShowDetailMobile] = useState(false);

  const [isReceiptDrawerOpen, setIsReceiptDrawerOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState(null);

  // 🔥 Review Drawer State
  const [isReviewDrawerOpen, setIsReviewDrawerOpen] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState(null);

  // Stable references so the drawers don't refetch on every page re-render
  const closeReceiptDrawer = useCallback(() => setIsReceiptDrawerOpen(false), []);
  const closeReviewDrawer = useCallback(() => setIsReviewDrawerOpen(false), []);

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

  const getTabCount = (tabId) => notifications.filter(n => matchesTab(n, tabId)).length;

  // Filter logic
  const filtered = useMemo(() => {
    let items = notifications;

    items = items.filter(n => matchesTab(n, activeTab));

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

  // Master-detail selection (first item in display order is shown by default)
  const ordered = Object.values(grouped).flat();
  const selectedItem = ordered.find(n => n.id === selectedId);
  const selected = selectedItem || ordered[0];
  const mobileDetail = showDetailMobile && !!selectedItem;
  const handleSelect = (id) => { setSelectedId(id); setShowDetailMobile(true); };

  // Actions
  const handleMarkRead = async (id) => {
    // Already read: nothing to update, and the global bell count must not drop again
    const existing = notifications.find(n => n.id === id);
    if (existing?.isRead) return;

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

    if (action === 'view' && notification.related_entity_type === 'review') {
      handleMarkRead(id);
      setSelectedReviewId(notification.related_entity_id);
      setIsReviewDrawerOpen(true);
      return;
    }

    // Handle "View Details" for Notes
    if (action === 'view' && notification.related_entity_type === 'note') {
      handleMarkRead(id);
      const targetRoute = ["admin", "superadmin"].includes(role) 
        ? `/dashboard/${role}/notes` 
        : `/dashboard/staff/notes`;
      
      navigate(targetRoute, { 
        state: { openNoteId: notification.related_entity_id } 
      });
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
      
      const targetRoute = ["admin", "superadmin"].includes(role) 
        ? `/dashboard/${role}/messenger` 
        : `/dashboard/staff/tasks`;
        
      navigate(targetRoute, {
        state: ["admin", "superadmin"].includes(role) ? { openTasksView: true } : {}
      });
      return;
    }

    if (notification.related_entity_type === 'token' && (action === 'accept' || action === 'view')) {
      handleMarkRead(id);
      const targetRoute = ["admin", "superadmin"].includes(role) 
        ? `/dashboard/${role}/token` 
        : `/dashboard/staff/token`;
      navigate(targetRoute);
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

    // 🔥 Handle "View Details" for Salary Paid
    if (action === 'view' && notification.type === 'salary_paid') {
      handleMarkRead(id);
      navigate(`/dashboard/${role}/attendance?tab=payslips`);
      return;
    }

    // Handle Messenger
    if (
      (action === 'reply' || action === 'view') && 
      (notification.type === 'whatsapp_message' || notification.type === 'mention' || notification.related_entity_type === 'conversation')
    ) {
      handleMarkRead(id);
      navigate(`/dashboard/${role}/messenger`, { 
        state: { openConversationId: notification.conversationId || notification.related_entity_id } 
      });
      return;
    }

    // 🔥 Handle Operations Hub Discussions
    if (
      (action === 'reply' || action === 'view') && 
      (notification.type.startsWith('knowledge_') || notification.related_entity_type === 'discussion')
    ) {
      handleMarkRead(id);
      // 🔥 Send them to the base URL and pass the Discussion ID securely in the background!
      navigate(`/dashboard/${role}/operationshub`, { 
        state: { openDiscussionId: notification.related_entity_id } 
      });
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

  // 2. Update the card click handler
  const handleClick = (url, state) => { 
    if (url && url !== '#') {
      navigate(url, { state }); 
    }
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <FiRefreshCw className="h-8 w-8 animate-spin text-navy-700" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-navy-700 rounded-xl">
            <FiBell className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
            <p className="text-sm text-slate-500">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'} • {notifications.length} total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="text-sm text-white bg-navy-700 hover:bg-navy-800 font-semibold flex items-center gap-1.5 px-4 py-2.5 rounded-xl shadow-sm transition"
            onClick={handleMarkAllRead}
          >
            <FiCheck className="h-4 w-4" /> Mark all read
          </button>
          <button
            className="text-sm text-slate-600 hover:text-slate-800 font-medium flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 transition"
            onClick={() => setViewMode(prev => prev === 'notifications' ? 'activity' : 'notifications')}
          >
            {viewMode === 'notifications' ? '📊' : '🔔'}
            {viewMode === 'notifications' ? ' Activity' : ' Notifications'}
          </button>
        </div>
      </div>

      {/* Inbox card: filters + list + details */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Search and time filter */}
        <div className="flex flex-wrap items-center gap-3 px-4 md:px-5 py-3 border-b border-slate-200">
          <div className="flex-1 min-w-[200px] relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search notifications (title, message, sender, centre, tracking ID, customer…)"
              value={searchQuery}
              onChange={handleSearch}
              aria-label="Search notifications"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 outline-none"
            />
          </div>
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            aria-label="Filter by time"
            className="text-sm border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 outline-none"
          >
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="earlier">Earlier</option>
          </select>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 md:px-4 border-b border-slate-200 overflow-x-auto" role="tablist" aria-label="Notification filters">
          {tabs.map(tab => {
            const count = getTabCount(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`flex items-center gap-2 px-3 py-3 border-b-2 -mb-px whitespace-nowrap text-sm transition ${
                  activeTab === tab.id
                    ? 'border-navy-700 text-navy-700 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {count > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    activeTab === tab.id ? 'bg-navy-700 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              {viewMode === 'notifications' ? (
                <FiBell className="h-10 w-10 text-slate-300" />
              ) : (
                <FiActivity className="h-10 w-10 text-slate-300" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-slate-700">
              {viewMode === 'notifications' ? '🎉 You\'re all caught up!' : 'No activity yet'}
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              {viewMode === 'notifications'
                ? 'We\'ll notify you when something requires your attention.'
                : 'Activity from your team will appear here.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 lg:h-[calc(100vh-20rem)] lg:min-h-[480px]">
            {/* List */}
            <div className={`lg:col-span-2 lg:border-r border-slate-200 overflow-y-auto max-h-[70vh] lg:max-h-none ${mobileDetail ? 'hidden lg:block' : ''}`}>
              {Object.entries(grouped).map(([group, items]) => {
                if (items.length === 0) return null;
                return (
                  <div key={group}>
                    <h3 className="sticky top-0 z-10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-100 border-b border-slate-200">{group}</h3>
                    <div>
                      {items.map(n => (
                        <NotificationRow
                          key={n.id}
                          notification={n}
                          isSelected={selected?.id === n.id}
                          onSelect={handleSelect}
                          onMarkRead={handleMarkRead}
                          viewMode={viewMode}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Details */}
            <div className={`lg:col-span-3 overflow-y-auto ${mobileDetail ? '' : 'hidden lg:block'}`}>
              {selected && (
                <NotificationDetail
                  key={selected.id}
                  notification={selected}
                  onAction={handleAction}
                  onClick={handleClick}
                  onTogglePin={handleTogglePin}
                  onBack={() => setShowDetailMobile(false)}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Notification Preferences */}
      <div className="mt-8 text-center border-t border-slate-200 pt-4">
        <button
          className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 mx-auto py-2"
          onClick={() => toast.info('Notification preferences dialog (demo)')}
        >
          <FiSettings className="h-3 w-3" /> Manage preferences
        </button>
      </div>

      {/* Pending Payments Drawer */}
      <PaymentReceiptDrawer 
        isOpen={isReceiptDrawerOpen} 
        onClose={closeReceiptDrawer} 
        paymentId={selectedPaymentId} 
      />
      {/* Review Details Drawer */}
      <ReviewDetailsDrawer
        isOpen={isReviewDrawerOpen}
        onClose={closeReviewDrawer}
        reviewId={selectedReviewId}
      />
    </div>
  );
};

export default NotificationsPage;