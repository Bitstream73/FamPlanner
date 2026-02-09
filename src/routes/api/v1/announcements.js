import { Router } from 'express';
import announcementService from '../../../services/announcement-service.js';
import { requireAuth } from '../../../middleware/requireAuth.js';
import householdContext from '../../../middleware/household-context.js';
import requirePermission from '../../../middleware/require-permission.js';

const router = Router();

router.post('/:householdId/announcements', requireAuth, householdContext, (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content || content.length > 5000) {
      return res.status(400).json({ error: 'Content is required (max 5000 chars)', code: 'VALIDATION_ERROR' });
    }

    const announcement = announcementService.create(req.householdId, req.user.id, content);
    res.status(201).json({ data: announcement });
  } catch (err) { next(err); }
});

router.get('/:householdId/announcements', requireAuth, householdContext, (req, res, next) => {
  try {
    const { limit, offset } = req.query;
    const result = announcementService.list(req.householdId, {
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    res.json({ data: result.announcements, total: result.total });
  } catch (err) { next(err); }
});

router.get('/:householdId/announcements/pinned', requireAuth, householdContext, (req, res, next) => {
  try {
    const pinned = announcementService.getPinned(req.householdId);
    res.json({ data: pinned });
  } catch (err) { next(err); }
});

router.put('/:householdId/announcements/:announcementId', requireAuth, householdContext, (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content || content.length > 5000) {
      return res.status(400).json({ error: 'Content is required (max 5000 chars)', code: 'VALIDATION_ERROR' });
    }

    const announcement = announcementService.update(parseInt(req.params.announcementId, 10), content);
    res.json({ data: announcement });
  } catch (err) { next(err); }
});

router.delete('/:householdId/announcements/:announcementId', requireAuth, householdContext, requirePermission('delete_entity'), (req, res, next) => {
  try {
    announcementService.remove(parseInt(req.params.announcementId, 10));
    res.json({ data: { message: 'Announcement deleted' } });
  } catch (err) { next(err); }
});

router.post('/:householdId/announcements/:announcementId/pin', requireAuth, householdContext, requirePermission('manage_members'), (req, res, next) => {
  try {
    const announcement = announcementService.pin(parseInt(req.params.announcementId, 10));
    res.json({ data: announcement });
  } catch (err) { next(err); }
});

router.post('/:householdId/announcements/:announcementId/unpin', requireAuth, householdContext, requirePermission('manage_members'), (req, res, next) => {
  try {
    const announcement = announcementService.unpin(parseInt(req.params.announcementId, 10));
    res.json({ data: announcement });
  } catch (err) { next(err); }
});

export default router;
