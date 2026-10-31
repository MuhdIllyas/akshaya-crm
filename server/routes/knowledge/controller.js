//knowledge - controller.js
import * as knowledgeService from './service.js';
import { can, sendError, KnowledgeError, WORKSPACE_STATUSES, CONTRIBUTOR_ROLES } from './permissions.js';

// PHASE 2: throws 403 unless the user may do `action` on this workspace
// (covers the "admins only control their own centre" rule)
const assertCan = (user, action, workspace) => {
    if (!can(user, action, { workspace })) {
        throw new KnowledgeError(403, 'You do not have permission to change this workspace.');
    }
};

export const getWorkspace = async (req, res) => {
    try {
        const { serviceId } = req.params;
        const staffId = req.user.id; 
        const centreId = req.user.centre_id; 
        
        const workspaceData = await knowledgeService.getWorkspaceData(serviceId, centreId, staffId);
        res.json(workspaceData);
    } catch (err) {
        console.error('Error in getWorkspace:', err.message);
        res.status(500).json({ error: 'Failed to load workspace' });
    }
};

export const updateWorkspaceStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; 
        if (!WORKSPACE_STATUSES.includes(status)) {
            throw new KnowledgeError(400, `Status must be one of: ${WORKSPACE_STATUSES.join(', ')}`);
        }
        
        const updated = await knowledgeService.updateWorkspaceStatus(id, status, req.user.id);
        res.json(updated);
    } catch (err) {
        sendError(res, err, 'Failed to update status');
    }
};

export const addContributor = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { staffId, role } = req.body;
        const finalRole = (role || 'EDITOR').toUpperCase();
        if (!CONTRIBUTOR_ROLES.includes(finalRole)) {
            throw new KnowledgeError(400, `Role must be one of: ${CONTRIBUTOR_ROLES.join(', ')}`);
        }
        assertCan(req.user, 'contributor.manage', await knowledgeService.getWorkspaceById(workspaceId));
        await knowledgeService.addContributor(workspaceId, staffId, finalRole);
        res.json({ message: 'Contributor added' });
    } catch (err) {
        sendError(res, err, 'Failed to add contributor');
    }
};

export const removeContributor = async (req, res) => {
    try {
        const { workspaceId, staffId } = req.params;
        assertCan(req.user, 'contributor.manage', await knowledgeService.getWorkspaceById(workspaceId));
        await knowledgeService.removeContributor(workspaceId, staffId);
        res.json({ message: 'Contributor removed' });
    } catch (err) {
        sendError(res, err, 'Failed to remove contributor');
    }
};

export const createDocument = async (req, res) => {
    try {
        const { workspaceId, title, slug, type, visibility, sortOrder } = req.body;
        assertCan(req.user, 'document.create', await knowledgeService.getWorkspaceById(workspaceId));
        const document = await knowledgeService.createDocument(
            workspaceId, title, slug, type, visibility, sortOrder, req.user.id
        );
        res.status(201).json(document);
    } catch (err) {
        sendError(res, err, 'Failed to create document');
    }
};

export const updateDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, slug, visibility, sortOrder } = req.body;
        assertCan(req.user, 'document.edit', await knowledgeService.getDocumentWorkspace(id));
        const document = await knowledgeService.updateDocument(id, title, slug, visibility, sortOrder, req.user.id);
        res.json(document);
    } catch (err) {
        sendError(res, err, 'Failed to update document');
    }
};

export const deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;
        assertCan(req.user, 'document.delete', await knowledgeService.getDocumentWorkspace(id));
        await knowledgeService.softDeleteDocument(id, req.user.id);
        res.json({ message: 'Document deleted successfully' });
    } catch (err) {
        sendError(res, err, 'Failed to delete document');
    }
};

export const batchUpdateBlocks = async (req, res) => {
    try {
        const { documentId } = req.params;
        const { blocks } = req.body; 
        if (!Array.isArray(blocks)) throw new KnowledgeError(400, 'blocks must be an array.');

        // PHASE 2 FIX: the workspace comes from the document itself, not from
        // the browser, so a document can't be saved into the wrong workspace
        const workspace = await knowledgeService.getDocumentWorkspace(documentId);
        assertCan(req.user, 'document.edit', workspace);

        await knowledgeService.batchUpdateBlocks(workspace.id, documentId, blocks, req.user.id);
        res.json({ message: 'Blocks saved successfully' });
    } catch (err) {
        sendError(res, err, 'Failed to save blocks');
    }
};

export const addResource = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        assertCan(req.user, 'resource.add', await knowledgeService.getWorkspaceById(workspaceId));
        
        // ADDED: Fallbacks so they default to null if missing!
        const type = req.body.type || 'portal';
        const title = req.body.title;
        const url = req.body.url || null;
        const fileId = req.body.fileId || null; 
        if (!title || !title.trim()) throw new KnowledgeError(400, 'Title is required.');

        const resource = await knowledgeService.addResource(
            workspaceId, type, title, url, fileId, req.user.id
        );
        res.status(201).json(resource);
    } catch (err) {
        sendError(res, err, 'Failed to add resource');
    }
};

