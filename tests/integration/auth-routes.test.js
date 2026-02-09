import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import supertest from 'supertest';

// Mock Resend so we don't send real emails in tests
vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor() {
      this.emails = {
        send: vi.fn().mockResolvedValue({ id: 'test-email' })
      };
    }
  }
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

    // Initialize test database before importing app
    const { initTestDatabase } = await import('../../src/config/database.js');
    initTestDatabase();

    const { createApp } = await import('../../src/index.js');
    const result = createApp();
    app = result.app;
    request = supertest(app);
  });

  afterAll(async () => {
    const { closeDatabase } = await import('../../src/config/database.js');
    closeDatabase();
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
