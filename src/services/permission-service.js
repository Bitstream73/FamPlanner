import database from '../config/database.js';

const ROLE_PERMISSIONS = {
  parent: ['assign_task', 'edit_calendar', 'delete_entity', 'manage_members', 'view_all', 'create_announcement', 'edit_handbook', 'export_data'],
  guardian: ['assign_task', 'edit_calendar', 'delete_entity', 'manage_members', 'view_all', 'create_announcement', 'edit_handbook', 'export_data'],
  teen: ['assign_task_self', 'edit_calendar', 'delete_own', 'view_all', 'create_announcement', 'edit_handbook'],
  kid: ['view_assigned', 'complete_task'],
  caregiver: ['assign_task', 'edit_calendar', 'view_all', 'create_announcement', 'edit_handbook'],
};

function getMemberRole(userId, householdId) {
  const member = database.db.prepare(
    'SELECT role FROM household_members WHERE user_id = ? AND household_id = ?'
  ).get(userId, householdId);

  return member ? member.role : null;
}

function canPerform(userId, householdId, action) {
  const role = getMemberRole(userId, householdId);
  if (!role) return false;

  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;

  return permissions.includes(action);
}

function requirePermission(userId, householdId, action) {
  if (!canPerform(userId, householdId, action)) {
    const error = new Error(`Permission denied: ${action}`);
    error.statusCode = 403;
    throw error;
  }
}

export default {
  canPerform,
  getMemberRole,
  requirePermission,
  ROLE_PERMISSIONS,
};
