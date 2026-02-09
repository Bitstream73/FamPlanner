import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initTestDatabase, closeDatabase } from '../../src/config/database.js';
import database from '../../src/config/database.js';

describe('Handbook Service', () => {
  let handbookService;
  let userId;
  let householdId;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    initTestDatabase();
    handbookService = (await import('../../src/services/handbook-service.js')).default;

    database.db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run('handbook@test.com', 'hash', 'HandbookUser');
    userId = database.db.prepare("SELECT id FROM users WHERE email = ?").get('handbook@test.com').id;

    database.db.prepare('INSERT INTO households (name, owner_id) VALUES (?, ?)').run('Handbook House', userId);
    householdId = database.db.prepare("SELECT id FROM households WHERE name = ?").get('Handbook House').id;
  });

  afterAll(() => closeDatabase());

  describe('createNote', () => {
    it('should create a note entry', () => {
      const entry = handbookService.createNote(householdId, {
        title: 'Wi-Fi Password',
        content: 'Network: FamilyNet\nPassword: secret123',
        isPinned: true,
        createdBy: userId,
      });

      expect(entry).toMatchObject({
        title: 'Wi-Fi Password',
        entry_type: 'note',
        is_pinned: 1,
        steps: null,
        image_urls: null,
      });
    });
  });

  describe('createHowTo', () => {
    it('should create a how-to entry with steps and images', () => {
      const entry = handbookService.createHowTo(householdId, {
        title: 'How to Start the Dishwasher',
        content: 'Our dishwasher needs a specific loading pattern.',
        steps: ['Load bottom rack', 'Add detergent', 'Press Start twice'],
        imageUrls: ['https://example.com/dish1.jpg'],
        createdBy: userId,
      });

      expect(entry).toMatchObject({
        title: 'How to Start the Dishwasher',
        entry_type: 'howto',
        steps: ['Load bottom rack', 'Add detergent', 'Press Start twice'],
        image_urls: ['https://example.com/dish1.jpg'],
      });
    });

    it('should create a how-to without images', () => {
      const entry = handbookService.createHowTo(householdId, {
        title: 'No Image How-To',
        content: 'Simple instructions.',
        steps: ['Step 1', 'Step 2'],
        createdBy: userId,
      });

      expect(entry.image_urls).toBeNull();
    });
  });

  describe('getEntry', () => {
    it('should return entry with parsed JSON fields', () => {
      const created = handbookService.createHowTo(householdId, {
        title: 'JSON Test',
        content: 'Test',
        steps: ['A', 'B'],
        imageUrls: ['img.jpg'],
        createdBy: userId,
      });

      const entry = handbookService.getEntry(created.id);
      expect(Array.isArray(entry.steps)).toBe(true);
      expect(Array.isArray(entry.image_urls)).toBe(true);
    });

    it('should return null for nonexistent entry', () => {
      expect(handbookService.getEntry(99999)).toBeNull();
    });
  });

  describe('updateEntry', () => {
    it('should update title and content', () => {
      const created = handbookService.createNote(householdId, {
        title: 'Old Title',
        content: 'Old content',
        createdBy: userId,
      });

      const updated = handbookService.updateEntry(created.id, {
        title: 'New Title',
        content: 'New content',
      });

      expect(updated.title).toBe('New Title');
      expect(updated.content).toBe('New content');
    });

    it('should update steps for how-to', () => {
      const created = handbookService.createHowTo(householdId, {
        title: 'Steps Update',
        content: 'Test',
        steps: ['Old step'],
        createdBy: userId,
      });

      const updated = handbookService.updateEntry(created.id, {
        steps: ['New step 1', 'New step 2'],
      });

      expect(updated.steps).toEqual(['New step 1', 'New step 2']);
    });

    it('should pin/unpin via update', () => {
      const created = handbookService.createNote(householdId, {
        title: 'Pin Test',
        content: 'Test',
        createdBy: userId,
      });

      const pinned = handbookService.updateEntry(created.id, { isPinned: true });
      expect(pinned.is_pinned).toBe(1);

      const unpinned = handbookService.updateEntry(created.id, { isPinned: false });
      expect(unpinned.is_pinned).toBe(0);
    });
  });

  describe('deleteEntry', () => {
    it('should delete an entry', () => {
      const created = handbookService.createNote(householdId, {
        title: 'Delete Me',
        content: 'Test',
        createdBy: userId,
      });

      handbookService.deleteEntry(created.id);
      expect(handbookService.getEntry(created.id)).toBeNull();
    });
  });

  describe('listEntries', () => {
    it('should list all entries with pagination', () => {
      const result = handbookService.listEntries(householdId, { limit: 50 });
      expect(result.total).toBeGreaterThan(0);
      expect(result.entries.length).toBeGreaterThan(0);
    });

    it('should filter by type', () => {
      const notesOnly = handbookService.listEntries(householdId, { type: 'note' });
      expect(notesOnly.entries.every((e) => e.entry_type === 'note')).toBe(true);

      const howtosOnly = handbookService.listEntries(householdId, { type: 'howto' });
      expect(howtosOnly.entries.every((e) => e.entry_type === 'howto')).toBe(true);
    });
  });

  describe('getPinnedEntries', () => {
    it('should return only pinned entries', () => {
      const pinned = handbookService.getPinnedEntries(householdId);
      expect(pinned.every((e) => e.is_pinned === 1)).toBe(true);
    });
  });

  describe('searchEntries', () => {
    it('should find entries by title', () => {
      handbookService.createNote(householdId, {
        title: 'Unique Search Title XYZ',
        content: 'Normal content',
        createdBy: userId,
      });

      const results = handbookService.searchEntries(householdId, 'Unique Search Title XYZ');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Unique Search Title XYZ');
    });

    it('should find entries by content', () => {
      handbookService.createNote(householdId, {
        title: 'Normal title',
        content: 'Unique content ABCDEF',
        createdBy: userId,
      });

      const results = handbookService.searchEntries(householdId, 'ABCDEF');
      expect(results).toHaveLength(1);
    });

    it('should return empty array for no matches', () => {
      const results = handbookService.searchEntries(householdId, 'nonexistent_query_12345');
      expect(results).toEqual([]);
    });
  });
});
