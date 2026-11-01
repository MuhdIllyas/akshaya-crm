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
  'document.edit':       MANAGERS, // + contributors with role OWNER / EDITOR
  'document.delete':     MANAGERS,

  'resource.add':        MANAGERS,
  'resource.delete':     MANAGERS,
  'contributor.manage':  MANAGERS,

  'announcement.create': MANAGERS,
  'training.create':     EVERYONE, // staff can share good training material too

  'discussion.create':   EVERYONE,
  'discussion.reply':    EVERYONE,
  'discussion.solve':    MANAGERS, // + the discussion's author

  'suggestion.create':   EVERYONE,
  'suggestion.review':   MANAGERS, // + contributors with role OWNER / EDITOR / REVIEWER
};

export const EDITOR_ROLES = ['OWNER', 'EDITOR'];
export const REVIEWER_ROLES = ['OWNER', 'EDITOR', 'REVIEWER'];

export const getCurrentUser = () => ({
  id: localStorage.getItem('id'),
  role: localStorage.getItem('role') || STAFF,
  centre_id: localStorage.getItem('centre_id'),
});

/**
 * can('document.edit', { workspace })
 * can('discussion.solve', { authorId })
 * can('suggestion.review', { workspace, contributorRole })
 */
export const can = (action, ctx = {}, user = getCurrentUser()) => {
  if (!user?.role) return false;

  if (action === 'discussion.solve' && ctx.authorId != null &&
      String(ctx.authorId) === String(user.id)) {
    return true;
  }

  // Per-service contributor roles (OWNER / EDITOR / REVIEWER) for this workspace
  const cRole = String(ctx.contributorRole || '').toUpperCase();
  if (action === 'document.edit' && EDITOR_ROLES.includes(cRole)) return true;
  if (action === 'suggestion.review' && REVIEWER_ROLES.includes(cRole)) return true;

  const allowed = PERMISSIONS[action];
  if (!allowed || !allowed.includes(user.role)) return false;

  if (user.role === ADMIN && ctx.workspace?.scope === 'CENTRE' &&
      String(ctx.workspace.centre_id) !== String(user.centre_id)) {
    return false;
  }

  return true;
};