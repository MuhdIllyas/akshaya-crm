export const NOTIFICATION_CATEGORIES = {
  COMMUNICATION: 'communication',
  WORK: 'work',
  FINANCE: 'finance',
  SYSTEM: 'system',
  KNOWLEDGE: 'knowledge'
};

export const NOTIFICATION_TYPES = {
  MENTION: 'mention',
  WHATSAPP_MESSAGE: 'whatsapp_message',
  CONVERSATION_ASSIGNED: 'conversation_assigned',
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
  SYSTEM: 'system',

  //Operation Hub
  KNOWLEDGE_MENTION: 'knowledge_mention',
  KNOWLEDGE_REPLY: 'knowledge_reply',
  KNOWLEDGE_SOLVED: 'knowledge_solved',
  KNOWLEDGE_UPVOTE: 'knowledge_upvote',
  KNOWLEDGE_REACTION: 'knowledge_reaction'
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

  chatAssigned: (data) => ({
    type: NOTIFICATION_TYPES.CONVERSATION_ASSIGNED,
    category: NOTIFICATION_CATEGORIES.COMMUNICATION,
    title: '👤 Chat Assigned',
    message: `${data.senderName} assigned you a conversation with ${data.chatName}.`,
    priority: 'high',
    metadata: {
      'Customer': data.chatName,
      'Assigned By': data.senderName
    }
  }),

  // 🔥 Review Template
  reviewReceived: (data) => ({
    type: NOTIFICATION_TYPES.REVIEW,
    category: NOTIFICATION_CATEGORIES.WORK,
    title: `⭐ New ${data.rating}-Star Review!`,
    message: `You received a ${data.rating}-star review from ${data.customerName}.`,
    // If it's a 1 or 2-star review, make it high priority so they see it instantly!
    priority: data.rating <= 2 ? 'high' : 'normal', 
    metadata: {
      'Customer': data.customerName,
      'Rating': `${data.rating} / 5 Stars`
    }
  }),

  systemAnnouncement: (data) => ({
    type: NOTIFICATION_TYPES.SYSTEM,
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    title: data.title || 'System Announcement',
    message: data.message,
    priority: 'normal',
    metadata: data.metadata || {}
  }),

  // ==========================================
  // 🔥 KNOWLEDGE HUB TEMPLATES
  // ==========================================
  knowledgeMention: (data) => ({
    type: NOTIFICATION_TYPES.KNOWLEDGE_MENTION,
    category: NOTIFICATION_CATEGORIES.KNOWLEDGE,
    title: '📣 Mentioned in Discussion',
    message: `${data.senderName} mentioned you in a discussion.`,
    priority: 'high',
    metadata: {
      'Discussion': data.discussionTitle
    }
  }),

  knowledgeReply: (data) => ({
    type: NOTIFICATION_TYPES.KNOWLEDGE_REPLY,
    category: NOTIFICATION_CATEGORIES.KNOWLEDGE,
    title: '💬 New Reply',
    message: `${data.senderName} replied to your discussion.`,
    priority: 'normal',
    metadata: {
      'Discussion': data.discussionTitle
    }
  }),

  knowledgeSolved: (data) => ({
    type: NOTIFICATION_TYPES.KNOWLEDGE_SOLVED,
    category: NOTIFICATION_CATEGORIES.KNOWLEDGE,
    title: '🏆 Best Answer!',
    message: `Your reply was marked as the Best Answer.`,
    priority: 'high',
    metadata: {
      'Discussion': data.discussionTitle,
      'Marked By': data.solvedByName
    }
  }),

  knowledgeUpvote: (data) => ({
    type: NOTIFICATION_TYPES.KNOWLEDGE_UPVOTE,
    category: NOTIFICATION_CATEGORIES.KNOWLEDGE,
    title: '👍 Upvote Received',
    message: `${data.senderName} upvoted your post.`,
    priority: 'low', 
    metadata: {
      'Discussion': data.discussionTitle
    }
  }),

  knowledgeReaction: (data) => ({
    type: NOTIFICATION_TYPES.KNOWLEDGE_REACTION,
    category: NOTIFICATION_CATEGORIES.KNOWLEDGE,
    title: `${data.emoji} New Reaction`,
    message: `${data.senderName} reacted to your post.`,
    priority: 'low', 
    metadata: {
      'Discussion': data.discussionTitle
    }
  })
  
  // Add other templates here as the CRM grows...
};