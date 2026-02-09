import crypto from 'crypto';
import database from '../config/database.js';
import logger from './logger.js';

const INVITE_TOKEN_BYTES = 32;
const INVITE_TTL_HOURS = 48;

function createHousehold(name, ownerId) {
  const result = database.db.prepare(
    'INSERT INTO households (name, owner_id) VALUES (?, ?)'
  ).run(name, ownerId);

  const householdId = result.lastInsertRowid;

  // Auto-add owner as parent member
  database.db.prepare(
    'INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)'
  ).run(householdId, ownerId, 'parent');

  logger.info('household', 'created', { householdId, ownerId });
  return { id: householdId, name, owner_id: ownerId };
}

function getHousehold(id) {
  const household = database.db.prepare(
    'SELECT * FROM households WHERE id = ?'
  ).get(id);
  if (!household) return null;

  const members = database.db.prepare(`
    SELECT hm.*, u.email, u.display_name, p.avatar_url, p.pronouns
    FROM household_members hm
    JOIN users u ON u.id = hm.user_id
    LEFT JOIN profiles p ON p.user_id = hm.user_id
    WHERE hm.household_id = ?
  `).all(id);

  return { ...household, members };
}

function updateHousehold(id, { name }) {
  database.db.prepare(
    'UPDATE households SET name = ?, updated_at = unixepoch() WHERE id = ?'
  ).run(name, id);

  logger.info('household', 'updated', { householdId: id });
  return getHousehold(id);
}

function deleteHousehold(id, requesterId) {
  const household = database.db.prepare(
    'SELECT * FROM households WHERE id = ?'
  ).get(id);

  if (!household) throw new Error('Household not found');
  if (household.owner_id !== requesterId) {
    throw new Error('Only the owner can delete a household');
  }

  database.db.prepare('DELETE FROM households WHERE id = ?').run(id);
  logger.info('household', 'deleted', { householdId: id, deletedBy: requesterId });
}

function listUserHouseholds(userId) {
  return database.db.prepare(`
    SELECT h.*, hm.role
    FROM household_members hm
    JOIN households h ON h.id = hm.household_id
    WHERE hm.user_id = ?
  `).all(userId);
}

