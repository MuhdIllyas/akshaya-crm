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
  SALARY_PAID: 'salary_paid',

  //Operation Hub
  KNOWLEDGE_MENTION: 'knowledge_mention',
  KNOWLEDGE_REPLY: 'knowledge_reply',
  KNOWLEDGE_SOLVED: 'knowledge_solved',
  KNOWLEDGE_UPVOTE: 'knowledge_upvote',
  KNOWLEDGE_REACTION: 'knowledge_reaction',

  // Operations Hub — knowledge updates
  KNOWLEDGE_DOC_PUBLISHED: 'knowledge_doc_published',
  KNOWLEDGE_DOC_UPDATED: 'knowledge_doc_updated',
  KNOWLEDGE_FAQ_ADDED: 'knowledge_faq_added',
  KNOWLEDGE_SUGGESTION_SUBMITTED: 'knowledge_suggestion_submitted',
  KNOWLEDGE_SUGGESTION_APPROVED: 'knowledge_suggestion_approved',
  KNOWLEDGE_SUGGESTION_REJECTED: 'knowledge_suggestion_rejected',
  KNOWLEDGE_NEW_DISCUSSION: 'knowledge_new_discussion',
  KNOWLEDGE_FOLLOWED_REPLY: 'knowledge_followed_reply',
  KNOWLEDGE_DISCUSSION_SOLVED: 'knowledge_discussion_solved',
  KNOWLEDGE_ANNOUNCEMENT: 'knowledge_announcement',
  KNOWLEDGE_TRAINING: 'knowledge_training',
  KNOWLEDGE_CONTRIBUTOR_ADDED: 'knowledge_contributor_added',
  KNOWLEDGE_RESOURCE_ADDED: 'knowledge_resource_added',
  KNOWLEDGE_WORKSPACE_PUBLISHED: 'knowledge_workspace_published',

  // Leads (WhatsApp bot / walk-in enquiries)
  LEAD_NEW: 'lead_new',
  LEAD_ASSIGNED: 'lead_assigned',
  LEAD_ENQUIRY: 'lead_enquiry'
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
  }),

  // ==========================================
  // 🔥 KNOWLEDGE HUB — CONTENT UPDATES
  // ==========================================
  knowledgeDocPublished: (data) => ({
    type: NOTIFICATION_TYPES.KNOWLEDGE_DOC_PUBLISHED,
    category: NOTIFICATION_CATEGORIES.KNOWLEDGE,
    title: `📘 New ${data.documentTitle}: ${data.serviceName}`,
    message: `${data.serviceName} now has a ${data.documentTitle}. Read it and suggest improvements.`,
    priority: 'normal',
    metadata: {
      'Service': data.serviceName,
      'Document': data.documentTitle,
      'Written by': data.actorName
    }
  }),

  knowledgeDocUpdated: (data) => ({
    type: NOTIFICATION_TYPES.KNOWLEDGE_DOC_UPDATED,
    category: NOTIFICATION_CATEGORIES.KNOWLEDGE,
    title: `📝 ${data.serviceName} ${data.documentTitle} updated`,
    message: `${data.actorName} updated the ${data.documentTitle}: ${data.changes}.`,
    priority: 'normal',
    metadata: {
      'Service': data.serviceName,
      'Document': data.documentTitle,
      'Changes': data.changes,
      'Updated by': data.actorName,
      ...(data.suggestedBy ? { 'Suggested by': data.suggestedBy } : {})
    }
  }),

  knowledgeFaqAdded: (data) => ({
    type: NOTIFICATION_TYPES.KNOWLEDGE_FAQ_ADDED,
    category: NOTIFICATION_CATEGORIES.KNOWLEDGE,
    title: `❓ New FAQ in ${data.serviceName}`,
    message: data.moreCount > 0
      ? `"${data.question}" and ${data.moreCount} more question${data.moreCount > 1 ? 's' : ''}.`
      : `"${data.question}"`,
    priority: 'normal',
    metadata: {
      'Service': data.serviceName,
      'Question': data.question,
      'Added by': data.actorName,
      ...(data.suggestedBy ? { 'Suggested by': data.suggestedBy } : {})
    }
  }),

  knowledgeSuggestionSubmitted: (data) => ({
    type: NOTIFICATION_TYPES.KNOWLEDGE_SUGGESTION_SUBMITTED,
    category: NOTIFICATION_CATEGORIES.KNOWLEDGE,
    title: '📥 Suggestion to review',
    message: `${data.authorName} suggested ${data.fromDiscussion ? 'a new FAQ entry for' : 'a change to'} ${data.serviceName} ${data.documentTitle}.`,
    priority: 'normal',
    metadata: {
      'Service': data.serviceName,
      'Document': data.documentTitle,
      'Suggested by': data.authorName,
      ...(data.note ? { 'Note': data.note } : {})
    }
  }),

  knowledgeSuggestionApproved: (data) => ({
    type: NOTIFICATION_TYPES.KNOWLEDGE_SUGGESTION_APPROVED,
    category: NOTIFICATION_CATEGORIES.KNOWLEDGE,
    title: '✅ Suggestion approved',
    message: `${data.reviewerName} approved your change to ${data.serviceName} ${data.documentTitle}. It's live now — thank you!`,
    priority: 'high',
    metadata: {
      'Service': data.serviceName,
      'Document': data.documentTitle,
      'Approved by': data.reviewerName,
      ...(data.note ? { 'Note': data.note } : {})
    }
  }),

  knowledgeSuggestionRejected: (data) => ({
    type: NOTIFICATION_TYPES.KNOWLEDGE_SUGGESTION_REJECTED,
    category: NOTIFICATION_CATEGORIES.KNOWLEDGE,
    title: '↩️ Suggestion needs changes',
    message: `${data.reviewerName} didn't approve your change to ${data.serviceName} ${data.documentTitle}.`,
    priority: 'high',
    metadata: {
      'Service': data.serviceName,
      'Document': data.documentTitle,
      'Reviewed by': data.reviewerName,
      'Reason': data.reason
    }
  }),

  knowledgeNewDiscussion: (data) => ({
    type: NOTIFICATION_TYPES.KNOWLEDGE_NEW_DISCUSSION,
    category: NOTIFICATION_CATEGORIES.KNOWLEDGE,
    title: `💬 New question in ${data.serviceName}`,
    message: `${data.authorName} asked: "${data.discussionTitle}". Can you help?`,
    priority: data.priority === 'high' || data.priority === 'critical' ? 'high' : 'normal',
    metadata: {
      'Service': data.serviceName,
      'Discussion': data.discussionTitle,
      'Asked by': data.authorName
    }
  }),

  knowledgeFollowedReply: (data) => ({
    type: NOTIFICATION_TYPES.KNOWLEDGE_FOLLOWED_REPLY,
    category: NOTIFICATION_CATEGORIES.KNOWLEDGE,
    title: '💬 New reply in a discussion you follow',
    message: `${data.senderName} replied in "${data.discussionTitle}".`,
    priority: 'normal',
    metadata: {
      'Discussion': data.discussionTitle,
      'Reply by': data.senderName
    }
  }),

  knowledgeDiscussionSolved: (data) => ({
    type: NOTIFICATION_TYPES.KNOWLEDGE_DISCUSSION_SOLVED,
    category: NOTIFICATION_CATEGORIES.KNOWLEDGE,
    title: '✅ Discussion solved',
    message: `"${data.discussionTitle}" has been solved.`,
    priority: 'normal',
    metadata: {
      'Discussion': data.discussionTitle,
      'Solved by': data.solvedByName
    }
  }),

  knowledgeAnnouncement: (data) => ({
    type: NOTIFICATION_TYPES.KNOWLEDGE_ANNOUNCEMENT,
    category: NOTIFICATION_CATEGORIES.KNOWLEDGE,
    title: `📢 ${data.title}`,
    message: String(data.content || '').length > 160 ? `${String(data.content).slice(0, 157)}...` : (data.content || ''),
    priority: data.priority === 'high' ? 'high' : 'normal',
    metadata: {
      'Sent to': data.sentTo || 'Everyone',
      'Category': data.category,
      'Posted by': data.authorName
    }
  }),

  knowledgeTraining: (data) => ({
    type: NOTIFICATION_TYPES.KNOWLEDGE_TRAINING,
    category: NOTIFICATION_CATEGORIES.KNOWLEDGE,
    title: `🎓 New training: ${data.title}`,
    message: data.description || 'A new training is available in the Learning Center.',
    priority: 'normal',
    metadata: {
      'Type': data.type === 'video' ? 'Video' : 'Guide',
      ...(data.duration ? { 'Duration': data.duration } : {}),
      'Added by': data.authorName
    }
  }),

  knowledgeContributorAdded: (data) => ({
    type: NOTIFICATION_TYPES.KNOWLEDGE_CONTRIBUTOR_ADDED,
    category: NOTIFICATION_CATEGORIES.KNOWLEDGE,
    title: `⭐ You're now ${data.roleLabel} of ${data.serviceName}`,
    message: data.roleHelp,
    priority: 'high',
    metadata: {
      'Service': data.serviceName,
      'Role': data.roleLabel,
      'Added by': data.actorName
    }
  }),

  knowledgeResourceAdded: (data) => ({
    type: NOTIFICATION_TYPES.KNOWLEDGE_RESOURCE_ADDED,
    category: NOTIFICATION_CATEGORIES.KNOWLEDGE,
    title: `🔗 New resource in ${data.serviceName}`,
    message: data.title,
    priority: 'low',
    metadata: {
      'Service': data.serviceName,
      'Resource': data.title,
      'Added by': data.actorName
    }
  }),

  knowledgeWorkspacePublished: (data) => ({
    type: NOTIFICATION_TYPES.KNOWLEDGE_WORKSPACE_PUBLISHED,
    category: NOTIFICATION_CATEGORIES.KNOWLEDGE,
    title: `🚀 ${data.serviceName} guide published`,
    message: `The ${data.serviceName} SOP and FAQ are now the official guide for all centres.`,
    priority: 'normal',
    metadata: {
      'Service': data.serviceName,
      'Published by': data.actorName
    }
  }),

  salaryPaid: (data) => ({
    type: NOTIFICATION_TYPES.SALARY_PAID,
    category: NOTIFICATION_CATEGORIES.FINANCE,
    title: '💰 Salary Disbursed',
    message: `Your salary for ${data.month} has been successfully paid to your account.`,
    priority: 'high',
    metadata: {
      'Month': data.month,
      'Net Pay': data.amount,
      'Disbursed By': data.disbursedBy
    }
  }),

  // ==========================================
  // 🔥 LEADS
  // ==========================================
  leadNew: (data) => ({
    type: NOTIFICATION_TYPES.LEAD_NEW,
    category: NOTIFICATION_CATEGORIES.WORK,
    title: data.fromBot ? '🟢 New WhatsApp lead' : '🟢 New lead',
    message: `${data.customerName} is asking about ${data.serviceName}. ` +
      (data.forAdmin ? 'Assign it to a staff member.' : 'Open Leads to take it.'),
    priority: 'high',
    metadata: {
      'Customer': data.customerName,
      'Phone': data.phone,
      'Service': data.serviceName,
      ...(data.docsReady ? { 'Documents': data.docsReady } : {})
    }
  }),

  leadAssigned: (data) => ({
    type: NOTIFICATION_TYPES.LEAD_ASSIGNED,
    category: NOTIFICATION_CATEGORIES.WORK,
    title: '👤 Lead assigned to you',
    message: `${data.customerName} · ${data.serviceName}. Contact the customer and update the lead.`,
    priority: 'high',
    metadata: {
      'Customer': data.customerName,
      'Phone': data.phone,
      'Service': data.serviceName,
      ...(data.assignedByName ? { 'Assigned by': data.assignedByName } : {})
    }
  }),

  leadEnquiry: (data) => ({
    type: NOTIFICATION_TYPES.LEAD_ENQUIRY,
    category: NOTIFICATION_CATEGORIES.WORK,
    title: '🔁 Your lead asked again',
    message: `${data.customerName} messaged again on WhatsApp about ${data.serviceName}.`,
    priority: 'high',
    metadata: {
      'Customer': data.customerName,
      'Phone': data.phone,
      'Service': data.serviceName
    }
  })
  
  // Add other templates here as the CRM grows...
};