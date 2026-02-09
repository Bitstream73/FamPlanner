import { Router } from 'express';
import routineService from '../../../services/routine-service.js';
import { requireAuth } from '../../../middleware/requireAuth.js';
import householdContext from '../../../middleware/household-context.js';
import requirePermission from '../../../middleware/require-permission.js';

const router = Router();

router.post('/:householdId/routines', requireAuth, householdContext, requirePermission('assign_task'), (req, res, next) => {
  try {
    const { name, routineType, assignedTo, autoReset } = req.body;
    if (!name || name.length > 200) {
      return res.status(400).json({ error: 'Name is required (max 200 chars)', code: 'VALIDATION_ERROR' });
    }

    const routine = routineService.createRoutine(req.householdId, {
      name, routineType, assignedTo, autoReset, createdBy: req.user.id,
    });
    res.status(201).json({ data: routine });
  } catch (err) { next(err); }
});

router.get('/:householdId/routines', requireAuth, householdContext, (req, res, next) => {
  try {
    const { assignedTo } = req.query;
    const routines = routineService.listRoutines(
      req.householdId, assignedTo ? parseInt(assignedTo, 10) : undefined
    );
    res.json({ data: routines });
  } catch (err) { next(err); }
});

router.get('/:householdId/routines/:routineId', requireAuth, householdContext, (req, res, next) => {
  try {
    const routine = routineService.getRoutine(parseInt(req.params.routineId, 10));
    if (!routine) return res.status(404).json({ error: 'Routine not found', code: 'NOT_FOUND' });
    res.json({ data: routine });
  } catch (err) { next(err); }
});

router.put('/:householdId/routines/:routineId', requireAuth, householdContext, (req, res, next) => {
  try {
    const routine = routineService.updateRoutine(parseInt(req.params.routineId, 10), req.body);
    res.json({ data: routine });
  } catch (err) { next(err); }
});

router.delete('/:householdId/routines/:routineId', requireAuth, householdContext, requirePermission('delete_entity'), (req, res, next) => {
  try {
    routineService.deleteRoutine(parseInt(req.params.routineId, 10));
    res.json({ data: { message: 'Routine deleted' } });
  } catch (err) { next(err); }
});

// Routine steps
router.post('/:householdId/routines/:routineId/steps', requireAuth, householdContext, (req, res, next) => {
  try {
    const { title, sortOrder } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required', code: 'VALIDATION_ERROR' });
    const step = routineService.addStep(parseInt(req.params.routineId, 10), title, sortOrder);
    res.status(201).json({ data: step });
  } catch (err) { next(err); }
});

router.put('/:householdId/routines/:routineId/steps/:stepId/complete', requireAuth, householdContext, (req, res, next) => {
  try {
    const step = routineService.completeStep(parseInt(req.params.stepId, 10));
    res.json({ data: step });
  } catch (err) { next(err); }
});

router.put('/:householdId/routines/:routineId/steps/:stepId/uncomplete', requireAuth, householdContext, (req, res, next) => {
  try {
    const step = routineService.uncompleteStep(parseInt(req.params.stepId, 10));
    res.json({ data: step });
  } catch (err) { next(err); }
});

router.put('/:householdId/routines/:routineId/steps/reorder', requireAuth, householdContext, (req, res, next) => {
  try {
    const { orderedIds } = req.body;
    const steps = routineService.reorderSteps(parseInt(req.params.routineId, 10), orderedIds);
    res.json({ data: steps });
  } catch (err) { next(err); }
});

router.delete('/:householdId/routines/:routineId/steps/:stepId', requireAuth, householdContext, (req, res, next) => {
  try {
    routineService.removeStep(parseInt(req.params.stepId, 10));
    res.json({ data: { message: 'Step removed' } });
  } catch (err) { next(err); }
});

// Start routine (reset and begin)
router.post('/:householdId/routines/:routineId/start', requireAuth, householdContext, (req, res, next) => {
  try {
    const routine = routineService.startRoutine(parseInt(req.params.routineId, 10));
    res.json({ data: routine });
  } catch (err) { next(err); }
});

// Progress
router.get('/:householdId/routines/:routineId/progress', requireAuth, householdContext, (req, res, next) => {
  try {
    const progress = routineService.getRoutineProgress(parseInt(req.params.routineId, 10));
    res.json({ data: progress });
  } catch (err) { next(err); }
});

export default router;
