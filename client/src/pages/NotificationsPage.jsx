import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiBell, FiMessageCircle, FiAtSign, FiBriefcase, FiCheckSquare,
  FiCalendar, FiDollarSign, FiUsers, FiStar, FiClock, FiX,
  FiAlertCircle, FiChevronRight, FiFilter, FiCheck,
  FiMail, FiPhone, FiUser, FiActivity, FiEye
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';

// Mock notification data (will be fetched from API)
const MOCK_NOTIFICATIONS = [
  {
    id: 1,
    type: 'message',
    title: 'New WhatsApp Message',
    message: 'Abdul Rahman sent a message',
    time: '2 min ago',
    isRead: false,
    priority: 'high',
    icon: FiMessageCircle,
    actionUrl: '/messenger/337',
    relatedEntity: 'messenger',
  },
  {
    id: 2,
    type: 'mention',
    title: 'You were mentioned',
    message: 'Illyas mentioned you in Messenger',
    time: '5 min ago',
    isRead: false,
    priority: 'high',
    icon: FiAtSign,
    actionUrl: '/messenger/337#mention',
    relatedEntity: 'messenger',
  },
  {
    id: 3,
    type: 'service',
    title: 'Service Assigned',
    message: 'Passport Renewal #10396 – Assigned by Admin',
    time: '10 min ago',
    isRead: false,
    priority: 'medium',
    icon: FiBriefcase,
    actionUrl: '/tracking/10396',
    relatedEntity: 'tracking',
  },
  {
    id: 4,
    type: 'task',
    title: 'Task Completed',
    message: 'Prajitha completed Aadhaar Update',
    time: 'Yesterday',
    isRead: true,
    priority: 'normal',
    icon: FiCheckSquare,
    actionUrl: '/tasks/52',
    relatedEntity: 'tasks',
  },
  {
    id: 5,
    type: 'calendar',
    title: 'Event Reminder',
    message: 'Team Meeting in 30 minutes',
    time: 'Yesterday',
    isRead: true,
    priority: 'medium',
    icon: FiCalendar,
    actionUrl: '/calendar',
    relatedEntity: 'calendar',
  },
  {
    id: 6,
    type: 'task',
    title: 'Task Assigned',
    message: 'Complete eDistrict verification – Due Today',
    time: 'Yesterday',
    isRead: true,
    priority: 'high',
    icon: FiCheckSquare,
    actionUrl: '/tasks/101',
    relatedEntity: 'tasks',
  },
  {
    id: 7,
    type: 'expense',
    title: 'Expense Approved',
    message: 'Travel Allowance – ₹450',
    time: '2 days ago',
    isRead: true,
    priority: 'normal',
    icon: FiDollarSign,
    actionUrl: '/expenses/88',
    relatedEntity: 'expenses',
  },
  {
    id: 8,
    type: 'team',
    title: 'You\'ve been added to',
    message: 'Passport Team',
    time: '2 days ago',
    isRead: true,
    priority: 'normal',
    icon: FiUsers,
    actionUrl: '/teams/12',
    relatedEntity: 'teams',
  },
  {
    id: 9,
    type: 'review',
    title: 'Customer Review',
    message: '★★★★★ "Excellent service"',
    time: '3 days ago',
    isRead: true,
    priority: 'normal',
    icon: FiStar,
    actionUrl: '/reviews/56',
    relatedEntity: 'reviews',
  },
  {
    id: 10,
    type: 'payment',
    title: 'Pending Payment',
    message: '2 customers pending – ₹850',
    time: '3 days ago',
    isRead: true,
    priority: 'medium',
    icon: FiDollarSign,
    actionUrl: '/payments/pending',
    relatedEntity: 'payments',
  },
  {
    id: 11,
    type: 'system',
    title: 'System Update',
    message: 'CRM v2.4.2 is available',
    time: '4 days ago',
    isRead: true,
    priority: 'low',
    icon: FiActivity,
    actionUrl: '/settings',
    relatedEntity: 'settings',
  },
];

