import { io } from '../server.js';

const socketNotifications = {
  emitNotification: (recipientStaffId, notification) => {
    if (io) io.to(`user:${recipientStaffId}`).emit('notification', notification);
  },

  emitUnreadCount: (recipientStaffId, count) => {
    if (io) io.to(`user:${recipientStaffId}`).emit('notification_count', { unread: count });
  },

  emitNotificationUpdated: (recipientStaffId, notification) => {
    if (io) io.to(`user:${recipientStaffId}`).emit('notification_updated', notification);
  },

  emitNotificationDeleted: (recipientStaffId, notificationId) => {
    if (io) io.to(`user:${recipientStaffId}`).emit('notification_deleted', { id: notificationId });
  }
};

export default socketNotifications;