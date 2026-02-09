import database from '../config/database.js';
import logger from './logger.js';

function create(userId, householdId, { type, title, body, entityType, entityId }) {
  const result = database.db.prepare(`
    INSERT INTO notifications (user_id, household_id, type, title, body, entity_type, entity_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, householdId, type, title, body || null, entityType || null, entityId || null);

  logger.info('notification', 'created', { notificationId: result.lastInsertRowid, userId, type });
  return getNotification(result.lastInsertRowid);
}

function getNotification(notificationId) {
  return database.db.prepare('SELECT * FROM notifications WHERE id = ?').get(notificationId) || null;
}

function list(userId, { unreadOnly = false, limit = 20, offset = 0 } = {}) {
  let whereClause = 'WHERE user_id = ?';
  const params = [userId];

  if (unreadOnly) {
    whereClause += ' AND is_read = 0';
  }

  const total = database.db.prepare(
    `SELECT COUNT(*) AS count FROM notifications ${whereClause}`
  ).get(...params).count;

  const unreadCount = database.db.prepare(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0'
  ).get(userId).count;

  const notifications = database.db.prepare(`
    SELECT * FROM notifications ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return { notifications, total, unreadCount };
}

function markRead(notificationId, userId) {
  database.db.prepare(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
  ).run(notificationId, userId);

  return getNotification(notificationId);
}

function markAllRead(userId, householdId) {
  let query = 'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0';
  const params = [userId];

  if (householdId) {
    query += ' AND household_id = ?';
    params.push(householdId);
  }

  const result = database.db.prepare(query).run(...params);
  logger.info('notification', 'marked_all_read', { userId, count: result.changes });
  return result.changes;
}

function remove(notificationId, userId) {
  database.db.prepare(
    'DELETE FROM notifications WHERE id = ? AND user_id = ?'
  ).run(notificationId, userId);

  logger.info('notification', 'deleted', { notificationId, userId });
}

function createForHousehold(householdId, { type, title, body, entityType, entityId, excludeUserId }) {
  const members = database.db.prepare(
    'SELECT user_id FROM household_members WHERE household_id = ?'
  ).all(householdId);

  const notifications = [];
  for (const member of members) {
    if (excludeUserId && member.user_id === excludeUserId) continue;

    const notification = create(member.user_id, householdId, {
      type, title, body, entityType, entityId,
    });
    notifications.push(notification);
  }

  return notifications;
}

export default {
  create,
  getNotification,
  list,
  markRead,
  markAllRead,
  remove,
  createForHousehold,
};
