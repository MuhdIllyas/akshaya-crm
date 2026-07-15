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

    let baseQuery = `FROM notifications WHERE recipient_staff_id = $1`;
    const params = [staffId];
    let paramIdx = 2;

    if (unread === 'true') {
      baseQuery += ` AND is_read = false`;
    }
    if (type) {
      baseQuery += ` AND type = $${paramIdx++}`;
      params.push(type);
    }
    if (category) {
      baseQuery += ` AND category = $${paramIdx++}`;
      params.push(category);
    }

    // 1. Get Total Count for Pagination
    const countRes = await pool.query(`SELECT COUNT(*) ${baseQuery}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    // 2. Get Data (Ordered correctly by semantic priority, then pinned, then newest)
    const dataQuery = `
      SELECT * ${baseQuery} 
      ORDER BY 
        array_position(ARRAY['high', 'medium', 'normal', 'low']::varchar[], priority) ASC,
        is_pinned DESC, 
        created_at DESC 
      LIMIT $${paramIdx++} OFFSET $${paramIdx}
    `;
    params.push(limit, offset);
    const dataRes = await pool.query(dataQuery, params);

    return {
      notifications: dataRes.rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
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

          socketNotifications.emitNotificationUpdated(recipientStaffId, notification);
        }
      }

      if (!notification) {
        notification = (await client.query(
          `INSERT INTO notifications (
            recipient_staff_id, sender_staff_id, centre_id, type, category, title, 
            message, priority, related_entity_type, related_entity_id, 
            conversation_id, metadata, is_read, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false, NOW()) RETURNING *`,
          [recipientStaffId, senderStaffId, centreId, type, category, title, message, priority, relatedEntityType, relatedEntityId, conversationId, metadata]
        )).rows[0];

        socketNotifications.emitNotification(recipientStaffId, notification);
      }

      await syncUnreadCount(client, recipientStaffId);
      await client.query('COMMIT');
      return notification;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async createBulkNotifications({
    recipientStaffIds, // Array of IDs
    senderStaffId = null,
    // Spread from template factory
    type, category, title, message, priority, metadata = {}
  }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(`
        INSERT INTO notifications (
          recipient_staff_id, sender_staff_id, type, category, title, message, priority, metadata, is_read, created_at
        )
        SELECT unnest($1::int[]), $2, $3, $4, $5, $6, $7, $8::jsonb, false, NOW()
      `, [recipientStaffIds, senderStaffId, type, category, title, message, priority, metadata]);
      
      // Fast Bulk Unread Sync
      const countRes = await client.query(`
        SELECT recipient_staff_id, COUNT(*) as count 
        FROM notifications 
        WHERE recipient_staff_id = ANY($1::int[]) AND is_read = false
        GROUP BY recipient_staff_id
      `, [recipientStaffIds]);

      countRes.rows.forEach(row => {
        socketNotifications.emitUnreadCount(row.recipient_staff_id, parseInt(row.count, 10));
      });

      await client.query('COMMIT');
      return result.rowCount;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
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