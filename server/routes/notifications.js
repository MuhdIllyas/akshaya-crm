import express from 'express';
import notificationService from '../utils/notificationService.js';

const router = express.Router();

/* ================================
   AUTH MIDDLEWARE
================================ */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

router.use(authenticateToken);

/**
 * GET /api/notifications
 * Fetch paginated notifications with optional filters (type, category, unread)
 */
router.get('/', async (req, res) => {
  try {
    const { limit, ...rest } = req.query;
    
    // Clamp limit to prevent absurdly large requests overloading the DB
    let parsedLimit = parseInt(limit, 10) || 50;
    if (parsedLimit > 100) parsedLimit = 100;

    const responseData = await notificationService.getPaginatedNotifications(req.user.id, {
      ...rest,
      limit: parsedLimit
    });
    
    // Returns { notifications: [...], pagination: { total, pages, page, limit } }
    res.json(responseData);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/notifications/count
 * Get the total unread notification count for the badge
 */
router.get('/count', async (req, res) => {
  try {
    const unreadCount = await notificationService.getUnreadCount(req.user.id);
    res.json({ unread: unreadCount });
  } catch (err) {
    console.error('Error fetching unread count:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
router.patch('/:id/read', async (req, res) => {
  try {
    const notification = await notificationService.markAsRead(req.params.id, req.user.id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ success: true, notification });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/notifications/read-all
 * Mark all unread notifications as read for the current user
 */
router.patch('/read-all', async (req, res) => {
  try {
    await notificationService.markAllAsRead(req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a specific notification
 */
router.delete('/:id', async (req, res) => {
  try {
    await notificationService.deleteNotification(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting notification:', err);
    res.status(500).json({ error: err.message });
  }
});

// TEMP TEST ROUTE
router.post('/test-trigger', async (req, res) => {
  console.log("--> [1] Test Route Hit");
  
  try {
    // If you aren't passing a Bearer token in Postman, req.user will be undefined.
    // This safely defaults to staff ID 1. Change '1' to your actual ID if needed!
    const recipientId = req.user ? req.user.id : 58; 
    console.log("--> [2] Recipient ID resolved to:", recipientId);
    
    console.log("--> [3] Calling Database to create notification...");
    const notification = await notificationService.createNotification({
      recipientStaffId: recipientId, 
      ...notificationTemplates.systemAnnouncement({
        title: "Test Successful! 🚀",
        message: "The Akshaya CRM Notification Engine is live.",
        metadata: { version: "1.0.0" }
      })
    });
    
    console.log("--> [4] Notification inserted! Sending response to Postman.");
    res.json({ success: true, notification });
    
  } catch (err) {
    console.error("--> [X] Error caught:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;