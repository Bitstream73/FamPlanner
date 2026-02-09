import database from '../config/database.js';
import logger from './logger.js';

function log(householdId, userId, { action, entityType, entityId, details }) {
  const result = database.db.prepare(`
    INSERT INTO audit_log (household_id, user_id, action, entity_type, entity_id, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(householdId, userId, action, entityType, entityId, details ? JSON.stringify(details) : null);

  logger.info('audit', 'logged', { action, entityType, entityId });
  return getEntry(result.lastInsertRowid);
}

function getEntry(entryId) {
  const entry = database.db.prepare('SELECT * FROM audit_log WHERE id = ?').get(entryId);
  if (!entry) return null;
  return { ...entry, details: entry.details ? JSON.parse(entry.details) : null };
}

function query(householdId, { userId, entityType, action, startDate, endDate, limit = 50, offset = 0 } = {}) {
  let whereClause = 'WHERE household_id = ?';
  const params = [householdId];

  if (userId) { whereClause += ' AND user_id = ?'; params.push(userId); }
  if (entityType) { whereClause += ' AND entity_type = ?'; params.push(entityType); }
  if (action) { whereClause += ' AND action = ?'; params.push(action); }
  if (startDate) { whereClause += ' AND created_at >= ?'; params.push(startDate); }
  if (endDate) { whereClause += ' AND created_at <= ?'; params.push(endDate); }

  const total = database.db.prepare(
    `SELECT COUNT(*) AS count FROM audit_log ${whereClause}`
  ).get(...params).count;

  const entries = database.db.prepare(`
    SELECT * FROM audit_log ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return {
    entries: entries.map((e) => ({ ...e, details: e.details ? JSON.parse(e.details) : null })),
    total,
  };
}

function getEntityHistory(entityType, entityId) {
  const entries = database.db.prepare(
    'SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC'
  ).all(entityType, entityId);

  return entries.map((e) => ({ ...e, details: e.details ? JSON.parse(e.details) : null }));
}

export default {
  log,
  getEntry,
  query,
  getEntityHistory,
};
