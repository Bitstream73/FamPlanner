import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import supertest from 'supertest';
import { sign } from 'cookie-signature';

// Mock Resend so we don't send real emails
vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor() {
      this.emails = {
        send: vi.fn().mockResolvedValue({ id: 'test-email' }),
      };
    }
  },
}));

describe('API Routes', () => {
  let app, request, authCookie;
  const SESSION_SECRET = 'test-secret-that-is-at-least-32-characters';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.PINECONE_API_KEY = 'test-key';
    process.env.PINECONE_INDEX_HOST = 'https://test.pinecone.io';
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.RESEND_FROM_EMAIL = 'noreply@test.com';
    process.env.SESSION_SECRET = SESSION_SECRET;

    // Initialize test database before importing app
    const { initTestDatabase } = await import('../../src/config/database.js');
    initTestDatabase();

    const { createApp } = await import('../../src/index.js');
    const result = createApp();
    app = result.app;
    request = supertest(app);

    // Create a test user and session directly in DB for authenticated tests
    const { default: authService } = await import('../../src/services/auth.js');
    const { default: database } = await import('../../src/config/database.js');

    const hash = await authService.hashPassword('TestP@ss1');
    database.db
      .prepare('INSERT OR IGNORE INTO users (email, password_hash, display_name, is_verified) VALUES (?, ?, ?, 1)')
      .run('testuser@test.com', hash, 'Test User');
    const user = database.db.prepare('SELECT id FROM users WHERE email = ?').get('testuser@test.com');

    const sessionId = authService.createSession(user.id);

    // Sign the cookie the same way cookie-parser expects it
    const signed = sign(sessionId, SESSION_SECRET);
    authCookie = `session_id=s%3A${encodeURIComponent(signed)}`;
  });

  afterAll(async () => {
    const { closeDatabase } = await import('../../src/config/database.js');
    closeDatabase();
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
