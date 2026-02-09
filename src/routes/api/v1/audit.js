import { Router } from 'express';
import auditService from '../../../services/audit-service.js';
import { requireAuth } from '../../../middleware/requireAuth.js';
import householdContext from '../../../middleware/household-context.js';
import requirePermission from '../../../middleware/require-permission.js';

const router = Router();

router.get('/:householdId/audit', requireAuth, householdContext, requirePermission('manage_members'), (req, res, next) => {
  try {
    const { userId, entityType, action, start, end, limit, offset } = req.query;
    const result = auditService.query(req.householdId, {
      userId: userId ? parseInt(userId, 10) : undefined,
      entityType,
      action,
      startDate: start ? parseInt(start, 10) : undefined,
      endDate: end ? parseInt(end, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    res.json({ data: result.entries, total: result.total });
  } catch (err) { next(err); }
});

export default router;
