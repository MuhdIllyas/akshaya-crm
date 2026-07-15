import express from 'express';
import notificationService from '../utils/notificationService.js';

const router = express.Router();

// Middleware to verify token and role
const authMiddleware = (allowedRoles) => async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query("SELECT role, centre_id FROM staff WHERE id = $1", [decoded.id]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const userRole = result.rows[0].role;
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    req.user = decoded;
    req.user.centre_id = result.rows[0].centre_id;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

router.use(authMiddleware); 

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