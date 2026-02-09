# Communication — Spec

## Overview

Household announcements feed, comment threads on tasks/events, @mentions with notifications, and quiet hours per user. Inspired by Quinyx's team communication features adapted for family context.

## Announcement Service

```js
// src/services/announcement-service.js
class AnnouncementService {
  constructor(db) {}

  create(householdId, authorId, content) → announcement
  update(announcementId, content, requesterId) → announcement
  delete(announcementId, requesterId) → void
  list(householdId, { limit, offset }) → { announcements, total }
  pin(announcementId, requesterId) → announcement
  unpin(announcementId, requesterId) → announcement
  getPinned(householdId) → [announcements]
}
```

## Comment Service

```js
// src/services/comment-service.js
class CommentService {
  constructor(db) {}

  addComment(entityType, entityId, authorId, content) → comment
  updateComment(commentId, content, requesterId) → comment
  deleteComment(commentId, requesterId) → void
  listComments(entityType, entityId, { limit, offset }) → { comments, total }
}
```

- `entityType`: `'task'` or `'event'`
- `entityId`: the task or event ID
- Comments are polymorphic — one table serves both tasks and events

## Mention Parser

```js
// src/services/mention-service.js
class MentionService {
  constructor(db) {}

  // Extract @mentions from text and create records
  parseMentions(text, householdId) → [{ userId, username }]
  createMentions(commentId, announcementId, mentionedUserIds) → [mentions]
  getUserMentions(userId, { limit, offset }) → [{ mention, context }]
}
```

### Mention Format
- In text: `@username` (case-insensitive)
- Parser matches against household member display_names and usernames
- Creates mention records linking to comment or announcement
- Triggers notification for mentioned user

## Quiet Hours Service

```js
// src/services/quiet-hours-service.js
class QuietHoursService {
  constructor(db) {}

  setQuietHours(userId, householdId, startTime, endTime) → preferences
  getQuietHours(userId, householdId) → { start, end } | null
  isInQuietHours(userId, householdId) → boolean
  clearQuietHours(userId, householdId) → void
}
```

- `startTime` / `endTime`: time strings like `"22:00"` / `"07:00"`
- Quiet hours can span midnight (e.g., 22:00 → 07:00)
- During quiet hours: push notifications suppressed, email delayed until quiet hours end

## Socket.IO Integration

Real-time broadcasting for announcements and comments:

```js
// In announcement-service.js after create:
io.to(`household:${householdId}`).emit('announcement:new', announcement);

// In comment-service.js after addComment:
io.to(`household:${householdId}`).emit('comment:new', { entityType, entityId, comment });

// In mention-service.js after creating mentions:
mentionedUserIds.forEach(uid =>
  io.to(`user:${uid}`).emit('mention:new', { mention, context })
);
```

### Socket Rooms
- `household:{id}` — all members of a household
- `user:{id}` — individual user's private channel
- Users join rooms on connect, leave on disconnect
- Auth: validate session cookie on Socket.IO handshake

## Security Rules

- Only household members can view/create announcements and comments
- parent/guardian can pin/unpin announcements
- teen/caregiver can create announcements but not pin
- kid can view announcements but not create
- Comment authors or parent/guardian can edit/delete comments
- @mentions only resolve to household members (no info leak)
- Quiet hours: users can only manage their own

## Test Expectations

- Create announcement → stored, broadcast via Socket.IO
- Pin/unpin → is_pinned toggled
- List announcements → paginated, pinned first
- Add comment to task → stored with correct entity_type/entity_id
- Add comment to event → same polymorphic behavior
- Parse @mention → correct user IDs extracted
- @mention for non-member → ignored (no error)
- Quiet hours spanning midnight → correctly identifies "in quiet hours"
- Socket.IO rooms: events broadcast to correct household
- Permission checks enforced
