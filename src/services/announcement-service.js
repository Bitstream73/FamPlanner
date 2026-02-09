import database from '../config/database.js';
import logger from './logger.js';

function create(householdId, authorId, content) {
  const result = database.db.prepare(
    'INSERT INTO announcements (household_id, author_id, content) VALUES (?, ?, ?)'
  ).run(householdId, authorId, content);

  logger.info('announcement', 'created', { announcementId: result.lastInsertRowid, householdId });
  return get(result.lastInsertRowid);
}

function get(announcementId) {
  return database.db.prepare(`
    SELECT a.*, u.display_name AS author_name
    FROM announcements a
    JOIN users u ON u.id = a.author_id
    WHERE a.id = ?
  `).get(announcementId) || null;
}

function update(announcementId, content) {
  database.db.prepare(
    'UPDATE announcements SET content = ?, updated_at = unixepoch() WHERE id = ?'
  ).run(content, announcementId);

  logger.info('announcement', 'updated', { announcementId });
  return get(announcementId);
}

function remove(announcementId) {
  database.db.prepare('DELETE FROM announcements WHERE id = ?').run(announcementId);
  logger.info('announcement', 'deleted', { announcementId });
}

function list(householdId, { limit = 20, offset = 0 } = {}) {
  const total = database.db.prepare(
    'SELECT COUNT(*) AS count FROM announcements WHERE household_id = ?'
  ).get(householdId).count;

  const announcements = database.db.prepare(`
    SELECT a.*, u.display_name AS author_name
    FROM announcements a
    JOIN users u ON u.id = a.author_id
    WHERE a.household_id = ?
    ORDER BY a.is_pinned DESC, a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(householdId, limit, offset);

  return { announcements, total };
}

function pin(announcementId) {
  database.db.prepare(
    'UPDATE announcements SET is_pinned = 1, updated_at = unixepoch() WHERE id = ?'
  ).run(announcementId);
  logger.info('announcement', 'pinned', { announcementId });
  return get(announcementId);
}

function unpin(announcementId) {
  database.db.prepare(
    'UPDATE announcements SET is_pinned = 0, updated_at = unixepoch() WHERE id = ?'
  ).run(announcementId);
  logger.info('announcement', 'unpinned', { announcementId });
  return get(announcementId);
}

function getPinned(householdId) {
  return database.db.prepare(`
    SELECT a.*, u.display_name AS author_name
    FROM announcements a
    JOIN users u ON u.id = a.author_id
    WHERE a.household_id = ? AND a.is_pinned = 1
    ORDER BY a.created_at DESC
  `).all(householdId);
}

export default {
  create,
  get,
  update,
  remove,
  list,
  pin,
  unpin,
  getPinned,
};
