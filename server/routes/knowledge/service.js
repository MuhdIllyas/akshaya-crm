//knowledge - service.js
import pool from '../../db.js';

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

    // 1. Added the COUNT queries to the Promise.all array (and added discussionsRes, casesRes to the destructured array)
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

    // 2. Updated the stats object to use the real database counts!
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
export const getDiscussions = async (workspaceId) => {
    // Fetch discussions with author name and reply count
    const res = await pool.query(
        `SELECT d.*, s.name as author_name, 
        (SELECT COUNT(*) FROM knowledge_discussion_replies r WHERE r.discussion_id = d.id) as replies_count
        FROM knowledge_discussions d
        JOIN staff s ON d.author_id = s.id
        WHERE d.workspace_id = $1
        ORDER BY d.created_at DESC`,
        [workspaceId]
    );

    // Fetch replies for all these discussions
    const repliesRes = await pool.query(
        `SELECT r.*, s.name as author_name 
         FROM knowledge_discussion_replies r
         JOIN staff s ON r.author_id = s.id
         WHERE r.discussion_id IN (SELECT id FROM knowledge_discussions WHERE workspace_id = $1)
         ORDER BY r.created_at ASC`,
        [workspaceId]
    );

    // Attach replies to their respective discussions
    return res.rows.map(discussion => ({
        ...discussion,
        replies: repliesRes.rows.filter(r => r.discussion_id === discussion.id)
    }));
};

export const createDiscussion = async (workspaceId, payload, staffId) => {
    const { title, content, category, priority, tags, relatedTo, relatedId } = payload;
    
    const customerStr = relatedTo === 'customer' ? relatedId : null;
    const appStr = relatedTo === 'serviceEntry' ? relatedId : null;

    const res = await pool.query(
        `INSERT INTO knowledge_discussions 
        (workspace_id, title, content, category, priority, tags, author_id, crm_customer, crm_application) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [workspaceId, title, content, category, priority, tags || [], staffId, customerStr, appStr]
    );
    
    // Increment workspace updated_at
    await pool.query(`UPDATE knowledge_workspaces SET updated_at = NOW() WHERE id = $1`, [workspaceId]);
    return res.rows[0];
};

export const addReply = async (discussionId, content, authorId) => {
    // 1. Save the actual reply
    const replyRes = await pool.query(
        'INSERT INTO knowledge_discussion_replies (discussion_id, content, author_id) VALUES ($1, $2, $3) RETURNING *',
        [discussionId, content, authorId]
    );

    // 2. THE ENGINE: Scan the text for mentions and notify them!
    const mentionedIds = extractMentions(content);
    
    for (const targetId of mentionedIds) {
        // NOTE: If you WANT to notify yourself for testing, delete this "if" statement!
        if (targetId !== authorId) { 
            await pool.query(
                'INSERT INTO knowledge_mentions (staff_id, author_id, discussion_id, reply_id) VALUES ($1, $2, $3, $4)',
                [targetId, authorId, discussionId, replyRes.rows[0].id]
            );
        }
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
        
        // 1. Mark discussion as solved
        await client.query(`UPDATE knowledge_discussions SET status = 'solved', updated_at = NOW() WHERE id = $1`, [discussionId]);
        
        let solutionText = "This issue was manually marked as resolved by staff.";

        // 2. Mark specific reply as best answer AND grab the text for the Case
        if (replyId) {
            await client.query(`UPDATE knowledge_discussion_replies SET is_best_answer = true WHERE id = $1`, [replyId]);
            
            const replyRes = await client.query(`SELECT content FROM knowledge_discussion_replies WHERE id = $1`, [replyId]);
            if (replyRes.rows.length > 0) {
                solutionText = replyRes.rows[0].content;
            }
        }

        // 3. Fetch the original discussion details
        const discussionRes = await client.query(
            `SELECT workspace_id, title, content, tags FROM knowledge_discussions WHERE id = $1`, 
            [discussionId]
        );
        const discussion = discussionRes.rows[0];

        // 4. 🔥 THE FIX: Insert everything into the Solved Cases table!
        await client.query(
            `INSERT INTO knowledge_cases 
            (workspace_id, title, description, solution, original_discussion_id, tags, solved_by) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                discussion.workspace_id, 
                discussion.title, 
                discussion.content, 
                solutionText, 
                discussionId, 
                discussion.tags, 
                staffId
            ]
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
    // 1. Check if it's already bookmarked
    const check = await pool.query(
        'SELECT id FROM knowledge_bookmarks WHERE staff_id = $1 AND target_type = $2 AND target_id = $3',
        [staffId, targetType, targetId]
    );

    if (check.rows.length > 0) {
        // Un-bookmark it
        await pool.query('DELETE FROM knowledge_bookmarks WHERE id = $1', [check.rows[0].id]);
        return { bookmarked: false };
    } else {
        // Bookmark it
        await pool.query(
            'INSERT INTO knowledge_bookmarks (staff_id, target_type, target_id) VALUES ($1, $2, $3)',
            [staffId, targetType, targetId]
        );
        return { bookmarked: true };
    }
};

