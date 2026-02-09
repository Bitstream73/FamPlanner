import database from '../config/database.js';
import logger from './logger.js';

function addStep(taskId, title, sortOrder) {
  if (sortOrder === undefined) {
    const max = database.db.prepare(
      'SELECT MAX(sort_order) AS max_order FROM task_checklists WHERE task_id = ?'
    ).get(taskId);
    sortOrder = (max.max_order ?? -1) + 1;
  }

  const result = database.db.prepare(
    'INSERT INTO task_checklists (task_id, title, sort_order) VALUES (?, ?, ?)'
  ).run(taskId, title, sortOrder);

  logger.info('checklist', 'step_added', { taskId, stepId: result.lastInsertRowid });
  return getStep(result.lastInsertRowid);
}

function getStep(stepId) {
  return database.db.prepare('SELECT * FROM task_checklists WHERE id = ?').get(stepId) || null;
}

function removeStep(stepId) {
  database.db.prepare('DELETE FROM task_checklists WHERE id = ?').run(stepId);
  logger.info('checklist', 'step_removed', { stepId });
}

function toggleStep(stepId) {
  const step = getStep(stepId);
  if (!step) throw new Error('Checklist step not found');

  const newValue = step.is_complete ? 0 : 1;
  database.db.prepare(
    'UPDATE task_checklists SET is_complete = ? WHERE id = ?'
  ).run(newValue, stepId);

  logger.info('checklist', 'step_toggled', { stepId, isComplete: newValue });
  return getStep(stepId);
}

function reorderSteps(taskId, orderedIds) {
  const stmt = database.db.prepare(
    'UPDATE task_checklists SET sort_order = ? WHERE id = ? AND task_id = ?'
  );

  const updateAll = database.db.transaction((ids) => {
    ids.forEach((id, index) => {
      stmt.run(index, id, taskId);
    });
  });

  updateAll(orderedIds);
  logger.info('checklist', 'steps_reordered', { taskId });
  return getSteps(taskId);
}

function getSteps(taskId) {
  return database.db.prepare(
    'SELECT * FROM task_checklists WHERE task_id = ? ORDER BY sort_order ASC'
  ).all(taskId);
}

export default {
  addStep,
  getStep,
  removeStep,
  toggleStep,
  reorderSteps,
  getSteps,
};
