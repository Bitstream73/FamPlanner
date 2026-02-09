import database from '../config/database.js';

function detectConflicts(householdId, startTime, endTime, excludeEventId) {
  // Find overlapping events
  let eventQuery = `
    SELECT ce.*, u.display_name AS responsible_name
    FROM calendar_events ce
    LEFT JOIN users u ON u.id = ce.responsible_user_id
    WHERE ce.household_id = ? AND ce.start_time < ? AND ce.end_time > ?
  `;
  const eventParams = [householdId, endTime, startTime];

  if (excludeEventId) {
    eventQuery += ' AND ce.id != ?';
    eventParams.push(excludeEventId);
  }

  const overlappingEvents = database.db.prepare(eventQuery).all(...eventParams);

  // Find unavailable members during this time
  const unavailableBlocks = database.db.prepare(`
    SELECT ab.*, u.display_name, u.email
    FROM availability_blocks ab
    JOIN users u ON u.id = ab.user_id
    WHERE ab.household_id = ? AND ab.start_time < ? AND ab.end_time > ?
  `).all(householdId, endTime, startTime);

  const unavailableMembers = unavailableBlocks.map((block) => ({
    user_id: block.user_id,
    display_name: block.display_name,
    block,
  }));

  // Check if any of the overlapping events lack a responsible person
  const noResponsiblePerson = overlappingEvents.some(
    (event) => !event.responsible_user_id
  );

  return {
    overlapping_events: overlappingEvents,
    unavailable_members: unavailableMembers,
    no_responsible_person: noResponsiblePerson,
  };
}

function isUserAvailable(userId, householdId, startTime, endTime) {
  const block = database.db.prepare(`
    SELECT id FROM availability_blocks
    WHERE user_id = ? AND household_id = ? AND start_time < ? AND end_time > ?
    LIMIT 1
  `).get(userId, householdId, endTime, startTime);

  return !block;
}

export default {
  detectConflicts,
  isUserAvailable,
};
