import database from '../config/database.js';
import logger from './logger.js';

function addComment(entityType, entityId, authorId, content) {
  const result = database.db.prepare(
    'INSERT INTO comments (entity_type, entity_id, author_id, content) VALUES (?, ?, ?, ?)'
  ).run(entityType, entityId, authorId, content);

  logger.info('comment', 'created', { commentId: result.lastInsertRowid, entityType, entityId });
  return getComment(result.lastInsertRowid);
}

function getComment(commentId) {
  return database.db.prepare(`
    SELECT c.*, u.display_name AS author_name
    FROM comments c
    JOIN users u ON u.id = c.author_id
    WHERE c.id = ?
  `).get(commentId) || null;
}

function updateComment(commentId, content) {
  database.db.prepare(
    'UPDATE comments SET content = ?, updated_at = unixepoch() WHERE id = ?'
  ).run(content, commentId);

  logger.info('comment', 'updated', { commentId });
  return getComment(commentId);
}

function deleteComment(commentId) {
  database.db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
  logger.info('comment', 'deleted', { commentId });
}

function listComments(entityType, entityId, { limit = 50, offset = 0 } = {}) {
  const total = database.db.prepare(
    'SELECT COUNT(*) AS count FROM comments WHERE entity_type = ? AND entity_id = ?'
  ).get(entityType, entityId).count;

  const comments = database.db.prepare(`
    SELECT c.*, u.display_name AS author_name
    FROM comments c
    JOIN users u ON u.id = c.author_id
    WHERE c.entity_type = ? AND c.entity_id = ?
    ORDER BY c.created_at ASC
    LIMIT ? OFFSET ?
  `).all(entityType, entityId, limit, offset);

  return { comments, total };
}

export default {
  addComment,
  getComment,
  updateComment,
  deleteComment,
  listComments,
};
