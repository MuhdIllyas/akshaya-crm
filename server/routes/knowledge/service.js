//knowledge - service.js
import pool from '../../db.js';
import notificationService from '../../utils/notificationService.js'; 
import { notificationTemplates } from '../../utils/notificationTemplates.js';

// ==========================================
// WORKSPACE & STATS (Inheritance Logic)
// ==========================================
export const getWorkspaceData = async (serviceId, centreId, staffId) => {
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
            
            const insertWs = await client.query(
                `INSERT INTO knowledge_workspaces (service_id, scope, status) 
                 VALUES ($1, 'GLOBAL', 'draft') RETURNING *`,
                [serviceId]
            );
            workspace = insertWs.rows[0];

            await client.query(
                `INSERT INTO knowledge_contributors (workspace_id, staff_id, role) VALUES ($1, $2, 'OWNER')`,
                [workspace.id, staffId]
            );

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
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } else {
        workspace = workspaceRes.rows[0];
    }

    const [docsRes, blocksRes, resourcesRes, contributorsRes, discussionsRes, casesRes] = await Promise.all([
        pool.query('SELECT * FROM knowledge_documents WHERE workspace_id = $1 AND deleted_at IS NULL ORDER BY sort_order ASC', [workspace.id]),
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

    return {
        workspace,
        contributors: contributorsRes.rows,
        documents: formattedDocs,
        resources: resourcesRes.rows,
        stats
    };
};

export const updateWorkspaceStatus = async (workspaceId, newStatus, staffId) => {
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
    
    await logHistory(workspaceId, 'workspace', workspaceId, 'status_change', { previous: 'unknown' }, { status: newStatus }, staffId);
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
export const addContributor = async (workspaceId, staffId, role) => {
    await pool.query(
        `INSERT INTO knowledge_contributors (workspace_id, staff_id, role) 
         VALUES ($1, $2, $3) ON CONFLICT (workspace_id, staff_id) 
         DO UPDATE SET role = EXCLUDED.role`,
        [workspaceId, staffId, role]
    );
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
    const docRes = await pool.query('SELECT workspace_id, type FROM knowledge_documents WHERE id = $1', [id]);
    
    if (docRes.rows[0].type === 'SYSTEM') {
        throw new Error("System documents cannot be deleted.");
    }

    const workspaceId = docRes.rows[0].workspace_id;
    await pool.query('UPDATE knowledge_documents SET deleted_at = NOW(), deleted_by = $2 WHERE id = $1', [id, staffId]);
    await logHistory(workspaceId, 'document', id, 'deleted', null, null, staffId);
};

// ==========================================
// BLOCKS 
// ==========================================
export const batchUpdateBlocks = async (workspaceId, documentId, newBlocks, staffId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const oldBlocksRes = await client.query('SELECT * FROM knowledge_blocks WHERE document_id = $1 AND deleted_at IS NULL ORDER BY sort_order ASC', [documentId]);
        const oldContent = oldBlocksRes.rows;

        await client.query('DELETE FROM knowledge_blocks WHERE document_id = $1', [documentId]);

        for (let block of newBlocks) {
            await client.query(
                `INSERT INTO knowledge_blocks (document_id, block_key, block_type, content, metadata, sort_order) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [documentId, block.block_key, block.block_type, JSON.stringify(block.content), JSON.stringify(block.metadata || {}), block.sort_order]
            );
        }

        await logHistoryTransaction(client, workspaceId, 'document_blocks', documentId, 'batch_update', oldContent, newBlocks, staffId);
        await client.query(`UPDATE knowledge_workspaces SET updated_at = NOW() WHERE id = $1`, [workspaceId]);
        await client.query('COMMIT');
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
        (SELECT vote_type FROM knowledge_votes WHERE discussion_id = d.id AND staff_id = $2) as user_vote
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

export const createDiscussion = async (workspaceId, payload, staffId) => {
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
        if (workspaceRes.rows.length === 0) throw new Error("Invalid Workspace.");
        const expectedServiceId = workspaceRes.rows[0].service_id;

        if (expectedServiceId) {
            let queryStr = `
                SELECT se.category_id 
                FROM service_tracking st
                JOIN service_entries se ON st.service_entry_id = se.id
                WHERE st.application_number ILIKE $1
            `;
            const params = [searchParam];

            if (!isNaN(numericId)) {
                queryStr += ` OR st.id = $2`;
                params.push(numericId);
            }

            const appRes = await pool.query(queryStr, params);

            if (appRes.rows.length === 0) {
                throw new Error("The linked CRM application could not be found.");
            }

            const actualServiceId = appRes.rows[0].category_id;

            if (parseInt(expectedServiceId, 10) !== parseInt(actualServiceId, 10)) {
                throw new Error("Integrity Check Failed: You cannot link this application to this workspace because they belong to different services.");
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
        
        await client.query(`UPDATE knowledge_discussions SET status = 'solved', updated_at = NOW() WHERE id = $1`, [discussionId]);
        
        let solutionText = "This issue was manually marked as resolved by staff.";
        let replyAuthorId = null;

        if (replyId) {
            await client.query(`UPDATE knowledge_discussion_replies SET is_best_answer = true WHERE id = $1`, [replyId]);
            
            const replyRes = await client.query(`SELECT content, author_id FROM knowledge_discussion_replies WHERE id = $1`, [replyId]);
            if (replyRes.rows.length > 0) {
                solutionText = replyRes.rows[0].content;
                replyAuthorId = replyRes.rows[0].author_id;
            }
        }

        const discussionRes = await client.query(`SELECT workspace_id, title, content, tags FROM knowledge_discussions WHERE id = $1`, [discussionId]);
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

export const createAnnouncement = async (title, content, category, priority, isPinned, staffId) => {
    const res = await pool.query(
        `INSERT INTO knowledge_announcements (title, content, category, priority, is_pinned, created_by) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [title, content, category, priority, isPinned, staffId]
    );
    return res.rows[0];
};

export const getAnnouncements = async () => {
    const res = await pool.query(`
        SELECT a.*, s.name as author_name 
        FROM knowledge_announcements a
        LEFT JOIN staff s ON a.created_by = s.id
        ORDER BY a.is_pinned DESC, a.created_at DESC 
        LIMIT 50
    `);
    return res.rows;
};

export const getGlobalStats = async (staffId) => { 
    const [discussions, cases, resources, announcements, trainings, mentions, drafts] = await Promise.all([
        pool.query("SELECT COUNT(*) FROM knowledge_discussions WHERE deleted_at IS NULL"),
        pool.query("SELECT COUNT(*) FROM knowledge_cases"),
        pool.query("SELECT COUNT(*) FROM knowledge_resources WHERE deleted_at IS NULL"),
        pool.query("SELECT COUNT(*) FROM knowledge_announcements"),
        pool.query("SELECT COUNT(*) FROM knowledge_trainings"),
        pool.query("SELECT COUNT(*) FROM knowledge_mentions WHERE staff_id = $1 AND is_read = false", [staffId]),
        pool.query("SELECT COUNT(*) FROM knowledge_drafts WHERE staff_id = $1", [staffId]) 
    ]);

    return {
        discussions: parseInt(discussions.rows[0].count, 10) || 0,
        cases: parseInt(cases.rows[0].count, 10) || 0,
        resources: parseInt(resources.rows[0].count, 10) || 0,
        announcements: parseInt(announcements.rows[0].count, 10) || 0,
        trainings: parseInt(trainings.rows[0].count, 10) || 0,
        mentions: parseInt(mentions.rows[0].count, 10) || 0,
        drafts: parseInt(drafts.rows[0].count, 10) || 0 
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
    return res.rows[0];
};

export const getAllDiscussions = async () => {
    const res = await pool.query(`
        SELECT 
            d.*, 
            s.name as author_name, 
            srv.name as service_name,
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

    if (discussionRes.rows.length === 0) throw new Error("Discussion not found");
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
        return { action: 'added', emoji };
    }
};