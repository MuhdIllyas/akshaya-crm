//knowledge - service.js
import pool from '../../db.js';
import notificationService from '../../utils/notificationService.js'; 
import { notificationTemplates } from '../../utils/notificationTemplates.js';
import { KnowledgeError, can, REVIEWER_ROLES } from './permissions.js';
import * as notify from './notify.js';

// ==========================================
// PHASE 2: lookups used for permission checks
// (the server works out which workspace something belongs to,
//  instead of trusting a workspaceId sent by the browser)
// ==========================================
export const getWorkspaceById = async (workspaceId) => {
    const res = await pool.query('SELECT * FROM knowledge_workspaces WHERE id = $1 AND deleted_at IS NULL', [workspaceId]);
    if (res.rows.length === 0) throw new KnowledgeError(404, 'Workspace not found.');
    return res.rows[0];
};

export const getDocumentWorkspace = async (documentId) => {
    const res = await pool.query(
        `SELECT kw.* FROM knowledge_documents kd
         JOIN knowledge_workspaces kw ON kw.id = kd.workspace_id
         WHERE kd.id = $1 AND kd.deleted_at IS NULL AND kw.deleted_at IS NULL`,
        [documentId]
    );
    if (res.rows.length === 0) throw new KnowledgeError(404, 'Document not found.');
    return res.rows[0];
};

export const getResourceWorkspace = async (resourceId) => {
    const res = await pool.query(
        `SELECT kw.* FROM knowledge_resources kr
         JOIN knowledge_workspaces kw ON kw.id = kr.workspace_id
         WHERE kr.id = $1 AND kr.deleted_at IS NULL`,
        [resourceId]
    );
    if (res.rows.length === 0) throw new KnowledgeError(404, 'Resource not found.');
    return res.rows[0];
};

// ==========================================
// WORKSPACE & STATS (Inheritance Logic)
// ==========================================
export const getWorkspaceData = async (serviceId, centreId, staffId, role = null) => {
    let workspaceRes = await pool.query(
        `SELECT * FROM knowledge_workspaces 
         WHERE service_id = $1 AND centre_id = $2 AND scope = 'CENTRE' AND deleted_at IS NULL`,
        [serviceId, centreId]
    );

    if (workspaceRes.rows.length === 0) {
        workspaceRes = await pool.query(
            `SELECT * FROM knowledge_workspaces 
             WHERE service_id = $1 AND scope = 'GLOBAL' AND deleted_at IS NULL`,
            [serviceId]
        );
    }

    let workspace;

    if (workspaceRes.rows.length === 0) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // PHASE 1 FIX: ON CONFLICT relies on the partial unique index
            // uq_kw_global_service (see migration). If two people open the
            // service at the same moment, only one workspace gets created.
            const insertWs = await client.query(
                `INSERT INTO knowledge_workspaces (service_id, scope, status)
                 VALUES ($1, 'GLOBAL', 'draft')
                 ON CONFLICT (service_id) WHERE scope = 'GLOBAL' AND deleted_at IS NULL
                 DO NOTHING
                 RETURNING *`,
                [serviceId]
            );

            if (insertWs.rows.length > 0) {
                workspace = insertWs.rows[0];

                // PHASE 3 FIX: OWNER now means "can edit", so only an admin /
                // superadmin who opens a service first becomes its owner.
                // Staff opening it first no longer get edit rights by accident.
                if (['admin', 'superadmin'].includes(role)) {
                    await client.query(
                        `INSERT INTO knowledge_contributors (workspace_id, staff_id, role) VALUES ($1, $2, 'OWNER')
                         ON CONFLICT (workspace_id, staff_id) DO NOTHING`,
                        [workspace.id, staffId]
                    );
                }

                const defaultDocs = [
                    { title: 'Overview', slug: 'overview', key: 'overview', sort: 1000 },
                    { title: 'SOP', slug: 'sop', key: 'sop', sort: 2000 },
                    { title: 'FAQ', slug: 'faq', key: 'faq', sort: 3000 }
                ];

                for (const doc of defaultDocs) {
                    await client.query(
                        `INSERT INTO knowledge_documents (workspace_id, title, slug, system_key, type, sort_order)
                         VALUES ($1, $2, $3, $4, 'SYSTEM', $5)`,
                        [workspace.id, doc.title, doc.slug, doc.key, doc.sort]
                    );
                }
            }
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        // Someone else created it a moment before us — just load theirs.
        if (!workspace) {
            const existing = await pool.query(
                `SELECT * FROM knowledge_workspaces
                 WHERE service_id = $1 AND scope = 'GLOBAL' AND deleted_at IS NULL`,
                [serviceId]
            );
            workspace = existing.rows[0];
        }
    } else {
        workspace = workspaceRes.rows[0];
    }

    const [docsRes, blocksRes, resourcesRes, contributorsRes, discussionsRes, casesRes] = await Promise.all([
        // PHASE 3: each document also carries its pending suggestion count,
        // whether *I* have one waiting, and who last improved it.
        pool.query(
            `SELECT kd.*,
                (SELECT COUNT(*)::int FROM knowledge_suggestions ks
                  WHERE ks.document_id = kd.id AND ks.status = 'pending') AS pending_suggestions,
                EXISTS(SELECT 1 FROM knowledge_suggestions ks
                  WHERE ks.document_id = kd.id AND ks.status = 'pending' AND ks.author_id = $2) AS my_pending_suggestion,
                (SELECT json_build_object('author', a.name, 'reviewer', r.name, 'at', ks.reviewed_at)
                   FROM knowledge_suggestions ks
                   JOIN staff a ON a.id = ks.author_id
                   LEFT JOIN staff r ON r.id = ks.reviewed_by
                  WHERE ks.document_id = kd.id AND ks.status = 'approved'
                  ORDER BY ks.reviewed_at DESC LIMIT 1) AS last_contribution
             FROM knowledge_documents kd
             WHERE kd.workspace_id = $1 AND kd.deleted_at IS NULL
             ORDER BY kd.sort_order ASC`,
            [workspace.id, staffId]
        ),
        pool.query(
            `SELECT kb.* FROM knowledge_blocks kb
             JOIN knowledge_documents kd ON kb.document_id = kd.id
             WHERE kd.workspace_id = $1 AND kb.deleted_at IS NULL 
             ORDER BY kb.sort_order ASC`,
            [workspace.id]
        ),
        pool.query('SELECT * FROM knowledge_resources WHERE workspace_id = $1 AND deleted_at IS NULL ORDER BY id DESC', [workspace.id]),
        pool.query('SELECT c.*, s.name as staff_name FROM knowledge_contributors c JOIN staff s ON c.staff_id = s.id WHERE c.workspace_id = $1', [workspace.id]),
        pool.query('SELECT COUNT(*) FROM knowledge_discussions WHERE workspace_id = $1', [workspace.id]),
        pool.query('SELECT COUNT(*) FROM knowledge_cases WHERE workspace_id = $1', [workspace.id])
    ]);

    const formattedDocs = docsRes.rows.map(doc => ({
        ...doc,
        blocks: blocksRes.rows.filter(b => b.document_id === doc.id)
    }));

    const stats = {
        discussionCount: parseInt(discussionsRes.rows[0].count, 10) || 0, 
        caseCount: parseInt(casesRes.rows[0].count, 10) || 0,
        resourceCount: resourcesRes.rows.length,
        contributors: contributorsRes.rows.length,
        lastUpdated: workspace.updated_at
    };

    const me = contributorsRes.rows.find(c => String(c.staff_id) === String(staffId));

    return {
        workspace,
        contributors: contributorsRes.rows,
        myContributorRole: me ? me.role : null, // PHASE 3: OWNER / EDITOR / REVIEWER / VIEWER
        documents: formattedDocs,
        resources: resourcesRes.rows,
        stats
    };
};

export const updateWorkspaceStatus = async (workspaceId, newStatus, staffId) => {
    const before = await getWorkspaceById(workspaceId);
    let updateQuery = `UPDATE knowledge_workspaces SET status = $1, updated_at = NOW()`;
    const values = [newStatus, workspaceId];
    
    if (newStatus === 'in_review') {
        updateQuery += `, reviewed_by = $3, reviewed_at = NOW()`;
        values.push(staffId);
    } else if (newStatus === 'published') {
        updateQuery += `, published_by = $3, published_at = NOW()`;
        values.push(staffId);
    }

    updateQuery += ` WHERE id = $2 RETURNING *`;
    const res = await pool.query(updateQuery, values);
    
    await logHistory(workspaceId, 'workspace', workspaceId, 'status_change', { status: before.status }, { status: newStatus }, staffId);
    if (newStatus === 'published' && before.status !== 'published') {
        notify.workspacePublished({ workspaceId, actorId: staffId });
    }
    return res.rows[0];
};

// ==========================================
// MENTIONS
// ==========================================
const extractMentions = (content) => {
    if (!content) return [];
    const mentionRegex = /@\[.*?\]\((\d+)\)/g;
    const mentionedIds = new Set();
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
        mentionedIds.add(parseInt(match[1], 10));
    }
    return Array.from(mentionedIds);
};

// ==========================================
// CONTRIBUTORS
// ==========================================
export const addContributor = async (workspaceId, staffId, role, actorId = null) => {
    const before = await pool.query('SELECT role FROM knowledge_contributors WHERE workspace_id = $1 AND staff_id = $2', [workspaceId, staffId]);
    await pool.query(
        `INSERT INTO knowledge_contributors (workspace_id, staff_id, role) 
         VALUES ($1, $2, $3) ON CONFLICT (workspace_id, staff_id) 
         DO UPDATE SET role = EXCLUDED.role`,
        [workspaceId, staffId, role]
    );
    // Tell them, unless nothing actually changed
    if (String(before.rows[0]?.role || '').toUpperCase() !== String(role).toUpperCase()) {
        notify.contributorAdded({ workspaceId, staffId, role, actorId });
    }
};

