import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import supertest from 'supertest';

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor() {
      this.emails = {
        send: vi.fn().mockResolvedValue({ id: 'test-email' }),
      };
    }
  },
}));

describe('Health Check (CI verification)', () => {
  let request;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.PINECONE_API_KEY = 'test-key';
    process.env.PINECONE_INDEX_HOST = 'https://test.pinecone.io';
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.RESEND_FROM_EMAIL = 'noreply@test.com';
    process.env.SESSION_SECRET = 'test-secret-that-is-at-least-32-characters';

    const { initTestDatabase } = await import('../../src/config/database.js');
    initTestDatabase();

    const { createApp } = await import('../../src/index.js');
    const { app } = createApp();
    request = supertest(app);
  });

  afterAll(async () => {
    const { closeDatabase } = await import('../../src/config/database.js');
    closeDatabase();
  });

  it('should return healthy with version and services', async () => {
    const res = await request.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('services');
    expect(res.body.services).toHaveProperty('database');
  });
});
