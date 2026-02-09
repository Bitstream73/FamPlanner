import { Router } from 'express';
import householdService from '../../../services/household-service.js';
import profileService from '../../../services/profile-service.js';
import { requireAuth } from '../../../middleware/requireAuth.js';
import householdContext from '../../../middleware/household-context.js';
import requirePermission from '../../../middleware/require-permission.js';
const router = Router();

const MAX_NAME_LENGTH = 200;

// Profile routes (must be before /:householdId to avoid param matching)
// GET /api/v1/households/profile
router.get('/profile', requireAuth, (req, res, next) => {
  try {
    const profile = profileService.getProfile(req.user.id);
    res.json({ data: profile });
  } catch (err) { next(err); }
});

// PUT /api/v1/households/profile
router.put('/profile', requireAuth, (req, res, next) => {
  try {
    const { displayName, avatarUrl, pronouns } = req.body;
    const profile = profileService.updateProfile(req.user.id, { displayName, avatarUrl, pronouns });
    res.json({ data: profile });
  } catch (err) { next(err); }
});

// POST /api/v1/households/join — Accept invite (must be before /:householdId)
router.post('/join', requireAuth, (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token is required', code: 'VALIDATION_ERROR' });
    }

    const result = householdService.acceptInvite(token, req.user.id);
    res.json({ data: result });
  } catch (err) {
    if (err.message.includes('Invalid or expired') || err.message.includes('already a member')) {
      return res.status(409).json({ error: err.message, code: 'CONFLICT' });
    }
    next(err);
  }
});

// POST /api/v1/households — Create household
router.post('/', requireAuth, (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || name.length > MAX_NAME_LENGTH) {
      return res.status(400).json({ error: 'Name is required (max 200 chars)', code: 'VALIDATION_ERROR' });
    }

    const household = householdService.createHousehold(name, req.user.id);
    res.status(201).json({ data: household });
  } catch (err) { next(err); }
});

// GET /api/v1/households — List user's households
router.get('/', requireAuth, (req, res, next) => {
  try {
    const households = householdService.listUserHouseholds(req.user.id);
    res.json({ data: households });
  } catch (err) { next(err); }
});

// GET /api/v1/households/:householdId — Get household details
router.get('/:householdId', requireAuth, householdContext, (req, res, next) => {
  try {
    const household = householdService.getHousehold(req.householdId);
    res.json({ data: household });
  } catch (err) { next(err); }
});

// PUT /api/v1/households/:householdId — Update household
router.put('/:householdId', requireAuth, householdContext, requirePermission('manage_members'), (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || name.length > MAX_NAME_LENGTH) {
      return res.status(400).json({ error: 'Name is required (max 200 chars)', code: 'VALIDATION_ERROR' });
    }

    const household = householdService.updateHousehold(req.householdId, { name });
    res.json({ data: household });
  } catch (err) { next(err); }
});

// DELETE /api/v1/households/:householdId — Delete household (owner only)
router.delete('/:householdId', requireAuth, householdContext, (req, res, next) => {
  try {
    householdService.deleteHousehold(req.householdId, req.user.id);
    res.json({ data: { message: 'Household deleted' } });
  } catch (err) {
    if (err.message.includes('Only the owner')) {
      return res.status(403).json({ error: err.message, code: 'PERMISSION_DENIED' });
    }
    next(err);
  }
});

// POST /api/v1/households/:householdId/invite — Generate invite
router.post('/:householdId/invite', requireAuth, householdContext, requirePermission('manage_members'), (req, res, next) => {
  try {
    const { email, role } = req.body;
    const invite = householdService.generateInvite(req.householdId, req.user.id, { email, role });
    res.status(201).json({ data: invite });
  } catch (err) { next(err); }
});

// GET /api/v1/households/:householdId/members — List members
router.get('/:householdId/members', requireAuth, householdContext, (req, res, next) => {
  try {
    const members = householdService.listMembers(req.householdId);
    res.json({ data: members });
  } catch (err) { next(err); }
});

// PUT /api/v1/households/:householdId/members/:userId — Update member role
router.put('/:householdId/members/:userId', requireAuth, householdContext, requirePermission('manage_members'), (req, res, next) => {
  try {
    const { role } = req.body;
    const validRoles = ['parent', 'guardian', 'teen', 'kid', 'caregiver'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ error: 'Valid role is required', code: 'VALIDATION_ERROR' });
    }

    const targetUserId = parseInt(req.params.userId, 10);
    const member = householdService.updateMemberRole(req.householdId, targetUserId, role);
    res.json({ data: member });
  } catch (err) {
    if (err.message.includes('Cannot demote')) {
      return res.status(400).json({ error: err.message, code: 'VALIDATION_ERROR' });
    }
    next(err);
  }
});

// DELETE /api/v1/households/:householdId/members/:userId — Remove member
router.delete('/:householdId/members/:userId', requireAuth, householdContext, requirePermission('manage_members'), (req, res, next) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    householdService.removeMember(req.householdId, targetUserId, req.user.id);
    res.json({ data: { message: 'Member removed' } });
  } catch (err) {
    if (err.message.includes('Owner cannot') || err.message.includes('Cannot remove')) {
      return res.status(400).json({ error: err.message, code: 'VALIDATION_ERROR' });
    }
    next(err);
  }
});

export default router;
