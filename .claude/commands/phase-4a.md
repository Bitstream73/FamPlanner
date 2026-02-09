# Phase 4A: User Authentication & Email 2FA (Resend)

## Objective
Implement user accounts with two-factor authentication via email. Uses Resend for transactional email and bcrypt for password/code hashing.

## Plan First
Read `docs/AUTH.md` for the full authentication specification. Propose your plan covering:
1. Database migrations for users, two_factor_codes, sessions
2. Auth service (password hashing, code generation, session management)
3. Email service (Resend integration)
4. Auth middleware (session cookie → req.user)
5. Auth routes
6. Tests

Wait for approval.

## Dependencies to Add

```bash
npm install resend bcrypt cookie-parser
```

## Steps

### 1. Database Migration — Auth Tables

Add migration to create these tables (see `docs/AUTH.md` for full schema):

**`users`** — id, email (unique), password_hash, display_name, is_verified, created_at, updated_at
**`two_factor_codes`** — id, user_id (FK), code (hashed), expires_at, used, created_at
**`sessions`** — id (UUID PK), user_id (FK), expires_at, created_at

Index on: `users.email`, `sessions.user_id`, `two_factor_codes.user_id`

### 2. `src/services/email.js` — Resend Integration

- Initialize Resend client from `RESEND_API_KEY` env var
- `sendVerificationCode(email, code)` — sends the 2FA email
- **Log all email operations:**
  - `logger.info('email', '2fa_sent', { to: email, duration })`
  - `logger.error('email', 'send_failed', { to: email }, errorMessage)`
- NEVER log the actual code
- In test/development without a valid key, log the code to console instead of sending (for dev convenience) and log a warning: `logger.warn('email', 'dev_mode', { message: 'Code logged to console, not emailed' })`

### 3. `src/services/auth.js` — Core Auth Logic

- `hashPassword(plain)` — bcrypt, 12 rounds
- `verifyPassword(plain, hash)` — bcrypt compare
- `generateTwoFactorCode()` — cryptographically random 6-digit string
- `hashCode(code)` — bcrypt, 10 rounds (faster than password, still secure)
- `verifyCode(plain, hash)` — bcrypt compare
- `createSession(userId)` — generate UUID, insert to sessions table, return session ID
- `getSessionUser(sessionId)` — look up session, check expiry, return user or null
- `deleteSession(sessionId)` — remove from DB
- `cleanExpiredSessions()` — delete expired sessions (run on startup)
- `cleanExpiredCodes()` — delete expired 2FA codes (run on startup)
- **Log all auth events:**
  - `logger.info('auth', 'register', { email })`
  - `logger.info('auth', 'login_attempt', { email })`
  - `logger.info('auth', '2fa_verified', { email })`
  - `logger.warn('auth', '2fa_failed', { email, reason })`
  - `logger.warn('auth', 'login_failed', { email, reason })`
  - `logger.info('auth', 'logout', { userId })`

### 4. `src/middleware/authenticate.js`

- Parse session cookie via `cookie-parser`
- Look up session → attach `req.user` or `null`
- Always call `next()` — does not block

### 5. `src/middleware/requireAuth.js`

- If `!req.user`, return `401 { error: 'Authentication required' }`
- Use on protected routes

### 6. `src/routes/auth.js` — Auth Endpoints

**`POST /api/auth/register`**
- Body: `{ email, password, displayName? }`
- Validate email format, password strength (8+ chars, 1 uppercase, 1 number)
- Check email not already registered
- Hash password, insert user
- Generate 2FA code, hash it, store it (10 min TTL), invalidate previous codes
- Send code via Resend
- Return `201 { message: "Verification code sent", userId }`
- Rate limit: 5/15min per IP

**`POST /api/auth/login`**
- Body: `{ email, password }`
- Verify email exists and password matches
- Generate + hash + store 2FA code, invalidate previous
- Send code via Resend
- Return `200 { message: "2FA code sent", requiresTwoFactor: true }`
- Rate limit: 5/15min per email

**`POST /api/auth/verify-2fa`**
- Body: `{ email, code }`
- Find latest unused, non-expired code for user
- Verify via bcrypt
- If valid: mark used, set is_verified=1, create session, set cookie
- Cookie: `session_id`, httpOnly, secure (in production), sameSite strict, 7 days
- Return `200 { message: "Authenticated", user: { id, email, displayName } }`
- Rate limit: 3/15min per email
- If invalid: return `401 { error: "Invalid or expired code" }`

**`POST /api/auth/logout`**
- Delete session, clear cookie
- Return `200 { message: "Logged out" }`

**`GET /api/auth/me`**
- If `req.user`: return `200 { user: { id, email, displayName } }`
- Else: return `401 { error: "Not authenticated" }`

### 7. Wire Into Express App

In `src/index.js`:
- Add `cookie-parser` middleware (with `SESSION_SECRET`)
- Add `authenticate` middleware globally (after cookie-parser)
- Register auth routes at `/api/auth`
- Add `requireAuth` to protected route groups (quotes, authors, settings, logs)

