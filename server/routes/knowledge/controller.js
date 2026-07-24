//knowledge - controller.js
import * as knowledgeService from './service.js';

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
        
        const updated = await knowledgeService.updateWorkspaceStatus(id, status, req.user.id);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update status' });
    }
};

export const addContributor = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { staffId, role } = req.body;
        await knowledgeService.addContributor(workspaceId, staffId, role);
        res.json({ message: 'Contributor added' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add contributor' });
    }
};

export const removeContributor = async (req, res) => {
    try {
        const { workspaceId, staffId } = req.params;
        await knowledgeService.removeContributor(workspaceId, staffId);
        res.json({ message: 'Contributor removed' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to remove contributor' });
    }
};

export const createDocument = async (req, res) => {
    try {
        const { workspaceId, title, slug, type, visibility, sortOrder } = req.body;
        const document = await knowledgeService.createDocument(
            workspaceId, title, slug, type, visibility, sortOrder, req.user.id
        );
        res.status(201).json(document);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create document' });
    }
};

export const updateDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, slug, visibility, sortOrder } = req.body;
        const document = await knowledgeService.updateDocument(id, title, slug, visibility, sortOrder, req.user.id);
        res.json(document);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update document' });
    }
};

export const deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;
        await knowledgeService.softDeleteDocument(id, req.user.id);
        res.json({ message: 'Document deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete document' });
    }
};

export const batchUpdateBlocks = async (req, res) => {
    try {
        const { documentId } = req.params;
        const { workspaceId, blocks } = req.body; 

        await knowledgeService.batchUpdateBlocks(workspaceId, documentId, blocks, req.user.id);
        res.json({ message: 'Blocks saved successfully' });
    } catch (err) {
        console.error('Error saving blocks:', err);
        res.status(500).json({ error: 'Failed to save blocks' });
    }
};

export const addResource = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        
        // ADDED: Fallbacks so they default to null if missing!
        const type = req.body.type || 'portal';
        const title = req.body.title;
        const url = req.body.url || null;
        const fileId = req.body.fileId || null; 

        const resource = await knowledgeService.addResource(
            workspaceId, type, title, url, fileId, req.user.id
        );
        res.status(201).json(resource);
    } catch (err) {
        console.error("💥 RESOURCE CRASH INFO:", err);
        res.status(500).json({ error: 'Failed to add resource', details: err.message });
    }
};

export const deleteResource = async (req, res) => {
    try {
        const { id } = req.params;
        await knowledgeService.softDeleteResource(id, req.user.id);
        res.json({ message: 'Resource deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete resource' });
    }
};

export const getDiscussions = async (req, res) => {
    try {
        const discussions = await knowledgeService.getDiscussions(req.params.workspaceId);
        res.json(discussions);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch discussions' });
    }
};

export const createDiscussion = async (req, res) => {
    try {
        const discussion = await knowledgeService.createDiscussion(req.params.workspaceId, req.body, req.user.id);
        res.status(201).json(discussion);
    } catch (err) {
        // This prints the real error to your SERVER terminal, not the browser!
        console.error("💥 DISCUSSION CRASH INFO:", err); 
        res.status(500).json({ error: 'Failed to create discussion', details: err.message });
    }
};

export const addReply = async (req, res) => {
    try {
        const reply = await knowledgeService.addReply(req.params.discussionId, req.body.content, req.user.id);
        res.status(201).json(reply);
    } catch (err) {
        res.status(500).json({ error: 'Failed to post reply' });
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
        // ADDED: req.user.id so the database knows who solved it!
        await knowledgeService.markDiscussionSolved(req.params.discussionId, req.body.replyId, req.user.id);
        res.json({ message: 'Marked as solved' });
    } catch (err) {
        console.error("💥 SOLVE CRASH INFO:", err);
        res.status(500).json({ error: 'Failed to mark as solved', details: err.message });
    }
};

export const getGlobalStats = async (req, res) => {
    try {
        const stats = await knowledgeService.getGlobalStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch global stats' });
    }
};

export const createAnnouncement = async (req, res) => {
    try {
        const { title, content, category, priority, isPinned } = req.body;
        const announcement = await knowledgeService.createAnnouncement(
            title, content, category, priority, isPinned, req.user.id
        );
        res.status(201).json(announcement);
    } catch (err) {
        console.error("💥 CREATE ANNOUNCEMENT CRASH INFO:", err);
        res.status(500).json({ error: 'Failed to create announcement', details: err.message });
    }
};

export const getAnnouncements = async (req, res) => {
    try {
        const announcements = await knowledgeService.getAnnouncements();
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