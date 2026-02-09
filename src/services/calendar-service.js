import database from '../config/database.js';
import logger from './logger.js';

const RECURRENCE_WEEKS = 12;

function createEvent(householdId, { title, location, description, startTime, endTime, responsibleUserId, createdBy, recurrenceRule }) {
  const result = database.db.prepare(`
    INSERT INTO calendar_events (household_id, title, location, description, start_time, end_time, responsible_user_id, created_by, recurrence_rule)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(householdId, title, location || null, description || null, startTime, endTime, responsibleUserId || null, createdBy, recurrenceRule || null);

  logger.info('calendar', 'event_created', { eventId: result.lastInsertRowid, householdId });
  return getEvent(result.lastInsertRowid);
}

function getEvent(eventId) {
  return database.db.prepare(`
    SELECT ce.*, u.display_name AS responsible_name
    FROM calendar_events ce
    LEFT JOIN users u ON u.id = ce.responsible_user_id
    WHERE ce.id = ?
  `).get(eventId) || null;
}

function updateEvent(eventId, updates) {
  const event = getEvent(eventId);
  if (!event) throw new Error('Event not found');

  const fields = [];
  const values = [];

  if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
  if (updates.location !== undefined) { fields.push('location = ?'); values.push(updates.location); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.startTime !== undefined) { fields.push('start_time = ?'); values.push(updates.startTime); }
  if (updates.endTime !== undefined) { fields.push('end_time = ?'); values.push(updates.endTime); }
  if (updates.responsibleUserId !== undefined) { fields.push('responsible_user_id = ?'); values.push(updates.responsibleUserId); }

  if (fields.length === 0) return event;

  fields.push('updated_at = unixepoch()');
  values.push(eventId);

  database.db.prepare(
    `UPDATE calendar_events SET ${fields.join(', ')} WHERE id = ?`
  ).run(...values);

  logger.info('calendar', 'event_updated', { eventId });
  return getEvent(eventId);
}

function deleteEvent(eventId) {
  database.db.prepare('DELETE FROM calendar_events WHERE id = ?').run(eventId);
  logger.info('calendar', 'event_deleted', { eventId });
}

function getDayView(householdId, date) {
  // date is a unix timestamp for the start of the day
  const dayEnd = date + 86400; // +24 hours
  return database.db.prepare(`
    SELECT ce.*, u.display_name AS responsible_name
    FROM calendar_events ce
    LEFT JOIN users u ON u.id = ce.responsible_user_id
    WHERE ce.household_id = ? AND ce.start_time < ? AND ce.end_time > ?
    ORDER BY ce.start_time ASC
  `).all(householdId, dayEnd, date);
}

function getWeekView(householdId, startOfWeek) {
  const weekEnd = startOfWeek + 7 * 86400;
  return database.db.prepare(`
    SELECT ce.*, u.display_name AS responsible_name
    FROM calendar_events ce
    LEFT JOIN users u ON u.id = ce.responsible_user_id
    WHERE ce.household_id = ? AND ce.start_time < ? AND ce.end_time > ?
    ORDER BY ce.start_time ASC
  `).all(householdId, weekEnd, startOfWeek);
}

function getMonthView(householdId, year, month) {
  // Calculate start and end of month as unix timestamps
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 1));
  const start = Math.floor(startDate.getTime() / 1000);
  const end = Math.floor(endDate.getTime() / 1000);

  return database.db.prepare(`
    SELECT ce.*, u.display_name AS responsible_name
    FROM calendar_events ce
    LEFT JOIN users u ON u.id = ce.responsible_user_id
    WHERE ce.household_id = ? AND ce.start_time < ? AND ce.end_time > ?
    ORDER BY ce.start_time ASC
  `).all(householdId, end, start);
}

function assignResponsible(eventId, userId) {
  database.db.prepare(
    'UPDATE calendar_events SET responsible_user_id = ?, updated_at = unixepoch() WHERE id = ?'
  ).run(userId, eventId);
  logger.info('calendar', 'responsible_assigned', { eventId, userId });
  return getEvent(eventId);
}

function removeResponsible(eventId) {
  database.db.prepare(
    'UPDATE calendar_events SET responsible_user_id = NULL, updated_at = unixepoch() WHERE id = ?'
  ).run(eventId);
  logger.info('calendar', 'responsible_removed', { eventId });
  return getEvent(eventId);
}

function createRecurringSeries(householdId, eventData, recurrenceRule) {
  if (recurrenceRule !== 'weekly') {
    throw new Error('Only weekly recurrence is supported');
  }

  const events = [];
  const WEEK_SECONDS = 7 * 86400;

  // Create the parent event
  const parent = createEvent(householdId, { ...eventData, recurrenceRule });

  // Mark as parent by setting recurrence_parent_id to its own ID
  events.push(parent);

  // Create instances for the remaining weeks
  const duration = eventData.endTime - eventData.startTime;
  for (let i = 1; i < RECURRENCE_WEEKS; i++) {
    const offset = WEEK_SECONDS * i;
    const instanceResult = database.db.prepare(`
      INSERT INTO calendar_events (household_id, title, location, description, start_time, end_time, responsible_user_id, created_by, recurrence_rule, recurrence_parent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      householdId,
      eventData.title,
      eventData.location || null,
      eventData.description || null,
      eventData.startTime + offset,
      eventData.startTime + offset + duration,
      eventData.responsibleUserId || null,
      eventData.createdBy,
      recurrenceRule,
      parent.id
    );
    events.push(getEvent(instanceResult.lastInsertRowid));
  }

  logger.info('calendar', 'recurring_series_created', { parentId: parent.id, count: events.length });
  return events;
}

