import pool from '../db.js';
import socketNotifications from '../utils/socketNotifications.js';
import { NOTIFICATION_TYPES } from '../utils/notificationTemplates.js';

const syncUnreadCount = async (client, staffId) => {
  const countRes = await client.query(
    `SELECT COUNT(*) FROM notifications WHERE recipient_staff_id = $1 AND is_read = false`,
    [staffId]
  );
  const unreadCount = parseInt(countRes.rows[0].count, 10);
  socketNotifications.emitUnreadCount(staffId, unreadCount);
  return unreadCount;
};

const notificationService = {

  async getUnreadCount(staffId) {
    const result = await pool.query(
      `SELECT COUNT(*) FROM notifications WHERE recipient_staff_id = $1 AND is_read = false`,
      [staffId]
    );
    return parseInt(result.rows[0].count, 10);
  },  

  async getPaginatedNotifications(staffId, queryParams) {
    const { page = 1, limit = 50, unread, type, category } = queryParams;
    const offset = (page - 1) * limit;

    // 🔥 ADDED LEFT JOINS TO GRAB NAMES
    let baseQuery = `
      FROM notifications n
      LEFT JOIN staff s ON n.sender_staff_id = s.id
      LEFT JOIN centres c ON n.centre_id = c.id
      WHERE n.recipient_staff_id = $1
    `;
    const params = [staffId];
    let paramIdx = 2;

    if (unread === 'true') baseQuery += ` AND n.is_read = false`;
    if (type) { baseQuery += ` AND n.type = $${paramIdx++}`; params.push(type); }
    if (category) { baseQuery += ` AND n.category = $${paramIdx++}`; params.push(category); }

    const countRes = await pool.query(`SELECT COUNT(*) ${baseQuery}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    // 🔥 SELECT THE NEW FIELDS
    const dataQuery = `
      SELECT n.*, 
             s.name AS sender_name, 
             s.role AS sender_role, 
             c.name AS centre_name 
      ${baseQuery} 
      ORDER BY 
        n.is_pinned DESC, 
        n.created_at DESC 
      LIMIT $${paramIdx++} OFFSET $${paramIdx}
    `;
    params.push(limit, offset);
    const dataRes = await pool.query(dataQuery, params);

    return {
      notifications: dataRes.rows,
      pagination: {
        page: parseInt(page, 10), limit: parseInt(limit, 10),
        total, pages: Math.ceil(total / limit)
      }
    };
  },

  async createNotification({
    recipientStaffId,
    senderStaffId = null,
    centreId = null,
    relatedEntityType = null,
    relatedEntityId = null,
    conversationId = null,
    // The following come spread from the template factory
    type,
    category,
    title,
    message,
    priority,
    metadata = {}
  }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let notification;
      let isUpdate = false; // Track if we are updating or creating

      // 1. DEDUPLICATION LOGIC (WhatsApp / Messages)
      if (type === NOTIFICATION_TYPES.WHATSAPP_MESSAGE && conversationId) {
        const existingRes = await client.query(
          `SELECT id, metadata FROM notifications 
           WHERE recipient_staff_id = $1 AND type = $2 AND conversation_id = $3 AND is_read = false LIMIT 1`,
          [recipientStaffId, type, conversationId]
        );

        if (existingRes.rows.length > 0) {
          const existingId = existingRes.rows[0].id;
          const oldMetadata = existingRes.rows[0].metadata || {};
          const msgCount = (oldMetadata.messageCount || 1) + 1;
          
          notification = (await client.query(
            `UPDATE notifications SET title = $1, message = $2, metadata = $3, created_at = NOW() WHERE id = $4 RETURNING *`,
            [`New WhatsApp Messages (${msgCount})`, message, { ...oldMetadata, ...metadata, messageCount: msgCount }, existingId]
          )).rows[0];
          
          isUpdate = true;
        }
      }

      // 2. INSERT LOGIC (If no deduplication occurred)
      if (!notification) {
        notification = (await client.query(
          `INSERT INTO notifications (
            recipient_staff_id, sender_staff_id, centre_id, type, category, title, 
            message, priority, related_entity_type, related_entity_id, 
            conversation_id, metadata, is_read, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false, NOW()) RETURNING *`,
          [recipientStaffId, senderStaffId, centreId, type, category, title, message, priority, relatedEntityType, relatedEntityId, conversationId, metadata]
        )).rows[0];
      }

      // 🔥 3. ENRICH THE NOTIFICATION (Join names before emitting)
      const enrichedRes = await client.query(`
        SELECT n.*, 
               s.name AS sender_name, 
               s.role AS sender_role, 
               c.name AS centre_name 
        FROM notifications n
        LEFT JOIN staff s ON n.sender_staff_id = s.id
        LEFT JOIN centres c ON n.centre_id = c.id
        WHERE n.id = $1
      `, [notification.id]);
      
      const enrichedNotification = enrichedRes.rows[0];

      // 4. SYNC BADGE COUNTS & COMMIT
      await syncUnreadCount(client, recipientStaffId);
      await client.query('COMMIT');

      // 5. EMIT SOCKETS WITH FULL ENRICHED DATA
      if (isUpdate) {
        socketNotifications.emitNotificationUpdated(recipientStaffId, enrichedNotification);
      } else {
        socketNotifications.emitNotification(recipientStaffId, enrichedNotification);
      }

      return enrichedNotification;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async createBulkNotifications({
    recipientStaffIds,
    senderStaffId = null,
    centreId = null,
    relatedEntityType = null,
    relatedEntityId = null,
    conversationId = null,
    // The following come spread from the template factory
    type,
    category,
    title,
    message,
    priority,
    metadata = {}
  }) {
    if (!recipientStaffIds || recipientStaffIds.length === 0) return [];
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const insertQuery = `
        INSERT INTO notifications (
          recipient_staff_id, 
          sender_staff_id, 
          centre_id,
          type, 
          category, 
          title, 
          message, 
          priority, 
          related_entity_type,
          related_entity_id,
          conversation_id,
          metadata, 
          is_read, 
          created_at
        )
        SELECT 
          unnest($1::int[]), 
          $2, 
          $3,
          $4, 
          $5, 
          $6, 
          $7, 
          $8, 
          $9,
          $10,
          $11,
          $12::jsonb, 
          false, 
          NOW()
        RETURNING *
      `;
      
      const values = [
        recipientStaffIds, 
        senderStaffId, 
        centreId,
        type, 
        category, 
        title, 
        message, 
        priority, 
        relatedEntityType,
        relatedEntityId,
        conversationId,
        metadata
      ];
      
      const { rows } = await client.query(insertQuery, values);
      
      // Emit sockets individually for real-time updates
      for (const row of rows) {
        // Run the join query to enrich it before sending
        const enrichedRes = await client.query(`
          SELECT n.*, 
                 s.name AS sender_name, 
                 s.role AS sender_role, 
                 c.name AS centre_name 
          FROM notifications n
          LEFT JOIN staff s ON n.sender_staff_id = s.id
          LEFT JOIN centres c ON n.centre_id = c.id
          WHERE n.id = $1
        `, [row.id]);
        
        const enrichedNotification = enrichedRes.rows[0];
        socketNotifications.emitNotification(row.recipient_staff_id, enrichedNotification);
        
        // Sync unread counts
        await syncUnreadCount(client, row.recipient_staff_id);
      }
      
      await client.query('COMMIT');
      return rows;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Error creating bulk notifications:", error);
      throw error;
    } finally {
      client.release();
    }
  },

  async markAsRead(notificationId, staffId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND recipient_staff_id = $2 RETURNING *`,
        [notificationId, staffId]
      );
      
      if (!res.rows.length) {
        await client.query('ROLLBACK');
        return null; // Signals a 404 to the controller
      }

      await syncUnreadCount(client, staffId);
      await client.query('COMMIT');
      return res.rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  /**
   * Mark all unread notifications as read for a specific user
   */
  async markAllAsRead(staffId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const updateQuery = `
        UPDATE notifications 
        SET is_read = true 
        WHERE recipient_staff_id = $1 AND is_read = false
      `;
      
      const result = await client.query(updateQuery, [staffId]);
      
      // Instantly sync the new badge count (which will be 0) via Socket.IO
      await syncUnreadCount(client, staffId);
      
      await client.query('COMMIT');
      return result.rowCount; // Returns how many notifications were updated
    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Error marking all notifications as read:", error);
      throw error;
    } finally {
      client.release();
    }
  },

  async togglePin(notificationId, staffId) {
    const client = await pool.connect();
    try {
      // Toggle the boolean. We use coalesce just in case it's currently null.
      const res = await client.query(
        `UPDATE notifications 
         SET is_pinned = NOT coalesce(is_pinned, false) 
         WHERE id = $1 AND recipient_staff_id = $2 
         RETURNING *`,
        [notificationId, staffId]
      );
      
      if (!res.rows.length) return null;

      const updatedNotification = res.rows[0];

      // Emit the update so if the user has multiple tabs open, they all sync!
      socketNotifications.emitNotificationUpdated(staffId, updatedNotification);
      
      return updatedNotification;
    } finally {
      client.release();
    }
  },
  
  // (markAllAsRead and deleteNotification remain the same, safely wrapped in transactions)
};

export default notificationService;