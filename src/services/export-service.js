import database from '../config/database.js';
import logger from './logger.js';

const FORMULA_PREFIXES = ['=', '+', '-', '@'];

function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);

  // Prevent CSV formula injection
  if (FORMULA_PREFIXES.some((p) => str.startsWith(p))) {
    str = "'" + str;
  }

  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCSV(headers, rows) {
  const headerLine = headers.join(',');
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCSV(row[h])).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

function exportTasks(householdId) {
  const tasks = database.db.prepare(`
    SELECT t.id, t.title, t.description, t.task_type, u.display_name AS assigned_to,
           t.due_date, t.difficulty, t.time_estimate_minutes, t.status, t.completed_at, t.created_at
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.household_id = ?
    ORDER BY t.created_at DESC
  `).all(householdId);

  const headers = ['id', 'title', 'description', 'task_type', 'assigned_to', 'due_date', 'difficulty', 'time_estimate_minutes', 'status', 'completed_at', 'created_at'];
  const content = generateCSV(headers, tasks);

  logger.info('export', 'tasks_exported', { householdId, count: tasks.length });
  return {
    filename: `tasks-export-${Date.now()}.csv`,
    content,
    mimeType: 'text/csv',
  };
}

function exportEvents(householdId) {
  const events = database.db.prepare(`
    SELECT ce.id, ce.title, ce.location, ce.description, ce.start_time, ce.end_time,
           u.display_name AS responsible_person, ce.recurrence_rule, ce.created_at
    FROM calendar_events ce
    LEFT JOIN users u ON u.id = ce.responsible_user_id
    WHERE ce.household_id = ?
    ORDER BY ce.start_time DESC
  `).all(householdId);

  const headers = ['id', 'title', 'location', 'description', 'start_time', 'end_time', 'responsible_person', 'recurrence_rule', 'created_at'];
  const content = generateCSV(headers, events);

  logger.info('export', 'events_exported', { householdId, count: events.length });
  return {
    filename: `events-export-${Date.now()}.csv`,
    content,
    mimeType: 'text/csv',
  };
}

function exportAll(householdId) {
  const tasksExport = exportTasks(householdId);
  const eventsExport = exportEvents(householdId);

  const combined = `=== TASKS ===\n${tasksExport.content}\n\n=== EVENTS ===\n${eventsExport.content}`;

  logger.info('export', 'all_exported', { householdId });
  return {
    filename: `full-export-${Date.now()}.csv`,
    content: combined,
    mimeType: 'text/csv',
  };
}

export { escapeCSV, generateCSV };
export default {
  exportTasks,
  exportEvents,
  exportAll,
  escapeCSV,
  generateCSV,
};
