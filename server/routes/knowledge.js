import express from 'express';
import jwt from 'jsonwebtoken';
import * as knowledgeController from './knowledge/controller.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

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

// 1. Ensure the upload directory exists
const uploadDir = path.join(process.cwd(), 'uploads', 'knowledge');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. Configure Multer Storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate a unique filename: knowledge-163234234-8234.png
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'knowledge-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

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
router.put('/discussions/:discussionId/solve', authorizeRoles(ADMIN_ONLY), knowledgeController.solveDiscussion);
router.get('/hub/discussions/:id', authorizeRoles(ALL_STAFF), knowledgeController.getDiscussionById);

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

// ==========================================
// BOOKMARKS
// ==========================================
router.get('/hub/me/bookmarks', authorizeRoles(ALL_STAFF), knowledgeController.getMyBookmarks);
router.post('/hub/me/bookmarks/toggle', authorizeRoles(ALL_STAFF), knowledgeController.toggleBookmark);

// ==========================================
// MENTIONS
// ==========================================
router.get('/hub/me/mentions', authorizeRoles(ALL_STAFF), knowledgeController.getMyMentions);
router.put('/hub/me/mentions/read', authorizeRoles(ALL_STAFF), knowledgeController.markMentionsRead);
router.get('/hub/staff/search', authorizeRoles(ALL_STAFF), knowledgeController.searchStaff);

// ==========================================
// FOLLOWINGS
// ==========================================
router.get('/hub/me/following', authorizeRoles(ALL_STAFF), knowledgeController.getMyFollowing);
router.post('/hub/me/following/toggle', authorizeRoles(ALL_STAFF), knowledgeController.toggleFollow);

// ==========================================
// History - View
// ==========================================
router.get('/hub/me/history', authorizeRoles(ALL_STAFF), knowledgeController.getMyHistory);
router.post('/hub/me/history/log', authorizeRoles(ALL_STAFF), knowledgeController.logView);

// ==========================================
// Drafts
// ==========================================
router.get('/hub/me/drafts', authorizeRoles(ALL_STAFF), knowledgeController.getMyDrafts);
router.post('/hub/me/drafts', authorizeRoles(ALL_STAFF), knowledgeController.saveDraft);
router.delete('/hub/me/drafts/:id', authorizeRoles(ALL_STAFF), knowledgeController.deleteDraft);

// ==========================================
// Recent Activity
// ==========================================
router.get('/hub/activity', authorizeRoles(ALL_STAFF), knowledgeController.getRecentActivity);

// ==========================================
// CRM - LINK
// ==========================================
router.get('/hub/crm-lookup', authorizeRoles(ALL_STAFF), knowledgeController.lookupCrm);

router.post('/hub/vote', authorizeRoles(ALL_STAFF), knowledgeController.votePost);
router.post('/hub/react', authorizeRoles(ALL_STAFF), knowledgeController.toggleReaction);

// ==========================================
// UPLOADS (MULTER)
// ==========================================
// Accepts up to 10 files at once under the field name 'files'
router.post('/upload', authorizeRoles(ALL_STAFF), upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Return the relative URLs so the database can store them safely
    const fileUrls = req.files.map(file => ({
      url: `/uploads/knowledge/${file.filename}`,
      name: file.originalname
    }));

    res.json({ urls: fileUrls });
  } catch (err) {
    console.error("💥 MULTER UPLOAD ERROR:", err);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

export default router;