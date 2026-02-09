import { Router } from 'express';
import handbookService from '../../../services/handbook-service.js';
import { requireAuth } from '../../../middleware/requireAuth.js';
import householdContext from '../../../middleware/household-context.js';
import requirePermission from '../../../middleware/require-permission.js';

const router = Router();

router.post('/:householdId/handbook', requireAuth, householdContext, (req, res, next) => {
  try {
    const { title, content, entryType, steps, imageUrls, isPinned } = req.body;
    if (!title || title.length > 200) {
      return res.status(400).json({ error: 'Title is required (max 200 chars)', code: 'VALIDATION_ERROR' });
    }

    let entry;
    if (entryType === 'howto') {
      entry = handbookService.createHowTo(req.householdId, {
        title, content, steps, imageUrls, createdBy: req.user.id,
      });
    } else {
      entry = handbookService.createNote(req.householdId, {
        title, content, isPinned, createdBy: req.user.id,
      });
    }

    res.status(201).json({ data: entry });
  } catch (err) { next(err); }
});

router.get('/:householdId/handbook', requireAuth, householdContext, (req, res, next) => {
  try {
    const { type, limit, offset } = req.query;
    const result = handbookService.listEntries(req.householdId, {
      type,
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    res.json({ data: result.entries, total: result.total });
  } catch (err) { next(err); }
});

router.get('/:householdId/handbook/pinned', requireAuth, householdContext, (req, res, next) => {
  try {
    const entries = handbookService.getPinnedEntries(req.householdId);
    res.json({ data: entries });
  } catch (err) { next(err); }
});

router.get('/:householdId/handbook/search', requireAuth, householdContext, (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Search query is required', code: 'VALIDATION_ERROR' });
    const entries = handbookService.searchEntries(req.householdId, q);
    res.json({ data: entries });
  } catch (err) { next(err); }
});

router.get('/:householdId/handbook/:entryId', requireAuth, householdContext, (req, res, next) => {
  try {
    const entry = handbookService.getEntry(parseInt(req.params.entryId, 10));
    if (!entry) return res.status(404).json({ error: 'Entry not found', code: 'NOT_FOUND' });
    res.json({ data: entry });
  } catch (err) { next(err); }
});

router.put('/:householdId/handbook/:entryId', requireAuth, householdContext, (req, res, next) => {
  try {
    const entry = handbookService.updateEntry(parseInt(req.params.entryId, 10), req.body);
    res.json({ data: entry });
  } catch (err) { next(err); }
});

router.delete('/:householdId/handbook/:entryId', requireAuth, householdContext, requirePermission('delete_entity'), (req, res, next) => {
  try {
    handbookService.deleteEntry(parseInt(req.params.entryId, 10));
    res.json({ data: { message: 'Entry deleted' } });
  } catch (err) { next(err); }
});

export default router;
