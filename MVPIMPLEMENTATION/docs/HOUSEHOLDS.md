# Households, Accounts & Roles — Spec

## Overview

A household is the core organizational unit. Users belong to one or more households with specific roles. Roles determine permissions. Inspired by Quinyx's organization/department model adapted for families.

## Roles

| Role | Can Assign Tasks | Can Edit Calendar | Can Delete | Can Manage Members | Can View All |
|------|:---:|:---:|:---:|:---:|:---:|
| parent | Yes | Yes | Yes | Yes | Yes |
| guardian | Yes | Yes | Yes | Yes | Yes |
| teen | Self only | Yes | Own only | No | Yes |
| kid | No | No | No | No | Limited |
| caregiver | Yes | Yes | No | No | Yes |

- `parent` and `guardian` are functionally identical (full access)
- `teen` can create/complete own tasks, view everything, edit calendar events
- `kid` can view assigned tasks and calendar, complete tasks, no editing/deleting
- `caregiver` is temporary access — can assign tasks, edit calendar, but not delete or manage members

## Household Service API

```js
// src/services/household-service.js
class HouseholdService {
  constructor(db) {}

  createHousehold(name, ownerId) → { id, name, owner_id }
  getHousehold(id) → household with members
  updateHousehold(id, { name }) → updated household
  deleteHousehold(id, requesterId) → void (owner only)

  listUserHouseholds(userId) → [{ household, role }]

  generateInvite(householdId, invitedBy, { email, role, expiresIn }) → { token, url }
  acceptInvite(token, userId) → { household, role }
  revokeInvite(inviteId, requesterId) → void

  addMember(householdId, userId, role) → member
  removeMember(householdId, userId, requesterId) → void
  updateMemberRole(householdId, userId, newRole, requesterId) → member
  listMembers(householdId) → [{ user, role, joined_at }]

  transferOwnership(householdId, newOwnerId, requesterId) → void
}
```

## Invite Flow

1. Parent/Guardian calls `generateInvite` with optional email and role
2. System generates 32-byte crypto random token, stores with 48h expiry
3. If email provided, send invite email via Resend with link: `/join?token=xxx`
4. Recipient opens link, authenticates (or registers), then calls `acceptInvite`
5. System validates: token exists, not expired, not used → adds member with role
6. Token marked as used (cannot be reused)

## Permission Engine

```js
// src/services/permission-service.js
class PermissionService {
  constructor(db) {}

  // Returns true/false — always check server-side
  canPerform(userId, householdId, action) → boolean

  // Actions:
  // 'assign_task', 'edit_calendar', 'delete_entity',
  // 'manage_members', 'view_all', 'create_announcement',
  // 'edit_handbook', 'export_data'

  getMemberRole(userId, householdId) → role string
  requirePermission(userId, householdId, action) → void (throws 403 if denied)
}
```

## Profile Service

```js
// src/services/profile-service.js
class ProfileService {
  constructor(db) {}

  getProfile(userId) → { user_id, display_name, avatar_url, pronouns }
  updateProfile(userId, { displayName, avatarUrl, pronouns }) → profile
  getHouseholdProfiles(householdId) → [profiles]
}
```

## Security Rules

- Invite tokens: 32 bytes from `crypto.randomBytes`, hex-encoded
- Tokens expire after 48 hours, single-use
- Only parent/guardian can manage members or transfer ownership
- Owner cannot remove themselves (must transfer ownership first)
- Cannot demote the last parent/guardian in a household
- Kid accounts cannot be household owners
- All permission checks are server-side in middleware, never trust client

## Test Expectations

- Create household → owner added as 'parent' member automatically
- Generate invite → valid token, correct expiry
- Accept invite → member added with correct role
- Expired/used token → rejection with clear error
- Role permissions matrix matches table above
- Cannot remove last parent/guardian
- Cannot transfer ownership to kid role
- Profile CRUD works with all fields optional except user_id
