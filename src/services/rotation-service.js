import database from '../config/database.js';
import logger from './logger.js';

function createRotation(householdId, name, memberIds) {
  const result = database.db.prepare(
    'INSERT INTO task_rotations (household_id, name, member_order) VALUES (?, ?, ?)'
  ).run(householdId, name, JSON.stringify(memberIds));

  logger.info('rotation', 'created', { rotationId: result.lastInsertRowid, householdId });
  return getRotation(result.lastInsertRowid);
}

function getRotation(rotationId) {
  const rotation = database.db.prepare(
    'SELECT * FROM task_rotations WHERE id = ?'
  ).get(rotationId);

  if (!rotation) return null;

  const memberOrder = JSON.parse(rotation.member_order);
  const currentAssigneeId = memberOrder[rotation.current_index] || null;

  return { ...rotation, memberOrder, currentAssigneeId };
}

function advanceRotation(rotationId) {
  const rotation = getRotation(rotationId);
  if (!rotation) throw new Error('Rotation not found');

  const nextIndex = (rotation.current_index + 1) % rotation.memberOrder.length;

  database.db.prepare(
    'UPDATE task_rotations SET current_index = ? WHERE id = ?'
  ).run(nextIndex, rotationId);

  const nextAssigneeId = rotation.memberOrder[nextIndex];
  logger.info('rotation', 'advanced', { rotationId, nextAssigneeId, nextIndex });
  return { nextAssigneeId, rotation: getRotation(rotationId) };
}

function deleteRotation(rotationId) {
  database.db.prepare('DELETE FROM task_rotations WHERE id = ?').run(rotationId);
  logger.info('rotation', 'deleted', { rotationId });
}

function getNextAssignee(rotationId) {
  const rotation = getRotation(rotationId);
  if (!rotation) throw new Error('Rotation not found');
  return rotation.currentAssigneeId;
}

export default {
  createRotation,
  getRotation,
  advanceRotation,
  deleteRotation,
  getNextAssignee,
};
