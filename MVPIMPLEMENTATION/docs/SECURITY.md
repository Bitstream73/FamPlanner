# Security & Data — Spec

## Overview

Audit logging for accountability, data export for user data portability, and security hardening. Minimal but essential for a family app handling personal data.

## Audit Log Service

```js
// src/services/audit-service.js
class AuditService {
  constructor(db) {}

  log(householdId, userId, { action, entityType, entityId, details }) → auditEntry
  query(householdId, { userId, entityType, action, startDate, endDate, limit, offset }) → { entries, total }
  getEntityHistory(entityType, entityId) → [entries]
}
```

### Actions Tracked

| Action | When | Entity Types |
|--------|------|-------------|
| `create` | New entity created | task, event, routine, announcement, handbook |
| `update` | Entity modified | task, event, routine, announcement, handbook |
| `delete` | Entity removed | task, event, routine, announcement, handbook |
| `assign` | Task/event assigned to user | task, event |
| `complete` | Task/routine step completed | task, routine_step |
| `join` | User joined household | household |
| `leave` | User left/removed from household | household |

### Details Field

JSON string with before/after for updates:
```js
{
  "field": "status",
  "from": "pending",
  "to": "completed"
}
```

For creates: `{ "title": "New task name" }`
For deletes: `{ "title": "Deleted task name" }`

### Integration Pattern

Services call `auditService.log()` after successful operations:
```js
// In task-service.js after completeTask:
await auditService.log(task.household_id, userId, {
  action: 'complete',
  entityType: 'task',
  entityId: taskId,
  details: JSON.stringify({ title: task.title })
});
```

## Data Export Service

```js
// src/services/export-service.js
class ExportService {
  constructor(db) {}

  exportTasks(householdId, userId, { format }) → { filename, content, mimeType }
  exportEvents(householdId, userId, { format }) → { filename, content, mimeType }
  exportAll(householdId, userId) → { filename, content, mimeType }
}
```

### CSV Format

**Tasks CSV columns:**
```
id,title,description,type,assigned_to,due_date,difficulty,time_estimate_minutes,status,completed_at,created_at
```

**Events CSV columns:**
```
id,title,location,description,start_time,end_time,responsible_person,recurrence,created_at
```

### CSV Generation

```js
function generateCSV(headers, rows) {
  const headerLine = headers.join(',');
  const dataLines = rows.map(row =>
    headers.map(h => escapeCSV(row[h])).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
```

### Export "Download My Data"

`exportAll` bundles all user data into a single response:
- Tasks assigned to or created by the user
- Events in user's households
- Returns as a ZIP-like concatenation or multi-section CSV

## Security Hardening

Already in place (from Phase 4/4A):
- HTTPS enforced (Railway handles TLS)
- httpOnly, secure, sameSite strict cookies
- bcrypt password hashing
- Helmet security headers
- Rate limiting on auth endpoints
- CORS configured for production domain

Additional for MVP:
- **Input validation**: All user input validated with length limits
  - titles: max 200 chars
  - descriptions/content: max 5000 chars
  - steps arrays: max 50 items
  - image_urls arrays: max 10 items
- **SQL injection prevention**: Always use parameterized queries (better-sqlite3 does this)
- **XSS prevention**: Sanitize HTML in content fields before rendering
- **Invite tokens**: 32-byte crypto.randomBytes, hex-encoded, single-use

## Security Rules

- Audit log: visible to parent/guardian only
- Export: users can export their own data; parent/guardian can export household data
- No PII in audit log details (use entity IDs, not names)
- Audit entries are append-only (no update or delete)
- CSV export must sanitize fields to prevent formula injection (prefix `=`, `+`, `-`, `@` with `'`)

## Test Expectations

- Audit log: create entry → stored with all fields
- Audit log: query by user → only that user's actions
- Audit log: query by entity type → correct filter
- Audit log: query by date range → correct bounds
- Audit log: entity history → all actions for one entity, sorted by time
- Export tasks CSV → valid CSV, correct columns, data matches
- Export events CSV → valid CSV, correct columns
- CSV escaping: commas, quotes, newlines handled correctly
- CSV formula injection: dangerous prefixes escaped
- Permission checks: kid/teen cannot view audit log
- Permission checks: users can only export own data (or household if parent)
