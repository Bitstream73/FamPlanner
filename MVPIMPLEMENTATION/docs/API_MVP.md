# API Routes — MVP Spec

All routes are versioned under `/api/v1/`. Authentication required for all routes (existing auth middleware). Household-scoped routes require membership validation via permission middleware.

## Middleware

### Household Context Middleware
```js
// src/middleware/household-context.js
// Attaches req.household and req.memberRole from :householdId param
// Returns 404 if household not found, 403 if user not a member
```

### Permission Middleware
```js
// src/middleware/require-permission.js
// Factory: requirePermission('edit_calendar')
// Checks req.user + req.memberRole against permission engine
// Returns 403 with { error: 'Insufficient permissions' }
```

## Route Groups

### Households — `/api/v1/households`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | user | Create household |
| GET | `/` | user | List user's households |
| GET | `/:id` | member | Get household details |
| PUT | `/:id` | parent/guardian | Update household |
| DELETE | `/:id` | owner | Delete household |
| POST | `/:id/invite` | parent/guardian | Generate invite |
| POST | `/join` | user | Accept invite (body: { token }) |
| GET | `/:id/members` | member | List members |
| PUT | `/:id/members/:userId` | parent/guardian | Update member role |
| DELETE | `/:id/members/:userId` | parent/guardian | Remove member |

### Profiles — `/api/v1/profile`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | user | Get own profile |
| PUT | `/` | user | Update own profile |
| GET | `/household/:householdId` | member | List household profiles |

### Calendar — `/api/v1/households/:householdId/events`

| Method | Path | Auth | Permission |
|--------|------|------|------------|
| POST | `/` | member | edit_calendar |
| GET | `/` | member | view_all |
| GET | `/:eventId` | member | view_all |
| PUT | `/:eventId` | member | edit_calendar |
| DELETE | `/:eventId` | member | delete_entity |
| GET | `/day/:date` | member | view_all |
| GET | `/week/:startDate` | member | view_all |
| GET | `/month/:year/:month` | member | view_all |

**Query params for GET /:** `?start=ISO&end=ISO&responsible=userId`

### Availability — `/api/v1/households/:householdId/availability`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | member | Create availability block (own) |
| GET | `/` | member | List household availability |
| GET | `/me` | member | List own availability |
| PUT | `/:blockId` | owner of block | Update block |
| DELETE | `/:blockId` | owner of block | Delete block |

### Tasks — `/api/v1/households/:householdId/tasks`

| Method | Path | Auth | Permission |
|--------|------|------|------------|
| POST | `/` | member | assign_task (if assigning to others) |
| GET | `/` | member | view_all |
| GET | `/today` | member | view_all |
| GET | `/upcoming` | member | view_all |
| GET | `/overdue` | member | view_all |
| GET | `/:taskId` | member | view_all |
| PUT | `/:taskId` | member | assign_task or own task |
| DELETE | `/:taskId` | member | delete_entity |
| POST | `/:taskId/complete` | assignee or parent | - |
| POST | `/:taskId/uncomplete` | parent/guardian | - |

**Query params:** `?assignedTo=userId&status=pending`

### Task Checklists — `/api/v1/tasks/:taskId/checklist`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | member | Add checklist step |
| PUT | `/:stepId` | member | Update/toggle step |
| DELETE | `/:stepId` | member | Remove step |
| PUT | `/reorder` | member | Reorder steps (body: { orderedIds }) |

### Task Rotations — `/api/v1/households/:householdId/rotations`

| Method | Path | Auth | Permission |
|--------|------|------|------------|
| POST | `/` | member | assign_task |
| GET | `/` | member | view_all |
| GET | `/:rotationId` | member | view_all |
| DELETE | `/:rotationId` | member | delete_entity |

### Routines — `/api/v1/households/:householdId/routines`

