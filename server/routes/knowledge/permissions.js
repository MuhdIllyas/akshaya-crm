// knowledge - permissions.js
// =====================================================================
// ONE place that decides who can do what in the Operations Hub.
// The frontend has a matching copy (src/utils/knowledgePermissions.js).
// If you change a rule here, change it there too.
// =====================================================================

const STAFF = 'staff';
const ADMIN = 'admin';
const SUPERADMIN = 'superadmin';
const EVERYONE = [STAFF, ADMIN, SUPERADMIN];
const MANAGERS = [ADMIN, SUPERADMIN];

export const PERMISSIONS = {
    // Workspace
    'workspace.view':      EVERYONE,
    'workspace.publish':   [SUPERADMIN],

    // SOP / FAQ / custom documents (global, written by admins + superadmins)
    'document.create':     MANAGERS,
    'document.edit':       MANAGERS,
    'document.delete':     MANAGERS,

    // Resources & contributors
    'resource.add':        MANAGERS,
    'resource.delete':     MANAGERS,
    'contributor.manage':  MANAGERS,

    // Hub-wide content
    'announcement.create': MANAGERS,
    'training.create':     MANAGERS,

    // Discussions
    'discussion.create':   EVERYONE,
    'discussion.reply':    EVERYONE,
    'discussion.solve':    MANAGERS, // + the discussion's author (see can())
};

export const WORKSPACE_STATUSES = ['draft', 'in_review', 'published'];
export const CONTRIBUTOR_ROLES = ['OWNER', 'EDITOR', 'REVIEWER', 'VIEWER'];

/**
 * can(user, action, ctx)
 *   user: req.user ({ id, role, centre_id })
 *   ctx (optional):
 *     authorId  — for discussion.solve: the author may solve their own thread
 *     workspace — a knowledge_workspaces row; an admin may only change a
 *                 CENTRE-scoped workspace that belongs to their own centre
 */
export const can = (user, action, ctx = {}) => {
    if (!user || !user.role) return false;
    const role = user.role;

    if (action === 'discussion.solve' && ctx.authorId != null &&
        String(ctx.authorId) === String(user.id)) {
        return true;
    }

    const allowed = PERMISSIONS[action];
    if (!allowed || !allowed.includes(role)) return false;

    // Admins control their own centre only
    if (role === ADMIN && ctx.workspace?.scope === 'CENTRE' &&
        String(ctx.workspace.centre_id) !== String(user.centre_id)) {
        return false;
    }

    return true;
};

// Route middleware: router.post('/x', requirePermission('document.edit'), handler)
export const requirePermission = (action) => (req, res, next) => {
    if (!can(req.user, action)) {
        return res.status(403).json({ error: 'You do not have permission to do this.' });
    }
    next();
};

// Errors with an HTTP status, so controllers can send 400/403/404 instead of 500
export class KnowledgeError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

export const sendError = (res, err, fallbackMessage) => {
    if (err instanceof KnowledgeError) {
        return res.status(err.status).json({ error: err.message });
    }
    console.error(`💥 ${fallbackMessage}:`, err);
    return res.status(500).json({ error: fallbackMessage });
};