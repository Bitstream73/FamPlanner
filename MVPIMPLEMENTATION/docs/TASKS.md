# Chores & Tasks — Spec

## Overview

Task management with assignments, checklists, difficulty ratings, rotations, and multiple views. Inspired by Quinyx's task distribution adapted for household chores.

## Task Service

```js
// src/services/task-service.js
class TaskService {
  constructor(db) {}

  createTask(householdId, { title, description, taskType, assignedTo, dueDate, difficulty, timeEstimateMinutes, createdBy, recurrenceRule, rotationId }) → task
  getTask(taskId) → task with checklists and assignee details
  updateTask(taskId, updates, requesterId) → task
  deleteTask(taskId, requesterId) → void
  reassignTask(taskId, newAssigneeId, requesterId) → task

  // Completion
  completeTask(taskId, userId, { note, photoUrl }) → task
  uncompleteTask(taskId, requesterId) → task

  // Views
  getTodayTasks(householdId, userId?) → [tasks] due today
  getUpcomingTasks(householdId, userId?, days=7) → [tasks] due in next N days
  getOverdueTasks(householdId, userId?) → [tasks] past due, not completed
  getAssignedTasks(userId, householdId?) → [tasks] assigned to user

  // Recurring
  generateRecurringInstances(taskId) → [tasks]
}
```

## Task Data Shape

```js
{
  id: 'hex-string',
  household_id: 'hex-string',
  title: 'Take out trash',
  description: 'Both kitchen and bathroom bins',
  task_type: 'recurring',            // 'one_time' | 'recurring'
  assigned_to: 'hex-string',         // user ID or null
  created_by: 'hex-string',
  due_date: '2025-03-15',            // date only, no time
  difficulty: 'easy',                // 'easy' | 'medium' | 'hard'
  time_estimate_minutes: 15,
  status: 'pending',                 // 'pending' | 'in_progress' | 'completed' | 'overdue'
  completed_at: null,
  completion_note: null,
  completion_photo_url: null,
  recurrence_rule: 'weekly',         // null | 'weekly' | 'daily' | 'monthly'
  rotation_id: 'hex-string',         // links to task_rotations
  checklists: [
    { id, title, is_complete, sort_order }
  ]
}
```

## Task Checklist Service

```js
// src/services/task-checklist-service.js
class TaskChecklistService {
  constructor(db) {}

  addStep(taskId, title, sortOrder?) → checklist item
  removeStep(stepId) → void
  toggleStep(stepId) → checklist item (toggled is_complete)
  reorderSteps(taskId, orderedIds) → [checklist items]
  getSteps(taskId) → [checklist items] sorted by sort_order
}
```

## Rotation Service

```js
// src/services/rotation-service.js
class RotationService {
  constructor(db) {}

  createRotation(householdId, name, memberIds) → rotation
  getRotation(rotationId) → rotation with current assignee
  advanceRotation(rotationId) → { nextAssigneeId, rotation }
  deleteRotation(rotationId) → void

  // Get next person in round-robin
  getNextAssignee(rotationId) → userId
}
```

### Rotation Logic

- `member_order` is a JSON array of user IDs: `["alice", "bob", "charlie"]`
- `current_index` tracks who's next: 0 → alice, 1 → bob, 2 → charlie
- After charlie, wraps to 0 (alice)
- When a recurring task generates a new instance, call `advanceRotation` to get the next assignee
- If a member is removed from the household, remove them from rotation and adjust index

## Task View Queries

### Today
```sql
SELECT * FROM tasks
WHERE household_id = ? AND status != 'completed'
  AND due_date = date('now')
ORDER BY difficulty DESC, due_date ASC;
```

### Upcoming (next 7 days)
```sql
SELECT * FROM tasks
WHERE household_id = ? AND status != 'completed'
  AND due_date BETWEEN date('now') AND date('now', '+7 days')
ORDER BY due_date ASC, difficulty DESC;
```

### Overdue
```sql
SELECT * FROM tasks
WHERE household_id = ? AND status != 'completed'
  AND due_date < date('now')
ORDER BY due_date ASC;
```

All views optionally filter by `assigned_to = userId`.

## Reminder Rules

Reminders are created as notifications (see NOTIFICATIONS.md):
- **on_due**: notification at start of due date (8am local)
- **1hr_before**: if task has a due time, 1 hour before
- **daily_digest**: included in daily summary notification

## Security Rules

- Only household members can view/create tasks
- parent/guardian can assign to anyone, edit/delete any task
- teen can create tasks for self, complete own tasks
- kid can only view assigned tasks and mark them complete
- caregiver can assign tasks but cannot delete
- Task completion: only assignee or parent/guardian can mark done

## Test Expectations

- Create task → all fields stored, status defaults to 'pending'
- Complete task → status='completed', completed_at set, note/photo stored
- Checklist: add/remove/toggle/reorder all work correctly
- Rotation: round-robin cycles through all members correctly
- Rotation: wraps around after last member
- Today view: only tasks due today, excludes completed
- Upcoming view: correct 7-day window
- Overdue view: only past-due uncompleted tasks
- Permission checks enforced for all operations
- Recurring task generates instances with rotated assignees
