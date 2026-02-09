import permissionService from '../services/permission-service.js';

function requirePermission(action) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
    }

    if (!req.householdId) {
      return res.status(400).json({ error: 'Household context required', code: 'VALIDATION_ERROR' });
    }

    if (!permissionService.canPerform(req.user.id, req.householdId, action)) {
      return res.status(403).json({ error: 'Insufficient permissions', code: 'PERMISSION_DENIED' });
    }

    next();
  };
}

export default requirePermission;
