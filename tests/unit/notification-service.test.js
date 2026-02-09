import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initTestDatabase, closeDatabase } from '../../src/config/database.js';
import database from '../../src/config/database.js';

describe('Notification Service', () => {
  let notificationService;
  let userId;
  let userId2;
  let householdId;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    initTestDatabase();
    notificationService = (await import('../../src/services/notification-service.js')).default;

    database.db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run('notif@test.com', 'hash', 'NotifUser');
    userId = database.db.prepare("SELECT id FROM users WHERE email = ?").get('notif@test.com').id;

    database.db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run('notif2@test.com', 'hash', 'NotifUser2');
    userId2 = database.db.prepare("SELECT id FROM users WHERE email = ?").get('notif2@test.com').id;

    database.db.prepare('INSERT INTO households (name, owner_id) VALUES (?, ?)').run('Notif House', userId);
    householdId = database.db.prepare("SELECT id FROM households WHERE name = ?").get('Notif House').id;
    database.db.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)').run(householdId, userId, 'parent');
    database.db.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)').run(householdId, userId2, 'teen');
  });

  afterAll(() => closeDatabase());

  describe('create', () => {
    it('should create a notification with all fields', () => {
      const notification = notificationService.create(userId, householdId, {
        type: 'task_assigned',
        title: 'New task assigned',
        body: 'You have been assigned a new task',
        entityType: 'task',
        entityId: 1,
      });

      expect(notification).toMatchObject({
        user_id: userId,
        household_id: householdId,
        type: 'task_assigned',
        title: 'New task assigned',
        is_read: 0,
      });
    });
  });

  describe('list', () => {
    it('should list notifications with pagination', () => {
      notificationService.create(userId, householdId, {
        type: 'mention',
        title: 'Notification 1',
      });
      notificationService.create(userId, householdId, {
        type: 'announcement',
        title: 'Notification 2',
      });

      const result = notificationService.list(userId);
      expect(result.total).toBeGreaterThanOrEqual(2);
      expect(result.notifications.length).toBeGreaterThanOrEqual(2);
      expect(result.unreadCount).toBeGreaterThanOrEqual(2);
    });

    it('should filter unread only', () => {
      const result = notificationService.list(userId, { unreadOnly: true });
      expect(result.notifications.every((n) => n.is_read === 0)).toBe(true);
    });
  });

  describe('markRead', () => {
    it('should mark a notification as read', () => {
      const notification = notificationService.create(userId, householdId, {
        type: 'comment',
        title: 'Read me',
      });

      const updated = notificationService.markRead(notification.id, userId);
      expect(updated.is_read).toBe(1);
    });
  });

  describe('markAllRead', () => {
    it('should mark all notifications as read', () => {
      notificationService.create(userId, householdId, { type: 'invite', title: 'Unread 1' });
      notificationService.create(userId, householdId, { type: 'invite', title: 'Unread 2' });

      const count = notificationService.markAllRead(userId);
      expect(count).toBeGreaterThanOrEqual(2);

      const result = notificationService.list(userId, { unreadOnly: true });
      expect(result.unreadCount).toBe(0);
    });
  });

  describe('delete', () => {
    it('should delete a notification', () => {
      const notification = notificationService.create(userId, householdId, {
        type: 'task_due',
        title: 'Delete me',
      });

      notificationService.remove(notification.id, userId);
      expect(notificationService.getNotification(notification.id)).toBeNull();
    });
  });

  describe('createForHousehold', () => {
    it('should create notifications for all household members', () => {
      const notifications = notificationService.createForHousehold(householdId, {
        type: 'announcement',
        title: 'Household announcement',
        body: 'Important news',
      });

      expect(notifications).toHaveLength(2); // userId and userId2
    });

    it('should exclude specified user', () => {
      const notifications = notificationService.createForHousehold(householdId, {
        type: 'announcement',
        title: 'Excluded test',
        excludeUserId: userId,
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].user_id).toBe(userId2);
    });
  });
});
