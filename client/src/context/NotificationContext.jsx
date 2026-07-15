import React, { createContext, useContext, useState, useEffect } from 'react';
import { socket } from '../services/socket.js';
import { toast } from 'react-toastify';

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  // 1. Fetch initial count on mount
  useEffect(() => {
    const fetchInitialCount = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const res = await fetch('/api/notifications/count', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.unread !== undefined) {
          setUnreadCount(data.unread);
        }
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };

    fetchInitialCount();
  }, []);

  // 2. Listen to Global Socket Events
  useEffect(() => {
    const handleNotificationCount = (data) => {
      setUnreadCount(data.unread);
    };

    const handleNewNotification = (notification) => {
      // Show a global toast for high-priority or communication alerts
      if (notification.priority === 'high' || notification.type.includes('message')) {
        toast.info(
          <div>
            <strong>{notification.title}</strong>
            <p className="text-sm">{notification.message}</p>
          </div>,
          { position: "top-right", autoClose: 5000 }
        );
      }
    };

    socket.on('notification_count', handleNotificationCount);
    socket.on('notification', handleNewNotification);

    return () => {
      socket.off('notification_count', handleNotificationCount);
      socket.off('notification', handleNewNotification);
    };
  }, []);

  // Provide a manual way to update the count from UI components
  const decrementUnread = () => setUnreadCount((prev) => Math.max(0, prev - 1));
  const clearUnread = () => setUnreadCount(0);

  return (
    <NotificationContext.Provider value={{ unreadCount, setUnreadCount, decrementUnread, clearUnread }}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;