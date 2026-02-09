import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initTestDatabase, closeDatabase } from '../../src/config/database.js';
import database from '../../src/config/database.js';

describe('Export Service', () => {
  let exportService;
  let userId;
  let householdId;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    initTestDatabase();
    exportService = (await import('../../src/services/export-service.js')).default;

    database.db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run('export@test.com', 'hash', 'ExportUser');
    userId = database.db.prepare("SELECT id FROM users WHERE email = ?").get('export@test.com').id;

    database.db.prepare('INSERT INTO households (name, owner_id) VALUES (?, ?)').run('Export House', userId);
    householdId = database.db.prepare("SELECT id FROM households WHERE name = ?").get('Export House').id;

    // Create test data
    database.db.prepare(
      "INSERT INTO tasks (household_id, title, description, task_type, assigned_to, difficulty, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(householdId, 'Test Task', 'Description', 'one_time', userId, 'easy', userId);

    database.db.prepare(
      "INSERT INTO tasks (household_id, title, task_type, created_by) VALUES (?, ?, ?, ?)"
    ).run(householdId, 'Task with, comma', 'one_time', userId);

    database.db.prepare(
      "INSERT INTO calendar_events (household_id, title, location, start_time, end_time, created_by) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(householdId, 'Test Event', 'Park', 1000, 2000, userId);
  });

  afterAll(() => closeDatabase());

  describe('escapeCSV', () => {
    it('should return empty string for null/undefined', () => {
      expect(exportService.escapeCSV(null)).toBe('');
      expect(exportService.escapeCSV(undefined)).toBe('');
    });

    it('should pass through simple strings', () => {
      expect(exportService.escapeCSV('hello')).toBe('hello');
    });

    it('should quote strings with commas', () => {
      expect(exportService.escapeCSV('hello, world')).toBe('"hello, world"');
    });

    it('should escape double quotes', () => {
      expect(exportService.escapeCSV('say "hello"')).toBe('"say ""hello"""');
    });

    it('should quote strings with newlines', () => {
      expect(exportService.escapeCSV('line1\nline2')).toBe('"line1\nline2"');
    });

    it('should escape formula injection prefixes', () => {
      expect(exportService.escapeCSV('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(exportService.escapeCSV('+cmd|stuff')).toBe("'+cmd|stuff");
      expect(exportService.escapeCSV('-cmd|stuff')).toBe("'-cmd|stuff");
      expect(exportService.escapeCSV('@SUM(A1)')).toBe("'@SUM(A1)");
    });
  });

  describe('exportTasks', () => {
    it('should generate valid CSV with correct headers', () => {
      const result = exportService.exportTasks(householdId);
      expect(result.mimeType).toBe('text/csv');
      expect(result.filename).toMatch(/^tasks-export-\d+\.csv$/);

      const lines = result.content.split('\n');
      expect(lines[0]).toBe('id,title,description,task_type,assigned_to,due_date,difficulty,time_estimate_minutes,status,completed_at,created_at');
      expect(lines.length).toBeGreaterThanOrEqual(2); // header + at least 1 data row
    });

    it('should include task data in CSV', () => {
      const result = exportService.exportTasks(householdId);
      expect(result.content).toContain('Test Task');
    });

    it('should handle commas in data', () => {
      const result = exportService.exportTasks(householdId);
      // The comma-containing title should be quoted
      expect(result.content).toContain('"Task with');
    });
  });

  describe('exportEvents', () => {
    it('should generate valid CSV with correct headers', () => {
      const result = exportService.exportEvents(householdId);
      expect(result.mimeType).toBe('text/csv');

      const lines = result.content.split('\n');
      expect(lines[0]).toBe('id,title,location,description,start_time,end_time,responsible_person,recurrence_rule,created_at');
      expect(lines.length).toBeGreaterThanOrEqual(2);
    });

    it('should include event data in CSV', () => {
      const result = exportService.exportEvents(householdId);
      expect(result.content).toContain('Test Event');
      expect(result.content).toContain('Park');
    });
  });

  describe('exportAll', () => {
    it('should combine tasks and events', () => {
      const result = exportService.exportAll(householdId);
      expect(result.content).toContain('=== TASKS ===');
      expect(result.content).toContain('=== EVENTS ===');
      expect(result.content).toContain('Test Task');
      expect(result.content).toContain('Test Event');
    });
  });
});