export const removeContributor = async (workspaceId, staffId) => {
    await pool.query('DELETE FROM knowledge_contributors WHERE workspace_id = $1 AND staff_id = $2', [workspaceId, staffId]);
};

// ==========================================
// DOCUMENTS
// ==========================================
export const createDocument = async (workspaceId, title, slug, type, visibility, sortOrder, staffId) => {
    const res = await pool.query(
        `INSERT INTO knowledge_documents (workspace_id, title, slug, type, visibility, sort_order) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [workspaceId, title, slug, type || 'CUSTOM', visibility || 'PUBLIC', sortOrder]
    );

    await logHistory(workspaceId, 'document', res.rows[0].id, 'created', null, res.rows[0], staffId);
    return res.rows[0];
};

export const updateDocument = async (id, title, slug, visibility, sortOrder, staffId) => {
    const docRes = await pool.query('SELECT workspace_id FROM knowledge_documents WHERE id = $1', [id]);
    const workspaceId = docRes.rows[0].workspace_id;

    const res = await pool.query(
        `UPDATE knowledge_documents 
         SET title = $1, slug = $2, visibility = $3, sort_order = $4, updated_at = NOW() 
         WHERE id = $5 RETURNING *`,
        [title, slug, visibility, sortOrder, id]
    );

    await logHistory(workspaceId, 'document', id, 'updated', null, res.rows[0], staffId);
    return res.rows[0];
};

export const softDeleteDocument = async (id, staffId) => {
    const docRes = await pool.query('SELECT workspace_id, type FROM knowledge_documents WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (docRes.rows.length === 0) throw new KnowledgeError(404, 'Document not found.');
    
    if (docRes.rows[0].type === 'SYSTEM') {
        throw new KnowledgeError(400, 'SOP, FAQ and Overview are system documents and cannot be deleted.');
    }

    const workspaceId = docRes.rows[0].workspace_id;
    await pool.query('UPDATE knowledge_documents SET deleted_at = NOW(), deleted_by = $2 WHERE id = $1', [id, staffId]);
    await logHistory(workspaceId, 'document', id, 'deleted', null, null, staffId);
};

// ==========================================
// BLOCKS 
// ==========================================
// PHASE 3: the block types the editor can produce. Anything else is rejected.
export const ALLOWED_BLOCK_TYPES = [
    'h1', 'h2', 'h3', 'paragraph', 'list', 'callout',
    'faq_item', 'step', 'required_document', 'fee', 'checklist', 'link',
];

// Cleans and checks blocks coming from the browser
export const normalizeBlocks = (blocks) => {
    if (!Array.isArray(blocks)) throw new KnowledgeError(400, 'blocks must be an array.');
    if (blocks.length > 500) throw new KnowledgeError(400, 'A document can have at most 500 blocks.');

    return blocks.map((b, index) => {
        if (!ALLOWED_BLOCK_TYPES.includes(b.block_type)) {
            throw new KnowledgeError(400, `Unknown block type: ${b.block_type}`);
        }
        let content = b.content;
        if (typeof content === 'string') {
            try { content = JSON.parse(content); } catch { content = { text: content }; }
        }
        let metadata = b.metadata;
        if (typeof metadata === 'string') {
            try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
        }
        if (b.block_type === 'link' && content?.url && !/^https?:\/\//i.test(content.url)) {
            throw new KnowledgeError(400, 'Links must start with http:// or https://');
        }
        return {
            block_key: String(b.block_key || `blk-${Date.now()}-${index}`),
            block_type: b.block_type,
            content: content || {},
            metadata: metadata || {},
            sort_order: index + 1,
        };
    });
};

const getBlocksWithClient = async (client, documentId) => {
    const res = await client.query(
        'SELECT block_key, block_type, content, metadata, sort_order FROM knowledge_blocks WHERE document_id = $1 AND deleted_at IS NULL ORDER BY sort_order ASC',
        [documentId]
    );
    return res.rows;
};

export const getDocumentBlocks = async (documentId) => getBlocksWithClient(pool, documentId);

// Replaces a document's blocks inside an open transaction (used by direct
// edits AND by approving a suggestion), with a history entry.
const writeBlocks = async (client, workspaceId, documentId, newBlocks, staffId, action = 'batch_update') => {
    const oldContent = await getBlocksWithClient(client, documentId);

    // What changed (used for notifications): matched by block_key
    const oldByKey = new Map(oldContent.map(b => [String(b.block_key), blockFingerprint(b)]));
    const newKeys = new Set(newBlocks.map(b => String(b.block_key)));
    const diff = { added: 0, changed: 0, removed: 0, addedFaqQuestions: [], wasEmpty: oldContent.length === 0 };
    for (const b of newBlocks) {
        const before = oldByKey.get(String(b.block_key));
        if (before === undefined) {
            diff.added++;
            if (b.block_type === 'faq_item') diff.addedFaqQuestions.push(parseMaybe(b.content)?.question || 'New question');
        } else if (before !== blockFingerprint(b)) {
            diff.changed++;
        }
    }
    diff.removed = oldContent.filter(b => !newKeys.has(String(b.block_key))).length;

    await client.query('DELETE FROM knowledge_blocks WHERE document_id = $1', [documentId]);

    for (const block of newBlocks) {
        await client.query(
            `INSERT INTO knowledge_blocks (document_id, block_key, block_type, content, metadata, sort_order) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [documentId, block.block_key, block.block_type, JSON.stringify(block.content), JSON.stringify(block.metadata || {}), block.sort_order]
        );
    }

    await logHistoryTransaction(client, workspaceId, 'document_blocks', documentId, action, oldContent, newBlocks, staffId);
    await client.query(`UPDATE knowledge_documents SET updated_at = NOW() WHERE id = $1`, [documentId]);
    await client.query(`UPDATE knowledge_workspaces SET updated_at = NOW() WHERE id = $1`, [workspaceId]);
    return diff;
};

