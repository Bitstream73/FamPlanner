import { Router } from 'express';
import exportService from '../../../services/export-service.js';
import { requireAuth } from '../../../middleware/requireAuth.js';
import householdContext from '../../../middleware/household-context.js';

const router = Router();

router.get('/:householdId/export/tasks', requireAuth, householdContext, (req, res, next) => {
  try {
    const result = exportService.exportTasks(req.householdId);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  } catch (err) { next(err); }
});

router.get('/:householdId/export/events', requireAuth, householdContext, (req, res, next) => {
  try {
    const result = exportService.exportEvents(req.householdId);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  } catch (err) { next(err); }
});

export default router;
