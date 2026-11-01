// knowledge - notify.js
// =====================================================================
// Who hears about what in the Operations Hub.
// Every function here is "fire and forget": a notification problem is
// logged but never breaks the save / approve / post that triggered it.
// The person who did the action is never notified about it.
// =====================================================================
import pool from '../../db.js';
import notificationService from '../../utils/notificationService.js';
import { notificationTemplates } from '../../utils/notificationTemplates.js';
import { REVIEWER_ROLES } from './permissions.js';

// Staff who have left / been switched off don't get notifications
const ACTIVE = `LOWER(COALESCE(s.status::text, 'active')) NOT IN ('inactive', 'terminated', 'resigned', 'disabled', 'left', 'deleted', 'suspended')`;

const ids = (rows) => [...new Set(rows.map(r => Number(r.id)).filter(n => Number.isInteger(n)))];
const without = (list, exclude = []) => {
    const ex = new Set(exclude.filter(v => v !== null && v !== undefined).map(Number));
    return list.filter(id => !ex.has(Number(id)));
};

// ---------------------------------------------------------------------
// Audiences
// ---------------------------------------------------------------------

// Staff (any role) at every centre where the service is enabled
export const serviceStaff = async (serviceId) => ids((await pool.query(
    `SELECT s.id FROM staff s
     WHERE ${ACTIVE}
       AND s.centre_id IN (
         SELECT centre_id FROM service_configurations
         WHERE service_id = $1 AND is_enabled = true
       )`,
    [serviceId]
)).rows);

// Everyone (for announcements and trainings)
export const allStaff = async () => ids((await pool.query(`SELECT s.id FROM staff s WHERE ${ACTIVE}`)).rows);

// People who can approve suggestions for this workspace
export const reviewers = async (workspace) => ids((await pool.query(
    `SELECT s.id FROM staff s
     WHERE ${ACTIVE}
       AND (
         s.role::text = 'superadmin'
         OR (s.role::text = 'admin' AND ($2::text <> 'CENTRE' OR s.centre_id::text = $3::text))
         OR s.id IN (
           SELECT kc.staff_id FROM knowledge_contributors kc
           WHERE kc.workspace_id = $1 AND UPPER(kc.role::text) = ANY($4::text[])
         )
       )`,
    [workspace.id, workspace.scope || 'GLOBAL', String(workspace.centre_id ?? ''), REVIEWER_ROLES]
)).rows);

// Everyone at one centre
export const centreStaff = async (centreId) => ids((await pool.query(
    `SELECT s.id FROM staff s WHERE ${ACTIVE} AND s.centre_id::text = $1::text`,
    [String(centreId)]
)).rows);

// Active members of one team (works for global teams too)
export const teamMembers = async (teamId) => ids((await pool.query(
    `SELECT s.id FROM team_members tm
     JOIN staff s ON s.id = tm.staff_id
     WHERE tm.team_id = $1 AND tm.is_active = true AND ${ACTIVE}`,
    [teamId]
)).rows);

export const followers = async (discussionId) => ids((await pool.query(
    `SELECT f.staff_id AS id FROM knowledge_followers f
     JOIN staff s ON s.id = f.staff_id
     WHERE f.discussion_id = $1 AND ${ACTIVE}`,
    [discussionId]
)).rows);

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
const staffName = async (id) => {
    if (!id) return 'Someone';
    const r = await pool.query('SELECT name FROM staff WHERE id = $1', [id]);
    return r.rows[0]?.name || 'Someone';
};

const workspaceInfo = async (workspaceId) => {
    const r = await pool.query(
        `SELECT kw.id, kw.scope, kw.centre_id, kw.service_id, srv.name AS service_name
         FROM knowledge_workspaces kw
         LEFT JOIN services srv ON srv.id = kw.service_id
         WHERE kw.id = $1`,
        [workspaceId]
    );
    return r.rows[0] || null;
};

const docLabel = (doc) => {
    if (!doc) return 'guide';
    if (doc.system_key === 'sop') return 'SOP';
    if (doc.system_key === 'faq') return 'FAQ';
    if (doc.system_key === 'overview') return 'Overview';
    return doc.title || 'guide';
};

const documentInfo = async (documentId) => {
    const r = await pool.query('SELECT id, title, system_key, workspace_id FROM knowledge_documents WHERE id = $1', [documentId]);
    return r.rows[0] || null;
};

const send = async (templateName, data, { recipients, senderStaffId = null, relatedEntityType = null, relatedEntityId = null, bump = false }) => {
    if (!recipients || recipients.length === 0) return;
    const fields = notificationTemplates[templateName](data);
    const payload = { recipientStaffIds: recipients, senderStaffId, relatedEntityType, relatedEntityId, ...fields };
    if (bump) await notificationService.createOrBumpBulkNotifications(payload);
    else await notificationService.createBulkNotifications(payload);
};