export const batchUpdateBlocks = async (workspaceId, documentId, newBlocks, staffId) => {
    const blocks = normalizeBlocks(newBlocks);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const diff = await writeBlocks(client, workspaceId, documentId, blocks, staffId);
        await client.query('COMMIT');
        notify.documentChanged({ workspaceId, documentId, actorId: staffId, diff });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

// ==========================================
// RESOURCES
// ==========================================
export const addResource = async (workspaceId, type, title, url, fileId, staffId) => {
    const res = await pool.query(
        `INSERT INTO knowledge_resources (workspace_id, type, title, url, file_id, added_by) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [workspaceId, type, title, url, fileId, staffId]
    );

    await logHistory(workspaceId, 'resource', res.rows[0].id, 'added', null, res.rows[0], staffId);
    notify.resourceAdded({ workspaceId, resource: res.rows[0], actorId: staffId });
    return res.rows[0];
};

export const softDeleteResource = async (id, staffId) => {
    const res = await pool.query('SELECT workspace_id FROM knowledge_resources WHERE id = $1', [id]);
    const workspaceId = res.rows[0].workspace_id;

    await pool.query('UPDATE knowledge_resources SET deleted_at = NOW(), deleted_by = $2 WHERE id = $1', [id, staffId]);
    await logHistory(workspaceId, 'resource', id, 'deleted', null, null, staffId);
};

// ==========================================
// UTILITY: History Engine
// ==========================================
const logHistoryTransaction = async (client, workspaceId, entityType, entityId, action, oldContent, newContent, staffId) => {
    const versionRes = await client.query(
        `SELECT COALESCE(MAX(version), 0) + 1 AS next_version 
         FROM knowledge_history WHERE workspace_id = $1 AND entity_id = $2 AND entity_type = $3`,
        [workspaceId, entityId, entityType]
    );
    const nextVersion = versionRes.rows[0].next_version;

    await client.query(
        `INSERT INTO knowledge_history (workspace_id, entity_type, entity_id, version, action, old_content, new_content, edited_by) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [workspaceId, entityType, entityId, nextVersion, action, JSON.stringify(oldContent), JSON.stringify(newContent), staffId]
    );
};

const logHistory = async (workspaceId, entityType, entityId, action, oldContent, newContent, staffId) => {
    const client = await pool.connect();
    try {
        await logHistoryTransaction(client, workspaceId, entityType, entityId, action, oldContent, newContent, staffId);
    } finally {
        client.release();
    }
};

// ==========================================
// DISCUSSIONS
// ==========================================
export const getDiscussions = async (workspaceId, userId) => {
    const res = await pool.query(
        `SELECT d.*, s.name as author_name,
        (SELECT COUNT(*) FROM knowledge_discussion_replies r WHERE r.discussion_id = d.id) as replies_count,
        (SELECT vote_type FROM knowledge_votes WHERE discussion_id = d.id AND staff_id = $2) as user_vote,
        EXISTS(SELECT 1 FROM knowledge_bookmarks WHERE target_type = 'discussion' AND target_id = d.id AND staff_id = $2) as is_bookmarked,
        EXISTS(SELECT 1 FROM knowledge_followers WHERE discussion_id = d.id AND staff_id = $2) as is_following
        FROM knowledge_discussions d
        JOIN staff s ON d.author_id = s.id
        WHERE d.workspace_id = $1
        ORDER BY d.created_at DESC`,
        [workspaceId, userId]
    );

    const repliesRes = await pool.query(
        `SELECT r.*, s.name as author_name,
        (SELECT vote_type FROM knowledge_votes WHERE reply_id = r.id AND staff_id = $2) as user_vote 
         FROM knowledge_discussion_replies r
         JOIN staff s ON r.author_id = s.id
         WHERE r.discussion_id IN (SELECT id FROM knowledge_discussions WHERE workspace_id = $1)
         ORDER BY r.created_at ASC`,
        [workspaceId, userId]
    );

    const discReactRes = await pool.query(`
        SELECT discussion_id, emoji, COUNT(*)::int as count, bool_or(staff_id = $2) as active
        FROM knowledge_reactions
        WHERE discussion_id IN (SELECT id FROM knowledge_discussions WHERE workspace_id = $1)
        GROUP BY discussion_id, emoji
    `, [workspaceId, userId]);

    const replyReactRes = await pool.query(`
        SELECT reply_id, emoji, COUNT(*)::int as count, bool_or(staff_id = $2) as active
        FROM knowledge_reactions
        WHERE reply_id IN (SELECT id FROM knowledge_discussion_replies WHERE discussion_id IN (SELECT id FROM knowledge_discussions WHERE workspace_id = $1))
        GROUP BY reply_id, emoji
    `, [workspaceId, userId]);

    return res.rows.map(discussion => {
        const discussionReactions = discReactRes.rows.filter(react => react.discussion_id === discussion.id);
        const replies = repliesRes.rows.filter(r => r.discussion_id === discussion.id).map(r => ({
            ...r,
            reactions: replyReactRes.rows.filter(react => react.reply_id === r.id)
        }));

        return {
            ...discussion,
            reactions: discussionReactions,
            replies
        };
    });
};

export const createDiscussion = async (workspaceId, payload, staffId, user = {}) => {
    const { title, content, category, priority, tags, relatedTo, relatedId, attachments } = payload;
    
    const customerStr = relatedTo === 'customer' ? relatedId : null;
    const appStr = relatedTo === 'serviceEntry' ? relatedId : null;

    if (appStr) {
        const searchParam = appStr.trim();
        const numericId = parseInt(searchParam, 10);

        const workspaceRes = await pool.query(
            `SELECT service_id FROM knowledge_workspaces WHERE id = $1`, 
            [workspaceId]
        );
        if (workspaceRes.rows.length === 0) throw new KnowledgeError(404, "Invalid Workspace.");
        const expectedServiceId = workspaceRes.rows[0].service_id;

        if (expectedServiceId) {
            let queryStr = `
                SELECT se.category_id, st_staff.centre_id
                FROM service_tracking st
                JOIN service_entries se ON st.service_entry_id = se.id
                LEFT JOIN staff st_staff ON se.staff_id::integer = st_staff.id
                WHERE (st.application_number ILIKE $1
            `;
            const params = [searchParam];

            if (!isNaN(numericId)) {
                queryStr += ` OR st.id = $2`;
                params.push(numericId);
            }
            queryStr += `)`;

            const appRes = await pool.query(queryStr, params);

            if (appRes.rows.length === 0) {
                throw new KnowledgeError(400, "The linked CRM application could not be found.");
            }

            const actualServiceId = appRes.rows[0].category_id;

            if (parseInt(expectedServiceId, 10) !== parseInt(actualServiceId, 10)) {
                throw new KnowledgeError(400, "You cannot link this application here because it belongs to a different service.");
            }

            // PHASE 2 FIX: same centre rule as the CRM lookup — only
            // superadmin can link another centre's application
            if (user.role !== 'superadmin' &&
                String(appRes.rows[0].centre_id) !== String(user.centre_id)) {
                throw new KnowledgeError(403, "This application belongs to another centre.");
            }
        }
    }

    const res = await pool.query(
        `INSERT INTO knowledge_discussions 
        (workspace_id, title, content, category, priority, tags, author_id, crm_customer, crm_application, attachments) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          workspaceId, title, content, category, priority, tags || [], 
          staffId, customerStr, appStr, JSON.stringify(attachments || []) 
        ]
    );
    const newDiscussion = res.rows[0];

    // 🔥 Trigger Notifications for Mentions in the Main Post
    const mentionedIds = extractMentions(content);
    if (mentionedIds.length > 0) {
        const staffRes = await pool.query('SELECT name FROM staff WHERE id = $1', [staffId]);
        const authorName = staffRes.rows[0].name;

        for (const targetId of mentionedIds) {
            if (targetId !== staffId) { 
                await pool.query(
                    'INSERT INTO knowledge_mentions (staff_id, author_id, discussion_id) VALUES ($1, $2, $3)',
                    [targetId, staffId, newDiscussion.id]
                );
                await notificationService.createNotification({
                    recipientStaffId: targetId,
                    senderStaffId: staffId,
                    relatedEntityType: 'discussion',
                    relatedEntityId: newDiscussion.id,
                    ...notificationTemplates.knowledgeMention({ senderName: authorName, discussionTitle: title })
                });
            }
        }
    }
    
    await pool.query(`UPDATE knowledge_workspaces SET updated_at = NOW() WHERE id = $1`, [workspaceId]);
    // Staff at centres offering this service hear about the new question
    notify.discussionCreated({ discussion: newDiscussion, alreadyNotified: mentionedIds });
    return newDiscussion;
};

export const addReply = async (discussionId, content, attachments, authorId) => {
    const contextRes = await pool.query(`
        SELECT d.title, d.author_id as discussion_author_id, s.name as replier_name 
        FROM knowledge_discussions d
        CROSS JOIN staff s 
        WHERE d.id = $1 AND s.id = $2
    `, [discussionId, authorId]);
    
    const { title, discussion_author_id, replier_name } = contextRes.rows[0];

    const replyRes = await pool.query(
        'INSERT INTO knowledge_discussion_replies (discussion_id, content, attachments, author_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [discussionId, content, JSON.stringify(attachments || []), authorId]
    );
    const replyId = replyRes.rows[0].id;

    // 🔥 Notify Mentions
    const mentionedIds = extractMentions(content);
    for (const targetId of mentionedIds) {
        if (targetId !== authorId) { 
            await pool.query(
                'INSERT INTO knowledge_mentions (staff_id, author_id, discussion_id, reply_id) VALUES ($1, $2, $3, $4)',
                [targetId, authorId, discussionId, replyId]
            );
            
            await notificationService.createNotification({
                recipientStaffId: targetId,
                senderStaffId: authorId,
                relatedEntityType: 'discussion',
                relatedEntityId: discussionId,
                ...notificationTemplates.knowledgeMention({ senderName: replier_name, discussionTitle: title })
            });
        }
    }

    // Followers of the thread (author + mentioned people are notified separately)
    notify.replyAdded({ discussionId, discussionTitle: title, replierId: authorId, alreadyNotified: [...mentionedIds, discussion_author_id] });

    // 🔥 Notify Discussion Author
    if (discussion_author_id !== authorId && !mentionedIds.includes(discussion_author_id)) {
         await notificationService.createNotification({
             recipientStaffId: discussion_author_id,
             senderStaffId: authorId,
             relatedEntityType: 'discussion',
             relatedEntityId: discussionId,
             ...notificationTemplates.knowledgeReply({ senderName: replier_name, discussionTitle: title })
         });
    }

    return replyRes.rows[0];
};

export const getCases = async (workspaceId) => {
    const res = await pool.query(
        `SELECT c.*, s.name as solver_name 
         FROM knowledge_cases c
         LEFT JOIN staff s ON c.solved_by = s.id
         WHERE c.workspace_id = $1
         ORDER BY c.created_at DESC`,
        [workspaceId]
    );
    return res.rows;
};

export const markDiscussionSolved = async (discussionId, replyId, staffId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        let solutionText = "This issue was manually marked as resolved by staff.";
        let replyAuthorId = null;

        if (replyId) {
            // PHASE 2 FIX: the best answer must be a reply in THIS discussion
            const replyRes = await client.query(
                `SELECT content, author_id FROM knowledge_discussion_replies WHERE id = $1 AND discussion_id = $2`,
                [replyId, discussionId]
            );
            if (replyRes.rows.length === 0) {
                throw new KnowledgeError(400, 'That reply does not belong to this discussion.');
            }
            solutionText = replyRes.rows[0].content;
            replyAuthorId = replyRes.rows[0].author_id;

            await client.query(
                `UPDATE knowledge_discussion_replies SET is_best_answer = true WHERE id = $1 AND discussion_id = $2`,
                [replyId, discussionId]
            );
        }

        await client.query(`UPDATE knowledge_discussions SET status = 'solved', updated_at = NOW() WHERE id = $1`, [discussionId]);

        const discussionRes = await client.query(`SELECT workspace_id, title, content, tags, author_id FROM knowledge_discussions WHERE id = $1`, [discussionId]);
        const discussion = discussionRes.rows[0];

        const solverRes = await client.query('SELECT name FROM staff WHERE id = $1', [staffId]);
        const solverName = solverRes.rows[0]?.name;

        // 🔥 Notify the Best Answer Winner
        if (replyAuthorId && replyAuthorId !== staffId) {
            await notificationService.createNotification({
                recipientStaffId: replyAuthorId,
                senderStaffId: staffId,
                relatedEntityType: 'discussion',
                relatedEntityId: discussionId,
                ...notificationTemplates.knowledgeSolved({
                    discussionTitle: discussion.title,
                    solvedByName: solverName
                })
            });
        }

        await client.query(
            `INSERT INTO knowledge_cases 
            (workspace_id, title, description, solution, original_discussion_id, tags, solved_by) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [discussion.workspace_id, discussion.title, discussion.content, solutionText, discussionId, discussion.tags, staffId]
        );

        await client.query('COMMIT');
        // Author + followers (the best-answer person already got their own notification)
        notify.discussionSolved({
            discussionId, discussionTitle: discussion.title, authorId: discussion.author_id,
            solverId: staffId, alreadyNotified: replyAuthorId ? [replyAuthorId] : [],
        });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

export const toggleBookmark = async (staffId, targetType, targetId) => {
    const check = await pool.query(
        'SELECT id FROM knowledge_bookmarks WHERE staff_id = $1 AND target_type = $2 AND target_id = $3',
        [staffId, targetType, targetId]
    );

    if (check.rows.length > 0) {
        await pool.query('DELETE FROM knowledge_bookmarks WHERE id = $1', [check.rows[0].id]);
        return { bookmarked: false };
    } else {
        await pool.query(
            'INSERT INTO knowledge_bookmarks (staff_id, target_type, target_id) VALUES ($1, $2, $3)',
            [staffId, targetType, targetId]
        );
        return { bookmarked: true };
    }
};

export const getMyBookmarks = async (staffId) => {
    const res = await pool.query(`
        SELECT b.*, d.title, d.status
        FROM knowledge_bookmarks b
        LEFT JOIN knowledge_discussions d ON b.target_id = d.id AND b.target_type = 'discussion'
        WHERE b.staff_id = $1
        ORDER BY b.created_at DESC
    `, [staffId]);
    return res.rows;
};

// =====================================================================
// ANNOUNCEMENTS — sent to everyone, one centre, or one team
//   admin      → their own centre, or one of their centre's teams
//   superadmin → everyone, any centre, or any team (incl. global teams)
// =====================================================================
const teamById = async (teamId) => {
    const r = await pool.query('SELECT id, name, centre_id, is_global FROM teams WHERE id = $1', [teamId]);
    return r.rows[0] || null;
};

export const createAnnouncement = async (user, { title, content, category, priority, isPinned, audienceType, centreId, teamId }) => {
    if (!title?.trim() || !content?.trim()) throw new KnowledgeError(400, 'Title and message are required.');

    // Old screens sent only teamId (or nothing). Keep that working.
    let audience = audienceType || (teamId ? 'team' : (user.role === 'superadmin' ? 'all' : 'centre'));
    if (!['all', 'centre', 'team'].includes(audience)) throw new KnowledgeError(400, 'Unknown audience.');

    let finalCentreId = null;
    let finalTeamId = null;

    if (audience === 'all') {
        if (user.role !== 'superadmin') throw new KnowledgeError(403, 'Only the superadmin can send to every centre.');
    }

    if (audience === 'centre') {
        if (user.role === 'superadmin') {
            finalCentreId = parseInt(centreId, 10);
            if (Number.isNaN(finalCentreId)) throw new KnowledgeError(400, 'Choose a centre.');
            const c = await pool.query('SELECT id FROM centres WHERE id = $1', [finalCentreId]);
            if (!c.rows.length) throw new KnowledgeError(404, 'Centre not found.');
        } else {
            // Admins always send to their own centre
            finalCentreId = parseInt(user.centre_id, 10);
            if (Number.isNaN(finalCentreId)) throw new KnowledgeError(400, 'No centre found for this user.');
        }
    }

    if (audience === 'team') {
        const team = await teamById(parseInt(teamId, 10));
        if (!team) throw new KnowledgeError(404, 'Team not found.');
        if (user.role !== 'superadmin' &&
            (team.is_global || String(team.centre_id) !== String(user.centre_id))) {
            throw new KnowledgeError(403, "You can only send to your own centre's teams.");
        }
        finalTeamId = team.id;
    }

    const res = await pool.query(
        `INSERT INTO knowledge_announcements
            (title, content, category, priority, is_pinned, created_by, team_id, audience_type, centre_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [title.trim(), content.trim(), category || 'general', priority || 'normal', !!isPinned, user.id, finalTeamId, audience, finalCentreId]
    );
    notify.announcementCreated({ announcement: res.rows[0], actorId: user.id });
    return res.rows[0];
};

/**
 * Announcements this person should see (newest / pinned first).
 * teamId (optional): only that team's announcements plus the ones for everyone
 * (used by the My Team page).
 */
export const getAnnouncements = async (user, teamId = null) => {
    const params = [];
    const add = (v) => { params.push(v); return `$${params.length}`; };
    // Hide announcements whose expiry date has passed
    const where = [`(a.expires_at IS NULL OR a.expires_at > NOW())`];

    if (user.role !== 'superadmin') {
        const me = add(user.id);
        const centre = add(String(user.centre_id ?? ''));
        const myTeams = `SELECT tm.team_id FROM team_members tm WHERE tm.staff_id = ${me} AND tm.is_active = true`;
        const adminTeams = user.role === 'admin'
            ? ` OR (t.centre_id::text = ${centre} AND COALESCE(t.is_global, false) = false)`
            : '';
        where.push(`(
            a.audience_type = 'all'
            OR (a.audience_type = 'centre' AND a.centre_id::text = ${centre})
            OR (a.audience_type = 'team' AND (a.team_id IN (${myTeams})${adminTeams}))
            OR a.created_by = ${me}
        )`);
    }

    if (teamId) {
        where.push(`(a.audience_type = 'all' OR a.team_id = ${add(parseInt(teamId, 10))})`);
    }

    const res = await pool.query(
        `SELECT a.*, s.name AS author_name,
                t.name AS team_name, COALESCE(t.is_global, false) AS team_is_global,
                c.name AS centre_name
         FROM knowledge_announcements a
         LEFT JOIN staff s ON a.created_by = s.id
         LEFT JOIN teams t ON t.id = a.team_id
         LEFT JOIN centres c ON c.id = a.centre_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY a.is_pinned DESC, a.created_at DESC
         LIMIT 50`,
        params
    );
    return res.rows;
};

export const getGlobalStats = async (staffId, user = null) => { 
    const pendingReviewsPromise = user
        ? countReviewableSuggestions(user).catch(() => 0)
        : Promise.resolve(0);
    const [discussions, cases, resources, announcements, trainings, mentions, drafts, pendingReviews] = await Promise.all([
        pool.query("SELECT COUNT(*) FROM knowledge_discussions WHERE deleted_at IS NULL"),
        pool.query("SELECT COUNT(*) FROM knowledge_cases"),
        pool.query("SELECT COUNT(*) FROM knowledge_resources WHERE deleted_at IS NULL"),
        pool.query("SELECT COUNT(*) FROM knowledge_announcements"),
        pool.query("SELECT COUNT(*) FROM knowledge_trainings"),
        pool.query("SELECT COUNT(*) FROM knowledge_mentions WHERE staff_id = $1 AND is_read = false", [staffId]),
        pool.query("SELECT COUNT(*) FROM knowledge_drafts WHERE staff_id = $1", [staffId]),
        pendingReviewsPromise
    ]);

    return {
        discussions: parseInt(discussions.rows[0].count, 10) || 0,
        cases: parseInt(cases.rows[0].count, 10) || 0,
        resources: parseInt(resources.rows[0].count, 10) || 0,
        announcements: parseInt(announcements.rows[0].count, 10) || 0,
        trainings: parseInt(trainings.rows[0].count, 10) || 0,
        mentions: parseInt(mentions.rows[0].count, 10) || 0,
        drafts: parseInt(drafts.rows[0].count, 10) || 0,
        pendingReviews: pendingReviews || 0 // PHASE 3: suggestions waiting for *me* to review
    };
};

export const getTrainings = async () => {
    const res = await pool.query(`
        SELECT t.*, s.name as author_name 
        FROM knowledge_trainings t
        LEFT JOIN staff s ON t.created_by = s.id
        ORDER BY t.created_at DESC
    `);
    return res.rows;
};

export const createTraining = async (title, description, type, url, duration, staffId) => {
    const res = await pool.query(
        `INSERT INTO knowledge_trainings (title, description, type, url, duration, created_by) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [title, description, type, url, duration, staffId]
    );
    notify.trainingCreated({ training: res.rows[0], actorId: staffId });
    return res.rows[0];
};

export const getAllDiscussions = async () => {
    const res = await pool.query(`
        SELECT 
            d.*, 
            s.name as author_name,
            srv.name as service_name,
            kw.service_id,
            (SELECT COUNT(*) FROM knowledge_discussion_replies r WHERE r.discussion_id = d.id) as replies_count
        FROM knowledge_discussions d
        JOIN staff s ON d.author_id = s.id
        JOIN knowledge_workspaces kw ON d.workspace_id = kw.id
        LEFT JOIN services srv ON kw.service_id = srv.id
        ORDER BY d.created_at DESC
        LIMIT 50
    `);
    return res.rows;
};

// PHASE 1 FIX: real open/solved counts per service, computed in SQL
// (the frontend used to count from only the latest 50 discussions).
export const getServiceDiscussionCounts = async () => {
    const res = await pool.query(`
        SELECT kw.service_id,
               COUNT(d.id) FILTER (WHERE d.status IS DISTINCT FROM 'solved')::int AS open_count,
               COUNT(d.id) FILTER (WHERE d.status = 'solved')::int AS solved_count
        FROM knowledge_workspaces kw
        JOIN knowledge_discussions d ON d.workspace_id = kw.id
        WHERE kw.deleted_at IS NULL
        GROUP BY kw.service_id
    `);
    return res.rows;
};

export const getDiscussionById = async (id, userId) => {
    const discussionRes = await pool.query(`
        SELECT 
            d.*, 
            s.name as author_name, 
            srv.name as service_name,
            (SELECT vote_type FROM knowledge_votes WHERE discussion_id = d.id AND staff_id = $2) as user_vote,
            EXISTS(SELECT 1 FROM knowledge_bookmarks WHERE target_type = 'discussion' AND target_id = d.id AND staff_id = $2) as is_bookmarked,
            EXISTS(SELECT 1 FROM knowledge_followers WHERE discussion_id = d.id AND staff_id = $2) as is_following 
        FROM knowledge_discussions d
        JOIN staff s ON d.author_id = s.id
        JOIN knowledge_workspaces kw ON d.workspace_id = kw.id
        LEFT JOIN services srv ON kw.service_id = srv.id
        WHERE d.id = $1
    `, [id, userId]);

    if (discussionRes.rows.length === 0) throw new KnowledgeError(404, "Discussion not found");
    const discussion = discussionRes.rows[0];

    const repliesRes = await pool.query(`
        SELECT r.*, s.name as author_name,
        (SELECT vote_type FROM knowledge_votes WHERE reply_id = r.id AND staff_id = $2) as user_vote
        FROM knowledge_discussion_replies r
        JOIN staff s ON r.author_id = s.id
        WHERE r.discussion_id = $1
        ORDER BY r.created_at ASC
    `, [id, userId]);

    const discReactRes = await pool.query(`
        SELECT emoji, COUNT(*)::int as count, bool_or(staff_id = $2) as active
        FROM knowledge_reactions
        WHERE discussion_id = $1
        GROUP BY emoji
    `, [id, userId]);

    const replyReactRes = await pool.query(`
        SELECT reply_id, emoji, COUNT(*)::int as count, bool_or(staff_id = $2) as active
        FROM knowledge_reactions
        WHERE reply_id IN (SELECT id FROM knowledge_discussion_replies WHERE discussion_id = $1)
        GROUP BY reply_id, emoji
    `, [id, userId]);

    discussion.reactions = discReactRes.rows;
    
    const replies = repliesRes.rows.map(r => ({
        ...r,
        reactions: replyReactRes.rows.filter(react => react.reply_id === r.id)
    }));

    return { ...discussion, replies };
};

export const getMyMentions = async (staffId) => {
    const res = await pool.query(`
        SELECT m.*, d.title as discussion_title, s.name as author_name 
        FROM knowledge_mentions m
        JOIN knowledge_discussions d ON m.discussion_id = d.id
        LEFT JOIN staff s ON m.author_id = s.id
        WHERE m.staff_id = $1
        ORDER BY m.is_read ASC, m.created_at DESC
    `, [staffId]);
    return res.rows;
};

export const markMentionsRead = async (staffId, discussionId) => {
    await pool.query(
        'UPDATE knowledge_mentions SET is_read = true WHERE staff_id = $1 AND discussion_id = $2',
        [staffId, discussionId]
    );
};

export const searchStaffForMentions = async (searchQuery) => {
    const res = await pool.query(
        `SELECT id, name as display 
         FROM staff 
         WHERE name ILIKE $1 
         LIMIT 10`,
        [`%${searchQuery}%`]
    );
    return res.rows;
};

export const toggleFollow = async (staffId, discussionId) => {
    const check = await pool.query(
        'SELECT id FROM knowledge_followers WHERE staff_id = $1 AND discussion_id = $2',
        [staffId, discussionId]
    );

    if (check.rows.length > 0) {
        await pool.query('DELETE FROM knowledge_followers WHERE id = $1', [check.rows[0].id]);
        return { isFollowing: false };
    } else {
        await pool.query(
            'INSERT INTO knowledge_followers (staff_id, discussion_id) VALUES ($1, $2)',
            [staffId, discussionId]
        );
        return { isFollowing: true };
    }
};

export const getMyFollowing = async (staffId) => {
    const res = await pool.query(`
        SELECT d.*, s.name as author_name, srv.name as service_name,
        (SELECT COUNT(*) FROM knowledge_discussion_replies r WHERE r.discussion_id = d.id) as replies_count
        FROM knowledge_followers f
        JOIN knowledge_discussions d ON f.discussion_id = d.id
        JOIN staff s ON d.author_id = s.id
        LEFT JOIN knowledge_workspaces kw ON d.workspace_id = kw.id
        LEFT JOIN services srv ON kw.service_id = srv.id
        WHERE f.staff_id = $1
        ORDER BY d.updated_at DESC
    `, [staffId]);
    return res.rows;
};

export const logRecentView = async (staffId, targetType, targetId) => {
    await pool.query(
        `INSERT INTO knowledge_recent_views (staff_id, target_type, target_id, last_viewed_at) 
         VALUES ($1, $2, $3, NOW()) 
         ON CONFLICT (staff_id, target_type, target_id) 
         DO UPDATE SET last_viewed_at = NOW()`,
        [staffId, targetType, targetId]
    );
};

export const getMyHistory = async (staffId) => {
    const res = await pool.query(`
        SELECT v.*, d.title, d.status
        FROM knowledge_recent_views v
        JOIN knowledge_discussions d ON v.target_id = d.id AND v.target_type = 'discussion'
        WHERE v.staff_id = $1
        ORDER BY v.last_viewed_at DESC
        LIMIT 50
    `, [staffId]);
    return res.rows;
};

export const saveDraft = async (staffId, entityType, title, payload, draftId = null) => {
    if (draftId) {
        const res = await pool.query(
            `UPDATE knowledge_drafts 
             SET title = $1, payload = $2, updated_at = NOW() 
             WHERE id = $3 AND staff_id = $4 RETURNING *`,
            [title, JSON.stringify(payload), draftId, staffId]
        );
        return res.rows[0];
    } else {
        const res = await pool.query(
            `INSERT INTO knowledge_drafts (staff_id, entity_type, title, payload) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [staffId, entityType, title, JSON.stringify(payload)]
        );
        return res.rows[0];
    }
};

export const getMyDrafts = async (staffId) => {
    const res = await pool.query(
        `SELECT * FROM knowledge_drafts WHERE staff_id = $1 ORDER BY updated_at DESC`, 
        [staffId]
    );
    return res.rows;
};

export const deleteDraft = async (staffId, draftId) => {
    await pool.query('DELETE FROM knowledge_drafts WHERE id = $1 AND staff_id = $2', [draftId, staffId]);
};

export const getRecentActivity = async (workspaceId = null) => {
    const res = await pool.query(`
        (SELECT 'discussion' as type, d.title as target, s.name as user_name, d.created_at as time
         FROM knowledge_discussions d JOIN staff s ON d.author_id = s.id)
        UNION ALL
        (SELECT 'solved' as type, c.title as target, s.name as user_name, c.created_at as time
         FROM knowledge_cases c JOIN staff s ON c.solved_by = s.id)
        ORDER BY time DESC 
        LIMIT 10
    `);
    return res.rows;
};

export const lookupCrmRecord = async (staffId, centreId, role, type, recordId, expectedServiceId) => {
    if (type !== 'serviceEntry') throw new Error("Currently only service applications are supported");

    const searchParam = recordId.trim();
    const numericId = parseInt(searchParam, 10);

    let queryStr = `
        SELECT 
            st.id as tracking_id, st.application_number, st.status, st.current_step, 
            se.customer_name, NULLIF(se.phone, '') as phone, se.id as service_entry_id,
            se.category_id,
            s.name as service_name, sub.name as subcategory_name,
            st_staff.centre_id, assigned_staff.name as assigned_staff_name
        FROM service_tracking st
        JOIN service_entries se ON st.service_entry_id = se.id
        LEFT JOIN services s ON se.category_id::integer = s.id
        LEFT JOIN subcategories sub ON se.subcategory_id::integer = sub.id
        LEFT JOIN staff st_staff ON se.staff_id::integer = st_staff.id
        LEFT JOIN staff assigned_staff ON st.assigned_to::integer = assigned_staff.id
        WHERE 1=1 
    `;
    const params = [];
    let paramIndex = 1;

    if (!isNaN(numericId)) {
        queryStr += ` AND (st.application_number ILIKE $${paramIndex} OR st.id = $${paramIndex + 1})`;
        params.push(searchParam, numericId);
        paramIndex += 2;
    } else {
        queryStr += ` AND st.application_number ILIKE $${paramIndex}`;
        params.push(searchParam);
        paramIndex += 1;
    }

    if (expectedServiceId) {
        queryStr += ` AND se.category_id::integer = $${paramIndex}`;
        params.push(parseInt(expectedServiceId, 10));
        paramIndex += 1;
    }

    const res = await pool.query(queryStr, params);

    if (res.rows.length === 0) {
        if (expectedServiceId) {
            throw new Error(`Record not found in this workspace. Please ensure the tracking ID is correct and belongs to this specific service.`);
        }
        throw new Error(`Tracking record '${searchParam}' not found.`);
    }

    const record = res.rows[0];

    if (role !== 'superadmin' && parseInt(record.centre_id) !== parseInt(centreId)) {
        throw new Error(`Access Denied: This record belongs to Centre ${record.centre_id}.`);
    }

    return {
        id: record.application_number || `TRK-${record.tracking_id}`,
        trackingId: record.tracking_id, 
        internalId: record.service_entry_id,
        title: record.service_name || 'Service Application',
        subcategory: record.subcategory_name || 'General',
        customer: record.customer_name || 'Customer',
        phone: record.phone || 'N/A',
        assignedTo: record.assigned_staff_name || 'Unassigned',
        status: record.status,
        step: record.current_step
    };
};

// ==========================================
// REACTIONS & VOTING
// ==========================================
export const votePost = async (staffId, targetType, targetId, voteValue) => {
    const column = targetType === 'discussion' ? 'discussion_id' : 'reply_id';
    const table = targetType === 'discussion' ? 'knowledge_discussions' : 'knowledge_discussion_replies';
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const check = await client.query(
            `SELECT id, vote_type FROM knowledge_votes WHERE staff_id = $1 AND ${column} = $2`,
            [staffId, targetId]
        );

        let newTotal;

        if (check.rows.length > 0) {
            const existingVote = check.rows[0].vote_type;
            
            if (existingVote === voteValue) {
                await client.query(`DELETE FROM knowledge_votes WHERE id = $1`, [check.rows[0].id]);
                const res = await client.query(`UPDATE ${table} SET upvotes = upvotes - $1 WHERE id = $2 RETURNING upvotes`, [voteValue, targetId]);
                newTotal = res.rows[0].upvotes;
            } else {
                await client.query(`UPDATE knowledge_votes SET vote_type = $1 WHERE id = $2`, [voteValue, check.rows[0].id]);
                const res = await client.query(`UPDATE ${table} SET upvotes = upvotes + $1 WHERE id = $2 RETURNING upvotes`, [voteValue * 2, targetId]);
                newTotal = res.rows[0].upvotes;
            }
        } else {
            await client.query(
                `INSERT INTO knowledge_votes (staff_id, ${column}, vote_type) VALUES ($1, $2, $3)`,
                [staffId, targetId, voteValue]
            );
            const res = await client.query(`UPDATE ${table} SET upvotes = upvotes + $1 WHERE id = $2 RETURNING upvotes`, [voteValue, targetId]);
            newTotal = res.rows[0].upvotes;
        }

        // 🔥 FIRE SILENT NOTIFICATION ONLY ON BRAND NEW UPVOTES (+1)
        if (check.rows.length === 0 && voteValue === 1) {
            try {
                const targetRes = await client.query(`
                    SELECT t.author_id, d.title, d.id as discussion_id
                    FROM ${table} t
                    JOIN knowledge_discussions d ON d.id = ${targetType === 'discussion' ? 't.id' : 't.discussion_id'}
                    WHERE t.id = $1
                `, [targetId]);
                
                const targetAuthor = targetRes.rows[0]?.author_id;
                const senderRes = await client.query('SELECT name FROM staff WHERE id = $1', [staffId]);
                
                if (targetAuthor && targetAuthor !== staffId) {
                    await notificationService.createNotification({
                        recipientStaffId: targetAuthor,
                        senderStaffId: staffId,
                        relatedEntityType: 'discussion',
                        relatedEntityId: targetRes.rows[0].discussion_id,
                        ...notificationTemplates.knowledgeUpvote({ 
                            senderName: senderRes.rows[0]?.name, 
                            discussionTitle: targetRes.rows[0].title 
                        })
                    });
                }
            } catch (err) {
                console.error("Failed to send upvote notification", err);
            }
        }

        await client.query('COMMIT');
        return { upvotes: newTotal };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

export const toggleReaction = async (staffId, targetType, targetId, emoji) => {
    const column = targetType === 'discussion' ? 'discussion_id' : 'reply_id';
    const targetTable = targetType === 'discussion' ? 'knowledge_discussions' : 'knowledge_discussion_replies';
    
    // 1. Check if the user already reacted
    const check = await pool.query(
        `SELECT id FROM knowledge_reactions WHERE staff_id = $1 AND ${column} = $2 AND emoji = $3`,
        [staffId, targetId, emoji]
    );

    if (check.rows.length > 0) {
        await pool.query('DELETE FROM knowledge_reactions WHERE id = $1', [check.rows[0].id]);
        return { action: 'removed', emoji };
    } else {
        await pool.query(
            `INSERT INTO knowledge_reactions (staff_id, ${column}, emoji) VALUES ($1, $2, $3)`,
            [staffId, targetId, emoji]
        );

        // 🔥 FIRE SILENT NOTIFICATION
        try {
            // Find who wrote the post and the title of the discussion
            const targetRes = await pool.query(`
                SELECT t.author_id, d.title, d.id as discussion_id
                FROM ${targetTable} t
                JOIN knowledge_discussions d ON d.id = ${targetType === 'discussion' ? 't.id' : 't.discussion_id'}
                WHERE t.id = $1
            `, [targetId]);

            const targetAuthor = targetRes.rows[0]?.author_id;
            
            // Get sender's name
            const senderRes = await pool.query('SELECT name FROM staff WHERE id = $1', [staffId]);
            const senderName = senderRes.rows[0]?.name;

            // Don't notify them if they react to their own post!
            if (targetAuthor && targetAuthor !== staffId) {
                await notificationService.createNotification({
                    recipientStaffId: targetAuthor,
                    senderStaffId: staffId,
                    relatedEntityType: 'discussion',
                    relatedEntityId: targetRes.rows[0].discussion_id,
                    ...notificationTemplates.knowledgeReaction({ 
                        senderName, 
                        discussionTitle: targetRes.rows[0].title,
                        emoji 
                    })
                });
            }
        } catch (err) {
            console.error("Failed to send reaction notification", err);
        }

        return { action: 'added', emoji };
    }
};
// =====================================================================
// PHASE 3: SUGGESTIONS & REVIEW QUEUE
// Staff suggest changes to a document → Owners / Editors / Reviewers of
// that service (or admins / superadmins) approve or reject them.
// Only approved content goes live, so everything in knowledge_blocks is
// reviewed content the future AI can trust.
// =====================================================================

export const getContributorRole = async (workspaceId, staffId, client = pool) => {
    const res = await client.query(
        'SELECT role FROM knowledge_contributors WHERE workspace_id = $1 AND staff_id = $2',
        [workspaceId, staffId]
    );
    return res.rows[0]?.role || null;
};

// JSON with sorted keys, so {a,b} and {b,a} compare as equal
const stableStringify = (value) => {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
    }
    return JSON.stringify(value);
};

const parseMaybe = (c) => (typeof c === 'string' ? (() => { try { return JSON.parse(c); } catch { return { text: c }; } })() : c);

// Same content, ignoring keys/metadata/order numbers?
const blocksSignature = (blocks) => stableStringify(
    (blocks || []).map(b => ({ t: b.block_type, c: parseMaybe(b.content) }))
);
const blockFingerprint = (b) => stableStringify({ t: b.block_type, c: parseMaybe(b.content) });

// SQL condition: suggestions `user` is allowed to review.
// `add` pushes a parameter and returns its $n placeholder.
const reviewableCondition = (user, add) => {
    if (user.role === 'superadmin') return 'TRUE';
    const contributorCheck = `EXISTS (
        SELECT 1 FROM knowledge_contributors kc
        WHERE kc.workspace_id = ks.workspace_id
          AND kc.staff_id = ${add(user.id)}
          AND UPPER(kc.role::text) = ANY(${add(REVIEWER_ROLES)}::text[]))`; // role is an enum → cast to text
    if (user.role === 'admin') {
        // Admins: global workspaces + their own centre's workspaces
        return `(kw.scope <> 'CENTRE' OR kw.centre_id::text = ${add(String(user.centre_id))} OR ${contributorCheck})`;
    }
    return contributorCheck;
};

export const countReviewableSuggestions = async (user) => {
    const params = [];
    const add = (v) => { params.push(v); return `$${params.length}`; };
    const res = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM knowledge_suggestions ks
         JOIN knowledge_workspaces kw ON kw.id = ks.workspace_id
         WHERE ks.status = 'pending'
           AND ks.author_id <> ${add(user.id)}
           AND ${reviewableCondition(user, add)}`,
        params
    );
    return res.rows[0].count;
};

/**
 * scope: 'review' → suggestions I can review (not my own)
 *        'mine'   → suggestions I made
 */
export const listSuggestions = async (user, { workspaceId = null, status = 'pending', scope = 'review' } = {}) => {
    const params = [];
    const add = (v) => { params.push(v); return `$${params.length}`; };
    const where = [];

    if (workspaceId) where.push(`ks.workspace_id = ${add(workspaceId)}`);
    if (status && status !== 'all') where.push(`ks.status = ${add(status)}`);

    if (scope === 'mine') {
        where.push(`ks.author_id = ${add(user.id)}`);
    } else {
        where.push(`ks.author_id <> ${add(user.id)}`);
        where.push(reviewableCondition(user, add));
    }

    const res = await pool.query(
        `SELECT ks.id, ks.workspace_id, ks.document_id, ks.author_id, ks.note, ks.status,
                ks.source_type, ks.source_id, ks.created_at, ks.updated_at,
                ks.reviewed_at, ks.review_note,
                jsonb_array_length(ks.proposed_blocks) AS proposed_count,
                jsonb_array_length(ks.base_blocks) AS base_count,
                kd.title AS document_title, kw.service_id, srv.name AS service_name,
                a.name AS author_name, r.name AS reviewer_name
         FROM knowledge_suggestions ks
         JOIN knowledge_workspaces kw ON kw.id = ks.workspace_id
         JOIN knowledge_documents kd ON kd.id = ks.document_id
         LEFT JOIN services srv ON srv.id = kw.service_id
         JOIN staff a ON a.id = ks.author_id
         LEFT JOIN staff r ON r.id = ks.reviewed_by
         WHERE ${where.join(' AND ')}
         ORDER BY ks.created_at DESC
         LIMIT 100`,
        params
    );
    return res.rows;
};

export const getSuggestionDetail = async (id, user) => {
    const res = await pool.query(
        `SELECT ks.*, kd.title AS document_title, kd.deleted_at AS document_deleted_at,
                kw.service_id, srv.name AS service_name,
                a.name AS author_name, r.name AS reviewer_name
         FROM knowledge_suggestions ks
         JOIN knowledge_workspaces kw ON kw.id = ks.workspace_id
         JOIN knowledge_documents kd ON kd.id = ks.document_id
         LEFT JOIN services srv ON srv.id = kw.service_id
         JOIN staff a ON a.id = ks.author_id
         LEFT JOIN staff r ON r.id = ks.reviewed_by
         WHERE ks.id = $1`,
        [id]
    );
    if (res.rows.length === 0) throw new KnowledgeError(404, 'Suggestion not found.');
    const s = res.rows[0];

    const workspace = await getWorkspaceById(s.workspace_id);
    const contributorRole = await getContributorRole(s.workspace_id, user.id);
    const isAuthor = String(s.author_id) === String(user.id);
    const isReviewer = can(user, 'suggestion.review', { workspace, contributorRole });

    if (!isAuthor && !isReviewer) {
        throw new KnowledgeError(403, 'You can only view your own suggestions or ones you review.');
    }

    const currentBlocks = await getDocumentBlocks(s.document_id);

    return {
        ...s,
        current_blocks: currentBlocks,
        // The document changed after this suggestion was made
        document_changed: s.status === 'pending' && s.source_type === 'edit' &&
            blocksSignature(currentBlocks) !== blocksSignature(s.base_blocks),
        can_review: s.status === 'pending' && isReviewer && !isAuthor,
        can_withdraw: s.status === 'pending' && isAuthor,
    };
};

export const getMyPendingSuggestion = async (documentId, userId) => {
    const res = await pool.query(
        `SELECT * FROM knowledge_suggestions
         WHERE document_id = $1 AND author_id = $2 AND status = 'pending' AND source_type = 'edit'
         ORDER BY updated_at DESC LIMIT 1`,
        [documentId, userId]
    );
    return res.rows[0] || null;
};

/**
 * Creates a suggestion. For normal edits, a second suggestion from the same
 * person on the same document updates their first one instead.
 */
export const createSuggestion = async ({
    workspace, documentId, user, note = null, proposedBlocks,
    sourceType = 'edit', sourceId = null,
}) => {
    const proposed = normalizeBlocks(proposedBlocks);
    const current = await getDocumentBlocks(documentId);

    if (blocksSignature(proposed) === blocksSignature(current)) {
        throw new KnowledgeError(400, 'Nothing has changed compared to the current document.');
    }

    if (sourceType === 'edit') {
        const existing = await getMyPendingSuggestion(documentId, user.id);
        if (existing) {
            const upd = await pool.query(
                `UPDATE knowledge_suggestions
                 SET proposed_blocks = $1, base_blocks = $2, note = $3, updated_at = NOW()
                 WHERE id = $4 RETURNING *`,
                [JSON.stringify(proposed), JSON.stringify(current), note, existing.id]
            );
            return { ...upd.rows[0], updated: true };
        }
    }

    const ins = await pool.query(
        `INSERT INTO knowledge_suggestions
            (workspace_id, document_id, author_id, note, base_blocks, proposed_blocks, source_type, source_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [workspace.id, documentId, user.id, note, JSON.stringify(current), JSON.stringify(proposed), sourceType, sourceId]
    );
    notify.suggestionSubmitted({ suggestion: ins.rows[0], workspace });
    return ins.rows[0];
};

// Loads a pending suggestion inside a transaction and checks the reviewer
const lockSuggestionForReview = async (client, id, user) => {
    const res = await client.query(
        `SELECT ks.*, a.name AS author_name, kd.title AS document_title, kd.deleted_at AS document_deleted_at
         FROM knowledge_suggestions ks
         JOIN staff a ON a.id = ks.author_id
         JOIN knowledge_documents kd ON kd.id = ks.document_id
         WHERE ks.id = $1
         FOR UPDATE OF ks`,
        [id]
    );
    if (res.rows.length === 0) throw new KnowledgeError(404, 'Suggestion not found.');
    const s = res.rows[0];

    if (s.status !== 'pending') throw new KnowledgeError(400, `This suggestion was already ${s.status}.`);
    if (String(s.author_id) === String(user.id)) throw new KnowledgeError(400, 'You cannot review your own suggestion.');

    const wsRes = await client.query('SELECT * FROM knowledge_workspaces WHERE id = $1', [s.workspace_id]);
    const workspace = wsRes.rows[0];
    const contributorRole = await getContributorRole(s.workspace_id, user.id, client);
    if (!can(user, 'suggestion.review', { workspace, contributorRole })) {
        throw new KnowledgeError(403, 'You are not a reviewer for this service.');
    }
    return { suggestion: s, workspace };
};

export const approveSuggestion = async (id, user, reviewNote = null) => {
    const client = await pool.connect();
    let suggestion;
    try {
        await client.query('BEGIN');
        const locked = await lockSuggestionForReview(client, id, user);
        suggestion = locked.suggestion;

        if (suggestion.document_deleted_at) {
            throw new KnowledgeError(400, 'This document has been deleted.');
        }

        const reviewerRes = await client.query('SELECT name FROM staff WHERE id = $1', [user.id]);
        const reviewerName = reviewerRes.rows[0]?.name || 'Reviewer';

        const base = suggestion.base_blocks || [];
        const proposed = suggestion.proposed_blocks || [];
        const baseByKey = new Map(base.map(b => [String(b.block_key), blockFingerprint(b)]));

        // Credit: blocks this suggestion added or changed remember who
        // suggested and who approved them (shown in the UI, useful for the AI)
        const credit = {
            suggested_by: suggestion.author_name,
            suggested_by_id: suggestion.author_id,
            approved_by: reviewerName,
            approved_by_id: user.id,
            approved_at: new Date().toISOString(),
            suggestion_id: suggestion.id,
        };
        const isChanged = (b) => baseByKey.get(String(b.block_key)) !== blockFingerprint(b);

        let finalBlocks;
        if (suggestion.source_type === 'discussion') {
            // "Add to FAQ" only appends, so add the new block(s) to the
            // document as it is NOW (keeps any edits made in the meantime)
            const current = await getBlocksWithClient(client, suggestion.document_id);
            const added = proposed
                .filter(b => !baseByKey.has(String(b.block_key)))
                .map(b => ({ ...b, metadata: { ...(b.metadata || {}), ...credit } }));
            finalBlocks = [...current, ...added];
        } else {
            finalBlocks = proposed.map(b => (isChanged(b) ? { ...b, metadata: { ...(b.metadata || {}), ...credit } } : b));
        }
        finalBlocks = finalBlocks.map((b, i) => ({ ...b, sort_order: i + 1 }));

        suggestion.diff = await writeBlocks(client, suggestion.workspace_id, suggestion.document_id, finalBlocks, user.id, 'suggestion_approved');

        await client.query(
            `UPDATE knowledge_suggestions
             SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), review_note = $2, updated_at = NOW()
             WHERE id = $3`,
            [user.id, reviewNote, id]
        );
        await client.query('COMMIT');
        suggestion.reviewerName = reviewerName;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    notify.suggestionReviewed({ suggestion, reviewerId: user.id, approved: true, note: reviewNote });
    notify.documentChanged({
        workspaceId: suggestion.workspace_id, documentId: suggestion.document_id,
        actorId: user.id, suggestedById: suggestion.author_id, diff: suggestion.diff,
    });

    return { message: 'Suggestion approved and published.' };
};

export const rejectSuggestion = async (id, user, reviewNote) => {
    if (!reviewNote || !reviewNote.trim()) {
        throw new KnowledgeError(400, 'Please add a short reason so the author knows what to fix.');
    }
    const client = await pool.connect();
    let suggestion;
    try {
        await client.query('BEGIN');
        ({ suggestion } = await lockSuggestionForReview(client, id, user));
        await client.query(
            `UPDATE knowledge_suggestions
             SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), review_note = $2, updated_at = NOW()
             WHERE id = $3`,
            [user.id, reviewNote.trim(), id]
        );
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    notify.suggestionReviewed({ suggestion, reviewerId: user.id, approved: false, note: reviewNote.trim() });

    return { message: 'Suggestion rejected.' };
};

export const withdrawSuggestion = async (id, user) => {
    const res = await pool.query(
        `UPDATE knowledge_suggestions SET status = 'withdrawn', updated_at = NOW()
         WHERE id = $1 AND author_id = $2 AND status = 'pending' RETURNING id`,
        [id, user.id]
    );
    if (res.rows.length === 0) throw new KnowledgeError(400, 'Only your own pending suggestions can be withdrawn.');
    return { message: 'Suggestion withdrawn.' };
};

/**
 * "Add to FAQ" from a solved discussion.
 * Editors (and admins) → added straight to the FAQ.
 * Everyone else → becomes a suggestion for reviewers.
 */
export const promoteDiscussionToFaq = async (discussionId, { question, answer }, user) => {
    if (!question?.trim() || !answer?.trim()) {
        throw new KnowledgeError(400, 'Both the question and the answer are required.');
    }

    const dRes = await pool.query('SELECT id, workspace_id, status FROM knowledge_discussions WHERE id = $1', [discussionId]);
    if (dRes.rows.length === 0) throw new KnowledgeError(404, 'Discussion not found.');
    const discussion = dRes.rows[0];
    if (discussion.status !== 'solved') throw new KnowledgeError(400, 'Only solved discussions can be added to the FAQ.');

    const docRes = await pool.query(
        `SELECT id FROM knowledge_documents WHERE workspace_id = $1 AND system_key = 'faq' AND deleted_at IS NULL LIMIT 1`,
        [discussion.workspace_id]
    );
    if (docRes.rows.length === 0) throw new KnowledgeError(404, 'This service has no FAQ document.');
    const faqDocId = docRes.rows[0].id;

    // Don't add the same discussion twice
    const dup = await pool.query(
        `SELECT 1 FROM knowledge_blocks WHERE document_id = $1 AND deleted_at IS NULL AND metadata->>'discussion_id' = $2
         UNION ALL
         SELECT 1 FROM knowledge_suggestions WHERE source_type = 'discussion' AND source_id = $3 AND status = 'pending'
         LIMIT 1`,
        [faqDocId, String(discussionId), discussionId]
    );
    if (dup.rows.length > 0) throw new KnowledgeError(409, 'This discussion is already in the FAQ or waiting for review.');

    const newBlock = {
        block_key: `faq-d${discussionId}-${Date.now()}`,
        block_type: 'faq_item',
        content: { question: question.trim(), answer: answer.trim() },
        metadata: { source: 'discussion', discussion_id: Number(discussionId) },
    };

    const workspace = await getWorkspaceById(discussion.workspace_id);
    const contributorRole = await getContributorRole(workspace.id, user.id);
    const current = await getDocumentBlocks(faqDocId);

    if (can(user, 'document.edit', { workspace, contributorRole })) {
        const staffRes = await pool.query('SELECT name FROM staff WHERE id = $1', [user.id]);
        newBlock.metadata.added_by = staffRes.rows[0]?.name;
        newBlock.metadata.added_by_id = user.id;
        const blocks = normalizeBlocks([...current, newBlock]);
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const diff = await writeBlocks(client, workspace.id, faqDocId, blocks, user.id, 'faq_from_discussion');
            await client.query('COMMIT');
            notify.documentChanged({ workspaceId: workspace.id, documentId: faqDocId, actorId: user.id, diff });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
        return { mode: 'published', documentId: faqDocId };
    }

    const suggestion = await createSuggestion({
        workspace, documentId: faqDocId, user,
        note: 'FAQ entry from a solved discussion',
        proposedBlocks: [...current, newBlock],
        sourceType: 'discussion', sourceId: Number(discussionId),
    });
    return { mode: 'suggested', suggestionId: suggestion.id, documentId: faqDocId };
};

// =====================================================================
// IMPORT FROM SERVICE SETUP
// Builds starter SOP blocks from data that already exists in Service
// Management: required documents (service + each subcategory) and the
// official website.
// Nothing is saved here — the editor shows the blocks and a person
// reviews them before saving (or sending as a suggestion).
//
// Fees / charges are left out on purpose: they're configured per centre,
// and the SOP is shared by every centre.
// Block keys start with "imp-" so a second import only adds what's new.
// =====================================================================
export const buildSetupImport = async (documentId) => {
    const workspace = await getDocumentWorkspace(documentId);
    const serviceId = workspace.service_id;

    const svcRes = await pool.query('SELECT id, name, website FROM services WHERE id = $1', [serviceId]);
    if (svcRes.rows.length === 0) throw new KnowledgeError(404, 'Service not found.');
    const service = svcRes.rows[0];

    // Subcategories, skipping ones that are switched off in every centre
    const subRes = await pool.query(
        `SELECT sc.id, sc.name
         FROM subcategories sc
         WHERE sc.service_id = $1
           AND (
             NOT EXISTS (SELECT 1 FROM subcategory_configurations c WHERE c.subcategory_id = sc.id)
             OR EXISTS (SELECT 1 FROM subcategory_configurations c WHERE c.subcategory_id = sc.id AND c.is_enabled = true)
           )
         ORDER BY sc.id`,
        [serviceId]
    );
    const subs = subRes.rows;
    const subIds = subs.map(s => s.id);

    const docRes = await pool.query(
        `SELECT id, sub_category_id, document_name
         FROM required_documents
         WHERE (service_id = $1 AND sub_category_id IS NULL)
            OR sub_category_id = ANY($2::int[])
         ORDER BY id`,
        [serviceId, subIds]
    );

    const docName = (d) => String(d.document_name || '').trim();
    const blocks = [];
    const meta = { source: 'service_setup', service_id: service.id };

    // --- Required documents ---
    const generalDocs = docRes.rows.filter(d => d.sub_category_id === null && docName(d));
    const docsBySub = new Map();
    docRes.rows.filter(d => d.sub_category_id !== null && docName(d)).forEach(d => {
        if (!docsBySub.has(d.sub_category_id)) docsBySub.set(d.sub_category_id, []);
        docsBySub.get(d.sub_category_id).push(d);
    });
    const subsWithDocs = subs.filter(s => docsBySub.has(s.id));

    if (generalDocs.length || subsWithDocs.length) {
        blocks.push({ block_key: 'imp-h-docs', block_type: 'h2', content: { text: 'Required documents' }, metadata: meta });
        generalDocs.forEach(d => blocks.push({
            block_key: `imp-doc-${d.id}`, block_type: 'required_document',
            content: { name: docName(d), note: '', mandatory: true }, metadata: meta,
        }));
        subsWithDocs.forEach(s => {
            blocks.push({ block_key: `imp-h-sub-${s.id}`, block_type: 'h3', content: { text: s.name }, metadata: meta });
            docsBySub.get(s.id).forEach(d => blocks.push({
                block_key: `imp-doc-${d.id}`, block_type: 'required_document',
                content: { name: docName(d), note: '', mandatory: true }, metadata: meta,
            }));
        });
    }

    // Fees are NOT imported: charges are configured per centre (and most
    // department fees are ₹0), so typed amounts in a shared SOP would be
    // wrong for some centres. Fees should be shown live from each centre's
    // configuration instead.

    // --- Official website ---
    const website = String(service.website || '').trim();
    if (/^https?:\/\//i.test(website)) {
        blocks.push({ block_key: 'imp-link-website', block_type: 'link', content: { label: `${service.name} — official portal`, url: website }, metadata: meta });
    }

    return {
        service: { id: service.id, name: service.name },
        blocks,
        summary: {
            documents: docRes.rows.filter(docName).length,
            subcategories: subs.length,
            website: blocks.some(b => b.block_key === 'imp-link-website'),
        },
    };
};

// =====================================================================
// CHARGES AT YOUR CENTRE (live, read-only)
// Charges are configured per centre, so they're never typed into the
// shared SOP. This reads them live from service_configurations /
// subcategory_configurations.
//   admin / staff → their own centre only
//   superadmin    → one centre (centreId) or every centre side by side
// =====================================================================
const toNum = (v) => (v === null || v === undefined ? 0 : Number(v));

const loadCentreCharges = async (serviceId, centreIds) => {
    const svcRes = await pool.query(
        `SELECT centre_id, is_enabled, service_charge, department_charge
         FROM service_configurations
         WHERE service_id = $1 AND centre_id = ANY($2::int[])`,
        [serviceId, centreIds]
    );
    const subRes = await pool.query(
        `SELECT c.centre_id, scat.id, scat.name, c.service_charge, c.department_charge
         FROM subcategories scat
         JOIN subcategory_configurations c
           ON c.subcategory_id = scat.id AND c.is_enabled = true AND c.centre_id = ANY($2::int[])
         WHERE scat.service_id = $1
         ORDER BY scat.id`,
        [serviceId, centreIds]
    );
    const svcByCentre = new Map(svcRes.rows.map(r => [Number(r.centre_id), r]));
    return (centreId) => {
        const svc = svcByCentre.get(Number(centreId));
        const subs = subRes.rows
            .filter(r => Number(r.centre_id) === Number(centreId))
            .map(r => {
                const service_charge = toNum(r.service_charge);
                const department_charge = toNum(r.department_charge);
                return { id: r.id, name: r.name, service_charge, department_charge, total: service_charge + department_charge };
            });
        return {
            enabled: !!svc && svc.is_enabled !== false,
            service: svc ? {
                service_charge: toNum(svc.service_charge),
                department_charge: toNum(svc.department_charge),
                total: toNum(svc.service_charge) + toNum(svc.department_charge),
            } : null,
            subcategories: subs,
        };
    };
};

export const getServiceCharges = async (serviceId, user, requestedCentreId = null) => {
    const svc = await pool.query('SELECT id, name FROM services WHERE id = $1', [serviceId]);
    if (svc.rows.length === 0) throw new KnowledgeError(404, 'Service not found.');
    const service = svc.rows[0];

    // Admin / staff: always their own centre, whatever was asked for
    if (user.role !== 'superadmin') {
        const centreId = parseInt(user.centre_id, 10);
        if (Number.isNaN(centreId)) throw new KnowledgeError(400, 'No centre found for this user.');
        const c = await pool.query('SELECT id, name FROM centres WHERE id = $1', [centreId]);
        const read = await loadCentreCharges(serviceId, [centreId]);
        return {
            service, mode: 'single',
            centres: [{ id: centreId, name: c.rows[0]?.name || `Centre ${centreId}`, ...read(centreId) }],
        };
    }

    // Superadmin: one centre, or all of them
    const centresRes = requestedCentreId
        ? await pool.query('SELECT id, name FROM centres WHERE id = $1', [parseInt(requestedCentreId, 10)])
        : await pool.query('SELECT id, name FROM centres ORDER BY name');
    if (centresRes.rows.length === 0) throw new KnowledgeError(404, 'Centre not found.');

    const ids = centresRes.rows.map(c => Number(c.id));
    const read = await loadCentreCharges(serviceId, ids);
    return {
        service,
        mode: requestedCentreId ? 'single' : 'all',
        centres: centresRes.rows.map(c => ({ id: Number(c.id), name: c.name, ...read(c.id) })),
    };
};
