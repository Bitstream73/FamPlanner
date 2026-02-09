# Routines — Spec

## Overview

Routines are ordered checklists for recurring daily activities (morning, evening, leaving the house). Users tap through steps to complete them. Optional daily auto-reset clears completed steps. Inspired by Quinyx's shift templates adapted as personal routine checklists.

## Routine Service

```js
// src/services/routine-service.js
class RoutineService {
  constructor(db) {}

  createRoutine(householdId, { name, routineType, assignedTo, autoReset, createdBy }) → routine
  getRoutine(routineId) → routine with steps
  updateRoutine(routineId, updates) → routine
  deleteRoutine(routineId) → void
  listRoutines(householdId, userId?) → [routines]

  // Execution
  startRoutine(routineId) → routine with steps (all unchecked)
  completeStep(stepId) → step with completed_at timestamp
  uncompleteStep(stepId) → step (cleared completed_at)
  getRoutineProgress(routineId) → { total, completed, percentage }

  // Auto-reset
  resetDailyRoutines() → count of routines reset
}
```

## Routine Step Service

```js
// src/services/routine-step-service.js
class RoutineStepService {
  constructor(db) {}

  addStep(routineId, title, sortOrder?) → step
  removeStep(stepId) → void
  reorderSteps(routineId, orderedIds) → [steps]
  getSteps(routineId) → [steps] sorted by sort_order
}
```

## Routine Data Shape

```js
{
  id: 'hex-string',
  household_id: 'hex-string',
  name: 'Morning Routine',
  routine_type: 'morning',           // 'morning' | 'evening' | 'leaving' | 'custom'
  assigned_to: 'hex-string',         // user who runs this routine
  auto_reset: true,                  // reset completed steps daily
  created_by: 'hex-string',
  steps: [
    { id, title: 'Brush teeth', is_complete: 0, sort_order: 0, completed_at: null },
    { id, title: 'Make bed', is_complete: 1, sort_order: 1, completed_at: '2025-03-15T07:23:00Z' },
    { id, title: 'Pack lunch', is_complete: 0, sort_order: 2, completed_at: null }
  ]
}
```

## Auto-Reset Logic

- Routines with `auto_reset = 1` are reset daily
- Reset means: set `is_complete = 0` and `completed_at = NULL` for all steps
- Reset runs at midnight (server time) via a scheduled job or on first access after midnight
- Implementation: on `getRoutine()` or `startRoutine()`, check if last reset was before today. If so, reset all steps before returning.
- Store last reset in a simple check: if any step has `completed_at` from a previous day, reset all

## Routine Execution Flow

1. User opens routine → `getRoutine(routineId)` returns steps (auto-resets if needed)
2. User taps a step → `completeStep(stepId)` marks it done with timestamp
3. UI updates progress bar: `getRoutineProgress(routineId)` → `{ total: 5, completed: 3, percentage: 60 }`
4. User can uncomplete a step if tapped by mistake
5. Next day: auto-reset clears all steps (if enabled)

## Security Rules

- Only household members can view routines
- parent/guardian/caregiver can create routines for anyone
- teen can create routines for self
- kid can only view and run assigned routines (tap-to-complete)
- Only creator or parent/guardian can edit/delete routines

## Test Expectations

- Create routine with steps → all stored, correct order
- Complete step → is_complete=1, completed_at set
- Uncomplete step → is_complete=0, completed_at null
- Progress: correct total/completed/percentage
- Auto-reset: steps from yesterday reset on access
- Auto-reset: steps from today preserved
- Routines without auto_reset are NOT reset
- Reorder steps → sort_order updated correctly
- Permission checks enforced