| Method | Path | Auth | Permission |
|--------|------|------|------------|
| POST | `/` | member | assign_task |
| GET | `/` | member | view_all |
| GET | `/:routineId` | member | view_all |
| PUT | `/:routineId` | member | own or parent |
| DELETE | `/:routineId` | member | delete_entity |
| POST | `/:routineId/steps` | member | own or parent |
| PUT | `/:routineId/steps/:stepId/complete` | member | assignee |
| PUT | `/:routineId/steps/:stepId/uncomplete` | member | assignee |
| PUT | `/:routineId/steps/reorder` | member | own or parent |
| DELETE | `/:routineId/steps/:stepId` | member | own or parent |

### Announcements — `/api/v1/households/:householdId/announcements`

| Method | Path | Auth | Permission |
|--------|------|------|------------|
| POST | `/` | member | create_announcement |
| GET | `/` | member | view_all |
| GET | `/pinned` | member | view_all |
| PUT | `/:id` | author or parent | - |
| DELETE | `/:id` | author or parent | delete_entity |
| POST | `/:id/pin` | parent/guardian | - |
| POST | `/:id/unpin` | parent/guardian | - |

### Comments — `/api/v1/comments`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | member | Add comment (body: { entityType, entityId, content }) |
| GET | `/:entityType/:entityId` | member | List comments on entity |
| PUT | `/:commentId` | author or parent | Edit comment |
| DELETE | `/:commentId` | author or parent | Delete comment |

### Handbook — `/api/v1/households/:householdId/handbook`

| Method | Path | Auth | Permission |
|--------|------|------|------------|
| POST | `/` | member | edit_handbook |
| GET | `/` | member | view_all |
| GET | `/pinned` | member | view_all |
| GET | `/search` | member | view_all |
| GET | `/:entryId` | member | view_all |
| PUT | `/:entryId` | member | edit_handbook or own |
| DELETE | `/:entryId` | member | delete_entity |

**Query params for search:** `?q=search+term`

### Notifications — `/api/v1/notifications`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | user | List own notifications |
| PUT | `/:id/read` | user | Mark as read |
| POST | `/read-all` | user | Mark all as read |
| DELETE | `/:id` | user | Delete notification |
| GET | `/preferences/:householdId` | user | Get notification prefs |
| PUT | `/preferences/:householdId` | user | Update notification prefs |
| POST | `/push/subscribe` | user | Register push subscription |
| DELETE | `/push/unsubscribe` | user | Remove push subscription |

### Export — `/api/v1/households/:householdId/export`

| Method | Path | Auth | Permission |
|--------|------|------|------------|
| GET | `/tasks` | member | export_data |
| GET | `/events` | member | export_data |

Returns CSV with `Content-Type: text/csv` and `Content-Disposition: attachment`.

### Audit Log — `/api/v1/households/:householdId/audit`

| Method | Path | Auth | Permission |
|--------|------|------|------------|
| GET | `/` | parent/guardian | manage_members |

**Query params:** `?userId=x&entityType=task&action=create&start=ISO&end=ISO&limit=50&offset=0`

## Response Formats

### Success
```json
{ "data": { ... } }
{ "data": [...], "total": 42, "limit": 20, "offset": 0 }
```

### Error
```json
{ "error": "Descriptive error message", "code": "PERMISSION_DENIED" }
```

### Standard Error Codes
- `VALIDATION_ERROR` (400)
- `UNAUTHORIZED` (401)
- `PERMISSION_DENIED` (403)
- `NOT_FOUND` (404)
- `CONFLICT` (409) — duplicate invite, member already exists
- `INTERNAL_ERROR` (500)

## Pagination

All list endpoints support:
- `?limit=20` (default 20, max 100)
- `?offset=0`
- Response includes `total` count

## Input Validation

All routes validate:
- Required fields present
- String lengths within limits (titles: 200, content: 5000)
- ISO date/time formats where applicable
- Valid enum values (role, task_type, difficulty, etc.)
- Array sizes within limits (steps: 50, images: 10)

Return 400 with `VALIDATION_ERROR` and specific field errors.
