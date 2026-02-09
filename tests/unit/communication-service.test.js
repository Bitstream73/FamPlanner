import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initTestDatabase, closeDatabase } from '../../src/config/database.js';
import database from '../../src/config/database.js';

describe('Communication Services', () => {
  let announcementService;
  let commentService;
  let mentionService;
  let quietHoursService;
  let userId;
  let userId2;
  let householdId;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    initTestDatabase();
    announcementService = (await import('../../src/services/announcement-service.js')).default;
    commentService = (await import('../../src/services/comment-service.js')).default;
    mentionService = (await import('../../src/services/mention-service.js')).default;
    quietHoursService = (await import('../../src/services/quiet-hours-service.js')).default;

    database.db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run('comm@test.com', 'hash', 'CommUser');
    userId = database.db.prepare("SELECT id FROM users WHERE email = ?").get('comm@test.com').id;

    database.db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run('comm2@test.com', 'hash', 'CommUser2');
    userId2 = database.db.prepare("SELECT id FROM users WHERE email = ?").get('comm2@test.com').id;

    database.db.prepare('INSERT INTO households (name, owner_id) VALUES (?, ?)').run('Comm House', userId);
    householdId = database.db.prepare("SELECT id FROM households WHERE name = ?").get('Comm House').id;
    database.db.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)').run(householdId, userId, 'parent');
    database.db.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)').run(householdId, userId2, 'teen');
  });

  afterAll(() => closeDatabase());

  describe('Announcement Service', () => {
    it('should create an announcement', () => {
      const announcement = announcementService.create(householdId, userId, 'Family meeting tonight!');
      expect(announcement).toMatchObject({
        household_id: householdId,
        author_id: userId,
        content: 'Family meeting tonight!',
        is_pinned: 0,
        author_name: 'CommUser',
      });
    });

    it('should update an announcement', () => {
      const created = announcementService.create(householdId, userId, 'Old content');
      const updated = announcementService.update(created.id, 'New content');
      expect(updated.content).toBe('New content');
    });

    it('should delete an announcement', () => {
      const created = announcementService.create(householdId, userId, 'Delete me');
      announcementService.remove(created.id);
      expect(announcementService.get(created.id)).toBeNull();
    });

    it('should list announcements with pagination', () => {
      // Create a few announcements
      announcementService.create(householdId, userId, 'Announcement 1');
      announcementService.create(householdId, userId, 'Announcement 2');

      const result = announcementService.list(householdId, { limit: 10, offset: 0 });
      expect(result.total).toBeGreaterThanOrEqual(2);
      expect(result.announcements.length).toBeGreaterThanOrEqual(2);
    });

    it('should pin and unpin announcements', () => {
      const created = announcementService.create(householdId, userId, 'Pin me');
      const pinned = announcementService.pin(created.id);
      expect(pinned.is_pinned).toBe(1);

      const unpinned = announcementService.unpin(created.id);
      expect(unpinned.is_pinned).toBe(0);
    });

    it('should list pinned announcements', () => {
      const a1 = announcementService.create(householdId, userId, 'Pinned 1');
      announcementService.pin(a1.id);
      const a2 = announcementService.create(householdId, userId, 'Pinned 2');
      announcementService.pin(a2.id);

      const pinned = announcementService.getPinned(householdId);
      expect(pinned.length).toBeGreaterThanOrEqual(2);
      expect(pinned.every((a) => a.is_pinned === 1)).toBe(true);
    });

    it('should list pinned announcements first', () => {
      const result = announcementService.list(householdId);
      // Pinned ones should come first
      const firstPinnedIndex = result.announcements.findIndex((a) => a.is_pinned === 1);
      const firstUnpinnedIndex = result.announcements.findIndex((a) => a.is_pinned === 0);
      if (firstPinnedIndex >= 0 && firstUnpinnedIndex >= 0) {
        expect(firstPinnedIndex).toBeLessThan(firstUnpinnedIndex);
      }
    });
  });

  describe('Comment Service', () => {
    let taskId;

    beforeAll(() => {
      // Create a task for comments
      database.db.prepare(
        "INSERT INTO tasks (household_id, title, task_type, created_by) VALUES (?, ?, ?, ?)"
      ).run(householdId, 'Comment Task', 'one_time', userId);
      taskId = database.db.prepare("SELECT id FROM tasks WHERE title = ?").get('Comment Task').id;
    });

    it('should add a comment to a task', () => {
      const comment = commentService.addComment('task', taskId, userId, 'Great job!');
      expect(comment).toMatchObject({
        entity_type: 'task',
        entity_id: taskId,
        author_id: userId,
        content: 'Great job!',
        author_name: 'CommUser',
      });
    });

    it('should add a comment to an event', () => {
      database.db.prepare(
        "INSERT INTO calendar_events (household_id, title, start_time, end_time, created_by) VALUES (?, ?, ?, ?, ?)"
      ).run(householdId, 'Event', 1000, 2000, userId);
      const eventId = database.db.prepare("SELECT id FROM calendar_events WHERE title = ?").get('Event').id;

      const comment = commentService.addComment('event', eventId, userId, 'See you there!');
      expect(comment.entity_type).toBe('event');
      expect(comment.entity_id).toBe(eventId);
    });

    it('should update a comment', () => {
      const comment = commentService.addComment('task', taskId, userId, 'Old text');
      const updated = commentService.updateComment(comment.id, 'New text');
      expect(updated.content).toBe('New text');
    });

    it('should delete a comment', () => {
      const comment = commentService.addComment('task', taskId, userId, 'Delete me');
      commentService.deleteComment(comment.id);
      expect(commentService.getComment(comment.id)).toBeNull();
    });

    it('should list comments with pagination', () => {
      commentService.addComment('task', taskId, userId, 'Comment A');
      commentService.addComment('task', taskId, userId2, 'Comment B');

      const result = commentService.listComments('task', taskId);
      expect(result.total).toBeGreaterThanOrEqual(2);
      expect(result.comments.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Mention Service', () => {
    it('should parse @mentions from text', () => {
      const mentions = mentionService.parseMentions('Hey @CommUser check this out!', householdId);
      expect(mentions).toHaveLength(1);
      expect(mentions[0].userId).toBe(userId);
      expect(mentions[0].username).toBe('CommUser');
    });

    it('should ignore @mentions for non-members', () => {
      const mentions = mentionService.parseMentions('Hey @Stranger are you there?', householdId);
      expect(mentions).toHaveLength(0);
    });

    it('should parse multiple @mentions', () => {
      const mentions = mentionService.parseMentions('Hey @CommUser and @CommUser2!', householdId);
      expect(mentions).toHaveLength(2);
    });

    it('should not duplicate mentions for the same user', () => {
      const mentions = mentionService.parseMentions('@CommUser @CommUser again', householdId);
      expect(mentions).toHaveLength(1);
    });

    it('should create mention records', () => {
      const announcement = announcementService.create(householdId, userId, 'Hey @CommUser2!');
      const mentions = mentionService.createMentions(null, announcement.id, [userId2]);
      expect(mentions).toHaveLength(1);
      expect(mentions[0].announcement_id).toBe(announcement.id);
      expect(mentions[0].mentioned_user_id).toBe(userId2);
    });

    it('should get user mentions', () => {
      const userMentions = mentionService.getUserMentions(userId2);
      expect(userMentions.length).toBeGreaterThanOrEqual(1);
      expect(userMentions[0].context_type).toBe('announcement');
    });
  });

  describe('Quiet Hours Service', () => {
    it('should set quiet hours', () => {
      const result = quietHoursService.setQuietHours(userId, householdId, '22:00', '07:00');
      expect(result).toEqual({ start: '22:00', end: '07:00' });
    });

    it('should get quiet hours', () => {
      const hours = quietHoursService.getQuietHours(userId, householdId);
      expect(hours).toEqual({ start: '22:00', end: '07:00' });
    });

    it('should return null when no quiet hours set', () => {
      const hours = quietHoursService.getQuietHours(userId2, householdId);
      expect(hours).toBeNull();
    });

    it('should update existing quiet hours', () => {
      quietHoursService.setQuietHours(userId, householdId, '23:00', '06:00');
      const hours = quietHoursService.getQuietHours(userId, householdId);
      expect(hours).toEqual({ start: '23:00', end: '06:00' });
    });

    it('should clear quiet hours', () => {
      quietHoursService.clearQuietHours(userId, householdId);
      const hours = quietHoursService.getQuietHours(userId, householdId);
      expect(hours).toBeNull();
    });

    it('isInQuietHours should return false when no hours set', () => {
      quietHoursService.clearQuietHours(userId, householdId);
      expect(quietHoursService.isInQuietHours(userId, householdId)).toBe(false);
    });
  });
});
