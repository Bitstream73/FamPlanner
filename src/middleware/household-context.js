import database from '../config/database.js';

function householdContext(req, res, next) {
  const householdId = parseInt(req.params.householdId, 10);
  if (!householdId || isNaN(householdId)) {
    return res.status(400).json({ error: 'Invalid household ID', code: 'VALIDATION_ERROR' });
  }

  const household = database.db.prepare('SELECT * FROM households WHERE id = ?').get(householdId);
  if (!household) {
    return res.status(404).json({ error: 'Household not found', code: 'NOT_FOUND' });
  }

  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
  }

  const member = database.db.prepare(
    'SELECT role FROM household_members WHERE household_id = ? AND user_id = ?'
  ).get(householdId, req.user.id);

  if (!member) {
    return res.status(403).json({ error: 'Not a member of this household', code: 'PERMISSION_DENIED' });
  }

  req.household = household;
  req.householdId = householdId;
  req.memberRole = member.role;
  next();
}

export default householdContext;
