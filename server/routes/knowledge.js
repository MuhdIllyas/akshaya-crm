import express from 'express';
import { authMiddleware } from '../middleware/staff.js'; 
import * as knowledgeController from '../controllers/knowledgeController.js';

const router = express.Router();

// Role definitions 
const ALL_STAFF = ['staff', 'admin', 'superadmin'];
const ADMIN_ONLY = ['admin', 'superadmin'];
const SUPERADMIN_ONLY = ['superadmin'];

// ==========================================
// WORKSPACE
// ==========================================
router.get('/workspace/:serviceId', authMiddleware(ALL_STAFF), knowledgeController.getWorkspace);
router.put('/workspace/:id/status', authMiddleware(SUPERADMIN_ONLY), knowledgeController.updateWorkspaceStatus);

// ==========================================
// CONTRIBUTORS
// ==========================================
router.post('/workspace/:workspaceId/contributors', authMiddleware(ADMIN_ONLY), knowledgeController.addContributor);
router.delete('/workspace/:workspaceId/contributors/:staffId', authMiddleware(ADMIN_ONLY), knowledgeController.removeContributor);

// ==========================================
// DOCUMENTS 
// ==========================================
router.post('/documents', authMiddleware(ADMIN_ONLY), knowledgeController.createDocument);
router.put('/documents/:id', authMiddleware(ADMIN_ONLY), knowledgeController.updateDocument);
router.delete('/documents/:id', authMiddleware(ADMIN_ONLY), knowledgeController.deleteDocument); 

// ==========================================
// BLOCKS 
// ==========================================
router.post('/documents/:documentId/blocks/batch', authMiddleware(ADMIN_ONLY), knowledgeController.batchUpdateBlocks);

// ==========================================
// RESOURCES
// ==========================================
router.post('/workspace/:workspaceId/resources', authMiddleware(ADMIN_ONLY), knowledgeController.addResource);
router.delete('/resources/:id', authMiddleware(ADMIN_ONLY), knowledgeController.deleteResource);

export default router;