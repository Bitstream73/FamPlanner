# Phase 6: Frontend, API Routes & Logs Viewer

## Objective
Build the PWA frontend, all API routes, and the settings page with logs viewer.

## Plan First
This is the largest phase. Propose your plan broken into sub-steps:
1. API routes first (testable independently)
2. Frontend HTML/CSS/JS
3. Logs viewer

Wait for approval.

## Steps — API Routes

**Important:** Read `docs/AUTH.md` — all routes below except auth and health require authentication via `requireAuth` middleware.

### 1. `src/routes/quotes.js` (protected)
- `GET /api/quotes` — paginated, sorted by date (newest first). Returns `{ quotes, total, page, totalPages }`
- `GET /api/quotes/:id` — single quote with sources

### 2. `src/routes/authors.js` (protected)
- `GET /api/authors` — all authors with quote counts. Returns `{ authors }`
- `GET /api/authors/:id` — author with their quotes

### 3. `src/routes/settings.js` (protected)
- `GET /api/settings` — get all settings as key-value object
- `PUT /api/settings` — update settings

### 4. `src/routes/logs.js` — Comprehensive Logs API (protected)
- `GET /api/logs` — paginated with filters
  - Query: `page`, `limit`, `level`, `category`, `action`, `startDate`, `endDate`, `search`
  - Returns: `{ logs, total, page, totalPages }`
- `GET /api/logs/stats` — aggregate statistics
  - Returns: `{ errorCount24h, warningCount24h, requestsPerHour, topCategories }`
- `GET /api/logs/export` — CSV download
  - Query: `startDate`, `endDate`, `level`, `category`
  - Returns: CSV file with `Content-Disposition: attachment`
- `DELETE /api/logs` — clear logs older than 7 days

### 5. Register all routes in `src/index.js`

## Steps — Frontend

### 6. `public/index.html`
- HTML5 with PWA meta tags
- Link to manifest.json, CSS, JS modules
- Container div for SPA-style routing

### 7. `public/manifest.json`
- App name: "Quote Log"
- Icons, theme colors, display: standalone

### 8. `public/sw.js`
- Cache static assets
- Background sync capability

### 9. `public/css/styles.css`
- CSS variables for theming
- Mobile-first responsive design
- Dark mode via `prefers-color-scheme` + settings toggle
- Component styles: cards, buttons, modals, tables, badges

### 10. `public/js/` modules
- `app.js` — SPA router, page mounting, auth state management (check `/api/auth/me` on load)
- `api.js` — fetch wrapper with error handling, auto-redirect to login on 401
- `auth.js` — **Login/Register/2FA pages:**
  - Register form: email, password, display name → calls `/api/auth/register`
  - Login form: email, password → calls `/api/auth/login`
  - 2FA verification form: 6-digit code input → calls `/api/auth/verify-2fa`
  - Auto-redirect to app after successful 2FA
  - Logout button in nav → calls `/api/auth/logout`
  - Client-side password strength indicator
- `home.js` — quote list (click → detail page), real-time updates via Socket.IO
- `quote.js` — full quote detail with sources and related quotes
- `author.js` — author bio + all their quotes
- `settings.js` — settings form + embedded logs viewer
- `logs.js` — Dedicated logs viewer:
  - Level filter toggle buttons (error 🔴 / warn 🟡 / info 🔵 / debug ⚪)
  - Category dropdown
  - Date range picker
  - Search input with debounce
  - Paginated log table (50/page)
  - Click row → detail modal
  - Export CSV button
  - Statistics panel (error rate, avg response time, requests/hour)
- `socket.js` — Socket.IO client for real-time quote updates

## Tests — `tests/integration/routes.test.js`

```javascript
import { describe, it, expect, beforeAll, vi } from 'vitest';
import supertest from 'supertest';

// Mock Resend so we don't send real emails
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({ id: 'test-email' }) }
  }))
}));

describe('API Routes', () => {
  let app, request, authCookie;

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

    // Create a test user and get an authenticated session for protected route tests.
    // In test mode, the auth service should expose a helper or the 2FA code
    // can be retrieved from the DB directly for testing purposes.
    // The exact mechanism depends on Phase 4A's test-mode implementation.
    // At minimum, create a session directly in the DB for integration tests:
    const { default: authService } = await import('../../src/services/auth.js');
    const db = (await import('../../src/config/database.js')).default.db;

    // Insert a test user
    const hash = await authService.hashPassword('TestP@ss1');
    db.prepare('INSERT OR IGNORE INTO users (email, password_hash, display_name, is_verified) VALUES (?, ?, ?, 1)')
      .run('testuser@test.com', hash, 'Test User');
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get('testuser@test.com');

    // Create a session directly
    const sessionId = authService.createSession ? await authService.createSession(user.id) : crypto.randomUUID();
    if (!authService.createSession) {
      const expires = Math.floor(Date.now() / 1000) + 86400 * 7;
      db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionId, user.id, expires);
    }

    authCookie = `session_id=${sessionId}`;
  });

  describe('Static & PWA (public)', () => {
    it('GET / serves HTML', async () => {
      const res = await request.get('/');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
    });

    it('GET /manifest.json returns PWA manifest', async () => {
      const res = await request.get('/manifest.json');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name');
    });

    it('GET /sw.js returns service worker', async () => {
      const res = await request.get('/sw.js');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('javascript');
    });
  });

  describe('Protected routes reject unauthenticated requests', () => {
    it('GET /api/quotes returns 401 without auth', async () => {
      const res = await request.get('/api/quotes');
      expect(res.status).toBe(401);
    });

    it('GET /api/settings returns 401 without auth', async () => {
      const res = await request.get('/api/settings');
      expect(res.status).toBe(401);
    });
  });

  describe('Quotes (authenticated)', () => {
    it('GET /api/quotes returns paginated list', async () => {
      const res = await request.get('/api/quotes').set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('quotes');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.quotes)).toBe(true);
    });
  });

  describe('Authors (authenticated)', () => {
    it('GET /api/authors returns list', async () => {
      const res = await request.get('/api/authors').set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('authors');
      expect(Array.isArray(res.body.authors)).toBe(true);
    });
  });

  describe('Settings (authenticated)', () => {
    it('GET /api/settings returns settings object', async () => {
      const res = await request.get('/api/settings').set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(typeof res.body).toBe('object');
    });

    it('PUT /api/settings updates a value', async () => {
      const res = await request.put('/api/settings').set('Cookie', authCookie).send({ theme: 'dark' });
      expect(res.status).toBe(200);
    });
  });

  describe('Logs (authenticated)', () => {
    it('GET /api/logs returns paginated logs', async () => {
      const res = await request.get('/api/logs?page=1&limit=20').set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('logs');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('totalPages');
    });

    it('GET /api/logs/stats returns statistics', async () => {
      const res = await request.get('/api/logs/stats').set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('errorCount24h');
      expect(res.body).toHaveProperty('topCategories');
    });

    it('GET /api/logs/export returns CSV', async () => {
      const res = await request.get('/api/logs/export').set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
    });
  });

  describe('Health (public)', () => {
    it('GET /api/health returns service status without auth', async () => {
      const res = await request.get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body).toHaveProperty('services');
      expect(res.body).toHaveProperty('version');
    });
  });
});
```

## Verification
```bash
npx vitest run
```

## Checkpoint
```bash
git add -A && git commit -m "phase-6: frontend, routes, logs viewer" && git push
```

Report: "Phase 6 complete. N/N tests passing. Frontend serves correctly. Ready for /phase-7."