export const deleteResource = async (req, res) => {
    try {
        const { id } = req.params;
        assertCan(req.user, 'resource.delete', await knowledgeService.getResourceWorkspace(id));
        await knowledgeService.softDeleteResource(id, req.user.id);
        res.json({ message: 'Resource deleted' });
    } catch (err) {
        sendError(res, err, 'Failed to delete resource');
    }
};

export const getDiscussions = async (req, res) => {
    try {
        // 🔥 Passed req.user.id as the second argument!
        const discussions = await knowledgeService.getDiscussions(req.params.workspaceId, req.user.id);
        res.json(discussions);
    } catch (err) {
        console.error("Fetch Discussions Error:", err);
        res.status(500).json({ error: 'Failed to fetch discussions' });
    }
};

export const createDiscussion = async (req, res) => {
    try {
        if (!req.body.title?.trim() || !req.body.content?.trim()) {
            throw new KnowledgeError(400, 'Title and details are required.');
        }
        const discussion = await knowledgeService.createDiscussion(req.params.workspaceId, req.body, req.user.id, req.user);
        res.status(201).json(discussion);
    } catch (err) {
        sendError(res, err, 'Failed to create discussion');
    }
};

export const getCases = async (req, res) => {
    try {
        // We can just write the query right here for simplicity, or put it in service.js
        const { workspaceId } = req.params;
        const result = await knowledgeService.getCases(workspaceId);
        res.json(result);
    } catch (err) {
        console.error("💥 CASES CRASH INFO:", err);
        res.status(500).json({ error: 'Failed to fetch cases', details: err.message });
    }
};

export const solveDiscussion = async (req, res) => {
    try {
        const { discussionId } = req.params;
        const { replyId } = req.body;
        const userId = req.user.id;

        // 1. Fetch the discussion to see who owns it and its current status
        // (Reusing the service function you already built!)
        const discussion = await knowledgeService.getDiscussionById(discussionId, userId);
        
        if (!discussion) {
            return res.status(404).json({ error: 'Discussion not found' });
        }

        // 2. Prevent altering an already solved case
        if (discussion.status === 'solved') {
            return res.status(400).json({ error: 'This discussion is already closed and archived.' });
        }

        // 3. THE GATEKEEPER: the author OR an admin/superadmin (shared rule in permissions.js)
        if (!can(req.user, 'discussion.solve', { authorId: discussion.author_id })) {
            return res.status(403).json({ 
                error: 'Only the person who started this discussion or an Admin can mark it solved.' 
            });
        }

        // 4. If they pass the checks, proceed with solving!
        await knowledgeService.markDiscussionSolved(discussionId, replyId || null, userId);
        res.json({ message: 'Discussion securely locked and marked as solved.' });

    } catch (err) {
        sendError(res, err, 'Failed to mark as solved');
    }
};

export const getGlobalStats = async (req, res) => {
    try {
        const stats = await knowledgeService.getGlobalStats(req.user.id);
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch global stats' });
    }
};

export const createAnnouncement = async (req, res) => {
    try {
        // 🔥 Added teamId to the destructured body variables
        const { title, content, category, priority, isPinned, teamId } = req.body; 
        
        const announcement = await knowledgeService.createAnnouncement(
            title, 
            content, 
            category, 
            priority, 
            isPinned, 
            req.user.id, 
            teamId // 🔥 Pass it to the service layer
        );
        res.status(201).json(announcement);
    } catch (err) {
        console.error("💥 CREATE ANNOUNCEMENT CRASH INFO:", err);
        res.status(500).json({ error: 'Failed to create announcement', details: err.message });
    }
};

export const getAnnouncements = async (req, res) => {
    try {
        // 🔥 Extract teamId from query parameters
        const { teamId } = req.query; 
        
        // 🔥 Pass it to the service layer
        const announcements = await knowledgeService.getAnnouncements(teamId); 
        res.json(announcements);
    } catch (err) {
        console.error("💥 ANNOUNCEMENTS CRASH INFO:", err);
        res.status(500).json({ error: 'Failed to fetch announcements', details: err.message });
    }
};

export const getTrainings = async (req, res) => {
    try { res.json(await knowledgeService.getTrainings()); } 
    catch (err) { res.status(500).json({ error: 'Failed to fetch trainings' }); }
};

export const createTraining = async (req, res) => {
    try {
        const { title, description, type, url, duration } = req.body;
        const training = await knowledgeService.createTraining(title, description, type, url, duration, req.user.id);
        res.status(201).json(training);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create training' });
    }
};

export const getAllDiscussions = async (req, res) => {
    try {
        const discussions = await knowledgeService.getAllDiscussions();
        res.json(discussions);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch global discussions' });
    }
};

export const getServiceDiscussionCounts = async (req, res) => {
    try {
        res.json(await knowledgeService.getServiceDiscussionCounts());
    } catch (err) {
        console.error("💥 SERVICE COUNTS CRASH INFO:", err);
        res.status(500).json({ error: 'Failed to fetch service counts' });
    }
};