// Run after the request is answered; never throw
const later = (label, fn) => {
    setImmediate(() => {
        Promise.resolve().then(fn).catch(err => console.error(`Knowledge notification failed (${label}):`, err.message));
    });
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ---------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------

/**
 * A document's content changed (direct edit, approved suggestion or Add to FAQ).
 * diff = { added, changed, removed, addedFaqQuestions: [], wasEmpty }
 */
export const documentChanged = ({ workspaceId, documentId, actorId, diff, suggestedById = null }) => later('document changed', async () => {
    if (!diff || diff.added + diff.changed + diff.removed === 0) return; // only reordered
    const ws = await workspaceInfo(workspaceId);
    const doc = await documentInfo(documentId);
    if (!ws || !doc) return;

    const recipients = without(await serviceStaff(ws.service_id), [actorId, suggestedById]);
    const actorName = await staffName(actorId);
    const suggestedBy = suggestedById ? await staffName(suggestedById) : null;
    const base = { serviceName: ws.service_name || 'Service', documentTitle: docLabel(doc), actorName, suggestedBy };
    const target = { recipients, senderStaffId: actorId, relatedEntityType: 'knowledge_service', relatedEntityId: ws.service_id };

    if (diff.wasEmpty && diff.added > 0) {
        await send('knowledgeDocPublished', base, target);
        return;
    }
    // New FAQ questions get their own, clearer notification
    if (diff.addedFaqQuestions?.length && diff.changed === 0 && diff.removed === 0 && diff.added === diff.addedFaqQuestions.length) {
        await send('knowledgeFaqAdded', {
            ...base,
            question: diff.addedFaqQuestions[0],
            moreCount: diff.addedFaqQuestions.length - 1,
        }, target);
        return;
    }
    const parts = [];
    if (diff.added) parts.push(`${diff.added} added`);
    if (diff.changed) parts.push(`${diff.changed} changed`);
    if (diff.removed) parts.push(`${diff.removed} removed`);
    // One "updated" notification per service, refreshed on each save
    // (it links to the service, so clicking it opens that service's guide)
    await send('knowledgeDocUpdated', { ...base, changes: parts.join(', ') }, { ...target, bump: true });
});

export const suggestionSubmitted = ({ suggestion, workspace }) => later('suggestion submitted', async () => {
    const ws = await workspaceInfo(workspace.id);
    const doc = await documentInfo(suggestion.document_id);
    const recipients = without(await reviewers(workspace), [suggestion.author_id]);
    await send('knowledgeSuggestionSubmitted', {
        authorName: await staffName(suggestion.author_id),
        serviceName: ws?.service_name || 'Service',
        documentTitle: docLabel(doc),
        note: suggestion.note || '',
        fromDiscussion: suggestion.source_type === 'discussion',
    }, { recipients, senderStaffId: suggestion.author_id, relatedEntityType: 'knowledge_suggestion', relatedEntityId: suggestion.id });
});

export const suggestionReviewed = ({ suggestion, reviewerId, approved, note }) => later('suggestion reviewed', async () => {
    if (Number(suggestion.author_id) === Number(reviewerId)) return;
    const ws = await workspaceInfo(suggestion.workspace_id);
    const doc = await documentInfo(suggestion.document_id);
    const data = {
        reviewerName: await staffName(reviewerId),
        serviceName: ws?.service_name || 'Service',
        documentTitle: docLabel(doc),
        note: note || '',
        reason: note || '',
    };
    await send(approved ? 'knowledgeSuggestionApproved' : 'knowledgeSuggestionRejected', data, {
        recipients: [Number(suggestion.author_id)], senderStaffId: reviewerId,
        relatedEntityType: approved ? 'knowledge_service' : 'knowledge_suggestion',
        relatedEntityId: approved ? ws?.service_id : suggestion.id,
    });
});

export const discussionCreated = ({ discussion, alreadyNotified = [] }) => later('new discussion', async () => {
    const ws = await workspaceInfo(discussion.workspace_id);
    if (!ws?.service_id) return;
    const recipients = without(await serviceStaff(ws.service_id), [discussion.author_id, ...alreadyNotified]);
    await send('knowledgeNewDiscussion', {
        serviceName: ws.service_name || 'Service',
        discussionTitle: discussion.title,
        authorName: await staffName(discussion.author_id),
        priority: discussion.priority,
    }, { recipients, senderStaffId: discussion.author_id, relatedEntityType: 'discussion', relatedEntityId: discussion.id });
});

export const replyAdded = ({ discussionId, discussionTitle, replierId, alreadyNotified = [] }) => later('followed reply', async () => {
    const recipients = without(await followers(discussionId), [replierId, ...alreadyNotified]);
    await send('knowledgeFollowedReply', {
        senderName: await staffName(replierId), discussionTitle,
    }, { recipients, senderStaffId: replierId, relatedEntityType: 'discussion', relatedEntityId: discussionId });
});

export const discussionSolved = ({ discussionId, discussionTitle, authorId, solverId, alreadyNotified = [] }) => later('discussion solved', async () => {
    const recipients = without([...new Set([Number(authorId), ...(await followers(discussionId))])], [solverId, ...alreadyNotified]);
    await send('knowledgeDiscussionSolved', {
        discussionTitle, solvedByName: await staffName(solverId),
    }, { recipients, senderStaffId: solverId, relatedEntityType: 'discussion', relatedEntityId: discussionId });
});

export const announcementCreated = ({ announcement, actorId }) => later('announcement', async () => {
    // Only the people the announcement is for
    const audience = announcement.audience_type || (announcement.team_id ? 'team' : 'all');
    const everyone = audience === 'team' ? await teamMembers(announcement.team_id)
        : audience === 'centre' ? await centreStaff(announcement.centre_id)
        : await allStaff();
    const recipients = without(everyone, [actorId]);
    let sentTo = 'Everyone';
    if (audience === 'team') {
        const t = await pool.query('SELECT name FROM teams WHERE id = $1', [announcement.team_id]);
        sentTo = `Team: ${t.rows[0]?.name || 'your team'}`;
    } else if (audience === 'centre') {
        const c = await pool.query('SELECT name FROM centres WHERE id = $1', [announcement.centre_id]);
        sentTo = c.rows[0]?.name || 'Your centre';
    }
    await send('knowledgeAnnouncement', {
        title: announcement.title, content: announcement.content, category: announcement.category,
        priority: announcement.priority, authorName: await staffName(actorId), sentTo,
    }, { recipients, senderStaffId: actorId, relatedEntityType: 'knowledge_announcement', relatedEntityId: announcement.id });
});

export const trainingCreated = ({ training, actorId }) => later('training', async () => {
    const recipients = without(await allStaff(), [actorId]);
    await send('knowledgeTraining', {
        title: training.title, description: training.description, type: training.type,
        duration: training.duration, authorName: await staffName(actorId),
    }, { recipients, senderStaffId: actorId, relatedEntityType: 'knowledge_training', relatedEntityId: training.id });
});

const ROLE_TEXT = {
    OWNER:    { label: 'Owner',    help: 'You can edit its SOP and FAQ and approve suggestions from other staff.' },
    EDITOR:   { label: 'Editor',   help: 'You can edit its SOP and FAQ directly and approve suggestions.' },
    REVIEWER: { label: 'Reviewer', help: 'Staff suggestions for this service will come to you for approval.' },
    VIEWER:   { label: 'Viewer',   help: "You'll be kept up to date when its guide changes." },
};

export const contributorAdded = ({ workspaceId, staffId, role, actorId }) => later('contributor added', async () => {
    if (Number(staffId) === Number(actorId)) return;
    const ws = await workspaceInfo(workspaceId);
    const rt = ROLE_TEXT[String(role).toUpperCase()] || ROLE_TEXT.VIEWER;
    await send('knowledgeContributorAdded', {
        serviceName: ws?.service_name || 'a service', roleLabel: rt.label, roleHelp: rt.help, actorName: await staffName(actorId),
    }, { recipients: [Number(staffId)], senderStaffId: actorId, relatedEntityType: 'knowledge_service', relatedEntityId: ws?.service_id });
});

export const resourceAdded = ({ workspaceId, resource, actorId }) => later('resource added', async () => {
    const ws = await workspaceInfo(workspaceId);
    if (!ws?.service_id) return;
    const recipients = without(await serviceStaff(ws.service_id), [actorId]);
    await send('knowledgeResourceAdded', {
        serviceName: ws.service_name || 'Service', title: resource.title, actorName: await staffName(actorId),
    }, { recipients, senderStaffId: actorId, relatedEntityType: 'knowledge_service', relatedEntityId: ws.service_id });
});

export const workspacePublished = ({ workspaceId, actorId }) => later('workspace published', async () => {
    const ws = await workspaceInfo(workspaceId);
    if (!ws?.service_id) return;
    const recipients = without(await serviceStaff(ws.service_id), [actorId]);
    await send('knowledgeWorkspacePublished', {
        serviceName: ws.service_name || 'Service', actorName: await staffName(actorId),
    }, { recipients, senderStaffId: actorId, relatedEntityType: 'knowledge_service', relatedEntityId: ws.service_id });
});

// For tests / callers that want plural text
export const _plural = plural;
