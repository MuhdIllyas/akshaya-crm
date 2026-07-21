import express from 'express';
import jwt from 'jsonwebtoken';
import * as knowledgeController from './knowledge/controller.js';

// Middleware to verify token and role
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    console.log('notes.js: No token provided');
    return res.status(403).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('notes.js: Token verification error:', err.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Apply middleware to all routes in this file
router.use(authenticateToken);

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