import { Router } from 'express';
import calendarService from '../../../services/calendar-service.js';
import availabilityService from '../../../services/availability-service.js';
import conflictService from '../../../services/conflict-service.js';
import { requireAuth } from '../../../middleware/requireAuth.js';
import householdContext from '../../../middleware/household-context.js';
import requirePermission from '../../../middleware/require-permission.js';

const router = Router();

// Events
router.post('/:householdId/events', requireAuth, householdContext, requirePermission('edit_calendar'), (req, res, next) => {
  try {
    const { title, location, description, startTime, endTime, responsibleUserId, recurrenceRule } = req.body;
    if (!title || !startTime || !endTime) {
      return res.status(400).json({ error: 'Title, startTime, and endTime are required', code: 'VALIDATION_ERROR' });
    }

    if (recurrenceRule === 'weekly') {
      const events = calendarService.createRecurringSeries(req.householdId, {
        title, location, description, startTime, endTime, responsibleUserId, createdBy: req.user.id,
      }, recurrenceRule);
      return res.status(201).json({ data: events });
    }

    const event = calendarService.createEvent(req.householdId, {
      title, location, description, startTime, endTime, responsibleUserId, createdBy: req.user.id,
    });
    res.status(201).json({ data: event });
  } catch (err) { next(err); }
});

router.get('/:householdId/events', requireAuth, householdContext, (req, res, next) => {
  try {
    const { start, end } = req.query;
    if (start && end) {
      const events = calendarService.getWeekView(req.householdId, parseInt(start, 10));
      return res.json({ data: events });
    }
    const events = calendarService.getMonthView(req.householdId, new Date().getFullYear(), new Date().getMonth() + 1);
    res.json({ data: events });
  } catch (err) { next(err); }
});

router.get('/:householdId/events/day/:date', requireAuth, householdContext, (req, res, next) => {
  try {
    const events = calendarService.getDayView(req.householdId, parseInt(req.params.date, 10));
    res.json({ data: events });
  } catch (err) { next(err); }
});

router.get('/:householdId/events/week/:startDate', requireAuth, householdContext, (req, res, next) => {
  try {
    const events = calendarService.getWeekView(req.householdId, parseInt(req.params.startDate, 10));
    res.json({ data: events });
  } catch (err) { next(err); }
});

router.get('/:householdId/events/month/:year/:month', requireAuth, householdContext, (req, res, next) => {
  try {
    const events = calendarService.getMonthView(req.householdId, parseInt(req.params.year, 10), parseInt(req.params.month, 10));
    res.json({ data: events });
  } catch (err) { next(err); }
});

router.get('/:householdId/events/:eventId', requireAuth, householdContext, (req, res, next) => {
  try {
    const event = calendarService.getEvent(parseInt(req.params.eventId, 10));
    if (!event) return res.status(404).json({ error: 'Event not found', code: 'NOT_FOUND' });
    res.json({ data: event });
  } catch (err) { next(err); }
});

router.put('/:householdId/events/:eventId', requireAuth, householdContext, requirePermission('edit_calendar'), (req, res, next) => {
  try {
    const event = calendarService.updateEvent(parseInt(req.params.eventId, 10), req.body);
    res.json({ data: event });
  } catch (err) { next(err); }
});

router.delete('/:householdId/events/:eventId', requireAuth, householdContext, requirePermission('delete_entity'), (req, res, next) => {
  try {
    calendarService.deleteEvent(parseInt(req.params.eventId, 10));
    res.json({ data: { message: 'Event deleted' } });
  } catch (err) { next(err); }
});

// Conflicts
router.get('/:householdId/events/conflicts/check', requireAuth, householdContext, (req, res, next) => {
  try {
    const { startTime, endTime, excludeEventId } = req.query;
    const conflicts = conflictService.detectConflicts(
      req.householdId, parseInt(startTime, 10), parseInt(endTime, 10),
      excludeEventId ? parseInt(excludeEventId, 10) : undefined
    );
    res.json({ data: conflicts });
  } catch (err) { next(err); }
});

// Availability
router.post('/:householdId/availability', requireAuth, householdContext, (req, res, next) => {
  try {
    const { startTime, endTime, reason, recurringDay } = req.body;
    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'startTime and endTime are required', code: 'VALIDATION_ERROR' });
    }

    const block = availabilityService.createBlock(req.user.id, req.householdId, { startTime, endTime, reason, recurringDay });
    res.status(201).json({ data: block });
  } catch (err) { next(err); }
});

router.get('/:householdId/availability', requireAuth, householdContext, (req, res, next) => {
  try {
    const { start, end } = req.query;
    const result = availabilityService.getHouseholdAvailability(
      req.householdId, parseInt(start, 10) || 0, parseInt(end, 10) || Math.floor(Date.now() / 1000) + 86400 * 30
    );
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.get('/:householdId/availability/me', requireAuth, householdContext, (req, res, next) => {
  try {
    const { start, end } = req.query;
    const blocks = availabilityService.getUserAvailability(
      req.user.id, req.householdId, parseInt(start, 10) || 0, parseInt(end, 10) || Math.floor(Date.now() / 1000) + 86400 * 30
    );
    res.json({ data: blocks });
  } catch (err) { next(err); }
});

router.put('/:householdId/availability/:blockId', requireAuth, householdContext, (req, res, next) => {
  try {
    const block = availabilityService.updateBlock(parseInt(req.params.blockId, 10), req.body);
    res.json({ data: block });
  } catch (err) { next(err); }
});

router.delete('/:householdId/availability/:blockId', requireAuth, householdContext, (req, res, next) => {
  try {
    availabilityService.deleteBlock(parseInt(req.params.blockId, 10));
    res.json({ data: { message: 'Block deleted' } });
  } catch (err) { next(err); }
});

export default router;
