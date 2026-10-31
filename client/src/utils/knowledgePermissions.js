// src/utils/knowledgePermissions.js
// =====================================================================
// Frontend copy of the backend rules in knowledge/permissions.js.
// Used only to HIDE buttons a user can't use; the backend still enforces
// every rule. If you change a rule there, change it here too.
// =====================================================================

const STAFF = 'staff';
const ADMIN = 'admin';
const SUPERADMIN = 'superadmin';
const EVERYONE = [STAFF, ADMIN, SUPERADMIN];
const MANAGERS = [ADMIN, SUPERADMIN];

export const PERMISSIONS = {
  'workspace.view':      EVERYONE,
  'workspace.publish':   [SUPERADMIN],

  'document.create':     MANAGERS,
  'document.edit':       MANAGERS,
  'document.delete':     MANAGERS,

  'resource.add':        MANAGERS,
  'resource.delete':     MANAGERS,
  'contributor.manage':  MANAGERS,

  'announcement.create': MANAGERS,
  'training.create':     EVERYONE, // staff can share good training material too

  'discussion.create':   EVERYONE,
  'discussion.reply':    EVERYONE,
  'discussion.solve':    MANAGERS, // + the discussion's author
};

export const getCurrentUser = () => ({
  id: localStorage.getItem('id'),
  role: localStorage.getItem('role') || STAFF,
  centre_id: localStorage.getItem('centre_id'),
});

/**
 * can('document.edit', { workspace })
 * can('discussion.solve', { authorId })
 */
export const can = (action, ctx = {}, user = getCurrentUser()) => {
  if (!user?.role) return false;

  if (action === 'discussion.solve' && ctx.authorId != null &&
      String(ctx.authorId) === String(user.id)) {
    return true;
  }

  const allowed = PERMISSIONS[action];
  if (!allowed || !allowed.includes(user.role)) return false;

  if (user.role === ADMIN && ctx.workspace?.scope === 'CENTRE' &&
      String(ctx.workspace.centre_id) !== String(user.centre_id)) {
    return false;
  }

  return true;
};