import React, { createContext, useContext, useState, useEffect } from 'react';
import { socket } from '../services/socket.js';
import { toast } from 'react-toastify';

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  // We define the token here so React can watch it for changes
  const token = localStorage.getItem('token');

  // 1. Fetch initial count on mount AND whenever the token changes (login/logout)
  useEffect(() => {
    const fetchInitialCount = async () => {
      try {
        if (!token) {
          setUnreadCount(0); // Clear count if logged out
          return;
        }

        const API_BASE_URL = import.meta.env.VITE_API_URL;
        
        const res = await fetch(`${API_BASE_URL}/api/notifications/count`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) return; // Fail silently if auth fails
        
        const data = await res.json();
        if (data.unread !== undefined) {
          setUnreadCount(data.unread);
        }
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };

    fetchInitialCount();
  }, [token]); // <-- Now it re-runs automatically on login/logout

  // 2. Listen to Global Socket Events
  useEffect(() => {
    const handleNotificationCount = (data) => {
      setUnreadCount(data.unread);
    };

    const handleNewNotification = (notification) => {
      // Optimistically increase the bell count instantly
      setUnreadCount((prev) => prev + 1);

      // 🔥 EXPLICIT WHITELIST: Always show toasts for these specific types, plus anything 'high' priority
      const allowedToastTypes = ['whatsapp_message', 'mention', 'review', 'conversation_assigned'];

      if (
        notification.priority === 'high' || 
        notification.type?.includes('message') ||
        allowedToastTypes.includes(notification.type)
      ) {
        toast.info(
          <div>
            <strong>{notification.title}</strong>
            <p className="text-sm">{notification.message}</p>
          </div>,
          { 
            position: "top-right", 
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true
          }
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