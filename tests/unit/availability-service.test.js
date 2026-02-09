import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initTestDatabase, closeDatabase } from '../../src/config/database.js';
import database from '../../src/config/database.js';

describe('Availability Service', () => {
  let availabilityService;
  let userId;
  let userId2;
  let householdId;

  const ts = (year, month, day, hour = 0) =>
    Math.floor(new Date(Date.UTC(year, month - 1, day, hour)).getTime() / 1000);

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    initTestDatabase();
    availabilityService = (await import('../../src/services/availability-service.js')).default;

    database.db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run('avail@test.com', 'hash', 'AvailUser');
    userId = database.db.prepare("SELECT id FROM users WHERE email = ?").get('avail@test.com').id;

    database.db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run('avail2@test.com', 'hash', 'AvailUser2');
    userId2 = database.db.prepare("SELECT id FROM users WHERE email = ?").get('avail2@test.com').id;

    database.db.prepare('INSERT INTO households (name, owner_id) VALUES (?, ?)').run('Avail House', userId);
    householdId = database.db.prepare("SELECT id FROM households WHERE name = ?").get('Avail House').id;
    database.db.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)').run(householdId, userId, 'parent');
    database.db.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)').run(householdId, userId2, 'teen');
  });

  afterAll(() => closeDatabase());

  describe('createBlock', () => {
    it('should create an availability block', () => {
      const block = availabilityService.createBlock(userId, householdId, {
        startTime: ts(2025, 3, 15, 9),
        endTime: ts(2025, 3, 15, 17),
        reason: 'Work',
      });

      expect(block).toMatchObject({
        user_id: userId,
        household_id: householdId,
        reason: 'Work',
      });
      expect(block.id).toBeDefined();
    });

    it('should create a recurring availability block', () => {
      const block = availabilityService.createBlock(userId, householdId, {
        startTime: ts(2025, 3, 10, 9),
        endTime: ts(2025, 3, 10, 17),
        reason: 'Weekly Work',
        recurringDay: 1, // Monday
      });

      expect(block.recurring_day).toBe(1);
    });
  });

  describe('updateBlock', () => {
    it('should update an existing block', () => {
      const block = availabilityService.createBlock(userId, householdId, {
        startTime: ts(2025, 4, 1, 9),
        endTime: ts(2025, 4, 1, 12),
        reason: 'Old reason',
      });

      const updated = availabilityService.updateBlock(block.id, { reason: 'New reason' });
      expect(updated.reason).toBe('New reason');
    });

    it('should throw for nonexistent block', () => {
      expect(() => availabilityService.updateBlock(99999, { reason: 'X' })).toThrow('not found');
    });
  });

  describe('deleteBlock', () => {
    it('should delete a block', () => {
      const block = availabilityService.createBlock(userId, householdId, {
        startTime: ts(2025, 5, 1, 9),
        endTime: ts(2025, 5, 1, 12),
      });

      availabilityService.deleteBlock(block.id);
      expect(availabilityService.getBlock(block.id)).toBeNull();
    });
  });

  describe('getUserAvailability', () => {
    it('should return blocks within date range', () => {
      // Create a block in a specific range
      availabilityService.createBlock(userId, householdId, {
        startTime: ts(2025, 6, 10, 9),
        endTime: ts(2025, 6, 10, 17),
        reason: 'Busy',
      });

      const blocks = availabilityService.getUserAvailability(
        userId, householdId, ts(2025, 6, 10), ts(2025, 6, 11)
      );
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks.some((b) => b.reason === 'Busy')).toBe(true);
    });

    it('should not return blocks outside date range', () => {
      const blocks = availabilityService.getUserAvailability(
        userId, householdId, ts(2026, 1, 1), ts(2026, 1, 2)
      );
      expect(blocks).toHaveLength(0);
    });
  });

  describe('getHouseholdAvailability', () => {
    it('should return blocks grouped by user', () => {
      availabilityService.createBlock(userId2, householdId, {
        startTime: ts(2025, 7, 1, 9),
        endTime: ts(2025, 7, 1, 17),
        reason: 'User2 Busy',
      });

      const result = availabilityService.getHouseholdAvailability(
        householdId, ts(2025, 7, 1), ts(2025, 7, 2)
      );

      expect(result.length).toBeGreaterThanOrEqual(1);
      const user2Entry = result.find((r) => r.user_id === userId2);
      expect(user2Entry).toBeDefined();
      expect(user2Entry.blocks.length).toBeGreaterThanOrEqual(1);
    });
  });
});
