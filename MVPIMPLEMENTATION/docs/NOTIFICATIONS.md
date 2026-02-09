# Notifications — Spec

## Overview

Multi-channel notification system: in-app (stored in DB), push (Web Push API), and email (via Resend). Reminder rules for tasks and events. Quiet hours filtering. Inspired by Quinyx's notification system adapted for family use.

## Notification Service

```js
// src/services/notification-service.js
class NotificationService {
  constructor(db) {}

  create(userId, householdId, { type, title, body, entityType, entityId }) → notification
  list(userId, { unreadOnly, limit, offset }) → { notifications, total, unreadCount }
  markRead(notificationId, userId) → notification
  markAllRead(userId, householdId?) → count
  delete(notificationId, userId) → void

  // Bulk operations
  createForHousehold(householdId, { type, title, body, entityType, entityId, excludeUserId }) → [notifications]
}
```

## Notification Types

| Type | Trigger | Default Channel |
|------|---------|-----------------|
| `task_assigned` | Task assigned to user | push + in-app |
| `task_due` | Task due date reached | push + in-app |
| `event_reminder` | Event starting soon | push + in-app |
| `mention` | @mentioned in comment/announcement | push + in-app |
| `announcement` | New household announcement | in-app |
| `comment` | New comment on user's task/event | in-app |
| `invite` | Household invite received | email + in-app |
| `chore_rotation` | User's turn in rotation | push + in-app |

## Push Notification Dispatcher

```js
// src/services/push-service.js
class PushService {
  constructor(db) {}

  // Web Push API subscription management
  subscribe(userId, subscription) → void   // subscription = { endpoint, keys }
  unsubscribe(userId, endpoint) → void
  getSubscriptions(userId) → [subscriptions]

  // Send push
  sendPush(userId, { title, body, data }) → { sent: boolean }
  sendPushToHousehold(householdId, { title, body, data }, excludeUserId?) → { sentCount }
}
```

- Uses the Web Push protocol (VAPID keys stored in env)
- Subscriptions stored in a `push_subscriptions` table:
  ```sql
  CREATE TABLE push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    keys TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  ```

## Email Notification Dispatcher

```js
// src/services/email-notification-service.js
class EmailNotificationService {
  constructor(resendClient) {}

  sendNotificationEmail(userId, { subject, body, htmlBody }) → { sent: boolean }
  sendDailyDigest(userId, notifications) → { sent: boolean }
}
```

- Uses existing Resend integration
- Only sends if user has `email_enabled = 1` in preferences
- Daily digest: batch unread notifications into one email

## Reminder Rule Engine

```js
// src/services/reminder-service.js
class ReminderService {
  constructor(db, notificationService) {}

  // Scheduled job: runs every 15 minutes
  processReminders() → { processed: number }

  // Check for due tasks and upcoming events
  checkTaskReminders() → [notifications created]
  checkEventReminders() → [notifications created]
  generateDailyDigest() → [digest emails sent]
}
```

### Reminder Rules
1. **on_due**: At 8:00 AM on the task's due date, notify assignee
2. **1hr_before**: 1 hour before event start_time, notify responsible person + all members
3. **daily_digest**: At 7:00 AM, send summary of today's tasks and events to each member

### Deduplication
- Track sent reminders to avoid duplicates:
  ```sql
  CREATE TABLE sent_reminders (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    reminder_type TEXT NOT NULL,
    user_id TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(entity_type, entity_id, reminder_type, user_id)
  );
  ```

## Quiet Hours Filter

Before sending push or email, check:
```js
if (quietHoursService.isInQuietHours(userId, householdId)) {
  // Store notification in DB (in-app) but skip push/email
  // Push/email will be sent when quiet hours end (next processReminders cycle)
  return;
}
```

## Notification Preferences

Per-user, per-household settings stored in `notification_preferences` table (see DATABASE_MVP.md).

```js
// src/services/notification-preferences-service.js
class NotificationPreferencesService {
  constructor(db) {}

  getPreferences(userId, householdId) → preferences
  updatePreferences(userId, householdId, updates) → preferences
}
```

## Security Rules

- Users can only see their own notifications
- Users can only manage their own preferences and subscriptions
- Notification creation is system-internal (services call it, not routes directly)
- Push subscription endpoints are never exposed to other users
- Email addresses are never leaked in notifications

## Test Expectations

- Create notification → stored with correct type and entity reference
- List notifications → paginated, unreadCount correct
- Mark read → is_read=1
- Mark all read → all user's notifications updated
- Push: subscription stored, push sent (mock web-push)
- Email: sent via Resend mock when email_enabled
- Quiet hours: push/email suppressed during quiet hours
- Reminder: on_due fires on correct date
- Reminder: 1hr_before fires at correct time
- Reminder: deduplication prevents double-send
- Daily digest: batches notifications correctly
- Preferences: CRUD works, defaults correct
