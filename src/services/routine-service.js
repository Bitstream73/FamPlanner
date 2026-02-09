import database from '../config/database.js';
import logger from './logger.js';

function createRoutine(householdId, { name, routineType, assignedTo, autoReset = false, createdBy }) {
  const result = database.db.prepare(`
    INSERT INTO routines (household_id, name, routine_type, assigned_to, auto_reset, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(householdId, name, routineType, assignedTo || null, autoReset ? 1 : 0, createdBy);

  logger.info('routine', 'created', { routineId: result.lastInsertRowid, householdId });
  return getRoutine(result.lastInsertRowid);
}

function getRoutine(routineId) {
  const routine = database.db.prepare('SELECT * FROM routines WHERE id = ?').get(routineId);
  if (!routine) return null;

  // Auto-reset check
  if (routine.auto_reset) {
    autoResetIfNeeded(routineId);
  }

  const steps = database.db.prepare(
    'SELECT * FROM routine_steps WHERE routine_id = ? ORDER BY sort_order ASC'
  ).all(routineId);

  return { ...routine, steps };
}

function updateRoutine(routineId, updates) {
  const routine = database.db.prepare('SELECT * FROM routines WHERE id = ?').get(routineId);
  if (!routine) throw new Error('Routine not found');

  const fields = [];
  const values = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.routineType !== undefined) { fields.push('routine_type = ?'); values.push(updates.routineType); }
  if (updates.assignedTo !== undefined) { fields.push('assigned_to = ?'); values.push(updates.assignedTo); }
  if (updates.autoReset !== undefined) { fields.push('auto_reset = ?'); values.push(updates.autoReset ? 1 : 0); }

  if (fields.length === 0) return getRoutine(routineId);

  fields.push('updated_at = unixepoch()');
  values.push(routineId);

  database.db.prepare(
    `UPDATE routines SET ${fields.join(', ')} WHERE id = ?`
  ).run(...values);

  logger.info('routine', 'updated', { routineId });
  return getRoutine(routineId);
}

function deleteRoutine(routineId) {
  database.db.prepare('DELETE FROM routines WHERE id = ?').run(routineId);
  logger.info('routine', 'deleted', { routineId });
}

function listRoutines(householdId, userId) {
  let query = 'SELECT * FROM routines WHERE household_id = ?';
  const params = [householdId];

  if (userId) {
    query += ' AND (assigned_to = ? OR assigned_to IS NULL)';
    params.push(userId);
  }

  query += ' ORDER BY name ASC';

  return database.db.prepare(query).all(...params).map((r) => {
    const steps = database.db.prepare(
      'SELECT * FROM routine_steps WHERE routine_id = ? ORDER BY sort_order ASC'
    ).all(r.id);
    return { ...r, steps };
  });
}

function startRoutine(routineId) {
  const routine = database.db.prepare('SELECT * FROM routines WHERE id = ?').get(routineId);
  if (!routine) throw new Error('Routine not found');

  // Reset all steps
  database.db.prepare(
    'UPDATE routine_steps SET is_complete = 0, completed_at = NULL WHERE routine_id = ?'
  ).run(routineId);

  logger.info('routine', 'started', { routineId });
  return getRoutine(routineId);
}

function completeStep(stepId) {
  const step = database.db.prepare('SELECT * FROM routine_steps WHERE id = ?').get(stepId);
  if (!step) throw new Error('Step not found');

  database.db.prepare(
    'UPDATE routine_steps SET is_complete = 1, completed_at = unixepoch() WHERE id = ?'
  ).run(stepId);

  logger.info('routine', 'step_completed', { stepId, routineId: step.routine_id });
  return database.db.prepare('SELECT * FROM routine_steps WHERE id = ?').get(stepId);
}

function uncompleteStep(stepId) {
  const step = database.db.prepare('SELECT * FROM routine_steps WHERE id = ?').get(stepId);
  if (!step) throw new Error('Step not found');

  database.db.prepare(
    'UPDATE routine_steps SET is_complete = 0, completed_at = NULL WHERE id = ?'
  ).run(stepId);

  logger.info('routine', 'step_uncompleted', { stepId });
  return database.db.prepare('SELECT * FROM routine_steps WHERE id = ?').get(stepId);
}

function getRoutineProgress(routineId) {
  const steps = database.db.prepare(
    'SELECT is_complete FROM routine_steps WHERE routine_id = ?'
  ).all(routineId);

  const total = steps.length;
  const completed = steps.filter((s) => s.is_complete).length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { total, completed, percentage };
}

function autoResetIfNeeded(routineId) {
  // Check if any completed step has a completed_at from before today
  const today = new Date();
  const startOfToday = Math.floor(
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).getTime() / 1000
  );

  const staleStep = database.db.prepare(`
    SELECT id FROM routine_steps
    WHERE routine_id = ? AND is_complete = 1 AND completed_at < ?
    LIMIT 1
  `).get(routineId, startOfToday);

  if (staleStep) {
    database.db.prepare(
      'UPDATE routine_steps SET is_complete = 0, completed_at = NULL WHERE routine_id = ?'
    ).run(routineId);
    logger.info('routine', 'auto_reset', { routineId });
  }
}

function resetDailyRoutines() {
  const routines = database.db.prepare(
    'SELECT id FROM routines WHERE auto_reset = 1'
  ).all();

  let count = 0;
  for (const routine of routines) {
    autoResetIfNeeded(routine.id);
    count++;
  }

  logger.info('routine', 'daily_reset_complete', { count });
  return count;
}

// Routine step management
function addStep(routineId, title, sortOrder) {
  if (sortOrder === undefined) {
    const max = database.db.prepare(
      'SELECT MAX(sort_order) AS max_order FROM routine_steps WHERE routine_id = ?'
    ).get(routineId);
    sortOrder = (max.max_order ?? -1) + 1;
  }

  const result = database.db.prepare(
    'INSERT INTO routine_steps (routine_id, title, sort_order) VALUES (?, ?, ?)'
  ).run(routineId, title, sortOrder);

  return database.db.prepare('SELECT * FROM routine_steps WHERE id = ?').get(result.lastInsertRowid);
}

function removeStep(stepId) {
  database.db.prepare('DELETE FROM routine_steps WHERE id = ?').run(stepId);
}

function reorderSteps(routineId, orderedIds) {
  const stmt = database.db.prepare(
    'UPDATE routine_steps SET sort_order = ? WHERE id = ? AND routine_id = ?'
  );

  const updateAll = database.db.transaction((ids) => {
    ids.forEach((id, index) => {
      stmt.run(index, id, routineId);
    });
  });

  updateAll(orderedIds);
  return database.db.prepare(
    'SELECT * FROM routine_steps WHERE routine_id = ? ORDER BY sort_order ASC'
  ).all(routineId);
}

export default {
  createRoutine,
  getRoutine,
  updateRoutine,
  deleteRoutine,
  listRoutines,
  startRoutine,
  completeStep,
  uncompleteStep,
  getRoutineProgress,
  resetDailyRoutines,
  addStep,
  removeStep,
  reorderSteps,
};