## Tests — `tests/unit/auth.test.js`

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Auth Service', () => {
  let authService;

  beforeEach(async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.SESSION_SECRET = 'test-secret-that-is-at-least-32-chars-long';
    const mod = await import('../../src/services/auth.js');
    authService = mod.default;
  });
  afterEach(() => vi.restoreAllMocks());

  it('should hash and verify a password', async () => {
    const hash = await authService.hashPassword('MyP@ssw0rd');
    expect(hash).not.toBe('MyP@ssw0rd');
    expect(await authService.verifyPassword('MyP@ssw0rd', hash)).toBe(true);
    expect(await authService.verifyPassword('wrong', hash)).toBe(false);
  });

  it('should generate a 6-digit code', () => {
    const code = authService.generateTwoFactorCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('should hash and verify a 2FA code', async () => {
    const code = '123456';
    const hash = await authService.hashCode(code);
    expect(hash).not.toBe(code);
    expect(await authService.verifyCode(code, hash)).toBe(true);
    expect(await authService.verifyCode('000000', hash)).toBe(false);
  });
});
```

## Tests — `tests/unit/email.test.js`

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: 'email-123' })
    }
  }))
}));

describe('Email Service', () => {
  let emailService;

  beforeEach(async () => {
    vi.resetModules();
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.RESEND_FROM_EMAIL = 'test@example.com';
    const mod = await import('../../src/services/email.js');
    emailService = mod.default;
  });

  it('should send a 2FA verification email', async () => {
    const result = await emailService.sendVerificationCode('user@test.com', '123456');
    expect(result).toHaveProperty('id');
  });

  it('should handle send failures without crashing', async () => {
    const { Resend } = await import('resend');
    Resend.mockImplementationOnce(() => ({
      emails: { send: vi.fn().mockRejectedValue(new Error('Resend down')) }
    }));
    vi.resetModules();
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM_EMAIL = 'test@example.com';
    const mod = await import('../../src/services/email.js');
    await expect(mod.default.sendVerificationCode('user@test.com', '123456')).rejects.toThrow();
  });
});
```

## Tests — `tests/integration/auth-routes.test.js`

```javascript
import { describe, it, expect, beforeAll, vi } from 'vitest';
import supertest from 'supertest';

// Mock Resend so we don't send real emails in tests
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({ id: 'test-email' }) }
  }))
}));

describe('Auth Routes', () => {
  let app, request;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.PINECONE_API_KEY = 'test-key';
    process.env.PINECONE_INDEX_HOST = 'https://test.pinecone.io';
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.RESEND_FROM_EMAIL = 'noreply@test.com';
    process.env.SESSION_SECRET = 'test-secret-that-is-at-least-32-characters';
    const { createApp } = await import('../../src/index.js');
    app = await createApp();
    request = supertest(app);
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user and return 201', async () => {
      const res = await request.post('/api/auth/register').send({
        email: 'newuser@test.com',
        password: 'StrongP@ss1',
        displayName: 'Test User'
      });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('userId');
    });

    it('should reject duplicate email', async () => {
      await request.post('/api/auth/register').send({
        email: 'dupe@test.com', password: 'StrongP@ss1'
      });
      const res = await request.post('/api/auth/register').send({
        email: 'dupe@test.com', password: 'StrongP@ss1'
      });
      expect(res.status).toBe(409);
    });

    it('should reject weak passwords', async () => {
      const res = await request.post('/api/auth/register').send({
        email: 'weak@test.com', password: 'short'
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should return requiresTwoFactor for valid credentials', async () => {
      // Register first
      await request.post('/api/auth/register').send({
        email: 'login@test.com', password: 'StrongP@ss1'
      });
      const res = await request.post('/api/auth/login').send({
        email: 'login@test.com', password: 'StrongP@ss1'
      });
      expect(res.status).toBe(200);
      expect(res.body.requiresTwoFactor).toBe(true);
    });

    it('should reject invalid password', async () => {
      const res = await request.post('/api/auth/login').send({
        email: 'login@test.com', password: 'WrongPassword1'
      });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 when not authenticated', async () => {
      const res = await request.get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('Protected routes require auth', () => {
    it('GET /api/quotes should return 401 without session', async () => {
      const res = await request.get('/api/quotes');
      expect(res.status).toBe(401);
    });

    it('GET /api/settings should return 401 without session', async () => {
      const res = await request.get('/api/settings');
      expect(res.status).toBe(401);
    });

    it('GET /api/logs should return 401 without session', async () => {
      const res = await request.get('/api/logs');
      expect(res.status).toBe(401);
    });
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
git add -A && git commit -m "phase-4a: user auth with email 2fa via resend" && git push
```

Report: "Phase 4A complete. N/N tests passing. Auth system operational with email 2FA. Ready for /phase-5."