function generateInvite(householdId, invitedBy, { email, role = 'parent', expiresInHours = INVITE_TTL_HOURS } = {}) {
  const token = crypto.randomBytes(INVITE_TOKEN_BYTES).toString('hex');
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInHours * 60 * 60;

  database.db.prepare(`
    INSERT INTO household_invites (household_id, token, invited_by, invited_email, role, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(householdId, token, invitedBy, email || null, role, expiresAt);

  logger.info('household', 'invite_generated', { householdId, invitedBy, role });
  return { token, expiresAt };
}

function acceptInvite(token, userId) {
  const now = Math.floor(Date.now() / 1000);
  const invite = database.db.prepare(`
    SELECT * FROM household_invites
    WHERE token = ? AND used_at IS NULL AND expires_at > ?
  `).get(token, now);

  if (!invite) throw new Error('Invalid or expired invite token');

  // Check if already a member
  const existing = database.db.prepare(
    'SELECT id FROM household_members WHERE household_id = ? AND user_id = ?'
  ).get(invite.household_id, userId);

  if (existing) throw new Error('User is already a member of this household');

  // Add member
  database.db.prepare(
    'INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)'
  ).run(invite.household_id, userId, invite.role);

  // Mark invite as used
  database.db.prepare(
    'UPDATE household_invites SET used_at = unixepoch() WHERE id = ?'
  ).run(invite.id);

  const household = getHousehold(invite.household_id);
  logger.info('household', 'invite_accepted', { householdId: invite.household_id, userId, role: invite.role });
  return { household, role: invite.role };
}

function revokeInvite(inviteId) {
  database.db.prepare('DELETE FROM household_invites WHERE id = ?').run(inviteId);
  logger.info('household', 'invite_revoked', { inviteId });
}

function addMember(householdId, userId, role) {
  database.db.prepare(
    'INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)'
  ).run(householdId, userId, role);

  logger.info('household', 'member_added', { householdId, userId, role });
  return { household_id: householdId, user_id: userId, role };
}

function removeMember(householdId, userId, requesterId) {
  const household = database.db.prepare(
    'SELECT * FROM households WHERE id = ?'
  ).get(householdId);
  if (!household) throw new Error('Household not found');

  // Cannot remove yourself if you're the owner
  if (userId === household.owner_id) {
    throw new Error('Owner cannot be removed. Transfer ownership first.');
  }

  // Check if removing the last parent/guardian
  const member = database.db.prepare(
    'SELECT role FROM household_members WHERE household_id = ? AND user_id = ?'
  ).get(householdId, userId);
  if (!member) throw new Error('Member not found');

  if (member.role === 'parent' || member.role === 'guardian') {
    const adminCount = database.db.prepare(
      "SELECT COUNT(*) as count FROM household_members WHERE household_id = ? AND role IN ('parent', 'guardian')"
    ).get(householdId).count;

    if (adminCount <= 1) {
      throw new Error('Cannot remove the last parent/guardian');
    }
  }

  database.db.prepare(
    'DELETE FROM household_members WHERE household_id = ? AND user_id = ?'
  ).run(householdId, userId);

  logger.info('household', 'member_removed', { householdId, userId, removedBy: requesterId });
}

function updateMemberRole(householdId, userId, newRole) {
  const household = database.db.prepare(
    'SELECT * FROM households WHERE id = ?'
  ).get(householdId);
  if (!household) throw new Error('Household not found');

  const member = database.db.prepare(
    'SELECT role FROM household_members WHERE household_id = ? AND user_id = ?'
  ).get(householdId, userId);
  if (!member) throw new Error('Member not found');

  // Cannot demote the last parent/guardian
  if ((member.role === 'parent' || member.role === 'guardian') &&
      newRole !== 'parent' && newRole !== 'guardian') {
    const adminCount = database.db.prepare(
      "SELECT COUNT(*) as count FROM household_members WHERE household_id = ? AND role IN ('parent', 'guardian')"
    ).get(householdId).count;

    if (adminCount <= 1) {
      throw new Error('Cannot demote the last parent/guardian');
    }
  }

  database.db.prepare(
    'UPDATE household_members SET role = ? WHERE household_id = ? AND user_id = ?'
  ).run(newRole, householdId, userId);

  logger.info('household', 'role_updated', { householdId, userId, newRole });
  return { household_id: householdId, user_id: userId, role: newRole };
}

function listMembers(householdId) {
  return database.db.prepare(`
    SELECT hm.user_id, hm.role, hm.joined_at, u.email, u.display_name,
           p.avatar_url, p.pronouns
    FROM household_members hm
    JOIN users u ON u.id = hm.user_id
    LEFT JOIN profiles p ON p.user_id = hm.user_id
    WHERE hm.household_id = ?
  `).all(householdId);
}

function transferOwnership(householdId, newOwnerId, requesterId) {
  const household = database.db.prepare(
    'SELECT * FROM households WHERE id = ?'
  ).get(householdId);
  if (!household) throw new Error('Household not found');
  if (household.owner_id !== requesterId) {
    throw new Error('Only the current owner can transfer ownership');
  }

  // New owner must be a member
  const newOwnerMember = database.db.prepare(
    'SELECT role FROM household_members WHERE household_id = ? AND user_id = ?'
  ).get(householdId, newOwnerId);
  if (!newOwnerMember) throw new Error('New owner must be a household member');

  // Cannot transfer to kid
  if (newOwnerMember.role === 'kid') {
    throw new Error('Cannot transfer ownership to a kid account');
  }

  database.db.prepare(
    'UPDATE households SET owner_id = ?, updated_at = unixepoch() WHERE id = ?'
  ).run(newOwnerId, householdId);

  // Ensure new owner has parent role
  database.db.prepare(
    "UPDATE household_members SET role = 'parent' WHERE household_id = ? AND user_id = ?"
  ).run(householdId, newOwnerId);

  logger.info('household', 'ownership_transferred', { householdId, from: requesterId, to: newOwnerId });
}

export default {
  createHousehold,
  getHousehold,
  updateHousehold,
  deleteHousehold,
  listUserHouseholds,
  generateInvite,
  acceptInvite,
  revokeInvite,
  addMember,
  removeMember,
  updateMemberRole,
  listMembers,
  transferOwnership,
};
