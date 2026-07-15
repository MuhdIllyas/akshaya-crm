export const NOTIFICATION_CATEGORIES = {
  COMMUNICATION: 'communication',
  WORK: 'work',
  FINANCE: 'finance',
  SYSTEM: 'system'
};

export const NOTIFICATION_TYPES = {
  MENTION: 'mention',
  WHATSAPP_MESSAGE: 'whatsapp_message',
  TASK_ASSIGNED: 'task_assigned',
  TASK_COMPLETED: 'task_completed',
  SERVICE_ASSIGNED: 'service_assigned',
  SERVICE_COMPLETED: 'service_completed',
  CALENDAR: 'calendar',
  EXPENSE: 'expense',
  EXPENSE_APPROVED: 'expense_approved',
  PAYMENT: 'payment',
  REVIEW: 'review',
  TEAM: 'team',
  SYSTEM: 'system'
};

export const notificationTemplates = {
  mention: (data) => ({
    type: NOTIFICATION_TYPES.MENTION,
    category: NOTIFICATION_CATEGORIES.COMMUNICATION,
    title: 'You were mentioned',
    message: `${data.senderName} mentioned you.`,
    priority: 'high',
    metadata: data.metadata || {}
  }),

  whatsappMessage: (data) => ({
    type: NOTIFICATION_TYPES.WHATSAPP_MESSAGE,
    category: NOTIFICATION_CATEGORIES.COMMUNICATION,
    title: 'New WhatsApp Message',
    message: `${data.customerName} sent a message.`,
    priority: 'high',
    metadata: data.metadata || {}
  }),

  taskAssigned: (data) => ({
    type: NOTIFICATION_TYPES.TASK_ASSIGNED,
    category: NOTIFICATION_CATEGORIES.WORK,
    title: '📝 Task Assigned',
    message: 'You have been assigned a new task.',
    priority: data.priority || 'medium',
    // 🔥 Human-readable keys for the frontend
    metadata: {
      'Task': data.taskTitle,
      'Assigned by': data.assignedByName,
      'Due Date': data.dueDate
    }
  }),

  systemAnnouncement: (data) => ({
    type: NOTIFICATION_TYPES.SYSTEM,
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    title: data.title || 'System Announcement',
    message: data.message,
    priority: 'normal',
    metadata: data.metadata || {}
  })
  
  // Add other templates here as the CRM grows...
};