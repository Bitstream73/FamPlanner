import { Router } from 'express';
import notificationService from '../../../services/notification-service.js';
import quietHoursService from '../../../services/quiet-hours-service.js';
import { requireAuth } from '../../../middleware/requireAuth.js';

const router = Router();

router.get('/', requireAuth, (req, res, next) => {
  try {
    const { unreadOnly, limit, offset } = req.query;
    const result = notificationService.list(req.user.id, {
      unreadOnly: unreadOnly === 'true',
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    res.json({ data: result.notifications, total: result.total, unreadCount: result.unreadCount });
  } catch (err) { next(err); }
});

router.put('/:notificationId/read', requireAuth, (req, res, next) => {
  try {
    const notification = notificationService.markRead(parseInt(req.params.notificationId, 10), req.user.id);
    res.json({ data: notification });
  } catch (err) { next(err); }
});

router.post('/read-all', requireAuth, (req, res, next) => {
  try {
    const { householdId } = req.body;
    const count = notificationService.markAllRead(req.user.id, householdId ? parseInt(householdId, 10) : undefined);
    res.json({ data: { marked: count } });
  } catch (err) { next(err); }
});

router.delete('/:notificationId', requireAuth, (req, res, next) => {
  try {
    notificationService.remove(parseInt(req.params.notificationId, 10), req.user.id);
    res.json({ data: { message: 'Notification deleted' } });
  } catch (err) { next(err); }
});

// Quiet hours / preferences
router.get('/preferences/:householdId', requireAuth, (req, res, next) => {
  try {
    const hours = quietHoursService.getQuietHours(req.user.id, parseInt(req.params.householdId, 10));
    res.json({ data: hours });
  } catch (err) { next(err); }
});

router.put('/preferences/:householdId', requireAuth, (req, res, next) => {
  try {
    const { quietStart, quietEnd } = req.body;
    if (!quietStart || !quietEnd) {
      return res.status(400).json({ error: 'quietStart and quietEnd are required', code: 'VALIDATION_ERROR' });
    }

    const hours = quietHoursService.setQuietHours(req.user.id, parseInt(req.params.householdId, 10), quietStart, quietEnd);
    res.json({ data: hours });
  } catch (err) { next(err); }
});

export default router;
