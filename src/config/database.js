import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import config from './index.js';

const MIGRATIONS = [
  {
    id: 1,
    name: 'initial_schema',
    up: `
      CREATE TABLE IF NOT EXISTS quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        author TEXT NOT NULL,
        source_url TEXT,
        source_name TEXT,
        published_date INTEGER,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS authors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        bio TEXT,
        image_url TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS quote_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_id INTEGER NOT NULL,
        source_url TEXT,
        source_name TEXT,
        published_date INTEGER,
        FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS application_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL CHECK(level IN ('error','warn','info','debug')),
        category TEXT NOT NULL,
        action TEXT NOT NULL,
        request_id TEXT,
        ip_address TEXT,
        details TEXT,
        duration INTEGER,
        error TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON application_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_logs_level ON application_logs(level);
      CREATE INDEX IF NOT EXISTS idx_logs_category ON application_logs(category);

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        is_verified INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

      CREATE TABLE IF NOT EXISTS two_factor_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        code TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        used INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_2fa_user_id ON two_factor_codes(user_id);

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    `,
  },
  {
    id: 2,
    name: 'mvp_schema',
    up: `
      CREATE TABLE IF NOT EXISTS households (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        owner_id INTEGER NOT NULL REFERENCES users(id),
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS household_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('parent', 'guardian', 'teen', 'kid', 'caregiver')),
        joined_at INTEGER DEFAULT (unixepoch()),
        UNIQUE(household_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS household_invites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        invited_by INTEGER NOT NULL REFERENCES users(id),
        invited_email TEXT,
        role TEXT NOT NULL DEFAULT 'parent' CHECK(role IN ('parent', 'guardian', 'teen', 'kid', 'caregiver')),
        expires_at INTEGER NOT NULL,
        used_at INTEGER,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS profiles (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        display_name TEXT,
        avatar_url TEXT,
        pronouns TEXT,
        updated_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        location TEXT,
        description TEXT,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        responsible_user_id INTEGER REFERENCES users(id),
        created_by INTEGER NOT NULL REFERENCES users(id),
        recurrence_rule TEXT,
        recurrence_parent_id INTEGER REFERENCES calendar_events(id),
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_events_household_time ON calendar_events(household_id, start_time, end_time);

      CREATE TABLE IF NOT EXISTS availability_blocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        reason TEXT,
        recurring_day INTEGER,
        created_at INTEGER DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_avail_user_time ON availability_blocks(user_id, start_time, end_time);

      CREATE TABLE IF NOT EXISTS task_rotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        member_order TEXT NOT NULL,
        current_index INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        task_type TEXT NOT NULL DEFAULT 'one_time' CHECK(task_type IN ('one_time', 'recurring')),
        assigned_to INTEGER REFERENCES users(id),
        created_by INTEGER NOT NULL REFERENCES users(id),
        due_date INTEGER,
        difficulty TEXT DEFAULT 'medium' CHECK(difficulty IN ('easy', 'medium', 'hard')),
        time_estimate_minutes INTEGER,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'overdue')),
        completed_at INTEGER,
        completion_note TEXT,
        completion_photo_url TEXT,
        recurrence_rule TEXT,
        rotation_id INTEGER REFERENCES task_rotations(id),
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_household ON tasks(household_id, status);
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to, due_date);

      CREATE TABLE IF NOT EXISTS task_checklists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        is_complete INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_checklist_task ON task_checklists(task_id, sort_order);

      CREATE TABLE IF NOT EXISTS routines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        routine_type TEXT NOT NULL CHECK(routine_type IN ('morning', 'evening', 'leaving', 'custom')),
        assigned_to INTEGER REFERENCES users(id),
        auto_reset INTEGER NOT NULL DEFAULT 0,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS routine_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        is_complete INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        completed_at INTEGER,
        created_at INTEGER DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_routine_steps ON routine_steps(routine_id, sort_order);

      CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        author_id INTEGER NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_announcements_household ON announcements(household_id, created_at);

      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL CHECK(entity_type IN ('task', 'event')),
        entity_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id, created_at);

      CREATE TABLE IF NOT EXISTS mentions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
        announcement_id INTEGER REFERENCES announcements(id) ON DELETE CASCADE,
        mentioned_user_id INTEGER NOT NULL REFERENCES users(id),
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS handbook_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        entry_type TEXT NOT NULL CHECK(entry_type IN ('note', 'howto')),
        content TEXT NOT NULL,
        steps TEXT,
        image_urls TEXT,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_handbook_household ON handbook_entries(household_id, entry_type);

      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK(type IN ('task_assigned', 'task_due', 'event_reminder', 'mention', 'announcement', 'comment', 'invite', 'chore_rotation')),
        title TEXT NOT NULL,
        body TEXT,
        entity_type TEXT,
        entity_id INTEGER,
        is_read INTEGER NOT NULL DEFAULT 0,
        sent_push INTEGER NOT NULL DEFAULT 0,
        sent_email INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at);

      CREATE TABLE IF NOT EXISTS notification_preferences (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        push_enabled INTEGER NOT NULL DEFAULT 1,
        email_enabled INTEGER NOT NULL DEFAULT 0,
        quiet_start TEXT,
        quiet_end TEXT,
        digest_enabled INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, household_id)
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete', 'assign', 'complete', 'join', 'leave')),
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        details TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_audit_household ON audit_log(household_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
    `,
  },
];

function ensureDataDir(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function initDatabase(dbPath) {
  ensureDataDir(dbPath);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER DEFAULT (unixepoch())
    )
  `);

  const applied = new Set(
    db.prepare('SELECT id FROM migrations').all().map((r) => r.id)
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    db.exec(migration.up);
    db.prepare('INSERT INTO migrations (id, name) VALUES (?, ?)').run(
      migration.id,
      migration.name
    );
  }
}

const database = { db: null };

if (config.env !== 'test') {
  database.db = initDatabase(config.databasePath);
  runMigrations(database.db);
}

function initTestDatabase(dbPath = ':memory:') {
  database.db = initDatabase(dbPath);
  runMigrations(database.db);
  return database.db;
}

function closeDatabase() {
  if (database.db) {
    database.db.close();
    database.db = null;
  }
}

export default database;
export { initDatabase, runMigrations, initTestDatabase, closeDatabase, MIGRATIONS };
