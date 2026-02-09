import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initTestDatabase, closeDatabase } from '../../src/config/database.js';
import database from '../../src/config/database.js';

describe('Audit Service', () => {
  let auditService;
  let userId;
  let userId2;
  let householdId;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    initTestDatabase();
    auditService = (await import('../../src/services/audit-service.js')).default;

    database.db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run('audit@test.com', 'hash', 'AuditUser');
    userId = database.db.prepare("SELECT id FROM users WHERE email = ?").get('audit@test.com').id;

    database.db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run('audit2@test.com', 'hash', 'AuditUser2');
    userId2 = database.db.prepare("SELECT id FROM users WHERE email = ?").get('audit2@test.com').id;

    database.db.prepare('INSERT INTO households (name, owner_id) VALUES (?, ?)').run('Audit House', userId);
    householdId = database.db.prepare("SELECT id FROM households WHERE name = ?").get('Audit House').id;
  });

  afterAll(() => closeDatabase());

  describe('log', () => {
    it('should create an audit entry with all fields', () => {
      const entry = auditService.log(householdId, userId, {
        action: 'create',
        entityType: 'task',
        entityId: 1,
        details: { title: 'New task' },
      });

      expect(entry).toMatchObject({
        household_id: householdId,
        user_id: userId,
        action: 'create',
        entity_type: 'task',
        entity_id: 1,
        details: { title: 'New task' },
      });
    });

    it('should create entry without details', () => {
      const entry = auditService.log(householdId, userId, {
        action: 'delete',
        entityType: 'event',
        entityId: 5,
      });

      expect(entry.details).toBeNull();
    });
  });

  describe('query', () => {
    beforeAll(() => {
      // Create some audit entries for querying
      auditService.log(householdId, userId, { action: 'create', entityType: 'task', entityId: 10, details: { title: 'Task A' } });
      auditService.log(householdId, userId, { action: 'update', entityType: 'task', entityId: 10, details: { field: 'status', from: 'pending', to: 'completed' } });
      auditService.log(householdId, userId2, { action: 'create', entityType: 'event', entityId: 20, details: { title: 'Event B' } });
      auditService.log(householdId, userId, { action: 'complete', entityType: 'task', entityId: 10, details: { title: 'Task A' } });
    });

    it('should query all entries for household', () => {
      const result = auditService.query(householdId);
      expect(result.total).toBeGreaterThanOrEqual(4);
    });

    it('should filter by user', () => {
      const result = auditService.query(householdId, { userId: userId2 });
      expect(result.entries.every((e) => e.user_id === userId2)).toBe(true);
    });

    it('should filter by entity type', () => {
      const result = auditService.query(householdId, { entityType: 'event' });
      expect(result.entries.every((e) => e.entity_type === 'event')).toBe(true);
    });

    it('should filter by action', () => {
      const result = auditService.query(householdId, { action: 'create' });
      expect(result.entries.every((e) => e.action === 'create')).toBe(true);
    });

    it('should paginate results', () => {
      const result = auditService.query(householdId, { limit: 2, offset: 0 });
      expect(result.entries).toHaveLength(2);
      expect(result.total).toBeGreaterThanOrEqual(4);
    });
  });

  describe('getEntityHistory', () => {
    it('should return all actions for a specific entity', () => {
      const history = auditService.getEntityHistory('task', 10);
      expect(history.length).toBeGreaterThanOrEqual(3); // create, update, complete
      expect(history[0].action).toBe('create'); // sorted ASC by time
    });

    it('should return empty for nonexistent entity', () => {
      const history = auditService.getEntityHistory('task', 99999);
      expect(history).toHaveLength(0);
    });
  });
});