export const getDiscussionById = async (req, res) => {
    try {
        // Pass req.user.id as the second argument!
        const discussion = await knowledgeService.getDiscussionById(req.params.id, req.user.id);
        res.json(discussion);
    } catch (err) {
        sendError(res, err, 'Failed to fetch discussion details');
    }
};

export const toggleBookmark = async (req, res) => {
    try {
        const { targetType, targetId } = req.body;
        const result = await knowledgeService.toggleBookmark(req.user.id, targetType, targetId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to toggle bookmark' });
    }
};

export const getMyBookmarks = async (req, res) => {
    try {
        const bookmarks = await knowledgeService.getMyBookmarks(req.user.id);
        res.json(bookmarks);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch bookmarks' });
    }
};

export const getMyMentions = async (req, res) => {
    try { res.json(await knowledgeService.getMyMentions(req.user.id)); } 
    catch (err) { res.status(500).json({ error: 'Failed to fetch mentions' }); }
};

export const markMentionsRead = async (req, res) => {
    try {
        await knowledgeService.markMentionsRead(req.user.id, req.body.discussionId);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Failed to mark read' }); }
};

export const searchStaff = async (req, res) => {
    try {
        const staff = await knowledgeService.searchStaffForMentions(req.query.q || '');
        res.json(staff);
    } catch (err) {
        res.status(500).json({ error: 'Failed to search staff' });
    }
};

export const toggleFollow = async (req, res) => {
    try {
        const result = await knowledgeService.toggleFollow(req.user.id, req.body.discussionId);
        res.json(result);
    } catch (err) { 
        // ADD THIS LINE so we can see the real crash in your terminal!
        console.error("💥 FOLLOW CRASH INFO:", err); 
        res.status(500).json({ error: 'Failed to toggle follow' }); 
    }
};

export const getMyFollowing = async (req, res) => {
    try { res.json(await knowledgeService.getMyFollowing(req.user.id)); } 
    catch (err) { res.status(500).json({ error: 'Failed to fetch followed threads' }); }
};

export const logView = async (req, res) => {
    try {
        await knowledgeService.logRecentView(req.user.id, req.body.targetType, req.body.targetId);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Failed to log view' }); }
};

export const getMyHistory = async (req, res) => {
    try { res.json(await knowledgeService.getMyHistory(req.user.id)); } 
    catch (err) { res.status(500).json({ error: 'Failed to fetch history' }); }
};

export const saveDraft = async (req, res) => {
    try {
        const { entityType, title, payload, draftId } = req.body;
        const draft = await knowledgeService.saveDraft(req.user.id, entityType, title, payload, draftId);
        res.json(draft);
    } catch (err) { res.status(500).json({ error: 'Failed to save draft' }); }
};

export const getMyDrafts = async (req, res) => {
    try { res.json(await knowledgeService.getMyDrafts(req.user.id)); } 
    catch (err) { res.status(500).json({ error: 'Failed to fetch drafts' }); }
};

export const deleteDraft = async (req, res) => {
    try {
        await knowledgeService.deleteDraft(req.user.id, req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Failed to delete draft' }); }
};

export const getRecentActivity = async (req, res) => {
    try { res.json(await knowledgeService.getRecentActivity()); } 
    catch (err) { res.status(500).json({ error: 'Failed to fetch activity feed' }); }
};

export const lookupCrm = async (req, res) => {
    try {
        // 🔥 Grab the serviceId from the frontend request
        const { type, id, serviceId } = req.query; 
        console.log(req.query);
        
        const record = await knowledgeService.lookupCrmRecord(
            req.user.id, 
            req.user.centre_id, 
            req.user.role, 
            type, 
            id, 
            serviceId // 🔥 Pass it to the validator!
        );
        res.json(record);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

export const addReply = async (req, res) => {
    try {
        // 🔥 Now extracts attachments from req.body
        const { content, attachments } = req.body;
        const reply = await knowledgeService.addReply(req.params.discussionId, content, attachments, req.user.id);
        res.status(201).json(reply);
    } catch (err) {
        res.status(500).json({ error: 'Failed to post reply' });
    }
};

export const votePost = async (req, res) => {
    try {
        const { targetType, targetId, voteValue } = req.body;
        const result = await knowledgeService.votePost(req.user.id, targetType, targetId, voteValue);
        res.json(result);
    } catch (err) {
        console.error("💥 VOTE CRASH INFO:", err);
        res.status(500).json({ error: 'Failed to record vote' });
    }
};

export const toggleReaction = async (req, res) => {
    try {
        const { targetType, targetId, emoji } = req.body;
        const result = await knowledgeService.toggleReaction(req.user.id, targetType, targetId, emoji);
        res.json(result);
    } catch (err) {
        console.error("💥 REACTION CRASH INFO:", err);
        res.status(500).json({ error: 'Failed to toggle reaction' });
    }
};