function updateSeriesEvent(eventId, updates, scope) {
  const event = getEvent(eventId);
  if (!event) throw new Error('Event not found');

  if (scope === 'this') {
    // Detach from parent and update just this one
    database.db.prepare(
      'UPDATE calendar_events SET recurrence_parent_id = NULL WHERE id = ?'
    ).run(eventId);
    return [updateEvent(eventId, updates)];
  }

  const parentId = event.recurrence_parent_id || event.id;

  if (scope === 'all') {
    // Update parent and all instances
    const allEvents = database.db.prepare(
      'SELECT id FROM calendar_events WHERE id = ? OR recurrence_parent_id = ?'
    ).all(parentId, parentId);

    return allEvents.map((e) => updateEvent(e.id, updates));
  }

  if (scope === 'future') {
    // Update this event and all future instances
    const futureEvents = database.db.prepare(
      'SELECT id FROM calendar_events WHERE (id = ? OR recurrence_parent_id = ?) AND start_time >= ?'
    ).all(parentId, parentId, event.start_time);

    return futureEvents.map((e) => updateEvent(e.id, updates));
  }

  throw new Error('Invalid scope: must be this, future, or all');
}

function deleteSeriesEvent(eventId, scope) {
  const event = getEvent(eventId);
  if (!event) throw new Error('Event not found');

  if (scope === 'this') {
    deleteEvent(eventId);
    return;
  }

  const parentId = event.recurrence_parent_id || event.id;

  if (scope === 'all') {
    database.db.prepare(
      'DELETE FROM calendar_events WHERE id = ? OR recurrence_parent_id = ?'
    ).run(parentId, parentId);
    logger.info('calendar', 'series_deleted', { parentId, scope });
    return;
  }

  if (scope === 'future') {
    database.db.prepare(
      'DELETE FROM calendar_events WHERE (id = ? OR recurrence_parent_id = ?) AND start_time >= ?'
    ).run(parentId, parentId, event.start_time);
    logger.info('calendar', 'series_deleted', { parentId, scope });
    return;
  }

  throw new Error('Invalid scope');
}

export default {
  createEvent,
  getEvent,
  updateEvent,
  deleteEvent,
  getDayView,
  getWeekView,
  getMonthView,
  assignResponsible,
  removeResponsible,
  createRecurringSeries,
  updateSeriesEvent,
  deleteSeriesEvent,
};
