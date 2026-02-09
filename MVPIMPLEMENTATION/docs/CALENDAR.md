# Calendar & Coverage — Spec

## Overview

Shared family calendar with event management, responsible person assignment, availability tracking, and conflict detection. Inspired by Quinyx's shift scheduling adapted for family events.

## Calendar Service

```js
// src/services/calendar-service.js
class CalendarService {
  constructor(db) {}

  createEvent(householdId, { title, location, description, startTime, endTime, responsibleUserId, createdBy, recurrenceRule }) → event
  getEvent(eventId) → event with responsible person details
  updateEvent(eventId, updates, requesterId) → updated event
  deleteEvent(eventId, requesterId) → void

  // View queries — all filter by household
  getDayView(householdId, date) → [events] sorted by start_time
  getWeekView(householdId, startOfWeek) → [events] grouped by day
  getMonthView(householdId, year, month) → [events] grouped by day

  // Responsible person
  assignResponsible(eventId, userId) → event
  removeResponsible(eventId) → event

  // Recurring events
  createRecurringSeries(householdId, eventData, recurrenceRule) → [events]
  updateSeriesEvent(eventId, updates, scope) → events (scope: 'this' | 'future' | 'all')
  deleteSeriesEvent(eventId, scope) → void
}
```

## Event Data Shape

```js
{
  id: 'hex-string',
  household_id: 'hex-string',
  title: 'Soccer Practice',             // required
  location: 'City Park Field 3',        // optional
  description: 'Bring shin guards',     // optional
  start_time: '2025-03-15T16:00:00Z',   // ISO 8601, required
  end_time: '2025-03-15T17:30:00Z',     // ISO 8601, required
  responsible_user_id: 'hex-string',     // optional — who's in charge
  created_by: 'hex-string',
  recurrence_rule: 'weekly',            // null | 'weekly'
  recurrence_parent_id: null,           // links recurring instances to parent
}
```

## Availability Service

```js
// src/services/availability-service.js
class AvailabilityService {
  constructor(db) {}

  createBlock(userId, householdId, { startTime, endTime, reason, recurringDay }) → block
  updateBlock(blockId, updates) → block
  deleteBlock(blockId) → void
  getUserAvailability(userId, householdId, startDate, endDate) → [blocks]
  getHouseholdAvailability(householdId, startDate, endDate) → [{ user, blocks }]
}
```

- `recurringDay`: 0-6 (Sunday-Saturday), null for one-time blocks
- Blocks represent "unavailable" windows

## Conflict Detection

```js
// src/services/conflict-service.js
class ConflictService {
  constructor(db) {}

  // Check for conflicts before creating/updating events
  detectConflicts(householdId, startTime, endTime, excludeEventId?) → {
    overlapping_events: [events],
    unavailable_members: [{ user, block }],
    no_responsible_person: boolean
  }

  // Check if a specific user is available
  isUserAvailable(userId, householdId, startTime, endTime) → boolean
}
```

### Conflict Rules
1. **Event overlap**: Two events at the same time → warning (not blocking)
2. **Responsible person unavailable**: Assigned person has availability block → warning
3. **No responsible person**: Event has no responsible_user_id → warning
4. Conflicts are warnings, not blockers — users can override

## Recurring Events

MVP supports weekly recurrence only.

- When creating a recurring event, generate instances for 12 weeks ahead
- Each instance references the parent via `recurrence_parent_id`
- Editing scope:
  - `this`: edit only this instance (detach from parent)
  - `future`: edit this and all future instances
  - `all`: edit all instances in the series
- Deleting follows the same scope pattern

## Recurrence Rule Format

Simple string for MVP: `"weekly"` or `null`. Future versions may use RRULE format.

## Security Rules

- Only household members can view/create/edit events
- `teen` can create and edit events
- `kid` can only view events
- `caregiver` can create and edit but not delete
- Only creator or parent/guardian can delete events
- Availability blocks: users can only manage their own

## Test Expectations

- Create event → stored with all fields, timestamps correct
- Day/week/month views return correct date ranges
- Assign responsible person → reflected in event
- Availability block prevents user from being "available" in that window
- Conflict detection finds overlapping events
- Conflict detection warns when responsible person is unavailable
- Recurring event creates 12 weekly instances
- Edit series with scope='this' only changes one instance
- Delete series with scope='all' removes all instances
- Permission checks enforced for all operations
