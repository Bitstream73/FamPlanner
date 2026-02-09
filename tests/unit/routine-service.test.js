import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initTestDatabase, closeDatabase } from '../../src/config/database.js';
import database from '../../src/config/database.js';

describe('Routine Service', () => {
  let routineService;
  let userId;
  let householdId;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    initTestDatabase();
    routineService = (await import('../../src/services/routine-service.js')).default;

    database.db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run('routine@test.com', 'hash', 'RoutineUser');
    userId = database.db.prepare("SELECT id FROM users WHERE email = ?").get('routine@test.com').id;

    database.db.prepare('INSERT INTO households (name, owner_id) VALUES (?, ?)').run('Routine House', userId);
    householdId = database.db.prepare("SELECT id FROM households WHERE name = ?").get('Routine House').id;
    database.db.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)').run(householdId, userId, 'parent');
  });

  afterAll(() => closeDatabase());

  describe('createRoutine', () => {
    it('should create a routine with steps', () => {
      const routine = routineService.createRoutine(householdId, {
        name: 'Morning Routine',
        routineType: 'morning',
        assignedTo: userId,
        autoReset: true,
        createdBy: userId,
      });

      expect(routine).toMatchObject({
        name: 'Morning Routine',
        routine_type: 'morning',
        assigned_to: userId,
        auto_reset: 1,
      });
      expect(routine.steps).toEqual([]);
    });
  });

  describe('routine with steps', () => {
    it('should add steps with correct sort order', () => {
      const routine = routineService.createRoutine(householdId, {
        name: 'Step Test',
        routineType: 'evening',
        createdBy: userId,
      });

      const s1 = routineService.addStep(routine.id, 'Brush teeth');
      const s2 = routineService.addStep(routine.id, 'Make bed');
      const s3 = routineService.addStep(routine.id, 'Pack lunch');

      expect(s1.sort_order).toBe(0);
      expect(s2.sort_order).toBe(1);
      expect(s3.sort_order).toBe(2);

      const r = routineService.getRoutine(routine.id);
      expect(r.steps).toHaveLength(3);
      expect(r.steps[0].title).toBe('Brush teeth');
    });

    it('should reorder steps', () => {
      const routine = routineService.createRoutine(householdId, {
        name: 'Reorder Test',
        routineType: 'custom',
        createdBy: userId,
      });

      const s1 = routineService.addStep(routine.id, 'A');
      const s2 = routineService.addStep(routine.id, 'B');
      const s3 = routineService.addStep(routine.id, 'C');

      const reordered = routineService.reorderSteps(routine.id, [s3.id, s1.id, s2.id]);
      expect(reordered[0].title).toBe('C');
      expect(reordered[1].title).toBe('A');
      expect(reordered[2].title).toBe('B');
    });

    it('should remove a step', () => {
      const routine = routineService.createRoutine(householdId, {
        name: 'Remove Test',
        routineType: 'morning',
        createdBy: userId,
      });

      const step = routineService.addStep(routine.id, 'Remove me');
      routineService.removeStep(step.id);

      const r = routineService.getRoutine(routine.id);
      expect(r.steps).toHaveLength(0);
    });
  });

  describe('completeStep + uncompleteStep', () => {
    it('should mark step as complete with timestamp', () => {
      const routine = routineService.createRoutine(householdId, {
        name: 'Complete Test',
        routineType: 'morning',
        createdBy: userId,
      });

      const step = routineService.addStep(routine.id, 'Test step');
      const completed = routineService.completeStep(step.id);

      expect(completed.is_complete).toBe(1);
      expect(completed.completed_at).toBeDefined();
      expect(completed.completed_at).not.toBeNull();
    });

    it('should uncomplete a step', () => {
      const routine = routineService.createRoutine(householdId, {
        name: 'Uncomplete Test',
        routineType: 'morning',
        createdBy: userId,
      });

      const step = routineService.addStep(routine.id, 'Test step');
      routineService.completeStep(step.id);
      const uncompleted = routineService.uncompleteStep(step.id);

      expect(uncompleted.is_complete).toBe(0);
      expect(uncompleted.completed_at).toBeNull();
    });
  });

  describe('getRoutineProgress', () => {
    it('should return correct progress', () => {
      const routine = routineService.createRoutine(householdId, {
        name: 'Progress Test',
        routineType: 'morning',
        createdBy: userId,
      });

      routineService.addStep(routine.id, 'Step 1');
      const s2 = routineService.addStep(routine.id, 'Step 2');
      routineService.addStep(routine.id, 'Step 3');

      routineService.completeStep(s2.id);

      const progress = routineService.getRoutineProgress(routine.id);
      expect(progress).toEqual({ total: 3, completed: 1, percentage: 33 });
    });

    it('should return 0 for empty routine', () => {
      const routine = routineService.createRoutine(householdId, {
        name: 'Empty Progress',
        routineType: 'morning',
        createdBy: userId,
      });

      const progress = routineService.getRoutineProgress(routine.id);
      expect(progress).toEqual({ total: 0, completed: 0, percentage: 0 });
    });
  });

  describe('startRoutine', () => {
    it('should reset all steps', () => {
      const routine = routineService.createRoutine(householdId, {
        name: 'Start Test',
        routineType: 'morning',
        createdBy: userId,
      });

      const s1 = routineService.addStep(routine.id, 'Step 1');
      const s2 = routineService.addStep(routine.id, 'Step 2');
      routineService.completeStep(s1.id);
      routineService.completeStep(s2.id);

      const started = routineService.startRoutine(routine.id);
      expect(started.steps.every((s) => s.is_complete === 0)).toBe(true);
      expect(started.steps.every((s) => s.completed_at === null)).toBe(true);
    });
  });

  describe('auto-reset', () => {
    it('should reset steps completed before today on getRoutine', () => {
      const routine = routineService.createRoutine(householdId, {
        name: 'Auto Reset Test',
        routineType: 'morning',
        autoReset: true,
        createdBy: userId,
      });

      const step = routineService.addStep(routine.id, 'Yesterday step');

      // Manually set completed_at to yesterday
      const yesterday = Math.floor(Date.now() / 1000) - 86400;
      database.db.prepare(
        'UPDATE routine_steps SET is_complete = 1, completed_at = ? WHERE id = ?'
      ).run(yesterday, step.id);

      // Getting routine should trigger auto-reset
      const r = routineService.getRoutine(routine.id);
      expect(r.steps[0].is_complete).toBe(0);
      expect(r.steps[0].completed_at).toBeNull();
    });

    it('should NOT reset steps completed today', () => {
      const routine = routineService.createRoutine(householdId, {
        name: 'Today Reset Test',
        routineType: 'morning',
        autoReset: true,
        createdBy: userId,
      });

      const step = routineService.addStep(routine.id, 'Today step');
      routineService.completeStep(step.id);

      // Getting routine should NOT reset today's steps
      const r = routineService.getRoutine(routine.id);
      expect(r.steps[0].is_complete).toBe(1);
    });

    it('should NOT reset routines without auto_reset', () => {
      const routine = routineService.createRoutine(householdId, {
        name: 'No Reset Test',
        routineType: 'morning',
        autoReset: false,
        createdBy: userId,
      });

      const step = routineService.addStep(routine.id, 'Old step');

      // Manually set completed_at to yesterday
      const yesterday = Math.floor(Date.now() / 1000) - 86400;
      database.db.prepare(
        'UPDATE routine_steps SET is_complete = 1, completed_at = ? WHERE id = ?'
      ).run(yesterday, step.id);

      const r = routineService.getRoutine(routine.id);
      expect(r.steps[0].is_complete).toBe(1); // Should NOT be reset
    });
  });

  describe('listRoutines', () => {
    it('should list all routines for a household', () => {
      const routines = routineService.listRoutines(householdId);
      expect(routines.length).toBeGreaterThan(0);
    });

    it('should filter by assigned user', () => {
      // Create a routine assigned to our user
      routineService.createRoutine(householdId, {
        name: 'My Routine',
        routineType: 'morning',
        assignedTo: userId,
        createdBy: userId,
      });

      const routines = routineService.listRoutines(householdId, userId);
      expect(routines.length).toBeGreaterThan(0);
      expect(routines.every((r) => r.assigned_to === userId || r.assigned_to === null)).toBe(true);
    });
  });

  describe('updateRoutine + deleteRoutine', () => {
    it('should update routine properties', () => {
      const routine = routineService.createRoutine(householdId, {
        name: 'Update Test',
        routineType: 'morning',
        createdBy: userId,
      });

      const updated = routineService.updateRoutine(routine.id, {
        name: 'Updated Name',
        autoReset: true,
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.auto_reset).toBe(1);
    });

    it('should delete a routine', () => {
      const routine = routineService.createRoutine(householdId, {
        name: 'Delete Me',
        routineType: 'morning',
        createdBy: userId,
      });

      routineService.deleteRoutine(routine.id);
      expect(routineService.getRoutine(routine.id)).toBeNull();
    });
  });
});
