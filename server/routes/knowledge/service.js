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

    const [docsRes, blocksRes, resourcesRes, contributorsRes] = await Promise.all([
        pool.query('SELECT * FROM knowledge_documents WHERE workspace_id = $1 AND deleted_at IS NULL ORDER BY sort_order ASC', [workspace.id]),
        pool.query(
            `SELECT kb.* FROM knowledge_blocks kb
             JOIN knowledge_documents kd ON kb.document_id = kd.id
             WHERE kd.workspace_id = $1 AND kb.deleted_at IS NULL 
             ORDER BY kb.sort_order ASC`,
            [workspace.id]
        ),
        pool.query('SELECT * FROM knowledge_resources WHERE workspace_id = $1 AND deleted_at IS NULL ORDER BY id DESC', [workspace.id]),
        pool.query('SELECT c.*, s.name as staff_name FROM knowledge_contributors c JOIN staff s ON c.staff_id = s.id WHERE c.workspace_id = $1', [workspace.id])
    ]);

    const formattedDocs = docsRes.rows.map(doc => ({
        ...doc,
        blocks: blocksRes.rows.filter(b => b.document_id === doc.id)
    }));

    const stats = {
        discussionCount: 0, 
        caseCount: 0,
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

export const addReply = async (discussionId, content, staffId) => {
    const res = await pool.query(
        `INSERT INTO knowledge_discussion_replies (discussion_id, content, author_id) 
         VALUES ($1, $2, $3) RETURNING *`,
        [discussionId, content, staffId]
    );
    
    // Update discussion timestamp
    await pool.query(`UPDATE knowledge_discussions SET updated_at = NOW() WHERE id = $1`, [discussionId]);
    return res.rows[0];
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