export const getMyBookmarks = async (staffId) => {
    // join the discussions table to grab the titles of bookmarked discussions
    // (easily expand this query later to JOIN your documents/trainings tables too)
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

// Update your getAnnouncements function to pull the staff name!
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
    // ADDED: mentions to the destructured array, and the query to Promise.all
    const [discussions, cases, resources, announcements, trainings, mentions] = await Promise.all([
        pool.query("SELECT COUNT(*) FROM knowledge_discussions WHERE deleted_at IS NULL"),
        pool.query("SELECT COUNT(*) FROM knowledge_cases"),
        pool.query("SELECT COUNT(*) FROM knowledge_resources WHERE deleted_at IS NULL"),
        pool.query("SELECT COUNT(*) FROM knowledge_announcements"),
        pool.query("SELECT COUNT(*) FROM knowledge_trainings"),
        pool.query("SELECT COUNT(*) FROM knowledge_mentions WHERE staff_id = $1 AND is_read = false", [staffId])
    ]);

    return {
        discussions: parseInt(discussions.rows[0].count, 10) || 0,
        cases: parseInt(cases.rows[0].count, 10) || 0,
        resources: parseInt(resources.rows[0].count, 10) || 0,
        announcements: parseInt(announcements.rows[0].count, 10) || 0,
        trainings: parseInt(trainings.rows[0].count, 10) || 0,
        mentions: parseInt(mentions.rows[0].count, 10) || 0 
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
    // Fetches discussions across all workspaces, includes author name and service name
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

// THE FIX: Added userId parameter
export const getDiscussionById = async (id, userId) => { 
    // 1. Get the main post
    const discussionRes = await pool.query(`
        SELECT 
            d.*, 
            s.name as author_name, 
            srv.name as service_name,
            -- THE FIX: Check if this specific user has bookmarked this specific thread
            EXISTS(
                SELECT 1 FROM knowledge_bookmarks 
                WHERE target_type = 'discussion' AND target_id = d.id AND staff_id = $2
            ) as is_bookmarked
            EXISTS(
                SELECT 1 FROM knowledge_followers 
                WHERE discussion_id = d.id AND staff_id = $2
            ) as is_following 
        FROM knowledge_discussions d
        JOIN staff s ON d.author_id = s.id
        JOIN knowledge_workspaces kw ON d.workspace_id = kw.id
        LEFT JOIN services srv ON kw.service_id = srv.id
        WHERE d.id = $1
    `, [id, userId]); // <-- Passed userId to the SQL array

    if (discussionRes.rows.length === 0) throw new Error("Discussion not found");
    const discussion = discussionRes.rows[0];

    // 2. Get the replies 
    const repliesRes = await pool.query(`
        SELECT r.*, s.name as author_name 
        FROM knowledge_discussion_replies r
        JOIN staff s ON r.author_id = s.id
        WHERE r.discussion_id = $1
        ORDER BY r.created_at ASC
    `, [id]);

    return { ...discussion, replies: repliesRes.rows };
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
    // Fetches all followed discussions and counts their replies
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