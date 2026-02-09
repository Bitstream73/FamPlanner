import database from '../config/database.js';
import logger from './logger.js';

function createNote(householdId, { title, content, isPinned = false, createdBy }) {
  const result = database.db.prepare(`
    INSERT INTO handbook_entries (household_id, title, entry_type, content, is_pinned, created_by)
    VALUES (?, ?, 'note', ?, ?, ?)
  `).run(householdId, title, content, isPinned ? 1 : 0, createdBy);

  logger.info('handbook', 'note_created', { entryId: result.lastInsertRowid, householdId });
  return getEntry(result.lastInsertRowid);
}

function createHowTo(householdId, { title, content, steps, imageUrls, createdBy }) {
  const result = database.db.prepare(`
    INSERT INTO handbook_entries (household_id, title, entry_type, content, steps, image_urls, created_by)
    VALUES (?, ?, 'howto', ?, ?, ?, ?)
  `).run(
    householdId, title, content,
    steps ? JSON.stringify(steps) : null,
    imageUrls ? JSON.stringify(imageUrls) : null,
    createdBy
  );

  logger.info('handbook', 'howto_created', { entryId: result.lastInsertRowid, householdId });
  return getEntry(result.lastInsertRowid);
}

function getEntry(entryId) {
  const entry = database.db.prepare(`
    SELECT he.*, u.display_name AS author_name
    FROM handbook_entries he
    JOIN users u ON u.id = he.created_by
    WHERE he.id = ?
  `).get(entryId);

  if (!entry) return null;

  return {
    ...entry,
    steps: entry.steps ? JSON.parse(entry.steps) : null,
    image_urls: entry.image_urls ? JSON.parse(entry.image_urls) : null,
  };
}

function updateEntry(entryId, updates) {
  const entry = database.db.prepare('SELECT * FROM handbook_entries WHERE id = ?').get(entryId);
  if (!entry) throw new Error('Entry not found');

  const fields = [];
  const values = [];

  if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
  if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
  if (updates.steps !== undefined) { fields.push('steps = ?'); values.push(JSON.stringify(updates.steps)); }
  if (updates.imageUrls !== undefined) { fields.push('image_urls = ?'); values.push(JSON.stringify(updates.imageUrls)); }
  if (updates.isPinned !== undefined) { fields.push('is_pinned = ?'); values.push(updates.isPinned ? 1 : 0); }

  if (fields.length === 0) return getEntry(entryId);

  fields.push('updated_at = unixepoch()');
  values.push(entryId);

  database.db.prepare(
    `UPDATE handbook_entries SET ${fields.join(', ')} WHERE id = ?`
  ).run(...values);

  logger.info('handbook', 'entry_updated', { entryId });
  return getEntry(entryId);
}

function deleteEntry(entryId) {
  database.db.prepare('DELETE FROM handbook_entries WHERE id = ?').run(entryId);
  logger.info('handbook', 'entry_deleted', { entryId });
}

function listEntries(householdId, { type, limit = 20, offset = 0 } = {}) {
  let whereClause = 'WHERE he.household_id = ?';
  const params = [householdId];

  if (type) {
    whereClause += ' AND he.entry_type = ?';
    params.push(type);
  }

  const total = database.db.prepare(
    `SELECT COUNT(*) AS count FROM handbook_entries he ${whereClause}`
  ).get(...params).count;

  const entries = database.db.prepare(`
    SELECT he.*, u.display_name AS author_name
    FROM handbook_entries he
    JOIN users u ON u.id = he.created_by
    ${whereClause}
    ORDER BY he.is_pinned DESC, he.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return {
    entries: entries.map((e) => ({
      ...e,
      steps: e.steps ? JSON.parse(e.steps) : null,
      image_urls: e.image_urls ? JSON.parse(e.image_urls) : null,
    })),
    total,
  };
}

function getPinnedEntries(householdId) {
  const entries = database.db.prepare(`
    SELECT he.*, u.display_name AS author_name
    FROM handbook_entries he
    JOIN users u ON u.id = he.created_by
    WHERE he.household_id = ? AND he.is_pinned = 1
    ORDER BY he.updated_at DESC
  `).all(householdId);

  return entries.map((e) => ({
    ...e,
    steps: e.steps ? JSON.parse(e.steps) : null,
    image_urls: e.image_urls ? JSON.parse(e.image_urls) : null,
  }));
}

function searchEntries(householdId, query) {
  const entries = database.db.prepare(`
    SELECT he.*, u.display_name AS author_name
    FROM handbook_entries he
    JOIN users u ON u.id = he.created_by
    WHERE he.household_id = ?
      AND (he.title LIKE '%' || ? || '%' OR he.content LIKE '%' || ? || '%')
    ORDER BY he.is_pinned DESC, he.updated_at DESC
  `).all(householdId, query, query);

  return entries.map((e) => ({
    ...e,
    steps: e.steps ? JSON.parse(e.steps) : null,
    image_urls: e.image_urls ? JSON.parse(e.image_urls) : null,
  }));
}

export default {
  createNote,
  createHowTo,
  getEntry,
  updateEntry,
  deleteEntry,
  listEntries,
  getPinnedEntries,
  searchEntries,
};
