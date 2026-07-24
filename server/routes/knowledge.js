import express from 'express';
import jwt from 'jsonwebtoken';
import * as knowledgeController from './knowledge/controller.js';

const router = express.Router();

// 1. Middleware to verify token only (applied globally)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    console.log('notes.js: No token provided');
    return res.status(403).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Assumes your token payload includes a `role` property (e.g., req.user.role)
    next();
  } catch (err) {
    console.error('notes.js: Token verification error:', err.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Apply authentication to all routes in this file
router.use(authenticateToken);

// 2. Middleware factory to check user roles
const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: Insufficient permissions' });
    }
    next();
  };
};

// Role definitions 
const ALL_STAFF = ['staff', 'admin', 'superadmin'];
const ADMIN_ONLY = ['admin', 'superadmin'];
const SUPERADMIN_ONLY = ['superadmin'];

// ==========================================
// WORKSPACE
// ==========================================
router.get('/workspace/:serviceId', authorizeRoles(ALL_STAFF), knowledgeController.getWorkspace);
router.put('/workspace/:id/status', authorizeRoles(SUPERADMIN_ONLY), knowledgeController.updateWorkspaceStatus);
router.get('/workspaces/:workspaceId/cases', authorizeRoles(ALL_STAFF), knowledgeController.getCases);

// ==========================================
// CONTRIBUTORS
// ==========================================
router.post('/workspace/:workspaceId/contributors', authorizeRoles(ADMIN_ONLY), knowledgeController.addContributor);
router.delete('/workspace/:workspaceId/contributors/:staffId', authorizeRoles(ADMIN_ONLY), knowledgeController.removeContributor);

// ==========================================
// DOCUMENTS 
// ==========================================
router.post('/documents', authorizeRoles(ADMIN_ONLY), knowledgeController.createDocument);
router.put('/documents/:id', authorizeRoles(ADMIN_ONLY), knowledgeController.updateDocument);
router.delete('/documents/:id', authorizeRoles(ADMIN_ONLY), knowledgeController.deleteDocument); 

// ==========================================
// BLOCKS 
// ==========================================
router.post('/documents/:documentId/blocks/batch', authorizeRoles(ADMIN_ONLY), knowledgeController.batchUpdateBlocks);

// ==========================================
// RESOURCES
// ==========================================
router.post('/workspaces/:workspaceId/resources', authorizeRoles(ADMIN_ONLY), knowledgeController.addResource);
router.delete('/resources/:id', authorizeRoles(ADMIN_ONLY), knowledgeController.deleteResource);

// ==========================================
// DISCUSSIONS
// ==========================================
router.get('/hub/discussions/all', authorizeRoles(ALL_STAFF), knowledgeController.getAllDiscussions);
router.get('/workspaces/:workspaceId/discussions', authorizeRoles(ALL_STAFF), knowledgeController.getDiscussions);
router.post('/workspaces/:workspaceId/discussions', authorizeRoles(ALL_STAFF), knowledgeController.createDiscussion);
router.post('/discussions/:discussionId/replies', authorizeRoles(ALL_STAFF), knowledgeController.addReply);
router.put('/discussions/:discussionId/solve', authorizeRoles(ALL_STAFF), knowledgeController.solveDiscussion);

// Add this near your other routes
router.get('/hub/stats', authorizeRoles(ALL_STAFF), knowledgeController.getGlobalStats);
// Fetch the latest global announcements
router.get('/hub/announcements', authorizeRoles(ALL_STAFF), knowledgeController.getAnnouncements);
router.post('/hub/announcements', authorizeRoles(ADMIN_ONLY), knowledgeController.createAnnouncement);

// ==========================================
// TRAININGS
// ==========================================
router.get('/hub/trainings', authorizeRoles(ALL_STAFF), knowledgeController.getTrainings);
router.post('/hub/trainings', authorizeRoles(ALL_STAFF), knowledgeController.createTraining);

export default router;