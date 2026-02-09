import database from '../config/database.js';
import logger from './logger.js';

function createBlock(userId, householdId, { startTime, endTime, reason, recurringDay }) {
  const result = database.db.prepare(`
    INSERT INTO availability_blocks (user_id, household_id, start_time, end_time, reason, recurring_day)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, householdId, startTime, endTime, reason || null, recurringDay ?? null);

  logger.info('availability', 'block_created', { blockId: result.lastInsertRowid, userId });
  return getBlock(result.lastInsertRowid);
}

function getBlock(blockId) {
  return database.db.prepare('SELECT * FROM availability_blocks WHERE id = ?').get(blockId) || null;
}

function updateBlock(blockId, updates) {
  const block = getBlock(blockId);
  if (!block) throw new Error('Availability block not found');

  const fields = [];
  const values = [];

  if (updates.startTime !== undefined) { fields.push('start_time = ?'); values.push(updates.startTime); }
  if (updates.endTime !== undefined) { fields.push('end_time = ?'); values.push(updates.endTime); }
  if (updates.reason !== undefined) { fields.push('reason = ?'); values.push(updates.reason); }
  if (updates.recurringDay !== undefined) { fields.push('recurring_day = ?'); values.push(updates.recurringDay); }

  if (fields.length === 0) return block;

  values.push(blockId);
  database.db.prepare(
    `UPDATE availability_blocks SET ${fields.join(', ')} WHERE id = ?`
  ).run(...values);

  logger.info('availability', 'block_updated', { blockId });
  return getBlock(blockId);
}

function deleteBlock(blockId) {
  database.db.prepare('DELETE FROM availability_blocks WHERE id = ?').run(blockId);
  logger.info('availability', 'block_deleted', { blockId });
}

function getUserAvailability(userId, householdId, startDate, endDate) {
  return database.db.prepare(`
    SELECT * FROM availability_blocks
    WHERE user_id = ? AND household_id = ? AND start_time < ? AND end_time > ?
    ORDER BY start_time ASC
  `).all(userId, householdId, endDate, startDate);
}

function getHouseholdAvailability(householdId, startDate, endDate) {
  const rows = database.db.prepare(`
    SELECT ab.*, u.display_name, u.email
    FROM availability_blocks ab
    JOIN users u ON u.id = ab.user_id
    WHERE ab.household_id = ? AND ab.start_time < ? AND ab.end_time > ?
    ORDER BY ab.user_id, ab.start_time ASC
  `).all(householdId, endDate, startDate);

  // Group by user
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.user_id]) {
      grouped[row.user_id] = { user_id: row.user_id, display_name: row.display_name, blocks: [] };
    }
    grouped[row.user_id].blocks.push(row);
  }

  return Object.values(grouped);
}

export default {
  createBlock,
  getBlock,
  updateBlock,
  deleteBlock,
  getUserAvailability,
  getHouseholdAvailability,
};
