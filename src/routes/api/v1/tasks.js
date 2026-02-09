import { Router } from 'express';
import taskService from '../../../services/task-service.js';
import checklistService from '../../../services/task-checklist-service.js';
import rotationService from '../../../services/rotation-service.js';
import { requireAuth } from '../../../middleware/requireAuth.js';
import householdContext from '../../../middleware/household-context.js';
import requirePermission from '../../../middleware/require-permission.js';

const router = Router();

// Tasks
router.post('/:householdId/tasks', requireAuth, householdContext, (req, res, next) => {
  try {
    const { title, description, taskType, assignedTo, dueDate, difficulty, timeEstimateMinutes, recurrenceRule, rotationId } = req.body;
    if (!title || title.length > 200) {
      return res.status(400).json({ error: 'Title is required (max 200 chars)', code: 'VALIDATION_ERROR' });
    }

    const task = taskService.createTask(req.householdId, {
      title, description, taskType, assignedTo, dueDate, difficulty, timeEstimateMinutes,
      createdBy: req.user.id, recurrenceRule, rotationId,
    });
    res.status(201).json({ data: task });
  } catch (err) { next(err); }
});

router.get('/:householdId/tasks', requireAuth, householdContext, (req, res, next) => {
  try {
    const { assignedTo } = req.query;
    const tasks = taskService.getAssignedTasks(
      assignedTo ? parseInt(assignedTo, 10) : req.user.id, req.householdId
    );
    res.json({ data: tasks });
  } catch (err) { next(err); }
});

router.get('/:householdId/tasks/today', requireAuth, householdContext, (req, res, next) => {
  try {
    const { assignedTo } = req.query;
    const tasks = taskService.getTodayTasks(req.householdId, assignedTo ? parseInt(assignedTo, 10) : undefined);
    res.json({ data: tasks });
  } catch (err) { next(err); }
});

router.get('/:householdId/tasks/upcoming', requireAuth, householdContext, (req, res, next) => {
  try {
    const { assignedTo, days } = req.query;
    const tasks = taskService.getUpcomingTasks(
      req.householdId, assignedTo ? parseInt(assignedTo, 10) : undefined, days ? parseInt(days, 10) : 7
    );
    res.json({ data: tasks });
  } catch (err) { next(err); }
});

router.get('/:householdId/tasks/overdue', requireAuth, householdContext, (req, res, next) => {
  try {
    const { assignedTo } = req.query;
    const tasks = taskService.getOverdueTasks(req.householdId, assignedTo ? parseInt(assignedTo, 10) : undefined);
    res.json({ data: tasks });
  } catch (err) { next(err); }
});

router.get('/:householdId/tasks/:taskId', requireAuth, householdContext, (req, res, next) => {
  try {
    const task = taskService.getTask(parseInt(req.params.taskId, 10));
    if (!task) return res.status(404).json({ error: 'Task not found', code: 'NOT_FOUND' });
    res.json({ data: task });
  } catch (err) { next(err); }
});

router.put('/:householdId/tasks/:taskId', requireAuth, householdContext, (req, res, next) => {
  try {
    const task = taskService.updateTask(parseInt(req.params.taskId, 10), req.body);
    res.json({ data: task });
  } catch (err) { next(err); }
});

router.delete('/:householdId/tasks/:taskId', requireAuth, householdContext, requirePermission('delete_entity'), (req, res, next) => {
  try {
    taskService.deleteTask(parseInt(req.params.taskId, 10));
    res.json({ data: { message: 'Task deleted' } });
  } catch (err) { next(err); }
});

router.post('/:householdId/tasks/:taskId/complete', requireAuth, householdContext, (req, res, next) => {
  try {
    const { note, photoUrl } = req.body;
    const task = taskService.completeTask(parseInt(req.params.taskId, 10), req.user.id, { note, photoUrl });
    res.json({ data: task });
  } catch (err) { next(err); }
});

router.post('/:householdId/tasks/:taskId/uncomplete', requireAuth, householdContext, requirePermission('assign_task'), (req, res, next) => {
  try {
    const task = taskService.uncompleteTask(parseInt(req.params.taskId, 10));
    res.json({ data: task });
  } catch (err) { next(err); }
});

// Checklists
router.post('/tasks/:taskId/checklist', requireAuth, (req, res, next) => {
  try {
    const { title, sortOrder } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required', code: 'VALIDATION_ERROR' });
    const step = checklistService.addStep(parseInt(req.params.taskId, 10), title, sortOrder);
    res.status(201).json({ data: step });
  } catch (err) { next(err); }
});

router.put('/tasks/:taskId/checklist/:stepId', requireAuth, (req, res, next) => {
  try {
    const step = checklistService.toggleStep(parseInt(req.params.stepId, 10));
    res.json({ data: step });
  } catch (err) { next(err); }
});

router.delete('/tasks/:taskId/checklist/:stepId', requireAuth, (req, res, next) => {
  try {
    checklistService.removeStep(parseInt(req.params.stepId, 10));
    res.json({ data: { message: 'Step removed' } });
  } catch (err) { next(err); }
});

router.put('/tasks/:taskId/checklist/reorder', requireAuth, (req, res, next) => {
  try {
    const { orderedIds } = req.body;
    const steps = checklistService.reorderSteps(parseInt(req.params.taskId, 10), orderedIds);
    res.json({ data: steps });
  } catch (err) { next(err); }
});

// Rotations
router.post('/:householdId/rotations', requireAuth, householdContext, requirePermission('assign_task'), (req, res, next) => {
  try {
    const { name, memberIds } = req.body;
    if (!name || !memberIds || !memberIds.length) {
      return res.status(400).json({ error: 'Name and memberIds are required', code: 'VALIDATION_ERROR' });
    }
    const rotation = rotationService.createRotation(req.householdId, name, memberIds);
    res.status(201).json({ data: rotation });
  } catch (err) { next(err); }
});

router.get('/:householdId/rotations/:rotationId', requireAuth, householdContext, (req, res, next) => {
  try {
    const rotation = rotationService.getRotation(parseInt(req.params.rotationId, 10));
    if (!rotation) return res.status(404).json({ error: 'Rotation not found', code: 'NOT_FOUND' });
    res.json({ data: rotation });
  } catch (err) { next(err); }
});

router.delete('/:householdId/rotations/:rotationId', requireAuth, householdContext, requirePermission('delete_entity'), (req, res, next) => {
  try {
    rotationService.deleteRotation(parseInt(req.params.rotationId, 10));
    res.json({ data: { message: 'Rotation deleted' } });
  } catch (err) { next(err); }
});

export default router;
