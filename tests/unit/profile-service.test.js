import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initTestDatabase, closeDatabase } from '../../src/config/database.js';
import database from '../../src/config/database.js';

describe('Profile Service', () => {
  let profileService;
  let userId;
  let householdId;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    initTestDatabase();
    profileService = (await import('../../src/services/profile-service.js')).default;

    // Create test user
    database.db.prepare(
      "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)"
    ).run('profile@test.com', 'hash123', 'Profile User');
    userId = database.db.prepare("SELECT id FROM users WHERE email = ?").get('profile@test.com').id;

    // Create second user for household profiles
    database.db.prepare(
      "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)"
    ).run('profile2@test.com', 'hash123', 'Profile User 2');
    const userId2 = database.db.prepare("SELECT id FROM users WHERE email = ?").get('profile2@test.com').id;

    // Create household with both users
    database.db.prepare('INSERT INTO households (name, owner_id) VALUES (?, ?)').run('Profile House', userId);
    householdId = database.db.prepare("SELECT id FROM households WHERE name = ?").get('Profile House').id;
    database.db.prepare(
      'INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)'
    ).run(householdId, userId, 'parent');
    database.db.prepare(
      'INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)'
    ).run(householdId, userId2, 'teen');
  });

  afterAll(() => closeDatabase());

  describe('getProfile', () => {
    it('should return basic profile from users table when no profile row exists', () => {
      const profile = profileService.getProfile(userId);
      expect(profile).toMatchObject({
        user_id: userId,
        display_name: 'Profile User',
      });
    });

    it('should return null for nonexistent user', () => {
      expect(profileService.getProfile(99999)).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should create profile row on first update', () => {
      const profile = profileService.updateProfile(userId, {
        displayName: 'Updated Name',
        avatarUrl: 'https://example.com/avatar.png',
        pronouns: 'they/them',
      });

      expect(profile).toMatchObject({
        user_id: userId,
        display_name: 'Updated Name',
        avatar_url: 'https://example.com/avatar.png',
        pronouns: 'they/them',
      });
    });

    it('should update existing profile with partial data', () => {
      const profile = profileService.updateProfile(userId, {
        displayName: 'Newer Name',
      });

      expect(profile.display_name).toBe('Newer Name');
      // Previous values should be preserved
      expect(profile.avatar_url).toBe('https://example.com/avatar.png');
      expect(profile.pronouns).toBe('they/them');
    });

    it('should handle all fields being optional', () => {
      database.db.prepare(
        "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)"
      ).run('minimal@test.com', 'hash123', 'Minimal');
      const minimalId = database.db.prepare("SELECT id FROM users WHERE email = ?").get('minimal@test.com').id;

      const profile = profileService.updateProfile(minimalId, {});
      expect(profile.user_id).toBe(minimalId);
    });
  });

  describe('getHouseholdProfiles', () => {
    it('should return all profiles for household members', () => {
      const profiles = profileService.getHouseholdProfiles(householdId);
      expect(profiles).toHaveLength(2);
      expect(profiles[0]).toHaveProperty('user_id');
      expect(profiles[0]).toHaveProperty('display_name');
      expect(profiles[0]).toHaveProperty('role');
    });

    it('should return empty array for empty household', () => {
      database.db.prepare(
        "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)"
      ).run('empty-owner@test.com', 'hash123', 'Empty');
      const emptyOwnerId = database.db.prepare("SELECT id FROM users WHERE email = ?").get('empty-owner@test.com').id;
      database.db.prepare('INSERT INTO households (name, owner_id) VALUES (?, ?)').run('Empty House', emptyOwnerId);
      const emptyHouseholdId = database.db.prepare("SELECT id FROM households WHERE name = ?").get('Empty House').id;

      const profiles = profileService.getHouseholdProfiles(emptyHouseholdId);
      expect(profiles).toEqual([]);
    });
  });
});
