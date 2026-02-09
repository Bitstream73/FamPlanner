# Phase 2: Configuration, Database & Logging Foundation

## Objective
Set up configuration management, SQLite database, and the application-wide logging service.

## Plan First
Read `docs/LOGGING.md` for the full logging specification. Propose your plan, then wait for approval.

## Steps

### 1. `src/config/index.js`
- Load env vars via dotenv
- Export a typed config object with defaults:
  - `env`, `port`, `databasePath`, `geminiApiKey`, `pineconeApiKey`, `pineconeIndexHost`
  - `resendApiKey`, `resendFromEmail`, `sessionSecret`
- Validate required vars on import

### 2. `src/utils/validateEnv.js`
- Check all required env vars exist
- Return `{ valid: boolean, missing: string[] }`
- Provide helpful error messages

### 3. `src/config/database.js`
- Initialize SQLite with better-sqlite3
- Enable WAL mode and foreign keys
- Create tables (via migrations):
  - `quotes` (id, text, author, source_url, source_name, published_date, created_at)
  - `authors` (id, name, bio, image_url, created_at)
  - `quote_sources` (id, quote_id, source_url, source_name, published_date)
  - `settings` (id, key, value, created_at, updated_at)
  - `application_logs` (id, timestamp, level, category, action, request_id, ip_address, details, duration, error, created_at)
  - `users` (id, email UNIQUE, password_hash, display_name, is_verified, created_at, updated_at) — see `docs/AUTH.md`
  - `two_factor_codes` (id, user_id FK, code, expires_at, used, created_at) — see `docs/AUTH.md`
  - `sessions` (id TEXT PK, user_id FK, expires_at, created_at) — see `docs/AUTH.md`
- Index `application_logs` on: timestamp, level, category
- Index `users` on: email
- Index `sessions` on: user_id
- Index `two_factor_codes` on: user_id

### 4. `src/services/logger.js` — CRITICAL FOUNDATION
Read `docs/LOGGING.md` for the full spec. Implement:
- Log levels: error, warn, info, debug
- Write to both console (formatted) and `application_logs` table
- Sanitize sensitive data (redact keys matching: key, token, secret, password, authorization, hash, code, session)
- `logger.child(context)` for per-request loggers
- Debug level only in development
- Auto-rotate: delete logs >30 days on startup
- Handle database errors gracefully (never throw from logger)

### 5. Database migration system
- Track applied migrations in a `migrations` table
- Auto-run pending migrations on startup
- Log migration events

## Tests

### `tests/unit/config.test.js`
```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => { vi.resetModules(); process.env = { ...originalEnv }; });
  afterEach(() => { process.env = originalEnv; });

  it('should load config from environment variables', async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '4000';
    process.env.GEMINI_API_KEY = 'test-key';
    const { default: config } = await import('../../src/config/index.js');
    expect(config.env).toBe('test');
    expect(config.port).toBe(4000);
  });

  it('should report missing required variables', async () => {
    delete process.env.GEMINI_API_KEY;
    const { validateEnv } = await import('../../src/utils/validateEnv.js');
    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('GEMINI_API_KEY');
  });

  it('should use default port when PORT is not set', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    delete process.env.PORT;
    const { default: config } = await import('../../src/config/index.js');
    expect(config.port).toBe(3000);
  });
});
```

### `tests/unit/database.test.js`
```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

describe('Database Setup', () => {
  let db;
  const testDbPath = path.join(import.meta.dirname, '../test-phase2.db');

  beforeAll(() => {
    db = new Database(testDbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  });
  afterAll(() => { db.close(); if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath); });

  it('should create quotes table with required columns', () => {
    db.exec(`CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, author TEXT NOT NULL,
      source_url TEXT, source_name TEXT, published_date INTEGER, created_at INTEGER DEFAULT (unixepoch())
    )`);
    const cols = db.prepare("PRAGMA table_info(quotes)").all().map(c => c.name);
    expect(cols).toEqual(expect.arrayContaining(['id', 'text', 'author', 'source_url']));
  });

  it('should create application_logs table with required columns', () => {
    db.exec(`CREATE TABLE IF NOT EXISTS application_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL,
      level TEXT NOT NULL CHECK(level IN ('error','warn','info','debug')),
      category TEXT NOT NULL, action TEXT NOT NULL, request_id TEXT, ip_address TEXT,
      details TEXT, duration INTEGER, error TEXT, created_at INTEGER DEFAULT (unixepoch())
    )`);
    const cols = db.prepare("PRAGMA table_info(application_logs)").all().map(c => c.name);
    expect(cols).toEqual(expect.arrayContaining(['timestamp', 'level', 'category', 'action', 'request_id']));
  });

  it('should support WAL mode', () => {
    expect(db.pragma('journal_mode')[0].journal_mode).toBe('wal');
  });
});
```

### `tests/unit/logger.test.js`
```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Logger Service', () => {
  let logger, mockDb;

  beforeEach(async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'test';
    mockDb = { prepare: vi.fn().mockReturnValue({ run: vi.fn() }) };
    vi.doMock('../../src/config/database.js', () => ({ default: { db: mockDb } }));
    const mod = await import('../../src/services/logger.js');
    logger = mod.default;
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('should write log entries to the database', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('system', 'startup', { version: '1.0.0' });
    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO application_logs'));
  });

  it('should redact sensitive fields in details', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('ai', 'request', { apiKey: 'AIzaSy_REAL_KEY', model: 'gemini' });
    const logged = JSON.parse(spy.mock.calls[0][1]);
    expect(logged.details.apiKey).toBe('[REDACTED]');
    expect(logged.details.model).toBe('gemini');
  });

  it('should include ISO8601 timestamp and all required fields', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('api', 'request', { path: '/test' });
    const logged = JSON.parse(spy.mock.calls[0][1]);
    expect(logged.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(logged).toHaveProperty('level', 'info');
    expect(logged).toHaveProperty('category', 'api');
    expect(logged).toHaveProperty('action', 'request');
  });

  it('should create child logger with preset context', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const child = logger.child({ requestId: 'req-abc' });
    child.info('api', 'handler', { path: '/x' });
    const logged = JSON.parse(spy.mock.calls[0][1]);
    expect(logged.requestId).toBe('req-abc');
  });

  it('should not throw if database write fails', () => {
    mockDb.prepare.mockImplementation(() => { throw new Error('DB down'); });
    expect(() => logger.info('test', 'action', {})).not.toThrow();
  });
});
```

## Verification
```bash
npx vitest run
```
All tests must pass.

## Checkpoint
```bash
git add -A && git commit -m "phase-2: config, database, logger" && git push
```

Report: "Phase 2 complete. N/N tests passing. Logger operational. Ready for /phase-3."
