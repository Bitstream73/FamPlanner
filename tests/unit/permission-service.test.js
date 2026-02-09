import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initTestDatabase, closeDatabase } from '../../src/config/database.js';
import database from '../../src/config/database.js';

describe('Permission Service', () => {
  let permissionService;
  let householdId;
  const users = {};

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    initTestDatabase();
    permissionService = (await import('../../src/services/permission-service.js')).default;

    // Create test users for each role
    const roles = ['parent', 'guardian', 'teen', 'kid', 'caregiver'];
    for (const role of roles) {
      database.db.prepare(
        "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)"
      ).run(`${role}@test.com`, 'hash123', role);
      users[role] = database.db.prepare("SELECT id FROM users WHERE email = ?").get(`${role}@test.com`).id;
    }

    // Create household
    database.db.prepare(
      'INSERT INTO households (name, owner_id) VALUES (?, ?)'
    ).run('Perm Test', users.parent);
    householdId = database.db.prepare("SELECT id FROM households WHERE name = ?").get('Perm Test').id;

    // Add all users as members with their roles
    for (const [role, userId] of Object.entries(users)) {
      database.db.prepare(
        'INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)'
      ).run(householdId, userId, role);
    }
  });

  afterAll(() => closeDatabase());

  describe('getMemberRole', () => {
    it('should return the role for a valid member', () => {
      expect(permissionService.getMemberRole(users.parent, householdId)).toBe('parent');
      expect(permissionService.getMemberRole(users.teen, householdId)).toBe('teen');
    });

    it('should return null for non-member', () => {
      expect(permissionService.getMemberRole(99999, householdId)).toBeNull();
    });
  });

  describe('canPerform', () => {
    // Parent permissions
    it('should allow parent to assign tasks', () => {
      expect(permissionService.canPerform(users.parent, householdId, 'assign_task')).toBe(true);
    });

    it('should allow parent to edit calendar', () => {
      expect(permissionService.canPerform(users.parent, householdId, 'edit_calendar')).toBe(true);
    });

    it('should allow parent to delete entities', () => {
      expect(permissionService.canPerform(users.parent, householdId, 'delete_entity')).toBe(true);
    });

    it('should allow parent to manage members', () => {
      expect(permissionService.canPerform(users.parent, householdId, 'manage_members')).toBe(true);
    });

    // Guardian permissions (same as parent)
    it('should allow guardian full access like parent', () => {
      expect(permissionService.canPerform(users.guardian, householdId, 'assign_task')).toBe(true);
      expect(permissionService.canPerform(users.guardian, householdId, 'delete_entity')).toBe(true);
      expect(permissionService.canPerform(users.guardian, householdId, 'manage_members')).toBe(true);
    });

    // Teen permissions
    it('should allow teen to assign own tasks', () => {
      expect(permissionService.canPerform(users.teen, householdId, 'assign_task_self')).toBe(true);
    });

    it('should allow teen to edit calendar', () => {
      expect(permissionService.canPerform(users.teen, householdId, 'edit_calendar')).toBe(true);
    });

    it('should allow teen to delete own items', () => {
      expect(permissionService.canPerform(users.teen, householdId, 'delete_own')).toBe(true);
    });

    it('should deny teen from managing members', () => {
      expect(permissionService.canPerform(users.teen, householdId, 'manage_members')).toBe(false);
    });

    it('should deny teen from deleting entities', () => {
      expect(permissionService.canPerform(users.teen, householdId, 'delete_entity')).toBe(false);
    });

    // Kid permissions
    it('should allow kid to view assigned items', () => {
      expect(permissionService.canPerform(users.kid, householdId, 'view_assigned')).toBe(true);
    });

    it('should allow kid to complete tasks', () => {
      expect(permissionService.canPerform(users.kid, householdId, 'complete_task')).toBe(true);
    });

    it('should deny kid from editing calendar', () => {
      expect(permissionService.canPerform(users.kid, householdId, 'edit_calendar')).toBe(false);
    });

    it('should deny kid from assigning tasks', () => {
      expect(permissionService.canPerform(users.kid, householdId, 'assign_task')).toBe(false);
    });

    it('should deny kid from deleting', () => {
      expect(permissionService.canPerform(users.kid, householdId, 'delete_entity')).toBe(false);
    });

    // Caregiver permissions
    it('should allow caregiver to assign tasks', () => {
      expect(permissionService.canPerform(users.caregiver, householdId, 'assign_task')).toBe(true);
    });

    it('should allow caregiver to edit calendar', () => {
      expect(permissionService.canPerform(users.caregiver, householdId, 'edit_calendar')).toBe(true);
    });

    it('should deny caregiver from deleting entities', () => {
      expect(permissionService.canPerform(users.caregiver, householdId, 'delete_entity')).toBe(false);
    });

    it('should deny caregiver from managing members', () => {
      expect(permissionService.canPerform(users.caregiver, householdId, 'manage_members')).toBe(false);
    });

    // Non-member
    it('should deny all permissions for non-member', () => {
      expect(permissionService.canPerform(99999, householdId, 'view_all')).toBe(false);
    });
  });

  describe('requirePermission', () => {
    it('should not throw for allowed action', () => {
      expect(() => {
        permissionService.requirePermission(users.parent, householdId, 'assign_task');
      }).not.toThrow();
    });

    it('should throw 403 for denied action', () => {
      try {
        permissionService.requirePermission(users.kid, householdId, 'delete_entity');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('Permission denied');
        expect(error.statusCode).toBe(403);
      }
    });
  });
});
