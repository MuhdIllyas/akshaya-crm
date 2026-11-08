// Where a notification should take you when it's clicked.
// Used by the toast (NotificationContext) and can be reused by the bell / Notifications page.

const role = () => localStorage.getItem('role') || 'staff';
const hub = () => `/dashboard/${role()}/operationshub`;

export const getNotificationLink = (n) => {
  if (!n) return null;
  const type = n.related_entity_type || n.relatedEntityType;
  const id = n.related_entity_id ?? n.relatedEntityId;

  switch (type) {
    case 'knowledge_service':      return id ? `${hub()}/${id}` : hub();
    case 'knowledge_suggestion':   return `${hub()}/suggestions`;
    case 'knowledge_announcement': return `${hub()}/announcements`;
    case 'knowledge_training':     return `${hub()}/learning`;
    case 'discussion':             return id ? `${hub()}?discussion=${id}` : hub();
    case 'lead':                   return `/dashboard/${role()}/leads`;
    default:                       return null;
  }
};

// Change page without reloading (works with React Router's BrowserRouter,
// even from outside a component that can use useNavigate).
export const goTo = (path) => {
  if (!path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};