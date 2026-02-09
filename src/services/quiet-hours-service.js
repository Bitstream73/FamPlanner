import database from '../config/database.js';
import logger from './logger.js';

function setQuietHours(userId, householdId, startTime, endTime) {
  const existing = database.db.prepare(
    'SELECT user_id FROM notification_preferences WHERE user_id = ? AND household_id = ?'
  ).get(userId, householdId);

  if (existing) {
    database.db.prepare(
      'UPDATE notification_preferences SET quiet_start = ?, quiet_end = ? WHERE user_id = ? AND household_id = ?'
    ).run(startTime, endTime, userId, householdId);
  } else {
    database.db.prepare(
      'INSERT INTO notification_preferences (user_id, household_id, quiet_start, quiet_end) VALUES (?, ?, ?, ?)'
    ).run(userId, householdId, startTime, endTime);
  }

  logger.info('quiet_hours', 'set', { userId, householdId, startTime, endTime });
  return getQuietHours(userId, householdId);
}

function getQuietHours(userId, householdId) {
  const prefs = database.db.prepare(
    'SELECT quiet_start, quiet_end FROM notification_preferences WHERE user_id = ? AND household_id = ?'
  ).get(userId, householdId);

  if (!prefs || !prefs.quiet_start) return null;
  return { start: prefs.quiet_start, end: prefs.quiet_end };
}

function isInQuietHours(userId, householdId) {
  const hours = getQuietHours(userId, householdId);
  if (!hours) return false;

  const now = new Date();
  const currentTime = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;

  // Handle midnight-spanning quiet hours (e.g., 22:00 → 07:00)
  if (hours.start > hours.end) {
    return currentTime >= hours.start || currentTime < hours.end;
  }

  return currentTime >= hours.start && currentTime < hours.end;
}

function clearQuietHours(userId, householdId) {
  database.db.prepare(
    'UPDATE notification_preferences SET quiet_start = NULL, quiet_end = NULL WHERE user_id = ? AND household_id = ?'
  ).run(userId, householdId);

  logger.info('quiet_hours', 'cleared', { userId, householdId });
}

export default {
  setQuietHours,
  getQuietHours,
  isInQuietHours,
  clearQuietHours,
};
