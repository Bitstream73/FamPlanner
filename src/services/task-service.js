import database from '../config/database.js';
import logger from './logger.js';

function createTask(householdId, { title, description, taskType = 'one_time', assignedTo, dueDate, difficulty = 'medium', timeEstimateMinutes, createdBy, recurrenceRule, rotationId }) {
  const result = database.db.prepare(`
    INSERT INTO tasks (household_id, title, description, task_type, assigned_to, due_date, difficulty, time_estimate_minutes, created_by, recurrence_rule, rotation_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(householdId, title, description || null, taskType, assignedTo || null, dueDate || null, difficulty, timeEstimateMinutes || null, createdBy, recurrenceRule || null, rotationId || null);

  logger.info('task', 'created', { taskId: result.lastInsertRowid, householdId });
  return getTask(result.lastInsertRowid);
}

function getTask(taskId) {
  const task = database.db.prepare(`
    SELECT t.*, u.display_name AS assignee_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.id = ?
  `).get(taskId);

  if (!task) return null;

  const checklists = database.db.prepare(
    'SELECT * FROM task_checklists WHERE task_id = ? ORDER BY sort_order ASC'
  ).all(taskId);

  return { ...task, checklists };
}

function updateTask(taskId, updates) {
  const task = getTask(taskId);
  if (!task) throw new Error('Task not found');

  const fields = [];
  const values = [];

  if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.assignedTo !== undefined) { fields.push('assigned_to = ?'); values.push(updates.assignedTo); }
  if (updates.dueDate !== undefined) { fields.push('due_date = ?'); values.push(updates.dueDate); }
  if (updates.difficulty !== undefined) { fields.push('difficulty = ?'); values.push(updates.difficulty); }
  if (updates.timeEstimateMinutes !== undefined) { fields.push('time_estimate_minutes = ?'); values.push(updates.timeEstimateMinutes); }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }

  if (fields.length === 0) return task;

  fields.push('updated_at = unixepoch()');
  values.push(taskId);

  database.db.prepare(
    `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`
  ).run(...values);

  logger.info('task', 'updated', { taskId });
  return getTask(taskId);
}

function deleteTask(taskId) {
  database.db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  logger.info('task', 'deleted', { taskId });
}

function reassignTask(taskId, newAssigneeId) {
  database.db.prepare(
    'UPDATE tasks SET assigned_to = ?, updated_at = unixepoch() WHERE id = ?'
  ).run(newAssigneeId, taskId);
  logger.info('task', 'reassigned', { taskId, newAssigneeId });
  return getTask(taskId);
}

function completeTask(taskId, userId, { note, photoUrl } = {}) {
  const task = getTask(taskId);
  if (!task) throw new Error('Task not found');

  database.db.prepare(`
    UPDATE tasks SET status = 'completed', completed_at = unixepoch(),
    completion_note = ?, completion_photo_url = ?, updated_at = unixepoch()
    WHERE id = ?
  `).run(note || null, photoUrl || null, taskId);

  logger.info('task', 'completed', { taskId, completedBy: userId });
  return getTask(taskId);
}

function uncompleteTask(taskId) {
  database.db.prepare(`
    UPDATE tasks SET status = 'pending', completed_at = NULL,
    completion_note = NULL, completion_photo_url = NULL, updated_at = unixepoch()
    WHERE id = ?
  `).run(taskId);

  logger.info('task', 'uncompleted', { taskId });
  return getTask(taskId);
}

function getTodayTasks(householdId, userId) {
  const now = Math.floor(Date.now() / 1000);
  // Get start and end of today in UTC
  const today = new Date();
  const startOfDay = Math.floor(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).getTime() / 1000);
  const endOfDay = startOfDay + 86400;

  let query = `
    SELECT t.*, u.display_name AS assignee_name
    FROM tasks t LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.household_id = ? AND t.status != 'completed'
    AND t.due_date >= ? AND t.due_date < ?
  `;
  const params = [householdId, startOfDay, endOfDay];

  if (userId) {
    query += ' AND t.assigned_to = ?';
    params.push(userId);
  }

  query += ' ORDER BY t.difficulty DESC, t.due_date ASC';
  return database.db.prepare(query).all(...params);
}

function getUpcomingTasks(householdId, userId, days = 7) {
  const today = new Date();
  const startOfDay = Math.floor(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).getTime() / 1000);
  const endRange = startOfDay + days * 86400;

  let query = `
    SELECT t.*, u.display_name AS assignee_name
    FROM tasks t LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.household_id = ? AND t.status != 'completed'
    AND t.due_date >= ? AND t.due_date < ?
  `;
  const params = [householdId, startOfDay, endRange];

  if (userId) {
    query += ' AND t.assigned_to = ?';
    params.push(userId);
  }

  query += ' ORDER BY t.due_date ASC, t.difficulty DESC';
  return database.db.prepare(query).all(...params);
}

function getOverdueTasks(householdId, userId) {
  const today = new Date();
  const startOfDay = Math.floor(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).getTime() / 1000);

  let query = `
    SELECT t.*, u.display_name AS assignee_name
    FROM tasks t LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.household_id = ? AND t.status != 'completed'
    AND t.due_date < ?
  `;
  const params = [householdId, startOfDay];

  if (userId) {
    query += ' AND t.assigned_to = ?';
    params.push(userId);
  }

  query += ' ORDER BY t.due_date ASC';
  return database.db.prepare(query).all(...params);
}

function getAssignedTasks(userId, householdId) {
  let query = `
    SELECT t.*, u.display_name AS assignee_name
    FROM tasks t LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.assigned_to = ?
  `;
  const params = [userId];

  if (householdId) {
    query += ' AND t.household_id = ?';
    params.push(householdId);
  }

  query += ' ORDER BY t.due_date ASC';
  return database.db.prepare(query).all(...params);
}

export default {
  createTask,
  getTask,
  updateTask,
  deleteTask,
  reassignTask,
  completeTask,
  uncompleteTask,
  getTodayTasks,
  getUpcomingTasks,
  getOverdueTasks,
  getAssignedTasks,
};
