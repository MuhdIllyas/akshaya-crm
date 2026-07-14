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
  FiPlay, FiPause, FiTrash2, FiEdit2, FiSend, FiPin, FiUnlock
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';

// ==========================================================================
// MOCK DATA – extended with pinning support
// ==========================================================================
const MOCK_NOTIFICATIONS = [
  {
    id: 1,
    type: 'message',
    icon: FiMessageSquareIcon,
    color: 'blue',
    module: 'WHATSAPP',
    title: 'New WhatsApp Message',
    message: '"Sir, my application is approved."',
    time: '2 min ago',
    isRead: false,
    isPinned: false,
    priority: 'high',
    sender: {
      name: 'Abdul Rahman',
      avatar: null,
      role: 'Customer',
    },
    centre: 'Pukayur',
    actionUrl: '/messenger/337',
    actionLabel: 'Open Chat →',
    actions: ['reply', 'mark_read'],
    metadata: {
      customer: 'Abdul Rahman',
      centre: 'Pukayur',
      service: 'Passport Renewal',
      trackingId: 'TRK-10396',
    },
    preview: {
      lastMessage: '"Sir, my application is approved."',
      receivedAt: '2 min ago',
    },
  },
  {
    id: 2,
    type: 'mention',
    icon: FiAtSign,
    color: 'purple',
    module: 'MESSENGER',
    title: 'You were mentioned',
    message: '"Please verify this."',
    time: '5 min ago',
    isRead: false,
    isPinned: false,
    priority: 'high',
    sender: {
      name: 'Prajitha',
      avatar: null,
      role: 'Staff',
    },
    centre: 'Pukayur',
    actionUrl: '/messenger/337#mention',
    actionLabel: 'Open Conversation →',
    actions: ['reply', 'mark_read'],
    metadata: {
      conversation: 'Passport Renewal',
    },
    preview: {
      conversation: 'Passport Workspace',
    },
  },
  {
    id: 3,
    type: 'service',
    icon: FiBriefcase,
    color: 'indigo',
    module: 'SERVICE',
    title: 'Service Assigned',
    message: 'Passport Renewal Verification',
    time: '10 min ago',
    isRead: false,
    isPinned: false,
    priority: 'medium',
    sender: {
      name: 'Admin',
      avatar: null,
      role: 'Admin',
    },
    centre: 'Pukayur',
    actionUrl: '/tracking/10396',
    actionLabel: 'Open Tracking →',
    actions: ['accept', 'mark_read'],
    metadata: {
      customer: 'Abdul Rahman',
      serviceId: '#10396',
      centre: 'Pukayur',
      trackingId: 'TRK-10396',
    },
    preview: {
      customer: 'Abdul Rahman',
      currentStep: 'Verification',
    },
  },
  {
    id: 4,
    type: 'task',
    icon: FiCheckSquare,
    color: 'emerald',
    module: 'TASK',
    title: 'Task Completed',
    message: 'Aadhaar Update',
    time: 'Yesterday',
    isRead: true,
    isPinned: false,
    priority: 'normal',
    sender: {
      name: 'Prajitha',
      avatar: null,
      role: 'Staff',
    },
    centre: 'Pukayur',
    actionUrl: '/tasks/52',
    actionLabel: 'Open Task →',
    actions: ['mark_read'],
    metadata: {
      taskId: '#52',
    },
    preview: null,
  },
  {
    id: 5,
    type: 'calendar',
    icon: FiCalendar,
    color: 'orange',
    module: 'CALENDAR',
    title: 'Event Reminder',
    message: 'Team Meeting in 30 minutes',
    time: 'Yesterday',
    isRead: true,
    isPinned: false,
    priority: 'medium',
    sender: null,
    centre: 'Pukayur',
    actionUrl: '/calendar',
    actionLabel: 'Open Calendar →',
    actions: ['mark_read'],
    metadata: {
      event: 'Team Meeting',
      time: '3:00 PM',
    },
    preview: null,
  },
  {
    id: 6,
    type: 'task',
    icon: FiCheckSquare,
    color: 'emerald',
    module: 'TASK',
    title: 'Task Assigned',
    message: 'Complete eDistrict verification',
    time: 'Yesterday',
    isRead: true,
    isPinned: true, // pinned until completed
    priority: 'high',
    sender: {
      name: 'Muhammed Illyas',
      avatar: null,
      role: 'Staff',
    },
    centre: 'Pukayur',
    actionUrl: '/tasks/101',
    actionLabel: 'Open Task →',
    actions: ['open', 'mark_read', 'complete'],
    metadata: {
      dueDate: 'Today',
    },
    preview: null,
  },
  {
    id: 7,
    type: 'expense',
    icon: FiDollarSign,
    color: 'green',
    module: 'EXPENSE',
    title: 'Expense Approved',
    message: 'Travel Allowance',
    time: '2 days ago',
    isRead: true,
    isPinned: false,
    priority: 'normal',
    sender: {
      name: 'Finance Team',
      avatar: null,
      role: 'Finance',
    },
    centre: 'Pukayur',
    actionUrl: '/expenses/88',
    actionLabel: 'Open Expense →',
    actions: ['mark_read'],
    metadata: {
      amount: '₹450',
    },
    preview: null,
  },
  {
    id: 8,
    type: 'team',
    icon: FiUsers,
    color: 'pink',
    module: 'TEAM',
    title: 'You\'ve been added to',
    message: 'Passport Team',
    time: '2 days ago',
    isRead: true,
    isPinned: false,
    priority: 'normal',
    sender: {
      name: 'Admin',
      avatar: null,
      role: 'Admin',
    },
    centre: 'Pukayur',
    actionUrl: '/teams/12',
    actionLabel: 'Open Team →',
    actions: ['mark_read'],
    metadata: {
      team: 'Passport Team',
    },
    preview: null,
  },
  {
    id: 9,
    type: 'review',
    icon: FiStar,
    color: 'yellow',
    module: 'REVIEW',
    title: 'Customer Review',
    message: '"Excellent service"',
    time: '3 days ago',
    isRead: true,
    isPinned: false,
    priority: 'normal',
    sender: {
      name: 'Rahman',
      avatar: null,
      role: 'Customer',
    },
    centre: 'Pukayur',
    actionUrl: '/reviews/56',
    actionLabel: 'View Review →',
    actions: ['mark_read'],
    metadata: {
      rating: 5,
    },
    preview: null,
  },
  {
    id: 10,
    type: 'payment',
    icon: FiDollarSign,
    color: 'red',
    module: 'PAYMENT',
    title: 'Pending Payment',
    message: '2 customers pending – ₹850',
    time: '3 days ago',
    isRead: true,
    isPinned: false,
    priority: 'medium',
    sender: null,
    centre: 'Pukayur',
    actionUrl: '/payments/pending',
    actionLabel: 'View Payments →',
    actions: ['mark_read'],
    metadata: {
      count: 2,
      amount: '₹850',
    },
    preview: null,
  },
  {
    id: 11,
    type: 'system',
    icon: FiActivity,
    color: 'gray',
    module: 'SYSTEM',
    title: 'System Update',
    message: 'CRM v2.4.2 is available',
    time: '4 days ago',
    isRead: true,
    isPinned: false,
    priority: 'low',
    sender: null,
    centre: 'Pukayur',
    actionUrl: '/settings',
    actionLabel: 'Update →',
    actions: ['mark_read'],
    metadata: {
      version: 'v2.4.2',
    },
    preview: null,
  },
];

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
  message: ['reply', 'mark_read'],
  service: ['accept', 'mark_read'],
  task: ['open', 'complete', 'mark_read'],
  review: ['view', 'mark_read'],
  calendar: ['view', 'mark_read'],
  expense: ['view', 'mark_read'],
  team: ['view', 'mark_read'],
  payment: ['view', 'mark_read'],
  system: ['view', 'mark_read'],
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

  // Determine actions based on type (with fallback)
  const typeActions = TYPE_ACTIONS[notification.type] || ['mark_read'];
  // Override with custom actions if provided, but ensure they are valid
  const actions = notification.actions && notification.actions.length > 0
    ? notification.actions.filter(a => typeActions.includes(a) || a === 'mark_read')
    : typeActions;

  const handleAction = (e, action) => {
    e.stopPropagation();
    onAction(notification.id, action);
  };

  const handleClick = () => {
    if (viewMode === 'activity') {
      onMarkRead(notification.id);
    }
    onClick(notification.actionUrl);
  };

  const handlePin = (e) => {
    e.stopPropagation();
    onTogglePin(notification.id);
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
          {/* Icon with module badge */}
          <div className="relative flex-shrink-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconColor}`}>
              <Icon className="h-5 w-5" />
            </div>
            {notification.module && (
              <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-gray-800 text-white px-1.5 py-0.5 rounded-full">
                {notification.module}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Top row: title, priority, time, pin */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900 text-sm">{notification.title}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityColor}`}>
                {priorityLabel}
              </span>
              {!notification.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>}
              {notification.isPinned && <FiPin className="h-3 w-3 text-amber-500" />}
              <span className="text-xs text-gray-400 ml-auto">{notification.time}</span>
            </div>

            {/* Message */}
            <div className="text-sm text-gray-700 mb-1">{notification.message}</div>

            {/* Sender + Centre */}
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
              {notification.sender && (
                <span className="flex items-center gap-1">
                  <FiUser className="h-3 w-3" /> {notification.sender.name}
                  {notification.sender.role && (
                    <span className="text-gray-400">({notification.sender.role})</span>
                  )}
                </span>
              )}
              {notification.centre && (
                <span className="flex items-center gap-1">
                  <FiTag className="h-3 w-3" /> {notification.centre}
                </span>
              )}
            </div>

            {/* Metadata row */}
            {notification.metadata && (
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500 border-t border-gray-100 pt-2">
                {Object.entries(notification.metadata).map(([key, value]) => (
                  <span key={key} className="flex items-center gap-1">
                    <span className="font-medium text-gray-400">{key}:</span> {value}
                  </span>
                ))}
              </div>
            )}

            {/* Actions */}
            {actions && actions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {actions.includes('reply') && (
                  <button
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition"
                    onClick={(e) => handleAction(e, 'reply')}
                  >
                    Reply
                  </button>
                )}
                {actions.includes('open') && (
                  <button
                    className="text-xs font-medium text-gray-700 hover:text-gray-900 px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
                    onClick={(e) => handleAction(e, 'open')}
                  >
                    Open
                  </button>
                )}
                {actions.includes('accept') && (
                  <button
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-800 px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition"
                    onClick={(e) => handleAction(e, 'accept')}
                  >
                    Accept
                  </button>
                )}
                {actions.includes('complete') && (
                  <button
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-800 px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition"
                    onClick={(e) => handleAction(e, 'complete')}
                  >
                    Mark Complete
                  </button>
                )}
                {actions.includes('view') && (
                  <button
                    className="text-xs font-medium text-gray-700 hover:text-gray-900 px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
                    onClick={(e) => handleAction(e, 'view')}
                  >
                    View
                  </button>
                )}
                {actions.includes('mark_read') && !notification.isRead && (
                  <button
                    className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 transition"
                    onClick={(e) => handleAction(e, 'mark_read')}
                  >
                    Mark Read
                  </button>
                )}
                <button
                  className="text-xs font-medium text-amber-500 hover:text-amber-700 px-2 py-1 rounded-lg hover:bg-amber-50 transition"
                  onClick={handlePin}
                  title={notification.isPinned ? 'Unpin' : 'Pin'}
                >
                  {notification.isPinned ? <FiUnlock className="h-3 w-3" /> : <FiPin className="h-3 w-3" />}
                </button>
                {notification.actionLabel && (
                  <span className="text-xs text-indigo-600 font-medium ml-auto flex items-center gap-1">
                    {notification.actionLabel} <FiChevronRight className="h-3 w-3" />
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Preview */}
      {showPreview && <QuickPreview notification={notification} />}
    </div>
  );
};

// ==========================================================================
// NOTIFICATIONS PAGE
// ==========================================================================
const NotificationsPage = ({ notifications: externalNotifications, setNotifications: setExternalNotifications }) => {
  const [notifications, setNotifications] = useState(externalNotifications || MOCK_NOTIFICATIONS);
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState('notifications');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

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
      // Tasks + Services that are unread or not yet acted upon (simplified)
      return notifications.filter(n => (n.type === 'task' || n.type === 'service')).length;
    }
    return notifications.filter(n => n.type === tabId).length;
  };

  // Filter logic
  const filtered = useMemo(() => {
    let items = notifications;

    // Tab filter
    switch (activeTab) {
      case 'all': break;
      case 'unread': items = items.filter(n => !n.isRead); break;
      case 'mentions': items = items.filter(n => n.type === 'mention'); break;
      case 'tasks': items = items.filter(n => n.type === 'task'); break;
      case 'messages': items = items.filter(n => n.type === 'message'); break;
      case 'services': items = items.filter(n => n.type === 'service'); break;
      case 'assignments': items = items.filter(n => n.type === 'task' || n.type === 'service'); break;
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
  const handleMarkRead = (id) => {
    const updated = notifications.map(n => n.id === id ? { ...n, isRead: true } : n);
    setNotifications(updated);
    if (setExternalNotifications) setExternalNotifications(updated);
  };

  const handleMarkAllRead = () => {
    const updated = notifications.map(n => ({ ...n, isRead: true }));
    setNotifications(updated);
    if (setExternalNotifications) setExternalNotifications(updated);
    toast.success('All notifications marked as read');
  };

  const handleAction = (id, action) => {
    const notification = notifications.find(n => n.id === id);
    if (!notification) return;
    switch (action) {
      case 'reply':
        toast.info(`Replying to "${notification.title}" (demo)`);
        break;
      case 'open':
        toast.info(`Opening ${notification.title} (demo)`);
        break;
      case 'accept':
        toast.success(`Accepted ${notification.title} (demo)`);
        break;
      case 'complete':
        toast.success(`Marked "${notification.title}" as complete (demo)`);
        break;
      case 'view':
        toast.info(`Viewing ${notification.title} (demo)`);
        break;
      case 'mark_read':
        handleMarkRead(id);
        toast.info('Marked as read');
        break;
      default:
        break;
    }
  };

  const handleTogglePin = (id) => {
    const updated = notifications.map(n =>
      n.id === id ? { ...n, isPinned: !n.isPinned } : n
    );
    setNotifications(updated);
    if (setExternalNotifications) setExternalNotifications(updated);
    const pinned = updated.find(n => n.id === id);
    toast.info(pinned.isPinned ? 'Pinned' : 'Unpinned');
  };

  const handleClick = (url) => {
    toast.info(`Navigating to ${url} (demo)`);
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

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
    </div>
  );
};

export default NotificationsPage;