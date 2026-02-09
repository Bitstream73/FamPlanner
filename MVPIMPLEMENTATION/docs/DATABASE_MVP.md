# Database Schema — MVP Extensions

All tables use SQLite via better-sqlite3. WAL mode, foreign keys ON. Migrations live in `src/database/migrations/`.

## Migration Pattern

Each migration file exports `up(db)` and `down(db)`. The migration runner executes them in order, tracks applied migrations in a `_migrations` table.

```js
// src/database/migrations/001-households.js
export function up(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS ...`);
}
export function down(db) {
  db.exec(`DROP TABLE IF EXISTS ...`);
}
```

## Tables

### households
```sql
CREATE TABLE households (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### household_members
```sql
CREATE TABLE household_members (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('parent', 'guardian', 'teen', 'kid', 'caregiver')),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(household_id, user_id)
);
```

### household_invites
```sql
CREATE TABLE household_invites (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL REFERENCES users(id),
  invited_email TEXT,
  role TEXT NOT NULL DEFAULT 'parent' CHECK(role IN ('parent', 'guardian', 'teen', 'kid', 'caregiver')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### profiles (extends existing users table)
```sql
CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  pronouns TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### calendar_events
```sql
CREATE TABLE calendar_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  location TEXT,
  description TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  responsible_user_id TEXT REFERENCES users(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  recurrence_rule TEXT,
  recurrence_parent_id TEXT REFERENCES calendar_events(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_events_household_time ON calendar_events(household_id, start_time, end_time);
```

### availability_blocks
```sql
CREATE TABLE availability_blocks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  reason TEXT,
  recurring_day INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_avail_user_time ON availability_blocks(user_id, start_time, end_time);
```

### tasks
```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL DEFAULT 'one_time' CHECK(task_type IN ('one_time', 'recurring')),
  assigned_to TEXT REFERENCES users(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  due_date TEXT,
  difficulty TEXT DEFAULT 'medium' CHECK(difficulty IN ('easy', 'medium', 'hard')),
  time_estimate_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'overdue')),
  completed_at TEXT,
  completion_note TEXT,
  completion_photo_url TEXT,
  recurrence_rule TEXT,
  rotation_id TEXT REFERENCES task_rotations(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_tasks_household ON tasks(household_id, status);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to, due_date);
```

### task_checklists
```sql
CREATE TABLE task_checklists (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_complete INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_checklist_task ON task_checklists(task_id, sort_order);
```

### task_rotations
```sql
CREATE TABLE task_rotations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  member_order TEXT NOT NULL,
  current_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Note: `member_order` is a JSON array of user IDs: `["user1","user2","user3"]`

### routines
```sql
CREATE TABLE routines (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  routine_type TEXT NOT NULL CHECK(routine_type IN ('morning', 'evening', 'leaving', 'custom')),
  assigned_to TEXT REFERENCES users(id),
  auto_reset INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### routine_steps
```sql
CREATE TABLE routine_steps (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_complete INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_routine_steps ON routine_steps(routine_id, sort_order);
```

### announcements
```sql
CREATE TABLE announcements (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_announcements_household ON announcements(household_id, created_at);
```

### comments
```sql
CREATE TABLE comments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  entity_type TEXT NOT NULL CHECK(entity_type IN ('task', 'event')),
  entity_id TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_comments_entity ON comments(entity_type, entity_id, created_at);
```

### mentions
```sql
CREATE TABLE mentions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
  announcement_id TEXT REFERENCES announcements(id) ON DELETE CASCADE,
  mentioned_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### handbook_entries
```sql
CREATE TABLE handbook_entries (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK(entry_type IN ('note', 'howto')),
  content TEXT NOT NULL,
  steps TEXT,
  image_urls TEXT,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_handbook_household ON handbook_entries(household_id, entry_type);
```

Note: `steps` is a JSON array: `["Step 1", "Step 2"]`. `image_urls` is a JSON array.

### notifications
```sql
CREATE TABLE notifications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('task_assigned', 'task_due', 'event_reminder', 'mention', 'announcement', 'comment', 'invite', 'chore_rotation')),
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT,
  entity_id TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  sent_push INTEGER NOT NULL DEFAULT 0,
  sent_email INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at);
```

### notification_preferences
```sql
CREATE TABLE notification_preferences (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  push_enabled INTEGER NOT NULL DEFAULT 1,
  email_enabled INTEGER NOT NULL DEFAULT 0,
  quiet_start TEXT,
  quiet_end TEXT,
  digest_enabled INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, household_id)
);
```

### audit_log
```sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete', 'assign', 'complete', 'join', 'leave')),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_household ON audit_log(household_id, created_at);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
```

## Test Expectations

- Each migration runs without error on a fresh DB
- `down()` reverses the `up()` cleanly
- Foreign key constraints enforced (insert invalid FK → error)
- CHECK constraints enforced (invalid role → error)
- Indexes exist after migration (query `sqlite_master`)
- All tables have expected columns with correct types
