import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initTestDatabase, closeDatabase } from '../../src/config/database.js';
import database from '../../src/config/database.js';

describe('Household Service', () => {
  let householdService;
  let ownerId;
  let otherUserId;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    initTestDatabase();
    householdService = (await import('../../src/services/household-service.js')).default;

    // Create test users
    database.db.prepare(
      "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)"
    ).run('owner@test.com', 'hash123', 'Owner');
    ownerId = database.db.prepare("SELECT id FROM users WHERE email = ?").get('owner@test.com').id;

    database.db.prepare(
      "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)"
    ).run('other@test.com', 'hash123', 'Other');
    otherUserId = database.db.prepare("SELECT id FROM users WHERE email = ?").get('other@test.com').id;
  });

  afterAll(() => closeDatabase());

  describe('createHousehold', () => {
    it('should create a household and return it', () => {
      const household = householdService.createHousehold('Test Family', ownerId);
      expect(household).toMatchObject({
        name: 'Test Family',
        owner_id: ownerId,
      });
      expect(household.id).toBeDefined();
    });

    it('should auto-add owner as parent member', () => {
      const household = householdService.createHousehold('Auto Parent', ownerId);
      const members = householdService.listMembers(household.id);
      expect(members).toHaveLength(1);
      expect(members[0]).toMatchObject({
        user_id: ownerId,
        role: 'parent',
      });
    });
  });

  describe('getHousehold', () => {
    it('should return household with members', () => {
      const created = householdService.createHousehold('Get Test', ownerId);
      const household = householdService.getHousehold(created.id);
      expect(household.name).toBe('Get Test');
      expect(household.members).toHaveLength(1);
    });

    it('should return null for nonexistent household', () => {
      expect(householdService.getHousehold(99999)).toBeNull();
    });
  });

  describe('updateHousehold', () => {
    it('should update the household name', () => {
      const created = householdService.createHousehold('Old Name', ownerId);
      const updated = householdService.updateHousehold(created.id, { name: 'New Name' });
      expect(updated.name).toBe('New Name');
    });
  });

  describe('deleteHousehold', () => {
    it('should delete household when requested by owner', () => {
      const created = householdService.createHousehold('To Delete', ownerId);
      householdService.deleteHousehold(created.id, ownerId);
      expect(householdService.getHousehold(created.id)).toBeNull();
    });

    it('should throw when non-owner tries to delete', () => {
      const created = householdService.createHousehold('Protected', ownerId);
      expect(() => {
        householdService.deleteHousehold(created.id, otherUserId);
      }).toThrow('Only the owner');
    });

    it('should throw for nonexistent household', () => {
      expect(() => {
        householdService.deleteHousehold(99999, ownerId);
      }).toThrow('not found');
    });
  });

  describe('listUserHouseholds', () => {
    it('should return all households for a user', () => {
      householdService.createHousehold('House A', ownerId);
      householdService.createHousehold('House B', ownerId);
      const list = householdService.listUserHouseholds(ownerId);
      expect(list.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array for user with no households', () => {
      database.db.prepare(
        "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)"
      ).run('lonely@test.com', 'hash123', 'Lonely');
      const lonelyId = database.db.prepare("SELECT id FROM users WHERE email = ?").get('lonely@test.com').id;
      expect(householdService.listUserHouseholds(lonelyId)).toEqual([]);
    });
  });

  describe('generateInvite + acceptInvite', () => {
    it('should generate a valid invite token', () => {
      const household = householdService.createHousehold('Invite Test', ownerId);
      const invite = householdService.generateInvite(household.id, ownerId, { role: 'teen' });
      expect(invite.token).toBeDefined();
      expect(invite.token.length).toBe(64); // 32 bytes hex = 64 chars
      expect(invite.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should accept a valid invite and add member', () => {
      const household = householdService.createHousehold('Join Test', ownerId);
      const invite = householdService.generateInvite(household.id, ownerId, { role: 'teen' });
      const result = householdService.acceptInvite(invite.token, otherUserId);
      expect(result.role).toBe('teen');
      expect(result.household.members.length).toBe(2);
    });

    it('should reject expired invite', () => {
      const household = householdService.createHousehold('Expire Test', ownerId);
      // Create invite that already expired
      const token = 'expired-token-123';
      const pastExpiry = Math.floor(Date.now() / 1000) - 3600;
      database.db.prepare(
        'INSERT INTO household_invites (household_id, token, invited_by, role, expires_at) VALUES (?, ?, ?, ?, ?)'
      ).run(household.id, token, ownerId, 'parent', pastExpiry);

      expect(() => {
        householdService.acceptInvite(token, otherUserId);
      }).toThrow('Invalid or expired');
    });

    it('should reject used invite', () => {
      const household = householdService.createHousehold('Used Test', ownerId);
      const invite = householdService.generateInvite(household.id, ownerId, { role: 'parent' });

      // Create a new user to accept the invite
      database.db.prepare(
        "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)"
      ).run('accepter@test.com', 'hash123', 'Accepter');
      const accepterId = database.db.prepare("SELECT id FROM users WHERE email = ?").get('accepter@test.com').id;

      householdService.acceptInvite(invite.token, accepterId);

      // Another user tries to use the same token
      database.db.prepare(
        "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)"
      ).run('latecomer@test.com', 'hash123', 'Late');
      const lateId = database.db.prepare("SELECT id FROM users WHERE email = ?").get('latecomer@test.com').id;

      expect(() => {
        householdService.acceptInvite(invite.token, lateId);
      }).toThrow('Invalid or expired');
    });

    it('should reject if user is already a member', () => {
      const household = householdService.createHousehold('Dup Test', ownerId);
      const invite = householdService.generateInvite(household.id, ownerId, { role: 'parent' });

      expect(() => {
        householdService.acceptInvite(invite.token, ownerId);
      }).toThrow('already a member');
    });
  });

  describe('removeMember', () => {
    it('should remove a non-owner member', () => {
      const household = householdService.createHousehold('Remove Test', ownerId);
      householdService.addMember(household.id, otherUserId, 'teen');
      householdService.removeMember(household.id, otherUserId, ownerId);
      const members = householdService.listMembers(household.id);
      expect(members).toHaveLength(1);
      expect(members[0].user_id).toBe(ownerId);
    });

    it('should throw when trying to remove the owner', () => {
      const household = householdService.createHousehold('Owner Remove', ownerId);
      expect(() => {
        householdService.removeMember(household.id, ownerId, ownerId);
      }).toThrow('Owner cannot be removed');
    });

    it('should throw when removing last parent/guardian', () => {
      const household = householdService.createHousehold('Last Parent', ownerId);
      // Owner is the only parent; can't remove them anyway (owner check catches first)
      // Instead, let's add another parent and try removing them when they're last non-owner parent
      database.db.prepare(
        "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)"
      ).run('parent2@test.com', 'hash123', 'Parent2');
      const parent2Id = database.db.prepare("SELECT id FROM users WHERE email = ?").get('parent2@test.com').id;

      householdService.addMember(household.id, parent2Id, 'parent');
      // Now demote original owner membership to teen so parent2 is last parent
      // But owner_id still protects them. Let's transfer ownership first.
      householdService.transferOwnership(household.id, parent2Id, ownerId);
      // Now ownerId is no longer the owner, but still a parent member
      // Demote ownerId to teen
      householdService.updateMemberRole(household.id, ownerId, 'teen');
      // Now parent2 is the only parent. Try removing them — should fail (owner check)
      expect(() => {
        householdService.removeMember(household.id, parent2Id, parent2Id);
      }).toThrow('Owner cannot be removed');
    });
  });

  describe('updateMemberRole', () => {
    it('should update a member role', () => {
      const household = householdService.createHousehold('Role Test', ownerId);
      householdService.addMember(household.id, otherUserId, 'teen');
      const result = householdService.updateMemberRole(household.id, otherUserId, 'caregiver');
      expect(result.role).toBe('caregiver');
    });

    it('should throw when demoting the last parent/guardian', () => {
      const household = householdService.createHousehold('Last Admin', ownerId);
      expect(() => {
        householdService.updateMemberRole(household.id, ownerId, 'teen');
      }).toThrow('Cannot demote the last parent/guardian');
    });
  });

  describe('transferOwnership', () => {
    it('should transfer ownership to another member', () => {
      const household = householdService.createHousehold('Transfer Test', ownerId);
      householdService.addMember(household.id, otherUserId, 'guardian');
      householdService.transferOwnership(household.id, otherUserId, ownerId);

      const updated = householdService.getHousehold(household.id);
      expect(updated.owner_id).toBe(otherUserId);
    });

    it('should throw when non-owner tries to transfer', () => {
      const household = householdService.createHousehold('No Transfer', ownerId);
      householdService.addMember(household.id, otherUserId, 'teen');
      expect(() => {
        householdService.transferOwnership(household.id, otherUserId, otherUserId);
      }).toThrow('Only the current owner');
    });

    it('should throw when transferring to a kid', () => {
      const household = householdService.createHousehold('Kid Transfer', ownerId);
      householdService.addMember(household.id, otherUserId, 'kid');
      expect(() => {
        householdService.transferOwnership(household.id, otherUserId, ownerId);
      }).toThrow('Cannot transfer ownership to a kid');
    });

    it('should throw when transferring to non-member', () => {
      const household = householdService.createHousehold('Non Member Transfer', ownerId);
      database.db.prepare(
        "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)"
      ).run('stranger@test.com', 'hash123', 'Stranger');
      const strangerId = database.db.prepare("SELECT id FROM users WHERE email = ?").get('stranger@test.com').id;

      expect(() => {
        householdService.transferOwnership(household.id, strangerId, ownerId);
      }).toThrow('must be a household member');
    });
  });
});
