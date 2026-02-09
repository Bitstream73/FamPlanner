import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initTestDatabase, closeDatabase, MIGRATIONS } from '../../src/config/database.js';

describe('MVP Migrations', () => {
  let db;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    db = initTestDatabase();
  });

  afterAll(() => {
    closeDatabase();
  });

  function getTableColumns(tableName) {
    return db.prepare(`PRAGMA table_info(${tableName})`).all().map((c) => c.name);
  }

  function tableExists(tableName) {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    ).get(tableName);
    return !!row;
  }

  function indexExists(indexName) {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name=?"
    ).get(indexName);
    return !!row;
  }

  describe('households table', () => {
    it('should exist after migrations', () => {
      expect(tableExists('households')).toBe(true);
    });

    it('should have required columns', () => {
      const cols = getTableColumns('households');
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'name', 'owner_id', 'created_at', 'updated_at',
      ]));
    });

    it('should enforce NOT NULL on name', () => {
      expect(() => {
        db.prepare('INSERT INTO households (name, owner_id) VALUES (NULL, 1)').run();
      }).toThrow();
    });

    it('should enforce foreign key on owner_id', () => {
      expect(() => {
        db.prepare('INSERT INTO households (name, owner_id) VALUES (?, ?)').run('Test', 99999);
      }).toThrow();
    });
  });

  describe('household_members table', () => {
    it('should exist after migrations', () => {
      expect(tableExists('household_members')).toBe(true);
    });

    it('should have required columns', () => {
      const cols = getTableColumns('household_members');
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'household_id', 'user_id', 'role', 'joined_at',
      ]));
    });

    it('should enforce role CHECK constraint', () => {
      // First create valid user and household
      db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run(
        'member-test@test.com', 'hash123', 'Tester'
      );
      const user = db.prepare("SELECT id FROM users WHERE email = ?").get('member-test@test.com');
      db.prepare('INSERT INTO households (name, owner_id) VALUES (?, ?)').run('Test House', user.id);
      const household = db.prepare("SELECT id FROM households WHERE name = ?").get('Test House');

      expect(() => {
        db.prepare(
          'INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)'
        ).run(household.id, user.id, 'invalid_role');
      }).toThrow();
    });

    it('should enforce UNIQUE(household_id, user_id)', () => {
      const user = db.prepare("SELECT id FROM users WHERE email = ?").get('member-test@test.com');
      const household = db.prepare("SELECT id FROM households WHERE name = ?").get('Test House');

      db.prepare(
        'INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)'
      ).run(household.id, user.id, 'parent');

      expect(() => {
        db.prepare(
          'INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)'
        ).run(household.id, user.id, 'teen');
      }).toThrow();
    });

    it('should cascade delete when household is deleted', () => {
      const household = db.prepare("SELECT id FROM households WHERE name = ?").get('Test House');
      db.prepare('DELETE FROM households WHERE id = ?').run(household.id);
      const members = db.prepare(
        'SELECT * FROM household_members WHERE household_id = ?'
      ).all(household.id);
      expect(members).toHaveLength(0);
    });
  });

  describe('household_invites table', () => {
    it('should exist after migrations', () => {
      expect(tableExists('household_invites')).toBe(true);
    });

    it('should have required columns', () => {
      const cols = getTableColumns('household_invites');
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'household_id', 'token', 'invited_by', 'invited_email',
        'role', 'expires_at', 'used_at', 'created_at',
      ]));
    });

    it('should enforce UNIQUE on token', () => {
      db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run(
        'inviter@test.com', 'hash123', 'Inviter'
      );
      const user = db.prepare("SELECT id FROM users WHERE email = ?").get('inviter@test.com');
      db.prepare('INSERT INTO households (name, owner_id) VALUES (?, ?)').run('Invite House', user.id);
      const household = db.prepare("SELECT id FROM households WHERE name = ?").get('Invite House');

      db.prepare(
        'INSERT INTO household_invites (household_id, token, invited_by, expires_at) VALUES (?, ?, ?, ?)'
      ).run(household.id, 'unique-token-1', user.id, 9999999999);

      expect(() => {
        db.prepare(
          'INSERT INTO household_invites (household_id, token, invited_by, expires_at) VALUES (?, ?, ?, ?)'
        ).run(household.id, 'unique-token-1', user.id, 9999999999);
      }).toThrow();
    });

    it('should enforce role CHECK constraint on invites', () => {
      const user = db.prepare("SELECT id FROM users WHERE email = ?").get('inviter@test.com');
      const household = db.prepare("SELECT id FROM households WHERE name = ?").get('Invite House');

      expect(() => {
        db.prepare(
          'INSERT INTO household_invites (household_id, token, invited_by, role, expires_at) VALUES (?, ?, ?, ?, ?)'
        ).run(household.id, 'token-bad-role', user.id, 'superadmin', 9999999999);
      }).toThrow();
    });
  });

  describe('profiles table', () => {
    it('should exist after migrations', () => {
      expect(tableExists('profiles')).toBe(true);
    });

    it('should have required columns', () => {
      const cols = getTableColumns('profiles');
      expect(cols).toEqual(expect.arrayContaining([
        'user_id', 'display_name', 'avatar_url', 'pronouns', 'updated_at',
      ]));
    });

    it('should enforce foreign key on user_id', () => {
      expect(() => {
        db.prepare('INSERT INTO profiles (user_id, display_name) VALUES (?, ?)').run(99999, 'Ghost');
      }).toThrow();
    });
  });

  describe('calendar_events table', () => {
    it('should exist after migrations', () => {
      expect(tableExists('calendar_events')).toBe(true);
    });

    it('should have required columns', () => {
      const cols = getTableColumns('calendar_events');
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'household_id', 'title', 'location', 'description',
        'start_time', 'end_time', 'responsible_user_id', 'created_by',
        'recurrence_rule', 'recurrence_parent_id', 'created_at', 'updated_at',
      ]));
    });

    it('should have time index', () => {
      expect(indexExists('idx_events_household_time')).toBe(true);
    });
  });

  describe('availability_blocks table', () => {
    it('should exist after migrations', () => {
      expect(tableExists('availability_blocks')).toBe(true);
    });

    it('should have required columns', () => {
      const cols = getTableColumns('availability_blocks');
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'user_id', 'household_id', 'start_time', 'end_time',
        'reason', 'recurring_day', 'created_at',
      ]));
    });

    it('should have user time index', () => {
      expect(indexExists('idx_avail_user_time')).toBe(true);
    });
  });

  describe('tasks table', () => {
    it('should exist after migrations', () => {
      expect(tableExists('tasks')).toBe(true);
    });

    it('should have required columns', () => {
      const cols = getTableColumns('tasks');
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'household_id', 'title', 'description', 'task_type',
        'assigned_to', 'created_by', 'due_date', 'difficulty',
        'time_estimate_minutes', 'status', 'completed_at',
        'completion_note', 'completion_photo_url', 'recurrence_rule',
        'rotation_id', 'created_at', 'updated_at',
      ]));
    });

    it('should enforce task_type CHECK constraint', () => {
      const user = db.prepare("SELECT id FROM users LIMIT 1").get();
      db.prepare('INSERT INTO households (name, owner_id) VALUES (?, ?)').run('Task House', user.id);
      const household = db.prepare("SELECT id FROM households WHERE name = ?").get('Task House');

      expect(() => {
        db.prepare(
          'INSERT INTO tasks (household_id, title, task_type, created_by) VALUES (?, ?, ?, ?)'
        ).run(household.id, 'Bad Task', 'invalid_type', user.id);
      }).toThrow();
    });

    it('should enforce status CHECK constraint', () => {
      const user = db.prepare("SELECT id FROM users LIMIT 1").get();
      const household = db.prepare("SELECT id FROM households WHERE name = ?").get('Task House');

      expect(() => {
        db.prepare(
          'INSERT INTO tasks (household_id, title, task_type, status, created_by) VALUES (?, ?, ?, ?, ?)'
        ).run(household.id, 'Bad Status', 'one_time', 'invalid_status', user.id);
      }).toThrow();
    });

    it('should enforce difficulty CHECK constraint', () => {
      const user = db.prepare("SELECT id FROM users LIMIT 1").get();
      const household = db.prepare("SELECT id FROM households WHERE name = ?").get('Task House');

      expect(() => {
        db.prepare(
          'INSERT INTO tasks (household_id, title, task_type, difficulty, created_by) VALUES (?, ?, ?, ?, ?)'
        ).run(household.id, 'Bad Difficulty', 'one_time', 'extreme', user.id);
      }).toThrow();
    });

    it('should have household and assigned indexes', () => {
      expect(indexExists('idx_tasks_household')).toBe(true);
      expect(indexExists('idx_tasks_assigned')).toBe(true);
    });
  });

  describe('task_checklists table', () => {
    it('should exist after migrations', () => {
      expect(tableExists('task_checklists')).toBe(true);
    });

    it('should have required columns', () => {
      const cols = getTableColumns('task_checklists');
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'task_id', 'title', 'is_complete', 'sort_order', 'created_at',
      ]));
    });

    it('should have task sort index', () => {
      expect(indexExists('idx_checklist_task')).toBe(true);
    });
  });

  describe('task_rotations table', () => {
    it('should exist after migrations', () => {
      expect(tableExists('task_rotations')).toBe(true);
    });

    it('should have required columns', () => {
      const cols = getTableColumns('task_rotations');
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'household_id', 'name', 'member_order', 'current_index', 'created_at',
      ]));
    });
  });

  describe('routines table', () => {
    it('should exist after migrations', () => {
      expect(tableExists('routines')).toBe(true);
    });

    it('should have required columns', () => {
      const cols = getTableColumns('routines');
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'household_id', 'name', 'routine_type', 'assigned_to',
        'auto_reset', 'created_by', 'created_at', 'updated_at',
      ]));
    });

    it('should enforce routine_type CHECK constraint', () => {
      const user = db.prepare("SELECT id FROM users LIMIT 1").get();
      const household = db.prepare("SELECT id FROM households LIMIT 1").get();

      expect(() => {
        db.prepare(
          'INSERT INTO routines (household_id, name, routine_type, created_by) VALUES (?, ?, ?, ?)'
        ).run(household.id, 'Bad Routine', 'invalid_type', user.id);
      }).toThrow();
    });
  });

  describe('routine_steps table', () => {
    it('should exist after migrations', () => {
      expect(tableExists('routine_steps')).toBe(true);
    });

    it('should have required columns', () => {
      const cols = getTableColumns('routine_steps');
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'routine_id', 'title', 'is_complete', 'sort_order',
        'completed_at', 'created_at',
      ]));
    });

    it('should have routine steps index', () => {
      expect(indexExists('idx_routine_steps')).toBe(true);
    });
  });

  describe('announcements table', () => {
    it('should exist after migrations', () => {
      expect(tableExists('announcements')).toBe(true);
    });

    it('should have required columns', () => {
      const cols = getTableColumns('announcements');
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'household_id', 'author_id', 'content', 'is_pinned',
        'created_at', 'updated_at',
      ]));
    });

    it('should have household index', () => {
      expect(indexExists('idx_announcements_household')).toBe(true);
    });
  });

  describe('comments table', () => {
    it('should exist after migrations', () => {
      expect(tableExists('comments')).toBe(true);
    });

    it('should have required columns', () => {
      const cols = getTableColumns('comments');
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'entity_type', 'entity_id', 'author_id', 'content',
        'created_at', 'updated_at',
      ]));
    });

    it('should enforce entity_type CHECK constraint', () => {
      const user = db.prepare("SELECT id FROM users LIMIT 1").get();

      expect(() => {
        db.prepare(
          'INSERT INTO comments (entity_type, entity_id, author_id, content) VALUES (?, ?, ?, ?)'
        ).run('invalid', 'some-id', user.id, 'Bad comment');
      }).toThrow();
    });

    it('should have entity index', () => {
      expect(indexExists('idx_comments_entity')).toBe(true);
    });
  });

  describe('mentions table', () => {
    it('should exist after migrations', () => {
      expect(tableExists('mentions')).toBe(true);
    });

    it('should have required columns', () => {
      const cols = getTableColumns('mentions');
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'comment_id', 'announcement_id', 'mentioned_user_id', 'created_at',
      ]));
    });
  });

  describe('handbook_entries table', () => {
    it('should exist after migrations', () => {
      expect(tableExists('handbook_entries')).toBe(true);
    });

    it('should have required columns', () => {
      const cols = getTableColumns('handbook_entries');
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'household_id', 'title', 'entry_type', 'content',
        'steps', 'image_urls', 'is_pinned', 'created_by',
        'created_at', 'updated_at',
      ]));
    });

    it('should enforce entry_type CHECK constraint', () => {
      const user = db.prepare("SELECT id FROM users LIMIT 1").get();
      const household = db.prepare("SELECT id FROM households LIMIT 1").get();

      expect(() => {
        db.prepare(
          'INSERT INTO handbook_entries (household_id, title, entry_type, content, created_by) VALUES (?, ?, ?, ?, ?)'
        ).run(household.id, 'Bad Entry', 'invalid', 'Content', user.id);
      }).toThrow();
    });

    it('should have household index', () => {
      expect(indexExists('idx_handbook_household')).toBe(true);
    });
  });

  describe('notifications table', () => {
    it('should exist after migrations', () => {
      expect(tableExists('notifications')).toBe(true);
    });

    it('should have required columns', () => {
      const cols = getTableColumns('notifications');
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'user_id', 'household_id', 'type', 'title', 'body',
        'entity_type', 'entity_id', 'is_read', 'sent_push',
        'sent_email', 'created_at',
      ]));
    });

    it('should enforce notification type CHECK constraint', () => {
      const user = db.prepare("SELECT id FROM users LIMIT 1").get();
      const household = db.prepare("SELECT id FROM households LIMIT 1").get();

      expect(() => {
        db.prepare(
          'INSERT INTO notifications (user_id, household_id, type, title) VALUES (?, ?, ?, ?)'
        ).run(user.id, household.id, 'invalid_type', 'Bad Notification');
      }).toThrow();
    });

    it('should have user index', () => {
      expect(indexExists('idx_notifications_user')).toBe(true);
    });
  });

  describe('notification_preferences table', () => {
    it('should exist after migrations', () => {
      expect(tableExists('notification_preferences')).toBe(true);
    });

    it('should have required columns', () => {
      const cols = getTableColumns('notification_preferences');
      expect(cols).toEqual(expect.arrayContaining([
        'user_id', 'household_id', 'push_enabled', 'email_enabled',
        'quiet_start', 'quiet_end', 'digest_enabled',
      ]));
    });
  });

  describe('audit_log table', () => {
    it('should exist after migrations', () => {
      expect(tableExists('audit_log')).toBe(true);
    });

    it('should have required columns', () => {
      const cols = getTableColumns('audit_log');
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'household_id', 'user_id', 'action', 'entity_type',
        'entity_id', 'details', 'created_at',
      ]));
    });

    it('should enforce action CHECK constraint', () => {
      const user = db.prepare("SELECT id FROM users LIMIT 1").get();
      const household = db.prepare("SELECT id FROM households LIMIT 1").get();

      expect(() => {
        db.prepare(
          'INSERT INTO audit_log (household_id, user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)'
        ).run(household.id, user.id, 'invalid_action', 'task', 'some-id');
      }).toThrow();
    });

    it('should have household and entity indexes', () => {
      expect(indexExists('idx_audit_household')).toBe(true);
      expect(indexExists('idx_audit_entity')).toBe(true);
    });
  });

  describe('migration runner', () => {
    it('should track MVP migration in migrations table', () => {
      const migrations = db.prepare('SELECT * FROM migrations WHERE id >= 2').all();
      expect(migrations.length).toBeGreaterThanOrEqual(1);
      expect(migrations.some((m) => m.name === 'mvp_schema')).toBe(true);
    });
  });
});