const NotificationItem = ({ notification, onRead, onClick }) => {
  const Icon = notification.icon || FiBell;
  const priorityColors = {
    high: 'bg-red-500 border-red-500',
    medium: 'bg-orange-500 border-orange-500',
    normal: 'bg-blue-500 border-blue-500',
    low: 'bg-gray-400 border-gray-400',
  };
  const priorityDot = priorityColors[notification.priority] || priorityColors.normal;

  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all hover:bg-gray-50 ${
        !notification.isRead ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-white'
      }`}
      onClick={() => {
        if (!notification.isRead) onRead(notification.id);
        onClick(notification.actionUrl);
      }}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${priorityDot} bg-opacity-10`}>
        <Icon className="h-5 w-5 text-gray-700" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 text-sm">{notification.title}</span>
          {!notification.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>}
        </div>
        <p className="text-sm text-gray-600 mt-0.5">{notification.message}</p>
        <span className="text-xs text-gray-400 mt-1 block">{notification.time}</span>
      </div>
      <button
        className="text-gray-400 hover:text-gray-600 transition p-1"
        onClick={(e) => {
          e.stopPropagation();
          if (!notification.isRead) onRead(notification.id);
          toast.info('Notification marked as read');
        }}
        title="Mark as read"
      >
        <FiCheck className="h-4 w-4" />
      </button>
    </div>
  );
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [activeTab, setActiveTab] = useState('all');

  const tabs = [
    { id: 'all', label: 'All', icon: FiBell },
    { id: 'unread', label: 'Unread', icon: FiEye },
    { id: 'mentions', label: 'Mentions', icon: FiAtSign },
    { id: 'tasks', label: 'Tasks', icon: FiCheckSquare },
    { id: 'messages', label: 'Messages', icon: FiMessageCircle },
    { id: 'services', label: 'Services', icon: FiBriefcase },
    { id: 'system', label: 'System', icon: FiActivity },
  ];

  const filtered = useMemo(() => {
    switch (activeTab) {
      case 'all': return notifications;
      case 'unread': return notifications.filter(n => !n.isRead);
      case 'mentions': return notifications.filter(n => n.type === 'mention');
      case 'tasks': return notifications.filter(n => n.type === 'task');
      case 'messages': return notifications.filter(n => n.type === 'message');
      case 'services': return notifications.filter(n => n.type === 'service');
      case 'system': return notifications.filter(n => n.type === 'system');
      default: return notifications;
    }
  }, [notifications, activeTab]);

  const grouped = useMemo(() => {
    const groups = { Today: [], Yesterday: [], Older: [] };
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    filtered.forEach(n => {
      // For demo, we use the time string to guess group
      if (n.time.includes('min') || n.time.includes('hour')) {
        groups.Today.push(n);
      } else if (n.time.includes('Yesterday')) {
        groups.Yesterday.push(n);
      } else {
        groups.Older.push(n);
      }
    });
    return groups;
  }, [filtered]);

  const handleMarkRead = (id) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  };

  const handleNotificationClick = (url) => {
    if (url) {
      navigate(url);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
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
        <button
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
          onClick={() => {
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            toast.success('All marked as read');
          }}
        >
          <FiCheck className="h-4 w-4" /> Mark all read
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200 pb-0.5">
        {tabs.map(tab => {
          const count = tab.id === 'all' ? notifications.length :
                        tab.id === 'unread' ? unreadCount :
                        notifications.filter(n => n.type === tab.id).length;
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

      {/* Notification List */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([group, items]) => {
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">{group}</h3>
              <div className="space-y-2">
                {items.map(n => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onRead={handleMarkRead}
                    onClick={handleNotificationClick}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <FiBell className="h-8 w-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700">No notifications</h3>
            <p className="text-sm text-gray-400 mt-1">You're all caught up</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;