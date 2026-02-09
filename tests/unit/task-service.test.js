import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initTestDatabase, closeDatabase } from '../../src/config/database.js';
import database from '../../src/config/database.js';

describe('Task Service', () => {
  let taskService;
  let checklistService;
  let rotationService;
  let userId;
  let userId2;
  let householdId;

  const ts = (year, month, day, hour = 0) =>
    Math.floor(new Date(Date.UTC(year, month - 1, day, hour)).getTime() / 1000);

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    initTestDatabase();
    taskService = (await import('../../src/services/task-service.js')).default;
    checklistService = (await import('../../src/services/task-checklist-service.js')).default;
    rotationService = (await import('../../src/services/rotation-service.js')).default;

    database.db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run('task@test.com', 'hash', 'TaskUser');
    userId = database.db.prepare("SELECT id FROM users WHERE email = ?").get('task@test.com').id;

    database.db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run('task2@test.com', 'hash', 'TaskUser2');
    userId2 = database.db.prepare("SELECT id FROM users WHERE email = ?").get('task2@test.com').id;

    database.db.prepare('INSERT INTO households (name, owner_id) VALUES (?, ?)').run('Task House', userId);
    householdId = database.db.prepare("SELECT id FROM households WHERE name = ?").get('Task House').id;
    database.db.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)').run(householdId, userId, 'parent');
    database.db.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)').run(householdId, userId2, 'teen');
  });

  afterAll(() => closeDatabase());

  describe('createTask', () => {
    it('should create a task with all fields', () => {
      const task = taskService.createTask(householdId, {
        title: 'Take out trash',
        description: 'Both bins',
        taskType: 'one_time',
        assignedTo: userId,
        dueDate: ts(2025, 3, 15),
        difficulty: 'easy',
        timeEstimateMinutes: 15,
        createdBy: userId,
      });

      expect(task).toMatchObject({
        title: 'Take out trash',
        description: 'Both bins',
        task_type: 'one_time',
        assigned_to: userId,
        difficulty: 'easy',
        time_estimate_minutes: 15,
        status: 'pending',
      });
      expect(task.checklists).toEqual([]);
    });

    it('should default status to pending', () => {
      const task = taskService.createTask(householdId, {
        title: 'Default Status',
        createdBy: userId,
      });
      expect(task.status).toBe('pending');
    });
  });

  describe('getTask', () => {
    it('should return task with checklists and assignee name', () => {
      const created = taskService.createTask(householdId, {
        title: 'Get Test',
        assignedTo: userId,
        createdBy: userId,
      });

      checklistService.addStep(created.id, 'Step 1');
      checklistService.addStep(created.id, 'Step 2');

      const task = taskService.getTask(created.id);
      expect(task.assignee_name).toBe('TaskUser');
      expect(task.checklists).toHaveLength(2);
    });

    it('should return null for nonexistent task', () => {
      expect(taskService.getTask(99999)).toBeNull();
    });
  });

  describe('updateTask', () => {
    it('should update specific fields', () => {
      const created = taskService.createTask(householdId, {
        title: 'Old',
        createdBy: userId,
      });

      const updated = taskService.updateTask(created.id, { title: 'New', difficulty: 'hard' });
      expect(updated.title).toBe('New');
      expect(updated.difficulty).toBe('hard');
    });
  });

  describe('deleteTask', () => {
    it('should delete a task', () => {
      const created = taskService.createTask(householdId, {
        title: 'Delete Me',
        createdBy: userId,
      });

      taskService.deleteTask(created.id);
      expect(taskService.getTask(created.id)).toBeNull();
    });
  });

  describe('reassignTask', () => {
    it('should reassign a task to another user', () => {
      const task = taskService.createTask(householdId, {
        title: 'Reassign',
        assignedTo: userId,
        createdBy: userId,
      });

      const updated = taskService.reassignTask(task.id, userId2);
      expect(updated.assigned_to).toBe(userId2);
    });
  });

  describe('completeTask + uncompleteTask', () => {
    it('should mark task as completed with note and photo', () => {
      const task = taskService.createTask(householdId, {
        title: 'Complete Me',
        assignedTo: userId,
        createdBy: userId,
      });

      const completed = taskService.completeTask(task.id, userId, {
        note: 'All done!',
        photoUrl: 'https://example.com/photo.jpg',
      });

      expect(completed.status).toBe('completed');
      expect(completed.completed_at).toBeDefined();
      expect(completed.completion_note).toBe('All done!');
      expect(completed.completion_photo_url).toBe('https://example.com/photo.jpg');
    });

    it('should uncomplete a task', () => {
      const task = taskService.createTask(householdId, {
        title: 'Uncomplete Me',
        createdBy: userId,
      });

      taskService.completeTask(task.id, userId);
      const uncompleted = taskService.uncompleteTask(task.id);
      expect(uncompleted.status).toBe('pending');
      expect(uncompleted.completed_at).toBeNull();
    });
  });

  describe('view queries', () => {
    let viewHouseholdId;

    beforeAll(() => {
      database.db.prepare('INSERT INTO households (name, owner_id) VALUES (?, ?)').run('View House', userId);
      viewHouseholdId = database.db.prepare("SELECT id FROM households WHERE name = ?").get('View House').id;

      // Create tasks with specific due dates relative to "today"
      const today = new Date();
      const startOfToday = Math.floor(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).getTime() / 1000);

      // Today task
      taskService.createTask(viewHouseholdId, {
        title: 'Today Task',
        dueDate: startOfToday,
        assignedTo: userId,
        createdBy: userId,
      });

      // Tomorrow task
      taskService.createTask(viewHouseholdId, {
        title: 'Tomorrow Task',
        dueDate: startOfToday + 86400,
        createdBy: userId,
      });

      // Overdue task (yesterday)
      taskService.createTask(viewHouseholdId, {
        title: 'Overdue Task',
        dueDate: startOfToday - 86400,
        createdBy: userId,
      });

      // Completed task (should not appear in views)
      const completedTask = taskService.createTask(viewHouseholdId, {
        title: 'Done Task',
        dueDate: startOfToday,
        createdBy: userId,
      });
      taskService.completeTask(completedTask.id, userId);
    });

    it('getTodayTasks should return tasks due today', () => {
      const tasks = taskService.getTodayTasks(viewHouseholdId);
      expect(tasks.some((t) => t.title === 'Today Task')).toBe(true);
      expect(tasks.every((t) => t.status !== 'completed')).toBe(true);
    });

    it('getTodayTasks should filter by user', () => {
      const tasks = taskService.getTodayTasks(viewHouseholdId, userId);
      expect(tasks.every((t) => t.assigned_to === userId)).toBe(true);
    });

    it('getUpcomingTasks should return tasks in next 7 days', () => {
      const tasks = taskService.getUpcomingTasks(viewHouseholdId);
      expect(tasks.some((t) => t.title === 'Today Task')).toBe(true);
      expect(tasks.some((t) => t.title === 'Tomorrow Task')).toBe(true);
      expect(tasks.every((t) => t.title !== 'Overdue Task')).toBe(true);
    });

    it('getOverdueTasks should return past-due uncompleted tasks', () => {
      const tasks = taskService.getOverdueTasks(viewHouseholdId);
      expect(tasks.some((t) => t.title === 'Overdue Task')).toBe(true);
      expect(tasks.every((t) => t.title !== 'Done Task')).toBe(true);
    });
  });

  describe('checklist service', () => {
    it('should add steps with auto-incrementing sort order', () => {
      const task = taskService.createTask(householdId, {
        title: 'Checklist Test',
        createdBy: userId,
      });

      const step1 = checklistService.addStep(task.id, 'Step 1');
      const step2 = checklistService.addStep(task.id, 'Step 2');
      const step3 = checklistService.addStep(task.id, 'Step 3');

      expect(step1.sort_order).toBe(0);
      expect(step2.sort_order).toBe(1);
      expect(step3.sort_order).toBe(2);
    });

    it('should toggle step completion', () => {
      const task = taskService.createTask(householdId, {
        title: 'Toggle Test',
        createdBy: userId,
      });

      const step = checklistService.addStep(task.id, 'Toggle Me');
      expect(step.is_complete).toBe(0);

      const toggled = checklistService.toggleStep(step.id);
      expect(toggled.is_complete).toBe(1);

      const toggledBack = checklistService.toggleStep(step.id);
      expect(toggledBack.is_complete).toBe(0);
    });

    it('should remove a step', () => {
      const task = taskService.createTask(householdId, {
        title: 'Remove Step Test',
        createdBy: userId,
      });

      const step = checklistService.addStep(task.id, 'Remove Me');
      checklistService.removeStep(step.id);
      expect(checklistService.getStep(step.id)).toBeNull();
    });

    it('should reorder steps', () => {
      const task = taskService.createTask(householdId, {
        title: 'Reorder Test',
        createdBy: userId,
      });

      const s1 = checklistService.addStep(task.id, 'A');
      const s2 = checklistService.addStep(task.id, 'B');
      const s3 = checklistService.addStep(task.id, 'C');

      // Reorder: C, A, B
      const reordered = checklistService.reorderSteps(task.id, [s3.id, s1.id, s2.id]);
      expect(reordered[0].title).toBe('C');
      expect(reordered[1].title).toBe('A');
      expect(reordered[2].title).toBe('B');
    });
  });

  describe('rotation service', () => {
    it('should create a rotation with member order', () => {
      const rotation = rotationService.createRotation(householdId, 'Trash Duty', [userId, userId2]);
      expect(rotation.name).toBe('Trash Duty');
      expect(rotation.memberOrder).toEqual([userId, userId2]);
      expect(rotation.current_index).toBe(0);
      expect(rotation.currentAssigneeId).toBe(userId);
    });

    it('should advance through rotation in round-robin', () => {
      const rotation = rotationService.createRotation(householdId, 'Dishes', [userId, userId2]);

      expect(rotationService.getNextAssignee(rotation.id)).toBe(userId);

      const { nextAssigneeId: next1 } = rotationService.advanceRotation(rotation.id);
      expect(next1).toBe(userId2);

      const { nextAssigneeId: next2 } = rotationService.advanceRotation(rotation.id);
      expect(next2).toBe(userId); // Wraps around
    });

    it('should wrap around after last member', () => {
      database.db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run('task3@test.com', 'hash', 'TaskUser3');
      const userId3 = database.db.prepare("SELECT id FROM users WHERE email = ?").get('task3@test.com').id;

      const rotation = rotationService.createRotation(householdId, 'Wrap Test', [userId, userId2, userId3]);

      rotationService.advanceRotation(rotation.id); // → userId2
      rotationService.advanceRotation(rotation.id); // → userId3
      const { nextAssigneeId } = rotationService.advanceRotation(rotation.id); // → userId (wrap)
      expect(nextAssigneeId).toBe(userId);
    });

    it('should delete a rotation', () => {
      const rotation = rotationService.createRotation(householdId, 'Delete Me', [userId]);
      rotationService.deleteRotation(rotation.id);
      expect(rotationService.getRotation(rotation.id)).toBeNull();
    });
  });
});
