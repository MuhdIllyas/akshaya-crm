import * as knowledgeService from '../services/knowledgeService.js';

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
        const { type, title, url, fileId } = req.body;

        const resource = await knowledgeService.addResource(workspaceId, type, title, url, fileId, req.user.id);
        res.status(201).json(resource);
    } catch (err) {
        res.status(500).json({ error: 'Failed to add resource' });
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