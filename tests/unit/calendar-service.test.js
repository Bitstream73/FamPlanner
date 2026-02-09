import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initTestDatabase, closeDatabase } from '../../src/config/database.js';
import database from '../../src/config/database.js';

describe('Calendar Service', () => {
  let calendarService;
  let userId;
  let userId2;
  let householdId;

  // Helper: create a unix timestamp for a specific date
  const ts = (year, month, day, hour = 0) =>
    Math.floor(new Date(Date.UTC(year, month - 1, day, hour)).getTime() / 1000);

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    initTestDatabase();
    calendarService = (await import('../../src/services/calendar-service.js')).default;

    // Create test users
    database.db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run('cal@test.com', 'hash', 'CalUser');
    userId = database.db.prepare("SELECT id FROM users WHERE email = ?").get('cal@test.com').id;

    database.db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run('cal2@test.com', 'hash', 'CalUser2');
    userId2 = database.db.prepare("SELECT id FROM users WHERE email = ?").get('cal2@test.com').id;

    // Create household
    database.db.prepare('INSERT INTO households (name, owner_id) VALUES (?, ?)').run('Cal House', userId);
    householdId = database.db.prepare("SELECT id FROM households WHERE name = ?").get('Cal House').id;
    database.db.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)').run(householdId, userId, 'parent');
  });

  afterAll(() => closeDatabase());

  describe('createEvent', () => {
    it('should create an event with all fields', () => {
      const event = calendarService.createEvent(householdId, {
        title: 'Soccer Practice',
        location: 'City Park',
        description: 'Bring shin guards',
        startTime: ts(2025, 3, 15, 16),
        endTime: ts(2025, 3, 15, 17),
        responsibleUserId: userId,
        createdBy: userId,
      });

      expect(event).toMatchObject({
        title: 'Soccer Practice',
        location: 'City Park',
        description: 'Bring shin guards',
        responsible_user_id: userId,
        created_by: userId,
      });
      expect(event.id).toBeDefined();
    });

    it('should create an event with minimal fields', () => {
      const event = calendarService.createEvent(householdId, {
        title: 'Quick Event',
        startTime: ts(2025, 3, 16, 10),
        endTime: ts(2025, 3, 16, 11),
        createdBy: userId,
      });

      expect(event.title).toBe('Quick Event');
      expect(event.location).toBeNull();
      expect(event.responsible_user_id).toBeNull();
    });
  });

  describe('getEvent', () => {
    it('should return event with responsible person name', () => {
      const created = calendarService.createEvent(householdId, {
        title: 'Get Test',
        startTime: ts(2025, 4, 1, 9),
        endTime: ts(2025, 4, 1, 10),
        responsibleUserId: userId,
        createdBy: userId,
      });

      const event = calendarService.getEvent(created.id);
      expect(event.responsible_name).toBe('CalUser');
    });

    it('should return null for nonexistent event', () => {
      expect(calendarService.getEvent(99999)).toBeNull();
    });
  });

  describe('updateEvent', () => {
    it('should update specific fields', () => {
      const created = calendarService.createEvent(householdId, {
        title: 'Old Title',
        startTime: ts(2025, 5, 1, 9),
        endTime: ts(2025, 5, 1, 10),
        createdBy: userId,
      });

      const updated = calendarService.updateEvent(created.id, { title: 'New Title', location: 'New Place' });
      expect(updated.title).toBe('New Title');
      expect(updated.location).toBe('New Place');
    });

    it('should throw for nonexistent event', () => {
      expect(() => calendarService.updateEvent(99999, { title: 'X' })).toThrow('not found');
    });
  });

  describe('deleteEvent', () => {
    it('should delete an event', () => {
      const created = calendarService.createEvent(householdId, {
        title: 'To Delete',
        startTime: ts(2025, 6, 1, 9),
        endTime: ts(2025, 6, 1, 10),
        createdBy: userId,
      });

      calendarService.deleteEvent(created.id);
      expect(calendarService.getEvent(created.id)).toBeNull();
    });
  });

  describe('view queries', () => {
    let viewHouseholdId;

    beforeAll(() => {
      // Create isolated household for view tests
      database.db.prepare('INSERT INTO households (name, owner_id) VALUES (?, ?)').run('View House', userId);
      viewHouseholdId = database.db.prepare("SELECT id FROM households WHERE name = ?").get('View House').id;

      // Create events on specific dates
      calendarService.createEvent(viewHouseholdId, {
        title: 'Monday AM',
        startTime: ts(2025, 3, 10, 9),
        endTime: ts(2025, 3, 10, 10),
        createdBy: userId,
      });
      calendarService.createEvent(viewHouseholdId, {
        title: 'Monday PM',
        startTime: ts(2025, 3, 10, 14),
        endTime: ts(2025, 3, 10, 15),
        createdBy: userId,
      });
      calendarService.createEvent(viewHouseholdId, {
        title: 'Wednesday',
        startTime: ts(2025, 3, 12, 10),
        endTime: ts(2025, 3, 12, 11),
        createdBy: userId,
      });
    });

    it('getDayView should return events for a specific day', () => {
      const events = calendarService.getDayView(viewHouseholdId, ts(2025, 3, 10));
      expect(events).toHaveLength(2);
      expect(events[0].title).toBe('Monday AM');
      expect(events[1].title).toBe('Monday PM');
    });

    it('getDayView should return empty for a day with no events', () => {
      const events = calendarService.getDayView(viewHouseholdId, ts(2025, 3, 11));
      expect(events).toHaveLength(0);
    });

    it('getWeekView should return all events in a week', () => {
      const events = calendarService.getWeekView(viewHouseholdId, ts(2025, 3, 10));
      expect(events).toHaveLength(3);
    });

    it('getMonthView should return all events in March 2025', () => {
      const events = calendarService.getMonthView(viewHouseholdId, 2025, 3);
      expect(events).toHaveLength(3);
    });

    it('getMonthView should return empty for a month with no events', () => {
      const events = calendarService.getMonthView(viewHouseholdId, 2024, 1);
      expect(events).toHaveLength(0);
    });
  });

  describe('responsible person', () => {
    it('should assign a responsible person', () => {
      const event = calendarService.createEvent(householdId, {
        title: 'Assign Test',
        startTime: ts(2025, 7, 1, 9),
        endTime: ts(2025, 7, 1, 10),
        createdBy: userId,
      });

      const updated = calendarService.assignResponsible(event.id, userId);
      expect(updated.responsible_user_id).toBe(userId);
      expect(updated.responsible_name).toBe('CalUser');
    });

    it('should remove a responsible person', () => {
      const event = calendarService.createEvent(householdId, {
        title: 'Remove Resp',
        startTime: ts(2025, 7, 2, 9),
        endTime: ts(2025, 7, 2, 10),
        responsibleUserId: userId,
        createdBy: userId,
      });

      const updated = calendarService.removeResponsible(event.id);
      expect(updated.responsible_user_id).toBeNull();
    });
  });

  describe('recurring events', () => {
    it('should create 12 weekly instances', () => {
      const events = calendarService.createRecurringSeries(householdId, {
        title: 'Weekly Meeting',
        startTime: ts(2025, 1, 6, 10),
        endTime: ts(2025, 1, 6, 11),
        createdBy: userId,
      }, 'weekly');

      expect(events).toHaveLength(12);
      expect(events[0].recurrence_rule).toBe('weekly');
      // Check that the second event is 7 days later
      expect(events[1].start_time - events[0].start_time).toBe(7 * 86400);
    });

    it('should reject non-weekly recurrence', () => {
      expect(() => {
        calendarService.createRecurringSeries(householdId, {
          title: 'Daily',
          startTime: ts(2025, 1, 1, 10),
          endTime: ts(2025, 1, 1, 11),
          createdBy: userId,
        }, 'daily');
      }).toThrow('Only weekly');
    });

    it('should link child events to parent via recurrence_parent_id', () => {
      const events = calendarService.createRecurringSeries(householdId, {
        title: 'Linked Series',
        startTime: ts(2025, 2, 3, 14),
        endTime: ts(2025, 2, 3, 15),
        createdBy: userId,
      }, 'weekly');

      const parentId = events[0].id;
      for (let i = 1; i < events.length; i++) {
        expect(events[i].recurrence_parent_id).toBe(parentId);
      }
    });

    it('updateSeriesEvent scope=this should only change one instance', () => {
      const events = calendarService.createRecurringSeries(householdId, {
        title: 'Edit Series',
        startTime: ts(2025, 4, 7, 10),
        endTime: ts(2025, 4, 7, 11),
        createdBy: userId,
      }, 'weekly');

      calendarService.updateSeriesEvent(events[2].id, { title: 'Special Week' }, 'this');

      // Only the third event should change
      expect(calendarService.getEvent(events[2].id).title).toBe('Special Week');
      expect(calendarService.getEvent(events[0].id).title).toBe('Edit Series');
      expect(calendarService.getEvent(events[3].id).title).toBe('Edit Series');
    });

    it('updateSeriesEvent scope=all should change all instances', () => {
      const events = calendarService.createRecurringSeries(householdId, {
        title: 'All Edit',
        startTime: ts(2025, 5, 5, 10),
        endTime: ts(2025, 5, 5, 11),
        createdBy: userId,
      }, 'weekly');

      calendarService.updateSeriesEvent(events[3].id, { title: 'Updated All' }, 'all');

      for (const e of events) {
        expect(calendarService.getEvent(e.id).title).toBe('Updated All');
      }
    });

    it('deleteSeriesEvent scope=all should remove all instances', () => {
      const events = calendarService.createRecurringSeries(householdId, {
        title: 'Delete All',
        startTime: ts(2025, 6, 2, 10),
        endTime: ts(2025, 6, 2, 11),
        createdBy: userId,
      }, 'weekly');

      calendarService.deleteSeriesEvent(events[0].id, 'all');

      for (const e of events) {
        expect(calendarService.getEvent(e.id)).toBeNull();
      }
    });
  });
});
