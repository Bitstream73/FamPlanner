import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initTestDatabase, closeDatabase } from '../../src/config/database.js';
import database from '../../src/config/database.js';

describe('Conflict Service', () => {
  let conflictService;
  let calendarService;
  let availabilityService;
  let userId;
  let householdId;

  const ts = (year, month, day, hour = 0) =>
    Math.floor(new Date(Date.UTC(year, month - 1, day, hour)).getTime() / 1000);

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    initTestDatabase();
    conflictService = (await import('../../src/services/conflict-service.js')).default;
    calendarService = (await import('../../src/services/calendar-service.js')).default;
    availabilityService = (await import('../../src/services/availability-service.js')).default;

    database.db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run('conflict@test.com', 'hash', 'ConflictUser');
    userId = database.db.prepare("SELECT id FROM users WHERE email = ?").get('conflict@test.com').id;

    database.db.prepare('INSERT INTO households (name, owner_id) VALUES (?, ?)').run('Conflict House', userId);
    householdId = database.db.prepare("SELECT id FROM households WHERE name = ?").get('Conflict House').id;
    database.db.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)').run(householdId, userId, 'parent');
  });

  afterAll(() => closeDatabase());

  describe('detectConflicts', () => {
    it('should find overlapping events', () => {
      calendarService.createEvent(householdId, {
        title: 'Existing Event',
        startTime: ts(2025, 8, 1, 10),
        endTime: ts(2025, 8, 1, 12),
        createdBy: userId,
      });

      const conflicts = conflictService.detectConflicts(
        householdId, ts(2025, 8, 1, 11), ts(2025, 8, 1, 13)
      );

      expect(conflicts.overlapping_events).toHaveLength(1);
      expect(conflicts.overlapping_events[0].title).toBe('Existing Event');
    });

    it('should not find non-overlapping events', () => {
      const conflicts = conflictService.detectConflicts(
        householdId, ts(2025, 8, 1, 14), ts(2025, 8, 1, 15)
      );

      expect(conflicts.overlapping_events).toHaveLength(0);
    });

    it('should exclude a specific event by ID', () => {
      const event = calendarService.createEvent(householdId, {
        title: 'Self',
        startTime: ts(2025, 8, 2, 10),
        endTime: ts(2025, 8, 2, 12),
        createdBy: userId,
      });

      const conflicts = conflictService.detectConflicts(
        householdId, ts(2025, 8, 2, 10), ts(2025, 8, 2, 12), event.id
      );

      expect(conflicts.overlapping_events.find((e) => e.id === event.id)).toBeUndefined();
    });

    it('should find unavailable members', () => {
      availabilityService.createBlock(userId, householdId, {
        startTime: ts(2025, 9, 1, 9),
        endTime: ts(2025, 9, 1, 17),
        reason: 'Work',
      });

      const conflicts = conflictService.detectConflicts(
        householdId, ts(2025, 9, 1, 10), ts(2025, 9, 1, 11)
      );

      expect(conflicts.unavailable_members.length).toBeGreaterThanOrEqual(1);
      expect(conflicts.unavailable_members[0].user_id).toBe(userId);
    });

    it('should detect events without responsible person', () => {
      calendarService.createEvent(householdId, {
        title: 'No Resp',
        startTime: ts(2025, 10, 1, 10),
        endTime: ts(2025, 10, 1, 11),
        createdBy: userId,
      });

      const conflicts = conflictService.detectConflicts(
        householdId, ts(2025, 10, 1, 10), ts(2025, 10, 1, 11)
      );

      expect(conflicts.no_responsible_person).toBe(true);
    });
  });

  describe('isUserAvailable', () => {
    it('should return true when user has no blocks', () => {
      expect(conflictService.isUserAvailable(
        userId, householdId, ts(2025, 12, 1, 10), ts(2025, 12, 1, 11)
      )).toBe(true);
    });

    it('should return false when user has a block in the time range', () => {
      availabilityService.createBlock(userId, householdId, {
        startTime: ts(2025, 11, 15, 9),
        endTime: ts(2025, 11, 15, 17),
      });

      expect(conflictService.isUserAvailable(
        userId, householdId, ts(2025, 11, 15, 10), ts(2025, 11, 15, 12)
      )).toBe(false);
    });
  });
});
